// Spelregels: VuurTe-Un mag niet in water, WaterTe-Un niet in lava, en geen van beiden in groene smurrie.
// Daarnaast: poorten en bruggen met knoppen of hendels, kratten die je kunt duwen en planken boven smurrie die rondtollen als je er naast landt.
import { W, H } from './levels.js';

const HALF = 0.34;  // halve breedte
const BODY = 1.6;   // lichaamshoogte
const GRAV = 30, JUMP = 12, SPEED = 4.8;
const CR_W = 0.55, CR_H = 1.2; // halve breedte en hoogte van een krat
const PLANK_ZONE = 0.75;       // landt iemand verder van het midden, dan tolt de plank rond

export class World {
  constructor(level) {
    this.L = level;
    this.t = 0;
    this.state = 'play'; // play | won | dead
    this.reason = '';
    this.leverState = level.levers.map(() => 0); // 0 = dicht, 1 = open
    this.buttonDown = level.buttons.map(() => false);
    this.gates = level.gates.map((g) => ({ ...g, open: 0 })); // open: 0..1
    this.bridges = level.bridges.map((b) => ({ ...b, p: 0 }));  // p: 0..1 hoeveel er uitgeschoven is
    this.crates = level.crates.map((c) => ({ x: c.x, y: c.y, x0: c.x, y0: c.y, vy: 0, dead: 0 }));
    this.planks = level.planks.map((p) => ({ ...p, theta: 0, omega: 0, spin: 0 }));
    this.chars = ['fire', 'water'].map((kind) => ({
      kind, x: level.starts[kind].x, y: level.starts[kind].y, vx: 0, vy: 0, grounded: false, face: 1, dead: false, atDoor: false, walk: 0, jumpHeld: false, pushing: false,
    }));
    this.gemsGot = { red: 0, blue: 0 };
    this.gemsTotal = { red: level.gems.filter((g) => g.type === 'red').length, blue: level.gems.filter((g) => g.type === 'blue').length };
    this.events = [];
    this.liq = new Map();
    for (const l of level.liquids) for (let i = 0; i < l.w; i++) this.liq.set(`${l.x + i},${l.y}`, l.type);
  }
  gateOpen(i) { return this.gates[i].open > 0.9; }
  bridgeCell(tx, ty) {
    for (const b of this.bridges) {
      if (ty !== b.y) continue;
      const i = (tx - b.x) * b.dir;
      if (i >= 0 && i < b.len && i < Math.round(b.p * b.len)) return true;
    }
    return false;
  }
  solidAt(tx, ty) {
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return true;
    if (this.L.grid[ty * W + tx]) return true;
    for (const g of this.gates) if (g.open < 0.9 && tx === g.x && ty >= g.y && ty < g.y + g.h) return true;
    return this.bridgeCell(tx, ty);
  }
  tilesFree(x, y) { // voeten op (x, y); alleen de tegels
    const x0 = Math.floor(x - HALF + 1e-4), x1 = Math.floor(x + HALF - 1e-4);
    const y0 = Math.floor(y - BODY + 1e-4), y1 = Math.floor(y - 1e-4);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return false;
    return true;
  }
  crateHit(x, y, skip) { // raakt het poppetje (voeten x, y) een krat?
    for (const c of this.crates) {
      if (c === skip || c.dead) continue;
      if (Math.abs(x - c.x) < HALF + CR_W - 1e-3 && y - BODY < c.y - 1e-3 && y > c.y - CR_H + 1e-3) return c;
    }
    return null;
  }
  boxFree(x, y) { return this.tilesFree(x, y) && !this.crateHit(x, y); }
  crateFree(c, x, y) { // past een krat (voeten x, y) daar?
    const x0 = Math.floor(x - CR_W + 1e-3), x1 = Math.floor(x + CR_W - 1e-3);
    const y0 = Math.floor(y - CR_H + 1e-3), y1 = Math.floor(y - 1e-3);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return false;
    for (const o of this.crates) if (o !== c && !o.dead && Math.abs(x - o.x) < CR_W * 2 - 1e-3 && Math.abs(y - o.y) < CR_H - 1e-3) return false;
    return true;
  }
  step(dt, input) {
    if (this.state !== 'play') return;
    this.t += dt;
    // knoppen en hendels
    const down = this.L.buttons.map(() => false);
    for (const c of this.chars) {
      if (c.dead) continue;
      this.L.buttons.forEach((b, i) => { if (Math.abs(c.x - (b.x + 0.5)) < 0.75 && Math.abs(c.y - (b.y + 1)) < 0.3) down[i] = true; });
      this.L.levers.forEach((lv, i) => {
        if (Math.abs(c.x - (lv.x + 0.5)) < 0.55 && Math.abs(c.y - (lv.y + 1)) < 0.4) {
          const want = c.vx * lv.openDir > 0.5 ? 1 : c.vx * lv.openDir < -0.5 ? 0 : this.leverState[i];
          if (want !== this.leverState[i]) { this.leverState[i] = want; this.events.push('lever'); }
        }
      });
    }
    down.forEach((d, i) => { if (d && !this.buttonDown[i]) this.events.push('button'); });
    this.buttonDown = down;
    this.gates.forEach((g, gi) => {
      const byButton = this.L.buttons.some((b, i) => b.kind === 'gate' && b.gate === gi && this.buttonDown[i]);
      const byLever = this.L.levers.some((lv, i) => lv.gate === gi && this.leverState[i] === 1);
      const want = byButton || byLever ? 1 : 0;
      const prev = g.open;
      g.open += Math.sign(want - g.open) * Math.min(Math.abs(want - g.open), dt * (want ? 2.2 : 0.7));
      if (prev < 0.9 && g.open >= 0.9) this.events.push('gate');
    });
    this.bridges.forEach((b, bi) => {
      const want = this.L.buttons.some((bt, i) => bt.kind === 'bridge' && bt.bridge === bi && this.buttonDown[i]) ? 1 : 0;
      b.p += Math.sign(want - b.p) * Math.min(Math.abs(want - b.p), dt * (want ? 1.1 : 0.45));
    });

    // planken: tollen rond als iemand ver van het midden landt
    for (const p of this.planks) {
      if (p.spin > 0) { p.spin -= dt; p.theta += p.omega * dt; if (p.spin <= 0) { p.theta = 0; p.omega = 0; p.spin = 0; } continue; }
      for (const c of this.chars) {
        if (c.dead || c.plank !== p) continue;
        if (Math.abs(c.x - p.x) > PLANK_ZONE) { p.spin = 1.7; p.omega = 7.5 * Math.sign(c.x - p.x); this.events.push('spin'); }
      }
    }

    for (const c of this.chars) {
      if (c.dead) continue;
      const inp = input[c.kind] || {};
      const target = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      c.vx += (target * SPEED - c.vx) * Math.min(1, dt * 18);
      if (target) c.face = target;
      if (inp.u && c.grounded && !c.jumpHeld) { c.vy = -JUMP; c.grounded = false; this.events.push('jump'); }
      c.jumpHeld = !!inp.u;
      c.vy = Math.min(22, c.vy + GRAV * dt);
      // horizontaal, met opstapjes van 1 tegel en kratten die je duwt
      c.pushing = false;
      const nx = c.x + c.vx * dt;
      if (this.boxFree(nx, c.y)) c.x = nx;
      else {
        const cr = this.tilesFree(nx, c.y) ? this.crateHit(nx, c.y) : null;
        if (cr && c.grounded && Math.abs(c.vx) > 0.5) {
          // duwen: het poppetje en de krat schuiven langzamer samen op
          const d = (nx - c.x) * 0.55;
          if (this.crateFree(cr, cr.x + d, cr.y) && this.tilesFree(c.x + d, c.y)) { cr.x += d; c.x += d; c.pushing = true; }
        } else if (c.grounded && this.boxFree(nx, c.y - 1.02) && this.boxFree(c.x, c.y - 1.02)) { c.x = nx; c.y -= 1.0; }
        else {
          const dir = Math.sign(c.vx) || 1;
          let lo = 0, hi = Math.abs(nx - c.x);
          for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (this.boxFree(c.x + dir * mid, c.y)) lo = mid; else hi = mid; }
          c.x += dir * lo; c.vx = 0;
        }
      }
      // verticaal
      const py = c.y;
      const ny = c.y + c.vy * dt;
      c.grounded = false; c.plank = null;
      if (this.boxFree(c.x, ny)) c.y = ny;
      else {
        const dir = Math.sign(c.vy) || 1;
        let lo = 0, hi = Math.abs(ny - c.y);
        for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; if (this.boxFree(c.x, c.y + dir * mid)) lo = mid; else hi = mid; }
        c.y += dir * lo;
        if (c.vy > 0) { c.grounded = true; c.y = Math.round(c.y * 64) / 64; }
        c.vy = 0;
      }
      if (c.grounded === false && c.vy >= 0 && (this.solidAt(Math.floor(c.x), Math.floor(c.y + 0.02)) || this.crateHit(c.x, c.y + 0.02))) c.grounded = true;
      // planken: een platform waar je van boven op landt
      if (c.vy >= 0) {
        for (const p of this.planks) {
          if (p.spin > 0 || Math.abs(c.x - p.x) > p.hl + HALF * 0.5) continue;
          if (py <= p.y + 0.03 && c.y >= p.y - 0.02 && c.y <= p.y + 0.6) { c.y = p.y; c.vy = 0; c.grounded = true; c.plank = p; break; }
        }
      }
      c.walk += Math.abs(c.vx) * dt * 2.2;

      // plassen: de tegel waar je voeten staan
      const feetTile = this.liq.get(`${Math.floor(c.x)},${Math.floor(c.y - 0.1)}`);
      const dead = feetTile && (feetTile === 'goo' || (feetTile === 'water' && c.kind === 'fire') || (feetTile === 'lava' && c.kind === 'water'));
      if (dead) { c.dead = true; this.state = 'dead'; this.reason = feetTile; this.events.push('die'); }
      // diamanten
      for (const g of this.L.gems) {
        if (g.got) continue;
        if ((g.type === 'red') !== (c.kind === 'fire')) continue;
        if (Math.hypot(c.x - g.x, c.y - 0.8 - g.y) < 0.8) { g.got = true; this.gemsGot[g.type]++; this.events.push('gem'); }
      }
      // deur
      const door = this.L.doors[c.kind];
      c.atDoor = Math.abs(c.x - (door.x + 1)) < 0.75 && Math.abs(c.y - door.y) < 0.4;
    }

    // kratten: vallen naar beneden, zakken weg in plassen en komen dan terug op hun plek
    for (const c of this.crates) {
      if (c.dead > 0) { c.dead -= dt; if (c.dead <= 0) { c.dead = 0; c.x = c.x0; c.y = c.y0; c.vy = 0; } continue; }
      c.vy = Math.min(20, c.vy + GRAV * dt);
      const ny = c.y + c.vy * dt;
      if (this.crateFree(c, c.x, ny)) c.y = ny;
      else { let lo = 0, hi = Math.abs(ny - c.y); for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (this.crateFree(c, c.x, c.y + mid)) lo = mid; else hi = mid; } c.y += lo; c.vy = 0; }
      if (this.liq.get(`${Math.floor(c.x)},${Math.floor(c.y - 0.1)}`) || c.y > H - 0.5) { c.dead = 1.2; this.events.push('splash'); }
    }
    if (this.chars.every((c) => c.atDoor)) { this.state = 'won'; this.events.push('win'); }
  }
}
