/**
 * Produces a deterministic, runtime-neutral canonical payload for idempotency.
 * Hashing is injected so Apps Script can use Utilities.computeDigest.
 */
export function canonicalizeSaleCommand(command) {
  return JSON.stringify({
    action: 'CREATE_SALE',
    requestId: command.requestId,
    shiftId: command.shiftId,
    customerId: command.customerId ?? null,
    discount: command.discount ?? 0,
    tax: command.tax ?? 0,
    payment: command.payment ? {
      method: command.payment.method,
      amount: command.payment.amount
    } : null,
    items: [...command.items]
      .map(item => ({ productId: item.productId, unitId: item.unitId, qty: item.qty }))
      .sort((a, b) => `${a.productId}\u0000${a.unitId}`.localeCompare(`${b.productId}\u0000${b.unitId}`))
  });
}

export function fingerprintWith(hashFn, command) {
  if (typeof hashFn !== 'function') throw new Error('HASH_FUNCTION_REQUIRED');
  return hashFn(canonicalizeSaleCommand(command));
}
