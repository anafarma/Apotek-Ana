# Contribution Rules

- Never mix legacy runtime code into this repository.
- Business rules must be documented and tested before implementation.
- Pull requests must preserve API contracts and data invariants.
- Changes to schema require a migration note and compatibility assessment.
- Production-impacting changes require diagnostics and regression coverage.
- Never commit real pharmacy/customer data or secrets.