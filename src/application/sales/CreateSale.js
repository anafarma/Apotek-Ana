import { createSaleItem } from '../../domain/sales/SaleItem.js';
import { TransactionError, TransactionCodes as C } from '../transactions/TransactionError.js';
import { canonicalizeSaleCommand } from '../transactions/transactionFingerprint.js';

/** Server-authoritative sale command. No spreadsheet mutation occurs here. */
export async function createSale(command, deps, clock = () => new Date(), hashFn = value => value) {
  validateCommand(command);
  const now = clock();
  await deps.authorization.assertCanSell(command.actor);
  await deps.shifts.assertOpen(command.shiftId);
  const fingerprint = hashFn(canonicalizeSaleCommand(command));
  const claim = await deps.requestLedger.claim({ requestId: command.requestId, action: 'CREATE_SALE', fingerprint, actorId: command.actor?.userId ?? null, createdAt: now.toISOString() });
  if (claim?.fingerprint && claim.fingerprint !== fingerprint) throw new TransactionError(C.REQUEST_PAYLOAD_MISMATCH);
  if (claim?.status === 'COMPLETED') return claim.result;
  if (claim?.status === 'IN_PROGRESS') throw new TransactionError(C.REQUEST_IN_PROGRESS);
  if (claim?.status === 'RECOVERY_REQUIRED') throw new TransactionError(C.REQUEST_RECOVERY_REQUIRED ?? C.REQUEST_IN_PROGRESS);
  if (claim?.status === 'FAILED') throw new TransactionError(C.REQUEST_FAILED ?? C.REQUEST_IN_PROGRESS);
  if (claim?.status !== 'CLAIMED') throw new TransactionError(C.REQUEST_IN_PROGRESS);

  try {
    const resolvedItems = [];
    for (const input of command.items) {
      const product = await deps.products.get(input.productId);
      if (!product || product.active === false) throw new TransactionError(C.PRODUCT_NOT_FOUND);
      const unit = await deps.units.getSellable(input.productId, input.unitId);
      if (!unit || unit.active === false || unit.canSell === false) throw new TransactionError(C.UNIT_NOT_SELLABLE);
      const price = await deps.pricing.getEffective(input.productId, input.unitId, now);
      if (!price || price.active === false || !Number.isSafeInteger(price.price) || price.price < 0) throw new TransactionError(C.PRICE_NOT_AVAILABLE);
      resolvedItems.push(createSaleItem({ productId: product.productId, productName: product.name, unitId: unit.unitId, unitName: unit.name, qty: input.qty, conversionFactor: unit.conversionFactor, unitPrice: price.price, priceId: price.priceId }));
    }
    const subtotal = resolvedItems.reduce((sum, item) => safeAdd(sum, item.subtotal), 0);
    const discount = command.discount ?? 0;
    const tax = command.tax ?? 0;
    if (!isSafeMoney(discount) || discount > subtotal) throw new TransactionError(C.INVALID_DISCOUNT);
    if (!isSafeMoney(tax)) throw new TransactionError(C.INVALID_TAX);
    const total = subtotal - discount + tax;
    if (!isSafeMoney(total)) throw new TransactionError(C.INVALID_MONEY);
    const payment = normalizePayment(command.payment);
    if (payment.amount < total) throw new TransactionError(C.INSUFFICIENT_PAYMENT);
    const transaction = Object.freeze({ transactionId: command.transactionId ?? deps.ids.newId(), receiptNumber: command.receiptNumber ?? deps.ids.newReceiptNumber(now), requestId: command.requestId, requestFingerprint: fingerprint, shiftId: command.shiftId, customerId: command.customerId ?? null, actorId: command.actor?.userId ?? null, items: Object.freeze(resolvedItems), subtotal, discount, tax, total, payment, createdAt: now.toISOString() });
    const persisted = await deps.transactions.commitSaleAtomic(transaction);
    // Keep the internal legacy-compatible flat fields while also exposing the
    // stable external API shape documented in docs/04-api-contract.md.
    return {
      ...persisted,
      transactionId: persisted?.transactionId ?? transaction.transactionId,
      receiptNumber: persisted?.receiptNumber ?? transaction.receiptNumber,
      status: persisted?.status ?? 'COMPLETED',
      items: persisted?.items ?? transaction.items,
      total: persisted?.total ?? total,
      createdAt: persisted?.createdAt ?? transaction.createdAt,
      totals: persisted?.totals ?? { subtotal, discount, tax, total: persisted?.total ?? total },
      timestamp: persisted?.timestamp ?? persisted?.createdAt ?? transaction.createdAt
    };
  } catch (error) {
    if (error?.code === 'TRANSACTION_RECOVERY_REQUIRED' || error?.code === 'RECOVERY_REQUIRED') {
      if (typeof deps.requestLedger.markRecoveryRequired === 'function') await deps.requestLedger.markRecoveryRequired(command.requestId, 'TRANSACTION_RECOVERY_REQUIRED', clock().toISOString());
    } else if (typeof deps.requestLedger.fail === 'function') {
      await deps.requestLedger.fail(command.requestId, error.code || error.message || 'SALE_VALIDATION_FAILED', clock().toISOString());
    }
    throw error;
  }
}

function validateCommand(command) {
  if (!command || typeof command !== 'object') throw new TransactionError(C.INVALID_REQUEST);
  if (!isNonEmpty(command.requestId)) throw new TransactionError(C.INVALID_REQUEST_ID);
  if (!isNonEmpty(command.shiftId)) throw new TransactionError(C.SHIFT_REQUIRED);
  if (!Array.isArray(command.items) || command.items.length === 0 || command.items.length > 100) throw new TransactionError(C.INVALID_REQUEST);
  for (const item of command.items) if (!item || !isNonEmpty(item.productId) || !isNonEmpty(item.unitId) || !Number.isSafeInteger(item.qty) || item.qty <= 0) throw new TransactionError(C.INVALID_QUANTITY);
}
function normalizePayment(payment) {
  if (!payment || typeof payment !== 'object' || !isNonEmpty(payment.method) || !isSafeMoney(payment.amount)) throw new TransactionError(C.INVALID_PAYMENT);
  return Object.freeze({ method: payment.method, amount: payment.amount });
}
function isSafeMoney(value) { return Number.isSafeInteger(value) && value >= 0; }
function isNonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }
function safeAdd(a, b) { const result = a + b; if (!Number.isSafeInteger(result) || result < 0) throw new TransactionError(C.INVALID_MONEY); return result; }
