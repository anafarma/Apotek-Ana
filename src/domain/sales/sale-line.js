export function assertPositiveQuantity(qty) {
  if (typeof qty !== 'number' || !Number.isFinite(qty) || qty <= 0) {
    throw new Error('QUANTITY_INVALID');
  }
}

export function calculateBaseQuantity(qty, conversionFactor) {
  assertPositiveQuantity(qty);
  if (typeof conversionFactor !== 'number' || !Number.isFinite(conversionFactor) || conversionFactor <= 0) {
    throw new Error('CONVERSION_INVALID');
  }
  return qty * conversionFactor;
}

export function calculateLineTotal(qty, unitPrice) {
  assertPositiveQuantity(qty);
  if (typeof unitPrice !== 'number' || !Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error('PRICE_NOT_AVAILABLE');
  }
  return qty * unitPrice;
}

export function buildSaleLine({ productId, unitId, unitName, qty, conversionFactor, unitPrice, priceId }) {
  const qtyBase = calculateBaseQuantity(qty, conversionFactor);
  const subtotal = calculateLineTotal(qty, unitPrice);
  return Object.freeze({
    productId,
    unitId,
    unitNameSnapshot: unitName,
    qty,
    conversionFactorSnapshot: conversionFactor,
    qtyBase,
    unitPriceSnapshot: unitPrice,
    priceId,
    subtotal,
  });
}
