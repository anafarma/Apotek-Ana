import test from 'node:test';
import assert from 'node:assert/strict';
import { createSale } from '../../src/application/sales/CreateSale.js';

function makeDeps({ commitSaleAtomic = async tx => ({ success: true, transactionId: tx.transactionId, total: tx.total }) } = {}) {
  const requests = new Map();
  return {
    requestLedger: {
      async claim(row) {
        const existing = requests.get(row.requestId);
        if (existing) {
          if (existing.fingerprint !== row.fingerprint) return { ...existing, fingerprint: existing.fingerprint };
          return existing;
        }
        const record = { status: 'IN_PROGRESS', fingerprint: row.fingerprint };
        requests.set(row.requestId, record);
        return { status: 'CLAIMED', fingerprint: row.fingerprint };
      }
    },
    authorization: { async assertCanSell() {} },
    shifts: { async assertOpen() {} },
    products: { async get(id) { return { productId: id, name: 'Amlodipine', active: true }; } },
    units: { async getSellable(_productId, unitId) { return { unitId, name: unitId === 'box' ? 'Box' : 'Strip', active: true, canSell: true, conversionFactor: unitId === 'box' ? 10 : 1 }; } },
    pricing: { async getEffective(_productId, unitId) { return { priceId: `price-${unitId}`, active: true, price: unitId === 'box' ? 35000 : 4000 }; } },
    ids: { newId: () => 'sale-1', newReceiptNumber: () => 'TRX-TEST-1' },
    transactions: {
      async commitSaleAtomic(tx) {
        const result = await commitSaleAtomic(tx);
        requests.set(tx.requestId, { status: 'COMPLETED', fingerprint: tx.requestFingerprint, result });
        return result;
      }
    }
  };
}

const command = (overrides = {}) => ({
  requestId: 'req-test',
  shiftId: 'shift-1',
  actor: { userId: 'cashier-1' },
  items: [{ productId: 'amlodipine', unitId: 'box', qty: 1 }],
  payment: { method: 'cash', amount: 35000 },
  ...overrides
});

test('server resolves box price independently from strip price', async () => {
  const result = await createSale(command(), makeDeps());
  assert.equal(result.total, 35000);
});

test('server records box quantity and base-unit conversion', async () => {
  let committed;
  const result = await createSale(command({ requestId: 'req-box-2', items: [{ productId: 'amlodipine', unitId: 'box', qty: 2 }], payment: { method: 'cash', amount: 70000 } }), makeDeps({ commitSaleAtomic: async tx => { committed = tx; return { transactionId: tx.transactionId, total: tx.total }; } }));
  assert.equal(result.total, 70000);
  assert.equal(committed.items[0].qty, 2);
  assert.equal(committed.items[0].unitId, 'box');
  assert.equal(committed.items[0].conversionFactor, 10);
  assert.equal(committed.items[0].qtyBase, 20);
});

test('completed retry returns original result and does not recommit', async () => {
  let commits = 0;
  const d = makeDeps({ commitSaleAtomic: async tx => { commits++; return { transactionId: tx.transactionId, total: tx.total }; } });
  const c = command({ requestId: 'req-idempotent', items: [{ productId: 'amlodipine', unitId: 'strip', qty: 1 }], payment: { method: 'cash', amount: 4000 } });
  const first = await createSale(c, d);
  const second = await createSale(c, d);
  assert.deepEqual(second, first);
  assert.equal(commits, 1);
});

test('same requestId with different payload is rejected', async () => {
  const d = makeDeps();
  const c = command({ requestId: 'req-mismatch' });
  await createSale(c, d);
  await assert.rejects(
    () => createSale({ ...c, payment: { method: 'cash', amount: 70000 } }, d),
    error => error.code === 'REQUEST_PAYLOAD_MISMATCH'
  );
});

test('insufficient payment is rejected before atomic commit', async () => {
  let commits = 0;
  await assert.rejects(
    () => createSale(command({ requestId: 'req-payment', items: [{ productId: 'amlodipine', unitId: 'strip', qty: 1 }], payment: { method: 'cash', amount: 3999 } }), makeDeps({ commitSaleAtomic: async tx => { commits++; return tx; } })),
    error => error.code === 'INSUFFICIENT_PAYMENT'
  );
  assert.equal(commits, 0);
});

test('in-progress request is not executed twice', async () => {
  const d = makeDeps();
  await d.requestLedger.claim({ requestId: 'req-busy', action: 'CREATE_SALE', fingerprint: 'fp', actorId: 'cashier-1', createdAt: new Date().toISOString() });
  await assert.rejects(
    () => createSale(command({ requestId: 'req-busy' }), d),
    error => error.code === 'REQUEST_IN_PROGRESS'
  );
});
