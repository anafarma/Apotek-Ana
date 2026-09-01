import { TransactionCodes as C } from '../application/transactions/TransactionError.js';

/** Convert an internal sale result into the documented external API response. */
export function toCreateSaleResponse(result) {
  const totals = result?.totals ?? {
    subtotal: result?.subtotal ?? 0,
    discount: result?.discount ?? 0,
    tax: result?.tax ?? 0,
    total: result?.total ?? 0
  };
  return {
    success: true,
    transactionId: result?.transactionId,
    receiptNumber: result?.receiptNumber ?? null,
    status: result?.status ?? 'COMPLETED',
    items: result?.items ?? [],
    totals,
    timestamp: result?.timestamp ?? result?.createdAt ?? null
  };
}

const ERROR_MAP = Object.freeze({
  [C.STOCK_INSUFFICIENT]: 'INSUFFICIENT_STOCK',
  [C.REQUEST_PAYLOAD_MISMATCH]: 'DUPLICATE_REQUEST',
  [C.TRANSACTION_RECOVERY_REQUIRED]: 'COMMIT_FAILED'
});

export function toApiError(error) {
  const internal = error?.code || 'COMMIT_FAILED';
  return {
    success: false,
    error: ERROR_MAP[internal] ?? internal,
    message: error?.message || internal
  };
}
