import { state, hole, persistLocal, resetGameState } from './state.js';
import { calcPlayer, clamp, fmtGame, escapeHtml } from './scoring.js';
import { renderMap, renderDistances } from './map.js';
import { isSignedIn } from './auth.js';

const $ = (id) => document.getElementById(id);

export function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 1800);
}

export function updateGpsStatus(message) {
  const el = $('gpsStatus');
  if (el) el.textContent = message;
}

export function renderHeader() {
  const h = hole();
  $('title').textContent = `${state.course} · Hole ${state.currentHole}`;
  $('courseBtn').textContent = `${state.course}`;
  $('parPill').textContent = `Par ${h.par}`;
  $('siPill').textContent = `SI ${h.strokeIndex}`;
  $('modePill').textContent = state.scoringMode;
}

export function renderAuth() {
  const signed = isSignedIn();
  $('authBar').classList.toggle('signed-in', signed);
  $('authEmail').textContent = signed ? (state.userEmail || '') : '';
  $('signedOutControls').style.display = signed ? 'none' : 'flex';
  $('signedInControls').style.display = signed ? 'flex' : 'none';
  $('saveGame').disabled = !signed;
  $('loadGame').disabled = !signed;
}

export function renderScores() {
  $('scoreRows').innerHTML = state.players.map((p, index) => {
    const c = calcPlayer(p);
    return `<div class="score-row" data-id="${p.id}">
      <button class="mini-btn ${index === 0 ? 'ghost' : 'danger'}" data-action="remove" ${index === 0 ? 'disabled' : ''}>${index === 0 ? '' : '−'}</button>
      <input class="name-input" data-field="name" value="${escapeHtml(p.name)}" />
      <input class="number-input" data-field="handicap" type="number" min="0" max="54" value="${p.handicap}" />
      <input class="score-input" data-field="score" type="number" min="1" max="20" value="${c.holeGross || ''}" />
      <div class="readonly-cell">${c.holePoints}</div>
      <div class="readonly-cell">${c.grossTotal}</div>
      <div class="readonly-cell">${c.netTotal}</div>
      <div class="readonly-cell">${c.pointsTotal}</div>
      <div class="readonly-cell">${c.grossTotal ? fmtGame(c.game) : '0'}</div>
    </div>`;
  }).join('');
}

export function render() {
  renderHeader();
  renderDistances();
  renderMap();
  renderScores();
  renderAuth();
}

export function openModal(id) {
  $(id).classList.add('open');
}
export function closeModal(id) {
  $(id).classList.remove('open');
}

export function renderGameList(games) {
  const list = $('gameList');
  if (!games.length) {
    list.innerHTML = '<div class="empty">No saved cloud games yet.</div>';
    return;
  }
  list.innerHTML = games.map(g => {
    const when = g.updated_at ? new Date(g.updated_at).toLocaleString() : '';
    return `<div class="game-row" data-id="${g.id}">
      <div class="game-meta">
        <div class="game-title">${escapeHtml(g.name || g.course || 'Game')}</div>
        <div class="game-sub">${escapeHtml(g.course || '')} · Hole ${g.current_hole || 1} · ${escapeHtml(when)}</div>
      </div>
      <button class="primary" data-action="load">Load</button>
      <button class="danger" data-action="delete">Delete</button>
    </div>`;
  }).join('');
}

export { resetGameState, persistLocal, clamp };
