import { state, hole } from './state.js';

export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const fmtDistance = (d) => Number.isFinite(d) ? `${Math.round(d)} m` : '—';
export const fmtGame = (n) => n > 0 ? `+${n}` : `${n}`;

export function meterDistance(a, b) {
  if (!a || !b) return NaN;
  if (Number.isFinite(a.lat) && Number.isFinite(a.lng) && Number.isFinite(b.lat) && Number.isFinite(b.lng)) {
    const R = 6371000;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy) * 3.43;
}

export function strokesForHole(handicap, si) {
  const h = Math.max(0, Number(handicap) || 0);
  const base = Math.floor(h / 18);
  const extra = h % 18;
  return base + (si <= extra ? 1 : 0);
}

export function stableford(net, par) {
  if (!Number.isFinite(net)) return 0;
  return Math.max(0, par - net + 2);
}

export function calcPlayer(player) {
  let grossTotal = 0, netTotal = 0, pointsTotal = 0, parTotal = 0;
  const holeGross = Number(player.scores[state.currentHole]) || 0;
  const holeStrokes = strokesForHole(player.handicap, hole().strokeIndex);
  const holeNet = holeGross ? holeGross - holeStrokes : 0;
  const holePoints = holeGross ? stableford(holeNet, hole().par) : 0;

  for (let i = 1; i <= state.currentHole; i++) {
    const h = state.holes[i - 1];
    const gross = Number(player.scores[i]) || 0;
    if (!gross) continue;
    const strokes = strokesForHole(player.handicap, h.strokeIndex);
    const net = gross - strokes;
    grossTotal += gross;
    netTotal += net;
    pointsTotal += stableford(net, h.par);
    parTotal += h.par;
  }
  return { holeGross, holeNet, holePoints, grossTotal, netTotal, pointsTotal, game: netTotal - parTotal };
}

export function toLatLng(point) {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return null;
  return { lat: point.lat, lng: point.lng };
}

export function pointFromLatLng(latLng, fallback = {}) {
  const lat = typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat;
  const lng = typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng;
  return { ...fallback, lat: Number(lat), lng: Number(lng) };
}

export function escapeHtml(str) {
  return String(str).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
}
