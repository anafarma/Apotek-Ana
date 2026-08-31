# Canonical Error Codes

INVALID_REQUEST — malformed command.
UNAUTHORIZED — no authenticated operator.
FORBIDDEN — capability denied.
PRODUCT_NOT_FOUND — product does not exist.
PRODUCT_INACTIVE — product is inactive.
UNIT_NOT_FOUND — unit does not exist for product.
UNIT_NOT_SELLABLE — unit cannot be sold.
CONVERSION_INVALID — conversion is missing or invalid.
PRICE_NOT_AVAILABLE — no active price for selected unit/time.
QUANTITY_INVALID — quantity violates unit policy.
INSUFFICIENT_STOCK — required base quantity is unavailable.
BATCH_NOT_AVAILABLE — required batch stock is unavailable.
SHIFT_REQUIRED — cashier operation has no valid open shift.
PAYMENT_INVALID — payment is invalid or insufficient.
DUPLICATE_REQUEST — request is already known; return original result when available.
SCHEMA_INVALID — persistence schema is incompatible.
CONFLICT — state changed and command cannot be safely committed.
COMMIT_FAILED — controlled mutation failed and recovery was attempted.
