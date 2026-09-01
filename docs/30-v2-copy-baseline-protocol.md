# V2 Copy Baseline Protocol

## Status

The spreadsheet supplied by the operator is the designated V2 Development Database. It is a copy of Production and must remain non-production.

## Safety boundary

1. Production is read-only for this project.
2. The V2 copy is the only spreadsheet allowed to receive V2 schema/test writes.
3. Legacy sheets in the V2 copy are preserved; no destructive rename, delete, clear, or column rewrite is permitted by bootstrap.
4. Canonical V2 tables are separate from legacy tables.
5. Migration is staged and reversible until reconciliation passes.

## Bootstrap

`tools/apps-script/V2Bootstrap.gs` provides two functions:

- `bootstrapV2Database()` creates/repairs only missing canonical V2 sheets and records metadata.
- `auditLegacyWorkbook()` scans non-V2 sheets for row/column counts, headers, blank rows, duplicate first-column keys, and formula-cell counts.

The bootstrap does not delete or rewrite legacy data.

## Migration gate

No migration is considered successful until all of the following pass:

- source row counts reconciled;
- primary/business keys unique where required;
- foreign keys resolved or quarantined;
- unit conversion known and valid;
- prices valid and unit-specific;
- stock balances reconcile with ledger movements;
- transaction headers reconcile with detail rows;
- monetary totals reconcile;
- dates normalize without losing the source value;
- quarantine is zero for records in the release scope;
- repeat migration produces no duplicate target records;
- production remains untouched.

## Important unit rule

Selling price belongs to the selling unit. A BOX price must not be calculated from STRIP price. Conversion affects stock/base quantity, not the selling price.

Example:

- STRIP: conversion 1, price 4,000
- BOX: conversion 10, price 35,000

One BOX therefore produces base quantity 10 and subtotal 35,000.

## Current limitation

The Google Sheets document URL is known, but this execution environment cannot directly fetch private Google Sheets contents. Therefore no claim is made that the live workbook has already been audited or modified. The bootstrap is prepared for execution inside the V2 spreadsheet itself, after which its audit output becomes the authoritative workbook-level evidence.
