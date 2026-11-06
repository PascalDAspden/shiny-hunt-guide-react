import { distanceKm } from '../data/location.js';

export function coordinates(latitude, longitude) {
  if (String(latitude).trim() === '' || String(longitude).trim() === '') return null;
  const point = { latitude: Number(latitude), longitude: Number(longitude) };
  return Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 && Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 ? point : null;
}

export function mapUrls(point, radius = 2) {
  if (!point || !coordinates(point.latitude, point.longitude)) return null;
  const km = [1, 2, 5, 10].includes(Number(radius)) ? Number(radius) : 2;
  const latitude = Math.max(-85, Math.min(85, point.latitude));
  const deltaLat = km / 111.2;
  const deltaLon = km / (111.2 * Math.cos(latitude * Math.PI / 180));
  const bbox = [Math.max(-180, point.longitude - deltaLon), Math.max(-85, latitude - deltaLat), Math.min(180, point.longitude + deltaLon), Math.min(85, latitude + deltaLat)];
  const marker = `${point.latitude},${point.longitude}`;
  return {
    embed: `https://www.openstreetmap.org/export/embed.html?${new URLSearchParams({ bbox: bbox.join(','), layer: 'mapnik', marker })}`,
    full: `https://www.openstreetmap.org/?${new URLSearchParams({ mlat: String(point.latitude), mlon: String(point.longitude) })}#map=15/${point.latitude}/${point.longitude}`
  };
}

export function walkingDestination(origin, destination) {
  if (!origin || !destination || !coordinates(origin.latitude, origin.longitude) || !coordinates(destination.latitude, destination.longitude)) return null;
  return {
    distance: distanceKm(origin, destination),
    url: `https://maps.apple.com/?${new URLSearchParams({ saddr: `${origin.latitude},${origin.longitude}`, daddr: `${destination.latitude},${destination.longitude}`, dirflg: 'w' })}`
  };
}
