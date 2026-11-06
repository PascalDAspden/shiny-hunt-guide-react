import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const EVENTS = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json';
const FILE = 'public/data/max-rotations.json';
const MONTHS = 'January February March April May June July August September October November December'.split(' ');
const datePattern = '(' + MONTHS.join('|') + ')\\s+(\\d{1,2}),?\\s+(20\\d{2})';
function dateParts(month, day, year) {
  const m = MONTHS.findIndex(value => value.toLowerCase() === month.toLowerCase()) + 1;
  if (!m) return null;
  const d = new Date(Date.UTC(Number(year), m - 1, Number(day)));
  return d.getUTCFullYear() === +year && d.getUTCMonth() === m - 1 && d.getUTCDate() === +day ? d : null;
}
const dateOnly = d => d.toISOString().slice(0, 10);
const safeLink = value => /^https:\/\/leekduck\.com\/events\/[a-z0-9-]+\/?$/.test(value || '');
const eventName = value => String(value || '').match(/^(Dynamax|Gigantamax)\s+(.+?)\s+during\s+Max Monday/i);

export function parseWeeklyMaxAnnouncement(text, event, source) {
  const match = eventName(event.name);
  if (!match) return [];
  const expression = new RegExp(datePattern + '\\s+(?:through|to|until|–|-)\\s+' + datePattern, 'i');
  const phrase = String(text).match(/.{0,130}may appear in Max Battles.{0,180}/i);
  const range = phrase?.[0]?.match(expression);
  if (!range) return [];
  let start = dateParts(range[1], range[2], range[3]);
  let end = dateParts(range[4], range[5], range[6]);
  if (!start || !end || end < start || (end - start) > 21 * 86400000) return [];
  end = new Date(+end + 86400000);
  const species = match[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map(s => s.trim()).filter(Boolean);
  return species.map(name => ({
    id: 'weekly-' + dateOnly(start) + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    species: name, form: match[1].toLowerCase() === 'gigantamax' ? 'Gigantamax' : 'Dynamax', start: dateOnly(start) + 'T00:00:00',
    end: dateOnly(end) + 'T00:00:00', source,
    notes: 'Source states this Pokémon may appear at Power Spots during these dates; individual spots vary.'
  }));
}

export async function updateMaxRotations({ fetcher = fetch, output = FILE, now = new Date() } = {}) {
  let previous = { rotations: [] };
  try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { /* initial file */ }
  const load = async url => {
    const response = await fetcher(url, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw Error('Source returned ' + response.status);
    return response;
  };
  let events;
  try {
    events = await (await load(EVENTS)).json();
  } catch (error) {
    console.warn('Max event feed unavailable; retaining the last verified rotation file: ' + error.message);
    return { ...previous, skipped: true };
  }
  if (!Array.isArray(events)) {
    console.warn('Invalid Max event feed; retaining previous rotation file');
    return { ...previous, skipped: true };
  }
  const candidates = events.filter(e => e.eventType === 'max-mondays' && eventName(e.name) && safeLink(e.link) && Date.parse(e.start) > +now - 16 * 86400000);
  const updated = [];
  for (const event of candidates) {
    try {
      const html = await (await load(event.link)).text();
      // The weekly availability sentence must be present explicitly.
      // A Max Monday date alone is NOT evidence of a full-week rotation.
      const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      updated.push(...parseWeeklyMaxAnnouncement(text, event, event.link));
    } catch(error) { console.warn('Max rotation source failed: ' + event.link + ' ' + error.message); }
  }
  const existing = (previous.rotations || []).filter(r => r?.end && Date.parse(r.end) > +now - 86400000);
  // Match semantic windows so hand-curated IDs do not duplicate scraped ones.
  const key = r => [r.form.toLowerCase(), r.species.toLowerCase(), r.start, r.end].join(':');
  const byId = new Map(existing.map(r => [key(r), r]));
  for (const item of updated) byId.set(key(item), item);
  // Never rewrite the file to an empty list when upstream content is missing.
  if (!updated.length) {
    console.warn('No verifiable weekly Max rotation published yet; retaining previous rotation file without marking expired data as current');
    return { ...previous, skipped: true };
  }
  const rotations = [...byId.values()].sort((a,b) => Date.parse(a.start) - Date.parse(b.start));
  const payload = { version: 1, updatedAt: now.toISOString(), rotations };
  await writeFile(output + '.tmp', JSON.stringify(payload, null, 2) + '\n');
  await rename(output + '.tmp', output);
  console.log('Saved ' + rotations.length + ' dated Max Battle rotations (' + updated.length + ' verified from sources)');
  return payload;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) updateMaxRotations().catch(error => { console.error(error.message); process.exitCode = 1; });
