import { SUPABASE_URL, SUPABASE_ANON_KEY, supabaseConfigured } from './config.js';
import { state } from './state.js';

const SESSION_KEY = 'strategico-golf-tablet-session-v1';

export const session = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
  user: null
};

function authBase() {
  return SUPABASE_URL.replace(/\/$/, '') + '/auth/v1';
}

function saveSession() {
  if (!session.accessToken) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: session.expiresAt,
    user: session.user
  }));
}

export function loadSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return false;
  try {
    const s = JSON.parse(raw);
    Object.assign(session, s);
    state.userId = s.user?.id || null;
    state.userEmail = s.user?.email || null;
    return Boolean(session.accessToken);
  } catch {
    return false;
  }
}

function applyTokens(data) {
  session.accessToken = data.access_token;
  session.refreshToken = data.refresh_token;
  session.expiresAt = Date.now() + ((data.expires_in || 3600) * 1000);
  session.user = data.user || null;
  state.userId = session.user?.id || null;
  state.userEmail = session.user?.email || null;
  saveSession();
}

async function authFetch(path, body) {
  const resp = await fetch(`${authBase()}${path}`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = data.error_description || data.msg || data.error || `Auth failed (${resp.status})`;
    throw new Error(msg);
  }
  return data;
}

export async function signUp(email, password) {
  if (!supabaseConfigured()) throw new Error('Supabase not configured');
  const data = await authFetch('/signup', { email, password });
  if (data.access_token) applyTokens(data);
  return data;
}

export async function signIn(email, password) {
  if (!supabaseConfigured()) throw new Error('Supabase not configured');
  const data = await authFetch('/token?grant_type=password', { email, password });
  applyTokens(data);
  return data;
}

export async function signOut() {
  if (session.accessToken && supabaseConfigured()) {
    try {
      await fetch(`${authBase()}/logout`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${session.accessToken}`
        }
      });
    } catch { /* ignore network errors on logout */ }
  }
  session.accessToken = null;
  session.refreshToken = null;
  session.expiresAt = 0;
  session.user = null;
  state.userId = null;
  state.userEmail = null;
  saveSession();
}

async function refresh() {
  if (!session.refreshToken) throw new Error('No refresh token');
  const data = await authFetch('/token?grant_type=refresh_token', { refresh_token: session.refreshToken });
  applyTokens(data);
  return data;
}

export async function ensureValidToken() {
  if (!session.accessToken) return null;
  if (Date.now() < session.expiresAt - 30000) return session.accessToken;
  try {
    await refresh();
    return session.accessToken;
  } catch {
    await signOut();
    return null;
  }
}

export function isSignedIn() {
  return Boolean(session.accessToken && state.userId);
}
