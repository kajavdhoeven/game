// Catalogus: categorieën en de eerste game. Spellen uit de database (Supabase) vullen dit aan.
export const CATEGORIES = [
  { id: 'actie', name: 'Actie', blurb: 'Snel reageren, niet omvallen.', color: ['#ff5252', '#ff9a3d'] },
  { id: 'arcade', name: 'Arcade', blurb: 'Hoge scores jagen.', color: ['#7b61ff', '#2ad4ff'] },
  { id: 'avontuur', name: 'Avontuur', blurb: 'Ontdek de wereld van Te-Un.', color: ['#1fb877', '#b5f23d'] },
  { id: 'puzzel', name: 'Puzzel', blurb: 'Hersenkrakers voor jong en oud.', color: ['#ff6fb5', '#ffb36b'] },
  { id: 'racen', name: 'Racen', blurb: 'Gas erop.', color: ['#ffb400', '#ff5d2a'] },
  { id: 'sport', name: 'Sport', blurb: 'Scoren, rennen, zwemmen.', color: ['#2ad4ff', '#2a6bff'] },
  { id: 'denken', name: 'Denken', blurb: 'Strategie en quizzen.', color: ['#a06bff', '#ff6bd4'] },
  { id: 'kinderen', name: 'Kinderen', blurb: 'Lekker eenvoudig en lief.', color: ['#ffd23f', '#ff8fb1'] },
  { id: 'multiplayer', name: 'Multiplayer', blurb: 'Samen of tegen elkaar.', color: ['#19c3a5', '#3d7bff'] },
];

export const DEFAULT_GAMES = [
  {
    id: 'te-un-surfers', title: 'Te-Un Surfers', category: 'actie', tags: ['arcade', 'avontuur'],
    tagline: 'Ren over het spoor, spring op treinen en spuit treinspotters nat.',
    description: 'Help Te-Un de kabouter ontsnappen aan de boze kabouters. Ren over drie sporen, ontwijk rijdende NS-treinen, spring via schansen op de daken en pak power-ups. Koop een rolstoel, een koe of een NS-trein om 30 seconden te vliegen en veel meer munten te verdienen.',
    controls: [
      ['← →  of  A D', 'Een spoor opzij'], ['↑  of  W', 'Springen'], ['↓  of  S', 'Rollen'],
      ['Spatie', 'Voertuig activeren'], ['C', 'Ander voertuig'], ['F  of dubbelklik', 'Waterpistool'],
      ['Telefoon', 'Swipe = één spoor, dubbeltik = waterpistool'],
    ],
    thumb: '/assets/te-un-surfers.jpg', hero: '/assets/te-un-surfers-hero.jpg', url: '/games/te-un-surfers/',
    published: true, featured: true, created_at: '2025-01-01T00:00:00Z', plays: 0, likes: 0,
  },
];

// Geen aangekondigde games meer: alleen echte games staan op het platform.
export const COMING_SOON = [];

export const catById = (id) => CATEGORIES.find((c) => c.id === id) || { id, name: id, color: ['#888', '#444'] };
