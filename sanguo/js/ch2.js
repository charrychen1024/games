/* ============================================================
 * 烽烟录 · 第二章　黄巾覆灭
 * 广宗汉军大营 → 冀州原野 → 曲阳村 → 阳城谷（破张宝妖术）→ 卢植被押、救董卓
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const AUT = { gh: 44, gs: 42, gl: 30, path1: '#a88a58', path2: '#b89a68' };
  const LEAF = 'rgba(214,140,50,0.85)';
  const GROUPS = [
    { e: ['hjjing', 'hjjing'], w: 3 }, { e: ['hjjing', 'hjjing', 'hjyao'], w: 2 }, { e: ['hjmeng', 'hjjing'], w: 2 },
    { e: ['hjyao', 'hjyao'], w: 1 }, { e: ['hjmeng', 'hjyao', 'hjjing'], w: 1 },
  ];
  const partyTo = (x, y, dir) => G.world.party.forEach((u, i) => G.world.place(i, x, y, dir));

  /* ---------------- 广宗汉军大营 ---------------- */
  B.c2camp = () => {
    const m = new G.GameMap('c2camp', '广宗 · 汉军大营', 32, 24, TL.GRASS);
    Object.assign(m, { seed: 201, music: 'town', ambient: 'leaves', leafColor: LEAF, pal: AUT, battleBg: 'autumn', flowers: 0.03 });
    m.reserve(14, 21, 4, 3);
    m.warp(14, 23, 4, 1, 'c2world', 11, 12, 'down');
    m.road([[15.5, 23], [15.5, 9]], 0.8, TL.PATH);
    m.road([[6, 12.5], [25, 12.5]], 0.6, TL.PATH);
    K.stakeRing(m, 1, 1, 30, 22, [[14, 22, 4, 1]]);
    for (let x = 0; x < 32; x++) { m.tree(x, 0, 'autumn'); if (x < 13 || x > 18) m.tree(x, 23, 'autumn'); }
    for (let y = 1; y < 23; y++) { m.tree(0, y, 'autumn'); m.tree(31, y, 'autumn'); }
    K.tent(m, 12, 3, { big: true, w: 7, h: 5, red: true, sign: '卢' });
    for (const [x, y] of [[3, 3], [25, 3], [3, 14], [25, 14], [7, 17], [21, 17], [7, 3], [21, 3]]) K.tent(m, x, y, { red: true });
    K.deco(m, 'tower', 3, 19, { w: 2, h: 2 }); K.deco(m, 'tower', 26, 19, { w: 2, h: 2 });
    for (const [x, y] of [[11, 5], [19, 5], [13, 10], [18, 10], [12, 20], [19, 20]]) K.deco(m, 'flag', x, y, { color: '#a8322a', text: '汉', tcol: '#f6e7c1' });
    K.deco(m, 'rack', 4, 11); K.deco(m, 'rack', 27, 11); K.deco(m, 'crates', 10, 15); K.deco(m, 'crates', 22, 15); K.deco(m, 'jar', 24, 8); K.deco(m, 'cart', 5, 8, { w: 2 });

    m.npc({ id: 'luzhi', spec: 'luzhi', x: 15, y: 8, dir: 'down', cond: () => !G.flag('c2_baodead'), marker: () => !G.flag('c2_quest'), talk: async () => {
      if (!G.flag('c2_quest')) {
        await G.lines([
          ['luzhi', '玄德！果然是你。缑氏山一别，已有数年了吧。'],
          ['liubei', '恩师！学生刘备，率两位结义兄弟前来助战。'],
          ['luzhi', '好，好！大兴山、青州之捷，老夫都听说了。你没有辜负所学。'],
          ['luzhi', '如今张角困守广宗，老夫筑垒挖堑，围之数月，破城只在旦夕。'],
          ['luzhi', '只是张角之弟、"地公将军"张宝，盘踞西北的阳城谷，与广宗互为犄角。'],
          ['luzhi', '此人精通妖术，能呼风唤雨、剪纸成兵。官军几次进剿，都被他的妖法吹得七零八落。'],
          ['zhangfei', '什么妖术！俺一矛下去，管他是人是鬼！'],
          ['luzhi', '翼德勇猛可嘉，但不可轻敌。听闻曲阳村有位老人，曾亲眼见过张宝作法。'],
          ['luzhi', '你们不妨先去打听破解之法，再进阳城谷。'],
          ['liubei', '学生领命！'],
          ['luzhi', '营中军需官处可以补给，军医那里可以疗伤。去吧，玄德。'],
        ]);
        G.setFlag('c2_quest');
      } else if (!G.flag('c2_blood')) await say('luzhi', '曲阳村在大营东南，过了那片树林便是。张宝的妖术，须找到破法才能对付。');
      else await say('luzhi', '有了破法，便去阳城谷吧。老夫在此等你的捷报。');
    } });
    m.npc({ id: 'qm', spec: 'hanbing', x: 8, y: 11, dir: 'down', talk: K.shopTalk('hanbing', ['shangyao', 'jinchuang', 'zhuojiu', 'xuming', 'tiejia'], '军需', '军需官在此！要补给的尽管说。', '军需官') });
    m.npc({ id: 'doctor', spec: 'oldman', x: 22, y: 11, dir: 'down', talk: async () => {
      await say('oldman', '老朽是营中军医。伤了就来，不收钱。', { name: '军医' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      await G.notice('全军兵力、策略恢复了。');
      const s = await G.choose(['记录进度', '不用了']);
      if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 's1', spec: 'hanbing', x: 10, y: 16, wander: 2, talk: async () => {
      if (G.flag('c2_cage')) await say('hanbing', '卢中郎被押走了……换了个董卓来，听说也吃了败仗。');
      else if (G.flag('c2_baodead')) await say('hanbing', '什么？卢中郎他……被朝廷的人带走了？');
      else await say('hanbing', '前几天去阳城谷，天上突然下起纸人来，一碰就活了……吓死俺了。');
    } });
    m.npc({ id: 's2', spec: 'hanbing', x: 21, y: 16, wander: 2, talk: K.talk([['hanbing', '卢中郎治军严明，从不克扣军粮。可朝廷派来督军的宦官，好像很不满意……']]) });
    m.npc({ id: 's3', spec: 'hanbing', x: 13, y: 21, dir: 'up', talk: K.talk([['hanbing', '出了营门往东南是曲阳村，往东北是阳城谷。阳城谷那边，常年阴雨不断。']]) });
    return m;
  };

  /* ---------------- 冀州原野 ---------------- */
  B.c2world = () => {
    const m = new G.GameMap('c2world', '冀 州', 56, 40, TL.GRASS);
    Object.assign(m, { seed: 233, music: 'field', ambient: 'leaves', leafColor: LEAF, pal: AUT, battleBg: 'autumn', flowers: 0.03 });
    K.tallGrass(m, 255, 0.55);
    m.road([[0, 33], [14, 32], [26, 35], [40, 33], [56, 34]], 1.2, TL.WATER);
    m.road([[11.5, 11], [11.5, 16], [20, 18], [29.5, 21], [29.5, 26]], 0.75, TL.PATH);
    m.road([[20, 18], [32, 15], [40, 11], [46, 8], [47.5, 5], [47.5, 3]], 0.75, TL.PATH);
    m.prop('campicon', 10, 8, 4, 3, { label: '汉军大营', han: true, foot: [10, 8, 4, 3] });
    m.prop('townicon', 28, 23, 4, 3, { label: '曲阳村', foot: [28, 23, 4, 3] });
    m.warp(11, 11, 2, 1, 'c2camp', 15, 22, 'up'); m.reserve(11, 12, 2, 1);
    m.warp(29, 26, 2, 1, 'c2village', 16, 22, 'up'); m.reserve(29, 27, 2, 1);
    m.warp(47, 3, 2, 1, 'c2valley', 15, 38, 'up'); m.reserve(47, 4, 2, 1);
    K.mountain(m, 44, 2, 0); K.mountain(m, 49, 2, 0);
    for (let x = 0; x < 54; x += 3) K.mountain(m, x, 0);
    for (let y = 3; y < 38; y += 2) K.mountain(m, 53, y);
    for (const [x, y] of [[41, 4], [51, 5], [38, 2], [35, 5], [44, 13], [49, 11], [47, 17], [2, 22], [5, 26], [40, 22], [45, 25]]) K.mountain(m, x, y);
    K.deco(m, 'sign', 45, 6, { text: '阳城谷' }); K.deco(m, 'sign', 22, 17, { text: '曲阳村' });
    m.event({ type: 'inspect', x: 45, y: 6, w: 1, h: 1, run: () => G.narrate('路牌：北 · 阳城谷　阴雨连绵，行人止步') });
    m.event({ type: 'inspect', x: 22, y: 17, w: 1, h: 1, run: () => G.narrate('路牌：东南 · 曲阳村　西北 · 汉军大营　东北 · 阳城谷') });
    K.forest(m, { seed: 241, thr: 0.62, kinds: ['autumn', 'autumn', 'gold', 'pine'] });
    // 押解卢植的囚车（打败张宝后出现在路上）
    const cageOn = () => G.flag('c2_baodead') && !G.flag('c2_cage');
    m.prop('cage', 15, 13, 2, 1, { nofoot: true, who: 'luzhi', cond: cageOn });
    m.npc({ id: 'zuofeng', spec: 'zuofeng', x: 18, y: 14, dir: 'down', cond: cageOn });
    m.npc({ id: 'esc1', spec: 'hanbing', x: 14, y: 14, dir: 'down', cond: cageOn });
    m.npc({ id: 'esc2', spec: 'hanbing', x: 19, y: 13, dir: 'down', cond: cageOn });
    m.event({ type: 'step', x: 11, y: 14, w: 7, h: 4, cond: cageOn, run: cageScene });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.085 }, groups: GROUPS };
    return m;
  };

  async function cageScene() {
    const w = G.world;
    await G.lines([
      ['zhangfei', '大哥，前面路上……那不是一辆囚车吗？'],
      ['liubei', '囚车里的人……是恩师！'],
    ]);
    for (const u of w.party) u.dir = 'up';
    await G.lines([
      ['liubei', '恩师！这是怎么回事？'],
      ['luzhi', '玄德……老夫围张角于广宗，眼看就要破城。朝廷派黄门左丰前来督军，向老夫索要贿赂。'],
      ['luzhi', '军中粮饷尚且不足，哪有余钱奉承天使？左丰怀恨在心，回朝诬我"高垒不战，惰慢军心"……'],
      ['zuofeng', '少啰嗦！卢植怠慢军机，奉旨押解回京问罪！闲杂人等，速速闪开！'],
      ['zhangfei', '岂有此理！俺这就宰了这个阉狗，救出卢公！'],
      ['guanyu', '三弟不可莽撞！'],
      ['liubei', '三弟住手！朝廷自有公论，岂可造次！'],
      ['luzhi', '玄德说得对……你们，好自为之。'],
    ]);
    G.setFlag('c2_cage_seen');
    await G.narrate('囚车辚辚，在秋风中渐渐远去。');
    await G.lines([
      ['zhangfei', '大哥！就这么眼睁睁看着？！'],
      ['liubei', '……忠良下狱，小人当道。这天下，真的病了。'],
    ]);
    G.audio.sfx('gong');
    G.shake(5, 0.5);
    await G.narrate('忽然，东北方向杀声震天——');
    await G.lines([
      ['hanbing', '救命！张梁的大军杀过来了！董中郎将的兵马全溃了！', { name: '溃兵' }],
      ['guanyu', '大哥，是黄巾"人公将军"张梁！'],
      ['liubei', '不管是谁的兵马，都是大汉的将士！二弟、三弟，随我杀过去！'],
    ]);
    const r = await G.battle(['zhangliang', 'hjjing', 'hjmeng'], { bg: 'autumn', boss: true, intro: '人公将军 张梁 杀到！' });
    if (r !== 'win') return;
    G.setFlag('c2_cage');
    await G.narrate('张梁大败，引残兵退回广宗。被围的官军得救了。');
    await G.lines([
      ['dongzhuo', '哼，多亏你们来得及时。你们是哪一路的兵马？现居何职？'],
      ['liubei', '在下涿郡刘备，并无官职，乃是一介白身。'],
      ['dongzhuo', '白身？……哼。'],
    ]);
    await G.narrate('董卓神色倨傲，拂袖而去，连一声谢都没有。');
    await G.lines([
      ['zhangfei', '我等舍命救了这厮，他竟如此无礼！不杀了他，难消俺心头之恨！'],
      ['guanyu', '三弟！他是朝廷命官，杀了他，我们便成了反贼。'],
      ['liubei', '……算了。天下之大，何愁没有我兄弟用武之地。走吧。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[2].endLines);
  }

  /* ---------------- 曲阳村 ---------------- */
  B.c2village = () => {
    const m = new G.GameMap('c2village', '曲阳村', 34, 24, TL.GRASS);
    Object.assign(m, { seed: 251, music: 'town', ambient: 'leaves', leafColor: LEAF, pal: AUT, flowers: 0.05 });
    m.road([[16.5, 24], [16.5, 10]], 0.6, TL.PATH);
    m.road([[3, 11.5], [31, 11.5]], 0.6, TL.PATH);
    m.road([[6, 8], [6, 11]], 0.6, TL.PATH); m.road([[24, 8], [24, 11]], 0.6, TL.PATH);
    m.road([[5, 19], [5, 13]], 0.6, TL.PATH); m.road([[22, 19], [22, 13]], 0.6, TL.PATH);
    m.rect(9, 14, 5, 6, TL.TALL); m.rect(26, 3, 5, 6, TL.TALL);
    m.warp(16, 23, 2, 1, 'c2world', 29, 27, 'down');
    m.reserve(15, 21, 4, 3);
    m.prop('house', 3, 3, 7, 5, { sign: '客栈', roof: '#4a3b36' });
    m.prop('house', 19, 3, 7, 5, { sign: '杂货', roof: '#45403a' });
    m.prop('house', 3, 15, 5, 4, { sign: '屠', roof: '#3d4654', lantern: false });
    m.prop('house', 20, 15, 5, 4, { roof: '#4a3b36', lantern: false });
    m.prop('house', 11, 3, 5, 4, { roof: '#45403a', lantern: false });
    K.deco(m, 'well', 13, 9); K.deco(m, 'jar', 9, 8); K.deco(m, 'crates', 18, 8);
    K.tent(m, 28, 15, {});
    K.deco(m, 'flag', 31, 15, { text: '黄' });
    for (let x = 0; x < 34; x++) { m.tree(x, 0, 'autumn'); m.tree(x, 1, G.hash(x, 1) < 0.5 ? 'autumn' : 'gold'); if (x < 15 || x > 18) { m.tree(x, 23, 'autumn'); m.tree(x, 22, 'gold'); } }
    for (let y = 2; y < 22; y++) { m.tree(0, y, 'autumn'); m.tree(1, y, 'gold'); m.tree(32, y, 'autumn'); m.tree(33, y, 'gold'); }
    K.treesAt(m, [[9, 21], [14, 21], [26, 20], [19, 20], [2, 12]], 'autumn');
    m.npc({ id: 'inn2', spec: 'innkeeper', x: 6, y: 8, dir: 'down', talk: K.innTalk('innkeeper', 40) });
    m.npc({ id: 'shop2', spec: 'merchant', x: 24, y: 8, dir: 'down', talk: K.shopTalk('merchant', ['shangyao', 'jinchuang', 'zhuojiu', 'xuming', 'binliang', 'tiejia'], '杂货', '兵荒马乱的，能买到东西就算不错啦。') });
    m.npc({ id: 'elder', spec: 'oldman', x: 22, y: 19, dir: 'down', marker: () => G.flag('c2_quest') && !G.flag('c2_elder'), talk: async () => {
      if (G.flag('c2_blood')) { await say('oldman', '去吧，为乡亲们除了这一害！', { name: '村老' }); return; }
      await G.lines([
        ['oldman', '你们是卢中郎派来的？唉，那张宝的妖术，老朽亲眼见过。', { name: '村老' }],
        ['oldman', '他披发仗剑，念几句咒，便有狂风黑雾、纸人纸马从天而降，刀砍不入，箭射不穿。', { name: '村老' }],
        ['jianyong', '老丈可知破解之法？'],
        ['oldman', '老朽年轻时听一位云游道人说过：邪术妖法，最怕污秽之物。', { name: '村老' }],
        ['oldman', '若以猪、羊、狗血泼之，妖法自破。', { name: '村老' }],
        ['zhangfei', '猪血？哈哈，俺老张当年就是卖肉的，这个好办！'],
        ['oldman', '村东头的王屠户家里便有。只是……前几日他的猪都被一伙黄巾强人抢走了。', { name: '村老' }],
      ]);
      G.setFlag('c2_elder');
    } });
    m.npc({ id: 'butcher', spec: 'smith', x: 5, y: 19, dir: 'down', marker: () => G.flag('c2_elder') && !G.flag('c2_blood') && G.flag('c2_bandit'), talk: async () => {
      if (G.flag('c2_blood')) { await say('smith', '那妖人怕不怕俺的血？哈哈！', { name: '王屠户' }); return; }
      if (!G.flag('c2_bandit')) {
        await G.lines([
          ['smith', '官人！俺的猪全叫那伙黄巾强盗抢了去！他们就扎在村子东头，还天天来要粮。', { name: '王屠户' }],
          ['zhangfei', '同行有难，俺老张岂能不管！大哥，去把那伙毛贼收拾了！'],
        ]);
        return;
      }
      if (!G.flag('c2_elder')) { await say('smith', '多谢几位壮士赶走了强盗！以后要什么尽管开口！', { name: '王屠户' }); return; }
      await G.lines([
        ['smith', '猪羊狗血？村老都跟俺说了。壮士们替俺夺回了猪，这点东西算什么！', { name: '王屠户' }],
        ['smith', '猪血、羊血、狗血，俺各装满了一坛，拿去泼那妖人！', { name: '王屠户' }],
      ]);
      G.setFlag('c2_blood'); G.audio.sfx('buy');
      await G.notice('得到 秽血坛 ×3\n可以破解张宝的妖术了！');
    } });
    K.guard(m, { id: 'bandit1', spec: 'hjjing', x: 29, y: 13, dir: 'left', flag: 'c2_bandit', group: ['hjjing', 'hjjing', 'hjmeng'], bg: 'autumn',
      lines: [['hjjing', '哪来的多管闲事的？这村子归咱们黄天管了！'], ['zhangfei', '抢老百姓的猪，算什么好汉！']],
      after: async () => { await say('liubei', '强人已散。回去告诉王屠户吧。'); } });
    K.guard(m, { id: 'bandit2', spec: 'ylishi', x: 31, y: 13, dir: 'left', flag: 'c2_bandit', group: ['hjjing', 'hjjing', 'hjmeng'], bg: 'autumn', lines: [['hjjing', '弟兄们，抄家伙！']] });
    m.npc({ id: 'kid2', spec: 'child', x: 14, y: 13, wander: 2, talk: K.talk([['child', '大哥哥，你们是来打黄巾的吗？我爹爹被他们抓去当兵了……']]) });
    m.npc({ id: 'wom2', spec: 'woman', x: 19, y: 9, wander: 2, talk: K.talk([['woman', '今年收成本来就不好，黄巾一来，连种子粮都被抢光了。']]) });
    m.npc({ id: 'farm2', spec: 'farmer', x: 11, y: 20, wander: 1, talk: K.talk([['farmer', '阳城谷那边天天下雨，雷打得吓人。都说是张宝在作法。']]) });
    m.npc({ id: 'deserter', spec: 'hjjing', x: 27, y: 9, dir: 'down', talk: K.talk([
      ['hjjing', '……别、别杀我！俺是逃出来的！俺再也不跟着黄巾干了！', { name: '逃兵' }],
      ['hjjing', '阳城谷里道路曲折，张宝的法坛在最北头。半路有一眼泉水，喝了能解乏。', { name: '逃兵' }],
    ]) });
    return m;
  };

  /* ---------------- 阳城谷 ---------------- */
  B.c2valley = () => {
    const m = new G.GameMap('c2valley', '阳城谷', 30, 40, TL.GRASS);
    Object.assign(m, { seed: 261, music: 'camp', ambient: 'rain', lightning: true, pal: { gh: 100, gs: 22, gl: 15 }, battleBg: 'rain', flowers: 0.01 });
    const pts = [[15, 40], [15, 33], [9, 28], [10, 21], [19, 17], [21, 11], [15, 8]];
    const clear = new Set();
    m.road(pts, 2.3, null, (x, y) => clear.add(x + ',' + y));
    for (let y = 1; y <= 9; y++) for (let x = 7; x <= 23; x++) clear.add(x + ',' + y);
    for (let y = 26; y <= 30; y++) for (let x = 4; x <= 8; x++) clear.add(x + ',' + y);
    m.road(pts, 0.7, TL.PATH);
    m.rect(5, 27, 2, 2, TL.WATER);
    m.warp(14, 39, 3, 1, 'c2world', 47, 4, 'down');
    m.reserve(14, 37, 3, 2);
    K.tent(m, 12, 1, { big: true, w: 7, h: 5 });
    K.deco(m, 'fire', 9, 6, { light: 160 }); K.deco(m, 'fire', 21, 6, { light: 160 });
    K.deco(m, 'flag', 10, 3, { text: '天' }); K.deco(m, 'flag', 20, 3, { text: '黄' });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!clear.has(x + ',' + y)) m.tree(x, y, G.hash(x, y, 3) < 0.15 ? 'rock' : G.hash(x, y, 4) < 0.55 ? 'pine' : 'dark');
    m.event({ type: 'inspect', x: 5, y: 27, w: 2, h: 2, run: async () => {
      if (G.flag('c2_spring')) { await G.narrate('泉水清冽，映着阴沉的天色。'); return; }
      G.setFlag('c2_spring'); G.restoreAll(); G.audio.sfx('heal');
      await G.notice('饮下清冽的山泉，全军兵力与策略恢复了。');
    } });
    K.guard(m, { id: 'v1', spec: 'hjjing', x: 15, y: 32, flag: 'c2_v1', group: ['hjjing', 'hjjing', 'hjyao'], bg: 'rain', lines: [['hjjing', '地公将军有令，擅入者死！']] });
    K.guard(m, { id: 'v2', spec: 'ylishi', x: 10, y: 24, flag: 'c2_v2', group: ['hjmeng', 'hjyao', 'hjjing'], bg: 'rain', lines: [['hjyao', '雷公电母，听我号令！'], ['guanyu', '装神弄鬼！']] });
    K.guard(m, { id: 'v3', spec: 'hjyao', x: 20, y: 14, flag: 'c2_v3', group: ['hjjing', 'hjmeng', 'hjyao'], bg: 'rain', lines: [['hjyao', '前面便是法坛，休想再进一步！']] });
    m.npc({ id: 'zhangbao', spec: 'zhangbao', x: 15, y: 7, dir: 'down', aggro: true, cond: () => !G.flag('c2_baodead'), talk: zhangbaoTalk });
    m.encounters = { rates: { [TL.GRASS]: 0.035, [TL.PATH]: 0.015 }, groups: GROUPS };
    m.onEnter = async () => {
      if (G.flag('c2_valley_in')) return;
      G.setFlag('c2_valley_in');
      await G.lines([['guanyu', '好重的阴气……雨下得如此古怪。'], ['liubei', '大家跟紧，小心埋伏。']]);
    };
    return m;
  };

  async function zhangbaoTalk() {
    await say('zhangbao', '哈哈哈！又来几个送死的！看本将军呼风唤雨，剪纸成兵！');
    G.audio.sfx('gong'); G.shake(6, 0.6);
    await G.narrate('张宝披发仗剑，口中念念有词。霎时狂风大作，黑雾弥漫，无数纸人纸马从天而降！');
    if (!G.flag('c2_blood')) {
      await G.lines([
        ['zhangfei', '什么鬼东西！俺的蛇矛刺上去，跟刺在棉絮里一样！'],
        G.flag('jianyong') || G.state.party.includes('jianyong') ? ['jianyong', '玄德，此乃妖术，刀枪难近！不可硬拼，速退！'] : ['guanyu', '大哥，此乃妖术，刀枪难近！不可硬拼，速退！'],
      ]);
      await G.fadeOut(0.5); partyTo(10, 21, 'up'); G.world.snapCamera(); await G.wait(0.3); await G.fadeIn(0.5);
      await say('liubei', '好厉害的妖法……须得找到破解之法。卢师说曲阳村有位老人见过此术，去问问吧。');
      return;
    }
    await G.lines([
      ['liubei', '早有准备！众军士——泼！'],
    ]);
    await G.narrate('一坛坛猪羊狗血泼洒出去，腥臭冲天。纸人纸马纷纷落地，化作满地碎纸，黑雾也渐渐散了。');
    await G.lines([
      ['zhangbao', '啊！我的道法……！可恶，可恶！跟你们拼了！'],
      ['zhangfei', '妖法没了，看你还拿什么张狂！'],
    ]);
    const r = await G.battle(['zhangbao', 'hjyao', 'hjyao'], { bg: 'rain', boss: true, intro: '地公将军 张宝 杀到！' });
    if (r !== 'win') return;
    G.setFlag('c2_baodead');
    await G.narrate('张宝身负重伤，弃了法坛，趁乱逃入深山。连绵的阴雨，竟渐渐停了。');
    await say('liubei', '妖法已破，阳城谷已平。回大营向恩师复命吧！');
  }

  /* ---------------- 章节 ---------------- */
  G.CHAPTERS[2] = {
    title: '黄巾覆灭',
    prologue: [
      '大兴山一战之后，刘备兄弟又随邹靖驰援青州，大破黄巾。',
      '闻恩师卢植正与张角相持于广宗，刘备辞别邹靖，率部北上。',
      '冀州大地，秋草连天，饿殍遍野。',
      '黄巾"地公将军"张宝据守阳城谷，',
      '传言此人能呼风唤雨，剪纸成兵……',
    ],
    start: async () => {
      const w = G.world;
      w.load('c2camp', 15, 20, 'up');
      w.banner = { text: '广宗 · 汉军大营', t: 0 };
      await G.fadeIn(1.2);
      await G.lines([
        ['guanyu', '大哥，前面便是卢中郎将的大营了。'],
        ['liubei', '恩师当年在缑氏山讲学，教我读书明理。一别数年，不知他老人家身体可好。'],
        ['zhangfei', '大哥的先生，那一定是个了不起的人物！快进去拜见吧！'],
      ]);
    },
    endLines: [
      '中平元年冬，张角病死于广宗。',
      '皇甫嵩乘势进兵，张梁战死，张宝亦为部将所杀。',
      '轰轰烈烈的黄巾之乱，终于平定。',
      '刘备因功授安喜县尉，却因督邮索贿，',
      '张飞怒鞭督邮于馆驿，三兄弟挂印弃官而去。',
      '此时的洛阳，一场更大的风暴正在酝酿……',
    ],
  };
})();
