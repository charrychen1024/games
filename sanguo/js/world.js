/* ============================================================
 * 烽烟录 · 大地图：地图结构、行走、跟随、NPC、镜头、光影
 * ============================================================ */
'use strict';
(function () {
  const T = G.T;
  const TL = (G.TL = { GRASS: 0, TALL: 1, PATH: 2, WATER: 3, FLOOR: 4, WALL: 5, BRIDGE: 6, SOIL: 7 });
  const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  G.DIR = DIR;

  /* ---------------- 地图 ---------------- */
  class GameMap {
    constructor(id, name, w, h, fill) {
      Object.assign(this, { id, name, w, h, seed: 1, under: TL.GRASS, music: 'field', ambient: null, battleBg: 'field', encounters: null, dusk: false });
      this.tiles = new Uint8Array(w * h).fill(fill);
      this.objs = []; this.props = []; this.npcs = []; this.warps = []; this.events = []; this.lights = [];
      this.reserved = new Uint8Array(w * h);
    }
    inb(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
    get(x, y) { return this.inb(x, y) ? this.tiles[y * this.w + x] : TL.WALL; }
    set(x, y, t) { if (this.inb(x, y)) this.tiles[y * this.w + x] = t; }
    rect(x, y, w, h, t) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, t); }
    // 粗线段：沿折线把半径 r 内的格子设成 t（f 可自定义写入规则）
    road(pts, r, t, f) {
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k], [x1, y1] = pts[k + 1];
        const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(len * 3));
        for (let i = 0; i <= n; i++) {
          const px = x0 + (x1 - x0) * i / n, py = y0 + (y1 - y0) * i / n;
          for (let y = Math.floor(py - r - 1); y <= Math.ceil(py + r + 1); y++) for (let x = Math.floor(px - r - 1); x <= Math.ceil(px + r + 1); x++) {
            if (Math.hypot(x - px, y - py) <= r + 0.01) { if (f) f(x, y); else this.set(x, y, t); }
          }
        }
      }
    }
    reserve(x, y, w = 1, h = 1) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (this.inb(i, j)) this.reserved[j * this.w + i] = 1; }
    isReserved(x, y) { return this.inb(x, y) && this.reserved[y * this.w + x] === 1; }
    propAt(x, y) { return this.props.find(p => x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h); }
    canPlace(x, y) {
      if (!this.inb(x, y) || this.isReserved(x, y)) return false;
      const t = this.get(x, y);
      if (!(t === TL.GRASS || t === TL.TALL || t === TL.SOIL)) return false;
      if (this.propAt(x, y)) return false;
      return !this.objs.some(o => o.x === x && o.y === y);
    }
    tree(x, y, kind = 'tree') { if (this.canPlace(x, y)) { this.objs.push({ kind, x, y, v: Math.floor(G.hash(x, y, 77) * 4) }); return true; } return false; }
    prop(type, x, y, w, h, o = {}) { const p = Object.assign({ type, x, y, w, h }, o); if (!p.foot && !p.nofoot) p.foot = [x, y + (o.footTop ?? Math.floor(h * 0.45)), w, h - (o.footTop ?? Math.floor(h * 0.45))]; this.props.push(p); return p; }
    npc(o) { const n = Object.assign({ dir: 'down', wander: 0 }, o); n.x0 = n.x; n.y0 = n.y; this.npcs.push(n); this.reserve(n.x, n.y); return n; }
    warp(x, y, w, h, to, tx, ty, dir, cond, deny) { this.warps.push({ x, y, w, h, to, tx, ty, dir, cond, deny }); this.reserve(x, y, w, h); }
    event(o) { this.events.push(o); }
    finalize() {
      this.block = new Uint8Array(this.w * this.h);
      for (const o of this.objs) this.block[o.y * this.w + o.x] = 1;
      for (const p of this.props) if (p.foot) { const [fx, fy, fw, fh] = p.foot; for (let j = fy; j < fy + fh; j++) for (let i = fx; i < fx + fw; i++) if (this.inb(i, j)) this.block[j * this.w + i] = 1; }
      for (const p of this.props) if (p.light) this.lights.push({ x: p.x * T + T / 2, y: p.y * T + T / 2, r: p.light, seed: p.x * 7 + p.y });
      this.ground = G.art.renderGround(this);
    }
    blockedAt(x, y) { return (this.block && this.block[y * this.w + x] === 1) || this.objs.some(o => o.x === x && o.y === y) || !!this.propAt(x, y); }
    solid(x, y) {
      if (!this.inb(x, y)) return true;
      const t = this.get(x, y);
      if (t === TL.WATER || t === TL.WALL) return true;
      return this.block[y * this.w + x] === 1;
    }
  }
  G.GameMap = GameMap;
  G.MAPS = {};
  G.MAP_BUILDERS = {};
  G.getMap = id => { if (!G.MAPS[id]) { const m = G.MAP_BUILDERS[id](); m.finalize(); G.MAPS[id] = m; } return G.MAPS[id]; };

  /* ---------------- 行走单位 ---------------- */
  function mover(x, y, dir, spec) { return { x, y, px: x, py: y, fx: x, fy: y, prog: 1, moving: false, dir, spec, anim: 0 }; }
  function startMove(u, nx, ny) { u.fx = u.px; u.fy = u.py; u.x = nx; u.y = ny; u.prog = 0; u.moving = true; }
  function stepFrame(u) { if (!u.moving && u.prog >= 1) return 0; return [0, 1, 0, 3][Math.floor(u.anim * 7) % 4]; }

  /* ---------------- 场景 ---------------- */
  class WorldScene {
    constructor() { this.opaque = true; this.time = 0; this.particles = []; this.banner = null; this.cam = { x: 0, y: 0 }; this.cooldown = 0; }

    load(id, x, y, dir) {
      const m = G.getMap(id); this.m = m;
      const s = G.state; s.map = id; s.x = x; s.y = y; s.dir = dir;
      this.party = s.party.map(pid => mover(x, y, dir, G.SPECS[pid]));
      this.lead = this.party[0];
      for (const n of m.npcs) { n.u = mover(n.x0, n.y0, n.dir, G.SPECS[n.spec]); n.wt = 1 + Math.random() * 3; }
      this.banner = { text: m.name, t: 0 };
      this.particles = []; this.stepsSince = 0; this.cooldown = 0; this.autoPending = true;
      G.audio.play(m.music);
      this.snapCamera();
      this.cutscene = false;
      if (m.onEnter) G.run(async () => { await G.wait(0.6); await m.onEnter(); });
    }
    // 过场：队伍按方向序列行走
    async walkParty(dirs) {
      this.cutscene = true;
      for (const d of dirs) {
        if (!this.tryMove(d)) this.lead.dir = d;
        while (this.lead.moving) await G.wait(0.016);
      }
      this.cutscene = false;
      const s = G.state; s.x = this.lead.x; s.y = this.lead.y; s.dir = this.lead.dir;
    }
    // 过场：NPC 按方向序列行走（无视碰撞）
    walkNpc(n, dirs) { return new Promise(res => { n.path = dirs.slice(); n.pathDone = res; }); }
    teleportNpc(n, x, y, dir) { const u = n.u; u.x = u.px = u.fx = x; u.y = u.py = u.fy = y; u.prog = 1; u.moving = false; if (dir) u.dir = dir; }
    refreshParty() {
      const s = G.state, l = this.lead;
      const old = this.party;
      this.party = s.party.map((pid, i) => old[i] && old[i].spec === G.SPECS[pid] ? old[i] : mover(l.x, l.y, l.dir, G.SPECS[pid]));
      this.lead = this.party[0];
    }
    place(i, x, y, dir) { const u = this.party[i]; if (!u) return; u.x = u.px = u.fx = x; u.y = u.py = u.fy = y; u.prog = 1; u.moving = false; u.dir = dir || u.dir; }
    npcById(id) { return this.m.npcs.find(n => n.id === id); }
    visible(n) { return !n.cond || n.cond(); }
    npcAt(x, y) { return this.m.npcs.find(n => this.visible(n) && n.u && n.u.x === x && n.u.y === y); }
    partyAt(x, y) { return this.party.some(u => u.x === x && u.y === y); }

    // ---------- 更新 ----------
    update(dt) {
      this.time += dt;
      if (this.banner) { this.banner.t += dt; if (this.banner.t > 3.6) this.banner = null; }
      const run = G.keys.run && !G.locked();
      const speed = run ? 7.2 : 4.4;
      let arrived = false;
      for (const u of this.party) {
        if (u.moving) {
          u.prog += dt * speed * (u === this.lead ? 1 : Math.max(1, Math.hypot(u.x - u.fx, u.y - u.fy)));
          u.anim += dt * (run ? 1.5 : 1);
          if (u.prog >= 1) { u.prog = 1; u.moving = false; if (u === this.lead) arrived = true; }
          u.px = G.lerp(u.fx, u.x, u.prog); u.py = G.lerp(u.fy, u.y, u.prog);
        }
      }
      this.updateNpcs(dt);
      this.updateParticles(dt);
      if (arrived && !this.cutscene) this.onArrive();
      if (!G.locked() && !this.lead.moving) {
        // 空闲时自动存档（过图、战斗、剧情推进之后）
        if (this.autoPending && !this.cutscene && G.scenes[G.scenes.length - 1] === this) { this.autoPending = false; G.autoSave(); }
        if (G.hit('cancel')) { G.run(() => G.pauseMenu()); return; }
        if (G.hit('ok')) { this.interact(); return; }
        const k = d0 => G.keys[d0] || G.pressed[d0]; // 轻点一下也能走一格
        const d = k('up') ? 'up' : k('down') ? 'down' : k('left') ? 'left' : k('right') ? 'right' : null;
        if (d) this.tryMove(d);
      }
    }
    tryMove(d) {
      const l = this.lead; l.dir = d;
      const nx = l.x + DIR[d][0], ny = l.y + DIR[d][1];
      if (this.m.solid(nx, ny) || this.npcAt(nx, ny)) return false;
      const prev = this.party.map(u => [u.x, u.y]);
      startMove(l, nx, ny);
      for (let i = 1; i < this.party.length; i++) {
        const u = this.party[i], [tx, ty] = prev[i - 1];
        if (u.x === tx && u.y === ty) continue;
        const dx = tx - u.x, dy = ty - u.y;
        u.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
        startMove(u, tx, ty);
      }
      return true;
    }
    onArrive() {
      const s = G.state, l = this.lead, m = this.m;
      s.x = l.x; s.y = l.y; s.dir = l.dir;
      if (this.cooldown > 0) this.cooldown--;
      const inside = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
      const w = m.warps.find(r => inside(r, l.x, l.y));
      if (w && w.cond && !w.cond()) {
        G.run(async () => { await G.narrate(w.deny || '暂时还不能去那里。'); const fx = Math.round(l.fx), fy = Math.round(l.fy); this.party.forEach((u, i) => this.place(i, fx, fy)); s.x = fx; s.y = fy; });
        return;
      }
      if (w) { G.run(() => this.warp(w)); return; }
      const ev = m.events.find(e => e.type === 'step' && inside(e, l.x, l.y) && (!e.cond || e.cond()) && !(e.once && G.flag(e.once)));
      if (ev) { if (ev.once) G.setFlag(ev.once); G.run(ev.run); return; }
      if (this.cooldown <= 0) {
        const ag = m.npcs.find(n => n.aggro && this.visible(n) && Math.abs(n.u.x - l.x) + Math.abs(n.u.y - l.y) <= 1);
        if (ag) { G.run(() => this.talkTo(ag)); return; }
      }
      if (m.encounters) {
        this.stepsSince++;
        const t = m.get(l.x, l.y);
        const rate = m.encounters.rates[t] || 0;
        if (this.stepsSince > 5 && Math.random() < rate) { this.stepsSince = 0; G.run(() => this.randomBattle()); }
      }
    }
    async randomBattle() {
      const groups = this.m.encounters.groups;
      const total = groups.reduce((s, g) => s + (g.w || 1), 0);
      let r = Math.random() * total, grp = groups[0];
      for (const g of groups) { r -= g.w || 1; if (r <= 0) { grp = g; break; } }
      await G.battle(grp.e, { bg: this.m.battleBg });
    }
    async warp(w) {
      G.audio.sfx('warp');
      await G.fadeOut(0.35);
      this.load(w.to, w.tx, w.ty, w.dir);
      await G.wait(0.05);
      await G.fadeIn(0.35);
    }
    facing() { const l = this.lead; return [l.x + DIR[l.dir][0], l.y + DIR[l.dir][1]]; }
    interact() {
      const [tx, ty] = this.facing();
      let n = this.npcAt(tx, ty);
      // 隔着柜台/一格也能和站在建筑门口的人说话
      if (!n) { const [x2, y2] = [tx + DIR[this.lead.dir][0], ty + DIR[this.lead.dir][1]]; const n2 = this.npcAt(x2, y2); if (n2 && n2.far && this.m.solid(tx, ty)) n = n2; }
      if (n) { G.run(() => this.talkTo(n)); return; }
      const ev = this.m.events.find(e => e.type === 'inspect' && tx >= e.x && tx < e.x + e.w && ty >= e.y && ty < e.y + e.h && (!e.cond || e.cond()));
      if (ev) G.run(ev.run);
    }
    async talkTo(n) {
      const l = this.lead;
      const dx = l.x - n.u.x, dy = l.y - n.u.y;
      if (!n.fixedDir) n.u.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      if (n.talk) await n.talk(n);
      if (n.aggro) this.cooldown = 3;
    }

    updateNpcs(dt) {
      const locked = G.locked();
      for (const n of this.m.npcs) {
        const u = n.u; if (!u) continue;
        if (u.moving) {
          u.prog += dt * 2.6; u.anim += dt * 0.8;
          if (u.prog >= 1) { u.prog = 1; u.moving = false; }
          u.px = G.lerp(u.fx, u.x, u.prog); u.py = G.lerp(u.fy, u.y, u.prog);
          continue;
        }
        if (n.path) {
          if (!n.path.length) { const r = n.pathDone; n.path = null; r && r(); continue; }
          const d = n.path.shift(); u.dir = d; startMove(u, u.x + DIR[d][0], u.y + DIR[d][1]); continue;
        }
        if (!n.wander || locked || !this.visible(n)) continue;
        n.wt -= dt;
        if (n.wt > 0) continue;
        n.wt = 1.5 + Math.random() * 3.5;
        const d = G.pick(['up', 'down', 'left', 'right']); u.dir = d;
        const nx = u.x + DIR[d][0], ny = u.y + DIR[d][1];
        if (Math.abs(nx - n.x0) > n.wander || Math.abs(ny - n.y0) > n.wander) continue;
        if (this.m.solid(nx, ny) || this.npcAt(nx, ny) || this.partyAt(nx, ny) || this.m.warps.some(w => nx >= w.x && nx < w.x + w.w && ny >= w.y && ny < w.y + w.h)) continue;
        startMove(u, nx, ny);
      }
    }

    // ---------- 粒子与氛围 ----------
    updateParticles(dt) {
      const a = this.m.ambient;
      if (a === 'petals' && this.particles.length < 46 && Math.random() < dt * 14) {
        this.particles.push({ k: 'petal', x: Math.random() * (G.W + 200) - 100, y: -10, vx: 18 + Math.random() * 22, vy: 22 + Math.random() * 18, r: Math.random() * 6, vr: (Math.random() - 0.5) * 4, s: 2 + Math.random() * 2, life: 30 });
      }
      if (a === 'embers') {
        for (const L of this.m.lights) if (Math.random() < dt * 3) this.particles.push({ k: 'ember', wx: L.x + (Math.random() - 0.5) * 14, wy: L.y + 10, vx: (Math.random() - 0.5) * 10, vy: -25 - Math.random() * 25, life: 1.5 + Math.random(), max: 2.5 });
      }
      if (a === 'snow' && this.particles.length < 90 && Math.random() < dt * 40) {
        this.particles.push({ k: 'snow', x: Math.random() * (G.W + 200) - 100, y: -10, vx: 10 + Math.random() * 15, vy: 30 + Math.random() * 30, r: 0, vr: 0, s: 1 + Math.random() * 2.2, life: 30 });
      }
      if (a === 'leaves' && this.particles.length < 14 && Math.random() < dt * 2) {
        this.particles.push({ k: 'leaf', x: Math.random() * G.W, y: -10, vx: 10 + Math.random() * 20, vy: 18 + Math.random() * 12, r: Math.random() * 6, vr: (Math.random() - 0.5) * 3, s: 2.5, life: 30 });
      }
      for (const p of this.particles) {
        p.life -= dt;
        if (p.k === 'ember') { p.wx += p.vx * dt; p.wy += p.vy * dt; p.vx += Math.sin(this.time * 3 + p.wy * 0.05) * 6 * dt; }
        else { p.x += (p.vx + Math.sin(this.time * 1.7 + p.y * 0.02) * 14) * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
      }
      this.particles = this.particles.filter(p => p.life > 0 && (p.k === 'ember' || p.y < G.H + 20));
    }
    burstPetals(n) {
      for (let i = 0; i < n; i++) this.particles.push({ k: 'petal', x: Math.random() * G.W, y: -20 - Math.random() * 300, vx: 20 + Math.random() * 40, vy: 40 + Math.random() * 40, r: Math.random() * 6, vr: (Math.random() - 0.5) * 6, s: 2 + Math.random() * 2.5, life: 30 });
    }

    snapCamera() {
      const l = this.lead, m = this.m, mw = m.w * T, mh = m.h * T;
      let cx = l.px * T + T / 2 - G.W / 2, cy = l.py * T + T / 2 - G.H / 2;
      cx = mw <= G.W ? (mw - G.W) / 2 : G.clamp(cx, 0, mw - G.W);
      cy = mh <= G.H ? (mh - G.H) / 2 : G.clamp(cy, 0, mh - G.H);
      this.cam.x = cx; this.cam.y = cy;
    }

    // ---------- 绘制 ----------
    draw(c) {
      const m = this.m; if (!m) return;
      this.snapCamera();
      const cx = Math.round(this.cam.x * G.px) / G.px, cy = Math.round(this.cam.y * G.px) / G.px;
      const mw = m.w * T, mh = m.h * T;
      c.fillStyle = m.under === TL.SOIL ? '#2a2018' : '#2c3d1e'; c.fillRect(0, 0, G.W, G.H);
      c.save(); c.translate(-cx, -cy);
      const g = m.ground, R = g.R;
      const sx0 = Math.max(0, cx), sy0 = Math.max(0, cy), sx1 = Math.min(mw, cx + G.W), sy1 = Math.min(mh, cy + G.H);
      if (sx1 > sx0 && sy1 > sy0) c.drawImage(g, sx0 * R, sy0 * R, (sx1 - sx0) * R, (sy1 - sy0) * R, sx0, sy0, sx1 - sx0, sy1 - sy0);
      const tx0 = Math.max(0, Math.floor(cx / T) - 2), ty0 = Math.max(0, Math.floor(cy / T) - 2);
      const tx1 = Math.min(m.w - 1, Math.ceil((cx + G.W) / T) + 2), ty1 = Math.min(m.h - 1, Math.ceil((cy + G.H) / T) + 4);
      this.drawWater(c, tx0, ty0, tx1, ty1);
      // 深度排序
      const list = [];
      for (const o of m.objs) if (o.x >= tx0 - 1 && o.x <= tx1 + 1 && o.y >= ty0 && o.y <= ty1) list.push({ y: (o.y + 1) * T - 0.5, o });
      for (const p of m.props) if ((!p.cond || p.cond()) && p.x + p.w >= tx0 - 3 && p.x <= tx1 + 3 && p.y + p.h >= ty0 && p.y <= ty1 + 3) list.push({ y: (p.y + p.h) * T + (p.sortBias || 0), p });
      for (const n of m.npcs) if (n.u && this.visible(n)) list.push({ y: n.u.py * T + T, u: n.u, n });
      for (let i = this.party.length - 1; i >= 0; i--) list.push({ y: this.party[i].py * T + T + (this.party.length - i) * 0.01, u: this.party[i] });
      list.sort((a, b) => a.y - b.y);
      for (const e of list) {
        if (e.o) { const img = G.art.tree(e.o.kind, e.o.v); c.drawImage(img, e.o.x * T + T / 2 - G.art.TREE_ANCHOR.x, e.o.y * T + T - 2 - G.art.TREE_ANCHOR.y, img.lw, img.lh); }
        else if (e.p) G.art.drawProp(c, e.p, this.time);
        else this.drawUnit(c, e.u, e.n);
      }
      // 余烬（世界坐标）
      for (const p of this.particles) if (p.k === 'ember') {
        const a = Math.min(1, p.life / 0.6);
        c.fillStyle = `rgba(255,${150 + Math.random() * 60 | 0},60,${a})`; c.fillRect(p.wx, p.wy, 2, 2);
      }
      if (m.ambient === 'clouds') this.drawCloudShadows(c, cx, cy);
      c.restore();
      if (m.dusk) this.drawLighting(c, cx, cy);
      else if (m.tint) { c.fillStyle = m.tint; c.fillRect(0, 0, G.W, G.H); }
      for (const p of this.particles) if (p.k !== 'ember') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.r);
        c.fillStyle = p.k === 'petal' ? 'rgba(248,190,208,0.9)' : p.k === 'snow' ? 'rgba(255,255,255,0.9)' : (this.m.leafColor || 'rgba(150,170,70,0.8)');
        c.beginPath(); c.ellipse(0, 0, p.s * 1.5, p.s * 0.8, 0, 0, G.TAU); c.fill();
        c.restore();
      }
      if (m.ambient === 'rain') this.drawRain(c);
      c.drawImage(G.art.vignette(), 0, 0, G.W, G.H);
      this.drawBanner(c);
    }
    drawUnit(c, u, n) {
      c.save(); c.translate(u.px * T + T / 2, u.py * T + T - 5);
      G.art.drawChar(c, u.spec, u.dir, stepFrame(u));
      c.restore();
      if (n && n.marker && n.marker() && !G.locked()) {
        const x = u.px * T + T / 2, y = u.py * T - 30 * (u.spec.size || 1) + Math.sin(this.time * 4) * 3;
        c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(x, y + 2, 9, 9, 0, 0, G.TAU); c.fill();
        c.fillStyle = '#f2c94c'; c.beginPath(); c.ellipse(x, y, 9, 9, 0, 0, G.TAU); c.fill();
        c.strokeStyle = '#7a4a10'; c.lineWidth = 1.5; c.stroke();
        G.text(c, '!', x, y + 1, { size: 15, bold: true, align: 'center', color: '#5a2a0a' });
      }
      if (n && n.aggro && !G.locked()) {
        const d = Math.abs(n.u.x - this.lead.x) + Math.abs(n.u.y - this.lead.y);
        if (d <= 3) {
          const x = u.px * T + T / 2, y = u.py * T - 32 * (u.spec.size || 1) + Math.sin(this.time * 8) * 2;
          G.text(c, '！', x, y, { size: 22, bold: true, align: 'center', color: '#ff5a3a', stroke: '#2a0a05', sw: 4 });
        }
      }
    }
    drawRain(c) {
      const t = this.time;
      c.fillStyle = 'rgba(20,28,40,0.28)'; c.fillRect(0, 0, G.W, G.H);
      c.strokeStyle = 'rgba(190,210,230,0.35)'; c.lineWidth = 1.2; c.beginPath();
      for (let i = 0; i < 140; i++) {
        const sp = 600 + (i % 7) * 60, x = ((i * 137.5 + t * 120) % (G.W + 100)) - 50, y = ((i * 89.3 + t * sp) % (G.H + 60)) - 30;
        c.moveTo(x, y); c.lineTo(x - 5, y + 16);
      }
      c.stroke();
      if (this.m.lightning) {
        const ph = (t % 9);
        if (ph < 0.12 || (ph > 0.22 && ph < 0.3)) { c.fillStyle = 'rgba(230,235,255,0.35)'; c.fillRect(0, 0, G.W, G.H); }
      }
    }
    drawWater(c, x0, y0, x1, y1) {
      const m = this.m, t = this.time;
      c.save(); c.lineCap = 'round';
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        if (m.get(x, y) !== TL.WATER) continue;
        const h = G.hash(x, y, 4);
        for (let k = 0; k < 2; k++) {
          const ph = t * 1.2 + h * 10 + k * 3.1, a = (Math.sin(ph) + 1) / 2;
          c.strokeStyle = `rgba(220,240,255,${0.08 + a * 0.22})`; c.lineWidth = 1.4;
          const px = x * T + 8 + ((h * 97 + k * 23) % 30), py = y * T + 12 + k * 18 + Math.sin(ph * 0.7) * 2;
          c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + 5, py - 2, px + 10 + a * 4, py); c.stroke();
        }
      }
      c.restore();
    }
    drawCloudShadows(c, cx, cy) {
      const t = this.time;
      for (let i = 0; i < 5; i++) {
        const span = this.m.w * T + 800;
        const x = ((i * 977 + t * 22) % span) - 400, y = (i * 613) % (this.m.h * T);
        if (x + 300 < cx || x - 300 > cx + G.W || y + 200 < cy || y - 200 > cy + G.H) continue;
        const g = c.createRadialGradient(x, y, 20, x, y, 260);
        g.addColorStop(0, 'rgba(10,20,30,0.16)'); g.addColorStop(1, 'rgba(10,20,30,0)');
        c.fillStyle = g; c.beginPath(); c.ellipse(x, y, 300, 170, 0.3, 0, G.TAU); c.fill();
      }
    }
    drawLighting(c, cx, cy) {
      if (!this.lightCv) { this.lightCv = G.makeCanvas(G.W / 2, G.H / 2); }
      const lc = this.lightCv, x = lc.getContext('2d');
      x.setTransform(0.5, 0, 0, 0.5, 0, 0);
      x.globalCompositeOperation = 'source-over';
      x.clearRect(0, 0, G.W, G.H);
      x.fillStyle = 'rgba(18,10,34,0.6)'; x.fillRect(0, 0, G.W, G.H);
      x.globalCompositeOperation = 'destination-out';
      const lights = this.m.lights.slice();
      lights.push({ x: this.lead.px * T + T / 2, y: this.lead.py * T + T / 2, r: 120, seed: 0 });
      for (const L of lights) {
        const lx = L.x - cx, ly = L.y - cy, r = L.r * (1 + Math.sin(this.time * 7 + L.seed) * 0.04 + Math.sin(this.time * 11.3 + L.seed) * 0.03);
        if (lx < -r || ly < -r || lx > G.W + r || ly > G.H + r) continue;
        const g = x.createRadialGradient(lx, ly, 0, lx, ly, r);
        g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.5, 'rgba(0,0,0,0.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(lx, ly, r, 0, G.TAU); x.fill();
      }
      c.drawImage(lc, 0, 0, G.W, G.H);
      c.save(); c.globalCompositeOperation = 'lighter';
      for (const L of this.m.lights) {
        const lx = L.x - cx, ly = L.y - cy, r = L.r * 0.8;
        if (lx < -r || ly < -r || lx > G.W + r || ly > G.H + r) continue;
        const g = c.createRadialGradient(lx, ly, 0, lx, ly, r);
        g.addColorStop(0, `rgba(255,140,50,${0.22 + Math.sin(this.time * 9 + L.seed) * 0.03})`); g.addColorStop(1, 'rgba(255,100,30,0)');
        c.fillStyle = g; c.beginPath(); c.arc(lx, ly, r, 0, G.TAU); c.fill();
      }
      c.restore();
      // 暮色
      const gr = c.createLinearGradient(0, 0, 0, G.H); gr.addColorStop(0, 'rgba(120,50,90,0.12)'); gr.addColorStop(1, 'rgba(255,120,60,0.06)');
      c.fillStyle = gr; c.fillRect(0, 0, G.W, G.H);
    }
    drawBanner(c) {
      const b = this.banner; if (!b) return;
      const t = b.t, a = t < 0.5 ? t / 0.5 : t > 2.9 ? Math.max(0, (3.6 - t) / 0.7) : 1;
      c.save(); c.globalAlpha = a;
      const cxx = G.W / 2, y = 64;
      const g = c.createLinearGradient(cxx - 220, 0, cxx + 220, 0);
      g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(0.25, 'rgba(10,6,4,0.72)'); g.addColorStop(0.75, 'rgba(10,6,4,0.72)'); g.addColorStop(1, 'rgba(10,6,4,0)');
      c.fillStyle = g; c.fillRect(cxx - 220, y - 30, 440, 60);
      c.strokeStyle = 'rgba(217,180,106,0.6)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(cxx - 160, y - 30); c.lineTo(cxx + 160, y - 30); c.moveTo(cxx - 160, y + 30); c.lineTo(cxx + 160, y + 30); c.stroke();
      const chars = [...b.text], sp = chars.length > 4 ? 4 : 14, size = chars.length > 4 ? 28 : 32, tw = chars.length * (size + sp) - sp;
      chars.forEach((ch, i) => G.text(c, ch, cxx - tw / 2 + i * (size + sp) + size / 2, y + 1, { size, bold: true, align: 'center', color: '#f3e2b4', shadow: 'rgba(0,0,0,0.7)' }));
      c.restore();
    }
  }
  G.WorldScene = WorldScene;
})();
