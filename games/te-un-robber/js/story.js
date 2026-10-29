// Het verhaal van Te-Un the Robber: 5 chapters met 5 levels, de tussenfilmpjes en welke buitenkant bij welk level hoort.
// Alleen gegevens (geen tekenwerk): levels.js, exterior.js, cutscene.js en citymap.js lezen dit.

export const CHAPTERS = [
  { id: 1, name: 'Het Kabouterdorp', sub: 'Te-Un wil weg, maar heeft geen geld.', city: 'village', levels: [1, 2, 3, 4, 5] },
  { id: 2, name: 'Nederland', sub: 'Fietsen, kaas en een lekkere verrassing.', city: 'nl', levels: [6, 7, 8, 9, 10] },
  { id: 3, name: 'China', sub: 'Rode lantaarns en een groot magazijn.', city: 'china', levels: [11, 12, 13, 14, 15] },
  { id: 4, name: 'Het Hoofdkantoor', sub: 'Nico weet wie Te-Un is.', city: 'hq', levels: [16, 17, 18, 19, 20] },
  { id: 5, name: 'Terug naar huis', sub: 'Gestrand, maar nog niet verslagen.', city: 'island', levels: [21, 22, 23, 24, 25] },
];

// ext (de buitenkant, voor het begin van het level):
//   kind    welk gebouw: mushroom, townhall, mushroombank, rowhouse, canalhouse, supermarket, casino, chinese, hutong, apartment, teashop, electronics,
//           warehouse, hq, house, police, atelier, bankchina, wreck, resort, ship, tower, castle
//   ground  de omgeving: garden, pond, path, square, street, parking, canal, courtyard, market, neon, yard, plaza, beach, harbor, jungle, grass
//   time    'day' | 'dusk' | 'night'
//   color   een extra kleur voor het gebouw (bijv. de hoed van het paddenstoelhuisje)
//   sign    tekst op het bord (bij winkels e.d.)
// escape: true = je begint binnen en moet naar buiten (geen sluip-intro, wel een tussenfilmpje ervoor)
// theme: sleutel van het interieur in levels.js
export const LEVELS = [
  { n: 1, ch: 1, name: 'Het huisje van Mossel', sub: 'Een gezellig paddenstoelhuisje. Even binnenlopen.', theme: 'mushroom1', ext: { kind: 'mushroom', ground: 'garden', time: 'dusk', color: '#d8362a' } },
  { n: 2, ch: 1, name: 'Het huisje van Truus', sub: 'Hoog en blauw, met een kleine vijver ervoor.', theme: 'mushroom2', ext: { kind: 'mushroom', ground: 'pond', time: 'night', color: '#3a6ad0' } },
  { n: 3, ch: 1, name: 'Het scheve huisje', sub: 'Alles staat een beetje scheef. De bewoner ook.', theme: 'mushroom3', ext: { kind: 'mushroom', ground: 'path', time: 'night', color: '#b8802a' } },
  { n: 4, ch: 1, name: 'Het kaboutergemeentehuis', sub: 'Hier ligt geld, en misschien de code van de kluis.', theme: 'townhall', ext: { kind: 'townhall', ground: 'square', time: 'night', sign: 'GEMEENTEHUIS' } },
  { n: 5, ch: 1, name: 'De Paddenstoelenbank', sub: 'Een grote kluis. Je hebt de code nodig.', theme: 'mushbank', ext: { kind: 'mushroombank', ground: 'street', time: 'night', sign: 'PADDENSTOELENBANK' } },

  { n: 6, ch: 2, name: 'Het rijtjeshuis', sub: 'Een gewoon Nederlands huis met tulpen voor de deur.', theme: 'rowhouse', ext: { kind: 'rowhouse', ground: 'garden', time: 'dusk' } },
  { n: 7, ch: 2, name: 'Het grachtenpand', sub: 'Smal, hoog en vol antiek.', theme: 'canalhouse', ext: { kind: 'canalhouse', ground: 'canal', time: 'night' } },
  { n: 8, ch: 2, name: 'De supermarkt', sub: 'Gangpaden vol boodschappen.', theme: 'supermarket', ext: { kind: 'supermarket', ground: 'parking', time: 'night', sign: 'SUPER' } },
  { n: 9, ch: 2, name: 'Het casino', sub: 'Glitter, geld en camera\'s.', theme: 'casino', ext: { kind: 'casino', ground: 'street', time: 'night', sign: 'CASINO' } },
  { n: 10, ch: 2, name: 'Restaurant De Gouden Draak', sub: 'Hier ligt iets wat verrassend lekker ruikt.', theme: 'chinese', ext: { kind: 'chinese', ground: 'street', time: 'night', sign: 'GOUDEN DRAAK' } },

  { n: 11, ch: 3, name: 'Het binnenhofhuis', sub: 'Een oud huis met een binnenplaats.', theme: 'hutong', ext: { kind: 'hutong', ground: 'courtyard', time: 'dusk' } },
  { n: 12, ch: 3, name: 'De flat', sub: 'Veel verdiepingen, veel buren.', theme: 'apartment', ext: { kind: 'apartment', ground: 'street', time: 'night' } },
  { n: 13, ch: 3, name: 'De theewinkel', sub: 'Duizend soorten thee en een zeer streng slot.', theme: 'teashop', ext: { kind: 'teashop', ground: 'market', time: 'dusk', sign: 'THEE' } },
  { n: 14, ch: 3, name: 'De elektronicawinkel', sub: 'Schermen, lasers en camera\'s.', theme: 'electronics', ext: { kind: 'electronics', ground: 'neon', time: 'night', sign: 'ELECTRO' } },
  { n: 15, ch: 3, name: 'Het BUDDLEY-magazijn', sub: 'Stapels dozen vol producten. Jouw grootste klus.', theme: 'buddley', ext: { kind: 'warehouse', ground: 'yard', time: 'night', sign: 'BUDDLEY' } },

  { n: 16, ch: 4, name: 'Ontsnap uit het hoofdkantoor', sub: 'Nico houdt je vast. Zoek je zak en ga naar buiten.', theme: 'hq', escape: true, ext: { kind: 'hq', ground: 'plaza', time: 'night', sign: 'HOOFDKANTOOR' } },
  { n: 17, ch: 4, name: 'Het huis in de buitenwijk', sub: 'Een rustig huis. Maar de buren bellen de politie.', theme: 'suburb', ext: { kind: 'house', ground: 'street', time: 'night' } },
  { n: 18, ch: 4, name: 'Ontsnap uit het politiebureau', sub: 'Je zit in een cel. Zoek de sleutel tot de vrijheid.', theme: 'police', escape: true, ext: { kind: 'police', ground: 'street', time: 'night', sign: 'POLITIE' } },
  { n: 19, ch: 4, name: 'Ontsnap uit het atelier', sub: 'Een oud, lelijk kledingatelier. Pas op voor de paspoppen.', theme: 'atelier', escape: true, ext: { kind: 'atelier', ground: 'street', time: 'night', sign: 'ATELIER' } },
  { n: 20, ch: 4, name: 'De Bank van China', sub: 'De allergrootste klus. Alles of niets.', theme: 'bankchina', ext: { kind: 'bankchina', ground: 'plaza', time: 'night', sign: 'BANK OF CHINA' } },

  { n: 21, ch: 5, name: 'Het vliegtuigwrak', sub: 'Zoek je geldzakken tussen het wrak.', theme: 'wreck', ext: { kind: 'wreck', ground: 'jungle', time: 'dusk' } },
  { n: 22, ch: 5, name: 'Het strandhotel', sub: 'Palmen, cocktails en veel te veel robots.', theme: 'resort', ext: { kind: 'resort', ground: 'beach', time: 'night', sign: 'RESORT' } },
  { n: 23, ch: 5, name: 'Het piratenschip', sub: 'Een schip vol schatten en schildwachten.', theme: 'ship', ext: { kind: 'ship', ground: 'harbor', time: 'night' } },
  { n: 24, ch: 5, name: 'Het kabouter-vliegveld', sub: 'Een toren, een scanner en jouw weg naar huis.', theme: 'airport', ext: { kind: 'tower', ground: 'plaza', time: 'night', sign: 'VLIEGVELD' } },
  { n: 25, ch: 5, name: 'Het kasteel van de boze kabouters', sub: 'De laatste klus. Alles tegelijk.', theme: 'castle', ext: { kind: 'castle', ground: 'grass', time: 'night' } },
];
export const LEVEL_COUNT = LEVELS.length;
export const levelMeta = (n) => LEVELS[n - 1];
export const chapterOf = (n) => CHAPTERS[levelMeta(n).ch - 1];

// Tussenfilmpjes: vóór het level (dan pas het level) en ná het level (bij een gehaald level)
export const BEFORE = { 1: 'ch1_intro', 6: 'ch2_intro', 11: 'ch3_intro', 15: 'l15_pre', 16: 'ch4_intro', 21: 'ch5_intro' };
export const AFTER = { 5: 'ch1_end', 10: 'ch2_end', 15: 'ch3_end', 17: 'l17_end', 18: 'l18_end', 19: 'l19_end', 20: 'ch4_end', 25: 'final' };

// Elk tussenfilmpje is een rij beelden (shots). Per beeld: tekst en wie praat (who: null = verteller).
// Het tekenwerk per beeld staat in cutscene.js, in dezelfde volgorde. Een beeld mag langer duren als de tekst langer is.
export const CUTSCENES = {
  ch1_intro: { title: 'Hoofdstuk 1: Het Kabouterdorp', shots: [
    { who: null, text: 'Het Kabouterdorp. Daar woont Te-Un al zijn hele leven.' },
    { who: 'Te-Un', text: 'Elke dag hetzelfde... Ik wil de wereld zien!' },
    { who: 'Te-Un', text: 'Maar een vliegticket kost geld. En mijn zakken zijn leeg.' },
    { who: 'Te-Un', text: 'Dan haal ik het geld gewoon ergens anders vandaan.' },
  ] },
  ch1_end: { shots: [
    { who: null, text: 'Te-Un heeft de kluis van de Paddenstoelenbank leeggehaald.' },
    { who: 'Kabouter', text: 'Hé! Dat is de dief! Pak hem!' },
    { who: null, text: 'De boze kabouters uit Te-Un Surfers zitten hem op de hielen.' },
    { who: 'Te-Un', text: 'Tijd om te verdwijnen! Naar het vliegveld!' },
    { who: 'Te-Un', text: 'Eén enkele reis naar Nederland, graag.' },
    { who: 'Te-Un', text: 'Doei, Kabouterdorp!' },
  ] },
  ch2_intro: { title: 'Hoofdstuk 2: Nederland', shots: [
    { who: null, text: 'Nederland. Plat, groen en vol fietsen.' },
    { who: 'Te-Un', text: 'Mijn geld raakt op. Tijd om weer aan het werk te gaan.' },
  ] },
  ch2_end: { shots: [
    { who: null, text: 'Bij het Chinese restaurant heeft Te-Un ook een doos bami meegenomen.' },
    { who: 'Te-Un', text: 'Wat is DIT lekker?! Bami! Ik wil meer!' },
    { who: 'Te-Un', text: 'Dit komt uit China. Ik ga erheen, met al mijn geld.' },
    { who: null, text: 'Via Schiphol vliegt Te-Un naar China.' },
  ] },
  ch3_intro: { title: 'Hoofdstuk 3: China', shots: [
    { who: null, text: 'China. Rode lantaarns, drukke straten en veel kansen.' },
    { who: 'Te-Un', text: 'Eerst een paar huizen en winkels. Daarna kijk ik verder.' },
  ] },
  l15_pre: { shots: [
    { who: null, text: 'Aan de rand van de stad staat het grote magazijn van BUDDLEY.' },
    { who: 'Te-Un', text: 'Zoveel dozen vol producten... dit is de jackpot.' },
    { who: 'Te-Un', text: 'Rustig blijven. Sluipen maar.' },
  ] },
  ch3_end: { shots: [
    { who: 'Te-Un', text: 'Dat was het dan. Nu snel weg.' },
    { who: 'Robot', text: 'Halt, dief! Bzzt!' },
    { who: 'Te-Un', text: 'Oeps.' },
    { who: null, text: 'Twee robotbewakers brengen Te-Un naar het hoofdkantoor.' },
  ] },
  ch4_intro: { title: 'Hoofdstuk 4: Het Hoofdkantoor', shots: [
    { who: null, text: 'Het hoofdkantoor. Het kantoor van directeur Nico.' },
    { who: 'Nico', text: 'Zhè shì shéi?' },
    { who: null, text: '(Nico ziet er niet uit als een Chinees, maar hij spreekt het vloeiend. Hij vraagt: "Wie is dit?")' },
    { who: 'Robot', text: 'Bzzt. Dief. Gepakt in het magazijn.' },
    { who: 'Te-Un', text: 'Dat gaat dus niet gebeuren. Ik ben hier weg!' },
  ] },
  l17_end: { shots: [
    { who: null, text: 'Te-Un loopt met zijn buit het huis uit. Sirenes!' },
    { who: 'Agent', text: 'Stop! Politie!' },
    { who: 'Te-Un', text: 'Een cel. Dat is nieuw.' },
  ] },
  l18_end: { shots: [
    { who: 'Te-Un', text: 'Vrij! Eindelijk buiten!' },
    { who: 'Nico', text: 'Dag Te-Un. Ik had je al verwacht.' },
    { who: null, text: 'Nico en zijn robots nemen Te-Un mee naar een oud, lelijk kledingatelier.' },
  ] },
  l19_end: { shots: [
    { who: 'Te-Un', text: 'Genoeg gevlucht. Tijd voor één heel grote klus.' },
    { who: 'Te-Un', text: 'De Bank van China. Alles wat ik nodig heb.' },
  ] },
  ch4_end: { shots: [
    { who: null, text: 'Met zakken vol geld stapt Te-Un in het vliegtuig naar het Kabouterdorp.' },
    { who: 'Te-Un', text: 'Wat is dat voor geluid?' },
    { who: null, text: 'Halverwege de vlucht begint een motor te roken.' },
    { who: 'Te-Un', text: 'Dit gaat niet goed...' },
  ] },
  ch5_intro: { title: 'Hoofdstuk 5: Terug naar huis', shots: [
    { who: 'Te-Un', text: 'Auw... Waar ben ik?' },
    { who: 'Te-Un', text: 'Mijn geld! Gelukkig is het er nog.' },
    { who: 'Te-Un', text: 'Ik moet thuis zien te komen. Dan maar via een paar klussen.' },
  ] },
  final: { title: 'Einde', shots: [
    { who: 'Te-Un', text: 'Het Kabouterdorp. Eindelijk thuis.' },
    { who: 'Te-Un', text: 'Sorry voor de overvallen. Hier is jullie geld terug, met rente.' },
    { who: 'Kabouter', text: 'Hoera! Voortaan ben jij onze held!' },
    { who: null, text: 'Het Ultra Gouden Te-Un Standbeeld. Het einde van het verhaal.' },
  ] },
};
