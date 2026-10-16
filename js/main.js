import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TRACKS, RIDER_NAMES, RIDER_COLORS } from './tracks.js';
import { Track } from './track.js';
import { Bike, BIKE_TUNE } from './bike.js';
import { AIController, DIFFICULTY } from './ai.js';
import { Input } from './input.js';
import { ChaseCamera } from './camera.js';
import { Effects } from './effects.js';
import { EngineAudio } from './audio.js';
import { HUD } from './hud.js';
import { clamp } from './utils.js';

const hexCss = (n) => '#' + n.toString(16).padStart(6, '0');

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.autoClear = false;

    this.scene = new THREE.Scene();
    this.vignette = document.getElementById('vignette');
    this.camP1 = new ChaseCamera(62);
    this.camP2 = new ChaseCamera(62);
    this.menuCam = new THREE.PerspectiveCamera(58, 1, 0.5, 8000);
    this.menuAngle = 0;

    this.input = new Input();
    this.effects = new Effects(this.scene);
    this.audio = new EngineAudio();
    this.hud = new HUD();
    this.clock = new THREE.Clock();

    this.state = 'menu';
    this.players = 1;
    this.difficulty = 'pro';
    this.laps = 3;
    this.trackIndex = 0;
    this.builtIndex = -1;
    this.track = null;
    this.bikes = [];
    this.standings = [];
    this.raceTime = 0;
    this.countdown = 0;
    this.goTimer = 0;
    this._lastLabel = null;
    this.muted = false;
    this.lights = null;
    this.W = window.innerWidth;
    this.H = window.innerHeight;

    this._setupEnv();
    this._bindUI();
    this._ensureTrack(this.trackIndex);
    window.addEventListener('resize', () => this._resize());
    this._resize();
    this._boundLoop = () => this._loop();
    requestAnimationFrame(this._boundLoop);

    const params = new URLSearchParams(location.search);
    this.demo = params.has('demo');
    if (params.has('auto')) {
      this.trackIndex = clamp(parseInt(params.get('t') || '0', 10), 0, TRACKS.length - 1);
      this.difficulty = params.get('d') || 'pro';
      this.laps = parseInt(params.get('laps') || '3', 10);
      this._updateCards();
      this._ensureTrack(this.trackIndex);
      this.startRace(parseInt(params.get('p') || '1', 10));
      if (params.has('sim')) {
        const steps = Math.round(parseFloat(params.get('sim')) * 60);
        for (let i = 0; i < steps; i++) this._update(1 / 60);
      }
    }
  }

  _setupEnv() {
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      const env = new RoomEnvironment();
      const rt = pmrem.fromScene(env, 0.05);
      this.scene.environment = rt.texture;
      if (env.dispose) env.dispose();
      pmrem.dispose();
    } catch (e) {}
  }

  _setupLights(t) {
    if (this.lights) for (const l of this.lights) this.scene.remove(l);
    this.lights = [];
    const hemi = new THREE.HemisphereLight(t.hemiSky, t.hemiGround, t.hemiIntensity);
    const dir = new THREE.DirectionalLight(t.sunColor, t.sunIntensity);
    dir.position.set(t.sunPos[0], t.sunPos[1], t.sunPos[2]);
    const amb = new THREE.AmbientLight(t.ambient, t.ambientIntensity);
    this.scene.add(hemi, dir, amb);
    this.lights.push(hemi, dir, amb);
  }

  _resize() {
    this.W = window.innerWidth;
    this.H = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(this.W, this.H, false);
    this.menuCam.aspect = this.W / this.H;
    this.menuCam.updateProjectionMatrix();
  }

  _show(id) { document.getElementById(id).classList.remove('hidden'); }
  _hide(id) { document.getElementById(id).classList.add('hidden'); }
  _toast(text, cls) { this.hud.toast(text, cls); }

  _bindUI() {
    const ts = document.getElementById('track-select');
    this.trackCards = [];
    TRACKS.forEach((t, i) => {
      const el = document.createElement('div');
      el.className = 'track-card' + (i === this.trackIndex ? ' on' : '');
      el.innerHTML = `<canvas class="thumb" width="300" height="120"></canvas>` +
        `<div class="meta"><div class="name">${t.name}</div><div class="loc">${t.location}</div></div>`;
      el.addEventListener('click', () => {
        this.trackIndex = i;
        this._updateCards();
        if (this.state === 'menu') this._ensureTrack(i);
      });
      ts.appendChild(el);
      this.trackCards.push(el);
      this._drawThumb(el.querySelector('canvas'), t);
    });

    document.querySelectorAll('#diff-select button').forEach((b) => {
      b.addEventListener('click', () => {
        this.difficulty = b.dataset.diff;
        this._segOn('#diff-select', b);
      });
    });
    document.querySelectorAll('#laps-select button').forEach((b) => {
      b.addEventListener('click', () => {
        this.laps = parseInt(b.dataset.laps, 10);
        this._segOn('#laps-select', b);
      });
    });

    document.getElementById('btn-solo').addEventListener('click', () => this.startRace(1));
    document.getElementById('btn-duo').addEventListener('click', () => this.startRace(2));
    document.getElementById('btn-resume').addEventListener('click', () => this.setPaused(false));
    document.getElementById('btn-restart').addEventListener('click', () => { this._hide('pause'); this.startRace(this.players); });
    document.getElementById('btn-quit').addEventListener('click', () => this.toMenu());
    document.getElementById('btn-again').addEventListener('click', () => { this._hide('results'); this.startRace(this.players); });
    document.getElementById('btn-menu').addEventListener('click', () => this.toMenu());
  }

  _segOn(sel, btn) {
    document.querySelectorAll(sel + ' button').forEach((b) => b.classList.remove('on'));
    btn.classList.add('on');
  }

  _updateCards() {
    this.trackCards.forEach((el, i) => el.classList.toggle('on', i === this.trackIndex));
  }

  _drawThumb(canvas, def) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const pts = [];
    for (let i = 0; i <= 220; i++) {
      const t = (i / 220) * Math.PI * 2;
      let r = def.radius;
      for (const h of def.harmonics) r += def.radius * h.a * Math.sin(h.k * t + (h.phase || 0));
      pts.push([Math.cos(t) * r, Math.sin(t) * r]);
    }
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]);
      minZ = Math.min(minZ, p[1]); maxZ = Math.max(maxZ, p[1]);
    }
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, hexCss(def.theme.skyTop));
    grad.addColorStop(1, hexCss(def.theme.skyBottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);
    const pad = 16;
    const s = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
    const ox = (W - (maxX - minX) * s) / 2;
    const oz = (H - (maxZ - minZ) * s) / 2;
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = ox + (p[0] - minX) * s;
      const y = oz + (p[1] - minZ) * s;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 11;
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.stroke();
    ctx.lineWidth = 7;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ff2e63';
    ctx.stroke();
  }

  _ensureTrack(index) {
    if (this.track && this.builtIndex === index) return;
    if (this.track) {
      this.scene.remove(this.track.group);
      this.track.dispose();
    }
    this.track = new Track(TRACKS[index], 1000 + index * 17);
    this.scene.add(this.track.group);
    this.builtIndex = index;
    const t = this.track.def.theme;
    this.scene.fog = new THREE.FogExp2(t.fog, t.fogDensity);
    this._setupLights(t);
    this.hud.setTrack(this.track);
  }

  _clearBikes() {
    for (const b of this.bikes) {
      this.scene.remove(b.mesh);
      b.mesh.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of ms) {
            for (const k of Object.keys(m)) {
              const v = m[k];
              if (v && v.isTexture) v.dispose();
            }
            m.dispose();
          }
        }
      });
    }
    this.bikes = [];
  }

  startRace(players) {
    this.audio.init();
    this.audio.resume();
    this.audio.setMuted(this.muted);
    this.players = players;
    this._ensureTrack(this.trackIndex);
    this._clearBikes();

    const total = 8;
    const diff = DIFFICULTY[this.difficulty];
    const L = this.track.length;
    for (let i = 0; i < total; i++) {
      const isPlayer = i < players;
      const color = RIDER_COLORS[i % RIDER_COLORS.length];
      const name = isPlayer ? (i === 0 ? 'PLAYER 1' : 'PLAYER 2') : RIDER_NAMES[i % RIDER_NAMES.length];
      const profile = isPlayer && !this.demo
        ? { speed: 1, corner: 1 }
        : {
            speed: diff.speed * (0.965 + Math.random() * 0.07),
            corner: diff.corner * (0.965 + Math.random() * 0.07),
            look: diff.look,
          };
      const bike = new Bike({ track: this.track, isPlayer, playerIndex: i, color, number: i + 1, name, profile });
      const row = Math.floor(i / 2);
      const col = i % 2 === 0 ? -1 : 1;
      const s = L - 9 - row * 3.4;
      const lat = col * 2.7;
      const w = this.track.worldAt(s, lat);
      bike.place(w.x, w.y, w.z, w.yaw);
      bike.resetState(this.laps);
      bike.ai = isPlayer && !this.demo ? null : new AIController(this.track, profile, 7000 + i * 137);
      bike.position = 1;
      this.scene.add(bike.mesh);
      this.bikes.push(bike);
    }

    this.raceTime = 0;
    this.countdown = 3.99;
    this._lastLabel = null;
    this.goTimer = 0;
    this.track.setStartLights(0, false);
    this.state = 'countdown';
    this.hud.setPlayers(players);
    this.hud.show();
    this.hud.hideCountdown();
    this.vignette.style.opacity = '0';
    this._hide('menu');
    this._hide('pause');
    this._hide('results');
    this.camP1.reset();
    this.camP2.reset();
    this._toast('GET READY', '');
  }

  toMenu() {
    this.state = 'menu';
    this.hud.hide();
    this.hud.hideCountdown();
    this._hide('pause');
    this._hide('results');
    this._show('menu');
    this._clearBikes();
  }

  setPaused(p) {
    if (p) {
      if (this.state === 'racing' || this.state === 'countdown') {
        this._prevState = this.state;
        this.state = 'paused';
        this._show('pause');
      }
    } else if (this.state === 'paused') {
      this.state = this._prevState || 'racing';
      this._hide('pause');
    }
  }

  _endRace() {
    this.state = 'finished';
    this.hud.hideCountdown();
    this.standings = this._computeStandings();
    this.standings.forEach((b, i) => (b.position = i + 1));
    this.hud.showResults(this);
    this._show('results');
  }

  _computeStandings() {
    const arr = [...this.bikes];
    arr.sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.totalDist - a.totalDist;
    });
    return arr;
  }

  _updateCountdownText() {
    const c = this.countdown;
    const label = c > 3 ? '3' : c > 2 ? '2' : c > 1 ? '1' : c > 0 ? 'GO' : null;
    if (label && label !== this._lastLabel) {
      this._lastLabel = label;
      if (label === 'GO') {
        this.track.setStartLights(0, true);
        this.audio.countdownBeep(true);
        this.hud.setCountdown('GO!', true);
        this._toast('GO!', 'gold');
      } else {
        const n = 4 - parseInt(label, 10);
        this.track.setStartLights(n, false);
        this.audio.countdownBeep(false);
        this.hud.setCountdown(label, false);
      }
    }
    if (c <= 0 && this.state === 'countdown') {
      this.state = 'racing';
      this.raceTime = 0;
      this.goTimer = 0.9;
      for (const b of this.bikes) {
        b.lapTimer = 0;
        b.raceTime = 0;
      }
    }
  }

  _stepBikes(dt, idle) {
    for (const b of this.bikes) {
      let c;
      if (idle) {
        c = { throttle: 0, brake: 0, steer: 0, boost: false };
      } else if (b.isPlayer && !this.demo) {
        c = this.input.playerControls(b.playerIndex);
        if (b.finished) c = { throttle: 0.25, brake: 0, steer: c.steer * 0.4, boost: false };
      } else {
        c = b.ai.control(b, dt, this.bikes);
        if (b.finished) c = { throttle: 0.3, brake: 0, steer: c.steer, boost: false };
      }
      b.racing = this.state === 'racing';
      b.update(dt, c);
    }
    for (let i = 0; i < this.bikes.length; i++) {
      for (let j = i + 1; j < this.bikes.length; j++) {
        this.bikes[i].addRiderCollision(this.bikes[j], dt);
      }
    }
  }

  _updateEmitters() {
    for (const b of this.bikes) {
      const fx = Math.sin(b.yaw);
      const fz = Math.cos(b.yaw);
      if (b.emitDust) {
        for (let k = 0; k < 2; k++) {
          this.effects.spawn(
            b.pos.x - fx * 0.8 + (Math.random() - 0.5) * 0.6, b.pos.y + 0.16, b.pos.z - fz * 0.8 + (Math.random() - 0.5) * 0.6,
            -fx * 2 + (Math.random() - 0.5) * 2, 0.7 + Math.random(), -fz * 2 + (Math.random() - 0.5) * 2,
            0.74, 0.63, 0.45, 0.5 + Math.random() * 0.4, 1, -0.2, 1.2, 0.5
          );
        }
      }
      if (b.emitSmoke) {
        for (let k = 0; k < 2; k++) {
          this.effects.spawn(
            b.pos.x + (Math.random() - 0.5) * 0.5, b.pos.y + 0.2, b.pos.z + (Math.random() - 0.5) * 0.5,
            (Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.6, (Math.random() - 0.5) * 2,
            0.86, 0.86, 0.9, 0.45 + Math.random() * 0.5, 1, 0.4, 1.4, 0.4
          );
        }
      }
      if (b.emitBoost) {
        this.effects.spawn(
          b.pos.x - fx * 1.0, b.pos.y + 0.55, b.pos.z - fz * 1.0,
          -fx * 3 + (Math.random() - 0.5), 0.3, -fz * 3 + (Math.random() - 0.5),
          0.35, 0.78, 1.0, 0.3 + Math.random() * 0.2, 1, 0, 2, 0.65
        );
      }
      if (b.hitWall > 0.14) {
        this.effects.spawn(
          b.pos.x, b.pos.y + 0.3, b.pos.z,
          (Math.random() - 0.5) * 4, 1 + Math.random() * 2, (Math.random() - 0.5) * 4,
          1, 0.78, 0.32, 0.25, 1, -6, 0.5, 0.9
        );
      }
    }
  }

  _handleEvents() {
    for (const b of this.bikes) {
      if (!b.isPlayer || !b.events.length) continue;
      for (const e of b.events) {
        if (e === 'lap') this._toast('LAP ' + Math.min(Math.max(b.completedLaps, 1), this.laps), '');
        else if (e === 'final') this._toast('FINAL LAP', 'gold');
        else if (e === 'best') this._toast('BEST LAP!', 'gold');
        else if (e === 'finish') this._toast('FINISH!', 'gold');
      }
      b.events.length = 0;
    }
  }

  _updateCameras(dt) {
    const p1 = this.bikes.find((b) => b.isPlayer && b.playerIndex === 0);
    if (p1) this.camP1.update(p1, dt, { shake: p1.hitWall * 0.6 + (p1.offroad ? 0.03 : 0) });
    if (this.players > 1) {
      const p2 = this.bikes.find((b) => b.isPlayer && b.playerIndex === 1);
      if (p2) this.camP2.update(p2, dt, { shake: p2.hitWall * 0.6 + (p2.offroad ? 0.03 : 0) });
    }
  }

  _updateMenuCam(dt) {
    this.menuAngle += dt * 0.05;
    const R = this.track ? this.track.def.radius : 210;
    const a = this.menuAngle;
    this.menuCam.position.set(Math.cos(a) * R * 1.45, 58 + Math.sin(a * 0.6) * 22, Math.sin(a) * R * 1.45);
    this.menuCam.lookAt(0, 0, 0);
  }

  _handleGlobalKeys() {
    const i = this.input;
    if (i.pressed('KeyM')) {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      this._toast(this.muted ? 'SOUND OFF' : 'SOUND ON', '');
    }
    if (this.state === 'racing' || this.state === 'countdown' || this.state === 'paused') {
      if (i.anyPressed(['KeyP', 'Escape'])) this.setPaused(this.state !== 'paused');
      if (i.pressed('KeyR')) this.startRace(this.players);
      if (i.pressed('KeyC')) {
        this.camP1.mode = (this.camP1.mode + 1) % 2;
        this.camP2.mode = this.camP1.mode;
        this._toast('CAMERA ' + (this.camP1.mode ? 'FAR' : 'NEAR'), '');
      }
    }
  }

  _update(dt) {
    this.input.pollGamepads();

    if (this.state === 'menu') {
      this._updateMenuCam(dt);
    } else if (this.state === 'countdown') {
      this.countdown -= dt;
      this._updateCountdownText();
      this._stepBikes(dt, true);
    } else if (this.state === 'racing') {
      this.raceTime += dt;
      if (this.goTimer > 0) {
        this.goTimer -= dt;
        if (this.goTimer <= 0) this.hud.hideCountdown();
      }
      this._stepBikes(dt, false);
    } else if (this.state === 'finished') {
      this._stepBikes(dt, true);
    }

    if (this.state !== 'menu') {
      for (const b of this.bikes) b.raceTime = this.raceTime;
      this.standings = this._computeStandings();
      this.standings.forEach((b, i) => (b.position = i + 1));
      this._handleEvents();
      if (this.state === 'racing') {
        const locals = this.bikes.filter((b) => b.isPlayer);
        if (locals.length && locals.every((b) => b.finished)) this._endRace();
      }
    }

    if (this.state !== 'paused' && this.state !== 'menu') {
      this._updateCameras(dt);
      this.effects.update(dt);
      this._updateEmitters();
      this.audio.update(this.bikes);
    }

    if (this.state !== 'menu') this.hud.update(this);

    this._handleGlobalKeys();
    this.input.endFrame();
  }

  _render() {
    const r = this.renderer;
    const W = this.W, H = this.H;
    r.setScissorTest(false);
    r.setViewport(0, 0, W, H);
    r.clear(true, true, true);

    if (this.state === 'menu' || this.players === 1) {
      const cam = this.state === 'menu' ? this.menuCam : this.camP1.cam;
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
      r.render(this.scene, cam);
    } else {
      const hh = Math.floor(H / 2);
      r.setScissorTest(true);
      r.setViewport(0, H - hh, W, hh);
      r.setScissor(0, H - hh, W, hh);
      this.camP1.cam.aspect = W / hh;
      this.camP1.cam.updateProjectionMatrix();
      r.render(this.scene, this.camP1.cam);
      r.setViewport(0, 0, W, H - hh);
      r.setScissor(0, 0, W, H - hh);
      this.camP2.cam.aspect = W / (H - hh);
      this.camP2.cam.updateProjectionMatrix();
      r.render(this.scene, this.camP2.cam);
      r.setScissorTest(false);
    }
  }

  _loop() {
    requestAnimationFrame(this._boundLoop);
    const dt = Math.min(this.clock.getDelta(), 1 / 30);
    this._update(dt);
    this._render();
  }
}

window.__game = new Game();
