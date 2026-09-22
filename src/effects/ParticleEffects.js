import * as THREE from 'three';

function createSoftDiscTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,0.9)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export class ParticleSystem {
  constructor(scene, count = 70) {
    this.scene = scene;
    this.texture = createSoftDiscTexture();
    this.pool = [];
    for (let i = 0; i < count; i++) {
      const material = new THREE.SpriteMaterial({
        map: this.texture,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        color: 0xffffff,
      });
      const sprite = new THREE.Sprite(material);
      sprite.scale.setScalar(0.01);
      sprite.visible = false;
      scene.add(sprite);
      this.pool.push({
        sprite,
        life: 0,
        maxLife: 1,
        velocity: new THREE.Vector3(),
        baseOpacity: 0.5,
        baseSize: 0.5,
        active: false,
      });
    }
    this._cursor = 0;
  }

  spawn(position, { color = 0xcccccc, size = 0.55, life = 0.9, opacity = 0.5, velocity = null, jitter = 0.15 } = {}) {
    const slot = this._findFreeSlot();
    slot.active = true;
    slot.life = 0;
    slot.maxLife = life;
    slot.baseOpacity = opacity;
    slot.baseSize = size;
    slot.sprite.visible = true;
    slot.sprite.position.copy(position);
    slot.sprite.position.x += (Math.random() - 0.5) * jitter;
    slot.sprite.position.z += (Math.random() - 0.5) * jitter;
    slot.sprite.scale.setScalar(size);
    slot.sprite.material.color.setHex(color);
    slot.sprite.material.opacity = opacity;
    slot.velocity.copy(
      velocity || new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.6 + Math.random() * 0.4, (Math.random() - 0.5) * 0.4)
    );
  }

  _findFreeSlot() {
    for (let tries = 0; tries < this.pool.length; tries++) {
      this._cursor = (this._cursor + 1) % this.pool.length;
      if (!this.pool[this._cursor].active) return this.pool[this._cursor];
    }
    return this.pool[this._cursor];
  }

  update(dt) {
    for (const slot of this.pool) {
      if (!slot.active) continue;
      slot.life += dt;
      if (slot.life >= slot.maxLife) {
        slot.active = false;
        slot.sprite.visible = false;
        slot.sprite.material.opacity = 0;
        continue;
      }
      const t = slot.life / slot.maxLife;
      slot.sprite.position.addScaledVector(slot.velocity, dt);
      slot.velocity.multiplyScalar(1 - Math.min(1, dt * 1.5));
      slot.sprite.scale.setScalar(slot.baseSize * (1 + t * 1.6));
      slot.sprite.material.opacity = slot.baseOpacity * (1 - t);
    }
  }
}
