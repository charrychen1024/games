/* ============================================================
 * 烽烟录 · 第二十四章　白帝城
 * 夷陵（火烧连营、赵云救驾、朱然、陆逊追兵、八阵图）→ 白帝城永安宫（托孤）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SHOP = ['tianxiang', 'huixin', 'xianlu', 'yuquan', 'xuming', 'qingzhou', 'longwen', 'wuxing'];
  const ESC = ['liubei', 'guanxing', 'zhangbao2'];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  /* ---------------- 夷陵 · 七百里连营 ---------------- */
  B.c24lianying = () => {
    const m = new G.GameMap('c24lianying', '夷 陵', 54, 30, TL.GRASS);
    Object.assign(m, { seed: 2401, music: 'boss', ambient: 'embers', dusk: true, battleBg: 'yiling', flowers: 0, pal: { gh: 40, gs: 26, gl: 20 } });
    m.road([[54, 15.5], [40, 14], [28, 16], [16, 14], [4, 15], [0, 15]], 0.85, TL.PATH);
    for (let i = 0; i < 9; i++) { const x = 44 - i * 5, y = i % 2 ? 9 : 19; K.tent(m, x, y, { red: true, burnt: true }); }
    for (let i = 0; i < 26; i++) { const x = 3 + Math.floor(G.hash(i, 3, 24) * 48), y = 3 + Math.floor(G.hash(i, 5, 24) * 24); K.deco(m, 'fire', x, y, { light: 130 }); }
    K.deco(m, 'sign', 6, 13, { text: '马鞍山' });
    m.reserve(0, 13, 4, 5); m.reserve(50, 13, 4, 5);
    K.forest(m, { seed: 2405, thr: 0.52, kinds: ['dark', 'pine', 'dark'] });
    m.warp(0, 13, 1, 5, 'c24baidi', 17, 26, 'up', () => G.flag('c24_lu'), '后面追兵将至，前面却有吴军拦路！');
    m.warp(53, 13, 1, 5, 'c24lianying', 50, 15, 'left', () => false, '东边已是一片火海！');
    K.guard(m, { id: 'fire24', spec: 'wubing', x: 38, y: 14, dir: 'right', flag: 'c24_a', group: ['wubing6', 'wubing6', 'wugong5'], intro: '吴军举火杀来！', bg: 'yiling',
      lines: [['wubing', '陆都督有令：每人带茅草一把，内藏硫磺焰硝——见蜀寨便烧！', { name: '吴军校尉' }]] });
    m.npc({ id: 'zr24', spec: 'zhuran', x: 22, y: 15, dir: 'right', aggro: true, cond: () => G.flag('c24_a') && !G.flag('c24_zr'), marker: () => true, talk: zhuranScene });
    m.npc({ id: 'lx24', spec: 'luxun', x: 9, y: 15, dir: 'right', aggro: true, cond: () => G.flag('c24_zr') && !G.flag('c24_lu'), marker: () => true, talk: luxunScene });
    m.npc({ id: 'ly24inn', spec: 'innkeeper', x: 47, y: 13, dir: 'down', talk: () => restAndSave('innkeeper', '陛下！快歇口气，然后快走！', '御营亲兵') });
    m.onEnter = async () => {
      if (G.flag('c24_in')) return; G.setFlag('c24_in');
      await G.narrate('六月盛暑，蜀军移营于山林茂盛之地，连营七百里。');
      await G.narrate('是夜东南风大作。只见御营左屯火起；方欲救时，御营右屯又火起。风紧火急，树木皆着，喊声大震——');
      G.audio.sfx('fire'); G.shake(8, 1.0);
      await G.lines([
        ['liubei', '（惊起，出帐）……火！到处都是火！'],
        ['guanxing', '陛下！四十余屯尽皆火起！快上马！'],
      ]);
      await G.notice('火烧连营！\n向西突围，退往马鞍山、白帝城。');
    };
    return m;
  };

  async function zhuranScene() {
    if (G.flag('c24_zr')) return;
    await G.lines([
      ['zhuran', '刘备！朱然在此等候多时了！'],
      ['liubei', '（回顾左右，只剩百余人）……天亡我也！'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('忽然江边一彪军杀来，为首大将，白袍银铠，正是赵云！');
    G.unstash(['zhaoyun']); G.catchUp(['zhaoyun']);
    G.state.party = ['liubei', 'zhaoyun', 'guanxing', 'zhangbao2'].filter(id => G.state.party.includes(id));
    G.world.refreshParty(); G.restoreAll();
    await G.lines([
      ['zhaoyun', '陛下勿忧！赵云来也！'],
      ['liubei', '子龙……！'],
    ]);
    const r = await G.battle(['zhuran', 'wubing6', 'wugong5'], { bg: 'yiling', boss: true, intro: '赵云救驾 · 朱然！' });
    if (r !== 'win') return;
    G.setFlag('c24_zr');
    await G.notice('赵云 归队！\n继续向西突围——陆逊亲自追来了！');
  }

  async function luxunScene() {
    if (G.flag('c24_lu')) return;
    await G.lines([
      ['luxun', '（白衣羽扇，立马阵前）陛下，陆逊在此恭候。'],
      ['liubei', '……朕早年纵横天下，今日竟败于孺子之手！'],
      ['zhaoyun', '陛下先走！赵云断后！'],
    ]);
    const r = await G.battle(['luxun', 'wubing6', 'wubing6', 'wugong5'], { bg: 'yiling', boss: true, intro: '东吴大都督 陆逊！' });
    if (r !== 'win') return;
    G.setFlag('c24_lu');
    await G.narrate('陆逊追至鱼腹浦，只见江边乱石八九十堆，并无人马，却有一股杀气冲天而起——');
    await G.narrate('陆逊引数十骑入石阵观看。忽然狂风大作，飞沙走石，遮天盖地。但见怪石嵯峨，槎枒似剑；横沙立土，重叠如山；江声浪涌，有如剑鼓之声。');
    await G.lines([
      ['luxun', '吾中诸葛之计也！'],
      ['huangchengyan', '（拄杖而来）老夫乃诸葛孔明之岳父黄承彦也。昔小婿入川之时，于此布下石阵，名"八阵图"。反复八门，按遁甲休、生、伤、杜、景、死、惊、开——每日每时，变化无端，可比十万精兵。将军勿惊，老夫引将军出去。'],
      ['luxun', '……孔明真"卧龙"也！吾不能及！'],
    ]);
    await G.narrate('陆逊下令班师。刘备退入白帝城。');
    await G.notice('退往西边的白帝城。');
  }

  /* ---------------- 白帝城 · 永安宫 ---------------- */
  B.c24baidi = () => {
    const m = new G.GameMap('c24baidi', '白 帝 城', 36, 30, TL.GRASS);
    Object.assign(m, { seed: 2421, music: 'title', ambient: 'leaves', leafColor: 'rgba(170,150,110,0.7)', pal: { gh: 90, gs: 18, gl: 26 }, flowers: 0.02, tint: 'rgba(40,40,60,0.14)', battleBg: 'shu' });
    K.walls(m, 2, 0, 33, 24, [{ side: 's', x: 16, plaque: '白帝' }]);
    m.road([[17.5, 30], [17.5, 8]], 1, TL.PATH);
    m.rect(11, 8, 13, 5, TL.FLOOR);
    m.prop('hall', 12, 2, 11, 6, { sign: '永安宫', roof: '#2a2a3a' });
    m.prop('house', 4, 4, 6, 5, { roof: '#3a3a40', lantern: false });
    m.prop('house', 26, 4, 6, 5, { roof: '#3a3a40', lantern: false });
    m.rect(0, 27, 36, 3, TL.WATER);
    m.reserve(16, 22, 3, 6);
    K.innerTrees(m, 3, 2, 32, 22, 2427, 0.4);
    K.forest(m, { seed: 2425, thr: 0.72, kinds: ['pine', 'dark'] });
    m.npc({ id: 'bd24inn', spec: 'innkeeper', x: 7, y: 11, dir: 'down', talk: K.innTalk('innkeeper', 220) });
    m.npc({ id: 'bdshop', spec: 'merchant', x: 28, y: 11, dir: 'down', talk: K.shopTalk('merchant', SHOP, '白帝商号', '……客官，宫里那位，怕是不好了。') });
    m.npc({ id: 'km24', spec: 'zhugeliang', x: 16, y: 10, dir: 'down', cond: () => !G.flag('c24_end'), marker: () => true, talk: tuoguScene });
    m.npc({ id: 'lb24', spec: 'liubei', x: 17, y: 9, dir: 'down', cond: () => !G.flag('c24_end'), talk: tuoguScene });
    m.npc({ id: 'ly1', spec: 'masu', x: 20, y: 11, dir: 'down', cond: () => !G.flag('c24_end'), talk: K.talk([['masu', '（垂手侍立，神色不安）']]) });
    m.onEnter = async () => {
      if (G.flag('c24_bd')) return; G.setFlag('c24_bd');
      await G.narrate('刘备退入白帝城，羞惭不愿回成都，改馆驿为永安宫。不久，染病不起，渐渐沉重。');
      await G.narrate('先主自知病入四肢，又哭关、张二弟，其病愈深。遣使往成都，请丞相诸葛亮星夜来永安宫，听受遗命——');
      G.setParty(['zhaoyun', 'guanxing', 'zhangbao2']);
      await G.notice('孔明到了。\n去永安宫。');
    };
    return m;
  };

  async function tuoguScene() {
    await G.narrate('先主命孔明坐于龙榻之侧，抚其背曰——');
    await G.lines([
      ['liubei', '朕自得丞相，幸成帝业。何期智识浅陋，不纳丞相之言，自取其败。悔恨成疾，死在旦夕。嗣子孱弱，不得不以大事相托。'],
      ['liubei', '（目视马谡退出）丞相观马谡之才何如？'],
      ['zhugeliang', '此人亦当世之英才也。'],
      ['liubei', '不然。朕观此人，言过其实，不可大用。丞相宜深察之。'],
    ]);
    await G.narrate('先主泣曰——');
    await G.lines([
      ['liubei', '君才十倍曹丕，必能安邦定国，终定大事。若嗣子可辅，则辅之；如其不才，君可自为成都之主。'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('孔明听毕，汗流遍体，手足失措，泣拜于地——');
    await G.lines([
      ['zhugeliang', '臣安敢不竭股肱之力，尽忠贞之节，继之以死乎！'],
      ['liubei', '（命内侍扶起孔明，一手掩泪，一手执其手）……子龙。'],
      ['zhaoyun', '（跪）臣在。'],
      ['liubei', '朕与卿于患难之中，相从到今，不想于此地分别。卿可想朕故交，早晚看觑吾子，勿负朕言。'],
      ['zhaoyun', '臣敢不效犬马之劳！'],
      ['liubei', '（对众官）朕不能一一分嘱，愿皆自爱……'],
      ['liubei', '"勿以恶小而为之，勿以善小而不为。"——告诉阿斗。'],
    ]);
    await G.fadeOut(2.0);
    await G.narrate('言毕，驾崩，寿六十三岁。时章武三年夏四月二十四日也。');
    await G.narrate('从桃园结义那一天算起，已经整整四十年。');
    G.setFlag('c24_end');
    G.leaveParty('liubei');
    await G.narrate('后杜工部有诗叹曰：蜀主窥吴向三峡，崩年亦在永安宫。翠华想像空山里，玉殿虚无野寺中。古庙杉松巢水鹤，岁时伏腊走村翁。武侯祠屋常邻近，一体君臣祭祀同。');
    await G.fadeIn(1.0);
    await G.notice('刘备 驾崩。\n（他的护甲放回了行囊）');
    await G.chapterEnd(G.CHAPTERS[24].endLines);
  }

  G.CHAPTERS[24] = {
    title: '白帝城',
    prologue: [
      '陆逊坚守半年，任凭蜀军百般辱骂，按兵不动。',
      '蜀军师老兵疲，暑热难耐，移营于山林之间。',
      '马良把营寨图本送到成都，孔明一看，拍案大叫：',
      '"是何人教主上如此下寨？……汉朝气数休矣！"',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.setParty(ESC);
      G.restoreAll();
      const w = G.world;
      w.load('c24lianying', 50, 15, 'left');
      await G.fadeIn(1.2);
    },
    endLines: [
      '太子刘禅在成都即位，是为后主，改元建兴。',
      '曹丕听说刘备已死，起五路大兵来伐蜀，',
      '孔明却在府中闭门不出，观鱼池中——',
      '原来他早已不动声色，把五路兵马一一退去。这就是"安居平五路"。',
      '然而南方又生变乱：南蛮王孟获，起兵十万，侵掠四郡。',
      '孔明说："南方不宾，乃国家之大患也。吾当亲往征之。"',
    ],
  };
})();
