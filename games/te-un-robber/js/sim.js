// Spelregels van Te-Un the Robber: bewegen door een gebouw in doorsnede, bewakers (robots, camera's, drones, lasers), voorwerpen en het ontsnappen.
// Geen scherm nodig: de levelgenerator gebruikt dezelfde regels om te controleren of een level te halen is.
export const TS = 40, W = 32, H = 18;
export const Y = [16, 12, 8, 4];      // de vloer van elke verdieping (onderkant van de kamer)
export const WALK = 4, CLIMB = 3.2;   // loopsnelheid en klimsnelheid in tegels per seconde
export const HALF = 0.3;              // halve breedte van Te-Un
const PORTAL_T = 0.5;                 // een trap of lift duurt even
export const PICK_T = 1.6;            // zo lang moet je spatie ingedrukt houden om een slot open te breken
export const BATON_T = 0.4;           // een robot die je bijna heeft, zwaait zo lang uit met zijn knuppel
export const ALARM_T = 6;             // zo lang blijft het alarm aan
const CHASE = { patrol: 2.8, heavy: 2.1, fast: 3.9, sleeper: 2.6 }; // achtervolgsnelheid (Te-Un loopt 4)
export const SWING_T = 0.45;          // zo lang duurt een klap met de knuppel
export const STUN_T = 5;              // een geslagen robot is zo lang uitgeschakeld
const ACT = { doc: 0.4, loot: 0.5, switch: 0.3, hack: 1.8, code: 0.6, vault: 1.8, key: 0 }; // hoe lang het kost om iets te doen // hoe lang het kost om iets te doen

// ---------------------------------------------------------------- bewakers: positie en blikrichting zijn een vaste functie van de tijd
export function guardAt(g, t) {
  if (g.kind === 'camera') return { x: g.x0, ang: g.amp * Math.sin((2 * Math.PI * (t + g.phase)) / g.period) };
  if (g.kind === 'sleeper') { const cyc = g.sleep + g.awake; const u = (((t + g.phase) % cyc) + cyc) % cyc; return { x: g.x0, dir: g.dir, awake: u >= g.sleep, moving: false }; }
  const L = g.x1 - g.x0, mv = L / g.speed, cyc = 2 * (mv + g.pause);
  let u = (((t + g.phase) % cyc) + cyc) % cyc;
  if (u < mv) return { x: g.x0 + u * g.speed, dir: 1, moving: true };
  u -= mv; if (u < g.pause) return { x: g.x1, dir: -1, moving: false };
  u -= g.pause; if (u < mv) return { x: g.x1 - u * g.speed, dir: -1, moving: true };
  return { x: g.x0, dir: 1, moving: false };
}
// is de speler (px, py = voeten) te zien voor deze bewaker? 0 = niet, anders hoe dichtbij (0..1). blocked(f, xa, xb) = zit er een dichte deur tussen?
export function sees(g, s, px, py, hidden, blocked) {
  if (hidden || Math.abs(py - Y[g.f]) > 1.3) return 0;
  if (g.kind === 'camera') {
    const cx = s.x, cy = Y[g.f] - 3.5;
    const dx = px - cx, dy = (py - 0.8) - cy;
    const d = Math.hypot(dx, dy);
    if (d > g.range) return 0;
    const ang = Math.atan2(dx, dy);
    if (Math.abs(ang - s.ang) > g.half) return 0;
    return blocked(g.f, cx, px) ? 0 : 1 - (d / g.range) * 0.5;
  }
  if (g.kind === 'drone') return Math.abs(px - s.x) < 1.0 ? 1 : 0;
  if (g.kind === 'sleeper' && !s.awake) return 0;
  const dx = (px - s.x) * s.dir;
  if (dx < -0.15 || dx > g.range) return 0;
  return blocked(g.f, s.x, px) ? 0 : 1 - (dx / g.range) * 0.5;
}
export const laserOn = (l, t) => (((t + l.phase) % l.period) + l.period) % l.period < l.period * l.on;

// ---------------------------------------------------------------- het spel
export class Game {
  constructor(level) {
    this.L = level;
    this.t = 0;
    this.status = 'play'; // play | won | caught | timeup
    this.events = [];
    this.p = { x: level.start.x, y: Y[level.start.f], f: level.start.f, face: 1, mode: 'walk', vx: 0, work: 0, workItem: null, portal: null, climbTo: 0, hidden: false, walk: 0, pick: 0, pickWall: -1, swing: 0 };
    this.items = level.items.map((it) => ({ ...it, done: false }));
    this.keys = new Set();
    this.doorOpen = new Set();      // gebroken sloten (index van de muur)
    this.switchOn = false;
    this.meter = 0;
    this.stun = level.guards.map(() => 0);
    // elke robot: 'patrol' (vaste route), 'chase' (achtervolgt je met een knuppel), 'return' (loopt terug naar zijn route) of 'stunned'
    this.gs = level.guards.map(() => ({ mode: 'patrol', x: 0, dir: 1, moving: false, swing: 0, cool: 0, search: 0, last: 0 }));
    this.alarmT = 0; this.alarmFloor = -1; this.alarmCool = 0;
    this.hasCode = true;            // heeft Te-Un de kluiscode al? (de bank van het Kabouterdorp gaat er niet zonder open)
    this.seenBy = -1;
    this.exitOpen = false;
    this.parts = [];
  }
  blocked(f, xa, xb) {
    const lo = Math.min(xa, xb), hi = Math.max(xa, xb);
    return this.L.walls.some((w, i) => w.f === f && w.lock && !this.doorOpen.has(i) && w.x > lo && w.x < hi);
  }
  // waar een robot nu staat en kijkt: op zijn vaste route is dat een vaste functie van de tijd, anders staat hij in zijn eigen toestand
  guardState(i) {
    const g = this.L.guards[i], st = this.gs[i];
    if (!st || st.mode === 'patrol' || g.kind === 'camera' || g.kind === 'drone') return guardAt(g, this.t);
    return { x: st.x, dir: st.dir, moving: st.moving, awake: true, chase: st.mode === 'chase', swing: st.swing > 0 ? 1 - st.swing / BATON_T : 0 };
  }
  isRobot(i) { const k = this.L.guards[i].kind; return k !== 'camera' && k !== 'drone'; }
  startChase(i, loud = true) {
    const g = this.L.guards[i], st = this.gs[i], p = this.p;
    if (st.mode === 'chase' || this.stun[i] > 0) return;
    const s = this.guardState(i);
    st.mode = 'chase'; st.x = s.x; st.dir = s.dir || 1; st.last = p.x; st.search = 0; st.swing = 0; st.cool = 0;
    if (loud) this.events.push('spotted');
  }
  // alarm (camera, drone of laser): alle robots op de verdieping van Te-Un komen achter hem aan
  alarm() {
    if (this.alarmCool > 0) return;
    this.alarmT = ALARM_T; this.alarmFloor = this.p.f; this.alarmCool = 3; this.meter = 0;
    this.events.push('alarm');
    this.L.guards.forEach((g, i) => { if (this.isRobot(i) && g.f === this.p.f) this.startChase(i, false); });
  }
  updateGuards(dt) {
    const L = this.L, p = this.p;
    this.alarmT = Math.max(0, this.alarmT - dt); this.alarmCool = Math.max(0, this.alarmCool - dt);
    L.guards.forEach((g, i) => {
      if (!this.isRobot(i)) return;
      const st = this.gs[i];
      st.cool = Math.max(0, st.cool - dt);
      if (this.stun[i] > 0) { if (st.mode !== 'stunned') { const s = this.guardState(i); st.mode = 'stunned'; st.x = s.x; st.dir = s.dir || 1; st.swing = 0; } st.moving = false; return; }
      if (st.mode === 'stunned') st.mode = 'return';
      // zolang het alarm aan is, sluiten robots op die verdieping aan
      if (this.alarmT > 0 && g.f === this.alarmFloor && p.f === this.alarmFloor && (st.mode === 'patrol' || st.mode === 'return')) this.startChase(i, false);
      if (st.mode === 'patrol') return;
      const walk = (target, speed) => {
        const dx = target - st.x; let nx = st.x;
        if (Math.abs(dx) > 0.12) { nx = st.x + Math.sign(dx) * Math.min(Math.abs(dx), speed * dt); st.dir = Math.sign(dx); st.moving = true; } else st.moving = false;
        // een dichte deur houdt een robot tegen, de buitenmuur ook
        for (let k = 0; k < L.walls.length; k++) { const w = L.walls[k]; if (w.f !== g.f || !w.lock || this.doorOpen.has(k)) continue; if ((st.x - w.x) * (nx - w.x) < 0 || Math.abs(nx - w.x) < 0.45) nx = st.x < w.x ? Math.min(nx, w.x - 0.45) : Math.max(nx, w.x + 0.45); }
        st.x = Math.max(1.3, Math.min(W - 1.3, nx));
      };
      if (st.mode === 'return') {
        const home = guardAt(g, this.t).x;
        walk(home, 2.2);
        if (Math.abs(st.x - home) < 0.3) { st.mode = 'patrol'; st.moving = false; }
        return;
      }
      // achtervolgen
      const out = p.f !== g.f || p.mode === 'portal' || p.mode === 'climb';
      if (out) { st.mode = 'return'; st.swing = 0; return; }
      if (!p.hidden) { st.last = p.x; st.search = 0; } else if (Math.abs(st.x - st.last) < 0.4) st.search += dt;
      if (p.hidden && st.search > 2.5) { st.mode = 'return'; st.swing = 0; return; }
      const speed = CHASE[g.kind] || 2.8;
      if (st.swing > 0) {
        st.swing -= dt; st.moving = false;
        if (st.swing <= 0) { st.cool = 0.5; if (!p.hidden && Math.abs(p.x - st.x) < 1.35 && p.mode !== 'portal' && p.mode !== 'climb') this.caught('baton'); }
        return;
      }
      if (!p.hidden && st.cool <= 0 && Math.abs(p.x - st.x) < 1.25) { st.swing = BATON_T; st.dir = p.x >= st.x ? 1 : -1; st.moving = false; this.events.push('swing'); return; }
      walk(st.last, speed);
    });
  }
  remaining() { return this.items.filter((i) => i.req && !i.done).length; }
  timeLeft() { return Math.max(0, this.L.limit - this.t); }
  // één stap. inp: { l, r, u, d, act (alleen op het moment van indrukken), actHeld (ingedrukt gehouden: sloten openbreken) }
  step(dt, inp) {
    if (this.status !== 'play') return;
    this.t += dt;
    const L = this.L, p = this.p;
    if (this.t >= L.limit) { this.status = 'timeup'; this.events.push('timeup'); return; }
    this.stun = this.stun.map((s) => Math.max(0, s - dt));
    p.swing = Math.max(0, p.swing - dt);
    const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);

    if (p.mode === 'portal') { // trap of lift
      p.work -= dt;
      if (p.work <= 0) { p.mode = 'walk'; p.x = p.portal.x; p.f = p.portal.f; p.y = Y[p.f]; p.portal = null; this.events.push('arrive'); }
    } else if (p.mode === 'climb') {
      const tgt = Y[p.climbTo];
      p.y += Math.sign(tgt - p.y) * CLIMB * dt;
      if (Math.abs(tgt - p.y) < CLIMB * dt) { p.y = tgt; p.f = p.climbTo; p.mode = 'walk'; }
    } else if (p.mode === 'act') {
      p.work -= dt;
      if (p.work <= 0) this.finishWork();
    } else if (p.mode === 'pick') {
      const w = L.walls[p.pickWall];
      if (!inp.actHeld || dir || inp.u || inp.d || !w || this.doorOpen.has(p.pickWall)) { p.mode = 'walk'; p.pick = 0; }
      else {
        p.pick += dt;
        if (p.pick >= PICK_T) { this.doorOpen.add(p.pickWall); p.mode = 'walk'; p.pick = 0; this.events.push('unlock'); }
      }
    } else if (p.mode === 'hide') {
      if (dir || inp.u || inp.act) { p.mode = 'walk'; p.hidden = false; }
    } else {
      // lopen
      p.vx = dir * WALK;
      if (dir) p.face = dir;
      let nx = p.x + p.vx * dt;
      nx = Math.max(1 + HALF, Math.min(W - 1 - HALF, nx));
      // dichte deuren: met de goede sleutel gaan ze open, anders blijf je ervoor staan
      for (let i = 0; i < L.walls.length; i++) {
        const w = L.walls[i];
        if (w.f !== p.f || !w.lock || this.doorOpen.has(i)) continue;
        const gap = HALF + 0.05;
        if (Math.abs(nx - w.x) < gap + 0.15 || (p.x - w.x) * (nx - w.x) < 0) {
          nx = p.x < w.x ? Math.min(nx, w.x - gap) : Math.max(nx, w.x + gap);
        }
      }
      p.walk += Math.abs(nx - p.x);
      p.x = nx;
      // ladder, trap, lift: omhoog of omlaag
      if (inp.u || inp.d) {
        const up = !!inp.u;
        const lad = L.ladders.find((l) => Math.abs(l.x - p.x) < 0.45 && ((up && l.f === p.f) || (!up && l.f + 1 === p.f)));
        if (lad) { p.mode = 'climb'; p.x = lad.x; p.climbTo = up ? p.f + 1 : p.f - 1; p.hidden = false; }
        else {
          const st = L.stairs.find((s) => s.f === p.f && s.dir === (up ? 'up' : 'down') && Math.abs(s.x - p.x) < 0.55);
          if (st) { p.mode = 'portal'; p.work = PORTAL_T + (st.kind === 'lift' ? 0.5 : 0); p.portal = { x: st.to.x, f: st.to.f }; p.x = st.x; this.events.push('portal'); }
          else if (!up) {
            const h = L.hides.find((h) => h.f === p.f && Math.abs(h.x - p.x) < 0.6);
            const near = L.guards.some((g, i) => this.gs[i].mode === 'chase' && g.f === p.f && Math.abs(this.gs[i].x - p.x) < 2.5);
            if (h && near) this.events.push('nohide');
            else if (h) { p.mode = 'hide'; p.hidden = true; p.x = h.x; this.events.push('hide'); }
          }
        }
      }
      // voorwerpen en bewakers: de actietoets
      if (inp.act) this.doAct();
      // een slot openbreken: sta er vlak voor en houd spatie ingedrukt
      if (p.mode === 'walk' && inp.actHeld) {
        for (let i = 0; i < L.walls.length; i++) {
          const w = L.walls[i];
          if (w.f !== p.f || !w.lock || this.doorOpen.has(i) || Math.abs(p.x - w.x) > 0.75) continue;
          if (this.items.some((it) => !it.done && it.f === p.f && Math.abs(it.x - p.x) < 1.0)) break;
          p.mode = 'pick'; p.pickWall = i; p.pick = 0; p.x = w.x + (p.x < w.x ? -0.5 : 0.5); p.face = p.x < w.x ? 1 : -1; p.vx = 0; this.events.push('pick');
          break;
        }
      }
      // de uitgang
      const ex = L.exit;
      this.exitOpen = this.remaining() === 0;
      if (this.exitOpen && p.f === ex.f && Math.abs(p.x - ex.x) < 0.7 && p.mode === 'walk') { this.status = 'won'; this.events.push('win'); }
    }
    this.updateGuards(dt);
    this.detect(dt);
  }
  doAct() {
    const p = this.p;
    // eerst een voorwerp dat dichtbij ligt
    let best = null, bd = 1.0;
    for (const it of this.items) { if (it.done || it.f !== p.f || it.type === 'key') continue; const d = Math.abs(it.x - p.x); if (d < bd) { bd = d; best = it; } }
    if (best && best.type === 'vault' && this.L.theme.key === 'mushbank' && !this.hasCode) { this.events.push('nocode'); return; }
    if (best) { p.mode = 'act'; p.workItem = best; p.work = ACT[best.type] || 0.4; p.x = best.x; this.events.push('work'); return; }
    // anders een zwakke robot van achteren uitschakelen
    for (let i = 0; i < this.L.guards.length; i++) {
      const g = this.L.guards[i];
      if (g.f !== p.f || g.kind === 'camera' || g.kind === 'drone' || g.kind === 'heavy' || this.stun[i] > 0) continue;
      if (this.gs[i].mode === 'chase') continue;
      const s = this.guardState(i);
      if (Math.abs(s.x - p.x) < 1.1 && (p.x - s.x) * s.dir < 0.2 && !(g.kind === 'sleeper' && s.awake && (p.x - s.x) * s.dir > 0)) { this.stun[i] = STUN_T; p.swing = SWING_T; p.face = s.x >= p.x ? 1 : -1; this.events.push('stun'); return; }
    }
  }
  finishWork() {
    const p = this.p, it = p.workItem;
    p.mode = 'walk'; p.workItem = null;
    if (!it || it.done) return;
    it.done = true;
    if (it.type === 'switch') this.switchOn = true;
    this.events.push(it.type === 'hack' || it.type === 'vault' ? 'hacked' : it.type === 'switch' ? 'switch' : it.type === 'code' ? 'code' : 'grab');
  }
  detect(dt) {
    const L = this.L, p = this.p;
    // lasers: dat geeft alarm
    for (const l of L.lasers) {
      if (l.f !== p.f || Math.abs(l.x - p.x) > 0.35 + HALF * 0.5 || p.hidden || p.mode === 'portal') continue;
      if (l.needSwitch ? !this.switchOn : laserOn(l, this.t)) { this.alarm(); break; }
    }
    // bewakers: wie je ziet, heeft even nodig. Een robot gaat je dan achtervolgen, een camera of drone geeft alarm
    let worst = 0, by = -1;
    L.guards.forEach((g, i) => {
      if (this.stun[i] > 0 || this.gs[i].mode === 'chase') return;
      const s = this.guardState(i);
      const v = sees(g, s, p.x, p.y, p.hidden || p.mode === 'portal', (f, a, b) => this.blocked(f, a, b)); // in een trap of lift ben je niet te zien
      if (v > worst) { worst = v; by = i; }
    });
    this.seenBy = by;
    if (worst > 0) {
      this.meter += dt * (1.1 + 1.6 * worst);
      if (this.meter >= 1) { this.meter = 0; if (this.isRobot(by)) this.startChase(by); else this.alarm(); }
    } else this.meter = Math.max(0, this.meter - dt * 0.9);
  }
  caught(why) { this.status = 'caught'; this.why = why; this.events.push('caught'); }
}
