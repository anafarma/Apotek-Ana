export const AUDIT_ACTIONS = Object.freeze({
  SALE_CREATE: 'SALE_CREATE',
  PRICE_CHANGE: 'PRICE_CHANGE',
  STOCK_ADJUST: 'STOCK_ADJUST',
  STOCK_OPNAME: 'STOCK_OPNAME',
  PURCHASE_RECEIVE: 'PURCHASE_RECEIVE',
  USER_CHANGE: 'USER_CHANGE',
  CONFIG_CHANGE: 'CONFIG_CHANGE'
});

export function createAuditEvent({ auditId, action, actorId, targetType, targetId, requestId, occurredAt, summary = null }) {
  if (!auditId || !actorId || !requestId || !targetType || !targetId) throw new Error('INVALID_AUDIT_CONTEXT');
  if (!Object.values(AUDIT_ACTIONS).includes(action)) throw new Error('INVALID_AUDIT_ACTION');
  return Object.freeze({ auditId, action, actorId, targetType, targetId, requestId, occurredAt, summary });
}
