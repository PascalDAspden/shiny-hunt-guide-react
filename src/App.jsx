import { useCallback, useEffect, useMemo, useState } from 'react';
import ShinyToggle from './components/ShinyToggle.jsx';
import Raids from './pages/Raids.jsx';
import Research from './pages/Research.jsx';
import Events from './pages/Events.jsx';
import PromoCodes from './pages/PromoCodes.jsx';
import Checklist from './pages/Checklist.jsx';
import OddsCalculator from './components/OddsCalculator.jsx';
import { fetchRaidsFeed, fetchEggsFeed, fetchResearchFeed, fetchEventsFeed, fetchRocketFeed, scheduledRaids, researchRewards } from './data/raids.js';
import { maxEncounters } from './data/events.js';
import { shinyRocketEncounters } from './data/rocket.js';
import { fetchSpeciesInfo, fetchGmaxArt, fetchShinyFormArtBatch } from './data/pokemon.js';
import { collectFormSlugs } from './utils/pokemonForms.js';
import { useActiveHunt, useChecklist } from './hooks/useChecklist.js';

const EMPTY_FEEDS = { raids: [], eggs: [], research: [], events: [], rocket: {} };

export default function App() {
  const [feeds, setFeeds] = useState(EMPTY_FEEDS);
  const [status, setStatus] = useState({ loading: true, cached: false, failed: false, updatedAt: null });
  const [appearance, setAppearance] = useState('normal');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('hunt');
  const [showOdds, setShowOdds] = useState(false);
  const [huntFilter, setHuntFilter] = useState('all');
  const [pokemonInfo, setPokemonInfo] = useState({});
  const [shinyFormArt, setShinyFormArt] = useState({});

  const activeHuntApi = useActiveHunt();
  const checklistApi = useChecklist();

  const refresh = useCallback(async () => {
    setStatus((s) => ({ ...s, loading: true }));
    const [raids, eggs, research, events, rocket] = await Promise.all([fetchRaidsFeed(), fetchEggsFeed(), fetchResearchFeed(), fetchEventsFeed(), fetchRocketFeed()]);
    setFeeds({ raids: raids.data, eggs: eggs.data, research: research.data, events: events.data, rocket: rocket.data });
    const cached = [raids, eggs, research, events, rocket].some((v) => v.cached);
    const failed = [raids, eggs, research, events, rocket].some((v) => v.failed);
    const allFailed = [raids, eggs, research, events, rocket].every((v) => v.failed);
    setStatus({ loading: false, cached, failed, allFailed, updatedAt: new Date() });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Lazily hydrate legendary/dex-id info for raid bosses & Max Battle targets that need it
  // (the feeds don't carry a "legendary" flag, and Max Battle events only name a species).
  useEffect(() => {
    const upcoming = scheduledRaids(feeds.events, feeds.raids, pokemonInfo);
    const shadowSpecies = upcoming.filter((r) => /^shadow\s/i.test(r.name)).map((r) => r.name.replace(/^shadow\s+/i, '').replace(/\s*\(.+\)/, ''));
    const maxSpeciesGuess = [...feeds.events]
      .map((e) => e.name.match(/^(Gigantamax|Dynamax)\s+(.+?)(?:\s+during\s+Max Monday|\s+Max Battle Day|\s+in\s+Max Battles)/i))
      .filter(Boolean)
      .flatMap((m) => m[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map((s) => s.trim()))
      .filter((s) => s && !/^max$/i.test(s));
    const species = [...new Set([...shadowSpecies, ...maxSpeciesGuess])].filter((name) => !pokemonInfo[name.toLowerCase()]);
    if (!species.length) return;
    let cancelled = false;
    Promise.all(species.map(async (name) => [name.toLowerCase(), await fetchSpeciesInfo(name)])).then((entries) => {
      if (cancelled) return;
      setPokemonInfo((prev) => {
        const next = { ...prev };
        entries.forEach(([key, info]) => {
          if (info) next[key] = info;
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [feeds.events, feeds.raids]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gigantamax artwork for species that get one, keyed as "gmax:<species>".
  useEffect(() => {
    const gmaxSpecies = [...new Set(maxEncounters(feeds.events, pokemonInfo, feeds.eggs).filter((p) => p.name.startsWith('Gigantamax')).map((p) => p.species))].filter(
      (name) => !pokemonInfo['gmax:' + name.toLowerCase()]
    );
    if (!gmaxSpecies.length) return;
    let cancelled = false;
    Promise.all(gmaxSpecies.map(async (name) => [name.toLowerCase(), await fetchGmaxArt(name)])).then((entries) => {
      if (cancelled) return;
      setPokemonInfo((prev) => {
        const next = { ...prev };
        entries.forEach(([key, url]) => {
          if (url) next['gmax:' + key] = { image: url };
        });
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
  }, [feeds.events, feeds.eggs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shiny artwork for mega/regional/gmax forms currently on screen, fetched once the person switches to Shiny.
  useEffect(() => {
    if (appearance !== 'shiny') return;
    const names = [
      ...feeds.raids,
      ...scheduledRaids(feeds.events, feeds.raids, pokemonInfo),
      ...feeds.eggs,
      ...researchRewards(feeds.research),
      ...maxEncounters(feeds.events, pokemonInfo, feeds.eggs)
    ].map((p) => p.name);
    const forms = collectFormSlugs(names).filter((f) => !(f in shinyFormArt));
    if (!forms.length) return;
    let cancelled = false;
    fetchShinyFormArtBatch(forms).then((map) => {
      if (!cancelled) setShinyFormArt((prev) => ({ ...prev, ...map }));
    });
    return () => {
      cancelled = true;
    };
  }, [appearance, feeds, pokemonInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusText = status.loading
    ? 'Updating current data…'
    : status.allFailed
      ? 'Could not load live data'
      : status.cached || status.failed
        ? 'Some data may be out of date'
        : 'Current feed loaded';

  const statusDotClass = status.loading ? '' : status.allFailed ? 'error' : status.cached || status.failed ? '' : 'live';

  const battleForms = useMemo(() => [
    ...feeds.raids.filter((raid) => /^mega\s/i.test(raid.name)).map((raid) => ({ name: raid.name, image: raid.image, label: 'Current Mega Raid' })),
    ...scheduledRaids(feeds.events, feeds.raids, pokemonInfo).filter((raid) => /^mega\s/i.test(raid.name)).map((raid) => ({ name: raid.name, image: raid.image, label: 'Upcoming Mega Raid' })),
    ...maxEncounters(feeds.events, pokemonInfo, [...feeds.eggs, ...feeds.raids]).map((target) => ({ name: target.name, image: target.image, label: target.event.eventType === 'max-mondays' ? 'Max Monday' : 'Max Battle' }))
  ], [feeds, pokemonInfo]);

  const pageProps = useMemo(
    () => ({
      raidsFeed: feeds.raids,
      eggsFeed: feeds.eggs,
      researchFeed: feeds.research,
      rocketFeed: feeds.rocket,
      eventsFeed: feeds.events,
      events: feeds.events,
      pokemonInfo,
      battleForms,
      appearance,
      shinyFormArt,
      query,
      failed: status.failed,
      activeHunt: activeHuntApi.activeHunt,
      isActive: activeHuntApi.isActive,
      setActiveHunt: activeHuntApi.setActiveHunt,
      isChecked: checklistApi.isChecked,
      toggleChecked: checklistApi.toggleChecked,
      checked: checklistApi.checked
    }),
    [feeds, pokemonInfo, battleForms, appearance, shinyFormArt, query, status.failed, activeHuntApi, checklistApi]
  );

  const filters = [
    { id: 'all', label: 'All' },
    { id: 'raids', label: `Raids ${feeds.raids.length}` },
    { id: 'eggs', label: `Eggs ${feeds.eggs.length}` },
    { id: 'research', label: `Research ${researchRewards(feeds.research).length}` },
    { id: 'breakthrough', label: 'Breakthrough' },
    { id: 'rocket', label: `Rocket ${shinyRocketEncounters(feeds.rocket).length}` },
    { id: 'max', label: `Max ${maxEncounters(feeds.events, pokemonInfo, feeds.eggs).length}` },
    { id: 'events', label: `Events ${feeds.events.length}` }
  ];

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><img src="/icon-192.png" alt="Mew" /></div>
        <div className="brand-copy">
          <span className="eyebrow">POKÉMON GO FIELD GUIDE</span>
          <h1>Shiny Hunt</h1>
        </div>
        <button type="button" className="icon-button" onClick={refresh} disabled={status.loading} aria-label="Refresh live data">
          ⟳
        </button>
      </header>

      <div className="status-row">
        <span className={`status-dot ${statusDotClass}`} />
        <span className="status-text">{statusText}</span>
        {status.updatedAt && !status.loading && !status.allFailed && (
          <span className="status-updated">{status.cached ? 'Saved copy' : status.updatedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>
        )}
      </div>

      <main>
        {view === 'hunt' ? (
          <>
            <div className="intro">
              <h2>Shiny targets <span className="spark">✦</span></h2>
              <p>Current encounters and upcoming hunts.</p>
              <button type="button" className="odds-open-button" onClick={() => setShowOdds(true)}>✦ Odds calculator</button>
            </div>

            <Checklist {...pageProps} compact />

            <label className="search-wrap">
              <span aria-hidden="true">⌕</span>
              <input type="search" placeholder="Search Pokémon or events" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search Pokémon or events" />
            </label>

            <nav className="filter-row" aria-label="Encounter type">
              {filters.map((filter) => (
                <button key={filter.id} type="button" className={`filter${huntFilter === filter.id ? ' active' : ''}`} aria-pressed={huntFilter === filter.id} onClick={() => setHuntFilter(filter.id)}>
                  {filter.label}
                </button>
              ))}
            </nav>

            <div className="appearance-controls">
              <span>Pokémon artwork</span>
              <ShinyToggle value={appearance} onChange={setAppearance} />
            </div>

            {(huntFilter === 'all' || huntFilter === 'events') && <Research {...pageProps} sectionFilter="events" />}
            {(huntFilter === 'all' || huntFilter === 'raids') && <Raids {...pageProps} />}
            {huntFilter === 'all' && <Research {...pageProps} sectionFilter="research" />}
            {huntFilter === 'eggs' && <Research {...pageProps} sectionFilter="eggs" />}
            {huntFilter === 'max' && <Research {...pageProps} sectionFilter="max" />}
            {huntFilter === 'all' && <Research {...pageProps} sectionFilter="rocket" />}
            {(huntFilter === 'research' || huntFilter === 'breakthrough' || huntFilter === 'rocket') && <Research {...pageProps} sectionFilter={huntFilter} />}
          </>
        ) : view === 'codes' ? (
          <PromoCodes />
        ) : (
          <section className="calendar-view">
            <div className="intro">
              <h2>Event calendar</h2>
              <p>Upcoming Pokémon GO events in your device’s local time.</p>
            </div>
            <div className="calendar-note">Tap <strong>Add to Calendar</strong> to save an event with a 30-minute alert.</div>
            <Events {...pageProps} />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <p>
          Live data from Leek Duck via ScrapedDuck, and PokéAPI / PogoAPI for species, forms and evolutions. Odds are community guide-rate estimates, not
          official rates.
        </p>
      </footer>

      <nav className="bottom-nav" aria-label="Main navigation">
        <button type="button" className={`nav-item${view === 'hunt' ? ' active' : ''}`} aria-current={view === 'hunt' ? 'page' : undefined} onClick={() => setView('hunt')}>
          <span className="nav-icon" aria-hidden="true">✦</span><span>Hunt</span>
        </button>
        <button type="button" className={`nav-item${view === 'calendar' ? ' active' : ''}`} aria-current={view === 'calendar' ? 'page' : undefined} onClick={() => setView('calendar')}>
          <span className="calendar-glyph" aria-hidden="true" /><span>Calendar</span>
        </button>
        <button type="button" className={`nav-item${view === 'codes' ? ' active' : ''}`} aria-current={view === 'codes' ? 'page' : undefined} onClick={() => setView('codes')}>
          <span className="nav-icon" aria-hidden="true">♢</span><span>Promo Codes</span>
        </button>
      </nav>
      {showOdds && (
        <div className="modal-backdrop" onClick={() => setShowOdds(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Odds calculator" onClick={(e) => e.stopPropagation()}>
            <div className="raid-modal-top">
              <span className="eyebrow">SHINY HUNT TOOLS</span>
              <button type="button" className="modal-close" onClick={() => setShowOdds(false)} aria-label="Close calculator">✕</button>
            </div>
            <OddsCalculator odds={{ value: '1/512' }} />
          </div>
        </div>
      )}
    </div>
  );
}
