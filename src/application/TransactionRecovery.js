/**
 * Recovery coordinator. Recovery is reconciliation-first: never blindly replay
 * writes because a PREPARED journal may already have partially persisted data.
 */
export class TransactionRecovery {
  constructor({ journal, sales, stock, audit, requestLedger }) {
    Object.assign(this, { journal, sales, stock, audit, requestLedger });
  }

  inspect() { return this.journal.listRecoverable(); }

  reconcile(entry) {
    if (!entry?.TransactionId || !entry?.RequestId) throw new Error('INVALID_JOURNAL_ENTRY');
    const tx = this.sales.findByTransactionId(entry.TransactionId);
    const movements = this.stock.listByTransaction(entry.TransactionId);
    const expected = JSON.parse(entry.RecoveryJson || '{}');
    const expectedMovementIds = new Set(expected.stockMovementIds || []);
    const actualMovementIds = new Set(movements.map(x => String(x.movementId ?? x.MovementId)));
    const missingMovements = [...expectedMovementIds].filter(id => !actualMovementIds.has(String(id)));
    const report = { transactionId: entry.TransactionId, salePresent: !!tx, stockMovementCount: movements.length, missingMovements, recoverable: true };
    if (missingMovements.length === 0 && tx) {
      report.state = 'READY_TO_COMMIT';
    } else {
      report.state = 'MANUAL_RECONCILIATION_REQUIRED';
    }
    return report;
  }
}
