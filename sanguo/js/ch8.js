/* ============================================================
 * 烽烟录 · 第八章　古城会
 * 古城（张飞疑关羽、斩蔡阳、兄弟重逢）→ 卧牛山（裴元绍、赵云归来）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const LUSH = { gh: 88, gs: 38, gl: 28 };
  G.SPECS.sunqian = { skin: '#eec7a0', hair: '#141010', robe: '#5a4a6a', robe2: '#e8dcc0', trim: '#c8c0a0', pants: '#2a2236', hat: 'crown', hatColor: '#111', beard: 'thin', banner: '#5a4a6a' };
  G.NAMES.sunqian = '孙乾';

  /* ---------------- 古城 ---------------- */
  B.c8gucheng = () => {
    const m = new G.GameMap('c8gucheng', '古 城', 34, 36, TL.GRASS);
    Object.assign(m, { seed: 801, music: 'field', ambient: 'leaves', pal: LUSH, battleBg: 'city', flowers: 0.05 });
    m.rect(0, 0, 34, 4, TL.WALL);
    m.rect(15, 2, 3, 2, TL.WALL);
    m.prop('gate', 14, 2, 5, 2, { nofoot: true, plaque: '古城', sortBias: 1 });
    m.road([[16.5, 36], [16.5, 4]], 0.8, TL.PATH);
    m.road([[16, 20.5], [33, 20.5]], 0.6, TL.PATH);
    m.warp(33, 20, 1, 2, 'c8wolong', 2, 40, 'up', () => G.flag('c8_reunion'), '先在古城与兄弟们会合吧。');
    m.warp(15, 35, 4, 1, 'c8gucheng', 16, 34, 'up', () => false, '来路已远，还是去古城吧。');
    // 城外集市
    for (const [x, y] of [[5, 8], [24, 8], [5, 24], [24, 25]]) K.tent(m, x, y, { red: true });
    for (const [x, y] of [[11, 5], [21, 5]]) K.deco(m, 'flag', x, y, { text: '张', color: '#2b2b33', tcol: '#f6e7c1' });
    K.deco(m, 'well', 12, 14); K.deco(m, 'crates', 21, 14); K.deco(m, 'jar', 9, 18);
    for (let y = 4; y < m.h; y++) for (const x of [0, 1, 32]) if (!(x === 32 && y >= 19 && y <= 22)) m.tree(x, y, G.hash(x, y) < 0.5 ? 'tree' : 'dark');
    for (let x = 2; x < 32; x++) if (x < 14 || x > 19) m.tree(x, 35, 'tree');
    K.forest(m, { seed: 803, thr: 0.7, edge: false, kinds: ['tree', 'pine'] });
    m.npc({ id: 'inn8', spec: 'innkeeper', x: 8, y: 12, dir: 'down', talk: K.innTalk('innkeeper', 100) });
    m.npc({ id: 'shop8', spec: 'merchant', x: 27, y: 12, dir: 'down', talk: K.shopTalk('merchant', ['dabu', 'dahuan', 'meijiu', 'qiongjiang', 'xuming', 'jingliang', 'longlin'], '集市', '古城新来了位张将军，治得这一带太平多了！') });
    m.npc({ id: 'zf8', spec: 'zhangfei', x: 16, y: 5, dir: 'down', aggro: true, cond: () => !G.flag('c8_cai'), talk: zhangfeiScene });
    m.npc({ id: 'sq8', spec: 'sunqian', x: 19, y: 7, dir: 'down', cond: () => G.flag('c8_cai'), marker: () => !G.flag('c8_reunion'), talk: async () => {
      if (G.flag('c8_reunion')) { await say('sunqian', '东去卧牛山，听说有一伙山贼盘踞。'); return; }
      await G.lines([
        ['sunqian', '二将军！在下孙乾。主公已辞了袁绍，此刻正在城中！'],
      ]);
      await G.fadeOut(0.8);
      G.unstash(['liubei', 'jianyong']);
      G.state.party = ['liubei', 'guanyu', 'zhangfei', 'jianyong'].filter(id => G.state.party.includes(id));
      G.world.refreshParty(); G.restoreAll();
      await G.fadeIn(0.8);
      await G.lines([
        ['liubei', '二弟！三弟！'],
        ['guanyu', '大哥……！'],
        ['zhangfei', '大哥！二哥！哈哈哈……俺、俺不哭！'],
        ['liubei', '自徐州失散，日夜悬望。今日兄弟重逢，真乃天意！'],
        ['jianyong', '玄德，我从袁绍那里一路跟来，也算不枉此行了。'],
        ['liubei', '只可惜子龙不在……听说他离了公孙瓒，不知流落何方。'],
        ['sunqian', '主公，东边卧牛山有一伙山贼，头目叫裴元绍。近日听说有位白袍将军路过，与他们厮杀了起来。'],
        ['liubei', '白袍将军？莫非是……走，去卧牛山！'],
      ]);
      G.setFlag('c8_reunion');
      await G.notice('刘备、简雍归队！\n向东前往卧牛山。');
    } });
    m.npc({ id: 'zc8', spec: 'zhoucang', x: 13, y: 9, dir: 'right', cond: () => G.flag('c8_cai'), talk: K.talk([['zhoucang', '俺周仓，愿给关将军扛一辈子大刀！']]) });
    return m;
  };

  async function zhangfeiScene() {
    await G.lines([
      ['guanyu', '三弟！'],
      ['zhangfei', '……关羽！你还有脸来见我！'],
      ['guanyu', '三弟何出此言？'],
      ['zhangfei', '你背了兄长，降了曹操，封侯赐爵，今日又来赚俺！俺与你拼个死活！'],
      ['madame', '三叔休要如此！二叔是为了保护我们，才暂栖曹营的……', { name: '甘夫人' }],
      ['zhangfei', '嫂嫂休被他瞒过了！忠臣宁死而不辱，大丈夫岂有事二主之理！'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('正说话间，远处尘头大起，一彪曹军杀来，为首大将正是蔡阳。');
    await G.lines([
      ['zhangfei', '看！你还说不是来赚俺的？曹兵都跟来了！'],
      ['guanyu', '……三弟，我斩此来将，以表真心！'],
      ['zhangfei', '好！俺擂鼓三通，你若斩不了他，便是假的！'],
      ['caiyang', '关羽！你杀我外甥秦琪，今日我奉丞相之命，取你首级！'],
    ]);
    const r = await G.battle(['caiyang'], { bg: 'city', boss: true, party: ['guanyu'], intro: '三通鼓未尽——关羽 斩蔡阳！' });
    if (r !== 'win') return;
    G.setFlag('c8_cai');
    await G.narrate('张飞亲自擂鼓。一通鼓未尽，关公刀起处，蔡阳头已落地。');
    await G.lines([
      ['zhangfei', '……二哥！'],
      ['zhangfei', '是俺错怪了二哥！俺……俺给二哥磕头赔罪！'],
      ['guanyu', '三弟快起来。兄弟之间，何须如此。'],
    ]);
    G.unstash(['zhangfei']); G.world.refreshParty();
    await G.notice('张飞归队！');
  }

  /* ---------------- 卧牛山 ---------------- */
  B.c8wolong = () => {
    const m = new G.GameMap('c8wolong', '卧牛山', 30, 44, TL.GRASS);
    Object.assign(m, { seed: 831, music: 'camp', ambient: 'clouds', pal: { gh: 96, gs: 30, gl: 22 }, battleBg: 'field', flowers: 0.02 });
    const pts = [[2, 44], [2, 38], [9, 34], [9, 26], [20, 22], [22, 14], [15, 9], [15, 4]];
    const clear = new Set();
    m.road(pts, 2.4, null, (x, y) => clear.add(x + ',' + y));
    for (let y = 1; y <= 9; y++) for (let x = 7; x <= 23; x++) clear.add(x + ',' + y);
    for (let y = 37; y <= 43; y++) for (let x = 0; x <= 5; x++) clear.add(x + ',' + y);
    m.road(pts, 0.7, TL.PATH);
    m.warp(0, 41, 1, 3, 'c8gucheng', 32, 20, 'left');
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!clear.has(x + ',' + y) && !(x === 0 && y >= 41)) m.tree(x, y, G.hash(x, y, 3) < 0.2 ? 'rock' : G.hash(x, y, 4) < 0.5 ? 'pine' : 'dark');
    K.tent(m, 9, 2, {}); K.tent(m, 18, 2, {});
    K.deco(m, 'fire', 13, 4); K.deco(m, 'flag', 8, 6, { text: '裴', color: '#5a4a3a', tcol: '#f6e7c1' });
    const SZ = [{ e: ['shanzei', 'shanzei'], w: 2 }, { e: ['shanzei', 'shanzei2'], w: 1 }];
    K.guard(m, { id: 'w1', spec: 'shanzei', x: 9, y: 30, flag: 'c8_w1', group: ['shanzei', 'shanzei', 'shanzei2'], lines: [['shanzei', '此山是我开！留下买路财！']] });
    K.guard(m, { id: 'w2', spec: 'shanzei', x: 21, y: 17, flag: 'c8_w2', group: ['shanzei2', 'shanzei', 'shanzei'] });
    m.npc({ id: 'zy8', spec: 'zhaoyun', x: 18, y: 7, dir: 'left', cond: () => !G.flag('c8_zhao') });
    m.npc({ id: 'pei', spec: 'peiyuanshao', x: 15, y: 6, dir: 'down', aggro: true, cond: () => !G.flag('c8_zhao'), talk: async () => {
      await G.lines([
        ['peiyuanshao', '又来几个不怕死的！那白袍小子杀了俺几十个弟兄，你们也一起留下吧！'],
        ['liubei', '那白袍将军……子龙！是子龙！'],
        ['zhaoyun', '……玄德公？！'],
        ['zhangfei', '子龙，俺们来帮你！'],
      ]);
      const r = await G.battle(['peiyuanshao', 'shanzei2', 'shanzei'], { bg: 'field', boss: true, intro: '卧牛山贼首 裴元绍 杀到！' });
      if (r !== 'win') return;
      G.setFlag('c8_zhao');
      G.unstash(['zhaoyun']); G.world.refreshParty();
      await G.lines([
        ['zhaoyun', '玄德公！子龙离了公孙瓒，四处寻访明公，不想今日在此相遇！'],
        ['liubei', '吾初见子龙，便有留恋不舍之情。今日幸得相遇！'],
        ['zhaoyun', '云奔走四方，择主而事，未见如将军者。今得相随，大称平生。虽肝脑涂地，无恨矣！'],
      ]);
      await G.notice('赵云归队！');
      await G.chapterEnd(G.CHAPTERS[8].endLines);
    } });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.PATH]: 0.012 }, groups: SZ };
    return m;
  };

  G.CHAPTERS[8] = {
    title: '古城会',
    prologue: [
      '关羽一路南下，寻找兄长。',
      '途中收了黑面大汉周仓，愿为关羽执刀随行。',
      '行至汝南境内一座小城，闻听城中有位黑脸将军……',
    ],
    start: async () => {
      if (G.state.party.length !== 1) G.stashParty(['guanyu']);
      const w = G.world;
      w.load('c8gucheng', 16, 30, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhoucang', '将军，前面便是古城。听说占城的那位将军，姓张，使一杆丈八蛇矛！'],
        ['guanyu', '……是三弟！三弟果然在此！'],
      ]);
    },
    endLines: [
      '刘关张赵，兄弟复聚于古城。',
      '然而曹操已在官渡大破袁绍，北方尽归曹氏。',
      '刘备兵少将寡，在汝南又被曹操击败，',
      '只得南投荆州刘表，屯兵于小县新野。',
      '一住便是数年。刘备抚髀长叹：髀肉复生，而功业不建……',
    ],
  };
})();
