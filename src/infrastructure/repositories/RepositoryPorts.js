/** Infrastructure contracts. Domain/application code remains SpreadsheetApp-free. */
export const repositoryPorts = Object.freeze({
  products: ['get'], units: ['getSellable'], pricing: ['getEffective'], shifts: ['assertOpen'], authorization: ['assertCanSell'],
  requestLedger: ['claim', 'get', 'complete', 'fail', 'markRecoveryRequired'], ids: ['newId', 'newReceiptNumber'], transactions: ['commitSaleAtomic']
});
export function assertRepositoryPort(name, repository) {
  const required = repositoryPorts[name]; if (!required) throw new Error('UNKNOWN_REPOSITORY_PORT');
  for (const method of required) if (typeof repository?.[method] !== 'function') throw new Error(`INVALID_REPOSITORY_PORT_${name.toUpperCase()}`);
  return true;
}
export function assertSaleDependencies(deps) { for (const name of Object.keys(repositoryPorts)) assertRepositoryPort(name, deps?.[name]); return true; }
