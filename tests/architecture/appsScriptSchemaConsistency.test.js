import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync(new URL('../../tools/apps-script/V2Bootstrap.gs', import.meta.url), 'utf8');
const governance = fs.readFileSync(new URL('../../tools/apps-script/V2ManualEditGovernance.gs', import.meta.url), 'utf8');
const reconciliation = fs.readFileSync(new URL('../../tools/apps-script/V2MasterReconciliation.gs', import.meta.url), 'utf8');
const schema = fs.readFileSync(new URL('../../src/infrastructure/sheets/Schema.js', import.meta.url), 'utf8');

const canonicalSheets = ['Products','ProductUnits','UnitConversions','ProductPrices','StockBalance','StockLedger','Sales','SaleItems','Payments','RequestLedger','AuditLog','TransactionJournal','SchemaVersion','MigrationRun','MigrationQuarantine'];
const canonicalMasterSurfaces = ['Location','Supplier','ProductLocation'];
const deprecatedSingular = ['Product','ProductUnit','ProductPrice','Sale','SaleItem','Payment'];

test('Apps Script bootstrap declares the same canonical V2 sheet names as Schema.js', () => {
  for (const name of canonicalSheets) {
    assert.match(schema, new RegExp(`\\b${name}\\b`));
    assert.match(bootstrap, new RegExp(`\\b${name}\\b`));
  }
});

test('Apps Script master governance uses canonical editable surfaces', () => {
  for (const name of canonicalMasterSurfaces) assert.match(governance, new RegExp(`\\b${name}\\b`));
  for (const name of ['Products','ProductUnits','UnitConversions','ProductPrices']) assert.match(governance, new RegExp(`\\b${name}\\b`));
});

test('Apps Script reconciliation uses canonical master surfaces and foreign keys', () => {
  for (const name of ['Products','ProductUnits','UnitConversions','ProductPrices','Location','ProductLocation']) assert.match(reconciliation, new RegExp(`\\b${name}\\b`));
  assert.match(reconciliation, /PRODUCT_FK_MISSING/);
  assert.match(reconciliation, /UNIT_FK_MISSING/);
  assert.match(reconciliation, /LOCATION_FK_MISSING/);
});

test('deprecated singular V2 table names are not used as active governance surfaces', () => {
  for (const name of deprecatedSingular) {
    assert.doesNotMatch(governance, new RegExp(`['\"]${name}['\"]\\s*:`));
    assert.doesNotMatch(reconciliation, new RegExp(`['\"]${name}['\"]\\s*:`));
  }
});
