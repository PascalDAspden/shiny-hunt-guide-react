import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
const initialDOM = new JSDOM('<div></div>');
globalThis.window = initialDOM.window;
globalThis.document = initialDOM.window.document;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: initialDOM.window.navigator });
const { createRoot } = await import('react-dom/client');

const directory = new URL('../node_modules/.cache/', import.meta.url);
await mkdir(directory, { recursive: true });
const output = new URL('hunt-review-ui.mjs', directory);
await build({ stdin: { contents: `export { default as HuntMap } from './src/pages/HuntMap.jsx'; export { default as MaxRotations } from './src/pages/MaxRotations.jsx'; export { default as App } from './src/App.jsx';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, outfile: fileURLToPath(output), bundle: true, format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
const emptyLocations = async () => ({ data: [], failed: false, cached: false });
const { HuntMap, MaxRotations, App } = await import(output.href);
function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://guide.test/', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label || node.lastElementChild?.textContent === label);
async function click(node) { assert.ok(node); await act(async () => node.click()); }
async function input(dom, element, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(element, value);
    element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  });
}

test('map requires a recent opt-in GPS fix and explicit map consent; radius and directions work', async () => {
  const dom = setup(), root = createRoot(document.getElementById('root'));
  const position = { latitude: -36.85, longitude: 174.76, timestamp: Date.now(), accuracy: 100 };
  try {
    await act(async () => root.render(React.createElement(HuntMap, { loadLocations: emptyLocations, location: { enabled: false } })));
    assert.equal(document.querySelector('iframe'), null);
    assert.match(document.body.textContent, /No live gym or Power Spot location feed/);
    await act(async () => root.render(React.createElement(HuntMap, { loadLocations: emptyLocations, location: { enabled: true, position } })));
    assert.equal(document.querySelector('iframe'), null);
    await click(button('Load map'));
    const previous = document.querySelector('iframe').src;
    assert.equal(new URL(previous).searchParams.get('marker'), '-36.85,174.76');
    await act(async () => { const select = document.querySelector('select'); select.value = '10'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.notEqual(document.querySelector('iframe').src, previous);
    await input(dom, document.querySelector('[aria-label="Destination latitude"]'), '-36.86');
    await input(dom, document.querySelector('[aria-label="Destination longitude"]'), '174.76');
    assert.match(document.body.textContent, /1.11 km in a straight line/);
    assert.ok([...document.querySelectorAll('a')].some(a => a.textContent === 'Walking directions ↗' && new URL(a.href).hostname === 'maps.apple.com' && new URL(a.href).searchParams.get('dirflg') === 'w'));
    await act(async () => root.render(React.createElement(HuntMap, { loadLocations: emptyLocations, location: { enabled: true, position: { ...position, timestamp: 0 } } })));
    assert.equal(document.querySelector('iframe'), null);
    assert.match(document.body.textContent, /Update your location/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('Max page keeps Monday-only entries outside weekly availability and filters special events', async () => {
  const dom = setup(), root = createRoot(document.getElementById('root'));
  const tomorrow = new Date(Date.now() + 86400000).toISOString(), next = new Date(Date.now() + 2 * 86400000).toISOString();
  const events = [
    { eventID: 'm', name: 'Dynamax Machop during Max Monday', eventType: 'max-mondays', start: tomorrow, end: next },
    { eventID: 'g', name: 'Gigantamax Test Max Battle Day', eventType: 'max-battles', start: tomorrow, end: next }
  ];
  try {
    await act(async () => root.render(React.createElement(MaxRotations, { events })));
    await click(button('Upcoming rotation'));
    assert.match(document.body.textContent, /No confirmed weekly Pokémon/);
    assert.equal(document.querySelectorAll('.pokemon-card').length, 2);
    assert.match(document.body.textContent, /MONDAY FEATURED/);
    await act(async () => root.render(React.createElement(MaxRotations, { events, query: 'Machop' })));
    assert.equal(document.querySelectorAll('.pokemon-card').length, 1);
    assert.match(document.querySelector('.pokemon-card').textContent, /Machop/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('App preserves checklist checks and tracked hunts through Map, eggs, research and remount', async t => {
  const dom = setup(); let root = createRoot(document.getElementById('root'));
  const oldFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = oldFetch; });
  const image = 'https://cdn.leekduck.com/assets/img/pokemon_icons/pm25.icon.png';
  const updatedAt = new Date().toISOString();
  const fixture = url => {
    if (url.endsWith('/eggs.json')) return [{ name: 'Pikachu', image, canBeShiny: true, eggType: '2 km' }];
    if (url.endsWith('/research.json')) return [{ text: 'Catch 5 Pokémon', rewards: [{ name: 'Bulbasaur', image }] }];
    if (url.endsWith('/raid-rotations.json') || url.endsWith('/max-rotations.json')) return { version: 1, updatedAt, rotations: [] };
    if (url.endsWith('/hunt-locations.json')) return { version: 1, updatedAt, locations: [] };
    if (url.endsWith('/rocket_lineups.json')) return {};
    return [];
  };
  globalThis.fetch = async url => Response.json(fixture(String(url)));
  try {
    await act(async () => root.render(React.createElement(App)));
    assert.equal(document.querySelectorAll('.bottom-nav button').length, 4);
    await click(button('Checklist'));
    let row = [...document.querySelectorAll('.checklist-row')].find(node => node.textContent.includes('Pikachu'));
    assert.ok(row);
    await click(row.querySelector('input'));
    await click(row.querySelector('button'));
    assert.equal(JSON.parse(localStorage.getItem('shiny-checklist-v1')).length, 1);
    await click(button('Map'));
    assert.match(document.body.textContent, /Nearby hunt map/);
    await click(button('Hunt'));
    assert.ok(document.querySelector('.checklist-row.is-checked'));
    assert.match(document.querySelector('.tracked-hunt').textContent, /Pikachu/);
    await click(button('Eggs 1'));
    assert.match(document.querySelector('main').textContent, /2 km/);
    await click(button('Research 1'));
    assert.match(document.querySelector('main').textContent, /Catch 5 Pokémon/);
    await act(async () => root.unmount());
    root = createRoot(document.getElementById('root'));
    await act(async () => root.render(React.createElement(App)));
    await click(button('Checklist'));
    assert.ok(document.querySelector('.checklist-row.is-checked'));
    assert.match(document.querySelector('.tracked-hunt').textContent, /Pikachu/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('sourced location card shows only verified encounter details, battle filtering and Apple directions', async () => {
  const dom = setup(), root = createRoot(document.getElementById('root'));
  const now = Date.now();
  const position = { latitude: -36.85, longitude: 174.76, timestamp: now };
  const row = { id: 'fixture', name: 'Fixture Power Spot', kind: 'power-spot', latitude: -36.851, longitude: 174.76, source: 'https://example.test/place', checkedAt: new Date(now).toISOString(), encounter: { verified: true, name: 'Fixture Machop', battleType: 'dynamax', canBeShiny: true, source: 'https://example.test/battle', checkedAt: new Date(now).toISOString(), start: new Date(now - 60000).toISOString(), end: new Date(now + 600000).toISOString() } };
  const loader = async () => ({ data: [row], failed: false });
  try {
    await act(async () => root.render(React.createElement(HuntMap, { location: { enabled: true, position }, loadLocations: loader })));
    await click([...document.querySelectorAll('.map-location-list button')][0]);
    assert.match(document.querySelector('[aria-label="Selected hunt location"]').textContent, /Fixture Machop/);
    assert.match(document.querySelector('[aria-label="Selected hunt location"]').textContent, /Shiny available \(source verified\)/);
    const directions = [...document.querySelectorAll('a')].find(node => node.textContent === 'Get Directions in Apple Maps ↗');
    assert.equal(new URL(directions.href).searchParams.get('daddr'), '-36.851,174.76');
    await click(button('Gigantamax'));
    assert.equal(document.querySelector('.map-location-list').children.length, 0);
    assert.equal(document.querySelector('[aria-label="Selected hunt location"]'), null);
    await click(button('Dynamax'));
    assert.equal(document.querySelector('.map-location-list').children.length, 1);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
