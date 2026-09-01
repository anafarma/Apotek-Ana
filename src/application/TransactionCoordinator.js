import { withDocumentLock } from '../infrastructure/sheets/withLock.js';

/**
 * Transaction boundary for V2 sales.
 * All authoritative values are resolved on the server while holding the
 * spreadsheet document lock. Persistence adapters are injected so domain
 * tests never depend on SpreadsheetApp.
 */
export class TransactionCoordinator {
  constructor({ requestLedger, journal, products, stock, sales, audit, clock = () => new Date(), idFactory }) {
    this.requestLedger = requestLedger;
    this.journal = journal;
    this.products = products;
    this.stock = stock;
    this.sales = sales;
    this.audit = audit;
    this.clock = clock;
    this.idFactory = idFactory;
  }

  execute(command) {
    return withDocumentLock(() => this._executeLocked(command));
  }

  _executeLocked(command) {
    const now = this.clock();
    const claim = this.requestLedger.claim({
      requestId: command.requestId,
      payloadHash: command.payloadHash,
      action: command.action,
      createdAt: now
    });
    if (claim.status === 'COMPLETED') return JSON.parse(claim.record.ResultJson || '{}');
    if (claim.status === 'IN_PROGRESS') throw new Error('REQUEST_IN_PROGRESS');

    const transactionId = this.idFactory('TR');
    const journalId = this.idFactory('JRN');
    const plan = this._validateAndPlan(command);
    const recovery = { transactionId, requestId: command.requestId, stockMovementIds: plan.stock.map(x => x.movementId) };

    this.journal.prepare({ journalId, transactionId, requestId: command.requestId, payloadHash: command.payloadHash, preparedAt: now, recovery });
    try {
      this.sales.appendSale(plan.sale);
      this.sales.appendSaleItems(plan.items);
      if (plan.payment) this.sales.appendPayment(plan.payment);
      for (const movement of plan.stock) this.stock.appendMovement(movement);
      for (const event of plan.audit) this.audit.append(event);
      this.journal.commit(journalId, this.clock());
      this.requestLedger.complete(command.requestId, transactionId, plan.result, this.clock());
      return plan.result;
    } catch (error) {
      this.journal.markRecoveryRequired(journalId, recovery, error);
      this.requestLedger.fail(command.requestId, 'TRANSACTION_RECOVERY_REQUIRED', this.clock());
      throw error;
    }
  }

  _validateAndPlan(command) {
    if (!Array.isArray(command.items) || command.items.length === 0) throw new Error('EMPTY_CART');
    if (command.items.length > 100) throw new Error('TOO_MANY_ITEMS');
    const aggregate = new Map();
    const items = [];
    let subtotal = 0;

    for (const input of command.items) {
      const product = this.products.getProduct(input.productId);
      if (!product || !product.active) throw new Error('PRODUCT_INACTIVE_OR_NOT_FOUND');
      const unit = this.products.getUnit(product.id, input.sellingUnit);
      if (!unit || !unit.active || !Number.isSafeInteger(unit.conversion) || unit.conversion <= 0) throw new Error('INVALID_SELLING_UNIT');
      const price = this.products.getPrice(product.id, unit.id);
      if (!price || !price.active || !Number.isSafeInteger(price.amount) || price.amount < 0) throw new Error('INVALID_SELLING_PRICE');
      if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) throw new Error('INVALID_QUANTITY');
      const baseQty = input.quantity * unit.conversion;
      if (!Number.isSafeInteger(baseQty)) throw new Error('BASE_QUANTITY_OVERFLOW');
      const lineSubtotal = input.quantity * price.amount;
      if (!Number.isSafeInteger(lineSubtotal)) throw new Error('LINE_TOTAL_OVERFLOW');
      const prior = aggregate.get(product.id) || { productId: product.id, quantityBase: 0, balance: this.stock.getBalance(product.id) };
      prior.quantityBase += baseQty;
      aggregate.set(product.id, prior);
      items.push({ productId: product.id, sellingUnitId: unit.id, sellingUnit: unit.name, quantity: input.quantity, conversion: unit.conversion, quantityBase: baseQty, unitPrice: price.amount, subtotal: lineSubtotal });
      subtotal += lineSubtotal;
      if (!Number.isSafeInteger(subtotal)) throw new Error('SUBTOTAL_OVERFLOW');
    }

    for (const a of aggregate.values()) if (!Number.isSafeInteger(a.balance) || a.balance < a.quantityBase) throw new Error('INSUFFICIENT_STOCK');
    const discount = command.discount || 0;
    const tax = command.tax || 0;
    if (!Number.isSafeInteger(discount) || discount < 0 || discount > subtotal) throw new Error('INVALID_DISCOUNT');
    if (!Number.isSafeInteger(tax) || tax < 0) throw new Error('INVALID_TAX');
    const total = subtotal - discount + tax;
    const paid = command.paid === undefined ? total : command.paid;
    if (!Number.isSafeInteger(paid) || paid < total) throw new Error('INSUFFICIENT_PAYMENT');

    const transactionId = this.idFactory('TR');
    const sale = { transactionId, occurredAt: this.clock(), actorId: command.actorId, shiftId: command.shiftId || '', subtotal, discount, tax, total, paid, change: paid - total, paymentMethod: command.paymentMethod || 'Tunai' };
    const stock = [];
    for (const a of aggregate.values()) stock.push({ movementId: this.idFactory('SM'), transactionId, productId: a.productId, quantityBase: a.quantityBase, direction: 'OUT', type: 'SALE', occurredAt: sale.occurredAt, actorId: command.actorId, reason: 'Penjualan ' + transactionId });
    const audit = [{ auditId: this.idFactory('AUD'), occurredAt: sale.occurredAt, actorId: command.actorId, action: 'SALE_COMMITTED', entityType: 'Sale', entityId: transactionId, requestId: command.requestId, metadata: { itemCount: items.length, total } }];
    return { sale, items, payment: { transactionId, amount: paid, method: sale.paymentMethod }, stock, audit, result: { transactionId, subtotal, total, change: paid - total, items } };
  }
}
