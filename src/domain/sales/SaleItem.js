/**
 * Pure domain value object for a committed sale line.
 * Money is represented as a non-negative integer in the configured currency
 * minor unit (IDR therefore uses whole rupiah). Quantities are positive whole
 * sellable units; inventory is always represented in base units.
 */
export function createSaleItem({ productId, productName, unitId, unitName, qty, conversionFactor, unitPrice, priceId }) {
  assertNonEmpty(productId, 'productId');
  assertNonEmpty(unitId, 'unitId');
  assertPositiveInteger(qty, 'qty');
  assertPositiveInteger(conversionFactor, 'conversionFactor');
  assertMoney(unitPrice, 'unitPrice');

  const qtyBase = qty * conversionFactor;
  if (!Number.isSafeInteger(qtyBase)) throw new Error('INVALID_BASE_QUANTITY');

  const subtotal = qty * unitPrice;
  if (!Number.isSafeInteger(subtotal)) throw new Error('INVALID_SUBTOTAL');

  return Object.freeze({
    productId,
    productName: productName ?? '',
    unitId,
    unitName: unitName ?? '',
    qty,
    conversionFactor,
    qtyBase,
    unitPrice,
    priceId: priceId ?? null,
    subtotal
  });
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`INVALID_${field.toUpperCase()}`);
}
function assertPositiveInteger(value, field) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}
function assertMoney(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}
