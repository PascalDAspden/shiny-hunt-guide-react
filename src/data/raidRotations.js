import { fetchWithTimeout } from '../utils/fetch.js';
import seed from '../../public/data/raid-rotations.json' with { type: 'json' };
import { parseDate } from '../utils/dates.js';

export function validRaidRotations(data) {
  return data?.version === 1 && Number.isFinite(Date.parse(data.updatedAt)) && Array.isArray(data.rotations) && data.rotations.every(r => r && typeof r.id === 'string' && typeof r.title === 'string' && typeof r.shadow === 'boolean' && Array.isArray(r.tags) && Date.parse(r.end) > Date.parse(r.start) && /^https:\/\/leekduck\.com\/raids\//.test(r.source) && Array.isArray(r.bosses) && r.bosses.every(b => b && typeof b.name === 'string' && typeof b.tier === 'string' && typeof b.canBeShiny === 'boolean' && /^https:\/\/cdn\.leekduck\.com\//.test(b.image)));
}
export async function fetchRaidRotations() {
  let saved = seed;
  try { const cache = JSON.parse(localStorage.getItem('raid-rotations-v1')); if (validRaidRotations(cache) && Date.parse(cache.updatedAt) > Date.parse(saved.updatedAt)) saved = cache; } catch { /* no stored guide */ }
  try {
    const r = await fetchWithTimeout('https://raw.githubusercontent.com/PascalDAspden/shiny-hunt-guide-react/main/public/data/raid-rotations.json', { cache: 'no-cache' }, 12000);
    if (!r.ok) throw Error('Raid guide unavailable');
    const data = await r.json();
    if (!validRaidRotations(data) || Date.parse(data.updatedAt) < Date.parse(saved.updatedAt)) throw Error('Invalid or older raid guide');
    try { localStorage.setItem('raid-rotations-v1', JSON.stringify(data)); } catch { /* still usable */ }
    return { data: data.rotations, cached: Date.now() - Date.parse(data.updatedAt) > 48 * 3600000, failed: !!data.failed?.length || data.rotations.some(r => r.ok === false) };
  } catch { return { data: saved.rotations, cached: true, failed: true }; }
}

// Match the source's event selector using the player's selected timezone, not
// the source server's preselected HTML snapshot. Regional-only pools are excluded.
export function chooseRotation(rotations, shadow, reference = new Date()) {
  return rotations.filter(r => r.shadow === shadow && !r.tags.includes('Exclusive') && parseDate(r.start) <= reference && reference < parseDate(r.end))
    .sort((a, b) => Number(b.tags.includes('Event')) - Number(a.tags.includes('Event')) || parseDate(a.end) - parseDate(b.end) || parseDate(b.start) - parseDate(a.start))[0] || null;
}
export function currentRaidPool(rotations, fallback = [], reference = new Date()) {
  const result = [];
  for (const shadow of [false, true]) {
    const rotation = chooseRotation(rotations, shadow, reference);
    if (rotation) {
      const rotationEvent = { eventID: rotation.id, name: rotation.title, start: rotation.start, end: rotation.end, link: rotation.source };
      result.push(...rotation.bosses.map(b => ({ ...b, rotationEvent, rotationDescription: rotation.description })));
    } else {
      // Once a dated pool exists, don't revive an undated snapshot after its
      // rotation expires. Fall back only for a pool the guide has never supplied.
      if (!rotations.some(r => r.shadow === shadow)) result.push(...fallback.filter(b => /^Shadow /i.test(b.name) === shadow));
    }
  }
  return result;
}
export function upcomingRotationRaids(rotations, reference = new Date()) {
  return rotations.filter(r => !r.tags.includes('Exclusive') && parseDate(r.start) > reference).flatMap(r => r.bosses.map(b => ({ ...b, event: { eventID: r.id, name: r.title, start: r.start, end: r.end, link: r.source }, rotationDescription: r.description })));
}
