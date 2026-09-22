import * as THREE from 'three';

const WHEEL_BASE = 2.6;
const MAX_STEER_RAD = THREE.MathUtils.degToRad(34);
const ENGINE_ACCEL = 23;
const BOOST_ACCEL = 16;
const BRAKE_DECEL = 32;
const REVERSE_ACCEL = 11;
const DRAG_COEFF = 0.0024;
const ROLL_COEFF = 0.6;
const OFFROAD_DRAG_MULT = 3.2;
const GRIP_ROAD = 9.5;
const GRIP_OFFROAD = 3.5;
const GRIP_DRIFT = 1.35;
const SLIP_GAIN = 0.85;
const BOOST_DRAIN_PER_SEC = 0.42;
const BOOST_DRIFT_GAIN_PER_SEC = 0.5;
const BOOST_PASSIVE_REGEN = 0.035;

function forwardFromHeading(heading, out = new THREE.Vector3()) {
  return out.set(-Math.sin(heading), 0, -Math.cos(heading));
}
function rightFromHeading(heading, out = new THREE.Vector3()) {
  return out.set(Math.cos(heading), 0, -Math.sin(heading));
}

export class CarController {
  constructor(trackHandle, wheelRadius = 0.34) {
    this.track = trackHandle;
    this.wheelRadius = wheelRadius;
    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.heading = 0;
    this.driftFactor = 0;
    this.boost = 1;
    this.collisionPulse = 0;
    this.onRoad = true;
    this.renderPosition = new THREE.Vector3();
    this.renderQuaternion = new THREE.Quaternion();
    this._smoothY = 0;
    this._dummy = new THREE.Object3D();
    this._wheelSpinAngle = 0;
    this._lastQuery = null;
    this.wrongWay = false;
    this.reset(trackHandle.startPosition, trackHandle.startQuaternion);
  }

  reset(position, quaternion) {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    // Extract yaw from the forward vector rather than an Euler decomposition:
    // the start quaternion also encodes bank/slope roll, and decomposing that
    // directly conflates roll with yaw. The forward vector is roll-invariant.
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);
    this.heading = Math.atan2(-forward.x, -forward.z);
    this.driftFactor = 0;
    this.collisionPulse = 0;
    this.boost = 1;
    this._smoothY = position.y;
    this.renderPosition.copy(position);
    this.renderQuaternion.copy(quaternion);
    this.track.resetQueryHint();
    this._lastQuery = this.track.query(this.position);
  }

  get speedMs() {
    return this.velocity.length();
  }
  get speedKmh() {
    return this.speedMs * 3.6;
  }
  get forwardSpeedSigned() {
    const fwd = forwardFromHeading(this.heading);
    return this.velocity.dot(fwd);
  }
  get wheelSpinAngle() {
    return this._wheelSpinAngle;
  }

  update(dt, input) {
    dt = Math.min(dt, 1 / 20);
    const preQuery = this.track.query(this.position);
    this.onRoad = preQuery.onRoad;

    const fwd = forwardFromHeading(this.heading);
    const right = rightFromHeading(this.heading);
    let forwardSpeed = this.velocity.dot(fwd);
    const speedFrac = Math.min(1, Math.abs(forwardSpeed) / 58);

    // --- boost meter ---
    const boosting = input.boost && this.boost > 0.02 && forwardSpeed > 0.5;
    if (boosting) {
      this.boost = Math.max(0, this.boost - BOOST_DRAIN_PER_SEC * dt);
    } else if (input.handbrake && this.driftFactor > 0.15) {
      this.boost = Math.min(1, this.boost + BOOST_DRIFT_GAIN_PER_SEC * this.driftFactor * dt);
    } else {
      this.boost = Math.min(1, this.boost + BOOST_PASSIVE_REGEN * dt);
    }

    // --- longitudinal forces ---
    let accel = 0;
    if (input.throttle > 0) {
      accel += input.throttle * ENGINE_ACCEL * (1 - speedFrac * 0.55);
      if (boosting) accel += BOOST_ACCEL;
    }
    if (input.brake > 0) {
      if (forwardSpeed > 0.6) {
        accel -= input.brake * BRAKE_DECEL;
      } else {
        accel -= input.brake * REVERSE_ACCEL;
      }
    }
    const surfaceMult = preQuery.onRoad ? 1 : OFFROAD_DRAG_MULT;
    const drag = DRAG_COEFF * forwardSpeed * Math.abs(forwardSpeed) * surfaceMult;
    const roll = ROLL_COEFF * forwardSpeed * surfaceMult * 0.02;
    forwardSpeed += (accel - drag - roll) * dt;
    if (Math.abs(forwardSpeed) < 0.04 && input.throttle === 0 && input.brake === 0) forwardSpeed = 0;

    // --- steering / heading ---
    const steerAngle = input.steer * MAX_STEER_RAD * (1 - speedFrac * 0.45);
    let turnRate = 0;
    if (Math.abs(forwardSpeed) > 0.15) {
      turnRate = (forwardSpeed / WHEEL_BASE) * Math.tan(steerAngle);
    } else if (Math.abs(input.steer) > 0.05) {
      turnRate = input.steer * 0.5;
    }
    this.heading += turnRate * dt;
    this.steerAngle = steerAngle;

    // --- lateral grip / drift ---
    const newFwd = forwardFromHeading(this.heading);
    const newRight = rightFromHeading(this.heading);
    const oldVelWorld = fwd.clone().multiplyScalar(forwardSpeed).add(right.clone().multiplyScalar(this.velocity.dot(right)));
    let newForwardComp = oldVelWorld.dot(newFwd);
    let newLateralComp = oldVelWorld.dot(newRight);

    const grip = input.handbrake ? GRIP_DRIFT : preQuery.onRoad ? GRIP_ROAD : GRIP_OFFROAD;
    const decay = Math.exp(-grip * dt);
    newLateralComp *= decay;
    const slipKick = steerAngle * newForwardComp * SLIP_GAIN * (1 - Math.min(1, grip / GRIP_ROAD));
    newLateralComp += slipKick * dt;

    this.driftFactor = Math.min(1, Math.abs(newLateralComp) / 7);

    this.velocity.copy(newFwd).multiplyScalar(newForwardComp).addScaledVector(newRight, newLateralComp);

    // --- integrate position ---
    this.position.addScaledVector(this.velocity, dt);

    // --- barrier collision ---
    let postQuery = this.track.query(this.position);
    if (postQuery.absLateral > postQuery.barrierLimit) {
      const overshoot = postQuery.absLateral - postQuery.barrierLimit;
      const sign = Math.sign(postQuery.lateral) || 1;
      this.position.addScaledVector(postQuery.right, -overshoot * sign);
      const velLateral = this.velocity.dot(postQuery.right);
      this.velocity.addScaledVector(postQuery.right, -velLateral * 1.4);
      this.velocity.multiplyScalar(0.8);
      this.collisionPulse = Math.min(1, Math.abs(velLateral) / 12);
      postQuery = this.track.query(this.position);
    } else {
      this.collisionPulse *= 0.9;
    }
    this._lastQuery = postQuery;
    this.onRoad = postQuery.onRoad;

    // --- ground follow (visual height/orientation) ---
    const targetY = postQuery.groundY + this.wheelRadius;
    const ySmooth = 1 - Math.exp(-14 * dt);
    this._smoothY += (targetY - this._smoothY) * ySmooth;

    const groundNormal = postQuery.up;
    const forwardFlat = newFwd.clone();
    const forwardOnGround = forwardFlat
      .clone()
      .sub(groundNormal.clone().multiplyScalar(forwardFlat.dot(groundNormal)))
      .normalize();

    this._dummy.up.copy(groundNormal);
    this._dummy.position.set(this.position.x, this._smoothY, this.position.z);
    // Object3D.lookAt() points local +Z at the target, so look behind us to
    // make local -Z (the car's front) face forwardOnGround.
    this._dummy.lookAt(this._dummy.position.clone().sub(forwardOnGround));
    const targetQuat = this._dummy.quaternion;

    const qSmooth = 1 - Math.exp(-16 * dt);
    this.renderQuaternion.slerp(targetQuat, qSmooth);
    this.renderPosition.set(this.position.x, this._smoothY, this.position.z);

    this._wheelSpinAngle += (forwardSpeed / this.wheelRadius) * dt;

    return {
      progress: postQuery.progress,
      onRoad: postQuery.onRoad,
      collisionPulse: this.collisionPulse,
    };
  }
}
