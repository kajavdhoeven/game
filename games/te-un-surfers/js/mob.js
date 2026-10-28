import * as THREE from 'three';
import { createGnome, createTorch, createPitchfork } from './gnome.js';
import { softCircleTexture } from './textures.js';

const TUNICS = ['#7a2f2f', '#2f4a7a', '#6b5a2a', '#4a2f6b', '#2f6b5a', '#7a4a2f'];
const HATS = ['#d3202a', '#2f6bd3', '#d37a20', '#2fa05a', '#a02fd3', '#d3c320'];

// De boze kabouters met fakkels en hooivorken
export function createMob(scene, lights) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  const flameTex = softCircleTexture('rgba(255,220,120,1)', 'rgba(255,90,10,0)');
  const members = [];
  const N = 7;
  for (let i = 0; i < N; i++) {
    const gn = createGnome({ skin: 'mob', classic: true, tunic: TUNICS[i % TUNICS.length], hat: HATS[(i * 5 + 1) % HATS.length] });
    gn.root.scale.setScalar(0.95 + (i % 3) * 0.07);
    const torch = i % 2 === 0;
    const w = torch ? createTorch() : createPitchfork();
    w.rotation.z = Math.PI;
    w.rotation.x = 0.0;
    gn.holdWeapon(w);
    let flame = null;
    if (torch) {
      flame = new THREE.Sprite(new THREE.SpriteMaterial({
        map: flameTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false,
      }));
      flame.scale.set(0.9, 1.2, 1);
      flame.position.set(0, 0.62, 0);
      w.add(flame);
    }
    gn.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    group.add(gn.root);
    members.push({ gn, torch, flame, x: 0, z: 5, runSpeed: 14 + (i % 4), phase: Math.random() * 6, hop: 0, role: i === 0 ? 'leader' : 'mob' });
  }
  const torchMembers = members.filter((m) => m.torch);

  const spots = [
    [-2.6, 4.2], [-1.3, 4.9], [0.2, 3.7], [1.5, 4.8], [2.8, 4.1], [0.0, 6.0], [-2.0, 6.2],
  ];

  return {
    group,
    members,
    // variant 0 = dorpsplein, 1 = achtervolging dichtbij
    setup(variant) {
      group.visible = true;
      members.forEach((m, i) => {
        const [x, z] = spots[i % spots.length];
        m.x = x + (variant === 2 ? (Math.random() - 0.5) * 1.5 : 0);
        m.z = variant === 2 ? 3.2 + Math.random() * 3.5 : z;
        m.runSpeed = 14 + Math.random() * 3;
        m.pushed = false;
      });
      // leider staat het dichtst bij Te-Un
      members[2].role = 'leader';
    },
    allGone() {
      return members.every((m) => m.z > 15);
    },
    hide() {
      group.visible = false;
      lights.forEach((l) => { l.intensity = 0; });
    },
    // phase: 'stand' | 'chase'
    update(dt, t, phase, worldSpeed, extra = {}) {
      if (!group.visible) return;
      members.forEach((m, i) => {
        const gn = m.gn;
        if (phase === 'stand') {
          m.z += 0; // blijven staan, schudden met hun wapens
          const lead = m.role === 'leader';
          let z = m.z;
          if (lead && extra.pushT != null) {
            // stap naar voren en duw
            const k = Math.min(1, Math.max(0, extra.pushT));
            z = m.z - 2.2 * k;
          }
          gn.root.position.set(m.x, 0, z);
          gn.root.rotation.y = Math.sin(t * 1.3 + i) * 0.15;
          gn.update('scared', dt, t + i, 0, 0, { emotion: 'angry' });
          gn.root.position.y = Math.abs(Math.sin(t * 7 + m.phase)) * 0.06;
        } else if (extra.follow) {
          // achtervolging na een botsing: dicht achter Te-Un, bij 'catch' vlak achter zijn hielen, bij 'leave' vallen ze weg
          const base = [2.4, 3.1, 2.0, 3.6, 2.7, 4.2, 3.4][i % 7];
          const tz = extra.follow === 'catch' ? 0.9 + (i % 4) * 0.35 : extra.follow === 'leave' ? 26 : base + Math.sin(t * 2 + i) * 0.25;
          m.z += (tz - m.z) * Math.min(1, dt * (extra.follow === 'leave' ? 0.9 : 4.5));
          gn.root.position.set(m.x * 0.7 + Math.sin(t * 2.2 + i) * 0.15, 0, m.z);
          gn.root.rotation.y = 0;
          gn.update(extra.follow === 'catch' ? 'scared' : 'run', dt, t + i, 0.6, 0, { angry: true, armUp: true, emotion: 'angry' });
          gn.root.visible = m.z < 16;
        } else {
          // achtervolging: ze rennen mee, Te-Un wordt sneller
          const diff = worldSpeed - m.runSpeed;
          m.z = Math.max(1.6 + (i % 3) * 0.7, m.z + diff * dt);
          // wie te ver achterblijft, valt buiten beeld
          gn.root.position.set(m.x + Math.sin(t * 2 + i) * 0.2, 0, m.z);
          gn.root.rotation.y = 0;
          gn.update('run', dt, t + i, 0.5, 0, { angry: true, armUp: true });
          if (m.z > 16) gn.root.visible = false;
          else gn.root.visible = true;
        }
      });
      // fakkels: vlammen flikkeren, twee echte lichten volgen de dichtstbijzijnde
      torchMembers.forEach((m) => {
        if (!m.flame) return;
        const f = 0.85 + Math.sin(t * 17 + m.phase) * 0.12 + Math.random() * 0.12;
        m.flame.scale.set(0.9 * f, 1.25 * f, 1);
      });
      const near = torchMembers.filter((m) => m.gn.root.visible).sort((a, b) => a.gn.root.position.z - b.gn.root.position.z).slice(0, lights.length);
      lights.forEach((l, i) => {
        const m = near[i];
        if (!m) { l.intensity = 0; return; }
        const p = m.gn.root.position;
        l.position.set(p.x + 0.3, 1.9, p.z - 0.2);
        l.intensity = (extra.torchK ?? 1) * (38 + Math.random() * 10);
      });
    },
  };
}
