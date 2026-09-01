import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const governance = read('tools/apps-script/V2ManualEditGovernance.gs');
const maintenance = read('tools/apps-script/V2GovernanceMaintenance.gs');
const orchestrator = read('tools/apps-script/V2SetupOrchestrator.gs');
const bootstrap = read('tools/apps-script/V2Bootstrap.gs');
const docs = read('docs/40-spreadsheet-manual-edit-governance.md');

test('master sheets are the approved manual-edit boundary', () => {
  for (const name of ['Product','ProductUnit','ProductPrice','Location','Supplier','ProductLocation']) assert.match(governance, new RegExp(name));
  for (const name of ['StockLedger','StockBalance','Sale','SaleItem','Payment','RequestLedger','TransactionJournal','AuditLog','Reconciliation']) assert.match(governance, new RegExp(name));
});

test('stock and location rules remain distinct', () => {
  assert.match(governance, /stockPolicy.*LEDGER_ONLY/);
  assert.match(governance, /locationPolicy.*MASTER_OR_TRANSFER/);
  assert.match(docs, /changing StockBalance alone is never considered a valid stock adjustment/i);
  assert.match(docs, /changing product-to-location assignment/i);
  assert.match(docs, /physical stock movement requires a stock transfer workflow/i);
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

test('one-click setup is hard-bound to V2 and installs all governance layers', () => {
  assert.match(orchestrator, /AF_V2\.spreadsheetId/);
  assert.match(orchestrator, /productionTouched: false/);
  assert.match(orchestrator, /ensureV2MasterSurfaces\(\)/);
  assert.match(orchestrator, /installV2ManualEditGovernance\(\)/);
  assert.match(orchestrator, /initializeV2MasterShadowSafe\(\)/);
  assert.match(orchestrator, /installV2GovernanceMaintenance\(\)/);
});

test('manual edit path is observable, redacted, and non-destructive', () => {
  assert.match(governance, /v2ManualEditOnEdit/);
  assert.match(governance, /postEditFingerprint/);
  assert.match(governance, /PROTECTED_SURFACE_EDIT/);
  assert.match(docs, /Passwords, tokens, secrets, cookies, authorization headers and credentials must never be written/i);
  assert.match(docs, /does not overwrite an owner edit merely to restore an old snapshot/i);
});

test('master edits cannot silently become transactional mutations', () => {
  assert.match(governance, /editableSurfaces/);
  assert.match(governance, /protectedSurfaces/);
  assert.match(docs, /Direct spreadsheet editing is therefore \*\*not an exception path\*\*/i);
  assert.match(docs, /transactional history and stock mutations remain application owned/i);
});

test('production remains outside the governance target', () => {
  assert.match(docs, /Production/i);
  assert.match(bootstrap, /non-destructive/i);
});
