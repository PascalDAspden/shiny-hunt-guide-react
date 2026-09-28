import { useCallback, useEffect, useState } from 'react';

const ACTIVE_HUNT_KEY = 'tracked-hunt-v1';
const CHECKLIST_KEY = 'shiny-checklist-v1';

export function huntKey(kind, name, eventId = '') {
  return `${kind}:${name}:${eventId}`.toLowerCase();
}

function readJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private browsing, quota); the UI still works this session */
  }
}

/**
 * Your single "current focus" hunt, shown pinned at the top of the Checklist page.
 * Mirrors the original app's tracked-hunt-v1 behaviour: tapping "Track hunt"
 * anywhere in the app replaces this.
 */
export function useActiveHunt() {
  const [activeHunt, setActiveHuntState] = useState(() => {
    const saved = readJson(ACTIVE_HUNT_KEY, null);
    return saved?.name && saved?.kind ? saved : null;
  });

  const setActiveHunt = useCallback((item) => {
    const value = item
      ? {
          kind: item.kind,
          name: item.name,
          eventId: item.eventId || '',
          image: item.image || '',
          label: item.label || '',
          odds: item.odds?.value || item.odds || '',
          start: item.start || '',
          end: item.end || ''
        }
      : null;
    writeJson(ACTIVE_HUNT_KEY, value);
    setActiveHuntState(value);
  }, []);

  const isActive = useCallback(
    (kind, name, eventId = '') => !!activeHunt && huntKey(kind, name, eventId) === huntKey(activeHunt.kind, activeHunt.name, activeHunt.eventId),
    [activeHunt]
  );

  return { activeHunt, setActiveHunt, isActive };
}

/**
 * A persistent set of hunt keys the player has checked off (obtained, or just
 * "on my list"). Independent of the single active hunt above.
 */
export function useChecklist() {
  const [checked, setChecked] = useState(() => new Set(readJson(CHECKLIST_KEY, [])));

  useEffect(() => {
    writeJson(CHECKLIST_KEY, [...checked]);
  }, [checked]);

  const isChecked = useCallback((kind, name, eventId = '') => checked.has(huntKey(kind, name, eventId)), [checked]);

  const toggleChecked = useCallback((kind, name, eventId = '') => {
    const key = huntKey(kind, name, eventId);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const clearChecklist = useCallback(() => setChecked(new Set()), []);

  return { checked, isChecked, toggleChecked, clearChecklist };
}
