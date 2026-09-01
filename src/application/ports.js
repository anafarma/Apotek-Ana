// Application ports. Infrastructure adapters implement these contracts.
export const RepositoryPorts = Object.freeze({
  products: ['getProduct', 'getUnit', 'getPrice'],
  stock: ['getBalance', 'appendMovement'],
  sales: ['appendSale', 'appendSaleItems', 'appendPayment'],
  requestLedger: ['claim', 'complete', 'fail'],
  audit: ['append'],
  journal: ['prepare', 'commit', 'markRecoveryRequired', 'listRecoverable']
});

export class RepositoryError extends Error {
  constructor(message, code = 'REPOSITORY_ERROR', details = {}) {
    super(message);
    this.name = 'RepositoryError';
    this.code = code;
    this.details = details;
  }
}

export class ConflictError extends RepositoryError {
  constructor(message, details = {}) {
    super(message, 'CONFLICT', details);
    this.name = 'ConflictError';
  }
}
