/* ============================================================
 * 烽烟录 · 引擎核心：工具函数、画布、输入、计时、场景、主循环
 * ============================================================ */
'use strict';
(function () {
  const G = (window.G = {});
  G.W = 960; G.H = 540; G.T = 48;
  G.TAU = Math.PI * 2;
  G.FONT = '"Kaiti SC","STKaiti","KaiTi","BiauKai","Songti SC","STSong","SimSun","Noto Serif CJK SC",serif';
  G.font = (px, bold) => (bold ? 'bold ' : '') + px + 'px ' + G.FONT;

  // ---------- 数学与随机 ----------
  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.easeOut = t => 1 - (1 - t) * (1 - t);
  G.easeIn = t => t * t;
  G.easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  G.easeBack = t => { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
  G.rnd = (a, b) => a + Math.random() * (b - a);
  G.ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = a => a[Math.floor(Math.random() * a.length)];
  G.hash = (x, y, s = 0) => {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  G.seeded = seed => {
    let s = (seed >>> 0) || 1;
    return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  };
  G.noise = (x, y, s = 0) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = G.hash(xi, yi, s), b = G.hash(xi + 1, yi, s), c = G.hash(xi, yi + 1, s), d = G.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  G.fbm = (x, y, s = 0) => G.noise(x, y, s) * 0.6 + G.noise(x * 2.1, y * 2.1, s + 7) * 0.3 + G.noise(x * 4.3, y * 4.3, s + 13) * 0.1;

  // ---------- 颜色 ----------
  function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  G.shade = (hex, a) => {
    let [r, g, b] = rgb(hex);
    if (a < 0) { r *= 1 + a; g *= 1 + a; b *= 1 + a; } else { r += (255 - r) * a; g += (255 - g) * a; b += (255 - b) * a; }
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
  G.rgba = (hex, a) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };

  // ---------- 画布 ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  G.canvas = canvas; G.ctx = ctx;
  function resize() {
    const s = Math.min(window.innerWidth / G.W, window.innerHeight / G.H);
    G.dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.width = Math.floor(G.W * s) + 'px';
    canvas.style.height = Math.floor(G.H * s) + 'px';
    canvas.width = Math.max(1, Math.floor(G.W * s * G.dpr));
    canvas.height = Math.max(1, Math.floor(G.H * s * G.dpr));
    G.px = canvas.width / G.W;
  }
  window.addEventListener('resize', resize);
  resize();
  G.makeCanvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };

  // ---------- 输入 ----------
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'ok', NumpadEnter: 'ok', Space: 'ok', KeyZ: 'ok', KeyJ: 'ok',
    Escape: 'cancel', KeyX: 'cancel', KeyK: 'cancel', Backspace: 'cancel',
    ShiftLeft: 'run', ShiftRight: 'run', KeyM: 'mute',
  };
  G.keys = {}; G.pressed = {};
  const holdT = {};
  G.press = k => { if (!G.keys[k]) { G.pressed[k] = true; holdT[k] = 0; } G.keys[k] = true; };
  G.release = k => { G.keys[k] = false; };
  window.addEventListener('keydown', e => {
    const k = KEYMAP[e.code]; if (!k) return;
    e.preventDefault();
    if (G.audio) G.audio.unlock();
    if (k === 'mute' && !e.repeat) { G.audio && G.audio.toggleMute(); return; }
    G.press(k);
  });
  window.addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) G.release(k); });
  window.addEventListener('blur', () => { for (const k in G.keys) G.keys[k] = false; });
  canvas.addEventListener('pointerdown', () => { if (G.audio) G.audio.unlock(); });
  G.hit = k => { if (G.pressed[k]) { G.pressed[k] = false; return true; } return false; };
  // 菜单用：按下立刻触发，按住 0.32 秒后连发
  G.rep = k => {
    if (G.pressed[k]) { G.pressed[k] = false; return true; }
    if (G.keys[k] && holdT[k] > 0.32) { holdT[k] = 0.23; return true; }
    return false;
  };

  // ---------- 计时与补间 ----------
  const timers = [], tweens = [];
  G.time = 0;
  G.wait = s => new Promise(r => timers.push({ t: G.time + s, r }));
  G.tween = (obj, props, dur, ease = G.easeOut) => new Promise(r => {
    const from = {}; for (const k in props) from[k] = obj[k];
    tweens.push({ obj, props, from, dur: Math.max(0.001, dur), t: 0, ease, r });
  });

  // ---------- 场景 ----------
  G.scenes = [];
  G.setScene = s => { G.scenes = [s]; };
  G.pushScene = s => { G.scenes.push(s); };
  G.popScene = () => G.scenes.pop();

  // ---------- 淡入淡出 / 震屏 ----------
  G.fadeA = 0; G.fadeColor = '#000';
  let fade = null;
  G.fadeTo = (a, dur = 0.45, color) => {
    if (color) G.fadeColor = color;
    return new Promise(r => { if (fade) fade.r(); fade = { from: G.fadeA, to: a, t: 0, dur, r }; });
  };
  G.fadeOut = (d, c) => G.fadeTo(1, d, c || '#000');
  G.fadeIn = d => G.fadeTo(0, d);
  G.shakeT = 0; G.shakeAmp = 0;
  G.shake = (amp, t) => { G.shakeAmp = amp; G.shakeT = t; };

  // ---------- 脚本 ----------
  G.scriptBusy = 0;
  G.run = async fn => {
    G.scriptBusy++;
    try { await fn(); } catch (e) { console.error(e); } finally { G.scriptBusy = Math.max(0, G.scriptBusy - 1); }
  };
  G.locked = () => G.scriptBusy > 0 || (G.ui && G.ui.modal()) || !!fade;

  // ---------- 绘图辅助 ----------
  G.rr = (c, x, y, w, h, r) => {
    c.beginPath(); c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  };
  G.text = (c, str, x, y, o = {}) => {
    c.font = G.font(o.size || 20, o.bold);
    c.textAlign = o.align || 'left'; c.textBaseline = o.base || 'middle';
    if (o.shadow) { c.fillStyle = o.shadow; c.fillText(str, x + 1.5, y + 2); }
    if (o.stroke) { c.lineJoin = 'round'; c.strokeStyle = o.stroke; c.lineWidth = o.sw || 4; c.strokeText(str, x, y); }
    c.fillStyle = o.color || '#f3e6c8'; c.fillText(str, x, y);
  };

  // ---------- 主循环 ----------
  G.frame = 0;
  G.step = function (dt) {
    G.dt = dt; G.time += dt; G.frame++;
    for (const k in G.keys) if (G.keys[k]) holdT[k] = (holdT[k] || 0) + dt;
    for (let i = timers.length - 1; i >= 0; i--) if (G.time >= timers[i].t) { const r = timers[i].r; timers.splice(i, 1); r(); }
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i]; tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur), e = tw.ease(p);
      for (const k in tw.props) tw.obj[k] = tw.from[k] + (tw.props[k] - tw.from[k]) * e;
      if (p >= 1) { tweens.splice(i, 1); tw.r(); }
    }
    if (fade) {
      fade.t += dt; const p = Math.min(1, fade.t / fade.dur);
      G.fadeA = fade.from + (fade.to - fade.from) * p;
      if (p >= 1) { const r = fade.r; fade = null; r(); }
    }
    if (G.shakeT > 0) G.shakeT -= dt;
    G.ui.update(dt);
    const top = G.scenes[G.scenes.length - 1];
    if (top && top.update) top.update(dt);
    if (G.state && G.scenes[0] === G.world) G.state.playTime = (G.state.playTime || 0) + dt;
  };
  G.draw = function () {
    ctx.setTransform(G.px, 0, 0, G.px, 0, 0);
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, G.W, G.H);
    let start = 0;
    for (let i = G.scenes.length - 1; i >= 0; i--) if (G.scenes[i].opaque) { start = i; break; }
    ctx.save();
    if (G.shakeT > 0) ctx.translate((Math.random() - 0.5) * G.shakeAmp * 2, (Math.random() - 0.5) * G.shakeAmp * 2);
    for (let i = start; i < G.scenes.length; i++) G.scenes[i].draw(ctx);
    ctx.restore();
    G.ui.draw(ctx);
    if (G.fadeA > 0.001) { ctx.globalAlpha = Math.min(1, G.fadeA); ctx.fillStyle = G.fadeColor; ctx.fillRect(0, 0, G.W, G.H); ctx.globalAlpha = 1; }
    for (const k in G.pressed) G.pressed[k] = false;
  };
  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    requestAnimationFrame(loop);
    if (!G.paused) {
      try { G.step(dt * (G.speed || 1)); G.draw(); }
      catch (e) { if (!G._errLogged || G.time - G._errLogged > 2) { console.error(e); G._errLogged = G.time; } for (const k in G.pressed) G.pressed[k] = false; }
    }
  }
  G.start = () => requestAnimationFrame(t => { last = t; requestAnimationFrame(loop); });
})();
