/**
 * Pure domain value object for a committed sale line.
 * No persistence, UI, or framework dependencies.
 */
export function createSaleItem({ productId, productName, unitId, unitName, qty, conversionFactor, unitPrice, priceId }) {
  assertNonEmpty(productId, 'productId');
  assertNonEmpty(unitId, 'unitId');
  assertPositiveFinite(qty, 'qty');
  assertPositiveFinite(conversionFactor, 'conversionFactor');
  assertNonNegativeFinite(unitPrice, 'unitPrice');

  const qtyBase = qty * conversionFactor;
  if (!Number.isSafeInteger(qtyBase)) {
    throw new Error('INVALID_BASE_QUANTITY');
  }

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
    subtotal: qty * unitPrice
  });
}

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`INVALID_${field.toUpperCase()}`);
}

function assertPositiveFinite(value, field) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}

function assertNonNegativeFinite(value, field) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}
