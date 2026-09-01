export const STOCK_MOVEMENT_TYPES = Object.freeze({
  OPENING: 'OPENING', PURCHASE: 'PURCHASE', SALE: 'SALE', RETURN_IN: 'RETURN_IN',
  RETURN_OUT: 'RETURN_OUT', ADJUSTMENT_IN: 'ADJUSTMENT_IN', ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
  OPNAME_IN: 'OPNAME_IN', OPNAME_OUT: 'OPNAME_OUT'
});

const INBOUND = new Set(['OPENING', 'PURCHASE', 'RETURN_IN', 'ADJUSTMENT_IN', 'OPNAME_IN']);
const OUTBOUND = new Set(['SALE', 'RETURN_OUT', 'ADJUSTMENT_OUT', 'OPNAME_OUT']);

export function createStockMovement(input) {
  const { movementId, transactionId, productId, quantityBase, type, occurredAt, actorId, reason = '' } = input ?? {};
  if (!movementId || !productId || !transactionId) throw new Error('movementId, transactionId and productId are required');
  if (!Number.isSafeInteger(quantityBase) || quantityBase <= 0) throw new Error('quantityBase must be a positive safe integer');
  if (!INBOUND.has(type) && !OUTBOUND.has(type)) throw new Error(`Unsupported stock movement type: ${type}`);
  if (!occurredAt || !actorId) throw new Error('occurredAt and actorId are required');
  return Object.freeze({ movementId, transactionId, productId, quantityBase, direction: INBOUND.has(type) ? 'IN' : 'OUT', type, occurredAt, actorId, reason });
}

export function applyStockMovement(balance, movement) {
  if (!Number.isSafeInteger(balance) || balance < 0) throw new Error('Invalid stock balance');
  const next = balance + (movement.direction === 'IN' ? movement.quantityBase : -movement.quantityBase);
  if (next < 0) throw new Error('Insufficient stock');
  if (!Number.isSafeInteger(next)) throw new Error('Stock balance exceeds safe integer range');
  return next;
}
