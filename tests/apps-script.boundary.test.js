import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const bootstrap = fs.readFileSync(new URL('../tools/apps-script/V2Bootstrap.gs', import.meta.url), 'utf8');
const web = fs.readFileSync(new URL('../tools/apps-script/V2WebApp.gs', import.meta.url), 'utf8');

test('Apps Script boundary targets only the isolated V2 spreadsheet', () => {
  assert.match(bootstrap, /spreadsheetId:\s*'1creA8S9UeQ5CIdp84U_dqBmhN1BdrDDea0FIGf3hnYo'/);
  assert.match(web, /SpreadsheetApp\.openById\(AF_V2\.spreadsheetId\)/);
  assert.doesNotMatch(web, /script\.google\.com\/macros\/s\//);
});

test('Apps Script exposes health and master read actions', () => {
  assert.match(web, /action === 'health'/);
  assert.match(web, /action === 'getSellableCatalog'/);
  assert.match(web, /action === 'getOpenShift'/);
});

test('transaction mutation remains fail-closed until live persistence integration passes', () => {
  assert.match(web, /TRANSACTION_API_NOT_ENABLED/);
  assert.match(web, /V2 transaction mutation is not enabled until the live persistence integration gate passes/);
});

test('server master response contains authoritative price and conversion', () => {
  assert.match(web, /conversionFactor/);
  assert.match(web, /priceId/);
  assert.match(web, /price:/);
});

test('access boundary requires authenticated Google identity and explicit V2 access row', () => {
  assert.match(web, /Session\.getActiveUser\(\)\.getEmail\(\)/);
  assert.match(web, /AUTHENTICATION_REQUIRED/);
  assert.match(web, /FORBIDDEN/);
  assert.match(bootstrap, /_V2_ACCESS/);
});

test('V2 canonical schema includes shifts and access registry', () => {
  const schema = fs.readFileSync(new URL('../src/infrastructure/sheets/Schema.js', import.meta.url), 'utf8');
  assert.match(schema, /SHIFTS:\s*'Shifts'/);
  assert.match(schema, /ACCESS:\s*'_V2_ACCESS'/);
  assert.match(schema, /ShiftId.*ActorId.*OpenedAt/);
  assert.match(schema, /UserId.*Email.*Role.*Capabilities/);
});
