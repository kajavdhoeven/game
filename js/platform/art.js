// Alle tekeningen van het platform, als SVG in code. Te-Un is de hoofdpersoon.
let n = 0;
const uid = () => 'a' + (++n);

// Te-Un in zijn geheel (naar het officiele logo): rode muts, bruin haar, ronde zwarte bril,
// blauw shirt, zwarte broek en blauwe sneakers. opts.crop = 'face' toont alleen het hoofd.
export function teunSVG(opts = {}) {
  const p = uid();
  const view = opts.crop === 'face' ? '24 -10 152 168' : '0 -10 200 310';
  return `<svg class="teun ${opts.cls || ''}" viewBox="${view}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Te-Un de kabouter">
<defs>
  <linearGradient id="${p}hat" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4a4a"/><stop offset="1" stop-color="#b3101a"/></linearGradient>
  <linearGradient id="${p}tee" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b7cff"/><stop offset="1" stop-color="#1347c4"/></linearGradient>
  <radialGradient id="${p}skin" cx=".4" cy=".35" r=".85"><stop offset="0" stop-color="#ffdcc0"/><stop offset="1" stop-color="#e8a37c"/></radialGradient>
  <linearGradient id="${p}shoe" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f86ff"/><stop offset="1" stop-color="#1650d8"/></linearGradient>
  <linearGradient id="${p}pants" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#25262d"/><stop offset="1" stop-color="#0e0f13"/></linearGradient>
</defs>
<ellipse class="shadow" cx="100" cy="296" rx="56" ry="8" fill="rgba(0,0,0,.28)"/>
<g class="bob">
  <g class="legL"><rect x="71" y="222" width="25" height="52" rx="11" fill="url(#${p}pants)"/>
    <ellipse cx="76" cy="281" rx="27" ry="13" fill="url(#${p}shoe)"/><path d="M52 287 Q76 296 102 287 L102 291 Q76 300 52 291Z" fill="#f4f1e8"/>
    <path d="M62 276 L84 270 M60 281 L86 275" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="68" cy="274" rx="9" ry="3.6" fill="rgba(255,255,255,.35)"/></g>
  <g class="legR"><rect x="104" y="222" width="25" height="52" rx="11" fill="url(#${p}pants)"/>
    <ellipse cx="124" cy="281" rx="27" ry="13" fill="url(#${p}shoe)"/><path d="M98 287 Q124 296 150 287 L150 291 Q124 300 98 291Z" fill="#f4f1e8"/>
    <path d="M110 276 L132 270 M108 281 L134 275" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><ellipse cx="116" cy="274" rx="9" ry="3.6" fill="rgba(255,255,255,.35)"/></g>
  <g class="torso">
    <path d="M58 158 Q54 208 52 240 Q100 254 148 240 Q146 208 142 158 Q100 170 58 158Z" fill="url(#${p}tee)"/>
    <path d="M72 176 q28 8 56 0 M64 200 q36 10 72 0" stroke="rgba(0,0,40,.15)" stroke-width="3" fill="none"/>
    <path d="M82 158 Q100 176 118 158" stroke="rgba(255,255,255,.25)" stroke-width="3" fill="none"/>
    <rect x="52" y="214" width="96" height="13" rx="5" fill="#101114"/><rect x="90" y="211" width="20" height="19" rx="3" fill="#d7dbe0" stroke="#8a9098" stroke-width="2"/><rect x="95" y="216" width="10" height="9" rx="1.5" fill="#101114"/>
  </g>
  <g class="armL" style="transform-origin:66px 164px"><path d="M66 158 Q40 166 36 192 L58 200 Q62 182 78 174Z" fill="url(#${p}tee)"/><path d="M38 192 Q32 214 42 228 L60 220 Q56 206 58 198Z" fill="url(#${p}skin)"/><circle cx="48" cy="232" r="11" fill="url(#${p}skin)"/></g>
  <g class="armR" style="transform-origin:134px 164px"><path d="M134 158 Q160 166 164 192 L142 200 Q138 182 122 174Z" fill="url(#${p}tee)"/><path d="M162 192 Q168 214 158 228 L140 220 Q144 206 142 198Z" fill="url(#${p}skin)"/><circle cx="152" cy="232" r="11" fill="url(#${p}skin)"/></g>
  <g class="head">
    <path d="M56 128 L22 108 Q26 140 58 146Z" fill="url(#${p}skin)"/><path d="M144 128 L178 108 Q174 140 142 146Z" fill="url(#${p}skin)"/>
    <path d="M52 126 L34 116 Q38 134 54 138Z" fill="rgba(220,130,110,.45)"/><path d="M148 126 L166 116 Q162 134 146 138Z" fill="rgba(220,130,110,.45)"/>
    <ellipse cx="100" cy="126" rx="48" ry="47" fill="url(#${p}skin)"/>
    <ellipse cx="68" cy="142" rx="9" ry="7" fill="#ff8f86" opacity=".5"/><ellipse cx="132" cy="142" rx="9" ry="7" fill="#ff8f86" opacity=".5"/>
    <path d="M54 112 Q62 84 98 92 Q132 84 148 112 Q130 96 108 100 Q80 98 54 112Z" fill="#4a2f1f"/>
    <path d="M96 90 Q112 76 128 84 Q114 84 108 100Z" fill="#5a3924"/>
    <g class="eyes"><ellipse cx="80" cy="126" rx="10" ry="11" fill="#fff"/><ellipse cx="120" cy="126" rx="10" ry="11" fill="#fff"/>
      <circle cx="81" cy="127" r="7" fill="#3a6fb5"/><circle cx="121" cy="127" r="7" fill="#3a6fb5"/>
      <circle class="pupil" cx="81" cy="127" r="3.6" fill="#0c0d12"/><circle class="pupil" cx="121" cy="127" r="3.6" fill="#0c0d12"/>
      <circle cx="83" cy="124" r="2" fill="#fff"/><circle cx="123" cy="124" r="2" fill="#fff"/></g>
    <g fill="rgba(210,235,255,.14)" stroke="#0b0b0d" stroke-width="5"><circle cx="80" cy="126" r="18"/><circle cx="120" cy="126" r="18"/></g>
    <path d="M97 123 q3 -5 6 0" stroke="#0b0b0d" stroke-width="4" fill="none"/><path d="M62 122 L48 116 M138 122 L152 116" stroke="#0b0b0d" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="100" cy="142" rx="10" ry="9" fill="#e79882"/><ellipse cx="97" cy="139" rx="3.5" ry="2.4" fill="rgba(255,255,255,.5)"/>
    <path class="mouth" d="M86 158 Q100 168 114 158" stroke="#9a4a3a" stroke-width="3.4" fill="none" stroke-linecap="round"/>
    <path d="M44 106 Q50 52 96 24 C106 16 116 8 120 -4 C132 -10 144 0 136 14 C128 32 146 70 156 108 Q100 124 44 106Z" fill="url(#${p}hat)"/>
    <path d="M66 92 Q84 54 112 24" stroke="rgba(255,255,255,.26)" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M60 84 l10 7 M78 62 l10 7 M96 44 l9 6 M118 74 l-9 4 M132 96 l-10 4" stroke="rgba(0,0,0,.14)" stroke-width="3" stroke-linecap="round"/>
    <path d="M40 104 Q100 126 160 104 L160 112 Q100 134 40 112Z" fill="#b3101a"/>
  </g>
</g>
</svg>`;
}

// profielpictogrammen
export function avatarSVG(kind = 'teun') {
  if (kind === 'train') return trainAvatar();
  if (kind === 'puzzle') return `<div class="av-face">${teunSVG({ crop: 'face' })}${PIECE_BADGE}</div>`;
  if (kind === 'teun50k') return `<div class="av-face">${teunSVG({ crop: 'face' })}${MEDAL_BADGE}</div>`;
  if (kind === 'racer') return racerAvatar();
  if (kind === 'slider') return sliderAvatar();
  if (kind === 'schaver') return schaverAvatar();
  if (kind === 'lambo') return lamboAvatar();
  if (kind === 'diamant') return diamantAvatar();
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

// puzzelstukje dat Te-Un vasthoudt (profielfoto uit Te-Un Puzzel)
const PIECE_BADGE = `<svg class="av-piece" viewBox="0 0 64 64" aria-hidden="true"><path d="M8 16h15a8 8 0 1 1 18 0h15v15a8 8 0 1 0 0 18v15H41a8 8 0 1 0-18 0H8V49a8 8 0 1 0 0-18z" fill="#ffc917" stroke="#0b3a99" stroke-width="4" stroke-linejoin="round"/><path d="M18 24h10M18 30h6" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".7"/></svg>`;
// gouden 50K-medaille (profielfoto voor 50.000 punten in Te-Un Surfers)
const MEDAL_BADGE = `<svg class="av-piece" viewBox="0 0 64 64" aria-hidden="true"><path d="M20 4h10l4 14H24zM44 4H34l-4 14h10z" fill="#d7191f" stroke="#7a0d12" stroke-width="2"/><circle cx="32" cy="40" r="20" fill="#ffc917" stroke="#8a5a00" stroke-width="4"/><circle cx="32" cy="40" r="14" fill="none" stroke="#fff3b0" stroke-width="2"/><text x="32" y="46" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="15" fill="#8a5a00">50K</text></svg>`;
// Te-Un als schuifpuzzel: 3x3 vakjes met een leeg vak en een paar verkeerd geschoven vakjes
function sliderAvatar() {
  const order = [1, 0, 2, 3, 7, 5, 6, null, 4]; // positie -> welk stukje van het plaatje (null = leeg vak)
  const cells = order.map((src, pos) => {
    const pos_ = `left:${(pos % 3) * 33.34}%;top:${Math.floor(pos / 3) * 33.34}%`;
    if (src === null) return `<div class="st empty" style="${pos_}"></div>`;
    const sx = (src % 3) * 50, sy = Math.floor(src / 3) * 50;
    return `<div class="st" style="${pos_}"><div class="si" style="left:-${sx * 2}%;top:-${sy * 2}%">${teunSVG({ crop: 'face' })}</div></div>`;
  });
  return `<div class="av-face slide">${cells.join('')}</div>`;
}

// Hermano's fiets met de tekst "OUTFITJE 52K" (profielfoto uit Te-Un Drive)
function schaverAvatar() {
  return `<svg class="avsvg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Flinke schaver gemaakt">
<defs><linearGradient id="shbg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd86b"/><stop offset="1" stop-color="#ff8a3d"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#shbg)"/>
<path d="M0 80 L100 80 L100 100 L0 100Z" fill="#6b5a48"/><path d="M0 80 L100 80" stroke="#3c3126" stroke-width="2"/>
<path d="M12 90h14M60 94h22M34 92h8" stroke="#3c3126" stroke-width="2" stroke-linecap="round" opacity=".5"/>
<g fill="none" stroke="#15110e" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
<circle cx="27" cy="68" r="14" fill="rgba(0,0,0,.08)"/><circle cx="75" cy="68" r="14" fill="rgba(0,0,0,.08)"/>
<path d="M27 68 L44 50 L66 50 L75 68 M44 50 L50 68 L27 68 M66 50 L62 42 M58 42 L68 42"/>
<path d="M44 50 L41 43 M36 43 L47 43" />
</g>
<g stroke="#d7191f" stroke-width="3" stroke-linecap="round" fill="none"><path d="M47 56 L62 56"/><path d="M50 68 L72 52" opacity="0"/></g>
<path d="M18 74 l6 -3 M22 78 l8 -4 M80 72 l6 3 M84 66 l5 2" stroke="#e8423a" stroke-width="2" stroke-linecap="round" opacity=".85"/>
<text x="50" y="26" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="14.5" fill="#ffd23a" stroke="#b3121c" stroke-width="3.2" paint-order="stroke" transform="rotate(-4 50 20)">OUTFITJE</text>
<text x="50" y="42" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="15" fill="#ffd23a" stroke="#b3121c" stroke-width="3.2" paint-order="stroke" transform="rotate(-4 50 36)">52K</text>
</svg>`;
}

// Te-Un in een Lamborghini (profielfoto voor alle auto's uit Te-Un Drive)
function lamboAvatar() {
  return `<div class="av-face lambo" style="background:linear-gradient(180deg,#27304a,#6a7aa8 62%,#3a3f4a 62%)">
<div style="position:absolute;left:31%;top:12%;width:40%;height:44%">${teunSVG({ crop: 'face' })}</div>
<svg class="avsvg" style="position:absolute;inset:0" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Te-Un in een Lamborghini">
<defs><linearGradient id="lbody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe94a"/><stop offset="1" stop-color="#e3a400"/></linearGradient></defs>
<path d="M2 58 L98 58" stroke="#8a90a6" stroke-width="1" opacity=".5"/>
<path d="M6 78 L8 66 Q12 62 30 60 L46 52 Q58 49 70 56 L92 62 Q98 66 97 78 Z" fill="url(#lbody)" stroke="#15110e" stroke-width="2.6" stroke-linejoin="round"/>
<path d="M30 60 L46 52 Q54 51 60 54 L52 60 Z" fill="#12151c" stroke="#15110e" stroke-width="2"/>
<path d="M14 70 L90 68" stroke="#b37a00" stroke-width="1.6"/><path d="M72 62 L92 64 L90 70 L70 68Z" fill="#c78d00" opacity=".6"/>
<path d="M88 72 L96 72" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/><rect x="6" y="70" width="6" height="3" fill="#ff3b30"/>
<circle cx="26" cy="79" r="10" fill="#15110e"/><circle cx="26" cy="79" r="5.5" fill="#cfd4da"/><circle cx="26" cy="79" r="2" fill="#15110e"/>
<circle cx="76" cy="79" r="10" fill="#15110e"/><circle cx="76" cy="79" r="5.5" fill="#cfd4da"/><circle cx="76" cy="79" r="2" fill="#15110e"/>
</svg></div>`;
}

// Te-Un met een diamant en een zonnebril, want het schittert te hard (profielfoto uit VuurTe-Un & WaterTe-Un)
function diamantAvatar() {
  return `<div class="av-face" style="background:linear-gradient(160deg,#fff6b8,#ffb43c)">${teunSVG({ crop: 'face' })}
<svg class="avsvg" style="position:absolute;inset:0" viewBox="24 -10 152 168" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Te-Un met diamant en zonnebril">
<g stroke="#ffe27a" stroke-width="4" stroke-linecap="round" opacity=".9"><path d="M30 2 L44 14M26 26 L42 30M52 -6 L56 10M160 6 L146 16"/></g>
<circle cx="32" cy="10" r="12" fill="#fff3a0" opacity=".85"/>
<g fill="#0c0d12" stroke="#0b0b0d" stroke-width="5"><ellipse cx="80" cy="126" rx="19" ry="16"/><ellipse cx="120" cy="126" rx="19" ry="16"/></g>
<path d="M99 124 L101 124" stroke="#0b0b0d" stroke-width="5"/>
<path d="M68 118 L78 112M108 118 L118 112" stroke="#fff" stroke-width="3.5" stroke-linecap="round" opacity=".6"/>
<g transform="translate(128 142) scale(.62)"><path d="M0 -26 L22 -8 L0 26 L-22 -8Z" fill="#38a6ff" stroke="#0b0b0d" stroke-width="3.5" stroke-linejoin="round"/><path d="M0 -26 L22 -8 L0 -8Z" fill="#b4e3ff"/><path d="M0 -8 L22 -8 L0 26Z" fill="#0d6ad0"/><path d="M0 -26 L-22 -8 L0 -8Z" fill="#8ccfff"/>
<path d="M-30 -22 l8 4M30 -28 l-6 6M-6 -34 v8" stroke="#fff" stroke-width="3" stroke-linecap="round"/></g>
</svg></div>`;
}

// Te-Un Racer: motorhelm met klep en bril
function racerAvatar() {
  return `<svg class="avsvg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Te-Un Racer">
<defs><linearGradient id="rbg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb4a8"/><stop offset="1" stop-color="#ff6a5a"/></linearGradient><linearGradient id="rhelm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a52"/><stop offset=".55" stop-color="#d7191f"/><stop offset="1" stop-color="#8f0d12"/></linearGradient></defs>
<rect width="100" height="100" fill="url(#rbg)"/>
<path d="M14 100 Q16 74 50 72 Q84 74 86 100Z" fill="#d7191f" stroke="#16110e" stroke-width="3"/><path d="M50 74v26" stroke="#fff" stroke-width="2.5"/>
<ellipse cx="53" cy="52" rx="24" ry="24" fill="#efb18d" stroke="#16110e" stroke-width="3"/>
<path d="M74 50 Q78 20 46 20 Q18 20 20 50 Q20 74 40 76 L46 66 L46 50 L66 50Z" fill="url(#rhelm)" stroke="#16110e" stroke-width="3" stroke-linejoin="round"/>
<path d="M30 40 Q46 20 70 34" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>
<rect x="48" y="43" width="28" height="15" rx="6" fill="#16181c" stroke="#16110e" stroke-width="2"/><rect x="51" y="46" width="22" height="9" rx="4" fill="#7cc7ff"/><path d="M53 54l4-8h3l-4 8z" fill="#fff" opacity=".7"/>
<path d="M46 70 Q64 78 78 62 L74 58 Q64 68 50 64Z" fill="#d7191f" stroke="#16110e" stroke-width="3" stroke-linejoin="round"/>
<path d="M46 26 L88 24 Q94 26 88 32 L56 33Z" fill="#b3121c" stroke="#16110e" stroke-width="3" stroke-linejoin="round"/>
</svg>`;
}

// Profielfoto's. Wie een vergrendelde wil, moet de opdracht in de game doen. 'check' krijgt de voortgang van die game.
const SURFERS_ALL = ['wheelchair', 'cow', 'train', 'skin_conductor', 'skin_photo', 'board_cow'];
export const AVATARS = [
  { id: 'teun', name: 'Te-Un', desc: 'De kabouter zelf' },
  { id: 'train', name: 'NS-trein', desc: 'Een gele trein', unlock: { game: 'te-un-surfers', how: 'Koop alles in de winkel van Te-Un Surfers', check: (d) => SURFERS_ALL.every((k) => d.owned && d.owned[k]) } },
  { id: 'teun50k', name: 'Te-Un 50K', desc: 'Te-Un met gouden medaille', unlock: { game: 'te-un-surfers', how: 'Haal 50.000 punten in Te-Un Surfers', check: (d) => (d.best || 0) >= 50000 } },
  { id: 'puzzle', name: 'Puzzel-Te-Un', desc: 'Te-Un met puzzelstukje', unlock: { game: 'te-un-puzzel', how: 'Maak alle 4 de levels van Te-Un Puzzel af binnen de tijd (30 sec, 1 min, 2,5 min en 10 min)', check: (d) => [1, 2, 3, 4].every((n) => d.fast && d.fast[n]) } },
  { id: 'slider', name: 'Schuif-Te-Un', desc: 'Te-Un als schuifpuzzel, met een paar verkeerd geschoven vakjes', unlock: { game: 'te-un-puzzel', how: 'Maak alle 4 de levels van de schuifpuzzel in Te-Un Puzzel af', check: (d) => [1, 2, 3, 4].every((n) => d.slide && d.slide[n]) } },
  { id: 'racer', name: 'Te-Un Racer', desc: 'Te-Un met motorhelm', unlock: { game: 'te-un-x3m', how: 'Haal 3 sterren op alle 25 levels van Te-Un X3M', check: (d) => Array.from({ length: 25 }, (_, i) => i + 1).every((n) => (d.stars && d.stars[n]) >= 3) } },
  { id: 'diamant', name: 'Te-Un met diamant', desc: 'Te-Un met een diamant en een zonnebril, want het schittert te hard', unlock: { game: 'vuur-water', how: 'Verzamel alle diamanten (rood en blauw) in alle 32 levels van VuurTe-Un & WaterTe-Un', check: (d) => Array.from({ length: 32 }, (_, i) => i + 1).every((n) => d.done && d.done[n] && d.done[n].all) } },
  { id: 'schaver', name: 'Flinke schaver gemaakt', desc: 'Hermano\'s fiets met OUTFITJE 52K', unlock: { game: 'te-un-drive', how: 'Ga een keer af met Hermano\'s fiets in Te-Un Drive', check: (d) => !!d.dev || !!d.bikeCrash } },
  { id: 'lambo', name: 'Te-Un in een Lambo', desc: 'Te-Un in een gele Lamborghini', unlock: { game: 'te-un-drive', how: 'Speel alle auto\'s vrij in Te-Un Drive (haal level 5, 15 en 20)', check: (d) => !!d.dev || [5, 15, 20].every((n) => d.done && d.done[n]) } },
];

// een profielfoto met een slot: de voortgang van de bijbehorende game bepaalt of hij open is
export function avatarUnlocked(a, progress) {
  if (!a.unlock) return true;
  return !!progress && !!a.unlock.check(progress);
}

// Het officiele logo staat in /assets/logo-256.png. Ontbreekt het bestand, dan tekenen we de kabouter zelf.
const LOGO_FALLBACK = `<svg class="logo-mark" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs><linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5252"/><stop offset="1" stop-color="#b3121c"/></linearGradient></defs>
<path d="M16 38 Q18 20 34 6 C38 2 44 4 42 10 C38 18 46 28 50 38 Q33 46 16 38 Z" fill="url(#lg1)"/>
<path d="M13 37 Q33 50 53 37 L53 44 Q33 58 12 44 Z" fill="#7a4a22"/><circle cx="43" cy="6" r="4.5" fill="#fff"/>
<g fill="none" stroke="#0b0b0d" stroke-width="3"><circle cx="26" cy="46" r="6"/><circle cx="40" cy="46" r="6"/></g>
<path d="M18 50 Q33 70 48 50 Q42 56 33 56 Q24 56 18 50 Z" fill="#fff"/></svg>`;
export function bigLogo(cls = '') {
  return `<img class="big-logo ${cls}" src="/assets/logo-wide.png" alt="Te-Un Games" width="819" height="559" fetchpriority="high" decoding="async">`;
}

export function logoSVG() {
  const fb = encodeURIComponent(LOGO_FALLBACK.replace('class="logo-mark" ', ''));
  return `<img class="logo-mark" src="/assets/logo-256.png" alt="Te-Un Games logo" width="64" height="64" decoding="async" onerror="this.onerror=null;this.src='data:image/svg+xml,${fb}'">`;
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
