# Data Migration & Cutover Policy

## Non-negotiable production rule

The legacy Production Google Apps Script and its spreadsheet are never modified during V2 development, audit, import preparation, or dry-run reconciliation.

V2 consumes a read-only snapshot/extract of legacy data. Migration is performed into a separate V2 spreadsheet/environment. Only after reconciliation, acceptance tests, and an explicit cutover decision can V2 become the active system.

## Migration pipeline

```text
Legacy Production Spreadsheet (READ ONLY)
        |
        v
Extract / Snapshot
        |
        v
Normalize -> Validate -> Quarantine invalid rows
        |
        v
Canonical V2 model
        |
        v
Dry-run reconciliation
        |
        v
Acceptance report
        |
        v
V2 data load
        |
        v
Post-load reconciliation
```

## Canonical mapping

Legacy product/unit/price fields are mapped to `Product`, `ProductUnit`, and `ProductPrice`. Sales retain the selling unit, selling price, conversion, and derived base quantity. Inventory is reconstructed as an append-only `StockLedger` and reconciled to the legacy stock snapshot.

## Immutable transaction history

A historical sale must not be rewritten to make it look like a current price. The transaction stores its selling unit and effective selling price as a snapshot. Current catalog prices remain separate.

## Invalid data

Malformed or ambiguous legacy rows are quarantined. They are never silently corrected during migration. Each quarantine record includes source sheet, source row, reason, and migration run identifier.

## Idempotent migration

Every migration run has a `migrationRunId`. Every imported entity has a deterministic source key. Re-running the same migration must not duplicate products, sales, ledger entries, or audit events.

## Cutover gates

V2 cannot be declared production-ready until:

1. schema diagnostics pass;
2. migration dry-run completes without unexplained discrepancies;
3. opening stock reconciliation passes;
4. sales totals reconcile;
5. cash/payment totals reconcile where source data supports it;
6. orphan/duplicate/invalid rows are explicitly accounted for;
7. idempotency tests pass;
8. concurrent-sale tests pass;
9. backup/export of legacy data is retained;
10. rollback procedure is tested.

## Rollback principle

Because legacy Production remains untouched, rollback during the migration phase is a routing/deployment decision, not a destructive reverse migration. Legacy remains the emergency fallback until V2 is formally accepted.
