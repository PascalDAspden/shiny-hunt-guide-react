import test from 'node:test';
import assert from 'node:assert/strict';
import { validLocationFeed, verifiedEncounter, nearbyHuntLocations, fetchHuntLocations } from '../src/data/huntLocations.js';
const now = new Date('2026-11-06T12:00:00Z');
const encounter = { name: 'Fixture Machop', battleType: 'dynamax', verified: true, source: 'https://example.test/encounter', checkedAt: '2026-11-06T11:45:00Z', start: '2026-11-06T11:00:00Z', end: '2026-11-06T12:30:00Z', canBeShiny: true };
const location = { id: 'test-only', name: 'Test-only Power Spot', kind: 'power-spot', latitude: -36.85, longitude: 174.76, source: 'https://example.test/location', checkedAt: '2026-11-06T11:00:00Z', encounter };
const payload = { version: 1, updatedAt: '2026-11-06T12:00:00Z', locations: [location] };

test('location feed requires coordinates, provenance and unique IDs', () => {
  assert.equal(validLocationFeed(payload), true);
  assert.equal(validLocationFeed({ ...payload, locations: [{ ...location, latitude: 91 }] }), false);
  assert.equal(validLocationFeed({ ...payload, locations: [{ ...location, source: 'javascript:alert(1)' }] }), false);
  assert.equal(validLocationFeed({ ...payload, locations: [location, location] }), false);
});

test('map filters only verified active battles; expiry removes encounters but preserves known places', () => {
  const options = { radius: 2, filter: 'dynamax', reference: now };
  assert.equal(nearbyHuntLocations([location], location, options).length, 1);
  assert.equal(nearbyHuntLocations([location], location, { ...options, filter: 'gigantamax' }).length, 0);
  const expired = new Date('2026-11-06T12:30:00Z');
  assert.equal(verifiedEncounter(encounter, expired), false);
  assert.equal(nearbyHuntLocations([location], location, { ...options, reference: expired }).length, 0);
  assert.equal(nearbyHuntLocations([location], location, { radius: 2, reference: expired })[0].encounter, null);
  assert.equal(nearbyHuntLocations([{ ...location, expiresAt: expired.toISOString() }], location, { reference: expired }).length, 0);
  assert.equal(nearbyHuntLocations([location], { latitude: 0, longitude: 0 }, options).length, 0);
  assert.equal(verifiedEncounter({ ...encounter, verified: false }, now), false);
  assert.equal(verifiedEncounter({ ...encounter, checkedAt: '2027-01-01T00:00:00Z' }, now), false);
});

test('location fetch preserves a newer cache offline or after rollback', async t => {
  const original = globalThis.fetch, storage = globalThis.localStorage;
  t.after(() => { globalThis.fetch = original; globalThis.localStorage = storage; });
  const cache = new Map();
  globalThis.localStorage = { getItem: key => cache.get(key) || null, setItem: (key, value) => cache.set(key, value) };
  globalThis.fetch = async () => Response.json(payload);
  assert.equal((await fetchHuntLocations()).data.length, 1);
  globalThis.fetch = async () => Response.json({ ...payload, updatedAt: '2020-01-01T00:00:00Z', locations: [] });
  assert.equal((await fetchHuntLocations()).data.length, 1);
  globalThis.fetch = async () => { throw Error('offline'); };
  const result = await fetchHuntLocations();
  assert.equal(result.failed, true);
  assert.equal(result.cached, true);
  assert.equal(result.data[0].id, 'test-only');
});
