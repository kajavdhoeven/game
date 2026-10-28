import * as THREE from 'three';
import { World, LANE } from './world.js';
import { createGnome } from './gnome.js';
import { createTrain, createRamp, pickTrainType, RAMP_KINDS } from './train.js';
import { createSpotter, animateSpotter, soak, resetSpotter } from './spotter.js';
import { createWheelchair, createCow, createNSVehicle, createBoard } from './vehicles.js';
import { createPickup, POWERUPS } from './powerups.js';
import { createMob } from './mob.js';
import { makeBarrier, OBST } from './obstacles.js';
import { Sparks } from './fx.js';
import { renderIcon } from './icons.js';
import { audio } from './audio.js';
import { initInput } from './input.js';
import { softCircleTexture } from './textures.js';
import { P, load, save, buy, owns, ownedVehicles, VEHICLES, VEHICLE_ORDER, VEHICLE_TIME, PRICES } from './save.js';
import { initDev } from '/js/devmode.js';
import { initTutorial } from '/js/tutorial.js';
import { fetchBoard, submitScore, cleanName, isOnline } from './net.js';
import { initBridge } from './bridge.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const rand = Math.random;
const pick = (a) => a[(rand() * a.length) | 0];
const lerp = (a, b, k) => a + (b - a) * k;
const GROUND = 0.06;
const PH = 0.93; // perronhoogte
const SPAWN_Z = 185;
const params = new URLSearchParams(location.search);

load();

// ---------------------------------------------------------------- renderer
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
const coarse = matchMedia('(pointer: coarse)').matches;
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
const world = new World(scene, renderer);
world.setShadowQuality(coarse ? 1024 : 2048);
renderer.__iconEnv = scene.environment;
const sparks = new Sparks(scene);

// permanente fakkellichten (aantal lichten mag nooit veranderen, anders hapert het spel)
const torchLights = [0, 1].map(() => {
  const l = new THREE.PointLight('#ff9a3a', 0, 16, 2);
  scene.add(l);
  return l;
});
const mob = createMob(scene, torchLights);

// ---------------------------------------------------------------- state
const S = {
  mode: 'menu', // menu | intro | playing | paused | dead
  t: 0, speed: 0, dist: 0, coins: 0, spotters: 0,
  lane: 0, fromLane: null, x: 0, y: 0, vy: 0, vx: 0, grounded: true,
  rolling: false, rollTime: 0, rollQueued: false, jumpBuffer: 0, inv: 0,
  deadT: 0, deadKind: 'tumble', shake: 0, patterns: 0, safe: 0, hazardT: 0,
  veh: null, vehCharge: {}, pw: { shoes: 0, plane: 0, board: 0 },
  flying: false, flyTarget: 0, shield: false,
  speedMul: 1, coinMul: 1, jumpStyle: 0, laneStyle: 0, airT: 0,
  aim: null, fireCd: 0, god: params.has('god'),
  introT: 0, introVariant: 0, launched: false, launchT: 2.2, lastVariant: -1,
  gestureT: 0,
  vehEndT: -999, chase: null, boardMax: Infinity, infRefill: false,
};
let cursor = -50;
let lastScore = -1;
let lastCoins = -1;

const JUMP_V = 13.6;
const SUPER_JUMP_V = 18.8;
const GRAVITY = 38;
const ROLL_TIME = 0.62;

const laneX = (l) => (Math.abs(l) === 2 ? Math.sign(l) * 7.9 : l * LANE);

// ---------------------------------------------------------------- kabouter
let gnome = null;
let gnomeSkin = null;
const boardMeshes = {};

function buildGnome() {
  if (gnome) {
    scene.remove(gnome.root);
  }
  gnome = createGnome({ skin: P.skin });
  gnomeSkin = P.skin;
  scene.add(gnome.root);
  gnome.root.traverse((o) => { if (o.isMesh) o.receiveShadow = false; });
}
buildGnome();

// voertuigen
const vehicleModels = {};
const vehicleGroup = new THREE.Group();
scene.add(vehicleGroup);
function getVehicleModel(id) {
  if (!vehicleModels[id]) {
    const m = id === 'wheelchair' ? createWheelchair() : id === 'cow' ? createCow() : createNSVehicle();
    m.visible = false;
    vehicleGroup.add(m);
    vehicleModels[id] = m;
  }
  return vehicleModels[id];
}

// ---------------------------------------------------------------- pools
const trainPool = {};
const barrierPool = {};
const pickupPool = {};
const spotterPool = { n: [], s: [] };
const obstacles = [];
const coinList = [];
const spotters = [];
const pickups = [];
const pendingHits = [];

function getTrain(want = 0) {
  const type = window.__trainType || pickTrainType(rand);
  const cars = type === 'freight' ? 1 : want || (rand() < 0.35 ? 2 : 1);
  const key = type + cars;
  const pool = (trainPool[key] ||= []);
  const m = pool.pop() || createTrain(type, cars, rand);
  m.visible = true;
  m.userData.poolKey = key;
  scene.add(m);
  return m;
}
function getBarrier(kind) {
  const pool = (barrierPool[kind] ||= []);
  const m = pool.pop() || makeBarrier(kind);
  m.visible = true;
  m.userData.kind = kind;
  scene.add(m);
  return m;
}
function getPickup(type) {
  const key = type + P.board;
  const pool = (pickupPool[key] ||= []);
  const m = pool.pop() || createPickup(type, P.board);
  m.visible = true;
  m.userData.poolKey = key;
  scene.add(m);
  return m;
}
function getSpotter(special) {
  const pool = special ? spotterPool.s : spotterPool.n;
  let m = pool.pop();
  if (!m) m = createSpotter(rand, { special });
  resetSpotter(m);
  m.visible = true;
  scene.add(m);
  return m;
}

function release(o) {
  if (o.ramp && o.rampMesh) {
    o.mesh.remove(o.rampMesh);
    o.rampMesh = null;
  }
  scene.remove(o.mesh);
  if (o.kind === 'train') {
    if (o.mesh.userData.ramp) { o.mesh.remove(o.mesh.userData.ramp); o.mesh.userData.ramp = null; }
    o.mesh.rotation.set(0, 0, 0);
    (trainPool[o.mesh.userData.poolKey] ||= []).push(o.mesh);
  } else (barrierPool[o.kind] ||= []).push(o.mesh);
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
const COIN_MAX = 360;
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
const _v = new THREE.Vector3();

function updateCoinMesh() {
  let n = 0;
  for (const c of coinList) {
    if (c.got || n >= COIN_MAX) continue;
    _e.set(0, S.t * 3 + c.x * 0.5, 0);
    _q.setFromEuler(_e);
    _p.set(c.x, GROUND + c.y, c.z);
    _m.compose(_p, _q, _s);
    coinMesh.setMatrixAt(n++, _m);
  }
  coinMesh.count = n;
  coinMesh.instanceMatrix.needsUpdate = true;
}

// sterretjes rond het hoofd na een botsing
const stars = new THREE.Group();
for (let i = 0; i < 4; i++) {
  stars.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), new THREE.MeshBasicMaterial({ color: '#ffe14a', toneMapped: false })));
}
stars.visible = false;
scene.add(stars);

// ---------------------------------------------------------------- hulpfuncties voor patronen
function platY(lane) { return Math.abs(lane) === 2 ? PH : 0; }

function addCoin(lane, z, y = 0.85, xOff = 0, parent = null, lz = 0) {
  coinList.push({ x: laneX(lane) + xOff, y: y + platY(lane), z, got: false, p: parent, lz });
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

function addPickup(type, lane, z, y = 0.9, parent = null, lz = 0) {
  const mesh = getPickup(type);
  const p = { type, x: laneX(lane), y: y + platY(lane), z, pz: z, mesh, taken: false, p: parent, lz };
  mesh.position.set(p.x, GROUND + p.y, z);
  pickups.push(p);
  return p;
}

// Een refill mag alleen verschijnen als je voertuig leeg is, niet tijdens de rit en niet in de 15 seconden erna,
// en er ligt er nooit meer dan een tegelijk.
function refillAllowed() {
  const id = P.vehicle;
  if (!id || !owns(id)) return false;
  if (S.veh || S.vehCharge[id]) return false;
  if (S.t - S.vehEndT < 15) return false;
  return !pickups.some((p) => p.type === 'refill' && !p.taken);
}

function maybePowerup(lane, z, y = 0.9, parent = null, lz = 0) {
  const list = ['shoes', 'shoes', 'plane', 'board', 'board', 'magnet', 'magnet'];
  if (refillAllowed()) list.push('refill', 'refill', 'refill');
  const type = pick(list);
  addPickup(type, lane, z, y, parent, lz);
}

// veilige snelheid voor een nieuwe trein: haalt geen eerdere hindernis in dezelfde baan in
function safeTrainSpeed(lane, zNear, v) {
  for (const o of obstacles) {
    if (o.lane !== lane) continue;
    const zFar = o.z - o.len / 2;
    const gap = zFar - zNear;
    const closing = v - (o.v || 0);
    if (closing <= 0 || gap < 0) continue;
    const tHit = gap / closing;
    const exitT = (14 - zFar) / Math.max(10, S.speed + (o.v || 0));
    if (tHit < exitT * 1.6 + 0.8) v = Math.max(0, o.v || 0);
  }
  return v;
}

function addTrain(lane, z0, opts = {}) {
  const mesh = getTrain(opts.cars || 0);
  const u = mesh.userData;
  const len = u.length;
  let ramp = null;
  let rampLen = 0;
  if (opts.ramp) {
    const kind = pick(RAMP_KINDS);
    ramp = createRamp(kind, u.roofH);
    rampLen = ramp.userData.len;
    ramp.position.z = len / 2;
    mesh.add(ramp);
    u.ramp = ramp;
  }
  const v = opts.v ? safeTrainSpeed(lane, z0, opts.v) : 0;
  const o = {
    kind: 'train', lane, x: laneX(lane), z: z0 - rampLen - len / 2, len, mesh, hw: (u.hw || 1.3), v,
    roofH: u.roofH, special: u.special, label: u.label, horn: false, ramp: ramp ? { len: rampLen } : null,
    rampMesh: ramp, total: len + rampLen, phase: rand() * 6, pz: z0 - rampLen - len / 2,
  };
  mesh.position.set(o.x, GROUND - 0.06, o.z);
  mesh.rotation.set(0, 0, 0);
  obstacles.push(o);
  return o;
}

function addBarrier(lane, z, kind) {
  const mesh = getBarrier(kind);
  const d = OBST[kind];
  const o = { kind, lane, x: laneX(lane), z, pz: z, len: d.depth * 2, mesh, hw: d.hw, v: 0, roofH: 0 };
  mesh.position.set(o.x, GROUND, z);
  obstacles.push(o);
  return o;
}

function addSpotter(side, z, onPlatform = false) {
  const special = rand() < 0.1;
  const mesh = getSpotter(special);
  const x = onPlatform ? side * 10.2 : side * 4.9;
  mesh.position.set(x, onPlatform ? PH : 0.0, z);
  mesh.rotation.y = side * (Math.PI / 2 - 0.45);
  spotters.push({ mesh, x, z, pz: z, side, hit: false, vel: null, t: 0, spin: null, plat: onPlatform, special });
}

// ---------------------------------------------------------------- patronen
function platformSidesAt(z) {
  const out = [];
  [-1, 1].forEach((s) => { if (world.platformAt(z, s) && world.platformAt(z - 14, s)) out.push(s); });
  return out;
}

function spawnPattern() {
  let z0 = cursor;
  const diff = clamp(S.dist / 2600, 0, 1);
  S.safe = clamp(S.safe + pick([-1, 0, 0, 1]), -1, 1);
  const safe = S.safe;
  const others = [-1, 0, 1].filter((l) => l !== safe);
  const zone = world.zoneAt(z0);
  const inTunnel = zone && zone.zone === 'tunnel';
  const plats = platformSidesAt(z0 - 6);
  const trainLanes = [];
  const items = []; // hindernissen van dit patroon voor de tijdlijn
  let len = 20;
  let vmax = 0;
  let vmin = 99;
  const spd = Math.max(S.speed, 18);
  S.patterns++;

  const weights = { coins: 0.35, trains: 5.2, barriers: 4.2, mixed: 3.4, ramp: 2.4 + diff, passing: 2.8 + diff * 1.6, spotter: inTunnel ? 0 : 1.8, platform: plats.length ? 3 : 0 };
  let total = 0;
  Object.values(weights).forEach((w) => { total += w; });
  let roll = rand() * total;
  let type = 'coins';
  for (const [k, w] of Object.entries(weights)) {
    roll -= w;
    if (roll <= 0) { type = k; break; }
  }
  if (window.__force) type = window.__force;
  else if (S.patterns <= 2) type = 'coins';

  // alle treinen rijden je tegemoet, de een langzaam en de ander snel
  const trainV = () => {
    const r = rand();
    if (r < 0.4) return 7 + rand() * 5;
    return 13 + rand() * (9 + 6 * diff);
  };

  if (type === 'coins') {
    if (rand() < 0.5) {
      let lane = pick([-1, 0, 1]);
      for (let i = 0; i < 12; i++) {
        if (i > 0 && i % 4 === 0) lane = clamp(lane + pick([-1, 1]), -1, 1);
        addCoin(lane, z0 - i * 2.2);
      }
    } else coinLine(safe, z0, 10, 2.2);
    if (rand() < 0.22) maybePowerup(safe, z0 - 8);
    len = 26;
  } else if (type === 'trains') {
    const both = rand() < 0.65 + 0.3 * diff;
    const lanes = both ? others : [pick(others)];
    lanes.forEach((l) => {
      const o = addTrain(l, z0, { v: trainV() });
      items.push(o);
      trainLanes.push(l);
      len = Math.max(len, o.total);
    });
    coinLine(safe, z0, Math.min(14, Math.round(len / 2.4)), 2.4);
  } else if (type === 'ramp') {
    const l = pick(others);
    const o = addTrain(l, z0, { ramp: true, cars: 4 + ((rand() * 3) | 0), v: 2 + rand() * 3 });
    items.push(o);
    trainLanes.push(l);
    len = o.total;
    // munten en eventueel een power-up op het dak
    const n = Math.max(4, Math.round(o.len / 2.4));
    for (let i = 0; i < n; i++) addCoin(l, 0, o.roofH + 0.85, 0, o, -o.ramp.len * 0 + (o.len / 2 - 1.6) - i * 2.4);
    if (rand() < 0.45) maybePowerup(l, 0, o.roofH + 1.0, o, o.len / 2 - 5);
    // tweede trein, soms ook met schans
    const rest = others.filter((x) => x !== l);
    if (rand() < 0.35) {
      const o2 = addTrain(rest[0], z0 - rand() * 4, { ramp: rand() < 0.5, cars: 3 + ((rand() * 2) | 0), v: 2 + rand() * 3 });
      items.push(o2);
      trainLanes.push(rest[0]);
      len = Math.max(len, o2.total);
    }
    coinLine(safe, z0, 8, 2.4);
  } else if (type === 'passing') {
    // tegemoetkomende trein: snel en op één baan
    const l = pick([-1, 0, 1]);
    const v = 16 + rand() * (10 + 6 * diff);
    const o = addTrain(l, z0, { v });
    items.push(o);
    trainLanes.push(l);
    len = o.total;
    const rest = [-1, 0, 1].filter((x) => x !== l);
    coinLine(pick(rest), z0, 8, 2.4);
    if (rand() < 0.3) maybePowerup(pick(rest), z0 - 10);
  } else if (type === 'barriers') {
    others.forEach((l) => {
      if (rand() < 0.95) {
        const kind = pick(['low', 'low', 'high', 'crate', 'cone']);
        const z = z0 - rand() * 5;
        const o = addBarrier(l, z, kind);
        items.push(o);
        if (kind === 'high') coinLine(l, z + 3, 4, 1.4, 0.6);
        else coinArc(l, z + 3.2, 6, 1.25, kind === 'crate' ? 1.6 : 1.2);
      }
    });
    coinLine(safe, z0, 8, 2.4);
    if (rand() < 0.18) maybePowerup(safe, z0 - 10);
    len = 14;
    // tweede rij vlak erachter: de vrije baan schuift hooguit een baan op
    const safe2 = clamp(safe + pick([-1, 0, 1]), -1, 1);
    [-1, 0, 1].filter((l) => l !== safe2).forEach((l) => {
      if (rand() < 0.9) items.push(addBarrier(l, z0 - 11 - rand() * 3, pick(['low', 'high', 'crate', 'cone'])));
    });
    S.safe = safe2;
    len = 24;
  } else if (type === 'mixed') {
    const [a, b] = others;
    const o = addTrain(a, z0, { v: 8 + rand() * 6 });
    items.push(o);
    trainLanes.push(a);
    items.push(addBarrier(b, z0 - 3, pick(['low', 'high', 'cone'])));
    items.push(addBarrier(safe, z0 - 14 - rand() * 4, pick(['low', 'high', 'crate', 'cone'])));
    coinLine(safe, z0, 5, 2.3);
    len = o.total;
  } else if (type === 'platform') {
    // perron: munten en power-ups op het perron, spotters op het perron
    const side = pick(plats);
    coinLine(side * 2, z0, 9, 2.4);
    if (rand() < 0.5) maybePowerup(side * 2, z0 - 22);
    if (rand() < 0.7) addSpotter(side, z0 - 8 - rand() * 8, true);
    // ook iets te doen op het gewone spoor
    const l = pick(others);
    items.push(addBarrier(l, z0 - 6, pick(['low', 'cone'])));
    coinLine(safe, z0, 6, 2.4);
    len = 26;
  } else { // spotter
    const side = pick([-1, 1]);
    coinLine(side, z0, 7, 2.2);
    addSpotter(side, z0 - 17);
    if (rand() < 0.6) addSpotter(-side, z0 - 12);
    coinLine(safe === side ? 0 : safe, z0 - 2, 5, 2.4);
    len = 26;
  }

  // losse spotters langs de baan, alleen waar geen trein staat
  if (type !== 'spotter' && rand() < 0.3 + 0.1 * diff && !inTunnel) {
    const side = pick([-1, 1]);
    if (!trainLanes.includes(side)) {
      const ps = platformSidesAt(z0 - 6);
      addSpotter(side, z0 - rand() * 12 - 2, ps.includes(side) && rand() < 0.6);
    }
  }

  // tijdlijn: tegemoetkomende trein mag nooit eerder dan de vorige hindernis bij de speler zijn
  items.forEach((o) => {
    vmax = Math.max(vmax, o.v || 0);
    vmin = Math.min(vmin, o.v || 0);
  });
  if (!items.length) { vmax = 0; vmin = 0; }
  const dist = -z0;
  const tStart = dist / (spd + vmax);
  if (tStart < S.hazardT + 0.5) {
    const want = (S.hazardT + 0.5) * (spd + vmax);
    const shift = want - dist;
    shiftPattern(shift);
    z0 -= shift;
  }
  S.hazardT = Math.max(S.hazardT, (-z0 + len) / (spd + vmin));
  cursor = Math.min(cursor, z0) - len - Math.max(11, S.speed * 0.5);
}

// verschuif alles wat in dit patroon is toegevoegd verder van de speler af
let patternStart = { o: 0, c: 0, p: 0, s: 0 };
function markPatternStart() {
  patternStart = { o: obstacles.length, c: coinList.length, p: pickups.length, s: spotters.length };
}
function shiftPattern(dz) {
  for (let i = patternStart.o; i < obstacles.length; i++) { obstacles[i].z -= dz; obstacles[i].mesh.position.z = obstacles[i].z; }
  for (let i = patternStart.c; i < coinList.length; i++) if (!coinList[i].p) coinList[i].z -= dz;
  for (let i = patternStart.p; i < pickups.length; i++) if (!pickups[i].p) { pickups[i].z -= dz; pickups[i].mesh.position.z = pickups[i].z; }
  for (let i = patternStart.s; i < spotters.length; i++) { spotters[i].z -= dz; spotters[i].mesh.position.z = spotters[i].z; }
}
const _spawnPattern = spawnPattern;
function spawnWrapped() {
  markPatternStart();
  _spawnPattern();
}

// ---------------------------------------------------------------- UI
const ui = {
  score: $('score'), coins: $('coins'), coinBox: document.querySelector('.hud-coins'), hudBest: $('hudBest'),
};

function toast(msg, ms = 1800) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, ms);
}

function show(id, on) { $(id).hidden = !on; }

function score() { return Math.floor(S.dist) + S.coins * 10; }

function hudUpdate() {
  const sc = score();
  if (sc !== lastScore) { ui.score.textContent = sc; lastScore = sc; }
  if (S.coins !== lastCoins) {
    ui.coins.textContent = S.coins;
    lastCoins = S.coins;
    ui.coinBox.classList.add('bump');
    setTimeout(() => ui.coinBox.classList.remove('bump'), 100);
  }
}

const popsEl = $('pops');
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

function updateSoundIcon() {
  $('btnSound').innerHTML = audio.muted
    ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 5 6M21 9l-5 6"/></svg>'
    : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
}

function refreshMenuStats() {
  $('menuBest').textContent = P.best;
  $('menuCoins').textContent = P.coins;
  $('nameInput').value = P.name;
}

// pictogrammen (eenmalig gerenderd uit de 3D-modellen)
function vehIcon(id) {
  return renderIcon(renderer, 'veh_' + id, () => {
    const m = id === 'wheelchair' ? createWheelchair() : id === 'cow' ? createCow() : createNSVehicle();
    return m;
  }, { yaw: id === 'train' ? 2.5 : -0.7, pitch: 0.2 });
}
function pwIcon(type) {
  return renderIcon(renderer, 'pw_' + type, () => createPickup(type, 'orange'), { yaw: 0.3, pitch: 0.3, size: 96 });
}
function boardIcon(kind) {
  return renderIcon(renderer, 'board_' + kind, () => createBoard(kind), { yaw: -0.6, pitch: 0.5 });
}
function skinIcon(skin) {
  return renderIcon(renderer, 'skin_' + skin, () => {
    const g = createGnome({ skin });
    g.root.rotation.y = Math.PI;
    g.update('idle', 0.016, 0.3);
    return g.root;
  }, { yaw: 0, pitch: 0.1 });
}

// voertuig-knop rechtsonder: een rondje met het gekozen voertuig. Wisselen kan alleen in de winkel.
function vehHud() {
  const id = P.vehicle;
  const box = $('vehBox');
  const btn = $('vehBtn');
  if (!id || !owns(id)) { box.hidden = true; return; }
  box.hidden = false;
  btn.className = '';
  btn.style.setProperty('--p', '0%');
  const src = vehIcon(id);
  if ($('vehIcon').getAttribute('src') !== src) $('vehIcon').src = src;
  const charged = S.vehCharge[id] || S.infRefill;
  if (S.veh) {
    btn.classList.add('active');
    btn.style.setProperty('--p', (S.veh.t / VEHICLE_TIME * 100).toFixed(1) + '%');
    $('vehState').textContent = Math.ceil(S.veh.t) + ' s';
  } else if (charged) {
    btn.classList.add('ready');
    $('vehState').textContent = coarse ? 'Tik' : 'Spatie';
  } else {
    btn.classList.add('spent');
    $('vehState').textContent = 'Refill';
  }
}
let lastVehKey = '';
function vehHudMaybe() {
  const key = [P.vehicle, S.veh ? Math.ceil(S.veh.t) : 'x', S.veh ? S.veh.id : '', S.vehCharge[P.vehicle], S.infRefill, ownedVehicles().length].join('|');
  if (key !== lastVehKey) { lastVehKey = key; vehHud(); }
  if (S.veh) $('vehBtn').style.setProperty('--p', (S.veh.t / VEHICLE_TIME * 100).toFixed(1) + '%');
}

// power-up-balk bovenaan
let lastChips = '';
function chipsUpdate() {
  const items = [];
  ['shoes', 'plane', 'board', 'magnet'].forEach((k) => {
    if (S.pw[k] > 0) items.push({ k, frac: k === 'board' ? (S.boardMax === Infinity ? 1 : S.pw.board / S.boardMax) : S.pw[k] / POWERUPS[k].time });
  });
  const key = items.map((i) => i.k + Math.round(i.frac * 20)).join(',');
  if (key === lastChips) return;
  lastChips = key;
  const bar = $('pwBar');
  bar.innerHTML = '';
  items.forEach((i) => {
    const d = document.createElement('div');
    d.className = 'chip';
    d.innerHTML = `<img src="${pwIcon(i.k)}" alt=""><span>${POWERUPS[i.k].label}</span><i style="width:${(i.frac * 100).toFixed(0)}%"></i>`;
    bar.appendChild(d);
  });
}

// ---------------------------------------------------------------- winkel
let shopTab = 'vehicles';
function renderShop() {
  $('shopCoins').textContent = P.coins;
  const grid = $('shopGrid');
  grid.innerHTML = '';
  const card = ({ id, title, desc, img, price, owned, selected, onBuy, onSelect, ownedLabel }) => {
    const c = document.createElement('div');
    c.className = 'card' + (selected ? ' sel' : '');
    c.innerHTML = `<img src="${img}" alt=""><h3>${title}</h3><p>${desc}</p>`;
    const b = document.createElement('button');
    b.className = 'btn';
    if (!owned) {
      b.innerHTML = `Koop <span class="price"><i class="coin"></i>${price.toLocaleString('nl-NL')}</span>`;
      b.disabled = P.coins < price;
      b.onclick = () => onBuy(id);
    } else if (selected) {
      b.textContent = 'Geselecteerd';
      b.disabled = true;
    } else {
      b.textContent = ownedLabel || 'Selecteer';
      b.onclick = () => onSelect(id);
    }
    c.appendChild(b);
    grid.appendChild(c);
  };
  if (shopTab === 'vehicles') {
    VEHICLE_ORDER.forEach((id) => {
      const v = VEHICLES[id];
      card({
        id, title: v.name, desc: v.desc, img: vehIcon(id), price: v.price, owned: owns(id), selected: P.vehicle === id,
        onBuy: (x) => { if (buy(x)) { P.vehicle = x; save(); audio.pickup(); $('shopNote').textContent = v.name + ' gekocht!'; renderShop(); } },
        onSelect: (x) => { P.vehicle = x; save(); renderShop(); },
      });
    });
    $('shopNote').textContent = 'Activeer je voertuig tijdens het rennen met de spatiebalk (of tik op de knop rechtsonder).';
  } else {
    card({
      id: 'teun', title: 'Te-Un', desc: 'De originele kabouter met rood mutsje, ronde zwarte bril en smurfblauwe schoenen.', img: skinIcon('teun'),
      price: 0, owned: true, selected: P.skin === 'teun', onSelect: () => { P.skin = 'teun'; save(); buildGnome(); renderShop(); },
    });
    card({
      id: 'skin_conductor', title: 'NS-conducteur', desc: 'Te-Un in uniform met een koeienpetje.', img: skinIcon('conductor'),
      price: PRICES.skin_conductor, owned: owns('skin_conductor'), selected: P.skin === 'conductor',
      onBuy: (x) => { if (buy(x)) { P.skin = 'conductor'; save(); buildGnome(); audio.pickup(); renderShop(); } },
      onSelect: () => { P.skin = 'conductor'; save(); buildGnome(); renderShop(); },
    });
    card({
      id: 'skin_photo', title: 'Treinspotter-fotograaf', desc: 'Oranje shirt en een camera. Hij fotografeert de treinspotters met flits om ze te pakken.', img: skinIcon('photographer'),
      price: PRICES.skin_photo, owned: owns('skin_photo'), selected: P.skin === 'photographer',
      onBuy: (x) => { if (buy(x)) { P.skin = 'photographer'; save(); buildGnome(); audio.pickup(); renderShop(); } },
      onSelect: () => { P.skin = 'photographer'; save(); buildGnome(); renderShop(); },
    });
    card({
      id: 'orange', title: 'Oranje shirt', desc: 'Te-Un trekt een oranje shirt aan. Vangt één botsing op, daarna is het weg.', img: boardIcon('orange'),
      price: 0, owned: true, selected: P.board === 'orange', onSelect: () => { P.board = 'orange'; save(); renderShop(); },
    });
    card({
      id: 'board_cow', title: 'Drinkhoed + kogelvrij vest', desc: 'Een hoed met twee blikjes energy en een kogelvrij vest. 20 seconden 2,5x sneller, vangt ook één botsing op.', img: boardIcon('cow'),
      price: PRICES.board_cow, owned: owns('board_cow'), selected: P.board === 'cow',
      onBuy: (x) => { if (buy(x)) { P.board = 'cow'; save(); audio.pickup(); renderShop(); } },
      onSelect: () => { P.board = 'cow'; save(); renderShop(); },
    });
    $('shopNote').textContent = 'Munten verdien je door te rennen. Je aankopen blijven bewaard.';
  }
}
function openShop(from) {
  shopFrom = from;
  show('menu', false);
  show('over', false);
  show('shop', true);
  renderShop();
}
let shopFrom = 'menu';
function closeShop() {
  show('shop', false);
  if (shopFrom === 'over') show('over', true);
  else show('menu', true);
  refreshMenuStats();
}

// ---------------------------------------------------------------- ranglijst
let boardTab = 'score';
let boardData = null;
let boardFrom = 'menu';
function renderBoardList() {
  const list = $('boardList');
  list.innerHTML = '';
  const rows = (boardData && boardData[boardTab]) || [];
  rows.forEach((r, i) => {
    const li = document.createElement('li');
    const mine = r.pid === P.pid.slice(0, 8) || r.pid === P.pid;
    if (mine) li.className = 'me';
    const val = boardTab === 'score' ? String(r.score) : boardTab === 'distance' ? r.distance + ' m' : String(r.coins);
    li.innerHTML = `<span class="rk">${i + 1}</span><span></span><span class="sc">${val}</span>`;
    li.children[1].textContent = r.name || 'Naamloos';
    if (boardTab === 'score') {
      const sub = document.createElement('small');
      sub.textContent = `${r.runDist} m + ${r.runCoins} munten`;
      sub.style.cssText = 'display:block;opacity:.7;font-size:.72em;font-weight:400';
      li.children[1].appendChild(sub);
    }
    list.appendChild(li);
  });
  if (!rows.length) list.innerHTML = '<li><span></span><span>Nog geen scores. Wees de eerste!</span><span></span></li>';
  $('boardNote').textContent = boardData && boardData.offline ? 'Geen verbinding met de online ranglijst. Je ziet alleen jouw eigen score.' : 'Online ranglijst. De score is dezelfde als in de game: afstand + 10 punten per munt, van je beste run.';
}
async function openBoard(from) {
  boardFrom = from;
  show('menu', false);
  show('over', false);
  show('leader', true);
  $('boardList').innerHTML = '<li><span></span><span>Laden...</span><span></span></li>';
  boardData = await fetchBoard();
  renderBoardList();
}
function closeBoard() {
  show('leader', false);
  if (boardFrom === 'over') show('over', true);
  else show('menu', true);
}

// ---------------------------------------------------------------- spelverloop
function clearEntities() {
  obstacles.forEach(release);
  obstacles.length = 0;
  coinList.length = 0;
  spotters.forEach((s) => {
    scene.remove(s.mesh);
    (s.special ? spotterPool.s : spotterPool.n).push(s.mesh);
  });
  spotters.length = 0;
  pickups.forEach((p) => {
    scene.remove(p.mesh);
    (pickupPool[p.mesh.userData.poolKey] ||= []).push(p.mesh);
  });
  pickups.length = 0;
  pendingHits.length = 0;
}

function resetRun() {
  clearEntities();
  endVehicleVisual();
  Object.assign(S, {
    speed: 0, dist: 0, coins: 0, spotters: 0, lane: 0, fromLane: null, x: 0, y: 0, vy: 0, vx: 0, grounded: true,
    rolling: false, rollTime: 0, rollQueued: false, jumpBuffer: 0, inv: 0, deadT: 0, shake: 0, patterns: 0, safe: 0,
    hazardT: 0, veh: null, flying: false, flyTarget: 0, shield: false, speedMul: 1, coinMul: 1, aim: null, fireCd: 0,
    launched: false, introT: 0,
  });
  S.pw = { shoes: 0, plane: 0, board: 0, magnet: 0 };
  S.vehEndT = -999;
  S.chase = null;
  S.vehCharge = {};
  ownedVehicles().forEach((v) => { S.vehCharge[v] = 1; });
  cursor = -50;
  lastScore = -1;
  lastCoins = -1;
  lastChips = '';
  lastVehKey = '';
  stars.visible = false;
  gnome.setShoes(false);
  gnome.setPlane(false);
  gnome.setOutfit(null);
  gnome.root.rotation.set(0, 0, 0);
  gnome.root.visible = true;
  $('pwBar').innerHTML = '';
}

function goMenu() {
  if (gnomeSkin !== P.skin) buildGnome();
  resetRun();
  S.mode = 'menu';
  mob.hide();
  world.setDay(1);
  show('menu', true);
  show('hud', false);
  show('pause', false);
  show('over', false);
  show('shop', false);
  show('leader', false);
  show('skipHint', false);
  refreshMenuStats();
  audio.stopMusic();
  audio.stopRumble();
}

// ----- intro: Te-Un wordt door boze kabouters verjaagd (elke keer een andere variant)
function startRun() {
  audio.unlock();
  if (gnomeSkin !== P.skin) buildGnome();
  resetRun();
  P.name = cleanName($('nameInput').value) || P.name;
  save();
  S.mode = 'intro';
  S.introT = 0;
  let v;
  do { v = window.__intro ?? ((rand() * 3) | 0); } while (v === S.lastVariant && window.__intro == null);
  S.lastVariant = v;
  S.introVariant = v;
  S.launchT = v === 2 ? 0.4 : v === 1 ? 2.5 : 2.2;
  S.launched = v === 2;
  mob.setup(v === 2 ? 2 : 0);
  world.setDay(0);
  show('menu', false);
  show('over', false);
  show('pause', false);
  show('shop', false);
  show('leader', false);
  show('hud', true);
  show('skipHint', true);
  ui.hudBest.textContent = P.best;
  camBlend = v === 2 ? 1 : 0;
  camFrom = v === 2 ? null : 'intro';
  audio.mob();
  if (v === 2) launchGnome();
  lastVehKey = '';
}

function launchGnome() {
  S.launched = true;
  audio.startMusic();
  audio.startRumble();
  if (S.introVariant !== 2) {
    S.vy = S.introVariant === 1 ? 15 : 11;
    S.grounded = false;
    S.speed = 22;
    audio.boing?.();
  }
}

function endIntro() {
  S.mode = 'playing';
  S.launched = true;
  show('skipHint', false);
}

function skipIntro() {
  if (!S.launched) launchGnome();
  S.introT = S.launchT + 6;
  world.setDay(1);
  mob.hide();
  S.grounded = S.y <= floorAt() + 0.05;
  endIntro();
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

async function finishRun() {
  const sc = score();
  const prevBest = P.best;
  const isRecord = sc > P.best;
  if (isRecord) P.best = sc;
  P.coins += S.coins;
  P.runs++;
  P.totalDist += Math.floor(S.dist);
  P.spotters += S.spotters;
  save();
  $('overTitle').textContent = isRecord && sc > 50 ? 'Nieuw record!' : 'Boem!';
  $('overScore').textContent = sc;
  $('overBest').textContent = P.best;
  $('overCoins').textContent = S.coins;
  $('overSpot').textContent = S.spotters;
  $('overRank').textContent = 'Score wordt opgeslagen...';
  const res = await submitScore(S.dist, S.coins);
  if (isRecord && sc >= 50000 && prevBest < 50000) toast('Profielfoto Te-Un 50K vrijgespeeld! Kies hem op je profiel.', 6000);
  $('overRank').textContent = res ? 'Je score staat op de online ranglijst.' : 'Geen verbinding: je score is lokaal bewaard.';
}

function startChase() {
  S.chase = { t: 12, leave: false };
  mob.setup(2);
  mob.group.visible = true;
  toast('De boze kabouters zijn achter je aan! Loop niet nog een keer tegen een trein.', 2600);
}

function die(why, o) {
  if (S.god || S.mode !== 'playing') return;
  S.mode = 'dead';
  S.deadT = 0;
  S.deadKind = why === 'caught' ? 'tumble' : o && o.kind === 'train' ? 'splat' : 'tumble';
  S.shake = 1;
  S.aim = null;
  audio.stopMusic();
  audio.stopRumble();
  if (why === 'caught') { audio.mob(); if (!S.chase) startChase(); }
  if (S.deadKind === 'splat') {
    audio.splat();
    S.speed = 0; // alles staat meteen stil: Te-Un blijft tegen de neus plakken
    // trein blijft staan met zijn neus precies tegen Te-Un
    obstacles.forEach((x) => { x.v = 0; });
    if (o) { o.z = -0.28 - o.len / 2; o.mesh.position.z = o.z; }
    S.y = Math.max(S.y, 0);
  } else audio.crash();
  sparks.emit(S.x, 1.0, 0, 30, '#ffd24a', 7, 5);
  sparks.emit(S.x, 0.8, 0, 14, '#ffffff', 5, 4);
  $('overMsg').textContent = why === 'caught' ? 'De boze kabouters hebben Te-Un te pakken!' : why === 'high' ? 'Te-Un had moeten rollen.' : why === 'low' || why === 'crate' || why === 'cone' ? 'Te-Un had moeten springen.' : 'Een NS-trein was sneller dan Te-Un.';
  const delay = S.deadKind === 'splat' ? 3500 : 1500;
  finishRun();
  setTimeout(() => {
    if (S.mode === 'dead') {
      show('over', true);
      show('hud', false);
    }
  }, delay);
}

// ---------------------------------------------------------------- voertuigen en power-ups
function endVehicleVisual() {
  Object.values(vehicleModels).forEach((m) => { m.visible = false; });
}

function activateVehicle() {
  const id = P.vehicle;
  if (!id || !owns(id)) { toast('Koop eerst een voertuig in de winkel'); return; }
  if (S.veh) return;
  if (!S.vehCharge[id] && !S.infRefill) { toast('Dit voertuig is verbruikt. Pak een refill!'); return; }
  const v = VEHICLES[id];
  S.veh = { id, t: VEHICLE_TIME };
  S.vehCharge[id] = 0;
  S.coinMul = v.coins;
  recomputeSpeed();
  const m = getVehicleModel(id);
  m.visible = true;
  endVehicleVisualExcept(id);
  // tijdens de rit liggen er geen refills meer op het spoor
  for (let i = pickups.length - 1; i >= 0; i--) {
    if (pickups[i].type === 'refill') { scene.remove(pickups[i].mesh); (pickupPool[pickups[i].mesh.userData.poolKey] ||= []).push(pickups[i].mesh); pickups.splice(i, 1); }
  }
  audio.vehicle(id);
  pop(_v.set(S.x, 2.6, 0), v.name + '!', 'msg');
  sparks.emit(S.x, 1, 0, 30, '#9fe8ff', 6, 4);
  lastVehKey = '';
}
function endVehicleVisualExcept(id) {
  Object.entries(vehicleModels).forEach(([k, m]) => { if (k !== id) m.visible = false; });
}
function endVehicle() {
  if (!S.veh) return;
  const id = S.veh.id;
  S.veh = null;
  S.coinMul = 1;
  S.vehEndT = S.t;
  recomputeSpeed();
  endVehicleVisual();
  S.inv = 2;
  sparks.emit(S.x, 1.2, 0, 24, '#ffffff', 5, 4);
  if (S.infRefill) { S.vehCharge[id] = 1; toast('Developer: voertuig meteen weer klaar'); }
  else toast('Voertuig is op. Pak een refill om opnieuw te rijden!');
  lastVehKey = '';
}

// snelheid: het snelste van het voertuig en de drinkhoed met vest (die tellen niet op)
function recomputeSpeed() {
  const veh = S.veh ? VEHICLES[S.veh.id].speed : 1;
  const board = S.pw.board > 0 && P.board === 'cow' ? 2.5 : 1;
  S.speedMul = Math.max(veh, board);
}

function collectPickup(p) {
  p.taken = true;
  audio.powerup();
  sparks.emit(p.x, GROUND + p.y, p.z, 28, POWERUPS[p.type].color, 6, 5);
  pop(_v.set(p.x, GROUND + p.y + 1.2, p.z), POWERUPS[p.type].label, 'msg');
  const t = p.type;
  if (t === 'shoes') { S.pw.shoes = POWERUPS.shoes.time; gnome.setShoes(true); }
  else if (t === 'plane') {
    S.pw.plane = POWERUPS.plane.time;
    S.flying = true;
    S.flyTarget = 4.6;
    gnome.setPlane(true);
  } else if (t === 'board') {
    // oranje shirt: blijft tot je hem nodig hebt. Koe: 2,5x sneller, maar maar 20 seconden.
    S.boardMax = P.board === 'cow' ? 20 : Infinity;
    S.pw.board = S.boardMax === Infinity ? 1e9 : S.boardMax;
    S.shield = true;
    gnome.setOutfit(P.board === 'cow' ? 'cans' : 'shirt');
    recomputeSpeed();
  } else if (t === 'magnet') {
    S.pw.magnet = POWERUPS.magnet.time;
  } else if (t === 'refill') {
    const id = P.vehicle;
    S.vehCharge[id] = 1;
    toast(VEHICLES[id].name + ' is weer opgeladen!');
    lastVehKey = '';
  }
}

function endPlane() {
  S.pw.plane = 0;
  gnome.setPlane(false);
  S.flying = false;
  S.grounded = false;
  S.vy = 0;
  S.inv = Math.max(S.inv, 1.5);
}

// ---------------------------------------------------------------- waterpistool, fluitje of camera
function fire() {
  if (S.fireCd > 0 || (S.mode !== 'playing' && S.mode !== 'intro')) return;
  if (S.mode === 'intro' && !S.launched) return;
  S.fireCd = 0.42;
  // doelwit: dichtstbijzijnde spotter naast de baan
  let best = null;
  let bd = 99;
  for (const sp of spotters) {
    if (sp.hit || sp.soaked) continue;
    const dz = sp.z;
    if (dz > 3 || dz < -15) continue;
    if (Math.abs(sp.x - S.x) > 8) continue;
    const d = Math.abs(dz) + Math.abs(sp.x - S.x) * 0.3;
    if (d < bd) { bd = d; best = sp; }
  }
  const side = best ? (Math.sign(best.x - S.x) || best.side) : (S.x > 1 ? 1 : -1) || 1;
  S.aim = { side, t: 0 };
  const how = P.skin === 'conductor' ? 'whistle' : P.skin === 'photographer' ? 'flash' : 'water';
  if (how === 'whistle') audio.whistle();
  else if (how === 'flash') { audio.shutter(); screenFlash(); }
  else audio.squirt();
  const ox = S.x + side * 0.4;
  const oy = GROUND + S.y + 1.0;
  if (best) {
    const dx = best.x - ox;
    const dy = 1.4 + (best.plat ? PH : 0) - oy;
    const dz = best.z - 0;
    const dist = Math.hypot(dx, dy, dz);
    sparks.emitDir(ox, oy, 0, dx, dy, dz, how === 'water' ? 40 : 26, how === 'water' ? '#7fd8ff' : '#ffffff', how === 'flash' ? 40 : 24, 0.05, 0.5, 2);
    pendingHits.push({ sp: best, t: dist / (how === 'flash' ? 60 : 24), how });
  } else {
    sparks.emitDir(ox, oy, 0, side, 0.25, -0.1, 30, how === 'water' ? '#7fd8ff' : '#ffffff', 20, 0.1, 0.6, 7);
  }
}

function screenFlash() {
  const f = $('flash');
  if (!f) return;
  f.style.transition = 'none';
  f.style.opacity = '0.9';
  requestAnimationFrame(() => requestAnimationFrame(() => { f.style.transition = 'opacity .35s ease-out'; f.style.opacity = '0'; }));
}

function hitSpotter(sp, how) {
  if (sp.hit) return;
  sp.hit = true;
  sp.t = 0;
  const strong = how === 'ram';
  sp.vel = new THREE.Vector3(sp.side * (strong ? 9 : 3), strong ? 8 : 4.5, strong ? -(S.speed * 1.4 + 6) : -(S.speed * 0.4));
  sp.spin = new THREE.Vector3((rand() - 0.5) * (strong ? 12 : 5), (rand() - 0.5) * 6, (rand() - 0.5) * (strong ? 14 : 6));
  sp.mesh.userData.tag.visible = false;
  const value = sp.mesh.userData.value * S.coinMul;
  S.coins += value;
  S.spotters++;
  S.shake = Math.max(S.shake, strong ? 0.25 : 0.1);
  audio.spotter();
  pop(_v.set(sp.x, 2.4 + (sp.plat ? PH : 0), sp.z), '+' + value, sp.special ? 'big gold' : 'big');
  if (S.spotters === 1) setTimeout(() => pop(_v.set(0, 3.3, 0), 'Treinspotter afgemaakt!', 'msg'), 150);
  sparks.emit(sp.x, 1.5, sp.z, sp.special ? 60 : 36, sp.special ? '#ffd24a' : '#ffc917', 7, 6);
  sparks.emit(sp.x, 1.5, sp.z, 20, '#ffffff', 5, 5);
}

// ---------------------------------------------------------------- invoer
function action(a) {
  audio.unlock();
  if (a === 'pause') {
    if (S.mode === 'playing') setPaused(true);
    else if (S.mode === 'paused') setPaused(false);
    return;
  }
  if (S.mode === 'menu') {
    if (a === 'confirm' && document.activeElement && document.activeElement.id === 'nameInput') { document.activeElement.blur(); return; }
    if (a === 'confirm' || a === 'vehicle') startRun();
    return;
  }
  if (S.mode === 'dead') {
    if ((a === 'confirm' || a === 'vehicle') && S.deadT > 1.4 && !$('over').hidden) startRun();
    return;
  }
  if (S.mode === 'paused') {
    if (a === 'confirm') setPaused(false);
    return;
  }
  if (S.mode === 'intro') {
    if (a === 'confirm' || a === 'jump' || a === 'vehicle') skipIntro();
    return;
  }
  if (S.mode !== 'playing') return;

  if (a === 'left' || a === 'right') {
    const dir = a === 'left' ? -1 : 1;
    let nl = S.lane + dir;
    // naar het perron? alleen waar een perron ligt
    if (Math.abs(nl) === 2) {
      const side = Math.sign(nl);
      if (!(world.platformAt(-2, side) || world.platformAt(0, side))) nl = S.lane;
    }
    nl = clamp(nl, -2, 2);
    if (nl !== S.lane) {
      S.fromLane = S.lane;
      S.lane = nl;
      S.laneStyle = (rand() * 3) | 0;
      gnome.startLane(dir, S.laneStyle);
      audio.swish(nl * 0.4);
      if (Math.abs(nl) === 2 && S.grounded && !S.flying) {
        S.vy = 12.5;
        S.grounded = false;
        S.jumpStyle = 0;
      }
    }
  } else if (a === 'jump') {
    if (S.grounded || S.flying) { if (!S.flying) doJump(); }
    else S.jumpBuffer = 0.14;
  } else if (a === 'roll') {
    if (S.flying) { S.flyTarget = Math.max(1.5, S.flyTarget - 1.5); return; }
    if (!S.grounded) { S.vy = -26; S.rollQueued = true; }
    else startRoll();
  } else if (a === 'vehicle') activateVehicle();
  else if (a === 'fire') fire();
}

function doJump() {
  S.vy = S.pw.shoes > 0 ? SUPER_JUMP_V : JUMP_V;
  S.grounded = false;
  S.rolling = false;
  S.airT = 0;
  S.jumpStyle = (rand() * 4) | 0;
  gnome.squash(0.5);
  audio.jump();
  sparks.emit(S.x, S.y + 0.15, 0, 8, '#d9d2c0', 2.5, 1.5);
}
function startRoll() {
  S.rolling = true;
  S.rollTime = 0;
  audio.roll();
}

// ---------------------------------------------------------------- wereld-vloer
// hoogte van de grond onder Te-Un: perron, schans of treindak
function floorAt() {
  if (Math.abs(S.x) > 5.6) {
    const side = Math.sign(S.x);
    return world.platformAt(0, side) ? PH : 0;
  }
  let h = 0;
  for (const o of obstacles) {
    if (o.kind !== 'train' || o.smashed) continue;
    if (Math.abs(S.x - o.x) > o.hw - 0.05) continue;
    const nose = o.z + o.len / 2;
    if (o.ramp) {
      const rl = o.ramp.len;
      if (nose <= 0 && nose >= -rl && Math.abs(S.x - o.x) < 1.2) h = Math.max(h, o.roofH * (1 + nose / rl));
    }
    // net voorbij de neus van de trein: nog steeds op het dak als je van de schans komt
    const tol = o.ramp && nose < 2.5 ? 1.2 : 0.45;
    if (Math.abs(o.z) <= o.len / 2 && S.y >= o.roofH - tol) h = Math.max(h, o.roofH);
  }
  return h;
}

function physics(dt) {
  if (S.flying) {
    S.y += (S.flyTarget - S.y) * (1 - Math.exp(-4 * dt));
    S.vy = 0;
    S.grounded = false;
    return;
  }
  const fl = floorAt();
  if (!S.grounded) {
    S.vy -= GRAVITY * dt;
    S.y += S.vy * dt;
    S.airT += dt;
    if (S.vy <= 0 && S.y <= fl) {
      S.y = fl;
      S.vy = 0;
      S.grounded = true;
      sparks.emit(S.x, S.y + 0.1, 0, 6, '#cfc8b4', 2, 1);
      gnome.squash(S.airT > 0.5 ? 1 : 0.6);
      if (S.rollQueued) { startRoll(); S.rollQueued = false; }
      else if (S.jumpBuffer > 0) doJump();
    }
  } else if (S.y - fl > 0.25) {
    S.grounded = false; // vloer valt weg: van het dak of perron af
    S.vy = 0;
    S.airT = 0;
  } else {
    S.y = fl; // volgt schans en perron
  }
}

// ---------------------------------------------------------------- botsingen
function smash(o) {
  sparks.emit(o.x, 1.5, 0, 36, '#ffb347', 9, 6);
  sparks.emit(o.x, 1.0, 0, 20, '#ffffff', 7, 5);
  S.shake = Math.max(S.shake, 0.35);
  audio.stumble();
  o.smashed = true;
}

// zat dit object tijdens het afgelopen beeldje op de hoogte van de speler? (voorkomt dat je er bij hoge snelheid doorheen vliegt)
const sweep = (z, pz, reach) => Math.min(z, pz) - reach <= 0 && Math.max(z, pz) + reach >= 0;

function collide() {
  const flyingHigh = S.flying && S.y > 2.6;
  const ph = S.rolling ? 0.62 : 1.45;
  const invul = S.inv > 0 || flyingHigh;
  const vehId = S.veh && S.veh.id;
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    if (o.smashed) continue;
    const half = o.kind === 'train' ? o.len / 2 : OBST[o.kind].depth;
    if (!sweep(o.z, o.pz ?? o.z, half + 0.3)) continue;
    if (Math.abs(S.x - o.x) > o.hw + 0.3) continue;
    let hit = false;
    if (o.kind === 'train') {
      hit = S.y < o.roofH - 0.4;
      if (hit && o.ramp && Math.abs(S.x - o.x) < 1.3) {
        // op de schans of net erbovenop: geen botsing, ook niet als je een beeldje achterloopt
        const nose = o.z + o.len / 2;
        const rl = o.ramp.len;
        const surface = nose >= 0 ? o.roofH : o.roofH * (1 + nose / rl);
        if (nose >= -rl && nose <= 2.5 && S.y >= surface - 1.0) hit = false;
      }
    } else if (o.kind === 'high') hit = S.y + ph > OBST.high.bottom && S.y < OBST.high.top;
    else hit = S.y < OBST[o.kind].top - 0.05;
    if (!hit) continue;
    // voertuigen breken kleine obstakels; alleen de NS-trein gaat door alles heen, ook door treinen
    if (vehId && (o.kind !== 'train' || vehId === 'train')) { smash(o); o.mesh.visible = false; continue; }
    if (invul) continue;
    const alongside = o.kind === 'train' && o.z + o.len / 2 > 1.2;
    if (alongside && S.fromLane !== null && S.lane !== S.fromLane) {
      // tegen de zijkant van een trein aangelopen: eerste keer struikelen en de boze kabouters komen achter je aan, tweede keer ben je gepakt
      if (S.chase) { die('caught', o); return; }
      S.lane = S.fromLane;
      S.fromLane = null;
      S.inv = 0.5;
      S.shake = 0.5;
      S.speed *= 0.85;
      audio.stumble();
      sparks.emit(S.x, 0.8, 0, 12, '#ffffff', 4, 3);
      startChase();
      continue;
    }
    if (S.shield) {
      // het shirt of kogelvrije vest vangt de klap op
      S.shield = false;
      S.pw.board = 0;
      gnome.setOutfit(null);
      recomputeSpeed();
      S.inv = 1.6;
      smash(o);
      pop(_v.set(S.x, 2.4, 0), P.board === 'cow' ? 'Vest hield stand! Hoed weg' : 'Shirt gescheurd!', 'msg');
      if (o.kind === 'train') {
        // door de trein heen duwen: trein weg
        o.mesh.visible = false;
      } else o.mesh.visible = false;
      continue;
    }
    die(o.kind, o);
    return;
  }

  // munten
  const flyTol = S.flying ? 5.2 : 1.2;
  for (const c of coinList) {
    if (c.got) continue;
    if (!sweep(c.z, c.pz ?? c.z, 0.9) || Math.abs(c.x - S.x) > (S.flying ? 1.6 : 1.05)) continue;
    if (Math.abs(c.y - (S.y + 0.8)) > flyTol) continue;
    c.got = true;
    S.coins += S.coinMul;
    audio.coin();
    sparks.emit(c.x, GROUND + c.y, c.z, 5, '#ffd54a', 2.5, 2.5);
  }
  // power-ups
  for (const p of pickups) {
    if (p.taken) continue;
    if (!sweep(p.z, p.pz ?? p.z, 1.2) || Math.abs(p.x - S.x) > 1.4) continue;
    if (Math.abs(p.y - (S.y + 0.9)) > (S.flying ? 5.2 : 1.7)) continue;
    // een refill pak je alleen op als je voertuig leeg is en niet tijdens of vlak na een rit
    if (p.type === 'refill' && (S.veh || S.vehCharge[P.vehicle] || S.t - S.vehEndT < 15 || !P.vehicle)) continue;
    collectPickup(p);
  }
  // treinspotters pak je alleen met F (waterpistool, fluitje of camera), niet door ze aan te lopen
}

// ---------------------------------------------------------------- update
const camBase = { x: 0 };
void camBase;

function baseSpeed() { return Math.min(40, 18 + S.dist * 0.0042); }

function update(dt) {
  S.t += dt;
  const mode = S.mode;
  const live = mode === 'playing' || mode === 'intro';

  // ----- intro-verloop
  if (mode === 'intro') {
    S.introT += dt;
    if (!S.launched && S.introT >= S.launchT) launchGnome();
    const run = S.introT - S.launchT;
    if (S.launched) world.setDay(clamp(run / 5, 0, 1) * clamp(run / 5, 0, 1) * (3 - 2 * clamp(run / 5, 0, 1)));
    if (S.launched && run > 2.4) endIntro();
  }
  if (S.mode === 'playing' && S.dist > 0) {
    const run = S.introT - S.launchT;
    if (run < 8 && mob.group.visible) world.setDay(clamp(run / 5, 0, 1));
    if (run >= 5 && world.dayK < 1) world.setDay(1);
  }
  if (S.mode === 'playing' && S.introT - S.launchT > 6.5 && mob.group.visible && !S.chase) mob.hide();

  // ----- snelheid
  let target = 0;
  if (S.mode === 'playing') target = baseSpeed() * S.speedMul;
  else if (S.mode === 'intro' && S.launched) target = baseSpeed() * 0.95;
  target = Math.min(target, 95);
  if (mode === 'dead') S.speed *= Math.exp((S.deadKind === 'splat' ? -14 : -6) * dt);
  else S.speed += clamp(target - S.speed, -40 * dt, (S.speedMul > 1 ? 30 : 14) * dt);
  const dz = S.speed * dt;
  if (live && S.launched) S.dist += dz;

  // ----- hindernissen aanmaken
  cursor += dz;
  if (live && S.launched) {
    S.hazardT = Math.max(0, S.hazardT - dt);
    while (cursor > -SPAWN_Z) spawnWrapped();
  }

  // ----- speler
  if (live) {
    const tx = laneX(S.lane);
    const ox = S.x;
    S.x += (tx - S.x) * (1 - Math.exp(-17 * dt));
    if (Math.abs(S.x - tx) < 0.05) S.fromLane = null;
    S.vx = (S.x - ox) / dt;
    S.jumpBuffer = Math.max(0, S.jumpBuffer - dt);
    if (S.rolling) {
      S.rollTime += dt;
      if (S.rollTime >= ROLL_TIME) S.rolling = false;
    }
    S.inv = Math.max(0, S.inv - dt);
    S.fireCd = Math.max(0, S.fireCd - dt);
    if (S.aim) { S.aim.t += dt; if (S.aim.t > 0.5) S.aim = null; }
    // automatisch terug naar het spoor als het perron ophoudt
    if (Math.abs(S.lane) === 2 && S.mode === 'playing') {
      const side = Math.sign(S.lane);
      if (!world.platformAt(-3, side)) {
        S.fromLane = S.lane;
        S.lane = side;
        if (S.grounded) { S.vy = 7; S.grounded = false; }
        audio.swish(side * 0.4);
      }
    }
    // power-up timers
    if (S.mode === 'playing') {
      if (S.pw.shoes > 0) { S.pw.shoes -= dt; if (S.pw.shoes <= 0) { S.pw.shoes = 0; gnome.setShoes(false); } }
      if (S.pw.plane > 0) { S.pw.plane -= dt; if (S.pw.plane <= 0) endPlane(); }
      if (S.pw.board > 0 && S.pw.board < 1e8) { S.pw.board -= dt; if (S.pw.board <= 0) { S.pw.board = 0; S.shield = false; gnome.setOutfit(null); recomputeSpeed(); } }
      if (S.pw.magnet > 0) S.pw.magnet = Math.max(0, S.pw.magnet - dt);
      if (S.veh) { S.veh.t -= dt; if (S.veh.t <= 0) endVehicle(); }
    }
  }

  // ----- wereld
  world.update(dz, dt, camera);
  let tunnelTarget = 0;
  {
    const seg = world.zoneAt(-4);
    if (seg && seg.zone === 'tunnel') tunnelTarget = 1;
    const seg2 = world.zoneAt(2);
    if (seg2 && seg2.zone === 'tunnel') tunnelTarget = Math.max(tunnelTarget, 1);
  }
  world.setTunnel(lerp(world.tunnelK, tunnelTarget, 1 - Math.exp(-3.2 * dt)));

  // ----- hindernissen bewegen
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.pz = o.z;
    o.z += dz + (o.v || 0) * dt * (mode === 'dead' ? 0 : 1);
    o.mesh.position.z = o.z;
    if (o.kind === 'train') {
      // subtiel schommelen van rijdende treinen
      if (o.v > 0) {
        // rijdend: zacht schommelen en voorlichten die wiebelen
        o.mesh.rotation.z = Math.sin(S.t * 9 + o.phase) * 0.004;
        o.mesh.position.y = GROUND - 0.06 + Math.abs(Math.sin(S.t * 14 + o.phase)) * 0.012;
      }
      if (!o.horn && o.z - o.len / 2 > -110 && S.mode === 'playing' && (o.v > 8 || rand() < 0.3)) {
        o.horn = true;
        audio.horn(o.lane * 0.7);
      }
    } else if (o.kind === 'low' && o.mesh.userData.lamps) {
      const on = Math.floor(S.t * 3.5 + o.x) % 2 === 0;
      o.mesh.userData.lamps[0].color.set(on ? '#ff3a22' : '#401010');
      o.mesh.userData.lamps[1].color.set(on ? '#401010' : '#ff3a22');
    }
    if (o.z - (o.total || o.len) / 2 - 2 > 16 || o.z - o.len / 2 > 22) {
      release(o);
      obstacles.splice(i, 1);
    }
  }
  for (let i = coinList.length - 1; i >= 0; i--) {
    const c = coinList[i];
    c.pz = c.z;
    // magneet: munten in de buurt vliegen naar Te-Un toe
    if (S.pw.magnet > 0 && !c.got && !c.pull && c.z > -18 && c.z < 3 && Math.abs(c.x - S.x) < 9 && Math.abs(c.y - (S.y + 0.8)) < 7) { c.pull = true; c.p = null; }
    if (c.pull) {
      // met vaste snelheid naar Te-Un toe (sneller dan de wereld), en direct oppakken
      const tx = S.x - c.x, ty = (S.y + 0.8) - c.y, tz = 0 - c.z;
      const dist = Math.hypot(tx, ty, tz);
      const step = (S.speed + 24) * dt;
      if (dist <= Math.max(step, 0.9)) {
        c.got = true;
        S.coins += S.coinMul;
        audio.coin();
        sparks.emit(c.x, GROUND + c.y, c.z, 5, '#ffd54a', 2.5, 2.5);
      } else {
        c.x += (tx / dist) * step;
        c.y += (ty / dist) * step;
        c.z += (tz / dist) * step;
        if (rand() < dt * 30) sparks.emit(c.x, GROUND + c.y, c.z, 1, '#ffd54a', 0.8, 0.4);
      }
    } else if (c.p) {
      if (c.p.smashed || !obstacles.includes(c.p)) { coinList.splice(i, 1); continue; }
      c.z = c.p.z + c.lz;
    } else c.z += dz;
    if (c.z > 10 || c.got) coinList.splice(i, 1);
  }
  updateCoinMesh();

  // ----- power-ups
  for (let i = pickups.length - 1; i >= 0; i--) {
    const p = pickups[i];
    p.pz = p.z;
    if (p.p) {
      if (!obstacles.includes(p.p)) { scene.remove(p.mesh); pickupPool[p.mesh.userData.poolKey].push(p.mesh); pickups.splice(i, 1); continue; }
      p.z = p.p.z + p.lz;
    } else p.z += dz;
    p.mesh.position.set(p.x, GROUND + p.y, p.z);
    p.mesh.userData.update(S.t, dt);
    if (p.taken || p.z > 10) {
      scene.remove(p.mesh);
      pickupPool[p.mesh.userData.poolKey].push(p.mesh);
      pickups.splice(i, 1);
    }
  }

  // ----- treinspotters
  for (let i = spotters.length - 1; i >= 0; i--) {
    const sp = spotters[i];
    sp.pz = sp.z;
    sp.z += dz;
    if (sp.hit) {
      sp.t += dt;
      sp.vel.y -= 26 * dt;
      sp.mesh.position.x += sp.vel.x * dt;
      sp.mesh.position.y = Math.max(sp.plat ? PH : 0, sp.mesh.position.y + sp.vel.y * dt);
      sp.z += sp.vel.z * dt;
      sp.mesh.rotation.x += sp.spin.x * dt;
      sp.mesh.rotation.y += sp.spin.y * dt;
      sp.mesh.rotation.z += sp.spin.z * dt;
      if (sp.mesh.position.y <= (sp.plat ? PH : 0)) {
        sp.vel.x *= 0.5;
        sp.vel.z *= 0.5;
        sp.spin.multiplyScalar(0.5);
        sp.vel.y = 0;
      }
      sp.mesh.position.z = sp.z;
      if (sp.t > 1.6) sp.mesh.visible = false;
    } else {
      sp.mesh.position.z = sp.z;
      // dichtstbijzijnde trein voor de reactie
      let best = null;
      let bd = 60;
      for (const o of obstacles) {
        if (o.kind !== 'train') continue;
        const lo = o.z - o.len / 2;
        const hi = o.z + o.len / 2;
        const dzc = sp.z < lo ? lo - sp.z : sp.z > hi ? hi - sp.z : 0;
        const dx = o.x - sp.x;
        const d = Math.hypot(dx, dzc);
        if (d < bd) { bd = d; best = { dx, dz: dzc === 0 ? -0.001 : dzc, special: o.special, speed: o.v }; }
      }
      const player = Math.abs(sp.z) < 16 && S.mode !== 'dead' ? { dx: S.x - sp.x, dz: -sp.z } : null;
      const flashed = animateSpotter(sp.mesh, S.t, dt, { train: best, player, side: sp.side });
      if (flashed && Math.abs(sp.z) < 22) audio.click();
      // leunt over de baan als Te-Un dichtbij komt
      const near = clamp(1 - Math.abs(sp.z) / 22, 0, 1) * (Math.sign(S.x) === sp.side ? 1 : 0.3);
      sp.mesh.rotation.z = -sp.side * near * 0.12 * (sp.plat ? 0 : 1);
    }
    if (sp.z > 14 || (sp.hit && sp.t > 1.6)) {
      scene.remove(sp.mesh);
      sp.mesh.visible = true;
      (sp.special ? spotterPool.s : spotterPool.n).push(sp.mesh);
      spotters.splice(i, 1);
    }
  }
  // waterstraal komt aan
  for (let i = pendingHits.length - 1; i >= 0; i--) {
    const h = pendingHits[i];
    h.t -= dt;
    if (h.t > 0) continue;
    pendingHits.splice(i, 1);
    if (h.sp.hit || h.sp.soaked) continue;
    h.sp.soaked = true;
    if (h.how === 'whistle') {
      // het fluitje schrikt hem zo dat hij omvalt
      sparks.emit(h.sp.x, 1.9 + (h.sp.plat ? PH : 0), h.sp.z, 18, '#ffffff', 6, 3);
      setTimeout(() => hitSpotter(h.sp, 'whistle'), 160);
    } else if (h.how === 'flash') {
      // de flits verblindt hem en de foto is geschoten
      sparks.emit(h.sp.x, 1.6 + (h.sp.plat ? PH : 0), h.sp.z, 40, '#ffffff', 9, 3);
      sparks.emit(h.sp.x, 1.6 + (h.sp.plat ? PH : 0), h.sp.z, 14, '#fff2a8', 5, 5);
      setTimeout(() => hitSpotter(h.sp, 'flash'), 120);
    } else {
      soak(h.sp.mesh);
      sparks.emit(h.sp.x, 1.4 + (h.sp.plat ? PH : 0), h.sp.z, 26, '#9fe0ff', 5, 4);
      audio.splash();
      setTimeout(() => hitSpotter(h.sp, 'water'), 420);
    }
  }

  // eerst de hoogte bijwerken met de nieuwe positie van treinen en schansen, daarna pas botsingen
  if (live && (S.launched || S.introVariant === 2)) physics(dt);
  if (mode === 'playing') collide();
  sparks.update(dt, dz);

  // ----- kabouter en voertuig tonen
  updateGnomeVisual(dt);
  if (S.chase) {
    // boze kabouters rennen vlak achter Te-Un; bij de tweede botsing pakken ze hem
    if (mode === 'playing') {
      S.chase.t -= dt;
      if (S.chase.t <= 0) S.chase.leave = true;
    }
    mob.update(dt, S.t, 'chase', S.speed, { follow: mode === 'dead' ? 'catch' : S.chase.leave ? 'leave' : 'near', torchK: 0.35 });
    if (S.chase.leave && mob.allGone()) { mob.hide(); S.chase = null; }
  } else if (mob.group.visible) {
    const phase = S.launched ? 'chase' : 'stand';
    const push = S.introVariant !== 2 && !S.launched ? clamp((S.introT - (S.launchT - 0.7)) / 0.5, 0, 1) : (S.launched && S.introVariant !== 2 ? 1 : null);
    mob.update(dt, S.t, phase, S.speed, { pushT: push, torchK: 1 - clamp((S.introT - S.launchT) / 6, 0, 1) * 0.9 });
  }

  audio.setRumble(S.mode === 'playing' ? clamp(S.speed / 60, 0, 1) : 0);
  if (mode === 'playing' || mode === 'intro' || mode === 'dead') {
    hudUpdate();
    vehHudMaybe();
    chipsUpdate();
  }
}

function updateGnomeVisual(dt) {
  const sp01 = clamp((S.speed - 16) / 24, 0, 1);
  const boardLift = 0;
  gnome.root.visible = true;
  const base = GROUND + S.y + boardLift;
  gnome.root.position.set(S.x, base, 0);
  gnome.boardGroup.position.y = -0.3;
  if (S.pw.board > 0) gnome.boardGroup.children[0]?.userData.update?.(dt, S.t);
  const aim = S.aim ? { aim: S.aim.side, fireT: S.aim.t } : {};

  // voertuig
  let vehState = null;
  if (S.veh) {
    const m = getVehicleModel(S.veh.id);
    m.visible = true;
    m.position.set(S.x, GROUND + S.y, 0);
    m.rotation.y = S.veh.id === 'train' ? Math.PI : 0;
    m.rotation.z = -S.vx * 0.02;
    m.userData.update(dt, S.t, sp01);
    const seat = m.userData.seatY;
    gnome.root.position.y = GROUND + S.y + seat - 0.52 + (S.veh.id === 'cow' ? Math.abs(Math.sin(S.t * 8)) * 0.05 : 0);
    vehState = S.veh.id === 'wheelchair' ? 'sit' : S.veh.id === 'cow' ? 'ride' : 'surf';
  }

  if (S.mode === 'menu') {
    gnome.root.rotation.y = Math.PI;
    gnome.update('idle', dt, S.t);
    return;
  }
  if (S.mode === 'intro') {
    const run = S.introT - S.launchT;
    if (S.introVariant === 2) {
      gnome.root.rotation.y = 0;
      gnome.update('run', dt, S.t, 0.5, S.vx, { emotion: 'scared' });
    } else if (!S.launched) {
      // staat tegenover de boze kabouters, bibbert van angst
      gnome.root.rotation.y = Math.PI;
      gnome.update('scared', dt, S.t);
    } else {
      gnome.root.rotation.y = lerp(gnome.root.rotation.y, 0, Math.min(1, dt * 8));
      if (!S.grounded && S.y > 0.1) gnome.update('tumble', dt, S.t, 0, 0, { k: Math.min(1, run * 0.9) * 0.5 + run * 0.4 });
      else gnome.update('run', dt, S.t, sp01, S.vx, { emotion: 'scared' });
    }
    return;
  }
  if (S.mode === 'dead') {
    S.deadT += dt;
    gnome.root.rotation.y = 0;
    gnome.root.rotation.x = 0;
    if (S.deadKind === 'splat') {
      gnome.update('splat', dt, S.t, 0, 0, { k: S.deadT });
      gnome.root.position.z = -0.12;
      if (S.deadT > 2.8) {
        stars.visible = true;
        stars.position.set(S.x, GROUND + 0.25, 0.8);
      }
    } else {
      gnome.update('tumble', dt, S.t, 0, 0, { k: S.deadT });
      stars.visible = S.deadT > 0.3;
      stars.position.set(S.x, GROUND + 0.4, -0.2);
    }
    stars.children.forEach((st, i) => {
      const a = S.t * 5 + (i * Math.PI) / 2;
      st.position.set(Math.cos(a) * 0.5, 0.9, Math.sin(a) * 0.35 - 0.3);
      st.rotation.y += dt * 6;
    });
    return;
  }
  gnome.root.rotation.y = 0;
  const extra = { ...aim, vy: S.vy, jumpStyle: S.jumpStyle, airT: S.airT };
  if (vehState) gnome.update(vehState, dt, S.t, sp01, S.vx, extra);
  else if (S.flying) gnome.update('fly', dt, S.t, sp01, S.vx, extra);
  else if (!S.grounded) gnome.update('jump', dt, S.t, sp01, S.vx, extra);
  else if (S.rolling) gnome.update('roll', dt, S.t, sp01, 0, { rollT: S.rollTime / ROLL_TIME });
  else gnome.update('run', dt, S.t, sp01, S.vx, extra);
  if (S.mode === 'playing' && S.grounded && !S.rolling && !S.flying && !S.veh && rand() < dt * 18) sparks.emit(S.x + (rand() - 0.5) * 0.3, S.y + 0.1, 0.1, 1, '#b9b2a0', 1.2, 0.8);
  if (S.pw.shoes > 0 && S.grounded && rand() < dt * 25) sparks.emit(S.x, S.y + 0.05, 0, 1, '#6ac0ff', 1.5, 1.5);
}

// ---------------------------------------------------------------- camera
const camMenuPos = new THREE.Vector3();
const camMenuLook = new THREE.Vector3();
const camIntroPos = new THREE.Vector3(-6.4, 1.8, 2.6);
const camIntroLook = new THREE.Vector3(0.2, 1.25, 2.3);
const camPos = new THREE.Vector3(0, 3.7, 6.6);
const camLook = new THREE.Vector3(0, 1.3, -10);
const tmpPos = new THREE.Vector3();
const tmpLook = new THREE.Vector3();
const fromPos = new THREE.Vector3();
const fromLook = new THREE.Vector3();
let camDist = 7.4;
let camBlend = 0;
let camFrom = null; // null = menu, 'intro' = introcamera

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
  const inGame = S.mode === 'playing' || S.mode === 'paused' || S.mode === 'dead';
  let want = inGame ? 1 : 0;
  if (S.mode === 'intro') want = S.launched ? 1 : 0;
  const rate = S.mode === 'intro' ? 1.0 : want ? 3 : 3;
  camBlend += clamp(want - camBlend, -rate * dt, rate * dt);
  const e = camBlend * camBlend * (3 - 2 * camBlend);

  const k = camDist / 6.6;
  const fly = S.flying ? S.y * 0.35 : 0;
  const lift = S.y > 2 && !S.flying ? (S.y - 2) * 0.25 : 0;
  tmpPos.set(S.x * 0.55, (3.7 + (S.flying ? 0 : S.y * 0.25) + fly) * Math.pow(k, 0.85) + lift, camDist + (S.veh ? 1.2 : 0));
  tmpLook.set(S.x * 0.4, 1.3 + S.y * 0.3 + fly * 0.4, -10);
  camPos.lerp(tmpPos, 1 - Math.exp(-9 * dt));
  camLook.lerp(tmpLook, 1 - Math.exp(-9 * dt));

  if (camFrom === 'intro') { fromPos.copy(camIntroPos); fromLook.copy(camIntroLook); }
  else { fromPos.copy(camMenuPos); fromLook.copy(camMenuLook); }
  camera.position.lerpVectors(fromPos, camPos, e);
  const look = tmpLook.lerpVectors(fromLook, camLook, e);

  if (S.shake > 0) {
    S.shake = Math.max(0, S.shake - dt * 1.6);
    const a = S.shake * 0.35;
    camera.position.x += (rand() - 0.5) * a;
    camera.position.y += (rand() - 0.5) * a;
  }
  const baseFov = camera.aspect < 1 ? 74 : 58;
  const fov = baseFov + (S.speed / 40) * (S.speedMul > 1 ? 9 : 5) * e;
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
  if (S.mode !== 'paused' && !window.__freeze) update(dt);
  if (!window.__freeze) updateCamera(dt);
  renderer.render(scene, camera);
}

initInput(document.body, action);
$('btnPlay').addEventListener('click', startRun);
$('btnAgain').addEventListener('click', startRun);
$('btnOverMenu').addEventListener('click', goMenu);
$('btnPauseMenu').addEventListener('click', goMenu);
$('btnResume').addEventListener('click', () => setPaused(false));
$('btnPause').addEventListener('click', () => setPaused(true));
$('btnShop').addEventListener('click', () => openShop('menu'));
$('btnOverShop').addEventListener('click', () => openShop('over'));
$('shopClose').addEventListener('click', closeShop);
$('btnLeader').addEventListener('click', () => openBoard('menu'));
$('leaderClose').addEventListener('click', closeBoard);
document.querySelectorAll('#shop .tab').forEach((b) => b.addEventListener('click', () => {
  shopTab = b.dataset.tab;
  document.querySelectorAll('#shop .tab').forEach((x) => x.classList.toggle('on', x === b));
  renderShop();
}));
document.querySelectorAll('#leader .tab').forEach((b) => b.addEventListener('click', () => {
  boardTab = b.dataset.board;
  document.querySelectorAll('#leader .tab').forEach((x) => x.classList.toggle('on', x === b));
  renderBoardList();
}));
$('nameInput').addEventListener('input', (e) => {
  const n = cleanName(e.target.value);
  P.name = n;
  save();
});
$('vehBtn').addEventListener('click', () => action('vehicle'));
$('btnSound').addEventListener('click', () => {
  audio.unlock();
  audio.setMuted(!audio.muted);
  updateSoundIcon();
});
$('skipHint').addEventListener('pointerdown', () => action('confirm'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden && S.mode === 'playing') setPaused(true);
});
window.addEventListener('blur', () => {
  if (S.mode === 'playing') setPaused(true);
});

// alle treintypes vooraf bouwen, zodat er tijdens het spelen niets haperen
['sprinter', 'sprinter_gr', 'sprinter_st', 'intercity', 'intercity_gr', 'international', 'vintage', 'freight'].forEach((t) => {
  (trainPool[t + 1] ||= []).push(createTrain(t, 1, rand));
});

// ---- uitleg
initTutorial({
  id: 'te-un-surfers', title: 'Te-Un Surfers',
  steps: [
    { icon: '🚆', title: 'Ren voor je leven!', lines: ['Te-Un rent over het spoor en probeert de boze kabouters voor te blijven. Zo ver mogelijk rennen en munten pakken geeft de hoogste score.', 'Score = afstand + <b>10 punten per munt</b>.'] },
    { icon: '🎮', title: 'Zo bestuur je Te-Un', lines: ['<kbd>←</kbd> <kbd>→</kbd> of <kbd>A</kbd> <kbd>D</kbd>: een spoor opzij', '<kbd>↑</kbd> of <kbd>W</kbd>: springen &nbsp; <kbd>↓</kbd> of <kbd>S</kbd>: rollen', 'Op een telefoon: swipe naar links, rechts, omhoog of omlaag.'] },
    { icon: '🚧', title: 'Ontwijk de obstakels', lines: ['Spring over barrières, rol onder hoge dingen door en ren niet tegen rijdende treinen aan. Via een schans kom je op het dak van een trein, daar liggen extra munten!', 'Raak je de zijkant van een trein, dan komen de <b>boze kabouters</b> achter je aan. Gebeurt het nog een keer, dan pakken ze je.'] },
    { icon: '💦', title: 'Treinspotters pakken', lines: ['Treinspotters staan langs het spoor. Druk op <kbd>F</kbd> (of dubbelklik, op een telefoon dubbeltik) om ze te pakken. Ze lopen je niet zomaar dood!', 'Je pakt ze met het waterpistool, of met een fluitje of camera als je die skin hebt. Dat geeft <b>25 munten</b>, en een spotter met een oranje shirt wel <b>100</b>.'] },
    { icon: '⚡', title: 'Power-ups en winkel', lines: ['Onderweg vind je schoenen, een vliegtuigje, een magneet, een oranje shirt of drinkhoed met vest en een refill voor je voertuig.', 'Met je munten koop je in de winkel een rolstoel, koe of NS-trein. Die zet je aan met de <kbd>spatiebalk</kbd> en geven snelheid en extra munten.', 'Haal <b>50.000 punten</b> of koop alles, dan speel je speciale profielfoto\'s vrij.'] },
  ],
});

// ---- developer-modus (knopje Dev linksboven, met wachtwoord)
function devCoins(amount) {
  P.coins += amount;
  save();
  audio.unlock();
  audio.powerup();
  refreshMenuStats();
  if (!$('shop').hidden) renderShop();
  return '+' + amount.toLocaleString('nl-NL') + ' munten';
}
initDev([
  { label: '+100.000 munten', run: () => devCoins(100000) },
  { label: '+1.000.000 munten', run: () => devCoins(1000000) },
  { label: 'Alles kopen (voertuigen, skins, kleding)', run: () => { Object.keys(PRICES).forEach((k) => { P.owned[k] = true; }); P.vehicle = P.vehicle || 'wheelchair'; save(); refreshMenuStats(); if (!$('shop').hidden) renderShop(); return 'Alles gekocht'; } },
  { label: 'Oneindig refill (tijdens een rit)', run: () => {
    if (S.mode !== 'playing' && S.mode !== 'intro') return 'Start eerst een rit';
    S.infRefill = true;
    const id = P.vehicle;
    if (id && owns(id)) S.vehCharge[id] = 1;
    lastVehKey = '';
    audio.powerup();
    return 'Oneindig refill aan';
  } },
]);

updateSoundIcon();
goMenu();
initBridge({
  onProgress: () => {
    refreshMenuStats();
    if (S.mode === 'menu' && gnomeSkin !== P.skin) buildGnome();
    lastVehKey = '';
  },
});
camera.position.copy(camMenuPos);
camera.lookAt(camMenuLook);
renderer.compile(scene, camera);
requestAnimationFrame((t) => {
  last = t;
  frame(t);
  $('loading').hidden = true;
});

window.addEventListener('teun:pause', () => { if (S.mode === 'playing') setPaused(true); });
window.__game = {
  S, P, scene, camera, world, renderer, obstacles, coinList, spotters, pickups, action, startRun, die, skipIntro, gnome: () => gnome,
  step(n = 1, dt = 1 / 60) {
    for (let i = 0; i < n; i++) { update(dt); updateCamera(dt); }
  },
  freeze(on = true) { window.__freeze = on; },
  spawn(n = 1) {
    for (let i = 0; i < n; i++) { cursor = -40; S.hazardT = 0; spawnWrapped(); }
  },
  buyAll() { Object.keys(PRICES).forEach((k) => { P.owned[k] = true; }); P.vehicle = P.vehicle || 'wheelchair'; P.coins += 100000; save(); },
  isOnline,
};
void softCircleTexture;
