import { useCallback, useEffect, useRef, useState } from 'react';
import { currentLocation, cancelLocation, validPosition, distanceKm, locationError } from '../data/location.js';
import { setEventTimeZone } from '../utils/dates.js';

export default function useGuideLocation(onMove) {
  const [state, setState] = useState({ enabled: false, loading: false, position: null, error: '', timeZone: null });
  const enabled = useRef(false), pending = useRef(false), sequence = useRef(0), last = useRef(null), callback = useRef(onMove);
  callback.current = onMove;
  const update = useCallback(async () => {
    if (!enabled.current || pending.current || document.visibilityState === 'hidden') return;
    pending.current = true;
    const request = ++sequence.current;
    setState(old => ({ ...old, loading: true, error: '' }));
    try {
      const position = await currentLocation();
      if (request !== sequence.current || !enabled.current) return;
      if (!validPosition(position)) throw new Error('Location fix is stale or invalid');
      const timeZone = setEventTimeZone(position.timeZone);
      const moved = distanceKm(last.current, position) >= 5 || last.current?.timeZone !== timeZone;
      last.current = { ...position, timeZone };
      setState({ enabled: true, loading: false, position, timeZone, error: '' });
      if (moved) callback.current();
    } catch (error) {
      if (request !== sequence.current) return;
      const hadTimeZone = last.current?.timeZone;
      last.current = null;
      setEventTimeZone(null);
      setState(old => ({ ...old, loading: false, position: null, timeZone: null, error: locationError(error) }));
      if (hadTimeZone) callback.current();
    } finally { if (request === sequence.current) pending.current = false; }
  }, []);
  const toggle = useCallback(() => {
    enabled.current = !enabled.current;
    if (enabled.current) { setState(old => ({ ...old, enabled: true })); update(); }
    else {
      ++sequence.current; pending.current = false; last.current = null;
      cancelLocation(); setEventTimeZone(null);
      setState({ enabled: false, loading: false, position: null, error: '', timeZone: null });
      callback.current();
    }
  }, [update]);
  useEffect(() => {
    const visible = () => {
      if (document.visibilityState === 'hidden') { ++sequence.current; pending.current = false; cancelLocation(); }
      else update();
    };
    const timer = setInterval(update, 5 * 60000);
    document.addEventListener('visibilitychange', visible);
    return () => { enabled.current = false; ++sequence.current; clearInterval(timer); document.removeEventListener('visibilitychange', visible); cancelLocation(); setEventTimeZone(null); };
  }, [update]);
  return { ...state, toggle, update };
}
