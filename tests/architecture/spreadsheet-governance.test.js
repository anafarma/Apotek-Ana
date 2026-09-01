import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const governance = read('tools/apps-script/V2ManualEditGovernance.gs');
const maintenance = read('tools/apps-script/V2GovernanceMaintenance.gs');
const bootstrap = read('tools/apps-script/V2Bootstrap.gs');
const docs = read('docs/40-spreadsheet-manual-edit-governance.md');

test('master sheets are the approved manual-edit boundary', () => {
  for (const name of ['Product','ProductUnit','ProductPrice','Location','Supplier','ProductLocation']) {
    assert.match(governance, new RegExp(name));
  }
  for (const name of ['StockLedger','StockBalance','Sale','SaleItem','Payment','RequestLedger','TransactionJournal','AuditLog','Reconciliation']) {
    assert.match(governance, new RegExp(name));
  }
});

test('stock and location rules remain distinct', () => {
  assert.match(governance, /stockPolicy.*LEDGER_ONLY/);
  assert.match(governance, /locationPolicy.*MASTER_OR_TRANSFER/);
  assert.match(docs, /StockBalance alone is never considered a valid stock adjustment/i);
  assert.match(docs, /ProductLocation A -> B/);
  assert.match(docs, /stock transfer A -> B/i);
});

test('price never defines unit conversion', () => {
  assert.match(governance, /EXPLICIT_CONVERSION/);
  assert.match(docs, /Never infer a BOX conversion from the price ratio/i);
  assert.match(bootstrap, /conversionToBase/);
});

test('governance has an explicit trust state and scheduled reconciliation', () => {
  assert.match(maintenance, /_V2_GOVERNANCE_STATE/);
  assert.match(maintenance, /masterDataTrust/);
  assert.match(maintenance, /DEGRADED/);
  assert.match(maintenance, /everyMinutes\(AF_GOV_MAINT\.intervalMinutes\)/);
});

test('production remains outside the governance target', () => {
  assert.match(docs, /Production/i);
  assert.match(bootstrap, /non-destructive/i);
});
