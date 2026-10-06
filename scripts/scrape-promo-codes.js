import { load } from 'cheerio';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SOURCE_URL = 'https://leekduck.com/promo-codes/';

// Inspected on 6 October 2026: .promo-card, .code-display .text,
// h3.title, .reward-list li, .reward-label, .quantity, .expiry[data-expires].
function text(value) { return value.replace(/\s+/g, ' ').trim(); }

export function parseExpiry(element) {
  // Hidden dates accompany "???" on Leek Duck; they are not a known expiry.
  if (element.attr('data-hide-expiry') === 'true' || /\?/.test(element.text())) return null;
  const raw = element.attr('data-expires') || '';
  const match = raw.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\s*([+-]\d{2}):?(\d{2})|\s*(Z))?$/);
  if (!match) return null;
  const date = `${match[1]}T${match[2]}${match[3] ? `${match[3]}:${match[4]}` : match[5] || ''}`;
  return Number.isFinite(Date.parse(date)) ? date : null;
}

export function parsePromoCodes(html, now = Date.now()) {
  const $ = load(html);
  if (!$('.promo-container').length || !/Available Promo Codes/i.test($('h1').text())) {
    throw new Error('Leek Duck page structure changed; keeping the previous JSON.');
  }
  const codes = new Map();
  const cards = $('.promo-container .promo-card');
  cards.each((_, element) => {
    const card = $(element);
    const code = text(card.find('.code-display .text').first().text());
    if (!/^[a-z0-9_-]+$/i.test(code)) {
      console.warn('Skipping a promo card with no readable code.');
      return;
    }
    const expires = parseExpiry(card.find('.expiry').first());
    const active = !card.hasClass('expired') && !/^Expired$/i.test(text(card.find('.expiry').text())) &&
      (!expires || new Date(expires).getTime() > now);
    const rewards = card.find('.reward-list li').map((_, reward) => {
      const item = $(reward);
      const label = text(item.find('.reward-label').text());
      const quantity = text(item.find('.quantity').text());
      return label ? text(`${quantity} ${label}`) : null;
    }).get();
    const title = text(card.find('h3.title').first().text());
    codes.set(code.toLowerCase(), {
      id: `promo-${code.toLowerCase()}`, ...(title ? { title } : {}), code,
      rewards: [...new Set(rewards)], expires, sourceUrl: SOURCE_URL,
      redeemUrl: `https://store.pokemongo.com/offer-redemption?passcode=${encodeURIComponent(code)}`, active
    });
  });
  if (cards.length && !codes.size) throw new Error('No readable codes in promo cards; keeping the previous JSON.');
  return [...codes.values()];
}

export function mergePromoCodes(current, previous) {
  // Keep archived entries only if this project previously displayed them.
  // A removed code is unavailable, even when its expiry is unknown.
  const known = new Map(current.filter((entry) => entry.active).map((entry) => [entry.code.toLowerCase(), entry]));
  for (const old of previous) {
    if (!old || typeof old.code !== 'string') continue;
    const key = old.code.toLowerCase();
    if (!known.has(key)) known.set(key, current.find((entry) => entry.code.toLowerCase() === key) || { ...old, active: false });
  }
  return [...known.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export async function scrapePromoCodes(output, fetchPage = fetch) {
  let previous = [];
  try { previous = JSON.parse(await readFile(output, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!Array.isArray(previous)) throw new Error('Existing promo JSON must be an array.');
  // Exactly one request. No retry loop, browser rendering, or other pages.
  const response = await fetchPage(SOURCE_URL, { signal: AbortSignal.timeout(30000), headers: { 'User-Agent': 'ShinyHuntGuide-PromoCodes/1.0 (personal project)' } });
  if (!response.ok) throw new Error(`Leek Duck returned HTTP ${response.status}; previous JSON unchanged.`);
  const entries = mergePromoCodes(parsePromoCodes(await response.text()), previous);
  const json = JSON.stringify(entries, null, 2) + '\n';
  let existing;
  try { existing = await readFile(output, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (json !== existing) {
    await mkdir(dirname(output), { recursive: true });
    await writeFile(`${output}.tmp`, json);
    await rename(`${output}.tmp`, output);
  }
  console.log(`${entries.filter((entry) => entry.active).length} available codes; ${json === existing ? 'no changes' : 'JSON updated'}: ${output}`);
  return entries;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flag = process.argv.indexOf('--output');
  const output = flag < 0 ? fileURLToPath(new URL('../src/data/promo-codes.json', import.meta.url)) : resolve(process.argv[flag + 1]);
  scrapePromoCodes(output).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
