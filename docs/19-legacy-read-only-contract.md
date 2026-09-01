# Legacy Read-Only Contract

The existing Production spreadsheet and Apps Script remain operational and are treated as an immutable source snapshot for migration planning.

## Allowed

- read schema and headers;
- export/snapshot data;
- validate data quality;
- calculate reconciliation reports;
- build migration manifests.

## Not allowed

- changing legacy rows;
- changing legacy prices or stock;
- deleting/renaming sheets;
- adding migration columns to legacy sheets;
- changing formulas;
- changing triggers/properties;
- deploying new Production versions as part of V2 migration.

## V2 responsibility

V2 owns its own schema, configuration, ledger, request ledger, audit log, diagnostics, and migration metadata. Legacy identifiers are retained as source references during migration so reconciliation remains possible.

## Source-of-truth transition

Before cutover: legacy Production remains operational source of truth.

During migration: V2 is validated against read-only legacy snapshots.

After explicit cutover: V2 becomes operational source of truth. Legacy remains retained as an immutable historical/rollback reference according to the retention policy.
