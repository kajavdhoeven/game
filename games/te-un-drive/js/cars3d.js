// Eenvoudige blokkenauto's (geen hoge detailgraad nodig): alles bestaat uit dozen en cilinders.
import * as THREE from 'three';
import { CARS } from './sim.js';

const mats = {};
const M = (c, opts = {}) => {
  const k = c + JSON.stringify(opts);
  return mats[k] || (mats[k] = new THREE.MeshLambertMaterial({ color: c, ...opts }));
};
function box(p, w, h, d, c, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(c, opts));
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
function cyl(p, rt, rb, h, c, x = 0, y = 0, z = 0, seg = 14) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), M(c));
  m.position.set(x, y, z);
  p.add(m);
  return m;
}
const tex = (w, h, draw) => {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
};

// groot wiel: rubber met profiel en naaf, aan beide kanten van de as
function bigWheel(r, width, rim, z) {
  const g = new THREE.Group();
  [-z, z].forEach((zz) => {
    const w = new THREE.Group();
    w.position.z = zz;
    const tire = cyl(w, r, r, width, '#1b1f27', 0, 0, 0, 18);
    tire.rotation.x = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const b = box(w, r * 0.28, r * 0.22, width * 1.08, '#2b303a', Math.cos(a) * r, Math.sin(a) * r, 0);
      b.rotation.z = a;
    }
    const hub = cyl(w, r * 0.55, r * 0.55, width * 1.05, rim, 0, 0, 0, 12);
    hub.rotation.x = Math.PI / 2;
    box(w, r * 0.9, r * 0.14, width * 1.12, '#374151', 0, 0, 0);
    box(w, r * 0.14, r * 0.9, width * 1.12, '#374151', 0, 0, 0);
    g.add(w);
  });
  return g;
}

function buildTruck() {
  const g = new THREE.Group();
  const V = CARS.truck;
  box(g, 3.7, 0.5, 1.5, '#4b5563', 0, -0.1, 0);
  box(g, 1.9, 0.75, 2.0, '#ffd23a', -0.85, 0.42, 0); // laadbak
  box(g, 1.7, 0.12, 2.0, '#e5b800', -0.85, 0.82, 0);
  box(g, 1.4, 0.8, 1.9, '#d1d5db', 0.75, 0.95, 0); // cabine
  box(g, 1.3, 0.35, 1.94, '#9be7ff', 0.8, 1.05, 0, { transparent: true, opacity: 0.85 });
  box(g, 1.2, 0.65, 2.0, '#ffd23a', 1.8, 0.35, 0); // motorkap
  box(g, 0.12, 0.3, 1.7, '#111827', 2.43, 0.3, 0); // grille
  box(g, 0.1, 0.18, 0.4, '#fff6b0', 2.45, 0.55, 0.7);
  box(g, 0.1, 0.18, 0.4, '#fff6b0', 2.45, 0.55, -0.7);
  // rolbeugel achterop, zoals op het plaatje
  box(g, 0.12, 1.1, 0.12, '#4b5563', -1.7, 1.0, 0.85);
  box(g, 0.12, 1.1, 0.12, '#4b5563', -1.7, 1.0, -0.85);
  box(g, 0.12, 0.12, 1.82, '#4b5563', -1.7, 1.55, 0);
  const w0 = bigWheel(V.r, 0.7, '#9ca3af', 1.05), w1 = bigWheel(V.r, 0.7, '#9ca3af', 1.05);
  g.add(w0, w1);
  return { g, wheels: [w0, w1] };
}

function buildBike() {
  const g = new THREE.Group();
  const V = CARS.bike;
  const mk = () => {
    const w = new THREE.Group();
    const t = new THREE.Mesh(new THREE.TorusGeometry(V.r - 0.06, 0.07, 8, 24), M('#15171c'));
    w.add(t);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(V.r - 0.15, 0.025, 6, 20), M('#e5e7eb'));
    w.add(rim);
    for (let i = 0; i < 6; i++) { const b = box(w, 0.02, (V.r - 0.12) * 2, 0.02, '#cbd5e1'); b.rotation.z = (i / 6) * Math.PI; }
    cyl(w, 0.07, 0.07, 0.2, '#6b7280', 0, 0, 0, 8).rotation.x = Math.PI / 2;
    return w;
  };
  const w0 = mk(), w1 = mk();
  g.add(w0, w1);
  const tube = (x1, y1, x2, y2, c, th = 0.09) => {
    const len = Math.hypot(x2 - x1, y2 - y1);
    const m = box(g, len, th, th, c, (x1 + x2) / 2, (y1 + y2) / 2, 0);
    m.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  };
  const red = '#e63946', dark = '#9d1c25';
  const rx = -V.wb / 2, fx = V.wb / 2, wy = V.wy;
  tube(rx, wy, -0.15, 0.4, red); tube(-0.15, 0.4, 0.5, 0.45, red); tube(rx, wy, 0.2, wy, dark);
  tube(0.2, wy, 0.5, 0.45, red); tube(0.2, wy, -0.15, 0.4, dark); tube(0.5, 0.45, fx, wy, '#9ca3af', 0.07);
  tube(0.5, 0.45, 0.55, 0.85, '#9ca3af', 0.06); tube(0.4, 0.88, 0.7, 0.88, '#111827', 0.07);
  tube(-0.15, 0.4, -0.18, 0.62, '#9ca3af', 0.05);
  box(g, 0.55, 0.1, 0.22, '#111827', -0.2, 0.68, 0);
  // krat achterop met bordje
  box(g, 0.7, 0.34, 0.6, '#ffd23a', -0.95, 0.5, 0);
  // vlag met "Hermano's"
  const t = tex(256, 96, (c, w, h) => {
    c.fillStyle = '#ffd23a'; c.fillRect(0, 0, w, h);
    c.strokeStyle = '#e63946'; c.lineWidth = 8; c.strokeRect(4, 4, w - 8, h - 8);
    c.fillStyle = '#e63946'; c.font = '900 40px "Arial Black", Arial, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText("HERMANO'S", w / 2, h / 2 + 3);
  });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.64), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
  flag.position.set(-0.95, 1.5, 0);
  g.add(flag);
  box(g, 0.05, 0.9, 0.05, '#9ca3af', -0.95, 1.0, 0);
  // naamplaat op de zijkant van het frame
  const side = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.3), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
  side.position.set(0.18, 0.15, 0.06);
  g.add(side);
  const side2 = side.clone(); side2.position.z = -0.06; side2.rotation.y = Math.PI;
  g.add(side2);
  return { g, wheels: [w0, w1], flag };
}

function buildGold() {
  const g = new THREE.Group();
  const V = CARS.gold;
  box(g, 3.8, 0.55, 1.9, '#ffcf33', 0, 0, 0, { emissive: new THREE.Color('#5a4100') });
  box(g, 2.0, 0.55, 1.7, '#ffe27a', -0.15, 0.55, 0, { emissive: new THREE.Color('#5a4100') });
  box(g, 1.7, 0.4, 1.74, '#9be7ff', 0.05, 0.6, 0, { transparent: true, opacity: 0.85 });
  box(g, 0.35, 0.5, 1.9, '#ffcf33', -1.85, 0.5, 0);
  box(g, 0.1, 0.25, 0.5, '#fff6b0', 1.92, 0.12, 0.65);
  box(g, 0.1, 0.25, 0.5, '#fff6b0', 1.92, 0.12, -0.65);
  const stripes = [];
  ['#ff3b3b', '#ff9a1f', '#ffe14a', '#3ed66a', '#3b8bff', '#a55bff'].forEach((c, i) => {
    [-1, 1].forEach((s) => { const m = box(g, 3.5, 0.07, 0.04, c, 0, 0.2 - i * 0.075, s * 0.96); stripes.push(m); });
  });
  const w0 = bigWheel(V.r, 0.45, '#ffcf33', 1.0), w1 = bigWheel(V.r, 0.45, '#ffcf33', 1.0);
  g.add(w0, w1);
  return { g, wheels: [w0, w1], stripes };
}

function buildGnome() {
  const g = new THREE.Group();
  const V = CARS.gnome;
  box(g, 3.4, 1.0, 1.9, '#2f6fe0', 0, 0.1, 0); // tuniek
  box(g, 3.44, 0.14, 1.94, '#16181d', 0, 0.0, 0); // riem
  box(g, 0.3, 0.2, 0.05, '#ffd23a', 0, 0.0, 0.99);
  box(g, 0.3, 0.2, 0.05, '#ffd23a', 0, 0.0, -0.99);
  // baard voorop
  box(g, 0.8, 1.2, 1.7, '#f8f8f4', 1.75, 0.0, 0);
  box(g, 0.6, 0.6, 1.4, '#ffffff', 2.0, -0.4, 0);
  // gezicht
  box(g, 0.12, 0.28, 0.6, '#f2b58f', 2.2, 0.5, 0); // neus
  box(g, 0.08, 0.15, 0.22, '#111111', 2.12, 0.75, 0.45);
  box(g, 0.08, 0.15, 0.22, '#111111', 2.12, 0.75, -0.45);
  box(g, 0.06, 0.5, 1.45, '#111111', 2.12, 0.78, 0, { transparent: true, opacity: 0.0 });
  // muts: rode kegel met witte rand
  const hat = new THREE.Mesh(new THREE.ConeGeometry(1.05, 1.9, 4), M('#e0232c'));
  hat.position.set(0.3, 1.6, 0);
  hat.rotation.y = Math.PI / 4;
  hat.scale.set(1, 1, 1);
  g.add(hat);
  box(g, 2.3, 0.22, 2.0, '#ffffff', 0.3, 0.68, 0);
  // rugzakje
  box(g, 0.6, 0.7, 1.0, '#8c5a2b', -1.5, 0.45, 0);
  const w0 = bigWheel(V.r, 0.6, '#ffd23a', 1.05), w1 = bigWheel(V.r, 0.6, '#ffd23a', 1.05);
  g.add(w0, w1);
  return { g, wheels: [w0, w1], hat };
}

export function createCar(id) {
  const V = CARS[id];
  const root = new THREE.Group();
  const b = id === 'truck' ? buildTruck() : id === 'bike' ? buildBike() : id === 'gold' ? buildGold() : buildGnome();
  root.add(b.g);
  b.wheels[0].position.set(-V.wb / 2, V.wy, 0);
  b.wheels[1].position.set(V.wb / 2, V.wy, 0);
  b.g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
  const api = {
    root, id,
    update(car, t) {
      root.position.set(car.x, car.y, 0);
      root.rotation.z = car.a;
      b.wheels[0].rotation.z = -car.ang[0];
      b.wheels[1].rotation.z = -car.ang[1];
      if (b.flag) { b.flag.rotation.y = Math.sin(t * 8) * 0.25; b.flag.scale.x = 0.9 + Math.sin(t * 8) * 0.05; }
      if (b.stripes) b.stripes.forEach((m, i) => m.material.color.setHSL(((t * 0.6 + i * 0.07) % 1), 1, 0.55));
      if (b.hat) b.hat.rotation.z = Math.sin(t * 6) * 0.04;
    },
  };
  return api;
}
