/* ===========================================================
 * Procedural pixel art — tanks, terrain, eagle, items, FX.
 * Everything is generated at boot, so the game needs no assets.
 * =========================================================== */
(function (TB) {
  'use strict';

  var PAL = TB.PAL;

  /* ---------- tank string-art (facing UP) ---------------------
   * a = body     b = body highlight   c = barrel / turret
   * o = outline  L = tread edge       M = tread link (animated)
   */
  var ART = {
    player0: [
      '.......cc.......',
      '.......cc.......',
      '.......cc.......',
      'LML....cc....LML',
      'LML....cc....LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aabccbaa.LML',
      'LML.aabccbaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML..........LML',
      'LML..........LML'
    ],
    player1: [
      '.......cc.......',
      '.......cc.......',
      '.......cc.......',
      'LML...cccc...LML',
      'LML...cccc...LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aabccbaa.LML',
      'LML.aabccbaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML..........LML',
      'LML..........LML'
    ],
    player2: [
      '.....cc..cc.....',
      '.....cc..cc.....',
      '.....cc..cc.....',
      'LML..cc..cc..LML',
      'LML..cccccc..LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.abbccbba.LML',
      'LML.abbccbba.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML..........LML',
      'LML..........LML'
    ],
    player3: [
      '.....cc..cc.....',
      '.....cc..cc.....',
      '.....cc..cc.....',
      'LLML.cc..cc.LMLL',
      'LLML.cccccc.LMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLabbccbbaLMLL',
      'LLMLabbccbbaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLML........LMLL',
      'LLML........LMLL'
    ],
    basic: [
      '.......cc.......',
      '.......cc.......',
      'LML....cc....LML',
      'LML....cc....LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.abbbbbba.LML',
      'LML.abccccba.LML',
      'LML.abccccba.LML',
      'LML.abbbbbba.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML..........LML',
      'LML..........LML'
    ],
    fast: [
      '.......cc.......',
      '.......cc.......',
      '.......cc.......',
      '.......cc.......',
      'LML....cc....LML',
      'LML..aaaaaa..LML',
      'LML.aaaaaaaa.LML',
      'LML.aaccccaa.LML',
      'LML.aaccccaa.LML',
      'LML.aaaaaaaa.LML',
      'LML..aaaaaa..LML',
      'LML..aaaaaa..LML',
      'LML..aaaaaa..LML',
      'LML..aaaaaa..LML',
      'LML..........LML',
      'LML..........LML'
    ],
    power: [
      '.....cc..cc.....',
      '.....cc..cc.....',
      '.....cc..cc.....',
      'LML..cc..cc..LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.abbbbbba.LML',
      'LML.abccccba.LML',
      'LML.abccccba.LML',
      'LML.abbbbbba.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML.aaaaaaaa.LML',
      'LML..........LML',
      'LML..........LML'
    ],
    armor: [
      '.......cc.......',
      '.......cc.......',
      '.......cc.......',
      'LLML...cc...LMLL',
      'LLML...cc...LMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLabbbbbbaLMLL',
      'LLMLabccccbaLMLL',
      'LLMLabccccbaLMLL',
      'LLMLabbbbbbaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLMLaaaaaaaaLMLL',
      'LLML........LMLL',
      'LLML........LMLL'
    ]
  };

  /* ---------- eagle / base ----------------------------------- */
  var EAGLE = [
    '................',
    '.......oo.......',
    '......oaao......',
    '.....oaaaao.....',
    '.oo..oaaaao..oo.',
    'oaaooaaaaaaooaao',
    'oaaaaaaaaaaaaaao',
    'oaaaaaaaaaaaaaao',
    '.oaaaaaaaaaaaao.',
    '..oaaaoaaoaaao..',
    '...oaao..oaao...',
    '....oo....oo....',
    '..oooooooooooo..',
    '..obbbbbbbbbbo..',
    '..oooooooooooo..',
    '................'
  ];
  var EAGLE_DEAD = [
    '................',
    '................',
    '................',
    '....oo....oo....',
    '...oaao..oaao...',
    '...oaaoooaao....',
    '....oaaaaao.....',
    '...oaaoooaao....',
    '..oaao...oaao...',
    '..oao.....oao...',
    '..oo.......oo...',
    '................',
    '..oooooooooooo..',
    '..obbbbbbbbbbo..',
    '..oooooooooooo..',
    '................'
  ];

  var FLAG = [
    '................',
    '..oo............',
    '..oobbbbbbbo....',
    '..oobbbbbbbo....',
    '..oobbbbbbbo....',
    '..oobbbbbbbo....',
    '..oobbbbbbbo....',
    '..ooooooooo.....',
    '..oo............',
    '..oo............',
    '..oo............',
    '..oo............',
    '.oooo...........',
    '.oooo...........',
    '................',
    '................'
  ];

  var MINI_TANK = [
    '...oo...',
    '.o.oo.o.',
    '.oooooo.',
    '.oooooo.',
    '.oooooo.',
    '.o.oo.o.',
    '........',
    '........'
  ];

  /* ---------- power-up icons (12x12 inside a 16x16 box) ------- */
  var ICONS = {
    star: [
      '.....aa.....',
      '....aaaa....',
      '....aaaa....',
      'aaaaaaaaaaaa',
      '.aaaaaaaaaa.',
      '..aaaaaaaa..',
      '..aaaaaaaa..',
      '.aaaa..aaaa.',
      '.aaa....aaa.',
      '.aa......aa.',
      '............',
      '............'
    ],
    helmet: [
      '....aaaa....',
      '..aaaaaaaa..',
      '.aaaaaaaaaa.',
      'aaaaaaaaaaaa',
      'aaaaaaaaaaaa',
      'aaaaaaaaaaaa',
      'aaaaaaaaaaaa',
      'aaa.aaaa.aaa',
      'aaa.aaaa.aaa',
      '............',
      '............',
      '............'
    ],
    clock: [
      '....aaaa....',
      '..aa....aa..',
      '.a...aa...a.',
      '.a...aa...a.',
      'a....aa....a',
      'a....aaaaa.a',
      '.a........a.',
      '.a........a.',
      '..aa....aa..',
      '....aaaa....',
      '............',
      '............'
    ],
    shovel: [
      '.....aa.....',
      '.....aa.....',
      '.....aa.....',
      '...aaaaaa...',
      '..aaaaaaaa..',
      '.aaaaaaaaaa.',
      '.aaaaaaaaaa.',
      '.aaaaaaaaaa.',
      '..aaaaaaaa..',
      '...aaaaaa...',
      '....aaaa....',
      '............'
    ],
    grenade: [
      '........aa..',
      '.......aa...',
      '...aaaaaa...',
      '..aaaaaaaa..',
      '.aaaaaaaaaa.',
      '.aaaaaaaaaa.',
      '.aaaaaaaaaa.',
      '.aaaaaaaaaa.',
      '..aaaaaaaa..',
      '...aaaaaa...',
      '............',
      '............'
    ],
    tank: [
      '............',
      '.....aa.....',
      '.....aa.....',
      'aa.aaaaaa.aa',
      'aa.aaaaaa.aa',
      'aa.aaaaaa.aa',
      'aa.aaaaaa.aa',
      'aa.aaaaaa.aa',
      'aa.aaaaaa.aa',
      '............',
      '............',
      '............'
    ]
  };
  var ICON_ORDER = ['star', 'helmet', 'clock', 'shovel', 'grenade', 'tank'];
  var ICON_COLOUR = ['#e8c82c', '#58a8e8', '#f08020', '#c06020', '#303030', '#48b030'];

  /* =========================================================== */
  var S = TB.sprites = {};
  var cache = {};

  function paintTank(rows, pal, frame, axis) {
    var cv = TB.makeCanvas(16, 16), cx = cv.getContext('2d');
    for (var y = 0; y < 16; y++) {
      var line = rows[y];
      for (var x = 0; x < 16; x++) {
        var ch = line.charAt(x), col = null;
        if (ch === 'a') col = pal.a;
        else if (ch === 'b') col = pal.b;
        else if (ch === 'c') col = pal.c;
        else if (ch === 'o' || ch === 'L') col = pal.o;
        else if (ch === 'M') {
          col = (((axis === 'x' ? x : y) + frame) % 2 === 0) ? pal.o : pal.a;
        }
        if (!col) continue;
        cx.fillStyle = col;
        cx.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  }

  /* returns sprite[dir][frame] */
  S.tank = function (artName, palName) {
    var key = 'T:' + artName + ':' + palName;
    if (cache[key]) return cache[key];
    var art = ART[artName] || ART.basic;
    var pal = TB.TANK_PALETTES[palName] || TB.TANK_PALETTES.basic;
    var up = art;
    var right = TB.rotateArt(up);
    var down = TB.rotateArt(right);
    var left = TB.rotateArt(down);
    var dirs = [up, right, down, left];
    var axes = ['y', 'x', 'y', 'x'];
    var out = [];
    for (var d = 0; d < 4; d++) {
      out.push([paintTank(dirs[d], pal, 0, axes[d]), paintTank(dirs[d], pal, 1, axes[d])]);
    }
    cache[key] = out;
    return out;
  };

  S.PLAYER_ART = ['player0', 'player1', 'player2', 'player3'];

  /* ---------- terrain tiles (8x8) ----------------------------- */
  function tileBrick() {
    var cv = TB.makeCanvas(8, 8), cx = cv.getContext('2d');
    for (var y = 0; y < 8; y++) {
      var col = (y % 4 === 0) ? PAL.brickB : ((y % 4 === 3) ? '#5c2c14' : PAL.brickA);
      cx.fillStyle = col;
      cx.fillRect(0, y, 8, 1);
    }
    cx.fillStyle = '#5c2c14';
    cx.fillRect(7, 0, 1, 4);   // staggered mortar joints
    cx.fillRect(3, 4, 1, 4);
    return cv;
  }
  function tileSteel() {
    var cv = TB.makeCanvas(8, 8), cx = cv.getContext('2d');
    cx.fillStyle = '#a8a8a8'; cx.fillRect(0, 0, 8, 8);
    cx.fillStyle = '#ececec'; cx.fillRect(0, 0, 8, 1); cx.fillRect(0, 0, 1, 8);
    cx.fillStyle = '#787878'; cx.fillRect(0, 7, 8, 1); cx.fillRect(7, 0, 1, 8);
    cx.fillStyle = '#cccccc'; cx.fillRect(2, 2, 4, 4);
    cx.fillStyle = '#909090'; cx.fillRect(2, 5, 4, 1); cx.fillRect(5, 2, 1, 4);
    return cv;
  }
  function tileWater(frame) {
    var cv = TB.makeCanvas(8, 8), cx = cv.getContext('2d');
    cx.fillStyle = PAL.waterA; cx.fillRect(0, 0, 8, 8);
    cx.fillStyle = PAL.waterB;
    var o = frame * 3;
    for (var i = 0; i < 4; i++) {
      cx.fillRect((o + i * 2) % 8, 1, 1, 1);
      cx.fillRect((o + 4 + i * 2) % 8, 5, 1, 1);
    }
    cx.fillStyle = '#6c9cf8';
    cx.fillRect((o + 2) % 8, 2, 2, 1);
    cx.fillRect((o + 5) % 8, 6, 2, 1);
    return cv;
  }
  function tileTrees() {
    var cv = TB.makeCanvas(8, 8), cx = cv.getContext('2d');
    cx.fillStyle = PAL.treeA; cx.fillRect(0, 0, 8, 8);
    for (var y = 0; y < 8; y++) {
      for (var x = 0; x < 8; x++) {
        var h = TB.hash2(x, y, 7);
        if (h > 0.62) { cx.fillStyle = PAL.treeB; cx.fillRect(x, y, 1, 1); }
        else if (h < 0.12) { cx.fillStyle = '#0c3c0c'; cx.fillRect(x, y, 1, 1); }
      }
    }
    return cv;
  }
  function tileIce() {
    var cv = TB.makeCanvas(8, 8), cx = cv.getContext('2d');
    cx.fillStyle = PAL.iceA; cx.fillRect(0, 0, 8, 8);
    cx.fillStyle = PAL.iceB;
    cx.fillRect(0, 0, 8, 1); cx.fillRect(0, 0, 1, 8);
    cx.fillStyle = '#9cb4e0';
    cx.fillRect(0, 7, 8, 1); cx.fillRect(7, 0, 1, 8);
    cx.fillStyle = '#ffffff';
    cx.fillRect(2, 3, 3, 1); cx.fillRect(4, 5, 2, 1);
    return cv;
  }

  /* ---------- FX --------------------------------------------- */
  function blast(size, r, seed, cols, hollow) {
    var cv = TB.makeCanvas(size, size), cx = cv.getContext('2d');
    var c = size / 2;
    for (var y = 0; y < size; y++) {
      for (var x = 0; x < size; x++) {
        var dx = x - c + 0.5, dy = y - c + 0.5;
        var d = Math.sqrt(dx * dx + dy * dy);
        var rr = r + (TB.hash2(x, y, seed) - 0.5) * 2.6;
        if (d > rr) continue;
        var t = d / rr;
        if (hollow && t < hollow) continue;
        var col = t < 0.34 ? cols[0] : (t < 0.68 ? cols[1] : cols[2]);
        cx.fillStyle = col;
        cx.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  }

  function shieldFrame(frame) {
    var cv = TB.makeCanvas(16, 16), cx = cv.getContext('2d');
    var c = 8;
    for (var y = 0; y < 16; y++) {
      for (var x = 0; x < 16; x++) {
        var dx = x - c + 0.5, dy = y - c + 0.5;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 6.1 || d > 8.2) continue;
        var ang = Math.atan2(dy, dx);
        var seg = Math.floor((ang + Math.PI) / (Math.PI / 6));
        var on = ((seg + frame) % 2) === 0;
        cx.fillStyle = on ? '#ffffff' : '#5a8ad8';
        cx.fillRect(x, y, 1, 1);
      }
    }
    return cv;
  }

  function spawnFrame(frame) {
    var cv = TB.makeCanvas(16, 16), cx = cv.getContext('2d');
    var lens = [3, 6, 8, 6];
    var len = lens[frame % 4];
    var base = (frame % 2) ? Math.PI / 8 : 0;
    cx.fillStyle = (frame % 2) ? '#ffffff' : '#c8c8c8';
    for (var i = 0; i < 8; i++) {
      var a = base + i * Math.PI / 4;
      for (var t = 0; t <= len; t++) {
        var x = Math.round(7.5 + Math.cos(a) * t);
        var y = Math.round(7.5 + Math.sin(a) * t);
        cx.fillRect(x, y, 1, 1);
      }
    }
    cx.fillStyle = '#ffffff';
    cx.fillRect(7, 7, 2, 2);
    return cv;
  }

  /* ---------- build everything -------------------------------- */
  S.build = function () {
    S.brick = tileBrick();
    S.steel = tileSteel();
    S.water = [tileWater(0), tileWater(1), tileWater(2)];
    S.trees = tileTrees();
    S.ice = tileIce();

    S.eagle = TB.paintArt(EAGLE, { o: '#000000', a: '#dcdcdc', b: '#8c8c8c' });
    S.eagleDead = TB.paintArt(EAGLE_DEAD, { o: '#000000', a: '#8c8c8c', b: '#5c5c5c' });
    S.flag = TB.paintArt(FLAG, { o: '#000000', b: '#ffffff' });
    S.miniTank = TB.paintArt(MINI_TANK, { o: '#000000' });
    S.miniTankLight = TB.paintArt(MINI_TANK, { o: '#e0e0e0' });

    // power-up boxes
    S.powerups = ICON_ORDER.map(function (name, i) {
      var cv = TB.makeCanvas(16, 16), cx = cv.getContext('2d');
      cx.fillStyle = '#303030'; cx.fillRect(0, 0, 16, 16);
      cx.fillStyle = '#fcfcfc'; cx.fillRect(1, 1, 14, 14);
      cx.fillStyle = '#c0c0c0'; cx.fillRect(1, 12, 14, 3);
      var icon = TB.paintArt(ICONS[name], { a: ICON_COLOUR[i] });
      cx.drawImage(icon, 2, 2);
      return cv;
    });
    S.powerupNames = ICON_ORDER;

    // explosions: 3 small + 3 big
    var hot = ['#ffffff', '#f8d800', '#f85800'];
    var cool = ['#f8d800', '#f85800', '#a81800'];
    S.expSmall = [
      blast(16, 4, 1, hot),
      blast(16, 7, 2, hot),
      blast(16, 7.5, 3, cool, 0.45)
    ];
    S.expBig = [
      blast(32, 10, 4, hot),
      blast(32, 15, 5, hot),
      blast(32, 15.5, 6, cool, 0.35),
      blast(32, 15.5, 7, ['#a81800', '#601000', '#300800'], 0.55)
    ];
    S.shield = [shieldFrame(0), shieldFrame(1)];
    S.spawnFx = [spawnFrame(0), spawnFrame(1), spawnFrame(2), spawnFrame(3)];
  };

  S.art = ART;
})(window.TB);
