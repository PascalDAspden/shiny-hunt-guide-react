import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

await mkdir(new URL('../node_modules/.cache/', import.meta.url), { recursive: true });
const output = new URL('../node_modules/.cache/calendar-test.mjs', import.meta.url);
await build({ entryPoints: [fileURLToPath(new URL('../src/data/events.js', import.meta.url))], outfile: fileURLToPath(output), bundle: true, format: 'esm', plugins: [{ name: 'native-calendar-test', setup(builder) {
  builder.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'calendar-bridge', namespace: 'test' }));
  builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const Capacitor = { isNativePlatform: () => true, getPlatform: () => "ios" }; export const registerPlugin = () => ({ open: args => globalThis.openCalendar(args) });' }));
} }] });
const { addToCalendar } = await import(output.href);
const event = { name: 'Spotlight Hour', start: '2026-11-05T18:00:00', end: '2026-11-05T19:00:00', link: 'https://leekduck.com/events/' };

test('native calendar opens an editor with local dates converted to instants and a 30-minute alarm', async () => {
  let args;
  globalThis.openCalendar = async (value) => { args = value; return { status: 'saved' }; };
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: () => { throw Error('Must not share'); } } });
  assert.equal(await addToCalendar(event), 'saved');
  assert.equal(args.start, new Date(event.start).toISOString());
  assert.equal(args.end, new Date(event.end).toISOString());
  assert.equal(args.title, event.name);
  assert.equal(args.alarmMinutes, 30);
});
test('cancelling the native editor never launches file sharing', async () => {
  globalThis.openCalendar = async () => ({ status: 'cancelled' });
  assert.equal(await addToCalendar(event), 'cancelled');
});
test('invalid dates or a missing native plugin give feedback instead of falling through to sharing', async () => {
  let alerts = 0;
  globalThis.window = { alert: () => { alerts += 1; } };
  globalThis.openCalendar = async () => { throw Error('Plugin unavailable'); };
  assert.equal(await addToCalendar(event), 'failed');
  assert.equal(await addToCalendar({ ...event, end: 'invalid' }), 'failed');
  assert.equal(alerts, 2);
});
