// Tekenen: drie biomes (bos, woestijn, winter), de kabouters en de pijl boven de tikker. Alles met canvas.
import { W, H, TS, LAYOUTS, TRAMP_W } from './sim.js';

export const CW = W * TS, CH = H * TS;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

export const BIOMES = {
  forest: { name: 'Bos', sky: ['#7fd0ff', '#d6f3ff'], far: '#7fc77a', far2: '#5fae62', top: '#5fae3c', topL: '#8bd25a', body: '#7a5230', bodyD: '#5d3c20', ground: '#5a8f3a' },
  desert: { name: 'Woestijn', sky: ['#ffcf8a', '#fff0cc'], far: '#f0c98a', far2: '#e2b270', top: '#f3d78c', topL: '#ffe9ad', body: '#c99a52', bodyD: '#a67a36', ground: '#dcb36a' },
  winter: { name: 'Winter', sky: ['#a9c8ea', '#eaf4ff'], far: '#dbe9f7', far2: '#c3d9ee', top: '#ffffff', topL: '#ffffff', body: '#8fb3d9', bodyD: '#6f93bb', ground: '#e8f1fa' },
};

// ---------------------------------------------------------------- achtergrond (1 keer per biome)
function tree(g, x, y, s, biome, seed) {
  g.save(); g.translate(x, y);
  if (biome === 'forest') {
    g.fillStyle = '#6b4423'; g.fillRect(-4 * s, -26 * s, 8 * s, 26 * s);
    g.fillStyle = '#2f8a3a'; for (const [dx, dy, r] of [[0, -46, 22], [-14, -34, 17], [14, -34, 17], [0, -30, 18]]) { g.beginPath(); g.arc(dx * s, dy * s, r * s, 0, 7); g.fill(); }
    g.fillStyle = '#4aaa4a'; g.beginPath(); g.arc(-6 * s, -50 * s, 9 * s, 0, 7); g.fill();
  } else if (biome === 'desert') {
    g.fillStyle = '#3f8f4a'; g.strokeStyle = '#2c6a35'; g.lineWidth = 2;
    g.beginPath(); g.roundRect(-5 * s, -44 * s, 10 * s, 44 * s, 5 * s); g.fill(); g.stroke();
    g.beginPath(); g.roundRect(-18 * s, -32 * s, 8 * s, 18 * s, 4 * s); g.fill(); g.stroke(); g.fillRect(-18 * s, -18 * s, 14 * s, 6 * s);
    g.beginPath(); g.roundRect(10 * s, -38 * s, 8 * s, 20 * s, 4 * s); g.fill(); g.stroke(); g.fillRect(4 * s, -22 * s, 12 * s, 6 * s);
    g.fillStyle = '#ff8fb0'; g.beginPath(); g.arc(0, -46 * s, 4 * s, 0, 7); g.fill();
  } else {
    g.fillStyle = '#5b4630'; g.fillRect(-3 * s, -10 * s, 6 * s, 10 * s);
    for (let i = 0; i < 3; i++) {
      const w = (22 - i * 5) * s, y = (-10 - i * 15) * s;
      g.fillStyle = '#2f6a58'; g.beginPath(); g.moveTo(-w, y); g.lineTo(0, y - 24 * s); g.lineTo(w, y); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(-w * 0.7, y - 6 * s); g.lineTo(0, y - 24 * s); g.lineTo(w * 0.7, y - 6 * s); g.quadraticCurveTo(0, y - 12 * s, -w * 0.7, y - 6 * s); g.fill();
    }
  }
  g.restore();
}

export function buildBackdrop(biomeId) {
  const B = BIOMES[biomeId];
  const PLATS = (LAYOUTS[biomeId] || LAYOUTS.forest).plats;
  const tramp = (LAYOUTS[biomeId] || LAYOUTS.forest).tramp;
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d');
  const sky = g.createLinearGradient(0, 0, 0, CH); sky.addColorStop(0, B.sky[0]); sky.addColorStop(1, B.sky[1]);
  g.fillStyle = sky; g.fillRect(0, 0, CW, CH);
  // zon of sneeuwvlokken
  if (biomeId !== 'winter') { g.fillStyle = 'rgba(255,244,170,.9)'; g.beginPath(); g.arc(CW * 0.82, 90, 46, 0, 7); g.fill(); g.fillStyle = 'rgba(255,244,170,.25)'; g.beginPath(); g.arc(CW * 0.82, 90, 74, 0, 7); g.fill(); }
  else { g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 70; i++) { g.beginPath(); g.arc(hash(i, 1) * CW, hash(i, 2) * CH, 1.5 + hash(i, 3) * 2.5, 0, 7); g.fill(); } }
  // wolken
  g.fillStyle = 'rgba(255,255,255,.75)';
  for (let i = 0; i < 5; i++) { const x = 120 + i * 260 + hash(i, 9) * 80, y = 70 + hash(i, 8) * 160; for (const [dx, dy, r] of [[0, 0, 26], [28, 6, 20], [-26, 8, 18], [8, 12, 22]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } }
  // heuvels / duinen
  g.fillStyle = B.far; g.beginPath(); g.moveTo(0, CH);
  for (let x = 0; x <= CW; x += 40) g.lineTo(x, CH * 0.62 + Math.sin(x * 0.006 + 1) * 46 + Math.sin(x * 0.017) * 14);
  g.lineTo(CW, CH); g.fill();
  g.fillStyle = B.far2; g.beginPath(); g.moveTo(0, CH);
  for (let x = 0; x <= CW; x += 40) g.lineTo(x, CH * 0.74 + Math.sin(x * 0.009 + 3) * 36 + Math.sin(x * 0.021) * 10);
  g.lineTo(CW, CH); g.fill();
  // decor op de achtergrond: staat achter de kabouters en geeft nooit dekking
  g.globalAlpha = 0.9;
  for (let i = 0; i < 9; i++) tree(g, 60 + i * 150 + hash(i, 4) * 60, CH * 0.8, 1.7, biomeId, i);
  g.globalAlpha = 1;
  // platforms
  for (const p of PLATS) {
    const x = p.x0 * TS, w = (p.x1 + 1 - p.x0) * TS, y = p.y * TS;
    if (p.ground) {
      g.fillStyle = B.body; g.fillRect(x, y, w, CH - y);
      g.fillStyle = B.bodyD; for (let i = 0; i < 80; i++) g.fillRect(hash(i, 5) * w, y + 10 + hash(i, 6) * (CH - y - 10), 3 + hash(i, 7) * 6, 3);
      g.fillStyle = B.top; g.fillRect(x, y, w, 12); g.fillStyle = B.topL; g.fillRect(x, y, w, 4);
      continue;
    }
    const th = 14;
    g.fillStyle = B.body; g.beginPath(); g.roundRect(x, y, w, th, [0, 0, 7, 7]); g.fill();
    g.fillStyle = B.bodyD; g.fillRect(x + 4, y + th - 4, w - 8, 3);
    g.fillStyle = B.top; g.beginPath(); g.roundRect(x - 3, y - 2, w + 6, 9, 4); g.fill();
    g.fillStyle = B.topL; g.fillRect(x + 2, y - 1, w - 4, 2.5);
    if (biomeId === 'winter') { // ijspegels onder het platform
      g.fillStyle = '#d9f1ff'; g.strokeStyle = 'rgba(120,170,210,.8)'; g.lineWidth = 1;
      for (let ix = x + 8; ix < x + w - 6; ix += 17) { const h2 = 8 + hash(ix | 0, y | 0) * 14; g.beginPath(); g.moveTo(ix - 4, y + th - 2); g.lineTo(ix + 4, y + th - 2); g.lineTo(ix, y + th + h2); g.closePath(); g.fill(); g.stroke(); }
    }
    if (biomeId === 'forest') { g.fillStyle = '#4a9a30'; for (let ix = x + 6; ix < x + w - 4; ix += 15) { g.beginPath(); g.moveTo(ix - 4, y + th - 2); g.lineTo(ix + 4, y + th - 2); g.lineTo(ix, y + th + 5 + hash(ix | 0, y | 0) * 6); g.fill(); } }
  }
  // bomen / cactussen / dennen op de grond en op de platforms (zacht, achter de spelers)
  for (const p of PLATS) {
    const n = p.ground ? 7 : 1;
    for (let i = 0; i < n; i++) {
      const wx = p.ground ? (2 + i * 5.6 + hash(i, 11) * 2) : (p.x0 + 1 + hash(p.x0, p.y) * (p.x1 - p.x0 - 1));
      tree(g, wx * TS, p.y * TS + 1, p.ground ? 1.05 : 0.7, biomeId, i);
    }
  }
  // de trampoline aan de rand
  {
    const x0 = (tramp === 'left' ? 0 : W - TRAMP_W) * TS, w = TRAMP_W * TS, y = 20 * TS;
    g.fillStyle = '#2b2f3a'; g.fillRect(x0 + 4, y - 14, 5, 14); g.fillRect(x0 + w - 9, y - 14, 5, 14);
    g.strokeStyle = '#8a93a6'; g.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const sx = x0 + 10 + i * ((w - 20) / 3); g.beginPath(); g.moveTo(sx, y - 14); for (let k = 0; k < 4; k++) g.lineTo(sx + (k % 2 ? 4 : -4), y - 14 + (k + 1) * 3); g.stroke(); }
    g.fillStyle = '#e8262f'; g.beginPath(); g.roundRect(x0, y - 22, w, 10, 5); g.fill();
    g.fillStyle = '#ffd23a'; g.fillRect(x0 + 6, y - 20, w - 12, 3);
    g.fillStyle = '#fff'; g.font = '700 14px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('\u2191', x0 + w / 2, y - 26);
  }
  return cv;
}

// ---------------------------------------------------------------- kabouters
const LOOKS = {
  teun: { hat: '#d7191f', hatD: '#8f0d12' },
  wizard: { hat: '#7a3fd0', hatD: '#4b2290', shirt: '#6a35c0' },
  speed: { hat: '#d7191f', hatD: '#8f0d12', shirt: '#ffcf2e' },
  shadow: { hat: '#2b2d3a', hatD: '#14151c', shirt: '#2b2d3a' },
};
export function drawGnome(g, c, t, opts = {}) {
  const look = LOOKS[c.type] || LOOKS.teun;
  const shirt = look.shirt || c.shirt;
  const S = opts.scale || 0.76;
  const moving = Math.abs(c.vx || 0) > 0.8 && c.grounded;
  const air = !c.grounded;
  const sw = moving ? Math.sin((c.walk || 0) * 5) * 6 : 0;
  const bob = moving ? Math.abs(Math.sin((c.walk || 0) * 5)) * 2 : 0;
  g.save();
  g.translate(opts.px, opts.py);
  g.scale(S * (c.face >= 0 ? 1 : -1), S);
  if (c.type === 'shadow' && c.invisT > 0) g.globalAlpha = 0.45;
  else if (c.immuneT > 0 && !opts.still) g.globalAlpha = 0.6 + 0.4 * Math.sin(t * 30);
  // snelle Te-Un: snelheidsstrepen
  if (c.type === 'speed' && Math.abs(c.vx) > 9) {
    g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = 0; i < 3; i++) { const y = -14 - i * 14; g.beginPath(); g.moveTo(-18, y); g.lineTo(-40 - ((t * 200 + i * 20) % 20), y); g.stroke(); }
  }
  // voeten
  g.fillStyle = c.type === 'speed' ? '#e8361f' : c.type === 'shadow' ? '#0e0f14' : '#3a2a1c';
  g.beginPath(); g.ellipse(-6 + sw, -3 - (air ? 3 : 0), 7.5, 4.5, 0, 0, 7); g.fill();
  g.beginPath(); g.ellipse(6 - sw, -3 - (air ? 1 : 0), 7.5, 4.5, 0, 0, 7); g.fill();
  g.translate(0, -bob);
  // lichaam (tovenaar: gewaad)
  g.fillStyle = shirt;
  g.beginPath();
  if (c.type === 'wizard') { g.moveTo(-9, -32); g.lineTo(9, -32); g.lineTo(17, -5); g.lineTo(-17, -5); g.closePath(); }
  else g.roundRect(-12, -31, 24, 25, 8);
  g.fill();
  if (c.type === 'wizard') { g.fillStyle = '#ffd23a'; g.fillRect(-12, -19, 24, 3); for (const [x, y] of [[-6, -26], [5, -12], [-8, -10]]) { g.beginPath(); g.arc(x, y, 1.8, 0, 7); g.fill(); } }
  if (c.type === 'speed') { g.fillStyle = '#e8361f'; g.beginPath(); g.moveTo(2, -29); g.lineTo(-5, -17); g.lineTo(0, -17); g.lineTo(-3, -8); g.lineTo(6, -21); g.lineTo(1, -21); g.closePath(); g.fill(); }
  if (c.type === 'shadow') { g.fillStyle = 'rgba(160,140,255,.35)'; g.fillRect(-12, -19, 24, 3); }
  // armen
  g.fillStyle = shirt;
  const arm = air ? -6 : 0;
  g.beginPath(); g.ellipse(-13, -22 + arm + (moving ? -sw * 0.4 : 0), 4.5, 6.5, 0.2, 0, 7); g.fill();
  g.beginPath(); g.ellipse(13, -22 + arm + (moving ? sw * 0.4 : 0), 4.5, 6.5, -0.2, 0, 7); g.fill();
  // hoofd met oren, bril en blosjes
  g.fillStyle = '#ffd7b0';
  g.beginPath(); g.moveTo(-11, -40); g.lineTo(-21, -46); g.lineTo(-12, -33); g.fill();
  g.beginPath(); g.moveTo(11, -40); g.lineTo(21, -46); g.lineTo(12, -33); g.fill();
  g.beginPath(); g.arc(0, -38, 12, 0, 7); g.fill();
  g.strokeStyle = '#111'; g.lineWidth = 2;
  g.fillStyle = c.type === 'shadow' ? '#cfe6ff' : '#fff';
  g.beginPath(); g.arc(-5, -40, 4.4, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.arc(5, -40, 4.4, 0, 7); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(-0.6, -40); g.lineTo(0.6, -40); g.stroke();
  g.fillStyle = c.type === 'shadow' ? '#7a5cff' : '#1b1b1b';
  g.beginPath(); g.arc(-4.4, -40, 1.8, 0, 7); g.arc(5.6, -40, 1.8, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,120,120,.45)'; g.beginPath(); g.arc(-8, -34, 2.4, 0, 7); g.arc(8, -34, 2.4, 0, 7); g.fill();
  g.strokeStyle = '#7a3a2a'; g.lineWidth = 1.6; g.beginPath(); g.arc(0, -35, 3.2, 0.2, 2.9); g.stroke();
  // muts
  g.fillStyle = look.hat;
  g.beginPath(); g.moveTo(-14, -45); g.quadraticCurveTo(-7, -55, c.type === 'wizard' ? 4 : 0, c.type === 'wizard' ? -76 : -68); g.quadraticCurveTo(c.type === 'wizard' ? 8 : 8, -54, 14, -45); g.quadraticCurveTo(0, -41, -14, -45); g.fill();
  g.fillStyle = look.hatD; g.beginPath(); g.ellipse(0, -45, c.type === 'wizard' ? 19 : 15, 3.6, 0, 0, 7); g.fill();
  if (c.type === 'wizard') { g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(-3, -56, 2.4, 0, 7); g.arc(3, -64, 1.8, 0, 7); g.fill(); }
  if (c.type === 'speed') { g.fillStyle = '#ffcf2e'; g.fillRect(-13, -47, 26, 4); }
  g.restore();
}

// de pijl boven de tikker
export function drawArrow(g, px, py, t) {
  g.save(); g.translate(px, py - 62 + Math.sin(t * 7) * 3);
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-7, -9); g.lineTo(7, -9); g.lineTo(0, 1); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

export function drawScene(g, game, backdrop, t) {
  g.drawImage(backdrop, 0, 0);
  for (const c of game.chars) {
    if (c.player && c.portal) { // het portaal is alleen voor jou zichtbaar
      g.save(); g.translate(c.portal.x * TS, c.portal.y * TS - 26);
      g.fillStyle = 'rgba(160,90,255,.35)'; g.beginPath(); g.ellipse(0, 0, 18, 28, 0, 0, 7); g.fill();
      g.strokeStyle = '#c79bff'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, 0, 14 + Math.sin(t * 6) * 2, 24, 0, 0, 7); g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 0, 7, 14, 0, t * 4, t * 4 + 4.5); g.stroke();
      g.restore();
    }
  }
  const order = game.chars.filter((c) => c.alive).sort((a, b) => a.y - b.y);
  for (const c of order) {
    drawGnome(g, c, t, { px: c.x * TS, py: c.y * TS });
    if (c.it) drawArrow(g, c.x * TS, c.y * TS, t);
    if (c.player) { // kleine markering zodat je jezelf terugvindt
      g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center';
      g.fillText(game.players === 2 ? String(c.id + 1) : 'JIJ', c.x * TS, c.y * TS + 15);
    }
  }
  for (const p of game.parts) { g.globalAlpha = Math.max(0, Math.min(1, p.life * 2)); g.fillStyle = p.col; g.beginPath(); g.arc(p.x * TS, p.y * TS, 3.5, 0, 7); g.fill(); }
  g.globalAlpha = 1;
}
