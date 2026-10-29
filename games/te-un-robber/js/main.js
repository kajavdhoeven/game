// Te-Un the Robber: menu, spelverloop en opslag. Alles wordt in de browser getekend, er is geen build nodig.
import { initDev, setDevVisible } from '/js/devmode.js';
import { initTutorial } from '/js/tutorial.js';
import { submitTime, openTimeBoard } from '/js/leaderboard.js';
import { Game } from './sim.js';
import { levelFor, LEVEL_COUNT, THEMES, colorName } from './levels.js';
import { CW, CH, buildStatic, drawScene } from './draw.js';

const GAME_ID = 'te-un-robber';
const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- opslaan + platform
const KEY = 'te-un-robber-v1';
let P = { done: {}, dev: false, updatedAt: 0 };
try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* geen opslag */ }
const snapshot = () => ({ done: P.done, dev: P.dev, updatedAt: P.updatedAt });
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
  if ((d.updatedAt || 0) > (P.updatedAt || 0)) { P.done = Object.assign({}, d.done || {}); P.updatedAt = d.updatedAt; save(true); renderMenu(); }
  else if ((d.updatedAt || 0) < (P.updatedAt || 0)) post('teun:save', { data: snapshot() });
});
const unlocked = (n) => n === 1 || P.dev || !!P.done[n - 1];

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
  grab: () => { beep(880, 0.1, 'triangle', 0.12); beep(1320, 0.16, 'triangle', 0.1, 0.08); },
  hacked: () => [660, 880, 1100].forEach((f, i) => beep(f, 0.09, 'square', 0.06, i * 0.07)),
  switch: () => beep(220, 0.15, 'square', 0.1),
  key: () => { beep(1000, 0.08, 'triangle', 0.1); beep(1500, 0.1, 'triangle', 0.1, 0.07); },
  unlock: () => beep(300, 0.2, 'sawtooth', 0.08, 0, 200),
  portal: () => beep(400, 0.3, 'sine', 0.08, 0, 200),
  hide: () => beep(200, 0.1, 'sine', 0.08),
  stun: () => beep(700, 0.2, 'sawtooth', 0.1, 0, -500),
  caught: () => { beep(500, 0.25, 'square', 0.12); beep(300, 0.4, 'square', 0.12, 0.2, -150); },
  timeup: () => beep(250, 0.6, 'sawtooth', 0.1, 0, -150),
  win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, 'triangle', 0.12, i * 0.11)),
  work: () => beep(500, 0.05, 'square', 0.04),
};
const toast = (t) => { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2400); };

// ---------------------------------------------------------------- menu
function renderMenu() {
  const box = $('levels');
  box.innerHTML = '';
  for (let n = 1; n <= LEVEL_COUNT; n++) {
    const d = P.done[n], open = unlocked(n);
    const b = document.createElement('button');
    b.className = 'lvl' + (d ? ' done' : '');
    b.disabled = !open;
    b.innerHTML = `<b>${n}</b><small>${THEMES[n - 1].name.replace(/^(Het |De )/, '')}</small><span class="st">${d ? '★'.repeat(d.stars) + '☆'.repeat(3 - d.stars) : ''}</span>`;
    b.onclick = () => startLevel(n);
    box.appendChild(b);
  }
}
function show(id) {
  $('menu').hidden = id !== 'menu'; $('play').hidden = id !== 'play';
  setDevVisible(id === 'menu');
  if (id === 'play') requestAnimationFrame(fit);
}

// ---------------------------------------------------------------- spelen
const canvas = $('cv'); canvas.width = CW; canvas.height = CH;
const g2 = canvas.getContext('2d');
let game = null, stat = null, cur = 0, paused = false, last = 0, acc = 0;
const keys = new Set();
const touch = { l: 0, r: 0, u: 0, d: 0 };
let actPress = false;

function fit() {
  const st = $('stage');
  const s = Math.min(st.clientWidth / CW, st.clientHeight / CH);
  canvas.style.width = Math.floor(CW * s) + 'px';
  canvas.style.height = Math.floor(CH * s) + 'px';
}
window.addEventListener('resize', fit);

function startLevel(n) {
  cur = n;
  const L = levelFor(n);
  game = new Game(L);
  stat = buildStatic(L);
  paused = false; acc = 0; last = performance.now();
  $('lvName').textContent = `${n}. ${L.theme.name}`;
  $('overlay').hidden = true; $('pauseBox').hidden = true;
  show('play');
  buildGoals();
  setBanner(`${L.theme.name}\n${L.theme.sub}`, 2800);
  actx && actx.state === 'suspended' && actx.resume();
}
function setBanner(text, ms) {
  const el = $('banner');
  clearTimeout(setBanner.t);
  if (!text) { el.hidden = true; return; }
  el.textContent = text; el.hidden = false;
  if (ms) setBanner.t = setTimeout(() => { el.hidden = true; }, ms);
}
const GOAL = { doc: ['📄', 'Papieren'], loot: ['💰', 'Buit'], hack: ['💻', 'Hacken'], switch: ['🔴', 'Lasers uit'] };
function buildGoals() {
  const types = {};
  for (const it of game.L.items) if (it.req) (types[it.type] = types[it.type] || []).push(it);
  $('goals').innerHTML = Object.entries(types).map(([t, l]) => `<span class="goal" data-t="${t}">${GOAL[t][0]} ${GOAL[t][1]} <span>0</span>/${l.length}</span>`).join('') + '<span class="goal" data-t="exit">🚪 Uitgang</span>';
}
function updateHud() {
  const g = game;
  const left = g.timeLeft();
  $('clock').textContent = fmt(Math.ceil(left));
  $('clock').classList.toggle('low', left < 15);
  const types = {};
  for (const it of g.items) if (it.req) { const o = (types[it.type] = types[it.type] || { done: 0, all: 0 }); o.all++; if (it.done) o.done++; }
  $('goals').querySelectorAll('.goal').forEach((el) => {
    const t = el.dataset.t;
    if (t === 'exit') { el.classList.toggle('ok', g.exitOpen); return; }
    const o = types[t]; if (!o) return;
    el.querySelector('span').textContent = o.done; el.classList.toggle('ok', o.done === o.all);
  });
  $('keys').innerHTML = [...g.keys].filter((k) => k !== 'SW').map((c) => `<i title="${colorName(c)} sleutel" style="background:${c}"></i>`).join('');
}
function handleEvents() {
  for (const e of game.events.splice(0)) {
    if (SFX[e]) SFX[e]();
    if (e === 'unlock') setBanner('Deur open!', 1000);
    if (e === 'key') setBanner('Sleutel gevonden!', 1200);
    if (e === 'win') finish('won');
    if (e === 'caught') finish('caught');
    if (e === 'timeup') finish('timeup');
  }
}
function finish(kind) {
  const L = game.L;
  const ov = $('overlay');
  setBanner(null);
  $('ovStars').innerHTML = ''; $('ovBoard').hidden = true; $('ovNext').hidden = true;
  if (kind === 'won') {
    const used = game.t, base = L.base || L.limit / 3;
    const stars = used <= base * 1.35 + 4 ? 3 : used <= base * 1.9 + 8 ? 2 : 1; // sterren: hoe dicht je bij de snelste weg komt
    const prev = P.done[cur];
    if (!prev || stars > prev.stars || (stars === prev.stars && used < prev.time)) P.done[cur] = { stars: Math.max(stars, prev ? prev.stars : 0), time: Math.round(Math.min(used, prev && stars <= prev.stars ? prev.time : used) * 100) / 100 };
    save();
    submitTime(GAME_ID, 'l' + cur, Math.round(used * 100) / 100);
    $('ovTitle').textContent = 'Ontsnapt!';
    $('ovStars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}">★</i>`).join('');
    $('ovText').textContent = `Je was in ${fmt(used)} klaar, met ${fmt(L.limit - used)} over.`;
    $('ovNext').hidden = cur >= LEVEL_COUNT; $('ovBoard').hidden = false;
    renderMenu();
  } else if (kind === 'caught') {
    $('ovTitle').textContent = 'Gepakt!';
    $('ovText').textContent = game.why === 'laser' ? 'Die laserstraal was niet te missen.' : 'Een bewaker heeft je gezien. Wacht tot hij wegkijkt, of verstop je met de pijl omlaag.';
  } else {
    $('ovTitle').textContent = 'Tijd om!';
    $('ovText').textContent = 'De politie is onderweg. Probeer het nog eens, wat sneller.';
  }
  ov.hidden = false;
}

function readInput() {
  const k = (c) => keys.has(c);
  return {
    l: k('ArrowLeft') || k('KeyA') || touch.l, r: k('ArrowRight') || k('KeyD') || touch.r,
    u: k('ArrowUp') || k('KeyW') || touch.u, d: k('ArrowDown') || k('KeyS') || touch.d,
    act: actPress,
  };
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!game || $('play').hidden) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused && game.status === 'play') {
    const input = readInput();
    acc += dt;
    let first = true;
    while (acc >= 1 / 60) { game.step(1 / 60, first ? input : { ...input, act: false }); if (first && input.act) actPress = false; first = false; acc -= 1 / 60; }
    handleEvents();
    updateHud();
  }
  drawScene(g2, game, stat, now / 1000);
}
requestAnimationFrame(frame);

// ---------------------------------------------------------------- bediening
const GK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyE', 'Enter']);
window.addEventListener('keydown', (e) => {
  if ($('play').hidden || e.ctrlKey || e.metaKey) return;
  if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  if (GK.has(e.code)) { e.preventDefault(); if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur(); }
  if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'KeyR') { startLevel(cur); return; }
  if ((e.code === 'Space' || e.code === 'KeyE' || e.code === 'Enter') && !e.repeat) actPress = true;
  keys.add(e.code);
});
window.addEventListener('keyup', (e) => keys.delete(e.code));
window.addEventListener('blur', () => keys.clear());
function togglePause(force) {
  if (!game || game.status !== 'play') return;
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
$('actBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); actPress = true; $('actBtn').classList.add('on'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('actBtn').addEventListener(ev, () => $('actBtn').classList.remove('on'));
$('back').onclick = () => { game = null; renderMenu(); show('menu'); };
$('restart').onclick = () => startLevel(cur);
$('pauseBtn').onclick = () => togglePause();
$('resume').onclick = () => togglePause(false);
$('pRestart').onclick = () => startLevel(cur);
$('pMenu').onclick = () => $('back').click();
$('ovRetry').onclick = () => startLevel(cur);
$('ovMenu').onclick = () => $('back').click();
$('ovNext').onclick = () => startLevel(cur + 1);
const boardLevels = Array.from({ length: LEVEL_COUNT }, (_, i) => ({ key: 'l' + (i + 1), label: `${i + 1}. ${THEMES[i].name}` }));
const openBoard = (start) => openTimeBoard({ game: GAME_ID, title: 'Te-Un the Robber', levels: boardLevels, start });
$('mBoard').onclick = () => openBoard('l1');
$('ovBoard').onclick = () => openBoard('l' + cur);

// ---------------------------------------------------------------- start
renderMenu();
show('menu');
initTutorial({
  id: GAME_ID, title: 'Te-Un the Robber',
  steps: [
    { icon: '🥷', title: 'Sluip en pak de buit', lines: ['Je bent Te-Un, de dief. Loop door het gebouw, pak de <b>papieren</b>, de <b>buit</b> en alles wat in het lijstje bovenin staat, en ga dan naar de <b>uitgang</b> voordat de tijd om is.'] },
    { icon: '⌨️', title: 'Besturing', lines: ['<kbd>←</kbd> <kbd>→</kbd> lopen. <kbd>↑</kbd> en <kbd>↓</kbd> om een ladder te beklimmen of een trap of lift te nemen. <kbd>Spatie</kbd> om iets te pakken, een computer te hacken of een schakelaar om te zetten. Op een telefoon gebruik je de knoppen onderin.', '<kbd>R</kbd> start opnieuw, <kbd>Esc</kbd> pauzeert.'] },
    { icon: '🤖', title: 'Bewakers', lines: ['Robots kijken in een lichtkegel. Sta je daarin, dan vult het balkje boven je hoofd en word je gepakt. Wacht tot ze wegkijken. <b>Camera\'s</b> draaien heen en weer, <b>drones</b> vliegen rond, <b>slapers</b> worden af en toe wakker en <b>lasers</b> gaan aan en uit.', 'Verstoppen? Sta bij een kast, plant of kist en druk op <kbd>↓</kbd>. Dan zien ze je niet.'] },
    { icon: '🔑', title: 'Sleutels en schakelaars', lines: ['Een gekleurde deur gaat open met de sleutel van dezelfde kleur. Sommige lasers gaan pas uit als je de rode schakelaar hebt gevonden. Een zwakke robot kun je van achteren uitschakelen met <kbd>Spatie</kbd>: hij is dan 7 seconden uitgeschakeld. Een zware robot, een camera of een drone lukt niet.'] },
    { icon: '⭐', title: 'Sterren', lines: ['Hoe sneller je klaar bent, hoe meer sterren. Elk level is moeilijker dan het vorige: meer opdrachten, een kortere tijd en slimmere bewakers.'] },
  ],
});
initDev([
  { label: 'Alle levels openen', run: () => { P.dev = true; save(); renderMenu(); return 'Alle levels open'; } },
  { label: 'Alle levels als gehaald markeren (3 sterren)', run: () => { for (let i = 1; i <= LEVEL_COUNT; i++) P.done[i] = { stars: 3, time: 30 }; save(); renderMenu(); return 'Alles gehaald'; } },
  { label: 'Geen bewakers zien me (testen)', run: () => { if (!game) return 'Start eerst een level'; game.L.guards.length = 0; game.L.lasers.length = 0; game.stun.length = 0; return 'Bewakers uit voor dit level'; } },
]);
post('teun:ready');
window.addEventListener('teun:pause', () => { if (game && game.status === 'play') paused = true; });
window.addEventListener('teun:resume', () => { if (game && $('pauseBox').hidden) paused = false; });
window.__tr = { get game() { return game; }, startLevel, P };
