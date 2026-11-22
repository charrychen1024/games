/* ============================================================
 * 烽烟录 · 第三十三章　洮西
 * 陇右（夏侯霸来投、洮西大破王经、铁笼山困司马昭、段谷遭邓艾）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const LY = { gh: 70, gs: 22, gl: 30 };
  const SHOP = ['jiuzhuan', 'shenyao', 'qianjin', 'lingzhi', 'xuming', 'muniu', 'hanjia', 'zhuge', 'zhaolie'];
  const ARMY = ['jiangwei', 'madai', 'liaohua', 'xiahouba'];
  const GROUPS = [{ e: ['weibing2', 'weibing2'], w: 3 }, { e: ['weiqi2', 'weinu2'], w: 3 }, { e: ['weiqi2', 'weiqi2', 'weibing2'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  B.c33taoxi = () => {
    const m = new G.GameMap('c33taoxi', '陇 右', 58, 44, TL.GRASS);
    Object.assign(m, { seed: 3301, music: 'field', ambient: 'clouds', pal: LY, battleBg: 'autumn', flowers: 0.02 });
    K.tallGrass(m, 3303, 0.55);
    m.road([[20, 0], [22, 14], [18, 30], [22, 44]], 1.5, TL.WATER);                       // 洮水
    m.road([[50.5, 40], [42, 30], [34, 24], [26, 22], [10, 20], [4.5, 14]], 0.75, TL.PATH); // 汉营 → 狄道
    m.road([[34, 24], [40, 12], [44.5, 4]], 0.7, TL.PATH);                               // → 铁笼山
    m.road([[34, 24], [32, 36], [28.5, 41]], 0.7, TL.PATH);                              // → 段谷
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.WATER && Math.abs(y - 21) < 1.6) m.set(x, y, TL.BRIDGE);
    m.prop('townicon', 2, 9, 5, 4, { label: '狄道', foot: [2, 9, 5, 4] });
    m.prop('campicon', 43, 0, 4, 3, { label: '铁笼山', foot: [43, 0, 4, 3] });
    m.prop('campicon', 27, 41, 4, 3, { label: '段谷', foot: [27, 41, 4, 3] });
    m.reserve(46, 36, 10, 7); m.reserve(26, 21, 3, 3); m.reserve(44, 3, 2, 2); m.reserve(28, 39, 2, 2);
    K.tent(m, 47, 37, { big: true, w: 5, h: 4, red: true, sign: '汉' }); K.tent(m, 53, 37, { red: true });
    K.deco(m, 'flag', 50, 41, { text: '姜', color: '#2a4a6a', tcol: '#f6e7c1' });
    m.npc({ id: 'camp33', spec: 'innkeeper', x: 52, y: 41, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '大将军，营里都备好了。', '军需官'); else if (k === 1) await G.shop(SHOP, '北伐军需');
    } });
    m.npc({ id: 'wj33', spec: 'wangjing', x: 27, y: 22, dir: 'right', aggro: true, cond: () => !G.flag('c33_tx'), marker: () => true, talk: taoxiScene });
    m.npc({ id: 'szh33', spec: 'simazhao', x: 44, y: 5, dir: 'down', aggro: true, cond: () => G.flag('c33_tx') && !G.flag('c33_tl'), marker: () => true, talk: tielongScene });
    m.npc({ id: 'da33', spec: 'dengai', x: 29, y: 39, dir: 'up', aggro: true, cond: () => G.flag('c33_tl') && !G.flag('c33_end'), marker: () => true, talk: dengaiScene });
    for (const [x, y] of [[4, 30], [10, 38], [30, 6], [50, 14], [52, 26], [8, 2], [38, 36]]) K.mountain(m, x, y);
    K.forest(m, { seed: 3311, thr: 0.64, kinds: ['autumn', 'pine', 'tree'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function taoxiScene() {
    if (G.flag('c33_tx')) return;
    await G.lines([
      ['wangjing', '雍州刺史王经在此！姜维，你背水列阵，是要自寻死路么？'],
      ['jiangwei', '背水一战，有进无退——王经，今日洮水便是你的葬身之地！'],
    ]);
    const r = await G.battle(['wangjing', 'weiqi2', 'weinu2', 'weibing2'], { bg: 'autumn', boss: true, intro: '洮西 · 王经！' });
    if (r !== 'win') return;
    G.setFlag('c33_tx');
    await G.narrate('魏兵大败，赴洮水死者数万。王经引残兵退入狄道城中，闭门不出。');
    await G.lines([
      ['xiahouba', '大将军，此乃丞相北伐以来，未有之大捷！'],
      ['jiangwei', '……若丞相在天有灵，也该笑一笑了。'],
    ]);
    await G.notice('洮西大捷！\n司马昭从北边的铁笼山来救——去迎战。');
  }

  async function tielongScene() {
    if (G.flag('c33_tl')) return;
    await G.lines([
      ['simazhao', '姜维！你敢来铁笼山？'],
      ['jiangwei', '司马昭，你被困在山上，山上无水——这一次，你跑不掉了！'],
    ]);
    const r = await G.battle(['simazhao', 'weiqi2', 'weibing2'], { bg: 'shu', boss: true, intro: '铁笼山 · 司马昭！' });
    if (r !== 'win') return;
    G.setFlag('c33_tl');
    await G.narrate('司马昭被困山上，军中无水，几乎渴死——偏偏这时，羌兵反戈，郭淮引兵杀来，解了铁笼山之围。');
    await G.lines([['jiangwei', '（仰天长叹）……又差一步！']]);
    await G.notice('魏将邓艾屯兵段谷。\n南下段谷。');
  }

  async function dengaiScene() {
    if (G.flag('c33_end')) return;
    await G.lines([
      ['dengai', '艾……艾在此等候多时了。姜维，你的兵马，可都还在？'],
      ['jiangwei', '邓艾！你这口吃的放牛娃——'],
      ['dengai', '凤兮凤兮，故是一凤……（笑）今日，便叫你见识见识。'],
    ]);
    const r = await G.battle(['dengai1', 'weiqi2', 'weinu2', 'weibing2'], { bg: 'shu', boss: true, intro: '段谷 · 邓艾！' });
    if (r !== 'win') return;
    G.setFlag('c33_end');
    await G.narrate('姜维虽击退邓艾前军，后援胡济却未能如期而至。段谷一战，蜀军死伤甚众。');
    await G.lines([
      ['jiangwei', '（上表自贬）……臣奉诏北伐，不能克复中原，致伤士卒。请贬为后将军。'],
      ['liaohua', '（叹）"兵不戢，必自焚。"伯约，蜀中已经疲惫了啊……'],
      ['jiangwei', '元俭，丞相把兵书交给我的时候，蜀中也是这般疲惫。可丞相从没停过。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[33].endLines);
  }

  G.CHAPTERS[33] = {
    title: '洮西',
    prologue: [
      '孔明死后，蒋琬、费祎先后执政，休养生息。',
      '魏国那边，司马懿发动高平陵之变，夺了曹氏的大权。',
      '夏侯渊之子夏侯霸，怕被司马氏所害，投奔蜀汉。',
      '费祎遇刺之后，姜维终于可以放手北伐了。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.leaveParty('wangping');
      G.catchUp(['jiangwei', 'madai', 'liaohua']);
      G.setParty(['jiangwei', 'madai', 'liaohua']);
      G.joinParty('xiahouba');
      G.state.party = ARMY.slice();
      G.restoreAll();
      const w = G.world;
      w.load('c33taoxi', 50, 38, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['xiahouba', '（拜伏于地）家父夏侯渊，死于定军山。霸本与蜀汉有杀父之仇……可司马懿篡权，曹家已经完了。'],
        ['jiangwei', '仲权将军不必多言。从今往后，你我同为汉臣。'],
        ['madai', '王平将军已病故于汉中……他若在，见到今日，也会欢喜的。'],
      ]);
      G.audio.sfx('levelup');
      await G.notice('王平 病故。\n夏侯霸 加入！\n西进洮水。');
    },
    endLines: [
      '姜维前后九伐中原，胜负参半。',
      '成都城中，后主宠信宦官黄皓，朝政日非。',
      '景耀六年，司马昭派钟会、邓艾，兵分两路，大举伐蜀。',
      '姜维退守剑阁天险。',
      '而邓艾，选了一条没有人走过的路——阴平小道。',
    ],
  };
})();
