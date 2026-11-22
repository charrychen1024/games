/* ============================================================
 * 烽烟录 · 第十五章　凤雏
 * 荆州（耒阳·张飞访庞统 → 张松献图）→ 涪城会 → 截江夺阿斗（赵云单人）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const JZ = { gh: 96, gs: 32, gl: 28 };
  const SHU = { gh: 108, gs: 30, gl: 24 };
  const SHOP = ['dahuan', 'shenghui', 'xuelian', 'tianzhong', 'yulu', 'xuming', 'quanjun', 'dayan', 'jinsuo'];
  const ALL = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'huangzhong', 'pangtong'];
  const WEST = ['liubei', 'pangtong', 'huangzhong', 'weiyan'];
  const setParty = list => {
    const s = G.state;
    G.unstash(list);
    const others = s.party.filter(id => !list.includes(id));
    s.stash = (s.stash || []).concat(others.filter(id => !(s.stash || []).includes(id)));
    s.party = list.filter(id => s.party.includes(id));
    s.sp = Math.min(s.sp, G.maxSP());
    G.world.refreshParty();
  };
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  /* ---------------- 荆州大地 ---------------- */
  B.c15world = () => {
    const m = new G.GameMap('c15world', '荆 州', 58, 42, TL.GRASS);
    Object.assign(m, { seed: 1501, music: 'field', ambient: 'clouds', pal: JZ, battleBg: 'field', flowers: 0.06 });
    K.tallGrass(m, 1503, 0.57);
    m.road([[58, 22], [44, 24], [30, 22], [18, 25], [0, 23]], 1.4, TL.WATER);        // 长江
    m.road([[26.5, 16], [26.5, 36]], 0.75, TL.PATH);                                // 荆州 → 南
    m.road([[26.5, 30], [42, 32], [44.5, 34]], 0.75, TL.PATH);                       // → 耒阳
    m.road([[26.5, 16], [40, 12], [50, 8], [56, 6]], 0.75, TL.PATH);                // → 东北边境
    m.road([[26.5, 18], [12, 17], [2, 16], [0, 16]], 0.75, TL.PATH);                // → 西（入川）
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.WATER && Math.hypot(x - 26.5, y - 23) < 3) m.set(x, y, TL.BRIDGE);
    m.prop('townicon', 24, 11, 5, 4, { label: '江陵', foot: [24, 11, 5, 4] });
    m.prop('townicon', 43, 35, 4, 3, { label: '耒阳', foot: [43, 35, 4, 3] });
    m.reserve(24, 34, 6, 6); m.reserve(44, 34, 2, 1); m.reserve(0, 15, 2, 3); m.reserve(54, 5, 3, 3);
    K.tent(m, 21, 34, { big: true, w: 5, h: 4, red: true, sign: '刘' });
    K.tent(m, 30, 35, { red: true });
    K.deco(m, 'flag', 25, 38, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' }); K.deco(m, 'flag', 28, 38, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.npc({ id: 'camp15', spec: 'innkeeper', x: 28, y: 36, dir: 'left', talk: campMenu });
    m.npc({ id: 'km15', spec: 'zhugeliang', x: 25, y: 35, dir: 'down', cond: () => !G.flag('c15_west'), marker: () => G.flag('c15_pt') && !G.flag('c15_ptback'), talk: kongmingTalk });
    m.npc({ id: 'gy15', spec: 'guanyu', x: 25, y: 16, dir: 'down', cond: () => G.flag('c15_ptback'), talk: K.talk([['guanyu', '大哥只管西去，荆州有关某在，万无一失！']]) });
    m.warp(44, 34, 2, 1, 'c15leiyang', 16, 25, 'up', () => true);
    m.warp(0, 15, 1, 3, 'c15fucheng', 17, 28, 'up', () => G.flag('c15_west'), '军师：主公，西川之事尚未议定，不可轻动。');
    m.event({ type: 'step', x: 54, y: 5, w: 3, h: 3, run: songScene });
    m.npc({ id: 'zs15', spec: 'zhangsong', x: 55, y: 6, dir: 'left', cond: () => G.flag('c15_ptback') && !G.flag('c15_song'), marker: () => true, talk: songScene });
    for (const [x, y] of [[4, 30], [10, 36], [16, 4], [36, 4], [46, 16], [52, 28], [8, 8], [38, 38], [50, 38]]) K.mountain(m, x, y);
    K.deco(m, 'sign', 25, 28, { text: '荆州' });
    m.event({ type: 'inspect', x: 25, y: 28, w: 1, h: 1, run: () => G.narrate('路牌：北 · 江陵　东南 · 耒阳　东北 · 郢州边境　西 · 入川') });
    K.forest(m, { seed: 1511, thr: 0.63, kinds: ['tree', 'bamboo', 'tree', 'dark'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: [{ e: ['shanzei3', 'shanzei3'], w: 3 }, { e: ['shanzei3', 'shanzei3', 'shanzei3'], w: 2 }, { e: ['caobing6', 'caoqi6'], w: 1 }] };
    return m;
  };

  async function campMenu() {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) { await restAndSave('innkeeper', '营中都收拾好了，歇一歇吧。', '军需官'); }
    else if (k === 1) await G.shop(SHOP, '荆州军需');
  }

  async function kongmingTalk() {
    if (G.flag('c15_ptback')) { await say('zhugeliang', G.flag('c15_song') ? '西川之事，主公与士元同去，亮与云长守荆州。' : '东北郢州边境，据报有西川使者张松经过——主公可遣人迎之。'); return; }
    if (!G.flag('c15_pt')) { await say('zhugeliang', '翼德已往耒阳去了。主公且待佳音。'); return; }
  }

  /* ---------------- 耒阳县 ---------------- */
  B.c15leiyang = () => {
    const m = new G.GameMap('c15leiyang', '耒 阳', 32, 28, TL.GRASS);
    Object.assign(m, { seed: 1521, music: 'town', pal: JZ, ambient: 'leaves', flowers: 0.05, battleBg: 'field' });
    K.walls(m, 0, 0, 31, 21, [{ side: 's', x: 15, plaque: '耒阳' }]);
    m.road([[16.5, 28], [16.5, 8]], 1, TL.PATH);
    m.road([[3, 14.5], [29, 14.5]], 0.6, TL.PATH);
    m.prop('hall', 11, 2, 11, 6, { sign: '县衙', roof: '#4a3a2a' });
    m.prop('house', 3, 4, 6, 5, { roof: '#45403a', sign: '酒肆' });
    m.prop('house', 24, 4, 6, 5, { roof: '#4a3b36', lantern: false });
    m.prop('house', 3, 16, 6, 4, { roof: '#45403a', lantern: false });
    m.rect(13, 8, 7, 4, TL.FLOOR);
    K.deco(m, 'jar', 9, 9); K.deco(m, 'jar', 10, 10); K.deco(m, 'crates', 24, 16);
    m.warp(15, 27, 3, 1, 'c15world', 44, 33, 'up', () => G.flag('c15_pt'), '张飞：俺还没见着那个醉县令呢！');
    m.reserve(15, 22, 3, 6); m.reserve(16, 23, 1, 1);
    K.innerTrees(m, 1, 2, 30, 19, 1527, 0.45);
    K.forest(m, { seed: 1525, thr: 0.75, kinds: ['tree', 'bamboo'] });
    K.guard(m, { id: 'lyz', spec: 'shanzei', x: 16, y: 23, dir: 'down', flag: 'c15_bandit', group: ['shanzei3', 'shanzei3'], intro: '山贼趁县中无人理事，聚众劫掠！', bg: 'field',
      lines: [['shanzei', '这耒阳县令整日吃酒，谁也管不着咱们——嘿嘿，这黑大汉的马不错！']], party: ['zhangfei'] });
    m.npc({ id: 'ly1', spec: 'farmer', x: 20, y: 17, wander: 2, talk: K.talk([['farmer', '新来的县令到任一百多天，一件公事也不理，天天在衙里喝酒！']]) });
    m.npc({ id: 'ly2', spec: 'woman', x: 8, y: 13, wander: 2, talk: K.talk([['woman', '我家的官司，告了三个月，还没升堂……']]) });
    m.npc({ id: 'ly3', spec: 'servant', x: 13, y: 9, dir: 'down', cond: () => !G.flag('c15_pt'), talk: K.talk([['servant', '县令昨夜又醉了，至今未起……', { name: '县吏' }]]) });
    m.npc({ id: 'pt15', spec: 'pangtong', x: 16, y: 9, dir: 'down', cond: () => !G.flag('c15_pt'), marker: () => true, talk: pangtongScene });
    m.onEnter = async () => {
      if (G.flag('c15_ly')) return; G.setFlag('c15_ly');
      setParty(['zhangfei']);
      await G.lines([
        ['zhangfei', '哥哥说，耒阳来了个新县令，叫什么庞统，到任了只顾吃酒，叫俺来看看。'],
        ['zhangfei', '要是真个糊涂，俺老张一矛——咳，哥哥说了，要以礼相待。'],
      ]);
      await G.notice('张飞单独巡视耒阳。\n去县衙找县令庞统。');
    };
    return m;
  };

  async function pangtongScene() {
    if (!G.flag('c15_bandit')) { await say('servant', '城门外有一伙山贼闹事，将军先去看看吧！', { name: '县吏' }); return; }
    await G.narrate('县官衣冠不整，扶醉而出。');
    await G.lines([
      ['zhangfei', '吾兄以汝为人，令作县宰，汝焉敢尽废县事！'],
      ['pangtong', '（打了个酒嗝）将军以吾废了县中何事？'],
      ['zhangfei', '汝到任百余日，终日在醉乡，安得不废政事？'],
      ['pangtong', '量百里小县，些小公事，何难决断！将军少坐，待我发落。'],
    ]);
    await G.narrate('庞统唤公吏，将百余日所积公务，都取来剖断。吏皆纷然赍抱案卷上厅，诉词被告人等，环跪阶下。');
    G.audio.sfx('buff');
    await G.narrate('庞统手中批判，口中发落，耳内听词，曲直分明，并无分毫差错。民皆叩首拜伏。不到半日，将百日之事，尽断毕了。');
    await G.lines([
      ['pangtong', '（投笔于地）所废之事何在？曹操、孙权，吾视之若掌上观文——量此小县，何足介意！'],
      ['zhangfei', '（大惊，下席谢曰）先生大才，小子失敬！吾当于兄长处极力举荐。'],
      ['pangtong', '（这才取出一封书信）这是鲁子敬的荐书。'],
      ['zhangfei', '先生初见吾兄，何不将出？'],
      ['pangtong', '若便将出，似乎专藉荐书来干谒矣。'],
    ]);
    G.setFlag('c15_pt');
    G.joinParty('pangtong'); G.world.refreshParty(); G.restoreAll();
    G.audio.sfx('levelup');
    await G.notice('庞统 加入！\n回营地向刘备复命。');
  }

  async function ptBack() {
    if (G.flag('c15_ptback') || !G.flag('c15_pt')) return;
    G.setFlag('c15_ptback');
    G.unstash(ALL);
    await G.lines([
      ['zhangfei', '哥哥！俺在耒阳，亲眼看见庞先生半日断了百日的公事！'],
      ['zhugeliang', '（自外归来，大笑）庞士元非百里之才也！主公何故使大贤屈于小县？亮已有书荐之。'],
      ['liubei', '昔司马德操言："伏龙、凤雏，两人得一，可安天下。"今吾二人皆得，汉室可兴矣！'],
    ]);
    // 庞统入队后七人：关羽镇守江陵
    setParty(['liubei', 'zhangfei', 'zhaoyun', 'zhugeliang', 'pangtong', 'huangzhong']);
    await G.lines([['guanyu', '大哥，荆州要地，关某先回江陵镇守。']]);
    await G.notice('刘备拜庞统为副军师中郎将。\n关羽回江陵镇守。\n听说西川使者张松正从许都回来，路过东北的郢州边境。');
  }

  async function songScene() {
    if (!G.flag('c15_ptback')) { await G.narrate('通往郢州的边境哨卡。'); return; }
    if (G.flag('c15_song')) return;
    await G.narrate('边境之上，一个身材矮小、额钁头尖的文士，正被一队曹军追赶——');
    await G.lines([
      ['zhangsong', '曹阿瞒！你恃强轻士，乱棒打我出府……如今还要赶尽杀绝么！'],
      ['zhaoyun', '前面可是西川张别驾？赵云奉主公之命，在此等候多时！'],
    ]);
    const r = await G.battle(['caoqi6', 'caobing6', 'caoqi6'], { bg: 'field', intro: '曹军追骑！' });
    if (r !== 'win') return;
    G.setFlag('c15_song');
    await G.narrate('刘备亲迎张松，连留三日宴饮，只谈风月，并不提起西川之事。张松临行，刘备直送十里长亭，泪眼相别。');
    await G.lines([
      ['zhangsong', '……松亦愿朝暮趋侍，恨未有便耳。荆州东有孙权，北有曹操，非可久恋之地。益州险塞，沃野千里，民殷国富——明公若起荆襄之众，长驱西指，霸业可成，汉室可兴！'],
      ['liubei', '备安敢当此？刘益州亦帝室宗亲，恩泽布蜀中久矣。他人岂可得而动摇乎？'],
      ['zhangsong', '（自袖中取出一图）此西川地理图也。山川险要，府库钱粮，一一俱载明白。松有心腹契友二人：法正、孟达——明公日后，可与之共谋。'],
    ]);
    await G.narrate('不久，法正果然奉刘璋之命而来，请刘备入川，共拒汉中张鲁。');
    await G.lines([
      ['pangtong', '荆州荒残，人物殚尽；东有孙权，北有曹操，难以得志。益州户口百万，土广财富——此天赐也，主公何疑焉？'],
      ['liubei', '今与吾水火相敌者，曹操也。操以急，吾以宽；操以暴，吾以仁；操以谲，吾以忠。今以小利而失信义于天下，吾不忍也。'],
      ['pangtong', '离乱之时，用兵争强，固非一道。兼弱攻昧，逆取顺守，汤、武之道也。事定之后，报之以义，封为大国，何负于信？今日不取，终被他人取耳。'],
      ['liubei', '……金石之言，当铭肺腑。'],
    ]);
    // 入川队伍：刘备、庞统、黄忠、魏延
    G.setFlag('c15_west');
    setParty(['liubei', 'pangtong', 'huangzhong']);
    G.joinParty('weiyan'); G.world.refreshParty(); G.restoreAll();
    G.audio.sfx('levelup');
    await G.lines([
      ['weiyan', '魏延愿为先锋，随主公入川！'],
      ['zhugeliang', '亮与云长、翼德、子龙守荆州。主公此去，凡事多听士元。'],
    ]);
    await G.notice('魏延 加入！\n刘备率庞统、黄忠、魏延入川。\n从营地西边的大路出发。');
  }

  /* ---------------- 涪城 ---------------- */
  B.c15fucheng = () => {
    const m = new G.GameMap('c15fucheng', '涪 城', 36, 32, TL.GRASS);
    Object.assign(m, { seed: 1541, music: 'camp', pal: SHU, ambient: 'leaves', leafColor: 'rgba(120,160,90,0.8)', flowers: 0.04, battleBg: 'shu' });
    K.walls(m, 0, 0, 35, 22, [{ side: 's', x: 16, plaque: '涪城' }]);
    m.road([[17.5, 32], [17.5, 8]], 1, TL.PATH);
    m.road([[3, 14.5], [32, 14.5]], 0.6, TL.PATH);
    m.rect(11, 8, 13, 5, TL.FLOOR);
    m.prop('hall', 12, 2, 11, 6, { sign: '涪城宴', roof: '#3a4a3a' });
    m.prop('house', 3, 4, 6, 5, { sign: '客栈', roof: '#45403a' });
    m.prop('house', 27, 4, 6, 5, { sign: '蜀锦', roof: '#3a4a3a' });
    m.prop('house', 3, 16, 6, 4, { roof: '#45403a', lantern: false });
    for (const [x, y] of [[11, 7], [24, 7]]) K.deco(m, 'flag', x, y, { text: '刘', color: '#3a5a3a', tcol: '#f6e7c1' });
    // 城外：刘备营
    K.tent(m, 6, 25, { red: true }); K.tent(m, 26, 25, { red: true });
    K.deco(m, 'flag', 13, 27, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.warp(16, 31, 3, 1, 'c15fucheng', 17, 29, 'up', () => false, '庞统：主公，到了涪城，且先去见刘季玉。');
    m.reserve(16, 23, 3, 9);
    K.innerTrees(m, 1, 2, 34, 20, 1547, 0.45);
    K.forest(m, { seed: 1545, thr: 0.7, kinds: ['bamboo', 'pine', 'tree'] });
    m.npc({ id: 'inn15', spec: 'innkeeper', x: 6, y: 10, dir: 'down', talk: K.innTalk('innkeeper', 180) });
    m.npc({ id: 'shop15', spec: 'merchant', x: 30, y: 10, dir: 'down', talk: K.shopTalk('merchant', SHOP.concat(['shujin']), '蜀锦庄', '蜀锦天下第一！这「蜀锦甲」，用的是成都最好的锦。') });
    m.npc({ id: 'lz15', spec: 'liuzhang', x: 17, y: 9, dir: 'down', cond: () => !G.flag('c15_feast'), marker: () => true, talk: feastScene });
    m.npc({ id: 'zr15', spec: 'zhangren', x: 20, y: 10, dir: 'left', cond: () => !G.flag('c15_feast'), talk: K.talk([['zhangren', '（按剑侍立，冷冷注视魏延）']]) });
    m.npc({ id: 'fz15', spec: 'fazheng', x: 14, y: 10, dir: 'right', talk: K.talk([['fazheng', '张别驾与正，日夜盼望皇叔入川。']]) });
    m.npc({ id: 'fc1', spec: 'farmer', x: 9, y: 18, wander: 2, talk: K.talk([['farmer', '咱们主公刘季玉，人是好人，就是太软了些。']]) });
    m.npc({ id: 'fc2', spec: 'oldman', x: 25, y: 17, wander: 2, talk: K.talk([['oldman', '从涪城到成都，不过三百六十里。可这蜀道啊……难于上青天。']]) });
    return m;
  };

  async function feastScene() {
    await G.lines([
      ['liuzhang', '（执刘备之手，泪下）兄长远来，季玉不胜之喜！'],
      ['liubei', '贤弟。'],
    ]);
    await G.narrate('两刘相见，各叙兄弟之情。酒至半酣，庞统入内，悄悄对刘备说——');
    await G.lines([
      ['pangtong', '（低声）今日可就席上杀刘璋，主公便可坐取西川。魏延已在堂下。'],
      ['liubei', '季玉是吾同宗，诚心待吾；更兼吾初到蜀中，恩信未立，若行此事，上天不容，下民亦怨。此事断不可行。'],
    ]);
    await G.narrate('庞统退出，对魏延使了个眼色。魏延登堂，拔剑在手——');
    await G.lines([
      ['weiyan', '筵间无以为乐，愿舞剑为戏！'],
      ['zhangren', '（掣剑而起）舞剑必须有对，某愿与魏将军同舞！'],
    ]);
    G.audio.sfx('slash'); G.shake(3, 0.3);
    await G.narrate('二人对舞于筵前。魏延目视刘封，封亦拔剑助舞；刘璝、冷苞、邓贤各掣剑出——');
    await G.lines([['liubei', '（大惊，掣左右所佩之剑，立于席上）吾兄弟相逢痛饮，并无疑忌。又非鸿门会上，何用舞剑？不弃剑者立斩！']]);
    await G.lines([['liuzhang', '兄弟相聚，何必带刀？都退下！']]);
    G.setFlag('c15_feast');
    await G.narrate('刘璋请刘备北屯葭萌关，以拒张鲁。刘备遂在葭萌广施恩惠，以收民心——');
    await G.fadeOut(1.0);
    await G.narrate('就在此时，千里之外的荆州——');
    G.world.load('c15jiang', 3, 15, 'right');
    G.world.banner = null;
    await G.fadeIn(0.8);
    await jiangStart();
  }

  /* ---------------- 截江夺阿斗 ---------------- */
  B.c15jiang = () => {
    const m = new G.GameMap('c15jiang', '长 江', 50, 22, TL.GRASS);
    Object.assign(m, { seed: 1561, music: 'boss', pal: JZ, ambient: 'clouds', flowers: 0.03, battleBg: 'river' });
    K.tallGrass(m, 1563, 0.6);
    m.rect(0, 0, 50, 10, TL.WATER);
    m.road([[0, 10.3], [50, 10.6]], 0.8, TL.WATER);
    m.road([[0, 15.5], [30, 15], [40, 13], [44, 11.5]], 0.75, TL.PATH);
    m.rect(43, 8, 2, 4, TL.BRIDGE);                          // 渔船栈桥
    K.ship(m, 40, 3, 9, 5, { dir: 'right', text: '吴', sail: '#c8a080', tcol: '#5a1a14' });
    m.reserve(43, 7, 2, 6);
    for (const [x, y] of [[8, 18], [20, 19], [34, 18]]) K.mountain(m, x, y);
    K.forest(m, { seed: 1571, thr: 0.68, kinds: ['tree', 'bamboo'] });
    m.warp(0, 14, 1, 3, 'c15jiang', 2, 15, 'right', () => false, '赵云：船就要走远了——追！');
    m.npc({ id: 'yf15', spec: 'farmer', x: 42, y: 13, dir: 'up', cond: () => !G.flag('c15_end'), talk: K.talk([['farmer', '将军！那大船刚刚离岸——我这小渔船借给将军！', { name: '渔夫' }]]) });
    m.npc({ id: 'ssx15', spec: 'sunshangxiang', x: 44, y: 4, dir: 'down', cond: () => !G.flag('c15_end'), marker: () => true, talk: jiangScene });
    m.npc({ id: 'ad15', spec: 'adou', x: 45, y: 4, dir: 'down', cond: () => !G.flag('c15_end'), talk: jiangScene });
    m.npc({ id: 'zsh15', spec: 'zhoushan', x: 43, y: 5, dir: 'down', cond: () => !G.flag('c15_end'), talk: jiangScene });
    return m;
  };

  async function jiangStart() {
    setParty(['zhaoyun']);
    await G.lines([
      ['zhaoyun', '（巡哨归来，惊闻）什么？主母带着小主人上船去了？'],
      ['zhaoyun', '东吴派周善来接主母回去，说是国太病危……主母竟要把阿斗也带走！小主人若被带去江东，便成了东吴手中的人质！'],
    ]);
    await G.notice('第十五章最后一段：赵云单独出战。\n沿江岸追上东吴的大船！');
  }

  async function jiangScene() {
    if (G.flag('c15_end')) return;
    await G.narrate('赵云借一只渔船，飞桨追上大船，提青釭剑纵身一跃，跳上船头——');
    await G.lines([
      ['zhoushan', '（横刀）何人敢上船！'],
      ['zhaoyun', '主母欲往何处去？何故不令军师知会？'],
      ['sunshangxiang', '我母亲病在危笃，无暇报知。'],
      ['zhaoyun', '主母探病，何故带小主人去？'],
      ['sunshangxiang', '阿斗是吾子，留在荆州，无人看觑。'],
      ['zhaoyun', '主母差矣。主人一生，只有这点骨血。小将在当阳长坂坡百万军中救出——今日夫人却欲抱将去，是何道理？'],
      ['sunshangxiang', '你只是帐下一武夫，安敢管我家事！'],
      ['zhaoyun', '夫人要去便去，只留下小主人！'],
    ]);
    const r = await G.battle(['zhoushan'], { bg: 'river', boss: true, party: ['zhaoyun'], intro: '东吴 周善 横刀拦住！' });
    if (r !== 'win') return;
    await G.narrate('赵云打翻周善，一手抱定阿斗，一手仗剑立于船头。正危急间，下流港内一字儿使出十余只船来，船上磨旗擂鼓——');
    await G.lines([
      ['zhangfei', '嫂嫂留下侄儿去！'],
      ['zhangfei', '（跳上船，一剑砍了周善）……哥哥不在，俺张飞替他问一句：嫂嫂这一走，可还回来？'],
      ['sunshangxiang', '……（垂泪）叔叔何故无礼？'],
      ['zhangfei', '嫂嫂不以俺哥哥为念，私自回家，这便是无礼！'],
      ['sunshangxiang', '吾母病重，甚是危急，若等你哥哥回报，须误了我事。若你不放我回去，我情愿投江而死！'],
      ['zhaoyun', '翼德……放主母去吧。只要小主人回来便好。'],
      ['sunshangxiang', '……告诉玄德：我……我会想着他的。'],
    ]);
    G.setFlag('c15_end');
    G.leaveParty('sunshangxiang');
    await G.narrate('张飞、赵云抱着阿斗，回船而去。孙夫人的船，渐渐消失在江东的烟波里。');
    await G.notice('孙夫人 回到了东吴。\n（她的护甲留在了行囊里）');
    await G.chapterEnd(G.CHAPTERS[15].endLines);
  }

  G.CHAPTERS[15] = {
    title: '凤雏',
    prologue: [
      '拉住孔明的，正是"凤雏"庞统。',
      '二人相视大笑，孔明留下一封荐书。',
      '庞统投奔刘备，却不肯拿出荐书。',
      '刘备见他浓眉掀鼻、黑面短髯，形容古怪，心中不悦，',
      '只让他去做了一个小小的耒阳县令。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      const s = G.state;
      G.unstash(['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'huangzhong']);
      s.stash = (s.stash || []).concat(s.party.filter(id => id === 'sunshangxiang'));
      s.party = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'huangzhong'].filter(id => s.party.includes(id));
      G.restoreAll();
      const w = G.world;
      w.load('c15world', 26, 33, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['liubei', '那个庞统，相貌实在……唉，听说他到耒阳以后，终日饮酒，不理政事。'],
        ['zhangfei', '哥哥，让俺去耒阳瞧瞧！要是那厮真个糊涂，俺替哥哥教训他！'],
        ['liubei', '三弟此去，切不可鲁莽。'],
      ]);
      await G.notice('东南方向前往耒阳。\n孙夫人留在了荆州城中。');
    },
    endLines: [
      '孙夫人一去不返，刘备与东吴，从此貌合神离。',
      '在葭萌关，刘备厚树恩德，以收民心。',
      '一年之后，曹操南征孙权，孙权向刘备求救。',
      '刘备向刘璋借兵马钱粮，刘璋只给了老弱四千、米一万斛。',
      '张松暗中通信之事，也终于败露……',
      '庞统献上三条计策，刘备选了中计：先取涪关。',
    ],
  };

  // 从耒阳回到荆州大地时，触发庞统入幕
  const baseW = B.c15world;
  B.c15world = () => { const m = baseW(); m.onEnter = async () => { if (G.flag('c15_pt') && !G.flag('c15_ptback')) await ptBack(); }; return m; };
})();
