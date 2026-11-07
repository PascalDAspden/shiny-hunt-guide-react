import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { maxRotationEntries, rotationStatus, fetchMaxRotations, validMaxRotations } from '../src/data/maxRotations.js';
import { updateMaxRotations } from '../scripts/update-max-rotations.js';
import { fetchRaidRotations } from '../src/data/raidRotations.js';
import { setEventTimeZone } from '../src/utils/dates.js';
import { fetchWithTimeout } from '../src/utils/fetch.js';

const rotation = { id: 'manual-id', form: 'Dynamax', species: 'Machop', start: '2026-11-02T00:00:00', end: '2026-11-09T00:00:00', source: 'https://leekduck.com/events/max-mondays-2026-11-02/' };
const monday = { name: 'Dynamax Machop during Max Monday', eventType: 'max-mondays', eventID: 'monday', start: '2026-11-02T18:00:00', end: '2026-11-02T19:00:00', link: rotation.source };

test('Max Monday uses only announced hours across GPS zones and expires at its end', t => {
  t.after(() => setEventTimeZone(null));
  const [entry] = maxRotationEntries([], [monday]);
  assert.equal(entry.kind, 'monday');
  assert.equal(entry.start, monday.start);
  assert.equal(rotationStatus(entry, new Date('2026-11-05')), 'expired');
  setEventTimeZone('Pacific/Auckland');
  assert.equal(rotationStatus(entry, new Date('2026-11-02T05:30:00Z')), 'current');
  assert.equal(rotationStatus(entry, new Date('2026-11-02T06:00:00Z')), 'expired');
  setEventTimeZone('America/Los_Angeles');
  assert.equal(rotationStatus(entry, new Date('2026-11-02T05:30:00Z')), 'upcoming');
  assert.equal(maxRotationEntries([], [{ ...monday, end: null }]).length, 0);
  assert.equal(maxRotationEntries([rotation], [monday]).length, 1);
});

test('Max updater deduplicates hand-curated IDs and does not refresh timestamps without evidence', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'max-review-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'max.json');
  const saved = { version: 1, updatedAt: '2026-11-01T00:00:00Z', rotations: [rotation] };
  await writeFile(output, JSON.stringify(saved));
  const fetcher = async url => url.endsWith('events.json') ? Response.json([monday]) : new Response('Dynamax Machop may appear in Max Battles from november 2, 2026 through november 8, 2026.');
  const data = await updateMaxRotations({ output, now: new Date('2026-11-02'), fetcher });
  assert.equal(data.rotations.length, 1);
  assert.equal(validMaxRotations(data), true);
  const before = await readFile(output, 'utf8');
  await updateMaxRotations({ output, now: new Date('2026-11-05'), fetcher: async () => Response.json([]) });
  assert.equal(await readFile(output, 'utf8'), before);
  await updateMaxRotations({ output, fetcher: async () => { throw Error('offline'); } });
  assert.equal(await readFile(output, 'utf8'), before);
});

function mockNetwork(t) {
  const previousFetch = globalThis.fetch, previousStorage = globalThis.localStorage;
  t.after(() => { globalThis.fetch = previousFetch; globalThis.localStorage = previousStorage; });
  const items = new Map();
  globalThis.localStorage = { getItem: key => items.get(key) || null, setItem: (key, value) => items.set(key, value) };
  return items;
}

test('Max cache rejects rollback and malformed data and keeps dated offline seed', async t => {
  const items = mockNetwork(t);
  const fresh = { version: 1, updatedAt: '2027-01-01T00:00:00Z', rotations: [rotation] };
  globalThis.fetch = async () => Response.json(fresh);
  assert.equal((await fetchMaxRotations()).cached, false);
  globalThis.fetch = async () => Response.json({ ...fresh, updatedAt: '2026-01-01T00:00:00Z', rotations: [] });
  let result = await fetchMaxRotations();
  assert.equal(result.failed, true);
  assert.equal(result.data[0].species, 'Machop');
  globalThis.fetch = async () => Response.json({ ...fresh, rotations: [{ ...rotation, end: 'bad' }] });
  assert.equal((await fetchMaxRotations()).failed, true);
  assert.deepEqual(JSON.parse(items.get('max-rotations-v1')), fresh);
  items.clear();
  globalThis.fetch = async () => { throw Error('offline'); };
  result = await fetchMaxRotations();
  assert.equal(result.cached, true);
  assert.ok(result.data.length > 0);
  assert.ok(result.data.every(item => rotationStatus(item, new Date('2030-01-01')) === 'expired'));
});

test('raid offline fallback reports a failed refresh', async t => {
  mockNetwork(t);
  globalThis.fetch = async () => { throw Error('offline'); };
  const result = await fetchRaidRotations();
  assert.equal(result.cached, true);
  assert.equal(result.failed, true);
});

test('fetch timeout works without AbortSignal.timeout, aborts and covers slow bodies', async t => {
  mockNetwork(t);
  const original = AbortSignal.timeout;
  AbortSignal.timeout = undefined;
  t.after(() => { AbortSignal.timeout = original; });
  globalThis.fetch = async () => Response.json({ ok: true });
  assert.deepEqual(await (await fetchWithTimeout('https://example.test')).json(), { ok: true });
  globalThis.fetch = async (_, { signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('aborted'))));
  await assert.rejects(fetchWithTimeout('https://example.test', {}, 10), /aborted/);
  globalThis.fetch = async (_, { signal }) => ({ arrayBuffer: () => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(Error('body aborted')))) });
  await assert.rejects(fetchWithTimeout('https://example.test', {}, 10), /body aborted/);
});


test('species metadata supplies rotation artwork and transient failures can retry', async t => {
  mockNetwork(t);
  const { fetchSpeciesInfo, fetchRaidMatchup } = await import('../src/data/pokemon.js');
  globalThis.fetch = async () => { throw Error('offline'); };
  assert.equal(await fetchSpeciesInfo('Machop'), null);
  globalThis.fetch = async () => Response.json({ id: 66, is_legendary: false });
  const info = await fetchSpeciesInfo('Machop');
  assert.equal(info.id, 66);
  assert.match(info.image, /official-artwork\/66.png$/);
  const urls = [];
  globalThis.fetch = async url => { urls.push(url); return Response.json({ damage_relations: {} }); };
  const matchup = await fetchRaidMatchup('Test feed types', { types: ['Electric'] });
  assert.deepEqual(matchup.types, ['electric']);
  assert.equal(urls.length, 1);
  assert.match(urls[0], /\/type\/electric$/);
});

test('ordinary 1-star and 3-star tiers do not invent a uniform shiny rate', async () => {
  const { raidRate } = await import('../src/data/raids.js');
  for (const name of ['Normal boss', 'Shadow boss']) for (const tier of ['1-Star Raids', '3-Star Raids']) {
    assert.equal(raidRate({ name, tier }).value, 'Rate unknown');
  }
});
