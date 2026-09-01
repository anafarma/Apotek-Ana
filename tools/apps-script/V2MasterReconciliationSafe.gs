/**
 * Safe entrypoints for V2 master reconciliation.
 * Canonical surfaces mirror src/infrastructure/sheets/Schema.js.
 */

const AF_SAFE_SPREADSHEET_ID = '1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo';

function initializeV2MasterShadowSafe() {
  const ss = SpreadsheetApp.openById(AF_SAFE_SPREADSHEET_ID);
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
  return {ok:true,rows:rows.length,canonical:true};
}

function reconcileV2MasterDataSafe() {
  const ss = SpreadsheetApp.openById(AF_SAFE_SPREADSHEET_ID);
  const issue = v2SafeSheet_(ss,'_V2_DATA_QUALITY_ISSUE',['issueId','occurredAt','severity','sheetName','rowNumber','ruleCode','entityKey','message','status','eventId','resolvedAt']);
  const shadow = v2SafeSheet_(ss,'_V2_MASTER_SHADOW',['sheetName','rowKey','rowNumber','fingerprint','capturedAt','status']);
  const surfaces = v2SafeSurfaces_();
  const old = shadow.getLastRow()>1 ? shadow.getRange(2,1,shadow.getLastRow()-1,6).getValues() : [];
  const oldMap = new Map();
  old.forEach((r,i)=>oldMap.set(r[0]+'|'+r[1],{sheetRow:i+2,rowNumber:r[2],fingerprint:r[3]}));
  const current = new Set();
  const issues = [];
  const validChanges = [];
  const datasets = {};

  Object.keys(surfaces).forEach(name => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow()<2) return;
    const d = v2SafeRead_(sh,surfaces[name].key);
    datasets[name] = d;
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

  v2SafeValidateCrossRowInvariants_(ss,datasets).forEach(x=>issues.push(x));

  old.forEach(r=>{
    const mapKey=r[0]+'|'+r[1];
    if (!current.has(mapKey)) issues.push(v2SafeIssue_('HIGH',r[0],r[2],'CANONICAL_ROW_MISSING',r[1],'Baselined row disappeared; use lifecycle deactivation instead of deletion.'));
  });

  if (issues.length) {
    const out=issues.map(x=>[Utilities.getUuid(),new Date(),x.severity,x.sheetName,x.rowNumber,x.ruleCode,x.entityKey,x.message,'OPEN','', '']);
    issue.getRange(issue.getLastRow()+1,1,out.length,11).setValues(out);
  }

  // Invalid rows stay pinned to the previous trusted fingerprint. Only valid
  // changes advance the trusted shadow baseline.
  validChanges.filter(x=>!x.invalid && !v2SafeRowHasIssue_(issues,x.name,x.rowNumber)).forEach(x=>{
    const previous=oldMap.get(x.name+'|'+x.key);
    const row=[x.name,x.key,x.rowNumber,x.fp,new Date(),'BASELINE'];
    if (previous) shadow.getRange(previous.sheetRow,1,1,6).setValues([row]);
    else shadow.appendRow(row);
  });

  return {ok:issues.length===0,issues:issues.length,changes:validChanges.length,shadowRows:Math.max(0,shadow.getLastRow()-1),canonical:true};
}

function v2SafeValidateRow_(ss,name,d,row,rowNumber) {
  const cfg=v2SafeSurfaces_()[name];
  const by={}; d.headers.forEach((h,i)=>by[h]=row[i]);
  const out=[];
  (cfg.required||[]).forEach(h=>{if(!String(by[h]==null?'':by[h]).trim())out.push(v2SafeIssue_('HIGH',name,rowNumber,'REQUIRED_FIELD_MISSING',String(by[cfg.key]||''),h+' is required.'));});
  (cfg.numeric||[]).forEach(h=>{if(by[h]!==''&&by[h]!=null&&!Number.isFinite(Number(by[h])))out.push(v2SafeIssue_('HIGH',name,rowNumber,'NUMERIC_FIELD_INVALID',String(by[cfg.key]||''),h+' must be numeric.'));});
  if(name==='Products'){
    const sku=String(by.Sku||'').trim().toUpperCase();
    if(sku&&v2SafeCount_(ss,'Products','Sku',sku,true)>1)out.push(v2SafeIssue_('HIGH',name,rowNumber,'DUPLICATE_SKU',String(by.ProductId||''),'Sku must be unique.'));
  }
  if(name==='ProductUnits'){
    if(!v2SafeHas_(ss,'Products','ProductId',by.ProductId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.UnitId||''),'ProductId does not resolve.'));
  }
  if(name==='UnitConversions'){
    const f=Number(by.Factor);
    if(!Number.isInteger(f)||f<=0)out.push(v2SafeIssue_('HIGH',name,rowNumber,'CONVERSION_INVALID',String(by.ConversionId||''),'Factor must be a positive integer.'));
    if(!v2SafeHas_(ss,'Products','ProductId',by.ProductId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.ConversionId||''),'ProductId does not resolve.'));
    if(!v2SafeHas_(ss,'ProductUnits','UnitId',by.FromUnitId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'FROM_UNIT_FK_MISSING',String(by.ConversionId||''),'FromUnitId does not resolve.'));
    if(!v2SafeHas_(ss,'ProductUnits','UnitId',by.ToUnitId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'TO_UNIT_FK_MISSING',String(by.ConversionId||''),'ToUnitId does not resolve.'));
    if(String(by.FromUnitId)===String(by.ToUnitId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'SELF_CONVERSION_FORBIDDEN',String(by.ConversionId||''),'A unit cannot convert to itself.'));
  }
  if(name==='ProductPrices'){
    const p=Number(by.Price);
    if(!Number.isFinite(p)||p<0)out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRICE_INVALID',String(by.PriceId||''),'Price must be finite and non-negative.'));
    if(!v2SafeHas_(ss,'Products','ProductId',by.ProductId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.PriceId||''),'ProductId does not resolve.'));
    if(!v2SafeHas_(ss,'ProductUnits','UnitId',by.UnitId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'UNIT_FK_MISSING',String(by.PriceId||''),'UnitId does not resolve.'));
    if(by.EffectiveFrom&&by.EffectiveTo&&new Date(by.EffectiveTo)<new Date(by.EffectiveFrom))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRICE_EFFECTIVE_RANGE_INVALID',String(by.PriceId||''),'EffectiveTo must not be earlier than EffectiveFrom.'));
  }
  if(name==='ProductLocation'){
    if(!v2SafeHas_(ss,'Products','ProductId',by.ProductId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'PRODUCT_FK_MISSING',String(by.ProductLocationId||''),'ProductId does not resolve.'));
    if(!v2SafeHas_(ss,'Location','LocationId',by.LocationId))out.push(v2SafeIssue_('HIGH',name,rowNumber,'LOCATION_FK_MISSING',String(by.ProductLocationId||''),'LocationId does not resolve.'));
  }
  return out;
}

function v2SafeValidateCrossRowInvariants_(ss,datasets) {
  const out=[];
  const units=datasets.ProductUnits;
  if(units){
    const byProduct=new Map();
    units.rows.forEach((row,i)=>{
      const productId=String(row[units.index.ProductId]==null?'':row[units.index.ProductId]).trim();
      const active=String(row[units.index.Active]==null?'':row[units.index.Active]).toLowerCase()==='true';
      const base=String(row[units.index.IsBaseUnit]==null?'':row[units.index.IsBaseUnit]).toLowerCase()==='true';
      if(!productId||!active)return;
      if(!byProduct.has(productId))byProduct.set(productId,[]);
      byProduct.get(productId).push({rowNumber:i+2,base});
    });
    byProduct.forEach((rows,productId)=>{const bases=rows.filter(x=>x.base);if(bases.length!==1)out.push(v2SafeIssue_('HIGH','ProductUnits',bases[0]?.rowNumber||2,'ACTIVE_BASE_UNIT_COUNT_INVALID',productId,'Exactly one active base unit is required; found '+bases.length+'.'));});
  }
  const prices=datasets.ProductPrices;
  if(prices){
    const active=new Map();
    prices.rows.forEach((row,i)=>{if(String(row[prices.index.Active]||'').toLowerCase()!=='true')return;const key=String(row[prices.index.ProductId]||'')+'|'+String(row[prices.index.UnitId]||'');if(!active.has(key))active.set(key,[]);active.get(key).push(i+2);});
    active.forEach((rows,key)=>{if(rows.length>1)out.push(v2SafeIssue_('HIGH','ProductPrices',rows[1],'DUPLICATE_ACTIVE_PRICE',key,'Only one active price is allowed for the same product and selling unit.'));});
  }
  const locations=datasets.ProductLocation;
  if(locations){
    const seen=new Set();
    locations.rows.forEach((row,i)=>{if(String(row[locations.index.Active]||'').toLowerCase()!=='true')return;const key=String(row[locations.index.ProductId]||'')+'|'+String(row[locations.index.LocationId]||'');if(seen.has(key))out.push(v2SafeIssue_('HIGH','ProductLocation',i+2,'DUPLICATE_ACTIVE_PRODUCT_LOCATION',key,'Duplicate active ProductLocation assignment.'));seen.add(key);});
  }
  return out;
}
function v2SafeRowHasIssue_(issues,sheetName,rowNumber){return issues.some(i=>i.sheetName===sheetName&&i.rowNumber===rowNumber);}
function v2SafeSurfaces_(){return{Products:{key:'ProductId',required:['Sku','Name']},ProductUnits:{key:'UnitId',required:['ProductId','Name']},UnitConversions:{key:'ConversionId',required:['ProductId','FromUnitId','ToUnitId'],numeric:['Factor']},ProductPrices:{key:'PriceId',required:['ProductId','UnitId'],numeric:['Price']},Location:{key:'LocationId',required:['LocationCode','Name']},Supplier:{key:'SupplierId',required:['SupplierCode','Name']},ProductLocation:{key:'ProductLocationId',required:['ProductId','LocationId']}};}
function v2SafeRead_(sh,key){const values=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();const headers=values[0].map(String);const index={};headers.forEach((h,i)=>index[h]=i);return{headers,index,key,rows:values.slice(1)};}
function v2SafeHas_(ss,sheet,key,value){const sh=ss.getSheetByName(sheet);if(!sh||sh.getLastRow()<2)return false;const d=v2SafeRead_(sh,key);const target=String(value==null?'':value).trim();return d.rows.some(r=>String(r[d.index[key]]==null?'':r[d.index[key]]).trim()===target);}
function v2SafeCount_(ss,sheet,key,value,ci){const sh=ss.getSheetByName(sheet);if(!sh||sh.getLastRow()<2)return 0;const d=v2SafeRead_(sh,key);const target=ci?String(value).trim().toUpperCase():String(value).trim();return d.rows.filter(r=>{const v=String(r[d.index[key]]==null?'':r[d.index[key]]).trim();return(ci?v.toUpperCase():v)===target;}).length;}
function v2SafeFingerprint_(row){const normalized=row.map(v=>v instanceof Date?v.toISOString():String(v==null?'':v));const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify(normalized),Utilities.Charset.UTF_8);return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('');}
function v2SafeIssue_(severity,sheetName,rowNumber,ruleCode,entityKey,message){return{severity,sheetName,rowNumber,ruleCode,entityKey:entityKey||'',message};}
function v2SafeSheet_(ss,name,headers){let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);return sh;}
