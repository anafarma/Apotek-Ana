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
    if (action === 'login') {
      const identity = e.parameter.identity || e.parameter.username || '';
      const password = e.parameter.password || '';
      const actor = afAuthenticate_(identity, password);
      if (!actor) return afFail_('LOGIN_FAILED', 'Identitas atau password tidak valid.');
      const token = afCreateSession_(actor);
      return afOk_({ sessionToken: token, actor: actor });
    }
    if (action === 'schemaHealth') {
      return afOk_({ schema: afSchemaHealth_() });
    }
    if (action === 'myShift') {
      const actor = afGetSession_(e.parameter.sessionToken || '');
      if (!actor) return afFail_('UNAUTHORIZED', 'Session tidak valid.');
      return afOk_({ actor: actor, shift: afShiftStatus_(actor) });
    }
    if (action === 'getObat') {
      return afOk_({ products: afReadObjects_(AF_SHEET.OBAT) });
    }
    return afFail_('ACTION_NOT_FOUND', 'Action tidak ditemukan.', { action: action });
  } catch (error) {
    return afFail_('INTERNAL_ERROR', error.message || String(error));
  }
}