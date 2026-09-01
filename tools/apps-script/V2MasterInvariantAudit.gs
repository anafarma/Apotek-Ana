/**
 * V2 canonical master maintenance.
 *
 * This is intentionally a separate command from transaction code. It lets an
 * owner paste new master rows without first knowing internal UUIDs, while the
 * system validates the resulting relationships before the app trusts them.
 */

function repairV2MasterIdsAndAudit() {
  const ss = SpreadsheetApp.openById('1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo');
  const surfaces = {
    Product:'productId', ProductUnit:'productUnitId', ProductPrice:'priceId',
    Location:'locationId', Supplier:'supplierId', ProductLocation:'productLocationId'
  };
  const repaired=[];
  Object.keys(surfaces).forEach(name=>{
    const sh=ss.getSheetByName(name);
    if(!sh||sh.getLastRow()<2)return;
    const values=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
    const headers=values[0].map(String); const idx={}; headers.forEach((h,i)=>idx[h]=i);
    const keyCol=idx[surfaces[name]];
    if(keyCol==null)return;
    const updates=[];
    for(let r=1;r<values.length;r++){
      if(String(values[r][keyCol]||'').trim())continue;
      const meaningful=values[r].some((v,i)=>i!==keyCol && String(v==null?'':v).trim()!=='');
      if(!meaningful)continue;
      const id=Utilities.getUuid();
      sh.getRange(r+1,keyCol+1).setValue(id);
      repaired.push([name,r+1,id]);
    }
  });

  const issues=[];
  const products=v2MasterRows_(ss,'Product','productId');
  const units=v2MasterRows_(ss,'ProductUnit','productUnitId');
  const prices=v2MasterRows_(ss,'ProductPrice','priceId');
  const locations=v2MasterRows_(ss,'Location','locationId');
  const productLocations=v2MasterRows_(ss,'ProductLocation','productLocationId');

  const productIds=new Set(products.map(x=>String(x.row.productId||'').trim()));
  const locationIds=new Set(locations.map(x=>String(x.row.locationId||'').trim()));
  const unitIds=new Set(units.map(x=>String(x.row.productUnitId||'').trim()));
  const productBaseCount=new Map();

  units.forEach(x=>{
    const p=String(x.row.productId||'').trim();
    if(!productIds.has(p))issues.push(v2InvariantIssue_('HIGH','ProductUnit',x.rowNumber,'PRODUCT_FK_MISSING',x.row.productUnitId,'productId does not resolve.'));
    const f=Number(x.row.conversionToBase);
    if(!Number.isInteger(f)||f<=0)issues.push(v2InvariantIssue_('HIGH','ProductUnit',x.rowNumber,'CONVERSION_INVALID',x.row.productUnitId,'conversionToBase must be a positive integer.'));
    if(String(x.row.active).toUpperCase()==='TRUE'&&String(x.row.isBase).toUpperCase()==='TRUE')productBaseCount.set(p,(productBaseCount.get(p)||0)+1);
  });
  products.forEach(x=>{
    const p=String(x.row.productId||'').trim();
    const code=String(x.row.productCode||'').trim().toUpperCase();
    if(!code)issues.push(v2InvariantIssue_('HIGH','Product',x.rowNumber,'PRODUCT_CODE_REQUIRED',p,'productCode is required.'));
    if(code&&products.filter(y=>String(y.row.productCode||'').trim().toUpperCase()===code).length>1)issues.push(v2InvariantIssue_('HIGH','Product',x.rowNumber,'DUPLICATE_PRODUCT_CODE',p,'productCode must be unique.'));
    if(productBaseCount.get(p)!==1)issues.push(v2InvariantIssue_('HIGH','Product',x.rowNumber,'BASE_UNIT_CARDINALITY',p,'Each product must have exactly one active base unit.'));
  });
  prices.forEach(x=>{
    const p=Number(x.row.price);
    if(!Number.isFinite(p)||p<0)issues.push(v2InvariantIssue_('HIGH','ProductPrice',x.rowNumber,'PRICE_INVALID',x.row.priceId,'price must be finite and non-negative.'));
    if(!unitIds.has(String(x.row.productUnitId||'').trim()))issues.push(v2InvariantIssue_('HIGH','ProductPrice',x.rowNumber,'PRODUCT_UNIT_FK_MISSING',x.row.priceId,'productUnitId does not resolve.'));
  });
  productLocations.forEach(x=>{
    if(!productIds.has(String(x.row.productId||'').trim()))issues.push(v2InvariantIssue_('HIGH','ProductLocation',x.rowNumber,'PRODUCT_FK_MISSING',x.row.productLocationId,'productId does not resolve.'));
    if(!locationIds.has(String(x.row.locationId||'').trim()))issues.push(v2InvariantIssue_('HIGH','ProductLocation',x.rowNumber,'LOCATION_FK_MISSING',x.row.productLocationId,'locationId does not resolve.'));
  });

  const issueSheet=v2InvariantSheet_(ss);
  if(issues.length){const out=issues.map(x=>[Utilities.getUuid(),new Date(),x.severity,x.sheetName,x.rowNumber,x.ruleCode,x.entityKey,x.message,'OPEN','','']);issueSheet.getRange(issueSheet.getLastRow()+1,1,out.length,11).setValues(out);}
  return {ok:issues.length===0,repairedIds:repaired.length,issues:issues.length};
}

function v2MasterRows_(ss,name,key){
  const sh=ss.getSheetByName(name); if(!sh||sh.getLastRow()<2)return[];
  const values=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
  const headers=values[0].map(String); const idx={};headers.forEach((h,i)=>idx[h]=i);
  return values.slice(1).map((r,i)=>({row:r,rowNumber:i+2,key:r[idx[key]]}));
}
function v2InvariantIssue_(severity,sheetName,rowNumber,ruleCode,entityKey,message){return{severity,sheetName,rowNumber,ruleCode,entityKey:entityKey||'',message};}
function v2InvariantSheet_(ss){const h=['issueId','occurredAt','severity','sheetName','rowNumber','ruleCode','entityKey','message','status','eventId','resolvedAt'];let sh=ss.getSheetByName('_V2_DATA_QUALITY_ISSUE');if(!sh)sh=ss.insertSheet('_V2_DATA_QUALITY_ISSUE');if(sh.getLastRow()===0)sh.getRange(1,1,1,h.length).setValues([h]);return sh;}
