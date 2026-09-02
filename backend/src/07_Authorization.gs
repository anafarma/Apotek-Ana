const AF_ROLE = Object.freeze({
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  PEGAWAI: 'PEGAWAI',
  KASIR: 'KASIR'
});

const AF_PERMISSION = Object.freeze({
  READ_CATALOG: 'READ_CATALOG',
  TRANSACT: 'TRANSACT',
  MANAGE_STOCK: 'MANAGE_STOCK',
  MANAGE_MASTER: 'MANAGE_MASTER',
  VIEW_REPORTS: 'VIEW_REPORTS',
  MANAGE_USERS: 'MANAGE_USERS'
});

function afPermissionsForRole_(role) {
  const normalized = afNormalizeText_(role).toUpperCase();
  if (normalized === AF_ROLE.OWNER || normalized === AF_ROLE.ADMIN) {
    return Object.keys(AF_PERMISSION);
  }
  return [AF_PERMISSION.READ_CATALOG, AF_PERMISSION.TRANSACT];
}

function afRequirePermission_(actor, permission) {
  if (!actor) throw new Error('UNAUTHORIZED');
  if (afPermissionsForRole_(actor.role).indexOf(permission) === -1) {
    throw new Error('FORBIDDEN:' + permission);
  }
}