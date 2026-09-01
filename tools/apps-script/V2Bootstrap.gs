/**
 * Ana Farma V2 - non-destructive Spreadsheet bootstrap.
 * Standalone target: V2 spreadsheet only. Production is never opened or mutated.
 */
const AF_V2 = {
  spreadsheetId: '1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo',
  metaSheet: '_V2_META', auditSheet: '_V2_DATA_AUDIT', schemaVersion: '2.0.0',
  tables: {
    Products:['ProductId','Sku','Name','CategoryId','InventoryTrackingMode','Active','CreatedAt','UpdatedAt'],
    ProductUnits:['UnitId','ProductId','Name','Symbol','IsBaseUnit','CanSell','CanPurchase','Active','CreatedAt','UpdatedAt'],
    UnitConversions:['ConversionId','ProductId','FromUnitId','ToUnitId','Factor','Active','CreatedAt','UpdatedAt'],
    ProductPrices:['PriceId','ProductId','UnitId','Price','Currency','EffectiveFrom','EffectiveTo','Active','CreatedAt','CreatedBy'],
    StockBalance:['ProductId','QuantityBase','UpdatedAt'],
    StockLedger:['MovementId','TransactionId','ProductId','QuantityBase','Direction','Type','OccurredAt','ActorId','Reason'],
    Sales:['TransactionId','ReceiptNumber','RequestId','RequestFingerprint','ShiftId','CustomerId','ActorId','Subtotal','Discount','Tax','Total','Paid','Change','PaymentMethod','CreatedAt'],
    SaleItems:['SaleItemId','TransactionId','ProductId','ProductName','UnitId','UnitName','Qty','ConversionFactor','QtyBase','UnitPrice','Subtotal','PriceId'],
    Payments:['PaymentId','TransactionId','Method','Amount','CreatedAt'],
    RequestLedger:['RequestId','PayloadHash','Action','Status','TransactionId','ResultJson','ErrorCode','CreatedAt','CompletedAt'],
    AuditLog:['AuditId','OccurredAt','ActorId','Action','EntityType','EntityId','RequestId','MetadataJson'],
    TransactionJournal:['JournalId','TransactionId','RequestId','State','PreparedAt','CommittedAt','PayloadHash','RecoveryJson'],
    SchemaVersion:['Version','AppliedAt'], MigrationRun:['RunId','StartedAt','CompletedAt','Status','Source','Target','SummaryJson'],
    MigrationQuarantine:['RunId','EntityType','SourceId','Reason','PayloadJson','CreatedAt'],
    Shifts:['ShiftId','ActorId','OpenedAt','OpeningCash','Status','ClosedAt','ClosingCash']
  },
  masterSurfaces:{
    Location:['LocationId','LocationCode','Name','Active','CreatedAt','UpdatedAt'],
    Supplier:['SupplierId','SupplierCode','Name','Active','CreatedAt','UpdatedAt'],
    ProductLocation:['ProductLocationId','ProductId','LocationId','IsDefault','Active','CreatedAt','UpdatedAt']
  },
  accessSurface:{name:'_V2_ACCESS',headers:['UserId','Email','Role','Capabilities','Active','CreatedAt','UpdatedAt']},
  deprecatedBootstrapTables:['Product','ProductUnit','ProductPrice','Sale','SaleItem','Payment','MigrationMap','Reconciliation']
};
function afV2Spreadsheet_(){return SpreadsheetApp.openById(AF_V2.spreadsheetId);}
function bootstrapV2Database(){
  const ss=afV2Spreadsheet_(),created=[],ensure=Object.assign({},AF_V2.tables,AF_V2.masterSurfaces,{[AF_V2.accessSurface.name]:AF_V2.accessSurface.headers});
  Object.keys(ensure).forEach(name=>{let sh=ss.getSheetByName(name);if(!sh){sh=ss.insertSheet(name);created.push(name);}const headers=ensure[name];if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);else{const existing=sh.getRange(1,1,1,Math.max(sh.getLastColumn(),headers.length)).getValues()[0];headers.forEach((h,i)=>{if(!existing[i])sh.getRange(1,i+1).setValue(h);});}sh.setFrozenRows(1);});
  const meta=afEnsureSheet_('_V2_META',['key','value','recordedAt']);
  const rows=[['schemaVersion',AF_V2.schemaVersion,new Date()],['baselineSpreadsheetId',ss.getId(),new Date()],['baselineSpreadsheetName',ss.getName(),new Date()],['bootstrapMode','NON_DESTRUCTIVE',new Date()],['legacySheetsPreserved','TRUE',new Date()],['canonicalSchemaSource','src/infrastructure/sheets/Schema.js',new Date()],['deprecatedBootstrapTables',AF_V2.deprecatedBootstrapTables.join(','),new Date()]];
  if(meta.getLastRow()>1)meta.getRange(2,1,meta.getLastRow()-1,3).clearContent();meta.getRange(2,1,rows.length,3).setValues(rows);
  return{schemaVersion:AF_V2.schemaVersion,createdTables:created,spreadsheetId:ss.getId(),canonical:true};
}
function auditLegacyWorkbook(){
  const ss=afV2Spreadsheet_(),audit=afEnsureSheet_('_V2_DATA_AUDIT',['sheetName','rows','columns','headersJson','blankRows','duplicateFirstColumn','formulaCells','checkedAt']),output=[];
  ss.getSheets().forEach(sh=>{const name=sh.getName();if(name.indexOf('_V2_')===0||AF_V2.tables[name]||AF_V2.masterSurfaces[name]||name===AF_V2.accessSurface.name)return;const rows=sh.getLastRow(),cols=sh.getLastColumn(),values=rows&&cols?sh.getRange(1,1,rows,cols).getValues():[],headers=values.length?values[0]:[];let blankRows=0,formulaCells=0;const keys=[];for(let r=1;r<values.length;r++){const row=values[r];if(row.every(v=>v===''||v===null))blankRows++;if(row[0]!==''&&row[0]!==null)keys.push(String(row[0]));}const seen=new Set(),dup=new Set();keys.forEach(k=>seen.has(k)?dup.add(k):seen.add(k));if(rows&&cols)sh.getRange(1,1,rows,cols).getFormulas().forEach(row=>row.forEach(f=>{if(f)formulaCells++;}));output.push([name,rows,cols,JSON.stringify(headers),blankRows,dup.size,formulaCells,new Date()]);});
  if(audit.getLastRow()>1)audit.getRange(2,1,audit.getLastRow()-1,8).clearContent();if(output.length)audit.getRange(2,1,output.length,8).setValues(output);return{sheetAudited:output.length,auditSheet:'_V2_DATA_AUDIT'};
}
function afEnsureSheet_(name,headers){const ss=afV2Spreadsheet_();let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);return sh;}
