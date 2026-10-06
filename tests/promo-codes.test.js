import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePromoCodes, mergePromoCodes, scrapePromoCodes } from '../scripts/scrape-promo-codes.js';
import { isAvailable, normalizeCodes, redeemUrl } from '../src/utils/promoCodes.js';

// Small fixtures reflecting the inspected HTML; these are test-only codes.
const card = (code, expiry = '', extra = '') => `<div class="promo-card ${extra}"><h3 class="title">Test reward</h3><div class="code-display"><p class="text">${code}</p></div><ul class="reward-list"><li><span class="quantity">×5</span><span class="reward-label">Poké Ball</span></li><li><img></li></ul>${expiry}</div>`;
const page = (cards) => `<h1>Available Promo Codes</h1><div class="promo-container">${cards}</div>`;
const date = (raw, hidden = 'false', label = 'Expires') => `<span class="expiry" data-expires="${raw}" data-hide-expiry="${hidden}">${label}</span>`;

test('parses rewards, offsets, unknown expiry, incomplete cards, and duplicate codes', () => {
  const codes = parsePromoCodes(page(card('TEST', date('2027-01-15 23:59:59 -0800')) + card('test', date('2027-01-15 23:59:59 -0800')) + card('UNKNOWN', date('2027-01-15 23:59:59 -0800', 'true', 'Expires: ???')) + card('MISSING', date('invalid')) + card('')), Date.parse('2026-10-06'));
  assert.equal(codes.length, 3);
  assert.deepEqual(codes[0].rewards, ['×5 Poké Ball']);
  assert.equal(codes[0].expires, '2027-01-15T23:59:59-08:00');
  assert.equal(codes[1].expires, null);
  assert.equal(codes[2].expires, null);
  const local = parsePromoCodes(page(card('LOCAL', date('2027-01-15 23:59:00'))));
  assert.equal(local[0].expires, '2027-01-15T23:59:00');
});

test('expiry date and explicit expired flag both exclude Available', () => {
  const codes = parsePromoCodes(page(card('PAST', date('2020-01-01 00:00:00 -0800')) + card('FLAG', '', 'expired') + card('UNKNOWN')), Date.parse('2026-10-06'));
  assert.deepEqual(codes.filter((code) => isAvailable(code)).map((code) => code.code), ['UNKNOWN']);
  assert.equal(isAvailable({ active: true, expires: 'invalid' }), false);
});

test('updates existing codes and archives removed ones without duplicates', () => {
  const old = parsePromoCodes(page(card('OLD') + card('SAME')));
  const fresh = parsePromoCodes(page(card('SAME') + card('NEW')));
  const merged = mergePromoCodes(fresh, old);
  assert.equal(merged.length, 3);
  assert.equal(merged.find((code) => code.code === 'OLD').active, false);
  assert.equal(new Set(merged.map((code) => code.id)).size, merged.length);
});

test('one request per run, deterministic output, and failures leave JSON untouched', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'promo-test-'));
  const path = join(directory, 'codes.json');
  let requests = 0;
  const fetchPage = async () => { requests++; return new Response(page(card('TEST'))); };
  try {
    await scrapePromoCodes(path, fetchPage);
    const original = await readFile(path, 'utf8');
    await scrapePromoCodes(path, fetchPage);
    assert.equal(requests, 2);
    assert.equal(await readFile(path, 'utf8'), original);
    for (const failingFetch of [async () => { throw new Error('Offline'); }, async () => new Response('Unavailable', { status: 503 }), async () => new Response('<h1>Challenge page</h1>'), async () => new Response(page(card('')))]) {
      await assert.rejects(scrapePromoCodes(path, failingFetch));
      assert.equal(await readFile(path, 'utf8'), original);
    }
    await scrapePromoCodes(path, async () => new Response(page('')));
    assert.equal(JSON.parse(await readFile(path, 'utf8'))[0].active, false);
  } finally { await rm(directory, { recursive: true }); }
});

test('frontend validates JSON and always constructs an official redemption URL', () => {
  assert.equal(normalizeCodes([{code: 'CODE', active: true, redeemUrl: 'https://bad.example'}, {code: 'code', active: true}]).length, 1);
  const url = new URL(redeemUrl('A B&TEST'));
  assert.equal(url.origin, 'https://store.pokemongo.com');
  assert.equal(url.pathname, '/offer-redemption');
  assert.equal(url.searchParams.get('passcode'), 'A B&TEST');
  assert.throws(() => normalizeCodes({}));
  assert.deepEqual(normalizeCodes([]), []);
});

test('generated live data has no duplicate or expired available codes', async () => {
  const codes = JSON.parse(await readFile(new URL('../src/data/promo-codes.json', import.meta.url), 'utf8'));
  assert.equal(new Set(codes.map((code) => code.code.toLowerCase())).size, codes.length);
  for (const code of codes.filter((code) => code.active)) {
    assert.ok(isAvailable(code));
    assert.equal(new URL(code.redeemUrl).searchParams.get('passcode'), code.code);
  }
});
