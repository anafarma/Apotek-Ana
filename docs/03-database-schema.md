# Spreadsheet Schema Baseline

Google Sheets is the initial persistence adapter, not the domain model.

## MASTER
- Products: productId, sku, name, categoryId, inventoryTrackingMode, active, createdAt, updatedAt
- ProductUnits: unitId, productId, name, symbol, isBaseUnit, canSell, canPurchase, active, createdAt, updatedAt
- UnitConversions: conversionId, productId, fromUnitId, toUnitId, factor, active, createdAt, updatedAt
- ProductPrices: priceId, productId, unitId, price, currency, effectiveFrom, effectiveTo, active, createdAt, createdBy
- Categories
- Suppliers
- Customers
- Users
- Roles
- Capabilities

## INVENTORY
- ProductBatches
- StockLedger
- StockBalance
- StockOpnames
- StockOpnameItems

## SALES
- Sales
- SaleItems
- Payments
- SaleReturns
- SaleReturnItems

## PURCHASING
- Purchases
- PurchaseItems

## OPERATIONS
- Shifts
- ShiftSummaries

## CUSTOMER
- CustomerLedger

## SYSTEM
- RequestLedger
- AuditLog
- AppConfig
- SchemaVersion

## Integrity policy
Every reference is validated in application code because Sheets does not provide database foreign-key constraints. IDs are stable internal identifiers. Human-readable receipt/shift numbers are separate display identifiers. All timestamps are stored canonically and displayed in Asia/Makassar.