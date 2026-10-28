# Te-Un Surfers

Een 3D endless runner in de browser. Te-Un, een kleine kabouter met rood mutsje, ronde zwarte bril en smurfblauwe schoenen, rent over het spoor tussen gele NS-treinen.

- Wissel van spoor, spring over overwegbomen en rol onder lage balken door.
- Rij je een treinspotter aan, dan krijg je **30 munten**.
- Werkt met toetsenbord (pijltjes, WASD, spatie) en swipes op telefoon.

## Lokaal draaien

Er is geen build-stap. Serveer de map met een willekeurige statische server:

```bash
python3 -m http.server 8000
```

Open daarna http://localhost:8000 (ES-modules werken niet via `file://`).

## Hosten op Vercel

1. Importeer deze repository op https://vercel.com/new.
2. Framework Preset: **Other**. Laat Build Command en Output Directory leeg (de root wordt direct geserveerd).
3. Deploy. `vercel.json` regelt de caching.

## Structuur

| Pad | Inhoud |
| --- | --- |
| `index.html`, `css/style.css` | Menu, HUD en schermen |
| `js/main.js` | Spelloop, patronen, botsingen, camera |
| `js/gnome.js` | De kabouter (procedureel model en animaties) |
| `js/train.js` | NS-trein met zelf getekende textures |
| `js/spotter.js` | Treinspotters |
| `js/world.js` | Spoor, bovenleiding, perrons, polderlandschap, lucht |
| `js/merge.js` | Geometrie samenvoegen voor minder draw calls |
| `js/audio.js` | Muziek en geluid, live gesynthetiseerd met WebAudio |
| `vendor/` | Three.js r170 (MIT) |

Alle modellen en textures worden in code gegenereerd, er zijn geen losse afbeeldingen of geluidsbestanden.
