import * as THREE from 'three';

function makeCanvas(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  return canvas;
}

function finish(canvas, repeatX = 1, repeatY = 1, anisotropy = 8) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Dark asphalt with subtle grain + faint tire-mark streaks. */
export function createAsphaltTexture({ repeatX = 1, repeatY = 30 } = {}) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2b2c31';
  ctx.fillRect(0, 0, size, size);

  const imgData = ctx.getImageData(0, 0, size, size);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] += n;
    d[i + 1] += n;
    d[i + 2] += n;
  }
  ctx.putImageData(imgData, 0, 0);

  // faint tire streaks
  ctx.globalAlpha = 0.10;
  ctx.strokeStyle = '#000000';
  for (let i = 0; i < 6; i++) {
    const x = size * (0.25 + Math.random() * 0.5);
    ctx.lineWidth = 6 + Math.random() * 10;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + (Math.random() - 0.5) * 20, size);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // subtle centerline dash suggestion handled separately via geometry, not here
  return finish(canvas, repeatX, repeatY);
}

/** Red/white curb stripes. */
export function createCurbTexture({ repeatX = 1, repeatY = 16 } = {}) {
  const size = 128;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const stripes = 6;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#d61f2c' : '#f2f2f2';
    ctx.fillRect(0, (i * size) / stripes, size, size / stripes);
  }
  return finish(canvas, repeatX, repeatY);
}

/** Mottled grass/ground with patchy variation. */
export function createGrassTexture({ repeatX = 60, repeatY = 60, base = '#2f5d34', variant = '#3c7042' } = {}) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 900; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? variant : base;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = 1.5 + Math.random() * 3.5;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return finish(canvas, repeatX, repeatY);
}

/** City asphalt for the night track: slightly bluer, with painted lane marks baked as an option. */
export function createCityGroundTexture({ repeatX = 40, repeatY = 40 } = {}) {
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1b1d24';
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < size; i += 32) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(size, i);
    ctx.stroke();
  }
  return finish(canvas, repeatX, repeatY);
}
