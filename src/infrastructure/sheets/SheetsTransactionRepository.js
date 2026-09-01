import { V2_SHEETS, V2_HEADERS } from './Schema.js';
import { withDocumentLock } from './withLock.js';

export class SheetsTransactionRepository {
  constructor({ spreadsheet, requestLedger, journal, ids, now = () => new Date() }) { Object.assign(this,{spreadsheet,requestLedger,journal,ids,now}); }
  commitSaleAtomic(tx) { return withDocumentLock(() => this._commit(tx)); }
  _commit(tx) {
    const r=this.requestLedger.get(tx.requestId);
    if(r?.Status==='COMPLETED') return JSON.parse(r.ResultJson||'{}');
    if(r?.Status==='RECOVERY_REQUIRED') throw new Error('REQUEST_RECOVERY_REQUIRED');
    if(r?.Status!=='IN_PROGRESS') throw new Error(`REQUEST_NOT_COMMITTABLE:${r?.Status||'MISSING'}`);

    const journalId=this.ids.newId('JRN');
    const moves=this._movements(tx);

    // All deterministic preconditions are checked before the transaction
    // journal is prepared. A business rejection such as insufficient stock
    // must become FAILED, never RECOVERY_REQUIRED, because no transactional
    // mutation has occurred yet.
    for(const m of moves) {
      const balance=this._balance(m.productId);
      if(balance<m.qtyBase) {
        const error=Object.assign(new Error(`STOCK_INSUFFICIENT:${m.productId}`),{code:'STOCK_INSUFFICIENT'});
        if(typeof this.requestLedger.fail==='function') this.requestLedger.fail(tx.requestId,error.code,this.now().toISOString());
        throw error;
      }
    }

    const recovery={transactionId:tx.transactionId,requestId:tx.requestId,saleItemCount:tx.items.length,stockMovementIds:moves.map(x=>x.id),payment:true};
    this.journal.prepare({journalId,transactionId:tx.transactionId,requestId:tx.requestId,payloadHash:tx.requestFingerprint,preparedAt:tx.createdAt,recovery});
    try {
      this._append(V2_SHEETS.SALES,this._sale(tx));
      for(const i of tx.items) this._append(V2_SHEETS.SALE_ITEMS,[this.ids.newId('SI'),tx.transactionId,i.productId,i.productName,i.unitId,i.unitName,i.qty,i.conversionFactor,i.qtyBase,i.unitPrice,i.subtotal,i.priceId]);
      this._append(V2_SHEETS.PAYMENTS,[this.ids.newId('PAY'),tx.transactionId,tx.payment.method,tx.payment.amount,tx.createdAt]);
      for(const m of moves) this._append(V2_SHEETS.STOCK_LEDGER,[m.id,tx.transactionId,m.productId,m.qtyBase,'OUT','SALE',tx.createdAt,tx.actorId,`Penjualan ${tx.receiptNumber}`]);
      this._append(V2_SHEETS.AUDIT_LOG,[this.ids.newId('AUD'),tx.createdAt,tx.actorId,'SALE_COMMITTED','Sale',tx.transactionId,tx.requestId,JSON.stringify({total:tx.total,itemCount:tx.items.length})]);
      this._refreshBalance(moves,tx.createdAt);
      this.journal.commit(journalId,this.now().toISOString());
      const result={transactionId:tx.transactionId,status:'COMPLETED',items:tx.items,total:tx.total,createdAt:tx.createdAt,change:tx.payment.amount-tx.total};
      this.requestLedger.complete(tx.requestId,tx.transactionId,result,this.now().toISOString());
      return result;
    } catch(e) {
      this.journal.markRecoveryRequired(journalId,recovery,e);
      this.requestLedger.markRecoveryRequired(tx.requestId,'TRANSACTION_RECOVERY_REQUIRED',this.now().toISOString());
      throw Object.assign(new Error('TRANSACTION_RECOVERY_REQUIRED'),{code:'TRANSACTION_RECOVERY_REQUIRED',cause:e});
    }
  }
  _movements(tx){const m=new Map();for(const i of tx.items)m.set(i.productId,(m.get(i.productId)||0)+i.qtyBase);return [...m].map(([productId,qtyBase])=>({id:this.ids.newId('SM'),productId,qtyBase}));}
  _balance(productId){const s=this.spreadsheet.getSheetByName(V2_SHEETS.STOCK_LEDGER);if(!s)throw new Error('STOCK_LEDGER_SHEET_MISSING');const h=V2_HEADERS[V2_SHEETS.STOCK_LEDGER],p=h.indexOf('ProductId'),q=h.indexOf('QuantityBase'),d=h.indexOf('Direction');let n=0;for(const r of s.getDataRange().getValues().slice(1))if(String(r[p])===String(productId)){const x=Number(r[q]);if(!Number.isSafeInteger(x)||x<0)throw new Error('CORRUPT_STOCK_LEDGER');n+=String(r[d]).toUpperCase()==='IN'?x:-x;}return n;}
  _refreshBalance(moves,at){const s=this.spreadsheet.getSheetByName(V2_SHEETS.STOCK_BALANCE);if(!s)throw new Error('STOCK_BALANCE_SHEET_MISSING');const h=V2_HEADERS[V2_SHEETS.STOCK_BALANCE],p=h.indexOf('ProductId')+1,q=h.indexOf('QuantityBase')+1,u=h.indexOf('UpdatedAt')+1;const rows=s.getDataRange().getValues();for(const m of moves){let found=false;for(let r=1;r<rows.length;r++)if(String(rows[r][p-1])===String(m.productId)){s.getRange(r+1,q).setValue(this._balance(m.productId));s.getRange(r+1,u).setValue(at);found=true;break;}if(!found)s.appendRow([m.productId,this._balance(m.productId),at]);}}
  _append(name,row){const s=this.spreadsheet.getSheetByName(name);if(!s)throw new Error(`${name}_SHEET_MISSING`);s.appendRow(row);}
  _sale(t){return[t.transactionId,t.receiptNumber,t.requestId,t.requestFingerprint,t.shiftId,t.customerId??'',t.actorId,t.subtotal,t.discount,t.tax,t.total,t.payment.amount,t.payment.amount-t.total,t.payment.method,t.createdAt];}
}
