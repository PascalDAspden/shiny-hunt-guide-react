// Reviewed event catalogue, not the ordinary species evolution graph.
// Keep artwork identity, shiny release and permitted evolution routes separate.
export const COSTUMES_REVIEWED = '2026-10-29';
export const COSTUME_SOURCES = {
  part1: 'https://leekduck.com/events/halloween-2026-part-1/',
  part2: 'https://leekduck.com/events/halloween-2026-part-2/',
  debut: 'https://pokemongo.com/news/halloween-part-1-2026?hl=en',
  newForms: 'https://www.serebii.net/pokemongo/events/halloween2026part1.shtml',
  starters: 'https://pokemongo.com/news/halloween-part-2-2024?hl=en',
  noibat: 'https://pokemongo.com/news/halloween-part-2-2025',
  vulpix: 'https://leekduck.com/events/pokemon-go-halloween-event-2022-part-2/',
  piplup: 'https://www.ldshop.gg/blog/pokemon-go/halloween-event-2026.html',
  zubat: 'https://www.dittobase.com/pokemon-go/pokedex/golbat-top-hat',
  sinistea: 'https://bulbapedia.bulbagarden.net/wiki/Sinistea_(GO)',
  assets: 'https://github.com/PokeMiners/pogo_assets'
};

// Times without Z intentionally follow the player's device timezone.
const START = '2026-10-27T10:00:00';
const PART1_END = '2026-11-01T10:00:00';
const END = '2026-11-05T20:00:00';
const part1 = (method) => ({ start: START, end: PART1_END, method, source: COSTUME_SOURCES.part1 });
const wholeEvent = (method) => ({ start: START, end: END, method, source: COSTUME_SOURCES.part1 });
const part2 = (method) => ({ start: PART1_END, end: END, method, source: COSTUME_SOURCES.part2 });
const variant = (dex, name, asset, candy = null) => ({ dex, name, asset, candy, shinyAvailable: true });

export const costumeCatalog = [
  {
    id: 'zubat-top-hat', label: 'Top hat', evolutionStatus: 'can-evolve',
    aliases: ['Zubat wearing a top hat', 'Zubat (Top hat)', 'Golbat (Top hat)', 'Crobat (Top hat)'],
    availability: [part1('Wild encounters, Field Research and surprise boxes'), wholeEvent('GO Pass reward · Free and Deluxe tracks')],
    note: 'The top hat carries through both evolutions. Routes are documented by community Pokémon GO databases.',
    sources: [COSTUME_SOURCES.debut, COSTUME_SOURCES.zubat],
    variants: [variant(41, 'Zubat', 'pm41.fHALLOWEEN_2026_01'), variant(42, 'Golbat', 'pm42.fHALLOWEEN_2026_01', 25), variant(169, 'Crobat', 'pm169.fHALLOWEEN_2026_01', 100)]
  },
  {
    id: 'pikachu-hat-capelet', label: 'Hat and capelet', evolutionStatus: 'unconfirmed',
    aliases: ['Pikachu wearing a hat and capelet', 'Pikachu (Halloween 2026)'],
    availability: [wholeEvent('One-star raids'), part1('Field Research and free Timed Research')],
    note: 'Shiny availability is confirmed. The announcement does not specify an evolution route for this costume; check its in-game evolution button.',
    sources: [COSTUME_SOURCES.debut],
    variants: [variant(25, 'Pikachu', 'pm25.fHALLOWEEN_2026')]
  },
  {
    id: 'sinistea-bow-phony', label: 'Bow · Phony Form', evolutionStatus: 'can-evolve',
    aliases: ['Sinistea wearing a bow', 'Sinistea (Phony Bow)', 'Sinistea (Halloween Bow - Phony Form)', 'Polteageist (Halloween Bow - Phony Form)'],
    availability: [wholeEvent('One-star raids'), part1('Field Research')],
    note: 'This is the Phony Form route. The bow remains on Polteageist; Antique Form has a separate, 400-Candy route.',
    sources: [COSTUME_SOURCES.newForms, COSTUME_SOURCES.sinistea],
    variants: [variant(854, 'Sinistea', 'pm854.fP_HALLOWEEN_2026_01'), variant(855, 'Polteageist', 'pm855.fP_HALLOWEEN_2026_01', 50)]
  },
  {
    id: 'sinistea-bow-antique', label: 'Bow · Antique Form', evolutionStatus: 'can-evolve',
    aliases: ['Sinistea (Antique Bow)', 'Sinistea (Halloween Bow - Antique Form)', 'Polteageist (Halloween Bow - Antique Form)'],
    availability: [wholeEvent('Rare Antique Form from Sinistea encounters')],
    note: 'Antique Form costs 400 Sinistea Candy and evolves into Antique Form Polteageist with its bow. Check the form in the appraisal and evolution preview.',
    sources: [COSTUME_SOURCES.newForms, COSTUME_SOURCES.sinistea],
    variants: [variant(854, 'Sinistea', 'pm854.fA_HALLOWEEN_2026_01'), variant(855, 'Polteageist', 'pm855.fA_HALLOWEEN_2026_01', 400)]
  },
  {
    id: 'piplup-halloween-mischief', label: 'Halloween Mischief', evolutionStatus: 'locked',
    aliases: ['Piplup wearing a Halloween Mischief costume', 'Piplup (Halloween Mischief)'],
    availability: [part1('Wild encounters, Field Research and surprise boxes'), wholeEvent('GO Pass reward')],
    note: 'This costumed Piplup cannot evolve. Prinplup and Empoleon from the ordinary species chain do not apply.',
    sources: [COSTUME_SOURCES.piplup],
    variants: [variant(393, 'Piplup', 'pm393.cHALLOWEEN_2021_NOEVOLVE')]
  },
  {
    id: 'noibat-headband', label: 'Headband', evolutionStatus: 'can-evolve',
    aliases: ['Noibat wearing a headband', 'Noibat (Halloween Headband)', 'Noivern wearing a headband'],
    availability: [part1('Wild encounters, Field Research and surprise boxes'), wholeEvent('GO Pass reward · Free and Deluxe tracks')],
    note: 'Noivern keeps the headband. Evolution costs 400 Noibat Candy.',
    sources: [COSTUME_SOURCES.noibat, 'https://bulbapedia.bulbagarden.net/wiki/Noibat_(GO)'],
    variants: [variant(714, 'Noibat', 'pm714.cHALLOWEEN_2025'), variant(715, 'Noivern', 'pm715.cHALLOWEEN_2025', 400)]
  },
  {
    id: 'vulpix-spooky-festival', label: 'Spooky Festival', evolutionStatus: 'can-evolve',
    aliases: ['Vulpix wearing a Spooky Festival costume', 'Ninetales wearing a Spooky Festival costume'],
    availability: [part1('Surprise-box encounters')],
    note: 'Ninetales keeps the Spooky Festival costume.',
    sources: [COSTUME_SOURCES.vulpix, 'https://www.dittobase.com/pokemon-go/pokedex/vulpix-fall-2022'],
    variants: [variant(37, 'Vulpix', 'pm37.cFALL_2022'), variant(38, 'Ninetales', 'pm38.cFALL_2022', 50)]
  },
  {
    id: 'drifblim-halloween-mischief', label: 'Halloween Mischief', evolutionStatus: 'final',
    aliases: ['Drifblim wearing a Halloween Mischief costume'],
    availability: [part1('Rare wild encounters and surprise boxes'), wholeEvent('GO Pass Deluxe reward')],
    note: 'Drifblim is a final evolution. This costume is encountered as Drifblim; no costume Drifloon route is listed.',
    sources: [COSTUME_SOURCES.part1, COSTUME_SOURCES.noibat],
    variants: [variant(426, 'Drifblim', 'pm426.cHALLOWEEN_2021_NOEVOLVE')]
  },
  {
    id: 'gengar-tricks-treats', label: 'Tricks & Treats', evolutionStatus: 'final',
    aliases: ['Gengar wearing a Tricks & Treats costume', 'Gengar wearing a Tricks and Treats costume'],
    availability: [part1('Surprise-box encounters')],
    note: 'Gengar is a final evolution. This is a different outfit from Spooky Festival Gengar.',
    sources: [COSTUME_SOURCES.part1, COSTUME_SOURCES.noibat],
    variants: [variant(94, 'Gengar', 'pm94.cFALL_2023_NOEVOLVE')]
  },
  {
    id: 'rowlet-halloween', label: 'Pokémon Halloween', evolutionStatus: 'can-evolve',
    aliases: ['Rowlet wearing a Pokémon Halloween costume', 'Dartrix wearing a Pokémon Halloween costume', 'Decidueye wearing a Pokémon Halloween costume'],
    availability: [wholeEvent('GO Pass reward · Free and Deluxe tracks'), part2('Wild encounters')],
    note: 'Both evolutions keep their Halloween costume. This route leads to Alolan Decidueye.',
    sources: [COSTUME_SOURCES.starters],
    variants: [variant(722, 'Rowlet', 'pm722.cFALL_2024'), variant(723, 'Dartrix', 'pm723.cFALL_2024', 25), variant(724, 'Decidueye', 'pm724.cFALL_2024', 100)]
  },
  {
    id: 'froakie-halloween', label: 'Pokémon Halloween', evolutionStatus: 'can-evolve',
    aliases: ['Froakie wearing a Pokémon Halloween costume', 'Frogadier wearing a Pokémon Halloween costume', 'Greninja wearing a Pokémon Halloween costume'],
    availability: [wholeEvent('GO Pass reward · Free and Deluxe tracks')],
    note: 'Frogadier and Greninja retain the Halloween costume.',
    sources: [COSTUME_SOURCES.starters],
    variants: [variant(656, 'Froakie', 'pm656.cFALL_2024'), variant(657, 'Frogadier', 'pm657.cFALL_2024', 25), variant(658, 'Greninja', 'pm658.cFALL_2024', 100)]
  },
  {
    id: 'gengar-spooky-festival', label: 'Spooky Festival', evolutionStatus: 'final',
    aliases: ['Gengar wearing a Spooky Festival costume'],
    availability: [wholeEvent('GO Pass reward · Free and Deluxe tracks'), part2('Rare wild encounters')],
    note: 'Gengar is a final evolution. Its Spooky Festival outfit is distinct from the Tricks & Treats outfit.',
    sources: [COSTUME_SOURCES.part2, COSTUME_SOURCES.starters],
    variants: [variant(94, 'Gengar', 'pm94.cFALL_2022_NOEVOLVE')]
  }
].map((costume) => ({ ...costume, variants: costume.variants.map((member) => ({ ...member, id: `${costume.id}:${member.dex}` })) }));

export function costumeArtwork(variant, shiny = false) {
  if (variant.image) return shiny ? variant.image.replace(/(?:\.s)?\.icon\.png$/, '.s.icon.png') : variant.image;
  return `/costumes/${variant.asset}${shiny ? '.s' : ''}.icon.png`;
}

export function costumeAvailability(costume, at = new Date()) {
  const time = at.getTime();
  const windows = costume.availability.filter((entry) => Number.isFinite(new Date(entry.start).getTime()) && Number.isFinite(new Date(entry.end).getTime()));
  if (!windows.length) return { status: 'unknown', label: 'Availability unconfirmed', windows: [] };
  const active = windows.filter((entry) => new Date(entry.start).getTime() <= time && time < new Date(entry.end).getTime());
  if (active.length) return { status: 'now', label: 'Available now', windows: active };
  const upcoming = windows.filter((entry) => new Date(entry.start).getTime() > time);
  if (upcoming.length) return { status: 'upcoming', label: 'Upcoming', windows: upcoming };
  return { status: 'past', label: 'Past event', windows };
}

const normalise = (value) => String(value || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, 'and').replace(/\s+/g, ' ').trim().toLowerCase();

/** Resolve by costume asset or an exact costume name, never species alone. */
export function findCostume(item = {}) {
  let image = String(item.image || item.src || '');
  try { image = decodeURIComponent(image); } catch { /* malformed feed URL */ }
  const asset = image.split('/').at(-1)?.split('?')[0].replace(/(?:\.s)?\.icon\.png$/i, '').replace(/\.g\d+$/i, '');
  const name = normalise(item.name);
  // A feed can use a generic name for Antique Sinistea: asset identity wins.
  for (const costume of costumeCatalog) {
    const member = costume.variants.find((entry) => entry.asset === asset);
    if (member) return { costume, variant: member };
  }
  for (const costume of costumeCatalog) {
    const member = costume.variants.find((entry) => normalise(`${entry.name} (${costume.label})`) === name);
    if (member) return { costume, variant: member };
    if (costume.aliases.some((alias) => normalise(alias) === name)) {
      const named = costume.variants.find((entry) => name.startsWith(normalise(entry.name)));
      return { costume, variant: named || costume.variants[0] };
    }
  }
  return null;
}

export function isCostumeEncounter(item = {}) {
  return !!findCostume(item) || /\b(wearing|costume|hat|headband|capelet|bow|crown|scarf)\b/i.test(item.name || '') || /pm\d+(?:\.[^.\s/]+)*\.c[A-Z0-9_]+|\.f(?:HALLOWEEN|FALL)_/i.test(item.image || item.src || '');
}

export function costumeEvolutionLabel(costume) {
  return { 'can-evolve': 'Can evolve', locked: 'Evolution locked', final: 'Final evolution', unconfirmed: 'Evolution unconfirmed' }[costume.evolutionStatus];
}
