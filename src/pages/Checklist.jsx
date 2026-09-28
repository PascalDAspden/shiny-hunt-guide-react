import { useMemo, useState } from 'react';
import Sprite from '../components/Sprite.jsx';
import { useCountdown, useCountdownTo, useLocalClock } from '../hooks/useCountdown.js';
import { shortDate, timeOfDay, parseDate, now } from '../utils/dates.js';
import { scheduledRaids, raidRate, researchRewards, rate } from '../data/raids.js';
import { eventEncounters, maxEncounters } from '../data/events.js';
import { shinyRocketEncounters } from '../data/rocket.js';

const KIND_LABEL = { raid: 'RAID', max: 'MAX BATTLE', event: 'EVENT', egg: 'EGG', research: 'RESEARCH', rocket: 'SHADOW' };

function oddsNumber(item) {
  return Number(String(item.odds?.value || '').split('/')[1]) || 9999;
}

function buildTrackableHunts({ raidsFeed, events, eggsFeed, researchFeed, rocketFeed, pokemonInfo }) {
  const upcoming = scheduledRaids(events, raidsFeed, pokemonInfo);
  const raids = [...raidsFeed, ...upcoming]
    .filter((p) => p.canBeShiny !== false)
    .map((p) => ({
      kind: 'raid',
      name: p.name,
      eventId: p.event?.eventID || '',
      image: p.image,
      odds: raidRate(p, events),
      start: p.event?.start,
      end: p.event?.end,
      label: p.tier
    }));

  const eggs = eggsFeed
    .filter((p) => p.canBeShiny !== false)
    .map((p) => ({ kind: 'egg', name: p.name, eventId: '', image: p.image, odds: rate('1/64', 'estimated', 'Egg hatch'), label: p.eggType || 'Egg' }));

  const research = researchRewards(researchFeed).map((p) => ({
    kind: 'research',
    name: p.name,
    eventId: '',
    image: p.image,
    odds: rate('1/512', 'estimated', 'Field research fallback'),
    label: 'Field research'
  }));

  const eventTargets = eventEncounters(events, eggsFeed).map((p) => ({
    kind: 'event',
    name: p.name,
    eventId: p.event.eventID,
    image: p.image,
    odds: p.odds,
    start: p.event.start,
    end: p.event.end,
    label: p.event.name
  }));

  const maxTargets = maxEncounters(events, pokemonInfo, [...eggsFeed]).map((p) => ({
    kind: 'max',
    name: p.name,
    eventId: p.event.eventID,
    image: p.image,
    odds: p.odds,
    start: p.event.start,
    end: p.event.end,
    label: p.event.name
  }));

  const rocket = shinyRocketEncounters(rocketFeed).map((p) => ({ kind: 'rocket', name: p.name, eventId: p.trainer, image: p.image, odds: p.odds, label: `Team GO Rocket · ${p.trainer}` }));
  return [...raids, ...eventTargets, ...maxTargets, ...eggs, ...research, ...rocket];
}

export default function Checklist({ raidsFeed, eggsFeed, researchFeed, rocketFeed, events, pokemonInfo, appearance, shinyFormArt, query, activeHunt, isActive, setActiveHunt, isChecked, toggleChecked, checked, compact = false }) {
  const [hideChecked, setHideChecked] = useState(false);
  const clock = useLocalClock();

  const all = useMemo(
    () => buildTrackableHunts({ raidsFeed, events, eggsFeed, researchFeed, rocketFeed, pokemonInfo }),
    [raidsFeed, events, eggsFeed, researchFeed, rocketFeed, pokemonInfo]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return all
      .filter((item) => !q || item.name.toLowerCase().includes(q) || item.label.toLowerCase().includes(q))
      .filter((item) => !hideChecked || !isChecked(item.kind, item.name, item.eventId))
      .sort((a, b) => {
        const activeA = a.start ? parseDate(a.start) <= now() : true;
        const activeB = b.start ? parseDate(b.start) <= now() : true;
        return Number(activeB) - Number(activeA) || oddsNumber(a) - oddsNumber(b) || a.name.localeCompare(b.name);
      });
  }, [all, query, hideChecked, isChecked]);

  const tracked = activeHunt
    ? all.find((item) => isActive(item.kind, item.name, item.eventId)) || {
        kind: activeHunt.kind,
        name: activeHunt.name,
        eventId: activeHunt.eventId,
        image: activeHunt.image,
        label: activeHunt.label || 'Saved hunt',
        odds: { value: activeHunt.odds || 'Rate saved' },
        start: activeHunt.start,
        end: activeHunt.end
      }
    : null;

  return (
    <section className="page">
      <div className="dashboard-title">
        <div>
          <span className="eyebrow">TODAY'S OPPORTUNITIES</span>
          <h2>Your hunt dashboard</h2>
        </div>
        <span className="local-clock">{clock}</span>
      </div>

      {tracked ? (
        <ActiveHuntPanel item={tracked} shinyFormArt={shinyFormArt} onClear={() => setActiveHunt(null)} />
      ) : (
        <div className="dashboard-empty">
          <strong>No active hunt yet</strong>
          <span>Tap "Track hunt" on any item below to pin it here.</span>
        </div>
      )}

      <p className="dashboard-note">Countdowns use this device's local time. A remote raid cutoff is a 24-hour time-zone estimate, not guaranteed lobby availability.</p>

      {compact ? null : <>

      <div className="section-head">
        <h3>All trackable targets</h3>
        <span>
          {filtered.length} of {all.length}
        </span>
      </div>
      <label className="shiny-only-toggle">
        <input type="checkbox" checked={hideChecked} onChange={(e) => setHideChecked(e.target.checked)} />
        Hide items I've already checked off ({checked.size} checked)
      </label>

      <div className="checklist-list">
        {filtered.map((item) => (
          <ChecklistRow
            key={`${item.kind}:${item.name}:${item.eventId}`}
            item={item}
            appearance={appearance}
            shinyFormArt={shinyFormArt}
            tracked={isActive(item.kind, item.name, item.eventId)}
            checked={isChecked(item.kind, item.name, item.eventId)}
            onTrack={() => setActiveHunt(isActive(item.kind, item.name, item.eventId) ? null : item)}
            onToggleChecked={() => toggleChecked(item.kind, item.name, item.eventId)}
          />
        ))}
        {!filtered.length && <div className="empty">Nothing matches this filter right now.</div>}
      </div>
      </>}
    </section>
  );
}

function ActiveHuntPanel({ item, shinyFormArt, onClear }) {
  const windowCountdown = useCountdown(item.start, item.end);
  const remoteEnd = item.end ? new Date(parseDate(item.end).getTime() + 24 * 60 * 60 * 1000) : null;
  const remoteCountdown = useCountdownTo(remoteEnd, 'Estimated remote window ends');
  const startCountdown = useCountdownTo(item.start, item.kind === 'raid' ? 'Local raids start' : 'Hunt starts');

  let timing;
  if (item.start && item.end) {
    const start = parseDate(item.start);
    const end = parseDate(item.end);
    if (now() < start) {
      timing = (
        <>
          <span className="countdown">{startCountdown}</span>
          <small>
            {shortDate(start)} at {timeOfDay(start)}
          </small>
        </>
      );
    } else if (now() < end) {
      timing = (
        <>
          <span className="countdown">{windowCountdown?.label}</span>
          <small>
            Local end: {shortDate(end)} at {timeOfDay(end)}
          </small>
        </>
      );
    } else if (item.kind === 'raid' && remoteEnd && now() < remoteEnd) {
      timing = (
        <>
          <span className="local-ended">Local window ended</span>
          <span className="countdown">{remoteCountdown}</span>
          <small>
            About {shortDate(remoteEnd)} at {timeOfDay(remoteEnd)} your time
          </small>
        </>
      );
    } else {
      timing = <span className="local-ended">This timed hunt has ended</span>;
    }
  } else {
    timing = <span className="availability-now">Available now</span>;
  }

  return (
    <div className="tracked-hunt">
      <Sprite src={item.image} name={item.name} shiny shinyFormArt={shinyFormArt} size={72} />
      <div className="tracked-main">
        <span className="opportunity-kind">ACTIVE HUNT</span>
        <h3>{item.name}</h3>
        <p>
          {item.label} · {item.odds?.value}
        </p>
        <div className="tracked-timing">{timing}</div>
        <div className="tracked-actions">
          <button type="button" className="clear-hunt" onClick={onClear}>
            Stop tracking
          </button>
          {item.kind === 'raid' && (
            <>
              <a href="https://campfire.nianticlabs.com/" target="_blank" rel="noopener noreferrer">
                Campfire ↗
              </a>
              <a href="https://apps.apple.com/app/poke-genie-remote-raid-iv-pvp/id1143920524" target="_blank" rel="noopener noreferrer">
                Poké Genie ↗
              </a>
              <a href="https://apps.apple.com/app/pokeraid-raid-from-home/id1507659524" target="_blank" rel="noopener noreferrer">
                PokeRaid ↗
              </a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistRow({ item, appearance, shinyFormArt, tracked, checked, onTrack, onToggleChecked }) {
  const countdown = useCountdown(item.start, item.end);
  return (
    <article className={`checklist-row${checked ? ' is-checked' : ''}`}>
      <label className="checklist-check row-check">
        <input type="checkbox" checked={checked} onChange={onToggleChecked} />
      </label>
      <Sprite src={item.image} name={item.name} shiny={appearance === 'shiny'} shinyFormArt={shinyFormArt} size={44} />
      <div className="checklist-row-main">
        <span className="opportunity-kind">{KIND_LABEL[item.kind]}</span>
        <h4>{item.name}</h4>
        <p className="meta">
          {item.label} · {item.odds?.value}
        </p>
        {countdown ? <span className="countdown">{countdown.label}</span> : item.start ? <span className="local-ended">Ended</span> : null}
      </div>
      <button type="button" className={`track-button${tracked ? ' active' : ''}`} onClick={onTrack}>
        {tracked ? 'Tracking ✓' : 'Track'}
      </button>
    </article>
  );
}
