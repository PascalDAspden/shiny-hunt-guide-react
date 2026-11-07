import seed from '../../public/data/max-rotations.json' with { type: 'json' };
import { fetchWithTimeout } from '../utils/fetch.js';
import { parseDate } from '../utils/dates.js';

const URL = 'https://raw.githubusercontent.com/PascalDAspden/shiny-hunt-guide-react/main/public/data/max-rotations.json';
const clean = value => String(value || '').trim();
const valid = item => item && ['Dynamax', 'Gigantamax', 'Eternamax'].includes(item.form) && clean(item.species) && clean(item.source).startsWith('https://') && item.start && item.end && Number.isFinite(+parseDate(item.start)) && Number.isFinite(+parseDate(item.end)) && +parseDate(item.end) > +parseDate(item.start);

export const validMaxRotations = raw => raw?.version === 1 && Number.isFinite(Date.parse(raw.updatedAt)) && Array.isArray(raw.rotations) && raw.rotations.every(valid)
  && (raw.eventBattles === undefined || (Array.isArray(raw.eventBattles) && raw.eventBattles.every(item => valid(item) && item.kind === 'event')));

const listings = feed => [...feed.rotations, ...(feed.eventBattles || [])];

export async function fetchMaxRotations() {
  let saved = seed;
  try {
    const raw = JSON.parse(localStorage.getItem('max-rotations-v1') || 'null');
    if (validMaxRotations(raw) && Date.parse(raw.updatedAt) >= Date.parse(saved.updatedAt)) saved = raw;
  } catch { /* no cache */ }
  try {
    const response = await fetchWithTimeout(URL, { cache: 'no-cache' }, 12000);
    if (!response.ok) throw Error('Max rotation feed unavailable');
    const raw = await response.json();
    if (!validMaxRotations(raw) || Date.parse(raw.updatedAt) < Date.parse(saved.updatedAt)) throw Error('Invalid or older Max rotation data');
    try { localStorage.setItem('max-rotations-v1', JSON.stringify(raw)); } catch { /* storage unavailable */ }
    return { data: listings(raw), failed: false, cached: Date.now() - Date.parse(raw.updatedAt) > 48 * 3600000 };
  } catch {
    return { data: listings(saved), failed: true, cached: true };
  }
}

export function maxRotationEntries(curated = [], events = []) {
  const entries = curated.filter(valid).map(item => ({
    ...item, key: item.id || item.form + ':' + item.species + ':' + item.start,
    certainty: 'confirmed', kind: item.kind === 'event' ? 'event' : item.form === 'Gigantamax' ? 'gigantamax' : 'weekly'
  }));
  for (const event of events) {
    if (event.eventType !== 'max-mondays') continue;
    const match = clean(event.name).match(/^(Dynamax|Gigantamax)\s+(.+?)\s+during\s+Max Monday/i);
    const window = { start: event.start, end: event.end };
    const start = parseDate(window.start), end = parseDate(window.end);
    if (!match || !start || !end || !Number.isFinite(+start) || !Number.isFinite(+end) || end <= start) continue;
    for (const species of match[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map(clean).filter(Boolean)) {
      const exists = entries.some(item => item.kind !== 'event' && item.form.toLowerCase() === match[1].toLowerCase() && item.species.toLowerCase() === species.toLowerCase() && +parseDate(item.start) < +parseDate(window.end) && +parseDate(window.start) < +parseDate(item.end));
      if (exists) continue;
      entries.push({
        key: 'monday:' + event.eventID + ':' + species,
        id: 'monday:' + event.eventID + ':' + species,
        form: match[1].toLowerCase() === 'gigantamax' ? 'Gigantamax' : 'Dynamax', species, ...window,
        source: event.link || event.url || 'https://leekduck.com/events/',
        certainty: 'monday-only',
        kind: 'monday',
        mondayStart: event.start, mondayEnd: event.end
      });
    }
  }
  return entries.sort((a, b) => +parseDate(a.start) - +parseDate(b.start));
}

export function rotationStatus(item, reference = new Date()) {
  const start = parseDate(item.start), end = parseDate(item.end);
  if (!(start && end && Number.isFinite(+start) && Number.isFinite(+end) && end > start)) return 'unknown';
  if (reference < start) return 'upcoming';
  return reference < end ? 'current' : 'expired';
}
