import * as THREE from 'three';
import { canvasTex, softCircleTexture } from './textures.js';
import { createBoard } from './vehicles.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, ...o });

function part(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function halo(color, size = 2.2) {
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({
    map: softCircleTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'),
    color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.75,
  }));
  sp.scale.set(size, size, 1);
  return sp;
}

export const POWERUPS = {
  shoes: { id: 'shoes', label: 'Superschoenen', color: '#3aa0ff', time: 14, desc: 'Spring zo hoog dat je op treinen landt' },
  plane: { id: 'plane', label: 'Mini-vliegtuig', color: '#ff4a4a', time: 7.5, desc: 'Vlieg 7,5 seconde boven het spoor' },
  refill: { id: 'refill', label: 'Voertuig-refill', color: '#4cff8a', time: 0, desc: 'Vul je geselecteerde voertuig weer op' },
  board: { id: 'board', label: 'Shirt', color: '#ff8a2a', time: 0, desc: 'Trek een shirt of vest aan, vangt één botsing op' },
  magnet: { id: 'magnet', label: 'Magneet', color: '#ff4d6d', time: 10, desc: 'Trekt alle munten in de buurt naar je toe' },
};

export function createPickup(type, boardKind = 'orange') {
  const g = new THREE.Group();
  const inner = new THREE.Group();
  g.add(inner);
  const def = POWERUPS[type];
  if (type === 'shoes') {
    const blue = new THREE.MeshPhysicalMaterial({ color: '#2f8cf0', roughness: 0.25, clearcoat: 1 });
    const white = M('#f4f4f4');
    const coil = M('#ffd400', { metalness: 0.8, roughness: 0.3 });
    [-0.3, 0.3].forEach((x) => {
      const sh = new THREE.Group();
      sh.position.set(x, 0, 0);
      inner.add(sh);
      const b = part(new THREE.SphereGeometry(1, 18, 14), blue, sh, 0, 0.0, -0.1);
      b.scale.set(0.24, 0.2, 0.46);
      const t = part(new THREE.SphereGeometry(1, 14, 10), blue, sh, 0, -0.02, -0.38);
      t.scale.set(0.2, 0.17, 0.22);
      const sole = part(new THREE.SphereGeometry(1, 16, 6), white, sh, 0, -0.2, -0.14);
      sole.scale.set(0.26, 0.05, 0.52);
      const pts = [];
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 8;
        pts.push(new THREE.Vector3(Math.cos(a) * 0.1, -0.24 - (i / 40) * 0.32, Math.sin(a) * 0.1 + 0.05));
      }
      part(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.016, 6), coil, sh);
    });
    inner.scale.setScalar(1.3);
    inner.position.y = 0.15;
  } else if (type === 'plane') {
    const red = M('#e8272f', { roughness: 0.4, metalness: 0.2 });
    const wht = M('#f4f4f4', { roughness: 0.4 });
    const fus = part(new THREE.CapsuleGeometry(0.16, 0.7, 6, 14), red, inner);
    fus.rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(1.9, 0.05, 0.4), wht, inner, 0, 0.08, 0);
    part(new THREE.BoxGeometry(1.9, 0.055, 0.12), red, inner, 0, 0.08, -0.2);
    part(new THREE.BoxGeometry(0.7, 0.04, 0.22), wht, inner, 0, 0.02, 0.52);
    part(new THREE.BoxGeometry(0.04, 0.3, 0.22), red, inner, 0, 0.16, 0.52);
    part(new THREE.SphereGeometry(0.1, 10, 8), M('#8fd2ff', { metalness: 0.5, roughness: 0.1 }), inner, 0, 0.14, -0.1);
    const prop = new THREE.Group();
    prop.position.set(0, 0, -0.55);
    inner.add(prop);
    part(new THREE.BoxGeometry(0.06, 0.8, 0.03), M('#222'), prop);
    part(new THREE.BoxGeometry(0.8, 0.06, 0.03), M('#222'), prop);
    g.userData.prop = prop;
    inner.scale.setScalar(0.8);
  } else if (type === 'magnet') {
    const red = M('#e8272f', { roughness: 0.3, metalness: 0.4 });
    const steel = M('#d9dde3', { roughness: 0.2, metalness: 0.95 });
    const arc = part(new THREE.TorusGeometry(0.34, 0.12, 14, 28, Math.PI), red, inner, 0, 0.05, 0);
    arc.rotation.z = 0;
    [-1, 1].forEach((sd) => {
      part(new THREE.CylinderGeometry(0.12, 0.12, 0.34, 14), red, inner, sd * 0.34, -0.12, 0);
      part(new THREE.CylinderGeometry(0.125, 0.125, 0.16, 14), steel, inner, sd * 0.34, -0.36, 0);
    });
    g.userData.spinFast = true;
    inner.scale.setScalar(1.15);
  } else if (type === 'refill') {
    const green = M('#18a64a', { roughness: 0.3, metalness: 0.3 });
    part(new THREE.CylinderGeometry(0.28, 0.28, 0.7, 20), green, inner);
    part(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), M('#cfd4d9', { metalness: 0.9, roughness: 0.2 }), inner, 0, 0.4, 0);
    const bolt = new THREE.Shape();
    bolt.moveTo(0.05, 0.28);
    bolt.lineTo(-0.12, -0.02);
    bolt.lineTo(-0.01, -0.02);
    bolt.lineTo(-0.06, -0.28);
    bolt.lineTo(0.13, 0.04);
    bolt.lineTo(0.02, 0.04);
    bolt.closePath();
    const bm = new THREE.Mesh(new THREE.ExtrudeGeometry(bolt, { depth: 0.02, bevelEnabled: false }), new THREE.MeshBasicMaterial({ color: '#ffe14a', toneMapped: false }));
    bm.position.z = -0.29;
    bm.rotation.y = Math.PI;
    inner.add(bm);
    const bm2 = bm.clone();
    bm2.rotation.y = 0;
    bm2.position.z = 0.29;
    inner.add(bm2);
    const ring = part(new THREE.TorusGeometry(0.42, 0.035, 8, 28, Math.PI * 1.5), M('#003082', { emissive: '#003082', emissiveIntensity: 0.5 }), inner);
    ring.rotation.x = Math.PI / 2;
    g.userData.ring = ring;
    inner.scale.setScalar(1.25);
  } else {
    const b = createBoard(boardKind);
    inner.add(b);
    inner.scale.setScalar(0.85);
    inner.rotation.x = 0.5;
    g.userData.board = b;
  }
  const h = halo(def.color, 2.4);
  h.position.y = 0.1;
  g.add(h);
  g.userData.halo = h;
  g.userData.inner = inner;
  g.userData.update = (t, dt) => {
    inner.rotation.y = t * 2;
    inner.position.y = (type === 'shoes' ? 0.15 : 0) + Math.sin(t * 3) * 0.12;
    h.material.opacity = 0.55 + Math.sin(t * 5) * 0.2;
    if (g.userData.prop) g.userData.prop.rotation.z += dt * 30;
    if (g.userData.ring) g.userData.ring.rotation.z += dt * 3;
    if (g.userData.board) g.userData.board.userData.update?.(dt, t);
  };
  return g;
}
