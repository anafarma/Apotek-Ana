# Live Schema Audit

Status: BLOCKED pending direct access to the live Apps Script projects and spreadsheets.

Required evidence:
- production Apps Script project
- development Apps Script project
- spreadsheet tabs and actual headers
- trigger configuration
- deployment configuration
- current environment/configuration values without exposing secrets

The canonical schema must be reconciled against live data before migration tooling is finalized. This is an intentional control: the project must not invent a production schema from screenshots or legacy assumptions.