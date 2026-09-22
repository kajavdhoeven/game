/**
 * Fully procedural audio (oscillators + noise buffers) so the game ships
 * with zero external audio assets / licensing concerns.
 */
export class SoundManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.masterGain = null;
    this.engine = null;
    this.windGain = null;
    this._started = false;
  }

  setEnabled(on) {
    this.enabled = on;
    if (this.masterGain) {
      this.masterGain.gain.value = on ? 1 : 0;
    }
  }

  /** Must be called from a user gesture (click) to satisfy autoplay policies. */
  ensureStarted() {
    if (this._started) return;
    this._started = true;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.enabled ? 1 : 0;
    this.masterGain.connect(this.ctx.destination);
    this._buildEngine();
  }

  _noiseBuffer(seconds = 2) {
    const ctx = this.ctx;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  _buildEngine() {
    const ctx = this.ctx;

    // Engine: layered detuned saw oscillators through a lowpass, pitch follows RPM.
    const engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 900;
    engineFilter.Q.value = 0.7;

    const oscA = ctx.createOscillator();
    oscA.type = 'sawtooth';
    oscA.frequency.value = 60;
    const oscB = ctx.createOscillator();
    oscB.type = 'sawtooth';
    oscB.frequency.value = 60.5;
    const oscC = ctx.createOscillator();
    oscC.type = 'square';
    oscC.frequency.value = 30;

    const mix = ctx.createGain();
    mix.gain.value = 0.5;
    oscA.connect(mix);
    oscB.connect(mix);
    oscC.connect(mix);
    mix.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(this.masterGain);

    oscA.start();
    oscB.start();
    oscC.start();

    // Wind / road noise, volume follows speed.
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = this._noiseBuffer(2);
    noiseSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'highpass';
    windFilter.frequency.value = 700;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    noiseSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(this.masterGain);
    noiseSrc.start();

    this.engine = { oscA, oscB, oscC, engineGain, engineFilter };
    this.windGain = windGain;
  }

  /** speed01: 0..1 normalized speed, throttle01: 0..1 how hard the gas is pressed */
  updateEngine(speed01, throttle01) {
    if (!this.ctx || !this.engine) return;
    const now = this.ctx.currentTime;
    const rpm = 0.18 + speed01 * 0.85 + throttle01 * 0.12;
    const baseFreq = 55 + rpm * 160;
    this.engine.oscA.frequency.setTargetAtTime(baseFreq, now, 0.05);
    this.engine.oscB.frequency.setTargetAtTime(baseFreq * 1.008, now, 0.05);
    this.engine.oscC.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);
    this.engine.engineFilter.frequency.setTargetAtTime(500 + rpm * 2600, now, 0.08);
    const vol = 0.05 + Math.min(1, throttle01 * 0.5 + speed01 * 0.5) * 0.16;
    this.engine.engineGain.gain.setTargetAtTime(vol, now, 0.06);
    this.windGain.gain.setTargetAtTime(speed01 * speed01 * 0.09, now, 0.08);
  }

  _beep(freq, duration, delay = 0, type = 'sine', volume = 0.25) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  }

  playCountdownTick() {
    this._beep(440, 0.18, 0, 'square', 0.2);
  }

  playCountdownGo() {
    this._beep(880, 0.35, 0, 'square', 0.28);
  }

  playUiClick() {
    this._beep(600, 0.08, 0, 'triangle', 0.15);
  }

  playCheckpoint() {
    this._beep(1200, 0.12, 0, 'sine', 0.18);
  }

  playLapComplete() {
    this._beep(660, 0.15, 0, 'sine', 0.22);
    this._beep(990, 0.2, 0.12, 'sine', 0.22);
  }

  playFinish() {
    [523, 659, 784, 1046].forEach((f, i) => this._beep(f, 0.3, i * 0.12, 'sine', 0.22));
  }

  playCollision(intensity = 1) {
    this._beep(120, 0.15, 0, 'sawtooth', Math.min(0.3, 0.1 + intensity * 0.2));
  }
}

export const soundManager = new SoundManager();
