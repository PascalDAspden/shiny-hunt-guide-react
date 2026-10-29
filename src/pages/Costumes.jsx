import { useEffect, useState } from 'react';
import CostumeArtwork from '../components/CostumeArtwork.jsx';
import CostumeEvolution from '../components/CostumeEvolution.jsx';
import { COSTUMES_REVIEWED, COSTUME_SOURCES, costumeCatalog, costumeAvailability, costumeEvolutionLabel } from '../data/costumes.js';

const FILTERS = [['now', 'Available now'], ['upcoming', 'Upcoming'], ['all', 'All listed']];
const formatDate = (value) => new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export default function Costumes({ query = '' }) {
  const [scope, setScope] = useState('now');
  const [evolution, setEvolution] = useState('all');
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const matches = costumeCatalog.filter((costume) => {
    const availability = costumeAvailability(costume, time);
    const text = `${costume.label} ${costume.variants.map((member) => member.name).join(' ')}`.toLocaleLowerCase();
    return (scope === 'all' || availability.status === scope) && (evolution === 'all' || costume.evolutionStatus === evolution) && text.includes(query.trim().toLocaleLowerCase());
  });

  return (
    <section className="costumes-page page" aria-label="Costume Pokémon">
      <div className="section-head"><h3>Costume Pokémon</h3><span>{matches.length} costume families</span></div>
      <p className="section-explainer">Compare each outfit in normal and shiny colours, then check which costume evolutions are possible.</p>
      <div className="event-filter-row" aria-label="Costume availability">{FILTERS.map(([id, label]) => <button key={id} type="button" className={`pill${scope === id ? ' active' : ''}`} aria-pressed={scope === id} onClick={() => setScope(id)}>{label}</button>)}</div>
      <label className="costume-evolution-filter">Evolution
        <select value={evolution} onChange={(event) => setEvolution(event.target.value)}>
          <option value="all">All evolution rules</option><option value="can-evolve">Can evolve</option><option value="locked">Evolution locked</option><option value="final">Final evolution</option><option value="unconfirmed">Unconfirmed</option>
        </select>
      </label>
      <p className="meta">Halloween 2026 catalogue · Checked {new Date(`${COSTUMES_REVIEWED}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}. Times use your device’s timezone. This is a reviewed event list, not every costume ever released.</p>
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
              <div className="costume-methods">{availability.windows.map((window, index) => <div key={`${window.method}:${index}`}><p className="meta">{window.method}</p><small>{availability.status === 'upcoming' ? `Starts ${formatDate(window.start)}` : availability.status === 'past' ? `Ended ${formatDate(window.end)}` : `Until ${formatDate(window.end)}`}</small></div>)}</div>
              <details className="costume-details"><summary>{costume.variants.length > 1 ? 'View costume evolutions' : 'View evolution restriction'}</summary><CostumeEvolution costume={costume} /></details>
            </article>
          );
        })}
      </div>
      {!matches.length && <div className="empty" role="status">No listed costumes match these filters. Try All listed or another Pokémon name.</div>}
      <p className="meta costume-attribution">An ended event stops new encounters; it does not itself remove an existing Pokémon’s evolution option. Any additional costume restrictions are shown above. Artwork from <a href={COSTUME_SOURCES.assets} target="_blank" rel="noopener noreferrer">PokeMiners</a>. Availability: <a href={COSTUME_SOURCES.part1} target="_blank" rel="noopener noreferrer">Halloween Part I</a> / <a href={COSTUME_SOURCES.part2} target="_blank" rel="noopener noreferrer">Part II</a>.</p>
    </section>
  );
}
