import test from 'node:test';
import assert from 'node:assert/strict';
import { createSale } from '../../src/application/sales/CreateSale.js';

function deps({ stock = 100, commitSale = async tx => ({ success: true, transactionId: tx.transactionId, total: tx.total }) } = {}) {
  const requests = new Map();
  return {
    requestLedger: {
      async claim(row) {
        const existing = requests.get(row.requestId);
        if (existing) return existing;
        requests.set(row.requestId, { status: 'IN_PROGRESS' });
        return { status: 'CLAIMED' };
      },
      async complete(id, result) { requests.set(id, { status: 'COMPLETED', result }); },
      async fail(id, error) { requests.set(id, { status: 'FAILED', error }); }
    },
    authorization: { async assertCanSell() {} },
    shifts: { async assertOpen() {} },
    products: { async get(id) { return { productId: id, name: 'Amlodipine', active: true }; } },
    units: { async getSellable(_productId, unitId) { return { unitId, name: unitId === 'box' ? 'Box' : 'Strip', active: true, canSell: true, conversionFactor: unitId === 'box' ? 10 : 1 }; } },
    pricing: { async getEffective(_productId, unitId) { return { priceId: `price-${unitId}`, active: true, price: unitId === 'box' ? 35000 : 4000 }; } },
    inventory: { async getBaseStock() { return stock; } },
    ids: { newId: () => 'sale-1', newReceiptNumber: () => 'TRX-TEST-1' },
    transactions: { commitSale }
  };
}

test('server resolves box price independently from strip price', async () => {
  const result = await createSale({ requestId: 'req-box-1', shiftId: 'shift-1', actor: { userId: 'cashier-1' }, items: [{ productId: 'amlodipine', unitId: 'box', qty: 1 }], payment: { method: 'cash', amount: 35000 } }, deps());
  assert.equal(result.total, 35000);
});

test('server converts box quantity to base stock quantity', async () => {
  let committed;
  const result = await createSale({ requestId: 'req-box-2', shiftId: 'shift-1', actor: { userId: 'cashier-1' }, items: [{ productId: 'amlodipine', unitId: 'box', qty: 2 }], payment: { method: 'cash', amount: 70000 } }, deps({ commitSale: async tx => { committed = tx; return { transactionId: tx.transactionId, total: tx.total }; } }));
  assert.equal(result.total, 70000);
  assert.equal(committed.items[0].qty, 2);
  assert.equal(committed.items[0].conversionFactor, 10);
  assert.equal(committed.items[0].qtyBase, 20);
});

test('retry of completed request returns original result without recommit', async () => {
  let commits = 0;
  const d = deps({ commitSale: async tx => { commits++; return { transactionId: tx.transactionId, total: tx.total }; } });
  const command = { requestId: 'req-idempotent', shiftId: 'shift-1', actor: { userId: 'cashier-1' }, items: [{ productId: 'amlodipine', unitId: 'strip', qty: 1 }], payment: { method: 'cash', amount: 4000 } };
  const first = await createSale(command, d);
  const second = await createSale(command, d);
  assert.deepEqual(second, first);
  assert.equal(commits, 1);
});

test('sale is rejected when base stock is insufficient', async () => {
  await assert.rejects(() => createSale({ requestId: 'req-stock', shiftId: 'shift-1', actor: { userId: 'cashier-1' }, items: [{ productId: 'amlodipine', unitId: 'box', qty: 2 }], payment: { method: 'cash', amount: 70000 } }, deps({ stock: 10 })), /INSUFFICIENT_STOCK/);
});

test('cash payment below total is rejected before commit', async () => {
  let commits = 0;
  await assert.rejects(() => createSale({ requestId: 'req-payment', shiftId: 'shift-1', actor: { userId: 'cashier-1' }, items: [{ productId: 'amlodipine', unitId: 'strip', qty: 1 }], payment: { method: 'cash', amount: 3999 } }, deps({ commitSale: async tx => { commits++; return tx; } })), /INSUFFICIENT_PAYMENT/);
  assert.equal(commits, 0);
});
