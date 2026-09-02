/**
 * Ana Farma V2 - canonical spreadsheet bootstrap.
 * Non-destructive: legacy sheets are never renamed, cleared or deleted.
 */
const AF_V2 = {
  spreadsheetId:'1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo',
  metaSheet:'_V2_META', auditSheet:'_V2_DATA_AUDIT', schemaVersion:'2.0.0',
  tables:{
    Product:['productId','productCode','name','categoryId','active','minimumStock','defaultLocationId','createdAt','updatedAt'],
    ProductUnit:['productUnitId','productId','unitCode','unitName','conversionToBase','isBase','active','createdAt','updatedAt'],
    UnitConversions:['ConversionId','ProductId','FromUnitId','ToUnitId','Factor','Active','CreatedAt','UpdatedAt'],
    ProductPrice:['priceId','productUnitId','priceType','price','currency','effectiveFrom','effectiveTo','active','createdAt','updatedAt'],
    Location:['LocationId','LocationCode','Name','Active','CreatedAt','UpdatedAt'],
    ProductLocation:['ProductLocationId','ProductId','LocationId','IsDefault','Active','CreatedAt','UpdatedAt'],
    StockBalance:['productId','locationId','quantityBase','updatedAt','version'],
    StockLedger:['movementId','transactionId','productId','locationId','direction','quantityBase','movementType','occurredAt','actorId','requestId','reason'],
    Shift:['shiftId','actorId','openedAt','openingCash','status','closedAt','closingCash','createdAt','updatedAt'],
    Sale:['transactionId','requestId','actorId','shiftId','customerId','occurredAt','subtotal','discount','total','status','createdAt'],
    SaleItem:['saleItemId','transactionId','productId','productUnitId','sellingUnit','sellingQty','conversionToBase','baseQty','sellingPrice','subtotal','createdAt'],
    Payment:['paymentId','transactionId','method','amount','reference','paidAt','createdAt'],
    RequestLedger:['RequestId','PayloadHash','Action','Status','TransactionId','ResultJson','ErrorCode','CreatedAt','CompletedAt'],
    AuditLog:['AuditId','OccurredAt','ActorId','Action','EntityType','EntityId','RequestId','MetadataJson'],
    TransactionJournal:['JournalId','TransactionId','RequestId','State','PreparedAt','CommittedAt','PayloadHash','RecoveryJson'],
    SchemaVersion:['Version','AppliedAt'],
    MigrationRun:['RunId','StartedAt','CompletedAt','Status','Source','Target','SummaryJson'],
    MigrationMap:['sourceType','sourceId','targetType','targetId','runId','createdAt'],
    MigrationQurantine:['RunId','EntityType','SourceId','Reason','PayloadJson','CreatedAt'],
    Reconciliation:['reconciliationId','domain','sourceKey','targetKey','status','detailsJson','checkedAt']
  },
  accessSurface:{name:'_V2_ACCESS',headers:['UserId','Email','Role','Capabilities','Active','CreatedAt','UpdatedAt']}
};
function afV2Spreadsheet_(){return SpreadsheetApp.openById(AF_V2.spreadsheetId);}
function bootstrapV2Database(){
  const ss=afV2Spreadsheet_(),created=[],all=Object.assign({},AF_V2.tables,{[AF_V2.accessSurface.name]:AF_V2.accessSurface.headers});
  Object.keys(all).forEach(name=>{let sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);created.push(name);}const h=all[name];if(sh.getLastRow()===0)sh.getRange(1,1,1,h.length).setValues([h]);sh.setFrozenRows(1);});
  const meta=afEnsureSheet_('_V2_META',['key','value','recordedAt']);
  const rows=[['schemaVersion',AF_V2.schemaVersion,new Date()],['baselineSpreadsheetId',ss.getId(),new Date()],['bootstrapMode','NON_DESTRUCTIVE_CANONICAL',new Date()],['legacySheetsPreserved','TRUE',new Date()]];
  if(meta.getLastRow()>1)meta.getRange(2,1,meta.getLastRow()-1,3).clearContent();meta.getRange(2,1,rows.length,3).setValues(rows);
  return{schemaVersion:AF_V2.schemaVersion,createdTables:created,spreadsheetId:ss.getId(),canonical:true};
}
function auditLegacyWorkbook(){
  const ss=afV2Spreadsheet_(),audit=afEnsureSheet_('_V2_DATA_AUDIT',['sheetName','rows','columns','headersJson','blankRows','duplicateFirstColumn','formulaCells','checkedAt']),out=[];
  ss.getSheets().forEach(sh=>{const name=sh.getName();if(name.indexOf('_V2_')===0||AF_V2.tables[name]||name===AF_V2.accessSurface.name)return;const rows=sh.getLastRow(),cols=sh.getLastColumn(),values=rows&&cols?sh.getRange(1,1,rows,cols).getValues():[],headers=values.length?values[0]:[];let blank=0,formula=0;const keys=[];for(let r=1;r<values.length;r++){if(values[r].every(v=>v===''||v===null))blank++;if(values[r][0]!==''&&values[r][0]!==null)keys.push(String(values[r][0]));}const seen=new Set(),dup=new Set();keys.forEach(k=>seen.has(k)?dup.add(k):seen.add(k));if(rows&&cols)sh.getRange(1,1,rows,cols).getFormulas().forEach(row=>row.forEach(f=>{if(f)formula++;}));out.push([name,rows,cols,JSON.stringify(headers),blank,dup.size,formula,new Date()]);});
  if(audit.getLastRow()>1)audit.getRange(2,1,audit.getLastRow()-1,8).clearContent();if(out.length)audit.getRange(2,1,out.length,8).setValues(out);return{sheetAudited:out.length,auditSheet:'_V2_DATA_AUDIT'};
}
function afEnsureSheet_(name,headers){const ss=afV2Spreadsheet_();let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);return sh;}
