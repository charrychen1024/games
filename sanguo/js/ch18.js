/* ============================================================
 * 烽烟录 · 第十八章　单刀赴会（第五部开篇，关羽单人）
 * 江陵（诸葛瑾索荆州、鲁肃请宴）→ 陆口临江亭（单刀赴会、甘宁拦江）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const JZ = { gh: 96, gs: 32, gl: 28 };
  const JN = { gh: 98, gs: 34, gl: 30 };
  const SHOP = ['shenghui', 'xuelian', 'tianxiang', 'yulu', 'xianlu', 'xuming', 'dayan', 'shujin'];
  const SOLO = ['guanyu'];

  /* ---------------- 江陵 ---------------- */
  B.c18jiangling = () => {
    const m = new G.GameMap('c18jiangling', '江 陵', 40, 36, TL.GRASS);
    Object.assign(m, { seed: 1801, music: 'town', pal: JZ, ambient: 'leaves', flowers: 0.05, battleBg: 'field' });
    K.walls(m, 0, 0, 39, 25, [{ side: 's', x: 18, plaque: '江陵' }]);
    m.road([[19.5, 36], [19.5, 8]], 1, TL.PATH);
    m.road([[2, 16.5], [37, 16.5]], 0.6, TL.PATH);
    m.rect(14, 8, 12, 5, TL.FLOOR);
    m.prop('hall', 14, 2, 12, 6, { sign: '荆州牧府', roof: '#2a4a3a' });
    m.prop('house', 3, 4, 7, 5, { sign: '客栈', roof: '#45403a' });
    m.prop('house', 30, 4, 7, 5, { sign: '军器', roof: '#4a3b36' });
    m.prop('house', 3, 18, 7, 5, { roof: '#45403a', lantern: false });
    m.prop('house', 30, 18, 6, 5, { roof: '#4a3b36', lantern: false });
    m.road([[6.5, 9], [6.5, 16]], 0.6, TL.PATH); m.road([[33.5, 9], [33.5, 16]], 0.6, TL.PATH);
    for (const [x, y] of [[13, 7], [26, 7], [17, 25], [22, 25]]) K.deco(m, 'flag', x, y, { text: '关', color: '#2a5a3a', tcol: '#f6e7c1' });
    K.deco(m, 'rack', 11, 13); K.deco(m, 'rack', 28, 13);
    // 城外江岸
    m.rect(0, 32, 40, 4, TL.WATER);
    m.rect(19, 30, 2, 3, TL.BRIDGE);
    K.ship(m, 15, 33, 9, 3, { dir: 'right', text: '关', sail: '#d8cbb0', mh: 120 });
    m.reserve(18, 26, 4, 7);
    K.innerTrees(m, 1, 2, 38, 23, 1807, 0.45);
    K.forest(m, { seed: 1805, thr: 0.7, kinds: ['tree', 'bamboo'] });
    m.warp(18, 34, 4, 1, 'c18lukou', 13, 30, 'up', () => G.flag('c18_invite'), '关平：父亲，东吴的请帖还没到呢。');
    m.npc({ id: 'inn18', spec: 'innkeeper', x: 6, y: 10, dir: 'down', talk: K.innTalk('innkeeper', 200) });
    m.npc({ id: 'shop18', spec: 'smith', x: 33, y: 10, dir: 'down', talk: K.shopTalk('smith', SHOP, '荆州军器', '君侯要些什么？荆州的东西，样样都有。') });
    m.npc({ id: 'gp18', spec: 'guanping', x: 17, y: 10, dir: 'down', talk: K.talk([['guanping', '父亲，东吴屡次索要荆州，不可不防。']]) });
    m.npc({ id: 'zc18', spec: 'zhoucang', x: 22, y: 10, dir: 'down', talk: K.talk([['zhoucang', '君侯去哪儿，周仓就扛着刀跟到哪儿！']]) });
    m.npc({ id: 'zgj18', spec: 'wuru', x: 19, y: 14, dir: 'up', cond: () => !G.flag('c18_jin'), marker: () => true, talk: jinScene });
    m.npc({ id: 'msg18', spec: 'wubing', x: 19, y: 22, dir: 'up', cond: () => G.flag('c18_jin') && !G.flag('c18_invite'), marker: () => true, talk: inviteScene });
    m.npc({ id: 'jl1', spec: 'farmer', x: 10, y: 20, wander: 2, talk: K.talk([['farmer', '关将军镇守荆州，城里夜不闭户。']]) });
    m.npc({ id: 'jl2', spec: 'woman', x: 28, y: 21, wander: 2, talk: K.talk([['woman', '听说东吴又派人来要荆州了……']]) });
    m.npc({ id: 'jl3', spec: 'child', x: 25, y: 15, wander: 2, talk: K.talk([['child', '周仓叔叔能在水里走路！我亲眼看见的！']]) });
    return m;
  };

  async function jinScene() {
    await G.lines([
      ['wuru', '诸葛瑾奉吴侯之命而来。皇叔已许先还长沙、零陵、桂阳三郡，请将军交割。', { name: '诸葛瑾' }],
      ['guanyu', '吾与吾兄桃园结义，誓共匡扶汉室。荆州本大汉疆土，岂得妄以尺寸与人？'],
      ['guanyu', '"将在外，君命有所不受。"虽吾兄有书来，我却只不还！'],
      ['wuru', '……将军何太无面目也！', { name: '诸葛瑾' }],
      ['guanyu', '（手按剑）休再多言！此剑上并无面目！'],
    ]);
    G.setFlag('c18_jin');
    await G.narrate('诸葛瑾满面羞惭，回江东去了。');
    await G.notice('过了几日，城门口来了一个东吴使者。');
  }

  async function inviteScene() {
    await G.lines([
      ['wubing', '鲁都督拜上关将军：于陆口临江亭设宴，恭请将军赴会。', { name: '东吴使者' }],
      ['guanyu', '既子敬相请，我明日便来赴宴。汝可先回。'],
    ]);
    await G.narrate('使者去后——');
    await G.lines([
      ['guanping', '父亲！鲁肃相邀，必无好意。父亲何故许之？'],
      ['guanyu', '吾岂不知耶？此是诸葛瑾回报孙权，说吾不肯还三郡，故令鲁肃屯兵陆口，邀我赴会，便索荆州。'],
      ['guanyu', '吾若不往，道吾怯矣。吾来日独驾小舟，只用亲随十余人，单刀赴会——看鲁肃如何近我！'],
      ['zhoucang', '周仓给君侯扛刀！'],
      ['guanping', '……孩儿选五百水军，于江上等候。父亲但看红旗起处，便过江来。'],
    ]);
    G.setFlag('c18_invite');
    await G.notice('关羽单刀赴会。\n从南门出城，到江边上船。');
  }

  /* ---------------- 陆口 · 临江亭 ---------------- */
  B.c18lukou = () => {
    const m = new G.GameMap('c18lukou', '陆 口', 30, 34, TL.GRASS);
    Object.assign(m, { seed: 1821, music: 'camp', pal: JN, ambient: 'clouds', flowers: 0.04, battleBg: 'river' });
    K.tallGrass(m, 1823, 0.6);
    m.rect(0, 31, 30, 3, TL.WATER);
    m.road([[13.5, 31], [13.5, 18], [15, 12], [15, 8]], 0.8, TL.PATH);
    m.rect(12, 28, 3, 3, TL.BRIDGE);
    K.ship(m, 8, 31, 8, 3, { dir: 'right', text: '关', sail: '#d8cbb0', mh: 110 });
    m.rect(10, 4, 11, 6, TL.FLOOR);
    m.prop('pavilion', 13, 3, 5, 4, { plaque: '临 江 亭' });
    K.tent(m, 3, 10, { red: true }); K.tent(m, 23, 10, { red: true }); K.tent(m, 3, 18, { red: true });
    for (const [x, y] of [[9, 9], [21, 9]]) K.deco(m, 'flag', x, y, { text: '吴', color: '#a8322a', tcol: '#f6e7c1' });
    m.reserve(12, 26, 3, 5); m.reserve(9, 4, 13, 7);
    K.forest(m, { seed: 1825, thr: 0.68, kinds: ['tree', 'bamboo', 'peach'] });
    m.npc({ id: 'ls18', spec: 'lusu', x: 15, y: 6, dir: 'down', cond: () => !G.flag('c18_feast'), marker: () => true, talk: feastScene });
    m.npc({ id: 'zc18b', spec: 'zhoucang', x: 17, y: 8, dir: 'down', cond: () => !G.flag('c18_feast'), talk: K.talk([['zhoucang', '（扛着青龙刀，立在君侯身后）']]) });
    m.npc({ id: 'lm18', spec: 'lvmeng', x: 5, y: 13, dir: 'right', cond: () => !G.flag('c18_feast'), talk: K.talk([['lvmeng', '（帐后伏着刀斧手，只等都督掷杯为号）']]) });
    m.npc({ id: 'gn18', spec: 'ganning', x: 13, y: 24, dir: 'up', aggro: true, cond: () => G.flag('c18_feast') && !G.flag('c18_end'), talk: ganningScene });
    m.npc({ id: 'ls18b', spec: 'lusu', x: 14, y: 20, dir: 'down', cond: () => G.flag('c18_feast') && !G.flag('c18_end'), talk: K.talk([['lusu', '（被关公挽住，身不由己）将、将军……酒、酒还没喝完……']]) });
    m.onEnter = async () => {
      if (G.flag('c18_lk')) return; G.setFlag('c18_lk');
      await G.narrate('关公青巾绿袍，坐于船上，旁边周仓捧着大刀，八九个关西大汉各跨腰刀一口。');
      await G.lines([['guanyu', '（下船，拂髯而笑）子敬何在？']]);
    };
    return m;
  };

  async function feastScene() {
    await G.lines([
      ['lusu', '（迎入亭内，叙礼毕，入席饮酒。肃举杯相劝，不敢仰视）'],
      ['lusu', '有一言诉与君侯：昔日令兄皇叔，使肃于吾主之前，保借荆州暂住，约于取川之后归还。今西川已得，而荆州未还——得毋失信乎？'],
      ['guanyu', '此国家之事，筵间不必论之。'],
      ['lusu', '吾主只区区江东之地，而肯以荆州相借者，为念君侯等兵败远来，无以为资故也。今皇叔已得益州，则荆州自应见还；乃皇叔但肯先割三郡，而君侯又不从——恐于理上说不去。'],
      ['guanyu', '乌林之役，左将军亲冒矢石，戮力破敌，岂得徒劳而无尺土相资？今足下复来索地耶？'],
      ['zhoucang', '（阶下厉声）天下土地，惟有德者居之，岂独是汝东吴当有耶！'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('关公变色而起，夺周仓所捧大刀，立于庭中，目视周仓而叱曰——');
    await G.lines([
      ['guanyu', '此国家之事，汝何敢多言！可速去！'],
      ['guanyu', '（右手提刀，左手挽住鲁肃手，佯推醉曰）公今请吾赴宴，莫提起荆州之事。吾今已醉，恐伤故旧之情。他日令人请公到荆州赴会，另作商议。'],
    ]);
    await G.narrate('周仓会意，先到岸口，把红旗一招。关平的船如箭一般，奔过江东来。');
    await G.narrate('吕蒙、甘宁各引本部军欲出，见关公手提大刀，亲握鲁肃，恐肃被伤，遂不敢动。有几个不知轻重的刀斧手，还是扑了上来——');
    const r = await G.battle(['wubing3', 'wugong3'], { bg: 'river', party: SOLO, intro: '帐后刀斧手杀出！' });
    if (r !== 'win') return;
    G.setFlag('c18_feast');
    await G.notice('挽着鲁肃，走回江边！');
  }

  async function ganningScene() {
    await G.lines([
      ['ganning', '关云长！留下荆州，再走不迟！'],
      ['guanyu', '（刀尖一指）锦帆贼甘兴霸？——关某的刀，可不认得什么锦帆！'],
    ]);
    const r = await G.battle(['ganning'], { bg: 'river', boss: true, party: SOLO, intro: '锦帆贼 甘宁 拦住江岸！' });
    if (r !== 'win') return;
    G.setFlag('c18_end');
    await G.narrate('关公直到船边，方才放手。早立于船首，与鲁肃作别。');
    await G.lines([
      ['guanyu', '子敬，后会有期。'],
      ['lusu', '（如痴似呆，看关公船已乘风而去）……'],
    ]);
    await G.narrate('后人有诗赞曰：藐视吴臣若小儿，单刀赴会敢平欺。当年一段英雄气，尤胜相如在渑池。');
    await G.chapterEnd(G.CHAPTERS[18].endLines);
  }

  G.CHAPTERS[18] = {
    title: '单刀赴会',
    prologue: [
      '刘备得了西川，东吴便派诸葛瑾来索要荆州。',
      '刘备与孔明商量，写信叫关羽先还三郡，',
      '却暗中知道，关羽断然不肯。',
      '荆州，成了孙刘之间一根拔不掉的刺。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(['guanyu']);
      G.setParty(SOLO);
      G.restoreAll();
      const w = G.world;
      w.load('c18jiangling', 19, 18, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['guanyu', '（夜读《春秋》，抚髯）大哥入主西川，荆州便由关某守着。'],
        ['guanping', '父亲，东吴的诸葛瑾来了，正在府前候见。'],
      ]);
      await G.notice('第十八章：关羽单人章节。\n去府前见诸葛瑾。');
    },
    endLines: [
      '关羽单刀赴会，全身而回，东吴为之丧气。',
      '这一年，曹操亲征汉中，张鲁投降。',
      '东吴趁机攻合肥，却被张辽八百骑杀得大败，',
      '"张辽止啼"的故事，传遍了江东。',
      '汉中落入曹操之手，西川门户洞开。',
      '法正对刘备说："此天以与我，时不可失。"',
    ],
  };
})();
