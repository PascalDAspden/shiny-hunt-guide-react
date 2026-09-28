import { parseDate, now } from '../utils/dates.js';
import { rate, validEvents } from './raids.js';

/** Spotlight Hour / Community Day / Hatch Day encounters worth calling out as shiny targets. */
export function eventEncounters(events, eggsFeed = []) {
  return validEvents(events).flatMap((event) => {
    if (event.eventType === 'pokemon-spotlight-hour') {
      const p = event.extraData?.spotlight;
      return p?.name && p.canBeShiny
        ? [{ name: p.name, image: p.image, event, odds: rate('1/512', 'confirmed guide rate', 'Spotlight Hour does not boost shiny odds') }]
        : [];
    }
    if (event.eventType === 'community-day') {
      const details = event.extraData?.communityday;
      const shiny = new Set((details?.shinies || []).map((p) => p.name?.toLowerCase()));
      return (details?.spawns || [])
        .filter((p) => p.name && shiny.has(p.name.toLowerCase()))
        .map((p) => ({ ...p, event, odds: rate('1/25', 'confirmed guide rate', 'Featured Community Day spawn, during event hours') }));
    }
    if (/ hatch day$/i.test(event.name)) {
      const name = event.name.replace(/ hatch day$/i, '');
      const egg = eggsFeed.find((e) => e.name.toLowerCase() === name.toLowerCase() && e.canBeShiny);
      return egg
        ? [{ name: egg.name, image: egg.image, event, odds: rate('1/10', 'event-specific', 'Featured Hatch Day Pokémon', 'Eligible eggs obtained during event') }]
        : [];
    }
    return [];
  });
}

const KNOWN_DEX_IDS = { cinderace: 815, sobble: 816, sizzlipede: 850, rookidee: 821, sneasel: 215, sableye: 302, articuno: 144, zapdos: 145, moltres: 146 };
const KNOWN_GMAX_IDS = { cinderace: 10210 };

/** Parses "Gigantamax X and Y during Max Monday"-style event names into per-species Max Battle targets. */
export function maxEncounters(events, pokemonInfo = {}, existingPool = []) {
  return validEvents(events)
    .filter((e) => ['max-battles', 'max-mondays'].includes(e.eventType))
    .flatMap((event) => {
      const match = event.name.match(/^(Gigantamax|Dynamax)\s+(.+?)(?:\s+during\s+Max Monday|\s+Max Battle Day|\s+in\s+Max Battles)/i);
      if (!match || /^max$/i.test(match[2])) return [];
      const speciesList = match[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map((s) => s.trim()).filter(Boolean);
      return speciesList.map((species) => {
        const info = pokemonInfo[species.toLowerCase()];
        const existing = existingPool.find((p) => p.name.toLowerCase() === species.toLowerCase());
        const prefix = match[1];
        const gigantamax = prefix.toLowerCase() === 'gigantamax';
        const odds = gigantamax
          ? rate('1/20', 'unknown', 'Gigantamax guide estimate', 'Shiny availability unverified')
          : info?.legendary === true
            ? rate('1/20', 'estimated', 'Legendary Max Battle', 'Shiny availability unverified')
            : info?.legendary === false
              ? rate('1/64', 'unknown', 'Dynamax guide estimate', 'Shiny availability unverified')
              : rate('Checking rate', 'unknown', 'Checking whether this is a Legendary Max Battle');
        const artId = info?.id || KNOWN_DEX_IDS[species.toLowerCase()];
        const gmaxId = KNOWN_GMAX_IDS[species.toLowerCase()];
        const formArt = pokemonInfo['gmax:' + species.toLowerCase()]?.image || (gmaxId ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${gmaxId}.png` : '');
        const standardArt = existing?.image || (artId ? `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${artId}.png` : '');
        return { event, species, name: `${prefix} ${species}`, image: gigantamax ? formArt || standardArt || event.image : standardArt || event.image, odds };
      });
    });
}

export function eventDescription(event) {
  const type = event.eventType;
  const heading = event.heading || type.replaceAll('-', ' ');
  const spotlight = event.extraData?.spotlight;
  const bosses = event.extraData?.raidbattles?.bosses || [];
  const community = event.extraData?.communityday;
  if (spotlight?.name) {
    return `${spotlight.name} is the featured Spotlight Hour Pokémon. It appears more often during the event${spotlight.bonus ? `, with ${spotlight.bonus}` : ''}. Spotlight Hour uses the species' normal shiny rate.`;
  }
  if (bosses.length) {
    return `${bosses.map((b) => b.name).join(', ')} ${bosses.length === 1 ? 'is' : 'are'} featured in raids during this rotation. Open a raid card from the Raids page for shiny odds, typing and counter-search details.`;
  }
  if (type === 'community-day') {
    const spawnNames = community?.spawns?.map((p) => p.name).filter(Boolean).join(', ');
    return `${spawnNames || event.name.replace(/ Community Day.*$/i, '')} is featured with increased wild encounters during Community Day hours and the event shiny-rate estimate shown on the Research page.`;
  }
  if (['max-battles', 'max-mondays'].includes(type)) {
    return 'A timed Max Battle event featuring the Pokémon named above. Open the Max filter on the Hunt page for the featured form and its shiny-rate estimate.';
  }
  if (/hatch day/i.test(event.name)) {
    return 'A Hatch Day focused on the named Pokémon. Eligible event eggs obtained during the event use the Hatch Day shiny-rate estimate shown on the Research page.';
  }
  if (/city safari/i.test(event.name)) {
    return 'A location-based Pokémon GO City Safari event in the named city. Access, encounters and bonuses may be restricted to that location.';
  }
  if (type === 'raid-day') {
    return 'A limited-time Raid Day featuring the named raid boss. The boosted 1/10 guide rate applies only to the named boss during the local event hours.';
  }
  return `${heading} running during the local times shown above. Availability and bonuses can vary by event and location.`;
}

export function eventHighlights(event) {
  const values = [];
  const spotlight = event.extraData?.spotlight;
  const bosses = event.extraData?.raidbattles?.bosses || [];
  const generic = event.extraData?.generic;
  if (spotlight?.bonus) values.push(spotlight.bonus);
  if (spotlight?.canBeShiny) values.push(`${spotlight.name} can be shiny`);
  if (bosses.length) values.push(`Raid bosses: ${bosses.map((b) => b.name).join(', ')}`);
  if (bosses.some((b) => b.canBeShiny)) values.push('Shiny-capable raid boss listed');
  if (generic?.hasSpawns) values.push('Wild spawns included');
  if (generic?.hasFieldResearchTasks) values.push('Field research included');
  return values;
}

export function eventKind(e) {
  if (['raid-battles', 'raid-day', 'raid-hour', 'raid-weekend', 'elite-raids'].includes(e.eventType)) return 'raids';
  if (['max-battles', 'max-mondays'].includes(e.eventType)) return 'max';
  if (e.eventType === 'pokemon-spotlight-hour') return 'spotlight';
  if (e.eventType === 'community-day') return 'community';
  if (/hatch day/i.test(e.name)) return 'hatch';
  return 'other';
}

// ---- .ics export ----
function icsText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

function icsDate(date, isUtc) {
  const y = isUtc ? date.getUTCFullYear() : date.getFullYear();
  const m = isUtc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const d = isUtc ? date.getUTCDate() : date.getDate();
  const h = isUtc ? date.getUTCHours() : date.getHours();
  const min = isUtc ? date.getUTCMinutes() : date.getMinutes();
  const sec = isUtc ? date.getUTCSeconds() : date.getSeconds();
  return [y, m, d, h, min, sec].map((n, i) => String(n).padStart(i === 0 ? 4 : 2, '0')).join('') + (isUtc ? 'Z' : '');
}

function calendarFileText(event) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const globallyTimed = /Z$/i.test(event.start);
  const description = `Pokémon GO event. Details: ${event.link || 'https://leekduck.com/events/'}\nSource: Leek Duck via ScrapedDuck.`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Shiny Hunt Guide//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${String(event.eventID).replace(/[^a-z0-9_-]/gi, '')}@shinyhunt.guide`,
    `DTSTAMP:${icsDate(now(), true)}`,
    `DTSTART:${icsDate(start, globallyTimed)}`,
    `DTEND:${icsDate(end, globallyTimed)}`,
    `SUMMARY:${icsText(event.name)}`,
    `DESCRIPTION:${icsText(description)}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Pokémon GO event starts soon',
    'TRIGGER:-PT30M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ];
  return lines.join('\r\n') + '\r\n';
}

/** Downloads (or shares, on platforms that support Web Share with files) a .ics for an event. */
export async function addToCalendar(event) {
  const fileName = `${String(event.eventID).replace(/[^a-z0-9_-]/gi, '-') || 'pokemon-go-event'}.ics`;
  const file = new File([calendarFileText(event)], fileName, { type: 'text/calendar' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: event.name });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return 'downloaded';
}
