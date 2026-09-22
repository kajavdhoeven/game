function formatTime(ms) {
  if (!isFinite(ms) || ms <= 0) return '00:00.000';
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 1000);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(msPart).padStart(3, '0')}`;
}

export class PauseFinishController {
  constructor({ soundManager, onResume, onRestart, onQuit, onRetryFromFinish }) {
    this.soundManager = soundManager;
    this.el = {
      pause: document.getElementById('pause-menu'),
      resume: document.getElementById('resume-button'),
      restart: document.getElementById('restart-button'),
      quit: document.getElementById('quit-button'),
      finish: document.getElementById('finish-screen'),
      finishTitle: document.getElementById('finish-title'),
      finishLaps: document.getElementById('finish-laps'),
      finishTotal: document.getElementById('finish-total-time'),
      finishBestLap: document.getElementById('finish-best-lap'),
      finishRecord: document.getElementById('finish-record'),
      finishRetry: document.getElementById('finish-retry'),
      finishMenu: document.getElementById('finish-menu'),
    };

    this.el.resume.addEventListener('click', () => {
      this.soundManager.playUiClick();
      this.hidePause();
      onResume?.();
    });
    this.el.restart.addEventListener('click', () => {
      this.soundManager.playUiClick();
      this.hidePause();
      onRestart?.();
    });
    this.el.quit.addEventListener('click', () => {
      this.soundManager.playUiClick();
      this.hidePause();
      onQuit?.();
    });
    this.el.finishRetry.addEventListener('click', () => {
      this.soundManager.playUiClick();
      this.hideFinish();
      onRetryFromFinish?.();
    });
    this.el.finishMenu.addEventListener('click', () => {
      this.soundManager.playUiClick();
      this.hideFinish();
      onQuit?.();
    });
  }

  showPause() {
    this.el.pause.classList.remove('hidden');
  }
  hidePause() {
    this.el.pause.classList.add('hidden');
  }

  showFinish(summary, isNewRecord) {
    this.el.finishLaps.innerHTML = '';
    summary.lapTimes.forEach((ms, i) => {
      const row = document.createElement('div');
      row.className = 'finish-lap-row';
      const isBest = ms === summary.bestLapMs;
      row.innerHTML = `<span>Ronde ${i + 1}</span><strong class="${isBest ? 'best' : ''}">${formatTime(ms)}</strong>`;
      this.el.finishLaps.appendChild(row);
    });
    this.el.finishTotal.textContent = formatTime(summary.totalMs);
    this.el.finishBestLap.textContent = formatTime(summary.bestLapMs);
    this.el.finishRecord.classList.toggle('hidden', !isNewRecord);
    this.el.finish.classList.remove('hidden');
  }
  hideFinish() {
    this.el.finish.classList.add('hidden');
  }
}
