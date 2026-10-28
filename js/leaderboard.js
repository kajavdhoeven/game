// Gedeelde tijden-ranglijst voor de levelgames, en wie er is ingelogd. De naam is altijd de gebruikersnaam van het platform.
let ident = null; // { name, id } als de speler is ingelogd
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin) return;
  const m = e.data;
  if (m && m.type === 'teun:user') ident = m.name ? { name: m.name, id: m.id || null } : null;
});
export const getIdent = () => ident;
export const loggedIn = () => !!ident;

export function askLogin() {
  if (window.parent !== window) { try { window.parent.postMessage({ type: 'teun:login' }, location.origin); } catch (e) { /* geen ouder */ } }
  else location.href = '/?login=1';
}

export function fmtTime(s) {
  if (s >= 60) { const m = Math.floor(s / 60); return `${m}:${(s - m * 60).toFixed(1).padStart(4, '0')}`; }
  return `${s.toFixed(2)} s`;
}

// stuurt jouw tijd naar de ranglijst (alleen als je bent ingelogd)
export async function submitTime(game, level, seconds) {
  if (!ident || !ident.id) return { skipped: 'guest' };
  try {
    const r = await fetch('/api/time', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ game, level: String(level), time: seconds, uid: ident.id, name: ident.name }) });
    return r.ok ? { ok: true } : { error: r.status };
  } catch (e) { return { error: 'offline' }; }
}

let ov = null;
const css = `
.teun-lb-ov { position: fixed; inset: 0; z-index: 2147483003; display: grid; place-items: center; background: rgba(4,10,28,.72); padding: 14px; font-family: 'Fredoka', 'Outfit', system-ui, sans-serif; touch-action: manipulation; user-select: none; -webkit-user-select: none; }
.teun-lb { width: min(460px, 100%); max-height: 92vh; display: flex; flex-direction: column; background: linear-gradient(180deg, #ffffff, #eaf2ff); color: #14224a; border: 4px solid #1d4ed8; border-radius: 22px; box-shadow: 0 16px 0 rgba(0,0,0,.18), 0 22px 60px rgba(0,0,0,.5); overflow: hidden; }
.teun-lb header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 6px; }
.teun-lb h3 { margin: 0; font-size: 24px; color: #0b3a9e; }
.teun-lb header button { border: 0; background: #dbe7ff; color: #0b3a9e; font-size: 20px; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; }
.teun-lb .chips { display: flex; gap: 6px; overflow-x: auto; padding: 4px 16px 8px; }
.teun-lb .chips button { flex: none; font: 600 14px 'Fredoka', system-ui, sans-serif; padding: 6px 12px; border-radius: 99px; border: 2px solid #1d4ed8; background: #fff; color: #0b3a9e; cursor: pointer; }
.teun-lb .chips button.on { background: #1d4ed8; color: #fff; }
.teun-lb .login { margin: 0 16px 8px; background: #fff3cd; border: 2px solid #ffc107; border-radius: 14px; padding: 10px 12px; font-weight: 600; font-size: 15px; display: flex; gap: 10px; align-items: center; justify-content: space-between; }
.teun-lb .login button { flex: none; font: 700 14px 'Fredoka', system-ui, sans-serif; padding: 7px 14px; border-radius: 10px; border: 2px solid #0b3a9e; background: linear-gradient(#ffe27a, #ffb81c); color: #0b3a9e; cursor: pointer; }
.teun-lb ol { list-style: none; margin: 0; padding: 0 16px 16px; overflow-y: auto; display: grid; gap: 6px; }
.teun-lb li { display: grid; grid-template-columns: 34px 1fr auto; gap: 10px; align-items: center; background: #fff; border-radius: 12px; padding: 8px 12px; font-weight: 600; box-shadow: 0 2px 0 rgba(11,58,158,.12); }
.teun-lb li.me { background: #fff3cd; outline: 2px solid #ffc107; }
.teun-lb li .rk { color: #5a6b99; font-weight: 700; }
.teun-lb li:nth-child(1) .rk { color: #d4a017; } .teun-lb li:nth-child(2) .rk { color: #8a94a6; } .teun-lb li:nth-child(3) .rk { color: #b9712e; }
.teun-lb li b { font-variant-numeric: tabular-nums; color: #0b3a9e; }
.teun-lb .empty { text-align: center; padding: 18px; color: #5a6b99; font-weight: 600; }`;

// levels: [{ key, label }]
export function openTimeBoard({ game, title, levels, start }) {
  if (ov) return;
  window.dispatchEvent(new Event('teun:pause'));
  if (!document.getElementById('teunLbCss')) { const st = document.createElement('style'); st.id = 'teunLbCss'; st.textContent = css; document.head.appendChild(st); }
  let cur = levels.find((l) => String(l.key) === String(start)) || levels[0];
  ov = document.createElement('div');
  ov.className = 'teun-lb-ov';
  ['keydown', 'keyup', 'keypress', 'pointerdown', 'pointerup', 'touchstart', 'touchend'].forEach((t) => ov.addEventListener(t, (e) => { e.stopPropagation(); if (t === 'keydown' && e.key === 'Escape') close(); }));
  document.body.appendChild(ov);
  const close = () => { if (ov) { ov.remove(); ov = null; window.dispatchEvent(new Event('teun:resume')); } };
  const load = async () => {
    const list = ov.querySelector('ol');
    list.innerHTML = '<div class="empty">Laden...</div>';
    try {
      const r = await fetch(`/api/times?game=${encodeURIComponent(game)}&level=${encodeURIComponent(cur.key)}`);
      if (!r.ok) throw new Error('http ' + r.status);
      const { times } = await r.json();
      list.innerHTML = times.length ? '' : '<div class="empty">Nog geen tijden. Wees de eerste!</div>';
      times.forEach((t, i) => {
        const li = document.createElement('li');
        if (ident && ident.id && t.uid === ident.id.slice(0, 8)) li.className = 'me';
        li.innerHTML = `<span class="rk">${i + 1}</span><span></span><b>${fmtTime(t.time)}</b>`;
        li.children[1].textContent = t.name || 'Naamloos';
        list.appendChild(li);
      });
    } catch (e) { list.innerHTML = '<div class="empty">De ranglijst is nu niet bereikbaar.</div>'; }
  };
  const paint = () => {
    ov.innerHTML = `<div class="teun-lb" role="dialog" aria-label="Leaderboard ${title}"><header><h3>🏆 ${title}</h3><button aria-label="Sluiten">&times;</button></header>
      <div class="chips">${levels.map((l) => `<button data-k="${l.key}" class="${String(l.key) === String(cur.key) ? 'on' : ''}">${l.label}</button>`).join('')}</div>
      ${ident ? '' : '<div class="login"><span>Wil je inloggen? Dan komt jouw tijd op het leaderboard.</span><button data-a="login">Inloggen</button></div>'}
      <ol></ol></div>`;
    ov.querySelector('header button').onclick = close;
    ov.querySelectorAll('.chips button').forEach((b) => { b.onclick = () => { cur = levels.find((l) => String(l.key) === b.dataset.k); paint(); }; });
    const lg = ov.querySelector('[data-a=login]');
    if (lg) lg.onclick = () => { close(); askLogin(); };
    load();
  };
  paint();
}
