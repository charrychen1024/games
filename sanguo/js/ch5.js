/* ============================================================
 * 烽烟录 · 第五章　白门楼（第一部完）
 * 小沛（兄弟如手足）→ 徐州原野（纪灵、辕门射戟）→ 下邳曹营（水淹之计）→ 水淹下邳 → 白门楼
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const LUSH = { gh: 92, gs: 40, gl: 27 };
  G.ENEMIES.ysbing = { name: '袁术军', hp: 700, str: 106, int: 25, spd: 64, def: 66, exp: 160, gold: 70, spec: 'hanbing' };
  const GROUPS = [
    { e: ['lbbing', 'lbbing'], w: 3 }, { e: ['lbbing', 'lbqi'], w: 2 }, { e: ['ysbing', 'ysbing'], w: 2 },
    { e: ['lbqi', 'lbqi'], w: 1 }, { e: ['xianzhen', 'lbbing'], w: 1 },
  ];

  /* ---------------- 小沛 ---------------- */
  B.c5xiaopei = () => {
    const m = new G.GameMap('c5xiaopei', '小 沛', 32, 26, TL.GRASS);
    Object.assign(m, { seed: 501, music: 'town', pal: LUSH, ambient: 'leaves', flowers: 0.05 });
    K.walls(m, 0, 0, 31, 25, [{ side: 's', x: 15, plaque: '小沛' }]);
    m.road([[16, 25], [16, 9]], 1, TL.PATH);
    m.road([[2, 12.5], [29, 12.5]], 0.6, TL.PATH);
    m.road([[6, 10], [6, 12]], 0.6, TL.PATH); m.road([[25, 10], [25, 12]], 0.6, TL.PATH); m.road([[25, 20], [25, 14]], 0.6, TL.PATH);
    m.prop('hall', 11, 2, 9, 6, { sign: '县衙' });
    m.prop('house', 3, 5, 7, 5, { sign: '客栈' });
    m.prop('house', 22, 5, 7, 5, { sign: '杂货', roof: '#45403a' });
    m.prop('house', 22, 15, 7, 5, { sign: '兵器', roof: '#3a3a3a', wall: '#cbbd9e' });
    m.prop('house', 3, 16, 5, 4, { roof: '#4a3b36', lantern: false }); m.prop('house', 9, 17, 4, 4, { roof: '#3d4654', lantern: false });
    K.deco(m, 'well', 13, 14);
    for (const [x, y] of [[10, 8], [21, 8]]) K.deco(m, 'flag', x, y, { text: '刘', color: '#2e7d4f', tcol: '#f6e7c1' });
    m.warp(15, 25, 3, 1, 'c5world', 11, 12, 'down', () => G.flag('c5_jlgo'), '先在城中安顿下来，听听消息吧。');
    m.reserve(15, 22, 3, 3);
    K.innerTrees(m, 1, 2, 30, 23, 11, 0.5);
    m.npc({ id: 'inn5', spec: 'innkeeper', x: 6, y: 10, dir: 'down', talk: K.innTalk('innkeeper', 80) });
    m.npc({ id: 'shop5', spec: 'merchant', x: 25, y: 10, dir: 'down', talk: K.shopTalk('merchant', ['jinchuang', 'dabu', 'meijiu', 'xuming', 'junliang'], '杂货', '小沛虽小，该有的都有。') });
    m.npc({ id: 'arm5', spec: 'smith', x: 25, y: 20, dir: 'down', talk: K.shopTalk('smith', ['mingguang', 'xuanjia'], '兵器', '这副玄甲，是俺压箱底的手艺！') });
    m.npc({ id: 'mizhu5', spec: 'mizhu', x: 18, y: 9, dir: 'down', talk: async () => {
      await G.lines([['mizhu', '主公勿忧。徐州虽失，人心犹在。糜竺愿以家财，助主公重整旗鼓！']]);
      if (!G.flag('c5_mizhu')) { G.setFlag('c5_mizhu'); G.state.gold += 1000; G.audio.sfx('buy'); await G.notice('糜竺献上军资 1000 金！'); }
    } });
    m.npc({ id: 'msg5', spec: 'messenger', x: 16, y: 19, dir: 'up', marker: () => !G.flag('c5_jlgo'), talk: async () => {
      if (G.flag('c5_jlgo')) { await say('messenger', '纪灵的大军就在城南！请主公速速出战！'); return; }
      await G.lines([
        ['messenger', '报——！袁术遣大将纪灵，率三万精兵来攻小沛！前锋已到城南！'],
        ['zhangfei', '来得好！俺正憋着一肚子火没处撒！'],
        ['jianyong', '三万之众……小沛兵少城小，恐难久守。'],
        ['liubei', '事急矣。先出城迎敌，挫其锐气，再做计较。'],
      ]);
      G.setFlag('c5_jlgo');
    } });
    m.npc({ id: 'xp1', spec: 'hanbing', x: 9, y: 14, wander: 2, talk: K.talk([['hanbing', '吕布占了徐州，让咱们来这小沛……鸠占鹊巢，真是气人！']]) });
    m.npc({ id: 'xp2', spec: 'woman', x: 20, y: 18, wander: 2, talk: K.talk([['woman', '刘使君待人宽厚，咱们小沛百姓都愿意跟着他。']]) });
    return m;
  };

  /* ---------------- 徐州原野 ---------------- */
  B.c5world = () => {
    const m = new G.GameMap('c5world', '徐 州', 56, 40, TL.GRASS);
    Object.assign(m, { seed: 531, music: 'field', ambient: 'clouds', pal: LUSH, battleBg: 'field', flowers: 0.05 });
    K.tallGrass(m, 533, 0.57);
    m.road([[54, -1], [50, 8], [52, 16], [49, 24], [52, 33], [50, 41]], 1.3, TL.WATER);
    m.road([[11.5, 11], [11.5, 16], [20, 19], [32, 22], [40, 26], [44.5, 26], [44.5, 30]], 0.75, TL.PATH);
    m.road([[32, 22], [35.5, 27], [35.5, 33]], 0.75, TL.PATH);
    m.prop('townicon', 10, 8, 4, 3, { label: '小沛', foot: [10, 8, 4, 3] });
    m.prop('townicon', 43, 27, 4, 3, { label: '下邳', foot: [43, 27, 4, 3] });
    m.prop('campicon', 34, 30, 4, 3, { label: '曹营', han: true, flagCol: '#2f4a7a', foot: [34, 30, 4, 3] });
    m.warp(11, 11, 2, 1, 'c5xiaopei', 16, 23, 'up'); m.reserve(11, 12, 2, 1);
    m.warp(35, 33, 2, 1, 'c5caoying', 15, 21, 'up', () => G.flag('c5_flee'), '那是……曹操的大营？眼下还不是去的时候。'); m.reserve(35, 34, 2, 1);
    m.warp(44, 30, 2, 1, 'c5xiapi', 15, 44, 'up', () => G.flag('c5_flood'), '下邳城门紧闭，城上箭如雨下。先去曹营与曹公会合吧。'); m.reserve(44, 31, 2, 1);
    for (let x = 0; x < 54; x += 3) K.mountain(m, x, 0);
    for (const [x, y] of [[20, 4], [26, 7], [32, 4], [38, 8], [44, 4], [3, 22], [6, 27], [12, 32], [24, 33], [40, 36], [46, 14]]) K.mountain(m, x, y);
    K.forest(m, { seed: 541, thr: 0.63, kinds: ['tree', 'pine', 'dark'] });
    // 纪灵大军（城南）
    const jl = () => G.flag('c5_jlgo') && !G.flag('c5_jiling');
    m.npc({ id: 'jiling', spec: 'jiling', x: 12, y: 18, dir: 'up', aggro: true, cond: jl, talk: jilingScene });
    m.npc({ id: 'ys1', spec: 'hanbing', x: 10, y: 18, dir: 'up', cond: jl });
    m.npc({ id: 'ys2', spec: 'hanbing', x: 14, y: 18, dir: 'up', cond: jl });
    m.npc({ id: 'ys3', spec: 'hanbing', x: 11, y: 19, dir: 'up', cond: jl });
    m.encounters = { rates: { [TL.GRASS]: 0.028, [TL.TALL]: 0.08 }, groups: GROUPS };
    return m;
  };

  async function jilingScene() {
    await G.lines([
      ['jiling', '刘备！我主袁公路乃四世三公之后，你一个织席贩履之徒，也配占据徐州？'],
      ['zhangfei', '你家袁术算什么东西！看矛！'],
    ]);
    const r = await G.battle(['jiling', 'ysbing', 'ysbing'], { bg: 'field', boss: true, intro: '袁术大将 纪灵 杀到！' });
    if (r !== 'win') return;
    G.setFlag('c5_jiling');
    await G.narrate('纪灵败退十里，重整兵马，又要来攻。正相持间，吕布遣人来请两家赴宴。');
    await G.narrate('辕门之外，吕布令人将方天画戟插在一百五十步外。');
    await G.lines([
      ['lubu', '玄德是我兄弟，纪将军不可相害。我今日一箭，若射中画戟小枝，两家便罢兵；若射不中，任凭厮杀。'],
      ['jiling', '一百五十步？哼，便依将军！'],
    ]);
    G.audio.sfx('slash');
    await G.narrate('吕布挽起袍袖，搭箭扯弓，大喝一声——正中画戟小枝！帐上帐下，齐声喝彩。');
    await G.lines([
      ['jiling', '……将军真神威也！纪灵这便回兵。'],
      ['zhangfei', '哼，算他吕布还有点本事。'],
    ]);
    await G.fadeOut(1.2);
    await G.narrate('然而好景不长。张飞因吕布部下强买马匹，一怒之下夺了吕布一百五十匹好马。');
    await G.narrate('吕布大怒，引兵攻破小沛。刘备兄弟失散，只得投奔许都的曹操。');
    await G.narrate('建安三年，曹操亲率大军东征吕布，与刘备合兵，将吕布围困于下邳。');
    G.setFlag('c5_flee');
    G.world.load('c5caoying', 15, 18, 'up');
    await G.fadeIn(1.0);
    await G.lines([
      ['liubei', '……兜兜转转，终究还是要与吕布一决胜负。'],
      ['guanyu', '大哥，曹公在中军大帐，请我们前去议事。'],
    ]);
  }

  /* ---------------- 下邳 · 曹营 ---------------- */
  B.c5caoying = () => {
    const m = new G.GameMap('c5caoying', '下邳 · 曹营', 32, 24, TL.GRASS);
    Object.assign(m, { seed: 551, music: 'town', pal: LUSH, battleBg: 'field', ambient: 'rain', flowers: 0.02 });
    m.reserve(14, 21, 4, 3);
    m.warp(14, 23, 4, 1, 'c5world', 35, 34, 'down');
    m.road([[15.5, 23], [15.5, 9]], 0.8, TL.PATH);
    m.road([[6, 12.5], [25, 12.5]], 0.6, TL.PATH);
    K.stakeRing(m, 1, 1, 30, 22, [[14, 22, 4, 1]]);
    for (let x = 0; x < 32; x++) { m.tree(x, 0, 'tree'); if (x < 13 || x > 18) m.tree(x, 23, 'dark'); }
    for (let y = 1; y < 23; y++) { m.tree(0, y, 'tree'); m.tree(31, y, 'dark'); }
    K.tent(m, 12, 3, { big: true, w: 7, h: 5, sign: '曹' });
    for (const [x, y] of [[3, 3], [25, 3], [3, 14], [25, 14], [7, 17], [21, 17], [7, 3], [21, 3]]) K.tent(m, x, y, {});
    for (const [x, y] of [[11, 5], [19, 5], [13, 10], [18, 10]]) K.deco(m, 'flag', x, y, { text: '曹', color: '#2f4a7a', tcol: '#f6e7c1' });
    K.deco(m, 'tower', 3, 19, { w: 2, h: 2 }); K.deco(m, 'tower', 26, 19, { w: 2, h: 2 });
    m.npc({ id: 'cao5', spec: 'caocao', x: 15, y: 8, dir: 'down', marker: () => !G.flag('c5_flood'), talk: async () => {
      if (G.flag('c5_flood')) { await say('caocao', '沂、泗之水已灌入下邳。玄德，擒吕布，就在今日！'); return; }
      await G.lines([
        ['caocao', '玄德，你来得正好。下邳城坚，吕布有陈宫为谋、高顺张辽为将，久攻不下。'],
        ['caocao', '如今天寒地冻，军中已有退兵之议……'],
        ['liubei', '曹公，吕布有勇无谋，陈宫虽有智计而吕布不能用。此时退兵，前功尽弃。'],
        ['caocao', '哈哈，正合吾意！我的谋士郭嘉、荀攸献了一计——'],
        ['caocao', '决开沂水、泗水，水淹下邳！'],
      ]);
      G.audio.sfx('gong'); G.shake(6, 0.8);
      await G.narrate('曹军连夜掘开河堤。滔滔河水灌入下邳，城中一片汪洋，只剩城东南一角尚可行走。');
      await G.lines([
        ['caocao', '城中军心已乱。玄德，你兄弟几人从东南水门杀入，直取白门楼！'],
        ['zhaoyun', '末将愿为先锋！'],
        ['zhangfei', '吕布！这回看你往哪里跑！'],
      ]);
      G.setFlag('c5_flood');
      await G.notice('前往东方的下邳城。\n（营中军需官、军医可补给疗伤）');
    } });
    m.npc({ id: 'qm5', spec: 'caobing', x: 8, y: 11, dir: 'down', talk: K.shopTalk('caobing', ['jinchuang', 'dabu', 'meijiu', 'xuming', 'junliang', 'mingguang', 'xuanjia'], '军需', '曹公有令，刘使君所需，一律供应——钱还是要给的。', '军需官') });
    m.npc({ id: 'doc5', spec: 'oldman', x: 22, y: 11, dir: 'down', talk: async () => {
      await say('oldman', '来来，伤兵先治。', { name: '军医' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      const s = await G.choose(['记录进度', '不用了']);
      if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 'c5s1', spec: 'caobing', x: 10, y: 16, wander: 2, talk: K.talk([['caobing', '吕布的陷阵营可凶了，高顺带着七百人，攻无不克。', { name: '曹军士卒' }]]) });
    m.npc({ id: 'c5s2', spec: 'caobing', x: 21, y: 16, wander: 2, talk: K.talk([['caobing', '听说吕布整日在城里饮酒，连陈宫的话都不听了。', { name: '曹军士卒' }]]) });
    return m;
  };

  /* ---------------- 水淹下邳 ---------------- */
  B.c5xiapi = () => {
    const m = new G.GameMap('c5xiapi', '下邳城', 32, 48, TL.GRASS);
    Object.assign(m, { seed: 561, music: 'camp', ambient: 'rain', pal: { gh: 100, gs: 20, gl: 18 }, battleBg: 'flood' });
    K.walls(m, 0, 0, 31, 47, [{ side: 's', x: 14, plaque: '下邳' }]);
    m.rect(14, 0, 3, 2, TL.WALL);
    m.prop('gate', 13, 0, 5, 2, { nofoot: true, plaque: '白门楼', sortBias: 1 });
    m.rect(1, 2, 30, 44, TL.WATER);
    const isl = (x, y, w, h) => m.rect(x, y, w, h, TL.FLOOR);
    isl(8, 38, 16, 6); isl(3, 25, 10, 8); isl(19, 20, 10, 10); isl(7, 3, 18, 7);
    const bridge = (x, y, w, h) => { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (m.get(i, j) === TL.WATER) m.set(i, j, TL.BRIDGE); };
    bridge(15, 44, 1, 2); bridge(8, 33, 1, 5); bridge(13, 28, 6, 1); bridge(24, 10, 1, 10);
    m.warp(14, 46, 3, 1, 'c5world', 44, 31, 'down');
    m.reserve(14, 44, 3, 2);
    m.prop('house', 16, 39, 5, 4, { roof: '#3d4654', lantern: false });
    m.prop('house', 4, 26, 5, 4, { roof: '#4a3b36', lantern: false });
    m.prop('house', 23, 21, 5, 4, { roof: '#45403a', lantern: false });
    for (const [x, y] of [[9, 4], [22, 4], [10, 40], [22, 27]]) K.deco(m, 'flag', x, y, { text: '吕', color: '#8a1e1e', tcol: '#f6e7c1' });
    K.deco(m, 'crates', 10, 31); K.deco(m, 'jar', 3, 31); K.deco(m, 'rack', 19, 23);
    m.prop('cart', 26, 27, 2, 1, { foot: [26, 27, 2, 1] });
    m.event({ type: 'inspect', x: 26, y: 27, w: 2, h: 1, run: async () => {
      if (G.flag('c5_cart')) { await G.narrate('粮车已经空了。'); return; }
      G.setFlag('c5_cart'); G.restoreAll(); G.audio.sfx('heal');
      await G.notice('找到吕布军囤积的粮草！全军兵力与策略恢复了。');
    } });
    K.guard(m, { id: 'x1', spec: 'lbbing', x: 12, y: 41, flag: 'c5_x1', group: ['lbbing', 'lbbing', 'lbqi'], bg: 'flood', lines: [['lbbing', '水门被破了！快拦住他们！', { name: '吕布军' }]] });
    K.guard(m, { id: 'gaoshun', spec: 'gaoshun', x: 8, y: 38, flag: 'c5_gao', group: ['gaoshun', 'xianzhen'], bg: 'flood', boss: true, intro: '陷阵营 高顺 杀到！',
      lines: [['gaoshun', '陷阵营在此，有进无退！'], ['guanyu', '高顺，你治军严整，可惜所事非人。'], ['gaoshun', '多言无益。来！']] });
    K.guard(m, { id: 'x2', spec: 'lbqi', x: 6, y: 30, flag: 'c5_x2', group: ['lbqi', 'lbqi', 'lbbing'], bg: 'flood' });
    K.guard(m, { id: 'zhangliao', spec: 'zhangliao', x: 12, y: 28, flag: 'c5_liao', group: ['zhangliao', 'lbqi'], bg: 'flood', boss: true, intro: '雁门 张辽 杀到！',
      lines: [['zhangliao', '雁门张文远在此！要过此桥，先问过我手中的刀！'], ['guanyu', '……好一员虎将。']] });
    K.guard(m, { id: 'x3', spec: 'xianzhen', x: 21, y: 25, flag: 'c5_x3', group: ['xianzhen', 'lbbing', 'lbqi'], bg: 'flood' });
    K.guard(m, { id: 'chengong', spec: 'chengong', x: 24, y: 20, flag: 'c5_gong', group: ['chengong', 'lbbing', 'lbbing'], bg: 'flood', boss: true, intro: '谋士 陈宫 拦住去路！',
      lines: [['chengong', '吕将军若早听我言，何至于此！……也罢，陈宫今日便以此身报主！'], ['jianyong', '公台先生，大势已去，何必如此？'], ['chengong', '士为知己者死。放箭！放火！']] });
    m.npc({ id: 'lubu5', spec: 'lubu', x: 15, y: 4, dir: 'down', aggro: true, cond: () => !G.flag('c5_lubu'), talk: finalScene });
    m.encounters = { rates: { [TL.FLOOR]: 0.025, [TL.BRIDGE]: 0.015 }, groups: GROUPS };
    m.onEnter = async () => {
      if (G.flag('c5_xp_in')) return;
      G.setFlag('c5_xp_in');
      await G.lines([['zhaoyun', '城中已成泽国……只有这些屋顶和桥梁能落脚。'], ['liubei', '吕布就在北面的白门楼上。诸位，最后一战了！']]);
    };
    return m;
  };

  async function finalScene() {
    G.audio.sfx('gong'); G.shake(6, 0.6);
    await G.lines([
      ['lubu', '刘备！大耳贼！当初你走投无路，是谁辕门射戟救了你的小沛？！'],
      ['liubei', '奉先，你救我一次，我收留你一次。可你夜袭徐州、背信弃义，又当如何说？'],
      ['lubu', '哈哈哈哈！乱世之中，谁强谁便是道理！'],
      ['lubu', '来吧！今日就让天下人看看，什么叫人中吕布！'],
      ['zhangfei', '三姓家奴！虎牢关下没分出胜负，今日一并算清！'],
      ['zhaoyun', '常山赵子龙，愿会天下无双！'],
    ]);
    const r = await G.battle(['lubu2'], { bg: 'flood', boss: true, intro: '飞将 吕布 决战白门楼！' });
    if (r !== 'win') return;
    G.setFlag('c5_lubu');
    await G.narrate('吕布力战不支，退上白门楼。部将侯成、宋宪、魏续趁其熟睡，盗走画戟，将他牢牢缚住，献于曹操。');
    await G.lines([
      ['caocao', '奉先，今日如何？'],
      ['lubu', '明公所患，不过于布。布今已服矣。公为大将，布副之，天下不难定也。'],
      ['caocao', '……玄德以为如何？'],
    ]);
    await G.narrate('刘备沉默良久。');
    await G.lines([
      ['liubei', '公不见丁建阳、董卓之事乎？'],
      ['lubu', '大耳儿！最无信者，便是你！'],
    ]);
    await G.narrate('曹操下令，缢杀吕布于白门楼。一代飞将，就此殒命。');
    await G.lines([
      ['zhangliao', '要杀便杀！只恨当年濮阳城中，那一把火没有烧死你曹操！'],
      ['caocao', '败将还敢口出狂言！推出去斩了！'],
      ['guanyu', '曹公且慢！'],
      ['guanyu', '关某素知文远忠义，此人可惜了。关某愿以性命担保。'],
      ['caocao', '……哈哈，我亦知文远忠义，故戏之耳。'],
    ]);
    await G.narrate('曹操亲解其缚，张辽感其义，遂降。陈宫不肯降，从容赴死；高顺亦不发一言，引颈就戮。');
    await G.lines([
      ['zhangfei', '大哥……吕布死了。'],
      ['liubei', '是啊。'],
      ['guanyu', '大哥在想什么？'],
      ['liubei', '我在想……天下还有多少个吕布、多少个董卓。我们从桃园走到这里，已经十五年了。'],
      ['zhaoyun', '玄德公，路还长。子龙愿一直追随左右。'],
      ['jianyong', '是啊，玄德。前面的路，我们一起走。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[5].endLines);
  }

  G.CHAPTERS[5] = {
    title: '白门楼',
    prologue: [
      '刘备领徐州不久，吕布为曹操所败，率残部前来投奔。',
      '刘备不顾张飞反对，收留吕布，令其屯驻小沛。',
      '后刘备奉诏讨伐袁术，命张飞留守徐州。张飞醉酒鞭打曹豹，',
      '曹豹怀恨，暗通吕布。吕布夜袭徐州，张飞失城而走。',
      '刘备兵败无依，只得与吕布讲和，反屈居小沛……',
    ],
    start: async () => {
      const w = G.world;
      w.load('c5xiaopei', 16, 11, 'down');
      w.place(1, 15, 12, 'up'); w.place(2, 16, 13, 'up'); w.place(3, 17, 12, 'up'); w.place(4, 18, 12, 'up');
      w.party[0].dir = 'down';
      await G.fadeIn(1.2);
      await G.lines([
        ['zhangfei', '大哥……都是俺贪杯误事，丢了徐州，还连累了嫂嫂们……'],
        ['zhangfei', '俺没脸再见大哥！让俺一剑抹了脖子，给大哥赔罪！'],
        ['guanyu', '三弟！'],
        ['liubei', '三弟！古人云：兄弟如手足，妻子如衣服。衣服破，尚可缝；手足断，安可续？'],
        ['liubei', '我等桃园结义，不求同生，但愿同死。城池失了可以再夺，兄弟没了，到哪里再找！'],
        ['zhangfei', '大哥……！'],
        ['zhaoyun', '……玄德公如此仁义，子龙此生，没有跟错人。'],
      ]);
    },
    endLines: [
      '建安三年冬，吕布殒命白门楼。',
      '张辽归降曹操，陈宫慷慨赴死，高顺不降而亡。',
      '刘备随曹操前往许都，面见天子，被尊为"皇叔"。',
      '一日，曹操煮酒青梅，邀刘备共论天下英雄——',
      '"今天下英雄，惟使君与操耳。"',
      '刘备闻言，手中匙箸，不觉落于地下……',
      '（第一部　完）',
    ],
  };
})();
