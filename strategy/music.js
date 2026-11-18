// Plays the score in score.js with instruments made from oscillators and noise.
// No audio files. Works on a live AudioContext and on an OfflineAudioContext (for checks).

import { TEMPO, BEATS_PER_BAR, PROGRESSION, MELODY, CHORDS, frequency, arpeggio, bassNote } from './score.js';

const BEAT = 60 / TEMPO;
const BAR = BEAT * BEATS_PER_BAR;

export function createMusic(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0;
  const squash = ctx.createDynamicsCompressor();
  squash.threshold.value = -16; squash.ratio.value = 4; squash.attack.value = 0.01; squash.release.value = 0.25;
  // A short echo gives the plucked notes some room.
  const echo = ctx.createDelay(1);
  echo.delayTime.value = BEAT * 0.75;
  const echoGain = ctx.createGain();
  echoGain.gain.value = 0.22;
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass'; echoTone.frequency.value = 1800;
  echo.connect(echoTone).connect(echoGain).connect(echo);
  echoGain.connect(master);
  master.connect(squash).connect(ctx.destination);

  const calm = ctx.createGain(); calm.gain.value = 1; calm.connect(master);
  const tense = ctx.createGain(); tense.gain.value = 0; tense.connect(master);
  const tune = ctx.createGain(); tune.gain.value = 1; tune.connect(master); tune.connect(echo);

  let noise = null;
  function noiseBuffer() {
    if (noise) return noise;
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < data.length; i += 1) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; data[i] = (seed / 0x3fffffff) - 1; }
    return noise;
  }

  // ----- instruments -----
  function pluck(note, t, out, level = 0.16) {
    const f = frequency(note);
    const amp = ctx.createGain();
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.setValueAtTime(Math.min(6000, f * 6), t);
    tone.frequency.exponentialRampToValueAtTime(Math.max(300, f * 1.5), t + 0.35);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level, t + 0.008);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    for (const [type, detune] of [['triangle', 0], ['sawtooth', 5]]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = f; o.detune.value = detune;
      o.connect(tone);
      o.start(t); o.stop(t + 0.75);
    }
    tone.connect(amp).connect(out);
    amp.connect(echo);
  }
  function flute(note, t, length, out, level = 0.13) {
    const f = frequency(note);
    const amp = ctx.createGain();
    const o = ctx.createOscillator();
    o.type = 'sine'; o.frequency.value = f;
    const breath = ctx.createOscillator();
    breath.type = 'triangle'; breath.frequency.value = f * 2;
    const breathGain = ctx.createGain(); breathGain.gain.value = 0.18;
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.2;
    const vibDepth = ctx.createGain();
    vibDepth.gain.setValueAtTime(0, t);
    vibDepth.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(0.4, length * 0.6));
    vib.connect(vibDepth); vibDepth.connect(o.frequency);
    const end = t + length;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level, t + 0.06);
    amp.gain.setValueAtTime(level, Math.max(t + 0.07, end - 0.09));
    amp.gain.exponentialRampToValueAtTime(0.0001, end + 0.05);
    o.connect(amp); breath.connect(breathGain).connect(amp); amp.connect(out);
    for (const n of [o, breath, vib]) { n.start(t); n.stop(end + 0.08); }
  }
  function strings(notes, t, length, out, level = 0.035) {
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass'; tone.frequency.value = 900;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level, t + 0.5);
    amp.gain.setValueAtTime(level, t + length - 0.3);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.4);
    for (const note of notes) {
      for (const detune of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth'; o.frequency.value = frequency(note); o.detune.value = detune;
        o.connect(tone);
        o.start(t); o.stop(t + length + 0.45);
      }
    }
    tone.connect(amp).connect(out);
  }
  function bass(note, t, length, out, level = 0.2) {
    const o = ctx.createOscillator();
    o.type = 'triangle'; o.frequency.value = frequency(note);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
    o.connect(amp).connect(out);
    o.start(t); o.stop(t + length + 0.02);
  }
  function drum(t, out, level = 0.5, pitch = 95) {
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(pitch * 1.8, t);
    o.frequency.exponentialRampToValueAtTime(pitch * 0.6, t + 0.18);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(level, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(amp).connect(out);
    o.start(t); o.stop(t + 0.34);
  }
  function shaker(t, out, level = 0.05) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const tone = ctx.createBiquadFilter();
    tone.type = 'highpass'; tone.frequency.value = 5000;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(level, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(tone).connect(amp).connect(out);
    src.start(t); src.stop(t + 0.08);
  }

  // ----- one bar -----
  // `pass` counts trips through the 16 bars, so the arrangement changes each time round.
  function scheduleBar(index, t) {
    const bar = index % PROGRESSION.length;
    const pass = Math.floor(index / PROGRESSION.length);
    const chord = PROGRESSION[bar];
    const [root, third, fifth] = CHORDS[chord];
    strings([`${root}3`, `${third}4`, `${fifth}4`], t, BAR, calm);
    bass(bassNote(chord), t, BEAT * 1.8, calm);
    bass(bassNote(chord), t + BEAT * 2, BEAT * 1.2, calm, 0.14);
    arpeggio(chord, pass % 3 === 1).forEach((note, i) => pluck(note, t + i * BEAT * 0.5, calm, i % 4 === 0 ? 0.17 : 0.11));
    for (const b of [1, 3]) shaker(t + b * BEAT, calm);
    if (pass % 3 !== 1) {                       // the tune rests every third time round
      let at = t;
      for (const [note, beats] of MELODY[bar]) {
        const shifted = pass % 3 === 2 ? note.replace(/\d+$/, (o) => String(Number(o) - 1)) : note;
        flute(shifted, at, beats * BEAT * 0.95, tune);
        at += beats * BEAT;
      }
    }
    // The tension layer always plays; its volume is what changes.
    for (const b of [0, 1.5, 2, 3, 3.5]) drum(t + b * BEAT, tense, b === 0 ? 0.55 : 0.34, b === 0 ? 80 : 110);
    for (let i = 0; i < 8; i += 1) pluck(i % 2 === 0 ? `${root}2` : `${fifth}2`, t + i * BEAT * 0.5, tense, 0.2);
    for (let i = 0; i < 8; i += 1) shaker(t + i * BEAT * 0.5, tense, 0.04);
  }

  // ----- live playback -----
  let timer = null;
  let nextBar = 0;
  let nextTime = 0;
  let mood = 'calm';
  let volume = 0.7;
  function tick() {
    while (nextTime < ctx.currentTime + 0.4) { scheduleBar(nextBar, nextTime); nextBar += 1; nextTime += BAR; }
  }
  function fade(param, value, seconds) {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + seconds);
  }
  return {
    scheduleBar, BAR,
    start() {
      if (timer) return;
      nextBar = 0;
      nextTime = ctx.currentTime + 0.15;
      fade(master.gain, volume, 1.5);
      tick();
      timer = setInterval(tick, 120);
    },
    stop() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
      fade(master.gain, 0, 0.4);
    },
    playing: () => Boolean(timer),
    // 'menu' is the tune over a quiet backing; 'calm' is the full arrangement; 'tense' adds drums and a low pulse.
    setMood(next) {
      if (next === mood) return;
      mood = next;
      fade(tense.gain, next === 'tense' ? 1 : 0, 1.2);
      fade(calm.gain, next === 'menu' ? 0.55 : next === 'tense' ? 0.8 : 1, 1.2);
      fade(tune.gain, next === 'tense' ? 0.6 : 1, 1.2);
    },
    mood: () => mood,
    // For offline checks: set the layers directly.
    setLevels(master_, tense_) { master.gain.value = master_; tense.gain.value = tense_; },
  };
}
