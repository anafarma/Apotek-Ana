# Legacy Audit Findings — 2026-08-31 Snapshot

## Scope
This record captures the architectural findings from the Production and Development Apps Script snapshots and the decisions for the V2 rebuild. Legacy runtime code remains reference material only.

## Snapshot inventory
- Production: `appsscript.json`, `Kode.js`, `Setupsheets.js`.
- Development: `appsscript.json`, `Kode.js`, `Setupsheets.js`, `OfflineSync.js`, `DiagnosticV3.gs.js`, `SalesEngine.V3.js`.
- Development `Kode.js` is materially larger than Production; the three additional modules are Development-only.
- `SalesEngine.V3.js` is only a placeholder-sized file and must not be treated as an implemented sales engine without source verification.

## Findings
### F1 — Unit-aware pricing is a valid business rule
Selling price belongs to the selling unit and is independent of conversion. Example: Strip Rp4,000 and Box (10 Strip) Rp35,000. V2 models this as `ProductUnit` + `ProductPrice` + `UnitConversion`.

**Decision:** KEEP the business rule; REPLACE the legacy `*_2` schema pattern.

### F2 — Historical sale lines must snapshot commercial facts
A committed line must retain selling unit, unit name, quantity, conversion factor, base quantity, unit price and price identity. This prevents later master-data changes from rewriting historical sales.

**Decision:** KEEP and make immutable in V2.

### F3 — Server authority is mandatory
Client-calculated price, stock balance and conversion are advisory inputs only. The application layer must resolve product, selling unit, conversion and effective price on the server before commit.

**Decision:** V2 server is authoritative.

### F4 — Idempotency cannot depend on cache
A cache can accelerate duplicate detection but cannot be the transactional source of truth. `RequestLedger` is the durable idempotency record and must participate in the commit protocol.

**Decision:** DURABLE REQUEST LEDGER + cache only as optional optimization.

### F5 — Offline synchronization needs an outbox contract
Offline commands require stable request IDs, payload identity, retry state and deterministic server handling. A retried command must not create a second sale or stock movement.

**Decision:** KEEP the offline direction; formalize it around an outbox/request-ledger protocol.

### F6 — Inventory must be ledger-first
Stock balance is a projection. Every committed movement is represented by an immutable ledger entry in base units, with transaction/request/actor context.

**Decision:** V2 ledger is authoritative; balance is derived/reconciled.

### F7 — Audit logs and operational logs are different
Retention of operational/error logs must never silently delete the financial/business audit trail.

**Decision:** Separate append-only `AuditLog` from bounded operational/debug/error logs.

### F8 — Monolithic runtime code is not the V2 boundary
The legacy runtime concentrates routing, validation, business logic and persistence concerns. V2 splits presentation, application, domain, repository and infrastructure responsibilities.

**Decision:** REBUILD boundaries; do not split legacy mechanically and call it V2.

## Migration gate
No legacy code is promoted to V2 solely because it exists in Development. Promotion requires: business-rule fit, domain isolation, authorization coverage, idempotency behavior, persistence contract, audit behavior, diagnostics and tests.

## V2 target
`Product → ProductUnit → ProductPrice → ProductBatch → StockLedger → Sale → Payment → Shift → Audit`.

The canonical model is defined in `docs/02-domain-model.md`; implementation boundaries are defined in `docs/11-implementation-baseline.md`.
