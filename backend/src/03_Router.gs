function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'health');
    if (action === 'health') {
      return afOk_({
        service: 'ana-farma',
        status: 'READY',
        spreadsheet: AF_CONFIG.SPREADSHEET_ID
      });
    }
    if (action === 'schemaHealth') {
      return afOk_({ schema: afSchemaHealth_() });
    }
    if (action === 'getObat') {
      return afOk_({ products: afReadObjects_(AF_SHEET.OBAT) });
    }
    return afFail_('ACTION_NOT_FOUND', 'Action tidak ditemukan.', { action: action });
  } catch (error) {
    return afFail_('INTERNAL_ERROR', error.message || String(error));
  }
}