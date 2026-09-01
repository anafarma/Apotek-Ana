# Ana Farma V2 — Current Status — 2026-09-01

## Executive status

**Repository status: GREEN for the implemented foundation; RED for production cutover.**

The V2 repository has advanced from architecture-only work into a tested application foundation. Domain rules, persistence safety, transaction coordination, spreadsheet governance, Apps Script boundary behavior, and deterministic UI acceptance behavior are represented in code and regression tests.

The live operational environment remains a separate gate. This document deliberately does not claim that the live Apps Script deployment or spreadsheet has been validated merely because repository tests pass.

## Validated in repository

- Unit-aware selling supports separate Strip and Box selling units.
- Selling-unit prices are independent; conversion never derives price.
- Box quantity is converted to base inventory quantity.
- Mixed selling units remain separate sale lines.
- Invalid quantities, insufficient stock, and insufficient payment are rejected.
- Server-side persistence uses idempotency and rejects payload conflicts.
- Request claiming is serialized with a document lock.
- Stale in-progress requests escalate to recovery instead of being silently replayed.
- Transaction journal recovery distinguishes fully committed, partial, and empty transactions.
- Stock mutation is guarded before commit and recorded through the ledger/balance protocol.
- Audit and request-ledger behavior are covered by automated tests.
- The Apps Script boundary is fail-closed for transaction mutation until live persistence integration is proven.
- The Apps Script project is bound to the isolated V2 spreadsheet, not legacy Production.
- V2 access control requires authenticated Google identity plus an explicit access-registry row.
- Governed master-data editing and reconciliation preserve a trusted shadow baseline and reject unsafe cross-row states.
- UI acceptance coverage includes Box pricing, base-unit stock validation, payment gating, offline queue persistence, partial sync failure recovery, and prevention of direct transactional-ledger editing.

## Migration blockers that remain intentionally unresolved

The live snapshot forensic report remains authoritative for migration safety. It identified, among other issues:

1. 16 duplicate legacy detail IDs.
2. 2 duplicate legacy stock-log IDs.
3. Broken historical stock-log chronology for 11 product codes.
4. Current stock differing from the last stock-log balance for 26 products.
5. 94 active secondary-unit flags with incomplete usable unit/price data.
6. No reliable historical selling-unit evidence for legacy sales.
7. 4 historical zero-price sale lines.
8. 2 completed cash transactions with payment anomalies.
9. Orphan historical product references.
10. Missing/inconsistent supplier mappings.
11. Orphan location references.
12. Incomplete shift linkage and legacy shift-total semantics.
13. Stale denormalized user names.
14. Two parallel stock-opname models.
15. Unsafe legacy credential material and password-bearing error logs.

These are not to be silently repaired during migration. They require deterministic transformation, quarantine, or explicit operational review.

## Remaining gates

### Gate 5 — Integration

Run the isolated V2 spreadsheet and Apps Script together against real test data. Verify read/write behavior, locking, idempotent retry, recovery, and concurrency in the actual Google environment.

### Gate 6 — Migration dry run

Execute a zero-write migration against the latest legacy snapshot. Produce counts, identity maps, reconciliation totals, opening-stock reconciliation, unit/price classifications, quarantine records, supplier/location mappings, and credential-redaction results.

### Gate 7 — Acceptance

Complete real-browser/UAT coverage for POS, master data, inventory, shifts, offline recovery, diagnostics, and reporting. The deterministic UI harness is a pre-UAT gate, not a substitute for real-browser acceptance.

### Gate 8 — Cutover readiness

Verify backup, rollback, monitoring, health diagnostics, deployment configuration, permissions, access registry, credential reset process, and incident/recovery procedures.

### Gate 9 — Production cutover

Only after Gates 0–8 pass may an explicit operational decision change traffic from legacy Production to V2.

## Important operational boundary

No repository change in this phase authorizes mutation of legacy Production. The V2 bootstrap is non-destructive, legacy sheets are preserved, and transaction mutation remains disabled at the Apps Script HTTP boundary until the live persistence integration gate passes.

## Validation evidence

The repository's latest validated commit before this status-document update was `d01a84bf58694097ca8baf64d06f9af770def6ef`. Its automated test workflow completed successfully with all five suites passing: domain, application, infrastructure, architecture, and UI. The workflow exercised 66 tests with 65 passing before the boundary-test assertion was corrected; after the correction, the full matrix completed successfully.

The correction itself fixed a test assumption: the spreadsheet binding is intentionally centralized in `V2Bootstrap.gs`, while `V2WebApp.gs` calls the shared `afV2Spreadsheet_()` helper. The test now validates the deployed Apps Script project as a unit rather than incorrectly requiring the `openById()` call to be duplicated in the web boundary file.

## Next action

The next engineering step is not to enable production mutation. It is to connect the isolated V2 Apps Script project to the real isolated spreadsheet, run the live health/master-data checks, and then perform a zero-write migration dry run with the quarantine and reconciliation report enabled.
