/* ============================================================
 * 烽烟录 · 第二十八章　街亭
 * 街亭（王平谏马谡、张郃断水、王平收拾残兵）→ 西城（空城计）→ 挥泪斩马谡
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const QS = { gh: 86, gs: 24, gl: 26 };
  const SHOP = ['huixin', 'jiuzhuan', 'yuquan', 'qianjin', 'xuming', 'nanzhong', 'muniu', 'wuxing', 'zhuge'];
  const JT = ['wangping', 'guanxing', 'zhangbao2'];
  const ARMY = ['zhugeliang', 'zhaoyun', 'weiyan', 'guanxing', 'zhangbao2', 'jiangwei'];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  /* ---------------- 街亭 ---------------- */
  B.c28jieting = () => {
    const m = new G.GameMap('c28jieting', '街 亭', 44, 36, TL.GRASS);
    Object.assign(m, { seed: 2801, music: 'camp', ambient: 'clouds', pal: QS, battleBg: 'shu', flowers: 0.02 });
    K.tallGrass(m, 2803, 0.56);
    m.road([[22.5, 36], [22.5, 22], [22.5, 4]], 0.9, TL.PATH);                            // 当道大路
    m.road([[22.5, 20], [32, 16], [34.5, 10]], 0.6, TL.PATH);                            // 上南山
    m.rect(30, 4, 10, 7, TL.SOIL);                                                       // 南山山顶
    K.tent(m, 31, 4, { red: true }); K.tent(m, 36, 5, { red: true });
    K.deco(m, 'flag', 33, 9, { text: '马', color: '#8a1e1e', tcol: '#f6e7c1' });
    K.tent(m, 12, 22, { red: true }); K.deco(m, 'flag', 15, 25, { text: '王', color: '#4a3a2a', tcol: '#f6e7c1' });
    for (const [x, y] of [[2, 2], [10, 6], [2, 14], [36, 22], [2, 28], [36, 30], [26, 26]]) K.mountain(m, x, y);
    m.reserve(29, 3, 12, 9); m.reserve(11, 21, 6, 6); m.reserve(21, 32, 3, 4);
    K.forest(m, { seed: 2805, thr: 0.62, kinds: ['pine', 'dark', 'tree'] });
    m.warp(21, 35, 3, 1, 'c28jieting', 22, 33, 'up', () => false, '王平：街亭乃汉中咽喉，不可轻弃！');
    m.npc({ id: 'jt28inn', spec: 'innkeeper', x: 14, y: 26, dir: 'right', talk: () => restAndSave('innkeeper', '将军，营中都安顿好了。', '王平部卒') });
    m.npc({ id: 'ms28', spec: 'masu', x: 34, y: 7, dir: 'down', cond: () => !G.flag('c28_ms'), marker: () => true, talk: masuScene });
    m.npc({ id: 'zh28', spec: 'zhanghe', x: 22, y: 12, dir: 'down', aggro: true, cond: () => G.flag('c28_ms') && !G.flag('c28_lost'), marker: () => true, talk: zhangheScene });
    return m;
  };

  async function masuScene() {
    await G.lines([
      ['masu', '丞相何故多心也？量此山僻之处，魏兵如何敢来！'],
      ['wangping', '虽然魏兵不敢来，可就此五路总口下寨；却令军士伐木为栅，以图久计。'],
      ['masu', '（指南山）当道岂是下寨之地？此处侧边一山，四面皆不相连，且树木极广——此乃天赐之险也。可就山上屯军。'],
    ]);
    const k = await G.choose(['（王平）当道下寨，扼住五路总口！', '（王平）……参军说得也有道理。'], { w: 460, x: G.W / 2 - 230 });
    if (k === 0) {
      await G.lines([
        ['wangping', '参军差矣！若屯兵当道，筑起城垣，贼兵总有十万，不能偷过；今若弃此要路，屯兵于山上，倘魏兵骤至，四面围定，将何策保之？'],
        ['masu', '汝真女子之见！兵法云："凭高视下，势如劈竹。"若魏兵到来，吾教他片甲不回！'],
        ['wangping', '若魏兵断我汲水之道，军士不战自乱矣！'],
        ['masu', '孙子云："置之死地而后生。"……汝莫乱道！'],
      ]);
    } else {
      await G.lines([['wangping', '（暗想：不对……此山无水，若被围住，如何是好？）参军，还请分兵与我，我在山西下一小寨，为掎角之势。']]);
    }
    await G.lines([['masu', '……既汝不从吾令，与汝五千兵，自去下寨。待吾破了魏兵，到丞相面前须分不得功！']]);
    G.setFlag('c28_ms');
    await G.narrate('王平引兵离山十里下寨，画成图本，星夜差人去禀孔明。');
    await G.notice('魏军来了！\n大路上，张郃的兵马已经到了山下。');
  }

  async function zhangheScene() {
    if (G.flag('c28_lost')) return;
    await G.narrate('司马懿见山上蜀兵，大笑："若彼果有能，必不屯兵于山上——此天使吾成功矣！"遂令张郃断了山上汲水之道。');
    await G.narrate('蜀兵无水，不战自乱。马谡下山突围，被张郃杀得大败。王平引兵冲来，接应残军——');
    await G.lines([
      ['zhanghe', '王平！你也要来送死？'],
      ['wangping', '张郃！街亭虽失，王平这支兵，你休想吃下！'],
    ]);
    const r = await G.battle(['zhanghe4', 'weiqi', 'weibing'], { bg: 'shu', boss: true, intro: '街亭 · 张郃！' });
    if (r !== 'win') return;
    G.setFlag('c28_lost');
    await G.narrate('王平鸣鼓自持，张郃疑有伏兵，不敢追赶。王平收拾残兵，徐徐而退。街亭，终于失了。');
    await G.fadeOut(1.0);
    await G.narrate('消息传来，孔明跌足长叹："大事去矣！此吾之过也！"——忙令各军退兵。');
    await G.narrate('此时孔明身边只有一班文官、二千五百军，在西城搬运粮草。忽然十余次飞马报到——');
    G.setParty(['zhugeliang']);
    G.world.load('c28xicheng', 17, 20, 'up');
    G.world.banner = null;
    await G.fadeIn(0.8);
    await G.lines([
      ['messenger', '丞相！司马懿引大军十五万，望西城蜂拥而来！', { name: '探马' }],
      ['zhugeliang', '……'],
    ]);
    await G.notice('孔明身边一员大将也没有。\n上城楼。');
  }

  /* ---------------- 西城 ---------------- */
  B.c28xicheng = () => {
    const m = new G.GameMap('c28xicheng', '西 城', 34, 30, TL.GRASS);
    Object.assign(m, { seed: 2821, music: 'title', ambient: 'leaves', leafColor: 'rgba(180,160,110,0.7)', pal: QS, battleBg: 'city', flowers: 0.02 });
    K.walls(m, 2, 6, 31, 27, [{ side: 'n', x: 15, plaque: '西城' }]);
    m.road([[16.5, 26], [16.5, 6]], 1, TL.PATH);
    m.road([[16.5, 6], [16.5, 0]], 1, TL.PATH);
    m.prop('house', 4, 9, 6, 4, { roof: '#45403a', lantern: false });
    m.prop('house', 24, 9, 6, 4, { roof: '#45403a', lantern: false });
    K.deco(m, 'crates', 6, 18); K.deco(m, 'crates', 26, 18); K.deco(m, 'cart', 10, 22); K.deco(m, 'cart', 22, 22);
    m.reserve(15, 0, 4, 9); m.reserve(15, 16, 4, 6);
    K.innerTrees(m, 3, 8, 30, 25, 2827, 0.4);
    m.event({ type: 'step', x: 15, y: 9, w: 3, h: 2, run: emptyCity });
    m.npc({ id: 'xc28', spec: 'servant', x: 19, y: 14, dir: 'left', cond: () => !G.flag('c28_kong'), talk: K.talk([['servant', '（众官尽皆失色）丞相……怎么办……', { name: '文官' }]]) });
    m.npc({ id: 'smy28', spec: 'simayi', x: 16, y: 2, dir: 'down', cond: () => G.flag('c28_kong') && !G.flag('c28_end'), talk: async () => {} });
    return m;
  };

  async function emptyCity() {
    if (G.flag('c28_kong')) return;
    await G.narrate('孔明登城望之，果然尘土冲天，魏兵分两路望西城县杀来。');
    const k = await G.choose(['大开四门，焚香操琴', '弃城而走，往汉中退兵', '紧闭城门，拼死固守'], { w: 360, x: G.W / 2 - 180 });
    if (k === 0) {
      G.setFlag('c28_kong');
      await G.narrate('孔明传令：将旌旗尽皆隐匿；诸军各守城铺，不许妄行出入、高声言语。大开四门，每一门用二十军士，扮作百姓，洒扫街道。');
      await G.narrate('孔明乃披鹤氅，戴纶巾，引二小童携琴一张，于城上敌楼前，凭栏而坐，焚香操琴——');
      G.audio.play('title');
      await G.lines([
        ['simayi', '（至城下，见此光景，自飞马远远望之）……孔明坐于城楼之上，笑容可掬，焚香操琴。左有一童子手捧宝剑，右有一童子手执麈尾。城门内外，有二十余百姓，低头洒扫，旁若无人。'],
        ['simayi', '……亮平生谨慎，不曾弄险。今大开城门，必有埋伏。我兵若进，中其计也！——速退！'],
      ]);
      await G.narrate('司马懿两路兵尽皆退去。孔明抚掌而笑。众官无不骇然。');
      await G.lines([
        ['zhugeliang', '此人料吾生平谨慎，必不弄险；见如此模样，疑有伏兵，所以退去。吾非行险，盖因不得已而用之。'],
      ]);
      G.addItem('qianjin', 2);
      await G.notice('空城计成功！\n获得 千金露 ×2');
    } else {
      await G.narrate(k === 1 ? '孔明欲弃城而走——转念一想：只二千五百军，若弃城而去，必不能远遁，得不为司马懿所擒乎？' : '孔明欲闭门固守——可城中只二千五百老弱，如何守得住十五万大军？');
      await G.narrate('正迟疑间，司马懿的前锋已到城下——孔明只得亲自上阵，且战且退！');
      const r = await G.battle(['simayi1', 'weibing'], { bg: 'city', boss: true, party: ['zhugeliang'], intro: '司马懿兵临城下！' });
      if (r !== 'win') return;
      G.setFlag('c28_kong');
      await G.narrate('司马懿见孔明从容不迫，疑有伏兵，收兵而退。好险！');
    }
    G.setFlag('c28_end');
    await G.fadeOut(1.2);
    await G.narrate('孔明退回汉中。马谡自缚，跪于帐前——');
    G.setParty(ARMY.concat(['wangping']).filter(id => id !== 'zhangbao2'));
    await G.fadeIn(0.8);
    await G.lines([
      ['zhugeliang', '（变色）汝自幼饱读兵书，熟谙战法。吾累次丁宁告戒：街亭是吾根本。汝以全家之命，领此重任——汝若早听王平之言，岂有此祸？'],
      ['masu', '（泣曰）丞相视某如子，某以丞相为父。某之死罪，实已难逃——愿丞相思舜帝殛鲧用禹之义，某虽死亦无恨于九泉！'],
      ['zhugeliang', '（挥泪）吾与汝义同兄弟，汝之子即吾之子也，不必多嘱。'],
    ]);
    await G.narrate('左右推出马谡于辕门之外。须臾，武士献马谡首级于阶下。孔明大哭不已。');
    await G.lines([
      ['jiangwei', '幼常得罪，既正军法，丞相何故哭耶？'],
      ['zhugeliang', '吾非为马谡而哭。吾想先帝在白帝城临危之时，曾嘱吾曰："马谡言过其实，不可大用。"今果应此言。乃深恨己之不明，追思先帝之言，因此痛哭耳！'],
    ]);
    await G.narrate('孔明自贬三等，以右将军行丞相事。擢王平为参军，统领五部兵马。');
    G.audio.sfx('levelup');
    await G.notice('王平 加入！\n（张苞留守汉中）');
    await G.chapterEnd(G.CHAPTERS[28].endLines);
  }

  G.CHAPTERS[28] = {
    title: '街亭',
    prologue: [
      '街亭虽小，乃汉中咽喉。',
      '孔明问谁可守之，参军马谡请命：',
      '"某自幼熟读兵书，颇知兵法。岂一街亭不能守耶？"',
      '孔明命王平为副，再三叮嘱：当道下寨，勿令魏兵偷过。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(['wangping']);
      G.setParty(['guanxing', 'zhangbao2']);
      G.joinParty('wangping');
      G.state.party = JT.slice();
      G.restoreAll();
      const w = G.world;
      w.load('c28jieting', 22, 33, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['wangping', '……到了。参军，此处正是五路总口，当道下寨最好。'],
        ['guanxing', '马参军先上山去了，说是要看看地势。'],
      ]);
      G.audio.sfx('levelup');
      await G.notice('王平 出战！（关兴、张苞同行）\n去南山上找马谡。');
    },
    endLines: [
      '一出祁山，功败垂成。',
      '同年冬，孔明又上《后出师表》：',
      '"鞠躬尽瘁，死而后已。至于成败利钝，非臣之明所能逆睹也。"',
      '就在此时，成都传来消息——',
    ],
  };
})();
