/** Resolve exactly one effective price for the exact selling unit. */
export function resolvePrice({ prices, productId, unitId, at }) {
  const t = new Date(at).getTime();
  if (!Number.isFinite(t)) throw new Error('INVALID_PRICE_TIME');
  const candidates = (prices ?? []).filter(p => p.productId === productId && p.unitId === unitId && p.active !== false && isEffective(p, t));
  if (candidates.length === 0) throw new Error('SELLING_PRICE_NOT_FOUND');
  const valid = candidates.filter(p => Number.isSafeInteger(p.price) && p.price >= 0 && Number.isFinite(new Date(p.effectiveFrom).getTime()));
  if (valid.length !== candidates.length) throw new Error('INVALID_PRICE_RECORD');
  valid.sort((a,b) => new Date(b.effectiveFrom).getTime() - new Date(a.effectiveFrom).getTime());
  if (valid.length > 1 && new Date(valid[0].effectiveFrom).getTime() === new Date(valid[1].effectiveFrom).getTime()) throw new Error('AMBIGUOUS_SELLING_PRICE');
  return Object.freeze({ ...valid[0] });
}
function isEffective(price, t) {
  const from = new Date(price.effectiveFrom).getTime();
  const to = price.effectiveTo ? new Date(price.effectiveTo).getTime() : Infinity;
  return Number.isFinite(from) && (!price.effectiveTo || Number.isFinite(to)) && t >= from && t < to;
}
