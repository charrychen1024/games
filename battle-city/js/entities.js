/* ===========================================================
 * Tanks, bullets, power-ups and FX.
 * =========================================================== */
(function (TB) {
  'use strict';

  var C = TB.C, T = TB.T, D = TB.D, DX = TB.DX, DY = TB.DY;
  var S = TB.sprites;

  /* ---------------------------------------------------------- *
   * Bullet
   * ---------------------------------------------------------- */
  function Bullet(battle, owner, x, y, dir, speed, power) {
    this.b = battle;
    this.owner = owner;
    this.fromPlayer = owner.isPlayer;
    this.playerIndex = owner.playerIndex;
    this.x = x; this.y = y;
    this.w = C.BULLET; this.h = C.BULLET;
    this.dir = dir;
    this.speed = speed;
    this.power = !!power;       // can shatter steel
    this.dead = false;
  }

  Bullet.prototype.rect = function () { return this; };

  Bullet.prototype.update = function () {
    var left = this.speed;
    while (left > 0 && !this.dead) {
      var step = Math.min(2, left);
      left -= step;
      this.x += DX[this.dir] * step;
      this.y += DY[this.dir] * step;
      this.b.resolveBullet(this);
    }
  };

  Bullet.prototype.draw = function (cx) {
    var x = Math.round(this.x), y = Math.round(this.y);
    cx.fillStyle = '#f0f0f0';
    // a 3x4 slug pointing the way it travels
    if (this.dir === D.UP || this.dir === D.DOWN) {
      cx.fillRect(x + 1, y, 2, 4);
      cx.fillRect(x, y + 1, 4, 2);
    } else {
      cx.fillRect(x, y + 1, 4, 2);
      cx.fillRect(x + 1, y, 2, 4);
    }
  };

  /* ---------------------------------------------------------- *
   * Tank
   * ---------------------------------------------------------- */
  function Tank(battle, cfg) {
    this.b = battle;
    this.isPlayer = !!cfg.isPlayer;
    this.playerIndex = cfg.playerIndex || 0;
    this.type = cfg.type || 0;
    this.x = cfg.x; this.y = cfg.y;
    this.w = C.TANK; this.h = C.TANK;
    this.dir = this.isPlayer ? D.UP : D.DOWN;
    this.alive = true;
    this.dead = false;

    this.level = cfg.level || 0;        // players only
    this.bonus = !!cfg.bonus;           // enemy carries a power-up
    this.activeBullets = 0;
    this.fireCooldown = 0;
    this.treadPhase = 0;
    this.moved = false;
    this.shield = 0;
    this.frozen = 0;
    this.spawnTimer = C.SPAWN_BLINK_TIME;
    this.slideTimer = 0;
    this.slideDir = this.dir;
    this.flashPhase = 0;

    // AI
    this.aiTimer = 0;
    this.aiDir = this.dir;
    this.fireTimer = 0;
    this.blockedFrames = 0;

    if (this.isPlayer) {
      this.speed = 1.12;
      this.hp = 1; this.maxHp = 1;
      this.applyLevel();
    } else {
      var def = TB.ENEMY_DEF[this.type];
      this.speed = def.speed;
      this.bulletSpeed = def.bullet;
      this.maxBullets = 1;
      this.bulletPower = false;
      this.hp = def.hp; this.maxHp = def.hp;
    }
  }

  Tank.prototype.applyLevel = function () {
    this.bulletSpeed = this.level >= 1 ? 4.1 : 2.6;
    this.maxBullets = this.level >= 2 ? 2 : 1;
    this.bulletPower = this.level >= 3;
  };

  Tank.prototype.centerX = function () { return this.x + this.w / 2; };
  Tank.prototype.centerY = function () { return this.y + this.h / 2; };

  Tank.prototype.spriteSet = function () {
    if (this.isPlayer) {
      return S.tank(S.PLAYER_ART[TB.clamp(this.level, 0, 3)],
                    this.playerIndex === 1 ? 'p2' : 'p1');
    }
    var def = TB.ENEMY_DEF[this.type];
    if (this.bonus && ((this.flashPhase >> 3) & 1)) {
      return S.tank(def.art, 'bonusA');
    }
    var pal = def.art;
    if (this.type === TB.ENEMY.ARMOR) {
      pal = 'armor' + TB.clamp(this.hp, 1, 4);
    }
    return S.tank(def.art, pal);
  };

  /* --- movement ------------------------------------------------ */
  Tank.prototype.tryMove = function (dir) {
    if (dir < 0) { this.moved = false; return false; }
    if (dir !== this.dir) {
      // snap to the 8px lattice on the new perpendicular axis,
      // which is what makes gaps lineable-up like the original
      if (dir === D.UP || dir === D.DOWN) this.x = TB.snap8(this.x);
      else this.y = TB.snap8(this.y);
      this.dir = dir;
    }
    var nx = this.x + DX[dir] * this.speed;
    var ny = this.y + DY[dir] * this.speed;
    if (this.b.canPlaceTank(nx, ny, this)) {
      this.x = nx; this.y = ny;
      this.moved = true;
      this.blockedFrames = 0;
      this.treadPhase += this.speed;
      return true;
    }
    this.moved = false;
    this.blockedFrames++;
    return false;
  };

  Tank.prototype.onIce = function () {
    return this.b.terrainUnder(this) === T.ICE;
  };

  Tank.prototype.fire = function () {
    if (this.activeBullets >= this.maxBullets || this.fireCooldown > 0) return false;
    var cx = this.centerX(), cy = this.centerY();
    var bx = cx - C.BULLET / 2 + DX[this.dir] * 8;
    var by = cy - C.BULLET / 2 + DY[this.dir] * 8;
    var bullet = new Bullet(this.b, this, bx, by, this.dir, this.bulletSpeed, this.bulletPower);
    this.b.bullets.push(bullet);
    this.activeBullets++;
    this.fireCooldown = 6;
    if (this.isPlayer) TB.audio.fire();
    return true;
  };

  /* --- per-frame ---------------------------------------------- */
  Tank.prototype.update = function () {
    this.flashPhase++;
    if (this.fireCooldown > 0) this.fireCooldown--;
    if (this.shield > 0) this.shield--;
    if (this.spawnTimer > 0) { this.spawnTimer--; return; }
    if (this.frozen > 0) { this.frozen--; this.moved = false; return; }

    if (this.isPlayer) this.updatePlayer();
    else this.updateEnemy();

    // ice carries you on a little after you let go
    if (this.onIce()) {
      if (this.moved) { this.slideTimer = 10; this.slideDir = this.dir; }
      else if (this.slideTimer > 0) {
        this.slideTimer--;
        var keep = this.dir;
        this.dir = this.slideDir;
        var nx = this.x + DX[this.dir] * this.speed * 0.8;
        var ny = this.y + DY[this.dir] * this.speed * 0.8;
        if (this.b.canPlaceTank(nx, ny, this)) { this.x = nx; this.y = ny; this.treadPhase += 0.5; }
        else this.slideTimer = 0;
        this.dir = keep;
      }
    } else this.slideTimer = 0;
  };

  Tank.prototype.updatePlayer = function () {
    var idx = this.playerIndex;
    var dir = TB.input.playerDir(idx);
    this.tryMove(dir);
    if (TB.input.playerFire(idx)) this.fire();
  };

  Tank.prototype.updateEnemy = function () {
    var b = this.b;
    if (b.freezeTimer > 0) { this.moved = false; return; }

    if (this.aiTimer > 0) this.aiTimer--;
    if (this.aiTimer <= 0 || this.blockedFrames > 4) {
      this.aiDir = this.chooseDir();
      this.aiTimer = 24 + TB.randInt(56);
      this.blockedFrames = 0;
    }
    this.tryMove(this.aiDir);

    var def = TB.ENEMY_DEF[this.type];
    if (this.fireTimer > 0) this.fireTimer--;
    var p = def.fireRate;
    if (this.hasShot()) p *= 5;
    if (this.fireTimer <= 0 && TB.chance(p)) {
      if (this.fire()) this.fireTimer = 18 + TB.randInt(24);
    }
  };

  /* pick a heading: mostly toward a target, sometimes pure wander */
  Tank.prototype.chooseDir = function () {
    var b = this.b;
    var opts = [];
    var i;
    for (i = 0; i < 4; i++) {
      if (b.canPlaceTank(this.x + DX[i] * 8, this.y + DY[i] * 8, this)) opts.push(i);
    }
    if (!opts.length) return TB.randInt(4);

    if (TB.chance(0.62)) {
      var tgt = this.pickTarget();
      if (tgt) {
        var dx = tgt.x - this.centerX(), dy = tgt.y - this.centerY();
        var want = [];
        if (Math.abs(dx) > Math.abs(dy)) {
          want = [dx > 0 ? D.RIGHT : D.LEFT, dy > 0 ? D.DOWN : D.UP];
        } else {
          want = [dy > 0 ? D.DOWN : D.UP, dx > 0 ? D.RIGHT : D.LEFT];
        }
        for (i = 0; i < want.length; i++) {
          if (opts.indexOf(want[i]) >= 0) return want[i];
        }
      }
    }
    // avoid instantly reversing unless there is no choice
    var fwd = opts.filter(function (d) { return d !== TB.OPPOSITE[this.dir]; }, this);
    return TB.pick(fwd.length ? fwd : opts);
  };

  Tank.prototype.pickTarget = function () {
    var b = this.b;
    if (TB.chance(0.45) && b.baseAlive) {
      return { x: b.baseRect.x + 8, y: b.baseRect.y + 8 };
    }
    var best = null, bd = 1e9;
    for (var i = 0; i < b.players.length; i++) {
      var p = b.players[i];
      if (!p || !p.alive || p.spawnTimer > 0) continue;
      var dx = p.centerX() - this.centerX(), dy = p.centerY() - this.centerY();
      var d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = p; }
    }
    if (best) return { x: best.centerX(), y: best.centerY() };
    if (b.baseAlive) return { x: b.baseRect.x + 8, y: b.baseRect.y + 8 };
    return null;
  };

  /* is a player or the base lined up in front of us? */
  Tank.prototype.hasShot = function () {
    var b = this.b;
    var cx = this.centerX(), cy = this.centerY();
    var vert = (this.dir === D.UP || this.dir === D.DOWN);
    var sign = DX[this.dir] + DY[this.dir];
    var i, t;
    var targets = [];
    for (i = 0; i < b.players.length; i++) {
      var p = b.players[i];
      if (p && p.alive && p.spawnTimer <= 0) targets.push({ x: p.centerX(), y: p.centerY() });
    }
    if (b.baseAlive) targets.push({ x: b.baseRect.x + 8, y: b.baseRect.y + 8 });
    for (i = 0; i < targets.length; i++) {
      t = targets[i];
      var along = vert ? (t.y - cy) : (t.x - cx);
      var across = vert ? (t.x - cx) : (t.y - cy);
      if (Math.abs(across) < 10 && along * sign > 0) return true;
    }
    return false;
  };

  /* returns true when the tank actually died */
  Tank.prototype.takeHit = function (bullet) {
    if (this.spawnTimer > 0) return false;
    if (this.shield > 0) { TB.audio.bulletHit(); return false; }

    if (this.isPlayer) {
      // friendly fire just stuns, exactly like the arcade co-op
      if (bullet.fromPlayer && bullet.playerIndex !== this.playerIndex) {
        this.frozen = 180;
        TB.audio.hitArmor();
        return false;
      }
      if (bullet.fromPlayer) return false;
      this.alive = false;
      return true;
    }

    if (!bullet.fromPlayer) return false;   // enemies never hurt each other
    this.hp--;
    if (this.hp > 0) { TB.audio.hitArmor(); return false; }
    this.alive = false;
    return true;
  };

  Tank.prototype.draw = function (cx) {
    var x = Math.round(this.x), y = Math.round(this.y);
    if (this.spawnTimer > 0) {
      var f = Math.floor((C.SPAWN_BLINK_TIME - this.spawnTimer) / 4) % 4;
      cx.drawImage(S.spawnFx[f], x, y);
      return;
    }
    var set = this.spriteSet();
    var frame = (Math.floor(this.treadPhase / 3) % 2);
    cx.drawImage(set[this.dir][frame], x, y);
    if (this.shield > 0) {
      // blink out over the last second
      if (this.shield > 60 || ((this.shield >> 2) & 1)) {
        cx.drawImage(S.shield[(this.flashPhase >> 1) & 1], x, y);
      }
    }
    if (this.frozen > 0 && this.isPlayer && ((this.flashPhase >> 2) & 1)) {
      cx.fillStyle = 'rgba(120,180,255,0.45)';
      cx.fillRect(x, y, 16, 16);
    }
  };

  /* ---------------------------------------------------------- *
   * PowerUp
   * ---------------------------------------------------------- */
  function PowerUp(kind, x, y) {
    this.kind = kind;
    this.x = x; this.y = y;
    this.w = 16; this.h = 16;
    this.life = C.POWERUP_LIFETIME;
    this.phase = 0;
    this.dead = false;
  }
  PowerUp.prototype.update = function () {
    this.phase++;
    if (--this.life <= 0) this.dead = true;
  };
  PowerUp.prototype.draw = function (cx) {
    // blink while it's alive, faster as it's about to expire
    var rate = this.life < 240 ? 4 : 16;
    if (Math.floor(this.phase / rate) % 2 === 0 || this.life >= 240) {
      cx.drawImage(S.powerups[this.kind], this.x, this.y);
    }
  };

  /* ---------------------------------------------------------- *
   * Explosion / score popup
   * ---------------------------------------------------------- */
  function Explosion(x, y, big) {
    this.big = big;
    var frames = big ? S.expBig : S.expSmall;
    this.frames = frames;
    this.size = big ? 32 : 16;
    this.x = x - this.size / 2;
    this.y = y - this.size / 2;
    this.t = 0;
    this.hold = big ? 6 : 4;
    this.dead = false;
  }
  Explosion.prototype.update = function () {
    this.t++;
    if (this.t >= this.hold * this.frames.length) this.dead = true;
  };
  Explosion.prototype.draw = function (cx) {
    var i = Math.min(this.frames.length - 1, Math.floor(this.t / this.hold));
    cx.drawImage(this.frames[i], Math.round(this.x), Math.round(this.y));
  };

  function Popup(text, x, y) {
    this.text = '' + text;
    this.x = x; this.y = y;
    this.t = 0;
    this.dead = false;
  }
  Popup.prototype.update = function () { if (++this.t > 54) this.dead = true; };
  Popup.prototype.draw = function (cx) {
    TB.font.drawCentered(cx, this.text, this.x, this.y - Math.floor(this.t / 9), '#ffffff', 1);
  };

  TB.Bullet = Bullet;
  TB.Tank = Tank;
  TB.PowerUp = PowerUp;
  TB.Explosion = Explosion;
  TB.Popup = Popup;
})(window.TB);
