// Alle tekeningen van het platform, als SVG in code. Te-Un is de hoofdpersoon.
let n = 0;
const uid = () => 'a' + (++n);

// Te-Un in zijn geheel. opts.crop = 'face' geeft alleen hoofd en muts (voor profielpictogrammen).
export function teunSVG(opts = {}) {
  const p = uid();
  const view = opts.crop === 'face' ? '22 -6 156 176' : '0 -8 200 308';
  return `<svg class="teun ${opts.cls || ''}" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Te-Un de kabouter">
<defs>
  <linearGradient id="${p}hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5252"/><stop offset="1" stop-color="#b3121c"/></linearGradient>
  <linearGradient id="${p}tun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#47bd77"/><stop offset="1" stop-color="#1d7545"/></linearGradient>
  <radialGradient id="${p}skin" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#ffe2c4"/><stop offset="1" stop-color="#eaa982"/></radialGradient>
  <linearGradient id="${p}shoe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6bb8ff"/><stop offset="1" stop-color="#1d63d8"/></linearGradient>
  <linearGradient id="${p}beard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d9e1ea"/></linearGradient>
  <linearGradient id="${p}scarf" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#f0a418"/></linearGradient>
</defs>
<ellipse class="shadow" cx="100" cy="294" rx="54" ry="8" fill="rgba(0,0,0,.28)"/>
<g class="bob">
  <g class="legL"><rect x="72" y="224" width="22" height="46" rx="10" fill="#7a5232"/><rect x="72" y="258" width="22" height="12" fill="#fff"/>
    <ellipse cx="78" cy="278" rx="24" ry="12" fill="url(#${p}shoe)"/><ellipse cx="78" cy="287" rx="25" ry="4.5" fill="#f3efe4"/><ellipse cx="70" cy="273" rx="9" ry="4" fill="rgba(255,255,255,.5)"/></g>
  <g class="legR"><rect x="106" y="224" width="22" height="46" rx="10" fill="#7a5232"/><rect x="106" y="258" width="22" height="12" fill="#fff"/>
    <ellipse cx="122" cy="278" rx="24" ry="12" fill="url(#${p}shoe)"/><ellipse cx="122" cy="287" rx="25" ry="4.5" fill="#f3efe4"/><ellipse cx="114" cy="273" rx="9" ry="4" fill="rgba(255,255,255,.5)"/></g>
  <g class="torso">
    <path d="M60 156 Q56 214 50 240 Q100 256 150 240 Q144 214 140 156 Z" fill="url(#${p}tun)"/>
    <path d="M70 170 q30 10 60 0 M66 190 q34 12 68 0 M60 224 q40 14 80 0" stroke="rgba(0,0,0,.12)" stroke-width="3" fill="none"/>
    <rect x="56" y="204" width="88" height="13" rx="5" fill="#7a4a22"/><rect x="92" y="201" width="16" height="19" rx="3" fill="#f2c230" stroke="#b88512" stroke-width="2"/>
    <circle cx="100" cy="176" r="3.2" fill="#e6d29a"/><circle cx="100" cy="190" r="3.2" fill="#e6d29a"/>
  </g>
  <g class="armL" style="transform-origin:64px 166px"><path d="M64 160 Q40 176 38 214 L56 218 Q58 190 74 176 Z" fill="url(#${p}tun)"/><circle cx="46" cy="222" r="12" fill="#fff"/><circle cx="36" cy="214" r="5.5" fill="#fff"/></g>
  <g class="armR" style="transform-origin:136px 166px"><path d="M136 160 Q160 176 162 214 L144 218 Q142 190 126 176 Z" fill="url(#${p}tun)"/><circle cx="154" cy="222" r="12" fill="#fff"/><circle cx="164" cy="214" r="5.5" fill="#fff"/></g>
  <path d="M142 162 q22 4 24 30 q-14 -14 -26 -10 z" fill="url(#${p}scarf)" class="scarftail"/>
  <ellipse cx="100" cy="160" rx="46" ry="13" fill="url(#${p}scarf)"/><path d="M60 158 q40 18 80 0" stroke="rgba(0,0,0,.12)" stroke-width="3" fill="none"/>
  <g class="head">
    <path d="M58 124 L30 104 L60 140 Z" fill="url(#${p}skin)"/><path d="M142 124 L170 104 L140 140 Z" fill="url(#${p}skin)"/>
    <circle cx="100" cy="122" r="45" fill="url(#${p}skin)"/>
    <circle cx="70" cy="140" r="8" fill="#ff9a8a" opacity=".55"/><circle cx="130" cy="140" r="8" fill="#ff9a8a" opacity=".55"/>
    <g class="eyes"><ellipse cx="82" cy="122" rx="8" ry="9" fill="#fff"/><ellipse cx="118" cy="122" rx="8" ry="9" fill="#fff"/>
      <circle class="pupil" cx="83" cy="123" r="4.4" fill="#111"/><circle class="pupil" cx="119" cy="123" r="4.4" fill="#111"/>
      <circle cx="84.5" cy="121" r="1.5" fill="#fff"/><circle cx="120.5" cy="121" r="1.5" fill="#fff"/></g>
    <circle cx="100" cy="137" r="10" fill="#e48f7a"/><ellipse cx="97" cy="134" rx="3.5" ry="2.5" fill="rgba(255,255,255,.5)"/>
    <g fill="rgba(210,235,255,.18)" stroke="#0b0b0d" stroke-width="5"><circle cx="82" cy="122" r="16"/><circle cx="118" cy="122" r="16"/></g>
    <path d="M98 119 q2 -5 4 0" stroke="#0b0b0d" stroke-width="4" fill="none"/><path d="M66 120 L52 114 M134 120 L148 114" stroke="#0b0b0d" stroke-width="4" stroke-linecap="round"/>
    <path d="M72 109 q10 -5 18 0 M110 109 q10 -5 18 0" stroke="rgba(255,255,255,.8)" stroke-width="2" fill="none" stroke-linecap="round" opacity="0"/>
    <g class="beard"><path d="M54 134 Q48 196 100 246 Q152 196 146 134 Q128 160 100 158 Q72 160 54 134 Z" fill="url(#${p}beard)" stroke="#cdd6e1" stroke-width="2"/>
      <path d="M82 170 q8 22 18 40 M118 170 q-8 22 -18 40 M100 164 v56" stroke="#cdd6e1" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".7"/></g>
    <g fill="#fff" stroke="#cdd6e1" stroke-width="2"><ellipse cx="86" cy="150" rx="15" ry="7" transform="rotate(14 86 150)"/><ellipse cx="114" cy="150" rx="15" ry="7" transform="rotate(-14 114 150)"/></g>
    <path d="M50 100 Q54 62 92 30 C102 20 112 10 118 -2 C128 -8 140 0 132 14 C124 30 142 66 150 102 Q100 118 50 100 Z" fill="url(#${p}hat)"/>
    <path d="M70 86 Q86 52 112 22" stroke="rgba(255,255,255,.28)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M62 82 l10 6 M74 66 l10 6 M90 48 l9 6 M112 70 l-8 4" stroke="rgba(0,0,0,.12)" stroke-width="3" stroke-linecap="round"/>
    <path d="M47 99 Q100 120 153 99 L154 112 Q100 134 46 112 Z" fill="#7a4a22"/><rect x="92" y="108" width="16" height="12" rx="2" fill="#f2c230" stroke="#b88512" stroke-width="2" transform="rotate(0 100 114)"/>
    <circle cx="131" cy="4" r="8" fill="#fff"/>
  </g>
</g>
</svg>`;
}

// profielpictogrammen
export function avatarSVG(kind = 'teun') {
  if (kind === 'train') return trainAvatar();
  return `<div class="av-face">${teunSVG({ crop: 'face' })}</div>`;
}

function trainAvatar() {
  const p = uid();
  return `<svg class="avsvg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="NS-trein">
<defs><linearGradient id="${p}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd0ff"/><stop offset="1" stop-color="#e6f5ff"/></linearGradient>
<linearGradient id="${p}y" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffd23f"/><stop offset=".5" stop-color="#ffe276"/><stop offset="1" stop-color="#f2b814"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#${p}b)"/>
<path d="M0 78 L100 78 L100 100 L0 100 Z" fill="#7a7f86"/><path d="M10 100 L40 78 M90 100 L60 78" stroke="#c9ced4" stroke-width="3"/>
<rect x="22" y="14" width="56" height="64" rx="16" fill="url(#${p}y)" stroke="#c18f00" stroke-width="1.5"/>
<path d="M22 30 Q22 14 38 14 L62 14 Q78 14 78 30 L78 24 Q50 8 22 24 Z" fill="#cfd4d9"/>
<rect x="29" y="26" width="42" height="26" rx="7" fill="#0f1b2b"/><path d="M33 29 L46 29 L38 49 L33 49 Z" fill="rgba(255,255,255,.18)"/>
<rect x="38" y="19" width="24" height="5" rx="2" fill="#07101a"/><rect x="40" y="20.4" width="20" height="2.2" fill="#ffb347" opacity=".9"/>
<rect x="22" y="62" width="56" height="12" fill="#003082"/><rect x="42" y="55" width="16" height="9" rx="2" fill="#003082"/><text x="50" y="62.4" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-style="italic" font-size="7.6" fill="#fff">NS</text>
<circle cx="32" cy="68" r="3.4" fill="#fffbe0"/><circle cx="68" cy="68" r="3.4" fill="#fffbe0"/>
<circle cx="32" cy="68" r="7" fill="#fff6b0" opacity=".35"/><circle cx="68" cy="68" r="7" fill="#fff6b0" opacity=".35"/>
</svg>`;
}

export const AVATARS = [
  { id: 'teun', name: 'Te-Un', desc: 'De kabouter zelf' },
  { id: 'train', name: 'NS-trein', desc: 'Een gele trein' },
];

// Het officiele logo staat in /assets/logo.jpg. Ontbreekt het bestand, dan tekenen we de kabouter zelf.
const LOGO_FALLBACK = `<svg class="logo-mark" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5252"/><stop offset="1" stop-color="#b3121c"/></linearGradient></defs>
<path d="M16 38 Q18 20 34 6 C38 2 44 4 42 10 C38 18 46 28 50 38 Q33 46 16 38 Z" fill="url(#lg1)"/>
<path d="M13 37 Q33 50 53 37 L53 44 Q33 58 12 44 Z" fill="#7a4a22"/><circle cx="43" cy="6" r="4.5" fill="#fff"/>
<g fill="none" stroke="#0b0b0d" stroke-width="3"><circle cx="26" cy="46" r="6"/><circle cx="40" cy="46" r="6"/></g>
<path d="M18 50 Q33 70 48 50 Q42 56 33 56 Q24 56 18 50 Z" fill="#fff"/></svg>`;
export function logoSVG() {
  const fb = encodeURIComponent(LOGO_FALLBACK.replace('class="logo-mark" ', ''));
  return `<img class="logo-mark" src="/assets/logo.jpg" alt="Te-Un Games logo" width="64" height="64" decoding="async" onerror="this.onerror=null;this.src='data:image/svg+xml,${fb}'">`;
}

// ---------- easter eggs (originele figuren) ----------
export function ravagioEgg() {
  return `<svg viewBox="0 0 120 110" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Oranje shirtje met Ravagio">
<path d="M42 8 Q60 24 78 8 L108 26 L96 50 L84 44 L86 100 Q60 108 34 100 L36 44 L24 50 L12 26 Z" fill="#ff7a00" stroke="#c75500" stroke-width="3" stroke-linejoin="round"/>
<path d="M42 8 Q60 24 78 8" fill="none" stroke="#c75500" stroke-width="3"/><path d="M36 44 L34 100" stroke="rgba(0,0,0,.12)" stroke-width="2"/>
<text x="60" y="68" text-anchor="middle" font-family="Fredoka,Arial Black,Arial" font-weight="700" font-size="14" fill="#fff" stroke="#c75500" stroke-width=".6">Ravagio</text></svg>`;
}

export function blockEgg() {
  // blokfiguur met oranje korte haren, bril en een groen shirt (originele pixeltekening)
  const px = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  return `<svg viewBox="0 0 80 112" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="Blokfiguur met oranje haar en bril">
${px(24, 4, 32, 8, '#ff7a1a')}${px(20, 12, 40, 8, '#ff7a1a')}${px(20, 20, 8, 8, '#ff7a1a')}${px(52, 20, 8, 8, '#ff7a1a')}
${px(28, 20, 24, 8, '#f1c19a')}${px(20, 28, 40, 24, '#f1c19a')}
${px(24, 30, 14, 12, '#111')}${px(42, 30, 14, 12, '#111')}${px(27, 33, 8, 6, '#cfe8ff')}${px(45, 33, 8, 6, '#cfe8ff')}${px(38, 34, 4, 3, '#111')}
${px(34, 44, 12, 4, '#b8704a')}${px(14, 54, 52, 28, '#3aa83a')}${px(14, 54, 52, 4, '#2c8a2c')}${px(30, 54, 20, 6, '#f1c19a')}
${px(4, 54, 10, 28, '#f1c19a')}${px(66, 54, 10, 28, '#f1c19a')}${px(18, 82, 20, 26, '#3a4fb5')}${px(42, 82, 20, 26, '#3a4fb5')}${px(18, 104, 20, 6, '#555')}${px(42, 104, 20, 6, '#555')}</svg>`;
}

export function deerEgg() {
  return `<svg viewBox="0 0 140 130" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Hertje">
<ellipse cx="62" cy="86" rx="44" ry="26" fill="#b5733a"/>
<g fill="#fff3e0" opacity=".9"><circle cx="40" cy="78" r="3.2"/><circle cx="56" cy="70" r="3.2"/><circle cx="72" cy="76" r="3.2"/><circle cx="50" cy="90" r="3.2"/><circle cx="68" cy="94" r="3.2"/><circle cx="84" cy="86" r="3.2"/><circle cx="30" cy="92" r="3.2"/></g>
<g fill="#8f5527"><rect x="30" y="102" width="9" height="22" rx="4"/><rect x="48" y="104" width="9" height="20" rx="4"/><rect x="74" y="104" width="9" height="20" rx="4"/><rect x="90" y="100" width="9" height="24" rx="4"/></g>
<g fill="#4a2c14"><rect x="30" y="120" width="9" height="5" rx="2"/><rect x="48" y="120" width="9" height="5" rx="2"/><rect x="74" y="120" width="9" height="5" rx="2"/><rect x="90" y="120" width="9" height="5" rx="2"/></g>
<path d="M98 70 Q108 50 112 38" stroke="#b5733a" stroke-width="16" stroke-linecap="round" fill="none"/>
<ellipse cx="116" cy="36" rx="20" ry="17" fill="#c07d42"/><ellipse cx="128" cy="43" rx="11" ry="8" fill="#e9c9a0"/><ellipse cx="135" cy="42" rx="3.6" ry="3" fill="#2a1a10"/>
<ellipse cx="112" cy="30" rx="6.5" ry="7.5" fill="#fff"/><circle cx="114" cy="31" r="4.4" fill="#2a1a10"/><circle cx="115.4" cy="29.4" r="1.4" fill="#fff"/>
<path d="M102 22 Q90 6 84 14 Q90 28 104 28 Z" fill="#c07d42"/><path d="M104 20 Q94 10 90 15 Q94 24 103 25 Z" fill="#f3b3a6"/>
<path d="M118 22 Q128 4 138 10 Q134 26 122 28 Z" fill="#c07d42"/><path d="M120 22 Q128 10 134 13 Q132 22 123 25 Z" fill="#f3b3a6"/>
<path d="M18 80 Q8 76 10 66 Q20 70 22 80" fill="#fff3e0"/></svg>`;
}

export function categoryIcon(id) {
  const m = { actie: '⚡', arcade: '🕹️', avontuur: '🧭', puzzel: '🧩', racen: '🏎️', sport: '⚽', denken: '🧠', kinderen: '🧸', multiplayer: '👥' };
  return m[id] || '🎮';
}

const ICONS = {
  home: '<path d="M3 11 12 3l9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  flame: '<path d="M12 2s5 4 5 9a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-8zM8 16a4 4 0 0 0 8 0c0 3-2 5-4 5s-4-2-4-5z"/>',
  spark: '<path d="m12 2 2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>',
  heart: '<path d="M12 21s-8-5.2-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.8-8 11-8 11z"/>',
  grid: '<path d="M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z"/>',
  user: '<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm0 2c-5 0-9 2.5-9 6v2h18v-2c0-3.5-4-6-9-6z"/>',
  search: '<path d="M10 2a8 8 0 1 0 5 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12z"/>',
  palette: '<path d="M12 2a10 10 0 0 0 0 20c1.7 0 2.5-1 2.5-2.2 0-.8-.4-1.3-.4-2 0-1 .8-1.8 1.9-1.8H18a4 4 0 0 0 4-4C22 6 17.5 2 12 2zM7 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/>',
  play: '<path d="M8 4v16l13-8z"/>',
  fullscreen: '<path d="M4 4h6v2H6v4H4zm10 0h6v6h-2V6h-4zM4 14h2v4h4v2H4zm14 0h2v6h-6v-2h4z"/>',
  share: '<path d="M18 16a3 3 0 0 0-2.4 1.2l-6.3-3.2a3 3 0 0 0 0-2l6.3-3.2A3 3 0 1 0 15 7l-6.3 3.2a3 3 0 1 0 0 3.6L15 17a3 3 0 1 0 3-1z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z"/>',
  logout: '<path d="M10 3H4v18h6v-2H6V5h4zm5 4-1.4 1.4L16.2 11H8v2h8.2l-2.6 2.6L15 17l5-5z"/>',
  close: '<path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" fill="none"/>',
  eye: '<path d="M12 5c5 0 9 4.5 10 7-1 2.5-5 7-10 7S3 14.5 2 12c1-2.5 5-7 10-7zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"/>',
  trash: '<path d="M9 3h6l1 2h5v2H3V5h5zm-3 6h12l-1 12H7z"/>',
  edit: '<path d="M3 17.3V21h3.7L18 9.7 14.3 6zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8L18.9 8.8z"/>',
};
export function icon(name, size = 20) {
  return `<svg class="ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONS[name] || ''}</svg>`;
}
