# Te-Un Games

Het gameplatform van te-ungames.nl, met Te-Un de kabouter als hoofdpersoon. Statische site, geen build-stap.

- `/` is het platform (home, categorieën, zoeken, favorieten, profiel, beheer).
- `/games/te-un-surfers/` is de eerste game (een iframe op de gamepagina).

## Logo

Zet je logo als **`assets/logo.jpg`** (vierkant, bij voorkeur 512x512 of groter). Dat bestand wordt overal gebruikt: topbalk, laadscherm, favicon, apple-touch-icon, delen via social media en in de game. Ontbreekt het bestand, dan tekent het platform zelf een kabouter.

## Accounts koppelen met Supabase

Zonder Supabase draait het platform in **demo-modus** (accounts in je eigen browser, het eerste account is beheerder). Voor echte accounts:

1. Maak een project op https://supabase.com.
2. Open **SQL Editor**, plak `supabase/schema.sql` en voer uit.
3. Ga naar **Project Settings > API** en kopieer de *Project URL* en de *anon public key* naar `js/platform/config.js`. De anon key is bedoeld om openbaar te zijn; de beveiliging zit in de regels uit het schema.
4. **Authentication > URL Configuration**: zet *Site URL* op `https://te-ungames.nl` en voeg die ook toe bij *Redirect URLs*.
5. Maak een account op je site. Voer daarna onderaan `schema.sql` het stukje "JIJ ALS BEHEERDER" uit met je e-mailadres. Daarna zie je het menu **Beheer**.

Wil je zonder bevestigingsmail kunnen aanmelden: Authentication > Providers > Email > zet "Confirm email" uit.

## Hosten op Cloudflare met je eigen domein

`wrangler.toml` serveert de site als statische assets en draait `worker/index.js` voor `/api/*` (de ranglijst van Te-Un Surfers, in een Durable Object).

- Build command: leeg. Deploy command: `npx wrangler deploy`.
- Domein: Workers & Pages > je project > **Settings > Domains & Routes > Add > Custom domain** > `te-ungames.nl` (en `www.te-ungames.nl`).
- Staat je domein nog niet bij Cloudflare, voeg het dan toe onder *Websites* en zet bij je registrar de nameservers zoals Cloudflare aangeeft.

## Een nieuwe game toevoegen

1. Zet de game in `games/<naam>/` (een gewone web-game met `index.html`).
2. Log in als beheerder > **Beheer > Nieuwe game**: naam, categorie, plaatje en adres (`/games/<naam>/`).
3. Voortgang bewaren: de game stuurt `postMessage({type:'teun:save', game, data})` naar de ouder en luistert naar `teun:progress`. Zie `games/te-un-surfers/js/bridge.js` als voorbeeld.

## Thema's

Smurf Blauw, Ravagio Oranje (verborgen oranje shirtjes), Minecraft-sok groen (verborgen blokfiguurtje) en Bambi-trui bruin (verborgen hertje). Kleuren staan bovenaan `css/platform.css`.

## Structuur

| Pad | Inhoud |
| --- | --- |
| `index.html`, `css/platform.css` | Platform |
| `js/platform/` | App, pagina's, rondleiding, thema's, easter eggs, backends |
| `supabase/schema.sql` | Database en beveiligingsregels |
| `games/te-un-surfers/` | De eerste game |
| `worker/index.js` | Cloudflare Worker voor de ranglijst |
| `vendor/` | Supabase-client |
