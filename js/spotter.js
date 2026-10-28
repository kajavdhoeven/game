import * as THREE from 'three';
import { canvasTex } from './textures.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });

const JACKETS = ['#ff7a00', '#3f7d3a', '#2f5f9e', '#b52b2b', '#c9a227', '#6d5a8a'];
const SKINS = ['#f1c4a0', '#e0a882', '#c68863', '#8d5a3c', '#f6d2b5'];
const HATS = ['#222831', '#a33a2f', '#2e5d34', '#d9d9d9', '#d79a1e'];

let tagMat = null;
function getTagMat() {
  if (tagMat) return tagMat;
  const tex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = 'rgba(0,48,130,0.92)';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 16);
    g.fill();
    g.strokeStyle = '#ffc917';
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#ffc917';
    g.font = '900 34px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('+30', w / 2, h / 2 + 2);
  });
  tagMat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  return tagMat;
}

function part(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}

// variant: 0 = camera op statief, 1 = verrekijker, 2 = notitieboekje en thermos
export function createSpotter(rand, variant) {
  const g = new THREE.Group();
  const skin = mat(SKINS[(rand() * SKINS.length) | 0], { roughness: 0.6 });
  const jacket = mat(JACKETS[(rand() * JACKETS.length) | 0]);
  const pants = mat('#2a3550');
  const hatC = mat(HATS[(rand() * HATS.length) | 0]);
  const dark = mat('#141414', { roughness: 0.4, metalness: 0.5 });

  const rig = new THREE.Group();
  g.add(rig);

  // benen en schoenen
  [-1, 1].forEach((s) => {
    part(new THREE.CapsuleGeometry(0.1, 0.62, 4, 10), pants, rig, s * 0.14, 0.45, 0);
    const shoe = part(new THREE.BoxGeometry(0.17, 0.1, 0.3), mat('#2b2018'), rig, s * 0.14, 0.05, -0.05);
    shoe.castShadow = false;
  });
  // romp met hesje
  const torso = new THREE.Group();
  torso.position.y = 1.0;
  rig.add(torso);
  part(new THREE.CapsuleGeometry(0.24, 0.36, 6, 14), jacket, torso, 0, 0.18, 0);
  if (jacket.color.getHexString() === 'ff7a00') {
    part(new THREE.BoxGeometry(0.5, 0.05, 0.4), mat('#e8eef0', { roughness: 0.3, metalness: 0.3 }), torso, 0, 0.12, 0);
  }
  const packM = part(new THREE.BoxGeometry(0.3, 0.38, 0.16), mat('#333a44'), torso, 0, 0.22, 0.26);
  packM.castShadow = true;
  // hoofd
  const head = new THREE.Group();
  head.position.y = 0.66;
  torso.add(head);
  part(new THREE.SphereGeometry(0.2, 20, 16), skin, head);
  part(new THREE.SphereGeometry(0.04, 10, 8), mat('#d98f7a'), head, 0, -0.02, -0.2);
  // muts of pet
  if (variant === 1) {
    part(new THREE.SphereGeometry(0.215, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatC, head, 0, 0.04, 0);
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), hatC, head, 0, 0.055, 0);
  } else {
    part(new THREE.SphereGeometry(0.21, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatC, head, 0, 0.05, 0);
    const brim = part(new THREE.BoxGeometry(0.3, 0.025, 0.16), hatC, head, 0, 0.07, -0.22);
    brim.rotation.x = 0.1;
  }
  // ogen
  [-1, 1].forEach((s) => part(new THREE.SphereGeometry(0.022, 8, 8), dark, head, s * 0.07, 0.02, -0.185).castShadow = false);

  // armen
  const mkArm = (s) => {
    const sh = new THREE.Group();
    sh.position.set(s * 0.3, 0.38, 0);
    torso.add(sh);
    part(new THREE.CapsuleGeometry(0.07, 0.22, 4, 10), jacket, sh, 0, -0.17, 0);
    const el = new THREE.Group();
    el.position.y = -0.34;
    sh.add(el);
    part(new THREE.CapsuleGeometry(0.06, 0.2, 4, 10), jacket, el, 0, -0.14, 0);
    part(new THREE.SphereGeometry(0.06, 10, 8), skin, el, 0, -0.3, 0);
    return { sh, el };
  };
  const aL = mkArm(-1);
  const aR = mkArm(1);

  const props = {};
  if (variant === 0) {
    // camera met lange lens voor het gezicht, arm omhoog
    const cam = new THREE.Group();
    cam.position.set(0, 0.68, -0.28);
    torso.add(cam);
    part(new THREE.BoxGeometry(0.2, 0.15, 0.14), dark, cam);
    const lens = part(new THREE.CylinderGeometry(0.06, 0.07, 0.34, 14), dark, cam, 0, 0, -0.22);
    lens.rotation.x = Math.PI / 2;
    const glass = part(new THREE.CircleGeometry(0.055, 14), mat('#3a4f78', { roughness: 0.05, metalness: 0.8 }), cam, 0, 0, -0.395);
    glass.rotation.y = Math.PI;
    glass.castShadow = false;
    aL.sh.rotation.x = 1.5;
    aL.el.rotation.x = 1.2;
    aR.sh.rotation.x = 1.5;
    aR.el.rotation.x = 1.2;
    props.cam = cam;
  } else if (variant === 1) {
    const bino = new THREE.Group();
    bino.position.set(0, 0.7, -0.24);
    torso.add(bino);
    [-1, 1].forEach((s) => {
      const t = part(new THREE.CylinderGeometry(0.045, 0.055, 0.22, 12), dark, bino, s * 0.065, 0, -0.08);
      t.rotation.x = Math.PI / 2;
    });
    aL.sh.rotation.x = 1.7;
    aL.el.rotation.x = 1.5;
    aR.sh.rotation.x = 1.7;
    aR.el.rotation.x = 1.5;
    props.cam = bino;
  } else {
    const book = part(new THREE.BoxGeometry(0.22, 0.03, 0.3), mat('#f2efe0'), torso, 0.05, 0.4, -0.38);
    book.rotation.x = -0.5;
    aL.sh.rotation.x = 0.9;
    aL.el.rotation.x = 1.0;
    aR.sh.rotation.x = 1.0;
    aR.el.rotation.x = 1.4;
    const thermos = part(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 10), mat('#a9262a', { metalness: 0.4, roughness: 0.4 }), rig, 0.3, 0.13, -0.2);
    thermos.castShadow = false;
  }

  // zwevend +30-label
  const tag = new THREE.Sprite(getTagMat());
  tag.scale.set(1.2, 0.6, 1);
  tag.position.y = 2.45;
  g.add(tag);

  g.userData = { rig, torso, head, tag, aL, aR, props, variant, phase: rand() * 6.28 };
  return g;
}

export function animateSpotter(g, t, lookX, dt) {
  const u = g.userData;
  const k = t * 1.6 + u.phase;
  u.torso.rotation.y = Math.sin(k * 0.5) * 0.06;
  u.torso.position.y = 1.0 + Math.sin(k) * 0.01;
  // kijkt de speler/trein na
  u.head.rotation.y += (Math.max(-0.9, Math.min(0.9, lookX)) - u.head.rotation.y) * Math.min(1, dt * 6);
  u.tag.position.y = 2.45 + Math.sin(t * 3 + u.phase) * 0.08;
  if (u.variant === 2) {
    u.aR.el.rotation.x = 1.4 + Math.sin(t * 6 + u.phase) * 0.15; // schrijft
  }
}
