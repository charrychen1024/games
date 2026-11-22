/* ============================================================
 * 烽烟录 · 第二章以后的数据：新人物、新武将、新策略、道具、各章敌军
 * ============================================================ */
'use strict';
(function () {
  Object.assign(G.SPECS, {
    zhaoyun: { skin: '#f2cda8', hair: '#141010', robe: '#e6e8ee', robe2: '#3a5a8a', trim: '#8aa0c0', pants: '#3a4050', hat: 'helmet', hatColor: '#d4d8de', plume: '#c0392b', armor: '#c4cad2', armorMark: '#3a5a8a', weapon: 'spear', banner: '#3a5a8a', flag: '赵', brows: 'thick' },
    luzhi: { skin: '#ecc6a0', hair: '#d8d2c8', robe: '#6a2a24', robe2: '#e0cfa0', trim: '#d6b45c', pants: '#3a2a24', hat: 'crown', hatColor: '#1a1a1a', beard: 'long', beardColor: '#e8e4dc', banner: '#8a2a20' },
    dongzhuo: { skin: '#d8a27a', hair: '#1a1512', robe: '#4a2350', robe2: '#d6b45c', trim: '#d6b45c', pants: '#2a1a2a', hat: 'crown', hatColor: '#111', beard: 'full', brows: 'thick', armor: '#6a5a40', size: 1.22, banner: '#3a1a40', noBlush: true },
    caocao: { skin: '#eec7a0', hair: '#141010', robe: '#24304a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a1e2a', hat: 'crown', hatColor: '#111', beard: 'thin', brows: 'thick', weapon: 'sword', size: 0.96, banner: '#24304a', flag: '曹' },
    yuanshao: { skin: '#f0caa4', hair: '#1a1512', robe: '#a07a2a', robe2: '#f0dca0', trim: '#f0d070', pants: '#3a2e1a', hat: 'crown', hatColor: '#111', beard: 'full', banner: '#a07a2a', flag: '袁' },
    gongsunzan: { skin: '#eec39a', hair: '#1a1512', robe: '#d8dce2', robe2: '#8a2a20', trim: '#b8c0c8', pants: '#3a3a40', hat: 'helmet', hatColor: '#e0e4e8', plume: '#ffffff', armor: '#c8ccd2', beard: 'thin', weapon: 'spear', banner: '#d8dce2', flag: '公' },
    hanbing: { skin: '#e3b88f', hair: '#1a1512', robe: '#8a2a20', trim: '#b8954a', pants: '#2a2420', hat: 'helmet', hatColor: '#7a7f84', armor: '#7c7364', weapon: 'spear', banner: '#8a2a20' },
    messenger: { skin: '#e3b88f', hair: '#1a1512', robe: '#6a4a2a', robe2: '#d8c090', trim: '#c9a24a', pants: '#2a2420', hat: 'band', hatColor: '#8a2a20', banner: '#6a4a2a' },
    zuofeng: { skin: '#f4dcc0', hair: '#1a1512', robe: '#7a5a8a', robe2: '#e8dcc0', trim: '#e0c890', pants: '#3a2a3a', hat: 'crown', hatColor: '#3a2a3a', banner: '#7a5a8a', noBlush: true },
    zhangbao: { skin: '#d8b090', hair: '#141010', robe: '#2a2a2a', robe2: '#e2b13a', trim: '#e2b13a', pants: '#1a1a1a', hat: 'turban', beard: 'long', beardColor: '#2a2420', weapon: 'staff', cape: '#c9962a', size: 1.2, banner: '#b8842a', flag: '宝', noBlush: true },
    zhangliang: { skin: '#c88a62', hair: '#120e0d', robe: '#5a3a24', robe2: '#e2b13a', trim: '#e2b13a', pants: '#2a2018', hat: 'turban', beard: 'full', brows: 'thick', eyes: 'round', armor: '#9a7a3a', armorMark: '#e2b13a', cape: '#6a1a14', weapon: 'bigsabre', size: 1.24, banner: '#b8842a', flag: '梁', noBlush: true },
    zhiren: { skin: '#ece6d6', hair: '#d8d0bc', robe: '#e6e0ce', robe2: '#c23b2a', trim: '#c23b2a', pants: '#d8d0bc', hat: 'turban', weapon: 'sabre', banner: '#d8d0bc', noBlush: true },
    hjjing: { skin: '#d6a880', hair: '#1a1512', robe: '#6a5236', robe2: '#e2b13a', trim: '#e2b13a', pants: '#3a3024', hat: 'turban', armor: '#6b6458', weapon: 'spear', banner: '#c9962a' },
    hjyao: { skin: '#e0b896', hair: '#1a1512', robe: '#3a3428', robe2: '#e2b13a', trim: '#c9962a', pants: '#2a2418', hat: 'turban', beard: 'goatee', weapon: 'staff', cape: '#8a6a2a', banner: '#c9962a' },
    xlbing: { skin: '#c99a72', hair: '#141010', robe: '#3a2c3a', robe2: '#8a7a5a', trim: '#7a6a4a', pants: '#2a2028', hat: 'helmet', hatColor: '#4a4448', plume: '#5a2a5a', armor: '#5a5258', weapon: 'spear', banner: '#3a1a40', noBlush: true },
    xlqi: { skin: '#c4926a', hair: '#141010', robe: '#2e2430', robe2: '#a08a5a', trim: '#8a7a4a', pants: '#1e1a20', hat: 'helmet', hatColor: '#3a3438', plume: '#8a2a20', armor: '#6a6066', beard: 'bristle', brows: 'thick', weapon: 'sabre', cape: '#4a2a40', size: 1.08, banner: '#3a1a40', noBlush: true },
    xlshe: { skin: '#cfa078', hair: '#141010', robe: '#4a3a3a', robe2: '#8a7a5a', trim: '#7a6a4a', pants: '#2a2028', hat: 'band', hatColor: '#4a2a40', weapon: 'staff', banner: '#3a1a40' },
    dzwei: { skin: '#c48e66', hair: '#120e0d', robe: '#2a1e2a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a141a', hat: 'helmet', hatColor: '#2a2428', plume: '#c9a24a', armor: '#4a4248', armorMark: '#c9a24a', beard: 'full', brows: 'thick', weapon: 'bigsabre', size: 1.12, banner: '#3a1a40', noBlush: true },
    huaxiong: { skin: '#b8805a', hair: '#0e0c0c', robe: '#3a1e1e', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a1414', hat: 'helmet', hatColor: '#3a3036', plume: '#8a1e1e', armor: '#5a4e4a', armorMark: '#c9a24a', beard: 'bristle', brows: 'thick', eyes: 'round', cape: '#5a1414', weapon: 'bigsabre', size: 1.26, banner: '#3a1a40', flag: '华', noBlush: true },
    lijue: { skin: '#c08a62', hair: '#120e0d', robe: '#3a2a3a', robe2: '#a08a5a', trim: '#a08a5a', pants: '#1a141a', hat: 'helmet', hatColor: '#3a3438', plume: '#4a2a5a', armor: '#5a5258', beard: 'full', brows: 'thick', weapon: 'axe', size: 1.18, banner: '#3a1a40', flag: '李', noBlush: true },
    lubu: { skin: '#eec39e', hair: '#141010', robe: '#8a1e1e', robe2: '#e8c070', trim: '#e8c070', pants: '#2a1414', hat: 'feather', armor: '#c8902a', armorMark: '#c0392b', cape: '#a01e1e', weapon: 'halberd', brows: 'thick', size: 1.3, banner: '#8a1e1e', flag: '吕', noBlush: true },
    guanhai: { skin: '#b87e56', hair: '#0e0c0c', robe: '#4a3420', robe2: '#e2b13a', trim: '#e2b13a', pants: '#2a2018', hat: 'turban', beard: 'bristle', brows: 'thick', eyes: 'round', armor: '#7a6a48', cape: '#5a3a14', weapon: 'bigsabre', size: 1.26, banner: '#b8842a', flag: '管', noBlush: true },
    kongrong: { skin: '#f0caa4', hair: '#2a2420', robe: '#2f4a5a', robe2: '#e8dcc0', trim: '#e0d0a0', pants: '#2a2a30', hat: 'crown', hatColor: '#111', beard: 'long', beardColor: '#3a3028', banner: '#2f4a5a' },
    taishici: { skin: '#e3b88f', hair: '#141010', robe: '#2a4a3a', robe2: '#d8c090', trim: '#c9a24a', pants: '#1e2a24', hat: 'band', hatColor: '#c9a24a', armor: '#6a7068', beard: 'thin', brows: 'thick', weapon: 'spear', banner: '#2a4a3a' },
    taoqian: { skin: '#ecc8a6', hair: '#e0dad0', robe: '#5a4a2a', robe2: '#e8dcc0', trim: '#d6b45c', pants: '#2a2420', hat: 'crown', hatColor: '#1a1a1a', beard: 'long', beardColor: '#eeeae2', weapon: 'staff', banner: '#5a4a2a' },
    mizhu: { skin: '#f0cba6', hair: '#1a1512', robe: '#7a5a2a', robe2: '#f0dca0', trim: '#e8c070', pants: '#3a2e1a', hat: 'crown', hatColor: '#222', beard: 'thin', banner: '#7a5a2a' },
    caobing: { skin: '#e0b48a', hair: '#141010', robe: '#2f4a7a', trim: '#8aa0c0', pants: '#1e2a40', hat: 'helmet', hatColor: '#6a7480', plume: '#2f4a7a', armor: '#6a7480', weapon: 'spear', banner: '#24304a', noBlush: true },
    caoqi: { skin: '#d8a880', hair: '#141010', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#3a4450', plume: '#c0392b', armor: '#4a5460', armorMark: '#c9a24a', beard: 'thin', brows: 'thick', weapon: 'sabre', cape: '#1e2e50', size: 1.08, banner: '#24304a', noBlush: true },
    caoshe: { skin: '#e0b48a', hair: '#141010', robe: '#3a5070', robe2: '#c8c0a0', trim: '#8aa0c0', pants: '#1e2a40', hat: 'band', hatColor: '#2f4a7a', weapon: 'staff', banner: '#24304a' },
    xiahoudun: { skin: '#e0b088', hair: '#120e0d', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#4a5460', plume: '#c0392b', armor: '#5a6470', armorMark: '#c9a24a', beard: 'full', brows: 'thick', cape: '#2a3a5a', weapon: 'spear', size: 1.22, banner: '#24304a', flag: '夏', noBlush: true },
    lbbing: { skin: '#d8a880', hair: '#141010', robe: '#6a2424', robe2: '#c8a060', trim: '#a8803a', pants: '#2a1818', hat: 'helmet', hatColor: '#5a5056', plume: '#a01e1e', armor: '#6a5a50', weapon: 'spear', banner: '#8a1e1e', noBlush: true },
    xianzhen: { skin: '#c48e66', hair: '#120e0d', robe: '#3a1a1a', robe2: '#c9a24a', trim: '#8a6a3a', pants: '#1a1010', hat: 'helmet', hatColor: '#2a2226', plume: '#1a1a1a', armor: '#3a3236', armorMark: '#a01e1e', beard: 'bristle', brows: 'thick', weapon: 'axe', size: 1.12, banner: '#8a1e1e', noBlush: true },
    lbqi: { skin: '#d0a078', hair: '#141010', robe: '#5a1c1c', robe2: '#e8c070', trim: '#c9a24a', pants: '#2a1414', hat: 'helmet', hatColor: '#4a4044', plume: '#e8c070', armor: '#7a5a3a', beard: 'thin', brows: 'thick', weapon: 'sabre', cape: '#6a1c1c', size: 1.06, banner: '#8a1e1e', noBlush: true },
    gaoshun: { skin: '#c99068', hair: '#120e0d', robe: '#2a1414', robe2: '#a01e1e', trim: '#a01e1e', pants: '#140c0c', hat: 'helmet', hatColor: '#2a2226', plume: '#a01e1e', armor: '#3a3236', armorMark: '#a01e1e', beard: 'full', brows: 'thick', cape: '#3a1010', weapon: 'bigsabre', size: 1.22, banner: '#8a1e1e', flag: '高', noBlush: true },
    chengong: { skin: '#eec7a0', hair: '#141010', robe: '#3a3a5a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#22223a', hat: 'scholar', hatColor: '#2a2a40', beard: 'thin', weapon: 'fan', size: 1.1, banner: '#8a1e1e', flag: '陈' },
    zhangliao: { skin: '#e8b890', hair: '#141010', robe: '#4a2a1a', robe2: '#d8c090', trim: '#c9a24a', pants: '#24160e', hat: 'helmet', hatColor: '#6a6064', plume: '#2a2a2a', armor: '#7a6a5a', beard: 'thin', brows: 'thick', weapon: 'sabre', size: 1.18, banner: '#8a1e1e', flag: '张' },
    caobao: { skin: '#e0b08a', hair: '#1a1512', robe: '#5a5a3a', robe2: '#c8c0a0', trim: '#a8a070', pants: '#2a2a1a', hat: 'helmet', hatColor: '#6a6a5a', armor: '#7a7464', beard: 'full', weapon: 'spear', banner: '#5a5a3a' },
    jiling: { skin: '#d0a078', hair: '#141010', robe: '#3a4a2a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1e2414', hat: 'helmet', hatColor: '#5a6450', plume: '#c9a24a', armor: '#6a7060', beard: 'full', brows: 'thick', weapon: 'bigsabre', size: 1.18, banner: '#3a4a2a' },
  });
  Object.assign(G.NAMES, {
    zhaoyun: '赵云', luzhi: '卢植', dongzhuo: '董卓', caocao: '曹操', yuanshao: '袁绍', gongsunzan: '公孙瓒', hanbing: '汉军士卒', messenger: '传令兵',
    zuofeng: '左丰', zhangbao: '张宝', zhangliang: '张梁', huaxiong: '华雄', lijue: '李傕', lubu: '吕布', guanhai: '管亥', kongrong: '孔融', taishici: '太史慈',
    taoqian: '陶谦', mizhu: '糜竺', xiahoudun: '夏侯惇', gaoshun: '高顺', chengong: '陈宫', zhangliao: '张辽', caobao: '曹豹', jiling: '纪灵',
  });

  // 原有武将补充称号、简介与新策略
  Object.assign(G.HEROES.liubei, { title: '汉室宗亲', bio: '中山靖王之后。仁德宽厚，素有大志。', skills: [['liaoshang', 1], ['jili', 4], ['renwang', 12]] });
  Object.assign(G.HEROES.guanyu, { title: '美髯公', bio: '河东解良人。忠义无双，刀法绝伦。', skills: [['zhanjiang', 3], ['tuodao', 14]] });
  Object.assign(G.HEROES.zhangfei, { title: '燕人', bio: '涿郡人。豹头环眼，声若巨雷，勇冠三军。', skills: [['nuhe', 2], ['duanqiao', 15]] });
  Object.assign(G.HEROES.jianyong, { title: '军师', bio: '涿郡人，刘备同乡故交。性简傲而多智。', skills: [['huoji', 1], ['liaoshang', 1], ['liehuo', 3], ['jiuyuan', 5], ['yehuo', 13]] });
  G.HEROES.zhaoyun = { name: '赵云', zi: '子龙', title: '常山赵子龙', bio: '常山真定人。白马银枪，一身是胆。', hp: 340, str: 96, int: 70, spd: 82, def: 50, crit: 0.12, wpow: 30, weapon: '涯角枪', skills: [['tuzhen', 1], ['qijin', 20]] };
  G.newStateMembers = { zhaoyun: { lvl: 1, exp: 0, hp: 340, armor: null } };

  Object.assign(G.SKILLS, {
    renwang: { name: '仁望', cost: 16, target: 'allies', type: 'heal', pow: 1.4, desc: '仁德感召，全军兵力大幅恢复。' },
    tuodao: { name: '拖刀计', cost: 14, target: 'enemy', type: 'phys', pow: 2.5, desc: '关羽绝技。佯败回身一刀，威力惊人。' },
    duanqiao: { name: '断喝', cost: 18, target: 'enemies', type: 'phys', pow: 1.1, desc: '张飞绝技。声如巨雷，震慑全体敌军。' },
    yehuo: { name: '业火', cost: 24, target: 'enemies', type: 'fire', pow: 2.3, desc: '天降业火，焚尽全体敌军。' },
    tuzhen: { name: '突阵', cost: 9, target: 'enemy', type: 'multi', hits: 3, pow: 0.62, desc: '赵云绝技。枪出如龙，连刺三次。' },
    qijin: { name: '七进七出', cost: 22, target: 'enemy', type: 'multi', hits: 7, pow: 0.48, desc: '赵云绝技。单骑冲阵，七进七出。' },
    // 敌方
    chongfeng: { name: '冲锋', type: 'multi', target: 'enemy', hits: 2, pow: 0.72 },
    luanshe: { name: '乱箭齐发', type: 'phys', target: 'enemies', pow: 0.55 },
    wushuang: { name: '天下无双', type: 'multi', target: 'enemy', hits: 3, pow: 0.62 },
    wushuang2: { name: '天下无双', type: 'multi', target: 'enemy', hits: 4, pow: 0.6 },
    zhaohun: { name: '剪纸成兵', type: 'summon', unit: 'zhiren', count: 2, target: 'self' },
    zhaoji: { name: '陷阵召集', type: 'summon', unit: 'xianzhen', count: 1, target: 'self' },
    yaofeng: { name: '妖风', type: 'fire', target: 'enemies', pow: 1.3 },
    huogong: { name: '火攻', type: 'fire', target: 'enemies', pow: 1.5 },
  });

  Object.assign(G.ITEMS, {
    xuming: { name: '续命丹', price: 150, type: 'revive', amt: 0.5, desc: '战斗中救起一名兵力耗尽的部将，恢复一半兵力。' },
    meijiu: { name: '美酒', price: 90, type: 'sp', amt: 40, desc: '恢复 40 点策略值。' },
    junliang: { name: '军粮', price: 220, type: 'healall', amt: 500, desc: '恢复全体部将 500 兵力。' },
    dabu: { name: '大补丸', price: 120, type: 'heal', amt: 900, desc: '恢复一名部将 900 兵力。' },
    yulin: { name: '鱼鳞甲', price: 480, type: 'armor', def: 40, desc: '甲片如鱼鳞层叠。防御 +40。' },
    mingguang: { name: '明光铠', price: 1100, type: 'armor', def: 58, desc: '胸背圆护光可鉴人。防御 +58。' },
    xuanjia: { name: '玄甲', price: 2200, type: 'armor', def: 75, desc: '精铁玄甲，刀枪难入。防御 +75。' },
  });

  const E = (o) => o;
  Object.assign(G.ENEMIES, {
    // 第二章：黄巾覆灭
    hjjing: E({ name: '黄巾精兵', hp: 280, str: 60, int: 20, spd: 50, def: 30, exp: 38, gold: 22 }),
    hjyao: E({ name: '黄巾妖道', hp: 230, str: 40, int: 62, spd: 62, def: 26, exp: 42, gold: 26, skills: ['yaohuo'], skillRate: 0.5 }),
    hjmeng: E({ name: '黄巾猛士', hp: 440, str: 72, int: 15, spd: 42, def: 40, exp: 56, gold: 30, skills: ['hengsao'], skillRate: 0.25, spec: 'ylishi' }),
    zhiren: E({ name: '纸人兵', hp: 170, str: 56, int: 10, spd: 46, def: 20, exp: 8, gold: 0 }),
    zhangbao: E({ name: '张宝', hp: 3600, str: 80, int: 82, spd: 66, def: 55, exp: 700, gold: 500, skills: ['huangtian', 'zhaohun', 'yaofeng'], skillRate: 0.45, boss: true, immune: 'c2_blood', immuneText: '妖法护体' }),
    zhangliang: E({ name: '张梁', hp: 4200, str: 104, int: 40, spd: 64, def: 60, exp: 900, gold: 600, skills: ['hengsao', 'nuhou'], skillRate: 0.35, boss: true }),
    // 第三章：讨董
    xlbing: E({ name: '西凉兵', hp: 420, str: 76, int: 20, spd: 55, def: 42, exp: 70, gold: 35 }),
    xlqi: E({ name: '西凉铁骑', hp: 560, str: 88, int: 20, spd: 74, def: 50, exp: 90, gold: 45, skills: ['chongfeng'], skillRate: 0.35 }),
    xlshe: E({ name: '西凉弓手', hp: 360, str: 72, int: 30, spd: 62, def: 34, exp: 80, gold: 40, skills: ['luanshe'], skillRate: 0.4 }),
    dzwei: E({ name: '董卓亲卫', hp: 720, str: 95, int: 20, spd: 60, def: 60, exp: 120, gold: 60, skills: ['hengsao'], skillRate: 0.25 }),
    huaxiong: E({ name: '华雄', hp: 1500, str: 85, int: 30, spd: 60, def: 50, exp: 600, gold: 400, skills: ['nuhou'], skillRate: 0.15, boss: true, noDouble: true }),
    lijue: E({ name: '李傕', hp: 4200, str: 100, int: 40, spd: 66, def: 62, exp: 900, gold: 600, skills: ['hengsao', 'nuhou'], skillRate: 0.35, boss: true, fleeAt: 0.3, fleeLine: '李傕：撤！快撤回虎牢关！' }),
    lubu: E({ name: '吕布', hp: 9000, str: 120, int: 50, spd: 92, def: 75, exp: 1500, gold: 800, skills: ['wushuang', 'hengsao'], skillRate: 0.4, boss: true, fleeAt: 0.6, fleeLine: '吕布：三个打一个，算什么好汉！——拨转赤兔，退回关中！' }),
    // 第四章：徐州
    hjyu: E({ name: '黄巾余党', hp: 520, str: 92, int: 20, spd: 60, def: 50, exp: 110, gold: 50, spec: 'hjjing' }),
    hjyu2: E({ name: '黄巾悍匪', hp: 700, str: 100, int: 15, spd: 50, def: 58, exp: 130, gold: 60, skills: ['hengsao'], skillRate: 0.25, spec: 'ylishi' }),
    guanhai: E({ name: '管亥', hp: 6500, str: 120, int: 30, spd: 70, def: 70, exp: 1200, gold: 800, skills: ['hengsao', 'nuhou'], skillRate: 0.35, boss: true }),
    caobing: E({ name: '曹军步卒', hp: 640, str: 98, int: 25, spd: 62, def: 62, exp: 130, gold: 60 }),
    caoqi: E({ name: '虎豹骑', hp: 760, str: 110, int: 25, spd: 82, def: 70, exp: 160, gold: 70, skills: ['chongfeng'], skillRate: 0.35 }),
    caoshe: E({ name: '曹军弓手', hp: 520, str: 92, int: 35, spd: 66, def: 50, exp: 140, gold: 65, skills: ['luanshe'], skillRate: 0.4 }),
    xiahoudun: E({ name: '夏侯惇', hp: 8000, str: 130, int: 40, spd: 78, def: 80, exp: 1600, gold: 1000, skills: ['hengsao', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.25, fleeLine: '夏侯惇：兖州有变……收兵！' }),
    // 第五章：白门楼
    lbbing: E({ name: '吕布军', hp: 720, str: 108, int: 25, spd: 66, def: 68, exp: 170, gold: 70 }),
    xianzhen: E({ name: '陷阵营', hp: 980, str: 120, int: 20, spd: 60, def: 85, exp: 220, gold: 90, skills: ['hengsao'], skillRate: 0.25 }),
    lbqi: E({ name: '并州铁骑', hp: 860, str: 118, int: 25, spd: 86, def: 72, exp: 200, gold: 85, skills: ['chongfeng'], skillRate: 0.35 }),
    jiling: E({ name: '纪灵', hp: 6000, str: 118, int: 40, spd: 66, def: 72, exp: 1000, gold: 700, skills: ['hengsao', 'nuhou'], skillRate: 0.3, boss: true, fleeAt: 0.35, fleeLine: '纪灵：今日暂且罢兵！' }),
    gaoshun: E({ name: '高顺', hp: 9000, str: 132, int: 40, spd: 72, def: 95, exp: 2000, gold: 1200, skills: ['hengsao', 'nuhou', 'zhaoji'], skillRate: 0.4, boss: true }),
    zhangliao: E({ name: '张辽', hp: 7000, str: 128, int: 60, spd: 84, def: 80, exp: 1600, gold: 900, skills: ['chongfeng', 'nuhou'], skillRate: 0.35, boss: true, fleeAt: 0.3, fleeLine: '张辽力竭被擒——' }),
    chengong: E({ name: '陈宫', hp: 5200, str: 70, int: 140, spd: 70, def: 60, exp: 1400, gold: 900, skills: ['huogong', 'yaohuo'], skillRate: 0.7, boss: true }),
    lubu2: E({ name: '吕布', hp: 16000, str: 140, int: 50, spd: 96, def: 90, exp: 4000, gold: 3000, skills: ['wushuang2', 'hengsao', 'nuhou'], skillRate: 0.45, boss: true, spec: 'lubu' }),
  });
  // Boss 是否半血后连动
  G.ENEMIES.huaxiong.noDouble = true;

  G.lines = async arr => { for (const [w, t, o] of arr) await G.say(w, t, o || {}); };
  // 中文章号：零～九十九（章节号超过三十时也不会退回阿拉伯数字）
  G.CN = Array.from({ length: 100 }, (_, n) => { const d = '零一二三四五六七八九'; if (n < 10) return d[n]; const t = Math.floor(n / 10), o = n % 10; return (t > 1 ? d[t] : '') + '十' + (o ? d[o] : ''); });
})();
