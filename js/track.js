import * as THREE from 'three';
import { clamp, smoothArray, mulberry32 } from './utils.js';
import { terrainHeight } from './tracks.js';

const UP = new THREE.Vector3(0, 1, 0);

function lerpColor(a, b, t, out) {
  out.setHex(a).lerp(new THREE.Color(b), t);
  return out;
}

export class Track {
  constructor(def, seed = 90210) {
    this.def = def;
    this.rand = mulberry32(seed);
    this.halfWidth = def.roadWidth / 2;
    this.kerbWidth = 1.5;
    this.runoff = 2.4;
    this.boundary = this.halfWidth + this.kerbWidth + this.runoff;
    this.group = new THREE.Group();
    this.surfaceLift = 0.32;
    this.startLights = { red: [], green: [] };
    this.build();
  }

  build() {
    this._buildCurve();
    this._buildSamples();
    this._buildGround();
    this._buildRoad();
    this._buildKerbs();
    this._buildBarriers();
    this._buildStart();
    this._buildScenery();
    this._buildSky();
    this._buildNeon();
  }

  _buildCurve() {
    const def = this.def;
    const NC = 52;
    const pts = [];
    for (let i = 0; i < NC; i++) {
      const t = (i / NC) * Math.PI * 2;
      let r = def.radius;
      for (const h of def.harmonics) r += def.radius * h.a * Math.sin(h.k * t + (h.phase || 0));
      const x = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      const y = terrainHeight(def, x, z) + this.surfaceLift;
      pts.push(new THREE.Vector3(x, y, z));
    }
    this.curve = new THREE.CatmullRomCurve3(pts, true, 'catmullrom', 0.5);
  }

  _buildSamples() {
    const def = this.def;
    const M = 760;
    const sp = this.curve.getSpacedPoints(M);
    sp.pop();
    const n = sp.length;
    this.samples = [];
    for (let i = 0; i < n; i++) {
      const prev = sp[(i - 1 + n) % n];
      const cur = sp[i];
      const next = sp[(i + 1) % n];
      const tan = new THREE.Vector3().subVectors(next, prev).normalize();
      const right = new THREE.Vector3().crossVectors(UP, tan).normalize();
      this.samples.push({ p: cur, tan, right, s: 0, curv: 0, cornerSpeed: 0 });
    }
    let acc = 0;
    this.samples[0].s = 0;
    for (let i = 1; i < n; i++) {
      acc += this.samples[i - 1].p.distanceTo(this.samples[i].p);
      this.samples[i].s = acc;
    }
    acc += this.samples[n - 1].p.distanceTo(this.samples[0].p);
    this.length = acc;
    this.spacing = acc / n;

    const raw = new Array(n);
    for (let i = 0; i < n; i++) {
      const a = this.samples[(i - 1 + n) % n].tan;
      const b = this.samples[(i + 1) % n].tan;
      const cross = a.clone().cross(b);
      const ang = Math.asin(clamp(cross.length(), 0, 1)) * Math.sign(cross.y || 1);
      raw[i] = ang / (2 * this.spacing);
    }
    const smoothed = smoothArray(raw, 6, true);
    const grip = def.grip || 20;
    const top = def.topSpeed || 92;
    const cs = new Array(n);
    for (let i = 0; i < n; i++) {
      this.samples[i].curv = smoothed[i];
      const k = Math.abs(smoothed[i]);
      cs[i] = k > 1e-5 ? clamp(Math.sqrt(grip / k), 12, top) : top;
    }
    for (let i = 0; i < n; i++) {
      let m = Infinity;
      for (let o = 0; o < 34; o++) m = Math.min(m, cs[(i + o) % n]);
      this.samples[i].cornerSpeed = Math.min(cs[i], m);
    }
    const line = [];
    for (let i = 0; i < n; i++) {
      line.push(clamp(this.samples[i].curv * 150, -1, 1) * this.halfWidth * 0.56);
    }
    this.raceline = smoothArray(smoothArray(line, 8, true), 8, true);
  }

  indexAt(s) {
    const n = this.samples.length;
    let x = ((s % this.length) + this.length) % this.length;
    const i = Math.round(x / this.spacing);
    return ((i % n) + n) % n;
  }

  worldAt(s, lat) {
    const i = this.indexAt(s);
    const sm = this.samples[i];
    return {
      x: sm.p.x + sm.right.x * lat,
      y: sm.p.y,
      z: sm.p.z + sm.right.z * lat,
      yaw: Math.atan2(sm.tan.x, sm.tan.z),
    };
  }

  nearest(pos, hint = -1) {
    const S = this.samples;
    const n = S.length;
    let best = -1;
    let bestD = Infinity;
    if (hint >= 0 && hint < n) {
      const win = 52;
      for (let o = -win; o <= win; o++) {
        const i = (hint + o + n * 2) % n;
        const d = S[i].p.distanceToSquared(pos);
        if (d < bestD) { bestD = d; best = i; }
      }
    } else {
      for (let i = 0; i < n; i++) {
        const d = S[i].p.distanceToSquared(pos);
        if (d < bestD) { bestD = d; best = i; }
      }
    }
    const sm = S[best];
    const dx = pos.x - sm.p.x;
    const dz = pos.z - sm.p.z;
    const lateral = dx * sm.right.x + dz * sm.right.z;
    const along = dx * sm.tan.x + dz * sm.tan.z;
    let progress = sm.s + along;
    if (progress < 0) progress += this.length;
    else if (progress >= this.length) progress -= this.length;
    return { index: best, progress, lateral, sample: sm };
  }

  _ribbon(offA, offB, yA, yB, vRepeat) {
    const n = this.samples.length;
    const pos = [];
    const uv = [];
    const idx = [];
    const cum = [0];
    for (let i = 1; i <= n; i++) {
      cum.push(cum[i - 1] + this.samples[(i - 1) % n].p.distanceTo(this.samples[i % n].p));
    }
    const total = cum[n];
    for (let i = 0; i <= n; i++) {
      const k = i % n;
      const sm = this.samples[k];
      const ya = sm.p.y + (typeof yA === 'function' ? yA(i) : yA);
      const yb = sm.p.y + (typeof yB === 'function' ? yB(i) : yB);
      pos.push(sm.p.x + sm.right.x * offA, ya, sm.p.z + sm.right.z * offA);
      uv.push(0, (cum[i] / total) * vRepeat);
      pos.push(sm.p.x + sm.right.x * offB, yb, sm.p.z + sm.right.z * offB);
      uv.push(1, (cum[i] / total) * vRepeat);
    }
    for (let i = 0; i < n; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      idx.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  _stripSegments(offA, offB, lift, colorFn) {
    const n = this.samples.length;
    const pos = [];
    const col = [];
    const idx = [];
    let v = 0;
    const c = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const s0 = this.samples[i];
      const s1 = this.samples[(i + 1) % n];
      colorFn(i, c);
      const y0 = s0.p.y + lift;
      const y1 = s1.p.y + lift;
      pos.push(
        s0.p.x + s0.right.x * offA, y0, s0.p.z + s0.right.z * offA,
        s0.p.x + s0.right.x * offB, y0, s0.p.z + s0.right.z * offB,
        s1.p.x + s1.right.x * offA, y1, s1.p.z + s1.right.z * offA,
        s1.p.x + s1.right.x * offB, y1, s1.p.z + s1.right.z * offB
      );
      for (let k = 0; k < 4; k++) col.push(c.r, c.g, c.b);
      idx.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
      v += 4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }

  _asphaltTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#3b3d42';
    ctx.fillRect(0, 0, 256, 256);
    const img = ctx.getImageData(0, 0, 256, 256);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * 34;
      d[i] += n; d[i + 1] += n; d[i + 2] += n;
    }
    ctx.putImageData(img, 0, 0);
    ctx.globalAlpha = 0.14;
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#1c1d20' : '#55585f';
      const s = 1 + Math.random() * 3;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, s, s);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e9ecf2';
    ctx.fillRect(0, 0, 9, 256);
    ctx.fillRect(247, 0, 9, 256);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(11, 0, 2, 256);
    ctx.fillRect(243, 0, 2, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  _buildGround() {
    const def = this.def;
    const t = def.theme;
    const size = 9000;
    const geo = new THREE.PlaneGeometry(size, size, 150, 150);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const colors = [];
    const cA = new THREE.Color(t.ground);
    const cB = new THREE.Color(t.groundAlt);
    const tmp = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const z = p.getZ(i);
      const h = terrainHeight(def, x, z);
      p.setY(i, h - 0.05);
      const n = Math.sin(x * 0.012) * Math.cos(z * 0.014) * 0.5 + 0.5;
      const patch = Math.sin(x * 0.06 + z * 0.04) * 0.5 + 0.5;
      tmp.copy(cA).lerp(cB, clamp(n * 0.7 + patch * 0.3, 0, 1));
      tmp.multiplyScalar(0.86 + clamp(h * 0.006, -0.14, 0.14));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
    mat.envMapIntensity = 0.25;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = false;
    this.group.add(mesh);
    this.groundMesh = mesh;
  }

  _buildRoad() {
    const geo = this._ribbon(-this.halfWidth, this.halfWidth, 0, 0, 46);
    const mat = new THREE.MeshStandardMaterial({
      map: this._asphaltTexture(),
      roughness: 0.82,
      metalness: 0.0,
      color: this.def.theme.neon ? 0x8a8f9c : 0xffffff,
    });
    mat.envMapIntensity = 0.4;
    this.roadMesh = new THREE.Mesh(geo, mat);
    this.group.add(this.roadMesh);
  }

  _buildKerbs() {
    const t = this.def.theme;
    const red = new THREE.Color(t.barrierAccent);
    const white = new THREE.Color(0xf2f4f8);
    const colorFn = (i, c) => c.copy(Math.floor(i / 3) % 2 === 0 ? red : white);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
    mat.envMapIntensity = 0.5;
    const hw = this.halfWidth;
    const kw = this.kerbWidth;
    const left = new THREE.Mesh(this._stripSegments(-hw - kw, -hw, 0.07, colorFn), mat);
    const right = new THREE.Mesh(this._stripSegments(hw, hw + kw, 0.07, colorFn), mat);
    this.group.add(left, right);
  }

  _buildBarriers() {
    const t = this.def.theme;
    const b = this.boundary;
    const wallMat = new THREE.MeshStandardMaterial({ color: t.barrier, roughness: 0.6, metalness: 0.1, side: THREE.DoubleSide });
    wallMat.envMapIntensity = 0.5;
    const height = 0.95;
    const left = new THREE.Mesh(this._ribbon(-b, -b, 0.05, height, 20), wallMat);
    const right = new THREE.Mesh(this._ribbon(b, b, 0.05, height, 20), wallMat);
    this.group.add(left, right);

    const railMat = new THREE.MeshStandardMaterial({ color: t.barrierAccent, roughness: 0.45, metalness: 0.35, side: THREE.DoubleSide });
    railMat.envMapIntensity = 0.7;
    this.group.add(
      new THREE.Mesh(this._ribbon(-b - 0.06, -b - 0.06, height - 0.22, height, 20), railMat),
      new THREE.Mesh(this._ribbon(b + 0.06, b + 0.06, height - 0.22, height, 20), railMat)
    );

    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, 1.15, 6);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.5, metalness: 0.6 });
    const step = 14;
    const idxs = [];
    for (let i = 0; i < this.samples.length; i += step) idxs.push(i);
    const posts = new THREE.InstancedMesh(postGeo, postMat, idxs.length * 2);
    const m = new THREE.Matrix4();
    let idx = 0;
    for (const i of idxs) {
      for (const sign of [-1, 1]) {
        const sm = this.samples[i];
        m.makeTranslation(sm.p.x + sm.right.x * b * sign, sm.p.y + 0.5, sm.p.z + sm.right.z * b * sign);
        posts.setMatrixAt(idx++, m);
      }
    }
    posts.count = idx;
    posts.instanceMatrix.needsUpdate = true;
    this.group.add(posts);
  }

  _checkerTexture() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const ctx = c.getContext('2d');
    const cols = 16, rows = 2;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f5f7fa' : '#15161a';
        ctx.fillRect((x / cols) * 256, (y / rows) * 32, 256 / cols + 1, 32 / rows + 1);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  _buildStart() {
    const s0 = this.samples[0];
    const p = s0.p;
    const r = s0.right;
    const tg = s0.tan;
    const w = this.halfWidth;
    const l = 1.6;
    const y = p.y + 0.03;
    const corners = [
      [p.x - r.x * w + tg.x * l, y, p.z - r.z * w + tg.z * l],
      [p.x + r.x * w + tg.x * l, y, p.z + r.z * w + tg.z * l],
      [p.x + r.x * w - tg.x * l, y, p.z + r.z * w - tg.z * l],
      [p.x - r.x * w - tg.x * l, y, p.z - r.z * w - tg.z * l],
    ];
    const g = new THREE.BufferGeometry();
    const verts = [];
    for (const c of corners) verts.push(c[0], c[1], c[2]);
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ map: this._checkerTexture(), roughness: 0.6, side: THREE.DoubleSide });
    this.group.add(new THREE.Mesh(g, mat));

    const t = this.def.theme;
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x1c2333, roughness: 0.5, metalness: 0.5 });
    const beamMat = new THREE.MeshStandardMaterial({ color: t.barrierAccent, roughness: 0.4, metalness: 0.3 });
    const pillarGeo = new THREE.CylinderGeometry(0.34, 0.34, 7.2, 10);
    for (const sign of [-1, 1]) {
      const pi = new THREE.Mesh(pillarGeo, pillarMat);
      pi.position.set(p.x + r.x * (w + 2.4) * sign, p.y + 3.6, p.z + r.z * (w + 2.4) * sign);
      this.group.add(pi);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry((w + 2.6) * 2, 1.5, 1.2), beamMat);
    beam.position.set(p.x, p.y + 6.4, p.z);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), r.clone());
    this.group.add(beam);

    const bannerMat = new THREE.MeshStandardMaterial({ color: 0x0d1220, roughness: 0.7, emissive: t.barrierAccent, emissiveIntensity: t.neon ? 0.8 : 0.15 });
    const banner = new THREE.Mesh(new THREE.BoxGeometry((w + 1.4) * 2, 1.4, 0.16), bannerMat);
    banner.position.set(p.x, p.y + 5.1, p.z);
    banner.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), r.clone());
    this.group.add(banner);

    const lightGeo = new THREE.SphereGeometry(0.32, 12, 10);
    for (let i = 0; i < 5; i++) {
      const isGreen = i >= 3;
      const mat2 = new THREE.MeshStandardMaterial({
        color: isGreen ? 0x0c3a1a : 0x3a0c0c,
        emissive: isGreen ? 0x22ff66 : 0xff2222,
        emissiveIntensity: 0.06,
        roughness: 0.3,
      });
      const sp = new THREE.Mesh(lightGeo, mat2);
      const off = (i - 2) * 1.5;
      sp.position.set(p.x + r.x * off + tg.x * 0.7, p.y + 6.4, p.z + r.z * off + tg.z * 0.7);
      this.group.add(sp);
      (isGreen ? this.startLights.green : this.startLights.red).push(mat2);
    }
  }

  _buildScenery() {
    const def = this.def;
    const t = def.theme;
    const rand = this.rand;
    const b = this.boundary;
    const trees = [];
    const rocks = [];
    const step = 9;
    for (let i = 0; i < this.samples.length; i += step) {
      const sm = this.samples[i];
      for (const sign of [-1, 1]) {
        if (rand() > 0.72) continue;
        const dist = b + 3 + rand() * 34;
        const x = sm.p.x + sm.right.x * dist * sign;
        const z = sm.p.z + sm.right.z * dist * sign;
        const y = terrainHeight(def, x, z);
        if (rand() > 0.28) trees.push({ x, y, z, s: 0.75 + rand() * 0.9, c: rand() > 0.5 });
        else rocks.push({ x, y, z, s: 0.6 + rand() * 1.6 });
      }
    }

    if (trees.length) {
      const trunkGeo = new THREE.CylinderGeometry(0.16, 0.22, 1.6, 6);
      trunkGeo.translate(0, 0.8, 0);
      const foliageGeo = new THREE.ConeGeometry(1.5, 4.2, 8);
      foliageGeo.translate(0, 3.2, 0);
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.95 });
      const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
      foliageMat.envMapIntensity = 0.3;
      const trunkIM = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
      const folIM = new THREE.InstancedMesh(foliageGeo, foliageMat, trees.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const pos = new THREE.Vector3();
      const scl = new THREE.Vector3();
      const cA = new THREE.Color(t.tree);
      const cB = new THREE.Color(t.treeAlt);
      const cc = new THREE.Color();
      trees.forEach((tr, i) => {
        pos.set(tr.x, tr.y, tr.z);
        scl.setScalar(tr.s);
        m.compose(pos, q, scl);
        trunkIM.setMatrixAt(i, m);
        folIM.setMatrixAt(i, m);
        cc.copy(tr.c ? cA : cB).multiplyScalar(0.85 + Math.random() * 0.3);
        folIM.setColorAt(i, cc);
      });
      trunkIM.instanceMatrix.needsUpdate = true;
      folIM.instanceMatrix.needsUpdate = true;
      folIM.instanceColor.needsUpdate = true;
      this.group.add(trunkIM, folIM);
    }

    if (rocks.length) {
      const rockGeo = new THREE.IcosahedronGeometry(1, 0);
      const rockMat = new THREE.MeshStandardMaterial({ color: t.rock, roughness: 0.95, flatShading: true });
      const im = new THREE.InstancedMesh(rockGeo, rockMat, rocks.length);
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const e = new THREE.Euler();
      rocks.forEach((rk, i) => {
        e.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        q.setFromEuler(e);
        m.compose(new THREE.Vector3(rk.x, rk.y + rk.s * 0.4, rk.z), q, new THREE.Vector3(rk.s, rk.s * 0.7, rk.s));
        im.setMatrixAt(i, m);
      });
      im.instanceMatrix.needsUpdate = true;
      this.group.add(im);
    }

    const mtGeo = new THREE.ConeGeometry(1, 1, 6);
    const mtColor = new THREE.Color(t.rock).lerp(new THREE.Color(t.fog), 0.4);
    const mtMat = new THREE.MeshStandardMaterial({ color: mtColor, roughness: 1, flatShading: true });
    mtMat.envMapIntensity = 0.12;
    const mtCount = 40;
    const mt = new THREE.InstancedMesh(mtGeo, mtMat, mtCount);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < mtCount; i++) {
      const ang = (i / mtCount) * Math.PI * 2 + rand() * 0.1;
      const rad = 1450 + rand() * 560;
      const x = Math.cos(ang) * rad;
      const z = Math.sin(ang) * rad;
      const h = 250 + rand() * 380;
      const w = h * (0.75 + rand() * 0.55);
      q.setFromEuler(new THREE.Euler(0, rand() * Math.PI, 0));
      m.compose(new THREE.Vector3(x, terrainHeight(def, x, z) + h / 2 - 40, z), q, new THREE.Vector3(w, h, w));
      mt.setMatrixAt(i, m);
    }
    mt.instanceMatrix.needsUpdate = true;
    this.group.add(mt);

    const gsMat = new THREE.MeshStandardMaterial({ color: t.grandstand, roughness: 0.7, metalness: 0.2 });
    for (const sign of [-1, 1]) {
      const gs = new THREE.Group();
      for (let row = 0; row < 4; row++) {
        const seg = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 3), gsMat);
        seg.position.set(0, row * 1.5, row * 3);
        gs.add(seg);
      }
      const i = this.indexAt(30 - sign * 12);
      const sm = this.samples[i];
      const dx = sm.right.x * sign;
      const dz = sm.right.z * sign;
      gs.position.set(sm.p.x + dx * (b + 10), sm.p.y + 0.6, sm.p.z + dz * (b + 10));
      gs.rotation.y = Math.atan2(dx, dz);
      this.group.add(gs);
    }
  }

  _buildNeon() {
    const t = this.def.theme;
    if (!t.neon) return;
    const glow = new THREE.MeshBasicMaterial({ color: t.barrierAccent });
    const b = this.boundary;
    this.group.add(
      new THREE.Mesh(this._ribbon(-b - 0.12, -b - 0.12, 0.9, 1.0, 20), glow),
      new THREE.Mesh(this._ribbon(b + 0.12, b + 0.12, 0.9, 1.0, 20), glow)
    );
    const poleGeo = new THREE.CylinderGeometry(0.12, 0.16, 9, 8);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x0e1420, roughness: 0.6, metalness: 0.4 });
    const bulbGeo = new THREE.SphereGeometry(0.5, 10, 8);
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8 });
    const step = 26;
    const count = Math.floor(this.samples.length / step);
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, count);
    const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, count);
    const m = new THREE.Matrix4();
    let idx = 0;
    for (let i = 0; i < this.samples.length; i += step) {
      const sm = this.samples[i];
      const x = sm.p.x + sm.right.x * (b + 3.5);
      const z = sm.p.z + sm.right.z * (b + 3.5);
      const gy = terrainHeight(this.def, x, z);
      m.makeTranslation(x, gy + 4.5, z);
      poles.setMatrixAt(idx, m);
      m.makeTranslation(x, gy + 9.4, z);
      bulbs.setMatrixAt(idx, m);
      idx++;
    }
    poles.count = idx;
    bulbs.count = idx;
    poles.instanceMatrix.needsUpdate = true;
    bulbs.instanceMatrix.needsUpdate = true;
    this.group.add(poles, bulbs);
  }

  _buildSky() {
    const t = this.def.theme;
    const geo = new THREE.SphereGeometry(3000, 32, 20);
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        topColor: { value: new THREE.Color(t.skyTop) },
        midColor: { value: new THREE.Color(t.skyMid) },
        bottomColor: { value: new THREE.Color(t.skyBottom) },
        sunColor: { value: new THREE.Color(t.sunColor) },
        sunDir: { value: new THREE.Vector3(...t.sunPos).normalize() },
        sunPower: { value: t.sunPower || 200 },
        night: { value: t.neon ? 1 : 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor, midColor, bottomColor, sunColor, sunDir;
        uniform float sunPower, night;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 0.5 + 0.5, 0.0, 1.0);
          vec3 col = h > 0.5 ? mix(midColor, topColor, (h - 0.5) * 2.0)
                             : mix(bottomColor, midColor, h * 2.0);
          float s = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
          col += sunColor * pow(s, sunPower) * (1.0 - night * 0.7);
          col += sunColor * pow(s, 10.0) * 0.5;
          if (night > 0.5) {
            float st = fract(sin(dot(floor(vDir.xz * 260.0), vec2(12.9898, 78.233))) * 43758.5453);
            col += vec3(0.9, 0.95, 1.0) * step(0.9975, st) * 0.8;
          }
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.frustumCulled = false;
    this.group.add(this.sky);
  }

  setStartLights(redCount, greenOn) {
    this.startLights.red.forEach((m, i) => { m.emissiveIntensity = i < redCount ? 1.7 : 0.06; });
    this.startLights.green.forEach((m) => { m.emissiveIntensity = greenOn ? 1.9 : 0.06; });
  }

  dispose() {
    this.group.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) {
          for (const k of Object.keys(m)) {
            const v = m[k];
            if (v && v.isTexture) v.dispose();
          }
          m.dispose();
        }
      }
    });
  }
}
