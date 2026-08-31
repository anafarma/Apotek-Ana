# Architecture Baseline v1.0

## Goal
Create a pharmacy system whose business rules remain stable even if the storage layer changes from Google Sheets to a relational database later.

## Layers
- Presentation: Next.js/React PWA.
- Client state/offline: IndexedDB and Outbox.
- Application: Commands, queries, validation, authorization, transaction orchestration.
- Domain: Product, Pricing, Inventory, Sales, Purchasing, Shift, Customer, Identity.
- Repository: storage abstractions; no business logic in adapters.
- Infrastructure: Apps Script + Google Sheets initially.

## Non-negotiable rules
1. Server is authoritative for price, stock, conversion, authorization and commit state.
2. Client never supplies authoritative price or stock balance.
3. Every mutation is validated, authorized, idempotent and auditable.
4. Domain code never calls SpreadsheetApp directly.
5. Legacy code is reference material, not a dependency.
6. Inventory quantities are represented internally in a base unit.
7. Selling price is attached to a selling unit and is independent from conversion.
8. Historical transactions retain immutable snapshots.

## Runtime flow
UI → API client → command handler → domain policy → repository → Sheets/App Script → audit/ledger.

## Migration principle
The legacy application is behavior/reference input. It is not the architecture for V2.