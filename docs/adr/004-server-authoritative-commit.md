# ADR-004 — Server Authoritative Commit

Status: Accepted

The browser may propose a sale but cannot decide its final price, conversion, stock availability or authorization. The server re-reads critical state after acquiring the mutation lock and commits the transaction. requestId makes retries idempotent.