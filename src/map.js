import { state, hole } from './state.js';
import { MAPS_KEY_STORAGE, PAARL_CENTER } from './config.js';
import { meterDistance, fmtDistance, toLatLng, pointFromLatLng, clamp } from './scoring.js';

let gmap = null;
let googleReady = false;
let watchId = null;
let gMarkers = {};
let gLines = {};
let gpsAccuracyCircle = null;

const $ = (id) => document.getElementById(id);

let onRender = () => {};
let onToast = () => {};
let onGpsStatus = () => {};

export function initMap({ render, toast, gpsStatus }) {
  onRender = render;
  onToast = toast;
  onGpsStatus = gpsStatus;
}

function markerHTML(point, cls) {
  if (!point) return '';
  return `<div class="marker ${cls}" style="left:${point.x}%;top:${point.y}%"></div>`;
}

function lineSvg(a, b, color = '#1377ff', dashed = false) {
  if (!a || !b) return '';
  return `<line x1="${a.x * 10}" y1="${a.y * 10}" x2="${b.x * 10}" y2="${b.y * 10}" stroke="${color}" stroke-width="8" stroke-linecap="round" ${dashed ? 'stroke-dasharray="18 14"' : ''} />`;
}

function labelHTML(a, b, text) {
  if (!a || !b || text === '—') return '';
  return `<div class="dist-label" style="left:${(a.x + b.x) / 2}%;top:${(a.y + b.y) / 2}%">${text}</div>`;
}

export function renderDistances() {
  const h = hole();
  $('teeGreen').textContent = fmtDistance(meterDistance(h.tee, h.green));
  $('teeLayup').textContent = fmtDistance(meterDistance(h.tee, h.layup));
  $('layupGreen').textContent = fmtDistance(meterDistance(h.layup, h.green));
  $('youGreen').textContent = fmtDistance(meterDistance(h.you, h.green));
  $('youLayup').textContent = fmtDistance(meterDistance(h.you, h.layup));
}

export function renderMap() {
  const h = hole();
  $('overlay').innerHTML = `
    ${lineSvg(h.tee, h.green)}
    ${lineSvg(h.tee, h.layup, '#e8b634', true)}
    ${lineSvg(h.layup, h.green, '#e8b634', true)}
    ${lineSvg(h.you, h.green, '#58aaff', true)}
  `;
  $('markerLayer').innerHTML = [
    markerHTML(h.green, 'green'),
    markerHTML(h.tee, 'tee'),
    markerHTML(h.layup, 'layup'),
    markerHTML(h.you, 'you')
  ].join('');
  $('distLabels').innerHTML = [
    labelHTML(h.tee, h.green, fmtDistance(meterDistance(h.tee, h.green))),
    labelHTML(h.tee, h.layup, fmtDistance(meterDistance(h.tee, h.layup))),
    labelHTML(h.layup, h.green, fmtDistance(meterDistance(h.layup, h.green)))
  ].join('');
  renderGoogleMap();
}

function markerIcon(color, scale = 1) {
  if (!window.google) return null;
  return {
    path: google.maps.SymbolPath.CIRCLE,
    scale: 9 * scale,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: '#ffffff',
    strokeWeight: 2
  };
}

function ensureGoogleObjects() {
  if (!googleReady || !gmap) return;
  const markerDefs = { tee: '#e3422c', green: '#22c55e', layup: '#e8b634', you: '#268dff' };
  for (const [key, color] of Object.entries(markerDefs)) {
    if (!gMarkers[key]) {
      gMarkers[key] = new google.maps.Marker({ map: gmap, title: key, icon: markerIcon(color, key === 'you' ? 1.25 : 1) });
    }
  }
  const lineDefs = {
    teeGreen: { color: '#1377ff', dashed: false },
    teeLayup: { color: '#e8b634', dashed: true },
    layupGreen: { color: '#e8b634', dashed: true },
    youGreen: { color: '#58aaff', dashed: true }
  };
  for (const [key, def] of Object.entries(lineDefs)) {
    if (!gLines[key]) {
      gLines[key] = new google.maps.Polyline({
        map: gmap,
        strokeColor: def.color,
        strokeOpacity: .95,
        strokeWeight: 4,
        icons: def.dashed ? [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '18px' }] : []
      });
    }
  }
  if (!gpsAccuracyCircle) {
    gpsAccuracyCircle = new google.maps.Circle({
      map: gmap,
      strokeColor: '#268dff', strokeOpacity: .55, strokeWeight: 1,
      fillColor: '#268dff', fillOpacity: .13
    });
  }
}

function setLinePath(key, a, b) {
  if (!gLines[key]) return;
  const aa = toLatLng(a), bb = toLatLng(b);
  if (aa && bb) { gLines[key].setMap(gmap); gLines[key].setPath([aa, bb]); }
  else gLines[key].setMap(null);
}

function renderGoogleMap() {
  if (!googleReady || !gmap) return;
  ensureGoogleObjects();
  $('map').classList.add('google-active');
  const h = hole();
  for (const [key, point] of Object.entries({ tee: h.tee, green: h.green, layup: h.layup, you: h.you })) {
    const marker = gMarkers[key]; if (!marker) continue;
    const pos = toLatLng(point);
    marker.setMap(pos ? gmap : null);
    if (pos) marker.setPosition(pos);
  }
  setLinePath('teeGreen', h.tee, h.green);
  setLinePath('teeLayup', h.tee, h.layup);
  setLinePath('layupGreen', h.layup, h.green);
  setLinePath('youGreen', h.you, h.green);
  const center = toLatLng(h.you) || toLatLng(h.green) || PAARL_CENTER;
  if (center && !renderGoogleMap.didInitialCenter) {
    gmap.setCenter(center);
    renderGoogleMap.didInitialCenter = true;
  }
  onGpsStatus(state.liveGps
    ? 'Live GPS running · golfer marker updates automatically'
    : 'Google satellite map ready · tap map to set selected point');
}

export function loadGoogleMaps() {
  const inputKey = ($('mapsApiKey')?.value || '').trim();
  const urlKey = new URLSearchParams(location.search).get('key') || '';
  state.googleMapsApiKey = inputKey || state.googleMapsApiKey || urlKey;
  if (!state.googleMapsApiKey) {
    onToast('Paste a Google Maps browser API key first');
    onGpsStatus('Missing Google Maps API key');
    return;
  }
  localStorage.setItem(MAPS_KEY_STORAGE, state.googleMapsApiKey);
  if (window.google?.maps) { initGoogleMap(); return; }
  window.__initGolfGoogleMap = initGoogleMap;
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(state.googleMapsApiKey)}&callback=__initGolfGoogleMap&v=weekly`;
  script.async = true;
  script.defer = true;
  script.onerror = () => onGpsStatus('Google Maps failed to load · check API key/billing/referrer');
  document.head.appendChild(script);
  onGpsStatus('Loading Google Maps…');
}

function initGoogleMap() {
  googleReady = true;
  const h = hole();
  gmap = new google.maps.Map($('googleMap'), {
    center: toLatLng(h.you) || PAARL_CENTER,
    zoom: 18,
    mapTypeId: state.mapType || 'satellite',
    disableDefaultUI: true,
    zoomControl: true,
    mapTypeControl: false,
    fullscreenControl: false,
    gestureHandling: 'greedy',
    tilt: 0
  });
  gmap.addListener('click', (e) => {
    const current = hole()[state.activeMapMode] || {};
    hole()[state.activeMapMode] = pointFromLatLng(e.latLng, current);
    onRender();
    onToast(`${state.activeMapMode[0].toUpperCase() + state.activeMapMode.slice(1)} set from map`);
  });
  renderGoogleMap.didInitialCenter = false;
  onRender();
}

export function setMapType(type) {
  state.mapType = type;
  if (gmap) gmap.setMapTypeId(state.mapType);
}

export function centerOnGps() {
  const pos = toLatLng(hole().you);
  if (gmap && pos) {
    gmap.panTo(pos);
    gmap.setZoom(Math.max(gmap.getZoom() || 18, 18));
    return true;
  }
  return false;
}

export function startLiveGps() {
  if (!navigator.geolocation) {
    onGpsStatus('This tablet browser does not support GPS geolocation');
    onToast('GPS not supported');
    return;
  }
  if (!window.isSecureContext) {
    onGpsStatus('GPS needs HTTPS, localhost, or a trusted secure origin on tablet browsers');
    onToast('GPS needs HTTPS/secure origin');
    return;
  }
  if (watchId) navigator.geolocation.clearWatch(watchId);
  state.liveGps = true;
  watchId = navigator.geolocation.watchPosition((pos) => {
    const { latitude, longitude, accuracy } = pos.coords;
    hole().you = { ...(hole().you || {}), lat: latitude, lng: longitude };
    if (googleReady && gpsAccuracyCircle) {
      gpsAccuracyCircle.setCenter({ lat: latitude, lng: longitude });
      gpsAccuracyCircle.setRadius(accuracy || 0);
      gpsAccuracyCircle.setMap(gmap);
    }
    onGpsStatus(`Live GPS: ${accuracy ? Math.round(accuracy) + ' m accuracy' : 'position locked'}`);
    onRender();
  }, (err) => {
    state.liveGps = false;
    onGpsStatus(`GPS error: ${err.message}`);
    onToast('GPS permission/error');
    onRender();
  }, { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 });
  onToast('Live GPS started');
  onGpsStatus('Waiting for GPS fix…');
}

export function stopLiveGps() {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  state.liveGps = false;
  if (gpsAccuracyCircle) gpsAccuracyCircle.setMap(null);
  onGpsStatus(googleReady ? 'Google satellite map ready · GPS stopped' : 'GPS stopped');
  onRender();
}

export function setMapPoint(evt) {
  if (evt.target.closest('button') || evt.target.closest('#googleMap')) return;
  if (googleReady) return;
  const rect = $('map').getBoundingClientRect();
  const x = clamp(((evt.clientX - rect.left) / rect.width) * 100, 2, 98);
  const y = clamp(((evt.clientY - rect.top) / rect.height) * 100, 2, 98);
  const h = hole();
  h[state.activeMapMode] = { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
  onRender();
  onToast(`${state.activeMapMode[0].toUpperCase() + state.activeMapMode.slice(1)} set`);
}
