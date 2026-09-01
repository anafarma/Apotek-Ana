import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../ui/index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../ui/app.js', import.meta.url), 'utf8');

function has(value){ return html.includes(value) || js.includes(value); }

test('UI exposes product, unit and quantity controls', () => {
  assert.ok(has('productSelect'));
  assert.ok(has('unitSelect'));
  assert.ok(has('qtyInput'));
  assert.ok(has('addBtn'));
});

test('UI explicitly supports independent strip and box prices', () => {
  assert.match(js, /Strip.*4000/);
  assert.match(js, /Box \(10 Strip\).*35000/);
  assert.match(js, /total:qty\*u\.price/);
  assert.doesNotMatch(js, /u\.conversion\s*\*\s*u\.price/);
});

test('UI validates quantity against base-unit stock', () => {
  assert.match(js, /qty\*u\.conversion>p\.stockBase/);
  assert.match(js, /Stok tidak cukup/);
});

test('UI payment gate rejects insufficient payment', () => {
  assert.match(js, /paid<total/);
  assert.match(js, /Pembayaran kurang/);
});

test('offline UI queues requests and persists them until sync acknowledgement', () => {
  assert.match(js, /state\.queue\.push\(request\)/);
  assert.match(js, /saveQueue\(\)/);
  assert.match(js, /stok belum dianggap terjual sampai sync berhasil/);
  assert.match(js, /API V2 belum dikonfigurasi; queue dipertahankan dan TIDAK dihapus/);
});

test('sync preserves every unacknowledged request after a partial failure', () => {
  assert.match(js, /state\.queue=pending\.slice\(i\)/);
  assert.match(js, /Request yang belum di-acknowledge dipertahankan/);
  assert.match(js, /state\.queue=\[\]/);
});

test('online UI does not claim persistence when no V2 API is configured', () => {
  assert.match(js, /VALIDASI UI berhasil/);
  assert.match(js, /TIDAK ditulis ke database/);
});

test('UI surfaces governed manual-master workflow', () => {
  assert.match(html, /Master Data/);
  assert.match(js, /harga independen/);
  assert.match(js, /conversion Box tetap 10 Strip/);
});

test('UI does not expose transactional ledger editing controls', () => {
  assert.doesNotMatch(html, /StockLedger.*input/i);
  assert.doesNotMatch(html, /AuditLog.*input/i);
  assert.doesNotMatch(html, /RequestLedger.*input/i);
});

class FakeElement {
  constructor(id){ this.id=id; this.value=''; this.textContent=''; this.innerHTML=''; this.className=''; this.listeners={}; }
  addEventListener(type, fn){ this.listeners[type]=fn; }
  click(){ return this.listeners.click?.(); }
  change(){ return this.listeners.change?.(); }
}

function runtimeHarness({apiUrl='', fetchImpl=async()=>({ok:true,json:async()=>({ok:true})}), storedQueue='[]'}={}){
  const ids=['productSelect','unitSelect','qtyInput','unitPrice','addBtn','validation','cartBody','cartTotal','paymentInput','checkoutBtn','result','masterName','masterLocation','stripPrice','boxPrice','validateMasterBtn','masterResult','toggleOfflineBtn','syncBtn','queueResult','offlineBadge','trustBadge'];
  const elements=Object.fromEntries(ids.map(id=>[id,new FakeElement(id)]));
  elements.qtyInput.value='1';
  elements.paymentInput.value='0';
  elements.stripPrice.value='4000';
  elements.boxPrice.value='35000';
  const storage=new Map([['ana-farma-v2-offline-queue',storedQueue]]);
  const document={getElementById:id=>elements[id]};
  const localStorage={getItem:key=>storage.get(key) ?? null,setItem:(key,value)=>storage.set(key,value)};
  const context={
    console, document, localStorage,
    structuredClone:globalThis.structuredClone,
    crypto:{randomUUID:()=> 'runtime-request-001'},
    Intl, Number, JSON, Date,
    fetch:fetchImpl,
    ANA_FARMA_V2_API:apiUrl
  };
  vm.runInNewContext(js, context, {filename:'ui/app.js'});
  return {elements,storage};
}

test('runtime UI selects Box and calculates the independent Box price', () => {
  const {elements}=runtimeHarness();
  assert.match(elements.unitSelect.innerHTML, /Box \(10 Strip\)/);
  elements.unitSelect.value='OB0015-BOX';
  elements.unitSelect.change();
  assert.match(elements.unitPrice.textContent, /35\.000/);
  elements.qtyInput.value='1';
  elements.addBtn.click();
  assert.match(elements.cartBody.innerHTML, /Box \(10 Strip\)/);
  assert.match(elements.cartTotal.textContent, /35\.000/);
});

test('runtime UI rejects Box quantity that exceeds base-unit stock', () => {
  const {elements}=runtimeHarness();
  elements.unitSelect.value='OB0015-BOX';
  elements.unitSelect.change();
  elements.qtyInput.value='5';
  elements.addBtn.click();
  assert.match(elements.validation.textContent, /Stok tidak cukup/);
  assert.equal(elements.cartBody.innerHTML, '');
});

test('runtime UI rejects insufficient payment before API call', async () => {
  let calls=0;
  const {elements}=runtimeHarness({apiUrl:'https://v2.invalid/api',fetchImpl:async()=>{calls++;throw new Error('must not call API');}});
  elements.unitSelect.value='OB0015-STRIP';
  elements.unitSelect.change();
  elements.addBtn.click();
  elements.paymentInput.value='3999';
  await elements.checkoutBtn.click();
  assert.match(elements.result.textContent, /Pembayaran kurang/);
  assert.equal(calls,0);
});

test('runtime UI queues offline sale and survives a reload', async () => {
  const first=runtimeHarness();
  first.elements.unitSelect.value='OB0015-BOX';
  first.elements.unitSelect.change();
  first.elements.addBtn.click();
  first.elements.paymentInput.value='35000';
  first.elements.toggleOfflineBtn.click();
  await first.elements.checkoutBtn.click();
  assert.match(first.elements.queueResult.textContent, /Queue: 1/);
  const persisted=first.storage.get('ana-farma-v2-offline-queue');
  assert.match(persisted, /runtime-request-001/);
  const second=runtimeHarness({storedQueue:persisted});
  assert.match(second.elements.queueResult.textContent, /Queue: 1/);
});

test('runtime UI keeps pending queue after API failure during sync', async () => {
  const initial=JSON.stringify([
    {requestId:'r1',lines:[],total:1000,paid:1000},
    {requestId:'r2',lines:[],total:2000,paid:2000}
  ]);
  let calls=0;
  const {elements,storage}=runtimeHarness({apiUrl:'https://v2.invalid/api',storedQueue:initial,fetchImpl:async()=>{
    calls++;
    if(calls===1) return {ok:true,json:async()=>({ok:true})};
    throw new Error('temporary failure');
  }});
  await elements.syncBtn.click();
  assert.match(elements.queueResult.textContent, /Queue: 1/);
  assert.match(storage.get('ana-farma-v2-offline-queue'), /r2/);
  assert.doesNotMatch(storage.get('ana-farma-v2-offline-queue'), /r1/);
});
