import * as THREE from 'three';

function discTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export class Effects {
  constructor(scene, max = 900) {
    this.max = max;
    this.cursor = 0;
    const geo = new THREE.BufferGeometry();
    this.posArr = new Float32Array(max * 3);
    this.colArr = new Float32Array(max * 4);
    for (let i = 0; i < max; i++) this.posArr[i * 3 + 1] = -9999;
    geo.setAttribute('position', new THREE.BufferAttribute(this.posArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colArr, 4));
    const mat = new THREE.PointsMaterial({
      size: 1.7,
      map: discTexture(),
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      sizeAttenuation: true,
      blending: THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    scene.add(this.points);
    this.p = [];
    for (let i = 0; i < max; i++) {
      this.p.push({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 1, g: 1, b: 1, a: 1, grav: 0, drag: 0 });
    }
  }

  spawn(x, y, z, vx, vy, vz, r, g, b, life, size = 1, grav = 0, drag = 1.6, alpha = 0.55) {
    const p = this.p[this.cursor];
    this.cursor = (this.cursor + 1) % this.max;
    p.life = life;
    p.max = life;
    p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.r = r; p.g = g; p.b = b;
    p.a = alpha;
    p.grav = grav;
    p.drag = drag;
    p.size = size;
    return p;
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const p = this.p[i];
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        this.posArr[i * 3 + 1] = -9999;
        this.colArr[i * 4 + 3] = 0;
        continue;
      }
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      const t = p.life / p.max;
      this.posArr[i * 3] = p.x;
      this.posArr[i * 3 + 1] = p.y;
      this.posArr[i * 3 + 2] = p.z;
      this.colArr[i * 4] = p.r;
      this.colArr[i * 4 + 1] = p.g;
      this.colArr[i * 4 + 2] = p.b;
      this.colArr[i * 4 + 3] = p.a * t;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
