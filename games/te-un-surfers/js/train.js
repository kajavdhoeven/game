import * as THREE from 'three';
import { canvasTex, rng } from './textures.js';
import { mergeStatic } from './merge.js';

const NS_YELLOW = '#ffc917';
const NS_BLUE = '#003082';
const Y0 = 0.5; // onderkant carrosserie

// Alle treintypes. weight = kans om te verschijnen. special = "bijzondere trein" (spotters worden enthousiast).
export const TRAIN_TYPES = {
  sprinter: {
    label: 'NS Sprinter', len: 15, W: 2.6, H: 3.6, body: NS_YELLOW, skirt: NS_BLUE, doors: '#26467f', roof: '#c9cdd1',
    logo: 'blue', nose: { len: 1.5, sx: 0.1, sy: 0.06 }, number: 'SNG 2214', weight: 3, pantograph: true,
  },
  sprinter_gr: {
    label: 'Sprinter met graffiti', len: 15, W: 2.6, H: 3.6, body: NS_YELLOW, skirt: NS_BLUE, doors: '#26467f', roof: '#c9cdd1',
    logo: 'blue', nose: { len: 1.5, sx: 0.1, sy: 0.06 }, number: 'SNG 2236', graffiti: 11, special: true, weight: 1.3, pantograph: true,
  },
  sprinter_st: {
    label: 'Sprinter met stickers', len: 15, W: 2.6, H: 3.6, body: NS_YELLOW, skirt: NS_BLUE, doors: '#26467f', roof: '#c9cdd1',
    logo: 'blue', nose: { len: 1.5, sx: 0.1, sy: 0.06 }, number: 'SNG 2301', stickers: 5, weight: 1, pantograph: true,
  },
  intercity: {
    label: 'NS Intercity', len: 18, W: 2.8, H: 3.8, body: '#1c4fa8', skirt: '#0f2f66', doors: NS_YELLOW, roof: '#b9bfc6',
    logo: 'white', nose: { len: 2.2, sx: 0.16, sy: 0.09 }, number: 'ICM 4012', stripe: NS_YELLOW, weight: 2.4, pantograph: true,
  },
  intercity_gr: {
    label: 'Intercity met graffiti', len: 18, W: 2.8, H: 3.8, body: '#1c4fa8', skirt: '#0f2f66', doors: NS_YELLOW, roof: '#b9bfc6',
    logo: 'white', nose: { len: 2.2, sx: 0.16, sy: 0.09 }, number: 'ICM 4047', stripe: NS_YELLOW, graffiti: 23, special: true, weight: 1, pantograph: true,
  },
  international: {
    label: 'Internationale hogesnelheidstrein', len: 19, W: 2.9, H: 3.9, body: '#eef0f3', skirt: '#c8102e', doors: '#c8102e', roof: '#aab0b8',
    logo: 'none', nose: { len: 3.4, sx: 0.3, sy: 0.2 }, number: 'EU 9001', stripe: '#c8102e', brand: 'EURO EXPRESS', special: true, weight: 1.3, pantograph: true,
  },
  vintage: {
    label: 'Vintage materieel', len: 14, W: 2.7, H: 3.5, body: '#b8bdc3', skirt: '#8b9097', doors: '#9aa0a8', roof: '#7d838a',
    logo: 'none', nose: { len: 1.0, sx: 0.04, sy: 0.03 }, number: 'MAT 1964', stripe: '#e8710a', ribs: true, special: true, weight: 0.9, pantograph: false,
  },
  loco: {
    label: 'Locomotief', len: 15, W: 2.9, H: 3.7, body: '#2c3946', skirt: '#1b232c', doors: '#ffcc00', roof: '#59626d',
    logo: 'none', nose: { len: 0.6, sx: 0.02, sy: 0.02 }, number: 'CARGO 6401', stripe: '#ffcc00', loco: true, pantograph: true,
  },
};
export const TRAIN_KEYS = ['sprinter', 'sprinter_gr', 'sprinter_st', 'intercity', 'intercity_gr', 'international', 'vintage', 'freight'];
export const TRAIN_WEIGHTS = { ...Object.fromEntries(Object.entries(TRAIN_TYPES).map(([k, v]) => [k, v.weight || 0])), freight: 1.4 };

// ------------------------------------------------------------------ geometrie
function profile(W, H, R, RV) {
  const pts = [];
  const hw = W / 2;
  pts.push([-hw, Y0]);
  pts.push([-hw, H - RV]);
  const seg = 9;
  for (let i = 1; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push([-hw + R - R * Math.cos(a), H - RV + RV * Math.sin(a)]);
  }
  for (let i = seg - 1; i >= 0; i--) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push([hw - R + R * Math.cos(a), H - RV + RV * Math.sin(a)]);
  }
  pts.push([hw, Y0]);
  return pts;
}

function buildBody(cfg) {
  const { W, H, len } = cfg;
  const R = Math.min(0.85, W * 0.31);
  const RV = 0.62;
  const P = profile(W, H, R, RV);
  const NP = P.length;
  const hl = len / 2;
  const nl = cfg.nose.len;
  const zs = [{ z: -hl, t: 0 }, { z: hl - nl, t: 0 }];
  for (let i = 1; i <= 6; i++) zs.push({ z: hl - nl + nl * (i / 6), t: i / 6 });
  const pos = [];
  const uv = [];
  const idx = [];
  const nz = (t) => ({ sx: 1 - cfg.nose.sx * Math.pow(t, 1.6), sy: 1 - cfg.nose.sy * Math.pow(t, 1.6) });
  zs.forEach(({ z, t }) => {
    const { sx, sy } = nz(t);
    P.forEach(([x, y]) => {
      const yy = Y0 + (y - Y0) * sy;
      pos.push(x * sx, yy, z);
      const u = x >= 0 ? 0.5 - z / len : 0.5 + z / len;
      uv.push(u, yy / H);
    });
  });
  for (let k = 0; k < zs.length - 1; k++) {
    for (let i = 0; i < NP - 1; i++) {
      const a = k * NP + i;
      const b = a + 1;
      const c = a + NP;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const t1 = nz(1);
  const frontPts = P.map(([x, y]) => [x * t1.sx, Y0 + (y - Y0) * t1.sy]);
  const shape = new THREE.Shape(frontPts.map(([x, y]) => new THREE.Vector2(x, y)));
  const frontGeo = new THREE.ShapeGeometry(shape);
  const fp = frontGeo.attributes.position;
  const fuv = frontGeo.attributes.uv;
  for (let i = 0; i < fp.count; i++) fuv.setXY(i, fp.getX(i) / (W * t1.sx) + 0.5, fp.getY(i) / H);
  return { geo, frontGeo };
}

// ------------------------------------------------------------------ textures
function layout(L) {
  const dL = L * 0.21;
  return {
    doors: [dL, L - dL],
    windows: [[0.8, dL - 0.85], [dL + 0.85, L / 2 - 0.4], [L / 2 + 0.4, L - dL - 0.85], [L - dL + 0.85, L - 0.8]],
  };
}

function logoBox(g, x, y, w, h, style) {
  g.save();
  g.fillStyle = style === 'white' ? '#ffffff' : NS_BLUE;
  g.beginPath();
  g.roundRect(x, y, w, h, h * 0.12);
  g.fill();
  g.fillStyle = style === 'white' ? NS_BLUE : '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `italic 900 ${h * 0.78}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  g.fillText('NS', x + w / 2, y + h * 0.54);
  g.restore();
}

const TAGS = ['TEUN', 'KABOUTER', 'RAIL', 'FUNK', 'ZOOM', 'NEON', 'WILD', 'GNOME', 'LIVE', 'DUTCH', 'CREW', 'SPOT'];
const SPRAY = ['#ff2d95', '#19e3ff', '#7cff3a', '#ffe600', '#ff7b00', '#9d4dff', '#ffffff', '#ff3b30'];

function drawGraffiti(g, X, Y, L, seed) {
  const r = rng(seed);
  const pieces = 3;
  for (let i = 0; i < pieces; i++) {
    const word = TAGS[(r() * TAGS.length) | 0];
    const size = 170 + r() * 80;
    const x0 = X(L * (0.06 + i * 0.3 + r() * 0.05));
    const y0 = Y(1.0 + r() * 0.9);
    g.save();
    g.translate(x0, y0);
    g.rotate((r() - 0.5) * 0.18);
    g.font = `italic 900 ${size}px Impact, "Arial Black", sans-serif`;
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'round';
    const c1 = SPRAY[(r() * SPRAY.length) | 0];
    const c2 = SPRAY[(r() * SPRAY.length) | 0];
    const w = g.measureText(word).width;
    // schaduw, zwarte rand, kleurverloop, glans
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillText(word, 10, 10);
    g.strokeStyle = '#0a0a0a';
    g.lineWidth = 22;
    g.strokeText(word, 0, 0);
    const gr = g.createLinearGradient(0, -size, 0, 0);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.fillText(word, 0, 0);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 3;
    g.strokeText(word, -3, -4);
    // druipers
    g.fillStyle = c2;
    for (let k = 0; k < 6; k++) {
      const dx = r() * w;
      const len = 14 + r() * 50;
      g.fillRect(dx, 6, 5, len);
      g.beginPath();
      g.arc(dx + 2.5, 6 + len, 5, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
  }
  // kleine tags en spatters
  for (let i = 0; i < 6; i++) {
    g.save();
    g.translate(X(r() * L), Y(0.9 + r() * 1.3));
    g.rotate((r() - 0.5) * 0.6);
    g.fillStyle = SPRAY[(r() * SPRAY.length) | 0];
    g.font = `700 ${40 + r() * 30}px "Brush Script MT", cursive`;
    g.fillText(TAGS[(r() * TAGS.length) | 0].toLowerCase(), 0, 0);
    g.restore();
  }
  for (let i = 0; i < 220; i++) {
    g.fillStyle = SPRAY[(r() * SPRAY.length) | 0];
    g.globalAlpha = 0.5;
    g.beginPath();
    g.arc(r() * X(L), Y(0.6 + r() * 1.4), 1 + r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
}

function drawStickers(g, X, Y, L, seed, n) {
  const r = rng(seed);
  for (let i = 0; i < n * 3; i++) {
    const x = X(r() * L);
    const y = Y(0.7 + r() * 2.3);
    const rad = 26 + r() * 24;
    const kind = (r() * 4) | 0;
    g.save();
    g.translate(x, y);
    g.rotate((r() - 0.5) * 0.8);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(0, 0, rad + 4, 0, Math.PI * 2);
    g.fill();
    if (kind === 0) {
      g.fillStyle = '#ffd400';
      g.beginPath();
      g.arc(0, 0, rad, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111';
      g.beginPath();
      g.arc(-rad * 0.35, -rad * 0.2, rad * 0.12, 0, 7);
      g.arc(rad * 0.35, -rad * 0.2, rad * 0.12, 0, 7);
      g.fill();
      g.strokeStyle = '#111';
      g.lineWidth = 4;
      g.beginPath();
      g.arc(0, rad * 0.05, rad * 0.5, 0.2, Math.PI - 0.2);
      g.stroke();
    } else if (kind === 1) {
      // mini-kabouter: rood puntmutsje, witte baard
      g.fillStyle = '#f1c4a0';
      g.beginPath();
      g.arc(0, rad * 0.15, rad * 0.8, 0, 7);
      g.fill();
      g.fillStyle = '#d3202a';
      g.beginPath();
      g.moveTo(-rad * 0.8, -rad * 0.1);
      g.lineTo(0, -rad * 1.1);
      g.lineTo(rad * 0.8, -rad * 0.1);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.moveTo(-rad * 0.7, rad * 0.2);
      g.lineTo(0, rad * 0.95);
      g.lineTo(rad * 0.7, rad * 0.2);
      g.fill();
      g.strokeStyle = '#000';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(-rad * 0.28, 0, rad * 0.18, 0, 7);
      g.arc(rad * 0.28, 0, rad * 0.18, 0, 7);
      g.stroke();
    } else if (kind === 2) {
      g.fillStyle = SPRAY[(r() * SPRAY.length) | 0];
      g.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const rr = k % 2 ? rad * 0.45 : rad;
        g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      g.fill();
    } else {
      g.fillStyle = '#e8105a';
      g.beginPath();
      g.arc(0, 0, rad, 0, 7);
      g.fill();
      g.fillStyle = '#fff';
      g.font = `900 ${rad * 0.8}px "Arial Black", sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(['LOL', 'NS', '<3', 'OK'][(r() * 4) | 0], 0, 2);
    }
    g.restore();
  }
}

function sideTexture(cfg) {
  const W = 2048;
  const H = 512;
  const L = cfg.len;
  const CH = cfg.H;
  return canvasTex(W, H, (g) => {
    const X = (m) => (m / L) * W;
    const Y = (m) => (1 - m / CH) * H;
    const r = rng(7);
    const roofY = CH - 0.55;
    g.fillStyle = cfg.body;
    g.fillRect(0, 0, W, H);
    // dak
    const roofG = g.createLinearGradient(0, Y(CH), 0, Y(roofY));
    roofG.addColorStop(0, cfg.roof);
    roofG.addColorStop(1, cfg.roof);
    g.fillStyle = roofG;
    g.fillRect(0, Y(CH), W, Y(roofY) - Y(CH));
    // lichtval
    const gl = g.createLinearGradient(0, Y(roofY), 0, Y(0.5));
    gl.addColorStop(0, 'rgba(255,255,255,0.16)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    gl.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gl;
    g.fillRect(0, Y(roofY), W, Y(0.5) - Y(roofY));
    // ribbels (vintage)
    if (cfg.ribs) {
      g.fillStyle = 'rgba(0,0,0,0.13)';
      for (let x = 0; x < W; x += 14) g.fillRect(x, Y(roofY), 3, Y(0.5) - Y(roofY));
    }
    // onderband
    g.fillStyle = cfg.skirt;
    g.fillRect(0, Y(1.0), W, Y(0.5) - Y(1.0));
    g.fillStyle = '#e6e8ea';
    g.fillRect(0, Y(1.04), W, 4);
    if (cfg.stripe) {
      g.fillStyle = cfg.stripe;
      g.fillRect(0, Y(1.45), W, Y(1.2) - Y(1.45));
    }

    const lay = layout(L);
    if (cfg.loco) {
      // locomotief: ventilatieroosters, gele waarschuwingsband en cabinevensters aan beide uiteinden
      g.fillStyle = '#1a2129';
      for (let i = 0; i < 5; i++) {
        const x0 = X(3.2 + i * 1.7);
        for (let k = 0; k < 14; k++) g.fillRect(x0, Y(3.0) + k * 14, X(1.2), 6);
      }
      g.fillStyle = '#ffcc00';
      for (let x = 0; x < W; x += 80) {
        g.beginPath();
        g.moveTo(x, Y(0.5));
        g.lineTo(x + 40, Y(0.5));
        g.lineTo(x + 60, Y(1.0));
        g.lineTo(x + 20, Y(1.0));
        g.fill();
      }
    }

    // graffiti of stickers komen onder de ramen
    if (cfg.graffiti) drawGraffiti(g, X, Y, L, cfg.graffiti);
    if (cfg.stickers) drawStickers(g, X, Y, L, 99, cfg.stickers);

    const drawGlass = (x0, x1, y0, y1, round = 14) => {
      const gx = X(x0);
      const gy = Y(y1);
      const gw = X(x1) - X(x0);
      const gh = Y(y0) - Y(y1);
      g.fillStyle = cfg.ribs ? '#d8dde2' : '#0a0d12';
      g.beginPath();
      g.roundRect(gx - 4, gy - 4, gw + 8, gh + 8, round + 2);
      g.fill();
      const gr = g.createLinearGradient(0, gy, 0, gy + gh);
      gr.addColorStop(0, '#2b3f57');
      gr.addColorStop(0.55, '#121c28');
      gr.addColorStop(1, '#0b1118');
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(gx, gy, gw, gh, round);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath();
      g.moveTo(gx + gw * 0.1, gy + gh);
      g.lineTo(gx + gw * 0.3, gy);
      g.lineTo(gx + gw * 0.42, gy);
      g.lineTo(gx + gw * 0.22, gy + gh);
      g.fill();
      g.restore();
    };
    const wy0 = cfg.ribs ? 1.9 : 1.75;
    const wy1 = CH - 0.65;
    if (cfg.loco) {
      drawGlass(0.6, 1.9, 2.0, 3.1);
      drawGlass(L - 1.9, L - 0.6, 2.0, 3.1);
    } else {
      lay.windows.forEach(([a, b]) => drawGlass(a, b, wy0, wy1));
      // deuren
      lay.doors.forEach((c) => {
        g.fillStyle = cfg.doors;
        g.beginPath();
        g.roundRect(X(c - 0.75), Y(roofY), X(c + 0.75) - X(c - 0.75), Y(0.52) - Y(roofY), 10);
        g.fill();
        g.strokeStyle = 'rgba(0,0,0,0.5)';
        g.lineWidth = 3;
        g.stroke();
        g.beginPath();
        g.moveTo(X(c), Y(roofY - 0.1));
        g.lineTo(X(c), Y(0.6));
        g.stroke();
        drawGlass(c - 0.62, c - 0.04, wy0, wy1 - 0.05);
        drawGlass(c + 0.04, c + 0.62, wy0, wy1 - 0.05);
        g.fillStyle = '#3fc16b';
        g.beginPath();
        g.arc(X(c + 0.72), Y(1.5), 7, 0, Math.PI * 2);
        g.fill();
      });
    }

    // logo's en tekst
    if (cfg.logo !== 'none') {
      logoBox(g, X(L / 2 - 0.8), Y(1.65), X(1.6), Y(1.1) - Y(1.65), cfg.logo);
      logoBox(g, X(1.0), Y(1.6), X(0.9), Y(1.15) - Y(1.6), cfg.logo);
      logoBox(g, X(L - 1.9), Y(1.6), X(0.9), Y(1.15) - Y(1.6), cfg.logo);
    }
    if (cfg.brand) {
      g.fillStyle = '#1c2230';
      g.font = 'italic 800 70px "Arial Black", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(cfg.brand, X(L / 2), Y(1.35));
    }
    g.fillStyle = '#ffffff';
    g.font = '700 30px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(cfg.number, X(L * 0.36), Y(0.75));

    // vuil en regenstrepen
    for (let i = 0; i < 160; i++) {
      const x = r() * W;
      const y0 = Y(CH - 0.7) + r() * 40;
      const len = 40 + r() * 160;
      const gr = g.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, 'rgba(40,30,10,0.10)');
      gr.addColorStop(1, 'rgba(40,30,10,0)');
      g.fillStyle = gr;
      g.fillRect(x, y0, 2 + r() * 3, len);
    }
    const dirt = g.createLinearGradient(0, Y(1.2), 0, Y(0.5));
    dirt.addColorStop(0, 'rgba(30,25,15,0)');
    dirt.addColorStop(1, 'rgba(30,25,15,0.35)');
    g.fillStyle = dirt;
    g.fillRect(0, Y(1.2), W, Y(0.5) - Y(1.2));
  }, { aniso: 16 });
}

function frontTexture(cfg) {
  const S = 512;
  const { W, H } = cfg;
  return canvasTex(S, S, (g) => {
    const X = (m) => (m / W) * S;
    const Y = (m) => (1 - m / H) * S;
    g.fillStyle = cfg.body;
    g.fillRect(0, 0, S, S);
    g.fillStyle = cfg.roof;
    g.fillRect(0, 0, S, Y(H - 0.5));
    g.fillStyle = cfg.skirt;
    g.fillRect(0, Y(1.0), S, Y(0.5) - Y(1.0));
    if (cfg.stripe) {
      g.fillStyle = cfg.stripe;
      g.fillRect(0, Y(1.45), S, Y(1.2) - Y(1.45));
    }
    if (cfg.loco) {
      g.fillStyle = '#ffcc00';
      for (let x = 0; x < S; x += 60) {
        g.beginPath();
        g.moveTo(x, Y(0.5));
        g.lineTo(x + 30, Y(0.5));
        g.lineTo(x + 45, Y(1.0));
        g.lineTo(x + 15, Y(1.0));
        g.fill();
      }
    }
    // bestemmingsdisplay
    g.fillStyle = '#05070a';
    g.beginPath();
    g.roundRect(X(W * 0.17), Y(H - 0.5), X(W * 0.83) - X(W * 0.17), Y(H - 0.78) - Y(H - 0.5), 8);
    g.fill();
    g.fillStyle = '#ffb347';
    g.font = '700 18px "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(cfg.loco ? 'CARGO EXTRA' : cfg.brand ? 'EURO EXPRESS' : 'TE-UN CENTRAAL', X(W / 2), Y(H - 0.64));
    // voorruit
    const top = H - 0.85;
    const bot = cfg.loco ? 1.9 : 1.55;
    const wx0 = W * 0.11;
    const wx1 = W * 0.89;
    g.fillStyle = '#080b0f';
    g.beginPath();
    g.roundRect(X(wx0), Y(top), X(wx1) - X(wx0), Y(bot) - Y(top), 26);
    g.fill();
    const gr = g.createLinearGradient(0, Y(top), 0, Y(bot));
    gr.addColorStop(0, '#34506f');
    gr.addColorStop(0.5, '#141f2c');
    gr.addColorStop(1, '#0a1017');
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(X(wx0 + 0.06), Y(top - 0.06), X(wx1 - 0.06) - X(wx0 + 0.06), Y(bot + 0.06) - Y(top - 0.06), 22);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.moveTo(X(W * 0.2), Y(bot));
    g.lineTo(X(W * 0.42), Y(top));
    g.lineTo(X(W * 0.5), Y(top));
    g.lineTo(X(W * 0.28), Y(bot));
    g.fill();
    g.restore();
    g.strokeStyle = '#111';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(X(W * 0.35), Y(bot + 0.08));
    g.lineTo(X(W * 0.58), Y(bot + 0.55));
    g.moveTo(X(W * 0.65), Y(bot + 0.08));
    g.lineTo(X(W * 0.85), Y(bot + 0.6));
    g.stroke();
    if (cfg.logo !== 'none') logoBox(g, X(W * 0.36), Y(1.42), X(W * 0.28), Y(1.0) - Y(1.42), cfg.logo);
    g.fillStyle = '#d8dadc';
    [W * 0.16, W * 0.84].forEach((x) => {
      g.beginPath();
      g.arc(X(x), Y(0.78), 20, 0, Math.PI * 2);
      g.fill();
    });
  }, { aniso: 16 });
}

// ------------------------------------------------------------------ gedeelde delen
let SH = null;
function shared() {
  if (SH) return SH;
  const mk = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });
  const glowTex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,248,220,1)');
    gr.addColorStop(0.3, 'rgba(255,240,190,0.5)');
    gr.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  SH = {
    dark: mk('#17191c', { roughness: 0.85, metalness: 0.4 }),
    steel: mk('#6c7076', { roughness: 0.35, metalness: 0.9 }),
    rubber: mk('#0e0e10', { roughness: 0.95 }),
    back: mk('#d9a912', { roughness: 0.6 }),
    lampMat: new THREE.MeshBasicMaterial({ color: '#fffbe8', toneMapped: false }),
    redLamp: new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false }),
    glowMat: new THREE.SpriteMaterial({
      map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, fog: false,
    }),
    wheel: new THREE.CylinderGeometry(0.46, 0.46, 0.1, 20).rotateZ(Math.PI / 2),
    box: new THREE.BoxGeometry(1, 1, 1),
    disc: new THREE.CircleGeometry(0.11, 18),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
    cache: new Map(),
    wood: mk('#8a5f35', { roughness: 0.8 }),
  };
  return SH;
}

function box(s, mat, w, h, d, x, y, z, parent) {
  const m = new THREE.Mesh(s.box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function typeAssets(key) {
  const s = shared();
  let a = s.cache.get(key);
  if (a) return a;
  const cfg = TRAIN_TYPES[key];
  const { geo, frontGeo } = buildBody(cfg);
  const mat = (map) => new THREE.MeshPhysicalMaterial({
    map, roughness: 0.42, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.5,
  });
  a = {
    cfg, geo, frontGeo,
    bodyMat: mat(sideTexture(cfg)),
    frontMat: mat(frontTexture(cfg)),
    roofGrey: new THREE.MeshStandardMaterial({ color: cfg.roof, roughness: 0.6, metalness: 0.3 }),
  };
  s.cache.set(key, a);
  return a;
}

function buildCar(key) {
  const s = shared();
  const a = typeAssets(key);
  const { cfg } = a;
  const L = cfg.len;
  const car = new THREE.Group();
  const body = new THREE.Mesh(a.geo, a.bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  car.add(body);
  const front = new THREE.Mesh(a.frontGeo, a.frontMat);
  front.position.z = L / 2;
  car.add(front);
  const rear = new THREE.Mesh(a.frontGeo, s.back);
  rear.position.z = -L / 2;
  rear.rotation.y = Math.PI;
  car.add(rear);

  // onderstel en draaistellen
  box(s, s.dark, cfg.W - 0.5, 0.35, L - 2.5, 0, 0.42, 0, car);
  [-1, 1].forEach((side) => {
    const bz = side * L * 0.3;
    box(s, s.dark, 2.0, 0.22, 2.7, 0, 0.62, bz, car);
    [-1, 1].forEach((ws) => {
      [-1, 1].forEach((rs) => {
        const w = new THREE.Mesh(s.wheel, s.steel);
        w.position.set(rs * 0.72, 0.5, bz + ws * 0.95);
        car.add(w);
      });
      box(s, s.steel, 1.5, 0.1, 0.1, 0, 0.5, bz + ws * 0.95, car);
    });
  });

  // dakopbouw
  const H = cfg.H;
  [-L * 0.23, L * 0.17].forEach((z) => box(s, a.roofGrey, 1.5, 0.22, 2.6, 0, H + 0.1, z, car));
  box(s, a.roofGrey, 1.0, 0.15, 1.2, 0, H + 0.08, L * 0.34, car);
  if (cfg.pantograph) {
    const pz = -0.4;
    [-0.5, 0.5].forEach((x) => box(s, s.dark, 0.1, 0.25, 0.1, x, H + 0.12, pz, car));
    const arm1 = box(s, s.steel, 0.07, 0.07, 1.2, 0, H + 0.55, pz + 0.3, car);
    arm1.rotation.x = 0.8;
    const arm2 = box(s, s.steel, 0.07, 0.07, 1.2, 0, H + 0.55, pz - 0.35, car);
    arm2.rotation.x = -0.8;
    box(s, s.steel, 1.5, 0.05, 0.12, 0, H + 1.0, pz, car);
  }
  box(s, s.dark, 0.5, 0.3, 0.3, 0, 0.7, L / 2 + 0.15, car);
  mergeStatic(car);
  return car;
}

function addLamps(car, cfg) {
  const s = shared();
  const L = cfg.len;
  [-1, 1].forEach((sd) => {
    const x = sd * cfg.W * 0.37;
    const l = new THREE.Mesh(s.disc, s.lampMat);
    l.position.set(x, 0.8, L / 2 + 0.02);
    car.add(l);
    const sp = new THREE.Sprite(s.glowMat);
    sp.scale.set(1.1, 1.1, 1);
    sp.position.set(x, 0.8, L / 2 + 0.3);
    car.add(sp);
    const rl = new THREE.Mesh(s.disc, s.redLamp);
    rl.scale.set(0.6, 0.6, 1);
    rl.position.set(x * 0.95, 1.1, -L / 2 - 0.02);
    rl.rotation.y = Math.PI;
    car.add(rl);
  });
}

// ------------------------------------------------------------------ goederenwagons
function containerTexture(color, label, seed) {
  return canvasTex(256, 128, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = color;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.2)';
    for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.font = '900 34px "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, w / 2, h / 2);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(60,30,10,${r() * 0.15})`;
      g.fillRect(r() * w, r() * h, 2, 2 + r() * 8);
    }
  });
}

let FRT = null;
function freightAssets() {
  if (FRT) return FRT;
  const defs = [
    ['#c8102e', 'TRANSLOG'], ['#1e6bb8', 'BLUELINE'], ['#2a8a4a', 'GNOMEBOX'], ['#e8a01a', 'EURO-CARGO'],
    ['#7a3fa0', 'SPOTTR'], ['#d9d9d9', 'RAILFLOW'],
  ];
  FRT = {
    containers: defs.map(([c, l], i) => new THREE.MeshStandardMaterial({ map: containerTexture(c, l, 50 + i), roughness: 0.7, metalness: 0.2 })),
    bed: new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.8, metalness: 0.5 }),
    tank: new THREE.MeshStandardMaterial({ color: '#a7aeb5', roughness: 0.3, metalness: 0.8, envMapIntensity: 1.4 }),
    tankDark: new THREE.MeshStandardMaterial({ color: '#2b3138', roughness: 0.5, metalness: 0.6 }),
    boxcar: new THREE.MeshStandardMaterial({ map: containerTexture('#6a4a35', 'GOEDEREN', 77), roughness: 0.85 }),
  };
  return FRT;
}

const FW_LEN = 13.6;
function buildWagon(kind, rand) {
  const s = shared();
  const f = freightAssets();
  const g = new THREE.Group();
  const L = FW_LEN;
  box(s, f.bed, 2.7, 0.3, L, 0, 0.8, 0, g);
  box(s, s.dark, 2.0, 0.22, L - 3, 0, 0.62, 0, g);
  [-1, 1].forEach((side) => {
    const bz = side * L * 0.34;
    [-1, 1].forEach((ws) => {
      [-1, 1].forEach((rs) => {
        const w = new THREE.Mesh(s.wheel, s.steel);
        w.position.set(rs * 0.72, 0.5, bz + ws * 0.95);
        g.add(w);
      });
      box(s, s.steel, 1.5, 0.1, 0.1, 0, 0.5, bz + ws * 0.95, g);
    });
  });
  if (kind === 'container') {
    const n = rand() < 0.5 ? 2 : 3;
    const cl = n === 2 ? 6.0 : 4.0;
    for (let i = 0; i < n; i++) {
      const mat = f.containers[(rand() * f.containers.length) | 0];
      box(s, mat, 2.6, 2.6, cl - 0.2, 0, 0.95 + 1.3, -L / 2 + 0.4 + cl / 2 + i * (cl + 0.1), g);
    }
  } else if (kind === 'tank') {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, L - 1.5, 24), f.tank);
    t.rotation.x = Math.PI / 2;
    t.position.y = 0.95 + 1.35;
    t.castShadow = true;
    g.add(t);
    box(s, f.tankDark, 0.5, 0.35, 1.4, 0, 0.95 + 2.8, 0, g);
    box(s, f.tankDark, 0.15, 1.0, 0.8, 0, 0.95 + 2.2, 0, g).rotation.z = 0;
  } else {
    box(s, f.boxcar, 2.7, 2.55, L - 0.6, 0, 0.95 + 1.27, 0, g);
    box(s, s.dark, 2.8, 0.15, L - 0.4, 0, 0.95 + 2.6, 0, g);
  }
  mergeStatic(g);
  return g;
}

// ------------------------------------------------------------------ hellingen
let RAMPS = null;
function rampAssets() {
  if (RAMPS) return RAMPS;
  const plank = canvasTex(128, 128, (g, w, h) => {
    const r = rng(5);
    g.fillStyle = '#8a5f35';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) {
      g.fillStyle = `rgb(${120 + r() * 40},${80 + r() * 30},${40 + r() * 20})`;
      g.fillRect(0, y + 1, w, 14);
      g.fillStyle = 'rgba(0,0,0,0.3)';
      g.fillRect(0, y, w, 2);
    }
  }, { repeat: true });
  const hazard = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffcc00';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#161616';
    for (let i = -h; i < w; i += 32) {
      g.beginPath();
      g.moveTo(i, h);
      g.lineTo(i + 16, h);
      g.lineTo(i + 16 + h, 0);
      g.lineTo(i + h, 0);
      g.fill();
    }
  }, { repeat: true });
  RAMPS = {
    plank: new THREE.MeshStandardMaterial({ map: plank, roughness: 0.85 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazard, roughness: 0.6, metalness: 0.2 }),
    concrete: new THREE.MeshStandardMaterial({ color: '#a8a9a4', roughness: 0.95 }),
    beam: new THREE.MeshStandardMaterial({ color: '#5a3c20', roughness: 0.9 }),
    steel: new THREE.MeshStandardMaterial({ color: '#606468', roughness: 0.4, metalness: 0.8 }),
  };
  return RAMPS;
}

// Schans aan de voorkant (+z) van de trein. Hoogste punt sluit precies aan op het dak.
export const RAMP_KINDS = ['plank', 'metal', 'concrete'];
export function createRamp(kind, roofH) {
  const R = rampAssets();
  const s = shared();
  const len = kind === 'metal' ? roofH * 1.7 : kind === 'concrete' ? roofH * 2.2 : roofH * 2.0;
  const g = new THREE.Group();
  const w = 2.3;
  const ang = Math.atan2(roofH, len);
  const hyp = Math.hypot(len, roofH);
  const surf = kind === 'plank' ? R.plank : kind === 'metal' ? R.hazard : R.concrete;
  // loopvlak (boven)
  const top = new THREE.Mesh(s.box, surf);
  top.scale.set(w, 0.14, hyp);
  top.position.set(0, roofH / 2 - 0.07, len / 2);
  top.rotation.x = ang; // hoge kant bij de trein (z=0), lage kant naar de speler (+z)
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);
  if (surf.map) {
    surf.map.repeat.set(1, 5);
  }
  // zijwangen (driehoekig)
  const tri = new THREE.Shape();
  tri.moveTo(0, 0);
  tri.lineTo(len, 0);
  tri.lineTo(0, roofH - 0.12);
  tri.closePath();
  const triGeo = new THREE.ExtrudeGeometry(tri, { depth: 0.16, bevelEnabled: false });
  triGeo.rotateY(-Math.PI / 2); // x->z, extrusie langs x
  [-1, 1].forEach((sd) => {
    const m = new THREE.Mesh(triGeo, kind === 'concrete' ? R.concrete : R.beam);
    m.position.set(sd * (w / 2 - 0.08) + 0.08, 0, 0);
    m.castShadow = true;
    g.add(m);
  });
  // dwarsbalken, leuning en steunpalen
  for (let i = 1; i <= 3; i++) {
    const z = (len * i) / 4;
    const hh = roofH * (1 - i / 4);
    const b = new THREE.Mesh(s.box, R.beam);
    b.scale.set(w + 0.1, 0.1, 0.18);
    b.position.set(0, Math.max(0.05, hh - 0.2), z);
    g.add(b);
  }
  [-1, 1].forEach((sd) => {
    const rail = new THREE.Mesh(s.box, R.steel);
    rail.scale.set(0.07, 0.07, hyp);
    rail.position.set(sd * (w / 2), roofH / 2 + 0.6, len / 2);
    rail.rotation.x = ang;
    g.add(rail);
  });
  mergeStatic(g);
  g.userData.len = len;
  g.userData.kind = kind;
  return g;
}

// ------------------------------------------------------------------ publieke API
export function pickTrainType(rand = Math.random) {
  const entries = Object.entries(TRAIN_WEIGHTS);
  const total = entries.reduce((a, [, w]) => a + w, 0);
  let x = rand() * total;
  for (const [k, w] of entries) {
    x -= w;
    if (x <= 0) return k;
  }
  return 'sprinter';
}

// Een treinstel; neus wijst naar +z (naar de speler).
export function createTrain(key, cars = 1, rand = Math.random) {
  const g = new THREE.Group();
  if (key === 'freight') {
    const loco = buildCar('loco');
    addLamps(loco, TRAIN_TYPES.loco);
    const ll = TRAIN_TYPES.loco.len;
    const wagons = 2 + ((rand() * 2) | 0);
    let zFront = ll / 2;
    loco.position.z = 0;
    g.add(loco);
    let zc = -ll / 2 - 0.5;
    for (let i = 0; i < wagons; i++) {
      const kind = ['container', 'container', 'tank', 'box'][(rand() * 4) | 0];
      const w = buildWagon(kind, rand);
      w.position.z = zc - FW_LEN / 2;
      g.add(w);
      zc -= FW_LEN + 0.5;
    }
    const total = ll / 2 - zc - 0.5;
    const shift = (ll / 2 + zc + 0.5) / 2; // zodat het midden op z=0 komt
    g.children.forEach((c) => { c.position.z -= shift; });
    g.userData = { length: total, roofH: 3.5, special: false, type: 'freight', label: 'Goederentrein' };
    return g;
  }
  const cfg = TRAIN_TYPES[key];
  const gapZ = 0.35;
  for (let i = 0; i < cars; i++) {
    const car = buildCar(key);
    addLamps(car, cfg);
    car.position.z = -i * (cfg.len + gapZ);
    g.add(car);
    if (i > 0) {
      const s = shared();
      const bel = box(s, s.rubber, cfg.W - 0.5, 2.5, 0.6, 0, 1.9, car.position.z + cfg.len / 2 + 0.17, g);
      bel.castShadow = false;
    }
  }
  const length = cars * cfg.len + (cars - 1) * gapZ;
  g.children.forEach((c) => { c.position.z += ((cars - 1) * (cfg.len + gapZ)) / 2; });
  g.userData = { length, roofH: cfg.H, special: !!cfg.special, type: key, label: cfg.label, hw: cfg.W / 2 };
  return g;
}

// Compacte NS-trein als voertuig voor Teun (1 rijtuig, ingekort).
export function createVehicleTrain() {
  const car = buildCar('sprinter');
  addLamps(car, TRAIN_TYPES.sprinter);
  const g = new THREE.Group();
  g.add(car);
  g.scale.set(0.78, 0.7, 0.46);
  return g;
}
