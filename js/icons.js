import * as THREE from 'three';

// Rendert een 3D-model één keer naar een plaatje, voor winkel en HUD.
const cache = new Map();
let rt = null;
let scene = null;
let cam = null;

function setup() {
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#8a8f99', 1.7));
  const d = new THREE.DirectionalLight('#ffffff', 2.6);
  d.position.set(-3, 5, 4);
  scene.add(d);
  cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
}

export function renderIcon(renderer, key, build, { size = 192, yaw = -0.6, pitch = 0.25 } = {}) {
  if (cache.has(key)) return cache.get(key);
  if (!scene) setup();
  if (!rt || rt.width !== size) {
    rt = new THREE.WebGLRenderTarget(size, size, { samples: 4, colorSpace: THREE.SRGBColorSpace });
  }
  const obj = build();
  const holder = new THREE.Group();
  holder.add(obj);
  holder.rotation.y = yaw;
  scene.add(holder);
  scene.environment = renderer.__iconEnv || null;
  const box = new THREE.Box3().setFromObject(holder);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  holder.position.sub(sphere.center);
  const dist = sphere.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2)) * 0.82;
  cam.position.set(0, Math.sin(pitch) * dist, Math.cos(pitch) * dist);
  cam.lookAt(0, 0, 0);

  const prevTarget = renderer.getRenderTarget();
  const prevAlpha = renderer.getClearAlpha();
  const prevColor = renderer.getClearColor(new THREE.Color());
  const prevShadow = renderer.shadowMap.enabled;
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rt);
  renderer.clear();
  renderer.render(scene, cam);
  const px = new Uint8Array(size * size * 4);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, px);
  renderer.setRenderTarget(prevTarget);
  renderer.setClearColor(prevColor, prevAlpha);
  renderer.shadowMap.enabled = prevShadow;
  scene.remove(holder);

  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    img.data.set(px.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  }
  ctx.putImageData(img, 0, 0);
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}
