function afSpreadsheet_() {
  return SpreadsheetApp.openById(AF_CONFIG.SPREADSHEET_ID);
}

function afSheet_(name) {
  const sheet = afSpreadsheet_().getSheetByName(name);
  if (!sheet) throw new Error('SHEET_NOT_FOUND: ' + name);
  return sheet;
}

function afReadObjects_(sheetName) {
  const values = afSheet_(sheetName).getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1)
    .filter(row => row.some(cell => cell !== '' && cell !== null))
    .map(row => headers.reduce((obj, header, i) => {
      obj[header] = row[i];
      return obj;
    }, {}));
}