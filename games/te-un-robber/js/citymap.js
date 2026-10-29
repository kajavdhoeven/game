// Te-Un the Robber - stadskaart (citymap.js): per hoofdstuk een kaart van bovenaf met 5 gebouwen om te kiezen.
// Alles procedureel op canvas. Zware lagen (terrein, gebouwen) worden 1 keer gecachet; per frame alleen bewegende dingen.
import { drawTeUn } from './chars.js';
import { CHAPTERS, LEVELS } from './story.js';

const W = 1280, H = 720, TAU = Math.PI * 2, FONT = 'Fredoka, sans-serif';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
function RNG(seed) { let s = seed >>> 0; return () => { s += 0x6D2B79F5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------------------------------------------------------------- kleur
const h2r = (c) => { if (c.length === 4) c = '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]; return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; };
const r2h = (r) => '#' + r.map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = h2r(a), B = h2r(b); return r2h(A.map((v, i) => v + (B[i] - v) * t)); };
const lite = (c, t) => mix(c, '#ffffff', t);
const dark = (c, t) => mix(c, '#000000', t);
const rgba = (c, a) => { const r = h2r(c); return `rgba(${r[0]},${r[1]},${r[2]},${a})`; };
const LG = (g, x0, y0, x1, y1, cols) => { const gr = g.createLinearGradient(x0, y0, x1, y1); cols.forEach((c, i) => gr.addColorStop(cols.length === 1 ? 0 : i / (cols.length - 1), c)); return gr; };
const RG = (g, x, y, r0, r1, cols, cx = x, cy = y) => { const gr = g.createRadialGradient(cx, cy, r0, x, y, r1); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); return gr; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const ell = (g, x, y, rx, ry, fill) => { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); if (fill) { g.fillStyle = fill; g.fill(); } };
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

// zachte schaduw-vlek op de grond (schuin van links boven: valt naar rechtsonder)
function softShadow(g, x, y, rx, ry, a = 0.3) { g.save(); g.translate(x, y); g.scale(1, ry / rx); g.fillStyle = RG(g, 0, 0, 0, rx, [`rgba(0,0,0,${a})`, `rgba(0,0,0,${a * 0.7})`, 'rgba(0,0,0,0)']); g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); }
function glowBlob(g, x, y, r, color, a) { g.fillStyle = RG(g, x, y, 0, r, [rgba(color, a), rgba(color, a * 0.4), rgba(color, 0)]); g.fillRect(x - r, y - r, r * 2, r * 2); }
// scherpe schaduw van een volume: omhullende van voetafdruk en verplaatste voetafdruk
function hullShadow(g, pts, h, a = 0.3, blur = 6) {
  const all = []; const ox = h * 0.55, oy = h * 0.14;
  for (const p of pts) { all.push(p); all.push([p[0] + ox, p[1] + oy]); }
  all.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cr = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const lo = []; for (const p of all) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  const up = []; for (let i = all.length - 1; i >= 0; i--) { const p = all[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const hull = lo.slice(0, -1).concat(up.slice(0, -1));
  g.save(); g.shadowColor = `rgba(0,0,0,${a})`; g.shadowBlur = blur; g.shadowOffsetX = 4000; g.beginPath();
  hull.forEach((p, i) => (i ? g.lineTo(p[0] - 4000, p[1]) : g.moveTo(p[0] - 4000, p[1]))); g.closePath(); g.fillStyle = '#000'; g.fill(); g.restore();
}

// ---------------------------------------------------------------- schuine 3D (oblique): x rechts, y omhoog, z de diepte in (schuin rechts omhoog)
const DX = 0.6, DY = 0.42;
const sx = (x, z) => x + z * DX, sy = (y, z) => -y - z * DY;
function path3(g, pts) { g.beginPath(); pts.forEach((p, i) => { const x = p[0] + p[2] * DX, y = -p[1] - p[2] * DY; if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.closePath(); }
function poly3(g, pts, fill, stroke, lw = 1) { path3(g, pts); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } }
function box3(g, x0, x1, y0, y1, z0, z1, f, o = {}) {
  const s = o.s || dark(f, 0.34), t = o.t || lite(f, 0.3);
  poly3(g, [[x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0]], LG(g, sx(x1, z0), sy(y1, z0), sx(x1, z1), sy(y0, z0), [s, dark(s, 0.25)]), 'rgba(0,0,0,.22)');
  poly3(g, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], t, 'rgba(0,0,0,.18)');
  poly3(g, [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0]], o.ff || LG(g, 0, sy(y1, z0), 0, sy(y0, z0), [lite(f, 0.1), dark(f, 0.12)]), 'rgba(0,0,0,.26)');
  if (o.ao !== false) { g.fillStyle = LG(g, 0, sy(y0, z0), 0, sy(y0, z0) - 16, ['rgba(0,0,0,.3)', 'rgba(0,0,0,0)']); g.fillRect(x0, sy(y0, z0) - 16, x1 - x0, 16); }
}
function brick(g, x0, x1, y0, y1, base, R, bw = 16, bh = 8) {
  g.save(); g.beginPath(); g.rect(x0, -y1, x1 - x0, y1 - y0); g.clip();
  for (let r = 0, yy = -y1; yy < -y0; yy += bh, r++) for (let xx = x0 - (r % 2) * bw / 2; xx < x1; xx += bw) {
    const v = R(); g.fillStyle = v < 0.5 ? `rgba(255,255,255,${(0.05 + v * 0.1).toFixed(3)})` : `rgba(0,0,0,${(0.04 + (v - 0.5) * 0.14).toFixed(3)})`; g.fillRect(xx + 1, yy + 1, bw - 2, bh - 2);
  }
  g.strokeStyle = rgba(dark(base, 0.4), 0.35); g.lineWidth = 1; g.beginPath();
  for (let yy = -y1; yy < -y0; yy += bh) { g.moveTo(x0, yy); g.lineTo(x1, yy); }
  g.stroke(); g.restore();
}
function tiles(g, A, B, C, D, col, rows = 7, dens = 9) { // dak-vlak met pannen: A,B onderrand (links, rechts), C,D bovenrand (rechts, links)
  g.save(); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.lineTo(D[0], D[1]); g.closePath(); g.clip();
  g.strokeStyle = rgba(dark(col, 0.45), 0.5); g.lineWidth = 1.1;
  for (let k = 0; k <= rows; k++) {
    const t = k / rows, ax = lerp(A[0], D[0], t), ay = lerp(A[1], D[1], t), bx = lerp(B[0], C[0], t), by = lerp(B[1], C[1], t);
    g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
    if (k < rows) { const t2 = (k + 1) / rows, cx = lerp(A[0], D[0], t2), cy = lerp(A[1], D[1], t2), dx = lerp(B[0], C[0], t2), dy = lerp(B[1], C[1], t2); const n = Math.max(3, Math.floor(Math.hypot(bx - ax, by - ay) / dens)); g.beginPath(); for (let i = 0; i <= n; i++) { const u = (i + (k % 2) * 0.5) / n; if (u > 1) continue; g.moveTo(lerp(ax, bx, u), lerp(ay, by, u)); g.lineTo(lerp(cx, dx, u), lerp(cy, dy, u)); } g.stroke(); }
  }
  g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(); g.restore();
}
// dak met nok langs x (voorvlak zichtbaar) en de gevel rechts
function roofX(g, x0, x1, y1, z0, z1, rh, col, o = {}) {
  const ov = o.ov ?? 7, zm = (z0 + z1) / 2, wall = o.wall || '#d8c8a8';
  poly3(g, [[x1, y1, z0], [x1, y1, z1], [x1, y1 + rh, zm]], dark(wall, 0.35), 'rgba(0,0,0,.25)');
  const A = [sx(x0 - ov, z0 - ov), sy(y1 - ov * 0.35, z0 - ov)], B = [sx(x1 + ov, z0 - ov), sy(y1 - ov * 0.35, z0 - ov)], C = [sx(x1 + ov, zm), sy(y1 + rh, zm)], D = [sx(x0 - ov, zm), sy(y1 + rh, zm)];
  g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.fillStyle = LG(g, 0, A[1], 0, D[1], [lite(col, 0.04), lite(col, 0.22)]); g.fill();
  tiles(g, A, B, C, D, col, o.rows ?? 6, o.dens ?? 10);
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(D[0], D[1]); g.lineTo(C[0], C[1]); g.stroke();
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(B[0], B[1] + 5); g.lineTo(A[0], A[1] + 5); g.closePath(); g.fill();
}
// dak met nok langs z (gevel naar voren, rechter dakvlak zichtbaar)
function roofZ(g, x0, x1, y1, z0, z1, rh, col, wallCol, o = {}) {
  const ov = o.ov ?? 5, xm = (x0 + x1) / 2;
  poly3(g, [[x0, y1, z0], [x1, y1, z0], [xm, y1 + rh, z0]], LG(g, 0, sy(y1 + rh, z0), 0, sy(y1, z0), [lite(wallCol, 0.1), dark(wallCol, 0.1)]), 'rgba(0,0,0,.28)');
  const A = [sx(x1 + ov, z0 - ov), sy(y1 - ov * 0.4, z0 - ov)], B = [sx(x1 + ov, z1 + ov), sy(y1 - ov * 0.4, z1 + ov)], C = [sx(xm, z1 + ov), sy(y1 + rh, z1 + ov)], D = [sx(xm, z0 - ov), sy(y1 + rh, z0 - ov)];
  g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.fillStyle = LG(g, A[0], 0, D[0], 0, [dark(col, 0.28), dark(col, 0.1)]); g.fill();
  // pannen: rijen evenwijdig aan de nok (tegen de helling in)
  g.save(); g.clip(); g.strokeStyle = rgba(dark(col, 0.55), 0.55); g.lineWidth = 1.1;
  const rows = o.rows ?? 6; for (let k = 1; k < rows; k++) { const t = k / rows; g.beginPath(); g.moveTo(lerp(A[0], D[0], t), lerp(A[1], D[1], t)); g.lineTo(lerp(B[0], C[0], t), lerp(B[1], C[1], t)); g.stroke(); }
  const n = 10; g.beginPath(); for (let i = 1; i < n; i++) { const u = i / n; g.moveTo(lerp(A[0], B[0], u), lerp(A[1], B[1], u)); g.lineTo(lerp(D[0], C[0], u), lerp(D[1], C[1], u)); } g.stroke(); g.restore();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.lineTo(...C); g.lineTo(...D); g.closePath(); g.stroke();
  g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(...D); g.lineTo(...C); g.stroke();
}

// ---------------------------------------------------------------- gevel-onderdelen (op het voorvlak z=0, y = schermcoordinaat van de bovenkant)
function win(g, x, y, w, h, o = {}) {
  const lit = o.lit ?? 0, fr = o.frame || '#f2ece0', arch = o.arch;
  g.save();
  if (o.shut) { g.fillStyle = o.shut; g.fillRect(x - w * 0.34, y, w * 0.3, h); g.fillRect(x + w * 1.04, y, w * 0.3, h); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; for (let i = 1; i < 5; i++) { const yy = y + h * i / 5; g.beginPath(); g.moveTo(x - w * 0.34, yy); g.lineTo(x - w * 0.04, yy); g.moveTo(x + w * 1.04, yy); g.lineTo(x + w * 1.34, yy); g.stroke(); } }
  g.fillStyle = fr; g.beginPath(); if (arch) { g.moveTo(x - 2.5, y + h + 2.5); g.lineTo(x - 2.5, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 + 2.5, Math.PI, 0); g.lineTo(x + w + 2.5, y + h + 2.5); } else g.rect(x - 2.5, y - 2.5, w + 5, h + 5); g.fill();
  g.beginPath(); if (arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); } else g.rect(x, y, w, h); g.closePath();
  const day = LG(g, x, y, x + w, y + h, ['#9fc4e0', '#4c78a0', '#2a4666']); const warm = LG(g, x, y, x, y + h, ['#ffe9a0', '#ffc860', '#ff9a40']);
  g.fillStyle = day; g.fill(); if (lit > 0) { g.globalAlpha = lit; g.fillStyle = warm; g.fill(); g.globalAlpha = 1; }
  g.save(); g.clip(); g.fillStyle = 'rgba(255,255,255,.22)'; g.beginPath(); g.moveTo(x, y + h * 0.5); g.lineTo(x + w * 0.55, y); g.lineTo(x + w * 0.8, y); g.lineTo(x, y + h * 0.8); g.fill(); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y, w, Math.max(3, h * 0.12)); g.restore();
  g.strokeStyle = fr; g.lineWidth = o.thin ? 1.2 : 2; g.beginPath(); if (o.cols !== 1) { g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); } if (o.rowsN !== 0) { g.moveTo(x, y + h * 0.45); g.lineTo(x + w, y + h * 0.45); } g.stroke();
  g.fillStyle = lite(fr, 0.2); g.fillRect(x - 4, y + h + 2, w + 8, 4); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 4, y + h + 6, w + 8, 2);
  g.restore();
}
function door(g, x, y, w, h, col, o = {}) { // y = bovenkant; deur staat op y+h
  g.save(); g.fillStyle = o.frame || '#f0e8d8'; g.beginPath(); if (o.arch) { g.moveTo(x - 3, y + h); g.lineTo(x - 3, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2 + 3, Math.PI, 0); g.lineTo(x + w + 3, y + h); } else g.rect(x - 3, y - 3, w + 6, h + 3); g.fill();
  g.beginPath(); if (o.arch) { g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); } else g.rect(x, y, w, h); g.closePath();
  g.fillStyle = LG(g, x, y, x + w, y + h, [lite(col, 0.15), dark(col, 0.25)]); g.fill(); g.clip();
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1.2; g.strokeRect(x + w * 0.14, y + h * 0.16, w * 0.32, h * 0.36); g.strokeRect(x + w * 0.54, y + h * 0.16, w * 0.32, h * 0.36); g.strokeRect(x + w * 0.14, y + h * 0.6, w * 0.72, h * 0.3);
  if (o.glass) { g.fillStyle = o.glass; g.fillRect(x + w * 0.14, y + h * 0.16, w * 0.32, h * 0.36); g.fillRect(x + w * 0.54, y + h * 0.16, w * 0.32, h * 0.36); }
  g.restore(); g.fillStyle = '#e8c860'; g.beginPath(); g.arc(x + w * 0.82, y + h * 0.58, 2, 0, TAU); g.fill();
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 3, y + h, w + 6, 2);
}
function stairs(g, x0, x1, n, step, col) { for (let i = 0; i < n; i++) { const d = i * 4; g.fillStyle = mix(col, '#000', 0.08 * i); g.fillRect(x0 - d, -step * (n - i), x1 - x0 + d * 2, step); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x0 - d, -step * (n - i), x1 - x0 + d * 2, 1.5); } }
function awning(g, x, y, w, h, c1, c2, n = 7) {
  const sw = w / n; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(x + i * sw, y); g.lineTo(x + (i + 1) * sw, y); g.lineTo(x + (i + 1) * sw + 1, y + h); g.arc(x + (i + 0.5) * sw, y + h, sw / 2, 0, Math.PI); g.lineTo(x + i * sw - 1, y + h); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, y + h * 0.5, w, h * 0.5 + sw / 2); g.fillStyle = LG(g, 0, y, 0, y + h, ['rgba(255,255,255,.25)', 'rgba(255,255,255,0)']); g.fillRect(x, y, w, h);
}
function sign(g, text, x, y, w, h, bg, fg, o = {}) {
  g.save(); g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, x + 3, y + 4, w, h, h * 0.2); g.fill();
  g.fillStyle = LG(g, 0, y, 0, y + h, [lite(bg, 0.18), dark(bg, 0.15)]); rr(g, x, y, w, h, h * 0.2); g.fill(); g.strokeStyle = o.border || dark(bg, 0.5); g.lineWidth = 2; g.stroke();
  if (o.glow) { g.shadowColor = o.glow; g.shadowBlur = 10; }
  let fs = o.fs || h * 0.62; g.font = `700 ${fs}px ${FONT}`; while (g.measureText(text).width > w - 10 && fs > 6) { fs -= 1; g.font = `700 ${fs}px ${FONT}`; }
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg; g.fillText(text, x + w / 2, y + h / 2 + 1); g.restore();
}
function lantern(g, x, y, s = 1, col = '#e8342a') {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, 0); g.stroke();
  g.fillStyle = '#e8c050'; g.fillRect(-3.5, 0, 7, 2.2); g.fillStyle = RG(g, 0, 8, 1, 10, [lite(col, 0.55), col, dark(col, 0.35)], -2, 6); g.beginPath(); g.ellipse(0, 8, 7.5, 8.5, 0, 0, TAU); g.fill();
  g.strokeStyle = rgba(dark(col, 0.5), 0.6); g.lineWidth = 0.8; for (const k of [-3.5, 0, 3.5]) { g.beginPath(); g.ellipse(0, 8, Math.abs(k) + 0.5, 8.5, 0, 0, TAU); g.stroke(); }
  g.fillStyle = '#e8c050'; g.fillRect(-3.5, 15.5, 7, 2); g.strokeStyle = '#e8c050'; g.beginPath(); g.moveTo(0, 17.5); g.lineTo(0, 22); g.stroke(); g.restore();
}
function star5(g, x, y, r, ri = r * 0.45) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? ri : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); }
function padlock(g, x, y, s, col = '#d8b040') {
  g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = '#8a8f9a'; g.lineWidth = 5; g.beginPath(); g.arc(0, -6, 8, Math.PI, 0); g.lineTo(8, 0); g.moveTo(-8, -6); g.lineTo(-8, 0); g.stroke();
  g.fillStyle = LG(g, 0, 0, 0, 20, [lite(col, 0.25), dark(col, 0.2)]); rr(g, -12, -2, 24, 19, 4); g.fill(); g.strokeStyle = dark(col, 0.55); g.lineWidth = 1.5; g.stroke(); g.fillStyle = dark(col, 0.6); g.beginPath(); g.arc(0, 6.5, 3, 0, TAU); g.fill(); g.fillRect(-1.2, 7, 2.4, 6); g.restore();
}

// ---------------------------------------------------------------- props: bomen, struiken, bloemen, auto's, lantaarns
function tree(g, x, y, s, kind, R, col) {
  g.save(); g.translate(x, y); g.scale(s, s);
  if (kind === 'pine') {
    softShadow(g, 14, 4, 30, 9, 0.32);
    g.fillStyle = '#4a3220'; g.fillRect(-4, -14, 8, 16);
    const base = col || '#2f6b3a';
    for (let i = 0; i < 4; i++) {
      const yy = -12 - i * 24, w = 42 - i * 9;
      g.fillStyle = LG(g, -w, yy - 30, w, yy, [lite(base, 0.18 - i * 0.02), dark(base, 0.35 + i * 0.04)]); g.beginPath(); g.moveTo(0, yy - 34); g.lineTo(w, yy); g.quadraticCurveTo(0, yy + 9, -w, yy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,.1)'; g.beginPath(); g.moveTo(0, yy - 34); g.lineTo(-w, yy); g.quadraticCurveTo(-w * 0.4, yy - 4, 0, yy - 10); g.fill();
      g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-w * 0.9, yy - 1); g.quadraticCurveTo(0, yy + 8, w * 0.9, yy - 1); g.stroke();
    }
  } else if (kind === 'palm') {
    softShadow(g, 24, 4, 40, 9, 0.3);
    const lean = (R() - 0.5) * 30 + 8; g.strokeStyle = '#8a6a44'; g.lineCap = 'round'; g.lineWidth = 9; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(lean * 0.2, -45, lean, -90); g.stroke();
    g.strokeStyle = '#a58259'; g.lineWidth = 6; g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(lean * 0.2 - 1, -45, lean - 1, -90); g.stroke();
    g.strokeStyle = 'rgba(60,40,20,.35)'; g.lineWidth = 1; for (let i = 1; i < 9; i++) { const t = i / 9; const px = lean * t * t * 1.0 + 0, py = -90 * t; g.beginPath(); g.moveTo(px - 4, py); g.lineTo(px + 4, py - 2); g.stroke(); }
    const gc = col || '#2f9a4a'; const cx = lean, cy = -90;
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + 0.3, L = 46 + R() * 12, ex = cx + Math.cos(a) * L, ey = cy + Math.sin(a) * L * 0.55 + 14;
      g.fillStyle = LG(g, cx, cy, ex, ey, [dark(gc, 0.2), lite(gc, 0.1)]); g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo((cx + ex) / 2 + 4, (cy + ey) / 2 - 22, ex, ey); g.quadraticCurveTo((cx + ex) / 2 - 4, (cy + ey) / 2 - 8, cx, cy); g.fill();
    }
    g.fillStyle = '#5a3a1c'; g.beginPath(); g.arc(cx - 3, cy + 4, 4, 0, TAU); g.arc(cx + 3, cy + 5, 4, 0, TAU); g.fill();
  } else if (kind === 'poplar') {
    softShadow(g, 12, 3, 20, 6, 0.3); g.fillStyle = '#5a4630'; g.fillRect(-3, -14, 6, 16);
    const base = col || '#3d8a3a'; g.fillStyle = LG(g, -16, -120, 16, 0, [lite(base, 0.15), dark(base, 0.4)]); g.beginPath(); g.moveTo(0, -128); g.bezierCurveTo(22, -100, 20, -40, 12, -12); g.lineTo(-12, -12); g.bezierCurveTo(-20, -40, -22, -100, 0, -128); g.fill();
    g.fillStyle = 'rgba(255,255,255,.14)'; g.beginPath(); g.ellipse(-5, -78, 5, 40, 0.05, 0, TAU); g.fill();
  } else { // loofboom: gelaagde kruin met diepte
    const base = col || '#3f8f3a', n = kind === 'big' ? 1.25 : 1;
    softShadow(g, 24 * n, 6, 46 * n, 12 * n, 0.34);
    g.fillStyle = LG(g, -6, 0, 6, 0, ['#6a4a2c', '#3a2614']); g.beginPath(); g.moveTo(-6, 2); g.lineTo(-4, -26 * n); g.lineTo(4, -26 * n); g.lineTo(7, 2); g.fill();
    g.strokeStyle = '#3a2614'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, -20 * n); g.lineTo(-14 * n, -38 * n); g.moveTo(0, -20 * n); g.lineTo(14 * n, -36 * n); g.stroke();
    const cy = -50 * n, bl = [[-22, 6, 26], [20, 8, 25], [0, -6, 32], [-14, -22, 24], [14, -20, 24], [0, -34, 21]];
    for (const [bx, by, br] of bl) { g.fillStyle = dark(base, 0.42); g.beginPath(); g.arc(bx * n + 3, cy + by * n + 4, br * n, 0, TAU); g.fill(); }
    for (const [bx, by, br] of bl) {
      g.fillStyle = RG(g, bx * n, cy + by * n, 1, br * n, [lite(base, 0.3), base, dark(base, 0.25)], bx * n - br * 0.35 * n, cy + by * n - br * 0.4 * n);
      g.beginPath(); g.arc(bx * n, cy + by * n, br * n, 0, TAU); g.fill();
    }
    for (let i = 0; i < 40; i++) { const a = R() * TAU, rd = Math.sqrt(R()) * 40 * n; const px = Math.cos(a) * rd, py = cy - 6 * n + Math.sin(a) * rd * 0.8; g.fillStyle = R() < 0.5 ? rgba(lite(base, 0.4), 0.35) : rgba(dark(base, 0.5), 0.3); g.beginPath(); g.arc(px, py, 2 + R() * 3, 0, TAU); g.fill(); }
    if (col === 'pink' || kind === 'blossom') { for (let i = 0; i < 26; i++) { g.fillStyle = R() < 0.5 ? '#ffd0e0' : '#ff9ec0'; g.beginPath(); g.arc((R() - 0.5) * 80 * n, cy + (R() - 0.5) * 60 * n, 2 + R() * 2.5, 0, TAU); g.fill(); } }
  }
  g.restore();
}
function bush(g, x, y, s, col, R) {
  g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 10, 3, 22, 6, 0.28);
  for (const [bx, by, br] of [[-9, -6, 9], [8, -6, 10], [0, -12, 11]]) { g.fillStyle = RG(g, bx, by, 1, br, [lite(col, 0.25), col, dark(col, 0.3)], bx - 3, by - 4); g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill(); }
  g.restore();
}
function flowers(g, R, x, y, w, h, n, cols) {
  for (let i = 0; i < n; i++) {
    const px = x + R() * w, py = y + R() * h, c = cols[(R() * cols.length) | 0];
    g.strokeStyle = '#2f6a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 4); g.stroke();
    g.fillStyle = c; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(px + Math.cos(a) * 1.9, py + Math.sin(a) * 1.9, 1.5, 0, TAU); g.fill(); }
    g.fillStyle = '#ffe070'; g.beginPath(); g.arc(px, py, 1.1, 0, TAU); g.fill();
  }
}
function tulips(g, R, x, y, w, h, cols, rows = 4) { // tulpenveld met rijen
  const rh = h / rows;
  for (let r = 0; r < rows; r++) {
    const c = cols[r % cols.length], yy = y + r * rh; g.fillStyle = '#4a7a30'; g.fillRect(x, yy + rh * 0.6, w, rh * 0.4);
    for (let px = x; px < x + w; px += 5) { g.strokeStyle = '#2f6a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, yy + rh); g.lineTo(px, yy + rh * 0.5); g.stroke(); g.fillStyle = R() < 0.1 ? lite(c, 0.4) : c; g.beginPath(); g.ellipse(px, yy + rh * 0.38, 2.2, 3.2, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(x, yy + rh - 2, w, 2);
  }
}
function rock(g, x, y, s, col = '#8a8a86') {
  g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 6, 2, 16, 4, 0.3); g.fillStyle = RG(g, 0, -6, 1, 15, [lite(col, 0.3), col, dark(col, 0.4)], -4, -10); g.beginPath(); g.moveTo(-12, 0); g.quadraticCurveTo(-14, -12, -4, -14); g.quadraticCurveTo(8, -18, 13, -4); g.quadraticCurveTo(14, 1, 8, 2); g.closePath(); g.fill(); g.restore();
}
function lamppost(g, x, y, s = 1, lit = 0, style = 'iron') {
  g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 6, 1, 14, 3, 0.25);
  g.fillStyle = '#262a30'; g.fillRect(-2, -62, 4, 62); g.fillRect(-5, -4, 10, 4);
  g.fillStyle = style === 'iron' ? '#2a2f36' : '#5a4630'; g.beginPath(); g.moveTo(-8, -62); g.lineTo(8, -62); g.lineTo(5, -74); g.lineTo(-5, -74); g.closePath(); g.fill();
  g.fillStyle = lit > 0 ? '#ffe9a8' : '#cfd8e0'; g.fillRect(-5.5, -73, 11, 10); g.fillStyle = '#2a2f36'; g.beginPath(); g.moveTo(-8, -74); g.lineTo(0, -80); g.lineTo(8, -74); g.fill(); g.restore();
}
function fence(g, x0, y, x1, col = '#d8c8a0', h = 14) {
  g.fillStyle = col; for (let x = x0; x < x1; x += 7) { g.fillRect(x, y - h, 4, h); g.beginPath(); g.moveTo(x, y - h); g.lineTo(x + 2, y - h - 3); g.lineTo(x + 4, y - h); g.fill(); }
  g.fillStyle = dark(col, 0.12); g.fillRect(x0, y - h * 0.75, x1 - x0, 2.5); g.fillRect(x0, y - h * 0.3, x1 - x0, 2.5);
}
function crate(g, x, y, s, col = '#b88a50') { g.save(); g.translate(x, y); g.scale(s, s); box3(g, -8, 8, 0, 14, 0, 10, col); g.strokeStyle = rgba(dark(col, 0.5), 0.6); g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, 0); g.moveTo(8, -14); g.lineTo(-8, 0); g.stroke(); g.restore(); }

// auto van opzij (rijdt naar rechts: dir 1); gecachet per kleur
const carCache = new Map();
function carSprite(col, kind = 'car', night = 0) {
  const key = col + kind + night; if (carCache.has(key)) return carCache.get(key);
  const c = mk(120, 60), g = c.getContext('2d'); g.translate(60, 46);
  const bodyL = kind === 'van' ? 70 : kind === 'bus' ? 100 : 58, hH = kind === 'van' ? 26 : kind === 'bus' ? 32 : 16;
  const hw = bodyL / 2; g.save(); softShadow(g, 4, 5, hw + 6, 6, 0.4); g.restore();
  g.fillStyle = LG(g, 0, -hH - 8, 0, 0, [lite(col, 0.28), col, dark(col, 0.28)]);
  g.beginPath(); g.moveTo(-hw, -3); g.lineTo(-hw, -11); g.quadraticCurveTo(-hw, -15, -hw + 6, -15);
  if (kind === 'car') { g.lineTo(-hw * 0.35, -16); g.lineTo(-hw * 0.18, -hH - 6); g.lineTo(hw * 0.42, -hH - 6); g.lineTo(hw * 0.64, -16); g.lineTo(hw - 4, -15); } else { g.lineTo(-hw + 6, -hH - 8); g.lineTo(hw * 0.5, -hH - 8); g.lineTo(hw * 0.64, -16); g.lineTo(hw - 4, -15); }
  g.quadraticCurveTo(hw, -14, hw, -9); g.lineTo(hw, -3); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.3; g.stroke();
  g.fillStyle = 'rgba(190,225,255,.88)';
  if (kind === 'car') { g.beginPath(); g.moveTo(-hw * 0.3, -16); g.lineTo(-hw * 0.15, -hH - 3); g.lineTo(hw * 0.12, -hH - 3); g.lineTo(hw * 0.12, -16); g.fill(); g.beginPath(); g.moveTo(hw * 0.17, -16); g.lineTo(hw * 0.17, -hH - 3); g.lineTo(hw * 0.4, -hH - 3); g.lineTo(hw * 0.58, -16); g.fill(); }
  else if (kind === 'van') { g.fillRect(hw * 0.12, -hH - 4, hw * 0.34, 12); } else { for (let i = 0; i < 6; i++) g.fillRect(-hw + 8 + i * 15, -hH - 4, 11, 11); }
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-hw + 4, -12, bodyL - 8, 1.5);
  for (const wx of [-hw * 0.58, hw * 0.55]) { g.fillStyle = '#15171b'; g.beginPath(); g.arc(wx, -3, 7, 0, TAU); g.fill(); g.fillStyle = '#9aa0a8'; g.beginPath(); g.arc(wx, -3, 3.4, 0, TAU); g.fill(); g.fillStyle = '#15171b'; g.beginPath(); g.arc(wx, -3, 1.2, 0, TAU); g.fill(); }
  g.fillStyle = '#ffeaa0'; g.fillRect(hw - 4, -11, 4, 3); g.fillStyle = '#d02020'; g.fillRect(-hw, -11, 3, 3);
  carCache.set(key, c); return c;
}
function drawCar(g, x, y, dir, col, kind, lights) {
  const c = carSprite(col, kind); g.save(); g.translate(x, y); g.scale(dir, 1); g.drawImage(c, -60, -46);
  if (lights) { g.globalCompositeOperation = 'lighter'; const hw = (kind === 'van' ? 35 : kind === 'bus' ? 50 : 29); g.fillStyle = RG(g, hw + 14, -9, 0, 26, ['rgba(255,235,160,.55)', 'rgba(255,235,160,0)']); g.fillRect(hw - 8, -34, 50, 50); }
  g.restore();
}
function drawBike(g, x, y, dir, t, col) {
  g.save(); g.translate(x, y); g.scale(dir, 1); softShadow(g, 2, 1, 14, 3, 0.3);
  for (const wx of [-10, 10]) { g.strokeStyle = '#1c1c20'; g.lineWidth = 1.8; g.beginPath(); g.arc(wx, -8, 8, 0, TAU); g.stroke(); g.lineWidth = 0.6; g.beginPath(); for (let k = 0; k < 4; k++) { const a = t * 8 + k * Math.PI / 4; g.moveTo(wx + Math.cos(a) * 8, -8 + Math.sin(a) * 8); g.lineTo(wx - Math.cos(a) * 8, -8 - Math.sin(a) * 8); } g.stroke(); }
  g.strokeStyle = col; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-10, -8); g.lineTo(-3, -18); g.lineTo(8, -18); g.lineTo(10, -8); g.moveTo(-3, -18); g.lineTo(0, -8); g.lineTo(-10, -8); g.stroke();
  g.strokeStyle = '#1c1c20'; g.lineWidth = 2; g.beginPath(); g.moveTo(8, -18); g.lineTo(7, -23); g.lineTo(11, -23); g.stroke();
  const sw = Math.sin(t * 8) * 3; g.strokeStyle = '#3a4a6a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-3, -27); g.lineTo(0 + sw, -12); g.moveTo(-3, -27); g.lineTo(2 - sw, -9); g.stroke();
  g.fillStyle = '#e0702a'; rr(g, -7, -42, 9, 16, 4); g.fill(); g.strokeStyle = '#e0702a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-1, -38); g.lineTo(9, -24); g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(-1, -48, 5, 0, TAU); g.fill(); g.fillStyle = '#4a3220'; g.beginPath(); g.arc(-2, -49, 5, Math.PI, TAU); g.fill(); g.restore();
}
function drawWalker(g, x, y, dir, t, col, umb) {
  g.save(); g.translate(x, y); softShadow(g, 2, 1, 8, 2.5, 0.3); const sw = Math.sin(t * 7) * 3;
  g.strokeStyle = '#2a2a34'; g.lineWidth = 2.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, -12); g.lineTo(sw, 0); g.moveTo(0, -12); g.lineTo(-sw, 0); g.stroke();
  g.fillStyle = col; rr(g, -4.5, -26, 9, 15, 4); g.fill(); g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, -30, 4.3, 0, TAU); g.fill(); g.fillStyle = '#2a1c14'; g.beginPath(); g.arc(0, -31, 4.3, Math.PI, TAU); g.fill();
  if (umb) { g.fillStyle = umb; g.beginPath(); g.arc(dir * 2, -37, 12, Math.PI, 0); g.fill(); g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(dir * 2, -37); g.lineTo(dir * 2, -22); g.stroke(); }
  g.restore();
}
function drawBird(g, x, y, t, s = 1) {
  const f = Math.sin(t * 9) * 0.8; g.save(); g.translate(x, y); g.scale(s, s); g.strokeStyle = 'rgba(20,20,30,.75)'; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(-7, -2 * f - 1); g.quadraticCurveTo(-3, -5 * f - 3, 0, 0); g.quadraticCurveTo(3, -5 * f - 3, 7, -2 * f - 1); g.stroke(); g.restore();
}

// ---------------------------------------------------------------- terrein-gereedschap
function curveSample(pts, step = 6) { // Catmull-Rom door de punten, als dichte polylijn
  const out = [], P = [pts[0], ...pts, pts[pts.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const p0 = P[i - 1], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2], len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), n = Math.max(2, Math.ceil(len / step));
    for (let k = 0; k < n; k++) { const t = k / n, t2 = t * t, t3 = t2 * t; out.push([0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3), 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)]); }
  }
  out.push(pts[pts.length - 1]); return out;
}
function strokePoly(g, poly, w, style, cap = 'round') { g.beginPath(); poly.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.lineWidth = w; g.strokeStyle = style; g.lineCap = cap; g.lineJoin = 'round'; g.stroke(); }
function polyPath(poly) { const p = new Path2D(); poly.forEach((q, i) => (i ? p.lineTo(q[0], q[1]) : p.moveTo(q[0], q[1]))); p.closePath(); return p; }
function paintGrass(g, R, x0, y0, x1, y1, base, pal) {
  g.save(); g.beginPath(); g.rect(x0, y0, x1 - x0, y1 - y0); g.clip();
  g.fillStyle = LG(g, 0, y0, 0, y1, [lite(base, 0.08), base, dark(base, 0.12)]); g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let i = 0; i < 70; i++) { const px = x0 + R() * (x1 - x0), py = y0 + R() * (y1 - y0), r = 40 + R() * 110, c = R() < 0.5 ? pal[(R() * pal.length) | 0] : dark(base, 0.25); glowBlob(g, px, py, r, c, 0.16 + R() * 0.14); }
  const area = (x1 - x0) * (y1 - y0), n = area / 50;
  for (let b = 0; b < pal.length; b++) {
    g.strokeStyle = rgba(pal[b], 0.55); g.lineWidth = 1.1; g.beginPath();
    for (let i = 0; i < n / pal.length; i++) { const px = x0 + R() * (x1 - x0), py = y0 + R() * (y1 - y0), a = -Math.PI / 2 + (R() - 0.5) * 1.1, l = 3 + R() * 5; g.moveTo(px, py); g.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); }
    g.stroke();
  }
  g.restore();
}
function paintAsphalt(g, R, x, y, w, h, base = '#4a4d54') {
  g.fillStyle = LG(g, 0, y, 0, y + h, [lite(base, 0.06), base, dark(base, 0.1)]); g.fillRect(x, y, w, h);
  for (let i = 0; i < w * h / 90; i++) { const px = x + R() * w, py = y + R() * h; g.fillStyle = R() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.07)'; g.fillRect(px, py, 1 + R() * 2, 1 + R() * 2); }
  for (let i = 0; i < Math.max(2, w * h / 12000); i++) { const px = x + R() * w, py = y + R() * h, r = 8 + R() * 22; g.save(); g.translate(px, py); g.scale(2.2, 1); glowBlob(g, 0, 0, r, '#000', 0.1 + R() * 0.1); g.restore(); }
  g.strokeStyle = 'rgba(0,0,0,.22)'; g.lineWidth = 0.9; for (let i = 0; i < w * h / 14000; i++) { let px = x + R() * w, py = y + R() * h; g.beginPath(); g.moveTo(px, py); for (let k = 0; k < 5; k++) { px += (R() - 0.3) * 10; py += (R() - 0.5) * 6; g.lineTo(px, py); } g.stroke(); }
}
function dashLine(g, x0, y0, x1, y1, col = '#e8e0c0', w = 3, dash = [22, 18]) { g.save(); g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.restore(); }
function zebra(g, x, y, w, h, vertical = true) { g.fillStyle = 'rgba(240,240,235,.8)'; if (vertical) for (let i = 0; i < w / 10; i++) g.fillRect(x + i * 10, y, 5, h); else for (let i = 0; i < h / 10; i++) g.fillRect(x, y + i * 10, w, 5); }
function cobble(g, R, x, y, w, h, base, size = 9) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  for (let r = 0, yy = y; yy < y + h; yy += size * 0.75, r++) for (let xx = x - (r % 2) * size / 2; xx < x + w; xx += size) {
    const v = R() * 0.22 - 0.08; g.fillStyle = v > 0 ? lite(base, v) : dark(base, -v); g.beginPath(); g.roundRect(Math.max(x, xx + 0.8), yy + 0.6, size - 1.6, size * 0.75 - 1.2, 2); g.fill();
  }
}
function paintWater(g, R, path, c1, c2, o = {}) {
  g.save(); g.clip(path);
  g.fillStyle = LG(g, 0, o.y0 ?? 0, 0, o.y1 ?? H, [c1, c2]); g.fill(path);
  for (let i = 0; i < (o.n ?? 90); i++) { const px = (o.x0 ?? 0) + R() * ((o.x1 ?? W) - (o.x0 ?? 0)), py = (o.y0 ?? 0) + R() * ((o.y1 ?? H) - (o.y0 ?? 0)), l = 10 + R() * 26; g.strokeStyle = R() < 0.6 ? 'rgba(255,255,255,.14)' : 'rgba(0,0,40,.12)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + l / 2, py - 2.5, px + l, py); g.stroke(); }
  g.restore();
}
function collectGlints(g, R, path, box, n) { const out = []; let guard = 0; while (out.length < n && guard++ < n * 20) { const x = box[0] + R() * (box[2] - box[0]), y = box[1] + R() * (box[3] - box[1]); if (g.isPointInPath(path, x, y)) out.push({ x, y, w: 5 + R() * 11, ph: R() * 7, sp: 0.8 + R() * 1.4 }); } return out; }
function bridgeWood(g, x, y, w, len, ang = 0) { // houten bruggetje (dwars over de rivier), midden (x,y), lengte langs de weg
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(-len / 2 + 4, -w / 2 + 5, len, w);
  for (let i = 0; i < len / 7; i++) { g.fillStyle = i % 2 ? '#a07848' : '#b8885a'; g.fillRect(-len / 2 + i * 7, -w / 2, 6.4, w); }
  g.fillStyle = '#6a4a28'; g.fillRect(-len / 2, -w / 2 - 4, len, 5); g.fillRect(-len / 2, w / 2 - 1, len, 5); for (let i = 0; i <= 4; i++) { g.fillStyle = '#5a3c1e'; g.fillRect(-len / 2 + i * len / 4 - 2, -w / 2 - 8, 4, 10); g.fillRect(-len / 2 + i * len / 4 - 2, w / 2 - 4, 4, 10); }
  g.restore();
}
function bridgeStone(g, x, y, w, len, col = '#c8c0b0') { // stenen gracht-brug, bovenaanzicht schuin
  g.save(); g.translate(x, y); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(-len / 2 + 5, -w / 2 + 7, len, w);
  g.fillStyle = LG(g, 0, -w / 2, 0, w / 2, [lite(col, 0.1), col, dark(col, 0.1)]); g.fillRect(-len / 2, -w / 2, len, w);
  g.fillStyle = '#4a4d54'; g.fillRect(-len / 2 + 6, -w / 2 + 6, len - 12, w - 12); dashLine(g, -len / 2 + 8, 0, len / 2 - 8, 0, '#e8e0c0', 2, [10, 10]);
  g.fillStyle = dark(col, 0.2); g.fillRect(-len / 2, -w / 2 - 6, len, 8); g.fillRect(-len / 2, w / 2 - 2, len, 8); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(-len / 2, -w / 2 - 6, len, 2); g.restore();
}

// ================================================================ gebouwen (lokale coordinaten: (0,0) = midden onderkant van de voorgevel)
const BUILD = {};
function cyl(g, cx, y0, y1, r, col, o = {}) { // staande cilinder, voeten op y0 (scherm-y), top op y1 (< y0)
  const ry = r * 0.36;
  g.fillStyle = LG(g, cx - r, 0, cx + r, 0, [lite(col, 0.3), col, dark(col, 0.25), dark(col, 0.5)]);
  g.beginPath(); g.moveTo(cx - r, y1); g.lineTo(cx - r, y0); g.ellipse(cx, y0, r, ry, 0, Math.PI, 0, true); g.lineTo(cx + r, y1); g.ellipse(cx, y1, r, ry, 0, 0, Math.PI); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1; g.stroke();
  if (o.top !== false) { ell(g, cx, y1, r, ry, o.topCol || lite(col, 0.35)); g.strokeStyle = 'rgba(0,0,0,.25)'; g.stroke(); }
}
function cone(g, cx, yb, r, h, col) {
  const ry = r * 0.36; g.fillStyle = LG(g, cx - r, 0, cx + r, 0, [lite(col, 0.25), col, dark(col, 0.3), dark(col, 0.55)]);
  g.beginPath(); g.moveTo(cx - r, yb); g.lineTo(cx, yb - h); g.lineTo(cx + r, yb); g.ellipse(cx, yb, r, ry, 0, 0, Math.PI); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 1; g.stroke();
}
function pagodaRoof(g, cx, y, w, rise, col, o = {}) { // Chinees dak met opgetrokken hoeken; y = onderkant van de dakrand
  const hw = w / 2, up = o.up ?? 14, tg = o.trim || '#e8c050';
  g.save(); g.translate(cx, y);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.moveTo(-hw - up, -up + 5); g.quadraticCurveTo(-hw * 0.5, 14, 0, 12); g.quadraticCurveTo(hw * 0.5, 14, hw + up, -up + 5); g.lineTo(hw, 8); g.lineTo(-hw, 8); g.fill();
  g.beginPath(); g.moveTo(-hw - up, -up); g.quadraticCurveTo(-hw * 0.55, 9, 0, 8); g.quadraticCurveTo(hw * 0.55, 9, hw + up, -up);
  g.quadraticCurveTo(hw * 0.7, -rise * 0.55, hw * 0.4, -rise); g.lineTo(-hw * 0.4, -rise); g.quadraticCurveTo(-hw * 0.7, -rise * 0.55, -hw - up, -up); g.closePath();
  g.fillStyle = LG(g, 0, -rise, 0, 10, [lite(col, 0.28), col, dark(col, 0.25)]); g.fill(); g.save(); g.clip();
  g.strokeStyle = rgba(dark(col, 0.5), 0.55); g.lineWidth = 1.1; g.beginPath(); for (let i = -hw - up; i < hw + up; i += 7) { g.moveTo(i * 0.55, -rise); g.lineTo(i, 14); } g.stroke();
  g.strokeStyle = rgba(lite(col, 0.4), 0.5); g.beginPath(); for (let k = 1; k < 5; k++) { const yy = -rise + (rise + 10) * k / 5; g.moveTo(-hw - up, yy); g.lineTo(hw + up, yy); } g.stroke(); g.restore();
  g.strokeStyle = tg; g.lineWidth = 3; g.beginPath(); g.moveTo(-hw - up, -up); g.quadraticCurveTo(-hw * 0.55, 9, 0, 8); g.quadraticCurveTo(hw * 0.55, 9, hw + up, -up); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-hw - up, -up); g.quadraticCurveTo(-hw * 0.7, -rise * 0.55, -hw * 0.4, -rise); g.lineTo(hw * 0.4, -rise); g.quadraticCurveTo(hw * 0.7, -rise * 0.55, hw + up, -up); g.stroke();
  g.fillStyle = tg; g.beginPath(); g.arc(-hw - up, -up - 2, 3.2, 0, TAU); g.arc(hw + up, -up - 2, 3.2, 0, TAU); g.fill(); rr(g, -hw * 0.42, -rise - 4, hw * 0.84, 5, 2); g.fill();
  g.restore();
}
function column(g, cx, y0, y1, r, col = '#f2ecdc') { g.fillStyle = LG(g, cx - r, 0, cx + r, 0, [dark(col, 0.12), lite(col, 0.4), col, dark(col, 0.3)]); g.fillRect(cx - r, y1, r * 2, y0 - y1); g.fillStyle = dark(col, 0.1); g.fillRect(cx - r - 3, y0 - 5, r * 2 + 6, 5); g.fillRect(cx - r - 3, y1, r * 2 + 6, 5); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(cx - r - 3, y1 + 5, r * 2 + 6, 2); }
function crenel(g, x0, x1, y, h, col, n = 9) { const w = (x1 - x0) / (n * 2 - 1); for (let i = 0; i < n; i++) { g.fillStyle = LG(g, 0, y - h, 0, y, [lite(col, 0.15), col]); g.fillRect(x0 + i * 2 * w, y - h, w, h); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x0 + i * 2 * w, y - h, w, 2); } }
function flagPole(g, x, y, h, t, col, w = 26) { // vlag die wappert
  g.strokeStyle = '#d8d8dc'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke(); g.fillStyle = col; g.beginPath(); g.moveTo(x, y - h);
  const n = 8; for (let i = 1; i <= n; i++) g.lineTo(x + i / n * w, y - h + Math.sin(t * 4 + i * 0.9) * 2.2 * (i / n)); for (let i = n; i >= 0; i--) g.lineTo(x + i / n * w, y - h + 14 + Math.sin(t * 4 + i * 0.9) * 2.2 * (i / n)); g.closePath(); g.fill();
}

// ---------------------------------------------------------------- kabouterdorp
function mushroomDraw(v) {
  return (g, R, o) => {
    const night = o.night, cap = o.color, sw = [44, 33, 46][v], sh = [58, 118, 56][v], cw = [104, 92, 112][v], chh = [68, 66, 56][v], stemC = ['#f4ead0', '#efe6d2', '#e4d4b0'][v];
    g.save();
    softShadow(g, 54, 6, 110, 18, 0.34);
    if (v === 1) { // vijver
      const wp = new Path2D(); wp.ellipse(-78, 16, 52, 14, 0, 0, TAU); g.fillStyle = '#5a4630'; g.beginPath(); g.ellipse(-78, 16, 56, 17, 0, 0, TAU); g.fill();
      g.fillStyle = LG(g, 0, 4, 0, 30, ['#6ab8d8', '#2c6a96']); g.fill(wp); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-92, 12, 14, 2.2, 0, 0, TAU); g.fill();
      g.fillStyle = '#4aa050'; g.beginPath(); g.ellipse(-62, 19, 9, 3.4, 0, 0.3, TAU); g.fill(); g.fillStyle = '#ffb0c8'; g.beginPath(); g.arc(-60, 17, 2.6, 0, TAU); g.fill();
    }
    if (v === 2) g.rotate(0.07);
    // stam
    g.beginPath(); g.moveTo(-sw * 1.25, 2); g.quadraticCurveTo(-sw * 0.8, -sh * 0.3, -sw * 0.78, -sh); g.lineTo(sw * 0.78, -sh); g.quadraticCurveTo(sw * 0.8, -sh * 0.3, sw * 1.25, 2); g.quadraticCurveTo(0, 12, -sw * 1.25, 2); g.closePath();
    g.fillStyle = LG(g, -sw, 0, sw, 0, [lite(stemC, 0.2), stemC, dark(stemC, 0.2), dark(stemC, 0.4)]); g.fill(); g.strokeStyle = 'rgba(80,50,20,.4)'; g.lineWidth = 1.6; g.stroke();
    g.save(); g.clip(); g.strokeStyle = 'rgba(120,80,40,.14)'; g.lineWidth = 2; for (let i = -sw; i < sw; i += 6) { g.beginPath(); g.moveTo(i, -sh); g.lineTo(i * 1.3, 4); g.stroke(); } g.fillStyle = LG(g, 0, 0, 0, -30, ['rgba(60,30,10,.3)', 'rgba(60,30,10,0)']); g.fillRect(-sw * 1.3, -30, sw * 2.6, 34); g.restore();
    // deur en ramen
    const dh = v === 1 ? 44 : 36, dw = 21; door(g, -dw / 2 + (v === 2 ? 6 : 0), -dh, dw, dh, v === 2 ? '#6a4020' : '#8a5a2c', { arch: true, frame: '#d8b878' });
    stairs(g, -14, 14, 2, 4, '#9a9a96');
    const wn = (x, y, r) => { g.fillStyle = '#7a5428'; g.beginPath(); g.arc(x, y, r + 3, 0, TAU); g.fill(); g.fillStyle = LG(g, x, y - r, x, y + r, night > 0.3 ? ['#ffe9a0', '#ff9a40'] : ['#aad4f0', '#4c78a0']); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#7a5428'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, TAU); g.fill(); };
    if (v === 0) { wn(-27, -34, 8); wn(27, -34, 8); } else if (v === 1) { wn(0, -75, 9); wn(-17, -100, 6); wn(17, -100, 6); g.fillStyle = '#8a5a2c'; g.fillRect(-18, -88, 36, 3); } else { wn(-24, -30, 9); wn(25, -40, 5.5); g.fillStyle = '#a88858'; g.fillRect(14, -52, 22, 6); }
    // hoed
    const top = -sh;
    g.fillStyle = LG(g, 0, top - 2, 0, top + 16, ['#4a3020', '#c8b898']); g.beginPath(); g.ellipse(0, top + 1, cw * 0.97, 15, 0, 0, Math.PI); g.fill(); // plaatjes (lamellen)
    g.strokeStyle = 'rgba(90,60,30,.35)'; g.lineWidth = 1; for (let i = -cw * 0.9; i < cw * 0.9; i += 7) { g.beginPath(); g.moveTo(i, top + 3); g.lineTo(i * 0.96, top + 3 + 13 * Math.sqrt(Math.max(0, 1 - (i / cw) * (i / cw)))); g.stroke(); }
    g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw * 1.02, top - chh * 1.35, cw * 1.02, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 17, -cw, top); g.closePath();
    g.fillStyle = RG(g, 0, top - chh * 0.5, 4, cw * 1.1, [lite(cap, 0.38), cap, dark(cap, 0.28), dark(cap, 0.55)], -cw * 0.3, top - chh * 0.85); g.fill();
    g.save(); g.clip(); const sp = R(); const spots = v === 1 ? [[-44, -0.5, 9], [-8, -0.8, 11], [32, -0.55, 8], [58, -0.2, 6], [-70, -0.25, 7], [12, -0.3, 7]] : [[-52, -0.55, 11], [-14, -0.85, 13], [30, -0.65, 10], [62, -0.3, 8], [-78, -0.25, 7], [8, -0.28, 8], [48, -0.12, 5]];
    for (const [sx0, sy0, sr] of spots) { const px = sx0, py = top + chh * sy0 * 1.0 * 1; g.fillStyle = v === 2 ? '#f0e0b0' : '#fff'; g.beginPath(); g.ellipse(px, py, sr, sr * 0.72, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(px + 2, py + 3, sr * 0.8, sr * 0.5, 0, 0, TAU); g.fill(); }
    g.fillStyle = LG(g, 0, top - 4, 0, top + 18, ['rgba(0,0,0,0)', 'rgba(0,0,0,.35)']); g.fillRect(-cw, top - 4, cw * 2, 24);
    g.fillStyle = 'rgba(255,255,255,.28)'; g.beginPath(); g.ellipse(-cw * 0.38, top - chh * 0.62, cw * 0.28, chh * 0.13, -0.55, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw * 1.02, top - chh * 1.35, cw * 1.02, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 17, -cw, top); g.stroke();
    // schoorsteen
    if (v !== 1) { const cx = cw * 0.42, cy = top - chh * 0.78; g.save(); g.translate(cx, cy); g.rotate(v === 2 ? -0.25 : 0.1); box3(g, -7, 7, 0, 22, 0, 10, '#9a5a42'); g.fillStyle = '#2a1a14'; g.fillRect(-8, -24, 16, 4); g.restore(); }
    // tuin
    if (v === 0) { fence(g, -cw * 0.95, 30, -34, '#e8dcc0', 12); fence(g, 34, 30, cw * 0.95, '#e8dcc0', 12); flowers(g, R, -100, 16, 62, 20, 18, ['#ff6a8a', '#ffe060', '#fff', '#c070ff']); flowers(g, R, 38, 16, 62, 20, 18, ['#ff6a8a', '#ffe060', '#fff', '#c070ff']); g.fillStyle = '#6a4a2a'; g.fillRect(70, 0, 3, 18); g.fillStyle = '#d83a2a'; rr(g, 64, -6, 16, 10, 3); g.fill(); }
    if (v === 1) { flowers(g, R, 28, 14, 70, 22, 22, ['#80c0ff', '#fff', '#ffe060']); bush(g, 82, 14, 0.9, '#2f7a3a', R); g.fillStyle = '#ffe9a0'; g.fillRect(36, -16, 2, 20); g.fillStyle = night > 0.3 ? '#ffd060' : '#d8c060'; g.fillRect(31, -22, 12, 8); }
    if (v === 2) { g.save(); g.rotate(-0.07); fence(g, -118, 28, -40, '#b89868', 12); g.restore(); flowers(g, R, 40, 14, 60, 18, 10, ['#ff9a3a', '#ffe060']); rock(g, 66, 14, 0.8); g.fillStyle = '#c87a3a'; g.beginPath(); g.ellipse(-94, 6, 6, 10, 0, 0, TAU); g.fill(); }
    g.restore();
  };
}
const mushRoof = (v) => (g, t) => { const cw = [104, 92, 112][v], sh = [58, 118, 56][v], chh = [68, 66, 56][v]; if (v !== 1) { g.save(); if (v === 2) g.rotate(0.07); smokeAt(g, cw * 0.42, -sh - chh * 0.78 - 24, t, { rise: 60, a: 0.55, drift: 16, seed: v * 0.3 }); g.restore(); } };
BUILD.m1 = { bb: [150, 170, 175, 40], hw: 105, up: 135, draw: mushroomDraw(0), anim: mushRoof(0), lights: [[-27, -34, 26, '#ffc060', 0.5, 0.4], [27, -34, 26, '#ffc060', 0.5, 0.4]] };
BUILD.m2 = { bb: [160, 170, 215, 40], hw: 96, up: 185, draw: mushroomDraw(1), anim: mushRoof(1), lights: [[0, -75, 28, '#ffc060', 0.5, 0.4]] };
BUILD.m3 = { bb: [160, 175, 175, 40], hw: 110, up: 125, draw: mushroomDraw(2), anim: mushRoof(2), lights: [[-24, -30, 26, '#ffc060', 0.5, 0.5]] };

BUILD.townhall = {
  bb: [150, 195, 262, 40], hw: 128, up: 232,
  draw(g, R, o) {
    const st = '#e8dcc0', rc = '#b83c30', n = o.night;
    hullShadow(g, [[-130, 0], [130, 0], [150 + 30, -36], [-110, -36]], 120, 0.32, 8);
    box3(g, -130, -38, 0, 78, 0, 54, st); roofX(g, -130, -38, 78, 0, 54, 34, rc, { wall: st });
    box3(g, 38, 130, 0, 78, 0, 54, st); roofX(g, 38, 130, 78, 0, 54, 34, rc, { wall: st });
    box3(g, -44, 44, 0, 122, 0, 62, st, { ff: LG(g, 0, -122, 0, 0, [lite(st, 0.12), dark(st, 0.1)]) });
    for (let i = 0; i < 2; i++) for (let k = 0; k < 2; k++) { const x = i ? 62 + k * 34 : -96 + k * 34; win(g, x, -64, 18, 30, { lit: n * 0.7, shut: '#3a7a4a', arch: false }); }
    for (const sgn of [-1, 1]) win(g, sgn * 30 - 8, -108, 16, 22, { lit: n * 0.7, arch: true });
    // klokkentoren
    box3(g, -24, 24, 122, 168, 8, 38, '#efe4cc'); g.save(); g.translate(0, 0);
    const clockY = -147; g.fillStyle = '#c8a040'; g.beginPath(); g.arc(0, clockY, 17, 0, TAU); g.fill(); g.fillStyle = '#fffdf0'; g.beginPath(); g.arc(0, clockY, 14, 0, TAU); g.fill(); g.strokeStyle = '#2a2018'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, clockY); g.lineTo(0, clockY - 10); g.moveTo(0, clockY); g.lineTo(7, clockY + 3); g.stroke(); for (let k = 0; k < 12; k++) { const a = k / 12 * TAU; g.beginPath(); g.moveTo(Math.cos(a) * 12, clockY + Math.sin(a) * 12); g.lineTo(Math.cos(a) * 13.5, clockY + Math.sin(a) * 13.5); g.stroke(); } g.restore();
    poly3(g, [[-30, 168, 0], [30, 168, 0], [0, 224, 21]], LG(g, -30, 0, 30, 0, [lite(rc, 0.1), dark(rc, 0.2)]), 'rgba(0,0,0,.35)');
    poly3(g, [[30, 168, 0], [30, 168, 42], [0, 224, 21]], dark(rc, 0.4), 'rgba(0,0,0,.35)');
    g.fillStyle = '#e8c050'; g.beginPath(); g.arc(sx(0, 21), sy(226, 21), 3.4, 0, TAU); g.fill();
    // portiek
    for (const cx of [-30, -10, 10, 30]) column(g, cx, -2, -62, 4.5, '#f6f0e0'); box3(g, -38, 38, 62, 70, -4, 14, '#efe4cc', { ao: false }); poly3(g, [[-42, 70, -6], [42, 70, -6], [0, 90, -6]], '#e8dcc0', 'rgba(0,0,0,.3)');
    sign(g, 'GEMEENTEHUIS', -34, -69, 68, 10, '#2a5a3a', '#ffe9a0', { fs: 8 });
    door(g, -11, -50, 22, 48, '#5a3a20', { arch: true, frame: '#f0e8d8' }); stairs(g, -38, 38, 3, 4, '#bdb6a6');
    for (const sgn of [-1, 1]) { bush(g, sgn * 112, 14, 1.1, '#2f7a3a', R); lamppost(g, sgn * 70, 22, 0.9, n, 'wood'); }
    flowers(g, R, -100, 16, 200, 14, 30, ['#ff6a8a', '#ffe060', '#fff']);
  },
  anim(g, t, n) { flagPole(g, sx(0, 21), sy(224, 21), 30, t, '#d03a3a', 26); },
  lights: [[-30, -90, 30, '#ffc060', 0.35, 0.3], [30, -90, 30, '#ffc060', 0.35, 0.3], [-20, 20, 24, '#ffd890', 0.3, 0.4], [20, 20, 24, '#ffd890', 0.3, 0.4]],
};

BUILD.mushbank = {
  bb: [150, 190, 220, 40], hw: 125, up: 185,
  draw(g, R, o) {
    const st = '#e6ddc8', n = o.night;
    hullShadow(g, [[-120, 0], [120, 0], [150, -34], [-100, -34]], 100, 0.32, 8);
    box3(g, -120, 120, 0, 92, 0, 56, st, { ff: LG(g, 0, -92, 0, 0, [lite(st, 0.1), dark(st, 0.1)]) });
    // ramen met tralies
    for (const x of [-100, -76, 62, 86]) { win(g, x, -62, 14, 30, { lit: n * 0.6, frame: '#c8b068', cols: 1 }); g.strokeStyle = '#2a2a30'; g.lineWidth = 1.2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(x + k * 3.5, -62); g.lineTo(x + k * 3.5, -32); g.stroke(); } }
    for (const cx of [-56, -19, 19, 56]) column(g, cx, -2, -78, 7, '#f4eedc');
    box3(g, -66, 66, 78, 92, -6, 14, '#efe6d0', { ao: false });
    sign(g, 'BANK', -26, -92, 52, 13, '#2a5a3a', '#ffe9a0', { border: '#e0b850' });
    // kluisdeur
    g.fillStyle = '#c8a040'; g.beginPath(); g.arc(0, -34, 26, 0, TAU); g.fill(); g.fillStyle = LG(g, -20, -54, 20, -14, ['#f0d070', '#a8802a']); g.beginPath(); g.arc(0, -34, 22, 0, TAU); g.fill();
    g.strokeStyle = '#6a4a10'; g.lineWidth = 2; g.beginPath(); g.arc(0, -34, 14, 0, TAU); g.stroke(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.moveTo(0, -34); g.lineTo(Math.cos(a) * 14, -34 + Math.sin(a) * 14); g.stroke(); } g.fillStyle = '#6a4a10'; g.beginPath(); g.arc(0, -34, 4, 0, TAU); g.fill();
    stairs(g, -70, 70, 3, 4, '#c8c0ac');
    // paddenstoelhoed op het dak
    const top = -92, cw = 122, chh = 62, cap = '#d8362a';
    g.fillStyle = LG(g, 0, top - 2, 0, top + 14, ['#4a3020', '#c8b898']); g.beginPath(); g.ellipse(0, top + 1, cw * 0.95, 13, 0, 0, Math.PI); g.fill();
    g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw * 1.0, top - chh * 1.35, cw * 1.0, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 16, -cw, top); g.closePath(); g.fillStyle = RG(g, 0, top - chh * 0.5, 4, cw * 1.1, [lite(cap, 0.35), cap, dark(cap, 0.3), dark(cap, 0.55)], -cw * 0.3, top - chh * 0.9); g.fill();
    g.save(); g.clip(); for (const [px, py, sr] of [[-70, 0.55, 11], [-30, 0.85, 13], [20, 0.7, 11], [60, 0.45, 9], [-96, 0.25, 8], [92, 0.22, 6], [-4, 0.28, 8]]) { g.fillStyle = '#fff'; g.beginPath(); g.ellipse(px, top - chh * py, sr, sr * 0.7, 0, 0, TAU); g.fill(); } g.fillStyle = LG(g, 0, top - 4, 0, top + 16, ['rgba(0,0,0,0)', 'rgba(0,0,0,.35)']); g.fillRect(-cw, top - 4, cw * 2, 22); g.fillStyle = 'rgba(255,255,255,.26)'; g.beginPath(); g.ellipse(-cw * 0.4, top - chh * 0.65, cw * 0.28, chh * 0.12, -0.5, 0, TAU); g.fill(); g.restore();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-cw, top); g.bezierCurveTo(-cw, top - chh * 1.35, cw, top - chh * 1.35, cw, top); g.quadraticCurveTo(0, top + 16, -cw, top); g.stroke();
    // geldzakken en lantaarns
    for (const sgn of [-1, 1]) { lamppost(g, sgn * 100, 24, 0.9, n, 'wood'); bush(g, sgn * 130, 14, 1, '#2f7a3a', R); }
    g.fillStyle = '#c8a040'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(-110 + k * 5, 18 - (k % 2) * 3, 5, 0, TAU); g.fill(); g.strokeStyle = '#6a4a10'; g.lineWidth = 1; g.stroke(); }
  },
  anim(g, t) { g.save(); g.globalCompositeOperation = 'lighter'; const a = 0.25 + Math.sin(t * 3) * 0.12; glowBlob(g, 0, -34, 40, '#ffd860', a); g.restore(); },
  lights: [[-88, -45, 26, '#ffc060', 0.3, 0.3], [74, -45, 26, '#ffc060', 0.3, 0.3]],
};

// ================================================================ hoofdstukken (terrein + bewegende dingen)
const CITY = {};
const keepOut = (cfg) => (x, y, pad = 0) => cfg.slots.some((sd) => { const sp = BUILD[sd.kind]; return x > sd.x - sp.hw * sd.s - pad && x < sd.x + sp.hw * sd.s + pad + 24 && y > sd.y - sp.up * sd.s - pad && y < sd.y + 84 + pad; });
const nearPoly = (poly, x, y, d) => { for (let i = 0; i < poly.length; i += 2) if (Math.abs(poly[i][0] - x) < d && Math.abs(poly[i][1] - y) < d && Math.hypot(poly[i][0] - x, poly[i][1] - y) < d) return true; return false; };
function cloudShadows(world, n, a = 0.13) {
  const c = mk(300, 160), g = c.getContext('2d'); for (let i = 0; i < 7; i++) { g.save(); g.translate(60 + i * 30, 80 + Math.sin(i * 2.3) * 24); g.scale(1.6, 1); glowBlob(g, 0, 0, 46 + (i % 3) * 10, '#000', 0.5); g.restore(); }
  const R = world.R, cl = []; for (let i = 0; i < n; i++) cl.push({ x: R() * (W + 300), y: 120 + R() * 540, s: 0.8 + R() * 1.2, v: 7 + R() * 7 });
  world.front.push((g2, t) => { g2.save(); g2.globalAlpha = a; for (const q of cl) { const x = ((q.x + t * q.v) % (W + 600)) - 300; g2.drawImage(c, x, q.y, 300 * q.s, 160 * q.s); } g2.restore(); });
}
function birdsFlock(world, n, y0, y1, sp = 40) {
  const R = world.R, b = []; for (let i = 0; i < n; i++) b.push({ x: R() * W, y: y0 + R() * (y1 - y0), v: sp * (0.7 + R() * 0.6), ph: R() * 9, s: 0.8 + R() * 0.5 });
  world.front.push((g, t) => { for (const q of b) { const x = ((q.x + t * q.v) % (W + 120)) - 60, y = q.y + Math.sin(t * 0.7 + q.ph) * 10; g.save(); g.globalAlpha = 0.9; g.fillStyle = 'rgba(0,0,0,.12)'; g.beginPath(); g.ellipse(x + 20, y + 70, 7 * q.s, 2.5 * q.s, 0, 0, TAU); g.fill(); g.restore(); drawBird(g, x, y, t + q.ph, q.s); } });
}
function glintsDraw(world, list, col = '#fff') { world.back.push((g, t) => { g.lineWidth = 1.5; g.lineCap = 'round'; for (const q of list) { const a = Math.max(0, Math.sin(t * q.sp + q.ph)); if (a < 0.05) continue; g.strokeStyle = rgba(col, a * 0.7); g.beginPath(); g.moveTo(q.x, q.y); g.lineTo(q.x + q.w, q.y); g.stroke(); } }); }
function tinyGnome(g, x, y, dir, t, hat, body) {
  g.save(); g.translate(x, y); softShadow(g, 2, 1, 9, 3, 0.3); const sw = Math.sin(t * 8) * 2.5;
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 2.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2, -8); g.lineTo(-2 + sw, 0); g.moveTo(2, -8); g.lineTo(2 - sw, 0); g.stroke();
  g.fillStyle = body; rr(g, -5, -20, 10, 14, 4); g.fill(); g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, -24, 4.6, 0, TAU); g.fill();
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(-4.4, -23); g.quadraticCurveTo(0, -12, 4.4, -23); g.closePath(); g.fill();
  g.fillStyle = hat; g.beginPath(); g.moveTo(-6.5, -26); g.quadraticCurveTo(0, -30, dir * 4 + 1, -42); g.quadraticCurveTo(5, -30, 6.5, -26); g.closePath(); g.fill(); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 0.8; g.stroke(); g.restore();
}
function walkerPath(world, poly, n, col, draw, speed = 26) {
  const R = world.R; for (let i = 0; i < n; i++) {
    const o = { u: R(), v: speed * (0.7 + R() * 0.6) * (R() < 0.5 ? 1 : -1), c: col[(R() * col.length) | 0], c2: col[(R() * col.length) | 0] }; let len = 0; const cum = [0]; for (let k = 1; k < poly.length; k++) { len += Math.hypot(poly[k][0] - poly[k - 1][0], poly[k][1] - poly[k - 1][1]); cum.push(len); }
    const at = (t) => { let d = ((o.u * len + o.v * t) % (2 * len) + 2 * len) % (2 * len), dir = o.v > 0 ? 1 : -1; if (d > len) { d = 2 * len - d; dir = -dir; } let k = 1; while (k < cum.length - 1 && cum[k] < d) k++; const u = (d - cum[k - 1]) / Math.max(1, cum[k] - cum[k - 1]); return { x: lerp(poly[k - 1][0], poly[k][0], u), y: lerp(poly[k - 1][1], poly[k][1], u), dir }; };
    world.actors.push({ y: (t) => at(t).y, draw: (g, t) => { const p = at(t); draw(g, p.x, p.y, p.dir, t + i, o.c, o.c2); } });
  }
}

CITY.village = {
  night: 0.55, vig: 0.55, wash: ['rgba(72,48,132,.30)', 'rgba(255,150,70,.07)'], spriteTint: 'rgba(110,70,150,.09)',
  slots: [
    { x: 205, y: 348, s: 0.92, kind: 'm1', color: '#d8362a' },
    { x: 440, y: 612, s: 1.0, kind: 'm2', color: '#3a6ad0' },
    { x: 668, y: 348, s: 0.9, kind: 'm3', color: '#b8802a' },
    { x: 905, y: 612, s: 0.95, kind: 'townhall' },
    { x: 1085, y: 350, s: 0.9, kind: 'mushbank' },
  ],
  paint(g, R, world) {
    const cfg = CITY.village, out = keepOut(cfg);
    paintGrass(g, R, 0, 0, W, H, '#48903a', ['#5aa845', '#3a8030', '#74bd52', '#2f7a30', '#86c85e', '#4f9a3c']);
    // lichtvlekken (bosbodem) en schaduw van het bladerdak langs de randen
    for (let i = 0; i < 26; i++) glowBlob(g, R() * W, 120 + R() * 560, 60 + R() * 90, R() < 0.5 ? '#c8e86a' : '#e8d870', 0.07);
    for (let i = 0; i < 18; i++) glowBlob(g, R() * W, R() * 140, 90 + R() * 100, '#0a2a14', 0.28);
    for (let i = 0; i < 14; i++) { glowBlob(g, R() * 90, R() * H, 90, '#0a2a14', 0.25); glowBlob(g, W - R() * 90, R() * H, 90, '#0a2a14', 0.25); }
    // rivier
    const riv = curveSample([[-60, 470], [200, 492], [430, 466], [660, 494], [880, 468], [1100, 490], [1340, 468]], 5);
    strokePoly(g, riv, 78, 'rgba(40,28,10,.35)'); strokePoly(g, riv, 70, '#6a5434'); strokePoly(g, riv, 64, '#4f7a3a');
    strokePoly(g, riv, 58, LG(g, 0, 440, 0, 520, ['#6cc0e0', '#2f7fae'])); strokePoly(g, riv, 40, 'rgba(255,255,255,.07)'); strokePoly(g, riv.map((p) => [p[0], p[1] + 16]), 12, 'rgba(0,0,40,.12)');
    const glints = []; for (let i = 0; i < riv.length; i += 3) if (R() < 0.7) glints.push({ x: riv[i][0] + (R() - 0.5) * 8, y: riv[i][1] + (R() - 0.5) * 36, w: 6 + R() * 12, ph: R() * 9, sp: 1 + R() * 1.5 });
    glintsDraw(world, glints);
    for (let i = 0; i < riv.length; i += 9) { rock(g, riv[i][0] + (R() - 0.5) * 20, riv[i][1] - 36 - R() * 4, 0.5 + R() * 0.4, '#8a8a80'); }
    // pad
    const path = curveSample([[-30, 400], [205, 364], [330, 450], [446, 630], [560, 520], [668, 366], [790, 460], [905, 630], [1000, 505], [1085, 366], [1310, 420]], 5);
    world.path = path;
    strokePoly(g, path, 48, 'rgba(0,0,0,.18)'); strokePoly(g, path, 44, '#7a5a34'); strokePoly(g, path, 38, '#b8935c'); strokePoly(g, path, 22, 'rgba(255,240,200,.18)');
    g.fillStyle = 'rgba(70,45,20,.35)'; for (let i = 0; i < path.length; i++) { const p = path[i]; for (let k = 0; k < 3; k++) { g.beginPath(); g.ellipse(p[0] + (R() - 0.5) * 36, p[1] + (R() - 0.5) * 30, 1 + R() * 2.4, 1 + R() * 1.4, 0, 0, TAU); g.fill(); } }
    g.fillStyle = 'rgba(255,255,255,.2)'; for (let i = 0; i < path.length; i += 2) { const p = path[i]; g.beginPath(); g.ellipse(p[0] + (R() - 0.5) * 30, p[1] + (R() - 0.5) * 24, 1.3, 0.9, 0, 0, TAU); g.fill(); }
    // bruggetjes waar het pad de rivier kruist
    const rivY = (x) => { let b = riv[0]; for (const p of riv) if (Math.abs(p[0] - x) < Math.abs(b[0] - x)) b = p; return b[1]; };
    let lastB = -999; for (let i = 2; i < path.length - 2; i++) { const p = path[i]; if (Math.abs(p[1] - rivY(p[0])) < 3 && p[0] - lastB > 120) { lastB = p[0]; const q = path[i - 2], r = path[i + 2], ang = Math.atan2(r[1] - q[1], r[0] - q[0]); bridgeWood(g, p[0], p[1], 38, 100, ang); } }
    // struiken en bloemen bij het pad
    for (let i = 0; i < 90; i++) { const p = path[(R() * path.length) | 0], x = p[0] + (R() < 0.5 ? -1 : 1) * (30 + R() * 22), y = p[1] + (R() - 0.5) * 20; if (out(x, y, 6) || Math.abs(y - rivY(x)) < 50) continue; flowers(g, R, x, y, 22, 10, 3, ['#ff6a8a', '#ffe060', '#fff', '#b080ff', '#80c8ff']); }
    for (let i = 0; i < 30; i++) { const x = R() * W, y = 130 + R() * 560; if (out(x, y, 14) || Math.abs(y - rivY(x)) < 56 || nearPoly(path, x, y, 40)) continue; rock(g, x, y, 0.5 + R() * 0.6); }
    // paddenstoeltjes
    const mush = (x, y, s, c) => { g.save(); g.translate(x, y); g.scale(s, s); softShadow(g, 5, 1, 12, 3, 0.3); g.fillStyle = '#efe2c4'; g.fillRect(-3, -9, 6, 9); g.fillStyle = RG(g, 0, -12, 1, 11, [lite(c, 0.3), c, dark(c, 0.3)], -3, -15); g.beginPath(); g.ellipse(0, -10, 10, 7, 0, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(-3, -14, 1.7, 0, TAU); g.arc(3, -12, 1.4, 0, TAU); g.fill(); g.restore(); };
    for (let i = 0; i < 40; i++) { const x = R() * W, y = 120 + R() * 580; if (out(x, y, 10) || Math.abs(y - rivY(x)) < 52 || nearPoly(path, x, y, 30)) continue; for (let k = 0; k < 2 + ((R() * 2) | 0); k++) mush(x + k * 11, y + (R() - 0.5) * 8, 0.6 + R() * 0.6, R() < 0.6 ? '#d8362a' : '#d8a02a'); }
    // lantaarnpalen langs het pad
    const lp = [[300, 428], [575, 560], [772, 450], [1002, 535], [120, 372], [1190, 386]]; for (const [x, y] of lp) { lamppost(g, x, y, 0.8, 1, 'wood'); world.lights.push({ x, y: y - 56, r: 64, c: '#ffc860', a: 0.6, fl: 0.5, ph: R() * 9 }); }
    // bomen: bosrand boven, tussendoor een paar
    const trees = []; const tryTree = (x, y, k, s) => { if (out(x, y, -16) && k !== 'pine') { /* mag achter gebouw staan */ } trees.push([x, y, k, s]); };
    for (let i = 0; i < 38; i++) { const x = R() * W, y = 92 + R() * 150; tryTree(x, y, R() < 0.55 ? 'pine' : 'oak', 0.75 + R() * 0.55); }
    for (let i = 0; i < 60; i++) { const x = R() * W, y = 250 + R() * 400; if (out(x, y, 20) || Math.abs(y - rivY(x)) < 60 || nearPoly(path, x, y, 46) || y > 590 && (x > 300 && x < 1020)) continue; if (x > 120 && x < 1160 && R() < 0.45) continue; tryTree(x, y, R() < 0.5 ? 'pine' : 'oak', 0.6 + R() * 0.45); }
    trees.sort((a, b) => a[1] - b[1]); const TR = RNG(77); for (const [x, y, k, s] of trees) tree(g, x, y, s, k, TR, k === 'oak' && TR() < 0.3 ? '#4a9a3a' : undefined);
    // vuurvliegjes en schaduw-wolken
    const ff = []; for (let i = 0; i < 46; i++) ff.push({ x: R() * W, y: 120 + R() * 560, r: 20 + R() * 40, sp: 0.3 + R() * 0.5, ph: R() * 9, bl: 0.6 + R() * 1.2 });
    world.front.push((g2, t) => { g2.save(); g2.globalCompositeOperation = 'lighter'; for (const f of ff) { const x = f.x + Math.sin(t * f.sp + f.ph) * f.r, y = f.y + Math.cos(t * f.sp * 1.3 + f.ph) * f.r * 0.6, a = Math.max(0, Math.sin(t * f.bl + f.ph)); if (a < 0.05) continue; g2.globalAlpha = a; g2.drawImage(glowSprite('#d8ff70'), x - 9, y - 9, 18, 18); g2.fillStyle = '#fff8c0'; g2.beginPath(); g2.arc(x, y, 1.4, 0, TAU); g2.fill(); } g2.restore(); });
    walkerPath(world, path.slice(0, 120), 4, ['#d8362a', '#3a6ad0', '#2a8a4a', '#b8802a'], (g2, x, y, dir, t, c, c2) => tinyGnome(g2, x, y, dir, t * 1.2, c, c2), 20);
    birdsFlock(world, 4, 100, 240, 30); cloudShadows(world, 4, 0.12);
  },
  paintFront(g, R, world) {
    const trees = [[40, 712, 'pine', 1.2], [1245, 708, 'pine', 1.25], [110, 725, 'oak', 1.0], [1170, 722, 'oak', 1.05], [20, 520, 'pine', 1.1], [1262, 530, 'pine', 1.1], [18, 300, 'oak', 1.0], [1264, 290, 'oak', 1.05]];
    for (const [x, y, k, s] of trees) tree(g, x, y, s, k, R);
    for (let i = 0; i < 40; i++) { const x = R() * W, y = 690 + R() * 30; if (x > 330 && x < 1000) continue; bush(g, x, y, 0.7 + R() * 0.6, ['#2f7a3a', '#3a8a3a', '#2a6a34'][(R() * 3) | 0], R); }
    flowers(g, R, 60, 690, 200, 30, 40, ['#ff6a8a', '#ffe060', '#fff', '#b080ff']); flowers(g, R, 1020, 690, 200, 30, 40, ['#ff6a8a', '#ffe060', '#fff', '#80c8ff']);
  },
};

// ================================================================ de kaart zelf
const glowCache = new Map();
function glowSprite(col) { if (glowCache.has(col)) return glowCache.get(col); const c = mk(96, 96), g = c.getContext('2d'); g.fillStyle = RG(g, 48, 48, 0, 48, [rgba(col, 1), rgba(col, 0.35), rgba(col, 0)]); g.fillRect(0, 0, 96, 96); glowCache.set(col, c); return c; }
function smokeAt(g, x, y, t, o = {}) {
  const n = o.n || 6, rise = o.rise || 46, col = o.col || '#e8e8ee';
  for (let i = 0; i < n; i++) { const ph = (t * (o.sp || 0.32) + i / n + (o.seed || 0)) % 1; const px = x + Math.sin(ph * 6 + i) * 4 + ph * (o.drift ?? 12), py = y - ph * rise; g.fillStyle = rgba(col, (1 - ph) * (o.a ?? 0.5) * Math.min(1, ph * 6)); g.beginPath(); g.arc(px, py, 2.5 + ph * (o.grow ?? 9), 0, TAU); g.fill(); }
}
const wrapText = (g, text, maxW) => { const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; };
const ease = (t) => t * t * (3 - 2 * t);

export function createCityMap(canvas, opts = {}) {
  const ctx = canvas.getContext('2d');
  const sfx = (n) => { try { opts.sfx && opts.sfx(n); } catch (e) { /* geen geluid */ } };
  const getSt = (n) => { try { return (opts.getState && opts.getState(n)) || {}; } catch (e) { return {}; } };
  let ch = clamp(opts.chapter | 0, 0, CHAPTERS.length - 1), alive = true, raf = 0, last = performance.now() / 1000, T = 0;
  let kx = 1, ky = 1; const caches = new Map();
  let st = [], stT = -9; // levelstanden van dit hoofdstuk
  let hover = null, sel = 0, kbd = false, press = null, tip = null, tipT = -9, shake = { k: '', t: -9 }, mouse = { x: 640, y: 360 };
  let walk = null, snap = null, snapT = -9;
  const teun = { x: 0, y: 0, face: 1, idx: -1, alpha: 1, mv: null, ch: -1 };
  const chapterOpen = (i) => i <= 0 || !!getSt(CHAPTERS[i - 1].levels[CHAPTERS[i - 1].levels.length - 1]).done;
  const lvl = (i) => CHAPTERS[ch].levels[i];

  function layers(c) {
    const city = CHAPTERS[c].city; let L = caches.get(c);
    if (L && L.w === canvas.width && L.h === canvas.height) return L;
    L = buildCity(city, canvas.width, canvas.height, c); L.w = canvas.width; L.h = canvas.height; caches.set(c, L); return L;
  }
  function readState() {
    const open = chapterOpen(ch);
    st = CHAPTERS[ch].levels.map((n) => { const s = getSt(n); return { unlocked: open && !!s.unlocked, done: !!s.done, stars: clamp(s.stars | 0, 0, 3) }; });
    stT = T;
  }
  const spot = (L, i) => { const sl = L.slots[i]; return { x: sl.x + sl.hw * sl.s * 0.72 + 14, y: sl.y + 14 }; };
  function targetIdx() { if (!chapterOpen(ch)) return 0; for (let i = 0; i < 5; i++) if (st[i].unlocked && !st[i].done) return i; return st.some((s) => s.done) ? 4 : 0; }
  function placeTeun(instant) {
    const L = layers(ch), idx = targetIdx(), p = spot(L, idx);
    if (instant || teun.ch !== ch || teun.idx < 0) { teun.x = p.x; teun.y = p.y; teun.mv = null; teun.alpha = 1; teun.face = -1; }
    else if (teun.idx !== idx) teun.mv = { x: p.x, y: p.y };
    teun.idx = idx; teun.ch = ch; sel = idx;
  }
  function resizeCanvasSizes() { kx = canvas.width / W; ky = canvas.height / H; }
  resizeCanvasSizes(); readState(); placeTeun(true);

  // ------------------------------------------------ invoer
  function toLogical(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / (r.width || 1) * W, y: (e.clientY - r.top) / (r.height || 1) * H }; }
  function arrowPos(dir) { return { x: dir < 0 ? 46 : W - 46, y: 372 }; }
  function dotPos(i) { return { x: W / 2 + (i - 2) * 38, y: 704 }; }
  function hitTest(p) {
    const L = layers(ch);
    for (const d of [-1, 1]) { const ci = ch + d; if (ci < 0 || ci >= CHAPTERS.length) continue; const a = arrowPos(d); if (Math.hypot(p.x - a.x, p.y - a.y) < 42) return { k: 'arrow', d, i: ci }; }
    for (let i = 0; i < 5; i++) { const q = dotPos(i); if (Math.hypot(p.x - q.x, p.y - q.y) < 17) return { k: 'dot', i }; }
    const order = [0, 1, 2, 3, 4].sort((a, b) => L.slots[b].y - L.slots[a].y);
    for (const i of order) {
      const sl = L.slots[i], pl = L.plates[i];
      if (p.x > sl.x - sl.hw * sl.s && p.x < sl.x + sl.hw * sl.s && p.y > sl.y - sl.up * sl.s && p.y < sl.y + 12) return { k: 'b', i };
      if (p.x > sl.x - pl.w / 2 && p.x < sl.x + pl.w / 2 && p.y >= sl.y + 8 && p.y < sl.y + 8 + pl.h) return { k: 'b', i };
    }
    return null;
  }
  const same = (a, b) => (!a && !b) || (a && b && a.k === b.k && a.i === b.i);
  function setHover(h) { if (same(h, hover)) return; hover = h; if (h) { tipT = T; sfx('hover'); } canvas.style.cursor = h ? 'pointer' : ''; }
  function onMove(e) { if (walk) return; const p = toLogical(e); mouse = p; kbd = false; setHover(hitTest(p)); }
  function onDown(e) { if (walk) return; const p = toLogical(e); mouse = p; kbd = false; const h = hitTest(p); press = h; setHover(h); if (h && e.pointerType === 'touch') tipT = T; }
  function onUp(e) { if (walk) { press = null; return; } const p = toLogical(e); const h = hitTest(p); const pr = press; press = null; if (e.pointerType === 'touch' || e.pointerType === 'pen') { if (!h) setHover(null); } if (h && pr && same(h, pr)) activate(h); }
  function onLeave() { if (!walk) setHover(null); }
  function activate(h) {
    if (h.k === 'b') pickBuilding(h.i);
    else if (h.k === 'arrow' || h.k === 'dot') { if (h.i === ch) return; if (!chapterOpen(h.i)) { shake = { k: h.k + h.i, t: T }; tip = { text: 'Haal eerst het vorige hoofdstuk', until: T + 2 }; tipT = T; return; } sfx('click'); try { opts.onChapter && opts.onChapter(h.i); } catch (e) { console.error(e); } }
  }
  function pickBuilding(i) {
    if (walk) return; readState();
    if (!st[i].unlocked) { shake = { k: 'b' + i, t: T }; tip = { text: chapterOpen(ch) ? 'Haal eerst het vorige level' : 'Haal eerst het vorige hoofdstuk', until: T + 2, i }; tipT = T; return; }
    sfx('click'); const L = layers(ch), sl = L.slots[i];
    walk = { i, t0: T, dur: 0.7, fx: teun.x, fy: teun.y, tx: sl.x + 6, ty: sl.y - 2, done: false };
    teun.mv = null; teun.face = walk.tx >= walk.fx ? 1 : -1; hover = { k: 'b', i }; canvas.style.cursor = '';
  }
  function onKey(e) {
    if (!alive || walk || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'ArrowRight') { kbd = true; sel = clamp(sel + (k === 'ArrowLeft' ? -1 : 1), 0, 4); hover = null; tipT = T; sfx('hover'); e.preventDefault(); }
    else if (k === 'Enter' || k === ' ') { kbd = true; pickBuilding(sel); e.preventDefault(); }
    else if (k === 'PageUp' || k === 'PageDown') { const i = ch + (k === 'PageUp' ? -1 : 1); if (i >= 0 && i < CHAPTERS.length) activate({ k: 'arrow', i }); e.preventDefault(); }
  }
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerdown', onDown); canvas.addEventListener('pointerup', onUp); canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointercancel', onLeave);
  window.addEventListener('keydown', onKey);
  canvas.style.touchAction = 'none';

  // ------------------------------------------------ tekenen
  function drawPlate(g, L, i, a) {
    const sl = L.slots[i], pl = L.plates[i], s = st[i], lk = !s.unlocked;
    const x = sl.x - pl.w / 2, y = sl.y + 8 + (a.lift || 0);
    g.save(); g.globalAlpha = lk ? 0.9 : 1;
    g.fillStyle = 'rgba(0,0,0,.35)'; rr(g, x + 2, y + 5, pl.w, pl.h, 12); g.fill();
    g.fillStyle = LG(g, 0, y, 0, y + pl.h, lk ? ['#3a4050', '#242836'] : s.done ? ['#2f5a3a', '#1b3a24'] : ['#4a3322', '#2a1a10']); rr(g, x, y, pl.w, pl.h, 12); g.fill();
    g.strokeStyle = lk ? '#6a7084' : s.done ? '#f0d060' : a.hot ? '#ffe9a0' : '#c49a56'; g.lineWidth = a.hot ? 3 : 2.2; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.08)'; rr(g, x + 3, y + 3, pl.w - 6, pl.h / 2 - 3, 9); g.fill();
    // nummerbordje
    const bx = x + 8, by = y + 6; g.fillStyle = LG(g, 0, by - 16, 0, by + 16, lk ? ['#9aa0b0', '#5a6070'] : s.done ? ['#7ae08a', '#2f9a48'] : ['#ffe27a', '#e0a020']); g.beginPath(); g.arc(bx, by, 19, 0, TAU); g.fill(); g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 2; g.stroke();
    g.font = `700 21px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = lk ? '#2a2e3a' : '#3a2208'; g.fillText(String(lvl(i)), bx, by + 1);
    g.font = `600 19px ${FONT}`; g.fillStyle = lk ? '#b8bfd0' : '#fff4dc'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3;
    pl.lines.forEach((t, k) => g.fillText(t, sl.x + 8, y + 17 + k * 21)); g.shadowBlur = 0;
    // sterren
    const sy0 = y + pl.h - 13;
    for (let k = 0; k < 3; k++) { const px = sl.x + 8 + (k - 1) * 26; star5(g, px, sy0, 10); if (k < s.stars) { g.fillStyle = LG(g, 0, sy0 - 10, 0, sy0 + 10, ['#fff2a0', '#f0b020']); g.fill(); g.strokeStyle = '#8a5a08'; } else { g.fillStyle = 'rgba(0,0,0,.4)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.25)'; } g.lineWidth = 1.4; g.stroke(); }
    if (s.done) { const cx = x + pl.w - 5, cy = y + 4; g.fillStyle = '#35b050'; g.beginPath(); g.arc(cx, cy, 14, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 2.5; g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 3.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(cx - 6, cy + 0.5); g.lineTo(cx - 1.5, cy + 5); g.lineTo(cx + 6.5, cy - 5); g.stroke(); }
    g.restore();
  }
  function wrapBox(g, text, maxW, fs) { g.font = `500 ${fs}px ${FONT}`; return wrapText(g, text, maxW); }
  function drawTip(g, x, y, title, sub, extra) {
    g.save(); g.font = `700 22px ${FONT}`; const subL = sub ? wrapBox(g, sub, 300, 17) : []; g.font = `700 22px ${FONT}`; const exL = extra ? wrapBox(g, extra, 300, 16) : [];
    const tw = Math.max(g.measureText(title).width, 220, ...subL.map((l) => { g.font = `500 17px ${FONT}`; return g.measureText(l).width; })); const w = Math.min(340, tw + 32), h = 18 + 28 + subL.length * 22 + exL.length * 20 + (exL.length ? 8 : 0);
    let tx = clamp(x - w / 2, 12, W - w - 12), ty = y - h - 10; if (ty < 90) ty = clamp(y + 20, 90, H - h - 10);
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 14; g.fillStyle = 'rgba(20,16,30,.94)'; rr(g, tx, ty, w, h, 14); g.fill(); g.shadowBlur = 0; g.strokeStyle = '#e8c060'; g.lineWidth = 2; g.stroke();
    g.textAlign = 'left'; g.textBaseline = 'top'; g.font = `700 21px ${FONT}`; g.fillStyle = '#ffe9a0'; g.fillText(title, tx + 16, ty + 12);
    g.font = `500 17px ${FONT}`; g.fillStyle = '#f0ece0'; subL.forEach((l, k) => g.fillText(l, tx + 16, ty + 42 + k * 22));
    g.font = `600 16px ${FONT}`; g.fillStyle = '#ff9a8a'; exL.forEach((l, k) => g.fillText(l, tx + 16, ty + 46 + subL.length * 22 + k * 20));
    g.restore();
  }
  function drawUI(g, L) {
    const C = CHAPTERS[ch], open = chapterOpen(ch);
    // titelbalk
    g.fillStyle = LG(g, 0, 0, 0, 84, ['rgba(12,10,24,.88)', 'rgba(12,10,24,.55)', 'rgba(12,10,24,0)']); g.fillRect(0, 0, W, 90);
    g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.shadowColor = 'rgba(0,0,0,.7)'; g.shadowBlur = 6;
    g.font = `600 15px ${FONT}`; g.fillStyle = '#e8c060'; g.fillText(`HOOFDSTUK ${C.id}`, W / 2, 22);
    g.font = `700 36px ${FONT}`; g.fillStyle = '#fff'; g.fillText(C.name, W / 2, 56);
    g.font = `500 17px ${FONT}`; g.fillStyle = '#e8e0f0'; g.fillText(C.sub, W / 2, 78); g.shadowBlur = 0;
    // pijlen
    for (const d of [-1, 1]) {
      const ci = ch + d; if (ci < 0 || ci >= CHAPTERS.length) continue; const a = arrowPos(d), lk = !chapterOpen(ci), hv = hover && hover.k === 'arrow' && hover.d === d;
      const sh = shake.k === 'arrow' + ci && T - shake.t < 0.4 ? Math.sin((T - shake.t) * 50) * 5 : 0;
      g.save(); g.translate(a.x + sh, a.y + (hv ? -2 : 0)); g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.arc(2, 4, 31, 0, TAU); g.fill();
      g.fillStyle = LG(g, 0, -30, 0, 30, lk ? ['#7a8094', '#4a4f60'] : hv ? ['#fff0a0', '#f0b030'] : ['#ffe27a', '#d8962a']); g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill(); g.strokeStyle = 'rgba(40,24,6,.8)'; g.lineWidth = 3; g.stroke();
      g.fillStyle = lk ? '#2a2e3a' : '#3a2208'; g.beginPath(); g.moveTo(d * 10, 0); g.lineTo(-d * 7, -14); g.lineTo(-d * 7, -5); g.lineTo(-d * 14, -5); g.lineTo(-d * 14, 5); g.lineTo(-d * 7, 5); g.lineTo(-d * 7, 14); g.closePath(); g.fill();
      if (lk) padlock(g, 18, 20, 0.6);
      g.restore();
    }
    // tabbolletjes
    for (let i = 0; i < CHAPTERS.length; i++) {
      const q = dotPos(i), lk = !chapterOpen(i), cur = i === ch, hv = hover && hover.k === 'dot' && hover.i === i;
      g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.arc(q.x + 1, q.y + 2, 10, 0, TAU); g.fill();
      g.fillStyle = cur ? '#ffe27a' : lk ? '#4a4f60' : hv ? '#fff' : '#c8c0d8'; g.beginPath(); g.arc(q.x, q.y, cur ? 10 : 8, 0, TAU); g.fill(); g.strokeStyle = 'rgba(20,12,30,.85)'; g.lineWidth = 2; g.stroke();
      if (lk) { g.fillStyle = '#9aa0b4'; g.fillRect(q.x - 3.5, q.y - 1, 7, 5); g.strokeStyle = '#9aa0b4'; g.lineWidth = 1.6; g.beginPath(); g.arc(q.x, q.y - 1, 2.6, Math.PI, 0); g.stroke(); }
      else if (!cur) { g.fillStyle = 'rgba(20,12,30,.7)'; g.font = `700 11px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(i + 1), q.x, q.y + 1); }
    }
    if (!open) {
      g.fillStyle = 'rgba(8,8,20,.5)'; g.fillRect(0, 90, W, H - 90); padlock(g, W / 2, H / 2 - 40, 3.2);
      g.font = `700 32px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.shadowColor = '#000'; g.shadowBlur = 8; g.fillText('Haal eerst het vorige hoofdstuk', W / 2, H / 2 + 60); g.shadowBlur = 0;
    }
  }

  function render(now) {
    const t = now / 1000; const dt = Math.min(0.05, Math.max(0, t - last)); last = t; T = t;
    if (!alive) return;
    if (T - stT > 0.3) { readState(); if (!walk) placeTeun(false); }
    const L = layers(ch), g = ctx;
    // Te-Un loopt naar een nieuw doel of naar een gekozen gebouw
    if (walk) {
      const u = clamp((T - walk.t0) / walk.dur, 0, 1), e = ease(u); teun.x = lerp(walk.fx, walk.tx, e); teun.y = lerp(walk.fy, walk.ty, e); teun.alpha = u > 0.8 ? 1 - (u - 0.8) / 0.2 : 1;
      if (u >= 1 && !walk.done) { walk.done = true; const n = lvl(walk.i); walk = null; teun.alpha = 0; teun.x = L.slots[sel].x; sfx('click'); try { opts.onPick && opts.onPick(n); } catch (e2) { console.error(e2); } teun.mv = null; teun.idx = -1; placeTeun(true); teun.alpha = 0; }
    } else if (teun.mv) {
      const dx = teun.mv.x - teun.x, dy = teun.mv.y - teun.y, d = Math.hypot(dx, dy), sp = 300 * dt; if (d <= sp) { teun.x = teun.mv.x; teun.y = teun.mv.y; teun.mv = null; teun.face = -1; } else { teun.x += dx / d * sp; teun.y += dy / d * sp; teun.face = dx >= 0 ? 1 : -1; }
    }
    if (!walk && teun.alpha < 1) teun.alpha = Math.min(1, teun.alpha + dt * 2.5);

    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.drawImage(L.bg, 0, 0);
    g.setTransform(kx, 0, 0, ky, 0, 0);
    L.paintDynBack(g, T);
    // gebouwen + bewegende dingen op volgorde van diepte
    const items = [];
    for (let i = 0; i < 5; i++) items.push({ y: L.slots[i].y, i });
    for (const a of L.actors) items.push({ y: a.y(T), a });
    items.push({ y: teun.y + 0.5, teun: true });
    items.sort((a, b) => a.y - b.y);
    const target = targetIdx(), selIdx = kbd ? sel : -1;
    for (const it of items) {
      if (it.a) { it.a.draw(g, T); continue; }
      if (it.teun) {
        if (teun.alpha > 0.01) { softShadow(g, teun.x + 4, teun.y, 16, 5, 0.35 * teun.alpha); const moving = walk || teun.mv; drawTeUn(g, { x: teun.x, y: teun.y, s: 1.05, face: teun.face, walk: T * 14, t: T, outfit: 'classic', pose: moving ? 'walk' : 'stand', alpha: teun.alpha }); }
        continue;
      }
      const i = it.i, sl = L.slots[i], s = st[i], lk = !s.unlocked, hv = (hover && hover.k === 'b' && hover.i === i) || selIdx === i || (walk && walk.i === i);
      let sh = 0; if (shake.k === 'b' + i && T - shake.t < 0.45) sh = Math.sin((T - shake.t) * 46) * 6 * (1 - (T - shake.t) / 0.45);
      sl.hv = lerp(sl.hv || 0, hv ? 1 : 0, Math.min(1, dt * 14));
      const lift = -sl.hv * 7 - (hv ? Math.abs(Math.sin(T * 6)) * 2.5 : 0);
      // gloed onder het gebouw
      if (s.done && !lk) { const p = 0.75 + Math.sin(T * 2 + i) * 0.25; g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.55 * p; g.drawImage(glowSprite('#ffd860'), sl.x - sl.hw * sl.s * 1.3, sl.y - sl.up * sl.s * 0.85, sl.hw * sl.s * 2.6, sl.up * sl.s * 1.25); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (sl.hv > 0.02 && !lk) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.5 * sl.hv; g.drawImage(glowSprite('#fff2b0'), sl.x - sl.hw * sl.s * 1.45, sl.y - sl.up * sl.s * 0.95, sl.hw * sl.s * 2.9, sl.up * sl.s * 1.4); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      const sp = lk ? L.locked[i] : L.sprites[i], bb = sl.bb, S = sl.s * (1 + sl.hv * 0.03);
      g.drawImage(sp, sl.x + sh - bb[0] * S, sl.y + lift - bb[2] * S, (bb[0] + bb[1]) * S, (bb[2] + bb[3]) * S);
      if (sl.hv > 0.02 && !lk) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.16 * sl.hv; g.drawImage(sp, sl.x + sh - bb[0] * S, sl.y + lift - bb[2] * S, (bb[0] + bb[1]) * S, (bb[2] + bb[3]) * S); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
      if (sl.spec.anim) { g.save(); g.translate(sl.x + sh, sl.y + lift); g.scale(S, S); sl.spec.anim(g, T, L.night, lk); g.restore(); }
      if (lk) padlock(g, sl.x + sh, sl.y - sl.up * sl.s * 0.45, 1.5 * sl.s + 0.4);
      if (s.done && !lk) { for (let k = 0; k < 3; k++) { const ph = (T * 0.8 + k / 3 + i * 0.2) % 1, px = sl.x + Math.sin(k * 2.4 + i) * sl.hw * sl.s * 0.8, py = sl.y - sl.up * sl.s * (0.3 + 0.6 * ((k * 0.37 + i * 0.13) % 1)) - ph * 12; g.fillStyle = `rgba(255,236,140,${Math.sin(ph * Math.PI)})`; star5(g, px, py, 2 + Math.sin(ph * Math.PI) * 4); g.fill(); } }
    }
    // wijzer boven het volgende level
    if (!walk && st[target] && st[target].unlocked && !st[target].done) { const sl = L.slots[target], by = sl.y - sl.up * sl.s - 22 + Math.sin(T * 4) * 6; g.fillStyle = '#ffe27a'; g.strokeStyle = 'rgba(60,30,0,.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(sl.x, by + 18); g.lineTo(sl.x - 15, by); g.lineTo(sl.x - 6, by); g.lineTo(sl.x - 6, by - 14); g.lineTo(sl.x + 6, by - 14); g.lineTo(sl.x + 6, by); g.lineTo(sl.x + 15, by); g.closePath(); g.stroke(); g.fill(); }
    L.paintDynFront(g, T);
    g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(L.fg, 0, 0); g.drawImage(L.over, 0, 0);
    g.setTransform(kx, 0, 0, ky, 0, 0);
    L.paintLights(g, T);
    // naamplaatjes en interface
    for (let i = 0; i < 5; i++) { const hv = (hover && hover.k === 'b' && hover.i === i) || (kbd && sel === i); drawPlate(g, L, i, { hot: hv, lift: -L.slots[i].hv * 3 }); }
    drawUI(g, L);
    // tooltip
    let tp = null;
    if (!walk) {
      if (hover && hover.k === 'b') { const i = hover.i, sl = L.slots[i], m = LEVELS[lvl(i) - 1]; tp = { x: sl.x, y: sl.y - sl.up * sl.s, title: m.name, sub: m.sub, extra: st[i].unlocked ? '' : (chapterOpen(ch) ? 'Haal eerst het vorige level' : 'Haal eerst het vorige hoofdstuk') }; }
      else if (kbd) { const sl = L.slots[sel], m = LEVELS[lvl(sel) - 1]; tp = { x: sl.x, y: sl.y - sl.up * sl.s, title: m.name, sub: m.sub, extra: st[sel].unlocked ? '' : 'Haal eerst het vorige level' }; }
      else if (hover && (hover.k === 'arrow' || hover.k === 'dot')) { const c2 = CHAPTERS[hover.i]; const a = hover.k === 'arrow' ? arrowPos(hover.d) : dotPos(hover.i); tp = { x: a.x, y: hover.k === 'arrow' ? a.y - 30 : a.y - 14, title: c2.name, sub: c2.sub, extra: chapterOpen(hover.i) ? '' : 'Haal eerst het vorige hoofdstuk' }; if (hover.k === 'arrow' && hover.d < 0) tp.x += 120; if (hover.k === 'arrow' && hover.d > 0) tp.x -= 120; }
      else if (tip && tip.until > T) { const sl = tip.i != null ? L.slots[tip.i] : null; tp = { x: sl ? sl.x : W / 2, y: sl ? sl.y - sl.up * sl.s : H / 2 - 100, title: tip.text, sub: '', extra: '' }; }
    }
    if (tp) { const a = clamp((T - tipT) * 8, 0, 1); g.globalAlpha = a; drawTip(g, tp.x, tp.y + (1 - a) * 6, tp.title, tp.sub, tp.extra); g.globalAlpha = 1; }
    // overgang tussen hoofdstukken
    if (snap && T - snapT < 0.4) { g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1 - (T - snapT) / 0.4; g.drawImage(snap, 0, 0); g.globalAlpha = 1; } else if (snap) snap = null;
  }
  function loop(now) { if (!alive) return; raf = requestAnimationFrame(loop); try { render(now); } catch (e) { console.error('citymap', e); } }
  raf = requestAnimationFrame(loop);

  return {
    setChapter(i) {
      i = clamp(i | 0, 0, CHAPTERS.length - 1); if (i === ch) { readState(); return; }
      try { snap = mk(canvas.width, canvas.height); snap.getContext('2d').drawImage(canvas, 0, 0); snapT = performance.now() / 1000; } catch (e) { snap = null; }
      ch = i; hover = null; walk = null; tip = null; readState(); placeTeun(true); canvas.style.cursor = '';
    },
    refresh() { readState(); placeTeun(false); },
    resize() { resizeCanvasSizes(); caches.clear(); snap = null; },
    destroy() { alive = false; cancelAnimationFrame(raf); canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('pointercancel', onLeave); window.removeEventListener('keydown', onKey); canvas.style.cursor = ''; },
  };
}

// ---------------------------------------------------------------- stad bouwen: statische lagen, sprites, bewegende dingen
function buildCity(city, cw, chh, chIdx) {
  const cfg = CITY[city], kx = cw / W, ky = chh / H;
  const R = RNG(1000 + chIdx * 77);
  const mkLayer = () => { const c = mk(cw, chh); const g = c.getContext('2d'); g.setTransform(kx, 0, 0, ky, 0, 0); return [c, g]; };
  const [bg, gb] = mkLayer(), [fg, gf] = mkLayer(), [over, go] = mkLayer();
  const world = { R, glints: [], lights: [], actors: [], back: [], front: [], night: cfg.night, slots: [], flags: [] };
  cfg.paint(gb, R, world);
  cfg.paintFront(gf, RNG(2000 + chIdx), world);
  // sfeerlaag: kleurwas + vignet
  go.fillStyle = LG(go, 0, 0, 0, H, cfg.wash); go.fillRect(0, 0, W, H);
  go.fillStyle = RG(go, W / 2, H / 2, H * 0.42, W * 0.72, ['rgba(0,0,0,0)', `rgba(0,0,0,${cfg.vig})`], W / 2, H / 2); go.fillRect(0, 0, W, H);
  // gebouwen: sprites
  const slots = [], sprites = [], locked = [], plates = [];
  const tg = mk(10, 10).getContext('2d');
  CHAPTERS[chIdx].levels.forEach((n, i) => {
    const sd = cfg.slots[i], spec = BUILD[sd.kind], bb = spec.bb, hw = spec.hw;
    const k = Math.max(kx, ky) * sd.s * 1.0, sw = (bb[0] + bb[1]) * k, sh = (bb[2] + bb[3]) * k;
    const c = mk(sw, sh), g = c.getContext('2d'); g.translate(bb[0] * k, bb[2] * k); g.scale(k, k);
    spec.draw(g, RNG(500 + n * 31), { night: cfg.night, color: sd.color, v: sd.v });
    // tint
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.fillStyle = cfg.spriteTint; g.fillRect(0, 0, c.width, c.height);
    sprites.push(c);
    const l = mk(c.width, c.height), lg2 = l.getContext('2d'); lg2.drawImage(c, 0, 0); lg2.globalCompositeOperation = 'saturation'; lg2.fillStyle = '#707070'; lg2.fillRect(0, 0, l.width, l.height); lg2.globalCompositeOperation = 'destination-in'; lg2.drawImage(c, 0, 0); lg2.globalCompositeOperation = 'source-atop'; lg2.fillStyle = 'rgba(14,18,40,.5)'; lg2.fillRect(0, 0, l.width, l.height); locked.push(l);
    slots.push({ x: sd.x, y: sd.y, s: sd.s, bb, hw, up: spec.up, spec, hv: 0 });
    // naamplaatje: 1 of 2 regels
    tg.font = `600 19px ${FONT}`; const nm = LEVELS[n - 1].name; let lines = [nm]; if (tg.measureText(nm).width > 200) lines = wrapText(tg, nm, 200).slice(0, 3);
    const tw = Math.max(...lines.map((s2) => tg.measureText(s2).width)); const pw = Math.max(170, Math.min(270, tw + 70));
    plates.push({ lines, w: pw, h: 20 + lines.length * 21 + 24 });
    if (spec.lights) for (const L2 of spec.lights) world.lights.push({ x: sd.x + L2[0] * sd.s, y: sd.y + L2[1] * sd.s, r: L2[2] * sd.s, c: L2[3], a: L2[4], fl: L2[5] || 0, ph: R() * 9, night: true });
  });
  world.slots = slots;
  const lights = world.lights;
  return {
    bg, fg, over, slots, sprites, locked, plates, night: cfg.night, actors: world.actors,
    paintDynBack(g, t) { for (const f of world.back) f(g, t); },
    paintDynFront(g, t) { for (const f of world.front) f(g, t); },
    paintLights(g, t) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (const l of lights) { const fl = l.fl ? 0.8 + Math.sin(t * (7 + l.ph) + l.ph) * 0.12 * l.fl + Math.sin(t * 23 + l.ph * 3) * 0.08 * l.fl : 1; g.globalAlpha = clamp(l.a * fl, 0, 1); g.drawImage(glowSprite(l.c), l.x - l.r, l.y - l.r, l.r * 2, l.r * 2); }
      g.restore();
    },
  };
}
