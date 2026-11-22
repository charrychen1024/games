/* ===========================================================
 * Stage data.
 *  - Built-in stages are authored on the 13x13 cell grid
 *    (1 char = one 16px cell), which is how the arcade laid
 *    them out.
 *  - Internally everything expands to the 26x26 "quad" grid so
 *    bricks can shatter in 8px pieces.
 *  - The editor saves 26-row data, giving half-cell precision.
 * =========================================================== */
(function (TB) {
  'use strict';

  var C = TB.C, T = TB.T;

  var STAGES = [
    ['.............', '..BB.BBB.BB..', '..BB.BBB.BB..', '..BB.....BB..', '..BB.BBB.BB..',
     '..BB.BBB.BB..', '.....BSB.....', '..BB.BBB.BB..', '..BB.BBB.BB..', '..BB.....BB..',
     '..BB.BBB.BB..', '..BB.....BB..', '.............'],

    ['.....BBB.....', '.BBB.BSB.BBB.', '.BBB.BBB.BBB.', '.BBB.....BBB.', '.BBB.BBB.BBB.',
     '.....BBB.....', 'BBBB.SSS.BBBB', '.....BBB.....', '.BBB.BBB.BBB.', '.BBB.....BBB.',
     '.BBB.BBB.BBB.', '.............', '.............'],

    ['.............', '.BBBBB.BBBBB.', '.B.........B.', '.B.WWW.WWW.B.', '.B.WWW.WWW.B.',
     '.B.........B.', '.BBBB.S.BBBB.', '.B.........B.', '.B.WWW.WWW.B.', '.B.WWW.WWW.B.',
     '.B.........B.', '.BBBB...BBBB.', '.............'],

    ['.............', '..TTT...TTT..', '..TTT...TTT..', '.BBBBB.BBBBB.', '.B...B.B...B.',
     '.B.S.B.B.S.B.', '.B...B.B...B.', '.BBB.....BBB.', '..TTT...TTT..', '..TTT...TTT..',
     '.BBBBBBBBBBB.', '.....B.B.....', '.............'],

    ['.............', '.IIIIIIIIIII.', '.I.BB...BB.I.', '.I.BB...BB.I.', '.I....S....I.',
     '.IBB.BBB.BBI.', '.IBB.BSB.BBI.', '.IBB.BBB.BBI.', '.I....S....I.', '.I.BB...BB.I.',
     '.I.BB...BB.I.', '.IIII...IIII.', '.............'],

    ['.............', '.BB.......BB.', '.BB.BB.BB.BB.', '.BB.BB.BB.BB.', '....BB.BB....',
     '.BBBB...BBBB.', '.B..WWWWW..B.', '.BBBB...BBBB.', '....BB.BB....', '.BB.BB.BB.BB.',
     '.BB.BB.BB.BB.', '.BB.......BB.', '.............'],

    ['.............', '.BBBBBBBBBBB.', '.B....B....B.', '.B.SS.B.SS.B.', '.B.SS...SS.B.',
     '.B.........B.', '.B.BBB.BBB.B.', '.B.........B.', '.B.TT...TT.B.', '.B.TT.B.TT.B.',
     '.B....B....B.', '.BBBB.B.BBBB.', '.............'],

    ['..BB.....BB..', '..BB.BBB.BB..', '..BB.BSB.BB..', '..BB.BBB.BB..', '.............',
     'BBBBB...BBBBB', '....W.S.W....', 'BBBBB...BBBBB', '.............', '..BB.BBB.BB..',
     '..BB.BSB.BB..', '..BB.B.B.BB..', '.............'],

    ['.............', '.SS.BBBBB.SS.', '.SS.B...B.SS.', '....B.S.B....', '.BB.B...B.BB.',
     '.BB.BBBBB.BB.', '.BB.......BB.', '.BB.BBBBB.BB.', '.BB.B...B.BB.', '....B.S.B....',
     '.SS.B...B.SS.', '.SS.BB.BB.SS.', '.............'],

    ['.............', '.BBBBB.BBBBB.', '.B.W.B.B.W.B.', '.B.W.B.B.W.B.', '.B.W.....W.B.',
     '.B.WWWWWWW.B.', '.B.........B.', '.BBBB.S.BBBB.', '.T.........T.', '.T.BBB.BBB.T.',
     '.T.B.....B.T.', '.T.B.....B.T.', '.............'],

    ['.............', '.BBB.BBB.BBB.', '.B.B.B.B.B.B.', '.BBB.BBB.BBB.', '.............',
     '.SSS.....SSS.', '...B.WWW.B...', '.SSS.....SSS.', '.............', '.BBB.BBB.BBB.',
     '.B.B.B.B.B.B.', '.BBB.B.B.BBB.', '.............'],

    ['..S.......S..', '.BBB.BBB.BBB.', '.BBB.BBB.BBB.', '.............', 'IIII.....IIII',
     '.BBB.BSB.BBB.', '.BBB.BSB.BBB.', '.BBB.BSB.BBB.', 'IIII.....IIII', '.............',
     '.BBB.BBB.BBB.', '.BBB.B.B.BBB.', '.............'],

    ['.............', '.WWWWW.WWWWW.', '.W...W.W...W.', '.W.B.W.W.B.W.', '.W.B.....B.W.',
     '.WWB.BBB.BWW.', '...B.BSB.B...', '.WWB.BBB.BWW.', '.W.B.....B.W.', '.W.B.W.W.B.W.',
     '.W...W.W...W.', '.WWW.W.W.WWW.', '.............'],

    ['.............', '.BB.BB.BB.BB.', '.BB.BB.BB.BB.', '.BB.BB.BB.BB.', '.............',
     'SS.SS.SS.SS.S', '.............', '.BB.BB.BB.BB.', '.BB.BB.BB.BB.', '.............',
     'TTT.TTT.TTT.T', '.BB.......BB.', '.............'],

    ['.............', '.SBBBBBBBBBS.', '.B.........B.', '.B.SBBBBBS.B.', '.B.B.....B.B.',
     '.B.B.WWW.B.B.', '.B.B.WSW.B.B.', '.B.B.WWW.B.B.', '.B.B.....B.B.', '.B.SBB.BBS.B.',
     '.B.........B.', '.SBBB...BBBS.', '.............'],

    ['..BB.....BB..', '..BB.BBB.BB..', '.....BBB.....', 'BBB.......BBB', '..B.SSSSS.B..',
     '..B.S...S.B..', '....S.B.S....', '..B.S...S.B..', '..B.SSSSS.B..', 'BBB.......BBB',
     '.....BBB.....', '..BB.B.B.BB..', '.............'],

    ['.............', 'TTTT.TTT.TTTT', '.BB.......BB.', '.BB.BBBBB.BB.', '....B...B....',
     '.WW.B.S.B.WW.', '.WW.B...B.WW.', '.WW.BBBBB.WW.', '.............', '.BB.BB.BB.BB.',
     '.BB.BB.BB.BB.', '.......B.....', '.............'],

    ['.B.B.B.B.B.B.', '.B.B.B.B.B.B.', '.B.B.B.B.B.B.', '.............', 'SSS.SSS.SSS.S',
     '.............', '.B.B.B.B.B.B.', '.B.B.B.B.B.B.', '.............', 'WWW.WWW.WWW.W',
     '.............', '.B.B.B.B.B.B.', '.............'],

    ['.............', '.BBBBBBBBBBB.', '.B.........B.', '.B.BBBBBBB.B.', '.B.B.....B.B.',
     '.B.B.BBB.B.B.', '...B.BSB.B...', '.B.B.BBB.B.B.', '.B.B.....B.B.', '.B.BBB.BBB.B.',
     '.B.........B.', '.BBBB...BBBB.', '.............'],

    ['.............', 'IIIIIIIIIIIII', 'IBBIIIIIIIBBI', 'IBBII.S.IIBBI', 'IIIII...IIIII',
     'I.IIBBBBBII.I', 'I.II.BSB.II.I', 'I.IIBBBBBII.I', 'IIIII...IIIII', 'IBBII.S.IIBBI',
     'IBBIIIIIIIBBI', 'IIIII...IIIII', '.............'],

    ['.............', '.BBB.SSS.BBB.', '.B.B.S.S.B.B.', '.BBB.SSS.BBB.', '.............',
     '.SSS.BBB.SSS.', '.S.S.B.B.S.S.', '.SSS.BBB.SSS.', '.............', '.BBB.TTT.BBB.',
     '.B.B.T.T.B.B.', '.BBB.T.T.BBB.', '.............'],

    ['..S.......S..', '.BBBB.W.BBBB.', '.B..B.W.B..B.', '.B..BBWBB..B.', '.B.....W...B.',
     '.BBBB.W.BBBB.', '......W......', '.BBBB.W.BBBB.', '.B.....W...B.', '.B..BBWBB..B.',
     '.B..B.W.B..B.', '.BBBB...BBBB.', '.............'],

    ['.............', '.BB.BBBBB.BB.', '.BB.B...B.BB.', '....B.S.B....', '.SS.B...B.SS.',
     '.SS.BB.BB.SS.', '......B......', '.SS.BB.BB.SS.', '.SS.B...B.SS.', '....B.S.B....',
     '.BB.B...B.BB.', '.BB.BB.BB.BB.', '.............'],

    ['TTT.......TTT', '.BBBBBBBBBBB.', '.B.S.....S.B.', '.B.SBBBBBS.B.', '.B..B...B..B.',
     '.B..B.W.B..B.', '.....BWB.....', '.B..B.W.B..B.', '.B..B...B..B.', '.B.SBBBBBS.B.',
     '.B.S.....S.B.', '.BBBB...BBBB.', '.............'],

    ['.............', '.SBSBSBSBSBS.', '.............', '.BSBSBSBSBSB.', '.............',
     'WWW.WWW.WWW.W', '.............', '.BSBSBSBSBSB.', '.............', '.SBSBSBSBSBS.',
     '.............', '.BB.BS.SB.BB.', '.............'],

    ['.............', '.BBBB.S.BBBB.', '.B..B.S.B..B.', '.B..BBSBB..B.', '.B.........B.',
     '.BBB.TTT.BBB.', '.....TST.....', '.BBB.TTT.BBB.', '.B.........B.', '.B..BBSBB..B.',
     '.B..B.S.B..B.', '.BBBB...BBBB.', '.............'],

    ['..BB.....BB..', '..BB.III.BB..', '.....III.....', 'IIIII.B.IIIII', '..B.......B..',
     '..B.BBBBB.B..', '....B.S.B....', '..B.BBBBB.B..', '..B.......B..', 'IIIII.B.IIIII',
     '.....III.....', '..BB.III.BB..', '.............'],

    ['.............', '.WBWBWBWBWBW.', '.B.........B.', '.W.BBBBBBB.W.', '.B.B.....B.B.',
     '.W.B.SSS.B.W.', '...B.S.S.B...', '.W.B.SSS.B.W.', '.B.B.....B.B.', '.W.BBB.BBB.W.',
     '.B.........B.', '.WBWB...BWBW.', '.............'],

    ['.............', '.SSSSS.SSSSS.', '.S...S.S...S.', '.S.B.S.S.B.S.', '.S.B.....B.S.',
     '.SSB.BBB.BSS.', '...B.BBB.B...', '.SSB.BBB.BSS.', '.S.B.....B.S.', '.S.B.W.W.B.S.',
     '.S...W.W...S.', '.SSS.....SSS.', '.............'],

    ['.B.......B...', '.BBB.B.BBB...', '...B.B.B.....', 'BB.B.B.B.BBBB', '...B.B.B.....',
     '.B.B.B.B.B.B.', '.B...B...B.B.', '.BBB.B.BBB.B.', '.....B.......', 'BBBB.B.BBBB.B',
     '.....B.......', '.BBB.B.BBB.B.', '.............'],

    ['.............', '.BBBBBBBBBBB.', '.BSSSSSSSSSB.', '.BS.......SB.', '.BS.WWWWW.SB.',
     '.BS.W...W.SB.', '....W.S.W....', '.BS.W...W.SB.', '.BS.WWWWW.SB.', '.BS.......SB.',
     '.BSSS...SSSB.', '.BBBB...BBBB.', '.............'],

    ['..S.......S..', '.............', '.TTT.BBB.TTT.', '.TTT.BSB.TTT.', '.TTT.BBB.TTT.',
     '.............', 'IIII.....IIII', '.............', '.TTT.BBB.TTT.', '.TTT.BSB.TTT.',
     '.TTT.BBB.TTT.', '.BB.......BB.', '.............'],

    ['.............', '.BBB.BBB.BBB.', '.BSB.BSB.BSB.', '.BBB.BBB.BBB.', '.............',
     '.BBB.BBB.BBB.', '.BSB.BSB.BSB.', '.BBB.BBB.BBB.', '.............', '.BBB.BBB.BBB.',
     '.BSB.BSB.BSB.', '.BBB.B.B.BBB.', '.............'],

    ['.............', 'WWWWW.W.WWWWW', '.....B.B.....', '.BBB.B.B.BBB.', '.B.B.B.B.B.B.',
     '.B.BBB.BBB.B.', '.B.........B.', '.B.BBB.BBB.B.', '.B.B.B.B.B.B.', '.BBB.B.B.BBB.',
     '.....B.B.....', 'TTTT.B.B.TTTT', '.............'],

    ['.S.........S.', '.SBBBBBBBBBS.', '.SB.......BS.', '.SB.SSSSS.BS.', '.SB.S...S.BS.',
     '.SB.S.W.S.BS.', '....S.W.S....', '.SB.S.W.S.BS.', '.SB.S...S.BS.', '.SB.SSSSS.BS.',
     '.SB.......BS.', '.SBBB...BBBS.', '.............']
  ];

  /* enemy mix per stage: [basic, fast, power, armor] — always 20 tanks */
  var COMPOSITION = [
    [18, 2, 0, 0], [14, 4, 2, 0], [14, 4, 2, 0], [2, 5, 10, 3], [8, 5, 5, 2],
    [7, 2, 8, 3], [7, 4, 3, 6], [6, 4, 7, 3], [12, 2, 4, 2], [5, 6, 4, 5],
    [0, 10, 6, 4], [8, 8, 2, 2], [8, 8, 2, 2], [4, 4, 4, 8], [2, 8, 2, 8],
    [7, 4, 4, 5], [6, 4, 7, 3], [10, 4, 4, 2], [4, 8, 4, 4], [2, 12, 2, 4],
    [6, 2, 8, 4], [4, 6, 4, 6], [8, 2, 6, 4], [0, 8, 6, 6], [4, 4, 4, 8],
    [6, 6, 4, 4], [2, 10, 4, 4], [4, 4, 8, 4], [2, 6, 6, 6], [0, 10, 4, 6],
    [4, 2, 8, 6], [2, 8, 4, 6], [0, 6, 8, 6], [2, 4, 6, 8], [0, 4, 6, 10]
  ];

  // ---- grid plumbing ---------------------------------------------
  var ENEMY_SPAWN_CELLS = [[0, 0], [6, 0], [12, 0]];
  var PLAYER_SPAWN_CELLS = [[4, 12], [8, 12]];
  var BASE_CELL = [6, 12];

  // quads occupied by the eagle, and by its classic 8px brick collar
  var BASE_QUADS = [[12, 24], [13, 24], [12, 25], [13, 25]];
  var BASE_WALL_QUADS = [[11, 23], [12, 23], [13, 23], [14, 23],
                         [11, 24], [11, 25], [14, 24], [14, 25]];

  function emptyGrid() { return new Uint8Array(C.COLS * C.ROWS); }

  function setQuad(grid, x, y, v) {
    if (x < 0 || y < 0 || x >= C.COLS || y >= C.ROWS) return;
    grid[y * C.COLS + x] = v;
  }
  function getQuad(grid, x, y) {
    if (x < 0 || y < 0 || x >= C.COLS || y >= C.ROWS) return T.EMPTY;
    return grid[y * C.COLS + x];
  }

  function clearCell(grid, cx, cy) {
    for (var dy = 0; dy < 2; dy++) {
      for (var dx = 0; dx < 2; dx++) setQuad(grid, cx * 2 + dx, cy * 2 + dy, T.EMPTY);
    }
  }

  function stampBase(grid, wallType) {
    var i;
    for (i = 0; i < BASE_QUADS.length; i++) setQuad(grid, BASE_QUADS[i][0], BASE_QUADS[i][1], T.EMPTY);
    for (i = 0; i < BASE_WALL_QUADS.length; i++) {
      setQuad(grid, BASE_WALL_QUADS[i][0], BASE_WALL_QUADS[i][1], wallType);
    }
  }

  /* Accepts 13-row (cell) or 26-row (quad) string data. */
  function parse(rows, opts) {
    opts = opts || {};
    var grid = emptyGrid();
    var map = TB.TERRAIN_CHARS;
    var i, x, y, ch, v;

    if (rows.length >= 26) {
      for (y = 0; y < C.ROWS; y++) {
        var line = rows[y] || '';
        for (x = 0; x < C.COLS; x++) {
          ch = line.charAt(x) || '.';
          v = map[ch];
          grid[y * C.COLS + x] = (v == null) ? T.EMPTY : v;
        }
      }
    } else {
      for (var cy = 0; cy < 13; cy++) {
        var cline = rows[cy] || '';
        for (var cx = 0; cx < 13; cx++) {
          ch = cline.charAt(cx) || '.';
          v = map[ch];
          if (v == null) v = T.EMPTY;
          for (var dy = 0; dy < 2; dy++) {
            for (var dx = 0; dx < 2; dx++) grid[(cy * 2 + dy) * C.COLS + (cx * 2 + dx)] = v;
          }
        }
      }
    }

    // spawn pads are always clear, exactly like the arcade
    for (i = 0; i < ENEMY_SPAWN_CELLS.length; i++) clearCell(grid, ENEMY_SPAWN_CELLS[i][0], ENEMY_SPAWN_CELLS[i][1]);
    for (i = 0; i < PLAYER_SPAWN_CELLS.length; i++) clearCell(grid, PLAYER_SPAWN_CELLS[i][0], PLAYER_SPAWN_CELLS[i][1]);

    if (opts.autoBase !== false) stampBase(grid, T.BRICK);
    else {
      for (i = 0; i < BASE_QUADS.length; i++) setQuad(grid, BASE_QUADS[i][0], BASE_QUADS[i][1], T.EMPTY);
    }
    return grid;
  }

  function gridToRows(grid) {
    var out = [], chars = TB.CHAR_FOR_TERRAIN;
    for (var y = 0; y < C.ROWS; y++) {
      var s = '';
      for (var x = 0; x < C.COLS; x++) s += chars[grid[y * C.COLS + x]] || '.';
      out.push(s);
    }
    return out;
  }

  /* Spread the enemy mix evenly across the 20-tank queue so the
   * difficulty ramps instead of arriving in blocks. */
  function buildQueue(comp) {
    var items = [];
    for (var t = 0; t < comp.length; t++) {
      var n = comp[t];
      for (var i = 0; i < n; i++) {
        items.push({ type: t, key: (i + 0.5) / Math.max(1, n), tie: t });
      }
    }
    items.sort(function (a, b) { return a.key - b.key || a.tie - b.tie; });
    var q = items.map(function (o) { return o.type; });
    while (q.length < C.ENEMIES_PER_STAGE) q.push(0);
    return q.slice(0, C.ENEMIES_PER_STAGE);
  }

  /* ---- procedurally generated stage, used by SURVIVAL mode ---- */
  function randomStage(n) {
    var rows = [], y, x;
    var density = Math.min(0.42, 0.18 + n * 0.012);
    var hasWater = n >= 3, hasTrees = n >= 2, hasIce = n >= 5;
    var steelChance = Math.min(0.3, 0.04 + n * 0.012);
    for (y = 0; y < 13; y++) {
      var line = '';
      for (x = 0; x < 7; x++) {
        var ch = '.';
        var r = Math.random();
        if (r < density) {
          ch = (Math.random() < steelChance) ? 'S' : 'B';
        } else if (hasWater && r < density + 0.06) ch = 'W';
        else if (hasTrees && r < density + 0.11) ch = 'T';
        else if (hasIce && r < density + 0.15) ch = 'I';
        line += ch;
      }
      // mirror for that hand-made symmetric look
      var full = line + line.slice(0, 6).split('').reverse().join('');
      rows.push(full);
    }
    var comp = [0, 0, 0, 0], left = C.ENEMIES_PER_STAGE;
    var weights = [Math.max(0, 10 - n), 4 + n * 0.4, 2 + n * 0.5, 1 + n * 0.6];
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    for (var t = 0; t < 4; t++) {
      var k = Math.round(C.ENEMIES_PER_STAGE * weights[t] / total);
      k = Math.min(k, left); comp[t] = k; left -= k;
    }
    comp[3] += left;
    return { rows: rows, comp: comp };
  }

  /* ---- shared playability check -----------------------------
   * Bricks count as passable because a tank can always shoot
   * through them; steel and water are hard walls. Used by the
   * editor for live feedback and by tools/validate-levels.js. */
  function solidFor(grid, qx, qy, soft) {
    if (qx < 0 || qy < 0 || qx >= C.COLS || qy >= C.ROWS) return true;
    var v = grid[qy * C.COLS + qx];
    if (soft && v === T.BRICK) return false;
    return TB.BLOCKS_TANK[v];
  }
  function nodeFree(grid, i, j, soft) {
    if (i < 0 || j < 0 || i > C.COLS - 2 || j > C.ROWS - 2) return false;
    return !solidFor(grid, i, j, soft) && !solidFor(grid, i + 1, j, soft) &&
           !solidFor(grid, i, j + 1, soft) && !solidFor(grid, i + 1, j + 1, soft);
  }
  function flood(grid, si, sj, soft) {
    var N = C.COLS, seen = new Uint8Array(N * N);
    if (!nodeFree(grid, si, sj, soft)) return seen;
    var stack = [si * N + sj];
    seen[si * N + sj] = 1;
    while (stack.length) {
      var cur = stack.pop(), i = (cur / N) | 0, j = cur % N;
      var nb = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]];
      for (var n = 0; n < 4; n++) {
        var ni = nb[n][0], nj = nb[n][1];
        if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
        var k = ni * N + nj;
        if (seen[k] || !nodeFree(grid, ni, nj, soft)) continue;
        seen[k] = 1; stack.push(k);
      }
    }
    return seen;
  }
  function touchesBase(seen) {
    var N = C.COLS, zone = BASE_WALL_QUADS.concat(BASE_QUADS);
    for (var z = 0; z < zone.length; z++) {
      for (var i = zone[z][0] - 2; i <= zone[z][0] + 1; i++) {
        for (var j = zone[z][1] - 2; j <= zone[z][1] + 1; j++) {
          if (i < 0 || j < 0 || i >= N || j >= N) continue;
          if (seen[i * N + j]) return true;
        }
      }
    }
    return false;
  }

  function validate(grid) {
    var i, c;
    for (i = 0; i < PLAYER_SPAWN_CELLS.length; i++) {
      c = PLAYER_SPAWN_CELLS[i];
      if (!nodeFree(grid, c[0] * 2, c[1] * 2, false)) {
        return { ok: false, reason: 'PLAYER SPAWN BLOCKED' };
      }
    }
    for (i = 0; i < ENEMY_SPAWN_CELLS.length; i++) {
      c = ENEMY_SPAWN_CELLS[i];
      if (!nodeFree(grid, c[0] * 2, c[1] * 2, false)) {
        return { ok: false, reason: 'ENEMY SPAWN BLOCKED' };
      }
      var seen = flood(grid, c[0] * 2, c[1] * 2, true);
      if (!touchesBase(seen)) return { ok: false, reason: 'ENEMY CANNOT REACH BASE' };
      for (var k = 0; k < PLAYER_SPAWN_CELLS.length; k++) {
        var pc = PLAYER_SPAWN_CELLS[k];
        if (!seen[(pc[0] * 2) * C.COLS + (pc[1] * 2)]) {
          return { ok: false, reason: 'PLAYER ' + (k + 1) + ' CUT OFF' };
        }
      }
    }
    return { ok: true, reason: 'PLAYABLE' };
  }

  TB.levels = {
    STAGES: STAGES,
    COMPOSITION: COMPOSITION,
    count: STAGES.length,
    ENEMY_SPAWN_CELLS: ENEMY_SPAWN_CELLS,
    PLAYER_SPAWN_CELLS: PLAYER_SPAWN_CELLS,
    BASE_CELL: BASE_CELL,
    BASE_QUADS: BASE_QUADS,
    BASE_WALL_QUADS: BASE_WALL_QUADS,
    emptyGrid: emptyGrid,
    parse: parse,
    gridToRows: gridToRows,
    stampBase: stampBase,
    buildQueue: buildQueue,
    randomStage: randomStage,
    getQuad: getQuad,
    setQuad: setQuad,
    validate: validate,
    nodeFree: nodeFree,

    /* stage n (1-based) of the built-in campaign, wrapping like the arcade */
    builtin: function (n) {
      var idx = ((n - 1) % STAGES.length + STAGES.length) % STAGES.length;
      return { rows: STAGES[idx], comp: COMPOSITION[idx], index: idx };
    }
  };
})(window.TB);
