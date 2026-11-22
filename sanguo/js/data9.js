/* ============================================================
 * 烽烟录 · 第八部数据：马岱、廖化、夏侯霸、诸葛瞻；五丈原到三分归晋
 * ============================================================ */
'use strict';
(function () {
  const WEI = '#24304a';
  Object.assign(G.SPECS, {
    liaohua: { skin: '#d8a880', hair: '#3a3430', robe: '#5a3a2a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#2a1a10', hat: 'helmet', hatColor: '#5a5048', plume: '#8a1e1e', armor: '#6a5a4a', beard: 'full', beardColor: '#6a6058', weapon: 'sabre', size: 1.06, banner: '#5a3a2a', flag: '廖', noBlush: true },
    xiahouba: { skin: '#e0b088', hair: '#141010', robe: '#3a3a5a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1e1e30', hat: 'helmet', hatColor: '#4a4a5a', plume: '#c0392b', armor: '#5a5a6a', beard: 'full', brows: 'thick', weapon: 'spear', size: 1.12, banner: '#3a3a5a', flag: '霸', noBlush: true },
    zhugezhan: { skin: '#f2d0ae', hair: '#141010', robe: '#e8e6dc', robe2: '#2a3a5a', trim: '#2a3a5a', pants: '#3a4050', hat: 'helmet', hatColor: '#5a6a7a', plume: '#e8e6dc', armor: '#8a9aaa', weapon: 'sword', size: 1.04, banner: '#2a3a5a', flag: '诸' },
    simazhao: { skin: '#ecc8a6', hair: '#141010', robe: '#1e2a44', robe2: '#c9a24a', trim: '#c9a24a', pants: '#121a2a', hat: 'helmet', hatColor: '#3a4454', plume: '#c9a24a', armor: '#4a5464', beard: 'thin', weapon: 'sword', size: 1.08, banner: WEI, flag: '昭', noBlush: true },
    dengai: { skin: '#d8a880', hair: '#141010', robe: '#2a3a4a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c26', hat: 'helmet', hatColor: '#4a5460', plume: '#2a3a4a', armor: '#5a6470', beard: 'full', brows: 'thick', weapon: 'spear', size: 1.14, banner: WEI, flag: '邓', noBlush: true },
    zhonghui: { skin: '#f0caa4', hair: '#141010', robe: '#3a4a7a', robe2: '#e8dcc0', trim: '#c9a24a', pants: '#1e2640', hat: 'crown', hatColor: '#111', beard: 'thin', weapon: 'sword', size: 1.04, banner: WEI, flag: '钟' },
    wangjing: { skin: '#eec7a0', hair: '#141010', robe: '#2f4a7a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1e2a40', hat: 'helmet', hatColor: '#5a6470', plume: '#2f4a7a', armor: '#6a7480', beard: 'goatee', weapon: 'sword', size: 1.06, banner: WEI, flag: '王', noBlush: true },
  });
  Object.assign(G.NAMES, { liaohua: '廖化', xiahouba: '夏侯霸', zhugezhan: '诸葛瞻', simazhao: '司马昭', dengai: '邓艾', zhonghui: '钟会', wangjing: '王经' });

  /* ---------------- 新部将 ---------------- */
  G.HEROES.madai = { name: '马岱', zi: '', title: '西凉之后', bio: '马超从弟。随兄归蜀，忠勇谨慎。孔明临终授以密计。', hp: 350, str: 94, int: 56, spd: 86, def: 52, crit: 0.13, wpow: 28, weapon: '大刀 · 弓', skills: [['tuqiang2', 1], ['tieqi', 1]] };
  G.HEROES.liaohua = { name: '廖化', zi: '元俭', title: '老将', bio: '襄阳人。早年随关公镇守荆州，麦城突围求救。历事三代，年逾七十，仍在军中。', hp: 360, str: 90, int: 60, spd: 72, def: 54, crit: 0.12, wpow: 26, weapon: '长刀', skills: [['zhanjiang', 1], ['jianshou', 1]] };
  G.HEROES.xiahouba = { name: '夏侯霸', zi: '仲权', title: '降将', bio: '夏侯渊之子。司马懿夺权后投蜀，后主以其为车骑将军。', hp: 350, str: 96, int: 58, spd: 80, def: 52, crit: 0.14, wpow: 30, weapon: '长枪', skills: [['qilin', 1], ['wuxie', 1]] };
  G.HEROES.zhugezhan = { name: '诸葛瞻', zi: '思远', title: '武侯之子', bio: '诸葛亮之子。工书画，强识念，蜀人追思孔明，咸爱其才。', hp: 300, str: 70, int: 96, spd: 74, def: 46, crit: 0.08, wpow: 18, weapon: '佩剑', skills: [['huoji', 1], ['liehuo', 1], ['bagua', 1], ['jiuyuan', 1]] };
  Object.assign(G.SKILLS, {
    tuqiang2: { name: '回马箭', cost: 12, target: 'enemy', type: 'phys', pow: 2.1, desc: '马岱绝技。佯败回身，一箭射去。' },
    qixing: { name: '丞相遗策', cost: 40, target: 'allies', type: 'heal', pow: 3.0, desc: '姜维得孔明临终所传兵书二十四篇。按书布阵，全军兵力大幅恢复。' },
    // 敌方
    fanshi: { name: '反骨', type: 'multi', target: 'enemy', hits: 3, pow: 0.9 },
    yinping: { name: '裹毡而下', type: 'phys', target: 'enemies', pow: 1.0 },
  });
  // 孔明临终传书之后，姜维习得「丞相遗策」
  const baseSkills = G.skillsOf;
  G.skillsOf = id => { const s = baseSkills(id); if (id === 'jiangwei' && G.flag('c32_book') && !s.includes('qixing')) s.push('qixing'); return s; };
  const baseNew = G.newState;
  G.newState = () => {
    const s = baseNew();
    Object.assign(s.members, { madai: { lvl: 1, exp: 0, hp: 350, armor: null }, liaohua: { lvl: 1, exp: 0, hp: 360, armor: null }, xiahouba: { lvl: 1, exp: 0, hp: 350, armor: null }, zhugezhan: { lvl: 1, exp: 0, hp: 300, armor: null } });
    return s;
  };

  Object.assign(G.ITEMS, {
    shenyao: { name: '神农百草丹', price: 1600, type: 'heal', amt: 12000, desc: '恢复一名部将 12000 兵力。' },
    lingzhi: { name: '灵芝露', price: 1300, type: 'sp', amt: 460, desc: '恢复 460 点策略值。' },
    hanjia: { name: '汉家犒军', price: 3600, type: 'healall', amt: 10000, desc: '恢复全体部将 10000 兵力。' },
    zhaolie: { name: '昭烈铠', price: 42000, type: 'armor', def: 340, desc: '以先帝旧甲重铸。防御 +340。' },
  });

  const E = o => o;
  Object.assign(G.ENEMIES, {
    // 第三十一章　上方谷
    weibing2: E({ name: '魏国精兵', hp: 4000, str: 246, int: 30, spd: 90, def: 160, exp: 1080, gold: 370, spec: 'weibing' }),
    weiqi2: E({ name: '魏国铁骑', hp: 4200, str: 254, int: 30, spd: 112, def: 162, exp: 1100, gold: 375, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    weinu2: E({ name: '魏国强弩', hp: 3700, str: 242, int: 40, spd: 94, def: 148, exp: 1080, gold: 370, skills: ['luanjian'], skillRate: 0.4, spec: 'caoshe' }),
    simazhao: E({ name: '司马昭', hp: 44000, str: 244, int: 90, spd: 98, def: 158, exp: 15000, gold: 6500, skills: ['luanjian', 'zhongda', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.3, fleeLine: '司马昭：父亲！粮车里都是木头——中计了！' }),
    simayi3: E({ name: '司马懿', hp: 56000, str: 236, int: 120, spd: 102, def: 162, exp: 18000, gold: 8000, skills: ['zhongda', 'luanjian', 'nuhou'], skillRate: 0.5, boss: true, fleeAt: 0.3, spec: 'simayi', fleeLine: '谷中火光冲天——忽然狂风大作，黑气漫空，一声霹雳响处，骤雨倾盆！满谷之火，尽皆浇灭……' }),
    // 第三十二章　五丈原
    weiyan2: E({ name: '魏延', hp: 22000, str: 248, int: 50, spd: 96, def: 156, exp: 15000, gold: 6000, skills: ['fanshi', 'kaishan', 'nuhou'], skillRate: 0.45, boss: true, noDouble: true, spec: 'weiyan' }),
    // 第三十三章　洮西
    wangjing: E({ name: '王经', hp: 46000, str: 246, int: 70, spd: 96, def: 160, exp: 16000, gold: 7000, skills: ['luanjian', 'hengsao', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.3, fleeLine: '王经：洮水……我军尽没洮水之中！退守狄道！' }),
    dengai1: E({ name: '邓艾', hp: 56000, str: 254, int: 100, spd: 100, def: 166, exp: 18000, gold: 8000, skills: ['luanjian', 'chongfeng', 'zhongda'], skillRate: 0.5, boss: true, fleeAt: 0.3, spec: 'dengai', fleeLine: '邓艾：艾……艾早料姜维必……必来此处。今日且退。' }),
    // 第三十四章　终章
    weibing3: E({ name: '阴平奇兵', hp: 4400, str: 260, int: 30, spd: 96, def: 166, exp: 1150, gold: 390, skills: ['yinping'], skillRate: 0.3, spec: 'weibing' }),
    dengai2: E({ name: '邓艾', hp: 16000, str: 236, int: 100, spd: 96, def: 156, exp: 18000, gold: 8000, skills: ['luanjian', 'yinping'], skillRate: 0.4, boss: true, noDouble: true, fleeAt: 0.4, spec: 'dengai', fleeLine: '邓艾：（暂退）……诸葛瞻有乃父之风。传令：四面合围！' }),
    zhonghui: E({ name: '钟会', hp: 64000, str: 252, int: 110, spd: 102, def: 168, exp: 20000, gold: 9000, skills: ['zhongda', 'luanjian', 'chongfeng', 'nuhou'], skillRate: 0.5, boss: true, fleeAt: 0.3, fleeLine: '钟会：（叹）姜伯约，真天下奇才也……剑阁，过不去了。' }),
  });
})();
