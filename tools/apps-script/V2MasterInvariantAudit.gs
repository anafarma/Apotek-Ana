/**
 * V2 canonical master maintenance.
 * Generates missing internal IDs and validates the canonical master surfaces.
 */

function repairV2MasterIdsAndAudit() {
  const ss = SpreadsheetApp.openById('1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo');
  const surfaces = {
    Products:'ProductId', ProductUnits:'UnitId', UnitConversions:'ConversionId', ProductPrices:'PriceId',
    Location:'LocationId', Supplier:'SupplierId', ProductLocation:'ProductLocationId'
  };
  const repaired=[];

  Object.keys(surfaces).forEach(name=>{
    const sh=ss.getSheetByName(name);
    if(!sh||sh.getLastRow()<2)return;
    const values=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
    const headers=values[0].map(String); const idx={}; headers.forEach((h,i)=>idx[h]=i);
    const keyCol=idx[surfaces[name]];
    if(keyCol==null)return;
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
  const products=v2MasterRows_(ss,'Products','ProductId');
  const units=v2MasterRows_(ss,'ProductUnits','UnitId');
  const conversions=v2MasterRows_(ss,'UnitConversions','ConversionId');
  const prices=v2MasterRows_(ss,'ProductPrices','PriceId');
  const locations=v2MasterRows_(ss,'Location','LocationId');
  const productLocations=v2MasterRows_(ss,'ProductLocation','ProductLocationId');

  const productIds=new Set(products.map(x=>String(x.row.ProductId||'').trim()));
  const locationIds=new Set(locations.map(x=>String(x.row.LocationId||'').trim()));
  const unitIds=new Set(units.map(x=>String(x.row.UnitId||'').trim()));
  const baseByProduct=new Map();

  units.forEach(x=>{
    const p=String(x.row.ProductId||'').trim();
    if(!productIds.has(p))issues.push(v2InvariantIssue_('HIGH','ProductUnits',x.rowNumber,'PRODUCT_FK_MISSING',x.row.UnitId,'ProductId does not resolve.'));
    if(String(x.row.Active).toUpperCase()==='TRUE'&&String(x.row.IsBaseUnit).toUpperCase()==='TRUE')baseByProduct.set(p,(baseByProduct.get(p)||0)+1);
  });
  products.forEach(x=>{
    const p=String(x.row.ProductId||'').trim();
    const sku=String(x.row.Sku||'').trim().toUpperCase();
    if(!sku)issues.push(v2InvariantIssue_('HIGH','Products',x.rowNumber,'SKU_REQUIRED',p,'Sku is required.'));
    if(sku&&products.filter(y=>String(y.row.Sku||'').trim().toUpperCase()===sku).length>1)issues.push(v2InvariantIssue_('HIGH','Products',x.rowNumber,'DUPLICATE_SKU',p,'Sku must be unique.'));
    if(baseByProduct.get(p)!==1)issues.push(v2InvariantIssue_('HIGH','Products',x.rowNumber,'BASE_UNIT_CARDINALITY',p,'Each product must have exactly one active base unit.'));
  });
  conversions.forEach(x=>{
    const factor=Number(x.row.Factor);
    if(!Number.isInteger(factor)||factor<=0)issues.push(v2InvariantIssue_('HIGH','UnitConversions',x.rowNumber,'CONVERSION_INVALID',x.row.ConversionId,'Factor must be a positive integer.'));
    if(!productIds.has(String(x.row.ProductId||'').trim()))issues.push(v2InvariantIssue_('HIGH','UnitConversions',x.rowNumber,'PRODUCT_FK_MISSING',x.row.ConversionId,'ProductId does not resolve.'));
    if(!unitIds.has(String(x.row.FromUnitId||'').trim()))issues.push(v2InvariantIssue_('HIGH','UnitConversions',x.rowNumber,'FROM_UNIT_FK_MISSING',x.row.ConversionId,'FromUnitId does not resolve.'));
    if(!unitIds.has(String(x.row.ToUnitId||'').trim()))issues.push(v2InvariantIssue_('HIGH','UnitConversions',x.rowNumber,'TO_UNIT_FK_MISSING',x.row.ConversionId,'ToUnitId does not resolve.'));
    if(String(x.row.FromUnitId)===String(x.row.ToUnitId))issues.push(v2InvariantIssue_('HIGH','UnitConversions',x.rowNumber,'SELF_CONVERSION_FORBIDDEN',x.row.ConversionId,'A unit cannot convert to itself.'));
  });
  prices.forEach(x=>{
    const p=Number(x.row.Price);
    if(!Number.isFinite(p)||p<0)issues.push(v2InvariantIssue_('HIGH','ProductPrices',x.rowNumber,'PRICE_INVALID',x.row.PriceId,'Price must be finite and non-negative.'));
    if(!productIds.has(String(x.row.ProductId||'').trim()))issues.push(v2InvariantIssue_('HIGH','ProductPrices',x.rowNumber,'PRODUCT_FK_MISSING',x.row.PriceId,'ProductId does not resolve.'));
    if(!unitIds.has(String(x.row.UnitId||'').trim()))issues.push(v2InvariantIssue_('HIGH','ProductPrices',x.rowNumber,'UNIT_FK_MISSING',x.row.PriceId,'UnitId does not resolve.'));
  });
  productLocations.forEach(x=>{
    if(!productIds.has(String(x.row.ProductId||'').trim()))issues.push(v2InvariantIssue_('HIGH','ProductLocation',x.rowNumber,'PRODUCT_FK_MISSING',x.row.ProductLocationId,'ProductId does not resolve.'));
    if(!locationIds.has(String(x.row.LocationId||'').trim()))issues.push(v2InvariantIssue_('HIGH','ProductLocation',x.rowNumber,'LOCATION_FK_MISSING',x.row.ProductLocationId,'LocationId does not resolve.'));
  });

  const issueSheet=v2InvariantSheet_(ss);
  if(issues.length){const out=issues.map(x=>[Utilities.getUuid(),new Date(),x.severity,x.sheetName,x.rowNumber,x.ruleCode,x.entityKey,x.message,'OPEN','','']);issueSheet.getRange(issueSheet.getLastRow()+1,1,out.length,11).setValues(out);}
  return {ok:issues.length===0,repairedIds:repaired.length,issues:issues.length,canonical:true};
}

function v2MasterRows_(ss,name,key){
  const sh=ss.getSheetByName(name); if(!sh||sh.getLastRow()<2)return[];
  const values=sh.getRange(1,1,sh.getLastRow(),sh.getLastColumn()).getValues();
  const headers=values[0].map(String); const idx={};headers.forEach((h,i)=>idx[h]=i);
  return values.slice(1).map((r,i)=>({row:r,rowNumber:i+2,key:r[idx[key]]}));
}
function v2InvariantIssue_(severity,sheetName,rowNumber,ruleCode,entityKey,message){return{severity,sheetName,rowNumber,ruleCode,entityKey:entityKey||'',message};}
function v2InvariantSheet_(ss){const h=['issueId','occurredAt','severity','sheetName','rowNumber','ruleCode','entityKey','message','status','eventId','resolvedAt'];let sh=ss.getSheetByName('_V2_DATA_QUALITY_ISSUE');if(!sh)sh=ss.insertSheet('_V2_DATA_QUALITY_ISSUE');if(sh.getLastRow()===0)sh.getRange(1,1,1,h.length).setValues([h]);return sh;}
