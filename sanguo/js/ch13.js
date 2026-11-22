/* ============================================================
 * 烽烟录 · 第十三章　荆南（第三部完）
 * 荆南大地（零陵·邢道荣 → 桂阳·赵云取城）→ 长沙（关羽战黄忠、魏延反韩玄、黄忠归降）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SOUTH = { gh: 104, gs: 40, gl: 28 };
  const GROUPS = [{ e: ['jingbing', 'jingbing'], w: 3 }, { e: ['jingbing', 'jinggong'], w: 3 }, { e: ['shanman', 'shanman'], w: 2 }, { e: ['jinggong', 'jinggong', 'jingbing'], w: 1 }];
  const ALL = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'jianyong', 'zhugeliang'];
  const SHOP = ['dahuan', 'shenghui', 'qiongjiang', 'tianzhong', 'xuming', 'jingliang', 'quanjun', 'jinsuo'];
  const backToAll = () => { G.unstash(ALL); G.state.party = ALL.filter(id => G.state.party.includes(id)); G.world.refreshParty(); };

  /* ---------------- 荆南大地 ---------------- */
  B.c13world = () => {
    const m = new G.GameMap('c13world', '荆 南', 60, 44, TL.GRASS);
    Object.assign(m, { seed: 1301, music: 'field', ambient: 'clouds', pal: SOUTH, battleBg: 'field', flowers: 0.07 });
    K.tallGrass(m, 1303, 0.56);
    m.road([[60, 5], [48, 8], [40, 6], [30, 10], [24, 8], [14, 12], [0, 11]], 1.3, TL.WATER);   // 湘水
    m.road([[29.5, 38], [29.5, 28], [12, 24], [10.5, 21]], 0.75, TL.PATH);
    m.road([[29.5, 28], [46, 26], [48.5, 23]], 0.75, TL.PATH);
    m.road([[29.5, 28], [30, 18], [31.5, 6], [31.5, 4]], 0.75, TL.PATH);
    for (let y = 0; y < m.h; y++) for (let x = 29; x <= 33; x++) if (m.get(x, y) === TL.WATER) m.set(x, y, TL.BRIDGE);
    m.prop('townicon', 9, 18, 4, 3, { label: '零陵', foot: [9, 18, 4, 3] });
    m.prop('townicon', 47, 20, 4, 3, { label: '桂阳', foot: [47, 20, 4, 3] });
    m.prop('townicon', 30, 1, 4, 3, { label: '长沙', foot: [30, 1, 4, 3] });
    m.reserve(28, 36, 4, 4); m.reserve(10, 21, 2, 1); m.reserve(48, 23, 2, 1); m.reserve(31, 4, 2, 1);
    m.road([[29.5, 38], [29.5, 40]], 0.75, TL.PATH);
    K.tent(m, 23, 36, { big: true, w: 5, h: 4, red: true, sign: '刘' });
    K.tent(m, 33, 37, { red: true });
    K.deco(m, 'flag', 27, 39, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.npc({ id: 'jy13', spec: 'jianyong', x: 28, y: 38, dir: 'right', talk: campMenu });
    m.event({ type: 'step', x: 10, y: 21, w: 2, h: 1, run: linglingScene });
    m.event({ type: 'step', x: 48, y: 23, w: 2, h: 1, run: guiyangScene });
    m.warp(31, 4, 2, 1, 'c13changsha', 17, 30, 'up', () => G.flag('c13_gy'), '军师：长沙韩玄手下有一员老将黄忠，非同小可。且先取零陵、桂阳。');
    for (let x = 0; x < 58; x += 3) K.mountain(m, x, 41);
    for (const [x, y] of [[4, 28], [8, 33], [18, 34], [40, 34], [50, 32], [54, 14], [20, 16], [40, 14], [6, 4], [16, 3], [46, 2]]) K.mountain(m, x, y);
    K.deco(m, 'sign', 27, 28, { text: '荆南' });
    m.event({ type: 'inspect', x: 27, y: 28, w: 1, h: 1, run: () => G.narrate('路牌：西 · 零陵　东 · 桂阳　北 · 长沙') });
    K.forest(m, { seed: 1311, thr: 0.62, kinds: ['tree', 'bamboo', 'tree', 'dark'] });
    m.npc({ id: 'xdr', spec: 'xingdaorong', x: 11, y: 22, dir: 'down', aggro: true, cond: () => !G.flag('c13_ll'), talk: linglingScene });
    m.npc({ id: 'cy13', spec: 'chenying', x: 49, y: 24, dir: 'down', aggro: true, cond: () => G.flag('c13_ll') && !G.flag('c13_gy'), talk: guiyangScene });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function campMenu() {
    await say('jianyong', '回营歇歇吧，粮草军资都备好了。');
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) { await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5); const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu(); }
    else if (k === 1) await G.shop(SHOP, '荆州军需');
  }

  async function linglingScene() {
    if (G.flag('c13_ll')) { await G.narrate('零陵已降。太守刘度之子刘贤，随军听用。'); return; }
    await G.lines([
      ['xingdaorong', '吾乃零陵上将邢道荣！手中开山大斧，有万夫不当之勇！'],
      ['xingdaorong', '反国逆贼，安敢犯我境界！'],
      ['zhugeliang', '（羽扇纶巾，坐于四轮车上，大笑）吾乃南阳诸葛孔明也。曹操引百万之众，被吾聊施小计，杀得片甲不回——汝等岂堪与我对敌？'],
      ['xingdaorong', '赤壁鏖兵，乃周郎之谋也，干汝何事，敢来诳语！'],
      ['zhangfei', '军师，这厮聒噪得紧，交给俺老张！'],
    ]);
    const r = await G.battle(['xingdaorong', 'jingbing', 'jinggong'], { bg: 'field', boss: true, intro: '零陵上将 邢道荣！' });
    if (r !== 'win') return;
    G.setFlag('c13_ll');
    await G.narrate('邢道荣被赵云一枪刺于马下，太守刘度开城投降。');
    await G.lines([
      ['zhugeliang', '零陵已定。下一处，桂阳。'],
      ['zhaoyun', '军师，子龙愿往！只带三千军马，必取桂阳！'],
      ['zhugeliang', '子龙既要去，须立军令状。'],
      ['zhaoyun', '愿立！'],
    ]);
    await G.notice('零陵归降！\n东去桂阳——由赵云单独出战。');
  }

  async function guiyangScene() {
    if (G.flag('c13_gy')) { await G.narrate('桂阳已降。'); return; }
    if (!G.flag('c13_ll')) { await G.narrate('军师有令：先取零陵。'); return; }
    G.stashParty(['zhaoyun']); G.world.refreshParty();
    await G.lines([
      ['chenying', '桂阳管军校尉陈应在此！我主赵范与刘备无仇，何故相侵？'],
      ['zhaoyun', '吾主刘玄德，乃刘景升之弟，今辅公子刘琦同领荆州，特来抚民。汝何敢迎敌！'],
      ['chenying', '我等只服曹丞相，岂顺刘备！看叉！'],
    ]);
    const r = await G.battle(['chenying'], { bg: 'field', boss: true, party: ['zhaoyun'], intro: '桂阳校尉 陈应 飞叉来战！' });
    if (r !== 'win') { backToAll(); return; }
    G.setFlag('c13_gy');
    await G.narrate('赵云生擒陈应，桂阳太守赵范出城纳降，设宴款待，与赵云结为兄弟——');
    await G.lines([
      ['zhaofan', '将军，我有一位寡嫂樊氏，倾国倾城。家兄已故三年，嫂嫂常言："若得文武双全、名闻天下、相貌堂堂之人，方肯再嫁。"——将军岂非正是此人？'],
      ['fanshi', '……', { name: '樊氏' }],
    ]);
    G.audio.sfx('gong');
    await G.lines([
      ['zhaoyun', '吾既与汝结为兄弟，汝嫂即吾嫂也，岂可作此乱人伦之事乎！'],
      ['zhaoyun', '况且天下女子不少，但恐名誉不立，何患无妻子乎？'],
    ]);
    await G.narrate('赵云一拳打倒赵范，径出城去。赵范见计不成，只得开城投降。');
    await G.narrate('后来刘备问起，赵云说："赵范既与某结为兄弟，今若娶其嫂，惹人唾骂；其妇再嫁，便失大节；赵范初降，其心难测。主公新定江汉，枕席未安，云安敢以一妇人而废主公之大事？"');
    backToAll();
    await G.notice('桂阳归降！\n张飞也取下了武陵。只剩北面的长沙。');
  }

  /* ---------------- 长沙 ---------------- */
  B.c13changsha = () => {
    const m = new G.GameMap('c13changsha', '长 沙', 36, 34, TL.GRASS);
    Object.assign(m, { seed: 1331, music: 'camp', pal: SOUTH, battleBg: 'city', ambient: 'leaves', flowers: 0.04 });
    K.walls(m, 0, 0, 35, 13, [{ side: 's', x: 16, plaque: '长沙' }]);
    m.road([[17.5, 34], [17.5, 12]], 1, TL.PATH);
    m.road([[17.5, 7], [17.5, 2]], 0.6, TL.PATH);
    m.prop('hall', 12, 2, 11, 6, { sign: '太守府', roof: '#4a3a2a' });
    m.prop('house', 3, 4, 6, 5, { roof: '#45403a', lantern: false });
    m.prop('house', 27, 4, 6, 5, { roof: '#4a3b36', sign: '黄宅' });
    for (const [x, y] of [[14, 12], [21, 12]]) K.deco(m, 'flag', x, y, { text: '韩', color: '#5a4a2a', tcol: '#f6e7c1' });
    // 城外：两军阵前
    m.rect(8, 18, 20, 10, TL.SOIL);
    K.tent(m, 3, 26, { red: true }); K.tent(m, 28, 26, { red: true });
    K.deco(m, 'flag', 9, 28, { text: '关', color: '#2a5a3a', tcol: '#f6e7c1' }); K.deco(m, 'flag', 26, 28, { text: '关', color: '#2a5a3a', tcol: '#f6e7c1' });
    K.deco(m, 'rack', 12, 27); K.deco(m, 'fire', 23, 27);
    m.warp(16, 33, 3, 1, 'c13world', 31, 5, 'down', () => G.flag('c13_end'), '关羽：黄忠未降，关某岂能空手而回！');
    m.reserve(16, 30, 3, 4);
    K.innerTrees(m, 1, 2, 34, 11, 1337, 0.4);
    K.forest(m, { seed: 1335, thr: 0.72, kinds: ['tree', 'bamboo'] });
    m.npc({ id: 'hz13', spec: 'huangzhong', x: 17, y: 16, dir: 'down', aggro: true, cond: () => !G.flag('c13_duel'), talk: duelScene });
    m.npc({ id: 'hz13b', spec: 'huangzhong', x: 17, y: 14, dir: 'down', cond: () => G.flag('c13_duel') && !G.flag('c13_end'), marker: () => true, talk: secondDay });
    m.npc({ id: 'hx13', spec: 'hanxuan', x: 17, y: 9, dir: 'down', cond: () => !G.flag('c13_end'), talk: K.talk([['hanxuan', '黄忠！你与关羽斗了一百合，为何不胜？莫非有私心？', { name: '韩玄' }]]) });
    m.npc({ id: 'hzinn', spec: 'innkeeper', x: 5, y: 28, dir: 'right', talk: async () => {
      await say('innkeeper', '二将军，营中歇息片刻吧。', { name: '校刀手' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 'zc13', spec: 'zhoucang', x: 20, y: 29, dir: 'up', talk: K.talk([['zhoucang', '那老将军须发皆白，刀法却一点不含糊！将军小心！']]) });
    m.onEnter = async () => {
      if (G.flag('c13_cs')) return; G.setFlag('c13_cs');
      G.stashParty(['guanyu']); G.world.refreshParty();
      await G.lines([
        ['guanyu', '子龙取桂阳，翼德取武陵，都是三千军马。关某此去长沙，只带本部五百校刀手——'],
        ['guanyu', '定斩黄忠、韩玄之首，献来麾下！'],
      ]);
      await G.notice('本章最后一战，关羽单独出战。');
    };
    return m;
  };

  async function duelScene() {
    await G.lines([
      ['huangzhong', '来将莫非关云长？'],
      ['guanyu', '既知我名，焉敢犯我境？'],
      ['huangzhong', '特来取你首级！'],
      ['guanyu', '……老将军须发如雪，何不归降？'],
      ['huangzhong', '某年近六旬，开二石之弓，百发百中——你休欺我老！'],
    ]);
    const r = await G.battle(['huangzhong'], { bg: 'city', boss: true, party: ['guanyu'], intro: '长沙老将 黄忠！' });
    if (r !== 'win') return;
    G.setFlag('c13_duel');
    await G.lines([
      ['guanyu', '（暗想）老将黄忠，名不虚传。斗一百合，全无破绽……'],
      ['huangzhong', '（暗想）关公不杀之恩……我怎能忍心射他？可若是不射，又违了主将之令……'],
    ]);
    await G.notice('黄忠收兵回城。\n来日再战——去城门前找黄忠。');
  }

  async function secondDay() {
    await G.narrate('次日，黄忠出城，与关羽又斗五六十合，拨马佯败。关羽追来——');
    await G.narrate('黄忠虚拽弓弦，关羽急闪，却不见箭；黄忠又虚拽一下，关羽又闪，又无箭。');
    await G.narrate('关羽只道黄忠不会射，放心赶来。将近吊桥，黄忠在桥上搭箭开弓，弦响箭到——');
    G.audio.sfx('crit'); G.shake(6, 0.4);
    await G.narrate('正射在关羽盔缨根上！');
    await G.lines([
      ['guanyu', '……黄汉升百步穿杨，今日只射我盔缨，正是报我昨日不杀之恩！'],
    ]);
    await G.narrate('黄忠回到城上，韩玄大怒——');
    await G.lines([
      ['hanxuan', '我看你三日之间，是何主意？你前日不力战，必有私心；昨日马失，他不杀你，必有关通；今日两番虚拽弓弦，第三箭却只射他盔缨——如何不是外通内连？若不斩汝，必为后患！', { name: '韩玄' }],
      ['hanxuan', '刀斧手！推出城门外斩首！', { name: '韩玄' }],
    ]);
    G.audio.sfx('gong'); G.shake(10, 0.8);
    await G.narrate('刀斧手刚举刀，忽一将挥刀杀入，砍死刀手，救起黄忠——');
    await G.lines([
      ['weiyan', '黄汉升乃长沙之保障，今杀汉升，是杀长沙百姓也！韩玄残暴不仁，轻贤慢士，当众共殛之！愿随我者便来！', { name: '魏延' }],
    ]);
    const r = await G.battle(['jingbing', 'jinggong', 'jingbing'], { bg: 'city', party: ['guanyu'], intro: '韩玄亲兵拦住城门！' });
    if (r !== 'win') return;
    await G.narrate('魏延直杀上城头，一刀砍韩玄为两段，提头开城，投降关羽。');
    G.setFlag('c13_end');
    await G.fadeOut(1.0);
    backToAll();
    await G.narrate('数日后，刘备亲至长沙。黄忠托病不出，刘备亲往其家相请，黄忠方出降，求葬韩玄尸首于长沙之东。');
    await G.fadeIn(0.8);
    await G.lines([
      ['huangzhong', '黄忠一介老卒，蒙皇叔不弃——这把老骨头，从今往后，便交给皇叔了！'],
      ['liubei', '老将军之勇，天下皆知。得汉升，如得一臂！'],
      ['zhugeliang', '（看魏延）……此人脑后有反骨，久后必反。'],
      ['liubei', '若斩此人，恐降者人人自危。望军师饶之。'],
      ['zhugeliang', '……魏延，吾今饶汝性命，汝可尽忠报主，勿生异心。'],
      ['jianyong', '玄德，荆州新附，百事待理。我便留在江陵，替你看家吧。'],
    ]);
    // 黄忠入队，简雍留守荆州
    const s = G.state;
    s.party = s.party.filter(id => id !== 'jianyong'); s.stash = (s.stash || []).concat(['jianyong']);
    G.joinParty('huangzhong');
    G.state.members.huangzhong.armor = G.state.members.jianyong.armor || null;
    G.world.refreshParty(); G.restoreAll();
    G.audio.sfx('levelup');
    await G.notice('黄忠 加入！\n简雍留守荆州。');
    await G.chapterEnd(G.CHAPTERS[13].endLines);
  }

  G.CHAPTERS[13] = {
    title: '荆南',
    prologue: [
      '赤壁战后，周瑜与曹仁血战南郡，身中毒箭。',
      '诸葛亮却趁虚袭取南郡、荆州、襄阳，',
      '气得周瑜大叫一声，金疮迸裂。',
      '刘备终于有了一块立足之地。',
      '荆州以南，还有四郡未定。',
    ],
    start: async () => {
      G.unstash(ALL);
      G.state.party = ALL.filter(id => G.state.party.includes(id));
      G.restoreAll();
      const w = G.world;
      w.load('c13world', 30, 37, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhugeliang', '荆南四郡：零陵、桂阳、武陵、长沙。零陵最近，先取零陵。'],
        ['liubei', '只是不可滥杀，要以仁义抚民。'],
      ]);
      await G.notice('向西前往零陵。\n营地可以休整、补给和记录进度。');
    },
    endLines: [
      '荆南四郡尽归刘备。老将黄忠、猛将魏延，皆入麾下。',
      '刘备以公子刘琦为荆州刺史，自领荆州牧。',
      '然而周瑜岂肯善罢甘休？东吴屡次索要荆州，',
      '一场"借荆州"的风波，已在暗中酝酿。',
      '而在遥远的西川，刘璋暗弱，张松怀揣一幅地图，正在寻找明主……',
      '（第三部　完）',
    ],
  };
})();
