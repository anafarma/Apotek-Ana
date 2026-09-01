# ADR 005 — Atomic Idempotent Sale Commit

## Status
Accepted.

## Context
A pharmacy sale changes multiple pieces of critical state: sale header/items, payment, stock movement, request idempotency state and audit records. Network retries and concurrent cashiers make duplicate commits possible if these writes are coordinated only by client state or cache.

## Decision
The sale command uses a durable `RequestLedger` as the idempotency source of truth and executes the critical commit under the repository transaction boundary/Apps Script lock.

The protocol is:

1. Validate request shape and actor before entering the critical section where possible.
2. Acquire the critical lock.
3. Re-read request ledger by `requestId`.
4. If already committed, return the stored result without mutating business state.
5. Re-read product/unit/price and current inventory state.
6. Validate authorization, shift, price validity, conversion and stock.
7. Persist sale/payment and stock ledger changes as one logical commit.
8. Persist the durable request result and audit event.
9. Release the lock.

## Rules
- `requestId` is required for every sale mutation.
- Client price, stock and conversion values are never authoritative.
- Stock movement is expressed in base units.
- Sale lines snapshot the committed selling unit, conversion and price.
- Cache may accelerate lookup but cannot establish commit truth.
- Compensation is recovery only; normal operation must use deterministic writes.

## Consequence
The repository/infrastructure layer must expose a transaction-capable commit boundary. A simple sequence of independent sheet writes is not considered sufficient for a sale feature.
