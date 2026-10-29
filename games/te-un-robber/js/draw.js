// Tekenen: een gebouw in doorsnede met kamers, deuren, ladders en trappen, de bewakers met hun lichtkegels en Te-Un als dief. Alles met canvas.
import { TS, W, H, Y, guardAt, laserOn } from './sim.js';
export const CW = W * TS, CH = H * TS;
const hash = (x, y) => { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967296; };
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const OUT = '#0d0f14';

// ---------------------------------------------------------------- spullen in de kamers (staan op de vloer: (x, y) is het midden van de voet)
const PROPS = {
  plant(g, x, y) { g.fillStyle = '#7a4a2a'; rr(g, x - 9, y - 16, 18, 16, 3); g.fill(); g.fillStyle = '#3f9a45'; for (const [dx, dy, r] of [[0, -34, 13], [-9, -26, 10], [9, -26, 10], [0, -24, 10]]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); } },
  sofa(g, x, y) { g.fillStyle = '#9a5a4a'; rr(g, x - 30, y - 30, 60, 30, 6); g.fill(); g.fillStyle = '#b4705c'; rr(g, x - 26, y - 22, 52, 14, 4); g.fill(); g.fillStyle = '#7a4438'; rr(g, x - 34, y - 24, 10, 24, 4); g.fill(); rr(g, x + 24, y - 24, 10, 24, 4); g.fill(); },
  tv(g, x, y) { g.fillStyle = '#6a4a30'; g.fillRect(x - 24, y - 16, 48, 16); g.fillStyle = '#15181f'; g.fillRect(x - 20, y - 46, 40, 30); g.fillStyle = '#3a7ad0'; g.fillRect(x - 17, y - 43, 34, 24); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 17, y - 43, 34, 6); },
  cabinet(g, x, y) { g.fillStyle = '#8a5a30'; g.fillRect(x - 18, y - 46, 36, 46); g.strokeStyle = '#5a3a1c'; g.lineWidth = 2; g.strokeRect(x - 18, y - 46, 36, 46); g.beginPath(); g.moveTo(x, y - 46); g.lineTo(x, y); g.stroke(); g.fillStyle = '#e8c86a'; g.fillRect(x - 5, y - 24, 3, 6); g.fillRect(x + 2, y - 24, 3, 6); },
  lamp(g, x, y) { g.fillStyle = '#5a4a3a'; g.fillRect(x - 2, y - 36, 4, 36); g.fillStyle = '#e8d27a'; g.beginPath(); g.moveTo(x - 12, y - 34); g.lineTo(x + 12, y - 34); g.lineTo(x + 7, y - 52); g.lineTo(x - 7, y - 52); g.closePath(); g.fill(); g.fillStyle = '#5a4a3a'; g.fillRect(x - 8, y - 3, 16, 3); },
  window(g, x, y) { g.fillStyle = '#7ab6e8'; g.fillRect(x - 22, y - 92, 44, 52); g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x - 22, y - 92, 14, 52); g.strokeStyle = '#f4f4f4'; g.lineWidth = 4; g.strokeRect(x - 22, y - 92, 44, 52); g.beginPath(); g.moveTo(x, y - 92); g.lineTo(x, y - 40); g.moveTo(x - 22, y - 66); g.lineTo(x + 22, y - 66); g.stroke(); },
  tools(g, x, y) { g.fillStyle = '#5a5f66'; g.fillRect(x - 24, y - 70, 48, 6); g.fillStyle = '#c4452e'; rr(g, x - 20, y - 14, 40, 14, 3); g.fill(); g.fillStyle = '#e8c64a'; g.fillRect(x - 14, y - 62, 4, 22); g.fillStyle = '#9aa0a8'; g.fillRect(x - 3, y - 62, 4, 26); g.fillStyle = '#3a8a4a'; g.fillRect(x + 8, y - 62, 4, 20); },
  tires(g, x, y) { for (const [dx, dy] of [[-10, 0], [10, 0], [0, -16]]) { g.fillStyle = '#16181c'; g.beginPath(); g.arc(x + dx, y - 15 + dy, 14, 0, 7); g.fill(); g.fillStyle = '#5a5f66'; g.beginPath(); g.arc(x + dx, y - 15 + dy, 6, 0, 7); g.fill(); } },
  crate(g, x, y) { g.fillStyle = '#b07a3e'; g.fillRect(x - 18, y - 36, 36, 36); g.strokeStyle = '#5d3c20'; g.lineWidth = 3; g.strokeRect(x - 16.5, y - 34.5, 33, 33); g.beginPath(); g.moveTo(x - 16, y - 34); g.lineTo(x + 16, y - 2); g.moveTo(x + 16, y - 34); g.lineTo(x - 16, y - 2); g.stroke(); },
  barrel(g, x, y) { g.fillStyle = '#c4452e'; rr(g, x - 14, y - 40, 28, 40, 6); g.fill(); g.fillStyle = '#7a2a1c'; g.fillRect(x - 14, y - 30, 28, 4); g.fillRect(x - 14, y - 12, 28, 4); g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x - 10, y - 38, 4, 36); },
  shelf(g, x, y) { g.fillStyle = '#6a7f94'; g.fillRect(x - 26, y - 60, 52, 60); g.fillStyle = '#3d4a58'; for (const dy of [-60, -40, -20, 0]) g.fillRect(x - 26, y + dy - 2, 52, 3); const cols = ['#e8a43a', '#e84a4a', '#3b8cff', '#41d97a', '#b469ff']; for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { g.fillStyle = cols[(r * 3 + i) % 5]; g.fillRect(x - 22 + i * 12, y - 54 + r * 20, 9, 14); } },
  cashier(g, x, y) { g.fillStyle = '#6a7a8a'; g.fillRect(x - 26, y - 28, 52, 28); g.fillStyle = '#2a3340'; g.fillRect(x - 12, y - 44, 24, 16); g.fillStyle = '#7ae09a'; g.fillRect(x - 9, y - 41, 18, 8); },
  fridge(g, x, y) { g.fillStyle = '#e6eef2'; rr(g, x - 17, y - 70, 34, 70, 4); g.fill(); g.strokeStyle = '#8a9aa4'; g.lineWidth = 2; g.stroke(); g.beginPath(); g.moveTo(x - 17, y - 42); g.lineTo(x + 17, y - 42); g.stroke(); g.fillStyle = '#8a9aa4'; g.fillRect(x + 8, y - 62, 3, 14); g.fillRect(x + 8, y - 36, 3, 14); },
  counter(g, x, y) { g.fillStyle = '#8a5a30'; g.fillRect(x - 32, y - 30, 64, 30); g.fillStyle = '#c4915a'; g.fillRect(x - 34, y - 34, 68, 6); g.fillStyle = 'rgba(0,0,0,.2)'; g.fillRect(x - 32, y - 14, 64, 2); },
  bed(g, x, y) { g.fillStyle = '#6a4a30'; g.fillRect(x - 32, y - 22, 64, 22); g.fillStyle = '#e8e4d8'; rr(g, x - 30, y - 30, 60, 14, 5); g.fill(); g.fillStyle = '#c4d4e8'; g.fillRect(x - 28, y - 22, 40, 12); g.fillStyle = '#6a4a30'; g.fillRect(x - 34, y - 40, 6, 40); },
  painting(g, x, y) { g.fillStyle = '#c9a24a'; g.fillRect(x - 24, y - 90, 48, 38); g.fillStyle = '#5a8a6a'; g.fillRect(x - 20, y - 86, 40, 30); g.fillStyle = '#e8d27a'; g.beginPath(); g.arc(x - 6, y - 76, 5, 0, 7); g.fill(); g.fillStyle = '#3a5a4a'; g.beginPath(); g.moveTo(x - 20, y - 56); g.lineTo(x, y - 74); g.lineTo(x + 20, y - 56); g.closePath(); g.fill(); },
  desk(g, x, y) { g.fillStyle = '#7a5a3a'; g.fillRect(x - 28, y - 28, 56, 5); g.fillRect(x - 26, y - 23, 5, 23); g.fillRect(x + 21, y - 23, 5, 23); g.fillStyle = '#e8e4d8'; g.fillRect(x + 4, y - 33, 16, 5); g.fillStyle = '#2a3340'; g.fillRect(x - 16, y - 20, 14, 18); },
  pc(g, x, y) { g.fillStyle = '#7a5a3a'; g.fillRect(x - 24, y - 24, 48, 5); g.fillRect(x - 22, y - 19, 5, 19); g.fillRect(x + 17, y - 19, 5, 19); g.fillStyle = '#15181f'; g.fillRect(x - 13, y - 52, 26, 22); g.fillStyle = '#4ac8ff'; g.fillRect(x - 11, y - 50, 22, 16); g.fillStyle = '#15181f'; g.fillRect(x - 3, y - 30, 6, 6); },
  clock(g, x, y) { g.fillStyle = '#f4f0e0'; g.beginPath(); g.arc(x, y - 84, 14, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 3; g.stroke(); g.beginPath(); g.moveTo(x, y - 84); g.lineTo(x, y - 94); g.moveTo(x, y - 84); g.lineTo(x + 7, y - 80); g.stroke(); },
  safe(g, x, y) { g.fillStyle = '#4a5560'; rr(g, x - 22, y - 46, 44, 46, 4); g.fill(); g.strokeStyle = '#2a3038'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#9aa4ae'; g.beginPath(); g.arc(x, y - 24, 11, 0, 7); g.fill(); g.strokeStyle = '#2a3038'; g.beginPath(); g.moveTo(x - 6, y - 24); g.lineTo(x + 6, y - 24); g.moveTo(x, y - 30); g.lineTo(x, y - 18); g.stroke(); },
  statue(g, x, y) { g.fillStyle = '#9a9488'; g.fillRect(x - 14, y - 16, 28, 16); g.fillStyle = '#b4aea2'; rr(g, x - 9, y - 54, 18, 38, 6); g.fill(); g.beginPath(); g.arc(x, y - 62, 9, 0, 7); g.fill(); },
  pillar(g, x, y) { g.fillStyle = '#c8c0b0'; g.fillRect(x - 12, y - 110, 24, 110); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(x + 4, y - 110, 8, 110); g.fillStyle = '#d8d0c0'; g.fillRect(x - 16, y - 12, 32, 12); g.fillRect(x - 16, y - 116, 32, 8); },
  locker(g, x, y) { g.fillStyle = '#4a6a8a'; g.fillRect(x - 15, y - 62, 30, 62); g.strokeStyle = '#2a3f56'; g.lineWidth = 2; g.strokeRect(x - 15, y - 62, 30, 62); g.beginPath(); g.moveTo(x, y - 62); g.lineTo(x, y); g.stroke(); g.fillStyle = '#9aa4ae'; g.fillRect(x - 12, y - 38, 6, 2); g.fillRect(x + 6, y - 38, 6, 2); for (let i = 0; i < 3; i++) { g.fillRect(x - 11, y - 56 + i * 3, 8, 1.5); g.fillRect(x + 3, y - 56 + i * 3, 8, 1.5); } },
  bookcase(g, x, y) { g.fillStyle = '#6a4630'; g.fillRect(x - 26, y - 80, 52, 80); const cols = ['#c4452e', '#3b6a9a', '#3a8a4a', '#e8c64a', '#8a4a9a']; for (let r = 0; r < 4; r++) { g.fillStyle = '#4a2e1c'; g.fillRect(x - 26, y - 80 + r * 20, 52, 3); for (let i = 0; i < 6; i++) { g.fillStyle = cols[(r + i) % 5]; g.fillRect(x - 23 + i * 8, y - 76 + r * 20, 6, 16); } } },
  medbed(g, x, y) { g.fillStyle = '#9aa4ae'; g.fillRect(x - 28, y - 22, 56, 6); g.fillRect(x - 24, y - 16, 4, 16); g.fillRect(x + 20, y - 16, 4, 16); g.fillStyle = '#e8f0f4'; rr(g, x - 26, y - 30, 52, 10, 4); g.fill(); g.fillStyle = '#e84a5a'; g.fillRect(x - 3, y - 29, 6, 8); g.fillRect(x - 6, y - 26, 12, 2); },
  bars(g, x, y) { g.fillStyle = '#2a2d33'; for (let i = -3; i <= 3; i++) g.fillRect(x + i * 8 - 1.5, y - 74, 3, 74); g.fillRect(x - 27, y - 74, 54, 4); g.fillRect(x - 27, y - 4, 54, 4); },
  table(g, x, y) { g.fillStyle = '#e8e4d8'; g.fillRect(x - 26, y - 30, 52, 6); g.fillStyle = '#6a4a30'; g.fillRect(x - 3, y - 24, 6, 24); g.fillRect(x - 14, y - 4, 28, 4); g.fillStyle = '#c4452e'; g.beginPath(); g.arc(x - 12, y - 36, 5, 0, 7); g.fill(); },
  slots(g, x, y) { g.fillStyle = '#c4452e'; rr(g, x - 17, y - 62, 34, 62, 5); g.fill(); g.fillStyle = '#e8e4d8'; g.fillRect(x - 12, y - 52, 24, 16); g.fillStyle = '#15181f'; for (let i = 0; i < 3; i++) g.fillRect(x - 11 + i * 8, y - 50, 7, 12); g.fillStyle = '#e8c64a'; g.beginPath(); g.arc(x + 20, y - 40, 5, 0, 7); g.fill(); g.fillRect(x + 18, y - 40, 3, 20); },
  conveyor(g, x, y) { g.fillStyle = '#3a3f46'; g.fillRect(x - 34, y - 18, 68, 12); g.fillStyle = '#5a6068'; for (let i = 0; i < 8; i++) g.fillRect(x - 33 + i * 8.5, y - 17, 3, 10); g.fillStyle = '#2a2d33'; g.beginPath(); g.arc(x - 34, y - 12, 8, 0, 7); g.arc(x + 34, y - 12, 8, 0, 7); g.fill(); g.fillStyle = '#b07a3e'; g.fillRect(x - 8, y - 32, 18, 14); },
  pipes(g, x, y) { g.strokeStyle = '#7a8a94'; g.lineWidth = 8; g.beginPath(); g.moveTo(x - 30, y - 90); g.lineTo(x + 30, y - 90); g.moveTo(x + 20, y - 90); g.lineTo(x + 20, y - 40); g.stroke(); g.strokeStyle = '#a8b6be'; g.lineWidth = 3; g.beginPath(); g.moveTo(x - 30, y - 92); g.lineTo(x + 30, y - 92); g.stroke(); g.fillStyle = '#c4452e'; g.beginPath(); g.arc(x + 20, y - 64, 6, 0, 7); g.fill(); },
  lab(g, x, y) { g.fillStyle = '#e8f0f4'; g.fillRect(x - 28, y - 30, 56, 30); g.fillStyle = '#7affc8'; g.fillRect(x - 20, y - 52, 8, 22); g.fillStyle = '#ff7ac8'; g.fillRect(x - 6, y - 46, 8, 16); g.fillStyle = '#7ab6ff'; g.fillRect(x + 8, y - 56, 8, 26); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x - 20, y - 52, 2, 22); },
  camera(g, x, y) { g.fillStyle = '#2a2d33'; rr(g, x - 16, y - 34, 32, 22, 4); g.fill(); g.fillRect(x - 3, y - 12, 6, 12); g.fillStyle = '#7ab6ff'; g.beginPath(); g.arc(x + 14, y - 23, 7, 0, 7); g.fill(); g.fillStyle = '#e84a4a'; g.beginPath(); g.arc(x - 8, y - 28, 2.5, 0, 7); g.fill(); },
  luggage(g, x, y) { g.fillStyle = '#3a6a9a'; rr(g, x - 17, y - 34, 34, 34, 4); g.fill(); g.strokeStyle = '#1f3f5f'; g.lineWidth = 3; g.stroke(); g.fillStyle = '#9aa4ae'; g.fillRect(x - 7, y - 40, 14, 6); g.fillStyle = '#e8c64a'; g.fillRect(x - 17, y - 20, 34, 4); },
};
const HIDE_ALIAS = { closet: 'cabinet' };
const drawProp = (g, type, x, y) => (PROPS[HIDE_ALIAS[type] || type] || PROPS.crate)(g, x, y);

// ---------------------------------------------------------------- de vaste laag (gebouw, kamers, spullen)
const roomTop = (f) => (Y[f] - 4) * TS + 6;
export function buildStatic(L) {
  const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH;
  const g = cv.getContext('2d');
  const T = L.theme;
  // nachtlucht en grond
  const sky = g.createLinearGradient(0, 0, 0, CH); sky.addColorStop(0, '#0f1a2e'); sky.addColorStop(1, '#27405e');
  g.fillStyle = sky; g.fillRect(0, 0, CW, CH);
  g.fillStyle = '#fff'; for (let i = 0; i < 40; i++) { g.globalAlpha = 0.3 + hash(i, 3) * 0.5; g.fillRect(hash(i, 1) * CW, hash(i, 2) * (Y[L.floors - 1] - 5) * TS, 2, 2); } g.globalAlpha = 1;
  g.fillStyle = '#3a2f26'; g.fillRect(0, Y[0] * TS, CW, CH - Y[0] * TS);
  g.fillStyle = '#2a211a'; for (let i = 0; i < 60; i++) g.fillRect(hash(i, 7) * CW, Y[0] * TS + 20 + hash(i, 8) * 70, 6, 3);
  const topY = roomTop(L.floors - 1) - 14;
  // het gebouw
  const bx0 = 0.5 * TS, bx1 = (W - 0.5) * TS;
  g.fillStyle = OUT; rr(g, bx0 - 6, topY - 6, bx1 - bx0 + 12, Y[0] * TS - topY + 12, 4); g.fill();
  for (let f = 0; f < L.floors; f++) {
    const y0 = (Y[f] - 4) * TS + 4, y1 = Y[f] * TS;
    for (const r of L.rooms[f]) {
      const x0 = r.x0 * TS, x1 = r.x1 * TS;
      const gr = g.createLinearGradient(0, y0, 0, y1); gr.addColorStop(0, T.wall); gr.addColorStop(1, T.wall2);
      g.fillStyle = gr; g.fillRect(x0 + 2, y0, x1 - x0 - 4, y1 - y0);
      // behang / onderste band
      g.fillStyle = 'rgba(0,0,0,.14)'; g.fillRect(x0 + 2, y1 - 38, x1 - x0 - 4, 38);
      g.fillStyle = T.trim; g.fillRect(x0 + 2, y1 - 40, x1 - x0 - 4, 4);
      g.fillStyle = 'rgba(255,255,255,.05)'; for (let x = x0 + 14; x < x1 - 6; x += 22) g.fillRect(x, y0 + 4, 3, y1 - y0 - 46);
      // een beschadigde muur op sommige plekken, zoals in de vorige gebouwen
      for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(0,0,0,.08)'; g.beginPath(); g.ellipse(x0 + hash(r.x0 + i, f) * (x1 - x0), y0 + hash(i, r.x1 + f) * 60 + 20, 22, 14, 0, 0, 7); g.fill(); }
      // plafondlamp met een lichtvlek
      const lx = (x0 + x1) / 2;
      g.fillStyle = '#e8e4d0'; g.fillRect(lx - 14, y0, 28, 5);
      const gl = g.createRadialGradient(lx, y0 + 6, 4, lx, y0 + 6, 120); gl.addColorStop(0, 'rgba(255,248,210,.35)'); gl.addColorStop(1, 'rgba(255,248,210,0)');
      g.fillStyle = gl; g.fillRect(x0 + 2, y0, x1 - x0 - 4, y1 - y0);
    }
    // vloer
    g.fillStyle = T.floor; g.fillRect(2 * 0 + bx0, y1, bx1 - bx0, 8);
    g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(bx0, y1, bx1 - bx0, 2);
    g.fillStyle = OUT; g.fillRect(bx0, y1 + 8, bx1 - bx0, 4);
    // muren met deuren
    for (const w of L.walls) {
      if (w.f !== f) continue;
      const x = w.x * TS;
      g.fillStyle = OUT; g.fillRect(x - 5, y0 - 4, 10, y1 - y0 + 4);
      g.fillStyle = '#2b2f38'; g.fillRect(x - 3, y0 - 4, 6, y1 - y0 + 4);
      // open deur: een donkere opening met een kozijn
      const dh = 2.6 * TS, dw = 1.5 * TS;
      g.fillStyle = '#15181f'; g.fillRect(x - dw / 2, y1 - dh, dw, dh);
      g.fillStyle = T.trim; g.fillRect(x - dw / 2 - 4, y1 - dh - 5, dw + 8, 6); g.fillRect(x - dw / 2 - 4, y1 - dh, 4, dh); g.fillRect(x + dw / 2, y1 - dh, 4, dh);
    }
  }
  // buitenmuren en dak
  g.fillStyle = OUT; g.fillRect(bx0 - 6, topY - 6, 6, Y[0] * TS - topY + 12); g.fillRect(bx1, topY - 6, 6, Y[0] * TS - topY + 12);
  g.fillStyle = '#2b2f38'; g.fillRect(bx0 - 6, topY - 12, bx1 - bx0 + 12, 8);
  // ladders met een gat in de vloer erboven; trappen en liften
  for (const l of L.ladders) {
    const x = l.x * TS, y1 = Y[l.f] * TS, y0 = (Y[l.f] - 4) * TS + 4;
    g.fillStyle = '#15181f'; g.beginPath(); g.ellipse(x, y0 + 2, 26, 6, 0, 0, 7); g.fill(); // het gat in het plafond
    g.fillStyle = '#7a7f88'; g.fillRect(x - 14, y0, 4, y1 - y0); g.fillRect(x + 10, y0, 4, y1 - y0);
    g.fillStyle = '#a8aeb8'; for (let y = y0 + 8; y < y1 - 4; y += 14) g.fillRect(x - 12, y, 24, 4);
    g.fillStyle = '#15181f'; g.beginPath(); g.ellipse(x, y1 + 2, 22, 5, 0, 0, 7); g.fill(); // het gat in de vloer van deze kamer
    // de opening boven op de vloer van de verdieping erboven
    const yu = Y[l.f + 1] * TS; g.fillStyle = '#15181f'; g.beginPath(); g.ellipse(x, yu + 2, 24, 5, 0, 0, 7); g.fill(); g.fillStyle = '#a8aeb8'; g.fillRect(x - 14, yu - 22, 4, 22); g.fillRect(x + 10, yu - 22, 4, 22);
  }
  for (const s of L.stairs) {
    const x = s.x * TS, y1 = Y[s.f] * TS;
    if (s.kind === 'lift') {
      g.fillStyle = '#15181f'; g.fillRect(x - 38, y1 - 100, 76, 100);
      g.fillStyle = '#b8bec6'; g.fillRect(x - 34, y1 - 96, 32, 96); g.fillRect(x + 2, y1 - 96, 32, 96);
      g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x - 30, y1 - 96, 6, 96); g.fillRect(x + 6, y1 - 96, 6, 96);
      g.fillStyle = '#41d97a'; g.beginPath(); const up = s.dir === 'up'; g.moveTo(x, y1 - (up ? 112 : 106)); g.lineTo(x - 7, y1 - (up ? 104 : 114)); g.lineTo(x + 7, y1 - (up ? 104 : 114)); g.closePath(); g.fill();
    } else {
      g.fillStyle = '#15181f'; g.fillRect(x - 36, y1 - 100, 72, 100);
      g.fillStyle = '#3a3f4a'; const up = s.dir === 'up';
      for (let i = 0; i < 6; i++) { const w = 60 - i * 7; g.fillRect(x - w / 2, y1 - 8 - i * 14, w, 6); g.fillStyle = i % 2 ? '#3a3f4a' : '#4a505c'; }
      g.fillStyle = up ? '#41d97a' : '#e8a43a'; g.beginPath(); g.moveTo(x, y1 - (up ? 112 : 106)); g.lineTo(x - 7, y1 - (up ? 104 : 114)); g.lineTo(x + 7, y1 - (up ? 104 : 114)); g.closePath(); g.fill();
    }
  }
  // schuilplekken en versiering
  for (const o of L.decor) drawProp(g, o.type, o.x * TS, Y[o.f] * TS);
  for (const h of L.hides) {
    const hx = h.x * TS, hy = Y[h.f] * TS;
    const gl = g.createRadialGradient(hx, hy - 24, 4, hx, hy - 24, 40); gl.addColorStop(0, 'rgba(120,255,170,.32)'); gl.addColorStop(1, 'rgba(120,255,170,0)');
    g.fillStyle = gl; g.fillRect(hx - 44, hy - 70, 88, 76);
    drawProp(g, h.kind, hx, hy);
    g.fillStyle = 'rgba(8,18,12,.75)'; rr(g, hx - 9, hy - 94, 18, 16, 5); g.fill(); g.fillStyle = '#7affb0'; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('\u2193', hx, hy - 82);
  }
  // de uitgang
  {
    const x = L.exit.x * TS, y1 = Y[L.exit.f] * TS;
    g.fillStyle = '#15181f'; g.fillRect(x - 34, y1 - 104, 68, 104);
    g.fillStyle = '#0c2a14'; g.fillRect(x - 28, y1 - 98, 56, 98);
    g.fillStyle = '#41d97a';
    for (const [dx, dy, ax, ay] of [[-20, -88, 1, 1], [20, -88, -1, 1], [-20, -60, 1, -1], [20, -60, -1, -1]]) { g.beginPath(); g.moveTo(x + dx, y1 + dy); g.lineTo(x + dx + ax * 14, y1 + dy); g.lineTo(x + dx, y1 + dy + ay * 14); g.closePath(); g.fill(); }
    g.fillStyle = '#e8e4d8'; g.font = '700 12px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('UITGANG', x, y1 - 108);
  }
  return cv;
}

// ---------------------------------------------------------------- voorwerpen
function drawItem(g, it, t) {
  const x = it.x * TS, y = Y[it.f] * TS, bob = Math.sin(t * 3 + it.x) * 2;
  if (it.type === 'doc') {
    g.save(); g.translate(x, y - 28 + bob); g.rotate(-0.08); g.fillStyle = '#f6f4ea'; g.fillRect(-12, -15, 24, 30); g.strokeStyle = '#8a8676'; g.lineWidth = 1.5; g.strokeRect(-12, -15, 24, 30);
    g.fillStyle = '#8a8676'; for (let i = 0; i < 4; i++) g.fillRect(-8, -9 + i * 6, 16 - (i === 3 ? 6 : 0), 2); g.restore();
    glow(g, x, y - 28 + bob, '#fff6b0');
  } else if (it.type === 'loot') {
    g.save(); g.translate(x, y - 22 + bob); g.fillStyle = '#b08a4a'; g.beginPath(); g.moveTo(-12, 16); g.quadraticCurveTo(-18, 0, -6, -10); g.lineTo(6, -10); g.quadraticCurveTo(18, 0, 12, 16); g.closePath(); g.fill(); g.strokeStyle = '#6a4a1c'; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#6a4a1c'; g.font = '700 16px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('$', 0, 10); g.restore(); glow(g, x, y - 22 + bob, '#ffe27a');
  } else if (it.type === 'hack') {
    g.fillStyle = '#2a3340'; g.fillRect(x - 17, y - 40, 34, 26); g.fillStyle = '#0c1a10'; g.fillRect(x - 14, y - 37, 28, 18); g.fillStyle = '#41d97a'; g.font = '700 9px monospace'; g.textAlign = 'left'; g.fillText('>_ hack', x - 12, y - 25);
    g.fillStyle = '#2a3340'; g.fillRect(x - 6, y - 14, 12, 14); glow(g, x, y - 28, '#41d97a');
  } else if (it.type === 'switch') {
    g.fillStyle = '#4a4f58'; rr(g, x - 12, y - 46, 24, 32, 3); g.fill(); g.fillStyle = '#e84a4a'; g.beginPath(); g.arc(x, y - 36, 4, 0, 7); g.fill();
    g.strokeStyle = '#e8e4d8'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 24); g.lineTo(x + 6, y - 36); g.stroke(); glow(g, x, y - 30, '#ff7a7a');
  } else if (it.type === 'key') {
    g.save(); g.translate(x, y - 24 + bob); g.fillStyle = it.color; g.strokeStyle = OUT; g.lineWidth = 2; g.beginPath(); g.arc(-6, 0, 7, 0, 7); g.fill(); g.stroke(); g.fillRect(0, -2, 16, 4); g.fillRect(10, 2, 3, 6); g.fillRect(14, 2, 3, 4); g.restore(); glow(g, x, y - 24 + bob, it.color);
  }
}
function glow(g, x, y, c) { const gr = g.createRadialGradient(x, y, 2, x, y, 26); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.globalAlpha = 0.45 + 0.2 * Math.sin(performance.now() / 300); g.fillStyle = gr; g.beginPath(); g.arc(x, y, 26, 0, 7); g.fill(); g.globalAlpha = 1; }

// ---------------------------------------------------------------- bewakers
const SKIN = {
  blue: ['#4a7ac8', '#2f5498'], green: ['#4aa858', '#2f7a3c'], purple: ['#8a5ac8', '#5e3a98'], gold: ['#d8b040', '#a07a1c'], white: ['#e6eef2', '#a8b8c2'],
  police: ['#3a4a9a', '#222d66'], chef: ['#f0ece0', '#b8b2a0'], orange: ['#e88a3a', '#a8561c'], knight: ['#9aa0a8', '#5e646c'], alien: ['#5ae0a8', '#2a9a70'], boss: ['#a83a4a', '#681f2a'],
};
function drawRobot(g, gd, s, t, stunned, alert) {
  const [c1, c2] = SKIN[gd.skin] || SKIN.blue;
  const x = s.x * TS, y = Y[gd.f] * TS, dir = s.dir || 1;
  if (gd.kind === 'camera') { // aan het plafond
    const cy = (Y[gd.f] - 4) * TS + 8;
    g.fillStyle = '#2a2d33'; g.fillRect(x - 3, cy - 4, 6, 10);
    g.save(); g.translate(x, cy + 6); g.rotate(-s.ang); g.fillStyle = '#3a3f46'; rr(g, -11, 0, 22, 14, 5); g.fill(); g.fillStyle = alert ? '#ff3a3a' : '#7ab6ff'; g.beginPath(); g.arc(0, 8, 4.5, 0, 7); g.fill(); g.restore();
    return;
  }
  if (gd.kind === 'drone') {
    const hy = y - 2.6 * TS + Math.sin(t * 4 + gd.id) * 3;
    g.fillStyle = c2; rr(g, x - 16, hy - 6, 32, 14, 7); g.fill(); g.fillStyle = c1; rr(g, x - 13, hy - 8, 26, 10, 5); g.fill();
    g.fillStyle = alert ? '#ff3a3a' : '#ffe27a'; g.beginPath(); g.arc(x, hy + 4, 4, 0, 7); g.fill();
    g.strokeStyle = 'rgba(220,230,240,.8)'; g.lineWidth = 3; g.beginPath(); const sw = Math.sin(t * 40) * 14; g.moveTo(x - 18 - sw * 0.2, hy - 12); g.lineTo(x - 18 + sw, hy - 12); g.moveTo(x + 18 - sw, hy - 12); g.lineTo(x + 18 + sw * 0.2, hy - 12); g.stroke();
    g.fillStyle = c2; g.fillRect(x - 18, hy - 12, 2, 6); g.fillRect(x + 16, hy - 12, 2, 6);
    return;
  }
  const big = gd.kind === 'heavy', fast = gd.kind === 'fast', sleeper = gd.kind === 'sleeper';
  const sc = big ? 1.25 : fast ? 0.9 : 1;
  g.save(); g.translate(x, y); g.scale(sc * dir, sc);
  const step = s.moving ? Math.sin(t * (fast ? 14 : 8) + gd.id) : 0;
  if (stunned) g.globalAlpha = 0.75;
  // onderstel: rupsen of beentjes
  if (fast) { g.strokeStyle = c2; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(-5, -14); g.lineTo(-5 + step * 6, 0); g.moveTo(5, -14); g.lineTo(5 - step * 6, 0); g.stroke(); }
  else { g.fillStyle = '#2a2d33'; rr(g, -15, -10, 30, 10, 5); g.fill(); g.fillStyle = '#4a4f58'; for (let i = -10; i <= 10; i += 10) { g.beginPath(); g.arc(i, -5, 3, 0, 7); g.fill(); } }
  // lichaam
  g.fillStyle = c2; rr(g, -13, -44, 26, 36, 7); g.fill();
  g.fillStyle = c1; rr(g, -11, -46, 22, 32, 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-9, -44, 5, 26);
  if (gd.skin === 'police') { g.fillStyle = '#e8c64a'; g.beginPath(); g.moveTo(2, -36); g.lineTo(6, -28); g.lineTo(0, -24); g.lineTo(-4, -28); g.closePath(); g.fill(); }
  if (gd.skin === 'chef') { g.fillStyle = '#fff'; g.beginPath(); g.arc(-4, -56, 8, 0, 7); g.arc(4, -56, 8, 0, 7); g.arc(0, -61, 8, 0, 7); g.fill(); }
  if (gd.skin === 'knight') { g.fillStyle = c2; g.fillRect(-2, -66, 4, 12); g.fillStyle = '#c4452e'; g.fillRect(-2, -70, 4, 6); }
  if (gd.skin === 'alien') { g.strokeStyle = c1; g.lineWidth = 2; g.beginPath(); g.moveTo(-4, -56); g.lineTo(-8, -66); g.moveTo(4, -56); g.lineTo(8, -66); g.stroke(); g.fillStyle = c1; g.beginPath(); g.arc(-8, -66, 2.5, 0, 7); g.arc(8, -66, 2.5, 0, 7); g.fill(); }
  // arm
  g.strokeStyle = c2; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(8, -36); g.lineTo(16 + step * 3, -24); g.stroke();
  // kop met een oog
  g.fillStyle = c2; rr(g, -12, -62, 24, 20, 9); g.fill(); g.fillStyle = c1; rr(g, -10, -62, 20, 17, 8); g.fill();
  const asleep = sleeper && !s.awake;
  g.fillStyle = '#10141c'; rr(g, -2, -58, 12, 9, 4); g.fill();
  g.fillStyle = asleep ? '#4a4f58' : alert ? '#ff3a3a' : (big ? '#ff9a3a' : '#7affc8'); if (asleep) g.fillRect(1, -54, 7, 2); else { g.beginPath(); g.arc(6, -53.5, 3, 0, 7); g.fill(); }
  g.fillStyle = '#2a2d33'; g.fillRect(-1, -70, 2, 8); g.fillStyle = alert ? '#ff3a3a' : '#e8c64a'; g.beginPath(); g.arc(0, -71, 3, 0, 7); g.fill();
  if (big) { g.strokeStyle = '#2a2d33'; g.lineWidth = 3; g.strokeRect(-12, -44, 24, 36); }
  g.restore();
  if (asleep) { g.fillStyle = '#e8e4d8'; g.font = '700 14px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('z', x + 18, y - 70 - Math.sin(t * 2) * 3); g.font = '700 10px Fredoka, sans-serif'; g.fillText('z', x + 28, y - 82 - Math.sin(t * 2 + 1) * 3); }
  if (stunned) { g.strokeStyle = '#ffe27a'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 8 + i * 2.1; g.beginPath(); g.moveTo(x + Math.cos(a) * 10, y - 78 + Math.sin(a) * 5); g.lineTo(x + Math.cos(a) * 16, y - 80 + Math.sin(a) * 8); g.stroke(); } }
}

function drawCone(g, gd, s, alert) {
  const y = Y[gd.f] * TS;
  g.save();
  const col = alert ? '255,60,60' : '255,236,140';
  if (gd.kind === 'camera') {
    const cx = s.x * TS, cy = (Y[gd.f] - 4) * TS + 14;
    g.translate(cx, cy);
    const R = gd.range * TS;
    const a0 = Math.PI / 2 - s.ang - gd.half, a1 = Math.PI / 2 - s.ang + gd.half;
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, R); gr.addColorStop(0, `rgba(${col},.45)`); gr.addColorStop(1, `rgba(${col},.05)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, R, a0 - 0.0, a1 + 0.0); g.closePath(); g.fill();
  } else if (gd.kind === 'drone') {
    const hy = y - 2.6 * TS + 8, x = s.x * TS;
    const gr = g.createLinearGradient(0, hy, 0, y); gr.addColorStop(0, `rgba(${col},.5)`); gr.addColorStop(1, `rgba(${col},.08)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x - 4, hy); g.lineTo(x + 4, hy); g.lineTo(x + 28, y); g.lineTo(x - 28, y); g.closePath(); g.fill();
  } else if (!(gd.kind === 'sleeper' && !s.awake)) {
    const x = s.x * TS, dir = s.dir, R = gd.range * TS, ey = y - 52;
    const gr = g.createLinearGradient(x, 0, x + dir * R, 0); gr.addColorStop(0, `rgba(${col},.55)`); gr.addColorStop(1, `rgba(${col},.04)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x + dir * 10, ey); g.lineTo(x + dir * R, y + 6); g.lineTo(x + dir * R, y - 70); g.closePath(); g.fill();
  }
  g.restore();
}

// ---------------------------------------------------------------- Te-Un als dief: rode muts, zonnebril, groene jas, gestreepte kousen en een buit-zak
export function drawThief(g, p, t, opts = {}) {
  const x = opts.px !== undefined ? opts.px : p.x * TS, y = opts.py !== undefined ? opts.py : p.y * TS;
  const moving = p.mode === 'walk' && Math.abs(p.vx) > 0.5, climbing = p.mode === 'climb';
  const sw = moving ? Math.sin(p.walk * 7) : 0;
  g.save(); g.translate(x, y); g.scale((opts.scale || 1) * (p.face >= 0 ? 1 : -1), opts.scale || 1);
  if (p.mode === 'hide' || p.hidden) g.globalAlpha = 0.35;
  if (p.mode === 'portal') g.globalAlpha = 0.25;
  // zak op de rug
  g.fillStyle = '#a8864a'; g.beginPath(); g.moveTo(-8, -30); g.quadraticCurveTo(-30, -26, -26, -6); g.quadraticCurveTo(-24, 2, -10, -4); g.closePath(); g.fill();
  g.strokeStyle = '#5a4018'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#5a4018'; g.font = '700 13px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('$', -17, -12);
  // benen met strepen
  const leg = (dx, ph) => {
    const bx = dx + ph * 5, by = -2;
    g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) { g.strokeStyle = i % 2 ? '#f4f4f4' : '#16181c'; g.beginPath(); g.moveTo(dx + (bx - dx) * (i / 5), -22 + (by + 22) * (i / 5)); g.lineTo(dx + (bx - dx) * ((i + 1) / 5), -22 + (by + 22) * ((i + 1) / 5)); g.stroke(); }
    g.fillStyle = '#7a5230'; rr(g, bx - 5, by - 4, 13, 8, 3); g.fill();
  };
  if (climbing) { const k = Math.sin(p.y * 0.4); leg(-4, k); leg(4, -k); } else { leg(-4, sw); leg(5, -sw); }
  // jas
  g.fillStyle = '#3a7a3a'; rr(g, -10, -42, 20, 26, 6); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#7a5230'; g.fillRect(-10, -26, 20, 4); g.fillStyle = '#e8c64a'; g.fillRect(-2, -27, 5, 6);
  // arm
  g.strokeStyle = '#3a7a3a'; g.lineWidth = 6; g.beginPath(); g.moveTo(6, -36); g.lineTo(12 - sw * 3, -24); g.stroke(); g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(12 - sw * 3, -22, 3.5, 0, 7); g.fill();
  // kop
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.arc(0, -52, 11, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#f0c8a0'; g.beginPath(); g.moveTo(-10, -54); g.lineTo(-19, -60); g.lineTo(-10, -47); g.fill(); g.beginPath(); g.moveTo(10, -54); g.lineTo(19, -60); g.lineTo(10, -47); g.fill();
  // zonnebril en grijns
  g.fillStyle = '#10141c'; rr(g, -9, -57, 8, 6, 2); g.fill(); rr(g, 1, -57, 8, 6, 2); g.fill(); g.fillRect(-2, -56, 4, 2);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-8, -56, 3, 1.5); g.fillRect(2, -56, 3, 1.5);
  g.strokeStyle = '#7a3a2a'; g.lineWidth = 1.6; g.beginPath(); g.arc(1, -50, 4, 0.2, 2.6); g.stroke();
  // rode muts
  g.fillStyle = '#c4281c'; g.beginPath(); g.moveTo(-13, -58); g.quadraticCurveTo(-8, -66, 2, -86); g.quadraticCurveTo(9, -68, 13, -58); g.quadraticCurveTo(0, -54, -13, -58); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#8f1a12'; g.beginPath(); g.ellipse(0, -58, 14, 3, 0, 0, 7); g.fill();
  g.restore();
}

// ---------------------------------------------------------------- hele scene
export function drawScene(g, game, stat, t) {
  const L = game.L, p = game.p;
  g.drawImage(stat, 0, 0);
  // gesloten deuren met een slot in de kleur van de sleutel
  L.walls.forEach((w, i) => {
    if (!w.lock || game.doorOpen.has(i)) return;
    const x = w.x * TS, y1 = Y[w.f] * TS, dh = 2.6 * TS, dw = 1.5 * TS;
    g.fillStyle = '#3a3f4a'; g.fillRect(x - dw / 2, y1 - dh, dw, dh);
    g.fillStyle = w.lock; g.fillRect(x - dw / 2 + 4, y1 - dh + 6, dw - 8, 10); g.fillRect(x - dw / 2 + 4, y1 - 14, dw - 8, 8);
    g.fillStyle = '#e8e4d8'; g.beginPath(); g.arc(x, y1 - dh / 2, 8, 0, 7); g.fill(); g.fillStyle = '#10141c'; g.fillRect(x - 2, y1 - dh / 2 - 3, 4, 8);
  });
  // lasers
  for (const l of L.lasers) {
    const x = l.x * TS, y1 = Y[l.f] * TS, y0 = (Y[l.f] - 3.6) * TS;
    const on = l.needSwitch ? !game.switchOn : laserOn(l, game.t);
    g.fillStyle = '#2a2d33'; g.fillRect(x - 6, y0 - 8, 12, 10); g.fillRect(x - 6, y1 - 4, 12, 8);
    if (on) { g.shadowColor = '#ff2a2a'; g.shadowBlur = 12; g.strokeStyle = '#ff4a4a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y0 + 2); g.lineTo(x, y1 - 4); g.stroke(); g.shadowBlur = 0; g.strokeStyle = '#ffe0e0'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y0 + 2); g.lineTo(x, y1 - 4); g.stroke(); }
    else { g.strokeStyle = 'rgba(255,90,90,.18)'; g.lineWidth = 2; g.setLineDash([4, 6]); g.beginPath(); g.moveTo(x, y0 + 2); g.lineTo(x, y1 - 4); g.stroke(); g.setLineDash([]); }
  }
  for (const it of game.items) if (!it.done) drawItem(g, it, t);
  // bewakers: eerst de lichtkegels, dan de robots
  const alertGuard = game.seenBy;
  L.guards.forEach((gd, i) => { const s = guardAt(gd, game.t); if (game.stun[i] > 0) return; drawCone(g, gd, s, i === alertGuard); });
  L.guards.forEach((gd, i) => drawRobot(g, gd, guardAt(gd, game.t), t, game.stun[i] > 0, i === alertGuard && game.meter > 0.2));
  drawThief(g, p, t);
  // het meter boven Te-Un als iemand hem ziet
  if (game.meter > 0.02) {
    const x = p.x * TS, y = p.y * TS - 100;
    g.fillStyle = 'rgba(0,0,0,.6)'; rr(g, x - 22, y, 44, 8, 4); g.fill();
    g.fillStyle = game.meter > 0.66 ? '#ff3a3a' : '#ffb03a'; rr(g, x - 21, y + 1, 42 * Math.min(1, game.meter), 6, 3); g.fill();
    g.fillStyle = '#ff3a3a'; g.font = '700 20px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('!', x, y - 4);
  }
  if (p.mode === 'act') { const x = p.x * TS, y = p.y * TS - 96, tot = Math.max(0.1, p.workItem ? (p.workItem.type === 'hack' ? 1.8 : 0.5) : 0.5); g.fillStyle = 'rgba(0,0,0,.55)'; rr(g, x - 22, y, 44, 8, 4); g.fill(); g.fillStyle = '#41d97a'; rr(g, x - 21, y + 1, 42 * (1 - Math.max(0, p.work) / tot), 6, 3); g.fill(); }
}
