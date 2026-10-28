// Fysica van de auto's: een lichaam met twee wielen die als veren op het terrein duwen.
export const G = 12;
const K = 3600, C = 150;

export const CARS = {
  truck: { id: 'truck', name: 'Monstertruck', r: 0.75, wb: 2.3, wy: -0.55, F: 34, vmax: 12, mu: 1.1, brake: 14, I: 1.1, roof: [[-1.3, 0.55, 0.3], [1.3, 0.55, 0.3], [0, 0.9, 0.3]], len: 3.8, unlock: 1, desc: 'Grote wielen, klimt overal over. Mooi om mee te beginnen.' },
  bike: { id: 'bike', name: "Hermano's fiets", r: 0.5, wb: 1.7, wy: -0.35, F: 22, vmax: 14, mu: 1.0, brake: 12, I: 0.55, roof: [[-0.2, 1.0, 0.28], [0.5, 0.6, 0.25]], len: 2.2, unlock: 5, desc: 'Snel en wendbaar. De hele tijd in beeld: Hermano\'s!' },
  gold: { id: 'gold', name: 'Gouden regenboogauto', r: 0.55, wb: 2.5, wy: -0.4, F: 30, vmax: 15, mu: 1.05, brake: 15, I: 1.7, roof: [[-1.1, 0.5, 0.3], [1.1, 0.5, 0.3], [0, 0.75, 0.3]], len: 3.6, unlock: 15, desc: 'Glimmend en razendsnel, met een regenboogspoor.' },
  gnome: { id: 'gnome', name: 'Tuinkabouterauto', r: 0.7, wb: 2.4, wy: -0.5, F: 36, vmax: 13, mu: 1.2, brake: 16, I: 1.7, roof: [[-1.2, 0.6, 0.3], [1.2, 0.6, 0.3], [0, 1.7, 0.3]], len: 3.8, unlock: 20, desc: 'Een tuinkabouter op wielen. Zwaar en sterk.' },
};
export const CAR_ORDER = ['truck', 'bike', 'gold', 'gnome'];

export class Terrain {
  constructor(lines) {
    this.B = 4;
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

export function makeCar(id, x, y) {
  return { id, x, y, a: 0, vx: 0, vy: 0, w: 0, spin: [0, 0], ang: [0, 0], ground: [false, false], N: [0, 0], vt: [0, 0], crash: null, air: 0 };
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
    if (!q) { b.N[i] = 0; continue; }
    anyGround = true;
    const vpx = b.vx - b.w * ry, vpy = b.vy + b.w * rx;
    const vn = vpx * q.nx + vpy * q.ny;
    const Fn = Math.min(260, Math.max(0, K * q.pen - C * vn));
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
    Fx += tx * Ft; Fy += ty * Ft;
    ax += Fx; ay += Fy;
    aw += (rx * Fy - ry * Fx) / V.I;
    b.N[i] = Fn; b.vt[i] = vt;
  }
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
