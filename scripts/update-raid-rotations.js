import { load } from 'cheerio';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const MANIFEST = 'https://leekduck.com/raids/manifest.json';
export function rotationDate(value, local) {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2})(\d{2})$/);
  return match ? `${match[1]}T${match[2]}${local ? '' : `${match[3]}:${match[4]}`}` : null;
}
const clean = value => String(value || '').replace(/\s+/g, ' ').trim();
export function parseRaidRotation(html, shadow = false) {
  const $ = load(html), bosses = [];
  $('.tier').each((_, section) => {
    const tier = clean($(section).find('.tier-label').first().text());
    if (!/^(?:[1356]-Star|(?:Super )?Mega) Raids$/i.test(tier)) throw Error('Raid tier layout changed');
    $(section).find('.card').each((_, card) => {
      const node = $(card), name = clean(node.find('.name').text());
      const image = node.find('.boss-img > img').attr('src');
      if (!name || !/^https:\/\/cdn\.leekduck\.com\/assets\/img\/pokemon_icons(?:_crop)?\//.test(image || '')) throw Error('Invalid raid boss card');
      const cp = selector => { const match = clean(node.find(selector).text()).match(/(\d+)\s*[-–]\s*(\d+)/); return match ? { min: +match[1], max: +match[2] } : undefined; };
      bosses.push({ name: shadow && !/^Shadow /i.test(name) ? `Shadow ${name}` : name, image, tier, canBeShiny: node.find('.shiny-icon').length > 0, types: node.find('.type-label').map((_, type) => clean($(type).text())).get(), combatPower: { normal: cp('.cp-range'), boosted: cp('.boosted-cp') } });
    });
  });
  if (!bosses.length) throw Error('No raid cards found; retaining saved rotation');
  return bosses;
}
export async function updateRaidRotations({ fetcher = fetch, output = 'public/data/raid-rotations.json', now = new Date() } = {}) {
  const get = async url => { const r = await fetcher(url, { signal: AbortSignal.timeout(25000) }); if (!r.ok) throw Error(`Raid source returned ${r.status}`); return r; };
  const manifest = await (await get(MANIFEST)).json();
  if (!Array.isArray(manifest.regular_raids) || !Array.isArray(manifest.shadow_raids)) throw Error('Invalid raid manifest');
  let saved = { rotations: [] };
  try { saved = JSON.parse(await readFile(output, 'utf8')); } catch { /* first update */ }
  const rotations = [], failed = [];
  const entries = [...manifest.regular_raids.map(r => ({ ...r, shadow: false })), ...manifest.shadow_raids.map(r => ({ ...r, shadow: true }))];
  let attempted = 0, succeeded = 0;
  for (const entry of entries) {
    // Place-specific/ticketed events need geographic eligibility data that this
    // manifest does not provide; never silently treat them as worldwide.
    if (entry.tags?.includes('Exclusive')) continue;
    const start = rotationDate(entry.start_date, entry.local_time), end = rotationDate(entry.end_date, entry.local_time);
    if (!/^[a-z0-9-]+$/.test(entry.slug || '') || !start || !end || Date.parse(end) <= Date.parse(start)) throw Error('Invalid raid rotation metadata');
    if (Date.parse(end) < +now - 2 * 86400000 || Date.parse(start) > +now + 90 * 86400000) continue;
    attempted++;
    const source = `https://leekduck.com/raids/${entry.slug}.html`;
    try {
      const bosses = parseRaidRotation(await (await get(source)).text(), entry.shadow);
      rotations.push({ id: entry.slug, title: entry.title, description: entry.description || '', start, end, shadow: entry.shadow, tags: entry.tags || [], source, checkedAt: now.toISOString(), ok: true, bosses });
      succeeded++;
    } catch (error) {
      failed.push(entry.slug);
      const previous = saved.rotations?.find(r => r.id === entry.slug);
      if (previous) rotations.push({ ...previous, ok: false });
      console.warn(`Could not update ${entry.slug}: ${error.message}`);
    }
  }
  if (!attempted || !succeeded) throw Error('No raid rotations could update; saved data retained');
  const data = { version: 1, updatedAt: now.toISOString(), failed, rotations };
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output + '.tmp', JSON.stringify(data, null, 2) + '\n');
  await rename(output + '.tmp', output);
  console.info(`Updated ${rotations.length} dated raid rotations`);
  return data;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) updateRaidRotations().catch(error => { console.error(error.message); process.exitCode = 1; });
