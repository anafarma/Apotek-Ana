export const V2_SHEETS = Object.freeze({
  PRODUCT:'Product', PRODUCT_UNIT:'ProductUnit', UNIT_CONVERSION:'UnitConversions', PRODUCT_PRICE:'ProductPrice',
  LOCATION:'Location', PRODUCT_LOCATION:'ProductLocation', STOCK_BALANCE:'StockBalance', STOCK_LEDGER:'StockLedger',
  SALE:'Sale', SALE_ITEM:'SaleItem', PAYMENT:'Payment', SHIFT:'Shift',
  REQUEST_LEDGER:'RequestLedger', AUDIT_LOG:'AuditLog', TRANSACTION_JOURNAL:'TransactionJournal',
  SCHEMA_VERSION:'SchemaVersion', MIGRATION_RUN:'MigrationRun', MIGRATION_MAP:'MigrationMap',
  MIGRATION_QUARANTINE:'MigrationQurantine', RECONCILIATION:'Reconciliation', ACCESS:'_V2_ACCESS'
});

export const V2_HEADERS = Object.freeze({
  [V2_SHEETS.PRODUCT]:['productId','productCode','name','categoryId','active','minimumStock','defaultLocationId','createdAt','updatedAt'],
  [V2_SHEETS.PRODUCT_UNIT]:['productUnitId','productId','unitCode','unitName','conversionToBase','isBase','active','createdAt','updatedAt'],
  [V2_SHEETS.UNIT_CONVERSION]:['ConversionId','ProductId','FromUnitId','ToUnitId','Factor','Active','CreatedAt','UpdatedAt'],
  [V2_SHEETS.PRODUCT_PRICE]:['priceId','productUnitId','priceType','price','currency','effectiveFrom','effectiveTo','active','createdAt','updatedAt'],
  [V2_SHEETS.LOCATION]:['LocationId','LocationCode','Name','Active','CreatedAt','UpdatedAt'],
  [V2_SHEETS.PRODUCT_LOCATION]:['ProductLocationId','ProductId','LocationId','IsDefault','Active','CreatedAt','UpdatedAt'],
  [V2_SHEETS.STOCK_BALANCE]:['productId','locationId','quantityBase','updatedAt','version'],
  [V2_SHEETS.STOCK_LEDGER]:['movementId','transactionId','productId','locationId','direction','quantityBase','movementType','occurredAt','actorId','requestId','reason'],
  [V2_SHEETS.SALE]:['transactionId','requestId','actorId','shiftId','customerId','occurredAt','subtotal','discount','total','status','createdAt'],
  [V2_SHEETS.SALE_ITEM]:['saleItemId','transactionId','productId','productUnitId','sellingUnit','sellingQty','conversionToBase','baseQty','sellingPrice','subtotal','createdAt'],
  [V2_SHEETS.PAYMENT]:['paymentId','transactionId','method','amount','reference','paidAt','createdAt'],
  [V2_SHEETS.SHIFT]:['shiftId','actorId','openedAt','openingCash','status','closedAt','closingCash','createdAt','updatedAt'],
  [V2_SHEETS.REQUEST_LEDGER]:['RequestId','PayloadHash','Action','Status','TransactionId','ResultJson','ErrorCode','CreatedAt','CompletedAt'],
  [V2_SHEETS.AUDIT_LOG]:['AuditId','OccurredAt','ActorId','Action','EntityType','EntityId','RequestId','MetadataJson'],
  [V2_SHEETS.TRANSACTION_JOURNAL]:['JournalId','TransactionId','RequestId','State','PreparedAt','CommittedAt','PayloadHash','RecoveryJson'],
  [V2_SHEETS.SCHEMA_VERSION]:['Version','AppliedAt'],
  [V2_SHEETS.MIGRATION_RUN]:['RunId','StartedAt','CompletedAt','Status','Source','Target','SummaryJson'],
  [V2_SHEETS.MIGRATION_MAP]:['sourceType','sourceId','targetType','targetId','runId','createdAt'],
  [V2_SHEETS.MIGRATION_QUARANTINE]:['RunId','EntityType','SourceId','Reason','PayloadJson','CreatedAt'],
  [V2_SHEETS.RECONCILIATION]:['reconciliationId','domain','sourceKey','targetKey','status','detailsJson','checkedAt'],
  [V2_SHEETS.ACCESS]:['UserId','Email','Role','Capabilities','Active','CreatedAt','UpdatedAt']
});

export function getCanonicalSheet_(spreadsheet,name){
  const sheet=spreadsheet.getSheetByName(name);
  if(!sheet) throw new Error(`CANONICAL_SHEET_MISSING:${name}`);
  return sheet;
}
export function assertHeaders_(sheet,headers){
  const actual=sheet.getRange(1,1,1,headers.length).getValues()[0].map(String);
  if(actual.join('\u0000')!==headers.join('\u0000')) throw new Error(`CANONICAL_SCHEMA_MISMATCH:${sheet.getName()}`);
  return sheet;
}
export function ensureV2Schema(spreadsheet){
  Object.entries(V2_HEADERS).forEach(([name,headers])=>assertHeaders_(getCanonicalSheet_(spreadsheet,name),headers));
  return spreadsheet;
}
