/* ============================================================
 * 烽烟录 · 第五部数据：关平、周仓；汉中与襄樊的人物、敌军；暂离部将补级
 * ============================================================ */
'use strict';
(function () {
  const CAO = '#24304a', WU = '#a8322a';
  Object.assign(G.SPECS, {
    guanping: { skin: '#eac09a', hair: '#141010', robe: '#2a5a3a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#14301e', hat: 'helmet', hatColor: '#4a5a4a', plume: '#c0392b', armor: '#5a6a5a', weapon: 'sabre', size: 1.06, banner: '#2a5a3a', flag: '关' },
    ganning: { skin: '#d8a880', hair: '#141010', robe: '#8a2a1e', robe2: '#c9a24a', trim: '#c9a24a', pants: '#3a140e', hat: 'band', hatColor: '#c9a24a', armor: '#7a5a4a', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'sabre', size: 1.16, banner: WU, flag: '甘', noBlush: true },
    lvmeng: { skin: '#e0b48a', hair: '#141010', robe: '#a8322a', robe2: '#e8dcc0', trim: '#c9a24a', pants: '#4a1a14', hat: 'helmet', hatColor: '#5a5058', plume: '#e8dcc0', armor: '#7a6a5a', beard: 'full', weapon: 'sword', size: 1.12, banner: WU, flag: '吕', noBlush: true },
    panzhang: { skin: '#c99068', hair: '#120e0d', robe: '#8a2a1e', robe2: '#a08060', trim: '#8a6a3a', pants: '#3a140e', hat: 'helmet', hatColor: '#4a4048', plume: WU, armor: '#5a4a50', beard: 'bristle', brows: 'thick', weapon: 'bigsabre', size: 1.16, banner: WU, flag: '潘', noBlush: true },
    mazhong: { skin: '#d8a880', hair: '#141010', robe: '#8a2a1e', trim: '#c9a24a', pants: '#3a140e', hat: 'helmet', hatColor: '#5a5058', armor: '#6a5a4a', beard: 'thin', weapon: 'spear', size: 1.08, banner: WU, flag: '马', noBlush: true },
    xiahouyuan: { skin: '#e0b088', hair: '#141010', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#4a5460', plume: '#c0392b', armor: '#5a6470', armorMark: '#c9a24a', beard: 'full', brows: 'thick', weapon: 'sabre', size: 1.18, banner: CAO, flag: '夏', noBlush: true },
    pangde: { skin: '#d8a880', hair: '#141010', robe: '#3a3a4a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a1a24', hat: 'helmet', hatColor: '#c8ccd4', plume: '#ffffff', armor: '#9a9ea8', beard: 'full', brows: 'thick', eyes: 'round', weapon: 'bigsabre', size: 1.2, banner: CAO, flag: '庞', noBlush: true },
    huatuo: { skin: '#ecc8a6', hair: '#e8e4dc', robe: '#5a6a4a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#2a3424', hat: 'scholar', hatColor: '#3a4a2a', beard: 'long', beardColor: '#f0ece4', weapon: 'staff', banner: '#5a6a4a' },
    yangxiu: { skin: '#f0caa4', hair: '#141010', robe: '#3a4a6a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#1e2638', hat: 'crown', hatColor: '#111', beard: 'thin', banner: CAO },
    leitong: { skin: '#d8a880', hair: '#141010', robe: '#3a5a3a', trim: '#c9a24a', pants: '#1e2e1e', hat: 'helmet', hatColor: '#4a5448', plume: '#8a1e1e', armor: '#5a6458', beard: 'bristle', weapon: 'spear', size: 1.08, banner: '#3a5a3a', flag: '雷', noBlush: true },
  });
  Object.assign(G.NAMES, {
    guanping: '关平', ganning: '甘宁', lvmeng: '吕蒙', panzhang: '潘璋', mazhong: '马忠', xiahouyuan: '夏侯渊', pangde: '庞德', huatuo: '华佗', yangxiu: '杨修', leitong: '雷铜',
  });

  /* ---------------- 新部将：关平、周仓 ---------------- */
  G.HEROES.guanping = { name: '关平', zi: '定国', title: '关公之子', bio: '关羽义子。随父镇守荆州，屡立战功。', hp: 320, str: 90, int: 60, spd: 76, def: 48, crit: 0.12, wpow: 26, weapon: '大刀', skills: [['jinglong', 1], ['huwei', 1]] };
  G.HEROES.zhoucang = { name: '周仓', zi: '元福', title: '扛刀', bio: '关西人。黑面虬髯，两臂有千斤之力，能于水中伏行。愿为关公执鞭随镫。', hp: 360, str: 94, int: 30, spd: 64, def: 52, crit: 0.14, wpow: 28, weapon: '铁棍', skills: [['kangdao', 1], ['langli', 1]] };
  Object.assign(G.SKILLS, {
    jinglong: { name: '惊龙', cost: 10, target: 'enemy', type: 'multi', hits: 2, pow: 1.05, desc: '关平绝技。刀势如龙，连斩两次。' },
    huwei: { name: '护父', cost: 14, target: 'allies', type: 'buff', desc: '关平振臂一呼：誓死护卫父亲！全军攻击提升三回合。' },
    kangdao: { name: '扛刀', cost: 9, target: 'enemy', type: 'phys', pow: 2.0, desc: '周仓绝技。抡起铁棍猛砸，伤害极大。' },
    langli: { name: '浪里伏行', cost: 16, target: 'enemies', type: 'phys', pow: 0.95, desc: '周仓绝技。从水中伏行而出，扫荡全体敌军。' },
    weizhen: { name: '威震华夏', cost: 26, target: 'enemies', type: 'phys', pow: 1.35, desc: '关羽水淹七军之后，威震华夏。大刀横扫全体敌军。' },
    // 敌方
    jinfan: { name: '锦帆突袭', type: 'multi', target: 'enemy', hits: 3, pow: 0.72 },
    tuodao2: { name: '拖刀计', type: 'phys', target: 'enemy', pow: 2.0 },
    hutou: { name: '虎步关右', type: 'phys', target: 'enemies', pow: 0.85 },
  });
  // 水淹七军之后，关羽习得「威震华夏」
  const baseSkills = G.skillsOf;
  G.skillsOf = id => { const s = baseSkills(id); if (id === 'guanyu' && G.flag('c21_flood') && !s.includes('weizhen')) s.push('weizhen'); return s; };
  const baseNew = G.newState;
  G.newState = () => {
    const s = baseNew();
    Object.assign(s.members, { guanping: { lvl: 1, exp: 0, hp: 320, armor: null }, zhoucang: { lvl: 1, exp: 0, hp: 360, armor: null } });
    return s;
  };

  // 队伍为空的瞬间（换人途中）策略上限按最低值算，避免出现 NaN
  const baseMaxSP = G.maxSP;
  G.maxSP = () => (G.state.party.length ? baseMaxSP() : 16);

  // 暂离多时的部将：等级追上全军（取当前最高等级减一）
  G.catchUp = ids => {
    const mem = G.state.members;
    const top = Math.max(...Object.keys(mem).map(k => mem[k].lvl));
    for (const id of ids) {
      const m = mem[id]; if (!m) continue;
      if (m.lvl < top - 1) { m.lvl = top - 1; m.exp = G.expTo(m.lvl); }
      m.hp = G.stats(id).maxhp;
    }
  };

  Object.assign(G.ITEMS, {
    tianxiang: { name: '天香续命膏', price: 820, type: 'heal', amt: 6500, desc: '恢复一名部将 6500 兵力。' },
    xianlu: { name: '仙露', price: 720, type: 'sp', amt: 260, desc: '恢复 260 点策略值。' },
    qingzhou: { name: '庆功酒宴', price: 1900, type: 'healall', amt: 5000, desc: '恢复全体部将 5000 兵力。' },
    longwen: { name: '龙纹铠', price: 18000, type: 'armor', def: 200, desc: '汉中王府所铸，甲片錾刻龙纹。防御 +200。' },
  });

  const E = o => o;
  Object.assign(G.ENEMIES, {
    // 第十八章　单刀赴会（关羽单人）
    wubing3: E({ name: '东吴刀斧手', hp: 2300, str: 186, int: 30, spd: 76, def: 124, exp: 700, gold: 250, spec: 'wubing' }),
    wugong3: E({ name: '东吴弩手', hp: 2000, str: 180, int: 40, spd: 80, def: 112, exp: 700, gold: 250, skills: ['luanjian'], skillRate: 0.35, spec: 'wugong' }),
    ganning: E({ name: '甘宁', hp: 9200, str: 168, int: 50, spd: 92, def: 120, exp: 5200, gold: 2400, skills: ['jinfan', 'shejian'], skillRate: 0.35, boss: true, noDouble: true, fleeAt: 0.4, fleeLine: '甘宁：好个关云长……让他走吧！再打下去，子敬先生性命难保！' }),
    // 第十九章　定军山
    caobing7: E({ name: '曹军锐士', hp: 2700, str: 200, int: 30, spd: 78, def: 134, exp: 760, gold: 270, spec: 'caobing' }),
    caoqi7: E({ name: '虎豹精骑', hp: 2800, str: 206, int: 30, spd: 104, def: 136, exp: 780, gold: 275, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    caoshe7: E({ name: '曹军劲弩', hp: 2400, str: 196, int: 40, spd: 82, def: 122, exp: 760, gold: 270, skills: ['luanjian'], skillRate: 0.4, spec: 'caoshe' }),
    zhanghe3: E({ name: '张郃', hp: 30000, str: 196, int: 60, spd: 96, def: 132, exp: 9800, gold: 4800, skills: ['chongfeng', 'hengsao', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, spec: 'zhanghe', fleeLine: '张郃：张飞竟是诈醉！——弃了宕渠寨，走！' }),
    xiahouyuan: E({ name: '夏侯渊', hp: 10500, str: 176, int: 50, spd: 96, def: 124, exp: 7000, gold: 3000, skills: ['hutou', 'shejian'], skillRate: 0.35, boss: true, noDouble: true }),
    // 第二十章　汉中王
    xuhuang2: E({ name: '徐晃', hp: 10500, str: 176, int: 50, spd: 86, def: 126, exp: 6000, gold: 2600, skills: ['kaishan', 'hengsao'], skillRate: 0.35, boss: true, noDouble: true, fleeAt: 0.4, spec: 'xuhuang', fleeLine: '徐晃：营门大开，寂无一人……必有伏兵！退！' }),
    xuchu4: E({ name: '许褚', hp: 26000, str: 204, int: 30, spd: 86, def: 136, exp: 8000, gold: 3600, skills: ['hengsao', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, spec: 'xuchu', fleeLine: '许褚：护驾！护驾！' }),
    caocao: E({ name: '曹操', hp: 42000, str: 206, int: 96, spd: 90, def: 134, exp: 12000, gold: 6000, skills: ['huozhen', 'luanjian', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.3, fleeLine: '魏延一箭射来，正中曹操人中，折却门牙两个！曹操翻身落马——' }),
    // 第二十一章　水淹七军
    caobing8: E({ name: '樊城守军', hp: 3000, str: 210, int: 30, spd: 80, def: 140, exp: 820, gold: 290, spec: 'caobing' }),
    caoshe8: E({ name: '樊城弩手', hp: 2600, str: 204, int: 40, spd: 84, def: 128, exp: 820, gold: 290, skills: ['luanjian'], skillRate: 0.4, spec: 'caoshe' }),
    caoren2: E({ name: '曹仁', hp: 32000, str: 204, int: 60, spd: 86, def: 142, exp: 11000, gold: 5000, skills: ['hengsao', 'nuhou', 'luanjian'], skillRate: 0.4, boss: true, fleeAt: 0.3, spec: 'caoren', fleeLine: '曹仁：坚守樊城，不得出战！' }),
    pangde: E({ name: '庞德', hp: 11000, str: 182, int: 40, spd: 90, def: 128, exp: 7000, gold: 3000, skills: ['tuodao2', 'shejian'], skillRate: 0.35, boss: true, noDouble: true, fleeAt: 0.5, fleeLine: '庞德拖刀诈败，回身拈弓一箭，正中关公左臂！关平急救回营。' }),
    yujin2: E({ name: '于禁', hp: 28000, str: 200, int: 60, spd: 82, def: 136, exp: 10000, gold: 4400, skills: ['luanjian', 'hengsao'], skillRate: 0.4, boss: true, fleeAt: 0.35, spec: 'yujin', fleeLine: '于禁：四面皆水……罢了，罢了！愿降！' }),
    pangde2: E({ name: '庞德', hp: 9500, str: 178, int: 40, spd: 80, def: 126, exp: 7000, gold: 3000, skills: ['tuodao2'], skillRate: 0.35, boss: true, noDouble: true, spec: 'pangde' }),
    // 第二十二章　麦城
    xuhuang3: E({ name: '徐晃', hp: 22000, str: 206, int: 50, spd: 88, def: 140, exp: 9000, gold: 4000, skills: ['kaishan', 'hengsao', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, spec: 'xuhuang', fleeLine: '徐晃：云长，今日是国家之事，徐晃不敢以私废公！（樊城曹仁亦杀出，关公腹背受敌）' }),
    wubing4: E({ name: '东吴伏兵', hp: 2800, str: 206, int: 30, spd: 80, def: 136, exp: 800, gold: 280, spec: 'wubing' }),
    wugong4: E({ name: '东吴弩手', hp: 2500, str: 200, int: 40, spd: 84, def: 124, exp: 800, gold: 280, skills: ['luanjian'], skillRate: 0.4, spec: 'wugong' }),
    panzhang: E({ name: '潘璋', hp: 20000, str: 204, int: 40, spd: 86, def: 134, exp: 9000, gold: 4000, skills: ['kaishan', 'hengsao'], skillRate: 0.4, boss: true, fleeAt: 0.3, fleeLine: '潘璋：关公勇不可当……放绊马索！' }),
  });
})();
