export function withDocumentLock(fn, timeoutMs = 30000) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(timeoutMs)) throw new Error('Could not acquire document transaction lock');
  try { return fn(); } finally { lock.releaseLock(); }
}
