// Laat de server weten dat deze bezoeker op de site is (zonder naam of andere gegevens), zodat de beheerder kan zien hoeveel mensen er nu zijn.
// Alleen een willekeurig nummer van dit apparaat, of je bent ingelogd en (als je bent ingelogd) je gebruikersnaam en op welke pagina je bent. De namen zijn alleen voor beheerders te zien.
let cid = '';
try { cid = localStorage.getItem('teun-cid') || ''; } catch (e) { /* geen opslag */ }
if (!/^[\w-]{8,40}$/.test(cid)) {
  cid = (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^\w-]/g, '').slice(0, 36);
  try { localStorage.setItem('teun-cid', cid); } catch (e) { /* geen opslag */ }
}
let info = () => ({});
// speelt hij nu? Dat is zo als hij op een gamepagina staat en de game is gestart
const playingNow = () => {
  const m = location.pathname.match(/^\/g\/([\w-]+)/);
  return m && document.querySelector('#player.playing') ? m[1] : '';
};
const send = (extra = {}) => {
  try { fetch('/api/ping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cid, ...info(), path: location.pathname, playing: playingNow(), ...extra }), keepalive: true }).catch(() => {}); } catch (e) { /* offline */ }
};
// speeltijd: de browser telt zelf de seconden dat er een game draait en de pagina in beeld is, en geeft die door (zo gaat er niets verloren tussen twee meldingen)
let acc = 0, accGame = '';
const flush = (extra = {}) => {
  if (acc > 0 && accGame) { send({ play: { game: accGame, sec: acc }, ...extra }); acc = 0; return true; }
  return false;
};
export const pingNow = () => { if (!document.hidden && !flush()) send(); };
export function startPresence(infoFn) {
  info = infoFn;
  send();
  setInterval(() => {
    if (document.hidden) return;
    const g = playingNow();
    if (g) { if (accGame && g !== accGame) flush(); accGame = g; acc++; if (acc >= 20) flush(); }
    else if (acc > 0) flush();
  }, 1000);
  setInterval(() => { if (!document.hidden && !flush()) send(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!flush({ bye: true })) send({ bye: true }); } else send(); });
  window.addEventListener('pagehide', () => { if (!flush({ bye: true })) send({ bye: true }); });
}
