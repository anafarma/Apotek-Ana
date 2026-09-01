# Transaction Coordinator Validation

## Scope

The coordinator is an application-level transaction boundary for the isolated V2 environment. Production is not a target and is not modified by these tests.

## Verified invariants

- requestId is mandatory;
- payloadHash is mandatory;
- completed idempotent retries return the stored result;
- in-progress requests are not executed a second time;
- product must be active;
- selling unit must be active and have a positive integer conversion;
- price is resolved server-side from product + unit;
- quantity is a positive integer;
- base quantity is calculated from selling quantity × conversion;
- stock is validated in base units;
- duplicate product lines are aggregated for stock consumption;
- BOX and STRIP can have independent prices;
- payment cannot be below total;
- money/quantity arithmetic is constrained to safe integers;
- transaction, stock movement and audit identifiers are generated server-side;
- journal is prepared before persistence writes;
- failures after prepare are marked for recovery.

## Local acceptance run

The coordinator acceptance suite was executed in an isolated Node runtime. The suite passed the STRIP pricing, BOX pricing/conversion, idempotent retry, and insufficient-payment cases.

## Important release condition

This is not yet a claim of Google Sheets integration correctness. The next gate is adapter-level integration testing against a dedicated V2 spreadsheet, including duplicate/retry, partial-write simulation, recovery reconciliation, stock projection, and concurrent requests.

## Known design constraint

A journal cannot make Google Sheets ACID. Recovery must reconcile by transaction identity and existing persisted rows before replaying any operation. Blind replay is prohibited.
