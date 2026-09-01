/**
 * Ana Farma V2 - non-destructive Spreadsheet bootstrap.
 *
 * PURPOSE
 * - Establish canonical V2 tables beside the copied legacy workbook.
 * - Never rename/delete/clear legacy sheets.
 * - Capture a structural baseline and data-quality metrics.
 *
 * RUN
 *   bootstrapV2Database()
 *   auditLegacyWorkbook()
 *
 * The script is intentionally standalone so it can be attached to the V2 copy
 * without touching Production.
 */

const AF_V2 = {
  spreadsheetId: '1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo',
  metaSheet: '_V2_META',
  auditSheet: '_V2_DATA_AUDIT',
  schemaVersion: '2.0.0',
  tables: {
    Product: ['productId','productCode','name','categoryId','active','minimumStock','defaultLocationId','createdAt','updatedAt'],
    ProductUnit: ['productUnitId','productId','unitCode','unitName','conversionToBase','isBase','active','createdAt','updatedAt'],
    ProductPrice: ['priceId','productUnitId','priceType','price','currency','effectiveFrom','effectiveTo','active','createdAt','updatedAt'],
    StockBalance: ['productId','locationId','quantityBase','updatedAt','version'],
    StockLedger: ['movementId','transactionId','productId','locationId','direction','quantityBase','movementType','occurredAt','actorId','requestId','reason'],
    Sale: ['transactionId','requestId','actorId','shiftId','customerId','occurredAt','subtotal','discount','total','status','createdAt'],
    SaleItem: ['saleItemId','transactionId','productId','productUnitId','sellingUnit','sellingQty','conversionToBase','baseQty','sellingPrice','subtotal','createdAt'],
    Payment: ['paymentId','transactionId','method','amount','reference','paidAt','createdAt'],
    RequestLedger: ['requestId','payloadHash','action','status','transactionId','resultJson','errorCode','createdAt','updatedAt'],
    TransactionJournal: ['journalId','transactionId','requestId','state','payloadHash','preparedAt','committedAt','recoveryJson','updatedAt'],
    AuditLog: ['auditId','occurredAt','actorId','action','entityType','entityId','requestId','metadataJson'],
    MigrationMap: ['migrationId','sourceSheet','sourceKey','targetEntity','targetKey','status','reason','checkedAt'],
    MigrationQuarantine: ['quarantineId','sourceSheet','sourceKey','ruleCode','severity','rawJson','reason','createdAt','resolvedAt'],
    Reconciliation: ['reconciliationId','runId','entityType','entityId','sourceValue','targetValue','delta','status','detailsJson','checkedAt']
  }
};

function afV2Spreadsheet_() {
  return SpreadsheetApp.openById(AF_V2.spreadsheetId);
}

function bootstrapV2Database() {
  const ss = afV2Spreadsheet_();
  const created = [];
  Object.keys(AF_V2.tables).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      created.push(name);
    }
    const headers = AF_V2.tables[name];
    if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    else {
      const existing = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0];
      headers.forEach((h, i) => {
        if (!existing[i]) sh.getRange(1, i + 1).setValue(h);
      });
    }
    sh.setFrozenRows(1);
  });
  const meta = afEnsureSheet_('_V2_META', ['key','value','recordedAt']);
  const rows = [
    ['schemaVersion', AF_V2.schemaVersion, new Date()],
    ['baselineSpreadsheetId', ss.getId(), new Date()],
    ['baselineSpreadsheetName', ss.getName(), new Date()],
    ['bootstrapMode', 'NON_DESTRUCTIVE', new Date()],
    ['legacySheetsPreserved', 'TRUE', new Date()]
  ];
  if (meta.getLastRow() > 1) meta.getRange(2, 1, meta.getLastRow() - 1, 3).clearContent();
  meta.getRange(2, 1, rows.length, 3).setValues(rows);
  return { schemaVersion: AF_V2.schemaVersion, createdTables: created, spreadsheetId: ss.getId() };
}

function auditLegacyWorkbook() {
  const ss = afV2Spreadsheet_();
  const audit = afEnsureSheet_('_V2_DATA_AUDIT', ['sheetName','rows','columns','headersJson','blankRows','duplicateFirstColumn','formulaCells','checkedAt']);
  const output = [];
  ss.getSheets().forEach(sh => {
    const name = sh.getName();
    if (name.indexOf('_V2_') === 0 || AF_V2.tables[name]) return;
    const rows = sh.getLastRow();
    const cols = sh.getLastColumn();
    const values = rows && cols ? sh.getRange(1, 1, rows, cols).getValues() : [];
    const headers = values.length ? values[0] : [];
    let blankRows = 0;
    let formulaCells = 0;
    const keys = [];
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      if (row.every(v => v === '' || v === null)) blankRows++;
      if (row[0] !== '' && row[0] !== null) keys.push(String(row[0]));
    }
    const seen = new Set(), dup = new Set();
    keys.forEach(k => seen.has(k) ? dup.add(k) : seen.add(k));
    if (rows && cols) {
      const formulas = sh.getRange(1, 1, rows, cols).getFormulas();
      formulas.forEach(row => row.forEach(f => { if (f) formulaCells++; }));
    }
    output.push([name, rows, cols, JSON.stringify(headers), blankRows, dup.size, formulaCells, new Date()]);
  });
  if (audit.getLastRow() > 1) audit.getRange(2, 1, audit.getLastRow() - 1, 8).clearContent();
  if (output.length) audit.getRange(2, 1, output.length, 8).setValues(output);
  return { sheetsAudited: output.length, auditSheet: '_V2_DATA_AUDIT' };
}

function afEnsureSheet_(name, headers) {
  const ss = afV2Spreadsheet_();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}
