import { useMemo, useState } from 'react';
import Sprite from '../components/Sprite.jsx';
import { parseDate, shortDate, formatRange } from '../utils/dates.js';
import { maxRotationEntries, rotationStatus } from '../data/maxRotations.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { addToCalendar } from '../data/events.js';

function MaxRotationCard({ item, pokemonInfo, appearance, shinyFormArt }) {
  const info = pokemonInfo[item.species.toLowerCase()] || {};
  const art = item.form === 'Gigantamax' ? pokemonInfo['gmax:' + item.species.toLowerCase()]?.image || item.image || info.image : item.image || info.image;
  const start = parseDate(item.start), end = parseDate(item.end);
  const eventBattle = item.kind === 'event';
  const badge = eventBattle ? 'EVENT BATTLE' : item.certainty === 'confirmed' ? 'SOURCE CONFIRMED' : 'MONDAY FEATURED';
  const timing = eventBattle && item.day ? shortDate(start) : item.certainty === 'confirmed' && !eventBattle ? `${shortDate(start)} – ${shortDate(new Date(+end - 1))}` : formatRange(item.start, item.end);
  const schedule = eventBattle ? item.battleWindow : item;
  const countdown = useCountdown(schedule?.start, schedule?.end);
  const featuredHour = schedule?.label === 'Featured hour';
  const name = item.form + ' ' + item.species;
  const calendarEvent = schedule && {
    ...schedule, name: name + ' · ' + (schedule.label || 'Max Monday'),
    eventID: item.key + ':max-schedule', link: item.source
  };
  return <article className="card pokemon-card">
    <Sprite src={art} name={name} shiny={appearance === 'shiny'} shinyFormArt={shinyFormArt} />
    <div className="card-main">
      <div className="card-top"><h4>{item.form} {item.species}</h4><span className="badge gold">{badge}</span></div>
      <p className="meta">{timing} · {eventBattle ? item.eventName : 'Power Spots'}</p>
      {featuredHour && <p className="meta">Featured hour · {formatRange(schedule.start, schedule.end)}</p>}
      {countdown && <span className="countdown">{featuredHour ? 'Featured hour ' + countdown.label.toLowerCase() : countdown.label}</span>}
      {eventBattle && item.notes && <p className="meta">{item.notes}</p>}
      <p className="meta">{eventBattle ? 'Published event roster. Check the event for battle hours and regional access.' : item.certainty === 'confirmed' ? 'Announced weekly availability; exact Power Spots vary.' : 'Featured on Max Monday. Week-long availability is not independently confirmed.'}</p>
      {countdown && (eventBattle || item.kind === 'monday') &&
        <button type="button" className="calendar-button" onClick={() => addToCalendar(calendarEvent)}>Add to Calendar</button>}
      <a href={item.source} target="_blank" rel="noopener noreferrer">{eventBattle ? 'Event details' : 'View rotation source'} ↗</a>
    </div>
  </article>;
}

export default function MaxRotations({ rotations = [], events = [], pokemonInfo = {}, query = '', failed = false, appearance = 'normal', shinyFormArt = {} }) {
  const [tab, setTab] = useState('current');
  const entries = useMemo(() => maxRotationEntries(rotations, events), [rotations, events]);
  const reference = new Date();
  const search = query.trim().toLowerCase();
  const matches = entries.filter(item => rotationStatus(item, reference) === tab && [item.form, item.species, item.eventName].join(' ').toLowerCase().includes(search));
  const weekly = matches.filter(item => item.kind === 'weekly');
  const mondays = matches.filter(item => item.kind === 'monday');
  const special = matches.filter(item => item.kind === 'gigantamax');
  const eventBattles = matches.filter(item => item.kind === 'event');
  const rosterSources = new Set(entries.filter(item => item.kind === 'event').map(item => item.source));
  const maxEventTargets = events.filter(event =>
    (event.eventType === 'max-battles' || (event.eventType === 'event' && /\b(?:dynamax|gigantamax|max battles?)\b/i.test(event.name))) &&
    !rosterSources.has(event.link) && rotationStatus(event, reference) === tab && (event.name || '').toLowerCase().includes(search));

  const renderCards = items => items.map(item =>
    <MaxRotationCard key={item.key} item={item} pokemonInfo={pokemonInfo} appearance={appearance} shinyFormArt={shinyFormArt} />);
  return <section className="page">
    <div className="section-head"><h3>Max Battle rotations</h3></div>
    <p className="section-explainer">Browse published event battles, weekly Power Spot rotations and Max Monday features. Dates follow your selected timezone.</p>
    <div className="event-filter-row" role="group" aria-label="Max rotation timing">
      {[['current', 'Current rotation'], ['upcoming', 'Upcoming rotation']].map(([id, label]) => <button key={id} type="button" className={`pill${tab === id ? ' active' : ''}`} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
    </div>
    {failed && <p className="section-explainer">The rotation feed could not refresh. Dated saved information may be incomplete.</p>}
    {!!eventBattles.length && <section className="card-section"><div className="section-head"><h3>Event Max Battles</h3><span>{eventBattles.length} targets</span></div><div className="card-grid">{renderCards(eventBattles)}</div></section>}
    <div className="section-head"><h3>{tab === 'current' ? 'Available this week' : 'Announced upcoming weeks'}</h3><span>{weekly.length} targets</span></div>
    {weekly.length ? <div className="card-grid">{renderCards(weekly)}</div> : <div className="empty">No confirmed weekly Pokémon found for this period. This does not mean Power Spots are empty.</div>}
    <div className="section-head"><h3>Max Monday features</h3><span>{mondays.length} targets</span></div>
    {mondays.length ? <div className="card-grid">{renderCards(mondays)}</div> : <p className="section-explainer">No Max Monday feature during this period.</p>}
    <div className="section-head"><h3>Gigantamax battles</h3><span>{special.length} targets</span></div>
    {special.length ? <div className="card-grid">{renderCards(special)}</div> : <p className="section-explainer">No separately verified Gigantamax rotation in this period.</p>}
    {maxEventTargets.length > 0 && <section className="card-section"><div className="section-head"><h3>Other Max Battle events</h3><span>{maxEventTargets.length} events</span></div><div className="card-grid">{maxEventTargets.map(event => <article key={event.eventID} className="card pokemon-card"><div className="card-main"><h4>{event.name}</h4><p className="meta">{shortDate(parseDate(event.start))} – {shortDate(parseDate(event.end))}</p><p className="meta">Special event; the exact Pokémon roster may require checking the source.</p>{event.link && <a href={event.link} target="_blank" rel="noopener noreferrer">Event details ↗</a>}</div></article>)}</div></section>}
  </section>;
}
