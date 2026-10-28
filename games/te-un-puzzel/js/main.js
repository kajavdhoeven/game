// Te-Un Puzzel: vier legpuzzels. Alles wordt in de browser getekend, er is geen build nodig.
const GAME_ID = 'te-un-puzzel';
const LEVELS = [
  { n: 1, name: 'Te-Un', img: 'img/level1.jpg', cols: 3, rows: 4, ghost: 0.28, rotate: false, limit: 30 },
  { n: 2, name: 'Arcade', img: 'img/level2.jpg', cols: 4, rows: 6, ghost: 0.12, rotate: false, limit: 60 },
  { n: 3, name: 'Op het toilet', img: 'img/level3.jpg', cols: 6, rows: 6, ghost: 0, rotate: false, limit: 150 },
  { n: 4, name: 'Het leger', img: 'img/level4.jpg', cols: 9, rows: 6, ghost: 0, rotate: true, limit: 600 },
];

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);

// ---------------------------------------------------------------- opslaan + platform
const KEY = 'teun-puzzel-v1';
let P = { done: {}, fast: {}, updatedAt: 0 };
try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* geen opslag */ }
const post = (type, extra = {}) => {
  if (window.parent === window) return;
  try { window.parent.postMessage({ type, game: GAME_ID, ...extra }, location.origin); } catch (e) { /* geen ouder */ }
};
let saveTimer = null;
function save(quiet) {
  if (!quiet) P.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* geen opslag */ }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => post('teun:save', { data: { done: P.done, fast: P.fast, updatedAt: P.updatedAt } }), 500);
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const m = e.data;
  if (!m || m.game !== GAME_ID) return;
  if (m.type === 'teun:progress' && m.data) {
    const d = m.data;
    if ((d.updatedAt || 0) > (P.updatedAt || 0)) {
      P.done = Object.assign({}, d.done || {});
      P.fast = Object.assign({}, d.fast || {});
      P.updatedAt = d.updatedAt;
      save(true);
      renderMenu();
    } else if ((d.updatedAt || 0) < (P.updatedAt || 0)) post('teun:save', { data: { done: P.done, fast: P.fast, updatedAt: P.updatedAt } });
  }
});
const allFast = () => LEVELS.every((l) => P.fast && P.fast[l.n]);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- geluid
let actx = null;
function beep(freq, dur, type = 'sine', vol = 0.12, when = 0) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + when;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination);
    o.start(t); o.stop(t + dur);
  } catch (e) { /* geen geluid */ }
}
const sndSnap = () => { beep(620, 0.09, 'triangle', 0.14); beep(930, 0.12, 'triangle', 0.1, 0.05); };
const sndWin = () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, 'triangle', 0.14, i * 0.12));
function toast(t) {
  const el = $('toast');
  el.textContent = t; el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200);
}

// ---------------------------------------------------------------- puzzelstuk tekenen
// Een rand loopt van A naar B. sign: +1 nop naar buiten, -1 nop naar binnen, 0 vlak.
function edge(ctx, ax, ay, bx, by, sign) {
  if (!sign) { ctx.lineTo(bx, by); return; }
  const dx = bx - ax, dy = by - ay;
  const nx = dy * sign, ny = -dx * sign; // naar buiten (bij kloksgewijs lopen)
  const P_ = (a, b) => [ax + dx * a + nx * b, ay + dy * a + ny * b];
  const pt = (a, b) => ctx.lineTo(...P_(a, b));
  const cv = (a1, b1, a2, b2, a3, b3) => ctx.bezierCurveTo(...P_(a1, b1), ...P_(a2, b2), ...P_(a3, b3));
  pt(0.37, 0);
  cv(0.45, 0.02, 0.42, 0.1, 0.40, 0.15);
  cv(0.35, 0.27, 0.65, 0.27, 0.60, 0.15);
  cv(0.58, 0.1, 0.55, 0.02, 0.63, 0);
  ctx.lineTo(bx, by);
}
function piecePath(ctx, m, pw, ph, e) {
  ctx.beginPath();
  ctx.moveTo(m, m);
  edge(ctx, m, m, m + pw, m, e.t);
  edge(ctx, m + pw, m, m + pw, m + ph, e.r);
  edge(ctx, m + pw, m + ph, m, m + ph, e.b);
  edge(ctx, m, m + ph, m, m, e.l);
  ctx.closePath();
}

// ---------------------------------------------------------------- spel
const stage = $('stage');
const piecesEl = $('pieces');
const boardEl = $('board');
let cur = null; // huidig level-spel
let zTop = 10;

const imgCache = {};
function loadImg(src) {
  if (!imgCache[src]) {
    imgCache[src] = new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });
  }
  return imgCache[src];
}

function layout(level, img) {
  const sw = stage.clientWidth, sh = stage.clientHeight;
  const ar = img.naturalWidth / img.naturalHeight;
  const landscape = sw > sh * 1.2;
  const pad = 10;
  let maxW, maxH, bx, by, tray;
  if (landscape) {
    maxW = sw * 0.6 - pad * 2; maxH = sh - pad * 2;
  } else {
    maxW = sw - pad * 2; maxH = sh * 0.5 - pad;
  }
  let bw = maxW, bh = bw / ar;
  if (bh > maxH) { bh = maxH; bw = bh * ar; }
  if (landscape) {
    bx = pad + (maxW - bw) / 2; by = pad + (maxH - bh) / 2;
    tray = { x: bx + bw + pad * 2, y: pad, w: sw - (bx + bw + pad * 3), h: sh - pad * 2 };
  } else {
    bx = (sw - bw) / 2; by = pad;
    tray = { x: pad, y: by + bh + pad, w: sw - pad * 2, h: sh - (by + bh + pad * 2) };
  }
  return { bx, by, bw, bh, tray };
}

async function startLevel(n) {
  const level = LEVELS[n - 1];
  $('menu').hidden = true;
  $('play').hidden = false;
  $('win').hidden = true;
  $('lvName').textContent = `Level ${level.n}`;
  $('btnPeek').setAttribute('aria-pressed', 'false');
  $('peek').hidden = true;
  $('btnEdges').setAttribute('aria-pressed', 'false');
  piecesEl.innerHTML = '';
  const img = await loadImg(level.img);
  const L = layout(level, img);
  const { cols, rows } = level;
  const pw = L.bw / cols, ph = L.bh / rows;
  const m = Math.ceil(Math.max(pw, ph) * 0.28);
  Object.assign(boardEl.style, { left: L.bx + 'px', top: L.by + 'px', width: L.bw + 'px', height: L.bh + 'px' });
  const ghost = $('ghost');
  ghost.src = level.img;
  ghost.style.opacity = level.ghost;
  ghost.hidden = !level.ghost;
  $('peek').src = level.img;

  // randen: willekeurige nokjes, buren sluiten op elkaar aan
  const hs = [], vs = [];
  for (let r = 0; r < rows; r++) { hs[r] = []; for (let c = 1; c < cols; c++) hs[r][c] = Math.random() < 0.5 ? 1 : -1; }
  for (let r = 1; r < rows; r++) { vs[r] = []; for (let c = 0; c < cols; c++) vs[r][c] = Math.random() < 0.5 ? 1 : -1; }

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cw = pw + 2 * m, ch = ph + 2 * m;
  const s = L.bw / img.naturalWidth;
  const pieces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const e = {
        t: r === 0 ? 0 : -vs[r][c],
        b: r === rows - 1 ? 0 : vs[r + 1][c],
        l: c === 0 ? 0 : -hs[r][c],
        r: c === cols - 1 ? 0 : hs[r][c + 1],
      };
      const cv = document.createElement('canvas');
      cv.width = Math.ceil(cw * dpr); cv.height = Math.ceil(ch * dpr);
      cv.style.width = cw + 'px'; cv.style.height = ch + 'px';
      cv.className = 'pc';
      const ctx = cv.getContext('2d');
      ctx.scale(dpr, dpr);
      piecePath(ctx, m, pw, ph, e);
      ctx.save();
      ctx.clip();
      ctx.translate(m - c * pw, m - r * ph);
      ctx.scale(s, s);
      ctx.drawImage(img, 0, 0);
      ctx.restore();
      piecePath(ctx, m, pw, ph, e);
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.2; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.stroke();
      const p = {
        el: cv, c, r, cw, ch, edge: !(r > 0 && r < rows - 1 && c > 0 && c < cols - 1),
        tx: L.bx + (c + 0.5) * pw, ty: L.by + (r + 0.5) * ph,
        x: 0, y: 0, rot: level.rotate ? ((Math.random() * 4) | 0) : 0, placed: false,
      };
      pieces.push(p);
      piecesEl.appendChild(cv);
    }
  }
  cur = { level, L, pw, ph, pieces, placed: 0, t0: 0, elapsed: 0, over: false, tick: null };
  scatter();
  pieces.forEach((p) => bindPiece(p));
  updateHud();
  clearInterval(cur.tick);
  cur.tick = setInterval(() => {
    if (!cur || cur.over || !cur.t0) return;
    cur.elapsed = (performance.now() - cur.t0) / 1000;
    paintClock();
  }, 250);
  paintClock();
  if (level.rotate) toast('Tik op een stukje om het te draaien');
}

function paintClock() {
  const lim = cur.level.limit;
  const el = $('clock');
  el.textContent = `${fmtTime(cur.elapsed || 0)} / ${fmtTime(lim)}`;
  el.classList.toggle('late', (cur.elapsed || 0) > lim);
}

function setPos(p) {
  p.el.style.left = p.x - p.cw / 2 + 'px';
  p.el.style.top = p.y - p.ch / 2 + 'px';
  p.el.style.transform = `rotate(${p.rot * 90}deg)`;
}

function scatter() {
  // verdeel de stukjes over een raster met wat ruis, zodat ze elkaar zo weinig mogelijk afdekken
  const { tray } = cur.L;
  const list = cur.pieces.filter((p) => !p.placed).sort(() => Math.random() - 0.5);
  if (!list.length) return;
  const hx = Math.max(cur.pw, cur.ph) * 1.0;
  let cols = Math.max(1, Math.round(Math.sqrt(list.length * tray.w / tray.h)));
  let rows = Math.ceil(list.length / cols);
  while (cols * rows < list.length) cols++;
  const cw = tray.w / cols, ch = tray.h / rows;
  const cells = [];
  for (let i = 0; i < cols * rows; i++) cells.push(i);
  cells.sort(() => Math.random() - 0.5);
  list.forEach((p, i) => {
    const cell = cells[i];
    const cx = tray.x + (cell % cols + 0.5) * cw;
    const cy = tray.y + (Math.floor(cell / cols) + 0.5) * ch;
    p.x = Math.min(stage.clientWidth - hx / 2, Math.max(hx / 2, cx + rand(-cw, cw) * 0.3));
    p.y = Math.min(stage.clientHeight - hx / 2, Math.max(hx / 2, cy + rand(-ch, ch) * 0.3));
    p.el.style.zIndex = ++zTop;
    setPos(p);
  });
}

function bindPiece(p) {
  let sx = 0, sy = 0, ox = 0, oy = 0, moved = false, t0 = 0, id = null;
  const el = p.el;
  el.addEventListener('pointerdown', (e) => {
    if (p.placed || cur.over) return;
    e.preventDefault();
    id = e.pointerId;
    el.setPointerCapture(id);
    sx = e.clientX; sy = e.clientY; ox = p.x; oy = p.y; moved = false; t0 = performance.now();
    el.classList.add('drag');
    el.style.zIndex = ++zTop;
    if (!cur.t0) cur.t0 = performance.now();
  });
  el.addEventListener('pointermove', (e) => {
    if (id !== e.pointerId) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 6) return;
    moved = true;
    const sw = stage.clientWidth, sh = stage.clientHeight;
    p.x = Math.min(sw - 8, Math.max(8, ox + dx));
    p.y = Math.min(sh - 8, Math.max(8, oy + dy));
    setPos(p);
  });
  const end = (e) => {
    if (id !== e.pointerId) return;
    id = null;
    el.classList.remove('drag');
    if (!moved && performance.now() - t0 < 500 && cur.level.rotate) {
      p.rot = (p.rot + 1) % 4;
      setPos(p);
    }
    trySnap(p);
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

function trySnap(p) {
  if (p.placed || p.rot % 4 !== 0) return;
  const lim = Math.min(cur.pw, cur.ph) * 0.38;
  if (Math.hypot(p.x - p.tx, p.y - p.ty) > lim) return;
  place(p);
}

function place(p) {
  p.placed = true;
  p.x = p.tx; p.y = p.ty; p.rot = 0;
  p.el.classList.remove('dim');
  p.el.classList.add('placed', 'pop');
  p.el.style.zIndex = 1;
  setPos(p);
  cur.placed++;
  sndSnap();
  updateHud();
  if (cur.placed === cur.pieces.length) finish();
}

function updateHud() {
  $('count').textContent = `${cur.placed} / ${cur.pieces.length}`;
}

function finish() {
  cur.over = true;
  clearInterval(cur.tick);
  const t = cur.t0 ? (performance.now() - cur.t0) / 1000 : 0;
  const lvl = cur.level, n = lvl.n;
  const inTime = t <= lvl.limit;
  const wasAll = allFast();
  const sec = Math.max(1, Math.round(t));
  P.done[n] = P.done[n] ? Math.min(P.done[n], sec) : sec;
  if (inTime) P.fast[n] = P.fast[n] ? Math.min(P.fast[n], sec) : sec;
  save();
  setTimeout(() => {
    sndWin();
    $('winTitle').textContent = inTime ? `Level ${n} af, binnen de tijd!` : `Level ${n} af, maar te langzaam`;
    $('winText').innerHTML = inTime
      ? `Jouw tijd: <b>${fmtTime(t)}</b> (limiet ${fmtTime(lvl.limit)})`
      : `Jouw tijd: <b>${fmtTime(t)}</b><br>Je had <b>${fmtTime(lvl.limit)}</b> of sneller nodig. Probeer het nog eens.`;
    const unlocked = allFast() && !wasAll;
    const box = $('winReward');
    box.hidden = !unlocked;
    if (unlocked) box.innerHTML = `${puzzleBadge()}Alle 4 de puzzels binnen de tijd! Je hebt een nieuwe profielfoto: Te-Un met puzzelstukje.`;
    $('winNext').hidden = n >= LEVELS.length;
    $('winNext').textContent = `Level ${n + 1}`;
    $('win').hidden = false;
  }, 700);
}

function puzzleBadge() {
  return '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M10 18h14a8 8 0 1 1 16 0h14v14a8 8 0 1 0 0 16v6H40a8 8 0 1 0-16 0H10V48a8 8 0 1 0 0-16z" fill="#2f7bff" stroke="#0b3a99" stroke-width="3" stroke-linejoin="round"/></svg>';
}

// ---------------------------------------------------------------- menu
function renderMenu() {
  const box = $('levels');
  box.innerHTML = '';
  LEVELS.forEach((l) => {
    const open = l.n === 1 || P.done[l.n - 1];
    const b = document.createElement('button');
    b.className = 'lv' + (P.fast && P.fast[l.n] ? ' done' : '');
    b.disabled = !open;
    b.innerHTML = `<img src="${l.img}" alt="" draggable="false"><div class="meta"><b>Level ${l.n}</b><small>${l.cols * l.rows} stukjes${l.rotate ? ', draaien' : ''}</small><small>Tijdslimiet ${fmtTime(l.limit)}${P.fast && P.fast[l.n] ? ' · gehaald in ' + fmtTime(P.fast[l.n]) : P.done[l.n] ? ' · af, maar te langzaam' : ''}</small></div>`;
    b.addEventListener('click', () => startLevel(l.n));
    box.appendChild(b);
  });
}
function toMenu() {
  if (cur) clearInterval(cur.tick);
  cur = null;
  $('play').hidden = true;
  $('win').hidden = true;
  $('menu').hidden = false;
  renderMenu();
}

$('back').addEventListener('click', toMenu);
$('winMenu').addEventListener('click', toMenu);
$('winNext').addEventListener('click', () => startLevel(cur.level.n + 1));
$('btnSpread').addEventListener('click', () => { if (cur && !cur.over) scatter(); });
const peek = (on) => { $('peek').hidden = !on; $('btnPeek').setAttribute('aria-pressed', String(on)); };
$('btnPeek').addEventListener('click', () => peek($('peek').hidden));
$('btnEdges').addEventListener('click', () => {
  if (!cur) return;
  const on = $('btnEdges').getAttribute('aria-pressed') !== 'true';
  $('btnEdges').setAttribute('aria-pressed', String(on));
  cur.pieces.forEach((p) => p.el.classList.toggle('dim', on && !p.edge && !p.placed));
});
let rt = null;
window.addEventListener('resize', () => {
  clearTimeout(rt);
  rt = setTimeout(() => { if (cur && !cur.over && !cur.t0) startLevel(cur.level.n); }, 400);
});

// test- en ontwikkelhulp
window.__puz = {
  get cur() { return cur; }, P, startLevel,
  solve() { cur.pieces.filter((p) => !p.placed).forEach(place); },
  solveAllButOne() { const l = cur.pieces.filter((p) => !p.placed); l.slice(1).forEach(place); },
};

renderMenu();
post('teun:ready');
