/* ===========================================================
 * Boot, canvas scaling, fixed-step loop, page chrome.
 * =========================================================== */
(function (TB) {
  'use strict';

  var C = TB.C;
  var canvas, ctx, buffer, bctx;
  var scale = 3;
  var acc = 0, last = 0;
  var STEP = 1000 / 60;
  var booted = false;

  var el = {};

  /* Test hook: when stepping is on, the loop stops advancing the
   * simulation so a harness can drive it frame by frame. */
  TB.debug = {
    stepping: false,
    step: function (n) {
      for (var i = 0; i < (n || 1); i++) { TB.game.update(); TB.input.endFrame(); }
    },
    key: function (code, frames) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code: code, bubbles: true }));
      TB.debug.step(frames || 1);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: code, bubbles: true }));
    }
  };

  function $(id) { return document.getElementById(id); }

  function applyScale() {
    var s = TB.game.settings ? TB.game.settings.scale : 3;
    if (!s) {
      var availW = Math.max(256, window.innerWidth - 48);
      var availH = Math.max(224, window.innerHeight - 230);
      s = Math.max(1, Math.min(Math.floor(availW / C.SCREEN_W), Math.floor(availH / C.SCREEN_H)));
    }
    scale = s;
    canvas.width = C.SCREEN_W * scale;
    canvas.height = C.SCREEN_H * scale;
    ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
  }

  function present() {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buffer, 0, 0, canvas.width, canvas.height);
    if (TB.game.settings && TB.game.settings.scanlines && scale >= 2) {
      ctx.fillStyle = 'rgba(0,0,0,0.20)';
      for (var y = scale - 1; y < canvas.height; y += scale) {
        ctx.fillRect(0, y, canvas.width, 1);
      }
    }
  }

  function frame(now) {
    if (!last) last = now;
    var dt = now - last;
    last = now;
    if (dt > 250) dt = STEP;           // tab was hidden; don't fast-forward
    acc += dt;
    var steps = 0;
    if (TB.debug.stepping) acc = 0;
    while (acc >= STEP && steps < 5) {
      TB.game.update();
      TB.input.endFrame();
      acc -= STEP;
      steps++;
    }
    TB.game.draw(bctx);
    present();
    if (el.status) {
      var t = TB.game.statusText();
      if (el.status.textContent !== t) el.status.textContent = t;
    }
    requestAnimationFrame(frame);
  }

  function firstGesture() {
    if (booted) return;
    booted = true;
    TB.audio.init();
    TB.audio.setEnabled(TB.game.settings.sound);
    TB.audio.resume();
    if (el.boot) el.boot.hidden = true;
    TB.audio.title();
  }

  function download(name, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
  }

  TB.host = {
    setEditorMode: function (on) {
      if (el.editorTools) el.editorTools.hidden = !on;
      if (canvas) canvas.classList.toggle('editing', !!on);
    }
  };

  function wireToolbar() {
    el.boot = $('boot');
    el.status = $('status');
    el.editorTools = $('editor-tools');

    var btnSound = $('btn-sound');
    var btnScan = $('btn-scan');
    var selScale = $('sel-scale');

    function syncButtons() {
      var s = TB.game.settings;
      btnSound.classList.toggle('off', !s.sound);
      btnScan.classList.toggle('off', !s.scanlines);
      selScale.value = '' + s.scale;
    }

    btnSound.addEventListener('click', function () {
      var s = TB.game.settings;
      s.sound = !s.sound;
      TB.audio.setEnabled(s.sound);
      TB.store.saveSettings(s);
      syncButtons();
      canvas.focus();
    });
    btnScan.addEventListener('click', function () {
      var s = TB.game.settings;
      s.scanlines = !s.scanlines;
      TB.store.saveSettings(s);
      syncButtons();
    });
    selScale.addEventListener('change', function () {
      var s = TB.game.settings;
      s.scale = parseInt(selScale.value, 10) || 0;
      TB.store.saveSettings(s);
      applyScale();
    });
    $('btn-fullscreen').addEventListener('click', function () {
      var wrap = $('stage-wrap');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (wrap.requestFullscreen) wrap.requestFullscreen();
    });

    $('btn-export').addEventListener('click', function () {
      var stages = TB.game.editor ? TB.game.editor.slots : TB.store.customStages();
      if (!stages.length) { alert('还没有保存的关卡，先在编辑器里按 S 保存。'); return; }
      download('battle-city-90-stages.json',
        JSON.stringify({ format: 'battle-city-90', version: 1, stages: stages }, null, 1));
    });
    $('btn-import').addEventListener('click', function () { $('file-import').click(); });
    $('file-import').addEventListener('change', function (e) {
      var f = e.target.files && e.target.files[0];
      if (!f) return;
      var rd = new FileReader();
      rd.onload = function () {
        if (TB.game.editor) TB.game.editor.importJSON('' + rd.result);
        else {
          try {
            var data = JSON.parse('' + rd.result);
            var list = Array.isArray(data) ? data : data.stages;
            if (Array.isArray(list)) {
              TB.store.saveCustomStages(TB.store.customStages().concat(list));
              alert('已导入 ' + list.length + ' 个关卡。');
            }
          } catch (err) { alert('JSON 解析失败。'); }
        }
      };
      rd.readAsText(f);
      e.target.value = '';
    });

    syncButtons();
  }

  function boot() {
    canvas = $('screen');
    buffer = TB.makeCanvas(C.SCREEN_W, C.SCREEN_H);
    bctx = buffer.getContext('2d');
    bctx.imageSmoothingEnabled = false;

    TB.sprites.build();
    TB.game.init();
    wireToolbar();
    applyScale();
    TB.input.attach(canvas, firstGesture);
    window.addEventListener('resize', function () {
      if (!TB.game.settings.scale) applyScale();
    });
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window.TB);
