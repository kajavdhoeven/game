import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  if (opts.repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = opts.aniso || 8;
  return t;
}

// Tekent een vorm ook aan de overkant, zodat de texture naadloos tegelt.
function wrapped(g, w, h, x, y, r, fn) {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      const px = x + ox * w;
      const py = y + oy * h;
      if (px < -r || px > w + r || py < -r || py > h + r) continue;
      fn(px, py);
    }
  }
}

export function ballastTexture() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(11);
    g.fillStyle = '#6f6a63';
    g.fillRect(0, 0, w, h);
    const cols = ['#8a847b', '#5b5750', '#9b958a', '#4a4741', '#77716a', '#a39d92'];
    for (let i = 0; i < 5200; i++) {
      const x = r() * w;
      const y = r() * h;
      const s = 2 + r() * 5;
      g.fillStyle = cols[(r() * cols.length) | 0];
      wrapped(g, w, h, x, y, s, (px, py) => {
        g.beginPath();
        g.ellipse(px, py, s, s * (0.6 + r() * 0.4), r() * 3, 0, Math.PI * 2);
        g.fill();
      });
    }
    // fijne schaduwen tussen de stenen
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  }, { repeat: true });
}

export function grassTexture(base = '#4f7d2f', seed = 3) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const cols = ['#5f9136', '#46722a', '#6ba03e', '#3f6a26', '#7aa94a', '#587f31'];
    for (let i = 0; i < 9000; i++) {
      const x = r() * w;
      const y = r() * h;
      g.fillStyle = cols[(r() * cols.length) | 0];
      g.globalAlpha = 0.5 + r() * 0.5;
      wrapped(g, w, h, x, y, 4, (px, py) => g.fillRect(px, py, 1.5, 2 + r() * 4));
    }
    g.globalAlpha = 1;
    // zachte vlekken zodat het veld niet eentonig is
    for (let i = 0; i < 26; i++) {
      const x = r() * w;
      const y = r() * h;
      const rad = 30 + r() * 70;
      wrapped(g, w, h, x, y, rad, (px, py) => {
        const gr = g.createRadialGradient(px, py, 0, px, py, rad);
        const light = r() > 0.5;
        gr.addColorStop(0, light ? 'rgba(160,200,90,0.18)' : 'rgba(20,50,10,0.18)');
        gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr;
        g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      });
    }
  }, { repeat: true });
}

// Bloembollenveld: banen in lengterichting (v loopt langs de baan).
export function tulipTexture(colors, seed = 5) {
  return canvasTex(512, 512, (g, w, h) => {
    const r = rng(seed);
    g.fillStyle = '#3d6b25';
    g.fillRect(0, 0, w, h);
    const band = 40;
    let x = 0;
    let ci = 0;
    while (x < w) {
      const col = colors[ci % colors.length];
      g.fillStyle = '#2f5a1d';
      g.fillRect(x, 0, 6, h);
      g.fillStyle = col;
      g.fillRect(x + 6, 0, band - 6, h);
      for (let i = 0; i < 700; i++) {
        const px = x + 6 + r() * (band - 6);
        const py = r() * h;
        g.fillStyle = r() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.22)';
        g.fillRect(px, py, 2, 2);
      }
      x += band;
      ci++;
    }
  }, { repeat: true });
}

export function plowedTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(9);
    g.fillStyle = '#5a4630';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 16) {
      const gr = g.createLinearGradient(x, 0, x + 16, 0);
      gr.addColorStop(0, '#3e2f20');
      gr.addColorStop(0.5, '#7a6144');
      gr.addColorStop(1, '#3e2f20');
      g.fillStyle = gr;
      g.fillRect(x, 0, 16, h);
    }
    for (let i = 0; i < 800; i++) {
      g.fillStyle = 'rgba(0,0,0,0.15)';
      g.fillRect(r() * w, r() * h, 2, 2);
    }
  }, { repeat: true });
}

export function brickTexture(base = '#9c4a33') {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(21);
    g.fillStyle = '#c9c2b4';
    g.fillRect(0, 0, w, h);
    const bh = 16;
    const bw = 40;
    for (let y = 0; y < h; y += bh) {
      const off = ((y / bh) % 2) * (bw / 2);
      for (let x = -bw; x < w + bw; x += bw) {
        const v = (r() - 0.5) * 28;
        g.fillStyle = shade(base, v);
        g.fillRect(x + off + 1.5, y + 1.5, bw - 3, bh - 3);
      }
    }
  }, { repeat: true });
}

export function roofTexture(base = '#7a2c22') {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(33);
    g.fillStyle = '#3a1410';
    g.fillRect(0, 0, w, h);
    const th = 14;
    const tw = 22;
    for (let y = 0; y < h; y += th) {
      const off = ((y / th) % 2) * (tw / 2);
      for (let x = -tw; x < w + tw; x += tw) {
        g.fillStyle = shade(base, (r() - 0.5) * 30);
        g.beginPath();
        g.roundRect(x + off + 1, y + 1, tw - 2, th + 4, 4);
        g.fill();
      }
    }
  }, { repeat: true });
}

export function shade(hex, amt) {
  const c = new THREE.Color(hex);
  const f = amt / 255;
  c.r = Math.min(1, Math.max(0, c.r + f));
  c.g = Math.min(1, Math.max(0, c.g + f));
  c.b = Math.min(1, Math.max(0, c.b + f));
  return '#' + c.getHexString();
}

export function softCircleTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)') {
  return canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, inner);
    gr.addColorStop(1, outer);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
}

export function cloudTexture(seed = 1) {
  return canvasTex(256, 128, (g, w, h) => {
    const r = rng(seed * 97);
    for (let i = 0; i < 26; i++) {
      const x = w * (0.2 + r() * 0.6);
      const y = h * (0.45 + r() * 0.25) - (Math.abs(x - w / 2) / w) * 20;
      const rad = 18 + r() * 24;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)');
      gr.addColorStop(0.6, 'rgba(255,255,255,0.22)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr;
      g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
  });
}

export function drawNSLogo(g, x, y, w, h) {
  // Blauw vlak met witte "NS", zoals op de zijkant van de treinen.
  g.save();
  g.fillStyle = '#003082';
  g.beginPath();
  g.roundRect(x, y, w, h, h * 0.12);
  g.fill();
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `italic 900 ${h * 0.78}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  g.fillText('NS', x + w / 2, y + h * 0.54);
  g.restore();
}
