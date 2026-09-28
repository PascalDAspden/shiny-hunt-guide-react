import { useMemo, useState } from 'react';
import RaidCard from '../components/RaidCard.jsx';
import RaidFilters from '../components/RaidFilters.jsx';
import PokemonDetail from '../components/PokemonDetail.jsx';
import { scheduledRaids, currentRaidRotation, raidRate, rate } from '../data/raids.js';
import { filterRaids, matchesAnyQuery } from '../utils/raidFilters.js';
import { sortRaids } from '../utils/raidSorting.js';

export default function Raids({ raidsFeed, events, pokemonInfo, battleForms, appearance, shinyFormArt, query, activeHunt, isActive, setActiveHunt }) {
  const [scope, setScope] = useState('current');
  const [raidType, setRaidType] = useState('all');
  const [sortKey, setSortKey] = useState('tier');
  const [shinyOnly, setShinyOnly] = useState(true);
  const [openRaid, setOpenRaid] = useState(null);

  const upcoming = useMemo(() => scheduledRaids(events, raidsFeed, pokemonInfo), [events, raidsFeed, pokemonInfo]);

  const pool = useMemo(() => {
    const current = raidsFeed.filter((r) => matchesAnyQuery([r.name, r.tier], query))
      .map((raid) => ({ ...raid, rotationEvent: currentRaidRotation(raid, events) }));
    const scheduled = upcoming.filter((r) => matchesAnyQuery([r.name, r.tier, r.event.name], query));
    const combined = [...(scope === 'upcoming' ? [] : current), ...(scope === 'current' ? [] : scheduled)];
    return filterRaids(combined, { raidType, shinyOnly });
  }, [raidsFeed, upcoming, events, scope, raidType, shinyOnly, query]);

  const sorted = useMemo(
    () => sortRaids(pool, { sortKey, scope, rateFn: (r) => raidRate(r, events) }),
    [pool, sortKey, scope, events]
  );

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
      {sorted.length ? (
        <div className="card-grid">
          {sorted.map((raid) => (
            <RaidCard
              key={`${raid.name}:${raid.event?.eventID || 'current'}`}
              raid={raid}
              events={events}
              appearance={appearance}
              shinyFormArt={shinyFormArt}
              tracked={isActive('raid', raid.name, raid.event?.eventID || '')}
              onTrack={(r, eventId) =>
                setActiveHunt(
                  isActive('raid', r.name, eventId)
                    ? null
                    : { kind: 'raid', name: r.name, eventId, image: r.image, label: r.tier, odds: raidRate(r, events), start: r.event?.start || r.rotationEvent?.start, end: r.event?.end || r.rotationEvent?.end }
                )
              }
              onOpen={openDetail}
            />
          ))}
        </div>
      ) : (
        <div className="empty">No raids match these filters right now.</div>
      )}

      {openRaid && (
        <PokemonDetail
          detail={openRaid}
          onClose={() => setOpenRaid(null)}
          shinyFormArt={shinyFormArt}
          battleForms={battleForms}
          tracked={isActive('raid', openRaid.name, openRaid.event?.eventID || '')}
          onTrack={() =>
            setActiveHunt(
              isActive('raid', openRaid.name, openRaid.event?.eventID || '')
                ? null
                : {
                    kind: 'raid',
                    name: openRaid.name,
                    eventId: openRaid.event?.eventID || '',
                    image: openRaid.image,
                    label: openRaid.label,
                    odds: openRaid.odds,
                    start: openRaid.event?.start || openRaid.rotationEvent?.start,
                    end: openRaid.event?.end || openRaid.rotationEvent?.end
                  }
            )
          }
        />
      )}
    </section>
  );
}
