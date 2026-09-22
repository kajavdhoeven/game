const KEY_MAP = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  handbrake: ['Space'],
  boost: ['ShiftLeft', 'ShiftRight'],
};

export class InputController {
  constructor() {
    this.state = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
    this._keys = new Set();
    this._touch = { throttle: 0, brake: 0, steer: 0, handbrake: false, boost: false };
    this.onPause = null;
    this.onReset = null;

    this._onKeyDown = (e) => {
      if (e.code === 'Escape') {
        this.onPause?.();
        return;
      }
      if (e.code === 'KeyR') {
        this.onReset?.();
        return;
      }
      this._keys.add(e.code);
    };
    this._onKeyUp = (e) => this._keys.delete(e.code);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  _pressed(codes) {
    return codes.some((c) => this._keys.has(c));
  }

  setTouch(partial) {
    Object.assign(this._touch, partial);
  }

  update() {
    const kb = {
      throttle: this._pressed(KEY_MAP.throttle) ? 1 : 0,
      brake: this._pressed(KEY_MAP.brake) ? 1 : 0,
      left: this._pressed(KEY_MAP.left),
      right: this._pressed(KEY_MAP.right),
      handbrake: this._pressed(KEY_MAP.handbrake),
      boost: this._pressed(KEY_MAP.boost),
    };
    let steer = 0;
    if (kb.left) steer -= 1;
    if (kb.right) steer += 1;
    if (this._touch.steer) steer += this._touch.steer;
    steer = Math.max(-1, Math.min(1, steer));

    this.state.throttle = Math.max(kb.throttle, this._touch.throttle);
    this.state.brake = Math.max(kb.brake, this._touch.brake);
    this.state.steer = steer;
    this.state.handbrake = kb.handbrake || this._touch.handbrake;
    this.state.boost = kb.boost || this._touch.boost;
    return this.state;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}
