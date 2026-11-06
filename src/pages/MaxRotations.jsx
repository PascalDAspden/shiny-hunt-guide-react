import { useMemo, useState } from 'react';
import Sprite from '../components/Sprite.jsx';
import { parseDate, shortDate, formatRange } from '../utils/dates.js';
import { maxRotationEntries, rotationStatus } from '../data/maxRotations.js';

export default function MaxRotations({ rotations = [], events = [], pokemonInfo = {}, query = '', failed = false, appearance = 'normal', shinyFormArt = {} }) {
  const [tab, setTab] = useState('current');
  const entries = useMemo(() => maxRotationEntries(rotations, events), [rotations, events]);
  const reference = new Date();
  const matches = entries.filter(item => rotationStatus(item, reference) === tab && (item.form + ' ' + item.species).toLowerCase().includes(query.toLowerCase()));
  const weekly = matches.filter(item => item.kind === 'weekly');
  const mondays = matches.filter(item => item.kind === 'monday');
  const special = matches.filter(item => item.kind === 'gigantamax');
  const maxEventTargets = events.filter(event => event.eventType === 'max-battles' && parseDate(event.end) > reference && (event.name || '').toLowerCase().includes(query.toLowerCase()) && (tab === 'current' ? parseDate(event.start) <= reference : parseDate(event.start) > reference));

  const renderCards = items => items.map(item => {
    const info = pokemonInfo[item.species.toLowerCase()] || {};
    const art = item.form === 'Gigantamax' ? pokemonInfo['gmax:' + item.species.toLowerCase()]?.image || info.image : info.image;
    const start = parseDate(item.start), end = parseDate(item.end);
    return <article className="card pokemon-card" key={item.key}>
      <Sprite src={art} name={item.form + ' ' + item.species} shiny={appearance === 'shiny'} shinyFormArt={shinyFormArt} />
      <div className="card-main">
        <div className="card-top"><h4>{item.form} {item.species}</h4><span className="badge gold">{item.certainty === 'confirmed' ? 'SOURCE CONFIRMED' : 'MONDAY FEATURED'}</span></div>
        <p className="meta">{item.certainty === 'confirmed' ? `${shortDate(start)} – ${shortDate(new Date(+end - 1))}` : formatRange(item.start, item.end)} · Power Spots</p>
        <p className="meta">{item.certainty === 'confirmed' ? 'Announced weekly availability; exact Power Spots vary.' : 'Featured on Max Monday. Week-long availability is not independently confirmed.'}</p>

        <a href={item.source} target="_blank" rel="noopener noreferrer">View rotation source ↗</a>
      </div>
    </article>;
  });
  return <section className="page">
    <div className="section-head"><h3>Max Battle rotations</h3></div>
    <p className="section-explainer">Regular Power Spot rotations are separate from Max Mondays. Only announced, date-bounded Pokémon are shown; the app cannot see individual Power Spots. Dates follow your selected timezone.</p>
    <div className="event-filter-row" role="group" aria-label="Max rotation timing">
      {[['current', 'Current rotation'], ['upcoming', 'Upcoming rotation']].map(([id, label]) => <button key={id} type="button" className={`pill${tab === id ? ' active' : ''}`} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {failed && <p className="section-explainer">The rotation feed could not refresh. Dated saved information may be incomplete.</p>}
    <div className="section-head"><h3>{tab === 'current' ? 'Available this week' : 'Announced upcoming weeks'}</h3><span>{weekly.length} targets</span></div>
    {weekly.length ? <div className="card-grid">{renderCards(weekly)}</div> : <div className="empty">No confirmed weekly Pokémon found for this period. This does not mean Power Spots are empty.</div>}
    <div className="section-head"><h3>Max Monday features</h3><span>{mondays.length} targets</span></div>
    {mondays.length ? <div className="card-grid">{renderCards(mondays)}</div> : <p className="section-explainer">No Max Monday feature during this period.</p>}
    <div className="section-head"><h3>Gigantamax battles</h3><span>{special.length} targets</span></div>
    {special.length ? <div className="card-grid">{renderCards(special)}</div> : <p className="section-explainer">No separately verified Gigantamax rotation in this period.</p>}
    {maxEventTargets.length > 0 && <section className="card-section"><div className="section-head"><h3>Other Max Battle events</h3><span>{maxEventTargets.length} events</span></div><div className="card-grid">{maxEventTargets.map(event => <article key={event.eventID} className="card pokemon-card"><div className="card-main"><h4>{event.name}</h4><p className="meta">{shortDate(parseDate(event.start))} – {shortDate(parseDate(event.end))}</p><p className="meta">Special event; the exact Pokémon roster may require checking the source.</p>{event.link && <a href={event.link} target="_blank" rel="noopener noreferrer">Event details ↗</a>}</div></article>)}</div></section>}
  </section>;
}
