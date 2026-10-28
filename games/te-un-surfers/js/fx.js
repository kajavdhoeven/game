import * as THREE from 'three';
import { softCircleTexture } from './textures.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

// Vonken, waterdruppels en stof (additieve punten)
export class Sparks {
  constructor(scene, max = 700) {
    this.max = max;
    this.pos = new Float32Array(max * 3).fill(-999);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    this.grav = new Float32Array(max).fill(9);
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.34, map: softCircleTexture(), vertexColors: true, transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending, fog: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(x, y, z, n, color, speed = 4, up = 3, life = 1, grav = 9) {
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const k = this.cursor++ % this.max;
      this.pos.set([x, y, z], k * 3);
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.3 + Math.random() * 0.7);
      this.vel.set([Math.cos(a) * sp, up * (0.3 + Math.random()), Math.sin(a) * sp], k * 3);
      this.base.set([c.r, c.g, c.b], k * 3);
      this.life[k] = (0.5 + Math.random() * 0.5) * life;
      this.grav[k] = grav;
    }
  }

  // gericht: voor waterstralen
  emitDir(x, y, z, dx, dy, dz, n, color, speed, spread = 0.08, life = 0.7, grav = 5) {
    const c = new THREE.Color(color);
    const len = Math.hypot(dx, dy, dz) || 1;
    for (let i = 0; i < n; i++) {
      const k = this.cursor++ % this.max;
      const t = Math.random() * 0.12;
      const sp = speed * (0.85 + Math.random() * 0.3);
      this.pos.set([x + (dx / len) * sp * t, y + (dy / len) * sp * t, z + (dz / len) * sp * t], k * 3);
      this.vel.set([
        (dx / len) * sp + (Math.random() - 0.5) * spread * sp,
        (dy / len) * sp + (Math.random() - 0.5) * spread * sp,
        (dz / len) * sp + (Math.random() - 0.5) * spread * sp,
      ], k * 3);
      this.base.set([c.r, c.g, c.b], k * 3);
      this.life[k] = life * (0.7 + Math.random() * 0.5);
      this.grav[k] = grav;
    }
  }

  update(dt, dz) {
    for (let k = 0; k < this.max; k++) {
      if (this.life[k] <= 0) {
        this.pos[k * 3 + 1] = -999;
        continue;
      }
      this.life[k] -= dt;
      const i = k * 3;
      this.vel[i + 1] -= this.grav[k] * dt;
      this.pos[i] += this.vel[i] * dt;
      this.pos[i + 1] += this.vel[i + 1] * dt;
      this.pos[i + 2] += this.vel[i + 2] * dt + dz;
      const f = clamp(this.life[k] * 2, 0, 1);
      this.col[i] = this.base[i] * f;
      this.col[i + 1] = this.base[i + 1] * f;
      this.col[i + 2] = this.base[i + 2] * f;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
