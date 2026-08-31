/** Compare a stored balance projection with the append-only ledger. */
export function reconcileBalance({ entries, productId, batchId = null, storedBalance }) {
  const calculated = entries
    .filter(e => e.productId === productId && (batchId === null || e.batchId === batchId))
    .reduce((sum, e) => sum + Number(e.quantityBase), 0);
  const ok = calculated === Number(storedBalance);
  return Object.freeze({ ok, calculated, stored: Number(storedBalance), difference: calculated - Number(storedBalance), productId, batchId });
}
