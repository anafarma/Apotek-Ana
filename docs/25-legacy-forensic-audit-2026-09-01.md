# Legacy Forensic Audit — 2026-09-01

Source basis: user-provided `AnaFarmaAudit.zip`. The archive contains 11 files: 4 Production files and 7 Development files. This report is a static/source audit; it does not modify either Apps Script project or any spreadsheet.

## Source inventory

### Production

| File | Lines | Bytes | Functions |
|---|---:|---:|---:|
| `.clasp.json` | — | 276 | — |
| `appsscript.json` | — | 205 | — |
| `Kode.js` | 2,085 | 84,231 | 76 declarations / 75 unique names |
| `Setupsheets.js` | 1,301 | 82,391 | 26 declarations / 25 unique names |

### Development

| File | Lines | Bytes | Functions |
|---|---:|---:|---:|
| `.clasp.json` | — | 276 | — |
| `appsscript.json` | — | 205 | — |
| `Kode.js` | 2,133 | 93,825 | 87 |
| `Setupsheets.js` | 1,304 | 82,431 | 26 |
| `DiagnosticV3.gs.js` | 167 | 7,117 | 2 |
| `OfflineSync.js` | 439 | 7,408 | 8 |
| `SalesEngine.V3.js` | 4 | 29 | 1 |

## Production vs Development

`Kode.js` similarity is approximately 75.9% by sequence comparison. Development contains 12 additional function names, including `createTransaksiV2`, `diagnosticPenjualanV2`, `aksiButuhShift_`, `requireValidUser_`, `resolveSatuanJual_`, `normalisasiSatuanJual_`, `formatTanggalManusiawi_`, `formatRupiah_`, `getSupplier`, `setujuiSupplier`, `tolakSupplier`, and `ensureOfflineSyncSheet_`.

Development also contains materially more request/idempotency handling: source scanning found 27 `requestId` occurrences and 6 `PayloadHash` occurrences in Development `Kode.js`, versus 6 `requestId` occurrences and no `PayloadHash` occurrence in Production `Kode.js`.

`Setupsheets.js` is approximately 99.2% similar. Development adds `SETUP_cekKesehatanSheets`.

`SalesEngine.V3.js` currently contains only a placeholder `myFunction()`. It is not a usable sales engine and must not be treated as an implemented V3 engine.

## External service surface

Production `Kode.js` references `SpreadsheetApp`, `LockService`, `CacheService`, `PropertiesService`, `ScriptApp`, `UrlFetchApp`, `DriveApp`, `Utilities`, and `ContentService`.

Development `Kode.js` references `SpreadsheetApp`, `LockService`, `CacheService`, `PropertiesService`, and `Utilities`. The reduced service surface must be understood before deciding what functionality is intentionally removed versus accidentally lost.

## Mutation-risk observations

Production `Kode.js` contains 3 `appendRow`, 8 `setValues`, 13 `getValues`, and 3 `clearContent` occurrences. Development `Kode.js` contains 3 `appendRow`, 9 `setValues`, and 15 `getValues`. Both use `LockService`; therefore locking exists but must be reviewed operation-by-operation rather than assumed to make every multi-sheet write atomic.

`Setupsheets.js` contains many `setValues` operations and a `deleteRow` path. These setup/migration functions must remain isolated from transactional runtime paths.

## Architecture decisions extracted from the audit

1. Legacy code is reference material and migration source, not V2 domain code.
2. Production is READ ONLY during V2 construction and migration preparation.
3. Development improvements are candidates for extraction only after tests prove their intended behavior.
4. `createTransaksiV2` is a high-priority legacy behavior to analyze against the new V2 transaction boundary.
5. `OfflineSync.js` is a source of requirements for durable idempotency, but the V2 RequestLedger remains the canonical design.
6. Diagnostic V3 is useful as a read-only diagnostic precedent, not as the V2 transaction engine.
7. The placeholder `SalesEngine.V3.js` is REPLACE, not KEEP.
8. Legacy setup/import routines must never be reused directly against Production during V2 migration.

## Immediate high-risk audit targets

- transaction creation and cancellation;
- stock adjustment and stock opname;
- price/unit resolution;
- requestId/PayloadHash semantics;
- CacheService usage;
- LockService scope and lock duration;
- multi-sheet write ordering;
- authentication and role enforcement;
- shift enforcement;
- date/number formatting;
- offline retry behavior;
- duplicate invoice detection;
- legacy ID generation;
- setup/import functions that can overwrite or delete data.

## Audit conclusion

The archive is sufficient to establish the complete legacy source inventory for Production and Development. The clean V2 architecture should continue separately. Legacy code should be preserved verbatim as an immutable source snapshot before any extraction/refactoring. Migration must operate from read-only snapshots and reconcile into a dedicated V2 spreadsheet.
