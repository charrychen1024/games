/* ============================================================
 * 烽烟录 · 第二十二章　麦城（第五部完）
 * 襄樊退路（徐晃、荆州失陷、军心离散）→ 麦城（诸葛瑾劝降、夜走临沮、潘璋伏兵）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const XF = { gh: 70, gs: 24, gl: 24 };
  const SHOP = ['xuelian', 'tianxiang', 'yulu', 'xianlu', 'xuming', 'dayan', 'qingzhou', 'longwen'];
  const JZ = ['guanyu', 'guanping', 'zhoucang'];
  const GROUPS = [{ e: ['wubing4', 'wubing4'], w: 3 }, { e: ['wubing4', 'wugong4'], w: 3 }, { e: ['caobing8', 'caoshe8'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  /* ---------------- 襄樊退路 ---------------- */
  B.c22retreat = () => {
    const m = new G.GameMap('c22retreat', '荆 襄', 52, 42, TL.GRASS);
    Object.assign(m, { seed: 2201, music: 'field', ambient: 'leaves', leafColor: 'rgba(170,120,60,0.8)', pal: XF, battleBg: 'autumn', flowers: 0.02, tint: 'rgba(60,40,30,0.12)' });
    K.tallGrass(m, 2203, 0.55);
    m.road([[52, 20], [36, 22], [26, 20], [14, 24], [0, 22]], 1.3, TL.WATER);             // 汉水
    m.road([[26.5, 2], [26.5, 16], [24, 30], [12, 36], [4.5, 38]], 0.75, TL.PATH);       // 樊城 → 麦城
    m.road([[24, 30], [40, 34], [46.5, 36]], 0.75, TL.PATH);                            // → 江陵
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.WATER && x >= 24 && x <= 28) m.set(x, y, TL.BRIDGE);
    m.prop('townicon', 44, 32, 5, 4, { label: '江陵', foot: [44, 32, 5, 4] });
    m.prop('townicon', 1, 33, 4, 4, { label: '麦城', foot: [1, 33, 4, 4] });
    m.reserve(22, 1, 10, 6); m.reserve(4, 37, 2, 3); m.reserve(43, 36, 5, 2);
    K.tent(m, 21, 2, { red: true }); K.tent(m, 29, 2, { red: true });
    K.deco(m, 'flag', 25, 5, { text: '关', color: '#2a5a3a', tcol: '#f6e7c1' });
    m.npc({ id: 'rt22inn', spec: 'innkeeper', x: 24, y: 6, dir: 'right', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '君侯……营中还剩些粮草。', '军需官'); else if (k === 1) await G.shop(SHOP, '荆州军营');
    } });
    m.npc({ id: 'xh22', spec: 'xuhuang', x: 26, y: 9, dir: 'up', aggro: true, cond: () => !G.flag('c22_xu'), marker: () => true, talk: xuhuangScene });
    m.event({ type: 'step', x: 43, y: 36, w: 5, h: 2, run: jianglingScene });
    m.npc({ id: 'lm22', spec: 'lvmeng', x: 42, y: 34, dir: 'left', cond: () => G.flag('c22_xu') && !G.flag('c22_lv'), aggro: true, talk: jianglingScene });
    m.warp(4, 38, 2, 2, 'c22maicheng', 15, 33, 'up', () => G.flag('c22_lv'), '关平：父亲，江陵、公安情形未明，且先探个究竟。');
    K.deco(m, 'sign', 23, 31, { text: '岔路' });
    m.event({ type: 'inspect', x: 23, y: 31, w: 1, h: 1, run: () => G.narrate('路牌：东南 · 江陵　西南 · 麦城') });
    for (const [x, y] of [[4, 4], [12, 8], [40, 6], [46, 12], [6, 28], [16, 30], [34, 38], [40, 26]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2211, thr: 0.62, kinds: ['autumn', 'tree', 'autumn', 'dark'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.07, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function xuhuangScene() {
    if (G.flag('c22_xu')) return;
    await G.lines([
      ['xuhuang', '（于马上欠身）一别多年，不想君侯须发已苍白矣！忆昔壮年相从，多蒙教诲，感谢不忘。'],
      ['guanyu', '吾与公明交契深厚，非比他人。今何故数穷吾儿耶？'],
      ['xuhuang', '（回顾众将，厉声大叫）若取得云长首级者，重赏千金！'],
      ['guanyu', '（惊）公明何出此言？'],
      ['xuhuang', '今日乃国家之事，某不敢以私废公！'],
    ]);
    const r = await G.battle(['xuhuang3', 'caobing8', 'caoshe8'], { bg: 'autumn', boss: true, intro: '徐晃 · 偃城！' });
    if (r !== 'win') return;
    G.setFlag('c22_xu');
    await G.narrate('关公箭伤未痊，力战徐晃，樊城曹仁又引兵杀出。关公只得撤围，退过襄江。');
    await G.narrate('忽然流星马飞报——');
    await G.lines([
      ['guanping', '父亲！吕蒙令精兵扮作商人，白衣摇橹，偷渡浔阳江，袭了烽火台……荆州，已经失了！'],
      ['guanyu', '（大惊）……此是吕蒙诡计！吾当亲往取之！'],
    ]);
    await G.notice('荆州失守！\n东南去江陵，探个究竟。');
  }

  async function jianglingScene() {
    if (!G.flag('c22_xu')) { await G.narrate('江陵城上，仍是"关"字大旗。'); return; }
    if (G.flag('c22_lv')) { await G.narrate('江陵城上，已遍插东吴旗号。'); return; }
    await G.narrate('来到江陵城下，只见城上遍插东吴旗号。糜芳、傅士仁早已开城投降。');
    await G.lines([
      ['lvmeng', '（城上）关将军！你部下将士的家小，吕蒙都好生养着，秋毫无犯。'],
      ['guanyu', '吕蒙！汝这白衣鼠辈——'],
    ]);
    const r = await G.battle(['wubing4', 'wugong4', 'wubing4'], { bg: 'autumn', intro: '东吴守军冲出！' });
    if (r !== 'win') return;
    G.setFlag('c22_lv');
    await G.narrate('吕蒙不战，只让荆州将士的家人在城上呼喊。军士听得家中平安，个个无心恋战，沿路逃散。');
    await G.narrate('关公回顾，只剩三百余人。');
    await G.lines([
      ['guanping', '父亲……附近只有麦城，可暂且屯扎。'],
      ['guanyu', '……吾欲上不能达天，下不能入地——走麦城。'],
    ]);
    await G.notice('前往西南的麦城。');
  }

  /* ---------------- 麦城 ---------------- */
  B.c22maicheng = () => {
    const m = new G.GameMap('c22maicheng', '麦 城', 32, 38, TL.GRASS);
    Object.assign(m, { seed: 2221, music: 'boss', ambient: 'leaves', leafColor: 'rgba(120,90,60,0.8)', pal: { gh: 60, gs: 18, gl: 20 }, battleBg: 'gorge', flowers: 0, dusk: true });
    K.walls(m, 4, 22, 27, 37, [{ side: 'n', x: 14, plaque: '麦城' }, { side: 's', x: 14, plaque: '' }]);
    m.road([[15.5, 38], [15.5, 24]], 0.8, TL.PATH);
    m.road([[15.5, 22], [14, 16], [17, 10], [15.5, 3]], 0.7, TL.PATH);                  // 北门外小路 · 临沮
    m.prop('house', 6, 25, 6, 4, { roof: '#3a3430', lantern: false });
    m.prop('house', 20, 25, 6, 4, { roof: '#3a3430', lantern: false });
    for (const [x, y] of [[8, 31], [22, 31], [12, 24], [19, 24]]) K.deco(m, 'fire', x, y, { light: 150 });
    K.deco(m, 'flag', 13, 33, { text: '关', color: '#2a5a3a', tcol: '#f6e7c1' });
    m.prop('stele', 18, 4, 1, 1, { text: '临沮', foot: [18, 4, 1, 1] });
    m.reserve(14, 32, 3, 6); m.reserve(13, 2, 5, 3);
    for (const [x, y] of [[2, 14], [22, 14], [3, 4], [24, 4], [8, 9], [21, 18]]) K.mountain(m, x, y, 1);
    K.forest(m, { seed: 2225, thr: 0.55, kinds: ['dark', 'pine', 'dark'], avoid: 1 });
    m.warp(14, 36, 3, 2, 'c22maicheng', 15, 33, 'up', () => false, '城外尽是吴兵。');
    m.npc({ id: 'wf22', spec: 'chendeng', x: 18, y: 31, dir: 'left', cond: () => !G.flag('c22_out'), marker: () => G.flag('c22_jin') && !G.flag('c22_out'), talk: breakoutTalk });
    m.npc({ id: 'zgj22', spec: 'wuru', x: 15, y: 27, dir: 'down', cond: () => !G.flag('c22_jin'), marker: () => true, talk: jinScene });
    m.npc({ id: 'mc22inn', spec: 'innkeeper', x: 10, y: 33, dir: 'right', cond: () => !G.flag('c22_out'), talk: () => restAndSave('innkeeper', '君侯……城中只剩这点粮了，您先吃。', '老卒') });
    m.npc({ id: 'zc22', spec: 'zhoucang', x: 17, y: 29, dir: 'down', cond: () => G.flag('c22_out'), talk: K.talk([['zhoucang', '君侯放心去！周仓在，麦城在！']]) });
    m.event({ type: 'step', x: 13, y: 7, w: 5, h: 3, run: ambushScene });
    m.npc({ id: 'pz22', spec: 'panzhang', x: 15, y: 6, dir: 'down', aggro: true, cond: () => G.flag('c22_out') && !G.flag('c22_end'), talk: ambushScene });
    return m;
  };

  async function jinScene() {
    await G.narrate('廖化突围往上庸求救，刘封、孟达却托辞不发一兵。孙权又遣诸葛瑾入城劝降——');
    await G.lines([
      ['wuru', '今吴侯欲结秦晋之好，同力破曹，共扶汉室。将军何不从吾之言，归降吴侯？', { name: '诸葛瑾' }],
      ['guanyu', '吾乃解良一武夫，蒙吾主以手足相待，安肯背义投敌国乎？'],
      ['guanyu', '城若破，有死而已。玉可碎而不可改其白，竹可焚而不可毁其节。身虽殒，名可垂于竹帛也！'],
      ['wuru', '……', { name: '诸葛瑾' }],
      ['guanyu', '汝勿多言，速请出城——吾欲与孙权决一死战！'],
    ]);
    G.setFlag('c22_jin');
    await G.notice('与王甫商议对策。');
  }

  async function breakoutTalk() {
    if (!G.flag('c22_jin')) { await say('chendeng', '君侯，城中粮草，只够数日了……', { name: '王甫' }); return; }
    await G.lines([
      ['chendeng', '君侯……北门外有一条小路，山势险峻，可通西川。只是小路恐有埋伏，不如走大路。', { name: '王甫' }],
      ['guanyu', '虽有埋伏，吾何惧哉！'],
      ['chendeng', '（泣）君侯于路，小心保重！某与周仓，引百余人死守此城。城虽破，身不降也——专望君侯速来救援！', { name: '王甫' }],
      ['zhoucang', '君侯……周仓不能给您扛刀了。您……您一定要回来！'],
      ['guanyu', '（凝视周仓良久）……好兄弟。'],
    ]);
    G.setFlag('c22_out');
    G.leaveParty('zhoucang');
    G.world.refreshParty(); G.restoreAll();
    await G.notice('周仓留守麦城。\n关羽、关平趁夜出北门，走小路往西川。');
  }

  async function ambushScene() {
    if (!G.flag('c22_out') || G.flag('c22_end')) return;
    await G.narrate('初更时分，关公率十余骑出北门，行至临沮——山凹之中，金鼓齐鸣，喊声大震。');
    await G.lines([
      ['panzhang', '关公休走！潘璋在此等候多时了！'],
      ['guanyu', '（大怒，拍马舞刀）——！'],
    ]);
    const r = await G.battle(['panzhang', 'wubing4', 'wugong4'], { bg: 'gorge', boss: true, intro: '临沮 · 潘璋伏兵！' });
    if (r !== 'win') return;
    G.setFlag('c22_end');
    await G.narrate('潘璋败走。关公且战且走，行不得四五里，前面喊声又起——两下伏兵，长钩套索，一齐并举。');
    G.audio.sfx('down'); G.shake(8, 0.8);
    await G.narrate('先把关公坐下马绊倒。关公翻身落马，被潘璋部将马忠所获。关平知父被擒，火速来救，背后潘璋、朱然率兵齐至，把关平四下围住。孤身独战，力尽亦被执。');
    await G.fadeOut(1.5);
    await G.narrate('至天明，孙权闻关公父子已被擒获，大喜，聚众将于帐中。');
    await G.lines([
      ['sunquan', '孤久慕将军盛德，欲结秦晋之好，何相弃耶？公平昔自以为天下无敌，今日何由被吾所擒？将军今日还服孙权否？'],
      ['guanyu', '（厉声骂曰）碧眼小儿，紫髯鼠辈！吾与刘皇叔桃园结义，誓扶汉室，岂与汝叛汉之贼为伍耶！'],
      ['guanyu', '我今误中奸计，有死而已，何必多言！'],
    ]);
    await G.narrate('建安二十四年冬十二月，关公父子皆遇害，时公年五十八岁。');
    await G.narrate('关公既殁，坐下赤兔马被马忠所获，献与孙权。权即赐马忠骑坐。其马数日不食草料而死。');
    await G.narrate('王甫在麦城，骨颤肉惊。周仓闻关公父子之首已至，大叫一声，堕城而死；王甫亦自刎于城上。');
    G.setParty(['liubei', 'zhangfei', 'zhaoyun', 'zhugeliang', 'huangzhong', 'machao']);
    G.leaveParty('guanyu'); G.leaveParty('guanping'); G.leaveParty('zhoucang');
    G.world.refreshParty();
    await G.narrate('关公一魂不散，荡荡悠悠，直至荆门州当阳县一座山上，名为玉泉山——');
    await G.narrate('那夜，山中有一老僧普净，月白风清之下，只听空中有人大呼："还我头来！"');
    await G.lines([
      ['monk', '（仰面谓曰）云长安在？昔非将军，五关之下，老僧何能相救？今将军为吕蒙所害，大呼"还我头来"——然则颜良、文丑、五关六将等众人之头，又将向谁索耶？'],
    ]);
    await G.narrate('于是关公恍然大悟，稽首皈依而去。后往往于玉泉山显圣护民，乡人感其德，就于山顶上建庙，四时致祭。');
    await G.fadeIn(1.0);
    await G.lines([
      ['liubei', '（成都宫中，夜不能寐，忽觉神思昏迷，伏几而卧）……云长？'],
      ['liubei', '二弟……你为何满身是血，立在灯影之下……'],
      ['liubei', '二弟！——'],
    ]);
    await G.notice('关羽、关平、周仓 离开了队伍。\n（他们的护甲放回了行囊）');
    await G.chapterEnd(G.CHAPTERS[22].endLines);
  }

  G.CHAPTERS[22] = {
    title: '麦城',
    prologue: [
      '关羽调荆州之兵北上，后方空虚。',
      '吕蒙白衣渡江，一夜之间，烽火台尽失。',
      '而樊城之下，曹操派来的第二支援军，',
      '由关羽的同乡旧友——徐晃统领。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.setParty(JZ);
      G.restoreAll();
      const w = G.world;
      w.load('c22retreat', 26, 4, 'down');
      await G.fadeIn(1.2);
      await G.lines([
        ['guanping', '父亲，徐晃领兵来救樊城，已到偃城了。'],
        ['guanyu', '公明？……吾与他交情不浅。待吾亲去会他。'],
      ]);
      await G.notice('南下迎战徐晃。');
    },
    endLines: [
      '刘备闻关羽死讯，哭倒于地，三日水米不进。',
      '"孤与关、张二弟桃园结义时，誓同生死。今云长已亡，孤岂能独享富贵乎！"',
      '次年，曹操病逝洛阳，曹丕篡汉称帝。',
      '刘备在成都即皇帝位，国号仍为"汉"，史称蜀汉。',
      '登基之后，他做的第一件事，便是起倾国之兵，伐吴报仇……',
      '（第五部　完）',
    ],
  };
})();
