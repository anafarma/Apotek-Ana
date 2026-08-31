# Security Baseline

Authentication identifies the operator. Authorization evaluates User → Role → Capability → Command → Business Policy.

Frontend authorization is for UX only. Server-side authorization is the security boundary.

High-risk mutations requiring explicit capability and audit: price changes, stock adjustments, stock opname, purchasing receipt, user management and configuration.

Every privileged mutation records actorId, command, target entity, before/after summary where appropriate, timestamp and requestId.