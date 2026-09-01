import test from 'node:test';
import assert from 'node:assert/strict';
import { RecoveryService } from '../../src/application/RecoveryService.js';

function fixture(state, movements=[]) {
  const calls=[];
  const service = new RecoveryService({
    journal:{listRecoverable:()=>[],commit:(id,at)=>calls.push(['journal.commit',id,at])},
    requestLedger:{complete:(id,tx,result,at)=>calls.push(['request.complete',id,tx,result,at]),fail:(id,code,at)=>calls.push(['request.fail',id,code,at])},
    sales:{getTransactionState:()=>state},
    stock:{listByTransaction:()=>movements},
    audit:{append:event=>calls.push(['audit.append',event])},
    clock:()=> '2026-09-01T02:00:00Z',
    lock:fn=>{ calls.push(['lock.acquire']); const result=fn(); calls.push(['lock.release']); return result; }
  });
  return {service,calls};
}

test('recovery finalizes a transaction only after the sale is already fully committed',()=>{
  const {service,calls}=fixture({exists:true,committed:true,result:{transactionId:'TX-1',status:'COMPLETED',total:35000}});
  const result=service.reconcile({JournalId:'JRN-1',TransactionId:'TX-1',RequestId:'REQ-1'});
  assert.equal(result.action,'MARK_COMMITTED');
  assert.deepEqual(calls.map(x=>x[0]),['lock.acquire','journal.commit','request.complete','lock.release']);
});

test('recovery refuses to auto-replay a partial transaction',()=>{
  const {service,calls}=fixture({exists:true,committed:false});
  assert.throws(()=>service.reconcile({JournalId:'JRN-2',TransactionId:'TX-2',RequestId:'REQ-2'}),/PARTIAL_TRANSACTION_REQUIRES_MANUAL_RECONCILIATION/);
  assert.deepEqual(calls.map(x=>x[0]),['lock.acquire']);
});

test('recovery aborts an empty transaction safely and records the decision',()=>{
  const {service,calls}=fixture({exists:false,committed:false});
  const result=service.reconcile({JournalId:'JRN-3',TransactionId:'TX-3',RequestId:'REQ-3'});
  assert.equal(result.action,'ABORTED_NO_TRANSACTION');
  assert.deepEqual(calls.map(x=>x[0]),['lock.acquire','audit.append','request.fail','lock.release']);
});

test('recovery refuses an empty transaction when stock movements already exist',()=>{
  const {service,calls}=fixture({exists:false,committed:false},[{movementId:'SM-1'}]);
  assert.throws(()=>service.reconcile({JournalId:'JRN-4',TransactionId:'TX-4',RequestId:'REQ-4'}),/STOCK_MOVEMENTS_EXIST_WITHOUT_SALE/);
  assert.deepEqual(calls.map(x=>x[0]),['lock.acquire']);
});
