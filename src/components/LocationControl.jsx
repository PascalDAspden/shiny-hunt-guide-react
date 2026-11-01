export default function LocationControl({ location }) {
  return <section className="location-control" aria-label="Guide location">
    <div className="location-actions"><button type="button" className={`track-button${location.enabled ? ' active' : ''}`} onClick={location.toggle}>{location.enabled ? 'Turn location off' : 'Use my location'}</button>{location.enabled && <button className="link-button" disabled={location.loading} onClick={location.update}>{location.loading ? 'Finding location…' : 'Update location'}</button>}</div>
    <p className="meta" role="status">{location.error || (location.position ? `${location.position.place || 'Location found'} · ${location.timeZone || 'Device timezone (location timezone unavailable)'}` : location.loading ? 'Finding your location…' : 'Using device time. Enable location for local event timing and refreshes as you move.')}</p>
    <small>Event and raid-pool guide. Nearby gyms and live spawns are not supplied. Location is checked only while this app is open; iPhone place/timezone lookup uses Apple.</small>
  </section>;
}
