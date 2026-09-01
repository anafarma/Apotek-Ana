import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

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

test('offline UI queues requests instead of pretending stock was committed', () => {
  assert.match(js, /state\.queue\.push\(request\)/);
  assert.match(js, /stok belum dianggap terjual sampai sync berhasil/);
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
