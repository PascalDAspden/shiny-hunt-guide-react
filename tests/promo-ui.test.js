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
const output = new URL('promo-ui.mjs', directory);
await build({ entryPoints: [fileURLToPath(new URL('../src/pages/PromoCodes.jsx', import.meta.url))], outfile: fileURLToPath(output), bundle: true, format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
const { default: PromoCodes } = await import(output.href);
const appOutput = new URL('app-ui.mjs', directory);
await build({ entryPoints: [fileURLToPath(new URL('../src/App.jsx', import.meta.url))], outfile: fileURLToPath(appOutput), bundle: true, format: 'esm', jsx: 'automatic', external: ['react', 'react/jsx-runtime'] });
const { default: App } = await import(appOutput.href);

function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://guide.example/' });
  for (const key of ['window', 'document', 'localStorage']) globalThis[key] = dom.window[key];
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}
const data = [
  { id: 'promo-test', title: 'Test reward', code: 'TEST', rewards: ['5 Poké Balls'], expires: null, active: true },
  { id: 'promo-expired', title: 'Expired reward', code: 'EXPIRED', rewards: [], expires: '2020-01-01T00:00:00Z', active: true },
  { id: 'promo-partial', code: 'PARTIAL', rewards: null, expires: null, active: true }
];
function button(text) { return [...document.querySelectorAll('button')].find((node) => node.textContent === text); }
async function click(node) { assert.ok(node); await act(async () => { node.click(); }); }
async function mount() {
  const root = createRoot(document.getElementById('root'));
  await act(async () => { root.render(React.createElement(PromoCodes)); });
  return root;
}

test('Copy, Redeem, filters, expiry, and saved redeemed state after remount', async () => {
  const dom = setup();
  globalThis.fetch = async () => new Response(JSON.stringify(data));
  let copied;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value) => { copied = value; } } });
  let root = await mount();
  try {
    assert.equal(document.querySelectorAll('.promo-card').length, 2);
    assert.ok(!document.body.textContent.includes('Expired reward'));
    assert.ok(document.body.textContent.includes('Reward details not listed.'));
    await click(button('Copy Code'));
    assert.equal(copied, 'TEST');
    assert.match(document.querySelector('[role="status"]').textContent, /Copied!/);
    const redeem = document.querySelector('a.promo-redeem');
    assert.equal(redeem.href, 'https://store.pokemongo.com/offer-redemption?passcode=TEST');
    assert.equal(redeem.target, '_blank');
    assert.match(redeem.rel, /noopener/);
    await click(button('Mark as Redeemed'));
    assert.ok(!document.querySelector('.promo-grid').textContent.includes('TEST'));
    assert.deepEqual(JSON.parse(localStorage.getItem('redeemed-promo-codes-v1')), ['promo-test']);
    await act(async () => root.unmount());
    root = await mount();
    assert.ok(!document.querySelector('.promo-grid').textContent.includes('TEST'));
    await click(button('Redeemed'));
    assert.match(document.querySelector('.promo-grid').textContent, /TEST/);
    await click(button('Mark as Available'));
    await click(button('Available'));
    assert.match(document.querySelector('.promo-grid').textContent, /TEST/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('zero codes and offline feed remain usable; clipboard failure gives feedback', async () => {
  const dom = setup();
  globalThis.fetch = async () => new Response('[]');
  let root = await mount();
  try {
    assert.match(document.body.textContent, /No active Pokémon GO promo codes found right now\./);
    await act(async () => root.unmount());
    localStorage.setItem('promo-codes-cache-v1', JSON.stringify(data));
    globalThis.fetch = async () => { throw new Error('Offline'); };
    root = await mount();
    assert.equal(document.querySelectorAll('.promo-card').length, 2);
    assert.match(document.body.textContent, /Showing saved promo information/);
    await click(button('Copy Code'));
    assert.match(document.querySelector('[role="status"]').textContent, /Copy unavailable/);
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('malformed saved redeemed data and blocked storage do not crash', async () => {
  const dom = setup();
  localStorage.setItem('redeemed-promo-codes-v1', '{}');
  globalThis.fetch = async () => new Response(JSON.stringify(data));
  const root = await mount();
  try {
    const savedStorage = globalThis.localStorage;
    globalThis.localStorage = { getItem: () => { throw new Error('Blocked'); }, setItem: () => { throw new Error('Blocked'); } };
    await click(button('Mark as Redeemed'));
    assert.match(document.querySelector('[role="status"]').textContent, /Storage unavailable/);
    globalThis.localStorage = savedStorage;
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});

test('main navigation adds one Promo Codes button and preserves Hunt and Calendar', async () => {
  const dom = setup();
  globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).includes('promo-codes.json') ? data : []));
  const root = createRoot(document.getElementById('root'));
  try {
    await act(async () => root.render(React.createElement(App)));
    assert.equal([...document.querySelectorAll('button')].filter((node) => node.textContent.includes('Promo Codes')).length, 1);
    await click([...document.querySelectorAll('.bottom-nav button')].find((node) => node.textContent.includes('Promo Codes')));
    assert.ok(document.querySelector('.promo-page'));
    await click([...document.querySelectorAll('.bottom-nav button')].find((node) => node.textContent.includes('Calendar')));
    assert.match(document.body.textContent, /Event calendar/);
    await click([...document.querySelectorAll('.bottom-nav button')].find((node) => node.textContent.includes('Hunt')));
    assert.match(document.body.textContent, /Shiny targets/);
    assert.ok(document.querySelector('.search-wrap'));
    assert.ok(document.querySelector('.odds-open-button'));
  } finally { await act(async () => root.unmount()); dom.window.close(); }
});
