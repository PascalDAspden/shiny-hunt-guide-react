import { useEffect, useState } from 'react';
import { parseDate, now, countdownText } from '../utils/dates.js';

/** Re-renders every 30s so on-screen countdowns stay fresh without polling the feeds. */
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
  if (!startDate || !endDate || !Number.isFinite(+startDate) || !Number.isFinite(+endDate) || endDate <= startDate || endDate <= current) return null;
  const live = startDate <= current;
  const target = live ? endDate : startDate;
  const distance = target - current;
  return { prefix: live ? 'Ends' : 'Starts', label: `${live ? 'Ends' : 'Starts'} in ${countdownText(distance)}`, live };
}
