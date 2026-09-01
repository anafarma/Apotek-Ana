import assert from 'node:assert/strict';
import { TransactionCoordinator } from '../../src/application/TransactionCoordinator.js';

const makeIds = () => { let n=0; return prefix => `${prefix}-${++n}`; };
function deps({balance=100, failAt=null}={}) {
  const state={balance, claims:[], journal:[], sales:[], items:[], payments:[], movements:[], audits:[]};
  const requestLedger={claim(x){state.claims.push(x);return {status:'CLAIMED',record:null};},complete(){},fail(){},markRecoveryRequired(){}};
  const journal={prepare(x){if(failAt==='prepare')throw Error('prepare');state.journal.push({...x,state:'PREPARED'});},commit(){if(failAt==='commit')throw Error('commit');state.journal[0].state='COMMITTED';},markRecoveryRequired(){state.journal[0].state='RECOVERY_REQUIRED';}};
  const products={getProduct:()=>({id:'P1',active:true}),getUnit:(_,u)=>({id:u,name:u,active:true,conversion:u==='BOX'?10:1}),getPrice:(_,unit)=>({active:true,amount:unit==='BOX'?35000:4000})};
  const stock={getBalance:()=>state.balance,appendMovement(m){if(failAt==='stock')throw Error('stock');state.movements.push(m);state.balance-=m.quantityBase;}};
  const sales={appendSale(s){if(failAt==='sale')throw Error('sale');state.sales.push(s);},appendSaleItems(x){state.items.push(...x);},appendPayment(p){state.payments.push(p);}};
  const audit={append(a){state.audits.push(a);}};
  const c=new TransactionCoordinator({requestLedger,journal,products,stock,sales,audit,clock:()=>new Date('2026-09-01T00:00:00Z'),idFactory:makeIds()});
  return {c,state};
}

{ const {c,state}=deps(); const r=c.execute({requestId:'r1',payloadHash:'h1',action:'SALE',actorId:'u1',items:[{productId:'P1',sellingUnit:'STRIP',quantity:1}],paid:4000}); assert.equal(r.total,4000); assert.equal(state.movements[0].quantityBase,1); assert.equal(state.items[0].unitPrice,4000); }
{ const {c,state}=deps(); const r=c.execute({requestId:'r2',payloadHash:'h2',action:'SALE',actorId:'u1',items:[{productId:'P1',sellingUnit:'BOX',quantity:1}],paid:35000}); assert.equal(r.total,35000); assert.equal(state.movements[0].quantityBase,10); assert.equal(state.items[0].unitPrice,35000); }
{ const {c,state}=deps({balance:9}); assert.throws(()=>c.execute({requestId:'r3',payloadHash:'h3',action:'SALE',actorId:'u1',items:[{productId:'P1',sellingUnit:'BOX',quantity:1}],paid:35000}),/INSUFFICIENT_STOCK/); assert.equal(state.journal.length,0); }
{ const {c,state}=deps({failAt:'stock'}); assert.throws(()=>c.execute({requestId:'r4',payloadHash:'h4',action:'SALE',actorId:'u1',items:[{productId:'P1',sellingUnit:'STRIP',quantity:1}],paid:4000}),/stock/); assert.equal(state.journal[0].state,'RECOVERY_REQUIRED'); }
{ const {c,state}=deps(); assert.throws(()=>c.execute({requestId:'r5',payloadHash:'h5',action:'SALE',actorId:'u1',items:[{productId:'P1',sellingUnit:'STRIP',quantity:0}],paid:4000}),/INVALID_QUANTITY/); assert.equal(state.journal.length,0); }
console.log('TransactionCoordinator adversarial tests: PASS');
