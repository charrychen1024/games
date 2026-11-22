/* ===========================================================
 * CONSTRUCTION — the stage editor.
 * Mouse paints, keyboard does everything else. Stages are kept
 * in localStorage and can be exported / imported as JSON.
 * =========================================================== */
(function (TB) {
  'use strict';

  var C = TB.C, T = TB.T, S = TB.sprites, L = TB.levels, F = TB.font;

  var PALETTE = [T.BRICK, T.STEEL, T.WATER, T.TREES, T.ICE, T.EMPTY];
  var PAL_X = [220, 237], PAL_Y = 12;
  var TYPE_LETTER = ['B', 'F', 'P', 'A'];

  function newGrid() {
    var g = L.emptyGrid();
    L.stampBase(g, T.BRICK);
    return g;
  }

  function Editor(hooks) {
    this.hooks = hooks || {};
    this.grid = newGrid();
    this.comp = [18, 2, 0, 0];
    this.name = '';
    this.slotIndex = -1;
    this.brush = 2;                 // in quads: 2 = a full 16px cell
    this.terrain = T.BRICK;
    this.cx = 12; this.cy = 12;     // cursor, quad coords
    this.mode = 'edit';
    this.msg = 'MOUSE PAINTS - H FOR KEYS';
    this.msgTimer = 300;
    this.blink = 0;
    this.slots = TB.store.customStages();
    this.selSlot = 0;
    this.valid = L.validate(this.grid);
    this.dirty = false;
  }

  Editor.prototype.say = function (m, hold) {
    this.msg = m;
    this.msgTimer = hold || 180;
  };

  Editor.prototype.revalidate = function () {
    this.valid = L.validate(this.grid);
  };

  /* ---- painting --------------------------------------------- */
  Editor.prototype.paintAt = function (qx, qy, value) {
    var n = this.brush;
    qx = Math.max(0, Math.min(C.COLS - n, qx));
    qy = Math.max(0, Math.min(C.ROWS - n, qy));
    var changed = false;
    for (var dy = 0; dy < n; dy++) {
      for (var dx = 0; dx < n; dx++) {
        var x = qx + dx, y = qy + dy;
        if (this.isProtected(x, y)) continue;
        if (this.grid[y * C.COLS + x] !== value) {
          this.grid[y * C.COLS + x] = value;
          changed = true;
        }
      }
    }
    if (changed) { this.dirty = true; this.revalidate(); }
    return changed;
  };

  /* the eagle's own square can never be painted over */
  Editor.prototype.isProtected = function (qx, qy) {
    for (var i = 0; i < L.BASE_QUADS.length; i++) {
      if (L.BASE_QUADS[i][0] === qx && L.BASE_QUADS[i][1] === qy) return true;
    }
    return false;
  };

  Editor.prototype.fillAll = function (value) {
    for (var y = 0; y < C.ROWS; y++) {
      for (var x = 0; x < C.COLS; x++) {
        if (!this.isProtected(x, y)) this.grid[y * C.COLS + x] = value;
      }
    }
    this.dirty = true;
    this.revalidate();
  };

  /* ---- enemy mix -------------------------------------------- */
  Editor.prototype.bumpComp = function (t) {
    // move one tank from another type so the total stays at 20
    for (var step = 1; step <= 4; step++) {
      var donor = (t + step) % 4;
      if (this.comp[donor] > 0) {
        this.comp[donor]--;
        this.comp[t]++;
        this.dirty = true;
        this.say(TYPE_LETTER[t] + ' x' + this.comp[t]);
        return;
      }
    }
  };

  /* ---- slots ------------------------------------------------- */
  Editor.prototype.stageObject = function () {
    return { name: this.name || ('STAGE ' + (this.slots.length + 1)),
             rows: L.gridToRows(this.grid),
             comp: this.comp.slice() };
  };

  Editor.prototype.save = function () {
    var obj = this.stageObject();
    if (this.slotIndex >= 0 && this.slotIndex < this.slots.length) {
      obj.name = this.slots[this.slotIndex].name;
      this.slots[this.slotIndex] = obj;
    } else {
      var proposed = 'STAGE ' + (this.slots.length + 1);
      var entered = null;
      try { entered = window.prompt('关卡名称 / stage name:', proposed); } catch (e) { entered = proposed; }
      TB.input.reset();
      if (entered === null) { this.say('SAVE CANCELLED'); return; }
      obj.name = (entered || proposed).toUpperCase().slice(0, 14);
      this.slots.push(obj);
      this.slotIndex = this.slots.length - 1;
    }
    this.name = obj.name;
    TB.store.saveCustomStages(this.slots);
    this.dirty = false;
    this.say('SAVED TO SLOT ' + (this.slotIndex + 1) +
             (TB.store.persistent ? '' : ' (SESSION ONLY)'), 240);
  };

  Editor.prototype.loadSlot = function (i) {
    var st = this.slots[i];
    if (!st) return;
    this.grid = L.parse(st.rows, { autoBase: false });
    this.comp = (st.comp || [18, 2, 0, 0]).slice();
    this.name = st.name;
    this.slotIndex = i;
    this.dirty = false;
    this.revalidate();
    this.say('LOADED ' + st.name);
  };

  Editor.prototype.deleteSlot = function (i) {
    if (!this.slots[i]) return;
    var gone = this.slots[i].name;
    this.slots.splice(i, 1);
    TB.store.saveCustomStages(this.slots);
    if (this.slotIndex === i) this.slotIndex = -1;
    else if (this.slotIndex > i) this.slotIndex--;
    this.selSlot = Math.max(0, Math.min(this.slots.length - 1, this.selSlot));
    this.say('DELETED ' + gone);
  };

  Editor.prototype.renameSlot = function () {
    if (this.slotIndex < 0) { this.say('SAVE IT FIRST'); return; }
    var entered = null;
    try { entered = window.prompt('重命名 / rename:', this.name); } catch (e) { }
    TB.input.reset();
    if (!entered) return;
    this.name = entered.toUpperCase().slice(0, 14);
    this.slots[this.slotIndex].name = this.name;
    TB.store.saveCustomStages(this.slots);
    this.say('RENAMED');
  };

  Editor.prototype.exportJSON = function () {
    return JSON.stringify({ format: 'battle-city-90', version: 1, stages: this.slots }, null, 1);
  };

  Editor.prototype.importJSON = function (text) {
    var data;
    try { data = JSON.parse(text); } catch (e) { this.say('BAD JSON', 240); return false; }
    var list = Array.isArray(data) ? data : data.stages;
    if (!Array.isArray(list)) { this.say('NO STAGES IN FILE', 240); return false; }
    var added = 0;
    for (var i = 0; i < list.length; i++) {
      var st = list[i];
      if (!st || !Array.isArray(st.rows)) continue;
      this.slots.push({
        name: ('' + (st.name || ('IMPORT ' + (i + 1)))).toUpperCase().slice(0, 14),
        rows: st.rows,
        comp: Array.isArray(st.comp) && st.comp.length === 4 ? st.comp : [18, 2, 0, 0]
      });
      added++;
    }
    TB.store.saveCustomStages(this.slots);
    this.say('IMPORTED ' + added + ' STAGE' + (added === 1 ? '' : 'S'), 240);
    return added > 0;
  };

  /* ---- input ------------------------------------------------- */
  Editor.prototype.update = function () {
    this.blink++;
    if (this.msgTimer > 0) this.msgTimer--;
    var I = TB.input;

    if (this.mode === 'slots') { this.updateSlots(); return; }

    if (I.hit('Escape')) {
      if (this.showHelp) { this.showHelp = false; return; }
      if (this.dirty) { this.say('UNSAVED - PRESS ESC AGAIN TO LEAVE', 120); this.dirty = false; return; }
      if (this.hooks.onExit) this.hooks.onExit();
      return;
    }
    if (I.hit('KeyH')) { this.showHelp = !this.showHelp; return; }
    if (this.showHelp) return;

    // cursor
    var step = this.brush;
    if (I.hit('ArrowLeft')) this.cx -= step;
    if (I.hit('ArrowRight')) this.cx += step;
    if (I.hit('ArrowUp')) this.cy -= step;
    if (I.hit('ArrowDown')) this.cy += step;
    this.cx = Math.max(0, Math.min(C.COLS - this.brush, this.cx));
    this.cy = Math.max(0, Math.min(C.ROWS - this.brush, this.cy));

    if (I.hit('Space')) this.paintAt(this.cx, this.cy, this.terrain);
    if (I.hit('Delete') || I.hit('Backspace')) this.paintAt(this.cx, this.cy, T.EMPTY);

    if (I.hit('Tab') || I.hit('KeyE')) {
      var i = PALETTE.indexOf(this.terrain);
      this.terrain = PALETTE[(i + 1) % PALETTE.length];
      this.say(TB.TERRAIN_NAMES[this.terrain]);
    }
    if (I.hit('KeyQ')) {
      var j = PALETTE.indexOf(this.terrain);
      this.terrain = PALETTE[(j + PALETTE.length - 1) % PALETTE.length];
      this.say(TB.TERRAIN_NAMES[this.terrain]);
    }
    if (I.hit('KeyB')) {
      this.brush = this.brush === 2 ? 1 : 2;
      this.cx -= this.cx % this.brush;
      this.cy -= this.cy % this.brush;
      this.say('BRUSH ' + (this.brush * 8) + 'PX');
    }
    if (I.hit('KeyF')) { this.fillAll(this.terrain); this.say('FILLED'); }
    if (I.hit('KeyC')) { this.fillAll(T.EMPTY); L.stampBase(this.grid, T.BRICK); this.revalidate(); this.say('CLEARED'); }
    if (I.hit('KeyN')) {
      this.grid = newGrid(); this.comp = [18, 2, 0, 0];
      this.name = ''; this.slotIndex = -1; this.dirty = false;
      this.revalidate(); this.say('NEW STAGE');
    }
    if (I.hit('KeyS')) this.save();
    if (I.hit('KeyR')) this.renameSlot();
    if (I.hit('KeyL')) {
      this.slots = TB.store.customStages();
      if (!this.slots.length) this.say('NO SAVED STAGES', 180);
      else { this.mode = 'slots'; this.selSlot = Math.max(0, this.slotIndex); }
    }
    if (I.hit('KeyT')) {
      if (!this.valid.ok) { this.say('CANNOT TEST: ' + this.valid.reason, 240); }
      else if (this.hooks.onPlay) this.hooks.onPlay(this.stageObject());
    }
    for (var t = 0; t < 4; t++) {
      if (I.hit('Digit' + (t + 1)) || I.hit('Numpad' + (t + 1))) this.bumpComp(t);
    }

    // ---- mouse ----
    var m = I.mouse;
    if (m.inside) {
      // palette hit test
      if (m.clicked) {
        for (var p = 0; p < PALETTE.length; p++) {
          var px = PAL_X[p % 2], py = PAL_Y + ((p / 2) | 0) * 18;
          if (m.x >= px && m.x < px + 16 && m.y >= py && m.y < py + 16) {
            this.terrain = PALETTE[p];
            this.say(TB.TERRAIN_NAMES[this.terrain]);
            return;
          }
        }
      }
      var fx = m.x - C.FIELD_X, fy = m.y - C.FIELD_Y;
      if (fx >= 0 && fy >= 0 && fx < C.FIELD_W && fy < C.FIELD_H) {
        var qx = Math.floor(fx / 8), qy = Math.floor(fy / 8);
        qx -= qx % this.brush; qy -= qy % this.brush;
        this.cx = qx; this.cy = qy;
        if (m.down) this.paintAt(qx, qy, this.terrain);
        else if (m.rdown) this.paintAt(qx, qy, T.EMPTY);
      }
    }
  };

  Editor.prototype.updateSlots = function () {
    var I = TB.input;
    if (I.hit('Escape') || I.hit('KeyL')) { this.mode = 'edit'; return; }
    if (I.menu.up()) { this.selSlot = (this.selSlot + this.slots.length - 1) % this.slots.length; TB.audio.menuMove(); }
    if (I.menu.down()) { this.selSlot = (this.selSlot + 1) % this.slots.length; TB.audio.menuMove(); }
    if (I.hit('KeyD')) {
      this.deleteSlot(this.selSlot);
      if (!this.slots.length) this.mode = 'edit';
      return;
    }
    if (I.menu.confirm()) {
      this.loadSlot(this.selSlot);
      this.mode = 'edit';
      TB.audio.menuPick();
      return;
    }
    var m = I.mouse;
    if (m.inside && m.clicked) {
      var row = Math.floor((m.y - 44) / 12);
      if (row >= 0 && row < this.slots.length) {
        this.selSlot = row;
        this.loadSlot(row);
        this.mode = 'edit';
        TB.audio.menuPick();
      }
    }
  };

  /* ---- drawing ----------------------------------------------- */
  function tileFor(v) {
    switch (v) {
      case T.BRICK: return S.brick;
      case T.STEEL: return S.steel;
      case T.WATER: return S.water[0];
      case T.TREES: return S.trees;
      case T.ICE: return S.ice;
      default: return null;
    }
  }

  Editor.prototype.draw = function (cx) {
    cx.fillStyle = TB.PAL.bg;
    cx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);

    cx.save();
    cx.translate(C.FIELD_X, C.FIELD_Y);
    cx.fillStyle = '#000000';
    cx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);

    var qx, qy, img;
    for (qy = 0; qy < C.ROWS; qy++) {
      for (qx = 0; qx < C.COLS; qx++) {
        img = tileFor(this.grid[qy * C.COLS + qx]);
        if (img) cx.drawImage(img, qx * 8, qy * 8);
      }
    }
    cx.drawImage(S.eagle, L.BASE_QUADS[0][0] * 8, L.BASE_QUADS[0][1] * 8);

    // lattice
    cx.fillStyle = 'rgba(255,255,255,0.055)';
    for (var g = 0; g <= 26; g++) {
      if (g % 2) { cx.fillRect(g * 8, 0, 1, C.FIELD_H); cx.fillRect(0, g * 8, C.FIELD_W, 1); }
    }
    cx.fillStyle = 'rgba(255,255,255,0.12)';
    for (var g2 = 0; g2 <= 13; g2++) {
      cx.fillRect(g2 * 16, 0, 1, C.FIELD_H);
      cx.fillRect(0, g2 * 16, C.FIELD_W, 1);
    }

    // spawn markers
    var i, c;
    cx.globalAlpha = 0.75;
    for (i = 0; i < L.ENEMY_SPAWN_CELLS.length; i++) {
      c = L.ENEMY_SPAWN_CELLS[i];
      F.draw(cx, 'E', c[0] * 16 + 5, c[1] * 16 + 4, '#ff6060', 1);
    }
    for (i = 0; i < L.PLAYER_SPAWN_CELLS.length; i++) {
      c = L.PLAYER_SPAWN_CELLS[i];
      F.draw(cx, '' + (i + 1), c[0] * 16 + 5, c[1] * 16 + 4, i ? '#80ff80' : '#ffe040', 1);
    }
    cx.globalAlpha = 1;

    // cursor
    if ((this.blink >> 3) & 1) {
      var n = this.brush * 8;
      cx.strokeStyle = '#ffffff';
      cx.lineWidth = 1;
      cx.strokeRect(this.cx * 8 + 0.5, this.cy * 8 + 0.5, n - 1, n - 1);
    }
    cx.restore();

    this.drawPanel(cx);
    this.drawStatus(cx);
    if (this.mode === 'slots') this.drawSlots(cx);
    if (this.showHelp) this.drawHelp(cx);
  };

  Editor.prototype.drawPanel = function (cx) {
    var p, px, py;
    for (p = 0; p < PALETTE.length; p++) {
      px = PAL_X[p % 2]; py = PAL_Y + ((p / 2) | 0) * 18;
      var img = tileFor(PALETTE[p]);
      cx.fillStyle = '#000000';
      cx.fillRect(px, py, 16, 16);
      if (img) {
        cx.drawImage(img, px, py);
        cx.drawImage(img, px + 8, py);
        cx.drawImage(img, px, py + 8);
        cx.drawImage(img, px + 8, py + 8);
      } else {
        cx.fillStyle = '#505050';
        cx.fillRect(px + 7, py + 2, 2, 12);
        cx.fillRect(px + 2, py + 7, 12, 2);
      }
      cx.strokeStyle = (PALETTE[p] === this.terrain) ? '#ffffff' : '#303030';
      cx.strokeRect(px - 0.5, py - 0.5, 17, 17);
    }

    var y = PAL_Y + 3 * 18 + 4;
    F.draw(cx, 'BRSH', 220, y, '#000000', 1);
    F.draw(cx, this.brush === 2 ? '16' : '8', 220, y + 9, '#000000', 1);

    y += 22;
    for (var t = 0; t < 4; t++) {
      F.draw(cx, TYPE_LETTER[t] + TB.pad(this.comp[t], 2, '0'), 220, y + t * 9, '#000000', 1);
    }

    y += 4 * 9 + 6;
    F.draw(cx, this.valid.ok ? 'OK' : 'BAD', 220, y, this.valid.ok ? '#105010' : '#a00000', 1);

    y += 11;
    F.draw(cx, this.slotIndex >= 0 ? ('SL' + (this.slotIndex + 1)) : 'NEW', 220, y, '#000000', 1);
    if (this.dirty) F.draw(cx, '*', 244, y, '#a00000', 1);
  };

  Editor.prototype.drawStatus = function (cx) {
    cx.fillStyle = '#000000';
    cx.fillRect(0, C.SCREEN_H - 8, C.SCREEN_W, 8);
    var text = this.msgTimer > 0 ? this.msg : (this.valid.ok ? 'PLAYABLE - T TO TEST, S TO SAVE' : this.valid.reason);
    F.draw(cx, text.slice(0, 42), 2, C.SCREEN_H - 7, this.valid.ok || this.msgTimer > 0 ? '#ffffff' : '#ff8080', 1);
  };

  Editor.prototype.drawSlots = function (cx) {
    cx.fillStyle = 'rgba(0,0,0,0.88)';
    cx.fillRect(16, 24, 224, 170);
    cx.strokeStyle = '#ffffff';
    cx.strokeRect(16.5, 24.5, 223, 169);
    F.drawCentered(cx, 'SAVED STAGES', 128, 32, '#ffe040', 1);
    var top = Math.max(0, Math.min(this.selSlot - 5, this.slots.length - 12));
    for (var i = 0; i < 12; i++) {
      var k = top + i;
      if (k >= this.slots.length) break;
      var sel = (k === this.selSlot);
      var yy = 44 + i * 12;
      if (sel) { cx.fillStyle = '#303030'; cx.fillRect(20, yy - 2, 216, 11); }
      F.draw(cx, TB.pad(k + 1, 2, '0') + ' ' + this.slots[k].name, 24, yy, sel ? '#ffe040' : '#c0c0c0', 1);
      var cmp = this.slots[k].comp || [];
      F.drawRight(cx, cmp.join('-'), 232, yy, sel ? '#ffffff' : '#808080', 1);
    }
    F.drawCentered(cx, 'ENTER LOAD   D DELETE   ESC BACK', 128, 182, '#909090', 1);
  };

  Editor.prototype.drawHelp = function (cx) {
    cx.fillStyle = 'rgba(0,0,0,0.9)';
    cx.fillRect(10, 14, 236, 192);
    cx.strokeStyle = '#ffffff';
    cx.strokeRect(10.5, 14.5, 235, 191);
    F.drawCentered(cx, 'CONSTRUCTION KEYS', 128, 22, '#ffe040', 1);
    var lines = [
      'MOUSE L  PAINT       MOUSE R  ERASE',
      'ARROWS   MOVE CURSOR SPACE    PLACE',
      'DEL      ERASE       TAB/Q/E  TERRAIN',
      'B        BRUSH 8/16  F        FILL ALL',
      'C        CLEAR       N        NEW',
      'S        SAVE        L        LOAD LIST',
      'R        RENAME      T        TEST PLAY',
      '1 2 3 4  ENEMY MIX   H        THIS HELP',
      'ESC      LEAVE EDITOR',
      '',
      'B/F/P/A = BASIC FAST POWER ARMOR',
      'THE 20 TANK MIX ALWAYS TOTALS 20.',
      '',
      'E MARKS ENEMY SPAWNS, 1 AND 2 MARK',
      'THE PLAYER SPAWNS. THEY STAY CLEAR.',
      '',
      'OK / BAD TELLS YOU IF THE STAGE CAN',
      'ACTUALLY BE PLAYED AND WON.'
    ];
    for (var i = 0; i < lines.length; i++) {
      F.draw(cx, lines[i], 16, 34 + i * 9, i < 9 ? '#ffffff' : '#a0c0ff', 1);
    }
  };

  TB.Editor = Editor;
})(window.TB);
