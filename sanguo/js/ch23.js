/* ============================================================
 * 烽烟录 · 第二十三章　猇亭（第六部开篇）
 * 三峡（张飞遇害、关兴张苞从征、破吴军前哨、关公显圣·关兴斩潘璋）→ 猇亭（黄忠殒命）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SX = { gh: 104, gs: 30, gl: 24 };
  const SHOP = ['tianxiang', 'huixin', 'xianlu', 'yuquan', 'xuming', 'qingzhou', 'longwen', 'wuxing'];
  const ARMY = ['liubei', 'huangzhong', 'guanxing', 'zhangbao2'];
  const GROUPS = [{ e: ['wubing5', 'wubing5'], w: 3 }, { e: ['wubing5', 'wugong5'], w: 3 }, { e: ['wugong5', 'wugong5', 'wubing5'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };
  const campMenu = (line, title) => async () => {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) await restAndSave('innkeeper', line, '军需官'); else if (k === 1) await G.shop(SHOP, title);
  };

  /* ---------------- 三峡 ---------------- */
  B.c23yiling = () => {
    const m = new G.GameMap('c23yiling', '三 峡', 58, 40, TL.GRASS);
    Object.assign(m, { seed: 2301, music: 'field', ambient: 'clouds', pal: SX, battleBg: 'shu', flowers: 0.04 });
    K.tallGrass(m, 2303, 0.56);
    m.road([[58, 6], [44, 8], [30, 6], [16, 9], [0, 8]], 1.6, TL.WATER);                 // 长江
    m.road([[52.5, 30], [44, 22], [30, 20], [16, 22], [3, 21]], 0.8, TL.PATH);          // 白帝 → 猇亭
    m.road([[30, 20], [28, 30], [24.5, 34]], 0.6, TL.PATH);                             // → 山庄
    K.tent(m, 50, 32, { big: true, w: 5, h: 4, red: true, sign: '汉' });
    K.tent(m, 45, 33, { red: true });
    K.deco(m, 'flag', 49, 36, { text: '汉', color: '#8a1e1e', tcol: '#f6e7c1' }); K.deco(m, 'flag', 55, 36, { text: '汉', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.prop('house', 20, 33, 6, 4, { roof: '#45403a', sign: '山庄' });
    m.prop('townicon', 0, 18, 3, 3, { label: '猇亭', foot: [0, 18, 3, 3] });
    m.reserve(48, 29, 8, 9); m.reserve(23, 37, 3, 2); m.reserve(3, 20, 2, 3);
    m.npc({ id: 'camp23', spec: 'innkeeper', x: 48, y: 31, dir: 'down', talk: campMenu('陛下，军中粮草充足。', '御营军需') });
    m.npc({ id: 'msk23', spec: 'shamoke', x: 54, y: 31, dir: 'left', talk: K.talk([['shamoke', '五溪蛮王沙摩柯，奉命助汉天子伐吴！甘宁那厮，交给俺！']]) });
    K.guard(m, { id: 'out23', spec: 'wubing', x: 37, y: 20, dir: 'right', flag: 'c23_out', group: ['wubing5', 'wugong5', 'wubing5'], intro: '吴军前哨！', bg: 'shu',
      lines: [['wubing', '蜀军来了！谢旌、李异将军有令：死守此路！', { name: '吴军校尉' }]],
      after: async () => { await G.narrate('张苞一矛刺死谢旌，关兴一刀砍翻李异。吴军前哨尽溃。'); } });
    m.event({ type: 'inspect', x: 22, y: 33, w: 2, h: 4, run: shrineScene });
    m.event({ type: 'step', x: 23, y: 37, w: 3, h: 2, run: shrineScene });
    m.npc({ id: 'old23', spec: 'oldman', x: 25, y: 37, dir: 'up', cond: () => G.flag('c23_out') && !G.flag('c23_pz'), marker: () => true, talk: shrineScene });
    m.warp(3, 20, 2, 3, 'c23xiaoting', 37, 15, 'left', () => G.flag('c23_out') && G.flag('c23_pz'), '黄忠：陛下，前面吴军还未扫清，关兴那孩子也还没回来。');
    for (const [x, y] of [[4, 28], [12, 32], [36, 30], [40, 36], [8, 12], [50, 14], [24, 12], [36, 12]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2311, thr: 0.6, kinds: ['pine', 'bamboo', 'tree', 'dark'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function shrineScene() {
    if (G.flag('c23_pz')) { await G.narrate('山庄堂上，供着一幅关公神像。香火不断。'); return; }
    if (!G.flag('c23_out')) { await G.narrate('一座山间的庄院。'); return; }
    await G.narrate('关兴追杀潘璋，迷失了道路。天色已晚，望见一座山庄，便来投宿——');
    await G.lines([
      ['oldman', '将军请进。……将军是何人？', { name: '庄主' }],
      ['guanxing', '吾乃关云长之子关兴也。'],
      ['oldman', '（扑地便拜）老汉家中供奉的，正是令尊神像！', { name: '庄主' }],
    ]);
    await G.narrate('关兴大哭，拜于神像之前。正哭间，门外又有一人来投宿——正是潘璋！');
    G.setParty(['guanxing']);
    await G.lines([
      ['panzhang', '（入堂，猛见关公神像，大惊）……'],
      ['guanxing', '（按剑大喝）歹贼休走！'],
    ]);
    G.audio.sfx('gong'); G.shake(6, 0.4);
    await G.narrate('潘璋回身欲走，忽见门外一人，面如重枣，丹凤眼，卧蚕眉，飘三缕美髯，绿袍金铠，按剑而入——');
    await G.narrate('潘璋见是关公显圣，大叫一声，神魂惊散。');
    const r = await G.battle(['panzhang2'], { bg: 'gorge', boss: true, party: ['guanxing'], intro: '关兴 · 报父仇！' });
    G.setParty(ARMY);
    if (r !== 'win') return;
    G.setFlag('c23_pz');
    await G.narrate('关兴手起剑落，斩潘璋于神像之前，取心沥血，祭于关公神像前。');
    await G.narrate('又寻得父亲的青龙偃月刀——原来潘璋得了此刀，一直带在身边。');
    await G.lines([
      ['guanxing', '父亲……孩儿替您报了一个仇。'],
      ['liubei', '（次日见关兴提潘璋首级回营，放声大哭）兴儿……'],
    ]);
    if (!G.state.members.guanxing.wbonus) G.state.members.guanxing.wbonus = 20;
    G.audio.sfx('levelup');
    await G.notice('关兴取回青龙偃月刀！\n（关兴的武器威力提升）\n西去猇亭。');
  }

  /* ---------------- 猇亭 ---------------- */
  B.c23xiaoting = () => {
    const m = new G.GameMap('c23xiaoting', '猇 亭', 40, 30, TL.GRASS);
    Object.assign(m, { seed: 2321, music: 'boss', ambient: 'leaves', leafColor: 'rgba(150,170,80,0.8)', pal: SX, battleBg: 'shu', flowers: 0.02 });
    K.tallGrass(m, 2323, 0.58);
    m.road([[40, 15.5], [24, 15], [12, 14], [4, 14]], 0.8, TL.PATH);
    m.rect(6, 8, 14, 13, TL.SOIL);
    for (const [x, y] of [[7, 8], [14, 8], [7, 17], [15, 17]]) K.tent(m, x, y, { w: 3, h: 3 });
    for (const [x, y] of [[6, 13], [19, 13]]) K.deco(m, 'flag', x, y, { text: '吴', color: '#a8322a', tcol: '#f6e7c1' });
    K.tent(m, 32, 20, { red: true }); K.tent(m, 33, 6, { red: true });
    K.deco(m, 'flag', 30, 18, { text: '汉', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.reserve(30, 13, 10, 5); m.reserve(9, 11, 9, 6);
    for (const [x, y] of [[2, 2], [24, 2], [2, 24], [24, 24], [34, 26]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2325, thr: 0.62, kinds: ['pine', 'bamboo', 'dark'] });
    m.npc({ id: 'xt23inn', spec: 'innkeeper', x: 36, y: 13, dir: 'down', talk: campMenu('陛下，前面便是猇亭吴寨。', '御营军需') });
    m.event({ type: 'step', x: 20, y: 13, w: 2, h: 5, run: xiaotingScene });
    m.npc({ id: 'mz23', spec: 'mazhong', x: 13, y: 14, dir: 'right', aggro: true, cond: () => !G.flag('c23_end'), marker: () => true, talk: xiaotingScene });
    m.onEnter = async () => {
      if (G.flag('c23_xt')) return; G.setFlag('c23_xt');
      await G.lines([
        ['liubei', '（赏赐关兴、张苞，叹曰）昔日从朕诸将，皆老迈无用矣。复有二侄如此英雄，朕何虑孙权乎！'],
        ['huangzhong', '（闻言，咬牙）……吾随天子多年，立功不少。今虽七旬有余，尚食肉十斤，臂开二石之弓，能乘千里之马——未足为老！'],
      ]);
      await G.narrate('当夜，黄忠只带亲随五六人，径投猇亭吴寨而去。');
      await G.notice('黄忠单骑出营！\n快追上去接应！');
    };
    return m;
  };

  async function xiaotingScene() {
    if (G.flag('c23_end')) return;
    await G.lines([
      ['huangzhong', '（立马阵前）吴狗！谁敢与黄忠一战！'],
      ['mazhong', '老匹夫，送死来了！'],
      ['guanxing', '老将军！我们来了！'],
    ]);
    const r = await G.battle(['mazhong', 'wubing5', 'wugong5'], { bg: 'shu', boss: true, intro: '猇亭 · 马忠！' });
    if (r !== 'win') return;
    G.setFlag('c23_end');
    await G.narrate('吴军败退。黄忠追赶马忠，正中埋伏——马忠暗处一箭，正中黄忠肩窝，险些落马。');
    await G.fadeOut(1.2);
    await G.narrate('关兴、张苞死救黄忠回营。黄忠年老血衰，箭疮痛裂，病甚沉重。');
    await G.fadeIn(0.8);
    await G.lines([
      ['liubei', '（亲到帐中，抚其背）令老将军中伤，朕之过也！'],
      ['huangzhong', '臣乃一武夫耳，幸遇陛下。臣今年七十有五，寿亦足矣。望陛下善保龙体，以图中原！'],
    ]);
    await G.narrate('言讫，不省人事。是夜殒于御营。时章武二年二月。');
    await G.narrate('后人有诗叹曰：老将说黄忠，收川立大功。重披金锁甲，双挽铁胎弓。胆气惊河北，威名镇蜀中。临亡头似雪，犹自显英雄。');
    G.leaveParty('huangzhong'); G.world.refreshParty();
    await G.notice('黄忠 殒命于御营。\n（他的护甲放回了行囊）');
    await G.lines([
      ['liubei', '（哀痛不已）五虎大将，已亡三人。朕尚不能复仇，深可痛哉！'],
    ]);
    await G.narrate('沙摩柯一箭射死甘宁；糜芳、傅士仁杀了马忠，提头来降，刘备命关兴祭杀二贼于关公灵前。孙权惊恐，遣使送还张飞的仇人范疆、张达，求和——');
    await G.lines([['liubei', '朕切齿之仇，乃孙权也！今与仇人通和，是负二弟当日之盟矣。今先灭吴，次灭魏！']]);
    await G.chapterEnd(G.CHAPTERS[23].endLines);
  }

  G.CHAPTERS[23] = {
    title: '猇亭',
    prologue: [
      '刘备在成都称帝，誓为关羽报仇。',
      '张飞在阆中，令军中三日内置办白旗白甲，挂孝伐吴。',
      '部将范疆、张达说限期太紧，被张飞鞭打。',
      '当夜，二人趁张飞大醉，潜入帐中——',
      '张飞死时，眼睛还睁着。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.leaveParty('zhangfei');
      G.catchUp(['liubei', 'huangzhong']);
      G.setParty(['liubei', 'huangzhong']);
      G.joinParty('guanxing'); G.joinParty('zhangbao2');
      G.state.party = ARMY.slice();
      G.restoreAll();
      const w = G.world;
      w.load('c23yiling', 50, 37, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['liubei', '（白袍白甲，望东而哭）二弟……三弟……'],
        ['zhangbao2', '（跪）陛下！张苞愿为先锋，誓杀东吴狗贼，为父报仇！'],
        ['guanxing', '关兴也去！'],
        ['liubei', '……好孩子。二弟、三弟，你们的儿子都长大了。'],
      ]);
      G.audio.sfx('levelup');
      await G.notice('张飞 遇害。\n关兴、张苞 加入！\n第二十三章：刘备亲征东吴。西去猇亭。');
    },
    endLines: [
      '刘备连营七百里，从巫峡直到夷陵。',
      '孙权拜一个年轻书生为大都督——陆逊。',
      '东吴诸将皆不服。陆逊只令各处坚守，不许出战。',
      '时值盛夏，蜀军移营于山林之中，以避暑热。',
      '陆逊在地图前看了很久，只说了一句：',
      '"刘备之败，就在今日。"',
    ],
  };
})();
