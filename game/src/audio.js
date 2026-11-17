// All sound in Pondlight is synthesised with WebAudio: no audio files, so the
// game stays fully offline. Short oscillator blips cover the actions, a noise
// buffer covers splashes, and a slow pentatonic arpeggio over a soft bass is
// the music. Everything is created lazily on the first user gesture, as
// browsers require, and M toggles a master mute.

const MUSIC_NOTES = [0, 3, 5, 7, 10, 12, 10, 7, 5, 3]; // a minor-pentatonic walk
const MUSIC_BASE = 220; // A3
const MUSIC_STEP_SECONDS = 0.42;

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicStep = 0;
  let nextMusicAt = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return false;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    nextMusicAt = ctx.currentTime + 0.1;
    return true;
  }

  function tone(freq, seconds, { type = 'sine', volume = 0.2, slide = 0, delay = 0, dest = null } = {}) {
    if (!ensure()) return;
    const start = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), start + seconds);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain).connect(dest ?? master);
    osc.start(start);
    osc.stop(start + seconds + 0.02);
  }

  function noise(seconds, { volume = 0.16, delay = 0, low = 400, high = 2400 } = {}) {
    if (!ensure()) return;
    const start = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(high, start);
    filter.frequency.exponentialRampToValueAtTime(low, start + seconds);
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(master);
    source.start(start);
  }

  /** Advance the generative music. Call once per frame; it schedules ahead. */
  function updateMusic(playing) {
    if (!ctx || muted || !playing) return;
    while (nextMusicAt < ctx.currentTime + 0.25) {
      const step = musicStep;
      const semitone = MUSIC_NOTES[step % MUSIC_NOTES.length];
      const freq = MUSIC_BASE * Math.pow(2, semitone / 12);
      const delay = nextMusicAt - ctx.currentTime;
      tone(freq, 0.5, { type: 'triangle', volume: 0.5, delay, dest: musicGain });
      if (step % 4 === 0) tone(MUSIC_BASE / 2, 1.4, { type: 'sine', volume: 0.7, delay, dest: musicGain });
      if (step % 8 === 6) tone(MUSIC_BASE * 2, 0.7, { type: 'sine', volume: 0.18, delay, dest: musicGain });
      musicStep += 1;
      nextMusicAt += MUSIC_STEP_SECONDS;
    }
  }

  return {
    unlock: ensure,
    updateMusic,
    shoot() { tone(620 + Math.random() * 120, 0.09, { type: 'sine', volume: 0.07, slide: 260 }); },
    hit() { tone(190, 0.06, { type: 'square', volume: 0.05 }); },
    pop() { tone(340, 0.12, { type: 'sine', volume: 0.12, slide: 320 }); noise(0.08, { volume: 0.05 }); },
    hurt() { tone(140, 0.22, { type: 'sawtooth', volume: 0.16, slide: -70 }); noise(0.15, { volume: 0.1 }); },
    dash() { noise(0.14, { volume: 0.08, low: 900, high: 3200 }); },
    pickup() { tone(880, 0.1, { type: 'sine', volume: 0.08 }); tone(1318, 0.14, { type: 'sine', volume: 0.07, delay: 0.05 }); },
    heal() { tone(523, 0.16, { volume: 0.1 }); tone(659, 0.16, { volume: 0.1, delay: 0.08 }); tone(784, 0.24, { volume: 0.1, delay: 0.16 }); },
    levelup() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.22, { type: 'triangle', volume: 0.12, delay: i * 0.07 })); },
    wave() { tone(392, 0.2, { type: 'triangle', volume: 0.12 }); tone(587, 0.3, { type: 'triangle', volume: 0.12, delay: 0.12 }); },
    boss() { tone(98, 0.7, { type: 'sawtooth', volume: 0.14, slide: -30 }); tone(147, 0.7, { type: 'sawtooth', volume: 0.1, delay: 0.1 }); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.4, { type: 'triangle', volume: 0.12, delay: i * 0.11 })); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, { type: 'triangle', volume: 0.12, delay: i * 0.13 })); },
    toggleMute() {
      muted = !muted;
      if (master && ctx) master.gain.setValueAtTime(muted ? 0 : 0.5, ctx.currentTime);
      return muted;
    },
    get muted() { return muted; },
  };
}
