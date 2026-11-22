/* ===========================================================
 * localStorage wrapper with an in-memory fallback, so the game
 * still works when opened straight off the filesystem.
 * =========================================================== */
(function (TB) {
  'use strict';

  var PREFIX = 'tb90.';
  var mem = {};
  var ok = (function () {
    try {
      window.localStorage.setItem(PREFIX + '__t', '1');
      window.localStorage.removeItem(PREFIX + '__t');
      return true;
    } catch (e) { return false; }
  })();

  var S = TB.store = {
    persistent: ok,

    get: function (key, dflt) {
      var raw;
      try { raw = ok ? window.localStorage.getItem(PREFIX + key) : mem[key]; }
      catch (e) { raw = mem[key]; }
      if (raw == null) return dflt;
      try { return JSON.parse(raw); } catch (e) { return dflt; }
    },

    set: function (key, value) {
      var raw = JSON.stringify(value);
      mem[key] = raw;
      try { if (ok) window.localStorage.setItem(PREFIX + key, raw); } catch (e) { /* quota */ }
    },

    remove: function (key) {
      delete mem[key];
      try { if (ok) window.localStorage.removeItem(PREFIX + key); } catch (e) { }
    }
  };

  // ---- typed accessors ------------------------------------------
  S.hiScore = function () { return S.get('hiscore', 20000); };
  S.setHiScore = function (v) { S.set('hiscore', v | 0); };

  S.settings = function () {
    var d = { sound: true, scanlines: true, scale: 3, startStage: 1 };
    var s = S.get('settings', {});
    for (var k in d) if (!(k in s)) s[k] = d[k];
    return s;
  };
  S.saveSettings = function (s) { S.set('settings', s); };

  /* custom stages: [{ name, data(26 strings), enemies:[20 ids] }] */
  S.customStages = function () { return S.get('stages', []); };
  S.saveCustomStages = function (list) { S.set('stages', list); };
})(window.TB);
