import { useMemo, useState } from 'react';
import RaidCard from '../components/RaidCard.jsx';
import RaidFilters from '../components/RaidFilters.jsx';
import PokemonDetail from '../components/PokemonDetail.jsx';
import { scheduledRaids, currentRaidRotation, raidRate, rate } from '../data/raids.js';
import { filterRaids, matchesAnyQuery } from '../utils/raidFilters.js';
import { upcomingRotationRaids } from '../data/raidRotations.js';
import { formatRange } from '../utils/dates.js';
import { sortRaids } from '../utils/raidSorting.js';

export default function Raids({ raidsFeed, raidRotations = [], events, pokemonInfo, battleForms, appearance, shinyFormArt, query }) {
  const [scope, setScope] = useState('current');
  const [raidType, setRaidType] = useState('all');
  const [sortKey, setSortKey] = useState('tier');
  const [shinyOnly, setShinyOnly] = useState(false);
  const [openRaid, setOpenRaid] = useState(null);

  const upcoming = useMemo(() => {
    const dated = upcomingRotationRaids(raidRotations);
    const covered = new Set(dated.map(r => r.name.toLowerCase()));
    return [...dated, ...scheduledRaids(events, raidsFeed, pokemonInfo).filter(r => !covered.has(r.name.toLowerCase()))];
  }, [raidRotations, events, raidsFeed, pokemonInfo]);

  const pool = useMemo(() => {
    const current = raidsFeed.filter((r) => matchesAnyQuery([r.name, r.tier], query))
      .map((raid) => ({ ...raid, rotationEvent: raid.rotationEvent || currentRaidRotation(raid, events) }));
    const scheduled = upcoming.filter((r) => matchesAnyQuery([r.name, r.tier, r.event.name], query));
    const combined = [...(scope === 'upcoming' ? [] : current), ...(scope === 'current' ? [] : scheduled)];
    return filterRaids(combined, { raidType, shinyOnly });
  }, [raidsFeed, upcoming, events, scope, raidType, shinyOnly, query]);

  const sorted = useMemo(
    () => sortRaids(pool, { sortKey, scope, rateFn: (r) => raidRate(r, events) }),
    [pool, sortKey, scope, events]
  );

  const rotationNotes = [...new Map(sorted.filter(raid => raid.rotationEvent || raid.event).map(raid => { const event = raid.rotationEvent || raid.event; return [event.eventID || event.name, { event, description: raid.rotationDescription }]; })).values()];

  const heading = scope === 'current' ? 'Current raid bosses' : scope === 'upcoming' ? 'Upcoming raid bosses' : 'Current & upcoming raids';

  const openDetail = (raid) => {
    const locked = raid.canBeShiny === false;
    setOpenRaid({
      kind: 'raid',
      name: raid.name,
      image: raid.image,
      label: raid.tier,
      event: raid.event,
      rotationEvent: raid.rotationEvent,
      raidRaw: raid,
      odds: locked ? rate('Shiny locked', 'feed status', 'Shiny unavailable from this raid') : raidRate(raid, events)
    });
  };

  return (
    <section className="page">
      <div className="section-head">
        <h3>{heading}</h3>
        <span>
          {sorted.length} {sorted.length === 1 ? 'target' : 'targets'}
        </span>
      </div>
      <RaidFilters
        scope={scope}
        onScopeChange={setScope}
        raidType={raidType}
        onRaidTypeChange={setRaidType}
        sortKey={sortKey}
        onSortChange={setSortKey}
        shinyOnly={shinyOnly}
        onShinyOnlyChange={setShinyOnly}
      />
      <p className="meta">1-star and 3-star are raid eggs at gyms. The Eggs tab contains eggs you hatch by walking. This lists published bosses, not nearby live gyms.</p>
      {!!rotationNotes.length && <details className="raid-source-notes"><summary>Raid rotation details</summary>{rotationNotes.map(({ event, description }) => <div key={event.eventID || event.name}><strong>{event.name}</strong><p className="meta">{formatRange(event.start, event.end)}</p>{description && <p className="meta">{description}</p>}{event.link && <a href={event.link} target="_blank" rel="noopener noreferrer">Source guide ↗</a>}</div>)}</details>}
      {shinyOnly && <p className="meta">Shiny-capable only is on. Turn it off to include every listed boss.</p>}
      {sorted.length ? (
        <div className="card-grid">
          {sorted.map((raid) => (
            <RaidCard
              key={`${raid.name}:${raid.event?.eventID || 'current'}`}
              raid={raid}
              events={events}
              appearance={appearance}
              shinyFormArt={shinyFormArt}
              onOpen={openDetail}
            />
          ))}
        </div>
      ) : (
        <div className="empty">{shinyOnly ? 'No shiny-capable bosses match. Turn off Shiny-capable only to see every listed boss.' : raidType === 'one' || raidType === 'three' ? 'No normal bosses of this tier are listed for the selected time. Shadow raids have a separate filter; special Raid Days may replace the normal lineup.' : 'No raids match these filters right now.'}</div>
      )}

      {openRaid && (
        <PokemonDetail
          detail={openRaid}
          onClose={() => setOpenRaid(null)}
          shinyFormArt={shinyFormArt}
          battleForms={battleForms}
        />
      )}
    </section>
  );
}
