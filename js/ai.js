import * as THREE from 'three';
import { clamp, wrapAngle, mulberry32 } from './utils.js';

export const DIFFICULTY = {
  rookie: { speed: 0.8, corner: 0.8, look: 0.95, name: 'Rookie' },
  pro: { speed: 0.905, corner: 0.92, look: 1.0, name: 'Pro' },
  legend: { speed: 0.98, corner: 1.0, look: 1.05, name: 'Legend' },
};

const tmpVec = new THREE.Vector3();

export class AIController {
  constructor(track, profile, seed) {
    this.track = track;
    this.profile = profile;
    this.rand = mulberry32(seed);
    this.wobble = this.rand() * 10;
    this.aggression = 0.5 + this.rand() * 0.7;
    this.mistakeTimer = 4 + this.rand() * 8;
    this.mistake = 0;
  }

  control(bike, dt, others) {
    const track = this.track;
    const prof = this.profile;
    const spd = Math.max(bike.speed, 6);
    const look = clamp(spd * 0.8, 12, 58) * prof.look;
    this.wobble += dt;

    const aimS = bike.progress + look;
    const aimI = track.indexAt(aimS);
    const sm = track.samples[aimI];
    let lat = track.raceline[aimI];
    lat += Math.sin(this.wobble * 0.9) * 0.5;

    if (others && others.length) {
      for (const o of others) {
        if (o === bike) continue;
        const dx = o.pos.x - bike.pos.x;
        const dz = o.pos.z - bike.pos.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 11 || dist < 0.1) continue;
        const fx = Math.sin(bike.yaw);
        const fz = Math.cos(bike.yaw);
        const ahead = (dx * fx + dz * fz) / dist;
        if (ahead < 0.72) continue;
        const rx = Math.cos(bike.yaw);
        const rz = -Math.sin(bike.yaw);
        const side = dx * rx + dz * rz;
        lat += (side > 0 ? -1 : 1) * clamp((11 - dist) * 0.5, 0, 3.2) * this.aggression;
      }
    }
    lat = clamp(lat, -track.halfWidth * 0.85, track.halfWidth * 0.85);

    tmpVec.set(sm.p.x + sm.right.x * lat, bike.pos.y, sm.p.z + sm.right.z * lat);
    const desired = Math.atan2(tmpVec.x - bike.pos.x, tmpVec.z - bike.pos.z);
    const diff = wrapAngle(desired - bike.yaw);
    let steer = clamp(diff * 2.1, -1, 1);

    let vmax = Infinity;
    const scan = clamp(spd * 1.25, 24, 130);
    for (let d = 0; d < scan; d += 4) {
      const i2 = track.indexAt(bike.progress + d + 5);
      vmax = Math.min(vmax, track.samples[i2].cornerSpeed);
    }
    vmax *= prof.corner;

    this.mistakeTimer -= dt;
    if (this.mistakeTimer <= 0) {
      this.mistakeTimer = 5 + this.rand() * 10;
      this.mistake = this.rand() < 0.5 ? 0.82 : 0;
    }

    let throttle = 0;
    let brake = 0;
    const dv = vmax - bike.speed;
    if (dv > 1.5) throttle = clamp(dv / 10, 0, 1);
    else if (dv < -1) brake = clamp(-dv / 9, 0, 1);
    else throttle = 0.55;
    throttle *= this.mistake > 0 ? 0.75 : 1;

    const boost = bike.boostMeter > 1.4 && spd > 45 && vmax > 60 && this.rand() > 0.6;

    return { throttle, brake, steer, boost };
  }
}
