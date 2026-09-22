import * as THREE from 'three';
import { getSharedEnvironmentMap } from './env/EnvironmentMap.js';
import { getTrackById } from './track/TrackData.js';
import { MenuScene } from './game/MenuScene.js';
import { GameScene } from './game/GameScene.js';
import { MenuController } from './ui/MenuController.js';
import { PauseFinishController } from './ui/PauseFinishController.js';
import { InputController } from './core/InputController.js';
import { setupTouchControls } from './core/TouchControls.js';
import { soundManager } from './audio/SoundManager.js';
import * as storage from './utils/storage.js';

class App {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.envMap = getSharedEnvironmentMap(this.renderer);

    this.inputController = new InputController();
    this.inputController.onPause = () => this.togglePause();
    this.inputController.onReset = () => {
      if (this.state === 'racing' && this.gameScene) this.gameScene.resetToStart();
    };

    this.menuScene = new MenuScene(this.renderer, this.envMap);
    this.touchControls = setupTouchControls(this.inputController);

    this.menuController = new MenuController({
      menuScene: this.menuScene,
      soundManager,
      onPlay: (opts) => this.startGame(opts),
    });

    this.pauseFinish = new PauseFinishController({
      soundManager,
      onResume: () => this.setPaused(false),
      onRestart: () => {
        this.setPaused(false);
        this.gameScene?.resetToStart();
      },
      onQuit: () => this.quitToMenu(),
      onRetryFromFinish: () => this.gameScene?.resetToStart(),
    });

    this.state = 'loading';
    this.paused = false;
    this.gameScene = null;
    this._currentTrackId = null;

    window.addEventListener('resize', () => this._onResize());

    this._clock = new THREE.Clock();
    this._boot();
    requestAnimationFrame(() => this._tick());
  }

  async _boot() {
    const fill = document.getElementById('loading-bar-fill');
    const text = document.getElementById('loading-text');
    const messages = ['Wagenpark opbouwen…', 'Circuits tekenen…', 'Banden opwarmen…'];
    for (let i = 0; i < messages.length; i++) {
      text.textContent = messages[i];
      fill.style.width = `${((i + 1) / messages.length) * 100}%`;
      await new Promise((r) => setTimeout(r, 260));
    }
    await new Promise((r) => setTimeout(r, 150));
    document.getElementById('loading-screen').classList.add('hidden');
    this.menuController.show();
    this.state = 'menu';
  }

  startGame({ trackId, carColor, playerName }) {
    const trackDef = getTrackById(trackId);
    this._currentTrackId = trackId;

    if (this.gameScene) this.gameScene.dispose();

    this.gameScene = new GameScene({
      renderer: this.renderer,
      envMap: this.envMap,
      trackDef,
      carColor,
      soundManager,
      onFinished: (summary) => this._handleFinished(summary, playerName),
      onInvalidLap: () => this._showToast('Ronde ongeldig — je nam een kortere weg!'),
    });
    this.gameScene.onResize();

    this.menuController.hide();
    this.touchControls.show();
    this.state = 'racing';
    this.gameScene.startRace();
  }

  _handleFinished(summary, playerName) {
    const isNewRecord = storage.submitBestTime(this._currentTrackId, {
      lapMs: summary.bestLapMs,
      totalMs: summary.totalMs,
      playerName,
    });
    this.menuController.refreshBestTime();
    this.pauseFinish.showFinish(summary, isNewRecord);
  }

  _showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'race-toast';
    toast.textContent = message;
    document.getElementById('app').appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('visible'));
    setTimeout(() => {
      toast.classList.remove('visible');
      setTimeout(() => toast.remove(), 400);
    }, 2200);
  }

  togglePause() {
    if (this.state !== 'racing' || !this.gameScene) return;
    if (this.gameScene.raceManager.state === 'finished') return;
    this.setPaused(!this.paused);
  }

  setPaused(paused) {
    this.paused = paused;
    if (paused) this.pauseFinish.showPause();
    else this.pauseFinish.hidePause();
  }

  quitToMenu() {
    if (this.gameScene) {
      this.gameScene.dispose();
      this.gameScene = null;
    }
    this.pauseFinish.hideFinish();
    this.pauseFinish.hidePause();
    this.touchControls.hide();
    this.paused = false;
    this.state = 'menu';
    this.menuController.show();
  }

  _onResize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.menuScene.onResize();
    this.gameScene?.onResize();
  }

  _tick() {
    requestAnimationFrame(() => this._tick());
    const dt = Math.min(this._clock.getDelta(), 1 / 15);

    if (this.state === 'menu') {
      this.menuScene.update(dt);
      this.renderer.render(this.menuScene.scene, this.menuScene.camera);
    } else if (this.state === 'racing' && this.gameScene) {
      if (!this.paused) {
        const input = this.inputController.update();
        this.gameScene.update(dt, input);
      }
      this.renderer.render(this.gameScene.scene, this.gameScene.camera);
    }
  }
}

new App();
