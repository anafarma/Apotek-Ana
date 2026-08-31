# Migration Plan

Legacy `anafarma.github.io` remains read-only reference material during V2 construction.

## Sequence
1. Audit live production and development Apps Script.
2. Audit actual spreadsheet tabs, headers, formulas, triggers and deployments.
3. Map legacy fields to canonical entities.
4. Build deterministic import/migration tooling.
5. Reconcile row counts, IDs, prices, units, stock and transaction totals.
6. Run parallel validation.
7. Freeze legacy writes at cutover.
8. Verify V2 against reconciliation report.
9. Switch production entry point.
10. Retain legacy as read-only archive/reference.

No destructive migration is allowed before reconciliation passes.