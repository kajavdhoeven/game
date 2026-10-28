import * as THREE from 'three';
import { World, LANE } from './world.js';
import { createGnome } from './gnome.js';
import { createTrain, CAR_LEN } from './train.js';
import { createSpotter, animateSpotter } from './spotter.js';
import { audio } from './audio.js';
import { initInput } from './input.js';
import { canvasTex, softCircleTexture } from './textures.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = Math.random;
const pick = (a) => a[(rand() * a.length) | 0];
const laneX = (l) => l * LANE;
const GROUND = 0.06;
const SPAWN_Z = 175;
const params = new URLSearchParams(location.search);

// ---------------------------------------------------------------- renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 2 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
const world = new World(scene, renderer);
world.setShadowQuality(coarse ? 1024 : 2048);

const gnome = createGnome();
scene.add(gnome.root);

// ---------------------------------------------------------------- state
const S = {
  mode: 'menu', // menu | starting | playing | paused | dead
  t: 0,
  speed: 0,
  dist: 0,
  coins: 0,
  spotters: 0,
  lane: 0,
  fromLane: null,
  x: 0,
  y: 0,
  vy: 0,
  rolling: false,
  rollTime: 0,
  rollQueued: false,
  jumpBuffer: 0,
  inv: 0,
  deadT: 0,
  startT: 0,
  shake: 0,
  patterns: 0,
  safe: 0,
  god: params.has('god'),
  lastMode: 'menu',
};
let best = 0;
let totalCoins = 0;
try {
  best = +localStorage.getItem('teun-best') || 0;
  totalCoins = +localStorage.getItem('teun-coins') || 0;
} catch (e) { /* geen opslag */ }

const JUMP_V = 13.6;
const GRAVITY = 38;
const ROLL_TIME = 0.62;

// ---------------------------------------------------------------- pools
const trainPool = { 1: [], 2: [] };
const barrierPool = { low: [], high: [] };
const spotterPool = [];
const obstacles = [];
const coinList = [];
const spotters = [];
let cursor = -50;

function stripeTex(c1, c2, diag) {
  const t = canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    g.fillStyle = c2;
    if (!diag) {
      for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
    } else {
      for (let x = -h; x < w; x += 64) {
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x + 32, h);
        g.lineTo(x + 32 + h, 0);
        g.lineTo(x + h, 0);
        g.fill();
      }
    }
  }, { repeat: true });
  t.repeat.set(2, 1);
  return t;
}
const stripeRW = stripeTex('#f4f4f4', '#cf2a2a', false);
const stripeYB = stripeTex('#ffcc00', '#161616', true);
const poleMat = new THREE.MeshStandardMaterial({ color: '#e9e9e9', roughness: 0.5, metalness: 0.2 });
const poleY = new THREE.MeshStandardMaterial({ color: '#e6b800', roughness: 0.5, metalness: 0.2 });
const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function makeBarrier(kind) {
  const g = new THREE.Group();
  const add = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (kind === 'low') {
    // overwegboom met knipperlichten
    add(new THREE.MeshStandardMaterial({ map: stripeRW, roughness: 0.5 }), 2.7, 0.15, 0.15, 0, 0.78, 0);
    const lamps = [];
    [-1.3, 1.3].forEach((x) => {
      add(poleMat, 0.2, 1.0, 0.2, x, 0.5, 0);
      add(new THREE.MeshStandardMaterial({ color: '#333' }), 0.5, 0.15, 0.5, x, 0.07, 0);
      const lm = new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lm);
      l.position.set(x, 1.1, -0.1);
      g.add(l);
      lamps.push(lm);
    });
    g.userData.lamps = lamps;
  } else {
    // lage doorgang: gele pionnen met gevarenbalk, eronder rollen
    const bar = add(new THREE.MeshStandardMaterial({ map: stripeYB, roughness: 0.5 }), 2.7, 0.7, 0.14, 0, 1.5, 0);
    [-1.3, 1.3].forEach((x) => add(poleY, 0.16, 1.85, 0.16, x, 0.92, 0));
    add(new THREE.MeshStandardMaterial({ color: '#333' }), 0.5, 0.12, 0.5, -1.3, 0.06, 0);
    add(new THREE.MeshStandardMaterial({ color: '#333' }), 0.5, 0.12, 0.5, 1.3, 0.06, 0);
    // pijl naar beneden als hint
    const arrow = canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#0b1a3a';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffc917';
      c.beginPath();
      c.moveTo(w * 0.5, h * 0.82);
      c.lineTo(w * 0.2, h * 0.42);
      c.lineTo(w * 0.4, h * 0.42);
      c.lineTo(w * 0.4, h * 0.16);
      c.lineTo(w * 0.6, h * 0.16);
      c.lineTo(w * 0.6, h * 0.42);
      c.lineTo(w * 0.8, h * 0.42);
      c.closePath();
      c.fill();
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: arrow, toneMapped: false }));
    sign.position.set(0, 2.25, 0.09);
    g.add(sign);
    add(poleY, 0.06, 0.4, 0.06, 0, 2.0, 0.0);
    g.userData.bar = bar;
  }
  return g;
}

function getBarrier(kind) {
  const m = barrierPool[kind].pop() || makeBarrier(kind);
  m.visible = true;
  scene.add(m);
  return m;
}
function getTrain(cars) {
  const m = trainPool[cars].pop() || createTrain(cars);
  m.visible = true;
  scene.add(m);
  return m;
}
function getSpotter() {
  let m = spotterPool.pop();
  if (!m) m = createSpotter(rand, (rand() * 3) | 0);
  m.visible = true;
  m.rotation.set(0, 0, 0);
  m.userData.tag.visible = true;
  m.userData.rig.visible = true;
  scene.add(m);
  return m;
}

function release(o) {
  scene.remove(o.mesh);
  if (o.kind === 'train') trainPool[o.cars].push(o.mesh);
  else barrierPool[o.kind].push(o.mesh);
}

// ---------------------------------------------------------------- munten
const coinProfile = [
  [0.0, -0.035], [0.26, -0.035], [0.3, -0.045], [0.335, -0.04], [0.345, 0], [0.335, 0.04], [0.3, 0.045],
  [0.26, 0.035], [0.0, 0.035],
].map(([x, y]) => new THREE.Vector2(x, y));
const coinGeo = new THREE.LatheGeometry(coinProfile, 28);
coinGeo.rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({
  color: '#ffc61a', metalness: 1, roughness: 0.22, emissive: '#6a4200', emissiveIntensity: 0.55, envMapIntensity: 1.6,
});
const COIN_MAX = 320;
const coinMesh = new THREE.InstancedMesh(coinGeo, coinMat, COIN_MAX);
coinMesh.frustumCulled = false;
coinMesh.castShadow = true;
coinMesh.count = 0;
scene.add(coinMesh);
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);

function updateCoinMesh() {
  let n = 0;
  for (const c of coinList) {
    if (c.got || n >= COIN_MAX) continue;
    _e.set(0, S.t * 3 + c.z * 0.15, 0.0);
    _q.setFromEuler(_e);
    _p.set(c.x, GROUND + c.y, c.z);
    _m.compose(_p, _q, _s);
    coinMesh.setMatrixAt(n++, _m);
  }
  coinMesh.count = n;
  coinMesh.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- vonken
class Sparks {
  constructor(max = 500) {
    this.max = max;
    this.pos = new Float32Array(max * 3).fill(-999);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.34, map: softCircleTexture(), vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  emit(x, y, z, n, color, speed = 4, up = 3) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.cursor++ % this.max;
      this.pos.set([x, y, z], k * 3);
      const a = rand() * Math.PI * 2;
      const sp = speed * (0.3 + rand() * 0.7);
      this.vel.set([Math.cos(a) * sp, up * (0.3 + rand()), Math.sin(a) * sp], k * 3);
      this.base.set([c.r, c.g, c.b], k * 3);
      this.life[k] = 0.5 + rand() * 0.5;
    }
  }
  update(dt, dz) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) {
        this.pos[k * 3 + 1] = -999;
        continue;
      }
      this.life[k] -= dt;
      const i = k * 3;
      this.vel[i + 1] -= 9 * dt;
      this.pos[i] += this.vel[i] * dt;
      this.pos[i + 1] += this.vel[i + 1] * dt;
      this.pos[i + 2] += this.vel[i + 2] * dt + dz;
      const f = clamp(this.life[k] * 2, 0, 1);
      this.col[i] = this.base[i] * f;
      this.col[i + 1] = this.base[i + 1] * f;
      this.col[i + 2] = this.base[i + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
const sparks = new Sparks();

// sterretjes rond het hoofd na een botsing
const stars = new THREE.Group();
for (let i = 0; i < 4; i++) {
  const st = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.09, 0),
    new THREE.MeshBasicMaterial({ color: '#ffe14a', toneMapped: false }),
  );
  stars.add(st);
}
stars.visible = false;
scene.add(stars);

// ---------------------------------------------------------------- patronen
function addCoin(lane, z, y = 0.85, xOff = 0) {
  coinList.push({ x: laneX(lane) + xOff, y, z, got: false });
}
function coinLine(lane, z0, n, step = 2.3, y = 0.85) {
  for (let i = 0; i < n; i++) addCoin(lane, z0 - i * step, y);
}
function coinArc(lane, z0, n, step, h) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    addCoin(lane, z0 - i * step, 0.85 + Math.sin(t * Math.PI) * h);
  }
}
function addTrain(lane, z0, cars) {
  const mesh = getTrain(cars);
  const len = mesh.userData.length;
  const o = { kind: 'train', cars, lane, x: laneX(lane), z: z0 - len / 2, len, mesh, hw: 1.3, horn: false };
  mesh.position.set(o.x, GROUND - 0.06, o.z);
  obstacles.push(o);
  return o;
}
function addBarrier(lane, z, kind) {
  const mesh = getBarrier(kind);
  const o = { kind, lane, x: laneX(lane), z, len: 0.5, mesh, hw: 1.4 };
  mesh.position.set(o.x, GROUND, z);
  obstacles.push(o);
  return o;
}
function addSpotter(side, z) {
  const mesh = getSpotter();
  const x = side * 4.9;
  mesh.position.set(x, 0.0, z);
  mesh.rotation.y = side > 0 ? -0.5 : 0.5;
  spotters.push({ mesh, x, z, side, hit: false, vel: null, t: 0, spin: null });
}

function spawnPattern() {
  const z0 = cursor;
  const diff = clamp(S.dist / 2600, 0, 1);
  S.safe = clamp(S.safe + pick([-1, 0, 0, 1]), -1, 1);
  const safe = S.safe;
  const others = [-1, 0, 1].filter((l) => l !== safe);
  const roll = rand();
  let len = 20;
  const trainLanes = [];
  S.patterns++;

  if (S.patterns <= 2) {
    coinLine(safe, z0, 10, 2.2);
    len = 22;
  } else if (roll < 0.14) {
    // slingerende munten
    let lane = pick([-1, 0, 1]);
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) lane = clamp(lane + pick([-1, 1]), -1, 1);
      addCoin(lane, z0 - i * 2.2);
    }
    len = 26;
  } else if (roll < 0.5) {
    const both = rand() < 0.3 + 0.4 * diff;
    const lanes = both ? others : [pick(others)];
    const cars = rand() < 0.3 + 0.3 * diff ? 2 : 1;
    lanes.forEach((l) => { addTrain(l, z0, cars); trainLanes.push(l); });
    len = cars * CAR_LEN + (cars - 1) * 0.35;
    coinLine(safe, z0, Math.min(14, Math.round(len / 2.4)), 2.4);
    // niet-afgesloten baan: ook daar munten
    if (!both) {
      const free = others.find((l) => !lanes.includes(l));
      if (rand() < 0.5) coinLine(free, z0 + 0, 5, 2.4);
    }
  } else if (roll < 0.76) {
    others.forEach((l) => {
      if (rand() < 0.88) {
        const kind = rand() < 0.62 ? 'low' : 'high';
        const z = z0 - rand() * 5;
        addBarrier(l, z, kind);
        if (kind === 'low') coinArc(l, z + 3.2, 6, 1.25, 1.2);
        else coinLine(l, z + 3, 4, 1.4, 0.6);
      }
    });
    coinLine(safe, z0, 8, 2.4);
    len = 14;
  } else if (roll < 0.9) {
    const [a, b] = others;
    addTrain(a, z0, 1);
    trainLanes.push(a);
    addBarrier(b, z0 - 3, pick(['low', 'high']));
    coinLine(safe, z0, 7, 2.3);
    len = CAR_LEN;
  } else {
    // spotterronde: munten leiden naar de treinspotter
    const side = pick([-1, 1]);
    const lane = side;
    coinLine(lane, z0, 7, 2.2);
    addSpotter(side, z0 - 17);
    if (rand() < 0.6) addSpotter(-side, z0 - 12);
    coinLine(safe === lane ? 0 : safe, z0 - 2, 5, 2.4);
    len = 26;
  }

  // losse spotters langs de baan, alleen waar geen trein staat
  if (rand() < 0.3 + 0.1 * diff) {
    const side = pick([-1, 1]);
    if (!trainLanes.includes(side)) addSpotter(side, z0 - rand() * 12 - 2);
  }

  const gap = Math.max(27, S.speed * 1.15);
  cursor -= len + gap;
}

// ---------------------------------------------------------------- UI
const hud = $('hud');
const ui = {
  score: $('score'), coins: $('coins'), coinBox: document.querySelector('.hud-coins'), hudBest: $('hudBest'),
};
let lastScore = -1;
let lastCoins = -1;

function saveStats() {
  try {
    localStorage.setItem('teun-best', String(best));
    localStorage.setItem('teun-coins', String(totalCoins));
  } catch (e) { /* geen opslag */ }
}

function refreshMenuStats() {
  $('menuBest').textContent = best;
  $('menuCoins').textContent = totalCoins;
}

function updateSoundIcon() {
  $('btnSound').innerHTML = audio.muted
    ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
    : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
}

function score() {
  return Math.floor(S.dist) + S.coins * 10;
}

function hudUpdate() {
  const sc = score();
  if (sc !== lastScore) {
    ui.score.textContent = sc;
    lastScore = sc;
  }
  if (S.coins !== lastCoins) {
    ui.coins.textContent = S.coins;
    lastCoins = S.coins;
    ui.coinBox.classList.add('bump');
    setTimeout(() => ui.coinBox.classList.remove('bump'), 100);
  }
}

const popsEl = $('pops');
const _v = new THREE.Vector3();
function pop(worldPos, text, cls = '') {
  _v.copy(worldPos).project(camera);
  if (_v.z > 1) return;
  const el = document.createElement('div');
  el.className = 'pop ' + cls;
  el.textContent = text;
  el.style.left = ((_v.x * 0.5 + 0.5) * innerWidth) + 'px';
  el.style.top = ((-_v.y * 0.5 + 0.5) * innerHeight) + 'px';
  popsEl.appendChild(el);
  setTimeout(() => el.remove(), 1150);
}

function show(id, on) {
  $(id).hidden = !on;
}

// ---------------------------------------------------------------- spelverloop
function clearEntities() {
  obstacles.forEach(release);
  obstacles.length = 0;
  coinList.length = 0;
  spotters.forEach((s) => {
    scene.remove(s.mesh);
    spotterPool.push(s.mesh);
  });
  spotters.length = 0;
}

function resetRun() {
  clearEntities();
  Object.assign(S, {
    speed: 0, dist: 0, coins: 0, spotters: 0, lane: 0, fromLane: null, x: 0, y: 0, vy: 0, rolling: false,
    rollTime: 0, rollQueued: false, jumpBuffer: 0, inv: 0, deadT: 0, startT: 0, shake: 0, patterns: 0, safe: 0,
  });
  cursor = -50;
  lastScore = -1;
  lastCoins = -1;
  stars.visible = false;
}

function goMenu() {
  resetRun();
  S.mode = 'menu';
  S.camBlend = 0;
  show('menu', true);
  show('hud', false);
  show('pause', false);
  show('over', false);
  refreshMenuStats();
  audio.stopMusic();
  audio.stopRumble();
}

function startRun() {
  audio.unlock();
  audio.startMusic();
  audio.startRumble();
  resetRun();
  S.mode = 'starting';
  show('menu', false);
  show('over', false);
  show('pause', false);
  show('hud', true);
  ui.hudBest.textContent = best;
  audio.ding();
}

function setPaused(p) {
  if (p && S.mode === 'playing') {
    S.mode = 'paused';
    show('pause', true);
    audio.stopMusic();
    audio.setRumble(0);
  } else if (!p && S.mode === 'paused') {
    S.mode = 'playing';
    show('pause', false);
    audio.startMusic();
  }
}

function die(why) {
  if (S.god) return;
  S.mode = 'dead';
  S.deadT = 0;
  S.shake = 1;
  audio.crash();
  audio.stopMusic();
  audio.stopRumble();
  sparks.emit(S.x, 1.0, 0, 40, '#ffd24a', 8, 6);
  sparks.emit(S.x, 0.8, 0, 20, '#ffffff', 6, 5);
  const sc = score();
  const isRecord = sc > best;
  if (isRecord) best = sc;
  totalCoins += S.coins;
  saveStats();
  $('overTitle').textContent = isRecord && sc > 50 ? 'Nieuw record!' : 'Boem!';
  $('overMsg').textContent = why === 'high' ? 'Te-Un had moeten rollen.' : why === 'low' ? 'Te-Un had moeten springen.' : 'Een NS-trein was sneller dan Te-Un.';
  $('overScore').textContent = sc;
  $('overBest').textContent = best;
  $('overCoins').textContent = S.coins;
  $('overSpot').textContent = S.spotters;
  setTimeout(() => {
    if (S.mode === 'dead') {
      show('over', true);
      show('hud', false);
    }
  }, 1100);
}

function action(a) {
  audio.unlock();
  if (a === 'pause') {
    if (S.mode === 'playing') setPaused(true);
    else if (S.mode === 'paused') setPaused(false);
    return;
  }
  if (S.mode === 'menu') {
    if (a === 'confirm' || a === 'jump') startRun();
    return;
  }
  if (S.mode === 'dead') {
    if ((a === 'confirm' || a === 'jump') && S.deadT > 1.2) startRun();
    return;
  }
  if (S.mode === 'paused') {
    if (a === 'confirm') setPaused(false);
    return;
  }
  if (S.mode !== 'playing' && S.mode !== 'starting') return;

  if (a === 'left' || a === 'right') {
    const nl = clamp(S.lane + (a === 'left' ? -1 : 1), -1, 1);
    if (nl !== S.lane) {
      S.fromLane = S.lane;
      S.lane = nl;
      audio.swish(nl * 0.6);
    }
  } else if (a === 'jump') {
    if (S.y <= 0.01) doJump();
    else S.jumpBuffer = 0.14;
  } else if (a === 'roll') {
    if (S.y > 0.05) {
      S.vy = -26; // snel naar beneden
      S.rollQueued = true;
    } else {
      startRoll();
    }
  }
}

function doJump() {
  S.vy = JUMP_V;
  S.y = 0.02;
  S.rolling = false;
  audio.jump();
  sparks.emit(S.x, 0.15, 0, 8, '#d9d2c0', 2.5, 1.5);
}
function startRoll() {
  S.rolling = true;
  S.rollTime = 0;
  audio.roll();
}

function collide() {
  const ph = S.rolling ? 0.62 : 1.45;
  for (const o of obstacles) {
    const half = o.kind === 'train' ? o.len / 2 : 0.35;
    if (Math.abs(o.z) > half + 0.3) continue;
    if (Math.abs(S.x - o.x) > o.hw + 0.3) continue;
    let hit = false;
    if (o.kind === 'train') hit = S.y < 3.4;
    else if (o.kind === 'low') hit = S.y < 0.8;
    else hit = S.y + ph > 1.15 && S.y < 1.9;
    if (!hit) continue;
    if (S.inv > 0) continue;
    const alongside = o.kind === 'train' && o.z + o.len / 2 > 1.2;
    if (alongside && S.fromLane !== null && S.lane !== S.fromLane) {
      // tegen de zijkant van een trein aangelopen: terugstuiteren
      S.lane = S.fromLane;
      S.fromLane = null;
      S.inv = 0.35;
      S.shake = 0.4;
      S.speed *= 0.9;
      audio.stumble();
      sparks.emit(S.x, 0.8, 0, 12, '#ffffff', 4, 3);
      continue;
    }
    die(o.kind);
    return;
  }
  // munten
  for (const c of coinList) {
    if (c.got) continue;
    if (Math.abs(c.z) > 0.9 || Math.abs(c.x - S.x) > 1.0) continue;
    if (Math.abs(c.y - (S.y + 0.8)) > 1.2) continue;
    c.got = true;
    S.coins++;
    audio.coin();
    sparks.emit(c.x, GROUND + c.y, c.z, 6, '#ffd54a', 2.5, 2.5);
  }
  // treinspotters
  for (const sp of spotters) {
    if (sp.hit) continue;
    if (Math.abs(sp.z) > 1.0) continue;
    if (Math.abs(S.x - sp.x) > 2.15 || Math.sign(S.x) !== Math.sign(sp.x)) continue;
    if (S.y > 1.1) continue;
    sp.hit = true;
    sp.t = 0;
    sp.vel = new THREE.Vector3(sp.side * (7 + rand() * 4), 7 + rand() * 3, -(S.speed * 1.5 + 6));
    sp.spin = new THREE.Vector3((rand() - 0.5) * 12, (rand() - 0.5) * 8, (rand() - 0.5) * 14);
    sp.mesh.userData.tag.visible = false;
    S.coins += 30;
    S.spotters++;
    S.shake = Math.max(S.shake, 0.25);
    audio.spotter();
    _v.set(sp.x, 2.2, sp.z);
    pop(_v, '+30', 'big');
    if (S.spotters === 1) setTimeout(() => pop(_v.set(0, 3.3, 0), 'Treinspotter geraakt!', 'msg'), 150);
    sparks.emit(sp.x, 1.5, sp.z, 40, '#ffc917', 7, 6);
    sparks.emit(sp.x, 1.5, sp.z, 24, '#ffffff', 5, 5);
  }
}

function update(dt) {
  S.t += dt;
  const mode = S.mode;

  // snelheid
  let target = 0;
  if (mode === 'playing' || mode === 'starting') target = Math.min(40, 18 + S.dist * 0.0042);
  if (mode === 'starting') {
    S.startT += dt;
    target *= clamp((S.startT - 0.5) / 0.8, 0, 1);
    if (S.startT > 1.4) S.mode = 'playing';
  }
  if (mode === 'dead') S.speed *= Math.exp(-6 * dt);
  else S.speed += clamp(target - S.speed, -30 * dt, 14 * dt);
  const dz = S.speed * dt;
  if (mode === 'playing' || mode === 'starting') S.dist += dz;

  // spawnen
  cursor += dz;
  if (mode === 'playing' || mode === 'starting') {
    while (cursor > -SPAWN_Z) spawnPattern();
  }

  // speler
  if (mode === 'playing' || mode === 'starting') {
    const tx = laneX(S.lane);
    const ox = S.x;
    S.x += (tx - S.x) * (1 - Math.exp(-17 * dt));
    if (Math.abs(S.x - tx) < 0.05) S.fromLane = null;
    S.vx = (S.x - ox) / dt;
    if (S.y > 0 || S.vy > 0) {
      S.vy -= GRAVITY * dt;
      S.y += S.vy * dt;
      if (S.y <= 0) {
        S.y = 0;
        S.vy = 0;
        sparks.emit(S.x, 0.1, 0, 6, '#cfc8b4', 2, 1);
        if (S.rollQueued) {
          startRoll();
          S.rollQueued = false;
        } else if (S.jumpBuffer > 0) {
          doJump();
        }
      }
    }
    S.jumpBuffer = Math.max(0, S.jumpBuffer - dt);
    if (S.rolling) {
      S.rollTime += dt;
      if (S.rollTime >= ROLL_TIME) S.rolling = false;
    }
    S.inv = Math.max(0, S.inv - dt);
  }

  // wereld en entiteiten bewegen
  world.update(dz, dt, camera);
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.z += dz;
    o.mesh.position.z = o.z;
    if (o.kind === 'low' && o.mesh.userData.lamps) {
      const on = Math.floor(S.t * 3.5 + o.x) % 2 === 0;
      o.mesh.userData.lamps[0].color.set(on ? '#ff3a22' : '#401010');
      o.mesh.userData.lamps[1].color.set(on ? '#401010' : '#ff3a22');
    }
    if (o.kind === 'train' && !o.horn && o.z > -90 && S.mode === 'playing') {
      o.horn = true;
      if (rand() < 0.4) audio.horn(o.lane * 0.7);
    }
    if (o.z - o.len / 2 > 14) {
      release(o);
      obstacles.splice(i, 1);
    }
  }
  for (let i = coinList.length - 1; i >= 0; i--) {
    const c = coinList[i];
    c.z += dz;
    if (c.z > 10 || c.got) {
      if (c.z > 10 || c.got) coinList.splice(i, 1);
    }
  }
  // gepakte munten opruimen en meshes updaten
  updateCoinMesh();

  // spotters
  for (let i = spotters.length - 1; i >= 0; i--) {
    const sp = spotters[i];
    sp.z += dz;
    if (sp.hit) {
      sp.t += dt;
      sp.vel.y -= 26 * dt;
      sp.mesh.position.x += sp.vel.x * dt;
      sp.mesh.position.y = Math.max(0, sp.mesh.position.y + sp.vel.y * dt);
      sp.z += sp.vel.z * dt;
      sp.mesh.rotation.x += sp.spin.x * dt;
      sp.mesh.rotation.y += sp.spin.y * dt;
      sp.mesh.rotation.z += sp.spin.z * dt;
      if (sp.mesh.position.y <= 0) {
        sp.vel.x *= 0.5;
        sp.vel.z *= 0.5;
        sp.spin.multiplyScalar(0.5);
        sp.vel.y = 0;
      }
      sp.mesh.position.z = sp.z;
      if (sp.t > 1.6) sp.mesh.visible = false;
    } else {
      sp.mesh.position.z = sp.z;
      const look = clamp((S.x - sp.x) * -0.15, -0.9, 0.9) + (sp.z > 0 ? 0 : 0);
      animateSpotter(sp.mesh, S.t, sp.side * 0.4 * clamp(-sp.z / 40, -1, 1) + look * 0, dt);
      // leunt over de baan als Te-Un dichtbij komt
      const near = clamp(1 - Math.abs(sp.z) / 22, 0, 1) * (Math.sign(S.x) === sp.side ? 1 : 0.3);
      sp.mesh.rotation.z = -sp.side * near * 0.18;
    }
    if (sp.z > 12 || (sp.hit && sp.t > 1.6)) {
      scene.remove(sp.mesh);
      sp.mesh.visible = true;
      spotterPool.push(sp.mesh);
      spotters.splice(i, 1);
    }
  }

  if (mode === 'playing') collide();
  sparks.update(dt, dz);

  // kabouter
  const sp01 = clamp((S.speed - 16) / 24, 0, 1);
  gnome.root.position.set(S.x, GROUND + S.y, 0);
  if (S.mode === 'menu') {
    gnome.root.rotation.y = Math.PI;
    gnome.update('idle', dt, S.t);
  } else if (S.mode === 'starting' && S.startT < 0.5) {
    const k = clamp(S.startT / 0.5, 0, 1);
    gnome.root.rotation.y = Math.PI * (1 - k * k * (3 - 2 * k));
    gnome.update('idle', dt, S.t);
  } else if (S.mode === 'dead') {
    S.deadT += dt;
    gnome.root.rotation.y = 0;
    gnome.update('dead', dt, S.t, 0, 0, { deadT: S.deadT * 3 });
    stars.visible = true;
    stars.position.set(S.x, GROUND + 0.35 + 0.35 * Math.min(1, S.deadT * 3) + 0.0, 0);
    stars.children.forEach((st, i) => {
      const a = S.t * 5 + (i * Math.PI) / 2;
      st.position.set(Math.cos(a) * 0.5, 0.9, Math.sin(a) * 0.35 - 0.3);
      st.rotation.y += dt * 6;
    });
  } else {
    gnome.root.rotation.y = 0;
    if (S.y > 0.02) gnome.update('jump', dt, S.t, sp01, S.vx || 0, { vy: S.vy });
    else if (S.rolling) gnome.update('roll', dt, S.t, sp01, 0, { rollT: S.rollTime / ROLL_TIME });
    else gnome.update('run', dt, S.t, sp01, S.vx || 0);
    // stofwolkjes bij het rennen
    if (S.mode === 'playing' && S.y <= 0.01 && rand() < dt * 18) sparks.emit(S.x + (rand() - 0.5) * 0.3, 0.1, 0.1, 1, '#b9b2a0', 1.2, 0.8);
  }
  gnome.root.traverse?.(() => {});

  audio.setRumble(S.mode === 'playing' ? clamp(S.speed / 40, 0, 1) : 0);
  if (mode === 'playing' || mode === 'starting' || mode === 'dead') hudUpdate();
}

// ---------------------------------------------------------------- camera
const camMenuPos = new THREE.Vector3();
const camMenuLook = new THREE.Vector3();
const camPos = new THREE.Vector3(0, 3.7, 6.6);
const camLook = new THREE.Vector3(0, 1.4, -10);
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
let camDist = 7.4;
let camBlend = 0;

function fitCamera() {
  const w = innerWidth;
  const h = innerHeight;
  renderer.setSize(w, h, false);
  const asp = w / h;
  camera.aspect = asp;
  camera.fov = asp < 1 ? 74 : 58;
  const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camDist = clamp(4.9 / (tan * asp), 6.6, 10.5);
  camera.updateProjectionMatrix();
  // menu: kabouter rechts van het midden (liggend) of boven het paneel (staand)
  if (asp >= 1) {
    camMenuPos.set(-1.6, 1.45, 4.0);
    camMenuLook.set(-2.0, 1.0, 0);
  } else {
    camMenuPos.set(0.4, 1.6, 4.8 + (1 - asp) * 2.2);
    camMenuLook.set(0.0, 0.5 - (1 - asp) * 1.0, 0);
  }
}
window.addEventListener('resize', fitCamera);
fitCamera();

function updateCamera(dt) {
  const inGame = S.mode === 'starting' || S.mode === 'playing' || S.mode === 'paused' || S.mode === 'dead';
  const want = inGame ? 1 : 0;
  const rate = want ? (S.mode === 'starting' ? 1.1 : 3) : 3;
  camBlend += clamp(want - camBlend, -rate * dt, rate * dt);
  const e = camBlend * camBlend * (3 - 2 * camBlend);

  const k = camDist / 6.6;
  tmpPos.set(S.x * 0.55, (3.7 + S.y * 0.25) * Math.pow(k, 0.85), camDist);
  tmpLook.set(S.x * 0.4, 1.3 + S.y * 0.3, -10);
  camPos.lerp(tmpPos, 1 - Math.exp(-9 * dt));
  camLook.lerp(tmpLook, 1 - Math.exp(-9 * dt));

  camera.position.lerpVectors(camMenuPos, camPos, e);
  const look = tmpLook.lerpVectors(camMenuLook, camLook, e);

  if (S.shake > 0) {
    S.shake = Math.max(0, S.shake - dt * 1.6);
    const a = S.shake * 0.35;
    camera.position.x += (rand() - 0.5) * a;
    camera.position.y += (rand() - 0.5) * a;
  }
  // iets breder beeld bij hoge snelheid
  const baseFov = camera.aspect < 1 ? 74 : 58;
  const fov = baseFov + (S.speed / 40) * 5 * e;
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
  camera.lookAt(look);
  if (window.__cam) {
    camera.position.copy(window.__cam.pos);
    camera.lookAt(window.__cam.look);
  }
}

// ---------------------------------------------------------------- start
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S.mode !== 'paused') update(dt);
  updateCamera(dt);
  renderer.render(scene, camera);
}

initInput(document.body, action);
$('btnPlay').addEventListener('click', startRun);
$('btnAgain').addEventListener('click', startRun);
$('btnOverMenu').addEventListener('click', goMenu);
$('btnPauseMenu').addEventListener('click', goMenu);
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnPause').addEventListener('click', () => setPaused(true));
$('btnSound').addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  updateSoundIcon();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.mode === 'playing') setPaused(true);
});
window.addEventListener('blur', () => {
  if (S.mode === 'playing') setPaused(true);
});

updateSoundIcon();
refreshMenuStats();
goMenu();
S.camBlend = 0;
camera.position.copy(camMenuPos);
camera.lookAt(camMenuLook);
// de eerste frames zorgen dat shaders gecompileerd zijn voor het scherm verdwijnt
renderer.compile(scene, camera);
requestAnimationFrame((t) => {
  last = t;
  frame(t);
  $('loading').hidden = true;
});

window.__game = {
  S, scene, camera, world, renderer, obstacles, coinList, spotters, action, startRun, die,
  spawn(n = 1) {
    for (let i = 0; i < n; i++) {
      cursor = -40;
      spawnPattern();
    }
  },
};
