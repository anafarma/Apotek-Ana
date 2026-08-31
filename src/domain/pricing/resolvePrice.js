/**
 * Resolves a price for the exact selling unit. It deliberately does not
 * derive one unit price from another unit's price.
 */
export function resolvePrice({ prices, productId, unitId, at }) {
  const candidates = (prices ?? []).filter((p) =>
    p.productId === productId &&
    p.unitId === unitId &&
    p.active !== false &&
    isEffective(p, at)
  );

  if (candidates.length === 0) throw new Error('SELLING_PRICE_NOT_FOUND');
  candidates.sort((a, b) => new Date(b.effectiveFrom) - new Date(a.effectiveFrom));
  return Object.freeze({ ...candidates[0] });
}

function isEffective(price, at) {
  const t = new Date(at).getTime();
  const from = new Date(price.effectiveFrom).getTime();
  const to = price.effectiveTo ? new Date(price.effectiveTo).getTime() : Infinity;
  return Number.isFinite(t) && t >= from && t < to;
}
