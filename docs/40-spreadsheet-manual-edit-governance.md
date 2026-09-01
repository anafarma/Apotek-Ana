# Spreadsheet Manual-Edit Governance

## Decision

Google Sheets remains a supported administrative surface in V2. The owner may use the spreadsheet directly when bulk editing is materially faster than the application (for example, adding many products or moving products between rack locations).

Direct spreadsheet editing is therefore **not an exception path**. It is a first-class integration path with explicit boundaries.

## Source-of-truth rule

V2 has two categories of data:

1. **Authoritative master data**: product, unit, price, supplier, location, and other configuration data that may be edited by an authorized owner in Sheets.
2. **System-of-record transactional data**: sales, sale items, payments, stock ledger, transaction journal, request ledger, and audit log. These are application-owned and must not be edited as ordinary cells.

The application must tolerate legitimate master-data changes without requiring a migration or restart.

## Allowed direct edits

Owner-approved direct edits are allowed for:

- adding a product;
- correcting product name/category/active/minimum stock;
- adding or changing a product unit;
- changing a current selling price;
- changing product-to-location assignment;
- adding/correcting supplier and location master records;
- bulk paste/update of the above fields.

Historical sales must never be rewritten when a master price, unit, name, or location changes. SaleItem stores the historical selling unit, conversion, price, and subtotal snapshot.

## Restricted direct edits

The following sheets are application-owned and are **not** a normal manual-edit surface:

- StockLedger
- StockBalance
- Sale
- SaleItem
- Payment
- RequestLedger
- TransactionJournal
- AuditLog
- Reconciliation

A manual stock correction must use an explicit adjustment workflow. It must produce a StockLedger movement and AuditLog record; changing StockBalance alone is never considered a valid stock adjustment.

## Delete policy

Do not delete canonical master rows to remove an entity from use. Prefer `active=false` (or the equivalent lifecycle field). Deletion is treated as a high-risk manual mutation and must be detected by reconciliation.

## Validation policy

Every direct edit is evaluated after the edit. Invalid records are not silently repaired. They are surfaced as data-quality issues and excluded from application reads when they violate a hard invariant.

Hard invariants include:

- productCode is non-empty and unique;
- productUnit belongs to an existing product;
- conversionToBase is a positive integer;
- exactly one active base unit per product;
- price is finite and non-negative;
- price is attached to a valid productUnit;
- active selling units have a usable price when required by business policy;
- location references resolve;
- stock changes never originate from a manual StockBalance edit;
- transaction rows are immutable after commit;
- ledger rows are append-only.

## Manual-edit audit

An installable spreadsheet `onEdit` trigger records:

- timestamp;
- actor when Google exposes the editor identity;
- sheet and range;
- row/column bounds;
- whether the surface is allowed;
- validation status;
- a redacted change summary;
- a correlation/event id.

Passwords, tokens, secrets, cookies, authorization headers and credentials must never be written to the change log.

For multi-cell paste, `oldValue` is not reliably available from the Apps Script event. Therefore the audit records the affected range and post-edit fingerprint rather than pretending to know every previous cell value.

## Shadow baseline and reconciliation

Because Apps Script edit events cannot observe every mutation mechanism (for example script-driven writes), V2 periodically reconciles canonical master sheets against a stored fingerprint baseline. A difference is classified as:

- `EXPECTED_MANUAL_EDIT` — valid master change;
- `INVALID_MANUAL_EDIT` — violates a hard invariant;
- `SYSTEM_WRITE` — correlated with an application request;
- `UNATTRIBUTED_CHANGE` — changed without a correlating application event.

The system does not overwrite an owner edit merely to restore an old snapshot.

## Bulk-edit protocol

For a large spreadsheet edit:

1. Owner edits only approved master columns.
2. Owner does not touch ledger/transaction sheets.
3. Owner finishes the bulk paste before using the application.
4. Reconciliation runs.
5. Invalid rows appear in the data-quality report.
6. The application reads only valid canonical records.
7. Once corrected, the next reconciliation clears the issue.

This makes bulk spreadsheet work practical without weakening transactional integrity.

## Price policy

A price edit changes the price available for **future** sales. It never changes historical SaleItem values.

If price history/effective dating is required, append a new ProductPrice version rather than rewriting a price that is already referenced by committed sales.

## Unit/conversion policy

A conversion is product-specific. Never infer a BOX conversion from the price ratio. For example, if a product explicitly defines `BOX = 10 STRIP`, that conversion is valid independently of the fact that BOX may have a special price.

Legacy transactions whose selling unit was not explicitly recorded remain `LEGACY_UNKNOWN`; they are not retroactively guessed from the current master.

## Stock policy

Current stock is not a free-edit numeric field in V2. The authoritative history is StockLedger. The balance is a projection/reconciliation result.

If an owner needs to correct stock directly in Sheets, the supported mechanism is a controlled stock-adjustment surface that captures reason, actor and evidence and then posts an adjustment movement. A direct StockBalance edit is detected as an integrity violation.

## Security boundary

Google Sheet sharing/permissions remain the first authorization boundary. The V2 application additionally validates role/actor for application commands. Manual-edit audit is evidence, not a substitute for Google permissions.
