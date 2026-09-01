/** Resolve exactly one active product-unit conversion to the canonical base unit. */
export function resolveConversion({ conversions, productId, unitId, baseUnitId }) {
  const matches = (conversions ?? []).filter(c => c.productId === productId && c.fromUnitId === unitId && c.toUnitId === baseUnitId && c.active !== false);
  if (matches.length !== 1) throw new Error(matches.length === 0 ? 'UNIT_CONVERSION_NOT_FOUND' : 'AMBIGUOUS_UNIT_CONVERSION');
  const factor = Number(matches[0].factor);
  if (!Number.isSafeInteger(factor) || factor <= 0) throw new Error('INVALID_UNIT_CONVERSION');
  return factor;
}
