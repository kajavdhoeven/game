import { TRACKS } from '../track/TrackData.js';
import * as storage from '../utils/storage.js';

const CAR_COLORS = ['#ff2e63', '#08d9d6', '#ffd23f', '#7cff6b', '#c77dff', '#f2f2f2'];

function formatTime(ms) {
  if (!ms || !isFinite(ms)) return '--:--.---';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msPart).padStart(3, '0')}`;
}

export class MenuController {
  constructor({ menuScene, soundManager, onPlay }) {
    this.menuScene = menuScene;
    this.soundManager = soundManager;
    this.onPlay = onPlay;

    this.el = {
      root: document.getElementById('main-menu'),
      nameInput: document.getElementById('player-name'),
      trackSelect: document.getElementById('track-select'),
      colorSelect: document.getElementById('color-select'),
      playButton: document.getElementById('play-button'),
      controlsButton: document.getElementById('controls-button'),
      controlsModal: document.getElementById('controls-modal'),
      controlsClose: document.getElementById('controls-close'),
      soundToggle: document.getElementById('sound-toggle'),
      bestTimeDisplay: document.getElementById('best-time-display'),
    };

    this.selectedTrackId = TRACKS[0].id;
    this.selectedColor = storage.getCarColor();

    this._buildTrackCards();
    this._buildColorSwatches();
    this._wireInputs();

    this.el.nameInput.value = storage.getPlayerName();
    this._updateSoundLabel();
    this._updateBestTime();
  }

  _buildTrackCards() {
    this.el.trackSelect.innerHTML = '';
    TRACKS.forEach((track, i) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'track-card' + (i === 0 ? ' selected' : '');
      card.dataset.trackId = track.id;
      card.innerHTML = `
        <div class="track-card-theme theme-${track.theme}"></div>
        <div class="track-card-body">
          <strong>${track.name}</strong>
          <span>${track.description}</span>
        </div>
      `;
      card.addEventListener('click', () => {
        this.selectedTrackId = track.id;
        [...this.el.trackSelect.children].forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');
        this._updateBestTime();
        this.soundManager.playUiClick();
      });
      this.el.trackSelect.appendChild(card);
    });
  }

  _buildColorSwatches() {
    this.el.colorSelect.innerHTML = '';
    CAR_COLORS.forEach((hex) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch' + (hex === this.selectedColor ? ' selected' : '');
      btn.style.background = hex;
      btn.addEventListener('click', () => {
        this.selectedColor = hex;
        [...this.el.colorSelect.children].forEach((c) => c.classList.remove('selected'));
        btn.classList.add('selected');
        this.menuScene.setCarColor(hex);
        storage.setCarColor(hex);
        this.soundManager.playUiClick();
      });
      this.el.colorSelect.appendChild(btn);
    });
    this.menuScene.setCarColor(this.selectedColor);
  }

  _wireInputs() {
    this.el.nameInput.addEventListener('input', () => {
      storage.setPlayerName(this.el.nameInput.value);
    });

    this.el.playButton.addEventListener('click', () => {
      this.soundManager.ensureStarted();
      this.soundManager.playUiClick();
      const name = this.el.nameInput.value.trim() || 'Speler';
      storage.setPlayerName(name);
      this.onPlay?.({ trackId: this.selectedTrackId, carColor: this.selectedColor, playerName: name });
    });

    this.el.controlsButton.addEventListener('click', () => {
      this.soundManager.playUiClick();
      this.el.controlsModal.classList.remove('hidden');
    });
    this.el.controlsClose.addEventListener('click', () => {
      this.soundManager.playUiClick();
      this.el.controlsModal.classList.add('hidden');
    });

    this.el.soundToggle.addEventListener('click', () => {
      this.soundManager.ensureStarted();
      const newState = !this.soundManager.enabled;
      this.soundManager.setEnabled(newState);
      storage.setSoundOn(newState);
      this._updateSoundLabel();
      if (newState) this.soundManager.playUiClick();
    });

    const savedSound = storage.getSoundOn();
    this.soundManager.setEnabled(savedSound);
  }

  _updateSoundLabel() {
    this.el.soundToggle.textContent = `Geluid: ${this.soundManager.enabled ? 'Aan' : 'Uit'}`;
  }

  _updateBestTime() {
    const best = storage.getBestTime(this.selectedTrackId);
    if (!best) {
      this.el.bestTimeDisplay.innerHTML = '<span>Nog geen tijd gereden op dit circuit</span>';
      return;
    }
    this.el.bestTimeDisplay.innerHTML = `
      <span>Beste ronde: <strong>${formatTime(best.bestLapMs)}</strong> ${best.bestLapPlayer ? `(${best.bestLapPlayer})` : ''}</span>
    `;
  }

  refreshBestTime() {
    this._updateBestTime();
  }

  show() {
    this.el.root.classList.remove('hidden');
  }
  hide() {
    this.el.root.classList.add('hidden');
  }
}
