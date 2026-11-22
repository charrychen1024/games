/* ============================================================
 * 烽烟录 · 第三十章　卤城（第七部完）
 * 陇上（孔明装神割麦、郭淮）→ 卤城（夜破司马懿）→ 木门道（万弩射张郃）→ 关兴病逝
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const LX = { gh: 60, gs: 40, gl: 34 };
  const SHOP = ['huixin', 'jiuzhuan', 'yuquan', 'qianjin', 'xuming', 'nanzhong', 'muniu', 'wuxing', 'zhuge'];
  const ARMY = ['zhugeliang', 'weiyan', 'guanxing', 'jiangwei', 'wangping'];
  const GROUPS = [{ e: ['weibing', 'weibing'], w: 3 }, { e: ['weiqi', 'weinu'], w: 3 }, { e: ['weiqi', 'weiqi', 'weibing'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  B.c30longxi = () => {
    const m = new G.GameMap('c30longxi', '陇 西', 58, 44, TL.GRASS);
    Object.assign(m, { seed: 3001, music: 'field', ambient: 'leaves', leafColor: 'rgba(220,190,90,0.8)', pal: LX, battleBg: 'autumn', flowers: 0.02 });
    K.tallGrass(m, 3003, 0.42);                                                            // 麦田
    m.road([[50.5, 40], [44, 30], [30, 26], [16, 22], [6.5, 14]], 0.8, TL.PATH);          // 汉营 → 卤城
    m.road([[30, 26], [30, 10], [28.5, 2]], 0.7, TL.PATH);                               // → 上邽（魏营）
    m.road([[16, 22], [8, 34], [3.5, 42]], 0.7, TL.PATH);                                // → 木门道
    m.prop('townicon', 4, 9, 5, 4, { label: '卤城', foot: [4, 9, 5, 4] });
    m.prop('townicon', 26, 0, 5, 2, { label: '上邽', foot: [26, 0, 5, 2] });
    m.reserve(46, 36, 10, 7); m.reserve(5, 13, 3, 3); m.reserve(27, 2, 3, 3); m.reserve(2, 41, 3, 3);
    K.tent(m, 47, 37, { big: true, w: 5, h: 4, red: true, sign: '汉' }); K.tent(m, 53, 37, { red: true });
    m.npc({ id: 'camp30', spec: 'innkeeper', x: 52, y: 41, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '丞相，陇上麦子熟了，正好充作军粮。', '军需官'); else if (k === 1) await G.shop(SHOP, '北伐军需');
    } });
    m.event({ type: 'inspect', x: 36, y: 30, w: 4, h: 3, run: maiScene });
    K.deco(m, 'sign', 35, 29, { text: '麦田' });
    m.npc({ id: 'gh30', spec: 'guohuai', x: 30, y: 18, dir: 'down', aggro: true, cond: () => G.flag('c30_mai') && !G.flag('c30_gh'), marker: () => true, talk: guohuaiScene });
    m.npc({ id: 'smy30', spec: 'simayi', x: 7, y: 16, dir: 'right', aggro: true, cond: () => G.flag('c30_gh') && !G.flag('c30_lc'), marker: () => true, talk: luchengScene });
    m.npc({ id: 'zh30', spec: 'zhanghe', x: 4, y: 38, dir: 'up', aggro: true, cond: () => G.flag('c30_lc') && !G.flag('c30_end'), marker: () => true, talk: mumenScene });
    for (const [x, y] of [[2, 2], [14, 4], [40, 4], [50, 12], [2, 26], [20, 36], [36, 40], [44, 18]]) K.mountain(m, x, y);
    K.forest(m, { seed: 3011, thr: 0.66, kinds: ['autumn', 'tree', 'pine'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.06, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function maiScene() {
    if (G.flag('c30_mai')) { await G.narrate('麦子都割完了。'); return; }
    await G.narrate('陇上小麦已熟。孔明令姜维、魏延、马岱各扮作孔明模样，坐四轮车，二十四人披发仗剑，手执七星皂幡，推车而行——');
    await G.narrate('魏兵望见，以为神兵天降，不敢靠近。三万精兵，趁势把陇上的麦子尽数割了，运回卤城。');
    await G.lines([
      ['simayi', '（远望，大惊）……前面一个孔明，后面又一个孔明，左右各有一个孔明——此必是"八门遁甲"之术，能驱六丁六甲之神也！'],
    ]);
    G.setFlag('c30_mai');
    G.addItem('muniu', 2);
    await G.notice('割得陇上麦子！\n获得 木牛军粮 ×2\n郭淮从北边的上邽杀来。');
  }

  async function guohuaiScene() {
    if (G.flag('c30_gh')) return;
    await G.lines([
      ['guohuai', '都督休要惊慌，那是孔明的障眼法！看郭淮去破了他！'],
      ['jiangwei', '郭淮！你中了丞相之计了！'],
    ]);
    const r = await G.battle(['guohuai', 'weiqi', 'weinu'], { bg: 'autumn', boss: true, intro: '雍州刺史 郭淮！' });
    if (r !== 'win') return;
    G.setFlag('c30_gh');
    await G.notice('孔明退守卤城。\n司马懿引兵来攻——去卤城外迎敌。');
  }

  async function luchengScene() {
    if (G.flag('c30_lc')) return;
    await G.narrate('司马懿趁夜来攻卤城。孔明早令伏兵于麦田之中，四面火起，喊声震天——');
    await G.lines([
      ['simayi', '（大惊）诸葛亮又早算定了！'],
      ['zhugeliang', '仲达，你我交手多年，还不知亮的手段么？'],
    ]);
    const r = await G.battle(['simayi2', 'weiqi', 'weibing', 'weinu'], { bg: 'autumn', boss: true, intro: '卤城夜战 · 司马懿！' });
    if (r !== 'win') return;
    G.setFlag('c30_lc');
    await G.narrate('魏兵大败，死伤无数。司马懿退回营寨，坚守不出。');
    await G.narrate('正在此时，成都李严差人来报："东吴将要犯蜀，请丞相速速回军！"孔明只得传令，分兵退回汉中。');
    await G.lines([
      ['zhugeliang', '……司马懿见我退兵，必遣张郃来追。木门道两山夹峙，正好伏兵。'],
    ]);
    await G.notice('退往西南的木门道。');
  }

  async function mumenScene() {
    if (G.flag('c30_end')) return;
    await G.lines([
      ['zhanghe', '诸葛亮休走！'],
      ['weiyan', '（且战且走）张郃！来追啊！'],
    ]);
    const r = await G.battle(['zhanghe5', 'weiqi', 'weiqi'], { bg: 'gorge', boss: true, intro: '木门道 · 张郃追兵！' });
    if (r !== 'win') return;
    G.setFlag('c30_end');
    await G.narrate('张郃追至木门道，天色已晚。忽然山上一声梆子响，火光冲天，大石乱柴，滚将下来，阻断了归路——');
    G.audio.sfx('down'); G.shake(10, 0.8);
    await G.narrate('两边万弩齐发。张郃与百余部将，皆射死于木门道中。');
    await G.lines([
      ['zhugeliang', '（立于山上，叹曰）……可惜了，张儁乂。自长坂坡至今，他与我军，交手已二十余年。'],
    ]);
    await G.fadeOut(1.2);
    await G.narrate('孔明回到汉中，才知李严所报不实——原来是李严督运粮草不济，怕担罪责，假传军情。孔明大怒，废李严为庶人。');
    await G.narrate('不久，又传来噩耗：关兴病亡。');
    G.leaveParty('guanxing'); G.world.refreshParty();
    await G.fadeIn(1.0);
    await G.lines([
      ['zhugeliang', '（放声大哭，昏倒于地，半晌方苏）……可怜忠义之人，天不与以寿！我今番出师，又少一员大将也！'],
    ]);
    await G.notice('关兴 病亡。\n（他的护甲放回了行囊）');
    await G.chapterEnd(G.CHAPTERS[30].endLines);
  }

  G.CHAPTERS[30] = {
    title: '卤城',
    prologue: [
      '建兴九年，孔明四出祁山。',
      '军中缺粮，正值陇上麦熟。',
      '孔明对众将说："司马懿料吾缺粮，必来争麦。"',
      '"吾自有妙计，教他不敢近前。"',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(ARMY);
      G.setParty(ARMY);
      G.restoreAll();
      const w = G.world;
      w.load('c30longxi', 50, 38, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhugeliang', '陇上之麦，正好充作军粮。伯约，随吾去麦田。'],
      ]);
      await G.notice('去西边的麦田割麦。');
    },
    endLines: [
      '孔明休兵三年，劝农讲武，造木牛流马，以运粮草。',
      '建兴十二年春，孔明对后主说：',
      '"臣今存者，亦已五十有四。今不北伐，更待何时？"',
      '这是他第六次出祁山，也是最后一次。',
      '（第七部　完）',
    ],
  };
})();
