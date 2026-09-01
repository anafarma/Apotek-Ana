import { V2_SHEETS, V2_HEADERS } from './Schema.js';

export class SheetsStockLedgerRepository {
  constructor(spreadsheet) { this.ss=spreadsheet; }
  _sheet(){const s=this.ss.getSheetByName(V2_SHEETS.STOCK_LEDGER);if(!s)throw new Error('StockLedger sheet is missing');return s;}
  append(m){this._sheet().appendRow([m.movementId,m.transactionId,m.productId,m.quantityBase,m.direction,m.type,m.occurredAt,m.actorId,m.reason??'']);}
  listByProduct(productId){const s=this._sheet(),v=s.getDataRange().getValues(),h=V2_HEADERS[V2_SHEETS.STOCK_LEDGER],p=h.indexOf('ProductId');return v.slice(1).filter(r=>String(r[p])===String(productId));}
  calculateBalance(productId){return this.listByProduct(productId).reduce((n,r)=>n+(r[4]==='IN'?Number(r[3]):-Number(r[3])),0);}
}
