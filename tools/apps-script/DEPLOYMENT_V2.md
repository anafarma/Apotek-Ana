# Ana Farma V2 Apps Script — Synchronization & Deployment Gate

## Important finding

The Apps Script project currently shown in the V2 spreadsheet is **not yet synchronized with the canonical `main` implementation**.

The live editor shown during the 2026-09-01 validation contains an older `V2Bootstrap.gs` schema (for example `Product.productCode`, `ProductUnit.conversionToBase`, and `ProductPrice.productUnitId`). The canonical repository version uses the current V2 schema (`Products`, `ProductUnits`, `UnitConversions`, `ProductPrices`, `StockBalance`, `StockLedger`, `Sales`, etc.).

Therefore **do not deploy the current Apps Script project yet and do not run its bootstrap against the V2 spreadsheet**. Doing so could create a schema that is inconsistent with the tested application.

## Required synchronization

Synchronize these repository files into the standalone V2 Apps Script project:

- `tools/apps-script/V2Bootstrap.gs`
- `tools/apps-script/V2WebApp.gs`
- `tools/apps-script/V2GovernanceMaintenance.gs`
- `tools/apps-script/V2ManualEditGovernance.gs`
- `tools/apps-script/V2MasterInvariantAudit.gs`
- `tools/apps-script/V2MasterReconciliation.gs`
- `tools/apps-script/V2MasterReconciliationSafe.gs`
- `tools/apps-script/V2MasterSurfaceBootstrap.gs`
- `tools/apps-script/V2SetupOrchestrator.gs`

Legacy/temporary files in the Apps Script editor must not be used as the source of truth.

## Safe execution order

1. Replace/synchronize the Apps Script files from `main`.
2. Save all files and resolve syntax errors before executing anything.
3. Run `bootstrapV2Database()` once.
4. Verify `_V2_META` reports schema version `2.0.0`, `bootstrapMode=NON_DESTRUCTIVE`, and `legacySheetsPreserved=TRUE`.
5. Run `auditLegacyWorkbook()`.
6. Run the master invariant/reconciliation diagnostics.
7. Verify that no legacy sheet was deleted, renamed, or rewritten.
8. Configure `_V2_ACCESS` with the authorized Google account and minimum required capability set.
9. Deploy the Apps Script Web App only after the above checks pass.
10. Test `GET ?action=health` and the read-only catalog/shift endpoints.
11. Do **not** enable transaction mutation until the live persistence integration gate passes.

## Production safety

- Never point this project at the Production spreadsheet.
- Never copy Production credentials into source code.
- Never enable `createTransaksiV2` merely to make the endpoint appear operational.
- Migration remains blocked until forensic reconciliation and dry-run gates pass.
