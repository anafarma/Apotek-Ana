# V2 Delivery Gates

This is the release sequence for the clean V2 build.

## Gate 0 — Source and safety

Legacy Production snapshot exists; Production remains untouched.

## Gate 1 — Domain

Product, ProductUnit, ProductPrice, Sale, SaleItem, StockMovement and invariants have deterministic tests.

## Gate 2 — Persistence

Repositories have explicit interfaces. Spreadsheet adapters do not leak `SpreadsheetApp` into domain code.

## Gate 3 — Transaction

Sale commit has locking, durable idempotency, stock validation/reconciliation, journal/recovery handling, and audit event creation.

## Gate 4 — API

Authentication/authorization, validation, error contracts, request correlation and idempotency are enforced server-side.

## Gate 5 — Integration

Isolated V2 spreadsheet passes end-to-end tests, including concurrency and retry cases.

## Gate 6 — Migration dry run

Legacy read-only snapshot is transformed into canonical V2 data. Counts, totals, stock and exceptions reconcile.

## Gate 7 — Acceptance

POS, product/unit/price, inventory, shifts, offline sync, diagnostics and reporting acceptance suites pass.

## Gate 8 — Cutover readiness

Backup, rollback, monitoring, health diagnostics and deployment configuration are verified.

## Gate 9 — Production cutover

Only an explicit operational decision changes traffic from legacy Production to V2. No code path automatically mutates legacy Production during any earlier gate.
