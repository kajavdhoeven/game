import * as THREE from 'three';
import { canvasTex, rng, softCircleTexture } from './textures.js';
import { mergeStatic } from './merge.js';
import { createVehicleTrain } from './train.js';

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, ...o });

function part(geo, mat, parent, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function flame(color = '#ff9a2a', size = 0.8) {
  const mat = new THREE.SpriteMaterial({
    map: softCircleTexture('rgba(255,230,160,1)', 'rgba(255,120,20,0)'),
    color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(size, size, 1);
  return sp;
}

// ----------------------------------------------------------------- rolstoel
export function createWheelchair() {
  const g = new THREE.Group();
  const frame = M('#c9ced4', { metalness: 0.9, roughness: 0.25, envMapIntensity: 1.4 });
  const seatM = M('#1c3f94', { roughness: 0.8 });
  const tire = M('#111214', { roughness: 0.9 });
  const rim = M('#e8eaed', { metalness: 0.95, roughness: 0.2 });
  const orange = M('#ff7a1a', { roughness: 0.4 });

  const body = new THREE.Group();
  g.add(body);
  part(new THREE.BoxGeometry(0.58, 0.1, 0.56), seatM, body, 0, 0.58, 0.02);
  part(new THREE.BoxGeometry(0.58, 0.62, 0.08), seatM, body, 0, 0.95, 0.3);
  [-1, 1].forEach((s) => {
    part(new THREE.BoxGeometry(0.05, 0.05, 0.62), frame, body, s * 0.33, 0.78, 0.0);
    part(new THREE.BoxGeometry(0.05, 0.22, 0.05), frame, body, s * 0.33, 0.68, -0.24);
    part(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8), frame, body, s * 0.33, 0.62, 0.3).rotation.x = 0;
    // duwgrepen
    const h = part(new THREE.CylinderGeometry(0.022, 0.022, 0.2, 8), tire, body, s * 0.3, 1.28, 0.42);
    h.rotation.x = Math.PI / 2;
    part(new THREE.BoxGeometry(0.04, 0.5, 0.04), frame, body, s * 0.3, 1.04, 0.36);
    // voetensteun
    part(new THREE.BoxGeometry(0.04, 0.5, 0.04), frame, body, s * 0.22, 0.4, -0.5).rotation.x = -0.4;
    part(new THREE.BoxGeometry(0.2, 0.04, 0.24), frame, body, s * 0.2, 0.18, -0.68);
  });
  part(new THREE.BoxGeometry(0.56, 0.04, 0.05), frame, body, 0, 0.5, 0.0);

  // wielen met spaken, duwring en band
  const wheels = [];
  [-1, 1].forEach((s) => {
    const w = new THREE.Group();
    w.position.set(s * 0.4, 0.5, 0.12);
    w.userData.keep = true;
    body.add(w);
    const t = part(new THREE.TorusGeometry(0.46, 0.045, 10, 36), tire, w);
    t.rotation.y = Math.PI / 2;
    const r = part(new THREE.TorusGeometry(0.4, 0.015, 8, 30), rim, w, s * 0.05, 0, 0);
    r.rotation.y = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const sp = part(new THREE.BoxGeometry(0.01, 0.82, 0.01), frame, w);
      sp.rotation.x = (i / 12) * Math.PI;
    }
    part(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 12), rim, w).rotation.z = Math.PI / 2;
    wheels.push(w);
  });
  // zwenkwielen
  const casters = [];
  [-1, 1].forEach((s) => {
    const c = new THREE.Group();
    c.position.set(s * 0.28, 0.2, -0.52);
    c.userData.keep = true;
    body.add(c);
    const w = part(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 14), tire, c);
    w.rotation.z = Math.PI / 2;
    part(new THREE.BoxGeometry(0.03, 0.3, 0.03), frame, c, 0, 0.2, 0.02);
    casters.push(c);
  });
  // straalmotoren (de rolstoel vliegt)
  const flames = [];
  [-1, 1].forEach((s) => {
    const n = part(new THREE.CylinderGeometry(0.07, 0.1, 0.22, 14), M('#33363d', { metalness: 0.8 }), body, s * 0.45, 0.34, 0.5);
    n.rotation.x = Math.PI / 2;
    part(new THREE.TorusGeometry(0.075, 0.015, 8, 16), orange, body, s * 0.45, 0.34, 0.62);
    const f = flame('#ff9a2a', 0.9);
    f.position.set(s * 0.45, 0.34, 0.85);
    body.add(f);
    flames.push(f);
  });
  // vleugeltjes
  [-1, 1].forEach((s) => {
    const wg = part(new THREE.BoxGeometry(0.6, 0.03, 0.22), orange, body, s * 0.82, 0.86, 0.18);
    wg.rotation.z = s * -0.12;
  });
  mergeStatic(body);
  // wielen zijn losse groepen; ze zitten in body maar zijn vooraf samengevoegd per groep? (de groepen blijven bestaan)
  g.userData = {
    seatY: 0.64,
    seatZ: 0.02,
    update(dt, t, speed01 = 0) {
      wheels.forEach((w) => { w.rotation.x -= dt * (6 + speed01 * 8); });
      flames.forEach((f, i) => {
        const k = 0.8 + Math.sin(t * 40 + i) * 0.18 + speed01 * 0.4;
        f.scale.set(k, k * 1.3, 1);
      });
      body.rotation.z = Math.sin(t * 2.2) * 0.04;
      body.position.y = Math.sin(t * 3) * 0.06;
    },
  };
  return g;
}

// ----------------------------------------------------------------- koe
function cowBodyTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(12);
    g.fillStyle = '#f4f1e8';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#17171a';
    for (let i = 0; i < 11; i++) {
      const x = r() * w;
      const y = r() * h;
      const s = 24 + r() * 40;
      for (const ox of [-w, 0, w]) {
        g.beginPath();
        for (let k = 0; k < 10; k++) {
          const a = (k / 10) * Math.PI * 2;
          const rr = s * (0.55 + r() * 0.6);
          g.lineTo(x + ox + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.85);
        }
        g.closePath();
        g.fill();
      }
    }
  }, { repeat: true });
}

export function createCow({ hover = false } = {}) {
  const g = new THREE.Group();
  const tex = cowBodyTexture();
  const hide = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  const pink = M('#f0a8a0', { roughness: 0.7 });
  const dark = M('#2a2a2e', { roughness: 0.7 });
  const horn = M('#efe6cf', { roughness: 0.5 });
  const brass = M('#e0b030', { metalness: 0.9, roughness: 0.3 });

  const body = new THREE.Group();
  g.add(body);
  const torso = part(new THREE.CapsuleGeometry(0.55, 1.0, 8, 18), hide, body, 0, 1.0, 0);
  torso.rotation.x = Math.PI / 2;
  torso.scale.set(1, 1, 1.02);
  // schouder/heup
  part(new THREE.SphereGeometry(0.58, 18, 14), hide, body, 0, 1.0, -0.55);
  part(new THREE.SphereGeometry(0.56, 18, 14), hide, body, 0, 1.0, 0.55);
  // hoofd
  const head = new THREE.Group();
  head.position.set(0, 1.18, -1.2);
  body.add(head);
  part(new THREE.BoxGeometry(0.46, 0.5, 0.55), hide, head, 0, 0, -0.05);
  part(new THREE.BoxGeometry(0.4, 0.3, 0.3), pink, head, 0, -0.14, -0.38);
  [-1, 1].forEach((s) => {
    part(new THREE.SphereGeometry(0.035, 8, 8), dark, head, s * 0.1, -0.12, -0.54);
    part(new THREE.SphereGeometry(0.045, 10, 8), M('#ffffff'), head, s * 0.2, 0.1, -0.28);
    part(new THREE.SphereGeometry(0.022, 8, 8), dark, head, s * 0.215, 0.1, -0.31);
    const hn = part(new THREE.ConeGeometry(0.05, 0.28, 10), horn, head, s * 0.27, 0.32, 0.0);
    hn.rotation.z = -s * 0.7;
    const ear = part(new THREE.SphereGeometry(0.09, 10, 8), hide, head, s * 0.33, 0.12, 0.04);
    ear.scale.set(1.5, 0.5, 0.8);
  });
  // beltje met bel
  part(new THREE.TorusGeometry(0.28, 0.025, 8, 20), M('#c0392b'), head, 0, -0.2, 0.15).rotation.x = Math.PI / 2;
  part(new THREE.SphereGeometry(0.07, 10, 8), brass, head, 0, -0.42, 0.0);
  // uier en staart
  part(new THREE.SphereGeometry(0.2, 10, 8), pink, body, 0, 0.5, 0.65);
  const tail = new THREE.Group();
  tail.position.set(0, 1.3, 1.12);
  body.add(tail);
  part(new THREE.CylinderGeometry(0.03, 0.03, 0.8, 8), hide, tail, 0, -0.38, 0);
  part(new THREE.SphereGeometry(0.08, 8, 8), dark, tail, 0, -0.82, 0);
  // poten
  const legs = [];
  if (!hover) {
    [[-0.3, -0.7], [0.3, -0.7], [-0.3, 0.7], [0.3, 0.7]].forEach(([x, z]) => {
      const leg = new THREE.Group();
      leg.position.set(x, 0.75, z);
      body.add(leg);
      part(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), hide, leg, 0, -0.35, 0);
      part(new THREE.CylinderGeometry(0.11, 0.12, 0.14, 10), dark, leg, 0, -0.78, 0);
      legs.push(leg);
    });
  }
  // zadel (voor Teun)
  part(new THREE.BoxGeometry(0.5, 0.06, 0.6), M('#7a3a2a'), body, 0, 1.58, 0.0);
  g.userData = {
    seatY: hover ? 1.55 : 1.6,
    seatZ: 0,
    update(dt, t, speed01 = 0) {
      const f = 7 + speed01 * 5;
      legs.forEach((l, i) => { l.rotation.x = Math.sin(t * f + (i % 2 === 0 ? 0 : Math.PI) + (i > 1 ? Math.PI * 0.5 : 0)) * 0.7; });
      body.position.y = Math.abs(Math.sin(t * f * 0.5)) * 0.1;
      body.rotation.x = Math.sin(t * f) * 0.03;
      head.rotation.x = Math.sin(t * f * 0.5) * 0.12;
      tail.rotation.z = Math.sin(t * 6) * 0.5;
    },
  };
  return g;
}

// ----------------------------------------------------------------- NS-trein als voertuig
export function createNSVehicle() {
  const g = new THREE.Group();
  const train = createVehicleTrain();
  g.add(train);
  // vonken/dampuitlaat en uitzichtplatform op het dak
  const roofY = 3.6 * 0.7;
  g.userData = {
    seatY: roofY + 0.1,
    seatZ: 0,
    update(dt, t) {
      train.position.y = Math.sin(t * 22) * 0.012;
      train.rotation.z = Math.sin(t * 3) * 0.01;
    },
  };
  return g;
}

// ----------------------------------------------------------------- hoverboards
export function createBoard(kind = 'orange') {
  const g = new THREE.Group();
  if (kind === 'cow') {
    const cow = createCow({ hover: true });
    cow.scale.setScalar(0.62);
    cow.rotation.y = 0;
    g.add(cow);
    cow.position.y = -0.55;
    g.userData.update = (dt, t) => { cow.userData.update(dt, t, 0); };
    g.userData.top = 0.45;
    addGlow(g);
    return g;
  }
  // oranje T-shirt waar Teun op zweeft
  const s = new THREE.Shape();
  const pts = [
    [-0.18, 0.55], [-0.62, 0.35], [-0.78, 0.0], [-0.55, -0.12], [-0.42, 0.08], [-0.4, -0.55], [0.4, -0.55],
    [0.42, 0.08], [0.55, -0.12], [0.78, 0.0], [0.62, 0.35], [0.18, 0.55], [0.0, 0.42],
  ];
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.02, bevelSegments: 2 });
  geo.rotateX(-Math.PI / 2);
  const shirt = new THREE.Mesh(geo, M('#ff7a1a', { roughness: 0.55 }));
  shirt.position.y = 0.0;
  shirt.castShadow = true;
  g.add(shirt);
  const tex = canvasTex(128, 64, (c, w, h) => {
    c.fillStyle = 'rgba(0,0,0,0)';
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.font = '900 30px "Arial Black", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('TE-UN', w / 2, h / 2);
  });
  const lab = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
  lab.rotation.x = -Math.PI / 2;
  lab.position.set(0, 0.075, 0.1);
  g.add(lab);
  g.userData.top = 0.07;
  g.userData.update = (dt, t) => { shirt.rotation.z = Math.sin(t * 5) * 0.03; };
  addGlow(g);
  return g;
}

function addGlow(g) {
  const sp = flame('#6ad0ff', 1.6);
  sp.position.set(0, -0.15, 0);
  g.add(sp);
}
