/* ============================================================
 * 烽烟录 · 第七章　千里走单骑（关羽单人章节）
 * 东岭关（孔秀）→ 洛阳（韩福）→ 汜水关镇国寺（卞喜）→ 荥阳（王植）→ 黄河渡口（秦琪）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const DRY = { gh: 62, gs: 30, gl: 30, path1: '#b8986a', path2: '#c8a878' };
  const GROUPS = [{ e: ['guanbing'], w: 3 }, { e: ['guanbing', 'guanshe'], w: 2 }, { e: ['guanshe'], w: 2 }, { e: ['guanbing', 'guanbing'], w: 1 }];
  const solo = () => G.state.party.length === 1;

  // 关隘：横贯地图的城墙，中间 3 格门洞
  function passWall(m, y, plaque) {
    m.rect(0, y, m.w, 2, TL.WALL);
    m.rect(13, y, 3, 2, TL.PATH);
    m.prop('gate', 12, y, 5, 2, { nofoot: true, plaque, sortBias: 1 });
  }
  function valleyRoad(m, seed) {
    m.road([[14, m.h], [14, 0]], 1, TL.PATH);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      if (m.get(x, y) !== TL.GRASS) continue;
      const d = Math.abs(x - 14);
      if (d > 8 + G.noise(y / 5, 1, seed) * 3) m.tree(x, y, G.hash(x, y, seed) < 0.25 ? 'rock' : G.hash(x, y, seed + 1) < 0.5 ? 'pine' : 'gold');
    }
  }
  function bossAt(m, o) {
    m.npc({ id: o.id, spec: o.spec, x: 14, y: o.y, dir: 'down', aggro: true, cond: () => !G.flag(o.flag), talk: async () => {
      if (o.before) await o.before();
      await G.lines(o.lines);
      const r = await G.battle(o.group, { bg: o.bg || 'pass', boss: true, intro: o.intro });
      if (r !== 'win') return;
      G.setFlag(o.flag);
      if (o.after) await o.after();
    } });
  }

  /* ---------------- 东岭关 · 洛阳 ---------------- */
  B.c7road1 = () => {
    const m = new G.GameMap('c7road1', '东岭关 · 洛阳', 28, 64, TL.GRASS);
    Object.assign(m, { seed: 701, music: 'field', ambient: 'leaves', leafColor: 'rgba(210,160,60,0.8)', pal: DRY, battleBg: 'pass', flowers: 0.03 });
    passWall(m, 44, '东岭关'); passWall(m, 12, '洛阳');
    m.rect(5, 26, 18, 10, TL.GRASS);
    m.road([[6, 31], [22, 31]], 0.6, TL.PATH);
    valleyRoad(m, 703);
    m.prop('house', 4, 26, 5, 4, { sign: '客栈', roof: '#4a3b36' });
    m.prop('house', 19, 26, 5, 4, { sign: '杂货', roof: '#45403a' });
    m.warp(13, 0, 3, 1, 'c7road2', 14, 62, 'up');
    m.reserve(12, 61, 5, 3);
    m.npc({ id: 'inn7', spec: 'innkeeper', x: 6, y: 30, dir: 'down', talk: K.innTalk('innkeeper', 100) });
    m.npc({ id: 'shop7', spec: 'merchant', x: 21, y: 30, dir: 'down', talk: K.shopTalk('merchant', ['dabu', 'dahuan', 'meijiu', 'qiongjiang', 'xuming'], '杂货', '这位将军好生威武，这是要往哪里去？') });
    m.npc({ id: 'sao7', spec: 'madame', x: 10, y: 33, dir: 'right', talk: K.talk([['madame', '叔叔一路辛苦了。只要能见到皇叔，再苦我们姐妹也受得住。', { name: '甘夫人' }]]) });
    bossAt(m, { id: 'kongxiu', spec: 'kongxiu', y: 45, flag: 'c7_kong', group: ['kongxiu', 'guanbing'], intro: '东岭关守将 孔秀 拦路！', lines: [
      ['kongxiu', '来者可是关云长？过关须有丞相文凭。'],
      ['guanyu', '因行期慌迫，不曾讨得。'],
      ['kongxiu', '既无文凭，待我差人禀过丞相，方可放行。'],
      ['guanyu', '吾于路逢关便要盘问，误了行程。……休要多言！'],
    ], after: () => G.narrate('关羽斩孔秀，过东岭关。第一关。') });
    bossAt(m, { id: 'hanfu', spec: 'hanfu', y: 13, flag: 'c7_han', group: ['hanfu', 'guanbing', 'guanshe'], intro: '洛阳太守 韩福、牙将孟坦 拦路！', lines: [
      ['hanfu', '关羽！你斩了孔秀，还敢来洛阳？孟坦，与我拿下！'],
      ['guanyu', '挡我者死。'],
    ], after: async () => { await G.narrate('关羽先斩孟坦，臂上中了韩福一箭，拔箭裹伤，复一刀斩韩福于马下。第二关。'); } });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.PATH]: 0.012 }, groups: GROUPS };
    return m;
  };

  /* ---------------- 汜水关 · 荥阳 · 黄河渡口 ---------------- */
  B.c7road2 = () => {
    const m = new G.GameMap('c7road2', '汜水关 · 荥阳', 28, 64, TL.GRASS);
    Object.assign(m, { seed: 731, music: 'camp', ambient: 'clouds', pal: DRY, battleBg: 'pass', flowers: 0.03 });
    m.rect(0, 3, 28, 5, TL.WATER);
    passWall(m, 30, '荥阳');
    m.rect(5, 44, 18, 10, TL.GRASS);
    valleyRoad(m, 733);
    for (let y = 3; y < 8; y++) m.set(14, y, TL.BRIDGE);
    for (let y = 0; y < 3; y++) for (let x = 0; x < 28; x++) m.set(x, y, TL.GRASS);
    m.prop('hall', 9, 44, 11, 6, { sign: '镇国寺', roof: '#4a3a2a' });
    m.warp(13, 63, 3, 1, 'c7road1', 14, 1, 'down');
    m.reserve(12, 60, 5, 3);
    // 普净报信：卞喜伏兵之前一定会发生（没先找普净，开打前他也会赶来报信并让关羽歇息）
    const monkWarn = async () => {
      if (G.flag('c7_monk')) return;
      await G.lines([
          ['monk', '将军离蒲东几年矣？'],
          ['guanyu', '将及二十年矣。'],
          ['monk', '还认得贫僧否？贫僧普净，与将军乃是同乡。'],
          ['monk', '（以手举所佩戒刀，以目视关公）——卞喜在寺内伏下刀斧手，欲害将军，务必小心！'],
          ['guanyu', '……多谢吾师。'],
      ]);
      G.setFlag('c7_monk');
    };
    const monkRest = async () => {
      await say('monk', '将军且在寺中歇息片刻。');
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    };
    m.npc({ id: 'monk', spec: 'monk', x: 10, y: 51, dir: 'right', marker: () => !G.flag('c7_monk'), talk: async () => {
      await monkWarn(); await monkRest();
      const s = await G.choose(['记录进度', '不用了']);
      if (s === 0) await G.saveMenu();
    } });
    bossAt(m, { id: 'bianxi', spec: 'bianxi', y: 50, flag: 'c7_bian', group: ['bianxi', 'guanbing'], intro: '汜水关守将 卞喜 伏兵杀出！',
      before: async () => { if (!G.flag('c7_monk')) { await monkWarn(); await monkRest(); } }, lines: [
      ['bianxi', '将军远来辛苦，请入寺中饮宴……左右，动手！'],
      ['guanyu', '吾以汝为好人，安敢如此！'],
    ], after: () => G.narrate('卞喜飞锤打来，被关羽一刀砍断，再一刀劈卞喜为两段。第三关。') });
    m.npc({ id: 'huban', spec: 'huban', x: 18, y: 34, dir: 'left', marker: () => !G.flag('c7_hu'), talk: async () => {
      if (!G.flag('c7_hu')) {
        await G.lines([
          ['huban', '将军……在下胡班，家父胡华，曾托将军捎来家书。'],
          ['huban', '王植太守已在馆驿四周堆满柴草，今夜三更要放火烧死将军！请将军速速出城！'],
          ['guanyu', '若非令尊之信，关某几死于奸人之手！'],
        ]);
        G.setFlag('c7_hu');
      } else await say('huban', '将军快走，王植就在城门口！');
    } });
    bossAt(m, { id: 'wangzhi', spec: 'wangzhi', y: 31, flag: 'c7_wang', group: ['wangzhi', 'guanshe'], intro: '荥阳太守 王植 纵火追来！', lines: [
      ['wangzhi', '关羽休走！今夜便叫你葬身火海！'],
      ['guanyu', '吾与汝无仇，何故放火害我！'],
    ], after: () => G.narrate('关羽拍马赶上，拦腰一刀，砍王植为两段。第四关。') });
    bossAt(m, { id: 'qinqi', spec: 'qinqi', y: 8, flag: 'c7_qin', group: ['qinqi', 'guanbing', 'guanshe'], bg: 'field', intro: '黄河渡口守将 秦琪 拦路！', lines: [
      ['qinqi', '我乃夏侯惇部将秦琪！没有丞相公文，便插翅也休想过河！'],
      ['guanyu', '你知我于路斩戮拦截者乎？'],
      ['qinqi', '你只杀得无名下将，敢杀我么？'],
    ], after: finale });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.PATH]: 0.012 }, groups: GROUPS };
    m.onEnter = async () => { if (G.flag('c7_r2')) return; G.setFlag('c7_r2'); await say('guanyu', '前方便是汜水关。听说守将卞喜，善使流星锤。'); };
    return m;
  };

  async function finale() {
    await G.narrate('两马相交，只一合，关公刀起，秦琪头落。第五关。');
    await G.narrate('关羽护送车仗，渡过黄河，入袁绍地界。');
    await G.lines([
      ['guanyu', '过五关，斩六将……大哥，云长来了。'],
      ['madame', '叔叔……', { name: '甘夫人' }],
    ]);
    await G.chapterEnd(G.CHAPTERS[7].endLines);
  }

  G.CHAPTERS[7] = {
    title: '千里走单骑',
    prologue: [
      '关羽身在曹营，曹操三日一小宴，五日一大宴，赠金赐袍，送赤兔马。',
      '关羽为曹操斩颜良、诛文丑，以报其恩。',
      '一日，关羽得知兄长刘备身在河北袁绍处。',
      '当即封金挂印，留书辞曹，护送二位嫂嫂，单骑北行。',
      '然而沿途关隘，皆无曹操文凭……',
    ],
    start: async () => {
      G.stashParty(['guanyu']);
      const w = G.world;
      w.load('c7road1', 14, 60, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['madame', '叔叔，曹丞相不给文凭，这一路关隘，可如何过得去？', { name: '甘夫人' }],
        ['guanyu', '嫂嫂放心。关某便是拼了这条性命，也要把二位嫂嫂平安送到大哥身边。'],
      ]);
      await G.notice('本章只有关羽一人出战。\n善用「斩将」「拖刀计」，记得在客栈和寺中休整。');
    },
    endLines: [
      '关羽千里走单骑，过五关，斩六将，忠义之名震动天下。',
      '然而渡过黄河，才知刘备已离开袁绍，前往汝南。',
      '关羽转道南下，途中收了一员黑面大汉，名叫周仓。',
      '行至一座古城，听说城中有位黑脸将军，',
      '赶走县官，占了城池，自称……张飞。',
    ],
  };
})();
