# Recovery and reconciliation invariants

1. A request may be completed only once for a given RequestId + PayloadHash.
2. A RequestId with a different PayloadHash is an idempotency conflict.
3. A PREPARED journal is not a successful transaction.
4. RECOVERY_REQUIRED is never replayed through the normal sale path.
5. A committed sale must have its transaction identity consistently represented in Sale, SaleItems, Payment, StockLedger and AuditLog.
6. StockLedger is the authoritative movement history; StockBalance is a rebuildable projection.
7. Recovery must reconcile by TransactionId and must detect partial writes before taking action.
8. Production is never a write target of V2 migration or tests.
