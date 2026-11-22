/* ===========================================================
 * Chiptune SFX synthesised with WebAudio — no sample files.
 * =========================================================== */
(function (TB) {
  'use strict';

  var ctx = null, master = null, noiseBuf = null;
  var engineOsc = null, engineGain = null, engineFilter = null;
  var enabled = true, started = false;

  function now() { return ctx ? ctx.currentTime : 0; }

  function makeNoise() {
    var len = Math.floor(ctx.sampleRate * 0.5);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  var A = TB.audio = {
    get enabled() { return enabled; },
    get started() { return started; },

    init: function () {
      if (started) return true;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { enabled = false; return false; }
      try { ctx = new AC(); } catch (e) { enabled = false; return false; }
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      noiseBuf = makeNoise();

      // persistent engine drone (volume 0 when idle)
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'square';
      engineOsc.frequency.value = 42;
      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 700;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();

      started = true;
      return true;
    },

    resume: function () {
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },

    setEnabled: function (v) {
      enabled = !!v;
      if (master) master.gain.value = enabled ? 0.35 : 0;
      if (!enabled) A.engine(0);
    },

    /* mode: 0 = silent, 1 = idle, 2 = moving */
    engine: function (mode) {
      if (!started || !enabled) return;
      var g = mode === 0 ? 0 : (mode === 1 ? 0.045 : 0.085);
      var f = mode === 2 ? 76 : 40;
      engineGain.gain.setTargetAtTime(g, now(), 0.03);
      engineOsc.frequency.setTargetAtTime(f, now(), 0.03);
    },

    tone: function (freq, dur, opt) {
      if (!started || !enabled) return;
      opt = opt || {};
      var t = now() + (opt.delay || 0);
      var o = ctx.createOscillator();
      o.type = opt.type || 'square';
      var g = ctx.createGain();
      o.frequency.setValueAtTime(freq, t);
      if (opt.to) o.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t + dur);
      var vol = opt.vol == null ? 0.3 : opt.vol;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master);
      o.start(t); o.stop(t + dur + 0.02);
    },

    noise: function (dur, opt) {
      if (!started || !enabled) return;
      opt = opt || {};
      var t = now() + (opt.delay || 0);
      var s = ctx.createBufferSource();
      s.buffer = noiseBuf;
      s.loop = true;
      var f = ctx.createBiquadFilter();
      f.type = opt.hp ? 'highpass' : 'lowpass';
      f.frequency.setValueAtTime(opt.freq || 1200, t);
      if (opt.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(60, opt.freqTo), t + dur);
      var g = ctx.createGain();
      var vol = opt.vol == null ? 0.3 : opt.vol;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(master);
      s.start(t); s.stop(t + dur + 0.02);
    },

    melody: function (notes, opt) {
      if (!started || !enabled) return;
      opt = opt || {};
      var t = 0;
      for (var i = 0; i < notes.length; i++) {
        var n = notes[i];
        if (n[0] > 0) {
          A.tone(n[0], n[1] * 0.92, { delay: t, vol: opt.vol == null ? 0.26 : opt.vol, type: opt.type || 'square' });
        }
        t += n[1];
      }
    },

    // ---- named effects ------------------------------------------
    fire:      function () { A.tone(880, 0.08, { to: 180, vol: 0.2, type: 'square' }); },
    hitBrick:  function () { A.noise(0.06, { freq: 2600, vol: 0.22, hp: true }); },
    hitSteel:  function () { A.noise(0.05, { freq: 5000, vol: 0.2, hp: true }); A.tone(1600, 0.04, { to: 900, vol: 0.12 }); },
    hitArmor:  function () { A.tone(300, 0.07, { to: 700, vol: 0.18, type: 'triangle' }); },
    expSmall:  function () { A.noise(0.22, { freq: 1800, freqTo: 180, vol: 0.3 }); },
    expBig:    function () { A.noise(0.55, { freq: 1400, freqTo: 90, vol: 0.42 }); A.tone(120, 0.4, { to: 40, vol: 0.2, type: 'sawtooth' }); },
    bulletHit: function () { A.noise(0.04, { freq: 3400, vol: 0.14, hp: true }); },
    powerupAppear: function () { A.melody([[1046, 0.07], [1318, 0.07], [1568, 0.1]], { vol: 0.17, type: 'triangle' }); },
    pickup:    function () { A.melody([[784, 0.06], [988, 0.06], [1318, 0.06], [1568, 0.12]], { vol: 0.22 }); },
    extraLife: function () { A.melody([[523, 0.08], [659, 0.08], [784, 0.08], [1046, 0.16]], { vol: 0.24 }); },
    freeze:    function () { A.melody([[1568, 0.08], [1318, 0.08], [1046, 0.08], [784, 0.16]], { vol: 0.2, type: 'triangle' }); },
    shovel:    function () { A.melody([[220, 0.09], [330, 0.09], [440, 0.14]], { vol: 0.2, type: 'sawtooth' }); },
    stageStart: function () { A.melody([[392, 0.1], [523, 0.1], [659, 0.1], [784, 0.2]], { vol: 0.24 }); },
    stageClear: function () { A.melody([[523, 0.1], [659, 0.1], [784, 0.1], [1046, 0.1], [784, 0.1], [1046, 0.3]], { vol: 0.24 }); },
    gameOver:  function () { A.melody([[392, 0.16], [330, 0.16], [262, 0.16], [196, 0.4]], { vol: 0.26, type: 'triangle' }); },
    menuMove:  function () { A.tone(660, 0.05, { vol: 0.14 }); },
    menuPick:  function () { A.tone(990, 0.09, { to: 1320, vol: 0.18 }); },
    pause:     function () { A.tone(1320, 0.08, { vol: 0.18 }); },
    scoreTick: function () { A.tone(1760, 0.03, { vol: 0.1 }); },
    baseLost:  function () { A.noise(0.8, { freq: 900, freqTo: 60, vol: 0.45 }); A.tone(90, 0.7, { to: 35, vol: 0.25, type: 'sawtooth' }); },
    title:     function () {
      A.melody([[523, 0.14], [523, 0.14], [784, 0.14], [784, 0.14],
                [880, 0.14], [784, 0.28], [659, 0.14], [523, 0.3]], { vol: 0.2 });
    }
  };
})(window.TB);
