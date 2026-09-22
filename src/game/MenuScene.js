import * as THREE from 'three';
import { createCarModel } from '../car/CarModel.js';
import { ParticleSystem } from '../effects/ParticleEffects.js';

export class MenuScene {
  constructor(renderer, envMap) {
    this.scene = new THREE.Scene();
    this.scene.environment = envMap;
    this.scene.background = envMap;

    this.camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 200);
    this._angle = 0.6;
    this._radius = 6.4;
    this._height = 1.9;

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9, 48),
      new THREE.MeshStandardMaterial({ color: 0x0c0d12, roughness: 0.28, metalness: 0.65 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const keyLight = new THREE.SpotLight(0xfff2df, 60, 30, Math.PI / 5, 0.5, 1.2);
    keyLight.position.set(4, 7, 4);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(keyLight, keyLight.target);

    const rimLight = new THREE.SpotLight(0x6fb8ff, 40, 30, Math.PI / 4, 0.6, 1.2);
    rimLight.position.set(-5, 4, -5);
    this.scene.add(rimLight, rimLight.target);

    const fillLight = new THREE.PointLight(0xff2e63, 8, 14, 2);
    fillLight.position.set(0, 1.2, -3);
    this.scene.add(fillLight);

    this.car = createCarModel('#ff2e63');
    this.car.group.rotation.y = Math.PI * 0.15;
    this.scene.add(this.car.group);

    this.particles = new ParticleSystem(this.scene, 40);
    this._spawnTimer = 0;
  }

  setCarColor(hex) {
    this.car.paintMaterial.color.set(hex);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this._angle += dt * 0.18;
    this.camera.position.set(Math.cos(this._angle) * this._radius, this._height, Math.sin(this._angle) * this._radius);
    this.camera.lookAt(0, 0.85, 0);

    this.car.group.rotation.y += dt * 0.25;
    this.car.wheels.frontLeft.spinPivot.rotation.x += dt * 2;
    this.car.wheels.frontRight.spinPivot.rotation.x += dt * 2;
    this.car.wheels.rearLeft.spinPivot.rotation.x += dt * 2;
    this.car.wheels.rearRight.spinPivot.rotation.x += dt * 2;

    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = 0.35;
      this.particles.spawn(new THREE.Vector3((Math.random() - 0.5) * 4, 0.05, (Math.random() - 0.5) * 4), {
        color: 0x8fa3ff,
        size: 0.12,
        life: 3.2,
        opacity: 0.35,
        velocity: new THREE.Vector3(0, 0.25 + Math.random() * 0.2, 0),
        jitter: 0,
      });
    }
    this.particles.update(dt);
  }
}
