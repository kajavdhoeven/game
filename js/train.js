import * as THREE from 'three';
import { canvasTex, drawNSLogo, rng } from './textures.js';
import { mergeStatic } from './merge.js';

export const CAR_LEN = 15;
export const CAR_W = 2.6;
export const CAR_H = 3.6;
const Y0 = 0.5; // onderkant carrosserie
const R = 0.8; // horizontale dakstraal
const RV = 0.62; // verticale dakstraal
const NS_YELLOW = '#ffc917';
const NS_BLUE = '#003082';

function profile() {
  const pts = [];
  const hw = CAR_W / 2;
  pts.push([-hw, Y0]);
  pts.push([-hw, CAR_H - RV]);
  const seg = 9;
  for (let i = 1; i <= seg; i++) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push([-hw + R - R * Math.cos(a), CAR_H - RV + RV * Math.sin(a)]);
  }
  for (let i = seg - 1; i >= 0; i--) {
    const a = (i / seg) * (Math.PI / 2);
    pts.push([hw - R + R * Math.cos(a), CAR_H - RV + RV * Math.sin(a)]);
  }
  pts.push([hw, Y0]);
  return pts;
}

function nose(t) {
  // t 0..1: de neus versmalt en zakt een beetje, net als bij moderne stellen
  return { sx: 1 - 0.1 * t * t, sy: 1 - 0.06 * t * t, dz: 0 };
}

function buildBody() {
  const P = profile();
  const NP = P.length;
  const hl = CAR_LEN / 2;
  const NOSE_LEN = 1.5;
  const zs = [{ z: -hl, t: 0 }, { z: hl - NOSE_LEN, t: 0 }];
  for (let i = 1; i <= 5; i++) {
    const t = i / 5;
    zs.push({ z: hl - NOSE_LEN + NOSE_LEN * t, t });
  }
  const pos = [];
  const uv = [];
  const idx = [];
  zs.forEach(({ z, t }) => {
    const { sx, sy } = nose(t);
    P.forEach(([x, y]) => {
      const yy = Y0 + (y - Y0) * sy;
      pos.push(x * sx, yy, z);
      const u = x >= 0 ? 0.5 - z / CAR_LEN : 0.5 + z / CAR_LEN;
      uv.push(u, yy / CAR_H);
    });
  });
  for (let k = 0; k < zs.length - 1; k++) {
    for (let i = 0; i < NP - 1; i++) {
      const a = k * NP + i;
      const b = a + 1;
      const c = a + NP;
      const d = c + 1;
      // profiel loopt linksonder naar rechtsonder; zo staan de normalen naar buiten
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // voorkant: dichtgemaakt met een vlak met eigen texture
  const t1 = nose(1);
  const frontPts = P.map(([x, y]) => [x * t1.sx, Y0 + (y - Y0) * t1.sy]);
  const shape = new THREE.Shape(frontPts.map(([x, y]) => new THREE.Vector2(x, y)));
  const frontGeo = new THREE.ShapeGeometry(shape);
  const fp = frontGeo.attributes.position;
  const fuv = frontGeo.attributes.uv;
  for (let i = 0; i < fp.count; i++) {
    fuv.setXY(i, (fp.getX(i) / (CAR_W * t1.sx)) + 0.5, fp.getY(i) / CAR_H);
  }
  return { geo, frontGeo };
}

function sideTexture() {
  const W = 2048;
  const H = 512;
  return canvasTex(W, H, (g) => {
    const X = (m) => (m / CAR_LEN) * W;
    const Y = (m) => (1 - m / CAR_H) * H;
    const r = rng(7);
    // basis: geel, dak grijs
    g.fillStyle = NS_YELLOW;
    g.fillRect(0, 0, W, H);
    const roofG = g.createLinearGradient(0, Y(CAR_H), 0, Y(3.05));
    roofG.addColorStop(0, '#bfc4c9');
    roofG.addColorStop(1, '#d9dcde');
    g.fillStyle = roofG;
    g.fillRect(0, Y(CAR_H), W, Y(3.05) - Y(CAR_H));
    // zachte lichtval bovenop de geel
    const gl = g.createLinearGradient(0, Y(3.05), 0, Y(0.5));
    gl.addColorStop(0, 'rgba(255,255,255,0.18)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    gl.addColorStop(1, 'rgba(0,0,0,0.12)');
    g.fillStyle = gl;
    g.fillRect(0, Y(3.05), W, Y(0.5) - Y(3.05));

    // blauwe onderband en dunne scheidingslijn
    g.fillStyle = NS_BLUE;
    g.fillRect(0, Y(1.0), W, Y(0.5) - Y(1.0));
    g.fillStyle = '#e6e8ea';
    g.fillRect(0, Y(1.04), W, 4);

    // ramen
    const windows = [[0.8, 2.3], [4.25, 7.6], [8.4, 11.75], [12.7, 14.2]];
    const winY0 = 1.75;
    const winY1 = 2.95;
    const drawGlass = (x0, x1, y0, y1) => {
      const gx = X(x0);
      const gy = Y(y1);
      const gw = X(x1) - X(x0);
      const gh = Y(y0) - Y(y1);
      g.fillStyle = '#0a0d12';
      g.beginPath();
      g.roundRect(gx - 4, gy - 4, gw + 8, gh + 8, 16);
      g.fill();
      const gr = g.createLinearGradient(0, gy, 0, gy + gh);
      gr.addColorStop(0, '#2b3f57');
      gr.addColorStop(0.55, '#121c28');
      gr.addColorStop(1, '#0b1118');
      g.fillStyle = gr;
      g.beginPath();
      g.roundRect(gx, gy, gw, gh, 14);
      g.fill();
      g.save();
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.10)';
      g.beginPath();
      g.moveTo(gx + gw * 0.1, gy + gh);
      g.lineTo(gx + gw * 0.3, gy);
      g.lineTo(gx + gw * 0.42, gy);
      g.lineTo(gx + gw * 0.22, gy + gh);
      g.fill();
      g.restore();
    };
    windows.forEach(([a, b]) => drawGlass(a, b, winY0, winY1));

    // deuren
    [3.2, 12.8].forEach((c) => {
      const x0 = c - 0.75;
      const x1 = c + 0.75;
      g.fillStyle = '#26467f';
      g.beginPath();
      g.roundRect(X(x0), Y(3.05), X(x1) - X(x0), Y(0.52) - Y(3.05), 10);
      g.fill();
      g.strokeStyle = '#0c1d3f';
      g.lineWidth = 3;
      g.stroke();
      // twee deurpanelen
      g.beginPath();
      g.moveTo(X(c), Y(2.95));
      g.lineTo(X(c), Y(0.6));
      g.stroke();
      drawGlass(c - 0.62, c - 0.04, 1.75, 2.9);
      drawGlass(c + 0.04, c + 0.62, 1.75, 2.9);
      // deurknop (groen)
      g.fillStyle = '#3fc16b';
      g.beginPath();
      g.arc(X(c + 0.72), Y(1.5), 7, 0, Math.PI * 2);
      g.fill();
    });

    // NS-logo's op het gele vlak onder de ramen
    drawNSLogo(g, X(7.2), Y(1.65), X(1.6), Y(1.1) - Y(1.65));
    drawNSLogo(g, X(1.0), Y(1.6), X(0.9), Y(1.15) - Y(1.6));
    drawNSLogo(g, X(14.1), Y(1.6), X(0.9), Y(1.15) - Y(1.6));

    // treinnummer in wit op de blauwe band
    g.fillStyle = '#ffffff';
    g.font = '700 30px "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText('NS 2214', X(5.6), Y(0.75));
    g.textAlign = 'right';
    g.fillText('SNG', X(10.6), Y(0.75));

    // vuil, remsporen en regenstrepen
    for (let i = 0; i < 160; i++) {
      const x = r() * W;
      const y0 = Y(2.9) + r() * 40;
      const len = 40 + r() * 160;
      const gr = g.createLinearGradient(0, y0, 0, y0 + len);
      gr.addColorStop(0, 'rgba(40,30,10,0.10)');
      gr.addColorStop(1, 'rgba(40,30,10,0)');
      g.fillStyle = gr;
      g.fillRect(x, y0, 2 + r() * 3, len);
    }
    const dirt = g.createLinearGradient(0, Y(1.2), 0, Y(0.5));
    dirt.addColorStop(0, 'rgba(30,25,15,0)');
    dirt.addColorStop(1, 'rgba(30,25,15,0.35)');
    g.fillStyle = dirt;
    g.fillRect(0, Y(1.2), W, Y(0.5) - Y(1.2));
  }, { aniso: 16 });
}

function frontTexture() {
  const S = 512;
  return canvasTex(S, S, (g) => {
    const X = (m) => (m / CAR_W) * S;
    const Y = (m) => (1 - m / CAR_H) * S;
    g.fillStyle = NS_YELLOW;
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#c7cbcf';
    g.fillRect(0, 0, S, Y(3.1));
    // blauwe onderkant
    g.fillStyle = NS_BLUE;
    g.fillRect(0, Y(1.0), S, Y(0.5) - Y(1.0));
    // bestemmingsdisplay
    g.fillStyle = '#05070a';
    g.beginPath();
    g.roundRect(X(0.45), Y(3.1), X(2.15) - X(0.45), Y(2.82) - Y(3.1), 8);
    g.fill();
    g.fillStyle = '#ffb347';
    g.font = '700 18px "Courier New", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('TE-UN CENTRAAL', X(1.3), Y(2.96));
    // voorruit
    const gr = g.createLinearGradient(0, Y(2.78), 0, Y(1.55));
    gr.addColorStop(0, '#34506f');
    gr.addColorStop(0.5, '#141f2c');
    gr.addColorStop(1, '#0a1017');
    g.fillStyle = '#080b0f';
    g.beginPath();
    g.roundRect(X(0.28), Y(2.82), X(2.32) - X(0.28), Y(1.5) - Y(2.82), 26);
    g.fill();
    g.fillStyle = gr;
    g.beginPath();
    g.roundRect(X(0.34), Y(2.76), X(2.26) - X(0.34), Y(1.56) - Y(2.76), 22);
    g.fill();
    g.save();
    g.clip();
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.beginPath();
    g.moveTo(X(0.5), Y(1.56));
    g.lineTo(X(1.05), Y(2.76));
    g.lineTo(X(1.3), Y(2.76));
    g.lineTo(X(0.75), Y(1.56));
    g.fill();
    g.restore();
    // ruitenwissers
    g.strokeStyle = '#111';
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(X(0.9), Y(1.62));
    g.lineTo(X(1.5), Y(2.1));
    g.moveTo(X(1.7), Y(1.62));
    g.lineTo(X(2.2), Y(2.15));
    g.stroke();
    // logo
    drawNSLogo(g, X(0.95), Y(1.42), X(0.7), Y(1.0) - Y(1.42));
    // koplamp-fittingen
    g.fillStyle = '#d8dadc';
    [0.42, 2.18].forEach((x) => {
      g.beginPath();
      g.arc(X(x), Y(0.78), 20, 0, Math.PI * 2);
      g.fill();
    });
  }, { aniso: 16 });
}

let shared = null;

function getShared() {
  if (shared) return shared;
  const { geo, frontGeo } = buildBody();
  const sideTex = sideTexture();
  const frontTex = frontTexture();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: sideTex, roughness: 0.42, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.5,
  });
  const frontMat = new THREE.MeshPhysicalMaterial({
    map: frontTex, roughness: 0.4, metalness: 0.1, clearcoat: 0.7, clearcoatRoughness: 0.25, envMapIntensity: 1.1,
  });
  const dark = new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.85, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: '#6c7076', roughness: 0.35, metalness: 0.9 });
  const roofGrey = new THREE.MeshStandardMaterial({ color: '#9ca1a7', roughness: 0.6, metalness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: '#0e0e10', roughness: 0.95 });
  const back = new THREE.MeshStandardMaterial({ color: '#d9a912', roughness: 0.6 });
  const lampMat = new THREE.MeshBasicMaterial({ color: '#fffbe8', toneMapped: false });
  const redLamp = new THREE.MeshBasicMaterial({ color: '#ff2a1a', toneMapped: false });
  const glowTex = canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,248,220,1)');
    gr.addColorStop(0.3, 'rgba(255,240,190,0.5)');
    gr.addColorStop(1, 'rgba(255,230,160,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const glowMat = new THREE.SpriteMaterial({
    map: glowTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.45, fog: false,
  });
  shared = {
    geo, frontGeo, bodyMat, frontMat, dark, steel, roofGrey, rubber, back, lampMat, redLamp, glowMat,
    wheel: new THREE.CylinderGeometry(0.46, 0.46, 0.1, 20).rotateZ(Math.PI / 2),
    box: new THREE.BoxGeometry(1, 1, 1),
    disc: new THREE.CircleGeometry(0.11, 18),
  };
  return shared;
}

function box(s, mat, w, h, d, x, y, z, parent) {
  const m = new THREE.Mesh(s.box, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  parent.add(m);
  return m;
}

function buildCar(s, withLamps) {
  const car = new THREE.Group();
  const body = new THREE.Mesh(s.geo, s.bodyMat);
  body.castShadow = true;
  body.receiveShadow = true;
  car.add(body);

  const front = new THREE.Mesh(s.frontGeo, s.frontMat);
  front.position.z = CAR_LEN / 2;
  car.add(front);
  const rear = new THREE.Mesh(s.frontGeo, s.back);
  rear.position.z = -CAR_LEN / 2;
  rear.rotation.y = Math.PI;
  car.add(rear);

  // onderstel
  box(s, s.dark, CAR_W - 0.5, 0.35, CAR_LEN - 2.5, 0, 0.42, 0, car);
  [-1, 1].forEach((side) => {
    const bz = side * CAR_LEN * 0.3;
    box(s, s.dark, 2.0, 0.22, 2.7, 0, 0.62, bz, car);
    [-1, 1].forEach((ws) => {
      [-1, 1].forEach((rs) => {
        const w = new THREE.Mesh(s.wheel, s.steel);
        w.position.set(rs * 0.72, 0.5, bz + ws * 0.95);
        car.add(w);
      });
      const axle = new THREE.Mesh(s.box, s.steel);
      axle.scale.set(1.5, 0.1, 0.1);
      axle.position.set(0, 0.5, bz + ws * 0.95);
      car.add(axle);
    });
  });

  // dakopbouw
  [-3.4, 2.6].forEach((z) => box(s, s.roofGrey, 1.5, 0.22, 2.6, 0, CAR_H + 0.1, z, car));
  box(s, s.roofGrey, 1.0, 0.15, 1.2, 0, CAR_H + 0.08, 5.2, car);
  // pantograaf
  const pz = -0.4;
  [-0.5, 0.5].forEach((x) => box(s, s.dark, 0.1, 0.25, 0.1, x, CAR_H + 0.12, pz, car));
  const arm1 = box(s, s.steel, 0.07, 0.07, 1.2, 0, CAR_H + 0.55, pz + 0.3, car);
  arm1.rotation.x = 0.8;
  const arm2 = box(s, s.steel, 0.07, 0.07, 1.2, 0, CAR_H + 0.55, pz - 0.35, car);
  arm2.rotation.x = -0.8;
  box(s, s.steel, 1.5, 0.05, 0.12, 0, CAR_H + 1.0, pz, car);

  // koppeling
  box(s, s.dark, 0.5, 0.3, 0.3, 0, 0.7, CAR_LEN / 2 + 0.15, car);

  mergeStatic(car);

  if (withLamps) {
    [-0.97, 0.97].forEach((x) => {
      const l = new THREE.Mesh(s.disc, s.lampMat);
      l.position.set(x, 0.8, CAR_LEN / 2 + 0.02);
      car.add(l);
      const sp = new THREE.Sprite(s.glowMat);
      sp.scale.set(1.1, 1.1, 1);
      sp.position.set(x, 0.8, CAR_LEN / 2 + 0.3);
      car.add(sp);
      const rl = new THREE.Mesh(s.disc, s.redLamp);
      rl.scale.set(0.6, 0.6, 1);
      rl.position.set(x * 0.95, 1.1, -CAR_LEN / 2 - 0.02);
      rl.rotation.y = Math.PI;
      car.add(rl);
    });
  }
  return car;
}

// Een treinstel van 1 of 2 rijtuigen. Neus wijst naar +z (naar de speler).
export function createTrain(cars = 1) {
  const s = getShared();
  const g = new THREE.Group();
  for (let i = 0; i < cars; i++) {
    const car = buildCar(s, true);
    car.position.z = -i * (CAR_LEN + 0.35);
    g.add(car);
    if (i > 0) {
      // balg tussen de rijtuigen
      const gap = box(s, s.rubber, CAR_W - 0.5, 2.5, 0.6, 0, 1.9, car.position.z + CAR_LEN / 2 + 0.17, g);
      gap.castShadow = false;
    }
  }
  const length = cars * CAR_LEN + (cars - 1) * 0.35;
  // z-midden van het stel
  g.children.forEach((c) => { c.position.z += (cars - 1) * (CAR_LEN + 0.35) / 2; });
  g.userData.length = length;
  return g;
}
