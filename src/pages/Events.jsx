import { useMemo, useState } from 'react';
import EventCard from '../components/EventCard.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { validEvents } from '../data/raids.js';
import { eventKind, eventDescription, eventHighlights, addToCalendar } from '../data/events.js';
import { formatRange, parseDate, now } from '../utils/dates.js';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'raids', label: 'Raids' },
  { value: 'max', label: 'Max Battles' },
  { value: 'spotlight', label: 'Spotlight Hour' },
  { value: 'community', label: 'Community Day' },
  { value: 'hatch', label: 'Hatch Day' },
  { value: 'other', label: 'Other' }
];

export default function Events({ eventsFeed, failed, query }) {
  const [filter, setFilter] = useState('upcoming'); // 'upcoming' | 'live' | 'all'
  const [type, setType] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [openEvent, setOpenEvent] = useState(null);

  const list = useMemo(() => {
    const all = validEvents(eventsFeed).filter((e) => e.name.toLowerCase().includes(query.toLowerCase()));
    const filtered = all.filter(
      (e) => (filter === 'all' || (filter === 'live' ? parseDate(e.start) <= now() : parseDate(e.start) > now())) && (type === 'all' || eventKind(e) === type)
    );
    const sorted = [...filtered];
    if (sortKey === 'latest') sorted.sort((a, b) => parseDate(b.start) - parseDate(a.start));
    if (sortKey === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [eventsFeed, filter, type, sortKey, query]);

  const label = filter === 'live' ? 'live events' : filter === 'all' ? 'events' : 'upcoming events';

  return (
    <section className="page">
      <div className="event-controls">
        <div className="event-filter-row" role="group" aria-label="Event timing">
          {[
            ['upcoming', 'Upcoming'],
            ['live', 'Live now'],
            ['all', 'All']
          ].map(([value, text]) => (
            <button key={value} type="button" className={`pill${filter === value ? ' active' : ''}`} aria-pressed={filter === value} onClick={() => setFilter(value)}>
              {text}
            </button>
          ))}
        </div>
        <div className="raid-select-row">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Event type">
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <select value={sortKey} onChange={(e) => setSortKey(e.target.value)} aria-label="Sort events">
            <option value="date">Sort: Soonest</option>
            <option value="latest">Sort: Latest first</option>
            <option value="name">Sort: Name</option>
          </select>
        </div>
      </div>

      {list.length ? (
        <>
          <div className="section-head">
            <h3>{filter === 'live' ? 'Happening now' : 'Pokémon GO events'}</h3>
            <span>
              {list.length} {label}
            </span>
          </div>
          <div className="card-grid calendar-grid">
            {list.map((event) => (
              <EventCard key={event.eventID} event={event} onOpen={setOpenEvent} />
            ))}
          </div>
        </>
      ) : (
        <div className="empty">{failed && !eventsFeed.length ? 'Events could not be loaded. Try refreshing.' : 'No events in this view right now.'}</div>
      )}

      {openEvent && <EventDetailModal event={openEvent} onClose={() => setOpenEvent(null)} />}
    </section>
  );
}

function EventDetailModal({ event, onClose }) {
  const countdown = useCountdown(event.start, event.end);
  const highlights = eventHighlights(event);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="raid-modal-top">
          <span className="eyebrow">EVENT DETAILS</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="event-modal-heading">
          <div className="date-tile">
            <span>{new Intl.DateTimeFormat(undefined, { month: 'short' }).format(new Date(event.start))}</span>
            <b>{new Date(event.start).getDate()}</b>
            <span>{new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(event.start))}</span>
          </div>
          <div>
            <h2>{event.name}</h2>
            <p className="meta">{event.heading || event.eventType.replaceAll('-', ' ')}</p>
          </div>
        </div>
        <div className="event-modal-body">
          <p className="event-time">{formatRange(event.start, event.end)}</p>
          {countdown && <span className="countdown">{countdown.label}</span>}
          <div className="detail-label">What to expect</div>
          <p className="event-description">{eventDescription(event)}</p>
          {highlights.length > 0 && (
            <>
              <div className="detail-label">Highlights</div>
              <ul className="event-highlights">
                {highlights.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </>
          )}
          <div className="event-actions">
            <button type="button" className="calendar-button" onClick={() => addToCalendar(event)}>
              Add to Calendar
            </button>
            {event.link && (
              <a className="source-link" href={event.link} target="_blank" rel="noopener noreferrer">
                Source page ↗
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
