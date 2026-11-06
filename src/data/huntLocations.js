import seed from '../../public/data/hunt-locations.json' with { type: 'json' };
import { fetchWithTimeout } from '../utils/fetch.js';
import { coordinates } from '../utils/huntMap.js';
import { distanceKm } from './location.js';
import { parseDate } from '../utils/dates.js';

const FEED = 'https://raw.githubusercontent.com/PascalDAspden/shiny-hunt-guide-react/main/public/data/hunt-locations.json';
const https = value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } };
export const verifiedEncounter = (encounter, reference = new Date()) => encounter?.verified === true && typeof encounter.name === 'string' && encounter.name.trim() && ['raid', 'dynamax', 'gigantamax'].includes(encounter.battleType) && https(encounter.source) && Number.isFinite(Date.parse(encounter.checkedAt)) && Date.parse(encounter.checkedAt) <= +reference + 60000 && parseDate(encounter.start) <= reference && reference < parseDate(encounter.end);
export function validLocationFeed(raw) {
  return raw?.version === 1 && Number.isFinite(Date.parse(raw.updatedAt)) && Array.isArray(raw.locations) && new Set(raw.locations.map(item => item?.id)).size === raw.locations.length && raw.locations.every(item => item && typeof item.id === 'string' && item.id && typeof item.name === 'string' && item.name.trim() && ['gym', 'power-spot'].includes(item.kind) && Number.isFinite(item.latitude) && Number.isFinite(item.longitude) && coordinates(item.latitude, item.longitude) && https(item.source) && Number.isFinite(Date.parse(item.checkedAt)) && (!item.expiresAt || Number.isFinite(Date.parse(item.expiresAt))));
}
export async function fetchHuntLocations() {
  let saved = seed;
  try { const cache = JSON.parse(localStorage.getItem('hunt-locations-v1')); if (validLocationFeed(cache) && Date.parse(cache.updatedAt) > Date.parse(saved.updatedAt)) saved = cache; } catch { /* no stored locations */ }
  try {
    const response = await fetchWithTimeout(FEED, { cache: 'no-cache' });
    if (!response.ok) throw Error('Location source unavailable');
    const raw = await response.json();
    if (!validLocationFeed(raw) || Date.parse(raw.updatedAt) < Date.parse(saved.updatedAt)) throw Error('Invalid or older location source');
    try { localStorage.setItem('hunt-locations-v1', JSON.stringify(raw)); } catch { /* still usable */ }
    return { data: raw.locations, failed: false, cached: Date.now() - Date.parse(raw.updatedAt) > 48 * 3600000 };
  } catch { return { data: saved.locations, failed: true, cached: true }; }
}
export function nearbyHuntLocations(locations, origin, { radius = 2, filter = 'all', reference = new Date() } = {}) {
  if (!origin) return [];
  return locations.filter(item => !item.expiresAt || Date.parse(item.expiresAt) > +reference).map(item => {
    const encounter = verifiedEncounter(item.encounter, reference) ? item.encounter : null;
    return { ...item, encounter, distance: distanceKm(origin, item) };
  }).filter(item => item.distance <= radius && (filter === 'all' || item.encounter?.battleType === filter)).sort((a, b) => a.distance - b.distance);
}
