import { V2_SHEETS, V2_HEADERS } from './Schema.js';

export class SheetsRequestLedgerRepository {
  constructor(spreadsheet) { this.ss = spreadsheet; }
  _sheet() { const s = this.ss.getSheetByName(V2_SHEETS.REQUEST_LEDGER); if (!s) throw new Error('RequestLedger sheet is missing'); return s; }
  _row(requestId) {
    const s=this._sheet(), values=s.getDataRange().getValues(), headers=V2_HEADERS[V2_SHEETS.REQUEST_LEDGER], id=headers.indexOf('RequestId');
    for(let r=1;r<values.length;r++) if(String(values[r][id])===String(requestId)) return {sheet:s,row:r+1,values:values[r],headers};
    return null;
  }
  get(requestId) { const x=this._row(requestId); if(!x) return null; return Object.fromEntries(x.headers.map((h,i)=>[h,x.values[i]])); }
  claim({requestId,payloadHash,action,createdAt}) {
    if(!requestId||!payloadHash||!action) throw new Error('requestId, payloadHash and action are required');
    const existing=this._row(requestId);
    if(existing) {
      const record=Object.fromEntries(existing.headers.map((h,i)=>[h,existing.values[i]]));
      if(String(record.PayloadHash)!==String(payloadHash)) throw new Error('IDEMPOTENCY_CONFLICT');
      if(record.Status==='COMPLETED') return {status:'COMPLETED',record};
      if(record.Status==='IN_PROGRESS') return {status:'IN_PROGRESS',record};
      if(record.Status==='RECOVERY_REQUIRED') return {status:'RECOVERY_REQUIRED',record};
      if(record.Status==='FAILED') return {status:'FAILED',record};
    }
    this._sheet().appendRow([requestId,payloadHash,action,'IN_PROGRESS','', '', '',createdAt,'']);
    return {status:'CLAIMED',record:this.get(requestId)};
  }
  complete(requestId, transactionId, resultJson, completedAt) { this._set(requestId,{Status:'COMPLETED',TransactionId:transactionId,ResultJson:JSON.stringify(resultJson??{}),CompletedAt:completedAt,ErrorCode:''}); }
  fail(requestId,errorCode,completedAt) { this._set(requestId,{Status:'FAILED',ErrorCode:String(errorCode),CompletedAt:completedAt}); }
  markRecoveryRequired(requestId,errorCode,at) { this._set(requestId,{Status:'RECOVERY_REQUIRED',ErrorCode:String(errorCode),CompletedAt:at}); }
  _set(requestId, patch) {
    const x=this._row(requestId); if(!x) throw new Error(`Request not found: ${requestId}`);
    for(const [key,value] of Object.entries(patch)){const c=x.headers.indexOf(key); if(c>=0)x.sheet.getRange(x.row,c+1).setValue(value);}
  }
}
