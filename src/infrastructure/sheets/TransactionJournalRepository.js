import { V2_SHEETS, V2_HEADERS } from './Schema.js';

export class SheetsTransactionJournalRepository {
  constructor(spreadsheet) { this.ss = spreadsheet; }
  _sheet() {
    const s = this.ss.getSheetByName(V2_SHEETS.TRANSACTION_JOURNAL);
    if (!s) throw new Error('TransactionJournal sheet is missing');
    return s;
  }
  prepare(record) {
    this._sheet().appendRow([record.journalId, record.transactionId, record.requestId, 'PREPARED', record.preparedAt, '', record.payloadHash, JSON.stringify(record.recovery ?? {})]);
  }
  commit(journalId, committedAt) {
    const s = this._sheet(), values = s.getDataRange().getValues();
    const col = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL].indexOf('JournalId');
    for (let r = 1; r < values.length; r++) if (String(values[r][col]) === String(journalId)) {
      const state = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL].indexOf('State') + 1;
      const committed = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL].indexOf('CommittedAt') + 1;
      s.getRange(r + 1, state).setValue('COMMITTED');
      s.getRange(r + 1, committed).setValue(committedAt);
      return;
    }
    throw new Error(`Journal not found: ${journalId}`);
  }
  markRecoveryRequired(journalId, recovery, error) {
    const s = this._sheet(), values = s.getDataRange().getValues();
    const idCol = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL].indexOf('JournalId');
    for (let r = 1; r < values.length; r++) if (String(values[r][idCol]) === String(journalId)) {
      const state = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL].indexOf('State') + 1;
      const rec = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL].indexOf('RecoveryJson') + 1;
      s.getRange(r + 1, state).setValue('RECOVERY_REQUIRED');
      s.getRange(r + 1, rec).setValue(JSON.stringify({ recovery, error: String(error?.message ?? error ?? '') }));
      return;
    }
    throw new Error(`Journal not found: ${journalId}`);
  }
  listRecoverable() {
    const s = this._sheet(), values = s.getDataRange().getValues();
    const headers = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL];
    const state = headers.indexOf('State');
    return values.slice(1).filter(r => ['PREPARED','RECOVERY_REQUIRED'].includes(String(r[state]))).map(r => Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
  }
}
