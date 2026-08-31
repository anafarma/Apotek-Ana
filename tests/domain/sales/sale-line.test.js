import { buildSaleLine } from '../../src/domain/sales/sale-line.js';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// Canonical regression: Strip Rp4,000; Box Rp35,000; Box = 10 Strip.
const box = buildSaleLine({
  productId: 'AMLO-10', unitId: 'BOX', unitName: 'Box', qty: 1,
  conversionFactor: 10, unitPrice: 35000, priceId: 'PRICE-BOX-001'
});
assert(box.subtotal === 35000, 'Box price must be independent');
assert(box.qtyBase === 10, 'Box must consume 10 base units');

const strip = buildSaleLine({
  productId: 'AMLO-10', unitId: 'STRIP', unitName: 'Strip', qty: 2,
  conversionFactor: 1, unitPrice: 4000, priceId: 'PRICE-STRIP-001'
});
assert(strip.subtotal === 8000, 'Strip price regression');
assert(strip.qtyBase === 2, 'Strip base quantity regression');

const mixedTotal = box.subtotal + strip.subtotal;
const mixedBase = box.qtyBase + strip.qtyBase;
assert(mixedTotal === 43000, 'Mixed-unit total regression');
assert(mixedBase === 12, 'Mixed-unit stock regression');

console.log('PASS: unit-aware sales foundation');
