# V2 Live Data Forensic Findings — Ana Farma Snapshot

## Scope

This document records a read-only forensic review of the uploaded `Ana Farma V2.xlsx` snapshot. It is evidence for migration design only. It does not authorize mutation of Production or automatic cleanup of the legacy copy.

Snapshot metadata:
- Spreadsheet: `Ana Farma V2`
- Schema bootstrap version: `2.0.0`
- Bootstrap mode: `NON_DESTRUCTIVE`
- Legacy sheets preserved: `true`
- Legacy product rows: 732
- Legacy transactions: 95
- Legacy transaction detail rows: 619
- Legacy stock-log rows: 720
- Legacy purchases: 16
- Legacy shifts: 16
- Legacy stock-opname rows: 7
- Legacy purchase requests: 13
- Legacy users: 3
- Legacy locations: 36
- Legacy suppliers: 1

## Release decision

**MIGRATION BLOCKED.** The snapshot is suitable for forensic testing but is not safe for direct bulk migration into canonical V2 without deterministic transformation/quarantine.

## Critical findings

### 1. Legacy detail primary-key collisions — BLOCKER

`Detail_Transaksi.ID_Detail` contains 16 duplicate ID occurrences. The duplicates are not duplicate business lines: in the observed cases the same ID is reused by two different products within the same transaction. Therefore migration must never use the legacy detail ID as the canonical primary key.

Required V2 behavior:
- generate a new immutable `saleItemId` per physical legacy row;
- retain the legacy ID as `legacyDetailId` evidence;
- never merge rows merely because their legacy ID matches;
- record the collision in migration diagnostics/quarantine.

### 2. Legacy stock-log primary-key collisions — BLOCKER

`Log_Stok.ID_Log` contains 2 duplicate IDs. The rows represent different stock movements. Canonical V2 must generate new movement IDs and retain the legacy ID as evidence.

### 3. Stock ledger chronology is internally broken — BLOCKER for ledger reconstruction

For 11 product codes, a later `Qty_Sebelum` does not equal the previous `Qty_Sesudah`. The arithmetic of individual rows is valid (`before + change = after`), but the chain is not continuous.

One severe example is `OB0365`, where legacy manual adjustments introduce a fractional quantity (`0.102`) and multiple contradictory manual starting values. Therefore current stock cannot be reconstructed safely from `Log_Stok` alone.

Required V2 behavior:
- treat legacy `Obat.Stok` as a point-in-time balance snapshot when necessary;
- do not synthesize a historical ledger from a broken chain;
- create a controlled opening-balance/legacy-adjustment event with provenance where appropriate;
- quarantine products whose opening balance cannot be reconciled.

### 4. Current `Obat.Stok` differs from the last stock-log balance for 26 products

For 26 products shared by `Obat` and `Log_Stok`, the last logged balance differs from the current `Obat.Stok`. This proves that a blind `SUM(Log_Stok)` migration would not reproduce the current inventory.

Required V2 behavior: reconcile against the copied `Obat.Stok` snapshot before accepting a migrated opening balance.

### 5. Active secondary selling unit is inconsistent — BLOCKER for price/unit migration

There are 94 products with `Aktif_Satuan_2 = true`, but only 41 have a secondary selling-unit name. Of those 41, only 18 have a positive secondary price. The remaining active secondary-unit records have no usable selling price.

There is also one malformed secondary-unit value (`37000`) rather than a unit label.

Required V2 behavior:
- create a secondary unit only when the unit label and conversion are valid;
- create a price only when a valid historical/current price is actually present;
- quarantine active-but-incomplete secondary units;
- never infer a BOX price from the STRIP price.

### 6. Historical sales do not carry explicit selling-unit information — BLOCKER for historical BOX/STRIP classification

`Detail_Transaksi` stores quantity and unit price but no selling-unit ID or conversion snapshot. Current master secondary prices do not match any historical detail line price in this snapshot. Consequently historical lines cannot be reliably classified as BOX versus base/strip from the available evidence.

Required V2 behavior:
- preserve historical quantity and price exactly;
- set historical selling-unit classification to `LEGACY_UNKNOWN` when evidence is insufficient;
- never retroactively label a historical line as BOX based on current master data.

### 7. Four historical sale lines have zero unit price — BLOCKER for automatic price migration

Four detail lines have `Harga_Satuan = 0` and `Subtotal = 0`, while their parent transactions are otherwise completed. There is no explicit free-item/reason field in the legacy detail schema.

Required V2 behavior: quarantine these lines or migrate them using an explicit `ZERO_PRICE_LEGACY` classification; do not silently convert zero to the current product price.

### 8. Historical transaction payment inconsistency — BLOCKER for financial reconciliation

Two completed cash transactions have `Bayar` below `Total` and `Kembali = -1000`. Arithmetic is internally consistent, but the business meaning is anomalous.

Required V2 behavior: preserve the source values and quarantine these transactions for financial review rather than rewriting payment amounts.

## High-severity findings

### 9. One historical transaction detail references a product absent from `Obat`

`OB0214` appears in a transaction and stock log but is absent from the current product master. V2 must preserve this historical entity as a tombstoned/legacy-only product reference rather than dropping the transaction.

### 10. Three purchase records reference product codes absent from `Obat`

These are products created through the legacy purchase-request flow but no longer present in the copied product master. They must be retained as historical references and reconciled separately.

### 11. Supplier master is incomplete/inconsistent

The supplier master contains only one supplier record, while `Obat.Supplier` contains 11 distinct non-empty textual values, 42 of which do not exactly match the current supplier master. Some values are formatting variants; some are suspicious/non-supplier values.

Purchase rows also contain seven missing supplier IDs and all 16 purchase rows have no `Kode_Supplier`.

Required V2 behavior: normalize known aliases only with deterministic mapping; quarantine ambiguous values; never fabricate supplier IDs.

### 12. Location master has orphan references

Three `Obat.Lokasi_Rak` references do not exist in `Lokasi_Rak` (`BLKG-3-2` twice and `BLGK-1-1` once). These require mapping/quarantine rather than silent correction.

### 13. Shift linkage is incomplete

20 transactions have a null `ID_Shift`. For the remaining transactions, temporal matching can associate most with a shift. One shift's recorded `Total_Penjualan` includes a cancelled transaction, so the legacy shift total is not equivalent to completed-sale revenue.

Required V2 behavior: retain explicit shift linkage where present; infer only as a separately marked reconciliation result; never overwrite the source value; define V2 shift totals from canonical committed sales excluding cancelled sales.

### 14. Denormalized user names are stale

The transaction `Nama_Kasir` and shift `Nama_User` values do not consistently match the current `User.Nama`. Canonical V2 must use immutable actor IDs and store display-name snapshots separately.

### 15. Two parallel stock-opname models exist

`Stok_Opname` contains 7 records while `Stock_Opname_Session` and `Stock_Opname_Detail` are empty. V2 must choose one canonical opname aggregate and treat the legacy tables as separate evidence sources, not merge them blindly.

## Security findings

### 16. Credential storage/logging is unsafe — RELEASE BLOCKER

The `User.Password_Hash` column does not contain password hashes in this snapshot; its values are credential-like plaintext. In addition, 115 `Error_Log` records contain a password field in their serialized request detail.

Required V2 behavior:
- do not migrate the legacy password field as a usable password credential;
- force credential reset/password enrollment for migrated users;
- store only a modern password verifier/hash through the authentication boundary;
- redact password, token, session and credential fields before writing any audit/error log;
- treat the legacy `Error_Log` as sensitive historical evidence, not as a safe application log feed.

### 17. GPS configuration requires validation

`Pengaturan` contains latitude/longitude values whose stored representation is unusual and whose semantics must be confirmed by the application code before migration. All current users have `Wajib_GPS = false`, and shift GPS fields are empty. V2 must validate coordinates as decimal degrees and explicitly define whether GPS is mandatory per role/user.

## Positive controls confirmed

The snapshot also contains several useful integrity properties:
- 732 product codes are unique.
- 95 transaction IDs are unique.
- 16 purchase IDs are unique.
- 16 shift IDs are unique.
- 7 stock-opname IDs are unique.
- 13 purchase-request IDs are unique.
- individual stock-log arithmetic is internally correct (`before + change = after`) for all 720 rows.
- all 619 sale-log quantities reconcile exactly to the 619 legacy detail lines by transaction and product.
- all transaction subtotal values reconcile to their detail-line subtotals.
- all transaction total values reconcile to `subtotal - discount + tax`.
- all legacy detail subtotals reconcile to `qty × unit price`.
- all stock-opname variance values reconcile to `physical - system`.
- all legacy transaction IDs referenced by sale stock logs exist.

These positive controls should become automated regression tests in V2.

## Migration classification policy

**SAFE / directly transformable:** structurally valid master records with deterministic identity and complete required fields.

**TRANSFORM:** records requiring normalization of names, units, aliases or denormalized snapshots where the mapping is deterministic and auditable.

**QUARANTINE:** ambiguous units/prices, orphan references, zero-price sales without explanation, broken historical inventory chains, suspicious supplier values, missing shift linkage, and other records that cannot be deterministically reconstructed.

**BLOCKER:** credential migration, destructive schema replacement, reuse of colliding legacy IDs, blind stock-ledger reconstruction, or any migration that changes historical financial facts.

## Next implementation gate

Before any migration write is allowed, V2 must implement:
1. deterministic legacy identity preservation;
2. migration quarantine rules matching the findings above;
3. opening-stock reconciliation against the copied `Obat.Stok` snapshot;
4. historical-sale `LEGACY_UNKNOWN` unit semantics;
5. zero-price legacy classification;
6. credential reset/redaction policy;
7. supplier/location alias mapping with quarantine;
8. automated reconciliation reports;
9. dry-run mode with zero writes to canonical business tables;
10. release gate requiring zero unresolved BLOCKER records.
