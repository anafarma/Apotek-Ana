/**
 * Ana Farma V2 - one-time governed spreadsheet setup.
 *
 * Run once from the V2 Apps Script project:
 *   setupV2GovernedSpreadsheet()
 *
 * The target is hard-bound to AF_V2.spreadsheetId. Production is never a
 * target. Legacy sheets are never renamed, deleted or cleared.
 *
 * This script intentionally uses openById() rather than getActive(), because
 * the backend Apps Script project may be standalone and therefore have no
 * active spreadsheet context.
 */
function setupV2GovernedSpreadsheet() {
  const ss = SpreadsheetApp.openById(AF_V2.spreadsheetId);
  const bootstrap = bootstrapV2Database();
  const masterSurfaces = ensureV2MasterSurfaces();
  const manualGovernance = installV2ManualEditGovernance();
  const repaired = repairV2MasterIdsAndAudit();
  const shadow = initializeV2MasterShadowSafe();
  const maintenance = installV2GovernanceMaintenance();

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    spreadsheetName: ss.getName(),
    productionTouched: false,
    bootstrap,
    masterSurfaces,
    manualGovernance,
    repaired,
    shadow,
    maintenance
  };
}
