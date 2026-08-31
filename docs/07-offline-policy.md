# Offline Policy

Offline mode is deliberately narrow.

## Offline-capable
- cached read-only master data
- sale preparation
- permitted sale command queueing

## Online-required
- price changes
- stock adjustments
- stock opname
- purchase receiving
- user management
- configuration

Outbox fields: outboxId, requestId, commandType, payload, createdAt, attemptCount, lastAttemptAt, status, lastError.

Retries are idempotent. The client never invents authoritative prices or stock. Conflicts are resolved by server validation at commit.