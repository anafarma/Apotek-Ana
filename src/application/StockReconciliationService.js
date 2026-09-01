export class StockReconciliationService {
  constructor({ ledger, balance }) { this.ledger = ledger; this.balance = balance; }
  rebuild(productIds) {
    return productIds.map(productId => {
      const expected = this.ledger.calculateBalance(productId);
      const current = this.balance.getBalance(productId);
      return { productId, ledgerBalance: expected, projectedBalance: current, matched: expected === current };
    });
  }
  assertConsistent(productIds) {
    const result = this.rebuild(productIds);
    const mismatches = result.filter(x => !x.matched);
    if (mismatches.length) throw new Error(`STOCK_BALANCE_MISMATCH:${JSON.stringify(mismatches)}`);
    return result;
  }
}
