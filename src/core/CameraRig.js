import * as THREE from 'three';

const BASE_FOV = 62;
const MAX_FOV_ADD = 12;
const FOLLOW_DISTANCE = 6.4;
const FOLLOW_HEIGHT = 2.35;
const LOOK_AHEAD = 5.5;
const LOOK_HEIGHT = 1.0;

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.currentPos = new THREE.Vector3();
    this.currentLook = new THREE.Vector3();
    this._initialized = false;
    this._shake = 0;
  }

  snapTo(carPosition, carQuaternion) {
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(carQuaternion);
    this.currentPos.copy(carPosition).addScaledVector(forward, -FOLLOW_DISTANCE).addScaledVector(up, FOLLOW_HEIGHT);
    this.currentLook.copy(carPosition).addScaledVector(forward, LOOK_AHEAD);
    this.camera.position.copy(this.currentPos);
    this.camera.lookAt(this.currentLook);
    this._initialized = true;
  }

  update(dt, carPosition, carQuaternion, speedKmh, collisionPulse = 0) {
    if (!this._initialized) {
      this.snapTo(carPosition, carQuaternion);
      return;
    }
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(carQuaternion);
    const worldUp = new THREE.Vector3(0, 1, 0);

    const desiredPos = carPosition.clone().addScaledVector(forward, -FOLLOW_DISTANCE).addScaledVector(worldUp, FOLLOW_HEIGHT);
    const desiredLook = carPosition.clone().addScaledVector(forward, LOOK_AHEAD).addScaledVector(worldUp, LOOK_HEIGHT);

    const posLerp = 1 - Math.exp(-6.5 * dt);
    const lookLerp = 1 - Math.exp(-10 * dt);
    this.currentPos.lerp(desiredPos, posLerp);
    this.currentLook.lerp(desiredLook, lookLerp);

    this._shake = Math.max(this._shake * 0.85, collisionPulse * 0.4);
    const shakeOffset = this._shake > 0.001
      ? new THREE.Vector3((Math.random() - 0.5) * this._shake, (Math.random() - 0.5) * this._shake, (Math.random() - 0.5) * this._shake)
      : null;

    this.camera.position.copy(this.currentPos);
    if (shakeOffset) this.camera.position.add(shakeOffset);
    this.camera.lookAt(this.currentLook);

    const speedFrac = Math.min(1, speedKmh / 210);
    const targetFov = BASE_FOV + speedFrac * MAX_FOV_ADD;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-3 * dt));
    this.camera.updateProjectionMatrix();
  }
}
