# API Contract Baseline

## POST createSale
Request:
```json
{
  "requestId": "UUID",
  "shiftId": "ID",
  "customerId": "optional ID",
  "items": [{"productId":"ID","unitId":"ID","qty":1}],
  "payment": {"method":"cash","amount":35000}
}
```

The client MUST NOT submit authoritative price, conversion factor, stock balance, tax result or final total.

## Server resolution
The command handler resolves active product, active selling unit, conversion to base unit, effective price, batch availability/FEFO, shift validity, authorization, payment validity and idempotency.

## Response
```json
{
  "success": true,
  "transactionId": "UUID",
  "receiptNumber": "TRX-YYYYMMDD-NNNNN",
  "status": "COMPLETED",
  "items": [],
  "totals": {"subtotal":0,"discount":0,"tax":0,"total":0},
  "timestamp": "ISO-8601"
}
```

## Errors
Use stable machine-readable codes such as INVALID_REQUEST, PRODUCT_NOT_FOUND, UNIT_NOT_SELLABLE, PRICE_NOT_AVAILABLE, INSUFFICIENT_STOCK, SHIFT_REQUIRED, FORBIDDEN, DUPLICATE_REQUEST and COMMIT_FAILED.

## Idempotency
requestId is the idempotency key. A successfully committed request must return the original transaction result when retried.