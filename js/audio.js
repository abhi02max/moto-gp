export class EngineAudio {
  constructor() {
    this.ready = false;
    this.muted = false;
    this.voices = [];
  }

  init() {
    if (this.ready) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.32;
      this.master.connect(this.ctx.destination);
      const nb = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
      const nd = nb.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      this.noiseBuf = nb;
      this.ready = true;
      return true;
    } catch (e) {
      return false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.32, this.ctx.currentTime, 0.05);
  }

  _makeVoice() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    lp.Q.value = 4;
    lp.connect(g);
    g.connect(this.master);

    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 60;
    o1.connect(lp);
    o1.start();
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 30;
    o2.connect(lp);
    o2.start();

    const ns = ctx.createBufferSource();
    ns.buffer = this.noiseBuf;
    ns.loop = true;
    const nf = ctx.createBiquadFilter();
    nf.type = 'bandpass';
    nf.frequency.value = 1400;
    nf.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.value = 0;
    ns.connect(nf);
    nf.connect(ng);
    ng.connect(g);
    ns.start();

    return { g, lp, o1, o2, ng };
  }

  update(bikes) {
    if (!this.ready) return;
    const locals = bikes.filter((b) => b.isPlayer);
    const now = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      if (!this.voices[i]) this.voices[i] = this._makeVoice();
      const v = this.voices[i];
      const b = locals[i];
      if (!b) {
        v.g.gain.setTargetAtTime(0, now, 0.1);
        v.ng.gain.setTargetAtTime(0, now, 0.1);
        continue;
      }
      const frac = Math.min(1, Math.abs(b.speed) / 88);
      const f = 48 + frac * 170 + (b.boosting ? 18 : 0);
      v.o1.frequency.setTargetAtTime(f, now, 0.03);
      v.o2.frequency.setTargetAtTime(f * 0.5, now, 0.03);
      v.lp.frequency.setTargetAtTime(500 + frac * 2600, now, 0.05);
      const thr = b.throttle || 0;
      const vol = 0.05 + frac * 0.14 + thr * 0.09;
      v.g.gain.setTargetAtTime(this.muted ? 0 : vol, now, 0.05);
      v.ng.gain.setTargetAtTime(this.muted ? 0 : 0.02 + thr * 0.05, now, 0.05);
    }
  }

  countdownBeep(high) {
    if (!this.ready) return;
    try {
      const now = this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = high ? 880 : 440;
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(this.muted ? 0.0001 : 0.22, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(now + 0.4);
    } catch (e) {}
  }
}
