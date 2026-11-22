/* ============================================================
 * 烽烟录 · 回合制战斗
 * 兵力即血量，兵力越少攻击越弱；全军共用策略值。
 * ============================================================ */
'use strict';
(function () {
  const UI = G.ui;
  const ENEMY_SLOTS = {
    1: [[260, 300]],
    2: [[290, 250], [220, 335]],
    3: [[300, 225], [195, 288], [305, 348]],
    4: [[310, 222], [200, 258], [320, 318], [205, 350]],
    5: [[320, 212], [200, 240], [330, 290], [190, 320], [300, 350]],
  };

  // 敌军旗号：黄巾用黄旗，其余按阵营（军旗颜色）显示
  const FACTION = { '#24304a': '曹', '#a8322a': '吴', '#8a1e1e': '吕' };
  function enemyFlag(u) {
    if (u._flag) return u._flag;
    const sp = u.spec || {}, b = sp.banner || '#d9a92e';
    const yellow = sp.hat === 'turban' || /^#[cdef][0-9a-f][89ab]/i.test(b) || !sp.banner;
    let text = sp.flag || FACTION[b] || (yellow ? '黄' : (u.name || '敌')[0]);
    const col = yellow && !sp.flag ? (u.boss ? '#c9962a' : '#d9a92e') : b;
    const lum = (() => { const n = parseInt(col.slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) / 255; })();
    return (u._flag = { text, col, tcol: lum > 0.55 ? '#5a1e0a' : '#f6e7c1' });
  }

  G.battle = async function (enemyIds, opts = {}) {
    const prevMusic = G.audio.current();
    const snap = JSON.stringify(G.state);   // 战前快照：战败后可“重新挑战”
    let res;
    while (true) {
      G.audio.sfx('encounter');
      G.state.battles = (G.state.battles || 0) + 1;
      await G.fadeTo(0.85, 0.08, '#fff');
      await G.fadeTo(0, 0.1);
      await G.fadeTo(1, 0.28, '#000');
      const b = new BattleScene(enemyIds, opts);
      G.pushScene(b);
      G.audio.play(opts.boss ? 'boss' : 'battle');
      G.fadeIn(0.35);
      res = await b.run();
      if (res !== 'lose') break;
      // 战败：可重新挑战（恢复到战前状态）、读档或返回标题
      await G.fadeOut(0.6);
      G.popScene();
      const choice = await G.defeat();
      if (choice !== 'retry') return new Promise(() => {});
      await G.fadeOut(0.4);
      G.popScene();
      G.state = JSON.parse(snap);
      if (G.world && G.world.refreshParty) G.world.refreshParty();
    }
    await G.fadeOut(0.4);
    G.popScene();
    G.audio.play(prevMusic || (G.world.m && G.world.m.music));
    if (G.world) G.world.autoPending = true;
    await G.fadeIn(0.4);
    return res;
  };

  class BattleScene {
    constructor(ids, o) {
      this.opaque = true; this.o = o; this.t = 0; this.intro = 0;
      this.bg = G.art.battleBg(o.bg || 'field');
      this.cfg = G.art.BG[o.bg || 'field'] || G.art.BG.field;
      const pids = (o.party || G.state.party).filter(id => G.state.members[id]);
      this.party = pids.map((id, i) => this.makeHero(id, i, pids.length));
      G.state.sp = Math.min(G.state.sp, G.maxSP());
      const bi = ids.findIndex(id => G.ENEMIES[id].boss);
      if (bi > 0) ids = [ids[bi]].concat(ids.filter((_, i) => i !== bi));
      const slots = bi >= 0 ? [[300, 300], [150, 200], [118, 356], [400, 210], [40, 280]] : ENEMY_SLOTS[Math.min(5, ids.length)];
      this.slots = slots.concat(ENEMY_SLOTS[5].filter(s => !slots.some(q => q[0] === s[0] && q[1] === s[1])));
      this.enemies = ids.map((id, i) => this.makeEnemy(id, slots[i]));
      this.floats = []; this.fx = []; this.cursor = null; this.banner = null; this.msg = null; this.active = null;
      this.embers = [];
    }
    makeHero(id, i, n) {
      const st = G.stats(id), m = G.state.members[id];
      return { id, side: 'p', name: G.HEROES[id].name, spec: G.SPECS[id], hp: m.hp, maxhp: st.maxhp, atk: st.str * 1.6 + st.wpow + st.lvl * 3, int: st.int, spd: st.spd, def: st.def, crit: st.crit, lvl: st.lvl,
        x: n > 5 ? 660 + i * 42 : n > 4 ? 668 + i * 46 : 680 + i * 52, y: n > 5 ? 206 + i * 37 : n > 4 ? 214 + i * 43 : 228 + i * 50, ox: 0, oy: 0, alive: m.hp > 0, buff: 0, defending: false, hurt: 0, alpha: 1, flash: 0 };
    }
    makeEnemy(id, slot) {
      const e = G.ENEMIES[id];
      return { id, side: 'e', def0: e, name: e.name, spec: G.SPECS[e.spec || id], hp: e.hp, maxhp: e.hp, atk: e.str * 2.2, int: e.int, spd: e.spd, def: e.def, crit: 0.05, lvl: 1, boss: !!e.boss,
        x: slot[0], y: slot[1], ox: 0, oy: 0, alive: true, buff: 0, defending: false, hurt: 0, alpha: 1, flash: 0 };
    }
    get all() { return this.party.concat(this.enemies); }

    // ---------- 流程 ----------
    async run() {
      await G.tween(this, { intro: 1 }, 0.7, G.easeOut);
      const names = [...new Set(this.enemies.map(e => e.name))].join('、');
      await this.say(this.o.intro || `${names} 杀到！`, 1.0);
      while (true) {
        const cmds = await this.inputPhase();
        if (cmds === 'flee') {
          if (!this.o.boss && Math.random() < this.fleeChance()) { G.audio.sfx('warp'); await this.say('全军撤退！', 0.8); this.syncBack(false); return 'flee'; }
          await this.say(this.o.boss ? '敌将拦住去路，无法撤退！' : '撤退失败！', 0.9);
          await this.execRound([]);
        } else await this.execRound(cmds);
        if (this.enemies.every(e => !e.alive) || this.enemies.some(e => e.fled)) { await this.victory(); return 'win'; }
        if (this.party.every(p => !p.alive)) { await this.defeat(); return 'lose'; }
      }
    }
    fleeChance() {
      const ps = this.party.filter(p => p.alive).reduce((s, p) => s + p.spd, 0) / Math.max(1, this.party.filter(p => p.alive).length);
      const es = this.enemies.filter(p => p.alive).reduce((s, p) => s + p.spd, 0) / Math.max(1, this.enemies.filter(p => p.alive).length);
      return G.clamp(0.55 + (ps - es) / 80, 0.25, 0.95);
    }
    async say(text, dur) { this.msg = { text, t: 0 }; await G.wait(dur); }
    spAvail(cmds) { return G.state.sp - cmds.filter(c => c.type === 'skill').reduce((s, c) => s + G.SKILLS[c.skill].cost, 0); }
    itemAvail(id, cmds) { return (G.state.items[id] || 0) - cmds.filter(c => c.type === 'item' && c.item === id).length; }

    async inputPhase() {
      const alive = this.party.filter(p => p.alive), cmds = [];
      let i = 0;
      this.msg = null;
      while (i < alive.length) {
        const u = alive[i]; this.active = u;
        if (G.autoAI) { const ac = G.autoAI(u, this, cmds); if (ac) { cmds.push(ac); i++; await G.wait(0.05); continue; } }
        const sks = G.skillsOf(u.id);
        const itemIds = Object.keys(G.state.items).filter(k => this.itemAvail(k, cmds) > 0 && G.ITEMS[k].type !== 'armor');
        const k = await G.menu({
          x: 445, w: 190, bottom: G.H - 150, rowH: 34, size: 20, idx: 0, title: u.name,
          items: [{ label: '攻击' }, { label: '策略', disabled: !sks.length }, { label: '道具', disabled: !itemIds.length }, { label: '防御' }, this.o.boss ? { label: '无法撤退', disabled: true } : { label: '撤退' }],
          cancel: i > 0,
        });
        if (k === -1) { i--; cmds.pop(); continue; }
        let cmd = null;
        if (k === 0) { const t = await this.pickTarget('enemy'); if (t) cmd = { type: 'attack', u, t }; }
        else if (k === 1) {
          const avail = this.spAvail(cmds);
          const j = await G.menu({
            x: 395, w: 330, bottom: G.H - 236, rowH: 32, size: 20, title: `策略值 ${avail}`, rows: 5,
            items: sks.map(s => ({ label: G.SKILLS[s].name, right: G.SKILLS[s].cost + '', disabled: G.SKILLS[s].cost > avail })),
            // 选中项的作用：目标范围 + 说明（菜单上移，说明框落在状态栏上方）
            desc: i => { const s = G.SKILLS[sks[i]], tg = { enemy: '敌方一人', enemies: '敌方全体', ally: '我方一人', allies: '我方全体', self: '自身', dead: '阵亡部将' }[s.target] || ''; return (tg ? `【${tg}】` : '') + (s.desc || ''); },
          });
          if (j >= 0) { const sk = G.SKILLS[sks[j]]; const t = await this.pickTarget(sk.target); if (t) cmd = { type: 'skill', u, skill: sks[j], t }; }
        } else if (k === 2) {
          const j = await G.menu({
            x: 425, w: 250, bottom: G.H - 150, rowH: 34, size: 20, title: '道具',
            items: itemIds.map(id => ({ label: G.ITEMS[id].name, right: '×' + this.itemAvail(id, cmds) })),
          });
          if (j >= 0) {
            const it = G.ITEMS[itemIds[j]];
            const t = it.type === 'heal' ? await this.pickTarget('ally') : it.type === 'revive' ? await this.pickTarget('dead') : this.party.filter(p => p.alive);
            if (t) cmd = { type: 'item', u, item: itemIds[j], t };
          }
        } else if (k === 3) cmd = { type: 'defend', u };
        else if (k === 4) { this.active = null; return 'flee'; }
        if (cmd) { cmds.push(cmd); i++; }
      }
      this.active = null;
      return cmds;
    }
    pickTarget(kind) {
      return new Promise(res => {
        const enemy = kind === 'enemy' || kind === 'enemies';
        const list = kind === 'dead' ? this.party.filter(u => !u.alive) : (enemy ? this.enemies : this.party).filter(u => u.alive);
        if (kind === 'self') { res(this.active); return; }
        if (!list.length) { this.msg = { text: kind === 'dead' ? '没有需要救治的部将。' : '没有目标。', t: 0 }; res(null); return; }
        this.cursor = { list: list.sort((a, b) => a.y - b.y), idx: 0, all: kind === 'enemies' || kind === 'allies', res };
      });
    }

    async execRound(cmds) {
      for (const e of this.enemies) if (e.alive) {
        const n = e.boss && !e.def0.noDouble && e.hp < e.maxhp * 0.5 ? 2 : 1;
        for (let k = 0; k < n; k++) cmds.push(this.enemyAI(e));
      }
      for (const c of cmds) c.ini = c.type === 'defend' ? 9999 : c.u.spd * G.rnd(0.75, 1.25);
      cmds.sort((a, b) => b.ini - a.ini);
      for (const c of cmds) if (c.type === 'defend') c.u.defending = true;
      for (const c of cmds) {
        if (!c.u.alive || c.type === 'defend') continue;
        if (this.enemies.every(e => !e.alive) || this.enemies.some(e => e.fled) || this.party.every(p => !p.alive)) break;
        await this.perform(c);
        await G.wait(0.12);
      }
      for (const u of this.all) { u.defending = false; if (u.buff > 0) u.buff--; }
    }
    enemyAI(e) {
      const d = e.def0;
      if (d.skills && Math.random() < d.skillRate) {
        const s = G.pick(d.skills), sk = G.SKILLS[s];
        const room = this.enemies.filter(x => x.alive).length < 5;
        if (!(sk.type === 'buff' && e.buff > 0) && !(sk.type === 'summon' && !room)) return { type: 'skill', u: e, skill: s, t: sk.target === 'enemies' ? this.party : sk.target === 'self' ? e : null };
      }
      return { type: 'attack', u: e, t: null };
    }
    opponents(u) { return (u.side === 'p' ? this.enemies : this.party).filter(x => x.alive); }
    retarget(u, t) {
      if (t && t.alive) return t;
      const opp = this.opponents(u); if (!opp.length) return null;
      if (u.side === 'e') { // 敌方更爱打残血
        const w = opp.map(p => 1 + (1 - p.hp / p.maxhp));
        let r = Math.random() * w.reduce((a, b) => a + b, 0);
        for (let i = 0; i < opp.length; i++) { r -= w[i]; if (r <= 0) return opp[i]; }
      }
      return G.pick(opp);
    }

    async perform(c) {
      const u = c.u;
      if (c.type === 'attack') {
        const t = this.retarget(u, c.t); if (!t) return;
        await this.lunge(u, t, async () => { const r = this.physDmg(u, t, 1); this.slash(t, r.crit); await this.damage(t, r.d, r.crit); });
      } else if (c.type === 'skill') {
        const sk = G.SKILLS[c.skill];
        if (u.side === 'p') {
          if (G.state.sp < sk.cost) { await this.say('策略值不足！', 0.7); return; }
          G.state.sp -= sk.cost;
        }
        this.banner = { text: sk.name, t: 0, side: u.side };
        let targets;
        if (sk.target === 'enemy') { const t = this.retarget(u, Array.isArray(c.t) ? null : c.t); targets = t ? [t] : []; }
        else if (sk.target === 'enemies') targets = this.opponents(u);
        else if (sk.target === 'ally') targets = [c.t && c.t.alive ? c.t : this.party.filter(p => p.alive).sort((a, b) => a.hp / a.maxhp - b.hp / b.maxhp)[0]];
        else if (sk.target === 'allies') targets = (u.side === 'p' ? this.party : this.enemies).filter(p => p.alive);
        else targets = [u];
        targets = targets.filter(Boolean);
        await this.hop(u);
        if (sk.type === 'fire') {
          G.audio.sfx('fire');
          for (const t of targets) this.fire(t);
          await G.wait(0.45);
          await Promise.all(targets.map(t => this.damage(t, this.fireDmg(u, t, sk.pow), false)));
        } else if (sk.type === 'heal') {
          G.audio.sfx('heal');
          for (const t of targets) { this.sparkle(t, '#9ef0a0'); }
          await G.wait(0.35);
          for (const t of targets) this.heal(t, Math.round(u.int * sk.pow * G.rnd(0.92, 1.08) + u.lvl * 6));
          await G.wait(0.4);
        } else if (sk.type === 'buff') {
          G.audio.sfx('buff');
          for (const t of targets) { t.buff = 3; this.sparkle(t, '#ffd36a'); this.float(t, '攻击提升', '#ffd36a', 20); }
          await G.wait(0.6);
        } else if (sk.type === 'summon') {
          G.audio.sfx('gong');
          for (let k = 0; k < (sk.count || 1); k++) {
            if (this.enemies.filter(x => x.alive).length >= 5) break;
            const used = this.enemies.filter(x => x.alive).map(x => x.x + ',' + x.y);
            const slot = this.slots.find(q => !used.includes(q[0] + ',' + q[1]));
            if (!slot) break;
            const ne = this.makeEnemy(sk.unit, slot); ne.alpha = 0;
            const dead = this.enemies.findIndex(x => !x.alive && x.x === slot[0] && x.y === slot[1]);
            if (dead >= 0) this.enemies.splice(dead, 1);
            this.enemies.push(ne);
            for (let i = 0; i < 14; i++) this.fx.push({ k: 'smoke', x: slot[0] + G.rnd(-20, 20), y: slot[1] - G.rnd(0, 50), vx: G.rnd(-15, 15), vy: G.rnd(-40, -10), life: 1, max: 1, s: G.rnd(8, 14) });
            G.tween(ne, { alpha: 1 }, 0.5);
          }
          await G.wait(0.7);
        } else if (sk.type === 'multi') {
          for (let h = 0; h < sk.hits; h++) {
            const t = this.retarget(u, sk.target === 'enemy' && h === 0 && c.t && !Array.isArray(c.t) ? c.t : null);
            if (!t) break;
            await this.lunge(u, t, async () => { const r = this.physDmg(u, t, sk.pow); this.slash(t, r.crit); await this.damage(t, r.d, r.crit); });
            if (this.enemies.some(e => e.fled)) break;
          }
        } else if (sk.type === 'phys') {
          if (targets.length === 1) {
            await this.lunge(u, targets[0], async () => { const r = this.physDmg(u, targets[0], sk.pow); this.slash(targets[0], true); await this.damage(targets[0], r.d, r.crit || sk.pow > 1); });
          } else {
            const cx = targets.reduce((s, t) => s + t.x, 0) / targets.length, cy = targets.reduce((s, t) => s + t.y, 0) / targets.length;
            await this.lunge(u, { x: cx, y: cy, side: u.side === 'p' ? 'e' : 'p' }, async () => {
              G.shake(5, 0.25);
              await Promise.all(targets.map(t => { const r = this.physDmg(u, t, sk.pow); this.slash(t, false); return this.damage(t, r.d, r.crit); }));
            });
          }
        }
        await G.wait(0.2);
        this.banner = null;
      } else if (c.type === 'item') {
        const it = G.ITEMS[c.item];
        if (!(G.state.items[c.item] > 0)) return;
        G.state.items[c.item]--;
        this.banner = { text: it.name, t: 0, side: 'p' };
        await this.hop(u);
        if (it.type === 'heal') {
          const t = c.t.alive ? c.t : this.party.filter(p => p.alive)[0];
          G.audio.sfx('heal'); this.sparkle(t, '#9ef0a0'); await G.wait(0.3); this.heal(t, it.amt);
        } else if (it.type === 'healall') {
          G.audio.sfx('heal'); for (const t of this.party.filter(p => p.alive)) { this.sparkle(t, '#9ef0a0'); this.heal(t, it.amt); }
        } else if (it.type === 'revive') {
          const t = c.t && !c.t.alive ? c.t : this.party.find(p => !p.alive);
          if (t) { G.audio.sfx('heal'); t.alive = true; t.hp = Math.round(t.maxhp * it.amt); t.alpha = 1; this.sparkle(t, '#fff2a0'); this.float(t, '重整旗鼓', '#fff2a0', 22); }
        } else if (it.type === 'sp') {
          G.audio.sfx('heal'); const before = G.state.sp; G.state.sp = Math.min(G.maxSP(), G.state.sp + it.amt);
          this.sparkle(u, '#8ec8ff'); this.float(u, `策略 +${G.state.sp - before}`, '#8ec8ff', 22);
        }
        await G.wait(0.5); this.banner = null;
      }
    }

    physDmg(u, t, mult) {
      const hpF = 0.55 + 0.45 * (u.hp / u.maxhp);
      let d = u.atk * hpF * (u.buff > 0 ? 1.3 : 1) * mult - t.def * 0.6;
      d *= G.rnd(0.9, 1.1);
      let crit = false;
      if (Math.random() < u.crit) { d *= 1.6; crit = true; }
      if (t.defending) d *= 0.5;
      return { d: Math.max(6, Math.round(d)), crit };
    }
    fireDmg(u, t, pow) {
      let d = (u.int * pow + u.lvl * 5) * G.rnd(0.9, 1.1) - t.def * 0.25;
      if (t.defending) d *= 0.6;
      return Math.max(8, Math.round(d));
    }

    // ---------- 表现 ----------
    async lunge(u, t, hitFn) {
      const dir = u.side === 'p' ? 1 : -1;
      const dx = t.x + dir * 64 - u.x, dy = t.y - u.y;
      u.acting = true;
      await G.tween(u, { ox: dx * 0.15, oy: -6 }, 0.12, G.easeOut);
      G.audio.sfx('slash');
      await G.tween(u, { ox: dx, oy: dy }, 0.16, G.easeIn);
      await hitFn();
      await G.wait(0.08);
      await G.tween(u, { ox: 0, oy: 0 }, 0.24, G.easeInOut);
      u.acting = false;
    }
    async hop(u) { u.acting = true; await G.tween(u, { oy: -14 }, 0.12, G.easeOut); await G.tween(u, { oy: 0 }, 0.14, G.easeIn); u.acting = false; }
    async damage(t, d, crit) {
      if (t.def0 && t.def0.immune && !G.flag(t.def0.immune)) {
        t.hurt = 0.2; G.audio.sfx('cancel');
        this.float(t, t.def0.immuneText || '无效', '#b8a0ff', 24);
        for (let i = 0; i < 10; i++) this.fx.push({ k: 'spark', x: t.x + G.rnd(-30, 30), y: t.y - G.rnd(10, 80), vx: G.rnd(-30, 30), vy: G.rnd(-60, -10), life: 0.6, max: 0.6, col: '#b8a0ff', s: 2.5 });
        return;
      }
      t.hp = Math.max(0, t.hp - d);
      if (t.def0 && t.def0.fleeAt && t.hp <= t.maxhp * t.def0.fleeAt && !t.fled) {
        t.hp = Math.max(1, t.hp); t.hurt = 0.35; t.flash = 0.2; G.audio.sfx('crit'); G.shake(8, 0.4);
        this.float(t, String(d), '#ffd23a', 34);
        await G.wait(0.5);
        t.fled = true; t.alive = false;
        this.msg = { text: t.def0.fleeLine || `${t.name} 拨马退走了！`, t: 0 };
        await G.tween(t, { ox: -400, alpha: 0 }, 0.9, G.easeIn);
        await G.wait(0.6);
        return;
      }
      t.hurt = 0.35; t.flash = 0.2;
      G.audio.sfx(crit ? 'crit' : 'hit');
      if (crit) G.shake(6, 0.2);
      this.float(t, String(d), crit ? '#ffd23a' : '#ffffff', crit ? 34 : 28, crit ? '会心' : null);
      for (let i = 0; i < 8; i++) this.fx.push({ k: 'spark', x: t.x, y: t.y - 30, vx: G.rnd(-140, 140), vy: G.rnd(-180, -40), life: 0.4, max: 0.4, col: '#ffe6a0', s: 2.5 });
      if (t.hp <= 0) {
        t.alive = false;
        await G.wait(0.25);
        G.audio.sfx('down');
        if (t.side === 'e') {
          for (let i = 0; i < 18; i++) this.fx.push({ k: 'smoke', x: t.x + G.rnd(-24, 24), y: t.y - G.rnd(0, 50), vx: G.rnd(-20, 20), vy: G.rnd(-50, -10), life: 1, max: 1, s: G.rnd(8, 16) });
          if (t.boss) { G.shake(10, 0.6); G.fadeTo(0.6, 0.08, '#fff').then(() => G.fadeTo(0, 0.4)); }
          await G.tween(t, { alpha: 0 }, 0.45);
        } else {
          this.msg = { text: `${t.name} 兵力耗尽，退出战斗！`, t: 0 };
          await G.tween(t, { alpha: 0.45 }, 0.3);
        }
      }
    }
    heal(t, amt) {
      const before = t.hp; t.hp = Math.min(t.maxhp, t.hp + amt);
      this.float(t, '+' + (t.hp - before), '#8ef09a', 28);
    }
    float(t, text, col, size, tag) { this.floats.push({ x: t.x + t.ox, y: t.y - 70 * ((t.spec.size || 1)) - (t.boss ? 30 : 0), text, col, size, tag, t: 0 }); }
    slash(t, big) {
      this.fx.push({ k: 'slash', x: t.x, y: t.y - 34, a: G.rnd(-0.9, -0.5), t: 0, dur: 0.22, big, mirror: t.side === 'p' });
      if (big) this.fx.push({ k: 'slash', x: t.x, y: t.y - 34, a: G.rnd(0.4, 0.8), t: -0.06, dur: 0.22, big, mirror: t.side === 'p' });
    }
    fire(t) {
      for (let i = 0; i < 46; i++) this.fx.push({ k: 'fire', x: t.x + G.rnd(-30, 30), y: t.y - G.rnd(-4, 30), vx: G.rnd(-25, 25), vy: G.rnd(-160, -60), life: G.rnd(0.5, 1.0), max: 1, s: G.rnd(6, 14), delay: G.rnd(0, 0.35) });
    }
    sparkle(t, col) {
      for (let i = 0; i < 22; i++) this.fx.push({ k: 'spark', x: t.x + G.rnd(-26, 26), y: t.y - G.rnd(0, 70), vx: G.rnd(-10, 10), vy: G.rnd(-70, -30), life: G.rnd(0.6, 1.1), max: 1.1, col, s: G.rnd(1.5, 3.2), delay: G.rnd(0, 0.3) });
    }

    async victory() {
      this.msg = null;
      G.audio.stop(); G.audio.sfx('victory');
      for (const p of this.party) if (p.alive) p.cheer = true;
      const exp = this.enemies.reduce((s, e) => s + e.def0.exp, 0), gold = this.enemies.reduce((s, e) => s + e.def0.gold, 0);
      G.state.gold += gold;
      const lines = [`获得经验 ${exp}　　缴获 ${gold} 金`];
      let drops = 0; for (const e of this.enemies) if (Math.random() < (e.boss ? 1 : 0.12)) drops++;
      if (drops) { G.addItem('shangyao', drops); lines.push(`拾得 伤药 ×${drops}`); }
      this.syncBack(true);
      let leveled = false;
      for (const id of G.state.party) {
        const m = G.state.members[id];
        const oldMax = G.stats(id).maxhp, oldSk = G.skillsOf(id);
        m.exp += exp;
        let up = 0; while (m.exp >= G.expTo(m.lvl + 1)) { m.lvl++; up++; }
        if (up) {
          leveled = true;
          const st = G.stats(id); m.hp = Math.min(st.maxhp, m.hp + (st.maxhp - oldMax));
          lines.push(`${G.HEROES[id].name} 升至 ${m.lvl} 级！兵力上限 ${st.maxhp}`);
          for (const s of G.skillsOf(id)) if (!oldSk.includes(s)) lines.push(`${G.HEROES[id].name} 习得策略「${G.SKILLS[s].name}」！`);
        }
      }
      G.state.sp = Math.min(G.state.sp, G.maxSP());
      await G.wait(0.6);
      if (leveled) G.audio.sfx('levelup');
      this.result = { lines, t: 0 };
      await new Promise(r => { this.result.done = r; });
    }
    async defeat() {
      G.audio.stop(); G.audio.sfx('defeat');
      await this.say('全军溃败……', 1.6);
    }
    syncBack(win) {
      for (const p of this.party) G.state.members[p.id].hp = p.alive ? p.hp : (win ? 1 : Math.max(1, p.hp));
    }

    // ---------- 更新 ----------
    update(dt) {
      this.t += dt;
      if (this.msg) this.msg.t += dt;
      if (this.banner) this.banner.t += dt;
      for (const u of this.all) { if (u.hurt > 0) u.hurt -= dt; if (u.flash > 0) u.flash -= dt; }
      for (const f of this.floats) f.t += dt;
      this.floats = this.floats.filter(f => f.t < 1.2);
      for (const p of this.fx) {
        if (p.delay > 0) { p.delay -= dt; continue; }
        if (p.k === 'slash') { p.t += dt; continue; }
        p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
        if (p.k === 'spark') p.vy += 60 * dt;
        if (p.k === 'fire') { p.vx *= 0.96; p.s *= 0.985; }
      }
      this.fx = this.fx.filter(p => (p.k === 'slash' ? p.t < p.dur : p.life > 0));
      if (this.cfg.embers && Math.random() < dt * 8) this.embers.push({ x: G.rnd(0, G.W), y: G.H - 140, vx: G.rnd(-10, 10), vy: G.rnd(-50, -20), life: G.rnd(2, 4) });
      for (const e of this.embers) { e.life -= dt; e.x += e.vx * dt + Math.sin(this.t * 2 + e.y * 0.03) * 0.4; e.y += e.vy * dt; }
      this.embers = this.embers.filter(e => e.life > 0);
      if (this.cursor && !UI.modal()) {
        const cu = this.cursor, n = cu.list.length;
        if (!cu.all) {
          if (G.rep('up') || G.rep('left')) { cu.idx = (cu.idx - 1 + n) % n; G.audio.sfx('cursor'); }
          if (G.rep('down') || G.rep('right')) { cu.idx = (cu.idx + 1) % n; G.audio.sfx('cursor'); }
        }
        if (G.hit('ok')) { G.audio.sfx('ok'); this.cursor = null; cu.res(cu.all ? cu.list : cu.list[cu.idx]); }
        else if (G.hit('cancel')) { G.audio.sfx('cancel'); this.cursor = null; cu.res(null); }
      }
      if (this.result) {
        this.result.t += dt;
        if (this.result.t > 0.5 && (G.hit('ok') || G.hit('cancel'))) { const d = this.result.done; this.result.done = null; d && d(); }
      }
    }

    // ---------- 绘制 ----------
    draw(c) {
      c.drawImage(this.bg, 0, 0, G.W, G.H);
      for (const e of this.embers) { c.fillStyle = `rgba(255,${140 + (e.life * 30 | 0)},60,${Math.min(1, e.life / 1.5)})`; c.fillRect(e.x, e.y, 2, 2); }
      if (this.cfg.rain || this.cfg.snow) {
        c.save();
        if (this.cfg.rain) { c.strokeStyle = 'rgba(200,215,235,0.3)'; c.lineWidth = 1.2; c.beginPath(); for (let i = 0; i < 120; i++) { const x = ((i * 137.5 + this.t * 100) % (G.W + 80)) - 40, y = ((i * 71.3 + this.t * (650 + (i % 5) * 50)) % (G.H + 40)) - 20; c.moveTo(x, y); c.lineTo(x - 4, y + 15); } c.stroke(); }
        else { c.fillStyle = 'rgba(255,255,255,0.85)'; for (let i = 0; i < 90; i++) { const x = ((i * 137.5 + this.t * 25 + Math.sin(this.t + i) * 10) % (G.W + 40)) - 20, y = ((i * 71.3 + this.t * (40 + (i % 5) * 10)) % (G.H + 20)) - 10; c.beginPath(); c.arc(x, y, 1 + (i % 3) * 0.7, 0, G.TAU); c.fill(); } }
        c.restore();
      }
      const units = this.all.slice().sort((a, b) => (a.y + a.oy) - (b.y + b.oy));
      for (const u of units) this.drawUnit(c, u);
      for (const u of this.enemies) this.drawLabel(c, u);
      this.drawFx(c);
      for (const f of this.floats) {
        const p = f.t / 1.2, y = f.y - G.easeOut(Math.min(1, f.t / 0.4)) * 30, a = p > 0.7 ? (1 - p) / 0.3 : 1;
        const sc = f.t < 0.12 ? 1.5 - f.t * 4 : 1;
        c.save(); c.globalAlpha = a; c.translate(f.x, y); c.scale(sc, sc);
        if (f.tag) G.text(c, f.tag, 0, -f.size * 0.8, { size: 16, bold: true, align: 'center', color: '#ffb03a', stroke: '#3a1a05', sw: 4 });
        G.text(c, f.text, 0, 0, { size: f.size, bold: true, align: 'center', color: f.col, stroke: 'rgba(30,10,5,0.9)', sw: 5 });
        c.restore();
      }
      if (this.cursor) {
        const cu = this.cursor;
        const targets = cu.all ? cu.list : [cu.list[cu.idx]];
        for (const t of targets) {
          const x = t.x, y = t.y - 74 * (t.spec.size || 1) * (t.boss ? 1.25 : 1) + Math.sin(this.t * 7) * 4;
          c.fillStyle = '#ffd04a'; c.strokeStyle = '#4a2a05'; c.lineWidth = 2;
          c.beginPath(); c.moveTo(x - 10, y - 12); c.lineTo(x + 10, y - 12); c.lineTo(x, y); c.closePath(); c.fill(); c.stroke();
          G.text(c, t.name, x, y - 26, { size: 17, bold: true, align: 'center', color: '#fff3d0', stroke: '#1a0e05', sw: 4 });
        }
      }
      this.drawPanel(c);
      if (this.msg && this.msg.text) {
        const a = Math.min(1, this.msg.t * 6);
        c.save(); c.globalAlpha = a;
        const g = c.createLinearGradient(G.W / 2 - 300, 0, G.W / 2 + 300, 0);
        g.addColorStop(0, 'rgba(10,6,4,0)'); g.addColorStop(0.2, 'rgba(10,6,4,0.78)'); g.addColorStop(0.8, 'rgba(10,6,4,0.78)'); g.addColorStop(1, 'rgba(10,6,4,0)');
        c.fillStyle = g; c.fillRect(G.W / 2 - 300, 22, 600, 44);
        G.text(c, this.msg.text, G.W / 2, 45, { size: 23, bold: true, align: 'center', color: '#f6e7c1' });
        c.restore();
      }
      if (this.banner) this.drawSkillBanner(c);
      if (this.intro < 1) { c.fillStyle = `rgba(0,0,0,${1 - this.intro})`; c.fillRect(0, 0, G.W, G.H); }
      if (this.result) this.drawResult(c);
    }
    drawUnit(c, u) {
      if (u.alpha <= 0.01) return;
      const slide = (1 - this.intro) * (u.side === 'p' ? 360 : -360);
      const x = u.x + u.ox + slide, y = u.y + u.oy;
      const scale = u.boss ? 2.5 : 2.05;
      c.save();
      c.globalAlpha = u.alpha;
      // 军旗
      const fx = x + (u.side === 'p' ? 34 : -34), ef = u.side === 'e' ? enemyFlag(u) : null, fl = ef ? ef.text : (u.spec.flag || '汉');
      const fh = u.boss ? 150 : u.side === 'e' ? 100 : 118;
      c.save(); if (u.side === 'e') { c.translate(fx, 0); c.scale(-1, 1); c.translate(-fx, 0); }
      G.art.drawFlag(c, fx, y - 6, this.t + u.x * 0.01, ef ? ef.col : u.spec.banner, null, fh);
      c.restore();
      G.text(c, fl, fx + (u.side === 'p' ? 16 : -16), y - fh + 24 + Math.sin((this.t + u.x * 0.01) * 4 + 3) * 1.2, { size: 20, bold: true, align: 'center', color: ef ? ef.tcol : '#f6e7c1' });
      // 人物
      const shakeX = u.hurt > 0 ? Math.sin(u.hurt * 60) * 4 : 0;
      c.translate(x + shakeX, y);
      if (u.defending) { c.fillStyle = 'rgba(140,200,255,0.25)'; c.beginPath(); c.ellipse(0, -36, 34, 50, 0, 0, G.TAU); c.fill(); }
      if (u.buff > 0) { c.strokeStyle = `rgba(255,200,80,${0.4 + Math.sin(this.t * 6) * 0.2})`; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 30, 9, 0, 0, G.TAU); c.stroke(); }
      const bob = u.alive && !u.acting ? Math.sin(this.t * 3 + u.x) * 1.2 : 0;
      c.translate(0, bob);
      const step = u.acting ? [0, 1, 0, 3][Math.floor(this.t * 12) % 4] : (u.cheer ? (Math.floor(this.t * 4) % 2 ? 1 : 0) : 0);
      if (u.cheer && Math.floor(this.t * 4) % 2) c.translate(0, -5);
      G.art.drawChar(c, u.spec, u.side === 'p' ? 'left' : 'right', step, { scale: scale / (u.spec.size || 1) * (u.spec.size || 1), down: !u.alive && u.side === 'p' });
      if (u.flash > 0) { c.globalAlpha = u.alpha * (u.flash / 0.2) * 0.8; c.globalCompositeOperation = 'lighter'; G.art.drawChar(c, u.spec, u.side === 'p' ? 'left' : 'right', step, { scale, noShadow: true }); }
      c.restore();
    }
    drawLabel(c, u) {
      if (u.side !== 'e' || !u.alive || this.intro < 1) return;
      const x = u.x + u.ox, y = u.y + u.oy;
      const w = u.boss ? 120 : 76, by = y + 12;
      c.fillStyle = 'rgba(0,0,0,0.55)'; G.rr(c, x - w / 2 - 2, by - 2, w + 4, 10, 4); c.fill();
      UI.bar(c, x - w / 2, by, w, 6, u.hp / u.maxhp, '#e0473a');
      G.text(c, u.name, x, by + 20, { size: 16, bold: true, align: 'center', color: '#f3e2b4', stroke: 'rgba(0,0,0,0.75)', sw: 3 });
    }
    drawFx(c) {
      c.save();
      for (const p of this.fx) {
        if (p.delay > 0) continue;
        if (p.k === 'slash') {
          if (p.t < 0) continue;
          const q = p.t / p.dur, r = p.big ? 70 : 54;
          c.save(); c.translate(p.x, p.y); c.rotate(p.a); if (p.mirror) c.scale(-1, 1);
          c.globalCompositeOperation = 'lighter';
          c.strokeStyle = `rgba(255,250,220,${1 - q})`; c.lineWidth = (p.big ? 7 : 5) * (1 - q * 0.5); c.lineCap = 'round';
          c.beginPath(); c.arc(0, 0, r, -1.1 + q * 0.6, -1.1 + q * 2.6); c.stroke();
          c.strokeStyle = `rgba(255,180,90,${(1 - q) * 0.7})`; c.lineWidth = 2;
          c.beginPath(); c.arc(0, 0, r - 8, -1.0 + q * 0.6, -1.0 + q * 2.4); c.stroke();
          c.restore();
        } else if (p.k === 'fire') {
          const a = p.life / p.max;
          c.globalCompositeOperation = 'lighter';
          const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 1.6);
          g.addColorStop(0, `rgba(255,240,160,${a})`); g.addColorStop(0.4, `rgba(255,130,30,${a * 0.8})`); g.addColorStop(1, 'rgba(200,40,10,0)');
          c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.s * 1.6, 0, G.TAU); c.fill();
        } else if (p.k === 'spark') {
          c.globalCompositeOperation = 'lighter';
          c.fillStyle = p.col; c.globalAlpha = Math.max(0, p.life / p.max);
          c.beginPath(); c.arc(p.x, p.y, p.s, 0, G.TAU); c.fill(); c.globalAlpha = 1;
        } else if (p.k === 'smoke') {
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = `rgba(60,55,50,${(p.life / p.max) * 0.5})`;
          c.beginPath(); c.arc(p.x, p.y, p.s * (2 - p.life), 0, G.TAU); c.fill();
        }
      }
      c.restore();
    }
    drawSkillBanner(c) {
      const b = this.banner, a = Math.min(1, b.t * 5);
      c.save(); c.globalAlpha = a;
      const x = G.W / 2, y = 112, sc = 1 + Math.max(0, 0.25 - b.t) * 2;
      c.translate(x, y); c.scale(sc, sc);
      c.font = G.font(40, true);
      const w = c.measureText(b.text).width + 70;
      c.fillStyle = b.side === 'p' ? 'rgba(150,30,20,0.92)' : 'rgba(110,80,10,0.92)';
      c.beginPath(); c.moveTo(-w / 2 - 14, 0); c.lineTo(-w / 2, -30); c.lineTo(w / 2, -30); c.lineTo(w / 2 + 14, 0); c.lineTo(w / 2, 30); c.lineTo(-w / 2, 30); c.closePath(); c.fill();
      c.strokeStyle = '#f0cf7a'; c.lineWidth = 2; c.stroke();
      G.text(c, b.text, 0, 2, { size: 40, bold: true, align: 'center', color: '#fff3d6', shadow: 'rgba(0,0,0,0.5)' });
      c.restore();
    }
    drawPanel(c) {
      const y0 = G.H - 138;
      UI.panel(c, 16, y0, G.W - 32, 124);
      const np = this.party.length, rowH = np > 5 ? 18 : np > 4 ? 21.5 : 26.5, fs = np > 5 ? 16 : np > 4 ? 18 : 20;
      this.party.forEach((p, i) => {
        const y = y0 + (np > 5 ? 16 : np > 4 ? 18 : 22) + i * rowH;
        if (p === this.active) {
          const g = c.createLinearGradient(30, 0, 640, 0); g.addColorStop(0, 'rgba(210,160,70,0.4)'); g.addColorStop(1, 'rgba(210,160,70,0)');
          c.fillStyle = g; c.fillRect(28, y - 12, 620, 24);
          c.fillStyle = '#e9c46a'; c.beginPath(); c.moveTo(34, y - 5); c.lineTo(40, y); c.lineTo(34, y + 5); c.fill();
        }
        const col = p.alive ? '#f3e6c8' : '#7d7468';
        G.text(c, p.name, 48, y, { size: fs, bold: true, color: col });
        G.text(c, 'Lv' + p.lvl, 112, y + 1, { size: 15, color: p.alive ? '#cdb27a' : '#7d7468' });
        G.text(c, '兵力', 168, y + 1, { size: 15, color: '#bfa978' });
        const r = p.hp / p.maxhp;
        UI.bar(c, 208, y - 6, 300, 12, r, r < 0.3 ? '#d0402e' : r < 0.6 ? '#d9a33a' : '#4caf50');
        G.text(c, `${p.hp} / ${p.maxhp}`, 620, y + 1, { size: 18, align: 'right', color: col });
        if (p.defending) G.text(c, '防', 524, y + 1, { size: 15, bold: true, color: '#8ec8ff' });
        if (p.buff > 0) G.text(c, '励', 546, y + 1, { size: 15, bold: true, color: '#ffd36a' });
      });
      c.strokeStyle = 'rgba(217,180,106,0.3)'; c.beginPath(); c.moveTo(650, y0 + 14); c.lineTo(650, y0 + 110); c.stroke();
      G.text(c, '策略值', 672, y0 + 34, { size: 18, color: '#bfa978' });
      UI.bar(c, 672, y0 + 50, 180, 12, G.state.sp / G.maxSP(), '#4a8fd9');
      G.text(c, `${G.state.sp} / ${G.maxSP()}`, 930, y0 + 34, { size: 18, align: 'right', color: '#cfe0ff' });
      G.text(c, this.cursor ? '方向键选择目标　确认执行' : this.active ? '为部将下达军令' : '', 672, y0 + 90, { size: 15, color: '#8f846c' });
    }
    drawResult(c) {
      const r = this.result, a = Math.min(1, r.t * 4);
      const lines = r.lines, w = 560, h = 90 + lines.length * 32, x = (G.W - w) / 2, y = 120;
      c.save(); c.globalAlpha = a;
      UI.panel(c, x, y, w, h);
      G.text(c, '大 捷', G.W / 2, y + 36, { size: 32, bold: true, align: 'center', color: '#f0cf7a', shadow: 'rgba(120,20,10,0.8)' });
      lines.forEach((l, i) => G.text(c, l, G.W / 2, y + 80 + i * 32, { size: 20, align: 'center', color: i === 0 ? '#f6e7c1' : '#cfe8b0' }));
      c.restore();
    }
  }
  G.BattleScene = BattleScene;
})();
