import seed from '../../public/data/costume-encounters.json' with { type: 'json' };
import { costumeCatalog, findCostume } from './costumes.js';

const REMOTE = 'https://raw.githubusercontent.com/PascalDAspden/shiny-hunt-guide-react/';
const KEY = 'costume-encounters-v1';
export const encounterLabels = { wild: 'Wild', raids: 'Raids', research: 'Field Research', timed: 'Timed Research', pass: 'GO Pass', surprise: 'Surprise boxes', eggs: 'Eggs' };
const trustedUrl = (value, host) => { try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === host; } catch { return false; } };
export function validCostumeFeed(data) {
  return data?.version === 1 && Number.isFinite(Date.parse(data.updatedAt)) && Array.isArray(data.sources) && data.sources.every(source =>
    source && trustedUrl(source.url, 'leekduck.com') && typeof source.ok === 'boolean' && (source.checkedAt === null || Number.isFinite(Date.parse(source.checkedAt)))) && Array.isArray(data.encounters) && data.encounters.every(row =>
    row && typeof row.name === 'string' && /^pm\d+\.[\w.]+$/.test(row.asset) && trustedUrl(row.image, 'cdn.leekduck.com') && Array.isArray(row.routes) && row.routes.every(route =>
      route && ['detail', 'event', 'passName'].every(key => route[key] === undefined || typeof route[key] === 'string') && encounterLabels[route.kind] && Number.isFinite(Date.parse(route.start)) && Date.parse(route.end) > Date.parse(route.start) && trustedUrl(route.source, 'leekduck.com') && (route.kind !== 'pass' || (Number.isInteger(route.rank) && route.rank > 0 && typeof route.paid === 'boolean'))));
}
export async function fetchCostumeEncounters() {
  let saved = seed;
  try { const cached = JSON.parse(localStorage.getItem(KEY)); if (validCostumeFeed(cached) && Date.parse(cached.updatedAt) >= Date.parse(saved.updatedAt)) saved = cached; } catch { /* offline storage unavailable */ }
  for (const branch of ['main', 'feature/costume-pokemon']) {
    try {
      const response = await fetch(`${REMOTE}${branch}/public/data/costume-encounters.json`, { cache: 'no-cache', signal: AbortSignal.timeout(10000) });
      if (!response.ok) continue;
      const data = await response.json();
      if (!validCostumeFeed(data) || Date.parse(data.updatedAt) < Date.parse(saved.updatedAt)) continue;
      try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* still usable */ }
      return { data, cached: false, failed: data.sources.some(source => source.ok === false), stale: Date.now() - Date.parse(data.updatedAt) > 48 * 60 * 60 * 1000 };
    } catch { /* try the working branch or saved data */ }
  }
  return { data: saved, cached: true, failed: true, stale: Date.now() - Date.parse(saved.updatedAt) > 48 * 60 * 60 * 1000 };
}

/** Encounter updates never change the separately reviewed evolution rules. */
export function buildCostumeCatalogue(data = seed) {
  const catalogue = costumeCatalog.map(costume => ({ ...costume, sources: [...costume.sources], availability: [] }));
  for (const row of data.encounters) {
    const known = findCostume({ image: row.image, name: row.name });
    let costume = known && catalogue.find(entry => entry.id === known.costume.id);
    if (!costume) {
      const id = 'live:' + row.asset;
      costume = catalogue.find(entry => entry.id === id);
      if (!costume) {
        const name = row.name.split(/\s+wearing\s+/i)[0];
        costume = { id, label: name === row.name ? 'Event costume' : row.name.slice(name.length).replace(/^ wearing /, ''), evolutionStatus: 'unconfirmed', note: 'The costume-specific evolution rule has not been verified yet. Check the evolution preview in Pokémon GO.', sources: [], availability: [], variants: [{ id, dex: Number(row.asset.match(/^pm(\d+)/)?.[1]), name, asset: row.asset, image: row.image, shinyAvailable: row.shinyAvailable === true }] };
        catalogue.push(costume);
      }
    }
    if (row.shinyAvailable === true) {
      // Copies of the same asset can appear in multiple event guides.
      costume = { ...costume, variants: costume.variants.map(member => member.asset === row.asset ? { ...member, shinyAvailable: true } : member) };
      catalogue[catalogue.findIndex(entry => entry.id === costume.id)] = costume;
    }
    for (const route of row.routes) {
      const method = `${encounterLabels[route.kind]}${route.kind === 'pass' ? ` · ${route.paid ? 'Deluxe (paid)' : 'Free'} · Rank ${route.rank}` : route.detail ? ` · ${route.detail}` : ''}`;
      const window = { ...route, method };
      const samePass = window.kind === 'pass' && window.passName && costume.availability.find(existing => existing.kind === 'pass' && existing.passName === window.passName && existing.rank === window.rank && existing.paid === window.paid && Date.parse(existing.end) >= Date.parse(window.start) && Date.parse(window.end) >= Date.parse(existing.start));
      if (samePass) {
        if (Date.parse(window.start) < Date.parse(samePass.start)) samePass.start = window.start;
        if (Date.parse(window.end) > Date.parse(samePass.end)) samePass.end = window.end;
      } else if (!costume.availability.some(existing => JSON.stringify(existing) === JSON.stringify(window))) costume.availability.push(window);
      if (!costume.sources.includes(route.source)) costume.sources.push(route.source);
    }
  }
  // Keep the reviewed archive, but never invent new windows from old releases.
  for (const costume of catalogue) if (!costume.availability.length) costume.availability = (costumeCatalog.find(entry => entry.id === costume.id)?.availability || []).filter(window => Date.parse(window.end) <= Date.parse(data.updatedAt));
  return catalogue;
}
