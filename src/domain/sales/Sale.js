/**
 * Pure sales aggregate helpers.
 */
import { createSaleItem } from './SaleItem.js';

export function buildSale({ saleId, receiptNumber, shiftId, cashierId, items, customerId = null, createdAt }) {
  if (!saleId || !shiftId || !cashierId) throw new Error('INVALID_SALE_CONTEXT');
  if (!Array.isArray(items) || items.length === 0) throw new Error('SALE_REQUIRES_ITEMS');

  const saleItems = items.map(createSaleItem);
  const total = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalBaseQty = saleItems.reduce((sum, item) => sum + item.qtyBase, 0);

  return Object.freeze({
    saleId,
    receiptNumber: receiptNumber ?? null,
    shiftId,
    cashierId,
    customerId,
    items: Object.freeze(saleItems),
    total,
    totalBaseQty,
    status: 'COMMITTED',
    createdAt
  });
}
