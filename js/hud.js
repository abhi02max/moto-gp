import { formatTime } from './utils.js';
import { BIKE_TUNE } from './bike.js';

export class HUD {
  constructor() {
    this.root = document.getElementById('hud');
    this.panels = [...document.querySelectorAll('.panel')];
    this.panels.forEach((p) => this._cache(p));
    this.countdownEl = document.getElementById('countdown');
    this.toastEl = document.getElementById('toast');
    this.mm = null;
  }

  _cache(p) {
    p.q = {
      posB: p.querySelector('.pos b'),
      lapB: p.querySelector('.lap b'),
      lapE: p.querySelector('.lap em'),
      tcur: p.querySelector('.tcur'),
      tbest: p.querySelector('.tbest'),
      speed: p.querySelector('.speedo b'),
      boost: p.querySelector('.boostbar i'),
      boostbar: p.querySelector('.boostbar'),
      mm: p.querySelector('.minimap'),
    };
  }

  setPlayers(n) {
    this.players = n;
    this.panels[0].classList.toggle('split', n === 2);
    this.panels[1].classList.toggle('hidden', n !== 2);
  }

  show() { this.root.classList.remove('hidden'); }
  hide() { this.root.classList.add('hidden'); }

  setCountdown(text, isGo) {
    this.countdownEl.textContent = text;
    this.countdownEl.classList.remove('hidden');
    this.countdownEl.classList.toggle('go', !!isGo);
    this.countdownEl.style.animation = 'none';
    void this.countdownEl.offsetWidth;
    this.countdownEl.style.animation = '';
  }

  hideCountdown() { this.countdownEl.classList.add('hidden'); }

  toast(text, cls) {
    if (!text) return;
    const d = document.createElement('div');
    d.className = 'toast-item' + (cls ? ' ' + cls : '');
    d.textContent = text;
    this.toastEl.appendChild(d);
    setTimeout(() => {
      d.style.transition = 'opacity .4s';
      d.style.opacity = '0';
      setTimeout(() => d.remove(), 400);
    }, 1150);
  }

  setTrack(track) {
    const S = track.samples;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < S.length; i += 4) {
      const p = S[i].p;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const pts = [];
    for (let i = 0; i < S.length; i += 4) pts.push([S[i].p.x, S[i].p.z]);
    this.mm = { minX, maxX, minZ, maxZ, pts, start: [S[0].p.x, S[0].p.z] };
  }

  update(game) {
    for (const b of game.bikes) {
      if (!b.isPlayer) continue;
      const panel = this.panels[b.playerIndex];
      if (!panel || !panel.q) continue;
      const q = panel.q;
      q.posB.textContent = b.position || '-';
      q.lapB.textContent = Math.min(Math.max(b.completedLaps + 1, 1), game.laps);
      q.lapE.textContent = '/' + game.laps;
      q.tcur.textContent = formatTime(b.lapTimer);
      q.tbest.textContent = 'BEST ' + formatTime(b.bestLap);
      q.speed.textContent = Math.round(Math.abs(b.speed) * 3.6);
      const bp = Math.round((b.boostMeter / BIKE_TUNE.boostTime) * 100);
      q.boost.style.width = bp + '%';
      q.boostbar.classList.toggle('low', bp < 30);
      this._drawMinimap(q.mm, game.bikes, b);
    }
    const p1 = game.bikes.find((x) => x.isPlayer && x.playerIndex === 0);
    if (p1 && game.vignette) {
      const v = Math.min(1, Math.abs(p1.speed) / 88) * 0.72;
      game.vignette.style.opacity = v.toFixed(2);
    }
  }

  _drawMinimap(canvas, bikes, me) {
    if (!this.mm || !canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    const m = this.mm;
    const pad = 16;
    const s = Math.min((W - pad * 2) / Math.max(1, m.maxX - m.minX), (H - pad * 2) / Math.max(1, m.maxZ - m.minZ));
    const ox = (W - (m.maxX - m.minX) * s) / 2;
    const oz = (H - (m.maxZ - m.minZ) * s) / 2;
    const tx = (x) => ox + (x - m.minX) * s;
    const tz = (z) => oz + (z - m.minZ) * s;
    ctx.beginPath();
    m.pts.forEach((p, i) => (i ? ctx.lineTo(tx(p[0]), tz(p[1])) : ctx.moveTo(tx(p[0]), tz(p[1]))));
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.stroke();
    ctx.fillStyle = '#ff2e63';
    ctx.fillRect(tx(m.start[0]) - 6, tz(m.start[1]) - 6, 12, 12);
    for (const b of bikes) {
      const x = tx(b.pos.x);
      const z = tz(b.pos.z);
      const isMe = b === me;
      ctx.beginPath();
      ctx.arc(x, z, isMe ? 6 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isMe ? '#ffffff' : '#' + b.color.toString(16).padStart(6, '0');
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isMe ? '#ff2e63' : 'rgba(0,0,0,0.7)';
      ctx.stroke();
    }
  }

  showResults(game) {
    const body = document.getElementById('standings-body');
    body.innerHTML = '';
    const standings = game.standings;
    const laps = game.laps;
    const leader = standings[0];
    standings.forEach((b, i) => {
      const row = document.createElement('div');
      row.className = 'srow' + (b.isPlayer ? ' me' : '');
      const doneLaps = Math.max(0, Math.min(laps, b.completedLaps));
      const timeCell = b.finished
        ? formatTime(b.finishTime)
        : '+' + Math.max(0, leader.totalDist - b.totalDist).toFixed(0) + 'm';
      row.innerHTML = `<span class="rn">${i + 1}</span>` +
        `<span class="rider"><span class="dot" style="background:#${b.color.toString(16).padStart(6, '0')}"></span>${b.name}</span>` +
        `<span class="mono">${doneLaps}</span>` +
        `<span class="mono">${formatTime(b.bestLap)}</span>` +
        `<span class="mono">${timeCell}</span>`;
      body.appendChild(row);
    });
    const podium = document.getElementById('podium');
    const medals = ['m1', 'm2', 'm3'];
    podium.innerHTML = standings.slice(0, 3).map((b, i) =>
      `<div class="pod"><span class="medal ${medals[i]}">${i + 1}</span>` +
      `<span class="dot" style="width:12px;height:12px;border-radius:50%;background:#${b.color.toString(16).padStart(6, '0')}"></span>${b.name}</div>`
    ).join('');
    const title = document.getElementById('results-title');
    const p1 = game.bikes.find((x) => x.isPlayer && x.playerIndex === 0);
    title.textContent = p1 && p1.position === 1 ? 'VICTORY!' : 'RACE COMPLETE';
  }
}
