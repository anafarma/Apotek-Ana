/**
 * Creates a ledger movement. Balance projection is deliberately separate.
 */
export function createStockMovement({ ledgerId, productId, batchId = null, transactionId, movementType, quantityBase, stockBefore, actorId, occurredAt }) {
  if (!ledgerId || !productId || !transactionId || !actorId) throw new Error('INVALID_STOCK_LEDGER_CONTEXT');
  if (!Number.isSafeInteger(quantityBase) || quantityBase === 0) throw new Error('INVALID_STOCK_MOVEMENT');
  if (!Number.isSafeInteger(stockBefore) || stockBefore < 0) throw new Error('INVALID_STOCK_BEFORE');

  const stockAfter = stockBefore + quantityBase;
  if (stockAfter < 0) throw new Error('INSUFFICIENT_STOCK');

  return Object.freeze({
    ledgerId,
    productId,
    batchId,
    transactionId,
    movementType,
    quantityBase,
    stockBefore,
    stockAfter,
    actorId,
    occurredAt
  });
}
