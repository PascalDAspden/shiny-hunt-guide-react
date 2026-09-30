/** Chance of at least one success in independent attempts with a 1/denominator rate. */
export function atLeastOneShiny(attempts, denominator) {
  if (!Number.isSafeInteger(attempts) || attempts < 0 || !Number.isSafeInteger(denominator) || denominator < 2) return null;
  return -Math.expm1(attempts * Math.log1p(-1 / denominator));
}

export function rateDenominator(value) {
  const match = /^1\s*\/\s*(\d+)$/.exec(String(value || '').trim());
  return match ? Number(match[1]) : null;
}
