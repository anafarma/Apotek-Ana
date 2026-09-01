/**
 * Infrastructure contracts. Implementations may use Google Apps Script/Sheets,
 * but domain/application code must not depend on SpreadsheetApp.
 */
export const repositoryPorts = Object.freeze({
  products: ['get'],
  units: ['getSellable'],
  pricing: ['getEffective'],
  inventory: ['getBaseStock'],
  shifts: ['assertOpen'],
  authorization: ['assertCanSell'],
  requestLedger: ['claim', 'complete', 'fail'],
  ids: ['newId', 'newReceiptNumber'],
  transactions: ['commitSale']
});

export function assertRepositoryPort(name, repository) {
  const required = repositoryPorts[name];
  if (!required) throw new Error('UNKNOWN_REPOSITORY_PORT');
  for (const method of required) {
    if (typeof repository?.[method] !== 'function') {
      throw new Error(`INVALID_REPOSITORY_PORT_${name.toUpperCase()}`);
    }
  }
  return true;
}

export function assertSaleDependencies(deps) {
  for (const name of Object.keys(repositoryPorts)) {
    assertRepositoryPort(name, deps?.[name]);
  }
  return true;
}
