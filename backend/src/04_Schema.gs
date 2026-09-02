const AF_SCHEMA = Object.freeze({
  Obat: {
    sheet: AF_SHEET.OBAT,
    key: 'Kode_Obat',
    required: ['Kode_Obat', 'Nama_Obat', 'Satuan', 'Stok', 'Harga_Jual', 'Aktif'],
    editable: ['Nama_Obat', 'Kategori', 'Satuan', 'Stok', 'Stok_Minimum', 'Harga_Beli', 'Harga_Jual', 'Supplier', 'Lokasi_Rak', 'Expired', 'Aktif', 'Diperbarui_Pada', 'Satuan_Beli', 'Isi_Per_Satuan_Beli', 'Satuan_Jual_2', 'Isi_Per_Satuan_2', 'Harga_Jual_2', 'Aktif_Satuan_2']
  },
  User: { sheet: AF_SHEET.USER, key: 'ID_User' },
  Shift: { sheet: AF_SHEET.SHIFT, key: 'ID_User' },
  Transaksi: { sheet: AF_SHEET.TRANSAKSI },
  Detail_Transaksi: { sheet: AF_SHEET.DETAIL_TRANSAKSI },
  Log_Stok: { sheet: AF_SHEET.LOG_STOK }
});

function afGetHeaders_(sheetName) {
  const lastColumn = afSheet_(sheetName).getLastColumn();
  if (!lastColumn) return [];
  return afSheet_(sheetName).getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
}

function afValidateSchema_(sheetName) {
  const definition = AF_SCHEMA[sheetName];
  if (!definition) return { sheet: sheetName, registered: false, valid: true, missing: [] };
  const headers = afGetHeaders_(definition.sheet);
  const missing = (definition.required || []).filter(header => headers.indexOf(header) === -1);
  return { sheet: sheetName, registered: true, valid: missing.length === 0, headers: headers, missing: missing };
}

function afSchemaHealth_() {
  const result = {};
  Object.keys(AF_SCHEMA).forEach(name => result[name] = afValidateSchema_(name));
  return result;
}