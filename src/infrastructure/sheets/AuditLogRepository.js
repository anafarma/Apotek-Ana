import { V2_SHEETS, V2_HEADERS } from './Schema.js';

export class SheetsAuditLogRepository {
  constructor(spreadsheet){this.ss=spreadsheet;}
  append(event){
    if(!event.auditId||!event.occurredAt||!event.actorId||!event.action||!event.entityType||!event.entityId) throw new Error('Incomplete audit event');
    this.ss.getSheetByName(V2_SHEETS.AUDIT_LOG).appendRow([event.auditId,event.occurredAt,event.actorId,event.action,event.entityType,event.entityId,event.requestId??'',JSON.stringify(event.metadata??{})]);
  }
}
