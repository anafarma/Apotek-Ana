/**
 * Pure inventory invariant. All quantities are in the product base unit.
 * Persistence and locking belong to the application/infrastructure layers.
 */
export function calculateStockMovement({ stockBefore, quantityBase, movementType }) {
  assertSafeInteger(stockBefore, 'stockBefore');
  assertSafeInteger(quantityBase, 'quantityBase');
  if (quantityBase === 0) throw new Error('INVALID_QUANTITY_BASE');

  const inbound = new Set(['PURCHASE', 'RETURN_IN', 'ADJUSTMENT_IN', 'OPENING', 'OPNAME_IN']);
  const outbound = new Set(['SALE', 'RETURN_OUT', 'ADJUSTMENT_OUT', 'OPNAME_OUT']);
  if (!inbound.has(movementType) && !outbound.has(movementType)) {
    throw new Error('INVALID_MOVEMENT_TYPE');
  }

  const delta = inbound.has(movementType) ? quantityBase : -quantityBase;
  const stockAfter = stockBefore + delta;
  if (!Number.isSafeInteger(stockAfter)) throw new Error('STOCK_OVERFLOW');
  if (stockAfter < 0) throw new Error('INSUFFICIENT_STOCK');

  return Object.freeze({ movementType, quantityBase, stockBefore, stockAfter, delta });
}

function assertSafeInteger(value, field) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`INVALID_${field.toUpperCase()}`);
}
