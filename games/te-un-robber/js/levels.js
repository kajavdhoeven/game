// De 25 levels: elk een ander soort gebouw, met bewakers die steeds anders zijn. De indeling wordt per level uit een vast getal opgebouwd
// en is bij het maken gecontroleerd door een zoekprogramma: er is altijd een weg waarbij je niet wordt gezien (zie variants.js).
import { W, Y } from './sim.js';
import { VARIANTS } from './variants.js';
import { LEVELS, LEVEL_COUNT as LC } from './story.js';

export const LEVEL_COUNT = LC;

// Interieur per soort gebouw. wall, wall2, floor, trim, accent: kleuren. props: wat er in de kamers staat. hide: waar je je kunt verstoppen. skin: de bewakers.
// style: hoe muren en vloer eruitzien (zie draw.js), damage 0..1 = hoeveel schade (kale plekken, barsten, vlekken). floors: aantal verdiepingen.
// items: wat je moet pakken (volgorde). labels: eigen naam voor een soort buit in het lijstje.
const TH = {
  mushroom1: { wall: '#e2c9a0', wall2: '#cfae80', floor: '#7a5434', trim: '#a8432e', accent: '#e8503a', props: ['stool', 'mushtable', 'lantern', 'plant', 'bedmush', 'window'], hide: 'closet', skin: 'blue', style: { wall: 'mush', floor: 'planks', damage: 0.2 }, floors: 2, items: ['loot'] },
  mushroom2: { wall: '#cdd2ea', wall2: '#b4bbdc', floor: '#5a4a6a', trim: '#3a5ab0', accent: '#6a9aff', props: ['bedmush', 'bookcase', 'lantern', 'stool', 'window', 'plant'], hide: 'closet', skin: 'blue', style: { wall: 'mush', floor: 'planks', damage: 0.25 }, floors: 2, items: ['loot', 'doc'] },
  mushroom3: { wall: '#d8c07a', wall2: '#c2a65e', floor: '#6a4a2a', trim: '#8a5a1a', accent: '#e8b03a', props: ['mushtable', 'lantern', 'stove', 'stool', 'window', 'bookcase'], hide: 'closet', skin: 'green', style: { wall: 'mush', floor: 'planks', damage: 0.5 }, floors: 3, items: ['loot', 'doc', 'loot'] },
  townhall: { wall: '#e0d2b0', wall2: '#cdbd96', floor: '#6a4a3a', trim: '#6a3a2a', accent: '#e8c64a', props: ['painting', 'bookcase', 'desk', 'clock', 'lamp', 'plant', 'banner'], hide: 'closet', skin: 'purple', style: { wall: 'panel', floor: 'wood', damage: 0.15 }, floors: 3, items: ['code', 'loot', 'doc'], labels: { code: ['🔐', 'Kluiscode'] } },
  mushbank: { wall: '#a8c0a4', wall2: '#93ad90', floor: '#3f5646', trim: '#2f4a38', accent: '#e8c64a', props: ['counter', 'vaultdoor', 'deposit', 'plant', 'clock', 'painting'], hide: 'plant', skin: 'gold', style: { wall: 'stone', floor: 'tile', damage: 0.1 }, floors: 3, items: ['vault', 'loot', 'doc'], labels: { vault: ['🔓', 'Kluis openen'] } },
  rowhouse: { wall: '#d8c8a8', wall2: '#c8b690', floor: '#7a5a3a', trim: '#8b6a3e', accent: '#e8d27a', props: ['sofa', 'tv', 'plant', 'cabinet', 'lamp', 'window'], hide: 'closet', skin: 'blue', style: { wall: 'paper', floor: 'wood', damage: 0.2 }, floors: 3, items: ['loot', 'doc', 'loot'] },
  canalhouse: { wall: '#9a6a4a', wall2: '#85583c', floor: '#4a3626', trim: '#2f2018', accent: '#e8c27a', props: ['painting', 'bookcase', 'cabinet', 'lamp', 'clock', 'stove', 'window'], hide: 'closet', skin: 'purple', style: { wall: 'panel', floor: 'planks', damage: 0.3 }, floors: 3, items: ['doc', 'loot', 'loot'] },
  supermarket: { wall: '#e4ece4', wall2: '#cfdacf', floor: '#8a9a94', trim: '#2f7a4a', accent: '#e84a4a', props: ['shelfgoods', 'cashier', 'fridge', 'cart', 'crate', 'plant'], hide: 'crate', skin: 'green', style: { wall: 'tile', floor: 'tile', damage: 0.1 }, floors: 3, items: ['loot', 'doc', 'loot'], labels: { loot: ['🛒', 'Kassa-geld'] } },
  casino: { wall: '#7a2a4a', wall2: '#6a2240', floor: '#2f1a28', trim: '#e8c64a', accent: '#ff5ea8', props: ['roulette', 'slots', 'pokertable', 'lamp', 'painting', 'plant'], hide: 'slots', skin: 'gold', style: { wall: 'paper', floor: 'carpet', damage: 0.05 }, floors: 3, items: ['loot', 'hack', 'loot'] },
  chinese: { wall: '#b8452f', wall2: '#a23a28', floor: '#4a2a1a', trim: '#e8c64a', accent: '#ffd23a', props: ['roundtable', 'lanternred', 'fishtank', 'wok', 'counter', 'painting'], hide: 'closet', skin: 'chef', style: { wall: 'plaster', floor: 'wood', damage: 0.25 }, floors: 3, items: ['loot', 'doc', 'loot'], labels: { doc: ['🍜', 'Bami'] } },
  hutong: { wall: '#a8a090', wall2: '#948c7c', floor: '#5a5448', trim: '#7a2a22', accent: '#e8b03a', props: ['lanternred', 'screen', 'cabinet', 'bed', 'teapot', 'window'], hide: 'closet', skin: 'blue', style: { wall: 'brick', floor: 'stone', damage: 0.45 }, floors: 3, items: ['loot', 'doc', 'loot'] },
  apartment: { wall: '#cfc8b8', wall2: '#bcb4a2', floor: '#6a5a4a', trim: '#4a4238', accent: '#e8a43a', props: ['sofa', 'tv', 'fridge', 'plant', 'cabinet', 'window'], hide: 'closet', skin: 'blue', style: { wall: 'plaster', floor: 'wood', damage: 0.5 }, floors: 4, items: ['doc', 'loot', 'loot'] },
  teashop: { wall: '#b8894a', wall2: '#a27638', floor: '#5a3e24', trim: '#3f2a16', accent: '#e8503a', props: ['teashelf', 'teapot', 'counter', 'lanternred', 'plant', 'crate'], hide: 'crate', skin: 'green', style: { wall: 'wood', floor: 'planks', damage: 0.3 }, floors: 3, items: ['loot', 'doc', 'loot'] },
  electronics: { wall: '#2a3040', wall2: '#222838', floor: '#15181f', trim: '#4ac8ff', accent: '#4ac8ff', props: ['tvwall', 'laptopbench', 'server', 'pc', 'lamp', 'shelf'], hide: 'server', skin: 'white', style: { wall: 'panel', floor: 'tile', damage: 0.05 }, floors: 3, items: ['hack', 'loot', 'doc'] },
  buddley: { wall: '#9a9a8a', wall2: '#85857a', floor: '#4a4a44', trim: '#ffb03a', accent: '#ffb03a', props: ['buddleybox', 'pallet', 'shelf', 'crate', 'barrel', 'lamp'], hide: 'buddleybox', skin: 'orange', style: { wall: 'concrete', floor: 'concrete', damage: 0.5 }, floors: 4, items: ['loot', 'doc', 'loot', 'hack'], labels: { loot: ['📦', 'Dozen'], doc: ['📄', 'Facturen'] } },
  hq: { wall: '#b9c4d2', wall2: '#a4b1c2', floor: '#56657a', trim: '#33445c', accent: '#59a8ff', props: ['bossdesk', 'pc', 'shelf', 'plant', 'window', 'clock'], hide: 'plant', skin: 'boss', style: { wall: 'plaster', floor: 'carpet', damage: 0.1 }, floors: 4, items: ['loot'], labels: { loot: ['💰', 'Je zak'] } },
  suburb: { wall: '#d6d0c0', wall2: '#c4bca8', floor: '#6a5a48', trim: '#4a4238', accent: '#e8a43a', props: ['sofa', 'tv', 'plant', 'cabinet', 'lamp', 'window', 'fridge'], hide: 'closet', skin: 'blue', style: { wall: 'paper', floor: 'wood', damage: 0.2 }, floors: 3, items: ['loot', 'doc', 'loot'] },
  police: { wall: '#8aa0c4', wall2: '#788fb6', floor: '#3f4f6e', trim: '#26304a', accent: '#4a8aff', props: ['desk', 'pc', 'bars', 'cabinet', 'clock', 'board'], hide: 'closet', skin: 'police', style: { wall: 'concrete', floor: 'tile', damage: 0.3 }, floors: 3, items: ['loot'], labels: { loot: ['🎒', 'Je spullen'] } },
  atelier: { wall: '#a08a78', wall2: '#8e7a6a', floor: '#4a3a30', trim: '#6a2f4a', accent: '#d65aa8', props: ['mannequin', 'sewing', 'fabricroll', 'shelf', 'lamp', 'window'], hide: 'mannequin', skin: 'purple', style: { wall: 'plaster', floor: 'planks', damage: 0.85 }, floors: 3, items: ['loot'], labels: { loot: ['💰', 'Je zak'] } },
  bankchina: { wall: '#c8a878', wall2: '#b49464', floor: '#4a2a22', trim: '#a8322a', accent: '#ffd23a', props: ['counter', 'vaultdoor', 'deposit', 'pillar', 'painting', 'lanternred'], hide: 'plant', skin: 'gold', style: { wall: 'stone', floor: 'tile', damage: 0.1 }, floors: 4, items: ['vault', 'loot', 'loot', 'doc', 'hack'], labels: { vault: ['🔓', 'Kluis openen'] } },
  wreck: { wall: '#8a9a98', wall2: '#778785', floor: '#3a4440', trim: '#c4452e', accent: '#ffb03a', props: ['seats', 'luggage', 'pipes', 'lamp', 'crate'], hide: 'luggage', skin: 'orange', style: { wall: 'metal', floor: 'concrete', damage: 0.9 }, floors: 3, items: ['loot', 'loot', 'doc'], labels: { loot: ['💰', 'Geldzakken'] } },
  resort: { wall: '#e8d8b0', wall2: '#d8c698', floor: '#a8896a', trim: '#2f8a8a', accent: '#ff7a5a', props: ['bed', 'palmplant', 'lamp', 'window', 'table', 'plant'], hide: 'palmplant', skin: 'white', style: { wall: 'plaster', floor: 'tile', damage: 0.2 }, floors: 4, items: ['loot', 'doc', 'loot', 'hack'] },
  ship: { wall: '#6a4a2a', wall2: '#58391e', floor: '#3a2814', trim: '#241608', accent: '#e8c64a', props: ['barrel', 'chest', 'cannon', 'lantern', 'crate', 'helm'], hide: 'barrel', skin: 'knight', style: { wall: 'wood', floor: 'planks', damage: 0.5 }, floors: 3, items: ['loot', 'doc', 'loot', 'loot'], labels: { loot: ['🪙', 'Schatten'] } },
  airport: { wall: '#a8c4e0', wall2: '#93b1d0', floor: '#4a6080', trim: '#2a4060', accent: '#ffd23a', props: ['luggage', 'desk', 'board', 'window', 'clock', 'plant'], hide: 'luggage', skin: 'police', style: { wall: 'plaster', floor: 'tile', damage: 0.1 }, floors: 4, items: ['doc', 'loot', 'hack', 'loot'], labels: { doc: ['🎫', 'Tickets'] } },
  castle: { wall: '#9a9488', wall2: '#85807a', floor: '#4a443a', trim: '#2f2b24', accent: '#e8c64a', props: ['pillar', 'banner', 'armor', 'torchwall', 'statue', 'painting'], hide: 'armor', skin: 'knight', style: { wall: 'stone', floor: 'stone', damage: 0.6 }, floors: 4, items: ['loot', 'doc', 'hack', 'loot', 'vault'], labels: { vault: ['🔓', 'Schatkamer'] } },
};
export const THEMES = LEVELS.map((m) => ({ ...TH[m.theme], key: m.theme, name: m.name, sub: m.sub }));

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export function makeLevel(n, variant = 0) {
  const R = rng(n * 9973 + variant * 131 + 7);
  const T = THEMES[n - 1];
  const d = (n - 1) / 24;
  const meta = LEVELS[n - 1], escape = !!meta.escape;
  const floors = T.floors || (n <= 2 ? 2 : n <= 8 ? 3 : 4);
  const rnd = (a, b) => a + R() * (b - a);
  const pick = (arr) => arr[(R() * arr.length) | 0];

  // ---- kamers en muren (elke muur heeft een deur)
  const walls = [], rooms = [];
  for (let f = 0; f < floors; f++) {
    const k = 3 + (R() < 0.5 ? 1 : 0);
    let cuts = [];
    for (let tries = 0; tries < 80; tries++) {
      cuts = Array.from({ length: k - 1 }, () => Math.round(rnd(8, 24))).sort((a, b) => a - b);
      if (cuts.every((c, i) => (i ? c - cuts[i - 1] >= 6 : c >= 7)) && 31 - cuts[cuts.length - 1] >= 6) break;
      cuts = [];
    }
    if (!cuts.length) cuts = Array.from({ length: k - 1 }, (_, i) => Math.round(1 + (30 / k) * (i + 1)));
    const xs = [1, ...cuts, 31];
    rooms.push(xs.slice(0, -1).map((x0, i) => ({ x0, x1: xs[i + 1] })));
    cuts.forEach((x) => walls.push({ f, x, lock: null }));
  }
  const roomOf = (f, x) => rooms[f].findIndex((r) => x >= r.x0 && x <= r.x1);

  // wat er al staat, zodat dingen niet over elkaar heen komen: per verdieping een lijst van [x, ruimte]
  const occ = rooms.map(() => []);
  walls.forEach((w) => occ[w.f].push([w.x, 1.4]));
  const free = (f, x, gap = 1.4) => x > 1.8 && x < 30.2 && occ[f].every(([ox, og]) => Math.abs(ox - x) >= Math.max(gap, og));
  const spot = (f, x0, x1, gap = 1.4) => { for (let t = 0; t < 60; t++) { const x = Math.round(rnd(x0, x1) * 2) / 2; if (free(f, x, gap)) return x; } return null; };
  const take = (f, x, gap = 1.4) => occ[f].push([x, gap]);

  // ---- vaste punten: begin en uitgang
  // een ontsnaplevel begint bovenin en eindigt beneden
  const start = escape ? { f: floors - 1, x: 3 } : { f: 0, x: 3 };
  const exit = escape ? { f: 0, x: 28 } : { f: floors - 1, x: 28 };
  take(start.f, 3, 2.5); take(exit.f, exit.x, 2.5);

  // ---- ladders, trappen en liften tussen de verdiepingen
  const ladders = [], stairs = [];
  let sid = 0;
  for (let f = 0; f < floors - 1; f++) {
    const count = n >= 5 ? 2 : 1;
    for (let c = 0; c < count; c++) {
      const kind = R() < 0.4 ? 'ladder' : R() < 0.65 ? 'stairs' : 'lift';
      const zone = count === 2 ? (c === 0 ? [4, 15] : [17, 28]) : [4, 28];
      if (kind === 'ladder') {
        let x = null;
        for (let t = 0; t < 60 && x === null; t++) { const cx = Math.round(rnd(zone[0], zone[1])); if (free(f, cx, 2.2) && free(f + 1, cx, 2.2)) x = cx; }
        if (x === null) continue;
        ladders.push({ f, x }); take(f, x, 2.2); take(f + 1, x, 2.2);
      } else {
        // de deuren van een trap of lift zitten recht boven elkaar
        let xl = null;
        for (let tr = 0; tr < 60 && xl === null; tr++) { const cx = Math.round(rnd(zone[0], zone[1])); if (free(f, cx, 2.2) && free(f + 1, cx, 2.2)) xl = cx; }
        if (xl === null) continue;
        const xu = xl;
        const id = sid++;
        stairs.push({ id, f, x: xl, dir: 'up', to: { f: f + 1, x: xu }, kind });
        stairs.push({ id, f: f + 1, x: xu, dir: 'down', to: { f, x: xl }, kind });
        take(f, xl, 2.2); take(f + 1, xu, 2.2);
      }
    }
    // er moet minstens één verbinding zijn
    if (!ladders.some((l) => l.f === f) && !stairs.some((s) => s.f === f && s.dir === 'up')) {
      const x = [6, 14, 22].find((cx) => free(f, cx, 1.6) && free(f + 1, cx, 1.6)) || 20;
      ladders.push({ f, x }); take(f, x, 2.2); take(f + 1, x, 2.2);
    }
  }

  // ---- buit en opdrachten
  const items = [];
  const types = T.items || ['doc', 'loot', 'doc'];
  const reqCount = types.length;
  for (let i = 0; i < reqCount; i++) {
    const f = floors > 1 && i > 0 ? (R() < 0.7 ? 1 + ((R() * (floors - 1)) | 0) : 0) : (floors > 2 ? 1 : floors - 1);
    const x = spot(f, 3, 29, 1.8);
    if (x === null) continue;
    items.push({ id: items.length, type: types[i % types.length], f, x, req: true });
    take(f, x, 1.8);
  }
  if (!items.length) items.push({ id: 0, type: 'loot', f: 1, x: 20, req: true });

  // ---- lasers (de laatste mag uit met een schakelaar)
  const lasers = [];
  if (n >= 6) {
    const cnt = 1 + Math.floor(d * 3.5);
    for (let i = 0; i < cnt; i++) {
      const f = (R() * floors) | 0;
      const x = spot(f, 6, 27, 2.4);
      if (x === null) continue;
      const needSwitch = n >= 12 && i === 0;
      const period = rnd(3.2, 4.4);
      lasers.push({ f, x, period, on: rnd(0.45, 0.55), phase: rnd(0, period), needSwitch });
      take(f, x, 2.4);
    }
    const ls = lasers.find((l) => l.needSwitch);
    if (ls) { // de schakelaar staat ergens eerder op de weg, bij het begin van het gebouw
      const sx = spot(start.f, 5, 14, 1.8);
      if (sx === null) ls.needSwitch = false; else { items.push({ id: items.length, type: 'switch', f: start.f, x: sx, req: true }); take(start.f, sx, 1.8); }
    }
  }

  // ---- sloten: een slot breek je open door spatie ingedrukt te houden bij de deur (kost tijd, en je staat dan stil in het zicht)
  const nodes = (lockedSet) => {
    // welke kamers zijn te bereiken vanaf het begin?
    const id = (f, i) => f * 10 + i;
    const seen = new Set([id(start.f, roomOf(start.f, start.x))]);
    const q = [[start.f, roomOf(start.f, start.x)]];
    while (q.length) {
      const [f, i] = q.pop();
      const link = (g, j) => { const k = id(g, j); if (!seen.has(k)) { seen.add(k); q.push([g, j]); } };
      const r = rooms[f][i];
      for (const w of walls) {
        if (w.f !== f || lockedSet.has(w)) continue;
        if (w.x === r.x1 && i + 1 < rooms[f].length) link(f, i + 1);
        if (w.x === r.x0 && i > 0) link(f, i - 1);
      }
      for (const l of ladders) { if (l.f === f && l.x >= r.x0 && l.x <= r.x1) link(f + 1, roomOf(f + 1, l.x)); if (l.f + 1 === f && l.x >= r.x0 && l.x <= r.x1) link(f - 1, roomOf(f - 1, l.x)); }
      for (const s of stairs) if (s.f === f && s.x >= r.x0 && s.x <= r.x1) link(s.to.f, roomOf(s.to.f, s.to.x));
    }
    return { has: (f, x) => seen.has(id(f, roomOf(f, x))), seen };
  };
  const locks = n >= 3 ? (n >= 18 ? 3 : n >= 9 ? 2 : 1) : 0;
  const lockedSet = new Set();
  for (let c = 0; c < locks; c++) {
    for (let t = 0; t < 30; t++) {
      // een slot zit liefst vlak bij een trap, lift of ladder: dan blokkeert die deur de weg ernaartoe en moet je hem eerst openbreken
      const cand = walls.filter((x) => !x.lock);
      if (!cand.length) break;
      const near = (x) => Math.min(99, ...stairs.filter((q) => q.f === x.f).map((q) => Math.abs(q.x - x.x)), ...ladders.filter((q) => q.f === x.f || q.f + 1 === x.f).map((q) => Math.abs(q.x - x.x)));
      const byNear = [...cand].sort((p, q) => near(p) - near(q));
      const w = R() < 0.7 ? byNear[Math.min(byNear.length - 1, (R() * 3) | 0)] : pick(cand);
      const reach = nodes(new Set([...lockedSet, w]));
      // het slot moet iets afsluiten wat je nodig hebt (een opdracht of de uitgang)
      const far = items.filter((i) => i.req && !reach.has(i.f, i.x)).length + (reach.has(exit.f, exit.x) ? 0 : 1);
      if (!far) continue;
      w.lock = true;
      lockedSet.add(w);
      break;
    }
  }

  // ---- bewakers
  const guards = [];
  const startRoom = { f: start.f, x0: 1, x1: 10 };
  const addGuard = (g) => guards.push({ id: guards.length, skin: T.skin, phase: rnd(0, 8), ...g });
  const roomFor = (avoidStart = true) => {
    for (let t = 0; t < 40; t++) {
      const f = (R() * floors) | 0;
      const r = pick(rooms[f]);
      if (avoidStart && f === start.f && r.x0 <= startRoom.x1 && r.x1 >= 1 && r.x0 < 8) continue;
      return { f, r, i: rooms[f].indexOf(r) };
    }
    return { f: floors - 1, r: rooms[floors - 1][1], i: 1 };
  };
  // als een level te vol zit om te halen, probeert de generator een iets rustigere variant
  const sc = variant >= 40 ? 0.6 : variant >= 20 ? 0.8 : 1;
  const total = n < 2 ? 0 : Math.max(1, Math.round((1 + d * 6) * sc));   // hooguit 7 bewakers in het laatste level
  const cnt = {
    C: n >= 4 ? Math.max(1, Math.round(Math.min(2, 1 + Math.floor(d * 2)) * (sc < 1 ? 0.7 : 1))) : 0,
    S: n >= 7 ? Math.floor(Math.min(2, Math.floor(d * 3)) * sc) : 0,
    D: n >= 10 ? Math.floor(Math.min(2, 1 + Math.floor((d - 0.4) * 3)) * sc) : 0,
    H: n >= 9 ? Math.floor(Math.min(2, Math.floor(d * 2.5)) * sc) : 0,
    F: n >= 12 ? Math.floor(Math.min(2, Math.floor(d * 2.5)) * sc) : 0,
  };
  // meer bewakers dan het totaal: haal eerst de soort weg waar er de meeste van zijn
  while (n >= 2 && 1 + cnt.C + cnt.S + cnt.D + cnt.H + cnt.F > total) {
    const k = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x])[0];
    if (!cnt[k]) break;
    cnt[k]--;
  }
  const nC = cnt.C, nS = cnt.S, nD = cnt.D, nH = cnt.H, nF = cnt.F;
  const nP = n < 2 ? 0 : Math.max(1, Math.min(4, total - nC - nS - nD - nH - nF));
  const patrolSpec = (kind) => {
    const { f, r, i } = roomFor();
    let x0 = r.x0 + 0.8, x1 = r.x1 - 0.8;
    if (R() < 0.3 + d * 0.4 && i + 1 < rooms[f].length) x1 = rooms[f][i + 1].x1 - 0.8; // door door: loopt door naar de volgende kamer
    if (x1 - x0 > 14) x1 = x0 + 14;
    const sp = kind === 'fast' ? 2.6 + d : kind === 'heavy' ? 1.0 : kind === 'drone' ? 2.3 : 1.3 + 1.1 * d;
    return { kind, f, x0, x1, speed: sp, pause: kind === 'drone' ? 0.6 : kind === 'fast' ? 0.5 : Math.max(0.5, 1.5 - 0.9 * d), range: kind === 'heavy' ? 6.8 : kind === 'fast' ? 4.2 : 4.2 + 1.8 * d };
  };
  const camSpec = () => { const { f, r } = roomFor(); const x = Math.round(rnd(r.x0 + 2, r.x1 - 2)); return { kind: 'camera', f, x0: x, x1: x, amp: rnd(0.45, 0.75), period: rnd(3.8, 6), half: 0.27, range: 5.8 }; };
  const sleepSpec = () => { const { f, r } = roomFor(); const x = Math.round(rnd(r.x0 + 2, r.x1 - 2)); return { kind: 'sleeper', f, x0: x, x1: x, dir: R() < 0.5 ? 1 : -1, sleep: rnd(4, 6), awake: rnd(2.6, 3.6), range: 5.5 }; };
  // geen bewakers die door elkaar heen lopen of op dezelfde plek staan: een nieuwe moet ver genoeg van de andere op die verdieping blijven
  const span = (g) => (g.kind === 'camera' || g.kind === 'sleeper' ? [g.x0 - 3, g.x0 + 3] : [g.x0, g.x1]);
  const clash = (g) => guards.some((o) => {
    if (o.f !== g.f) return false;
    if (o.kind === 'camera' && g.kind === 'camera') return Math.abs(o.x0 - g.x0) < 6;
    if (o.kind === 'camera' || g.kind === 'camera') return false;
    const [a0, a1] = span(o), [b0, b1] = span(g);
    return a0 < b1 + 2 && b0 < a1 + 2;
  });
  const place = (make) => { for (let t = 0; t < 70; t++) { const g = make(); if (!clash(g)) { addGuard(g); return true; } } return false; };
  for (let i = 0; i < nP; i++) place(() => patrolSpec('patrol'));
  for (let i = 0; i < nH; i++) place(() => patrolSpec('heavy'));
  for (let i = 0; i < nF; i++) place(() => patrolSpec('fast'));
  for (let i = 0; i < nD; i++) place(() => patrolSpec('drone'));
  for (let i = 0; i < nC; i++) place(camSpec);
  for (let i = 0; i < nS; i++) place(sleepSpec);
  guards.forEach((g) => { if (g.kind !== 'camera' && g.kind !== 'drone' && g.kind !== 'sleeper') take(g.f, (g.x0 + g.x1) / 2, 0.5); });

  // ---- schuilplekken: zo'n beetje in elke kamer
  const hides = [];
  for (let f = 0; f < floors; f++) for (const r of rooms[f]) {
    const cnt = (R() < 0.8 ? 1 : 0) + (R() < d * 0.3 ? 1 : 0);
    for (let i = 0; i < cnt; i++) {
      const x = spot(f, r.x0 + 1.2, r.x1 - 1.2, 1.6);
      if (x !== null) { hides.push({ f, x, kind: T.hide }); take(f, x, 1.6); }
    }
  }
  // wie een deur van een kamer met bewakers wil nemen, heeft meestal een schuilplek dichtbij nodig: we vertrouwen op de controle

  // ---- versiering (alleen om naar te kijken)
  const decor = [];
  const bag = T.props.filter((p) => p !== T.hide && p !== 'window' && p !== 'clock' && p !== 'painting');
  const wallProps = T.props.filter((p) => p === 'window' || p === 'clock' || p === 'painting');
  for (let f = 0; f < floors; f++) {
    const used = {}; let last = '';
    for (let i = 0; i < 9; i++) {
      const x = spot(f, 2, 30, 1.7);
      if (x === null) continue;
      const useWall = wallProps.length && i % 3 === 2;
      const list = (useWall ? wallProps : bag.length ? bag : T.props).filter((t) => t !== last && (used[t] || 0) < 2);
      if (!list.length) continue;
      const type = list[(i + f + ((R() * 3) | 0)) % list.length];
      decor.push({ f, x, type }); used[type] = (used[type] || 0) + 1; last = type;
      take(f, x, 1.7);
    }
  }

  const V = VARIANTS[n];
  const level = { n, escape, theme: T, floors, start, exit, rooms, walls, ladders, stairs, items, lasers, guards, hides, decor, limit: V ? Math.ceil(V.base * (2.7 - 1.3 * d) + 10) : 180, base: V ? V.base : 0 };
  return level;
}

// de spiegelbeeld: de helft van de levels wordt omgedraaid zodat niet elk level links begint
export function mirrorLevel(L) {
  const m = (x) => W - x;
  const ml = { ...L, mirror: true };
  ml.start = { ...L.start, x: m(L.start.x) }; ml.exit = { ...L.exit, x: m(L.exit.x) };
  ml.rooms = L.rooms.map((fr) => fr.map((r) => ({ x0: m(r.x1), x1: m(r.x0) })).reverse());
  ml.walls = L.walls.map((w) => ({ ...w, x: m(w.x) }));
  ml.ladders = L.ladders.map((l) => ({ ...l, x: m(l.x) }));
  ml.stairs = L.stairs.map((s) => ({ ...s, x: m(s.x), to: { ...s.to, x: m(s.to.x) } }));
  ml.items = L.items.map((i) => ({ ...i, x: m(i.x) }));
  ml.lasers = L.lasers.map((l) => ({ ...l, x: m(l.x) }));
  ml.guards = L.guards.map((g) => ({ ...g, x0: m(g.x1), x1: m(g.x0), dir: g.dir ? -g.dir : g.dir, phase: g.phase }));
  ml.hides = L.hides.map((h) => ({ ...h, x: m(h.x) }));
  ml.decor = L.decor.map((o) => ({ ...o, x: m(o.x) }));
  return ml;
}

export function levelFor(n) {
  const v = VARIANTS[n] ? VARIANTS[n].v : 0;
  const L = makeLevel(n, v);
  return n % 2 === 0 ? mirrorLevel(L) : L;
}
export { Y };
