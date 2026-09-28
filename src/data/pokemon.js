// Network-backed Pokémon lookups (PokéAPI + PogoAPI). These supplement the
// live Pokémon GO feeds in data/raids.js and data/events.js with species
// metadata the feeds don't carry: legendary status, shiny form artwork,
// evolution trees and type match-ups.
import { pokemonForm, pokemonSlug, pokemonIdFromImage, preferredForm, baseSpeciesName, normalizedSpriteUrl, shinySource } from '../utils/pokemonForms.js';

const EVOLUTIONS_URL = 'https://pogoapi.net/api/v1/pokemon_evolutions.json';
const ATTACK_TYPES = [
  'normal', 'fire', 'water', 'electric', 'grass', 'ice', 'fighting', 'poison', 'ground',
  'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'
];
export const typeName = (value) => value.charAt(0).toUpperCase() + value.slice(1);

async function pokeJson(url, timeoutMs = 9000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ---- Species info (legendary flag + dex id), cached per species name ----
const speciesCache = new Map();

export async function fetchSpeciesInfo(name) {
  const key = name.toLowerCase();
  if (speciesCache.has(key)) return speciesCache.get(key);
  const slug = key.replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-');
  const data = await pokeJson(`https://pokeapi.co/api/v2/pokemon-species/${slug}`, 8500);
  const info = data ? { id: data.id, legendary: data.is_legendary } : null;
  speciesCache.set(key, info);
  return info;
}

// ---- Gigantamax artwork, cached per species name ----
const gmaxArtCache = new Map();

export async function fetchGmaxArt(name) {
  const key = name.toLowerCase();
  if (gmaxArtCache.has(key)) return gmaxArtCache.get(key);
  const slug = key.replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-');
  const data = await pokeJson(`https://pokeapi.co/api/v2/pokemon/${slug}-gmax`, 8500);
  const sprites = data?.sprites;
  const url = sprites?.other?.['official-artwork']?.front_default || sprites?.other?.home?.front_default || sprites?.front_default || null;
  gmaxArtCache.set(key, url);
  return url;
}

// ---- Shiny artwork for named forms (mega/regional/gmax slugs), cached per slug ----
const shinyFormCache = new Map();
const normalFormCache = new Map();

/** Load actual form artwork where available; the family icon remains the fallback. */
export async function fetchNormalFormArtBatch(formSlugs) {
  await Promise.all(formSlugs.map(async (slug) => {
    if (normalFormCache.has(slug)) return;
    const data = await pokeJson(`https://pokeapi.co/api/v2/pokemon/${slug}`, 8500);
    const sprites = data?.sprites;
    normalFormCache.set(slug, sprites?.other?.['official-artwork']?.front_default || sprites?.other?.home?.front_default || sprites?.front_default || null);
  }));
  return Object.fromEntries(formSlugs.map((slug) => [slug, normalFormCache.get(slug)]));
}

export async function fetchShinyFormArt(formSlug) {
  if (shinyFormCache.has(formSlug)) return shinyFormCache.get(formSlug);
  const data = await pokeJson(`https://pokeapi.co/api/v2/pokemon/${formSlug}`, 8500);
  const sprites = data?.sprites;
  const url = sprites?.other?.['official-artwork']?.front_shiny || sprites?.other?.home?.front_shiny || sprites?.front_shiny || null;
  shinyFormCache.set(formSlug, url);
  return url;
}

/** Resolves shiny art for every form slug in `formSlugs` not already cached, returns a plain map. */
export async function fetchShinyFormArtBatch(formSlugs) {
  await Promise.all(formSlugs.map(fetchShinyFormArt));
  const map = {};
  formSlugs.forEach((slug) => (map[slug] = shinyFormCache.get(slug) || null));
  return map;
}

// ---- Type match-ups for a raid boss / Max Battle target ----
const typeDetailCache = new Map();

function fetchTypeDetail(type) {
  if (!typeDetailCache.has(type)) typeDetailCache.set(type, pokeJson(`https://pokeapi.co/api/v2/type/${type}`));
  return typeDetailCache.get(type);
}

function typeEffectiveness(relations) {
  if (relations.some((x) => !x)) return null;
  return ATTACK_TYPES.map((attack) => {
    const multiplier = relations.reduce((total, data) => {
      const table = data.damage_relations;
      const has = (field) => table[field]?.some((x) => x.name === attack);
      return total * (has('no_damage_from') ? 0.390625 : has('half_damage_from') ? 0.625 : has('double_damage_from') ? 1.6 : 1);
    }, 1);
    return { type: attack, multiplier };
  })
    .filter((x) => x.multiplier > 1.001)
    .sort((a, b) => b.multiplier - a.multiplier || a.type.localeCompare(b.type));
}

const raidMetadataCache = new Map();

/** Types + super-effective attack types for a raid boss. Falls back to a PokéAPI lookup if the feed omits types. */
export async function fetchRaidMatchup(name, raid) {
  const slug = pokemonSlug(name);
  if (raidMetadataCache.has(slug)) return raidMetadataCache.get(slug);
  const promise = (async () => {
    const feedTypes = raid.types?.map((t) => t.name).filter(Boolean) || [];
    const pokemon = feedTypes.length ? null : await pokeJson(`https://pokeapi.co/api/v2/pokemon/${slug}`);
    const types = feedTypes.length ? feedTypes : (pokemon?.types || []).sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
    if (!types.length) return null;
    const relations = await Promise.all(types.map(fetchTypeDetail));
    return { types, weaknesses: typeEffectiveness(relations) };
  })();
  raidMetadataCache.set(slug, promise);
  return promise;
}

// ---- Evolution family (PogoAPI evolution graph) ----
let evolutionDataPromise = null;

export function fetchEvolutionData() {
  if (!evolutionDataPromise) {
    evolutionDataPromise = pokeJson(EVOLUTIONS_URL, 12000).then((data) => (Array.isArray(data) ? data : []));
  }
  return evolutionDataPromise;
}

/** Builds the full evolution line (all stages, both directions) containing `item`. */
export function buildEvolutionFamily(evolutionData, item) {
  const nodes = new Map();
  const edges = [];
  const key = (id, form = 'Normal') => `${id}:${form || 'Normal'}`;
  const add = (id, name, form) => {
    const k = key(id, form);
    if (!nodes.has(k)) nodes.set(k, { key: k, id: Number(id), name, form: form || 'Normal' });
    return k;
  };
  evolutionData.forEach((row) => {
    const from = add(row.pokemon_id, row.pokemon_name, row.form);
    (row.evolutions || []).forEach((e) => {
      const to = add(e.pokemon_id, e.pokemon_name, e.form);
      edges.push({ from, to, detail: e });
    });
  });

  const wanted = baseSpeciesName(item.species || item.name).toLowerCase();
  const wantedId = pokemonIdFromImage(item.image);
  const form = preferredForm(item.name);

  let start = [...nodes.values()].find((n) => n.name.toLowerCase() === wanted && (n.form === form || (form === 'Normal' && n.form === 'Normal')));
  if (!start && wantedId && wantedId < 10000) start = [...nodes.values()].find((n) => n.id === wantedId && n.form === 'Normal');
  if (!start) start = [...nodes.values()].find((n) => n.name.toLowerCase() === wanted);
  if (!start) return [];

  const family = new Set([start.key]);
  const queue = [start.key];
  const depth = new Map([[start.key, 0]]);
  const incoming = new Map();

  while (queue.length) {
    const current = queue.shift();
    edges
      .filter((e) => e.from === current || e.to === current)
      .forEach((e) => {
        const next = e.from === current ? e.to : e.from;
        if (!family.has(next)) {
          family.add(next);
          queue.push(next);
          const fromDepth = depth.get(current) ?? 0;
          if (e.from === current) {
            depth.set(next, fromDepth + 1);
            incoming.set(next, e);
          } else {
            depth.set(next, Math.max(0, fromDepth - 1));
          }
        }
      });
  }

  return [...family]
    .map((k) => ({ ...nodes.get(k), stage: depth.get(k) || 0, evolution: incoming.get(k)?.detail || null }))
    .sort((a, b) => a.stage - b.stage || a.id - b.id || a.name.localeCompare(b.name));
}

export function evolutionRequirementText(detail) {
  if (!detail) return 'Starting stage';
  const parts = [];
  if (detail.candy_required) parts.push(`${detail.candy_required} Candy`);
  if (detail.item_required) parts.push(detail.item_required);
  if (detail.lure_required) parts.push(detail.lure_required);
  if (detail.buddy_distance_required) parts.push(`Walk ${detail.buddy_distance_required} km`);
  if (detail.must_be_buddy_to_evolve) parts.push('Keep as buddy');
  if (detail.only_evolves_in_daytime) parts.push('Daytime');
  if (detail.only_evolves_in_nighttime) parts.push('Nighttime');
  if (detail.upside_down) parts.push('Turn phone upside down');
  if (detail.gender_required) parts.push(`${detail.gender_required} only`);
  if (detail.no_candy_cost_if_traded) parts.push('No Candy after eligible trade');
  return parts.join(' · ') || 'Special evolution requirement';
}

/** Sprite URL for one member of an evolution family, matching the clicked Pokémon's artwork when possible. */
export function familyMemberSprite(node, item, shiny, shinyFormArt) {
  const clickedId = pokemonIdFromImage(item.image);
  const battleForm = /^(mega|gigantamax|dynamax|shadow)\s/i.test(item.name);
  const same = !battleForm && node.name.toLowerCase() === baseSpeciesName(item.species || item.name).toLowerCase() && (clickedId === node.id || !clickedId) && preferredForm(item.name) === node.form;
  const region = { Alola: 'ALOLA', Galarian: 'GALARIAN', Hisuian: 'HISUIAN', Paldea: 'PALDEAN' }[node.form];
  const icon = `https://cdn.leekduck.com/assets/img/pokemon_icons_crop/pm${node.id}${region ? `.f${region}` : ''}.icon.png`;
  const normal = normalizedSpriteUrl(same ? item.image : icon);
  return shiny ? shinySource(node.name, normal, shinyFormArt) || normal : normal;
}

export { ATTACK_TYPES };
