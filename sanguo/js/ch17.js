/* ============================================================
 * 烽烟录 · 第十七章　成都（第四部完）
 * 葭萌关（魏延战马岱 → 张飞日战马超 → 挑灯夜战 → 李恢说马超）→ 成都（刘璋出降）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SHU = { gh: 108, gs: 30, gl: 24 };
  const SHOP = ['shenghui', 'xuelian', 'tianzhong', 'yulu', 'xuming', 'quanjun', 'dayan', 'jinsuo', 'shujin'];
  const FULL = ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'weiyan'];
  const FINAL = ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao'];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  /* ---------------- 葭萌关 ---------------- */
  B.c17jiameng = () => {
    const m = new G.GameMap('c17jiameng', '葭 萌 关', 36, 36, TL.GRASS);
    Object.assign(m, { seed: 1701, music: 'boss', pal: SHU, ambient: 'clouds', flowers: 0.02, battleBg: 'shu', under: TL.SOIL });
    // 夜战之后才入夜；马超归降后天明
    Object.defineProperty(m, 'dusk', { get: () => G.flag('c17_duel1') && !G.flag('c17_ma'), configurable: true });
    K.walls(m, 0, 15, 35, 17, [{ side: 'n', x: 16, plaque: '葭萌关' }]);
    m.rect(1, 17, 34, 1, TL.WALL);
    m.rect(16, 15, 3, 3, TL.PATH);
    m.road([[17.5, 36], [17.5, 0]], 1, TL.PATH);
    m.rect(9, 3, 18, 10, TL.SOIL);                                                    // 关前战场
    K.tent(m, 5, 25, { big: true, w: 5, h: 4, red: true, sign: '刘' });
    K.tent(m, 26, 26, { red: true }); K.tent(m, 10, 30, { red: true });
    K.deco(m, 'flag', 13, 20, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' }); K.deco(m, 'flag', 22, 20, { text: '张', color: '#8a1e1e', tcol: '#f6e7c1' });
    K.deco(m, 'flag', 12, 2, { text: '马', color: '#c8c4b0', tcol: '#3a2a1a' }); K.deco(m, 'flag', 24, 2, { text: '马', color: '#c8c4b0', tcol: '#3a2a1a' });
    for (const [x, y] of [[9, 5], [26, 5], [9, 11], [26, 11], [14, 19], [21, 19]]) K.deco(m, 'fire', x, y, { light: 170 });
    m.reserve(16, 0, 3, 3); m.reserve(16, 31, 3, 5);
    K.forest(m, { seed: 1705, thr: 0.62, kinds: ['pine', 'dark', 'bamboo'] });
    m.warp(16, 35, 3, 1, 'c17jiameng', 17, 33, 'up', () => false, '诸葛亮：马超兵临关下，主公此时岂能后退？');
    m.warp(16, 0, 3, 1, 'c17chengdu', 17, 28, 'up', () => G.flag('c17_ma'), '关外是马超的营寨。');
    m.npc({ id: 'jminn', spec: 'innkeeper', x: 25, y: 31, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '关上弟兄们都备好了。主公歇歇吧。', '军需官'); else if (k === 1) await G.shop(SHOP, '葭萌军需');
    } });
    m.npc({ id: 'km17', spec: 'zhugeliang', x: 15, y: 22, dir: 'down', cond: () => !G.flag('c17_ma') && G.state.party.length === 1, talk: K.talk([['zhugeliang', '马超英勇，翼德不可轻敌。']]) });
    m.npc({ id: 'md17', spec: 'madai', x: 17, y: 11, dir: 'down', aggro: true, cond: () => !G.flag('c17_dai'), talk: madaiScene });
    m.npc({ id: 'mc17', spec: 'machao', x: 17, y: 6, dir: 'down', cond: () => G.flag('c17_dai') && !G.flag('c17_duel2'), marker: () => true, talk: () => (G.flag('c17_duel1') ? nightDuel() : dayDuel()) });
    m.npc({ id: 'lh17', spec: 'lihui', x: 20, y: 23, dir: 'down', cond: () => G.flag('c17_duel2') && !G.flag('c17_ma'), marker: () => true, talk: lihuiScene });
    m.npc({ id: 'wy17', spec: 'weiyan', x: 19, y: 19, dir: 'down', cond: () => G.flag('c17_ma'), talk: K.talk([['weiyan', '主公放心去成都，葭萌关有魏延守着！']]) });
    return m;
  };

  async function madaiScene() {
    if (G.flag('c17_dai')) return;
    await G.lines([
      ['madai', '西凉马岱在此！刘备贼子，快快献关！'],
      ['weiyan', '无名小卒，也敢猖狂！主公，看魏延取他首级！'],
    ]);
    const r = await G.battle(['madai', 'xiliang', 'xiliang2'], { bg: 'shu', boss: true, intro: '西凉 马岱！' });
    if (r !== 'win') return;
    G.setFlag('c17_dai');
    await G.narrate('马岱诈败，回身一箭，正中魏延左臂。魏延急回，马岱赶到关前——只见关上一将，雷声大叫，飞下关来——');
    await G.lines([
      ['zhangfei', '马超何在？叫他出来，与俺张飞决一死战！'],
      ['zhugeliang', '翼德且慢。马超英勇，天下皆知。渭桥六战，杀得曹操割须弃袍，几乎丧命——非等闲之比。就是云长来，也未可与敌。'],
      ['zhangfei', '军师何故小觑俺！俺曾单拒曹操百万之兵，岂愁马超一匹夫乎！'],
      ['liubei', '……三弟既要去，我亲自为你压阵。'],
    ]);
    G.setParty(['zhangfei']);
    await G.notice('张飞单独出战。\n出关迎战马超！');
  }

  async function dayDuel() {
    await G.narrate('马超银盔银甲，白袍白马，纵骑持枪而出。刘备在关上望见，叹曰："人言锦马超，名不虚传！"');
    await G.lines([
      ['zhangfei', '认得燕人张翼德么？'],
      ['machao', '吾家屡世公侯，岂识村野匹夫！'],
      ['zhangfei', '（大怒）——！！'],
    ]);
    const r = await G.battle(['machao'], { bg: 'shu', boss: true, party: ['zhangfei'], intro: '锦马超！' });
    if (r !== 'win') return;
    G.setFlag('c17_duel1');
    await G.narrate('二人斗了一百余合，不分胜负。两阵军士，看得呆了。天色已晚——');
    await G.lines([
      ['liubei', '天色已晚，三弟且回，明日再战。'],
      ['zhangfei', '（盘马而回，又欲出关）俺定要捉了此人方才回去！'],
      ['zhangfei', '多点火把，安排夜战！'],
      ['machao', '（亦换了马，再出阵前）张飞！敢夜战么？'],
      ['zhangfei', '（掀去头盔，只裹包巾）俺不捉你，誓不上关！'],
    ]);
    await G.notice('夜色降临，两军点起火把。\n再与马超夜战！');
  }

  async function nightDuel() {
    const r = await G.battle(['machao2'], { bg: 'jiameng', boss: true, party: ['zhangfei'], intro: '挑灯夜战 马超！' });
    if (r !== 'win') return;
    G.setFlag('c17_duel2');
    await G.narrate('马超佯败，掣出铜锤回身打来；张飞闪过，回身拈弓一箭，马超亦闪过。两家各自收兵。');
    G.setParty(FULL);
    await G.lines([
      ['liubei', '吾以仁义待人，不施诡谲。三弟与孟起，皆当世虎将——若伤了谁，都是可惜。'],
      ['zhugeliang', '亮闻马超乃当世虎将，若与翼德死战，必有一伤。亮有一计：令马超来降。'],
      ['zhugeliang', '张鲁欲自立"汉宁王"，其谋士杨松极贪贿赂。主公可使人以金帛结好杨松，令其进谗；马超进退两难之时，再遣一舌辩之士说之。'],
    ]);
    await G.notice('孔明遣李恢往说马超。\n去营中见李恢。');
  }

  async function lihuiScene() {
    await G.lines([
      ['lihui', '恢与马孟起素有旧交。愿凭三寸不烂之舌，往说马超来降。'],
    ]);
    await G.fadeOut(0.8);
    await G.narrate('马超帐中，刀斧手两旁侍立。李恢昂然而入——');
    await G.lines([
      ['machao', '汝来何为？吾匣中宝剑新磨，汝试言之！其言不通，便请试剑！'],
      ['lihui', '将军之祸不远矣！但恐新磨之剑，不能试吾之头，将欲自试也。'],
      ['machao', '吾有何祸？'],
      ['lihui', '曹操与将军有杀父之仇，陇西又有切齿之恨；前不能救刘璋而退荆州之兵，后不能制杨松而见张鲁之面。目下四海难容，一身无主——若复有渭桥之败、冀城之失，何面目见天下之人乎？'],
      ['machao', '……（顿首谢曰）公言极善，但超无路可行。'],
      ['lihui', '刘皇叔礼贤下士，吾知其必成大事，故舍刘璋而归之。公之尊人，昔年曾与皇叔约共讨贼——公何不背暗投明，以图上报父仇，下立功名乎？'],
    ]);
    await G.narrate('马超大喜，即唤杨柏入，一剑斩之，提其首级，共李恢一同上关来降。');
    await G.fadeIn(0.8);
    await G.lines([
      ['machao', '今遇明主，如拨云雾而见青天！'],
      ['liubei', '（亲自迎接，待以上宾之礼）孟起来归，备如鱼得水！'],
      ['zhangfei', '嘿！昨夜一锤，差点打着俺的耳朵！——好汉子，以后便是自家兄弟了！'],
      ['machao', '翼德一箭，也险些要了超的命。哈哈哈！'],
      ['machao', '主公不须折一兵一卒，超请自往成都城下，叫刘璋来降。如不肯降，超与弟马岱取成都，双手奉献！'],
    ]);
    G.setFlag('c17_ma');
    G.setParty(FULL.filter(id => id !== 'weiyan'));
    G.joinParty('machao');
    G.state.members.machao.armor = G.state.members.machao.armor || 'jinsuo';
    G.world.refreshParty(); G.restoreAll();
    G.audio.sfx('levelup');
    await G.notice('马超 加入！\n（马超自带金锁连环甲）\n魏延留守葭萌关。\n北出关门，直取成都。');
  }

  /* ---------------- 成都 ---------------- */
  B.c17chengdu = () => {
    const m = new G.GameMap('c17chengdu', '成 都', 40, 34, TL.GRASS);
    Object.assign(m, { seed: 1721, music: 'camp', pal: SHU, ambient: 'petals', flowers: 0.07, battleBg: 'city' });
    K.walls(m, 0, 0, 39, 15, [{ side: 's', x: 18, plaque: '成都' }]);
    m.road([[19.5, 34], [19.5, 8]], 1.1, TL.PATH);
    m.road([[3, 22.5], [36, 22.5]], 0.6, TL.PATH);
    m.rect(13, 8, 14, 5, TL.FLOOR);
    m.prop('hall', 14, 2, 12, 6, { sign: '益州牧府', roof: '#3a4a3a' });
    m.prop('house', 3, 4, 7, 5, { sign: '蜀锦', roof: '#45403a' });
    m.prop('house', 30, 4, 7, 5, { roof: '#4a3b36', lantern: false });
    m.prop('house', 3, 9, 6, 4, { roof: '#45403a', lantern: false });
    m.prop('pavilion', 31, 9, 4, 4, { plaque: '锦 官 城' });
    for (const [x, y] of [[16, 15], [23, 15]]) K.deco(m, 'flag', x, y, { text: '刘', color: '#3a5a3a', tcol: '#f6e7c1' });
    K.tent(m, 6, 26, { red: true }); K.tent(m, 30, 26, { red: true });
    K.deco(m, 'flag', 14, 28, { text: '马', color: '#c8c4b0', tcol: '#3a2a1a' }); K.deco(m, 'flag', 25, 28, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.reserve(18, 25, 3, 9);
    K.innerTrees(m, 1, 2, 38, 13, 1727, 0.45);
    K.forest(m, { seed: 1725, thr: 0.68, kinds: ['bamboo', 'peach', 'tree'] });
    m.warp(18, 33, 3, 1, 'c17jiameng', 17, 2, 'down', () => false, '马超：成都就在眼前！');
    m.warp(18, 14, 3, 1, 'c17chengdu', 19, 17, 'down', () => G.flag('c17_end'), '城门紧闭。城上守军刀枪林立。');
    m.npc({ id: 'cdinn', spec: 'innkeeper', x: 8, y: 29, dir: 'right', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '城外营寨都扎好了。', '军需官'); else if (k === 1) await G.shop(SHOP, '成都军需');
    } });
    K.guard(m, { id: 'cdg', spec: 'shubing', x: 19, y: 18, dir: 'down', flag: 'c17_gate', group: ['shubing3', 'shubing3', 'shugong2', 'shubing3'], intro: '成都守军拒不开门！', bg: 'city',
      lines: [['shubing', '刘益州还没下令投降！谁敢上前，乱箭射死！', { name: '城门校尉' }]] });
    m.npc({ id: 'lz17', spec: 'liuzhang', x: 19, y: 17, dir: 'down', cond: () => G.flag('c17_gate') && !G.flag('c17_end'), marker: () => true, talk: surrenderScene });
    m.npc({ id: 'cd1', spec: 'farmer', x: 9, y: 20, wander: 2, talk: K.talk([['farmer', '听说刘皇叔仁义，入川以来秋毫无犯。']]) });
    m.npc({ id: 'cd2', spec: 'woman', x: 30, y: 20, wander: 2, talk: K.talk([['woman', '城外那位白袍将军，就是锦马超？真好看……']]) });
    return m;
  };

  async function surrenderScene() {
    await G.lines([
      ['machao', '（于城下高叫）请刘季玉答话！'],
      ['liuzhang', '（登城）……孟起？你……你不是来救我的么？'],
      ['machao', '吾本领张鲁兵来救益州，谁想张鲁听信杨松谗言，反欲害我。今已归降刘皇叔。公可纳土拜降，免致生灵受苦。如或执迷，吾先攻城矣！'],
    ]);
    await G.narrate('刘璋惊得面如土色，气倒于城上。众官救醒——');
    await G.lines([
      ['liuzhang', '吾父子在蜀二十余年，无恩德以加百姓；攻战三年，血肉捐于草野，皆我罪也。我心何安？——不如投降，以安百姓。'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('次日，刘璋亲赍印绶文籍，与简雍同车出城投降。刘备出寨迎接，握手流涕——');
    await G.lines([
      ['liubei', '非吾不行仁义，奈势不得已也！'],
    ]);
    G.setFlag('c17_end');
    await G.fadeOut(1.2);
    await G.narrate('刘备入成都，百姓香花灯烛，迎门而接。刘备自领益州牧，迁刘璋于荆州公安，礼待如故。');
    await G.narrate('封赏群臣：诸葛亮为军师，关羽为荡寇将军、汉寿亭侯，张飞为征虏将军、新亭侯，赵云为镇远将军，黄忠为征西将军，魏延为扬武将军，马超为平西将军——');
    await G.narrate('严颜为前将军；法正为蜀郡太守；凡蜀中旧官，皆量才擢用。');
    await G.fadeIn(1.0);
    await G.lines([
      ['zhugeliang', '主公，荆、益二州，已得其二。隆中之对，至此方成一半。'],
      ['liubei', '若非军师……若非士元……'],
      ['liubei', '（望向东方）士元，你看见了么？我们进成都了。'],
      ['zhangfei', '大哥！今日不醉不归！'],
    ]);
    G.setParty(FINAL); G.restoreAll();
    await G.chapterEnd(G.CHAPTERS[17].endLines);
  }

  G.CHAPTERS[17] = {
    title: '成都',
    prologue: [
      '马超投奔张鲁，张鲁正欲取西川，',
      '刘璋遣使求救，许以二十州之地。',
      '马超遂引兵来攻葭萌关。',
      '刘备与孔明，率众将回救葭萌。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.setParty(FULL);
      G.restoreAll();
      const w = G.world;
      w.load('c17jiameng', 17, 32, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhugeliang', '关外便是马超之弟马岱的前军。'],
        ['weiyan', '主公，让魏延先去会会他！'],
      ]);
      await G.notice('出葭萌关迎敌。');
    },
    endLines: [
      '建安十九年，刘备得益州。',
      '从桃园结义的三兄弟，到坐拥荆、益两州——',
      '这条路，走了整整三十年。',
      '然而，东吴索要荆州的使者，已在路上；',
      '北方的曹操，也正把目光投向汉中……',
      '（第四部　完）',
    ],
  };
})();
