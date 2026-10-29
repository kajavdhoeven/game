// Tekenen: een gebouw in doorsnede met echte texturen (steen, hout, tegels, pleister met schade), schaduw en licht, kamers, deuren, ladders en trappen,
// de bewakers met hun lichtkegels en Te-Un als dief (zwart, met bivakmuts en handschoenen). Alles met canvas.
import { TS, W, H, Y, guardAt, laserOn, PICK_T, SWING_T } from './sim.js';
import { drawTeUn } from './chars.js';
import { drawProp } from './props.js';
import { hash2, shade, grain, blotches, bricks, plaster, wood, tiles, concrete, metal, wallpaper, stoneBlocks, mushroomWall, streak, crack } from './tex.js';
import { levelMeta } from './story.js';
export const CW = W * TS, CH = H * TS;
const hash = (x, y) => hash2(x, y, 0);
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const OUT = '#0d0f14';
const roomTop = (f) => (Y[f] - 4) * TS + 6;

// ---------------------------------------------------------------- wanden en vloeren per stijl
function paintWall(g, st, x, y, w, h, T, seed) {
  const dmg = st.damage;
  switch (st.wall) {
    case 'brick': bricks(g, x, y, w, h, T.wall, seed, { bw: 38, bh: 16 }); blotches(g, x, y, w, h, 12, 30, 80, '#1a1410', 0.22, seed); if (dmg > 0.3) plaster(g, x + 8, y, Math.min(w * 0.4, 150), h * 0.5, shade(T.wall, 0.2), T.wall2, seed + 4, dmg, { noPatch: true }); break;
    case 'wood': wood(g, x, y, w, h, T.wall, seed, { pw: 26 }); break;
    case 'panel': plaster(g, x, y, w, h * 0.55, T.wall, T.wall2, seed, dmg); wood(g, x, y + h * 0.55, w, h * 0.45, shade(T.wall, -0.25), seed + 2, { pw: 30 }); paneling(g, x, y + h * 0.55, w, h * 0.45, T); break;
    case 'tile': tiles(g, x, y, w, h * 0.62, shade(T.wall, 0), seed, { ts: 24, grout: shade(T.wall, -0.3) }); plaster(g, x, y + h * 0.62, w, h * 0.38, T.wall2, shade(T.wall2, -0.1), seed + 1, dmg, { noPatch: true }); break;
    case 'concrete': concrete(g, x, y, w, h, T.wall, seed, dmg); break;
    case 'paper': wallpaper(g, x, y, w, h, T.wall, seed, dmg, { damask: T.key === 'casino' || T.key === 'townhall' }); break;
    case 'stone': stoneBlocks(g, x, y, w, h, T.wall, seed, dmg); break;
    case 'metal': metal(g, x, y, w, h, T.wall, seed, dmg); break;
    case 'mush': mushroomWall(g, x, y, w, h, T.wall, T.wall2, seed, dmg); break;
    default: plaster(g, x, y, w, h, T.wall, T.wall2, seed, dmg);
  }
}
function paneling(g, x, y, w, h, T) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let xx = x + 8; xx < x + w - 30; xx += 62) { g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 2; g.strokeRect(xx, y + 8, 52, h - 20); g.strokeStyle = 'rgba(255,255,255,.14)'; g.strokeRect(xx + 2, y + 10, 52, h - 20); }
  g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x, y, w, 3); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y + 3, w, 2);
  g.restore();
}
function paintFloor(g, st, x, y, w, h, T, seed) {
  switch (st.floor) {
    case 'tile': tiles(g, x, y, w, h, T.floor, seed, { ts: 20, checker: true }); break;
    case 'carpet': g.fillStyle = T.floor; g.fillRect(x, y, w, h); blotches(g, x, y, w, h, 14, 10, 40, '#000', 0.25, seed); grain(g, x, y, w, h, 0.4); g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(x, y, w, 2); break;
    case 'concrete': concrete(g, x, y, w, h, shade(T.floor, 0.05), seed, 0.1); break;
    case 'stone': stoneBlocks(g, x, y, w, h, T.floor, seed, 0.3); break;
    default: wood(g, x, y, w, h, T.floor, seed, { pw: 36, horizontal: true });
  }
}

// ---------------------------------------------------------------- achtergrond: lucht, ver weg en de grond
function backdrop(g, L) {
  const T = L.theme, ext = levelMeta(L.n).ext, time = ext.time;
  const night = time === 'night', dusk = time === 'dusk';
  const sky = g.createLinearGradient(0, 0, 0, Y[0] * TS);
  if (night) { sky.addColorStop(0, '#070d1c'); sky.addColorStop(0.7, '#1a2c4a'); sky.addColorStop(1, '#2c4466'); }
  else if (dusk) { sky.addColorStop(0, '#2a2a5a'); sky.addColorStop(0.5, '#a8566a'); sky.addColorStop(1, '#f0a05a'); }
  else { sky.addColorStop(0, '#5a9ad8'); sky.addColorStop(1, '#bfe0f4'); }
  g.fillStyle = sky; g.fillRect(0, 0, CW, CH);
  if (night || dusk) { g.fillStyle = '#fff'; for (let i = 0; i < 70; i++) { g.globalAlpha = (0.25 + hash(i, 3) * 0.6) * (dusk ? 0.5 : 1); g.fillRect(hash(i, 1) * CW, hash(i, 2) * 300, 1.6 + hash(i, 4) * 1.2, 1.6 + hash(i, 4) * 1.2); } g.globalAlpha = 1; }
  // maan met gloed
  if (night) { const mx = 120 + hash(L.n, 9) * (CW - 240), my = 70 + hash(L.n, 8) * 40; const gl = g.createRadialGradient(mx, my, 6, mx, my, 90); gl.addColorStop(0, 'rgba(230,240,255,.55)'); gl.addColorStop(1, 'rgba(230,240,255,0)'); g.fillStyle = gl; g.fillRect(mx - 90, my - 90, 180, 180); g.fillStyle = '#eef4ff'; g.beginPath(); g.arc(mx, my, 20, 0, 7); g.fill(); g.fillStyle = 'rgba(160,180,210,.5)'; g.beginPath(); g.arc(mx - 6, my - 4, 5, 0, 7); g.arc(mx + 7, my + 6, 3.5, 0, 7); g.fill(); }
  // wolken
  g.fillStyle = night ? 'rgba(40,60,100,.35)' : dusk ? 'rgba(255,200,160,.35)' : 'rgba(255,255,255,.7)';
  for (let i = 0; i < 5; i++) { const cx = hash(i, 11 + L.n) * CW, cy = 60 + hash(i, 12) * 160; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(cx + k * 26, cy + Math.sin(k * 1.7) * 6, 34 + k * 3, 12, 0, 0, 7); g.fill(); } }
  // de verte: silhouetten passend bij de omgeving
  const far = night ? '#0c1626' : dusk ? '#3a2c4a' : '#6a8aa8', far2 = night ? '#101e34' : dusk ? '#4a3652' : '#8aa8c0';
  const gy = Y[0] * TS, key = ext.kind;
  const silh = (col, base, amp, step, seedk, fn) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= CW + step; x += step) { const hh = amp * (0.4 + hash(x / step | 0, seedk + L.n) * 0.8); fn(g, x, base, hh, step); } g.lineTo(CW, gy); g.closePath(); g.fill(); };
  const nature = ['mushroom', 'townhall', 'mushroombank', 'wreck', 'resort', 'castle'].includes(key);
  if (nature) {
    silh(far2, gy - 20, 120, 50, 1, (g2, x, b, hh) => { g2.lineTo(x, b - hh * 0.7); });
    g.fillStyle = far; for (let x = -10; x < CW + 40; x += 34 + hash(x, 5) * 16) { const hh = 50 + hash(x, 6) * 60; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 18, gy - hh); g.lineTo(x + 36, gy); g.fill(); }
  } else {
    // stad of skyline
    silh(far2, gy, 160, 46, 2, (g2, x, b, hh, st) => { g2.lineTo(x, b - hh); g2.lineTo(x + st, b - hh); });
    silh(far, gy, 110, 38, 3, (g2, x, b, hh, st) => { g2.lineTo(x, b - hh); g2.lineTo(x + st, b - hh); });
    // lichtjes in de gebouwen
    for (let i = 0; i < 90; i++) { g.fillStyle = night ? `rgba(255,${200 + (i % 3) * 20},120,${0.25 + hash(i, 5) * 0.5})` : 'rgba(255,255,255,.12)'; g.fillRect(hash(i, 1 + L.n) * CW, gy - 20 - hash(i, 2) * 150, 3, 4); }
  }
  // de grond
  const ground = ext.ground;
  if (['garden', 'grass', 'path', 'pond', 'jungle', 'square'].includes(ground)) {
    const gr = g.createLinearGradient(0, gy, 0, CH); gr.addColorStop(0, night ? '#1f3a22' : '#4a7a38'); gr.addColorStop(1, night ? '#0e2012' : '#2e5224'); g.fillStyle = gr; g.fillRect(0, gy, CW, CH - gy);
    for (let i = 0; i < 400; i++) { g.strokeStyle = shade(night ? '#2f5a34' : '#6aa04a', (hash(i, 7) - 0.5) * 0.4, 0.7); g.lineWidth = 1.2; const x = hash(i, 8) * CW, y = gy + 4 + hash(i, 9) * (CH - gy - 4); g.beginPath(); g.moveTo(x, y); g.lineTo(x + (hash(i, 10) - 0.5) * 4, y - 5 - hash(i, 11) * 6); g.stroke(); }
    grain(g, 0, gy, CW, CH - gy, 0.2);
  } else if (ground === 'beach') {
    const gr = g.createLinearGradient(0, gy, 0, CH); gr.addColorStop(0, '#d8c490'); gr.addColorStop(1, '#a89462'); g.fillStyle = gr; g.fillRect(0, gy, CW, CH - gy); grain(g, 0, gy, CW, CH - gy, 0.3);
  } else if (ground === 'harbor' || ground === 'canal') {
    const gr = g.createLinearGradient(0, gy, 0, CH); gr.addColorStop(0, '#6a5a44'); gr.addColorStop(1, '#3a2e20'); g.fillStyle = gr; g.fillRect(0, gy, CW, CH - gy); for (let x = 0; x < CW; x += 40) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, gy, 2, CH - gy); } grain(g, 0, gy, CW, CH - gy, 0.3);
  } else {
    // straat, parkeerplaats, binnenplaats: stoeptegels en asfalt
    tiles(g, 0, gy, CW, 26, night ? '#6a6a70' : '#a8a8ae', L.n, { ts: 26 });
    const as = g.createLinearGradient(0, gy + 26, 0, CH); as.addColorStop(0, '#2a2c32'); as.addColorStop(1, '#17181c'); g.fillStyle = as; g.fillRect(0, gy + 26, CW, CH - gy - 26); grain(g, 0, gy + 26, CW, CH - gy, 0.3);
    g.fillStyle = 'rgba(255,255,255,.55)'; for (let x = 20; x < CW; x += 120) g.fillRect(x, gy + 56, 56, 4);
    g.strokeStyle = 'rgba(255,255,255,.12)'; g.lineWidth = 1; for (let i = 0; i < 20; i++) { g.beginPath(); g.moveTo(hash(i, 1) * CW, gy + 30 + hash(i, 2) * 40); g.lineTo(hash(i, 1) * CW + 40 + hash(i, 3) * 60, gy + 30 + hash(i, 2) * 40 + hash(i, 4) * 6); g.stroke(); }
  }
  g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, gy, CW, 6);
}

// ---------------------------------------------------------------- dak: past bij het gebouw
function roof(g, L, bx0, bx1, topY) {
  const key = L.theme.key, cx = (bx0 + bx1) / 2;
  const slab = (c) => { g.fillStyle = c; g.fillRect(bx0 - 8, topY - 12, bx1 - bx0 + 16, 12); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(bx0 - 8, topY - 12, bx1 - bx0 + 16, 2); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx0 - 8, topY - 2, bx1 - bx0 + 16, 2); };
  if (key.startsWith('mushroom') || key === 'townhall' || key === 'mushbank') {
    const cap = key === 'mushroom1' ? '#d8362a' : key === 'mushroom2' ? '#3a6ad0' : key === 'mushroom3' ? '#b8802a' : key === 'townhall' ? '#d8362a' : '#2f9a5a';
    const gr = g.createLinearGradient(0, topY - 120, 0, topY); gr.addColorStop(0, shade(cap, 0.3)); gr.addColorStop(1, shade(cap, -0.35));
    g.fillStyle = gr; g.beginPath(); g.moveTo(bx0 - 70, topY - 4); g.bezierCurveTo(bx0 - 70, topY - 150, bx1 + 70, topY - 150, bx1 + 70, topY - 4); g.closePath(); g.fill();
    g.save(); g.beginPath(); g.moveTo(bx0 - 70, topY - 4); g.bezierCurveTo(bx0 - 70, topY - 150, bx1 + 70, topY - 150, bx1 + 70, topY - 4); g.closePath(); g.clip();
    g.fillStyle = 'rgba(255,248,230,.92)'; for (let i = 0; i < 9; i++) { const dx = bx0 - 40 + hash(i, 5 + L.n) * (bx1 - bx0 + 80), dy = topY - 20 - hash(i, 6) * 95, r = 9 + hash(i, 7) * 15; g.beginPath(); g.ellipse(dx, dy, r, r * 0.8, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(dx + 2, dy + 3, r * 0.8, r * 0.6, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,248,230,.92)'; }
    g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(cx - 160, topY - 90, 160, 30, -0.2, 0, 7); g.fill(); g.restore();
    g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(bx0 - 70, topY - 6, bx1 - bx0 + 140, 6);
    g.fillStyle = '#e8dcc0'; g.fillRect(bx0 - 8, topY - 8, bx1 - bx0 + 16, 8); // het "steeltje" onder de hoed
    return;
  }
  if (['chinese', 'hutong', 'teashop', 'bankchina'].includes(key)) {
    slab('#3a2a22');
    const tile = key === 'bankchina' ? '#a8322a' : '#5a6a72';
    g.fillStyle = shade(tile, -0.1); g.beginPath(); g.moveTo(bx0 - 50, topY - 8); g.quadraticCurveTo(bx0 - 20, topY - 16, bx0 + 20, topY - 52); g.lineTo(bx1 - 20, topY - 52); g.quadraticCurveTo(bx1 + 20, topY - 16, bx1 + 50, topY - 8); g.lineTo(bx1 + 30, topY - 4); g.lineTo(bx0 - 30, topY - 4); g.closePath(); g.fill();
    g.save(); g.clip(); for (let x = bx0 - 50; x < bx1 + 50; x += 14) { g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, topY - 54); g.lineTo(x - 8, topY); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.moveTo(x + 2, topY - 54); g.lineTo(x - 6, topY); g.stroke(); } g.restore();
    g.fillStyle = '#e8c64a'; g.fillRect(bx0 + 20, topY - 56, bx1 - bx0 - 40, 5);
    return;
  }
  if (key === 'castle' || key === 'airport') {
    slab('#3a3830');
    g.fillStyle = key === 'castle' ? '#6a665c' : '#7a8898'; for (let x = bx0 - 6; x < bx1 + 6; x += 44) g.fillRect(x, topY - 40, 28, 30);
    g.fillStyle = 'rgba(255,255,255,.15)'; for (let x = bx0 - 6; x < bx1 + 6; x += 44) g.fillRect(x, topY - 40, 28, 3);
    if (key === 'airport') { g.fillStyle = '#4a5260'; g.fillRect(cx - 14, topY - 100, 28, 90); g.fillStyle = '#8ac8f0'; g.fillRect(cx - 24, topY - 130, 48, 30); g.strokeStyle = '#2a3038'; g.lineWidth = 3; g.strokeRect(cx - 24, topY - 130, 48, 30); g.fillStyle = '#ff4a4a'; g.beginPath(); g.arc(cx, topY - 136, 4, 0, 7); g.fill(); }
    return;
  }
  // plat dak met opbouw: airco's en schoorsteen
  slab('#2b2f38');
  g.fillStyle = '#4a4f58'; g.fillRect(bx0 + 60, topY - 30, 46, 18); g.fillStyle = '#2a2d33'; g.fillRect(bx0 + 64, topY - 26, 38, 10); g.fillStyle = '#6a707a'; g.beginPath(); g.arc(bx0 + 83, topY - 21, 7, 0, 7); g.fill();
  g.fillStyle = shade('#7a4a3a', -0.1); g.fillRect(bx1 - 120, topY - 44, 24, 34); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(bx1 - 122, topY - 46, 28, 5);
  if (key === 'buddley') { g.fillStyle = '#ffb03a'; g.fillRect(cx - 80, topY - 50, 160, 36); g.fillStyle = '#2a2d33'; g.font = '700 26px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('BUDDLEY', cx, topY - 22); }
  if (key === 'hq') { g.fillStyle = '#59a8ff'; g.fillRect(cx - 100, topY - 40, 200, 26); g.fillStyle = '#10141c'; g.font = '700 16px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('HOOFDKANTOOR', cx, topY - 21); }
}

// ---------------------------------------------------------------- de vaste laag (gebouw, kamers, spullen)
export function buildStatic(L) {
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d');
  const T = L.theme, st = T.style || { wall: 'plaster', floor: 'wood', damage: 0.2 };
  backdrop(g, L);
  const topY = roomTop(L.floors - 1) - 14;
  const bx0 = 0.5 * TS, bx1 = (W - 0.5) * TS;
  // schaduw van het gebouw op de grond
  const sh = g.createLinearGradient(0, Y[0] * TS, 0, Y[0] * TS + 40); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = sh; g.fillRect(bx0 - 30, Y[0] * TS, bx1 - bx0 + 60, 40);
  roof(g, L, bx0, bx1, topY);
  g.fillStyle = OUT; rr(g, bx0 - 6, topY - 6, bx1 - bx0 + 12, Y[0] * TS - topY + 12, 4); g.fill();
  const floorKey = (f) => L.n * 31 + f * 7;
  for (let f = 0; f < L.floors; f++) {
    const y0 = (Y[f] - 4) * TS + 4, y1 = Y[f] * TS;
    // kamers die door een wand zonder slot zijn verbonden, vormen samen één ruimte: daar staat geen muur of deur tussen
    const spaces = [];
    L.rooms[f].forEach((r) => {
      const last = spaces[spaces.length - 1];
      const wall = last && L.walls.find((w) => w.f === f && Math.abs(w.x - last.x1) < 0.01 && Math.abs(w.x - r.x0) < 0.01);
      if (last && !(wall && wall.lock)) { last.x1 = r.x1; last.rooms.push(r); } else spaces.push({ x0: r.x0, x1: r.x1, rooms: [r] });
    });
    spaces.forEach((r, ri) => {
      const x0 = r.x0 * TS + 2, x1 = r.x1 * TS - 2, w = x1 - x0, h = y1 - y0;
      const seed = floorKey(f) + ri * 13;
      g.save(); g.beginPath(); g.rect(x0, y0, w, h); g.clip();
      paintWall(g, st, x0, y0, w, h, T, seed);
      // plint en afwerkband onderaan
      const pb = g.createLinearGradient(0, y1 - 38, 0, y1); pb.addColorStop(0, 'rgba(0,0,0,.2)'); pb.addColorStop(1, 'rgba(0,0,0,.38)'); g.fillStyle = pb; g.fillRect(x0, y1 - 38, w, 38);
      g.fillStyle = T.trim; g.fillRect(x0, y1 - 40, w, 5); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x0, y1 - 40, w, 1.6); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x0, y1 - 35, w, 2);
      // kroonlijst onder het plafond
      g.fillStyle = shade(T.trim, 0.08); g.fillRect(x0, y0, w, 8); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x0, y0 + 8, w, 3); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x0, y0, w, 1.6);
      // schaduw in de randen en hoeken (ambient occlusion)
      const eg = (gx0, gy0, gx1, gy1, a) => { const gr = g.createLinearGradient(gx0, gy0, gx1, gy1); gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); return gr; };
      g.fillStyle = eg(x0, 0, x0 + 46, 0, 0.4); g.fillRect(x0, y0, 46, h); g.fillStyle = eg(x1, 0, x1 - 46, 0, 0.4); g.fillRect(x1 - 46, y0, 46, h);
      g.fillStyle = eg(0, y0, 0, y0 + 50, 0.42); g.fillRect(x0, y0, w, 50);
      g.fillStyle = eg(0, y1, 0, y1 - 26, 0.4); g.fillRect(x0, y1 - 26, w, 26);
      // plafondlampen met lichtkegel (één per oorspronkelijke kamer)
      for (const rm of r.rooms) {
        const lx = ((rm.x0 + rm.x1) / 2) * TS;
        g.fillStyle = '#6a6a62'; g.fillRect(lx - 2, y0 + 8, 4, 8);
        g.fillStyle = '#f4f0dc'; g.beginPath(); g.ellipse(lx, y0 + 20, 16, 7, 0, 0, 7); g.fill(); g.fillStyle = '#fffbe8'; g.beginPath(); g.ellipse(lx, y0 + 22, 11, 4, 0, 0, 7); g.fill();
        const gl = g.createRadialGradient(lx, y0 + 22, 4, lx, y0 + 22, 175); gl.addColorStop(0, 'rgba(255,244,200,.42)'); gl.addColorStop(0.5, 'rgba(255,236,170,.12)'); gl.addColorStop(1, 'rgba(255,236,170,0)'); g.globalCompositeOperation = 'lighter'; g.fillStyle = gl; g.fillRect(x0, y0, w, h); g.globalCompositeOperation = 'source-over';
      }
      g.restore();
    });
    // vloer (de doorsnede van de vloerplaat) en plafond van de verdieping eronder
    paintFloor(g, st, bx0, y1, bx1 - bx0, 9, T, floorKey(f) + 99);
    g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(bx0, y1, bx1 - bx0, 1.6); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx0, y1 + 7, bx1 - bx0, 2);
    g.fillStyle = OUT; g.fillRect(bx0, y1 + 9, bx1 - bx0, 3);
    // muren met deuren
    for (const w of L.walls) {
      if (w.f !== f || !w.lock) continue;
      const x = w.x * TS;
      // de muur: dikke scheidingswand met doorsnede
      const mg = g.createLinearGradient(x - 6, 0, x + 6, 0); mg.addColorStop(0, '#171a20'); mg.addColorStop(0.5, '#3a3f4a'); mg.addColorStop(1, '#171a20');
      g.fillStyle = mg; g.fillRect(x - 6, y0 - 4, 12, (y1 - 2.6 * TS) - (y0 - 4));
      // doorgang tussen twee kamers: een opening in de scheidingswand. Het deurblad staat 90 graden gedraaid tegen de wand, dus je ziet bijna alleen de rand
      const dh = 2.6 * TS, dw = 1.5 * TS;
      const dg = g.createLinearGradient(x - dw / 2, 0, x + dw / 2, 0); dg.addColorStop(0, shade(T.wall2, -0.2)); dg.addColorStop(0.5, shade(T.wall, -0.06)); dg.addColorStop(1, shade(T.wall2, -0.26));
      g.fillStyle = dg; g.fillRect(x - dw / 2, y1 - dh, dw, dh);
      g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x - dw / 2, y1 - dh, dw, 8);
      g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x - dw / 2 - 1.5, y1 - dh, 1.5, dh); g.fillRect(x + dw / 2, y1 - dh, 1.5, dh);
      g.fillStyle = shade(T.trim, -0.1); g.fillRect(x - dw / 2 - 1.5, y1 - dh - 3, dw + 3, 3);
      // de deur zelf, van opzij gezien: een dunne rand tegen de wand
      g.fillStyle = shade(T.trim, -0.25); g.fillRect(x + dw / 2 - 3, y1 - dh + 3, 3, dh - 3); g.fillStyle = 'rgba(255,255,255,.16)'; g.fillRect(x + dw / 2 - 3, y1 - dh + 3, 1, dh - 3);
    }
  }
  // buitenmuren en afwerking
  g.fillStyle = OUT; g.fillRect(bx0 - 6, topY - 6, 6, Y[0] * TS - topY + 12); g.fillRect(bx1, topY - 6, 6, Y[0] * TS - topY + 12);
  // ladders met een gat in de vloer erboven; trappen en liften
  for (const l of L.ladders) {
    const x = l.x * TS, y1 = Y[l.f] * TS, y0 = (Y[l.f] - 4) * TS + 4;
    g.fillStyle = '#0a0b0e'; g.beginPath(); g.ellipse(x, y0 + 2, 26, 6, 0, 0, 7); g.fill();
    for (const dx of [-14, 10]) { const lg = g.createLinearGradient(x + dx, 0, x + dx + 4, 0); lg.addColorStop(0, '#d0d6de'); lg.addColorStop(1, '#5a606a'); g.fillStyle = lg; g.fillRect(x + dx, y0, 4, y1 - y0); }
    for (let y = y0 + 8; y < y1 - 4; y += 14) { const rg = g.createLinearGradient(0, y, 0, y + 4); rg.addColorStop(0, '#e0e6ee'); rg.addColorStop(1, '#6a707a'); g.fillStyle = rg; g.fillRect(x - 12, y, 24, 4); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x - 12, y + 4, 24, 2); }
    g.fillStyle = '#0a0b0e'; g.beginPath(); g.ellipse(x, y1 + 2, 22, 5, 0, 0, 7); g.fill();
    const yu = Y[l.f + 1] * TS; g.fillStyle = '#0a0b0e'; g.beginPath(); g.ellipse(x, yu + 2, 24, 5, 0, 0, 7); g.fill(); g.fillStyle = '#c0c6ce'; g.fillRect(x - 14, yu - 22, 4, 22); g.fillRect(x + 10, yu - 22, 4, 22);
  }
  for (const s of L.stairs) {
    const x = s.x * TS, y1 = Y[s.f] * TS, up = s.dir === 'up';
    g.fillStyle = '#0a0b0e'; g.fillRect(x - 40, y1 - 104, 80, 104);
    g.fillStyle = '#2b2f38'; g.fillRect(x - 38, y1 - 102, 76, 102);
    if (s.kind === 'lift') {
      for (const [dx, light] of [[-35, 1], [2, 0]]) { const mg = g.createLinearGradient(x + dx, 0, x + dx + 33, 0); mg.addColorStop(0, '#e0e6ec'); mg.addColorStop(0.5, '#aab2bc'); mg.addColorStop(1, '#6a727c'); g.fillStyle = mg; g.fillRect(x + dx, y1 - 98, 33, 98); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(x + dx + 5, y1 - 98, 5, 98); g.fillStyle = 'rgba(0,0,0,.22)'; for (let yy = y1 - 94; yy < y1; yy += 10) g.fillRect(x + dx, yy, 33, 1); }
      g.fillStyle = '#10141c'; g.fillRect(x - 2, y1 - 98, 4, 98); g.fillStyle = '#1a1e26'; rr(g, x + 42, y1 - 58, 8, 16, 2); g.fill(); g.fillStyle = up ? '#41d97a' : '#e8a43a'; g.beginPath(); g.arc(x + 46, y1 - 52, 2.4, 0, 7); g.fill(); g.beginPath(); g.arc(x + 46, y1 - 46, 2.4, 0, 7); g.fillStyle = '#6a707a'; g.fill();
    } else {
      // trap die omhoog (of omlaag) gaat achter een deur
      const sg = g.createLinearGradient(0, y1 - 100, 0, y1); sg.addColorStop(0, '#15181f'); sg.addColorStop(1, '#2a2e38'); g.fillStyle = sg; g.fillRect(x - 34, y1 - 98, 68, 98);
      for (let i = 0; i < 6; i++) { const yy = y1 - 8 - i * 14, w = 58 - i * 7, tg = g.createLinearGradient(0, yy, 0, yy + 8); tg.addColorStop(0, '#9a9fa8'); tg.addColorStop(1, '#4a505a'); g.fillStyle = tg; g.fillRect(x - w / 2 + (up ? i * 3 : -i * 3), yy, w, 7); g.fillStyle = 'rgba(0,0,0,.4)'; g.fillRect(x - w / 2 + (up ? i * 3 : -i * 3), yy + 7, w, 2); }
      line2(g, '#c8ccd4', 3, x - 34 + (up ? 0 : 0), y1 - 52, x + 30, y1 - 100);
    }
    g.fillStyle = up ? '#41d97a' : '#e8a43a'; g.beginPath(); g.moveTo(x, y1 - (up ? 118 : 110)); g.lineTo(x - 8, y1 - (up ? 108 : 120)); g.lineTo(x + 8, y1 - (up ? 108 : 120)); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1; g.stroke();
    g.strokeStyle = shade(T.trim, 0); g.lineWidth = 5; g.strokeRect(x - 40, y1 - 104, 80, 104); g.strokeStyle = 'rgba(255,255,255,.2)'; g.lineWidth = 1; g.strokeRect(x - 41, y1 - 105, 82, 106);
  }
  // versiering en schuilplekken
  for (const o of L.decor) drawProp(g, o.type, o.x * TS, Y[o.f] * TS);
  // lichtbundels door de ramen
  for (const o of L.decor) if (o.type === 'window') {
    const wx = o.x * TS, wy = Y[o.f] * TS - 66;
    g.save(); g.globalCompositeOperation = 'lighter'; const lg = g.createLinearGradient(wx, wy, wx + 70, wy + 100); lg.addColorStop(0, 'rgba(160,190,255,.2)'); lg.addColorStop(1, 'rgba(160,190,255,0)'); g.fillStyle = lg; g.beginPath(); g.moveTo(wx - 20, wy - 26); g.lineTo(wx + 20, wy - 26); g.lineTo(wx + 110, wy + 66); g.lineTo(wx + 30, wy + 66); g.closePath(); g.fill(); g.restore();
  }
  for (const h of L.hides) {
    const hx = h.x * TS, hy = Y[h.f] * TS;
    const gl = g.createRadialGradient(hx, hy - 24, 4, hx, hy - 24, 44); gl.addColorStop(0, 'rgba(120,255,170,.3)'); gl.addColorStop(1, 'rgba(120,255,170,0)');
    g.fillStyle = gl; g.fillRect(hx - 48, hy - 74, 96, 80);
    drawProp(g, h.kind, hx, hy);
    g.fillStyle = 'rgba(8,18,12,.78)'; rr(g, hx - 9, hy - 100, 18, 16, 5); g.fill(); g.strokeStyle = 'rgba(122,255,176,.5)'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#7affb0'; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('↓', hx, hy - 88);
  }
  // de uitgang
  {
    const x = L.exit.x * TS, y1 = Y[L.exit.f] * TS;
    g.fillStyle = '#0a0b0e'; g.fillRect(x - 36, y1 - 106, 72, 106);
    const eg = g.createLinearGradient(0, y1 - 100, 0, y1); eg.addColorStop(0, '#0a2a14'); eg.addColorStop(1, '#134a24'); g.fillStyle = eg; g.fillRect(x - 30, y1 - 100, 60, 100);
    g.fillStyle = '#41d97a'; for (const [dx, dy, ax, ay] of [[-20, -88, 1, 1], [20, -88, -1, 1], [-20, -60, 1, -1], [20, -60, -1, -1]]) { g.beginPath(); g.moveTo(x + dx, y1 + dy); g.lineTo(x + dx + ax * 14, y1 + dy); g.lineTo(x + dx, y1 + dy + ay * 14); g.closePath(); g.fill(); }
    g.fillStyle = '#0c1a10'; rr(g, x - 30, y1 - 128, 60, 18, 4); g.fill(); g.fillStyle = '#41d97a'; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('UITGANG', x, y1 - 115);
    g.globalCompositeOperation = 'lighter'; const gl = g.createRadialGradient(x, y1 - 60, 6, x, y1 - 60, 80); gl.addColorStop(0, 'rgba(60,255,120,.25)'); gl.addColorStop(1, 'rgba(60,255,120,0)'); g.fillStyle = gl; g.fillRect(x - 80, y1 - 140, 160, 160); g.globalCompositeOperation = 'source-over';
  }
  // het geheel een beetje donkerder aan de randen van het gebouw
  const vg = g.createRadialGradient(CW / 2, CH * 0.5, CH * 0.35, CW / 2, CH * 0.5, CW * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.42)'); g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
  return cv;
}
const line2 = (g, c, w, ...p) => { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i], p[i + 1]); g.stroke(); };

// ---------------------------------------------------------------- voorwerpen
function glow(g, x, y, c) { const gr = g.createRadialGradient(x, y, 2, x, y, 26); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = 0.45 + 0.2 * Math.sin(performance.now() / 300); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); g.globalAlpha = 1; }
function drawItem(g, it, t) {
  const x = it.x * TS, y = Y[it.f] * TS, bob = Math.sin(t * 3 + it.x) * 2;
  if (it.type === 'doc' || it.type === 'code') {
    g.save(); g.translate(x, y - 28 + bob); g.rotate(-0.08); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
    g.fillStyle = it.type === 'code' ? '#fff4c8' : '#f6f4ea'; g.fillRect(-12, -15, 24, 30); g.shadowColor = 'transparent'; g.strokeStyle = '#8a8676'; g.lineWidth = 1.5; g.strokeRect(-12, -15, 24, 30);
    g.fillStyle = '#8a8676'; for (let i = 0; i < 4; i++) g.fillRect(-8, -9 + i * 6, 16 - (i === 3 ? 6 : 0), 2);
    if (it.type === 'code') { g.fillStyle = '#c4322a'; g.fillRect(-8, -12, 16, 4); g.fillStyle = '#10141c'; g.font = '700 7px monospace'; g.textAlign = 'center'; g.fillText('****', 0, 11); }
    g.restore(); glow(g, x, y - 28 + bob, it.type === 'code' ? '#ffd23a' : '#fff6b0');
  } else if (it.type === 'loot') {
    g.save(); g.translate(x, y - 22 + bob); g.shadowColor = 'rgba(0,0,0,.4)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
    const bg = g.createLinearGradient(-16, -12, 16, 16); bg.addColorStop(0, '#d8b46a'); bg.addColorStop(1, '#8a6a34'); g.fillStyle = bg; g.beginPath(); g.moveTo(-12, 16); g.quadraticCurveTo(-18, 0, -6, -10); g.lineTo(6, -10); g.quadraticCurveTo(18, 0, 12, 16); g.closePath(); g.fill(); g.shadowColor = 'transparent';
    g.strokeStyle = '#5a3e12'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#e8c64a'; g.fillRect(-6, -13, 12, 4);
    g.fillStyle = '#5a3e12'; g.font = '700 16px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('$', 0, 10); g.restore(); glow(g, x, y - 22 + bob, '#ffe27a');
  } else if (it.type === 'hack') {
    g.fillStyle = '#2a3340'; g.fillRect(x - 17, y - 40, 34, 26); g.fillStyle = '#0c1a10'; g.fillRect(x - 14, y - 37, 28, 18); g.fillStyle = '#41d97a'; g.font = '700 9px monospace'; g.textAlign = 'left'; g.fillText('>_ hack', x - 12, y - 25);
    g.fillStyle = '#2a3340'; g.fillRect(x - 6, y - 14, 12, 14); glow(g, x, y - 28, '#41d97a');
  } else if (it.type === 'vault') {
    // het kluisslot met een toetsenpaneel
    g.fillStyle = '#1a1e24'; rr(g, x - 16, y - 56, 32, 46, 4); g.fill(); g.strokeStyle = '#6a7682'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#0c1a10'; g.fillRect(x - 12, y - 52, 24, 8); g.fillStyle = '#41d97a'; g.font = '700 8px monospace'; g.textAlign = 'center'; g.fillText('CODE', x, y - 45.5);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { g.fillStyle = '#4a525c'; g.fillRect(x - 11 + c * 8, y - 40 + r * 9, 6, 7); }
    glow(g, x, y - 34, '#41d97a');
  } else if (it.type === 'switch') {
    g.fillStyle = '#4a4f58'; rr(g, x - 12, y - 46, 24, 32, 3); g.fill(); g.fillStyle = '#e84a4a'; g.beginPath(); g.arc(x, y - 36, 4, 0, 7); g.fill();
    g.strokeStyle = '#e8e4d8'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x + 6, y - 36); g.stroke(); glow(g, x, y - 30, '#ff7a7a');
  }
}

// ---------------------------------------------------------------- bewakers
const SKIN = {
  blue: ['#4a7ac8', '#2f5498'], green: ['#4aa858', '#2f7a3c'], purple: ['#8a5ac8', '#5e3a98'], gold: ['#d8b040', '#a07a1c'], white: ['#e6eef2', '#a8b8c2'],
  police: ['#3a4a9a', '#222d66'], chef: ['#f0ece0', '#b8b2a0'], orange: ['#e88a3a', '#a8561c'], knight: ['#9aa0a8', '#5e646c'], alien: ['#5ae0a8', '#2a9a70'], boss: ['#a83a4a', '#681f2a'],
};
function drawRobot(g, gd, s, t, stunT, alert) {
  const stunned = stunT > 0;
  const [c1, c2] = SKIN[gd.skin] || SKIN.blue;
  const x = s.x * TS, y = Y[gd.f] * TS, dir = s.dir || 1;
  if (gd.kind === 'camera') { // aan het plafond
    const cy = (Y[gd.f] - 4) * TS + 8;
    g.fillStyle = '#2a2d33'; g.fillRect(x - 3, cy - 4, 6, 10);
    g.save(); g.translate(x, cy + 6); g.rotate(-s.ang); const cg = g.createLinearGradient(-11, 0, 11, 14); cg.addColorStop(0, '#5a6068'); cg.addColorStop(1, '#22262c'); g.fillStyle = cg; rr(g, -11, 0, 22, 14, 5); g.fill(); g.fillStyle = alert ? '#ff3a3a' : '#7ab6ff'; g.beginPath(); g.arc(0, 8, 4.5, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.arc(-1, 6.6, 1.4, 0, 7); g.fill(); g.restore();
    return;
  }
  if (gd.kind === 'drone') {
    const hy = y - 2.6 * TS + Math.sin(t * 4 + gd.id) * 3;
    g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.ellipse(x, y - 1, 18, 4, 0, 0, 7); g.fill();
    g.fillStyle = c2; rr(g, x - 16, hy - 6, 32, 14, 7); g.fill(); const dg = g.createLinearGradient(0, hy - 8, 0, hy + 2); dg.addColorStop(0, shade(c1, 0.3)); dg.addColorStop(1, c1); g.fillStyle = dg; rr(g, x - 13, hy - 8, 26, 10, 5); g.fill();
    g.fillStyle = alert ? '#ff3a3a' : '#ffe27a'; g.beginPath(); g.arc(x, hy + 4, 4, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220,230,240,.8)'; g.lineWidth = 3; g.beginPath(); const sw = Math.sin(t * 40) * 14; g.moveTo(x - 18 - sw * 0.2, hy - 12); g.lineTo(x - 18 + sw, hy - 12); g.moveTo(x + 18 - sw, hy - 12); g.lineTo(x + 18 + sw * 0.2, hy - 12); g.stroke();
    g.fillStyle = c2; g.fillRect(x - 18, hy - 12, 2, 6); g.fillRect(x + 16, hy - 12, 2, 6);
    return;
  }
  const big = gd.kind === 'heavy', fast = gd.kind === 'fast', sleeper = gd.kind === 'sleeper';
  const sc = big ? 1.25 : fast ? 0.9 : 1;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y - 1, 20 * sc, 4, 0, 0, 7); g.fill();
  g.save(); g.translate(x, y); g.scale(sc * dir, sc);
  const step = s.moving ? Math.sin(t * (fast ? 14 : 8) + gd.id) : 0;
  if (stunned) g.globalAlpha = 0.75;
  if (fast) { g.strokeStyle = c2; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-5, -14); g.lineTo(-5 + step * 6, 0); g.moveTo(5, -14); g.lineTo(5 - step * 6, 0); g.stroke(); }
  else { g.fillStyle = '#2a2d33'; rr(g, -15, -10, 30, 10, 5); g.fill(); g.fillStyle = '#4a4f58'; for (let i = -10; i <= 10; i += 10) { g.beginPath(); g.arc(i, -5, 3, 0, 7); g.fill(); } g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-13, -9, 26, 2); }
  g.fillStyle = c2; rr(g, -13, -44, 26, 36, 7); g.fill();
  const bg = g.createLinearGradient(-11, -46, 11, -14); bg.addColorStop(0, shade(c1, 0.25)); bg.addColorStop(1, shade(c1, -0.18)); g.fillStyle = bg; rr(g, -11, -46, 22, 32, 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-9, -44, 5, 26);
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-11, -30); g.lineTo(11, -30); g.stroke();
  if (gd.skin === 'police') { g.fillStyle = '#e8c64a'; g.beginPath(); g.moveTo(2, -36); g.lineTo(6, -28); g.lineTo(0, -24); g.lineTo(-4, -28); g.closePath(); g.fill(); }
  if (gd.skin === 'chef') { g.fillStyle = '#fff'; g.beginPath(); g.arc(-4, -56, 8, 0, 7); g.arc(4, -56, 8, 0, 7); g.arc(0, -61, 8, 0, 7); g.fill(); }
  if (gd.skin === 'knight') { g.fillStyle = c2; g.fillRect(-2, -66, 4, 12); g.fillStyle = '#c4452e'; g.fillRect(-2, -70, 4, 6); }
  if (gd.skin === 'alien') { g.strokeStyle = c1; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, -56); g.lineTo(-8, -66); g.moveTo(4, -56); g.lineTo(8, -66); g.stroke(); g.fillStyle = c1; g.beginPath(); g.arc(-8, -66, 2.5, 0, 7); g.arc(8, -66, 2.5, 0, 7); g.fill(); }
  const ch = s.chase;
  let hx = 16 + step * 3, hy = -24, bAng = 0;
  if (ch) { bAng = s.swing > 0 ? -1.3 + 2.8 * s.swing : -0.75 + Math.sin(t * 12 + gd.id) * 0.14; hx = 8 + 14 * Math.sin(bAng); hy = -36 - 14 * Math.cos(bAng); }
  g.strokeStyle = c2; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(8, -36); g.lineTo(hx, hy); g.stroke();
  if (ch) { g.save(); g.translate(hx, hy); g.rotate(bAng); const bg2 = g.createLinearGradient(-3, 0, 3, 0); bg2.addColorStop(0, '#4a4f58'); bg2.addColorStop(1, '#16181c'); g.fillStyle = bg2; g.beginPath(); g.roundRect(-3, -26, 6, 28, 2.5); g.fill(); g.fillStyle = '#e8e4d8'; g.fillRect(-3, -8, 6, 2.2); g.restore(); }
  g.fillStyle = c2; rr(g, -12, -62, 24, 20, 9); g.fill(); g.fillStyle = c1; rr(g, -10, -62, 20, 17, 8); g.fill();
  const asleep = sleeper && !s.awake;
  g.fillStyle = '#10141c'; rr(g, -2, -58, 12, 9, 4); g.fill();
  g.fillStyle = asleep ? '#4a4f58' : alert || s.chase ? '#ff3a3a' : (big ? '#ff9a3a' : '#7affc8'); if (asleep) g.fillRect(1, -54, 7, 2); else { g.beginPath(); g.arc(6, -53.5, 3, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(5.2, -54.4, 0.9, 0, 7); g.fill(); }
  g.fillStyle = '#2a2d33'; g.fillRect(-1, -70, 2, 8); g.fillStyle = alert ? '#ff3a3a' : '#e8c64a'; g.beginPath(); g.arc(0, -71, 3, 0, 7); g.fill();
  if (big) { g.strokeStyle = '#2a2d33'; g.lineWidth = 3; g.strokeRect(-12, -44, 24, 36); }
  g.restore();
  if (asleep) { g.fillStyle = '#e8e4d8'; g.font = '700 14px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('z', x + 18, y - 70 - Math.sin(t * 2) * 3); g.font = '700 10px Fredoka, sans-serif'; g.fillText('z', x + 28, y - 82 - Math.sin(t * 2 + 1) * 3); }
  if (stunned) {
    // hoe lang hij nog uitgeschakeld is
    const bx = x, by = y - (big ? 104 : 96);
    g.fillStyle = 'rgba(8,10,14,.85)'; rr(g, bx - 17, by - 12, 34, 22, 11); g.fill(); g.strokeStyle = '#ffe27a'; g.lineWidth = 1.5; g.stroke();
    g.fillStyle = '#ffe27a'; g.font = '700 14px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(String(Math.ceil(stunT)), bx + 4, by + 4);
    g.beginPath(); g.arc(bx - 8, by - 1, 5, 0, 7); g.strokeStyle = '#ffe27a'; g.stroke(); g.beginPath(); g.moveTo(bx - 8, by - 1); g.lineTo(bx - 8, by - 4); g.moveTo(bx - 8, by - 1); g.lineTo(bx - 6, by); g.stroke();
  }
  if (stunned) { g.strokeStyle = '#ffe27a'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 8 + i * 2.1; g.beginPath(); g.moveTo(x + Math.cos(a) * 10, y - 78 + Math.sin(a) * 5); g.lineTo(x + Math.cos(a) * 16, y - 80 + Math.sin(a) * 8); g.stroke(); } }
}

function drawCone(g, gd, s, alert) {
  const y = Y[gd.f] * TS;
  g.save(); g.globalCompositeOperation = 'lighter';
  const col = alert ? '255,50,50' : '255,226,120';
  if (gd.kind === 'camera') {
    const cx = s.x * TS, cy = (Y[gd.f] - 4) * TS + 14;
    g.translate(cx, cy);
    const R = gd.range * TS;
    const a0 = Math.PI / 2 - s.ang - gd.half, a1 = Math.PI / 2 - s.ang + gd.half;
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, R); gr.addColorStop(0, `rgba(${col},.42)`); gr.addColorStop(1, `rgba(${col},.03)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0, a1); g.closePath(); g.fill();
  } else if (gd.kind === 'drone') {
    const hy = y - 2.6 * TS + 8, x = s.x * TS;
    const gr = g.createLinearGradient(0, hy, 0, y); gr.addColorStop(0, `rgba(${col},.5)`); gr.addColorStop(1, `rgba(${col},.08)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 4, hy); g.lineTo(x + 4, hy); g.lineTo(x + 28, y); g.lineTo(x - 28, y); g.closePath(); g.fill();
    const fg = g.createRadialGradient(x, y - 2, 2, x, y - 2, 36); fg.addColorStop(0, `rgba(${col},.4)`); fg.addColorStop(1, `rgba(${col},0)`); g.fillStyle = fg; g.fillRect(x - 36, y - 10, 72, 14);
  } else if (!(gd.kind === 'sleeper' && !s.awake)) {
    const x = s.x * TS, dir = s.dir, R = gd.range * TS, ey = y - 52;
    const gr = g.createLinearGradient(x, 0, x + dir * R, 0); gr.addColorStop(0, `rgba(${col},.5)`); gr.addColorStop(1, `rgba(${col},.03)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + dir * 10, ey); g.lineTo(x + dir * R, y + 6); g.lineTo(x + dir * R, y - 70); g.closePath(); g.fill();
    // lichtplek op de vloer
    const fg = g.createRadialGradient(x + dir * R * 0.6, y - 2, 4, x + dir * R * 0.6, y - 2, R * 0.5); fg.addColorStop(0, `rgba(${col},.28)`); fg.addColorStop(1, `rgba(${col},0)`); g.save(); g.translate(0, 0); g.fillStyle = fg; g.fillRect(x + dir * R * 0.1 - (dir < 0 ? R * 0.5 : 0), y - 8, R * 0.9, 12); g.restore();
  }
  g.restore();
}

// ---------------------------------------------------------------- Te-Un als dief: zwarte kleding, bivakmuts en handschoenen
// welk gereedschap Te-Un in zijn hand heeft: een knuppel bij een klap, een schroevendraaier bij hacken, een dietrich bij een slot
function toolOf(p, t) {
  if (p.swing > 0) return { tool: 'club', toolT: 1 - p.swing / SWING_T };
  if (p.mode === 'act' && p.workItem && (p.workItem.type === 'hack' || p.workItem.type === 'vault')) return { tool: 'screwdriver', toolT: t };
  if (p.mode === 'pick') return { tool: 'lockpick', toolT: t };
  return {};
}
export function drawThief(g, p, t, opts = {}) {
  const x = opts.px !== undefined ? opts.px : p.x * TS, y = opts.py !== undefined ? opts.py : p.y * TS;
  const moving = p.mode === 'walk' && Math.abs(p.vx) > 0.5, climbing = p.mode === 'climb';
  const alpha = p.mode === 'hide' || p.hidden ? 0.35 : p.mode === 'portal' ? 0.25 : 1;
  g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(x, y - 1, 15, 3.5, 0, 0, 7); g.fill();
  drawTeUn(g, { x, y, s: opts.scale || 1, face: p.face >= 0 ? 1 : -1, walk: p.walk * 7, t, outfit: 'black', mask: 1, gloves: 1, sack: true, alpha, pose: climbing ? 'climb' : p.mode === 'pick' ? 'sneak' : moving ? 'walk' : 'stand', ...toolOf(p, t) });
}

// ---------------------------------------------------------------- hele scene
export function drawScene(g, game, stat, t) {
  const L = game.L, p = game.p;
  g.drawImage(stat, 0, 0);
  // gesloten deuren: een zware stalen deur in de scheidingswand (van opzij gezien, een dikke plaat) met een hangslot (spatie ingedrukt houden om het slot te forceren)
  L.walls.forEach((w, i) => {
    if (!w.lock || game.doorOpen.has(i)) return;
    const x = w.x * TS, y1 = Y[w.f] * TS, dh = 2.6 * TS, dw = 1.5 * TS, sw = 16;
    const mg = g.createLinearGradient(x - sw / 2, 0, x + sw / 2, 0); mg.addColorStop(0, '#6a727c'); mg.addColorStop(0.35, '#c8d0d8'); mg.addColorStop(1, '#58606a');
    g.fillStyle = mg; g.fillRect(x - sw / 2, y1 - dh, sw, dh);
    g.strokeStyle = '#2a2f36'; g.lineWidth = 2; g.strokeRect(x - sw / 2 + 1, y1 - dh + 1, sw - 2, dh - 2);
    g.fillStyle = 'rgba(0,0,0,.2)'; for (let yy = y1 - dh + 16; yy < y1 - 8; yy += 24) g.fillRect(x - sw / 2 + 2, yy, sw - 4, 2);
    g.fillStyle = '#3a4048'; for (const dy of [6, dh / 2, dh - 6]) { g.beginPath(); g.arc(x - sw / 2 + 4, y1 - dh + dy, 1.8, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + sw / 2, y1 - dh, 4, dh);
    const lx = x, ly = y1 - dh / 2 + 4;
    if (w.lock === 'code') {
      // een nummerpad naast de deur
      const px = x + 14, py = y1 - dh / 2 - 22;
      g.fillStyle = '#1a1e26'; rr(g, px - 13, py, 26, 44, 4); g.fill(); g.strokeStyle = '#6a7682'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#0c1a10'; g.fillRect(px - 10, py + 4, 20, 8); g.fillStyle = '#41d97a'; g.font = '700 7px monospace'; g.textAlign = 'center'; g.fillText('CODE', px, py + 10.5);
      for (let r2 = 0; r2 < 3; r2++) for (let c2 = 0; c2 < 3; c2++) { g.fillStyle = '#4a525c'; g.fillRect(px - 10 + c2 * 7, py + 16 + r2 * 8, 5, 6); }
      g.fillStyle = Math.sin(t * 5) > 0 ? '#e84a4a' : '#7a2a2a'; g.beginPath(); g.arc(px, py + 41, 1.8, 0, 7); g.fill();
    } else {
      g.strokeStyle = '#c8ced6'; g.lineWidth = 4; g.beginPath(); g.arc(lx, ly - 8, 7, Math.PI, 0); g.stroke();
      const lg = g.createLinearGradient(lx - 10, ly - 8, lx + 10, ly + 12); lg.addColorStop(0, '#f0d060'); lg.addColorStop(1, '#a07a18'); g.fillStyle = lg; rr(g, lx - 10, ly - 8, 20, 18, 3); g.fill(); g.strokeStyle = '#4a3a0a'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#10141c'; g.beginPath(); g.arc(lx, ly, 2.6, 0, 7); g.fill(); g.fillRect(lx - 1, ly, 2, 6);
    }
    // voortgang van het openbreken
    if (w.lock !== 'code' && p.mode === 'pick' && p.pickWall === i) {
      const k = Math.min(1, p.pick / PICK_T);
      g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 6; g.beginPath(); g.arc(lx, ly, 20, 0, 7); g.stroke(); g.strokeStyle = '#ffd23a'; g.lineWidth = 4; g.beginPath(); g.arc(lx, ly, 20, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
      g.fillStyle = '#ffe27a'; for (let s2 = 0; s2 < 3; s2++) { const a = t * 20 + s2 * 2.1; g.beginPath(); g.arc(lx + Math.cos(a) * 14, ly + Math.sin(a) * 14, 1.6, 0, 7); g.fill(); }
    } else if (p.f === w.f && Math.abs(p.x - w.x) < 1.2 && p.mode === 'walk') {
      g.fillStyle = 'rgba(8,10,14,.82)'; rr(g, lx - 62, y1 - dh - 30, 124, 22, 8); g.fill(); g.fillStyle = '#ffe27a'; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText(w.lock === 'code' ? 'Spatie: nummerpad' : 'Houd spatie ingedrukt', lx, y1 - dh - 15);
    }
  });
  // lasers
  for (const l of L.lasers) {
    const x = l.x * TS, y1 = Y[l.f] * TS, y0 = (Y[l.f] - 3.6) * TS;
    const on = l.needSwitch ? !game.switchOn : laserOn(l, game.t);
    const mgl = g.createLinearGradient(x - 6, 0, x + 6, 0); mgl.addColorStop(0, '#5a5f68'); mgl.addColorStop(1, '#1c1f24'); g.fillStyle = mgl; g.fillRect(x - 6, y0 - 8, 12, 10); g.fillRect(x - 6, y1 - 4, 12, 8);
    g.fillStyle = on ? '#ff3a3a' : '#5a2a2a'; g.beginPath(); g.arc(x, y0 + 1, 2, 0, 7); g.arc(x, y1 - 1, 2, 0, 7); g.fill();
    if (on) { g.save(); g.shadowColor = '#ff2a2a'; g.shadowBlur = 14; g.strokeStyle = '#ff4a4a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y0 + 2); g.lineTo(x, y1 - 4); g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#ffe0e0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y0 + 2); g.lineTo(x, y1 - 4); g.stroke(); g.restore(); const gl = g.createRadialGradient(x, y1 - 2, 2, x, y1 - 2, 26); gl.addColorStop(0, 'rgba(255,60,60,.4)'); gl.addColorStop(1, 'rgba(255,60,60,0)'); g.fillStyle = gl; g.fillRect(x - 26, y1 - 18, 52, 20); }
    else { g.strokeStyle = 'rgba(255,90,90,.18)'; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(x, y0 + 2); g.lineTo(x, y1 - 4); g.stroke(); g.setLineDash([]); }
  }
  for (const it of game.items) if (!it.done) drawItem(g, it, t);
  // bewakers: eerst de lichtkegels, dan de robots
  const alertGuard = game.seenBy;
  L.guards.forEach((gd, i) => { const s = game.guardState(i); if (game.stun[i] > 0) return; drawCone(g, gd, s, i === alertGuard || !!s.chase); });
  L.guards.forEach((gd, i) => { const s = game.guardState(i); drawRobot(g, gd, s, t, game.stun[i], (i === alertGuard && game.meter > 0.2) || !!s.chase); });
  drawThief(g, p, t);
  // het meter boven Te-Un als iemand hem ziet
  if (game.meter > 0.02) {
    const x = p.x * TS, y = p.y * TS - 100;
    g.fillStyle = 'rgba(0,0,0,.6)'; rr(g, x - 22, y, 44, 8, 4); g.fill();
    g.fillStyle = game.meter > 0.66 ? '#ff3a3a' : '#ffb03a'; rr(g, x - 21, y + 1, 42 * Math.min(1, game.meter), 6, 3); g.fill();
    g.fillStyle = '#ff3a3a'; g.font = '700 20px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('!', x, y - 4);
  }
  if (p.mode === 'act') { const x = p.x * TS, y = p.y * TS - 96, tot = Math.max(0.1, p.workItem ? (p.workItem.type === 'hack' || p.workItem.type === 'vault' ? 1.8 : p.workItem.type === 'code' ? 0.6 : 0.5) : 0.5); g.fillStyle = 'rgba(0,0,0,.55)'; rr(g, x - 22, y, 44, 8, 4); g.fill(); g.fillStyle = '#41d97a'; rr(g, x - 21, y + 1, 42 * (1 - Math.max(0, p.work) / tot), 6, 3); g.fill(); }
  // alarm: rood knipperend randje
  if (game.alarmT > 0) { const a = Math.min(1, game.alarmT / 1.5) * (0.35 + 0.25 * Math.sin(t * 14)); g.save(); g.strokeStyle = `rgba(255,40,40,${a})`; g.lineWidth = 22; g.strokeRect(0, 0, CW, CH); const vg2 = g.createRadialGradient(CW / 2, CH / 2, CH * 0.4, CW / 2, CH / 2, CW * 0.65); vg2.addColorStop(0, 'rgba(255,0,0,0)'); vg2.addColorStop(1, `rgba(255,0,0,${a * 0.6})`); g.fillStyle = vg2; g.fillRect(0, 0, CW, CH); g.restore(); }
}
