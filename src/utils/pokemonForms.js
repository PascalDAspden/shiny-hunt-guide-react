// Parsing helpers that turn a Pokémon GO display name ("Shadow Mega Charizard X",
// "Alolan Raichu", "Gigantamax Cinderace") into the slugs/URLs needed to find
// artwork and shiny sprites for it. Ported from the original vanilla-JS app.

/** Only allow well-formed https URLs through to <img src>. */
export function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

/** Use the same Leek Duck card artwork path as the working guide. */
export function normalizedSpriteUrl(src) {
  const source = String(src || '');
  return /cdn\.leekduck\.com\/assets\/img\/pokemon_icons\//i.test(source)
    ? source.replace('/pokemon_icons/', '/pokemon_icons_crop/')
    : source;
}

/** Strips prefixes/suffixes down to the base species name, e.g. "Shadow Mega Venusaur" -> "Venusaur". */
export function baseSpeciesName(name) {
  return String(name)
    .replace(/^mega\s+(.+?)\s+[xy]$/i, 'Mega $1')
    .replace(/^(shadow|mega|gigantamax|dynamax)\s+/i, '')
    .replace(/^(hisuian|alolan|galarian|paldean)\s+/i, '')
    .replace(/\s*\(.+\)$/, '')
    .trim();
}

/**
 * Returns a PokéAPI form slug ("charizard-mega-x", "raichu-alola",
 * "cinderace-gmax") for names that need one, or '' for a plain species
 * that can be looked up by its numeric id instead.
 */
export function pokemonForm(name) {
  const value = String(name).replace(/^shadow\s+/i, '').trim();

  if (/^gigantamax\s+/i.test(value)) {
    return value.replace(/^gigantamax\s+/i, '').toLowerCase().replace(/\s+/g, '-') + '-gmax';
  }

  const mega = value.match(/^mega\s+(.+?)(?:\s+(x|y))?$/i);
  if (mega) {
    return mega[1].toLowerCase().replace(/\s+/g, '-') + '-mega' + (mega[2] ? '-' + mega[2].toLowerCase() : '');
  }

  const regional = value.match(/^(Hisuian|Alolan|Galarian|Paldean)\s+(.+)$/i);
  if (regional) {
    const suffix = { hisuian: 'hisui', alolan: 'alola', galarian: 'galar', paldean: 'paldea' }[
      regional[1].toLowerCase()
    ];
    return regional[2].toLowerCase().replace(/\s+/g, '-') + '-' + suffix;
  }

  const alternate = value.match(/^(.+?)\s*\((.+?)\s*(?:Forme|Form)?\)$/i);
  if (alternate) {
    return alternate[1].toLowerCase().replace(/\s+/g, '-') + '-' + alternate[2].toLowerCase().replace(/\s+/g, '-');
  }

  return '';
}

/** Slug used to query PokéAPI's /pokemon/{slug} for a raid boss or Max Battle target. */
export function pokemonSlug(name) {
  const plain = String(name).replace(/^shadow\s+/i, '').trim();
  return pokemonForm(plain) || plain.toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, '-');
}

/** Which regional/form label (for evolution-family matching) a display name implies. */
export function preferredForm(name) {
  if (/^alolan\s/i.test(name)) return 'Alola';
  if (/^galarian\s/i.test(name)) return 'Galarian';
  if (/^hisuian\s/i.test(name)) return 'Hisuian';
  if (/^paldean\s/i.test(name)) return 'Paldea';
  return 'Normal';
}

/** Pulls a National Dex id out of any of the sprite URL shapes the feeds use. */
export function pokemonIdFromImage(src) {
  const value = String(src || '');
  const id =
    value.match(/\/pm(\d+)/i)?.[1] ||
    value.match(/pokemon_icon_(\d+)/i)?.[1] ||
    value.match(/official-artwork\/(?:shiny\/)?(\d+)\.png/i)?.[1];
  return id ? Number(id) : null;
}

// A couple of Gigantamax forms that don't resolve cleanly through PokéAPI's
// slug pattern get a direct shiny-artwork override.
const GMAX_SHINY_OVERRIDES = {
  'cinderace-gmax': 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/10210.png'
};

/**
 * Resolves the shiny artwork URL for a card, given:
 *  - name: the Pokémon GO display name
 *  - src: the feed's normal-form sprite URL (used to recover a dex id)
 *  - shinyFormArt: a { [formSlug]: url|null } cache populated by fetchShinyFormArt()
 */
export function shinySource(name, src, shinyFormArt = {}) {
  const source = String(src || '');

  const assetForm = source.match(/\/(pm\d+(?:\.[a-z0-9_]+)?)\.icon\.png/i)?.[1];
  if (assetForm) return source.replace(/(\/pm\d+(?:\.[a-z0-9_]+)?)\.icon\.png/i, '$1.s.icon.png');

  const iconForm = source.match(/\/pokemon_icon_(\d+_\d+)\.png/i)?.[1];
  if (iconForm) return source.replace(/(\/pokemon_icon_\d+_\d+)\.png/i, '$1_shiny.png');

  const form = pokemonForm(name);
  if (form) {
    if (GMAX_SHINY_OVERRIDES[form]) return GMAX_SHINY_OVERRIDES[form];
    return shinyFormArt[form] || '';
  }

  const id =
    source.match(/\/pm(\d+)(?:\.|\/)/i)?.[1] || source.match(/\/(\d+)\.png(?:\?|$)/)?.[1];
  return id
    ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/shiny/${id}.png`
    : '';
}

/** Every distinct form slug (e.g. "charizard-mega-x") referenced by a batch of named encounters. */
export function collectFormSlugs(names) {
  return [...new Set(names.map(pokemonForm).filter(Boolean))];
}
