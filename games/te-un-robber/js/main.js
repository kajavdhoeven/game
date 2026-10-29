// Te-Un the Robber: menu, spelverloop en opslag. Alles wordt in de browser getekend, er is geen build nodig.
import { initDev, setDevVisible } from '/js/devmode.js';
import { initTutorial } from '/js/tutorial.js';
import { submitTime, openTimeBoard } from '/js/leaderboard.js';
import { Game } from './sim.js';
import { levelFor, LEVEL_COUNT } from './levels.js';
import { CW, CH, buildStatic, drawScene } from './draw.js';
import { CHAPTERS, LEVELS, CUTSCENES, levelMeta, chapterOf, BEFORE, AFTER } from './story.js';

const KLUISCODE = '4729';
// cutscene.js, exterior.js en citymap.js worden pas geladen als ze nodig zijn; ontbreekt er één, dan slaat het spel dat onderdeel over
const lazy = (name) => import(name).catch((e) => { console.warn('module laden mislukt', name, e); return null; });

const GAME_ID = 'te-un-robber';
const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ---------------------------------------------------------------- opslaan + platform
const KEY = 'te-un-robber-v1';
let P = { done: {}, dev: false, updatedAt: 0, seen: {}, codeL4: false };
try { P = Object.assign(P, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* geen opslag */ }
const snapshot = () => ({ done: P.done, dev: P.dev, updatedAt: P.updatedAt, seen: P.seen, codeL4: P.codeL4 });
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
  if ((d.updatedAt || 0) > (P.updatedAt || 0)) { P.done = Object.assign({}, d.done || {}); P.seen = Object.assign({}, d.seen || {}); P.codeL4 = !!d.codeL4; P.updatedAt = d.updatedAt; save(true); renderMenu(); }
  else if ((d.updatedAt || 0) < (P.updatedAt || 0)) post('teun:save', { data: snapshot() });
});
const unlocked = (n) => n === 1 || P.dev || !!P.done[n - 1];
const chapterOpen = (i) => i === 0 || P.dev || !!P.done[CHAPTERS[i - 1].levels[4]];
const nextOpenLevel = () => { for (let n = 1; n <= LEVEL_COUNT; n++) if (!P.done[n]) return n; return LEVEL_COUNT; };

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
  unlock: () => { beep(300, 0.2, 'sawtooth', 0.08, 0, 200); beep(900, 0.12, 'triangle', 0.08, 0.15); },
  spotted: () => { beep(900, 0.1, 'square', 0.08); beep(900, 0.1, 'square', 0.08, 0.14); },
  alarm: () => { for (let i = 0; i < 4; i++) beep(i % 2 ? 620 : 880, 0.18, 'square', 0.07, i * 0.2); },
  swing: () => beep(260, 0.18, 'sawtooth', 0.08, 0, -160),
  nohide: () => beep(180, 0.15, 'square', 0.07),
  pick: () => { beep(1200, 0.04, 'square', 0.05); beep(900, 0.04, 'square', 0.05, 0.12); },
  code: () => [700, 900, 1200, 1500].forEach((f, i) => beep(f, 0.12, 'triangle', 0.1, i * 0.08)),
  portal: () => beep(400, 0.3, 'sine', 0.08, 0, 200),
  hide: () => beep(200, 0.1, 'sine', 0.08),
  stun: () => beep(700, 0.2, 'sawtooth', 0.1, 0, -500),
  caught: () => { beep(500, 0.25, 'square', 0.12); beep(300, 0.4, 'square', 0.12, 0.2, -150); },
  timeup: () => beep(250, 0.6, 'sawtooth', 0.1, 0, -150),
  win: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, 'triangle', 0.12, i * 0.11)),
  work: () => beep(500, 0.05, 'square', 0.04),
};
const toast = (t) => { const el = $('toast'); el.textContent = t; el.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('on'), 2400); };

// ---------------------------------------------------------------- schermen: titel, stadskaart, spel, filmpjes
let mapCtl = null, mapChapter = 0, busy = false;
let ghost = false; try { ghost = sessionStorage.getItem('teun-robber-ghost') === '1'; } catch (e) { /* geen opslag */ }
const applyGhost = () => { if (!game) return; game.L.guards.length = 0; game.L.lasers.length = 0; game.stun.length = 0; game.gs.length = 0; };
const SCREENS = ['menu', 'map', 'play', 'cine'];
const getState = (n) => ({ unlocked: unlocked(n), done: !!P.done[n], stars: P.done[n] ? P.done[n].stars : 0 });
function renderMenu() {
  $('mPlay').textContent = P.done[1] ? 'Verder spelen' : 'Spelen';
  if (mapCtl) mapCtl.refresh(); else if (!$('map').hidden) renderFallbackMap();
}
function show(id) {
  for (const s of SCREENS) $(s).hidden = s !== id;
  setDevVisible(id === 'menu' || id === 'map');
  if (id !== 'map' && mapCtl) { mapCtl.destroy(); mapCtl = null; }
  if (id === 'play') requestAnimationFrame(fit);
  if (id === 'cine') requestAnimationFrame(fitCine);
  if (id === 'map') requestAnimationFrame(() => { fitMap(); openMap(); });
}
function fitBox(cv, w, h) { const s = Math.min(w / CW, h / CH); cv.style.width = Math.floor(CW * s) + 'px'; cv.style.height = Math.floor(CH * s) + 'px'; }
const fitCine = () => fitBox($('cinecv'), innerWidth, innerHeight);
const fitMap = () => fitBox($('mapcv'), $('mapStage').clientWidth, $('mapStage').clientHeight);
window.addEventListener('resize', () => { fitCine(); fitMap(); });
async function openMap() {
  const mod = await lazy('./citymap.js');
  if ($('map').hidden) return;
  if (mod && mod.createCityMap) {
    $('fallback').hidden = true; $('mapcv').hidden = false;
    if (mapCtl) mapCtl.destroy();
    mapCtl = mod.createCityMap($('mapcv'), { chapter: mapChapter, getState, chapterOpen, onPick: pickLevel, onChapter: changeChapter, sfx: (nm) => SFX[nm] && SFX[nm]() });
    fitMap();
  } else renderFallbackMap();
}
// als de kaart-module niet laadt: een eenvoudige lijst per hoofdstuk
function renderFallbackMap() {
  $('mapcv').hidden = true; const box = $('fallback'); box.hidden = false; box.innerHTML = '';
  const ch = CHAPTERS[mapChapter];
  const tabs = document.createElement('div'); tabs.className = 'row';
  CHAPTERS.forEach((c, i) => { const b = document.createElement('button'); b.className = 'small'; b.textContent = `${i + 1}`; b.disabled = !chapterOpen(i); b.onclick = () => { mapChapter = i; renderFallbackMap(); }; tabs.appendChild(b); });
  const h = document.createElement('h2'); h.textContent = `${ch.id}. ${ch.name}`;
  const grid = document.createElement('div'); grid.className = 'levels';
  for (const n of ch.levels) {
    const d = P.done[n];
    const b = document.createElement('button'); b.className = 'lvl' + (d ? ' done' : ''); b.disabled = !unlocked(n);
    b.innerHTML = `<b>${n}</b><small>${levelMeta(n).name}</small><span class="st">${d ? '★'.repeat(d.stars) + '☆'.repeat(3 - d.stars) : ''}</span>`;
    b.onclick = () => pickLevel(n); grid.appendChild(b);
  }
  box.append(tabs, h, grid);
}
const goMap = (n) => { if (n) mapChapter = levelMeta(n).ch - 1; show('map'); };

// filmpjes en de intro bij een gebouw
const CINE_SFX = {
  puff: () => beep(160, 0.25, 'sawtooth', 0.06, 0, -120), zip: () => beep(500, 0.15, 'sawtooth', 0.05, 0, 900), creak: () => beep(180, 0.5, 'sawtooth', 0.04, 0, 70), step: () => beep(120, 0.05, 'square', 0.03),
  whoosh: () => beep(320, 0.35, 'sawtooth', 0.04, 0, -240), siren: () => { beep(700, 0.3, 'square', 0.05); beep(520, 0.3, 'square', 0.05, 0.3); }, crash: () => { beep(90, 0.5, 'sawtooth', 0.12, 0, -50); beep(60, 0.6, 'square', 0.1, 0.05); },
  boom: () => beep(70, 0.5, 'sine', 0.15, 0, -40), plane: () => beep(200, 0.8, 'sawtooth', 0.03, 0, 80), chime: () => [880, 1320].forEach((f, i) => beep(f, 0.2, 'triangle', 0.08, i * 0.1)),
};
const cineSfx = (nm) => { const f = CINE_SFX[nm] || SFX[nm]; if (f) f(); };
function runCine(kind, a, fast) {
  return new Promise((res) => {
    let fin0 = false;
    const fin = () => { if (fin0) return; fin0 = true; res(); };
    lazy(kind === 'intro' ? './exterior.js' : './cutscene.js').then((mod) => {
      if (!mod) return fin();
      show('cine');
      try {
        if (kind === 'intro' && mod.prepareExterior) mod.prepareExterior(levelMeta(a).ext, a);
        if (kind === 'intro' && mod.playIntro) mod.playIntro($('cinecv'), levelMeta(a).ext, a, fin, { sfx: cineSfx, fast });
        else if (kind === 'cut' && mod.playCutscene) mod.playCutscene($('cinecv'), a, fin, { sfx: cineSfx });
        else fin();
      } catch (e) { console.warn(e); fin(); }
    });
  });
}
async function playCut(id) { P.seen[id] = 1; save(); await runCine('cut', id); }
// naar een volgend hoofdstuk met het pijltje: het filmpje van dat hoofdstuk speelt altijd (klik om door te gaan). Terug naar een eerder hoofdstuk: geen filmpje
async function changeChapter(i) {
  if (busy) return;
  if (!chapterOpen(i)) { toast('Haal eerst het vorige hoofdstuk'); return; }
  const prev = mapChapter;
  mapChapter = i; if (mapCtl) mapCtl.setChapter(i);
  const id = i > prev ? BEFORE[CHAPTERS[i].levels[0]] : null;
  if (!id) return;
  busy = true;
  try { await playCut(id); goMap(CHAPTERS[i].levels[0]); } finally { busy = false; }
}
// het filmpje van een hoofdstuk of gebouw speelt de eerste keer vanzelf af (en is daarna terug te zien via het Dev-paneel)
async function pickLevel(n) {
  if (busy || !unlocked(n)) return;
  busy = true;
  try {
    const b = BEFORE[n];
    if (b && !P.seen[b]) await playCut(b);
    if (!levelMeta(n).escape) await runCine('intro', n, !!P.done[n]);
    startLevel(n);
  } finally { busy = false; }
}

// alle filmpjes op een rij (voor beheerders, via het Dev-paneel)
const CINE_NAMES = { ch1_intro: 'Hoofdstuk 1: begin', ch1_end: 'Hoofdstuk 1: einde (bank leeggehaald)', ch2_intro: 'Hoofdstuk 2: begin', ch2_end: 'Hoofdstuk 2: einde (bami)', ch3_intro: 'Hoofdstuk 3: begin', l15_pre: 'Voor het BUDDLEY-magazijn', ch3_end: 'Hoofdstuk 3: einde (gesnapt)', ch4_intro: 'Hoofdstuk 4: begin (Nico)', l17_end: 'Na level 17: politie', l18_end: 'Na level 18: atelier', l19_end: 'Na level 19: de grote klus', ch4_end: 'Hoofdstuk 4: einde (vliegtuig)', ch5_intro: 'Hoofdstuk 5: begin (eiland)', final: 'Het einde' };
function openCineList() {
  document.querySelectorAll('.teun-dev-ov').forEach((o) => o.remove());
  const ov = $('cineList'); const box = $('cineListBtns'); box.innerHTML = '';
  for (const id of Object.keys(CUTSCENES)) {
    const b = document.createElement('button'); b.className = 'small'; b.textContent = `🎬 ${CINE_NAMES[id] || id}`;
    b.onclick = async () => { ov.hidden = true; const keepMap = !$('map').hidden; await runCine('cut', id); if (keepMap) show('map'); else show('menu'); };
    box.appendChild(b);
  }
  ov.hidden = false;
}
$('cineClose').onclick = () => { $('cineList').hidden = true; };

// het briefje met de code: alleen in een level waar de code ligt of nodig is, en weg zodra hij gebruikt is
const updateNote = () => { const L = game && game.L; const show = !!(L && L.code && (game.codeGot || (L.codeFrom && game.extCode)) && !game.codeUsed); $('note').hidden = !show; if (show) $('noteCode').textContent = L.code.split('').join(' '); };

// het nummerpad
let padBuf = '', padOn = false;
function drawPad() { $('padDisp').textContent = (padBuf + '\u2022\u2022\u2022\u2022'.slice(padBuf.length)).split('').join(' '); }
function openPad() { padOn = true; padBuf = ''; keys.clear(); drawPad(); $('pad').hidden = false; }
function closePad() { padOn = false; padBuf = ''; $('pad').hidden = true; }
function padWrong() { $('padDisp').classList.add('bad'); SFX.nohide && SFX.nohide(); setTimeout(() => { $('padDisp').classList.remove('bad'); padBuf = ''; drawPad(); }, 450); }
function padKey(k) {
  if (!padOn || !game) return;
  if (k === 'C') { padBuf = padBuf.slice(0, -1); drawPad(); return; }
  if (k === 'X') { game.p.mode = 'walk'; closePad(); return; }
  if (k === 'OK') { if (padBuf.length === 4) game.submitCode(padBuf); return; }
  if (padBuf.length >= 4) return;
  padBuf += k; drawPad(); beep(600 + padBuf.length * 90, 0.06, 'square', 0.05);
  if (padBuf.length === 4) setTimeout(() => padOn && game && game.submitCode(padBuf), 180);
}

// ---------------------------------------------------------------- spelen
const canvas = $('cv'); canvas.width = CW; canvas.height = CH;
const g2 = canvas.getContext('2d');
let game = null, stat = null, cur = 0, paused = false, last = 0, acc = 0;
const keys = new Set();
const touch = { l: 0, r: 0, u: 0, d: 0, act: 0 };
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
  const meta = levelMeta(n);
  game = new Game(L);
  stat = buildStatic(L);
  paused = false; acc = 0; last = performance.now();
  $('lvName').textContent = `${n}. ${meta.name}`;
  $('overlay').hidden = true; $('pauseBox').hidden = true;
  show('play');
  buildGoals();
  setBanner(`${meta.name}\n${meta.sub}`, 3200);
  game.extCode = P.codeL4 || P.dev; closePad(); updateNote();
  if (ghost) { applyGhost(); setTimeout(() => toast('Testmodus: geen bewakers'), 600); }
  if (L.codeFrom && !game.extCode) setTimeout(() => game && cur === n && toast('Je kent de kluiscode nog niet. Die ligt in het gemeentehuis (level 4).'), 3300);
  actx && actx.state === 'suspended' && actx.resume();
}
function setBanner(text, ms) {
  const el = $('banner');
  clearTimeout(setBanner.t);
  if (!text) { el.hidden = true; return; }
  el.textContent = text; el.hidden = false;
  if (ms) setBanner.t = setTimeout(() => { el.hidden = true; }, ms);
}
const GOAL = { doc: ['📄', 'Papieren'], loot: ['💰', 'Buit'], hack: ['💻', 'Hacken'], switch: ['🔴', 'Lasers uit'], code: ['🔐', 'Kluiscode'], vault: ['🔓', 'Kluis'] };
const goalLabel = (t) => (game.L.theme.labels && game.L.theme.labels[t]) || GOAL[t];
function buildGoals() {
  const types = {};
  for (const it of game.L.items) if (it.req) (types[it.type] = types[it.type] || []).push(it);
  $('goals').innerHTML = Object.entries(types).map(([t, l]) => `<span class="goal" data-t="${t}">${goalLabel(t)[0]} ${goalLabel(t)[1]} <span>0</span>/${l.length}</span>`).join('') + '<span class="goal" data-t="exit">🚪 Uitgang</span>';
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
  $('keys').textContent = '';
}
function handleEvents() {
  for (const e of game.events.splice(0)) {
    if (SFX[e]) SFX[e]();
    if (e === 'unlock') setBanner('Slot open!', 1000);
    if (e === 'spotted') setBanner('Gezien! Ren weg of verstop je!', 1600);
    if (e === 'alarm') setBanner('ALARM!\nDe robots op deze verdieping komen eraan', 2400);
    if (e === 'nohide') toast('Te dichtbij om je te verstoppen!');
    if (e === 'code') { if (cur === 4) { P.codeL4 = true; save(); } updateNote(); setBanner(`Code gevonden!\n${game.L.code}`, 2600); }
    if (e === 'keypad') openPad();
    if (e === 'keypadclose') closePad();
    if (e === 'wrongcode') padWrong();
    if (e === 'codeok') { closePad(); updateNote(); setBanner('Code juist!', 1400); }
    if (e === 'nocode') toast(game.L.codeFrom ? 'Je hebt de kluiscode nog niet. Zoek hem in het gemeentehuis (level 4).' : 'Je hebt de code nog niet. Zoek het briefje in dit level.');
    if (e === 'win') finish('won');
    if (e === 'caught') finish('caught');
    if (e === 'timeup') finish('timeup');
  }
}
function finish(kind) {
  closePad();
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
    if (!ghost) submitTime(GAME_ID, 'l' + cur, Math.round(used * 100) / 100);
    $('ovTitle').textContent = levelMeta(cur).escape ? 'Ontsnapt!' : 'Gelukt!';
    $('ovStars').innerHTML = [1, 2, 3].map((i) => `<i class="${i <= stars ? 'on' : ''}">★</i>`).join('');
    $('ovText').textContent = `Je was in ${fmt(used)} klaar, met ${fmt(L.limit - used)} over.`;
    const after = AFTER[cur];
    const nextSame = cur < LEVEL_COUNT && levelMeta(cur + 1).ch === levelMeta(cur).ch;
    $('ovNext').hidden = false; $('ovBoard').hidden = false;
    $('ovNext').textContent = after && !P.seen[after] ? 'Verder' : nextSame ? 'Volgende level' : 'Naar de kaart';
    renderMenu();
  } else if (kind === 'caught') {
    $('ovTitle').textContent = 'Gepakt!';
    $('ovText').textContent = 'Een robot heeft je met zijn knuppel te pakken. Ren weg, neem een trap of lift (daar kunnen ze niet mee) of verstop je op tijd.';
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
    actHeld: k('Space') || k('KeyE') || k('Enter') || touch.act,
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
  if (padOn) {
    e.preventDefault(); e.stopPropagation();
    const dg = /^(Digit|Numpad)(\d)$/.exec(e.code);
    if (dg) padKey(dg[2]); else if (e.code === 'Backspace') padKey('C'); else if (e.code === 'Enter' || e.code === 'NumpadEnter') padKey('OK'); else if (e.code === 'Escape') padKey('X');
    return;
  }
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
$('actBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); actPress = true; touch.act = 1; $('actBtn').classList.add('on'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) $('actBtn').addEventListener(ev, () => { touch.act = 0; $('actBtn').classList.remove('on'); });
document.querySelectorAll('#pad [data-k]').forEach((b) => { b.addEventListener('pointerdown', (e) => { e.preventDefault(); padKey(b.dataset.k); }); });
$('back').onclick = () => { const n = cur; game = null; goMap(n); };
$('mPlay').onclick = () => { mapChapter = levelMeta(nextOpenLevel()).ch - 1; show('map'); };
$('mapBack').onclick = () => show('menu');
$('restart').onclick = () => startLevel(cur);
$('pauseBtn').onclick = () => togglePause();
$('resume').onclick = () => togglePause(false);
$('pRestart').onclick = () => startLevel(cur);
$('pMenu').onclick = () => $('back').click();
$('ovRetry').onclick = () => startLevel(cur);
$('ovMenu').onclick = () => $('back').click();
$('ovNext').onclick = async () => {
  const after = AFTER[cur];
  if (after && !P.seen[after]) { P.seen[after] = 1; save(); busy = true; const n = cur; game = null; await runCine('cut', after); busy = false; goMap(Math.min(LEVEL_COUNT, n + 1)); return; }
  if (cur < LEVEL_COUNT && levelMeta(cur + 1).ch === levelMeta(cur).ch) pickLevel(cur + 1); else { const n = cur; game = null; goMap(Math.min(LEVEL_COUNT, n + 1)); }
};
const boardLevels = LEVELS.map((m) => ({ key: 'l' + m.n, label: `${m.n}. ${m.name}` }));
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
    { icon: '🤖', title: 'Bewakers', lines: ['Robots kijken in een lichtkegel. Zien ze je, dan vult het balkje boven je hoofd en gaan ze je <b>achtervolgen met een knuppel</b>. Pakt zo\'n robot je, dan ben je af. Ontsnappen kan met een ladder, trap of lift: robots kunnen niet van verdieping wisselen. Of verstop je op tijd (pijl omlaag), maar niet als hij vlak achter je zit.', 'Ziet een <b>camera</b> of <b>drone</b> je, of raak je een <b>laser</b>? Dan gaat het alarm af en komen alle robots op jouw verdieping achter je aan.'] },
    { icon: '🔒', title: 'Sloten en schakelaars', lines: ['Staat er een deur op slot? Ga ervoor staan en houd <kbd>Spatie</kbd> ingedrukt om het slot open te breken. Dat duurt even en je staat dan stil, dus kijk goed uit. Sommige lasers gaan pas uit als je de rode schakelaar hebt gevonden.', 'Een zwakke robot kun je van achteren slaan met <kbd>Spatie</kbd>: hij is dan 5 seconden uitgeschakeld. Een zware robot, een camera of een drone lukt niet.'] },
    { icon: '⭐', title: 'Sterren', lines: ['Hoe sneller je klaar bent, hoe meer sterren. Elk level is moeilijker dan het vorige. Je speelt vijf hoofdstukken met elk vijf gebouwen: kies een gebouw op de kaart.'] },
  ],
});
initDev([
  { label: 'Alle levels openen', run: () => { P.dev = true; save(); renderMenu(); return 'Alle levels open'; } },
  { label: 'Alle levels als gehaald markeren (3 sterren)', run: () => { for (let i = 1; i <= LEVEL_COUNT; i++) P.done[i] = { stars: 3, time: 30 }; save(); renderMenu(); return 'Alles gehaald'; } },
  { label: 'Alle filmpjes bekijken...', run: () => { openCineList(); return 'Kies een filmpje'; } },
  { label: 'Alle filmpjes opnieuw tonen', run: () => { P.seen = {}; save(); return 'Filmpjes worden weer getoond'; } },
  { label: 'Geen bewakers zien me aan/uit (testen)', run: () => { ghost = !ghost; try { sessionStorage.setItem('teun-robber-ghost', ghost ? '1' : '0'); } catch (e) { /* geen opslag */ } if (game) applyGhost(); return ghost ? 'Aan: bewakers en lasers zijn weg in elk level (tijden tellen niet mee voor het leaderboard)' : 'Uit: bewakers zijn er weer vanaf het volgende level'; } },
]);
post('teun:ready');
window.addEventListener('teun:pause', () => { if (game && game.status === 'play') paused = true; });
window.addEventListener('teun:resume', () => { if (game && $('pauseBox').hidden) paused = false; });
window.__tr = { get game() { return game; }, startLevel, pickLevel, show, P };
