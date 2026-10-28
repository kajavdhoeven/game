import * as THREE from 'three';
import { canvasTex } from './textures.js';

const boxGeo = new THREE.BoxGeometry(1, 1, 1);

function stripeTex(c1, c2, diag) {
  const t = canvasTex(256, 32, (g, w, h) => {
    g.fillStyle = c1;
    g.fillRect(0, 0, w, h);
    g.fillStyle = c2;
    if (!diag) {
      for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 32, h);
    } else {
      for (let x = -h; x < w; x += 64) {
        g.beginPath();
        g.moveTo(x, h);
        g.lineTo(x + 32, h);
        g.lineTo(x + 32 + h, 0);
        g.lineTo(x + h, 0);
        g.fill();
      }
    }
  }, { repeat: true });
  t.repeat.set(2, 1);
  return t;
}

let A = null;
function assets() {
  if (A) return A;
  const crateTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#a8763e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#5a3a1a';
    g.lineWidth = 8;
    g.strokeRect(4, 4, w - 8, h - 8);
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(4, 4);
    g.lineTo(w - 4, h - 4);
    g.moveTo(w - 4, 4);
    g.lineTo(4, h - 4);
    g.stroke();
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`;
      g.fillRect(Math.random() * w, Math.random() * h, 3, 1);
    }
  });
  const arrow = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#0b1a3a';
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffc917';
    c.beginPath();
    c.moveTo(w * 0.5, h * 0.82);
    c.lineTo(w * 0.2, h * 0.42);
    c.lineTo(w * 0.4, h * 0.42);
    c.lineTo(w * 0.4, h * 0.16);
    c.lineTo(w * 0.6, h * 0.16);
    c.lineTo(w * 0.6, h * 0.42);
    c.lineTo(w * 0.8, h * 0.42);
    c.closePath();
    c.fill();
  });
  A = {
    stripeRW: stripeTex('#f4f4f4', '#cf2a2a', false),
    stripeYB: stripeTex('#ffcc00', '#161616', true),
    pole: new THREE.MeshStandardMaterial({ color: '#e9e9e9', roughness: 0.5, metalness: 0.2 }),
    poleY: new THREE.MeshStandardMaterial({ color: '#e6b800', roughness: 0.5, metalness: 0.2 }),
    crate: new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.9 }),
    cone: new THREE.MeshStandardMaterial({ color: '#ff6a1a', roughness: 0.5 }),
    coneW: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 }),
    base: new THREE.MeshStandardMaterial({ color: '#333' }),
    arrow: new THREE.MeshBasicMaterial({ map: arrow, toneMapped: false }),
    coneGeo: new THREE.ConeGeometry(0.28, 0.7, 14),
  };
  return A;
}

// Obstakelsoorten: top/bottom in meters boven de grond, hw = halve breedte, depth = halve diepte in z
export const OBST = {
  low: { hw: 1.4, depth: 0.35, top: 0.85, tip: 'springen' },
  high: { hw: 1.4, depth: 0.35, bottom: 1.15, top: 1.95, tip: 'rollen' },
  crate: { hw: 1.3, depth: 0.9, top: 1.4, tip: 'springen' },
  cone: { hw: 1.3, depth: 0.4, top: 0.72, tip: 'springen' },
};

export function makeBarrier(kind) {
  const a = assets();
  const g = new THREE.Group();
  const add = (mat, w, h, d, x, y, z) => {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (kind === 'low') {
    add(new THREE.MeshStandardMaterial({ map: a.stripeRW, roughness: 0.5 }), 2.7, 0.15, 0.15, 0, 0.78, 0);
    const lamps = [];
    [-1.3, 1.3].forEach((x) => {
      add(a.pole, 0.2, 1.0, 0.2, x, 0.5, 0);
      add(a.base, 0.5, 0.15, 0.5, x, 0.07, 0);
      const lm = new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false });
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), lm);
      l.position.set(x, 1.1, -0.1);
      g.add(l);
      lamps.push(lm);
    });
    g.userData.lamps = lamps;
  } else if (kind === 'high') {
    add(new THREE.MeshStandardMaterial({ map: a.stripeYB, roughness: 0.5 }), 2.7, 0.7, 0.14, 0, 1.5, 0);
    [-1.3, 1.3].forEach((x) => {
      add(a.poleY, 0.16, 1.85, 0.16, x, 0.92, 0);
      add(a.base, 0.5, 0.12, 0.5, x, 0.06, 0);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), a.arrow);
    sign.position.set(0, 2.25, 0.09);
    g.add(sign);
    add(a.poleY, 0.06, 0.4, 0.06, 0, 2.0, 0);
  } else if (kind === 'crate') {
    // gestapelde kratten op een pallet
    for (let i = 0; i < 3; i++) add(a.crate, 0.9, 0.9, 0.9, -0.9 + i * 0.92, 0.5, 0);
    add(a.crate, 0.9, 0.5, 0.9, -0.45, 1.15, 0.0);
    add(a.crate, 0.9, 0.5, 0.9, 0.47, 1.15, 0.0);
    add(a.base, 2.9, 0.08, 1.0, 0, 0.04, 0);
  } else {
    // pionnenrij
    for (let i = 0; i < 5; i++) {
      const x = -1.1 + i * 0.55;
      const c = new THREE.Mesh(a.coneGeo, a.cone);
      c.position.set(x, 0.38, 0);
      c.castShadow = true;
      g.add(c);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 12), a.coneW);
      band.position.set(x, 0.38, 0);
      g.add(band);
      add(a.base, 0.5, 0.04, 0.5, x, 0.02, 0);
    }
  }
  return g;
}
