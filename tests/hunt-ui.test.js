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
await build({ stdin: { contents: `export { default as MaxRotations } from './src/pages/MaxRotations.jsx'; export { default as App } from './src/App.jsx';`, resolveDir: fileURLToPath(new URL('../', import.meta.url)) }, outfile: fileURLToPath(output), bundle: true, format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
const { MaxRotations, App } = await import(output.href);
function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://guide.test/', pretendToBeVisual: true });
  for (const key of ['window', 'document', 'localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: dom.window.navigator });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}
const button = label => [...document.querySelectorAll('button')].find(node => node.textContent === label || node.lastElementChild?.textContent === label);
async function click(node) { assert.ok(node); await act(async () => node.click()); }
test('Max page keeps Monday-only entries outside weekly availability and filters special events', async () => {
  const dom = setup(), root = createRoot(document.getElementById('root'));
  const tomorrow = new Date(Date.now() + 86400000).toISOString(), next = new Date(Date.now() + 2 * 86400000).toISOString();
  const events = [
    { eventID: 'm', name: 'Dynamax Machop during Max Monday', eventType: 'max-mondays', start: tomorrow, end: next },
    { eventID: 'g', name: 'Gigantamax Test Max Battle Day', eventType: 'max-battles', start: tomorrow, end: next }
  ];
  try {
    const rotations = [{ id: 'roster', kind: 'event', form: 'Dynamax', species: 'Ralts', eventName: 'Into the Wild',
      start: tomorrow, end: next, source: 'https://leekduck.com/events/into-the-wild/' }];
    await act(async () => root.render(React.createElement(MaxRotations, { events, rotations })));
    assert.doesNotMatch(document.body.textContent, /Dynamax Ralts/);
    await click(button('Upcoming rotation'));
    assert.match(document.body.textContent, /No confirmed weekly Pokémon/);
    assert.equal(document.querySelectorAll('.pokemon-card').length, 3);
    assert.match(document.body.textContent, /Dynamax Ralts/);
    assert.match(document.body.textContent, /MONDAY FEATURED/);
    await act(async () => root.render(React.createElement(MaxRotations, { events, rotations, query: 'Machop' })));
    assert.equal(document.querySelectorAll('.pokemon-card').length, 1);
    assert.match(document.querySelector('.pokemon-card').textContent, /Machop/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('Max Battle cards count down to and through the verified featured hour only', async t => {
  const dom = setup(), root = createRoot(document.getElementById('root'));
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: new Date('2026-11-11T17:30:00Z') });
  const battle = { id: 'registeel', kind: 'event', form: 'Dynamax', species: 'Registeel',
    eventName: 'Into the Wild', start: '2026-11-11T00:00:00Z', end: '2026-11-12T00:00:00Z',
    day: '2026-11-11', source: 'https://leekduck.com/events/into-the-wild-2026/',
    battleWindow: { start: '2026-11-11T18:00:00Z', end: '2026-11-11T19:00:00Z', label: 'Featured hour' } };
  const dateOnly = { ...battle, id: 'dialga', species: 'Dialga', battleWindow: undefined };
  const registeel = () => [...document.querySelectorAll('.pokemon-card')].find(card => card.textContent.includes('Registeel'));
  try {
    await act(async () => root.render(React.createElement(MaxRotations, { rotations: [battle, dateOnly] })));
    assert.match(registeel().textContent, /Featured hour starts in 30m/);
    assert.equal(document.querySelectorAll('.countdown').length, 1);
    assert.equal(document.querySelectorAll('.calendar-button').length, 1);
    await act(async () => t.mock.timers.tick(30 * 60000));
    assert.match(registeel().textContent, /Featured hour ends in 1h/);
    await act(async () => t.mock.timers.tick(60 * 60000));
    assert.equal(registeel().querySelector('.countdown'), null);
    assert.equal(registeel().querySelector('.calendar-button'), null);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('App opens the guide directly and keeps eggs and research accessible', async t => {
  const dom = setup(); const root = createRoot(document.getElementById('root'));
  const oldFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = oldFetch; });
  const image = 'https://cdn.leekduck.com/assets/img/pokemon_icons/pm25.icon.png';
  const updatedAt = new Date().toISOString();
  const fixture = url => {
    if (url.endsWith('/eggs.json')) return [{ name: 'Pikachu', image, canBeShiny: true, eggType: '2 km' }];
    if (url.endsWith('/research.json')) return [{ text: 'Catch 5 Pokémon', rewards: [{ name: 'Bulbasaur', image }] }];
    if (url.endsWith('/raid-rotations.json') || url.endsWith('/max-rotations.json')) return { version: 1, updatedAt, rotations: [] };
    if (url.endsWith('/rocket_lineups.json')) return {};
    return [];
  };
  globalThis.fetch = async url => Response.json(fixture(String(url)));
  try {
    await act(async () => root.render(React.createElement(App)));
    assert.equal(document.querySelectorAll('.bottom-nav button').length, 3);
    assert.equal(button('Map'), undefined);
    assert.equal(button('Checklist'), undefined);
    assert.doesNotMatch(document.querySelector('main').textContent, /dashboard|active hunt/i);
    await click(button('Eggs 1'));
    assert.match(document.querySelector('main').textContent, /2 km/);
    await click(button('Research 1'));
    assert.match(document.querySelector('main').textContent, /Catch 5 Pokémon/);
    assert.equal(button('Track hunt'), undefined);
    assert.doesNotMatch(document.querySelector('main').textContent, /On checklist/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
