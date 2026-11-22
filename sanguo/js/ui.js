/* ============================================================
 * 烽烟录 · 界面：对话框、菜单、提示框、部将状态、标题字卡
 * ============================================================ */
'use strict';
(function () {
  const UI = (G.ui = { stack: [] });
  UI.modal = () => UI.stack.length > 0;
  UI.push = el => new Promise(res => {
    el.resolve = v => { const i = UI.stack.indexOf(el); if (i >= 0) UI.stack.splice(i, 1); res(v); };
    UI.stack.push(el);
  });
  UI.update = dt => {
    for (const e of UI.stack.slice()) if (e.tick) e.tick(dt);
    const top = UI.stack[UI.stack.length - 1];
    if (top && top.input) top.input();
  };
  UI.draw = c => { for (const e of UI.stack) e.draw(c); };
  UI.clear = () => { UI.stack.length = 0; };

  // 漆器风格面板
  UI.panel = (c, x, y, w, h, o = {}) => {
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.5)'; c.shadowBlur = 16; c.shadowOffsetY = 5;
    G.rr(c, x, y, w, h, 8);
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, o.top || 'rgba(44,30,22,0.95)'); g.addColorStop(1, o.bot || 'rgba(18,12,10,0.96)');
    c.fillStyle = g; c.fill();
    c.shadowColor = 'transparent';
    c.lineWidth = 2; c.strokeStyle = '#7a5a32'; c.stroke();
    G.rr(c, x + 5, y + 5, w - 10, h - 10, 5); c.lineWidth = 1; c.strokeStyle = 'rgba(222,184,110,0.55)'; c.stroke();
    c.fillStyle = '#d9b46a';
    for (const [cx, cy] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]]) {
      c.beginPath(); c.moveTo(cx, cy - 4); c.lineTo(cx + 4, cy); c.lineTo(cx, cy + 4); c.lineTo(cx - 4, cy); c.closePath(); c.fill();
    }
    c.restore();
  };

  UI.wrap = (c, text, maxW, size) => {
    c.font = G.font(size);
    const lines = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const ch of para) {
        if (c.measureText(line + ch).width > maxW && line) {
          if ('，。！？、；：”’）》…—'.includes(ch)) { lines.push(line + ch); line = ''; continue; }
          lines.push(line); line = ch;
        } else line += ch;
      }
      lines.push(line);
    }
    return lines;
  };

  UI.bar = (c, x, y, w, h, ratio, col, back) => {
    c.fillStyle = back || 'rgba(0,0,0,0.55)'; G.rr(c, x, y, w, h, h / 2); c.fill();
    if (ratio > 0) {
      const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, G.shade(col, 0.3)); g.addColorStop(1, G.shade(col, -0.2));
      c.fillStyle = g; G.rr(c, x, y, Math.max(h, w * G.clamp(ratio, 0, 1)), h, h / 2); c.fill();
    }
  };

  /* ---------------- 对话框 ---------------- */
  class Dialog {
    constructor(name, text, o) {
      this.name = name; this.o = o; this.portrait = o.portrait;
      const textW = this.portrait ? 690 : 830;
      const lines = UI.wrap(G.ctx, text, textW, 23);
      this.pages = []; for (let i = 0; i < lines.length; i += 3) this.pages.push(lines.slice(i, i + 3));
      this.page = 0; this.chars = 0; this.appear = o.instant ? 1 : 0; this.t = 0; this.blip = 0;
    }
    tick(dt) {
      this.appear = Math.min(1, this.appear + dt * 7); this.t += dt;
      const before = Math.floor(this.chars);
      this.chars += dt * 42;
      if (Math.floor(this.chars) > before && (this.blip += 1) % 3 === 0 && this.chars < this.total()) G.audio.sfx('talk');
    }
    total() { return this.pages[this.page].join('').length; }
    input() {
      if (G.hit('ok') || G.hit('cancel')) {
        if (this.chars < this.total()) this.chars = this.total();
        else if (this.page < this.pages.length - 1) { this.page++; this.chars = 0; }
        else this.resolve();
      }
    }
    draw(c) {
      const a = G.easeOut(this.appear);
      c.save(); c.globalAlpha = a;
      const y = G.H - 148 + (1 - a) * 16, x = 30, w = G.W - 60, h = 128;
      UI.panel(c, x, y, w, h);
      let tx = x + 26;
      if (this.portrait) { G.art.portrait(c, this.portrait, x + 12, y + 11, 106); tx = x + 136; }
      if (this.name) {
        c.font = G.font(20, true);
        const nw = c.measureText(this.name).width + 30;
        c.fillStyle = '#8e2a1f'; G.rr(c, tx - 8, y - 17, nw, 32, 4); c.fill();
        c.strokeStyle = '#e0bd72'; c.lineWidth = 1.5; c.stroke();
        G.text(c, this.name, tx - 8 + nw / 2, y - 1, { size: 20, bold: true, align: 'center', color: '#fbecc4' });
      }
      let rem = Math.floor(this.chars);
      const lines = this.pages[this.page];
      for (let i = 0; i < lines.length; i++) {
        const s = lines[i].slice(0, Math.max(0, rem)); rem -= lines[i].length;
        G.text(c, s, tx, y + 34 + i * 32 + (this.name ? 6 : 0), { size: 23, color: '#f4e9d0', shadow: 'rgba(0,0,0,0.6)' });
      }
      if (this.chars >= this.total() && Math.sin(this.t * 6) > -0.2) {
        c.fillStyle = '#e0bd72'; const ax = x + w - 30, ay = y + h - 22 + Math.sin(this.t * 5) * 2;
        c.beginPath(); c.moveTo(ax - 7, ay - 4); c.lineTo(ax + 7, ay - 4); c.lineTo(ax, ay + 4); c.closePath(); c.fill();
      }
      c.restore();
    }
  }
  G.say = (who, text, o = {}) => {
    const spec = who && G.SPECS[who];
    const name = o.name !== undefined ? o.name : (who ? (G.NAMES[who] || who) : '');
    return UI.push(new Dialog(name, text, Object.assign({ portrait: spec ? who : null }, o)));
  };
  G.narrate = text => G.say(null, text);

  /* ---------------- 菜单 ---------------- */
  class Menu {
    constructor(o) {
      Object.assign(this, { x: 600, y: 200, w: 260, title: null, items: [], idx: 0, cancel: true, rows: 8, rowH: 36, size: 21, desc: null, footer: null }, o);
      this.scroll = 0; this.appear = 0;
      if (this.idx >= this.items.length) this.idx = 0;
      if (this.items[this.idx] && this.items[this.idx].disabled) { const j = this.items.findIndex(i => !i.disabled); if (j >= 0) this.idx = j; }
      if (o.bottom !== undefined) this.y = o.bottom - this.h;
      if (o.center) this.x = (G.W - this.w) / 2;
      this.fixScroll();
    }
    get h() { return (this.title ? 40 : 0) + Math.min(this.rows, this.items.length) * this.rowH + 20; }
    tick(dt) { this.appear = Math.min(1, this.appear + dt * 9); }
    fixScroll() { if (this.idx < this.scroll) this.scroll = this.idx; if (this.idx >= this.scroll + this.rows) this.scroll = this.idx - this.rows + 1; }
    input() {
      const n = this.items.length;
      if (n && G.rep('up')) { this.idx = (this.idx - 1 + n) % n; G.audio.sfx('cursor'); this.fixScroll(); this.onMove && this.onMove(this.idx); }
      if (n && G.rep('down')) { this.idx = (this.idx + 1) % n; G.audio.sfx('cursor'); this.fixScroll(); this.onMove && this.onMove(this.idx); }
      if (G.hit('ok')) {
        const it = this.items[this.idx];
        if (it && !it.disabled) { G.audio.sfx('ok'); this.resolve(this.idx); } else G.audio.sfx('cancel');
      } else if (G.hit('cancel') && this.cancel) { G.audio.sfx('cancel'); this.resolve(-1); }
    }
    draw(c) {
      const a = G.easeOut(this.appear);
      c.save(); c.globalAlpha = a;
      const x = this.x, y = this.y + (1 - a) * 8, w = this.w, h = this.h;
      UI.panel(c, x, y, w, h);
      let ry = y + 10;
      if (this.title) {
        G.text(c, this.title, x + w / 2, y + 26, { size: 19, bold: true, align: 'center', color: '#e8c87a' });
        c.strokeStyle = 'rgba(217,180,106,0.35)'; c.beginPath(); c.moveTo(x + 16, y + 44); c.lineTo(x + w - 16, y + 44); c.stroke();
        ry += 40;
      }
      const end = Math.min(this.items.length, this.scroll + this.rows);
      for (let i = this.scroll; i < end; i++) {
        const it = this.items[i], yy = ry + (i - this.scroll) * this.rowH;
        if (i === this.idx) {
          const g = c.createLinearGradient(x, 0, x + w, 0);
          g.addColorStop(0, 'rgba(200,150,60,0.05)'); g.addColorStop(0.5, 'rgba(210,160,70,0.32)'); g.addColorStop(1, 'rgba(200,150,60,0.05)');
          c.fillStyle = g; G.rr(c, x + 10, yy + 2, w - 20, this.rowH - 4, 4); c.fill();
          c.fillStyle = '#e9c46a'; const bx = x + 20, by = yy + this.rowH / 2 + Math.sin(G.time * 6) * 0.5;
          c.beginPath(); c.moveTo(bx, by - 5); c.lineTo(bx + 5, by); c.lineTo(bx, by + 5); c.lineTo(bx - 5, by); c.closePath(); c.fill();
        }
        const col = it.disabled ? '#7d7468' : i === this.idx ? '#fff3d0' : '#e8dcc0';
        G.text(c, it.label, x + 34, yy + this.rowH / 2, { size: this.size, color: col });
        if (it.right) G.text(c, it.right, x + w - 22, yy + this.rowH / 2, { size: this.size - 3, color: it.disabled ? '#7d7468' : '#d9c08a', align: 'right' });
      }
      if (this.items.length > this.rows) {
        c.fillStyle = 'rgba(233,196,106,0.7)';
        if (this.scroll > 0) { c.beginPath(); c.moveTo(x + w / 2 - 6, ry - 2); c.lineTo(x + w / 2 + 6, ry - 2); c.lineTo(x + w / 2, ry - 8); c.fill(); }
        if (end < this.items.length) { const by = ry + this.rows * this.rowH; c.beginPath(); c.moveTo(x + w / 2 - 6, by + 1); c.lineTo(x + w / 2 + 6, by + 1); c.lineTo(x + w / 2, by + 7); c.fill(); }
      }
      const desc = this.desc && (typeof this.desc === 'function' ? this.desc(this.idx) : this.desc[this.idx]);
      if (desc) {
        const dy = y + h + 8, lines = UI.wrap(c, desc, w - 36, 18);
        UI.panel(c, x, dy, w, 20 + lines.length * 24);
        lines.forEach((l, i) => G.text(c, l, x + 18, dy + 22 + i * 24, { size: 18, color: '#d8ccb0' }));
      }
      if (this.footer) {
        const lines = typeof this.footer === 'function' ? this.footer() : this.footer;
        const dy = y + h + 8;
        UI.panel(c, x, dy, w, 18 + lines.length * 26);
        lines.forEach((l, i) => G.text(c, l, x + 20, dy + 22 + i * 26, { size: 18, color: '#e3d3a8' }));
      }
      c.restore();
    }
  }
  G.menu = o => UI.push(new Menu(o));
  G.choose = (options, o = {}) => G.menu(Object.assign({ x: G.W - 300, w: 260, bottom: G.H - 160, items: options.map(l => ({ label: l })), cancel: true }, o))
    .then(k => k);

  /* ---------------- 提示框 ---------------- */
  class Notice {
    constructor(text, o) { this.lines = UI.wrap(G.ctx, text, 560, 21); this.o = o; this.appear = 0; this.t = 0; }
    tick(dt) { this.appear = Math.min(1, this.appear + dt * 8); this.t += dt; if (this.o.time && this.t > this.o.time) this.resolve(); }
    input() { if (this.t > 0.15 && (G.hit('ok') || G.hit('cancel'))) this.resolve(); }
    draw(c) {
      const a = G.easeOut(this.appear);
      const w = 620, h = 40 + this.lines.length * 30, x = (G.W - w) / 2, y = (this.o.y || G.H * 0.4) - h / 2;
      c.save(); c.globalAlpha = a;
      c.translate(G.W / 2, y + h / 2); c.scale(0.94 + 0.06 * a, 0.94 + 0.06 * a); c.translate(-G.W / 2, -(y + h / 2));
      UI.panel(c, x, y, w, h);
      this.lines.forEach((l, i) => G.text(c, l, G.W / 2, y + 34 + i * 30, { size: 21, align: 'center', color: this.o.color || '#f4e9d0' }));
      c.restore();
    }
  }
  G.notice = (t, o) => UI.push(new Notice(t, o || {}));

  /* ---------------- 标题字卡 ---------------- */
  class TitleCard {
    constructor(text, sub) { this.text = text; this.sub = sub; this.t = 0; }
    tick(dt) { this.t += dt; if (this.t > 3.2) this.resolve(); }
    input() { if (this.t > 1.2 && G.hit('ok')) this.t = Math.max(this.t, 2.7); }
    draw(c) {
      const t = this.t, a = t < 0.6 ? t / 0.6 : t > 2.7 ? Math.max(0, (3.2 - t) / 0.5) : 1;
      c.save(); c.globalAlpha = a;
      const g = c.createLinearGradient(0, G.H / 2 - 90, 0, G.H / 2 + 90);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.3, 'rgba(8,5,3,0.82)'); g.addColorStop(0.7, 'rgba(8,5,3,0.82)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, G.H / 2 - 90, G.W, 180);
      const sp = 14 + G.easeOut(Math.min(1, t / 1.2)) * 8;
      c.font = G.font(62, true);
      const chars = [...this.text], tw = chars.length * (62 + sp) - sp;
      chars.forEach((ch, i) => G.text(c, ch, G.W / 2 - tw / 2 + i * (62 + sp) + 31, G.H / 2 - 8, { size: 62, bold: true, align: 'center', color: '#f6e7c1', shadow: 'rgba(160,30,20,0.8)' }));
      if (this.sub) G.text(c, this.sub, G.W / 2, G.H / 2 + 48, { size: 20, align: 'center', color: '#cdb27a' });
      const sx = G.W / 2 + tw / 2 + 26, sy = G.H / 2 - 30;
      c.fillStyle = '#b8261b'; G.rr(c, sx, sy, 40, 40, 4); c.fill();
      G.text(c, '义', sx + 20, sy + 21, { size: 28, bold: true, align: 'center', color: '#fbe9d0' });
      c.restore();
    }
  }
  G.titleCard = (text, sub) => UI.push(new TitleCard(text, sub));

  /* ---------------- 部将状态 ---------------- */
  class StatusView {
    constructor() { this.appear = 0; this.sel = 0; }
    tick(dt) { this.appear = Math.min(1, this.appear + dt * 8); }
    input() {
      const n = G.state.party.length;
      if (G.rep('left') || G.rep('up')) { this.sel = (this.sel - 1 + n) % n; G.audio.sfx('cursor'); }
      if (G.rep('right') || G.rep('down')) { this.sel = (this.sel + 1) % n; G.audio.sfx('cursor'); }
      if (G.hit('ok') || G.hit('cancel')) { G.audio.sfx('cancel'); this.resolve(); }
    }
    draw(c) {
      const a = G.easeOut(this.appear);
      c.save(); c.globalAlpha = a;
      c.fillStyle = 'rgba(0,0,0,0.5)'; c.fillRect(0, 0, G.W, G.H);
      UI.panel(c, 40, 30, G.W - 80, G.H - 60);
      G.text(c, '部 将', G.W / 2, 60, { size: 26, bold: true, align: 'center', color: '#e8c87a' });
      G.text(c, `军资 ${G.state.gold} 金　　策略值 ${G.state.sp}/${G.maxSP()}　　行军 ${fmtTime(G.state.playTime || 0)}`, G.W / 2, 92, { size: 18, align: 'center', color: '#cdbf9c' });
      const party = G.state.party;
      // 左侧名册
      party.forEach((id, i) => {
        const step = party.length > 5 ? 62 : 74, x = 64, y = 116 + i * step, w = 250, h = step - 8;
        const m = G.state.members[id], st = G.stats(id);
        c.fillStyle = i === this.sel ? 'rgba(210,160,70,0.2)' : 'rgba(255,255,255,0.03)'; G.rr(c, x, y, w, h, 6); c.fill();
        if (i === this.sel) { c.strokeStyle = 'rgba(233,196,106,0.8)'; c.lineWidth = 1.5; c.stroke(); }
        G.art.portrait(c, id, x + 6, y + 6, h - 12);
        G.text(c, G.HEROES[id].name, x + 70, y + 20, { size: 21, bold: true, color: '#fbecc4' });
        G.text(c, 'Lv ' + m.lvl, x + w - 12, y + 20, { size: 17, align: 'right', color: '#e9c46a' });
        UI.bar(c, x + 70, y + h - 26, 166, 9, m.hp / st.maxhp, m.hp / st.maxhp < 0.3 ? '#c0392b' : '#4caf50');
        G.text(c, `${m.hp}/${st.maxhp}`, x + w - 12, y + h - 10, { size: 13, align: 'right', color: '#cdbf9c' });
      });
      // 右侧详情
      const id = party[this.sel], H = G.HEROES[id], m = G.state.members[id], st = G.stats(id);
      const x = 336, y = 116, w = G.W - 80 - 336 + 16;
      c.fillStyle = 'rgba(255,255,255,0.04)'; G.rr(c, x, y, w, 360, 8); c.fill();
      G.art.portrait(c, id, x + 16, y + 16, 132);
      G.text(c, H.name, x + 168, y + 36, { size: 34, bold: true, color: '#fbecc4' });
      c.font = G.font(34, true);
      G.text(c, `字${H.zi}`, x + 176 + c.measureText(H.name).width, y + 40, { size: 19, color: '#bfa978' });
      G.text(c, H.title || '', x + 168, y + 74, { size: 17, color: '#a8966c' });
      G.text(c, `Lv ${m.lvl}`, x + w - 20, y + 36, { size: 24, bold: true, align: 'right', color: '#e9c46a' });
      G.text(c, '兵力', x + 168, y + 108, { size: 18, color: '#cdbf9c' });
      UI.bar(c, x + 214, y + 101, 200, 14, m.hp / st.maxhp, m.hp / st.maxhp < 0.3 ? '#c0392b' : '#4caf50');
      G.text(c, `${m.hp} / ${st.maxhp}`, x + w - 20, y + 108, { size: 18, align: 'right', color: '#efe3c4' });
      const nxt = G.expTo(m.lvl + 1) - m.exp;
      G.text(c, `经验　距升级 ${nxt}`, x + 168, y + 138, { size: 17, color: '#cdbf9c' });
      const stats = [['武力', st.str], ['智力', st.int], ['速度', st.spd], ['防御', st.def]];
      // 条形按本人四项中的最高值缩放（后期数值远超 140，固定上限会让四条都满格）
      const cap = Math.max(140, ...stats.map(s => s[1])) * 1.08;
      stats.forEach(([k, v], i) => {
        const sx = x + 24 + i * 132, sy = y + 182;
        G.text(c, k, sx, sy, { size: 18, color: '#bfa978' });
        G.text(c, String(v), sx + 46, sy, { size: 24, bold: true, color: '#fbecc4' });
        UI.bar(c, sx, sy + 18, 100, 5, v / cap, '#d9a33a');
      });
      G.text(c, `兵器　${H.weapon}`, x + 24, y + 238, { size: 18, color: '#efe3c4' });
      G.text(c, `护甲　${m.armor ? G.ITEMS[m.armor].name + '（防御+' + G.ITEMS[m.armor].def + '）' : '无'}`, x + 260, y + 238, { size: 18, color: '#efe3c4' });
      G.text(c, '策略', x + 24, y + 274, { size: 18, color: '#bfa978' });
      // 等级习得的策略 + 剧情习得的策略（如孔明「东风」、姜维「丞相遗策」）
      const learned = G.skillsOf(id), sk = G.HEROES[id].skills.concat(learned.filter(k => !G.HEROES[id].skills.some(([b]) => b === k)).map(k => [k, 0]));
      if (!sk.length) G.text(c, '—', x + 76, y + 274, { size: 18, color: '#8f846c' });
      sk.forEach(([k, l], i) => {
        const got = m.lvl >= l, sx = x + 76 + (i % 4) * 116, sy = y + 274 + Math.floor(i / 4) * 28;
        G.text(c, got ? G.SKILLS[k].name : `${G.SKILLS[k].name}·Lv${l}`, sx, sy, { size: 17, color: got ? '#fbecc4' : '#7d7468' });
      });
      c.font = G.font(15);
      const bioY = y + 274 + Math.max(1, Math.ceil(sk.length / 4)) * 28 + 4;
      UI.wrap(c, H.bio || '', w - 48, 15).slice(0, 3).forEach((l, i) => G.text(c, l, x + 24, bioY + i * 18, { size: 15, color: '#a8966c' }));
      G.text(c, '方向键切换　确认/取消键返回', G.W / 2, G.H - 40, { size: 15, align: 'center', color: '#8f846c' });
      c.restore();
    }
  }
  function fmtTime(s) { const m = Math.floor(s / 60), h = Math.floor(m / 60); return `${h}时${String(m % 60).padStart(2, '0')}分`; }
  G.fmtTime = fmtTime;
  G.showStatus = () => UI.push(new StatusView());
})();
