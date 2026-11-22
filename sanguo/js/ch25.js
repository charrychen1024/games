/* ============================================================
 * 烽烟录 · 第二十五章　南征（七擒孟获·上）
 * 南中（吕凯献图、一擒孟获）→ 泸水（夜渡、董荼那绑孟获·二擒）→ 孟优诈降（三擒）→ 西洱河陷坑（四擒）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const NZ = { gh: 112, gs: 40, gl: 24 };
  const SHOP = ['tianxiang', 'huixin', 'xianlu', 'yuquan', 'xuming', 'qingzhou', 'nanzhong', 'longwen', 'wuxing'];
  const NAN = ['zhugeliang', 'zhaoyun', 'weiyan', 'guanxing', 'zhangbao2', 'machao'];
  const GROUPS = [{ e: ['manbing', 'manbing'], w: 3 }, { e: ['manbing', 'mangong'], w: 3 }, { e: ['manwu', 'manbing'], w: 2 }, { e: ['mangong', 'mangong', 'manbing'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };
  const campMenu = (line, title) => async () => {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) await restAndSave('innkeeper', line, '军需官'); else if (k === 1) await G.shop(SHOP, title);
  };

  // 擒获孟获：玩家选择放还是斩；孔明总是"攻心为上"
  G.captureMeng = async (n, excuse) => {
    const CN = ['', '一', '二', '三', '四', '五', '六', '七'];
    G.state.flags.c25_cap = Math.max(G.state.flags.c25_cap || 0, n);
    await G.titleCard(`${CN[n]}擒孟获`, n < 7 ? '孟获不服' : '');
    await G.lines([
      ['zhugeliang', '孟获，今番被擒，汝心服否？'],
      ['menghuo', excuse],
    ]);
    if (n >= 7) return;
    const k = await G.choose(['众将：听丞相发落', '魏延：请斩此獠'], { w: 340, x: G.W / 2 - 170, title: '帐下诸将议论' });
    if (k === 1) {
      await G.lines([
        ['weiyan', '丞相，这蛮子反复无常，一刀斩了干净！'],
        ['zhugeliang', '吾擒此人，如囊中取物耳。直须降伏其心，自然平矣。——"用兵之道，攻心为上，攻城为下；心战为上，兵战为下。"'],
      ]);
    }
    await G.narrate('孔明令去其缚，赐以酒食，给与鞍马，差人送出大路。');
    await G.lines([['zhugeliang', '汝且回去，整顿人马，再来决一胜负。若再被擒，可服否？']]);
    await G.narrate('孟获拜谢，上马而去。');
  };

  /* ---------------- 南中 ---------------- */
  B.c25nanzhong = () => {
    const m = new G.GameMap('c25nanzhong', '南 中', 60, 48, TL.GRASS);
    Object.assign(m, { seed: 2501, music: 'field', ambient: 'leaves', leafColor: 'rgba(120,180,80,0.8)', pal: NZ, battleBg: 'shu', flowers: 0.1 });
    K.tallGrass(m, 2503, 0.5);
    m.road([[0, 23], [14, 24], [30, 22.5], [44, 24], [60, 23]], 2.2, TL.WATER);          // 泸水
    m.road([[30.5, 2], [30.5, 19]], 0.75, TL.PATH);
    m.road([[30.5, 27], [30.5, 34], [18, 38], [8.5, 42]], 0.75, TL.PATH);
    m.road([[30.5, 34], [44, 36], [50.5, 40]], 0.75, TL.PATH);
    m.reserve(26, 1, 10, 7); m.reserve(29, 18, 3, 2); m.reserve(29, 26, 3, 2); m.reserve(7, 41, 4, 3); m.reserve(48, 39, 5, 3);
    K.tent(m, 25, 2, { big: true, w: 5, h: 4, red: true, sign: '汉' });
    K.tent(m, 34, 3, { red: true });
    K.deco(m, 'flag', 28, 6, { text: '诸', color: '#2a3a5a', tcol: '#f6e7c1' }); K.deco(m, 'flag', 33, 6, { text: '汉', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.npc({ id: 'camp25', spec: 'innkeeper', x: 33, y: 7, dir: 'left', talk: campMenu('丞相，南方湿热，将士们都不服水土。', '南征军需') });
    m.npc({ id: 'lk25', spec: 'oldman', x: 28, y: 7, dir: 'right', marker: () => !G.flag('c25_lk'), talk: lvkaiTalk });
    m.npc({ id: 'mh25a', spec: 'menghuo', x: 30, y: 13, dir: 'up', aggro: true, cond: () => G.flag('c25_lk') && !G.flag('c25_m1'), marker: () => true, talk: meng1 });
    K.guard(m, { id: 'ferry25', spec: 'manbing', x: 31, y: 18, dir: 'up', flag: 'c25_fg', group: ['manbing', 'mangong', 'manbing'], intro: '泸水渡口的蛮兵！', bg: 'shu', cond: () => G.flag('c25_m1'),
      lines: [['manbing', '大王有令：守住泸水，汉兵一个也别想过来！', { name: '蛮兵头目' }]] });
    m.event({ type: 'step', x: 29, y: 19, w: 3, h: 1, run: ferryScene });
    m.npc({ id: 'dtn25', spec: 'manbing', x: 29, y: 28, dir: 'up', cond: () => G.flag('c25_ferry') && !G.flag('c25_m2'), marker: () => true, talk: meng2 });
    m.npc({ id: 'mh25b', spec: 'menghuo', x: 31, y: 28, dir: 'up', cond: () => G.flag('c25_ferry') && !G.flag('c25_m2'), talk: meng2 });
    m.npc({ id: 'my25', spec: 'manbing', x: 49, y: 39, dir: 'left', cond: () => G.flag('c25_m2') && !G.flag('c25_m3'), marker: () => true, talk: meng3 });
    m.npc({ id: 'mh25d', spec: 'menghuo', x: 9, y: 41, dir: 'right', aggro: true, cond: () => G.flag('c25_m3') && !G.flag('c25_m4'), marker: () => true, talk: meng4 });
    m.npc({ id: 'camp25b', spec: 'innkeeper', x: 33, y: 31, dir: 'left', cond: () => G.flag('c25_ferry'), talk: campMenu('丞相，泸水南岸的营寨扎好了。', '南岸军需') });
    K.deco(m, 'sign', 29, 33, { text: '南中' });
    m.event({ type: 'inspect', x: 29, y: 33, w: 1, h: 1, run: () => G.narrate('路牌：东南 · 孟获大寨　西南 · 西洱河') });
    for (const [x, y] of [[4, 4], [12, 8], [44, 4], [52, 10], [6, 30], [14, 44], [40, 44], [54, 30], [44, 14], [16, 14]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2511, thr: 0.58, kinds: ['bamboo', 'tree', 'bamboo', 'bush'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function lvkaiTalk() {
    if (G.flag('c25_lk')) { await say('oldman', '泸水有瘴气，白天不可渡。', { name: '吕凯' }); return; }
    await G.lines([
      ['oldman', '永昌郡吕凯，拜见丞相。某素知南蛮欲反久矣，故密遣人入其境，察看可屯兵交战之处，画成一图，名曰《平蛮指掌图》——今敢献于丞相。', { name: '吕凯' }],
      ['zhugeliang', '（大喜）有此图，南方无忧矣。'],
      ['masu', '（随军参谋）丞相，南蛮恃其地远山险，不服久矣。虽今日破之，明日复叛。愿丞相但服其心足矣。'],
      ['zhugeliang', '幼常足知吾肺腑也。'],
    ]);
    G.setFlag('c25_lk');
    await G.notice('孟获引兵来战。\n南下迎敌——记住：要服其心。');
  }

  async function meng1() {
    if (G.flag('c25_m1')) return;
    await G.lines([
      ['menghuo', '人言诸葛亮善能用兵，今观此阵，旌旗杂乱，队伍交错，刀枪器械，无一可能胜吾者——始知前日之言谬也！早知如此，吾反多时矣！'],
      ['zhaoyun', '……这蛮王的嗓门倒是不小。'],
    ]);
    const r = await G.battle(['menghuo1', 'manbing', 'mangong'], { bg: 'shu', boss: true, intro: '南蛮王 孟获！' });
    if (r !== 'win') return;
    G.setFlag('c25_m1');
    await G.captureMeng(1, '山僻路狭，误遭汝手，如何肯服！');
    await G.notice('孟获退过泸水，据守南岸。\n去北岸渡口。');
  }

  async function ferryScene() {
    if (!G.flag('c25_fg') || G.flag('c25_ferry')) return;
    await G.narrate('泸水水势甚急，岸边热气蒸腾。');
    await G.lines([['oldman', '丞相！泸水日间有毒，若在此时渡河，水气蒸人，饮者、浴者皆死。须待夜静水冷，饱食而渡，方可无事。', { name: '吕凯' }]]);
    const k = await G.choose(['现在就渡河', '等到半夜再渡'], { w: 340, x: G.W / 2 - 170 });
    if (k === 0) {
      await G.narrate('前军方渡至中流，皆口鼻出血而倒。孔明大惊，急令退回。');
      for (const id of G.state.party) { const mm = G.state.members[id]; mm.hp = Math.max(1, Math.round(mm.hp * 0.6)); }
      G.audio.sfx('hit');
      await G.notice('全军兵力减少四成！\n还是等到夜里再渡吧。');
      return;
    }
    await G.fadeOut(0.8);
    await G.narrate('至半夜，水冷毒消。马岱引军，于下流沙口缚木筏渡河，一夜无事。');
    G.setFlag('c25_ferry');
    G.world.load('c25nanzhong', 30, 29, 'up');
    G.world.banner = null;
    await G.fadeIn(0.8);
    await G.narrate('天明，只见南岸一伙蛮兵，绑着一人，径投汉营而来——');
  }

  async function meng2() {
    if (G.flag('c25_m2')) return;
    await G.lines([
      ['manbing', '丞相！小人是蛮将董荼那。孟获前番被丞相放回，反怪我等不肯出力，打了我一百大棍——我等受不得这口气，把他绑来献与丞相！', { name: '董荼那' }],
      ['menghuo', '（被五花大绑）董荼那！你这狗东西！'],
    ]);
    G.setFlag('c25_m2');
    await G.captureMeng(2, '此非汝之能，乃吾手下之人自相残害，以致如此。如何肯服！');
    await G.notice('孟获回洞，必有诡计。\n东南方向，有人来营前献礼。');
  }

  async function meng3() {
    if (G.flag('c25_m3')) return;
    await G.lines([
      ['manbing', '小人孟优，乃孟获之弟。家兄感丞相活命之恩，特令小人献上金珠宝贝、象牙犀角，来日便来投降。', { name: '孟优' }],
      ['zhugeliang', '（笑看马谡）……汝知此意否？'],
      ['masu', '诈降也。'],
    ]);
    await G.narrate('孔明设宴款待孟优一行，酒中暗下了药。是夜二更，孟获果引三万蛮兵来劫寨——');
    await G.narrate('杀入大寨，只见孟优等百余人，横七竖八，醉倒在地。孟获大惊，急退时，四面伏兵齐出！');
    const r = await G.battle(['menghuo2', 'manbing', 'manwu', 'manbing'], { bg: 'shu', boss: true, intro: '孟获劫寨！' });
    if (r !== 'win') return;
    G.setFlag('c25_m3');
    await G.captureMeng(3, '此是吾弟贪口腹之故，误中汝毒，因此失了大事。吾若自来，弟以兵应之，必然成功。此乃天败，非吾之不能——如何肯服！');
    await G.notice('孟获逃往西南，据守西洱河。');
  }

  async function meng4() {
    if (G.flag('c25_m4')) return;
    await G.lines([
      ['menghuo', '（遥望汉营）诸葛亮的营寨，空空荡荡，只有几辆车子……哈哈，这回定要捉了他！'],
      ['zhugeliang', '（端坐车上，羽扇轻摇）……'],
    ]);
    const r = await G.battle(['manbing', 'mangong', 'manwu', 'manbing'], { bg: 'shu', intro: '孟获的蛮兵冲来！' });
    if (r !== 'win') return;
    G.audio.sfx('down'); G.shake(8, 0.6);
    await G.narrate('孟获奋勇当先，直扑孔明车前——忽然一声响亮，连人带马，跌入陷坑之中！');
    G.setFlag('c25_m4');
    await G.captureMeng(4, '……（低头不语，良久）汝若再放我回去，我便收拾兵马，与汝共决雌雄。若那时擒住，我便倾心降服，并不改易！');
    await G.chapterEnd(G.CHAPTERS[25].endLines);
  }

  G.CHAPTERS[25] = {
    title: '南征',
    prologue: [
      '建兴三年，孔明亲统五十万大军，南征孟获。',
      '临行，马谡来送，献言道：',
      '"用兵之道，攻心为上，攻城为下；心战为上，兵战为下。"',
      '孔明点头称是。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(NAN);
      G.setParty(NAN);
      G.restoreAll();
      const w = G.world;
      w.load('c25nanzhong', 30, 8, 'down');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhugeliang', '先帝托孤之重，亮不敢一日忘怀。南方平定，方可北伐中原。'],
        ['zhaoyun', '丞相，这南中山高林密，处处瘴气，比当年长坂坡还难走。'],
      ]);
      await G.notice('第二十五章：诸葛亮率军南征。\n营中有个本地人求见。');
    },
    endLines: [
      '孟获又一次被放了回去。',
      '这一回，他逃到了秃龙洞，投奔洞主朵思大王。',
      '秃龙洞前只有两条路：一条大路，被巨石堵死；',
      '一条小路，沿途有四眼毒泉，人马饮之，不能言语，旬日必死……',
    ],
  };
})();
