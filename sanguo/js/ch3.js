/* ============================================================
 * 烽烟录 · 第三章　虎牢关
 * 酸枣联军大营（温酒斩华雄）→ 中原 → 虎牢关峡谷（三英战吕布）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const DRY = { gh: 50, gs: 28, gl: 33, sh: 32, ss: 26, sl: 30, path1: '#b8986a', path2: '#c8a878', soilPath1: '#a8875a', soilPath2: '#b8976a' };
  const GROUPS = [
    { e: ['xlbing', 'xlbing'], w: 3 }, { e: ['xlbing', 'xlshe'], w: 2 }, { e: ['xlqi', 'xlbing'], w: 2 },
    { e: ['xlshe', 'xlshe', 'xlbing'], w: 1 }, { e: ['xlqi', 'xlqi'], w: 1 }, { e: ['dzwei', 'xlbing'], w: 1 },
  ];

  /* ---------------- 酸枣联军大营 ---------------- */
  B.c3camp = () => {
    const m = new G.GameMap('c3camp', '酸枣 · 联军大营', 36, 26, TL.GRASS);
    Object.assign(m, { seed: 301, music: 'town', pal: DRY, battleBg: 'pass', flowers: 0.02 });
    m.reserve(16, 23, 4, 3);
    m.warp(16, 25, 4, 1, 'c3world', 9, 32, 'down');
    m.road([[17.5, 25], [17.5, 9]], 0.8, TL.PATH);
    m.road([[4, 13.5], [31, 13.5]], 0.6, TL.PATH);
    K.stakeRing(m, 1, 1, 34, 24, [[16, 24, 4, 1]]);
    for (let x = 0; x < 36; x++) { m.tree(x, 0, 'gold'); if (x < 15 || x > 20) m.tree(x, 25, 'gold'); }
    for (let y = 1; y < 25; y++) { m.tree(0, y, 'gold'); m.tree(35, y, 'gold'); }
    K.tent(m, 14, 3, { big: true, w: 8, h: 5, red: true, sign: '盟' });
    const fac = [['袁', '#a07a2a', '#f6e7c1'], ['曹', '#24304a', '#f6e7c1'], ['孙', '#a8322a', '#f6e7c1'], ['公', '#e0e2e6', '#2a2a2a']];
    for (const [x, y] of [[3, 3], [7, 3], [25, 3], [29, 3], [3, 16], [7, 18], [25, 16], [29, 18], [11, 18], [21, 18]]) K.tent(m, x, y, { red: true });
    [[12, 5], [23, 5], [12, 10], [23, 10], [6, 9], [29, 9], [14, 21], [21, 21]].forEach(([x, y], i) => { const f = fac[i % 4]; K.deco(m, 'flag', x, y, { text: f[0], color: f[1], tcol: f[2] }); });
    K.deco(m, 'tower', 3, 21, { w: 2, h: 2 }); K.deco(m, 'tower', 30, 21, { w: 2, h: 2 });
    K.deco(m, 'rack', 10, 15); K.deco(m, 'rack', 26, 15); K.deco(m, 'crates', 14, 16); K.deco(m, 'jar', 22, 16); K.deco(m, 'cart', 31, 13, { w: 2 });

    m.npc({ id: 'yuanshao', spec: 'yuanshao', x: 17, y: 8, dir: 'down', marker: () => !G.flag('c3_huaxiong'), talk: async () => {
      if (!G.flag('c3_huaxiong')) await huaxiongScene();
      else await say('yuanshao', '先锋已出，诸位速往虎牢关！本盟主在此坐镇。');
    } });
    m.npc({ id: 'caocao', spec: 'caocao', x: 19, y: 8, dir: 'down', talk: async () => {
      if (!G.flag('c3_huaxiong')) await G.lines([['caocao', '刘玄德？久闻大名。破黄巾时，你我也算并肩作战过。'], ['caocao', '眼下华雄在汜水关前耀武扬威，诸侯们却只会面面相觑……']]);
      else if (!G.flag('c3_lubu')) await G.lines([['caocao', '云长温酒斩华雄，真乃天下奇事！'], ['caocao', '只是虎牢关下，吕布那厮号称"人中吕布，马中赤兔"，玄德务必小心。']]);
      else await say('caocao', '……');
    } });
    m.npc({ id: 'gsz', spec: 'gongsunzan', x: 8, y: 12, dir: 'down', talk: async () => {
      if (!G.flag('c3_huaxiong')) await say('gongsunzan', '玄德，诸侯都在盟主帐中议事，你去听听吧。袁本初此人……好面子，你多担待。');
      else await say('gongsunzan', '我领本部白马义从先行一步，在虎牢关下等你们！');
    } });
    m.npc({ id: 'qm3', spec: 'hanbing', x: 26, y: 12, dir: 'down', talk: K.shopTalk('hanbing', ['jinchuang', 'zhuojiu', 'meijiu', 'xuming', 'binliang', 'tiejia', 'yulin'], '军需', '联军粮草充足，尽管拿！当然……得付钱。', '军需官') });
    m.npc({ id: 'doc3', spec: 'oldman', x: 12, y: 12, dir: 'down', talk: async () => {
      await say('oldman', '伤兵营在此，不收钱。', { name: '军医' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      const s = await G.choose(['记录进度', '不用了']);
      if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 'c3s1', spec: 'hanbing', x: 6, y: 15, wander: 2, talk: K.talk([['hanbing', '十八路诸侯，号称数十万大军……可大家都等着别人先上。']]) });
    m.npc({ id: 'c3s2', spec: 'caobing', x: 28, y: 15, wander: 2, talk: K.talk([['caobing', '我家主公散尽家财招兵买马，就是为了诛杀国贼董卓！', { name: '曹军士卒' }]]) });
    m.npc({ id: 'c3s3', spec: 'hanbing', x: 15, y: 22, dir: 'up', talk: K.talk([['hanbing', '出了营往东北走，便是汜水关、虎牢关。中途有座驿站可以歇脚。']]) });
    return m;
  };

  async function huaxiongScene() {
    await G.lines([
      ['yuanshao', '……刘备？公孙伯珪带来的人？既是平原县令，就站到后面去吧。'],
      ['zhangfei', '你——！'],
      ['guanyu', '三弟。'],
    ]);
    G.audio.sfx('gong');
    await G.lines([
      ['messenger', '报——！华雄引铁骑下关，斩了长沙太守孙坚部将祖茂！'],
      ['messenger', '报——！济北相鲍信之弟鲍忠，被华雄斩了！'],
      ['messenger', '报——！上将俞涉出战，不三合，被华雄斩了！'],
      ['yuanshao', '……可惜我的上将颜良、文丑未至！若有一人在此，何惧华雄！'],
      ['guanyu', '小将愿往，斩华雄头，献于帐下！'],
      ['yuanshao', '你是何人？现居何职？'],
      ['liubei', '此乃在下义弟关羽，现为马弓手。'],
      ['yuanshao', '马弓手？！欺我众诸侯无大将耶？给我叉出去！'],
      ['caocao', '本初息怒。此人仪表不俗，华雄安知他是弓手？不妨让他一试。'],
      ['caocao', '来，热酒一杯，为将军壮行！'],
      ['guanyu', '酒且斟下，某去便来。'],
    ]);
    await G.narrate('关羽提刀出帐，飞身上马。帐外鼓声大振，喊声如雷……');
    const r = await G.battle(['huaxiong'], { bg: 'pass', boss: true, party: ['guanyu'], intro: '关羽 单骑迎战 华雄！' });
    if (r !== 'win') return;
    G.setFlag('c3_huaxiong');
    G.audio.sfx('victory');
    await G.narrate('鸾铃响处，关羽提华雄之头，掷于地上。');
    await G.narrate('其酒尚温。');
    await G.lines([
      ['zhangfei', '哈哈哈！二哥斩了华雄！看谁还敢说咱们是无名之辈！'],
      ['caocao', '好！好一个关云长！'],
      ['yuanshao', '……咳。既如此，诸军进兵虎牢关！刘备，你兄弟三人随公孙瓒同往。'],
      ['liubei', '遵命！'],
    ]);
    await G.notice('前往虎牢关，讨伐董卓！\n（营中军需官、军医可补给疗伤）');
  }

  /* ---------------- 中原 ---------------- */
  B.c3world = () => {
    const m = new G.GameMap('c3world', '中 原', 56, 40, TL.GRASS);
    Object.assign(m, { seed: 331, music: 'field', ambient: 'clouds', pal: DRY, battleBg: 'pass', flowers: 0.02 });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (G.fbm(x / 6, y / 6, 337) > 0.6) m.set(x, y, TL.SOIL);
    K.tallGrass(m, 339, 0.6);
    m.road([[9.5, 31], [9.5, 34], [20, 33], [28, 26.5], [34, 20], [40, 14], [46, 9], [47.5, 5], [47.5, 3]], 0.75, TL.PATH);
    m.prop('campicon', 8, 28, 4, 3, { label: '酸枣大营', han: true, flagCol: '#a07a2a', foot: [8, 28, 4, 3] });
    m.warp(9, 31, 2, 1, 'c3camp', 17, 23, 'up'); m.reserve(9, 32, 2, 1);
    m.warp(47, 3, 2, 1, 'c3pass', 15, 44, 'up'); m.reserve(47, 4, 2, 1);
    m.prop('house', 24, 21, 5, 4, { sign: '驿站', roof: '#4a3b36', lantern: true });
    m.reserve(25, 25, 4, 1);
    m.npc({ id: 'inn3', spec: 'innkeeper', x: 26, y: 25, dir: 'down', talk: K.innTalk('innkeeper', 60) });
    m.npc({ id: 'shop3', spec: 'merchant', x: 28, y: 25, dir: 'down', talk: K.shopTalk('merchant', ['jinchuang', 'meijiu', 'xuming', 'junliang', 'yulin'], '驿站', '前头就是虎牢关，过了这村可没这店了！') });
    K.mountain(m, 44, 2, 0); K.mountain(m, 49, 2, 0);
    for (let x = 0; x < 54; x += 3) K.mountain(m, x, 0);
    for (let y = 3; y < 38; y += 2) K.mountain(m, 53, y);
    for (const [x, y] of [[41, 4], [51, 6], [38, 3], [34, 6], [30, 3], [43, 12], [48, 14], [45, 19], [50, 23], [2, 10], [6, 14], [3, 18], [38, 30], [44, 32], [16, 8], [20, 5]]) K.mountain(m, x, y);
    K.deco(m, 'sign', 45, 6, { text: '虎牢关' });
    m.event({ type: 'inspect', x: 45, y: 6, w: 1, h: 1, run: () => G.narrate('路牌：北 · 虎牢关　距洛阳五十里') });
    K.forest(m, { seed: 341, thr: 0.68, kinds: ['gold', 'tree', 'pine'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.SOIL]: 0.03 }, groups: GROUPS };
    return m;
  };

  /* ---------------- 虎牢关峡谷 ---------------- */
  B.c3pass = () => {
    const m = new G.GameMap('c3pass', '虎牢关', 32, 46, TL.SOIL);
    Object.assign(m, { seed: 361, under: TL.SOIL, music: 'camp', pal: DRY, battleBg: 'pass', ambient: 'clouds' });
    const pts = [[15.5, 46], [15.5, 40], [9, 35], [9, 27], [20, 22], [22, 14], [15.5, 10], [15.5, 5]];
    const clear = new Set();
    m.road(pts, 2.6, null, (x, y) => clear.add(x + ',' + y));
    for (let y = 4; y <= 10; y++) for (let x = 6; x <= 25; x++) clear.add(x + ',' + y);
    m.road(pts, 0.7, TL.PATH);
    m.rect(0, 2, 32, 2, TL.WALL);
    m.prop('gate', 13, 2, 5, 2, { nofoot: true, plaque: '虎牢关', sortBias: 1 });
    m.warp(14, 45, 3, 1, 'c3world', 47, 4, 'down');
    m.reserve(14, 43, 3, 2);
    for (const [x, y] of [[9, 5], [22, 5], [6, 8], [25, 8]]) K.deco(m, 'flag', x, y, { text: '董', color: '#3a1a40', tcol: '#e8d8a8' });
    K.deco(m, 'tower', 4, 4, { w: 2, h: 2 }); K.deco(m, 'tower', 26, 4, { w: 2, h: 2 });
    // 峡谷崖壁：先摆山，再补碎石
    for (let y = 4; y < m.h - 1; y += 2) for (let x = 0; x < m.w - 2; x += 3) {
      const xx = x + (y % 4 === 0 ? 1 : 0);
      let ok = true; for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) if (clear.has((xx + i) + ',' + (y + j))) ok = false;
      if (ok) K.mountain(m, xx, y, 0);
    }
    for (let y = 4; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!clear.has(x + ',' + y)) m.tree(x, y, G.hash(x, y, 2) < 0.5 ? 'rock' : 'gold');
    for (let x = 0; x < 32; x++) for (const y of [0, 1]) m.set(x, y, TL.WALL);
    m.prop('cart', 7, 31, 2, 1, { foot: [7, 31, 2, 1] });
    m.event({ type: 'inspect', x: 7, y: 31, w: 2, h: 1, run: async () => {
      if (G.flag('c3_cart')) { await G.narrate('粮车已经空了。'); return; }
      G.setFlag('c3_cart'); G.restoreAll(); G.audio.sfx('heal');
      await G.notice('缴获西凉军的粮车！全军兵力与策略恢复了。');
    } });
    K.guard(m, { id: 'p1', spec: 'xlbing', x: 15, y: 40, flag: 'c3_p1', group: ['xlbing', 'xlbing', 'xlshe'], bg: 'pass', lines: [['xlbing', '关东鼠辈，也敢犯我虎牢关！', { name: '西凉兵' }]] });
    K.guard(m, { id: 'p2', spec: 'xlqi', x: 9, y: 29, flag: 'c3_p2', group: ['xlqi', 'xlbing', 'xlshe'], bg: 'pass', lines: [['xlqi', '西凉铁骑，冲啊！', { name: '西凉铁骑' }]] });
    K.guard(m, { id: 'lijue', spec: 'lijue', x: 20, y: 22, flag: 'c3_lijue', group: ['lijue', 'xlbing', 'xlshe'], bg: 'pass', boss: true, intro: '西凉大将 李傕 杀到！',
      lines: [['lijue', '我乃相国麾下校尉李傕！尔等速速退去，饶你们不死！'], ['zhangfei', '董贼的狗腿子，也配说这话！']] });
    K.guard(m, { id: 'p4', spec: 'dzwei', x: 22, y: 14, flag: 'c3_p4', group: ['dzwei', 'xlshe', 'xlbing'], bg: 'pass', lines: [['dzwei', '相国亲卫在此，谁敢上前！', { name: '董卓亲卫' }]] });
    m.npc({ id: 'lubu', spec: 'lubu', x: 15, y: 6, dir: 'down', aggro: true, cond: () => !G.flag('c3_lubu'), talk: lubuScene });
    m.npc({ id: 'gsz3', spec: 'gongsunzan', x: 11, y: 8, dir: 'right', cond: () => !G.flag('c3_lubu'), talk: async () => await say('gongsunzan', '玄德……那吕布……勇不可当……') });
    m.encounters = { rates: { [TL.SOIL]: 0.03, [TL.PATH]: 0.012 }, groups: GROUPS };
    m.onEnter = async () => {
      if (G.flag('c3_pass_in')) return;
      G.setFlag('c3_pass_in');
      await G.lines([['guanyu', '两山夹峙，一关横锁。好险要的去处。'], ['liubei', '公孙将军已先行一步，我们快跟上！']]);
    };
    return m;
  };

  async function lubuScene() {
    G.audio.sfx('gong'); G.shake(5, 0.5);
    await G.narrate('关门大开，一员大将飞马而出。头戴三叉束发紫金冠，身披西川红锦百花袍，手持方天画戟，坐下嘶风赤兔马——');
    await G.lines([
      ['gongsunzan', '玄德！此人是吕布！我挺槊迎战，不数合便败下阵来……此人勇不可当！'],
      ['lubu', '哈哈哈！关东诸侯，尽是些酒囊饭袋！还有谁敢来与我吕布一战？'],
      ['zhangfei', '三姓家奴休走！燕人张飞在此！'],
      ['lubu', '无名小卒，也敢来送死？'],
    ]);
    await G.narrate('张飞挺丈八蛇矛，飞马直取吕布。两马相交，连斗五十余合，不分胜负。');
    await G.lines([
      ['guanyu', '三弟，我来助你！'],
      ['liubei', '二弟、三弟，为兄来也！'],
    ]);
    await G.narrate('关羽舞青龙偃月刀，刘备掣双股剑，三人围住吕布，丁字儿厮杀——');
    const r = await G.battle(['lubu'], { bg: 'pass', boss: true, party: ['liubei', 'guanyu', 'zhangfei'], intro: '三英战吕布！' });
    if (r !== 'win') return;
    G.setFlag('c3_lubu');
    await G.narrate('吕布架隔遮拦不定，虚刺刘备一戟，荡开阵角，倒拖画戟，飞马退回关上。');
    await G.lines([
      ['zhangfei', '吕布休走！再吃俺一矛！'],
      ['guanyu', '三弟，关上箭如雨下，不可追了。'],
      ['gongsunzan', '三位以三敌一，竟逼退了吕布！今日之后，天下谁人不识刘、关、张！'],
      ['liubei', '……吕布虽勇，却反复无常，不足为惧。真正的国贼，是关中的董卓。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[3].endLines);
  }

  G.CHAPTERS[3] = {
    title: '虎牢关',
    prologue: [
      '中平六年，灵帝驾崩，宦官与外戚火并，洛阳大乱。',
      '西凉刺史董卓趁机引兵入京，废少帝，立献帝，自封相国。',
      '董卓残暴不仁，淫乱宫闱，屠戮百姓，天下共愤。',
      '曹操发矫诏，号召天下诸侯共讨国贼。',
      '刘备兄弟闻讯，随北平太守公孙瓒，奔赴酸枣会盟。',
    ],
    start: async () => {
      const w = G.world;
      w.load('c3camp', 17, 22, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['gongsunzan', '玄德，这便是酸枣大营。十八路诸侯齐聚于此，推袁本初为盟主。'],
        ['liubei', '天下英雄共讨国贼，真是盛事！'],
        ['zhangfei', '人倒是不少，就是不知道有几个是真敢打仗的。'],
        ['gongsunzan', '哈哈，翼德说话还是这么直。走，去盟主帐前听令。'],
      ]);
    },
    endLines: [
      '吕布败回虎牢关，联军士气大振。',
      '董卓惊惧，竟焚烧洛阳宫室，挟天子与百万百姓西迁长安。',
      '曹操独自追击，于荥阳中伏大败；诸侯各怀私心，按兵不动。',
      '会盟终于不欢而散，天下从此陷入群雄割据。',
      '"三英战吕布"的故事，却从此传遍天下。',
      '刘备兄弟随公孙瓒返回北平，而战火，正向东方的徐州蔓延……',
    ],
  };
})();
