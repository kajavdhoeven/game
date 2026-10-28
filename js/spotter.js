import * as THREE from 'three';
import { canvasTex, softCircleTexture } from './textures.js';
import { mergeOwn } from './merge.js';

const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, ...o });

const JACKETS = ['#3f7d3a', '#2f5f9e', '#b52b2b', '#c9a227', '#6d5a8a', '#4a5560', '#1f7a7a'];
const SKINS = ['#f1c4a0', '#e0a882', '#c68863', '#8d5a3c', '#f6d2b5'];
const HATS = ['#222831', '#a33a2f', '#2e5d34', '#d9d9d9', '#d79a1e', '#1d3b7a'];

const tagMats = {};
function getTagMat(special) {
  const key = special ? 'x' : 'n';
  if (tagMats[key]) return tagMats[key];
  const tex = canvasTex(128, 64, (g, w, h) => {
    g.fillStyle = special ? 'rgba(120,70,0,0.95)' : 'rgba(0,48,130,0.92)';
    g.beginPath();
    g.roundRect(4, 4, w - 8, h - 8, 16);
    g.fill();
    g.strokeStyle = special ? '#fff3a0' : '#ffc917';
    g.lineWidth = special ? 6 : 4;
    g.stroke();
    g.fillStyle = special ? '#ffe45a' : '#ffc917';
    g.font = '900 32px "Arial Black", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(special ? '+100' : '+25', w / 2, h / 2 + 2);
  });
  tagMats[key] = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  return tagMats[key];
}

let flashTex = null;

function part(geo, m, parent, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.castShadow = true;
  parent.add(o);
  return o;
}

export const SPOTTER_VALUE = 25;
export const SPOTTER_VALUE_SPECIAL = 100;

// behavior: photo | follow | binocular | notes | cheer
const BEHAVIORS = ['photo', 'photo', 'follow', 'binocular', 'notes', 'cheer'];

export function createSpotter(rand, opts = {}) {
  const special = opts.special ?? rand() < 0.1;
  const behavior = opts.behavior || BEHAVIORS[(rand() * BEHAVIORS.length) | 0];
  const skin = mat(SKINS[(rand() * SKINS.length) | 0], { roughness: 0.6 });
  const jacketColor = special ? '#ff6a00' : JACKETS[(rand() * JACKETS.length) | 0];
  const jacket = mat(jacketColor, special ? { emissive: '#ff4a00', emissiveIntensity: 0.25 } : {});
  const pants = mat('#2a3550');
  const hatC = mat(HATS[(rand() * HATS.length) | 0]);
  const dark = mat('#141414', { roughness: 0.4, metalness: 0.5 });
  const white = mat('#ffffff', { roughness: 0.4 });

  const g = new THREE.Group();
  const rig = new THREE.Group();
  g.add(rig);
  const scale = 0.94 + rand() * 0.14;
  rig.scale.setScalar(scale);

  // benen en schoenen
  const legs = [];
  [-1, 1].forEach((s) => {
    const leg = new THREE.Group();
    leg.position.set(s * 0.14, 0.92, 0);
    rig.add(leg);
    part(new THREE.CapsuleGeometry(0.1, 0.62, 4, 10), pants, leg, 0, -0.45, 0);
    const shoe = part(new THREE.BoxGeometry(0.17, 0.1, 0.3), mat('#2b2018'), leg, 0, -0.87, -0.05);
    shoe.castShadow = false;
    legs.push(leg);
  });
  const torso = new THREE.Group();
  torso.position.y = 1.0;
  rig.add(torso);
  part(new THREE.CapsuleGeometry(0.24, 0.36, 6, 14), jacket, torso, 0, 0.18, 0);
  if (special || jacketColor === '#ff6a00') {
    part(new THREE.BoxGeometry(0.5, 0.05, 0.4), mat('#e8eef0', { roughness: 0.3, metalness: 0.3 }), torso, 0, 0.12, 0);
    part(new THREE.BoxGeometry(0.5, 0.05, 0.4), mat('#e8eef0', { roughness: 0.3, metalness: 0.3 }), torso, 0, 0.3, 0);
  }
  part(new THREE.BoxGeometry(0.3, 0.38, 0.16), mat('#333a44'), torso, 0, 0.22, 0.26);
  // camerariem
  const strap = part(new THREE.TorusGeometry(0.24, 0.015, 6, 20, Math.PI), dark, torso, 0, 0.42, 0);
  strap.rotation.z = Math.PI;
  strap.scale.set(1, 0.9, 0.9);
  strap.castShadow = false;

  // hoofd met gezicht
  const head = new THREE.Group();
  head.position.y = 0.66;
  torso.add(head);
  part(new THREE.SphereGeometry(0.2, 20, 16), skin, head);
  part(new THREE.SphereGeometry(0.04, 10, 8), mat('#d98f7a'), head, 0, -0.02, -0.2);
  const style = (rand() * 3) | 0;
  if (style === 0) { // pet
    part(new THREE.SphereGeometry(0.21, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatC, head, 0, 0.05, 0);
    part(new THREE.BoxGeometry(0.3, 0.025, 0.16), hatC, head, 0, 0.07, -0.22).rotation.x = 0.1;
  } else if (style === 1) { // muts
    part(new THREE.SphereGeometry(0.215, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatC, head, 0, 0.04, 0);
    part(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 20), hatC, head, 0, 0.055, 0);
  } else { // bucket hat
    part(new THREE.CylinderGeometry(0.2, 0.22, 0.13, 20), hatC, head, 0, 0.12, 0);
    part(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 24), hatC, head, 0, 0.06, 0);
  }
  if (rand() < 0.35) { // bril
    [-1, 1].forEach((s) => {
      const r = part(new THREE.TorusGeometry(0.055, 0.01, 8, 18), dark, head, s * 0.075, 0.03, -0.19);
      r.castShadow = false;
    });
  }
  if (rand() < 0.3) part(new THREE.SphereGeometry(0.13, 12, 10), mat('#5a3a22'), head, 0, -0.12, -0.1).scale.set(1, 0.7, 0.8);

  // gezicht: losse onderdelen
  const eyes = [];
  const brows = [];
  [-1, 1].forEach((s) => {
    const e = new THREE.Group();
    e.position.set(s * 0.075, 0.03, -0.18);
    head.add(e);
    part(new THREE.SphereGeometry(0.032, 10, 8), white, e).castShadow = false;
    const pu = part(new THREE.SphereGeometry(0.016, 8, 8), dark, e, 0, 0, -0.026);
    pu.castShadow = false;
    eyes.push({ g: e, pupil: pu });
    const b = new THREE.Group();
    b.position.set(s * 0.075, 0.1, -0.185);
    head.add(b);
    const bm = part(new THREE.BoxGeometry(0.07, 0.014, 0.014), dark, b);
    bm.castShadow = false;
    brows.push({ g: b, side: s });
  });
  const mouths = {};
  const mouthPos = [0, -0.09, -0.185];
  const mLine = part(new THREE.BoxGeometry(0.07, 0.012, 0.012), dark, head, ...mouthPos);
  const mSmile = part(new THREE.TorusGeometry(0.05, 0.01, 6, 14, Math.PI), mat('#7a2a2a'), head, 0, -0.07, -0.185);
  mSmile.rotation.z = Math.PI;
  const mO = part(new THREE.SphereGeometry(0.035, 10, 8), mat('#3a0e0e'), head, ...mouthPos);
  mO.scale.set(0.9, 1.2, 0.5);
  const mGrin = part(new THREE.BoxGeometry(0.11, 0.045, 0.012), white, head, 0, -0.085, -0.186);
  [mLine, mSmile, mO, mGrin].forEach((m) => { m.castShadow = false; m.visible = false; });
  mouths.line = mLine;
  mouths.smile = mSmile;
  mouths.o = mO;
  mouths.grin = mGrin;
  mLine.visible = true;

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

  // camera / verrekijker / notitieboekje
  const prop = new THREE.Group();
  torso.add(prop);
  let flash = null;
  if (behavior === 'photo' || behavior === 'follow') {
    // duidelijke spiegelreflexcamera met lange lens, zoeker en flitser
    const cam = new THREE.Group();
    prop.add(cam);
    part(new THREE.BoxGeometry(0.24, 0.17, 0.14), dark, cam);
    part(new THREE.BoxGeometry(0.08, 0.06, 0.07), dark, cam, 0, 0.115, 0.02);
    part(new THREE.BoxGeometry(0.05, 0.03, 0.05), mat('#e03030'), cam, 0.08, 0.09, -0.06).castShadow = false;
    const lens = part(new THREE.CylinderGeometry(0.065, 0.075, 0.34, 16), dark, cam, 0, 0, -0.24);
    lens.rotation.x = Math.PI / 2;
    part(new THREE.CylinderGeometry(0.072, 0.072, 0.05, 16), mat('#d9d9d9', { metalness: 0.8 }), cam, 0, 0, -0.36).rotation.x = Math.PI / 2;
    const glass = part(new THREE.CircleGeometry(0.058, 16), mat('#3a4f78', { roughness: 0.05, metalness: 0.8 }), cam, 0, 0, -0.388);
    glass.rotation.y = Math.PI;
    glass.castShadow = false;
    if (!flashTex) flashTex = softCircleTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    flash.position.set(0, 0.0, -0.42);
    flash.scale.set(1.4, 1.4, 1);
    flash.visible = false;
    cam.add(flash);
    prop.userData.cam = cam;
  } else if (behavior === 'binocular') {
    const bino = new THREE.Group();
    prop.add(bino);
    [-1, 1].forEach((s) => {
      const t = part(new THREE.CylinderGeometry(0.045, 0.055, 0.24, 12), dark, bino, s * 0.065, 0, -0.08);
      t.rotation.x = Math.PI / 2;
      part(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 12), mat('#5a7ec8', { metalness: 0.8, roughness: 0.1 }), bino, s * 0.065, 0, -0.2).rotation.x = Math.PI / 2;
    });
    part(new THREE.BoxGeometry(0.1, 0.03, 0.12), dark, bino, 0, 0, -0.06);
    prop.userData.cam = bino;
  } else if (behavior === 'notes') {
    const book = new THREE.Group();
    prop.add(book);
    part(new THREE.BoxGeometry(0.22, 0.03, 0.3), mat('#f2efe0'), book);
    part(new THREE.BoxGeometry(0.23, 0.02, 0.31), mat('#1f3a7a'), book, 0, -0.02, 0);
    const pen = part(new THREE.CylinderGeometry(0.008, 0.008, 0.12, 6), mat('#d03030'), book, 0.06, 0.03, -0.05);
    pen.rotation.z = 1.2;
    prop.userData.cam = book;
    prop.userData.pen = pen;
    part(new THREE.CylinderGeometry(0.05, 0.05, 0.25, 10), mat('#a9262a', { metalness: 0.4, roughness: 0.4 }), rig, 0.3, 0.13, -0.2).castShadow = false;
  } else {
    // cheer: zwaait met een vlaggetje met NS-logo
    const flag = new THREE.Group();
    prop.add(flag);
    part(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 6), mat('#6b4a2c'), flag, 0, 0.3, 0);
    part(new THREE.BoxGeometry(0.34, 0.2, 0.01), mat('#ffc917'), flag, 0.17, 0.55, 0);
    part(new THREE.BoxGeometry(0.14, 0.09, 0.012), mat('#003082'), flag, 0.17, 0.55, 0.004);
    prop.userData.cam = flag;
  }

  mergeOwn(rig);
  mergeOwn(torso);

  // +25 / +100 label
  const tag = new THREE.Sprite(getTagMat(special));
  tag.scale.set(special ? 1.5 : 1.2, special ? 0.75 : 0.6, 1);
  tag.position.y = 2.5;
  g.add(tag);

  g.userData = {
    rig, torso, head, tag, aL, aR, prop, legs, eyes, brows, mouths, flash, behavior, special,
    phase: rand() * 6.28, startled: rand() < 0.28, jacketMat: jacket, jacketColor,
    flashT: 0, nextFlash: 0.3 + rand() * 1.2, mood: 'idle', reactT: 0, wet: 0, value: special ? SPOTTER_VALUE_SPECIAL : SPOTTER_VALUE,
    headYaw: 0, headPitch: 0,
  };
  return g;
}

function setFace(u, mouth, brow, eyeScale = 1) {
  Object.entries(u.mouths).forEach(([k, m]) => { m.visible = k === mouth; });
  u.brows.forEach((b) => {
    b.g.rotation.z = brow === 'up' ? b.side * 0.3 : brow === 'down' ? -b.side * 0.35 : 0;
    b.g.position.y = brow === 'up' ? 0.125 : 0.1;
  });
  u.eyes.forEach((e) => { e.g.scale.setScalar(eyeScale); });
}

const lerp = (a, b, k) => a + (b - a) * k;
function armTo(arm, x, z, ex, k) {
  arm.sh.rotation.x = lerp(arm.sh.rotation.x, x, k);
  arm.sh.rotation.z = lerp(arm.sh.rotation.z, z, k);
  arm.el.rotation.x = lerp(arm.el.rotation.x, ex, k);
}

// ctx: { train: {dx, dz, special, speed} | null, player: {dx, dz} | null, side }
// Geeft true terug op het moment dat een foto wordt genomen.
export function animateSpotter(g, t, dt, ctx) {
  const u = g.userData;
  const k = Math.min(1, dt * 9);
  const tr = ctx.train;
  const near = tr ? Math.max(0, 1 - Math.hypot(tr.dx, tr.dz) / 55) : 0;
  const veryNear = tr && Math.abs(tr.dz) < 12 && Math.abs(tr.dx) < 12;
  const excited = tr && tr.special && near > 0.15;

  // stemming bepalen
  let mood = 'idle';
  if (excited) mood = 'excited';
  else if (tr && veryNear && u.startled) mood = 'amazed';
  else if (near > 0.1) mood = u.behavior;
  if (ctx.player && Math.abs(ctx.player.dz) < 14 && !tr) mood = 'notice';
  if (u.wet > 0) mood = 'soaked';
  u.mood = mood;

  const bounce = mood === 'excited' ? Math.abs(Math.sin(t * 9 + u.phase)) * 0.22 : mood === 'cheer' ? Math.abs(Math.sin(t * 6 + u.phase)) * 0.08 : 0;
  u.torso.position.y = 1.0 + bounce + Math.sin(t * 1.6 + u.phase) * 0.01;
  u.legs.forEach((l, i) => { l.rotation.x = mood === 'excited' ? Math.sin(t * 9 + u.phase + i * Math.PI) * 0.25 : 0; });

  // kijkrichting: richting trein, anders naar de speler, anders voor zich uit
  let tx = 0;
  let tz = 0;
  let have = false;
  if (tr) { tx = tr.dx; tz = tr.dz; have = true; }
  else if (ctx.player) { tx = ctx.player.dx; tz = ctx.player.dz; have = true; }
  if (have) {
    const worldYaw = Math.atan2(-tx, -tz);
    let rel = worldYaw - g.rotation.y;
    rel = Math.atan2(Math.sin(rel), Math.cos(rel));
    u.headYaw = lerp(u.headYaw, Math.max(-1.25, Math.min(1.25, rel)), Math.min(1, dt * (mood === 'follow' || mood === 'photo' ? 5 : 3)));
  } else {
    u.headYaw = lerp(u.headYaw, Math.sin(t * 0.5 + u.phase) * 0.4, Math.min(1, dt * 2));
  }
  u.head.rotation.y = u.headYaw;
  u.head.rotation.x = lerp(u.head.rotation.x, mood === 'amazed' ? -0.25 : mood === 'excited' ? -0.12 : 0, k);

  let took = false;
  const cam = u.prop.userData.cam;
  const raise = (kk = k) => {
    armTo(u.aL, 1.35, 0.1, 1.35, kk);
    armTo(u.aR, 1.35, -0.1, 1.35, kk);
  };
  u.prop.position.set(0, 0.7, -0.26);
  u.prop.rotation.set(0, u.headYaw * 0.8, 0);

  if (mood === 'photo' || (mood === 'excited' && u.behavior !== 'cheer' && u.behavior !== 'notes')) {
    // camera voor het gezicht, regelmatig een foto met flits
    raise();
    setFace(u, mood === 'excited' ? 'grin' : 'line', 'none', 0.8);
    u.prop.position.set(0, 0.74, -0.2);
    if (cam && u.behavior === 'photo') cam.rotation.x = 0;
    u.nextFlash -= dt;
    if (u.behavior === 'photo' && u.nextFlash <= 0) {
      u.flashT = 0.09;
      u.nextFlash = (mood === 'excited' ? 0.45 : 1.1) + Math.random() * 1.3;
      took = true;
    }
  } else if (mood === 'follow') {
    // camera volgt de trein, ruime zwaai met het hele bovenlijf
    raise();
    setFace(u, 'line', 'down', 0.9);
    u.prop.position.set(0, 0.7, -0.26);
    u.torso.rotation.y = lerp(u.torso.rotation.y, u.headYaw * 0.5, k);
  } else if (mood === 'binocular') {
    raise(k);
    setFace(u, 'line', 'none', 0.8);
    u.prop.position.set(0, 0.72, -0.2);
  } else if (mood === 'notes') {
    armTo(u.aL, 0.7, 0.1, 1.2, k);
    armTo(u.aR, 0.9, -0.1, 1.3 + Math.sin(t * 9) * 0.15, k);
    setFace(u, 'smile', 'none', 1);
    u.prop.position.set(0.04, 0.4, -0.34);
    u.prop.rotation.x = -0.6;
    u.head.rotation.x = 0.35 + Math.sin(t * 2) * 0.03;
  } else if (mood === 'cheer' || mood === 'excited') {
    // juichen, zwaaien met vlaggetje
    armTo(u.aL, 2.9, 0.4, 0.2 + Math.sin(t * 10) * 0.3, k);
    armTo(u.aR, 2.8 + Math.sin(t * 8) * 0.25, -0.35, 0.2, k);
    setFace(u, 'grin', 'up', 1.15);
    u.prop.position.set(0.3, 1.0, -0.05);
    u.prop.rotation.z = Math.sin(t * 8) * 0.3;
  } else if (mood === 'amazed') {
    // handen op het hoofd, mond open
    armTo(u.aL, 2.9, 0.9, 1.6, k);
    armTo(u.aR, 2.9, -0.9, 1.6, k);
    setFace(u, 'o', 'up', 1.45);
    u.prop.position.set(0.0, 0.4, -0.3);
    u.torso.rotation.x = lerp(u.torso.rotation.x, -0.15, k);
  } else if (mood === 'notice') {
    // zwaait naar Te-Un
    armTo(u.aL, 0.1, 0.12, 0.2, k);
    armTo(u.aR, 0.1, -2.5 + Math.sin(t * 9) * 0.25, 0.3, k);
    setFace(u, 'smile', 'up', 1.05);
    u.prop.position.set(0, 0.35, -0.3);
  } else if (mood === 'soaked') {
    // doorweekt: bibbert en schudt
    armTo(u.aL, 2.4, 0.8, 1.2, k);
    armTo(u.aR, 2.4, -0.8, 1.2, k);
    setFace(u, 'o', 'up', 1.5);
    u.torso.rotation.z = Math.sin(t * 40) * 0.05;
  } else {
    // rustig: camera hangt voor de borst, kijkt rond, af en toe nipt hij aan de thermos
    armTo(u.aL, 0.3, 0.12, 0.7, k);
    armTo(u.aR, 0.3, -0.12, 0.7, k);
    setFace(u, Math.sin(t * 0.3 + u.phase) > 0.6 ? 'smile' : 'line', 'none', 1);
    u.prop.position.set(0, 0.3, -0.3);
    u.prop.rotation.x = 0.2;
  }
  if (mood !== 'follow' && mood !== 'soaked') u.torso.rotation.y = lerp(u.torso.rotation.y, Math.sin(t * 0.5 + u.phase) * 0.06, k);
  if (mood !== 'amazed') u.torso.rotation.x = lerp(u.torso.rotation.x, 0, k);
  if (mood !== 'soaked') u.torso.rotation.z = lerp(u.torso.rotation.z, 0, k);

  // pupillen volgen de trein
  u.eyes.forEach((e) => {
    e.pupil.position.x = lerp(e.pupil.position.x, Math.max(-0.012, Math.min(0.012, u.headYaw * 0.02)), k);
  });

  // flits
  if (u.flash) {
    if (u.flashT > 0) {
      u.flashT -= dt;
      u.flash.visible = true;
      const s = 1.2 + (0.09 - u.flashT) * 8;
      u.flash.scale.set(s, s, 1);
    } else u.flash.visible = false;
  }
  u.tag.position.y = 2.5 + Math.sin(t * 3 + u.phase) * 0.08;
  if (u.wet > 0) u.wet -= dt * 0.15;
  return took;
}

// nat jack: donkerder en glanzend
export function soak(g) {
  const u = g.userData;
  u.wet = 1;
  u.jacketMat.color.multiplyScalar(0.55);
  u.jacketMat.roughness = 0.25;
}

export function resetSpotter(g) {
  const u = g.userData;
  u.jacketMat.color.set(u.jacketColor);
  u.jacketMat.roughness = 0.75;
  u.wet = 0;
  u.flashT = 0;
  g.rotation.set(0, 0, 0);
  g.position.set(0, 0, 0);
  u.rig.visible = true;
  u.tag.visible = true;
}
