// Solmar Bay — fully synthesised WebAudio: engine, sirens, gunshots, a bass
// music loop and mission jingles. No audio files, no network. Everything is
// guarded so a missing AudioContext can never break the game.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = null;
    this.sirenOn = false;
    this.musicTimer = null;
    this.musicStep = 0;
    this.musicOn = false;
  }

  // Call from a user gesture (New Game click, first keypress) so the context runs.
  ensure() {
    try {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') void this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startEngineHum();
      this.startMusicLoop();
    } catch {
      this.ctx = null;
    }
  }

  setMuted(muted) {
    this.muted = muted;
    try {
      if (this.master) this.master.gain.value = muted ? 0 : 0.5;
    } catch {
      // ignore
    }
  }

  // --- small synth helpers -------------------------------------------------
  tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
      gain.gain.setValueAtTime(vol || 0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // ignore
    }
  }

  noiseBurst(dur, vol, lowFreq) {
    if (!this.ctx || this.muted) return;
    try {
      const t = this.ctx.currentTime;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowFreq || 1800;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.4, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t);
    } catch {
      // ignore
    }
  }

  // --- continuous sounds ---------------------------------------------------
  startEngineHum() {
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch {
      // ignore
    }
  }

  // speed01: 0 parked, 1 flat out. Call every frame.
  setEngine(speed01, driving) {
    if (!this.ctx || !this.engineGain) return;
    try {
      const target = driving ? 0.02 + speed01 * 0.075 : 0.008;
      this.engineGain.gain.setTargetAtTime(this.muted ? 0 : target, this.ctx.currentTime, 0.08);
      this.engineOsc.frequency.setTargetAtTime(50 + speed01 * 130, this.ctx.currentTime, 0.08);
    } catch {
      // ignore
    }
  }

  setSiren(on) {
    if (on === this.sirenOn) return;
    this.sirenOn = on;
    if (!this.ctx) return;
    if (on) {
      let high = true;
      this.sirenTimer = window.setInterval(() => {
        if (this.muted) return;
        this.tone(high ? 720 : 540, 0.42, 'triangle', 0.05);
        high = !high;
      }, 430);
    } else if (this.sirenTimer) {
      window.clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
  }

  // A lazy bass-and-hat loop: A minor groove that never needs a file.
  startMusicLoop() {
    const bassLine = [55, 0, 55, 65.4, 0, 55, 49, 58.3];
    const roots = [55, 55, 43.65, 49];
    this.musicTimer = window.setInterval(() => {
      if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
      const bar = Math.floor(this.musicStep / 8) % 4;
      const step = this.musicStep % 8;
      const note = bassLine[step] || roots[bar];
      if (note) this.tone(note, 0.22, 'triangle', 0.11);
      if (step % 2 === 0) this.noiseBurst(0.03, 0.03, 6000);
      this.musicStep += 1;
    }, 240);
  }

  // --- one-shots -----------------------------------------------------------
  gunshot() {
    this.noiseBurst(0.16, 0.5, 1400);
    this.tone(150, 0.09, 'square', 0.16, 50);
  }

  enemyShot() {
    this.noiseBurst(0.12, 0.22, 1100);
  }

  punch() {
    this.noiseBurst(0.08, 0.3, 500);
  }

  click() {
    this.tone(880, 0.06, 'sine', 0.12);
  }

  pickup() {
    this.tone(660, 0.08, 'sine', 0.15);
    window.setTimeout(() => this.tone(990, 0.12, 'sine', 0.15), 70);
  }

  missionComplete() {
    const notes = [523, 659, 784, 1047];
    notes.forEach((n, i) => window.setTimeout(() => this.tone(n, 0.22, 'triangle', 0.18), i * 110));
  }

  crash() {
    this.noiseBurst(0.3, 0.5, 700);
    this.tone(90, 0.25, 'sawtooth', 0.2, 40);
  }

  wasted() {
    [392, 330, 262, 196].forEach((n, i) => window.setTimeout(() => this.tone(n, 0.4, 'sawtooth', 0.14), i * 220));
  }

  busted() {
    this.tone(440, 0.3, 'square', 0.1, 220);
    window.setTimeout(() => this.tone(330, 0.4, 'square', 0.1, 165), 260);
  }
}
