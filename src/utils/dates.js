// Small, dependency-free date helpers shared across the app.
// Everything renders in the visitor's local timezone via Intl.

export const now = () => new Date();

let eventTimeZone = null;
export function setEventTimeZone(zone) {
  try { if (zone) new Intl.DateTimeFormat('en', { timeZone: zone }).format(); eventTimeZone = zone || null; }
  catch { eventTimeZone = null; }
  return eventTimeZone;
}
export const getEventTimeZone = () => eventTimeZone;
export const zoneOptions = () => eventTimeZone ? { timeZone: eventTimeZone } : {};

// Local event wall times belong to the GPS timezone. Explicit offsets remain
// absolute instants. No offset arithmetic is applied to UTC/global events.
export function parseDate(value) {
  if (!value) return null;
  const match = typeof value === 'string' && value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/);
  if (!eventTimeZone || !match) return new Date(value);
  const [, y, m, d, h, min, sec = '0', ms = '0'] = match;
  const wall = Date.UTC(+y, +m - 1, +d, +h, +min, +sec, +ms.padEnd(3, '0'));
  let instant = wall;
  const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: eventTimeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const rendered = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second, +ms.padEnd(3, '0'));
    const delta = wall - rendered;
    if (!delta) return new Date(instant);
    instant += delta;
  }
  // A nonexistent DST-transition wall time has no reliable event instant.
  return new Date(NaN);
}
export const shortDate = date => date ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', ...zoneOptions() }).format(date) : '';
export const timeOfDay = date => date ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', ...zoneOptions() }).format(date) : '';
export const dayName = date => date ? new Intl.DateTimeFormat(undefined, { weekday: 'short', ...zoneOptions() }).format(date) : '';
export const monthShort = date => date ? new Intl.DateTimeFormat(undefined, { month: 'short', ...zoneOptions() }).format(date) : '';

/** "3d 4h" / "2h 15m" / "38m" style remaining-time label. */
export function countdownText(milliseconds) {
  const totalMinutes = Math.max(0, Math.floor(milliseconds / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Is `date` within [start, end)? Used for "LIVE" badges. */
export function isLiveWindow(start, end, reference = now()) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return false;
  return s <= reference && reference < e;
}

export function windowIsUpcoming(start, reference = now()) {
  const s = parseDate(start);
  return !!s && s > reference;
}

export function windowHasEnded(end, reference = now()) {
  const e = parseDate(end);
  return !!e && e <= reference;
}

/** Formats a full local range, e.g. "Sep 26, 6:00 PM – Sep 27, 9:00 PM". */
export function formatRange(start, end) {
  const s = parseDate(start);
  const e = parseDate(end);
  if (!s || !e) return '';
  return `${shortDate(s)} ${timeOfDay(s)} – ${shortDate(e)} ${timeOfDay(e)}`;
}
