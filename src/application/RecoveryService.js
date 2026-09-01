export class RecoveryService {
  constructor({ journal, requestLedger, sales, stock, audit, clock = () => new Date().toISOString() }) {
    this.journal = journal; this.requestLedger = requestLedger; this.sales = sales; this.stock = stock; this.audit = audit; this.clock = clock;
  }
  inspect() { return this.journal.listRecoverable(); }
  reconcile(record) {
    if (!record || !record.TransactionId || !record.RequestId) throw new Error('INVALID_RECOVERY_RECORD');
    const tx = String(record.TransactionId);
    const state = this.sales.getTransactionState(tx);
    if (state?.committed) {
      this.journal.commit(record.JournalId, this.clock());
      this.requestLedger.complete(record.RequestId, tx, state.result ?? { transactionId: tx, status: 'COMPLETED' }, this.clock());
      return { action: 'MARK_COMMITTED', transactionId: tx };
    }
    if (state?.exists) throw new Error('PARTIAL_TRANSACTION_REQUIRES_MANUAL_RECONCILIATION');
    const movements = this.stock.listByTransaction(tx);
    if (movements.length) throw new Error('STOCK_MOVEMENTS_EXIST_WITHOUT_SALE');
    this.audit.append({ auditId: `REC-${tx}`, occurredAt: this.clock(), actorId: 'SYSTEM', action: 'RECOVERY_CONFIRMED_NO_WRITE', entityType: 'Transaction', entityId: tx, requestId: record.RequestId, metadata: { journalId: record.JournalId } });
    this.requestLedger.fail(record.RequestId, 'RECOVERY_ABORTED_NO_TRANSACTION', this.clock());
    return { action: 'ABORTED_NO_TRANSACTION', transactionId: tx };
  }
}
