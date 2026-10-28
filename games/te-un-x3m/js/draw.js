// Alles wordt in de browser getekend met Canvas 2D: terrein, gevaren, voertuigen en de bestuurders.
import { VEH, sawPos, fireOn } from './sim.js';

const TAU = Math.PI * 2;
const OUT = '#16110e';

// ---------------------------------------------------------------- textures
function rockTile(base, dark, light, seed = 1, strength = 1) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  let s = seed * 9301;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  for (let i = 0; i < 46; i++) {
    const x = r() * 256, y = r() * 256, w = 30 + r() * 60, h = 20 + r() * 46, a = r() * 0.5;
    for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
      g.save(); g.translate(x + ox, y + oy); g.rotate((r() - 0.5) * 0.3);
      g.fillStyle = `rgba(${r() < 0.5 ? light : dark},${(0.12 + a * 0.3) * strength})`;
      g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, 10); g.fill();
      g.strokeStyle = `rgba(${dark},${0.55 * strength})`; g.lineWidth = 2; g.stroke();
      g.restore();
    }
  }
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = `rgba(${dark},${0.35 * strength})`; g.lineWidth = 1.2; g.beginPath();
    let x = r() * 256, y = r() * 256; g.moveTo(x, y);
    for (let k = 0; k < 4; k++) { x += (r() - 0.5) * 24; y += (r() - 0.2) * 24; g.lineTo(x, y); }
    g.stroke();
  }
  return c;
}

const THEME_STYLE = {
  cave: { wall: ['#3a2c20', '60,42,26', '120,92,62'], floor: ['#b48a58', '88,60,32', '224,190,140'], top: '#e8c48c', edge: '#5a3d1f', ceil: ['#9a7448', '70,48,26', '200,160,110'], sky: ['#241a12', '#120d09'], glow: true },
  canyon: { wall: ['#7a3b2a', '70,28,20', '190,100,70'], floor: ['#c4622d', '110,44,20', '240,150,90'], top: '#f0a060', edge: '#6b2a12', ceil: ['#a14c26', '90,36,16', '230,130,80'], sky: ['#ff9d5c', '#7b3f6e'], glow: false },
  ice: { wall: ['#1b2f4f', '12,26,48', '90,140,190'], floor: ['#bcdff0', '90,140,180', '255,255,255'], top: '#f4fbff', edge: '#4c7fa6', ceil: ['#9cc6e0', '70,120,160', '240,250,255'], sky: ['#13264a', '#05101f'], glow: false },
};

export class Renderer {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.tiles = {};
    this.parts = [];
    this.stars = Array.from({ length: 70 }, (_, i) => [(i * 137.5) % 1, (i * 71.3) % 0.7, 0.5 + ((i * 13) % 10) / 10]);
    this.hills = Array.from({ length: 3 }, (_, k) => Array.from({ length: 40 }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7 + k * 3.1) * Math.cos(i * 0.6 + k))));
    this.resize();
  }
  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.cv.clientWidth, h = this.cv.clientHeight;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.dpr = dpr; this.W = w; this.H = h;
    this.S = Math.max(24, Math.min(w / 26, h / 13.5));
  }
  tile(theme, kind) {
    const k = theme + kind;
    if (!this.tiles[k]) {
      const st = THEME_STYLE[theme][kind];
      this.tiles[k] = this.ctx.createPattern(rockTile(st[0], st[1], st[2], kind.length + theme.length, theme === 'ice' ? 0.4 : theme === 'canyon' ? 0.8 : 1), 'repeat');
    }
    return this.tiles[k];
  }

  // ---- deeltjes
  emit(type, x, y, vx, vy, life, size, color) { if (this.parts.length < 500) this.parts.push({ type, x, y, vx, vy, life, max: life, size, color }); }
  stepParts(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { this.parts.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.type === 'dust') p.vy += 2 * dt;
      else if (p.type === 'spark') p.vy -= 12 * dt;
      p.vx *= 1 - dt * 0.6;
    }
  }

  // ---- voorbeeld van een voertuig met bestuurder (garage)
  preview(vid, ch, time, bw = 3) {
    const { ctx, W, H, dpr } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    this.S = Math.min(W / bw, H / 2.5);
    this.sx = () => W / 2;
    this.sy = () => H * 0.72;
    const V = VEH[vid];
    const b = { vid, x: 0, y: 0, a: -0.04 + Math.sin(time * 1.6) * 0.03 + (V.fly ? Math.sin(time * 2) * 0.02 : 0), vx: 6, vy: 0, w: 0, spin: [time * 0 + 7, 7], ground: [false, false], air: 0.5, crank: time * 5, thrusting: V.fly ? 1 : 0, _ang: this._pa || (this._pa = [0, 0]), _dt: 1 / 60 };
    const gg = { input: { gas: true }, character: ch, paused: true, over: false, rs: this._rs || (this._rs = { lean: 0 }) };
    this.bike(b, gg, time);
  }

  // ---- hoofdfunctie
  render(g) {
    const { ctx, W, H, S, dpr } = this;
    const { level, bike, cam, time } = g;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sx = (x) => W / 2 + (x - cam.x) * S;
    const sy = (y) => H / 2 - (y - cam.y) * S;
    const th = level.theme.id, st = THEME_STYLE[th];
    this.cam = cam; this.sx = sx; this.sy = sy;
    this.background(th, st, cam, time);

    // plafond
    const xa = cam.x - W / 2 / S - 2, xb = cam.x + W / 2 / S + 2;
    const ceil = level.ceil;
    const i0 = Math.max(0, Math.floor(xa + 40)), i1 = Math.min(ceil.length - 1, Math.ceil(xb + 40));
    if (i1 > i0) {
      ctx.save();
      ctx.beginPath(); ctx.moveTo(sx(ceil[i0][0]), sy(ceil[i0][1]));
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(sx(ceil[i][0]), sy(ceil[i][1]));
      ctx.lineTo(sx(ceil[i1][0]), -40); ctx.lineTo(sx(ceil[i0][0]), -40); ctx.closePath();
      ctx.fillStyle = '#000'; ctx.fill();
      ctx.clip();
      ctx.translate(W / 2 - cam.x * S, H / 2 + cam.y * S);
      ctx.fillStyle = this.tile(th, 'ceil'); ctx.fillRect(cam.x * S - W, -cam.y * S - H, W * 2, H * 2);
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(sx(ceil[i0][0]), sy(ceil[i0][1]));
      for (let i = i0 + 1; i <= i1; i++) ctx.lineTo(sx(ceil[i][0]), sy(ceil[i][1]));
      ctx.lineWidth = 4; ctx.strokeStyle = OUT; ctx.stroke();
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.translate(0, 3); ctx.stroke(); ctx.translate(0, -3);
    }

    this.terrain(level, th, st, xa, xb);
    this.hazards(level, time, xa, xb);
    this.finish(level);

    // deeltjes onder de bestuurder
    this.drawParts(0);
    // voertuig + bestuurder
    if (g.rider) this.rider(g.rider, g.character, time, true);
    this.bike(bike, g, time);
    this.drawParts(1);

    // sfeer: vignet
    const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
    if (th === 'ice') this.snow(time);
  }

  background(th, st, cam, time) {
    const { ctx, W, H } = this;
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, st.sky[0]); grad.addColorStop(1, st.sky[1]);
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
    if (th === 'cave') {
      ctx.save();
      const f = 0.45, S = this.S;
      ctx.translate(W / 2 - cam.x * S * f, H / 2 + cam.y * S * f);
      ctx.fillStyle = this.tile(th, 'wall');
      ctx.fillRect(cam.x * S * f - W, -cam.y * S * f - H, W * 2, H * 2);
      ctx.restore();
      ctx.fillStyle = 'rgba(8,4,2,.42)'; ctx.fillRect(0, 0, W, H);
      // grote donkere band zoals in de grot
      ctx.fillStyle = 'rgba(0,0,0,.28)';
      ctx.fillRect(0, this.sy(cam.y + 3) - 20, W, 70);
    } else {
      if (th === 'ice') {
        ctx.fillStyle = '#fff';
        for (const [x, y, s] of this.stars) { ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(time * s + x * 9)); ctx.fillRect(x * W, y * H, s * 1.6, s * 1.6); }
        ctx.globalAlpha = 1;
      } else {
        const sun = ctx.createRadialGradient(W * 0.75, H * 0.32, 10, W * 0.75, H * 0.32, H * 0.35);
        sun.addColorStop(0, 'rgba(255,240,180,1)'); sun.addColorStop(0.25, 'rgba(255,200,120,.7)'); sun.addColorStop(1, 'rgba(255,160,90,0)');
        ctx.fillStyle = sun; ctx.fillRect(0, 0, W, H);
      }
      const cols = th === 'ice' ? ['#2b4a78', '#1e3860', '#142a4a'] : ['#b65a3a', '#8f3f2c', '#6a2c22'];
      this.hills.forEach((hs, k) => {
        const par = 0.08 + k * 0.1, base = H * (0.62 + k * 0.08), amp = H * (0.28 - k * 0.04);
        ctx.fillStyle = cols[k]; ctx.beginPath(); ctx.moveTo(0, H);
        for (let x = 0; x <= W + 40; x += 40) {
          const wx = x + cam.x * this.S * par, i = Math.floor(wx / 140), f = (wx % 140) / 140;
          const a = hs[((i % 40) + 40) % 40], b = hs[(((i + 1) % 40) + 40) % 40];
          ctx.lineTo(x, base - (a * (1 - f) + b * f) * amp + cam.y * this.S * par * 0.6);
        }
        ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
        if (th === 'ice') { ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fill(); }
      });
    }
  }

  terrain(level, th, st, xa, xb) {
    const { ctx, W, H, S, sx, sy, cam } = this;
    const pts = level.pts;
    let a = 0;
    while (a < pts.length - 1 && pts[a + 1][0] < xa) a++;
    let b = a;
    while (b < pts.length - 1 && pts[b][0] < xb) b++;
    if (b <= a) return;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(sx(pts[a][0]), H + 50);
    for (let i = a; i <= b; i++) ctx.lineTo(sx(pts[i][0]), sy(pts[i][1]));
    ctx.lineTo(sx(pts[b][0]), H + 50); ctx.closePath();
    ctx.fillStyle = '#000'; ctx.fill();
    ctx.clip();
    ctx.translate(W / 2 - cam.x * S, H / 2 + cam.y * S);
    ctx.fillStyle = this.tile(th, 'floor'); ctx.fillRect(cam.x * S - W, -cam.y * S - H, W * 2, H * 2);
    ctx.restore();
    // lichte rand bovenop + donkere omlijning
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const path = () => { ctx.beginPath(); ctx.moveTo(sx(pts[a][0]), sy(pts[a][1])); for (let i = a + 1; i <= b; i++) ctx.lineTo(sx(pts[i][0]), sy(pts[i][1])); };
    path(); ctx.lineWidth = 0.3 * S; ctx.strokeStyle = st.top; ctx.save(); ctx.translate(0, 0.12 * S); ctx.stroke(); ctx.restore();
    path(); ctx.lineWidth = 0.09 * S; ctx.strokeStyle = OUT; ctx.stroke();
  }

  hazards(level, t, xa, xb) {
    const { ctx, S, sx, sy } = this;
    for (const h of level.hz) {
      const hx0 = h.x0 ?? h.x - 2, hx1 = h.x1 ?? h.x + 2;
      if (hx1 < xa - 3 || hx0 > xb + 3) continue;
      if (h.type === 'pit') {
        const g = ctx.createLinearGradient(0, sy(h.y + h.h), 0, sy(h.y - 3));
        g.addColorStop(0, '#ffb02a'); g.addColorStop(0.35, '#ff5a14'); g.addColorStop(1, '#7a0f05');
        ctx.fillStyle = g; ctx.fillRect(sx(h.x0), sy(h.y + h.h), (h.x1 - h.x0) * S, 3.2 * S);
        ctx.fillStyle = 'rgba(255,230,120,.9)';
        for (let i = 0; i < 6; i++) {
          const bx = h.x0 + ((i * 0.77 + t * 0.4) % (h.x1 - h.x0)), by = h.y + h.h - 0.1 + Math.sin(t * 3 + i) * 0.12;
          ctx.beginPath(); ctx.arc(sx(bx), sy(by), 0.12 * S, 0, TAU); ctx.fill();
        }
        // gloed
        const gl = ctx.createLinearGradient(0, sy(h.y + h.h + 3), 0, sy(h.y + h.h));
        gl.addColorStop(0, 'rgba(255,120,30,0)'); gl.addColorStop(1, 'rgba(255,120,30,.35)');
        ctx.fillStyle = gl; ctx.fillRect(sx(h.x0), sy(h.y + h.h + 3), (h.x1 - h.x0) * S, 3 * S);
      } else if (h.type === 'spikes') {
        const n = Math.max(3, Math.round((h.x1 - h.x0) / 0.42)), w = (h.x1 - h.x0) / n;
        for (let i = 0; i < n; i++) {
          const x0 = h.x0 + i * w;
          const g = ctx.createLinearGradient(sx(x0), 0, sx(x0 + w), 0);
          g.addColorStop(0, '#f2f5f8'); g.addColorStop(0.5, '#a5b0bb'); g.addColorStop(1, '#5d6873');
          ctx.fillStyle = g; ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(sx(x0), sy(h.y - 0.1)); ctx.lineTo(sx(x0 + w / 2), sy(h.y + h.h)); ctx.lineTo(sx(x0 + w), sy(h.y - 0.1)); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
      } else if (h.type === 'fire') {
        ctx.fillStyle = '#3a3f46'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
        const n = 3;
        for (let i = 0; i < n; i++) {
          const x = h.x0 + (i + 0.5) * (h.x1 - h.x0) / n;
          ctx.beginPath(); ctx.roundRect(sx(x) - 0.3 * S, sy(h.y + 0.15), 0.6 * S, 0.3 * S, 4); ctx.fill(); ctx.stroke();
        }
        const ph = (t + h.phase) % h.period;
        const warm = ph > h.period - 0.45 && ph < h.period;
        if (fireOn(h, t) || warm) {
          const k = fireOn(h, t) ? Math.min(1, ph / 0.15) : 0.22;
          for (let i = 0; i < n; i++) {
            const x = h.x0 + (i + 0.5) * (h.x1 - h.x0) / n;
            for (let L = 0; L < 3; L++) {
              const hh = h.h * k * (1 - L * 0.22) * (0.9 + 0.1 * Math.sin(t * 30 + i + L));
              const col = ['rgba(255,70,20,.9)', 'rgba(255,160,30,.95)', 'rgba(255,240,150,1)'][L];
              ctx.fillStyle = col; ctx.beginPath();
              const w = 0.5 - L * 0.12;
              ctx.moveTo(sx(x) - w * S, sy(h.y + 0.2));
              ctx.quadraticCurveTo(sx(x) - w * 0.8 * S, sy(h.y + hh * 0.55), sx(x) + Math.sin(t * 22 + L) * 0.12 * S, sy(h.y + hh));
              ctx.quadraticCurveTo(sx(x) + w * 0.8 * S, sy(h.y + hh * 0.55), sx(x) + w * S, sy(h.y + 0.2));
              ctx.closePath(); ctx.fill();
            }
          }
        }
      } else if (h.type === 'saw') {
        const [x, y] = sawPos(h, t);
        if (h.ay !== undefined) {
          ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 0.14 * S;
          ctx.beginPath(); ctx.moveTo(sx(x), sy(h.ay - 0.2)); ctx.lineTo(sx(x), sy(h.by + 6)); ctx.stroke();
          ctx.strokeStyle = '#6b7380'; ctx.lineWidth = 0.05 * S; ctx.stroke();
        }
        ctx.save(); ctx.translate(sx(x), sy(y)); ctx.rotate(t * 9 * (h.spin || 1));
        const r = h.r * S, teeth = 14;
        const g = ctx.createRadialGradient(0, 0, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#e9eef3'); g.addColorStop(0.7, '#9fa9b4'); g.addColorStop(1, '#5a6470');
        ctx.fillStyle = g; ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < teeth; i++) {
          const a0 = (i / teeth) * TAU, a1 = ((i + 0.5) / teeth) * TAU, a2 = ((i + 1) / teeth) * TAU;
          ctx.lineTo(Math.cos(a0) * r * 0.82, Math.sin(a0) * r * 0.82);
          ctx.lineTo(Math.cos(a1) * r * 1.12, Math.sin(a1) * r * 1.12);
          ctx.lineTo(Math.cos(a2) * r * 0.82, Math.sin(a2) * r * 0.82);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#c0392b'; ctx.beginPath(); ctx.arc(0, 0, r * 0.32, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#2a2d33'; ctx.beginPath(); ctx.arc(0, 0, r * 0.1, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
  }

  finish(level) {
    const { ctx, S, sx, sy } = this;
    const x = level.finishX, yy = this.groundAt(level, x);
    const w = 2.6, h = 4.2;
    ctx.fillStyle = '#2a2d33'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
    for (const dx of [0, w]) { ctx.beginPath(); ctx.roundRect(sx(x + dx) - 0.14 * S, sy(yy + h), 0.28 * S, h * S, 4); ctx.fill(); ctx.stroke(); }
    const bh = 0.9, sq = 0.3;
    for (let i = 0; i < Math.round(w / sq); i++) for (let j = 0; j < 3; j++) {
      ctx.fillStyle = (i + j) % 2 ? '#111' : '#fff';
      ctx.fillRect(sx(x + i * sq), sy(yy + h) + j * sq * S, sq * S + 0.5, sq * S + 0.5);
    }
    ctx.strokeStyle = OUT; ctx.strokeRect(sx(x), sy(yy + h), w * S, 3 * sq * S);
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.fillRect(sx(x), sy(yy + h) + 3 * sq * S, w * S, (h - bh) * S - 3 * sq * S);
  }
  groundAt(level, x) {
    const t = level.track;
    for (let i = 1; i < t.length; i++) if (t[i][0] > t[i - 1][0] && x >= t[i - 1][0] && x <= t[i][0]) return t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (x - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
    return t[t.length - 1][1];
  }

  snow(t) {
    const { ctx, W, H } = this;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 70; i++) {
      const x = ((i * 97.3 + t * (10 + (i % 5) * 4) + Math.sin(t + i) * 10) % (W + 20)), y = ((i * 53.7 + t * (30 + (i % 7) * 8)) % (H + 20));
      ctx.fillRect(x, y, 2 + (i % 3), 2 + (i % 3));
    }
  }

  drawParts(layer) {
    const { ctx, S, sx, sy } = this;
    for (const p of this.parts) {
      const f = p.life / p.max;
      if ((p.type === 'smoke' || p.type === 'dust' || p.type === 'vapor') !== (layer === 0)) continue;
      if (p.type === 'dust') ctx.fillStyle = `rgba(210,180,140,${f * 0.5})`;
      else if (p.type === 'smoke') ctx.fillStyle = `rgba(190,190,190,${f * 0.35})`;
      else if (p.type === 'vapor') ctx.fillStyle = `rgba(255,255,255,${f * 0.7})`;
      else if (p.type === 'rainbow') ctx.fillStyle = `hsla(${p.color},100%,60%,${f})`;
      else if (p.type === 'star') ctx.fillStyle = `rgba(255,230,120,${f})`;
      else ctx.fillStyle = p.color || '#ffd54a';
      const r = p.size * (p.type === 'vapor' || p.type === 'smoke' || p.type === 'dust' ? (1.2 - f * 0.4 + 0.3) : f + 0.2) * S;
      ctx.beginPath(); ctx.arc(sx(p.x), sy(p.y), Math.max(0.5, r), 0, TAU); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- voertuigen
  local(b, fn) {
    const { ctx, S } = this;
    ctx.save();
    ctx.translate(this.sx(b.x), this.sy(b.y));
    ctx.rotate(-b.a);
    ctx.scale(S, -S);
    fn(ctx);
    ctx.restore();
  }

  wheel(c, x, y, r, spin, kind) {
    c.save(); c.translate(x, y); c.rotate(-spin);
    const fat = kind === 'fat';
    c.fillStyle = '#15171b'; c.strokeStyle = OUT; c.lineWidth = 0.05;
    c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.stroke();
    // profiel
    c.strokeStyle = '#2d3138'; c.lineWidth = fat ? 0.07 : 0.05;
    const n = fat ? 22 : 18;
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; c.beginPath(); c.moveTo(Math.cos(a) * (r - 0.02), Math.sin(a) * (r - 0.02)); c.lineTo(Math.cos(a) * (r - (fat ? 0.12 : 0.09)), Math.sin(a) * (r - (fat ? 0.12 : 0.09))); c.stroke(); }
    const rim = r * (fat ? 0.6 : 0.66);
    const g = c.createRadialGradient(-rim * 0.3, rim * 0.3, 0.02, 0, 0, rim);
    g.addColorStop(0, '#f2f5f8'); g.addColorStop(1, '#8f99a4');
    c.fillStyle = g; c.strokeStyle = OUT; c.lineWidth = 0.04;
    c.beginPath(); c.arc(0, 0, rim, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = '#59616b'; c.lineWidth = 0.025;
    for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * rim * 0.92, Math.sin(a) * rim * 0.92); c.stroke(); }
    c.fillStyle = '#c9d0d8'; c.beginPath(); c.arc(0, 0, 0.07, 0, TAU); c.fill(); c.stroke();
    c.restore();
  }

  bike(b, g, time) {
    const V = VEH[b.vid];
    const spd = Math.hypot(b.vx, b.vy);
    // deeltjes
    const dt = g.dt || 1 / 60;
    if (!g.paused && !g.over) {
      for (let i = 0; i < 2; i++) if (b.ground[i] && spd > 2 && Math.random() < dt * 22) {
        const c = Math.cos(b.a), s = Math.sin(b.a), lx = (i ? 1 : -1) * V.wb / 2, ly = V.wy - V.r;
        this.emit('dust', b.x + c * lx - s * ly, b.y + s * lx + c * ly, -b.vx * 0.15 + (Math.random() - 0.5), 0.6 + Math.random() * 0.8, 0.5, 0.12, '');
      }
      if (b.vid === 'motor' && g.input.gas && Math.random() < dt * 30) {
        const c = Math.cos(b.a), s = Math.sin(b.a);
        this.emit('smoke', b.x + c * -0.95 - s * -0.2, b.y + s * -0.95 + c * -0.2, -2 + Math.random() - b.vx * 0.2, 0.4 + Math.random() * 0.5, 0.7, 0.13, '');
      }
      if (b.vid === 'vape' && Math.random() < dt * (b.thrusting ? 70 : 12)) {
        const c = Math.cos(b.a), s = Math.sin(b.a);
        this.emit('vapor', b.x + c * -1.0 - s * 0.0, b.y + s * -1.0 + c * 0.0, -c * (b.thrusting ? 5 : 1) - b.vx * 0.2 + (Math.random() - 0.5), -s * (b.thrusting ? 5 : 1) + (Math.random() - 0.5), 0.9, 0.2 + Math.random() * 0.12, '');
      }
      if (g.character === 'gold' && Math.random() < dt * 60) this.emit('rainbow', b.x - 0.4 + Math.random() * 0.2, b.y + 0.4 + Math.random() * 1.1, -2 - Math.random() * 2, (Math.random() - 0.5) * 2, 0.7, 0.09, (time * 200 + Math.random() * 90) % 360);
    }
    this.local(b, (c) => {
      c.lineJoin = 'round'; c.lineCap = 'round';
      if (b.vid === 'fatbike') this.drawFatbike(c, b, g, time);
      else if (b.vid === 'motor') this.drawMotor(c, b, g, time);
      else this.drawVape(c, b, g, time);
      if (!g.rider) this.rider(riderPose(b, g, time), g.character, time, false, c);
    });
  }

  drawFatbike(c, b, g, time) {
    const V = VEH.fatbike, rx = -V.wb / 2, fx = V.wb / 2, wy = V.wy;
    // achterwiel + voorwiel
    this.wheel(c, rx, wy, V.r, b.spin[0] * 0 + this.spinAcc(b, 0, time), 'fat');
    this.wheel(c, fx, wy, V.r, this.spinAcc(b, 1, time), 'fat');
    const tube = (x1, y1, x2, y2, w, col) => {
      c.lineWidth = w + 0.07; c.strokeStyle = OUT; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
      c.lineWidth = w; c.strokeStyle = col; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    };
    const col = '#ffb81c', col2 = '#e08a00';
    // vork + frame
    tube(0.5, 0.42, fx, wy, 0.07, '#4b5560');
    tube(rx, wy, -0.12, 0.28, 0.07, col2);
    tube(rx, wy, -0.05, -0.28, 0.07, col2);
    tube(-0.05, -0.28, 0.5, 0.36, 0.09, col);
    tube(-0.12, 0.28, 0.5, 0.42, 0.08, col);
    tube(-0.12, 0.28, -0.05, -0.28, 0.08, col);
    // accublok op de onderbuis
    c.fillStyle = '#26303c'; c.strokeStyle = OUT; c.lineWidth = 0.035;
    c.beginPath(); c.roundRect(0.0, -0.07, 0.4, 0.15, 0.05); c.fill(); c.stroke();
    c.fillStyle = '#3cd070'; c.fillRect(0.06, -0.02, 0.08, 0.05);
    // trappers
    const cr = b.crank;
    const px = -0.05 + Math.cos(cr) * 0.17, py = -0.28 + Math.sin(cr) * 0.17;
    c.fillStyle = '#c9d0d8'; c.beginPath(); c.arc(-0.05, -0.28, 0.07, 0, TAU); c.fill(); c.stroke();
    tube(-0.05, -0.28, px, py, 0.04, '#9aa3ad');
    c.fillStyle = '#20242a'; c.beginPath(); c.roundRect(px - 0.11, py - 0.03, 0.22, 0.06, 0.02); c.fill();
    // zadel + stuur
    tube(-0.12, 0.28, -0.14, 0.4, 0.04, '#9aa3ad');
    c.fillStyle = '#1b1e23'; c.beginPath(); c.roundRect(-0.4, 0.38, 0.5, 0.11, 0.05); c.fill(); c.stroke();
    tube(0.5, 0.42, 0.46, 0.66, 0.05, '#9aa3ad');
    tube(0.36, 0.7, 0.58, 0.64, 0.045, '#2c3139');
    // lamp
    c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(0.6, 0.5, 0.055, 0, TAU); c.fill(); c.stroke();
    // spatbord
    c.strokeStyle = col2; c.lineWidth = 0.05; c.beginPath(); c.arc(fx, wy, V.r + 0.05, 0.4, 1.7); c.stroke();
  }
  spinAcc(b, i, time) {
    b._ang = b._ang || [0, 0];
    b._ang[i] += b.spin[i] * (b._dt || 1 / 60);
    return b._ang[i];
  }

  drawMotor(c, b, g, time) {
    const V = VEH.motor, rx = -V.wb / 2, fx = V.wb / 2, wy = V.wy;
    this.wheel(c, rx, wy, V.r, this.spinAcc(b, 0, time), 'moto');
    this.wheel(c, fx, wy, V.r, this.spinAcc(b, 1, time), 'moto');
    c.lineWidth = 0.035; c.strokeStyle = OUT;
    const orange = '#ff5a1f', dark = '#c93d0c';
    // voorvork
    c.lineCap = 'round';
    c.strokeStyle = OUT; c.lineWidth = 0.14; c.beginPath(); c.moveTo(0.46, 0.62); c.lineTo(fx, wy); c.stroke();
    c.strokeStyle = '#c9d0d8'; c.lineWidth = 0.08; c.beginPath(); c.moveTo(0.46, 0.62); c.lineTo(fx, wy); c.stroke();
    c.strokeStyle = '#39414b'; c.lineWidth = 0.1; c.beginPath(); c.moveTo(0.37, 0.4); c.lineTo(fx - 0.06, wy + 0.15); c.stroke();
    // achterbrug
    c.strokeStyle = OUT; c.lineWidth = 0.12; c.beginPath(); c.moveTo(rx, wy); c.lineTo(-0.1, -0.05); c.stroke();
    c.strokeStyle = '#8f99a4'; c.lineWidth = 0.07; c.stroke();
    // uitlaat
    c.strokeStyle = OUT; c.lineWidth = 0.13; c.beginPath(); c.moveTo(0.1, -0.15); c.quadraticCurveTo(-0.45, -0.1, -0.95, 0.12); c.stroke();
    c.strokeStyle = '#d5dae0'; c.lineWidth = 0.08; c.stroke();
    // motorblok
    const g1 = c.createLinearGradient(0, -0.3, 0, 0.2);
    g1.addColorStop(0, '#7d8791'); g1.addColorStop(1, '#3d444d');
    c.fillStyle = g1; c.strokeStyle = OUT; c.lineWidth = 0.04;
    c.beginPath(); c.roundRect(-0.28, -0.3, 0.62, 0.42, 0.08); c.fill(); c.stroke();
    c.fillStyle = '#c9d0d8'; c.beginPath(); c.arc(0.02, -0.1, 0.1, 0, TAU); c.fill(); c.stroke();
    // plastic: tank, kuip, zadel, spatborden
    const body = c.createLinearGradient(0, 0.2, 0, 0.8);
    body.addColorStop(0, dark); body.addColorStop(0.5, orange); body.addColorStop(1, '#ff8a4a');
    c.fillStyle = body;
    c.beginPath(); c.moveTo(-0.1, 0.12); c.quadraticCurveTo(0.1, 0.3, 0.2, 0.72); c.quadraticCurveTo(0.5, 0.82, 0.58, 0.6); c.lineTo(0.5, 0.36); c.quadraticCurveTo(0.3, 0.12, -0.1, 0.12); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#16181c'; c.beginPath(); c.moveTo(-0.65, 0.4); c.quadraticCurveTo(-0.3, 0.34, 0.1, 0.46); c.lineTo(0.1, 0.56); c.quadraticCurveTo(-0.3, 0.5, -0.65, 0.5); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = orange; c.beginPath(); c.moveTo(-0.95, 0.46); c.quadraticCurveTo(-0.7, 0.5, -0.5, 0.36); c.lineTo(-0.5, 0.18); c.quadraticCurveTo(-0.7, 0.3, -0.95, 0.3); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(fx - 0.35, wy + 0.6); c.quadraticCurveTo(fx, wy + 0.78, fx + 0.35, wy + 0.5); c.lineTo(fx + 0.3, wy + 0.42); c.quadraticCurveTo(fx, wy + 0.6, fx - 0.32, wy + 0.46); c.closePath(); c.fill(); c.stroke();
    // nummerbord
    c.fillStyle = '#fff'; c.beginPath(); c.roundRect(0.4, 0.62, 0.22, 0.2, 0.03); c.fill(); c.stroke();
    c.fillStyle = '#16181c'; c.font = 'bold 0.14px Arial'; c.save(); c.scale(1, -1); c.textAlign = 'center'; c.fillText('3', 0.51, -0.66); c.restore();
    // stuur + lamp
    c.strokeStyle = OUT; c.lineWidth = 0.09; c.beginPath(); c.moveTo(0.46, 0.62); c.lineTo(0.4, 0.82); c.lineTo(0.55, 0.84); c.stroke();
    c.strokeStyle = '#4b5560'; c.lineWidth = 0.05; c.stroke();
    c.fillStyle = '#fff6b0'; c.beginPath(); c.arc(0.64, 0.56, 0.06, 0, TAU); c.fill(); c.strokeStyle = OUT; c.lineWidth = 0.03; c.stroke();
    // remlicht
    c.fillStyle = '#ff2a2a'; c.fillRect(-0.98, 0.34, 0.05, 0.05);
  }

  drawVape(c, b, g, time) {
    // gouden vape, zwevend, met een kleine gloed eronder
    if (b.thrusting) {
      const gl = c.createRadialGradient(0, -0.4, 0.1, 0, -0.4, 1.4);
      gl.addColorStop(0, 'rgba(255,230,120,.55)'); gl.addColorStop(1, 'rgba(255,230,120,0)');
      c.fillStyle = gl; c.beginPath(); c.arc(0, -0.4, 1.4, 0, TAU); c.fill();
    }
    const gold = c.createLinearGradient(0, 0.3, 0, -0.2);
    gold.addColorStop(0, '#fff2a8'); gold.addColorStop(0.35, '#ffd23a'); gold.addColorStop(0.75, '#d99a12'); gold.addColorStop(1, '#8f5d08');
    c.strokeStyle = OUT; c.lineWidth = 0.05;
    // achterstuk
    c.fillStyle = gold;
    c.beginPath(); c.roundRect(-1.05, -0.22, 1.0, 0.5, 0.25); c.fill(); c.stroke();
    // glazen tank
    const glass = c.createLinearGradient(0, 0.3, 0, -0.2);
    glass.addColorStop(0, 'rgba(210,250,255,.95)'); glass.addColorStop(1, 'rgba(120,200,230,.85)');
    c.fillStyle = glass; c.beginPath(); c.roundRect(-0.1, -0.2, 0.7, 0.46, 0.08); c.fill(); c.stroke();
    c.fillStyle = 'rgba(180,90,255,.75)'; c.beginPath(); c.roundRect(-0.06, -0.17, 0.62 * (0.7 + 0.1 * Math.sin(time * 3)), 0.22, 0.05); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.0, 0.21); c.lineTo(0.45, 0.21); c.stroke();
    // mondstuk
    c.strokeStyle = OUT; c.lineWidth = 0.05; c.fillStyle = gold;
    c.beginPath(); c.moveTo(0.58, -0.2); c.lineTo(0.95, -0.12); c.quadraticCurveTo(1.12, 0.03, 0.95, 0.18); c.lineTo(0.58, 0.26); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#1c1c20'; c.beginPath(); c.ellipse(1.04, 0.03, 0.05, 0.1, 0, 0, TAU); c.fill();
    // ringen, knop, led, gravure
    c.strokeStyle = 'rgba(120,70,0,.7)'; c.lineWidth = 0.03;
    for (const x of [-0.8, -0.55, -0.3]) { c.beginPath(); c.moveTo(x, -0.2); c.lineTo(x, 0.26); c.stroke(); }
    c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 0.035;
    c.beginPath(); c.arc(-0.62, 0.03, 0.09, 0, TAU); c.fill(); c.stroke();
    c.fillStyle = b.thrusting ? '#ff4d4d' : '#6b2a2a'; c.beginPath(); c.arc(-0.62, 0.03, 0.045, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.65)'; c.lineWidth = 0.04; c.beginPath(); c.moveTo(-0.95, 0.2); c.lineTo(-0.2, 0.22); c.stroke();
    // sterretjes
    c.fillStyle = '#fff'; for (let i = 0; i < 2; i++) { const a = time * 3 + i * 2; c.globalAlpha = 0.5 + 0.5 * Math.sin(a * 2); c.beginPath(); c.arc(-0.9 + i * 1.4, 0.05 + 0.1 * Math.sin(a), 0.035, 0, TAU); c.fill(); }
    c.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- bestuurder
  rider(pose, ch, time, world, cc) {
    const { ctx, S } = this;
    const c = cc || ctx;
    if (world) {
      ctx.save();
      ctx.translate(this.sx(pose.x), this.sy(pose.y)); ctx.rotate(-pose.a); ctx.scale(S, -S);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      drawBody(ctx, pose, ch, time);
      ctx.restore();
    } else drawBody(c, pose, ch, time);
  }
}

// ---- IK: twee botten van A naar B, buig naar 'dir' (+1 of -1)
function ik(ax, ay, bx, by, l1, l2, dir) {
  let dx = bx - ax, dy = by - ay;
  let d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.001;
  if (d > max) { bx = ax + dx / d * max; by = ay + dy / d * max; dx = bx - ax; dy = by - ay; d = max; }
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  const mx = ax + dx * a / d, my = ay + dy * a / d;
  return [mx - dy * h / d * dir, my + dx * h / d * dir, bx, by];
}

const RIG = {
  fatbike: { hip: [-0.22, 0.5], hand: [0.4, 0.7], footF: null, torso: 0.5, crank: true },
  motor: { hip: [-0.28, 0.62], hand: [0.48, 0.86], foot: [0.0, -0.08], torso: 0.7 },
  vape: { hip: [-0.18, 0.78], hand: [0.52, 0.72], footR: [-0.5, 0.3], footF: [0.12, 0.3], torso: 0.45 },
};

// Zitpositie van de bestuurder op het voertuig (in lokale voertuigcoordinaten).
export function riderPose(b, g, time) {
  const rig = RIG[b.vid];
  const k = (g.rs = g.rs || { lean: 0 });
  const target = (g.input.gas ? 0.12 : 0) + (g.input.right ? 0.3 : 0) - (g.input.left ? 0.3 : 0) - (g.input.brake ? 0.2 : 0) + Math.max(-0.4, Math.min(0.4, -b.w * 0.05));
  k.lean += (target - k.lean) * 0.12;
  const bob = Math.sin(time * 18 + b.x) * 0.012 * Math.min(1, Math.abs(b.vx) / 8) * (b.air > 0.1 ? 0 : 1);
  const hip = [rig.hip[0], rig.hip[1] + bob];
  const ta = Math.PI / 2 - rig.torso - k.lean;
  const tl = 0.56;
  const sh = [hip[0] + Math.cos(ta) * tl, hip[1] + Math.sin(ta) * tl];
  const hd = [sh[0] + Math.cos(ta) * 0.2, sh[1] + Math.sin(ta) * 0.2];
  const head = [hd[0] + Math.cos(ta) * 0.13, hd[1] + Math.sin(ta) * 0.13];
  // voeten
  let footB, footF;
  if (b.vid === 'fatbike') {
    const cr = b.crank;
    footB = [-0.05 + Math.cos(cr + Math.PI) * 0.17, -0.28 + Math.sin(cr + Math.PI) * 0.17 + 0.06];
    footF = [-0.05 + Math.cos(cr) * 0.17, -0.28 + Math.sin(cr) * 0.17 + 0.06];
  } else if (b.vid === 'motor') { footB = [0.02, -0.05]; footF = [0.04, -0.05]; }
  else { footB = [rig.footR[0], rig.footR[1] + 0.0]; footF = [rig.footF[0], rig.footF[1]]; }
  const lerpPt = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  const hand = [rig.hand[0] + k.lean * 0.1, rig.hand[1]];
  return { x: b.x, y: b.y, a: b.a, hip, sh, head, hand, footB, footF, torsoA: ta, legs: true, mode: b.vid, speed: Math.abs(b.vx), vx: b.vx, k, ground: b.air < 0.05 };
}

function drawBody(c, p, ch, time) {
  const col = CHARS[ch] || CHARS.teun;
  const flutter = Math.sin(time * 25) * 0.04;
  const limp = p.limp;
  // achterste arm + been eerst
  const legs = (foot, shade) => {
    const [kx, ky, fx, fy] = limp ? [p.knee[shade ? 0 : 1][0], p.knee[shade ? 0 : 1][1], p.foot[shade ? 0 : 1][0], p.foot[shade ? 0 : 1][1]] : ik(p.hip[0], p.hip[1], foot[0], foot[1], 0.44, 0.44, 1);
    limb(c, [p.hip, [kx, ky], [fx, fy]], 0.17, shade ? col.pantsD : col.pants);
    shoe(c, fx, fy, col, shade, p.footA);
  };
  const arms = (back) => {
    const sx = p.sh[0] - (back ? 0.03 : 0), sy = p.sh[1] - (back ? 0.02 : 0.0);
    const [ex, ey, hx, hy] = limp ? [p.elb[back ? 0 : 1][0], p.elb[back ? 0 : 1][1], p.hnd[back ? 0 : 1][0], p.hnd[back ? 0 : 1][1]] : ik(sx, sy, p.hand[0] - (back ? 0.03 : 0), p.hand[1], 0.3, 0.3, -1);
    limb(c, [[sx, sy], [ex, ey], [hx, hy]], 0.12, back ? col.shirtD : col.shirt, col.sleeve);
    // hand
    c.fillStyle = col.skin; c.strokeStyle = OUT; c.lineWidth = 0.035; c.beginPath(); c.arc(hx, hy, 0.065, 0, TAU); c.fill(); c.stroke();
    if (!back && col.watches) {
      const ang = Math.atan2(hy - ey, hx - ex);
      c.save(); c.translate(hx - Math.cos(ang) * 0.1, hy - Math.sin(ang) * 0.1); c.rotate(ang);
      c.fillStyle = '#16181c'; c.fillRect(-0.02, -0.07, 0.05, 0.14);
      c.fillStyle = '#d8dde2'; c.fillRect(-0.085, -0.07, 0.05, 0.14);
      c.fillStyle = '#7ad0ff'; c.fillRect(-0.075, -0.045, 0.03, 0.09);
      c.restore();
    }
  };
  legs(p.footB, true); arms(true);
  // romp
  const tx = p.sh[0] - p.hip[0], ty = p.sh[1] - p.hip[1];
  const tl = Math.hypot(tx, ty), nx = -ty / tl, ny = tx / tl;
  c.fillStyle = col.shirt; c.strokeStyle = OUT; c.lineWidth = 0.045;
  c.beginPath();
  c.moveTo(p.hip[0] + nx * 0.17, p.hip[1] + ny * 0.17);
  c.quadraticCurveTo(p.hip[0] + tx * 0.5 + nx * 0.24, p.hip[1] + ty * 0.5 + ny * 0.24, p.sh[0] + nx * 0.17, p.sh[1] + ny * 0.17);
  c.lineTo(p.sh[0] - nx * 0.17, p.sh[1] - ny * 0.17);
  c.quadraticCurveTo(p.hip[0] + tx * 0.5 - nx * 0.22, p.hip[1] + ty * 0.5 - ny * 0.22, p.hip[0] - nx * 0.17, p.hip[1] - ny * 0.17);
  c.closePath(); c.fill(); c.stroke();
  if (col.stripe) {
    c.save(); c.clip();
    const cols = ['#ff3b3b', '#ff9a1f', '#ffe14a', '#3ed66a', '#3b8bff', '#a55bff'];
    for (let i = 0; i < 6; i++) { c.fillStyle = cols[i]; c.fillRect(p.hip[0] - 0.4 + i * 0.001, p.hip[1] + 0.06 + i * 0.07, 0.8, 0.07); }
    c.restore();
  } else if (col.logo) {
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(p.hip[0] + tx * 0.55 + nx * 0.02, p.hip[1] + ty * 0.55 + ny * 0.02, 0.07, 0, TAU); c.fill();
  }
  // broekriem
  c.fillStyle = col.pants; c.beginPath(); c.arc(p.hip[0], p.hip[1], 0.2, 0, TAU); c.fill(); c.stroke();
  legs(p.footF, false); arms(false);
  head(c, p, col, time, flutter);
}

function limb(c, pts, w, color, cuff) {
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.strokeStyle = OUT; c.lineWidth = w + 0.07; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); c.lineTo(pts[1][0], pts[1][1]); c.lineTo(pts[2][0], pts[2][1]); c.stroke();
  c.strokeStyle = color; c.lineWidth = w; c.stroke();
  if (cuff) {
    // bloot onderarm
    const [e, h] = [pts[1], pts[2]];
    c.strokeStyle = OUT; c.lineWidth = w * 0.72 + 0.07; c.beginPath(); c.moveTo(e[0] + (h[0] - e[0]) * 0.4, e[1] + (h[1] - e[1]) * 0.4); c.lineTo(h[0], h[1]); c.stroke();
    c.strokeStyle = cuff; c.lineWidth = w * 0.72; c.stroke();
  }
}
function shoe(c, x, y, col, shade, ang = 0) {
  c.save(); c.translate(x, y); c.rotate(ang);
  c.fillStyle = shade ? col.shoeD : col.shoe; c.strokeStyle = OUT; c.lineWidth = 0.04;
  c.beginPath(); c.moveTo(-0.1, 0.07); c.lineTo(0.08, 0.07); c.quadraticCurveTo(0.24, 0.05, 0.25, -0.05); c.lineTo(0.2, -0.1); c.lineTo(-0.1, -0.1); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#fff'; c.fillRect(-0.1, -0.1, 0.3, 0.05);
  if (col.stripes) { c.strokeStyle = '#fff'; c.lineWidth = 0.025; for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(-0.04 + i * 0.06, 0.06); c.lineTo(0.0 + i * 0.06, -0.05); c.stroke(); } }
  c.restore();
}

function head(c, p, col, time, flutter) {
  const [hx, hy] = p.head;
  const a = p.torsoA - Math.PI / 2 + (p.headTilt || 0);
  c.save(); c.translate(hx, hy); c.rotate(a);
  const wind = Math.min(1, (p.speed || 0) / 12);
  // achterhaar / lang haar
  if (col.longHair) {
    c.fillStyle = col.hair; c.strokeStyle = OUT; c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(0.0, 0.2); c.quadraticCurveTo(-0.3 - wind * 0.35, 0.24 + flutter, -0.42 - wind * 0.5, 0.02 + flutter * 2); c.quadraticCurveTo(-0.3 - wind * 0.3, -0.1, -0.08, -0.12); c.closePath(); c.fill(); c.stroke();
  }
  // hoofd
  const sk = c.createRadialGradient(0.05, 0.08, 0.03, 0, 0, 0.3);
  sk.addColorStop(0, col.skinL); sk.addColorStop(1, col.skin);
  c.fillStyle = sk; c.strokeStyle = OUT; c.lineWidth = 0.045;
  c.beginPath(); c.ellipse(0, 0, 0.26, 0.28, 0, 0, TAU); c.fill(); c.stroke();
  // oor
  c.fillStyle = col.skin; c.beginPath(); c.ellipse(-0.1, -0.02, 0.07, 0.1, 0.2, 0, TAU); c.fill(); c.stroke();
  // haar
  if (col.hairStyle) {
    c.fillStyle = col.hair; c.beginPath();
    if (col.hairStyle === 'short') { c.moveTo(-0.26, 0.04); c.quadraticCurveTo(-0.28, 0.32, 0.02, 0.32); c.quadraticCurveTo(0.26, 0.3, 0.27, 0.1); c.quadraticCurveTo(0.12, 0.2, -0.02, 0.14); c.quadraticCurveTo(-0.14, 0.2, -0.26, 0.04); }
    else { c.moveTo(-0.27, 0.0); c.quadraticCurveTo(-0.3, 0.34, 0.04, 0.34); c.quadraticCurveTo(0.28, 0.3, 0.27, 0.06); c.quadraticCurveTo(0.2, 0.2, 0.08, 0.15); c.quadraticCurveTo(-0.06, 0.24, -0.27, 0.0); }
    c.closePath(); c.fill(); c.stroke();
  }
  // gezicht
  const ex = 0.1;
  c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 0.03;
  c.beginPath(); c.ellipse(ex, 0.05, 0.07, 0.075, 0, 0, TAU); c.fill(); c.stroke();
  c.fillStyle = '#1a1210'; c.beginPath(); c.arc(ex + 0.025, 0.05, 0.035, 0, TAU); c.fill();
  c.strokeStyle = OUT; c.lineWidth = 0.035; c.beginPath(); c.moveTo(ex - 0.08, 0.15); c.lineTo(ex + 0.08, 0.17); c.stroke(); // wenkbrauw
  c.fillStyle = col.skin; c.beginPath(); c.moveTo(0.22, 0.0); c.lineTo(0.31, -0.04); c.lineTo(0.22, -0.08); c.closePath(); c.fill(); c.stroke(); // neus
  c.strokeStyle = '#7a2c1c'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.08, -0.14); c.quadraticCurveTo(0.17, -0.19, 0.24, -0.12); c.stroke(); // mond
  if (col.glasses) {
    c.strokeStyle = col.glasses; c.lineWidth = col.thin ? 0.03 : 0.05;
    c.beginPath(); c.arc(ex, 0.05, 0.105, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(ex - 0.1, 0.07); c.lineTo(-0.2, 0.09); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(ex - 0.04, 0.09, 0.025, 0, TAU); c.fill();
  }
  // hoed
  if (col.hat) {
    const tip = [-0.55 - wind * 0.5, 0.78 - wind * 0.5 + flutter * 3];
    const g = c.createLinearGradient(0, 0.2, -0.4, 0.9);
    if (col.rainbow) { const cols = ['#ff3b3b', '#ff9a1f', '#ffe14a', '#3ed66a', '#3b8bff', '#a55bff']; for (let i = 0; i < 6; i++) g.addColorStop(i / 5, cols[(i + Math.floor(time * 3)) % 6]); }
    else { g.addColorStop(0, '#ff5a52'); g.addColorStop(1, '#b3121c'); }
    c.fillStyle = g; c.strokeStyle = OUT; c.lineWidth = 0.05;
    c.beginPath(); c.moveTo(0.27, 0.1); c.quadraticCurveTo(0.3, 0.46, -0.05, 0.62); c.quadraticCurveTo(tip[0] * 0.6, tip[1] * 0.9, tip[0], tip[1]); c.quadraticCurveTo(-0.5, 0.35, -0.28, 0.16); c.quadraticCurveTo(0.0, 0.26, 0.27, 0.1); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = col.rainbow ? '#fff' : '#fff'; c.beginPath(); c.arc(tip[0], tip[1], 0.06, 0, TAU); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 0.03; c.beginPath(); c.moveTo(0.1, 0.4); c.quadraticCurveTo(-0.1, 0.5, -0.25, 0.58); c.stroke();
    // band
    c.fillStyle = col.rainbow ? '#ffe14a' : '#8f0d16'; c.strokeStyle = OUT; c.lineWidth = 0.04;
    c.beginPath(); c.moveTo(-0.28, 0.16); c.quadraticCurveTo(0.0, 0.27, 0.27, 0.1); c.lineTo(0.28, 0.17); c.quadraticCurveTo(0.0, 0.34, -0.3, 0.23); c.closePath(); c.fill(); c.stroke();
  }
  if (col.sparkle) { c.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { const t = time * 4 + i * 2.1; c.globalAlpha = Math.max(0, Math.sin(t)); c.beginPath(); c.arc(Math.cos(i * 2) * 0.2, Math.sin(i * 3) * 0.2 + 0.05, 0.03, 0, TAU); c.fill(); } c.globalAlpha = 1; }
  c.restore();
}

export const CHARS = {
  teun: { id: 'teun', name: 'Te-Un', skin: '#efb18d', skinL: '#ffd3b5', hair: '#4a2f1f', shirt: '#2f6fe0', shirtD: '#1f4db4', sleeve: '#efb18d', pants: '#1d1d24', pantsD: '#101015', shoe: '#2f6fe0', shoeD: '#1f4db4', stripes: true, hat: true, glasses: '#0b0b0d', logo: true, hairStyle: 'short' },
  orange: { id: 'orange', name: 'Oranje shirt', skin: '#e7a67f', skinL: '#f8cba7', hair: '#101012', shirt: '#ff7a1a', shirtD: '#d85f0a', sleeve: '#e7a67f', pants: '#2a2b33', pantsD: '#18181d', shoe: '#f4f4f4', shoeD: '#cfcfcf', longHair: true, hairStyle: 'long', watches: true },
  green: { id: 'green', name: 'Groene bril', skin: '#f0b996', skinL: '#ffd9bd', hair: '#e8741c', shirt: '#2fa64a', shirtD: '#1f7c35', sleeve: '#f0b996', pants: '#283454', pantsD: '#161d33', shoe: '#ffffff', shoeD: '#cfd8cf', hairStyle: 'short', glasses: '#14110f', thin: true },
  gold: { id: 'gold', name: 'Gouden regenboog Te-Un', skin: '#ffd76a', skinL: '#fff2b0', hair: '#c98a14', shirt: '#ffcc33', shirtD: '#d49a10', sleeve: '#ffd76a', pants: '#e0a21a', pantsD: '#b87d0c', shoe: '#ffe27a', shoeD: '#d9a92e', stripes: true, hat: true, rainbow: true, glasses: '#7a4d00', stripe: true, sparkle: true, hairStyle: 'short' },
};
export const CHAR_ORDER = ['teun', 'orange', 'green', 'gold'];

// ---- uitgeschakelde bestuurder (na een crash)
export function limpPose(r, time) {
  const w = Math.sin(time * 7 + r.seed) * 0.5, w2 = Math.cos(time * 6 + r.seed) * 0.5;
  const hip = [0, 0], sh = [0, 0.56];
  return {
    x: r.x, y: r.y, a: r.ang, hip, sh, head: [0.0, 0.89], torsoA: Math.PI / 2, limp: true, speed: 0, headTilt: 0,
    knee: [[0.18 + w * 0.2, -0.36], [-0.2 + w2 * 0.2, -0.38]], foot: [[0.38 + w * 0.3, -0.7], [-0.36 + w2 * 0.3, -0.72]],
    elb: [[0.34 + w2 * 0.2, 0.62 + w * 0.1], [-0.34 + w * 0.2, 0.6 + w2 * 0.1]], hnd: [[0.58 + w2 * 0.3, 0.48 + w * 0.2], [-0.55 + w * 0.3, 0.46 + w2 * 0.2]],
    hand: [0, 0], footB: [0, 0], footF: [0, 0], footA: 0,
  };
}
