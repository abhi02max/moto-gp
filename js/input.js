export class Input {
  constructor() {
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.gamepadSteer = [0, 0];
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressedThisFrame.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
  }

  down(code) {
    return this.keys.has(code);
  }

  pressed(code) {
    return this.pressedThisFrame.has(code);
  }

  anyPressed(codes) {
    return codes.some((c) => this.pressedThisFrame.has(c));
  }

  endFrame() {
    this.pressedThisFrame.clear();
  }

  pollGamepads() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    this.gamepadSteer[0] = 0;
    this.gamepadSteer[1] = 0;
    let pi = 0;
    for (const pad of pads) {
      if (!pad || !pad.connected) continue;
      if (pi >= 2) break;
      const ax = pad.axes[0] || 0;
      this.gamepadSteer[pi] = Math.abs(ax) > 0.15 ? ax : 0;
      pi++;
    }
  }

  playerControls(i) {
    const gp = this.gamepadSteer[i] || 0;
    if (i === 0) {
      const keySteer = (this.down('KeyA') ? 1 : 0) - (this.down('KeyD') ? 1 : 0);
      return {
        throttle: this.down('KeyW') ? 1 : 0,
        brake: this.down('KeyS') ? 1 : 0,
        steer: gp !== 0 ? -gp : keySteer,
        boost: this.down('ShiftLeft') || this.down('Space'),
      };
    }
    const keySteer = (this.down('ArrowLeft') ? 1 : 0) - (this.down('ArrowRight') ? 1 : 0);
    return {
      throttle: this.down('ArrowUp') ? 1 : 0,
      brake: this.down('ArrowDown') ? 1 : 0,
      steer: gp !== 0 ? -gp : keySteer,
      boost: this.down('ShiftRight') || this.down('Numpad0'),
    };
  }
}
