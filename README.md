# Drift Rally 🏁

Een realistische browserracegame geïnspireerd op *PolyTrack*, maar dan met een geheel eigen sfeer:
dynamische verlichting, een atmosferische lucht, glooiende (of neonverlichte) circuits en losse,
op drift gerichte besturing. Volledig gebouwd met [Three.js](https://threejs.org/) — geen externe
assets, geen build-afhankelijkheden buiten npm, en klaar om als statische site gehost te worden.

## Kenmerken

- **Twee circuits met eigen sfeer** — *Zonsondergang Heuvels* (glooiende heuvels, gouden avondlicht,
  fysisch gebaseerde lucht) en *Neon Nachten* (nachtelijk stadscircuit met gloeiende gebouwen en
  neonvangrails).
- **Drift-gerichte arcade-fysica** — versnellen, remmen, driften met de handrem en nitro-boost die je
  opbouwt door te driften.
- **Realistische weergave** — PBR-materialen, dynamische schaduwen die de auto volgen, atmosferische
  mist, banking in bochten en reflecties via een gedeelde environment map.
- **Animatiescherm** — een 3D showroomscène met een langzaam draaiende auto, dynamische belichting en
  zwevende deeltjes, met invoer voor je bestuurdersnaam en voertuigkleur.
- **Ronde-timing & lokale ranglijst** — rondetijden, checkpoints (voorkomt afsnijden), en de beste tijd
  per circuit wordt lokaal opgeslagen (`localStorage`).
- **Volledig bespeelbaar op mobiel** — automatische aanraakbediening op touchscreens.
- **Geluid zonder externe bestanden** — motorgeluid, botsingen en UI-feedback worden volledig
  procedureel gegenereerd met de Web Audio API.

## Besturing

| Toets           | Actie                     |
| --------------- | ------------------------- |
| `W` / `↑`        | Gas geven                 |
| `S` / `↓`        | Remmen / achteruit        |
| `A` / `←`        | Links sturen               |
| `D` / `→`        | Rechts sturen              |
| `Spatie`        | Handrem (drift)            |
| `Shift`         | Nitro boost                |
| `R`             | Reset op circuit           |
| `Esc`           | Pauze                       |

Op mobiel/tablet verschijnen automatisch aanraakknoppen.

## Lokaal draaien

Vereist [Node.js](https://nodejs.org/) 18 of hoger.

```bash
npm install
npm run dev
```

Open daarna de URL die Vite toont (standaard `http://localhost:5173`).

## Productie-build maken

```bash
npm run build
```

Dit genereert een volledig statische site in de map `dist/`. Test 'm lokaal met:

```bash
npm run preview
```

## Deployen naar Cloudflare Pages

Omdat dit een pure statische Vite-app is, werkt Cloudflare Pages out-of-the-box. Twee manieren:

### Optie 1 — via de Cloudflare-dashboard + GitHub (aanbevolen)

1. Push deze repository naar GitHub (als dat nog niet is gebeurd).
2. Ga in het [Cloudflare-dashboard](https://dash.cloudflare.com/) naar **Workers & Pages → Create →
   Pages → Connect to Git**.
3. Selecteer deze repository.
4. Vul de build-instellingen in:
   - **Framework preset:** `Vite`
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
5. Klik op **Save and Deploy**. Bij elke push naar je hoofdbranch bouwt Cloudflare automatisch een
   nieuwe versie.

### Optie 2 — via de Wrangler CLI

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name=drift-rally
```

De meegeleverde `wrangler.toml` bevat alvast de juiste `pages_build_output_dir`.

## Projectstructuur

```
src/
  main.js              App-orkestratie & renderloop
  style.css            Alle UI-styling (menu, HUD, modals)
  audio/               Procedurele geluidsmotor (Web Audio API)
  car/                 Automodel (procedureel 3D) + rijfysica
  core/                Camera, input (toetsenbord/touch), racelogica
  env/                 Lucht, belichting, terrein, decor per thema
  track/               Spline-gebaseerde circuitgenerator + circuitdata
  effects/             Deeltjeseffecten (bandenrook, nitro)
  game/                Menu- en gameplayscènes (Three.js)
  ui/                  DOM-koppeling voor menu, HUD, pauze- en finishscherm
  utils/               localStorage-helpers, procedurele texturen
```

Nieuwe circuits toevoegen kan puur data-gedreven: voeg een item toe aan `src/track/TrackData.js`
met een lijst controlepunten, breedte, thema en checkpoints — de rest (weg, vangrails, decor,
banking) wordt automatisch gegenereerd.

## Techstack

- [Three.js](https://threejs.org/) — 3D-rendering
- [Vite](https://vitejs.dev/) — build-tool & dev-server
- Geen backend, geen database — alles draait client-side
