# Apotek Ana — V2 Foundation

**Ana Farma Pharmacy Management System**

This repository is the clean architectural foundation for the long-term Apotek Ana application. It is intentionally isolated from the legacy `anafarma.github.io` repository.

## Mission
Build a reliable pharmacy system around auditable inventory, unit-aware sales, independent selling prices, shifts, purchasing, customers, offline-safe workflows, and Google Sheets/App Script as the initial persistence adapter.

## Architectural principle
`Product → ProductUnit → Price → Batch → StockLedger → Sale → Payment → Shift → Audit`

## Critical commercial rule
A selling unit owns its own price. Example: Strip Rp4,000 and Box (10 Strip) Rp35,000. Box price is **not** calculated as 10 × Strip price.

## Source of truth
- Business rules: `docs/05-business-rules.md`
- Canonical model: `docs/02-domain-model.md`
- Spreadsheet schema: `docs/03-database-schema.md`
- API contract: `docs/04-api-contract.md`
- Migration policy: `docs/09-migration-plan.md`
- Delivery gates: `docs/20-v2-delivery-gates.md`
- Current status: `docs/32-current-status-2026-09-01.md`

## Current implementation status
V2 now contains the deterministic domain/persistence foundation, governed V2 spreadsheet bootstrap and reconciliation tooling, a fail-closed Apps Script HTTP boundary, unit-aware Strip/Box sales acceptance harness, offline queue behavior, and automated regression coverage. The latest validated repository commit is `d01a84bf58694097ca8baf64d06f9af770def6ef`.

The repository is **not production-cutover ready**. The live Apps Script deployment and live spreadsheet still require operational validation, migration dry-run against the current source snapshot, credential reset/redaction execution, end-to-end persistence verification, and formal acceptance before any production routing change.

## Legacy boundary
The legacy production/development repository is reference material only. Legacy runtime code is not a dependency of this repository. Production remains outside the V2 governance target.

## Safety rule
No earlier V2 gate may mutate legacy Production. Production cutover requires an explicit operational decision after all release gates pass.
