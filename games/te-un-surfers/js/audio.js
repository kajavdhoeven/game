// Alle geluid wordt live gesynthetiseerd met WebAudio, dus geen losse bestanden.
let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let muted = false;
let rumble = null;
let noiseBuf = null;
let musicOn = false;
let musicTimer = null;
let nextNote = 0;
let step = 0;

try {
  muted = localStorage.getItem('teun-muted') === '1';
} catch (e) { /* geen opslag beschikbaar */ }

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.7;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.32;
  musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}

function out(pan) {
  if (pan && ctx.createStereoPanner) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(sfxBus);
    return p;
  }
  return sfxBus;
}

function tone(freq, t0, dur, type = 'sine', vol = 0.3, dest = null, slideTo = null) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g);
  g.connect(dest || sfxBus);
  o.start(t0);
  o.stop(t0 + dur + 0.05);
}

function noise(t0, dur, vol, lp, hp = 0, dest = null) {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = lp;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f);
  let last = f;
  if (hp) {
    const h = ctx.createBiquadFilter();
    h.type = 'highpass';
    h.frequency.value = hp;
    f.connect(h);
    last = h;
  }
  last.connect(g);
  g.connect(dest || sfxBus);
  s.start(t0, Math.random());
  s.stop(t0 + dur + 0.05);
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// C - Am - F - G, vrolijk en niet te opdringerig
const BASS = [48, 45, 41, 43];
const ARP = [
  [60, 64, 67, 72, 67, 64, 67, 64],
  [57, 60, 64, 69, 64, 60, 64, 60],
  [53, 57, 60, 65, 60, 57, 60, 57],
  [55, 59, 62, 67, 62, 59, 62, 59],
];

function scheduleMusic() {
  if (!musicOn || !ctx) return;
  const spb = 60 / 126 / 2; // achtste noten
  while (nextNote < ctx.currentTime + 0.4) {
    const bar = Math.floor(step / 8) % 4;
    const i = step % 8;
    if (i === 0 || i === 4) tone(NOTE(BASS[bar]), nextNote, spb * 3.2, 'triangle', 0.5, musicBus);
    tone(NOTE(ARP[bar][i]), nextNote, spb * 0.9, 'square', 0.07, musicBus);
    if (i % 2 === 0) noise(nextNote, 0.04, 0.05, 6000, 5000, musicBus);
    nextNote += spb;
    step++;
  }
  musicTimer = setTimeout(scheduleMusic, 120);
}

export const audio = {
  unlock() {
    if (!ensure()) return;
    if (ctx.state === 'suspended') ctx.resume();
  },
  get muted() { return muted; },
  setMuted(m) {
    muted = m;
    try { localStorage.setItem('teun-muted', m ? '1' : '0'); } catch (e) { /* negeren */ }
    if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  },
  startMusic() {
    if (!ensure() || musicOn) return;
    musicOn = true;
    step = 0;
    nextNote = ctx.currentTime + 0.1;
    scheduleMusic();
  },
  stopMusic() {
    musicOn = false;
    clearTimeout(musicTimer);
  },
  startRumble() {
    if (!ensure() || rumble) return;
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 220;
    const g = ctx.createGain();
    g.gain.value = 0;
    s.connect(lp);
    lp.connect(g);
    g.connect(sfxBus);
    s.start();
    rumble = { s, g, lp };
  },
  setRumble(speed01) {
    if (!rumble) return;
    rumble.g.gain.setTargetAtTime(0.05 + speed01 * 0.22, ctx.currentTime, 0.1);
    rumble.lp.frequency.setTargetAtTime(160 + speed01 * 260, ctx.currentTime, 0.1);
  },
  stopRumble() {
    if (!rumble) return;
    rumble.g.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    const r = rumble;
    rumble = null;
    setTimeout(() => { try { r.s.stop(); } catch (e) { /* al gestopt */ } }, 600);
  },
  click() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.03, 0.12, 2400, 600);
  },
  coin() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(988, t, 0.09, 'square', 0.12);
    tone(1319, t + 0.07, 0.22, 'square', 0.12);
  },
  jump() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(300, t, 0.2, 'sine', 0.25, null, 720);
  },
  roll() {
    if (!ctx) return;
    noise(ctx.currentTime, 0.35, 0.3, 1800, 300);
  },
  swish(pan) {
    if (!ctx) return;
    noise(ctx.currentTime, 0.15, 0.14, 3200, 800, out(pan));
  },
  stumble() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(140, t, 0.18, 'sawtooth', 0.25, null, 70);
    noise(t, 0.12, 0.3, 900);
  },
  crash() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.9, 0.9, 1400);
    tone(90, t, 0.6, 'sawtooth', 0.5, null, 28);
    tone(60, t + 0.05, 0.9, 'sine', 0.6, null, 24);
  },
  spotter() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(220, t, 0.25, 'sine', 0.35, null, 520); // boing
    [784, 988, 1175, 1568, 1976].forEach((f, i) => tone(f, t + 0.18 + i * 0.065, 0.2, 'square', 0.1));
    noise(t, 0.08, 0.3, 1200);
  },
  horn(pan) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const d = out(pan);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.connect(d);
    // tweetonige NS-toeter
    [[392, 0], [494, 0], [392, 0.42], [494, 0.42]].forEach(([f, o]) => {
      tone(f, t + o, 0.36, 'sawtooth', 0.11, lp);
    });
  },
  ding() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(1568, t, 0.5, 'sine', 0.2);
    tone(1046, t + 0.14, 0.7, 'sine', 0.18);
  },
};

// ---- extra geluiden: power-ups, voertuigen, waterpistool, tekenfilm-botsing, boze menigte
Object.assign(audio, {
  pickup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * 0.06, 0.18, 'triangle', 0.18));
  },
  powerup() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [392, 523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * 0.055, 0.22, 'square', 0.1));
    tone(200, t, 0.4, 'sine', 0.25, null, 900);
  },
  vehicle(id) {
    if (!ctx) return;
    const t = ctx.currentTime;
    if (id === 'cow') {
      // muu: lage zaagtand met vibrato door een formantfilter
      const o = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(500, t);
      f.frequency.linearRampToValueAtTime(900, t + 0.5);
      f.frequency.linearRampToValueAtTime(400, t + 1.2);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(120, t);
      o.frequency.linearRampToValueAtTime(150, t + 0.5);
      o.frequency.linearRampToValueAtTime(95, t + 1.2);
      lfo.frequency.value = 6;
      lg.gain.value = 5;
      lfo.connect(lg);
      lg.connect(o.frequency);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.15);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
      o.connect(f);
      f.connect(g);
      g.connect(sfxBus);
      o.start(t); lfo.start(t);
      o.stop(t + 1.4); lfo.stop(t + 1.4);
    } else if (id === 'train') {
      audio.horn(0);
      noise(t, 0.8, 0.4, 900);
    } else {
      tone(180, t, 0.9, 'sawtooth', 0.22, null, 1100);
      noise(t, 0.9, 0.35, 2600, 500);
    }
  },
  squirt() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.28, 0.35, 8000, 2500);
    tone(900, t, 0.12, 'sine', 0.08, null, 1600);
  },
  splash() {
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 0.35, 0.3, 4000, 600);
    tone(400, t, 0.2, 'sine', 0.12, null, 150);
  },
  splat() {
    // tekenfilm-bonk, dan een lang zakkend fluitje terwijl hij naar beneden glijdt
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(130, t, 0.35, 'sine', 0.6, null, 40);
    noise(t, 0.25, 0.7, 1500);
    tone(1500, t + 0.9, 1.6, 'sine', 0.14, null, 220);
    tone(80, t + 2.4, 0.4, 'sine', 0.5, null, 30);
    noise(t + 2.4, 0.2, 0.4, 700);
  },
  boing() {
    if (!ctx) return;
    const t = ctx.currentTime;
    tone(180, t, 0.35, 'sine', 0.3, null, 520);
  },
  mob() {
    // boze menigte: laag gemompel en een dreigende zaagtand
    if (!ctx) return;
    const t = ctx.currentTime;
    noise(t, 2.2, 0.25, 520);
    tone(70, t, 2.2, 'sawtooth', 0.08, null, 55);
    tone(98, t + 0.3, 1.6, 'sawtooth', 0.05, null, 82);
  },
});
