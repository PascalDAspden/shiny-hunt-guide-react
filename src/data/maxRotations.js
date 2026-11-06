import { parseDate } from '../utils/dates.js';

const URL = 'https://raw.githubusercontent.com/PascalDAspden/shiny-hunt-guide-react/main/public/data/max-rotations.json';
const DAY = 86400000;
const clean = value => String(value || '').trim();
const valid = item => item && ['Dynamax', 'Gigantamax'].includes(item.form) && clean(item.species) && clean(item.source).startsWith('https://') && item.start && item.end && Number.isFinite(+parseDate(item.start)) && Number.isFinite(+parseDate(item.end)) && +parseDate(item.end) > +parseDate(item.start);

export async function fetchMaxRotations() {
  let cached = [];
  try {
    const raw = JSON.parse(localStorage.getItem('max-rotations-v1') || 'null');
    if (raw?.version === 1 && Array.isArray(raw.rotations)) cached = raw.rotations.filter(valid);
  } catch { /* no cache */ }
  try {
    const response = await fetch(URL, { cache: 'no-cache', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Error('Max rotation feed unavailable');
    const raw = await response.json();
    if (raw?.version !== 1 || !Array.isArray(raw.rotations) || !raw.rotations.every(valid)) throw Error('Invalid Max rotation data');
    try { localStorage.setItem('max-rotations-v1', JSON.stringify(raw)); } catch { /* storage unavailable */ }
    return { data: raw.rotations, failed: false, cached: false };
  } catch {
    return { data: cached, failed: true, cached: cached.length > 0 };
  }
}

const mondayWindow = event => {
  const start = parseDate(event.start);
  if (!start || !Number.isFinite(+start)) return null;
  // The event announces the featured Monday, NOT independently confirmed week-long availability.
  const startDate = String(event.start).slice(0, 10);
  const monday = new Date(startDate + 'T00:00:00Z');
  const day = monday.getUTCDay();
  monday.setUTCDate(monday.getUTCDate() - ((day + 6) % 7));
  const date = monday.toISOString().slice(0, 10);
  const end = new Date(monday.getTime() + 7 * DAY).toISOString().slice(0, 10);
  return { start: date + 'T00:00:00', end: end + 'T00:00:00' };
};

export function maxRotationEntries(curated = [], events = []) {
  const entries = curated.filter(valid).map(item => ({
    ...item, key: item.id || item.form + ':' + item.species + ':' + item.start,
    certainty: 'confirmed', kind: item.form === 'Gigantamax' ? 'gigantamax' : 'weekly'
  }));
  for (const event of events) {
    if (event.eventType !== 'max-mondays') continue;
    const match = clean(event.name).match(/^(Dynamax|Gigantamax)\s+(.+?)\s+during\s+Max Monday/i);
    const window = mondayWindow(event);
    if (!match || !window) continue;
    for (const species of match[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map(clean).filter(Boolean)) {
      const exists = entries.some(item => item.form.toLowerCase() === match[1].toLowerCase() && item.species.toLowerCase() === species.toLowerCase() && +parseDate(item.start) < +parseDate(window.end) && +parseDate(window.start) < +parseDate(item.end));
      if (exists) continue;
      entries.push({
        key: 'monday:' + event.eventID + ':' + species,
        id: 'monday:' + event.eventID + ':' + species,
        form: match[1], species, ...window,
        source: event.link || event.url || 'https://leekduck.com/events/',
        certainty: 'monday-only',
        kind: match[1].toLowerCase() === 'gigantamax' ? 'gigantamax' : 'weekly',
        mondayStart: event.start, mondayEnd: event.end
      });
    }
  }
  return entries.sort((a, b) => +parseDate(a.start) - +parseDate(b.start));
}

export function rotationStatus(item, reference = new Date()) {
  const start = parseDate(item.start), end = parseDate(item.end);
  if (!(start && end && Number.isFinite(+start) && Number.isFinite(+end))) return 'unknown';
  if (reference < start) return 'upcoming';
  return reference < end ? 'current' : 'expired';
}
