// De games van Te-Un Games. Spellen uit de database (Supabase) vullen dit aan.
export const GENRES = ['Actie', 'Arcade', 'Avontuur', 'Puzzel', 'Racen', 'Sport', 'Denken', 'Kinderen', 'Multiplayer'];

export const DEFAULT_GAMES = [
  {
    id: 'te-un-surfers', title: 'Te-Un Surfers', category: 'actie', tags: [],
    tagline: 'Ren over het spoor, spring op treinen en spuit treinspotters nat.',
    description: 'Help Te-Un de kabouter ontsnappen aan de boze kabouters. Ren over drie sporen, ontwijk rijdende NS-treinen, spring via schansen op de daken en pak power-ups. Koop een rolstoel, een koe of een NS-trein om 30 seconden sneller te gaan en veel meer munten te verdienen.',
    controls: [
      ['← →  of  A D', 'Een spoor opzij'], ['↑  of  W', 'Springen'], ['↓  of  S', 'Rollen'],
      ['Spatie', 'Voertuig activeren'], ['F  of dubbelklik', 'Waterpistool, fluitje of camera (jouw skin)'],
      ['Telefoon', 'Swipe = één spoor, dubbeltik = waterpistool, fluitje of camera'],
    ],
    logo: '/assets/te-un-surfers-logo.png',
    thumb: '/assets/te-un-surfers.jpg', hero: '/assets/te-un-surfers-hero.jpg', url: '/games/te-un-surfers/',
    published: true, featured: true, created_at: '2025-01-01T00:00:00Z', plays: 0, likes: 0,
  },
  {
    id: 'te-un-puzzel', title: 'Te-Un Puzzel', category: 'puzzel', tags: [],
    tagline: 'Vier legpuzzels en vier schuifpuzzels met Te-Un.',
    description: 'Sleep de door elkaar liggende stukjes naar de juiste plek en maak de afbeelding af. Level 1 is rustig, level 4 is serieus moeilijk: 54 stukjes die je ook nog moet draaien. Elk level heeft een tijdslimiet: 30 seconden, 1 minuut, 2,5 minuut en 10 minuten. Daarnaast is er een schuifpuzzel zonder tijdslimiet.',
    controls: [
      ['Slepen', 'Een stukje verplaatsen, het klikt vast op zijn plek'],
      ['Tikken', 'Een stukje draaien (level 4)'],
      ['Voorbeeld', 'Laat de afbeelding zien'],
      ['Randen', 'Maakt de middenstukjes doorzichtig, zo vind je de randen sneller'],
    ],
    logo: '/assets/te-un-puzzel-logo.png', thumb: '/assets/te-un-puzzel.jpg', hero: '/assets/te-un-puzzel-hero.jpg', url: '/games/te-un-puzzel/',
    published: true, featured: false, created_at: '2025-06-01T00:00:00Z', plays: 0, likes: 0,
  },
  {
    id: 'te-un-x3m', title: 'Te-Un X3M', category: 'racen', tags: [],
    tagline: 'Spring en stunt met een fatbike, motor of gouden vape door 25 levels.',
    description: 'Rijd door gevaarlijke levels vol lava, spijkers, zagen en vuur. Wees snel voor drie sterren, upgrade van fatbike naar motor en naar de gouden vape waarmee je vliegt, en speel nieuwe personages vrij: de oranje-shirt jongen in level 5, Te-Un Racer in level 10 en de gouden regenboog Te-Un in level 20.',
    controls: [
      ['↑  of  W', 'Gas'], ['↓  of  S', 'Remmen en achteruit'], ['←  →  of  A D', 'Leunen: achterover of voorover'],
      ['R', 'Level opnieuw'], ['Esc  of  P', 'Pauze'], ['Telefoon', 'Knoppen onderin beeld'],
    ],
    logo: '/assets/te-un-x3m-logo.png', thumb: '/assets/te-un-x3m.jpg', hero: '/assets/te-un-x3m-hero.jpg', url: '/games/te-un-x3m/',
    published: true, featured: false, created_at: '2025-07-01T00:00:00Z', plays: 0, likes: 0,
  },
  {
    id: 'te-un-drive', title: 'Te-Un Drive', category: 'racen', tags: [],
    tagline: 'Rijd je blokkenauto door 25 levels vol bruggen, gaten en spijkers.',
    description: 'Rijd je blokkenauto over heuvels, trappen, houten bruggen en gaten vol water naar de finish. Pas op voor spijkers! Je begint met Hermano\'s fiets en speelt nieuwe auto\'s vrij: de gele monstertruck na level 5, de gouden monstertruck na level 15 en de tuinkabouterauto na level 20. Let op de veerboten en de knoppen die bruggen laten uitschuiven.',
    controls: [
      ['→  of  D', 'Gas'], ['←  of  A', 'Remmen en achteruit'], ['R', 'Level opnieuw'], ['Esc  of  P', 'Pauze'],
      ['In de lucht', 'Gas tilt de neus op, rem duwt hem omlaag'], ['Telefoon', 'Knoppen onderin beeld'],
    ],
    logo: '/assets/te-un-drive-logo.png', thumb: '/assets/te-un-drive.jpg', hero: '/assets/te-un-drive-hero.jpg', url: '/games/te-un-drive/',
    published: true, featured: false, created_at: '2025-08-01T00:00:00Z', plays: 0, likes: 0,
  },
  {
    id: 'vuur-water', title: 'VuurTe-Un & WaterTe-Un', category: 'puzzel', tags: [],
    tagline: 'Twee kabouters, twee deuren: kom samen veilig door 32 tempellevels.',
    description: 'Bestuur twee kabouters tegelijk: VuurTe-Un en WaterTe-Un. Breng allebei veilig naar hun eigen deur, zonder dat de één in water en de ander in lava valt. Verzamel rode en blauwe stenen, druk op knoppen en trek aan hendels om poorten te openen. 32 levels in een mossige tempel. Alleen? Speel met één kabouter en wissel met de spatiebalk.',
    controls: [
      ['←  →  ↑', 'VuurTe-Un: lopen en springen'],
      ['A  D  W', 'WaterTe-Un: lopen en springen'],
      ['Spatie', 'Wisselen (1 speler)'],
      ['R', 'Level opnieuw'],
      ['Esc  of  P', 'Pauze'],
      ['Telefoon', 'Knoppen onderin beeld'],
    ],
    logo: '/assets/vuur-water-logo.png', thumb: '/assets/vuur-water.jpg', hero: '/assets/vuur-water-hero.jpg', url: '/games/vuur-water/',
    published: true, featured: false, created_at: '2025-09-01T00:00:00Z', plays: 0, likes: 0,
  },
  {
    id: 'te-un-tikkertje', title: 'Te-Un Tikkertje', category: 'actie', tags: [],
    tagline: 'Ren, spring en tik: wie de tikker is na een minuut, gaat eruit.',
    description: 'Speel tikkertje met drie andere kabouters op zwevende platforms in een bos, de woestijn of de sneeuw. Ben je de tikker? Dan moet je iemand tikken voordat de minuut om is, anders ga jij eruit. Kies tussen normaal en hardcore, verdien munten als je wint en koop nieuwe Te-Uns met speciale krachten: de tyfus snelle Te-Un, de schaduw Te-Un en de tovenaar Te-Un.',
    controls: [
      ['←  →  of  A D', 'Lopen'],
      ['↑  of  W', 'Springen (van onderaf dwars door platforms)'],
      ['Spatie', 'Kracht van je personage'],
      ['Esc  of  P', 'Pauze'],
      ['Telefoon', 'Knoppen onderin beeld'],
    ],
    logo: '/assets/te-un-tikkertje-logo.png', thumb: '/assets/te-un-tikkertje.jpg', hero: '/assets/te-un-tikkertje-hero.jpg', url: '/games/te-un-tikkertje/',
    published: true, featured: false, created_at: '2025-09-15T00:00:00Z', plays: 0, likes: 0,
  },
  {
    id: 'te-un-robber', title: 'Te-Un the Robber', category: 'actie', tags: [],
    tagline: 'Een dief in 5 hoofdstukken: van het Kabouterdorp tot China!',
    description: 'Volg Te-Un de dief door vijf hoofdstukken en 25 gebouwen: paddenstoelhuisjes in het Kabouterdorp, een casino en supermarkt in Nederland, een magazijn in China en nog veel meer. Doe je bivakmuts op, ontwijk bewakingsrobots, camera\'s, drones en lasers, breek sloten open, pak de buit en ontsnap voordat de tijd om is. Met tussenfilmpjes, een stad per hoofdstuk en elk level moeilijker dan het vorige.',
    controls: [
      ['←  →  of  A D', 'Lopen'],
      ['↑  ↓', 'Ladder, trap of lift nemen'],
      ['↓', 'Verstoppen bij een kast, plant of kist'],
      ['Spatie', 'Pakken, hacken, zwakke robot slaan (5 sec uit)'],
      ['Spatie ingedrukt', 'Een slot openbreken'],
      ['R', 'Level opnieuw'],
      ['Esc  of  P', 'Pauze'],
      ['Telefoon', 'Knoppen onderin beeld'],
    ],
    logo: '/assets/te-un-robber-logo.png', thumb: '/assets/te-un-robber.jpg', hero: '/assets/te-un-robber-hero.jpg', url: '/games/te-un-robber/',
    published: true, featured: false, created_at: '2025-10-01T00:00:00Z', plays: 0, likes: 0,
  },
];

export const genreName = (id) => {
  const f = GENRES.find((g) => g.toLowerCase() === String(id).toLowerCase());
  return f || (id ? id[0].toUpperCase() + id.slice(1) : 'Game');
};
