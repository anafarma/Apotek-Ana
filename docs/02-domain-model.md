# Canonical Domain Model

## Product aggregate
`Product`: productId, sku/code, name, categoryId, active, inventoryTrackingMode, createdAt, updatedAt.

`ProductUnit`: unitId, productId, name, symbol, isBaseUnit, canSell, canPurchase, active.

`UnitConversion`: conversionId, productId, fromUnitId, toUnitId, factor, active. Conversion graphs must be acyclic. Factor must be positive.

`ProductPrice`: priceId, productId, unitId, price, currency, effectiveFrom, effectiveTo, active.

## Inventory aggregate
`ProductBatch`: batchId, productId, batchNumber, expiryAt, receivedQtyBase, remainingQtyBase, active.

`StockLedger`: immutable movement record: ledgerId, productId, batchId, transactionId, movementType, quantityBase, stockBefore, stockAfter, actorId, occurredAt, requestId.

`StockBalance`: projection of current base quantity, optionally by batch.

## Sales aggregate
`Sale`: saleId, receiptNumber, shiftId, customerId, status, subtotal, discount, tax, total, createdAt, completedAt, actorId, requestId.

`SaleItem`: saleItemId, saleId, productId, unitId, unitNameSnapshot, qty, conversionFactorSnapshot, qtyBase, unitPriceSnapshot, priceId, subtotal.

`Payment`: paymentId, saleId, method, amount, status, createdAt.

## Other aggregates
Purchasing: Purchase, PurchaseItem, Supplier.
Operations: Shift, ShiftSummary.
Customer: Customer, CustomerLedger.
Identity: User, Role, Capability.
System: RequestLedger, AuditLog, AppConfig, SchemaVersion.

## Critical relationship
Product → ProductUnit → Price and ProductUnit → Conversion are separate relationships. Price is never derived from conversion.

## Example
Amlodipine: Strip is base unit, Box converts 10 Strip. Strip price = Rp4,000; Box price = Rp35,000. One Box sale stores qty=1, conversion=10, qtyBase=10, unitPrice=35,000.