import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchRaidRotations, currentRaidPool } from './data/raidRotations.js';
import useGuideLocation from './hooks/useGuideLocation.js';
import LocationControl from './components/LocationControl.jsx';
import ShinyToggle from './components/ShinyToggle.jsx';
import Raids from './pages/Raids.jsx';
import MaxRotations from './pages/MaxRotations.jsx';
import { fetchMaxRotations } from './data/maxRotations.js';
import Research from './pages/Research.jsx';
import Events from './pages/Events.jsx';
import PromoCodes from './pages/PromoCodes.jsx';
import Costumes from './pages/Costumes.jsx';
import OddsCalculator from './components/OddsCalculator.jsx';
import { fetchRaidsFeed, fetchEggsFeed, fetchResearchFeed, fetchEventsFeed, fetchRocketFeed, scheduledRaids, researchRewards } from './data/raids.js';
import { maxEncounters } from './data/events.js';
import { shinyRocketEncounters } from './data/rocket.js';
import { fetchSpeciesInfo, fetchGmaxArt, fetchShinyFormArtBatch } from './data/pokemon.js';
import { collectFormSlugs } from './utils/pokemonForms.js';

const EMPTY_FEEDS = { raids: [], eggs: [], research: [], events: [], rocket: {}, rotations: [], maxRotations: [] };

export default function App() {
  const [feeds, setFeeds] = useState(EMPTY_FEEDS);
  const [status, setStatus] = useState({ loading: true, cached: false, failed: false, updatedAt: null });
  const [appearance, setAppearance] = useState('normal');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('hunt');
  const [showOdds, setShowOdds] = useState(false);
  const [huntFilter, setHuntFilter] = useState('featured');
  const [pokemonInfo, setPokemonInfo] = useState({});
  const [shinyFormArt, setShinyFormArt] = useState({});


  const refreshSequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++refreshSequence.current;
    setStatus((s) => ({ ...s, loading: true }));
    const [raids, eggs, research, events, rocket, rotations, maxRotations] = await Promise.all([fetchRaidsFeed(), fetchEggsFeed(), fetchResearchFeed(), fetchEventsFeed(), fetchRocketFeed(), fetchRaidRotations(), fetchMaxRotations()]);
    if (request !== refreshSequence.current) return;
    setFeeds({ raids: raids.data, eggs: eggs.data, research: research.data, events: events.data, rocket: rocket.data, rotations: rotations.data, maxRotations: maxRotations.data });
    const cached = [raids, eggs, research, events, rocket, rotations, maxRotations].some((v) => v.cached);
    const failed = [raids, eggs, research, events, rocket, rotations, maxRotations].some((v) => v.failed);
    const allFailed = [raids, eggs, research, events, rocket].every((v) => v.failed);
    setStatus({ loading: false, cached, failed, allFailed, updatedAt: new Date() });
  }, []);

  const location = useGuideLocation(refresh);
  const [clock, setClock] = useState(0);
  useEffect(() => { const timer = setInterval(() => setClock(value => value + 1), 30000); return () => clearInterval(timer); }, []);
  const raidsFeed = useMemo(() => currentRaidPool(feeds.rotations, feeds.raids), [feeds, location.timeZone, clock]);

  useEffect(() => {
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(onVisible, 5 * 60000);
    return () => { ++refreshSequence.current; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh]);

  // Lazily hydrate legendary/dex-id info for raid bosses & Max Battle targets that need it
  // (the feeds don't carry a "legendary" flag, and Max Battle events only name a species).
  useEffect(() => {
    const upcoming = scheduledRaids(feeds.events, raidsFeed, pokemonInfo);
    const shadowSpecies = upcoming.filter((r) => /^shadow\s/i.test(r.name)).map((r) => r.name.replace(/^shadow\s+/i, '').replace(/\s*\(.+\)/, ''));
    const maxSpeciesGuess = [...feeds.events]
      .map((e) => e.name.match(/^(Gigantamax|Dynamax)\s+(.+?)(?:\s+during\s+Max Monday|\s+Max Battle Day|\s+in\s+Max Battles)/i))
      .filter(Boolean)
      .flatMap((m) => m[2].split(/,\s*(?:and\s+)?|\s+and\s+/i).map((s) => s.trim()))
      .filter((s) => s && !/^max$/i.test(s));
    const rotationSpecies = feeds.maxRotations.map(r => r.species).filter(Boolean);
    const species = [...new Set([...shadowSpecies, ...maxSpeciesGuess, ...rotationSpecies])].filter((name) => !pokemonInfo[name.toLowerCase()]);
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
  }, [feeds.events, feeds.maxRotations, raidsFeed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Gigantamax artwork for species that get one, keyed as "gmax:<species>".
  useEffect(() => {
    const gmaxSpecies = [...new Set([...maxEncounters(feeds.events, pokemonInfo, feeds.eggs).filter((p) => p.name.startsWith('Gigantamax')).map((p) => p.species), ...feeds.maxRotations.filter(r => r.form === 'Gigantamax').map(r => r.species)])].filter(
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
  }, [feeds.events, feeds.eggs, feeds.maxRotations]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shiny artwork for mega/regional/gmax forms currently on screen, fetched once the person switches to Shiny.
  useEffect(() => {
    if (appearance !== 'shiny') return;
    const names = [
      ...raidsFeed,
      ...scheduledRaids(feeds.events, raidsFeed, pokemonInfo),
      ...feeds.eggs,
      ...researchRewards(feeds.research),
      ...maxEncounters(feeds.events, pokemonInfo, feeds.eggs),
      ...feeds.maxRotations.map(r => ({ name: `${r.form} ${r.species}` }))
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
  }, [appearance, feeds, raidsFeed, pokemonInfo]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusText = status.loading
    ? 'Updating current data…'
    : status.allFailed
      ? 'Could not load live data'
      : status.cached || status.failed
        ? 'Some data may be out of date'
        : 'Current feed loaded';

  const statusDotClass = status.loading ? '' : status.allFailed ? 'error' : status.cached || status.failed ? '' : 'live';

  const battleForms = useMemo(() => [
    ...raidsFeed.filter((raid) => /^mega\s/i.test(raid.name)).map((raid) => ({ name: raid.name, image: raid.image, label: 'Current Mega Raid' })),
    ...scheduledRaids(feeds.events, raidsFeed, pokemonInfo).filter((raid) => /^mega\s/i.test(raid.name)).map((raid) => ({ name: raid.name, image: raid.image, label: 'Upcoming Mega Raid' })),
    ...maxEncounters(feeds.events, pokemonInfo, [...feeds.eggs, ...raidsFeed]).map((target) => ({ name: target.name, image: target.image, label: target.event.eventType === 'max-mondays' ? 'Max Monday' : 'Max Battle' }))
  ], [feeds, raidsFeed, pokemonInfo]);

  const pageProps = useMemo(
    () => ({
      raidsFeed,
      raidRotations: feeds.rotations,
      eggsFeed: feeds.eggs,
      researchFeed: feeds.research,
      rocketFeed: feeds.rocket,
      eventsFeed: feeds.events,
      maxRotations: feeds.maxRotations,
      events: feeds.events,
      pokemonInfo,
      battleForms,
      appearance,
      shinyFormArt,
      query,
      failed: status.failed
    }),
    [feeds, raidsFeed, pokemonInfo, battleForms, appearance, shinyFormArt, query, status.failed]
  );

  const filters = [
    { id: 'featured', label: 'Featured' },
    { id: 'raids', label: `Raids ${raidsFeed.length}` },
    { id: 'costumes', label: 'Costumes' },
    { id: 'eggs', label: `Eggs ${feeds.eggs.length}` },
    { id: 'research', label: `Research ${researchRewards(feeds.research).length}` },
    { id: 'breakthrough', label: 'Breakthrough' },
    { id: 'rocket', label: `Rocket ${shinyRocketEncounters(feeds.rocket).length}` },
    { id: 'max', label: 'Max Battles' }
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

      <LocationControl location={location} />
      <main key={location.timeZone || 'device'}>
        {view === 'hunt' ? (
          <>
            <div className="intro">
              <h2>Shiny targets <span className="spark">✦</span></h2>
              <p>Current encounters and upcoming hunts.</p>
              <button type="button" className="odds-open-button" onClick={() => setShowOdds(true)}>✦ Odds calculator</button>
            </div>


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

            {huntFilter !== 'costumes' && <div className="appearance-controls">
              <span>Pokémon artwork</span>
              <ShinyToggle value={appearance} onChange={setAppearance} />
            </div>}

            {huntFilter === 'featured' && <Research {...pageProps} sectionFilter="events" />}
            {huntFilter === 'raids' && <Raids {...pageProps} />}
            {huntFilter === 'costumes' && <Costumes query={query} />}
            {huntFilter === 'eggs' && <Research {...pageProps} sectionFilter="eggs" />}
            {huntFilter === 'max' && <MaxRotations rotations={feeds.maxRotations} events={feeds.events} pokemonInfo={pokemonInfo} query={query} failed={status.failed} appearance={appearance} shinyFormArt={shinyFormArt} />}
            {(huntFilter === 'research' || huntFilter === 'breakthrough' || huntFilter === 'rocket') && <Research {...pageProps} sectionFilter={huntFilter} />}
          </>
        ) : view === 'codes' ? (
          <PromoCodes />
        ) : (
          <section className="calendar-view">
            <div className="intro">
              <h2>Event calendar</h2>
              <p>Upcoming Pokémon GO events in your selected local time.</p>
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
