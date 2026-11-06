import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWeeklyMaxAnnouncement } from '../scripts/update-max-rotations.js';

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
