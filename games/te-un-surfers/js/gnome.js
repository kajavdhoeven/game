import * as THREE from 'three';
import { mergeOwn } from './merge.js';
import { canvasTex, rng } from './textures.js';

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

// gebreide wol: rijen V-steken
function knitTexture(base, light, dark, rx = 8, ry = 6) {
  const t = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    const sw = w / 8;
    const sh = h / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cx = x * sw + sw / 2;
        const cy = y * sh + sh / 2;
        g.strokeStyle = dark;
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(cx - sw * 0.4, cy - sh * 0.4);
        g.lineTo(cx, cy + sh * 0.35);
        g.lineTo(cx + sw * 0.4, cy - sh * 0.4);
        g.stroke();
        g.strokeStyle = light;
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(cx - sw * 0.4, cy - sh * 0.4 - 2);
        g.lineTo(cx, cy + sh * 0.35 - 2);
        g.lineTo(cx + sw * 0.4, cy - sh * 0.4 - 2);
        g.stroke();
      }
    }
  }, { repeat: true });
  t.repeat.set(rx, ry);
  return t;
}

// koeienprint voor het petje van de conducteur
function cowTexture() {
  return canvasTex(256, 256, (g, w, h) => {
    const r = rng(8);
    g.fillStyle = '#f5f3ec';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#161616';
    for (let i = 0; i < 9; i++) {
      const x = r() * w;
      const y = r() * h;
      const s = 22 + r() * 36;
      g.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = (k / 9) * Math.PI * 2;
        const rr = s * (0.6 + r() * 0.5);
        g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8);
      }
      g.closePath();
      g.fill();
    }
  }, { repeat: true });
}
export { cowTexture };

const easeOut = (x) => 1 - Math.pow(1 - x, 3);

// Te-Un en varianten. Kijkrichting is -z (de loopbaan).
// fotocamera met flitser (voor de treinspotter-fotograaf)
function buildCamera() {
  const c = new THREE.Group();
  const body = M('#1b1d22', { roughness: 0.5 });
  const silver = M('#cfd4da', { metalness: 0.8, roughness: 0.25 });
  mesh(new THREE.BoxGeometry(0.17, 0.1, 0.08), body, c, 0, 0, 0);
  mesh(new THREE.BoxGeometry(0.17, 0.03, 0.08), silver, c, 0, 0.065, 0);
  mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.06, 16), silver, c, 0, 0, -0.07).rotation.x = Math.PI / 2;
  mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 16), M('#10304a', { roughness: 0.1, metalness: 0.3 }), c, 0, 0, -0.1).rotation.x = Math.PI / 2;
  mesh(new THREE.BoxGeometry(0.05, 0.03, 0.02), M('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.6 }), c, -0.05, 0.095, -0.02);
  return c;
}

// drinkhoed met twee blikjes energy en rietjes (ook los te gebruiken als power-up)
export function createEnergyHat() {
  const h = new THREE.Group();
  const band = mesh(new THREE.TorusGeometry(0.25, 0.022, 8, 28), M('#ffd400', { roughness: 0.5 }), h, 0, 0.06, 0);
  band.rotation.x = Math.PI / 2;
  const cols = ['#19c3ff', '#b8ff1a'];
  [-1, 1].forEach((s, i) => {
    const can = new THREE.Group();
    can.position.set(s * 0.29, 0.1, 0);
    can.rotation.z = -s * 0.22;
    h.add(can);
    mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.17, 16), M(cols[i], { roughness: 0.3, metalness: 0.5 }), can, 0, 0, 0);
    mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.03, 16), M('#dfe3e8', { roughness: 0.2, metalness: 0.9 }), can, 0, 0.1, 0);
    mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.03, 16), M('#dfe3e8', { roughness: 0.2, metalness: 0.9 }), can, 0, -0.1, 0);
    mesh(new THREE.BoxGeometry(0.02, 0.1, 0.108), M('#ffffff', { roughness: 0.4 }), can, 0, 0, 0);
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(s * 0.3, 0.2, 0), new THREE.Vector3(s * 0.32, 0.3, -0.05), new THREE.Vector3(s * 0.18, 0.3, -0.19), new THREE.Vector3(s * 0.05, 0.02, -0.25), new THREE.Vector3(s * 0.015, -0.1, -0.245),
    ]);
    const straw = new THREE.Mesh(new THREE.TubeGeometry(path, 20, 0.009, 6), M(i ? '#ffffff' : '#ff3b3b', { roughness: 0.4 }));
    h.add(straw);
  });
  return h;
}

// opts.skin: 'teun' | 'conductor' | 'photographer' | 'mob'
export function createGnome(opts = {}) {
  const skinName = opts.skin || 'teun';
  const conductor = skinName === 'conductor';
  const photographer = skinName === 'photographer';
  // 'classic' is de oude baardige kabouter (de boze menigte); Te-Un zelf ziet eruit zoals op zijn logo
  const classic = !!opts.classic;
  const photo = !classic;
  const skin = M('#f1c4a0', { roughness: 0.6 });
  const tunicColor = opts.tunic || (conductor ? '#102a5c' : photographer ? '#ff7a1a' : photo ? '#1f5fe6' : '#2f7a4b');
  const useKnit = classic && !conductor;
  const tunicMap = useKnit ? knitTexture(tunicColor, new THREE.Color(tunicColor).offsetHSL(0, 0, 0.07).getStyle(), new THREE.Color(tunicColor).offsetHSL(0, 0, -0.08).getStyle(), 7, 3) : null;
  const tunic = M('#ffffff', { map: tunicMap, roughness: 0.85 });
  if (!useKnit) tunic.color.set(tunicColor);
  const trousers = M(conductor ? '#0c1d40' : photographer ? '#23252b' : photo ? '#15161b' : '#6a4a2e', { roughness: 0.9 });
  const hairMat = M('#4a2f1f', { roughness: 0.7 });
  const white = M('#f8f8f4', { roughness: 0.95 });
  const hatColor = opts.hat || '#d3202a';
  const hatMap = classic ? knitTexture(hatColor, new THREE.Color(hatColor).offsetHSL(0, 0, 0.08).getStyle(), new THREE.Color(hatColor).offsetHSL(0, 0, -0.1).getStyle(), 3, 2) : null;
  const redHat = M('#ffffff', { map: hatMap, roughness: 0.78 });
  if (!classic) redHat.color.set('#e0232c');
  const leather = M('#7a4a22', { roughness: 0.6 });
  const black = P('#0a0a0c', { roughness: 0.18, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
  // smurfblauw, glanzend
  const smurf = P('#2f8cf0', { roughness: 0.28, clearcoat: 0.9, clearcoatRoughness: 0.15 });
  const sole = M('#f2efe6', { roughness: 0.8 });
  const gold = M('#e8b830', { metalness: 0.9, roughness: 0.25 });

  const root = new THREE.Group();
  const lift = new THREE.Group(); // voor squash/stretch en voertuigen
  root.add(lift);
  const flip = new THREE.Group();
  flip.position.y = 0.6;
  lift.add(flip);
  const rig = new THREE.Group();
  rig.position.y = -0.6;
  flip.add(rig);

  // --- benen met knie en schoenen ---
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(side * 0.12, 0.56, 0);
    rig.add(hip);
    const thigh = capsule(photo ? 0.098 : 0.075, 0.12, trousers, hip);
    thigh.position.y = -0.14;
    const knee = new THREE.Group();
    knee.position.y = -0.28;
    hip.add(knee);
    const shin = capsule(photo ? 0.085 : 0.062, 0.1, trousers, knee);
    shin.position.y = -0.12;
    const sock = mesh(new THREE.CylinderGeometry(0.066, 0.07, 0.09, 12), photo ? trousers : white, knee, 0, -0.2, 0);
    sock.castShadow = false;
    const ankle = new THREE.Group();
    ankle.position.y = -0.26;
    knee.add(ankle);
    const shoeMat = conductor ? P('#111317', { roughness: 0.25, clearcoat: 0.9 }) : photo ? P('#1f5ee0', { roughness: 0.55 }) : smurf;
    const shoe = mesh(new THREE.SphereGeometry(1, 20, 14), shoeMat, ankle, 0, -0.02, -0.07);
    shoe.scale.set(0.095, 0.075, 0.185);
    const toe = mesh(new THREE.SphereGeometry(1, 16, 12), shoeMat, ankle, 0, 0.004, -0.17);
    toe.scale.set(0.082, 0.07, 0.1);
    const sl = mesh(new THREE.SphereGeometry(1, 20, 6), sole, ankle, 0, -0.085, -0.075);
    sl.scale.set(0.1, 0.02, 0.2);
    sl.castShadow = false;
    const lace = mesh(new THREE.BoxGeometry(0.07, 0.012, 0.07), white, ankle, 0, 0.04, -0.05);
    lace.castShadow = false;
    if (photo) {
      // sneaker: twee witte zijstrepen en een lichte teenkap
      [-1, 1].forEach((sd) => [0.0, 0.03].forEach((o) => {
        const st = mesh(new THREE.BoxGeometry(0.008, 0.012, 0.13), white, ankle, sd * 0.094, 0.0 - o, -0.09);
        st.rotation.x = 0.35;
        st.castShadow = false;
      }));
      const cap = mesh(new THREE.SphereGeometry(1, 14, 10), sole, ankle, 0, -0.04, -0.2);
      cap.scale.set(0.07, 0.045, 0.06);
      cap.castShadow = false;
    }
    return { hip, knee, ankle };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  // --- romp ---
  const torso = new THREE.Group();
  torso.position.y = 0.62;
  rig.add(torso);
  const tunicShape = [
    [0.0, 0.0], [0.23, 0.0], [0.25, 0.04], [0.21, 0.18], [0.185, 0.3],
    [0.2, 0.38], [0.15, 0.44], [0.0, 0.46],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const body = mesh(new THREE.LatheGeometry(tunicShape, 24), tunic, torso, 0, -0.02, 0);
  body.scale.z = 0.82;
  const belt = mesh(new THREE.TorusGeometry(0.205, 0.022, 8, 28), photo ? M('#101114', { roughness: 0.5 }) : leather, torso, 0, 0.14, 0);
  belt.rotation.x = Math.PI / 2;
  belt.scale.set(1, 0.82, 1);
  mesh(new THREE.BoxGeometry(0.07, 0.06, 0.02), photo ? M('#cfd4da', { metalness: 0.9, roughness: 0.25 }) : gold, torso, 0, 0.14, -0.178);
  // knopen
  if (!photo || conductor) for (let i = 0; i < 3; i++) mesh(new THREE.SphereGeometry(0.018, 8, 8), conductor ? gold : M('#d9c28a'), torso, 0, 0.22 + i * 0.07, -0.176 + i * 0.004);
  if (conductor) {
    // NS-banden op de mouwen en reflecterende band
    const band = mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 24), M('#ffc917'), torso, 0, 0.3, 0);
    band.rotation.x = Math.PI / 2;
    band.scale.set(1, 0.82, 1);
  }
  const bpMat = M('#8c5a2b', { roughness: 0.75 });
  mesh(new THREE.BoxGeometry(0.28, 0.3, 0.13), bpMat, torso, 0, 0.24, 0.2);
  mesh(new THREE.BoxGeometry(0.29, 0.1, 0.14), M('#6f4620', { roughness: 0.75 }), torso, 0, 0.34, 0.2);
  const roll = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 12), M('#b24a3a', { roughness: 0.9 }), torso, 0, 0.08, 0.2);
  roll.rotation.z = Math.PI / 2;
  const strapL = mesh(new THREE.BoxGeometry(0.03, 0.34, 0.02), leather, torso, -0.1, 0.24, -0.12);
  strapL.rotation.z = 0.1;
  strapL.rotation.x = 0.1;
  const strapR = strapL.clone();
  strapR.position.x = 0.1;
  strapR.rotation.z = -0.1;
  torso.add(strapR);

  // sjaal met wapperende staart (stropdas bij de conducteur)
  const scarfMat = M(conductor ? '#ffc917' : '#e0a826', { roughness: 0.85 });
  const scarfG = new THREE.Group();
  torso.add(scarfG);
  scarfG.visible = classic || conductor;
  const scarfRing = mesh(new THREE.TorusGeometry(0.15, 0.045, 10, 24), scarfMat, scarfG, 0, 0.42, 0);
  scarfRing.rotation.x = Math.PI / 2;
  scarfRing.scale.set(1, 0.9, 1);
  const scarfTail = [];
  {
    let parent = new THREE.Group();
    parent.position.set(0.06, 0.4, 0.14);
    scarfG.add(parent);
    for (let i = 0; i < 5; i++) {
      const seg = new THREE.Group();
      seg.position.z = i === 0 ? 0 : 0.11;
      parent.add(seg);
      const m = mesh(new THREE.BoxGeometry(0.09, 0.03, 0.12), scarfMat, seg, 0, 0, 0.06);
      m.castShadow = false;
      scarfTail.push(seg);
      parent = seg;
    }
  }

  // --- armen met wanten ---
  function makeArm(side) {
    const sh = new THREE.Group();
    sh.position.set(side * 0.23, 0.38, 0);
    torso.add(sh);
    const up = capsule(0.056, 0.1, tunic, sh);
    up.position.y = -0.1;
    const el = new THREE.Group();
    el.position.y = -0.2;
    sh.add(el);
    const low = capsule(0.05, 0.09, photo && !conductor ? skin : tunic, el);
    low.position.y = -0.1;
    const handMat = photo ? skin : white;
    if (!photo || conductor) {
      const cuff = mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.04, 12), conductor ? M('#ffc917') : white, el, 0, -0.2, 0);
      cuff.castShadow = false;
    }
    mesh(new THREE.SphereGeometry(0.062, 14, 12), handMat, el, 0, -0.26, 0);
    const thumb = mesh(new THREE.SphereGeometry(0.026, 8, 8), handMat, el, -side * 0.05, -0.25, -0.03);
    thumb.castShadow = false;
    return { sh, el };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // wapen (alleen zichtbaar tijdens schieten): waterpistool, fluitje (conducteur) of camera (fotograaf)
  const gun = new THREE.Group();
  gun.visible = false;
  gun.position.set(0, -0.27, -0.06);
  gun.rotation.x = -Math.PI / 2;
  armR.el.add(gun);
  if (conductor) {
    gun.rotation.x = 0;
    gun.position.set(0, -0.3, 0);
    const silver = M('#d9dde2', { metalness: 0.8, roughness: 0.25 });
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.1, 12), silver, gun, 0, 0, 0).rotation.z = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.04, 12, 10), silver, gun, 0.05, 0, 0);
    mesh(new THREE.BoxGeometry(0.05, 0.02, 0.03), M('#e8272f'), gun, -0.02, 0.035, 0);
  } else if (photographer) {
    gun.rotation.x = 0;
    gun.position.set(0, -0.28, -0.08);
    gun.add(buildCamera());
  } else {
    mesh(new THREE.BoxGeometry(0.07, 0.12, 0.26), M('#18b6e8', { roughness: 0.3 }), gun, 0, 0.02, 0);
    mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 8), M('#0a6a8c'), gun, 0, 0.02, -0.2).rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.06, 0.12, 0.07), M('#ffe14a', { roughness: 0.4 }), gun, 0, -0.08, 0.06);
    const tank = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.16, 12), new THREE.MeshPhysicalMaterial({ color: '#7fd8ff', transparent: true, opacity: 0.7, roughness: 0.1 }), gun, 0, 0.12, 0.02);
    tank.rotation.x = Math.PI / 2;
    tank.castShadow = false;
  }

  // --- hoofd ---
  const head = new THREE.Group();
  head.position.y = 0.62 + 0.46 + 0.17;
  rig.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.235, 32, 24), skin, head);
  skull.scale.set(photo ? 1.05 : 1, photo ? 0.99 : 0.97, photo ? 1.02 : 0.98);
  mesh(new THREE.SphereGeometry(0.06, 16, 14), M('#e79a86', { roughness: 0.55 }), head, 0, -0.045, -0.235);
  const cheekL = mesh(new THREE.SphereGeometry(0.045, 12, 10), M('#ee9c8c', { roughness: 0.7 }), head, -0.13, -0.07, -0.19);
  cheekL.scale.z = 0.5;
  const cheekR = cheekL.clone();
  cheekR.position.x = 0.13;
  head.add(cheekR);
  for (const s of [-1, 1]) {
    const ear = mesh(new THREE.ConeGeometry(photo ? 0.068 : 0.05, photo ? 0.21 : 0.16, 12), skin, head, s * (photo ? 0.245 : 0.235), photo ? 0.03 : 0.02, 0.01);
    ear.rotation.z = -s * 1.2;
  }
  // ogen (knipperen) en wenkbrauwen (emotie) zijn losse onderdelen
  const eyeMat = M('#ffffff', { roughness: 0.3 });
  const pupilMat = P('#0b0b0e', { roughness: 0.1, clearcoat: 1 });
  const eyes = [];
  const brows = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    eye.position.set(s * 0.095, 0.045, -0.2);
    head.add(eye);
    if (photo) eye.scale.setScalar(1.18);
    const ball = mesh(new THREE.SphereGeometry(0.04, 14, 12), eyeMat, eye);
    ball.castShadow = false;
    if (photo) {
      const iris = mesh(new THREE.SphereGeometry(0.03, 12, 10), M('#3b6fb8', { roughness: 0.3 }), eye, 0, 0, -0.016);
      iris.scale.z = 0.7;
      iris.castShadow = false;
    }
    const pupil = mesh(new THREE.SphereGeometry(0.02, 12, 10), pupilMat, eye, 0, 0, -0.035);
    pupil.castShadow = false;
    eyes.push({ g: eye, pupil });
    const brow = new THREE.Group();
    brow.position.set(s * 0.097, 0.125, -0.205);
    head.add(brow);
    const bm = mesh(new THREE.CapsuleGeometry(0.012, 0.07, 4, 8), photo ? hairMat : white, brow);
    bm.rotation.z = Math.PI / 2;
    bm.castShadow = false;
    brows.push({ g: brow, side: s });
  }
  // ronde zwarte bril
  const glassLens = new THREE.MeshPhysicalMaterial({
    color: '#bcd4ee', roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, envMapIntensity: 2.2,
  });
  for (const s of [-1, 1]) {
    mesh(new THREE.TorusGeometry(0.093, 0.0145, 12, 40), black, head, s * 0.105, 0.045, -0.222);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.092, 32), glassLens);
    lens.position.set(s * 0.105, 0.045, -0.223);
    lens.rotation.y = Math.PI;
    head.add(lens);
    const arm = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.25, 8), black, head, s * 0.214, 0.045, -0.105);
    arm.rotation.x = Math.PI / 2;
    arm.castShadow = false;
  }
  mesh(new THREE.TorusGeometry(0.03, 0.01, 8, 16, Math.PI), black, head, 0, 0.065, -0.225).castShadow = false;

  if (photo) {
    // glimlach en haar: de pony kijkt onder de muts uit
    const smile = mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14, Math.PI), M('#9a4a3a', { roughness: 0.6 }), head, 0, -0.075, -0.222);
    smile.rotation.z = Math.PI;
    smile.castShadow = false;
    const fringe = mesh(new THREE.SphereGeometry(0.1, 16, 10), hairMat, head, -0.02, 0.15, -0.17);
    fringe.scale.set(1.5, 0.5, 0.65);
    fringe.rotation.z = 0.08;
    const tuft = mesh(new THREE.ConeGeometry(0.035, 0.1, 8), hairMat, head, 0.07, 0.19, -0.19);
    tuft.rotation.set(-0.7, 0, -0.5);
    [-1, 1].forEach((sd) => {
      const lock = mesh(new THREE.SphereGeometry(0.07, 12, 10), hairMat, head, sd * 0.19, 0.08, -0.07);
      lock.scale.set(0.5, 1.0, 0.9);
    });
  }

  // baard en snor (alleen bij de oude kabouters)
  const beard = new THREE.Group();
  head.add(beard);
  beard.visible = classic;
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

  // muts (gebreid, gebogen punt) of petje met koeienprint
  const hatBase = new THREE.Group();
  hatBase.position.set(0, photo ? 0.135 : 0.1, 0.01);
  hatBase.rotation.x = -0.06;
  head.add(hatBase);
  const hatParts = [];
  if (conductor) {
    const capMat = new THREE.MeshStandardMaterial({ map: cowTexture(), roughness: 0.8 });
    capMat.map.repeat.set(2, 1);
    const crown = mesh(new THREE.CylinderGeometry(0.2, 0.245, 0.17, 28), capMat, hatBase, 0, 0.1, 0);
    mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.03, 28), capMat, hatBase, 0, 0.19, 0);
    mesh(new THREE.TorusGeometry(0.245, 0.02, 8, 28), M('#102a5c'), hatBase, 0, 0.02, 0).rotation.x = Math.PI / 2;
    const visor = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.02, 20, 1, false, 0, Math.PI), P('#101114', { roughness: 0.3, clearcoat: 0.8 }), hatBase, 0, 0.03, -0.22);
    visor.rotation.y = Math.PI / 2 + Math.PI / 2;
    visor.rotation.y = Math.PI;
    mesh(new THREE.BoxGeometry(0.1, 0.07, 0.01), M('#003082'), hatBase, 0, 0.1, -0.247);
    mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6), gold, hatBase, 0, 0.1, -0.255).rotation.x = Math.PI / 2;
    void crown;
  } else {
    const band = mesh(new THREE.TorusGeometry(0.235, 0.034, 10, 36), redHat, hatBase, 0, 0.0, 0);
    band.rotation.x = Math.PI / 2;
    const segs = [
      { r0: 0.245, r1: 0.19, h: 0.17 }, { r0: 0.19, r1: 0.14, h: 0.17 }, { r0: 0.14, r1: 0.095, h: 0.16 },
      { r0: 0.095, r1: 0.05, h: 0.15 }, { r0: 0.05, r1: 0.012, h: 0.14 },
    ];
    let parent = hatBase;
    let yOff = 0;
    segs.forEach((s) => {
      const g = new THREE.Group();
      g.position.y = yOff;
      parent.add(g);
      mesh(new THREE.CylinderGeometry(s.r1, s.r0, s.h, 24, 1), redHat, g, 0, s.h / 2, 0);
      hatParts.push(g);
      parent = g;
      yOff = s.h - 0.005;
    });
    mesh(new THREE.SphereGeometry(0.03, 10, 8), white, parent, 0, yOff, 0);
  }

  // --- toebehoren ---
  // mini-vliegtuigje op de rug
  const planePack = new THREE.Group();
  planePack.visible = false;
  planePack.position.set(0, 0.28, 0.3);
  torso.add(planePack);
  const prop = new THREE.Group();
  {
    const red = M('#e8272f', { roughness: 0.4, metalness: 0.2 });
    const wht = M('#f4f4f4', { roughness: 0.4 });
    const fus = mesh(new THREE.CapsuleGeometry(0.07, 0.34, 6, 14), red, planePack);
    fus.rotation.x = Math.PI / 2;
    const wing = mesh(new THREE.BoxGeometry(0.95, 0.025, 0.2), wht, planePack, 0, 0.04, -0.02);
    mesh(new THREE.BoxGeometry(0.95, 0.027, 0.06), red, planePack, 0, 0.04, -0.1);
    mesh(new THREE.BoxGeometry(0.34, 0.02, 0.1), wht, planePack, 0, 0.0, 0.26);
    const fin = mesh(new THREE.BoxGeometry(0.02, 0.14, 0.1), red, planePack, 0, 0.07, 0.26);
    void wing; void fin;
    prop.position.set(0, 0, -0.28);
    planePack.add(prop);
    mesh(new THREE.BoxGeometry(0.02, 0.4, 0.015), M('#222'), prop);
    mesh(new THREE.BoxGeometry(0.4, 0.02, 0.015), M('#222'), prop);
    mesh(new THREE.SphereGeometry(0.03, 8, 8), M('#ddd'), prop);
  }
  // schoenen-gloed
  const glowMat = new THREE.SpriteMaterial({
    map: canvasTex(64, 64, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(120,200,255,1)');
      gr.addColorStop(1, 'rgba(60,120,255,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
    }),
    blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8, fog: false,
  });
  const shoeGlow = [legL, legR].map((l) => {
    const sp = new THREE.Sprite(glowMat);
    sp.scale.set(0.7, 0.7, 1);
    sp.position.set(0, -0.06, -0.07);
    sp.visible = false;
    l.ankle.add(sp);
    return sp;
  });
  // hoverboard onder de voeten
  const boardGroup = new THREE.Group();
  boardGroup.visible = false;
  root.add(boardGroup);

  // draw calls beperken: statische onderdelen per lichaamsdeel samenvoegen
  [legL, legR].forEach((l) => { mergeOwn(l.hip); mergeOwn(l.knee); mergeOwn(l.ankle); });
  [armL, armR].forEach((a) => { mergeOwn(a.sh); mergeOwn(a.el); });
  mergeOwn(torso);
  mergeOwn(head);
  mergeOwn(beard);
  mergeOwn(hatBase);
  mergeOwn(planePack);

  // --- power-up kleding: oranje shirt, of drinkhoed + kogelvrij vest ---
  const shirtOn = new THREE.Group();
  {
    const mat = M('#ff7a1a', { roughness: 0.7 });
    const sb = new THREE.Mesh(new THREE.LatheGeometry(tunicShape, 24), mat);
    sb.position.y = -0.02;
    sb.scale.set(1.08, 1.03, 0.9);
    sb.castShadow = true;
    shirtOn.add(sb);
    const white2 = M('#ffffff', { roughness: 0.6 });
    const nk = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), white2);
    nk.position.set(0, 0.44, 0);
    nk.rotation.x = Math.PI / 2;
    shirtOn.add(nk);
    torso.add(shirtOn);
  }
  const vestOn = new THREE.Group();
  {
    const vest = M('#27343b', { roughness: 0.85 });
    const dark = M('#161d21', { roughness: 0.8 });
    const vb = new THREE.Mesh(new THREE.LatheGeometry(tunicShape.map((p) => new THREE.Vector2(p.x, Math.min(p.y, 0.4))), 24), vest);
    vb.position.y = -0.02;
    vb.scale.set(1.1, 1.0, 0.93);
    vb.castShadow = true;
    vestOn.add(vb);
    mesh(new THREE.BoxGeometry(0.25, 0.27, 0.035), dark, vestOn, 0, 0.22, -0.185);
    mesh(new THREE.BoxGeometry(0.09, 0.07, 0.04), vest, vestOn, -0.08, 0.1, -0.2);
    mesh(new THREE.BoxGeometry(0.09, 0.07, 0.04), vest, vestOn, 0.08, 0.1, -0.2);
    mesh(new THREE.BoxGeometry(0.22, 0.02, 0.01), M('#ffd400'), vestOn, 0, 0.34, -0.205);
    torso.add(vestOn);
  }
  const hatOn = createEnergyHat();
  head.add(hatOn);
  shirtOn.visible = vestOn.visible = hatOn.visible = false;
  const chestCam = photographer ? buildCamera() : null;
  if (chestCam) { chestCam.position.set(0, 0.2, -0.22); torso.add(chestCam); }

  // ------------------------------------------------------------ animatie
  const st = {
    phase: 0, waveT: 0, gesture: null, gestureT: 0, nextGesture: 3 + Math.random() * 3,
    blink: 0, nextBlink: 2, squash: 0, squashT: 0, prevAir: false, blinkOpen: 1, lastState: 'idle',
    laneSpin: 0, laneStyle: 0, laneT: 1, wag: 0,
  };
  const targetAng = { l: [0, 0], r: [0, 0] };
  void targetAng;

  function resetPose() {
    flip.rotation.set(0, 0, 0);
    flip.position.y = 0.6;
    flip.scale.set(1, 1, 1);
    torso.rotation.set(0, 0, 0);
    root.rotation.set(0, root.rotation.y, 0);
    lift.position.set(0, 0, 0);
    lift.scale.set(1, 1, 1);
    lift.rotation.set(0, 0, 0);
    head.rotation.set(0, 0, 0);
    [legL, legR].forEach((l) => { l.hip.rotation.set(0, 0, 0); });
    [armL, armR].forEach((a) => { a.sh.rotation.set(0, 0, 0); a.el.rotation.set(0, 0, 0); });
  }

  function setLegs(a, k, leg) {
    leg.hip.rotation.x = a;
    leg.knee.rotation.x = k;
    leg.ankle.rotation.x = -(a + k) * 0.35 + 0.05;
  }

  function hat(t, lean, energy) {
    hatParts.forEach((g, i) => {
      g.rotation.x = 0.16 + lean * 0.06 + Math.sin(t * 7 + i * 0.7) * 0.05 * energy + energy * 0.05;
      g.rotation.z = Math.sin(t * 5.3 + i) * 0.04 * energy;
    });
    hatBase.rotation.x = -0.06 + lean * 0.05;
  }

  function scarf(t, flap) {
    scarfTail.forEach((s, i) => {
      s.rotation.x = -0.15 - flap * 0.18 + Math.sin(t * 9 - i * 0.9) * 0.18 * flap;
      s.rotation.y = Math.sin(t * 7 - i * 0.8) * 0.25 * flap;
    });
  }

  // emotie: 'neutral' | 'angry' | 'scared' | 'happy'
  function face(emotion, dt) {
    brows.forEach((b) => {
      let rz = 0;
      let y = 0.125;
      if (emotion === 'angry') { rz = -b.side * 0.55; y = 0.115; }
      else if (emotion === 'scared') { rz = b.side * 0.45; y = 0.15; }
      else if (emotion === 'happy') { rz = b.side * 0.12; y = 0.14; }
      b.g.rotation.z += (rz - b.g.rotation.z) * Math.min(1, dt * 14);
      b.g.position.y += (y - b.g.position.y) * Math.min(1, dt * 14);
    });
    st.nextBlink -= dt;
    if (st.nextBlink <= 0) { st.blink = 0.14; st.nextBlink = 1.8 + Math.random() * 3; }
    st.blink = Math.max(0, st.blink - dt);
    const open = emotion === 'scared' ? 1.35 : emotion === 'angry' ? 0.75 : 1;
    const sy = st.blink > 0 ? 0.1 : open;
    eyes.forEach((e) => { e.g.scale.y += (sy - e.g.scale.y) * Math.min(1, dt * 30); });
  }

  function runGestures(dt) {
    st.nextGesture -= dt;
    if (!st.gesture && st.nextGesture <= 0) {
      st.gesture = ['lookBack', 'hatTip', 'wipe', 'wave'][(Math.random() * 4) | 0];
      st.gestureT = 0;
      st.nextGesture = 4 + Math.random() * 6;
    }
    if (st.gesture) {
      st.gestureT += dt;
      if (st.gestureT > 1.0) st.gesture = null;
    }
  }

  const api = {
    root,
    head,
    lift,
    flip,
    hatBase,
    brows,
    eyes,
    armR,
    armL,
    setShoes(on) {
      [legL, legR].forEach((l) => l.ankle.scale.setScalar(on ? 1.9 : 1));
      shoeGlow.forEach((g) => { g.visible = on; });
    },
    setPlane(on) { planePack.visible = on; },
    // 'shirt' | 'cans' | null: kleding die je door een power-up aantrekt
    setOutfit(kind) {
      shirtOn.visible = kind === 'shirt';
      vestOn.visible = hatOn.visible = kind === 'cans';
    },
    setBoard(mesh3d) {
      while (boardGroup.children.length) boardGroup.remove(boardGroup.children[0]);
      boardGroup.visible = !!mesh3d;
      if (mesh3d) boardGroup.add(mesh3d);
    },
    boardGroup,
    holdWeapon(obj) {
      obj.position.set(0, -0.3, -0.04);
      armR.el.add(obj);
    },
    // gestarte squash bij landen / afzetten
    squash(amount = 1) {
      st.squash = amount;
      st.squashT = 0;
    },
    startLane(dir, style) {
      st.laneT = 0;
      st.laneDir = dir;
      st.laneStyle = style;
    },
    // state: run | jump | roll | idle | splat | tumble | sit | ride | surf | fly | scared | shoved | aim
    update(state, dt, t, speed01 = 0, vx = 0, extra = {}) {
      resetPose();
      const emotion = extra.emotion || (state === 'scared' ? 'scared' : state === 'splat' || state === 'tumble' ? 'scared' : state === 'run' && extra.angry ? 'angry' : 'neutral');
      face(emotion, dt);
      st.laneT = Math.min(1, st.laneT + dt * 4);
      const laneK = 1 - st.laneT;
      const gun3 = extra.aim != null;
      gun.visible = gun3;
      if (chestCam) chestCam.visible = !gun3;

      if (state === 'run') {
        st.phase += dt * (9 + speed01 * 5);
        const p = st.phase;
        const s1 = Math.sin(p);
        const s2 = Math.sin(p + Math.PI);
        const c1 = Math.cos(p);
        const c2 = Math.cos(p + Math.PI);
        setLegs(s1 * 0.95, -(Math.max(0, c1) * 1.15 + 0.12), legL);
        setLegs(s2 * 0.95, -(Math.max(0, c2) * 1.15 + 0.12), legR);
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
        // baanwissel: wisselende stijl
        if (laneK > 0) {
          const d = st.laneDir || 1;
          if (st.laneStyle === 0) { // diepe lean
            root.rotation.z = -d * 0.38 * laneK;
            torso.rotation.z = -d * 0.2 * laneK;
          } else if (st.laneStyle === 1) { // hopje met schaatsbeweging
            lift.position.y = Math.sin(st.laneT * Math.PI) * 0.22;
            legL.hip.rotation.z = d * 0.5 * laneK;
            legR.hip.rotation.z = d * 0.5 * laneK;
            armL.sh.rotation.z = 0.9 * laneK;
            armR.sh.rotation.z = -0.9 * laneK;
          } else { // pirouette
            lift.rotation.y = -d * st.laneT * Math.PI * 2;
            lift.position.y = Math.sin(st.laneT * Math.PI) * 0.1;
          }
        }
        runGestures(dt);
        if (st.gesture) {
          const k = Math.sin(Math.min(1, st.gestureT / 1.0) * Math.PI);
          if (st.gesture === 'lookBack') head.rotation.y = 2.4 * k;
          else if (st.gesture === 'hatTip') { armR.sh.rotation.x = 2.6 * k; armR.el.rotation.x = 1.4 * k; head.rotation.x = 0.1 + 0.2 * k; }
          else if (st.gesture === 'wipe') { armL.sh.rotation.x = 2.3 * k; armL.el.rotation.x = 1.8 * k; armL.el.rotation.z = Math.sin(t * 24) * 0.3 * k; }
          else { armR.sh.rotation.x = 0; armR.sh.rotation.z = -2.7 * k; armR.el.rotation.z = Math.sin(t * 16) * 0.4 * k; head.rotation.z = 0.15 * k; }
        }
        if (extra.armUp) { // boze kabouter: wapen omhoog
          armR.sh.rotation.x = 2.7;
          armR.el.rotation.x = 0.3;
          armL.sh.rotation.x = -0.4 - s1 * 0.5;
        }
        scarf(t, 0.7 + speed01);
        // squash na de landing
        if (st.squash > 0) {
          st.squashT += dt;
          const k = Math.max(0, 1 - st.squashT / 0.2);
          const q = k * st.squash;
          lift.scale.set(1 + 0.22 * q, 1 - 0.28 * q, 1 + 0.22 * q);
          lift.position.y -= 0.0;
          if (k <= 0) st.squash = 0;
        }
      } else if (state === 'jump') {
        const rising = extra.vy > 0;
        const style = extra.jumpStyle || 0;
        const k = rising ? 1 : 0;
        if (style === 0) { // opgetrokken knieën
          setLegs(rising ? 1.0 : 0.55, rising ? -1.35 : -0.9, legL);
          setLegs(rising ? -0.5 : -0.25, rising ? -0.5 : -0.4, legR);
          armL.sh.rotation.x = rising ? 2.5 : 1.7;
          armR.sh.rotation.x = rising ? 2.5 : 1.7;
        } else if (style === 1) { // ster: armen en benen wijd
          setLegs(0.2, -0.2, legL);
          setLegs(0.2, -0.2, legR);
          legL.hip.rotation.z = -0.8;
          legR.hip.rotation.z = 0.8;
          armL.sh.rotation.z = 2.4;
          armR.sh.rotation.z = -2.4;
        } else if (style === 2) { // bommetje: knieën naar de borst, salto
          setLegs(1.6, -2.0, legL);
          setLegs(1.6, -2.0, legR);
          armL.sh.rotation.x = 1.2;
          armR.sh.rotation.x = 1.2;
          armL.el.rotation.x = 1.8;
          armR.el.rotation.x = 1.8;
          flip.rotation.x = -(extra.airT || 0) * 10;
        } else { // spagaat met armen omhoog
          setLegs(1.2, -0.1, legL);
          setLegs(-1.0, -0.1, legR);
          armL.sh.rotation.x = 3.0;
          armR.sh.rotation.x = 3.0;
          armL.sh.rotation.z = 0.25;
          armR.sh.rotation.z = -0.25;
        }
        if (style !== 3 && style !== 1) { armL.sh.rotation.z = Math.max(armL.sh.rotation.z, 0.35); armR.sh.rotation.z = Math.min(armR.sh.rotation.z, -0.35); }
        armL.el.rotation.x += 0.2;
        armR.el.rotation.x += 0.2;
        rig.position.y = -0.6;
        torso.rotation.x = k ? -0.05 : 0;
        head.rotation.x = k ? -0.1 : 0.05;
        hat(t, k ? -1.2 : 2.2, 1.6);
        scarf(t, 1.2);
        root.rotation.z = -vx * 0.035;
        // uitrekken tijdens stijgen
        const sv = Math.min(1, Math.abs(extra.vy || 0) / 14);
        lift.scale.set(1 - 0.1 * sv, 1 + 0.14 * sv, 1 - 0.1 * sv);
        st.prevAir = true;
      } else if (state === 'roll') {
        const k = Math.min(1, extra.rollT || 0);
        flip.rotation.x = -k * Math.PI * 2;
        flip.position.y = 0.38;
        flip.scale.set(1, 0.82, 1);
        setLegs(1.5, -1.9, legL);
        setLegs(1.5, -1.9, legR);
        armL.sh.rotation.x = 1.4;
        armR.sh.rotation.x = 1.4;
        armL.el.rotation.x = 1.5;
        armR.el.rotation.x = 1.5;
        torso.rotation.x = -0.6;
        head.rotation.x = 0.5;
        rig.position.y = -0.6;
        hat(t, 0, 1);
        scarf(t, 1.5);
      } else if (state === 'splat') {
        // tekenfilm: eerst vastgeplakt tegen de trein, dan langzaam naar beneden glijden en omvallen
        const k = extra.k || 0;
        rig.position.y = -0.6;
        const stick = 0.9;
        const peel = 2.2;
        if (k < stick) {
          const e = easeOut(Math.min(1, k / 0.12));
          flip.scale.set(1 + 0.3 * e, 1 + 0.06 * e, 1 - 0.8 * e);
          lift.position.y = 0.35 * e;
          armL.sh.rotation.z = 2.3 * e;
          armR.sh.rotation.z = -2.3 * e;
          armL.sh.rotation.x = 0.4 * e;
          armR.sh.rotation.x = 0.4 * e;
          legL.hip.rotation.z = -0.45 * e;
          legR.hip.rotation.z = 0.45 * e;
          head.rotation.x = 0.25 * e;
          hatParts.forEach((g) => { g.rotation.x = 0.16 + 0.5 * e; });
        } else if (k < peel) {
          const q = (k - stick) / (peel - stick);
          flip.scale.set(1 + 0.3 * (1 - q), 1 + 0.06 * (1 - q), 0.2 + 0.8 * Math.pow(q, 2));
          lift.position.y = 0.35 * (1 - q);
          const flop = 1 - Math.pow(q, 3);
          armL.sh.rotation.z = 2.3 * flop + 0.2;
          armR.sh.rotation.z = -2.3 * flop - 0.2;
          armL.sh.rotation.x = 0.4;
          armR.sh.rotation.x = 0.4;
          legL.hip.rotation.z = -0.45 * (1 - q);
          legR.hip.rotation.z = 0.45 * (1 - q);
          head.rotation.x = 0.25 + 0.2 * q;
          root.rotation.x = 0.35 * q * q; // begint achterover te leunen
          hatParts.forEach((g, i) => { g.rotation.x = 0.16 + 0.8 * (1 - q) + i * 0.05 * q; });
        } else {
          const q = Math.min(1, (k - peel) / 0.55);
          root.rotation.x = 0.35 + q * (Math.PI / 2 - 0.35); // valt plat achterover
          lift.position.y = -0.0;
          armL.sh.rotation.z = 0.8;
          armR.sh.rotation.z = -0.8;
          armL.sh.rotation.x = 1.6;
          armR.sh.rotation.x = 1.6;
          setLegs(-0.2, -0.3, legL);
          setLegs(0.3, -0.6, legR);
          head.rotation.x = 0.4;
        }
        hat(t, 0, 0.3);
      } else if (state === 'tumble') {
        const k = Math.min(1, (extra.k || 0) * 2.2);
        flip.rotation.x = -k * 1.4;
        flip.position.y = 0.6 - k * 0.28;
        setLegs(0.9, -1.0, legL);
        setLegs(-0.4, -0.5, legR);
        armL.sh.rotation.x = 2.2;
        armR.sh.rotation.x = 2.0;
        armL.sh.rotation.z = 0.8;
        armR.sh.rotation.z = -0.8;
        rig.position.y = -0.6;
        hat(t, 0, 0.3);
      } else if (state === 'sit') { // rolstoel
        setLegs(1.3, -0.9, legL);
        setLegs(1.3, -0.9, legR);
        armL.sh.rotation.x = 0.45;
        armR.sh.rotation.x = 0.45;
        armL.el.rotation.x = 0.9;
        armR.el.rotation.x = 0.9;
        torso.rotation.x = 0.06;
        head.rotation.x = -0.05;
        rig.position.y = -0.6;
        hat(t, 0.5, 1.2);
        scarf(t, 1.4);
      } else if (state === 'ride') { // koe
        const bob = Math.sin(t * 10);
        legL.hip.rotation.z = -0.95;
        legR.hip.rotation.z = 0.95;
        legL.hip.rotation.x = 0.5 + bob * 0.08;
        legR.hip.rotation.x = 0.5 - bob * 0.08;
        legL.knee.rotation.x = -0.6;
        legR.knee.rotation.x = -0.6;
        armL.sh.rotation.x = 1.3;
        armR.sh.rotation.x = 1.3;
        armL.sh.rotation.z = 0.25;
        armR.sh.rotation.z = -0.25;
        armL.el.rotation.x = 0.4;
        armR.el.rotation.x = 0.4;
        torso.rotation.x = -0.22 + bob * 0.04;
        rig.position.y = -0.6;
        hat(t, 1.4, 1.6);
        scarf(t, 1.6);
      } else if (state === 'surf') { // NS-trein
        setLegs(0.55, -0.45, legL);
        setLegs(-0.3, -0.45, legR);
        legL.hip.rotation.z = -0.28;
        legR.hip.rotation.z = 0.28;
        armL.sh.rotation.z = 1.35;
        armR.sh.rotation.z = -1.35;
        armL.sh.rotation.x = 0.2;
        armR.sh.rotation.x = 0.2;
        torso.rotation.x = -0.3;
        torso.rotation.y = Math.sin(t * 3) * 0.08;
        head.rotation.x = 0.2;
        rig.position.y = -0.6;
        hat(t, 2, 1.8);
        scarf(t, 2);
      } else if (state === 'fly') { // mini-vliegtuig
        flip.rotation.x = -1.05;
        setLegs(-0.5, -0.25, legL);
        setLegs(-0.3, -0.35, legR);
        armL.sh.rotation.x = 2.9;
        armR.sh.rotation.x = 2.9;
        armL.sh.rotation.z = 0.15;
        armR.sh.rotation.z = -0.15;
        head.rotation.x = 0.8;
        rig.position.y = -0.6;
        root.rotation.z = -vx * 0.05;
        hat(t, 2, 1.8);
        scarf(t, 2);
      } else if (state === 'scared' || state === 'shoved') {
        setLegs(0.05, -0.2, legL);
        setLegs(-0.05, -0.2, legR);
        const sh = Math.sin(t * 38) * 0.04;
        armL.sh.rotation.x = 2.5 + sh;
        armR.sh.rotation.x = 2.5 - sh;
        armL.sh.rotation.z = 0.5;
        armR.sh.rotation.z = -0.5;
        armL.el.rotation.x = 1.0;
        armR.el.rotation.x = 1.0;
        rig.position.y = -0.6;
        torso.rotation.x = 0.1;
        head.rotation.y = Math.sin(t * 5) * 0.3;
        lift.rotation.z = sh * 1.5;
        hat(t, 0, 1.2);
        scarf(t, 0.3);
      } else {
        // idle: ademt, kijkt rond, zwaait
        st.waveT += dt;
        const br = Math.sin(t * 2.2);
        setLegs(0.03, -0.02, legL);
        setLegs(-0.02, -0.02, legR);
        armL.sh.rotation.x = br * 0.05;
        armL.sh.rotation.z = 0.12;
        armL.el.rotation.x = 0.15;
        armR.sh.rotation.z = -2.5 + Math.sin(st.waveT * 7) * 0.12;
        armR.el.rotation.z = Math.sin(st.waveT * 9) * 0.45;
        rig.position.y = -0.6 + br * 0.008;
        torso.rotation.y = Math.sin(t * 0.7) * 0.05;
        head.rotation.y = Math.sin(t * 0.9) * 0.22;
        head.rotation.x = Math.sin(t * 0.6) * 0.04;
        hat(t, 0, 0.5);
        scarf(t, 0.2);
      }

      // waterpistool: richt op de spotter, terugslag
      if (gun3 && conductor) {
        // fluitje in de mond
        const side = extra.aim || 1;
        torso.rotation.y = -side * 0.5;
        armR.sh.rotation.x = 2.4;
        armR.sh.rotation.z = -0.25;
        armR.el.rotation.x = 1.9;
        armL.sh.rotation.x = 0.3;
        head.rotation.y = side * 0.6;
        head.rotation.x = -0.12;
      } else if (gun3 && photographer) {
        // camera voor het gezicht, beide handen omhoog
        const side = extra.aim || 1;
        torso.rotation.y = -side * 1.0;
        armR.sh.rotation.x = 1.95;
        armR.el.rotation.x = 1.15;
        armL.sh.rotation.x = 1.95;
        armL.sh.rotation.z = 0.35;
        armL.el.rotation.x = 1.15;
        head.rotation.y = side * 0.85;
      } else if (gun3) {
        const side = extra.aim || 1;
        const rec = Math.max(0, 1 - (extra.fireT || 0) / 0.18);
        torso.rotation.y = -side * 1.15;
        armR.sh.rotation.x = 1.55 + rec * 0.25;
        armR.sh.rotation.z = 0;
        armR.el.rotation.x = 0.0;
        armL.sh.rotation.x = 1.2;
        armL.el.rotation.x = 0.8;
        head.rotation.y = side * 0.9;
      }
      if (planePack.visible) prop.rotation.z += dt * 55;
      // landing-squash start bij overgang van lucht naar grond
      if (state !== 'jump' && st.prevAir) {
        st.prevAir = false;
        api.squash(1);
      }
      st.lastState = state;
    },
  };
  return api;
}

// toortsen en hooivorken voor de boze kabouters
export function createTorch() {
  const g = new THREE.Group();
  mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 8), M('#5a3a1d'), g, 0, 0.18, 0);
  mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.12, 8), M('#2a1a10'), g, 0, 0.5, 0);
  return g;
}

export function createPitchfork() {
  const g = new THREE.Group();
  const wood = M('#6b4a2c');
  const steel = M('#9aa0a6', { metalness: 0.8, roughness: 0.35 });
  mesh(new THREE.CylinderGeometry(0.02, 0.022, 1.1, 8), wood, g, 0, 0.3, 0);
  mesh(new THREE.BoxGeometry(0.22, 0.025, 0.025), steel, g, 0, 0.86, 0);
  [-0.1, 0, 0.1].forEach((x) => mesh(new THREE.ConeGeometry(0.014, 0.22, 6), steel, g, x, 0.98, 0));
  return g;
}
