/* ===========================================================
 * The battlefield: terrain, collision, spawning, HUD.
 * =========================================================== */
(function (TB) {
  'use strict';

  var C = TB.C, T = TB.T, D = TB.D, DX = TB.DX, DY = TB.DY;
  var S = TB.sprites, L = TB.levels, PU = TB.PU;

  function Battle(cfg) {
    this.mode = cfg.mode || 'campaign';
    this.stageNum = cfg.stageNum || 1;
    this.stageLabel = cfg.stageLabel || ('' + this.stageNum);
    this.numPlayers = cfg.numPlayers || 1;
    this.playerState = cfg.playerState;      // shared across stages

    this.grid = L.parse(cfg.rows, { autoBase: cfg.autoBase });
    this.queue = L.buildQueue(cfg.comp);
    this.spawnCursor = 0;
    this.killed = 0;
    this.spawnPoint = 0;
    this.spawnTimer = 30;
    this.spawnInterval = Math.max(60, 150 - this.stageNum * 2);

    this.tanks = [];
    this.players = [];
    this.bullets = [];
    this.powerups = [];
    this.fx = [];
    this.popups = [];

    this.freezeTimer = 0;
    this.shovelTimer = 0;
    this.shake = 0;
    this.tick = 0;

    this.baseAlive = true;
    this.baseRect = { x: L.BASE_QUADS[0][0] * 8, y: L.BASE_QUADS[0][1] * 8, w: 16, h: 16 };

    this.state = 'play';
    this.endTimer = 0;
    this.result = null;

    for (var i = 0; i < this.numPlayers; i++) {
      this.players.push(null);
      this.spawnPlayer(i, true);
    }
    this.spawnEnemy();
  }

  /* ---------------- terrain ---------------------------------- */
  Battle.prototype.quadAt = function (qx, qy) {
    if (qx < 0 || qy < 0 || qx >= C.COLS || qy >= C.ROWS) return T.STEEL;
    return this.grid[qy * C.COLS + qx];
  };
  Battle.prototype.setQuad = function (qx, qy, v) {
    if (qx < 0 || qy < 0 || qx >= C.COLS || qy >= C.ROWS) return;
    this.grid[qy * C.COLS + qx] = v;
  };

  Battle.prototype.terrainUnder = function (tank) {
    var qx = Math.floor((tank.x + 8) / 8), qy = Math.floor((tank.y + 8) / 8);
    return this.quadAt(qx, qy);
  };

  /* ---------------- collision -------------------------------- */
  Battle.prototype.canPlaceTank = function (x, y, self) {
    if (x < 0 || y < 0 || x + C.TANK > C.FIELD_W || y + C.TANK > C.FIELD_H) return false;

    var q0x = Math.floor(x / 8), q1x = Math.floor((x + C.TANK - 0.001) / 8);
    var q0y = Math.floor(y / 8), q1y = Math.floor((y + C.TANK - 0.001) / 8);
    for (var qy = q0y; qy <= q1y; qy++) {
      for (var qx = q0x; qx <= q1x; qx++) {
        if (TB.BLOCKS_TANK[this.quadAt(qx, qy)]) return false;
      }
    }
    if (this.baseAlive && TB.overlap(x, y, C.TANK, C.TANK,
        this.baseRect.x, this.baseRect.y, this.baseRect.w, this.baseRect.h)) return false;

    for (var i = 0; i < this.tanks.length; i++) {
      var t = this.tanks[i];
      if (t === self || !t.alive) continue;
      if (TB.overlap(x, y, C.TANK, C.TANK, t.x, t.y, C.TANK, C.TANK)) return false;
    }
    return true;
  };

  /* ---------------- bullets ---------------------------------- */
  Battle.prototype.killBullet = function (b) {
    if (b.dead) return;
    b.dead = true;
    if (b.owner) b.owner.activeBullets = Math.max(0, b.owner.activeBullets - 1);
  };

  /* the slab of wall a bullet chews out on impact */
  function cutRect(b) {
    var p = 1;
    switch (b.dir) {
      case D.UP:    return { x: b.x - p, y: b.y - 2, w: b.w + p * 2, h: 4 };
      case D.DOWN:  return { x: b.x - p, y: b.y + b.h - 2, w: b.w + p * 2, h: 4 };
      case D.LEFT:  return { x: b.x - 2, y: b.y - p, w: 4, h: b.h + p * 2 };
      default:      return { x: b.x + b.w - 2, y: b.y - p, w: 4, h: b.h + p * 2 };
    }
  }

  Battle.prototype.resolveBullet = function (b) {
    if (b.dead) return;
    var i;

    // field edge
    if (b.x < 0 || b.y < 0 || b.x + b.w > C.FIELD_W || b.y + b.h > C.FIELD_H) {
      this.killBullet(b);
      this.fx.push(new TB.Explosion(TB.clamp(b.x + 2, 2, C.FIELD_W - 2),
                                    TB.clamp(b.y + 2, 2, C.FIELD_H - 2), false));
      if (b.fromPlayer) TB.audio.hitSteel();
      return;
    }

    // the eagle
    if (this.baseAlive && TB.overlap(b.x, b.y, b.w, b.h,
        this.baseRect.x, this.baseRect.y, this.baseRect.w, this.baseRect.h)) {
      this.killBullet(b);
      this.destroyBase();
      return;
    }

    // terrain
    var r = cutRect(b);
    var q0x = Math.floor(r.x / 8), q1x = Math.floor((r.x + r.w - 0.001) / 8);
    var q0y = Math.floor(r.y / 8), q1y = Math.floor((r.y + r.h - 0.001) / 8);
    var hitBrick = false, hitSteel = false, brokeSteel = false;
    for (var qy = q0y; qy <= q1y; qy++) {
      for (var qx = q0x; qx <= q1x; qx++) {
        var v = this.quadAt(qx, qy);
        if (v === T.BRICK) {
          this.setQuad(qx, qy, T.EMPTY);
          hitBrick = true;
        } else if (v === T.STEEL) {
          hitSteel = true;
          if (b.power) { this.setQuad(qx, qy, T.EMPTY); brokeSteel = true; }
        }
      }
    }
    if (hitBrick || hitSteel) {
      this.killBullet(b);
      this.fx.push(new TB.Explosion(b.x + 2, b.y + 2, false));
      if (b.fromPlayer) {
        if (hitBrick || brokeSteel) TB.audio.hitBrick();
        else TB.audio.hitSteel();
      }
      return;
    }

    // tanks
    for (i = 0; i < this.tanks.length; i++) {
      var t = this.tanks[i];
      if (!t.alive || t === b.owner) continue;
      if (!b.fromPlayer && !t.isPlayer) continue;       // enemies don't friendly-fire
      if (!TB.overlap(b.x, b.y, b.w, b.h, t.x, t.y, C.TANK, C.TANK)) continue;
      if (t.spawnTimer > 0) continue;
      this.killBullet(b);
      var died = t.takeHit(b);
      if (died) this.onTankDestroyed(t, b);
      else this.fx.push(new TB.Explosion(b.x + 2, b.y + 2, false));
      return;
    }

    // bullet vs bullet — a player's shot swats an enemy shell out of the air
    for (i = 0; i < this.bullets.length; i++) {
      var o = this.bullets[i];
      if (o === b || o.dead) continue;
      if (o.fromPlayer === b.fromPlayer && !b.fromPlayer) continue;
      if (!TB.overlap(b.x, b.y, b.w, b.h, o.x, o.y, o.w, o.h)) continue;
      this.killBullet(b);
      this.killBullet(o);
      TB.audio.bulletHit();
      return;
    }
  };

  /* ---------------- deaths ----------------------------------- */
  Battle.prototype.onTankDestroyed = function (t, bullet) {
    this.fx.push(new TB.Explosion(t.centerX(), t.centerY(), true));
    this.shake = Math.max(this.shake, 6);

    if (t.isPlayer) {
      TB.audio.expBig();
      var st = this.playerState[t.playerIndex];
      st.level = 0;
      this.players[t.playerIndex] = null;
      if (st.lives > 0) { st.lives--; st.respawn = C.RESPAWN_DELAY; }
      else st.out = true;
      return;
    }

    TB.audio.expSmall();
    this.killed++;
    var def = TB.ENEMY_DEF[t.type];
    var killer = (bullet && bullet.fromPlayer) ? bullet.playerIndex : 0;
    var ps = this.playerState[killer] || this.playerState[0];
    ps.score += def.score;
    ps.kills[t.type] = (ps.kills[t.type] || 0) + 1;
    this.popups.push(new TB.Popup(def.score, t.centerX(), t.centerY() - 4));

    if (t.bonus) this.dropPowerUp();
  };

  Battle.prototype.destroyBase = function () {
    if (!this.baseAlive) return;
    this.baseAlive = false;
    this.fx.push(new TB.Explosion(this.baseRect.x + 8, this.baseRect.y + 8, true));
    this.fx.push(new TB.Explosion(this.baseRect.x + 2, this.baseRect.y + 4, false));
    this.fx.push(new TB.Explosion(this.baseRect.x + 14, this.baseRect.y + 12, false));
    this.shake = 14;
    TB.audio.baseLost();
    this.beginEnd('gameover');
  };

  Battle.prototype.beginEnd = function (result) {
    if (this.state !== 'play') return;
    this.state = 'ending';
    this.result = result;
    this.endTimer = result === 'clear' ? 110 : 160;
    if (result === 'clear') TB.audio.stageClear();
  };

  /* ---------------- spawning --------------------------------- */
  Battle.prototype.spawnPlayer = function (idx, initial) {
    var cell = L.PLAYER_SPAWN_CELLS[idx] || L.PLAYER_SPAWN_CELLS[0];
    var st = this.playerState[idx];
    if (!st || st.out) return false;
    var t = new TB.Tank(this, {
      isPlayer: true,
      playerIndex: idx,
      x: cell[0] * 16,
      y: cell[1] * 16,
      level: st.level || 0
    });
    t.shield = C.SPAWN_SHIELD_TIME;
    if (initial) t.spawnTimer = Math.floor(C.SPAWN_BLINK_TIME / 2);
    this.players[idx] = t;
    this.tanks.push(t);
    return true;
  };

  Battle.prototype.liveEnemies = function () {
    var n = 0;
    for (var i = 0; i < this.tanks.length; i++) {
      if (!this.tanks[i].isPlayer && this.tanks[i].alive) n++;
    }
    return n;
  };

  Battle.prototype.spawnEnemy = function () {
    if (this.spawnCursor >= this.queue.length) return false;
    var cells = L.ENEMY_SPAWN_CELLS;
    var tries = 0, cell = null;
    while (tries < 3) {
      var cand = cells[this.spawnPoint % cells.length];
      this.spawnPoint++;
      if (this.canPlaceTank(cand[0] * 16, cand[1] * 16, null)) { cell = cand; break; }
      tries++;
    }
    if (!cell) return false;

    var type = this.queue[this.spawnCursor];
    var bonus = C.POWERUP_SPAWN_INDEX.indexOf(this.spawnCursor) >= 0;
    this.spawnCursor++;
    var t = new TB.Tank(this, {
      isPlayer: false, type: type, bonus: bonus,
      x: cell[0] * 16, y: cell[1] * 16
    });
    this.tanks.push(t);
    return true;
  };

  Battle.prototype.dropPowerUp = function () {
    this.powerups.length = 0;
    var kind = TB.randInt(6);
    var tries = 0;
    while (tries++ < 200) {
      var qx = 1 + TB.randInt(C.COLS - 3);
      var qy = 1 + TB.randInt(C.ROWS - 3);
      var ok = true;
      for (var dy = 0; dy < 2 && ok; dy++) {
        for (var dx = 0; dx < 2; dx++) {
          var v = this.quadAt(qx + dx, qy + dy);
          if (v !== T.EMPTY && v !== T.TREES && v !== T.ICE) { ok = false; break; }
        }
      }
      var px = qx * 8, py = qy * 8;
      if (ok && TB.overlap(px, py, 16, 16, this.baseRect.x - 8, this.baseRect.y - 8, 32, 32)) ok = false;
      if (ok) {
        this.powerups.push(new TB.PowerUp(kind, px, py));
        TB.audio.powerupAppear();
        return;
      }
    }
  };

  Battle.prototype.applyPowerUp = function (p, player) {
    var st = this.playerState[player.playerIndex];
    st.score += 500;
    this.popups.push(new TB.Popup(500, p.x + 8, p.y));
    var i;
    switch (p.kind) {
      case PU.STAR:
        if (player.level < C.MAX_PLAYER_LEVEL) player.level++;
        st.level = player.level;
        player.applyLevel();
        TB.audio.pickup();
        break;
      case PU.HELMET:
        player.shield = Math.max(player.shield, C.SHIELD_TIME);
        TB.audio.pickup();
        break;
      case PU.CLOCK:
        this.freezeTimer = C.FREEZE_TIME;
        TB.audio.freeze();
        break;
      case PU.SHOVEL:
        this.shovelTimer = C.SHOVEL_TIME;
        L.stampBase(this.grid, T.STEEL);
        TB.audio.shovel();
        break;
      case PU.GRENADE:
        for (i = this.tanks.length - 1; i >= 0; i--) {
          var t = this.tanks[i];
          if (t.isPlayer || !t.alive || t.spawnTimer > 0) continue;
          t.alive = false;
          t.bonus = false;
          this.onTankDestroyed(t, { fromPlayer: true, playerIndex: player.playerIndex });
        }
        TB.audio.expBig();
        this.shake = 10;
        break;
      case PU.TANK:
        st.lives++;
        TB.audio.extraLife();
        break;
    }
    p.dead = true;
  };

  /* ---------------- per-frame -------------------------------- */
  Battle.prototype.update = function () {
    this.tick++;
    var i, t;

    if (this.shake > 0) this.shake--;
    if (this.freezeTimer > 0) this.freezeTimer--;
    if (this.shovelTimer > 0) {
      this.shovelTimer--;
      if (this.shovelTimer === 0) L.stampBase(this.grid, T.BRICK);
      else if (this.shovelTimer < 180 && this.shovelTimer % 16 === 0) {
        L.stampBase(this.grid, (this.shovelTimer % 32 === 0) ? T.STEEL : T.BRICK);
      }
    }

    // respawn players that still have lives
    for (i = 0; i < this.numPlayers; i++) {
      var st = this.playerState[i];
      if (this.players[i] || !st) continue;
      if (st.respawn > 0) {
        st.respawn--;
        if (st.respawn === 0 && !st.out && this.state === 'play') this.spawnPlayer(i, false);
      }
    }

    // trickle enemies in
    if (this.state === 'play' && this.spawnCursor < this.queue.length) {
      var cap = C.MAX_ENEMIES_ON_FIELD + (this.numPlayers > 1 ? 2 : 0);
      if (this.spawnTimer > 0) this.spawnTimer--;
      if (this.spawnTimer <= 0 && this.liveEnemies() < cap) {
        if (this.spawnEnemy()) this.spawnTimer = this.spawnInterval;
        else this.spawnTimer = 20;
      }
    }

    for (i = 0; i < this.tanks.length; i++) {
      t = this.tanks[i];
      if (t.alive) t.update();
    }
    for (i = 0; i < this.bullets.length; i++) {
      if (!this.bullets[i].dead) this.bullets[i].update();
    }

    // power-up pickup
    for (i = this.powerups.length - 1; i >= 0; i--) {
      var p = this.powerups[i];
      p.update();
      for (var k = 0; k < this.players.length && !p.dead; k++) {
        var pl = this.players[k];
        if (!pl || !pl.alive || pl.spawnTimer > 0) continue;
        if (TB.overlap(p.x, p.y, p.w, p.h, pl.x, pl.y, C.TANK, C.TANK)) this.applyPowerUp(p, pl);
      }
      if (p.dead) this.powerups.splice(i, 1);
    }

    for (i = this.fx.length - 1; i >= 0; i--) {
      this.fx[i].update();
      if (this.fx[i].dead) this.fx.splice(i, 1);
    }
    for (i = this.popups.length - 1; i >= 0; i--) {
      this.popups[i].update();
      if (this.popups[i].dead) this.popups.splice(i, 1);
    }

    // sweep the dead
    for (i = this.bullets.length - 1; i >= 0; i--) {
      if (this.bullets[i].dead) this.bullets.splice(i, 1);
    }
    for (i = this.tanks.length - 1; i >= 0; i--) {
      if (!this.tanks[i].alive) this.tanks.splice(i, 1);
    }

    // engine note follows whoever is driving
    var moving = false, anyPlayer = false;
    for (i = 0; i < this.players.length; i++) {
      var pp = this.players[i];
      if (!pp) continue;
      anyPlayer = true;
      if (pp.moved) moving = true;
    }
    TB.audio.engine(!anyPlayer ? 1 : (moving ? 2 : 1));

    // win / lose
    if (this.state === 'play') {
      if (this.killed >= this.queue.length && this.liveEnemies() === 0) {
        this.beginEnd('clear');
      } else {
        var anyLeft = false;
        for (i = 0; i < this.numPlayers; i++) {
          var ps2 = this.playerState[i];
          if (this.players[i] || (ps2 && !ps2.out)) anyLeft = true;
        }
        if (!anyLeft) this.beginEnd('gameover');
      }
    } else if (this.state === 'ending') {
      if (--this.endTimer <= 0) this.state = 'done';
    }
  };

  /* ---------------- drawing ---------------------------------- */
  Battle.prototype.drawTerrain = function (cx, pass) {
    var waterFrame = Math.floor(this.tick / 12) % 3;
    for (var qy = 0; qy < C.ROWS; qy++) {
      for (var qx = 0; qx < C.COLS; qx++) {
        var v = this.grid[qy * C.COLS + qx];
        if (v === T.EMPTY) continue;
        var img = null;
        if (pass === 'under') {
          if (v === T.BRICK) img = S.brick;
          else if (v === T.STEEL) img = S.steel;
          else if (v === T.WATER) img = S.water[waterFrame];
          else if (v === T.ICE) img = S.ice;
        } else if (v === T.TREES) img = S.trees;
        if (img) cx.drawImage(img, qx * 8, qy * 8);
      }
    }
  };

  Battle.prototype.draw = function (cx) {
    var i;
    var sx = 0, sy = 0;
    if (this.shake > 0) {
      sx = (TB.randInt(3) - 1) * (this.shake > 8 ? 2 : 1);
      sy = (TB.randInt(3) - 1) * (this.shake > 8 ? 2 : 1);
    }

    cx.save();
    cx.beginPath();
    cx.rect(C.FIELD_X, C.FIELD_Y, C.FIELD_W, C.FIELD_H);
    cx.clip();
    cx.translate(C.FIELD_X + sx, C.FIELD_Y + sy);

    cx.fillStyle = '#000000';
    cx.fillRect(-8, -8, C.FIELD_W + 16, C.FIELD_H + 16);

    this.drawTerrain(cx, 'under');

    // the eagle, flashing while a shovel is about to wear off
    cx.drawImage(this.baseAlive ? S.eagle : S.eagleDead, this.baseRect.x, this.baseRect.y);

    for (i = 0; i < this.powerups.length; i++) this.powerups[i].draw(cx);
    for (i = 0; i < this.tanks.length; i++) this.tanks[i].draw(cx);
    for (i = 0; i < this.bullets.length; i++) this.bullets[i].draw(cx);

    this.drawTerrain(cx, 'over');

    for (i = 0; i < this.fx.length; i++) this.fx[i].draw(cx);
    for (i = 0; i < this.popups.length; i++) this.popups[i].draw(cx);

    if (this.freezeTimer > 0 && this.freezeTimer < 120 && ((this.freezeTimer >> 3) & 1)) {
      cx.fillStyle = 'rgba(160,210,255,0.10)';
      cx.fillRect(0, 0, C.FIELD_W, C.FIELD_H);
    }
    cx.restore();

    this.drawPanel(cx);
  };

  Battle.prototype.drawPanel = function (cx) {
    var x = C.PANEL_X;
    var left = Math.max(0, this.queue.length - this.killed);

    cx.fillStyle = TB.PAL.bg;
    cx.fillRect(C.FIELD_X + C.FIELD_W, 0, C.SCREEN_W - (C.FIELD_X + C.FIELD_W), C.SCREEN_H);

    // enemies still to beat
    for (var i = 0; i < left; i++) {
      var col = i % 2, row = (i / 2) | 0;
      cx.drawImage(S.miniTank, x + col * 9, 12 + row * 9);
    }

    var y = 12 + 10 * 9 + 6;
    for (var p = 0; p < this.numPlayers; p++) {
      var st = this.playerState[p];
      var label = p === 0 ? 'IP' : 'IIP';
      TB.font.draw(cx, label, x, y, '#000000', 1);
      cx.drawImage(S.miniTank, x, y + 9);
      TB.font.draw(cx, '' + Math.max(0, st ? st.lives : 0), x + 11, y + 10, '#000000', 1);
      y += 24;
    }

    cx.drawImage(S.flag, x - 2, y + 4);
    // the flag only ever shows a number — long custom names are
    // shown on the intro and score screens instead
    TB.font.draw(cx, '' + this.stageNum, x + 1, y + 20, '#000000', 1);

    if (this.freezeTimer > 0) TB.font.draw(cx, 'FRZ', x - 1, C.SCREEN_H - 20, '#000000', 1);
    if (this.shovelTimer > 0) TB.font.draw(cx, 'SHV', x - 1, C.SCREEN_H - 10, '#000000', 1);
  };

  TB.Battle = Battle;
})(window.TB);
