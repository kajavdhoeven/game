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
      nightK: { value: 0 },
      sunI: { value: 1 },
    },
    vertexShader: `varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying vec3 vDir; uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform float nightK; uniform float sunI;
      void main(){
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(hor, mid, smoothstep(0.0, 0.22, h));
        col = mix(col, top, smoothstep(0.18, 0.95, h));
        float s = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.86, 0.62) * pow(s, 6.0) * 0.28 * sunI;
        col += mix(vec3(1.0, 0.95, 0.8), vec3(0.75, 0.82, 1.0), nightK) * pow(s, 700.0) * 4.0;
        vec3 sp = d * 70.0; vec3 cell = floor(sp);
        float hh = fract(sin(dot(cell, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        float star = step(0.992, hh) * smoothstep(0.42, 0.0, length(fract(sp) - 0.5));
        col += vec3(star) * nightK * smoothstep(0.05, 0.35, d.y);
        if (d.y < 0.0) col = mix(hor, mix(vec3(0.35,0.45,0.3), vec3(0.03,0.05,0.08), nightK), clamp(-d.y * 6.0, 0.0, 1.0));
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

    this.dayK = 1;
    this.tunnelK = 0;
    this.zone = { type: 'open', left: 7, tp: 0 };
    this.zoneNo = 0;
    this.skyUniforms = sky.material.uniforms;
    this.palettes = {
      day: { top: new THREE.Color('#2f78cf'), mid: new THREE.Color('#7fb4ea'), hor: HORIZON.clone(), sun: new THREE.Color('#fff0d4'), hemiS: new THREE.Color('#cfe2ff'), hemiG: new THREE.Color('#7a8a50') },
      night: { top: new THREE.Color('#050a20'), mid: new THREE.Color('#0b1636'), hor: new THREE.Color('#16264a'), sun: new THREE.Color('#8fa8ff'), hemiS: new THREE.Color('#2a3d78'), hemiG: new THREE.Color('#10151f') },
    };
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
    this.applyLight();
  }

  // 0 = nacht, 1 = dag
  setDay(k) {
    this.dayK = k;
    this.applyLight();
  }

  setTunnel(k) {
    if (Math.abs(k - this.tunnelK) < 0.002) return;
    this.tunnelK = k;
    this.applyLight();
  }

  applyLight() {
    const k = this.dayK;
    const t = 1 - this.tunnelK * 0.86;
    const D = this.palettes.day;
    const N = this.palettes.night;
    const u = this.skyUniforms;
    u.top.value.copy(N.top).lerp(D.top, k);
    u.mid.value.copy(N.mid).lerp(D.mid, k);
    u.hor.value.copy(N.hor).lerp(D.hor, k);
    u.nightK.value = 1 - k;
    u.sunI.value = k;
    const fog = this.scene.fog;
    fog.color.copy(u.hor.value);
    if (this.tunnelK > 0) fog.color.lerp(new THREE.Color('#05070a'), this.tunnelK);
    fog.near = 70 - this.tunnelK * 50;
    fog.far = 230 - this.tunnelK * 110;
    this.scene.background.copy(fog.color);
    this.sun.color.copy(N.sun).lerp(D.sun, k);
    this.sun.intensity = (0.35 + 2.65 * k) * t;
    this.hemi.color.copy(N.hemiS).lerp(D.hemiS, k);
    this.hemi.groundColor.copy(N.hemiG).lerp(D.hemiG, k);
    this.hemi.intensity = (0.3 + 0.7 * k) * (0.45 + 0.55 * t);
    this.scene.environmentIntensity = (0.12 + 0.63 * k) * t;
    if (this.clouds) this.clouds.forEach((c) => c.material.color.setScalar(0.1 + 0.9 * k));
  }

  // wat is er op wereld-z? (zone en perrons)
  zoneAt(z) {
    for (const seg of this.segments) {
      const sz = seg.group.position.z;
      if (z <= sz + SEG_LEN / 2 && z > sz - SEG_LEN / 2) return seg;
    }
    return null;
  }

  platformAt(z, side) {
    const seg = this.zoneAt(z);
    return !!(seg && seg.plat && seg.plat[side]);
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
    // bovenleiding: hoog boven het beeld, zodat hij het zicht niet blokkeert
    const cat = new THREE.Group();
    for (let i = 0; i < 2; i++) {
      const z = -SEG_LEN / 2 + 12 + i * 24;
      [-1, 1].forEach((side) => {
        const post = new THREE.Mesh(s.box, s.mast);
        post.scale.set(0.3, 11, 0.3);
        post.position.set(side * 6.9, 5.4, z);
        post.castShadow = true;
        cat.add(post);
        const arm = new THREE.Mesh(s.box, s.mast);
        arm.scale.set(2.8, 0.14, 0.14);
        arm.position.set(side * 5.5, 10.4, z);
        cat.add(arm);
      });
    }
    for (let l = -1; l <= 1; l++) {
      const cw = new THREE.Mesh(s.box, s.wire);
      cw.scale.set(0.03, 0.03, SEG_LEN);
      cw.position.set(l * LANE, 9.6, 0);
      cat.add(cw);
    }
    fixed.add(cat);
    mergeStatic(cat);
    mergeStatic(fixed);
    return { group, fixed, scenery, cat, zone: 'open', plat: { '-1': false, 1: false } };
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

    const zone = this.nextZone(r);
    seg.zone = zone.type;
    seg.plat = { '-1': false, 1: false };
    if (zone.type === 'tunnel') {
      seg.cat.visible = false;
      if (zone.tp) seg.plat[zone.tp] = true;
      this.buildTunnel(seg, zone.tp, r);
      mergeStatic(seg.scenery);
      return;
    }
    seg.cat.visible = true;
    let platformSide = 0;
    if (zone.type === 'station') platformSide = 2; // beide kanten
    else if (r() < 0.16) platformSide = r() < 0.5 ? -1 : 1;
    if (platformSide === 2) { seg.plat['-1'] = true; seg.plat[1] = true; } else if (platformSide) seg.plat[platformSide] = true;
    const wallSide = !platformSide && r() < 0.18 ? (r() < 0.5 ? -1 : 1) : 0;

    [-1, 1].forEach((side) => {
      const hasPlatform = platformSide === 2 || platformSide === side;
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

      if (hasPlatform) this.buildPlatform(sc, side, zone.type === 'station', r);
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

  // zone-opvolging: open land, tunnels en stations
  nextZone(r) {
    const z = this.zone;
    this.zoneNo++;
    if (z.left > 0) {
      z.left--;
      return { type: z.type, tp: z.tp };
    }
    const roll = r();
    if (z.type !== 'open' || this.zoneNo < 4) {
      z.type = 'open';
      z.left = 2 + ((r() * 4) | 0);
    } else if (roll < 0.38) {
      z.type = 'tunnel';
      z.left = 1 + ((r() * 2) | 0);
      z.tp = r() < 0.5 ? (r() < 0.5 ? -1 : 1) : 0;
    } else if (roll < 0.62) {
      z.type = 'station';
      z.left = 1;
      z.tp = 0;
    } else {
      z.type = 'open';
      z.left = 2 + ((r() * 3) | 0);
    }
    return { type: z.type, tp: z.tp };
  }

  initTunnel() {
    const s = this.sh;
    s.tunnelTex = canvasTex(256, 256, (g, w, h) => {
      const r = rng(41);
      g.fillStyle = '#7d7f80';
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(${r() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + r() * 0.07})`;
        g.fillRect(r() * w, r() * h, 3, 3);
      }
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, 0, w, 3);
      g.fillRect(0, 0, 3, h);
      for (let i = 0; i < 9; i++) {
        const x = r() * w;
        const gr = g.createLinearGradient(x, 0, x, h);
        gr.addColorStop(0, 'rgba(20,20,20,0)');
        gr.addColorStop(1, 'rgba(20,20,20,0.35)');
        g.fillStyle = gr;
        g.fillRect(x, 0, 6 + r() * 10, h);
      }
    }, { repeat: true });
    s.tunnelTex.repeat.set(1, 1);
    s.tunnelMat = new THREE.MeshStandardMaterial({ map: s.tunnelTex, roughness: 0.95, side: THREE.BackSide });
    s.tunnelOuter = new THREE.MeshStandardMaterial({ map: s.grassTex[0], roughness: 1 });
    s.tunnelConcrete = new THREE.MeshStandardMaterial({ map: s.tunnelTex, roughness: 0.95, side: THREE.DoubleSide });
    s.tunnelLamp = new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false });
    s.tunnelFloor = new THREE.MeshStandardMaterial({ color: '#55575a', roughness: 1 });
    s.archCache = new Map();
  }

  buildTunnel(seg, tp, r) {
    const s = this.sh;
    if (!s.tunnelMat) this.initTunnel();
    const sc = seg.scenery;
    const R = tp ? 9.6 : 7.6;
    const cx = tp * 2.7;
    const spring = 3.2;
    const key = R;
    let geo = s.archCache.get(key);
    if (!geo) {
      const inner = new THREE.CylinderGeometry(R, R, SEG_LEN, 36, 1, true, Math.PI / 2, Math.PI);
      inner.rotateX(Math.PI / 2);
      const outer = new THREE.CylinderGeometry(R + 2.8, R + 2.8, SEG_LEN, 36, 1, true, Math.PI / 2, Math.PI);
      outer.rotateX(Math.PI / 2);
      const ring = new THREE.RingGeometry(R, R + 2.8, 36, 1, 0, Math.PI);
      geo = { inner, outer, ring };
      // texturen: lengte in meters laten lopen
      const uv = inner.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 6, uv.getY(i) * (SEG_LEN / 6));
      s.archCache.set(key, geo);
    }
    const add = (g, mat, x, y, z, shadow = false) => {
      const m = new THREE.Mesh(g, mat);
      m.position.set(x, y, z);
      m.castShadow = shadow;
      m.receiveShadow = true;
      sc.add(m);
      return m;
    };
    add(geo.inner, s.tunnelMat, cx, spring, 0);
    add(geo.outer, s.tunnelOuter, cx, spring, 0);
    add(geo.ring, s.tunnelConcrete, cx, spring, SEG_LEN / 2);
    const back = add(geo.ring, s.tunnelConcrete, cx, spring, -SEG_LEN / 2);
    back.rotation.y = Math.PI;
    // zijmuren en vloer
    [-1, 1].forEach((side) => {
      const wx = cx + side * R;
      const w = new THREE.Mesh(s.box, s.tunnelConcrete);
      w.scale.set(0.5, spring, SEG_LEN);
      w.position.set(wx, spring / 2, 0);
      w.receiveShadow = true;
      sc.add(w);
      const outer = Math.abs(wx);
      const inn = 6.4;
      if (outer > inn) {
        const fl = new THREE.Mesh(this.plane(outer - inn, 4), s.tunnelFloor);
        fl.position.set(Math.sign(wx) * (inn + outer) / 2, -0.03, 0);
        fl.receiveShadow = true;
        sc.add(fl);
      }
    });
    // lampen langs de wand en plafond
    for (let z = -SEG_LEN / 2 + 3; z < SEG_LEN / 2; z += 6) {
      [-1, 1].forEach((side) => {
        const l = new THREE.Mesh(s.box, s.tunnelLamp);
        l.scale.set(0.16, 0.14, 0.9);
        l.position.set(cx + side * (R - 0.3), spring + 1.2, z);
        sc.add(l);
        const stripe = new THREE.Mesh(s.box, s.signBlue);
        stripe.scale.set(0.06, 0.5, SEG_LEN);
        stripe.position.set(cx + side * (R - 0.04), 1.8, 0);
        if (z === -SEG_LEN / 2 + 3) sc.add(stripe);
      });
    }
    for (let z = -SEG_LEN / 2 + 6; z < SEG_LEN / 2; z += 12) {
      const l = new THREE.Mesh(s.box, s.tunnelLamp);
      l.scale.set(0.5, 0.1, 1.4);
      l.position.set(cx, spring + R - 0.15, z);
      sc.add(l);
    }
    if (tp) this.buildPlatform(sc, tp, true, r, true);
  }

  buildPlatform(sc, side, station, r, inTunnel = false) {
    const s = this.sh;
    const PH = 0.93;
    const add = (geo, mat, x, y, z, sx, sy, sz, sh = true) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.scale.set(sx, sy, sz);
      m.castShadow = sh;
      m.receiveShadow = true;
      sc.add(m);
      return m;
    };
    const cx = side * 9.35;
    add(s.box, s.concrete, cx, PH / 2 - 0.02, 0, 5.8, PH, SEG_LEN);
    add(s.box, s.platTop, cx + side * 0.15, PH + 0.005, 0, 5.4, 0.04, SEG_LEN, false);
    add(s.box, s.yellowLine, side * 6.8, PH + 0.03, 0, 0.4, 0.02, SEG_LEN, false);
    for (let z = -SEG_LEN / 2 + 1; z < SEG_LEN / 2; z += 2) add(s.box, s.yellowLine, side * 7.35, PH + 0.03, z, 0.5, 0.015, 0.14, false);
    // lantaarns, banken, borden
    for (let z = -SEG_LEN / 2 + 5; z < SEG_LEN / 2; z += 12) {
      add(s.box, s.mast, side * 11.6, PH + 2.2, z, 0.12, 4.4, 0.12);
      add(s.box, s.tunnelLamp || s.white, side * 11.1, PH + 4.4, z, 0.7, 0.1, 0.3, false);
      add(s.box, s.wood, side * 11.7, PH + 0.5, z + 3.5, 0.55, 0.12, 2.0, false);
      add(s.box, s.wood, side * 11.95, PH + 0.9, z + 3.5, 0.1, 0.8, 2.0, false);
      add(s.box, s.mast, side * 11.6, PH + 0.25, z + 2.6, 0.1, 0.5, 0.1, false);
      add(s.box, s.mast, side * 11.6, PH + 0.25, z + 4.4, 0.1, 0.5, 0.1, false);
    }
    const sign = add(s.box, s.nameMat, side * 10.2, PH + 3.0, -SEG_LEN / 2 + 4, 0.1, 0.9, 3.4, false);
    sign.material = s.nameMat;
    // vitrine met reclame
    add(s.box, s.signBlue, side * 12.0, PH + 1.2, -4, 0.15, 2.0, 1.2, false);
    if (station && !inTunnel) {
      // overkapping met kolommen
      for (let z = -SEG_LEN / 2 + 4; z < SEG_LEN / 2; z += 8) add(s.box, s.mast, side * 7.6, PH + 2.1, z, 0.2, 4.2, 0.2);
      add(s.box, s.white, side * 9.7, PH + 4.35, 0, 5.8, 0.18, SEG_LEN, true);
      add(s.box, s.signBlue, side * 9.7, PH + 4.5, 0, 5.8, 0.1, SEG_LEN, false);
    }
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
