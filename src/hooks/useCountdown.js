import { useEffect, useState } from 'react';
import { parseDate, now, countdownText, timeOfDay } from '../utils/dates.js';

/** Re-renders every 30s so on-screen countdowns and the local clock stay fresh without polling the feeds. */
function useTick(intervalMs = 30000) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}

/**
 * Ticking "Starts in 2h 15m" / "Ends in 38m" label for an event-style [start, end) window.
 * Returns null once `end` has passed (nothing left to count down to).
 */
export function useCountdown(start, end) {
  useTick();
  const startDate = parseDate(start);
  const endDate = parseDate(end);
  const current = now();
  if (!startDate || !endDate || endDate <= current) return null;
  const live = startDate <= current;
  const target = live ? endDate : startDate;
  const distance = target - current;
  return { prefix: live ? 'Ends' : 'Starts', label: `${live ? 'Ends' : 'Starts'} in ${countdownText(distance)}`, live };
}

/** Same idea for a single target date with a custom prefix (used for the tracked-hunt panel). */
export function useCountdownTo(target, prefix) {
  useTick();
  const date = parseDate(target);
  if (!date) return null;
  const distance = date - now();
  return `${prefix} in ${countdownText(Math.max(0, distance))}`;
}

/** "Sat, 6:42 PM" local clock, refreshed alongside the countdowns. */
export function useLocalClock() {
  useTick();
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(now());
}

export { timeOfDay };
