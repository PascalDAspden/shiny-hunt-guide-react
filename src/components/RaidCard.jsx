import Sprite from './Sprite.jsx';
import { RateNote } from './PokemonCard.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { shortDate, timeOfDay, parseDate } from '../utils/dates.js';
import { raidCalendarEvent, raidRate, rate } from '../data/raids.js';
import { addToCalendar } from '../data/events.js';

export default function RaidCard({ raid, events, appearance, shinyFormArt, onOpen }) {
  const locked = raid.canBeShiny === false;
  const upcoming = !!raid.event;
  const schedule = raid.event || raid.rotationEvent;
  const countdown = useCountdown(schedule?.start, schedule?.end);
  const unknown = raid.canBeShiny !== true && !locked;
  const info = unknown ? rate('Shiny status unknown', 'unconfirmed', 'The source has not confirmed shiny availability') : locked ? rate('Shiny locked', 'feed status', 'Not obtainable shiny from this raid') : raidRate(raid, events);
  return (
    <article className="card raid-card" onClick={() => onOpen?.(raid)}>
      <Sprite src={raid.image} name={raid.name} shiny={appearance === 'shiny' && !locked} shinyFormArt={shinyFormArt} />
      <div className="card-main">
        <div className="card-top">
          <h4>{raid.name}</h4>
          <span className={`badge ${locked ? 'locked' : upcoming ? 'upcoming' : 'gold'}`}>{locked ? 'LOCKED' : upcoming ? 'UPCOMING' : unknown ? 'UNCONFIRMED' : 'SHINY'}</span>
        </div>
        <p className="meta">
          {raid.tier}
          {upcoming ? ` · from ${shortDate(parseDate(raid.event.start))}, ${timeOfDay(parseDate(raid.event.start))}` : ''}
          {raid.combatPower?.normal?.min ? ` · CP ${raid.combatPower.normal.min}–${raid.combatPower.normal.max}` : ''}
        </p>
        {countdown ? <span className="countdown">{upcoming ? countdown.label : `Leaves raid pool in ${countdown.label.replace(/^Ends in /, '')}`}</span>
          : !upcoming && <span className="meta">{raid.rotationEvent ? 'Rotation ended · refresh raids' : 'Raid rotation end not listed'}</span>}
        {!upcoming && raid.rotationEvent && <p className="meta">Rotation ends {shortDate(parseDate(raid.rotationEvent.end))}, {timeOfDay(parseDate(raid.rotationEvent.end))} (local time)</p>}
        <RateNote odds={info} />
        <div className="event-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="link-button" onClick={() => onOpen?.(raid)}>
            View raid details →
          </button>
          {countdown && <button type="button" className="calendar-button" onClick={() => addToCalendar(raidCalendarEvent(raid, schedule))}>
            Add to Calendar
          </button>}
        </div>
      </div>
    </article>
  );
}
