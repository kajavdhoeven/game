// Spelregels: Vuur-Te-Un mag niet in water, Water-Te-Un niet in lava, en geen van beiden in groene smurrie.
import { W, H } from './levels.js';

const HALF = 0.34;  // halve breedte
const BODY = 1.6;   // lichaamshoogte
const GRAV = 30, JUMP = 12, SPEED = 4.8;

export class World {
  constructor(level) {
    this.L = level;
    this.t = 0;
    this.state = 'play'; // play | won | dead
    this.reason = '';
    this.leverState = level.levers.map(() => 0); // 0 = links, 1 = rechts (open)
    this.buttonDown = level.buttons.map(() => false);
    this.gates = level.gates.map((g) => ({ ...g, open: 0 })); // open: 0..1
    this.chars = ['fire', 'water'].map((kind) => ({
      kind, x: level.starts[kind].x, y: level.starts[kind].y, vx: 0, vy: 0, grounded: false, face: kind === 'fire' ? 1 : 1, dead: false, atDoor: false, walk: 0, jumpHeld: false,
    }));
    this.gemsGot = { red: 0, blue: 0 };
    this.gemsTotal = { red: level.gems.filter((g) => g.type === 'red').length, blue: level.gems.filter((g) => g.type === 'blue').length };
    this.events = [];
    this.liq = new Map();
    for (const l of level.liquids) for (let i = 0; i < l.w; i++) this.liq.set(`${l.x + i},${l.y}`, l.type);
  }
  gateOpen(i) { return this.gates[i].open > 0.9; }
  solidAt(tx, ty) {
    if (tx < 0 || tx >= W || ty < 0 || ty >= H) return true;
    if (this.L.grid[ty * W + tx]) return true;
    for (const g of this.gates) if (g.open < 0.9 && tx === g.x && ty >= g.y && ty < g.y + g.h) return true;
    return false;
  }
  boxFree(x, y) { // voeten op (x, y); y is de bovenkant van de vloer eronder
    const x0 = Math.floor(x - HALF + 1e-4), x1 = Math.floor(x + HALF - 1e-4);
    const y0 = Math.floor(y - BODY + 1e-4), y1 = Math.floor(y - 1e-4);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (this.solidAt(tx, ty)) return false;
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
          const want = c.vx > 0.5 ? 1 : c.vx < -0.5 ? 0 : this.leverState[i];
          if (want !== this.leverState[i]) { this.leverState[i] = want; this.events.push('lever'); }
        }
      });
    }
    down.forEach((d, i) => { if (d && !this.buttonDown[i]) this.events.push('button'); });
    this.buttonDown = down;
    this.gates.forEach((g, gi) => {
      const byButton = this.L.buttons.some((b, i) => b.gate === gi && this.buttonDown[i]);
      const byLever = this.L.levers.some((lv, i) => lv.gate === gi && this.leverState[i] === 1);
      const want = byButton || byLever ? 1 : 0;
      const prev = g.open;
      g.open += Math.sign(want - g.open) * Math.min(Math.abs(want - g.open), dt * 2.2);
      if (prev < 0.9 && g.open >= 0.9) this.events.push('gate');
    });

    for (const c of this.chars) {
      if (c.dead) continue;
      const inp = input[c.kind] || {};
      const target = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
      c.vx += (target * SPEED - c.vx) * Math.min(1, dt * 18);
      if (target) c.face = target;
      if (inp.u && c.grounded && !c.jumpHeld) { c.vy = -JUMP; c.grounded = false; this.events.push('jump'); }
      c.jumpHeld = !!inp.u;
      c.vy = Math.min(22, c.vy + GRAV * dt);
      // horizontaal, met opstapjes van 1 tegel (zoals een helling)
      let nx = c.x + c.vx * dt;
      if (this.boxFree(nx, c.y)) c.x = nx;
      else if (c.grounded && this.boxFree(nx, c.y - 1.02) && this.boxFree(c.x, c.y - 1.02)) { c.x = nx; c.y -= 1.0; }
      else {
        // tot de rand schuiven
        const dir = Math.sign(c.vx) || 1;
        let lo = 0, hi = Math.abs(nx - c.x);
        for (let i = 0; i < 8; i++) { const mid = (lo + hi) / 2; if (this.boxFree(c.x + dir * mid, c.y)) lo = mid; else hi = mid; }
        c.x += dir * lo; c.vx = 0;
      }
      // verticaal
      let ny = c.y + c.vy * dt;
      c.grounded = false;
      if (this.boxFree(c.x, ny)) c.y = ny;
      else {
        const dir = Math.sign(c.vy) || 1;
        let lo = 0, hi = Math.abs(ny - c.y);
        for (let i = 0; i < 10; i++) { const mid = (lo + hi) / 2; if (this.boxFree(c.x, c.y + dir * mid)) lo = mid; else hi = mid; }
        c.y += dir * lo;
        if (c.vy > 0) { c.grounded = true; c.y = Math.round(c.y * 64) / 64; }
        c.vy = 0;
      }
      if (c.grounded === false && this.solidAt(Math.floor(c.x), Math.floor(c.y + 0.02)) && c.vy >= 0) c.grounded = true;
      c.walk += Math.abs(c.vx) * dt * 2.2;

      // plassen: tegels waar je voeten staan
      const feetTile = this.liq.get(`${Math.floor(c.x)},${Math.floor(c.y - 0.1)}`) || this.liq.get(`${Math.floor(c.x)},${Math.floor(c.y + 0.1)}`);
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
    if (this.chars.every((c) => c.atDoor)) { this.state = 'won'; this.events.push('win'); }
  }
}
