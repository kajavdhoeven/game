import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

let cachedTexture = null;

/** Shared PMREM environment map used for realistic PBR reflections on car paint / metal. */
export function getSharedEnvironmentMap(renderer) {
  if (cachedTexture) return cachedTexture;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();
  cachedTexture = rt.texture;
  return cachedTexture;
}
