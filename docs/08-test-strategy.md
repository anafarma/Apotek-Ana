# Test Strategy

## Domain regression
- 1 Strip
- 1 Box
- 2 Box
- mixed 1 Box + 2 Strip
- independent Strip/Box prices
- insufficient stock
- inactive product
- inactive unit
- invalid quantity
- duplicate request
- retry after timeout
- price changed between UI load and commit
- ledger/balance reconciliation
- batch FEFO selection
- shift validation
- authorization denial

## Critical example
Amlodipine: Strip Rp4,000; Box Rp35,000; Box conversion 10.
- 1 Box → Rp35,000 and stock -10 Strip.
- 2 Strip → Rp8,000 and stock -2 Strip.
- 1 Box + 2 Strip → Rp43,000 and stock -12 Strip.

## Test layers
Unit tests run without Sheets. Integration tests cover repositories and Apps Script adapters. Contract tests validate API shapes. Regression tests preserve proven legacy behavior without importing legacy runtime dependencies.