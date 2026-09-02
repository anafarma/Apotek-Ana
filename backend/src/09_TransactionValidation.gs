function afTransactionId_() {
  return 'TR' + Utilities.formatDate(new Date(), AF_CONFIG.TIMEZONE, 'yyMMddHHmmss') + Utilities.getUuid().slice(0, 8).replace(/-/g, '');
}

function afValidateCartItem_(item) {
  const product = afFindCatalogProduct_(item.productCode || item.Kode_Obat);
  if (!product) throw new Error('PRODUCT_NOT_FOUND:' + (item.productCode || item.Kode_Obat));

  const unitCode = afNormalizeText_(item.unitCode || item.satuan);
  const unit = product.units.find(u => u.code === unitCode && u.active);
  if (!unit) throw new Error('SELLING_UNIT_NOT_AVAILABLE:' + unitCode);

  const qty = afNumber_(item.qty);
  if (qty <= 0) throw new Error('INVALID_QUANTITY');

  const baseQty = qty * unit.conversionToBase;
  if (product.stockBase < baseQty) throw new Error('INSUFFICIENT_STOCK:' + product.productCode);

  return {
    product: product,
    unit: unit,
    qty: qty,
    baseQty: baseQty,
    unitPrice: unit.price,
    subtotal: qty * unit.price
  };
}

function afPrepareSale_(items) {
  if (!Array.isArray(items) || !items.length) throw new Error('EMPTY_CART');
  const validated = items.map(afValidateCartItem_);
  return {
    transactionId: afTransactionId_(),
    items: validated,
    subtotal: validated.reduce((sum, item) => sum + item.subtotal, 0)
  };
}