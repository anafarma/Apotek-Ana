function afJson_(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function afOk_(data) {
  return afJson_({
    success: true,
    version: AF_CONFIG.API_VERSION,
    timestamp: new Date().toISOString(),
    data: data || {}
  });
}

function afFail_(code, message, details) {
  return afJson_({
    success: false,
    version: AF_CONFIG.API_VERSION,
    timestamp: new Date().toISOString(),
    error: {
      code: code,
      message: message,
      details: details || null
    }
  });
}