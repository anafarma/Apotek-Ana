export const V2_SHEETS = Object.freeze({
  PRODUCTS: 'Products', PRODUCT_UNITS: 'ProductUnits', UNIT_CONVERSIONS: 'UnitConversions', PRODUCT_PRICES: 'ProductPrices',
  STOCK_BALANCE: 'StockBalance', STOCK_LEDGER: 'StockLedger', SALES: 'Sales', SALE_ITEMS: 'SaleItems', PAYMENTS: 'Payments',
  REQUEST_LEDGER: 'RequestLedger', AUDIT_LOG: 'AuditLog', TRANSACTION_JOURNAL: 'TransactionJournal',
  SCHEMA_VERSION: 'SchemaVersion', MIGRATION_RUN: 'MigrationRun', MIGRATION_QUARANTINE: 'MigrationQuarantine'
});

export const V2_HEADERS = Object.freeze({
  [V2_SHEETS.PRODUCTS]: ['ProductId','Sku','Name','CategoryId','InventoryTrackingMode','Active','CreatedAt','UpdatedAt'],
  [V2_SHEETS.PRODUCT_UNITS]: ['UnitId','ProductId','Name','Symbol','IsBaseUnit','CanSell','CanPurchase','Active','CreatedAt','UpdatedAt'],
  [V2_SHEETS.UNIT_CONVERSIONS]: ['ConversionId','ProductId','FromUnitId','ToUnitId','Factor','Active','CreatedAt','UpdatedAt'],
  [V2_SHEETS.PRODUCT_PRICES]: ['PriceId','ProductId','UnitId','Price','Currency','EffectiveFrom','EffectiveTo','Active','CreatedAt','CreatedBy'],
  [V2_SHEETS.STOCK_BALANCE]: ['ProductId','QuantityBase','UpdatedAt'],
  [V2_SHEETS.STOCK_LEDGER]: ['MovementId','TransactionId','ProductId','QuantityBase','Direction','Type','OccurredAt','ActorId','Reason'],
  [V2_SHEETS.SALES]: ['TransactionId','ReceiptNumber','RequestId','RequestFingerprint','ShiftId','CustomerId','ActorId','Subtotal','Discount','Tax','Total','Paid','Change','PaymentMethod','CreatedAt'],
  [V2_SHEETS.SALE_ITEMS]: ['SaleItemId','TransactionId','ProductId','ProductName','UnitId','UnitName','Qty','ConversionFactor','QtyBase','UnitPrice','Subtotal','PriceId'],
  [V2_SHEETS.PAYMENTS]: ['PaymentId','TransactionId','Method','Amount','CreatedAt'],
  [V2_SHEETS.REQUEST_LEDGER]: ['RequestId','PayloadHash','Action','Status','TransactionId','ResultJson','ErrorCode','CreatedAt','CompletedAt'],
  [V2_SHEETS.AUDIT_LOG]: ['AuditId','OccurredAt','ActorId','Action','EntityType','EntityId','RequestId','MetadataJson'],
  [V2_SHEETS.TRANSACTION_JOURNAL]: ['JournalId','TransactionId','RequestId','State','PreparedAt','CommittedAt','PayloadHash','RecoveryJson'],
  [V2_SHEETS.SCHEMA_VERSION]: ['Version','AppliedAt'],
  [V2_SHEETS.MIGRATION_RUN]: ['RunId','StartedAt','CompletedAt','Status','Source','Target','SummaryJson'],
  [V2_SHEETS.MIGRATION_QUARANTINE]: ['RunId','EntityType','SourceId','Reason','PayloadJson','CreatedAt']
});

export function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

export function ensureV2Schema(spreadsheet) {
  Object.entries(V2_HEADERS).forEach(([name, headers]) => ensureSheet_(spreadsheet, name, headers));
  return spreadsheet;
}
