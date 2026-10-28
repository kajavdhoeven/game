// Alles wat de speler heeft gespeeld en gekocht, bewaard in localStorage.
export const PRICES = {
  wheelchair: 2500,
  cow: 7500,
  train: 15000,
  skin_conductor: 50000,
  board_cow: 10000,
};

export const VEHICLES = {
  wheelchair: { id: 'wheelchair', name: 'Rolstoel', price: PRICES.wheelchair, speed: 1.25, coins: 2, desc: 'Teun vliegt 30 seconden, 1,25x sneller, 2x munten.' },
  cow: { id: 'cow', name: 'Koe', price: PRICES.cow, speed: 2, coins: 5, desc: 'Teun rijdt 30 seconden op een koe, 2x sneller, 5x munten.' },
  train: { id: 'train', name: 'NS-trein', price: PRICES.train, speed: 3, coins: 10, desc: 'Teun surft 30 seconden op een NS-trein, 3x sneller, 10x munten.' },
};
export const VEHICLE_ORDER = ['wheelchair', 'cow', 'train'];
export const VEHICLE_TIME = 30;

const KEY = 'teun-save-v2';

function uuid() {
  try {
    if (crypto.randomUUID) return crypto.randomUUID();
  } catch (e) { /* oudere browser */ }
  return 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const defaults = () => ({
  pid: uuid(),
  name: '',
  coins: 0,
  best: 0,
  bestDist: 0,
  bestCoins: 0,
  owned: {},
  vehicle: null,
  skin: 'teun',
  board: 'orange',
  runs: 0,
  totalDist: 0,
  spotters: 0,
});

export const P = defaults();

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(P, defaults(), JSON.parse(raw));
    else {
      // oude versie meenemen
      P.best = +localStorage.getItem('teun-best') || 0;
      P.coins = +localStorage.getItem('teun-coins') || 0;
    }
  } catch (e) { /* geen opslag */ }
  if (P.vehicle && !P.owned[P.vehicle]) P.vehicle = null;
  if (!P.vehicle) P.vehicle = VEHICLE_ORDER.find((v) => P.owned[v]) || null;
  return P;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(P));
  } catch (e) { /* geen opslag */ }
}

export function owns(id) {
  return !!P.owned[id];
}

export function buy(id) {
  const price = PRICES[id];
  if (price == null || P.owned[id] || P.coins < price) return false;
  P.coins -= price;
  P.owned[id] = true;
  if (VEHICLES[id] && !P.vehicle) P.vehicle = id;
  save();
  return true;
}

export function ownedVehicles() {
  return VEHICLE_ORDER.filter((v) => P.owned[v]);
}

export function cycleVehicle(dir = 1) {
  const list = ownedVehicles();
  if (!list.length) return null;
  const i = Math.max(0, list.indexOf(P.vehicle));
  P.vehicle = list[(i + dir + list.length) % list.length];
  save();
  return P.vehicle;
}
