import { supabaseConfigured, GOOGLE_MAPS_API_KEY } from './config.js';
import { COURSE_NAMES, SCORING_MODES, DEFAULT_COURSE } from './courses.js';
import { state, hole, hydrateLocal, persistLocal, resetGameState, MAX_PLAYERS } from './state.js';
import { clamp } from './scoring.js';
import {
  initMap, renderMap, renderDistances, loadGoogleMaps,
  setMapType, centerOnGps, startLiveGps, stopLiveGps, setMapPoint, isGpsLive
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

function populateNewGameModal() {
  const courseSel = $('newGameCourse');
  courseSel.innerHTML = COURSE_NAMES.map(n =>
    `<option value="${n}" ${n === state.course ? 'selected' : ''}>${n}</option>`
  ).join('');
  const modeSel = $('newGameMode');
  modeSel.innerHTML = SCORING_MODES.map(m =>
    `<option value="${m}" ${m === state.scoringMode ? 'selected' : ''}>${m}</option>`
  ).join('');
}

function openNewGameModal() {
  populateNewGameModal();
  openModal('newGameModal');
}

function startNewGame() {
  const course = $('newGameCourse').value || DEFAULT_COURSE;
  const scoringMode = $('newGameMode').value || 'Stroke Play';
  resetGameState({ course, scoringMode });
  persistLocal();
  render();
  closeModal('newGameModal');
  toast(`New ${scoringMode} game · ${course}`);
}

function bindEvents() {
  $('map').addEventListener('pointerdown', setMapPoint);
  $('locateBtn').addEventListener('click', () => {
    if (centerOnGps()) toast('Centered on GPS');
    else toast('No GPS position yet');
  });
  $('mapTypeBtn').addEventListener('click', () => {
    const next = state.mapType === 'satellite' ? 'roadmap' : 'satellite';
    setMapType(next);
    toast(`Map: ${next}`);
  });
  $('gpsToggle').addEventListener('click', () => {
    if (isGpsLive()) { stopLiveGps(); updateGpsBtn(); }
    else { startLiveGps(); updateGpsBtn(); }
  });
  $('clearLayup').addEventListener('click', () => { hole().layup = null; render(); toast('Layup cleared'); });
  $('prevHole').addEventListener('click', () => { state.currentHole = state.currentHole === 1 ? 18 : state.currentHole - 1; render(); });
  $('nextHole').addEventListener('click', () => { state.currentHole = state.currentHole === 18 ? 1 : state.currentHole + 1; render(); });
  $('saveGame').addEventListener('click', handleSave);
  $('loadGame').addEventListener('click', openLoadModal);
  $('newGame').addEventListener('click', openNewGameModal);
  $('newGameClose').addEventListener('click', () => closeModal('newGameModal'));
  $('newGameStart').addEventListener('click', startNewGame);
  $('addPlayer').addEventListener('click', () => {
    if (state.players.length >= MAX_PLAYERS) { toast(`Max ${MAX_PLAYERS} players`); return; }
    const n = state.players.length + 1;
    state.players.push({ id: crypto.randomUUID(), name: `Player ${n}`, handicap: 0, scores: {} });
    render();
    toast(`Player ${n} added`);
  });

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
    if (state.players.length <= 1) { toast('Need at least 1 player'); return; }
    state.players = state.players.filter(p => p.id !== row.dataset.id);
    render();
    toast('Player removed');
  });

  function updateGpsBtn() {
    const btn = $('gpsToggle');
    btn.textContent = isGpsLive() ? 'Stop GPS' : 'Start GPS';
    btn.classList.toggle('primary', !isGpsLive());
    btn.classList.toggle('danger', isGpsLive());
  }
  updateGpsBtn();

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
      closeModal('newGameModal');
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
state.googleMapsApiKey = GOOGLE_MAPS_API_KEY
  || new URLSearchParams(location.search).get('key')
  || state.googleMapsApiKey
  || '';
render();
if (!supabaseConfigured()) {
  updateGpsStatus('Supabase not configured · cloud save/load disabled');
}
if (state.googleMapsApiKey) loadGoogleMaps();
scheduleClock();
