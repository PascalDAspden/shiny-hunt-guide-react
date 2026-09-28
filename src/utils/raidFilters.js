/** Which pill on the raid-type filter row a raid belongs to. */
export function raidCategory(raid) {
  if (/^shadow\s/i.test(raid.name)) return 'shadow';
  if (/mega/i.test(raid.tier)) return 'mega';
  if (/5-star|ultra beast/i.test(raid.tier)) return 'legendary';
  if (/1-star/i.test(raid.tier)) return 'one';
  if (/3-star/i.test(raid.tier)) return 'three';
  return 'unknown';
}

export function matchesRaidType(raid, raidType) {
  if (raidType === 'all') return true;
  if (raidType === raidCategory(raid)) return true;
  if (raidType === 'legendary' && /5-star/i.test(raid.tier)) return true;
  return false;
}

export function matchesShinyOnly(raid, shinyOnly) {
  return !shinyOnly || raid.canBeShiny === true;
}

export function matchesQuery(text, query) {
  if (!query) return true;
  return String(text || '')
    .toLowerCase()
    .includes(query.toLowerCase());
}

export function matchesAnyQuery(parts, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return parts.some((part) => String(part || '').toLowerCase().includes(q));
}

/** Applies the Raids page's type + shiny-only filters together. */
export function filterRaids(raids, { raidType = 'all', shinyOnly = true } = {}) {
  return raids.filter((raid) => matchesRaidType(raid, raidType) && matchesShinyOnly(raid, shinyOnly));
}
