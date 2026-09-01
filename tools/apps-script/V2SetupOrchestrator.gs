/**
 * Ana Farma V2 - one-time governed spreadsheet setup.
 *
 * Run once from the V2-bound Apps Script project:
 *   setupV2GovernedSpreadsheet()
 *
 * The target is hard-bound to AF_V2.spreadsheetId. Production is never a
 * target. Legacy sheets are never renamed, deleted or cleared.
 */
function setupV2GovernedSpreadsheet() {
  const ss = SpreadsheetApp.getActive();
  if (!ss || ss.getId() !== AF_V2.spreadsheetId) {
    throw new Error('V2_SETUP_TARGET_MISMATCH: active spreadsheet is not Ana Farma V2');
  }

  const bootstrap = bootstrapV2Database();
  const masterSurfaces = ensureV2MasterSurfaces();
  const manualGovernance = installV2ManualEditGovernance();
  const repaired = repairV2MasterIdsAndAudit();
  const shadow = initializeV2MasterShadowSafe();
  const maintenance = installV2GovernanceMaintenance();

  return {
    ok: true,
    spreadsheetId: ss.getId(),
    productionTouched: false,
    bootstrap,
    masterSurfaces,
    manualGovernance,
    repaired,
    shadow,
    maintenance
  };
}
