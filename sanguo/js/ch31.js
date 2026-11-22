/* ============================================================
 * 烽烟录 · 第三十一章　上方谷（第八部开篇）
 * 渭南（木牛流马、王平赚魏兵、司马昭劫粮）→ 上方谷（火烧司马懿、天降大雨）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const WN = { gh: 76, gs: 26, gl: 28 };
  const SHOP = ['jiuzhuan', 'shenyao', 'qianjin', 'lingzhi', 'xuming', 'muniu', 'hanjia', 'zhuge', 'zhaolie'];
  const ARMY = ['zhugeliang', 'weiyan', 'jiangwei', 'wangping', 'madai', 'liaohua'];
  const GROUPS = [{ e: ['weibing2', 'weibing2'], w: 3 }, { e: ['weibing2', 'weinu2'], w: 3 }, { e: ['weiqi2', 'weiqi2'], w: 2 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  B.c31weinan = () => {
    const m = new G.GameMap('c31weinan', '渭 南', 58, 44, TL.GRASS);
    Object.assign(m, { seed: 3101, music: 'field', ambient: 'clouds', pal: WN, battleBg: 'shu', flowers: 0.03 });
    K.tallGrass(m, 3103, 0.56);
    m.road([[0, 10], [14, 12], [30, 10], [44, 12], [58, 11]], 1.6, TL.WATER);              // 渭水
    m.road([[28.5, 42], [28.5, 30], [20, 24], [12.5, 18]], 0.75, TL.PATH);               // 大营 → 北原
    m.road([[28.5, 30], [42, 26], [50.5, 20]], 0.75, TL.PATH);                           // → 上方谷
    m.road([[28.5, 36], [12, 36], [6, 36]], 0.6, TL.PATH);                               // → 运粮道
    m.prop('townicon', 10, 14, 5, 4, { label: '北原', foot: [10, 14, 5, 4] });
    m.prop('campicon', 49, 15, 4, 4, { label: '上方谷', foot: [49, 15, 4, 4] });
    m.reserve(24, 36, 10, 8); m.reserve(12, 18, 2, 2); m.reserve(49, 19, 3, 3); m.reserve(3, 34, 4, 4);
    K.tent(m, 24, 37, { big: true, w: 5, h: 4, red: true, sign: '汉' }); K.tent(m, 31, 38, { red: true });
    K.deco(m, 'flag', 27, 41, { text: '诸', color: '#2a3a5a', tcol: '#f6e7c1' });
    m.npc({ id: 'camp31', spec: 'innkeeper', x: 31, y: 41, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '丞相，夜里风凉，早些歇息。', '军需官'); else if (k === 1) await G.shop(SHOP, '五丈原军需');
    } });
    m.npc({ id: 'gj31', spec: 'smith', x: 26, y: 41, dir: 'right', marker: () => !G.flag('c31_mn'), talk: muniuScene });
    m.prop('cart', 4, 35, 1, 1, { foot: [4, 35, 1, 1] }); m.prop('cart', 6, 37, 1, 1, { foot: [6, 37, 1, 1] });
    K.guard(m, { id: 'qiang31', spec: 'weibing', x: 8, y: 36, dir: 'right', flag: 'c31_qiang', group: ['weibing2', 'weiqi2', 'weinu2'], intro: '魏兵来抢木牛流马！', bg: 'shu', cond: () => G.flag('c31_mn'),
      lines: [['weibing', '司马都督有令：抢几匹木牛流马回去，照样仿造！', { name: '魏将' }]],
      after: async () => {
        await G.narrate('魏兵抢去了数十匹木牛流马。司马懿照样仿造二千余匹，令军士驱驾运粮——');
        await G.narrate('王平令军士扮作魏兵，混入运粮队中，把木牛流马口内舌头扭转——牛马便不能行动。魏兵只得弃了粮车而走。');
        await G.lines([['wangping', '（大笑）丞相此计，真是神机妙算！魏狗的粮草，全归我们了！']]);
        G.addItem('muniu', 3);
        await G.notice('赚得魏军粮草！\n获得 木牛军粮 ×3');
      } });
    m.npc({ id: 'szh31', spec: 'simazhao', x: 13, y: 20, dir: 'down', aggro: true, cond: () => G.flag('c31_qiang') && !G.flag('c31_zh'), marker: () => true, talk: zhaoScene });
    m.event({ type: 'step', x: 49, y: 19, w: 3, h: 3, run: shangfangScene });
    m.npc({ id: 'smy31', spec: 'simayi', x: 50, y: 20, dir: 'down', aggro: true, cond: () => G.flag('c31_zh') && !G.flag('c31_end'), marker: () => true, talk: shangfangScene });
    for (const [x, y] of [[4, 2], [20, 2], [40, 2], [4, 22], [16, 30], [40, 34], [50, 30], [36, 18]]) K.mountain(m, x, y);
    K.forest(m, { seed: 3111, thr: 0.62, kinds: ['pine', 'tree', 'dark'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function muniuScene() {
    if (G.flag('c31_mn')) { await say('smith', '木牛流马都造好了，在西边的运粮道上。', { name: '工匠' }); return; }
    await G.lines([
      ['smith', '丞相，照您画的图样，木牛流马造好了！不吃不喝，可昼夜转运。', { name: '工匠' }],
      ['zhugeliang', '"方腹曲头，一脚四足；头入领中，舌着于腹。载多而行少……"——好，好。'],
      ['jiangwei', '丞相，若魏兵抢了去，照样仿造，如何是好？'],
      ['zhugeliang', '（笑）吾正要他抢去。'],
    ]);
    G.setFlag('c31_mn');
    await G.notice('木牛流马运粮！\n去西边的运粮道看看。');
  }

  async function zhaoScene() {
    if (G.flag('c31_zh')) return;
    await G.lines([
      ['simazhao', '诸葛亮！你们屯粮于上方谷，以为我不知道么？'],
      ['madai', '司马昭小儿，看刀！'],
    ]);
    const r = await G.battle(['simazhao', 'weiqi2', 'weinu2'], { bg: 'shu', boss: true, intro: '司马昭！' });
    if (r !== 'win') return;
    G.setFlag('c31_zh');
    await G.narrate('司马懿闻报孔明屯粮于上方谷，大喜，亲引二子，来劫上方谷。');
    await G.lines([['zhugeliang', '文长，你只许败，不许胜。把司马懿引入上方谷——']]);
    await G.notice('东去上方谷。');
  }

  async function shangfangScene() {
    if (!G.flag('c31_zh') || G.flag('c31_end')) return;
    await G.narrate('魏延佯败，司马懿父子追入谷中。只见谷中草房上，尽是干柴——');
    await G.lines([
      ['simayi', '（大惊）……若断谷口，如之奈何？'],
      ['weiyan', '（于谷口大笑）司马懿！今番你走不脱了！'],
    ]);
    const r = await G.battle(['simayi3', 'weibing2', 'weiqi2', 'weinu2'], { bg: 'yiling', boss: true, intro: '火烧上方谷 · 司马懿！' });
    if (r !== 'win') return;
    G.setFlag('c31_end');
    await G.narrate('司马懿父子抱头大哭："我父子三人皆死于此处矣！"——却得这一场大雨，三人奋力杀出谷口。');
    await G.lines([
      ['zhugeliang', '（望天长叹）……谋事在人，成事在天。不可强也！'],
    ]);
    await G.chapterEnd(G.CHAPTERS[31].endLines);
  }

  G.CHAPTERS[31] = {
    title: '上方谷',
    prologue: [
      '建兴十二年，孔明六出祁山，屯兵五丈原。',
      '司马懿据守北原，坚壁不出。',
      '两军隔着渭水，相持百余日。',
      '孔明对众将说："粮道既通，吾与仲达，且看谁耐得久。"',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(['zhugeliang', 'weiyan', 'jiangwei', 'wangping']);
      G.setParty(['zhugeliang', 'weiyan', 'jiangwei', 'wangping']);
      G.joinParty('madai'); G.joinParty('liaohua');
      G.state.party = ARMY.slice();
      G.restoreAll();
      const w = G.world;
      w.load('c31weinan', 28, 34, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['madai', '马岱参见丞相！兄长临终有言：马家之人，誓随丞相北伐！'],
        ['liaohua', '老将廖化，随关将军镇守荆州时，丞相还未出茅庐呢……如今，也来尽一份力。'],
      ]);
      G.audio.sfx('levelup');
      await G.notice('马岱、廖化 加入！\n第八部：五丈原。\n营中工匠有事禀报。');
    },
    endLines: [
      '司马懿逃回北原，从此坚守不出。',
      '孔明派人送去妇人衣服和书信，羞辱他"不敢出战，与妇人何异"。',
      '司马懿笑纳了衣服，只问来使："孔明寝食及事之烦简若何？"',
      '来使答："丞相夙兴夜寐，罚二十以上皆亲览焉，所啖之食，日不过数升。"',
      '司马懿对诸将说："孔明食少事烦，其能久乎？"',
    ],
  };
})();
