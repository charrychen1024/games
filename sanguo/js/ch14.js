/* ============================================================
 * 烽烟录 · 第十四章　甘露寺（第四部开篇）
 * 南徐（锦囊一·乔国老、甘露寺相亲、试剑石、洞房、锦囊二）→ 江岸（锦囊三·夫人退追兵、刘郎浦、周瑜）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const JN = { gh: 98, gs: 34, gl: 30 };
  const WUFLAG = { color: '#a8322a', tcol: '#f6e7c1' };
  const SHOP = ['dahuan', 'shenghui', 'xuelian', 'tianzhong', 'yulu', 'xuming', 'quanjun', 'jinsuo'];
  const DUO = ['liubei', 'zhaoyun'];
  const BASE = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'zhugeliang', 'huangzhong', 'jianyong'];

  /* ---------------- 南徐 ---------------- */
  B.c14nanxu = () => {
    const m = new G.GameMap('c14nanxu', '南 徐', 44, 34, TL.GRASS);
    Object.assign(m, { seed: 1401, music: 'town', pal: JN, ambient: 'petals', flowers: 0.06, battleBg: 'city' });
    K.walls(m, 0, 0, 43, 33, [{ side: 's', x: 21, plaque: '南徐' }, { side: 'n', x: 38, plaque: '北固' }]);
    m.road([[22.5, 33], [22.5, 17]], 1, TL.PATH);
    m.road([[2, 21.5], [41, 21.5]], 0.6, TL.PATH);
    m.road([[39.5, 2], [39.5, 21]], 0.6, TL.PATH);
    m.road([[31.5, 9], [31.5, 21]], 0.6, TL.PATH);
    m.rect(12, 9, 13, 8, TL.FLOOR);                        // 甘露寺前庭
    m.prop('hall', 13, 3, 11, 6, { sign: '甘露寺', roof: '#6a4a2a' });
    m.prop('hall', 26, 3, 11, 6, { sign: '吴侯府', roof: '#5a2a24' });
    m.prop('house', 3, 23, 7, 5, { sign: '驿馆', roof: '#4a3b36' });
    m.prop('house', 32, 23, 7, 5, { sign: '乔府', roof: '#3a4a4a' });
    m.prop('house', 3, 12, 7, 5, { sign: '商号', roof: '#5a3a30' });
    m.prop('house', 13, 24, 6, 5, { roof: '#45403a', lantern: false });
    m.prop('jianshi', 20, 12, 2, 2, { foot: [20, 12, 2, 2], splitFlag: 'c14_stone' });
    m.prop('pavilion', 26, 12, 4, 4, { plaque: '多 景 楼' });
    m.road([[6.5, 17], [6.5, 21]], 0.6, TL.PATH); m.road([[6.5, 28], [6.5, 30]], 0.6, TL.PATH); m.road([[35.5, 28], [35.5, 30]], 0.6, TL.PATH);
    K.deco(m, 'well', 28, 18); K.deco(m, 'board', 18, 19);
    for (const [x, y] of [[12, 8], [24, 8], [21, 18], [24, 18]]) K.deco(m, 'flag', x, y, Object.assign({ text: '孙' }, WUFLAG));
    m.warp(21, 33, 3, 1, 'c14nanxu', 22, 31, 'up', () => false, '赵云：主公，军师有言，此行须依锦囊行事，不可擅离。');
    m.warp(38, 0, 3, 1, 'c14road', 2, 15, 'right', () => G.flag('c14_escape'), '赵云：城中耳目众多，还是依军师锦囊行事为妙。');
    m.reserve(21, 28, 3, 5); m.reserve(38, 0, 3, 4);
    K.innerTrees(m, 1, 2, 42, 31, 1407, 0.5);
    m.npc({ id: 'inn14', spec: 'innkeeper', x: 6, y: 29, dir: 'down', talk: K.innTalk('innkeeper', 160) });
    m.npc({ id: 'shop14', spec: 'merchant', x: 7, y: 18, dir: 'down', talk: K.shopTalk('merchant', SHOP, '南徐商号', '听说吴侯要嫁妹子，城里的东西可都涨价啦——给皇叔算便宜些！') });
    m.npc({ id: 'qiao14', spec: 'qiaoguolao', x: 35, y: 29, dir: 'down', marker: () => !G.flag('c14_qiao'), talk: qiaoScene });
    m.npc({ id: 'gt14', spec: 'wuguotai', x: 18, y: 10, dir: 'down', cond: () => G.flag('c14_qiao') && !G.flag('c14_guotai'), marker: () => true, talk: guotaiScene });
    m.npc({ id: 'gt14b', spec: 'wuguotai', x: 17, y: 10, dir: 'down', cond: () => G.flag('c14_guotai'), talk: K.talk([['wuguotai', '玄德公真乃吾婿也。吾儿仲谋若敢再生事端，老身断不饶他！']]) });
    m.npc({ id: 'qiao14b', spec: 'qiaoguolao', x: 15, y: 11, dir: 'right', cond: () => G.flag('c14_guotai') && !G.flag('c14_escape'), talk: K.talk([['qiaoguolao', '玄德公龙凤之姿，又是汉室宗亲，国太岂有不爱之理！']]) });
    m.npc({ id: 'sq14', spec: 'sunquan', x: 22, y: 11, dir: 'left', cond: () => G.flag('c14_guotai') && !G.flag('c14_stone'), marker: () => true, talk: K.talk([['sunquan', '……（看着庭中那块大石）玄德公，可去石前一观。']]) });
    m.npc({ id: 'ssx14', spec: 'sunshangxiang', x: 29, y: 10, dir: 'down', cond: () => G.flag('c14_guotai') && !G.flag('c14_wed'), talk: K.talk([['sunshangxiang', '（隔着侍婢打量）……这便是刘皇叔？哼，倒还有几分英雄气概。']]) });
    for (const [i, x] of [[0, 13], [1, 23]]) m.npc({ id: 'ax' + i, spec: 'wubing', x, y: 15, dir: x < 20 ? 'right' : 'left', cond: () => G.flag('c14_qiao') && !G.flag('c14_guotai'), talk: K.talk([['wubing', '（廊下刀斧手按刀而立，目光不善）']]) });
    m.npc({ id: 'nx1', spec: 'woman', x: 10, y: 20, wander: 2, talk: K.talk([['woman', '吴侯的妹子从小好舞刀弄剑，侍婢一百多人都佩着刀——谁家郎君敢娶哟！']]) });
    m.npc({ id: 'nx2', spec: 'oldman', x: 30, y: 27, wander: 2, talk: K.talk([['oldman', '甘露寺在城北，据说寺里有一块大石头，灵验得很。']]) });
    m.npc({ id: 'nx3', spec: 'child', x: 16, y: 30, wander: 2, talk: K.talk([['child', '刘皇叔要娶郡主啦！我娘去买红绸，都买不到了！']]) });
    m.npc({ id: 'nx4', spec: 'wubing', x: 40, y: 4, dir: 'down', cond: () => !G.flag('c14_escape'), talk: K.talk([['wubing', '北固门外便是江岸。无吴侯之命，不得出城。']]) });
    return m;
  };

  async function qiaoScene() {
    if (G.flag('c14_qiao')) { await say('qiaoguolao', G.flag('c14_guotai') ? '恭喜，恭喜！' : '国太已去甘露寺了，玄德公快去吧！'); return; }
    await G.lines([
      ['qiaoguolao', '哟，这不是刘皇叔吗？老夫二女，一嫁伯符，一嫁公瑾。皇叔亲来，莫非……'],
      ['liubei', '刘备丧偶，吴侯以令妹相许，特来纳聘。只恐国太尚不知情。'],
      ['qiaoguolao', '什么？国太竟不知？此事老夫须进宫说个明白！'],
    ]);
    await G.narrate('乔国老入宫贺喜。吴国太大惊，原来孙权与周瑜只是以招亲为名，要把刘备赚来软禁，索回荆州。');
    await G.lines([
      ['wuguotai', '（大哭）周瑜做六郡八十一州大都督，直恁无条计策去取荆州，却将我女儿为名，使美人计！杀了刘备，我女便是望门寡！'],
      ['qiaoguolao', '若用此计，便得荆州，也被天下人耻笑。不如真个招刘皇叔为婿，免得出丑。'],
      ['wuguotai', '……老身不曾认得刘备。明日约在甘露寺相见：如不中我意，任从你们行事；如中我的意，我自把女儿嫁他！'],
    ]);
    G.setFlag('c14_qiao');
    await G.notice('前往城北的甘露寺，拜见吴国太。');
  }

  async function guotaiScene() {
    await G.narrate('刘备内披细铠，外穿锦袍，赵云全装贯带，引五百军随行，来到甘露寺。');
    await G.lines([
      ['wuguotai', '（上下打量）……龙凤之姿，天日之表——真吾婿也！'],
      ['qiaoguolao', '玄德有龙凤之姿，更兼仁德布于天下。国太得此佳婿，真可庆也！'],
      ['zhaoyun', '（低声）主公，廊下两旁尽是刀斧手，必无好意！'],
    ]);
    await G.lines([
      ['liubei', '（跪于国太席前，泣而告曰）若杀刘备，就此请诛！'],
      ['wuguotai', '何出此言？'],
      ['liubei', '廊下暗伏刀斧手，非杀备而何？'],
      ['wuguotai', '（大怒，责骂孙权）今日玄德既为我婿，即我之儿女也——何故伏刀斧手于廊下！'],
    ]);
    G.audio.sfx('gong'); G.shake(6, 0.4);
    await G.lines([['jiahua', '吴侯有令在先……既已动手，便顾不得了！弟兄们，上！']]);
    const r = await G.battle(['jiahua', 'wubing2', 'wubing2'], { bg: 'city', boss: true, party: DUO, intro: '贾华率刀斧手杀出廊下！' });
    if (r !== 'win') return;
    G.setFlag('c14_guotai');
    await G.narrate('赵云一枪挑翻贾华，刀斧手抱头鼠窜。国太喝令将贾华推出斩首，刘备苦苦相劝，方才饶了。');
    await G.notice('庭中有一块大石——去石前看看。');
  }

  async function stoneScene() {
    if (G.flag('c14_stone')) { await G.narrate('十字纹的试剑石。后人称之为"恨石"。'); return; }
    if (!G.flag('c14_guotai')) { await G.narrate('一块青苔斑驳的大石。'); return; }
    await G.narrate('刘备拔从者所佩之剑，仰天祝曰——');
    await G.lines([['liubei', '若刘备能勾回荆州，成王霸之业，一剑挥石为两段；如死于此地，剑剁石不开。']]);
    G.audio.sfx('crit'); G.shake(5, 0.3);
    await G.narrate('手起剑落，火光迸溅，砍石为两段！');
    await G.lines([
      ['sunquan', '玄德公如何恨此石？'],
      ['liubei', '备年近五旬，不能为国家剿除贼党，心常自恨。今蒙国太招为女婿，此平生之际遇也。恰才问天买卦：如破曹兴汉，砍断此石——今果然如此。'],
      ['sunquan', '（暗想：刘备莫非用此言瞒我？）吾亦问天买卦：若破得曹贼，亦断此石。'],
    ]);
    G.audio.sfx('crit'); G.shake(5, 0.3);
    G.setFlag('c14_stone');
    await G.narrate('孙权也一剑砍下，巨石裂成十字。二人暗中所祝各不相同——孙权祝的，是"若再取得荆州，兴旺东吴"。');
    await weddingScene();
  }

  async function weddingScene() {
    await G.fadeOut(0.8);
    await G.narrate('数日后，吴侯府张灯结彩，大排筵席。');
    await G.narrate('当夜，刘备入洞房，只见房中枪刀森列，侍婢皆佩剑悬刀，立于两旁——');
    await G.fadeIn(0.6);
    await G.lines([
      ['liubei', '（失色）这……'],
      ['sunshangxiang', '厮杀半生，尚惧兵器乎？——撤去罢。'],
      ['sunshangxiang', '……妾虽女子，素慕英雄。玄德公不必惊疑。'],
    ]);
    await G.narrate('孙权从周瑜之计，为刘备大建府第，送美女、金玉、锦绣，欲以声色丧其心志。刘备果然被声色所迷，不想回荆州了。');
    await G.narrate('转眼年终。赵云打开了军师的第二个锦囊——');
    await G.lines([
      ['zhaoyun', '（慌忙入府）主公！今早孔明使人来报：曹操要报赤壁之恨，起精兵五十万，杀奔荆州，甚是危急，请主公便回！'],
      ['liubei', '……（入内，对夫人垂泪）'],
      ['sunshangxiang', '丈夫何故烦恼？'],
      ['liubei', '备欲归荆州，又恐夫人不肯；欲不去，又恐荆州有失，被天下人耻笑。'],
      ['sunshangxiang', '妾已事君，任君所之，妾当相随。——元旦拜贺国太时，推说往江边祭祖，便可不告而去。'],
    ]);
    const s = G.state;
    G.joinParty('sunshangxiang');
    s.members.sunshangxiang.armor = s.members.sunshangxiang.armor || 'jinsuo';
    G.world.refreshParty(); G.restoreAll();
    G.setFlag('c14_wed'); G.setFlag('c14_escape');
    G.audio.sfx('levelup');
    await G.notice('孙夫人 加入！\n（郡主带来了自己的金锁连环甲）\n从城东北的「北固」门出城，奔江岸刘郎浦。');
  }

  /* ---------------- 江岸 · 刘郎浦 ---------------- */
  B.c14road = () => {
    const m = new G.GameMap('c14road', '江 岸', 52, 24, TL.GRASS);
    Object.assign(m, { seed: 1421, music: 'field', pal: JN, ambient: 'clouds', flowers: 0.04, battleBg: 'field' });
    K.tallGrass(m, 1423, 0.58);
    m.rect(0, 0, 52, 6, TL.WATER);
    m.road([[0, 6.5], [20, 7.2], [36, 6.6], [52, 6.8]], 1.2, TL.WATER);
    m.road([[0, 15.5], [12, 15.5], [24, 14.5], [36, 14.5], [44, 12.5], [46, 9]], 0.8, TL.PATH);
    m.rect(44, 6, 3, 3, TL.BRIDGE);                         // 渡口栈桥
    K.ship(m, 42, 1, 8, 4, { dir: 'left', text: '刘', sail: '#e0d4b8' });
    K.ship(m, 30, 0, 7, 3, { dir: 'left', text: '刘', sail: '#e0d4b8', mh: 120 });
    m.rect(45, 5, 1, 1, TL.FLOOR);
    m.reserve(44, 5, 3, 5); m.reserve(0, 14, 3, 3);
    m.warp(0, 14, 1, 3, 'c14nanxu', 39, 3, 'down', () => false, '孙夫人：回去？追兵就在身后——走！');
    K.deco(m, 'sign', 11, 14, { text: '刘郎浦' });
    m.event({ type: 'inspect', x: 11, y: 14, w: 1, h: 1, run: () => G.narrate('路牌：东 · 刘郎浦渡口') });
    for (const [x, y] of [[6, 20], [18, 19], [30, 20], [40, 19], [48, 16]]) K.mountain(m, x, y);
    K.forest(m, { seed: 1431, thr: 0.66, kinds: ['tree', 'bamboo', 'peach', 'tree'] });
    m.npc({ id: 'tea14', spec: 'innkeeper', x: 22, y: 17, dir: 'up', talk: async () => {
      await say('innkeeper', '客官跑得一头汗，喝碗茶、歇歇脚再走吧！', { name: '茶棚老汉' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 'df14', spec: 'dingfeng', x: 15, y: 14, dir: 'left', aggro: true, cond: () => !G.flag('c14_df'), talk: blockScene });
    m.npc({ id: 'xs14', spec: 'xusheng', x: 15, y: 16, dir: 'left', aggro: true, cond: () => !G.flag('c14_df'), talk: blockScene });
    K.guard(m, { id: 'zb14', spec: 'wubing', x: 31, y: 14, dir: 'left', flag: 'c14_zhui', group: ['wubing2', 'wugong', 'wubing2'], intro: '东吴追兵赶到！', bg: 'field',
      cond: () => G.flag('c14_df'), lines: [['wubing', '奉吴侯之命，请郡主与刘备回去！']],
      after: async () => {
        await G.narrate('追兵刚退，陈武、潘璋又引五百军赶到——');
        await G.lines([['sunshangxiang', '你们两个，是要来杀我吗？我母亲在堂，便是我哥哥来，也须依礼而行！回去！', { name: '孙夫人' }]]);
        await G.narrate('二将面面相觑，只得退下。');
      } });
    m.npc({ id: 'kmzh14', spec: 'zhugeliang', x: 45, y: 9, dir: 'down', marker: () => true, talk: dockScene });
    m.npc({ id: 'hz14', spec: 'huangzhong', x: 43, y: 10, dir: 'right', talk: K.talk([['huangzhong', '主公！老黄忠在此恭候多时了！']]) });
    m.encounters = { rates: { [TL.GRASS]: 0.025, [TL.TALL]: 0.07, [TL.PATH]: 0.008 }, groups: [{ e: ['wubing2', 'wubing2'], w: 3 }, { e: ['wubing2', 'wugong'], w: 3 }, { e: ['wugong', 'wugong', 'wubing2'], w: 1 }] };
    return m;
  };

  async function blockScene() {
    if (G.flag('c14_df')) return;
    await G.lines([
      ['dingfeng', '刘备休走！我等奉周都督将令，在此等候多时！'],
      ['liubei', '（大惊）……子龙！'],
      ['zhaoyun', '主公勿慌！军师三个锦囊，已拆了两个，还有第三个在此——叫我于危急之时拆看。'],
    ]);
    await G.narrate('赵云拆开锦囊，献与刘备。刘备看罢，急来车前泣告夫人，说尽孙权、周瑜之谋。');
    await G.lines([
      ['sunshangxiang', '（叱车而出）徐盛、丁奉！你二人欲造反耶？'],
      ['xusheng', '安敢造反？我等奉周都督将令……'],
      ['sunshangxiang', '周瑜逆贼！我东吴不曾亏负你！玄德乃大汉皇叔，是我丈夫。我已对母亲、哥哥说知回荆州去——你两个在山脚去处，引着军马拦截道路，意欲劫掠我夫妻财物耶？'],
      ['dingfeng', '……（喏喏连声）不敢，不敢！'],
      ['sunshangxiang', '你们只怕周瑜，独不怕我？周瑜杀得你，我岂杀不得你？'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('徐盛、丁奉自思："我等是下人，安敢与夫人违拗？"只得喝退军士，放条大路叫过去了。');
    G.setFlag('c14_df');
  }

  async function dockScene() {
    if (!G.flag('c14_zhui')) { await say('zhugeliang', '主公一路辛苦。后面追兵未退，且先退了追兵再上船。'); return; }
    await G.lines([
      ['zhugeliang', '（羽扇轻摇）主公且喜，诸葛亮在此等候多时了。'],
      ['liubei', '军师！'],
    ]);
    await G.narrate('刘备与夫人方才上船，只见江面上战船蔽日，周瑜亲领水军，乘风赶来——');
    G.unstash(['zhugeliang', 'guanyu', 'huangzhong']);
    G.state.party = ['liubei', 'zhaoyun', 'sunshangxiang', 'zhugeliang', 'guanyu', 'huangzhong'].filter(id => G.state.party.includes(id));
    G.world.refreshParty();
    await G.lines([
      ['zhouyu', '刘备！今日哪里走！'],
      ['guanyu', '（从芦苇中杀出）关某奉军师将令，在此等候周郎多时！'],
      ['zhugeliang', '吾已算定多时。公瑾，请回吧。'],
    ]);
    const r = await G.battle(['zhouyu', 'wubing2', 'wugong', 'wubing2'], { bg: 'river', boss: true, intro: '东吴大都督 周瑜 亲自追来！' });
    if (r !== 'win') return;
    G.setFlag('c14_end');
    await G.narrate('周瑜大败而退。岸上荆州军士齐声大叫——');
    G.audio.sfx('gong');
    await G.narrate('"周郎妙计安天下，赔了夫人又折兵！"');
    await G.lines([
      ['zhouyu', '……可再登岸，决一死战！'],
    ]);
    await G.narrate('周瑜怒气填胸，大叫一声，金疮迸裂，倒于船上。众将急救，已不省人事。');
    await G.lines([
      ['sunshangxiang', '（回望江东）……哥哥，母亲，女儿去了。'],
      ['liubei', '夫人放心。刘备此生，定不负你。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[14].endLines);
  }

  // 试剑石调查点
  const baseNx = B.c14nanxu;
  B.c14nanxu = () => { const m = baseNx(); m.event({ type: 'inspect', x: 20, y: 12, w: 2, h: 2, run: stoneScene }); return m; };

  G.CHAPTERS[14] = {
    title: '甘露寺',
    prologue: [
      '刘备借了荆州，久不归还。',
      '恰逢刘备丧偶，周瑜便献一计：',
      '以孙权之妹为饵，假意招亲，把刘备骗到南徐软禁，换回荆州。',
      '诸葛亮却笑道："周瑜虽能用计，岂能出诸葛亮之料乎？"',
      '他交给赵云三个锦囊，嘱咐依次拆开……',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.unstash(BASE);
      G.stashParty(DUO);
      G.state.party = DUO.slice();
      G.restoreAll();
      const w = G.world;
      w.load('c14nanxu', 22, 30, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhaoyun', '主公，到南徐了。军师吩咐：一到南徐，先拆第一个锦囊。'],
        ['zhaoyun', '（拆开锦囊）……"令五百随行军士，披红挂彩，入城买办物件，传说玄德入赘东吴，使城中人尽知其事。再去拜见乔国老。"'],
        ['liubei', '乔国老……便是大乔、小乔之父？'],
      ]);
      await G.notice('第十四章：刘备与赵云二人行。\n去城东的乔府拜见乔国老。');
    },
    endLines: [
      '刘备携孙夫人回到荆州。',
      '周瑜一气再气，仍不死心，又献"假途灭虢"之计，',
      '被诸葛亮识破，三气之下，箭疮复发。',
      '临终仰天长叹："既生瑜，何生亮！"连叫数声而亡，年三十六岁。',
      '孔明亲往柴桑吊孝，回程途中，有一人拉住他的衣袖，大笑——',
      '"汝气死周郎，却又来吊孝，明欺东吴无人耶？"',
    ],
  };
})();
