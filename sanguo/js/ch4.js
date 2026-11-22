/* ============================================================
 * 烽烟录 · 第四章　徐州
 * 北平营（赵云加入）→ 青徐原野 → 北海解围（管亥）→ 徐州城 → 曹营（夏侯惇）→ 三让徐州
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SNOW = { gh: 205, gs: 12, gl: 72, path1: '#a8a090', path2: '#bab2a2' };
  const LUSH = { gh: 92, gs: 40, gl: 27 };
  const GROUPS = [
    { e: ['hjyu', 'hjyu'], w: 3 }, { e: ['hjyu', 'hjyu2'], w: 2 }, { e: ['caobing', 'caobing'], w: 2 },
    { e: ['caobing', 'caoshe'], w: 2 }, { e: ['caoqi', 'caobing'], w: 1 }, { e: ['hjyu2', 'hjyu', 'hjyu'], w: 1 },
  ];

  /* ---------------- 北平 · 公孙瓒营 ---------------- */
  B.c4camp = () => {
    const m = new G.GameMap('c4camp', '北平 · 公孙瓒营', 30, 22, TL.GRASS);
    Object.assign(m, { seed: 401, music: 'town', ambient: 'snow', pal: SNOW, battleBg: 'snow', flowers: 0 });
    m.reserve(13, 19, 4, 3);
    m.warp(13, 21, 4, 1, 'c4world', 7, 10, 'down');
    m.road([[14.5, 21], [14.5, 8]], 0.8, TL.PATH);
    m.road([[4, 12.5], [25, 12.5]], 0.6, TL.PATH);
    K.stakeRing(m, 1, 1, 28, 20, [[13, 20, 4, 1]]);
    for (let x = 0; x < 30; x++) { m.tree(x, 0, 'snowy'); if (x < 12 || x > 17) m.tree(x, 21, 'snowy'); }
    for (let y = 1; y < 21; y++) { m.tree(0, y, 'snowy'); m.tree(29, y, 'snowy'); }
    K.tent(m, 11, 3, { big: true, w: 7, h: 5, red: true, sign: '公' });
    for (const [x, y] of [[3, 3], [22, 3], [3, 14], [22, 14], [7, 16], [18, 16]]) K.tent(m, x, y, { red: true });
    for (const [x, y] of [[10, 5], [18, 5], [12, 10], [17, 10]]) K.deco(m, 'flag', x, y, { text: '公', color: '#e0e2e6', tcol: '#2a2a2a' });
    K.deco(m, 'fire', 6, 10); K.deco(m, 'fire', 23, 10); K.deco(m, 'rack', 4, 11); K.deco(m, 'crates', 25, 11);
    m.npc({ id: 'gsz4', spec: 'gongsunzan', x: 14, y: 8, dir: 'down', talk: K.talk([['gongsunzan', '子龙随你同去，我便放心了。北海、徐州，就拜托玄德了！']]) });
    m.npc({ id: 'tsc', spec: 'taishici', x: 12, y: 9, dir: 'right', talk: K.talk([['taishici', '北海城被管亥围得水泄不通！孔北海待我母亲恩重如山，还请刘使君速速发兵！']]) });
    m.npc({ id: 'qm4', spec: 'hanbing', x: 8, y: 11, dir: 'down', talk: K.shopTalk('hanbing', ['jinchuang', 'dabu', 'meijiu', 'xuming', 'junliang', 'yulin', 'mingguang'], '军需', '北地苦寒，多备些酒！', '军需官') });
    m.npc({ id: 'doc4', spec: 'oldman', x: 20, y: 11, dir: 'down', talk: async () => {
      await say('oldman', '天寒地冻，伤口不易愈合。来，老朽给你们看看。', { name: '军医' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      const s = await G.choose(['记录进度', '不用了']);
      if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 'c4s1', spec: 'gongsunzan', x: 6, y: 17, wander: 2, talk: K.talk([['hanbing', '我们是白马义从！主公的白马军，乌桓人听了都要发抖！', { name: '白马义从' }]]) });
    return m;
  };

  /* ---------------- 青徐原野 ---------------- */
  B.c4world = () => {
    const m = new G.GameMap('c4world', '青 徐', 60, 44, TL.GRASS);
    Object.assign(m, { seed: 431, music: 'field', ambient: 'clouds', pal: LUSH, battleBg: 'field', flowers: 0.06 });
    K.tallGrass(m, 433, 0.56);
    m.road([[0, 37], [12, 36], [24, 40], [36, 39], [48, 42], [60, 41]], 1.2, TL.WATER);
    m.road([[7.5, 9], [7.5, 14], [16, 15], [25.5, 14], [25.5, 13]], 0.75, TL.PATH);
    m.road([[16, 15], [22, 22], [30, 26], [39.5, 30], [39.5, 33]], 0.75, TL.PATH);
    m.road([[30, 26], [42, 24], [51.5, 24], [51.5, 25]], 0.75, TL.PATH);
    m.prop('campicon', 6, 6, 4, 3, { label: '北平营', han: true, flagCol: '#e0e2e6', foot: [6, 6, 4, 3] });
    m.prop('townicon', 24, 10, 4, 3, { label: '北海', foot: [24, 10, 4, 3] });
    m.prop('townicon', 38, 30, 4, 3, { label: '徐州', foot: [38, 30, 4, 3] });
    m.prop('campicon', 50, 21, 4, 3, { label: '曹营', han: true, flagCol: '#2f4a7a', foot: [50, 21, 4, 3] });
    m.warp(7, 9, 2, 1, 'c4camp', 14, 19, 'up'); m.reserve(7, 10, 2, 1);
    m.warp(25, 13, 2, 1, 'c4beihai', 15, 32, 'up'); m.reserve(25, 14, 2, 1);
    m.warp(39, 33, 2, 1, 'c4xuzhou', 20, 29, 'up'); m.reserve(39, 34, 2, 1);
    m.warp(51, 24, 2, 1, 'c4caoying', 17, 30, 'up', () => G.flag('c4_tao'), '曹军大营戒备森严，旌旗蔽日……还是先去徐州面见陶谦吧。'); m.reserve(51, 25, 2, 1);
    for (let x = 0; x < 58; x += 3) K.mountain(m, x, 0);
    for (let y = 3; y < 34; y += 2) K.mountain(m, 57, y);
    for (const [x, y] of [[14, 4], [18, 6], [32, 4], [36, 7], [42, 4], [47, 8], [52, 12], [44, 14], [2, 20], [5, 25], [10, 28], [48, 30], [53, 33], [30, 33]]) K.mountain(m, x, y);
    K.deco(m, 'sign', 18, 16, { text: '徐州' });
    m.event({ type: 'inspect', x: 18, y: 16, w: 1, h: 1, run: () => G.narrate('路牌：东北 · 北海　东南 · 徐州　东 · 郯城') });
    K.forest(m, { seed: 441, thr: 0.62, kinds: ['tree', 'pine', 'dark', 'tree'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08 }, groups: GROUPS };
    return m;
  };

  /* ---------------- 北海城外 ---------------- */
  B.c4beihai = () => {
    const m = new G.GameMap('c4beihai', '北海城外', 32, 34, TL.GRASS);
    Object.assign(m, { seed: 451, music: 'camp', pal: LUSH, battleBg: 'city', ambient: 'clouds' });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (G.fbm(x / 4, y / 4, 453) > 0.58) m.set(x, y, TL.SOIL);
    m.rect(0, 0, 32, 4, TL.WALL);
    m.prop('gate', 13, 2, 5, 2, { nofoot: true, plaque: '北海', sortBias: 1 });
    const pts = [[15.5, 34], [15.5, 28], [9, 23], [9, 17], [21, 13], [21, 8], [15.5, 6], [15.5, 5]];
    m.road(pts, 0.75, TL.PATH);
    m.warp(14, 33, 3, 1, 'c4world', 25, 14, 'down');
    m.reserve(14, 31, 3, 2);
    for (const [x, y] of [[3, 6], [25, 6], [4, 25], [24, 24], [3, 14], [25, 16], [11, 9], [27, 28], [3, 29]]) K.tent(m, x, y, {});
    for (const [x, y] of [[8, 6], [23, 10], [13, 20], [19, 26], [6, 19], [27, 21]]) K.deco(m, 'fire', x, y);
    for (const [x, y] of [[10, 5], [20, 5], [12, 15], [24, 19], [7, 28]]) K.deco(m, 'flag', x, y, { text: G.hash(x, y) < 0.5 ? '黄' : '天' });
    K.deco(m, 'rack', 29, 12); K.deco(m, 'crates', 2, 11);
    for (let y = 4; y < m.h; y++) for (const x of [0, 1, 30, 31]) m.tree(x, y, G.hash(x, y) < 0.5 ? 'tree' : 'dark');
    K.guard(m, { id: 'b1', spec: 'hjjing', x: 15, y: 27, flag: 'c4_b1', group: ['hjyu', 'hjyu', 'hjyu2'], bg: 'city', lines: [['hjjing', '又来一路救兵？哈哈，来一个杀一个！', { name: '黄巾余党' }]] });
    K.guard(m, { id: 'b2', spec: 'ylishi', x: 9, y: 19, flag: 'c4_b2', group: ['hjyu2', 'hjyu', 'hjyu'], bg: 'city', lines: [['ylishi', '管将军说了，北海城里的粮食，都是咱们的！', { name: '黄巾悍匪' }]] });
    K.guard(m, { id: 'b3', spec: 'hjjing', x: 21, y: 11, flag: 'c4_b3', group: ['hjyu', 'hjyu2', 'hjyu'], bg: 'city' });
    m.npc({ id: 'guanhai', spec: 'guanhai', x: 15, y: 5, dir: 'down', aggro: true, cond: () => !G.flag('c4_guanhai'), talk: async () => {
      await G.lines([
        ['guanhai', '哪里来的兵马，坏俺好事！北海城里粮草堆积如山，孔融那老儿再不开城，俺便屠了他满城！'],
        ['zhaoyun', '常山赵子龙在此！贼寇还不下马受缚！'],
        ['guanyu', '子龙且慢，此贼交给关某。'],
      ]);
      const r = await G.battle(['guanhai', 'hjyu2', 'hjyu'], { bg: 'city', boss: true, intro: '黄巾余党 管亥 杀到！' });
      if (r !== 'win') return;
      G.setFlag('c4_guanhai');
      await G.narrate('关羽拍马舞刀，与管亥战不数合，青龙刀起处，管亥落马。黄巾余众四散奔逃。');
      await G.narrate('城门大开，北海太守孔融亲自出城相迎。');
      await G.lines([
        ['kongrong', '刘玄德！若非使君仗义相救，北海满城百姓，今日便要遭殃了！'],
        ['liubei', '孔北海言重了。孔融让梨的美名，刘备自幼便听闻，今日得见，三生有幸。'],
        ['kongrong', '惭愧……只是眼下还有一件更急的事：曹操之父曹嵩，在徐州境内被陶谦部将张闿所杀。'],
        ['kongrong', '曹操尽起大军，扬言要血洗徐州。所过之处，鸡犬不留，泗水为之不流……'],
        ['kongrong', '陶恭祖是忠厚长者，徐州百姓何辜！玄德，你可愿与我一同去救徐州？'],
        ['liubei', '救民于水火，正是刘备的本分。'],
        ['zhaoyun', '主公——不，玄德公。子龙愿为前驱！'],
      ]);
      await G.notice('前往东南方的徐州城，面见徐州牧陶谦。');
    } });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.SOIL]: 0.03, [TL.PATH]: 0.012 }, groups: [{ e: ['hjyu', 'hjyu'], w: 2 }, { e: ['hjyu', 'hjyu2'], w: 1 }, { e: ['hjyu2', 'hjyu2'], w: 1 }] };
    return m;
  };

  /* ---------------- 徐州城 ---------------- */
  B.c4xuzhou = () => xuzhouTown('c4xuzhou', 'c4world', 39, 34, 4);
  // 徐州城（第四、五章共用骨架）
  function xuzhouTown(id, worldId, wx, wy, ch) {
    const m = new G.GameMap(id, '徐 州', 40, 32, TL.GRASS);
    Object.assign(m, { seed: 461, music: 'town', pal: LUSH, ambient: 'leaves', flowers: 0.04 });
    K.walls(m, 0, 0, 39, 31, [{ side: 's', x: 19, plaque: '徐州' }]);
    m.road([[20, 31], [20, 9]], 1, TL.PATH);
    m.road([[2, 14.5], [37, 14.5]], 0.6, TL.PATH);
    m.rect(14, 11, 13, 8, TL.FLOOR);
    m.road([[6, 9], [6, 14]], 0.6, TL.PATH); m.road([[33, 9], [33, 14]], 0.6, TL.PATH);
    m.road([[6, 23], [6, 16]], 0.6, TL.PATH); m.road([[33, 23], [33, 16]], 0.6, TL.PATH);
    m.prop('hall', 15, 3, 11, 6, { sign: '州牧府' });
    m.prop('house', 3, 4, 7, 5, { sign: '客栈' });
    m.prop('house', 30, 4, 7, 5, { sign: '杂货', roof: '#45403a' });
    m.prop('house', 30, 18, 7, 5, { sign: '兵器', roof: '#3a3a3a', wall: '#cbbd9e' });
    m.prop('house', 3, 18, 7, 5, { sign: '糜府', roof: '#4a3b36' });
    m.prop('house', 11, 23, 5, 4, { roof: '#3d4654', lantern: false }); m.prop('house', 24, 23, 5, 4, { roof: '#4a3b36', lantern: false });
    K.deco(m, 'well', 15, 12); K.deco(m, 'board', 25, 12);
    for (const [x, y] of [[13, 9], [27, 9]]) K.deco(m, 'flag', x, y, { text: ch === 5 ? '吕' : '陶', color: ch === 5 ? '#8a1e1e' : '#5a4a2a', tcol: '#f6e7c1' });
    m.warp(19, 31, 3, 1, worldId, wx, wy, 'down');
    m.reserve(19, 28, 3, 3);
    m.npc({ id: 'inn', spec: 'innkeeper', x: 6, y: 9, dir: 'down', talk: K.innTalk('innkeeper', 80) });
    m.npc({ id: 'shop', spec: 'merchant', x: 33, y: 9, dir: 'down', talk: K.shopTalk('merchant', ch >= 6 ? ['dabu', 'dahuan', 'meijiu', 'qiongjiang', 'xuming', 'junliang', 'jingliang'] : ['jinchuang', 'dabu', 'meijiu', 'xuming', 'junliang'], '杂货', '徐州富庶，货色齐全！') });
    m.npc({ id: 'arm', spec: 'smith', x: 33, y: 23, dir: 'down', talk: K.shopTalk('smith', ch >= 6 ? ['xuanjia', 'longlin'] : ch === 5 ? ['mingguang', 'xuanjia'] : ['yulin', 'mingguang'], '兵器', '上好的甲胄，保你刀枪不入！') });
    K.innerTrees(m, 1, 2, 38, 29, 7, 0.5);
    K.treesAt(m, [[12, 17], [28, 17], [9, 13], [31, 13], [16, 27], [24, 27]], 'tree');
    const deco = G.kit.xuDecor[ch]; if (deco) deco(m);
    return m;
  }
  G.kit.xuzhouTown = xuzhouTown;
  G.kit.xuDecor = G.kit.xuDecor || {};
  G.kit.xuDecor[4] = (m) => {
    m.npc({ id: 'taoqian', spec: 'taoqian', x: 20, y: 9, dir: 'down', marker: () => (G.flag('c4_guanhai') && !G.flag('c4_tao')) || G.flag('c4_cao'), talk: taoqianTalk });
    m.npc({ id: 'mizhu', spec: 'mizhu', x: 6, y: 23, dir: 'down', talk: async () => {
      if (!G.flag('c4_cao')) await G.lines([['mizhu', '在下糜竺，世代经商。曹军若破城，徐州百万家财都要化为灰烬……'], ['mizhu', '使君若需军资，糜家愿倾囊相助！']]);
      else await say('mizhu', '曹军退了！徐州得保，全赖玄德公！');
      if (!G.flag('c4_mizhu_gift')) { G.setFlag('c4_mizhu_gift'); G.state.gold += 500; G.audio.sfx('buy'); await G.notice('糜竺赠送军资 500 金！'); }
    } });
    m.npc({ id: 'xz1', spec: 'woman', x: 17, y: 16, wander: 2, talk: async () => { if (G.flag('c4_cao')) await say('woman', '曹军退了，菩萨保佑！'); else await say('woman', '听说曹军所到之处，不分老幼尽皆屠戮……这可怎么办呀。'); } });
    m.npc({ id: 'xz2', spec: 'oldman', x: 24, y: 17, wander: 1, talk: K.talk([['oldman', '陶使君年事已高，膝下二子都不成器。徐州的将来……唉。']]) });
    m.npc({ id: 'xz3', spec: 'hanbing', x: 18, y: 27, dir: 'up', talk: async () => { if (G.flag('c4_tao') && !G.flag('c4_cao')) await say('hanbing', '曹营就在城东北方向，扎在郯城外。'); else await say('hanbing', '徐州城墙高厚，可曹操的兵实在太多了。'); } });
    m.npc({ id: 'xz4', spec: 'child', x: 26, y: 20, wander: 3, talk: K.talk([['child', '那个白袍的将军好威风！我长大了也要当将军！']]) });
  };

  async function taoqianTalk() {
    if (!G.flag('c4_guanhai')) { await G.lines([['taoqian', '北海孔文举被黄巾所困……唉，老夫自身难保，实在无力相救。'], ['taoqian', '若有义士肯救北海，老夫感激不尽。']]); return; }
    if (!G.flag('c4_tao')) {
      await G.lines([
        ['taoqian', '你就是刘玄德？孔文举在信中，对你赞不绝口。'],
        ['taoqian', '曹孟德之父曹嵩，过境徐州时，老夫好意派都尉张闿护送，谁知张闿本是黄巾降将，见财起意，竟害了曹嵩全家……'],
        ['taoqian', '张闿逃之夭夭，曹操却把这笔血债算在徐州百姓头上。'],
        ['taoqian', '如今曹军以夏侯惇为先锋，扎营郯城之外，旦夕便要攻城。玄德，徐州全赖你了！'],
        ['liubei', '使君放心。刘备虽兵微将寡，也愿与徐州共存亡！'],
        ['zhaoyun', '曹营在城东北。末将愿打头阵！'],
      ]);
      G.setFlag('c4_tao');
      return;
    }
    if (!G.flag('c4_cao')) { await say('taoqian', '曹营在城东北，郯城之外。玄德，一切拜托了。'); return; }
    // 三让徐州
    await G.lines([
      ['taoqian', '曹军已退，徐州得保！玄德，请受老夫一拜。'],
      ['taoqian', '老夫年迈多病，二子不才，不堪重任。玄德乃帝室之胄，德广才高——'],
      ['taoqian', '徐州牧的印绶，便请玄德收下吧。'],
      ['liubei', '使君此言差矣！刘备为救徐州而来，若取徐州，天下人岂不以为刘备是无义之人？'],
      ['zhangfei', '大哥！又不是咱们去抢的，人家情愿相让，何必推辞！'],
      ['liubei', '三弟，不得胡言！'],
    ]);
    await G.narrate('陶谦再三相让，刘备只是不受。陶谦只得请刘备暂屯小沛，以保徐州。');
    await G.narrate('不久，陶谦病势沉重，请刘备入府商议军务。');
    await G.lines([
      ['taoqian', '玄德……老夫命在旦夕……'],
      ['taoqian', '此番请你来，不为别事，只为徐州……若玄德不受，老夫死不瞑目……'],
      ['guanyu', '大哥，陶公一片诚心，徐州百姓也盼着大哥。若再推辞，反负了这满城的人。'],
      ['zhaoyun', '乱世之中，仁者守土，百姓之福。玄德公，请受之。'],
      ['liubei', '……陶公。刘备……受命。'],
    ]);
    await G.narrate('陶谦以手指心而死，时年六十三岁。');
    await G.chapterEnd(G.CHAPTERS[4].endLines);
  }

  /* ---------------- 曹营 ---------------- */
  B.c4caoying = () => {
    const m = new G.GameMap('c4caoying', '郯城 · 曹营', 36, 32, TL.SOIL);
    Object.assign(m, { seed: 471, under: TL.SOIL, music: 'camp', ambient: 'embers', battleBg: 'camp', dusk: true, pal: { sh: 30, ss: 18, sl: 22, gh: 92, gs: 30, gl: 22 } });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (G.fbm(x / 4, y / 4, 473) > 0.68) m.set(x, y, TL.GRASS);
    m.warp(16, 31, 4, 1, 'c4world', 51, 25, 'down');
    m.reserve(16, 29, 4, 2);
    K.stakeRing(m, 1, 1, 34, 30, [[16, 30, 4, 1]]);
    for (let x = 0; x < 36; x++) { m.tree(x, 0, 'pine'); if (x < 15 || x > 20) m.tree(x, 31, 'dark'); }
    for (let y = 1; y < 31; y++) { m.tree(0, y, 'pine'); m.tree(35, y, 'dark'); }
    m.road([[17.5, 31], [17.5, 27], [12, 23], [12, 17], [18, 14], [18, 9]], 0.8, TL.PATH);
    K.tent(m, 14, 2, { big: true, w: 7, h: 5, sign: '曹' });
    for (const [x, y] of [[4, 3], [9, 4], [25, 3], [29, 6], [4, 14], [7, 19], [24, 14], [29, 18], [4, 25], [23, 24], [28, 25], [8, 26]]) K.tent(m, x, y, {});
    for (const [x, y] of [[13, 9], [23, 9], [15, 20], [21, 22], [6, 23], [27, 28], [30, 13], [6, 10]]) K.deco(m, 'fire', x, y, { light: 150 });
    for (const [x, y] of [[13, 3], [22, 3], [16, 13], [20, 13], [15, 28], [20, 28], [9, 13], [27, 13]]) K.deco(m, 'flag', x, y, { text: '曹', color: '#2f4a7a', tcol: '#f6e7c1' });
    K.deco(m, 'rack', 28, 15); K.deco(m, 'crates', 7, 10); K.deco(m, 'rack', 5, 17);
    m.prop('cart', 22, 18, 2, 1, { foot: [22, 18, 2, 1] });
    m.event({ type: 'inspect', x: 22, y: 18, w: 2, h: 1, run: async () => {
      if (G.flag('c4_cart')) { await G.narrate('粮车已经空了。'); return; }
      G.setFlag('c4_cart'); G.restoreAll(); G.audio.sfx('heal');
      await G.notice('劫得曹军粮草！全军兵力与策略恢复了。');
    } });
    K.guard(m, { id: 'q1a', spec: 'caobing', x: 16, y: 28, dir: 'right', flag: 'c4_q1', group: ['caobing', 'caobing', 'caoshe'], lines: [['caobing', '有人劫营！', { name: '曹军' }]] });
    K.guard(m, { id: 'q1b', spec: 'caobing', x: 19, y: 28, dir: 'left', flag: 'c4_q1', group: ['caobing', 'caobing', 'caoshe'] });
    K.guard(m, { id: 'q2', spec: 'caoqi', x: 12, y: 20, flag: 'c4_q2', group: ['caoqi', 'caobing', 'caoshe'], lines: [['caoqi', '虎豹骑在此，休想再进一步！', { name: '虎豹骑' }]] });
    K.guard(m, { id: 'q3', spec: 'caoshe', x: 17, y: 14, flag: 'c4_q3', group: ['caoshe', 'caoqi', 'caobing'] });
    m.npc({ id: 'xhd', spec: 'xiahoudun', x: 18, y: 8, dir: 'down', aggro: true, cond: () => !G.flag('c4_cao'), talk: async () => {
      await G.lines([
        ['xiahoudun', '大耳贼！我主为父报仇，与你何干？竟敢来捋虎须！'],
        ['liubei', '曹公报父仇，理所应当。可徐州百姓何罪之有？屠戮无辜，岂是仁义之师！'],
        ['xiahoudun', '少废话！夏侯惇在此，有本事就来取我项上人头！'],
        ['zhaoyun', '常山赵子龙，前来领教！'],
      ]);
      const r = await G.battle(['xiahoudun', 'caoqi', 'caoshe'], { bg: 'camp', boss: true, intro: '曹军先锋 夏侯惇 杀到！' });
      if (r !== 'win') return;
      G.setFlag('c4_cao');
      await G.lines([
        ['messenger', '报——！吕布趁曹公东征，袭取了兖州、濮阳！曹公急令各军回援！'],
        ['xiahoudun', '……刘备，今日算你走运！全军撤退！'],
      ]);
      await G.narrate('曹军连夜拔营西去，徐州之围遂解。');
      await say('liubei', '徐州得保了。回城向陶使君复命吧。');
    } });
    m.encounters = { rates: { [TL.SOIL]: 0.03, [TL.GRASS]: 0.03, [TL.PATH]: 0.012 }, groups: [{ e: ['caobing', 'caobing'], w: 2 }, { e: ['caobing', 'caoshe'], w: 2 }, { e: ['caoqi', 'caobing'], w: 1 }] };
    return m;
  };

  G.CHAPTERS[4] = {
    title: '徐州',
    prologue: [
      '董卓迁都长安后，为王允、吕布所诛。天下愈发纷乱。',
      '刘备投公孙瓒麾下，于界桥之战中，结识了常山赵云。',
      '时值隆冬，北平大雪纷飞。',
      '一日，北海太守孔融遣太史慈单骑突围求救——',
      '黄巾余党管亥，已将北海城围得水泄不通……',
    ],
    start: async () => {
      const w = G.world;
      w.load('c4camp', 14, 11, 'up');
      w.place(1, 13, 12, 'up'); w.place(2, 15, 12, 'up'); w.place(3, 14, 13, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['taishici', '在下东莱太史慈，奉孔北海之命，突围前来求救！'],
        ['taishici', '黄巾余党管亥引数万之众围困北海，城中粮尽，危在旦夕！'],
        ['gongsunzan', '北海与我隔着青州，鞭长莫及……玄德，你可愿走一趟？'],
        ['liubei', '孔北海乃当世名士，岂能坐视不救！刘备愿往。'],
        ['gongsunzan', '好！只是你兵马太少。子龙——'],
      ]);
      const zy = w.npcById('zhaoyun_c4');
      await G.lines([
        ['zhaoyun', '末将在！'],
        ['gongsunzan', '我将白马义从拨你二千，随玄德同去北海。'],
        ['zhaoyun', '……玄德公！界桥一别，子龙日夜思念。今日能随公出征，平生之愿也！'],
        ['liubei', '子龙！得你相助，如虎添翼！'],
      ]);
      G.joinParty('zhaoyun'); G.world.refreshParty(); G.setFlag('c4_zhao');
      if (zy) zy.cond = () => false;
      G.audio.sfx('levelup');
      await G.notice('赵云 加入了队伍！\n「突阵」可连刺三枪；修为精深后更能「七进七出」。');
      await G.lines([['zhangfei', '哈哈，又多一个好汉！子龙，等打完了仗，咱俩比比枪法！'], ['zhaoyun', '翼德兄，一言为定！']]);
    },
    endLines: [
      '陶谦三让徐州，刘备方才受领。',
      '陶谦病逝后，刘备领徐州牧，糜竺、孙乾、陈登等皆倾心归附。',
      '从织席贩履的布衣，到坐拥一州的诸侯——',
      '刘备终于有了自己的立足之地。',
      '然而乱世之中，一州之地，又岂是那么容易守住的……',
    ],
  };
  // 开场时站在帐前的赵云
  const prevC4 = B.c4camp;
  B.c4camp = () => {
    const m = prevC4();
    m.npc({ id: 'zhaoyun_c4', spec: 'zhaoyun', x: 16, y: 9, dir: 'left', cond: () => !G.flag('c4_zhao') });
    return m;
  };
})();
