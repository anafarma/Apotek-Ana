import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaleItem } from '../../src/domain/sales/SaleItem.js';

test('selling price is independent from conversion', () => {
  const item = createSaleItem({
    productId: 'amlodipine',
    productName: 'Amlodipine',
    unitId: 'box',
    unitName: 'Box',
    qty: 1,
    conversionFactor: 10,
    unitPrice: 35000,
    priceId: 'price-box-35000'
  });

  assert.equal(item.qtyBase, 10);
  assert.equal(item.unitPrice, 35000);
  assert.equal(item.subtotal, 35000);
});

test('two selling units can carry different prices', () => {
  const strip = createSaleItem({
    productId: 'amlodipine',
    productName: 'Amlodipine',
    unitId: 'strip',
    unitName: 'Strip',
    qty: 1,
    conversionFactor: 1,
    unitPrice: 4000,
    priceId: 'price-strip-4000'
  });
  const box = createSaleItem({
    productId: 'amlodipine',
    productName: 'Amlodipine',
    unitId: 'box',
    unitName: 'Box',
    qty: 1,
    conversionFactor: 10,
    unitPrice: 35000,
    priceId: 'price-box-35000'
  });

  assert.equal(strip.subtotal, 4000);
  assert.equal(box.subtotal, 35000);
  assert.notEqual(strip.unitPrice, box.unitPrice);
  assert.equal(strip.qtyBase, 1);
  assert.equal(box.qtyBase, 10);
});

test('invalid quantities are rejected', () => {
  assert.throws(() => createSaleItem({
    productId: 'p1', unitId: 'u1', qty: 0, conversionFactor: 1, unitPrice: 1000
  }), /INVALID_QTY/);
});
