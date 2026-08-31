# Implementation Baseline v1.0

## Scope
This document converts the architecture baseline into implementation boundaries. It is the gate before production integration.

## Repository boundaries
- `src/domain`: pure business rules; no SpreadsheetApp, DOM, fetch, or framework imports.
- `src/application`: commands, queries, orchestration, authorization and transaction policies.
- `src/contracts`: request/response contracts.
- `src/infrastructure`: Google Sheets/App Script adapters, clock, ID provider and locking.
- `src/diagnostics`: schema/data integrity checks.
- `src/offline`: IndexedDB/outbox behavior for client-safe commands.
- `tests`: unit, contract, integration and regression suites.
- `migrations`: deterministic schema changes and reconciliation utilities.

## First vertical slice
The first executable slice is unit-aware sales:
1. Resolve active product.
2. Resolve active selling unit.
3. Resolve current effective price for that unit.
4. Resolve conversion to base inventory unit.
5. Validate quantity and authorization.
6. Validate stock/batch availability.
7. Create immutable sale/item/payment snapshots.
8. Append stock movement.
9. Update stock balance projection.
10. Write request and audit records.

## Required invariants
- Selling price is never inferred from another unit's price.
- `qtyBase = qty × conversionFactor`.
- A sale item records the unit and price actually committed.
- Historical sale data is immutable.
- Stock mutations are ledger-backed.
- Duplicate `requestId` cannot create a second business transaction.
- A client-provided price is never authoritative.
- All mutation commands require server authorization.
- A failed mutation must not leave an untracked stock movement.
- Mixed units remain separate sale lines.

## Transaction boundary
Critical state is re-read after acquiring the Apps Script lock. Validation that can be performed without a lock happens first. Commit writes are minimized and are followed by reconciliation checks. Compensation is a recovery mechanism, not a substitute for deterministic mutation design.

## Spreadsheet adapter boundary
No domain or application module may import `SpreadsheetApp`. All sheet access is isolated behind repositories and transaction infrastructure. This permits a later database adapter without changing business rules.

## Definition of done
No domain feature is complete until its model, contract, authorization, persistence, audit behavior, diagnostics, tests and failure/retry behavior are covered.
