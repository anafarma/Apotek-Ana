/**
 * Ana Farma V2 - canonical master-data surfaces.
 * Run once in the V2 spreadsheet after V2Bootstrap.gs.
 * Non-destructive: only creates missing V2 sheets.
 */

const AF_MASTER_SURFACES = {
  spreadsheetId: '1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo',
  sheets: {
    Location: ['locationId','locationCode','name','active','createdAt','updatedAt'],
    Supplier: ['supplierId','supplierCode','name','active','createdAt','updatedAt'],
    ProductLocation: ['productLocationId','productId','locationId','isDefault','active','createdAt','updatedAt']
  }
};

function ensureV2MasterSurfaces() {
  const ss = SpreadsheetApp.openById(AF_MASTER_SURFACES.spreadsheetId);
  const created = [];
  Object.keys(AF_MASTER_SURFACES.sheets).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      created.push(name);
    }
    const headers = AF_MASTER_SURFACES.sheets[name];
    if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  });
  return {spreadsheetId:ss.getId(), created:created};
}
