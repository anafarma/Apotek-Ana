import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSale } from '../../src/domain/sales/Sale.js';
import { resolvePrice } from '../../src/domain/pricing/resolvePrice.js';
import { createStockMovement } from '../../src/domain/inventory/stockMovement.js';

test('Box price is independent from Strip price', () => {
  const prices = [
    { priceId: 'P-STRIP', productId: 'AMLO-10', unitId: 'STRIP', price: 4000, effectiveFrom: '2026-08-01T00:00:00+08:00' },
    { priceId: 'P-BOX', productId: 'AMLO-10', unitId: 'BOX', price: 35000, effectiveFrom: '2026-08-01T00:00:00+08:00' }
  ];
  assert.equal(resolvePrice({ prices, productId: 'AMLO-10', unitId: 'STRIP', at: '2026-08-31T10:00:00+08:00' }).price, 4000);
  assert.equal(resolvePrice({ prices, productId: 'AMLO-10', unitId: 'BOX', at: '2026-08-31T10:00:00+08:00' }).price, 35000);
});

test('one Box snapshots conversion 10 and price 35000', () => {
  const sale = buildSale({
    saleId: 'S1', shiftId: 'SH1', cashierId: 'U1', createdAt: '2026-08-31T10:00:00+08:00',
    items: [{ productId: 'AMLO-10', productName: 'Amlodipine 10 mg', unitId: 'BOX', unitName: 'Box', qty: 1, conversionFactor: 10, unitPrice: 35000, priceId: 'P-BOX' }]
  });
  assert.equal(sale.total, 35000);
  assert.equal(sale.items[0].qtyBase, 10);
  assert.equal(sale.items[0].unitPrice, 35000);
});

test('mixed units remain separate and inventory is base-unit based', () => {
  const sale = buildSale({
    saleId: 'S2', shiftId: 'SH1', cashierId: 'U1', createdAt: '2026-08-31T10:00:00+08:00',
    items: [
      { productId: 'AMLO-10', productName: 'Amlodipine 10 mg', unitId: 'BOX', unitName: 'Box', qty: 1, conversionFactor: 10, unitPrice: 35000, priceId: 'P-BOX' },
      { productId: 'AMLO-10', productName: 'Amlodipine 10 mg', unitId: 'STRIP', unitName: 'Strip', qty: 2, conversionFactor: 1, unitPrice: 4000, priceId: 'P-STRIP' }
    ]
  });
  assert.equal(sale.total, 43000);
  assert.deepEqual(sale.items.map(i => i.qtyBase), [10, 2]);
});

test('stock movement rejects negative resulting stock', () => {
  assert.throws(() => createStockMovement({ ledgerId: 'L1', productId: 'AMLO-10', transactionId: 'S3', movementType: 'SALE', quantityBase: -11, stockBefore: 10, actorId: 'U1', occurredAt: '2026-08-31T10:00:00+08:00' }), /INSUFFICIENT_STOCK/);
});
