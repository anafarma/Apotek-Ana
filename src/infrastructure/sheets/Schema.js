export const V2_SHEETS = Object.freeze({
  PRODUCTS: 'Products', PRODUCT_UNITS: 'ProductUnits', PRODUCT_PRICES: 'ProductPrices',
  STOCK_BALANCE: 'StockBalance', STOCK_LEDGER: 'StockLedger', SALES: 'Sales', SALE_ITEMS: 'SaleItems',
  PAYMENTS: 'Payments', REQUEST_LEDGER: 'RequestLedger', AUDIT_LOG: 'AuditLog', TRANSACTION_JOURNAL: 'TransactionJournal',
  SCHEMA_VERSION: 'SchemaVersion', MIGRATION_RUN: 'MigrationRun', MIGRATION_QUARANTINE: 'MigrationQuarantine'
});

export const V2_HEADERS = Object.freeze({
  [V2_SHEETS.STOCK_LEDGER]: ['MovementId','TransactionId','ProductId','QuantityBase','Direction','Type','OccurredAt','ActorId','Reason'],
  [V2_SHEETS.REQUEST_LEDGER]: ['RequestId','PayloadHash','Action','Status','TransactionId','ResultJson','ErrorCode','CreatedAt','CompletedAt'],
  [V2_SHEETS.AUDIT_LOG]: ['AuditId','OccurredAt','ActorId','Action','EntityType','EntityId','RequestId','MetadataJson'],
  [V2_SHEETS.TRANSACTION_JOURNAL]: ['JournalId','TransactionId','RequestId','State','PreparedAt','CommittedAt','PayloadHash','RecoveryJson']
});

export function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

export function ensureV2Schema(spreadsheet) {
  Object.entries(V2_HEADERS).forEach(([name, headers]) => ensureSheet_(spreadsheet, name, headers));
  ensureSheet_(spreadsheet, V2_SHEETS.SCHEMA_VERSION, ['Version','AppliedAt']);
  return spreadsheet;
}
