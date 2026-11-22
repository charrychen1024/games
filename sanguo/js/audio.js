/* ============================================================
 * 烽烟录 · WebAudio 合成音乐与音效（五声音阶，古筝/竹笛/太鼓音色）
 * ============================================================ */
'use strict';
(function () {
  const A = (G.audio = {});
  let ac = null, master, music, sfxBus, noiseBuf, cur = null, curName = null, step = 0, nextT = 0, pending = null;
  A.muted = false;
  try { A.muted = localStorage.getItem('fengyan_mute') === '1'; } catch (e) { /* ignore */ }

  A.unlock = function () {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
      master = ac.createGain(); master.gain.value = A.muted ? 0 : 0.8; master.connect(ac.destination);
      // 简易回声，营造空间感
      const delay = ac.createDelay(1); delay.delayTime.value = 0.27;
      const fb = ac.createGain(); fb.gain.value = 0.3;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
      const wet = ac.createGain(); wet.gain.value = 0.28;
      delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(master);
      music = ac.createGain(); music.gain.value = 0.3; music.connect(master); music.connect(delay);
      sfxBus = ac.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master); sfxBus.connect(delay);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      setInterval(tick, 25);
    }
    if (ac.state === 'suspended') ac.resume();
    if (pending) { const p = pending; pending = null; curName = null; A.play(p); }
  };
  A.toggleMute = function () {
    A.muted = !A.muted;
    try { localStorage.setItem('fengyan_mute', A.muted ? '1' : '0'); } catch (e) { /* ignore */ }
    if (master) master.gain.setTargetAtTime(A.muted ? 0 : 0.8, ac.currentTime, 0.05);
  };

  const NOTE = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
  function freq(tok) {
    const m = /^([a-g])(#?)(\d)$/.exec(tok); if (!m) return 0;
    const n = NOTE[m[1]] + (m[2] ? 1 : 0) + (+m[3] + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }
  function envGain(t, a, peak, dec) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
    return g;
  }
  function noise(t, dur) { const s = ac.createBufferSource(); s.buffer = noiseBuf; s.start(t, Math.random() * 0.5); s.stop(t + dur); return s; }
  function osc(type, f, t, dur) { const o = ac.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(t + dur); return o; }

  const INS = {
    // 古筝：锯齿波 + 快速闭合的低通
    pluck(t, f, d, v, out) {
      const len = Math.max(0.7, d * 1.5);
      const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = 3;
      fl.frequency.setValueAtTime(Math.min(9000, f * 9), t);
      fl.frequency.exponentialRampToValueAtTime(Math.max(220, f * 1.3), t + 0.45);
      const g = envGain(t, 0.004, v, len);
      const o1 = osc('sawtooth', f, t, len + 0.1), o2 = osc('triangle', f * 2.003, t, len + 0.1);
      const g2 = ac.createGain(); g2.gain.value = 0.35;
      o1.connect(fl); o2.connect(g2); g2.connect(fl); fl.connect(g); g.connect(out);
    },
    // 竹笛：正弦 + 颤音 + 气声
    flute(t, f, d, v, out) {
      const o = osc('sine', f, t, d + 0.3), o2 = osc('triangle', f, t, d + 0.3);
      const lfo = osc('sine', 5.3, t, d + 0.3), lg = ac.createGain(); lg.gain.value = f * 0.011;
      lfo.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.07);
      g.gain.setValueAtTime(v * 0.85, t + Math.max(0.08, d - 0.06)); g.gain.linearRampToValueAtTime(0.0001, t + d + 0.2);
      const m2 = ac.createGain(); m2.gain.value = 0.25;
      o.connect(g); o2.connect(m2); m2.connect(g); g.connect(out);
      const n = noise(t, d + 0.2), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 2; bp.Q.value = 4;
      const ng = ac.createGain(); ng.gain.setValueAtTime(v * 0.25, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      n.connect(bp); bp.connect(ng); ng.connect(out);
    },
    bass(t, f, d, v, out) {
      const g = envGain(t, 0.01, v, Math.max(0.25, d * 0.95));
      const o = osc('triangle', f, t, d + 0.4), o2 = osc('sine', f / 2, t, d + 0.4);
      const g2 = ac.createGain(); g2.gain.value = 0.6;
      o.connect(g); o2.connect(g2); g2.connect(g); g.connect(out);
    },
    // 太鼓
    taiko(t, f, d, v, out) {
      const o = ac.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
      o.start(t); o.stop(t + 0.6);
      const g = envGain(t, 0.003, v * 1.4, 0.45); o.connect(g); g.connect(out);
      const n = noise(t, 0.2), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
      const ng = envGain(t, 0.002, v * 0.6, 0.12); n.connect(lp); lp.connect(ng); ng.connect(out);
    },
    snare(t, f, d, v, out) {
      const n = noise(t, 0.2), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500;
      const g = envGain(t, 0.002, v, 0.13); n.connect(hp); hp.connect(g); g.connect(out);
    },
    hat(t, f, d, v, out) {
      const n = noise(t, 0.06), hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      const g = envGain(t, 0.001, v * 0.6, 0.04); n.connect(hp); hp.connect(g); g.connect(out);
    },
    gong(t, f, d, v, out) {
      for (const [m, a] of [[1, 1], [1.483, 0.6], [2.03, 0.45], [2.74, 0.3], [3.9, 0.15]]) {
        const o = osc('sine', 110 * m, t, 3.2), g = envGain(t, 0.01, v * a, 3);
        o.connect(g); g.connect(out);
      }
    },
  };
  const DRUMS = new Set(['taiko', 'snare', 'hat', 'gong']);

  // ---------- 曲目 ----------
  const R = n => Array(n).fill('.').join(' ');
  const SONGS = {
    title: { bpm: 66, tracks: [
      { ins: 'flute', vol: 0.22, seq: 'a4 - - - c5 - d5 - | e5 - - - - - g5 e5 | d5 - - - c5 - a4 - | c5 - - - - - - - | a4 - - - c5 - d5 - | e5 - - - g5 - a5 - | g5 - e5 - d5 - c5 - | a4 - - - - - - -' },
      { ins: 'pluck', vol: 0.11, seq: 'a3 e4 a4 c5 e5 c5 a4 e4 | c4 g4 c5 e5 g5 e5 c5 g4 | d4 a4 d5 e5 a5 e5 d5 a4 | a3 e4 a4 c5 e5 c5 a4 e4 | f3 c4 f4 a4 c5 a4 f4 c4 | c4 g4 c5 e5 g5 e5 c5 g4 | g3 d4 g4 a4 d5 a4 g4 d4 | a3 e4 a4 c5 e5 - - -' },
      { ins: 'bass', vol: 0.2, seq: 'a2 - - - - - - - | c3 - - - - - - - | d3 - - - - - - - | a2 - - - - - - - | f2 - - - - - - - | c3 - - - - - - - | g2 - - - - - - - | a2 - - - - - - -' },
      { ins: 'taiko', vol: 0.25, seq: 'x ' + R(15) },
    ] },
    town: { bpm: 100, tracks: [
      { ins: 'pluck', vol: 0.17, seq: 'c5 d5 e5 g5 a5 - g5 e5 | d5 - e5 d5 c5 - a4 - | c5 d5 e5 g5 e5 - d5 c5 | d5 - - - - - . . | e5 g5 a5 c6 a5 - g5 e5 | g5 - a5 g5 e5 - d5 - | c5 d5 e5 d5 c5 - a4 g4 | c5 - - - - - . .' },
      { ins: 'flute', vol: 0.12, seq: R(24) + ' g5 - a5 - g5 - e5 - ' + R(24) + ' e5 - d5 - c5 - - -' },
      { ins: 'bass', vol: 0.2, seq: 'c3 . g3 . c3 . g3 . | f2 . c3 . f2 . c3 . | c3 . g3 . c3 . g3 . | g2 . d3 . g2 . d3 . | a2 . e3 . a2 . e3 . | f2 . c3 . f2 . c3 . | g2 . d3 . g2 . d3 . | c3 . g3 . c3 - - -' },
      { ins: 'hat', vol: 0.18, seq: '. x . x . x . x' },
      { ins: 'taiko', vol: 0.14, seq: 'x . . . x . . .' },
    ] },
    field: { bpm: 116, tracks: [
      { ins: 'flute', vol: 0.2, seq: 'a4 - c5 d5 e5 - - - | g5 - e5 - d5 - c5 d5 | e5 - - - a4 - - - | . . . . . . . . | a4 - c5 d5 e5 - g5 - | a5 - - - g5 e5 d5 - | c5 - d5 - e5 - d5 c5 | a4 - - - - - - -' },
      { ins: 'pluck', vol: 0.08, seq: 'a3 a4 e4 a4 a3 a4 e4 a4 | c4 c5 g4 c5 c4 c5 g4 c5 | a3 a4 e4 a4 a3 a4 e4 a4 | g3 g4 d4 g4 g3 g4 d4 g4 | f3 f4 c4 f4 f3 f4 c4 f4 | c4 c5 g4 c5 c4 c5 g4 c5 | d4 d5 a4 d5 g3 g4 d4 g4 | a3 a4 e4 a4 a3 - - -' },
      { ins: 'bass', vol: 0.2, seq: 'a2 - - - a2 - - - | c3 - - - c3 - - - | a2 - - - a2 - - - | g2 - - - g2 - - - | f2 - - - f2 - - - | c3 - - - c3 - - - | d3 - - - g2 - - - | a2 - - - a2 - - -' },
      { ins: 'taiko', vol: 0.22, seq: 'X . . x x . . . | X . . x x . x .' },
    ] },
    camp: { bpm: 76, tracks: [
      { ins: 'pluck', vol: 0.13, seq: 'a3 . . . e4 . . . | f4 . . . e4 . . . | a3 . . . e4 . . . | d4 . . . c4 . b3 .' },
      { ins: 'flute', vol: 0.13, seq: R(12) + ' e5 - d5 - | c5 - - - b4 - - - | a4 - - - - - - - ' + R(32) },
      { ins: 'bass', vol: 0.24, seq: 'a2 - - - - - - - | f2 - - - - - - - | a2 - - - - - - - | e2 - - - - - - -' },
      { ins: 'taiko', vol: 0.24, seq: 'x . . . . . x . | . . . . . . . .' },
    ] },
    battle: { bpm: 152, tracks: [
      { ins: 'pluck', vol: 0.15, seq: 'a4 . a4 c5 d5 . e5 . | g5 . e5 d5 e5 - - - | a4 . a4 c5 d5 . e5 . | d5 . c5 a4 c5 - - - | e5 . e5 g5 a5 . g5 . | e5 . d5 c5 d5 - - - | c5 . d5 e5 g5 . e5 d5 | e5 - - - a5 - - -' },
      { ins: 'flute', vol: 0.1, seq: R(32) + ' e5 - - - g5 - - - | a5 - - - g5 - e5 - | d5 - - - e5 - - - | a4 - - - - - - -' },
      { ins: 'bass', vol: 0.2, seq: 'a2 a2 a3 a2 a2 a2 a3 a2 | c3 c3 c4 c3 c3 c3 c4 c3 | a2 a2 a3 a2 a2 a2 a3 a2 | g2 g2 g3 g2 g2 g2 g3 g2 | f2 f2 f3 f2 f2 f2 f3 f2 | g2 g2 g3 g2 g2 g2 g3 g2 | a2 a2 a3 a2 g2 g2 g3 g2 | a2 a2 a3 a2 e2 e2 e3 e2' },
      { ins: 'taiko', vol: 0.26, seq: 'X . . x . . X . | X . . x . x X .' },
      { ins: 'snare', vol: 0.12, seq: '. . x . . . x .' },
      { ins: 'hat', vol: 0.12, seq: 'x x x x x x x x' },
    ] },
    boss: { bpm: 138, tracks: [
      { ins: 'pluck', vol: 0.15, seq: 'e5 - - f5 e5 - d5 - | c5 - - d5 b4 - - - | a4 - - b4 c5 - e5 - | d5 - - - - - - - | e5 - - f5 e5 - a5 - | g5 - f5 - e5 - d5 - | c5 - b4 - a4 - b4 - | a4 - - - - - - -' },
      { ins: 'bass', vol: 0.22, seq: 'a2 a2 a2 a2 a2 a2 a2 a2 | f2 f2 f2 f2 f2 f2 f2 f2 | d2 d2 d2 d2 d2 d2 d2 d2 | e2 e2 e2 e2 e2 e2 e2 e2' },
      { ins: 'gong', vol: 0.18, seq: 'x ' + R(63) },
      { ins: 'taiko', vol: 0.3, seq: 'X . x . X . x x | X . x . X x X x' },
      { ins: 'snare', vol: 0.1, seq: '. . . . x . . .' },
    ] },
  };
  SONGS.ending = SONGS.title;

  function parse(seq) { return seq.replace(/\|/g, ' ').trim().split(/\s+/); }
  A.play = function (name) {
    if (curName === name) return;
    curName = name;
    if (!ac) { pending = name; return; }
    const s = SONGS[name];
    cur = s ? { bpm: s.bpm, tracks: s.tracks.map(t => ({ ins: t.ins, vol: t.vol, toks: parse(t.seq) })) } : null;
    step = 0; nextT = ac.currentTime + 0.1;
  };
  A.stop = () => { curName = null; cur = null; pending = null; };
  A.current = () => curName;

  function tick() {
    if (!cur || !ac) return;
    const sd = 60 / cur.bpm / 2;
    while (nextT < ac.currentTime + 0.15) {
      for (const tr of cur.tracks) {
        const toks = tr.toks, i = step % toks.length, tok = toks[i];
        if (tok === '.' || tok === '-') continue;
        if (DRUMS.has(tr.ins)) { INS[tr.ins](nextT, 0, sd, tr.vol * (tok === 'X' ? 1.4 : 1), music); continue; }
        let len = 1; while (len < toks.length && toks[(i + len) % toks.length] === '-') len++;
        const f = freq(tok); if (f) INS[tr.ins](nextT, f, len * sd, tr.vol, music);
      }
      nextT += sd; step++;
    }
  }

  // ---------- 音效 ----------
  function seqNotes(ins, notes, gap, vol, t0) { notes.forEach((n, i) => INS[ins](t0 + i * gap, freq(n), gap * 1.5, vol, sfxBus)); }
  A.sfx = function (name) {
    if (!ac) return;
    const t = ac.currentTime + 0.01;
    switch (name) {
      case 'cursor': { const o = osc('square', 1250, t, 0.05), g = envGain(t, 0.002, 0.05, 0.035), lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000; o.connect(lp); lp.connect(g); g.connect(sfxBus); break; }
      case 'ok': seqNotes('pluck', ['e6', 'a6'], 0.05, 0.2, t); break;
      case 'cancel': seqNotes('pluck', ['a5', 'e5'], 0.05, 0.18, t); break;
      case 'buy': seqNotes('pluck', ['e6', 'b6'], 0.06, 0.2, t); break;
      case 'talk': seqNotes('pluck', ['a5'], 0.05, 0.08, t); break;
      case 'slash': {
        const n = noise(t, 0.25), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
        bp.frequency.setValueAtTime(800, t); bp.frequency.exponentialRampToValueAtTime(5000, t + 0.15);
        const g = envGain(t, 0.01, 0.55, 0.18); n.connect(bp); bp.connect(g); g.connect(sfxBus); break;
      }
      case 'hit': case 'crit': {
        INS.taiko(t, 0, 0, name === 'crit' ? 0.7 : 0.5, sfxBus);
        const n = noise(t, 0.2), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200;
        const g = envGain(t, 0.002, 0.5, 0.12); n.connect(bp); bp.connect(g); g.connect(sfxBus);
        if (name === 'crit') { const o = osc('square', 1900, t, 0.3), g2 = envGain(t, 0.002, 0.08, 0.25); o.connect(g2); g2.connect(sfxBus); }
        break;
      }
      case 'fire': {
        const n = noise(t, 1.0), lp = ac.createBiquadFilter(); lp.type = 'lowpass';
        lp.frequency.setValueAtTime(300, t); lp.frequency.exponentialRampToValueAtTime(3500, t + 0.35); lp.frequency.exponentialRampToValueAtTime(400, t + 0.9);
        const g = envGain(t, 0.05, 0.7, 0.85); n.connect(lp); lp.connect(g); g.connect(sfxBus);
        INS.taiko(t + 0.05, 0, 0, 0.4, sfxBus); break;
      }
      case 'heal': seqNotes('flute', ['c6', 'e6', 'g6', 'c7'], 0.08, 0.14, t); break;
      case 'buff': seqNotes('pluck', ['a4', 'c5', 'e5', 'a5', 'c6'], 0.05, 0.16, t); break;
      case 'levelup': seqNotes('pluck', ['c5', 'e5', 'g5', 'c6', 'e6', 'g6'], 0.07, 0.18, t); break;
      case 'victory':
        seqNotes('pluck', ['a4', 'c5', 'e5', 'a5'], 0.11, 0.2, t);
        INS.flute(t + 0.44, freq('e6'), 0.25, 0.18, sfxBus); INS.flute(t + 0.7, freq('a6'), 1.0, 0.2, sfxBus);
        INS.taiko(t + 0.44, 0, 0, 0.4, sfxBus); break;
      case 'encounter': {
        INS.gong(t, 0, 0, 0.22, sfxBus);
        const n = noise(t, 0.5), bp = ac.createBiquadFilter(); bp.type = 'bandpass';
        bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(6000, t + 0.4);
        const g = envGain(t, 0.02, 0.4, 0.4); n.connect(bp); bp.connect(g); g.connect(sfxBus); break;
      }
      case 'gong': INS.gong(t, 0, 0, 0.3, sfxBus); break;
      case 'down': { INS.taiko(t, 0, 0, 0.6, sfxBus); INS.taiko(t + 0.12, 0, 0, 0.4, sfxBus); break; }
      case 'warp': {
        const n = noise(t, 0.4), bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1;
        bp.frequency.setValueAtTime(2000, t); bp.frequency.exponentialRampToValueAtTime(300, t + 0.35);
        const g = envGain(t, 0.05, 0.2, 0.3); n.connect(bp); bp.connect(g); g.connect(sfxBus); break;
      }
      case 'defeat': seqNotes('flute', ['e5', 'd5', 'c5', 'a4'], 0.35, 0.18, t); break;
    }
  };
})();
