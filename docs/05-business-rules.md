# Business Rules

1. A selling unit owns its own selling price.
2. Box price is never inferred from Strip price.
3. Example: Strip Rp4,000; Box of 10 Strip Rp35,000.
4. Inventory is maintained in base units.
5. One Box sale therefore decrements 10 base units in the example.
6. Sale items preserve unit, quantity, conversion factor, base quantity, price and subtotal snapshots.
7. Mixed units remain separate sale lines even when productId is identical.
8. Price history is immutable; historical sales are not repriced.
9. Active price selection is evaluated server-side at commit.
10. Negative quantity, zero quantity and invalid fractional quantity are rejected according to unit policy.
11. Stock mutation creates an immutable StockLedger record.
12. StockBalance is a projection and must be reconcilable from StockLedger.
13. Batch-controlled products use FEFO by default.
14. Every mutation has requestId, actor, timestamp and audit record.
15. Shift is required for cashier sales.
16. Payment must cover the final total before completion.
17. Client-provided price or stock is never authoritative.

## Acceptance examples
1 Box × Rp35,000 = Rp35,000 and stock -10 Strip.
2 Strip × Rp4,000 = Rp8,000 and stock -2 Strip.
1 Box + 2 Strip = Rp43,000 and stock -12 Strip.
