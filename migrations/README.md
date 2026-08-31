# Migrations

Numbered, deterministic schema migrations will be added after the live schema audit.

No production migration may run from an unreviewed migration. Every migration must declare preconditions, changes, postconditions, rollback/recovery strategy and reconciliation checks.