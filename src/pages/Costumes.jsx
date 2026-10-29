import { useCallback, useEffect, useRef, useState } from 'react';
import CostumeArtwork from '../components/CostumeArtwork.jsx';
import CostumeEvolution from '../components/CostumeEvolution.jsx';
import { COSTUME_SOURCES, costumeAvailability, costumeEvolutionLabel } from '../data/costumes.js';
import { buildCostumeCatalogue, fetchCostumeEncounters, encounterLabels } from '../data/costumeEncounters.js';

const FILTERS = [['now', 'Available now'], ['upcoming', 'Upcoming'], ['all', 'All listed']];
const formatDate = (value) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Costumes({ query = '' }) {
  const [scope, setScope] = useState('now');
  const [evolution, setEvolution] = useState('all');
  const [time, setTime] = useState(() => new Date());
  const [catalogue, setCatalogue] = useState(() => buildCostumeCatalogue());
  const [feedStatus, setFeedStatus] = useState({ loading: false, cached: true, failed: false });
  const mounted = useRef(false);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (!mounted.current || pending.current) return;
    pending.current = true;
    setFeedStatus(previous => ({ ...previous, loading: true }));
    const result = await fetchCostumeEncounters();
    pending.current = false;
    if (!mounted.current) return;
    setCatalogue(buildCostumeCatalogue(result.data));
    setFeedStatus({ ...result, loading: false });
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const timer = setInterval(refresh, 10 * 60 * 1000);
    const focus = () => refresh();
    const visible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', visible);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const matches = catalogue.filter((costume) => {
    const availability = costumeAvailability(costume, time);
    const text = `${costume.label} ${costume.variants.map((member) => member.name).join(' ')}`.toLocaleLowerCase();
    return (scope === 'all' || availability.status === scope) && (evolution === 'all' || costume.evolutionStatus === evolution) && text.includes(query.trim().toLocaleLowerCase());
  });

  return (
    <section className="costumes-page page" aria-label="Costume Pokémon">
      <div className="section-head"><h3>Costume Pokémon</h3><button type="button" className="track-button" disabled={feedStatus.loading} onClick={refresh}>{feedStatus.loading ? 'Updating…' : 'Refresh costumes'}</button></div>
      <p className="section-explainer">Compare each outfit in normal and shiny colours, then check which costume evolutions are possible.</p>
      <div className="event-filter-row" aria-label="Costume availability">{FILTERS.map(([id, label]) => <button key={id} type="button" className={`pill${scope === id ? ' active' : ''}`} aria-pressed={scope === id} onClick={() => setScope(id)}>{label}</button>)}</div>
      <label className="costume-evolution-filter">Evolution
        <select value={evolution} onChange={(event) => setEvolution(event.target.value)}>
          <option value="all">All evolution rules</option><option value="can-evolve">Can evolve</option><option value="locked">Evolution locked</option><option value="final">Final evolution</option><option value="unconfirmed">Unconfirmed</option>
        </select>
      </label>
      <p className="meta" role="status">{feedStatus.loading ? 'Checking encounter guide…' : feedStatus.stale ? 'Encounter guide may be out of date' : feedStatus.cached ? 'Offline · saved encounter guide' : feedStatus.failed ? 'Some event sources could not update' : 'Encounter guide updated'}{feedStatus.data?.updatedAt ? ` · ${formatDate(feedStatus.data.updatedAt)}` : ''} · {matches.length} costume families</p>
      <div className="costume-grid">
        {matches.map((costume) => {
          const root = costume.variants[0];
          const availability = costumeAvailability(costume, time);
          return (
            <article className="costume-card" key={costume.id}>
              <div className="card-top"><div><h4>{root.name}</h4><p className="meta">{costume.label}</p></div><span className={`badge ${availability.status === 'now' ? 'gold' : 'upcoming'}`}>{availability.label}</span></div>
              <div className="costume-pair costume-card-pair">
                <figure><CostumeArtwork variant={root} costume={costume} /><figcaption>Normal</figcaption></figure>
                <figure><CostumeArtwork variant={root} costume={costume} shiny /><figcaption>Shiny ✦</figcaption></figure>
              </div>
              <div><span className={`badge ${costume.evolutionStatus === 'locked' ? 'locked' : ''}`}>{costumeEvolutionLabel(costume)}</span></div>
              <div className="costume-source-chips">{[...new Set(availability.windows.map(window => encounterLabels[window.kind] || window.method))].map(label => <span key={label} className="badge">{label}</span>)}</div>
              <details className="costume-find"><summary>Where to find</summary>{!costume.availability.length && <p className="meta">No encounter method is currently confirmed. Check back after the next event update.</p>}<ul className="costume-methods">{costume.availability.map((window, index) => {
                const active = new Date(window.start) <= time && time < new Date(window.end);
                const soon = new Date(window.start) > time;
                return <li key={`${window.method}:${index}`}><strong>{window.method}</strong>{window.event && <span>{window.event}</span>}<small>{soon ? `Starts ${formatDate(window.start)} · Ends ${formatDate(window.end)}` : active ? `Until ${formatDate(window.end)}` : `Ended ${formatDate(window.end)}`}</small>{window.kind === 'pass' && <small>Reach this rank and claim the encounter. {window.paid ? 'Deluxe purchase required.' : 'No Deluxe purchase required.'}</small>}<a href={window.source} target="_blank" rel="noopener noreferrer">Event guide ↗</a></li>;
              })}</ul></details>
              <details className="costume-details"><summary>{costume.variants.length > 1 ? 'View costume evolutions' : 'View evolution restriction'}</summary><CostumeEvolution costume={costume} /></details>
            </article>
          );
        })}
      </div>
      {!matches.length && <div className="empty" role="status">No listed costumes match these filters. Try All listed or another Pokémon name.</div>}
      <p className="meta costume-attribution">Checks published event guides every 6 hours. This page refreshes on opening, returning to the app and every 10 minutes. Local times follow your device. Availability depends on the event and any location or ticket restrictions in its guide. Unverified evolution rules stay marked unconfirmed. Artwork from <a href={COSTUME_SOURCES.assets} target="_blank" rel="noopener noreferrer">PokeMiners</a>.</p>
    </section>
  );
}
