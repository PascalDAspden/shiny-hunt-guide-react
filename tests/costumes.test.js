import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { costumeCatalog, costumeArtwork, costumeAvailability, findCostume, isCostumeEncounter } from '../src/data/costumes.js';

const get = (id) => costumeCatalog.find((costume) => costume.id === id);

test('costume chains preserve the outfit and Piplup never inherits its ordinary evolution', () => {
  assert.deepEqual(get('zubat-top-hat').variants.map((v) => [v.dex, v.candy]), [[41, null], [42, 25], [169, 100]]);
  assert.ok(get('zubat-top-hat').variants.every((v) => v.asset.includes('HALLOWEEN_2026_01')));
  assert.equal(get('piplup-halloween-mischief').evolutionStatus, 'locked');
  assert.deepEqual(get('piplup-halloween-mischief').variants.map((v) => v.dex), [393]);
  assert.equal(get('pikachu-hat-capelet').evolutionStatus, 'unconfirmed');
  assert.equal(get('sinistea-bow-phony').variants[1].candy, 50);
  assert.equal(get('sinistea-bow-antique').variants[1].candy, 400);
});

test('asset identity wins over generic names; species and distinct Gengar costumes never merge', () => {
  assert.equal(findCostume({ name: 'Zubat' }), null);
  assert.equal(isCostumeEncounter({ name: 'Crobat' }), false);
  assert.equal(isCostumeEncounter({ name: 'Pikachu wearing a new hat' }), true);
  assert.equal(findCostume({ name: 'Sinistea wearing a bow', image: 'https://example.com/pm854.fA_HALLOWEEN_2026_01.s.icon.png' }).costume.id, 'sinistea-bow-antique');
  assert.equal(findCostume({ name: 'Zubat', image: 'https://example.com/pm41.fHALLOWEEN_2026_01.g2.s.icon.png' }).costume.id, 'zubat-top-hat');
  assert.equal(findCostume({ name: 'Gengar wearing a Tricks & Treats costume' }).costume.id, 'gengar-tricks-treats');
  assert.equal(findCostume({ name: 'Gengar wearing a Spooky Festival costume' }).costume.id, 'gengar-spooky-festival');
});

test('event boundaries follow local time; paid rewards and future encounters remain distinct', () => {
  const costume = get('vulpix-spooky-festival');
  assert.equal(costumeAvailability(costume, new Date('2026-10-27T09:59:59')).status, 'upcoming');
  assert.equal(costumeAvailability(costume, new Date('2026-10-27T10:00:00')).status, 'now');
  assert.equal(costumeAvailability(costume, new Date('2026-11-01T10:00:00')).status, 'past');
  const rowlet = costumeAvailability(get('rowlet-halloween'), new Date('2026-10-29T17:00:00'));
  assert.deepEqual(rowlet.windows.map((window) => window.method), ['GO Pass reward · Free and Deluxe tracks']);
  assert.equal(costumeAvailability(get('gengar-spooky-festival'), new Date('2026-10-29T17:00:00')).status, 'now');
  assert.equal(costumeAvailability(get('zubat-top-hat'), new Date('2026-12-01T12:00:00')).status, 'past');
  assert.equal(get('zubat-top-hat').evolutionStatus, 'can-evolve');
});

test('every listed costume has distinct, bundled normal and shiny files and review sources', async () => {
  const ids = new Set();
  for (const costume of costumeCatalog) {
    assert.ok(!ids.has(costume.id)); ids.add(costume.id);
    assert.ok(costume.sources.every((source) => source.startsWith('https://')));
    for (const member of costume.variants) {
      assert.notEqual(costumeArtwork(member), costumeArtwork(member, true));
      await access(new URL(`../public${costumeArtwork(member)}`, import.meta.url));
      await access(new URL(`../public${costumeArtwork(member, true)}`, import.meta.url));
    }
  }
});
