import Sprite from './Sprite.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { shortDate, timeOfDay, parseDate } from '../utils/dates.js';
import { addToCalendar } from '../data/events.js';

/** The little "✦ 1/64  ·  estimated" shiny-rate block shown on every card and detail view. */
export function RateNote({ odds }) {
  if (!odds) return null;
  return (
    <div className={`rate-note-block${odds.value === 'Shiny locked' ? ' locked' : ''}`}>
      <div className="rate-line">
        ✦ {odds.value} <span className="confidence">{odds.confidence}</span>
      </div>
      <p className="rate-reason">
        {odds.reason}
        {odds.note ? ` · ${odds.note}` : ''}
      </p>
    </div>
  );
}

const KIND_LABEL = { egg: 'EGG', research: 'RESEARCH', breakthrough: 'BREAKTHROUGH', rocket: 'SHADOW', event: 'EVENT', max: 'MAX' };

/**
 * `kind` is one of 'egg' | 'research' | 'event' | 'max'.
 * `item` shape varies slightly by kind (see data/raids.js and data/events.js),
 * but always has at least { name, image }.
 */
export default function PokemonCard({ kind, item, appearance, shinyFormArt, tracked, checked, onTrack, onToggleChecked, onOpen }) {
  const locked = item.canBeShiny === false;
  const event = item.event;
  const countdown = useCountdown(event?.start, event?.end);
  const eventId = event?.eventID || item.huntId || '';

  const badge = locked
    ? 'LOCKED'
    : kind === 'egg'
      ? item.eggType || 'EGG'
      : kind === 'max'
        ? (item.name.startsWith('Gigantamax') ? 'GIGANTAMAX' : 'DYNAMAX')
        : event
          ? (parseDate(event.start) <= new Date() ? 'LIVE EVENT' : 'UPCOMING')
          : KIND_LABEL[kind];

  const metaLine =
    kind === 'egg'
      ? `${item.eggType || 'Egg'}${item.isAdventureSync ? ' · Adventure Sync' : ''}${item.isGiftExchange ? ' · Route Gift' : ''}`
      : kind === 'research'
        ? `${item.task}${item.combatPower?.min ? ` · CP ${item.combatPower.min}–${item.combatPower.max}` : ''}`
        : kind === 'rocket'
          ? `${item.trainer} · catchable Shadow reward`
          : kind === 'breakthrough'
            ? '7 Field Research stamps · seasonal reward pool'
        : event
          ? `${event.name} · ${shortDate(parseDate(event.start))}, ${timeOfDay(parseDate(event.start))}`
          : '';

  return (
    <article className="card pokemon-card" onClick={() => onOpen?.(kind, item)}>
      <Sprite src={item.image} name={item.name} shiny={appearance === 'shiny' && !locked} shinyFormArt={shinyFormArt} />
      <div className="card-main">
        <div className="card-top">
          <h4>{item.name}</h4>
          <span className={`badge${locked ? ' locked' : kind === 'event' || kind === 'max' ? ' gold' : ''}`}>{badge}</span>
        </div>
        <p className="meta">{metaLine}</p>
        {kind === 'egg' && Number.isInteger(Number(item.rarity)) && Number(item.rarity) >= 1 && Number(item.rarity) <= 5 && (
          <div className="hatch-rarity">
            Hatch rarity <strong>{item.rarity} of 5</strong>{' '}
            <span>{Number(item.rarity) === 1 ? 'more common' : Number(item.rarity) === 5 ? 'rarest tier' : 'rarer tier'}</span>
          </div>
        )}
        {countdown && <span className="countdown">{countdown.label}</span>}
        <RateNote odds={item.odds} />
        <div className="event-actions" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="link-button" onClick={() => onOpen?.(kind, item)}>
            View details →
          </button>
          {!locked && (
            <button type="button" className={`track-button${tracked ? ' active' : ''}`} onClick={() => onTrack?.(kind, item, eventId)}>
              {tracked ? 'Tracking ✓' : 'Track hunt'}
            </button>
          )}
          {event && (
            <button type="button" className="calendar-button" onClick={() => addToCalendar(event)}>
              Add event to Calendar
            </button>
          )}
          {onToggleChecked && (
            <label className="checklist-check">
              <input type="checkbox" checked={!!checked} onChange={() => onToggleChecked(kind, item.name, eventId)} />
              On checklist
            </label>
          )}
        </div>
      </div>
    </article>
  );
}
