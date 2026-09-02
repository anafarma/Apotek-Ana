function afGenerateId_(prefix) {
  return prefix + Utilities.formatDate(new Date(), AF_CONFIG.TIMEZONE, 'yyMMddHHmmss') + String(Math.floor(Math.random()*9000)+1000);
}

function afAppendObject_(sheetName, object, headers) {
  const sheet = afGetSheet_(sheetName);
  if (!sheet) throw new Error('SHEET_NOT_FOUND:' + sheetName);
  const actual = sheet.getRange(1,1,1,sheet.getLastColumn()).getValues()[0].map(String);
  const row = actual.map(h => Object.prototype.hasOwnProperty.call(object,h) ? object[h] : '');
  sheet.getRange(sheet.getLastRow()+1,1,1,row.length).setValues([row]);
}

function afCommitSale_(actor, payload) {
  afRequirePermission_(actor, AF_PERMISSION.TRANSACT);
  const requestId = afNormalizeText_(payload.requestId);
  if (!requestId) throw new Error('REQUEST_ID_REQUIRED');
  const quote = afPrepareSale_(payload.items || []);
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const requests = afReadObjects_(AF_SHEET.REQUEST_LEDGER);
    const prior = requests.find(r => afNormalizeText_(r.requestId || r.RequestId) === requestId);
    if (prior) throw new Error('DUPLICATE_REQUEST:' + requestId);

    const refreshed = afPrepareSale_(payload.items || []);
    const transactionId = refreshed.transactionId;
    const now = afNow_();
    const payment = afNumber_(payload.paymentAmount, refreshed.subtotal);
    if (payment < refreshed.subtotal) throw new Error('INSUFFICIENT_PAYMENT');

    afAppendObject_(AF_SHEET.TRANSAKSI, {
      ID_Transaksi:transactionId, Tanggal:now, ID_Kasir:actor.userId, Nama_Kasir:actor.name,
      ID_Pelanggan:payload.customerId||'', Nama_Pelanggan:payload.customerName||'',
      Subtotal:refreshed.subtotal, Diskon:0, Pajak:0, Total:refreshed.subtotal,
      Metode_Bayar:payload.paymentMethod||'Tunai', Bayar:payment, Kembali:payment-refreshed.subtotal,
      Poin_Didapat:0, Status:'Selesai', ID_Shift:(afFindActiveShift_(actor.userId)||{}).ID_Shift||'', Catatan:payload.note||''
    });

    refreshed.items.forEach(item => {
      afAppendObject_(AF_SHEET.DETAIL_TRANSAKSI, {
        ID_Detail:afGenerateId_('DT'), ID_Transaksi:transactionId,
        Kode_Obat:item.product.productCode, Nama_Obat:item.product.name,
        Qty:item.qty, Harga_Satuan:item.unitPrice, Subtotal:item.subtotal
      });
    });

    const obatSheet = afGetSheet_(AF_SHEET.OBAT);
    const values = obatSheet.getDataRange().getValues();
    const headers = values[0];
    const codeCol=headers.indexOf('Kode_Obat'), stockCol=headers.indexOf('Stok');
    refreshed.items.forEach(item => {
      const idx=values.findIndex((r,i)=>i>0 && String(r[codeCol]).trim()===item.product.productCode);
      if(idx<1) throw new Error('PRODUCT_ROW_NOT_FOUND');
      const before=afNumber_(values[idx][stockCol]);
      if(before<item.baseQty) throw new Error('INSUFFICIENT_STOCK_RECHECK');
      obatSheet.getRange(idx+1,stockCol+1).setValue(before-item.baseQty);
      afAppendObject_(AF_SHEET.LOG_STOK,{
        ID_Log:afGenerateId_('LG'),Tanggal:now,Kode_Obat:item.product.productCode,Nama_Obat:item.product.name,
        Jenis:'Penjualan',Qty_Sebelum:before,Perubahan:-item.baseQty,Qty_Sesudah:before-item.baseQty,
        Keterangan:'Transaksi '+transactionId,Oleh:actor.name,ID_Referensi:transactionId
      });
    });

    afAppendObject_(AF_SHEET.REQUEST_LEDGER,{requestId:requestId,status:'COMMITTED',transactionId:transactionId,createdAt:now});
    return {transactionId:transactionId,total:refreshed.subtotal,change:payment-refreshed.subtotal,status:'COMMITTED'};
  } finally { lock.releaseLock(); }
}