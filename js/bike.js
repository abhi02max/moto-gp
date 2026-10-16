import * as THREE from 'three';
import { clamp, damp } from './utils.js';

export const BIKE_TUNE = {
  mass: 250,
  enginePower: 3400,
  maxSpeed: 88,
  maxReverse: 6,
  brakeForce: 6500,
  drag: 0.28,
  rolling: 14,
  offroadDrag: 0.9,
  maxSteerRate: 2.4,
  maxLean: 0.6,
  boostTime: 3.4,
  boostThrust: 1800,
  wheelRadius: 0.33,
};

const hexToCss = (n) => '#' + n.toString(16).padStart(6, '0');

function numberTexture(number, color) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = hexToCss(color);
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 108, 128, 20);
  ctx.font = 'bold 88px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#0b0e15';
  ctx.strokeText(String(number), 64, 62);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(String(number), 64, 62);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildBikeMesh(color, number) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.5, roughness: 0.32 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.45, roughness: 0.5 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0e, metalness: 0.05, roughness: 0.92 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0xc4ccd6, metalness: 0.9, roughness: 0.22 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x233041, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.55 });
  const suitMat = new THREE.MeshStandardMaterial({ color, metalness: 0.25, roughness: 0.6 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.2, roughness: 0.6 });
  for (const m of [bodyMat, darkMat, metalMat, suitMat]) m.envMapIntensity = 0.75;

  const wheelGeo = new THREE.CylinderGeometry(BIKE_TUNE.wheelRadius, BIKE_TUNE.wheelRadius, 0.17, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.18, 16);
  rimGeo.rotateZ(Math.PI / 2);

  const forkPivot = new THREE.Group();
  forkPivot.position.set(0, BIKE_TUNE.wheelRadius, 0.72);
  const frontWheel = new THREE.Mesh(wheelGeo, tireMat);
  const frontRim = new THREE.Mesh(rimGeo, metalMat);
  forkPivot.add(frontWheel, frontRim);
  g.add(forkPivot);

  const rearWheel = new THREE.Mesh(wheelGeo, tireMat);
  const rearRim = new THREE.Mesh(rimGeo, metalMat);
  rearWheel.position.set(0, BIKE_TUNE.wheelRadius, -0.72);
  rearRim.position.set(0, BIKE_TUNE.wheelRadius, -0.72);
  g.add(rearWheel, rearRim);

  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    g.add(m);
    return m;
  };

  add(new THREE.BoxGeometry(0.5, 0.42, 1.3), bodyMat, 0, 0.46, 0.02);
  add(new THREE.BoxGeometry(0.4, 0.32, 0.98), bodyMat, 0, 0.8, -0.12);
  add(new THREE.BoxGeometry(0.44, 0.5, 0.62), bodyMat, 0, 0.72, 0.6, -0.28, 0, 0);
  add(new THREE.BoxGeometry(0.36, 0.34, 0.5), darkMat, 0, 0.92, -0.72);
  add(new THREE.BoxGeometry(0.34, 0.3, 0.05), glassMat, 0, 0.98, 0.85, -0.35, 0, 0);

  add(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), metalMat, -0.13, 0.55, 0.62, 0.5, 0, 0);
  add(new THREE.CylinderGeometry(0.045, 0.045, 0.62, 8), metalMat, 0.13, 0.55, 0.62, 0.5, 0, 0);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), darkMat, 0, 0.92, 0.5, 0, 0, Math.PI / 2);

  add(new THREE.CylinderGeometry(0.09, 0.09, 0.66, 10), metalMat, 0.26, 0.5, -0.5, Math.PI / 2 - 0.12, 0, 0);
  add(new THREE.BoxGeometry(0.16, 0.14, 0.6), darkMat, 0, 0.4, -0.5);

  add(new THREE.BoxGeometry(0.34, 0.5, 0.36), suitMat, 0, 1.12, -0.18, 0.5, 0, 0);
  add(new THREE.SphereGeometry(0.17, 14, 12), suitMat, 0, 1.44, -0.02);
  add(new THREE.BoxGeometry(0.3, 0.14, 0.16), glassMat, 0, 1.42, 0.13);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), suitMat, -0.2, 1.05, 0.28, 0.9, 0, 0.2);
  add(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 8), suitMat, 0.2, 1.05, 0.28, 0.9, 0, -0.2);
  add(new THREE.BoxGeometry(0.16, 0.44, 0.2), suitMat, -0.2, 0.7, -0.2, 0.4, 0, 0);
  add(new THREE.BoxGeometry(0.16, 0.44, 0.2), suitMat, 0.2, 0.7, -0.2, 0.4, 0, 0);

  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xfff0c0, emissiveIntensity: 0.5, roughness: 0.3 });
  add(new THREE.BoxGeometry(0.26, 0.12, 0.06), headMat, 0, 0.78, 0.9);
  const brakeMat = new THREE.MeshStandardMaterial({ color: 0x3a0808, emissive: 0xff2020, emissiveIntensity: 0.7, roughness: 0.4 });
  add(new THREE.BoxGeometry(0.2, 0.1, 0.06), brakeMat, 0, 0.98, -0.96);

  const plateMat = new THREE.MeshStandardMaterial({ map: numberTexture(number, color), roughness: 0.6 });
  add(new THREE.PlaneGeometry(0.42, 0.42), plateMat, -0.23, 0.72, -0.1, 0, -Math.PI / 2, 0);
  add(new THREE.PlaneGeometry(0.42, 0.42), plateMat, 0.23, 0.72, -0.1, 0, Math.PI / 2, 0);
  const plateFront = add(new THREE.PlaneGeometry(0.3, 0.3), plateMat, 0, 0.95, 0.86, -0.35, 0, 0);

  g.scale.setScalar(0.92);
  return { group: g, frontWheel, rearWheel, forkPivot, brakeMat, plateFront };
}

export class Bike {
  constructor(opts) {
    const { track, isPlayer, playerIndex = 0, color, number, name, profile } = opts;
    this.track = track;
    this.isPlayer = isPlayer;
    this.playerIndex = playerIndex;
    this.color = color;
    this.number = number;
    this.name = name;
    this.profile = profile || { speed: 0.9, corner: 0.92 };
    this.maxSpeedScale = this.profile.speed || 0.9;

    const built = buildBikeMesh(color, number);
    this.mesh = built.group;
    this.frontWheel = built.frontWheel;
    this.rearWheel = built.rearWheel;
    this.forkPivot = built.forkPivot;
    this.brakeMat = built.brakeMat;

    this.pos = new THREE.Vector3();
    this.yaw = 0;
    this.speed = 0;
    this.steer = 0;
    this.lean = 0;
    this.wheelSpin = 0;
    this.nearIndex = -1;
    this.progress = 0;
    this.prevProgress = 0;
    this.lateral = 0;
    this.offroad = false;
    this.boosting = false;
    this.boostMeter = BIKE_TUNE.boostTime;
    this.hitWall = 0;

    this.completedLaps = -1;
    this.totalDist = 0;
    this.lapTimer = 0;
    this.bestLap = null;
    this.lastLap = null;
    this.raceTime = 0;
    this.finished = false;
    this.finishTime = null;
    this.racing = false;
    this.events = [];

    this.emitDust = false;
    this.emitSmoke = false;
    this.emitBoost = false;
  }

  place(x, y, z, yaw) {
    this.pos.set(x, y, z);
    this.yaw = yaw;
    this.speed = 0;
    this.steer = 0;
    this.lean = 0;
    this.nearIndex = -1;
    const near = this.track.nearest(this.pos, -1);
    this.nearIndex = near.index;
    this.progress = near.progress;
    this.prevProgress = near.progress;
    this.lateral = near.lateral;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, yaw, 0, 'YXZ');
  }

  resetState(lapsTotal) {
    this.lapsTotal = lapsTotal;
    this.completedLaps = -1;
    this.totalDist = this.progress - this.track.length;
    this.lapTimer = 0;
    this.bestLap = null;
    this.lastLap = null;
    this.finished = false;
    this.finishTime = null;
    this.raceTime = 0;
    this.boostMeter = BIKE_TUNE.boostTime;
    this.events.length = 0;
  }

  crossingLine() {
    this.completedLaps++;
    if (this.completedLaps >= 1 && this.lapTimer > 0) {
      this.lastLap = this.lapTimer;
      if (this.bestLap == null || this.lastLap < this.bestLap) {
        this.bestLap = this.lastLap;
        this.events.push('best');
      }
    }
    this.lapTimer = 0;
    if (this.finished) return;
    if (this.completedLaps >= this.lapsTotal) {
      this.finished = true;
      this.finishTime = this.raceTime;
      this.events.push('finish');
    } else if (this.lapsTotal - this.completedLaps === 1) {
      this.events.push('final');
    } else {
      this.events.push('lap');
    }
  }

  update(dt, c) {
    const T = BIKE_TUNE;
    const speedAbs = Math.abs(this.speed);

    if (this.racing && !this.finished) this.lapTimer += dt;

    if (c.boost && this.boostMeter > 0.05 && this.speed > 3) {
      this.boosting = true;
      this.boostMeter = Math.max(0, this.boostMeter - dt);
    } else {
      this.boosting = false;
      this.boostMeter = Math.min(T.boostTime, this.boostMeter + dt * 0.22);
    }

    const speedFrac = clamp(speedAbs / T.maxSpeed, 0, 1);
    const steerAuth = clamp(speedAbs / 7, 0, 1) * (1 - 0.3 * speedFrac);
    this.steer = damp(this.steer, c.steer * steerAuth, 15, dt);
    this.yaw += this.steer * T.maxSteerRate * dt * (this.speed >= 0 ? 1 : -1);

    let accel = 0;
    const maxS = T.maxSpeed * this.maxSpeedScale * (this.boosting ? 1.1 : 1);
    if (c.throttle > 0) {
      const power = T.enginePower * c.throttle + (this.boosting ? T.boostThrust : 0);
      accel += power / T.mass;
    }
    accel -= (T.drag * this.speed * speedAbs) / T.mass;
    accel -= (T.rolling * this.speed) / T.mass;
    if (c.brake > 0) {
      const bf = T.brakeForce * c.brake;
      if (this.speed > 0.4) accel -= bf / T.mass;
      else if (this.speed > -T.maxReverse) accel -= bf * 0.22 / T.mass;
    }
    if (this.offroad) accel -= (T.offroadDrag * this.speed * speedAbs) / T.mass;
    if (c.throttle < 0.05 && c.brake < 0.05) accel -= (70 * this.speed) / T.mass;

    this.speed += accel * dt;
    this.speed = clamp(this.speed, -T.maxReverse, maxS);
    if (Math.abs(this.speed) < 0.03) this.speed = 0;

    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;

    const near = this.track.nearest(this.pos, this.nearIndex);
    this.nearIndex = near.index;
    const half = this.track.halfWidth;
    const limit = this.track.boundary;
    const lat = near.lateral;
    this.lateral = lat;
    this.offroad = Math.abs(lat) > half && Math.abs(lat) <= limit;
    if (Math.abs(lat) > limit) {
      const sm = near.sample;
      const sign = Math.sign(lat) || 1;
      const push = Math.abs(lat) - limit;
      this.pos.x -= sm.right.x * sign * push;
      this.pos.z -= sm.right.z * sign * push;
      this.speed *= 0.62;
      this.hitWall = 0.22;
    }
    this.hitWall = Math.max(0, this.hitWall - dt);
    this.pos.y = near.sample.p.y + 0.0;

    this.prevProgress = this.progress;
    this.progress = near.progress;
    const L = this.track.length;
    if (this.progress < this.prevProgress - L * 0.5) this.crossingLine();
    else if (this.progress > this.prevProgress + L * 0.5) this.completedLaps--;
    this.totalDist = this.completedLaps * L + this.progress;

    const targetLean = clamp(c.steer, -1, 1) * T.maxLean * clamp(speedAbs / 13, 0, 1) * (1 - 0.18 * speedFrac);
    this.lean = damp(this.lean, targetLean, 8, dt);

    const tan = near.sample.tan;
    const pitch = -Math.asin(clamp(tan.y, -1, 1));
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(pitch, this.yaw, -this.lean, 'YXZ');

    this.wheelSpin += (this.speed * dt) / BIKE_TUNE.wheelRadius;
    this.frontWheel.rotation.x = this.wheelSpin;
    this.rearWheel.rotation.x = this.wheelSpin;
    this.forkPivot.rotation.y = this.steer * 0.45;
    this.brakeMat.emissiveIntensity = c.brake > 0.1 ? 2.6 : 0.7;
    this.throttle = c.throttle;

    this.emitDust = this.offroad && speedAbs > 4;
    this.emitSmoke = c.brake > 0.3 && speedAbs > 12;
    this.emitBoost = this.boosting;

    return near;
  }

  addRiderCollision(other, dt) {
    const dx = this.pos.x - other.pos.x;
    const dz = this.pos.z - other.pos.z;
    const d2 = dx * dx + dz * dz;
    const minD = 2.1;
    if (d2 > minD * minD || d2 < 1e-4) return;
    const d = Math.sqrt(d2);
    const push = (minD - d) * 0.5;
    const nx = dx / d;
    const nz = dz / d;
    this.pos.x += nx * push;
    this.pos.z += nz * push;
    other.pos.x -= nx * push;
    other.pos.z -= nz * push;
    this.speed *= 0.93;
    other.speed *= 0.93;
  }
}
