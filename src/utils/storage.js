const KEYS = {
  PLAYER_NAME: 'driftrally.playerName',
  CAR_COLOR: 'driftrally.carColor',
  SOUND_ON: 'driftrally.soundOn',
  BEST_TIMES: 'driftrally.bestTimes.v1',
};

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode, quota) - fail silently */
  }
}

export function getPlayerName() {
  return safeGet(KEYS.PLAYER_NAME) || '';
}

export function setPlayerName(name) {
  safeSet(KEYS.PLAYER_NAME, name.trim().slice(0, 16));
}

export function getCarColor() {
  return safeGet(KEYS.CAR_COLOR) || '#ff2e63';
}

export function setCarColor(hex) {
  safeSet(KEYS.CAR_COLOR, hex);
}

export function getSoundOn() {
  const v = safeGet(KEYS.SOUND_ON);
  return v === null ? true : v === '1';
}

export function setSoundOn(on) {
  safeSet(KEYS.SOUND_ON, on ? '1' : '0');
}

function readBestTimes() {
  try {
    const raw = safeGet(KEYS.BEST_TIMES);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Best times are keyed per track id, storing the best single lap and best total
 * race time seen for that track across all players on this browser.
 */
export function getBestTime(trackId) {
  const all = readBestTimes();
  return all[trackId] || null;
}

export function submitBestTime(trackId, { lapMs, totalMs, playerName }) {
  const all = readBestTimes();
  const existing = all[trackId] || { bestLapMs: Infinity, bestTotalMs: Infinity };
  let improved = false;

  if (lapMs > 0 && lapMs < existing.bestLapMs) {
    existing.bestLapMs = lapMs;
    existing.bestLapPlayer = playerName;
    improved = true;
  }
  if (totalMs > 0 && totalMs < existing.bestTotalMs) {
    existing.bestTotalMs = totalMs;
    existing.bestTotalPlayer = playerName;
    improved = true;
  }

  all[trackId] = existing;
  safeSet(KEYS.BEST_TIMES, JSON.stringify(all));
  return improved;
}
