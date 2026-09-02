function afBool_(value) {
  return value === true || String(value).toUpperCase() === 'TRUE';
}

function afNumber_(value, fallback) {
  const normalized = String(value == null ? '' : value).replace(/\./g, '').replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : (fallback == null ? 0 : fallback);
}

function afSellableCatalog_() {
  return afReadObjects_(AF_SHEET.OBAT)
    .filter(row => afBool_(row.Aktif))
    .map(row => {
      const basePrice = afNumber_(row.Harga_Jual);
      const baseUnit = afNormalizeText_(row.Satuan);
      const secondaryActive = afBool_(row.Aktif_Satuan_2);
      const secondaryUnit = afNormalizeText_(row.Satuan_Jual_2);
      const secondaryContent = afNumber_(row.Isi_Per_Satuan_2);
      const secondaryPrice = afNumber_(row.Harga_Jual_2);

      const units = [{
        code: baseUnit,
        name: baseUnit,
        conversionToBase: 1,
        price: basePrice,
        active: true
      }];

      if (secondaryActive && secondaryUnit && secondaryContent > 1 && secondaryPrice > 0) {
        units.push({
          code: secondaryUnit,
          name: secondaryUnit,
          conversionToBase: secondaryContent,
          price: secondaryPrice,
          active: true,
          savingsVsBase: Math.max(0, (basePrice * secondaryContent) - secondaryPrice)
        });
      }

      return {
        productId: afNormalizeText_(row.Kode_Obat),
        productCode: afNormalizeText_(row.Kode_Obat),
        name: afNormalizeText_(row.Nama_Obat),
        category: afNormalizeText_(row.Kategori),
        stockBase: afNumber_(row.Stok),
        minimumStock: afNumber_(row.Stok_Minimum),
        location: afNormalizeText_(row.Lokasi_Rak),
        units: units
      };
    });
}

function afFindCatalogProduct_(productCode) {
  return afSellableCatalog_().find(p => p.productCode === afNormalizeText_(productCode)) || null;
}