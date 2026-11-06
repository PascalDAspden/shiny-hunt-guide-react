import { useEffect, useRef, useState } from 'react';
import { validPosition } from '../data/location.js';
import Sprite from '../components/Sprite.jsx';
import { fetchHuntLocations, nearbyHuntLocations } from '../data/huntLocations.js';
import { isNativeMap, openNativeMap, updateNativeMap, closeNativeMap } from '../data/nativeMap.js';
import { parseDate, countdownText } from '../utils/dates.js';
import { coordinates, mapUrls, walkingDestination } from '../utils/huntMap.js';

export default function HuntMap({ location, loadLocations = fetchHuntLocations }) {
  const [feed, setFeed] = useState({ data: [], failed: false, cached: false });
  const [filter, setFilter] = useState('all');
  const [selectedID, setSelectedID] = useState(null);
  const [nativeError, setNativeError] = useState('');
  const [, tick] = useState(0);
  const nativeActive = useRef(false), autoOpened = useRef(false);
  const native = isNativeMap();
  useEffect(() => {
    let disposed = false, sequence = 0;
    const refresh = async () => {
      if (document.visibilityState === 'hidden') return;
      const request = ++sequence;
      try {
        const result = await loadLocations();
        if (!disposed && request === sequence) setFeed(result);
      } catch { if (!disposed && request === sequence) setFeed(old => ({ ...old, failed: true })); }
    };
    refresh();
    const timer = setInterval(refresh, 60000), clock = setInterval(() => tick(value => value + 1), 15000);
    document.addEventListener('visibilitychange', refresh);
    return () => { disposed = true; clearInterval(timer); clearInterval(clock); document.removeEventListener('visibilitychange', refresh); };
  }, [loadLocations]);
  useEffect(() => () => { if (nativeActive.current) closeNativeMap().catch(() => {}); }, []);
  const [radius, setRadius] = useState(2);
  const [loaded, setLoaded] = useState(false);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const position = location.enabled && validPosition(location.position) ? location.position : null;
  const urls = mapUrls(position, radius);
  const destination = coordinates(latitude, longitude);
  const walking = walkingDestination(position, destination);
  const nearby = nearbyHuntLocations(feed.data, position, { radius, filter });
  const selected = nearby.find(item => item.id === selectedID);
  const nativeRows = nearbyHuntLocations(feed.data, position, { radius: 10 }).map(item => ({ ...item, encounter: item.encounter ? { ...item.encounter, start: parseDate(item.encounter.start).toISOString(), end: parseDate(item.encounter.end).toISOString() } : null }));
  const launchNative = async () => {
    if (!position || nativeActive.current) return;
    nativeActive.current = true; setNativeError('');
    try { await openNativeMap(position, nativeRows, feed.failed || feed.cached); }
    catch { setNativeError('Could not open the iPhone map. Install the latest iOS build and try again.'); }
    finally { nativeActive.current = false; }
  };
  useEffect(() => {
    if (native && position && !autoOpened.current) { autoOpened.current = true; launchNative(); }
  }, [native, position]);
  useEffect(() => {
    if (nativeActive.current) updateNativeMap(nativeRows, feed.failed || feed.cached).catch(() => {});
  }, [feed, position]);
  return <section className="page hunt-map">
    <div className="intro"><h2>Nearby hunt map</h2><p>Plan where to walk. Check Pokémon GO or Campfire for live battles.</p></div>
    <div className="card map-notice"><h3>Raids · Dynamax · Gigantamax</h3><p>No live gym or Power Spot location feed is configured. Sourced locations can appear below and as pins in the iPhone map. Pokémon and countdowns require a verified, unexpired encounter; known locations alone do not confirm a battle.</p><a href="https://campfire.nianticlabs.com/" target="_blank" rel="noopener noreferrer">Open Campfire ↗</a></div>
    {(feed.failed || feed.cached) && <p role="status" className="meta">Location data could not refresh or is a saved copy. Encounters still expire at their published end time.</p>}
    {!position ? <div className="empty"><p>{location.enabled ? 'Update your location to show a recent GPS fix.' : 'Enable location above to centre the map on you.'}</p>{location.enabled && <button type="button" disabled={location.loading} className="track-button" onClick={location.update}>Retry map location</button>}</div> : <>
      <label className="map-radius">Map area around you <select aria-label="Map radius" value={radius} onChange={event => setRadius(Number(event.target.value))}>{[1, 2, 5, 10].map(km => <option key={km} value={km}>About {km} km</option>)}</select></label>
      <p className="meta">GPS accuracy: {Number.isFinite(position.accuracy) ? `about ${Math.round(position.accuracy)} m` : 'not reported'}. The marker is approximate; the map area is not a raid search.</p>
      {native && <><button type="button" className="track-button" onClick={launchNative}>Open iPhone map</button><p className="meta">MapKit shows sourced pins, battle filters and location cards. Get Directions opens Apple Maps with a walking/driving choice.</p>{nativeError && <p role="status">{nativeError}</p>}</>}
      {!native && (!loaded ? <div className="empty"><p>Loading the map sends the displayed coordinates to OpenStreetMap. Map tiles need internet access.</p><button type="button" className="track-button" onClick={() => setLoaded(true)}>Load map</button></div> : <iframe className="hunt-map-frame" title="Street map around your GPS location" src={urls.embed} loading="lazy" referrerPolicy="no-referrer" />)}
      <a href={urls.full} target="_blank" rel="noopener noreferrer">Open larger map ↗</a>
      <p className="meta">© OpenStreetMap contributors. If the embedded map is unavailable, use the larger map link.</p>
      <div className="event-filter-row" role="group" aria-label="Map battle type">{[['all', 'All locations'], ['raid', 'Raid'], ['dynamax', 'Dynamax'], ['gigantamax', 'Gigantamax']].map(([value, label]) => <button className={`pill${filter === value ? ' active' : ''}`} type="button" aria-pressed={filter === value} key={value} onClick={() => setFilter(value)}>{label}</button>)}</div>
      <p className="meta">{nearby.length} sourced locations within {radius} km. Battle filters include only verified active encounters. All locations also includes known places with no verified battle.</p>
      <div className="map-location-list">{nearby.map(item => <button type="button" key={item.id} className="track-button" onClick={() => setSelectedID(item.id)}>{item.name} · {item.distance.toFixed(2)} km{item.encounter ? ` · ${item.encounter.name}` : ' · No verified active battle'}</button>)}</div>
      {selected && <article className="card map-notice" aria-label="Selected hunt location"><h3>{selected.name}</h3><p>{selected.kind === 'gym' ? 'Gym' : 'Power Spot'} · {selected.distance.toFixed(2)} km straight line</p>{selected.encounter ? <><Sprite name={selected.encounter.name} src={selected.encounter.image} /><h4>{selected.encounter.name} · {selected.encounter.battleType}</h4><p>Ends in {countdownText(+parseDate(selected.encounter.end) - Date.now())}</p><p>{selected.encounter.canBeShiny === true ? 'Shiny available (source verified)' : selected.encounter.canBeShiny === false ? 'Shiny unavailable (source verified)' : 'Shiny availability unknown'}</p><a href={selected.encounter.source} target="_blank" rel="noopener noreferrer">Encounter source ↗</a></> : <p>No verified active Pokémon or countdown.</p>}<p><a href={walkingDestination(position, selected).url} target="_blank" rel="noopener noreferrer">Get Directions in Apple Maps ↗</a></p><a href={selected.source} target="_blank" rel="noopener noreferrer">Location source ↗</a></article>}
      <section className="map-destination"><h3>Walk to a confirmed location</h3><p className="meta">Paste destination coordinates from a gym or Power Spot you checked in the game or Campfire. Coordinates are not saved.</p>
        <div className="map-coordinate-inputs"><label>Latitude<input aria-label="Destination latitude" type="number" min="-90" max="90" step="any" value={latitude} onChange={event => setLatitude(event.target.value)} /></label><label>Longitude<input aria-label="Destination longitude" type="number" min="-180" max="180" step="any" value={longitude} onChange={event => setLongitude(event.target.value)} /></label></div>
        {walking ? <p><span>{walking.distance.toFixed(2)} km in a straight line. </span><a href={walking.url} target="_blank" rel="noopener noreferrer">Walking directions ↗</a><small className="meta"> Apple Maps calculates the walking route and distance.</small></p> : (latitude || longitude) && <p role="status">Enter valid latitude and longitude coordinates.</p>}
      </section>
    </>}
  </section>;
}
