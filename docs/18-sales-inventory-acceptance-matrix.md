# Sales & Inventory Acceptance Matrix

| Scenario | Expected result |
|---|---|
| 1 STRIP at 4,000 | sale item unit=STRIP, baseQty=1, subtotal=4,000 |
| 1 BOX at 35,000 with factor 10 | unit=BOX, baseQty=10, subtotal=35,000 |
| 2 BOX | baseQty=20, subtotal=70,000 |
| BOX price differs from 10x STRIP | BOX selling price remains 35,000 |
| zero quantity | reject |
| fractional quantity when unit is discrete | reject |
| unknown unit | reject |
| inactive price | reject |
| insufficient stock | reject; no sale commit |
| same requestId + same payload | return original result; no duplicate sale |
| same requestId + different payload | reject conflict |
| concurrent requests for same stock | serialized; never oversell |
| offline retry after successful server commit | original result returned |
| malformed legacy row | quarantine; no silent mutation |

## Historical price rule

A committed `SaleItem` stores the selling unit, conversion, and selling price used at the time of sale. Changing today's catalog price must not rewrite historical transactions.

## Inventory rule

All inventory movements are recorded in the product base unit. Selling units are presentation/transaction units and carry an explicit conversion factor.

## Cutover rule

These acceptance scenarios must pass in the isolated V2 environment before any production routing change.
