import * as THREE from 'three';
import { createAsphaltTexture, createCurbTexture, createCityGroundTexture } from '../utils/proceduralTextures.js';

const WORLD_UP = new THREE.Vector3(0, 1, 0);
const SAMPLE_COUNT = 640;
const MAX_BANK_RAD = THREE.MathUtils.degToRad(16);
const BANK_GAIN = 2;
const CURB_WIDTH = 1.1;
const CURB_HEIGHT = 0.09;
const BARRIER_GAP = 0.6;
const BARRIER_HEIGHT = 1.05;
const SKIRT_DEPTH = 9;

function buildRibbon(samples, { left, right, normal, uvRepeatY = 1 }) {
  const n = samples.length;
  const positions = new Float32Array(n * 2 * 3);
  const normals = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);

  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const l = left(s);
    const r = right(s);
    const nl = normal(s, -1);
    const nr = normal(s, 1);
    const vi = i * 2;
    positions[vi * 3] = l.x;
    positions[vi * 3 + 1] = l.y;
    positions[vi * 3 + 2] = l.z;
    positions[(vi + 1) * 3] = r.x;
    positions[(vi + 1) * 3 + 1] = r.y;
    positions[(vi + 1) * 3 + 2] = r.z;

    normals[vi * 3] = nl.x;
    normals[vi * 3 + 1] = nl.y;
    normals[vi * 3 + 2] = nl.z;
    normals[(vi + 1) * 3] = nr.x;
    normals[(vi + 1) * 3 + 1] = nr.y;
    normals[(vi + 1) * 3 + 2] = nr.z;

    const v = (i / (n - 1)) * uvRepeatY;
    uvs[vi * 2] = 0;
    uvs[vi * 2 + 1] = v;
    uvs[(vi + 1) * 2] = 1;
    uvs[(vi + 1) * 2 + 1] = v;
  }

  const indices = [];
  for (let i = 0; i < n - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = i * 2 + 2;
    const d = i * 2 + 3;
    // Winding chosen so the triangle's face points toward `normal` (the up
    // vector), not away from it — otherwise FrontSide materials (the road)
    // get backface-culled when viewed from above.
    indices.push(a, c, b, b, c, d);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  return geometry;
}

function computeSamples(curve, width) {
  curve.arcLengthDivisions = 2000;
  curve.updateArcLengths();
  const points = curve.getSpacedPoints(SAMPLE_COUNT);
  const halfWidth = width / 2;
  const samples = [];

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const u = i / SAMPLE_COUNT;
    const position = points[i].clone();
    const tangent = curve.getTangentAt(u).normalize();

    const du = 1 / SAMPLE_COUNT;
    const uPrev = (u - du + 1) % 1;
    const uNext = (u + du) % 1;
    const tPrev = curve.getTangentAt(uPrev).normalize();
    const tNext = curve.getTangentAt(uNext).normalize();
    const curveCross = new THREE.Vector3().crossVectors(tPrev, tNext);
    const signedCurvature = curveCross.y;
    const bankAngle = THREE.MathUtils.clamp(signedCurvature * BANK_GAIN, -MAX_BANK_RAD, MAX_BANK_RAD);

    let up = tangent.clone().cross(WORLD_UP).cross(tangent).normalize();
    if (up.lengthSq() < 0.01) up = WORLD_UP.clone();
    let right = up.clone().cross(tangent).normalize();

    right.applyAxisAngle(tangent, bankAngle);
    up.applyAxisAngle(tangent, bankAngle);

    samples.push({ position, tangent, right, up, bankAngle, halfWidth, index: i });
  }

  // total arc length
  let length = 0;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const next = samples[(i + 1) % SAMPLE_COUNT];
    length += samples[i].position.distanceTo(next.position);
  }

  return { samples, length };
}

function buildStartTransform(sample) {
  const dummy = new THREE.Object3D();
  dummy.up.copy(sample.up);
  dummy.position.copy(sample.position);
  // Object3D.lookAt() (unlike Camera.lookAt()) points local +Z at the target,
  // so we look at the point BEHIND the direction of travel to make local -Z
  // (our car model's front) face along the tangent.
  dummy.lookAt(sample.position.clone().sub(sample.tangent));
  return { position: sample.position.clone().add(sample.up.clone().multiplyScalar(0.4)), quaternion: dummy.quaternion.clone() };
}

const THEME_COLORS = {
  sunset: { skirt: 0x5b4632, curbA: '#d61f2c', curbB: '#f2f2f2', barrier: 0xd8d8d8, barrierEmissive: 0x000000 },
  night: { skirt: 0x1a1c22, curbA: '#08d9d6', curbB: '#151821', barrier: 0x22252f, barrierEmissive: 0x08d9d6 },
};

export function buildTrack(trackDef) {
  const points3 = trackDef.points.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
  const curve = new THREE.CatmullRomCurve3(points3, true, 'catmullrom', 0.5);
  const { samples, length } = computeSamples(curve, trackDef.width);
  const theme = THEME_COLORS[trackDef.theme] || THEME_COLORS.sunset;

  const group = new THREE.Group();
  group.name = `track-${trackDef.id}`;

  // Close the ribbon loop by duplicating first sample at the end.
  const loopSamples = [...samples, { ...samples[0], position: samples[0].position }];

  // --- Road surface ---
  const roadGeo = buildRibbon(loopSamples, {
    left: (s) => s.position.clone().addScaledVector(s.right, -s.halfWidth),
    right: (s) => s.position.clone().addScaledVector(s.right, s.halfWidth),
    normal: (s) => s.up,
    uvRepeatY: Math.max(4, Math.round(length / 8)),
  });
  const asphaltTex = createAsphaltTexture({ repeatX: 1, repeatY: 1 });
  const roadMat = new THREE.MeshStandardMaterial({ map: asphaltTex, roughness: 0.92, metalness: 0.02 });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // --- Curbs (left & right) ---
  const curbTex = createCurbTexture({ repeatX: 1, repeatY: Math.max(4, Math.round(length / 4)) });
  const curbMat = new THREE.MeshStandardMaterial({ map: curbTex, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });

  const curbLeftGeo = buildRibbon(loopSamples, {
    left: (s) => s.position.clone().addScaledVector(s.right, -s.halfWidth - CURB_WIDTH).addScaledVector(s.up, CURB_HEIGHT),
    right: (s) => s.position.clone().addScaledVector(s.right, -s.halfWidth).addScaledVector(s.up, CURB_HEIGHT),
    normal: (s) => s.up,
  });
  const curbLeftMesh = new THREE.Mesh(curbLeftGeo, curbMat);
  curbLeftMesh.receiveShadow = true;
  group.add(curbLeftMesh);

  const curbRightGeo = buildRibbon(loopSamples, {
    left: (s) => s.position.clone().addScaledVector(s.right, s.halfWidth).addScaledVector(s.up, CURB_HEIGHT),
    right: (s) => s.position.clone().addScaledVector(s.right, s.halfWidth + CURB_WIDTH).addScaledVector(s.up, CURB_HEIGHT),
    normal: (s) => s.up,
  });
  const curbRightMesh = new THREE.Mesh(curbRightGeo, curbMat);
  curbRightMesh.receiveShadow = true;
  group.add(curbRightMesh);

  // --- Barriers (guard rails) ---
  const barrierOffset = trackDef.width / 2 + CURB_WIDTH + BARRIER_GAP;
  const barrierMat = new THREE.MeshStandardMaterial({
    color: theme.barrier,
    emissive: theme.barrierEmissive,
    emissiveIntensity: theme.barrierEmissive ? 0.9 : 0,
    roughness: 0.5,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });

  function buildBarrier(sign) {
    const geo = buildRibbon(loopSamples, {
      left: (s) => s.position.clone().addScaledVector(s.right, sign * barrierOffset),
      right: (s) => s.position.clone().addScaledVector(s.right, sign * barrierOffset).addScaledVector(WORLD_UP, BARRIER_HEIGHT),
      normal: (s) => s.right.clone().multiplyScalar(sign),
      uvRepeatY: Math.max(4, Math.round(length / 6)),
    });
    return new THREE.Mesh(geo, barrierMat);
  }
  const barrierLeft = buildBarrier(-1);
  const barrierRight = buildBarrier(1);
  barrierLeft.castShadow = true;
  barrierRight.castShadow = true;
  group.add(barrierLeft, barrierRight);

  // --- Embankment skirts down to base terrain ---
  const skirtMat = new THREE.MeshStandardMaterial({ color: theme.skirt, roughness: 1, metalness: 0, side: THREE.DoubleSide });
  function buildSkirt(sign) {
    const geo = buildRibbon(loopSamples, {
      left: (s) => s.position.clone().addScaledVector(s.right, sign * (barrierOffset + 0.05)),
      right: (s) => {
        const top = s.position.clone().addScaledVector(s.right, sign * (barrierOffset + 0.05));
        return new THREE.Vector3(top.x, -SKIRT_DEPTH, top.z);
      },
      normal: (s) => s.right.clone().multiplyScalar(sign),
    });
    return new THREE.Mesh(geo, skirtMat);
  }
  const skirtLeft = buildSkirt(-1);
  const skirtRight = buildSkirt(1);
  skirtLeft.receiveShadow = true;
  skirtRight.receiveShadow = true;
  group.add(skirtLeft, skirtRight);

  // --- Start / finish gantry ---
  const startSample = samples[0];
  const gantryMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6, metalness: 0.4 });
  const postGeo = new THREE.CylinderGeometry(0.25, 0.25, 6, 8);
  const postL = new THREE.Mesh(postGeo, gantryMat);
  const postR = new THREE.Mesh(postGeo, gantryMat);
  const beamGeo = new THREE.BoxGeometry(trackDef.width + 2, 0.6, 0.6);
  const beam = new THREE.Mesh(beamGeo, new THREE.MeshStandardMaterial({ color: 0xff2e63, emissive: 0xff2e63, emissiveIntensity: 0.6, roughness: 0.4 }));

  const gantryGroup = new THREE.Group();
  postL.position.copy(startSample.right.clone().multiplyScalar(-(trackDef.width / 2 + 1)));
  postL.position.y += 3;
  postR.position.copy(startSample.right.clone().multiplyScalar(trackDef.width / 2 + 1));
  postR.position.y += 3;
  beam.position.y = 6;
  gantryGroup.add(postL, postR, beam);
  gantryGroup.position.copy(startSample.position);
  gantryGroup.lookAt(startSample.position.clone().add(startSample.tangent));
  gantryGroup.castShadow = true;
  group.add(gantryGroup);

  const startTransform = buildStartTransform(startSample);

  // --- Query helper (spatial lookup w/ locality optimisation) ---
  let lastIndex = 0;
  function query(position) {
    const n = samples.length;
    const window = 50;
    let bestIndex = -1;
    let bestDistSq = Infinity;
    for (let k = -window; k <= window; k++) {
      const idx = ((lastIndex + k) % n + n) % n;
      const s = samples[idx];
      const dx = position.x - s.position.x;
      const dz = position.z - s.position.z;
      const distSq = dx * dx + dz * dz;
      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestIndex = idx;
      }
    }
    lastIndex = bestIndex;
    const s = samples[bestIndex];
    const toCar = new THREE.Vector3().subVectors(position, s.position);
    const lateral = toCar.dot(s.right);
    const forwardOffset = toCar.dot(s.tangent);
    const segLen = length / n;
    let progress = (bestIndex + forwardOffset / segLen) / n;
    progress = ((progress % 1) + 1) % 1;
    const surfacePoint = s.position.clone().addScaledVector(s.right, lateral);
    return {
      index: bestIndex,
      sample: s,
      lateral,
      absLateral: Math.abs(lateral),
      onRoad: Math.abs(lateral) <= s.halfWidth,
      onCurb: Math.abs(lateral) > s.halfWidth && Math.abs(lateral) <= s.halfWidth + CURB_WIDTH,
      barrierLimit: barrierOffset - 0.3,
      groundY: surfacePoint.y,
      tangent: s.tangent,
      up: s.up,
      right: s.right,
      bankAngle: s.bankAngle,
      progress,
    };
  }

  function resetQueryHint(index = 0) {
    lastIndex = index;
  }

  const checkpoints = trackDef.checkpoints.slice();

  return {
    id: trackDef.id,
    name: trackDef.name,
    theme: trackDef.theme,
    laps: trackDef.laps,
    width: trackDef.width,
    group,
    samples,
    length,
    checkpoints,
    startPosition: startTransform.position,
    startQuaternion: startTransform.quaternion,
    query,
    resetQueryHint,
    barrierOffset,
  };
}
