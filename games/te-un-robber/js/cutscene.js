// Tussenfilmpjes van Te-Un the Robber: titelkaarten, getekende taferelen en ondertitels. Alles procedureel op canvas.
// Gebruik: playCutscene(canvas, id, onDone, opts) met opts.sfx(naam) optioneel. Het tekenwerk per beeld staat in SCENES, in dezelfde volgorde als CUTSCENES in story.js.
import { CHAPTERS, CUTSCENES } from './story.js';
import { drawTeUn, drawGnome, drawNico, drawRobotChar, drawCop, drawPlane, drawMoneyBag, drawSuitcase } from './chars.js';

const W = 1280, H = 720, FONT = 'Fredoka, sans-serif', TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sstep = (k) => { k = clamp(k); return k * k * (3 - 2 * k); };
const prog = (t, a, b) => clamp((t - a) / (b - a));
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const grad = (g, x0, y0, x1, y1, stops) => { const gr = g.createLinearGradient(x0, y0, x1, y1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; };
const rgrad = (g, x, y, r0, r1, stops) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); for (const [o, c] of stops) gr.addColorStop(o, c); return gr; };
const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const txt = (g, s, x, y, size, col, align = 'center', w = 600, style = '') => { g.font = `${style}${w} ${size}px ${FONT}`; g.textAlign = align; g.fillStyle = col; g.fillText(s, x, y); };

// ---- cache voor dure statische lagen (wordt na afloop van elke cutscene geleegd)
let CACHE = {};
const mkc = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function L(key, w, h, fn) { let c = CACHE[key]; if (!c) { c = mkc(w, h); fn(c.getContext('2d'), w, h); CACHE[key] = c; } return c; }
const SW = 1800, SLACK = (SW - W) / 2;            // brede lagen voor parallax
const px = (f, cam) => -SLACK - clamp(cam, -SLACK / Math.max(f, 0.3), SLACK / Math.max(f, 0.3)) * f;

// ---- kleine tekenhulpjes
function glow(g, x, y, r, col, a = 1) { g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= a; g.fillStyle = rgrad(g, x, y, 0, r, [[0, col], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); }
function shadow(g, x, y, w, a = 0.35) { g.save(); g.fillStyle = `rgba(0,0,0,${a})`; g.beginPath(); g.ellipse(x, y, w, w * 0.16, 0, 0, TAU); g.fill(); g.restore(); }
function stars(g, n, seed, w, ymax, sz = 1.6) { const r = rng(seed); g.fillStyle = '#fff'; for (let i = 0; i < n; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.beginPath(); g.arc(r() * w, r() * ymax, r() * sz + 0.3, 0, TAU); g.fill(); } g.globalAlpha = 1; }
function moon(g, x, y, r) { g.fillStyle = rgrad(g, x, y, r * 0.8, r * 4, [[0, 'rgba(200,220,255,.35)'], [1, 'rgba(200,220,255,0)']]); g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8); g.fillStyle = grad(g, x - r, y - r, x + r, y + r, [[0, '#fffbe8'], [1, '#c8d4e8']]); g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.fillStyle = 'rgba(120,140,170,.25)'; for (const [dx, dy, rr2] of [[-.3, -.2, .22], [.25, .15, .28], [-.1, .4, .15]]) { g.beginPath(); g.arc(x + dx * r, y + dy * r, rr2 * r, 0, TAU); g.fill(); } }
function ridge(g, w, base, amp, seed, fill, step = 24) { g.fillStyle = fill; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= w + step; x += step) g.lineTo(x, base + (Math.sin(x * 0.0042 + seed) + Math.sin(x * 0.011 + seed * 2.3) * 0.5 + Math.sin(x * 0.027 + seed * 5) * 0.15) * amp); g.lineTo(w, H); g.closePath(); g.fill(); }
function pine(g, x, y, h, c1, c2) { const w = h * 0.38; g.fillStyle = '#2a1c14'; g.fillRect(x - h * 0.03, y - h * 0.12, h * 0.06, h * 0.12); for (let i = 0; i < 4; i++) { const yy = y - h * 0.1 - i * h * 0.22, ww = w * (1 - i * 0.2); g.fillStyle = i % 2 ? c1 : c2; g.beginPath(); g.moveTo(x - ww, yy); g.lineTo(x, yy - h * 0.34); g.lineTo(x + ww, yy); g.closePath(); g.fill(); } }
function tree(g, x, y, h, c1, c2) { g.fillStyle = '#3a2a1c'; g.fillRect(x - h * 0.04, y - h * 0.4, h * 0.08, h * 0.4); for (const [dx, dy, r] of [[0, -0.62, 0.3], [-0.2, -0.5, 0.22], [0.2, -0.5, 0.22], [0.05, -0.8, 0.2]]) { g.fillStyle = grad(g, x + dx * h - r * h, y + dy * h - r * h, x + dx * h + r * h, y + dy * h + r * h, [[0, c1], [1, c2]]); g.beginPath(); g.arc(x + dx * h, y + dy * h, r * h, 0, TAU); g.fill(); } }
function clouds(g, t, o = {}) {
  const { y = 120, n = 6, a = 0.85, sp = 14, col = '#ffffff', sc = 1, seed = 3, shade = 'rgba(150,170,200,.5)' } = o; const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const bx = r() * (W + 500), by = y + r() * 150 * sc, s = (0.7 + r() * 0.8) * sc, x = ((bx + t * sp * (0.6 + r() * 0.8)) % (W + 500)) - 250;
    g.save(); g.translate(x, by); g.scale(s, s); g.globalAlpha = a;
    for (const [dx, dy, rad] of [[0, 0, 34], [40, -10, 42], [88, 0, 34], [44, 12, 38], [-24, 10, 24], [112, 10, 24]]) { g.fillStyle = col; g.beginPath(); g.arc(dx, dy, rad, 0, TAU); g.fill(); }
    g.fillStyle = shade; g.beginPath(); g.ellipse(48, 28, 80, 14, 0, 0, TAU); g.fill(); g.restore();
  }
}
function smokeAt(g, x, y, t, seed = 0, col = '170,170,180', up = 110) {
  for (let i = 0; i < 6; i++) { const ph = (t * 0.22 + i / 6 + seed * 0.37) % 1; const yy = y - ph * up, xx = x + Math.sin(ph * 5 + seed + i) * 10 * ph + ph * 22; g.fillStyle = `rgba(${col},${(1 - ph) * 0.5})`; g.beginPath(); g.arc(xx, yy, 5 + ph * 20, 0, TAU); g.fill(); }
}
function fireflies(g, t, n, seed, x0 = 0, x1 = W, y0 = 300, y1 = 560, col = 'rgba(255,240,140,1)') {
  const r = rng(seed); g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) { const bx = x0 + r() * (x1 - x0), by = y0 + r() * (y1 - y0), ph = r() * 9, x = bx + Math.sin(t * 0.5 + ph) * 30, y = by + Math.cos(t * 0.7 + ph * 1.3) * 22, a = 0.5 + 0.5 * Math.sin(t * 2.2 + ph); g.fillStyle = rgrad(g, x, y, 0, 9, [[0, col], [1, 'rgba(255,220,80,0)']]); g.globalAlpha = a * 0.9; g.fillRect(x - 9, y - 9, 18, 18); g.globalAlpha = a; g.fillStyle = '#fffbd0'; g.fillRect(x - 1, y - 1, 2, 2); }
  g.restore();
}
function rain(g, t, n = 160, a = 0.35, ang = 0.25, len = 26, seed = 5, col = '200,220,255') {
  const r = rng(seed); g.strokeStyle = `rgba(${col},${a})`; g.lineWidth = 1.3; g.beginPath();
  for (let i = 0; i < n; i++) { const sp = 700 + r() * 500, x0 = r() * (W + 200), y = ((r() * H + t * sp) % (H + 60)) - 30, x = (x0 - y * ang) ; g.moveTo(x, y); g.lineTo(x - len * ang, y + len); }
  g.stroke();
}
function beam(g, x, y, ang, len, w0, w1, col, a = 0.3) { g.save(); g.translate(x, y); g.rotate(ang); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, 0, 0, len, 0, [[0, col.replace('A', a)], [1, col.replace('A', 0)]]); g.beginPath(); g.moveTo(0, -w0 / 2); g.lineTo(len, -w1 / 2); g.lineTo(len, w1 / 2); g.lineTo(0, w0 / 2); g.closePath(); g.fill(); g.restore(); }
function sparkle(g, x, y, r, a = 1, col = '#fff6b0') { g.save(); g.globalAlpha *= a; g.fillStyle = col; g.beginPath(); g.moveTo(x, y - r); g.quadraticCurveTo(x, y, x + r, y); g.quadraticCurveTo(x, y, x, y + r); g.quadraticCurveTo(x, y, x - r, y); g.quadraticCurveTo(x, y, x, y - r); g.fill(); g.restore(); }
function zoomAt(g, z, fx, fy) { g.translate(fx, fy); g.scale(z, z); g.translate(-fx, -fy); }
const shake = (g, t, amp, sp = 40) => g.translate(Math.sin(t * sp) * amp + Math.sin(t * sp * 1.7) * amp * 0.5, Math.cos(t * sp * 1.3) * amp);
function tint(g, col, a = 1, op = 'source-over') { g.save(); g.globalCompositeOperation = op; g.globalAlpha = a; g.fillStyle = col; g.fillRect(-100, -100, W + 200, H + 200); g.restore(); }
function bubble(g, x, y, w, h, tailX, tailY) { g.save(); g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = '#2a2d38'; g.lineWidth = 3; rr(g, x, y, w, h, h / 2.2); g.fill(); g.stroke(); for (let i = 0; i < 3; i++) { const k = (i + 1) / 4; g.beginPath(); g.arc(lerp(tailX, x + w * 0.3, k), lerp(tailY, y + h, k), 6 + i * 3 - 2, 0, TAU); g.fill(); g.stroke(); } g.restore(); }

// ---- eenvoudige mensen en fietsers
function person(g, x, y, s, col, t, o = {}) {
  const { walk = 0, face = 1, skin = '#e8c09a', hair = '#2a1c14', hat = null, alpha = 1, legs = '#2a2f40', arm = 0 } = o;
  g.save(); g.translate(x, y); g.scale(s * face, s); g.globalAlpha *= alpha; const sw = Math.sin(walk);
  g.lineCap = 'round'; g.strokeStyle = legs; g.lineWidth = 6; g.beginPath(); g.moveTo(-3, -22); g.lineTo(-3 + sw * 6, -2); g.moveTo(4, -22); g.lineTo(4 - sw * 6, -2); g.stroke();
  g.fillStyle = grad(g, -9, -48, 9, -20, [[0, col], [1, 'rgba(0,0,0,.45)']]); rr(g, -9, -46, 18, 26, 6); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; g.globalCompositeOperation = 'source-over';
  g.fillStyle = col; g.strokeStyle = col; g.lineWidth = 5; g.beginPath(); g.moveTo(6, -42); g.lineTo(10 + Math.sin(arm) * 4, -26 - Math.max(0, Math.sin(arm)) * 14); g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(0, -56, 9, 0, TAU); g.fill(); g.fillStyle = hair; g.beginPath(); g.arc(0, -58, 9.4, Math.PI * 1.05, Math.PI * 1.95); g.fill();
  if (hat) { g.fillStyle = hat; g.beginPath(); g.ellipse(0, -63, 11, 4, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0, -64, 7, Math.PI, 0); g.fill(); }
  g.fillStyle = '#1a1c24'; g.fillRect(2, -58, 2, 2); g.restore();
}
function bike(g, x, y, s, t, col = '#d03a2a', rider = '#3a6ad0', face = 1) {
  g.save(); g.translate(x, y); g.scale(s * face, s); const sp = t * 7;
  g.strokeStyle = '#1a1c22'; g.lineWidth = 3;
  for (const wx of [-26, 26]) { g.beginPath(); g.arc(wx, -17, 17, 0, TAU); g.stroke(); g.lineWidth = 1; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(wx, -17); g.lineTo(wx + Math.cos(sp + i * 1.05) * 17, -17 + Math.sin(sp + i * 1.05) * 17); g.stroke(); } g.lineWidth = 3; }
  g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(-26, -17); g.lineTo(-6, -38); g.lineTo(20, -38); g.lineTo(26, -17); g.moveTo(-6, -38); g.lineTo(0, -17); g.lineTo(-26, -17); g.moveTo(20, -38); g.lineTo(22, -52); g.moveTo(14, -52); g.lineTo(28, -52); g.stroke();
  const px2 = Math.cos(sp) * 7, py2 = Math.sin(sp) * 7; g.strokeStyle = '#2a2f40'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-6, -52); g.lineTo(0 + px2, -17 + py2); g.stroke();
  g.fillStyle = rider; rr(g, -14, -76, 18, 28, 7); g.fill(); g.strokeStyle = rider; g.lineWidth = 5; g.beginPath(); g.moveTo(-2, -68); g.lineTo(22, -52); g.stroke();
  g.fillStyle = '#e8c09a'; g.beginPath(); g.arc(-4, -86, 9, 0, TAU); g.fill(); g.fillStyle = '#e8b030'; g.beginPath(); g.arc(-5, -89, 9.5, Math.PI, 0); g.fill(); g.restore();
}

// ================================================================ ACHTERGRONDEN (statische lagen in de cache, dynamisch werk erbovenop)
const GY = 545; // grondlijn waar de personages op staan
function skyLayer(key, stops, o = {}) {
  return L(key, W, H, (g) => { g.fillStyle = grad(g, 0, 0, 0, H, stops); g.fillRect(0, 0, W, H); if (o.stars) stars(g, o.stars, 11, W, o.starsY || 380); if (o.moon) moon(g, o.moon[0], o.moon[1], o.moon[2] || 40); if (o.sun) { glow(g, o.sun[0], o.sun[1], o.sun[2] || 380, o.sunCol || 'rgba(255,190,110,.9)'); g.fillStyle = o.sunCore || '#fff2c8'; g.beginPath(); g.arc(o.sun[0], o.sun[1], o.sun[3] || 46, 0, TAU); g.fill(); } });
}
function windowGlow(g, x, y, r, on = 1) { g.fillStyle = on ? grad(g, x, y - r, x, y + r, [[0, '#ffe9a0'], [1, '#ffb347']]) : '#7ab0d8'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#5a3a1e'; g.lineWidth = Math.max(1.5, r * 0.18); g.stroke(); g.beginPath(); g.moveTo(x - r, y); g.lineTo(x + r, y); g.moveTo(x, y - r); g.lineTo(x, y + r); g.stroke(); }
// paddenstoelhuisje: (x, y) = midden grond. Geeft de plaats van de schoorsteentop terug.
function shroom(g, x, y, s, cap, o = {}) {
  const on = o.on ?? 1, spots = o.spots ?? '#fff8ee';
  g.save(); g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(x, y, 60 * s, 8 * s, 0, 0, TAU); g.fill(); g.restore();
  g.fillStyle = '#7a3a2a'; g.fillRect(x + 28 * s, y - 150 * s, 16 * s, 70 * s); g.fillStyle = '#5a2a1e'; g.fillRect(x + 26 * s, y - 154 * s, 20 * s, 6 * s);
  g.fillStyle = grad(g, x - 44 * s, 0, x + 44 * s, 0, [[0, '#f6ead0'], [0.7, '#e2cfa4'], [1, '#b49c6e']]);
  g.beginPath(); g.moveTo(x - 42 * s, y); g.quadraticCurveTo(x - 32 * s, y - 50 * s, x - 30 * s, y - 90 * s); g.lineTo(x + 30 * s, y - 90 * s); g.quadraticCurveTo(x + 32 * s, y - 50 * s, x + 42 * s, y); g.closePath(); g.fill();
  g.fillStyle = '#6a3e1e'; g.beginPath(); g.moveTo(x - 12 * s, y); g.lineTo(x - 12 * s, y - 36 * s); g.arc(x, y - 36 * s, 12 * s, Math.PI, 0); g.lineTo(x + 12 * s, y); g.fill();
  g.fillStyle = '#e8c050'; g.beginPath(); g.arc(x + 6 * s, y - 20 * s, 1.8 * s, 0, TAU); g.fill();
  g.fillStyle = '#5a8a3a'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(x - 40 * s + i * 5 * s, y - 2 * s, 5 * s, 9 * s, 0.4 * (i % 2 ? 1 : -1), 0, TAU); g.fill(); }
  windowGlow(g, x - 20 * s, y - 62 * s, 8 * s, on); windowGlow(g, x + 20 * s, y - 62 * s, 8 * s, on);
  if (on) glow(g, x, y - 50 * s, 60 * s, 'rgba(255,190,90,.35)');
  g.fillStyle = 'rgba(0,0,0,.28)'; g.beginPath(); g.ellipse(x, y - 88 * s, 52 * s, 10 * s, 0, 0, TAU); g.fill();
  g.fillStyle = grad(g, x - 80 * s, y - 150 * s, x + 80 * s, y - 80 * s, [[0, cap], [0.55, cap], [1, 'rgba(30,10,30,.9)']]);
  g.beginPath(); g.moveTo(x - 84 * s, y - 86 * s); g.bezierCurveTo(x - 90 * s, y - 160 * s, x - 40 * s, y - 168 * s, x, y - 168 * s); g.bezierCurveTo(x + 40 * s, y - 168 * s, x + 90 * s, y - 160 * s, x + 84 * s, y - 86 * s); g.quadraticCurveTo(x, y - 74 * s, x - 84 * s, y - 86 * s); g.fill();
  g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.ellipse(x - 34 * s, y - 138 * s, 28 * s, 10 * s, -0.5, 0, TAU); g.fill();
  g.fillStyle = spots; for (const [dx, dy, r] of [[-50, -124, 10], [-20, -150, 8], [24, -140, 11], [58, -112, 8], [-62, -100, 6], [6, -118, 6], [40, -158, 5]]) { g.beginPath(); g.ellipse(x + dx * s, y + dy * s, r * s, r * s * 0.8, 0, 0, TAU); g.fill(); }
  return { x: x + 36 * s, y: y - 154 * s };
}

// ---------------------------------------------------------------- Kabouterdorp
const VIL = {
  dusk: { sky: [[0, '#1d1a4c'], [0.4, '#6a3470'], [0.7, '#e5705a'], [1, '#ffc47a']], far: '#6a4a82', far2: '#7a5688', tr: ['#34364a', '#232536'], g1: '#5f8a3e', g2: '#2f5a2a', on: 1, ck: ['#d8362a', '#3a6ad0', '#e0a020', '#c84a8a', '#8a5ac8'] },
  night: { sky: [[0, '#05081a'], [0.55, '#0f1a40'], [1, '#26386a']], far: '#1c2a52', far2: '#233562', tr: ['#16213a', '#0d1426'], g1: '#2a4a46', g2: '#12281f', on: 1, ck: ['#a8281e', '#2a52a8', '#b88218', '#982f68', '#6a46a0'] },
  morning: { sky: [[0, '#5eb4f0'], [0.5, '#b4e2ff'], [0.85, '#fff0c4'], [1, '#ffe0a0']], far: '#8ab8d8', far2: '#7ab07a', tr: ['#4a9a4a', '#2f7a3a'], g1: '#78c04a', g2: '#3f8a34', on: 0, ck: ['#e8402e', '#3a7ae0', '#f0b020', '#e0508a', '#9a62d8'] },
};
function villageBg(g, t, cam = 0, mood = 'dusk', o = {}) {
  const P = VIL[mood], K = 'vil_' + mood;
  g.drawImage(skyLayer(K + 's', P.sky, mood === 'dusk' ? { stars: 90, starsY: 220, sun: [880, 440, 420, 52], sunCol: 'rgba(255,170,100,.85)' } : mood === 'night' ? { stars: 220, starsY: 420, moon: [1010, 130, 46] } : { sun: [1020, 120, 420, 56], sunCol: 'rgba(255,240,180,.9)' }), 0, 0);
  clouds(g, t, { y: 60, n: 5, a: mood === 'night' ? 0.12 : mood === 'dusk' ? 0.35 : 0.9, sp: 9, col: mood === 'dusk' ? '#ffb6a0' : '#fff', seed: 4, shade: 'rgba(120,100,150,.25)' });
  g.drawImage(L(K + 'f', SW, H, (c) => {
    ridge(c, SW, 400, 28, 1, P.far); ridge(c, SW, 440, 22, 4, P.far2);
    const r = rng(9); for (let i = 0; i < 9; i++) { const x = 60 + i * 210 + r() * 60; shroom(c, x, 470 + r() * 8, 0.32 + r() * 0.08, P.ck[i % 5], { on: P.on }); }
    ridge(c, SW, 480, 10, 7, P.far2);
  }), o.loop ? -(((cam * 0.15) % SW) + SW) % SW : px(0.15, cam), 0);
  if (o.loop) g.drawImage(CACHE[K + 'f'], -(((cam * 0.15) % SW) + SW) % SW + SW, 0);
  const mid = L(K + 'm', SW, H, (c) => {
    const r = rng(21);
    for (let i = 0; i < 30; i++) { const x = i * 62 + r() * 40; (i % 3 ? pine : tree)(c, x, 524 + r() * 12, 130 + r() * 80, P.tr[0], P.tr[1]); }
    CACHE[K + 'ch'] = [];
    [[190, 1.0, 0], [520, 1.3, 1], [905, 0.95, 2], [1230, 1.2, 3], [1590, 1.05, 4]].forEach(([x, s, ci]) => { CACHE[K + 'ch'].push(shroom(c, x, 535, s, P.ck[ci], { on: P.on })); });
  });
  const mx = o.loop ? -(((cam * 0.45) % SW) + SW) % SW : px(0.45, cam); g.drawImage(mid, mx, 0); if (o.loop) g.drawImage(mid, mx + SW, 0);
  if (!o.loop) for (const [i, ch] of (CACHE[K + 'ch'] || []).entries()) smokeAt(g, ch.x + mx, ch.y, t, i, mood === 'morning' ? '240,240,250' : '180,170,190', 110);
  g.drawImage(L(K + 'n', SW, H, (c) => {
    c.fillStyle = grad(c, 0, 515, 0, H, [[0, P.g1], [1, P.g2]]); c.fillRect(0, 515, SW, H - 515);
    c.fillStyle = grad(c, 0, 540, 0, 640, [[0, 'rgba(214,180,120,.85)'], [1, 'rgba(150,110,70,.85)']]); c.beginPath(); c.moveTo(0, 552); for (let x = 0; x <= SW; x += 30) c.lineTo(x, 552 + Math.sin(x * 0.01) * 7); for (let x = SW; x >= 0; x -= 30) c.lineTo(x, 606 + Math.sin(x * 0.008 + 2) * 9); c.closePath(); c.fill();
    const r = rng(33); for (let i = 0; i < 160; i++) { const x = r() * SW, y = 520 + r() * 190; c.fillStyle = ['#ffd84a', '#ff7a9a', '#fff', '#b48aff'][i % 4]; if (y > 548 && y < 612) continue; c.beginPath(); c.arc(x, y, 2 + (y - 520) * 0.012, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(60,35,18,.9)'; c.lineWidth = 6; for (let x = 20; x < SW; x += 70) { c.beginPath(); c.moveTo(x, 536); c.lineTo(x, 506); c.stroke(); } c.lineWidth = 4; c.beginPath(); c.moveTo(0, 517); c.lineTo(SW, 517); c.moveTo(0, 528); c.lineTo(SW, 528); c.stroke();
  }), o.loop ? -(((cam) % SW) + SW) % SW : px(1, cam), 0);
  if (o.loop) g.drawImage(CACHE[K + 'n'], -(((cam) % SW) + SW) % SW + SW, 0);
  if (mood !== 'morning') fireflies(g, t, 26, 5, 0, W, 330, 560);
  else { g.strokeStyle = '#2a2f3a'; g.lineWidth = 2; for (let i = 0; i < 4; i++) { const x = ((t * 60 + i * 340) % (W + 200)) - 100, y = 120 + i * 40 + Math.sin(t * 2 + i) * 12, f = Math.sin(t * 12 + i) * 6; g.beginPath(); g.moveTo(x - 10, y + f); g.quadraticCurveTo(x - 5, y - 6, x, y); g.quadraticCurveTo(x + 5, y - 6, x + 10, y + f); g.stroke(); } }
  if (mood === 'dusk') { g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, W, 0, W - 500, H, [[0, 'rgba(255,170,90,.12)'], [1, 'rgba(255,170,90,0)']]); g.fillRect(0, 0, W, H); g.restore(); }
}
// de Paddenstoelenbank (gebouw op eigen canvas, 700x560, voeten op y=520)
function bankSprite() {
  return L('bank_m', 700, 560, (g) => {
    const cx = 350; g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, 524, 300, 16, 0, 0, TAU); g.fill();
    g.fillStyle = grad(g, 0, 300, 0, 520, [[0, '#efe0c0'], [1, '#bda676']]); g.fillRect(cx - 230, 300, 460, 220);
    g.fillStyle = '#9c8658'; for (let i = 0; i < 3; i++) g.fillRect(cx - 250 + i * 6, 510 + i * 4 - 4, 500 - i * 12, 8);
    for (const dx of [-190, -120, 120, 190]) { g.fillStyle = grad(g, cx + dx - 18, 0, cx + dx + 18, 0, [[0, '#fff6e0'], [0.6, '#e2d2aa'], [1, '#a89468']]); g.fillRect(cx + dx - 18, 300, 36, 210); g.fillStyle = '#d4bf86'; g.fillRect(cx + dx - 24, 294, 48, 12); g.fillRect(cx + dx - 24, 504, 48, 10); }
    g.fillStyle = '#1a1420'; g.beginPath(); g.moveTo(cx - 62, 520); g.lineTo(cx - 62, 410); g.arc(cx, 410, 62, Math.PI, 0); g.lineTo(cx + 62, 520); g.fill();
    g.fillStyle = grad(g, cx - 56, 0, cx + 56, 0, [[0, '#9aa4ae'], [0.5, '#e0e6ea'], [1, '#808a94']]); g.beginPath(); g.arc(cx, 440, 52, 0, TAU); g.fill(); g.strokeStyle = '#3a4048'; g.lineWidth = 5; g.stroke(); g.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(cx + Math.cos(a) * 14, 440 + Math.sin(a) * 14); g.lineTo(cx + Math.cos(a) * 44, 440 + Math.sin(a) * 44); g.stroke(); } g.fillStyle = '#e8c64a'; g.beginPath(); g.arc(cx, 440, 12, 0, TAU); g.fill(); g.stroke();
    for (const dx of [-155, 155]) { g.fillStyle = '#ffd26a'; g.beginPath(); g.arc(cx + dx, 370, 22, 0, TAU); g.fill(); g.strokeStyle = '#6a4a22'; g.lineWidth = 4; g.stroke(); g.beginPath(); g.moveTo(cx + dx - 22, 370); g.lineTo(cx + dx + 22, 370); g.moveTo(cx + dx, 348); g.lineTo(cx + dx, 392); g.stroke(); }
    g.fillStyle = 'rgba(0,0,0,.3)'; g.beginPath(); g.ellipse(cx, 304, 250, 18, 0, 0, TAU); g.fill();
    g.fillStyle = grad(g, 60, 80, 640, 300, [[0, '#d8362a'], [0.6, '#b02a22'], [1, '#6a1418']]); g.beginPath(); g.moveTo(cx - 290, 300); g.bezierCurveTo(cx - 310, 110, cx - 130, 40, cx, 40); g.bezierCurveTo(cx + 130, 40, cx + 310, 110, cx + 290, 300); g.quadraticCurveTo(cx, 330, cx - 290, 300); g.fill();
    g.fillStyle = 'rgba(255,255,255,.16)'; g.beginPath(); g.ellipse(cx - 120, 110, 90, 24, -0.4, 0, TAU); g.fill();
    g.fillStyle = '#fff8ee'; for (const [dx, dy, r] of [[-190, 180, 30], [-80, 110, 24], [60, 140, 34], [180, 210, 26], [-230, 250, 18], [150, 90, 16], [-10, 230, 20]]) { g.beginPath(); g.ellipse(cx + dx, dy, r, r * 0.8, 0, 0, TAU); g.fill(); }
    rr(g, cx - 175, 236, 350, 54, 10); g.fillStyle = '#3a2a10'; g.fill(); rr(g, cx - 169, 242, 338, 42, 7); g.fillStyle = grad(g, 0, 242, 0, 284, [[0, '#f4d870'], [1, '#c89a2c']]); g.fill();
    txt(g, 'PADDENSTOELENBANK', cx, 273, 30, '#4a3208', 'center', 700);
  });
}
// ---------------------------------------------------------------- Vliegveld van de kabouters
function airportBg(g, t, cam = 0, mood = 'night') {
  const night = mood === 'night', K = 'apt_' + mood;
  g.drawImage(skyLayer(K + 's', night ? [[0, '#05081a'], [0.6, '#16224a'], [1, '#3a3a6a']] : [[0, '#5eb4f0'], [0.7, '#c4e6ff'], [1, '#ffe8b8']], night ? { stars: 200, starsY: 400, moon: [200, 120, 38] } : { sun: [300, 140, 400, 50] }), 0, 0);
  g.drawImage(L(K + 'f', SW, H, (c) => { ridge(c, SW, 420, 30, 2, night ? '#1c2a52' : '#8ab8d8'); ridge(c, SW, 470, 22, 6, night ? '#142040' : '#7ab07a'); const r = rng(8); for (let i = 0; i < 40; i++) pine(c, r() * SW, 500 + r() * 8, 70 + r() * 50, night ? '#15223a' : '#4a9a4a', night ? '#0e182c' : '#2f7a3a'); }), px(0.15, cam), 0);
  const ox = px(0.5, cam);
  g.drawImage(L(K + 'm', SW, H, (c) => {
    // klein terminalgebouw met paddenstoeldak
    const cx = 640; c.fillStyle = grad(c, 0, 400, 0, 540, [[0, '#e8dcc0'], [1, '#b4a078']]); rr(c, cx - 190, 420, 380, 110, 6); c.fill();
    c.fillStyle = grad(c, 0, 340, 0, 430, [[0, '#d8362a'], [1, '#8a1c18']]); c.beginPath(); c.moveTo(cx - 230, 428); c.bezierCurveTo(cx - 230, 340, cx - 90, 330, cx, 330); c.bezierCurveTo(cx + 90, 330, cx + 230, 340, cx + 230, 428); c.quadraticCurveTo(cx, 446, cx - 230, 428); c.fill();
    c.fillStyle = '#fff8ee'; for (const [dx, dy] of [[-150, 392], [-70, 362], [40, 372], [140, 396], [100, 348]]) { c.beginPath(); c.ellipse(cx + dx, dy, 14, 10, 0, 0, TAU); c.fill(); }
    for (let i = 0; i < 6; i++) { c.fillStyle = night ? '#ffd27a' : '#8ac8f0'; rr(c, cx - 160 + i * 56, 450, 40, 50, 18); c.fill(); }
    c.fillStyle = '#2a1c14'; rr(c, cx - 22, 478, 44, 52, [20, 20, 0, 0]); c.fill();
    rr(c, cx - 110, 404, 220, 26, 6); c.fillStyle = '#243c78'; c.fill(); txt(c, 'VLIEGVELD', cx, 425, 22, '#fff', 'center', 700);
    // verkeerstoren
    c.fillStyle = grad(c, 0, 250, 0, 520, [[0, '#d8ccb0'], [1, '#a89868']]); c.fillRect(1010, 330, 36, 190); c.fillStyle = '#243c78'; rr(c, 986, 280, 84, 54, 10); c.fill(); c.fillStyle = night ? '#ffe9a0' : '#9ad0f0'; rr(c, 994, 288, 68, 22, 6); c.fill(); c.fillStyle = '#d03a2a'; c.fillRect(1026, 250, 4, 30);
    // hangaar
    c.fillStyle = grad(c, 0, 440, 0, 530, [[0, '#9aa8b8'], [1, '#6a7888']]); c.beginPath(); c.moveTo(250, 530); c.lineTo(250, 470); c.quadraticCurveTo(340, 410, 430, 470); c.lineTo(430, 530); c.fill(); c.fillStyle = '#4a5666'; rr(c, 290, 478, 100, 52, [30, 30, 0, 0]); c.fill();
  }), ox, 0);
  const bx = 1026 + ox, by = 250; if (night) { g.save(); g.translate(bx + 2, by); const a = t * 2; const gr = g.createLinearGradient(0, 0, Math.cos(a) * 300, 0); g.fillStyle = 'rgba(255,250,200,.12)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * 320, -30); g.lineTo(Math.cos(a) * 320, 30); g.fill(); g.restore(); glow(g, bx + 2, by, 26, '#ffdc78', 0.5 + 0.5 * Math.sin(t * 2)); }
  g.drawImage(L(K + 'n', SW, H, (c) => {
    c.fillStyle = grad(c, 0, 500, 0, H, [[0, night ? '#2e3a4c' : '#8a929c'], [1, night ? '#1a222e' : '#5a626c']]); c.fillRect(0, 520, SW, 140);
    c.fillStyle = grad(c, 0, 640, 0, H, [[0, night ? '#244a36' : '#78b04a'], [1, night ? '#102a1c' : '#3a7a32']]); c.fillRect(0, 650, SW, 70);
    c.fillStyle = 'rgba(255,255,255,.7)'; for (let x = 0; x < SW; x += 120) c.fillRect(x, 596, 64, 8);
    c.fillStyle = '#e8c64a'; c.fillRect(0, 524, SW, 4); c.fillRect(0, 646, SW, 4);
  }), px(1, cam), 0);
  const nx = px(1, cam); for (let x = 20; x < SW; x += 90) for (const y of [528, 650]) { const on = (Math.floor(t * 2 + x / 90) % 4) !== 0; if (night) glow(g, x + nx, y, 14, y < 600 ? '#6ab4ff' : '#ffe27a', on ? 0.8 : 0.25); else { g.fillStyle = '#d03a2a'; g.fillRect(x + nx - 3, y - 3, 6, 6); } }
}
// ---------------------------------------------------------------- Nederland
function nlBg(g, t, cam = 0, mood = 'day') {
  const K = 'nl_' + mood, dusk = mood === 'dusk';
  g.drawImage(skyLayer(K + 's', dusk ? [[0, '#3a4a8a'], [0.5, '#e08a7a'], [1, '#ffd090']] : [[0, '#4aa8f0'], [0.6, '#b8e2ff'], [1, '#f4f8ff']], dusk ? { sun: [300, 420, 400, 44], sunCol: 'rgba(255,160,100,.9)' } : { sun: [1050, 110, 420, 50], sunCol: 'rgba(255,245,200,.9)' }), 0, 0);
  clouds(g, t, { y: 50, n: 7, a: dusk ? 0.55 : 0.95, sp: 16, col: dusk ? '#ffd0b8' : '#fff', seed: 12 });
  g.drawImage(L(K + 'f', SW, H, (c) => {
    c.fillStyle = dusk ? '#5a5a8a' : '#8cc87a'; c.fillRect(0, 440, SW, 300); ridge(c, SW, 446, 4, 3, dusk ? '#4a5a7a' : '#7cb86a');
    const r = rng(5); for (let i = 0; i < 26; i++) { const x = r() * SW; tree(c, x, 448, 30 + r() * 20, dusk ? '#3a4a6a' : '#4a9a4a', dusk ? '#2a3a5a' : '#2f7a3a'); }
    c.fillStyle = dusk ? '#6a5a7a' : '#c8a47a'; c.fillRect(400, 420, 18, 30); c.beginPath(); c.moveTo(396, 420); c.lineTo(409, 396); c.lineTo(422, 420); c.fill(); for (const x of [900, 960, 1010]) { c.fillStyle = dusk ? '#7a5a6a' : '#d8704a'; c.fillRect(x, 428, 40, 22); c.fillStyle = dusk ? '#3a3a5a' : '#8a3a2a'; c.beginPath(); c.moveTo(x - 4, 428); c.lineTo(x + 20, 410); c.lineTo(x + 44, 428); c.fill(); }
  }), px(0.1, cam), 0);
  // windmolen
  const mid = L(K + 'm', SW, H, (c) => {
    c.fillStyle = dusk ? '#5a7a4a' : '#6cbc4c'; c.fillRect(0, 470, SW, 80);
    c.fillStyle = grad(c, 0, 280, 0, 480, [[0, dusk ? '#9a6a5a' : '#e8d4b0'], [1, dusk ? '#6a4a44' : '#b89870']]); c.beginPath(); c.moveTo(1040, 480); c.lineTo(1066, 250); c.lineTo(1134, 250); c.lineTo(1160, 480); c.fill();
    c.fillStyle = dusk ? '#4a2a2a' : '#8a3a2a'; c.beginPath(); c.moveTo(1052, 252); c.lineTo(1100, 200); c.lineTo(1148, 252); c.closePath(); c.fill(); c.fillStyle = '#5a3a1e'; rr(c, 1086, 420, 28, 60, [14, 14, 0, 0]); c.fill();
    c.fillStyle = dusk ? '#ffd27a' : '#8ac8f0'; c.beginPath(); c.arc(1100, 330, 11, 0, TAU); c.fill();
    // grachtenpandjes
    const cols = ['#c8553a', '#8a3a2a', '#d8a04a', '#6a7a9a', '#b8483a', '#a8602a'];
    for (let i = 0; i < 8; i++) { const x = 40 + i * 118, h = 130 + (i % 3) * 36, w = 100; if (x > 960 && x < 1200) continue; c.fillStyle = grad(c, x, 500 - h, x + w, 500, [[0, cols[i % 6]], [1, 'rgba(0,0,0,.35)']]); c.fillRect(x, 500 - h, w, h);
      c.fillStyle = '#e8e2d0'; c.beginPath(); c.moveTo(x - 4, 500 - h); c.lineTo(x + w * 0.2, 500 - h - 22); c.lineTo(x + w * 0.35, 500 - h - 22); c.lineTo(x + w * 0.5, 500 - h - 40); c.lineTo(x + w * 0.65, 500 - h - 22); c.lineTo(x + w * 0.8, 500 - h - 22); c.lineTo(x + w + 4, 500 - h); c.fill();
      for (let j = 0; j < 3; j++) for (let k = 0; k < 2; k++) { c.fillStyle = dusk ? '#ffd27a' : '#cfe6f4'; c.fillRect(x + 16 + k * 44, 500 - h + 16 + j * 38, 24, 28); c.fillStyle = '#e8e2d0'; c.fillRect(x + 13 + k * 44, 500 - h + 14 + j * 38, 30, 3); } c.fillStyle = '#3a2a1e'; c.fillRect(x + 40, 466, 20, 34); }
  });
  const mx = px(0.4, cam); g.drawImage(mid, mx, 0);
  g.save(); g.translate(1100 + mx, 330); g.rotate(t * 0.9); for (let i = 0; i < 4; i++) { g.rotate(Math.PI / 2); g.fillStyle = '#4a3a2a'; g.fillRect(0, -3, 150, 6); g.fillStyle = dusk ? '#c8b8a0' : '#f4efe0'; g.fillRect(14, -26, 130, 24); g.strokeStyle = '#4a3a2a'; g.lineWidth = 2; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(14 + k * 22, -26); g.lineTo(14 + k * 22, -2); g.stroke(); } } g.restore(); g.fillStyle = '#3a2a1e'; g.beginPath(); g.arc(1100 + mx, 330, 9, 0, TAU); g.fill();
  g.drawImage(L(K + 'n', SW, H, (c) => {
    // tulpenvelden in banen
    const tc = ['#e8302a', '#f5d020', '#ff6aa8', '#a040d0', '#fff', '#ff9a20'];
    for (let i = 0; i < 6; i++) { const y0 = 490 + i * 8 + i * i * 1.4; c.fillStyle = grad(c, 0, y0, 0, y0 + 12 + i * 3, [[0, '#6ab43a'], [1, '#4a8a2a']]); c.fillRect(0, y0, SW, 12 + i * 3); const r = rng(40 + i); for (let k = 0; k < 120; k++) { c.fillStyle = tc[(i + Math.floor(k / 20)) % 6]; const x = k * (SW / 120) + r() * 6; c.fillRect(x, y0 + 2, 3 + i * 0.5, 4 + i * 0.7); } }
    c.fillStyle = '#4a9ac8'; c.fillRect(0, 548, SW, 22); c.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < SW; x += 60) c.fillRect(x, 554, 30, 3);
    c.fillStyle = grad(c, 0, 570, 0, H, [[0, '#c4503a'], [1, '#8a3426']]); c.fillRect(0, 570, SW, 150); c.fillStyle = 'rgba(255,255,255,.7)'; for (let x = 0; x < SW; x += 110) c.fillRect(x, 640, 60, 5);
    c.fillStyle = '#9aa0a8'; c.fillRect(0, 566, SW, 6);
  }), px(1, cam), 0);
}
function terminalSprite() {
  return L('schiphol', 900, 360, (g) => {
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 346, 900, 14);
    g.fillStyle = grad(g, 0, 60, 0, 350, [[0, '#d8e4ee'], [1, '#8a9aaa']]); g.beginPath(); g.moveTo(0, 350); g.lineTo(0, 120); g.lineTo(80, 70); g.lineTo(820, 70); g.lineTo(900, 120); g.lineTo(900, 350); g.fill();
    g.fillStyle = grad(g, 0, 140, 0, 340, [[0, '#2a4a72'], [1, '#6a9ac8']]); g.fillRect(30, 150, 840, 170);
    g.strokeStyle = '#c8d4de'; g.lineWidth = 6; for (let x = 30; x <= 870; x += 70) { g.beginPath(); g.moveTo(x, 150); g.lineTo(x, 320); g.stroke(); } g.beginPath(); g.moveTo(30, 235); g.lineTo(870, 235); g.stroke();
    g.fillStyle = 'rgba(255,255,255,.14)'; for (let x = 30; x < 840; x += 140) { g.beginPath(); g.moveTo(x + 40, 150); g.lineTo(x + 80, 150); g.lineTo(x + 30, 320); g.lineTo(x - 10, 320); g.fill(); }
    g.fillStyle = '#ffe9a0'; for (let x = 60; x < 840; x += 70) for (const y of [180, 260]) { g.globalAlpha = 0.35; g.fillRect(x, y, 30, 30); } g.globalAlpha = 1;
    rr(g, 230, 76, 440, 62, 8); g.fillStyle = '#1c3f9a'; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke(); txt(g, 'SCHIPHOL', 450, 123, 46, '#fff', 'center', 700);
    g.fillStyle = '#d8dee4'; g.fillRect(0, 100, 900, 10);
  });
}

// ---------------------------------------------------------------- China
function pagoda(g, x, y, s, tiers, body = '#b02a22', roof = '#2a3a4a', lit = 1) {
  for (let i = 0; i < tiers; i++) {
    const w = (96 - i * 13) * s, h = 46 * s, top = y - (i + 1) * h;
    g.fillStyle = grad(g, x - w / 2, top, x + w / 2, top + h, [[0, body], [1, 'rgba(40,0,10,.9)']]); g.fillRect(x - w * 0.36, top, w * 0.72, h);
    g.fillStyle = lit ? '#ffcf6a' : '#3a3a4a'; for (let k = -1; k <= 1; k++) g.fillRect(x + k * w * 0.2 - 4 * s, top + 12 * s, 8 * s, 18 * s);
    g.fillStyle = roof; g.beginPath(); g.moveTo(x - w * 0.78, top - 8 * s); g.quadraticCurveTo(x - w * 0.55, top + 10 * s, x - w * 0.3, top - 2 * s); g.lineTo(x - w * 0.12, top - 20 * s); g.lineTo(x + w * 0.12, top - 20 * s); g.lineTo(x + w * 0.3, top - 2 * s); g.quadraticCurveTo(x + w * 0.55, top + 10 * s, x + w * 0.78, top - 8 * s); g.quadraticCurveTo(x + w * 0.4, top + 22 * s, x, top + 20 * s); g.quadraticCurveTo(x - w * 0.4, top + 22 * s, x - w * 0.78, top - 8 * s); g.fill();
    g.fillStyle = '#e8b840'; g.fillRect(x - w * 0.36, top + h - 3 * s, w * 0.72, 3 * s);
  }
  const top = y - tiers * 46 * s; g.fillStyle = '#e8b840'; g.fillRect(x - 1.5 * s, top - 52 * s, 3 * s, 34 * s); g.beginPath(); g.arc(x, top - 54 * s, 5 * s, 0, TAU); g.fill();
}
function lantern(g, x, y, s, t, ph = 0, col = '#e0261e') {
  const a = Math.sin(t * 1.6 + ph) * 0.12; g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s);
  g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -20); g.lineTo(0, 0); g.stroke(); glow(g, 0, 22, 70, 'rgba(255,90,40,.55)');
  g.fillStyle = '#e8b840'; g.fillRect(-9, -1, 18, 5); g.fillRect(-9, 44, 18, 5);
  g.fillStyle = rgrad(g, -6, 20, 2, 30, [[0, '#ff6a50'], [1, col]]); g.beginPath(); g.ellipse(0, 24, 22, 22, 0, 0, TAU); g.fill();
  g.strokeStyle = 'rgba(120,0,0,.5)'; g.lineWidth = 1.5; for (const k of [-12, -5, 5, 12]) { g.beginPath(); g.ellipse(0, 24, Math.abs(k) * 1.6 + 2, 22, 0, 0, TAU); g.stroke(); }
  g.strokeStyle = '#e8b840'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 49); g.lineTo(0, 62 + Math.sin(t * 3 + ph) * 2); g.stroke(); g.restore();
}
const CJK = '"Noto Sans CJK SC","WenQuanYi Zen Hei","Microsoft YaHei",Fredoka,sans-serif';
function cjk(g, s, x, y, size, col) { g.font = `700 ${size}px ${CJK}`; g.textAlign = 'center'; g.fillStyle = col; g.fillText(s, x, y); }
function chinaBg(g, t, cam = 0, mood = 'dusk') {
  const K = 'cn_' + mood, night = mood === 'night';
  g.drawImage(skyLayer(K + 's', night ? [[0, '#0a0618'], [0.55, '#34164a'], [1, '#8a2a4a']] : [[0, '#2a1648'], [0.45, '#b0407a'], [0.78, '#ff8a5a'], [1, '#ffd08a']], night ? { stars: 120, starsY: 260, moon: [980, 120, 40] } : { sun: [330, 420, 400, 50], sunCol: 'rgba(255,150,90,.9)', stars: 40, starsY: 160 }), 0, 0);
  g.drawImage(L(K + 'f', SW, H, (c) => {
    const r = rng(14); c.fillStyle = night ? '#241040' : '#7a3a6a';
    for (let i = 0; i < 9; i++) { const x = 80 + i * 200 + r() * 60, h = 150 + r() * 150, w = 70 + r() * 40; c.beginPath(); c.moveTo(x - w * 2, 520); c.quadraticCurveTo(x - w * 0.5, 520 - h * 0.2, x - w * 0.3, 520 - h * 0.8); c.quadraticCurveTo(x, 520 - h * 1.1, x + w * 0.3, 520 - h * 0.8); c.quadraticCurveTo(x + w * 0.6, 520 - h * 0.2, x + w * 2, 520); c.fill(); }
    c.fillStyle = grad(c, 0, 330, 0, 520, [[0, 'rgba(255,200,200,0)'], [1, night ? 'rgba(120,60,120,.55)' : 'rgba(255,190,170,.6)']]); c.fillRect(0, 330, SW, 200);
  }), px(0.12, cam), 0);
  const mx = px(0.45, cam);
  g.drawImage(L(K + 'm', SW, H, (c) => {
    c.fillStyle = night ? '#1a0c2a' : '#4a2a4a'; c.fillRect(0, 500, SW, 60);
    pagoda(c, 380, 510, 1.5, 5, '#a8281e', night ? '#1a2030' : '#2e3a4a'); pagoda(c, 1330, 510, 1.3, 4, '#a8281e', night ? '#1a2030' : '#2e3a4a');
    const r = rng(77); const cols = ['#a8281e', '#8a1c1c', '#b83a22', '#7a2a22'];
    for (let i = 0; i < 9; i++) { const x = 60 + i * 190, w = 150, h = 150 + r() * 80; if (Math.abs(x + 75 - 380) < 100 || Math.abs(x + 75 - 1330) < 90) continue;
      c.fillStyle = grad(c, x, 510 - h, x + w, 510, [[0, cols[i % 4]], [1, 'rgba(30,0,10,.9)']]); c.fillRect(x, 510 - h, w, h);
      c.fillStyle = night ? '#1a2030' : '#2e3a4a'; c.beginPath(); c.moveTo(x - 26, 510 - h + 8); c.quadraticCurveTo(x + 20, 510 - h + 10, x + 30, 510 - h - 26); c.lineTo(x + w - 30, 510 - h - 26); c.quadraticCurveTo(x + w - 20, 510 - h + 10, x + w + 26, 510 - h + 8); c.quadraticCurveTo(x + w / 2, 510 - h + 28, x - 26, 510 - h + 8); c.fill();
      for (let j = 0; j < Math.floor((h - 30) / 46); j++) for (let k = 0; k < 3; k++) { c.fillStyle = r() > 0.25 ? '#ffd27a' : '#5a3a3a'; c.fillRect(x + 20 + k * 42, 510 - h + 26 + j * 46, 26, 28); c.strokeStyle = '#5a2a1a'; c.lineWidth = 2; c.strokeRect(x + 20 + k * 42, 510 - h + 26 + j * 46, 26, 28); }
      c.fillStyle = '#e8b840'; c.fillRect(x + w - 26, 510 - h + 30, 14, 70); c.fillStyle = '#b01818'; c.fillRect(x + w - 24, 510 - h + 32, 10, 66); cjk(c, ['龍', '福', '茶', '酒', '喜', '財'][i % 6], x + w - 19, 510 - h + 58, 12, '#ffe27a'); }
  }), mx, 0);
  // gloeiende neonborden
  for (const [x, y, c1, s] of [[520, 330, '#ff3a8a', '福'], [820, 300, '#3affd0', '茶'], [1190, 340, '#ffd23a', '酒']]) { const k = 0.8 + 0.2 * Math.sin(t * 7 + x); glow(g, x + mx, y, 90, c1, 0.5 * k); cjk(g, s, x + mx, y + 16, 48, c1); }
  g.drawImage(L(K + 'n', SW, H, (c) => {
    c.fillStyle = grad(c, 0, 515, 0, H, [[0, night ? '#2a1a34' : '#5a3446'], [1, night ? '#120a1c' : '#2a1a2a']]); c.fillRect(0, 515, SW, H - 515);
    c.fillStyle = 'rgba(255,60,40,.14)'; for (let i = 0; i < 9; i++) { c.beginPath(); c.ellipse(80 + i * 200, 600 + (i % 2) * 40, 80, 12, 0, 0, TAU); c.fill(); }
    c.fillStyle = '#6a4a4a'; c.fillRect(0, 512, SW, 8); c.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 0; x < SW; x += 100) c.fillRect(x, 640, 50, 5);
  }), px(1, cam), 0);
  // lantaarnslingers over de straat
  for (let k = 0; k < 3; k++) { const y0 = 150 + k * 40; g.strokeStyle = 'rgba(40,20,10,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(-20, y0 - 20); g.quadraticCurveTo(W / 2, y0 + 50, W + 20, y0 - 20); g.stroke(); for (let i = 0; i < 9; i++) { const u = (i + 0.5) / 9, x = lerp(-20, W + 20, u), y = lerp(y0 - 20, y0 - 20, u) + Math.sin(u * Math.PI) * 35 + 4; lantern(g, x - cam * (0.7 + k * 0.12), y, 0.5 + k * 0.12, t, i * 1.3 + k); } }
}
// ---------------------------------------------------------------- Magazijn buiten
function crate(g, x, y, w, h, col = '#c8a060', label = true) {
  g.fillStyle = grad(g, x, y - h, x + w, y, [[0, col], [1, 'rgba(60,40,10,.9)']]); g.fillRect(x, y - h, w, h); g.strokeStyle = 'rgba(40,25,10,.8)'; g.lineWidth = 2; g.strokeRect(x, y - h, w, h);
  g.fillStyle = 'rgba(240,220,170,.8)'; g.fillRect(x + w / 2 - 5, y - h, 10, h); if (label) { g.fillStyle = '#fff'; g.fillRect(x + w * 0.12, y - h * 0.8, w * 0.3, h * 0.26); g.fillStyle = '#1c8a9a'; g.fillRect(x + w * 0.14, y - h * 0.76, w * 0.26, h * 0.06); }
}
function buddleyLogo(g, cx, cy, sz) {
  g.save(); g.translate(cx, cy); rr(g, -sz * 3.2, -sz * 0.9, sz * 6.4, sz * 1.8, sz * 0.5); g.fillStyle = grad(g, 0, -sz, 0, sz, [[0, '#1fb6c4'], [1, '#0e6e86']]); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = sz * 0.07; g.stroke();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-sz * 2.45, 0, sz * 0.55, 0, TAU); g.fill(); g.fillStyle = '#0e6e86'; g.beginPath(); g.arc(-sz * 2.6, -sz * 0.1, sz * 0.09, 0, TAU); g.arc(-sz * 2.3, -sz * 0.1, sz * 0.09, 0, TAU); g.fill(); g.strokeStyle = '#0e6e86'; g.lineWidth = sz * 0.07; g.beginPath(); g.arc(-sz * 2.45, sz * 0.05, sz * 0.25, 0.2, Math.PI - 0.2); g.stroke();
  txt(g, 'BUDDLEY', sz * 0.45, sz * 0.4, sz * 1.15, '#fff', 'center', 700); g.restore();
}
function warehouseBg(g, t, cam = 0) {
  g.drawImage(skyLayer('wh_s', [[0, '#04060f'], [0.6, '#0e1a34'], [1, '#2a3a58']], { stars: 150, starsY: 350, moon: [180, 110, 34] }), 0, 0);
  g.drawImage(L('wh_f', SW, H, (c) => { ridge(c, SW, 430, 16, 3, '#101a30'); const r = rng(6); for (let i = 0; i < 14; i++) { const x = i * 130 + r() * 40, h = 60 + r() * 90; c.fillStyle = '#0c1426'; c.fillRect(x, 500 - h, 60 + r() * 50, h); for (let k = 0; k < 4; k++) { c.fillStyle = r() > 0.5 ? '#ffd27a' : '#1a2438'; c.fillRect(x + 8 + (k % 2) * 22, 500 - h + 10 + Math.floor(k / 2) * 20, 12, 10); } } for (const x of [300, 1500]) { c.fillStyle = '#0c1426'; c.fillRect(x, 300, 14, 220); c.fillRect(x - 70, 300, 200, 10); c.fillRect(x + 100, 300, 5, 90); } }), px(0.15, cam), 0);
  const mx = px(0.5, cam);
  g.drawImage(L('wh_m', SW, H, (c) => {
    const x0 = 330, x1 = 1470; c.fillStyle = grad(c, 0, 200, 0, 520, [[0, '#4a5a72'], [1, '#2a3446']]); c.fillRect(x0, 220, x1 - x0, 300);
    c.fillStyle = grad(c, 0, 170, 0, 230, [[0, '#6a7a92'], [1, '#3a465a']]); c.beginPath(); c.moveTo(x0 - 30, 224); c.lineTo(x0 + 80, 170); c.lineTo(x1 - 80, 170); c.lineTo(x1 + 30, 224); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 3; for (let x = x0; x < x1; x += 28) { c.beginPath(); c.moveTo(x, 226); c.lineTo(x, 520); c.stroke(); }
    for (let i = 0; i < 4; i++) { const x = x0 + 70 + i * 270; c.fillStyle = '#1a2230'; c.fillRect(x, 380, 190, 140); c.fillStyle = '#8a929e'; for (let y = 384; y < 520; y += 14) c.fillRect(x + 4, y, 182, 9); c.fillStyle = '#ffd23a'; c.fillRect(x - 6, 372, 202, 8); }
    for (let x = x0 + 40; x < x1 - 40; x += 120) { c.fillStyle = '#ffd27a'; c.fillRect(x, 250, 60, 22); }
    c.fillStyle = '#222a38'; c.fillRect(x0 + 340, 230, 480, 120); buddleyLogo(c, x0 + 580, 290, 38);
  }), mx, 0);
  const sx = 580 + 330 + mx; g.save(); g.globalCompositeOperation = 'lighter'; glow(g, sx, 290, 400, 'rgba(60,200,220,.18)'); g.restore();
  g.drawImage(L('wh_n', SW, H, (c) => {
    c.fillStyle = grad(c, 0, 515, 0, H, [[0, '#3a4252'], [1, '#1a202c']]); c.fillRect(0, 515, SW, H - 515);
    c.fillStyle = 'rgba(255,210,60,.65)'; for (let x = 0; x < SW; x += 160) { c.beginPath(); c.moveTo(x, 640); c.lineTo(x + 50, 640); c.lineTo(x + 30, 660); c.lineTo(x - 20, 660); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let y = 560; y < 720; y += 40) c.fillRect(0, y, SW, 2);
    crate(c, 120, 540, 90, 80, '#c8a060'); crate(c, 190, 540, 80, 70, '#b88c4c'); crate(c, 140, 462, 80, 70, '#d0a868'); crate(c, 1500, 540, 90, 90, '#c8a060'); crate(c, 1590, 540, 90, 70, '#b88c4c'); crate(c, 1530, 450, 90, 80, '#d0a868');
    c.strokeStyle = '#5a626e'; c.lineWidth = 2; c.beginPath(); for (let x = 0; x < SW; x += 24) { c.moveTo(x, 500); c.lineTo(x + 40, 540); } c.stroke();
  }), px(1, cam), 0);
  // zoeklichten van het dak
  for (const [x, ph] of [[420, 0], [1250, 2]]) { const a = Math.sin(t * 0.7 + ph) * 0.7 - 1.2; beam(g, x + mx, 220, a + Math.PI, 700, 20, 150, 'rgba(255,250,210,A)', 0.2); glow(g, x + mx, 220, 24, '#fff6c0', 0.8); }
}
function truck(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s * (o.face || 1), s); const wob = Math.sin(t * 20) * 0.8; g.translate(0, wob);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(10, 2, 170, 12, 0, 0, TAU); g.fill();
  g.fillStyle = grad(g, 0, -150, 0, -30, [[0, '#f4f6f8'], [1, '#b4bcc6']]); rr(g, -170, -150, 220, 120, 8); g.fill(); g.strokeStyle = '#0d0f14'; g.lineWidth = 3; g.stroke(); buddleyLogo(g, -60, -92, 15);
  g.fillStyle = grad(g, 50, -110, 140, -30, [[0, '#1fb6c4'], [1, '#0e6e86']]); g.beginPath(); g.moveTo(54, -30); g.lineTo(54, -110); g.lineTo(106, -110); g.lineTo(140, -68); g.lineTo(150, -68); g.lineTo(150, -30); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = '#8ac8f0'; g.beginPath(); g.moveTo(64, -100); g.lineTo(102, -100); g.lineTo(130, -68); g.lineTo(64, -68); g.fill();
  for (const wx of [-120, -70, 90]) { g.fillStyle = '#14161c'; g.beginPath(); g.arc(wx, -18, 22, 0, TAU); g.fill(); g.fillStyle = '#9aa4ae'; g.beginPath(); g.arc(wx, -18, 10, 0, TAU); g.fill(); g.strokeStyle = '#444'; g.lineWidth = 2; g.beginPath(); g.moveTo(wx, -18); g.lineTo(wx + Math.cos(t * 14) * 9, -18 + Math.sin(t * 14) * 9); g.stroke(); }
  if (o.lights !== false) { beam(g, 148, -50, 0.03, 520, 24, 120, 'rgba(255,245,200,A)', 0.35); glow(g, 148, -50, 40, '#fff2b0', 0.9); }
  g.fillStyle = '#ff3a2a'; g.fillRect(-172, -60, 6, 14); g.restore();
}
function van(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s * (o.face || 1), s); g.translate(0, Math.sin(t * 22) * 0.7);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.beginPath(); g.ellipse(0, 2, 130, 10, 0, 0, TAU); g.fill();
  g.fillStyle = grad(g, 0, -120, 0, -20, [[0, '#2a3446'], [1, '#12161f']]); g.beginPath(); g.moveTo(-120, -20); g.lineTo(-120, -100); g.quadraticCurveTo(-118, -118, -100, -118); g.lineTo(30, -118); g.quadraticCurveTo(70, -112, 100, -70); g.lineTo(122, -64); g.lineTo(126, -20); g.closePath(); g.fill(); g.strokeStyle = '#05060a'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#6aa8d0'; g.beginPath(); g.moveTo(44, -108); g.quadraticCurveTo(70, -104, 88, -72); g.lineTo(44, -72); g.fill(); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(-110, -106, 120, 8);
  g.fillStyle = '#ff3a3a'; g.fillRect(-120, -56, 6, 16); g.fillStyle = 'rgba(255,255,255,.7)'; g.font = `700 14px ${FONT}`; g.textAlign = 'center'; g.fillText('BUDDLEY', -36, -64);
  if (o.door) { g.fillStyle = '#0a0c12'; g.fillRect(-100 + 0, -110, 56 * o.door, 86); }
  for (const wx of [-78, 78]) { g.fillStyle = '#0a0b0f'; g.beginPath(); g.arc(wx, -18, 21, 0, TAU); g.fill(); g.fillStyle = '#8a929c'; g.beginPath(); g.arc(wx, -18, 9, 0, TAU); g.fill(); g.strokeStyle = '#333'; g.lineWidth = 2; g.beginPath(); g.moveTo(wx, -18); g.lineTo(wx + Math.cos(t * 16) * 9, -18 + Math.sin(t * 16) * 9); g.stroke(); }
  if (o.lights !== false) { beam(g, 124, -44, 0.02, 560, 20, 130, 'rgba(255,245,200,A)', 0.4); glow(g, 124, -44, 36, '#fff2b0', 0.9); }
  g.restore();
}
// ---------------------------------------------------------------- Magazijn binnen
function warehouseIn(g, t, cam = 0, o = {}) {
  g.drawImage(L('whi_b', W, H, (c) => {
    c.fillStyle = grad(c, 0, 0, 0, H, [[0, '#0a0e18'], [0.6, '#1a2232'], [1, '#262e3c']]); c.fillRect(0, 0, W, H);
    c.fillStyle = '#10151f'; for (let x = 0; x < W; x += 160) { c.fillRect(x, 0, 14, 420); } c.fillRect(0, 60, W, 12); c.fillRect(0, 150, W, 8);
    const r = rng(4); const cols = ['#c8a060', '#b88c4c', '#d0a868', '#a87c3c'];
    for (let row = 0; row < 4; row++) { c.fillStyle = '#2a3a52'; c.fillRect(0, 150 + row * 78 + 62, W, 8); for (let x = 20; x < W; x += 80) { if (r() < 0.12) continue; const h = 40 + r() * 20, w = 56 + r() * 16; crate(c, x + r() * 6, 150 + row * 78 + 62, w, h, cols[Math.floor(r() * 4)]); } }
    c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(0, 440, W, 8);
    c.fillStyle = grad(c, 0, 440, 0, H, [[0, '#3a4252'], [1, '#161b26']]); c.fillRect(0, 448, W, H - 448);
    c.fillStyle = 'rgba(255,210,60,.5)'; c.fillRect(0, 560, W, 5); c.fillRect(0, 620, W, 5);
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let x = 0; x < W; x += 100) c.fillRect(x, 448, 2, H);
  }), 0, 0);
  const lx = Math.sin(t * 0.8) * 10; for (const x of [200, 560, 920, 1180]) { g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 70); g.lineTo(x + lx * 0.1, 120); g.stroke(); g.fillStyle = '#e8e2c8'; g.beginPath(); g.moveTo(x + lx * 0.1 - 24, 130); g.lineTo(x + lx * 0.1 - 10, 112); g.lineTo(x + lx * 0.1 + 10, 112); g.lineTo(x + lx * 0.1 + 24, 130); g.fill(); beam(g, x + lx * 0.1, 128, Math.PI / 2 + lx * 0.003, 440, 40, 260, 'rgba(255,244,200,A)', 0.2 + 0.05 * Math.sin(t * 9 + x)); glow(g, x + lx * 0.1, 130, 50, '#fff0b0', 0.7); }
  const px2 = (o.fg === undefined ? 1 : o.fg);
  if (px2) { const ox = -cam * 1.2; crate(g, ox - 40, 700, 150, 150, '#c8a060'); crate(g, ox + 100, 700, 110, 100, '#b88c4c'); crate(g, ox + 1130, 720, 190, 190, '#c8a060'); crate(g, ox + 1010, 720, 130, 120, '#d0a868'); }
}

// ---------------------------------------------------------------- stad bij nacht, kantoor, politie, atelier, bank
function skylineLayer(g, w, base, seed, col, o = {}) {
  const r = rng(seed), { hmin = 80, hmax = 260, wmin = 50, wmax = 100, lit = 0.45 } = o; let x = -20;
  while (x < w) { const bw = wmin + r() * (wmax - wmin), bh = hmin + r() * (hmax - hmin); g.fillStyle = grad(g, x, base - bh, x + bw, base, [[0, col], [1, 'rgba(0,0,0,.5)']]); g.fillRect(x, base - bh, bw, bh);
    if (r() < 0.3) { g.fillStyle = col; g.fillRect(x + bw * 0.45, base - bh - 24, 3, 24); }
    for (let yy = base - bh + 10; yy < base - 12; yy += 14) for (let xx = x + 6; xx < x + bw - 8; xx += 11) { if (r() < lit) { g.fillStyle = r() < 0.15 ? '#8ae0ff' : '#ffd88a'; g.globalAlpha = 0.5 + r() * 0.5; g.fillRect(xx, yy, 5, 7); } } g.globalAlpha = 1; x += bw + r() * 6; }
}
function cityNight(g, t, cam = 0, o = {}) {
  g.drawImage(skyLayer('city_s', [[0, '#04060f'], [0.5, '#141a3a'], [1, '#4a3a6a']], { stars: 160, starsY: 300, moon: [1060, 100, 34] }), 0, 0);
  g.drawImage(L('city_f', SW, H, (c) => { skylineLayer(c, SW, 560, 3, '#1a2040', { hmin: 140, hmax: 360, lit: 0.3 }); }), px(0.12, cam), 0);
  g.drawImage(L('city_m', SW, H, (c) => { skylineLayer(c, SW, 620, 9, '#10152e', { hmin: 120, hmax: 300, wmin: 70, wmax: 130, lit: 0.55 });
    const x = 880; c.fillStyle = grad(c, x, 80, x + 160, 600, [[0, '#5a7ab0'], [0.5, '#2a3a68'], [1, '#141a38']]); c.fillRect(x, 60, 150, 560); c.fillStyle = 'rgba(255,255,255,.09)'; for (let i = 0; i < 6; i++) c.fillRect(x + 10 + i * 24, 60, 8, 560); c.fillStyle = 'rgba(160,220,255,.5)'; for (let y = 90; y < 600; y += 22) { c.fillRect(x, y, 150, 2); }
    c.fillStyle = '#1a2040'; c.fillRect(x + 66, 20, 18, 40); c.fillStyle = '#b02a2a'; rr(c, x - 20, 20 + 40, 190, 38, 6); c.fill();
  }), px(0.4, cam), 0);
  const mx = px(0.4, cam); txt(g, 'HOOFDKANTOOR', 975 + mx, 124, 21, '#ffd8d8', 'center', 700); glow(g, 975 + mx, 112, 120, 'rgba(255,60,60,.55)', 0.6 + 0.4 * Math.sin(t * 3));
  if (!o.noTraffic) for (let i = 0; i < 14; i++) { const x = ((t * (60 + i * 7) * (i % 2 ? 1 : -1) + i * 211) % 1500 + 1500) % 1500 - 100; glow(g, x, 640 + (i % 4) * 14, 22, i % 2 ? '#ffe6a0' : '#ff3a3a', 0.8); }
}
function wallWindow(g, x, y, w, h, t, o = {}) { // glazen wand met uitzicht op de nachtelijke stad
  g.save(); rr(g, x, y, w, h, 6); g.clip();
  g.fillStyle = grad(g, 0, y, 0, y + h, [[0, '#060a1c'], [1, '#3a2a5a']]); g.fillRect(x, y, w, h); stars(g, 50, 5, W, y + h * 0.5, 1.4);
  g.save(); g.translate(x - 220 - (o.cam || 0) * 0.15, y + h - 620); g.drawImage(L('city_ow', SW, 620, (c) => { skylineLayer(c, SW, 620, 31, '#1e2650', { hmin: 140, hmax: 420, lit: 0.45 }); skylineLayer(c, SW, 620, 5, '#10152e', { hmin: 60, hmax: 260, wmin: 80, wmax: 140, lit: 0.6 }); }), 0, 0); g.restore();
  for (let i = 0; i < 9; i++) { const xx = ((t * (30 + i * 9) * (i % 2 ? 1 : -1) + i * 173) % (w + 100) + w + 100) % (w + 100) + x - 50; glow(g, xx, y + h - 20 - (i % 3) * 8, 14, i % 2 ? '#ffe6a0' : '#ff3a3a', 0.8); }
  g.fillStyle = grad(g, x, y, x + w, y + h, [[0, 'rgba(255,255,255,.14)'], [0.3, 'rgba(255,255,255,0)'], [1, 'rgba(255,255,255,.07)']]); g.fillRect(x, y, w, h); g.restore();
  g.strokeStyle = '#0a0c12'; g.lineWidth = 10; rr(g, x, y, w, h, 6); g.stroke(); g.lineWidth = 6; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + (w / 5) * i, y); g.lineTo(x + (w / 5) * i, y + h); g.stroke(); } g.beginPath(); g.moveTo(x, y + h * 0.62); g.lineTo(x + w, y + h * 0.62); g.stroke();
}
function officeBg(g, t, cam = 0) {
  g.drawImage(L('off_b', W, H, (c) => {
    c.fillStyle = grad(c, 0, 0, 0, H, [[0, '#1a0e12'], [1, '#2e1a1c']]); c.fillRect(0, 0, W, H);
    c.fillStyle = grad(c, 0, 470, 0, H, [[0, '#2a2030'], [0.4, '#141018'], [1, '#08060a']]); c.fillRect(0, 470, W, H - 470);
    c.fillStyle = 'rgba(255,255,255,.05)'; for (let x = 0; x < W; x += 80) c.fillRect(x, 470, 2, H);
    for (const x of [20, 1150]) { c.fillStyle = '#a8101a'; c.fillRect(x, 70, 110, 330); c.fillStyle = '#e8b840'; c.fillRect(x + 6, 76, 98, 318); c.fillStyle = '#a8101a'; c.fillRect(x + 12, 82, 86, 306); cjk(c, x < 100 ? '龍' : '財', x + 55, 300, 80, '#ffe27a'); c.fillStyle = '#4a2a10'; c.fillRect(x - 6, 62, 122, 8); }
    c.fillStyle = '#e8b840'; c.fillRect(0, 462, W, 8); c.fillStyle = '#3a1e18'; c.fillRect(0, 440, W, 22);
  }), 0, 0);
  wallWindow(g, 170, 66, 940, 380, t, { cam });
  const lx = 640; g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(0, 0, W, 40); for (const x of [240, 640, 1040]) { g.fillStyle = '#fff6d8'; g.fillRect(x - 70, 30, 140, 8); glow(g, x, 40, 160, 'rgba(255,240,200,.5)', 0.4); }
  g.fillStyle = 'rgba(255,255,255,.04)'; g.beginPath(); g.moveTo(180, 470); g.lineTo(240, H); g.lineTo(520, H); g.lineTo(380, 470); g.fill();
}
function deskFront(g, x, y, w) { // groot bureau: bovenkant op y
  g.fillStyle = grad(g, 0, y, 0, y + 150, [[0, '#6a3a22'], [1, '#2e170c']]); rr(g, x, y, w, 150, 6); g.fill(); g.fillStyle = '#9a5a34'; rr(g, x - 12, y - 10, w + 24, 20, 6); g.fill(); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x - 6, y - 8, w + 12, 4);
  g.fillStyle = '#e8b840'; g.fillRect(x + 20, y + 40, w - 40, 3); g.fillRect(x + 20, y + 110, w - 40, 3); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 2; g.strokeRect(x + 30, y + 52, w - 60, 52);
  g.fillStyle = '#d8b040'; g.fillRect(x + w / 2 - 20, y + 74, 40, 6);
}
function deskProps(g, x, y, t) { // gouden pen, laptop, lampje op het bureau
  g.fillStyle = '#2a2d36'; rr(g, x, y - 36, 76, 40, 3); g.fill(); g.fillStyle = '#6ac8e8'; g.fillRect(x + 5, y - 32, 66, 30); g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 4; i++) g.fillRect(x + 10, y - 28 + i * 6, 20 + ((i * 17 + Math.floor(t * 2)) % 30), 2);
  g.fillStyle = '#1a1c22'; g.fillRect(x - 6, y + 2, 88, 4); g.strokeStyle = '#e8c64a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 120, y - 14); g.quadraticCurveTo(x + 150, y - 70, x + 190, y - 64); g.stroke(); g.fillStyle = '#e8c64a'; g.beginPath(); g.moveTo(x + 176, y - 66); g.lineTo(x + 204, y - 70); g.lineTo(x + 192, y - 48); g.fill(); glow(g, x + 190, y - 60, 60, 'rgba(255,230,150,.6)', 0.5);
}
function policeCar(g, x, y, s, t, o = {}) {
  g.save(); g.translate(x, y); g.scale(s * (o.face || 1), s); g.fillStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.ellipse(0, 2, 150, 12, 0, 0, TAU); g.fill();
  g.fillStyle = grad(g, 0, -90, 0, -20, [[0, '#f4f6f8'], [1, '#a8b0ba']]); g.beginPath(); g.moveTo(-140, -22); g.lineTo(-140, -52); g.quadraticCurveTo(-130, -60, -90, -62); g.lineTo(-60, -90); g.quadraticCurveTo(-50, -98, -30, -98); g.lineTo(40, -98); g.quadraticCurveTo(60, -96, 70, -80); g.lineTo(90, -62); g.lineTo(128, -56); g.quadraticCurveTo(142, -52, 142, -38); g.lineTo(142, -22); g.closePath(); g.fill(); g.strokeStyle = '#0d0f14'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#2a4aa8'; g.fillRect(-138, -46, 278, 12); g.fillStyle = '#7ab0d8'; g.beginPath(); g.moveTo(-50, -62); g.lineTo(-38, -88); g.lineTo(36, -88); g.lineTo(50, -62); g.fill(); g.fillStyle = '#1a2038'; g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.fillText('POLITIE', -2, -37);
  for (const wx of [-90, 90]) { g.fillStyle = '#0a0b0f'; g.beginPath(); g.arc(wx, -20, 22, 0, TAU); g.fill(); g.fillStyle = '#9aa4ae'; g.beginPath(); g.arc(wx, -20, 10, 0, TAU); g.fill(); }
  const ph = Math.floor(t * 6) % 2; g.fillStyle = ph ? '#ff2a2a' : '#4a1a1a'; g.fillRect(-26, -106, 24, 9); g.fillStyle = ph ? '#1a2a4a' : '#3a8aff'; g.fillRect(2, -106, 24, 9);
  g.restore();
  if (o.siren !== false) { const ph2 = Math.floor(t * 6) % 2; glow(g, x - 14 * s * (o.face || 1), y - 100 * s, 220 * s, ph2 ? 'rgba(255,40,40,1)' : 'rgba(60,120,255,1)', 0.9); }
}
function sirenTint(g, t, a = 0.18) { const ph = Math.floor(t * 6) % 2; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, ph ? 0 : W, 0, ph ? W : 0, H, [[0, ph ? `rgba(255,30,30,${a})` : `rgba(40,100,255,${a})`], [1, 'rgba(0,0,0,0)']]); g.fillRect(0, 0, W, H); g.restore(); }
function lamp(g, x, y, h, t, on = true) { g.fillStyle = '#1a1d24'; g.fillRect(x - 3, y - h, 6, h); g.fillRect(x - 3, y - h, 26, 5); g.fillStyle = on ? '#fff0b0' : '#555'; g.beginPath(); g.ellipse(x + 22, y - h + 8, 10, 5, 0, 0, TAU); g.fill(); if (on) { beam(g, x + 22, y - h + 10, Math.PI / 2, h + 10, 14, 170, 'rgba(255,230,150,A)', 0.2); glow(g, x + 22, y - h + 8, 80, '#ffe09a', 0.5); } }
function suburbHouse(g, x, y, s, wall, roof, lit = 1) {
  g.fillStyle = grad(g, x, y - 150 * s, x + 220 * s, y, [[0, wall], [1, 'rgba(0,0,0,.5)']]); g.fillRect(x, y - 120 * s, 220 * s, 120 * s);
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - 16 * s, y - 118 * s); g.lineTo(x + 110 * s, y - 190 * s); g.lineTo(x + 236 * s, y - 118 * s); g.fill(); g.fillStyle = 'rgba(0,0,0,.3)'; g.fillRect(x + 156 * s, y - 180 * s, 20 * s, 40 * s);
  for (const wx of [24, 140]) { g.fillStyle = lit ? '#ffd27a' : '#2a3a50'; g.fillRect(x + wx * s, y - 98 * s, 54 * s, 46 * s); g.strokeStyle = '#e8e2d0'; g.lineWidth = 4 * s; g.strokeRect(x + wx * s, y - 98 * s, 54 * s, 46 * s); g.beginPath(); g.moveTo(x + (wx + 27) * s, y - 98 * s); g.lineTo(x + (wx + 27) * s, y - 52 * s); g.stroke(); if (lit) glow(g, x + (wx + 27) * s, y - 75 * s, 70 * s, 'rgba(255,200,100,.35)'); }
  g.fillStyle = '#5a3a22'; rr(g, x + 92 * s, y - 62 * s, 36 * s, 62 * s, [8 * s, 8 * s, 0, 0]); g.fill(); g.fillStyle = '#e8c050'; g.beginPath(); g.arc(x + 120 * s, y - 30 * s, 2.5 * s, 0, TAU); g.fill();
}
function townBg(g, t, cam = 0, kind = 'suburb', o = {}) {
  const K = 'tw_' + kind;
  g.drawImage(skyLayer('tw_s', [[0, '#04060f'], [0.55, '#10183a'], [1, '#34306a']], { stars: 180, starsY: 360, moon: [220, 110, 36] }), 0, 0);
  g.drawImage(L('tw_f', SW, H, (c) => { skylineLayer(c, SW, 520, 17, '#161c3a', { hmin: 80, hmax: 220, lit: 0.3 }); const r = rng(2); for (let i = 0; i < 22; i++) tree(c, r() * SW, 530, 90 + r() * 50, '#14243a', '#0c1626'); }), px(0.15, cam), 0);
  const mx = px(0.5, cam);
  g.drawImage(L(K + 'm', SW, H, (c) => {
    if (kind === 'suburb') { [[120, '#b8a888', '#6a3a3a'], [520, '#88a0b8', '#3a4a6a'], [930, '#c8b090', '#5a3a2a'], [1380, '#a0b890', '#4a4a3a']].forEach(([x, w, r], i) => suburbHouse(c, x, 525, 1.1, w, r, i !== 2));
      c.fillStyle = '#0c2a1c'; for (let x = 0; x < SW; x += 46) { c.beginPath(); c.arc(x + 20, 530, 22, Math.PI, 0); c.fill(); } }
    if (kind === 'police') { const x = 520; c.fillStyle = grad(c, 0, 250, 0, 530, [[0, '#8a96a6'], [1, '#4a5666']]); c.fillRect(x, 250, 760, 280); c.fillStyle = '#243c9a'; c.fillRect(x, 250, 760, 26); c.fillStyle = '#1c2a48'; c.fillRect(x - 20, 240, 800, 14);
      for (let i = 0; i < 7; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 3 ? '#ffd27a' : '#2a3a50'; c.fillRect(x + 36 + i * 100, 300 + j * 90, 56, 54); c.strokeStyle = '#c8d0d8'; c.lineWidth = 4; c.strokeRect(x + 36 + i * 100, 300 + j * 90, 56, 54); }
      c.fillStyle = '#1a2438'; rr(c, x + 300, 420, 160, 110, [10, 10, 0, 0]); c.fill(); c.fillStyle = '#6ab0e8'; c.fillRect(x + 308, 430, 68, 100); c.fillRect(x + 384, 430, 68, 100); c.fillStyle = '#0d1226'; rr(c, x + 240, 340, 280, 54, 8); c.fill(); txt(c, 'POLITIE', x + 380, 380, 40, '#e8f0ff', 'center', 700);
      for (const dx of [215, 545]) { c.fillStyle = '#3a8aff'; c.beginPath(); c.arc(x + dx, 410, 20, 0, TAU); c.fill(); c.fillStyle = '#aac8ff'; c.fillRect(x + dx - 5, 406, 10, 4); } c.fillStyle = '#9aa4b0'; for (let i = 0; i < 4; i++) c.fillRect(x + 280 - i * 12, 530 - i * 0, 200 + i * 24, 5); }
    if (kind === 'atelier') { c.fillStyle = '#1a1a22'; c.fillRect(0, 420, 520, 110); c.fillRect(1100, 400, 700, 130); const x = 560; c.save(); c.translate(x, 0); c.fillStyle = grad(c, 0, 220, 0, 530, [[0, '#6a6a40'], [1, '#3a3a24']]); c.beginPath(); c.moveTo(0, 530); c.lineTo(0, 250); c.lineTo(500, 240); c.lineTo(500, 530); c.fill();
      c.fillStyle = 'rgba(30,30,10,.5)'; for (let i = 0; i < 14; i++) c.fillRect(((i * 97) % 480) + 10, 260 + ((i * 53) % 200), 6 + (i % 3) * 10, 40); c.fillStyle = '#2a2a18'; c.fillRect(-20, 240, 540, 16);
      for (const wx of [30, 330]) { c.fillStyle = '#c8b860'; c.fillRect(wx, 300, 140, 120); c.strokeStyle = '#2a2418'; c.lineWidth = 6; c.strokeRect(wx, 300, 140, 120); c.beginPath(); c.moveTo(wx + 70, 300); c.lineTo(wx + 70, 420); c.moveTo(wx, 360); c.lineTo(wx + 140, 360); c.stroke(); c.strokeStyle = 'rgba(0,0,0,.6)'; c.lineWidth = 2; c.beginPath(); c.moveTo(wx + 100, 300); c.lineTo(wx + 80, 340); c.lineTo(wx + 110, 380); c.stroke(); c.fillStyle = '#3a2a1a'; for (let m = 0; m < 2; m++) { c.fillRect(wx + 20 + m * 70, 340, 30, 80); c.beginPath(); c.arc(wx + 35 + m * 70, 334, 10, 0, TAU); c.fill(); } }
      c.fillStyle = '#3a1a2a'; rr(c, 190, 380, 120, 150, [10, 10, 0, 0]); c.fill(); c.fillStyle = '#7a3a4a'; c.beginPath(); c.moveTo(170, 372); c.lineTo(330, 372); c.lineTo(340, 336); c.lineTo(160, 336); c.fill(); c.fillStyle = '#d8cfa0'; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(160 + i * 30, 336); c.lineTo(190 + i * 30, 336); c.lineTo(194 + i * 30, 372); c.lineTo(164 + i * 30, 372); c.fill(); i++; }
      c.fillStyle = '#1a1a14'; c.fillRect(110, 270, 280, 46); c.restore(); }
    if (kind === 'plain') { skylineLayer(c, SW, 528, 41, '#12183a', { hmin: 140, hmax: 280, wmin: 90, wmax: 150, lit: 0.5 }); }
  }), mx, 0);
  if (kind === 'atelier') { const fl = (Math.sin(t * 37) > 0.3 || Math.sin(t * 5.3) > 0.8) ? 0.25 : 1; g.save(); g.globalAlpha = fl; glow(g, 560 + 250 + mx, 295, 150, 'rgba(255,60,200,.55)'); txt(g, 'ATELIER', 560 + 250 + mx, 306, 40, '#ff7ad8', 'center', 700); g.restore(); txt(g, 'ATE ER', 560 + 250 + mx, 306, 40, 'rgba(255,255,255,0)', 'center', 700); }
  g.drawImage(L('tw_n', SW, H, (c) => {
    c.fillStyle = grad(c, 0, 515, 0, H, [[0, '#4a4a5a'], [0.3, '#2a2a36'], [1, '#14141c']]); c.fillRect(0, 515, SW, H - 515);
    c.fillStyle = '#6a6a78'; c.fillRect(0, 512, SW, 10); c.fillStyle = '#3a3a48'; c.fillRect(0, 576, SW, 6);
    c.fillStyle = 'rgba(255,255,255,.5)'; for (let x = 0; x < SW; x += 150) c.fillRect(x, 650, 80, 8);
    c.fillStyle = 'rgba(160,190,255,.06)'; for (let i = 0; i < 10; i++) { c.beginPath(); c.ellipse(60 + i * 190, 610 + (i % 3) * 28, 90, 10, 0, 0, TAU); c.fill(); }
  }), px(1, cam), 0);
  const nx = px(1, cam); if (o.lamps !== false) for (const x of [380, 1050, 1620]) lamp(g, x + nx, 528, 190, t);
}
function cellBg(g, t, cam = 0) {
  g.drawImage(L('cell_b', W, H, (c) => {
    c.fillStyle = grad(c, 0, 0, 0, H, [[0, '#2a2e36'], [1, '#161a20']]); c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let y = 0; y < 470; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); for (let x = (y / 26 % 2) * 30; x < W; x += 60) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 26); c.stroke(); } }
    c.fillStyle = grad(c, 0, 470, 0, H, [[0, '#3a3e46'], [1, '#14161a']]); c.fillRect(0, 470, W, H - 470);
    c.fillStyle = '#0d0f14'; rr(c, 860, 90, 150, 110, 6); c.fill(); c.fillStyle = grad(c, 0, 96, 0, 194, [[0, '#0a0f28'], [1, '#2a3a6a']]); c.fillRect(866, 96, 138, 98); stars(c, 12, 3, 1, 1); c.save(); c.translate(866, 96); stars(c, 14, 8, 138, 98, 1.3); c.restore(); c.strokeStyle = '#6a7080'; c.lineWidth = 6; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(866 + i * 34.5, 96); c.lineTo(866 + i * 34.5, 194); c.stroke(); }
    // stapelbed
    c.fillStyle = '#4a3a2e'; c.fillRect(140, 190, 12, 290); c.fillRect(480, 190, 12, 290); c.fillRect(140, 190, 352, 8);
    for (const y of [270, 400]) { c.fillStyle = '#5a4a3a'; c.fillRect(140, y, 352, 10); c.fillStyle = grad(c, 0, y - 22, 0, y, [[0, '#7a8aa0'], [1, '#4a5a70']]); rr(c, 150, y - 22, 330, 22, 6); c.fill(); c.fillStyle = '#d8d0b8'; rr(c, 156, y - 30, 70, 14, 6); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(140, 476, 352, 10);
    c.fillStyle = '#6a6e76'; rr(c, 1080, 400, 60, 70, 6); c.fill(); c.fillStyle = '#e8e4d8'; c.beginPath(); c.ellipse(1110, 400, 28, 8, 0, 0, TAU); c.fill();
  }), 0, 0);
  const x = 935, fl = (Math.sin(t * 29) > 0.8 || Math.sin(t * 3.7) > 0.95) ? 0.35 : 1; g.strokeStyle = '#111'; g.lineWidth = 2; g.beginPath(); g.moveTo(640, 0); g.lineTo(640, 74); g.stroke(); g.save(); g.globalAlpha = fl; g.fillStyle = '#fff2b0'; g.beginPath(); g.arc(640, 84, 11, 0, TAU); g.fill(); glow(g, 640, 84, 340, 'rgba(255,230,150,.55)'); g.restore();
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, x, 150, x - 300, 560, [[0, 'rgba(160,190,255,.25)'], [1, 'rgba(160,190,255,0)']]); g.beginPath(); g.moveTo(866 + 10, 100); g.lineTo(1004, 100); g.lineTo(760, 560); g.lineTo(520, 560); g.fill(); g.restore();
}
function cellBars(g, t, o = {}) { g.fillStyle = '#0a0b0e'; g.fillRect(0, 0, W, 16); g.fillRect(0, 548, W, 12); for (let x = 30; x < W; x += 86) { g.fillStyle = grad(g, x - 6, 0, x + 6, 0, [[0, '#8a909c'], [0.45, '#d0d6de'], [1, '#3a4048']]); g.fillRect(x - 6, 0, 12, 556); } }
// ---------------------------------------------------------------- atelier binnen
function mannequin(g, x, y, s, col = '#d8cfa8', lean = 0) {
  g.save(); g.translate(x, y); g.scale(s, s); g.rotate(lean); g.strokeStyle = '#3a2a1a'; g.lineWidth = 4; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -50); g.moveTo(-18, 0); g.lineTo(0, -12); g.lineTo(18, 0); g.stroke();
  g.fillStyle = grad(g, -22, -130, 22, -50, [[0, col], [1, '#8a8060']]); g.beginPath(); g.moveTo(-24, -118); g.quadraticCurveTo(-26, -90, -14, -50); g.lineTo(14, -50); g.quadraticCurveTo(26, -90, 24, -118); g.quadraticCurveTo(0, -126, -24, -118); g.fill(); g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = col; g.fillRect(-4, -134, 8, 14); g.beginPath(); g.ellipse(0, -146, 9, 12, 0, 0, TAU); g.fill(); g.restore();
}
function sewMachine(g, x, y, s, t) { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#2a1e14'; g.fillRect(-50, 0, 100, 8); g.fillRect(-40, 8, 6, 50); g.fillRect(34, 8, 6, 50); g.fillStyle = '#3a4a3a'; rr(g, -40, -48, 80, 48, 8); g.fill(); g.fillStyle = '#c8c0a0'; rr(g, -40, -60, 56, 14, 4); g.fill(); g.fillRect(-36, -46, 10, 46); g.strokeStyle = '#999'; g.lineWidth = 2; const nd = Math.abs(Math.sin(t * 9)) * 12; g.beginPath(); g.moveTo(-34, -44 + nd); g.lineTo(-34, -20 + nd); g.stroke(); g.fillStyle = '#d03a2a'; g.beginPath(); g.arc(30, -36, 5, 0, TAU); g.fill(); g.restore(); }
function atelierIn(g, t, cam = 0) {
  g.drawImage(L('at_b', W, H, (c) => {
    c.fillStyle = grad(c, 0, 0, 0, 470, [[0, '#3a4a32'], [1, '#5a5a38']]); c.fillRect(0, 0, W, 470);
    const r = rng(12); c.strokeStyle = 'rgba(30,40,20,.35)'; c.lineWidth = 12; for (let x = 20; x < W; x += 46) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, 470); c.stroke(); }
    c.fillStyle = 'rgba(20,16,10,.35)'; for (let i = 0; i < 40; i++) { c.beginPath(); c.ellipse(r() * W, r() * 460, 10 + r() * 40, 8 + r() * 24, r(), 0, TAU); c.fill(); }
    c.fillStyle = grad(c, 0, 470, 0, H, [[0, '#4a3a2a'], [1, '#1c140c']]); c.fillRect(0, 470, W, H - 470); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 2; for (let x = 0; x < W; x += 70) { c.beginPath(); c.moveTo(x, 470); c.lineTo(x - 50 + (x - 640) * 0.25, H); c.stroke(); }
    // stoffenrollen in een rek
    const cols = ['#b04a8a', '#4a8ab0', '#d8b040', '#6ab04a', '#a03a3a', '#8a5ac8', '#e8e0c8']; c.fillStyle = '#3a2a1a'; for (const y of [130, 230, 330]) { c.fillRect(30, y + 36, 520, 8); for (let i = 0; i < 11; i++) { c.fillStyle = cols[(i + y) % 7]; rr(c, 40 + i * 46, y, 36, 40, 6); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(40 + i * 46, y + 28, 36, 8); } c.fillStyle = '#3a2a1a'; }
    c.fillStyle = '#2a2018'; c.fillRect(30, 120, 8, 330); c.fillRect(542, 120, 8, 330);
    // kledingrek
    c.strokeStyle = '#7a7a82'; c.lineWidth = 5; c.beginPath(); c.moveTo(800, 470); c.lineTo(800, 220); c.lineTo(1160, 220); c.lineTo(1160, 470); c.stroke(); for (let i = 0; i < 8; i++) { const x = 826 + i * 42; c.fillStyle = cols[(i * 3) % 7]; c.beginPath(); c.moveTo(x - 14, 232); c.lineTo(x + 14, 232); c.lineTo(x + 20, 320); c.lineTo(x - 20, 320); c.fill(); c.strokeStyle = '#555'; c.lineWidth = 2; c.beginPath(); c.arc(x, 226, 5, 0, TAU); c.stroke(); }
    c.fillStyle = '#4a3a2a'; c.fillRect(0, 440, W, 8);
  }), 0, 0);
  const fl = (Math.sin(t * 31) > 0.55 && Math.sin(t * 2.3) > 0) ? 0.25 : 1; g.fillStyle = '#16181a'; g.fillRect(240, 40, 220, 14); g.fillRect(760, 40, 220, 14); g.save(); g.globalAlpha = fl; g.fillStyle = '#e8fff0'; g.fillRect(246, 50, 208, 6); g.fillRect(766, 50, 208, 6); glow(g, 350, 56, 300, 'rgba(180,255,210,.5)', 0.8); glow(g, 870, 56, 300, 'rgba(180,255,210,.5)', 0.8); g.restore();
  g.save(); g.globalAlpha = (1 - fl) * 0.55; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.restore();
  const r = rng(6); g.fillStyle = 'rgba(220,255,230,.5)'; for (let i = 0; i < 40; i++) { const x = (r() * W + Math.sin(t * 0.4 + i) * 20), y = ((r() * H + t * (6 + r() * 8)) % 440); g.fillRect(x, y, 1.6, 1.6); }
}
// ---------------------------------------------------------------- Bank van China
function bankBg(g, t, cam = 0) {
  g.drawImage(skyLayer('bk_s', [[0, '#04060f'], [0.55, '#1a1646'], [1, '#6a3a6a']], { stars: 200, starsY: 360, moon: [330, 130, 46] }), 0, 0);
  g.drawImage(L('bk_f', SW, H, (c) => { skylineLayer(c, SW, 560, 52, '#1c1c46', { hmin: 140, hmax: 320, lit: 0.35 }); }), px(0.12, cam), 0);
  const mx = px(0.45, cam);
  g.drawImage(L('bk_m', SW, H, (c) => {
    const cx = 900; c.fillStyle = grad(c, 0, 220, 0, 540, [[0, '#d8cfa8'], [1, '#8a8060']]); c.fillRect(cx - 360, 300, 720, 240);
    c.fillStyle = grad(c, 0, 250, 0, 310, [[0, '#e8e0bc'], [1, '#a89c70']]); c.beginPath(); c.moveTo(cx - 400, 304); c.lineTo(cx, 220); c.lineTo(cx + 400, 304); c.fill();
    c.fillStyle = '#b01818'; c.fillRect(cx - 400, 296, 800, 14); c.fillStyle = '#e8b840'; c.fillRect(cx - 400, 310, 800, 4);
    for (let i = 0; i < 8; i++) { const x = cx - 330 + i * 94; c.fillStyle = grad(c, x - 16, 0, x + 16, 0, [[0, '#fffbe8'], [0.6, '#d8cfa8'], [1, '#8a8060']]); c.fillRect(x - 16, 316, 32, 214); c.fillStyle = '#c8bc90'; c.fillRect(x - 22, 310, 44, 10); c.fillRect(x - 22, 524, 44, 10); }
    c.fillStyle = '#ffd27a'; for (let i = 0; i < 7; i++) { c.fillRect(cx - 284 + i * 94, 360, 30, 80); c.globalAlpha = 0.5; c.fillRect(cx - 284 + i * 94, 450, 30, 60); c.globalAlpha = 1; }
    c.fillStyle = '#e8b840'; c.beginPath(); c.arc(cx, 262, 22, 0, TAU); c.fill(); c.fillStyle = '#b01818'; c.beginPath(); c.arc(cx, 262, 14, 0, TAU); c.fill(); cjk(c, '銀', cx, 269, 16, '#ffe27a');
    for (let i = 0; i < 6; i++) { c.fillStyle = '#c8bc90'; c.fillRect(cx - 340 + i * 4, 534 + i * 6, 680 - i * 8, 6); }
    c.fillStyle = '#0d0f14'; rr(c, cx - 150, 190, 300, 36, 6); c.fill(); txt(c, 'BANK OF CHINA', cx, 217, 26, '#ffe27a', 'center', 700);
  }), mx, 0);
  for (const [x, ph] of [[900 - 300, 0], [900 + 300, 2]]) { const a = Math.sin(t * 0.8 + ph) * 0.5 - Math.PI / 2; beam(g, x + mx, 300, a, 600, 20, 140, 'rgba(255,255,255,A)', 0.14); }
  g.drawImage(L('bk_n', SW, H, (c) => { c.fillStyle = grad(c, 0, 535, 0, H, [[0, '#5a5470'], [1, '#1a1826']]); c.fillRect(0, 535, SW, H - 535); c.fillStyle = 'rgba(255,255,255,.07)'; for (let x = 0; x < SW; x += 120) c.fillRect(x, 535, 3, H); for (const x of [260, 1500]) { c.fillStyle = '#b01818'; c.fillRect(x, 330, 8, 205); c.fillStyle = '#e83030'; c.beginPath(); c.moveTo(x + 8, 330); c.lineTo(x + 70, 350); c.lineTo(x + 8, 380); c.fill(); } }), px(1, cam), 0);
}
// ---------------------------------------------------------------- vliegtuig-cabine en hemel
function flightSky(g, t, mood = 'day', sp = 1) {
  const st = { day: [[0, '#3a98e8'], [0.7, '#a8dcff'], [1, '#f4faff']], dusk: [[0, '#2a2060'], [0.4, '#b04a7a'], [0.75, '#ff8a58'], [1, '#ffd08a']], night: [[0, '#04061a'], [1, '#1a2a5a']] }[mood];
  g.fillStyle = grad(g, 0, 0, 0, H, st); g.fillRect(0, 0, W, H);
  if (mood === 'dusk') { glow(g, 900, 520, 500, 'rgba(255,170,90,.8)'); g.fillStyle = '#fff2c8'; g.beginPath(); g.arc(900, 520, 50, 0, TAU); g.fill(); }
  if (mood === 'night') { stars(g, 120, 3, W, H); }
  const cc = mood === 'dusk' ? '#ffb89a' : mood === 'night' ? '#2a3a6a' : '#fff';
  clouds(g, t * sp, { y: 40, n: 5, a: 0.5, sp: 40, col: cc, seed: 1, sc: 1.3 }); clouds(g, t * sp, { y: 250, n: 6, a: 0.85, sp: 90, col: cc, seed: 2, sc: 1.6 }); clouds(g, t * sp, { y: 480, n: 5, a: 0.95, sp: 170, col: cc, seed: 3, sc: 2.4 });
}
function cabinBg(g, t, o = {}) {
  const wob = o.shake ? Math.sin(t * 30) * o.shake : 0;
  g.save(); g.translate(0, wob);
  g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#cfd6de'], [0.62, '#aab4c0'], [0.63, '#5a6a7e'], [1, '#2a3444']]); g.fillRect(-20, -20, W + 40, H + 40);
  g.fillStyle = '#e8ecf0'; g.fillRect(-20, -20, W + 40, 90); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(-20, 70, W + 40, 8);
  for (let i = 0; i < 6; i++) { const x = 70 + i * 205; g.fillStyle = '#e2e6ea'; rr(g, x - 6, 150, 168, 230, 70); g.fill(); g.save(); rr(g, x + 8, 164, 140, 202, 58); g.clip(); g.save(); g.translate(x + 8, 164); flightSky(g, t, o.sky || 'day', 0.5); g.restore(); g.restore(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 40, 164); g.lineTo(x + 80, 164); g.lineTo(x + 20, 366); g.lineTo(x - 20, 366); g.fill(); g.strokeStyle = '#9aa4ae'; g.lineWidth = 3; rr(g, x + 8, 164, 140, 202, 58); g.stroke(); }
  g.fillStyle = '#c8ced6'; for (let i = 0; i < 6; i++) { rr(g, 40 + i * 205, 78, 190, 40, 10); g.fill(); g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(48 + i * 205, 108, 174, 3); g.fillStyle = '#c8ced6'; }
  g.fillStyle = '#2a3a5a'; g.fillRect(-20, 560, W + 40, 8); g.fillStyle = grad(g, 0, 400, 0, 560, [[0, '#6a2a3a'], [1, '#3a1822']]); g.fillRect(-20, 548, W + 40, 200);
  g.restore();
}
function seatBack(g, x, y, s, col = '#2a4a8a') { g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = grad(g, -40, -120, 40, 0, [[0, col], [1, 'rgba(0,0,0,.6)']]); rr(g, -44, -130, 88, 130, 22); g.fill(); g.fillStyle = 'rgba(255,255,255,.7)'; rr(g, -26, -112, 52, 22, 8); g.fill(); g.fillStyle = 'rgba(0,0,0,.25)'; rr(g, -44, -50, 88, 50, [0, 0, 10, 10]); g.fill(); g.restore(); }
// ---------------------------------------------------------------- eiland en strand
function palm(g, x, y, h, lean, t, ph = 0, dark = 0) {
  g.save(); g.translate(x, y); g.strokeStyle = dark ? '#3a2a1a' : '#8a5a2a'; g.lineWidth = h * 0.06; g.lineCap = 'round'; const tx = lean * h, ty = -h; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(tx * 0.1, ty * 0.6, tx, ty); g.stroke();
  g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = h * 0.015; for (let i = 1; i < 8; i++) { const u = i / 8; g.beginPath(); g.moveTo(tx * u * u - 4, ty * u); g.lineTo(tx * u * u + 4, ty * u); g.stroke(); }
  g.translate(tx, ty); const sw = Math.sin(t * 1.3 + ph) * 0.08;
  for (let i = 0; i < 7; i++) { const a = -Math.PI * 0.95 + i * (Math.PI * 0.95 / 3) + sw * (i % 2 ? 1 : -1); g.save(); g.rotate(a); g.fillStyle = grad(g, 0, 0, h * 0.6, 0, [[0, dark ? '#2a6a3a' : '#4aa84a'], [1, dark ? '#124a24' : '#2a7a34']]); g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(h * 0.3, -h * 0.16, h * 0.62, h * 0.12); g.quadraticCurveTo(h * 0.3, -h * 0.02, 0, 0); g.fill(); g.restore(); }
  g.fillStyle = '#6a3a1a'; for (const dx of [-5, 5]) { g.beginPath(); g.arc(dx, 6, h * 0.035, 0, TAU); g.fill(); } g.restore();
}
function islandBg(g, t, cam = 0, mood = 'dusk') {
  const K = 'is_' + mood, day = mood === 'day';
  g.drawImage(skyLayer(K + 's', day ? [[0, '#3a98e8'], [0.7, '#a8dcff'], [1, '#fff4d0']] : [[0, '#2a2468'], [0.35, '#c04a7a'], [0.7, '#ff8a58'], [1, '#ffd890']], day ? { sun: [980, 130, 400, 50] } : { sun: [760, 410, 440, 56], sunCol: 'rgba(255,160,90,.9)', stars: 50, starsY: 140 }), 0, 0);
  clouds(g, t, { y: 50, n: 5, a: day ? 0.9 : 0.55, sp: 8, col: day ? '#fff' : '#ffb89a', seed: 21 });
  g.drawImage(L(K + 'f', SW, H, (c) => { c.fillStyle = grad(c, 0, 420, 0, 520, [[0, day ? '#2a8ac8' : '#c8607a'], [1, day ? '#1a6aa8' : '#7a3a6a']]); c.fillRect(0, 424, SW, 120); ridge(c, SW, 410, 14, 5, day ? '#4a8a6a' : '#5a3a6a'); c.fillStyle = day ? '#2a8ac8' : '#a85a7a'; c.fillRect(0, 424, SW, 10); }), px(0.1, cam), 0);
  g.save(); g.globalCompositeOperation = 'lighter'; const r = rng(3); for (let i = 0; i < 40; i++) { const x = r() * W, y = 436 + r() * 70, a = 0.3 + 0.7 * Math.abs(Math.sin(t * 2 + i)); g.fillStyle = `rgba(255,220,170,${a * 0.5})`; g.fillRect(x, y, 14 + r() * 22, 2); } g.restore();
  const mx = px(0.4, cam); g.drawImage(L(K + 'm', SW, H, (c) => { const r2 = rng(8); for (let i = 0; i < 26; i++) { const x = i * 70 + r2() * 30; tree(c, x, 520, 100 + r2() * 60, day ? '#2f9a4a' : '#2a4a4a', day ? '#1a6a34' : '#16303a'); } c.fillStyle = grad(c, 0, 480, 0, 560, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.35)']]); c.fillRect(0, 480, SW, 80); }), mx, 0);
  for (const [x, h, l, ph] of [[150, 260, 0.12, 0], [420, 200, -0.1, 1], [1180, 280, -0.14, 2], [1520, 220, 0.1, 3]]) palm(g, x + mx * 1.2, 520, h, l, t, ph, !day);
  g.drawImage(L(K + 'n', SW, H, (c) => { c.fillStyle = grad(c, 0, 505, 0, H, [[0, day ? '#f0dca0' : '#e8b888'], [0.5, day ? '#e0c080' : '#c08a64'], [1, day ? '#c8a060' : '#8a5a44']]); c.beginPath(); c.moveTo(0, 520); for (let x = 0; x <= SW; x += 40) c.lineTo(x, 508 + Math.sin(x * 0.012) * 6); c.lineTo(SW, H); c.lineTo(0, H); c.fill(); const r3 = rng(9); c.fillStyle = 'rgba(80,50,20,.18)'; for (let i = 0; i < 140; i++) { c.beginPath(); c.ellipse(r3() * SW, 540 + r3() * 180, 2 + r3() * 5, 1 + r3() * 2, 0, 0, TAU); c.fill(); } }), px(1, cam), 0);
  const nx = px(1, cam); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.moveTo(0, 500); for (let x = 0; x <= W + 40; x += 20) g.lineTo(x, 498 + Math.sin(x * 0.03 + t * 1.6) * 3 + Math.sin(t * 0.9) * 4 - 6); for (let x = W + 40; x >= 0; x -= 20) g.lineTo(x, 512 + Math.sin(x * 0.02 - t * 1.2) * 3 + Math.sin(t * 0.9) * 4); g.fill(); void nx;
}
function wreckPiece(g, x, y, s, t, o = {}) { // brokken vliegtuigromp
  g.save(); g.translate(x, y); g.scale(s * (o.face || 1), s); g.rotate(o.rot || 0);
  g.fillStyle = grad(g, 0, -60, 0, 0, [[0, '#e8ecf0'], [1, '#98a0aa']]); g.beginPath(); g.moveTo(-120, 0); g.quadraticCurveTo(-130, -60, -60, -66); g.lineTo(60, -58); g.lineTo(76, -42); g.lineTo(50, -30); g.lineTo(70, -14); g.lineTo(40, 0); g.closePath(); g.fill(); g.strokeStyle = '#0d0f14'; g.lineWidth = 3; g.stroke();
  g.fillStyle = '#8ac8f0'; for (let i = 0; i < 5; i++) if (i !== 3) { rr(g, -90 + i * 26, -46, 14, 14, 4); g.fill(); } g.fillStyle = '#d03a2a'; g.fillRect(-120, -22, 150, 5);
  g.fillStyle = '#1a1a1e'; g.beginPath(); g.moveTo(60, -58); g.lineTo(76, -42); g.lineTo(62, -36); g.lineTo(70, -26); g.fill();
  g.restore();
  if (o.smoke) for (let i = 0; i < 3; i++) smokeAt(g, x + (20 + i * 12) * s, y - 60 * s, t, i + (o.seed || 0), '50,50,56', 200);
}

// ================================================================ TAFERELEN
const HATS = ['#d03a2a', '#3a6ad0', '#e0a020', '#c84a8a', '#8a5ac8'], COATS = ['#4a6ac8', '#c84a4a', '#4aa070', '#a8782a', '#7a5ab8'];
const gnome = (g, o) => { shadow(g, o.x, o.y, 22 * (o.s || 1), 0.3); drawGnome(g, o); };
const teun = (g, o) => { shadow(g, o.x, o.y, 22 * (o.s || 1)); drawTeUn(g, o); };
function mobOf(g, t, x, y, n, s, o = {}) { const { gap = 46, face = 1, tool = 'torch', sp = 8, angry = true, bobb = 0 } = o; for (let i = 0; i < n; i++) { gnome(g, { x: x + i * gap * face * -1 + Math.sin(i * 2.1) * 10, y: y + (i % 2) * 14 * s / 2, s: s * (1 - (i % 2) * 0.08), face, walk: t * sp + i * 1.7, t: t + i, hat: HATS[i % 5], coat: COATS[(i * 2) % 5], angry, tool: tool === 'mix' ? (i % 2 ? 'fork' : 'torch') : tool }); } }
function globe(g, x, y, r, t) { g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); g.fillStyle = grad(g, x, y - r, x, y + r, [[0, '#4aa8f0'], [1, '#1a5aa8']]); g.fillRect(x - r, y - r, r * 2, r * 2); g.fillStyle = '#4aa84a'; for (let i = 0; i < 4; i++) { const bx = x + (((i * 0.9 + t * 0.5) % 3.6) - 1.8) * r; g.beginPath(); g.ellipse(bx, y + (i - 1.5) * r * 0.3, r * 0.4, r * 0.28, i, 0, TAU); g.fill(); } g.fillStyle = rgrad(g, x - r * 0.4, y - r * 0.4, 1, r * 1.3, [[0, 'rgba(255,255,255,.4)'], [1, 'rgba(0,0,0,.3)']]); g.fillRect(x - r, y - r, r * 2, r * 2); g.restore(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); }
function poof(g, x, y, k, r = 80) { if (k <= 0 || k >= 1) return; for (let i = 0; i < 9; i++) { const a = i * TAU / 9 + 0.3, d = k * r * (0.6 + (i % 3) * 0.25); g.fillStyle = `rgba(230,230,240,${(1 - k) * 0.85})`; g.beginPath(); g.arc(x + Math.cos(a) * d, y - 30 + Math.sin(a) * d * 0.7, 14 + k * 26, 0, TAU); g.fill(); } glow(g, x, y - 40, r * 2, 'rgba(255,255,255,1)', (1 - k) * 0.6); }
function bills(g, t, x, y, n = 9, seed = 1) { const r = rng(seed); for (let i = 0; i < n; i++) { const ph = (t * 0.6 + r()) % 1, bx = x + (r() - 0.5) * 120 + Math.sin(ph * 8 + i) * 20, by = y - ph * 160 + ph * ph * 120; g.save(); g.translate(bx, by); g.rotate(ph * 6 + i); g.globalAlpha = 1 - ph * 0.6; g.fillStyle = '#6ac86a'; g.fillRect(-9, -5, 18, 10); g.strokeStyle = '#2a6a2a'; g.lineWidth = 1.5; g.strokeRect(-9, -5, 18, 10); g.fillStyle = '#2a6a2a'; g.beginPath(); g.arc(0, 0, 2.5, 0, TAU); g.fill(); g.restore(); } }
function coinsBurst(g, k, x, y, n = 18, seed = 2) { if (k <= 0) return; const r = rng(seed); for (let i = 0; i < n; i++) { const a = -Math.PI * (0.15 + r() * 0.7), v = 150 + r() * 260, tt = k * 1.4; const cx = x + Math.cos(a) * v * tt, cy = y + Math.sin(a) * v * tt + 500 * tt * tt; g.save(); g.translate(cx, cy); g.rotate(tt * 8 + i); g.scale(1, Math.abs(Math.cos(tt * 12 + i)) * 0.8 + 0.2); g.fillStyle = '#ffd23a'; g.beginPath(); g.arc(0, 0, 8, 0, TAU); g.fill(); g.strokeStyle = '#a87a10'; g.lineWidth = 2; g.stroke(); g.restore(); } }
function dust(g, t, x, y, n = 5, s = 1) { for (let i = 0; i < n; i++) { const ph = (t * 2.2 + i / n) % 1; g.fillStyle = `rgba(190,170,140,${(1 - ph) * 0.45})`; g.beginPath(); g.arc(x - ph * 80 * s, y - ph * 24 * s - 4, (4 + ph * 14) * s, 0, TAU); g.fill(); } }
function qmark(g, x, y, t, ph = 0, col = '#ffe27a', ch = '?') { const k = 0.5 + 0.5 * Math.sin(t * 3 + ph); g.save(); g.translate(x, y - k * 8); g.rotate(Math.sin(t * 2 + ph) * 0.15); txt(g, ch, 0, 0, 56, '#0d0f14', 'center', 700); txt(g, ch, -2, -2, 56, col, 'center', 700); g.restore(); }
function bigText(g, s, x, y, size, col = '#ffe27a') { g.save(); g.lineJoin = 'round'; g.font = `700 ${size}px ${FONT}`; g.textAlign = 'center'; g.lineWidth = size * 0.16; g.strokeStyle = '#0d0f14'; g.strokeText(s, x, y); g.fillStyle = col; g.fillText(s, x, y); g.restore(); }
// lus-scrollen: een brede laag herhalen
function loopBlit(g, c, off) { const o = -(((off % SW) + SW) % SW); g.drawImage(c, o, 0); g.drawImage(c, o + SW, 0); }

const SCENES = {};

// ---------------------------------------------------------------- Hoofdstuk 1: intro
SCENES.ch1_intro = [
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.012, 640, 420); villageBg(g, t, -150 + t * 22, 'dusk');
    for (let i = 0; i < 3; i++) gnome(g, { x: 180 + i * 90 + t * 14, y: 556 + (i % 2) * 6, s: 1.3, face: 1, walk: t * 4 + i * 2, t, hat: HATS[i], coat: COATS[i], angry: false, tool: 'none' });
    gnome(g, { x: 1100 - t * 18, y: 560, s: 1.4, face: -1, walk: t * 4, t, hat: HATS[3], coat: COATS[1], angry: false, tool: 'none' });
    teun(g, { x: 260 + t * 62, y: 548, s: 2.4, face: 1, walk: t * 7, pose: 'walk', t, outfit: 'classic' });
    g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.02, 760, 420); villageBg(g, t, 40 - t * 10, 'dusk');
    // voorgrondheuvel
    g.fillStyle = grad(g, 0, 470, 0, H, [[0, '#2a3a22'], [1, '#0e1a10']]); g.beginPath(); g.moveTo(420, H); g.quadraticCurveTo(560, 470, 760, 478); g.quadraticCurveTo(1000, 486, 1280, 520); g.lineTo(1280, H); g.fill();
    g.fillStyle = '#1a2a16'; for (let i = 0; i < 30; i++) { const x = 560 + i * 24, y = 482 + Math.sin(i) * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 3 + Math.sin(t * 2 + i) * 3, y - 14); g.lineTo(x + 6, y); g.fill(); }
    // verre vliegtuigjes met condensstreep
    for (let i = 0; i < 2; i++) { const x = ((t * 36 + i * 500) % 1500) - 100, y = 120 + i * 70 - x * 0.03; g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 200, y + 6); g.lineTo(x, y); g.stroke(); drawPlane(g, { x, y, s: 0.1, tilt: -0.05, t }); }
    teun(g, { x: 800, y: 492, s: 3, face: 1, pose: 'stand', t, outfit: 'classic' });
    const k = sstep(prog(t, 2.2, 3.2)); if (k > 0) { g.save(); g.globalAlpha = k; zoomAt(g, 0.8 + 0.2 * k, 930, 280); bubble(g, 880, 160, 150, 120, 850, 320); globe(g, 955, 218, 40, t); g.restore(); }
    g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1.04 + t * 0.01, 560, 360); villageBg(g, t, 0, 'dusk'); tint(g, 'rgba(10,10,40,.35)');
    g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, W, H);
    const bob = Math.sin(t * 2) * 3; teun(g, { x: 440, y: 560, s: 3.6, face: 1, pose: 'sad', t, outfit: 'classic', sack: false });
    // lege zakken die naar buiten wapperen
    for (const dx of [-1, 1]) { g.save(); g.translate(440 + dx * 40, 560 - 80); g.rotate(dx * (0.5 + Math.sin(t * 3 + dx) * 0.12)); g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(0, 0); g.lineTo(dx * 30, 6); g.lineTo(dx * 24, 30); g.lineTo(0, 22); g.fill(); g.strokeStyle = '#999'; g.lineWidth = 2; g.stroke(); g.restore(); }
    if (t > 1) { const k = sstep(prog(t, 1, 2)); g.save(); g.globalAlpha = k; bubble(g, 560, 150 + bob, 330, 170, 480, 330); g.fillStyle = '#e8c64a'; rr(g, 600, 195 + bob, 140, 78, 8); g.fill(); g.strokeStyle = '#6a4a10'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#6a4a10'; g.fillRect(612, 212 + bob, 116, 6); g.fillRect(612, 228 + bob, 70, 5); drawPlane(g, { x: 690, y: 257 + bob, s: 0.12, t });
      g.fillStyle = '#d03a2a'; rr(g, 760, 190 + bob, 120, 70, 10); g.fill(); txt(g, '€ 999', 820, 238 + bob, 34, '#fff', 'center', 700); txt(g, '= € 0', 820, 288 + bob, 28, '#6a1810', 'center', 700); g.restore(); }
    // een motje vliegt uit zijn zak
    const mt = t * 3; g.fillStyle = '#c8b898'; g.beginPath(); g.ellipse(520 + Math.sin(t) * 70 + t * 20, 470 + Math.cos(t * 1.4) * 40, 8, 3 + Math.abs(Math.sin(mt * 4)) * 8, 0.3, 0, TAU); g.fill();
    g.restore(); },
  (g, t, c) => { g.save(); const z = 1 + t * 0.03; zoomAt(g, z, 600, 400); villageBg(g, t, 30 + t * 6, 'night'); tint(g, 'rgba(4,6,24,.45)');
    const sp = glow; const k = prog(t, 0, 1); void sp; void k;
    // maanlicht-spot
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, 620, 60, 620, 560, [[0, 'rgba(170,200,255,.28)'], [1, 'rgba(170,200,255,0)']]); g.beginPath(); g.moveTo(560, 40); g.lineTo(680, 40); g.lineTo(820, 570); g.lineTo(420, 570); g.fill(); g.restore();
    const phase = t < 1.8 ? 0 : t < 2.9 ? 1 : 2;
    if (phase === 0) teun(g, { x: 620, y: 560, s: 3.4, pose: 'stand', t, outfit: 'classic' });
    if (phase === 1) { const k2 = prog(t, 1.8, 2.9); teun(g, { x: 620, y: 560, s: 3.4, pose: 'pullmask', t, outfit: 'classic', hatLift: k2 * 14, rolled: k2 > 0.4 }); }
    if (phase === 2) { c.cue(2.9, 'whoosh'); teun(g, { x: 620, y: 560, s: 3.4, pose: 'stand', t, outfit: 'black', mask: 1, gloves: 1 }); poof(g, 620, 540, prog(t, 2.9, 3.9), 120); }
    if (t > 2.9) { const k3 = sstep(prog(t, 3.2, 4.2)); g.save(); g.globalAlpha = k3 * (0.6 + 0.4 * Math.sin(t * 5)); sparkle(g, 700, 380, 14); sparkle(g, 540, 410, 10); g.restore(); }
    g.restore(); },
];

// ---------------------------------------------------------------- Hoofdstuk 1: einde
SCENES.ch1_end = [
  (g, t, c) => { c.cue(0.3, 'siren'); g.save(); const cam = -t * 8; zoomAt(g, 1 + t * 0.008, 640, 400); villageBg(g, t, cam, 'night'); g.drawImage(bankSprite(), 270 - cam, 25);
    const dx = 620 - cam, al = Math.floor(t * 4) % 2; glow(g, dx, 500, 120, 'rgba(255,220,120,1)', 0.5); glow(g, 270 + 350 - cam, 270, 120, al ? 'rgba(255,40,40,1)' : 'rgba(255,40,40,.2)', 0.9);
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, dx, 540, dx + 380, 560, [[0, 'rgba(255,220,130,.4)'], [1, 'rgba(255,220,130,0)']]); g.beginPath(); g.moveTo(dx - 30, 480); g.lineTo(dx + 500, 560); g.lineTo(dx + 500, 620); g.lineTo(dx - 30, 545); g.fill(); g.restore();
    const x = 670 - cam + Math.min(t * 55, 330); teun(g, { x, y: 548, s: 2.5, face: 1, pose: 'sneak', walk: t * 6, t, outfit: 'black', mask: 1, gloves: 1 });
    bills(g, t, x - 40, 440, 10, 3); beam(g, 270 + 350 - cam, 40, 1.3, 700, 12, 90, 'rgba(255,255,255,A)', 0.14);
    g.restore(); },
  (g, t, c) => { g.save(); const sh = Math.sin(t * 5) * 2; zoomAt(g, 1.06, 640, 420); villageBg(g, t, 80, 'night'); tint(g, 'rgba(10,5,20,.35)');
    const fl = 0.8 + 0.2 * Math.sin(t * 17); glow(g, 640, 380, 700, 'rgba(255,120,30,1)', 0.35 * fl);
    // verre Te-Un
    teun(g, { x: 1120, y: 548, s: 1.5, face: 1, pose: 'run', walk: t * 12, t, outfit: 'black', mask: 1, gloves: 1 });
    mobOf(g, t, 640, 560 + sh, 3, 3, { gap: 160, face: 1, tool: 'mix', sp: 3, bobb: 1 });
    mobOf(g, t, 470, 540, 2, 2.4, { gap: 150, face: 1, tool: 'torch', sp: 3 });
    const k = (Math.floor(t * 3) % 2); for (let i = 0; i < 3; i++) qmark(g, 560 + i * 170, 250 - (i % 2) * 40, t, i, '#ff5a3a', '!');
    g.restore(); },
  (g, t, c) => { g.save(); villageBg(g, t, t * 300, 'night', { loop: 1 }); tint(g, 'rgba(10,5,20,.2)'); glow(g, 300, 400, 600, 'rgba(255,120,30,1)', 0.25);
    const x = 780 + Math.sin(t * 1.3) * 14; dust(g, t, x - 30, 548, 6, 1.4);
    teun(g, { x, y: 552, s: 2.8, face: 1, pose: 'run', walk: t * 14, t, outfit: 'black', mask: 1, gloves: 1 });
    mobOf(g, t, 480 + Math.sin(t) * 10, 556, 6, 2.6, { gap: 110, face: 1, tool: 'mix', sp: 12 });
    g.restore(); },
  (g, t, c) => { g.save(); const cam = -300 + t * 50; airportBg(g, t, cam, 'night'); const x = 120 + t * 90;
    mobOf(g, t, x - 330, 575, 4, 1.7, { gap: 90, face: 1, tool: 'torch', sp: 10 });
    teun(g, { x, y: 590, s: 2.4, face: 1, pose: 'run', walk: t * 13, t, outfit: 'black', mask: 1, gloves: 1 }); dust(g, t, x - 30, 590, 5, 1.2);
    drawPlane(g, { x: 1040 - cam * 0.9 + 80, y: 515 - 24 * 0.6, s: 0.6, t });
    g.restore(); },
  (g, t, c) => { c.cue(1.15, 'chime'); g.save(); zoomAt(g, 1 + t * 0.01, 700, 380); airportHall(g, t);
    // robot achter het loket
    const rx = 920; drawRobotChar(g, { x: rx, y: 500, s: 2.6, face: -1, t, skin: 'white', alert: false }); g.fillStyle = '#d03a2a'; g.beginPath(); g.moveTo(rx - 34, 328); g.quadraticCurveTo(rx, 300, rx + 34, 328); g.lineTo(rx + 40, 334); g.lineTo(rx - 40, 334); g.fill();
    counterFront(g, 620, 470, 620);
    const slam = prog(t, 0.8, 1.2); const bx = 340 + 0, by = 500 - Math.sin(slam * Math.PI) * 60 * (t < 1.2 ? 1 : 0);
    teun(g, { x: 410, y: 558, s: 3, face: 1, pose: t > 1 ? 'stand' : 'walk', walk: t * 6, t, outfit: 'classic', sack: false });
    if (t < 1.2) { g.save(); g.translate(bx + 300 * slam, by - 40 - (1 - slam) * 40); drawMoneyBag(g, 0, 0, 1.8); g.restore(); } else { drawMoneyBag(g, 640, 478, 1.8); }
    coinsBurst(g, prog(t, 1.15, 2.6), 650, 440, 18, 5);
    const pt = prog(t, 2.2, 3.4); g.save(); g.translate(880, 478); g.fillStyle = '#fff'; g.fillRect(-60, -40 * pt * 0, 120, 8); g.fillStyle = '#e8c64a'; g.fillRect(-60 + 20 - 340 * (1 - pt) * 0, 4 + (1 - pt) * 0, 120 * pt, 40 * pt); g.restore();
    g.restore(); },
  (g, t, c) => { c.cue(0.3, 'plane'); g.save(); g.translate(0, Math.max(0, (t - 1.5) * 90)); airportBg(g, t, 100 + t * 10, 'night'); const k = Math.max(0, t - 1.2);
    mobOf(g, t, 520, 590, 6, 1.8, { gap: 80, face: 1, tool: 'mix', sp: 0, angry: true });
    const x = 140 + t * t * 38 + k * 120, ly = Math.max(0, k * k * 36); drawPlane(g, { x: 220 + x * 1.2, y: 515 - 24 * 1.2 - ly, s: 1.2, tilt: -Math.min(0.32, k * 0.14), t });
    g.restore(); },
];

function airportHall(g, t) {
  g.drawImage(L('hall', W, H, (c) => {
    c.fillStyle = grad(c, 0, 0, 0, 470, [[0, '#f4e2c0'], [1, '#e8c898']]); c.fillRect(0, 0, W, 470);
    c.fillStyle = 'rgba(190,60,40,.16)'; for (let x = 30; x < W; x += 90) for (let y = 120; y < 470; y += 90) { c.beginPath(); c.arc(x + ((y / 90) % 2) * 45, y, 22, Math.PI, 0); c.fill(); c.fillRect(x + ((y / 90) % 2) * 45 - 6, y, 12, 18); }
    for (const x of [140, 470]) { c.fillStyle = '#6a4a2a'; c.beginPath(); c.arc(x, 220, 82, 0, TAU); c.fill(); c.fillStyle = grad(c, 0, 148, 0, 292, [[0, '#0a1030'], [1, '#2a3a7a']]); c.beginPath(); c.arc(x, 220, 70, 0, TAU); c.fill(); stars(c, 0, 1, 1, 1); c.save(); c.translate(x - 70, 150); c.beginPath(); c.arc(70, 70, 70, 0, TAU); c.clip(); stars(c, 20, x, 140, 140, 1.5); c.fillStyle = '#e8c64a'; c.fillRect(0, 112, 140, 4); c.restore(); c.strokeStyle = '#6a4a2a'; c.lineWidth = 6; c.beginPath(); c.moveTo(x - 70, 220); c.lineTo(x + 70, 220); c.moveTo(x, 150); c.lineTo(x, 290); c.stroke(); }
    c.fillStyle = '#243c78'; rr(c, 20, 50, 330, 54, 10); c.fill(); txt(c, 'VERTREK', 185, 90, 38, '#fff', 'center', 700);
    c.fillStyle = grad(c, 0, 470, 0, H, [[0, '#b8886a'], [1, '#6a4430']]); c.fillRect(0, 470, W, H - 470); c.fillStyle = 'rgba(0,0,0,.12)'; for (let y = 470; y < H; y += 44) for (let x = ((y / 44) % 2) * 44; x < W; x += 88) c.fillRect(x, y, 44, 44);
    c.fillStyle = '#4a2a1a'; c.fillRect(0, 462, W, 12);
  }), 0, 0);
  rr(g, 700, 70, 500, 74, 12); g.fillStyle = '#243c78'; g.fill(); g.strokeStyle = '#e8c64a'; g.lineWidth = 4; g.stroke(); txt(g, 'LOKET 1 - TICKETS', 950, 122, 38, '#ffe27a', 'center', 700);
  const k = 0.7 + 0.3 * Math.sin(t * 3); glow(g, 950, 108, 220, 'rgba(255,220,120,.7)', 0.3 * k); glow(g, 640, 40, 500, 'rgba(255,230,180,.5)', 0.3);
}
function counterFront(g, x, y, w) {
  g.fillStyle = 'rgba(160,220,255,.18)'; g.fillRect(x + 20, y - 190, w - 40, 190); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 5; g.strokeRect(x + 20, y - 190, w - 40, 190); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.moveTo(x + 70, y - 190); g.lineTo(x + 130, y - 190); g.lineTo(x + 60, y); g.lineTo(x, y); g.fill();
  g.fillStyle = grad(g, 0, y, 0, y + 100, [[0, '#8a5a30'], [1, '#4a2c14']]); g.fillRect(x, y, w, 100); g.fillStyle = '#b07a44'; rr(g, x - 10, y - 10, w + 20, 18, 5); g.fill(); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 6, y - 8, w + 12, 3);
  g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 2; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + i * w / 5, y + 8); g.lineTo(x + i * w / 5, y + 100); g.stroke(); }
}
function restaurantFront(g, t, x, y) { // x = midden, y = grond
  g.save(); g.translate(x, y);
  g.fillStyle = grad(g, 0, -300, 0, 0, [[0, '#b01a1a'], [1, '#6a0e12']]); g.fillRect(-330, -280, 660, 280);
  g.fillStyle = '#2a1a22'; g.beginPath(); g.moveTo(-370, -270); g.quadraticCurveTo(-300, -270, -280, -330); g.lineTo(280, -330); g.quadraticCurveTo(300, -270, 370, -270); g.quadraticCurveTo(0, -240, -370, -270); g.fill(); g.fillStyle = '#e8b840'; g.fillRect(-330, -272, 660, 6);
  g.fillStyle = '#ffd27a'; for (const dx of [-250, 170]) { g.fillRect(dx, -200, 110, 130); g.strokeStyle = '#e8b840'; g.lineWidth = 6; g.strokeRect(dx, -200, 110, 130); g.beginPath(); g.moveTo(dx + 55, -200); g.lineTo(dx + 55, -70); g.stroke(); glow(g, dx + 55, -135, 150, 'rgba(255,190,90,.55)', 0.8); for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(80,20,10,.5)'; g.beginPath(); g.arc(dx + 25 + i * 30, -120, 14, Math.PI, 0); g.fill(); g.fillStyle = '#ffd27a'; } }
  g.fillStyle = '#3a1a10'; rr(g, -60, -170, 120, 170, [14, 14, 0, 0]); g.fill(); g.fillStyle = '#ffcf80'; rr(g, -52, -162, 104, 162, [10, 10, 0, 0]); g.fill(); glow(g, 0, -80, 140, 'rgba(255,200,110,.8)', 0.9);
  const fl = 0.85 + 0.15 * Math.sin(t * 9); g.fillStyle = '#10080a'; rr(g, -190, -258, 380, 70, 12); g.fill(); g.strokeStyle = '#ffcf3a'; g.lineWidth = 5; g.stroke(); glow(g, 0, -224, 230, 'rgba(255,200,50,.6)', fl * 0.7); txt(g, 'GOUDEN DRAAK', 0, -206, 46, '#ffe27a', 'center', 700);
  g.restore(); lantern(g, x - 300, y - 270, 0.9, t, 0); lantern(g, x + 300, y - 270, 0.9, t, 2); lantern(g, x - 160, y - 190, 0.6, t, 4); lantern(g, x + 160, y - 190, 0.6, t, 1);
}
function boxBami(g, x, y, s, t, steam = true) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = '#f4f0e4'; g.beginPath(); g.moveTo(-26, 0); g.lineTo(-34, -42); g.lineTo(34, -42); g.lineTo(26, 0); g.closePath(); g.fill(); g.strokeStyle = '#b02a2a'; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = '#b02a2a'; g.beginPath(); g.moveTo(-30, -20); g.lineTo(30, -20); g.lineTo(28, -8); g.lineTo(-28, -8); g.fill(); g.fillStyle = '#e8c64a'; g.beginPath(); g.arc(0, -14, 4, 0, TAU); g.fill();
  g.strokeStyle = '#7a7a82'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(-30, -42); g.quadraticCurveTo(0, -78, 30, -42); g.stroke();
  g.fillStyle = '#e8b050'; g.beginPath(); g.ellipse(0, -42, 34, 8, 0, 0, TAU); g.fill(); g.strokeStyle = '#c88a30'; g.lineWidth = 2; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 9, -45); g.quadraticCurveTo(i * 9 + 6, -40, i * 9 - 4, -38); g.stroke(); }
  g.restore(); if (steam) for (let i = 0; i < 4; i++) { const ph = (t * 0.5 + i / 4) % 1; g.fillStyle = `rgba(255,255,255,${(1 - ph) * 0.4})`; g.beginPath(); g.arc(x + Math.sin(ph * 6 + i) * 8 * s, y - 50 * s - ph * 60 * s, (6 + ph * 14) * s, 0, TAU); g.fill(); }
}
function fireworks(g, t, seed = 1, n = 3) { g.save(); g.globalCompositeOperation = 'lighter'; const r = rng(seed); for (let b = 0; b < n; b++) { const per = 2.4, off = r() * per, cx = 140 + r() * (W - 280), cy = 90 + r() * 170, col = ['255,90,90', '255,220,90', '120,200,255', '255,120,220'][b % 4]; const k = (((t + off) % per) / per); if (k < 0.15) { g.fillStyle = `rgba(${col},.9)`; g.fillRect(cx - 1, cy + (0.15 - k) * 1200 / 1 - 0, 3, 14); continue; } const q = (k - 0.15) / 0.85; for (let i = 0; i < 28; i++) { const a = i * TAU / 28, d = (1 - Math.pow(1 - q, 2)) * 90 * (0.7 + (i % 3) * 0.2); g.fillStyle = `rgba(${col},${(1 - q)})`; g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d + q * q * 40, 2.4 * (1 - q * 0.5), 0, TAU); g.fill(); } } g.restore(); }
function schipholBg(g, t, cam = 0) {
  nlBg(g, t, cam * 0.2, 'dusk');
  g.fillStyle = grad(g, 0, 505, 0, H, [[0, '#7a8294'], [1, '#383e4c']]); g.fillRect(0, 505, W, H - 505);
  g.drawImage(terminalSprite(), 170 - cam * 0.6, 160);
  g.fillStyle = '#ffd23a'; for (let x = 0; x < W + 100; x += 140) g.fillRect(((x - cam * 1.0) % (W + 140) + W + 140) % (W + 140) - 60, 600, 80, 6);
  g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 505, W, 3);
}
function mapScene(g, t) {
  g.fillStyle = grad(g, 0, 0, W, H, [[0, '#14243f'], [1, '#0a1428']]); g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(120,170,255,.1)'; g.lineWidth = 1; for (let x = 0; x < W; x += 60) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  g.save(); g.translate(620, 300); g.rotate(-0.03); g.fillStyle = grad(g, 0, -230, 0, 230, [[0, '#2a5a8a'], [1, '#1a3a64']]); rr(g, -480, -230, 960, 460, 22); g.fill(); g.strokeStyle = '#e8c64a'; g.lineWidth = 6; g.stroke();
  g.fillStyle = '#4a9a5a'; const land = [[[-420, -120], [-330, -170], [-220, -150], [-170, -60], [-250, 20], [-330, 120], [-400, 40]], [[-110, -150], [-20, -170], [60, -140], [90, -60], [30, 20], [-40, 120], [-110, 60], [-130, -40]], [[110, -150], [230, -180], [400, -130], [430, -40], [350, 20], [260, 0], [200, 90], [130, 30]], [[260, 130], [360, 110], [420, 160], [340, 200]]];
  for (const poly of land) { g.beginPath(); poly.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); g.strokeStyle = '#2a6a3a'; g.lineWidth = 3; g.stroke(); }
  g.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 6; i++) g.fillRect(-460, -200 + i * 70, 920, 2);
  const a = [-30, -100], b = [300, -60], k = sstep(prog(t, 0.6, 3.4)), cx = (a[0] + b[0]) / 2, cy = Math.min(a[1], b[1]) - 130;
  const pt = (u) => [(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * cx + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * cy + u * u * b[1]];
  g.strokeStyle = '#ff4a3a'; g.lineWidth = 5; g.setLineDash([14, 10]); g.lineDashOffset = -t * 20; g.beginPath(); for (let u = 0; u <= k; u += 0.02) { const [x, y] = pt(u); u === 0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); g.setLineDash([]);
  g.fillStyle = '#ff9a2a'; g.beginPath(); g.arc(a[0], a[1], 10, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText('NL', a[0], a[1] + 40);
  const pulse = 1 + 0.25 * Math.sin(t * 6); g.fillStyle = '#e0261e'; g.beginPath(); g.arc(b[0], b[1], 12 * pulse, 0, TAU); g.fill(); glow(g, b[0], b[1], 70, 'rgba(255,60,40,1)', 0.7); g.fillStyle = '#fff'; g.fillText('CHINA', b[0], b[1] + 44);
  const [px2, py2] = pt(Math.min(k, 0.999)), [qx, qy] = pt(Math.min(k + 0.01, 1)); drawPlane(g, { x: px2, y: py2 - 6, s: 0.14, tilt: Math.atan2(qy - py2, qx - px2), t });
  g.restore();
}
// ---------------------------------------------------------------- Hoofdstuk 2
SCENES.ch2_intro = [
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.008, 640, 420); nlBg(g, t, -160 + t * 28, 'day');
    for (let i = 0; i < 3; i++) { const dir = i % 2 ? -1 : 1, x = dir > 0 ? ((t * 130 + i * 520) % 1700) - 250 : 1500 - ((t * 110 + i * 600) % 1700); bike(g, x, 586 + i * 4, 1.15 - i * 0.05, t + i, ['#d03a2a', '#3a6ad0', '#e0a020'][i], ['#3a6ad0', '#d03a2a', '#4aa070'][i], dir); }
    drawPlane(g, { x: ((t * 40) % 1600) - 150, y: 110, s: 0.16, tilt: -0.06, t });
    g.strokeStyle = '#2a2f3a'; g.lineWidth = 2; for (let i = 0; i < 5; i++) { const x = ((t * 70 + i * 300) % 1500) - 100, y = 190 + i * 22 + Math.sin(t * 2 + i) * 10, f = Math.sin(t * 11 + i) * 6; g.beginPath(); g.moveTo(x - 9, y + f); g.quadraticCurveTo(x - 4, y - 6, x, y); g.quadraticCurveTo(x + 4, y - 6, x + 9, y + f); g.stroke(); }
    g.restore(); },
  (g, t, c) => { g.save(); const cam = t * 18; schipholBg(g, t, cam);
    for (let i = 0; i < 4; i++) { const x = 700 + i * 150 - t * 20; person(g, x, 540 + (i % 2) * 8, 1.7, ['#c84a4a', '#4a8ac8', '#6aa84a', '#c8a02a'][i], t, { walk: t * 5 + i, face: -1, hat: i % 2 ? '#e8e2d0' : null }); drawSuitcase(g, x - 26, 540 + (i % 2) * 8, 0.9, ['#3a6a9a', '#9a3a3a', '#4a8a4a', '#8a6a2a'][i]); }
    drawPlane(g, { x: 1000 - t * 28, y: 150 + t * 6, s: 0.2, tilt: 0.03, t });
    const x = 120 + t * 70, ph = prog(t, 4.2, 5.4); const st = t < 4.2 ? 'walk' : 'stand';
    teun(g, { x: Math.min(x, 120 + 4.2 * 70), y: 560, s: 2.9, face: 1, pose: st, walk: t * 7, t, outfit: 'classic' }); const sx = Math.min(x, 120 + 4.2 * 70) + 42 * 2.9 * 0.6; drawSuitcase(g, sx + 20, 560 - Math.abs(Math.sin(t * 7)) * 3, 1.6); void ph;
    g.restore(); },
];
SCENES.ch2_end = [
  (g, t, c) => { g.save(); const cam = t * 10; townBg(g, t, cam, 'plain', { lamps: false }); restaurantFront(g, t, 560 - cam, 545);
    glow(g, 560 - cam, 540, 400, 'rgba(255,170,70,1)', 0.18);
    const x = 560 - cam + Math.min(t * 62, 360); teun(g, { x, y: 560, s: 2.6, face: 1, pose: 'walk', walk: t * 6, t, outfit: 'classic', sack: true }); boxBami(g, x + 32 * 2.6 * 0.6 + 14, 560 - 38 * 2.6 * 0.6 + 2, 1.2, t);
    for (let i = 0; i < 3; i++) { const ph = (t * 0.6 + i / 3) % 1; sparkle(g, x + 70 + i * 22, 440 - ph * 80, 8 * (1 - ph), 1 - ph); }
    g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.012, 640, 420);
    g.drawImage(L('rest_in', W, H, (cc) => { cc.fillStyle = grad(cc, 0, 0, 0, H, [[0, '#4a0c14'], [1, '#2a0a10']]); cc.fillRect(0, 0, W, H); cc.fillStyle = 'rgba(232,184,64,.18)'; for (let x = 0; x < W; x += 80) for (let y = 0; y < 440; y += 80) { cc.beginPath(); cc.arc(x + 40, y + 40, 20, 0, TAU); cc.fill(); } cc.fillStyle = '#e8b840'; cc.fillRect(0, 434, W, 10); cc.fillStyle = grad(cc, 0, 444, 0, H, [[0, '#2a1810'], [1, '#100806']]); cc.fillRect(0, 444, W, H - 444); cc.fillStyle = '#8a1010'; rr(cc, 410, 40, 460, 240, 10); cc.fill(); cc.strokeStyle = '#e8b840'; cc.lineWidth = 8; cc.stroke(); cjk(cc, '龍', 640, 210, 190, '#e8b840'); }), 0, 0);
    for (const [x, ph] of [[180, 0], [380, 1], [900, 2], [1100, 3]]) lantern(g, x, 40 + (ph % 2) * 30, 1.1, t, ph);
    teun(g, { x: 640, y: 590, s: 3.5, face: 1, pose: t > 3.2 ? 'celebrate' : 'stand', t, outfit: 'classic', sack: false });
    // tafel
    g.fillStyle = grad(g, 0, 520, 0, 720, [[0, '#d8c8a0'], [1, '#8a6a3a']]); rr(g, 200, 520, 880, 30, 8); g.fill(); g.fillStyle = '#b01818'; g.fillRect(200, 548, 880, 100);
    boxBami(g, 790, 524, 2.2, t, true);
    // eetstokjes
    const hx = 640 + 40, hy = 478, cyc = (t * 0.55) % 1, up = t < 3.2 ? sstep(Math.sin(cyc * Math.PI)) : 0; const tx = lerp(770, 646, up), ty = lerp(490, 394, up);
    g.strokeStyle = '#6a3a1a'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx + 8, ty); g.moveTo(hx + 8, hy + 2); g.lineTo(tx + 12, ty + 6); g.stroke();
    g.strokeStyle = '#e8b050'; g.lineWidth = 5; g.beginPath(); g.moveTo(tx + 6, ty); g.quadraticCurveTo(tx + 8, ty + 26 + (1 - up) * 20, tx + 4, ty + 44 + (1 - up) * 20); g.stroke();
    for (let i = 0; i < 8; i++) { const a = t * 1.6 + i * TAU / 8, r2 = 150 + Math.sin(t * 3 + i) * 12; sparkle(g, 640 + Math.cos(a) * r2 * 1.2, 380 + Math.sin(a) * r2 * 0.7, 10 + 5 * Math.sin(t * 5 + i), 0.9); }
    for (let i = 0; i < 5; i++) { const ph = (t * 0.7 + i / 5) % 1; g.fillStyle = `rgba(255,255,255,${(1 - ph) * 0.25})`; g.beginPath(); g.arc(870 + Math.sin(ph * 5 + i) * 18, 450 - ph * 120, 12 + ph * 20, 0, TAU); g.fill(); }
    g.restore(); },
  (g, t, c) => { g.save(); mapScene(g, t);
    teun(g, { x: 170, y: 620, s: 3.2, face: 1, pose: t > 3.3 ? 'celebrate' : 'stand', t, outfit: 'classic', sack: true }); boxBami(g, 270, 540, 1.1, t, true);
    g.restore(); },
  (g, t, c) => { c.cue(0.5, 'plane'); g.save(); const cam = t * 12; schipholBg(g, t, -50);
    const k = Math.max(0, t - 1.8), x = -150 + t * 80 + k * k * 120, y = 498 - 24 * 1.3 - k * k * 46;
    drawPlane(g, { x, y, s: 1.3, tilt: -Math.min(0.3, k * 0.12), t }); void cam;
    g.restore(); },
];

// ---------------------------------------------------------------- Hoofdstuk 3
function pagodaPeople(g, t, n, seed, y0, y1, sMin, sMax) { const r = rng(seed); const cols = ['#c84a4a', '#4a8ac8', '#6aa84a', '#c8a02a', '#a84ac8', '#e8e2d0']; for (let i = 0; i < n; i++) { const dir = r() > 0.5 ? 1 : -1, sp = 20 + r() * 40, s = sMin + r() * (sMax - sMin), yy = y0 + r() * (y1 - y0), x = dir > 0 ? ((t * sp + r() * 1600) % 1500) - 100 : 1380 - ((t * sp + r() * 1600) % 1500); person(g, x, yy, s, cols[i % 6], t, { walk: t * (3 + sp / 14) + i, face: dir, hat: i % 3 === 0 ? '#d8c070' : null, hair: '#14100c' }); } }
SCENES.ch3_intro = [
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.01, 640, 400); chinaBg(g, t, -200 + t * 36, 'dusk'); fireworks(g, t, 4, 4);
    pagodaPeople(g, t, 12, 3, 540, 566, 1.5, 1.9);
    for (let i = 0; i < 2; i++) bike(g, ((t * 150 + i * 700) % 1700) - 200, 575, 1, t + i, '#2a6ad0', '#e0a020', 1);
    g.restore(); },
  (g, t, c) => { g.save(); const cam = t * 30; chinaBg(g, t, cam, 'dusk'); fireworks(g, t, 9, 3);
    pagodaPeople(g, t, 8, 11, 530, 550, 1.6, 1.9);
    const x = 300 + t * 28; teun(g, { x, y: 556, s: 3, face: 1, pose: 'walk', walk: t * 6, t, outfit: 'classic' }); drawSuitcase(g, x + 36, 556 - Math.abs(Math.sin(t * 6)) * 3, 1.6);
    pagodaPeople(g, t + 5, 4, 23, 568, 580, 2.1, 2.4);
    g.restore(); },
];
SCENES.l15_pre = [
  (g, t, c) => { g.save(); const cam = -240 + t * 44; zoomAt(g, 1 + t * 0.012, 700, 330); warehouseBg(g, t, cam);
    const tx = -300 + Math.min(t * 190, 760); truck(g, tx, 590, 1.2, t, { lights: true });
    for (const [x, d] of [[760, 1], [1000, -1]]) { const px2 = x + Math.sin(t * 0.7 + x) * 120; drawRobotChar(g, { x: px2 - cam * 0.5 * 0, y: 570, s: 1.5, face: Math.cos(t * 0.7 + x) > 0 ? 1 : -1, t, skin: 'blue', move: 1 }); void d; }
    g.restore(); },
  (g, t, c) => { g.save(); const cam = t * 26; warehouseIn(g, t, cam, { fg: 1 });
    for (const [x, y] of [[300, 276], [520, 198], [820, 354], [1000, 276], [1120, 198]]) { const k = Math.max(0, Math.sin(t * 2 + x)); sparkle(g, x, y, 10 + 14 * k, 0.4 + 0.6 * k); }
    drawRobotChar(g, { x: 900 + Math.sin(t * 0.8) * 90, y: 540, s: 1.2, face: Math.cos(t * 0.8) > 0 ? 1 : -1, t, skin: 'blue', move: 1 });
    teun(g, { x: 280, y: 560, s: 3.3, face: 1, pose: 'sneak', walk: Math.sin(t) * 0.4, t, outfit: 'black', mask: 1, gloves: 1 });
    g.restore(); },
  (g, t, c) => { g.save(); const cam = 0; warehouseIn(g, t, cam, { fg: 0 }); tint(g, 'rgba(0,10,30,.3)');
    const rx = 930, ang = Math.sin(t * 0.9) * 0.28; drawRobotChar(g, { x: rx, y: 540, s: 2.6, face: -1, t, skin: 'blue', move: 0 });
    g.save(); g.translate(rx - 30, 540 - 56 * 2.6 * 0.95); g.rotate(Math.PI + ang); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, 0, 0, 500, 0, [[0, 'rgba(255,60,60,.5)'], [1, 'rgba(255,60,60,0)']]); g.beginPath(); g.moveTo(0, 0); g.lineTo(520, -110); g.lineTo(520, 110); g.fill(); g.restore();
    const x = 150 + Math.min(1, (Math.sin(t * 1.2 - 1.2) * 0.5 + 0.5)) * 380 + t * 20; teun(g, { x, y: 570, s: 3, face: 1, pose: 'sneak', walk: t * 5, t, outfit: 'black', mask: 1, gloves: 1 });
    crate(g, 500, 600, 150, 120, '#c8a060'); crate(g, 640, 600, 110, 90, '#b88c4c');
    g.restore(); },
];
SCENES.ch3_end = [
  (g, t, c) => { g.save(); warehouseIn(g, t, 0, { fg: 0 });
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, 1160, 0, 700, 0, [[0, 'rgba(120,220,255,.65)'], [1, 'rgba(120,220,255,0)']]); g.beginPath(); g.moveTo(1150, 250); g.lineTo(1150, 560); g.lineTo(560, 640); g.lineTo(760, 480); g.fill(); g.restore(); g.fillStyle = '#bfefff'; g.fillRect(1140, 230, 140, 330); glow(g, 1210, 400, 260, 'rgba(160,230,255,1)', 0.55);
    const r = rng(2); g.fillStyle = 'rgba(255,255,255,.6)'; for (let i = 0; i < 30; i++) g.fillRect(760 + r() * 380 + Math.sin(t + i) * 8, 300 + ((r() * 300 + t * 14) % 260), 2, 2);
    const x = 220 + t * 74; teun(g, { x, y: 570, s: 3.2, face: 1, pose: 'walk', walk: t * 6, t, outfit: 'black', mask: 0.9, gloves: 1 });
    g.restore(); },
  (g, t, c) => { c.cue(0.2, 'siren'); g.save(); warehouseIn(g, t, 0, { fg: 0 }); const al = Math.floor(t * 4) % 2;
    g.save(); g.globalCompositeOperation = 'lighter'; const a = t * 3; g.translate(640, 60); g.rotate(a); g.fillStyle = grad(g, 0, 0, 800, 0, [[0, 'rgba(255,30,30,.5)'], [1, 'rgba(255,30,30,0)']]); g.beginPath(); g.moveTo(0, 0); g.lineTo(800, -100); g.lineTo(800, 100); g.fill(); g.restore();
    glow(g, 640, 60, 120, 'rgba(255,40,40,1)', al ? 1 : 0.4); g.fillStyle = al ? '#ff3030' : '#601010'; g.beginPath(); g.arc(640, 60, 18, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(1060, 220, 220, 340); glow(g, 1170, 400, 280, 'rgba(255,255,255,1)', 0.5);
    const slide = sstep(prog(t, 0, 0.8)); for (const [x, y, d] of [[1100 + (1 - slide) * 200, 560, 0], [1010 + (1 - slide) * 260, 575, 1]]) drawRobotChar(g, { x, y, s: 3.2, face: -1, t: t + d, skin: 'blue', alert: true, big: true });
    teun(g, { x: 300, y: 570, s: 3.1, face: 1, pose: 'scared', t, outfit: 'black', mask: 1, gloves: 1 });
    tint(g, `rgba(255,0,0,${al ? 0.12 : 0.02})`);
    g.restore(); },
  (g, t, c) => { g.save(); shake(g, t, 2.5, 50); warehouseIn(g, t, 0, { fg: 0 }); tint(g, 'rgba(120,0,0,.45)'); const al = Math.floor(t * 5) % 2; glow(g, 640, 360, 800, 'rgba(255,30,30,1)', al ? 0.35 : 0.1);
    const k = sstep(prog(t, 0, 1.4));
    for (const d of [-1, 1]) { g.save(); g.translate(640 + d * (700 - k * 340), 470); g.scale(d * -1, 1); g.fillStyle = grad(g, 0, -60, 0, 60, [[0, '#9aa0a8'], [1, '#3a3e46']]); rr(g, 0, -34, 520, 68, 20); g.fill(); g.fillStyle = '#2a2d33'; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-10, -26 + i * 26); g.lineTo(-70, -34 + i * 36); g.lineTo(-30, -10 + i * 26); g.fill(); } g.fillStyle = '#ff2a2a'; g.beginPath(); g.arc(120, 0, 7, 0, TAU); g.fill(); g.restore(); }
    teun(g, { x: 640, y: 640, s: 5, face: 1, pose: 'scared', t, outfit: 'black', mask: 1, gloves: 1, sack: true });
    for (let i = 0; i < 4; i++) { const ph = (t * 1.1 + i / 4) % 1; g.fillStyle = `rgba(160,220,255,${1 - ph})`; g.beginPath(); g.ellipse(700 + i * 12, 290 + ph * 120, 5, 9, 0, 0, TAU); g.fill(); }
    g.restore(); },
  (g, t, c) => { c.cue(3.4, 'step'); g.save(); const cam = 0; townBg(g, t, cam, 'plain', { lamps: true });
    const vx = t < 3.6 ? 860 : 860 + (t - 3.6) * (t - 3.6) * 260; van(g, vx, 570, 1.5, t * (t < 3.6 ? 0 : 1), { lights: true, door: t < 3.6 ? 1 : 0 });
    const k = prog(t, 0, 3.1), wx = lerp(80, 640, k), al = 1 - prog(t, 2.9, 3.4);
    if (al > 0) { drawRobotChar(g, { x: wx - 90, y: 568, s: 2.1, face: 1, t, skin: 'blue', alert: true, move: 1, alpha: al }); teun(g, { x: wx, y: 568, s: 2.4, face: 1, pose: 'scared', t, outfit: 'black', mask: 1, gloves: 1, alpha: al }); drawRobotChar(g, { x: wx + 90, y: 575, s: 2.1, face: 1, t, skin: 'blue', alert: true, move: 1, alpha: al }); }
    if (t > 3.6) dust(g, t, vx - 190, 575, 6, 2.5);
    g.restore(); },
];

// ---------------------------------------------------------------- Hoofdstuk 4
function fogWisps(g, t, a = 0.08, y0 = 480, y1 = 620) { const r = rng(7); for (let i = 0; i < 9; i++) { const x = ((r() * 1600 + t * (10 + r() * 14)) % 1600) - 160, y = y0 + r() * (y1 - y0); g.fillStyle = `rgba(200,210,240,${a})`; g.beginPath(); g.ellipse(x, y, 180 + r() * 120, 22 + r() * 16, 0, 0, TAU); g.fill(); } }
function cctv(g, x, y, w, h, t) {
  g.save(); g.fillStyle = '#0a0c10'; rr(g, x - 14, y - 14, w + 28, h + 28, 12); g.fill(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = '#0e2a1e'; g.fillRect(x, y, w, h); g.save(); g.translate(x, y); g.scale(w / 400, h / 260); g.fillStyle = '#1a4a36'; for (let i = 0; i < 4; i++) { g.fillRect(20 + i * 100, 80 + (i % 2) * 20, 80, 110 - (i % 2) * 20); g.fillStyle = '#245a42'; g.fillRect(24 + i * 100, 84 + (i % 2) * 20, 72, 8); g.fillStyle = '#1a4a36'; }
  g.fillStyle = '#143a2a'; g.fillRect(0, 190, 400, 70); const tx = ((t * 40) % 480) - 40; drawTeUn(g, { x: tx, y: 232, s: 1.5, pose: 'sneak', walk: t * 6, t, outfit: 'black', mask: 1, gloves: 1 }); g.restore();
  g.fillStyle = 'rgba(0,0,0,.18)'; for (let yy = y; yy < y + h; yy += 4) g.fillRect(x, yy, w, 2); g.fillStyle = `rgba(120,255,180,${0.05 + 0.04 * Math.sin(t * 40)})`; g.fillRect(x, y, w, h); g.restore();
  g.fillStyle = Math.floor(t * 2) % 2 ? '#ff2a2a' : '#5a1010'; g.beginPath(); g.arc(x + 24, y + 24, 8, 0, TAU); g.fill(); txt(g, 'REC', x + 42, y + 31, 20, '#ff6a6a', 'left', 700); txt(g, 'MAGAZIJN 15', x + w - 12, y + h - 12, 18, '#9affc0', 'right', 600);
}
SCENES.ch4_intro = [
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.035, 975 - 150, 140 + t * 4); cityNight(g, t, -60 + t * 10);
    const hx = 1500 - t * 110, hy = 200 + Math.sin(t * 1.5) * 12; g.fillStyle = '#0a0c14'; g.beginPath(); g.ellipse(hx, hy, 30, 12, 0, 0, TAU); g.fill(); g.fillRect(hx - 44, hy - 3, 40, 5); g.fillRect(hx - 6, hy - 22, 3, 10); g.save(); g.translate(hx, hy - 20); g.rotate(t * 30); g.fillRect(-46, -1.5, 92, 3); g.restore(); beam(g, hx, hy + 8, 1.9, 520, 10, 150, 'rgba(255,250,210,A)', 0.2);
    for (const [x, ph] of [[300, 0], [1000, 2]]) beam(g, x, 700, -Math.PI / 2 + Math.sin(t * 0.6 + ph) * 0.5, 760, 20, 120, 'rgba(255,255,255,A)', 0.12);
    g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.022, 640, 330); officeBg(g, t, t * 6);
    for (const x of [250, 1030]) drawRobotChar(g, { x, y: 560, s: 2.3, face: x < 640 ? 1 : -1, t, skin: 'blue' });
    drawNico(g, { x: 640, y: 650, s: 3.7, face: 1, t, pose: 'talk' }); deskFront(g, 360, 520, 560); deskProps(g, 400, 520, t);
    const k = sstep(prog(t, 0.6, 1.4)); g.save(); g.globalAlpha = k; for (let i = 0; i < 3; i++) { const ph = t * 0.8 + i * 0.7; cjk(g, ['這', '是', '誰'][i], 740 + i * 66, 290 - Math.sin(ph * 2) * 8 - (i === 1 ? 14 : 0), 52, '#ffe27a'); } g.restore();
    g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1.14 - t * 0.014, 640, 400); officeBg(g, t, 0);
    drawNico(g, { x: 900, y: 600, s: 2.7, face: -1, t, pose: 'talk' }); deskFront(g, 700, 490, 400); deskProps(g, 740, 490, t);
    drawRobotChar(g, { x: 200, y: 580, s: 2.4, face: 1, t, skin: 'blue' }); teun(g, { x: 370, y: 585, s: 2.6, face: 1, pose: 'stand', t, outfit: 'black', mask: 0, gloves: 1 }); drawRobotChar(g, { x: 520, y: 590, s: 2.4, face: -1, t, skin: 'blue' });
    qmark(g, 900, 250, t, 0); qmark(g, 380, 270, t, 1.5, '#ff8a5a', '!'); qmark(g, 560, 320, t, 3, '#ffe27a', '?');
    g.restore(); },
  (g, t, c) => { g.save(); officeBg(g, t, 0); cctv(g, 700, 100, 440, 280, t);
    drawNico(g, { x: 1090, y: 610, s: 2.4, face: -1, t, pose: 'stand' }); deskFront(g, 880, 510, 380);
    drawRobotChar(g, { x: 330, y: 575, s: 3.6, face: 1, t, skin: 'blue', alert: false, move: 1 }); const k = 0.5 + 0.5 * Math.sin(t * 4); glow(g, 330 + 24, 575 - 190, 40, '#7affc8', 0.3 * k);
    g.restore(); },
  (g, t, c) => { shakeWrap(g, t, c); },
];
function shakeWrap(g, t, c) {
  g.save(); if (t > 2) shake(g, t, 3, 45); officeBg(g, t, 0); drawNico(g, { x: 930, y: 590, s: 2.6, face: -1, t, pose: 'point' }); deskFront(g, 740, 500, 380);
  const rx = 520 + Math.min(t * 90, 400) + Math.sin(t * 9) * 4; const tx = 330 + sstep(prog(t, 0.8, 3.6)) * 650;
  drawRobotChar(g, { x: 260 + sstep(prog(t, 0.2, 3.8)) * 520, y: 590, s: 2.6, face: 1, t, skin: 'blue', alert: true, move: 1 }); drawRobotChar(g, { x: 150 + sstep(prog(t, 0.3, 4)) * 520, y: 596, s: 2.6, face: 1, t, skin: 'blue', alert: true, move: 1 });
  dust(g, t, tx - 30, 585, 5, 1.5); teun(g, { x: tx, y: 590, s: 2.9, face: 1, pose: t < 0.8 ? 'stand' : 'run', walk: t * 14, t, outfit: 'black', mask: 0, gloves: 1 }); void rx;
  qmark(g, 930, 220, t, 0, '#ff5a3a', '!'); g.restore();
}
SCENES.l17_end = [
  (g, t, c) => { c.cue(1.4, 'siren'); g.save(); const cam = t * 6; townBg(g, t, cam, 'suburb'); const mx = px(0.5, cam), dx = 520 + 110 * 1.1 + mx;
    const k = prog(t, 0.2, 3), x = dx + k * 380; glow(g, dx, 520, 90, 'rgba(255,210,120,1)', 0.5 * (1 - k));
    teun(g, { x, y: 548 + k * 16, s: 2.2 + k * 0.5, face: 1, pose: t < 3 ? 'sneak' : 'stand', walk: t * 6, t, outfit: 'black', mask: 1, gloves: 1 }); bills(g, t, x - 20, 440, 6, 8);
    const cx = 1700 - sstep(prog(t, 1.2, 3.8)) * 800; policeCar(g, cx, 600, 1.3, t, { face: -1 }); beam(g, cx - 150, 560, Math.PI + 0.05, 560, 24, 170, 'rgba(255,245,200,A)', 0.3); if (t > 1.2) sirenTint(g, t, 0.22);
    g.restore(); },
  (g, t, c) => { g.save(); const cam = 160; zoomAt(g, 1 + t * 0.014, 700, 420); townBg(g, t, cam, 'suburb'); policeCar(g, 360, 560, 1.15, t, { face: 1 }); beam(g, 500, 520, 0, 700, 24, 190, 'rgba(255,245,200,A)', 0.35);
    teun(g, { x: 1090, y: 570, s: 3, face: -1, pose: 'scared', t, outfit: 'black', mask: 1, gloves: 1 }); drawCop(g, { x: 760, y: 575, s: 3.2, face: 1, t }); drawCop(g, { x: 620, y: 590, s: 3, face: 1, t: t + 1 });
    for (let i = 0; i < 2; i++) qmark(g, 700 + i * 140, 230 + i * 30, t, i, '#7ab0ff', '!'); sirenTint(g, t, 0.24); g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1.08 - t * 0.012, 640, 360); cellBg(g, t, 0);
    const mx = ((t * 40) % 1500) - 100; g.fillStyle = '#6a6460'; g.beginPath(); g.ellipse(1250 - mx, 548, 14, 7, 0, 0, TAU); g.fill(); g.strokeStyle = '#6a6460'; g.lineWidth = 2; g.beginPath(); g.moveTo(1264 - mx, 548); g.quadraticCurveTo(1280 - mx, 540, 1290 - mx, 548); g.stroke();
    teun(g, { x: 620, y: 548, s: 3.1, face: 1, pose: 'sad', t, outfit: 'classic', sack: false }); cellBars(g, t); void mx;
    g.restore(); },
];
SCENES.l18_end = [
  (g, t, c) => { g.save(); const cam = -t * 5; zoomAt(g, 1.1 - t * 0.012, 640, 400); townBg(g, t, cam, 'police'); const mx = px(0.5, cam), dx = 520 + 380 + mx;
    for (const x of [520 + 215 + mx, 520 + 545 + mx]) { const ph = Math.floor(t * 4) % 2; glow(g, x, 410, 90, ph ? 'rgba(60,120,255,1)' : 'rgba(60,120,255,.3)', 0.9); }
    const k = prog(t, 0.3, 1.8), x = dx + sstep(k) * 240 - 60; glow(g, dx, 470, 120, 'rgba(255,255,255,1)', 0.4 * (1 - k));
    teun(g, { x: Math.max(x, dx), y: 548 + k * 10, s: 2.2 + k * 0.7, face: 1, pose: k < 1 ? 'run' : 'celebrate', walk: t * 14, t, outfit: 'classic', sack: false });
    for (let i = 0; i < 12; i++) { const ph = (t * 0.7 + i / 12) % 1; sparkle(g, 650 + Math.sin(i * 3.1) * 260, 200 + ph * 260, 8, 1 - ph, '#fff6b0'); }
    g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.012, 900, 380); townBg(g, t, 0, 'plain'); fogWisps(g, t, 0.07);
    beam(g, 1360, 520, Math.PI, 900, 60, 260, 'rgba(255,245,200,A)', 0.35); beam(g, 1360, 590, Math.PI, 900, 60, 260, 'rgba(255,245,200,A)', 0.3);
    drawRobotChar(g, { x: 1080, y: 590, s: 2.6, face: -1, t, skin: 'blue' }); drawRobotChar(g, { x: 760, y: 590, s: 2.6, face: -1, t, skin: 'blue' });
    drawNico(g, { x: 920, y: 570, s: 3.2, face: -1, t, pose: 'talk' });
    teun(g, { x: 330, y: 570, s: 3, face: 1, pose: t < 1.2 ? 'stand' : 'scared', t, outfit: 'classic', sack: false }); qmark(g, 330, 220, t, 0, '#ff8a5a', '!');
    g.restore(); },
  (g, t, c) => { g.save(); const cam = t * 4; townBg(g, t, cam, 'atelier'); const mx = px(0.5, cam), doorX = 560 + 250 + mx;
    const k = prog(t, 0, 4.2), x = lerp(-80, doorX - 40, sstep(k)), al = 1 - prog(t, 4, 4.8), open = sstep(prog(t, 3.6, 4.4));
    glow(g, doorX, 520, 200, 'rgba(255,230,150,1)', 0.5 * open); g.save(); g.globalAlpha = open; g.fillStyle = '#d8d090'; g.fillRect(doorX - 20, 440, 40, 90); g.restore();
    if (al > 0) { drawRobotChar(g, { x: x - 120, y: 572, s: 2.2, face: 1, t, skin: 'blue', alert: true, move: 1, alpha: al }); teun(g, { x: x - 40, y: 570, s: 2.4, face: 1, pose: 'sad', walk: t * 5, t, outfit: 'classic', sack: false, alpha: al }); drawRobotChar(g, { x: x + 40, y: 576, s: 2.2, face: 1, t, skin: 'blue', alert: true, move: 1, alpha: al }); drawNico(g, { x: x + 130, y: 570, s: 2.5, face: 1, t, pose: 'talk', alpha: al }); }
    fogWisps(g, t, 0.05, 520, 640); g.restore(); },
];
SCENES.l19_end = [
  (g, t, c) => { g.save(); zoomAt(g, 1 + t * 0.016, 640, 360); atelierIn(g, t, 0);
    mannequin(g, 140, 560, 2.2, '#d8cfa8', Math.sin(t * 0.7) * 0.03); mannequin(g, 420, 580, 2.6, '#d0c8a0', -0.05 + Math.sin(t * 0.5) * 0.03); mannequin(g, 990, 560, 2.3, '#d8cfa8', 0.08); mannequin(g, 1160, 580, 2.6, '#c8c098', Math.sin(t * 0.6) * 0.03);
    sewMachine(g, 850, 520, 1.8, t); teun(g, { x: 640, y: 575, s: 3.2, face: 1, pose: t < 2 ? 'sad' : 'stand', t, outfit: 'black', mask: 0, gloves: 1 });
    if (t > 2.2) { const k = sstep(prog(t, 2.2, 2.7)); g.save(); g.globalAlpha = k; glow(g, 640, 250, 130, 'rgba(255,230,120,1)', 0.9); g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(640, 252, 30, 0, TAU); g.fill(); g.fillStyle = '#c8a020'; g.fillRect(630, 278, 20, 14); g.strokeStyle = '#ffe27a'; g.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i * TAU / 8; g.beginPath(); g.moveTo(640 + Math.cos(a) * 44, 252 + Math.sin(a) * 44); g.lineTo(640 + Math.cos(a) * 62, 252 + Math.sin(a) * 62); g.stroke(); } g.restore(); }
    g.restore(); },
  (g, t, c) => { g.save(); const z = 1 + t * 0.03; zoomAt(g, z, 820, 360); bankBg(g, t, -t * 8);
    g.fillStyle = '#05070e'; g.beginPath(); g.moveTo(0, H); g.lineTo(0, 560); g.lineTo(330, 560); g.quadraticCurveTo(380, 560, 400, 600); g.lineTo(440, H); g.fill(); g.fillRect(0, 556, 340, 8);
    teun(g, { x: 190, y: 560, s: 3.2, face: 1, pose: 'sneak', walk: Math.sin(t * 0.8) * 0.5, t, outfit: 'black', mask: 1, gloves: 1 });
    for (let i = 0; i < 9; i++) { const k = Math.max(0, Math.sin(t * 2.2 + i * 1.3)); sparkle(g, 640 + i * 70 - t * 8, 400 + (i % 3) * 50, 7 + 11 * k, 0.3 + 0.7 * k, '#ffe27a'); }
    g.restore(); },
];
// ---------------------------------------------------------------- Hoofdstuk 4: einde (vliegtuig)
SCENES.ch4_end = [
  (g, t, c) => { c.cue(0.3, 'step'); g.save(); airportBg(g, t, 0, 'day'); tint(g, 'rgba(255,130,50,.26)'); drawPlane(g, { x: 860, y: 490, s: 1.55, t });
    // trap
    g.fillStyle = '#8a929c'; g.beginPath(); g.moveTo(400, 560); g.lineTo(560, 470); g.lineTo(580, 470); g.lineTo(420, 560); g.fill(); g.strokeStyle = '#4a525c'; g.lineWidth = 4; g.beginPath(); g.moveTo(400, 546); g.lineTo(560, 456); g.moveTo(420, 546); g.lineTo(580, 456); g.stroke(); g.fillStyle = '#d8dee4'; g.fillRect(560, 440, 56, 36); g.fillStyle = '#0d1226'; g.fillRect(578, 396, 38, 44);
    g.fillStyle = '#243c78'; g.fillRect(618, 390, 50, 50); g.fillStyle = '#e8e2d0'; g.fillRect(620, 392, 46, 46);
    const k = prog(t, 0.2, 5.2), x = lerp(260, 560, sstep(k)), y = lerp(572, 470, sstep(k)); teun(g, { x, y, s: 2.6 - k * 0.2, face: 1, pose: 'walk', walk: t * 4.5, t, outfit: 'classic', sack: true });
    g.save(); g.translate(x + 38, y - 30); drawMoneyBag(g, 0, 0, 1.6); g.restore(); g.save(); drawMoneyBag(g, x - 80 + Math.sin(t) * 0, y + 20, 1.5); g.restore();
    g.restore(); },
  (g, t, c) => { c.cue(2.6, 'boom'); g.save(); const sk = Math.max(0, t - 2.4) * 0.8; cabinBg(g, t, { sky: 'day', shake: 0.6 + sk * 2 });
    for (let i = 0; i < 5; i++) { const x = 150 + i * 240; if (i === 2) continue; person(g, x, 600, 2.1, ['#c84a4a', '#4a8ac8', '#6aa84a', '#c8a02a', '#a84ac8'][i], t, { hair: i % 2 ? '#e8d8b0' : '#2a1c14' }); seatBack(g, x, 700, 1.7, '#2a4a8a'); }
    teun(g, { x: 640 + Math.sin(t * 30) * sk * 2, y: 640, s: 2.9, face: 1, pose: 'stand', t, outfit: 'classic', sack: false }); seatBack(g, 640, 740, 1.9, '#2a4a8a'); drawMoneyBag(g, 880, 640, 2.2);
    if (t > 1.8) qmark(g, 640, 300, t, 0, '#ffe27a', '?'); const fl = Math.sin(t * 17) > 0.7 && t > 2.4 ? 0.3 : 0; tint(g, `rgba(0,0,0,${fl})`);
    g.restore(); },
  (g, t, c) => { c.cue(0.1, 'plane'); g.save(); zoomAt(g, 1 + t * 0.03, 560, 380); flightSky(g, t, 'dusk', 1.4); const k = 0.5 + 0.5 * Math.sin(t * 1.3);
    drawPlane(g, { x: 640, y: 380 + Math.sin(t * 2) * 8, s: 2.1, tilt: 0.05 + Math.max(0, t - 2.5) * 0.06, t, smoke: t > 0.8, fire: t > 3.6 }); if (t > 2.4 && t < 3) glow(g, 600, 440, 260, 'rgba(255,170,60,1)', (1 - prog(t, 2.4, 3)) * 0.8); void k;
    g.restore(); },
  (g, t, c) => { c.cue(2.3, 'crash'); c.cue(2.4, 'boom'); g.save(); const sh = t > 2.3 ? (1 - prog(t, 2.3, 3.2)) * 10 : t * 1.2; shake(g, t, sh, 55); islandBg(g, t, 0, 'dusk');
    const k = Math.min(t / 2.3, 1), x = lerp(180, 880, k), y = lerp(80, 520, k * k); if (t < 2.4) drawPlane(g, { x, y, s: 1.4 - k * 0.2, tilt: 0.12 + k * 0.5, t, smoke: true, fire: true });
    if (t > 2.3) { const q = prog(t, 2.3, 3.6); glow(g, 900, 500, 500 * (0.4 + q), 'rgba(255,170,50,1)', (1 - q) * 1.2); for (let i = 0; i < 16; i++) { const a = i * TAU / 16, d = q * (150 + (i % 4) * 60); g.fillStyle = i % 2 ? '#ffb02a' : '#ff5a1a'; g.globalAlpha = 1 - q; g.beginPath(); g.arc(900 + Math.cos(a) * d, 500 + Math.sin(a) * d * 0.6 - q * 40, 30 * (1 - q * 0.5), 0, TAU); g.fill(); } g.globalAlpha = 1; for (let i = 0; i < 4; i++) smokeAt(g, 900 + i * 14, 500, t + i, i, '40,40,44', 280); if (t > 2.5) { tint(g, `rgba(255,255,255,${(1 - prog(t, 2.3, 2.7)) * 0.7})`); } }
    g.restore(); tint(g, `rgba(0,0,0,${prog(t, 2.9, 3.6)})`); },
];
// ---------------------------------------------------------------- Hoofdstuk 5
SCENES.ch5_intro = [
  (g, t, c) => { g.save(); zoomAt(g, 1.06 - t * 0.008, 640, 420); islandBg(g, t, 0, 'dusk');
    wreckPiece(g, 330, 560, 2.1, t, { smoke: true, rot: -0.05 }); wreckPiece(g, 1010, 600, 1.6, t, { face: -1, rot: 0.1, smoke: true, seed: 3 });
    drawSuitcase(g, 760, 600, 1.8, '#9a3a3a'); drawSuitcase(g, 560, 610, 1.4, '#3a6a9a');
    for (let i = 0; i < 3; i++) { const gx = ((t * 40 + i * 400) % 1500) - 100; g.strokeStyle = '#fff'; g.lineWidth = 2.5; const f = Math.sin(t * 9 + i) * 6; g.beginPath(); g.moveTo(gx - 12, 170 + i * 30 + f); g.quadraticCurveTo(gx - 5, 160 + i * 30, gx, 170 + i * 30); g.quadraticCurveTo(gx + 5, 160 + i * 30, gx + 12, 170 + i * 30 + f); g.stroke(); }
    const k = sstep(prog(t, 1.2, 3.2)); g.save(); g.translate(660, 585); g.rotate(-Math.PI / 2 * (1 - k)); g.translate(-660, -585); drawTeUn(g, { x: 660, y: 585, s: 3, face: 1, pose: k < 1 ? 'stand' : 'sad', t, outfit: 'classic', sack: true }); g.restore();
    tint(g, `rgba(0,0,0,${1 - prog(t, 0, 1.4)})`);
    g.restore(); },
  (g, t, c) => { g.save(); const cam = -300 + t * 90; islandBg(g, t, cam, 'dusk'); const nx = px(1, cam);
    const bagsX = [380, 760, 1130]; const x = 150 + t * 130 * (t < 4 ? 1 : 0.2), xx = Math.min(x, 1090);
    bagsX.forEach((bx, i) => { const got = xx > bx - 20; const a = got ? Math.max(0, 1 - (xx - bx + 20) / 40) : 1; if (a > 0) { g.save(); g.globalAlpha = a; drawMoneyBag(g, bx + nx + 260, 590 + Math.sin(t * 3 + i) * 0, 1.7); g.restore(); const k = Math.max(0, Math.sin(t * 3 + i)); sparkle(g, bx + nx + 260 + 14, 560, 6 + 12 * k, k * a); } });
    wreckPiece(g, 600 + nx + 260, 570, 1.5, t, { smoke: true, rot: 0.04 });
    teun(g, { x: xx - nx * 0 + 0, y: 590, s: 3, face: 1, pose: xx > 1080 && t > 5 ? 'celebrate' : 'walk', walk: t * 8, t, outfit: 'classic', sack: true });
    g.restore(); },
  (g, t, c) => { g.save(); zoomAt(g, 1.1 - t * 0.016, 560, 420); islandBg(g, t, 0, 'dusk');
    const sx = 980 - t * 4, sy = 456 + Math.sin(t * 1.4) * 3; g.save(); g.translate(sx, sy); g.rotate(Math.sin(t * 1.4) * 0.03); g.fillStyle = '#1a1020'; g.beginPath(); g.moveTo(-60, 0); g.lineTo(60, 0); g.lineTo(44, 20); g.lineTo(-48, 20); g.fill(); g.fillRect(-2, -60, 4, 60); g.fillStyle = '#2a1830'; g.beginPath(); g.moveTo(4, -56); g.quadraticCurveTo(46, -34, 40, -6); g.lineTo(4, -6); g.fill(); g.beginPath(); g.moveTo(-4, -50); g.quadraticCurveTo(-34, -30, -30, -6); g.lineTo(-4, -6); g.fill(); g.restore();
    const x = 420 + Math.max(0, t - 3.2) * 60; teun(g, { x, y: 586, s: 3, face: 1, pose: t > 3.2 ? 'walk' : 'stand', walk: t * 6, t, outfit: 'classic', sack: true });
    for (let i = 0; i < 5; i++) { const ph = (t * 0.5 + i / 5) % 1; sparkle(g, 700 + Math.sin(i * 5) * 200, 470 + ph * 30, 5, (1 - ph) * 0.8, '#ffe0a0'); }
    g.restore(); },
];
// ---------------------------------------------------------------- Einde: standbeeld
function goldStatue() {
  return { base: L('gold_a', 360, 420, (c) => { const tmp = mkc(360, 420), tg = tmp.getContext('2d'); drawTeUn(tg, { x: 180, y: 400, s: 4.2, face: 1, pose: 'celebrate', t: 0.1, outfit: 'classic', sack: false }); c.drawImage(tmp, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = grad(c, 40, 20, 320, 420, [[0, '#fff2a0'], [0.3, '#f0c030'], [0.6, '#b8860b'], [1, '#ffe27a']]); c.fillRect(0, 0, 360, 420); c.globalCompositeOperation = 'source-atop'; c.globalAlpha = 0.32; c.drawImage(tmp, 0, 0); c.globalAlpha = 0.25; c.globalCompositeOperation = 'source-atop'; c.fillStyle = grad(c, 0, 0, 360, 0, [[0, 'rgba(255,255,255,.9)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(90,50,0,.8)']]); c.fillRect(0, 0, 360, 420); }),
    mask: L('gold_m', 360, 420, (c) => { const tmp = mkc(360, 420), tg = tmp.getContext('2d'); drawTeUn(tg, { x: 180, y: 400, s: 4.2, face: 1, pose: 'celebrate', t: 0.1, outfit: 'classic', sack: false }); c.drawImage(tmp, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, 360, 420); }) };
}
function confetti(g, t, n = 90, seed = 1, a = 1) { const r = rng(seed); const cols = ['#ff5a5a', '#ffd23a', '#4ad0ff', '#7aff7a', '#ff7ae8', '#fff']; for (let i = 0; i < n; i++) { const sp = 90 + r() * 140, x0 = r() * W, ph = r() * 9, y = ((r() * (H + 100) + t * sp) % (H + 100)) - 50, x = x0 + Math.sin(t * 2 + ph) * 30; g.save(); g.translate(x, y); g.rotate(t * 4 + ph); g.scale(1, Math.sin(t * 6 + ph)); g.globalAlpha = a; g.fillStyle = cols[i % 6]; g.fillRect(-5, -3, 10, 6); g.restore(); } }
function bunting(g, t, y0, y1) { g.strokeStyle = '#4a3a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(-20, y0); g.quadraticCurveTo(W / 2, y1, W + 20, y0); g.stroke(); const cols = ['#ff5a5a', '#ffd23a', '#4ad0ff', '#7aff7a', '#ff7ae8']; for (let i = 0; i < 18; i++) { const u = (i + 0.5) / 18, x = lerp(-20, W + 20, u), y = (1 - u) * (1 - u) * y0 + 2 * u * (1 - u) * y1 + u * u * y0 + 2 * u * (1 - u) * 0; const yy = y0 + (y1 - y0) * 2 * u * (1 - u) * 1; g.fillStyle = cols[i % 5]; g.beginPath(); g.moveTo(x - 14, yy); g.lineTo(x + 14, yy); g.lineTo(x + Math.sin(t * 3 + i) * 4, yy + 34); g.fill(); } }
SCENES.final = [
  (g, t, c) => { g.save(); const cam = -t * 14; villageBg(g, t, cam, 'morning'); bunting(g, 90, 150, t);
    const gx = [820, 930, 1040, 1150, 1260]; gx.forEach((x, i) => { const alert = t > 1.6 + i * 0.25; gnome(g, { x: x - Math.min(t * 0, 0), y: 560 + (i % 2) * 8, s: 2.2, face: -1, walk: 0, t: t + i, hat: HATS[i % 5], coat: COATS[i % 5], angry: false, tool: 'none' }); if (alert) qmark(g, x - 10, 330 - (i % 2) * 20 - Math.abs(Math.sin(t * 5 + i)) * 10, t, i, '#ffe27a', '!'); });
    const x = -80 + t * 92; teun(g, { x, y: 570, s: 3, face: 1, pose: 'walk', walk: t * 6.5, t, outfit: 'classic', sack: true }); g.save(); drawMoneyBag(g, x + 44, 570 - 36 - Math.abs(Math.sin(t * 6.5)) * 3, 1.5); g.restore();
    g.restore(); },
  (g, t, c) => { g.save(); villageBg(g, t, 40, 'morning'); const gx = [800, 920, 1040, 1160, 1260];
    teun(g, { x: 330, y: 570, s: 3.2, face: 1, pose: 'stand', t, outfit: 'classic', sack: false });
    gx.forEach((x, i) => { const th = i * 0.7 + 0.4, k = prog(t, th, th + 0.9); const got = k >= 1; gnome(g, { x, y: 562 + (i % 2) * 8, s: 2.2, face: -1, walk: 0, t: t + i, hat: HATS[(i + 2) % 5], coat: COATS[i % 5], angry: false, tool: 'none' });
      if (k > 0 && !got) { const u = k, bx = lerp(380, x - 20, u), by = 470 - Math.sin(u * Math.PI) * 220; g.save(); g.translate(bx, by); g.rotate(u * 7); drawMoneyBag(g, 0, 0, 1.5); g.restore(); }
      if (got) { const q = Math.min(1, (t - th - 0.9) / 1.2); drawMoneyBag(g, x - 18, 574 + (i % 2) * 8, 1.5); sparkle(g, x + 10, 410 - q * 60, 10, 1 - q); sparkle(g, x - 24, 440 - q * 40, 7, 1 - q); txt(g, '+', x + 30, 370 - q * 50, 36, `rgba(255,226,122,${1 - q})`, 'center', 700); } });
    g.restore(); },
  (g, t, c) => { g.save(); villageBg(g, t, 0, 'morning'); bunting(g, 70, 140, t);
    for (let i = 0; i < 9; i++) { const x = 120 + i * 130 + (i % 2) * 20, jy = Math.abs(Math.sin(t * 5.5 + i * 0.9)) * 46; if (i === 4) continue; gnome(g, { x, y: 570 - jy + (i % 2) * 6, s: 2.2 + (i % 3) * 0.15, face: i % 2 ? -1 : 1, walk: 0, t: t * 2 + i, hat: HATS[i % 5], coat: COATS[(i + 1) % 5], angry: false, tool: 'none' }); }
    teun(g, { x: 640, y: 570, s: 3.4, face: 1, pose: 'celebrate', t, outfit: 'classic', sack: false });
    for (let i = 0; i < 6; i++) { const ph = (t * 0.8 + i * 0.37) % 1.2, x = 200 + i * 160; if (ph < 1) { g.fillStyle = HATS[i % 5]; g.save(); g.translate(x + Math.sin(i) * 30, 360 - ph * 220 + ph * ph * 200); g.rotate(ph * 5); g.beginPath(); g.moveTo(-12, 0); g.lineTo(0, -34); g.lineTo(12, 0); g.fill(); g.restore(); } }
    confetti(g, t, 120, 4); g.restore(); },
  (g, t, c) => { c.cue(2.2, 'chime'); g.save(); villageBg(g, t, 0, 'morning'); const rev = sstep(prog(t, 2.2, 3.4)); bunting(g, 70, 130, t);
    const sx = 640, sy = 560; g.fillStyle = grad(g, sx - 160, 0, sx + 160, 0, [[0, '#a8a8b0'], [0.5, '#e8e8f0'], [1, '#8a8a96']]); g.fillRect(sx - 160, sy - 90, 320, 90); g.fillStyle = '#d8c070'; g.fillRect(sx - 170, sy - 100, 340, 14); g.fillRect(sx - 170, sy - 8, 340, 8); rr(g, sx - 140, sy - 66, 280, 40, 6); g.fillStyle = '#2a2230'; g.fill(); txt(g, 'ULTRA GOUDEN TE-UN', sx, sy - 40, 22, '#ffe27a', 'center', 700);
    for (const [x, d] of [[330, 1], [470, 1], [810, -1], [950, -1], [190, 1], [1090, -1]]) gnome(g, { x, y: 566 + (x % 2) * 6, s: 2, face: d, walk: 0, t: t * 2 + x, hat: HATS[(x / 10 | 0) % 5], coat: COATS[(x / 7 | 0) % 5], angry: false, tool: 'none' });
    const gs = goldStatue(); const stY = sy - 100;
    if (rev > 0) { glow(g, sx, stY - 200, 420 * (0.5 + rev), 'rgba(255,230,120,1)', 0.5 * (1 - prog(t, 3.4, 5.5) * 0.4)); g.save(); g.translate(sx - 180, stY - 400); g.globalAlpha = rev; g.drawImage(gs.base, 0, 0);
      const bandX = ((t - 3) * 280) % 700 - 200, sw = mkc(360, 420), sg = sw.getContext('2d'); sg.drawImage(gs.mask, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = grad(sg, bandX, 0, bandX + 90, 100, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,.95)'], [1, 'rgba(255,255,255,0)']]); sg.fillRect(0, 0, 360, 420); g.globalCompositeOperation = 'lighter'; g.drawImage(sw, 0, 0); g.restore();
      for (let i = 0; i < 10; i++) { const k = Math.max(0, Math.sin(t * 3 + i * 1.7)); sparkle(g, sx - 120 + (i * 53) % 240, stY - 360 + (i * 71) % 330, 6 + 14 * k, rev * k); } }
    if (rev < 1) { const lift = rev * rev * 620, sway = Math.sin(t * 2) * 4; g.save(); g.translate(sx + sway * (1 - rev), stY - lift); g.rotate(rev * 0.25); g.globalAlpha = 1 - rev * 0.6; g.fillStyle = grad(g, -150, 0, 150, 0, [[0, '#c8c8d8'], [0.5, '#f4f4fa'], [1, '#a8a8bc']]); g.beginPath(); g.moveTo(-150, 0); g.quadraticCurveTo(-170, -240, -40, -400); g.quadraticCurveTo(0, -430, 40, -400); g.quadraticCurveTo(170, -240, 150, 0); for (let i = 7; i >= 0; i--) g.quadraticCurveTo(-150 + i * 40 + 20, 22, -150 + i * 40, 0); g.fill(); g.strokeStyle = 'rgba(100,100,140,.35)'; g.lineWidth = 3; for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(i * 12, -400); g.quadraticCurveTo(i * 34, -200, i * 44, 0); g.stroke(); } g.restore(); }
    confetti(g, t, rev * 120, 8); g.restore(); },
];

// ================================================================ AFSPELEN: titelkaart, ondertitels, overgangen, invoer
const WHO = { 'Te-Un': '#3f9a4a', Kabouter: '#d8362a', Nico: '#4a6ac8', Robot: '#6a7a8a', Agent: '#3a5aa8' };
const TYPE_CPS = 40, TITLE_DUR = 2.6, FADE = 0.4;
let GRAIN = null, VIGN = null;
function grainPattern(g) { if (!GRAIN) { GRAIN = mkc(200, 200); const x = GRAIN.getContext('2d'), d = x.createImageData(200, 200), r = rng(99); for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } x.putImageData(d, 0, 0); } return g.createPattern(GRAIN, 'repeat'); }
function vignette() { if (!VIGN) { VIGN = mkc(W, H); const x = VIGN.getContext('2d'); x.fillStyle = rgrad(x, W / 2, H / 2, H * 0.42, H * 1.0, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.62)']]); x.fillRect(0, 0, W, H); } return VIGN; }
function wrapText(g, text, maxW, font) { g.font = font; const words = text.split(' '), lines = []; let cur = ''; for (const w of words) { const test = cur ? cur + ' ' + w : w; if (g.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test; } if (cur) lines.push(cur); return lines; }
function drawSubtitle(g, shot, typed, t, lines, done) {
  const bx = 70, bw = 1140, lh = 40, bh = lines.length * lh + 44, by = 700 - bh;
  g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 24; g.fillStyle = 'rgba(10,12,22,.78)'; rr(g, bx, by, bw, bh, 22); g.fill(); g.shadowBlur = 0; g.strokeStyle = 'rgba(255,255,255,.14)'; g.lineWidth = 2; g.stroke();
  let ty = by + 40; if (shot.who) { const col = WHO[shot.who] || '#6a6a8a'; g.font = `700 24px ${FONT}`; const nw = g.measureText(shot.who).width + 40; g.fillStyle = col; rr(g, bx + 26, by - 20, nw, 40, 20); g.fill(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(shot.who, bx + 26 + nw / 2, by + 8); ty = by + 48; }
  const it = !shot.who; const font = `${it ? 'italic ' : ''}500 30px ${FONT}`; g.font = font; g.textAlign = 'left'; g.fillStyle = it ? '#d8e0f4' : '#fff'; let left = typed;
  for (let i = 0; i < lines.length; i++) { const s = lines[i].slice(0, Math.max(0, left)); left -= lines[i].length + 1; g.fillText(s, bx + 32, ty + i * lh); if (left < 0) break; }
  if (done) { const a = 0.5 + 0.5 * Math.sin(t * 6); g.fillStyle = `rgba(255,226,122,${a})`; g.beginPath(); g.moveTo(bx + bw - 44, by + bh - 34); g.lineTo(bx + bw - 24, by + bh - 24); g.lineTo(bx + bw - 44, by + bh - 14); g.fill(); }
  g.restore();
}
function drawTitleCard(g, def, t, id) {
  g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#06081a'], [1, '#1a1030']]); g.fillRect(0, 0, W, H); const r = rng(5);
  for (let i = 0; i < 60; i++) { const x = r() * W, y = ((r() * H - t * (10 + r() * 30)) % H + H) % H; g.fillStyle = `rgba(255,226,122,${0.15 + r() * 0.4 * (0.5 + 0.5 * Math.sin(t * 3 + i))})`; g.beginPath(); g.arc(x, y, 1 + r() * 2.2, 0, TAU); g.fill(); }
  const m = /^Hoofdstuk (\d+):\s*(.+)$/.exec(def.title || ''), ch = m ? CHAPTERS[+m[1] - 1] : null; const inK = sstep(prog(t, 0, 0.7)), out = 1 - sstep(prog(t, TITLE_DUR - 0.4, TITLE_DUR)); const a = inK * out;
  g.save(); g.globalAlpha = a; zoomAt(g, 0.92 + 0.08 * inK + t * 0.006, W / 2, H / 2); glow(g, W / 2, 330, 520, 'rgba(255,200,60,.35)', 1);
  if (m) {
    g.save(); g.font = `600 36px ${FONT}`; g.textAlign = 'center'; if ('letterSpacing' in g) g.letterSpacing = '10px'; g.fillStyle = '#c8b070'; g.fillText(`HOOFDSTUK ${m[1]}`, W / 2, 262); g.restore();
    g.save(); g.lineJoin = 'round'; g.font = `700 108px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 14; g.strokeStyle = '#3a2208'; g.strokeText(m[2], W / 2, 390); g.fillStyle = grad(g, 0, 300, 0, 400, [[0, '#fff2a0'], [0.5, '#ffd23a'], [1, '#d89a10']]); g.fillText(m[2], W / 2, 390); g.restore();
    g.fillStyle = '#e8b840'; const lw = 300 * sstep(prog(t, 0.3, 1.2)); g.fillRect(W / 2 - lw, 420, lw * 2, 4); sparkle(g, W / 2 - lw, 422, 10, 1); sparkle(g, W / 2 + lw, 422, 10, 1);
    if (ch) { g.font = `italic 500 36px ${FONT}`; g.fillStyle = '#d8e0f4'; g.textAlign = 'center'; g.fillText(ch.sub, W / 2, 490); }
  } else { g.save(); g.lineJoin = 'round'; g.font = `700 108px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 14; g.strokeStyle = '#3a2208'; g.strokeText(def.title || '', W / 2, 390); g.fillStyle = '#ffd23a'; g.fillText(def.title || '', W / 2, 390); g.restore(); }
  g.restore(); void id;
}
function drawEndCard(g, t) {
  g.fillStyle = grad(g, 0, 0, 0, H, [[0, '#06081a'], [1, '#2a1a40']]); g.fillRect(0, 0, W, H); confetti(g, t, 70, 12, 0.7); fireworks(g, t, 6, 5);
  const k = sstep(prog(t, 0, 1)); g.save(); g.globalAlpha = k; zoomAt(g, 0.85 + 0.15 * k, W / 2, 330); glow(g, W / 2, 300, 600, 'rgba(255,200,60,.4)', 1);
  g.lineJoin = 'round'; g.font = `700 200px ${FONT}`; g.textAlign = 'center'; g.lineWidth = 22; g.strokeStyle = '#3a2208'; g.strokeText('EINDE', W / 2, 360); g.fillStyle = grad(g, 0, 200, 0, 370, [[0, '#fff6b0'], [0.5, '#ffd23a'], [1, '#c8861a']]); g.fillText('EINDE', W / 2, 360);
  const x = ((t * 400) % 1800) - 300; g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = grad(g, x, 200, x + 120, 360, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,.35)'], [1, 'rgba(255,255,255,0)']]); g.fillRect(260, 190, 760, 190); g.restore();
  const k2 = sstep(prog(t, 1.2, 2)); g.globalAlpha = k2; g.font = `600 52px ${FONT}`; g.fillStyle = '#fff'; g.fillText('Bedankt voor het spelen!', W / 2, 470);
  if (t > 2.6) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 4); g.font = `500 26px ${FONT}`; g.fillStyle = '#c8b070'; g.fillText('Tik om verder te gaan', W / 2, 560); }
  g.restore();
}

export function playCutscene(canvas, id, onDone, opts = {}) {
  const def = CUTSCENES[id], scenes = SCENES[id] || [];
  const g = canvas.getContext('2d'), sfx = typeof opts.sfx === 'function' ? opts.sfx : null;
  const bufA = mkc(W, H), bufB = mkc(W, H), ga = bufA.getContext('2d'), gb = bufB.getContext('2d');
  let finished = false, raf = 0, last = 0, clock = 0;
  const fired = new Set();
  const finish = () => { if (finished) return; finished = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', onKey, true); canvas.removeEventListener('pointerdown', onPtr); CACHE = {}; try { onDone && onDone(); } catch (e) { console.error(e); } };
  if (!def) { finished = false; setTimeout(finish, 0); return { skip: finish }; }
  const shots = def.shots, hasTitle = !!def.title && id !== 'final';
  let phase = hasTitle ? 'title' : 'shot', pt = 0, idx = 0, st = 0, typed = 0, lines = [], trans = null, endT = 0, outT = -1, startedAt = 0;
  const setShot = (i) => { idx = i; st = 0; typed = 0; const sh = shots[i]; lines = wrapText(g, sh.text, 1076, `${sh.who ? '' : 'italic '}500 30px ${FONT}`); };
  g.save(); setShot(0); g.restore();
  const durOf = (i) => Math.max(5, 3.4 + 0.04 * shots[i].text.length);
  const skipRect = { x: W - 214, y: 14, w: 198, h: 38 };
  const next = () => {
    if (phase === 'title') { phase = 'shot'; trans = { k: 0, fromTitle: true }; return; }
    if (phase === 'end') { outT = 0; return; }
    const sh = shots[idx], len = sh.text.length;
    if (typed < len) { typed = len; st = Math.max(st, 0.35 + len / TYPE_CPS); return; }
    if (idx + 1 >= shots.length) { if (id === 'final') { phase = 'end'; endT = 0; } else outT = 0; return; }
    trans = { prev: idx, prevT: st, k: 0 }; setShot(idx + 1);
  };
  const onKey = (e) => { if (finished) return; if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); return; } if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); if (clock - startedAt > 0.3 && outT < 0) next(); } };
  const onPtr = (e) => { if (finished) return; e.preventDefault(); const rc = canvas.getBoundingClientRect(), x = (e.clientX - rc.left) * W / rc.width, y = (e.clientY - rc.top) * H / rc.height; if (x >= skipRect.x && x <= skipRect.x + skipRect.w && y >= skipRect.y && y <= skipRect.y + skipRect.h) { finish(); return; } if (clock - startedAt > 0.3 && outT < 0) next(); };
  window.addEventListener('keydown', onKey, true); canvas.addEventListener('pointerdown', onPtr);
  const ctxFor = (i, live) => ({ cue: (at, name) => { if (!live) return; const k = id + i + name + at; if (st >= at && !fired.has(k)) { fired.add(k); if (sfx) try { sfx(name); } catch (e) { /* geen geluid */ } } } });
  const render = (tg, i, tt, live) => { tg.save(); tg.setTransform(1, 0, 0, 1, 0, 0); tg.clearRect(0, 0, W, H); const fn = scenes[i]; if (fn) { try { fn(tg, tt, ctxFor(i, live)); } catch (e) { console.error('cutscene', id, i, e); tg.fillStyle = '#000'; tg.fillRect(0, 0, W, H); } } else { tg.fillStyle = '#10141c'; tg.fillRect(0, 0, W, H); } tg.restore(); };
  const frame = (ts) => {
    if (finished) return; const dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016); last = ts; clock += dt; if (!startedAt) startedAt = clock - dt;
    g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    let fade = 0; // 0..1 zwart
    if (phase === 'title') { pt += dt; drawTitleCard(g, def, pt, id); if (pt >= TITLE_DUR) { phase = 'shot'; trans = { k: 0, fromTitle: true }; } }
    else if (phase === 'end') { endT += dt; drawEndCard(g, endT); if (endT > 14) outT = Math.max(outT, 0); }
    else {
      st += dt; const sh = shots[idx]; const tx = Math.max(0, st - 0.35 - (trans ? 0 : 0)); typed = Math.max(typed, Math.min(sh.text.length, Math.floor(tx * TYPE_CPS)));
      render(ga, idx, st, true); g.drawImage(bufA, 0, 0);
      if (trans) { trans.k += dt / FADE; if (trans.prev !== undefined) { trans.prevT += dt; render(gb, trans.prev, trans.prevT, false); g.globalAlpha = 1 - sstep(trans.k); g.drawImage(bufB, 0, 0); g.globalAlpha = 1; } else { fade = Math.max(fade, 1 - sstep(trans.k)); } if (trans.k >= 1) trans = null; }
      if (idx === 0 && !trans && !hasTitle) fade = Math.max(fade, 1 - sstep(prog(st, 0, 0.5)));
      g.globalAlpha = 0.07; g.fillStyle = grainPattern(g); g.save(); g.translate(Math.floor(Math.random() * 200), Math.floor(Math.random() * 200)); g.fillRect(-200, -200, W + 200, H + 200); g.restore(); g.globalAlpha = 1; g.drawImage(vignette(), 0, 0);
      const trAlpha = trans && trans.prev !== undefined ? 1 - 0 : 1; void trAlpha;
      drawSubtitle(g, sh, typed, clock, lines, typed >= sh.text.length);
      if (outT < 0 && st >= durOf(idx) && typed >= sh.text.length && !trans) next();
    }
    if (outT >= 0) { outT += dt; fade = Math.max(fade, sstep(prog(outT, 0, 0.5))); if (outT >= 0.55) { finish(); return; } }
    if (phase === 'end' && outT < 0 && false) fade = 0;
    if (fade > 0) { g.globalAlpha = fade; g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
    if (phase !== 'title' && phase !== 'end' || true) { g.save(); g.fillStyle = 'rgba(10,12,22,.55)'; rr(g, skipRect.x, skipRect.y, skipRect.w, skipRect.h, 19); g.fill(); g.font = `500 19px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#d8e0f4'; g.fillText('Overslaan (Esc)', skipRect.x + skipRect.w / 2, skipRect.y + 26); g.restore(); }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { skip: finish };
}
