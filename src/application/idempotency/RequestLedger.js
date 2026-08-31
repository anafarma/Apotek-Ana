/** Contract for idempotent command processing. Infrastructure supplies persistence. */
export function requireRequestId(requestId) {
  if (typeof requestId !== 'string' || requestId.trim() === '') throw new Error('REQUEST_ID_REQUIRED');
  return requestId.trim();
}

export function assertReplaySafe(existing, commandType, actorId) {
  if (!existing) return;
  if (existing.commandType !== commandType || existing.actorId !== actorId) throw new Error('REQUEST_ID_REUSE_CONFLICT');
}
