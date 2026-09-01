import assert from 'node:assert/strict';
import { TransactionCoordinator } from '../src/application/TransactionCoordinator.js';

function fixture() {
  const calls = [], requests = new Map(), journals = new Map();
  const products = {
    getProduct: id => id === 'AMLO' ? { id: 'AMLO', active: true } : null,
    getUnit: (_p, id) => ({ id, name: id, active: true, conversion: id === 'BOX' ? 10 : 1 }),
    getPrice: (_p, unit) => ({ id: unit, active: true, amount: unit === 'BOX' ? 35000 : 4000 })
  };
  const stock = { getBalance: () => 20, appendMovement: x => calls.push(['stock', x]) };
  const requestLedger = {
    claim: x => { const old=requests.get(x.requestId); if(old){ if(old.PayloadHash!==x.payloadHash) throw new Error('CONFLICT'); return {status:old.Status,record:old}; } const r={PayloadHash:x.payloadHash,Status:'IN_PROGRESS',ResultJson:''}; requests.set(x.requestId,r); return {status:'CLAIMED',record:r}; },
    complete: (id,tx,result) => { const r=requests.get(id); r.Status='COMPLETED'; r.ResultJson=JSON.stringify(result); r.TransactionId=tx; },
    fail: (id,code) => { const r=requests.get(id); r.Status='FAILED'; r.ErrorCode=code; }
  };
  const journal = { prepare:r=>journals.set(r.journalId,{...r,state:'PREPARED'}), commit:id=>journals.get(id).state='COMMITTED', markRecoveryRequired:(id,r,e)=>journals.set(id,{...journals.get(id),state:'RECOVERY_REQUIRED',error:String(e.message)}) };
  const sales = { appendSale:x=>calls.push(['sale',x]), appendSaleItems:x=>calls.push(['items',x]), appendPayment:x=>calls.push(['payment',x]) };
  const audit = { append:x=>calls.push(['audit',x]) };
  let seq=0;
  const c = new TransactionCoordinator({ requestLedger,journal,products,stock,sales,audit,clock:()=>new Date('2026-01-01T00:00:00Z'),idFactory:p=>`${p}-${++seq}` });
  return {c,calls,requests,journals};
}

{
  const {c,calls}=fixture();
  const result=c.execute({requestId:'r1',payloadHash:'h1',actorId:'u1',items:[{productId:'AMLO',sellingUnit:'STRIP',quantity:1}],paid:4000});
  assert.equal(result.total,4000); assert.equal(result.items[0].quantityBase,1); assert.equal(calls.filter(x=>x[0]==='stock')[0][1].quantityBase,1);
}
{
  const {c}=fixture();
  const result=c.execute({requestId:'r2',payloadHash:'h2',actorId:'u1',items:[{productId:'AMLO',sellingUnit:'BOX',quantity:1}],paid:35000});
  assert.equal(result.total,35000); assert.equal(result.items[0].quantityBase,10); assert.equal(result.items[0].unitPrice,35000);
}
{
  const {c}=fixture();
  const result=c.execute({requestId:'r3',payloadHash:'h3',actorId:'u1',items:[{productId:'AMLO',sellingUnit:'BOX',quantity:2}],paid:70000});
  assert.equal(result.total,70000); assert.equal(result.items[0].quantityBase,20);
}
{
  const {c,calls}=fixture();
  const command={requestId:'r4',payloadHash:'h4',actorId:'u1',items:[{productId:'AMLO',sellingUnit:'BOX',quantity:1}],paid:35000};
  const a=c.execute(command), count=calls.length, b=c.execute(command);
  assert.deepEqual(b,a); assert.equal(calls.length,count);
}
{
  const {c}=fixture();
  assert.throws(()=>c.execute({requestId:'r5',payloadHash:'h5',actorId:'u1',items:[{productId:'AMLO',sellingUnit:'STRIP',quantity:1}],paid:1}),/INSUFFICIENT_PAYMENT/);
}
console.log('TransactionCoordinator tests: PASS');
