import { V2_SHEETS, V2_HEADERS } from './Schema.js';
import { withDocumentLock } from './withLock.js';

/** Google Sheets adapter for the authoritative idempotency ledger. */
export class SheetsRequestLedgerRepository {
  constructor(spreadsheet) { this.ss = spreadsheet; }
  _sheet() {
    const s = this.ss.getSheetByName(V2_SHEETS.REQUEST_LEDGER);
    if (!s) throw new Error('REQUEST_LEDGER_SHEET_MISSING');
    return s;
  }
  _row(requestId) {
    const s = this._sheet();
    const values = s.getDataRange().getValues();
    const headers = V2_HEADERS[V2_SHEETS.REQUEST_LEDGER];
    const id = headers.indexOf('RequestId');
    for (let r = 1; r < values.length; r++) {
      if (String(values[r][id]) === String(requestId)) return { sheet: s, row: r + 1, values: values[r], headers };
    }
    return null;
  }
  _record(x) { return Object.fromEntries(x.headers.map((h, i) => [h, x.values[i]])); }
  get(requestId) { const x = this._row(requestId); return x ? this._record(x) : null; }

  /**
   * Claim is a compare-and-insert operation. The read and append MUST happen
   * under the same document lock; otherwise two concurrent Apps Script
   * executions can both observe an absent RequestId and create duplicates.
   */
  claim({ requestId, fingerprint, payloadHash, action, createdAt }) {
    const hash = fingerprint ?? payloadHash;
    if (!requestId || !hash || !action) throw new Error('INVALID_IDEMPOTENCY_CLAIM');

    return withDocumentLock(() => {
      const existing = this._row(requestId);
      if (existing) {
        const record = this._record(existing);
        if (String(record.PayloadHash) !== String(hash)) throw new Error('IDEMPOTENCY_CONFLICT');
        if (record.Status === 'COMPLETED') return { status: 'COMPLETED', fingerprint: record.PayloadHash, result: this._json(record.ResultJson), record };
        if (record.Status === 'IN_PROGRESS') return { status: 'IN_PROGRESS', fingerprint: record.PayloadHash, record };
        if (record.Status === 'RECOVERY_REQUIRED') return { status: 'RECOVERY_REQUIRED', fingerprint: record.PayloadHash, record };
        if (record.Status === 'FAILED') return { status: 'FAILED', fingerprint: record.PayloadHash, record };
        throw new Error(`INVALID_REQUEST_STATUS:${record.Status}`);
      }

      const headers = V2_HEADERS[V2_SHEETS.REQUEST_LEDGER];
      const row = headers.map(h => ({
        RequestId: requestId, PayloadHash: hash, Action: action, Status: 'IN_PROGRESS', TransactionId: '', ResultJson: '',
        ErrorCode: '', CreatedAt: createdAt, CompletedAt: ''
      }[h] ?? ''));
      this._sheet().appendRow(row);
      return { status: 'CLAIMED', fingerprint: hash, record: this.get(requestId) };
    });
  }

  complete(requestId, transactionId, result, completedAt) {
    this._set(requestId, { Status: 'COMPLETED', TransactionId: transactionId, ResultJson: JSON.stringify(result ?? {}), ErrorCode: '', CompletedAt: completedAt });
  }
  fail(requestId, errorCode, at) { this._set(requestId, { Status: 'FAILED', ErrorCode: String(errorCode), CompletedAt: at }); }
  markRecoveryRequired(requestId, errorCode, at) { this._set(requestId, { Status: 'RECOVERY_REQUIRED', ErrorCode: String(errorCode), CompletedAt: at }); }

  _set(requestId, patch) {
    const x = this._row(requestId);
    if (!x) throw new Error(`REQUEST_NOT_FOUND:${requestId}`);
    for (const [key, value] of Object.entries(patch)) {
      const c = x.headers.indexOf(key);
      if (c >= 0) x.sheet.getRange(x.row, c + 1).setValue(value);
    }
  }
  _json(value) { try { return value ? JSON.parse(value) : null; } catch (_) { throw new Error('CORRUPT_REQUEST_RESULT'); } }
}
