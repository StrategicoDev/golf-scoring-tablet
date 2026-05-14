import { supabaseConfigured, MAPS_KEY_STORAGE } from './config.js';
import { state, hole, hydrateLocal, persistLocal, resetGameState } from './state.js';
import { clamp } from './scoring.js';
import {
  initMap, renderMap, renderDistances, loadGoogleMaps,
  setMapType, centerOnGps, startLiveGps, stopLiveGps, setMapPoint
} from './map.js';
import {
  render, renderScores, renderHeader, renderAuth, toast, updateGpsStatus,
  openModal, closeModal, renderGameList
} from './ui.js';
import { loadSession, signIn, signUp, signOut, isSignedIn } from './auth.js';
import { saveCloud, listCloudGames, loadCloudGame, deleteCloudGame } from './cloud.js';

const $ = (id) => document.getElementById(id);

initMap({ render, toast, gpsStatus: updateGpsStatus });

async function handleSave() {
  if (!isSignedIn()) { toast('Sign in first to save'); return; }
  persistLocal();
  try {
    await saveCloud();
    toast('Game saved');
  } catch (e) {
    console.error(e);
    toast('Saved locally · cloud failed');
  }
}

async function openLoadModal() {
  if (!isSignedIn()) { toast('Sign in first to load cloud games'); return; }
  openModal('loadModal');
  $('gameList').innerHTML = '<div class="empty">Loading…</div>';
  try {
    const games = await listCloudGames();
    renderGameList(games);
  } catch (e) {
    console.error(e);
    $('gameList').innerHTML = '<div class="empty">Failed to load games.</div>';
  }
}

function newGame() {
  if (!confirm('Start a new blank game? Unsaved changes will be lost.')) return;
  resetGameState();
  persistLocal();
  render();
  toast('New game ready');
}

function bindEvents() {
  $('map').addEventListener('pointerdown', setMapPoint);
  $('loadGoogleMaps').addEventListener('click', loadGoogleMaps);
  $('startGps').addEventListener('click', startLiveGps);
  $('stopGps').addEventListener('click', stopLiveGps);
  $('centerOnGps').addEventListener('click', () => {
    if (centerOnGps()) toast('Centered on golfer');
    else toast('No GPS position yet');
  });
  $('mapTypeBtn').addEventListener('click', () => {
    const next = state.mapType === 'satellite' ? 'roadmap' : 'satellite';
    setMapType(next);
    toast(`Map: ${next}`);
  });
  $('mapsApiKey').addEventListener('input', (e) => { state.googleMapsApiKey = e.target.value.trim(); });
  $('setTee').addEventListener('click', () => { state.activeMapMode = 'tee'; render(); toast('Tap map to set tee'); });
  $('setLayup').addEventListener('click', () => { state.activeMapMode = 'layup'; render(); toast('Tap map to set layup'); });
  $('locateBtn').addEventListener('click', () => { state.activeMapMode = 'you'; render(); toast('Tap map to set your ball'); });
  $('clearLayup').addEventListener('click', () => { hole().layup = null; render(); toast('Layup cleared'); });
  $('tapMode').addEventListener('change', (e) => { state.activeMapMode = e.target.value; render(); });
  $('prevHole').addEventListener('click', () => { state.currentHole = state.currentHole === 1 ? 18 : state.currentHole - 1; render(); });
  $('nextHole').addEventListener('click', () => { state.currentHole = state.currentHole === 18 ? 1 : state.currentHole + 1; render(); });
  $('saveGame').addEventListener('click', handleSave);
  $('loadGame').addEventListener('click', openLoadModal);
  $('newGame').addEventListener('click', newGame);
  $('addPlayer').addEventListener('click', () => {
    const n = state.players.length + 1;
    state.players.push({ id: crypto.randomUUID(), name: `Player ${n}`, handicap: 0, scores: {} });
    render();
    toast(`Player ${n} added`);
  });
  $('courseName').addEventListener('input', (e) => { state.course = e.target.value || 'Course'; renderHeader(); });
  $('holePar').addEventListener('input', (e) => { hole().par = clamp(Number(e.target.value) || 4, 3, 6); render(); });
  $('holeSi').addEventListener('input', (e) => { hole().strokeIndex = clamp(Number(e.target.value) || 1, 1, 18); render(); });

  $('scoreRows').addEventListener('input', (e) => {
    const row = e.target.closest('.score-row'); if (!row) return;
    const player = state.players.find(p => p.id === row.dataset.id); if (!player) return;
    const field = e.target.dataset.field;
    if (field === 'name') player.name = e.target.value;
    if (field === 'handicap') player.handicap = clamp(Number(e.target.value) || 0, 0, 54);
    if (field === 'score') player.scores[state.currentHole] = clamp(Number(e.target.value) || 0, 0, 20);
    renderScores();
  });
  $('scoreRows').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="remove"]');
    if (!btn || btn.disabled) return;
    const row = btn.closest('.score-row');
    state.players = state.players.filter(p => p.id !== row.dataset.id);
    render();
    toast('Player removed');
  });

  // Auth
  $('signInBtn').addEventListener('click', () => openModal('authModal'));
  $('signOutBtn').addEventListener('click', async () => {
    await signOut();
    renderAuth();
    toast('Signed out');
  });
  $('authClose').addEventListener('click', () => closeModal('authModal'));
  $('authSubmit').addEventListener('click', async () => {
    const email = $('authEmailInput').value.trim();
    const password = $('authPassword').value;
    const mode = $('authMode').value;
    if (!email || !password) { toast('Email and password required'); return; }
    $('authSubmit').disabled = true;
    try {
      if (mode === 'signup') {
        await signUp(email, password);
        toast('Signed up. Check email if confirmation is required.');
      } else {
        await signIn(email, password);
        toast('Signed in');
      }
      closeModal('authModal');
      renderAuth();
    } catch (e) {
      console.error(e);
      toast(e.message || 'Auth failed');
    } finally {
      $('authSubmit').disabled = false;
    }
  });

  // Load modal
  $('loadClose').addEventListener('click', () => closeModal('loadModal'));
  $('gameList').addEventListener('click', async (e) => {
    const row = e.target.closest('.game-row'); if (!row) return;
    const id = row.dataset.id;
    const action = e.target.dataset.action;
    if (action === 'load') {
      try { await loadCloudGame(id); render(); toast('Game loaded'); closeModal('loadModal'); }
      catch (err) { console.error(err); toast('Load failed'); }
    } else if (action === 'delete') {
      if (!confirm('Delete this saved game?')) return;
      try {
        await deleteCloudGame(id);
        const games = await listCloudGames();
        renderGameList(games);
        toast('Deleted');
      } catch (err) { console.error(err); toast('Delete failed'); }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') $('nextHole').click();
    if (e.key === 'ArrowLeft') $('prevHole').click();
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); handleSave(); }
    if (e.key === 'Escape') {
      closeModal('authModal');
      closeModal('loadModal');
    }
  });
}

function tickClock() {
  const d = new Date();
  $('clock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function scheduleClock() {
  tickClock();
  const ms = 60000 - (Date.now() % 60000);
  setTimeout(() => { tickClock(); setInterval(tickClock, 60000); }, ms);
}

bindEvents();
loadSession();
hydrateLocal();
state.googleMapsApiKey = state.googleMapsApiKey
  || localStorage.getItem(MAPS_KEY_STORAGE)
  || new URLSearchParams(location.search).get('key')
  || '';
render();
if (!supabaseConfigured()) {
  updateGpsStatus('Supabase not configured · cloud save/load disabled');
}
if (state.googleMapsApiKey) loadGoogleMaps();
scheduleClock();
