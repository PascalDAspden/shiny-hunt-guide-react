// Live feed loading (ScrapedDuck, via Leek Duck's community-run mirror) plus
// the shiny-odds and raid-boss derivation logic that used to live in the
// original app's monolithic app.js.
import { parseDate, now } from '../utils/dates.js';

const FEED_BASE = 'https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/';

/** Fetches one ScrapedDuck feed, caching the last good copy in localStorage as an offline fallback. */
export async function loadFeed(name) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(FEED_BASE + name + '.json', { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) throw new Error(`${name}: ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('Unexpected feed shape');
    try {
      localStorage.setItem('feed-' + name, JSON.stringify({ saved: Date.now(), data }));
    } catch {
      /* storage full or unavailable; ignore */
    }
    return { data, cached: false, failed: false };
  } catch {
    try {
      const saved = JSON.parse(localStorage.getItem('feed-' + name));
      if (Array.isArray(saved?.data)) return { data: saved.data, cached: true, failed: false, saved: saved.saved };
    } catch {
      /* no offline copy available */
    }
    return { data: [], cached: false, failed: true };
  } finally {
    clearTimeout(timeout);
  }
}

export const fetchRaidsFeed = () => loadFeed('raids');
export const fetchEggsFeed = () => loadFeed('eggs');
export const fetchResearchFeed = () => loadFeed('research');
export const fetchEventsFeed = () => loadFeed('events');

/** Leek Duck's Rocket encounter slots and per-Pokémon shiny flags, via Leak Duck. */
export async function fetchRocketFeed() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch('https://raw.githubusercontent.com/zhenga8533/leak-duck/data/rocket_lineups.json', { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) throw new Error('Rocket feed unavailable');
    const data = await response.json();
    if (!data || Array.isArray(data) || typeof data !== 'object') throw new Error('Unexpected Rocket feed');
    try { localStorage.setItem('feed-rocket', JSON.stringify({ saved: Date.now(), data })); } catch { /* storage unavailable */ }
    return { data, cached: false, failed: false };
  } catch {
    try {
      const saved = JSON.parse(localStorage.getItem('feed-rocket'));
      if (saved?.data && !Array.isArray(saved.data) && typeof saved.data === 'object') return { data: saved.data, cached: true, failed: false };
    } catch { /* no saved copy */ }
    return { data: {}, cached: false, failed: true };
  } finally { clearTimeout(timeout); }
}

export function rate(value, confidence, reason, note = '') {
  return { value, confidence, reason, note };
}

/** True while a Raid Day event for this raid boss is currently live. */
function currentRaidDayFor(name, events) {
  const wanted = String(name).replace(/^(shadow|mega)\s+/i, '').toLowerCase();
  return events.some((e) => {
    if (e.eventType !== 'raid-day' || !e.start || !e.end) return false;
    const active = parseDate(e.start) <= now() && now() < parseDate(e.end);
    const named =
      e.name.toLowerCase().includes(wanted) ||
      (e.extraData?.raidbattles?.bosses || []).some((b) => String(b.name).toLowerCase() === String(name).toLowerCase());
    return active && named;
  });
}

/** The shiny-rate estimate shown on a raid card, given the wider event list for Raid Day detection. */
export function raidRate(raid, events = []) {
  const tier = String(raid.tier || '').toLowerCase();
  const shadow = /^shadow\s/i.test(raid.name);
  if (currentRaidDayFor(raid.name, events)) return rate('1/10', 'event-specific', 'Named Raid Day boss, during event hours only');
  if (shadow && tier.includes('5-star')) return rate('1/20', 'estimated', 'Tier 5 Shadow raid');
  if (shadow && /[13]-star/.test(tier)) return rate('1/64', 'estimated', 'Tier 1/3 Shadow raid');
  if (tier.includes('mega')) return rate('1/64', 'estimated', 'Mega raid');
  if (tier.includes('5-star') || tier.includes('ultra beast')) return rate('1/20', 'confirmed guide rate', 'Tier 5 / Legendary raid');
  if (/[13]-star/.test(tier)) return rate('1/64', 'estimated', 'Tier 1/3 raid');
  return rate('Rate unknown', 'unknown', 'No supported rate for this raid type');
}

/** Events still worth showing (well-formed, not already over). */
export function validEvents(events) {
  return events
    .filter((e) => {
      const start = parseDate(e.start);
      const end = parseDate(e.end);
      return start && end && !isNaN(start) && !isNaN(end) && end > now() && end > start;
    })
    .sort((a, b) => parseDate(a.start) - parseDate(b.start));
}

/** Find an active, dated raid rotation that explicitly lists this boss. */
export function currentRaidRotation(raid, events, reference = now()) {
  const normalized = (name) => String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const wanted = normalized(raid.name);
  const candidates = events.filter((event) => {
    if (event.eventType !== 'raid-battles') return false;
    const start = parseDate(event.start);
    const end = parseDate(event.end);
    if (!start || !end || !Number.isFinite(+start) || !Number.isFinite(+end) || start > reference || end <= reference) return false;
    const shadow = /^shadow\s/i.test(event.name || '');
    return (event.extraData?.raidbattles?.bosses || []).some((boss) => {
      const name = normalized(boss.name);
      return name && (name === wanted || (shadow && normalized(`Shadow ${boss.name}`) === wanted));
    });
  });
  // A boss can occur in multiple overlapping rotations; show the nearest dated end.
  return candidates.sort((a, b) => parseDate(a.end) - parseDate(b.end))[0] || null;
}

/** Turns future raid-battle rotation events into raid-card-shaped objects. */
export function scheduledRaids(events, raidsFeed, pokemonInfo = {}) {
  return validEvents(events)
    .filter((e) => e.eventType === 'raid-battles' && parseDate(e.start) > now())
    .flatMap((event) =>
      (event.extraData?.raidbattles?.bosses || [])
        .filter((b) => b.name)
        .map((b) => {
          const shadow = /^shadow\s/i.test(event.name);
          const name = shadow && !/^shadow\s/i.test(b.name) ? 'Shadow ' + b.name : b.name;
          const linked = raidsFeed.find((r) => r.name.toLowerCase() === name.toLowerCase());
          const species = b.name.replace(/\s*\(.+\)/, '').replace(/^mega\s+/i, '').toLowerCase();
          const legendary = pokemonInfo[species]?.legendary;
          const tier = /mega raids?/i.test(event.name)
            ? 'Mega Raids'
            : /5-star/i.test(event.name) || (shadow && legendary)
              ? '5-Star Raids'
              : shadow
                ? 'Shadow Raids (tier unconfirmed)'
                : 'Raid tier unconfirmed';
          return {
            name,
            image: b.image,
            tier,
            canBeShiny: b.canBeShiny,
            event,
            combatPower: linked?.combatPower,
            types: linked?.types
          };
        })
    );
}

/** Keep every Pokémon reward. The source currently marks even known shiny species false. */
export function researchRewards(researchFeed) {
  return researchFeed.flatMap((task) =>
    (task.rewards || [])
      .filter((reward) => reward.name && reward.image)
      .map((reward) => ({ ...reward, feedCanBeShiny: reward.canBeShiny, canBeShiny: undefined, task: String(task.text || '').replace(/<[^>]*>/g, '') }))
  );
}
