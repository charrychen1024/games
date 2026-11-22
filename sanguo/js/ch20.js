/* ============================================================
 * 烽烟录 · 第二十章　汉中王
 * 汉水（赵云单骑救黄忠、空营计）→ 斜谷（许褚、鸡肋、魏延射曹操）→ 沔阳称王、五虎上将
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const HZ = { gh: 100, gs: 28, gl: 26 };
  const SHOP = ['xuelian', 'tianxiang', 'yulu', 'xianlu', 'xuming', 'dayan', 'qingzhou', 'shujin', 'longwen'];
  const XIEGU = ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'weiyan'];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };
  const campMenu = (line, title) => async () => {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) await restAndSave('innkeeper', line, '军需官'); else if (k === 1) await G.shop(SHOP, title);
  };

  /* ---------------- 汉水 ---------------- */
  B.c20hanshui = () => {
    const m = new G.GameMap('c20hanshui', '汉 水', 40, 32, TL.GRASS);
    Object.assign(m, { seed: 2001, music: 'boss', ambient: 'clouds', pal: HZ, battleBg: 'shu', flowers: 0.03 });
    K.tallGrass(m, 2003, 0.57);
    m.road([[0, 11], [14, 12], [26, 11], [40, 12]], 1.4, TL.WATER);
    m.road([[20.5, 26], [20.5, 4]], 0.75, TL.PATH);
    for (let y = 0; y < m.h; y++) for (let x = 19; x <= 22; x++) if (m.get(x, y) === TL.WATER) m.set(x, y, TL.BRIDGE);
    m.rect(16, 1, 9, 4, TL.SOIL);                                                         // 北山粮营
    K.tent(m, 12, 1, { w: 3, h: 3 }); K.tent(m, 26, 1, { w: 3, h: 3 });
    K.deco(m, 'crates', 15, 4); K.deco(m, 'crates', 25, 4); K.deco(m, 'fire', 17, 2, { light: 120 });
    K.stakeRing(m, 13, 19, 28, 30, [[19, 19, 4, 1]]);                                     // 赵云营寨
    K.tent(m, 15, 23, { red: true }); K.tent(m, 24, 23, { red: true });
    K.deco(m, 'flag', 18, 20, { text: '赵', color: '#3a5a3a', tcol: '#f6e7c1' }); K.deco(m, 'flag', 23, 20, { text: '赵', color: '#3a5a3a', tcol: '#f6e7c1' });
    m.reserve(19, 18, 4, 9); m.reserve(15, 1, 11, 5);
    for (const [x, y] of [[2, 2], [32, 4], [4, 22], [32, 24], [6, 15], [32, 15]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2005, thr: 0.62, kinds: ['pine', 'dark', 'bamboo'] });
    m.npc({ id: 'hs20inn', spec: 'innkeeper', x: 17, y: 27, dir: 'right', talk: campMenu('将军，营中粮草尚足。', '赵云营') });
    m.npc({ id: 'zz20', spec: 'huban', x: 22, y: 25, dir: 'left', cond: () => !G.flag('c20_kong'), talk: K.talk([['huban', '黄老将军去劫北山粮草，过了午时还没回来……', { name: '张著' }]]) });
    m.event({ type: 'step', x: 19, y: 4, w: 4, h: 2, run: rescueScene });
    m.npc({ id: 'hz20', spec: 'huangzhong', x: 20, y: 3, dir: 'down', cond: () => !G.flag('c20_rescue'), marker: () => true, talk: rescueScene });
    m.event({ type: 'step', x: 19, y: 19, w: 4, h: 2, run: kongScene });
    return m;
  };

  async function rescueScene() {
    if (G.flag('c20_rescue')) return;
    await G.narrate('赵云引三千军，杀过汉水。只见北山之下，黄忠被曹军重重围困——');
    await G.lines([
      ['zhaoyun', '常山赵子龙在此！'],
      ['huangzhong', '（大喜）子龙！'],
    ]);
    const r = await G.battle(['caoqi7', 'caobing7'], { bg: 'shu', party: ['zhaoyun'], intro: '杀入重围！' });
    if (r !== 'win') return;
    G.setFlag('c20_rescue');
    await G.narrate('赵云挺枪骤马，杀入重围，左冲右突，如入无人之境。那枪浑身上下，若舞梨花；遍体纷纷，如飘瑞雪——救出黄忠，杀回本营。');
    await G.notice('救出黄忠！\n回到南边的营寨。曹军大队，紧追在后……');
  }

  async function kongScene() {
    if (!G.flag('c20_rescue') || G.flag('c20_kong')) return;
    await G.lines([
      ['huban', '将军！曹军追来了！快闭了寨门，上敌楼防护！', { name: '张著' }],
      ['zhaoyun', '休闭寨门！汝岂不知吾昔在当阳长坂时，单枪匹马，觑曹兵八十三万如草芥？今有军有将，又何惧哉！'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('赵云拨弓弩手于寨外壕中埋伏，将营内旗枪尽皆倒了，金鼓不鸣。自己匹马单枪，立于营门之外。');
    await G.narrate('天色已晚。张郃、徐晃领兵追到，见寨中偃旗息鼓，又见赵云匹马立于营外，寨门大开——二将不敢前进。');
    const r = await G.battle(['xuhuang2'], { bg: 'shu', boss: true, party: ['zhaoyun'], intro: '徐晃试探营门！' });
    if (r !== 'win') return;
    G.setFlag('c20_kong');
    await G.narrate('赵云把枪一招，壕中弓弩齐发，金鼓大震。曹军不知多少蜀兵，自相践踏，拥到汉水河边，落水死者不计其数。');
    await G.lines([
      ['liubei', '（次日亲到营中，看了昨日厮杀之处）子龙一身都是胆也！'],
    ]);
    await G.narrate('自此军中号赵云为"虎威将军"。');
    await G.fadeOut(1.0);
    await G.narrate('曹操亲统大军，屯于斜谷界口——');
    G.catchUp(XIEGU);
    G.setParty(XIEGU); G.restoreAll();
    G.world.load('c20xiegu', 17, 37, 'up');
    G.world.banner = null;
    await G.fadeIn(1.0);
    await G.notice('全军向斜谷进发，与曹操决战！');
  }

  /* ---------------- 斜谷 ---------------- */
  B.c20xiegu = () => {
    const m = new G.GameMap('c20xiegu', '斜 谷', 34, 40, TL.GRASS);
    Object.assign(m, { seed: 2021, music: 'boss', ambient: 'leaves', leafColor: 'rgba(170,140,70,0.8)', pal: { gh: 80, gs: 26, gl: 24 }, battleBg: 'shu', flowers: 0.01 });
    m.road([[17.5, 40], [17.5, 30], [14, 24], [18, 16], [17.5, 4]], 0.9, TL.PATH);
    m.rect(11, 2, 13, 7, TL.SOIL);
    K.tent(m, 8, 2, { big: true, w: 5, h: 4, sign: '魏' }); K.tent(m, 24, 2, { w: 3, h: 3 });
    for (const [x, y] of [[12, 8], [23, 8]]) K.deco(m, 'flag', x, y, { text: '曹', color: '#24304a', tcol: '#f6e7c1' });
    K.deco(m, 'flag', 15, 35, { text: '汉', color: '#8a1e1e', tcol: '#f6e7c1' });
    for (const [x, y] of [[1, 30], [27, 30], [2, 18], [27, 18], [1, 8], [28, 8]]) K.mountain(m, x, y, 1);
    m.reserve(16, 33, 4, 7); m.reserve(10, 1, 15, 9);
    K.forest(m, { seed: 2025, thr: 0.5, kinds: ['pine', 'dark', 'pine', 'bamboo'], avoid: 1 });
    m.warp(15, 39, 5, 1, 'c20xiegu', 17, 37, 'up', () => false, '诸葛亮：曹操就在斜谷口，不可退。');
    m.npc({ id: 'xg20inn', spec: 'innkeeper', x: 20, y: 36, dir: 'left', talk: campMenu('主公，此去便是曹营。', '斜谷军需') });
    K.guard(m, { id: 'xc20', spec: 'xuchu', x: 16, y: 21, dir: 'down', flag: 'c20_xu', group: ['xuchu4', 'caoqi7', 'caobing7'], boss: true, intro: '虎痴 许褚！', bg: 'shu',
      lines: [['xuchu', '谁敢犯丞相大营！许褚在此！']] });
    m.npc({ id: 'cc20', spec: 'caocao', x: 17, y: 6, dir: 'down', cond: () => G.flag('c20_xu') && !G.flag('c20_cc'), marker: () => true, talk: caocaoScene });
    m.npc({ id: 'yx20', spec: 'yangxiu', x: 20, y: 5, dir: 'down', cond: () => G.flag('c20_xu') && !G.flag('c20_cc'), talk: K.talk([['yangxiu', '（正在收拾行装）鸡肋者，食之无肉，弃之有味……']]) });
    return m;
  };

  async function caocaoScene() {
    await G.narrate('曹操屯兵日久，欲要进兵，又被马超拒守；欲收兵回，又恐被蜀兵耻笑。心中犹豫不决。');
    await G.narrate('适庖官进鸡汤。操见碗中有鸡肋，因而有感于怀。正沉吟间，夏侯惇入帐，禀请夜间口号——');
    await G.lines([
      ['caocao', '（随口）鸡肋！鸡肋！'],
      ['yangxiu', '（闻之，便教随行军士各收拾行装）鸡肋者，食之无肉，弃之有味。今进不能胜，退恐人笑，在此无益，不如早归。来日魏王必班师矣。'],
    ]);
    await G.narrate('曹操听说杨修擅造言语，乱我军心，大怒，喝刀斧手推出斩之，将首级号令于辕门外。');
    await G.lines([
      ['caocao', '大耳贼！竟敢来犯！'],
      ['liubei', '曹操！你篡汉之心，路人皆知——今日斜谷，便是你的鸡肋！'],
      ['weiyan', '（拈弓搭箭，暗觑曹操）'],
    ]);
    const r = await G.battle(['caocao', 'caoshe7', 'caobing7', 'caoqi7'], { bg: 'shu', boss: true, intro: '魏王 曹操！' });
    if (r !== 'win') return;
    G.setFlag('c20_cc');
    await G.narrate('庞德急救曹操回营。曹操被魏延射中人中，折却门牙两个，方信杨修之言，传令班师。');
    await G.narrate('曹操回到许都，汉中尽归刘备。');
    await G.fadeOut(1.2);
    await G.narrate('建安二十四年秋七月，沔阳筑坛，方圆九里，分布五方，各设旌旗仪仗。群臣皆依次序排列——');
    G.audio.sfx('gong');
    await G.narrate('许靖、法正请刘备登坛，进冠冕玺绶讫，面南而坐，受文武官员拜贺：是为汉中王。');
    await G.fadeIn(1.0);
    await G.lines([
      ['liubei', '备以庸才，承汉室宗亲，暂领汉中王位。孤与诸公，共讨国贼，以复汉室！'],
      ['zhugeliang', '立子刘禅为王世子。封许靖为太傅，法正为尚书令；诸葛亮为军师，总理军国重事。'],
      ['zhugeliang', '封关羽、张飞、赵云、马超、黄忠——为五虎大将。魏延为汉中太守。'],
    ]);
    await G.lines([
      ['zhangfei', '五虎大将！嘿嘿，俺老张也是一虎！'],
      ['huangzhong', '老夫七十岁了，还做了一回老虎。哈哈哈！'],
      ['zhaoyun', '……荆州那边，二将军听说要与老将军同列，怕是要不高兴了。'],
      ['zhugeliang', '吾已遣费诗前往荆州。云长的脾气，亮自有说辞。'],
    ]);
    G.addItem('longwen'); G.addItem('longwen');
    G.audio.sfx('levelup');
    await G.notice('刘备进位汉中王！\n获得 龙纹铠 ×2（汉中王府所铸）');
    await G.chapterEnd(G.CHAPTERS[20].endLines);
  }

  G.CHAPTERS[20] = {
    title: '汉中王',
    prologue: [
      '曹操大军进抵汉水。',
      '黄忠领兵去劫北山曹军粮草，过了约定的时辰，仍不见回来。',
      '守营的，是赵云。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(['zhaoyun']);
      G.setParty(['zhaoyun']);
      G.restoreAll();
      const w = G.world;
      w.load('c20hanshui', 20, 26, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhaoyun', '午时已过，黄老将军还未回来……'],
        ['zhaoyun', '张著，守好营寨。我去接应！'],
      ]);
      await G.notice('赵云单人出战。\n北渡汉水，去北山接应黄忠。');
    },
    endLines: [
      '关羽在荆州听说自己与黄忠同列五虎，起初大怒："大丈夫终不与老卒为伍！"',
      '费诗劝道："王与君侯，譬犹一体，同休等戚，祸福共之。"关羽这才拜受印绶。',
      '汉中王命关羽起兵，攻取樊城。',
      '关羽留糜芳守江陵、傅士仁守公安，',
      '自率大军，北上襄樊——',
      '那里，有曹仁、于禁、庞德在等着他。',
    ],
  };
})();
