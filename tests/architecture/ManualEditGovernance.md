# Manual Spreadsheet Edit Invariants

These are acceptance invariants for the V2 spreadsheet integration.

## M01 — Master edits are first-class

An authorized owner may add/edit Product, ProductUnit, ProductPrice, Location and Supplier directly in Sheets, including multi-row paste operations.

## M02 — Transactional records are not manual mutation surfaces

Direct edits to StockLedger, StockBalance, Sale, SaleItem, Payment, RequestLedger, TransactionJournal, AuditLog and Reconciliation are detected and reported as protected-surface violations.

## M03 — Product identity is stable

Changing a product name, category, location or active flag does not change `productId`.

## M04 — Price changes are prospective

Changing a current price never changes committed SaleItem sellingPrice/subtotal.

## M05 — Unit conversion is explicit

`conversionToBase` must be a positive integer. A price ratio must never be used as a conversion factor.

## M06 — One active base unit

Each product has exactly one active base unit. Bulk edits that create zero or multiple active base units become data-quality issues.

## M07 — Location changes do not rewrite stock history

Changing ProductLocation/default location changes master metadata only. Existing StockLedger movements retain their historical location.

## M08 — Stock correction is ledger-based

Changing StockBalance directly never becomes an accepted stock adjustment. A controlled adjustment must create a StockLedger movement with actor, reason and correlation id.

## M09 — No silent repair

Invalid manual edits are reported/quarantined; the system does not silently overwrite owner data.

## M10 — Bulk edits are atomic at the validation decision level

A multi-cell paste is evaluated as one edit event/range. Every affected row is checked before the application trusts the resulting master data.

## M11 — Audit is redacted

Manual edit logs never contain passwords, tokens, secrets, cookies, authorization headers or credential values.

## M12 — Deletion is detectable

Canonical master deletion is treated as a high-risk change. The shadow/reconciliation mechanism must be able to identify a previously known row that disappears.

## M13 — System writes are distinguishable

Application writes carry a correlation/request id so reconciliation can distinguish expected system activity from unattributed manual changes.

## M14 — Legacy history is never retroactively guessed

If a legacy sale did not explicitly record selling unit/conversion, V2 keeps the historical unit as unknown rather than inferring BOX/STRIP from today's master.
