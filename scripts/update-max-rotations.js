import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { load as loadHTML } from 'cheerio';

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
const formPrefix = /^(Dynamax|Gigantamax|Eternamax)\s+/i;
const forms = { dynamax: 'Dynamax', gigantamax: 'Gigantamax', eternamax: 'Eternamax' };
const dayHeading = new RegExp('(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\\s+(' + MONTHS.join('|') + ')\\s+(\\d{1,2})\\b', 'i');
const clockPattern = '(1[0-2]|[1-9]):([0-5]\\d)\\s*([ap])\\.?m\\.?';
const featuredHourPattern = new RegExp('five-star Max Battles will also be featured in Max Battles from ' +
  clockPattern + '\\s+to\\s+' + clockPattern + '\\s+local time for one day each', 'i');

function localClock(hour, minute, meridiem) {
  return String(Number(hour) % 12 + (meridiem.toLowerCase() === 'p' ? 12 : 0)).padStart(2, '0') + ':' + minute + ':00';
}

// The source may publish a day without publishing the precise battle hours.
// Use the day only for placement in the calendar and label it accordingly.
function rosterWindow(heading, event) {
  const day = heading.match(dayHeading);
  if (!day) return { start: event.start, end: event.end };
  const localDateTime = /^\d{4}-\d{2}-\d{2}T[\d:.]+$/;
  if (!localDateTime.test(event.start) || !localDateTime.test(event.end)) return null;
  const firstYear = Number(event.start.slice(0, 4));
  const lastYear = Number(event.end.slice(0, 4));
  for (const year of new Set([firstYear, lastYear])) {
    const date = dateParts(day[1], day[2], year);
    if (!date) continue;
    const midnight = dateOnly(date) + 'T00:00:00';
    const following = dateOnly(new Date(+date + 86400000)) + 'T00:00:00';
    const start = event.start > midnight ? event.start : midnight;
    const end = event.end < following ? event.end : following;
    if (Date.parse(end) > Date.parse(start)) return { start, end, day: dateOnly(date) };
  }
  return null;
}

export function parseMaxEventRoster(html, event) {
  if (!(Date.parse(event.end) > Date.parse(event.start)) || !safeLink(event.link)) return [];
  const $ = loadHTML(html);
  const records = [];
  let inRoster = false;
  let heading = '';
  let sectionForm;
  let featuredHours;
  $('.page-content').first().children().each((_, element) => {
    const node = $(element);
    if (node.is('h2')) {
      heading = node.text().trim();
      inRoster = /^(?:(?:Dynamax|Gigantamax|Eternamax) .+ in )?Max Battles$/i.test(heading);
      sectionForm = heading.match(formPrefix)?.[1].toLowerCase();
      featuredHours = undefined;
    } else if (node.is('h3, h4')) {
      heading = node.text().trim();
    } else if (inRoster && node.is('p')) {
      const hours = node.text().replace(/\s+/g, ' ').match(featuredHourPattern);
      if (hours) featuredHours = [localClock(...hours.slice(1, 4)), localClock(...hours.slice(4, 7))];
    } else if (inRoster && node.is('.pkmn-list-flex')) {
      const window = rosterWindow(heading, event);
      if (!window) return;
      let battleWindow;
      if (window.day && featuredHours && /^Five-Star Max Battles:/i.test(heading)) {
        const [start, end] = featuredHours.map(time => window.day + 'T' + time);
        if (start >= window.start && end <= window.end && end > start) battleWindow = { start, end, label: 'Featured hour' };
      } else if (!window.day && event.eventType === 'max-battles' && sectionForm) {
        battleWindow = { start: event.start, end: event.end, label: 'Max Battle' };
      }
      node.find('.pkmn-list-item').each((_, card) => {
        const name = $(card).find('.pkmn-name').text().trim();
        const prefix = name.match(formPrefix)?.[1].toLowerCase();
        const form = forms[prefix || sectionForm || (node.hasClass('-dmax') ? 'dynamax' : '')];
        const species = name.replace(formPrefix, '').trim();
        if (!form || !species) return;
        const image = $(card).find('.pkmn-list-img img').first().attr('src');
        records.push({
          id: [event.eventID, form, species, window.day || 'event'].join(':'),
          kind: 'event', eventName: event.name, form, species,
          ...window, source: event.link,
          ...(battleWindow ? { battleWindow } : {}),
          ...(image?.startsWith('https://cdn.leekduck.com/') ? { image } : {}),
          notes: heading === 'Max Battles' ? undefined : heading
        });
      });
    }
  });
  return records;
}

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
  const candidates = events.filter(e => {
    if (!safeLink(e.link)) return false;
    if (e.eventType === 'max-mondays') return eventName(e.name) && Date.parse(e.start) > +now - 16 * 86400000;
    return /^(event|wild-area|max-battles|raid-[\w-]+|pokemon-go-tour)$/.test(e.eventType)
      && Date.parse(e.end) > +now - 86400000 && Date.parse(e.start) < +now + 90 * 86400000;
  });
  const updated = [];
  const refreshedEvents = new Set();
  for (const event of candidates) {
    try {
      const html = await (await load(event.link)).text();
      if (event.eventType !== 'max-mondays') {
        const roster = parseMaxEventRoster(html, event);
        if (roster.length) refreshedEvents.add(event.link);
        updated.push(...roster);
        continue;
      }
      // The weekly availability sentence must be present explicitly.
      // A Max Monday date alone is NOT evidence of a full-week rotation.
      const text = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
      updated.push(...parseWeeklyMaxAnnouncement(text, event, event.link));
    } catch(error) { console.warn('Max rotation source failed: ' + event.link + ' ' + error.message); }
  }
  const existing = [...(previous.rotations || []), ...(previous.eventBattles || [])]
    .filter(r => r?.end && Date.parse(r.end) > +now - 86400000 && !(r.kind === 'event' && refreshedEvents.has(r.source)));
  // Match semantic windows so hand-curated IDs do not duplicate scraped ones.
  const key = r => r.kind === 'event' ? r.id : [r.form.toLowerCase(), r.species.toLowerCase(), r.start, r.end].join(':');
  const byId = new Map(existing.map(r => [key(r), r]));
  for (const item of updated) byId.set(key(item), item);
  // Never rewrite the file to an empty list when upstream content is missing.
  if (!updated.length) {
    console.warn('No verifiable Max rotation or event roster found; retaining previous rotation file');
    return { ...previous, skipped: true };
  }
  const entries = [...byId.values()].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const payload = {
    version: 1, updatedAt: now.toISOString(),
    rotations: entries.filter(item => item.kind !== 'event'),
    eventBattles: entries.filter(item => item.kind === 'event')
  };
  await writeFile(output + '.tmp', JSON.stringify(payload, null, 2) + '\n');
  await rename(output + '.tmp', output);
  console.log('Saved ' + entries.length + ' dated Max Battle listings (' + updated.length + ' verified from sources)');
  return payload;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) updateMaxRotations().catch(error => { console.error(error.message); process.exitCode = 1; });
