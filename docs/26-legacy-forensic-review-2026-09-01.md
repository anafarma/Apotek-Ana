# Legacy Forensic Review — Production vs Development Kode.js

Date: 2026-09-01

## Executive verdict

Development is materially safer for sales because `createTransaksi` routes to `createTransaksiV2`, which resolves selling unit and price from the server-side product master, converts selling quantity into base stock quantity, aggregates duplicate products, and records requestId/payloadHash. Production `createTransaksi` accepts a client-provided `hargaSatuan` and directly mutates stock and several related sheets.

Neither legacy implementation is the final V2 transaction engine: Google Sheets writes are not a database transaction; legacy idempotency uses a sheet plus cache; and multiple mutation families still directly change operational stock before their corresponding history/audit write.

## Authentication and authorization

`cocokkanPassword_`, `getUserByUsername`, `getUserById`, `login`, `gantiPassword`, and `withUser` form the security boundary. `withUser` reloads the user, checks active status, applies Owner-only restrictions, applies the shift/GPS gate and acquires a script lock. The important weakness is that the caller supplies `idUser`; this must not be treated as cryptographic authentication in V2. V2 needs a server-verifiable session/token boundary and explicit per-action authorization.

## Routing and API

`doGet`, `doPost`, `routeGet`, `routePost`, `isMutatingAction`, `jsonOutput`, and `logError` form the REST-like Apps Script surface. Development carries `requestId` into the transaction path and uses CacheService around the request. Cache is useful for fast duplicate responses but must never be the durable source of truth for idempotency.

## Shift and GPS

`haversineMeter`, `getShiftStatus`, `mulaiShift`, and `selesaiShift` implement the shift gate. Non-Owner users with `Wajib_GPS` must have an active shift for sales, cancellation, stock adjustment, purchase, return and stock opname. `getShiftStatus` scans backwards for an active row. V2 must add an explicit invariant: one user cannot have two active shifts. Shift open/close should be idempotent and auditable.

## Product, unit and price

Development's `normalisasiSatuanJual_` and `resolveSatuanJual_` are valuable business logic. The primary selling unit uses factor 1; the alternate selling unit uses `Isi_Per_Satuan_2`; the alternate price is independently read from `Harga_Jual_2`. This correctly supports a BOX price that differs from ten STRIP prices.

V2 must snapshot `sellingUnit`, `sellingQuantity`, `conversion`, `baseQuantity`, and `sellingPrice` in each sale item. Client price/conversion must never be authoritative.

## Production createTransaksi

Production validates all products and stock before writes, calculates subtotal and obtains a transaction ID. It then directly decrements `Obat.Stok`, writes `Log_Stok`, writes `Detail_Transaksi`, updates customer points/total spending, and appends `Transaksi`. The implementation explicitly accepts `it.hargaSatuan` when supplied.

Critical findings:

1. validation and writes are not one atomic transaction;
2. client price can affect revenue;
3. stock is changed before all other writes are guaranteed;
4. customer loyalty is another mutable write coupled to the sale;
5. legacy detail storage does not inherently preserve selling-unit semantics unless the later columns are present;
6. `nextId` is an identifier generator, not a durable idempotency mechanism.

Disposition: REPLACE persistence/orchestration; preserve business intent only after formalizing invariants.

## Development createTransaksiV2

Development routes the public `createTransaksi` action to `createTransaksiV2`. It limits item count, processes requestId, canonicalizes payload for hashing, detects request reuse, resolves selling unit and price server-side, converts to base quantity, aggregates stock demand per product, validates stock, computes totals, writes enhanced sale details, updates stock and shift total, then marks offline request synced.

Strengths:

- server-authoritative price and conversion;
- explicit base-unit inventory model;
- duplicate-product aggregation;
- durable offline request record;
- historical selling-unit fields;
- human-readable shift date display.

Remaining risks:

1. Request ledger and business writes are separate sheet mutations.
2. Failure between writes can create partial state.
3. `Obat.Stok` remains mutable canonical state instead of a ledger-derived projection.
4. Customer and shift totals are mutable denormalized projections.
5. Offline request state must be consolidated into V2 `RequestLedger` and resolved under the same transaction lock.

Disposition: KEEP domain rules and validation; REWRITE persistence coordinator.

## Stock mutation paths

`adjustStok` reads current stock, calculates a new balance, writes the balance and then writes `Log_Stok`. `tulisLogStok` is useful evidence but is not a canonical append-only ledger because it follows the balance mutation and has no transaction state.

V2 must represent every stock movement in base units through `StockLedger`, with `StockBalance` as a projection. Direct arbitrary balance edits must be eliminated.

## Cancellation

`batalkanTransaksi` prevents repeat cancellation, applies an Owner rule for older transactions, reads details, adds quantities back to current stock, writes a cancellation stock log and marks the sale cancelled. This is another multi-write sequence. V2 should implement cancellation as an immutable compensating movement/event and make the operation idempotent.

## Purchasing and approval

`addPembelian` converts purchase quantity into stock quantity and writes purchase plus stock/log changes. Development also separates employee purchase requests from Owner approval: a request can remain pending without immediately changing stock, and approval sets approved purchase/sale prices and then adds stock. Preserve this workflow, but route its stock effect through the ledger/journal transaction coordinator.

## Returns

`addRetur` is stock-affecting. V2 must use typed ledger movements linked to the source transaction and return status/reason rather than arbitrary balance edits.

## Stock opname

`simpanStokOpname` reconciles system stock with physical count. V2 should preserve the immutable observation (`systemQty`, `physicalQty`, difference, actor, timestamp, reason) and create a calculated adjustment movement instead of overwriting history.

## Offline sync

`OfflineSync.js` persists requestId, payload hash, status, transaction ID, result and error and explicitly requires requestId for offline transaction sync. The canonical payload hashing is a strong concept. However, offline storage is not transaction atomicity. The browser queue is a transport concern; the server-side `RequestLedger` is authoritative.

## Maintenance / retention

Production has `onOpen`, `onEdit` and a weekly log cleanup trigger. Canonical V2 `AuditLog`, `StockLedger` and `TransactionJournal` must not be pruned as ordinary operational logs. Retention of debug/error logs must be separate from financial/inventory/audit history.

## Mutation inventory

| Mutation | Finding | V2 disposition |
|---|---|---|
| createTransaksi | client price + multi-write stock/sale | REWRITE coordinator |
| createTransaksiV2 | better rules, still legacy persistence | KEEP rules, REWRITE persistence |
| batalkanTransaksi | direct stock reversal + status write | compensating transaction |
| adjustStok | direct balance then log | StockLedger |
| addPembelian | direct stock mutation | StockLedger + journal |
| setujuiPengajuanPembelian | approval + stock | preserve workflow, rewrite persistence |
| addRetur | stock-affecting | typed ledger movement |
| simpanStokOpname | reconciliation mutation | immutable count + adjustment |
| mulaiShift | append active shift | invariant + idempotency + audit |
| selesaiShift | close active shift | transactional close |
| product/customer mutations | direct master writes | repository + audit |
| user mutations | direct auth master writes | stronger security model |
| settings mutation | direct config write | versioned/audited config |

## Keep / refactor / replace

### KEEP

Selling-unit selection, independent prices, base-unit stock concept, requestId/payload hashing concept, shift/GPS policy, purchase approval workflow, human-readable date handling.

### REFACTOR

Products, reports, customer points, shift totals, setup/migration, diagnostics and API routing.

### REPLACE

Direct stock mutation, CacheService as authoritative idempotency, client-authoritative price, multi-sheet sale write sequence, direct cancellation reversal, pruning canonical history, and `nextId` as transaction identity.

### REJECT as V2 foundation

`SalesEngine.V3.js` placeholder implementation; mutable `Obat.Stok` as the canonical inventory source; treating repeated `appendRow`/`setValue` operations as an ACID transaction.

## Required regression and adversarial tests

1. STRIP and BOX prices remain independent.
2. Two BOX units consume `2 * Isi_Per_Satuan_2` base units.
3. Client price cannot override master price.
4. Client conversion cannot override master conversion.
5. Duplicate product lines aggregate before stock validation.
6. Same requestId produces exactly one committed sale.
7. Same requestId with different payload is rejected.
8. Concurrent sales cannot oversell.
9. Failure after PREPARED leaves recoverable state.
10. Recovery is idempotent.
11. Cancellation cannot execute twice.
12. Stock adjustment always creates a ledger movement.
13. Stock opname creates immutable count plus adjustment.
14. Historical selling price/unit is immutable after catalog changes.
15. Offline retry after successful commit is safe.
16. One user cannot have two active shifts.
17. Unauthorized user cannot execute Owner-only actions.
18. Migration code cannot write to the legacy Production source.
