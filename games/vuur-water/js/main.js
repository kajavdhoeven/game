// VuurTe-Un & WaterTe-Un: twee kabouters, twee deuren. Alles wordt in de browser getekend, er is geen build nodig.
import { initDev, setDevVisible } from '/js/devmode.js';
import { initTutorial } from '/js/tutorial.js';
import { submitTime, openTimeBoard } from '/js/leaderboard.js';
import { makeLevel, NODES, LEVEL_COUNT } from './levels.js';
import { World } from './engine.js';
import { CW, CH, buildStatic, drawScene } from './draw.js';

const GAME_ID = 'vuur-water';
const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- opslaan + platform
const KEY = 'vuur-water-v1';
let P = { done: {}, dev: false, numbers: false, updatedAt: 0 };
try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* geen opslag */ }
const snapshot = () => ({ done: P.done, dev: P.dev, updatedAt: P.updatedAt });
const post = (type, extra = {}) => {
  if (window.parent === window) return;
  try { window.parent.postMessage({ type, game: GAME_ID, ...extra }, location.origin); } catch (e) { /* geen ouder */ }
};
let saveTimer = null;
function save(quiet) {
  if (!quiet) P.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* geen opslag */ }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => post('teun:save', { data: snapshot() }), 500);
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const m = e.data;
  if (!m || m.game !== GAME_ID || m.type !== 'teun:progress' || !m.data) return;
  const d = m.data;
  if ((d.updatedAt || 0) > (P.updatedAt || 0)) {
    P.done = Object.assign({}, d.done || {});
    P.updatedAt = d.updatedAt;
    save(true);
    renderMenu();
  } else if ((d.updatedAt || 0) < (P.updatedAt || 0)) post('teun:save', { data: snapshot() });
});

// ---------------------------------------------------------------- geluid
let actx = null;
function beep(freq, dur, type = 'sine', vol = 0.1, when = 0, slide = 0) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + when;
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.linearRampToValueAtTime(freq + slide, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch (e) { /* geen geluid */ }
}
const SFX = {
  jump: () => beep(300, 0.14, 'square', 0.05, 0, 260),
  gem: () => { beep(880, 0.1, 'triangle', 0.12); beep(1320, 0.16, 'triangle', 0.1, 0.08); },
  button: () => beep(180, 0.08, 'square', 0.08),
  lever: () => beep(240, 0.1, 'square', 0.08),
  gate: () => beep(140, 0.3, 'sawtooth', 0.05, 0, -50),
  die: () => { beep(300, 0.5, 'sawtooth', 0.12, 0, -250); },
  win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'triangle', 0.12, i * 0.12)),
};

// ---------------------------------------------------------------- menu: boom van edelstenen
const unlocked = (nd) => P.dev || nd.parent === 0 || !!P.done[nd.parent];
const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs, parent) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); if (parent) parent.appendChild(el); return el; };

function renderMenu() {
  const svg = $('tree');
  svg.innerHTML = '';
  const byN = new Map(NODES.map((n) => [n.n, n]));
  const lines = svgEl('g', {}, svg), gems = svgEl('g', {}, svg);
  for (const nd of NODES) {
    const p = byN.get(nd.parent);
    if (!p) continue;
    svgEl('line', { x1: p.x, y1: p.y, x2: nd.x, y2: nd.y, stroke: P.done[nd.parent] || P.dev ? '#8fd06a' : '#33402f', 'stroke-width': 7, 'stroke-linecap': 'round' }, lines);
  }
  const doneCount = Object.keys(P.done).length;
  for (const nd of NODES) {
    const open = unlocked(nd), done = !!P.done[nd.n];
    const pos = svgEl('g', { transform: `translate(${nd.x},${nd.y})` }, gems);
    const g = svgEl('g', { class: 'node ' + (done ? 'done' : open ? 'new' : 'locked'), tabindex: open ? 0 : -1, role: 'button', 'aria-label': `Level ${nd.n}${open ? '' : ' (vergrendeld)'}` }, pos);
    const c = done ? ['#4ee05a', '#bff5b0', '#1a7a2a'] : open ? ['#b8c0c8', '#eef2f6', '#6a737c'] : ['#24302a', '#2f3d35', '#161d19'];
    svgEl('path', { d: 'M0 -26 L20 -8 L0 28 L-20 -8 Z', fill: c[0], stroke: '#0c1210', 'stroke-width': 3, 'stroke-linejoin': 'round' }, g);
    svgEl('path', { d: 'M0 -26 L20 -8 L0 -8 Z', fill: c[1], opacity: 0.9 }, g);
    svgEl('path', { d: 'M0 -8 L20 -8 L0 28 Z', fill: c[2], opacity: 0.8 }, g);
    svgEl('path', { d: 'M0 -26 L-20 -8 L0 -8 Z', fill: c[1], opacity: 0.45 }, g);
    if (P.numbers || (open && !done)) {
      const t = svgEl('text', { x: 0, y: P.numbers ? 5 : 50, 'text-anchor': 'middle', class: P.numbers ? 'num' : 'newtag' }, g);
      t.textContent = P.numbers ? nd.n : 'New!';
      if (P.numbers && open && !done) { const t2 = svgEl('text', { x: 0, y: 50, 'text-anchor': 'middle', class: 'newtag' }, g); t2.textContent = 'New!'; }
    }
    if (open) {
      g.addEventListener('click', () => startLevel(nd.n));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); startLevel(nd.n); } });
    }
  }
  $('treeCount').textContent = `${doneCount} / ${LEVEL_COUNT} levels gehaald`;
  $('mNumbers').setAttribute('aria-pressed', String(!!P.numbers));
}

// ---------------------------------------------------------------- spelen
const canvas = $('cv'); canvas.width = CW; canvas.height = CH;
const g2 = canvas.getContext('2d');
let cur = null; // {n, level, world, stat, t0, paused, over}
let mode = (window.matchMedia && matchMedia('(pointer: coarse)').matches) ? 'one' : 'two';
let active = 'fire';
const keys = new Set();
const touch = { fire: { l: 0, r: 0, u: 0 }, water: { l: 0, r: 0, u: 0 } };

function fit() {
  const stage = $('stage');
  const w = stage.clientWidth, h = stage.clientHeight;
  const s = Math.min(w / CW, h / CH);
  canvas.style.width = Math.floor(CW * s) + 'px';
  canvas.style.height = Math.floor(CH * s) + 'px';
}
window.addEventListener('resize', fit);

function show(which) {
  $('menu').hidden = which !== 'menu';
  $('play').hidden = which !== 'play';
  setDevVisible(which === 'menu');
  if (which === 'play') requestAnimationFrame(fit);
}

function startLevel(n) {
  const level = makeLevel(n);
  cur = { n, level, world: new World(level), stat: buildStatic(level), over: false, paused: false, acc: 0, last: performance.now(), clock: 0 };
  active = 'fire';
  $('lvName').textContent = `Level ${n}`;
  $('overlay').hidden = true;
  $('pauseBox').hidden = true;
  show('play');
  updateHud();
  syncTouch();
  actx && actx.state === 'suspended' && actx.resume();
}
const restart = () => cur && startLevel(cur.n);

function readInput() {
  const k = (c) => keys.has(c);
  const fire = { l: k('ArrowLeft') || touch.fire.l, r: k('ArrowRight') || touch.fire.r, u: k('ArrowUp') || touch.fire.u };
  const water = { l: k('KeyA') || touch.water.l, r: k('KeyD') || touch.water.r, u: k('KeyW') || touch.water.u };
  if (mode === 'one') {
    const m = { l: fire.l || water.l, r: fire.r || water.r, u: fire.u || water.u };
    const idle = { l: false, r: false, u: false };
    return active === 'fire' ? { fire: m, water: idle } : { fire: idle, water: m };
  }
  return { fire, water };
}

function updateHud() {
  if (!cur) return;
  const w = cur.world;
  $('clock').textContent = fmt(w.t);
  $('gemRed').textContent = `${w.gemsGot.red}/${w.gemsTotal.red}`;
  $('gemBlue').textContent = `${w.gemsGot.blue}/${w.gemsTotal.blue}`;
  $('who').textContent = mode === 'one' ? (active === 'fire' ? 'Vuur' : 'Water') : '';
}

function finish() {
  const w = cur.world;
  cur.over = true;
  const ov = $('overlay');
  ov.hidden = false;
  if (w.state === 'won') {
    SFX.win();
    const t = Math.round(w.t * 100) / 100;
    const prev = P.done[cur.n];
    const best = !prev || t < prev.time;
    P.done[cur.n] = { time: best ? t : prev.time, red: Math.max(prev ? prev.red : 0, w.gemsGot.red), blue: Math.max(prev ? prev.blue : 0, w.gemsGot.blue) };
    if ((prev && prev.all) || (w.gemsGot.red === w.gemsTotal.red && w.gemsGot.blue === w.gemsTotal.blue)) P.done[cur.n].all = true;
    save();
    submitTime(GAME_ID, 'l' + cur.n, t);
    $('ovTitle').textContent = 'Level gehaald!';
    $('ovText').innerHTML = `Tijd <b>${fmt(w.t)}</b> · rode stenen <b>${w.gemsGot.red}/${w.gemsTotal.red}</b> · blauwe stenen <b>${w.gemsGot.blue}/${w.gemsTotal.blue}</b>${best && prev ? '<br>Nieuw record!' : ''}`;
    $('ovNext').hidden = cur.n >= LEVEL_COUNT;
  } else {
    $('ovTitle').textContent = 'Oei!';
    $('ovText').textContent = w.reason === 'goo' ? 'Groene smurrie is voor niemand veilig.' : w.reason === 'water' ? 'Water blust Vuur-Te-Un.' : 'Lava is te heet voor Water-Te-Un.';
    $('ovNext').hidden = true;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!cur || $('play').hidden) return;
  const dt = Math.min(0.05, (now - cur.last) / 1000);
  cur.last = now;
  const w = cur.world;
  if (!cur.paused && !cur.over && w.state === 'play') {
    cur.acc += dt;
    const input = readInput();
    while (cur.acc >= 1 / 120) { w.step(1 / 120, input); cur.acc -= 1 / 120; }
    for (const ev of w.events.splice(0)) if (SFX[ev]) SFX[ev]();
    updateHud();
    if (w.state !== 'play') setTimeout(finish, w.state === 'won' ? 500 : 650);
  }
  drawScene(g2, cur.level, w, cur.stat, now / 1000);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- bediening
const GAMEKEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'Tab']);
window.addEventListener('keydown', (e) => {
  if ($('play').hidden || e.ctrlKey || e.metaKey) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (GAMEKEYS.has(e.code)) e.preventDefault();
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyR') { restart(); return; }
  if (GAMEKEYS.has(e.code) && document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  if ((e.code === 'Space' || e.code === 'Tab' || e.code === 'KeyQ') && !e.repeat) {
    // met twee spelers is er niets te wisselen: de spatiebalk schakelt dan over naar 1 speler
    if (mode === 'two') mode = 'one'; else active = active === 'fire' ? 'water' : 'fire';
    syncTouch(); updateHud();
  }
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());

function togglePause(force) {
  if (!cur || cur.over) return;
  cur.paused = force === undefined ? !cur.paused : force;
  $('pauseBox').hidden = !cur.paused;
}
function syncTouch() {
  document.body.classList.toggle('one', mode === 'one');
  $('modeBtn').textContent = mode === 'one' ? '1 speler' : '2 spelers';
  $('swap').classList.toggle('fire', active === 'fire');
  $('swap').classList.toggle('water', active === 'water');
  $('swap').textContent = active === 'fire' ? 'Vuur' : 'Water';
}
$('modeBtn').addEventListener('click', () => { mode = mode === 'one' ? 'two' : 'one'; syncTouch(); $('modeBtn').blur(); });
$('swap').addEventListener('click', () => { active = active === 'fire' ? 'water' : 'fire'; syncTouch(); });

// schermknoppen: [pad][knop] -> welk poppetje (in 1-spelermodus altijd de linkerpad voor beiden)
document.querySelectorAll('.pad button').forEach((b) => {
  const [who, dir] = b.dataset.k.split('-');
  const set = (v) => (e) => { e.preventDefault(); touch[who][dir] = v ? 1 : 0; b.classList.toggle('on', !!v); };
  b.addEventListener('pointerdown', set(true));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});

$('back').addEventListener('click', () => { cur = null; renderMenu(); show('menu'); });
$('restart').addEventListener('click', restart);
$('pauseBtn').addEventListener('click', () => togglePause());
$('resume').addEventListener('click', () => togglePause(false));
$('pRestart').addEventListener('click', restart);
$('pMenu').addEventListener('click', () => $('back').click());
$('ovRetry').addEventListener('click', restart);
$('ovMenu').addEventListener('click', () => $('back').click());
$('ovNext').addEventListener('click', () => startLevel(cur.n + 1));
$('mNumbers').addEventListener('click', () => { P.numbers = !P.numbers; save(true); renderMenu(); });
$('mBack').addEventListener('click', () => { if (window.parent !== window) { try { window.parent.postMessage({ type: 'teun:close', game: GAME_ID }, location.origin); } catch (e) { /* geen ouder */ } } else location.href = '/'; });
const boardLevels = Array.from({ length: LEVEL_COUNT }, (_, i) => ({ key: 'l' + (i + 1), label: 'Level ' + (i + 1) }));
const openBoard = (start) => openTimeBoard({ game: GAME_ID, title: 'VuurTe-Un & WaterTe-Un', levels: boardLevels, start });
$('mBoard').addEventListener('click', () => openBoard('l1'));
$('ovBoard').addEventListener('click', () => openBoard('l' + (cur ? cur.n : 1)));

// ---------------------------------------------------------------- start
renderMenu();
show('menu');
syncTouch();
initTutorial({
  id: GAME_ID, title: 'VuurTe-Un & WaterTe-Un',
  steps: [
    { icon: '🔥💧', title: 'Twee kabouters, één team', lines: ['Je bestuurt <b>VuurTe-Un</b> (rood) en <b>WaterTe-Un</b> (blauw) tegelijk. Breng ze allebei naar hun eigen <b>deur</b> met het vlam- of druppelsymbool. Dan ben je klaar.'] },
    { icon: '⌨️', title: 'Besturing', lines: ['<b>VuurTe-Un:</b> <kbd>←</kbd> <kbd>→</kbd> lopen, <kbd>↑</kbd> springen.', '<b>WaterTe-Un:</b> <kbd>A</kbd> <kbd>D</kbd> lopen, <kbd>W</kbd> springen.', 'Alleen of op een telefoon? Kies <b>1 speler</b>: je bestuurt één kabouter en wisselt met <kbd>Spatie</kbd> of de wisselknop.'] },
    { icon: '☠️', title: 'Pas op voor plassen', lines: ['<b>Lava</b> (oranje) is dodelijk voor WaterTe-Un, <b>water</b> (blauw) voor VuurTe-Un en <b>groene smurrie</b> voor allebei. Over je eigen kleur kun je veilig lopen.'] },
    { icon: '💎', title: 'Stenen, knoppen en hendels', lines: ['Rode stenen zijn voor VuurTe-Un, blauwe voor WaterTe-Un. Knoppen en hendels openen gekleurde poorten: laat de ander erdoor terwijl jij op de knop staat.', '<kbd>R</kbd> start het level opnieuw, <kbd>Esc</kbd> pauzeert.'] },
  ],
});
initDev([
  { label: 'Alle levels openen', run: () => { P.dev = true; save(); renderMenu(); return 'Alle levels open'; } },
  { label: 'Profielfoto krijgen (alle diamanten als verzameld markeren)', run: () => { for (let i = 1; i <= LEVEL_COUNT; i++) P.done[i] = Object.assign({ time: 60, red: 0, blue: 0 }, P.done[i], { all: true }); save(); renderMenu(); return 'Alle diamanten verzameld'; } },
  { label: 'Alle levels als gehaald markeren', run: () => { for (let i = 1; i <= LEVEL_COUNT; i++) P.done[i] = P.done[i] || { time: 60, red: 0, blue: 0 }; save(); renderMenu(); return 'Alles gehaald'; } },
]);
post('teun:ready');

// uitleg of developer-paneel open: het spel staat stil
window.addEventListener('teun:pause', () => { if (cur && !cur.over) cur.paused = true; });
window.addEventListener('teun:resume', () => { if (cur && !$('pauseBox').hidden === false) cur.paused = false; });

// voor tests
window.__vw = { get cur() { return cur; }, startLevel };
