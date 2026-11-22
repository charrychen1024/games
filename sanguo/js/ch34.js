/* ============================================================
 * 烽烟录 · 第三十四章　三分归晋（终章）
 * 剑阁（姜维拒钟会）→ 绵竹（诸葛瞻父子死节）→ 后主出降、姜维假降、一计害三贤 → 尾声
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SHOP = ['jiuzhuan', 'shenyao', 'qianjin', 'lingzhi', 'xuming', 'muniu', 'hanjia', 'zhuge', 'zhaolie'];
  const ARMY = ['jiangwei', 'madai', 'liaohua', 'xiahouba'];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  /* ---------------- 剑阁 ---------------- */
  B.c34jiange = () => {
    const m = new G.GameMap('c34jiange', '剑 阁', 36, 40, TL.GRASS);
    Object.assign(m, { seed: 3401, music: 'boss', ambient: 'clouds', pal: { gh: 96, gs: 22, gl: 24 }, battleBg: 'jiameng', flowers: 0.01, under: TL.SOIL });
    K.walls(m, 0, 17, 35, 19, [{ side: 'n', x: 16, plaque: '剑门关' }]);
    m.rect(1, 19, 34, 1, TL.WALL); m.rect(16, 17, 3, 3, TL.PATH);
    m.road([[17.5, 40], [17.5, 0]], 1, TL.PATH);
    m.rect(10, 4, 16, 10, TL.SOIL);
    K.tent(m, 11, 3, { w: 3, h: 3 }); K.tent(m, 23, 3, { w: 3, h: 3 });
    for (const [x, y] of [[10, 12], [25, 12]]) K.deco(m, 'flag', x, y, { text: '钟', color: '#24304a', tcol: '#f6e7c1' });
    K.tent(m, 6, 27, { big: true, w: 5, h: 4, red: true, sign: '汉' }); K.tent(m, 26, 28, { red: true });
    K.deco(m, 'flag', 14, 22, { text: '姜', color: '#2a4a6a', tcol: '#f6e7c1' }); K.deco(m, 'flag', 21, 22, { text: '汉', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.reserve(15, 30, 5, 10); m.reserve(9, 3, 18, 12);
    for (const [x, y] of [[1, 2], [28, 2], [1, 24], [29, 24], [2, 34], [28, 34]]) K.mountain(m, x, y, 1);
    K.forest(m, { seed: 3405, thr: 0.55, kinds: ['pine', 'dark', 'pine'], avoid: 1 });
    m.warp(16, 39, 3, 1, 'c34jiange', 17, 37, 'up', () => false, '剑阁一失，蜀中再无屏障。');
    m.npc({ id: 'jg34inn', spec: 'innkeeper', x: 20, y: 33, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '大将军，剑阁天险，一夫当关，万夫莫开！', '军需官'); else if (k === 1) await G.shop(SHOP, '剑阁军需');
    } });
    m.npc({ id: 'zh34', spec: 'zhonghui', x: 17, y: 9, dir: 'down', aggro: true, cond: () => !G.flag('c34_jg'), marker: () => true, talk: jiangeScene });
    return m;
  };

  async function jiangeScene() {
    if (G.flag('c34_jg')) return;
    await G.lines([
      ['zhonghui', '姜伯约，蜀中已无可战之兵，何必苦守孤关？'],
      ['jiangwei', '钟会，剑阁在，蜀汉便在。你的十万大军，过得去么？'],
    ]);
    const r = await G.battle(['zhonghui', 'weiqi2', 'weinu2', 'weibing2'], { bg: 'jiameng', boss: true, intro: '剑阁 · 钟会！' });
    if (r !== 'win') return;
    G.setFlag('c34_jg');
    await G.narrate('钟会连攻剑阁不下，粮道艰难，已有退兵之意——');
    await G.narrate('就在此时，邓艾率三万兵，从阴平小道，凿山开路，造作桥阁。行至摩天岭，马不能行，邓艾以毡自裹，推转而下。将士皆攀木挂崖，鱼贯而进——');
    await G.narrate('七百里无人之地，蜀军竟毫无防备。江油守将马邈不战而降。邓艾兵锋，直指绵竹。');
    // 诸葛瞻此前从未入队：先补级，再单独出战，其余部将暂离
    G.catchUp(['zhugezhan']);
    { const st = G.state; st.stash = (st.stash || []).concat(st.party.filter(id => !(st.stash || []).includes(id))); st.party = ['zhugezhan']; st.sp = Math.min(st.sp, G.maxSP()); }
    G.restoreAll();
    G.world.load('c34mianzhu', 15, 26, 'up');
    G.world.banner = null;
    await G.lines([
      ['zhugezhan', '……父亲当年说过：邓艾若出阴平，蜀中危矣。'],
      ['zhugezhan', '尚儿，随为父出城。诸葛家的人，没有降将。'],
    ]);
    await G.notice('诸葛瞻 出战！\n绵竹城外，邓艾的阴平奇兵已到。');
  }

  /* ---------------- 绵竹 ---------------- */
  B.c34mianzhu = () => {
    const m = new G.GameMap('c34mianzhu', '绵 竹', 30, 30, TL.GRASS);
    Object.assign(m, { seed: 3421, music: 'boss', ambient: 'leaves', leafColor: 'rgba(160,140,100,0.7)', pal: { gh: 80, gs: 20, gl: 24 }, battleBg: 'shu', flowers: 0, tint: 'rgba(60,40,40,0.15)' });
    K.walls(m, 4, 20, 25, 29, [{ side: 'n', x: 14, plaque: '绵竹' }]);
    m.road([[15.5, 28], [15.5, 2]], 0.9, TL.PATH);
    m.reserve(14, 22, 4, 6);
    for (const [x, y] of [[1, 2], [24, 2], [1, 12], [24, 12]]) K.mountain(m, x, y, 1);
    K.forest(m, { seed: 3425, thr: 0.6, kinds: ['bamboo', 'dark', 'pine'], avoid: 1 });
    m.npc({ id: 'da34', spec: 'dengai', x: 15, y: 9, dir: 'down', aggro: true, cond: () => !G.flag('c34_mz'), marker: () => true, talk: mianzhuScene });
    return m;
  };

  async function mianzhuScene() {
    if (G.flag('c34_mz')) return;
    await G.lines([
      ['dengai', '（遣使送书）若降，必表为琅琊王，以光显祖宗。'],
      ['zhugezhan', '（大怒，斩其来使）——出城！'],
    ]);
    const r = await G.battle(['dengai2'], { bg: 'shu', boss: true, party: ['zhugezhan'], intro: '绵竹 · 邓艾！' });
    if (r !== 'win') return;
    G.setFlag('c34_mz');
    await G.narrate('诸葛瞻奋力死战，邓艾军一度退却——然魏兵源源不断，四面围合。');
    await G.lines([['zhugezhan', '吾内不除奸臣，外不制强敌，又不能守国——有何面目见先帝与父亲于九泉之下！']]);
    await G.narrate('诸葛瞻力战而死。其子诸葛尚，年方十九，闻父死于阵中，单骑杀入魏军，亦战死。');
    await G.narrate('后人赞曰：不是忠侯少智谋，苍天有意绝炎刘。当年诸葛留嘉胤，节义真堪继武侯。');
    G.leaveParty('zhugezhan');
    await G.fadeOut(1.5);
    await G.narrate('绵竹失守。成都城中，后主问计于群臣。谯周劝降——');
    await G.narrate('北地王刘谌闻之，哭于昭烈庙，先杀妻子，而后自刎："臣羞见基业弃于他人！"');
    await G.narrate('炎兴元年冬，后主刘禅，舆榇自缚，出城投降。蜀汉，亡了。');
    await G.narrate('从桃园结义算起，八十年。');
    G.setParty(ARMY);
    await G.fadeIn(1.0);
    await G.lines([
      ['messenger', '（剑阁）大将军……陛下有诏：命大将军罢兵，投降钟会。', { name: '使者' }],
      ['jiangwei', '……'],
      ['xiahouba', '（众将闻之，拔刀砍石）吾等死战，何故先降耶！'],
      ['liaohua', '（老泪纵横）……老夫随关公镇荆州，随丞相出祁山——到头来，竟是这样的结局。'],
      ['jiangwei', '（良久）……诸公勿忧。吾有一计，可复汉室。'],
    ]);
    await G.narrate('姜维假意投降钟会，劝钟会据蜀自立，欲借机尽杀魏将，再杀钟会，迎回后主——');
    await G.narrate('事机泄露，魏将作乱。姜维拔剑冲入乱军，手刃数人，心痛病发——');
    await G.lines([['jiangwei', '（仰天大叫）吾计不成，乃天命也！']]);
    await G.narrate('姜维遂自刎而死，时年五十九岁。钟会、邓艾，亦死于乱军之中。');
    await G.narrate('后人有诗叹曰：天水夸英俊，凉州产异才。系从尚父出，术奉武侯来。大胆应无惧，雄心誓不回。成都身死日，汉将有余哀。');
    G.setFlag('c34_end');
    await G.fadeOut(1.5);
    await G.narrate('其后，司马炎篡魏，建立晋朝。又十五年，晋灭东吴。');
    await G.narrate('天下大势，分久必合，合久必分。');
    await G.narrate('……');
    await G.narrate('不知过了多少年。涿县城外，有一座桃园，春天依旧开满了桃花。');
    await G.lines([
      ['zhangfei', '大哥、二哥！俺庄后有一桃园，花开正盛——咱们三个，就在这园中——'],
      ['guanyu', '（抚髯而笑）三弟，又要结义么？'],
      ['liubei', '……不求同年同月同日生，但愿同年同月同日死。'],
      ['liubei', '二弟、三弟——这一回，我们走得够远了。'],
    ]);
    await G.narrate('一阵风吹过，桃花纷纷落下。');
    await G.chapterEnd(G.CHAPTERS[34].endLines);
  }

  G.FINAL_CHAPTER = 34;
  G.CHAPTERS[34] = {
    title: '三分归晋',
    prologue: [
      '景耀六年，魏军两路伐蜀。',
      '钟会引十万大军，兵临剑阁。',
      '剑门关，"一夫当关，万夫莫开"。',
      '姜维，就守在这里。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(ARMY);
      G.setParty(ARMY);
      G.restoreAll();
      const w = G.world;
      w.load('c34jiange', 17, 33, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['jiangwei', '剑阁在，蜀汉便在。诸位，随我守关！'],
      ]);
      await G.notice('终章。\n出剑门关，迎战钟会。');
    },
    endLines: [
      '滚滚长江东逝水，浪花淘尽英雄。',
      '是非成败转头空。青山依旧在，几度夕阳红。',
      '白发渔樵江渚上，惯看秋月春风。',
      '一壶浊酒喜相逢。古今多少事，都付笑谈中。',
      '',
      '《烽烟录 · 三国》　全剧终　——　谢谢你，陪他们走完这一程。',
      '作　者　·　一尾小石斑',
    ],
  };
})();
