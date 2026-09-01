import { V2_SHEETS, V2_HEADERS } from './Schema.js';

export class SheetsTransactionJournalRepository {
  constructor(spreadsheet) { this.ss = spreadsheet; }
  _sheet() {
    const s = this.ss.getSheetByName(V2_SHEETS.TRANSACTION_JOURNAL);
    if (!s) throw new Error('TransactionJournal sheet is missing');
    return s;
  }
  _record(values, rowIndex, headers) { return Object.fromEntries(headers.map((h,i)=>[h,values[rowIndex][i]])); }
  prepare(record) {
    this._sheet().appendRow([record.journalId, record.transactionId, record.requestId, 'PREPARED', record.preparedAt, '', record.payloadHash, JSON.stringify(record.recovery ?? {})]);
  }
  commit(journalId, committedAt, result = null) {
    const s = this._sheet(), values = s.getDataRange().getValues();
    const headers = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL];
    const idCol = headers.indexOf('JournalId');
    for (let r = 1; r < values.length; r++) if (String(values[r][idCol]) === String(journalId)) {
      const state = headers.indexOf('State') + 1;
      const committed = headers.indexOf('CommittedAt') + 1;
      const recoveryCol = headers.indexOf('RecoveryJson') + 1;
      const existing = this._json(values[r][recoveryCol - 1]);
      if (existing && existing.result == null && result != null) existing.result = result;
      s.getRange(r + 1, state).setValue('COMMITTED');
      s.getRange(r + 1, committed).setValue(committedAt);
      if (result != null) s.getRange(r + 1, recoveryCol).setValue(JSON.stringify(existing));
      return;
    }
    throw new Error(`Journal not found: ${journalId}`);
  }
  getCommittedByRequestId(requestId) {
    const s=this._sheet(), values=s.getDataRange().getValues(), headers=V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL];
    const requestCol=headers.indexOf('RequestId'), stateCol=headers.indexOf('State');
    for(let r=1;r<values.length;r++) if(String(values[r][requestCol])===String(requestId) && String(values[r][stateCol])==='COMMITTED') {
      const record=this._record(values,r,headers);
      const payload=this._json(record.RecoveryJson);
      return {...record,result:payload?.result ?? null};
    }
    return null;
  }
  markRecoveryRequired(journalId, recovery, error) {
    const s = this._sheet(), values = s.getDataRange().getValues();
    const headers = V2_HEADERS[V2_SHEETS.TRANSACTION_JOURNAL];
    const idCol = headers.indexOf('JournalId');
    for (let r = 1; r < values.length; r++) if (String(values[r][idCol]) === String(journalId)) {
      const state = headers.indexOf('State') + 1;
      const rec = headers.indexOf('RecoveryJson') + 1;
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
  _json(value) { try { return value ? JSON.parse(value) : {}; } catch (_) { throw new Error('CORRUPT_JOURNAL_RECOVERY'); } }
}
