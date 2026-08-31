/** Infrastructure ports. Implementations may use Apps Script/Sheets, but domain code must not. */
export const repositoryPorts = Object.freeze({
  products: ['get'],
  productUnits: ['get'],
  conversions: ['resolveToBase'],
  prices: ['list'],
  inventory: ['assertAvailable'],
  shifts: ['isOpen'],
  authorization: ['can'],
  requestLedger: ['find', 'record'],
  transaction: ['commitSale']
});

export function assertRepositoryPort(name, repository) {
  const required = repositoryPorts[name];
  if (!required) throw new Error('UNKNOWN_REPOSITORY_PORT');
  for (const method of required) {
    if (typeof repository?.[method] !== 'function') throw new Error(`INVALID_REPOSITORY_PORT_${name.toUpperCase()}`);
  }
  return true;
}
