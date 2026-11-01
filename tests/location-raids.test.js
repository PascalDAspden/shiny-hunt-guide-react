import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setEventTimeZone, parseDate, timeOfDay } from '../src/utils/dates.js';
import { validPosition, distanceKm, locationError } from '../src/data/location.js';
import { chooseRotation, currentRaidPool, upcomingRotationRaids, validRaidRotations } from '../src/data/raidRotations.js';
import { parseRaidRotation, rotationDate, updateRaidRotations } from '../scripts/update-raid-rotations.js';
import { filterRaids } from '../src/utils/raidFilters.js';

const boss = (name, tier, canBeShiny = true) => ({ name, tier, canBeShiny, image: 'https://cdn.leekduck.com/assets/img/pokemon_icons/pm25.icon.png' });
const base = { id: 'regular', title: 'Regular raids', shadow: false, start: '2026-10-28T06:00:00', end: '2026-11-03T20:00:00', tags: [], source: 'https://leekduck.com/raids/regular.html', bosses: [boss('Pikachu', '1-Star Raids'), boss('Normal locked boss', '3-Star Raids', false)] };
const special = { ...base, id: 'raid-day', title: 'Raid Day', start: '2026-10-31T14:00:00', end: '2026-10-31T17:00:00', tags: ['Raid Day'], bosses: [boss('Mega Chandelure', 'Super Mega Raids')] };
const shadow = { ...base, id: 'shadow', shadow: true, bosses: [boss('Shadow Gastly', '1-Star Raids')] };

test('GPS timezone resolves local event boundaries while UTC events keep the same instant', t => {
  t.after(() => setEventTimeZone(null));
  setEventTimeZone('Pacific/Auckland');
  assert.equal(parseDate('2026-11-01T10:00:00').toISOString(), '2026-10-31T21:00:00.000Z');
  assert.equal(parseDate('2026-11-01T10:00:00Z').toISOString(), '2026-11-01T10:00:00.000Z');
  assert.equal(parseDate('2026-11-01T10:00:00+09:00').toISOString(), '2026-11-01T01:00:00.000Z');
  assert.match(timeOfDay(parseDate('2026-11-01T10:00:00')), /10/);
  setEventTimeZone('America/Los_Angeles');
  assert.equal(parseDate('2026-10-31T14:00:00').toISOString(), '2026-10-31T21:00:00.000Z');
  assert.equal(parseDate('2026-03-08T02:30:00').toString(), 'Invalid Date');
  assert.equal(setEventTimeZone('not/a/zone'), null);
  assert.equal(+parseDate('2026-11-01T10:00:00'), +new Date('2026-11-01T10:00:00'));
});

test('same moment selects the local Raid Day only where it is still happening', t => {
  t.after(() => setEventTimeZone(null));
  const reference = new Date('2026-10-31T23:00:00Z');
  setEventTimeZone('America/Los_Angeles');
  assert.equal(chooseRotation([base, special], false, reference).id, 'raid-day');
  setEventTimeZone('Pacific/Auckland');
  assert.equal(chooseRotation([base, special], false, reference).id, 'regular');
  const pool = currentRaidPool([base, special, shadow], special.bosses, reference);
  assert.deepEqual(filterRaids(pool, { raidType: 'one' }).map(r => r.name), ['Pikachu']);
  assert.deepEqual(filterRaids(pool, { raidType: 'three' }).map(r => r.name), ['Normal locked boss']);
  assert.equal(filterRaids(pool, { raidType: 'three', shinyOnly: true }).length, 0);
  assert.deepEqual(filterRaids(pool, { raidType: 'shadow' }).map(r => r.name), ['Shadow Gastly']);
  assert.equal(currentRaidPool([base], base.bosses, new Date('2026-12-01')).length, 0);
  assert.equal(chooseRotation([{ ...base, tags: ['Exclusive'] }], false, reference), null);
  assert.equal(upcomingRotationRaids([base], new Date('2026-01-01')).length, 2);
});

const card = (name, shiny) => `<div class="card"><div class="boss-img"><img src="https://cdn.leekduck.com/assets/img/pokemon_icons/pm25.icon.png">${shiny ? '<svg class="shiny-icon"></svg>' : ''}</div><p class="name">${name}</p><span class="type-label">Electric</span><div class="cp-range">CP 400 - 500</div></div>`;
const fragment = `<div class="tier"><h2 class="tier-label">1-Star Raids</h2>${card('Pikachu', true)}</div><div class="tier"><h2 class="tier-label">3-Star Raids</h2>${card('Normal locked boss', false)}</div>`;

test('rotation fragment reads normal and Shadow tiers, shiny flags and CP', () => {
  const result = parseRaidRotation(fragment);
  assert.equal(result.length, 2);
  assert.equal(result[1].canBeShiny, false);
  assert.deepEqual(result[0].combatPower.normal, { min: 400, max: 500 });
  assert.equal(parseRaidRotation(fragment, true)[0].name, 'Shadow Pikachu');
  assert.throws(() => parseRaidRotation('<h1>Source changed</h1>'), /No raid cards/);
  assert.equal(rotationDate('2026-11-01 10:00:00 -0800', true), '2026-11-01T10:00:00');
  assert.equal(rotationDate('2026-11-01 10:00:00 +0900', false), '2026-11-01T10:00:00+09:00');
});

test('failed updates leave saved rotations untouched; exclusive pools are not published as global', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'raid-update-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const output = join(directory, 'raids.json');
  const saved = { version: 1, updatedAt: '2026-10-30T00:00:00Z', rotations: [{ ...base, checkedAt: '2026-10-30T00:00:00Z', ok: true }] };
  await writeFile(output, JSON.stringify(saved));
  const entry = { slug: 'regular', title: 'Normal raids', start_date: '2026-10-28 06:00:00 -0800', end_date: '2026-11-03 20:00:00 -0800', local_time: true, tags: [] };
  const manifest = { regular_raids: [entry, { ...entry, slug: 'exclusive', tags: ['Exclusive'] }], shadow_raids: [] };
  const before = await readFile(output, 'utf8');
  await assert.rejects(updateRaidRotations({ output, now: new Date('2026-11-01'), fetcher: async url => url.endsWith('manifest.json') ? Response.json(manifest) : new Response('changed layout') }), /saved data retained/);
  assert.equal(await readFile(output, 'utf8'), before);
  const result = await updateRaidRotations({ output, now: new Date('2026-11-01'), fetcher: async url => url.endsWith('manifest.json') ? Response.json(manifest) : new Response(fragment) });
  assert.equal(result.rotations.length, 1);
  assert.equal(validRaidRotations(result), true);
});

test('stale/invalid GPS fixes are rejected and denial has a useful fallback', () => {
  assert.equal(validPosition({ latitude: -36.8, longitude: 174.7, timestamp: Date.now() }), true);
  assert.equal(validPosition({ latitude: 100, longitude: 174.7, timestamp: Date.now() }), false);
  assert.equal(validPosition({ latitude: -36.8, longitude: 174.7, timestamp: Date.now() - 3600000 }), false);
  assert.equal(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 0 }), 0);
  assert.ok(distanceKm({ latitude: 0, longitude: 0 }, { latitude: 0, longitude: 1 }) > 100);
  assert.match(locationError({ code: 1 }), /permission was denied/);
});
