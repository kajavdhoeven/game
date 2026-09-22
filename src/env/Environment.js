import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { createGrassTexture, createCityGroundTexture } from '../utils/proceduralTextures.js';

function computeTrackBounds(samples, margin) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const s of samples) {
    minX = Math.min(minX, s.position.x);
    maxX = Math.max(maxX, s.position.x);
    minZ = Math.min(minZ, s.position.z);
    maxZ = Math.max(maxZ, s.position.z);
  }
  return { minX: minX - margin, maxX: maxX + margin, minZ: minZ - margin, maxZ: maxZ + margin };
}

function distanceToTrack(x, z, samples, everyNth = 4) {
  let best = Infinity;
  for (let i = 0; i < samples.length; i += everyNth) {
    const s = samples[i];
    const dx = x - s.position.x;
    const dz = z - s.position.z;
    const d = dx * dx + dz * dz;
    if (d < best) best = d;
  }
  return Math.sqrt(best);
}

function scatterPositions({ count, bounds, samples, minClearance, seed = 1 }) {
  let s = seed;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  const points = [];
  let attempts = 0;
  while (points.length < count && attempts < count * 12) {
    attempts++;
    const x = bounds.minX + rand() * (bounds.maxX - bounds.minX);
    const z = bounds.minZ + rand() * (bounds.maxZ - bounds.minZ);
    if (distanceToTrack(x, z, samples) > minClearance) {
      points.push({ x, z, scale: 0.7 + rand() * 0.9, rot: rand() * Math.PI * 2 });
    }
  }
  return points;
}

function buildTree() {
  const group = new THREE.Group();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4330, roughness: 0.95 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e6b3e, roughness: 0.85 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.26, 2.2, 6), trunkMat);
  trunk.position.y = 1.1;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3.6, 7), leafMat);
  leaves.position.y = 3.6;
  const leaves2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.6, 7), leafMat);
  leaves2.position.y = 4.8;
  group.add(trunk, leaves, leaves2);
  return group;
}

function instanceScatter(templateGroup, points, castShadow = true) {
  const container = new THREE.Group();
  templateGroup.traverse((child) => {
    if (!child.isMesh) return;
    const inst = new THREE.InstancedMesh(child.geometry, child.material, points.length);
    inst.castShadow = castShadow;
    inst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    points.forEach((p, i) => {
      dummy.position.set(p.x, child.position.y * p.scale, p.z);
      dummy.rotation.y = p.rot;
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    });
    inst.instanceMatrix.needsUpdate = true;
    container.add(inst);
  });
  return container;
}

function buildBuilding() {
  const group = new THREE.Group();
  const h = 6 + Math.random() * 26;
  const w = 4 + Math.random() * 5;
  const windowColor = Math.random() > 0.5 ? 0xffd27a : 0x6bf0ff;
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14161c, roughness: 0.75, metalness: 0.1 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), bodyMat);
  body.position.y = h / 2;
  group.add(body);

  const winGeo = new THREE.PlaneGeometry(w * 0.85, h * 0.85);
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c10,
    emissive: windowColor,
    emissiveIntensity: 0.5 + Math.random() * 0.6,
    roughness: 0.4,
  });
  for (let side = 0; side < 4; side++) {
    const plane = new THREE.Mesh(winGeo, winMat);
    plane.position.y = h / 2;
    const dist = w / 2 + 0.02;
    if (side === 0) plane.position.z = dist;
    if (side === 1) {
      plane.position.z = -dist;
      plane.rotation.y = Math.PI;
    }
    if (side === 2) {
      plane.position.x = dist;
      plane.rotation.y = Math.PI / 2;
    }
    if (side === 3) {
      plane.position.x = -dist;
      plane.rotation.y = -Math.PI / 2;
    }
    group.add(plane);
  }
  return group;
}

function buildMountainRing(bounds) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 1, fog: true });
  const radius = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 0.9;
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cz = (bounds.minZ + bounds.maxZ) / 2;
  const count = 24;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const r = radius * (1.05 + Math.random() * 0.25);
    const h = 40 + Math.random() * 90;
    const cone = new THREE.Mesh(new THREE.ConeGeometry(60 + Math.random() * 60, h, 5), mat);
    cone.position.set(cx + Math.cos(angle) * r, h / 2 - 20, cz + Math.sin(angle) * r);
    cone.rotation.y = Math.random() * Math.PI;
    group.add(cone);
  }
  return group;
}

function buildStarfield() {
  const count = 1400;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 800 + Math.random() * 200;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 0.85);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi)) + 40;
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.85 });
  return new THREE.Points(geo, mat);
}

export function buildEnvironment({ theme, trackHandle, renderer }) {
  const group = new THREE.Group();
  const bounds = computeTrackBounds(trackHandle.samples, 260);
  const groundSize = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 1.6;
  const groundCenterX = (bounds.minX + bounds.maxX) / 2;
  const groundCenterZ = (bounds.minZ + bounds.maxZ) / 2;

  let sunLight;
  let fog;
  let backgroundColor;
  let hemi;

  if (theme === 'night') {
    backgroundColor = new THREE.Color(0x05060c);
    fog = new THREE.FogExp2(0x0a0c16, 0.0032);

    const groundTex = createCityGroundTexture({ repeatX: groundSize / 12, repeatY: groundSize / 12 });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.85, metalness: 0.15 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(groundCenterX, -9, groundCenterZ);
    ground.receiveShadow = true;
    group.add(ground);

    hemi = new THREE.HemisphereLight(0x1a2440, 0x05060a, 0.6);
    group.add(hemi);

    sunLight = new THREE.DirectionalLight(0x8fb4ff, 1.1);
    sunLight.position.set(-60, 90, -40);
    group.add(sunLight);
    group.add(sunLight.target);

    const moon = new THREE.Mesh(
      new THREE.SphereGeometry(6, 16, 16),
      new THREE.MeshStandardMaterial({ color: 0xe8ecff, emissive: 0xaebeff, emissiveIntensity: 1.4, roughness: 1 })
    );
    moon.position.set(-260, 220, -300);
    group.add(moon);

    group.add(buildStarfield());

    const buildingTemplate = new THREE.Group();
    const buildingPoints = scatterPositions({ count: 70, bounds, samples: trackHandle.samples, minClearance: trackHandle.barrierOffset + 14, seed: 7 });
    buildingPoints.forEach((p) => {
      const b = buildBuilding();
      b.position.set(p.x, 0, p.z);
      b.rotation.y = p.rot;
      group.add(b);
    });
  } else {
    backgroundColor = new THREE.Color(0xffd9a3);
    fog = new THREE.FogExp2(0xffc98f, 0.0022);

    const sky = new Sky();
    sky.scale.setScalar(20000);
    const sun = new THREE.Vector3();
    const uniforms = sky.material.uniforms;
    uniforms.turbidity.value = 6.5;
    uniforms.rayleigh.value = 2.4;
    uniforms.mieCoefficient.value = 0.012;
    uniforms.mieDirectionalG.value = 0.88;
    const elevation = 9;
    const azimuth = 130;
    const phi = THREE.MathUtils.degToRad(90 - elevation);
    const thetaAngle = THREE.MathUtils.degToRad(azimuth);
    sun.setFromSphericalCoords(1, phi, thetaAngle);
    uniforms.sunPosition.value.copy(sun);
    group.add(sky);

    const groundTex = createGrassTexture({ repeatX: groundSize / 8, repeatY: groundSize / 8 });
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(groundSize, groundSize),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(groundCenterX, -9, groundCenterZ);
    ground.receiveShadow = true;
    group.add(ground);

    hemi = new THREE.HemisphereLight(0xffe3b3, 0x3d5c2e, 0.75);
    group.add(hemi);

    sunLight = new THREE.DirectionalLight(0xffd9a0, 3.2);
    sunLight.position.copy(sun.clone().multiplyScalar(400));
    group.add(sunLight);
    group.add(sunLight.target);

    group.add(buildMountainRing(bounds));

    const treeTemplate = buildTree();
    const treePoints = scatterPositions({ count: 220, bounds, samples: trackHandle.samples, minClearance: trackHandle.barrierOffset + 6, seed: 13 });
    group.add(instanceScatter(treeTemplate, treePoints));
  }

  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.bias = -0.0004;
  sunLight.shadow.normalBias = 0.02;
  const shadowSpan = 55;
  sunLight.shadow.camera.left = -shadowSpan;
  sunLight.shadow.camera.right = shadowSpan;
  sunLight.shadow.camera.top = shadowSpan;
  sunLight.shadow.camera.bottom = -shadowSpan;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 260;
  sunLight.shadow.camera.updateProjectionMatrix();

  const sunOffset = sunLight.position.clone().normalize();

  function followTarget(position) {
    sunLight.position.copy(position).addScaledVector(sunOffset, 140);
    sunLight.target.position.copy(position);
    sunLight.target.updateMatrixWorld();
  }

  return {
    group,
    sunLight,
    hemi,
    fog,
    backgroundColor,
    followTarget,
  };
}
