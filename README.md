# Apotek Ana — Foundation

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

## Legacy boundary
The legacy production/development repository is reference material only. Legacy runtime code is not a dependency of this repository.

## Current status
Foundation / architecture phase. No production cutover is authorized until live Apps Script and spreadsheet schema are audited, migrated, reconciled, and validated.
