// Fysica van de auto's: een lichaam met twee wielen die als veren op het terrein duwen.
export const G = 12;
const K = 3600, C = 150;

export const CARS = {
  // fiets: geen vering, wendbaar maar gevoelig voor bulten
  bike: { id: 'bike', name: "Hermano's fiets", r: 0.5, wb: 1.7, wy: -0.35, F: 22, vmax: 14, mu: 1.0, brake: 12, I: 0.55, K: 3600, C: 150, T: 0, stab: 0, wheelie: 0.35, roof: [[-0.2, 1.0, 0.28], [0.5, 0.6, 0.25]], len: 2.2, unlock: 1, desc: "Geen vering en moeilijk over heuveltjes, maar snel. De hele tijd in beeld: Hermano's!" },
  // monstertruck: fel geel, goede vering, flink gewicht
  truck: { id: 'truck', name: 'Monstertruck', r: 0.85, wb: 2.5, wy: -0.7, F: 34, vmax: 12, mu: 1.1, brake: 14, I: 2.6, K: 40, C: 8, T: 0.6, stab: 8, wheelie: 1.6, roof: [[-1.3, 0.95, 0.3], [1.3, 0.95, 0.3], [0, 1.35, 0.3]], len: 3.8, unlock: 5, desc: 'Fel geel, grote wielen en goede vering. Vangt vallen op en rijdt over kleine obstakels.' },
  // goud: zelfde model, veel meer acceleratie
  gold: { id: 'gold', name: 'Gouden monstertruck', r: 0.85, wb: 2.5, wy: -0.7, F: 54, vmax: 16, mu: 1.1, brake: 16, I: 3.4, K: 40, C: 8, T: 0.6, stab: 12, wheelie: 1.2, roof: [[-1.3, 0.95, 0.3], [1.3, 0.95, 0.3], [0, 1.35, 0.3]], len: 3.8, unlock: 15, desc: 'Dezelfde truck, maar van goud en met een enorme acceleratie.' },
  // kabouter: net zo snel als de truck, valt bijna niet om, Rolls-Royce-vering
  gnome: { id: 'gnome', name: 'Tuinkabouterauto', r: 0.85, wb: 2.5, wy: -0.7, F: 36, vmax: 12, mu: 1.25, brake: 16, I: 5.5, K: 24, C: 11, T: 0.85, stab: 30, roof: [[-1.2, 0.95, 0.3], [1.2, 0.95, 0.3], [0, 2.0, 0.3]], len: 3.8, unlock: 20, desc: 'Zweeft als een Rolls-Royce over alles heen en valt bijna niet om.' },
};
export const CAR_ORDER = ['bike', 'truck', 'gold', 'gnome'];

export class Terrain {
  constructor(lines) {
    this.B = 4;
    this.dyn = [];
    this.cells = new Map();
    for (const pts of lines) {
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
        const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        const s = { ax, ay, bx, by, dx, dy, len2: len * len, nx: -dy / len, ny: dx / len };
        const c0 = Math.floor(Math.min(ax, bx) / this.B), c1 = Math.floor(Math.max(ax, bx) / this.B);
        for (let c = c0; c <= c1; c++) { if (!this.cells.has(c)) this.cells.set(c, []); this.cells.get(c).push(s); }
      }
    }
  }
  // bewegende platforms: elk [{x0,y0,x1,y1,vx,vy}] (alleen de bovenkant telt)
  setDyn(list) {
    this.dyn = list.map(({ x0, y0, x1, y1, vx, vy }) => {
      const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1e-6;
      return { ax: x0, ay: y0, bx: x1, by: y1, dx, dy, len2: len * len, nx: -dy / len, ny: dx / len, gvx: vx || 0, gvy: vy || 0 };
    });
  }
  query(px, py, r) {
    let best = null;
    const c0 = Math.floor((px - r) / this.B), c1 = Math.floor((px + r) / this.B);
    const scan = (list) => {
      for (const s of list) {
        const t = ((px - s.ax) * s.dx + (py - s.ay) * s.dy) / s.len2;
        let pen, nx, ny;
        if (t >= 0 && t <= 1) {
          const sd = (px - s.ax) * s.nx + (py - s.ay) * s.ny;
          if (sd >= r || sd <= -r * 1.2) continue;
          pen = r - sd; nx = s.nx; ny = s.ny;
        } else {
          const tc = t < 0 ? 0 : 1;
          const qx = s.ax + s.dx * tc, qy = s.ay + s.dy * tc;
          const ddx = px - qx, ddy = py - qy, dd = Math.hypot(ddx, ddy);
          if (dd >= r || dd < 1e-6) continue;
          pen = r - dd; nx = ddx / dd; ny = ddy / dd;
        }
        if (!best || pen > best.pen) best = { pen, nx, ny, gvx: s.gvx || 0, gvy: s.gvy || 0 };
      }
    };
    for (let c = c0; c <= c1; c++) { const list = this.cells.get(c); if (list) scan(list); }
    if (this.dyn.length) scan(this.dyn);
    return best;
  }
}

export function makeCar(id, x, y) {
  return { id, x, y, a: 0, vx: 0, vy: 0, w: 0, spin: [0, 0], ang: [0, 0], ground: [false, false], N: [0, 0], vt: [0, 0], comp: [0, 0], crash: null, air: 0, revT: 0, revV: 0 };
}
export const xf = (b, lx, ly) => {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  return [b.x + c * lx - s * ly, b.y + s * lx + c * ly];
};

// gas: rechts / omhoog, rem en achteruit: links / omlaag
export function stepCar(b, terr, inp, dt) {
  const V = CARS[b.id];
  const c = Math.cos(b.a), s = Math.sin(b.a);
  const live = !b.crash;
  const gas = live && inp.gas, brake = live && inp.brake;
  let ax = 0, ay = -G, aw = 0;
  let anyGround = false;
  const offs = [[-V.wb / 2, V.wy], [V.wb / 2, V.wy]];
  for (let i = 0; i < 2; i++) {
    const [lx, ly] = offs[i];
    const rx = c * lx - s * ly, ry = s * lx + c * ly;
    const q = terr.query(b.x + rx, b.y + ry, V.r);
    b.ground[i] = !!q;
    if (!q) { b.N[i] = 0; b.comp[i] += (0 - b.comp[i]) * Math.min(1, dt * 12); continue; }
    anyGround = true;
    const vpx = b.vx - b.w * ry - q.gvx, vpy = b.vy + b.w * rx - q.gvy;
    const vn = vpx * q.nx + vpy * q.ny;
    // vering: zacht veren binnen de veerweg T, daarna een harde aanslag
    const T = V.T || 0;
    const spring = q.pen <= T ? V.K * q.pen : V.K * T + (V.T ? 1400 : 3600) * Math.min(q.pen - T, 0.25);
    const Fn = Math.min(260, Math.max(0, spring - V.C * vn));
    b.comp[i] += (Math.min(q.pen, T + 0.15) - b.comp[i]) * Math.min(1, dt * 30);
    let Fx = q.nx * Fn, Fy = q.ny * Fn;
    const tx = q.ny, ty = -q.nx;
    const vt = vpx * tx + vpy * ty;
    let Ft = 0;
    if (gas && i === 0) Ft += Math.min(V.F * Math.max(0, 1 - (vt / V.vmax) * (vt / V.vmax)), V.mu * Fn + 8);
    if (gas && i === 1) Ft += Math.min(V.F * 0.35 * Math.max(0, 1 - (vt / V.vmax) * (vt / V.vmax)), V.mu * Fn);
    if (brake) {
      if (vt > 0.4) Ft -= Math.min(V.brake * (i === 0 ? 1 : 0.7), V.mu * Fn + 1);
      else Ft -= Math.min(V.F * 0.45 * Math.max(0, 1 + vt / 4), V.mu * Fn + 3) * (i === 0 ? 1 : 0.35);
    }
    Ft -= vt * (gas ? 0.05 : 0.3);
    // stilstaand zonder gas of rem: de auto blijft staan (en wordt meegenomen door een bewegend platform)
    if (!gas && !brake && Math.abs(vt) < 1.5) Ft -= vt * 3;
    Fx += tx * Ft; Fy += ty * Ft;
    ax += Fx; ay += Fy;
    aw += (rx * Fy - ry * Fx) / V.I;
    b.N[i] = Fn; b.vt[i] = vt;
  }
  // wheelie (zoals in Drive Mad): eerst achteruit rijden en dan gas geven tilt de voorkant op, zodat je over een obstakel komt
  if (V.wheelie) {
    if (b.vt[0] < -1 && (b.ground[0] || b.ground[1])) { b.revT = 1.0; b.revV = Math.max(b.revV, Math.min(4, -b.vt[0])); }
    else if (b.revT > 0) b.revT -= dt;
    else b.revV = 0;
    if (gas && b.ground[0] && b.vt[0] > -1) {
      const k = b.revT > 0 ? 4 + 2.5 * b.revV : 0.6;
      // naar een wheelie-hoek van ongeveer 0,5 rad sturen, met demping zodat hij niet doorslaat
      aw += V.wheelie * k * Math.max(-1, 1 - b.a / 0.5) - (b.revT > 0 ? b.w * 2.5 : 0);
    }
  }
  // zwaar voertuig met laag zwaartepunt: komt terug rechtop
  if (anyGround && V.stab) { const over = Math.max(0, Math.abs(b.a) - 0.45); aw -= V.stab * Math.sign(b.a) * Math.sin(over); }
  // in de lucht: gas laat de neus omhoog komen, remmen duwt hem omlaag (reactie van de wielen)
  if (!anyGround) {
    aw += ((gas ? 1 : 0) - (brake ? 1 : 0)) * 7;
    ax -= b.vx * 0.02;
  }
  aw -= b.w * (anyGround ? 1.3 : 0.4);
  b.vx += ax * dt; b.vy += ay * dt; b.w += aw * dt;
  if (b.w > 7) b.w = 7; else if (b.w < -7) b.w = -7;
  b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
  b.air = anyGround ? 0 : b.air + dt;
  for (let i = 0; i < 2; i++) {
    if (b.ground[i]) b.spin[i] = b.vt[i] / V.r;
    else b.spin[i] += ((i === 0 && gas ? 22 : 0) - b.spin[i]) * Math.min(1, dt * (brake ? 10 : 1.5));
    b.ang[i] += b.spin[i] * dt;
  }
}

const circleRect = (cx, cy, r, x0, y0, x1, y1) => {
  const px = Math.max(x0, Math.min(cx, x1)), py = Math.max(y0, Math.min(cy, y1));
  return (cx - px) * (cx - px) + (cy - py) * (cy - py) < r * r;
};

// reden van een crash of null
export function crashTest(b, terr, level) {
  const V = CARS[b.id];
  for (const [lx, ly, rr] of V.roof) {
    const [px, py] = xf(b, lx, ly);
    const q = terr.query(px, py, rr);
    if (q && q.pen > 0.06) return 'dak';
  }
  const circles = [[...xf(b, 0, 0.1), 0.6]];
  for (const lx of [-V.wb / 2, V.wb / 2]) circles.push([...xf(b, lx, V.wy), V.r * 0.85]);
  for (const [cx, cy, r] of circles) {
    for (const h of level.hz) {
      if (h.type === 'spikes' && circleRect(cx, cy, r, h.x0, h.y, h.x1, h.y + h.h)) return 'spijkers';
      if (h.type === 'water' && cy - r < h.y + 4.5 && cx > h.x0 && cx < h.x1) return 'water';
    }
  }
  if (b.y < level.minY - 14) return 'water';
  return null;
}

// ---- bewegende delen: veerboot (automatisch) en een brug die met een knop uitschuift
const smooth = (u) => u * u * (3 - 2 * u);
function ferryU(m, t) {
  const ph = (t + m.phase) % 14;
  if (ph < 3) return 0;
  if (ph < 7) return smooth((ph - 3) / 4);
  if (ph < 10) return 1;
  return 1 - smooth((ph - 10) / 4);
}
export function ferryPos(m, t) {
  const W = m.x1 - m.x0;
  const xl = m.x0 + (W - m.len) * ferryU(m, t);
  return xl;
}
export function bridgeProg(m, t, latched) {
  const lt = latched && latched[m.id];
  if (lt === undefined || lt === null) return 0;
  return Math.min(1, Math.max(0, (t - lt) / 2.5));
}
// platforms op dit moment, voor de botsingen
export function moverSegs(level, t, latched) {
  const out = [];
  for (const m of level.movers || []) {
    if (m.kind === 'ferry') {
      const xl = ferryPos(m, t), xl2 = ferryPos(m, t + 0.02);
      out.push({ x0: xl, y0: m.y, x1: xl + m.len, y1: m.y, vx: (xl2 - xl) / 0.02, vy: 0 });
    } else if (m.kind === 'bridgebtn') {
      const p = bridgeProg(m, t, latched), p2 = bridgeProg(m, t + 0.02, latched);
      if (p > 0.02) out.push({ x0: m.x0 - 1.5, y0: m.y, x1: m.x0 - 1.5 + (m.x1 - m.x0 + 3) * p, y1: m.y, vx: ((m.x1 - m.x0 + 3) * (p2 - p)) / 0.02, vy: 0 });
    }
  }
  return out;
}
// staat de auto op een knop? Dan gaat het bijbehorende onderdeel aan.
export function updateLatch(level, car, t, latched) {
  for (const m of level.movers || []) {
    if (m.kind !== 'bridgebtn' || latched[m.id] !== undefined) continue;
    const onGround = car.ground[0] || car.ground[1];
    if (onGround && car.x > m.bx0 && car.x < m.bx1) { latched[m.id] = t; return m.id; }
  }
  return null;
}
