/* ============================================================
 * 烽烟录 · 第三部数据：江东人物、黄忠、赤壁敌军、舌战问答
 * ============================================================ */
'use strict';
(function () {
  const WU = '#a8322a';
  Object.assign(G.SPECS, {
    lusu: { skin: '#eec7a0', hair: '#141010', robe: '#7a2a24', robe2: '#e8dcc0', trim: '#d6b45c', pants: '#3a1a16', hat: 'crown', hatColor: '#111', beard: 'thin', banner: WU },
    sunquan: { skin: '#f0caa4', hair: '#4a2a14', robe: '#a8322a', robe2: '#e8c86a', trim: '#e8c86a', pants: '#4a1a14', hat: 'crown', hatColor: '#2a1a0e', beard: 'full', beardColor: '#7a3a1a', eyes: 'round', banner: WU, flag: '孙' },
    zhouyu: { skin: '#f4d6b8', hair: '#141010', robe: '#c8402a', robe2: '#f0e0c0', trim: '#e8c86a', pants: '#4a1a14', hat: 'feather', hatColor: '#c9a24a', plume: '#c8402a', armor: '#b8a080', weapon: 'sword', banner: WU, flag: '周' },
    zhangzhao: { skin: '#ecc8a6', hair: '#d8d4cc', robe: '#4a3a5a', robe2: '#e0cfa0', trim: '#c8b090', pants: '#2a1e34', hat: 'crown', hatColor: '#111', beard: 'long', beardColor: '#e4e0d8', banner: WU },
    wuru: { skin: '#eec7a0', hair: '#141010', robe: '#5a5a6a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#2a2a34', hat: 'crown', hatColor: '#111', beard: 'goatee', banner: WU },
    huanggai: { skin: '#d8a880', hair: '#c8c2b8', robe: '#8a2a1e', robe2: '#c9a24a', trim: '#c9a24a', pants: '#3a140e', hat: 'helmet', hatColor: '#6a5a4a', plume: WU, armor: '#7a6a5a', beard: 'full', beardColor: '#d8d2c8', brows: 'thick', weapon: 'sabre', size: 1.12, banner: WU, flag: '黄', noBlush: true },
    wubing: { skin: '#e3b88f', hair: '#141010', robe: '#a8322a', trim: '#e0b070', pants: '#4a1a14', hat: 'helmet', hatColor: '#6a5a4a', armor: '#8a6a5a', weapon: 'spear', banner: WU },
    dingfeng: { skin: '#d8a880', hair: '#141010', robe: '#8a2a1e', robe2: '#c9a24a', trim: '#c9a24a', pants: '#3a140e', hat: 'helmet', hatColor: '#5a5058', plume: WU, armor: '#6a5a4a', beard: 'bristle', weapon: 'sabre', size: 1.1, banner: WU, flag: '丁', noBlush: true },
    xusheng: { skin: '#e0b48a', hair: '#141010', robe: '#8a2a1e', robe2: '#c9a24a', trim: '#c9a24a', pants: '#3a140e', hat: 'helmet', hatColor: '#5a5058', plume: '#e8c86a', armor: '#6a5a4a', beard: 'thin', weapon: 'spear', size: 1.1, banner: WU, flag: '徐', noBlush: true },
    caoshui: { skin: '#e3b88f', hair: '#141010', robe: '#2f4a7a', trim: '#8aa0c0', pants: '#1e2a40', hat: 'band', hatColor: '#2f4a7a', weapon: 'sabre', banner: '#24304a' },
    yujin: { skin: '#e0b088', hair: '#141010', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#4a5460', plume: '#2f4a7a', armor: '#5a6470', beard: 'full', weapon: 'spear', size: 1.16, banner: '#24304a', flag: '于', noBlush: true },
    xuhuang: { skin: '#d8a880', hair: '#141010', robe: '#1e2e50', robe2: '#c9a24a', trim: '#c9a24a', pants: '#141c30', hat: 'helmet', hatColor: '#3a4450', plume: '#c9a24a', armor: '#4a5460', beard: 'full', brows: 'thick', weapon: 'axe', size: 1.22, banner: '#24304a', flag: '徐', noBlush: true },
    huangzhong: { skin: '#e0b088', hair: '#e8e4dc', robe: '#8a5a1e', robe2: '#e8c86a', trim: '#e8c86a', pants: '#3a2410', hat: 'helmet', hatColor: '#8a7a5a', plume: '#c0392b', armor: '#a08a5a', beard: 'long', beardColor: '#f0ece4', brows: 'thick', weapon: 'bigsabre', size: 1.14, banner: '#8a5a1e', flag: '黄' },
    weiyan: { skin: '#b88058', hair: '#120e0d', robe: '#4a2a3a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#24141c', hat: 'helmet', hatColor: '#4a4048', plume: '#2a1a1a', armor: '#5a4a50', beard: 'bristle', brows: 'thick', eyes: 'round', weapon: 'bigsabre', size: 1.2, banner: '#4a2a3a', flag: '魏', noBlush: true },
    hanxuan: { skin: '#eec7a0', hair: '#141010', robe: '#5a4a2a', robe2: '#e0d0b0', trim: '#c8b090', pants: '#2a2214', hat: 'crown', hatColor: '#222', beard: 'goatee', banner: '#5a4a2a' },
    zhaofan: { skin: '#eec7a0', hair: '#141010', robe: '#3a5a5a', robe2: '#e0d0b0', trim: '#c8b090', pants: '#1a2a2a', hat: 'crown', hatColor: '#222', beard: 'thin', banner: '#3a5a5a' },
    chenying: { skin: '#d8a880', hair: '#141010', robe: '#3a5a5a', robe2: '#c9a24a', trim: '#c9a24a', pants: '#1a2a2a', hat: 'helmet', hatColor: '#5a6060', plume: '#3a5a5a', armor: '#6a7070', beard: 'bristle', weapon: 'spear', size: 1.12, banner: '#3a5a5a', flag: '陈', noBlush: true },
    xingdaorong: { skin: '#b88058', hair: '#120e0d', robe: '#5a4a2a', robe2: '#a08060', trim: '#8a6a3a', pants: '#2a2214', hat: 'band', hatColor: '#8a2a1a', beard: 'full', brows: 'thick', eyes: 'round', weapon: 'axe', size: 1.3, banner: '#5a4a2a', flag: '邢', noBlush: true },
    jingbing: { skin: '#e3b88f', hair: '#141010', robe: '#5a4a2a', trim: '#a89070', pants: '#2a2214', hat: 'helmet', hatColor: '#6a6050', armor: '#7a7060', weapon: 'spear', banner: '#5a4a2a' },
    fanshi: { skin: '#f6d8bc', hair: '#141010', robe: '#c87a8a', robe2: '#f0dcc0', trim: '#e8c890', pants: '#6a3a44', hat: 'hairF', hatColor: '#d6b45c', banner: '#c87a8a' },
  });
  Object.assign(G.NAMES, {
    lusu: '鲁肃', sunquan: '孙权', zhouyu: '周瑜', zhangzhao: '张昭', wuru: '江东名士', huanggai: '黄盖', wubing: '东吴军士', dingfeng: '丁奉', xusheng: '徐盛',
    caoshui: '曹军水兵', yujin: '于禁', xuhuang: '徐晃', huangzhong: '黄忠', weiyan: '魏延', hanxuan: '韩玄', zhaofan: '赵范', chenying: '陈应', xingdaorong: '邢道荣', jingbing: '荆南军士', fanshi: '樊氏',
  });

  /* ---------------- 黄忠 ---------------- */
  G.HEROES.huangzhong = { name: '黄忠', zi: '汉升', title: '老当益壮', bio: '南阳人。年近六旬，有万夫不当之勇，开二石之弓，百发百中。', hp: 340, str: 98, int: 62, spd: 66, def: 50, crit: 0.18, wpow: 30, weapon: '凤嘴刀 · 铁胎弓', skills: [['chuanyang', 1], ['lianzhu', 1], ['laodang', 1]] };
  Object.assign(G.SKILLS, {
    chuanyang: { name: '百步穿杨', cost: 10, target: 'enemy', type: 'phys', pow: 2.2, desc: '黄忠绝技。开二石之弓，一箭穿心。' },
    lianzhu: { name: '连珠箭', cost: 20, target: 'enemies', type: 'phys', pow: 1.15, desc: '黄忠绝技。连发数箭，射向全体敌军。' },
    laodang: { name: '老当益壮', cost: 16, target: 'allies', type: 'buff', desc: '老将一声长啸，全军攻击提升三回合。' },
    // 敌方
    jiantu: { name: '万箭齐发', type: 'phys', target: 'enemies', pow: 0.7 },
    kaishan: { name: '开山大斧', type: 'phys', target: 'enemy', pow: 1.9 },
    shejian: { name: '拖刀', type: 'multi', target: 'enemy', hits: 2, pow: 0.85 },
  });
  // 借东风：七星坛祭风之后，不论等级都可使用
  const baseSkills = G.skillsOf;
  G.skillsOf = id => { const s = baseSkills(id); if (id === 'zhugeliang' && G.flag('c11_wind') && !s.includes('dongfeng')) s.push('dongfeng'); return s; };
  const baseNew = G.newState;
  G.newState = () => { const s = baseNew(); s.members.huangzhong = { lvl: 1, exp: 0, hp: 340, armor: null }; return s; };

  Object.assign(G.ITEMS, {
    shenghui: { name: '圣惠散', price: 420, type: 'heal', amt: 3200, desc: '恢复一名部将 3200 兵力。' },
    tianzhong: { name: '天中酒', price: 360, type: 'sp', amt: 140, desc: '恢复 140 点策略值。' },
    quanjun: { name: '犒军酒肉', price: 900, type: 'healall', amt: 2600, desc: '恢复全体部将 2600 兵力。' },
    jinsuo: { name: '金锁连环甲', price: 7800, type: 'armor', def: 125, desc: '江东巧匠所制。防御 +125。' },
  });

  const E = o => o;
  Object.assign(G.ENEMIES, {
    // 第十一章（诸葛亮在江东，多为单人或二人战）
    caoshui: E({ name: '曹军水兵', hp: 780, str: 120, int: 30, spd: 60, def: 80, exp: 300, gold: 110, spec: 'caoshui' }),
    caogong: E({ name: '水寨弓手', hp: 640, str: 116, int: 40, spd: 64, def: 70, exp: 300, gold: 110, skills: ['luanshe'], skillRate: 0.4, spec: 'caoshe' }),
    dingfeng: E({ name: '丁奉', hp: 5200, str: 140, int: 40, spd: 80, def: 96, exp: 2400, gold: 900, skills: ['chongfeng'], skillRate: 0.3, boss: true, noDouble: true, fleeAt: 0.3, fleeLine: '丁奉：赵子龙在此，追之无益……撤！' }),
    xusheng: E({ name: '徐盛', hp: 5000, str: 136, int: 50, spd: 76, def: 94, exp: 2400, gold: 900, skills: ['luanshe'], skillRate: 0.3, boss: true, noDouble: true, fleeAt: 0.3, fleeLine: '徐盛：孔明之计，鬼神莫测……回去禀报都督吧。' }),
    // 第十二章（全军）
    caoshui2: E({ name: '曹军水兵', hp: 1700, str: 160, int: 30, spd: 66, def: 110, exp: 460, gold: 160, spec: 'caoshui' }),
    caogong2: E({ name: '曹军强弩', hp: 1450, str: 154, int: 40, spd: 70, def: 98, exp: 460, gold: 160, skills: ['jiantu'], skillRate: 0.35, spec: 'caoshe' }),
    caoqi5: E({ name: '虎豹骑', hp: 1850, str: 168, int: 30, spd: 96, def: 116, exp: 500, gold: 170, skills: ['chongfeng'], skillRate: 0.35, spec: 'caoqi' }),
    caobing5: E({ name: '曹军残兵', hp: 1500, str: 150, int: 30, spd: 70, def: 104, exp: 420, gold: 150, spec: 'caobing' }),
    yujin: E({ name: '于禁', hp: 19000, str: 160, int: 60, spd: 80, def: 116, exp: 6000, gold: 3000, skills: ['jiantu', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true }),
    xuhuang: E({ name: '徐晃', hp: 21000, str: 170, int: 50, spd: 84, def: 120, exp: 6500, gold: 3200, skills: ['kaishan', 'hengsao', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, fleeLine: '徐晃：护着丞相要紧！撤！' }),
    xuchu3: E({ name: '许褚', hp: 22000, str: 176, int: 30, spd: 80, def: 124, exp: 6800, gold: 3200, skills: ['hengsao', 'chongfeng', 'nuhou'], skillRate: 0.4, boss: true, fleeAt: 0.3, fleeLine: '许褚：马都饿得跑不动了……丞相快走！', spec: 'xuchu' }),
    // 第十三章
    jingbing: E({ name: '荆南军士', hp: 1650, str: 158, int: 30, spd: 68, def: 108, exp: 470, gold: 170, spec: 'jingbing' }),
    jinggong: E({ name: '荆南弓手', hp: 1400, str: 152, int: 40, spd: 72, def: 96, exp: 470, gold: 170, skills: ['jiantu'], skillRate: 0.35, spec: 'jinggong' }),
    shanman: E({ name: '五溪蛮兵', hp: 1800, str: 166, int: 20, spd: 74, def: 100, exp: 500, gold: 180, skills: ['chongfeng'], skillRate: 0.3, spec: 'shanzei' }),
    xingdaorong: E({ name: '邢道荣', hp: 18000, str: 172, int: 20, spd: 70, def: 112, exp: 6000, gold: 3500, skills: ['kaishan', 'hengsao'], skillRate: 0.45, boss: true, fleeAt: 0.2, fleeLine: '邢道荣：好、好厉害……饶命！俺投降！' }),
    chenying: E({ name: '陈应', hp: 6200, str: 150, int: 40, spd: 84, def: 104, exp: 3200, gold: 1600, skills: ['shejian'], skillRate: 0.35, boss: true, noDouble: true }),
    huangzhong: E({ name: '黄忠', hp: 9000, str: 158, int: 60, spd: 78, def: 112, exp: 4000, gold: 2000, skills: ['shejian', 'kaishan'], skillRate: 0.35, boss: true, noDouble: true, fleeAt: 0.5, fleeLine: '黄忠战马失蹄，掀落在地！关羽举刀，却道："我且饶你性命，快换马来厮杀！"' }),
  });

  /* ---------------- 舌战群儒：问答 ---------------- */
  // q: [发问者 spec, 名号, 发问]；opts: [选项…]；ok: 正确选项序号；win: 孔明的答辞；lose: 选错时对方的嘲讽
  G.DEBATE = [
    { who: 'zhangzhao', name: '张昭', q: '先生自比管仲、乐毅。可刘豫州得先生之后，反被曹兵杀得弃甲抛戈，望风而窜，这是何故？',
      opts: ['鹏飞万里，燕雀安知？治沉疴当先糜粥后猛药。', '那是刘豫州用兵不当，不关我事。', '胜败乃兵家常事，何必多问。'], ok: 0,
      win: '刘豫州兵不满千，将止关、张、赵云，而能博望烧屯、白河用水，使夏侯惇、曹仁辈心惊胆裂。当阳之败，乃不忍弃十万百姓——此大仁大义也。寡不敌众，胜负乃其常事。', lose: '哈哈哈，原来卧龙也不过推诿之辈！' },
    { who: 'wuru', name: '虞翻', q: '今曹公兵屯百万，将列千员，龙骧虎视，平吞江夏，公以为何如？',
      opts: ['曹操兵多，确实可怕。', '蚁聚之兵、乌合之众，虽百万不足惧也。', '只要江东投降，自然无事。'], ok: 1,
      win: '刘豫州以数千仁义之师，安能敌百万残暴之众？退守夏口，所以待时也。今江东兵精粮足，且有长江之险，犹欲使其主屈膝降贼——如此说来，刘豫州真不惧曹操者矣！', lose: '连卧龙都说曹兵可怕，江东还打什么？' },
    { who: 'wuru', name: '薛综', q: '汉传世至今，天数将终。今曹公已有天下三分之二，人皆归心。刘豫州不识天时，强欲与争，如以卵击石，安得不败乎？',
      opts: ['天命确在曹氏。', '薛先生所言极是。', '曹操世食汉禄而怀篡逆，公乃无父无君之人！'], ok: 2,
      win: '人生天地间，以忠孝为立身之本。公既为汉臣，见有不臣之人，当誓共戮之，臣之道也。今曹操篡逆，天下共愤——公乃以天数归之，真无父无君之人也！不足与语，请勿复言！', lose: '可见天命所归，非人力可争。' },
    { who: 'wuru', name: '严畯', q: '孔明所言，皆强词夺理，均非正论。且请问孔明治何经典？',
      opts: ['寻章摘句者，腐儒也。伊尹耕夫、子牙渔翁！', '我读过很多经书。', '经典与打仗有什么关系？'], ok: 0,
      win: '且古耕莘伊尹，钓渭子牙，张良、陈平之流，邓禹、耿弇之辈，皆有匡扶宇宙之才，未审其生平治何经典。岂亦效书生，区区于笔砚之间，数黑论黄，舞文弄墨而已乎？', lose: '原来卧龙不过一介武夫。' },
  ];
  // 返回答错次数
  G.debate = async () => {
    let wrong = 0;
    for (const d of G.DEBATE) {
      await G.say(d.who, d.q, { name: d.name });
      while (true) {
        const k = await G.choose(d.opts.map((o, i) => '甲乙丙'[i] + '、' + o), { w: 600, x: G.W / 2 - 300, bottom: 170 });
        if (k === d.ok) { await G.say('zhugeliang', d.win); G.audio.sfx('crit'); await G.narrate(`${d.name}满面羞惭，不能对答。`); break; }
        wrong++; G.audio.sfx('cancel');
        await G.say(d.who, d.lose, { name: d.name });
        await G.narrate('孔明微微一笑，轻摇羽扇……（换一种说法吧）');
      }
    }
    return wrong;
  };
})();
