function formatTime(ms) {
  if (!isFinite(ms) || ms <= 0) return '00:00.000';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msPart).padStart(3, '0')}`;
}

export class HUDController {
  constructor(trackHandle) {
    this.el = {
      hud: document.getElementById('hud'),
      lapCurrent: document.getElementById('hud-lap-current'),
      lapTotal: document.getElementById('hud-lap-total'),
      timeCurrent: document.getElementById('hud-time-current'),
      timeBest: document.getElementById('hud-time-best'),
      speedValue: document.getElementById('speed-value'),
      speedoFill: document.getElementById('speedo-fill'),
      gear: document.getElementById('gear-indicator'),
      boostFill: document.getElementById('hud-boost-fill'),
      wrongWay: document.getElementById('hud-wrongway'),
      minimap: document.getElementById('minimap'),
    };
    this.el.lapTotal.textContent = trackHandle.laps;

    this.ctx = this.el.minimap.getContext('2d');
    this._computeMinimapBounds(trackHandle);

    const path = this.el.speedoFill;
    this._speedoLength = path.getTotalLength();
    path.style.strokeDasharray = `${this._speedoLength}`;
    path.style.strokeDashoffset = `${this._speedoLength}`;
  }

  _computeMinimapBounds(trackHandle) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const s of trackHandle.samples) {
      minX = Math.min(minX, s.position.x);
      maxX = Math.max(maxX, s.position.x);
      minZ = Math.min(minZ, s.position.z);
      maxZ = Math.max(maxZ, s.position.z);
    }
    const pad = 14;
    this._bounds = { minX: minX - pad, maxX: maxX + pad, minZ: minZ - pad, maxZ: maxZ + pad };
    this._track = trackHandle;
  }

  show() {
    this.el.hud.classList.remove('hidden');
  }
  hide() {
    this.el.hud.classList.add('hidden');
  }

  setWrongWay(active) {
    this.el.wrongWay.classList.toggle('hidden', !active);
  }

  update({ speedKmh, maxSpeedKmh, lapIndex, currentLapMs, bestLapMs, boost, carPosition, carHeading, drift }) {
    this.el.speedValue.textContent = Math.round(speedKmh);
    const frac = Math.max(0, Math.min(1, speedKmh / maxSpeedKmh));
    this.el.speedoFill.style.strokeDashoffset = `${this._speedoLength * (1 - frac)}`;
    this.el.speedoFill.classList.toggle('speedo-danger', frac > 0.85);

    this.el.gear.textContent = drift ? 'D~' : 'D';

    this.el.lapCurrent.textContent = Math.min(lapIndex + 1, Number(this.el.lapTotal.textContent));
    this.el.timeCurrent.textContent = formatTime(currentLapMs);
    this.el.timeBest.textContent = bestLapMs && isFinite(bestLapMs) ? formatTime(bestLapMs) : '--:--.---';

    this.el.boostFill.style.width = `${Math.round(boost * 100)}%`;
    this.el.boostFill.classList.toggle('boost-low', boost < 0.15);

    this._drawMinimap(carPosition, carHeading);
  }

  _drawMinimap(carPosition, carHeading) {
    const ctx = this.ctx;
    const { minX, maxX, minZ, maxZ } = this._bounds;
    const w = this.el.minimap.width;
    const h = this.el.minimap.height;
    const spanX = maxX - minX;
    const spanZ = maxZ - minZ;
    const scale = Math.min(w / spanX, h / spanZ) * 0.92;
    const offX = (w - spanX * scale) / 2;
    const offZ = (h - spanZ * scale) / 2;
    const toScreen = (x, z) => [offX + (x - minX) * scale, h - (offZ + (z - minZ) * scale)];

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(6,8,14,0.55)';
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, 12);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    this._track.samples.forEach((s, i) => {
      const [x, y] = toScreen(s.position.x, s.position.z);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();

    const [cx, cy] = toScreen(carPosition.x, carPosition.z);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(carHeading);
    ctx.fillStyle = '#ff2e63';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4, 5);
    ctx.lineTo(-4, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
