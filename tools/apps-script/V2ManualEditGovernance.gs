/**
 * Ana Farma V2 - governed manual spreadsheet edit path.
 *
 * Google Sheets remains an approved administrative interface for canonical
 * master data. Transactional history and stock mutations remain application
 * owned. Direct edits are observed, validated and reconciled; they are never
 * silently converted into transaction mutations.
 *
 * Canonical surface names mirror src/infrastructure/sheets/Schema.js.
 */

const AF_MANUAL_EDIT = {
  logSheet: '_V2_MANUAL_EDIT_LOG',
  issueSheet: '_V2_DATA_QUALITY_ISSUE',
  shadowSheet: '_V2_MASTER_SHADOW',
  configSheet: '_V2_EDIT_POLICY',
  protectedSurfaces: [
    'StockLedger', 'StockBalance', 'Sales', 'SaleItems', 'Payments',
    'RequestLedger', 'TransactionJournal', 'AuditLog', 'MigrationRun', 'MigrationQuarantine'
  ],
  editableSurfaces: {
    Products: ['Sku','Name','CategoryId','InventoryTrackingMode','Active'],
    ProductUnits: ['ProductId','Name','Symbol','IsBaseUnit','CanSell','CanPurchase','Active'],
    UnitConversions: ['ProductId','FromUnitId','ToUnitId','Factor','Active'],
    ProductPrices: ['ProductId','UnitId','Price','Currency','EffectiveFrom','EffectiveTo','Active'],
    Location: ['LocationCode','Name','Active'],
    Supplier: ['SupplierCode','Name','Active'],
    ProductLocation: ['ProductId','LocationId','IsDefault','Active']
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
    config.getRange(2,1,7,3).setValues([
      ['mode','GOVERNED_MANUAL_EDIT','Master-data edits are supported; transactional sheets remain application-owned.'],
      ['stockPolicy','LEDGER_ONLY','Never edit StockBalance directly to correct stock. Use a controlled adjustment workflow.'],
      ['deletePolicy','DEACTIVATE','Prefer Active=false over deleting canonical master rows.'],
      ['pricePolicy','FUTURE_ONLY','Price edits affect future sales; committed SaleItem history never changes.'],
      ['unitPolicy','EXPLICIT_CONVERSION','Conversion is maintained in UnitConversions and is never inferred from price.'],
      ['locationPolicy','MASTER_OR_TRANSFER','Changing ProductLocation is a master-data move; physical stock movement requires a stock transfer workflow.'],
      ['securityPolicy','GOOGLE_PERMISSION_PLUS_ROLE','Sheet permission is the first boundary; application authorization remains mandatory.']
    ]);
  }

  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'v2ManualEditOnEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('v2ManualEditOnEdit').forSpreadsheet(ss).onEdit().create();

  return {installed:true, spreadsheetId:ss.getId(), trigger:'v2ManualEditOnEdit', canonical:true};
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
    surface === 'PROTECTED_SYSTEM' ? 'Manual edit detected on application-owned surface; reconcile/recovery required.' : ''
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
      if (sh.getName() === 'Products') {
        if (!String(by.Sku || '').trim()) issues.push({severity:'HIGH',ruleCode:'SKU_REQUIRED',rowNumber,message:'Sku is required.'});
        if (!String(by.Name || '').trim()) issues.push({severity:'HIGH',ruleCode:'PRODUCT_NAME_REQUIRED',rowNumber,message:'Name is required.'});
      }
      if (sh.getName() === 'ProductUnits') {
        if (!String(by.ProductId || '').trim()) issues.push({severity:'HIGH',ruleCode:'PRODUCT_REQUIRED',rowNumber,message:'ProductId is required.'});
        if (!String(by.Name || '').trim()) issues.push({severity:'HIGH',ruleCode:'UNIT_NAME_REQUIRED',rowNumber,message:'Name is required.'});
      }
      if (sh.getName() === 'UnitConversions') {
        const factor = Number(by.Factor);
        if (!Number.isInteger(factor) || factor <= 0) issues.push({severity:'HIGH',ruleCode:'CONVERSION_INVALID',rowNumber,message:'Factor must be a positive integer.'});
        if (!String(by.ProductId || '').trim() || !String(by.FromUnitId || '').trim() || !String(by.ToUnitId || '').trim()) issues.push({severity:'HIGH',ruleCode:'CONVERSION_REFERENCE_REQUIRED',rowNumber,message:'ProductId, FromUnitId and ToUnitId are required.'});
      }
      if (sh.getName() === 'ProductPrices') {
        const price = Number(by.Price);
        if (!Number.isFinite(price) || price < 0) issues.push({severity:'HIGH',ruleCode:'PRICE_INVALID',rowNumber,message:'Price must be finite and non-negative.'});
        if (!String(by.ProductId || '').trim() || !String(by.UnitId || '').trim()) issues.push({severity:'HIGH',ruleCode:'PRICE_REFERENCE_REQUIRED',rowNumber,message:'ProductId and UnitId are required.'});
      }
      if (sh.getName() === 'ProductLocation') {
        if (!String(by.ProductId || '').trim()) issues.push({severity:'HIGH',ruleCode:'PRODUCT_REQUIRED',rowNumber,message:'ProductId is required.'});
        if (!String(by.LocationId || '').trim()) issues.push({severity:'HIGH',ruleCode:'LOCATION_REQUIRED',rowNumber,message:'LocationId is required.'});
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
