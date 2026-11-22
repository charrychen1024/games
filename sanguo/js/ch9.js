/* ============================================================
 * 烽烟录 · 第九章　三顾茅庐
 * 新野（徐庶）→ 破曹仁八门金锁阵 → 走马荐诸葛 → 隆中三顾 → 博望坡火攻
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const LUSH = { gh: 96, gs: 40, gl: 27 };
  const GROUPS = [{ e: ['caobing3', 'caobing3'], w: 3 }, { e: ['caobing3', 'caoshe3'], w: 2 }, { e: ['caoqi3', 'caobing3'], w: 2 }, { e: ['caoshe3', 'caoshe3', 'caobing3'], w: 1 }];
  G.SPECS.zhugejun = { skin: '#f2d0ae', hair: '#141010', robe: '#cfd6c8', robe2: '#4a5a4a', trim: '#4a5a4a', pants: '#3a4038', hat: 'scholar', hatColor: '#4a5a4a', banner: '#4a5a4a', size: 0.95 };
  G.NAMES.zhugejun = '诸葛均';

  /* ---------------- 新野 ---------------- */
  B.c9xinye = () => {
    const m = new G.GameMap('c9xinye', '新 野', 34, 28, TL.GRASS);
    Object.assign(m, { seed: 901, music: 'town', pal: LUSH, ambient: 'leaves', flowers: 0.05 });
    K.walls(m, 0, 0, 33, 27, [{ side: 's', x: 16, plaque: '新野' }]);
    m.road([[17, 27], [17, 9]], 1, TL.PATH);
    m.road([[2, 13.5], [31, 13.5]], 0.6, TL.PATH);
    m.road([[6, 10], [6, 13]], 0.6, TL.PATH); m.road([[27, 10], [27, 13]], 0.6, TL.PATH); m.road([[27, 21], [27, 15]], 0.6, TL.PATH);
    m.prop('hall', 12, 2, 11, 6, { sign: '县衙' });
    m.prop('house', 3, 5, 7, 5, { sign: '客栈' });
    m.prop('house', 24, 5, 7, 5, { sign: '杂货', roof: '#45403a' });
    m.prop('house', 24, 16, 7, 5, { sign: '兵器', roof: '#3a3a3a', wall: '#cbbd9e' });
    m.prop('house', 3, 17, 5, 4, { roof: '#4a3b36', lantern: false });
    K.deco(m, 'well', 13, 15);
    for (const [x, y] of [[11, 8], [24, 3]]) K.deco(m, 'flag', x, y, { text: '刘', color: '#2e7d4f', tcol: '#f6e7c1' });
    m.warp(16, 27, 3, 1, 'c9world', 9, 13, 'down', () => G.flag('c9_xushu'), '城外形势不明，先在城中打听打听。');
    m.reserve(16, 24, 3, 3);
    K.innerTrees(m, 1, 2, 32, 25, 19, 0.5);
    m.npc({ id: 'inn9', spec: 'innkeeper', x: 6, y: 10, dir: 'down', talk: K.innTalk('innkeeper', 120) });
    m.npc({ id: 'shop9', spec: 'merchant', x: 27, y: 10, dir: 'down', talk: K.shopTalk('merchant', ['dahuan', 'qiongjiang', 'xuming', 'jingliang'], '杂货', '荆州富庶，皇叔要什么尽管说。') });
    m.npc({ id: 'arm9', spec: 'smith', x: 27, y: 21, dir: 'down', talk: K.shopTalk('smith', ['xuanjia', 'longlin'], '兵器', '这副龙鳞甲，打了整整三年！') });
    m.npc({ id: 'xushu', spec: 'xushu', x: 14, y: 18, wander: 1, cond: () => !G.flag('c9_jian'), marker: () => !G.flag('c9_xushu'), talk: async () => {
      if (G.flag('c9_xushu')) { await say('xushu', '主公，曹仁的兵马就在城北。八门金锁阵，从生门入、景门出，阵脚自乱。'); return; }
      await G.narrate('一人葛巾布袍，皂绦乌履，长歌而来：');
      await G.narrate('"天地反覆兮，火欲殂；大厦将崩兮，一木难扶。山谷有贤兮，欲投明主；明主求贤兮，却不知吾。"');
      await G.lines([
        ['liubei', '此人歌声不凡，必是贤士。先生尊姓大名？'],
        ['xushu', '在下颍上人，姓单名福。久闻使君纳士招贤，欲来投托，未敢辄造。'],
        ['liubei', '……先生请！刘备求贤若渴，愿拜先生为军师！'],
        ['messenger', '报——！曹仁率大军，在城北摆下一座古怪阵势！'],
        ['xushu', '主公勿忧。那是八门金锁阵，单福自有破法。'],
      ]);
      G.setFlag('c9_xushu');
      await G.notice('单福（徐庶）担任军师！\n出城北，破曹仁的八门金锁阵。');
    } });
    m.npc({ id: 'xy1', spec: 'farmer', x: 9, y: 22, wander: 2, talk: K.talk([['farmer', '刘皇叔来了以后，新野的赋税轻多了。']]) });
    m.npc({ id: 'xy2', spec: 'oldman', x: 21, y: 18, wander: 1, talk: K.talk([['oldman', '听说襄阳城外有位司马徽，号水镜先生，常说"卧龙、凤雏，得一可安天下"。']]) });
    return m;
  };

  /* ---------------- 荆州原野 ---------------- */
  B.c9world = () => {
    const m = new G.GameMap('c9world', '荆 州', 56, 40, TL.GRASS);
    Object.assign(m, { seed: 931, music: 'field', ambient: 'clouds', pal: LUSH, battleBg: 'field', flowers: 0.06 });
    K.tallGrass(m, 933, 0.57);
    m.road([[-1, 24], [12, 23], [22, 26], [34, 24], [46, 27], [57, 26]], 1.2, TL.WATER);
    m.road([[9.5, 12], [9.5, 16.5], [24, 16.5], [36, 13], [41.5, 11.5], [41.5, 10]], 0.75, TL.PATH);
    m.road([[24, 16.5], [30.5, 16.5], [30.5, 30], [37.5, 30], [37.5, 32]], 0.75, null, (x, y) => { if (!m.inb(x, y)) return; m.set(x, y, m.get(x, y) === TL.WATER || m.get(x, y) === TL.BRIDGE ? TL.BRIDGE : TL.PATH); });
    m.prop('townicon', 8, 9, 4, 3, { label: '新野', foot: [8, 9, 4, 3] });
    m.warp(9, 12, 2, 1, 'c9xinye', 17, 25, 'up'); m.reserve(9, 13, 2, 1);
    m.prop('house', 39, 5, 5, 4, { sign: '隆中', roof: '#7a6a3a', lantern: false, foot: [39, 6, 5, 3] });
    m.warp(41, 10, 1, 1, 'c9longzhong', 15, 27, 'up', () => G.flag('c9_jian'), '隆中卧龙岗……眼下还没有理由去打扰隐士。'); m.reserve(41, 11, 1, 1);
    m.warp(37, 32, 2, 1, 'c9bowang', 15, 38, 'up', () => G.flag('c9_kongming'), '博望坡山势险恶，眼下不必前往。'); m.reserve(37, 31, 2, 1);
    for (let x = 0; x < 54; x += 3) K.mountain(m, x, 0);
    for (const [x, y] of [[33, 32], [40, 31], [34, 35], [41, 35], [46, 32], [16, 6], [24, 8], [48, 8], [50, 14], [4, 30], [12, 32]]) K.mountain(m, x, y);
    K.deco(m, 'sign', 36, 29, { text: '博望坡' });
    m.event({ type: 'inspect', x: 36, y: 29, w: 1, h: 1, run: () => G.narrate('路牌：南 · 博望坡　东北 · 隆中') });
    K.forest(m, { seed: 941, thr: 0.63, kinds: ['tree', 'bamboo', 'pine', 'dark'] });
    const cr = () => G.flag('c9_xushu') && !G.flag('c9_caoren');
    m.npc({ id: 'caoren', spec: 'caoren', x: 18, y: 15, dir: 'left', aggro: true, cond: cr, talk: caorenScene });
    for (const [i, x, y] of [[1, 18, 18], [2, 20, 15], [3, 20, 18]]) m.npc({ id: 'crb' + i, spec: 'caobing', x, y, dir: 'left', cond: cr });
    m.encounters = { rates: { [TL.GRASS]: 0.028, [TL.TALL]: 0.08 }, groups: GROUPS };
    return m;
  };

  async function caorenScene() {
    await G.lines([
      ['caoren', '刘备！看看本将军这八门金锁阵，你可破得？'],
      ['xushu', '主公，此阵八门：休、生、伤、杜、景、死、惊、开。从东南角生门击入，往正西景门而出，其阵必乱！'],
      ['zhaoyun', '末将领兵，从生门杀入！'],
    ]);
    const r = await G.battle(['caoren', 'caoqi3', 'caobing3'], { bg: 'field', boss: true, intro: '八门金锁阵 · 曹仁！' });
    if (r !== 'win') return;
    G.setFlag('c9_caoren');
    await G.narrate('赵云从生门杀入，往西而出，又从西杀转东南。曹军大乱，曹仁大败而走。');
    await G.narrate('然而数日之后，单福接到一封家书……');
    await G.lines([
      ['xushu', '主公……其实在下本名徐庶，字元直。单福只是化名。'],
      ['xushu', '家母被曹操囚于许昌，来信命我速去。徐庶是个孝子，不能不去……'],
      ['liubei', '……母子乃天性之亲，元直无以备为念。'],
    ]);
    await G.narrate('刘备送了一程又一程，直到徐庶身影消失在树林之后，仍伫立不去。');
    await G.lines([
      ['liubei', '吾欲尽伐此处树木。'],
      ['jianyong', '为何？'],
      ['liubei', '因阻吾望徐元直之目也。'],
    ]);
    await G.narrate('忽见徐庶拍马而回。');
    await G.lines([
      ['xushu', '某因心绪如麻，忘却一语：此间有一奇士，只在襄阳城外二十里隆中。'],
      ['xushu', '此人姓诸葛，名亮，字孔明，人称"卧龙先生"。'],
      ['xushu', '若得此人，无异周得吕望、汉得张良也！主公宜亲往求之，不可屈致也。'],
    ]);
    G.setFlag('c9_jian');
    await G.notice('前往东北方的隆中，拜访卧龙先生。');
  }

  /* ---------------- 隆中 ---------------- */
  B.c9longzhong = () => {
    const m = new G.GameMap('c9longzhong', '隆中 · 卧龙岗', 30, 30, TL.GRASS);
    Object.assign(m, { seed: 951, music: 'title', ambient: 'leaves', pal: { gh: 100, gs: 38, gl: 28 }, flowers: 0.07 });
    m.road([[15.5, 30], [15.5, 10]], 0.6, TL.PATH);
    m.road([[0, 20], [8, 19], [14, 21], [22, 18], [30, 19]], 0.9, TL.WATER);
    for (let x = 0; x < 30; x++) if (m.get(x, 19) === TL.WATER || m.get(x, 20) === TL.WATER) { if (x === 15 || x === 16) { for (let y = 16; y < 24; y++) if (m.get(x, y) === TL.WATER) m.set(x, y, TL.BRIDGE); } }
    m.prop('house', 12, 4, 7, 5, { sign: '卧龙岗', roof: '#7a6a3a', wall: '#d8cba8', lantern: false });
    m.rect(4, 24, 6, 4, TL.TALL); m.rect(21, 23, 6, 4, TL.TALL);
    m.warp(15, 29, 2, 1, 'c9world', 41, 11, 'down');
    m.reserve(14, 26, 4, 3);
    for (let y = 0; y < 30; y++) for (let x = 0; x < 30; x++) {
      const edge = x < 3 || x > 26 || y < 3;
      if (edge || G.hash(x, y, 955) < 0.12) m.tree(x, y, G.hash(x, y, 956) < 0.7 ? 'bamboo' : 'pine');
    }
    m.npc({ id: 'nong', spec: 'farmer', x: 6, y: 22, wander: 2, talk: async () => {
      await G.narrate('农夫一边耕作，一边唱道："苍天如圆盖，陆地似棋局；世人黑白分，往来争荣辱。南阳有隐居，高眠卧不足！"');
      await say('farmer', '这歌儿呀，是卧龙先生作的。');
    } });
    m.npc({ id: 'tongzi', spec: 'shepherd', x: 15, y: 9, dir: 'down', cond: () => !G.flag('c9_kongming'), marker: () => !G.flag('c9_leave'), talk: visitTalk });
    m.npc({ id: 'kongming', spec: 'zhugeliang', x: 17, y: 9, dir: 'down', cond: () => G.flag('c9_v2') && G.flag('c9_v3ready') && !G.flag('c9_kongming') });
    m.onEnter = async () => {
      G.setFlag('c9_leave', false);
      if (G.flag('c9_v1') && !G.flag('c9_v2')) { m.ambient = 'snow'; m.tint = 'rgba(220,230,255,0.12)'; await say('zhangfei', '天寒地冻，又下着大雪，还要来见什么村夫！'); await say('liubei', '吾正欲使孔明知我殷勤之意。'); }
      else { m.ambient = 'leaves'; m.tint = null; }
      if (G.flag('c9_v2')) G.setFlag('c9_v3ready');
    };
    return m;
  };

  async function visitTalk() {
    if (G.flag('c9_leave')) { await say('shepherd', '先生还没回来呢。'); return; }
    if (!G.flag('c9_v1')) {
      await G.lines([
        ['liubei', '汉左将军宜城亭侯领豫州牧皇叔刘备，特来拜见先生。'],
        ['shepherd', '我记不得许多名字。先生今早少出。'],
        ['liubei', '何处去了？'],
        ['shepherd', '踪迹不定，不知何处去了。归期亦不定，或三五日，或十数日。'],
        ['zhangfei', '既不见，自归去罢了。'],
      ]);
      G.setFlag('c9_v1'); G.setFlag('c9_leave', true);
      await G.notice('第一次拜访，先生不在。改日再来吧。（离开隆中再回来）');
      return;
    }
    if (!G.flag('c9_v2')) {
      await G.lines([
        ['shepherd', '先生今日却在堂上读书。'],
      ]);
      await G.narrate('刘备入内，见一少年拥炉抱膝，歌曰："凤翱翔于千仞兮，非梧不栖……"');
      await G.lines([
        ['liubei', '备久慕先生，无缘拜会……'],
        ['zhugejun', '将军莫非刘豫州，欲见家兄否？某乃卧龙之弟诸葛均也。家兄昨与崔州平相约，出外闲游去矣。'],
        ['liubei', '……备欲留书一封，以表殷勤之意。'],
      ]);
      G.setFlag('c9_v2'); G.setFlag('c9_leave', true);
      await G.notice('第二次拜访，先生又出游了。留下书信，来年开春再来。（离开隆中再回来）');
      return;
    }
    await G.lines([
      ['shepherd', '今日先生虽在家，但今在草堂上昼寝未醒。'],
      ['liubei', '既如此，且休通报。'],
    ]);
    await G.narrate('刘备拱立阶下。半晌，先生未醒。张飞大怒，要去屋后放一把火，被关羽死死拉住。');
    await G.narrate('又立了一个时辰，孔明方醒，口吟诗曰："大梦谁先觉？平生我自知。草堂春睡足，窗外日迟迟。"');
    await G.lines([
      ['zhugeliang', '何不早报？尚容更衣。'],
      ['liubei', '汉室倾颓，奸臣窃命。备不量力，欲伸大义于天下，而智术浅短，迄无所就。惟先生开其愚而拯其厄，实为万幸！'],
      ['zhugeliang', '自董卓以来，豪杰并起。曹操拥百万之众，挟天子以令诸侯，此诚不可与争锋。孙权据有江东，已历三世，此可用为援而不可图也。'],
      ['zhugeliang', '荆州北据汉、沔，利尽南海，东连吴会，西通巴、蜀，此用武之国。益州险塞，沃野千里，天府之国。'],
      ['zhugeliang', '将军若跨有荆、益，保其岩阻，西和诸戎，南抚夷越，外结孙权，内修政理——则霸业可成，汉室可兴矣。'],
    ]);
    await G.narrate('孔明命童子取出地图一轴，挂于中堂。刘备闻言，避席拱手而谢。');
    await G.lines([
      ['liubei', '先生不出，如苍生何！'],
      ['zhugeliang', '……将军既不相弃，愿效犬马之劳。'],
    ]);
    G.joinParty('zhugeliang'); G.setFlag('c9_kongming'); G.world.refreshParty();
    G.audio.sfx('levelup');
    await G.notice('诸葛亮 加入了队伍！\n火计、烈火、救援、八阵，样样精通。');
    await G.lines([
      ['zhangfei', '哼，一个年轻村夫，有什么本事，俺倒要看看。'],
      ['messenger', '报——！曹操遣夏侯惇引兵十万，杀奔新野而来！'],
      ['zhugeliang', '主公勿忧。博望坡左有豫山，右有安林，可以埋伏军马。请主公借剑印一用。'],
    ]);
    await G.notice('前往南方的博望坡，迎击夏侯惇。');
  }

  /* ---------------- 博望坡 ---------------- */
  B.c9bowang = () => {
    const m = new G.GameMap('c9bowang', '博望坡', 30, 40, TL.GRASS);
    Object.assign(m, { seed: 971, music: 'camp', ambient: 'embers', dusk: true, pal: { gh: 70, gs: 32, gl: 24 }, battleBg: 'camp', flowers: 0.01 });
    const pts = [[15, 40], [15, 33], [9, 28], [10, 21], [19, 17], [21, 11], [15, 7]];
    const clear = new Set();
    m.road(pts, 2.4, null, (x, y) => clear.add(x + ',' + y));
    for (let y = 2; y <= 9; y++) for (let x = 6; x <= 24; x++) clear.add(x + ',' + y);
    m.road(pts, 0.7, TL.PATH);
    m.warp(14, 39, 3, 1, 'c9world', 37, 31, 'up');
    m.reserve(14, 37, 3, 2);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!clear.has(x + ',' + y)) m.tree(x, y, G.hash(x, y, 973) < 0.6 ? 'gold' : 'dark');
    for (const [x, y] of [[8, 4], [22, 4], [12, 30], [20, 22], [7, 20]]) K.deco(m, 'fire', x, y, { light: 140 });
    for (const [x, y] of [[10, 3], [20, 3]]) K.deco(m, 'flag', x, y, { text: '曹', color: '#2f4a7a', tcol: '#f6e7c1' });
    K.guard(m, { id: 'bw1', spec: 'caobing', x: 15, y: 32, flag: 'c9_b1', group: ['caobing3', 'caobing3', 'caoshe3'], bg: 'camp', lines: [['caobing', '刘备的兵就这么点？冲啊！', { name: '曹军' }]] });
    K.guard(m, { id: 'bw2', spec: 'caoqi', x: 10, y: 24, flag: 'c9_b2', group: ['caoqi3', 'caobing3', 'caoshe3'], bg: 'camp' });
    m.npc({ id: 'xhd9', spec: 'xiahoudun', x: 15, y: 6, dir: 'down', aggro: true, cond: () => !G.flag('c9_bowang'), talk: async () => {
      await G.lines([
        ['xiahoudun', '哈哈哈！徐庶在丞相面前把诸葛亮夸上了天，原来就用这等驱羊斗虎的伎俩！'],
        ['zhugeliang', '夏侯将军，请看两旁——'],
      ]);
      G.audio.sfx('fire'); G.shake(8, 0.8);
      await G.narrate('一声号炮，两边芦苇齐着火。狂风大作，火势冲天，曹军人马自相践踏！关羽、张飞左右杀出，赵云回马接应！');
      const r = await G.battle(['xiahoudun2', 'caoqi3', 'caoshe3'], { bg: 'camp', boss: true, intro: '博望坡火攻 · 夏侯惇！' });
      if (r !== 'win') return;
      G.setFlag('c9_bowang');
      await G.lines([
        ['zhangfei', '……孔明真英杰也！俺老张服了！'],
        ['guanyu', '先生神机妙算，关某佩服。'],
        ['zhugeliang', '此乃诸位将军之功。只是曹操此番败了，下次必倾国而来。'],
      ]);
      await G.chapterEnd(G.CHAPTERS[9].endLines);
    } });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.PATH]: 0.012 }, groups: GROUPS };
    return m;
  };

  G.CHAPTERS[9] = {
    title: '三顾茅庐',
    prologue: [
      '刘备寄居荆州，屯兵新野，转眼数年。',
      '一日如厕，见髀里肉生，不觉潸然流涕：',
      '"备往常身不离鞍，髀肉皆消；今久不骑，髀里肉生。',
      '日月磋跎，老将至矣，而功业不建，是以悲耳！"',
      '襄阳名士司马徽曾言："卧龙、凤雏，两人得一，可安天下。"',
    ],
    start: async () => {
      const w = G.world;
      w.load('c9xinye', 17, 9, 'down');
      await G.fadeIn(1.2);
      await G.lines([
        ['liubei', '卧龙、凤雏……天下之大，贤士何在？'],
        ['zhaoyun', '主公，城中市集里，近日有个唱歌的布衣书生，歌词好生古怪。'],
      ]);
    },
    endLines: [
      '博望坡一把火，烧得夏侯惇十万大军丢盔弃甲。',
      '关羽、张飞从此对孔明心悦诚服。',
      '然而建安十三年秋，曹操亲率大军五十万南下。',
      '刘表病逝，其子刘琮举荆州而降。',
      '新野孤城，再也守不住了……',
    ],
  };
})();
