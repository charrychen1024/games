/* ===========================================================
 * Screens and the game state machine.
 * =========================================================== */
(function (TB) {
  'use strict';

  var C = TB.C, S = TB.sprites, L = TB.levels, F = TB.font;

  var MENU_ITEMS = [
    { key: '1p',     label: '1 PLAYER' },
    { key: '2p',     label: '2 PLAYERS' },
    { key: 'custom', label: 'CUSTOM STAGES' },
    { key: 'surv',   label: 'SURVIVAL' },
    { key: 'build',  label: 'CONSTRUCTION' },
    { key: 'opts',   label: 'SETTINGS' }
  ];

  var G = TB.game = {
    state: 'title',
    tick: 0,
    menuIndex: 0,
    optIndex: 0,
    settings: null,
    session: null,
    battle: null,
    editor: null,
    paused: false,
    hiScore: 20000,
    customList: [],
    customIndex: 0,
    hotspots: []
  };

  function newPlayerState(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      out.push({
        lives: C.PLAYER_START_LIVES,
        level: 0,
        score: 0,
        out: false,
        respawn: 0,
        kills: [0, 0, 0, 0],
        totalKills: [0, 0, 0, 0],
        stageStartScore: 0
      });
    }
    return out;
  }

  G.init = function () {
    G.settings = TB.store.settings();
    G.hiScore = TB.store.hiScore();
    TB.audio.setEnabled(G.settings.sound);
    G.state = 'title';
    G.titleT = 0;
  };

  /* ---------------- session plumbing -------------------------- */
  G.startGame = function (mode, numPlayers) {
    G.session = {
      mode: mode,
      numPlayers: numPlayers,
      stageNum: mode === 'campaign' ? (G.settings.startStage || 1) : 1,
      playerState: newPlayerState(numPlayers),
      customList: mode === 'custom' ? G.customList.slice() : null,
      customIndex: 0,
      stagesCleared: 0
    };
    G.enterStage();
  };

  function stageDataFor(sess) {
    if (sess.mode === 'custom') {
      var list = sess.customList;
      var st = list[sess.customIndex % list.length];
      return { rows: st.rows, comp: st.comp || [18, 2, 0, 0],
               autoBase: false, label: st.name };
    }
    if (sess.mode === 'survival') {
      var r = L.randomStage(sess.stageNum);
      return { rows: r.rows, comp: r.comp, autoBase: true, label: '' + sess.stageNum };
    }
    var b = L.builtin(sess.stageNum);
    return { rows: b.rows, comp: b.comp, autoBase: true, label: '' + sess.stageNum };
  }

  G.enterStage = function () {
    var sess = G.session;
    var data = stageDataFor(sess);
    var i;
    for (i = 0; i < sess.playerState.length; i++) {
      var st = sess.playerState[i];
      st.kills = [0, 0, 0, 0];
      st.stageStartScore = st.score;
      st.respawn = 0;
    }
    G.battle = new TB.Battle({
      mode: sess.mode,
      stageNum: sess.stageNum,
      stageLabel: data.label,
      numPlayers: sess.numPlayers,
      playerState: sess.playerState,
      rows: data.rows,
      comp: data.comp,
      autoBase: data.autoBase
    });
    G.state = 'stageIntro';
    G.introT = 0;
    TB.audio.stageStart();
  };

  G.nextStage = function () {
    var sess = G.session;
    sess.stagesCleared++;
    if (sess.mode === 'custom') {
      sess.customIndex++;
      if (sess.customIndex >= sess.customList.length) {
        G.state = 'allClear';
        G.allClearT = 0;
        return;
      }
      sess.stageNum++;
    } else {
      sess.stageNum++;
    }
    // a fresh reserve tank every few stages keeps long runs alive
    if (sess.mode === 'survival' && sess.stagesCleared % 4 === 0) {
      for (var i = 0; i < sess.playerState.length; i++) {
        if (!sess.playerState[i].out) sess.playerState[i].lives++;
      }
      TB.audio.extraLife();
    }
    G.enterStage();
  };

  G.commitHiScore = function () {
    var best = G.hiScore;
    if (G.session) {
      for (var i = 0; i < G.session.playerState.length; i++) {
        best = Math.max(best, G.session.playerState[i].score);
      }
    }
    if (best > G.hiScore) { G.hiScore = best; TB.store.setHiScore(best); }
  };

  /* ---------------- score screen ------------------------------ */
  G.enterScore = function (after) {
    var sess = G.session;
    G.score = {
      after: after,
      t: 0,
      row: 0,
      sub: 0,
      shown: [[0, 0, 0, 0], [0, 0, 0, 0]],
      shownScore: sess.playerState.map(function (s) { return s.stageStartScore; }),
      hold: 0,
      done: false
    };
    for (var i = 0; i < sess.playerState.length; i++) {
      var st = sess.playerState[i];
      for (var t = 0; t < 4; t++) st.totalKills[t] += st.kills[t];
    }
    G.commitHiScore();
    G.state = 'score';
  };

  G.updateScore = function () {
    var sc = G.score, sess = G.session;
    sc.t++;
    if (sc.done) {
      sc.hold++;
      var skip = TB.input.menu.confirm() || TB.input.mouse.clicked;
      if (sc.hold > 150 || skip) {
        if (sc.after === 'clear') G.nextStage();
        else { G.state = 'title'; G.titleT = 200; G.session = null; }
      }
      return;
    }
    if (sc.t % 5 !== 0) return;

    var row = sc.row, any = false;
    for (var p = 0; p < sess.playerState.length; p++) {
      if (sc.shown[p][row] < sess.playerState[p].kills[row]) {
        sc.shown[p][row]++;
        sc.shownScore[p] += TB.ENEMY_DEF[row].score;
        any = true;
      }
    }
    if (any) { TB.audio.scoreTick(); return; }
    sc.row++;
    if (sc.row > 3) { sc.done = true; sc.hold = 0; }
  };

  G.drawScore = function (cx) {
    var sess = G.session, sc = G.score;
    var two = sess.numPlayers > 1;
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);

    F.drawCentered(cx, 'HI-SCORE', 128, 14, '#d82800', 1);
    F.drawCentered(cx, '' + G.hiScore, 128, 24, '#e8c82c', 1);
    var label = sess.mode === 'custom' ? ('STAGE ' + G.battle.stageLabel) : ('STAGE ' + sess.stageNum);
    F.drawCentered(cx, label, 128, 38, '#ffffff', 1);

    var colX = two ? [68, 188] : [128];
    var p, t;
    for (p = 0; p < sess.playerState.length; p++) {
      F.drawCentered(cx, p === 0 ? 'I-PLAYER' : 'II-PLAYER', colX[p], 54, '#d82800', 1);
      F.drawCentered(cx, '' + sc.shownScore[p], colX[p], 66, '#e8c82c', 1);
    }

    for (t = 0; t < 4; t++) {
      var y = 86 + t * 22;
      var def = TB.ENEMY_DEF[t];
      if (two) {
        F.drawRight(cx, '' + sc.shown[0][t], 56, y, '#ffffff', 1);
        F.draw(cx, '<', 62, y, '#ffffff', 1);
        F.draw(cx, '>', 188, y, '#ffffff', 1);
        F.draw(cx, '' + sc.shown[1][t], 196, y, '#ffffff', 1);
        cx.drawImage(S.miniTankLight, 74, y);
        cx.drawImage(S.miniTankLight, 174, y);
        F.drawCentered(cx, def.score + ' PTS', 128, y, '#ffffff', 1);
      } else {
        F.drawRight(cx, def.score + ' PTS', 128, y, '#ffffff', 1);
        F.drawRight(cx, '' + sc.shown[0][t], 158, y, '#ffffff', 1);
        F.draw(cx, '<', 164, y, '#ffffff', 1);
        cx.drawImage(S.miniTankLight, 176, y);
      }
    }

    if (sc.done) {
      var ty = 178;
      cx.fillStyle = '#ffffff';
      cx.fillRect(40, ty - 6, 176, 1);
      F.draw(cx, 'TOTAL', 48, ty, '#ffffff', 1);
      for (p = 0; p < sess.playerState.length; p++) {
        var sum = 0;
        for (t = 0; t < 4; t++) sum += sc.shown[p][t];
        F.draw(cx, '' + sum, two ? (p ? 196 : 110) : 150, ty, '#e8c82c', 1);
      }
      if ((sc.hold >> 4) & 1) {
        F.drawCentered(cx, sc.after === 'clear' ? 'PRESS FIRE' : 'GAME OVER', 128, 198, '#d82800', 1);
      }
    }
  };

  /* ---------------- title ------------------------------------- */
  /* Letterforms cut out of the real brick tile, the way the
   * arcade logo is built. Cached — the title never changes. */
  var titleCache = {};
  function brickGlyphs(text, scale) {
    var key = text + ':' + scale;
    if (titleCache[key]) return titleCache[key];
    var w = F.width(text, scale), h = F.height(scale);
    // the letterforms, as their own alpha mask
    var mask = TB.makeCanvas(w, h);
    F.draw(mask.getContext('2d'), text, 0, 0, '#ffffff', scale);

    var cv = TB.makeCanvas(w, h);
    var mc = cv.getContext('2d');
    // lay the brick tiling down...
    for (var y = 0; y < h; y += 8) {
      for (var x = 0; x < w; x += 8) mc.drawImage(S.brick, x, y);
    }
    // ...then keep it only inside the letters. One composite op:
    // canvas applies the mode per drawing call, so the mask has to
    // arrive as a single drawImage.
    mc.globalCompositeOperation = 'destination-in';
    mc.drawImage(mask, 0, 0);
    mc.globalCompositeOperation = 'source-over';
    titleCache[key] = cv;
    return cv;
  }

  function brickText(cx, text, y, scale) {
    var img = brickGlyphs(text, scale);
    var x = Math.round((C.SCREEN_W - img.width) / 2);
    // a hard dark rim so the letters read against black
    F.draw(cx, text, x - 1, y, '#1c0804', scale);
    F.draw(cx, text, x + 1, y, '#1c0804', scale);
    F.draw(cx, text, x, y - 1, '#1c0804', scale);
    F.draw(cx, text, x + 2, y + 2, '#1c0804', scale);
    cx.drawImage(img, x, y);
  }

  G.drawTitle = function (cx) {
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);

    var slide = Math.max(0, 40 - G.titleT) * 2;

    cx.save();
    cx.translate(0, slide);

    F.draw(cx, 'I-  ' + TB.pad(0, 5, '0'), 14, 12, '#ffffff', 1);
    F.drawRight(cx, 'HI- ' + TB.pad(G.hiScore, 6, '0'), 242, 12, '#ffffff', 1);

    brickText(cx, 'BATTLE', 26, 4);
    brickText(cx, 'CITY', 58, 4);
    F.drawCentered(cx, '- 1990 CLASSIC -', 128, 94, '#909090', 1);

    var baseY = 110;
    G.hotspots = [];
    for (var i = 0; i < MENU_ITEMS.length; i++) {
      var y = baseY + i * 13;
      var sel = (i === G.menuIndex);
      F.draw(cx, MENU_ITEMS[i].label, 86, y, sel ? '#ffffff' : '#909090', 1);
      G.hotspots.push({ x: 58, y: y - 3 + slide, w: 146, h: 12, index: i });
      if (sel) {
        var set = S.tank('player0', 'p1');
        cx.drawImage(set[1][(G.tick >> 3) & 1], 62, y - 4);
      }
    }

    F.drawCentered(cx, 'HOMAGE TO NAMCO BATTLE CITY 1985', 128, 197, '#5c5c5c', 1);
    F.drawCentered(cx, 'ARROWS / MOUSE TO CHOOSE', 128, 209, '#4c4c4c', 1);
    cx.restore();
  };

  G.updateTitle = function () {
    G.titleT++;
    var I = TB.input;
    var moved = false;
    if (I.menu.up()) { G.menuIndex = (G.menuIndex + MENU_ITEMS.length - 1) % MENU_ITEMS.length; moved = true; }
    if (I.menu.down()) { G.menuIndex = (G.menuIndex + 1) % MENU_ITEMS.length; moved = true; }
    if (moved) TB.audio.menuMove();

    var m = I.mouse;
    if (m.inside) {
      for (var i = 0; i < G.hotspots.length; i++) {
        var h = G.hotspots[i];
        if (m.x >= h.x && m.x < h.x + h.w && m.y >= h.y && m.y < h.y + h.h) {
          if (G.menuIndex !== h.index) { G.menuIndex = h.index; TB.audio.menuMove(); }
          if (m.clicked) G.pickMenu();
          break;
        }
      }
    }
    if (I.menu.confirm()) G.pickMenu();
  };

  G.pickMenu = function () {
    TB.audio.menuPick();
    var key = MENU_ITEMS[G.menuIndex].key;
    if (key === '1p') G.startGame('campaign', 1);
    else if (key === '2p') G.startGame('campaign', 2);
    else if (key === 'surv') G.startGame('survival', 1);
    else if (key === 'custom') {
      G.customList = TB.store.customStages();
      G.customIndex = 0;
      G.state = 'customSelect';
    } else if (key === 'build') {
      G.openEditor();
    } else if (key === 'opts') {
      G.optIndex = 0;
      G.state = 'settings';
    }
  };

  /* ---------------- editor ------------------------------------ */
  G.openEditor = function () {
    G.editor = new TB.Editor({
      onExit: function () {
        TB.store.saveSettings(G.settings);
        G.state = 'title';
        G.titleT = 200;
        G.editor = null;
        if (TB.host) TB.host.setEditorMode(false);
      },
      onPlay: function (stage) {
        G.session = {
          mode: 'custom',
          numPlayers: 1,
          stageNum: 1,
          playerState: newPlayerState(1),
          customList: [stage],
          customIndex: 0,
          stagesCleared: 0,
          fromEditor: true
        };
        G.enterStage();
      }
    });
    G.state = 'editor';
    if (TB.host) TB.host.setEditorMode(true);
  };

  /* ---------------- custom stage picker ----------------------- */
  G.updateCustomSelect = function () {
    var I = TB.input;
    var n = G.customList.length;
    if (I.menu.back()) { G.state = 'title'; G.titleT = 200; return; }
    if (!n) {
      if (I.menu.confirm()) { G.openEditor(); }
      return;
    }
    var total = n + 1;   // entry 0 = play all
    if (I.menu.up()) { G.customIndex = (G.customIndex + total - 1) % total; TB.audio.menuMove(); }
    if (I.menu.down()) { G.customIndex = (G.customIndex + 1) % total; TB.audio.menuMove(); }

    var m = I.mouse;
    if (m.inside) {
      var row = Math.floor((m.y - 44) / 12);
      if (row >= 0 && row < total) {
        if (G.customIndex !== row) { G.customIndex = row; TB.audio.menuMove(); }
        if (m.clicked) { G.launchCustom(); return; }
      }
    }
    if (I.menu.confirm()) G.launchCustom();
  };

  G.launchCustom = function () {
    var list = G.customList;
    if (!list.length) return;
    TB.audio.menuPick();
    var chosen = (G.customIndex === 0) ? list.slice() : [list[G.customIndex - 1]];
    G.session = {
      mode: 'custom',
      numPlayers: 1,
      stageNum: 1,
      playerState: newPlayerState(1),
      customList: chosen,
      customIndex: 0,
      stagesCleared: 0
    };
    G.enterStage();
  };

  G.drawCustomSelect = function (cx) {
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    F.drawCentered(cx, 'CUSTOM STAGES', 128, 20, '#e8c82c', 1);
    if (!G.customList.length) {
      F.drawCentered(cx, 'NOTHING BUILT YET', 128, 90, '#ffffff', 1);
      F.drawCentered(cx, 'PRESS FIRE TO OPEN CONSTRUCTION', 128, 106, '#909090', 1);
      F.drawCentered(cx, 'ESC TO GO BACK', 128, 122, '#606060', 1);
      return;
    }
    var rows = [{ name: 'PLAY ALL (' + G.customList.length + ')' }].concat(G.customList);
    var top = Math.max(0, Math.min(G.customIndex - 6, rows.length - 13));
    for (var i = 0; i < 13; i++) {
      var k = top + i;
      if (k >= rows.length) break;
      var sel = (k === G.customIndex);
      var y = 44 + i * 12;
      if (sel) { cx.fillStyle = '#282828'; cx.fillRect(24, y - 2, 208, 11); }
      F.draw(cx, (k === 0 ? '  ' : TB.pad(k, 2, '0')) + ' ' + rows[k].name, 30, y,
             sel ? '#ffe040' : '#b0b0b0', 1);
      if (sel) {
        var set = S.tank('player0', 'p1');
        cx.drawImage(set[1][(G.tick >> 3) & 1], 10, y - 4);
      }
    }
    F.drawCentered(cx, 'ENTER PLAY    ESC BACK', 128, 208, '#707070', 1);
  };

  /* ---------------- settings ---------------------------------- */
  var OPTS = ['sound', 'scanlines', 'startStage', 'controls', 'back'];

  G.updateSettings = function () {
    var I = TB.input, s = G.settings;
    if (I.menu.back()) { TB.store.saveSettings(s); G.state = 'title'; G.titleT = 200; return; }
    if (I.menu.up()) { G.optIndex = (G.optIndex + OPTS.length - 1) % OPTS.length; TB.audio.menuMove(); }
    if (I.menu.down()) { G.optIndex = (G.optIndex + 1) % OPTS.length; TB.audio.menuMove(); }
    var key = OPTS[G.optIndex];
    var dx = (I.menu.right() ? 1 : 0) - (I.menu.left() ? 1 : 0);
    if (dx) {
      if (key === 'sound') { s.sound = !s.sound; TB.audio.setEnabled(s.sound); }
      else if (key === 'scanlines') { s.scanlines = !s.scanlines; }
      else if (key === 'startStage') {
        s.startStage = ((s.startStage - 1 + dx + L.count) % L.count) + 1;
      }
      TB.audio.menuMove();
      TB.store.saveSettings(s);
    }
    if (I.menu.confirm()) {
      if (key === 'back') { TB.store.saveSettings(s); G.state = 'title'; G.titleT = 200; }
      else if (key === 'controls') { G.state = 'controls'; }
      else if (key === 'sound') { s.sound = !s.sound; TB.audio.setEnabled(s.sound); TB.store.saveSettings(s); }
      else if (key === 'scanlines') { s.scanlines = !s.scanlines; TB.store.saveSettings(s); }
      TB.audio.menuPick();
    }
  };

  G.drawSettings = function (cx) {
    var s = G.settings;
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    F.drawCentered(cx, 'SETTINGS', 128, 24, '#e8c82c', 1);
    var rows = [
      ['SOUND', s.sound ? 'ON' : 'OFF'],
      ['SCANLINES', s.scanlines ? 'ON' : 'OFF'],
      ['START STAGE', TB.pad(s.startStage, 2, '0')],
      ['CONTROLS', ''],
      ['BACK', '']
    ];
    for (var i = 0; i < rows.length; i++) {
      var y = 64 + i * 18;
      var sel = (i === G.optIndex);
      F.draw(cx, rows[i][0], 56, y, sel ? '#ffffff' : '#909090', 1);
      F.drawRight(cx, rows[i][1], 208, y, sel ? '#ffe040' : '#707070', 1);
      if (sel) {
        var set = S.tank('player0', 'p1');
        cx.drawImage(set[1][(G.tick >> 3) & 1], 36, y - 4);
      }
    }
    F.drawCentered(cx, 'LEFT / RIGHT CHANGES, ESC BACK', 128, 196, '#606060', 1);
  };

  G.drawControls = function (cx) {
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    F.drawCentered(cx, 'CONTROLS', 128, 14, '#e8c82c', 1);
    var lines = [
      ['PLAYER 1', ''],
      ['MOVE', 'W A S D'],
      ['FIRE', 'J OR SPACE'],
      ['', ''],
      ['PLAYER 2', ''],
      ['MOVE', 'ARROW KEYS'],
      ['FIRE', 'NUMPAD 0 / RSHIFT'],
      ['', ''],
      ['PAUSE', 'P OR ESC'],
      ['CONFIRM', 'ENTER OR SPACE'],
      ['MENUS', 'MOUSE WORKS TOO']
    ];
    for (var i = 0; i < lines.length; i++) {
      var y = 34 + i * 14;
      var head = lines[i][1] === '';
      F.draw(cx, lines[i][0], head ? 30 : 42, y, head ? '#d82800' : '#c0c0c0', 1);
      F.drawRight(cx, lines[i][1], 226, y, '#ffffff', 1);
    }
    F.drawCentered(cx, 'ESC OR FIRE TO GO BACK', 128, 206, '#606060', 1);
  };

  /* ---------------- stage intro / play ------------------------ */
  var INTRO_TOTAL = 96, INTRO_OPEN = 70;

  G.drawIntro = function (cx) {
    var t = G.introT;
    if (t >= INTRO_OPEN && G.battle) G.battle.draw(cx);
    else { cx.fillStyle = '#000000'; cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H); }

    var openFrac = t < INTRO_OPEN ? 0 : (t - INTRO_OPEN) / (INTRO_TOTAL - INTRO_OPEN);
    var half = Math.round((C.SCREEN_H / 2) * (1 - openFrac));
    cx.fillStyle = TB.PAL.bg;
    cx.fillRect(0, 0, C.SCREEN_W, half);
    cx.fillRect(0, C.SCREEN_H - half, C.SCREEN_W, half);

    if (t < INTRO_OPEN) {
      var sess = G.session;
      var label, sub = '';
      if (sess.mode === 'custom') { label = 'STAGE'; sub = G.battle.stageLabel; }
      else if (sess.mode === 'survival') { label = 'WAVE  ' + TB.pad(sess.stageNum, 2, ' '); }
      else { label = 'STAGE  ' + TB.pad(sess.stageNum, 2, ' '); }
      F.drawCentered(cx, label, 128, sub ? 100 : 108, '#000000', 1);
      if (sub) F.drawCentered(cx, sub, 128, 112, '#000000', 1);
    }
  };

  G.updateIntro = function () {
    G.introT++;
    if (TB.input.menu.confirm() && G.introT < INTRO_OPEN) G.introT = INTRO_OPEN;
    if (G.introT >= INTRO_TOTAL) { G.state = 'play'; G.paused = false; }
  };

  G.updatePlay = function () {
    var I = TB.input;
    if (I.hit('KeyP') || I.hit('Escape')) {
      G.paused = !G.paused;
      TB.audio.pause();
      TB.audio.engine(G.paused ? 0 : 1);
      if (G.paused) G.pauseIndex = 0;
    }
    if (G.paused) {
      if (I.hit('KeyQ')) {
        TB.audio.engine(0);
        G.commitHiScore();
        G.paused = false;
        G.state = 'title';
        G.titleT = 200;
        G.session = null;
        G.battle = null;
      }
      return;
    }

    G.battle.update();
    if (G.battle.state === 'done') {
      TB.audio.engine(0);
      if (G.battle.result === 'clear') G.enterScore('clear');
      else { G.state = 'gameover'; G.overT = 0; }
    }
  };

  G.drawPlay = function (cx) {
    cx.fillStyle = TB.PAL.bg;
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    G.battle.draw(cx);
    if (G.paused && ((G.tick >> 4) & 1)) {
      F.drawCentered(cx, 'PAUSE', C.FIELD_X + C.FIELD_W / 2, 100, '#d82800', 2);
    }
    if (G.paused) {
      F.drawCentered(cx, 'P RESUME    Q QUIT', C.FIELD_X + C.FIELD_W / 2, 126, '#ffffff', 1);
    }
  };

  /* ---------------- game over / all clear --------------------- */
  G.updateGameOver = function () {
    G.overT++;
    if (G.overT > 150 || TB.input.menu.confirm()) {
      TB.audio.gameOver();
      G.enterScore('gameover');
    }
  };

  G.drawGameOver = function (cx) {
    cx.fillStyle = TB.PAL.bg;
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    if (G.battle) G.battle.draw(cx);
    var rise = Math.max(0, 1 - G.overT / 90);
    var y = Math.round(96 + rise * 120);
    F.drawCentered(cx, 'GAME', C.FIELD_X + C.FIELD_W / 2, y, '#d82800', 2);
    F.drawCentered(cx, 'OVER', C.FIELD_X + C.FIELD_W / 2, y + 20, '#d82800', 2);
  };

  G.updateAllClear = function () {
    G.allClearT++;
    if (G.allClearT === 1) TB.audio.stageClear();
    if (G.allClearT > 60 && (TB.input.menu.confirm() || G.allClearT > 400)) {
      G.enterScore('gameover');
    }
  };

  G.drawAllClear = function (cx) {
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    F.drawCentered(cx, 'ALL CLEAR', 128, 80, '#e8c82c', 2);
    F.drawCentered(cx, 'CUSTOM CAMPAIGN COMPLETE', 128, 118, '#ffffff', 1);
    if ((G.allClearT >> 4) & 1) F.drawCentered(cx, 'PRESS FIRE', 128, 150, '#d82800', 1);
  };

  /* ---------------- top level --------------------------------- */
  G.update = function () {
    G.tick++;
    switch (G.state) {
      case 'title': G.updateTitle(); break;
      case 'settings': G.updateSettings(); break;
      case 'controls':
        if (TB.input.menu.back() || TB.input.menu.confirm() || TB.input.mouse.clicked) G.state = 'settings';
        break;
      case 'customSelect': G.updateCustomSelect(); break;
      case 'editor': G.editor.update(); break;
      case 'stageIntro': G.updateIntro(); break;
      case 'play': G.updatePlay(); break;
      case 'score': G.updateScore(); break;
      case 'gameover': G.updateGameOver(); break;
      case 'allClear': G.updateAllClear(); break;
    }
  };

  G.draw = function (cx) {
    switch (G.state) {
      case 'title': G.drawTitle(cx); break;
      case 'settings': G.drawSettings(cx); break;
      case 'controls': G.drawControls(cx); break;
      case 'customSelect': G.drawCustomSelect(cx); break;
      case 'editor': G.editor.draw(cx); break;
      case 'stageIntro': G.drawIntro(cx); break;
      case 'play': G.drawPlay(cx); break;
      case 'score': G.drawScore(cx); break;
      case 'gameover': G.drawGameOver(cx); break;
      case 'allClear': G.drawAllClear(cx); break;
    }
  };

  G.statusText = function () {
    switch (G.state) {
      case 'editor': return 'CONSTRUCTION' + (G.editor && G.editor.name ? ' - ' + G.editor.name : '');
      case 'play': return (G.paused ? 'PAUSED' : 'PLAYING') + '  SCORE ' +
        (G.session ? G.session.playerState.map(function (s) { return s.score; }).join(' / ') : '');
      case 'title': return 'TITLE';
      default: return G.state.toUpperCase();
    }
  };
})(window.TB);
