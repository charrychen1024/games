/* ===========================================================
 * BATTLE CITY 90 — core constants & helpers
 * =========================================================== */
window.TB = window.TB || {};
(function (TB) {
  'use strict';

  // ---- geometry -------------------------------------------------
  // The battlefield is 13x13 "cells" of 16px. Bricks shatter in
  // 8px quarters, so terrain is stored on a 26x26 "quad" grid.
  var C = {
    QUAD: 8,
    CELL: 16,
    COLS: 26,            // quads across
    ROWS: 26,            // quads down
    FIELD_W: 208,
    FIELD_H: 208,
    FIELD_X: 8,
    FIELD_Y: 8,
    SCREEN_W: 256,
    SCREEN_H: 224,
    PANEL_X: 220,
    FPS: 60,

    TANK: 16,            // tank hitbox / sprite size
    BULLET: 4,

    MAX_ENEMIES_ON_FIELD: 4,
    ENEMIES_PER_STAGE: 20,
    POWERUP_SPAWN_INDEX: [3, 10, 17],   // 4th / 11th / 18th enemy carries a drop

    PLAYER_START_LIVES: 2,   // reserve tanks shown on the HUD
    MAX_PLAYER_LEVEL: 3,

    SHIELD_TIME: 10 * 60,
    SPAWN_SHIELD_TIME: 3 * 60,
    FREEZE_TIME: 10 * 60,
    SHOVEL_TIME: 18 * 60,
    POWERUP_LIFETIME: 22 * 60,
    SPAWN_BLINK_TIME: 72,
    RESPAWN_DELAY: 48
  };
  TB.C = C;

  // ---- terrain --------------------------------------------------
  var T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, TREES: 4, ICE: 5 };
  TB.T = T;
  TB.TERRAIN_CHARS = { '.': T.EMPTY, ' ': T.EMPTY, 'B': T.BRICK, '#': T.BRICK,
    'S': T.STEEL, '@': T.STEEL, 'W': T.WATER, '~': T.WATER,
    'T': T.TREES, 'F': T.TREES, 'I': T.ICE, '%': T.ICE };
  TB.CHAR_FOR_TERRAIN = ['.', 'B', 'S', 'W', 'T', 'I'];
  TB.TERRAIN_NAMES = ['EMPTY', 'BRICK', 'STEEL', 'WATER', 'TREES', 'ICE'];
  // terrain a tank cannot drive through
  TB.BLOCKS_TANK = [false, true, true, true, false, false];
  // terrain that stops a bullet
  TB.BLOCKS_BULLET = [false, true, true, false, false, false];

  // ---- directions ----------------------------------------------
  var D = { UP: 0, RIGHT: 1, DOWN: 2, LEFT: 3 };
  TB.D = D;
  TB.DX = [0, 1, 0, -1];
  TB.DY = [-1, 0, 1, 0];
  TB.OPPOSITE = [2, 3, 0, 1];

  // ---- enemy kinds ---------------------------------------------
  // faithful to the NES line-up: basic / fast / power / armor
  TB.ENEMY = {
    BASIC: 0,
    FAST: 1,
    POWER: 2,
    ARMOR: 3
  };
  TB.ENEMY_DEF = [
    { name: 'BASIC', art: 'basic', speed: 0.58, bullet: 2.6, hp: 1, score: 100, fireRate: 0.011 },
    { name: 'FAST',  art: 'fast',  speed: 1.22, bullet: 2.6, hp: 1, score: 200, fireRate: 0.010 },
    { name: 'POWER', art: 'power', speed: 0.80, bullet: 4.1, hp: 1, score: 300, fireRate: 0.020 },
    { name: 'ARMOR', art: 'armor', speed: 0.62, bullet: 2.6, hp: 4, score: 400, fireRate: 0.014 }
  ];

  // ---- power-ups ------------------------------------------------
  TB.PU = { STAR: 0, HELMET: 1, CLOCK: 2, SHOVEL: 3, GRENADE: 4, TANK: 5 };
  TB.PU_NAMES = ['STAR', 'HELMET', 'CLOCK', 'SHOVEL', 'GRENADE', 'TANK'];

  // ---- palette (NES-ish) ---------------------------------------
  TB.PAL = {
    black: '#000000',
    bg: '#636363',          // the grey "curtain" / surround
    field: '#000000',
    white: '#ffffff',
    grey: '#9c9c9c',
    dgrey: '#4a4a4a',
    yellow: '#e8c82c',
    orange: '#d87c00',
    red: '#c82c1c',
    green: '#4fa02a',
    blue: '#3c6cd8',
    brickA: '#9c4a28',
    brickB: '#d87c48',
    steelA: '#8c8c8c',
    steelB: '#dcdcdc',
    waterA: '#1c3c9c',
    waterB: '#3c6cd8',
    treeA: '#1c5c1c',
    treeB: '#2c8c2c',
    iceA: '#c8d8f8',
    iceB: '#eef4ff'
  };

  // ---- tank colour sets ----------------------------------------
  TB.TANK_PALETTES = {
    p1:      { o: '#6b5000', a: '#e8c82c', b: '#fff4a8', c: '#c0c0c0' },
    p2:      { o: '#1f4a0a', a: '#4fa02a', b: '#b4ec84', c: '#c0c0c0' },
    basic:   { o: '#3c3c3c', a: '#9c9c9c', b: '#d8d8d8', c: '#6b6b6b' },
    fast:    { o: '#5a5a5a', a: '#e4e4e4', b: '#ffffff', c: '#8c8c8c' },
    power:   { o: '#143a5c', a: '#5a9ad8', b: '#c0e0ff', c: '#9cc8f0' },
    armor1:  { o: '#4a2a00', a: '#c87c18', b: '#f0c070', c: '#8c5c10' },  // 1 hit left
    armor2:  { o: '#5a5a00', a: '#c8c82c', b: '#f4f49c', c: '#8c8c18' },  // 2
    armor3:  { o: '#1c4a1c', a: '#4fa02a', b: '#a8e878', c: '#2c6c2c' },  // 3
    armor4:  { o: '#3c3c3c', a: '#b4b4b4', b: '#ececec', c: '#7c7c7c' },  // 4 (full)
    bonusA:  { o: '#5c1010', a: '#d83030', b: '#ff9090', c: '#a01818' },
    bonusB:  { o: '#3c3c3c', a: '#e8e8e8', b: '#ffffff', c: '#a0a0a0' }
  };

  // ---- small helpers -------------------------------------------
  TB.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  TB.randInt = function (n) { return (Math.random() * n) | 0; };
  TB.pick = function (arr) { return arr[(Math.random() * arr.length) | 0]; };
  TB.chance = function (p) { return Math.random() < p; };
  TB.snap8 = function (v) { return Math.round(v / 8) * 8; };
  TB.overlap = function (ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && bx < ax + aw && ay < by + bh && by < ay + ah;
  };
  TB.pad = function (n, w, ch) {
    var s = '' + n;
    while (s.length < w) s = (ch || ' ') + s;
    return s;
  };
  TB.shuffle = function (a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0, t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  // deterministic 2d hash, used by the procedural explosion art
  TB.hash2 = function (x, y, seed) {
    var h = (x * 374761393 + y * 668265263 + (seed || 0) * 1274126177) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  // an off-screen canvas helper
  TB.makeCanvas = function (w, h) {
    var cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    var cx = cv.getContext('2d');
    cx.imageSmoothingEnabled = false;
    return cv;
  };

  /* Paint string-art into a canvas.
   * rows: array of equal-length strings, map: { char: colour|null } */
  TB.paintArt = function (rows, map, scale) {
    scale = scale || 1;
    var h = rows.length, w = rows[0].length;
    var cv = TB.makeCanvas(w * scale, h * scale);
    var cx = cv.getContext('2d');
    for (var y = 0; y < h; y++) {
      var line = rows[y];
      for (var x = 0; x < line.length; x++) {
        var col = map[line.charAt(x)];
        if (!col) continue;
        cx.fillStyle = col;
        cx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return cv;
  };

  /* Rotate string-art 90° clockwise (exact, pixel level). */
  TB.rotateArt = function (rows) {
    var h = rows.length, w = rows[0].length, out = [];
    for (var r = 0; r < w; r++) {
      var line = '';
      for (var c = 0; c < h; c++) line += rows[h - 1 - c].charAt(r);
      out.push(line);
    }
    return out;
  };
})(window.TB);
