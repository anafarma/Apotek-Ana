function afRequireRole_(actor, roles) {
  if (!actor) throw new Error('UNAUTHORIZED');
  const allowed = Array.isArray(roles) ? roles : [roles];
  if (allowed.indexOf(afNormalizeText_(actor.role).toUpperCase()) === -1) {
    throw new Error('FORBIDDEN_ROLE');
  }
}

function afCanManageStock_(actor) {
  return afPermissionsForRole_(actor.role).indexOf(AF_PERMISSION.MANAGE_STOCK) !== -1;
}

function afStockSnapshot_() {
  return afSellableCatalog_().map(product => ({
    productCode: product.productCode,
    name: product.name,
    stock: product.stockBase,
    minimumStock: product.minimumStock,
    status: product.stockBase <= 0 ? 'HABIS' : (product.stockBase <= product.minimumStock ? 'MENIPIS' : 'AMAN'),
    location: product.location
  }));
}