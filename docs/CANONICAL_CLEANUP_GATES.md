# Canonical migration and cleanup gates

## Canonical workbook domains
The runtime schema is singular and case-sensitive: Product, ProductUnit, ProductPrice, Shift, Sale, SaleItem, Payment.

## Do not delete legacy sheets yet
A sheet may be deleted only after all four proofs are recorded:
1. no runtime code dependency;
2. no formula or Apps Script dependency;
3. no unresolved migration/reconciliation dependency;
4. an immutable backup/export exists.

## Known cleanup candidates
- Shifts: header-only duplicate schema, but remove only after the deployed Apps Script no longer references it.
- No legacy production sheet is an automatic deletion candidate.

## Blocking defects found in repository
The prior Apps Script bootstrap and web boundary used plural sheet names and incompatible headers. Those references were removed on the consolidation branch. Transaction mutation remains disabled.

## Required next validation
1. Deploy the consolidated Apps Script files to a new version.
2. Verify health.
3. Verify getSellableCatalog against Product/ProductUnit/ProductPrice/StockBalance.
4. Verify getOpenShift against Shift.
5. Run governance audit after its plural-schema assumptions are migrated.
6. Only then evaluate physical deletion of Shifts and any other empty duplicate surface.
