const COUNTDOWN_SECONDS = 3;
const GO_DISPLAY_SECONDS = 0.8;
const WRONG_WAY_TRIGGER = 0.6;

function wrappedDelta(prev, cur) {
  let d = cur - prev;
  if (d > 0.5) d -= 1;
  if (d < -0.5) d += 1;
  return d;
}

export class RaceManager {
  constructor(trackHandle, callbacks = {}) {
    this.track = trackHandle;
    this.totalLaps = trackHandle.laps;
    this.callbacks = callbacks;
    this.reset();
  }

  reset() {
    this.state = 'idle';
    this.countdownRemaining = COUNTDOWN_SECONDS;
    this.goTimer = 0;
    this._lastShownCount = null;
    this.prevProgress = 0;
    this.nextCheckpoint = 0;
    this.lapIndex = 0;
    this.lapTimes = [];
    this.currentLapTime = 0;
    this.raceTime = 0;
    this.bestLapMs = Infinity;
    this.wrongWay = false;
    this._wrongWayTimer = 0;
    this.finished = false;
  }

  startCountdown() {
    this.reset();
    this.state = 'countdown';
  }

  update(dt, progress, speedMs = 0) {
    if (this.state === 'countdown') {
      this.countdownRemaining -= dt;
      const shown = Math.max(0, Math.ceil(this.countdownRemaining));
      if (shown !== this._lastShownCount) {
        this._lastShownCount = shown;
        if (shown > 0) this.callbacks.onCountdownTick?.(shown);
      }
      if (this.countdownRemaining <= 0) {
        this.goTimer += dt;
        if (this._lastShownCount !== 0) {
          this._lastShownCount = 0;
          this.callbacks.onGo?.();
        }
        if (this.goTimer >= GO_DISPLAY_SECONDS) {
          this.state = 'racing';
          this.prevProgress = progress;
        }
      }
      return;
    }

    if (this.state !== 'racing') return;

    this.raceTime += dt;
    this.currentLapTime += dt;

    const delta = wrappedDelta(this.prevProgress, progress);

    if (speedMs > 2 && delta < -0.0015) {
      this._wrongWayTimer += dt;
    } else {
      this._wrongWayTimer = Math.max(0, this._wrongWayTimer - dt * 2);
    }
    const wrongNow = this._wrongWayTimer > WRONG_WAY_TRIGGER;
    if (wrongNow !== this.wrongWay) {
      this.wrongWay = wrongNow;
      this.callbacks.onWrongWayChange?.(wrongNow);
    }

    const cps = this.track.checkpoints;
    if (this.nextCheckpoint < cps.length) {
      const target = cps[this.nextCheckpoint];
      if (this.prevProgress < target && progress >= target) {
        this.nextCheckpoint++;
        this.callbacks.onCheckpoint?.(this.nextCheckpoint, cps.length);
      }
    }

    // Lap completion = wrap around the start/finish line while moving forward.
    if (this.prevProgress > 0.85 && progress < 0.15 && delta > 0) {
      const allCheckpointsHit = this.nextCheckpoint >= cps.length;
      if (allCheckpointsHit) {
        const lapMs = Math.round(this.currentLapTime * 1000);
        this.lapTimes.push(lapMs);
        if (lapMs < this.bestLapMs) this.bestLapMs = lapMs;
        this.lapIndex++;
        this.currentLapTime = 0;
        this.nextCheckpoint = 0;
        this.callbacks.onLapCompleted?.(lapMs, this.lapIndex);

        if (this.lapIndex >= this.totalLaps) {
          this.state = 'finished';
          this.finished = true;
          this.callbacks.onFinished?.({
            lapTimes: this.lapTimes.slice(),
            totalMs: Math.round(this.raceTime * 1000),
            bestLapMs: this.bestLapMs,
          });
        }
      } else {
        this.nextCheckpoint = 0;
        this.callbacks.onInvalidLap?.();
      }
    }

    this.prevProgress = progress;
  }
}
