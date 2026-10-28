import { el, esc, fmt, ago, toast, modal } from './ui.js';
import { avatarSVG, icon, teunSVG } from './art.js';
import { CATEGORIES, catById } from './games.js';
import { THEMES } from './themes.js';
import { api, configured } from './api.js';

function bars(items, unit = '') {
  const max = Math.max(1, ...items.map((i) => i.value));
  return `<div class="bars">${items.map((i) => `<div class="bar-row"><span class="bar-label" title="${esc(i.label)}">${esc(i.label)}</span>
    <div class="bar-track"><i style="width:${(i.value / max) * 100}%"></i></div><b>${fmt(i.value)}${unit}</b></div>`).join('') || '<p class="muted">Nog geen gegevens.</p>'}</div>`;
}

function line(points) {
  const W = 560;
  const H = 150;
  const max = Math.max(1, ...points.map((p) => p.count));
  const step = W / Math.max(1, points.length - 1);
  const xy = points.map((p, i) => [i * step, H - 14 - (p.count / max) * (H - 34)]);
  const d = xy.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1)).join(' ');
  return `<svg class="line" viewBox="0 0 ${W} ${H + 18}" preserveAspectRatio="none" role="img" aria-label="Gespeeld per dag">
    <defs><linearGradient id="la" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="currentColor" stop-opacity=".45"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></linearGradient></defs>
    <path d="${d} L${W} ${H} L0 ${H} Z" fill="url(#la)"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    ${xy.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="3.4" fill="currentColor"><title>${points[i].day}: ${points[i].count}</title></circle>`).join('')}
    <text x="0" y="${H + 14}" class="lt">${points[0] ? points[0].day.slice(5) : ''}</text><text x="${W}" y="${H + 14}" text-anchor="end" class="lt">${points.length ? points[points.length - 1].day.slice(5) : ''}</text></svg>`;
}

export async function renderAdmin(app) {
  const f = document.createDocumentFragment();
  if (!app.state.profile || !app.state.profile.is_admin) {
    f.appendChild(el(`<div class="empty"><div class="empty-teun">${teunSVG({ cls: 'idle' })}</div><h3>Alleen voor de beheerder</h3>
      <p>Log in met het beheerdersaccount om dit dashboard te zien.</p><a class="btn primary" href="/">Terug naar home</a></div>`));
    return f;
  }
  const page = el('<div class="admin"><div class="admin-load">Dashboard laden...</div></div>');
  f.appendChild(page);

  (async () => {
    let ov; let users; let games;
    try {
      [ov, users, games] = await Promise.all([api.adminOverview(), api.adminUsers(), api.adminListGames()]);
    } catch (e) {
      page.innerHTML = `<div class="empty"><h3>Kon het dashboard niet laden</h3><p>${esc(e.message)}</p></div>`;
      return;
    }
    const byPlays = [...games].sort((a, b) => b.plays - a.plays);
    const byLikes = [...games].sort((a, b) => b.likes - a.likes);
    const top = byPlays[0];
    const themeCount = {};
    users.forEach((u) => { themeCount[u.theme] = (themeCount[u.theme] || 0) + 1; });

    page.innerHTML = `
      <div class="admin-head"><div><h1>Beheer</h1><p class="muted">Alles over Te-Un Games op één plek.${configured ? '' : ' <b class="demo">Demo-modus: gegevens komen uit deze browser. Koppel Supabase voor echte cijfers.</b>'}</p></div>
        <button class="btn ghost small" id="aRefresh">Vernieuwen</button></div>
      <div class="kpis">
        <div class="kpi"><small>Aangemelde spelers</small><b>${fmt(ov.users)}</b><span>${fmt(ov.new_users_7d)} nieuw deze week</span></div>
        <div class="kpi"><small>Games</small><b>${fmt(ov.games)}</b><span>${fmt(games.filter((g) => g.published).length)} gepubliceerd</span></div>
        <div class="kpi"><small>Keer gespeeld</small><b>${fmt(ov.plays)}</b><span>in totaal</span></div>
        <div class="kpi"><small>Likes</small><b>${fmt(ov.likes)}</b><span>op alle games</span></div>
      </div>
      <div class="admin-grid">
        <section class="card top-game">
          <h3>Meest gespeelde game</h3>
          ${top ? `<div class="tg"><div class="tg-img" style="background-image:url('${esc(top.thumb)}')"></div><div><b>${esc(top.title)}</b><p>${fmt(top.plays)} keer gespeeld · ${fmt(top.likes)} likes</p><a class="btn ghost small" href="/g/${esc(top.id)}">Bekijk</a></div></div>` : '<p class="muted">Nog geen games.</p>'}
        </section>
        <section class="card"><h3>Gespeeld per dag <span class="muted">laatste 14 dagen</span></h3>${line(ov.plays_per_day || [])}</section>
        <section class="card"><h3>Meest gespeeld</h3>${bars(byPlays.map((g) => ({ label: g.title, value: g.plays })))}</section>
        <section class="card"><h3>Meeste likes</h3>${bars(byLikes.map((g) => ({ label: g.title, value: g.likes })))}</section>
        <section class="card"><h3>Gekozen thema's</h3>${bars(Object.entries(themeCount).map(([k, v]) => ({ label: (THEMES[k] || { name: k }).name, value: v })))}</section>
      </div>
      <section class="card"><div class="tbl-head"><h3>Games</h3><button class="btn primary small" id="gNew">+ Nieuwe game</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Game</th><th>Categorie</th><th>Gespeeld</th><th>Likes</th><th>Status</th><th></th></tr></thead>
        <tbody>${games.map((g) => `<tr><td><div class="cell-game"><span class="mg-img sm" style="background-image:url('${esc(g.thumb)}')"></span><b>${esc(g.title)}</b></div></td>
          <td>${esc(catById(g.category).name)}</td><td>${fmt(g.plays)}</td><td>${fmt(g.likes)}</td>
          <td><span class="status ${g.published ? 'on' : ''}">${g.published ? 'Gepubliceerd' : 'Verborgen'}</span></td>
          <td class="acts"><button class="icon-btn" data-edit="${esc(g.id)}" title="Bewerken">${icon('edit', 16)}</button><button class="icon-btn" data-toggle="${esc(g.id)}" title="${g.published ? 'Verbergen' : 'Publiceren'}">${icon('eye', 16)}</button><button class="icon-btn danger" data-del="${esc(g.id)}" title="Verwijderen">${icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table></div></section>
      <section class="card"><div class="tbl-head"><h3>Spelers <span class="muted">(${fmt(users.length)})</span></h3><input id="uSearch" class="search-in" placeholder="Zoek op naam of e-mail"></div>
        <div class="tbl-wrap"><table class="tbl" id="uTable"><thead><tr><th>Speler</th><th>E-mail</th><th>Aangemeld</th><th>Laatst gezien</th><th>Thema</th><th>Gespeeld</th></tr></thead><tbody></tbody></table></div></section>`;

    const tb = page.querySelector('#uTable tbody');
    const paintUsers = (q = '') => {
      const t = q.toLowerCase();
      const rows = [...users].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).filter((u) => !t || (u.username || '').toLowerCase().includes(t) || (u.email || '').toLowerCase().includes(t));
      tb.innerHTML = rows.map((u) => `<tr><td><div class="cell-game"><span class="avatar sm">${avatarSVG(u.avatar)}</span><b>${esc(u.username)}</b>${u.is_admin ? '<span class="status on">beheerder</span>' : ''}</div></td>
        <td>${esc(u.email)}</td><td>${ago(u.created_at)}</td><td>${ago(u.last_seen)}</td><td>${esc((THEMES[u.theme] || { name: u.theme || '-' }).name)}</td><td>${fmt(u.plays)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Geen spelers gevonden.</td></tr>';
    };
    paintUsers();
    page.querySelector('#uSearch').addEventListener('input', (e) => paintUsers(e.target.value));
    page.querySelector('#aRefresh').onclick = () => app.route();

    const edit = (g) => {
      const isNew = !g;
      const x = g || { id: '', title: '', category: 'actie', tags: [], tagline: '', description: '', url: '', thumb: '', hero: '', controls: [], published: true, featured: false };
      const m = modal(`<form class="form game-form"><h2>${isNew ? 'Nieuwe game' : 'Game bewerken'}</h2>
        <label>Naam<input name="title" required value="${esc(x.title)}"></label>
        <label>Id (korte naam in de link)<input name="id" required pattern="[a-z0-9\\-]+" value="${esc(x.id)}" ${isNew ? '' : 'readonly'}></label>
        <label>Categorie<select name="category">${CATEGORIES.map((c) => `<option value="${c.id}" ${c.id === x.category ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label>Extra categorieën (komma's)<input name="tags" value="${esc((x.tags || []).join(', '))}"></label>
        <label>Korte tekst<input name="tagline" value="${esc(x.tagline)}"></label>
        <label>Beschrijving<textarea name="description" rows="3">${esc(x.description)}</textarea></label>
        <label>Adres van de game (url)<input name="url" required value="${esc(x.url)}" placeholder="/games/mijn-game/"></label>
        <label>Plaatje (url)<input name="thumb" value="${esc(x.thumb)}" placeholder="/assets/mijn-game.jpg"></label>
        <label>Groot plaatje (url)<input name="hero" value="${esc(x.hero || '')}"></label>
        <label>Besturing (één per regel: toets | uitleg)<textarea name="controls" rows="3">${esc((x.controls || []).map((c) => c.join(' | ')).join('\n'))}</textarea></label>
        <div class="checks"><label class="check"><input type="checkbox" name="published" ${x.published ? 'checked' : ''}> Gepubliceerd</label><label class="check"><input type="checkbox" name="featured" ${x.featured ? 'checked' : ''}> Uitgelicht op home</label></div>
        <div class="form-err" id="gErr"></div><button class="btn primary" type="submit">Opslaan</button></form>`, { cls: 'wide' });
      m.body.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const game = {
          id: fd.get('id').trim(), title: fd.get('title').trim(), category: fd.get('category'),
          tags: fd.get('tags').split(',').map((s) => s.trim()).filter(Boolean), tagline: fd.get('tagline').trim(), description: fd.get('description').trim(),
          url: fd.get('url').trim(), thumb: fd.get('thumb').trim(), hero: fd.get('hero').trim(),
          controls: fd.get('controls').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p[0]).map((p) => [p[0], p[1] || '']),
          published: !!fd.get('published'), featured: !!fd.get('featured'), created_at: x.created_at,
        };
        try { await api.adminSaveGame(game); m.close(); await app.reloadGames(); toast('Game opgeslagen'); app.route(); } catch (err) { m.body.querySelector('#gErr').textContent = err.message; }
      });
    };
    page.querySelector('#gNew').onclick = () => edit(null);
    page.addEventListener('click', async (e) => {
      const ed = e.target.closest('[data-edit]');
      const tg = e.target.closest('[data-toggle]');
      const dl = e.target.closest('[data-del]');
      if (ed) edit(games.find((g) => g.id === ed.dataset.edit));
      else if (tg) {
        const g = games.find((x) => x.id === tg.dataset.toggle);
        await api.adminSaveGame({ ...g, published: !g.published });
        await app.reloadGames();
        app.route();
      } else if (dl) {
        const g = games.find((x) => x.id === dl.dataset.del);
        if (confirm(`"${g.title}" definitief verwijderen? Likes en cijfers van deze game verdwijnen.`)) {
          await api.adminDeleteGame(g.id);
          await app.reloadGames();
          app.route();
        }
      }
    });
  })();
  return f;
}
