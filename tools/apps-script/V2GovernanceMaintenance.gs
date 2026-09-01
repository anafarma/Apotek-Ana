/**
 * Ana Farma V2 - governance maintenance and trust boundary.
 *
 * Master sheets are an approved administrative interface. Transactional and
 * ledger sheets remain application-owned. Invalid master data is never
 * silently inferred or converted into a business transaction.
 *
 * INSTALL ONCE IN THE V2 SPREADSHEET:
 *   installV2GovernanceMaintenance()
 */

const AF_GOV_MAINT = {
  spreadsheetId: '1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo',
  stateSheet: '_V2_GOVERNANCE_STATE',
  runSheet: '_V2_GOVERNANCE_RUN',
  intervalMinutes: 15
};

function installV2GovernanceMaintenance() {
  const ss = SpreadsheetApp.getActive();
  if (!ss || ss.getId() !== AF_GOV_MAINT.spreadsheetId) {
    throw new Error('GOVERNANCE_TARGET_MISMATCH: run only from Ana Farma V2');
  }
  v2GovEnsureSheet_(ss, AF_GOV_MAINT.stateSheet, ['key','value','updatedAt']);
  v2GovEnsureSheet_(ss, AF_GOV_MAINT.runSheet, ['runId','startedAt','finishedAt','status','issues','changed','message']);

  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'runV2GovernanceCycle') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('runV2GovernanceCycle').timeBased().everyMinutes(AF_GOV_MAINT.intervalMinutes).create();
  return {installed:true, spreadsheetId:ss.getId(), intervalMinutes:AF_GOV_MAINT.intervalMinutes};
}

function runV2GovernanceCycle() {
  const ss = SpreadsheetApp.openById(AF_GOV_MAINT.spreadsheetId);
  const runId = Utilities.getUuid();
  const started = new Date();
  const runSheet = v2GovEnsureSheet_(ss, AF_GOV_MAINT.runSheet, ['runId','startedAt','finishedAt','status','issues','changed','message']);
  runSheet.appendRow([runId, started, '', 'RUNNING', '', '', '']);
  try {
    // Safe ID generation is limited to missing IDs on canonical master rows.
    const repair = repairV2MasterIdsAndAudit();
    const reconciliation = reconcileV2MasterData();
    const invariant = repairV2MasterIdsAndAudit();
    const issueCount = Number(reconciliation.issues || 0) + Number(invariant.issues || 0);
    const status = issueCount === 0 ? 'TRUSTED' : 'DEGRADED';

    const state = v2GovEnsureSheet_(ss, AF_GOV_MAINT.stateSheet, ['key','value','updatedAt']);
    v2GovSetState_(state, 'masterDataTrust', status);
    v2GovSetState_(state, 'lastRunId', runId);
    v2GovSetState_(state, 'lastRunAt', new Date().toISOString());
    v2GovSetState_(state, 'lastIssueCount', issueCount);
    v2GovSetState_(state, 'manualSpreadsheetEditsSupported', 'TRUE');
    v2GovSetState_(state, 'transactionalSheetsManualWritePolicy', 'BLOCKED');

    const finished = new Date();
    runSheet.getRange(runSheet.getLastRow(),1,1,7).setValues([[runId,started,finished,status,issueCount,reconciliation.changed || 0,'Master reconciliation completed']]);
    return {ok:issueCount===0,status,runId,repair,invariant,reconciliation};
  } catch (err) {
    const finished = new Date();
    runSheet.getRange(runSheet.getLastRow(),1,1,7).setValues([[runId,started,finished,'ERROR','', '', String(err && err.message || err)]]);
    const state = v2GovEnsureSheet_(ss, AF_GOV_MAINT.stateSheet, ['key','value','updatedAt']);
    v2GovSetState_(state, 'masterDataTrust', 'UNKNOWN');
    v2GovSetState_(state, 'lastRunId', runId);
    v2GovSetState_(state, 'lastRunAt', finished.toISOString());
    throw err;
  }
}

function v2GovSetState_(sheet, key, value) {
  const values = sheet.getLastRow() > 1 ? sheet.getRange(2,1,sheet.getLastRow()-1,3).getValues() : [];
  for (let i=0;i<values.length;i++) {
    if (String(values[i][0]) === key) {
      sheet.getRange(i+2,2,1,2).setValues([[String(value),new Date()]]);
      return;
    }
  }
  sheet.appendRow([key,String(value),new Date()]);
}

function v2GovEnsureSheet_(ss,name,headers) {
  let sh=ss.getSheetByName(name);
  if(!sh)sh=ss.insertSheet(name);
  if(sh.getLastRow()===0)sh.getRange(1,1,1,headers.length).setValues([headers]);
  return sh;
}
