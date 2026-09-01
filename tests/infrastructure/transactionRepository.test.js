import test from 'node:test';
import assert from 'node:assert/strict';
import { V2_HEADERS, V2_SHEETS } from '../../src/infrastructure/sheets/Schema.js';
import { SheetsTransactionRepository } from '../../src/infrastructure/sheets/SheetsTransactionRepository.js';

class FakeSheet {
  constructor(name){ this.name=name; this.rows=[V2_HEADERS[name]]; this.failAppend=false; }
  getDataRange(){ return { getValues:()=>this.rows.map(r=>[...r]) }; }
  appendRow(row){ if(this.failAppend) throw new Error(`APPEND_FAIL:${this.name}`); this.rows.push([...row]); }
  getRange(row,col){ return { setValue:value=>{ this.rows[row-1][col-1]=value; } }; }
}
class FakeSpreadsheet {
  constructor(){ this.sheets=new Map(Object.values(V2_SHEETS).map(name=>[name,new FakeSheet(name)])); }
  getSheetByName(name){ return this.sheets.get(name) || null; }
}
class FakeRequestLedger {
  constructor(record,{failComplete=false}={}){ this.record=record; this.calls=[]; this.failComplete=failComplete; }
  get(){ return this.record; }
  complete(...args){ this.calls.push(['complete',...args]); if(this.failComplete) throw new Error('REQUEST_LEDGER_WRITE_FAIL'); this.record={...this.record,Status:'COMPLETED',ResultJson:JSON.stringify(args[2]),TransactionId:args[1]}; }
  fail(...args){ this.calls.push(['fail',...args]); this.record={...this.record,Status:'FAILED',ErrorCode:args[1],CompletedAt:args[2]}; }
  markRecoveryRequired(...args){ this.calls.push(['recovery',...args]); this.record={...this.record,Status:'RECOVERY_REQUIRED'}; }
}
class FakeJournal {
  constructor(committed=null){ this.calls=[]; this.committed=committed; }
  prepare(x){ this.calls.push(['prepare',x]); }
  commit(...args){ this.calls.push(['commit',...args]); this.committed={journalId:args[0],transactionId:'TX-1',requestId:'REQ-1',payloadHash:'HASH-1',result:args[2]}; }
  getCommittedByRequestId(requestId){ this.calls.push(['getCommitted',requestId]); return this.committed && this.committed.requestId===requestId ? this.committed : null; }
  markRecoveryRequired(...args){ this.calls.push(['recovery',...args]); }
}
function ids(){ let n=0; return {newId:p=>`${p}-${++n}`,newReceiptNumber:()=>`R-${++n}`}; }
function tx(){ return {transactionId:'TX-1',receiptNumber:'R-1',requestId:'REQ-1',requestFingerprint:'HASH-1',shiftId:'SHIFT-1',customerId:null,actorId:'USER-1',subtotal:35000,discount:0,tax:0,total:35000,payment:{method:'CASH',amount:35000},createdAt:'2026-09-01T02:00:00Z',items:[{productId:'P1',productName:'Amlodipine',unitId:'U1',unitName:'Box',qty:1,conversionFactor:10,qtyBase:10,unitPrice:35000,subtotal:35000,priceId:'PR1'}]}; }
function seedStock(ss,qty=42){ ss.getSheetByName(V2_SHEETS.STOCK_LEDGER).appendRow(['OPEN-1','OPENING','P1',qty,'IN','OPENING','2026-09-01T00:00:00Z','SYSTEM','Opening stock']); }
function lock(){ globalThis.LockService={getDocumentLock(){return{tryLock:()=>true,releaseLock:()=>{}};}}; }
function unlock(){ delete globalThis.LockService; }

test('successful sale commit writes journal, sale, item, payment, stock ledger, balance, audit and request completion',()=>{
  lock(); const ss=new FakeSpreadsheet(); seedStock(ss); const request=new FakeRequestLedger({Status:'IN_PROGRESS'}); const journal=new FakeJournal();
  const repo=new SheetsTransactionRepository({spreadsheet:ss,requestLedger:request,journal,ids:ids(),now:()=>new Date('2026-09-01T02:01:00Z')});
  const result=repo.commitSaleAtomic(tx());
  assert.equal(result.status,'COMPLETED');
  assert.equal(ss.getSheetByName(V2_SHEETS.SALES).rows.length,2);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALE_ITEMS).rows.length,2);
  assert.equal(ss.getSheetByName(V2_SHEETS.PAYMENTS).rows.length,2);
  assert.equal(ss.getSheetByName(V2_SHEETS.STOCK_LEDGER).rows.length,3);
  assert.equal(ss.getSheetByName(V2_SHEETS.STOCK_BALANCE).rows.length,2);
  assert.equal(ss.getSheetByName(V2_SHEETS.STOCK_BALANCE).rows[1][1],32);
  assert.equal(ss.getSheetByName(V2_SHEETS.AUDIT_LOG).rows.length,2);
  assert.equal(journal.calls.at(-1)[0],'commit');
  assert.equal(request.calls.at(-1)[0],'complete');
  unlock();
});

test('insufficient stock is a normal business rejection: no journal or sale mutation and request becomes FAILED',()=>{
  lock(); const ss=new FakeSpreadsheet(); seedStock(ss,5); const request=new FakeRequestLedger({Status:'IN_PROGRESS'}); const journal=new FakeJournal();
  const repo=new SheetsTransactionRepository({spreadsheet:ss,requestLedger:request,journal,ids:ids(),now:()=>new Date('2026-09-01T02:01:00Z')});
  assert.throws(()=>repo.commitSaleAtomic(tx()),/STOCK_INSUFFICIENT:P1/);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALES).rows.length,1);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALE_ITEMS).rows.length,1);
  assert.equal(ss.getSheetByName(V2_SHEETS.PAYMENTS).rows.length,1);
  assert.equal(ss.getSheetByName(V2_SHEETS.STOCK_LEDGER).rows.length,2);
  assert.equal(ss.getSheetByName(V2_SHEETS.AUDIT_LOG).rows.length,1);
  assert.equal(journal.calls.length,0);
  assert.equal(request.calls.at(-1)[0],'fail');
  assert.equal(request.record.Status,'FAILED');
  unlock();
});

test('failure after a sale write becomes recovery-required and is not hidden as a normal failure',()=>{
  lock(); const ss=new FakeSpreadsheet(); seedStock(ss); ss.getSheetByName(V2_SHEETS.SALE_ITEMS).failAppend=true; const request=new FakeRequestLedger({Status:'IN_PROGRESS'}); const journal=new FakeJournal();
  const repo=new SheetsTransactionRepository({spreadsheet:ss,requestLedger:request,journal,ids:ids(),now:()=>new Date('2026-09-01T02:01:00Z')});
  assert.throws(()=>repo.commitSaleAtomic(tx()),/TRANSACTION_RECOVERY_REQUIRED/);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALES).rows.length,2);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALE_ITEMS).rows.length,1);
  assert.equal(request.calls.at(-1)[0],'recovery');
  unlock();
});

test('completed request is returned without any second persistence mutation',()=>{
  lock(); const ss=new FakeSpreadsheet(); const result={transactionId:'TX-1',status:'COMPLETED',total:35000}; const request=new FakeRequestLedger({Status:'COMPLETED',ResultJson:JSON.stringify(result)}); const journal=new FakeJournal();
  const repo=new SheetsTransactionRepository({spreadsheet:ss,requestLedger:request,journal,ids:ids()});
  assert.deepEqual(repo.commitSaleAtomic(tx()),result);
  assert.equal(journal.calls.length,0);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALES).rows.length,1);
  unlock();
});

test('committed journal repairs an IN_PROGRESS request without duplicating sale rows',()=>{
  lock(); const ss=new FakeSpreadsheet(); const result={transactionId:'TX-1',status:'COMPLETED',total:35000}; const request=new FakeRequestLedger({Status:'IN_PROGRESS'}); const journal=new FakeJournal({journalId:'JRN-1',transactionId:'TX-1',requestId:'REQ-1',payloadHash:'HASH-1',result});
  const repo=new SheetsTransactionRepository({spreadsheet:ss,requestLedger:request,journal,ids:ids(),now:()=>new Date('2026-09-01T02:02:00Z')});
  assert.deepEqual(repo.commitSaleAtomic(tx()),result);
  assert.equal(request.record.Status,'COMPLETED');
  assert.equal(request.calls.at(-1)[0],'complete');
  assert.equal(journal.calls.filter(x=>x[0]==='prepare').length,0);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALES).rows.length,1);
  unlock();
});

test('request-ledger acknowledgement failure after journal commit is retryable and never marks committed journal as recovery',()=>{
  lock(); const ss=new FakeSpreadsheet(); seedStock(ss); const request=new FakeRequestLedger({Status:'IN_PROGRESS'},{failComplete:true}); const journal=new FakeJournal();
  const repo=new SheetsTransactionRepository({spreadsheet:ss,requestLedger:request,journal,ids:ids(),now:()=>new Date('2026-09-01T02:03:00Z')});
  assert.throws(()=>repo.commitSaleAtomic(tx()),/REQUEST_COMPLETION_PENDING/);
  assert.equal(journal.calls.at(-1)[0],'commit');
  assert.equal(journal.calls.some(x=>x[0]==='recovery'),false);
  assert.equal(ss.getSheetByName(V2_SHEETS.SALES).rows.length,2);
  unlock();
});
