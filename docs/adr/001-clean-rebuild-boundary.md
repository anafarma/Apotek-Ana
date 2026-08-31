# ADR-001 — Clean Rebuild Boundary

Status: Accepted

The new repository is a clean implementation boundary. The legacy repository is retained as a reference and migration source only.

## Rationale
The legacy application contains proven business behavior but accumulated runtime coupling and compatibility layers. Copying its structure would reproduce that debt.

## Consequence
Business behavior is extracted into tests and canonical rules; implementation is rebuilt around explicit domain, application, repository and infrastructure layers.