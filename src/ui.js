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
}

export function updatePlayerRowCells(player) {
  const row = document.querySelector(`.score-row[data-id="${player.id}"]`);
  if (!row) return;
  const c = calcPlayer(player);
  const cells = row.querySelectorAll('.readonly-cell');
  if (cells[0]) cells[0].textContent = c.holePoints;
  if (cells[1]) cells[1].textContent = c.grossTotal;
  if (cells[2]) cells[2].textContent = c.netTotal;
  if (cells[3]) cells[3].textContent = c.pointsTotal;
  if (cells[4]) cells[4].textContent = c.grossTotal ? fmtGame(c.game) : '0';
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
  renderGameStatus();
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

function holesPlayed() {
  return state.holes.slice(0, state.currentHole).filter(h => h);
}

function playerNetForHole(player, h) {
  const gross = Number(player.scores[h.number]) || 0;
  if (!gross) return null;
  return gross - strokesForHole(player.handicap, h.strokeIndex);
}

function teamGroups() {
  // P1+P2 vs P3+P4. Falls back to empty array if fewer than 4 players.
  const p = state.players;
  return [
    { name: 'Team 1', members: [p[0], p[1]].filter(Boolean) },
    { name: 'Team 2', members: [p[2], p[3]].filter(Boolean) }
  ].filter(t => t.members.length > 0);
}

function entityNetForHole(entity, h) {
  // entity = single player or team. Team uses better-ball (lowest net) of its members.
  const members = entity.members || [entity];
  let best = null;
  for (const m of members) {
    const n = playerNetForHole(m, h);
    if (n === null) continue;
    if (best === null || n < best) best = n;
  }
  return best;
}

function entityTotals(entity) {
  let net = 0, points = 0, par = 0, holes = 0;
  for (const h of state.holes) {
    const n = entityNetForHole(entity, h);
    if (n === null) continue;
    net += n;
    points += stableford(n, h.par);
    par += h.par;
    holes += 1;
  }
  return { net, points, toPar: net - par, holes };
}

function matchPlayStatus(a, b) {
  // Returns { lead: 'a'|'b'|'even', up: int, holesPlayed, holesLeft, done, label }
  let aWins = 0, bWins = 0, played = 0;
  for (let i = 1; i <= state.currentHole; i++) {
    const h = state.holes[i - 1];
    const na = entityNetForHole(a, h);
    const nb = entityNetForHole(b, h);
    if (na === null || nb === null) continue;
    played += 1;
    if (na < nb) aWins += 1;
    else if (nb < na) bWins += 1;
  }
  const holesLeft = 18 - played;
  const diff = aWins - bWins;
  const up = Math.abs(diff);
  let lead = 'even';
  if (diff > 0) lead = 'a';
  else if (diff < 0) lead = 'b';
  const done = up > holesLeft;
  let label;
  if (done) label = `${up} & ${holesLeft}`;
  else if (lead === 'even') label = 'All Square';
  else label = `${up} Up`;
  return { lead, up, holesPlayed: played, holesLeft, done, label };
}

export function renderGameStatus() {
  const el = $('gameStatus');
  if (!el) return;
  const entities = state.teams
    ? teamGroups()
    : state.players.map(p => ({ name: p.name, members: [p] }));
  if (!entities.length) { el.innerHTML = ''; return; }

  const isMatch = state.scoringMode === 'Match Play';
  const titleBits = [state.scoringMode];
  if (!isMatch) titleBits.push(state.scoringType);
  if (state.teams) titleBits.push('Teams · Best Ball');
  const title = titleBits.join(' · ');

  if (isMatch && entities.length === 2) {
    const [a, b] = entities;
    const m = matchPlayStatus(a, b);
    state.matchStatusCache = { a: a.name, b: b.name, ...m };

    function sideClass(forSide) {
      if (m.lead === 'even') return 'tied';
      if (m.lead === forSide) return ''; // green lead
      return 'trail';
    }
    function sub(entity) {
      // Solo: HCP X. Teams: list members.
      if (state.teams) return entity.members.map(p => p.name).join(' + ');
      const p = entity.members[0];
      return p ? `HCP ${p.handicap || 0}` : '';
    }

    const dormie = !m.done && m.up > 0 && m.up === m.holesLeft;
    let centerCls = '';
    let bigTxt = 'AS';
    let bottom = '';
    let bottomNum = '';

    if (m.done) {
      centerCls = 'done';
      bigTxt = m.label;
      bottom = 'MATCH';
    } else if (m.lead === 'even') {
      bigTxt = 'AS';
      bottom = 'THRU';
      bottomNum = String(m.holesPlayed);
    } else {
      bigTxt = `${m.up} UP`;
      if (dormie) { centerCls = 'dormie'; bottom = 'DORMIE'; bottomNum = String(m.holesPlayed); }
      else { bottom = 'THRU'; bottomNum = String(m.holesPlayed); }
    }

    el.innerHTML = `
      <div class="gs-title">${escapeHtml(title)}</div>
      <div class="mp-bar">
        <div class="mp-side left ${sideClass('a')}">
          <div class="mp-name">${escapeHtml(a.name)}</div>
          <div class="mp-sub">${escapeHtml(sub(a))}</div>
        </div>
        <div class="mp-center ${centerCls}">
          <div class="mp-big">${escapeHtml(bigTxt)}</div>
          ${bottom ? `<div class="mp-thru">${escapeHtml(bottom)}</div>` : ''}
          ${bottomNum ? `<div class="mp-thru-num">${escapeHtml(bottomNum)}</div>` : ''}
        </div>
        <div class="mp-side right ${sideClass('b')}">
          <div class="mp-name">${escapeHtml(b.name)}</div>
          <div class="mp-sub">${escapeHtml(sub(b))}</div>
        </div>
      </div>`;
    return;
  }

  // Stroke Play leaderboard
  const useNet = state.scoringType === 'Net Score';
  const rows = entities.map(e => ({ name: e.name, totals: entityTotals(e) }));
  if (useNet) {
    rows.sort((x, y) => x.totals.toPar - y.totals.toPar);
  } else {
    rows.sort((x, y) => y.totals.points - x.totals.points);
  }
  const fmtToPar = n => n === 0 ? 'E' : (n > 0 ? `+${n}` : `${n}`);
  el.innerHTML = `
    <div class="gs-title">${escapeHtml(title)} · Leaderboard</div>
    ${rows.map((r, i) => {
      const cls = i === 0 && rows.length > 1 ? 'lead' : '';
      const value = useNet ? fmtToPar(r.totals.toPar) : `${r.totals.points} pts`;
      const sub = useNet ? `Net ${r.totals.net}` : `Net to par ${fmtToPar(r.totals.toPar)}`;
      return `<div class="gs-row ${cls}">
        <div>${escapeHtml(r.name)}</div>
        <div style="color:#9cb5a8;font-weight:600;font-size:14px;">${sub}</div>
        <div style="font-size:22px;">${value}</div>
      </div>`;
    }).join('')}`;
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
