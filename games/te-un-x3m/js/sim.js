// Fysica van de voertuigen: een lichaam met twee wielen die als veren op het terrein duwen.
export const G = 12;
const K = 3600, C = 150;

export const VEH = {
  fatbike: { id: 'fatbike', name: 'Fatbike', r: 0.46, wb: 1.56, wy: -0.33, F: 15, vmax: 11.5, mu: 1.15, brake: 9, lean: 12, leanAir: 16, rev: 3, I: 0.55, parMul: 1, price: 0, desc: 'Dikke banden, rustig tempo. Prima om te leren.' },
  motor: { id: 'motor', name: 'Motor', r: 0.4, wb: 1.62, wy: -0.3, F: 24, vmax: 17.5, mu: 1.05, brake: 12, lean: 13, leanAir: 18, rev: 3.5, I: 0.6, parMul: 0.62, price: 12, desc: 'Veel sneller en sterker. Perfect voor grote sprongen.' },
  vape: { id: 'vape', name: 'Gouden Vape', fly: true, r: 0.22, wb: 1.5, wy: -0.28, thrust: 13, vmax: 16, mu: 0.4, rev: 0.5, lean: 10, leanAir: 12, I: 0.55, parMul: 0.55, price: 36, desc: 'Vliegt! Gas = vooruit en omhoog, leun om te sturen.' },
};
export const VEH_ORDER = ['fatbike', 'motor', 'vape'];

const ROOF = [[-0.02, 1.0, 0.3], [0.6, 0.75, 0.22], [-0.62, 0.72, 0.22]];

export class Terrain {
  constructor(pts) {
    this.B = 4;
    this.cells = new Map();
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const dx = bx - ax, dy = by - ay, len = Math.hypot(dx, dy);
      if (len < 1e-6) continue;
      const s = { ax, ay, bx, by, dx, dy, len2: len * len, nx: -dy / len, ny: dx / len };
      const c0 = Math.floor(Math.min(ax, bx) / this.B), c1 = Math.floor(Math.max(ax, bx) / this.B);
      for (let c = c0; c <= c1; c++) { if (!this.cells.has(c)) this.cells.set(c, []); this.cells.get(c).push(s); }
    }
  }
  query(px, py, r) {
    let best = null;
    const c0 = Math.floor((px - r) / this.B), c1 = Math.floor((px + r) / this.B);
    for (let c = c0; c <= c1; c++) {
      const list = this.cells.get(c);
      if (!list) continue;
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
        if (!best || pen > best.pen) best = { pen, nx, ny };
      }
    }
    return best;
  }
}

export function makeBike(vid, x, y) {
  return { vid, x, y, a: 0, vx: 0, vy: 0, w: 0, spin: [0, 0], ground: [false, false], N: [0, 0], vt: [0, 0], crash: null, crank: 0, thrusting: 0, air: 0 };
}

const xf = (b, lx, ly) => {
  const c = Math.cos(b.a), s = Math.sin(b.a);
  return [b.x + c * lx - s * ly, b.y + s * lx + c * ly];
};
export const headPos = (b) => xf(b, -0.02, 1.0);

export function stepBike(b, terr, inp, dt, ceilT) {
  const V = VEH[b.vid];
  const c = Math.cos(b.a), s = Math.sin(b.a);
  const live = !b.crash;
  const gas = live && inp.gas, brake = live && inp.brake;
  const lean = live ? (inp.left ? 1 : 0) - (inp.right ? 1 : 0) : 0;
  let ax = 0, ay = V.fly ? -G * 0.55 : -G, aw = 0;
  let anyGround = false;
  const offs = [[-V.wb / 2, V.wy], [V.wb / 2, V.wy]];
  for (let i = 0; i < 2; i++) {
    const [lx, ly] = offs[i];
    const rx = c * lx - s * ly, ry = s * lx + c * ly;
    const px = b.x + rx, py = b.y + ry;
    const q = terr.query(px, py, V.r);
    b.ground[i] = !!q;
    if (!q) { b.N[i] = 0; continue; }
    anyGround = true;
    const vpx = b.vx - b.w * ry, vpy = b.vy + b.w * rx;
    const vn = vpx * q.nx + vpy * q.ny;
    const Fn = Math.min(260, Math.max(0, K * q.pen - C * vn));
    let Fx = q.nx * Fn, Fy = q.ny * Fn;
    const tx = q.ny, ty = -q.nx;
    const vt = vpx * tx + vpy * ty;
    let Ft = 0;
    if (!V.fly) {
      if (gas && i === 0) Ft += Math.min(V.F * Math.max(0, 1 - (vt / V.vmax) * (vt / V.vmax)), V.mu * Fn + 8);
      if (brake) {
        if (vt > 0.4) Ft -= Math.min(V.brake * (i === 0 ? 1 : 0.6), V.mu * Fn + 1);
        else if (i === 0) Ft -= V.rev * Math.max(0, 1 + vt / 3.5);
      }
      Ft -= vt * (gas ? 0.05 : 0.3);
    } else Ft -= vt * 1.8;
    Fx += tx * Ft; Fy += ty * Ft;
    ax += Fx; ay += Fy;
    aw += (rx * Fy - ry * Fx) / V.I;
    b.N[i] = Fn; b.vt[i] = vt;
  }
  // het plafond is een massieve muur: ons dak botst ertegenaan
  if (ceilT) {
    for (const [lx, ly, rr] of ROOF) {
      const rx = c * lx - s * ly, ry = s * lx + c * ly;
      const q = ceilT.query(b.x + rx, b.y + ry, rr);
      if (!q) continue;
      const vpx = b.vx - b.w * ry, vpy = b.vy + b.w * rx;
      const vn = vpx * q.nx + vpy * q.ny;
      const Fn = Math.min(260, Math.max(0, K * q.pen - C * vn));
      const tx = q.ny, ty = -q.nx, vt = vpx * tx + vpy * ty;
      const Fx = q.nx * Fn + tx * -vt * 2, Fy = q.ny * Fn + ty * -vt * 2;
      ax += Fx; ay += Fy;
      aw += (rx * Fy - ry * Fx) / V.I;
    }
  }
  if (V.fly && gas) {
    ax += c * V.thrust; ay += s * V.thrust + G * 0.5;
    b.thrusting = 1;
  } else if (V.fly && brake) { ax -= c * V.thrust * V.rev; b.thrusting = 0; } else b.thrusting = 0;
  if (V.fly) { ax -= b.vx * 0.8; ay -= b.vy * 0.8; }
  else if (!anyGround) { ax -= b.vx * 0.02; }
  aw += lean * (anyGround ? V.lean : V.leanAir);
  aw -= b.w * (lean ? 0.5 : anyGround ? 1.2 : 0.35);
  b.vx += ax * dt; b.vy += ay * dt; b.w += aw * dt;
  if (b.w > 7) b.w = 7; else if (b.w < -7) b.w = -7;
  b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.w * dt;
  b.air = anyGround ? 0 : b.air + dt;
  // wieltjes draaien mee
  for (let i = 0; i < 2; i++) {
    if (b.ground[i]) b.spin[i] = b.vt[i] / V.r;
    else b.spin[i] += ((i === 0 && gas ? 26 : 0) - b.spin[i]) * Math.min(1, dt * (brake ? 12 : 1.5));
  }
}

// ---- gevaren
const circleRect = (cx, cy, r, x0, y0, x1, y1) => {
  const px = Math.max(x0, Math.min(cx, x1)), py = Math.max(y0, Math.min(cy, y1));
  return (cx - px) * (cx - px) + (cy - py) * (cy - py) < r * r;
};
export function sawPos(h, t) {
  if (h.ay === undefined) return [h.x, h.y];
  const f = (Math.sin(((t + h.phase) / h.period) * Math.PI * 2) + 1) / 2;
  return [h.x, h.ay + (h.by - h.ay) * f];
}
export const fireOn = (h, t) => ((t + h.phase) % h.period) < h.on;
export function hazardHit(level, cx, cy, r, t) {
  for (const h of level.hz) {
    if (h.type === 'pit') { if (circleRect(cx, cy, r, h.x0, h.y, h.x1, h.y + h.h)) return 'lava'; }
    else if (h.type === 'spikes') { if (circleRect(cx, cy, r, h.x0, h.y, h.x1, h.y + h.h)) return 'spikes'; }
    else if (h.type === 'fire') { if (fireOn(h, t) && circleRect(cx, cy, r, h.x0, h.y, h.x1, h.y + h.h)) return 'fire'; }
    else if (h.type === 'saw') {
      const [sx, sy] = sawPos(h, t);
      if (Math.hypot(cx - sx, cy - sy) < r + h.r * 0.88) return 'saw';
    }
  }
  return null;
}

// Geeft de reden van een crash terug of null.
export function crashTest(b, terr, level, t) {
  const V = VEH[b.vid];
  const [hx, hy] = headPos(b);
  const q = terr.query(hx, hy, 0.3);
  if (q && q.pen > 0.04) return 'head';
  const [bx, by] = xf(b, -0.5, 0.55);
  const q2 = terr.query(bx, by, 0.2);
  if (q2 && q2.pen > 0.05) return 'back';
  const circles = [[hx, hy, 0.3], [...xf(b, 0, 0.1), 0.45]];
  for (const lx of [-V.wb / 2, V.wb / 2]) circles.push([...xf(b, lx, V.wy), V.r * 0.85]);
  for (const [cx, cy, r] of circles) {
    const hit = hazardHit(level, cx, cy, r, t);
    if (hit) return hit;
  }
  if (b.y < level.minY - 12) return 'fall';
  return null;
}
