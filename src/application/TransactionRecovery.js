/** Reconciliation-first recovery. Never blindly replay a PREPARED transaction. */
export class TransactionRecovery {
  constructor({ journal, sales, stock, audit, requestLedger }) { Object.assign(this, { journal, sales, stock, audit, requestLedger }); }
  inspect() { return this.journal.listRecoverable(); }
  reconcile(entry) {
    if (!entry?.TransactionId || !entry?.RequestId) throw new Error('INVALID_JOURNAL_ENTRY');
    let expected; try { expected = JSON.parse(entry.RecoveryJson || '{}'); } catch (_) { throw new Error('CORRUPT_JOURNAL_RECOVERY'); }
    const tx = this.sales.findByTransactionId(entry.TransactionId);
    const movements = this.stock.listByTransaction(entry.TransactionId);
    const expectedIds = new Set((expected.stockMovementIds || []).map(String));
    const actualIds = new Set(movements.map(x => String(x.movementId ?? x.MovementId)));
    const missingMovements = [...expectedIds].filter(id => !actualIds.has(id));
    const duplicateMovementIds = movements.map(x => String(x.movementId ?? x.MovementId)).filter((id,i,a)=>a.indexOf(id)!==i);
    const items = typeof this.sales.findItemsByTransactionId === 'function' ? this.sales.findItemsByTransactionId(entry.TransactionId) : null;
    const payment = typeof this.sales.findPaymentByTransactionId === 'function' ? this.sales.findPaymentByTransactionId(entry.TransactionId) : null;
    const audit = typeof this.audit.findByTransactionId === 'function' ? this.audit.findByTransactionId(entry.TransactionId) : null;
    const checks = {
      salePresent: !!tx,
      saleItemsComplete: items === null ? false : items.length === Number(expected.saleItemCount ?? items.length),
      paymentPresent: payment === null ? false : !!payment,
      stockComplete: missingMovements.length === 0 && duplicateMovementIds.length === 0,
      auditPresent: audit === null ? false : !!audit
    };
    const complete = Object.values(checks).every(Boolean);
    return { transactionId: entry.TransactionId, requestId: entry.RequestId, checks, missingMovements, duplicateMovementIds, state: complete ? 'READY_TO_FINALIZE' : 'MANUAL_RECONCILIATION_REQUIRED' };
  }
}
