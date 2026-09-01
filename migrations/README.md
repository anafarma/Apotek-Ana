# Migrations

Numbered, deterministic schema migrations are added only after the live schema audit. No production migration may run from an unreviewed migration. Every migration must declare preconditions, changes, postconditions, rollback/recovery strategy and reconciliation checks.

## Migration 001 — zero-write legacy V2 dry-run

`001_legacy_v2_dry_run.gs` provides `runV2LegacyMigrationDryRun()` for the isolated Ana Farma V2 Apps Script project.

### Safety boundary

- Reads the preserved legacy snapshot only.
- Never writes canonical business tables (`Products`, `ProductUnits`, `UnitConversions`, `ProductPrices`, `StockBalance`, `StockLedger`, `Sales`, `SaleItems`, `Payments`).
- Writes only the migration report surfaces `MigrationRun` and `MigrationQuarantine`.
- Uses deterministic source identifiers and explicit quarantine reasons.
- Uses `Obat.Stok` as the opening-balance snapshot; it does not reconstruct opening stock from the broken historical `Log_Stok` chain.
- Does not infer secondary-unit prices.
- Does not fabricate supplier or location identities.

### Run

Copy the file into the isolated V2 Apps Script project and run:

`runV2LegacyMigrationDryRun()`

The function returns and logs a structured report with product/unit/price classification, supplier/location mapping status, opening-stock metrics, and known legacy blockers.

The dry-run must remain blocked until all quarantine/blocker records are explicitly reconciled. This migration does not authorize production cutover or transaction mutation.
