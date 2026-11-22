/* ============================================================
 * 烽烟录 · 数据：人物造型、武将、策略、道具、敌军、存档、通用菜单
 * ============================================================ */
'use strict';
(function () {
  // ---------- 人物造型 ----------
  G.SPECS = {
    liubei: { skin: '#f2cba4', hair: '#1a1512', robe: '#2f6650', robe2: '#e6d6a6', trim: '#c9a24a', pants: '#3a3026', hat: 'guan', hatColor: '#191919', beard: 'thin', ears: true, weapon: 'dsword', banner: '#2e7d4f', flag: '刘' },
    guanyu: { skin: '#b5503a', hair: '#120e0d', robe: '#2d6b3d', robe2: '#a8d0a0', trim: '#d6b45c', pants: '#24251f', hat: 'hood', hatColor: '#2a5c35', beard: 'long', brows: 'thick', armor: '#7f8c87', weapon: 'glaive', banner: '#2a6b36', flag: '关', noBlush: true },
    zhangfei: { skin: '#c78b60', hair: '#0e0c0c', robe: '#2b2b35', robe2: '#a33a2a', trim: '#a33a2a', pants: '#1c1c20', hat: 'band', hatColor: '#a8392a', beard: 'bristle', brows: 'thick', eyes: 'round', armor: '#5e6168', armorMark: '#c9a24a', weapon: 'snake', banner: '#2b2b33', flag: '张', size: 1.06, noBlush: true },
    jianyong: { skin: '#efc9a2', hair: '#2a221c', robe: '#5f5185', robe2: '#e4d7a6', trim: '#d8c48a', pants: '#3a3040', hat: 'guan', hatColor: '#2a2030', beard: 'goatee', weapon: 'fan', banner: '#5a4a7a', flag: '简' },
    zoujing: { skin: '#e8bf98', hair: '#1a1512', robe: '#7a2a22', robe2: '#e6c070', trim: '#d6b45c', pants: '#2a2420', hat: 'helmet', hatColor: '#8a8f93', plume: '#c0392b', beard: 'full', armor: '#9a8a5a', weapon: 'spear', banner: '#8a2a20' },
    guard: { skin: '#e3b88f', hair: '#1a1512', robe: '#6a2a24', trim: '#b8954a', pants: '#2a2420', hat: 'helmet', hatColor: '#6d7276', armor: '#7c7364', weapon: 'spear', banner: '#6a2a24' },
    innkeeper: { skin: '#f0c8a0', hair: '#2a221c', robe: '#8a6a44', robe2: '#e8dcc0', trim: '#e8dcc0', pants: '#3a3026', hat: 'bun', hatColor: '#3a2a20', banner: '#8a6a44' },
    merchant: { skin: '#eec39a', hair: '#2a221c', robe: '#3e5a7a', robe2: '#d9c38a', trim: '#d9c38a', pants: '#2a2a30', hat: 'guan', hatColor: '#222', beard: 'thin', banner: '#3e5a7a' },
    smith: { skin: '#c99068', hair: '#1a1512', robe: '#4a3a2c', robe2: '#a08060', trim: '#7a5a3a', pants: '#2a2420', hat: 'band', hatColor: '#5a4a3a', beard: 'full', brows: 'thick', banner: '#4a3a2c' },
    oldman: { skin: '#e8c4a0', hair: '#d8d4cc', robe: '#7a7466', robe2: '#cfc6b0', trim: '#cfc6b0', pants: '#4a4640', hat: 'bun', hatColor: '#6a6458', beard: 'long', beardColor: '#e6e2da', weapon: 'staff', banner: '#6a6458' },
    woman: { skin: '#f4d0ae', hair: '#1e1814', robe: '#b0574a', robe2: '#f0dcc0', trim: '#e8c890', pants: '#5a3a34', hat: 'hairF', hatColor: '#d6b45c', banner: '#b0574a' },
    child: { skin: '#f6d2b0', hair: '#1e1814', robe: '#d68a3a', robe2: '#f6e6c0', trim: '#f6e6c0', pants: '#5a4030', hat: 'twin', hatColor: '#c0392b', size: 0.82, banner: '#d68a3a' },
    farmer: { skin: '#d8a880', hair: '#1e1814', robe: '#6d7a52', robe2: '#c8bd98', trim: '#a89a70', pants: '#4a4034', hat: 'straw', banner: '#6d7a52' },
    servant: { skin: '#eec39a', hair: '#1e1814', robe: '#5a5a5a', robe2: '#d0c8b8', trim: '#c8bfa8', pants: '#333', hat: 'bun', hatColor: '#333', banner: '#5a5a5a' },
    ybing: { skin: '#d9ad85', hair: '#1a1512', robe: '#7a6040', robe2: '#c8a860', trim: '#e2b13a', pants: '#3a3024', hat: 'turban', weapon: 'spear', banner: '#c9962a' },
    ylishi: { skin: '#c48a5e', hair: '#1a1512', robe: '#5a4a38', robe2: '#e2b13a', trim: '#e2b13a', pants: '#2a2420', hat: 'turban', beard: 'bristle', brows: 'thick', eyes: 'round', armor: '#6b6458', weapon: 'axe', size: 1.12, banner: '#c9962a', noBlush: true },
    yshushi: { skin: '#e3bc96', hair: '#1a1512', robe: '#c9a03a', robe2: '#7a2a1a', trim: '#8a3a24', pants: '#4a3a24', hat: 'turban', beard: 'goatee', weapon: 'staff', banner: '#c9962a' },
    ytoumu: { skin: '#d0a07a', hair: '#1a1512', robe: '#6a4a2a', robe2: '#e2b13a', trim: '#e2b13a', pants: '#2a2420', hat: 'turban', beard: 'full', brows: 'thick', armor: '#8a7a4a', weapon: 'sabre', banner: '#c9962a' },
    dengmao: { skin: '#c48660', hair: '#120e0d', robe: '#5a3a24', robe2: '#e2b13a', trim: '#e2b13a', pants: '#2a2018', hat: 'turban', beard: 'bristle', brows: 'thick', eyes: 'round', armor: '#7a6a48', armorMark: '#e2b13a', weapon: 'axe', size: 1.18, banner: '#b8842a', flag: '邓', noBlush: true },
    chengyuanzhi: { skin: '#d6a47c', hair: '#120e0d', robe: '#8a5a1a', robe2: '#f0d070', trim: '#f0c040', pants: '#2a2018', hat: 'turban', beard: 'full', brows: 'thick', armor: '#b8963a', armorMark: '#c0392b', cape: '#7a1e18', weapon: 'bigsabre', size: 1.24, banner: '#b8842a', flag: '程', noBlush: true },
  };
  G.NAMES = {
    liubei: '刘备', guanyu: '关羽', zhangfei: '张飞', jianyong: '简雍', zoujing: '邹靖', guard: '守门兵', innkeeper: '店小二', merchant: '杂货掌柜',
    smith: '铁匠', oldman: '老者', woman: '妇人', child: '孩童', farmer: '农夫', servant: '张家庄客', ybing: '黄巾兵', ylishi: '黄巾力士',
    yshushi: '黄巾术士', ytoumu: '黄巾头目', dengmao: '邓茂', chengyuanzhi: '程远志',
  };

  // ---------- 武将 ----------
  G.HEROES = {
    liubei: { name: '刘备', zi: '玄德', hp: 260, str: 66, int: 76, spd: 62, def: 40, crit: 0.06, wpow: 18, weapon: '双股剑', skills: [['liaoshang', 1], ['jili', 4]] },
    guanyu: { name: '关羽', zi: '云长', hp: 300, str: 96, int: 72, spd: 70, def: 46, crit: 0.1, wpow: 30, weapon: '青龙偃月刀', skills: [['zhanjiang', 3]] },
    zhangfei: { name: '张飞', zi: '翼德', hp: 330, str: 97, int: 30, spd: 64, def: 44, crit: 0.15, wpow: 30, weapon: '丈八蛇矛', skills: [['nuhe', 2]] },
    jianyong: { name: '简雍', zi: '宪和', hp: 190, str: 36, int: 82, spd: 58, def: 30, crit: 0.04, wpow: 6, weapon: '羽扇', skills: [['huoji', 1], ['liaoshang', 1], ['liehuo', 3], ['jiuyuan', 5]] },
  };

  // ---------- 策略 ----------
  G.SKILLS = {
    liaoshang: { name: '疗伤', cost: 5, target: 'ally', type: 'heal', pow: 2.4, desc: '调配草药，恢复一名部将的兵力。' },
    jiuyuan: { name: '救援', cost: 14, target: 'allies', type: 'heal', pow: 1.6, desc: '调度援军，恢复全体部将的兵力。' },
    huoji: { name: '火计', cost: 6, target: 'enemy', type: 'fire', pow: 2.3, desc: '纵火焚营，烧伤一队敌军。威力取决于智力。' },
    liehuo: { name: '烈火', cost: 14, target: 'enemies', type: 'fire', pow: 1.65, desc: '借风势放火，烈焰席卷全体敌军。' },
    jili: { name: '激励', cost: 8, target: 'allies', type: 'buff', desc: '振臂一呼，全军攻击提升三回合。' },
    zhanjiang: { name: '斩将', cost: 7, target: 'enemy', type: 'phys', pow: 1.7, desc: '关羽绝技。拖刀一击，造成大量伤害。' },
    nuhe: { name: '怒喝', cost: 6, target: 'enemies', type: 'phys', pow: 0.75, desc: '张飞绝技。一声断喝，横扫全体敌军。' },
    // 敌方
    yaohuo: { name: '妖火', type: 'fire', target: 'enemy', pow: 2.0 },
    hengsao: { name: '横扫千军', type: 'phys', target: 'enemies', pow: 0.65 },
    huangtian: { name: '黄天妖术', type: 'fire', target: 'enemies', pow: 1.4 },
    nuhou: { name: '怒吼', type: 'buff', target: 'self' },
  };

  // ---------- 道具 ----------
  G.ITEMS = {
    shangyao: { name: '伤药', price: 15, type: 'heal', amt: 150, desc: '恢复一名部将 150 兵力。' },
    jinchuang: { name: '金创药', price: 45, type: 'heal', amt: 420, desc: '恢复一名部将 420 兵力。' },
    zhuojiu: { name: '浊酒', price: 30, type: 'sp', amt: 15, desc: '恢复 15 点策略值。' },
    binliang: { name: '兵粮', price: 90, type: 'healall', amt: 220, desc: '恢复全体部将 220 兵力。' },
    pijia: { name: '皮甲', price: 60, type: 'armor', def: 10, desc: '鞣制牛皮所制。防御 +10。' },
    tiejia: { name: '铁甲', price: 180, type: 'armor', def: 24, desc: '百炼铁片缀成。防御 +24。' },
  };

  // ---------- 敌军 ----------
  G.ENEMIES = {
    ybing: { name: '黄巾兵', hp: 120, str: 40, int: 20, spd: 42, def: 18, exp: 12, gold: 8 },
    ylishi: { name: '黄巾力士', hp: 230, str: 56, int: 15, spd: 34, def: 28, exp: 22, gold: 14 },
    yshushi: { name: '黄巾术士', hp: 140, str: 28, int: 58, spd: 56, def: 16, exp: 20, gold: 16, skills: ['yaohuo'], skillRate: 0.6 },
    ytoumu: { name: '黄巾头目', hp: 340, str: 66, int: 30, spd: 52, def: 36, exp: 42, gold: 30, skills: ['hengsao'], skillRate: 0.25 },
    dengmao: { name: '邓茂', hp: 1900, str: 80, int: 30, spd: 56, def: 42, exp: 220, gold: 150, skills: ['hengsao', 'nuhou'], skillRate: 0.35, boss: true },
    chengyuanzhi: { name: '程远志', hp: 2500, str: 82, int: 64, spd: 62, def: 50, exp: 420, gold: 300, skills: ['hengsao', 'huangtian', 'nuhou'], skillRate: 0.45, boss: true },
  };

  // ---------- 状态 ----------
  G.newState = () => ({
    map: 'taoyuan', x: 15, y: 9, dir: 'up',
    party: ['liubei', 'guanyu', 'zhangfei'],
    members: {
      liubei: { lvl: 1, exp: 0, hp: 260, armor: null },
      guanyu: { lvl: 1, exp: 0, hp: 300, armor: null },
      zhangfei: { lvl: 1, exp: 0, hp: 330, armor: null },
      jianyong: { lvl: 1, exp: 0, hp: 190, armor: null },
      zhaoyun: { lvl: 1, exp: 0, hp: 340, armor: null },
      zhugeliang: { lvl: 1, exp: 0, hp: 300, armor: null },
    },
    gold: 100, items: { shangyao: 3 }, sp: 20, flags: {}, playTime: 0, battles: 0, chapter: 1,
  });
  G.flag = k => !!(G.state && G.state.flags[k]);
  G.setFlag = (k, v = true) => { G.state.flags[k] = v; if (G.world) G.world.autoPending = true; };

  G.stats = id => {
    const b = G.HEROES[id], m = G.state.members[id], l = m.lvl;
    const arm = m.armor ? G.ITEMS[m.armor].def : 0;
    return { maxhp: Math.round(b.hp * (1 + 0.15 * (l - 1))), str: b.str + (l - 1) * 2, int: b.int + (l - 1) * 2, spd: b.spd + (l - 1), def: b.def + (l - 1) * 2 + arm, wpow: b.wpow, crit: b.crit, lvl: l };
  };
  G.maxSP = () => {
    const p = G.state.party;
    const avg = p.reduce((s, id) => s + G.state.members[id].lvl, 0) / p.length;
    return 16 + Math.round(avg * 4) + (p.includes('jianyong') ? 14 : 0);
  };
  G.expTo = l => 20 * (l - 1) * (l - 1) + 30 * (l - 1);
  G.skillsOf = id => G.HEROES[id].skills.filter(([, l]) => G.state.members[id].lvl >= l).map(([k]) => k);
  G.restoreAll = () => {
    for (const id of G.state.party) G.state.members[id].hp = G.stats(id).maxhp;
    G.state.sp = G.maxSP();
  };
  G.addItem = (id, n = 1) => { G.state.items[id] = (G.state.items[id] || 0) + n; };
  G.joinParty = id => {
    if (G.state.party.includes(id)) return;
    const avg = Math.round(G.state.party.reduce((s, p) => s + G.state.members[p].lvl, 0) / G.state.party.length);
    const m = G.state.members[id]; m.lvl = Math.max(m.lvl, avg); m.exp = G.expTo(m.lvl); m.hp = G.stats(id).maxhp;
    G.state.party.push(id);
    G.state.sp = Math.min(G.maxSP(), G.state.sp + 14);
  };

  // ---------- 存档：0 = 自动存档，1~3 = 手动存档 ----------
  const OLD_KEY = 'fengyan_save_v1', SLOT_KEY = i => 'fengyan_slot_' + i;
  const SLOT_NAMES = ['自动存档', '存档一', '存档二', '存档三'];
  const mem = {};
  const failed = {};   // 最近一次写入被浏览器拒绝的键：localStorage 里还是旧值，以内存里的新值为准
  const rawGet = k => { if (failed[k]) return mem[k]; try { const v = localStorage.getItem(k); if (v) return v; } catch (e) { /* ignore */ } return mem[k] || null; };
  // 返回是否真正写进了浏览器存储（写后立即读回比对）；失败时仍留在内存里，本次会话可读
  const rawSet = (k, v) => { mem[k] = v; let ok = false; try { localStorage.setItem(k, v); ok = localStorage.getItem(k) === v; } catch (e) { ok = false; } if (ok) delete failed[k]; else failed[k] = true; return ok; };
  // 旧版单存档迁移到自动存档位
  if (!rawGet(SLOT_KEY(0)) && rawGet(OLD_KEY)) {
    try { const st = JSON.parse(rawGet(OLD_KEY)); rawSet(SLOT_KEY(0), JSON.stringify({ meta: { chapter: st.chapter || 1, place: '', lvl: 0, time: 0 }, state: st })); } catch (e) { /* ignore */ }
  }
  G.SLOT_NAMES = SLOT_NAMES;
  G.readSlot = i => { const v = rawGet(SLOT_KEY(i)); if (!v) return null; try { return JSON.parse(v); } catch (e) { return null; } };
  G.writeSlot = i => {
    const st = G.state, lead = st.party[0];
    const meta = {
      chapter: st.chapter || 1,
      place: st.map ? ((G.world && G.world.m && G.world.m.id === st.map && G.world.m.name) || '') : '章节开场',
      lvl: lead && st.members[lead] ? st.members[lead].lvl : 1,
      lead: lead ? G.HEROES[lead].name : '',
      gold: st.gold, time: Date.now(), cleared: st.cleared || 0,
    };
    const ok = rawSet(SLOT_KEY(i), JSON.stringify({ meta, state: st }));
    G.storageOK = ok;
    return ok;
  };
  const SAVE_FAIL = '浏览器拒绝写入存档（可能是隐私模式或存储空间已满）。\n本次进度只保存在内存里：不关页面可以继续读取，\n刷新或关闭页面后会丢失。';
  // 自动存档失败时只提醒一次，避免打断剧情
  const autoWrite = () => { if (!G.state) return false; const ok = G.writeSlot(0); if (!ok && !G._warnedSave) { G._warnedSave = true; G.notice(SAVE_FAIL); } return ok; };
  G.save = autoWrite;        // 自动存档（章节开头、过图、剧情推进后）
  G.autoSave = autoWrite;
  G.hasSave = () => [0, 1, 2, 3].some(i => G.readSlot(i));
  G.latestSlot = () => { let best = -1, bt = -1; for (let i = 0; i < 4; i++) { const d = G.readSlot(i); if (d && (d.meta.time || 0) > bt) { bt = d.meta.time || 0; best = i; } } return best; };
  G.loadSave = (slot = G.latestSlot()) => {
    const d = slot >= 0 ? G.readSlot(slot) : null; if (!d) return false;
    try { const base = G.newState(); const st = d.state; st.members = Object.assign(base.members, st.members || {}); G.state = Object.assign(base, st); return true; } catch (e) { return false; }
  };
  const fmtTime = t => { if (!t) return ''; const d = new Date(t), z = n => String(n).padStart(2, '0'); return `${d.getMonth() + 1}月${d.getDate()}日 ${z(d.getHours())}:${z(d.getMinutes())}`; };
  const slotItem = (i, forSave) => {
    const d = G.readSlot(i);
    if (!d) return { label: `${SLOT_NAMES[i]}　——　空`, disabled: !forSave };
    const m = d.meta, ch = G.CHAPTERS[m.chapter];
    return { label: `${SLOT_NAMES[i]}　${G.chLabel ? G.chLabel(m.chapter) : '第' + (G.CN[m.chapter] || m.chapter) + '章'} ${ch ? ch.title : ''}`, right: m.cleared ? '已通关' : m.lvl ? 'Lv' + m.lvl : '' };
  };
  const slotDesc = i => { const d = G.readSlot(i); if (!d) return i === 0 ? '过图、剧情推进、章节开始时自动记录。' : '空白存档位。'; const m = d.meta; return [m.cleared ? '已通关，读取后回顾结局' : m.place, m.lead && `${m.lead} 领军`, m.gold != null && `${m.gold} 金`, fmtTime(m.time)].filter(Boolean).join('　·　'); };
  // 存档菜单：可随时在军务菜单 / 客栈中打开
  G.saveMenu = async () => {
    let idx = 0;
    while (true) {
      const k = await G.menu({ x: G.W / 2 - 230, y: 120, w: 460, title: '记录进度', idx, rowH: 44, items: [1, 2, 3].map(i => slotItem(i, true)), desc: j => slotDesc(j + 1) });
      if (k < 0) return false;
      idx = k; const i = k + 1;
      if (G.readSlot(i)) { const c = await G.choose([`覆盖${SLOT_NAMES[i]}`, '取消']); if (c !== 0) continue; }
      const ok = G.writeSlot(i); if (ok) G.writeSlot(0);
      if (!ok) { G.audio.sfx('cancel'); G._warnedSave = true; await G.notice(SAVE_FAIL); return false; }
      G.audio.sfx('buy');
      await G.notice(`进度已记录到「${SLOT_NAMES[i]}」。`);
      return true;
    }
  };
  // 读档菜单：返回存档位编号，取消返回 -1
  G.loadMenu = async () => {
    if (!G.hasSave()) { await G.notice('还没有任何存档。'); return -1; }
    const items = [0, 1, 2, 3].map(i => slotItem(i, false));
    const start = Math.max(0, items.findIndex(x => !x.disabled));
    return G.menu({ x: G.W / 2 - 230, y: 100, w: 460, title: '读取进度', idx: start, rowH: 44, items, desc: slotDesc });
  };

  // ---------- 通用菜单 ----------
  G.pickMember = async (title, right) => {
    const party = G.state.party;
    const k = await G.menu({
      x: G.W / 2 - 170, w: 340, y: 150, title, rowH: 40,
      items: party.map(id => { const st = G.stats(id), m = G.state.members[id]; return { label: G.HEROES[id].name, right: right ? right(id) : `${m.hp}/${st.maxhp}` }; }),
    });
    return k < 0 ? null : party[k];
  };

  G.shop = async function (list, title) {
    let idx = 0;
    while (true) {
      const k = await G.menu({
        x: G.W - 380, y: 60, w: 340, title: `${title}　持有 ${G.state.gold} 金`, idx,
        items: list.map(id => ({ label: G.ITEMS[id].name, right: G.ITEMS[id].price + ' 金', disabled: G.ITEMS[id].price > G.state.gold })),
        desc: i => { const it = G.ITEMS[list[i]]; return it.desc + (it.type === 'armor' ? '' : `（现有 ${G.state.items[list[i]] || 0}）`); },
      });
      if (k < 0) return;
      idx = k; const id = list[k], it = G.ITEMS[id];
      if (it.type === 'armor') {
        const who = await G.pickMember(`由谁穿戴${it.name}？`, h => { const a = G.state.members[h].armor; return a ? '现：' + G.ITEMS[a].name : '无甲'; });
        if (!who) continue;
        const old = G.state.members[who].armor;
        G.state.members[who].armor = id; G.state.gold -= it.price; G.audio.sfx('buy');
        if (old) G.addItem(old);
        await G.notice(`${G.HEROES[who].name} 换上了${it.name}。` + (old ? `\n换下的${G.ITEMS[old].name}放回了行囊。` : ''));
      } else {
        G.state.gold -= it.price; G.addItem(id); G.audio.sfx('buy');
      }
    }
  };

  // 道具对部将（地图上）
  G.useItemField = async function (id) {
    const it = G.ITEMS[id];
    if (it.type === 'heal') {
      const who = await G.pickMember(`对谁使用${it.name}？`); if (!who) return false;
      const m = G.state.members[who], mx = G.stats(who).maxhp;
      if (m.hp >= mx) { await G.notice('兵力已满。'); return false; }
      m.hp = Math.min(mx, m.hp + it.amt);
    } else if (it.type === 'healall') {
      const hurt = G.state.party.filter(p => G.state.members[p].hp < G.stats(p).maxhp);
      if (!hurt.length) { await G.notice('全军兵力已满，无需使用。'); return false; }
      let total = 0;
      for (const p of hurt) { const m = G.state.members[p], before = m.hp; m.hp = Math.min(G.stats(p).maxhp, m.hp + it.amt); total += m.hp - before; }
      G.state.items[id]--; G.audio.sfx('heal');
      await G.notice(`全军共恢复 ${total} 兵力。`);
      return true;
    } else if (it.type === 'armor') {
      // 行囊里的护甲（剧情奖励、离队部将卸下的）：交给现役部将穿戴，换下的旧甲放回行囊
      const who = await G.pickMember(`由谁穿戴${it.name}？`, h => { const a = G.state.members[h].armor; return a ? '现：' + G.ITEMS[a].name : '无甲'; });
      if (!who) return false;
      const m = G.state.members[who], old = m.armor;
      if (old === id) { await G.notice(`${G.HEROES[who].name} 已经穿着${it.name}。`); return false; }
      m.armor = id; G.state.items[id]--; if (old) G.addItem(old);
      G.audio.sfx('buy');
      await G.notice(`${G.HEROES[who].name} 换上了${it.name}（防御 +${it.def}）。` + (old ? `\n换下的${G.ITEMS[old].name}放回了行囊。` : ''));
      return true;
    } else if (it.type === 'sp') {
      if (G.state.sp >= G.maxSP()) { await G.notice('策略值已满。'); return false; }
      G.state.sp = Math.min(G.maxSP(), G.state.sp + it.amt);
    } else return false;
    G.state.items[id]--; G.audio.sfx('heal');
    return true;
  };

  G.pauseMenu = async function () {
    G.audio.sfx('ok');
    let k = 0;
    while (true) {
      k = await G.menu({
        x: 40, y: 40, w: 210, title: '军 务', idx: k,
        items: [{ label: '部将' }, { label: '道具' }, { label: '策略' }, { label: '记录进度' }, { label: '读取进度' }, { label: G.audio.muted ? '开启声音' : '关闭声音' }, { label: '返回标题' }],
        footer: () => [`军资　${G.state.gold} 金`, `策略　${G.state.sp} / ${G.maxSP()}`],
      });
      if (k < 0) return;
      if (k === 0) await G.showStatus();
      else if (k === 1) {
        let j = 0;
        while (true) {
          const ids = Object.keys(G.state.items).filter(i => G.state.items[i] > 0);
          if (!ids.length) { await G.notice('行囊空空如也。'); break; }
          j = await G.menu({ x: 270, y: 40, w: 300, title: '道 具', idx: Math.min(j, ids.length - 1), items: ids.map(i => ({ label: G.ITEMS[i].name, right: '×' + G.state.items[i] })), desc: i => G.ITEMS[ids[i]].desc + (G.ITEMS[ids[i]].type === 'armor' ? '（选中后交给部将穿戴）' : '') });
          if (j < 0) break;
          await G.useItemField(ids[j]);
        }
      } else if (k === 2) {
        const casters = G.state.party.filter(id => G.skillsOf(id).some(s => G.SKILLS[s].type === 'heal'));
        if (!casters.length) { await G.notice('目前无人能在行军中施展策略。'); continue; }
        const ci = await G.menu({ x: 270, y: 40, w: 240, title: '施展者', items: casters.map(id => ({ label: G.HEROES[id].name })) });
        if (ci < 0) continue;
        const sks = G.skillsOf(casters[ci]).filter(s => G.SKILLS[s].type === 'heal');
        const si = await G.menu({ x: 270, y: 40, w: 280, title: `策略值 ${G.state.sp}`, items: sks.map(s => ({ label: G.SKILLS[s].name, right: G.SKILLS[s].cost + '', disabled: G.SKILLS[s].cost > G.state.sp })), desc: i => G.SKILLS[sks[i]].desc });
        if (si < 0) continue;
        const sk = G.SKILLS[sks[si]], st = G.stats(casters[ci]);
        const amount = () => Math.round(st.int * sk.pow * G.rnd(0.95, 1.05) + st.lvl * 6);
        if (sk.target === 'ally') {
          const who = await G.pickMember(`${sk.name}：对谁施展？`); if (!who) continue;
          G.state.members[who].hp = Math.min(G.stats(who).maxhp, G.state.members[who].hp + amount());
        } else for (const p of G.state.party) G.state.members[p].hp = Math.min(G.stats(p).maxhp, G.state.members[p].hp + amount());
        G.state.sp -= sk.cost; G.audio.sfx('heal');
      } else if (k === 3) await G.saveMenu();
      else if (k === 4) {
        const slot = await G.loadMenu(); if (slot < 0) continue;
        const c = await G.choose(['读取此进度', '取消'], { bottom: 300, x: G.W / 2 - 130 });
        if (c === 0) { G.ui.clear(); G.continueGame(slot); return; }
      }
      else if (k === 5) G.audio.toggleMute();
      else if (k === 6) {
        const c = await G.choose(['返回标题', '继续征程'], { bottom: 300, x: G.W / 2 - 130 });
        if (c === 0) { await G.fadeOut(0.5); G.ui.clear(); G.toTitle(); G.fadeIn(0.5); return; }
      }
    }
  };
})();
