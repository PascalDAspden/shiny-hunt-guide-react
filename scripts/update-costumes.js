import { load } from 'cheerio';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { costumeCatalog, isCostumeEncounter } from '../src/data/costumes.js';

// This pass explicitly spans both Halloween event parts. Unknown passes use
// their own event window until a separately published schedule is reviewed.
const reviewedPassWindows = {
  'https://leekduck.com/events/halloween-2026-part-1/': { start: '2026-10-27T10:00:00', end: '2026-11-05T20:00:00' }
};
const EVENTS = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/events.json';
const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
export function eventUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'leekduck.com' && u.pathname.startsWith('/events/') ? u.href : null; } catch { return null; }
}
function imageUrl(value) {
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'cdn.leekduck.com' && /\/pokemon_icons(?:_crop)?\//.test(u.pathname) ? u.href : null; } catch { return null; }
}

// Selectors inspected against the event page on 29 October 2026.
export function parseCostumePage(html, event) {
  const $ = load(html);
  if (!$('h1').length || !$('.page-content').length || !$('.page-content .event-schedule').length) throw Error('Event page format changed');
  const rows = new Map();
  const add = (element, route, nameSelector) => {
    const node = $(element);
    const image = imageUrl(node.find('img').map((_, image) => $(image).attr('src')).get().find(imageUrl));
    const name = clean(node.find(nameSelector).first().text() || node.find('img').first().attr('alt'));
    if (!image || !name || !isCostumeEncounter({ name, image })) return;
    const asset = new URL(image).pathname.split('/').at(-1).replace(/(?:\.s)?\.icon\.png$/, '').replace(/\.g\d+$/, '');
    if (!/^pm\d+\./.test(asset)) return;
    const row = rows.get(asset) || { asset, name, image, shinyAvailable: null, routes: [] };
    if (node.find('.pokemon-cutout-shiny, .shiny-icon, img[alt="Can be Shiny"]').length) row.shinyAvailable = true;
    const dates = route.kind === 'pass' ? reviewedPassWindows[event.link] || event : event;
    row.routes.push({ ...route, start: dates.start, end: dates.end, event: route.passName || event.name, source: event.link });
    rows.set(asset, row);
  };
  $('.pkmn-list-item').each((_, element) => {
    const list = $(element).closest('ul');
    const preceding = list.prevAll('h2,h3');
    const heading = clean(preceding.first().text());
    const section = clean(preceding.filter('h2').first().text());
    let kind;
    if (/spawns|wild encounters/i.test(section)) kind = 'wild';
    else if (/raids/i.test(section)) kind = 'raids';
    else if (/trick or treat|surprise/i.test(heading + ' ' + section)) kind = 'surprise';
    else if (/eggs/i.test(section)) kind = 'eggs';
    if (kind) add(element, { kind, detail: kind === 'raids' ? heading : kind === 'surprise' ? 'Tap event surprise boxes on the map' : '' }, '.pkmn-name');
  });
  $('.event-field-research-list li').each((_, task) => $(task).find('.reward').each((_, reward) => add(reward, { kind: 'research', detail: clean($(task).find('.task').text()) }, '.reward-label')));
  $('.rank-item').each((_, rank) => {
    const number = Number($(rank).find('.rank-number').first().text());
    const passName = clean($(rank).closest('.battle-pass-container').find('.pass-name').first().text());
    if (!Number.isInteger(number) || number < 1) return;
    for (const track of ['basic', 'deluxe']) $(rank).find(`.rank-rewards.${track} .reward-item`).each((_, reward) => add(reward, { kind: 'pass', passName, rank: number, paid: track === 'deluxe', detail: track === 'deluxe' ? 'GO Pass Deluxe' : 'Free GO Pass' }, '.reward-name'));
  });
  // Text-only research rewards have no sprite to match. Only accept exact,
  // separately reviewed costume aliases; never infer a costume from species.
  $('.special-research-header').each((_, header) => {
    const title = clean($(header).text());
    if (!/timed research/i.test(title)) return;
    const text = clean($(header).nextUntil('h2,h3').text());
    for (const costume of costumeCatalog) {
      const alias = costume.aliases.find(alias => /wearing/i.test(alias) && text.includes(alias));
      if (!alias) continue;
      const variant = costume.variants.find(member => alias.startsWith(member.name)) || costume.variants[0];
      const image = `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/${variant.asset}.icon.png`;
      // Use the same identity and route validation as image-based rewards.
      const reward = $('<div>').append($('<span class="reward-label">').text(alias), $('<img>').attr('src', image));
      add(reward, { kind: 'timed', detail: title + (/free timed research/i.test(text) ? ' · Free' : ' · Check access requirements in the event guide') }, '.reward-label');
    }
  });
  // A heading advertising Pokémon with unrecognisable encounter markup is a
  // layout failure, rather than evidence that every encounter was removed.
  const advertised = $('.page-content h2,h3').filter((_, element) => /^(spawns|raids|field research|go pass)\b/i.test(clean($(element).text()))).length;
  const recognised = $('.pkmn-list-item,.event-field-research-list,.rank-item').length;
  if (advertised && !recognised && /pokemon_icons/.test(html)) throw Error('Encounter layout changed');
  return [...rows.values()];
}

export async function updateCostumes({ fetcher = fetch, output = 'public/data/costume-encounters.json', now = new Date() } = {}) {
  const get = async (url) => { const response = await fetcher(url, { signal: AbortSignal.timeout(20000) }); if (!response.ok) throw Error(`Source returned ${response.status}`); return response; };
  const events = await (await get(EVENTS)).json();
  if (!Array.isArray(events) || !events.length) throw Error('Invalid event feed; keeping saved data');
  let previous = { encounters: [], sources: [] };
  try { previous = JSON.parse(await readFile(output, 'utf8')); } catch { /* first run */ }
  const encounters = [];
  const sources = [];
  const failures = [];
  if (!events.some(e => eventUrl(e.link) && Date.parse(e.end) > Date.parse(e.start))) throw Error('Event feed format changed; keeping saved data');
  const selected = [...new Map(events.filter(e => eventUrl(e.link) && Date.parse(e.end) > +now && Date.parse(e.start) < +now + 90 * 86400000 && Date.parse(e.end) > Date.parse(e.start)).map(e => [eventUrl(e.link), e])).values()];
  for (const event of selected) {
    event.link = eventUrl(event.link);
    try {
      encounters.push(...parseCostumePage(await (await get(event.link)).text(), event));
      sources.push({ url: event.link, checkedAt: now.toISOString(), ok: true });
    } catch (error) {
      failures.push(event.link);
      // Keep failed pages, with their original check time and expiry; never call them fresh.
      encounters.push(...(previous.encounters || []).map(row => ({ ...row, routes: row.routes.filter(route => route.source === event.link) })).filter(row => row.routes.length));
      sources.push({ url: event.link, checkedAt: previous.sources?.find(s => s.url === event.link)?.checkedAt || null, ok: false });
      console.warn(`Could not update ${event.link}: ${error.message}`);
    }
  }
  if (selected.length && failures.length === selected.length) throw Error('All event pages failed; keeping saved data');
  const data = { version: 1, updatedAt: now.toISOString(), sources, encounters };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output + '.tmp', JSON.stringify(data, null, 2) + '\n');
  await rename(output + '.tmp', output);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) updateCostumes().catch(error => { console.error(error.message); process.exitCode = 1; });
