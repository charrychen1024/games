/* ============================================================
 * 烽烟录 · 第七部数据：姜维、王平；北伐魏军
 * ============================================================ */
'use strict';
(function () {
  const WEI = '#24304a';
  Object.assign(G.SPECS, {
    jiangwei: { skin: '#f0caa4', hair: '#141010', robe: '#2a4a6a', robe2: '#e8dcc0', trim: '#c9a24a', pants: '#14243a', hat: 'helmet', hatColor: '#5a6a7a', plume: '#e8e0c8', armor: '#7a8a9a', beard: 'thin', weapon: 'spear', size: 1.08, banner: '#2a4a6a', flag: '姜' },
    wangping: { skin: '#d8a880', hair: '#141010', robe: '#4a3a2a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#24180e', hat: 'helmet', hatColor: '#5a5048', plume: '#8a1e1e', armor: '#6a5a4a', beard: 'full', weapon: 'sabre', size: 1.06, banner: '#4a3a2a', flag: '王', noBlush: true },
    simayi: { skin: '#ecc8a6', hair: '#3a3430', robe: '#1e2a44', robe2: '#c9a24a', trim: '#c9a24a', pants: '#121a2a', hat: 'crown', hatColor: '#111', beard: 'long', beardColor: '#5a5048', brows: 'thick', weapon: 'sword', banner: WEI, flag: '司' },
    caozhen: { skin: '#e0b088', hair: '#141010', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#4a5460', plume: '#c9a24a', armor: '#5a6470', armorMark: '#c9a24a', beard: 'full', weapon: 'sword', size: 1.14, banner: WEI, flag: '曹', noBlush: true },
    xiahoumao: { skin: '#f4d6b8', hair: '#141010', robe: '#3a4a7a', robe2: '#e8dcc0', trim: '#c9a24a', pants: '#1e2a40', hat: 'helmet', hatColor: '#8a94a0', plume: '#e8c86a', armor: '#9aa4b0', weapon: 'sword', size: 1.02, banner: WEI, flag: '夏', noBlush: false },
    hande: { skin: '#c99068', hair: '#120e0d', robe: '#2a3a5a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#4a4048', plume: '#2a3a5a', armor: '#5a5460', beard: 'bristle', brows: 'thick', weapon: 'axe', size: 1.2, banner: WEI, flag: '韩', noBlush: true },
    guohuai: { skin: '#e0b48a', hair: '#141010', robe: '#2a3a5a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a2236', hat: 'helmet', hatColor: '#4a5460', plume: '#2f4a7a', armor: '#5a6470', beard: 'thin', weapon: 'spear', size: 1.1, banner: WEI, flag: '郭', noBlush: true },
    wangshuang: { skin: '#b88058', hair: '#120e0d', robe: '#2a2a3a', robe2: '#a08060', trim: '#8a6a3a', pants: '#14141e', hat: 'band', hatColor: '#2f4a7a', armor: '#4a4a5a', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'bigsabre', size: 1.34, banner: WEI, flag: '王', noBlush: true },
    haozhao: { skin: '#e0b088', hair: '#141010', robe: '#2a3a5a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a2236', hat: 'helmet', hatColor: '#5a6470', plume: '#c0392b', armor: '#6a7480', beard: 'full', weapon: 'spear', size: 1.1, banner: WEI, flag: '郝', noBlush: true },
    weibing: { skin: '#e3b88f', hair: '#141010', robe: '#2f4a7a', trim: '#8aa0c0', pants: '#1e2a40', hat: 'helmet', hatColor: '#5a6470', armor: '#6a7480', weapon: 'spear', banner: WEI },
  });
  Object.assign(G.NAMES, {
    jiangwei: '姜维', wangping: '王平', simayi: '司马懿', caozhen: '曹真', xiahoumao: '夏侯楙', hande: '韩德', guohuai: '郭淮', wangshuang: '王双', haozhao: '郝昭', weibing: '魏兵',
  });

  /* ---------------- 新部将：姜维、王平 ---------------- */
  G.HEROES.jiangwei = { name: '姜维', zi: '伯约', title: '麒麟儿', bio: '天水冀人。文武双全，智勇足备。孔明得之，叹曰："吾自出茅庐以来，遍求贤者，欲传授平生之学，恨未得其人。今遇伯约，吾愿足矣。"', hp: 340, str: 96, int: 92, spd: 82, def: 50, crit: 0.13, wpow: 30, weapon: '梨花枪', skills: [['huoji', 1], ['liehuo', 1], ['qilin', 1], ['bagua', 1]] };
  G.HEROES.wangping = { name: '王平', zi: '子均', title: '镇北', bio: '巴西宕渠人。原为曹将，汉水之战降蜀。不识字，却深通兵法，行军谨慎。', hp: 360, str: 90, int: 66, spd: 70, def: 56, crit: 0.1, wpow: 26, weapon: '长刀', skills: [['jianshou', 1], ['wuxie', 1]] };
  Object.assign(G.SKILLS, {
    qilin: { name: '麒麟枪', cost: 14, target: 'enemy', type: 'multi', hits: 3, pow: 0.95, desc: '姜维绝技。梨花枪法，连刺三次。' },
    jianshou: { name: '坚守', cost: 12, target: 'allies', type: 'heal', pow: 1.4, desc: '王平绝技。据险坚守，全军休整，恢复兵力。' },
    wuxie: { name: '无当飞军', cost: 18, target: 'enemies', type: 'phys', pow: 1.0, desc: '王平所领的精锐，冲击全体敌军。' },
    // 敌方
    fuzi: { name: '父子齐上', type: 'multi', target: 'enemy', hits: 4, pow: 0.6 },
    liuxing: { name: '流星锤', type: 'multi', target: 'enemy', hits: 2, pow: 1.0 },
    leishi: { name: '擂木炮石', type: 'phys', target: 'enemies', pow: 0.95 },
    zhongda: { name: '仲达之谋', type: 'fire', target: 'enemies', pow: 1.6 },
  });
  const baseNew = G.newState;
  G.newState = () => {
    const s = baseNew();
    Object.assign(s.members, { jiangwei: { lvl: 1, exp: 0, hp: 340, armor: null }, wangping: { lvl: 1, exp: 0, hp: 360, armor: null } });
    return s;
  };

  Object.assign(G.ITEMS, {
    jiuzhuan: { name: '九转还魂丹', price: 1300, type: 'heal', amt: 10000, desc: '恢复一名部将 10000 兵力。' },
    qianjin: { name: '千金露', price: 1000, type: 'sp', amt: 380, desc: '恢复 380 点策略值。' },
    muniu: { name: '木牛军粮', price: 3000, type: 'healall', amt: 8000, desc: '木牛流马运来的军粮。恢复全体部将 8000 兵力。' },
    zhuge: { name: '诸葛连弩甲', price: 32000, type: 'armor', def: 290, desc: '附有连弩机括的铁甲。防御 +290。' },
  });

  const E = o => o;
  Object.assign(G.ENEMIES, {
    // 第二十七章　出师
    weibing: E({ name: '魏兵', hp: 3500, str: 230, int: 30, spd: 86, def: 150, exp: 980, gold: 340, spec: 'weibing' }),
    weiqi: E({ name: '魏骑', hp: 3700, str: 238, int: 30, spd: 108, def: 152, exp: 1000, gold: 345, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    weinu: E({ name: '魏弩手', hp: 3200, str: 226, int: 40, spd: 90, def: 138, exp: 980, gold: 340, skills: ['luanjian'], skillRate: 0.4, spec: 'caoshe' }),
    hande: E({ name: '韩德', hp: 11000, str: 206, int: 30, spd: 92, def: 146, exp: 9000, gold: 4000, skills: ['fuzi', 'kaishan'], skillRate: 0.4, boss: true, noDouble: true }),
    jiangwei: E({ name: '姜维', hp: 40000, str: 236, int: 92, spd: 104, def: 150, exp: 12000, gold: 5000, skills: ['tuqiang', 'huozhen', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.4, fleeLine: '姜维：……此人用兵，果然如神。（孔明用计，令姜维进退无路）' }),
    // 第二十八章　街亭
    zhanghe4: E({ name: '张郃', hp: 42000, str: 240, int: 60, spd: 100, def: 154, exp: 13000, gold: 5600, skills: ['chongfeng', 'hengsao', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.3, spec: 'zhanghe', fleeLine: '张郃：王平这支兵，进退有法……不追了。' }),
    simayi1: E({ name: '司马懿', hp: 30000, str: 214, int: 110, spd: 96, def: 146, exp: 12000, gold: 5000, skills: ['zhongda', 'luanjian'], skillRate: 0.5, boss: true, fleeAt: 0.8, spec: 'simayi', fleeLine: '司马懿：（勒马狐疑）……前军作后军，后军作前军，速退！' }),
    // 第二十九章　陈仓
    haozhao: E({ name: '郝昭', hp: 44000, str: 236, int: 70, spd: 90, def: 162, exp: 14000, gold: 6000, skills: ['leishi', 'luanjian', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.3, fleeLine: '郝昭：陈仓城坚，汝便攻二十日，也休想进来！' }),
    wangshuang: E({ name: '王双', hp: 10500, str: 212, int: 20, spd: 92, def: 150, exp: 10000, gold: 4400, skills: ['liuxing', 'kaishan'], skillRate: 0.45, boss: true, noDouble: true }),
    // 第三十章　卤城
    guohuai: E({ name: '郭淮', hp: 40000, str: 238, int: 70, spd: 96, def: 154, exp: 14000, gold: 6000, skills: ['luanjian', 'chongfeng', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.3, fleeLine: '郭淮：陇上神兵……退！' }),
    simayi2: E({ name: '司马懿', hp: 50000, str: 228, int: 116, spd: 100, def: 156, exp: 16000, gold: 7000, skills: ['zhongda', 'luanjian', 'nuhou'], skillRate: 0.5, boss: true, fleeAt: 0.3, spec: 'simayi', fleeLine: '司马懿：坚守营寨，不许出战！' }),
    zhanghe5: E({ name: '张郃', hp: 18000, str: 236, int: 60, spd: 100, def: 150, exp: 12000, gold: 5000, skills: ['chongfeng', 'hengsao'], skillRate: 0.45, boss: true, noDouble: true, spec: 'zhanghe' }),
  });
})();
