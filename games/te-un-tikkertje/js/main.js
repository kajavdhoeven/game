// Te-Un Tikkertje: menu, winkel en spelverloop. Alles wordt in de browser getekend, er is geen build nodig.
import { initDev, setDevVisible } from '/js/devmode.js';
import { initTutorial } from '/js/tutorial.js';
import { Game } from './sim.js';
import { CW, CH, BIOMES, buildBackdrop, drawGnome, drawScene } from './draw.js';

const GAME_ID = 'te-un-tikkertje';
const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// de personages in de winkel
const SHOP = [
  { id: 'teun', name: 'Te-Un', price: 0, desc: 'Gewoon Te-Un. Niets bijzonders, maar altijd van jou.' },
  { id: 'speed', name: 'Tyfus snelle Te-Un', price: 25, desc: 'Rent 2x zo snel, behalve als hij de tikker is.' },
  { id: 'shadow', name: 'Schaduw Te-Un', price: 75, desc: '1x per potje op spatie: 5 seconden een schim. De NPC\'s zien je niet en kunnen je niet tikken.' },
  { id: 'wizard', name: 'Tovenaar Te-Un', price: 100, desc: '1x per potje: spatie zet een portaal neer, nog een keer spatie en je teleporteert er weer naartoe.' },
];
const ABIL = { wizard: ['Portaal plaatsen', 'Teleporteren'], shadow: ['Schim worden'] };

// ---------------------------------------------------------------- opslaan + platform
const KEY = 'te-un-tikkertje-v1';
let P = { coins: 0, owned: {}, sel: 'teun', wins: 0, games: 0, dev: false, updatedAt: 0 };
try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* geen opslag */ }
const snapshot = () => ({ coins: P.coins, owned: P.owned, sel: P.sel, wins: P.wins, games: P.games, dev: P.dev, tikker: !!P.tikker, updatedAt: P.updatedAt });
const post = (type, extra = {}) => {
  if (window.parent === window) return;
  try { window.parent.postMessage({ type, game: GAME_ID, ...extra }, location.origin); } catch (e) { /* geen ouder */ }
};
let saveTimer = null;
function save(quiet) {
  if (!quiet) P.updatedAt = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(snapshot())); } catch (e) { /* geen opslag */ }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => post('teun:save', { data: snapshot() }), 500);
}
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const m = e.data;
  if (!m || m.game !== GAME_ID || m.type !== 'teun:progress' || !m.data) return;
  const d = m.data;
  if ((d.updatedAt || 0) > (P.updatedAt || 0)) { Object.assign(P, d); save(true); refresh(); }
  else if ((d.updatedAt || 0) < (P.updatedAt || 0)) post('teun:save', { data: snapshot() });
});
const owns = (id) => id === 'teun' || P.dev || !!P.owned[id];
if (!owns(P.sel)) P.sel = 'teun';

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
  jump: () => beep(320, 0.12, 'square', 0.04, 0, 240),
  tag: () => { beep(520, 0.1, 'square', 0.1); beep(330, 0.18, 'square', 0.1, 0.08); },
  go: () => beep(880, 0.25, 'triangle', 0.14),
  tick: () => beep(660, 0.08, 'triangle', 0.1),
  elim: () => beep(300, 0.5, 'sawtooth', 0.1, 0, -220),
  portal: () => beep(500, 0.3, 'sine', 0.12, 0, 400),
  teleport: () => beep(900, 0.25, 'sine', 0.12, 0, -500),
  shadow: () => beep(200, 0.5, 'sine', 0.12, 0, 300),
  win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.22, 'triangle', 0.12, i * 0.12)),
  buy: () => { beep(880, 0.1, 'triangle', 0.12); beep(1320, 0.16, 'triangle', 0.1, 0.08); },
};
const toast = (t) => { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2200); };

// ---------------------------------------------------------------- schermen
const SCREENS = ['menu', 'modeSel', 'biomeSel', 'shop', 'play'];
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  setDevVisible(id !== 'play');
  if (id === 'play') requestAnimationFrame(fit);
}
function refresh() {
  $('coinN').textContent = P.coins; $('shopCoins').textContent = P.coins;
  renderShop();
}

// ---------------------------------------------------------------- winkel
function renderShop() {
  const list = $('shopList');
  list.innerHTML = '';
  for (const it of SHOP) {
    const own = owns(it.id), sel = P.sel === it.id;
    const card = document.createElement('div');
    card.className = 'pick' + (sel ? ' sel' : '');
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 150;
    const g = cv.getContext('2d');
    drawGnome(g, { type: it.id, shirt: '#2f6fe0', face: 1, vx: 0, grounded: true, walk: 0, invisT: 0, immuneT: 0 }, 0, { px: 100, py: 128, scale: 1.55, still: true });
    const b = document.createElement('button');
    b.className = 'small';
    if (sel) { b.textContent = 'Gekozen'; b.disabled = true; }
    else if (own) { b.textContent = 'Kiezen'; b.onclick = () => { P.sel = it.id; save(); refresh(); }; }
    else {
      b.textContent = `Kopen (${it.price})`; b.disabled = P.coins < it.price;
      b.onclick = () => { if (P.coins < it.price) return; P.coins -= it.price; P.owned[it.id] = true; P.sel = it.id; save(); SFX.buy(); refresh(); toast(it.name + ' is van jou!'); };
    }
    card.innerHTML = `<b>${it.name}</b>`;
    card.appendChild(cv);
    const small = document.createElement('small'); small.textContent = it.desc; card.appendChild(small);
    if (it.price) { const pr = document.createElement('div'); pr.className = 'price'; pr.textContent = own ? 'Gekocht' : `🪙 ${it.price}`; card.appendChild(pr); }
    card.appendChild(b);
    list.appendChild(card);
  }
}

// ---------------------------------------------------------------- spelen
const canvas = $('cv'); canvas.width = CW; canvas.height = CH;
const g2 = canvas.getContext('2d');
const COARSE = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches); // op een telefoon is er geen 2 spelers
let game = null, backdrop = null, cfg = { mode: 'normal', biome: 'forest', players: 1 };
let paused = false, last = 0, acc = 0, banner = null;
const keys = new Set();
const touch = { l: 0, r: 0, u: 0 };
let abilPress = false;

function fit() {
  const stage = $('stage');
  const s = Math.min(stage.clientWidth / CW, stage.clientHeight / CH);
  canvas.style.width = Math.floor(CW * s) + 'px';
  canvas.style.height = Math.floor(CH * s) + 'px';
}
window.addEventListener('resize', fit);

function startGame() {
  const two = cfg.players === 2 && !COARSE;
  game = new Game({ mode: cfg.mode, type: two ? 'teun' : P.sel, players: two ? 2 : 1, biome: cfg.biome });
  backdrop = buildBackdrop(cfg.biome);
  paused = false; acc = 0; last = performance.now();
  $('result').hidden = true; $('pauseBox').hidden = true;
  const ab = $('abil');
  ab.hidden = two || !ABIL[P.sel];
  show('play');
  setBanner(null);
  updateAbil();
  actx && actx.state === 'suspended' && actx.resume();
}
function setBanner(text, ms) {
  const el = $('banner');
  clearTimeout(setBanner.t);
  if (!text) { el.hidden = true; return; }
  el.textContent = text; el.hidden = false;
  if (ms) setBanner.t = setTimeout(() => { el.hidden = true; }, ms);
}
function updateAbil() {
  const me = game.chars[0], ab = $('abil');
  if (!ABIL[P.sel] || game.players === 2) return;
  const st = me.stage;
  const label = P.sel === 'wizard' ? (st === 0 ? 'Portaal plaatsen' : st === 1 ? 'Teleporteren' : 'Gebruikt') : (st === 0 ? 'Schim worden' : me.invisT > 0 ? 'Schim: ' + Math.ceil(me.invisT) : 'Gebruikt');
  ab.disabled = !me.alive || st >= (P.sel === 'wizard' ? 2 : 1);
  ab.textContent = label + ' [spatie]';
}
function who(list) { return list.map((c) => c.name).join(' en '); }

function handleEvents() {
  for (const e of game.events.splice(0)) {
    if (SFX[e.t]) SFX[e.t]();
    if (e.t === 'round') {
      const its = game.chars.filter((c) => c.it);
      setBanner(`Ronde ${e.n}\n${game.players === 1 && its.some((c) => c.player) ? 'Jij bent de tikker!' : who(its) + (its.length > 1 ? ' zijn' : ' is') + ' de tikker'}`);
    }
    if (e.t === 'go') setBanner('GO!', 700);
    if (e.t === 'elim') { const c = game.chars[e.id]; setBanner(c.name === 'Jij' ? 'Jij bent af!' : `${c.name} is af!`, 2000); }
    if (e.t === 'badge' && e.id === 0 && !P.tikker) { P.tikker = true; save(); toast('Badge verdiend: Te-Un tikker!'); SFX.buy(); }
    if (e.t === 'over') finish(e);
  }
}
function finish(e) {
  const win = e.rank === 1;
  P.coins += e.coins; P.games++; if (win) P.wins++;
  save();
  if (win) SFX.win();
  const ord = (r) => (r === 1 ? '1e' : r + 'e');
  if (game.players === 2) {
    $('resTitle').textContent = 'Klaar!';
    $('resText').textContent = `Speler 1: ${ord(e.ranks[0])} plek. Speler 2: ${ord(e.ranks[1])} plek.` + (e.coins ? ` Speler 1 krijgt ${e.coins} munten.` : '');
  } else {
    $('resTitle').textContent = win ? 'Je hebt gewonnen!' : `Je bent ${e.rank}e geworden`;
    $('resText').textContent = e.coins ? `Je krijgt ${e.coins} munten. Je hebt nu ${P.coins} munten.` : `Geen munten dit keer. Je hebt ${P.coins} munten.`;
  }
  setBanner(null);
  $('result').hidden = false;
  refresh();
}

function readInput() {
  const k = (c) => keys.has(c);
  if (game && game.players === 2) { // speler 1: A D W, speler 2: de pijltjes
    return [
      { dir: (k('KeyD') ? 1 : 0) - (k('KeyA') ? 1 : 0), jump: k('KeyW') },
      { dir: (k('ArrowRight') ? 1 : 0) - (k('ArrowLeft') ? 1 : 0), jump: k('ArrowUp') },
    ];
  }
  const dir = ((k('ArrowRight') || k('KeyD') || touch.r) ? 1 : 0) - ((k('ArrowLeft') || k('KeyA') || touch.l) ? 1 : 0);
  const jump = k('ArrowUp') || k('KeyW') || touch.u > 0;
  return { dir, jump, ability: abilPress };
}
let lastTick = 0, lastNum = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!game || $('play').hidden) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) {
    const input = readInput();
    acc += dt;
    let first = true;
    const noAbil = Array.isArray(input) ? input : { dir: input.dir, jump: input.jump };
    while (acc >= 1 / 120) { game.step(1 / 120, first ? input : noAbil); if (first && !Array.isArray(input) && input.ability) abilPress = false; first = false; acc -= 1 / 120; }
    handleEvents();
    const t = Math.max(0, game.roundT);
    $('hTime').textContent = fmt(Math.ceil(t));
    $('hTime').classList.toggle('low', t <= 10 && game.state === 'play');
    if (game.state === 'play' && t <= 10 && Math.ceil(t) !== lastTick) { lastTick = Math.ceil(t); SFX.tick(); }
    $('hRound').textContent = `Ronde ${game.round}`;
    $('hAlive').textContent = `${game.alive().length} over`;
    updateAbil();
    if (game.state === 'intro' && game.stateT < 1.5) { const n = Math.ceil(game.stateT / 0.5); if (n !== lastNum) { lastNum = n; setBanner(String(n)); SFX.tick(); } } else lastNum = 0;
  }
  drawScene(g2, game, backdrop, now / 1000);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- bediening
const GK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space']);
window.addEventListener('keydown', (e) => {
  if ($('play').hidden || e.ctrlKey || e.metaKey) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (GK.has(e.code)) { e.preventDefault(); if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'Space' && !e.repeat && game && game.players === 1) abilPress = true;
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
function togglePause(force) {
  if (!game || game.state === 'over') return;
  paused = force === undefined ? !paused : force;
  $('pauseBox').hidden = !paused;
}
document.querySelectorAll('.pad button').forEach((b) => {
  const k = b.dataset.k;
  const set = (v) => (e) => { e.preventDefault(); touch[k] = v ? 1 : 0; b.classList.toggle('on', !!v); };
  b.addEventListener('pointerdown', set(true));
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, set(false));
  b.addEventListener('contextmenu', (e) => e.preventDefault());
});
$('abil').addEventListener('pointerdown', (e) => { e.preventDefault(); abilPress = true; });

$('mPlay').onclick = () => show('modeSel');
$('mShop').onclick = () => { refresh(); show('shop'); };
$('shopBack').onclick = () => show('menu');
$('modeBack').onclick = () => show('menu');
$('biomeBack').onclick = () => show('modeSel');
document.querySelectorAll('[data-mode]').forEach((b) => { b.onclick = () => { cfg.mode = b.dataset.mode; show('biomeSel'); }; });
document.querySelectorAll('[data-pl]').forEach((b) => { b.onclick = () => { cfg.players = +b.dataset.pl; document.querySelectorAll('[data-pl]').forEach((x) => x.classList.toggle('on', x === b)); }; });
if (COARSE) $('plSel').hidden = true;
document.querySelectorAll('[data-biome]').forEach((b) => {
  const id = b.dataset.biome;
  const cv = b.querySelector('canvas');
  cv.getContext('2d').drawImage(buildBackdrop(id), 0, 0, cv.width, cv.height);
  b.onclick = () => { cfg.biome = id; startGame(); };
});
$('resume').onclick = () => togglePause(false);
$('pQuit').onclick = () => { game = null; show('menu'); };
$('resAgain').onclick = () => startGame();
$('resMenu').onclick = () => { game = null; refresh(); show('menu'); };
$('pauseBtn').onclick = () => togglePause();

// ---------------------------------------------------------------- start
refresh();
show('menu');
initTutorial({
  id: GAME_ID, title: 'Te-Un Tikkertje',
  steps: [
    { icon: '🏃', title: 'Tikkertje', lines: ['Je speelt tikkertje met 3 andere kabouters (hun shirt heeft een andere kleur). De <b>tikker</b> herken je aan het <b>witte pijltje</b> boven zijn hoofd. Als jij de tikker bent, tik je iemand door tegen hem aan te lopen. Je kunt wel gewoon door elkaar heen lopen.'] },
    { icon: '⏱️', title: 'Een minuut per ronde', lines: ['Na <b>1 minuut</b> gaat de tikker eruit. Een NPC die eruit gaat? Dan gaat het spel door met de rest. Ga jij eruit, dan is het afgelopen. Zorg dus dat je de tikker niet bent als de tijd om is!'] },
    { icon: '⌨️', title: 'Besturing', lines: ['<kbd>←</kbd> <kbd>→</kbd> of <kbd>A</kbd> <kbd>D</kbd> lopen, <kbd>↑</kbd> of <kbd>W</kbd> springen. Je springt van onderaf <b>door</b> een platform heen, maar je valt er niet doorheen als je erop staat. Op een telefoon gebruik je de knoppen onderin.', 'Heb je een speciaal personage? Dan gebruik je zijn kracht met <kbd>Spatie</kbd>.'] },
    { icon: '🦘', title: 'Trampoline', lines: ['Aan een kant van de map staat een <b>trampoline</b>. Spring erop en je wordt hoog de lucht in gelanceerd, zodat je meteen bij de bovenste platforms bent. De NPC-kabouters kunnen ook een speciaal personage zijn en gebruiken hun krachten echt!'] },
    { icon: '👥', title: '2 spelers', lines: ['Op een computer kun je met twee spelers op één toetsenbord spelen: speler 1 (blauw) met <kbd>A</kbd> <kbd>D</kbd> <kbd>W</kbd>, speler 2 (rood) met de <kbd>pijltjes</kbd>. Dan kun je geen ander personage kiezen. Het spel gaat door tot jullie allebei af zijn. Op een telefoon is er geen 2 spelers.'] },
    { icon: '⚔️', title: 'Normaal en hardcore', lines: ['Bij <b>Normaal</b> is er steeds 1 tikker. Bij <b>Hardcore</b> zijn er in ronde 1 twee tikkers, dus gaan er twee kabouters tegelijk uit.'] },
    { icon: '🪙', title: 'Munten en winkel', lines: ['Winnen levert <b>15</b> munten op, de 2e plek <b>10</b>, de 3e plek <b>5</b> en de 4e niets. In de winkel koop je de Tyfus snelle Te-Un (25), de Schaduw Te-Un (75) en de Tovenaar Te-Un (100). Heb je ze alle drie, dan krijg je de profielfoto Tovenaar Te-Un. Ben je in één ronde 50 seconden of langer de tikker geweest, dan krijg je de badge Te-Un tikker.'] },
  ],
});
initDev([
  { label: '500 munten erbij', run: () => { P.coins += 500; save(); refresh(); return 'Je hebt nu ' + P.coins + ' munten'; } },
  { label: 'Te-Un tikker-badge krijgen', run: () => { P.tikker = true; save(); return 'Badge gekregen'; } },
  { label: 'Alle personages krijgen', run: () => { P.owned = { speed: true, shadow: true, wizard: true }; save(); refresh(); return 'Alle personages gekocht'; } },
]);
post('teun:ready');
window.addEventListener('teun:pause', () => { if (game && game.state !== 'over') { paused = true; } });
window.addEventListener('teun:resume', () => { if (game && $('pauseBox').hidden) paused = false; });
window.__tk = { get game() { return game; }, startGame, cfg, P };
