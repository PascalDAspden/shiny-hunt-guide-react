import { useEffect, useState } from 'react';
import Sprite from './Sprite.jsx';
import EvolutionLine from './EvolutionLine.jsx';
import OddsCalculator from './OddsCalculator.jsx';
import { RateNote } from './PokemonCard.jsx';
import { useCountdown } from '../hooks/useCountdown.js';
import { formatRange, parseDate, shortDate, timeOfDay } from '../utils/dates.js';
import { fetchRaidMatchup, typeName } from '../data/pokemon.js';
import { addToCalendar } from '../data/events.js';

const REMOTE_RAID_APPS = [
  { label: 'Open Campfire ↗', url: 'https://campfire.nianticlabs.com/' },
  { label: 'Open Poké Genie ↗', url: 'https://apps.apple.com/app/poke-genie-remote-raid-iv-pvp/id1143920524' },
  { label: 'Open PokeRaid ↗', url: 'https://apps.apple.com/app/pokeraid-raid-from-home/id1507659524' }
];

/**
 * `detail` = {
 *   kind: 'raid' | 'egg' | 'research' | 'event' | 'max',
 *   name, image, label, meta, odds, event,
 *   raidRaw   // only for kind === 'raid': the original raid object (for CP + type matchup)
 * }
 */
export default function PokemonDetail({ detail, onClose, tracked, onTrack, shinyFormArt, battleForms }) {
  const [matchup, setMatchup] = useState(null);
  const [matchupLoading, setMatchupLoading] = useState(detail.kind === 'raid');
  const countdown = useCountdown(detail.event?.start || detail.rotationEvent?.start, detail.event?.end || detail.rotationEvent?.end);
  const locked = detail.odds?.value === 'Shiny locked';

  useEffect(() => {
    if (detail.kind !== 'raid') return;
    let cancelled = false;
    setMatchupLoading(true);
    setMatchup(null);
    fetchRaidMatchup(detail.raidRaw.name, detail.raidRaw).then((result) => {
      if (!cancelled) {
        setMatchup(result);
        setMatchupLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [detail]);

  const cp = detail.raidRaw?.combatPower?.normal;
  const searchString = matchup?.weaknesses?.map((x) => '@' + x.type).join(',') || '';

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="raid-modal-top">
          <span className="eyebrow">{detail.kind === 'raid' ? 'RAID BOSS' : 'POKÉMON DETAILS'}</span>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>
        <div className="raid-modal-heading">
          <Sprite src={detail.image} name={detail.name} shiny={!locked} shinyFormArt={shinyFormArt} size={72} />
          <div>
            <h2>{detail.name}</h2>
            <p className="meta">{detail.label}</p>
          </div>
        </div>
        <div className="raid-modal-body">
          {detail.event ? (
            <p className="meta">{formatRange(detail.event.start, detail.event.end)}</p>
          ) : (
            <p className="meta detail-current">{detail.meta || 'In the current rotation'}</p>
          )}
          {detail.event && detail.meta && <p className="meta detail-current">{detail.meta}</p>}
          {detail.kind === 'raid' && !detail.event && detail.rotationEvent && <p className="meta">This raid rotation ends {shortDate(parseDate(detail.rotationEvent.end))}, {timeOfDay(parseDate(detail.rotationEvent.end))} (local time).</p>}
          {countdown && <span className="countdown">{detail.kind === 'raid' && !detail.event ? `Leaves raid pool in ${countdown.label.replace(/^Ends in /, '')}` : countdown.label}</span>}
          {cp?.min && (
            <p className="meta">
              Encounter CP {cp.min}–{cp.max}
            </p>
          )}

          {detail.kind === 'raid' && (
            <>
              <div className="detail-label">Type</div>
              <div className="type-chips">
                {matchupLoading ? (
                  <span className="meta">Loading Pokémon type…</span>
                ) : matchup?.types?.length ? (
                  matchup.types.map((t) => (
                    <span className="raid-type" key={t}>
                      {typeName(t)}
                    </span>
                  ))
                ) : (
                  <span className="meta">Type details unavailable for this form</span>
                )}
              </div>
              <div className="detail-label">Effective attack types</div>
              <div className="type-chips">
                {matchupLoading ? (
                  <span className="meta">Checking matchups…</span>
                ) : matchup?.weaknesses?.length ? (
                  matchup.weaknesses.map((x) => (
                    <span className={`raid-type${x.multiplier > 2 ? ' extra-weak' : ''}`} key={x.type}>
                      {typeName(x.type)}
                      {x.multiplier > 2 ? ' ×2.56' : ''}
                    </span>
                  ))
                ) : matchup ? (
                  <span className="meta">No super-effective type matchup</span>
                ) : (
                  <span className="meta">Type matchup unavailable</span>
                )}
              </div>
              {searchString && (
                <>
                  <p className="meta detail-hint">Find Pokémon with these move types in Pokémon GO. This search does not rank your best counters.</p>
                  <div className="counter-copy">
                    <code>{searchString}</code>
                    <CopyButton text={searchString} />
                  </div>
                </>
              )}
            </>
          )}

          <div className="detail-label">Shiny chance</div>
          <RateNote odds={detail.odds} />
          {!locked && <OddsCalculator key={`${detail.kind}:${detail.name}:${detail.odds?.value}`} odds={detail.odds} />}

          <div className="event-actions">
            {!locked && (
              <button type="button" className={`track-button${tracked ? ' active' : ''}`} onClick={onTrack}>
                {tracked ? 'Tracking ✓' : 'Track hunt'}
              </button>
            )}
            {detail.event && (
              <button type="button" className="calendar-button" onClick={() => addToCalendar(detail.event)}>
                Add to Calendar
              </button>
            )}
            {detail.event?.link && (
              <a className="source-link" href={detail.event.link} target="_blank" rel="noopener noreferrer">
                Event details ↗
              </a>
            )}
          </div>

          {detail.kind === 'raid' && !locked && (
            <div className="remote-raid">
              <div className="detail-label">Find a remote raid</div>
              <div className="remote-actions">
                {REMOTE_RAID_APPS.map((app) => (
                  <a key={app.url} className="remote-button" href={app.url} target="_blank" rel="noopener noreferrer">
                    {app.label}
                  </a>
                ))}
              </div>
              <p className="meta detail-hint">Search for {detail.name} in the service you open. Live rooms and availability are managed there.</p>
            </div>
          )}

          <EvolutionLine item={detail.raidRaw || detail} shinyFormArt={shinyFormArt} battleForms={battleForms} />
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <button type="button" onClick={copy}>
      {copied ? 'Copied ✓' : 'Copy search'}
    </button>
  );
}
