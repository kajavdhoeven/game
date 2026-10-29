// Tekenen: een mossige tempel, plassen, deuren en de twee kabouters. Alles wordt met canvas getekend, er zijn geen plaatjes nodig.
import { W, H } from './levels.js';

export const TS = 32; // pixels per tegel
export const CW = W * TS, CH = H * TS;

const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

// de vaste laag (muren + achtergrond) wordt per level 1 keer gemaakt
export function buildStatic(level) {
  const cv = document.createElement('canvas');
  cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d');
  // achtergrond: donkere tempelmuur met stenen
  const bg = g.createLinearGradient(0, 0, 0, CH);
  bg.addColorStop(0, '#1d2a22'); bg.addColorStop(1, '#2a3a2c');
  g.fillStyle = bg; g.fillRect(0, 0, CW, CH);
  for (let y = 0; y < H * 2; y++) for (let x = 0; x < W * 2; x++) {
    const px = x * TS / 2 + (y % 2 ? TS / 4 : 0), py = y * TS / 2;
    const r = hash(x, y);
    g.fillStyle = `rgba(${40 + r * 24 | 0},${58 + r * 28 | 0},${44 + r * 18 | 0},0.55)`;
    g.fillRect(px + 1, py + 1, TS / 2 - 2, TS / 2 - 2);
  }
  // muren
  const solid = (x, y) => x < 0 || x >= W || y < 0 || y >= H || level.grid[y * W + x] === 1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!solid(x, y)) continue;
    const px = x * TS, py = y * TS, r = hash(x, y);
    g.fillStyle = `rgb(${78 + r * 18 | 0},${84 + r * 18 | 0},${70 + r * 14 | 0})`;
    g.fillRect(px, py, TS, TS);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(px, py + TS - 3, TS, 3); g.fillRect(px + TS - 3, py, 3, TS);
    g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(px, py, TS, 2); g.fillRect(px, py, 2, TS);
    // barstjes
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(px + TS * (0.3 + r * 0.4), py + 4); g.lineTo(px + TS * (0.4 + r * 0.3), py + TS * 0.55); g.stroke();
    // mos op de bovenkant
    if (!solid(x, y - 1)) {
      g.fillStyle = '#5fae3c';
      g.beginPath(); g.moveTo(px, py);
      for (let i = 0; i <= 6; i++) g.lineTo(px + i * TS / 6, py + 3 + hash(x * 7 + i, y) * 7);
      g.lineTo(px + TS, py); g.closePath(); g.fill();
      g.fillStyle = '#88d055'; g.fillRect(px, py, TS, 2.5);
    }
    if (!solid(x, y + 1) && hash(x + 3, y) > 0.55) {
      g.fillStyle = '#4c9534'; g.fillRect(px + TS * 0.3, py + TS, 3, 5 + hash(x, y + 5) * 8);
    }
  }
  return cv;
}

// ---------------------------------------------------------------- losse onderdelen
function drawLiquid(g, l, t) {
  const x = l.x * TS, y = l.y * TS, w = l.w * TS;
  const col = { lava: ['#ff5a1a', '#ffb02e', '#a31d05'], water: ['#3b8cff', '#8fd0ff', '#1a4fa3'], goo: ['#4fc247', '#a9ec6c', '#2a7a2a'] }[l.type];
  const grd = g.createLinearGradient(0, y, 0, y + TS);
  grd.addColorStop(0, col[1]); grd.addColorStop(0.25, col[0]); grd.addColorStop(1, col[2]);
  g.fillStyle = grd;
  g.beginPath(); g.moveTo(x, y + TS);
  g.lineTo(x, y + 6);
  for (let i = 0; i <= w; i += 4) g.lineTo(x + i, y + 6 + Math.sin(t * 3 + (x + i) * 0.12) * 2.5);
  g.lineTo(x + w, y + TS); g.closePath(); g.fill();
  // belletjes
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (let i = 0; i < l.w * 2; i++) {
    const ph = (t * 0.6 + hash(l.x + i, l.y) * 5) % 1;
    g.beginPath(); g.arc(x + (i + 0.5) * TS / 2 + Math.sin(ph * 6 + i) * 3, y + TS - ph * (TS - 8), 1.5 + hash(i, l.x) * 1.5, 0, 7); g.fill();
  }
  g.fillStyle = col[1]; g.globalAlpha = 0.5; g.fillRect(x, y + 5, w, 2); g.globalAlpha = 1;
}

function drawDoor(g, d, kind, open, t) {
  const x = d.x * TS, y = d.y * TS; // y is de vloer: de deur staat erboven
  const w = 2 * TS, h = 2.2 * TS;
  const c = kind === 'fire' ? ['#ff7a2e', '#ffd05a', '#7a1d06'] : ['#3b8cff', '#9fdcff', '#123a7a'];
  g.save(); g.translate(x, y - h);
  g.fillStyle = '#0a0e0c'; g.beginPath(); g.moveTo(4, h); g.lineTo(4, 26); g.quadraticCurveTo(4, 2, w / 2, 2); g.quadraticCurveTo(w - 4, 2, w - 4, 26); g.lineTo(w - 4, h); g.closePath(); g.fill();
  if (open) { const gl = g.createRadialGradient(w / 2, h * 0.55, 4, w / 2, h * 0.55, w * 0.7); gl.addColorStop(0, c[1]); gl.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gl; g.globalAlpha = 0.6 + Math.sin(t * 6) * 0.1; g.fillRect(0, 0, w, h); g.globalAlpha = 1; }
  g.lineWidth = 5; g.strokeStyle = c[0]; g.beginPath(); g.moveTo(4, h); g.lineTo(4, 26); g.quadraticCurveTo(4, 2, w / 2, 2); g.quadraticCurveTo(w - 4, 2, w - 4, 26); g.lineTo(w - 4, h); g.stroke();
  g.lineWidth = 2; g.strokeStyle = c[1]; g.stroke();
  // symbool
  g.translate(w / 2, h * 0.42);
  g.fillStyle = c[0]; g.strokeStyle = c[1]; g.lineWidth = 2;
  g.beginPath();
  if (kind === 'fire') {
    g.moveTo(0, -18); g.bezierCurveTo(14, -4, 14, 12, 0, 16); g.bezierCurveTo(-14, 12, -12, -2, 0, -18);
  } else {
    g.moveTo(0, -18); g.bezierCurveTo(6, -6, 14, 2, 14, 8); g.arc(0, 8, 14, 0, Math.PI); g.bezierCurveTo(-14, 2, -6, -6, 0, -18);
  }
  g.fill(); g.stroke();
  g.restore();
}

function drawGem(g, gm, t) {
  const x = gm.x * TS, y = gm.y * TS + Math.sin(t * 3 + gm.x) * 2.5;
  const c = gm.type === 'red' ? ['#ff4a3a', '#ffb0a0', '#9a1408'] : ['#38a6ff', '#b4e3ff', '#0d4a9a'];
  g.save(); g.translate(x, y);
  g.shadowColor = c[0]; g.shadowBlur = 10;
  g.fillStyle = c[0]; g.beginPath(); g.moveTo(0, -11); g.lineTo(9, -3); g.lineTo(0, 11); g.lineTo(-9, -3); g.closePath(); g.fill();
  g.shadowBlur = 0;
  g.fillStyle = c[1]; g.beginPath(); g.moveTo(0, -11); g.lineTo(9, -3); g.lineTo(0, -3); g.closePath(); g.fill();
  g.fillStyle = c[2]; g.beginPath(); g.moveTo(0, -3); g.lineTo(9, -3); g.lineTo(0, 11); g.closePath(); g.fill();
  g.restore();
}

function drawGate(g, gt) {
  const x = gt.x * TS, top = gt.y * TS, full = gt.h * TS;
  const hh = full * (1 - gt.open);
  if (hh < 2) return;
  g.fillStyle = '#2c3330'; g.fillRect(x + 2, top, TS - 4, hh);
  g.fillStyle = gt.color; g.fillRect(x + 6, top, TS - 12, hh);
  g.fillStyle = 'rgba(0,0,0,.3)';
  for (let y = 0; y < hh; y += 12) g.fillRect(x + 6, top + y, TS - 12, 2);
  g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x + 8, top, 3, hh);
  g.fillStyle = '#1a1f1d'; g.fillRect(x, top + hh - 5, TS, 5);
}

function drawButton(g, b, down) {
  const x = b.x * TS, y = (b.y + 1) * TS;
  g.fillStyle = '#2c3330'; g.fillRect(x + 2, y - 4, TS - 4, 4);
  g.fillStyle = b.color; g.beginPath(); g.roundRect(x + 5, y - (down ? 5 : 10), TS - 10, down ? 3 : 8, 3); g.fill();
  g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + 8, y - (down ? 5 : 10), TS - 16, 2);
}

function drawLever(g, lv, state, color) {
  const x = (lv.x + 0.5) * TS, y = (lv.y + 1) * TS;
  g.fillStyle = '#2c3330'; g.beginPath(); g.roundRect(x - 13, y - 7, 26, 7, 3); g.fill();
  g.strokeStyle = '#d9d2c0'; g.lineWidth = 5; g.lineCap = 'round';
  const a = state ? 0.9 : -0.9;
  g.beginPath(); g.moveTo(x, y - 7); g.lineTo(x + Math.sin(a) * 22, y - 7 - Math.cos(a) * 22); g.stroke();
  g.fillStyle = color; g.beginPath(); g.arc(x + Math.sin(a) * 22, y - 7 - Math.cos(a) * 22, 5.5, 0, 7); g.fill();
}

function drawBridge(g, b, t) {
  const cells = Math.round(b.p * b.len);
  for (let i = 0; i < b.len; i++) {
    const x = (b.x + i * b.dir) * TS, y = b.y * TS;
    if (i < cells) {
      g.fillStyle = '#9a6a38'; g.fillRect(x, y, TS, 9);
      g.fillStyle = '#c28b4e'; g.fillRect(x, y, TS, 3);
      g.fillStyle = '#5d3c20'; g.fillRect(x + 2, y + 6, TS - 4, 3);
      g.fillStyle = b.color; g.fillRect(x, y + 9, TS, 3);
    } else { // de plek waar de brug uitschuift: een gekleurd streepje
      g.fillStyle = b.color; g.globalAlpha = 0.45; g.fillRect(x + 4, y + 1, TS - 8, 3); g.globalAlpha = 1;
    }
  }
}

function drawCrate(g, c) {
  if (c.dead > 0) return;
  const w = 1.1 * TS, h = 1.2 * TS, x = c.x * TS - w / 2, y = c.y * TS - h;
  g.fillStyle = '#b07a3e'; g.fillRect(x, y, w, h);
  g.strokeStyle = '#5d3c20'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  g.beginPath(); g.moveTo(x + 3, y + 3); g.lineTo(x + w - 3, y + h - 3); g.moveTo(x + w - 3, y + 3); g.lineTo(x + 3, y + h - 3); g.stroke();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 3, y + 3, w - 6, 3);
}

function drawPlank(g, p, t) {
  const px = p.x * TS, py = p.y * TS;
  const wob = p.spin > 0 ? 0 : Math.sin(t * 1.6 + p.x) * 0.02;
  g.strokeStyle = '#6b6f73'; g.lineWidth = 3; g.setLineDash([6, 4]);
  g.beginPath(); g.moveTo(px, p.anchor * TS); g.lineTo(px, py + 4); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#4a4f55'; g.beginPath(); g.arc(px, p.anchor * TS + 2, 5, 0, 7); g.fill();
  g.save(); g.translate(px, py + 4); g.rotate(p.theta + wob);
  const hl = p.hl * TS;
  g.fillStyle = '#a97a44'; g.beginPath(); g.roundRect(-hl, -5, hl * 2, 10, 3); g.fill();
  g.fillStyle = '#c99b62'; g.fillRect(-hl + 3, -5, hl * 2 - 6, 3);
  g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(-hl + 2, 2, hl * 2 - 4, 3);
  g.fillStyle = '#4a4f55'; g.beginPath(); g.arc(0, 0, 5, 0, 7); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- de kabouters
// fire = Vuur-Te-Un (rode muts met vlam, witte baard), water = Water-Te-Un (blauwe muts met druppel, vlechtjes, jurk)
function drawGnome(g, c, t) {
  const fire = c.kind === 'fire';
  const px = c.x * TS, py = c.y * TS;
  const moving = Math.abs(c.vx) > 0.5 && c.grounded;
  const bob = moving ? Math.abs(Math.sin(c.walk * 3)) * 2 : 0;
  const air = !c.grounded;
  const main = fire ? '#e8422a' : '#2f7fe0', dark = fire ? '#9c200f' : '#1a4c9a', light = fire ? '#ff9a4a' : '#7cc2ff';
  g.save();
  g.translate(px, py);
  g.scale(c.face >= 0 ? 1 : -1, 1);
  if (c.dead) { g.rotate(0.5); g.globalAlpha = 0.85; }
  // voeten
  const sw = moving ? Math.sin(c.walk * 3) * 6 : 0;
  g.fillStyle = '#3a2a1c';
  g.beginPath(); g.ellipse(-6 + sw, -3 - (air ? 3 : 0), 7, 4.5, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(6 - sw, -3 - (air ? 1 : 0), 7, 4.5, 0, 0, 7); g.fill();
  g.translate(0, -bob);
  // lichaam
  g.fillStyle = main;
  g.beginPath();
  if (fire) { g.roundRect(-12, -30, 24, 24, 8); }
  else { g.moveTo(-8, -32); g.lineTo(8, -32); g.lineTo(15, -7); g.lineTo(-15, -7); g.closePath(); }
  g.fill();
  g.fillStyle = dark; g.fillRect(-12, -17, 24, 3);
  if (!fire) { g.fillStyle = light; g.beginPath(); g.arc(0, -22, 3, 0, 7); g.fill(); }
  // armen
  g.fillStyle = main;
  const armUp = air ? -6 : 0;
  g.beginPath(); g.ellipse(-13, -22 + armUp + (moving ? -sw * 0.4 : 0), 4.5, 6.5, 0.2, 0, 7); g.fill();
  g.beginPath(); g.ellipse(13, -22 + armUp + (moving ? sw * 0.4 : 0), 4.5, 6.5, -0.2, 0, 7); g.fill();
  // hoofd
  g.fillStyle = '#ffd7b0'; g.beginPath(); g.arc(0, -39, 12, 0, 7); g.fill();
  // vlechtjes of baard
  if (fire) {
    g.fillStyle = '#f4f1ea';
    g.beginPath(); g.moveTo(-11, -38); g.quadraticCurveTo(-12, -22, 0, -20); g.quadraticCurveTo(12, -22, 11, -38); g.quadraticCurveTo(0, -31, -11, -38); g.fill();
  } else {
    g.fillStyle = '#c9772c';
    for (const s of [-1, 1]) {
      g.beginPath(); g.ellipse(s * 13, -33, 4, 5, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(s * 14, -25, 3.6, 4.6, 0, 0, 7); g.fill();
      g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(s * 13.5, -29, 2.4, 0, 7); g.fill(); g.fillStyle = '#c9772c';
    }
  }
  // gezicht
  g.fillStyle = '#1b1b1b';
  const blink = (Math.floor(t * 0.7 + c.x) % 5 === 0) && (t * 0.7 % 1) < 0.1;
  if (blink) { g.fillRect(2, -42, 5, 1.5); g.fillRect(-7, -42, 5, 1.5); }
  else { g.beginPath(); g.arc(4.5, -42, 2.2, 0, 7); g.arc(-4, -42, 2.2, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,120,120,.5)'; g.beginPath(); g.arc(8, -37, 2.5, 0, 7); g.arc(-8, -37, 2.5, 0, 7); g.fill();
  if (!fire) { g.strokeStyle = '#7a3a2a'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -38, 4, 0.2, 2.9); g.stroke(); }
  else { g.fillStyle = '#e9a0a0'; g.beginPath(); g.arc(0, -37, 2, 0, 7); g.fill(); }
  // muts
  g.fillStyle = main;
  g.beginPath(); g.moveTo(-14, -46); g.quadraticCurveTo(-8, -54, 0, -66 + Math.sin(t * 4) * 0.8); g.quadraticCurveTo(8, -54, 14, -46); g.quadraticCurveTo(0, -42, -14, -46); g.fill();
  g.fillStyle = dark; g.beginPath(); g.ellipse(0, -45.5, 15, 3.4, 0, 0, 7); g.fill();
  // sieraad: vlam of druppel
  g.save(); g.translate(0, -66);
  if (fire) {
    const f = 1 + Math.sin(t * 12) * 0.12;
    g.fillStyle = '#ffb02e'; g.beginPath(); g.moveTo(0, -12 * f); g.bezierCurveTo(8, -3, 6, 4, 0, 4); g.bezierCurveTo(-7, 4, -7, -3, 0, -12 * f); g.fill();
    g.fillStyle = '#fff2a8'; g.beginPath(); g.moveTo(0, -5); g.bezierCurveTo(4, -1, 3, 3, 0, 3); g.bezierCurveTo(-3, 3, -3, -1, 0, -5); g.fill();
  } else {
    g.fillStyle = '#9fe0ff'; g.beginPath(); g.moveTo(0, -11); g.bezierCurveTo(7, -2, 7, 3, 0, 4); g.bezierCurveTo(-7, 3, -7, -2, 0, -11); g.fill();
    g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(-2, -1, 1.5, 3, 0.3, 0, 7); g.fill();
  }
  g.restore();
  g.restore();
}

// ---------------------------------------------------------------- hele scene
export function drawScene(g, level, world, staticCv, t) {
  g.drawImage(staticCv, 0, 0);
  for (const l of level.liquids) drawLiquid(g, l, t);
  for (const k of ['fire', 'water']) drawDoor(g, level.doors[k], k, world.chars.find((c) => c.kind === k).atDoor, t);
  level.buttons.forEach((b, i) => drawButton(g, b, world.buttonDown[i]));
  level.levers.forEach((lv, i) => drawLever(g, lv, world.leverState[i], lv.color));
  for (const b of world.bridges) drawBridge(g, b, t);
  for (const gm of level.gems) if (!gm.got) drawGem(g, gm, t);
  for (const c of world.crates) drawCrate(g, c);
  for (const p of world.planks) drawPlank(g, p, t);
  for (const c of world.chars) drawGnome(g, c, t);
  world.gates.forEach((gt) => drawGate(g, gt));
}
