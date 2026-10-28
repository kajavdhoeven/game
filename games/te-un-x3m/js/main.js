// Te-Un X3M: menu, spelverloop, opslaan en koppeling met het platform.
import { makeLevel, LEVEL_COUNT, ceilAt } from './levels.js';
import { Terrain, makeBike, stepBike, crashTest, VEH, VEH_ORDER, headPos, G } from './sim.js';
import { Renderer, CHARS, CHAR_ORDER, limpPose } from './draw.js';

const GAME_ID = 'te-un-x3m';
const $ = (id) => document.getElementById(id);
const UNLOCK = { orange: 5, green: 10, gold: 20 }; // personage -> level dat je moet halen

// ---------------------------------------------------------------- opslaan
const KEY = 'teun-x3m-v1';
let P = { stars: {}, best: {}, owned: { fatbike: 1 }, veh: 'fatbike', char: 'teun', spent: 0, dev: false, updatedAt: 0 };
try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* geen opslag */ }
const post = (type, extra = {}) => {
  if (window.parent === window) return;
  try { window.parent.postMessage({ type, game: GAME_ID, ...extra }, location.origin); } catch (e) { /* geen ouder */ }
};
const snapshot = () => ({ stars: P.stars, best: P.best, owned: P.owned, veh: P.veh, char: P.char, spent: P.spent, dev: P.dev, updatedAt: P.updatedAt });
let saveTimer = null;
function save(quiet) {
  if (!quiet) P.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) { /* geen opslag */ }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => post('teun:save', { data: snapshot() }), 600);
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const m = e.data;
  if (!m || m.game !== GAME_ID) return;
  if (m.type === 'teun:progress' && m.data) {
    const d = m.data;
    if ((d.updatedAt || 0) > (P.updatedAt || 0)) { Object.assign(P, d); save(true); refreshAll(); }
    else if ((d.updatedAt || 0) < (P.updatedAt || 0)) post('teun:save', { data: snapshot() });
  }
});
const totalStars = () => Object.values(P.stars).reduce((a, b) => a + b, 0);
const freeStars = () => totalStars() + (P.dev ? 100 : 0) - P.spent;
const levelOpen = (n) => n === 1 || P.dev || (P.stars[n - 1] || 0) > 0;
const charOpen = (id) => !UNLOCK[id] || P.dev || (P.stars[UNLOCK[id]] || 0) > 0;
const fmt = (t) => t.toFixed(2).padStart(5, '0');

function toast(t, ms = 2400) {
  const el = $('toast'); el.textContent = t; el.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), ms);
}

// ---------------------------------------------------------------- geluid
let actx = null, master = null, eng = null, soundOn = true;
function audio() {
  if (actx) return actx;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
    const o = actx.createOscillator(), o2 = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(); o2.start();
    eng = { o, o2, g, f };
  } catch (e) { actx = null; }
  return actx;
}
function beep(freq, dur, type = 'triangle', vol = 0.2, when = 0, slide = 0) {
  if (!audio() || !soundOn) return;
  const t = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
}
function noise(dur, vol = 0.3) {
  if (!audio() || !soundOn) return;
  const n = actx.sampleRate * dur, buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = vol;
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start();
}
function engine(speed, gas, vid, on) {
  if (!eng) return;
  const t = actx.currentTime, run = on && soundOn;
  const base = vid === 'vape' ? 90 : vid === 'motor' ? 55 : 40;
  const f = base + speed * (vid === 'vape' ? 5 : vid === 'motor' ? 7 : 4) + (gas ? 14 : 0);
  eng.o.frequency.setTargetAtTime(f, t, 0.05); eng.o2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
  eng.f.frequency.setTargetAtTime(vid === 'vape' ? 1400 : 350 + speed * 40 + (gas ? 300 : 0), t, 0.05);
  eng.g.gain.setTargetAtTime(run ? (vid === 'fatbike' ? 0.02 : 0.05) + (gas ? 0.03 : 0) : 0, t, 0.08);
}

// ---------------------------------------------------------------- spel
const canvas = $('game');
const R = new Renderer(canvas);
const NOINP = { gas: false, brake: false, left: false, right: false };
const keys = { gas: false, brake: false, left: false, right: false };
const touch = { gas: false, brake: false, left: false, right: false };
const levelCache = {};
const getLevel = (n) => levelCache[n] || (levelCache[n] = makeLevel(n));
let screen = 'menu';
let g = null;
let paused = false;
let hintT = 0;

function startLevel(n) {
  const level = getLevel(n);
  const V = VEH[P.veh];
  const sy = V.fly ? 1.2 : V.r + 0.45;
  g = {
    n, level, terr: new Terrain(level.pts), bike: makeBike(P.veh, level.startX, sy), character: P.char,
    time: 0, tl: 0, state: 'ready', crashT: 0, rag: null, rider: null, over: false, paused: false,
    cam: { x: level.startX + 3, y: 2, shake: 0 }, input: { ...NOINP }, dt: 1 / 60, rs: { lean: 0 },
  };
  R.parts.length = 0;
  setScreen('play');
  paused = false;
  $('hudLevel').textContent = '#' + n;
  $('hudTime').textContent = '00.00';
  hintT = n <= 2 ? 6 : 2.5;
  $('hint').classList.remove('off');
}

function setScreen(s) {
  screen = s;
  $('menu').hidden = s !== 'menu';
  $('levels').hidden = s !== 'levels';
  $('garage').hidden = s !== 'garage';
  $('hud').hidden = s !== 'play';
  const tc = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  $('touch').hidden = !(s === 'play' && tc);
  $('devCorner').hidden = s === 'play';
  $('pause').hidden = true; $('end').hidden = true;
  if (s !== 'play') engine(0, false, 'fatbike', false);
  if (s === 'menu') refreshMenu();
  if (s === 'levels') renderLevels();
  if (s === 'garage') renderGarage();
  $('rotate').hidden = !(s === 'play' && innerHeight > innerWidth);
}

function doCrash(reason) {
  const b = g.bike;
  g.state = 'crashed'; g.crashT = 0; b.crash = reason;
  const [hx, hy] = headPos(b);
  g.rag = { x: hx, y: hy, vx: b.vx * 0.9 + (Math.random() - 0.3) * 3, vy: b.vy + 3 + Math.random() * 3, ang: b.a, w: -b.vx * 0.4 + (Math.random() - 0.5) * 6, seed: Math.random() * 6 };
  g.cam.shake = 0.5;
  noise(0.5, 0.45); beep(160, 0.4, 'sawtooth', 0.2, 0, -100);
  for (let i = 0; i < 26; i++) R.emit('spark', hx, hy, (Math.random() - 0.5) * 9, Math.random() * 8, 0.6 + Math.random() * 0.5, 0.07, ['#ffd54a', '#ff7a1a', '#fff'][i % 3]);
  engine(0, false, b.vid, false);
}

function finishLevel() {
  g.state = 'done'; g.over = true;
  const V = VEH[g.bike.vid];
  const par = g.level.par * V.parMul;
  const t = g.tl;
  const stars = t <= par ? 3 : t <= par * 1.3 ? 2 : 1;
  const prevStars = P.stars[g.n] || 0;
  const wasChar = Object.fromEntries(Object.keys(UNLOCK).map((k) => [k, charOpen(k)]));
  if (stars > prevStars) P.stars[g.n] = stars;
  if (!P.best[g.n] || t < P.best[g.n]) P.best[g.n] = Math.round(t * 100) / 100;
  save();
  beep(523, 0.25, 'triangle', 0.22); beep(659, 0.25, 'triangle', 0.22, 0.14); beep(784, 0.25, 'triangle', 0.22, 0.28); beep(1047, 0.5, 'triangle', 0.24, 0.42);
  setTimeout(() => {
    if (screen !== 'play') return;
    $('eTitle').textContent = `Level ${g.n} klaar!`;
    const box = $('eStars'); box.innerHTML = '';
    for (let i = 0; i < 3; i++) { const s = document.createElement('i'); s.textContent = '★'; s.className = i < stars ? 'on' : ''; s.style.animationDelay = i * 0.2 + 's'; box.appendChild(s); }
    const best = P.best[g.n];
    $('eText').textContent = `Tijd ${t.toFixed(2)} s${t <= best + 0.001 && best < (prevStars ? best + 1 : 0) ? '' : ''}  ·  Record ${best.toFixed(2)} s`;
    const ul = [];
    for (const [id, lv] of Object.entries(UNLOCK)) if (!wasChar[id] && charOpen(id)) ul.push(`Nieuw personage vrijgespeeld: ${CHARS[id].name}!`);
    if (stars > prevStars) { const gain = stars - prevStars; ul.push(`+${gain} ${gain === 1 ? 'ster' : 'sterren'} voor de garage (${freeStars()} beschikbaar)`); }
    $('eUnlock').hidden = !ul.length; $('eUnlock').innerHTML = ul.join('<br>');
    $('eNext').hidden = g.n >= LEVEL_COUNT;
    $('end').hidden = false;
  }, 900);
}

function anyInput() { const i = g.input; return i.gas || i.brake || i.left || i.right; }

function update(dt) {
  g.time += dt; g.dt = dt;
  g.input = { gas: keys.gas || touch.gas, brake: keys.brake || touch.brake, left: keys.left || touch.left, right: keys.right || touch.right };
  const b = g.bike;
  if (g.state === 'ready' && anyInput()) g.state = 'run';
  const active = g.state !== 'ready';
  const inp = g.state === 'run' || g.state === 'done' ? (g.state === 'done' ? NOINP : g.input) : NOINP;
  if (active || true) {
    const n = 8;
    for (let i = 0; i < n; i++) stepBike(b, g.terr, g.state === 'ready' ? NOINP : inp, dt / n);
  }
  // de vape botst zacht tegen het plafond
  if (VEH[b.vid].fly && !b.crash) {
    const ceilY = ceilAt(g.level, b.x) - 1.5;
    if (b.y > ceilY) { b.y = ceilY; if (b.vy > 0) b.vy = 0; }
  }
  b.crank += b.spin[0] * dt * 0.35;
  b._dt = dt;
  if (g.state === 'run') {
    g.tl += dt;
    const why = crashTest(b, g.terr, g.level, g.time);
    if (why) doCrash(why);
    else if (b.x > g.level.finishX) finishLevel();
  }
  if (g.state === 'crashed') {
    g.crashT += dt;
    if (g.crashT > 1.5) { startLevel(g.n); return; }
  }
  // uitgeschakelde bestuurder
  if (g.rag) {
    const r = g.rag;
    r.vy -= G * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.ang += r.w * dt;
    const q = g.terr.query(r.x, r.y - 0.1, 0.35);
    if (q) {
      r.x += q.nx * q.pen; r.y += q.ny * q.pen;
      const vn = r.vx * q.nx + r.vy * q.ny;
      if (vn < 0) { r.vx -= (1.25) * vn * q.nx; r.vy -= (1.25) * vn * q.ny; }
      r.vx *= 0.96; r.w *= 0.97;
    }
    g.rider = limpPose(r, g.time);
  }
  // geluid en camera
  engine(Math.hypot(b.vx, b.vy), g.input.gas && g.state === 'run', b.vid, g.state === 'run' && !paused);
  const cam = g.cam, tx = b.x + Math.max(-2, Math.min(5, b.vx * 0.38)), ty = b.y + 1.1;
  const k = Math.min(1, dt * 5);
  cam.x += (tx - cam.x) * k; cam.y += (ty - cam.y) * Math.min(1, dt * 3.5);
  cam.shake = Math.max(0, cam.shake - dt);
  if (g.state === 'run') $('hudTime').textContent = fmt(g.tl);
  if (hintT > 0 && g.state === 'run') { hintT -= dt; if (hintT <= 0) $('hint').classList.add('off'); }
  R.stepParts(dt);
}

// ---------------------------------------------------------------- menu's
function refreshMenu() { $('mStars').textContent = `★ ${freeStars()} sterren`; }
function renderLevels() {
  $('lStars').textContent = `★ ${freeStars()}`;
  const grid = $('lGrid'); grid.innerHTML = '';
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const b = document.createElement('button');
    b.className = 'lvl ' + getLevel(n).theme.id;
    const s = P.stars[n] || 0;
    b.innerHTML = `${n}<small>${[0, 1, 2].map((i) => `<span class="${i < s ? 'on' : ''}">★</span>`).join('')}</small>`;
    b.querySelectorAll('span').forEach((x) => { x.style.color = x.className ? '#ff9f1c' : '#b07a00'; });
    b.disabled = !levelOpen(n);
    b.addEventListener('click', () => { audio(); startLevel(n); });
    grid.appendChild(b);
  }
}
let previews = [];
function renderGarage() {
  $('gStars').textContent = `★ ${freeStars()}`;
  previews = [];
  const vb = $('gVeh'); vb.innerHTML = '';
  VEH_ORDER.forEach((id) => {
    const V = VEH[id], owned = !!P.owned[id];
    const el = document.createElement('div');
    el.className = 'vcard' + (P.veh === id ? ' on' : '');
    el.innerHTML = `<canvas></canvas><b>${V.name}</b><small>${V.desc}</small>`;
    const btn = document.createElement('button');
    btn.className = 'small';
    if (!owned) { btn.textContent = `Koop voor ★ ${V.price}`; btn.disabled = freeStars() < V.price; }
    else btn.textContent = P.veh === id ? 'Geselecteerd' : 'Kies';
    btn.disabled = btn.disabled || P.veh === id;
    btn.addEventListener('click', () => {
      if (!P.owned[id]) { if (freeStars() < V.price) return; P.spent += V.price; P.owned[id] = 1; toast(`${V.name} gekocht!`); beep(880, 0.2); }
      P.veh = id; save(); renderGarage();
    });
    el.appendChild(btn); vb.appendChild(el);
    previews.push({ cv: el.querySelector('canvas'), vid: id, ch: P.char });
  });
  const cb = $('gChar'); cb.innerHTML = '';
  CHAR_ORDER.forEach((id) => {
    const open = charOpen(id);
    const el = document.createElement('div');
    el.className = 'vcard' + (P.char === id ? ' on' : '');
    el.innerHTML = `<canvas></canvas><b>${CHARS[id].name}</b><small>${open ? 'Beschikbaar' : `Haal level ${UNLOCK[id]} om hem vrij te spelen`}</small>`;
    const btn = document.createElement('button');
    btn.className = 'small'; btn.textContent = !open ? 'Vergrendeld' : P.char === id ? 'Geselecteerd' : 'Kies';
    btn.disabled = !open || P.char === id;
    btn.addEventListener('click', () => { P.char = id; save(); renderGarage(); });
    el.appendChild(btn); cb.appendChild(el);
    previews.push({ cv: el.querySelector('canvas'), vid: 'fatbike', ch: id, locked: !open });
  });
  previews.forEach((p) => { p.r = new Renderer(p.cv); });
}
function refreshAll() {
  if (screen === 'menu') refreshMenu();
  else if (screen === 'levels') renderLevels();
  else if (screen === 'garage') renderGarage();
}

// ---------------------------------------------------------------- invoer
const KEYMAP = { ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowDown: 'brake', s: 'brake', S: 'brake', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (k && screen === 'play') { keys[k] = true; e.preventDefault(); audio(); return; }
  if (screen !== 'play') return;
  if (e.key === 'r' || e.key === 'R' || e.key === 'z' || e.key === 'Z') { startLevel(g.n); e.preventDefault(); }
  else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') setPaused(!paused);
  else if (e.key === 'Enter' && g.state === 'done' && g.n < LEVEL_COUNT) startLevel(g.n + 1);
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in touch) touch[k] = false; if (screen === 'play' && g && g.state === 'run') setPaused(true); });
document.querySelectorAll('#touch button').forEach((b) => {
  const k = b.dataset.k;
  const on = (v) => (e) => { e.preventDefault(); touch[k] = v; b.classList.toggle('on', v); audio(); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); on(true)(e); });
  b.addEventListener('pointerup', on(false)); b.addEventListener('pointercancel', on(false));
});
function setPaused(v) {
  if (screen !== 'play' || !g || g.over) return;
  paused = v; $('pause').hidden = !v;
  if (v) engine(0, false, g.bike.vid, false);
}
$('btnPause').addEventListener('click', () => setPaused(true));
$('pResume').addEventListener('click', () => setPaused(false));
$('pRetry').addEventListener('click', () => startLevel(g.n));
$('pMenu').addEventListener('click', () => setScreen('levels'));
$('btnSound').addEventListener('click', () => { soundOn = !soundOn; $('btnSound').textContent = soundOn ? '🔊' : '🔇'; if (!soundOn) engine(0, false, 'fatbike', false); });
$('mPlay').addEventListener('click', () => { audio(); setScreen('levels'); });
$('mGarage').addEventListener('click', () => { audio(); setScreen('garage'); });
$('lBack').addEventListener('click', () => setScreen('menu'));
$('gBack').addEventListener('click', () => setScreen('menu'));
$('eMenu').addEventListener('click', () => setScreen('levels'));
$('eRetry').addEventListener('click', () => startLevel(g.n));
$('eNext').addEventListener('click', () => startLevel(g.n + 1));
addEventListener('resize', () => { R.resize(); $('rotate').hidden = !(screen === 'play' && innerHeight > innerWidth); });

// ontwikkelaarstruc: 3x snel tikken linksboven = 100 sterren en alles open
{
  let n = 0, t = 0;
  addEventListener('pointerdown', (e) => {
    if (e.clientX > 80 || e.clientY > 80 || screen === 'play') return;
    const now = performance.now(); n = now - t > 1800 ? 1 : n + 1; t = now;
    if (n >= 3) { n = 0; P.dev = true; save(); refreshAll(); toast('Developer: alles open + 100 sterren', 2600); }
  }, true);
}

// ---------------------------------------------------------------- hoofdlus
let last = performance.now(), acc = 0;
function frame(ts) {
  const dt = Math.min(0.05, (ts - last) / 1000);
  last = ts;
  if (screen === 'play' && g) {
    if (!paused) {
      acc += dt;
      let n = 0;
      while (acc >= 1 / 60 && n++ < 4) { update(1 / 60); acc -= 1 / 60; if (screen !== 'play' || !g) break; }
      if (screen === 'play' && g) {
        const sh = g.cam.shake;
        const cam = g.cam;
        const save_ = { x: cam.x, y: cam.y };
        if (sh > 0) { cam.x += (Math.random() - 0.5) * sh * 0.6; cam.y += (Math.random() - 0.5) * sh * 0.6; }
        R.render(g);
        cam.x = save_.x; cam.y = save_.y;
      }
    } else R.render(g);
  } else if (screen === 'garage') {
    for (const p of previews) { try { p.r.preview(p.vid, p.ch, ts / 1000, 3.2); } catch (e) { /* preview is niet kritiek */ } }
  } else {
    // menu en levels: rustige achtergrond met een rijdende fatbike
    const t = ts / 1000;
    R.resize;
    const ctx = R.ctx; ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    const gr = ctx.createLinearGradient(0, 0, 0, R.H); gr.addColorStop(0, '#2a1d12'); gr.addColorStop(1, '#0c0805');
    ctx.fillStyle = gr; ctx.fillRect(0, 0, R.W, R.H);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.__x3m = { get g() { return g; }, P, startLevel, getLevel, setPaused, keys, get R() { return R; } };
setScreen('menu');
post('teun:ready');
