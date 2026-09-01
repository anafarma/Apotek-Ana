import test from 'node:test';
import assert from 'node:assert/strict';
import { toCreateSaleResponse, toApiError } from '../../src/contracts/apiResponse.js';

test('sale response exposes the documented HTTP shape without leaking authoritative internals', () => {
  const result = toCreateSaleResponse({
    transactionId: 'TX-1', receiptNumber: 'TRX-20260901-00001', status: 'COMPLETED',
    items: [{ productId: 'P1', unitId: 'U1', qty: 1 }],
    subtotal: 35000, discount: 0, tax: 0, total: 35000, createdAt: '2026-09-01T02:00:00Z'
  });
  assert.deepEqual(result, {
    success: true,
    transactionId: 'TX-1',
    receiptNumber: 'TRX-20260901-00001',
    status: 'COMPLETED',
    items: [{ productId: 'P1', unitId: 'U1', qty: 1 }],
    totals: { subtotal: 35000, discount: 0, tax: 0, total: 35000 },
    timestamp: '2026-09-01T02:00:00Z'
  });
  assert.equal('unitPrice' in result, false);
  assert.equal('stockBefore' in result, false);
});

test('error adapter maps internal stock and idempotency codes to stable API codes', () => {
  assert.equal(toApiError({ code: 'STOCK_INSUFFICIENT', message: 'not enough stock' }).error, 'INSUFFICIENT_STOCK');
  assert.equal(toApiError({ code: 'REQUEST_PAYLOAD_MISMATCH' }).error, 'DUPLICATE_REQUEST');
  assert.equal(toApiError({ code: 'TRANSACTION_RECOVERY_REQUIRED' }).error, 'COMMIT_FAILED');
});
