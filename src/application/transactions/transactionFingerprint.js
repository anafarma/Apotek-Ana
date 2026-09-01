import { createHash } from 'node:crypto';

/**
 * Deterministic fingerprint of client intent. Server-resolved price, product
 * name and stock are intentionally excluded because they are not client authority.
 */
export function fingerprintSaleCommand(command) {
  const canonical = {
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
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}
