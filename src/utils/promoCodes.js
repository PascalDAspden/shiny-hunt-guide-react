export const REDEEMED_CODES_KEY = 'redeemed-promo-codes-v1';
export const PROMO_CACHE_KEY = 'promo-codes-cache-v1';
// This is generated JSON, never a request to Leek Duck from a user's device.
export const PROMO_FEED_URL = 'https://raw.githubusercontent.com/PascalDAspden/shiny-hunt-guide-react/main/src/data/promo-codes.json';

export function redeemUrl(code) {
  return `https://store.pokemongo.com/offer-redemption?passcode=${encodeURIComponent(code)}`;
}

export function isAvailable(promo, now = Date.now()) {
  return promo.active === true && (!promo.expires || (Number.isFinite(Date.parse(promo.expires)) && new Date(promo.expires).getTime() > now));
}

export function normalizeCodes(value) {
  if (!Array.isArray(value)) throw new Error('Promo feed must be an array.');
  const unique = new Map();
  for (const promo of value) {
    if (!promo || typeof promo.code !== 'string' || !/^[a-z0-9_-]+$/i.test(promo.code)) continue;
    const id = `promo-${promo.code.toLowerCase()}`;
    unique.set(id, { ...promo, id, rewards: Array.isArray(promo.rewards) ? promo.rewards.filter((reward) => typeof reward === 'string') : [], redeemUrl: redeemUrl(promo.code) });
  }
  if (value.length && !unique.size) throw new Error('Promo feed has no readable codes.');
  return [...unique.values()];
}

export function readSaved(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}

export function saveLocal(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function readRedeemed() {
  const saved = readSaved(REDEEMED_CODES_KEY, []);
  return new Set(Array.isArray(saved) ? saved.filter((id) => typeof id === 'string') : []);
}

export function initialCodes(bundled) {
  try { return normalizeCodes(readSaved(PROMO_CACHE_KEY, bundled)); }
  catch { return normalizeCodes(bundled); }
}

export async function fetchPromoCodes() {
  const response = await fetch(PROMO_FEED_URL, { signal: AbortSignal.timeout(10000), cache: 'no-cache' });
  if (!response.ok) throw new Error('Promo feed unavailable.');
  const codes = normalizeCodes(await response.json());
  saveLocal(PROMO_CACHE_KEY, codes);
  return codes;
}
