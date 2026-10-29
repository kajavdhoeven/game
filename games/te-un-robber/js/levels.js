// De 25 levels: elk een ander soort gebouw, met bewakers die steeds anders zijn. De indeling wordt per level uit een vast getal opgebouwd
// en is bij het maken gecontroleerd door een zoekprogramma: er is altijd een weg waarbij je niet wordt gezien (zie variants.js).
import { W, Y } from './sim.js';
import { VARIANTS } from './variants.js';

export const LEVEL_COUNT = 25;

// kleuren: wand, tweede wandkleur, vloer, lijst, accent. props: wat er in de kamers staat. skin: hoe de bewakers eruitzien.
export const THEMES = [
  { name: 'Het huis van de buren', sub: 'Een gezellig huis. Even binnenlopen.', wall: '#d9c07a', wall2: '#c4a85f', floor: '#7a5a3a', trim: '#8b6a3e', accent: '#e8d27a', props: ['sofa', 'tv', 'plant', 'cabinet', 'lamp', 'window'], hide: 'closet', skin: 'blue' },
  { name: 'De garage', sub: 'Olie, banden en gereedschap.', wall: '#8fa3a8', wall2: '#7b8f95', floor: '#4a5a5e', trim: '#2f3d40', accent: '#e0b03a', props: ['tools', 'tires', 'crate', 'barrel', 'shelf'], hide: 'crate', skin: 'blue' },
  { name: 'De supermarkt', sub: 'Gangpaden vol boodschappen.', wall: '#cfe3d0', wall2: '#b9d3bb', floor: '#6f8f7a', trim: '#3f7a52', accent: '#e84a4a', props: ['shelf', 'cashier', 'fridge', 'crate', 'plant'], hide: 'crate', skin: 'green' },
  { name: 'De bakkerij', sub: 'Het ruikt er heerlijk. Maar pas op.', wall: '#e6c9a0', wall2: '#d7b585', floor: '#8a6a4a', trim: '#a0683a', accent: '#f4e2b0', props: ['counter', 'shelf', 'fridge', 'crate', 'lamp'], hide: 'closet', skin: 'blue' },
  { name: 'Het hotel', sub: 'Veel kamers, veel gangen.', wall: '#c98d8d', wall2: '#b87777', floor: '#6a4a3a', trim: '#7a3f3f', accent: '#f2d27a', props: ['bed', 'painting', 'plant', 'lamp', 'cabinet'], hide: 'closet', skin: 'purple' },
  { name: 'Het kantoor', sub: 'Computers, papieren en camera\'s.', wall: '#b9c4d2', wall2: '#a4b1c2', floor: '#56657a', trim: '#33445c', accent: '#59a8ff', props: ['desk', 'pc', 'shelf', 'plant', 'window', 'clock'], hide: 'plant', skin: 'blue' },
  { name: 'De bank', sub: 'Hier ligt echt geld. Lasers!', wall: '#9fb59c', wall2: '#8aa388', floor: '#4a5e4a', trim: '#2f4a38', accent: '#e8c64a', props: ['counter', 'safe', 'plant', 'clock', 'painting'], hide: 'plant', skin: 'gold' },
  { name: 'Het museum', sub: 'Schilderijen en beelden.', wall: '#d8cdbd', wall2: '#c6b9a5', floor: '#7a6a58', trim: '#5a4a3a', accent: '#c9a24a', props: ['painting', 'statue', 'pillar', 'window', 'plant'], hide: 'statue', skin: 'purple' },
  { name: 'De juwelier', sub: 'Glimmend en streng bewaakt.', wall: '#6a5a8a', wall2: '#594a78', floor: '#2f2a44', trim: '#1f1a33', accent: '#7ae0ff', props: ['counter', 'safe', 'painting', 'lamp', 'plant'], hide: 'closet', skin: 'gold' },
  { name: 'De school', sub: 'Lokalen, gangen en kluisjes.', wall: '#cfd8a0', wall2: '#bcc68a', floor: '#6a7048', trim: '#4a5230', accent: '#f08a3a', props: ['desk', 'locker', 'clock', 'window', 'plant'], hide: 'locker', skin: 'green' },
  { name: 'De bibliotheek', sub: 'Stil. Heel stil.', wall: '#b79a78', wall2: '#a38564', floor: '#5a4030', trim: '#3a2a1c', accent: '#d9b86a', props: ['bookcase', 'desk', 'lamp', 'window', 'plant'], hide: 'bookcase', skin: 'purple' },
  { name: 'Het ziekenhuis', sub: 'Witte gangen en snelle robots.', wall: '#dfe9ee', wall2: '#cbdbe3', floor: '#7a98a6', trim: '#4a7a90', accent: '#e84a5a', props: ['medbed', 'fridge', 'plant', 'cabinet', 'clock'], hide: 'closet', skin: 'white' },
  { name: 'Het politiebureau', sub: 'Durf jij het aan?', wall: '#8aa0c4', wall2: '#788fb6', floor: '#3f4f6e', trim: '#26304a', accent: '#4a8aff', props: ['desk', 'pc', 'bars', 'cabinet', 'clock'], hide: 'closet', skin: 'police' },
  { name: 'Het restaurant', sub: 'Tafels, keuken en kok-robots.', wall: '#c6866a', wall2: '#b27458', floor: '#5a3a2a', trim: '#7a3a2a', accent: '#f2c86a', props: ['table', 'counter', 'fridge', 'lamp', 'plant'], hide: 'closet', skin: 'chef' },
  { name: 'Het casino', sub: 'Glitter, geld en camera\'s.', wall: '#8a3a5a', wall2: '#762f4a', floor: '#2f1a28', trim: '#e8c64a', accent: '#ff5ea8', props: ['slots', 'table', 'lamp', 'painting', 'plant'], hide: 'slots', skin: 'gold' },
  { name: 'De fabriek', sub: 'Lopende banden en machines.', wall: '#9a9a8a', wall2: '#85857a', floor: '#4a4a44', trim: '#2a2a26', accent: '#ffb03a', props: ['conveyor', 'barrel', 'crate', 'pipes', 'tools'], hide: 'barrel', skin: 'orange' },
  { name: 'Het pakhuis', sub: 'Stapels dozen en weinig licht.', wall: '#9a8a74', wall2: '#857661', floor: '#4a4034', trim: '#2f281f', accent: '#d9a44a', props: ['crate', 'barrel', 'shelf', 'tires', 'lamp'], hide: 'crate', skin: 'orange' },
  { name: 'Het laboratorium', sub: 'Geheime proeven. Lasers en drones.', wall: '#a8d0c4', wall2: '#93bfb2', floor: '#3f6a60', trim: '#255a4e', accent: '#7affc8', props: ['lab', 'pc', 'fridge', 'pipes', 'plant'], hide: 'closet', skin: 'white' },
  { name: 'De tv-studio', sub: 'Lampen, decors en kabels.', wall: '#7a6aa8', wall2: '#685a96', floor: '#2f2a4a', trim: '#1c1830', accent: '#ff7ac8', props: ['camera', 'lamp', 'sofa', 'pc', 'plant'], hide: 'sofa', skin: 'purple' },
  { name: 'Het vliegveld', sub: 'Bagage, scanners en strenge bewakers.', wall: '#a8c4e0', wall2: '#93b1d0', floor: '#4a6080', trim: '#2a4060', accent: '#ffd23a', props: ['luggage', 'desk', 'window', 'clock', 'plant'], hide: 'luggage', skin: 'police' },
  { name: 'Het treinstation', sub: 'Veel mensen, veel robots.', wall: '#c8b898', wall2: '#b5a584', floor: '#5a5040', trim: '#3a3226', accent: '#4a8aff', props: ['clock', 'luggage', 'window', 'pillar', 'lamp'], hide: 'luggage', skin: 'blue' },
  { name: 'De gevangenis', sub: 'Hier kom je eigenlijk niet in.', wall: '#8a8a8a', wall2: '#757575', floor: '#3a3a3a', trim: '#1f1f1f', accent: '#ff8a3a', props: ['bars', 'bed', 'lamp', 'pipes', 'cabinet'], hide: 'closet', skin: 'police' },
  { name: 'Het kasteel', sub: 'Pantserrobots en een schatkamer.', wall: '#9a9488', wall2: '#85807a', floor: '#4a443a', trim: '#2f2b24', accent: '#e8c64a', props: ['pillar', 'painting', 'lamp', 'bookcase', 'statue'], hide: 'statue', skin: 'knight' },
  { name: 'Het ruimtestation', sub: 'Zwaartekracht? Wel. Veiligheid? Ook.', wall: '#4a5a7a', wall2: '#3c4a68', floor: '#222a3c', trim: '#101624', accent: '#5ae0ff', props: ['pc', 'pipes', 'lab', 'lamp', 'window'], hide: 'closet', skin: 'alien' },
  { name: 'Het geheime hoofdkwartier', sub: 'De laatste klus: alles tegelijk.', wall: '#5a5a6a', wall2: '#4a4a5a', floor: '#1f1f2a', trim: '#0f0f16', accent: '#ff4a4a', props: ['pc', 'safe', 'lamp', 'pipes', 'painting'], hide: 'closet', skin: 'boss' },
];

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const COLORS = ['#e84a4a', '#3b8cff', '#41d97a'];
const LABEL = { '#e84a4a': 'rode', '#3b8cff': 'blauwe', '#41d97a': 'groene' };
export const colorName = (c) => LABEL[c] || '';

export function makeLevel(n, variant = 0) {
  const R = rng(n * 9973 + variant * 131 + 7);
  const T = THEMES[n - 1];
  const d = (n - 1) / 24;
  const floors = n <= 2 ? 2 : n <= 8 ? 3 : n <= 14 ? (R() < 0.5 ? 3 : 4) : 4;
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
  const start = { f: 0, x: 3 };
  const exit = { f: floors - 1, x: 28 };
  take(0, 3, 2.5); take(exit.f, exit.x, 2.5);

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
        const xl = spot(f, zone[0], zone[1], 2.2), xu = spot(f + 1, zone[0], zone[1], 2.2);
        if (xl === null || xu === null) continue;
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
  const reqCount = 1 + Math.floor(d * 5.5) + (n >= 20 ? 0 : 0);
  const types = ['doc', 'loot', 'doc'].concat(n >= 6 ? ['hack'] : []);
  for (let i = 0; i < reqCount; i++) {
    const f = floors > 1 && i > 0 ? (R() < 0.7 ? 1 + ((R() * (floors - 1)) | 0) : 0) : (floors > 2 ? 1 : floors - 1);
    const x = spot(f, 3, 29, 1.8);
    if (x === null) continue;
    items.push({ id: items.length, type: i === 0 && n === 1 ? 'loot' : types[i % types.length], f, x, req: true });
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
      const sx = spot(0, 5, 14, 1.8);
      if (sx === null) ls.needSwitch = false; else { items.push({ id: items.length, type: 'switch', f: 0, x: sx, req: true }); take(0, sx, 1.8); }
    }
  }

  // ---- sloten en sleutels: een deur gaat pas open met de sleutel van dezelfde kleur
  const nodes = (lockedSet) => {
    // welke kamers zijn te bereiken vanaf het begin?
    const id = (f, i) => f * 10 + i;
    const seen = new Set([id(0, roomOf(0, start.x))]);
    const q = [[0, roomOf(0, start.x)]];
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
  const locks = n >= 5 ? (n >= 14 ? 2 : 1) : 0;
  const lockedSet = new Set();
  for (let c = 0; c < locks; c++) {
    let done = false;
    for (let t = 0; t < 30 && !done; t++) {
      const w = pick(walls.filter((x) => !x.lock));
      const trial = new Set([...lockedSet, w]);
      const reach = nodes(trial);
      const far = items.filter((i) => i.req && !reach.has(i.f, i.x)).length + (reach.has(exit.f, exit.x) ? 0 : 1);
      if (!far) continue;
      const allLocked = nodes(new Set([...lockedSet, ...walls.filter((x) => x.lock), w]));
      const kf = (R() * floors) | 0;
      const kx = spot(kf, 3, 29, 1.8);
      if (kx === null || !allLocked.has(kf, kx)) continue;
      w.lock = COLORS[c];
      lockedSet.add(w);
      items.push({ id: items.length, type: 'key', color: COLORS[c], f: kf, x: kx, req: false });
      take(kf, kx, 1.8);
      done = true;
    }
  }

  // ---- bewakers
  const guards = [];
  const startRoom = { f: 0, x0: 1, x1: 10 };
  const addGuard = (g) => guards.push({ id: guards.length, skin: T.skin, phase: rnd(0, 8), ...g });
  const roomFor = (avoidStart = true) => {
    for (let t = 0; t < 40; t++) {
      const f = (R() * floors) | 0;
      const r = pick(rooms[f]);
      if (avoidStart && f === 0 && r.x0 <= startRoom.x1 && r.x1 >= 1 && r.x0 < 8) continue;
      return { f, r, i: rooms[f].indexOf(r) };
    }
    return { f: floors - 1, r: rooms[floors - 1][1], i: 1 };
  };
  // als een level te vol zit om te halen, probeert de generator een iets rustigere variant
  const sc = variant >= 40 ? 0.6 : variant >= 20 ? 0.8 : 1;
  const nP = n < 2 ? 0 : Math.max(1, Math.floor(Math.min(6, 1 + Math.floor(d * 5.5)) * sc));
  const nC = n >= 4 ? Math.max(1, Math.floor(Math.min(4, 1 + Math.floor(d * 3)) * sc)) : 0;
  const nS = n >= 7 ? Math.floor(Math.floor(d * 3.5) * sc) : 0;
  const nD = n >= 10 ? Math.floor(Math.min(3, 1 + Math.floor((d - 0.4) * 3)) * sc) : 0;
  const nH = n >= 9 ? Math.floor(Math.floor(d * 2.5) * sc) : 0;
  const nF = n >= 12 ? Math.floor(Math.floor(d * 3) * sc) : 0;
  const patrolSpec = (kind) => {
    const { f, r, i } = roomFor();
    let x0 = r.x0 + 0.8, x1 = r.x1 - 0.8;
    if (R() < 0.3 + d * 0.4 && i + 1 < rooms[f].length) x1 = rooms[f][i + 1].x1 - 0.8; // door door: loopt door naar de volgende kamer
    if (x1 - x0 > 14) x1 = x0 + 14;
    const sp = kind === 'fast' ? 2.6 + d : kind === 'heavy' ? 1.0 : kind === 'drone' ? 2.3 : 1.3 + 1.1 * d;
    return { kind, f, x0, x1, speed: sp, pause: kind === 'drone' ? 0.6 : kind === 'fast' ? 0.5 : Math.max(0.5, 1.5 - 0.9 * d), range: kind === 'heavy' ? 6.8 : kind === 'fast' ? 4.2 : 4.2 + 1.8 * d };
  };
  for (let i = 0; i < nP; i++) addGuard(patrolSpec('patrol'));
  for (let i = 0; i < nH; i++) addGuard(patrolSpec('heavy'));
  for (let i = 0; i < nF; i++) addGuard(patrolSpec('fast'));
  for (let i = 0; i < nD; i++) addGuard(patrolSpec('drone'));
  for (let i = 0; i < nC; i++) {
    const { f, r } = roomFor();
    const x = Math.round(rnd(r.x0 + 2, r.x1 - 2));
    addGuard({ kind: 'camera', f, x0: x, x1: x, amp: rnd(0.45, 0.75), period: rnd(3.8, 6), half: 0.27, range: 5.8 });
  }
  for (let i = 0; i < nS; i++) {
    const { f, r } = roomFor();
    const x = Math.round(rnd(r.x0 + 2, r.x1 - 2));
    addGuard({ kind: 'sleeper', f, x0: x, x1: x, dir: R() < 0.5 ? 1 : -1, sleep: rnd(4, 6), awake: rnd(2.6, 3.6), range: 5.5 });
  }
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
  for (let f = 0; f < floors; f++) for (let i = 0; i < 9; i++) {
    const x = spot(f, 2, 30, 1.7);
    if (x === null) continue;
    const useWall = wallProps.length && i % 3 === 2;
    const list = useWall ? wallProps : bag.length ? bag : T.props;
    decor.push({ f, x, type: list[(i + f + ((R() * 3) | 0)) % list.length] });
    take(f, x, 1.7);
  }

  const V = VARIANTS[n];
  const level = { n, theme: T, floors, start, exit, rooms, walls, ladders, stairs, items, lasers, guards, hides, decor, limit: V ? Math.ceil(V.base * (2.7 - 1.3 * d) + 10) : 180, base: V ? V.base : 0 };
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
