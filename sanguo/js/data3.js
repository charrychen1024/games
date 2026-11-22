/* ============================================================
 * 烽烟录 · 第二部数据：新人物、诸葛亮、高阶道具与敌军
 * ============================================================ */
'use strict';
(function () {
  Object.assign(G.SPECS, {
    dongcheng: { skin: '#ecc6a0', hair: '#bdb6aa', robe: '#5a2a3a', robe2: '#e0cfa0', trim: '#d6b45c', pants: '#2a1a24', hat: 'crown', hatColor: '#1a1a1a', beard: 'long', beardColor: '#c8c2b8', banner: '#5a2a3a' },
    xiandi: { skin: '#f4d6b8', hair: '#141010', robe: '#c8a02a', robe2: '#8a1e1e', trim: '#8a1e1e', pants: '#4a3a1a', hat: 'crown', hatColor: '#111', banner: '#c8a02a', size: 0.94 },
    chezhou: { skin: '#e0b088', hair: '#120e0d', robe: '#2f4a7a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1e2a40', hat: 'helmet', hatColor: '#5a6470', plume: '#2f4a7a', armor: '#6a7480', beard: 'full', weapon: 'sabre', size: 1.16, banner: '#24304a', flag: '车', noBlush: true },
    chendeng: { skin: '#eec7a0', hair: '#141010', robe: '#3a5a4a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#22332a', hat: 'crown', hatColor: '#111', beard: 'thin', banner: '#3a5a4a' },
    xuchu: { skin: '#c88e62', hair: '#120e0d', robe: '#3a3a4a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a1a24', hat: 'band', hatColor: '#2f4a7a', beard: 'bristle', brows: 'thick', eyes: 'round', armor: '#4a5460', weapon: 'bigsabre', size: 1.32, banner: '#24304a', flag: '许', noBlush: true },
    kongxiu: { skin: '#d8a880', hair: '#141010', robe: '#2f4a7a', trim: '#8aa0c0', pants: '#1e2a40', hat: 'helmet', hatColor: '#6a7480', plume: '#2f4a7a', armor: '#6a7480', beard: 'thin', weapon: 'spear', size: 1.12, banner: '#24304a', flag: '孔', noBlush: true },
    hanfu: { skin: '#e0b48a', hair: '#bdb6aa', robe: '#3a4a6a', robe2: '#d8c090', trim: '#c9a24a', pants: '#1e2a40', hat: 'crown', hatColor: '#222', beard: 'full', beardColor: '#bdb6aa', weapon: 'sword', size: 1.08, banner: '#24304a', flag: '韩' },
    bianxi: { skin: '#c99068', hair: '#120e0d', robe: '#4a3a2a', robe2: '#c9a24a', trim: '#8a6a3a', pants: '#24180e', hat: 'helmet', hatColor: '#5a5058', plume: '#3a2a1a', armor: '#6a5a4a', beard: 'bristle', brows: 'thick', weapon: 'axe', size: 1.16, banner: '#24304a', flag: '卞', noBlush: true },
    wangzhi: { skin: '#eec7a0', hair: '#141010', robe: '#5a3a5a', robe2: '#e0d0b0', trim: '#c8b090', pants: '#2a1a2a', hat: 'crown', hatColor: '#222', beard: 'goatee', weapon: 'sword', size: 1.06, banner: '#24304a', flag: '王' },
    qinqi: { skin: '#d8a880', hair: '#141010', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#3a4450', plume: '#c0392b', armor: '#4a5460', beard: 'thin', brows: 'thick', weapon: 'bigsabre', size: 1.14, banner: '#24304a', flag: '秦', noBlush: true },
    caiyang: { skin: '#e0b088', hair: '#d8d2c8', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#4a5460', plume: '#c0392b', armor: '#5a6470', beard: 'long', beardColor: '#e0dcd4', weapon: 'bigsabre', size: 1.2, banner: '#24304a', flag: '蔡', noBlush: true },
    monk: { skin: '#f0caa4', hair: '#f0caa4', robe: '#c8862a', robe2: '#8a2a1a', trim: '#8a2a1a', pants: '#5a3a1a', banner: '#c8862a', weapon: 'staff' },
    huban: { skin: '#e3b88f', hair: '#141010', robe: '#4a5a3a', trim: '#a8a070', pants: '#2a2a1a', hat: 'helmet', hatColor: '#6a6a5a', armor: '#7a7464', weapon: 'spear', banner: '#4a5a3a' },
    zhoucang: { skin: '#9a6a48', hair: '#0e0c0c', robe: '#3a2a1a', robe2: '#a08060', trim: '#7a5a3a', pants: '#1a120a', hat: 'band', hatColor: '#3a2a1a', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'glaive', size: 1.18, banner: '#3a2a1a', noBlush: true },
    shanzei: { skin: '#c89068', hair: '#141010', robe: '#5a4a3a', robe2: '#8a7a5a', trim: '#7a6a4a', pants: '#2a2018', hat: 'band', hatColor: '#6a3a2a', beard: 'bristle', weapon: 'sabre', banner: '#5a4a3a' },
    peiyuanshao: { skin: '#c48e66', hair: '#120e0d', robe: '#4a3a2a', robe2: '#a08060', trim: '#8a6a3a', pants: '#24180e', hat: 'band', hatColor: '#8a2a1a', beard: 'full', brows: 'thick', weapon: 'axe', size: 1.16, banner: '#5a4a3a', flag: '裴', noBlush: true },
    zhugeliang: { skin: '#f2d0ae', hair: '#141010', robe: '#e8e6dc', robe2: '#2a3a5a', trim: '#2a3a5a', pants: '#3a4050', hat: 'scholar', hatColor: '#2a3a5a', beard: 'thin', weapon: 'fan', banner: '#2a3a5a', flag: '诸' },
    xushu: { skin: '#eec7a0', hair: '#141010', robe: '#4a5a6a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#2a3038', hat: 'scholar', hatColor: '#3a4a5a', beard: 'thin', weapon: 'sword', banner: '#4a5a6a' },
    liubiao: { skin: '#ecc8a6', hair: '#c8c2b8', robe: '#3a4a2a', robe2: '#e0cfa0', trim: '#d6b45c', pants: '#24301a', hat: 'crown', hatColor: '#111', beard: 'long', beardColor: '#d8d4cc', banner: '#3a4a2a' },
    caoren: { skin: '#e0b088', hair: '#120e0d', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#4a5460', plume: '#2f4a7a', armor: '#5a6470', armorMark: '#c9a24a', beard: 'full', brows: 'thick', weapon: 'spear', size: 1.2, banner: '#24304a', flag: '仁', noBlush: true },
    shepherd: { skin: '#f0caa4', hair: '#141010', robe: '#6a8a5a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#3a4a30', hat: 'straw', banner: '#6a8a5a' },
    zhangfei_rival: null,
    madame: { skin: '#f6d8bc', hair: '#141010', robe: '#a84a5a', robe2: '#f0dcc0', trim: '#e8c890', pants: '#5a2a34', hat: 'hairF', hatColor: '#d6b45c', banner: '#a84a5a' },
    xiahouen: { skin: '#e8b890', hair: '#141010', robe: '#2f4a7a', robe2: '#e8e8e8', trim: '#c9a24a', pants: '#1e2a40', hat: 'helmet', hatColor: '#8a94a0', plume: '#ffffff', armor: '#7a8490', weapon: 'sword', size: 1.08, banner: '#24304a', flag: '夏', noBlush: true },
    zhanghe: { skin: '#e0b48a', hair: '#141010', robe: '#2a3a5a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a2236', hat: 'helmet', hatColor: '#4a5460', plume: '#c9a24a', armor: '#5a6470', beard: 'thin', brows: 'thick', weapon: 'spear', size: 1.18, banner: '#24304a', flag: '张', noBlush: true },
  });
  delete G.SPECS.zhangfei_rival;
  Object.assign(G.NAMES, {
    dongcheng: '董承', xiandi: '汉献帝', chezhou: '车胄', chendeng: '陈登', xuchu: '许褚', kongxiu: '孔秀', hanfu: '韩福', bianxi: '卞喜', wangzhi: '王植', qinqi: '秦琪',
    caiyang: '蔡阳', monk: '普净', huban: '胡班', zhoucang: '周仓', shanzei: '山贼', peiyuanshao: '裴元绍', zhugeliang: '诸葛亮', xushu: '徐庶', liubiao: '刘表', caoren: '曹仁',
    shepherd: '童子', madame: '糜夫人', xiahouen: '夏侯恩', zhanghe: '张郃',
  });
  G.HEROES.zhugeliang = { name: '诸葛亮', zi: '孔明', title: '卧龙', bio: '琅琊阳都人。躬耕南阳，自比管仲、乐毅。', hp: 300, str: 40, int: 100, spd: 72, def: 44, crit: 0.05, wpow: 10, weapon: '羽扇', skills: [['huoji', 1], ['liehuo', 1], ['jiuyuan', 1], ['bagua', 1], ['dongfeng', 30]] };
  G.newStateMembers2 = { zhugeliang: { lvl: 1, exp: 0, hp: 300, armor: null } };
  Object.assign(G.SKILLS, {
    bagua: { name: '八阵', cost: 20, target: 'allies', type: 'buff', desc: '布下八阵图，全军攻击提升三回合。' },
    dongfeng: { name: '借东风', cost: 36, target: 'enemies', type: 'fire', pow: 3.0, desc: '设坛祭风，借来东风，火烧全体敌军。' },
    xuanfeng: { name: '旋风斩', type: 'phys', target: 'enemies', pow: 0.7 },
    feichui: { name: '流星锤', type: 'multi', target: 'enemy', hits: 2, pow: 0.8 },
    huozhen: { name: '纵火', type: 'fire', target: 'enemies', pow: 1.4 },
  });
  Object.assign(G.ITEMS, {
    dahuan: { name: '大还丹', price: 260, type: 'heal', amt: 2000, desc: '恢复一名部将 2000 兵力。' },
    jingliang: { name: '精粮', price: 480, type: 'healall', amt: 1200, desc: '恢复全体部将 1200 兵力。' },
    qiongjiang: { name: '琼浆', price: 200, type: 'sp', amt: 80, desc: '恢复 80 点策略值。' },
    longlin: { name: '龙鳞甲', price: 4200, type: 'armor', def: 95, desc: '传说以蛟龙之鳞缀成。防御 +95。' },
  });
  const E = o => o;
  Object.assign(G.ENEMIES, {
    // 第六章
    caobing2: E({ name: '曹军精锐', hp: 900, str: 118, int: 30, spd: 68, def: 80, exp: 230, gold: 90, spec: 'caobing' }),
    caoqi2: E({ name: '虎豹精骑', hp: 1050, str: 128, int: 30, spd: 88, def: 86, exp: 260, gold: 100, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    caoshe2: E({ name: '曹军强弩', hp: 780, str: 112, int: 40, spd: 70, def: 66, exp: 240, gold: 95, skills: ['luanshe'], skillRate: 0.45, spec: 'caoshe' }),
    ysbing2: E({ name: '袁术残兵', hp: 820, str: 112, int: 25, spd: 62, def: 72, exp: 210, gold: 85, spec: 'hanbing' }),
    chezhou: E({ name: '车胄', hp: 9000, str: 132, int: 50, spd: 74, def: 92, exp: 2600, gold: 1600, skills: ['hengsao', 'nuhou'], skillRate: 0.35, boss: true }),
    xuchu: E({ name: '许褚', hp: 14000, str: 150, int: 30, spd: 80, def: 100, exp: 3600, gold: 2000, skills: ['xuanfeng', 'nuhou', 'hengsao'], skillRate: 0.4, boss: true, fleeAt: 0.4, fleeLine: '许褚：哈哈，好汉子！——四面伏兵杀出，刘备军阵脚大乱！' }),
    // 第七章（关羽单骑）
    guanbing: E({ name: '守关兵', hp: 620, str: 100, int: 20, spd: 62, def: 70, exp: 240, gold: 80, spec: 'caobing' }),
    guanshe: E({ name: '守关弓手', hp: 520, str: 96, int: 30, spd: 70, def: 60, exp: 240, gold: 85, skills: ['luanshe'], skillRate: 0.4, spec: 'caoshe' }),
    kongxiu: E({ name: '孔秀', hp: 3600, str: 120, int: 30, spd: 70, def: 80, exp: 1500, gold: 600, skills: ['nuhou'], skillRate: 0.2, boss: true, noDouble: true }),
    hanfu: E({ name: '韩福', hp: 4000, str: 112, int: 60, spd: 66, def: 76, exp: 1600, gold: 700, skills: ['luanshe'], skillRate: 0.35, boss: true, noDouble: true }),
    bianxi: E({ name: '卞喜', hp: 4600, str: 128, int: 30, spd: 72, def: 84, exp: 1800, gold: 700, skills: ['feichui', 'nuhou'], skillRate: 0.35, boss: true, noDouble: true }),
    wangzhi: E({ name: '王植', hp: 4400, str: 100, int: 90, spd: 70, def: 74, exp: 1800, gold: 800, skills: ['huozhen'], skillRate: 0.45, boss: true, noDouble: true }),
    qinqi: E({ name: '秦琪', hp: 5000, str: 134, int: 30, spd: 78, def: 88, exp: 2200, gold: 900, skills: ['hengsao', 'nuhou'], skillRate: 0.3, boss: true, noDouble: true }),
    // 第八章
    caiyang: E({ name: '蔡阳', hp: 6000, str: 136, int: 40, spd: 74, def: 90, exp: 2600, gold: 1200, skills: ['hengsao', 'nuhou'], skillRate: 0.3, boss: true, noDouble: true }),
    shanzei: E({ name: '山贼', hp: 1000, str: 124, int: 20, spd: 70, def: 78, exp: 260, gold: 110 }),
    shanzei2: E({ name: '山贼头目', hp: 1300, str: 134, int: 20, spd: 66, def: 86, exp: 300, gold: 130, skills: ['hengsao'], skillRate: 0.25, spec: 'shanzei' }),
    peiyuanshao: E({ name: '裴元绍', hp: 11000, str: 146, int: 30, spd: 76, def: 98, exp: 3400, gold: 1800, skills: ['hengsao', 'nuhou'], skillRate: 0.35, boss: true }),
    // 第九章
    caobing3: E({ name: '曹军锐卒', hp: 1250, str: 136, int: 30, spd: 72, def: 96, exp: 320, gold: 120, spec: 'caobing' }),
    caoqi3: E({ name: '虎豹铁骑', hp: 1400, str: 146, int: 30, spd: 92, def: 100, exp: 360, gold: 130, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    caoshe3: E({ name: '曹军神射', hp: 1100, str: 132, int: 40, spd: 76, def: 82, exp: 340, gold: 125, skills: ['luanshe'], skillRate: 0.45, spec: 'caoshe' }),
    caoren: E({ name: '曹仁', hp: 15000, str: 150, int: 60, spd: 78, def: 110, exp: 4400, gold: 2400, skills: ['hengsao', 'nuhou', 'chongfeng'], skillRate: 0.35, boss: true, fleeAt: 0.3, fleeLine: '曹仁：八门金锁阵竟被识破……退兵！' }),
    xiahoudun2: E({ name: '夏侯惇', hp: 17000, str: 156, int: 40, spd: 82, def: 112, exp: 5000, gold: 2800, skills: ['hengsao', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.25, fleeLine: '夏侯惇：四面都是火……中计了！撤！', spec: 'xiahoudun' }),
    // 第十章
    caobing4: E({ name: '曹军追兵', hp: 1500, str: 150, int: 30, spd: 76, def: 108, exp: 380, gold: 140, spec: 'caobing' }),
    caoqi4: E({ name: '虎豹骑', hp: 1700, str: 160, int: 30, spd: 96, def: 112, exp: 420, gold: 150, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    xiahouen: E({ name: '夏侯恩', hp: 9000, str: 150, int: 30, spd: 80, def: 100, exp: 3000, gold: 1500, skills: ['nuhou'], skillRate: 0.25, boss: true, noDouble: true }),
    zhanghe: E({ name: '张郃', hp: 16000, str: 164, int: 60, spd: 90, def: 116, exp: 5200, gold: 2600, skills: ['chongfeng', 'hengsao', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.35, fleeLine: '张郃：此人如入无人之境……让他去吧！' }),
  });
  // 队伍暂离 / 归队
  G.stashParty = keep => { const s = G.state; s.stash = (s.stash || []).concat(s.party.filter(id => !keep.includes(id))); s.party = s.party.filter(id => keep.includes(id)); if (!s.party.length) s.party = keep.slice(); s.sp = Math.min(s.sp, G.maxSP()); };
  G.unstash = ids => { const s = G.state; for (const id of ids) { if (!(s.stash || []).includes(id)) continue; if (!s.party.includes(id)) s.party.push(id); s.stash = (s.stash || []).filter(x => x !== id); } };
  // 成长：武器加成
  const baseStats = G.stats;
  G.stats = id => { const st = baseStats(id), m = G.state.members[id]; st.wpow += m.wbonus || 0; return st; };
})();
