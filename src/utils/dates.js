// Small, dependency-free date helpers shared across the app.
// Everything renders in the visitor's local timezone via Intl.

export const now = () => new Date();

export const parseDate = (value) => (value ? new Date(value) : null);

export const shortDate = (date) =>
  date ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date) : '';

export const timeOfDay = (date) =>
  date ? new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date) : '';

export const dayName = (date) =>
  date ? new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(date) : '';

export const monthShort = (date) =>
  date ? new Intl.DateTimeFormat(undefined, { month: 'short' }).format(date) : '';

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
