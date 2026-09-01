/**
 * Ana Farma V2 — Migration 001: zero-write legacy dry-run.
 *
 * SAFE BY DESIGN:
 * - Reads legacy sheets only.
 * - Never writes Products/ProductUnits/ProductPrices/StockBalance/StockLedger/Sales.
 * - Writes only MigrationRun + MigrationQuarantine report rows when those V2
 *   report sheets already exist (and creates them if missing).
 * - Deterministic source keys; rerunning the same snapshot does not duplicate
 *   quarantine rows for the same RunId.
 *
 * RUN: runV2LegacyMigrationDryRun()
 */

function runV2LegacyMigrationDryRun() {
  var ss = SpreadsheetApp.openById(AF_V2.spreadsheetId);
  var runId = 'MIG-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Makassar', 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0, 8);
  var started = new Date();

  var report = {
    runId: runId,
    source: ss.getName(),
    target: ss.getName(),
    mode: 'ZERO_WRITE_CANONICAL',
    products: { total: 0, safe: 0, transform: 0, quarantine: 0 },
    secondaryUnits: { active: 0, usable: 0, quarantine: 0 },
    suppliers: { distinct: 0, exact: 0, unresolved: 0 },
    locations: { distinct: 0, exact: 0, unresolved: 0 },
    stock: { total: 0, numeric: 0, negative: 0 },
    blockers: [],
    warnings: []
  };

  var qRows = [];
  var now = new Date();

  function sheet(name) {
    var sh = ss.getSheetByName(name);
    if (!sh) report.warnings.push('MISSING_SOURCE_SHEET:' + name);
    return sh;
  }

  function read(name) {
    var sh = sheet(name);
    if (!sh || sh.getLastRow() < 2) return { headers: [], rows: [] };
    var values = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()).getValues();
    var headers = values.shift().map(String);
    return { headers: headers, rows: values };
  }

  function objects(name) {
    var data = read(name);
    return data.rows.map(function(row, i) {
      var o = { __row: i + 2 };
      data.headers.forEach(function(h, j) { o[h] = row[j]; });
      return o;
    });
  }

  function norm(v) {
    return String(v == null ? '' : v).trim().replace(/\s+/g, ' ').toLowerCase();
  }

  function addQ(entityType, sourceId, reason, payload) {
    qRows.push([runId, entityType, String(sourceId || ''), reason, JSON.stringify(payload || {}), now]);
  }

  // ---- Product / unit / price / opening-stock classification ----
  var obat = objects('Obat');
  report.products.total = obat.length;
  var seenSku = {};
  obat.forEach(function(r) {
    var sku = String(r.Kode_Obat || '').trim();
    var name = String(r.Nama_Obat || '').trim();
    var baseUnit = String(r.Satuan || '').trim();
    var active2 = r.Aktif_Satuan_2 === true || norm(r.Aktif_Satuan_2) === 'true';
    var unit2 = String(r.Satuan_Jual_2 || '').trim();
    var factor2 = Number(r.Isi_Per_Satuan_2);
    var price2 = Number(r.Harga_Jual_2);
    var stock = Number(r.Stok);
    var price = Number(r.Harga_Jual);
    var rowIssues = [];

    if (!sku) rowIssues.push('PRODUCT_CODE_REQUIRED');
    if (!name) rowIssues.push('PRODUCT_NAME_REQUIRED');
    if (!baseUnit) rowIssues.push('BASE_UNIT_REQUIRED');
    if (seenSku[sku]) rowIssues.push('DUPLICATE_PRODUCT_CODE');
    seenSku[sku] = true;
    if (!Number.isFinite(stock)) rowIssues.push('STOCK_NOT_NUMERIC');
    if (Number.isFinite(stock) && stock < 0) rowIssues.push('STOCK_NEGATIVE');
    if (!Number.isFinite(price) || price < 0) rowIssues.push('BASE_PRICE_INVALID');

    if (active2) {
      report.secondaryUnits.active++;
      if (!unit2 || !Number.isFinite(factor2) || factor2 <= 0) {
        report.secondaryUnits.quarantine++;
        rowIssues.push('SECONDARY_UNIT_INVALID');
      } else if (!Number.isFinite(price2) || price2 <= 0) {
        report.secondaryUnits.quarantine++;
        rowIssues.push('SECONDARY_UNIT_PRICE_MISSING');
      } else {
        report.secondaryUnits.usable++;
      }
    }

    if (rowIssues.length) {
      report.products.quarantine++;
      rowIssues.forEach(function(code) { addQ('Product', sku || ('ROW-' + r.__row), code, r); });
    } else {
      report.products.safe++;
    }

    if (String(r.Supplier || '').trim()) {
      // supplier mapping is evaluated below against legacy Supplier master
    }
    if (String(r.Lokasi_Rak || '').trim()) {
      // location mapping is evaluated below against legacy Lokasi_Rak master
    }
  });

  report.products.transform = Math.max(0, report.products.total - report.products.safe - report.products.quarantine);

  // ---- Supplier mapping: legacy text -> deterministic exact match only ----
  var supplierRows = objects('Supplier');
  var supplierNames = {};
  supplierRows.forEach(function(r) {
    var id = String(r.ID_Supplier || '').trim();
    var name = norm(r.Nama_Supplier);
    if (name) supplierNames[name] = id;
  });
  var supplierRefs = {};
  obat.forEach(function(r) {
    var s = String(r.Supplier || '').trim();
    if (s) supplierRefs[s] = true;
  });
  report.suppliers.distinct = Object.keys(supplierRefs).length;
  Object.keys(supplierRefs).forEach(function(name) {
    if (supplierNames[norm(name)]) report.suppliers.exact++;
    else {
      report.suppliers.unresolved++;
      addQ('SupplierReference', name, 'SUPPLIER_EXACT_MAPPING_REQUIRED', { sourceName: name });
    }
  });

  // ---- Location mapping: exact code only; never invent a location ----
  var locationRows = objects('Lokasi_Rak');
  var locationCodes = {};
  locationRows.forEach(function(r) {
    var code = String(r.Kode_Lokasi || r.ID_Lokasi || r.Lokasi_Rak || r.Kode || '').trim();
    if (code) locationCodes[norm(code)] = code;
  });
  var locationRefs = {};
  obat.forEach(function(r) {
    var loc = String(r.Lokasi_Rak || '').trim();
    if (loc) locationRefs[loc] = true;
  });
  report.locations.distinct = Object.keys(locationRefs).length;
  Object.keys(locationRefs).forEach(function(loc) {
    if (locationCodes[norm(loc)]) report.locations.exact++;
    else {
      report.locations.unresolved++;
      addQ('LocationReference', loc, 'LOCATION_EXACT_MAPPING_REQUIRED', { sourceCode: loc });
    }
  });

  // ---- Opening stock: use Obat snapshot, never reconstruct from Log_Stok ----
  report.stock.total = obat.length;
  obat.forEach(function(r) {
    var n = Number(r.Stok);
    if (Number.isFinite(n)) report.stock.numeric++;
    if (Number.isFinite(n) && n < 0) report.stock.negative++;
  });
  if (report.stock.negative) report.blockers.push('NEGATIVE_OPENING_STOCK');

  // ---- Historical migration blockers from known forensic rules ----
  var detail = objects('Detail_Transaksi');
  var detailIds = {};
  detail.forEach(function(r) {
    var id = String(r.ID_Detail || '').trim();
    if (!id) return;
    detailIds[id] = (detailIds[id] || 0) + 1;
  });
  Object.keys(detailIds).forEach(function(id) {
    if (detailIds[id] > 1) {
      report.blockers.push('DUPLICATE_LEGACY_DETAIL_ID:' + id);
      addQ('SaleItem', id, 'DUPLICATE_LEGACY_DETAIL_ID', { occurrences: detailIds[id] });
    }
  });

  var stockLog = objects('Log_Stok');
  var logIds = {};
  stockLog.forEach(function(r) {
    var id = String(r.ID_Log || '').trim();
    if (!id) return;
    logIds[id] = (logIds[id] || 0) + 1;
  });
  Object.keys(logIds).forEach(function(id) {
    if (logIds[id] > 1) {
      report.blockers.push('DUPLICATE_LEGACY_STOCK_LOG_ID:' + id);
      addQ('StockMovement', id, 'DUPLICATE_LEGACY_STOCK_LOG_ID', { occurrences: logIds[id] });
    }
  });

  detail.forEach(function(r) {
    var price = Number(r.Harga_Satuan);
    if (Number.isFinite(price) && price === 0) {
      report.blockers.push('ZERO_PRICE_LEGACY:' + String(r.ID_Detail || 'ROW-' + r.__row));
      addQ('SaleItem', r.ID_Detail || ('ROW-' + r.__row), 'ZERO_PRICE_LEGACY', r);
    }
  });

  // ---- Write only migration report surfaces ----
  var runSheet = ss.getSheetByName('MigrationRun');
  if (!runSheet) {
    runSheet = ss.insertSheet('MigrationRun');
    runSheet.getRange(1, 1, 1, 7).setValues([['RunId','StartedAt','CompletedAt','Status','Source','Target','SummaryJson']]);
  }
  var qSheet = ss.getSheetByName('MigrationQuarantine');
  if (!qSheet) {
    qSheet = ss.insertSheet('MigrationQuarantine');
    qSheet.getRange(1, 1, 1, 6).setValues([['RunId','EntityType','SourceId','Reason','PayloadJson','CreatedAt']]);
  }

  var status = report.blockers.length ? 'BLOCKED' : (qRows.length ? 'REVIEW_REQUIRED' : 'READY_FOR_DRY_RUN_REVIEW');
  report.status = status;
  report.completedAt = new Date().toISOString();
  runSheet.appendRow([runId, started, new Date(), status, 'LEGACY_SNAPSHOT_IN_V2', 'V2_CANONICAL', JSON.stringify(report)]);
  if (qRows.length) qSheet.getRange(qSheet.getLastRow() + 1, 1, qRows.length, 6).setValues(qRows);

  Logger.log(JSON.stringify(report, null, 2));
  return report;
}
