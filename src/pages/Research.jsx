import { useMemo, useState } from 'react';
import PokemonCard from '../components/PokemonCard.jsx';
import PokemonDetail from '../components/PokemonDetail.jsx';
import { researchRewards, rate } from '../data/raids.js';
import { eventEncounters, maxEncounters } from '../data/events.js';
import { matchesAnyQuery } from '../utils/raidFilters.js';
import { shortDate, timeOfDay, parseDate } from '../utils/dates.js';
import { shinyRocketEncounters } from '../data/rocket.js';
import { breakthroughPool, BREAKTHROUGH_END, BREAKTHROUGH_SOURCE } from '../data/breakthrough.js';

const EGG_DISTANCES = ['all', '1 km', '2 km', '5 km', '7 km', '10 km', '12 km'];

// The same species can hatch from several distances, but repeated records for
// the same egg pool should only produce one card.
function eggPoolKey(egg) {
  return [egg.name, egg.eggType, Boolean(egg.isAdventureSync), Boolean(egg.isGiftExchange)].join(':');
}

function Section({ title, children, count }) {
  if (!count) return null;
  return (
    <section className="card-section">
      <div className="section-head">
        <h3>{title}</h3>
        <span>
          {count} {count === 1 ? 'target' : 'targets'}
        </span>
      </div>
      <div className="card-grid">{children}</div>
    </section>
  );
}

export default function Research({ researchFeed, eggsFeed, raidsFeed = [], rocketFeed, events, pokemonInfo, battleForms, appearance, shinyFormArt, query, activeHunt, isActive, setActiveHunt, isChecked, toggleChecked, sectionFilter = 'all' }) {
  const [eggDistance, setEggDistance] = useState('all');
  const [openDetail, setOpenDetail] = useState(null);

  const research = useMemo(() => researchRewards(researchFeed).filter((r) => matchesAnyQuery([r.name, r.task], query)), [researchFeed, query]);
  const eggs = useMemo(
    () => {
      const seen = new Set();
      return eggsFeed.filter((egg) => {
        if (eggDistance !== 'all' && egg.eggType?.trim() !== eggDistance) return false;
        if (!matchesAnyQuery([egg.name, egg.eggType], query)) return false;
        const key = eggPoolKey(egg);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    [eggsFeed, eggDistance, query]
  );
  const eventTargets = useMemo(() => eventEncounters(events, eggsFeed).filter((p) => matchesAnyQuery([p.name, p.event.name], query)), [events, eggsFeed, query]);
  const maxTargets = useMemo(() => maxEncounters(events, pokemonInfo, [...eggsFeed, ...raidsFeed]).filter((p) => matchesAnyQuery([p.name, p.event.name], query)), [events, pokemonInfo, eggsFeed, raidsFeed, query]);
  const rocketTargets = useMemo(() => shinyRocketEncounters(rocketFeed).filter((p) => matchesAnyQuery([p.name, p.trainer], query)), [rocketFeed, query]);
  const breakthroughs = new Date() < BREAKTHROUGH_END ? breakthroughPool.filter((p) => matchesAnyQuery([p.name], query)) : [];
  const maxMondays = maxTargets.filter((p) => p.event.eventType === 'max-mondays');
  const maxBattles = maxTargets.filter((p) => p.event.eventType !== 'max-mondays');

  const track = (kind, item, eventId) => {
    const id = eventId || item.huntId || '';
    const active = isActive(kind, item.name, id);
    setActiveHunt(active ? null : { kind, name: item.name, eventId: id, image: item.image, label: item.eggType || item.event?.name || item.trainer || 'Field research', odds: item.odds || rate('Check species', 'unverified', 'Availability varies by encounter'), start: item.event?.start, end: item.event?.end });
  };

  const openItem = (kind, item) => {
    const event = item.event;
    const eventId = event?.eventID || '';
    const base = {
      kind,
      name: item.name,
      image: item.image,
      event,
      huntId: item.huntId,
      trainer: item.trainer,
      odds:
        kind === 'egg'
          ? item.canBeShiny === false
            ? rate('Shiny locked', 'feed status', 'Not shiny-capable from this egg')
            : rate('1/64', 'estimated', 'Egg hatch; varies by species')
          : kind === 'research'
            ? rate('Check species', 'unverified', 'Research feed does not reliably report shiny availability')
            : item.odds || rate('Rate unknown', 'unverified', 'Shiny odds depend on the encounter')
    };
    if (kind === 'egg') base.label = item.eggType || 'Egg hatch';
    if (kind === 'research') base.label = 'Field research reward';
    if (kind === 'rocket') { base.label = `Team GO Rocket · ${item.trainer}`; base.meta = 'Catchable Shadow reward'; }
    if (kind === 'breakthrough') { base.label = 'Research Breakthrough'; base.meta = 'Twilight Trails · 7 daily Field Research stamps'; }
    if (kind === 'event' || kind === 'max') {
      base.label = event.name;
      base.meta = `${shortDate(parseDate(event.start))} ${timeOfDay(parseDate(event.start))}`;
    }
    setOpenDetail(base);
    void eventId;
  };

  const nothing = !research.length && !eggs.length && !eventTargets.length && !maxTargets.length && !rocketTargets.length;

  return (
    <section className="page">
      {(sectionFilter === 'all' || sectionFilter === 'events') && <Section title="Featured event Pokémon" count={eventTargets.length}>
        {eventTargets.map((p) => (
          <PokemonCard
            key={`${p.name}:${p.event.eventID}`}
            kind="event"
            item={p}
            appearance={appearance}
            shinyFormArt={shinyFormArt}
            tracked={isActive('event', p.name, p.event.eventID)}
            checked={isChecked('event', p.name, p.event.eventID)}
            onTrack={track}
            onToggleChecked={toggleChecked}
            onOpen={openItem}
          />
        ))}
      </Section>}

      {(sectionFilter === 'all' || sectionFilter === 'max') && maxMondays.length > 0 && <p className="section-explainer">Max Mondays feature a weekly Dynamax rotation at Power Spots, with local event times shown on each card.</p>}
      {(sectionFilter === 'all' || sectionFilter === 'max') && <Section title="Max Monday · weekly rotation" count={maxMondays.length}>
        {maxMondays.map((p) => (
          <PokemonCard
            key={`${p.name}:${p.event.eventID}`}
            kind="max"
            item={p}
            appearance={appearance}
            shinyFormArt={shinyFormArt}
            tracked={isActive('max', p.name, p.event.eventID)}
            checked={isChecked('max', p.name, p.event.eventID)}
            onTrack={track}
            onToggleChecked={toggleChecked}
            onOpen={openItem}
          />
        ))}
      </Section>}

      {(sectionFilter === 'all' || sectionFilter === 'max') && <Section title="Other Max Battles" count={maxBattles.length}>
        {maxBattles.map((p) => (
          <PokemonCard key={`${p.name}:${p.event.eventID}`} kind="max" item={p} appearance={appearance} shinyFormArt={shinyFormArt}
            tracked={isActive('max', p.name, p.event.eventID)} checked={isChecked('max', p.name, p.event.eventID)}
            onTrack={track} onToggleChecked={toggleChecked} onOpen={openItem} />
        ))}
      </Section>}

      {(sectionFilter === 'all' || sectionFilter === 'eggs') && <section className="card-section">
        <div className="section-head">
          <h3>Egg hatches</h3>
          <span>{eggs.length} targets</span>
        </div>
        <div className="egg-pool-row" role="group" aria-label="Egg distance">
          {EGG_DISTANCES.map((d) => (
            <button key={d} type="button" className={`pill${eggDistance === d ? ' active' : ''}`} aria-pressed={eggDistance === d} onClick={() => setEggDistance(d)}>
              {d === 'all' ? 'All eggs' : d}
            </button>
          ))}
        </div>
        {eggs.length ? (
          <div className="card-grid">
            {eggs.map((egg) => (
              <PokemonCard
                key={eggPoolKey(egg)}
                kind="egg"
                item={egg}
                appearance={appearance}
                shinyFormArt={shinyFormArt}
                tracked={isActive('egg', egg.name)}
                checked={isChecked('egg', egg.name)}
                onTrack={track}
                onToggleChecked={toggleChecked}
                onOpen={openItem}
              />
            ))}
          </div>
        ) : (
          <div className="empty">No eggs match this filter right now.</div>
        )}
      </section>}

      {(sectionFilter === 'all' || sectionFilter === 'research') && <Section title="Field research Pokémon" count={research.length}>
        {sectionFilter === 'research' && <p className="section-explainer">Current Field Research encounters. The source’s shiny flags are unreliable, so verify shiny availability for each encounter before hunting.</p>}
        {research.map((r) => (
          <PokemonCard
            key={r.name + r.task}
            kind="research"
            item={{ ...r, odds: rate('Check species', 'unverified', 'Research shiny status is not reliable in the feed') }}
            appearance={appearance}
            shinyFormArt={shinyFormArt}
            tracked={isActive('research', r.name)}
            checked={isChecked('research', r.name)}
            onTrack={track}
            onToggleChecked={toggleChecked}
            onOpen={openItem}
          />
        ))}
      </Section>}

      {sectionFilter === 'research' && !research.length && <div className="empty">No Field Research Pokémon match your search in the current feed.</div>}

      {sectionFilter === 'breakthrough' && <section className="card-section">
        <div className="section-head"><h3>Research Breakthrough</h3><span>{breakthroughs.length} possible encounters</span></div>
        <p className="section-explainer">Twilight Trails · Sep 8–Dec 1, 2026. Earn a stamp for the first Field Research task you finish each day; 7 stamps unlock a Breakthrough. Shiny availability and odds vary by encounter. <a href={BREAKTHROUGH_SOURCE} target="_blank" rel="noopener noreferrer">Check Leek Duck’s current pool ↗</a></p>
        {new Date() >= BREAKTHROUGH_END ? <div className="empty">This seasonal pool has ended. Check the source for the new Breakthrough rewards.</div> : <div className="card-grid">
          {breakthroughs.map((p) => <PokemonCard key={p.name} kind="breakthrough" item={{ ...p, odds: rate('Check species', 'unverified', 'Breakthrough shiny availability depends on species') }}
            appearance={appearance} shinyFormArt={shinyFormArt} tracked={isActive('breakthrough', p.name)} checked={isChecked('breakthrough', p.name)}
            onTrack={track} onToggleChecked={toggleChecked} onOpen={openItem} />)}
        </div>}
      </section>}

      {(sectionFilter === 'all' || sectionFilter === 'rocket') && <section className="card-section">
        <div className="section-head"><h3>Team GO Rocket · shiny Shadow rewards</h3><span>{rocketTargets.length} targets</span></div>
        {sectionFilter === 'rocket' && <p className="section-explainer">Only catchable rewards explicitly marked shiny in the Rocket lineup feed appear here. <a href="https://leekduck.com/rocket-lineups/" target="_blank" rel="noopener noreferrer">See full lineups ↗</a></p>}
        {rocketTargets.length ? <div className="card-grid">{rocketTargets.map((p) => (
          <PokemonCard key={`${p.trainer}:${p.name}`} kind="rocket" item={{ ...p, huntId: p.trainer }} appearance={appearance} shinyFormArt={shinyFormArt}
            tracked={isActive('rocket', p.name, p.trainer)} checked={isChecked('rocket', p.name, p.trainer)} onTrack={track} onToggleChecked={toggleChecked} onOpen={openItem} />
        ))}</div> : sectionFilter === 'rocket' && <div className="empty">No confirmed shiny Shadow reward loaded. Check the Rocket lineup source and try Refresh.</div>}
      </section>}

      {sectionFilter === 'all' && nothing && <div className="empty">No matching shiny targets in the current feed.</div>}

      {openDetail && (
        <PokemonDetail
          detail={openDetail}
          onClose={() => setOpenDetail(null)}
          shinyFormArt={shinyFormArt}
          battleForms={battleForms}
          tracked={isActive(openDetail.kind, openDetail.name, openDetail.event?.eventID || openDetail.huntId || '')}
          onTrack={() => track(openDetail.kind, openDetail, openDetail.event?.eventID || openDetail.huntId || '')}
        />
      )}
    </section>
  );
}
