import * as THREE from 'three';
import { mergeStatic, disposeMerged } from './merge.js';
import {
  ballastTexture, grassTexture, tulipTexture, plowedTexture, brickTexture, roofTexture,
  cloudTexture, canvasTex, rng, drawNSLogo,
} from './textures.js';

export const LANE = 3.0;
export const SEG_LEN = 48;
const SEG_COUNT = 6;
const RAIL_X = 0.72;

const HORIZON = new THREE.Color('#dfeaf2');

const M = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, ...o });

function makeSky(scene) {
  const sunDir = new THREE.Vector3(-0.45, 0.55, -0.7).normalize();
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      top: { value: new THREE.Color('#2f78cf') },
      mid: { value: new THREE.Color('#7fb4ea') },
      hor: { value: HORIZON.clone() },
      sunDir: { value: sunDir },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.95, h));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.86, 0.62) * pow(s, 6.0) * 0.28;
        col += vec3(1.0, 0.95, 0.8) * pow(s, 700.0) * 4.0;
        if (d.y < 0.0) col = mix(hor, vec3(0.35,0.45,0.3), clamp(-d.y * 6.0, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 32, 20), mat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  return { sky, sunDir };
}

export class World {
  constructor(scene, renderer) {
    this.scene = scene;
    this.time = 0;
    this.spinners = [];
    this.counter = 1;

    const { sky, sunDir } = makeSky(scene);
    this.sky = sky;
    this.sunDir = sunDir;

    // reflecties voor de glanzende treinlak
    const pm = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    envScene.add(makeSky(envScene).sky);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(400, 16).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#9a9d94' }),
    );
    ground.position.y = -2;
    envScene.add(ground);
    scene.environment = pm.fromScene(envScene, 0.02).texture;
    scene.environmentIntensity = 0.75;
    pm.dispose();

    scene.fog = new THREE.Fog(HORIZON, 70, 230);
    scene.background = HORIZON.clone();

    // licht
    this.hemi = new THREE.HemisphereLight('#cfe2ff', '#7a8a50', 1.0);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff0d4', 3.0);
    this.sun.position.set(-16, 26, -2);
    this.sun.target.position.set(0, 0, -16);
    this.sun.castShadow = true;
    const sc = this.sun.shadow.camera;
    sc.left = -17;
    sc.right = 17;
    sc.top = 38;
    sc.bottom = -30;
    sc.near = 1;
    sc.far = 90;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target);

    this.initShared();
    this.segments = [];
    this.root = new THREE.Group();
    scene.add(this.root);
    for (let i = 0; i < SEG_COUNT; i++) {
      const seg = this.buildSegment();
      seg.group.position.z = 24 - i * SEG_LEN;
      this.root.add(seg.group);
      this.populate(seg);
      this.segments.push(seg);
    }
    this.buildClouds();
  }

  setShadowQuality(size) {
    this.sun.shadow.mapSize.set(size, size);
  }

  initShared() {
    const s = (this.sh = {});
    s.ballast = ballastTexture();
    s.ballast.repeat.set(13 / 3, SEG_LEN / 3);
    s.ballastMat = new THREE.MeshStandardMaterial({ map: s.ballast, roughness: 1, bumpMap: s.ballast, bumpScale: 1.2 });
    s.slopeMat = new THREE.MeshStandardMaterial({ map: s.ballast, roughness: 1, color: '#bdb6aa' });
    s.grassTex = [grassTexture('#4f7d2f', 3), grassTexture('#5c8a35', 8)];
    s.fieldTex = [
      s.grassTex[0],
      s.grassTex[1],
      tulipTexture(['#d6202e', '#d6202e', '#f4c20d'], 5),
      tulipTexture(['#f4c20d', '#f28c1c', '#f4c20d'], 6),
      tulipTexture(['#e75a9b', '#b22d7a', '#e75a9b'], 7),
      tulipTexture(['#7d3c98', '#c7a6e0', '#7d3c98'], 8),
      plowedTexture(),
    ];
    s.fieldMats = s.fieldTex.map((t, i) => new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: i < 2 ? '#ffffff' : '#ffffff' }));
    s.grassMat = new THREE.MeshStandardMaterial({ map: s.grassTex[0], roughness: 1 });
    s.water = new THREE.MeshStandardMaterial({ color: '#2a6f93', roughness: 0.06, metalness: 0.5, envMapIntensity: 1.6 });
    s.concrete = M('#b9b9b3', { roughness: 0.9 });
    s.sleeperMat = M('#8d8b85', { roughness: 0.95 });
    s.railMat = new THREE.MeshStandardMaterial({ color: '#7d7f84', roughness: 0.3, metalness: 0.95 });
    s.railTop = new THREE.MeshStandardMaterial({ color: '#c9ccd0', roughness: 0.2, metalness: 1 });
    s.mast = new THREE.MeshStandardMaterial({ color: '#8a8f95', roughness: 0.5, metalness: 0.8 });
    s.wire = new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.6, metalness: 0.8 });
    s.trunk = M('#5a3f27', { roughness: 1 });
    s.leaf = [M('#3f7a2e', { flatShading: true }), M('#4d8c34', { flatShading: true }), M('#356a29', { flatShading: true })];
    s.poplar = M('#2f6a2a', { roughness: 1 });
    s.brickTex = brickTexture('#9c4a33');
    s.brickTex.repeat.set(2, 1);
    s.brick = new THREE.MeshStandardMaterial({ map: s.brickTex, roughness: 0.9 });
    s.roofTex = roofTexture('#8a3224');
    s.roof = new THREE.MeshStandardMaterial({ map: s.roofTex, roughness: 0.85 });
    s.whiteWall = M('#ece8dd', { roughness: 0.9 });
    s.glassDark = new THREE.MeshStandardMaterial({ color: '#1c2b3a', roughness: 0.1, metalness: 0.6 });
    s.white = M('#f4f5f6', { roughness: 0.5 });
    s.wood = M('#6b4a2c', { roughness: 0.8 });
    s.yellowLine = new THREE.MeshStandardMaterial({ color: '#ffd400', roughness: 0.7 });
    s.platTop = M('#9a9a94', { roughness: 0.95 });
    s.bush = [M('#2f6a2a', { flatShading: true }), M('#3c7a30', { flatShading: true })];
    s.signBlue = M('#003082', { roughness: 0.6 });
    s.stripe = M('#cc2a2a', { roughness: 0.6 });
    s.cowW = M('#f1efe8', { roughness: 0.9 });
    s.cowB = M('#1c1c1c', { roughness: 0.9 });
    s.sheepW = M('#e9e6dc', { roughness: 1 });
    s.noiseWall = M('#a8b3a8', { roughness: 0.95 });
    s.signalG = new THREE.MeshBasicMaterial({ color: '#35e06b', toneMapped: false });
    s.signalR = new THREE.MeshBasicMaterial({ color: '#ff3b2f', toneMapped: false });

    // stationsbord
    const nameTex = canvasTex(512, 128, (g, w, h) => {
      g.fillStyle = '#003082';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffc917';
      g.lineWidth = 6;
      g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#fff';
      g.font = '700 56px "Helvetica Neue", Arial, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('Te-Un Centraal', w / 2, h / 2 + 2);
    });
    s.nameMat = new THREE.MeshBasicMaterial({ map: nameTex, toneMapped: false });

    // geometrie
    s.box = new THREE.BoxGeometry(1, 1, 1);
    s.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    s.ico = new THREE.IcosahedronGeometry(1, 1);
    s.sphere = new THREE.SphereGeometry(1, 14, 10);
    s.planeCache = new Map();
    s.slopeGeo = new THREE.PlaneGeometry(2.4, SEG_LEN);
    s.slopeGeo.rotateX(-Math.PI / 2);
    s.sleeperGeo = new THREE.BoxGeometry(2.7, 0.13, 0.26);
    s.roofGeo = (() => {
      const sh = new THREE.Shape();
      sh.moveTo(-0.5, 0);
      sh.lineTo(0.5, 0);
      sh.lineTo(0, 0.6);
      sh.closePath();
      const g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: false });
      g.translate(0, 0, -0.5);
      return g;
    })();
    s.cloudTex = [cloudTexture(1), cloudTexture(2), cloudTexture(3)];
  }

  plane(w, tile) {
    const key = w + '/' + tile;
    let g = this.sh.planeCache.get(key);
    if (!g) {
      g = new THREE.PlaneGeometry(w, SEG_LEN);
      g.rotateX(-Math.PI / 2);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (SEG_LEN / tile));
      this.sh.planeCache.set(key, g);
    }
    return g;
  }

  buildSegment() {
    const s = this.sh;
    const group = new THREE.Group();
    const fixed = new THREE.Group();
    const scenery = new THREE.Group();
    group.add(fixed, scenery);

    // ballast
    const top = new THREE.Mesh(this.plane(13, 3), s.ballastMat);
    top.position.y = -0.05;
    top.receiveShadow = true;
    fixed.add(top);
    [-1, 1].forEach((side) => {
      const sl = new THREE.Mesh(s.slopeGeo, s.slopeMat);
      sl.position.set(side * 7.7, -0.17, 0);
      sl.rotation.z = -side * 0.1;
      sl.receiveShadow = true;
      fixed.add(sl);
    });
    // maaiveld
    const gnd = new THREE.Mesh(this.plane(220, 8), s.grassMat);
    gnd.position.y = -0.4;
    gnd.receiveShadow = true;
    fixed.add(gnd);

    // dwarsliggers
    const per = 74;
    const sl = new THREE.InstancedMesh(s.sleeperGeo, s.sleeperMat, per * 3);
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let l = -1; l <= 1; l++) {
      for (let i = 0; i < per; i++) {
        m4.makeTranslation(l * LANE, 0.0, -SEG_LEN / 2 + (i + 0.5) * (SEG_LEN / per));
        sl.setMatrixAt(n++, m4);
      }
    }
    sl.castShadow = false;
    sl.receiveShadow = true;
    fixed.add(sl);
    // rails
    for (let l = -1; l <= 1; l++) {
      [-1, 1].forEach((r) => {
        const rail = new THREE.Mesh(s.box, s.railMat);
        rail.scale.set(0.09, 0.16, SEG_LEN);
        rail.position.set(l * LANE + r * RAIL_X, 0.14, 0);
        rail.castShadow = true;
        fixed.add(rail);
        const head = new THREE.Mesh(s.box, s.railTop);
        head.scale.set(0.07, 0.03, SEG_LEN);
        head.position.set(l * LANE + r * RAIL_X, 0.235, 0);
        fixed.add(head);
      });
    }
    // bovenleiding: portalen elke 24 m, draden doorlopend
    for (let i = 0; i < 2; i++) {
      const z = -SEG_LEN / 2 + 12 + i * 24;
      [-1, 1].forEach((side) => {
        const post = new THREE.Mesh(s.box, s.mast);
        post.scale.set(0.28, 7.2, 0.28);
        post.position.set(side * 6.4, 3.5, z);
        post.castShadow = true;
        fixed.add(post);
        const brace = new THREE.Mesh(s.box, s.mast);
        brace.scale.set(0.12, 2.0, 0.12);
        brace.position.set(side * 6.0, 6.0, z);
        brace.rotation.z = side * 0.9;
        fixed.add(brace);
      });
      const beam = new THREE.Mesh(s.box, s.mast);
      beam.scale.set(12.9, 0.26, 0.26);
      beam.position.set(0, 6.9, z);
      beam.castShadow = true;
      fixed.add(beam);
      for (let l = -1; l <= 1; l++) {
        const hang = new THREE.Mesh(s.box, s.wire);
        hang.scale.set(0.05, 1.15, 0.05);
        hang.position.set(l * LANE, 6.25, z);
        fixed.add(hang);
        const ins = new THREE.Mesh(s.cyl, s.white);
        ins.scale.set(0.07, 0.4, 0.07);
        ins.position.set(l * LANE, 6.6, z);
        fixed.add(ins);
      }
    }
    for (let l = -1; l <= 1; l++) {
      const cw = new THREE.Mesh(s.box, s.wire);
      cw.scale.set(0.035, 0.035, SEG_LEN);
      cw.position.set(l * LANE, 5.55, 0);
      fixed.add(cw);
      const mw = new THREE.Mesh(s.box, s.wire);
      mw.scale.set(0.05, 0.05, SEG_LEN);
      mw.position.set(l * LANE, 6.15, 0);
      fixed.add(mw);
    }
    mergeStatic(fixed);
    return { group, fixed, scenery };
  }

  clearScenery(seg) {
    disposeMerged(seg.scenery);
    while (seg.scenery.children.length) seg.scenery.remove(seg.scenery.children[0]);
    this.spinners = this.spinners.filter((sp) => sp.seg !== seg);
  }

  populate(seg) {
    this.clearScenery(seg);
    const s = this.sh;
    const r = rng((this.counter++) * 7919 + 13);
    const sc = seg.scenery;
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, shadow = false) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = shadow;
      sc.add(m);
      return m;
    };
    const rand = (a, b) => a + r() * (b - a);
    const pick = (arr) => arr[(r() * arr.length) | 0];

    const platformSide = r() < 0.22 ? (r() < 0.5 ? -1 : 1) : 0;
    const wallSide = !platformSide && r() < 0.18 ? (r() < 0.5 ? -1 : 1) : 0;

    [-1, 1].forEach((side) => {
      const hasPlatform = platformSide === side;
      const hasWall = wallSide === side;

      // randstroken: sloot, veld, weiland
      if (!hasPlatform) {
        const ditch = add(this.plane(2.4, 8), s.water, side * 10.2, -0.3, 0);
        ditch.receiveShadow = true;
      }
      let x = hasPlatform ? 13 : 11.4;
      const plots = [];
      while (x < 100) {
        const w = pick([12, 16, 22, 30, 40]);
        plots.push([x, w]);
        x += w;
      }
      plots.forEach(([px, w], i) => {
        const mat = i < 2 ? s.fieldMats[pick([2, 2, 3, 4, 5, 6, 0, 1])] : s.fieldMats[pick([0, 1, 1, 6])];
        const tile = mat === s.fieldMats[0] || mat === s.fieldMats[1] ? 8 : 12;
        const p = add(this.plane(w - 0.4, tile), mat, side * (px + w / 2), -0.38, 0);
        p.receiveShadow = true;
      });

      // struiken langs de berm
      for (let i = 0; i < 7; i++) {
        if (r() < 0.45) continue;
        const bx = side * rand(7.6, 8.6);
        const bz = rand(-SEG_LEN / 2, SEG_LEN / 2);
        const sz = rand(0.5, 1.1);
        add(s.ico, pick(s.bush), bx, 0.0 + sz * 0.45, bz, sz * 1.2, sz * 0.8, sz, true);
      }
      // seinpaal en kilometerbord
      if (r() < 0.5 && !hasWall) {
        const z = rand(-20, 20);
        add(s.box, s.mast, side * 7.0, 1.3, z, 0.1, 2.6, 0.1, true);
        add(s.box, s.wire, side * 7.0, 2.7, z, 0.34, 0.8, 0.2);
        const lamp = add(s.sphere, r() < 0.5 ? s.signalG : s.signalR, side * 7.0, 2.9, z + (side > 0 ? 0 : 0) - 0.12, 0.09, 0.09, 0.06);
      }

      if (hasPlatform) this.buildPlatform(sc, side, r);
      if (hasWall) {
        const wall = add(s.box, s.noiseWall, side * 8.0, 1.5, 0, 0.3, 3.0, SEG_LEN, true);
        wall.receiveShadow = true;
        for (let k = 0; k < 12; k++) add(s.box, s.concrete, side * 8.0, 3.1, -SEG_LEN / 2 + 2 + k * 4, 0.45, 0.25, 0.4);
      }

      // bomenrij langs de sloot
      if (!hasPlatform && r() < 0.8) {
        const gap = rand(5.5, 8);
        for (let z = -SEG_LEN / 2 + rand(0, gap); z < SEG_LEN / 2; z += gap) {
          if (r() < 0.2) continue;
          this.tree(sc, side * rand(12.2, 13.6), z, r, true);
        }
      }
      // verspreide bomen
      const nTrees = (r() * 5) | 0;
      for (let i = 0; i < nTrees; i++) this.tree(sc, side * rand(16, 70), rand(-SEG_LEN / 2, SEG_LEN / 2), r, false);

      // boerderij of huis
      if (r() < 0.45) this.house(sc, side, rand(22, 44), rand(-14, 14), r);
      // molen
      if (r() < 0.12) this.windmill(seg, sc, side, rand(30, 56), rand(-12, 12), r);
      // windturbine
      if (r() < 0.12) this.turbine(seg, sc, side, rand(55, 85), rand(-18, 18), r);
      // koeien en schapen
      if (r() < 0.5) {
        const herd = 2 + ((r() * 4) | 0);
        const hx = side * rand(16, 40);
        const hz = rand(-16, 16);
        const sheep = r() < 0.4;
        for (let i = 0; i < herd; i++) this.animal(sc, hx + rand(-4, 4), hz + rand(-5, 5), sheep, r);
      }
    });
    mergeStatic(seg.scenery);
  }

  tree(sc, x, z, r, poplar) {
    const s = this.sh;
    const g = new THREE.Group();
    const h = poplar ? 5 + r() * 4 : 2.2 + r() * 1.6;
    const trunk = new THREE.Mesh(s.cyl, s.trunk);
    trunk.scale.set(0.16, h * 0.5, 0.16);
    trunk.position.y = h * 0.25;
    trunk.castShadow = true;
    g.add(trunk);
    if (poplar) {
      const f = new THREE.Mesh(s.ico, s.poplar);
      f.scale.set(1.1, h * 0.62, 1.1);
      f.position.y = h * 0.75;
      f.castShadow = true;
      g.add(f);
    } else {
      for (let i = 0; i < 3; i++) {
        const f = new THREE.Mesh(s.ico, s.leaf[(r() * 3) | 0]);
        const sz = 1.2 + r() * 0.9;
        f.scale.set(sz, sz * 0.85, sz);
        f.position.set((r() - 0.5) * 1.3, h + (r() - 0.3) * 0.9, (r() - 0.5) * 1.3);
        g.add(f);
      }
    }
    g.position.set(x, -0.35, z);
    sc.add(g);
  }

  house(sc, side, x, z, r) {
    const s = this.sh;
    const g = new THREE.Group();
    const w = 8 + r() * 5;
    const d = 6 + r() * 4;
    const h = 3.6 + r() * 1.5;
    const wall = new THREE.Mesh(s.box, r() < 0.7 ? s.brick : s.whiteWall);
    wall.scale.set(w, h, d);
    wall.position.y = h / 2;
    wall.castShadow = true;
    g.add(wall);
    const roof = new THREE.Mesh(s.roofGeo, s.roof);
    roof.scale.set(d + 0.8, h * 0.8, w + 1);
    roof.rotation.y = Math.PI / 2;
    roof.position.y = h;
    roof.scale.y = 5 / 0.6 * 0.5;
    roof.castShadow = true;
    g.add(roof);
    const front = -side; // gevel naar het spoor
    for (let i = 0; i < 3; i++) {
      const win = new THREE.Mesh(s.box, s.glassDark);
      win.scale.set(0.1, 1.1, 1.0);
      win.position.set(front * (w / 2 + 0.02), h * 0.55, -w * 0.0 + (i - 1) * (d / 3));
      g.add(win);
      const fr = new THREE.Mesh(s.box, s.white);
      fr.scale.set(0.06, 1.25, 1.2);
      fr.position.copy(win.position);
      fr.position.x -= front * 0.02;
      g.add(fr);
    }
    // schoorsteen
    const ch = new THREE.Mesh(s.box, s.brick);
    ch.scale.set(0.8, 2.4, 0.8);
    ch.position.set(0, h + 2.1, d * 0.2);
    g.add(ch);
    g.position.set(side * x, -0.35, z);
    g.rotation.y = side > 0 ? 0 : 0;
    // gevel (breedte w) staat langs x; draai zodat de lange kant naar het spoor kijkt
    sc.add(g);
  }

  windmill(seg, sc, side, x, z, r) {
    const s = this.sh;
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.6, 10, 8), s.brick);
    base.position.y = 5;
    base.castShadow = true;
    g.add(base);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.7, 2.6, 8), s.roof);
    cap.position.y = 11.3;
    g.add(cap);
    const hub = new THREE.Group();
    hub.position.set(-side * 2.8, 10.4, 0);
    hub.rotation.y = -side * Math.PI / 2;
    g.add(hub);
    const spin = new THREE.Group();
    hub.add(spin);
    spin.position.z = 0.5;
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      spin.add(arm);
      const beam = new THREE.Mesh(s.box, s.wood);
      beam.scale.set(0.3, 9.5, 0.3);
      beam.position.y = 5;
      arm.add(beam);
      const sail = new THREE.Mesh(s.box, s.white);
      sail.scale.set(1.9, 6.4, 0.1);
      sail.position.set(1.15, 5.8, 0.05);
      arm.add(sail);
      for (let k = 0; k < 7; k++) {
        const slat = new THREE.Mesh(s.box, s.wood);
        slat.scale.set(1.9, 0.08, 0.12);
        slat.position.set(1.15, 2.8 + k * 0.9, 0.08);
        arm.add(slat);
      }
    }
    g.position.set(side * x, -0.35, z);
    g.scale.setScalar(1.3);
    sc.add(g);
    hub.userData.keep = true;
    this.spinners.push({ seg, obj: spin, axis: 'z', speed: 0.5 });
  }

  turbine(seg, sc, side, x, z, r) {
    const s = this.sh;
    const g = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 60, 10), s.white);
    tower.position.y = 30;
    g.add(tower);
    const nac = new THREE.Mesh(s.box, s.white);
    nac.scale.set(2, 2, 5);
    nac.position.y = 61;
    g.add(nac);
    const rotor = new THREE.Group();
    rotor.position.set(-side * 0.0, 61, -3.4);
    g.add(rotor);
    for (let i = 0; i < 3; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI * 2) / 3;
      rotor.add(arm);
      const blade = new THREE.Mesh(s.box, s.white);
      blade.scale.set(1.2, 30, 0.3);
      blade.position.y = 15;
      arm.add(blade);
    }
    g.position.set(side * x, -0.35, z);
    sc.add(g);
    rotor.userData.keep = true;
    this.spinners.push({ seg, obj: rotor, axis: 'z', speed: 1.1 });
  }

  animal(sc, x, z, sheep, r) {
    const s = this.sh;
    const g = new THREE.Group();
    if (sheep) {
      const b = new THREE.Mesh(s.sphere, s.sheepW);
      b.scale.set(0.45, 0.4, 0.62);
      b.position.y = 0.6;
      g.add(b);
      const hd = new THREE.Mesh(s.sphere, s.cowB);
      hd.scale.set(0.17, 0.2, 0.2);
      hd.position.set(0, 0.72, -0.62);
      g.add(hd);
    } else {
      const b = new THREE.Mesh(s.box, s.cowW);
      b.scale.set(0.8, 0.85, 1.7);
      b.position.y = 1.0;
      b.castShadow = true;
      g.add(b);
      for (let i = 0; i < 3; i++) {
        const sp = new THREE.Mesh(s.box, s.cowB);
        sp.scale.set(0.82, 0.35, 0.4);
        sp.position.set(0, 1.1 + (r() - 0.5) * 0.4, -0.5 + i * 0.5);
        g.add(sp);
      }
      const hd = new THREE.Mesh(s.box, s.cowW);
      hd.scale.set(0.45, 0.5, 0.6);
      hd.position.set(0, 1.25, -1.1);
      g.add(hd);
      [[-0.28, -0.7], [0.28, -0.7], [-0.28, 0.7], [0.28, 0.7]].forEach(([lx, lz]) => {
        const lg = new THREE.Mesh(s.box, s.cowW);
        lg.scale.set(0.16, 0.7, 0.16);
        lg.position.set(lx, 0.35, lz);
        g.add(lg);
      });
    }
    g.position.set(x, -0.35, z);
    g.rotation.y = r() * Math.PI * 2;
    sc.add(g);
  }

  buildPlatform(sc, side, r) {
    const s = this.sh;
    const add = (geo, mat, x, y, z, sx, sy, sz, sh = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = sh;
      m.receiveShadow = true;
      sc.add(m);
      return m;
    };
    add(s.box, s.concrete, side * 9.6, 0.4, 0, 6.2, 1.0, SEG_LEN);
    add(s.box, s.platTop, side * 9.9, 0.92, 0, 5.4, 0.06, SEG_LEN);
    add(s.box, s.yellowLine, side * 7.4, 0.96, 0, 0.35, 0.03, SEG_LEN, false);
    for (let z = -SEG_LEN / 2 + 4; z < SEG_LEN / 2; z += 8) {
      add(s.box, s.mast, side * 11.0, 2.6, z, 0.18, 4.2, 0.18);
    }
    add(s.box, s.white, side * 11.5, 4.7, 0, 4.4, 0.18, SEG_LEN, true);
    for (let z = -SEG_LEN / 2 + 6; z < SEG_LEN / 2; z += 12) {
      add(s.box, s.wood, side * 11.7, 1.4, z, 0.6, 0.12, 2.0, false);
      add(s.box, s.mast, side * 7.9, 2.4, z + 4, 0.1, 2.9, 0.1);
      add(s.box, s.white, side * 7.9, 3.9, z + 4, 0.5, 0.12, 0.5, false);
    }
    const sign = add(s.box, s.nameMat, side * 8.0, 3.7, -SEG_LEN / 2 + 2, 0.1, 0.9, 3.4, false);
    sign.material = s.nameMat;
  }

  buildClouds() {
    this.clouds = [];
    const r = rng(77);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.SpriteMaterial({
        map: this.sh.cloudTex[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.9,
      });
      const sp = new THREE.Sprite(mat);
      const a = r() * Math.PI * 2;
      const d = 260 + r() * 160;
      sp.position.set(Math.cos(a) * d, 70 + r() * 60, -Math.abs(Math.sin(a)) * d);
      sp.scale.set(180 + r() * 120, 90 + r() * 50, 1);
      sp.renderOrder = -9;
      this.scene.add(sp);
      this.clouds.push(sp);
    }
  }

  update(dz, dt, camera) {
    this.time += dt;
    for (const seg of this.segments) {
      seg.group.position.z += dz;
      if (seg.group.position.z > 24 + 22) {
        seg.group.position.z -= SEG_LEN * SEG_COUNT;
        this.populate(seg);
      }
    }
    for (const sp of this.spinners) sp.obj.rotation[sp.axis] += sp.speed * dt;
    this.sky.position.copy(camera.position);
    this.clouds.forEach((c, i) => {
      c.position.x += dt * (1.2 + (i % 3) * 0.5);
      if (c.position.x > 420) c.position.x = -420;
    });
  }
}
