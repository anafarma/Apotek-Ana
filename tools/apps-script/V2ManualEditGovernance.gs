/**
 * Ana Farma V2 - governed manual spreadsheet edit path.
 *
 * This is intentionally separate from transaction code. It allows the owner to
 * use Google Sheets as an administrative bulk-edit surface while keeping
 * transactional records application-owned.
 *
 * INSTALL ONCE IN THE V2 SPREADSHEET:
 *   installV2ManualEditGovernance()
 *
 * The install function creates an installable onEdit trigger. It does not
 * modify legacy data and does not create a trigger in Production.
 */

const AF_MANUAL_EDIT = {
  logSheet: '_V2_MANUAL_EDIT_LOG',
  issueSheet: '_V2_DATA_QUALITY_ISSUE',
  shadowSheet: '_V2_MASTER_SHADOW',
  configSheet: '_V2_EDIT_POLICY',
  protectedSurfaces: [
    'StockLedger', 'StockBalance', 'Sale', 'SaleItem', 'Payment',
    'RequestLedger', 'TransactionJournal', 'AuditLog', 'Reconciliation'
  ],
  editableSurfaces: {
    Product: ['productCode','name','categoryId','active','minimumStock','defaultLocationId'],
    ProductUnit: ['productId','unitCode','unitName','conversionToBase','isBase','active'],
    ProductPrice: ['productUnitId','priceType','price','currency','effectiveFrom','effectiveTo','active'],
    Location: ['locationId','locationCode','name','active'],
    Supplier: ['supplierId','supplierCode','name','active']
  }
};

function installV2ManualEditGovernance() {
  const ss = SpreadsheetApp.getActive();
  if (!ss || ss.getId() !== AF_V2.spreadsheetId) {
    throw new Error('GOVERNANCE_TARGET_MISMATCH: run only from Ana Farma V2');
  }

  afGovEnsureSheet_(ss, AF_MANUAL_EDIT.logSheet, [
    'eventId','occurredAt','actor','sheetName','a1Range','rowStart','rowEnd',
    'columnStart','columnEnd','surfaceClass','validationStatus','issueCodes',
    'postEditFingerprint','note'
  ]);
  afGovEnsureSheet_(ss, AF_MANUAL_EDIT.issueSheet, [
    'issueId','occurredAt','severity','sheetName','rowNumber','ruleCode',
    'entityKey','message','status','eventId','resolvedAt'
  ]);
  afGovEnsureSheet_(ss, AF_MANUAL_EDIT.shadowSheet, [
    'sheetName','rowKey','rowNumber','fingerprint','capturedAt','status'
  ]);
  afGovEnsureSheet_(ss, AF_MANUAL_EDIT.configSheet, ['key','value','description']);

  const config = ss.getSheetByName(AF_MANUAL_EDIT.configSheet);
  if (config.getLastRow() === 1) {
    config.getRange(2,1,6,3).setValues([
      ['mode','GOVERNED_MANUAL_EDIT','Master-data edits are supported; transactional sheets remain application-owned.'],
      ['stockPolicy','LEDGER_ONLY','Never edit StockBalance directly to correct stock. Use a controlled adjustment workflow.'],
      ['deletePolicy','DEACTIVATE','Prefer active=false over deleting canonical master rows.'],
      ['pricePolicy','FUTURE_ONLY','Price edits affect future sales; committed SaleItem history never changes.'],
      ['unitPolicy','EXPLICIT_CONVERSION','Conversion must be a positive integer and is never inferred from price.'],
      ['securityPolicy','GOOGLE_PERMISSION_PLUS_ROLE','Sheet permission is the first boundary; application authorization remains mandatory.']
    ]);
  }

  // Avoid duplicate installable triggers when this function is run again.
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'v2ManualEditOnEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('v2ManualEditOnEdit').forSpreadsheet(ss).onEdit().create();

  return {installed:true, spreadsheetId:ss.getId(), trigger:'v2ManualEditOnEdit'};
}

function v2ManualEditOnEdit(e) {
  if (!e || !e.range) return;
  const ss = e.range.getSheet().getParent();
  if (ss.getId() !== AF_V2.spreadsheetId) return;

  const sh = e.range.getSheet();
  const name = sh.getName();
  const eventId = Utilities.getUuid();
  const actor = (e.user && e.user.getEmail()) || 'UNAVAILABLE';
  const surface = AF_MANUAL_EDIT.editableSurfaces[name]
    ? 'ALLOWED_MASTER'
    : (AF_MANUAL_EDIT.protectedSurfaces.indexOf(name) >= 0 ? 'PROTECTED_SYSTEM' : 'OTHER');

  const result = v2ValidateEditedRange_(sh, e.range, surface);
  const fp = v2FingerprintRange_(e.range);
  const log = afGovEnsureSheet_(ss, AF_MANUAL_EDIT.logSheet, [
    'eventId','occurredAt','actor','sheetName','a1Range','rowStart','rowEnd',
    'columnStart','columnEnd','surfaceClass','validationStatus','issueCodes',
    'postEditFingerprint','note'
  ]);
  log.appendRow([
    eventId, new Date(), actor, name, e.range.getA1Notation(),
    e.range.getRow(), e.range.getLastRow(), e.range.getColumn(), e.range.getLastColumn(),
    surface, result.status, result.issueCodes.join('|'), fp,
    surface === 'PROTECTED_SYSTEM' ? 'Manual edit detected on application-owned surface' : ''
  ]);

  if (result.issues.length) {
    const issueSheet = afGovEnsureSheet_(ss, AF_MANUAL_EDIT.issueSheet, [
      'issueId','occurredAt','severity','sheetName','rowNumber','ruleCode',
      'entityKey','message','status','eventId','resolvedAt'
    ]);
    const rows = result.issues.map(i => [
      Utilities.getUuid(), new Date(), i.severity, name, i.rowNumber, i.ruleCode,
      i.entityKey || '', i.message, 'OPEN', eventId, ''
    ]);
    issueSheet.getRange(issueSheet.getLastRow()+1,1,rows.length,11).setValues(rows);
  }
}

function v2ValidateEditedRange_(sh, range, surface) {
  const values = range.getValues();
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const allowed = AF_MANUAL_EDIT.editableSurfaces[sh.getName()] || [];
  const editedColumns = [];
  for (let c = range.getColumn(); c <= range.getLastColumn(); c++) editedColumns.push(headers[c-1]);
  const issues = [];

  if (surface === 'PROTECTED_SYSTEM') {
    issues.push({severity:'HIGH', ruleCode:'PROTECTED_SURFACE_EDIT', rowNumber:range.getRow(), message:'Manual edit is not an approved transactional mutation path.'});
  } else if (surface === 'ALLOWED_MASTER') {
    editedColumns.forEach(h => {
      if (h && allowed.indexOf(h) < 0) {
        issues.push({severity:'MEDIUM', ruleCode:'NON_EDITABLE_COLUMN', rowNumber:range.getRow(), message:'Column '+h+' is outside the approved manual-edit surface.'});
      }
    });

    for (let r = 0; r < values.length; r++) {
      const rowNumber = range.getRow() + r;
      const row = sh.getRange(rowNumber,1,1,sh.getLastColumn()).getValues()[0];
      const by = {};
      headers.forEach((h,i) => by[h] = row[i]);
      if (sh.getName() === 'Product') {
        if (!String(by.productCode || '').trim()) issues.push({severity:'HIGH',ruleCode:'PRODUCT_CODE_REQUIRED',rowNumber,message:'productCode is required.'});
        if (by.minimumStock !== '' && (!Number.isFinite(Number(by.minimumStock)) || Number(by.minimumStock) < 0)) issues.push({severity:'HIGH',ruleCode:'MINIMUM_STOCK_INVALID',rowNumber,message:'minimumStock must be a non-negative number.'});
      }
      if (sh.getName() === 'ProductUnit') {
        const factor = Number(by.conversionToBase);
        if (!Number.isInteger(factor) || factor <= 0) issues.push({severity:'HIGH',ruleCode:'CONVERSION_INVALID',rowNumber,message:'conversionToBase must be a positive integer.'});
      }
      if (sh.getName() === 'ProductPrice') {
        const price = Number(by.price);
        if (!Number.isFinite(price) || price < 0) issues.push({severity:'HIGH',ruleCode:'PRICE_INVALID',rowNumber,message:'price must be finite and non-negative.'});
      }
    }
  }
  return {status:issues.length ? 'INVALID' : 'VALID', issueCodes:[...new Set(issues.map(i=>i.ruleCode))], issues};
}

function v2FingerprintRange_(range) {
  const values = range.getValues();
  const normalized = values.map(row => row.map(v => {
    if (v instanceof Date) return v.toISOString();
    if (v === null || v === undefined) return '';
    return String(v);
  }));
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(normalized), Utilities.Charset.UTF_8);
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
}

function afGovEnsureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}
