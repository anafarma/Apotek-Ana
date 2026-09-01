import test from 'node:test';
import assert from 'node:assert/strict';
import { V2_HEADERS, V2_SHEETS } from '../../src/infrastructure/sheets/Schema.js';

class FakeSheet {
  constructor(){ this.rows=[V2_HEADERS[V2_SHEETS.REQUEST_LEDGER]]; }
  getDataRange(){ return { getValues:()=>this.rows.map(r=>[...r]) }; }
  appendRow(row){ this.rows.push([...row]); }
  getRange(row,col){ return { setValue:value=>{ this.rows[row-1][col-1]=value; } }; }
}
class FakeSpreadsheet {
  constructor(sheet){ this.sheet=sheet; }
  getSheetByName(name){ return name===V2_SHEETS.REQUEST_LEDGER ? this.sheet : null; }
}
function installLock({acquire=true}={}){
  const state={acquired:0,released:0};
  globalThis.LockService={getDocumentLock(){return {tryLock(){state.acquired++;return acquire;},releaseLock(){state.released++;}};}};
  return state;
}

test('RequestLedger claim reads and appends under one document lock', async()=>{
  const lock=installLock();
  const {SheetsRequestLedgerRepository}=await import('../../src/infrastructure/sheets/RequestLedgerRepository.js?lock-test-1');
  const sheet=new FakeSheet(); const repo=new SheetsRequestLedgerRepository(new FakeSpreadsheet(sheet));
  const result=repo.claim({requestId:'REQ-1',fingerprint:'HASH-1',action:'CREATE_SALE',createdAt:'2026-09-01T00:00:00Z'});
  assert.equal(result.status,'CLAIMED'); assert.equal(lock.acquired,1); assert.equal(lock.released,1); assert.equal(sheet.rows.length,2);
  const headers=sheet.rows[0]; const row=sheet.rows[1];
  assert.equal(row[headers.indexOf('RequestId')],'REQ-1'); assert.equal(row[headers.indexOf('PayloadHash')],'HASH-1'); assert.equal(row[headers.indexOf('Status')],'IN_PROGRESS');
  delete globalThis.LockService;
});

test('same RequestId with a different payload is rejected without append', async()=>{
  installLock();
  const {SheetsRequestLedgerRepository}=await import('../../src/infrastructure/sheets/RequestLedgerRepository.js?lock-test-2');
  const sheet=new FakeSheet(); const repo=new SheetsRequestLedgerRepository(new FakeSpreadsheet(sheet));
  repo.claim({requestId:'REQ-2',fingerprint:'HASH-A',action:'CREATE_SALE',createdAt:'2026-09-01T00:00:00Z'});
  assert.throws(()=>repo.claim({requestId:'REQ-2',fingerprint:'HASH-B',action:'CREATE_SALE',createdAt:'2026-09-01T00:01:00Z'}),/IDEMPOTENCY_CONFLICT/);
  assert.equal(sheet.rows.length,2);
  delete globalThis.LockService;
});

test('lock acquisition failure prevents the claim from mutating the sheet', async()=>{
  installLock({acquire:false});
  const {SheetsRequestLedgerRepository}=await import('../../src/infrastructure/sheets/RequestLedgerRepository.js?lock-test-3');
  const sheet=new FakeSheet(); const repo=new SheetsRequestLedgerRepository(new FakeSpreadsheet(sheet));
  assert.throws(()=>repo.claim({requestId:'REQ-3',fingerprint:'HASH-3',action:'CREATE_SALE',createdAt:'2026-09-01T00:00:00Z'}),/Could not acquire document transaction lock/);
  assert.equal(sheet.rows.length,1);
  delete globalThis.LockService;
});
