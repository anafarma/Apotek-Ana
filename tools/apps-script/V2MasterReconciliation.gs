/**
 * Ana Farma V2 - master data shadow/reconciliation.
 *
 * Purpose: make direct spreadsheet editing safe without making the app depend
 * on edit triggers alone. This catches deletions and script/API writes that
 * do not produce onEdit events, and validates cross-row invariants.
 */

const AF_RECON = {
  spreadsheetId: '1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo',
  shadowSheet: '_V2_MASTER_SHADOW',
  issueSheet: '_V2_DATA_QUALITY_ISSUE',
  surfaces: {
    Product: {key:'productId', required:['productCode','name'], numeric:['minimumStock']},
    ProductUnit: {key:'productUnitId', required:['productId','unitCode','unitName'], numeric:['conversionToBase']},
    ProductPrice: {key:'priceId', required:['productUnitId','priceType'], numeric:['price']},
    Location: {key:'locationId', required:['locationCode','name']},
    Supplier: {key:'supplierId', required:['supplierCode','name']},
    ProductLocation: {key:'productLocationId', required:['productId','locationId']}
  }
};

function initializeV2MasterShadow() {
  const ss = SpreadsheetApp.openById(AF_RECON.spreadsheetId);
  const sh = afReconEnsure_(ss, AF_RECON.shadowSheet,
    ['sheetName','rowKey','rowNumber','fingerprint','capturedAt','status']);
  const rows = [];
  Object.keys(AF_RECON.surfaces).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    const data = afReconRead_(sheet);
    data.rows.forEach((row, i) => {
      const key = String(row[data.index[data.key]] || '').trim();
      if (!key) return;
      rows.push([name,key,i+2,afReconFingerprint_(row),new Date(),'BASELINE']);
    });
  });
  if (sh.getLastRow() > 1) sh.getRange(2,1,sh.getLastRow()-1,6).clearContent();
  if (rows.length) sh.getRange(2,1,rows.length,6).setValues(rows);
  return {rows:rows.length};
}

function reconcileV2MasterData() {
  const ss = SpreadsheetApp.openById(AF_RECON.spreadsheetId);
  const issue = afReconEnsure_(ss, AF_RECON.issueSheet,
    ['issueId','occurredAt','severity','sheetName','rowNumber','ruleCode','entityKey','message','status','eventId','resolvedAt']);
  const shadow = afReconEnsure_(ss, AF_RECON.shadowSheet,
    ['sheetName','rowKey','rowNumber','fingerprint','capturedAt','status']);
  const shadowRows = shadow.getLastRow() > 1 ? shadow.getRange(2,1,shadow.getLastRow()-1,6).getValues() : [];
  const shadowMap = new Map();
  shadowRows.forEach(r => shadowMap.set(r[0]+'|'+r[1], {rowNumber:r[2],fingerprint:r[3],row:r}));
  const issues = [];
  const currentKeys = new Set();
  const changed = [];

  Object.keys(AF_RECON.surfaces).forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) return;
    const data = afReconRead_(sheet);
    const seen = new Set();
    data.rows.forEach((row, i) => {
      const rowNumber = i + 2;
      const key = String(row[data.index[data.key]] || '').trim();
      if (!key) {
        issues.push(afReconIssue_('HIGH',name,rowNumber,'PRIMARY_KEY_REQUIRED','', 'Canonical row has no '+data.key+'.'));
        return;
      }
      const mapKey = name+'|'+key;
      currentKeys.add(mapKey);
      if (seen.has(key)) issues.push(afReconIssue_('HIGH',name,rowNumber,'DUPLICATE_PRIMARY_KEY',key,'Duplicate '+data.key+' detected.'));
      seen.add(key);

      const rowIssues = afReconValidateRow_(name,data,row,rowNumber,ss);
      rowIssues.forEach(x => issues.push(x));

      const fp = afReconFingerprint_(row);
      const old = shadowMap.get(mapKey);
      if (!old || old.fingerprint !== fp) changed.push([name,key,rowNumber,fp,new Date(),rowIssues.length ? 'INVALID' : 'BASELINE']);
    });
  });

  shadowRows.forEach(r => {
    const mapKey = r[0]+'|'+r[1];
    if (!currentKeys.has(mapKey)) {
      issues.push(afReconIssue_('HIGH',r[0],r[2],'CANONICAL_ROW_MISSING',r[1],'Previously baselined canonical row is missing; deletion requires explicit lifecycle handling.'));
    }
  });

  if (issues.length) {
    const out = issues.map(x => [Utilities.getUuid(),new Date(),x.severity,x.sheetName,x.rowNumber,x.ruleCode,x.entityKey,x.message,'OPEN','', '']);
    issue.getRange(issue.getLastRow()+1,1,out.length,11).setValues(out);
  }

  // Accept only rows that are currently valid into the next shadow baseline.
  const invalidKeys = new Set(issues.map(x => x.sheetName+'|'+x.entityKey).filter(x => !x.endsWith('|')));
  changed.forEach(r => {
    if (!invalidKeys.has(r[0]+'|'+r[1])) {
      const existing = shadowMap.get(r[0]+'|'+r[1]);
      if (existing) {
        shadow.getRange(existing.rowNumber+1,1,1,6).setValues([r]);
      } else {
        shadow.appendRow(r);
      }
    }
  });

  return {issues:issues.length,changed:changed.length,shadowRows:shadow.getLastRow()-1};
}

function afReconValidateRow_(name,data,row,rowNumber,ss) {
  const out = [];
  const by = {};
  data.headers.forEach((h,i) => by[h] = row[i]);
  (AF_RECON.surfaces[name].required || []).forEach(h => {
    if (!String(by[h] == null ? '' : by[h]).trim()) out.push(afReconIssue_('HIGH',name,rowNumber,'REQUIRED_FIELD_MISSING','',h+' is required.'));
  });
  (AF_RECON.surfaces[name].numeric || []).forEach(h => {
    if (by[h] !== '' && by[h] != null && !Number.isFinite(Number(by[h]))) out.push(afReconIssue_('HIGH',name,rowNumber,'NUMERIC_FIELD_INVALID','',h+' must be numeric.'));
  });

  if (name === 'ProductUnit') {
    const f = Number(by.conversionToBase);
    if (!Number.isInteger(f) || f <= 0) out.push(afReconIssue_('HIGH',name,rowNumber,'CONVERSION_INVALID',String(by.productUnitId),'conversionToBase must be a positive integer.'));
    const product = afReconHasKey_(ss,'Product','productId',by.productId);
    if (!product) out.push(afReconIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.productId),'productId does not resolve to Product.'));
  }
  if (name === 'ProductPrice') {
    const p = Number(by.price);
    if (!Number.isFinite(p) || p < 0) out.push(afReconIssue_('HIGH',name,rowNumber,'PRICE_INVALID',String(by.priceId),'price must be finite and non-negative.'));
    if (!afReconHasKey_(ss,'ProductUnit','productUnitId',by.productUnitId)) out.push(afReconIssue_('HIGH',name,rowNumber,'PRODUCT_UNIT_FK_MISSING',String(by.productUnitId),'productUnitId does not resolve to ProductUnit.'));
  }
  if (name === 'Product') {
    const code = String(by.productCode || '').trim().toUpperCase();
    if (code) {
      const duplicates = afReconCountValue_(ss,'Product','productCode',code,true);
      if (duplicates > 1) out.push(afReconIssue_('HIGH',name,rowNumber,'DUPLICATE_PRODUCT_CODE',code,'productCode must be unique.'));
    }
  }
  if (name === 'ProductLocation') {
    if (!afReconHasKey_(ss,'Product','productId',by.productId)) out.push(afReconIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.productId),'productId does not resolve to Product.'));
    if (!afReconHasKey_(ss,'Location','locationId',by.locationId)) out.push(afReconIssue_('HIGH',name,rowNumber,'LOCATION_FK_MISSING',String(by.locationId),'locationId does not resolve to Location.'));
  }
  return out;
}

function afReconRead_(sh) {
  const values = sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
  const headers = values[0].map(String);
  const key = AF_RECON.surfaces[sh.getName()].key;
  const index = {}; headers.forEach((h,i)=>index[h]=i);
  return {headers:headers,index:index,key:key,rows:values.slice(1)};
}

function afReconHasKey_(ss,sheetName,key,value) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow()<2) return false;
  const data = afReconRead_(sh);
  const target = String(value == null ? '' : value).trim();
  return data.rows.some(r => String(r[data.index[key]] == null ? '' : r[data.index[key]]).trim() === target);
}

function afReconCountValue_(ss,sheetName,key,value,caseInsensitive) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow()<2) return 0;
  const data = afReconRead_(sh);
  const target = caseInsensitive ? String(value).trim().toUpperCase() : String(value).trim();
  return data.rows.filter(r => {
    const v = String(r[data.index[key]] == null ? '' : r[data.index[key]]).trim();
    return (caseInsensitive ? v.toUpperCase() : v) === target;
  }).length;
}

function afReconFingerprint_(row) {
  const normalized = row.map(v => v instanceof Date ? v.toISOString() : String(v == null ? '' : v));
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(normalized),Utilities.Charset.UTF_8);
  return bytes.map(b => (b<0?b+256:b).toString(16).padStart(2,'0')).join('');
}

function afReconIssue_(severity,sheetName,rowNumber,ruleCode,entityKey,message) {
  return {severity:severity,sheetName:sheetName,rowNumber:rowNumber,ruleCode:ruleCode,entityKey:entityKey || '',message:message};
}

function afReconEnsure_(ss,name,headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow()===0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}
