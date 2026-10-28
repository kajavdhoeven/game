// De 3D-wereld: terrein, bruggen, water, spijkers, finish en een vrolijke achtergrond.
import * as THREE from 'three';
import { levelHeight } from './levels.js';
import { ferryPos, bridgeProg } from './sim.js';

const M = (c, opts = {}) => new THREE.MeshLambertMaterial({ color: c, ...opts });
const DEPTH = 6;

// meerdere geometrieen samenvoegen tot een
function merge(list) {
  let n = 0;
  const gs = list.map((g) => (g.index ? g.toNonIndexed() : g));
  gs.forEach((g) => { n += g.attributes.position.count; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const g of gs) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    o += g.attributes.position.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  return out;
}
const prism = (poly, depth) => {
  const shape = new THREE.Shape(poly.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2);
  return g;
};

export function buildWorld(level) {
  const root = new THREE.Group();
  // ----- grond: zandkleurige massa met een groen dak
  const main = level.main;
  const bottom = level.minY - 20;
  const body = [...main, [main[main.length - 1][0], bottom], [main[0][0], bottom]];
  const bodyMesh = new THREE.Mesh(prism(body, DEPTH), M('#ffd1b3'));
  root.add(bodyMesh);
  const strips = [], bricks = [];
  for (let i = 1; i < main.length; i++) {
    const [ax, ay] = main[i - 1], [bx, by] = main[i];
    if (Math.abs(bx - ax) < 0.01) continue;
    strips.push(prism([[ax, ay + 0.02], [bx, by + 0.02], [bx, by - 0.45], [ax, ay - 0.45]], DEPTH + 0.1));
    // bruine rand onder het gras, zoals op het plaatje
    bricks.push(prism([[ax, ay - 0.45], [bx, by - 0.45], [bx, by - 1.1], [ax, ay - 1.1]], DEPTH + 0.05));
  }
  root.add(new THREE.Mesh(merge(strips), M('#3fcf55')));
  root.add(new THREE.Mesh(merge(bricks), M('#c98a7e')));
  // klein stipje gras (kleine donkere blokjes) voor sfeer
  const dots = [];
  for (let i = 1; i < main.length; i += 2) {
    const [ax, ay] = main[i - 1], [bx, by] = main[i];
    if (Math.abs(bx - ax) < 0.5) continue;
    const g = new THREE.BoxGeometry(0.25, 0.1, 0.25);
    g.translate((ax + bx) / 2, (ay + by) / 2 + 0.06, ((i * 37) % 10) / 10 * DEPTH * 0.8 - DEPTH * 0.4);
    dots.push(g);
  }
  if (dots.length) root.add(new THREE.Mesh(merge(dots), M('#2aa745')));

  // ----- houten bruggen
  for (const pl of level.planks) {
    const parts = [], edges = [];
    for (let i = 1; i < pl.length; i++) {
      const [ax, ay] = pl[i - 1], [bx, by] = pl[i];
      parts.push(prism([[ax, ay + 0.1], [bx, by + 0.1], [bx, by - 0.45], [ax, ay - 0.45]], 4.6));
      edges.push(prism([[ax, ay + 0.1], [bx, by + 0.1], [bx, by + 0.04], [ax, ay + 0.04]], 4.7));
    }
    root.add(new THREE.Mesh(merge(parts), M('#b8666a')));
    root.add(new THREE.Mesh(merge(edges), M('#ffd0b8')));
  }
  const postGeos = [];
  for (const [px, py] of level.posts) {
    const g = new THREE.BoxGeometry(0.35, py + 14, 0.35);
    g.translate(px, (py - 14) / 2 - 0.4, 2.0);
    postGeos.push(g);
    const g2 = g.clone(); g2.translate(0, 0, -4.0); postGeos.push(g2);
  }
  if (postGeos.length) root.add(new THREE.Mesh(merge(postGeos), M('#a85a5e')));

  // ----- water, spijkers
  const waters = [];
  for (const h of level.hz) {
    if (h.type === 'water') {
      const w = h.x1 - h.x0 + 0.1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 6, DEPTH + 0.3), new THREE.MeshBasicMaterial({ color: '#17c2ff', transparent: true, opacity: 0.92 }));
      m.position.set((h.x0 + h.x1) / 2, h.y + 4.5 - 3, 0);
      root.add(m);
      const foam = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, DEPTH + 0.35), new THREE.MeshBasicMaterial({ color: '#bff3ff' }));
      foam.position.set((h.x0 + h.x1) / 2, h.y + 4.52, 0);
      root.add(foam);
      waters.push(foam);
    } else if (h.type === 'spikes') {
      const n = Math.max(3, Math.round((h.x1 - h.x0) / 0.8)), step = (h.x1 - h.x0) / n;
      const geos = [];
      for (let i = 0; i < n; i++) {
        for (let k = 0; k < 4; k++) {
          const g = new THREE.ConeGeometry(step * 0.45, h.h, 4);
          g.rotateY(Math.PI / 4);
          g.translate(h.x0 + step * (i + 0.5), h.y + h.h / 2, -DEPTH / 2 + 0.7 + k * 1.5);
          geos.push(g);
        }
      }
      root.add(new THREE.Mesh(merge(geos), M('#d7dde5')));
    }
  }

  // ----- bewegende delen: veerboot en brug met knop
  const movers = [];
  for (const m of level.movers || []) {
    if (m.kind === 'ferry') {
      const plank = new THREE.Mesh(new THREE.BoxGeometry(m.len, 0.5, 4.8), M('#b8666a'));
      const top = new THREE.Mesh(new THREE.BoxGeometry(m.len, 0.1, 4.9), M('#ffd0b8'));
      top.position.y = 0.28;
      const g = new THREE.Group();
      g.add(plank, top);
      // pijlen aan de zijkant
      const arrow = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.15, 0.4), M('#ffd23a'));
      arrow.position.set(0, 0.34, 2.2); g.add(arrow);
      const a2 = arrow.clone(); a2.position.z = -2.2; g.add(a2);
      root.add(g);
      movers.push({ m, g });
    } else {
      const g = new THREE.Group();
      const g2 = new THREE.BoxGeometry(1, 0.5, 4.8); g2.translate(0.5, 0, 0);
      const plank = new THREE.Mesh(g2, M('#b8666a'));
      const g3 = new THREE.BoxGeometry(1, 0.1, 4.9); g3.translate(0.5, 0.28, 0);
      const top = new THREE.Mesh(g3, M('#ffd0b8'));
      g.add(plank, top);
      root.add(g);
      const gy = levelHeight(level, (m.bx0 + m.bx1) / 2);
      const btnMat = new THREE.MeshBasicMaterial({ color: '#ff3b3b' });
      const btn = new THREE.Mesh(new THREE.BoxGeometry(m.bx1 - m.bx0, 0.18, 3.8), btnMat);
      btn.position.set((m.bx0 + m.bx1) / 2, gy + 0.02, 0);
      root.add(btn);
      const ring = new THREE.Mesh(new THREE.BoxGeometry(m.bx1 - m.bx0 + 0.5, 0.1, 4.2), M('#2b2f38'));
      ring.position.set((m.bx0 + m.bx1) / 2, gy - 0.04, 0);
      root.add(ring);
      // bordje met een uitroepteken
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2, 0.2), M('#2b2f38'));
      post.position.set(m.bx0 - 0.6, gy + 1, -2.6); root.add(post);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.2, 0.15), new THREE.MeshBasicMaterial({ color: '#ffd23a' }));
      sign.position.set(m.bx0 - 0.6, gy + 2.2, -2.6); root.add(sign);
      movers.push({ m, g, btnMat });
    }
  }
  const updateMovers = (t, latched) => {
    for (const o of movers) {
      const { m, g } = o;
      if (m.kind === 'ferry') g.position.set(ferryPos(m, t) + m.len / 2, m.y - 0.3, 0);
      else {
        const p = bridgeProg(m, t, latched);
        g.visible = p > 0.02;
        g.position.set(m.x0 - 1.5, m.y - 0.3, 0);
        g.scale.x = Math.max(0.01, (m.x1 - m.x0 + 3) * p);
        o.btnMat.color.set(latched && latched[m.id] !== undefined ? '#3ed66a' : '#ff3b3b');
      }
    }
  };

  // ----- finishpoort
  {
    let fy = 0;
    const t = level.track;
    for (let i = 1; i < t.length; i++) if (t[i][0] > t[i - 1][0] && level.finishX >= t[i - 1][0] && level.finishX <= t[i][0]) fy = t[i - 1][1] + (t[i][1] - t[i - 1][1]) * (level.finishX - t[i - 1][0]) / (t[i][0] - t[i - 1][0]);
    const gate = new THREE.Group();
    gate.position.set(level.finishX, fy, 0);
    [-3.2, 3.2].forEach((z) => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 0.4), M('#ffffff')); p.position.set(0, 3, z); gate.add(p); });
    const flag = new THREE.CanvasTexture((() => {
      const c = document.createElement('canvas'); c.width = 256; c.height = 64;
      const g = c.getContext('2d');
      for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); }
      return c;
    })());
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: flag, side: THREE.DoubleSide }));
    banner.rotation.y = Math.PI / 2;
    banner.position.set(0, 5.4, 0);
    gate.add(banner);
    root.add(gate);
  }

  // ----- achtergrond: lage blauwe bergen en wolken
  const bg = new THREE.Group();
  const cols = ['#6fd2ff', '#3fb4ff', '#1f8fe8'];
  const seedR = (i) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1;
  const maxX = level.finishX + 60;
  for (let i = 0; i < 70; i++) {
    const x = -60 + (i / 70) * (maxX + 60) + seedR(i) * 8;
    const layer = i % 3;
    const h = 14 + seedR(i + 5) * 22 - layer * 3;
    const m = new THREE.Mesh(new THREE.ConeGeometry(10 + seedR(i + 9) * 8, h, 4), M(cols[layer], { flatShading: true }));
    m.rotation.y = Math.PI / 4 + seedR(i) * 0.6;
    m.position.set(x, level.minY + h / 2 - 12 + layer * 2, -22 - layer * 16 - seedR(i + 2) * 10);
    bg.add(m);
  }
  const clouds = [];
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Group();
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(5 + seedR(i + k) * 6, 1.4, 3 + seedR(k) * 2), M('#ffffff'));
      b.position.set(k * 3.5 - 5, seedR(i * k) * 0.8, 0);
      c.add(b);
    }
    c.position.set(-40 + i * ((maxX + 80) / 26), 18 + seedR(i + 3) * 12, -18 - seedR(i + 8) * 16);
    bg.add(c); clouds.push(c);
  }
  root.add(bg);
  return { root, waters, clouds, updateMovers, dispose() { root.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } };
}
