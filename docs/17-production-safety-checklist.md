# Production Safety Checklist

## Development isolation

- [ ] V2 uses a dedicated development spreadsheet.
- [ ] V2 uses a dedicated Apps Script project/deployment.
- [ ] V2 configuration cannot resolve to the legacy Production spreadsheet accidentally.
- [ ] Production Script ID is not present as a writable target in V2 configuration.
- [ ] Production deployment is never used for migration tests.

## Legacy data access

Legacy Production is treated as READ ONLY for V2 work. Reads may be used to build snapshots/extracts, but no V2 code may call mutating methods against the legacy spreadsheet.

Forbidden during migration preparation:

- appendRow / setValues / clear / deleteRow against legacy;
- structural sheet changes;
- changing formulas or named ranges;
- changing deployment/version;
- changing triggers or properties.

## Transaction safety

- [ ] Server re-resolves product, unit, price, and conversion.
- [ ] Request idempotency is durable.
- [ ] Stock movement is recorded in base units.
- [ ] Sale and stock movement have a deterministic transaction identity.
- [ ] Concurrent sale test passes.
- [ ] Duplicate retry test passes.
- [ ] Partial-commit recovery is tested.

## Migration safety

- [ ] Legacy snapshot retained before import.
- [ ] Migration run has a unique `migrationRunId`.
- [ ] Invalid rows are quarantined rather than silently repaired.
- [ ] Re-running migration is idempotent.
- [ ] Product counts reconcile.
- [ ] Sales counts and totals reconcile.
- [ ] Stock opening balances reconcile.
- [ ] Exceptions have an explicit report.

## Cutover

No production cutover is permitted merely because unit tests pass. Cutover requires explicit reconciliation, acceptance testing, backup retention, rollback readiness, and a deliberate deployment/routing change.
