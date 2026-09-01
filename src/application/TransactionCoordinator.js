import { createSale } from './sales/CreateSale.js';

/** Compatibility facade. There is exactly one canonical V2 sale path. */
export class TransactionCoordinator {
  constructor(deps, { clock = () => new Date(), hashFn = value => value } = {}) { this.deps = deps; this.clock = clock; this.hashFn = hashFn; }
  execute(command) { return createSale(command, this.deps, this.clock, this.hashFn); }
}
