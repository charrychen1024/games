/* ============================================================
 * 烽烟录 · 标题、序章、结局、战败画面
 * ============================================================ */
'use strict';
(function () {
  const W = G.W, H = G.H;

  function petalsUpdate(list, dt, n, t) {
    if (list.length < n && Math.random() < dt * 10) list.push({ x: Math.random() * (W + 200) - 200, y: -10, vx: 20 + Math.random() * 25, vy: 25 + Math.random() * 20, r: Math.random() * 6, vr: (Math.random() - 0.5) * 3, s: 2 + Math.random() * 2.2 });
    for (const p of list) { p.x += (p.vx + Math.sin(t * 1.3 + p.y * 0.02) * 12) * dt; p.y += p.vy * dt; p.r += p.vr * dt; }
    return list.filter(p => p.y < H + 20 && p.x < W + 40);
  }
  function petalsDraw(c, list, col) {
    for (const p of list) { c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = col; c.beginPath(); c.ellipse(0, 0, p.s * 1.5, p.s * 0.8, 0, 0, G.TAU); c.fill(); c.restore(); }
  }
  function seal(c, x, y, s, text) {
    c.save(); c.translate(x, y); c.rotate(-0.04);
    c.fillStyle = '#b3261b'; G.rr(c, 0, 0, s, s, 4); c.fill();
    c.strokeStyle = 'rgba(250,230,210,0.85)'; c.lineWidth = 2; G.rr(c, 4, 4, s - 8, s - 8, 2); c.stroke();
    const chars = [...text];
    if (chars.length === 2) { G.text(c, chars[0], s / 2, s * 0.32, { size: s * 0.36, bold: true, align: 'center', color: '#fbe9d8' }); G.text(c, chars[1], s / 2, s * 0.7, { size: s * 0.36, bold: true, align: 'center', color: '#fbe9d8' }); }
    else G.text(c, text, s / 2, s / 2 + 2, { size: s * 0.6, bold: true, align: 'center', color: '#fbe9d8' });
    c.restore();
  }

  G.touchOnly = (() => { try { return matchMedia('(pointer: coarse)').matches && !matchMedia('(any-pointer: fine)').matches; } catch (e) { return false; } })();

  /* ---------------- 标题 ---------------- */
  class TitleScene {
    constructor() { this.opaque = true; this.t = 0; this.idx = G.hasSave() ? 1 : 0; this.petals = []; this.busy = false; this.birds = []; for (let i = 0; i < 5; i++) this.birds.push({ x: 300 + i * 34 + Math.random() * 20, y: 70 + Math.sin(i) * 14, ph: Math.random() * 6 }); }
    get sub() { if (this._sub) return this._sub; let n = 1; const sl = G.latestSlot(), d = sl >= 0 ? G.readSlot(sl) : null; if (d && d.meta.chapter && G.CHAPTERS[d.meta.chapter]) n = d.meta.chapter; return (this._sub = `${G.chLabel(n)}　${G.CHAPTERS[n] ? G.CHAPTERS[n].title : ''}`); }
    items() { const h = G.hasSave(), l = [{ label: '新的征程', key: 'new' }, { label: '继续征程', key: 'cont', disabled: !h }, { label: '读取进度', key: 'load', disabled: !h }, { label: '章节选择', key: 'sel' }]; if (G.exUnlocked && (G.exUnlocked() || G._exUnlocked)) l.push({ label: '桃园一梦', key: 'ex' }); l.push({ label: '操作说明', key: 'help' }); return l; }
    update(dt) {
      this.t += dt;
      this.petals = petalsUpdate(this.petals, dt, 34, this.t);
      for (const b of this.birds) { b.x += dt * 16; if (b.x > W + 40) b.x = -40; }
      if (this.busy || G.ui.modal()) return;
      const items = this.items();
      if (G.hit('up') || G.hit('left')) { do { this.idx = (this.idx + items.length - 1) % items.length; } while (items[this.idx].disabled); G.audio.sfx('cursor'); G.audio.play('title'); }
      if (G.hit('down') || G.hit('right')) { do { this.idx = (this.idx + 1) % items.length; } while (items[this.idx].disabled); G.audio.sfx('cursor'); G.audio.play('title'); }
      if (G.hit('ok')) {
        G.audio.play('title');
        if (items[this.idx].disabled) return;
        G.audio.sfx('ok');
        const key = items[this.idx].key;
        if (key === 'new') G.run(async () => { if (await G.confirmOverwrite()) { this.busy = true; G.newGame(); } });
        else if (key === 'cont') { this.busy = true; G.continueGame(); }
        else if (key === 'ex') G.run(async () => { if (await G.confirmOverwrite()) { this.busy = true; G.startExtra(); } });
        else if (key === 'load') G.run(async () => { const sl = await G.loadMenu(); if (sl >= 0) { this.busy = true; G.continueGame(sl); } });
        else if (key === 'sel') G.run(async () => { const n = await G.chapterSelect(); if (n > 0 && await G.confirmOverwrite()) { this.busy = true; G.startFrom(n); } });
        else G.notice('方向键 / WASD：移动、选择\n空格 / Enter / Z：确认、调查、对话\nEsc / X：取消、打开军务菜单（可随时记录 / 读取进度）\nShift（按住）：奔跑　　M：静音');
      }
    }
    draw(c) {
      c.drawImage(G.art.inkLandscape(), 0, 0, W, H);
      // 红日
      const g = c.createRadialGradient(700, 150, 10, 700, 150, 120); g.addColorStop(0, 'rgba(200,60,40,0.9)'); g.addColorStop(0.45, 'rgba(200,60,40,0.85)'); g.addColorStop(0.5, 'rgba(200,60,40,0.12)'); g.addColorStop(1, 'rgba(200,60,40,0)');
      c.fillStyle = g; c.beginPath(); c.arc(700, 150, 120, 0, G.TAU); c.fill();
      // 雾带
      for (let i = 0; i < 3; i++) {
        const y = 330 + i * 48, x = ((this.t * (8 + i * 5)) % (W + 600)) - 300;
        const gg = c.createRadialGradient(x, y, 10, x, y, 300); gg.addColorStop(0, 'rgba(240,233,215,0.55)'); gg.addColorStop(1, 'rgba(240,233,215,0)');
        c.fillStyle = gg; c.beginPath(); c.ellipse(x, y, 320, 40, 0, 0, G.TAU); c.fill();
      }
      // 飞鸟
      c.strokeStyle = 'rgba(30,25,20,0.75)'; c.lineWidth = 1.6;
      for (const b of this.birds) { const f = Math.sin(this.t * 6 + b.ph) * 4; c.beginPath(); c.moveTo(b.x - 7, b.y - f); c.quadraticCurveTo(b.x - 3, b.y - 2, b.x, b.y); c.quadraticCurveTo(b.x + 3, b.y - 2, b.x + 7, b.y - f); c.stroke(); }
      petalsDraw(c, this.petals, 'rgba(220,120,140,0.75)');
      // 题字
      const a = Math.min(1, this.t / 1.2);
      c.save(); c.globalAlpha = a;
      const tx = 150, ty = 120;
      const chars = ['烽', '烟', '录'];
      chars.forEach((ch, i) => {
        G.text(c, ch, tx + 4, ty + i * 104 + 6, { size: 96, bold: true, align: 'center', color: 'rgba(0,0,0,0.18)' });
        G.text(c, ch, tx, ty + i * 104, { size: 96, bold: true, align: 'center', color: '#1b1714' });
      });
      seal(c, tx + 58, ty + 230, 54, '三国');
      G.text(c, this.sub, tx + 112, ty + 30, { size: 22, color: '#3a2e24' });
      c.save(); c.translate(tx + 112, ty + 52); c.fillStyle = '#9a2a1e'; c.fillRect(0, 0, 140, 2); c.restore();
      c.restore();
      // 菜单
      const items = this.items();
      items.forEach((it, i) => {
        const y = 300 - (items.length - 5) * 40 + i * 44, x = 760;
        const sel = i === this.idx;
        if (sel) {
          c.save(); c.globalAlpha = a;
          c.fillStyle = 'rgba(160,35,25,0.85)';
          c.beginPath(); c.moveTo(x - 90, y + 6); c.quadraticCurveTo(x - 20, y - 2, x + 80, y + 4); c.quadraticCurveTo(x + 92, y + 9, x + 70, y + 12); c.quadraticCurveTo(x - 10, y + 8, x - 86, y + 14); c.closePath(); c.fill();
          c.restore();
        }
        G.text(c, it.label, x, y - 8, { size: 28, bold: true, align: 'center', color: it.disabled ? 'rgba(60,50,40,0.35)' : sel ? '#7a1a10' : '#2a221c' });
      });
      G.text(c, '方向键选择　·　空格确认', 760, 506, { size: 16, align: 'center', color: 'rgba(235,225,205,0.6)' });
      G.text(c, '作者 · 一尾小石斑　　原创同人作品 · 美术音乐皆由代码生成', W - 16, H - 14, { size: 13, align: 'right', color: 'rgba(235,225,205,0.45)' });
      // 纯触屏设备（没有精确指针）：说明需要键盘，避免点了没反应
      if (G.touchOnly) { c.fillStyle = 'rgba(20,14,10,0.78)'; G.rr(c, W / 2 - 300, 14, 600, 40, 8); c.fill(); G.text(c, '本作需要键盘操作：方向键移动 · 空格确认 · Esc 取消', W / 2, 34, { size: 18, align: 'center', color: '#f3e2b4' }); }
      if (this.t < 2 && !G.audio.current()) G.text(c, '按任意键开启声音', W / 2, H - 20, { size: 14, align: 'center', color: 'rgba(60,45,30,0.5)' });
    }
  }
  G.TitleScene = TitleScene;

  /* ---------------- 序章 ---------------- */
  const PROLOGUE = G.PROLOGUE1 = [
    '东汉末年，天子暗弱，宦官专权。',
    '天灾连年，饿殍遍野，百姓流离失所。',
    '钜鹿人张角，自号"大贤良师"，以符水为人治病，',
    '徒众数十万，头裹黄巾，口称——',
    '"苍天已死，黄天当立；岁在甲子，天下大吉。"',
    '中平元年，黄巾四起，州郡失守，天下大乱。',
    '',
    '幽州涿郡，楼桑村外，桃花正盛。',
    '一个织席贩履的汉室后裔，即将踏上他的征程……',
  ];
  class TextScroll {
    constructor(lines, done, o = {}) { this.opaque = true; this.lines = lines; this.done = done; this.t = 0; this.o = o; this.finished = false; this.petals = []; }
    update(dt) {
      this.t += dt * (G.keys.ok ? 3 : 1);
      this.petals = petalsUpdate(this.petals, dt, 16, this.t);
      const total = this.lines.length * 1.6 + 2.5;
      if (!this.finished && (this.t > total || G.hit('cancel'))) { this.finished = true; this.done(); }
    }
    draw(c) {
      c.fillStyle = '#0c0907'; c.fillRect(0, 0, W, H);
      const g = c.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.6); g.addColorStop(0, 'rgba(70,40,25,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      petalsDraw(c, this.petals, 'rgba(200,100,120,0.35)');
      const lh = 42, y0 = H / 2 - (this.lines.length * lh) / 2 + 10;
      this.lines.forEach((l, i) => {
        const a = G.clamp((this.t - i * 1.6) / 1.0, 0, 1);
        if (a <= 0 || !l) return;
        G.text(c, l, W / 2, y0 + i * lh + (1 - a) * 8, { size: this.o.size || 24, align: 'center', color: `rgba(240,225,190,${a})` });
      });
      if (!this.o.noHint) G.text(c, '按住确认键加速　Esc 跳过', W - 20, H - 18, { size: 13, align: 'right', color: 'rgba(200,180,140,0.35)' });
    }
  }

  G.TextScroll = TextScroll;

  // 新开一局（新的征程 / 章节选择 / 番外）会覆盖自动存档：有自动存档时先说明并允许取消
  G.confirmOverwrite = async () => {
    const d = G.readSlot(0); if (!d) return true;
    const m = d.meta, ch = G.CHAPTERS[m.chapter], where = `${G.chLabel(m.chapter)}${ch ? '「' + ch.title + '」' : ''}${m.lvl ? ' Lv' + m.lvl : ''}`;
    const k = await G.choose(['仍然开始', '取消'], { title: '会覆盖自动存档', w: 440, x: G.W / 2 - 220, idx: 1,
      desc: () => `自动存档目前停在 ${where}。开始后它会被新进度覆盖；存档一～三不受影响。想保留，可先「继续征程」，在军务菜单里记录到手动存档。` });
    return k === 0;
  };

  /* ---------------- 章末 ---------------- */
  class ChapterEndScene {
    constructor(n, lines) { this.opaque = true; this.n = n; this.lines = lines; this.t = 0; this.petals = []; this.leaving = false; G.audio.play('ending'); if (n === G.FINAL_CHAPTER && G.exUnlock) G.exUnlock(); }
    update(dt) {
      this.t += dt;
      this.petals = petalsUpdate(this.petals, dt, 30, this.t);
      const ready = this.t > this.lines.length * 1.6 + 5;
      if (ready && !this.leaving && G.hit('ok')) {
        this.leaving = true;
        if (G.CHAPTERS[this.n + 1]) G.startChapter(this.n + 1);
        else G.run(async () => { await G.fadeOut(1); G.toTitle(); await G.fadeIn(1); });
      }
    }
    draw(c) {
      c.drawImage(G.art.inkLandscape(), 0, 0, W, H);
      c.fillStyle = 'rgba(20,14,10,0.45)'; c.fillRect(0, 0, W, H);
      petalsDraw(c, this.petals, 'rgba(240,160,180,0.7)');
      const lh = this.lines.length > 5 ? 38 : 44, y0 = this.lines.length > 5 ? 80 : 110;
      this.lines.forEach((l, i) => {
        const a = G.clamp((this.t - 0.8 - i * 1.6) / 1.2, 0, 1);
        G.text(c, l, W / 2, y0 + i * lh, { size: 24, align: 'center', color: `rgba(245,232,200,${a})`, shadow: `rgba(0,0,0,${a * 0.6})` });
      });
      const t2 = this.lines.length * 1.6 + 1.5, a2 = G.clamp((this.t - t2) / 1.5, 0, 1);
      c.save(); c.globalAlpha = a2;
      const ch = G.CHAPTERS[this.n];
      G.text(c, `${G.chLabel(this.n)}　${ch.title}　完`, W / 2, 390, { size: 40, bold: true, align: 'center', color: '#f6e2a8', shadow: 'rgba(140,20,10,0.9)' });
      seal(c, W / 2 + 250, 362, 52, G.CHAPTERS[this.n + 1] ? '待续' : this.n === G.FINAL_CHAPTER ? '剧终' : this.n === G.EX_CHAPTER ? '梦醒' : '未完');
      const s = G.state, lv = s.party.map(id => `${G.HEROES[id].name} Lv${s.members[id].lvl}`).join('　');
      G.text(c, `行军 ${G.fmtTime(s.playTime || 0)}　·　交战 ${s.battles || 0} 场`, W / 2, 440, { size: 18, align: 'center', color: '#d8c8a0' });
      G.text(c, lv, W / 2, 468, { size: 17, align: 'center', color: '#c8b890' });
      c.restore();
      if (this.n === G.FINAL_CHAPTER && this.t > t2 + 1) G.text(c, '……似乎还有一个梦，没有做完。（标题画面已解锁「番外」）', W / 2, 496, { size: 15, align: 'center', color: `rgba(240,190,200,${G.clamp((this.t - t2 - 1) / 2, 0, 0.8)})` });
      if (this.t > t2 + 2) G.text(c, G.CHAPTERS[this.n + 1] ? '按确认键进入下一章' : '按确认键返回标题', W / 2, H - 26, { size: 16, align: 'center', color: `rgba(230,210,170,${0.5 + Math.sin(this.t * 3) * 0.3})` });
    }
  }
  G.ChapterEndScene = ChapterEndScene;
  G.EndingScene = class extends ChapterEndScene { constructor() { super(1, G.CHAPTERS[1].endLines); } };

  /* ---------------- 战败 ---------------- */
  class GameOverScene {
    // retry：由 G.defeat 传入的回调（战斗内战败时可“重新挑战”）
    constructor(retry) { this.opaque = true; this.t = 0; this.idx = 0; this.busy = false; this.retry = retry; }
    opts() { const o = []; if (this.retry) o.push(['重新挑战', 'retry']); if (G.hasSave()) o.push(['读取进度', 'load']); o.push(['返回标题', 'title']); return o; }
    update(dt) {
      this.t += dt;
      if (this.t < 2 || this.busy || G.ui.modal()) return;
      const o = this.opts();
      if (G.hit('up')) { this.idx = (this.idx + o.length - 1) % o.length; G.audio.sfx('cursor'); }
      if (G.hit('down')) { this.idx = (this.idx + 1) % o.length; G.audio.sfx('cursor'); }
      if (G.hit('ok')) {
        G.audio.sfx('ok');
        const act = o[this.idx][1];
        if (act === 'retry') { this.busy = true; this.retry(); }
        else if (act === 'load') G.run(async () => { const sl = await G.loadMenu(); if (sl >= 0) { this.busy = true; G.scriptBusy = 0; G.continueGame(sl); } });
        else { this.busy = true; G.scriptBusy = 0; G.run(async () => { await G.fadeOut(0.8); G.toTitle(); await G.fadeIn(0.8); }); }
      }
    }
    draw(c) {
      c.fillStyle = '#0a0606'; c.fillRect(0, 0, W, H);
      const a = G.clamp(this.t / 1.5, 0, 1);
      c.save(); c.globalAlpha = a;
      const g = c.createRadialGradient(W / 2, H / 2 - 40, 10, W / 2, H / 2, 400); g.addColorStop(0, 'rgba(120,20,15,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      G.text(c, '胜败乃兵家常事', W / 2, H / 2 - 80, { size: 48, bold: true, align: 'center', color: '#e8d2a0', shadow: 'rgba(140,20,10,0.9)' });
      G.text(c, '大丈夫当留得青山在，再图后举。', W / 2, H / 2 - 24, { size: 22, align: 'center', color: '#b8a47a' });
      if (this.t > 2 && !G.ui.modal()) {
        this.opts().forEach(([o], i) => G.text(c, (i === this.idx ? '◆ ' : '　') + o, W / 2, H / 2 + 50 + i * 40, { size: 24, align: 'center', color: i === this.idx ? '#f6e2a8' : '#8a7a5a' }));
        if (this.retry) G.text(c, '重新挑战：回到这场战斗开始之前，兵力、道具、经验都恢复原样。', W / 2, H - 40, { size: 15, align: 'center', color: '#7a6a4a' });
      }
      c.restore();
    }
  }
  G.GameOverScene = GameOverScene;

  /* ---------------- 章节选择：直接从任意一章开始（等级、部将、装备按该章进度配好） ---------------- */
  const CH_LV = [0, 1, 6, 10, 13, 17, 20, 22, 24, 26, 30, 32, 33, 35, 37, 39, 41, 43, 45, 47, 48, 50, 51, 52, 53, 54, 55, 57, 58, 60, 62, 64, 66, 68, 70];
  // [部将, 入队章, 离队章（从该章起不在）]
  const ROSTER = [['liubei', 1, 25], ['guanyu', 1, 23], ['zhangfei', 1, 24], ['jianyong', 2, 99], ['zhaoyun', 5, 30], ['zhugeliang', 10, 33], ['huangzhong', 14, 24],
    ['sunshangxiang', 15, 16], ['pangtong', 16, 17], ['weiyan', 16, 33], ['machao', 18, 28], ['guanping', 22, 23], ['zhoucang', 22, 23], ['guanxing', 99, 0], ['zhangbao2', 99, 0],
    ['jiangwei', 28, 99], ['wangping', 29, 34], ['madai', 99, 0], ['liaohua', 99, 0], ['xiahouba', 99, 0]];
  // 第二十三章以后，关兴、张苞随剧情入队（开场脚本自己会加），之后的章节直接放进候补
  const LATE = [['guanxing', 24, 31], ['zhangbao2', 24, 30], ['madai', 32, 99], ['liaohua', 32, 99], ['xiahouba', 34, 99]];
  const ARMOR = [[6, 'tiejia'], [11, 'longlin'], [15, 'jinsuo'], [19, 'shujin'], [23, 'longwen'], [27, 'wuxing'], [31, 'zhuge'], [99, 'zhaolie']];
  const HEAL = [[11, 'dahuan'], [15, 'shenghui'], [19, 'xuelian'], [23, 'tianxiang'], [27, 'huixin'], [31, 'jiuzhuan'], [99, 'shenyao']];
  const selList = () => Object.keys(G.CHAPTERS).map(Number).sort((a, b) => a - b).filter(n => n !== G.EX_CHAPTER || (G.exUnlocked && (G.exUnlocked() || G._exUnlocked)));
  G.chapterSelect = () => { const list = selList(); return G.menu({ title: '章节选择', x: G.W / 2 - 200, w: 400, bottom: G.H - 40, rows: 9, cancel: true,
    items: list.map(n => ({ label: `${G.chLabel(n)}　${G.CHAPTERS[n].title}`, right: 'Lv' + (n === G.EX_CHAPTER ? 72 : CH_LV[n] || 1) })) })
    .then(k => (k < 0 ? -1 : list[k])); };
  G.startFrom = n => {
    if (n <= 1) { G.newGame(); return; }
    if (n === G.EX_CHAPTER) { G.startExtra(); return; }
    const s = G.state = G.newState(), lv = CH_LV[n] || 1;
    const avail = ROSTER.concat(LATE).filter(([id, a, d]) => n >= a && n < d).map(([id]) => id).filter((id, i, arr) => arr.indexOf(id) === i);
    const armor = ARMOR.find(([c]) => n < c)[1], heal = HEAL.find(([c]) => n < c)[1];
    for (const id of Object.keys(s.members)) { const m = s.members[id]; m.lvl = lv; m.exp = G.expTo(lv); m.armor = avail.includes(id) ? armor : null; }
    s.party = avail.slice(0, 6); s.stash = avail.slice(6);
    s.gold = 600 * n; s.items = { [heal]: 6, xuming: 3, qiongjiang: 4 };
    s.chapter = n; s.flags.chsel = n;
    // 前面章节里永久获得、后面章节还会用到的东西（与自然通关保持一致）
    if (n > 10) s.members.zhaoyun.wbonus = 40;      // 第十章 夺青釭剑
    if (n > 11) s.flags.c11_wind = true;           // 第十一章 借东风：孔明习得「东风」
    if (n > 21) s.flags.c21_flood = true;          // 第二十一章 水淹七军：关羽习得「威震华夏」
    if (n > 23 && s.members.guanxing) s.members.guanxing.wbonus = 20;  // 第二十三章 寻回青龙偃月刀
    if (n > 32) s.flags.c32_book = true;           // 第三十二章 孔明传书：姜维习得「丞相遗策」
    G.restoreAll();
    G.startChapter(n);
  };

  /* ---------------- 流程入口 ---------------- */
  G.toTitle = () => { G.ui.clear(); G.scriptBusy = 0; G.setScene(new TitleScene()); G.audio.play('title'); };
  G.CHAPTERS = G.CHAPTERS || {};
  // 开始第 n 章：章节字幕 → 该章开场脚本
  G.startChapter = n => G.run(async () => {
    await G.fadeOut(1.0);
    G.ui.clear();
    const ch = G.CHAPTERS[n];
    G.state.chapter = n; G.state.map = null;
    G.restoreAll(); G.MAPS = {};
    G.save();
    const lines = ch.prologue.concat(['', `—— ${G.chLabel(n)}　${ch.title} ——`]);
    G.setScene(new TextScroll(lines, () => G.run(async () => {
      await G.fadeOut(1.2);
      G.world = new G.WorldScene();
      G.setScene(G.world);
      await ch.start();
    })));
    G.audio.play('ending');
    await G.fadeIn(1.0);
  });
  G.newGame = () => { G.state = G.newState(); G.state.sp = G.maxSP(); G.startChapter(1); };
  G.continueGame = slot => G.run(async () => {
    await G.fadeOut(0.6);
    G.ui.clear();
    if (!G.loadSave(slot)) { G.toTitle(); await G.fadeIn(0.5); return; }
    G.scriptBusy = 1; // 清掉被战败中断的旧剧情计数
    // 旧版本的通关存档没有 cleared 标记：终章 / 番外的结尾旗标已成立也按通关处理
    const st = G.state;
    if (!st.cleared && ((st.chapter === G.FINAL_CHAPTER && st.flags.c34_end) || (st.chapter === G.EX_CHAPTER && st.flags.ex_end))) st.cleared = st.chapter;
    if (st.cleared && G.CHAPTERS[st.cleared]) {
      G.scriptBusy = 0;
      G.setScene(new ChapterEndScene(st.cleared, G.CHAPTERS[st.cleared].endLines));
      await G.fadeIn(1.0);
      return;
    }
    if (!G.state.map) { G.startChapter(G.state.chapter || 1); return; }
    G.MAPS = {};
    G.world = new G.WorldScene();
    G.setScene(G.world);
    G.world.load(G.state.map, G.state.x, G.state.y, G.state.dir);
    await G.fadeIn(0.6);
  });
  // 章末：存档到下一章开头，播放章末画面
  G.chapterEnd = async lines => {
    const n = G.state.chapter || 1;
    await G.fadeOut(1.5);
    G.ui.clear();
    if (G.CHAPTERS[n + 1]) { G.state.chapter = n + 1; G.state.map = null; G.restoreAll(); }
    else { G.state.cleared = n; G.state.map = null; }   // 终章 / 番外打完：存为「已通关」，继续时播放结局回顾
    G.save();
    G.setScene(new ChapterEndScene(n, lines));
    await G.fadeIn(1.0);
  };
  // 战斗中战败：显示战败画面，返回 'retry'（重新挑战）；读档 / 回标题则不返回
  G.defeat = () => new Promise(res => {
    G.ui.clear(); G.audio.stop();
    G.pushScene(new GameOverScene(() => res('retry')));
    G.fadeIn(0.6);
  });
  G.gameOver = () => {
    G.ui.clear(); G.scriptBusy = 0;
    G.audio.stop();
    G.setScene(new GameOverScene());
    G.fadeIn(0.6);
  };
})();
