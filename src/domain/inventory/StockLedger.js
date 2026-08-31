/** Canonical ledger record shape. Ledger entries are append-only business facts. */
export const STOCK_MOVEMENT_TYPES = Object.freeze({
  PURCHASE: 'PURCHASE',
  SALE: 'SALE',
  RETURN: 'RETURN',
  OPNAME: 'OPNAME',
  ADJUSTMENT: 'ADJUSTMENT'
});

export function rebuildBalance(entries, productId, batchId = null) {
  return entries
    .filter(e => e.productId === productId && (batchId === null || e.batchId === batchId))
    .reduce((balance, e) => balance + e.quantityBase, 0);
}
