import { STORAGE_KEY } from './config.js';
import { holesForCourse, DEFAULT_COURSE } from './courses.js';

function freshHoles(courseName = DEFAULT_COURSE) {
  return holesForCourse(courseName);
}

function freshPlayers() {
  return [
    { id: crypto.randomUUID(), name: 'Player 1', handicap: 0, scores: {} },
    { id: crypto.randomUUID(), name: 'Player 2', handicap: 0, scores: {} }
  ];
}

export const state = {
  course: DEFAULT_COURSE,
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

export function resetGameState({ course = DEFAULT_COURSE, scoringMode = 'Stroke Play' } = {}) {
  state.course = course;
  state.scoringMode = scoringMode;
  state.currentHole = 1;
  state.holes = freshHoles(course);
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
    const template = holesForCourse(state.course);
    state.holes = state.holes.map((h, i) => ({ ...template[i], ...h }));
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
  const template = holesForCourse(state.course);
  state.holes = (row.holes?.length ? row.holes : template)
    .map((h, i) => ({ ...template[i], ...h }));
}
