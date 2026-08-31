# Data Integrity Rules v1.0

These checks must run before migration and periodically in production.

## Master data
- Product IDs unique.
- Unit IDs unique.
- ProductUnit.productId must exist.
- ProductUnit.baseUnitId must resolve to a valid unit.
- Active selling units require a valid conversion path to base.
- Active prices require product, unit, non-negative price and valid effective period.
- At most one active effective price may apply to the same product/unit/time unless an explicit pricing priority exists.

## Inventory
- Ledger quantity is non-zero and base-unit based.
- No committed sale may have negative resulting stock.
- StockBalance must reconcile with StockLedger.
- Batch references must resolve when batch tracking is enabled.
- Expired batch selection is prohibited by default.

## Sales
- SaleItem references an existing product and selling unit.
- Historical price and conversion snapshots are immutable.
- `qtyBase = qty * conversionFactor`.
- Total equals the sum of line subtotals after server-side pricing.
- Payment total must equal sale total under the current single-payment policy.

## System
- requestId is unique per command scope.
- Audit records require actorId, requestId, target and timestamp.
- SchemaVersion is monotonic.
- Unknown enum/status values are rejected.
