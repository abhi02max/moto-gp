import * as THREE from 'three';
import { clamp, damp, lerp } from './utils.js';

export class ChaseCamera {
  constructor(fov = 62) {
    this.cam = new THREE.PerspectiveCamera(fov, 1, 0.4, 7000);
    this.baseFov = fov;
    this.pos = new THREE.Vector3();
    this.look = new THREE.Vector3();
    this.shake = 0;
    this.mode = 0;
    this.initialized = false;
  }

  reset() {
    this.initialized = false;
  }

  update(bike, dt, opts = {}) {
    const spd = Math.abs(bike.speed);
    const frac = clamp(spd / 88, 0, 1);
    const far = this.mode === 1 ? 1.55 : 1;
    const back = (7.6 + spd * 0.055) * far;
    const high = (3.0 + spd * 0.014) * (this.mode === 1 ? 1.5 : 1);
    const fx = Math.sin(bike.yaw);
    const fz = Math.cos(bike.yaw);
    const rx = fz;
    const rz = -fx;
    const leanBias = -bike.lean * 2.2;

    const dx = bike.pos.x - fx * back + rx * leanBias;
    const dy = bike.pos.y + high;
    const dz = bike.pos.z - fz * back + rz * leanBias;

    if (!this.initialized) {
      this.pos.set(dx, dy, dz);
      this.look.copy(bike.pos);
      this.initialized = true;
    }
    const lam = 7.5;
    this.pos.x = damp(this.pos.x, dx, lam, dt);
    this.pos.y = damp(this.pos.y, dy, lam, dt);
    this.pos.z = damp(this.pos.z, dz, lam, dt);

    const lookAhead = 4 + spd * 0.14;
    const lx = bike.pos.x + fx * lookAhead;
    const ly = bike.pos.y + 1.3;
    const lz = bike.pos.z + fz * lookAhead;
    const lLam = 9;
    this.look.x = damp(this.look.x, lx, lLam, dt);
    this.look.y = damp(this.look.y, ly, lLam, dt);
    this.look.z = damp(this.look.z, lz, lLam, dt);

    let shakeMag = this.shake;
    if (opts.shake) shakeMag += opts.shake;
    shakeMag += frac * frac * 0.05;
    if (shakeMag > 0) {
      this.cam.position.set(
        this.pos.x + (Math.random() - 0.5) * shakeMag,
        this.pos.y + (Math.random() - 0.5) * shakeMag,
        this.pos.z + (Math.random() - 0.5) * shakeMag
      );
    } else {
      this.cam.position.copy(this.pos);
    }
    this.cam.up.set(0, 1, 0);
    this.cam.lookAt(this.look);

    const targetFov = this.baseFov + 20 * frac + (bike.boosting ? 6 : 0);
    this.cam.fov = damp(this.cam.fov, targetFov, 4, dt);
    this.cam.updateProjectionMatrix();
    this.shake = Math.max(0, this.shake - dt * 2);
  }
}
