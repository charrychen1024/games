/* ============================================================
 * 烽烟录 · 第四部数据：孙夫人、庞统、魏延、马超；西川人物与敌军
 * ============================================================ */
'use strict';
(function () {
  const WU = '#a8322a', SHU = '#3a5a3a', XL = '#c8c4b0';
  Object.assign(G.SPECS, {
    sunshangxiang: { skin: '#f6d8bc', hair: '#141010', robe: '#c0302a', robe2: '#f0dcc0', trim: '#e8c86a', pants: '#5a1a14', hat: 'hairF', hatColor: '#e8c86a', armor: '#c8a070', weapon: 'sword', banner: WU, flag: '孙' },
    wuguotai: { skin: '#eccaa8', hair: '#d8d4cc', robe: '#6a2a3a', robe2: '#e8d8b0', trim: '#d6b45c', pants: '#3a141e', hat: 'hairF', hatColor: '#d6b45c', banner: WU },
    qiaoguolao: { skin: '#ecc8a6', hair: '#e8e4dc', robe: '#5a4a2a', robe2: '#e8dcc0', trim: '#c8b090', pants: '#2a2214', hat: 'crown', hatColor: '#111', beard: 'long', beardColor: '#f0ece4', banner: WU },
    jiahua: { skin: '#d8a880', hair: '#141010', robe: '#8a2a1e', robe2: '#c9a24a', trim: '#c9a24a', pants: '#3a140e', hat: 'helmet', hatColor: '#5a5058', plume: WU, armor: '#6a5a4a', beard: 'bristle', weapon: 'axe', size: 1.14, banner: WU, flag: '贾', noBlush: true },
    pangtong: { skin: '#c89a74', hair: '#141010', robe: '#4a4a3a', robe2: '#c8b890', trim: '#a89870', pants: '#24241a', hat: 'scholar', hatColor: '#2a2a1e', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'fan', banner: '#4a4a3a', flag: '庞', noBlush: true },
    zhangsong: { skin: '#d8b08a', hair: '#141010', robe: '#5a5a3a', robe2: '#e0d0b0', trim: '#c8b090', pants: '#2a2a1a', hat: 'crown', hatColor: '#222', beard: 'goatee', size: 0.86, banner: SHU },
    fazheng: { skin: '#eec7a0', hair: '#141010', robe: '#3a5a4a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#1e2e24', hat: 'scholar', hatColor: '#1e2e24', beard: 'thin', banner: SHU },
    liuzhang: { skin: '#f0caa4', hair: '#141010', robe: '#6a5a2a', robe2: '#e8d8a0', trim: '#e8c86a', pants: '#3a2e14', hat: 'crown', hatColor: '#1a1a1a', beard: 'thin', size: 1.04, banner: SHU },
    adou: { skin: '#f6dcc0', hair: '#141010', robe: '#c8a02a', robe2: '#8a1e1e', trim: '#8a1e1e', pants: '#4a3a1a', hat: 'twin', size: 0.62, banner: '#8a1e1e' },
    zhoushan: { skin: '#c88e62', hair: '#120e0d', robe: '#8a2a1e', robe2: '#a08060', trim: '#7a5a3a', pants: '#3a140e', hat: 'band', hatColor: WU, beard: 'bristle', brows: 'thick', weapon: 'sabre', size: 1.14, banner: WU, flag: '周', noBlush: true },
    shubing: { skin: '#e3b88f', hair: '#141010', robe: SHU, trim: '#a0b090', pants: '#1e2e1e', hat: 'helmet', hatColor: '#5a6450', armor: '#6a7460', weapon: 'spear', banner: SHU },
    yanghuai: { skin: '#e0b48a', hair: '#141010', robe: '#2a4a3a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#14241a', hat: 'helmet', hatColor: '#4a5448', plume: SHU, armor: '#5a6458', beard: 'thin', weapon: 'sword', size: 1.1, banner: SHU, flag: '杨', noBlush: true },
    gaopei: { skin: '#c99068', hair: '#120e0d', robe: '#2a4a3a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#14241a', hat: 'helmet', hatColor: '#4a5448', plume: '#c9a24a', armor: '#5a6458', beard: 'full', weapon: 'sabre', size: 1.12, banner: SHU, flag: '高', noBlush: true },
    lengbao: { skin: '#d8a880', hair: '#141010', robe: '#2a4a3a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#14241a', hat: 'helmet', hatColor: '#3a4438', plume: '#8a2a1a', armor: '#4a5448', beard: 'bristle', brows: 'thick', weapon: 'bigsabre', size: 1.16, banner: SHU, flag: '冷', noBlush: true },
    zhangren: { skin: '#e0b088', hair: '#141010', robe: '#1e3a2a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#10201a', hat: 'helmet', hatColor: '#3a4438', plume: '#e8e0c8', armor: '#4a5448', armorMark: '#c9a24a', beard: 'full', brows: 'thick', weapon: 'spear', size: 1.2, banner: SHU, flag: '张', noBlush: true },
    yanyan: { skin: '#e0b088', hair: '#e8e4dc', robe: '#2a4a3a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#14241a', hat: 'helmet', hatColor: '#6a7068', plume: '#e8e4dc', armor: '#7a8078', beard: 'long', beardColor: '#f0ece4', brows: 'thick', weapon: 'bigsabre', size: 1.14, banner: SHU, flag: '严', noBlush: true },
    machao: { skin: '#f2d2b0', hair: '#141010', robe: '#e8e6e0', robe2: '#c9a24a', trim: '#c9a24a', pants: '#3a3a44', hat: 'helmet', hatColor: '#c8ccd4', plume: '#ffffff', armor: '#d0d4dc', armorMark: '#c9a24a', brows: 'thick', weapon: 'spear', size: 1.18, banner: XL, flag: '马', noBlush: true },
    madai: { skin: '#e8be98', hair: '#141010', robe: '#c8c4b0', robe2: '#8a6a3a', trim: '#8a6a3a', pants: '#3a3428', hat: 'helmet', hatColor: '#9a9a90', plume: '#8a2a1a', armor: '#a8a89c', beard: 'thin', weapon: 'sabre', size: 1.12, banner: XL, flag: '岱', noBlush: true },
    xiliang: { skin: '#d8a880', hair: '#141010', robe: '#8a7a5a', trim: '#c8b890', pants: '#3a3020', hat: 'helmet', hatColor: '#8a8478', armor: '#9a9488', weapon: 'spear', banner: XL },
    shugong: { skin: '#e0b48a', hair: '#141010', robe: '#3a5a3a', robe2: '#c8c0a0', trim: '#a0b090', pants: '#1e2e1e', hat: 'band', hatColor: '#3a5a3a', weapon: 'staff', banner: SHU },
    wugong: { skin: '#e0b48a', hair: '#141010', robe: '#a8322a', robe2: '#c8c0a0', trim: '#e0b070', pants: '#4a1a14', hat: 'band', hatColor: '#a8322a', weapon: 'staff', banner: WU },
    jinggong: { skin: '#e0b48a', hair: '#141010', robe: '#5a4a2a', robe2: '#c8c0a0', trim: '#a89070', pants: '#2a2214', hat: 'band', hatColor: '#5a4a2a', weapon: 'staff', banner: '#5a4a2a' },
    lihui: { skin: '#eec7a0', hair: '#141010', robe: '#4a3a5a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#24182e', hat: 'scholar', hatColor: '#24182e', beard: 'goatee', banner: SHU },
  });
  Object.assign(G.NAMES, {
    sunshangxiang: '孙夫人', wuguotai: '吴国太', qiaoguolao: '乔国老', jiahua: '贾华', pangtong: '庞统', zhangsong: '张松', fazheng: '法正', liuzhang: '刘璋', adou: '阿斗',
    zhoushan: '周善', shubing: '蜀军', yanghuai: '杨怀', gaopei: '高沛', lengbao: '冷苞', zhangren: '张任', yanyan: '严颜', machao: '马超', madai: '马岱', xiliang: '西凉兵', lihui: '李恢',
  });

  /* ---------------- 新部将 ---------------- */
  G.HEROES.sunshangxiang = { name: '孙夫人', zi: '尚香', title: '弓腰姬', bio: '孙权之妹。好观武事，侍婢百余人皆执刀侍立，房中遍列兵器。', hp: 300, str: 86, int: 64, spd: 88, def: 44, crit: 0.14, wpow: 24, weapon: '圈刀 · 雕弓', skills: [['xiaoji', 1], ['jianyu', 1]] };
  G.HEROES.pangtong = { name: '庞统', zi: '士元', title: '凤雏', bio: '襄阳人。浓眉掀鼻，黑面短髯，形容古怪。司马徽称："伏龙、凤雏，两人得一，可安天下。"', hp: 280, str: 38, int: 99, spd: 66, def: 40, crit: 0.05, wpow: 10, weapon: '铁如意', skills: [['huoji', 1], ['liehuo', 1], ['jiuyuan', 1], ['lianhuan', 1]] };
  G.HEROES.weiyan = { name: '魏延', zi: '文长', title: '反骨', bio: '义阳人。勇猛过人，性矜高。孔明说他脑后有反骨。', hp: 350, str: 99, int: 50, spd: 70, def: 50, crit: 0.14, wpow: 30, weapon: '大刀', skills: [['kuanggu', 1], ['ziwu', 1]] };
  G.HEROES.machao = { name: '马超', zi: '孟起', title: '锦马超', bio: '扶风茂陵人。伏波将军马援之后，西凉骁将，人称"锦马超"。', hp: 350, str: 103, int: 42, spd: 92, def: 50, crit: 0.16, wpow: 32, weapon: '虎头湛金枪', skills: [['shenwei', 1], ['tieqi', 1]] };
  Object.assign(G.SKILLS, {
    xiaoji: { name: '枭姬', cost: 12, target: 'enemy', type: 'multi', hits: 3, pow: 0.8, desc: '孙夫人绝技。刀弓并用，连击三次。' },
    jianyu: { name: '箭雨', cost: 18, target: 'enemies', type: 'phys', pow: 0.95, desc: '侍婢百人齐射，箭如雨下，射向全体敌军。' },
    lianhuan: { name: '连环计', cost: 30, target: 'enemies', type: 'fire', pow: 2.5, desc: '庞统绝技。锁住敌阵，再放一把火，烧遍全体敌军。' },
    kuanggu: { name: '狂骨', cost: 9, target: 'enemy', type: 'phys', pow: 2.0, desc: '魏延绝技。不顾一切地猛砍，伤害极大。' },
    ziwu: { name: '子午奇袭', cost: 18, target: 'enemies', type: 'phys', pow: 1.0, desc: '魏延绝技。出奇兵抄袭，冲击全体敌军。' },
    shenwei: { name: '神威', cost: 14, target: 'enemy', type: 'multi', hits: 3, pow: 0.95, desc: '马超绝技。枪出如龙，连刺三次。' },
    tieqi: { name: '西凉铁骑', cost: 20, target: 'enemies', type: 'phys', pow: 1.15, desc: '马超绝技。率西凉铁骑冲阵，践踏全体敌军。' },
    // 敌方
    feidao: { name: '暗藏利刃', type: 'multi', target: 'enemy', hits: 2, pow: 0.9 },
    luanjian: { name: '乱箭齐发', type: 'phys', target: 'enemies', pow: 0.8 },
    juedi: { name: '决堤', type: 'fire', target: 'enemies', pow: 1.5 },
    tuqiang: { name: '突枪', type: 'multi', target: 'enemy', hits: 3, pow: 0.75 },
  });
  const baseNew = G.newState;
  G.newState = () => {
    const s = baseNew();
    Object.assign(s.members, { sunshangxiang: { lvl: 1, exp: 0, hp: 300, armor: null }, pangtong: { lvl: 1, exp: 0, hp: 280, armor: null }, weiyan: { lvl: 1, exp: 0, hp: 350, armor: null }, machao: { lvl: 1, exp: 0, hp: 350, armor: null } });
    return s;
  };
  // 旧存档补齐新成员
  G.ensureMembers = () => { const ref = G.newState().members; for (const k in ref) if (!G.state.members[k]) G.state.members[k] = ref[k]; };

  // 部将离队（阵亡 / 归国）：卸下护甲放回行囊
  G.leaveParty = id => {
    const s = G.state, m = s.members[id];
    s.party = s.party.filter(x => x !== id); s.stash = (s.stash || []).filter(x => x !== id);
    if (m && m.armor) { G.addItem(m.armor); m.armor = null; }
    s.sp = Math.min(s.sp, G.maxSP());
  };

  // 指定出战名单：名单内的从暂离中归队，其余暂离
  G.setParty = list => {
    const s = G.state;
    G.unstash(list);
    const others = s.party.filter(id => !list.includes(id));
    s.stash = (s.stash || []).concat(others.filter(id => !(s.stash || []).includes(id)));
    s.party = list.filter(id => s.party.includes(id));
    s.sp = Math.min(s.sp, G.maxSP());
    if (G.world && G.world.lead) G.world.refreshParty();
  };

  Object.assign(G.ITEMS, {
    xuelian: { name: '雪莲丹', price: 620, type: 'heal', amt: 4800, desc: '采自岷山雪线之上。恢复一名部将 4800 兵力。' },
    yulu: { name: '玉露', price: 540, type: 'sp', amt: 200, desc: '恢复 200 点策略值。' },
    shujin: { name: '蜀锦甲', price: 12000, type: 'armor', def: 160, desc: '蜀锦为衬、精铁为鳞。防御 +160。' },
    dayan: { name: '巴蜀犒赏', price: 1400, type: 'healall', amt: 3800, desc: '恢复全体部将 3800 兵力。' },
  });

  const E = o => o;
  Object.assign(G.ENEMIES, {
    // 第十四章　甘露寺
    wubing2: E({ name: '东吴伏兵', hp: 1800, str: 166, int: 30, spd: 72, def: 112, exp: 520, gold: 190, spec: 'wubing' }),
    wugong: E({ name: '东吴弓手', hp: 1500, str: 160, int: 40, spd: 76, def: 100, exp: 520, gold: 190, skills: ['jiantu'], skillRate: 0.35, spec: 'wugong' }),
    jiahua: E({ name: '贾华', hp: 8000, str: 156, int: 30, spd: 80, def: 108, exp: 3800, gold: 1800, skills: ['kaishan', 'hengsao'], skillRate: 0.35, boss: true, noDouble: true }),
    zhouyu: E({ name: '周瑜', hp: 24000, str: 164, int: 100, spd: 90, def: 118, exp: 7800, gold: 4000, skills: ['huozhen', 'jiantu', 'nuhou'], skillRate: 0.45, boss: true, fleeAt: 0.3, fleeLine: '周瑜：诸葛村夫！——（大叫一声，金疮迸裂，倒于船上）' }),
    // 第十五章　凤雏
    caoqi6: E({ name: '曹军追骑', hp: 1950, str: 172, int: 30, spd: 98, def: 116, exp: 560, gold: 200, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    caobing6: E({ name: '曹军精兵', hp: 1900, str: 168, int: 30, spd: 72, def: 116, exp: 540, gold: 195, spec: 'caobing' }),
    shanzei3: E({ name: '荆南山贼', hp: 1850, str: 168, int: 20, spd: 76, def: 108, exp: 540, gold: 210, spec: 'shanzei' }),
    shubing: E({ name: '蜀军', hp: 2000, str: 172, int: 30, spd: 72, def: 118, exp: 580, gold: 210, spec: 'shubing' }),
    shugong: E({ name: '蜀军弓手', hp: 1700, str: 166, int: 40, spd: 76, def: 104, exp: 580, gold: 210, skills: ['luanjian'], skillRate: 0.35, spec: 'shugong' }),
    zhoushan: E({ name: '周善', hp: 6600, str: 152, int: 30, spd: 84, def: 112, exp: 4200, gold: 2000, skills: ['shejian', 'kaishan'], skillRate: 0.35, boss: true, noDouble: true }),
    // 第十六章　落凤坡
    shubing2: E({ name: '蜀中锐卒', hp: 2200, str: 180, int: 30, spd: 76, def: 122, exp: 620, gold: 220, spec: 'shubing' }),
    shugong2: E({ name: '蜀中弩手', hp: 1900, str: 174, int: 40, spd: 80, def: 108, exp: 620, gold: 220, skills: ['luanjian'], skillRate: 0.4, spec: 'shugong' }),
    shanman2: E({ name: '巴郡蛮兵', hp: 2300, str: 184, int: 20, spd: 78, def: 112, exp: 640, gold: 230, skills: ['chongfeng'], skillRate: 0.3, spec: 'shanzei' }),
    yanghuai: E({ name: '杨怀', hp: 8500, str: 164, int: 50, spd: 82, def: 112, exp: 3800, gold: 1800, skills: ['feidao'], skillRate: 0.35, boss: true, noDouble: true }),
    gaopei: E({ name: '高沛', hp: 9000, str: 168, int: 30, spd: 78, def: 116, exp: 3800, gold: 1800, skills: ['feidao', 'kaishan'], skillRate: 0.35, boss: true, noDouble: true }),
    lengbao: E({ name: '冷苞', hp: 21000, str: 176, int: 60, spd: 82, def: 120, exp: 7000, gold: 3600, skills: ['juedi', 'hengsao', 'nuhou'], skillRate: 0.4, boss: true }),
    zhangren: E({ name: '张任', hp: 20000, str: 178, int: 70, spd: 88, def: 120, exp: 7200, gold: 3600, skills: ['luanjian', 'tuqiang'], skillRate: 0.45, boss: true, fleeAt: 0.35, fleeLine: '张任：射死那骑白马的！——（伏兵万弩齐发）' }),
    yanyan: E({ name: '严颜', hp: 6400, str: 144, int: 60, spd: 74, def: 118, exp: 4600, gold: 2200, skills: ['shejian', 'kaishan'], skillRate: 0.3, boss: true, noDouble: true, fleeAt: 0.3, fleeLine: '严颜力尽，被张飞一把揪住勒甲绦，生擒过马来！' }),
    zhangren2: E({ name: '张任', hp: 30000, str: 186, int: 70, spd: 90, def: 126, exp: 9000, gold: 4500, skills: ['luanjian', 'tuqiang', 'nuhou'], skillRate: 0.45, boss: true, spec: 'zhangren' }),
    // 第十七章　成都
    xiliang: E({ name: '西凉铁骑', hp: 2400, str: 188, int: 30, spd: 100, def: 124, exp: 680, gold: 240, skills: ['chongfeng'], skillRate: 0.35, spec: 'xiliang' }),
    xiliang2: E({ name: '西凉弓骑', hp: 2100, str: 182, int: 40, spd: 96, def: 112, exp: 680, gold: 240, skills: ['luanjian'], skillRate: 0.35, spec: 'xiliang' }),
    shubing3: E({ name: '成都守军', hp: 2300, str: 186, int: 30, spd: 76, def: 126, exp: 660, gold: 240, spec: 'shubing' }),
    madai: E({ name: '马岱', hp: 24000, str: 184, int: 50, spd: 92, def: 124, exp: 8000, gold: 4000, skills: ['luanjian', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, fleeLine: '马岱：（回身一箭）……蜀将好生了得！撤！' }),
    machao: E({ name: '马超', hp: 9000, str: 164, int: 40, spd: 94, def: 118, exp: 5000, gold: 2000, skills: ['tuqiang', 'chongfeng'], skillRate: 0.4, boss: true, noDouble: true, fleeAt: 0.5, fleeLine: '马超：好个燕人张翼德！天色已晚——点起火把，再战！' }),
    machao2: E({ name: '马超', hp: 8800, str: 164, int: 40, spd: 96, def: 120, exp: 6000, gold: 2400, skills: ['tuqiang', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, noDouble: true, fleeAt: 0.45, spec: 'machao', fleeLine: '马超佯败，回身掣出铜锤——张飞一闪，锤从耳边擦过！两家各自收兵。' }),
  });
})();
