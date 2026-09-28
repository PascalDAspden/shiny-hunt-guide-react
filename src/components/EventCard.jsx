import { useCountdown } from '../hooks/useCountdown.js';
import { shortDate, timeOfDay, monthShort, dayName, parseDate, now } from '../utils/dates.js';
import { addToCalendar } from '../data/events.js';

export default function EventCard({ event, onOpen }) {
  const start = parseDate(event.start);
  const end = parseDate(event.end);
  const live = start <= now();
  const countdown = useCountdown(event.start, event.end);
  const spotlight = event.extraData?.spotlight;
  const subtitle = spotlight?.canBeShiny
    ? `${spotlight.name} can be shiny${spotlight.bonus ? ' · ' + spotlight.bonus : ''}`
    : event.heading || event.eventType.replaceAll('-', ' ');

  return (
    <article className="card event-card" onClick={() => onOpen?.(event)}>
      <div className="date-tile">
        <span>{monthShort(start)}</span>
        <b>{start.getDate()}</b>
        <span>{dayName(start)}</span>
      </div>
      <div className="card-main">
        <div className="card-top">
          <h4>{event.name}</h4>
          {live && <span className="live-chip">LIVE</span>}
        </div>
        <p className="meta">{subtitle}</p>
        <p className="meta">
          {shortDate(start)} {timeOfDay(start)} – {shortDate(end)} {timeOfDay(end)}
        </p>
        {countdown && <span className="countdown">{countdown.label}</span>}
        <div className="event-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="link-button" onClick={() => onOpen?.(event)}>
            View details
          </button>
          <button type="button" className="calendar-button" onClick={() => addToCalendar(event)}>
            Add to Calendar
          </button>
        </div>
      </div>
    </article>
  );
}
