/**
 * Ana Farma V2 - canonical master-data surfaces.
 * Canonical headers mirror the Apps Script bootstrap and V2 Schema.js.
 * Non-destructive: only creates missing V2 sheets.
 */

const AF_MASTER_SURFACES = {
  spreadsheetId: '1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo',
  sheets: {
    Location: ['LocationId','LocationCode','Name','Active','CreatedAt','UpdatedAt'],
    Supplier: ['SupplierId','SupplierCode','Name','Active','CreatedAt','UpdatedAt'],
    ProductLocation: ['ProductLocationId','ProductId','LocationId','IsDefault','Active','CreatedAt','UpdatedAt']
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
  return {spreadsheetId:ss.getId(), created:created, canonical:true};
}
