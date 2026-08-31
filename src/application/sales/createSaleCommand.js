import { buildSale } from '../../domain/sales/Sale.js';
import { resolvePrice } from '../../domain/pricing/resolvePrice.js';

/**
 * Application orchestration boundary. Infrastructure dependencies are injected.
 * This is intentionally not wired to Sheets yet until the live schema audit is complete.
 */
export function createSaleCommand({ repositories, clock, ids, requestId, actor, shiftId, customerId, items, payment }) {
  if (!requestId) throw new Error('REQUEST_ID_REQUIRED');
  if (!actor?.userId) throw new Error('ACTOR_REQUIRED');

  const existing = repositories.requestLedger.find(requestId);
  if (existing) return existing.result;

  if (!repositories.authorization.can(actor, 'sale.create')) throw new Error('FORBIDDEN');
  if (!repositories.shifts.isOpen(shiftId, actor.userId)) throw new Error('SHIFT_NOT_OPEN');

  const now = clock.now();
  const resolvedItems = items.map((item) => {
    const product = repositories.products.get(item.productId);
    if (!product || product.active === false) throw new Error('PRODUCT_NOT_ACTIVE');
    const unit = repositories.productUnits.get(item.unitId);
    if (!unit || unit.productId !== item.productId || unit.active === false || !unit.canSell) {
      throw new Error('SELLING_UNIT_NOT_ACTIVE');
    }
    const conversionFactor = repositories.conversions.resolveToBase(item.productId, item.unitId);
    const price = resolvePrice({ prices: repositories.prices.list(item.productId), productId: item.productId, unitId: item.unitId, at: now });
    return {
      productId: product.productId,
      productName: product.name,
      unitId: unit.unitId,
      unitName: unit.name,
      qty: item.qty,
      conversionFactor,
      unitPrice: price.price,
      priceId: price.priceId
    };
  });

  const sale = buildSale({
    saleId: ids.saleId(),
    receiptNumber: ids.receiptNumber(),
    shiftId,
    cashierId: actor.userId,
    customerId,
    items: resolvedItems,
    createdAt: now
  });

  if (payment?.amount !== sale.total) throw new Error('PAYMENT_AMOUNT_MISMATCH');
  repositories.inventory.assertAvailable(sale.items);
  const result = repositories.transaction.commitSale({ sale, payment, requestId, actor, now });
  repositories.requestLedger.record({ requestId, command: 'sale.create', result, actorId: actor.userId, createdAt: now });
  return result;
}
