import { Capacitor, registerPlugin } from '@capacitor/core';
const LocationGuide = registerPlugin('LocationGuide');

export async function currentLocation() {
  if (Capacitor.isNativePlatform()) return LocationGuide.getLocation();
  if (!navigator.geolocation) throw new Error('Location is unavailable in this browser. Device time is still available.');
  const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }));
  // Browsers expose coordinates but no coordinate-to-timezone service. Do not
  // pretend the browser's timezone was derived from GPS.
  return { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy, timestamp: position.timestamp, timeZone: null, place: null };
}
export async function cancelLocation() {
  if (Capacitor.isNativePlatform()) try { await LocationGuide.cancel(); } catch { /* pending request already ended */ }
}
export function validPosition(position) {
  return Number.isFinite(position?.latitude) && Math.abs(position.latitude) <= 90 && Number.isFinite(position?.longitude) && Math.abs(position.longitude) <= 180 && Number.isFinite(position?.timestamp) && position.timestamp <= Date.now() + 60000 && Date.now() - position.timestamp < 10 * 60000 && (position.accuracy === undefined || Number.isFinite(position.accuracy) && position.accuracy >= 0);
}
export function distanceKm(a, b) {
  if (!a || !b) return Infinity;
  const radians = number => number * Math.PI / 180;
  const lat = radians(b.latitude - a.latitude), lon = radians(b.longitude - a.longitude);
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(Math.sin(lat / 2) ** 2 + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(lon / 2) ** 2)));
}
export function locationError(error) {
  return error?.code === 1 || /denied|permission|restricted/i.test(error?.message || '') ? 'Location permission was denied. Allow it in Settings to try again, or keep using device time.' : 'Could not update your location. Using device time; try again when GPS and internet are available.';
}
