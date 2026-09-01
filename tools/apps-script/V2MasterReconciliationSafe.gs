/**
 * Safe entrypoints for V2 master reconciliation.
 * This file supersedes the initial reconciliation draft without deleting it,
 * preserving Git history while giving the V2 spreadsheet a hardened path.
 */

function initializeV2MasterShadowSafe() {
  const ss = SpreadsheetApp.openById('1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo');
  const shadow = v2SafeSheet_(ss,'_V2_MASTER_SHADOW',['sheetName','rowKey','rowNumber','fingerprint','capturedAt','status']);
  const surfaces = v2SafeSurfaces_();
  const rows = [];
  Object.keys(surfaces).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    const d = v2SafeRead_(sh,surfaces[name].key);
    d.rows.forEach((row,i) => {
      const key = String(row[d.index[d.key]] == null ? '' : row[d.index[d.key]]).trim();
      if (key) rows.push([name,key,i+2,v2SafeFingerprint_(row),new Date(),'BASELINE']);
    });
  });
  if (shadow.getLastRow()>1) shadow.getRange(2,1,shadow.getLastRow()-1,6).clearContent();
  if (rows.length) shadow.getRange(2,1,rows.length,6).setValues(rows);
  return {ok:true,rows:rows.length};
}

function reconcileV2MasterDataSafe() {
  const ss = SpreadsheetApp.openById('1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo');
  const issue = v2SafeSheet_(ss,'_V2_DATA_QUALITY_ISSUE',['issueId','occurredAt','severity','sheetName','rowNumber','ruleCode','entityKey','message','status','eventId','resolvedAt']);
  const shadow = v2SafeSheet_(ss,'_V2_MASTER_SHADOW',['sheetName','rowKey','rowNumber','fingerprint','capturedAt','status']);
  const surfaces = v2SafeSurfaces_();
  const old = shadow.getLastRow()>1 ? shadow.getRange(2,1,shadow.getLastRow()-1,6).getValues() : [];
  const oldMap = new Map();
  old.forEach((r,i)=>oldMap.set(r[0]+'|'+r[1],{sheetRow:i+2,rowNumber:r[2],fingerprint:r[3]}));
  const current = new Set();
  const issues = [];
  const validChanges = [];

  Object.keys(surfaces).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow()<2) return;
    const d = v2SafeRead_(sh,surfaces[name].key);
    const seen = new Set();
    d.rows.forEach((row,i)=>{
      const rowNumber=i+2;
      const key=String(row[d.index[d.key]]==null?'':row[d.index[d.key]]).trim();
      if (!key) { issues.push(v2SafeIssue_('HIGH',name,rowNumber,'PRIMARY_KEY_REQUIRED','',d.key+' is required.')); return; }
      const mapKey=name+'|'+key;
      current.add(mapKey);
      if (seen.has(key)) issues.push(v2SafeIssue_('HIGH',name,rowNumber,'DUPLICATE_PRIMARY_KEY',key,'Duplicate primary key.'));
      seen.add(key);
      const rowIssues=v2SafeValidateRow_(ss,name,d,row,rowNumber);
      rowIssues.forEach(x=>issues.push(x));
      const fp=v2SafeFingerprint_(row);
      const previous=oldMap.get(mapKey);
      if (!previous || previous.fingerprint!==fp) validChanges.push({name,key,rowNumber,fp,invalid:rowIssues.length>0});
    });
  });

  old.forEach(r=>{
    const mapKey=r[0]+'|'+r[1];
    if (!current.has(mapKey)) issues.push(v2SafeIssue_('HIGH',r[0],r[2],'CANONICAL_ROW_MISSING',r[1],'Baselined row disappeared; use lifecycle deactivation instead of deletion.'));
  });

  if (issues.length) {
    const out=issues.map(x=>[Utilities.getUuid(),new Date(),x.severity,x.sheetName,x.rowNumber,x.ruleCode,x.entityKey,x.message,'OPEN','', '']);
    issue.getRange(issue.getLastRow()+1,1,out.length,11).setValues(out);
  }

  validChanges.filter(x=>!x.invalid && !issues.some(i=>i.sheetName===x.name && i.rowNumber===x.rowNumber)).forEach(x=>{
    const previous=oldMap.get(x.name+'|'+x.key);
    const row=[x.name,x.key,x.rowNumber,x.fp,new Date(),'BASELINE'];
    if (previous) shadow.getRange(previous.sheetRow,1,1,6).setValues([row]);
    else shadow.appendRow(row);
  });

  return {ok:issues.length===0,issues:issues.length,changes:validChanges.length,shadowRows:Math.max(0,shadow.getLastRow()-1)};
}

function v2SafeValidateRow_(ss,name,d,row,rowNumber) {
  const cfg=v2SafeSurfaces_()[name];
  const by={}; d.headers.forEach((h,i)=>by[h]=row[i]);
  const out=[];
  (cfg.required||[]).forEach(h=>{if(!String(by[h]==null?'':by[h]).trim())out.push(v2SafeIssue_('HIGH',name,rowNumber,'REQUIRED_FIELD_MISSING',String(by[cfg.key]||''),h+' is required.'));});
  (cfg.numeric||[]).forEach(h=>{if(by[h]!==''&&by[h]!=null&&!Number.isFinite(Number(by[h])))out.push(v2SafeIssue_('HIGH',name,rowNumber,'NUMERIC_FIELD_INVALID',String(by[cfg.key]||''),h+' must be numeric.'));});
  if(name==='Product'){
    const code=String(by.productCode||'').trim().toUpperCase();
    if(code&&v2SafeCount_(ss,'Product','productCode',code,true)>1)out.push(v2SafeIssue_('HIGH',name,rowNumber,'DUPLICATE_PRODUCT_CODE',String(by.productId||''),'productCode must be unique.'));
  }
  if(name==='ProductUnit'){
    const f=Number(by.conversionToBase);
    if(!Number.isInteger(f)||f<=0)out.push(v2SafeIssue_('HIGH',name,rowNumber,'CONVERSION_INVALID',String(by.productUnitId||''),'conversionToBase must be a positive integer.'));
    if(!v2SafeHas_(ss,'Product','productId',by.productId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.productUnitId||''),'productId does not resolve.'));
  }
  if(name==='ProductPrice'){
    const p=Number(by.price);
    if(!Number.isFinite(p)||p<0)out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRICE_INVALID',String(by.priceId||''),'price must be finite and non-negative.'));
    if(!v2SafeHas_(ss,'ProductUnit','productUnitId',by.productUnitId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRODUCT_UNIT_FK_MISSING',String(by.priceId||''),'productUnitId does not resolve.'));
  }
  if(name==='ProductLocation'){
    if(!v2SafeHas_(ss,'Product','productId',by.productId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.productLocationId||''),'productId does not resolve.'));
    if(!v2SafeHas_(ss,'Location','locationId',by.locationId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'LOCATION_FK_MISSING',String(by.productLocationId||''),'locationId does not resolve.'));
  }
  return out;
}

function v2SafeSurfaces_(){return{
  Product:{key:'productId',required:['productCode','name'],numeric:['minimumStock']},
  ProductUnit:{key:'productUnitId',required:['productId','unitCode','unitName'],numeric:['conversionToBase']},
  ProductPrice:{key:'priceId',required:['productUnitId','priceType'],numeric:['price']},
  Location:{key:'locationId',required:['locationCode','name']},
  Supplier:{key:'supplierId',required:['supplierCode','name']},
  ProductLocation:{key:'productLocationId',required:['productId','locationId']}
};}
function v2SafeRead_(sh,key){const values=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();const headers=values[0].map(String);const index={};headers.forEach((h,i)=>index[h]=i);return{headers,index,key,rows:values.slice(1)};}
function v2SafeHas_(ss,sheet,key,value){const sh=ss.getSheetByName(sheet);if(!sh||sh.getLastRow()<2)return false;const d=v2SafeRead_(sh,key);const target=String(value==null?'':value).trim();return d.rows.some(r=>String(r[d.index[key]]==null?'':r[d.index[key]]).trim()===target);}
function v2SafeCount_(ss,sheet,key,value,ci){const sh=ss.getSheetByName(sheet);if(!sh||sh.getLastRow()<2)return 0;const d=v2SafeRead_(sh,key);const target=ci?String(value).trim().toUpperCase():String(value).trim();return d.rows.filter(r=>{const v=String(r[d.index[key]]==null?'':r[d.index[key]]).trim();return(ci?v.toUpperCase():v)===target;}).length;}
function v2SafeFingerprint_(row){const normalized=row.map(v=>v instanceof Date?v.toISOString():String(v==null?'':v));const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(normalized),Utilities.Charset.UTF_8);return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');}
function v2SafeIssue_(severity,sheetName,rowNumber,ruleCode,entityKey,message){return{severity,sheetName,rowNumber,ruleCode,entityKey:entityKey||'',message};}
function v2SafeSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);return sh;}
