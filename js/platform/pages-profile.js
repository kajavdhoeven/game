import { el, esc, fmt, ago, toast } from './ui.js';
import { avatarSVG, AVATARS, avatarUnlocked, icon, teunSVG } from './art.js';
import { api } from './api.js';

export async function renderProfile(app) {
  const { user, profile } = app.state;
  const f = document.createDocumentFragment();

  const head = el(`<section class="profile-head" data-egg-zone>
    <div class="avatar xl">${avatarSVG(profile ? profile.avatar : 'teun')}</div>
    <div><h1>${user ? esc(profile ? profile.username : '...') : 'Gast'}</h1>
    <p class="muted">${user ? `Lid sinds ${ago(profile && profile.created_at)}${profile && (profile.is_admin || profile.is_owner) ? ' · beheerder' : ''}` : 'Je speelt als gast. Maak een account om je voortgang te bewaren.'}</p></div>
    <div class="profile-teun">${teunSVG({ cls: 'wave' })}</div></section>`);
  f.appendChild(head);

  if (!user) {
    const g = el('<div class="card cta"><h3>Bewaar je voortgang</h3><p>Met een gratis account worden je munten, voertuigen en records bewaard en kies je je eigen profielpictogram.</p><button class="btn primary" id="pSign">Account maken</button> <button class="btn ghost" id="pLogin">Inloggen</button></div>');
    g.querySelector('#pSign').onclick = () => app.openAuth('signup');
    g.querySelector('#pLogin').onclick = () => app.openAuth('login');
    f.appendChild(g);
  }

  // profielpictogram
  if (user) {
    const sec = el('<section class="card"><h3>Profielpictogram</h3><p class="muted">Kies wie jij bent in het platform. Er komen meer pictogrammen bij met elke nieuwe game.</p><div class="avatar-grid"></div></section>');
    const grid = sec.querySelector('.avatar-grid');
    const progress = {};
    for (const a of AVATARS) if (a.unlock && !progress[a.unlock.game]) progress[a.unlock.game] = await api.getProgress(a.unlock.game).catch(() => null);
    AVATARS.forEach((a) => {
      const open = avatarUnlocked(a, a.unlock && progress[a.unlock.game]);
      const b = el(`<button class="av-opt ${profile && profile.avatar === a.id ? 'on' : ''} ${open ? '' : 'locked'}" data-id="${a.id}"><div class="avatar lg">${avatarSVG(a.id)}</div><b>${esc(a.name)}${open ? '' : ' 🔒'}</b><small>${esc(a.desc)}</small></button>`);
      b.addEventListener('click', async () => {
        if (!open) { toast('Nog vergrendeld: ' + a.desc + '.'); return app.go(a.unlock.link); }
        if (!app.can('can_edit_profile')) return toast('Je mag je profiel niet aanpassen.');
        await app.updateProfile({ avatar: a.id });
        grid.querySelectorAll('.av-opt').forEach((x) => x.classList.toggle('on', x === b));
        head.querySelector('.avatar').innerHTML = avatarSVG(a.id);
        toast('Pictogram aangepast!');
      });
      grid.appendChild(b);
    });
    f.appendChild(sec);

    const name = el(`<section class="card"><h3>Gebruikersnaam</h3><form class="inline-form"><input id="uname" maxlength="14" value="${esc(profile ? profile.username : '')}" autocomplete="off"><button class="btn primary small" type="submit">Opslaan</button></form></section>`);
    name.querySelector('form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = name.querySelector('#uname').value.replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 14);
      if (v.length < 2) return toast('Kies een naam van minstens 2 tekens.');
      if (!app.can('can_edit_profile')) return toast('Je mag je profiel niet aanpassen.');
      await app.updateProfile({ username: v });
      head.querySelector('h1').textContent = v;
      toast('Naam opgeslagen!');
    });
    f.appendChild(name);
  }

  // voortgang
  if (user) {
    const prog = await api.allProgress();
    const sec = el('<section class="card"><h3>Mijn games</h3><div class="mygames"></div></section>');
    const box = sec.querySelector('.mygames');
    const mine = app.state.games.filter((g) => prog[g.id] || app.state.likes.has(g.id));
    if (!mine.length) box.innerHTML = '<p class="muted">Je hebt nog niets gespeeld. Probeer Te-Un Surfers!</p>';
    mine.forEach((g) => {
      const d = prog[g.id] || {};
      box.appendChild(el(`<a class="mygame" href="/g/${esc(g.id)}"><div class="mg-img" style="background-image:url('${esc(g.thumb)}')"></div>
        <div><b>${esc(g.title)}</b><small>${d.best != null ? `Record ${fmt(d.best)} · ${fmt(d.coins)} munten · ${fmt(d.runs)} rondes` : 'Nog niet gespeeld'}</small></div>
        ${app.state.likes.has(g.id) ? `<span class="liked-mark">${icon('heart', 18)}</span>` : ''}</a>`));
    });
    f.appendChild(sec);
  }

  const misc = el(`<section class="card misc"><h3>Overig</h3>
    <div class="misc-actions"><button class="btn ghost small" id="mTour">Rondleiding opnieuw</button>${user ? '<button class="btn ghost small" id="mOut">Uitloggen</button>' : ''}${profile && (profile.is_admin || profile.is_owner) ? '<a class="btn primary small" href="/admin">Beheer</a>' : ''}</div></section>`);
  misc.querySelector('#mTour').onclick = () => app.startTour();
  const out = misc.querySelector('#mOut');
  if (out) out.onclick = () => app.signOut();
  f.appendChild(misc);
  return f;
}

export function renderSearch(app, q) {
  const term = (q || '').toLowerCase().trim();
  return term;
}
