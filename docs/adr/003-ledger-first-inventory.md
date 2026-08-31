# ADR-003 — Ledger First Inventory

Status: Accepted

Inventory mutations are recorded as immutable StockLedger entries. StockBalance is a projection for fast reads and can be rebuilt/reconciled from the ledger.

This prevents silent stock corruption and makes sales, purchases, returns and opname auditable.