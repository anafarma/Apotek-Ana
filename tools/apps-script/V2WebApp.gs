/**
 * Ana Farma V2 - standalone Apps Script HTTP boundary.
 *
 * This file is intentionally independent from Production. It is the first
 * deployable boundary for the isolated V2 spreadsheet. It exposes read-only
 * master/shift data first; transactional mutation is enabled only after the
 * persistence integration gate is complete.
 *
 * Deployment target: the isolated V2 spreadsheet configured in V2Bootstrap.gs.
 */

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    return afJson_(afDispatchGet_(action));
  } catch (error) {
    return afError_(error);
  }
}

function doPost(e) {
  try {
    const body = afParseBody_(e);
    const action = String(body.action || '');
    if (action === 'health') return afJson_(afHealth_());
    if (action === 'getSellableCatalog') return afJson_(afGetSellableCatalog_());
    if (action === 'getOpenShift') return afJson_(afGetOpenShift_());
    if (action === 'createTransaksiV2') {
      throw afHttpError_('TRANSACTION_API_NOT_ENABLED', 'V2 transaction mutation is not enabled until the live persistence integration gate passes.');
    }
    throw afHttpError_('UNKNOWN_ACTION', `Unknown V2 action: ${action || '(empty)'}`);
  } catch (error) {
    return afError_(error);
  }
}

function afDispatchGet_(action) {
  if (action === 'health') return afHealth_();
  if (action === 'getSellableCatalog') return afGetSellableCatalog_();
  if (action === 'getOpenShift') return afGetOpenShift_();
  throw afHttpError_('UNKNOWN_ACTION', `Unknown V2 action: ${action || '(empty)'}`);
}

function afHealth_() {
  const ss = afV2Spreadsheet_();
  return {
    success: true,
    service: 'ana-farma-v2',
    status: 'READY_READ_ONLY',
    schemaVersion: AF_V2.schemaVersion,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    timestamp: new Date().toISOString()
  };
}

function afGetSellableCatalog_() {
  const actor = afCurrentActor_('SELL');
  const ss = afV2Spreadsheet_();
  const products = afRows_(ss, 'Products');
  const units = afRows_(ss, 'ProductUnits');
  const prices = afRows_(ss, 'ProductPrices');
  const conversions = afRows_(ss, 'UnitConversions');
  const now = new Date();

  const unitById = {};
  units.forEach(r => {
    if (afBool_(r.Active) && afBool_(r.CanSell)) unitById[String(r.UnitId)] = r;
  });
  const conversionByUnit = {};
  conversions.forEach(r => {
    if (afBool_(r.Active)) {
      const from = String(r.FromUnitId);
      const to = String(r.ToUnitId);
      const factor = Number(r.Factor);
      if (Number.isSafeInteger(factor) && factor > 0) conversionByUnit[from] = { factor, toUnitId: to };
    }
  });
  const priceByUnit = {};
  prices.forEach(r => {
    if (!afBool_(r.Active)) return;
    const from = r.EffectiveFrom ? new Date(r.EffectiveFrom) : new Date('1970-01-01T00:00:00Z');
    const to = r.EffectiveTo ? new Date(r.EffectiveTo) : null;
    if (from > now || (to && now >= to)) return;
    const key = `${r.ProductId}|${r.UnitId}`;
    const existing = priceByUnit[key];
    if (!existing || new Date(existing.EffectiveFrom || '1970-01-01T00:00:00Z') < from) priceByUnit[key] = r;
  });

  const stock = afStockByProduct_(ss);
  const catalog = products.filter(p => afBool_(p.Active)).map(p => {
    const sellableUnits = units.filter(u => String(u.ProductId) === String(p.ProductId) && afBool_(u.Active) && afBool_(u.CanSell)).map(u => {
      const price = priceByUnit[`${p.ProductId}|${u.UnitId}`];
      const factor = afResolveBaseFactor_(u, unitById, conversionByUnit);
      if (!price || !Number.isSafeInteger(Number(price.Price)) || Number(price.Price) < 0 || !factor) return null;
      return {
        unitId: String(u.UnitId),
        name: String(u.Name),
        symbol: String(u.Symbol || ''),
        conversionFactor: factor,
        price: Number(price.Price),
        priceId: String(price.PriceId)
      };
    }).filter(Boolean);
    return {
      productId: String(p.ProductId),
      sku: String(p.Sku || ''),
      name: String(p.Name),
      stockBase: Number(stock[String(p.ProductId)] || 0),
      units: sellableUnits
    };
  }).filter(p => p.units.length > 0);

  return { success: true, actor, products: catalog, timestamp: now.toISOString() };
}

function afGetOpenShift_() {
  const actor = afCurrentActor_('SELL');
  const ss = afV2Spreadsheet_();
  const sh = ss.getSheetByName('Shifts');
  if (!sh || sh.getLastRow() < 2) return { success: true, actor, shift: null };
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const idx = {}; headers.forEach((h, i) => idx[h] = i);
  const rows = values.slice(1).filter(r => String(r[idx.ActorId] || '') === String(actor.userId) && String(r[idx.Status] || '').toUpperCase() === 'OPEN');
  if (!rows.length) return { success: true, actor, shift: null };
  const r = rows[rows.length - 1];
  return { success: true, actor, shift: { shiftId: String(r[idx.ShiftId]), openedAt: r[idx.OpenedAt] || null, openingCash: Number(r[idx.OpeningCash] || 0) } };
}

function afCurrentActor_(capability) {
  const email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!email) throw afHttpError_('AUTHENTICATION_REQUIRED', 'Google account identity is unavailable to the Apps Script execution context.');
  const ss = afV2Spreadsheet_();
  const sh = ss.getSheetByName('_V2_ACCESS');
  if (!sh || sh.getLastRow() < 2) throw afHttpError_('AUTHORIZATION_NOT_CONFIGURED', 'V2 access registry is not configured.');
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  const idx = {}; headers.forEach((h, i) => idx[h] = i);
  const row = values.slice(1).find(r => String(r[idx.Email] || '').trim().toLowerCase() === email && afBool_(r[idx.Active]));
  if (!row) throw afHttpError_('FORBIDDEN', 'Google account is not authorized for Ana Farma V2.');
  const role = String(row[idx.Role] || '').trim();
  const capabilities = String(row[idx.Capabilities] || '').split(',').map(x => x.trim()).filter(Boolean);
  if (capability && capabilities.length && capabilities.indexOf(capability) < 0 && capabilities.indexOf('*') < 0) throw afHttpError_('FORBIDDEN', `Capability ${capability} is not granted.`);
  return { userId: String(row[idx.UserId] || email), email, role, capabilities };
}

function afRows_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(String);
  return values.slice(1).filter(r => r.some(v => v !== '' && v !== null)).map(r => {
    const o = {}; headers.forEach((h, i) => o[h] = r[i]); return o;
  });
}

function afStockByProduct_(ss) {
  const rows = afRows_(ss, 'StockLedger');
  const out = {};
  rows.forEach(r => {
    const productId = String(r.ProductId || '');
    const qty = Number(r.QuantityBase);
    if (!productId || !Number.isSafeInteger(qty) || qty < 0) return;
    const direction = String(r.Direction || '').toUpperCase();
    out[productId] = (out[productId] || 0) + (direction === 'IN' ? qty : -qty);
  });
  Object.keys(out).forEach(k => { if (out[k] < 0) out[k] = 0; });
  return out;
}

function afResolveBaseFactor_(unit, unitById, conversionByUnit) {
  if (afBool_(unit.IsBaseUnit)) return 1;
  const direct = conversionByUnit[String(unit.UnitId)];
  if (!direct) return null;
  if (unitById[direct.toUnitId] && afBool_(unitById[direct.toUnitId].IsBaseUnit)) return direct.factor;
  return null;
}

function afParseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) throw afHttpError_('INVALID_REQUEST', 'Request body is required.');
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (_) { throw afHttpError_('INVALID_JSON', 'Request body must be valid JSON.'); }
  if (!body || typeof body !== 'object') throw afHttpError_('INVALID_REQUEST', 'Request body must be an object.');
  return body;
}

function afBool_(v) { return v === true || String(v).toUpperCase() === 'TRUE' || String(v) === '1'; }
function afHttpError_(code, message) { return Object.assign(new Error(message), { code, httpStatus: code === 'FORBIDDEN' ? 403 : code === 'AUTHENTICATION_REQUIRED' ? 401 : 400 }); }
function afJson_(payload) { return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON); }
function afError_(error) { return afJson_({ success: false, error: error.code || 'INTERNAL_ERROR', message: error.message || 'Internal error.' }); }
