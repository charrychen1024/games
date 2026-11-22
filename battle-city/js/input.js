/* ===========================================================
 * Keyboard + mouse input.
 * =========================================================== */
(function (TB) {
  'use strict';

  var down = {}, pressed = {}, consumedPress = {};
  var I = TB.input = {
    mouse: { x: -1, y: -1, inside: false, down: false, rdown: false,
             clicked: false, rclicked: false, released: false, dragging: false },
    anyKeyPressed: false
  };

  // key -> logical action
  var P1 = { up: ['KeyW'], down: ['KeyS'], left: ['KeyA'], right: ['KeyD'],
             fire: ['KeyJ', 'Space'] };
  var P2 = { up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
             fire: ['Numpad0', 'ShiftRight', 'Slash', 'NumpadEnter'] };
  var PLAYERS = [P1, P2];

  var MENU = {
    up: ['ArrowUp', 'KeyW'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA'],
    right: ['ArrowRight', 'KeyD'],
    confirm: ['Enter', 'Space', 'KeyJ', 'NumpadEnter'],
    back: ['Escape', 'Backspace']
  };

  function anyDown(list) {
    for (var i = 0; i < list.length; i++) if (down[list[i]]) return true;
    return false;
  }
  function anyPressed(list) {
    for (var i = 0; i < list.length; i++) {
      if (pressed[list[i]] && !consumedPress[list[i]]) return true;
    }
    return false;
  }

  I.held = function (code) { return !!down[code]; };
  I.hit = function (code) { return !!pressed[code] && !consumedPress[code]; };

  I.playerDir = function (idx) {
    var m = PLAYERS[idx];
    if (!m) return -1;
    // most-recently-pressed direction wins so turns feel crisp
    var order = I._dirOrder[idx];
    for (var i = order.length - 1; i >= 0; i--) {
      var d = order[i];
      if (anyDown(m[['up', 'right', 'down', 'left'][d]])) return d;
    }
    return -1;
  };
  I.playerFire = function (idx) {
    var m = PLAYERS[idx];
    return m ? anyPressed(m.fire) : false;
  };
  I.playerFireHeld = function (idx) {
    var m = PLAYERS[idx];
    return m ? anyDown(m.fire) : false;
  };

  I.menu = {
    up: function () { return anyPressed(MENU.up); },
    down: function () { return anyPressed(MENU.down); },
    left: function () { return anyPressed(MENU.left); },
    right: function () { return anyPressed(MENU.right); },
    confirm: function () { return anyPressed(MENU.confirm); },
    back: function () { return anyPressed(MENU.back); }
  };

  I._dirOrder = [[0, 1, 2, 3], [0, 1, 2, 3]];

  function noteDir(idx, dir) {
    var o = I._dirOrder[idx];
    var p = o.indexOf(dir);
    if (p >= 0) o.splice(p, 1);
    o.push(dir);
  }

  var DIRKEY = {};
  (function () {
    for (var p = 0; p < 2; p++) {
      var m = PLAYERS[p];
      var names = ['up', 'right', 'down', 'left'];
      for (var d = 0; d < 4; d++) {
        var list = m[names[d]];
        for (var i = 0; i < list.length; i++) {
          DIRKEY[p + ':' + list[i]] = d;
        }
      }
    }
  })();

  I.consume = function (code) { consumedPress[code] = true; };

  /* after a blocking browser dialog, keys can be left stuck down */
  I.reset = function () {
    down = {}; pressed = {}; consumedPress = {};
    I.mouse.down = false; I.mouse.rdown = false;
    I.mouse.clicked = false; I.mouse.rclicked = false;
  };

  /* called once per simulation tick, after the frame has read input */
  I.endFrame = function () {
    pressed = {};
    consumedPress = {};
    I.anyKeyPressed = false;
    I.mouse.clicked = false;
    I.mouse.rclicked = false;
    I.mouse.released = false;
  };

  var PREVENT = {
    ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1, Tab: 1,
    Enter: 1, Slash: 1, Backspace: 1, KeyW: 1, KeyA: 1, KeyS: 1, KeyD: 1
  };

  I.attach = function (canvas, onFirstGesture) {
    window.addEventListener('keydown', function (e) {
      if (PREVENT[e.code]) e.preventDefault();
      if (e.repeat) return;
      down[e.code] = true;
      pressed[e.code] = true;
      I.anyKeyPressed = true;
      for (var p = 0; p < 2; p++) {
        var d = DIRKEY[p + ':' + e.code];
        if (d != null) noteDir(p, d);
      }
      if (onFirstGesture) onFirstGesture();
    });
    window.addEventListener('keyup', function (e) {
      down[e.code] = false;
    });
    window.addEventListener('blur', function () { down = {}; });

    function setMouse(e) {
      var r = canvas.getBoundingClientRect();
      var sx = TB.C.SCREEN_W / r.width, sy = TB.C.SCREEN_H / r.height;
      I.mouse.x = (e.clientX - r.left) * sx;
      I.mouse.y = (e.clientY - r.top) * sy;
      I.mouse.inside = I.mouse.x >= 0 && I.mouse.y >= 0 &&
                       I.mouse.x < TB.C.SCREEN_W && I.mouse.y < TB.C.SCREEN_H;
    }

    canvas.addEventListener('mousemove', setMouse);
    canvas.addEventListener('mousedown', function (e) {
      setMouse(e);
      e.preventDefault();
      if (e.button === 2) { I.mouse.rdown = true; I.mouse.rclicked = true; }
      else { I.mouse.down = true; I.mouse.clicked = true; }
      if (onFirstGesture) onFirstGesture();
    });
    window.addEventListener('mouseup', function (e) {
      if (e.button === 2) I.mouse.rdown = false;
      else { I.mouse.down = false; I.mouse.released = true; }
    });
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    canvas.addEventListener('mouseleave', function () { I.mouse.inside = false; });
  };
})(window.TB);
