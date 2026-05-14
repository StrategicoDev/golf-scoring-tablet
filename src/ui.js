import { state, hole, persistLocal, resetGameState } from './state.js';
import { calcPlayer, clamp, fmtGame, escapeHtml, strokesForHole, stableford } from './scoring.js';
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
  $('parPill').textContent = `Par ${h.par}`;
  $('siPill').textContent = `SI ${h.strokeIndex}`;
  $('modePill').textContent = state.scoringMode;
  const unitsBtn = $('unitsBtn');
  if (unitsBtn) unitsBtn.textContent = state.units === 'yards' ? 'yd' : 'm';
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

export function renderScorecard() {
  const holes = state.holes;
  const front = holes.slice(0, 9);
  const back = holes.slice(9, 18);
  const sum = (arr, fn) => arr.reduce((a, b) => a + (fn(b) || 0), 0);

  function holeHeaderCells(arr, kind) {
    return arr.map(h => `<th class="${kind || ''}">${h.number}</th>`).join('');
  }
  function parCells(arr) { return arr.map(h => `<td>${h.par}</td>`).join(''); }
  function siCells(arr) { return arr.map(h => `<td>${h.strokeIndex}</td>`).join(''); }

  const frontPar = sum(front, h => h.par);
  const backPar = sum(back, h => h.par);
  const totalPar = frontPar + backPar;

  function playerCells(player, arr) {
    return arr.map(h => {
      const gross = Number(player.scores[h.number]) || 0;
      return `<td>${gross || ''}</td>`;
    }).join('');
  }
  function playerTotals(player) {
    let gross = 0, net = 0, points = 0, par = 0;
    for (const h of holes) {
      const g = Number(player.scores[h.number]) || 0;
      if (!g) continue;
      const s = strokesForHole(player.handicap, h.strokeIndex);
      const n = g - s;
      gross += g; net += n; points += stableford(n, h.par); par += h.par;
    }
    return { gross, net, points, game: net - par };
  }
  function playerSum(player, arr) {
    return arr.reduce((a, h) => a + (Number(player.scores[h.number]) || 0), 0);
  }

  const playerRows = state.players.map(p => {
    const t = playerTotals(p);
    const out = playerSum(p, front);
    const inn = playerSum(p, back);
    return `<tr>
      <td class="row-label">${escapeHtml(p.name)} <span style="color:#9cb5a8;font-weight:600">(${p.handicap})</span></td>
      ${playerCells(p, front)}
      <td class="out">${out || ''}</td>
      ${playerCells(p, back)}
      <td class="in">${inn || ''}</td>
      <td class="tot">${t.gross || ''}</td>
      <td class="tot">${t.gross ? t.net : ''}</td>
      <td class="tot">${t.points}</td>
      <td class="tot">${t.gross ? fmtGame(t.game) : ''}</td>
    </tr>`;
  }).join('');

  $('cardBody').innerHTML = `
    <table class="scorecard">
      <thead>
        <tr>
          <th class="row-label">Hole</th>
          ${holeHeaderCells(front)}
          <th class="out">Out</th>
          ${holeHeaderCells(back)}
          <th class="in">In</th>
          <th class="tot">Gross</th><th class="tot">Net</th><th class="tot">Pts</th><th class="tot">Game</th>
        </tr>
      </thead>
      <tbody>
        <tr class="par-row"><td class="row-label">Par</td>${parCells(front)}<td class="out">${frontPar}</td>${parCells(back)}<td class="in">${backPar}</td><td class="tot" colspan="4">${totalPar}</td></tr>
        <tr class="si-row"><td class="row-label">SI</td>${siCells(front)}<td class="out"></td>${siCells(back)}<td class="in"></td><td class="tot" colspan="4"></td></tr>
        ${playerRows}
      </tbody>
    </table>
  `;
}

export { resetGameState, persistLocal, clamp };
