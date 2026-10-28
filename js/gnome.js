import * as THREE from 'three';
import { mergeOwn } from './merge.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...o });
const P = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.5, ...o });

function mesh(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

function capsule(r, len, mat, parent) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
  m.castShadow = true;
  if (parent) parent.add(m);
  return m;
}

// Te-Un: de kabouter. Kijkrichting is -z (de loopbaan).
export function createGnome() {
  const skin = M('#f1c4a0', { roughness: 0.6 });
  const tunic = M('#2f7a4b', { roughness: 0.85 });
  const trousers = M('#6a4a2e', { roughness: 0.9 });
  const white = M('#f8f8f4', { roughness: 0.95 });
  const redHat = M('#d3202a', { roughness: 0.78 });
  const leather = M('#7a4a22', { roughness: 0.6 });
  const black = P('#0a0a0c', { roughness: 0.18, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  // smurfblauw, glanzend
  const smurf = P('#2f8cf0', { roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15 });
  const sole = M('#f2efe6', { roughness: 0.8 });

  const root = new THREE.Group();
  const flip = new THREE.Group(); // draaipunt voor de rol
  flip.position.y = 0.6;
  root.add(flip);
  const rig = new THREE.Group();
  rig.position.y = -0.6;
  flip.add(rig);

  // --- benen met knie en smurfblauwe schoenen ---
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0.56, 0);
    rig.add(hip);
    const thigh = capsule(0.075, 0.12, trousers, hip);
    thigh.position.y = -0.14;
    const knee = new THREE.Group();
    knee.position.y = -0.28;
    hip.add(knee);
    const shin = capsule(0.062, 0.1, trousers, knee);
    shin.position.y = -0.12;
    const sock = mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.09, 12), white, knee, 0, -0.2, 0);
    sock.castShadow = false;
    const ankle = new THREE.Group();
    ankle.position.y = -0.26;
    knee.add(ankle);
    // schoen: langwerpig, afgerond, met zool en lichte teenkap
    const shoe = mesh(new THREE.SphereGeometry(1, 20, 14), smurf, ankle, 0, -0.02, -0.07);
    shoe.scale.set(0.095, 0.075, 0.185);
    const toe = mesh(new THREE.SphereGeometry(1, 16, 12), smurf, ankle, 0, 0.004, -0.17);
    toe.scale.set(0.082, 0.07, 0.1);
    const sl = mesh(new THREE.SphereGeometry(1, 20, 6), sole, ankle, 0, -0.085, -0.075);
    sl.scale.set(0.1, 0.02, 0.2);
    sl.castShadow = false;
    const lace = mesh(new THREE.BoxGeometry(0.07, 0.012, 0.07), white, ankle, 0, 0.04, -0.05);
    lace.castShadow = false;
    return { hip, knee, ankle };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // --- romp / tuniek ---
  const torso = new THREE.Group();
  torso.position.y = 0.62;
  rig.add(torso);
  const tunicShape = [
    [0.0, 0.0], [0.23, 0.0], [0.25, 0.04], [0.21, 0.18], [0.185, 0.3],
    [0.2, 0.38], [0.15, 0.44], [0.0, 0.46],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = mesh(new THREE.LatheGeometry(tunicShape, 24), tunic, torso, 0, -0.02, 0);
  body.scale.z = 0.82;
  const belt = mesh(new THREE.TorusGeometry(0.205, 0.022, 8, 28), leather, torso, 0, 0.14, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.82, 1);
  const buckle = mesh(new THREE.BoxGeometry(0.07, 0.06, 0.02), M('#e8b830', { metalness: 0.9, roughness: 0.25 }), torso, 0, 0.14, -0.178);
  const bpMat = M('#8c5a2b', { roughness: 0.75 });
  const pack = mesh(new THREE.BoxGeometry(0.28, 0.3, 0.13), bpMat, torso, 0, 0.24, 0.2);
  const flap = mesh(new THREE.BoxGeometry(0.29, 0.1, 0.14), M('#6f4620', { roughness: 0.75 }), torso, 0, 0.34, 0.2);
  const roll = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12), M('#b24a3a', { roughness: 0.9 }), torso, 0, 0.08, 0.2);
  roll.rotation.z = Math.PI / 2;
  const strapL = mesh(new THREE.BoxGeometry(0.03, 0.34, 0.02), leather, torso, -0.1, 0.24, -0.12);
  strapL.rotation.z = 0.1;
  strapL.rotation.x = 0.1;
  const strapR = strapL.clone();
  strapR.position.x = 0.1;
  strapR.rotation.z = -0.1;
  torso.add(strapR);

  // --- armen ---
  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.23, 0.38, 0);
    torso.add(sh);
    const up = capsule(0.056, 0.1, tunic, sh);
    up.position.y = -0.1;
    const el = new THREE.Group();
    el.position.y = -0.2;
    sh.add(el);
    const low = capsule(0.05, 0.09, tunic, el);
    low.position.y = -0.1;
    const cuff = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 12), white, el, 0, -0.2, 0);
    cuff.castShadow = false;
    const hand = mesh(new THREE.SphereGeometry(0.062, 14, 12), white, el, 0, -0.26, 0);
    return { sh, el };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // --- hoofd ---
  const head = new THREE.Group();
  head.position.y = 0.62 + 0.46 + 0.17;
  rig.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.235, 32, 24), skin, head);
  skull.scale.set(1, 0.97, 0.98);
  const nose = mesh(new THREE.SphereGeometry(0.06, 16, 14), M('#e79a86', { roughness: 0.55 }), head, 0, -0.045, -0.235);
  const cheekL = mesh(new THREE.SphereGeometry(0.045, 12, 10), M('#ee9c8c', { roughness: 0.7 }), head, -0.13, -0.07, -0.19);
  cheekL.scale.z = 0.5;
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.13;
  head.add(cheekR);
  // oren (puntig)
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(0.05, 0.16, 12), skin, head, s * 0.235, 0.0, 0.01);
    ear.rotation.z = -s * 1.2;
    ear.position.y = 0.02;
  }
  // ogen achter de bril
  const eyeMat = M('#ffffff', { roughness: 0.3 });
  const pupilMat = P('#0b0b0e', { roughness: 0.1, clearcoat: 1 });
  for (const s of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.04, 14, 12), eyeMat, head, s * 0.095, 0.045, -0.2);
    eye.castShadow = false;
    const pupil = mesh(new THREE.SphereGeometry(0.02, 12, 10), pupilMat, head, s * 0.095, 0.045, -0.235);
    pupil.castShadow = false;
    const brow = mesh(new THREE.CapsuleGeometry(0.012, 0.07, 4, 8), white, head, s * 0.097, 0.125, -0.205);
    brow.rotation.z = Math.PI / 2 + s * 0.12;
    brow.castShadow = false;
  }
  // ronde zwarte bril
  const glassLens = new THREE.MeshPhysicalMaterial({
    color: '#bcd4ee', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16,
    clearcoat: 1, envMapIntensity: 2.2,
  });
  for (const s of [-1, 1]) {
    const rim = mesh(new THREE.TorusGeometry(0.093, 0.0145, 12, 40), black, head, s * 0.105, 0.045, -0.222);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.092, 32), glassLens);
    lens.position.set(s * 0.105, 0.045, -0.223);
    lens.rotation.y = Math.PI;
    head.add(lens);
    const arm = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 8), black, head, s * 0.214, 0.045, -0.105);
    arm.rotation.x = Math.PI / 2;
    arm.castShadow = false;
  }
  const bridge = mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16, Math.PI), black, head, 0, 0.065, -0.225);
  bridge.castShadow = false;

  // baard (gelaagd) en snor
  const beard = new THREE.Group();
  head.add(beard);
  const beardMain = mesh(new THREE.ConeGeometry(0.2, 0.46, 24, 1), white, beard, 0, -0.27, -0.09);
  beardMain.rotation.x = 0.1;
  beardMain.scale.z = 0.72;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI - Math.PI / 2;
    const lump = mesh(new THREE.SphereGeometry(0.07 + (i % 3) * 0.012, 12, 10), white, beard,
      Math.sin(a) * 0.18, -0.13 - Math.cos(a) * 0.06 - (i % 2) * 0.03, -0.16 + Math.cos(a) * 0.01);
    lump.scale.z = 0.8;
  }
  for (const s of [-1, 1]) {
    const mus = mesh(new THREE.CapsuleGeometry(0.03, 0.08, 4, 10), white, beard, s * 0.05, -0.095, -0.232);
    mus.rotation.z = Math.PI / 2 - s * 0.35;
  }

  // muts: gebogen punt van gestapelde delen, flapt mee
  const hatBase = new THREE.Group();
  hatBase.position.set(0, 0.1, 0.01);
  hatBase.rotation.x = -0.06;
  head.add(hatBase);
  const band = mesh(new THREE.TorusGeometry(0.235, 0.028, 10, 36), leather, hatBase, 0, 0.0, 0);
  band.rotation.x = Math.PI / 2;
  const hatParts = [];
  const segs = [
    { r0: 0.245, r1: 0.19, h: 0.17 },
    { r0: 0.19, r1: 0.14, h: 0.17 },
    { r0: 0.14, r1: 0.095, h: 0.16 },
    { r0: 0.095, r1: 0.05, h: 0.15 },
    { r0: 0.05, r1: 0.012, h: 0.14 },
  ];
  let parent = hatBase;
  let yOff = 0;
  segs.forEach((s, i) => {
    const g = new THREE.Group();
    g.position.y = yOff;
    parent.add(g);
    const m = mesh(new THREE.CylinderGeometry(s.r1, s.r0, s.h, 24, 1), redHat, g, 0, s.h / 2, 0);
    m.castShadow = true;
    hatParts.push(g);
    parent = g;
    yOff = s.h - 0.005;
  });
  const hatTip = mesh(new THREE.SphereGeometry(0.02, 10, 8), redHat, parent, 0, yOff, 0);

  // draw calls beperken: statische onderdelen per lichaamsdeel samenvoegen
  [legL, legR].forEach((l) => { mergeOwn(l.hip); mergeOwn(l.knee); mergeOwn(l.ankle); });
  [armL, armR].forEach((a) => { mergeOwn(a.sh); mergeOwn(a.el); });
  mergeOwn(torso);
  mergeOwn(head);
  mergeOwn(beard);
  mergeOwn(hatBase);

  // --- animatie ---
  const pose = { phase: 0 };
  let waveT = 0;

  function setLegs(a, k, side, leg) {
    leg.hip.rotation.x = a;
    leg.knee.rotation.x = k;
    leg.ankle.rotation.x = -(a + k) * 0.35 + 0.05;
  }

  function resetPose() {
    flip.rotation.set(0, 0, 0);
    flip.position.y = 0.6;
    flip.scale.set(1, 1, 1);
    torso.rotation.set(0, 0, 0);
    root.rotation.z = 0;
    head.rotation.set(0, 0, 0);
  }

  function hat(t, lean, energy) {
    hatParts.forEach((g, i) => {
      g.rotation.x = 0.16 + lean * 0.06 + Math.sin(t * 7 + i * 0.7) * 0.05 * energy + energy * 0.05;
      g.rotation.z = Math.sin(t * 5.3 + i) * 0.04 * energy;
    });
    hatBase.rotation.x = -0.06 + lean * 0.05;
  }

  return {
    root,
    head,
    hatBase,
    // state: 'run' | 'jump' | 'roll' | 'idle' | 'dead'
    update(state, dt, t, speed01 = 0, vx = 0, extra = {}) {
      resetPose();
      if (state === 'run') {
        pose.phase += dt * (9 + speed01 * 5);
        const p = pose.phase;
        const s1 = Math.sin(p);
        const s2 = Math.sin(p + Math.PI);
        const c1 = Math.cos(p);
        const c2 = Math.cos(p + Math.PI);
        setLegs(s1 * 0.95, -(Math.max(0, c1) * 1.15 + 0.12), 1, legL);
        setLegs(s2 * 0.95, -(Math.max(0, c2) * 1.15 + 0.12), -1, legR);
        armL.sh.rotation.x = -s1 * 0.95;
        armR.sh.rotation.x = -s2 * 0.95;
        armL.el.rotation.x = 0.55 + Math.max(0, s1) * 0.4;
        armR.el.rotation.x = 0.55 + Math.max(0, s2) * 0.4;
        armL.sh.rotation.z = 0.1;
        armR.sh.rotation.z = -0.1;
        rig.position.y = -0.6 + Math.abs(Math.sin(p)) * 0.055;
        torso.rotation.x = -0.14;
        torso.rotation.y = Math.sin(p) * 0.12;
        head.rotation.x = 0.1;
        head.rotation.z = Math.sin(p * 0.5) * 0.03;
        hat(t, 1, 0.8 + speed01);
        root.rotation.z = -vx * 0.035;
        root.rotation.y = -vx * 0.03;
      } else if (state === 'jump') {
        const rising = extra.vy > 0;
        setLegs(rising ? 1.0 : 0.55, rising ? -1.35 : -0.9, 1, legL);
        setLegs(rising ? -0.5 : -0.25, rising ? -0.5 : -0.4, -1, legR);
        armL.sh.rotation.x = rising ? 2.5 : 1.7;
        armR.sh.rotation.x = rising ? 2.5 : 1.7;
        armL.sh.rotation.z = 0.35;
        armR.sh.rotation.z = -0.35;
        armL.el.rotation.x = 0.2;
        armR.el.rotation.x = 0.2;
        rig.position.y = -0.6;
        torso.rotation.x = rising ? -0.05 : 0.0;
        head.rotation.x = rising ? -0.1 : 0.05;
        hat(t, rising ? -1.2 : 2.2, 1.6);
        root.rotation.z = -vx * 0.035;
      } else if (state === 'roll') {
        const k = Math.min(1, extra.rollT || 0);
        flip.rotation.x = -k * Math.PI * 2;
        flip.position.y = 0.38;
        flip.scale.set(1, 0.82, 1);
        setLegs(1.5, -1.9, 1, legL);
        setLegs(1.5, -1.9, -1, legR);
        armL.sh.rotation.x = 1.4;
        armR.sh.rotation.x = 1.4;
        armL.el.rotation.x = 1.5;
        armR.el.rotation.x = 1.5;
        torso.rotation.x = -0.6;
        head.rotation.x = 0.5;
        rig.position.y = -0.6;
        hat(t, 0, 1);
      } else if (state === 'dead') {
        const k = Math.min(1, extra.deadT || 0);
        flip.rotation.x = k * 1.35;
        flip.position.y = 0.6 - k * 0.3;
        setLegs(-0.3, -0.2, 1, legL);
        setLegs(0.2, -0.5, -1, legR);
        armL.sh.rotation.x = 2.2;
        armR.sh.rotation.x = 2.0;
        armL.sh.rotation.z = 0.8;
        armR.sh.rotation.z = -0.8;
        armL.el.rotation.x = 0.1;
        armR.el.rotation.x = 0.1;
        rig.position.y = -0.6;
        hat(t, 0, 0.3);
      } else {
        // idle: adem, kijkt rond, zwaait
        waveT += dt;
        const br = Math.sin(t * 2.2);
        setLegs(0.03, -0.02, 1, legL);
        setLegs(-0.02, -0.02, -1, legR);
        armL.sh.rotation.x = br * 0.05;
        armL.sh.rotation.z = 0.12;
        armL.el.rotation.x = 0.15;
        armR.sh.rotation.x = 0.0;
        armR.sh.rotation.z = -2.5 + Math.sin(waveT * 7) * 0.12;
        armR.el.rotation.z = Math.sin(waveT * 9) * 0.45;
        armR.el.rotation.x = 0.0;
        rig.position.y = -0.6 + br * 0.008;
        torso.rotation.y = Math.sin(t * 0.7) * 0.05;
        head.rotation.y = Math.sin(t * 0.9) * 0.22;
        head.rotation.x = Math.sin(t * 0.6) * 0.04;
        hat(t, 0, 0.5);
      }
      armR.el.rotation.z = state === 'idle' ? armR.el.rotation.z : 0;
    },
  };
}
