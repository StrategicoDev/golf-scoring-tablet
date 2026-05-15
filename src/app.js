import { supabaseConfigured, GOOGLE_MAPS_API_KEY } from './config.js';
import { COURSE_NAMES, SCORING_MODES, SCORING_TYPES, DEFAULT_COURSE } from './courses.js';
import { state, hole, hydrateLocal, persistLocal, resetGameState, MAX_PLAYERS } from './state.js';
import { clamp, meterDistance, escapeHtml } from './scoring.js';
import {
  initMap, renderMap, renderDistances, loadGoogleMaps,
  setMapType, centerOnGps, startLiveGps, stopLiveGps, setMapPoint, isGpsLive, reCenterOnHole
} from './map.js';
import {
  render, renderScores, renderHeader, renderAuth, toast, updateGpsStatus,
  openModal, closeModal, renderGameList, renderScorecard, renderGameStatus,
  updatePlayerRowCells
} from './ui.js';
import { loadSession, signIn, signUp, signOut, isSignedIn } from './auth.js';
import { saveCloud, listCloudGames, loadCloudGame, deleteCloudGame, shareLeaderboard } from './cloud.js';

const $ = (id) => document.getElementById(id);

initMap({ render, toast, gpsStatus: updateGpsStatus });

async function handleSave() {
  if (!isSignedIn()) { openModal('authModal'); toast('Sign in to save'); return; }
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
  if (!isSignedIn()) { openModal('authModal'); toast('Sign in to load saved games'); return; }
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
  $('newGameCourse').innerHTML = COURSE_NAMES.map(n =>
    `<option value="${n}" ${n === state.course ? 'selected' : ''}>${n}</option>`
  ).join('');
  $('newGameMode').innerHTML = SCORING_MODES.map(m =>
    `<option value="${m}" ${m === state.scoringMode ? 'selected' : ''}>${m}</option>`
  ).join('');
  $('newGameScoring').innerHTML = SCORING_TYPES.map(s =>
    `<option value="${s}" ${s === state.scoringType ? 'selected' : ''}>${s}</option>`
  ).join('');
  $('newGameTeams').value = state.teams ? 'yes' : 'no';
}

function openNewGameModal() {
  populateNewGameModal();
  openModal('newGameModal');
}

function openDriveModal() {
  const dist = meterDistance(hole().you, hole().tee);
  if (!Number.isFinite(dist)) { toast('Need GPS + tee to record a drive'); return; }
  $('driveHole').textContent = state.currentHole;
  const yards = state.units === 'yards';
  $('driveDist').textContent = yards ? `${Math.round(dist * 1.09361)} yd` : `${Math.round(dist)} m`;
  $('driveList').innerHTML = state.players.map(p => {
    const prior = p.drives?.[state.currentHole];
    const priorTxt = Number.isFinite(prior)
      ? ` (prev ${yards ? Math.round(prior * 1.09361) + ' yd' : Math.round(prior) + ' m'})`
      : '';
    return `<button class="primary" data-id="${p.id}" style="display:block;width:100%;text-align:left;font-size:17px;padding:12px;">
      ${escapeHtml(p.name)}${priorTxt}
    </button>`;
  }).join('');
  openModal('driveModal');
}

function recordDrive(playerId) {
  const player = state.players.find(p => p.id === playerId);
  if (!player) return;
  const dist = meterDistance(hole().you, hole().tee);
  if (!Number.isFinite(dist)) { toast('No distance to record'); return; }
  player.drives = player.drives || {};
  player.drives[state.currentHole] = dist;
  persistLocal();
  closeModal('driveModal');
  const yards = state.units === 'yards';
  toast(`${player.name}: ${yards ? Math.round(dist * 1.09361) + ' yd' : Math.round(dist) + ' m'} drive`);
}

function announceMatchTransitions() {
  const m = state.matchStatusCache;
  if (state.scoringMode !== 'Match Play' || !m) return;
  state.matchAnnounced = state.matchAnnounced || { dormie: false, done: false };

  if (m.done && !state.matchAnnounced.done) {
    state.matchAnnounced.done = true;
    const winnerName = m.lead === 'a' ? m.a : (m.lead === 'b' ? m.b : null);
    state.matchWinner = winnerName ? { name: winnerName, label: m.label } : null;
    persistLocal();
    if (winnerName) {
      const keepGoing = confirm(
        `${winnerName} wins ${m.label}!\n\nContinue scoring for stats? (OK = keep playing · Cancel = end game)`
      );
      state.matchContinue = keepGoing;
      persistLocal();
      if (!keepGoing) toast(`Game over · ${winnerName} ${m.label}`);
    }
    return;
  }

  if (!m.done && m.up > 0 && m.up === m.holesLeft && !state.matchAnnounced.dormie) {
    state.matchAnnounced.dormie = true;
    persistLocal();
    const leader = m.lead === 'a' ? m.a : m.b;
    alert(`Dormie! ${leader} is ${m.up} Up with ${m.holesLeft} to play.`);
  }
}

function startNewGame() {
  const course = $('newGameCourse').value || DEFAULT_COURSE;
  const scoringMode = $('newGameMode').value || 'Stroke Play';
  const scoringType = $('newGameScoring').value || 'Points';
  const teams = $('newGameTeams').value === 'yes';
  resetGameState({ course, scoringMode, scoringType, teams });
  persistLocal();
  render();
  reCenterOnHole();
  closeModal('newGameModal');
  toast(`New ${scoringMode} · ${scoringType}${teams ? ' · Teams' : ''} · ${course}`);
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
  $('setTee').addEventListener('click', () => {
    const you = hole().you;
    if (!you || !Number.isFinite(you.lat)) { toast('Need GPS fix to set tee'); return; }
    hole().tee = { lat: you.lat, lng: you.lng };
    persistLocal();
    render();
    toast('Tee set to current GPS');
  });
  $('clearLayup').addEventListener('click', () => { hole().layup = null; render(); toast('Layup cleared'); });
  $('prevHole').addEventListener('click', () => {
    state.currentHole = state.currentHole === 1 ? 18 : state.currentHole - 1;
    render();
  });
  $('nextHole').addEventListener('click', () => {
    state.currentHole = state.currentHole === 18 ? 1 : state.currentHole + 1;
    render();
  });
  $('saveGame').addEventListener('click', handleSave);
  $('loadGame').addEventListener('click', openLoadModal);
  $('cardBtn').addEventListener('click', () => { renderScorecard(); openModal('cardModal'); });
  $('cardClose').addEventListener('click', () => closeModal('cardModal'));
  $('shareBtn').addEventListener('click', async () => {
    if (!isSignedIn()) { openModal('authModal'); toast('Sign in to share'); return; }
    try {
      const url = await shareLeaderboard();
      try { await navigator.clipboard.writeText(url); toast('Share link copied'); }
      catch { prompt('Copy this link:', url); }
    } catch (e) {
      console.error(e);
      toast(e.message || 'Share failed');
    }
  });
  $('youTeeRow').addEventListener('click', openDriveModal);
  $('driveClose').addEventListener('click', () => closeModal('driveModal'));
  $('driveList').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-id]');
    if (btn) recordDrive(btn.dataset.id);
  });
  $('unitsBtn').addEventListener('click', () => {
    state.units = state.units === 'yards' ? 'm' : 'yards';
    persistLocal();
    render();
    toast(`Units: ${state.units === 'yards' ? 'yards' : 'metres'}`);
  });
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
    if (field === 'name') {
      player.name = e.target.value;
    } else if (field === 'handicap') {
      player.handicap = clamp(Number(e.target.value) || 0, 0, 54);
      // handicap changes net for every other player's calc too (it doesn't, but game status does)
      for (const p of state.players) updatePlayerRowCells(p);
    } else if (field === 'score') {
      player.scores[state.currentHole] = clamp(Number(e.target.value) || 0, 0, 20);
      updatePlayerRowCells(player);
    }
    renderGameStatus();
    announceMatchTransitions();
    persistLocal();
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
    btn.textContent = '📍';
    btn.title = isGpsLive() ? 'Stop GPS' : 'Start GPS';
    btn.classList.toggle('active', isGpsLive());
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
      try { await loadCloudGame(id); render(); reCenterOnHole(); toast('Game loaded'); closeModal('loadModal'); }
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
      closeModal('cardModal');
      closeModal('driveModal');
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
