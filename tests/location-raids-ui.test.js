import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const directory = new URL('../node_modules/.cache/', import.meta.url);
await mkdir(directory, { recursive: true });
const output = new URL('location-raids-ui.mjs', directory);
await build({ stdin: { contents: `import React from 'react'; import useGuideLocation from './src/hooks/useGuideLocation.js'; import LocationControl from './src/components/LocationControl.jsx'; export { parseDate } from './src/utils/dates.js'; export { default as Raids } from './src/pages/Raids.jsx'; export function Guide() { const location = useGuideLocation(() => globalThis.onMove()); return React.createElement(LocationControl, {location}); }`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, outfile: fileURLToPath(output), bundle: true, format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'], plugins: [{ name: 'native-location-mock', setup(builder) {
  builder.onResolve({ filter: /^@capacitor\/core$/ }, () => ({ path: 'bridge', namespace: 'mock' }));
  builder.onLoad({ filter: /.*/, namespace: 'mock' }, () => ({ contents: `export const Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' }; export const registerPlugin = () => ({ getLocation: () => globalThis.getFix(), cancel: async () => { globalThis.cancelCount++; } });` }));
} }] });
const { Guide, Raids, parseDate } = await import(output.href);
function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://guide.test/', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.cancelCount = 0;
  return dom;
}
const button = label => [...document.querySelectorAll('button')].find(b => b.textContent === label);
async function click(label) { assert.ok(button(label), label); await act(async () => button(label).click()); }

test('GPS is opt-in, updates event time, refreshes after moving and cancels late results', async () => {
  const dom = setup(); let calls = 0, moves = 0;
  globalThis.onMove = () => moves++;
  let fix = { latitude: -36.85, longitude: 174.76, timestamp: Date.now(), timeZone: 'Pacific/Auckland', place: 'Auckland, New Zealand' };
  globalThis.getFix = async () => { calls++; return fix; };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(Guide)));
    assert.equal(calls, 0);
    await click('Use my location');
    assert.equal(moves, 1);
    assert.match(document.body.textContent, /Auckland, New Zealand/);
    assert.equal(parseDate('2026-11-01T10:00:00').toISOString(), '2026-10-31T21:00:00.000Z');
    await click('Update location'); assert.equal(moves, 1);
    fix = { ...fix, latitude: -37.85 };
    await click('Update location'); assert.equal(moves, 2);
    let release;
    globalThis.getFix = () => new Promise(resolve => { release = resolve; });
    await click('Update location');
    await click('Turn location off');
    assert.equal(moves, 3);
    await act(async () => release(fix));
    assert.match(document.body.textContent, /Using device time/);
    assert.equal(+parseDate('2026-11-01T10:00:00'), +new Date('2026-11-01T10:00:00'));
    assert.ok(globalThis.cancelCount > 0);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('denied GPS permission leaves a working device-time guide', async () => {
  const dom = setup(); globalThis.onMove = () => {};
  globalThis.getFix = async () => { throw Error('Location permission denied'); };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(Guide)));
    await click('Use my location');
    assert.match(document.body.textContent, /Location permission was denied/);
    assert.equal(+parseDate('2026-11-01T10:00:00'), +new Date('2026-11-01T10:00:00'));
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('normal 1-star and 3-star raids display by default; Shadow is a separate filter', async () => {
  const dom = setup(); const root = createRoot(document.getElementById('root'));
  const raids = [{ name: 'Pikachu', tier: '1-Star Raids', canBeShiny: true }, { name: 'Locked normal boss', tier: '3-Star Raids', canBeShiny: false }, { name: 'Shadow Gastly', tier: '1-Star Raids', canBeShiny: true }];
  try {
    await act(async () => root.render(React.createElement(Raids, { raidsFeed: raids, events: [], pokemonInfo: {}, isActive: () => false, query: '', appearance: 'normal' })));
    assert.equal(document.querySelectorAll('.raid-card').length, 3);
    assert.equal(document.querySelector('input[type="checkbox"]').checked, false);
    const select = document.querySelector('select[aria-label="Raid type"]');
    await act(async () => { select.value = 'one'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelectorAll('.raid-card').length, 1);
    assert.match(document.querySelector('.raid-card').textContent, /Pikachu/);
    await act(async () => { select.value = 'three'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.match(document.querySelector('.raid-card').textContent, /Locked normal boss/);
    await act(async () => document.querySelector('input[type="checkbox"]').click());
    assert.match(document.querySelector('.empty').textContent, /Turn off Shiny-capable only/);
    await act(async () => { select.value = 'shadow'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.match(document.querySelector('.raid-card').textContent, /Shadow Gastly/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});


test('losing a GPS timezone refreshes date-dependent feeds after reverting to device time', async () => {
  const dom = setup(); let moves = 0;
  globalThis.onMove = () => moves++;
  globalThis.getFix = async () => ({ latitude: -36.85, longitude: 174.76, timestamp: Date.now(), timeZone: 'Pacific/Auckland' });
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(Guide)));
    await click('Use my location');
    assert.equal(moves, 1);
    globalThis.getFix = async () => { throw Error('Location permission denied'); };
    await click('Update location');
    assert.equal(moves, 2);
    assert.equal(+parseDate('2026-11-01T10:00:00'), +new Date('2026-11-01T10:00:00'));
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
