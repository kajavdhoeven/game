import * as THREE from 'three';

// Voegt statische meshes samen per materiaal, zodat de GPU veel minder draw calls krijgt.

function bake(mesh, matrix) {
  const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  g.applyMatrix4(matrix);
  return g;
}

function combine(geos) {
  let total = 0;
  geos.forEach((g) => { total += g.attributes.position.count; });
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  geos.forEach((g) => {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += n;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.computeBoundingSphere();
  out.computeBoundingBox();
  return out;
}

function flush(root, buckets) {
  buckets.forEach(({ material, cast, recv, geos }) => {
    const m = new THREE.Mesh(combine(geos), material);
    m.castShadow = cast;
    m.receiveShadow = recv;
    m.userData.merged = true;
    root.add(m);
  });
}

function bucketFor(buckets, mesh) {
  const key = mesh.material.uuid + (mesh.castShadow ? 'c' : '') + (mesh.receiveShadow ? 'r' : '');
  let b = buckets.get(key);
  if (!b) {
    b = { material: mesh.material, cast: mesh.castShadow, recv: mesh.receiveShadow, geos: [] };
    buckets.set(key, b);
  }
  return b;
}

// Alle (diepe) meshes onder root, behalve instanced meshes en alles in een groep met userData.keep.
export function mergeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const dead = [];
  const m4 = new THREE.Matrix4();
  const visit = (o, keep) => {
    for (const c of o.children) {
      const k = keep || c.userData.keep;
      if (c.isMesh && !c.isInstancedMesh && !k && !c.userData.merged) {
        if (c.visible) {
          m4.multiplyMatrices(inv, c.matrixWorld);
          bucketFor(buckets, c).geos.push(bake(c, m4));
        }
        dead.push(c);
      }
      visit(c, k);
    }
  };
  visit(root, false);
  dead.forEach((c) => c.parent.remove(c));
  flush(root, buckets);
}

// Alleen de directe kind-meshes van een groep (voor onderdelen die als geheel bewegen).
export function mergeOwn(group) {
  const buckets = new Map();
  const dead = [];
  for (const c of group.children) {
    if (!c.isMesh || c.isInstancedMesh || c.userData.merged) continue;
    c.updateMatrix();
    bucketFor(buckets, c).geos.push(bake(c, c.matrix));
    dead.push(c);
  }
  if (dead.length < 2) {
    // niets te winnen: laat staan
    buckets.forEach((b) => b.geos.forEach((g) => g.dispose()));
    return;
  }
  dead.forEach((c) => group.remove(c));
  flush(group, buckets);
}

export function disposeMerged(root) {
  root.traverse((o) => {
    if (o.userData.merged && o.geometry) o.geometry.dispose();
  });
}
