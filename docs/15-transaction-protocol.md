# V2 Transaction Protocol

## Scope
This protocol defines the only supported write path for a sale. Legacy `Kode.js` write paths are not part of V2.

## Client contract
Client supplies intent only:
- `requestId`
- `shiftId`
- `items[].productId`
- `items[].unitId`
- `items[].qty`
- payment intent
- optional customer/discount/tax according to role policy

Client-supplied price, conversion, stock and computed subtotal are advisory and MUST NOT be trusted.

## Server resolution
The application resolves, at commit time:
1. active product
2. sellable unit
3. conversion to base unit
4. effective price for the selected selling unit
5. shift authorization
6. cashier authorization

A sale item records both the selling-unit facts and base-unit impact. Example: 1 BOX at Rp35,000 with factor 10 records `qty=1`, `unit=BOX`, `unitPrice=35000`, `qtyBase=10`. It does not derive the box price from the strip price.

## Google Sheets commit protocol
Sheets does not provide a relational multi-table transaction. V2 therefore uses a durable transaction protocol:

1. Acquire `LockService.getScriptLock()`.
2. Re-read `RequestLedger` by `requestId` and compare fingerprint.
3. If `COMPLETED`, return the stored result; never write again.
4. If another request is `IN_PROGRESS`, reject/recover according to lease policy.
5. Re-read all affected `StockBalance` rows while the lock is held.
6. Aggregate duplicate product lines before stock validation.
7. Validate every resulting base-unit balance is non-negative.
8. Append a transaction journal row with status `PREPARED`.
9. Append `Sales`, `SaleItems`, and `Payments` rows.
10. Append immutable `StockLedger` rows using the exact base-unit deltas.
11. Recalculate/write `StockBalance` from the committed ledger result.
12. Append `AuditLog`.
13. Mark journal `COMMITTED`.
14. Mark `RequestLedger` `COMPLETED` with transaction/result references.
15. Release the lock.

If a failure occurs after `PREPARED`, recovery MUST inspect the journal before retrying. The system must never blindly replay an ambiguous request.

## Invariants
- One `requestId` maps to one logical command/result.
- One committed sale has one immutable transaction identity.
- `SaleItems.qty` is the selling-unit quantity.
- `SaleItems.qtyBase` is the inventory quantity.
- `SaleItems.unitPrice` is the price actually charged for that selling unit.
- Stock changes are ledger movements, not arbitrary balance edits.
- Audit records are append-only.
- Historical sale lines keep their price/unit/conversion snapshot even if master data later changes.
