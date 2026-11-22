/* ============================================================
 * 烽烟录 · 第六章　衣带诏（第二部开篇）
 * 许都（学圃、衣带诏、煮酒论英雄）→ 截击袁术 → 徐州斩车胄 → 夜袭曹营，兄弟失散
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const LUSH = { gh: 92, gs: 40, gl: 27 };
  const GROUPS = [{ e: ['caobing2', 'caobing2'], w: 3 }, { e: ['caobing2', 'caoshe2'], w: 2 }, { e: ['ysbing2', 'ysbing2'], w: 2 }, { e: ['caoqi2', 'caobing2'], w: 1 }, { e: ['ysbing2', 'ysbing2', 'ysbing2'], w: 1 }];

  /* ---------------- 许都 ---------------- */
  B.c6xudu = () => {
    const m = new G.GameMap('c6xudu', '许 都', 40, 32, TL.GRASS);
    Object.assign(m, { seed: 601, music: 'town', pal: LUSH, ambient: 'leaves', flowers: 0.05 });
    K.walls(m, 0, 0, 39, 31, [{ side: 's', x: 19, plaque: '许都' }]);
    m.road([[20, 31], [20, 9]], 1, TL.PATH);
    m.road([[2, 14.5], [37, 14.5]], 0.6, TL.PATH);
    m.rect(14, 11, 13, 8, TL.FLOOR);
    m.road([[6, 9], [6, 14]], 0.6, TL.PATH); m.road([[33, 9], [33, 14]], 0.6, TL.PATH);
    m.road([[6, 23], [6, 16]], 0.6, TL.PATH); m.road([[33, 23], [33, 16]], 0.6, TL.PATH);
    m.prop('hall', 15, 3, 11, 6, { sign: '丞相府' });
    m.prop('house', 3, 4, 7, 5, { sign: '客栈' });
    m.prop('house', 30, 4, 7, 5, { sign: '杂货', roof: '#45403a' });
    m.prop('house', 30, 18, 7, 5, { sign: '董府', roof: '#4a3b36' });
    m.prop('house', 3, 18, 7, 5, { sign: '刘宅', roof: '#3d4654' });
    m.rect(10, 23, 6, 4, TL.TALL);
    K.deco(m, 'well', 15, 12); K.deco(m, 'board', 25, 12);
    for (const [x, y] of [[13, 9], [27, 9]]) K.deco(m, 'flag', x, y, { text: '曹', color: '#24304a', tcol: '#f6e7c1' });
    m.warp(19, 31, 3, 1, 'c6world', 8, 22, 'down', () => G.flag('c6_leave'), '没有丞相的将令，守门军士不肯放行。');
    m.reserve(19, 28, 3, 3);
    K.innerTrees(m, 1, 2, 38, 29, 17, 0.5);
    m.npc({ id: 'inn6', spec: 'innkeeper', x: 6, y: 9, dir: 'down', talk: K.innTalk('innkeeper', 100) });
    m.npc({ id: 'shop6', spec: 'merchant', x: 33, y: 9, dir: 'down', talk: K.shopTalk('merchant', ['dabu', 'dahuan', 'meijiu', 'qiongjiang', 'xuming', 'junliang', 'xuanjia', 'longlin'], '许都商号', '天子脚下，什么好货都有！') });
    m.npc({ id: 'dongcheng', spec: 'dongcheng', x: 33, y: 23, dir: 'down', marker: () => !G.flag('c6_edict'), talk: async () => {
      if (G.flag('c6_edict')) { await say('dongcheng', '皇叔，此事千万机密……'); return; }
      await G.lines([
        ['dongcheng', '皇叔请进，屏退左右……'],
        ['dongcheng', '这是陛下咬破手指，以血写成的密诏，缝在赐给老夫的衣带之中。'],
      ]);
      await G.narrate('诏曰："朕闻人伦之大，父子为先……近者权臣操贼，出自阁门，作威作福……卿乃国之大臣，朕之至戚，当念高帝创业之艰难，纠合忠义两全之烈士，殄灭奸党，复安社稷……"');
      await G.lines([
        ['liubei', '……操贼欺君罔上，刘备身为汉室宗亲，岂敢不奉诏！'],
        ['dongcheng', '好！皇叔请在义状上署名。'],
      ]);
      await G.narrate('刘备书名画字，与董承等人歃血为盟。');
      await say('dongcheng', '近日曹操时常派人来请皇叔，务必小心应对。');
      G.setFlag('c6_edict');
    } });
    m.npc({ id: 'cao6', spec: 'caocao', x: 20, y: 9, dir: 'down', marker: () => G.flag('c6_edict') && !G.flag('c6_wine'), talk: async () => {
      if (!G.flag('c6_edict')) { await say('caocao', '玄德，在家做得好大事！——听说你在后园种菜？哈哈哈。'); return; }
      if (G.flag('c6_wine')) { await say('caocao', '玄德，截击袁术之事，就拜托你了。'); return; }
      await wineScene();
    } });
    m.npc({ id: 'xd1', spec: 'hanbing', x: 17, y: 16, wander: 2, talk: K.talk([['hanbing', '前日许田打围，丞相竟越过天子去受群臣之贺……唉。']]) });
    m.npc({ id: 'xd2', spec: 'woman', x: 24, y: 17, wander: 2, talk: K.talk([['woman', '刘皇叔待人和气，每日都在后园浇菜，一点架子也没有。']]) });
    m.npc({ id: 'xd3', spec: 'child', x: 9, y: 27, wander: 2, talk: K.talk([['child', '皇叔种的韭菜长得最好！']]) });
    return m;
  };

  async function wineScene() {
    await G.narrate('后园小亭，青梅煮酒。');
    await G.lines([
      ['caocao', '玄德久历四方，必知当世英雄。请试言之。'],
      ['liubei', '淮南袁术，兵粮足备，可为英雄？'],
      ['caocao', '冢中枯骨，吾早晚必擒之！'],
      ['liubei', '河北袁绍，四世三公，可为英雄？'],
      ['caocao', '色厉胆薄，好谋无断，干大事而惜身，见小利而忘命，非英雄也。'],
      ['liubei', '刘表、孙策、刘璋、张鲁、韩遂……'],
      ['caocao', '此等碌碌小人，何足挂齿！'],
      ['liubei', '舍此之外，备实不知。'],
      ['caocao', '夫英雄者，胸怀大志，腹有良谋，有包藏宇宙之机，吞吐天地之志者也。'],
      ['liubei', '谁能当之？'],
      ['caocao', '今天下英雄，惟使君与操耳！'],
    ]);
    G.audio.sfx('gong'); G.shake(10, 0.7);
    await G.fadeTo(0.7, 0.06, '#fff'); await G.fadeTo(0, 0.3);
    await G.narrate('刘备闻言，吃了一惊，手中所执匙箸，不觉落于地下。时正值天雨将至，雷声大作。');
    await G.lines([
      ['liubei', '（从容俯首拾箸）一震之威，乃至于此。'],
      ['caocao', '丈夫亦畏雷乎？'],
      ['liubei', '圣人迅雷风烈必变，安得不畏？'],
      ['caocao', '……哈哈哈哈！'],
    ]);
    await G.narrate('适逢探马来报：袁术将投奔袁绍，必经徐州。');
    await G.lines([
      ['liubei', '术若投绍，必从徐州过。备请一军就半路截击，术可擒矣。'],
      ['caocao', '好！明日奏明天子，玄德即可起兵。'],
    ]);
    G.setFlag('c6_wine'); G.setFlag('c6_leave');
    await G.lines([
      ['guanyu', '大哥近日为何急于出征？'],
      ['liubei', '吾乃笼中鸟、网中鱼。此一行，如鱼入大海，鸟上青霄，不受笼网之羁绊也！'],
    ]);
    await G.notice('出许都南门，截击袁术，前往徐州。');
  }

  /* ---------------- 徐州道 ---------------- */
  B.c6world = () => {
    const m = new G.GameMap('c6world', '徐州道', 56, 40, TL.GRASS);
    Object.assign(m, { seed: 631, music: 'field', ambient: 'clouds', pal: LUSH, battleBg: 'field', flowers: 0.05 });
    K.tallGrass(m, 633, 0.57);
    m.road([[30, -1], [31, 10], [27, 20], [30, 30], [28, 41]], 1.2, TL.WATER);
    m.road([[7.5, 21], [7.5, 18.5], [20, 18.5], [36, 18.5], [47.5, 17], [47.5, 15]], 0.75, null, (x, y) => { if (!m.inb(x, y)) return; m.set(x, y, m.get(x, y) === TL.WATER || m.get(x, y) === TL.BRIDGE ? TL.BRIDGE : TL.PATH); });
    m.prop('townicon', 6, 18, 4, 3, { label: '许都', foot: [6, 18, 4, 3] });
    m.prop('townicon', 46, 12, 4, 3, { label: '徐州', foot: [46, 12, 4, 3] });
    m.warp(7, 21, 2, 1, 'c6xudu', 20, 29, 'up'); m.reserve(7, 22, 2, 1);
    m.warp(47, 15, 2, 1, 'c6xuzhou', 20, 29, 'up', () => G.flag('c6_yuanshu'), '袁术的残军正在附近流窜，先截住他们再进徐州。'); m.reserve(47, 16, 2, 1);
    for (let x = 0; x < 54; x += 3) K.mountain(m, x, 0);
    for (const [x, y] of [[14, 6], [20, 8], [38, 6], [43, 8], [52, 6], [4, 28], [10, 32], [20, 30], [40, 30], [48, 26], [52, 34]]) K.mountain(m, x, y);
    K.forest(m, { seed: 641, thr: 0.63, kinds: ['tree', 'pine', 'dark'] });
    const ys = () => !G.flag('c6_yuanshu');
    m.npc({ id: 'ysflag', spec: 'hanbing', x: 37, y: 17, dir: 'left', aggro: true, cond: ys, talk: async () => {
      await G.lines([
        ['hanbing', '仲家皇帝在此，挡路者死！', { name: '袁术军' }],
        ['zhangfei', '什么仲家皇帝！一个偷了玉玺的冢中枯骨罢了！'],
      ]);
      const r = await G.battle(['ysbing2', 'ysbing2', 'ysbing2'], { bg: 'field', intro: '袁术残军 杀到！' });
      if (r !== 'win') return;
      G.setFlag('c6_yuanshu');
      await G.narrate('袁术大败，众叛亲离。时值盛暑，袁术欲饮蜜水而不可得，坐于床上大叫一声，吐血斗余而死。');
      await say('liubei', '一代枭雄，竟落得如此下场……去徐州吧。');
    } });
    m.npc({ id: 'ysflag2', spec: 'hanbing', x: 37, y: 19, dir: 'left', cond: ys });
    m.encounters = { rates: { [TL.GRASS]: 0.028, [TL.TALL]: 0.08 }, groups: GROUPS };
    return m;
  };

  /* ---------------- 徐州（车胄） ---------------- */
  G.kit.xuDecor[6] = (m) => {
    m.npc({ id: 'chendeng', spec: 'chendeng', x: 22, y: 27, dir: 'up', marker: () => !G.flag('c6_chen'), talk: async () => {
      if (G.flag('c6_chezhou')) { await say('chendeng', '车胄已除，徐州又回到使君手中了。'); return; }
      await G.lines([
        ['chendeng', '使君！曹操已密令车胄，趁使君入城时伏兵加害！'],
        ['guanyu', '既如此，关某便先下手为强。车胄现在何处？'],
        ['chendeng', '就在州牧府前。'],
      ]);
      G.setFlag('c6_chen');
    } });
    m.npc({ id: 'chezhou', spec: 'chezhou', x: 20, y: 9, dir: 'down', aggro: true, cond: () => !G.flag('c6_chezhou'), talk: async () => {
      await G.lines([
        ['chezhou', '刘备！丞相有令，你既出许都，便不必回去了！'],
        ['guanyu', '车胄，你的伏兵，陈元龙早已告诉我们了。'],
      ]);
      const r = await G.battle(['chezhou', 'caobing2', 'caobing2'], { bg: 'city', boss: true, intro: '徐州刺史 车胄 杀到！' });
      if (r !== 'win') return;
      G.setFlag('c6_chezhou');
      await G.narrate('关羽手起刀落，斩车胄于马下。徐州百姓扶老携幼，焚香迎接刘备。');
      await G.lines([
        ['jianyong', '玄德，杀了车胄，便是与曹操彻底决裂了。他必定亲率大军来攻。'],
        ['liubei', '早晚有此一战。传令各营，整备兵马。'],
      ]);
      await G.wait(0.3);
      await G.lines([
        ['messenger', '报——！曹操亲率二十万大军东征，前锋已至小沛以西！'],
        ['zhangfei', '大哥！曹军远来疲惫，今夜正好劫营！'],
        ['liubei', '……也好。三弟此计可行。今夜三更，劫曹营！'],
      ]);
      await G.notice('在城中整备之后，出城前往曹营夜袭。');
    } });
    m.npc({ id: 'x6a', spec: 'woman', x: 17, y: 16, wander: 2, talk: async () => { if (G.flag('c6_chezhou')) await say('woman', '刘使君回来了！'); else await say('woman', '车刺史凶得很，大家都不敢出门……'); } });
  };
  B.c6xuzhou = () => {
    const m = G.kit.xuzhouTown('c6xuzhou', 'c6world', 47, 16, 6);
    m.warp(39, 14, 1, 2, 'c6caoying', 17, 30, 'up', () => G.flag('c6_chezhou'), '城外曹军虎视眈眈，先解决城里的事。');
    m.rect(37, 14, 3, 2, TL.PATH); m.rect(39, 14, 1, 2, TL.PATH);
    return m;
  };

  /* ---------------- 夜袭曹营 ---------------- */
  B.c6caoying = () => {
    const m = new G.GameMap('c6caoying', '小沛 · 曹营', 36, 32, TL.SOIL);
    Object.assign(m, { seed: 671, under: TL.SOIL, music: 'camp', ambient: 'embers', battleBg: 'camp', dusk: true, pal: { sh: 30, ss: 18, sl: 22, gh: 92, gs: 30, gl: 22 } });
    m.warp(16, 31, 4, 1, 'c6xuzhou', 36, 14, 'left');
    m.reserve(16, 29, 4, 2);
    K.stakeRing(m, 1, 1, 34, 30, [[16, 30, 4, 1]]);
    for (let x = 0; x < 36; x++) { m.tree(x, 0, 'pine'); if (x < 15 || x > 20) m.tree(x, 31, 'dark'); }
    for (let y = 1; y < 31; y++) { m.tree(0, y, 'pine'); m.tree(35, y, 'dark'); }
    m.road([[17.5, 31], [17.5, 26], [24, 22], [24, 16], [18, 13], [18, 9]], 0.8, TL.PATH);
    K.tent(m, 14, 2, { big: true, w: 7, h: 5, sign: '曹' });
    for (const [x, y] of [[4, 3], [9, 4], [25, 3], [29, 6], [4, 14], [8, 18], [27, 25], [4, 25], [10, 24], [29, 18]]) K.tent(m, x, y, {});
    for (const [x, y] of [[13, 9], [23, 9], [20, 20], [28, 13], [6, 22], [12, 28], [30, 28]]) K.deco(m, 'fire', x, y, { light: 150 });
    for (const [x, y] of [[13, 3], [22, 3], [15, 14], [21, 14], [15, 28], [20, 28]]) K.deco(m, 'flag', x, y, { text: '曹', color: '#2f4a7a', tcol: '#f6e7c1' });
    K.guard(m, { id: 'n1', spec: 'caobing', x: 19, y: 25, flag: 'c6_n1', group: ['caobing2', 'caobing2', 'caoshe2'], lines: [['caobing', '有、有人劫营！', { name: '曹军' }]] });
    K.guard(m, { id: 'n2', spec: 'caoqi', x: 23, y: 18, flag: 'c6_n2', group: ['caoqi2', 'caobing2', 'caoshe2'], lines: [['caoqi', '早知你们会来！', { name: '虎豹精骑' }]] });
    m.npc({ id: 'xuchu', spec: 'xuchu', x: 18, y: 8, dir: 'down', aggro: true, cond: () => !G.flag('c6_xuchu'), talk: async () => {
      await G.lines([
        ['zhangfei', '……不对，大营里怎么一个人都没有？'],
        ['xuchu', '哈哈哈！丞相早料到你们要来劫营！谯国许仲康在此！'],
        ['zhangfei', '好个光膀子的黑大汉！来跟你张爷爷斗三百合！'],
      ]);
      const r = await G.battle(['xuchu', 'caoqi2', 'caoshe2'], { bg: 'camp', boss: true, intro: '虎痴 许褚 杀到！' });
      if (r !== 'win') return;
      G.setFlag('c6_xuchu');
      G.audio.sfx('gong'); G.shake(8, 0.8);
      await G.narrate('霎时四面火起，喊声大震。张辽、许褚、于禁、李典、徐晃、乐进、夏侯惇、夏侯渊，八路伏兵一齐杀出！');
      await G.lines([
        ['guanyu', '大哥！是埋伏！'],
        ['liubei', '三弟！二弟！突围——各自突围！'],
        ['zhangfei', '大哥——！'],
      ]);
      await G.narrate('混战之中，兄弟三人被冲散。刘备单骑北走，张飞杀开血路逃入芒砀山，关羽退保下邳……');
      await G.chapterEnd(G.CHAPTERS[6].endLines);
    } });
    m.encounters = { rates: { [TL.SOIL]: 0.028, [TL.PATH]: 0.012 }, groups: [{ e: ['caobing2', 'caobing2'], w: 2 }, { e: ['caoqi2', 'caoshe2'], w: 1 }] };
    return m;
  };

  G.CHAPTERS[6] = {
    title: '衣带诏',
    prologue: [
      '吕布既死，刘备随曹操回到许都。',
      '献帝排世谱，认刘备为皇叔，从此人称"刘皇叔"。',
      '许田打围，曹操僭越受贺，满朝文武敢怒而不敢言。',
      '天子密写血诏，藏于衣带，赐给国舅董承……',
      '刘备深居简出，每日在后园浇水种菜，以为韬晦之计。',
    ],
    start: async () => {
      const w = G.world;
      w.load('c6xudu', 13, 25, 'up');
      w.place(1, 12, 26, 'up'); w.place(2, 14, 26, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhangfei', '大哥！你整天在这里种菜浇水，俺看了都着急！'],
        ['guanyu', '兄长不留心天下大事，却学小人之事，这是为何？'],
        ['liubei', '此非二弟三弟所知也。'],
        ['jianyong', '……玄德是在韬光养晦啊。对了，国舅董承请你过府一叙。'],
      ]);
    },
    endLines: [
      '刘备兵败，单骑北投袁绍；张飞杀出重围，不知所踪。',
      '关羽护着二位嫂嫂困守下邳，被曹军围于土山。',
      '张辽奉命前来劝降。关羽约定三事：',
      '一曰降汉不降曹，二曰奉养二嫂，',
      '三曰但知兄长下落，不管千里万里，便当辞去。',
      '曹操一一应允。关羽暂栖许都，封汉寿亭侯……',
    ],
  };
})();
