import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { costumeCatalog } from '../src/data/costumes.js';

const fixture = { version: 1, updatedAt: '2026-10-29T18:00:00Z', sources: [], encounters: costumeCatalog.map(costume => ({ name: costume.aliases[0], asset: costume.variants[0].asset, image: `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/${costume.variants[0].asset}.icon.png`, routes: costume.availability.map(window => ({ ...window, kind: costume.id === 'froakie-halloween' ? 'pass' : 'wild', ...(costume.id === 'froakie-halloween' ? { rank: 29, paid: false } : {}) })) })) };
const fixtureFetch = async url => String(url).includes('costume-encounters.json') ? Response.json(fixture) : Response.json([]);

const directory = new URL('../node_modules/.cache/', import.meta.url);
await mkdir(directory, { recursive: true });
const entries = { App: '../src/App.jsx', Costumes: '../src/pages/Costumes.jsx', EvolutionLine: '../src/components/EvolutionLine.jsx' };
const components = {};
for (const [name, path] of Object.entries(entries)) {
  const output = new URL(`costume-${name}.mjs`, directory);
  await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], outfile: fileURLToPath(output), bundle: true, format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
  components[name] = (await import(output.href)).default;
}

function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://guide.example/' });
  for (const key of ['window', 'document', 'localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}
async function click(text) {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent === text);
  assert.ok(button, text);
  await act(async () => button.click());
}

test('Costumes button opens the gallery and preserves raid navigation', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T17:00:00').getTime() });
  const dom = setup();
  globalThis.fetch = fixtureFetch;
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(components.App)));
    await click('Costumes');
    assert.ok(document.querySelector('.costumes-page'));
    assert.equal(document.querySelectorAll('.costume-card').length, 12);
    assert.equal(document.querySelectorAll('.appearance-controls').length, 0);
    assert.match(document.body.textContent, /Evolution locked/);
    assert.match(document.body.textContent, /Where to find/);
    assert.match(document.body.textContent, /GO Pass · Free · Rank 29/);
    assert.match(document.body.textContent, /No Deluxe purchase required/);
    assert.match(document.body.textContent, /Evolution unconfirmed/);
    await click('Raids 0');
    assert.equal(document.querySelector('.costumes-page'), null);
    assert.ok(document.querySelector('.appearance-controls'));
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('filters, evolved-name search, and missing shiny art never substitute a normal Pokémon', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T17:00:00').getTime() });
  const dom = setup();
  globalThis.fetch = fixtureFetch;
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(components.Costumes, { query: 'Crobat' })));
    assert.equal(document.querySelectorAll('.costume-card').length, 1);
    assert.match(document.querySelector('.costume-details').textContent, /100 Zubat Candy/);
    const shiny = document.querySelector('.costume-card-pair img[alt^="Shiny Zubat"]');
    assert.match(shiny.src, /pm41\.fHALLOWEEN_2026_01\.s\.icon\.png$/);
    await act(async () => shiny.dispatchEvent(new dom.window.Event('error')));
    assert.ok(!document.querySelector('.costume-card-pair img[alt^="Shiny Zubat"]'));
    assert.match(document.body.textContent, /Artwork unavailable/);
    await act(async () => root.render(React.createElement(components.Costumes, { query: '' })));
    await click('Upcoming');
    assert.equal(document.querySelectorAll('.costume-card').length, 0);
    assert.match(document.body.textContent, /No listed costumes/);
    await click('All listed');
    const select = document.querySelector('select');
    await act(async () => { select.value = 'locked'; select.dispatchEvent(new dom.window.Event('change', { bubbles: true })); });
    assert.equal(document.querySelectorAll('.costume-card').length, 1);
    assert.match(document.querySelector('.costume-card').textContent, /Piplup/);
    assert.doesNotMatch(document.querySelector('.costume-chain').textContent, /Prinplup|Empoleon/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('known and unknown costume detail views avoid fetching ordinary species evolutions', async () => {
  const dom = setup();
  let requests = 0;
  globalThis.fetch = async () => { requests += 1; return new Response('[]'); };
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(components.EvolutionLine, { item: { name: 'Piplup', image: 'https://example.com/pm393.cHALLOWEEN_2021_NOEVOLVE.icon.png' } })));
    assert.match(document.body.textContent, /Evolution locked/);
    assert.equal(document.querySelectorAll('.costume-stage').length, 1);
    await act(async () => root.render(React.createElement(components.EvolutionLine, { item: { name: 'Pikachu wearing a new hat' } })));
    assert.match(document.body.textContent, /Costume evolution unconfirmed/);
    assert.equal(requests, 0);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});


test('new event costumes arrive without a rebuild; future and unconfirmed rules remain clear', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-10-29T17:00:00').getTime() });
  const dom = setup();
  const data = { version: 1, updatedAt: '2026-10-29T19:00:00Z', sources: [], encounters: [{ name: 'Pikachu wearing a future crown', asset: 'pm25.cFUTURE', image: 'https://cdn.leekduck.com/assets/img/pokemon_icons_crop/pm25.cFUTURE.icon.png', shinyAvailable: null, routes: [{ kind: 'pass', rank: 15, paid: true, start: '2026-11-01T10:00:00', end: '2026-11-05T20:00:00', source: 'https://leekduck.com/events/test/' }] }] };
  globalThis.fetch = async () => Response.json(data);
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(components.Costumes)));
    await click('Upcoming');
    assert.equal(document.querySelectorAll('.costume-card').length, 1);
    assert.match(document.body.textContent, /Evolution unconfirmed/);
    assert.match(document.body.textContent, /Shiny status unconfirmed/);
    assert.match(document.body.textContent, /GO Pass · Deluxe \(paid\) · Rank 15/);
    assert.equal(document.querySelectorAll('.costume-stage').length, 1);
    assert.match(document.querySelector('.costume-find').textContent, /Starts/);
    data.updatedAt = '2026-10-29T20:00:00Z';
    data.encounters[0].routes[0].start = '2026-10-28T10:00:00';
    await click('Refresh costumes');
    assert.equal(document.querySelectorAll('.costume-card').length, 0);
    await click('Available now');
    assert.equal(document.querySelectorAll('.costume-card').length, 1);
    assert.match(document.querySelector('.costume-find').textContent, /Until/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
