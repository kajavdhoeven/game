function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

function bindHold(el, onDown, onUp) {
  const down = (e) => {
    e.preventDefault();
    onDown();
  };
  const up = (e) => {
    e.preventDefault();
    onUp();
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointerleave', up);
  el.addEventListener('pointercancel', up);
}

export function setupTouchControls(inputController) {
  const container = document.getElementById('touch-controls');
  if (!isTouchDevice()) return { show() {}, hide() {} };

  const left = document.getElementById('touch-left');
  const right = document.getElementById('touch-right');
  const gas = document.getElementById('touch-gas');
  const brake = document.getElementById('touch-brake');
  const drift = document.getElementById('touch-drift');
  const nos = document.getElementById('touch-nos');

  let steerLeft = false;
  let steerRight = false;
  const updateSteer = () => inputController.setTouch({ steer: (steerRight ? 1 : 0) - (steerLeft ? 1 : 0) });

  bindHold(
    left,
    () => {
      steerLeft = true;
      updateSteer();
    },
    () => {
      steerLeft = false;
      updateSteer();
    }
  );
  bindHold(
    right,
    () => {
      steerRight = true;
      updateSteer();
    },
    () => {
      steerRight = false;
      updateSteer();
    }
  );
  bindHold(
    gas,
    () => inputController.setTouch({ throttle: 1, boost: false }),
    () => inputController.setTouch({ throttle: 0 })
  );
  bindHold(
    brake,
    () => inputController.setTouch({ brake: 1 }),
    () => inputController.setTouch({ brake: 0 })
  );
  bindHold(
    drift,
    () => inputController.setTouch({ handbrake: true }),
    () => inputController.setTouch({ handbrake: false })
  );
  bindHold(
    nos,
    () => inputController.setTouch({ boost: true }),
    () => inputController.setTouch({ boost: false })
  );

  gas.addEventListener('dblclick', (e) => e.preventDefault());

  return {
    show() {
      container.classList.remove('hidden');
    },
    hide() {
      container.classList.add('hidden');
    },
  };
}
