// Texturen voor de interieurs: baksteen, pleisterwerk, hout, tegels, beton, behang, steen en metaal, met schade (kale plekken, barsten, vlekken).
// Alles wordt één keer per level op een canvas getekend (buildStatic in draw.js), dus mag best wat rekenwerk kosten.
export const hash2 = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };

const parse = (c) => { if (c[0] === '#') { const n = parseInt(c.length === 4 ? c.replace(/./g, (m, i) => (i ? m + m : m)).slice(1) : c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; } const m = c.match(/\d+/g); return [+m[0], +m[1], +m[2]]; };
// amt -1..1: donkerder of lichter
export const shade = (c, amt, a = 1) => { const [r, g, b] = parse(c); const t = amt < 0 ? 0 : 255, k = Math.abs(amt); return `rgba(${Math.round(r + (t - r) * k)},${Math.round(g + (t - g) * k)},${Math.round(b + (t - b) * k)},${a})`; };
export const tint = (c, dr, dg, db) => { const [r, g, b] = parse(c); const f = (v) => Math.max(0, Math.min(255, Math.round(v))); return `rgb(${f(r + dr)},${f(g + dg)},${f(b + db)})`; };

let grainTile = null;
function grainPattern(g) {
  if (!grainTile) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const k = c.getContext('2d');
    const im = k.createImageData(128, 128);
    for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
    k.putImageData(im, 0, 0); grainTile = c;
  }
  return g.createPattern(grainTile, 'repeat');
}
// korrel over een gebied (laat een vlak minder 'plastic' uitzien)
export function grain(g, x, y, w, h, a = 0.08, mode = 'overlay') {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip(); g.globalCompositeOperation = mode; g.globalAlpha = a; g.fillStyle = grainPattern(g); g.fillRect(x, y, w, h); g.restore();
}
// zachte vlekken
export function blotches(g, x, y, w, h, n, r0, r1, color, alpha, seed = 0) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  for (let i = 0; i < n; i++) {
    const cx = x + hash2(i, 11, seed) * w, cy = y + hash2(i, 23, seed) * h, r = r0 + hash2(i, 37, seed) * (r1 - r0);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, shade(color, 0, alpha * (0.4 + hash2(i, 5, seed) * 0.6))); gr.addColorStop(1, shade(color, 0, 0));
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  }
  g.restore();
}
// een barst: een willekeurige lijn met een paar zijtakjes
export function crack(g, x, y, len, seed, color = 'rgba(30,24,20,.55)', width = 1.1) {
  g.save(); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round';
  const branch = (bx, by, ang, l, depth) => {
    g.beginPath(); g.moveTo(bx, by);
    let px = bx, py = by;
    for (let i = 0; i < l; i++) {
      ang += (hash2(i, depth, seed + (bx | 0)) - 0.5) * 1.1;
      px += Math.cos(ang) * 5; py += Math.sin(ang) * 5; g.lineTo(px, py);
      if (depth < 2 && hash2(i, depth + 9, seed + (by | 0)) > 0.8) branch(px, py, ang + (hash2(i, 4, seed) - 0.5) * 2.2, Math.floor(l / 2), depth + 1);
    }
    g.stroke();
  };
  branch(x, y, Math.PI / 2 + (hash2(1, 2, seed) - 0.5), len, 0);
  g.restore();
}
// een waterstreep van boven naar beneden
export function streak(g, x, y, h, w, color, alpha) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, shade(color, 0, alpha)); gr.addColorStop(1, shade(color, 0, 0));
  g.fillStyle = gr; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.lineTo(x + w * 0.2, y + h); g.lineTo(x - w * 0.2, y + h); g.closePath(); g.fill();
}
// een onregelmatige vlek (afgebroken pleister, schimmel)
function blob(g, cx, cy, r, seed, n = 11) {
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, rr = r * (0.6 + hash2(i % n, 3, seed) * 0.7);
    const px = cx + Math.cos(a) * rr * 1.3, py = cy + Math.sin(a) * rr * 0.85;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}

// ---------------------------------------------------------------- bakstenen
export function bricks(g, x, y, w, h, base, seed = 0, o = {}) {
  const bw = o.bw || 36, bh = o.bh || 15, gap = 2;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = o.mortar || shade(base, -0.45); g.fillRect(x, y, w, h);
  for (let r = 0, yy = y; yy < y + h; r++, yy += bh) {
    const off = (r % 2) * bw * 0.5;
    for (let xx = x - off; xx < x + w; xx += bw) {
      const v = hash2((xx / bw) | 0, r, seed);
      const k = (v - 0.5) * 0.34;
      g.fillStyle = shade(base, k + (hash2(r, (xx | 0), seed + 5) - 0.5) * 0.08);
      g.fillRect(xx + gap / 2, yy + gap / 2, bw - gap, bh - gap);
      // licht boven, schaduw onder: geeft reliëf
      g.fillStyle = 'rgba(255,255,255,.13)'; g.fillRect(xx + gap / 2, yy + gap / 2, bw - gap, 1.6);
      g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(xx + gap / 2, yy + bh - gap / 2 - 1.8, bw - gap, 1.8);
      if (v > 0.93) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(xx + 4 + v * 6, yy + 3, 6, 3); }
    }
  }
  grain(g, x, y, w, h, 0.18);
  g.restore();
}

// ---------------------------------------------------------------- pleisterwerk (met vlekken, barsten en kale plekken)
export function plaster(g, x, y, w, h, base, base2, seed = 0, damage = 0.2, o = {}) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, base); gr.addColorStop(1, base2 || shade(base, -0.12));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  blotches(g, x, y, w, h, 22, 30, 90, shade(base, -0.3), 0.16, seed);
  blotches(g, x, y, w, h, 14, 30, 80, shade(base, 0.4), 0.14, seed + 3);
  grain(g, x, y, w, h, 0.14);
  // schade
  const dmg = damage;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  if (dmg > 0.12) for (let i = 0; i < Math.round(dmg * w / 90); i++) streak(g, x + hash2(i, 7, seed) * w, y, 40 + hash2(i, 8, seed) * h * 0.8, 6 + hash2(i, 9, seed) * 14, '#3a2e22', 0.1 + dmg * 0.1);
  if (dmg > 0.18) for (let i = 0; i < Math.round(dmg * 4); i++) crack(g, x + 20 + hash2(i, 31, seed) * (w - 40), y + 6 + hash2(i, 32, seed) * h * 0.3, 5 + ((dmg * 8) | 0), seed + i);
  if (dmg > 0.3 && !o.noPatch) {
    // afgebrokkeld pleisterwerk: je ziet de bakstenen eronder
    const n = Math.min(4, Math.round(dmg * 4));
    for (let i = 0; i < n; i++) {
      const cx = x + 40 + hash2(i, 51, seed) * (w - 80), cy = y + 20 + hash2(i, 52, seed) * (h - 70), r = 18 + hash2(i, 53, seed) * 26 * dmg + 10;
      g.save(); blob(g, cx, cy, r, seed + i); g.clip();
      bricks(g, cx - r * 1.4, cy - r, r * 2.8, r * 2, '#9a5a44', seed + i * 7, { bw: 26, bh: 11 });
      g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(cx - r * 1.4, cy - r, r * 2.8, r * 2); g.restore();
      // een lichte rand en een schaduwrand: de pleisterlaag steekt iets uit
      g.save(); blob(g, cx, cy, r, seed + i); g.lineWidth = 2.5; g.strokeStyle = 'rgba(255,255,255,.28)'; g.stroke(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(0,0,0,.35)'; g.stroke(); g.restore();
    }
  }
  g.restore();
}

// ---------------------------------------------------------------- hout
export function wood(g, x, y, w, h, base, seed = 0, o = {}) {
  const pw = o.pw || 24, horiz = !!o.horizontal;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = shade(base, -0.5); g.fillRect(x, y, w, h);
  const len = horiz ? w : h, cnt = Math.ceil((horiz ? h : w) / pw) + 1;
  for (let i = 0; i < cnt; i++) {
    const v = hash2(i, 1, seed), p0 = (horiz ? y : x) + i * pw;
    g.save(); g.fillStyle = shade(base, (v - 0.5) * 0.3);
    if (horiz) g.fillRect(x, p0 + 1, w, pw - 2); else g.fillRect(p0 + 1, y, pw - 2, h);
    // nerf
    g.strokeStyle = shade(base, -0.28, 0.5); g.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      const off = 4 + hash2(i, k + 7, seed) * (pw - 8); g.beginPath();
      for (let s = 0; s <= len; s += 12) { const wob = Math.sin(s * 0.03 + i + k) * 1.8; const px = horiz ? x + s : p0 + off + wob, py = horiz ? p0 + off + wob : y + s; if (s === 0) g.moveTo(px, py); else g.lineTo(px, py); }
      g.stroke();
    }
    // knoest
    if (hash2(i, 77, seed) > 0.6) { const kk = hash2(i, 78, seed) * len, kx = horiz ? x + kk : p0 + pw / 2, ky = horiz ? p0 + pw / 2 : y + kk; g.fillStyle = shade(base, -0.4, 0.8); g.beginPath(); g.ellipse(kx, ky, 3.5, 5, horiz ? 1.57 : 0, 0, 7); g.fill(); g.strokeStyle = shade(base, -0.3, 0.6); g.beginPath(); g.ellipse(kx, ky, 6, 9, horiz ? 1.57 : 0, 0, 7); g.stroke(); }
    // licht aan de ene rand
    g.fillStyle = 'rgba(255,255,255,.1)'; if (horiz) g.fillRect(x, p0 + 1, w, 2); else g.fillRect(p0 + 1, y, 2, h);
    g.restore();
  }
  grain(g, x, y, w, h, 0.14);
  g.restore();
}

// ---------------------------------------------------------------- tegels
export function tiles(g, x, y, w, h, base, seed = 0, o = {}) {
  const ts = o.ts || 22;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = o.grout || shade(base, -0.4); g.fillRect(x, y, w, h);
  for (let ty = y, r = 0; ty < y + h; ty += ts, r++) for (let tx = x, c = 0; tx < x + w; tx += ts, c++) {
    const v = hash2(c, r, seed);
    g.fillStyle = shade(base, (v - 0.5) * 0.16 + (o.checker && (r + c) % 2 ? -0.14 : 0));
    g.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
    const gl = g.createLinearGradient(tx, ty, tx + ts, ty + ts); gl.addColorStop(0, 'rgba(255,255,255,.22)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,.12)');
    g.fillStyle = gl; g.fillRect(tx + 1, ty + 1, ts - 2, ts - 2);
    if (v > 0.96) crack(g, tx + 4 + v * 8, ty + 2, 3, c + r * 31 + seed, 'rgba(20,20,20,.5)', 0.9);
  }
  grain(g, x, y, w, h, 0.1);
  g.restore();
}

// ---------------------------------------------------------------- beton en metaal
export function concrete(g, x, y, w, h, base, seed = 0, damage = 0.3) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, base); gr.addColorStop(1, shade(base, -0.16));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  blotches(g, x, y, w, h, 26, 20, 70, '#222', 0.16, seed);
  blotches(g, x, y, w, h, 14, 30, 90, '#fff', 0.1, seed + 9);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // schalingsplaten met gaatjes
  g.strokeStyle = 'rgba(0,0,0,.28)'; g.lineWidth = 1.5;
  for (let xx = x + 96; xx < x + w; xx += 160) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); }
  for (let yy = y + 60; yy < y + h; yy += 90) { g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke(); }
  g.fillStyle = 'rgba(0,0,0,.35)'; for (let xx = x + 48; xx < x + w; xx += 160) for (let yy = y + 30; yy < y + h; yy += 90) { g.beginPath(); g.arc(xx, yy, 2.6, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(xx + 0.8, yy + 0.8, 2, 0, 7); g.fill(); g.fillStyle = 'rgba(0,0,0,.35)'; }
  for (let i = 0; i < Math.round(damage * 5); i++) crack(g, x + hash2(i, 2, seed) * w, y + hash2(i, 3, seed) * h * 0.4, 6 + (damage * 8 | 0), seed + i);
  for (let i = 0; i < Math.round(damage * w / 70); i++) streak(g, x + hash2(i, 4, seed) * w, y, 40 + hash2(i, 5, seed) * h, 8 + hash2(i, 6, seed) * 12, '#1c1812', 0.12);
  g.restore();
  grain(g, x, y, w, h, 0.18);
}
export function metal(g, x, y, w, h, base, seed = 0, damage = 0.5) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, shade(base, 0.08)); gr.addColorStop(1, shade(base, -0.2));
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const pw = 72;
  for (let xx = x; xx < x + w; xx += pw) {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(xx, y, 3, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(xx + 3, y, 2, h);
    for (let yy = y + 8; yy < y + h; yy += 26) { g.fillStyle = shade(base, -0.4); g.beginPath(); g.arc(xx + 10, yy, 2.4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.arc(xx + 9.4, yy - 0.6, 1, 0, 7); g.fill(); }
  }
  for (let yy = y + 90; yy < y + h; yy += 120) { g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x, yy, w, 2.5); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(x, yy + 2.5, w, 1.5); }
  for (let i = 0; i < Math.round(damage * w / 45); i++) streak(g, x + hash2(i, 4, seed) * w, y + hash2(i, 8, seed) * 40, 60 + hash2(i, 5, seed) * h * 0.7, 6 + hash2(i, 6, seed) * 10, '#7a3a1a', 0.18 + damage * 0.14);
  blotches(g, x, y, w, h, Math.round(damage * 12), 14, 40, '#6a3216', 0.3, seed);
  g.restore();
  grain(g, x, y, w, h, 0.2);
}

// ---------------------------------------------------------------- behang
export function wallpaper(g, x, y, w, h, base, seed = 0, damage = 0.2, o = {}) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  const ps = o.ps || 34;
  if (o.damask) {
    for (let xx = x, c = 0; xx < x + w; xx += ps, c++) for (let yy = y + (c % 2) * ps * 0.5, r = 0; yy < y + h; yy += ps, r++) {
      g.fillStyle = shade(base, 0.16, 0.55); g.beginPath(); g.moveTo(xx + ps / 2, yy + 4); g.quadraticCurveTo(xx + ps - 5, yy + ps / 2, xx + ps / 2, yy + ps - 4); g.quadraticCurveTo(xx + 5, yy + ps / 2, xx + ps / 2, yy + 4); g.fill();
      g.fillStyle = shade(base, -0.2, 0.55); g.beginPath(); g.arc(xx + ps / 2, yy + ps / 2, 2.4, 0, 7); g.fill();
    }
  } else {
    for (let xx = x; xx < x + w; xx += ps) { g.fillStyle = shade(base, -0.08, 0.6); g.fillRect(xx, y, ps / 2, h); g.fillStyle = shade(base, 0.12, 0.5); g.fillRect(xx + ps / 2, y, 2, h); }
  }
  // naden en verbleking
  g.strokeStyle = 'rgba(0,0,0,.12)'; g.lineWidth = 1; for (let xx = x + 140; xx < x + w; xx += 190) { g.beginPath(); g.moveTo(xx, y); g.lineTo(xx, y + h); g.stroke(); }
  blotches(g, x, y, w, h, 18, 30, 90, shade(base, -0.3), 0.18, seed);
  blotches(g, x, y, w, h, 10, 40, 100, shade(base, 0.5), 0.18, seed + 4);
  // loslatend behang in de hoek
  if (damage > 0.15) for (let i = 0; i < Math.round(damage * 3); i++) {
    const cx = x + hash2(i, 41, seed) * w, cy = y + 4 + hash2(i, 42, seed) * 30, r = 18 + damage * 26;
    g.save(); g.fillStyle = shade(base, 0.12); g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.quadraticCurveTo(cx + r * 0.6, cy + r * 1.1, cx - r * 0.2, cy + r * 1.4); g.quadraticCurveTo(cx - r, cy + r * 0.6, cx - r, cy); g.fill();
    g.fillStyle = 'rgba(0,0,0,.2)'; g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.lineTo(cx + r * 0.6, cy + 3); g.lineTo(cx - r, cy + 3); g.fill(); g.restore();
    g.fillStyle = shade(base, -0.4, 0.8); g.beginPath(); g.moveTo(cx - r, cy); g.lineTo(cx + r, cy); g.lineTo(cx + r * 0.6, cy - 12); g.lineTo(cx - r, cy - 12); g.fill();
  }
  if (damage > 0.25) for (let i = 0; i < 3; i++) streak(g, x + hash2(i, 61, seed) * w, y, 70 + hash2(i, 62, seed) * 80, 10, '#4a3a22', 0.16);
  g.restore();
  grain(g, x, y, w, h, 0.1);
}

// ---------------------------------------------------------------- natuursteen / blokken
export function stoneBlocks(g, x, y, w, h, base, seed = 0, damage = 0.3) {
  const bh = 26;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = shade(base, -0.5); g.fillRect(x, y, w, h);
  for (let r = 0, yy = y; yy < y + h; r++, yy += bh) {
    let xx = x - hash2(r, 3, seed) * 40;
    while (xx < x + w) {
      const bw = 40 + hash2(xx | 0, r, seed) * 44, v = hash2((xx | 0), r + 20, seed);
      const gr = g.createLinearGradient(xx, yy, xx, yy + bh); gr.addColorStop(0, shade(base, (v - 0.5) * 0.24 + 0.08)); gr.addColorStop(1, shade(base, (v - 0.5) * 0.24 - 0.1));
      g.fillStyle = gr; g.beginPath(); g.roundRect(xx + 1.5, yy + 1.5, bw - 3, bh - 3, 3); g.fill();
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(xx + 3, yy + 2, bw - 6, 2);
      if (v > 0.9 && damage > 0.2) { g.fillStyle = 'rgba(70,110,50,.35)'; g.beginPath(); g.ellipse(xx + bw / 2, yy + bh - 4, bw * 0.35, 5, 0, 0, 7); g.fill(); }
      xx += bw;
    }
  }
  for (let i = 0; i < Math.round(damage * 4); i++) crack(g, x + hash2(i, 2, seed) * w, y + hash2(i, 3, seed) * h * 0.5, 6, seed + i);
  g.restore();
  grain(g, x, y, w, h, 0.2);
}

// ---------------------------------------------------------------- paddenstoel-interieur: warm, rond en een beetje groeiend
export function mushroomWall(g, x, y, w, h, base, base2, seed = 0, damage = 0.2) {
  const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, shade(base, 0.08)); gr.addColorStop(1, base2);
  g.fillStyle = gr; g.fillRect(x, y, w, h);
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  // groeiringen en lamellen
  for (let yy = y + 10; yy < y + h; yy += 22) { g.strokeStyle = shade(base, -0.18, 0.35); g.lineWidth = 2; g.beginPath(); for (let xx = x; xx <= x + w; xx += 12) { const wob = Math.sin(xx * 0.025 + yy * 0.3 + seed) * 4; if (xx === x) g.moveTo(xx, yy + wob); else g.lineTo(xx, yy + wob); } g.stroke(); g.strokeStyle = shade(base, 0.35, 0.3); g.lineWidth = 1; g.beginPath(); for (let xx = x; xx <= x + w; xx += 12) { const wob = Math.sin(xx * 0.025 + yy * 0.3 + seed) * 4; if (xx === x) g.moveTo(xx, yy + wob + 3); else g.lineTo(xx, yy + wob + 3); } g.stroke(); }
  blotches(g, x, y, w, h, 20, 20, 70, shade(base, -0.4), 0.16, seed);
  blotches(g, x, y, w, h, 8, 24, 60, '#ffe8b0', 0.14, seed + 6);
  // mos in de hoeken
  blotches(g, x, y + h - 40, w, 40, Math.round(w / 60), 14, 36, '#4a8a3a', 0.3, seed + 12);
  for (let i = 0; i < Math.round(damage * 3); i++) crack(g, x + 30 + hash2(i, 31, seed) * (w - 60), y + 10, 5, seed + i, 'rgba(60,36,20,.45)');
  g.restore();
  grain(g, x, y, w, h, 0.14);
}
