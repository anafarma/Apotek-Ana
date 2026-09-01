export class RecoveryService {
  constructor({ journal, requestLedger, sales, stock, audit, clock = () => new Date().toISOString(), lock = fn => fn() }) {
    this.journal = journal;
    this.requestLedger = requestLedger;
    this.sales = sales;
    this.stock = stock;
    this.audit = audit;
    this.clock = clock;
    this.lock = lock;
  }

  inspect() { return this.journal.listRecoverable(); }

  /**
   * Recovery is serialized with the same persistence lock used by sale commit.
   * A fully committed transaction is finalized; a partial transaction is
   * never replayed automatically; an empty transaction is safely aborted.
   */
  reconcile(record) {
    return this.lock(() => this._reconcile(record));
  }

  _reconcile(record) {
    if (!record || !record.TransactionId || !record.RequestId || !record.JournalId) throw new Error('INVALID_RECOVERY_RECORD');
    const tx = String(record.TransactionId);
    const state = this.sales.getTransactionState(tx);

    if (state?.committed) {
      this.journal.commit(record.JournalId, this.clock());
      this.requestLedger.complete(record.RequestId, tx, state.result ?? { transactionId: tx, status: 'COMPLETED' }, this.clock());
      return { action: 'MARK_COMMITTED', transactionId: tx, journalId: record.JournalId };
    }

    if (state?.exists) throw new Error('PARTIAL_TRANSACTION_REQUIRES_MANUAL_RECONCILIATION');

    const movements = this.stock.listByTransaction(tx);
    if (movements.length) throw new Error('STOCK_MOVEMENTS_EXIST_WITHOUT_SALE');

    this.audit.append({
      auditId: `REC-${tx}`,
      occurredAt: this.clock(),
      actorId: 'SYSTEM',
      action: 'RECOVERY_CONFIRMED_NO_WRITE',
      entityType: 'Transaction',
      entityId: tx,
      requestId: record.RequestId,
      metadata: { journalId: record.JournalId }
    });
    this.requestLedger.fail(record.RequestId, 'RECOVERY_ABORTED_NO_TRANSACTION', this.clock());
    return { action: 'ABORTED_NO_TRANSACTION', transactionId: tx, journalId: record.JournalId };
  }
}
