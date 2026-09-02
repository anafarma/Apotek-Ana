# PRODUCTION SAFETY BOUNDARY

## Status branch
- `main`: PRODUCTION / READ ONLY
- `foundation/reset-2026-09-02`: DEVELOPMENT ONLY

## Hard rules
No automated action may:
- merge into `main`;
- push directly to `main`;
- delete or rename production files;
- change a production deployment;
- change the production Apps Script URL;
- mutate the production spreadsheet.

All implementation and testing must occur outside production until an explicit release approval is given by the Owner.

## Current work
The current rebuild is a compatibility and online/offline development track. It must preserve the running production application as the rollback baseline.
