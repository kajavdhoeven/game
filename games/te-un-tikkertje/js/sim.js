// Spelregels van Te-Un Tikkertje: beweging, tikken, rondes en de NPC-besturing. Geen scherm nodig, dus te testen met bots.
export const W = 40, H = 22, TS = 32;
const HW = 0.34, BODY = 1.5;            // halve breedte en hoogte van een kabouter (in tegels)
const GRAV = 38, JUMP = 16.5, SPEED = 6.5;
export const ROUND_TIME = 60;

// De grond en zwevende platforms per omgeving (alleen de bovenkant telt: je springt er van onderaf doorheen, maar valt er niet doorheen als je erop staat).
// Elke omgeving heeft een eigen indeling en een trampoline aan de linker- of rechterrand.
const G0 = { x0: 0, x1: 39, y: 20, ground: true };
const mk = (rows) => [G0, ...rows.flatMap(([y, list]) => list.map(([x0, x1]) => ({ x0, x1, y })))];
export const LAYOUTS = {
  forest: { tramp: 'right', plats: mk([[17, [[2, 7], [13, 20], [26, 31]]], [14, [[5, 10], [18, 25], [33, 38]]], [11, [[1, 6], [12, 17], [28, 34]]], [8, [[8, 14], [22, 30], [35, 38]]]]) },
  desert: { tramp: 'left', plats: mk([[17, [[4, 9], [15, 19], [24, 30], [35, 38]]], [14, [[1, 6], [11, 17], [22, 27], [31, 36]]], [11, [[7, 12], [18, 24], [29, 33]]], [8, [[2, 8], [14, 21], [26, 32]]]]) },
  winter: { tramp: 'right', plats: mk([[17, [[3, 10], [21, 27], [32, 37]]], [14, [[1, 6], [12, 19], [28, 31]]], [11, [[4, 9], [15, 22], [26, 33]]], [8, [[10, 16], [21, 26], [31, 38]]]]) },
};
export const TRAMP_V = 31;   // lanceersnelheid van de trampoline
export const TRAMP_W = 2;    // breedte in tegels
export const SHIRTS = ['#2fa84f', '#f08a24', '#e85aa0'];
export const TYPES = ['teun', 'speed', 'shadow', 'wizard'];
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
  // mode: 'normal' | 'hardcore'; type: personage van speler 1; players: 1 of 2; biome: bos | woestijn | winter (bepaalt de indeling)
  constructor({ mode = 'normal', type = 'teun', players = 1, biome = 'forest', seed = (Math.random() * 1e9) | 0 } = {}) {
    this.R = rng(seed);
    this.mode = mode; this.players = players;
    const lay = LAYOUTS[biome] || LAYOUTS.forest;
    this.plats = lay.plats;
    this.tramp = lay.tramp === 'left' ? { x0: 0, x1: TRAMP_W } : { x0: W - TRAMP_W, x1: W };
    this.spawns = [];
    for (const p of this.plats) {
      const n = p.ground ? 3 : 1;
      for (let i = 0; i < n; i++) this.spawns.push([p.ground ? [4, 20, 35][i] : Math.floor((p.x0 + p.x1) / 2), p.y]);
    }
    this.spawns = this.spawns.filter(([x]) => x < this.tramp.x0 - 1 || x > this.tramp.x1 + 1 || false);
    const rngType = () => TYPES[(this.R() * TYPES.length) | 0];
    const humans = players === 2
      ? [{ name: 'Speler 1', human: true, type: 'teun', shirt: '#2f6fe0' }, { name: 'Speler 2', human: true, type: 'teun', shirt: '#e0282f' }]
      : [{ name: 'Jij', human: true, type, shirt: '#2f6fe0' }];
    const npcs = SHIRTS.slice(0, 4 - humans.length).map((sh, i) => ({ name: 'Te-Un ' + (i + 1), human: false, type: rngType(), shirt: sh }));
    this.chars = [...humans, ...npcs].map((c, i) => ({ id: i, player: c.human, ...c }));
    for (const c of this.chars) Object.assign(c, { x: 0, y: 20, vx: 0, vy: 0, grounded: true, face: 1, plat: this.plats[0], it: false, alive: true, immuneT: 0, coolT: 0, coyote: 0, buf: 0, jumpHeld: false, taggerTime: 0, stage: 0, invisT: 0, portal: null, goal: null, goalT: 0, walk: 0, rank: 0, badge: false, trampT: 0 });
    this.round = 0;
    this.events = [];
    this.parts = [];
    this.state = 'intro'; this.t = 0; this.stateT = 0;
    this.rank = 0; this.coins = 0;
    this.startRound();
  }
  humans() { return this.chars.filter((c) => c.player); }
  alive() { return this.chars.filter((c) => c.alive); }
  startRound() {
    this.round++;
    const al = this.alive();
    const spawns = this.spawns.slice().sort(() => this.R() - 0.5);
    al.forEach((c, i) => {
      const [x, y] = spawns[i];
      Object.assign(c, { x: x + 0.5, y, vx: 0, vy: 0, grounded: true, it: false, immuneT: 0, coolT: 0, taggerTime: 0, goal: null, goalT: 0, noBackT: 0, plat: this.plats.find((p) => p.y === y && x >= p.x0 && x <= p.x1 + 1) });
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
  // één stap. pins: { dir, jump, ability } voor één speler, of een lijst van die dingen (speler 1, speler 2)
  step(dt, pins = {}) {
    const pinOf = (i) => (Array.isArray(pins) ? pins[i] : i === 0 ? pins : null) || {};
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
        if (!this.humans().some((c) => c.alive)) this.finish();
        else if (this.alive().length === 1) { const w = this.alive()[0]; w.rank = 1; this.finish(); }
        else this.startRound();
      }
      return;
    }
    // --- spelen
    this.roundT -= dt;
    this.humans().forEach((h, i) => { if (pinOf(i).ability && h.alive) this.useAbility(h); });
    for (const c of this.alive()) {
      c.noBackT = Math.max(0, (c.noBackT || 0) - dt); c.immuneT = Math.max(0, c.immuneT - dt); c.coolT = Math.max(0, c.coolT - dt); c.invisT = Math.max(0, c.invisT - dt);
      if (c.it) {
        c.taggerTime += dt;
        if (c.player && !c.badge && c.taggerTime >= 50) { c.badge = true; this.events.push({ t: 'badge', id: c.id }); }
      }
      let dir, jump;
      if (c.player) { const h = this.humans().indexOf(c); const p = pinOf(h); dir = p.dir || 0; jump = !!p.jump; } else ({ dir, jump } = this.ai(c, dt));
      this.physics(c, dir, jump, dt, this.speedOf(c));
    }
    this.tagCheck();
    if (this.roundT <= 0) this.endRound();
  }
  useAbility(c) {
    if (c.type === 'wizard') {
      if (c.stage === 0) { c.portal = { x: c.x, y: c.y }; c.stage = 1; this.events.push({ t: 'portal', id: c.id }); }
      else if (c.stage === 1) { this.puff(c.x, c.y - 0.7, '#b06bff'); c.x = c.portal.x; c.y = c.portal.y; c.vx = 0; c.vy = 0; c.grounded = true; c.portal = null; c.stage = 2; this.puff(c.x, c.y - 0.7, '#b06bff'); this.events.push({ t: 'teleport', id: c.id }); }
    } else if (c.type === 'shadow') {
      if (c.stage === 0) { c.stage = 1; c.invisT = 5; this.events.push({ t: 'shadow', id: c.id }); }
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
    c.vy = Math.min(34, c.vy + GRAV * dt);
    c.x = Math.max(HW, Math.min(W - HW, c.x + c.vx * dt));
    const py = c.y;
    c.y += c.vy * dt;
    c.grounded = false;
    c.trampT = Math.max(0, c.trampT - dt);
    if (c.vy >= 0) {
      let best = null;
      for (const p of this.plats) if (py <= p.y + 0.02 && c.y >= p.y && c.x + HW > p.x0 && c.x - HW < p.x1 + 1 && (!best || p.y < best.y)) best = p;
      if (best) {
        c.y = best.y; c.vy = 0; c.grounded = true; c.plat = best;
        // de trampoline op de grond aan de rand
        if (best.ground && c.x > this.tramp.x0 && c.x < this.tramp.x1 && c.trampT <= 0 && this.state === 'play') { c.vy = -TRAMP_V; c.grounded = false; c.trampT = 0.4; this.events.push({ t: 'bounce', id: c.id }); }
      }
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
    });
    this.state = 'elim'; this.stateT = 2.4;
  }
  finish() {
    // wie nog leeft als de rest eruit is, wint; speler 1 krijgt munten naar zijn plek
    const me = this.chars[0];
    this.rank = me.alive ? 1 : me.rank;
    this.coins = COINS_FOR[this.rank] || 0;
    this.state = 'over';
    this.events.push({ t: 'over', rank: this.rank, coins: this.coins, ranks: this.humans().map((h) => (h.alive ? 1 : h.rank)) });
  }

  // ---------------------------------------------------------------- NPC-besturing
  // Kiest een doel (x en de vloerhoogte waar het ligt) en stuurt daar naartoe. Ook de krachten van de NPC-personages (portaal en schim) worden hier gebruikt.
  ai(c, dt) {
    c.goalT -= dt;
    const others = this.alive().filter((o) => o !== c);
    const its = others.filter((o) => o.it && o.invisT <= 0);
    // krachten
    if (!c.it && this.state === 'play') {
      const near = its.reduce((m, t) => Math.min(m, Math.hypot(t.x - c.x, (t.y - c.y) * 1.2)), 99);
      if (c.type === 'shadow' && c.stage === 0 && near < 4.2) this.useAbility(c);
      if (c.type === 'wizard') {
        if (c.stage === 0 && this.roundT < ROUND_TIME - 6 && near > 6) this.useAbility(c);                        // portaal neerzetten op een rustig moment
        else if (c.stage === 1 && near < 2.4 && c.portal && Math.hypot(c.portal.x - c.x, c.portal.y - c.y) > 7) this.useAbility(c); // terug als het gevaarlijk wordt
      }
    }
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
    if (!its.length) return { dir: 0, jump: false };
    const dist = (x, y) => Math.min(...its.map((t) => Math.abs(t.x - x) + 2.4 * Math.abs(t.y - y)));
    if (c.goalT <= 0 || !c.goal || c.goal.ref) {
      c.goalT = 0.55 + this.R() * 0.3;
      const mates = others.filter((o) => !o.it);
      let best = null, bs = -1e9;
      for (const p of this.plats) {
        const xs = p.ground ? [4, 10, 20, 30, 36] : [p.x0 + 0.6, (p.x0 + p.x1 + 1) / 2, p.x1 + 0.4];
        for (const x of xs) {
          // niet allemaal in hetzelfde hoekje: een plek dicht bij een andere vluchter is minder aantrekkelijk
          const crowd = mates.reduce((a, o) => a + Math.max(0, 7 - (Math.abs(o.x - x) + 1.5 * Math.abs(o.y - p.y))), 0);
          const goalCrowd = mates.reduce((a, o) => a + (o.goal && !o.goal.ref ? Math.max(0, 6 - (Math.abs(o.goal.x - x) + 1.5 * Math.abs(o.goal.y - p.y))) : 0), 0);
          const s = dist(x, p.y) - 0.6 * (Math.abs(x - c.x) + 2.4 * Math.abs(p.y - c.y)) - 0.9 * crowd - 1.4 * goalCrowd + this.R() * 2;
          if (s > bs) { bs = s; best = { x, y: p.y }; }
        }
      }
      c.goal = best;
    }
    return this.drive(c, c.goal.x, c.goal.y, false);
  }
  // loop en spring richting (gx, gy); gy is de vloerhoogte van het doel
  drive(c, gx, gy, chase) {
    const P = c.plat || this.plats[0];
    const dyF = gy - c.y;
    const toward = (x) => (Math.abs(x - c.x) < 0.12 ? 0 : x > c.x ? 1 : -1);
    if (!c.grounded) {
      // in de lucht: richting het doel, of naar het platform waar we heen willen
      return { dir: c.airDir !== undefined ? c.airDir : toward(gx), jump: false };
    }
    c.airDir = undefined;
    if (dyF < -4.4 && P.ground) {
      // heel hoog: via de trampoline omhoog
      const tx = (this.tramp.x0 + this.tramp.x1) / 2;
      if (Math.abs(c.x - tx) > 0.2) return { dir: toward(tx), jump: false };
    }
    if (dyF < -0.8) {
      // het doel is hoger: zoek een platform dat 0,6 tot 3,1 tegels hoger ligt en het dichtst bij het doel
      let best = null, bd = 1e9;
      for (const p of this.plats) {
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
      const L = P.x0, Rr = P.x1 + 1;
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
