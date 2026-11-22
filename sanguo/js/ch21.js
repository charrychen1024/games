/* ============================================================
 * 烽烟录 · 第二十一章　水淹七军
 * 樊城郊外（庞德抬榇、关公中箭、观罾口川）→ 汉水泛滥（擒于禁、周仓擒庞德、曹仁、刮骨疗毒）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const XF = { gh: 94, gs: 30, gl: 28 };
  const SHOP = ['xuelian', 'tianxiang', 'yulu', 'xianlu', 'xuming', 'dayan', 'qingzhou', 'shujin', 'longwen'];
  const JZ = ['guanyu', 'guanping', 'zhoucang'];
  const GROUPS = [{ e: ['caobing8', 'caobing8'], w: 3 }, { e: ['caobing8', 'caoshe8'], w: 3 }, { e: ['caoshe8', 'caoshe8'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };
  const campMenu = (line, title) => async () => {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) await restAndSave('innkeeper', line, '军需官'); else if (k === 1) await G.shop(SHOP, title);
  };

  /* ---------------- 樊城郊外 ---------------- */
  B.c21fancheng = () => {
    const m = new G.GameMap('c21fancheng', '樊 城', 46, 36, TL.GRASS);
    Object.assign(m, { seed: 2101, music: 'camp', ambient: 'clouds', pal: XF, battleBg: 'field', flowers: 0.04 });
    K.tallGrass(m, 2103, 0.58);
    K.walls(m, 12, 0, 33, 7, [{ side: 's', x: 21, plaque: '樊城' }]);
    m.road([[22.5, 36], [22.5, 8]], 0.85, TL.PATH);
    m.road([[22.5, 20], [8, 18], [4, 14]], 0.7, TL.PATH);                                 // 西 · 罾口川
    m.road([[22.5, 22], [36, 18], [38.5, 12]], 0.7, TL.PATH);                             // 东 · 高阜
    m.road([[0, 9], [6, 10], [10, 6], [12, 0]], 1.2, TL.WATER);                           // 襄江一角
    m.rect(1, 12, 8, 6, TL.SOIL);                                                       // 罾口川谷地
    K.tent(m, 2, 12, { w: 3, h: 3 }); K.tent(m, 6, 15, { w: 3, h: 3 });
    K.deco(m, 'flag', 1, 17, { text: '于', color: '#24304a', tcol: '#f6e7c1' });
    m.rect(36, 9, 6, 4, TL.SOIL);                                                       // 高阜
    K.tent(m, 16, 29, { big: true, w: 5, h: 4, red: true, sign: '关' });
    K.tent(m, 26, 30, { red: true });
    for (const [x, y] of [[20, 27], [25, 27]]) K.deco(m, 'flag', x, y, { text: '关', color: '#2a5a3a', tcol: '#f6e7c1' });
    m.prop('coffin', 23, 13, 2, 1, { foot: [23, 13, 2, 1], cond: () => !G.flag('c21_pd1') });
    m.reserve(21, 25, 4, 11); m.reserve(36, 9, 6, 4); m.reserve(22, 12, 4, 3);
    for (const [x, y] of [[2, 22], [8, 28], [36, 26], [40, 32], [40, 2], [4, 30]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2105, thr: 0.66, kinds: ['tree', 'pine', 'bamboo'] });
    m.warp(21, 35, 4, 1, 'c21fancheng', 22, 33, 'up', () => false, '关平：父亲，樊城未下，岂可回师？');
    m.warp(21, 7, 3, 1, 'c21fancheng', 22, 10, 'down', () => false, '樊城城门紧闭，曹仁坚守不出。');
    m.npc({ id: 'fc21inn', spec: 'innkeeper', x: 25, y: 33, dir: 'left', talk: campMenu('君侯，营中歇一歇。', '荆州军营') });
    m.npc({ id: 'pd21', spec: 'pangde', x: 22, y: 14, dir: 'down', aggro: true, cond: () => !G.flag('c21_pd1'), marker: () => true, talk: pangdeScene });
    m.npc({ id: 'yj21', spec: 'yujin', x: 5, y: 14, dir: 'right', cond: () => !G.flag('c21_flood'), talk: K.talk([['yujin', '（于禁移七军于罾口川屯扎，四面皆是低洼之地）']]) });
    m.event({ type: 'inspect', x: 38, y: 9, w: 2, h: 2, run: lookScene });
    K.deco(m, 'sign', 39, 13, { text: '高阜' });
    m.encounters = { rates: { [TL.GRASS]: 0.025, [TL.TALL]: 0.07, [TL.PATH]: 0.008 }, groups: GROUPS };
    return m;
  };

  async function pangdeScene() {
    if (G.flag('c21_pd1')) return;
    await G.narrate('庞德令军士抬着一口棺木，来到阵前——');
    await G.lines([
      ['pangde', '吾受魏王厚恩，誓以死报！今去樊城与关某决战：我若不能杀关某，必为彼所杀；即不为彼所杀，我亦当自杀。故先备此榇，以示无空回之理！'],
      ['guanping', '父亲，此人……'],
      ['guanyu', '（大怒，美髯飘动）天下英雄，闻吾之名，无不畏服——庞德竖子，何敢藐视吾耶！'],
    ]);
    G.setParty(['guanyu']);
    const r = await G.battle(['pangde'], { bg: 'field', boss: true, party: ['guanyu'], intro: '庞德抬榇决战！' });
    G.setParty(JZ);
    if (r !== 'win') return;
    G.setFlag('c21_pd1');
    await G.lines([
      ['guanping', '（扶住父亲）父亲！'],
      ['guanyu', '（拔箭，血流不止）……此一箭，深入骨中。不妨事。'],
    ]);
    await G.narrate('于禁恐庞德成功，鸣金收军。又恐关公伤后来攻，遂移七军，转过山口，离樊城北十里，依山下寨。');
    await G.notice('关公箭伤稍愈。\n去东边的高阜，观望于禁的营寨。');
  }

  async function lookScene() {
    if (!G.flag('c21_pd1')) { await G.narrate('一片高阜，可以远望四周地形。'); return; }
    if (G.flag('c21_flood')) return;
    await G.narrate('关公上马，引数骑上高阜处望之。见樊城城上旗号不整，城北十里山谷之内，屯着军马；又见襄江水势甚急——');
    await G.lines([
      ['guanyu', '（唤向导官问）樊城北十里山谷，是何地名？'],
      ['guanping', '罾口川也。'],
      ['guanyu', '（大喜）于禁必为我擒矣。'],
      ['guanping', '父亲何以知之？'],
      ['guanyu', '"鱼"入"罾口"，岂能久乎？'],
    ]);
    await G.narrate('时值八月秋天，骤雨数日。关公令人预备船筏，收拾水具；又差人堰住各处水口——');
    await G.narrate('待水发时，乘高就船，放水一淹，樊城、罾口川之兵，皆为鱼鳖矣。');
    G.setFlag('c21_flood');
    await G.fadeOut(1.2);
    G.audio.sfx('down'); G.shake(10, 1.2);
    await G.narrate('是夜风雨大作。于禁在帐中，只听得万马争奔，征鼙震地——');
    await G.narrate('大水骤至，七军乱窜，随波逐浪者，不计其数。平地水深丈余。');
    G.world.load('c21flood', 18, 29, 'up');
    G.world.banner = null;
    await G.fadeIn(1.0);
    await G.notice('水淹七军！\n关羽习得「威震华夏」。\n乘船去擒于禁、庞德。');
  }

  /* ---------------- 汉水泛滥 ---------------- */
  B.c21flood = () => {
    const m = new G.GameMap('c21flood', '罾 口 川', 40, 34, TL.WATER);
    Object.assign(m, { seed: 2121, music: 'boss', ambient: 'rain', pal: { gh: 90, gs: 22, gl: 22 }, battleBg: 'flood', flowers: 0, tint: 'rgba(40,60,90,0.2)' });
    // 樊城（北）
    m.rect(4, 0, 32, 3, TL.WALL);
    m.prop('gate', 17, 1, 5, 2, { nofoot: true, plaque: '樊城', sortBias: 1 });
    m.rect(8, 3, 24, 5, TL.GRASS);
    // 于禁残部所据的土丘
    m.rect(12, 15, 13, 8, TL.GRASS);
    K.tent(m, 13, 15, { w: 3, h: 3 });
    K.deco(m, 'flag', 23, 16, { text: '于', color: '#24304a', tcol: '#f6e7c1' });
    // 关公战船
    K.ship(m, 13, 27, 11, 5, { dir: 'right', text: '关', sail: '#d8cbb0' });
    K.ship(m, 28, 24, 8, 4, { dir: 'left', text: '关', sail: '#d8cbb0', mh: 120 });
    // 庞德的小船
    K.ship(m, 1, 17, 6, 3, { dir: 'left', burnt: true, mh: 90 });
    // 木排相连
    m.rect(18, 23, 2, 4, TL.BRIDGE);
    m.rect(7, 18, 5, 1, TL.BRIDGE);
    m.rect(18, 8, 2, 7, TL.BRIDGE);
    m.rect(24, 27, 4, 1, TL.BRIDGE);
    for (const [x, y] of [[9, 4], [29, 4], [15, 21], [22, 21]]) m.tree(x, y, 'dark');
    m.npc({ id: 'fl21inn', spec: 'innkeeper', x: 30, y: 25, dir: 'down', talk: campMenu('君侯，船上备了热酒。', '荆州水军') });
    m.npc({ id: 'gp21', spec: 'guanping', x: 22, y: 29, dir: 'left', cond: () => !G.state.party.includes('guanping'), talk: K.talk([['guanping', '父亲小心！']]) });
    m.npc({ id: 'yj21b', spec: 'yujin', x: 18, y: 18, dir: 'down', aggro: true, cond: () => !G.flag('c21_yu'), marker: () => true, talk: yujinScene });
    m.npc({ id: 'pd21b', spec: 'pangde', x: 3, y: 18, dir: 'right', cond: () => G.flag('c21_yu') && !G.flag('c21_pd'), marker: () => true, talk: pangde2Scene });
    m.npc({ id: 'cr21', spec: 'caoren', x: 19, y: 4, dir: 'down', aggro: true, cond: () => G.flag('c21_pd') && !G.flag('c21_end'), marker: () => true, talk: caorenScene });
    return m;
  };

  async function yujinScene() {
    if (G.flag('c21_yu')) return;
    await G.lines([
      ['yujin', '（立于土丘之上，四面皆水）……关某来了！列阵！列阵！'],
      ['guanyu', '于文则，你是曹营宿将——今日四面皆水，还要拼个鱼死网破么？'],
    ]);
    const r = await G.battle(['yujin2', 'caobing8', 'caoshe8'], { bg: 'flood', boss: true, intro: '水中残军 · 于禁！' });
    if (r !== 'win') return;
    G.setFlag('c21_yu');
    await G.narrate('于禁见四下无路，左右只有五六十人，料不能逃，口称"愿降"。关公令尽去衣甲，拘收入船。');
    await G.lines([
      ['guanyu', '汝怎敢抗吾？'],
      ['yujin', '上命差遣，身不由己。望君侯怜悯，誓以死报。'],
      ['guanyu', '（绰髯笑曰）吾杀汝，犹杀狗彘耳，空污刀斧！——押送荆州大牢。'],
    ]);
    await G.notice('于禁投降！\n西边的小船上，庞德还在死战。');
  }

  async function pangde2Scene() {
    if (G.flag('c21_pd')) return;
    await G.narrate('庞德与五百余兵，皆无衣甲，立在堤上。庞德夺得一只小舟，欲投樊城——');
    await G.lines([
      ['zhoucang', '（从水中伏行而出，大叫）庞德休走！周仓在此！'],
      ['pangde', '黑厮！吾宁死于刀下，岂肯为水中鱼鳖！'],
    ]);
    G.setParty(['zhoucang']);
    const r = await G.battle(['pangde2'], { bg: 'flood', boss: true, party: ['zhoucang'], intro: '周仓水中擒庞德！' });
    G.setParty(JZ);
    if (r !== 'win') return;
    G.setFlag('c21_pd');
    await G.narrate('周仓撞翻小船，于水中生擒庞德。庞德立而不跪——');
    await G.lines([
      ['guanyu', '汝兄现在汉中，汝故主马超亦在蜀中为大将。汝如何不早降？'],
      ['pangde', '（大怒）吾宁死于刀下，岂降汝耶！魏王带甲百万，威震天下。汝刘备庸才耳，岂能敌哉！我宁为国家鬼，不为贼将也！'],
    ]);
    await G.narrate('庞德骂不绝口。关公大怒，喝令刀斧手推出斩之。庞德引颈受刑。关公怜而葬之。');
    await G.notice('北上樊城！');
  }

  async function caorenScene() {
    if (G.flag('c21_end')) return;
    await G.lines([
      ['caoren', '樊城城墙被水浸坏，看看倒塌……诸将！随我出城，死战关某！'],
      ['guanyu', '曹子孝，汝今日还要坚守么？'],
    ]);
    const r = await G.battle(['caoren2', 'caobing8', 'caoshe8', 'caobing8'], { bg: 'flood', boss: true, intro: '樊城 · 曹仁！' });
    if (r !== 'win') return;
    G.setFlag('c21_end');
    await G.narrate('关公直到城下，以鞭指城上曰："汝等鼠辈，不早来降，更待何时！"');
    G.audio.sfx('crit'); G.shake(6, 0.4);
    await G.narrate('城上曹仁令五百弓弩手一齐放箭——关公急勒马回时，右臂上中一弩箭，翻身落马。');
    await G.fadeOut(1.2);
    await G.narrate('关公回营，拔出臂箭。原来箭头有药，毒已入骨，右臂青肿，不能运动。');
    await G.narrate('忽一日，有人从江东驾小舟而来，直至寨前——');
    await G.fadeIn(0.8);
    await G.lines([
      ['huatuo', '某沛国谯郡人，姓华名佗，字元化。因闻关将军乃天下英雄，今中毒箭，特来医治。'],
      ['guanping', '先生莫非昔日医东吴周泰者乎？'],
      ['huatuo', '然。此乃弩箭所伤，其中有乌头之药，直透入骨——若不早治，此臂无用矣。'],
      ['guanyu', '（正与马良弈棋）用何物治之？'],
      ['huatuo', '当于静处立一标柱，上钉大环，请君侯将臂穿于环中，以绳系之，然后以被蒙其首。吾用尖刀割开皮肉，直至于骨，刮去骨上箭毒——'],
      ['guanyu', '（笑）如此，容易！何用柱环？'],
    ]);
    G.audio.sfx('slash');
    await G.narrate('关公饮酒数杯，一面仍与马良弈棋，伸臂令华佗割之。');
    await G.narrate('佗乃下刀，割开皮肉，直至于骨，骨上已青；佗用刀刮骨，悉悉有声。帐上帐下见者，皆掩面失色。');
    await G.narrate('关公饮酒食肉，谈笑弈棋，全无痛苦之色。');
    await G.lines([
      ['guanyu', '（大笑而起）此臂伸舒如故，并无痛矣。先生真神医也！'],
      ['huatuo', '某为医一生，未尝见此。君侯真天神也！'],
    ]);
    G.restoreAll();
    await G.chapterEnd(G.CHAPTERS[21].endLines);
  }

  G.CHAPTERS[21] = {
    title: '水淹七军',
    prologue: [
      '关羽北伐，先取襄阳，进围樊城。',
      '曹操派于禁为大将、庞德为先锋，领七军来救。',
      '庞德原是马超旧将，有人疑他不肯尽力。',
      '庞德于是做了一件让所有人都没想到的事。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(['guanyu']);
      G.setParty(['guanyu']);
      G.joinParty('guanping'); G.joinParty('zhoucang');
      G.state.party = JZ.slice();
      G.restoreAll();
      const w = G.world;
      w.load('c21fancheng', 22, 32, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['guanping', '父亲，襄阳已下，曹仁退守樊城。'],
        ['zhoucang', '听说曹操派了个叫庞德的来，还抬着一口棺材！'],
        ['guanyu', '……抬着棺材来见关某？好，好。'],
      ]);
      G.audio.sfx('levelup');
      await G.notice('关平、周仓 加入！\n北上樊城。');
    },
    endLines: [
      '关羽水淹七军，擒于禁、斩庞德，威震华夏。',
      '曹操惊得要迁都以避其锋。',
      '司马懿献计：孙权与刘备外亲内疏，',
      '可遣使许以江南之地，令其袭关羽之后。',
      '东吴陆口，吕蒙托病辞职，换来一个无名书生——陆逊。',
      '陆逊卑辞厚礼，写信称颂关羽。关羽大笑："仲谋见识短浅，用此孺子为将！"',
      '遂撤荆州之兵，大半调往樊城……',
    ],
  };
})();
