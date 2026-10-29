import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseCostumePage, updateCostumes } from '../scripts/update-costumes.js';
import { buildCostumeCatalogue, fetchCostumeEncounters, validCostumeFeed } from '../src/data/costumeEncounters.js';
import { costumeAvailability, costumeCatalog } from '../src/data/costumes.js';

const event = { name: 'Test event', start: '2027-01-01T10:00:00', end: '2027-01-07T20:00:00', link: 'https://leekduck.com/events/test/' };
const asset = 'pm41.fHALLOWEEN_2026_01';
const image = `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/${asset}.icon.png`;
const item = (name = 'Zubat wearing a top hat', src = image) => `<li class="pkmn-list-item"><img src="${src}"><span class="pkmn-name">${name}</span><span class="pokemon-cutout-shiny"></span></li>`;
const page = content => `<div class="page-content"><h1>Test event</h1><section class="event-schedule"></section>${content}</div>`;
const row = { name: 'Zubat wearing a top hat', asset, image, shinyAvailable: true, routes: [{ kind: 'wild', start: event.start, end: event.end, source: event.link }] };
const feed = () => ({ version: 1, updatedAt: '2027-01-02T00:00:00Z', sources: [{ url: event.link, checkedAt: '2027-01-02T00:00:00Z', ok: true }], encounters: [structuredClone(row)] });

test('parser separates acquisition sections from debuts and shiny previews, including new costumes', () => {
  const html = page(`<h2>Features</h2><h3>Pokémon Debuts</h3><ul>${item('Pikachu wearing a future crown', 'https://cdn.leekduck.com/assets/img/pokemon_icons_crop/pm25.cFUTURE.icon.png')}</ul><h3>Trick or Treat!</h3><ul>${item()}${item('Candy', 'https://cdn.leekduck.com/assets/img/items/candy.png')}</ul><h2>Spawns</h2><ul>${item()}</ul><h2>Raids</h2><h3>One-Star Raids</h3><ul>${item('Pikachu wearing a future crown', 'https://cdn.leekduck.com/assets/img/pokemon_icons_crop/pm25.cFUTURE.icon.png')}</ul><h2>Shiny</h2><ul>${item()}</ul>`);
  const rows = parseCostumePage(html, event);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].routes.map(r => r.kind), ['surprise', 'wild']);
  assert.deepEqual(rows[1].routes.map(r => r.kind), ['raids']);
  assert.equal(rows[1].routes[0].detail, 'One-Star Raids');
  const catalogue = buildCostumeCatalogue({ ...feed(), encounters: rows });
  const unknown = catalogue.find(c => c.id === 'live:pm25.cFUTURE');
  assert.equal(unknown.evolutionStatus, 'unconfirmed');
  assert.equal(unknown.variants.length, 1);
});

test('parser keeps research tasks, exact pass rank and free/paid access separate', () => {
  const reward = `<img src="${image}"><span class="reward-label">Zubat wearing a top hat</span>`;
  const pass = `<div class="reward-item"><img src="${image}"><span class="reward-name">Zubat wearing a top hat</span></div>`;
  const html = page(`<h2>Research</h2><ul class="event-field-research-list"><li><span class="task">Win a raid</span><div class="reward">${reward}</div></li></ul><h2 class="special-research-header">Test Timed Research</h2><p>Free Timed Research rewards include an encounter with Zubat wearing a top hat.</p><h2>GO Pass</h2><div class="rank-item"><span class="rank-number">29</span><div class="rank-rewards basic">${pass}</div><div class="rank-rewards deluxe">${pass}</div></div>`);
  const [result] = parseCostumePage(html, event);
  assert.equal(result.shinyAvailable, null);
  assert.equal(result.routes.find(r => r.kind === 'research').detail, 'Win a raid');
  assert.deepEqual(result.routes.filter(r => r.kind === 'pass').map(r => [r.rank, r.paid]), [[29, false], [29, true]]);
  assert.match(result.routes.find(r => r.kind === 'timed').detail, /Free/);
  assert.ok(result.routes.every(r => r.end === event.end));
});

test('updater preserves failed sources with original expiry/check time; complete failure leaves file untouched', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'costume-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'encounters.json');
  const initial = feed();
  await writeFile(output, JSON.stringify(initial));
  const other = { ...event, link: 'https://leekduck.com/events/other/' };
  const mock = async url => url.includes('events.json') ? Response.json([event, other]) : url === event.link ? new Response('failure', { status: 503 }) : new Response(page('<h2>Bonuses</h2><p>Extra XP</p>'));
  const data = await updateCostumes({ fetcher: mock, output, now: new Date('2027-01-03T00:00:00Z') });
  assert.equal(data.sources[0].ok, false);
  assert.equal(data.sources[0].checkedAt, initial.sources[0].checkedAt);
  assert.deepEqual(data.encounters, initial.encounters);
  const before = await readFile(output, 'utf8');
  await assert.rejects(updateCostumes({ fetcher: async url => url.includes('events.json') ? Response.json([event]) : new Response('broken layout'), output, now: new Date('2027-01-03T00:00:00Z') }), /All event pages failed/);
  assert.equal(await readFile(output, 'utf8'), before);
});

test('expiry, unlisted encounters and future events cannot revive old availability', () => {
  const data = feed();
  const zubat = buildCostumeCatalogue(data).find(c => c.id === 'zubat-top-hat');
  assert.equal(costumeAvailability(zubat, new Date('2027-01-07T19:59:59')).status, 'now');
  assert.equal(costumeAvailability(zubat, new Date('2027-01-07T20:00:00')).status, 'past');
  assert.equal(costumeAvailability(zubat, new Date('2026-12-31T20:00:00')).status, 'upcoming');
  const empty = buildCostumeCatalogue({ ...data, updatedAt: '2026-10-29T00:00:00Z', encounters: [] });
  assert.equal(empty.find(c => c.id === 'zubat-top-hat').availability.length, 0);
  assert.equal(costumeCatalog.find(c => c.id === 'zubat-top-hat').sources.includes(event.link), false);
});

test('feed validation rejects malformed sources, unknown methods and invalid pass access', () => {
  assert.equal(validCostumeFeed(feed()), true);
  assert.equal(validCostumeFeed({ ...feed(), sources: {} }), false);
  const data = feed(); data.encounters[0].routes[0].kind = 'pass';
  assert.equal(validCostumeFeed(data), false);
  data.encounters[0].routes[0] = { ...row.routes[0], kind: 'wild', source: 'javascript:alert(1)' };
  assert.equal(validCostumeFeed(data), false);
});

test('app fetch caches newer updates, rejects stale rollback, and retains expiry offline', async t => {
  const originalFetch = globalThis.fetch, originalStorage = globalThis.localStorage;
  t.after(() => { globalThis.fetch = originalFetch; globalThis.localStorage = originalStorage; });
  const values = new Map();
  globalThis.localStorage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const fresh = feed();
  globalThis.fetch = async () => Response.json(fresh);
  assert.equal((await fetchCostumeEncounters()).cached, false);
  globalThis.fetch = async () => Response.json({ ...fresh, updatedAt: '2026-10-01T00:00:00Z' });
  const result = await fetchCostumeEncounters();
  assert.equal(result.cached, true);
  assert.equal(result.data.updatedAt, fresh.updatedAt);
  assert.equal(costumeAvailability(buildCostumeCatalogue(result.data).find(c => c.id === 'zubat-top-hat'), new Date('2027-02-01T00:00:00Z')).status, 'past');
});


test('the same pass across event parts appears once; different passes stay separate', () => {
  const data = feed();
  data.encounters[0].routes = [
    { ...row.routes[0], kind: 'pass', passName: 'GO Pass: Test', rank: 29, paid: false, end: '2027-01-05T10:00:00' },
    { ...row.routes[0], kind: 'pass', passName: 'GO Pass: Test', rank: 29, paid: false, start: '2027-01-05T10:00:00' },
    { ...row.routes[0], kind: 'pass', passName: 'GO Pass: Other', rank: 29, paid: false }
  ];
  const costume = buildCostumeCatalogue(data).find(c => c.id === 'zubat-top-hat');
  assert.equal(costume.availability.length, 2);
  assert.equal(costume.availability[0].start, event.start);
  assert.equal(costume.availability[0].end, event.end);
});
