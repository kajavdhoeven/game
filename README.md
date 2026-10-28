# Te-Un Surfers

Een 3D endless runner in de browser. Te-Un, een kleine kabouter met rood mutsje, ronde zwarte bril en smurfblauwe schoenen, rent over het spoor tussen treinen, tunnels en stations.

## Spelen

- **Besturing:** pijltjes of WASD (een spoor opzij, springen, rollen), **spatie** activeert je geselecteerde voertuig, **C** wisselt van voertuig, **F** of dubbelklikken schiet met het waterpistool. Op een telefoon: swipe = precies één spoor, omhoog = springen, omlaag = rollen, dubbeltik = waterpistool.
- **Treinspotters:** spuit ze nat voor 25 munten. Eén op de tien draagt een oranje shirt en geeft 100 munten.
- **Treinen:** sprinters, intercity's, internationale treinen, vintage materieel en goederentreinen, met en zonder graffiti of stickers. Sommige komen je snel tegemoet. Via schansen (plank, metaal, beton) kom je op het dak.
- **Perrons en tunnels:** spring op het perron voor munten en power-ups, en weer terug naar het spoor.
- **Power-ups:** superschoenen (spring op daken), mini-vliegtuig (7,5 s vliegen), voertuig-refill, hoverboard (oranje shirt, vangt één klap op).
- **Voertuigen (winkel):** rolstoel (2.500), koe (7.500) en NS-trein (15.000). Elk werkt 30 seconden met een eigen snelheids- en muntenbonus. Verder in de winkel: NS-conducteur met koeienpetje (50.000) en koe-hoverboard (10.000).
- Je munten, aankopen, record en naam worden bewaard in de browser. De online ranglijst (afstand en munten) werkt op Cloudflare.

## Lokaal draaien

Er is geen build-stap. Serveer de map met een willekeurige statische server:

```bash
python3 -m http.server 8000
```

Open daarna http://localhost:8000 (ES-modules werken niet via `file://`). De online ranglijst is dan niet beschikbaar; het spel valt terug op je eigen score.

## Hosten

### Cloudflare (met online ranglijst)

`wrangler.toml` serveert de site als statische assets en draait `worker/index.js` voor `/api/*`. De ranglijst staat in een Durable Object met SQLite-opslag, die bij de eerste deploy automatisch wordt aangemaakt. Er zijn geen extra instellingen nodig:

- Build command: leeg
- Deploy command: `npx wrangler deploy`

### Vercel (zonder online ranglijst)

Importeer de repository, kies Framework Preset **Other** en laat Build en Output leeg. `vercel.json` regelt de caching. De ranglijst valt dan terug op lokale scores.

## Structuur

| Pad | Inhoud |
| --- | --- |
| `index.html`, `css/style.css` | Menu, winkel, ranglijst, HUD |
| `js/main.js` | Spelloop, patronen, botsingen, voertuigen, intro, camera |
| `js/gnome.js` | Te-Un en varianten (skins, poses, cartoon-animaties) |
| `js/train.js` | Treintypes, graffiti, stickers, goederenwagons, schansen |
| `js/spotter.js` | Treinspotters met gezichten, camera's en gedrag |
| `js/vehicles.js`, `js/powerups.js` | Rolstoel, koe, NS-trein, hoverboards, power-up modellen |
| `js/world.js` | Spoor, dag/nacht, tunnels, perrons, polderlandschap |
| `js/mob.js` | Boze kabouters met fakkels en hooivorken (intro) |
| `js/save.js`, `js/net.js` | Opslag in de browser en online ranglijst |
| `worker/index.js` | Cloudflare Worker met Durable Object voor de ranglijst |
| `vendor/` | Three.js r170 (MIT) |

Alle modellen, textures en geluiden worden in code gegenereerd.
