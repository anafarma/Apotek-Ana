# Commit / Transaction Checklist

Before any production mutation:

1. Validate request shape.
2. Validate authentication and capability.
3. Check requestId for replay.
4. Resolve master data from server.
5. Resolve exact selling-unit price from server.
6. Resolve conversion to base unit.
7. Re-read critical stock state after acquiring lock.
8. Validate stock and business invariants.
9. Generate internal transaction IDs.
10. Persist business records and ledger movements atomically as far as the storage adapter permits.
11. Persist audit record.
12. Record request result for idempotent replay.
13. Reconcile critical projections.
14. Release lock.

If a step fails, the command must return a deterministic error and must not report success.
