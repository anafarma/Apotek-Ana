# Canonical sheet consolidation audit

## Verified live sheet inventory
The isolated V2 workbook contains both legacy operational sheets and V2 canonical sheets. The previous bootstrap/repository schema incorrectly used plural names for several domains even though the actual workbook's intended canonical surfaces are singular.

## Canonical V2 sheets
- Product
- ProductUnit
- ProductPrice
- UnitConversions
- Location
- ProductLocation
- StockBalance
- StockLedger
- Sale
- SaleItem
- Payment
- Shift
- RequestLedger
- TransactionJournal
- AuditLog
- SchemaVersion
- MigrationRun
- MigrationMap
- MigrationQurantine
- Reconciliation
- _V2_ACCESS

## Legacy/source sheets retained during migration
- Obat
- Lokasi_Rak
- Supplier
- User
- Pelanggan
- Transaksi
- Detail_Transaksi
- Log_Stok
- Pembelian
- Retur
- Pengajuan_Pembelian
- Pengaturan
- Stok_Opname
- Stock_Opname_Session
- Stock_Opname_Detail
- Stok opname print
- Error_Log

Legacy sheets are not deleted by code. Deletion requires migration completion, reconciliation, and dependency proof.

## Governance/support sheets
_V2_EDIT_POLICY, _V2_MASTER_SHADOW, _V2_ACCESS, _V2_MANUAL_EDIT_LOG,
_V2_DATA_AUDIT, _V2_GOVERNANCE_STATE, _V2_GOVERNANCE_RUN,
_V2_DATA_QUALITY_ISSUE, _V2_META.

## Immediate cleanup already applied to repository
The shared Node schema no longer points to Products/ProductUnits/ProductPrices/Sales/SaleItems/Payments/Shifts.
It now targets the singular canonical sheet names that exist in the workbook.

## Important unresolved compatibility issue
The Apps Script project still contains older plural-schema assumptions. It must be reconciled against the deployed workbook before enabling transaction writes. No production or legacy sheet is deleted by this audit.
