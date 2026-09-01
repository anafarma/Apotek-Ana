# V2 Persistence Implementation

The V2 persistence layer is deliberately adapter-based. Domain/application code does not import `SpreadsheetApp`.

## Components

- `Schema.js`: canonical V2 sheet names and headers.
- `StockLedgerRepository.js`: append-only stock movements and balance projection.
- `RequestLedgerRepository.js`: durable request state and idempotency result.
- `AuditLogRepository.js`: append-only audit events.
- `TransactionJournalRepository.js`: PREPARED/COMMITTED/RECOVERY_REQUIRED transaction journal.
- `withLock.js`: Google Apps Script document lock boundary.

## Transaction protocol

A sale adapter must execute under `withDocumentLock`:

1. Claim `requestId` and verify payload hash.
2. Re-read product/unit/price and current stock.
3. Validate every sale item.
4. Write `TransactionJournal=PREPARED`.
5. Write Sale/SaleItems/Payment records.
6. Append StockLedger movements.
7. Update StockBalance projection.
8. Append AuditLog.
9. Mark journal `COMMITTED`.
10. Mark RequestLedger `COMPLETED` with the deterministic result.

Any failure after PREPARED must leave a recoverable journal record. Recovery must reconcile by transaction identity rather than blindly replaying writes.

## Important limitation

Google Sheets is not a relational database and does not provide a native multi-sheet ACID transaction. The journal + document lock + idempotency protocol is therefore part of the application transaction design. It reduces duplicate/partial-write risk but does not magically provide database-level atomicity.

## Read-only legacy rule

These adapters are for the isolated V2 spreadsheet. They must never be instantiated with the legacy Production spreadsheet during migration preparation. Legacy access is a separate read-only extraction boundary.
