// De games van Te-Un Games. Spellen uit de database (Supabase) vullen dit aan.
export const GENRES = ['Actie', 'Arcade', 'Avontuur', 'Puzzel', 'Racen', 'Sport', 'Denken', 'Kinderen', 'Multiplayer'];

export const DEFAULT_GAMES = [
  {
    id: 'te-un-surfers', title: 'Te-Un Surfers', category: 'actie', tags: [],
    tagline: 'Ren over het spoor, spring op treinen en spuit treinspotters nat.',
    description: 'Help Te-Un de kabouter ontsnappen aan de boze kabouters. Ren over drie sporen, ontwijk rijdende NS-treinen, spring via schansen op de daken en pak power-ups. Koop een rolstoel, een koe of een NS-trein om 30 seconden sneller te gaan en veel meer munten te verdienen.',
    controls: [
      ['← →  of  A D', 'Een spoor opzij'], ['↑  of  W', 'Springen'], ['↓  of  S', 'Rollen'],
      ['Spatie', 'Voertuig activeren'], ['F  of dubbelklik', 'Waterpistool'],
      ['Telefoon', 'Swipe = één spoor, dubbeltik = waterpistool'],
    ],
    logo: '/assets/te-un-surfers-logo.png',
    thumb: '/assets/te-un-surfers.jpg', hero: '/assets/te-un-surfers-hero.jpg', url: '/games/te-un-surfers/',
    published: true, featured: true, created_at: '2025-01-01T00:00:00Z', plays: 0, likes: 0,
  },
];

export const genreName = (id) => {
  const f = GENRES.find((g) => g.toLowerCase() === String(id).toLowerCase());
  return f || (id ? id[0].toUpperCase() + id.slice(1) : 'Game');
};
