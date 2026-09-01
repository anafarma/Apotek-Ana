import { createSaleItem } from '../../domain/sales/SaleItem.js';
import { calculateStockMovement } from '../../domain/inventory/StockMovement.js';

/**
 * Application command for a sale. Dependencies are injected so the domain/application
 * layer stays independent from Google Sheets, SpreadsheetApp and HTTP.
 *
 * Required ports:
 * - requestLedger: get(requestId), begin(request), complete(requestId, result), fail(...)
 * - products: get(productId)
 * - units: getSellable(productId, unitId)
 * - pricing: getEffective(productId, unitId, at)
 * - inventory: getBaseStock(productId), reserveOrCommitSale(...)
 * - shifts: assertOpen(shiftId)
 * - authorization: assertCanSell(actor)
 * - transactions: commitSale(transaction)
 */
export async function createSale(command, deps, clock = () => new Date()) {
  validateCommand(command);
  const now = clock();

  const existing = await deps.requestLedger.get(command.requestId);
  if (existing?.status === 'COMPLETED') return existing.result;
  if (existing?.status === 'IN_PROGRESS') throw new Error('REQUEST_IN_PROGRESS');

  await deps.authorization.assertCanSell(command.actor);
  await deps.shifts.assertOpen(command.shiftId);

  const resolvedItems = [];
  for (const input of command.items) {
    const product = await deps.products.get(input.productId);
    if (!product || product.active === false) throw new Error('PRODUCT_NOT_FOUND');

    const unit = await deps.units.getSellable(input.productId, input.unitId);
    if (!unit || unit.active === false || unit.canSell === false) throw new Error('UNIT_NOT_SELLABLE');

    const price = await deps.pricing.getEffective(input.productId, input.unitId, now);
    if (!price || price.active === false || price.price < 0) throw new Error('PRICE_NOT_AVAILABLE');

    const item = createSaleItem({
      productId: product.productId,
      productName: product.name,
      unitId: unit.unitId,
      unitName: unit.name,
      qty: input.qty,
      conversionFactor: unit.conversionFactor,
      unitPrice: price.price,
      priceId: price.priceId
    });
    resolvedItems.push(item);
  }

  const subtotal = resolvedItems.reduce((sum, item) => sum + item.subtotal, 0);
  const discount = command.discount ?? 0;
  const tax = command.tax ?? 0;
  if (!Number.isFinite(discount) || discount < 0 || discount > subtotal) throw new Error('INVALID_DISCOUNT');
  if (!Number.isFinite(tax) || tax < 0) throw new Error('INVALID_TAX');
  const total = subtotal - discount + tax;
  if (!Number.isSafeInteger(total) && !Number.isFinite(total)) throw new Error('INVALID_TOTAL');

  await deps.requestLedger.begin({ requestId: command.requestId, action: 'CREATE_SALE', actorId: command.actor?.userId ?? null, createdAt: now.toISOString() });

  const transaction = Object.freeze({
    transactionId: command.transactionId ?? deps.ids.newId(),
    receiptNumber: command.receiptNumber ?? deps.ids.newReceiptNumber(now),
    requestId: command.requestId,
    shiftId: command.shiftId,
    customerId: command.customerId ?? null,
    actorId: command.actor?.userId ?? null,
    items: resolvedItems,
    subtotal,
    discount,
    tax,
    total,
    payment: normalizePayment(command.payment),
    createdAt: now.toISOString()
  });

  try {
    // Adapter must acquire the product lock, re-read current stock, validate every
    // movement, append immutable ledger rows, persist sale/payment, and only then
    // mark RequestLedger COMPLETED. It must never rely on client stock snapshots.
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
  if (!Number.isFinite(payment.amount) || payment.amount < 0) throw new Error('INVALID_PAYMENT_AMOUNT');
  return Object.freeze({ method: payment.method, amount: payment.amount });
}

function isNonEmpty(value) { return typeof value === 'string' && value.trim() !== ''; }
