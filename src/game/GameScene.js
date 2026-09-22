import * as THREE from 'three';
import { buildTrack } from '../track/TrackBuilder.js';
import { buildEnvironment } from '../env/Environment.js';
import { createCarModel } from '../car/CarModel.js';
import { CarController } from '../car/CarController.js';
import { CameraRig } from '../core/CameraRig.js';
import { RaceManager } from '../core/RaceManager.js';
import { HUDController } from '../ui/HUDController.js';
import { ParticleSystem } from '../effects/ParticleEffects.js';

const MAX_DISPLAY_SPEED = 240;

function disposeObject(root) {
  root.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        Object.values(m).forEach((v) => {
          if (v && v.isTexture) v.dispose();
        });
        m.dispose();
      });
    }
  });
}

export class GameScene {
  constructor({ renderer, envMap, trackDef, carColor, soundManager, onFinished, onInvalidLap }) {
    this.renderer = renderer;
    this.soundManager = soundManager;
    this.onFinished = onFinished;
    this.onInvalidLap = onInvalidLap;

    this.scene = new THREE.Scene();
    this.scene.environment = envMap;

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);

    this.track = buildTrack(trackDef);
    this.scene.add(this.track.group);

    this.environment = buildEnvironment({ theme: trackDef.theme, trackHandle: this.track, renderer });
    this.scene.add(this.environment.group);
    this.scene.background = this.environment.backgroundColor;
    this.scene.fog = this.environment.fog;

    this.car = createCarModel(carColor);
    this.car.setLightsOn(trackDef.theme === 'night');
    this.scene.add(this.car.group);

    this.carController = new CarController(this.track, this.car.wheelRadius);
    this.car.group.position.copy(this.carController.renderPosition);
    this.car.group.quaternion.copy(this.carController.renderQuaternion);

    this.cameraRig = new CameraRig(this.camera);
    this.cameraRig.snapTo(this.carController.renderPosition, this.carController.renderQuaternion);

    this.hud = new HUDController(this.track);
    this.particles = new ParticleSystem(this.scene, 90);

    this._countdownEl = document.getElementById('countdown');
    this._countdownNumberEl = document.getElementById('countdown-number');

    this.raceManager = new RaceManager(this.track, {
      onCountdownTick: (v) => {
        this._countdownEl.classList.remove('hidden');
        this._countdownNumberEl.textContent = String(v);
        this._countdownNumberEl.className = 'countdown-number pulse';
        this.soundManager.playCountdownTick();
      },
      onGo: () => {
        this._countdownNumberEl.textContent = 'GA!';
        this._countdownNumberEl.className = 'countdown-number pulse go';
        this.soundManager.playCountdownGo();
      },
      onCheckpoint: () => this.soundManager.playCheckpoint(),
      onLapCompleted: () => this.soundManager.playLapComplete(),
      onInvalidLap: () => this.onInvalidLap?.(),
      onWrongWayChange: (active) => this.hud.setWrongWay(active),
      onFinished: (summary) => {
        this.soundManager.playFinish();
        this.onFinished?.(summary);
      },
    });

    this._prevCollisionPulse = 0;
    this.paused = false;
    if (import.meta.env.DEV) window.__DEBUG_SCENE = this;
  }

  startRace() {
    this.raceManager.startCountdown();
    this.hud.show();
  }

  resetToStart() {
    this.carController.reset(this.track.startPosition, this.track.startQuaternion);
    this.cameraRig.snapTo(this.carController.renderPosition, this.carController.renderQuaternion);
    this.raceManager.startCountdown();
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(dt, rawInput) {
    const racing = this.raceManager.state === 'racing' || this.raceManager.state === 'finished';
    const effectiveInput = racing
      ? rawInput
      : { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };

    const result = this.carController.update(dt, effectiveInput);
    this.raceManager.update(dt, result.progress, this.carController.speedMs);

    this.car.group.position.copy(this.carController.renderPosition);
    this.car.group.quaternion.copy(this.carController.renderQuaternion);

    const spin = this.carController.wheelSpinAngle;
    const steer = this.carController.steerAngle || 0;
    const { frontLeft, frontRight, rearLeft, rearRight } = this.car.wheels;
    frontLeft.steerPivot.rotation.y = steer;
    frontRight.steerPivot.rotation.y = steer;
    frontLeft.spinPivot.rotation.x = spin;
    frontRight.spinPivot.rotation.x = spin;
    rearLeft.spinPivot.rotation.x = spin;
    rearRight.spinPivot.rotation.x = spin;

    this.car.setBraking(effectiveInput.brake > 0);

    this.cameraRig.update(dt, this.carController.renderPosition, this.carController.renderQuaternion, this.carController.speedKmh, this.carController.collisionPulse);
    this.environment.followTarget(this.carController.renderPosition);

    this._updateParticles(dt, effectiveInput);

    if (this.carController.collisionPulse > 0.15 && this._prevCollisionPulse < 0.05) {
      this.soundManager.playCollision(this.carController.collisionPulse);
    }
    this._prevCollisionPulse = this.carController.collisionPulse;

    const speedFrac = Math.min(1, this.carController.speedKmh / 200);
    this.soundManager.updateEngine(speedFrac, effectiveInput.throttle);

    if (this.raceManager.state === 'countdown') {
      // handled via callbacks
    } else {
      this._countdownEl.classList.add('hidden');
    }

    this.hud.update({
      speedKmh: this.carController.speedKmh,
      maxSpeedKmh: MAX_DISPLAY_SPEED,
      lapIndex: this.raceManager.lapIndex,
      currentLapMs: this.raceManager.currentLapTime * 1000,
      bestLapMs: this.raceManager.bestLapMs,
      boost: this.carController.boost,
      carPosition: this.carController.renderPosition,
      carHeading: this.carController.heading,
      drift: this.carController.driftFactor > 0.3,
    });
  }

  _updateParticles(dt, input) {
    const rearOffset = new THREE.Vector3(0, 0.25, 1.5).applyQuaternion(this.car.group.quaternion).add(this.car.group.position);
    const isDrifting = this.carController.driftFactor > 0.28 && this.carController.speedKmh > 12;
    const isOffroad = !this.carController.onRoad && this.carController.speedKmh > 8;

    if ((isDrifting || isOffroad) && Math.random() < dt * 26) {
      const wheelSide = Math.random() > 0.5 ? -0.75 : 0.75;
      const spawnPos = new THREE.Vector3(wheelSide, 0.1, 1.3).applyQuaternion(this.car.group.quaternion).add(this.car.group.position);
      this.particles.spawn(spawnPos, {
        color: isOffroad ? 0x8a6b45 : 0xdadada,
        size: 0.4,
        life: 0.8,
        opacity: 0.4,
      });
    }

    const boosting = input.boost && this.carController.boost > 0.02 && this.carController.forwardSpeedSigned > 0.5;
    if (boosting && Math.random() < dt * 40) {
      this.particles.spawn(rearOffset, {
        color: 0x4fd8ff,
        size: 0.35,
        life: 0.35,
        opacity: 0.7,
        velocity: new THREE.Vector3(0, 0.1, 0).applyQuaternion(this.car.group.quaternion).add(
          new THREE.Vector3(0, 0, 3).applyQuaternion(this.car.group.quaternion)
        ),
        jitter: 0.2,
      });
    }
    this.particles.update(dt);
  }

  dispose() {
    disposeObject(this.track.group);
    disposeObject(this.environment.group);
    disposeObject(this.car.group);
    this.hud.hide();
  }
}
