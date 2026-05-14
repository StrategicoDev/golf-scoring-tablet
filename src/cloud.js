import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from './config.js';
import { state, applyCloudRow, persistLocal } from './state.js';
import { ensureValidToken, isSignedIn } from './auth.js';

function restBase() {
  return SUPABASE_URL.replace(/\/$/, '') + '/rest/v1';
}

async function authHeaders(extra = {}) {
  const token = await ensureValidToken();
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    ...extra
  };
}

function autoName() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${state.course}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function payload() {
  return {
    name: autoName(),
    course: state.course,
    current_hole: state.currentHole,
    scoring_mode: state.scoringMode,
    players: state.players,
    holes: state.holes,
    user_id: state.userId
  };
}

export async function saveCloud() {
  if (!supabaseConfigured() || !isSignedIn()) return false;
  // Each Save Game writes a new snapshot row with an auto-generated timestamped name.
  const resp = await fetch(`${restBase()}/golf_games?select=*`, {
    method: 'POST',
    headers: await authHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(payload())
  });
  if (!resp.ok) throw new Error(await resp.text());
  const rows = await resp.json();
  if (rows?.[0]?.id) state.currentCloudGameId = rows[0].id;
  persistLocal();
  return true;
}

export async function listCloudGames() {
  if (!supabaseConfigured() || !isSignedIn()) return [];
  const resp = await fetch(
    `${restBase()}/golf_games?select=id,name,course,current_hole,updated_at,created_at&order=updated_at.desc&limit=50`,
    { headers: await authHeaders() }
  );
  if (!resp.ok) throw new Error(await resp.text());
  return resp.json();
}

export async function loadCloudGame(id) {
  if (!supabaseConfigured() || !isSignedIn()) return false;
  const resp = await fetch(
    `${restBase()}/golf_games?id=eq.${encodeURIComponent(id)}&select=*`,
    { headers: await authHeaders() }
  );
  if (!resp.ok) throw new Error(await resp.text());
  const rows = await resp.json();
  if (!rows.length) return false;
  applyCloudRow(rows[0]);
  persistLocal();
  return true;
}

export async function deleteCloudGame(id) {
  if (!supabaseConfigured() || !isSignedIn()) return false;
  const resp = await fetch(
    `${restBase()}/golf_games?id=eq.${encodeURIComponent(id)}`,
    { method: 'DELETE', headers: await authHeaders() }
  );
  if (!resp.ok) throw new Error(await resp.text());
  if (state.currentCloudGameId === id) state.currentCloudGameId = '';
  return true;
}
