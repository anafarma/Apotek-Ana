import { createSaleItem } from '../../domain/sales/SaleItem.js';
import { calculateStockMovement } from '../../domain/inventory/StockMovement.js';

/** Server-authoritative sale command; persistence is injected. */
export async function createSale(command, deps, clock = () => new Date()) {
  validateCommand(command);
  const now = clock();
  const claim = await deps.requestLedger.claim({
    requestId: command.requestId,
    action: 'CREATE_SALE',
    actorId: command.actor?.userId ?? null,
    createdAt: now.toISOString()
  });
  if (claim?.status === 'COMPLETED') return claim.result;
  if (claim?.status === 'IN_PROGRESS') throw new Error('REQUEST_IN_PROGRESS');

  try {
    await deps.authorization.assertCanSell(command.actor);
    await deps.shifts.assertOpen(command.shiftId);
    const resolvedItems = [];

    for (const input of command.items) {
      const product = await deps.products.get(input.productId);
      if (!product || product.active === false) throw new Error('PRODUCT_NOT_FOUND');
      const unit = await deps.units.getSellable(input.productId, input.unitId);
      if (!unit || unit.active === false || unit.canSell === false) throw new Error('UNIT_NOT_SELLABLE');
      const price = await deps.pricing.getEffective(input.productId, input.unitId, now);
      if (!price || price.active === false || !Number.isSafeInteger(price.price) || price.price < 0) {
        throw new Error('PRICE_NOT_AVAILABLE');
      }
      resolvedItems.push(createSaleItem({
        productId: product.productId,
        productName: product.name,
        unitId: unit.unitId,
        unitName: unit.name,
        qty: input.qty,
        conversionFactor: unit.conversionFactor,
        unitPrice: price.price,
        priceId: price.priceId
      }));
    }

    const subtotal = resolvedItems.reduce((sum, item) => sum + item.subtotal, 0);
    const discount = command.discount ?? 0;
    const tax = command.tax ?? 0;
    if (!isSafeMoney(discount) || discount > subtotal) throw new Error('INVALID_DISCOUNT');
    if (!isSafeMoney(tax)) throw new Error('INVALID_TAX');
    const total = subtotal - discount + tax;
    if (!isSafeMoney(total)) throw new Error('INVALID_TOTAL');
    const payment = normalizePayment(command.payment);
    if (payment.amount < total) throw new Error('INSUFFICIENT_PAYMENT');

    const transaction = Object.freeze({
      transactionId: command.transactionId ?? deps.ids.newId(),
      receiptNumber: command.receiptNumber ?? deps.ids.newReceiptNumber(now),
      requestId: command.requestId,
      shiftId: command.shiftId,
      customerId: command.customerId ?? null,
      actorId: command.actor?.userId ?? null,
      items: Object.freeze(resolvedItems),
      subtotal, discount, tax, total, payment,
      createdAt: now.toISOString()
    });

    // Adapter MUST lock, re-read current stock, append immutable stock ledger,
    // persist sale/payment, then mark RequestLedger COMPLETED. Client snapshots
    // are never authoritative.
    for (const item of transaction.items) {
      const stock = await deps.inventory.getBaseStock(item.productId);
      calculateStockMovement({ stockBefore: stock, quantityBase: item.qtyBase, movementType: 'SALE' });
    }
    const result = await deps.transactions.commitSale(transaction);
    await deps.requestLedger.complete(command.requestId, result);
    return result;
  } catch (error) {
    await deps.requestLedger.fail(command.requestId, { code: error.code ?? error.message ?? 'COMMIT_FAILED' });
    throw error;
  }
}

function validateCommand(command) {
  if (!command || typeof command !== 'object') throw new Error('INVALID_REQUEST');
  if (!isNonEmpty(command.requestId)) throw new Error('INVALID_REQUEST_ID');
  if (!isNonEmpty(command.shiftId)) throw new Error('SHIFT_REQUIRED');
  if (!Array.isArray(command.items) || command.items.length === 0) throw new Error('INVALID_ITEMS');
  if (command.items.some(item => !item || !isNonEmpty(item.productId) || !isNonEmpty(item.unitId))) throw new Error('INVALID_ITEMS');
}
function normalizePayment(payment) {
  if (!payment || typeof payment !== 'object' || !isNonEmpty(payment.method)) throw new Error('INVALID_PAYMENT');
  if (!isSafeMoney(payment.amount)) throw new Error('INVALID_PAYMENT_AMOUNT');
  return Object.freeze({ method: payment.method, amount: payment.amount });
}
function isSafeMoney(value) { return Number.isSafeInteger(value) && value >= 0; }
function isNonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }
