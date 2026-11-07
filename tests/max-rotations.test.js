import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMaxEventRoster, parseWeeklyMaxAnnouncement } from '../scripts/update-max-rotations.js';

test('extracts only explicitly announced weekly Max windows', () => {
  const event = { name: 'Dynamax Machop during Max Monday' };
  const text = 'Dynamax Machop may appear in Max Battles from November 2, 2026 through November 8, 2026.';
  const result = parseWeeklyMaxAnnouncement(text, event, 'https://leekduck.com/events/max-mondays-2026-11-02/');
  assert.equal(result.length, 1);
  assert.equal(result[0].species, 'Machop');
  assert.equal(result[0].start, '2026-11-02T00:00:00');
  assert.equal(result[0].end, '2026-11-09T00:00:00');
});

test('does not mistake a single Max Monday for seven days of confirmed rotation', () => {
  const event = { name: 'Dynamax Machop during Max Monday' };
  assert.deepEqual(parseWeeklyMaxAnnouncement('Max Monday November 2, 2026 6 AM to 9 PM', event, 'https://leekduck.com/events/'), []);
});

test('rejects invalid or implausibly long date windows', () => {
  const event = { name: 'Dynamax Machop during Max Monday' };
  assert.deepEqual(parseWeeklyMaxAnnouncement('Machop may appear in Max Battles from November 2, 2026 through December 9, 2026.', event, 'https://leekduck.com/events/'), []);
});

test('reads Max bosses embedded in an event, clips dated bosses, and excludes research and wild spawns', () => {
  const list = (name, classes = '') => `<ul class="pkmn-list-flex ${classes}"><li class="pkmn-list-item"><div class="pkmn-name">${name}</div></li></ul>`;
  const event = {
    eventID: 'wild-area', name: 'GO Wild Area', link: 'https://leekduck.com/events/wild-area/',
    start: '2026-11-14T10:00:00', end: '2026-11-15T18:00:00'
  };
  const html = `<div class="page-content">
    <h2>Max Battles</h2>
    <h3>Six-Star Max Battles</h3>${list('Gigantamax Duraludon')}
    <p>Pokémon appearing in five-star Max Battles will also be featured in Max Battles from 6:00 p.m. to 7:00 p.m. local time for one day each on the following schedule.</p>
    <h3>Five-Star Max Battles: Saturday, November 14</h3>${list('Dialga', '-dmax')}
    <h3>Sunday, November 15</h3>${list('Palkia', '-dmax')}
    <h2>Research</h2>${list('Machamp', '-dmax')}
    <h2>Wild Encounters</h2>${list('Chansey')}
  </div>`;
  const records = parseMaxEventRoster(html, event);
  assert.deepEqual(records.map(r => [r.form, r.species, r.start, r.end]), [
    ['Gigantamax', 'Duraludon', event.start, event.end],
    ['Dynamax', 'Dialga', event.start, '2026-11-15T00:00:00'],
    ['Dynamax', 'Palkia', '2026-11-15T00:00:00', event.end]
  ]);
  assert.equal(records[0].battleWindow, undefined);
  assert.deepEqual(records[1].battleWindow, {
    start: '2026-11-14T18:00:00', end: '2026-11-14T19:00:00', label: 'Featured hour'
  });
  assert.equal(records[2].battleWindow, undefined);
  assert.ok(records.every(r => r.kind === 'event' && r.source === event.link));
});
