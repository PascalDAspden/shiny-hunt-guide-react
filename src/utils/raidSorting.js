import { parseDate } from './dates.js';

/** Lower is "more prestigious" for the default tier sort. */
export function tierRank(raid) {
  const shadow = /^shadow\s/i.test(raid.name);
  const tier = raid.tier || '';
  if (/1-star/i.test(tier)) return shadow ? 2 : 1;
  if (/3-star/i.test(tier)) return shadow ? 4 : 3;
  if (/mega/i.test(tier)) return 5;
  if (/5-star|ultra beast/i.test(tier)) return shadow ? 7 : 6;
  return shadow ? 9 : 8;
}

/** Lower is rarer for the odds sort ("1/512" sorts after "1/20"). */
export function oddsRank(raid, rateFn) {
  if (raid.canBeShiny === false) return 9999;
  const info = rateFn(raid);
  return parseInt(String(info.value).split('/')[1], 10) || 9998;
}

/**
 * Sorts a combined list of current + scheduled raids for display.
 * `rateFn` should be raidRate() from data/raids.js (kept as a parameter to
 * avoid a circular import between the two modules).
 */
export function sortRaids(raids, { sortKey = 'tier', scope = 'current', rateFn } = {}) {
  const list = [...raids];
  list.sort((a, b) => {
    if (scope === 'both') {
      const byScope = Number(!!a.event) - Number(!!b.event);
      if (byScope) return byScope;
    }
    if (sortKey === 'tier') {
      return (
        tierRank(a) - tierRank(b) ||
        (parseDate(a.event?.start)?.getTime() || 0) - (parseDate(b.event?.start)?.getTime() || 0) ||
        a.name.localeCompare(b.name)
      );
    }
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    if (sortKey === 'odds' && rateFn) return oddsRank(a, rateFn) - oddsRank(b, rateFn) || a.name.localeCompare(b.name);
    // 'soonest'
    return (
      (parseDate(a.event?.start)?.getTime() || 0) - (parseDate(b.event?.start)?.getTime() || 0) ||
      a.name.localeCompare(b.name)
    );
  });
  return list;
}
