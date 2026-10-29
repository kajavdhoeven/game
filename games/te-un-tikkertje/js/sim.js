// Spelregels van Te-Un Tikkertje: beweging, tikken, rondes en de NPC-besturing. Geen scherm nodig, dus te testen met bots.
export const W = 40, H = 22, TS = 32;
const HW = 0.34, BODY = 1.5;            // halve breedte en hoogte van een kabouter (in tegels)
const GRAV = 38, JUMP = 16.5, SPEED = 6.5;
export const ROUND_TIME = 60;

// de grond en zwevende platforms (alleen de bovenkant telt: je springt er van onderaf doorheen, maar valt er niet doorheen als je erop staat)
export const PLATS = [
  { x0: 0, x1: 39, y: 20, ground: true },
  { x0: 2, x1: 8, y: 17 }, { x0: 17, x1: 23, y: 17 }, { x0: 32, x1: 38, y: 17 },
  { x0: 9, x1: 15, y: 14 }, { x0: 25, x1: 31, y: 14 },
  { x0: 2, x1: 8, y: 11 }, { x0: 17, x1: 23, y: 11 }, { x0: 32, x1: 38, y: 11 },
  { x0: 9, x1: 15, y: 8 }, { x0: 25, x1: 31, y: 8 },
];
const SPAWNS = [[4, 20], [20, 20], [36, 20], [5, 17], [20, 17], [35, 17], [12, 14], [28, 14], [5, 11], [35, 11], [12, 8], [28, 8]];
export const SHIRTS = ['#2fa84f', '#f08a24', '#e85aa0'];
export const COINS_FOR = { 1: 15, 2: 10, 3: 5, 4: 0 };

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export class Game {
  // mode: 'normal' | 'hardcore'; type: het gekozen personage van de speler: teun | wizard | speed | shadow
  constructor({ mode = 'normal', type = 'teun', seed = (Math.random() * 1e9) | 0 } = {}) {
    this.R = rng(seed);
    this.mode = mode;
    this.chars = [{ id: 0, name: 'Jij', player: true, type, shirt: '#2f6fe0' }, ...SHIRTS.map((s, i) => ({ id: i + 1, name: 'Te-Un ' + (i + 1), player: false, type: 'teun', shirt: s }))];
    for (const c of this.chars) Object.assign(c, { x: 0, y: 20, vx: 0, vy: 0, grounded: true, face: 1, plat: PLATS[0], it: false, alive: true, immuneT: 0, coolT: 0, coyote: 0, buf: 0, jumpHeld: false, taggerTime: 0, stage: 0, invisT: 0, portal: null, goal: null, goalT: 0, walk: 0, rank: 0 });
    this.round = 0;
    this.events = [];
    this.parts = [];
    this.state = 'intro'; this.t = 0; this.stateT = 0;
    this.rank = 0; this.coins = 0;
    this.startRound();
  }
  alive() { return this.chars.filter((c) => c.alive); }
  startRound() {
    this.round++;
    const al = this.alive();
    const spawns = SPAWNS.slice().sort(() => this.R() - 0.5);
    al.forEach((c, i) => {
      const [x, y] = spawns[i];
      Object.assign(c, { x: x + 0.5, y, vx: 0, vy: 0, grounded: true, it: false, immuneT: 0, coolT: 0, taggerTime: 0, goal: null, goalT: 0, plat: PLATS.find((p) => p.y === y && x >= p.x0 && x <= p.x1 + 1) });
    });
    const k = this.mode === 'hardcore' && this.round === 1 ? 2 : 1;
    const order = al.slice().sort(() => this.R() - 0.5);
    order.slice(0, Math.min(k, al.length - 1)).forEach((c) => { c.it = true; });
    this.roundT = ROUND_TIME;
    this.state = 'intro'; this.stateT = 2.4;
    this.events.push({ t: 'round', n: this.round });
  }
  speedOf(c) {
    if (c.type === 'speed' && !c.it) return SPEED * 2;
    return c.player ? SPEED : c.it ? SPEED * 0.88 : SPEED * 0.98;
  }
  // één stap. pin: { dir: -1|0|1, jump: bool, ability: bool (alleen op het moment van indrukken) }
  step(dt, pin = {}) {
    this.t += dt;
    for (const p of this.parts) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 20 * dt; }
    this.parts = this.parts.filter((p) => p.life > 0);
    if (this.state === 'over') return;
    if (this.state === 'intro') {
      this.stateT -= dt;
      for (const c of this.alive()) this.physics(c, 0, false, dt, 0);
      if (this.stateT <= 0) { this.state = 'play'; this.events.push({ t: 'go' }); }
      return;
    }
    if (this.state === 'elim') {
      this.stateT -= dt;
      for (const c of this.alive()) this.physics(c, 0, false, dt, 0);
      if (this.stateT <= 0) {
        if (!this.chars[0].alive) { this.state = 'over'; this.events.push({ t: 'over', rank: this.rank, coins: this.coins }); }
        else if (this.alive().length === 1) { this.rank = 1; this.coins = COINS_FOR[1]; this.state = 'over'; this.events.push({ t: 'over', rank: 1, coins: this.coins }); }
        else this.startRound();
      }
      return;
    }
    // --- spelen
    this.roundT -= dt;
    const me = this.chars[0];
    // vermogens van de speler
    if (pin.ability && me.alive) this.useAbility(me);
    for (const c of this.alive()) {
      c.noBackT = Math.max(0, (c.noBackT || 0) - dt); c.immuneT = Math.max(0, c.immuneT - dt); c.coolT = Math.max(0, c.coolT - dt); c.invisT = Math.max(0, c.invisT - dt);
      if (c.it) c.taggerTime += dt;
      let dir, jump;
      if (c.player) { dir = pin.dir || 0; jump = !!pin.jump; } else ({ dir, jump } = this.ai(c, dt));
      this.physics(c, dir, jump, dt, this.speedOf(c));
    }
    this.tagCheck();
    if (this.roundT <= 0) this.endRound();
  }
  useAbility(c) {
    if (c.type === 'wizard') {
      if (c.stage === 0) { c.portal = { x: c.x, y: c.y }; c.stage = 1; this.events.push({ t: 'portal' }); }
      else if (c.stage === 1) { this.puff(c.x, c.y - 0.7, '#b06bff'); c.x = c.portal.x; c.y = c.portal.y; c.vx = 0; c.vy = 0; c.grounded = true; c.portal = null; c.stage = 2; this.puff(c.x, c.y - 0.7, '#b06bff'); this.events.push({ t: 'teleport' }); }
    } else if (c.type === 'shadow') {
      if (c.stage === 0) { c.stage = 1; c.invisT = 5; this.events.push({ t: 'shadow' }); }
    }
  }
  puff(x, y, col) { for (let i = 0; i < 14; i++) this.parts.push({ x, y, vx: (this.R() - 0.5) * 8, vy: -this.R() * 6, life: 0.5 + this.R() * 0.3, col }); }
  physics(c, dir, jump, dt, speed) {
    c.vx += (dir * speed - c.vx) * Math.min(1, dt * 14);
    if (dir) c.face = dir;
    c.coyote = c.grounded ? 0.09 : c.coyote - dt;
    if (jump && !c.jumpHeld) c.buf = 0.1;
    c.buf -= dt;
    c.jumpHeld = jump;
    if (c.buf > 0 && c.coyote > 0) { c.vy = -JUMP; c.grounded = false; c.coyote = 0; c.buf = 0; if (c.player) this.events.push({ t: 'jump' }); }
    c.vy = Math.min(26, c.vy + GRAV * dt);
    c.x = Math.max(HW, Math.min(W - HW, c.x + c.vx * dt));
    const py = c.y;
    c.y += c.vy * dt;
    c.grounded = false;
    if (c.vy >= 0) {
      let best = null;
      for (const p of PLATS) if (py <= p.y + 0.02 && c.y >= p.y && c.x + HW > p.x0 && c.x - HW < p.x1 + 1 && (!best || p.y < best.y)) best = p;
      if (best) { c.y = best.y; c.vy = 0; c.grounded = true; c.plat = best; }
    }
    c.walk += Math.abs(c.vx) * dt * 0.9;
  }
  tagCheck() {
    const its = this.alive().filter((c) => c.it);
    for (const a of its) {
      if (a.coolT > 0) continue;
      for (const b of this.alive()) {
        if (b.it || b.immuneT > 0 || b.invisT > 0) continue;
        if (a.noBackT > 0 && a.noBack === b.id) continue;
        if (Math.abs(a.x - b.x) < 0.66 && Math.abs(a.y - b.y) < 1.15) {
          a.it = false; a.immuneT = 1.2;
          b.it = true; b.coolT = 0.9; b.immuneT = 0; b.noBack = a.id; b.noBackT = 3.5;
          this.puff((a.x + b.x) / 2, (a.y + b.y) / 2 - 0.8, '#ffffff');
          this.events.push({ t: 'tag', from: a.id, to: b.id });
          break;
        }
      }
    }
  }
  endRound() {
    const its = this.alive().filter((c) => c.it).sort((a, b) => b.taggerTime - a.taggerTime);
    const before = this.alive().length;
    its.forEach((c, i) => {
      c.alive = false; c.rank = before - i;
      this.puff(c.x, c.y - 0.7, '#ff6a4a');
      this.events.push({ t: 'elim', id: c.id, rank: c.rank });
      if (c.player) { this.rank = c.rank; this.coins = COINS_FOR[c.rank]; }
    });
    this.state = 'elim'; this.stateT = 2.4;
  }

  // ---------------------------------------------------------------- NPC-besturing
  // Kiest een doel (x en de vloerhoogte waar het ligt) en stuurt daar naartoe.
  ai(c, dt) {
    c.goalT -= dt;
    const others = this.alive().filter((o) => o !== c);
    if (c.it) {
      if (c.goalT <= 0 || !c.goal || !c.goal.ref || !c.goal.ref.alive || c.goal.ref.it) {
        c.goalT = 0.25;
        let best = null, bd = 1e9;
        for (const o of others) {
          if (o.it || o.invisT > 0 || (c.noBackT > 0 && c.noBack === o.id)) continue;
          const d = Math.abs(o.x - c.x) + 1.6 * Math.abs(o.y - c.y) + (o.immuneT > 0 ? 6 : 0);
          if (d < bd) { bd = d; best = o; }
        }
        c.goal = best ? { ref: best } : null;
      }
      if (!c.goal) return { dir: 0, jump: false };
      const o = c.goal.ref;
      return this.drive(c, o.x, o.y, true);
    }
    // wegrennen van de dichtstbijzijnde tikker (de speler telt niet mee als hij onzichtbaar is)
    const its = others.filter((o) => o.it && o.invisT <= 0);
    if (!its.length) return { dir: 0, jump: false };
    const dist = (x, y) => Math.min(...its.map((t) => Math.abs(t.x - x) + 2.4 * Math.abs(t.y - y)));
    if (c.goalT <= 0 || !c.goal || c.goal.ref) {
      c.goalT = 0.55 + this.R() * 0.3;
      let best = null, bs = -1e9;
      for (const p of PLATS) {
        const xs = p.ground ? [1.5, 10, 20, 30, 38.5] : [p.x0 + 0.6, (p.x0 + p.x1 + 1) / 2, p.x1 + 0.4];
        for (const x of xs) {
          const s = dist(x, p.y) - 0.6 * (Math.abs(x - c.x) + 2.4 * Math.abs(p.y - c.y)) + this.R() * 1.5;
          if (s > bs) { bs = s; best = { x, y: p.y }; }
        }
      }
      c.goal = best;
    }
    return this.drive(c, c.goal.x, c.goal.y, false);
  }
  // loop en spring richting (gx, gy); gy is de vloerhoogte van het doel
  drive(c, gx, gy, chase) {
    const P = c.plat || PLATS[0];
    const dyF = gy - c.y;
    const toward = (x) => (Math.abs(x - c.x) < 0.12 ? 0 : x > c.x ? 1 : -1);
    if (!c.grounded) {
      // in de lucht: richting het doel, of naar het platform waar we heen willen
      return { dir: c.airDir !== undefined ? c.airDir : toward(gx), jump: false };
    }
    c.airDir = undefined;
    if (dyF < -0.8) {
      // het doel is hoger: zoek een platform dat 0,6 tot 3,1 tegels hoger ligt en het dichtst bij het doel
      let best = null, bd = 1e9;
      for (const p of PLATS) {
        const rise = c.y - p.y;
        if (rise < 0.6 || rise > 3.1) continue;
        const lo = p.x0, hi = p.x1 + 1;
        const dg = gx < lo ? lo - gx : gx > hi ? gx - hi : 0;
        const dm = c.x < lo ? lo - c.x : c.x > hi ? c.x - hi : 0;
        const d = dg * 1.2 + dm + Math.abs(p.y - gy) * 0.8;
        if (d < bd) { bd = d; best = p; }
      }
      if (!best) return { dir: toward(gx), jump: false };
      const lo = best.x0, hi = best.x1 + 1;
      const dm = c.x < lo ? lo - c.x : c.x > hi ? c.x - hi : 0;
      const mid = Math.max(lo + 0.6, Math.min(hi - 0.6, gx));
      if (dm <= 1.6) { c.airDir = toward(mid); return { dir: c.airDir || (c.x < (lo + hi) / 2 ? 1 : -1), jump: true }; }
      return { dir: toward(c.x < lo ? lo : hi), jump: false };
    }
    if (dyF > 0.8) {
      // het doel is lager: loop van de dichtstbijzijnde rand af
      const L = P.x0 - 0.0, Rr = P.x1 + 1;
      let edge;
      if (gx < L) edge = L - 0.5; else if (gx > Rr) edge = Rr + 0.5;
      else edge = c.x - L < Rr - c.x ? L - 0.5 : Rr + 0.5;
      if (P.ground) return { dir: toward(gx), jump: false };
      return { dir: toward(edge), jump: false };
    }
    // zelfde hoogte
    if (Math.abs(gx - c.x) < 0.15) return { dir: 0, jump: false };
    const dir = toward(gx);
    const edgeDist = dir > 0 ? P.x1 + 1 - c.x : c.x - P.x0;
    const outside = dir > 0 ? gx > P.x1 + 1 : gx < P.x0;
    if (outside && !P.ground && edgeDist < 0.9) { c.airDir = dir; return { dir, jump: true }; }
    return { dir, jump: false };
  }
}
