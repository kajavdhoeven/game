// Te-Un Drive: menu, spelverloop, 3D-weergave en opslag.
import * as THREE from 'three';
import { makeLevel, LEVEL_COUNT } from './levels.js';
import { Terrain, makeCar, stepCar, crashTest, CARS, CAR_ORDER, moverSegs, updateLatch } from './sim.js';
import { buildWorld } from './world.js';
import { createCar } from './cars3d.js';
import { initDev, setDevVisible } from '/js/devmode.js';
import { initTutorial } from '/js/tutorial.js';

const GAME_ID = 'te-un-drive';
const $ = (id) => document.getElementById(id);

// ---------------------------------------------------------------- opslaan
const KEY = 'teun-drive-v1';
let P = { done: {}, car: 'bike', dev: false, updatedAt: 0 };
try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* geen opslag */ }
const snapshot = () => ({ done: P.done, car: P.car, dev: P.dev, updatedAt: P.updatedAt });
const post = (type, extra = {}) => {
  if (window.parent === window) return;
  try { window.parent.postMessage({ type, game: GAME_ID, ...extra }, location.origin); } catch (e) { /* geen ouder */ }
};
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
if (!CARS[P.car]) P.car = 'bike';
const levelOpen = (n) => n === 1 || P.dev || !!P.done[n - 1];
const carOpen = (id) => CARS[id].unlock <= 1 || P.dev || !!P.done[CARS[id].unlock];
const prizeLevels = { 5: 'truck', 15: 'gold', 20: 'gnome' };
const fmt = (t) => t.toFixed(1);

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
    const o = actx.createOscillator(), g = actx.createGain(), f = actx.createBiquadFilter();
    o.type = 'sawtooth'; f.type = 'lowpass'; f.frequency.value = 500; g.gain.value = 0;
    o.connect(f); f.connect(g); g.connect(master); o.start();
    eng = { o, g, f };
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
function splashSound(vol = 0.4) {
  if (!audio() || !soundOn) return;
  const n = actx.sampleRate * 0.5, buf = actx.createBuffer(1, n, actx.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
  f.type = 'lowpass'; f.frequency.value = 1400; g.gain.value = vol;
  s.buffer = buf; s.connect(f); f.connect(g); g.connect(master); s.start();
}
function engine(speed, gas, on) {
  if (!eng) return;
  const t = actx.currentTime;
  eng.o.frequency.setTargetAtTime(45 + speed * 6 + (gas ? 16 : 0), t, 0.06);
  eng.f.frequency.setTargetAtTime(300 + speed * 35 + (gas ? 250 : 0), t, 0.06);
  eng.g.gain.setTargetAtTime(on && soundOn ? 0.035 + (gas ? 0.03 : 0) : 0, t, 0.1);
}

// ---------------------------------------------------------------- 3D
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color('#4cc3ff');
scene.fog = new THREE.Fog('#7fd6ff', 70, 150);
scene.add(new THREE.HemisphereLight('#ffffff', '#6fa8d8', 1.5));
const sun = new THREE.DirectionalLight('#ffffff', 1.5);
sun.position.set(-8, 16, 14);
scene.add(sun);
const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  camDist = Math.max(16 / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect), 8 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
let camDist = 60;

// deeltjes: stof, spetters, regenboog
const PN = 140;
const pgeo = new THREE.BoxGeometry(1, 1, 1);
const parts = new THREE.InstancedMesh(pgeo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), PN);
parts.frustumCulled = false;
scene.add(parts);
const plist = [];
const _m = new THREE.Matrix4(), _c = new THREE.Color();
function emit(x, y, z, vx, vy, life, size, color) { if (plist.length < PN) plist.push({ x, y, z, vx, vy, vz: (Math.random() - 0.5) * 2, life, max: life, size, color }); }
function stepParts(dt) {
  for (let i = plist.length - 1; i >= 0; i--) {
    const p = plist[i];
    p.life -= dt;
    if (p.life <= 0) { plist.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vy -= 6 * dt;
  }
  for (let i = 0; i < PN; i++) {
    const p = plist[i];
    if (!p) { _m.makeScale(0, 0, 0); parts.setMatrixAt(i, _m); continue; }
    const f = p.life / p.max, s = p.size * (0.4 + f);
    _m.makeScale(s, s, s); _m.setPosition(p.x, p.y, p.z);
    parts.setMatrixAt(i, _m);
    _c.set(p.color); parts.setColorAt(i, _c);
  }
  parts.instanceMatrix.needsUpdate = true;
  if (parts.instanceColor) parts.instanceColor.needsUpdate = true;
}

// ---------------------------------------------------------------- spel
const NOINP = { gas: false, brake: false };
const keys = { gas: false, brake: false };
const touch = { gas: false, brake: false };
let screen = 'menu';
let g = null, paused = false, hintT = 0;

function startLevel(n) {
  if (g) { scene.remove(g.world.root); g.world.dispose(); scene.remove(g.car3d.root); }
  const level = makeLevel(n);
  const id = carOpen(P.car) ? P.car : 'bike';
  const car = makeCar(id, level.startX, CARS[id].r + 0.8);
  const world = buildWorld(level);
  scene.add(world.root);
  const car3d = createCar(id);
  scene.add(car3d.root);
  g = { n, level, terr: new Terrain([level.main, ...level.planks]), car, car3d, world, state: 'ready', t: 0, tl: 0, latched: {}, crashT: 0, cam: { x: car.x + 4, y: car.y + 1.5, shake: 0 }, input: { ...NOINP } };
  plist.length = 0;
  setScreen('play');
  paused = false;
  $('hudLevel').textContent = `Level ${n}`;
  $('hudTime').textContent = '0.0';
  $('hermano').hidden = id !== 'bike';
  hintT = n <= 2 ? 7 : 2.5;
  $('hint').classList.remove('off');
  place();
}

function setScreen(s) {
  screen = s;
  setDevVisible(s !== 'play');
  $('menu').hidden = s !== 'menu';
  $('levels').hidden = s !== 'levels';
  $('garage').hidden = s !== 'garage';
  $('hud').hidden = s !== 'play';
  const tc = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  $('touch').hidden = !(s === 'play' && tc);
  $('pause').hidden = true; $('end').hidden = true;
  canvas.style.visibility = s === 'play' ? 'visible' : 'hidden';
  if (s !== 'play') engine(0, false, false);
  if (s === 'levels') renderLevels();
  if (s === 'garage') renderGarage();
}

function crash(reason) {
  g.state = 'crashed'; g.crashT = 0; g.car.crash = reason; g.cam.shake = 0.5;
  const c = g.car;
  if (reason === 'water') {
    splashSound();
    for (let i = 0; i < 40; i++) emit(c.x, c.y - 0.5, 0, (Math.random() - 0.5) * 8, 4 + Math.random() * 8, 0.9, 0.35, '#c9f4ff');
  } else {
    splashSound(0.3); beep(140, 0.35, 'sawtooth', 0.2, 0, -90);
    for (let i = 0; i < 30; i++) emit(c.x, c.y, 0, (Math.random() - 0.5) * 9, Math.random() * 8, 0.7, 0.3, ['#ffd23a', '#ff7a1a', '#ffffff'][i % 3]);
  }
  engine(0, false, false);
}
function finishLevel() {
  g.state = 'done';
  const first = !P.done[g.n];
  P.done[g.n] = Math.min(P.done[g.n] || 1e9, Math.round(g.tl * 10) / 10);
  save();
  [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.3, 'triangle', 0.22, i * 0.13));
  setTimeout(() => {
    if (screen !== 'play') return;
    $('eTitle').textContent = `Level ${g.n} klaar!`;
    $('eText').textContent = `Tijd: ${fmt(g.tl)} s  ·  Record: ${fmt(P.done[g.n])} s`;
    const ul = [];
    if (first && prizeLevels[g.n]) ul.push(`Nieuwe auto vrijgespeeld: ${CARS[prizeLevels[g.n]].name}!`);
    $('eUnlock').hidden = !ul.length; $('eUnlock').innerHTML = ul.join('<br>');
    $('eNext').hidden = g.n >= LEVEL_COUNT;
    $('end').hidden = false;
  }, 900);
}

function update(dt) {
  g.t += dt;
  g.input = { gas: keys.gas || touch.gas, brake: keys.brake || touch.brake };
  const c = g.car;
  if (g.state === 'ready' && (g.input.gas || g.input.brake)) g.state = 'run';
  const inp = g.state === 'run' ? g.input : NOINP;
  g.terr.setDyn(moverSegs(g.level, g.t, g.latched));
  const lid = updateLatch(g.level, c, g.t, g.latched);
  if (lid !== null) { toast('Klik! Een brug schuift uit', 2200); beep(660, 0.12, 'square', 0.15); beep(880, 0.15, 'square', 0.15, 0.1); }
  for (let i = 0; i < 8; i++) stepCar(c, g.terr, g.state === 'ready' ? NOINP : inp, dt / 8);
  if (g.state === 'run') {
    g.tl += dt;
    const why = crashTest(c, g.terr, g.level);
    if (why) crash(why);
    else if (c.x > g.level.finishX) finishLevel();
    $('hudTime').textContent = fmt(g.tl);
  }
  if (g.state === 'crashed') { g.crashT += dt; if (g.crashT > 1.1) { startLevel(g.n); return; } }
  // deeltjes
  const V = CARS[c.id], sp = Math.hypot(c.vx, c.vy);
  if (g.state !== 'crashed') {
    for (let i = 0; i < 2; i++) if (c.ground[i] && sp > 3 && Math.random() < dt * 25) emit(c.x + (i ? 1 : -1) * V.wb / 2, c.y + V.wy - V.r + 0.1, 1.2, -c.vx * 0.2, 1 + Math.random(), 0.5, 0.35, '#e8f6ff');
    if (c.id === 'gold' && g.state === 'run' && Math.random() < dt * 90) emit(c.x - 2.0, c.y + 0.2 + Math.random() * 0.4, (Math.random() - 0.5) * 1.5, -c.vx * 0.2 - 2, 0.3, 0.9, 0.34, '#' + new THREE.Color().setHSL((g.t * 0.8 + Math.random() * 0.3) % 1, 1, 0.55).getHexString());
  }
  engine(sp, g.input.gas && g.state === 'run', g.state === 'run' && !paused);
  if (hintT > 0 && g.state === 'run') { hintT -= dt; if (hintT <= 0) $('hint').classList.add('off'); }
  stepParts(dt);
  // camera
  const cam = g.cam, tx = c.x + Math.max(-2, Math.min(6, c.vx * 0.4)), ty = c.y + 1.6;
  cam.x += (tx - cam.x) * Math.min(1, dt * 4); cam.y += (ty - cam.y) * Math.min(1, dt * 3);
  cam.shake = Math.max(0, cam.shake - dt);
  place();
  g.world.updateMovers(g.t, g.latched);
  g.world.waters.forEach((w, i) => { w.position.y += Math.sin(g.t * 3 + i) * 0.0015; });
  g.world.clouds.forEach((cl, i) => { cl.position.x += dt * (0.4 + (i % 3) * 0.2); });
}
function place() {
  const c = g.cam, sh = c.shake;
  const sx = sh ? (Math.random() - 0.5) * sh * 0.8 : 0, sy = sh ? (Math.random() - 0.5) * sh * 0.8 : 0;
  camera.position.set(c.x - 5 + sx, c.y + 6.5 + sy, camDist);
  camera.lookAt(c.x + 1.5 + sx, c.y + sy, 0);
  g.car3d.update(g.car, g.t);
  sun.position.set(c.x - 8, c.y + 16, 14);
  sun.target.position.set(c.x, c.y, 0);
}

// ---------------------------------------------------------------- menu's
function renderLevels() {
  const grid = $('lGrid'); grid.innerHTML = '';
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const b = document.createElement('button');
    b.className = 'lvl' + (P.done[n] ? ' done' : '') + (prizeLevels[n] ? ' prize' : '');
    b.innerHTML = `${n}<small>${P.done[n] ? fmt(P.done[n]) + ' s' : prizeLevels[n] ? 'prijs' : ''}</small>`;
    b.disabled = !levelOpen(n);
    b.addEventListener('click', () => { audio(); startLevel(n); });
    grid.appendChild(b);
  }
}
// kleine plaatjes van de auto's voor de garage
const previews = {};
function preview(id) {
  if (previews[id]) return previews[id];
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(420, 260);
  const sc = new THREE.Scene();
  sc.add(new THREE.HemisphereLight('#ffffff', '#8ab8e8', 1.6));
  const dl = new THREE.DirectionalLight('#ffffff', 1.4); dl.position.set(-4, 8, 6); sc.add(dl);
  const car = createCar(id);
  const m = makeCar(id, 0, 0);
  car.update(m, 0);
  sc.add(car.root);
  const cam = new THREE.PerspectiveCamera(30, 420 / 260, 0.1, 100);
  const k = id === 'bike' ? 0.62 : 0.8;
  cam.position.set(5.5 * k, 3.6 * k, 9.5 * k); cam.lookAt(0, 0.2, 0);
  r.render(sc, cam);
  previews[id] = r.domElement.toDataURL('image/png');
  r.dispose();
  return previews[id];
}
function renderGarage() {
  const box = $('gCars'); box.innerHTML = '';
  CAR_ORDER.forEach((id) => {
    const V = CARS[id], open = carOpen(id);
    const el = document.createElement('div');
    el.className = 'vcard' + (P.car === id ? ' on' : '');
    el.innerHTML = `<img alt="${V.name}" src="${preview(id)}" style="${open ? '' : 'filter:grayscale(1) brightness(.6)'}"><b>${V.name}</b><small>${open ? V.desc : `Haal level ${V.unlock} om hem vrij te spelen`}</small>`;
    const btn = document.createElement('button');
    btn.className = 'small'; btn.textContent = !open ? 'Vergrendeld' : P.car === id ? 'Geselecteerd' : 'Kies';
    btn.disabled = !open || P.car === id;
    btn.addEventListener('click', () => { P.car = id; save(); renderGarage(); });
    el.appendChild(btn); box.appendChild(el);
  });
}
function refreshAll() { if (screen === 'levels') renderLevels(); else if (screen === 'garage') renderGarage(); }

// ---------------------------------------------------------------- invoer
const KEYMAP = { ArrowRight: 'gas', d: 'gas', D: 'gas', ArrowUp: 'gas', w: 'gas', W: 'gas', ArrowLeft: 'brake', a: 'brake', A: 'brake', ArrowDown: 'brake', s: 'brake', S: 'brake' };
addEventListener('keydown', (e) => {
  const k = KEYMAP[e.key];
  if (k && screen === 'play') { keys[k] = true; e.preventDefault(); audio(); return; }
  if (screen !== 'play') return;
  if (e.key === 'r' || e.key === 'R') { startLevel(g.n); e.preventDefault(); }
  else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') setPaused(!paused);
  else if (e.key === 'Enter' && g.state === 'done' && g.n < LEVEL_COUNT) startLevel(g.n + 1);
});
addEventListener('keyup', (e) => { const k = KEYMAP[e.key]; if (k) keys[k] = false; });
addEventListener('blur', () => { keys.gas = keys.brake = touch.gas = touch.brake = false; if (screen === 'play' && g && g.state === 'run') setPaused(true); });
document.querySelectorAll('#touch button').forEach((b) => {
  const k = b.dataset.k;
  const on = (v) => (e) => { e.preventDefault(); touch[k] = v; b.classList.toggle('on', v); audio(); };
  b.addEventListener('pointerdown', (e) => { b.setPointerCapture(e.pointerId); on(true)(e); });
  b.addEventListener('pointerup', on(false)); b.addEventListener('pointercancel', on(false));
});
function setPaused(v) {
  if (screen !== 'play' || !g || g.state === 'done') return;
  paused = v; $('pause').hidden = !v;
  if (v) engine(0, false, false);
}
$('btnPause').addEventListener('click', () => setPaused(true));
$('pResume').addEventListener('click', () => setPaused(false));
$('pMenu').addEventListener('click', () => { paused = false; setScreen('menu'); });
// in de garage: meteen verder spelen met het volgende level dat nog niet gehaald is
$('gPlay').addEventListener('click', () => {
  audio();
  let n = 1;
  while (n < LEVEL_COUNT && P.done[n] && levelOpen(n + 1)) n++;
  startLevel(levelOpen(n) ? n : 1);
});
$('mPlay').addEventListener('click', () => { audio(); setScreen('levels'); });
$('mGarage').addEventListener('click', () => { audio(); setScreen('garage'); });
$('lBack').addEventListener('click', () => setScreen('menu'));
$('gBack').addEventListener('click', () => setScreen('menu'));
$('eMenu').addEventListener('click', () => setScreen('levels'));
$('eRetry').addEventListener('click', () => startLevel(g.n));
$('eNext').addEventListener('click', () => startLevel(g.n + 1));
addEventListener('resize', resize);
// ---- uitleg
initTutorial({
  id: 'te-un-drive', title: 'Te-Un Drive',
  steps: [
    { icon: '🚙', title: 'Rijd naar de finish', lines: ['Rij je blokkenauto over heuvels, trappen, houten bruggen en gaten naar de finishvlag. Elk level is net wat lastiger.'] },
    { icon: '🎮', title: 'Zo bestuur je', lines: ['<kbd>→</kbd> of <kbd>D</kbd>: gas &nbsp; <kbd>←</kbd> of <kbd>A</kbd>: remmen en achteruit', 'Niet te hard en niet te zacht: neem snelheid voor een sprong, maar blijf op je wielen.', 'Op een telefoon gebruik je de knoppen GAS en REM onderin beeld.'] },
    { icon: '🛞', title: 'In de lucht en wheelies', lines: ['Tijdens een sprong tilt <b>gas</b> de neus van je auto omhoog en duwt <b>rem</b> hem omlaag. Zo kom je netjes op je wielen terecht.', 'Zit je vast voor een obstakel? Rij eerst een stukje <b>achteruit</b> en geef dan <b>gas</b>: je doet een wheelie en komt er makkelijk overheen. Dat werkt met alle auto\'s behalve de tuinkabouterauto.'] },
    { icon: '💥', title: 'Wanneer ga je af?', lines: ['Je verliest als je op je dak landt, in het water valt of op spijkers rijdt. Dan begin je meteen opnieuw. Met <kbd>R</kbd> start je zelf opnieuw.'] },
    { icon: '🛠️', title: 'Bruggen en bewegende delen', lines: ['Soms vaar je met een <b>veerboot</b> over het water: wacht tot hij bij je is, rij er rustig op, blijf in het midden staan en rij er aan de overkant af. Soms ligt er een <b>rode knop</b>: rij erover heen en een <b>brug schuift uit</b> over het water.'] },
    { icon: '🎁', title: 'Nieuwe auto\'s', lines: ['Je begint met <b>Hermano\'s fiets</b>: snel, maar zonder vering, dus pas op voor heuveltjes. Haal <b>level 5</b> voor de gele <b>monstertruck</b> met goede vering, <b>level 15</b> voor de <b>gouden monstertruck</b> met enorme acceleratie en <b>level 20</b> voor de <b>tuinkabouterauto</b>: bijna niet te laten omvallen en met Rolls-Royce-vering. Kies ze in de garage.'] },
  ],
});

// ---- developer-modus (knopje Dev linksboven, met wachtwoord)
initDev([
  { label: 'Alle levels en auto\'s openen', run: () => { P.dev = true; save(); refreshAll(); return 'Alles open'; } },
  { label: 'Alle levels als gehaald markeren', run: () => { for (let n = 1; n <= LEVEL_COUNT; n++) if (!P.done[n]) P.done[n] = 60; save(); refreshAll(); return 'Alle levels gehaald'; } },
]);

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
    }
    if (screen === 'play' && g) renderer.render(scene, camera);
  }
  requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
window.addEventListener('teun:pause', () => { if (screen === 'play') setPaused(true); });
window.__drive = { get g() { return g; }, P, startLevel, setPaused, keys, camera, renderer, scene };
setScreen('menu');
post('teun:ready');
