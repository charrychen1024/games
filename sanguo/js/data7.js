/* ============================================================
 * 烽烟录 · 第六部数据：关兴、张苞；夷陵吴军、南中蛮兵；藤甲兵（刀枪不入、遇火即燃）
 * ============================================================ */
'use strict';
(function () {
  const WU = '#a8322a', MAN = '#6a3a1a';
  Object.assign(G.SPECS, {
    guanxing: { skin: '#eec7a0', hair: '#141010', robe: '#2a6a3a', robe2: '#e8dcc0', trim: '#c9a24a', pants: '#14301e', hat: 'helmet', hatColor: '#4a6a4a', plume: '#c0392b', armor: '#6a7a6a', weapon: 'glaive', size: 1.04, banner: '#2a6a3a', flag: '关' },
    zhangbao2: { skin: '#d8a880', hair: '#120e0d', robe: '#2a2a3a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#14141e', hat: 'helmet', hatColor: '#3a3a4a', plume: '#8a1e1e', armor: '#4a4a5a', brows: 'thick', eyes: 'round', weapon: 'snake', size: 1.06, banner: '#2a2a3a', flag: '张', noBlush: true },
    luxun: { skin: '#f4d6b8', hair: '#141010', robe: '#a8322a', robe2: '#f0e0c0', trim: '#e8c86a', pants: '#4a1a14', hat: 'scholar', hatColor: '#5a1a14', beard: 'thin', weapon: 'sword', banner: WU, flag: '陆' },
    zhuran: { skin: '#e0b48a', hair: '#141010', robe: '#8a2a1e', robe2: '#c9a24a', trim: '#c9a24a', pants: '#3a140e', hat: 'helmet', hatColor: '#5a5058', plume: '#e8c86a', armor: '#6a5a4a', beard: 'full', weapon: 'spear', size: 1.12, banner: WU, flag: '朱', noBlush: true },
    shamoke: { skin: '#a86a44', hair: '#120e0d', robe: '#8a3a1a', robe2: '#c8a050', trim: '#e0b050', pants: '#3a1a0a', hat: 'band', hatColor: '#c8a050', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'axe', size: 1.2, banner: MAN, flag: '沙', noBlush: true },
    huangchengyan: { skin: '#ecc8a6', hair: '#e8e4dc', robe: '#5a5a4a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#2a2a20', hat: 'straw', beard: 'long', beardColor: '#f0ece4', weapon: 'staff', banner: '#5a5a4a' },
    liushan: { skin: '#f4d6b8', hair: '#141010', robe: '#c8a02a', robe2: '#8a1e1e', trim: '#8a1e1e', pants: '#4a3a1a', hat: 'crown', hatColor: '#111', size: 0.96, banner: '#8a1e1e' },
    masu: { skin: '#f0caa4', hair: '#141010', robe: '#3a4a6a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#1e2638', hat: 'scholar', hatColor: '#1e2638', beard: 'thin', weapon: 'fan', banner: '#3a4a6a' },
    menghuo: { skin: '#a86a44', hair: '#120e0d', robe: '#8a3a1a', robe2: '#e0b050', trim: '#e0b050', pants: '#3a1a0a', hat: 'feather', hatColor: '#e0b050', plume: '#c0392b', armor: '#8a6a3a', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'halberd', size: 1.3, banner: MAN, flag: '孟', noBlush: true },
    zhurong: { skin: '#c88a5a', hair: '#141010', robe: '#a83a2a', robe2: '#e0b050', trim: '#e0b050', pants: '#4a1a0e', hat: 'hairF', hatColor: '#e0b050', armor: '#a07040', weapon: 'spear', size: 1.1, banner: MAN, flag: '祝', noBlush: true },
    mulu: { skin: '#8a5a3a', hair: '#120e0d', robe: '#4a2a1a', robe2: '#c8a050', trim: '#c8a050', pants: '#2a1408', hat: 'turban', hatColor: '#e0d0a0', beard: 'full', eyes: 'round', weapon: 'staff', size: 1.14, banner: MAN, flag: '木', noBlush: true },
    wutugu: { skin: '#7a5a3a', hair: '#120e0d', robe: '#6a5a2a', robe2: '#a89050', trim: '#a89050', pants: '#3a2a10', hat: 'band', hatColor: '#6a5a2a', armor: '#8a7a3a', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'axe', size: 1.42, banner: MAN, flag: '兀', noBlush: true },
    manbing: { skin: '#a86a44', hair: '#120e0d', robe: '#8a3a1a', trim: '#c8a050', pants: '#3a1a0a', hat: 'band', hatColor: '#c8a050', weapon: 'spear', banner: MAN },
    tengjia: { skin: '#8a6a4a', hair: '#120e0d', robe: '#9a8040', robe2: '#c8a860', trim: '#c8a860', pants: '#4a3a18', hat: 'helmet', hatColor: '#9a8040', armor: '#a89048', weapon: 'sabre', size: 1.12, banner: MAN },
  });
  Object.assign(G.NAMES, {
    guanxing: '关兴', zhangbao2: '张苞', luxun: '陆逊', zhuran: '朱然', shamoke: '沙摩柯', huangchengyan: '黄承彦', liushan: '刘禅', masu: '马谡',
    menghuo: '孟获', zhurong: '祝融夫人', mulu: '木鹿大王', wutugu: '兀突骨', manbing: '蛮兵', tengjia: '藤甲兵',
  });

  /* ---------------- 新部将：关兴、张苞 ---------------- */
  G.HEROES.guanxing = { name: '关兴', zi: '安国', title: '关公次子', bio: '关羽次子。少有令闻，使一口青龙刀，颇有父风。', hp: 330, str: 95, int: 62, spd: 78, def: 48, crit: 0.14, wpow: 30, weapon: '青龙偃月刀', skills: [['zhanjiang', 1], ['xiaoxiong', 1]] };
  G.HEROES.zhangbao2 = { name: '张苞', zi: '', title: '张飞长子', bio: '张飞之子。使一条丈八点钢矛，勇猛似父。', hp: 350, str: 97, int: 34, spd: 72, def: 50, crit: 0.16, wpow: 30, weapon: '丈八点钢矛', skills: [['nuhe', 1], ['baochou', 1]] };
  Object.assign(G.SKILLS, {
    xiaoxiong: { name: '骁雄', cost: 18, target: 'enemies', type: 'phys', pow: 1.05, desc: '关兴绝技。父仇在心，刀锋所向，横扫全体敌军。' },
    baochou: { name: '报仇雪恨', cost: 12, target: 'enemy', type: 'multi', hits: 3, pow: 0.85, desc: '张苞绝技。一矛接一矛，连刺三次。' },
    // 敌方
    fenying: { name: '火烧连营', type: 'fire', target: 'enemies', pow: 1.7 },
    feidao2: { name: '飞刀', type: 'multi', target: 'enemy', hits: 3, pow: 0.7 },
    yeshou: { name: '驱兽', type: 'phys', target: 'enemies', pow: 0.9 },
    zhangqi: { name: '瘴气', type: 'fire', target: 'enemies', pow: 1.3 },
  });
  const baseNew = G.newState;
  G.newState = () => {
    const s = baseNew();
    Object.assign(s.members, { guanxing: { lvl: 1, exp: 0, hp: 330, armor: null }, zhangbao2: { lvl: 1, exp: 0, hp: 350, armor: null } });
    return s;
  };

  /* ---------------- 藤甲兵：刀枪不入，遇火即燃 ---------------- */
  // battle.js 在本文件之后加载，等页面加载完再挂上
  const patchTengjia = () => {
    const BP = G.BattleScene.prototype;
    if (BP._tengjia) return; BP._tengjia = true;
    const basePhys = BP.physDmg, baseFire = BP.fireDmg;
    BP.physDmg = function (u, t, mult) {
      const r = basePhys.call(this, u, t, mult);
      if (t.def0 && t.def0.tengjia) { r.d = Math.max(6, Math.round(r.d * 0.2)); if (!this._tjTip) { this._tjTip = 1; this.float(t, '刀枪不入', '#d8c070', 24); } }
      return r;
    };
    BP.fireDmg = function (u, t, pow) {
      const d = baseFire.call(this, u, t, pow);
      if (t.def0 && t.def0.tengjia) { this.float(t, '藤甲着火！', '#ff9040', 22); return Math.round(d * 2.6); }
      return d;
    };
  };
  if (G.BattleScene) patchTengjia(); else window.addEventListener('load', patchTengjia);

  Object.assign(G.ITEMS, {
    huixin: { name: '回心丹', price: 1000, type: 'heal', amt: 8000, desc: '恢复一名部将 8000 兵力。' },
    yuquan: { name: '玉泉水', price: 860, type: 'sp', amt: 320, desc: '恢复 320 点策略值。' },
    nanzhong: { name: '南中解瘴汤', price: 2400, type: 'healall', amt: 6200, desc: '万安溪边的药泉所熬。恢复全体部将 6200 兵力。' },
    wuxing: { name: '五行连环铠', price: 24000, type: 'armor', def: 240, desc: '诸葛丞相亲自督造。防御 +240。' },
  });

  const E = o => o;
  Object.assign(G.ENEMIES, {
    // 第二十三章　猇亭
    wubing5: E({ name: '东吴精兵', hp: 3100, str: 214, int: 30, spd: 82, def: 142, exp: 860, gold: 300, spec: 'wubing' }),
    wugong5: E({ name: '东吴劲弩', hp: 2700, str: 208, int: 40, spd: 86, def: 130, exp: 860, gold: 300, skills: ['luanjian'], skillRate: 0.4, spec: 'wugong' }),
    panzhang2: E({ name: '潘璋', hp: 9800, str: 184, int: 40, spd: 88, def: 132, exp: 6000, gold: 2600, skills: ['kaishan'], skillRate: 0.35, boss: true, noDouble: true, spec: 'panzhang' }),
    mazhong: E({ name: '马忠', hp: 24000, str: 210, int: 50, spd: 90, def: 138, exp: 9000, gold: 4000, skills: ['luanjian', 'shejian', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, fleeLine: '马忠：（暗处一箭射中黄忠肩窝）……老卒，也该歇歇了！撤！' }),
    // 第二十四章　火烧连营
    wubing6: E({ name: '东吴火攻兵', hp: 3200, str: 218, int: 50, spd: 84, def: 142, exp: 900, gold: 310, skills: ['huozhen'], skillRate: 0.3, spec: 'wubing' }),
    zhuran: E({ name: '朱然', hp: 26000, str: 216, int: 50, spd: 92, def: 140, exp: 9600, gold: 4200, skills: ['luanjian', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.25, fleeLine: '赵云一枪刺朱然于马下！' }),
    luxun: E({ name: '陆逊', hp: 30000, str: 190, int: 104, spd: 92, def: 136, exp: 11000, gold: 5000, skills: ['fenying', 'huozhen', 'luanjian'], skillRate: 0.5, boss: true, fleeAt: 0.3, fleeLine: '陆逊：前面山上似有杀气……收兵！' }),
    // 第二十五、二十六章　南中
    manbing: E({ name: '蛮兵', hp: 3300, str: 222, int: 20, spd: 86, def: 140, exp: 920, gold: 320, spec: 'manbing' }),
    mangong: E({ name: '蛮族弩手', hp: 2900, str: 214, int: 30, spd: 90, def: 128, exp: 920, gold: 320, skills: ['luanjian'], skillRate: 0.4, spec: 'manbing' }),
    manwu: E({ name: '蛮族巫师', hp: 2600, str: 180, int: 90, spd: 84, def: 120, exp: 940, gold: 330, skills: ['zhangqi'], skillRate: 0.45, spec: 'mulu' }),
    menghuo1: E({ name: '孟获', hp: 30000, str: 226, int: 40, spd: 86, def: 138, exp: 8000, gold: 3600, skills: ['hengsao', 'chongfeng'], skillRate: 0.4, boss: true, fleeAt: 0.3, spec: 'menghuo', fleeLine: '孟获拨马便走，一头撞进魏延的伏兵里——' }),
    menghuo2: E({ name: '孟获', hp: 34000, str: 230, int: 40, spd: 88, def: 140, exp: 8600, gold: 3800, skills: ['hengsao', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, spec: 'menghuo', fleeLine: '孟获：怎么又是你们！——（脚下一软，跌进陷坑）' }),
    zhurong: E({ name: '祝融夫人', hp: 16000, str: 214, int: 50, spd: 98, def: 132, exp: 8000, gold: 3600, skills: ['feidao2'], skillRate: 0.45, boss: true, noDouble: true, fleeAt: 0.35, fleeLine: '祝融夫人飞刀落空，被绊马索绊倒，生擒过来！' }),
    mulu: E({ name: '木鹿大王', hp: 36000, str: 224, int: 90, spd: 86, def: 138, exp: 9600, gold: 4400, skills: ['yeshou', 'zhangqi', 'nuhou'], skillRate: 0.5, boss: true, fleeAt: 0.3, fleeLine: '孔明的木兽口中喷火，鼻中出烟——蛮兵的虎豹豺狼，掉头便逃！' }),
    tengjia: E({ name: '藤甲兵', hp: 3600, str: 226, int: 20, spd: 80, def: 150, exp: 1000, gold: 340, tengjia: true, spec: 'tengjia' }),
    wutugu: E({ name: '兀突骨', hp: 14000, str: 230, int: 20, spd: 78, def: 150, exp: 10000, gold: 4600, skills: ['kaishan', 'hengsao'], skillRate: 0.4, boss: true, tengjia: true }),
    menghuo3: E({ name: '孟获', hp: 40000, str: 236, int: 40, spd: 90, def: 142, exp: 10000, gold: 5000, skills: ['hengsao', 'chongfeng', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.25, spec: 'menghuo', fleeLine: '孟获：……七纵七擒，自古未尝有也。' }),
  });
})();
