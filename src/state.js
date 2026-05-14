import { DEFAULT_HOLES, STORAGE_KEY } from './config.js';

function freshHoles() {
  return JSON.parse(JSON.stringify(DEFAULT_HOLES));
}

function freshPlayers() {
  return [
    { id: crypto.randomUUID(), name: 'Player 1', handicap: 0, scores: {} },
    { id: crypto.randomUUID(), name: 'Player 2', handicap: 0, scores: {} }
  ];
}

export const state = {
  course: 'Paarl-Winelands',
  scoringMode: 'Stroke Play',
  units: 'm',
  currentHole: 1,
  holes: freshHoles(),
  players: freshPlayers(),
  activeMapMode: 'green',
  googleMapsApiKey: '',
  currentCloudGameId: '',
  liveGps: false,
  mapType: 'satellite',
  userId: null,
  userEmail: null
};

export const hole = () => state.holes[state.currentHole - 1];

export function resetGameState() {
  state.currentHole = 1;
  state.holes = freshHoles();
  state.players = freshPlayers();
  state.currentCloudGameId = '';
}

const SAVE_KEYS = ['course', 'scoringMode', 'units', 'currentHole', 'holes', 'players',
                   'activeMapMode', 'googleMapsApiKey', 'currentCloudGameId', 'mapType'];

export function persistLocal() {
  const slice = {};
  for (const k of SAVE_KEYS) slice[k] = state[k];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(slice));
}

export function hydrateLocal() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  try {
    const saved = JSON.parse(raw);
    for (const k of SAVE_KEYS) if (k in saved) state[k] = saved[k];
    state.holes = state.holes.map((h, i) => ({ ...DEFAULT_HOLES[i], ...h }));
    return true;
  } catch {
    return false;
  }
}

export function applyCloudRow(row) {
  state.currentCloudGameId = row.id;
  state.course = row.course || state.course;
  state.currentHole = row.current_hole || 1;
  state.scoringMode = row.scoring_mode || state.scoringMode;
  state.players = (row.players || []).map((p) => ({ id: p.id || crypto.randomUUID(), ...p }));
  state.holes = (row.holes?.length ? row.holes : DEFAULT_HOLES)
    .map((h, i) => ({ ...DEFAULT_HOLES[i], ...h }));
}
