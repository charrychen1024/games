/* ============================================================
 * 烽烟录 · 第十六章　落凤坡
 * 西川（涪关·杨怀高沛 → 雒城·冷苞）→ 落凤坡（庞统殒命）→ 巴郡（张飞义释严颜）→ 金雁桥（张任）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SHU = { gh: 108, gs: 30, gl: 24 };
  const SHOP = ['shenghui', 'xuelian', 'tianzhong', 'yulu', 'xuming', 'quanjun', 'dayan', 'jinsuo', 'shujin'];
  const WEST = ['liubei', 'pangtong', 'huangzhong', 'weiyan'];
  const FULL = ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'weiyan'];
  const GROUPS = [{ e: ['shubing2', 'shubing2'], w: 3 }, { e: ['shubing2', 'shugong2'], w: 3 }, { e: ['shugong2', 'shugong2', 'shubing2'], w: 1 }, { e: ['shanman2', 'shanman2'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  /* ---------------- 西川 ---------------- */
  B.c16world = () => {
    const m = new G.GameMap('c16world', '西 川', 60, 44, TL.GRASS);
    Object.assign(m, { seed: 1601, music: 'field', ambient: 'clouds', pal: SHU, battleBg: 'shu', flowers: 0.04 });
    K.tallGrass(m, 1603, 0.55);
    m.road([[34, 0], [33, 12], [31, 24], [33, 36], [32, 44]], 1.2, TL.WATER);          // 涪水
    m.road([[50.5, 9], [44, 14], [42.5, 17]], 0.75, TL.PATH);                          // 葭萌 → 涪关
    m.road([[42.5, 17], [42.5, 20], [38, 22], [20, 22.5], [6, 21.5]], 0.75, TL.PATH);               // 涪关 → 雒城
    m.road([[24.5, 22.5], [24.5, 43]], 0.6, TL.PATH);                                  // 小路 → 落凤坡
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.WATER && Math.abs(y - 22.3) < 1.2) m.set(x, y, TL.BRIDGE);
    m.prop('townicon', 37, 13, 5, 3, { label: '涪关', foot: [37, 13, 5, 3] });
    m.prop('townicon', 1, 18, 4, 4, { label: '雒城', foot: [1, 18, 4, 4] });
    m.reserve(46, 6, 8, 6); m.reserve(42, 17, 2, 3); m.reserve(24, 41, 2, 3); m.reserve(5, 20, 3, 4);
    K.tent(m, 46, 6, { big: true, w: 5, h: 4, red: true, sign: '刘' });
    K.tent(m, 52, 9, { red: true });
    K.deco(m, 'flag', 49, 11, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.npc({ id: 'camp16', spec: 'innkeeper', x: 52, y: 12, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '主公，营中都安排好了。', '军需官'); else if (k === 1) await G.shop(SHOP, '西川军需');
    } });
    m.npc({ id: 'camp16b', spec: 'innkeeper', x: 27, y: 21, dir: 'down', cond: () => G.flag('c16_fu'), talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '前面便是雒城地界，歇歇再走。', '粮官'); else if (k === 1) await G.shop(SHOP, '西川军需');
    } });
    m.event({ type: 'step', x: 42, y: 17, w: 2, h: 3, run: fuguanScene });
    m.npc({ id: 'yh16', spec: 'yanghuai', x: 42, y: 18, dir: 'up', aggro: true, cond: () => !G.flag('c16_fu'), talk: fuguanScene });
    m.npc({ id: 'gp16', spec: 'gaopei', x: 43, y: 18, dir: 'up', cond: () => !G.flag('c16_fu'), talk: fuguanScene });
    m.npc({ id: 'lb16', spec: 'lengbao', x: 16, y: 22, dir: 'right', aggro: true, cond: () => G.flag('c16_fu') && !G.flag('c16_leng'), talk: lengbaoScene });
    m.npc({ id: 'zr16', spec: 'zhangren', x: 7, y: 21, dir: 'right', aggro: true, cond: () => G.flag('c16_yan') && !G.flag('c16_end'), marker: () => true, talk: finalScene });
    m.event({ type: 'step', x: 5, y: 20, w: 3, h: 4, run: async () => { if (!G.flag('c16_yan')) await G.narrate('雒城城高池深，张任坚守不出。'); } });
    m.warp(24, 43, 2, 1, 'c16luofeng', 11, 34, 'up', () => G.flag('c16_leng') && !G.flag('c16_pt'), '庞统：先破了雒城前的冷苞，再走小路。');
    K.deco(m, 'sign', 23, 24, { text: '岔路' });
    m.event({ type: 'inspect', x: 23, y: 24, w: 1, h: 1, run: () => G.narrate('路牌：西 · 雒城大路　南 · 山间小路（落凤坡）') });
    K.deco(m, 'sign', 9, 23, { text: '金雁桥' });
    m.event({ type: 'inspect', x: 9, y: 23, w: 1, h: 1, run: () => G.narrate('金雁桥：雒城东门外的一座石桥。') });
    for (const [x, y] of [[4, 4], [12, 6], [20, 3], [6, 30], [14, 34], [40, 30], [50, 26], [54, 36], [44, 40], [18, 12], [26, 8]]) K.mountain(m, x, y);
    K.forest(m, { seed: 1611, thr: 0.6, kinds: ['pine', 'bamboo', 'pine', 'dark'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function fuguanScene() {
    if (G.flag('c16_fu')) return;
    await G.lines([
      ['pangtong', '（低声）主公，杨怀、高沛二人，必来送行。他二人身藏利刃——'],
      ['yanghuai', '闻皇叔远回，特具薄礼相送。'],
      ['liubei', '（酒过三巡）吾有密事，与二位将军商议。闲人退避。'],
    ]);
    await G.narrate('左右退下。刘备喝声"拿下！"，刘封、关平左右抢出，就二人身上，各搜出利刃一口——');
    await G.lines([
      ['gaopei', '既被识破……一不做，二不休！'],
    ]);
    const r = await G.battle(['yanghuai', 'gaopei'], { bg: 'shu', boss: true, intro: '杨怀、高沛 拔刃相向！' });
    if (r !== 'win') return;
    G.setFlag('c16_fu');
    await G.narrate('杨怀、高沛伏诛。庞统令大军扮作二人部曲，赚开关门，兵不血刃，夺了涪关。');
    await G.lines([
      ['liubei', '（设宴犒军，酒酣）今日之会，可为乐乎？'],
      ['pangtong', '伐人之国而以为乐，非仁者之兵也。'],
      ['liubei', '……（默然，良久）吾醉了，士元勿怪。'],
    ]);
    await G.notice('夺取涪关！\n西去雒城。岔路口有粮官，可以休整。');
  }

  async function lengbaoScene() {
    if (G.flag('c16_leng')) return;
    await G.lines([
      ['huangzhong', '主公，雒城前寨冷苞、邓贤，老夫愿往！'],
      ['weiyan', '老将军年迈，还是让魏延去吧！'],
      ['huangzhong', '你说我老？——你敢与我比试武艺么！'],
      ['liubei', '二将不必相争！同去，谁先建功，便是首功。'],
      ['lengbao', '刘备虚仁假义，夺我涪关！冷苞在此——'],
    ]);
    const r = await G.battle(['lengbao', 'shubing2', 'shugong2'], { bg: 'shu', boss: true, intro: '雒城守将 冷苞！' });
    if (r !== 'win') return;
    G.setFlag('c16_leng');
    await G.narrate('黄忠、魏延并力，邓贤中箭落马，冷苞被魏延生擒。冷苞假意投降，回城后决涪江之水欲淹刘备营寨，被魏延识破斩首。');
    await G.narrate('雒城坚固，攻打不下。这时，荆州送来孔明的书信——');
    await G.lines([
      ['liubei', '（读信）"亮夜算太乙数，今年岁次癸巳，罡星在西方；又观乾象，太白临于雒城之分：主将帅身上多凶少吉，切宜谨慎。"'],
      ['pangtong', '（暗想：孔明怕我取了西川，成了功，故意作书相阻耳。）'],
      ['pangtong', '统亦算太乙数，已知罡星在西，应主公合得西川，别不主凶事。统亦占天文，见太白临于雒城，先斩蜀将冷苞，已应凶兆矣。主公不可疑心，可急进兵。'],
      ['liubei', '……吾昨夜梦一神人，手执铁棒击吾右臂，觉来犹自臂疼。此行莫非不佳？'],
      ['pangtong', '壮士临阵，不死带伤，理之自然也。何故以梦寐之事疑心乎？'],
    ]);
    await G.narrate('刘备只得依从：自引黄忠走大路，庞统、魏延走南边的小路，两路合取雒城。临行，庞统的坐骑失蹄，将他掀落马下——');
    await G.lines([
      ['liubei', '军师何故乘此劣马？——我所骑白马，性极驯熟，军师可骑，万无一失。劣马吾自乘之。'],
      ['pangtong', '（下马拜谢）深感主公厚恩，虽万死亦不能报也！'],
    ]);
    G.setParty(['pangtong', 'weiyan', 'huangzhong']);
    await G.notice('庞统骑上了刘备的白马。\n由岔路口南下，走小路。\n（本段：庞统、魏延、黄忠出战）');
  }

  /* ---------------- 落凤坡 ---------------- */
  B.c16luofeng = () => {
    const m = new G.GameMap('c16luofeng', '落 凤 坡', 24, 38, TL.GRASS);
    Object.assign(m, { seed: 1631, music: 'boss', ambient: 'leaves', leafColor: 'rgba(160,110,60,0.8)', pal: { gh: 70, gs: 26, gl: 20 }, battleBg: 'gorge', flowers: 0, tint: 'rgba(80,30,20,0.18)' });
    m.road([[11.5, 38], [11.5, 30], [14, 24], [10, 16], [12.5, 8], [12.5, 3]], 0.9, TL.PATH);
    for (const [x, y] of [[2, 30], [17, 30], [2, 20], [17, 18], [3, 10], [17, 8], [1, 2], [18, 1]]) K.mountain(m, x, y, 1);
    m.prop('stele', 15, 5, 1, 1, { text: '落凤坡', foot: [15, 5, 1, 1] });
    m.prop('arrows', 9, 7, 3, 3, { nofoot: true, sortBias: -50000, cond: () => G.flag('c16_pt') });
    m.reserve(11, 31, 2, 7);
    K.forest(m, { seed: 1635, thr: 0.48, kinds: ['pine', 'dark', 'bamboo', 'dark'], avoid: 1 });
    m.warp(10, 37, 4, 1, 'c16luofeng', 11, 35, 'up', () => false, '魏延：军师，此处山势逼窄，树木丛杂……小心为是。');
    m.event({ type: 'step', x: 10, y: 9, w: 5, h: 3, run: luofengScene });
    m.npc({ id: 'zrlf', spec: 'zhangren', x: 12, y: 5, dir: 'down', aggro: true, cond: () => !G.flag('c16_pt'), talk: luofengScene });
    m.onEnter = async () => {
      if (G.flag('c16_lfin')) return; G.setFlag('c16_lfin');
      await G.lines([
        ['weiyan', '军师，这条小路，两山逼窄，树木丛杂，正值夏末秋初，枝叶茂盛……'],
        ['pangtong', '（心中犹疑）……走吧。'],
      ]);
    };
    return m;
  };

  async function luofengScene() {
    if (G.flag('c16_pt')) return;
    await G.lines([
      ['pangtong', '（勒马）此处是何地？'],
      ['weiyan', '（问降卒）此地名为……"落凤坡"。'],
      ['pangtong', '（大惊）吾道号凤雏，此处名落凤坡——不利于吾！后军疾退！'],
    ]);
    G.audio.sfx('gong'); G.shake(8, 0.6);
    await G.narrate('只听山坡前一声炮响，箭如飞蝗——');
    const r = await G.battle(['zhangren', 'shubing2', 'shugong2'], { bg: 'gorge', boss: true, intro: '张任伏兵 截住小路！' });
    if (r !== 'win') return;
    G.setFlag('c16_pt');
    await G.narrate('魏延、黄忠奋力杀退伏兵。正要回头接应，张任在高处望见白马——');
    await G.lines([['zhangren', '骑白马者，必是刘备！——乱箭射之！']]);
    G.audio.sfx('crit'); G.shake(10, 0.8);
    await G.fadeOut(1.2);
    await G.narrate('可怜庞士元，竟死于乱箭之下。时年三十六岁。');
    await G.narrate('后人有诗叹曰：古岘相连紫翠堆，士元有宅傍山隈。儿童惯识呼鸠曲，闾巷曾闻展骥才。预计三分平刻削，长驱万里独徘徊。谁知天狗流星坠，不使将军衣锦回。');
    G.leaveParty('pangtong');
    await G.fadeIn(1.0);
    await G.lines([
      ['weiyan', '军师——！'],
      ['huangzhong', '……快！保着军师的遗体，杀回去见主公！'],
    ]);
    await G.notice('庞统 阵亡。\n（他的护甲留在了行囊里）');
    await G.fadeOut(1.0);
    await G.narrate('刘备闻报，望西痛哭不已。退守涪关，急遣关平往荆州请孔明。');
    await G.narrate('孔明正在七夕赏月，忽见西方一星，其大如斗，从天坠下，流光四散——掷杯于地，掩面大哭："庞士元休矣！"');
    await G.narrate('孔明留关羽守荆州，令张飞领一万兵从大路取巴州、雒城之西；赵云为先锋，溯江而上；自与简雍、蒋琬随后。');
    if (G.catchUp) G.catchUp(['zhangfei']);
    G.setParty(['zhangfei']);
    G.world.load('c16bajun', 17, 27, 'up');
    G.world.banner = null;
    await G.fadeIn(1.0);
    await G.lines([
      ['zhangfei', '军师叮嘱俺：西川豪杰甚多，不可轻敌；于路戒约三军，勿得掳掠百姓，以失民心。'],
      ['zhangfei', '前面便是巴郡。守将叫严颜，听说是个老将，硬气得很。'],
    ]);
    await G.notice('张飞单独出战。\n巴郡守将严颜闭城不出——想办法引他出来。');
  }

  /* ---------------- 巴郡 ---------------- */
  B.c16bajun = () => {
    const m = new G.GameMap('c16bajun', '巴 郡', 36, 30, TL.GRASS);
    Object.assign(m, { seed: 1651, music: 'camp', pal: SHU, ambient: 'leaves', leafColor: 'rgba(120,160,90,0.8)', flowers: 0.03, battleBg: 'shu' });
    K.walls(m, 4, 0, 31, 12, [{ side: 's', x: 16, plaque: '巴郡' }]);
    m.road([[17.5, 30], [17.5, 11]], 1, TL.PATH);
    m.road([[17.5, 20], [8, 19], [3, 14], [2.5, 8]], 0.6, TL.PATH);                 // 西边小路
    m.prop('hall', 12, 2, 11, 6, { sign: '太守府', roof: '#3a4a3a' });
    for (const [x, y] of [[14, 11], [21, 11]]) K.deco(m, 'flag', x, y, { text: '严', color: '#3a5a3a', tcol: '#f6e7c1' });
    K.tent(m, 8, 24, { red: true }); K.tent(m, 24, 24, { red: true });
    K.deco(m, 'flag', 15, 26, { text: '张', color: '#8a1e1e', tcol: '#f6e7c1' }); K.deco(m, 'fire', 21, 25, { light: 140 });
    m.reserve(16, 25, 3, 5); m.reserve(1, 7, 3, 3);
    K.innerTrees(m, 5, 2, 30, 10, 1657, 0.4);
    K.forest(m, { seed: 1655, thr: 0.62, kinds: ['bamboo', 'pine', 'tree'] });
    m.warp(16, 29, 3, 1, 'c16bajun', 17, 27, 'up', () => false, '张飞：严颜那老匹夫还没拿下，俺不回去！');
    m.warp(16, 11, 3, 1, 'c16bajun', 17, 14, 'down', () => false, '城门紧闭。城上严颜冷笑："张飞匹夫，有本事便来攻城！"');
    m.npc({ id: 'bjs1', spec: 'huban', x: 20, y: 27, dir: 'left', marker: () => !G.flag('c16_ruse'), talk: ruseTalk });
    m.npc({ id: 'bjinn', spec: 'innkeeper', x: 11, y: 27, dir: 'right', talk: () => restAndSave('innkeeper', '将军，营中酒肉管够，歇歇吧！', '伙夫') });
    m.event({ type: 'step', x: 1, y: 7, w: 3, h: 3, run: yanyanScene });
    m.npc({ id: 'yy16', spec: 'yanyan', x: 2, y: 9, dir: 'down', aggro: true, cond: () => G.flag('c16_ruse') && !G.flag('c16_yan'), talk: yanyanScene });
    m.npc({ id: 'yyw', spec: 'yanyan', x: 17, y: 12, dir: 'down', cond: () => !G.flag('c16_ruse'), talk: K.talk([['yanyan', '（城上）张飞匹夫！吾乃巴郡严颜，宁死不降！你有本事，便攻上来！']]) });
    return m;
  };

  async function ruseTalk() {
    if (G.flag('c16_ruse')) { await say('huban', '将军，西边小路！', { name: '军士' }); return; }
    await G.lines([
      ['huban', '将军，咱们连骂了十几日，那严颜就是不出城……', { name: '军士' }],
      ['zhangfei', '（眼珠一转，大声）传令下去：今夜二更造饭，三更起程，人衔枚，马去铃，俺亲自引军从西边小路，偷过巴郡！'],
      ['zhangfei', '（压低声音）……城里的细作，这会儿该听见了吧，嘿嘿。'],
    ]);
    G.setFlag('c16_ruse');
    await G.notice('张飞故意泄露"走小路"的军令。\n夜里，去营地西北的小路。');
  }

  async function yanyanScene() {
    if (!G.flag('c16_ruse') || G.flag('c16_yan')) return;
    await G.narrate('三更时分，严颜果然引军伏于小路两旁。见一将当先，丈八蛇矛，严颜一声鼓响，伏兵齐出——');
    await G.narrate('不料那"张飞"却是假扮的；背后一声锣响，真张飞引军杀到！');
    await G.lines([
      ['zhangfei', '老贼休走！俺等得你好苦！'],
      ['yanyan', '……中计矣！张飞匹夫，吾与你决一死战！'],
    ]);
    const r = await G.battle(['yanyan'], { bg: 'shu', boss: true, party: ['zhangfei'], intro: '巴郡老将 严颜！' });
    if (r !== 'win') return;
    G.setFlag('c16_yan');
    await G.narrate('张飞活捉严颜，夺了巴郡。刀斧手推严颜至厅前，严颜立而不跪——');
    await G.lines([
      ['zhangfei', '（睁圆环眼）大将到此，何为不降，而敢拒敌！'],
      ['yanyan', '汝等无义，侵我州郡！但有断头将军，无降将军！'],
      ['zhangfei', '（大怒）推出去斩了！'],
      ['yanyan', '（颜色不变）贼匹夫！砍头便砍，何怒也？'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('张飞见严颜声音雄壮，面不改色，乃回嗔作喜，下阶喝退左右，亲解其缚，取衣衣之，扶在正中高坐，低头便拜——');
    await G.lines([
      ['zhangfei', '适来言语冒渎，幸勿见责。吾素知老将军乃豪杰之士也。'],
      ['yanyan', '……（感其恩义）败军之将，荷蒙厚恩，无以为报，愿施犬马之劳。从此到雒城，凡守御关隘，都是老夫所管——老夫在前，传令诸关，皆不战而降。'],
    ]);
    await G.notice('严颜归降。\n张飞一路兵不血刃，直抵雒城。');
    await G.fadeOut(1.0);
    await G.narrate('孔明、赵云亦到。刘备与孔明相见，说起庞统，又痛哭一场。');
    await G.narrate('孔明定下计策：在雒城东门外的金雁桥埋伏，诱张任来战。');
    G.setParty(FULL);
    G.restoreAll();
    G.world.load('c16world', 12, 22, 'left');
    G.world.banner = null;
    await G.fadeIn(1.0);
    await G.lines([
      ['zhugeliang', '张任是蜀中名将，智勇兼备。士元之仇，就在今日。'],
      ['liubei', '……士元，你看着。'],
    ]);
    await G.notice('全军会合！\n在金雁桥前，迎战张任。');
  }

  async function finalScene() {
    if (G.flag('c16_end')) return;
    await G.lines([
      ['zhangren', '诸葛亮！庞统已死，你又来送死么！'],
      ['zhugeliang', '（羽扇一指）汝军败将，敢来迎敌！'],
      ['huangzhong', '张任！落凤坡那一箭，今日老夫要讨回来！'],
    ]);
    const r = await G.battle(['zhangren2', 'shubing2', 'shugong2', 'shubing2'], { bg: 'shu', boss: true, intro: '金雁桥 · 张任！' });
    if (r !== 'win') return;
    G.setFlag('c16_end');
    await G.narrate('张任退过金雁桥，桥已被拆断；欲投北走，被赵云截住；又投南走，芦苇丛中魏延、黄忠伏兵齐出——张任被生擒。');
    await G.lines([
      ['liubei', '蜀中诸将，望风而降，汝何不早降？'],
      ['zhangren', '忠臣岂肯事二主乎！'],
      ['liubei', '汝不识天时耳。降即免死。'],
      ['zhangren', '今日便降，久后也不降！可速杀我！'],
    ]);
    await G.narrate('刘备不忍杀之。张任厉声高骂。孔明命斩之以全其名。');
    await G.narrate('刘备感叹不已，令收其尸首，葬于金雁桥侧，以表其忠。');
    await G.chapterEnd(G.CHAPTERS[16].endLines);
  }

  G.CHAPTERS[16] = {
    title: '落凤坡',
    prologue: [
      '庞统献三计：上计，选精兵昼夜兼道径袭成都；',
      '中计，诈称回荆州，诱杀涪关守将杨怀、高沛，先取涪关；',
      '下计，退还白帝，连引荆州，徐还图之。',
      '刘备说："上计太促，下计太缓，中计不迟不疾，可以行之。"',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.setParty(WEST);
      G.restoreAll();
      const w = G.world;
      w.load('c16world', 50, 12, 'down');
      await G.fadeIn(1.2);
      await G.lines([
        ['pangtong', '主公，依计行事：只说要回荆州，涪关的杨怀、高沛必来送行。'],
        ['liubei', '……季玉待我不薄。唉，事已至此。'],
      ]);
      await G.notice('西南前往涪关。');
    },
    endLines: [
      '雒城攻破，刘备大军直逼成都。',
      '刘璋走投无路，派人向汉中张鲁求救。',
      '张鲁帐下，有一员西凉猛将——',
      '他曾在潼关杀得曹操割须弃袍，',
      '他叫马超，字孟起，人称"锦马超"。',
    ],
  };
})();
