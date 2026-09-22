import * as THREE from 'three';

const WHEEL_RADIUS = 0.34;
const WHEEL_WIDTH = 0.26;
const TRACK_X = 0.84;
const FRONT_Z = -1.32;
const REAR_Z = 1.28;

function buildWheel() {
  const group = new THREE.Group();
  const tireGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 22);
  tireGeo.rotateZ(Math.PI / 2);
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x14141a, roughness: 0.92, metalness: 0.05 });
  const tire = new THREE.Mesh(tireGeo, tireMat);
  tire.castShadow = true;
  tire.receiveShadow = true;

  const rimGeo = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.58, WHEEL_RADIUS * 0.58, WHEEL_WIDTH * 1.02, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xcfd3da, roughness: 0.32, metalness: 0.85 });
  const rim = new THREE.Mesh(rimGeo, rimMat);

  const hubGeo = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.16, WHEEL_RADIUS * 0.16, WHEEL_WIDTH * 1.08, 10);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, new THREE.MeshStandardMaterial({ color: 0x30323a, roughness: 0.5, metalness: 0.6 }));

  group.add(tire, rim, hub);
  return group;
}

/**
 * Builds a stylised-but-plausible sports car. Local space convention:
 * -Z = front (matches THREE.Object3D.lookAt / getWorldDirection), +X = right, ground = y0.
 */
export function createCarModel(colorHex = '#ff2e63') {
  const root = new THREE.Group();
  root.name = 'car';

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(colorHex),
    roughness: 0.32,
    metalness: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
  });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.55, metalness: 0.4 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c2a38,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
  });

  const body = new THREE.Group();

  const chassis = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.48, 3.5), paintMat);
  chassis.position.set(0, 0.66, -0.05);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  body.add(chassis);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.46, 0.5, 1.75), paintMat);
  cabin.position.set(0, 1.14, 0.12);
  cabin.castShadow = true;
  body.add(cabin);

  const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.42, 0.1), glassMat);
  windshield.position.set(0, 1.08, -0.72);
  windshield.rotation.x = -0.55;
  body.add(windshield);

  const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.4, 0.1), glassMat);
  rearWindow.position.set(0, 1.05, 0.98);
  rearWindow.rotation.x = 0.5;
  body.add(rearWindow);

  const sideGlassGeo = new THREE.BoxGeometry(0.06, 0.34, 1.5);
  const sideGlassL = new THREE.Mesh(sideGlassGeo, glassMat);
  sideGlassL.position.set(-0.74, 1.14, 0.1);
  const sideGlassR = sideGlassL.clone();
  sideGlassR.position.x = 0.74;
  body.add(sideGlassL, sideGlassR);

  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.34, 0.5), trimMat);
  frontBumper.position.set(0, 0.44, -1.78);
  frontBumper.castShadow = true;
  body.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.34, 0.46), trimMat);
  rearBumper.position.set(0, 0.44, 1.72);
  rearBumper.castShadow = true;
  body.add(rearBumper);

  const mirrorGeo = new THREE.BoxGeometry(0.1, 0.14, 0.26);
  const mirrorL = new THREE.Mesh(mirrorGeo, trimMat);
  mirrorL.position.set(-0.86, 1.0, -0.55);
  const mirrorR = mirrorL.clone();
  mirrorR.position.x = 0.86;
  body.add(mirrorL, mirrorR);

  const wingStrutGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.32, 6);
  const strutL = new THREE.Mesh(wingStrutGeo, trimMat);
  strutL.position.set(-0.55, 1.0, 1.95);
  const strutR = strutL.clone();
  strutR.position.x = 0.55;
  const wing = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.32), trimMat);
  wing.position.set(0, 1.16, 1.95);
  wing.castShadow = true;
  body.add(strutL, strutR, wing);

  const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 1.6, roughness: 0.3 });
  const headlightGeo = new THREE.BoxGeometry(0.32, 0.14, 0.08);
  const headlightL = new THREE.Mesh(headlightGeo, headlightMat.clone());
  headlightL.position.set(-0.62, 0.58, -2.0);
  const headlightR = headlightL.clone();
  headlightR.position.x = 0.62;
  body.add(headlightL, headlightR);

  const taillightMat = new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0xff1122, emissiveIntensity: 1.2, roughness: 0.3 });
  const taillightGeo = new THREE.BoxGeometry(0.34, 0.14, 0.08);
  const taillightL = new THREE.Mesh(taillightGeo, taillightMat.clone());
  taillightL.position.set(-0.62, 0.58, 1.93);
  const taillightR = taillightL.clone();
  taillightR.position.x = 0.62;
  body.add(taillightL, taillightR);

  // headlight spotlights for nighttime illumination
  const headSpotL = new THREE.SpotLight(0xfff4d8, 6, 45, Math.PI / 6.5, 0.5, 1.4);
  headSpotL.position.copy(headlightL.position);
  const headTargetL = new THREE.Object3D();
  headTargetL.position.set(headlightL.position.x, 0, -20);
  headSpotL.target = headTargetL;

  const headSpotR = new THREE.SpotLight(0xfff4d8, 6, 45, Math.PI / 6.5, 0.5, 1.4);
  headSpotR.position.copy(headlightR.position);
  const headTargetR = new THREE.Object3D();
  headTargetR.position.set(headlightR.position.x, 0, -20);
  headSpotR.target = headTargetR;

  body.add(headSpotL, headTargetL, headSpotR, headTargetR);

  root.add(body);

  function makeWheelRig(x, z) {
    const steerPivot = new THREE.Group();
    steerPivot.position.set(x, WHEEL_RADIUS, z);
    const spinPivot = new THREE.Group();
    const wheel = buildWheel();
    spinPivot.add(wheel);
    steerPivot.add(spinPivot);
    root.add(steerPivot);
    return { steerPivot, spinPivot };
  }

  const flRig = makeWheelRig(-TRACK_X, FRONT_Z);
  const frRig = makeWheelRig(TRACK_X, FRONT_Z);
  const rlRig = makeWheelRig(-TRACK_X, REAR_Z);
  const rrRig = makeWheelRig(TRACK_X, REAR_Z);

  root.position.y = 0;

  return {
    group: root,
    paintMaterial: paintMat,
    headlights: [headlightL, headlightR],
    taillights: [taillightL, taillightR],
    headSpots: [headSpotL, headSpotR],
    wheels: {
      frontLeft: flRig,
      frontRight: frRig,
      rearLeft: rlRig,
      rearRight: rrRig,
    },
    wheelRadius: WHEEL_RADIUS,
    setBraking(active) {
      const intensity = active ? 3.2 : 1.2;
      taillightL.material.emissiveIntensity = intensity;
      taillightR.material.emissiveIntensity = intensity;
    },
    setLightsOn(on) {
      headlightL.material.emissiveIntensity = on ? 2.4 : 0.6;
      headlightR.material.emissiveIntensity = on ? 2.4 : 0.6;
      headSpotL.visible = on;
      headSpotR.visible = on;
    },
  };
}
