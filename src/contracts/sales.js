export const CREATE_SALE_REQUEST = Object.freeze({
  required: ['requestId', 'shiftId', 'items', 'payment'],
  itemRequired: ['productId', 'unitId', 'qty'],
  forbiddenAuthoritativeClientFields: ['unitPrice', 'conversionFactor', 'qtyBase', 'stockBefore', 'stockAfter', 'subtotal', 'total']
});

export const CREATE_SALE_RESPONSE = Object.freeze({
  required: ['transactionId', 'status', 'items', 'total', 'createdAt']
});
