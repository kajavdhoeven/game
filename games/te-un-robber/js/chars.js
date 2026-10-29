// Personages van Te-Un the Robber: Te-Un zelf (gewoon en als dief), boze kabouters, Nico, robotbewakers en politie.
// Alles staat met de voeten op (x, y); s = schaal (1 = 70 px hoog), face = 1 (naar rechts) of -1.
const OUT = '#0d0f14';
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
const lin = (g, x0, y0, x1, y1, a, b) => { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, a); gr.addColorStop(1, b); return gr; };

export const SKIN = '#f0c8a0';

// ---------------------------------------------------------------- Te-Un
// o: { x, y, s, face, walk (loopfase in radialen), t, outfit: 'classic' | 'black', mask: 0..1 (bivakmuts omhoog getrokken),
//      gloves: 0..1, sack: true/false, pose: 'stand' | 'walk' | 'climb' | 'sneak' | 'celebrate' | 'sad' | 'scared' | 'pullmask' | 'door' | 'run', alpha }
export function drawTeUn(g, o = {}) {
  const { x = 0, y = 0, s = 1, face = 1, walk = 0, t = 0, outfit = 'classic', gloves = 0, sack = true, pose = 'stand', alpha = 1 } = o;
  const mask = o.mask === undefined ? (outfit === 'black' ? 1 : 0) : o.mask;
  const black = outfit === 'black';
  const moving = pose === 'walk' || pose === 'run' || pose === 'sneak' || pose === 'climb';
  const sw = moving ? Math.sin(walk) : 0;
  const bob = pose === 'stand' ? Math.sin(t * 2) * 0.6 : pose === 'celebrate' ? -Math.abs(Math.sin(t * 6)) * 6 : moving ? -Math.abs(Math.sin(walk)) * 1.5 : 0;
  g.save(); g.translate(x, y); g.scale(s * face, s); g.globalAlpha *= alpha;
  const crouch = pose === 'sneak' ? 5 : 0;
  g.translate(0, bob + crouch * 0.5);
  const jacket = black ? ['#262a33', '#12141a'] : ['#4c9a4c', '#2f6a2f'];
  const legA = black ? '#171a20' : null;
  // zak op de rug
  if (sack) {
    g.fillStyle = lin(g, -26, -30, -8, -4, '#b8955a', '#8a6a34'); g.beginPath(); g.moveTo(-8, -30); g.quadraticCurveTo(-30, -26, -26, -6); g.quadraticCurveTo(-24, 2, -10, -4); g.closePath(); g.fill();
    g.strokeStyle = '#4a3410'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#4a3410'; g.font = '700 13px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('$', -17, -12);
  }
  // benen: gestreepte kousen, of zwarte broek als hij zwart gekleed is
  const leg = (dx, ph) => {
    const bx = dx + ph * (pose === 'run' ? 8 : 5), by = -2 + (ph > 0.6 ? -2 : 0);
    g.lineWidth = 7; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      g.strokeStyle = legA || (i % 2 ? '#f4f4f4' : '#16181c');
      g.beginPath(); g.moveTo(dx + (bx - dx) * (i / 5), -22 + (by + 22) * (i / 5)); g.lineTo(dx + (bx - dx) * ((i + 1) / 5), -22 + (by + 22) * ((i + 1) / 5)); g.stroke();
    }
    g.fillStyle = black ? '#0b0c10' : '#7a5230'; rr(g, bx - 5, by - 4, 13, 8, 3); g.fill();
  };
  if (pose === 'climb') { const k = Math.sin(walk); leg(-4, k); leg(4, -k); } else { leg(-4, sw); leg(5, -sw); }
  // jas
  g.fillStyle = lin(g, -10, -42, 10, -16, jacket[0], jacket[1]); rr(g, -10, -42, 20, 26, 6); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = black ? '#0f1116' : '#7a5230'; g.fillRect(-10, -26, 20, 4); g.fillStyle = black ? '#6a6f7a' : '#e8c64a'; g.fillRect(-2, -27, 5, 6);
  if (black) { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(-8, -40, 4, 22); }
  // arm
  let ax = 12 - sw * 3, ay = -24;
  if (pose === 'celebrate') { ax = 12; ay = -50 + Math.sin(t * 10) * 3; }
  if (pose === 'pullmask') { ax = 4; ay = -54; }
  if (pose === 'door') { ax = 18; ay = -34; }
  if (pose === 'scared') { ax = 10; ay = -56; }
  g.strokeStyle = jacket[0]; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(6, -36); g.lineTo(ax, ay); g.stroke();
  const glove = gloves > 0.5;
  g.fillStyle = glove ? '#0c0d11' : SKIN; g.beginPath(); g.arc(ax, ay + 2, glove ? 4.2 : 3.5, 0, 7); g.fill();
  // kop
  g.fillStyle = SKIN; g.beginPath(); g.arc(0, -52, 11, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  // punt-oren (alleen zonder bivakmuts)
  if (mask < 0.5) { g.fillStyle = SKIN; g.beginPath(); g.moveTo(-10, -54); g.lineTo(-19, -60); g.lineTo(-10, -47); g.fill(); g.beginPath(); g.moveTo(10, -54); g.lineTo(19, -60); g.lineTo(10, -47); g.fill(); }
  if (mask >= 0.5) {
    // bivakmuts: zwart breiplooi met een gleuf voor de ogen
    g.fillStyle = lin(g, -12, -64, 12, -40, '#2a2d36', '#0c0d11'); g.beginPath(); g.arc(0, -52, 12, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    g.fillStyle = SKIN; rr(g, -9, -57, 19, 7, 3); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-3.5, -53.6, 3, 2.4, 0, 0, 7); g.ellipse(4.5, -53.6, 3, 2.4, 0, 0, 7); g.fill();
    g.fillStyle = '#10141c'; g.beginPath(); g.arc(-2.6, -53.4, 1.4, 0, 7); g.arc(5.4, -53.4, 1.4, 0, 7); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (let i = -9; i <= 9; i += 3) { g.beginPath(); g.moveTo(i, -63); g.lineTo(i * 0.9, -41); g.stroke(); }
    if (pose === 'scared') { g.fillStyle = '#fff'; g.fillRect(-5, -56, 3, 5); }
  } else {
    // zonnebril en grijns
    g.fillStyle = '#10141c'; rr(g, -9, -57, 8, 6, 2); g.fill(); rr(g, 1, -57, 8, 6, 2); g.fill(); g.fillRect(-2, -56, 4, 2);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(-8, -56, 3, 1.5); g.fillRect(2, -56, 3, 1.5);
    g.strokeStyle = '#7a3a2a'; g.lineWidth = 1.6; g.beginPath(); g.arc(1, -50, 4, pose === 'sad' ? 3.6 : 0.2, pose === 'sad' ? 5.8 : 2.6); g.stroke();
  }
  // rode muts (weg als de bivakmuts op is; de bivakmuts komt dan "omlaag")
  if (mask < 0.5) {
    const lift = o.hatLift || 0;
    g.save(); g.translate(0, -lift);
    g.fillStyle = lin(g, -13, -86, 13, -54, '#e0442e', '#9a1a12'); g.beginPath(); g.moveTo(-13, -58); g.quadraticCurveTo(-8, -66, 2, -86); g.quadraticCurveTo(9, -68, 13, -58); g.quadraticCurveTo(0, -54, -13, -58); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
    g.fillStyle = '#8f1a12'; g.beginPath(); g.ellipse(0, -58, 14, 3, 0, 0, 7); g.fill();
    g.restore();
  }
  // opgerolde bivakmuts als muts op het hoofd (tijdens het opdoen)
  if (o.rolled) { g.fillStyle = '#15171c'; rr(g, -11, -66, 22, 8, 4); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.5; g.stroke(); }
  g.restore();
}

// ---------------------------------------------------------------- boze kabouter (van Te-Un Surfers)
export function drawGnome(g, o = {}) {
  const { x = 0, y = 0, s = 1, face = 1, walk = 0, t = 0, hat = '#d03a2a', coat = '#4a6ac8', angry = true, tool = 'fork', alpha = 1 } = o;
  const sw = Math.sin(walk);
  g.save(); g.translate(x, y); g.scale(s * face, s); g.globalAlpha *= alpha;
  g.translate(0, -Math.abs(sw) * 1.5);
  for (const dx of [-4, 5]) { g.strokeStyle = '#3a2a1c'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(dx, -20); g.lineTo(dx + (dx < 0 ? sw : -sw) * 5, -2); g.stroke(); g.fillStyle = '#2a1c10'; rr(g, dx + (dx < 0 ? sw : -sw) * 5 - 5, -5, 12, 6, 3); g.fill(); }
  g.fillStyle = lin(g, -10, -40, 10, -16, coat, '#1c2a5a'); rr(g, -10, -42, 20, 26, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#5a3a1c'; g.fillRect(-10, -26, 20, 3);
  // wapen
  const ang = -0.6 + Math.sin(t * 8) * (angry ? 0.15 : 0);
  g.save(); g.translate(8, -34); g.rotate(ang);
  g.strokeStyle = '#6a4a28'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -44); g.stroke();
  if (tool === 'fork') { g.strokeStyle = '#b8bec6'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(-5, -44); g.lineTo(-5, -54); g.moveTo(0, -44); g.lineTo(0, -57); g.moveTo(5, -44); g.lineTo(5, -54); g.moveTo(-5, -44); g.lineTo(5, -44); g.stroke(); }
  else if (tool === 'torch') { g.fillStyle = '#ff9a2a'; g.beginPath(); g.ellipse(0, -52 + Math.sin(t * 14) * 1.5, 6, 10, 0, 0, 7); g.fill(); g.fillStyle = '#ffe27a'; g.beginPath(); g.ellipse(0, -50, 3, 6, 0, 0, 7); g.fill(); }
  g.restore();
  g.fillStyle = '#e8c8a0'; g.beginPath(); g.arc(9, -26, 3.5, 0, 7); g.fill();
  g.fillStyle = SKIN; g.beginPath(); g.arc(0, -50, 11, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  // baard
  g.fillStyle = '#f4f0e8'; g.beginPath(); g.moveTo(-10, -50); g.quadraticCurveTo(-12, -30, 0, -26); g.quadraticCurveTo(12, -30, 10, -50); g.quadraticCurveTo(0, -42, -10, -50); g.fill(); g.strokeStyle = '#b8b2a0'; g.lineWidth = 1.2; g.stroke();
  // ogen en wenkbrauwen
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-4, -53, 3, 0, 7); g.arc(5, -53, 3, 0, 7); g.fill(); g.fillStyle = '#10141c'; g.beginPath(); g.arc(-3.4, -52.6, 1.5, 0, 7); g.arc(5.6, -52.6, 1.5, 0, 7); g.fill();
  g.strokeStyle = '#6a5a4a'; g.lineWidth = 2; g.beginPath(); if (angry) { g.moveTo(-8, -59); g.lineTo(-1, -55.5); g.moveTo(9, -59); g.lineTo(2, -55.5); } else { g.moveTo(-8, -57); g.lineTo(-1, -57); g.moveTo(9, -57); g.lineTo(2, -57); } g.stroke();
  g.fillStyle = '#d8887a'; g.beginPath(); g.arc(0, -49, 2.6, 0, 7); g.fill();
  g.fillStyle = lin(g, -13, -84, 13, -56, hat, '#701008'); g.beginPath(); g.moveTo(-13, -58); g.quadraticCurveTo(-8, -66, 2, -86); g.quadraticCurveTo(9, -68, 13, -58); g.quadraticCurveTo(0, -54, -13, -58); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- Nico: half blond, half bruin haar, baardje en kleine krulletjes
export function drawNico(g, o = {}) {
  const { x = 0, y = 0, s = 1, face = 1, t = 0, pose = 'stand', alpha = 1, suit = '#23344f' } = o;
  g.save(); g.translate(x, y); g.scale(s * face, s); g.globalAlpha *= alpha;
  const talk = pose === 'talk' ? Math.sin(t * 12) : 0;
  g.fillStyle = '#15171c'; rr(g, -9, -4, 9, 5, 2); g.fill(); rr(g, 1, -4, 9, 5, 2); g.fill();
  g.fillStyle = '#1a2438'; g.fillRect(-8, -26, 7, 23); g.fillRect(1, -26, 7, 23);
  g.fillStyle = lin(g, -12, -52, 12, -22, suit, '#121c2e'); rr(g, -12, -54, 24, 32, 6); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.moveTo(-4, -54); g.lineTo(4, -54); g.lineTo(0, -42); g.closePath(); g.fill();
  g.fillStyle = '#b02a2a'; g.beginPath(); g.moveTo(-1.5, -52); g.lineTo(1.5, -52); g.lineTo(2.5, -36); g.lineTo(0, -33); g.lineTo(-2.5, -36); g.closePath(); g.fill();
  g.strokeStyle = suit; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(9, -48); g.lineTo(pose === 'point' ? 24 : 14, pose === 'point' ? -50 : -32); g.stroke();
  g.fillStyle = SKIN; g.beginPath(); g.arc(pose === 'point' ? 25 : 14, pose === 'point' ? -50 : -30, 3.5, 0, 7); g.fill();
  // kop
  g.fillStyle = '#f2cfae'; g.beginPath(); g.ellipse(0, -66, 11, 12, 0, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  // haar: links blond, rechts bruin, kleine krulletjes
  const curl = (cx, cy, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(cx, cy, r, 0, 7); g.fill(); };
  for (const [cx, cy] of [[-9, -72], [-5, -77], [-1, -78], [-11, -66], [-7, -70], [-3, -74]]) curl(cx, cy, 3.6, '#e6c070');
  for (const [cx, cy] of [[9, -72], [5, -77], [1, -78], [11, -66], [7, -70], [3, -74]]) curl(cx, cy, 3.6, '#6a4228');
  g.strokeStyle = 'rgba(0,0,0,.2)'; g.lineWidth = 1; for (const [cx, cy] of [[-5, -77], [5, -77], [-9, -72], [9, -72]]) { g.beginPath(); g.arc(cx, cy, 2, 0.5, 4); g.stroke(); }
  // baardje
  g.fillStyle = '#7a5434'; g.beginPath(); g.moveTo(-8, -60); g.quadraticCurveTo(0, -48 + talk * 1.5, 8, -60); g.quadraticCurveTo(0, -57, -8, -60); g.fill();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(-4, -67, 2.6, 0, 7); g.arc(4, -67, 2.6, 0, 7); g.fill(); g.fillStyle = '#10141c'; g.beginPath(); g.arc(-3.6, -66.6, 1.3, 0, 7); g.arc(4.4, -66.6, 1.3, 0, 7); g.fill();
  g.strokeStyle = '#4a3220'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-8, -71); g.lineTo(-1.5, -70); g.moveTo(8, -71); g.lineTo(1.5, -70); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------- robotbewaker (zelfde look als in het spel, voor de tussenfilmpjes)
export const ROBOT_SKINS = {
  blue: ['#4a7ac8', '#2f5498'], green: ['#4aa858', '#2f7a3c'], purple: ['#8a5ac8', '#5e3a98'], gold: ['#d8b040', '#a07a1c'], white: ['#e6eef2', '#a8b8c2'],
  police: ['#3a4a9a', '#222d66'], chef: ['#f0ece0', '#b8b2a0'], orange: ['#e88a3a', '#a8561c'], knight: ['#9aa0a8', '#5e646c'], alien: ['#5ae0a8', '#2a9a70'], boss: ['#a83a4a', '#681f2a'],
};
export function drawRobotChar(g, o = {}) {
  const { x = 0, y = 0, s = 1, face = 1, t = 0, skin = 'blue', big = false, alert = false, alpha = 1, move = 0 } = o;
  const [c1, c2] = ROBOT_SKINS[skin] || ROBOT_SKINS.blue;
  const sc = (big ? 1.25 : 1) * s;
  g.save(); g.translate(x, y); g.scale(sc * face, sc); g.globalAlpha *= alpha;
  g.fillStyle = '#2a2d33'; rr(g, -15, -10, 30, 10, 5); g.fill(); g.fillStyle = '#4a4f58'; for (let i = -10; i <= 10; i += 10) { g.beginPath(); g.arc(i, -5, 3, 0, 7); g.fill(); }
  g.fillStyle = c2; rr(g, -13, -44, 26, 36, 7); g.fill(); g.fillStyle = lin(g, -11, -46, 11, -14, c1, c2); rr(g, -11, -46, 22, 32, 6); g.fill();
  g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(-9, -44, 5, 26);
  if (skin === 'police') { g.fillStyle = '#e8c64a'; g.beginPath(); g.moveTo(2, -36); g.lineTo(6, -28); g.lineTo(0, -24); g.lineTo(-4, -28); g.closePath(); g.fill(); }
  g.strokeStyle = c2; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(8, -36); g.lineTo(16 + Math.sin(t * 6) * move * 3, -24); g.stroke();
  g.fillStyle = c2; rr(g, -12, -62, 24, 20, 9); g.fill(); g.fillStyle = c1; rr(g, -10, -62, 20, 17, 8); g.fill();
  g.fillStyle = '#10141c'; rr(g, -2, -58, 12, 9, 4); g.fill(); g.fillStyle = alert ? '#ff3a3a' : (big ? '#ff9a3a' : '#7affc8'); g.beginPath(); g.arc(6, -53.5, 3, 0, 7); g.fill();
  g.fillStyle = '#2a2d33'; g.fillRect(-1, -70, 2, 8); g.fillStyle = alert ? '#ff3a3a' : '#e8c64a'; g.beginPath(); g.arc(0, -71, 3, 0, 7); g.fill();
  if (big) { g.strokeStyle = '#2a2d33'; g.lineWidth = 3; g.strokeRect(-12, -44, 24, 36); }
  g.restore();
}

// ---------------------------------------------------------------- Chinese agent (met pet)
export function drawCop(g, o = {}) {
  const { x = 0, y = 0, s = 1, face = 1, t = 0, alpha = 1, chinese = true } = o;
  g.save(); g.translate(x, y); g.scale(s * face, s); g.globalAlpha *= alpha;
  g.fillStyle = '#15171c'; rr(g, -9, -4, 9, 5, 2); g.fill(); rr(g, 1, -4, 9, 5, 2); g.fill();
  g.fillStyle = '#1f2a44'; g.fillRect(-8, -26, 7, 23); g.fillRect(1, -26, 7, 23);
  g.fillStyle = lin(g, -12, -52, 12, -22, '#3a5aa8', '#1f3066'); rr(g, -12, -54, 24, 32, 6); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#e8c64a'; g.beginPath(); g.arc(6, -44, 3, 0, 7); g.fill(); g.fillStyle = '#2a3340'; g.fillRect(-12, -30, 24, 3);
  g.strokeStyle = '#3a5aa8'; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath(); g.moveTo(9, -48); g.lineTo(15, -34); g.stroke(); g.fillStyle = SKIN; g.beginPath(); g.arc(15, -32, 3.5, 0, 7); g.fill();
  g.fillStyle = chinese ? '#f0d0a0' : SKIN; g.beginPath(); g.arc(0, -62, 10, 0, 7); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#10141c'; g.fillRect(-5, -64, 3, 2); g.fillRect(3, -64, 3, 2);
  g.fillStyle = '#1f3066'; rr(g, -12, -76, 24, 9, 3); g.fill(); g.fillStyle = '#e8c64a'; g.beginPath(); g.arc(0, -72, 2.4, 0, 7); g.fill(); g.fillStyle = '#10141c'; g.fillRect(-13, -68, 26, 3);
  g.restore();
}

// ---------------------------------------------------------------- vliegtuig (van opzij, kijkt naar rechts)
export function drawPlane(g, o = {}) {
  const { x = 0, y = 0, s = 1, tilt = 0, t = 0, smoke = false, fire = false, gnome = true } = o;
  g.save(); g.translate(x, y); g.rotate(tilt); g.scale(s, s);
  g.fillStyle = lin(g, 0, -26, 0, 26, '#f4f6f8', '#b4bcc6'); g.beginPath(); g.moveTo(-110, -6); g.quadraticCurveTo(-110, -26, -70, -26); g.lineTo(70, -24); g.quadraticCurveTo(122, -18, 128, 2); g.quadraticCurveTo(110, 24, 60, 24); g.lineTo(-70, 24); g.quadraticCurveTo(-110, 24, -110, -6); g.fill();
  g.strokeStyle = OUT; g.lineWidth = 2.5; g.stroke();
  g.fillStyle = '#d03a2a'; g.beginPath(); g.moveTo(-110, -6); g.lineTo(-128, -52); g.lineTo(-96, -48); g.lineTo(-70, -26); g.quadraticCurveTo(-108, -26, -110, -6); g.fill(); g.strokeStyle = OUT; g.stroke();
  g.fillStyle = '#8ac8f0'; for (let i = 0; i < 9; i++) { rr(g, -62 + i * 14, -14, 8, 9, 3); g.fill(); }
  g.fillStyle = '#5a9ad0'; g.beginPath(); g.moveTo(84, -20); g.quadraticCurveTo(112, -18, 120, -4); g.lineTo(84, -4); g.fill();
  g.fillStyle = '#c4c8d0'; g.beginPath(); g.moveTo(-10, 12); g.lineTo(30, 12); g.lineTo(-30, 62); g.lineTo(-52, 62); g.closePath(); g.fill(); g.strokeStyle = OUT; g.stroke();
  g.fillStyle = '#7a808a'; rr(g, -10, 30, 34, 12, 6); g.fill();
  g.fillStyle = '#d03a2a'; g.fillRect(-50, 2, 100, 4);
  if (smoke) { for (let i = 0; i < 12; i++) { const k = i / 12; g.fillStyle = `rgba(40,40,44,${0.55 - k * 0.5})`; g.beginPath(); g.arc(-130 - i * 26 + Math.sin(t * 4 + i) * 4, -4 + Math.cos(i + t * 3) * 6, 10 + i * 4.5, 0, 7); g.fill(); } }
  if (fire) { for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ffb02a' : '#ff5a1a'; g.beginPath(); g.ellipse(20 + i * 3, 36 + Math.sin(t * 20 + i) * 3, 9 - i, 14 - i * 1.5, 0, 0, 7); g.fill(); } }
  g.restore();
}

// ---------------------------------------------------------------- losse voorwerpen
export function drawMoneyBag(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = lin(g, -14, -26, 14, 0, '#c8a45a', '#8a6a34'); g.beginPath(); g.moveTo(-8, -28); g.quadraticCurveTo(-24, -20, -16, 0); g.lineTo(16, 0); g.quadraticCurveTo(24, -20, 8, -28); g.closePath(); g.fill();
  g.strokeStyle = '#4a3410'; g.lineWidth = 2; g.stroke(); g.fillStyle = '#4a3410'; g.font = '700 15px Fredoka, sans-serif'; g.textAlign = 'center'; g.fillText('$', 0, -8);
  g.fillStyle = '#e8c64a'; g.fillRect(-6, -31, 12, 4); g.restore();
}
export function drawSuitcase(g, x, y, s = 1, c = '#3a6a9a') {
  g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = lin(g, -16, -32, 16, 0, c, '#1f3f5f'); rr(g, -16, -32, 32, 32, 4); g.fill(); g.strokeStyle = OUT; g.lineWidth = 2; g.stroke();
  g.fillStyle = '#9aa4ae'; g.fillRect(-6, -37, 12, 5); g.fillStyle = '#e8c64a'; g.fillRect(-16, -18, 32, 3); g.restore();
}
