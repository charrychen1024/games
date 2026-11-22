/* ============================================================
 * 烽烟录 · 第十九章　定军山
 * 汉中（瓦口关·张飞诈醉破张郃 → 天荡山·二老将烧粮）→ 定军山（法正举旗、黄忠斩夏侯渊）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const HZ = { gh: 100, gs: 28, gl: 26 };
  const SHOP = ['xuelian', 'tianxiang', 'yulu', 'xianlu', 'xuming', 'dayan', 'qingzhou', 'shujin', 'longwen'];
  const ARMY = ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao'];
  const GROUPS = [{ e: ['caobing7', 'caobing7'], w: 3 }, { e: ['caobing7', 'caoshe7'], w: 3 }, { e: ['caoqi7', 'caoqi7'], w: 2 }, { e: ['caoshe7', 'caoshe7', 'caobing7'], w: 1 }];
  // 举旗时机对了：夏侯渊军疲惫，兵力与气势都打了折扣
  G.ENEMIES.xiahouyuan_t = Object.assign({}, G.ENEMIES.xiahouyuan, { hp: 8600, str: 168, spec: 'xiahouyuan' });
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };
  const campMenu = (line, title) => async () => {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) await restAndSave('innkeeper', line, '军需官'); else if (k === 1) await G.shop(SHOP, title);
  };

  /* ---------------- 汉中 ---------------- */
  B.c19world = () => {
    const m = new G.GameMap('c19world', '汉 中', 60, 44, TL.GRASS);
    Object.assign(m, { seed: 1901, music: 'field', ambient: 'clouds', pal: HZ, battleBg: 'shu', flowers: 0.04 });
    K.tallGrass(m, 1903, 0.55);
    m.road([[0, 14], [16, 16], [30, 15], [44, 18], [60, 17]], 1.3, TL.WATER);            // 汉水
    m.road([[30.5, 40], [30.5, 28], [44, 26], [52.5, 25]], 0.75, TL.PATH);              // 大营 → 瓦口关
    m.road([[30.5, 28], [28, 20], [28, 6], [24, 3.5]], 0.75, TL.PATH);                 // → 天荡山
    m.road([[28, 22], [14, 24], [3, 24], [0, 24]], 0.75, TL.PATH);                     // → 定军山
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.WATER && Math.abs(x - 28) < 1.5) m.set(x, y, TL.BRIDGE);
    m.prop('townicon', 52, 21, 4, 3, { label: '瓦口关', foot: [52, 21, 4, 3] });
    m.prop('townicon', 20, 0, 4, 3, { label: '天荡山', foot: [20, 0, 4, 3] });
    m.reserve(27, 36, 8, 6); m.reserve(52, 24, 2, 2); m.reserve(23, 3, 2, 2); m.reserve(0, 23, 2, 3);
    K.tent(m, 26, 37, { big: true, w: 5, h: 4, red: true, sign: '汉' });
    K.tent(m, 33, 38, { red: true });
    K.deco(m, 'flag', 29, 41, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' });
    m.npc({ id: 'camp19', spec: 'innkeeper', x: 33, y: 41, dir: 'left', talk: campMenu('主公，汉中天寒，多加件衣裳。', '汉中军需') });
    m.npc({ id: 'fz19', spec: 'fazheng', x: 28, y: 41, dir: 'right', talk: K.talk([['fazheng', '曹操一举而降张鲁，不因此势以图巴、蜀，而留夏侯渊、张郃屯守，身遽北还——此非其智不逮，必将内有忧逼故耳。']]) });
    m.event({ type: 'step', x: 52, y: 24, w: 2, h: 2, run: wakouScene });
    m.npc({ id: 'zh19', spec: 'zhanghe', x: 53, y: 25, dir: 'left', aggro: true, cond: () => !G.flag('c19_wakou'), talk: wakouScene });
    m.event({ type: 'step', x: 23, y: 3, w: 2, h: 2, run: tiandangScene });
    m.npc({ id: 'xhs19', spec: 'caobing', x: 24, y: 4, dir: 'down', aggro: true, cond: () => G.flag('c19_wakou') && !G.flag('c19_td'), talk: tiandangScene });
    m.warp(0, 23, 1, 3, 'c19dingjun', 2, 30, 'right', () => G.flag('c19_td'), '诸葛亮：先破张郃、取天荡山，断了曹军粮草，再图定军山。');
    K.deco(m, 'sign', 29, 30, { text: '汉中' });
    m.event({ type: 'inspect', x: 29, y: 30, w: 1, h: 1, run: () => G.narrate('路牌：东 · 瓦口关　北 · 天荡山　西 · 定军山') });
    for (const [x, y] of [[4, 4], [12, 6], [40, 4], [50, 8], [6, 32], [14, 36], [44, 34], [52, 38], [38, 30], [18, 28]]) K.mountain(m, x, y);
    K.forest(m, { seed: 1911, thr: 0.6, kinds: ['pine', 'pine', 'dark', 'bamboo'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function wakouScene() {
    if (G.flag('c19_wakou')) return;
    await G.narrate('张飞与张郃在瓦口关相拒五十余日。张飞每日在山前扎住大寨，饮酒大醉，坐于山前辱骂——');
    await G.lines([
      ['liubei', '（大惊）吾弟饮酒失事，军师何故反令人送酒？'],
      ['zhugeliang', '（笑）主公与翼德做了许多年兄弟，还不知其为人耶？翼德自来刚强，然前于收川之时，义释严颜，此非勇夫所为也。今与张郃相拒五十余日，酒醉之后，便坐山前辱骂，旁若无人——此非贪杯，乃败张郃之计耳。'],
    ]);
    await G.narrate('张郃果然趁夜下山劫寨。直杀到帐前，一枪刺倒——却是个草人！');
    await G.lines([
      ['zhangfei', '（从山后转出，大笑）张郃！俺诈醉五十日，等的就是你今夜！'],
      ['zhanghe', '中计矣！'],
    ]);
    const r = await G.battle(['zhanghe3', 'caobing7', 'caoqi7'], { bg: 'shu', boss: true, intro: '瓦口关 · 张郃劫寨！' });
    if (r !== 'win') return;
    G.setFlag('c19_wakou');
    await G.narrate('张郃大败，弃了宕渠三寨，只引十余人步行，从小路逃回南郑。');
    await G.notice('瓦口关大捷！\n北上天荡山——那里是曹军囤粮之所。');
  }

  async function tiandangScene() {
    if (G.flag('c19_td')) return;
    if (!G.flag('c19_wakou')) { await G.narrate('天荡山上曹军营寨林立，此时还动不得。'); return; }
    await G.lines([
      ['huangzhong', '主公，天荡山乃曹军屯粮之所。老夫与严颜去烧了它！'],
      ['zhugeliang', '（故意）老将军虽然英勇，争奈年纪老了，恐非夏侯尚、韩浩之敌。'],
      ['huangzhong', '（白发倒竖）廉颇年八十，尚食斗米、肉十斤，诸侯畏其勇，不敢侵犯赵界——何况黄忠未及七十乎！'],
      ['zhugeliang', '……好，那便请老将军一试。'],
    ]);
    const r = await G.battle(['caobing7', 'caoshe7', 'caobing7', 'caoqi7'], { bg: 'shu', intro: '天荡山守军！' });
    if (r !== 'win') return;
    G.setFlag('c19_td');
    await G.narrate('黄忠、严颜放起火来，天荡山上烈焰冲天，曹军粮草尽数烧毁。夏侯尚、韩浩败走定军山，投夏侯渊去了。');
    await G.lines([
      ['huangzhong', '主公！定军山是南郑保障、粮草积聚之所。若得定军山，阳平一路，无足忧矣——老夫请往！'],
      ['zhugeliang', '既老将军要去，吾令法正同去。凡事计议而行。'],
    ]);
    await G.notice('火烧天荡山！\n西去定军山。');
  }

  /* ---------------- 定军山 ---------------- */
  B.c19dingjun = () => {
    const m = new G.GameMap('c19dingjun', '定 军 山', 44, 34, TL.GRASS);
    Object.assign(m, { seed: 1921, music: 'boss', ambient: 'leaves', leafColor: 'rgba(170,140,70,0.8)', pal: { gh: 70, gs: 30, gl: 26 }, battleBg: 'shu', flowers: 0.02 });
    K.tallGrass(m, 1923, 0.58);
    m.road([[0, 30.5], [12, 29], [16, 22], [12, 14], [10.5, 8]], 0.75, TL.PATH);        // 上对山
    m.road([[16, 22], [30, 24], [34, 16], [33.5, 8]], 0.75, TL.PATH);                  // 去定军山
    m.rect(8, 4, 6, 5, TL.SOIL);                                                      // 对山山顶
    m.rect(29, 4, 10, 6, TL.SOIL);                                                    // 夏侯渊营
    K.tent(m, 30, 2, { w: 3, h: 3 }); K.tent(m, 35, 2, { w: 3, h: 3 });
    K.deco(m, 'flag', 29, 8, { text: '夏', color: '#24304a', tcol: '#f6e7c1' }); K.deco(m, 'flag', 38, 8, { text: '夏', color: '#24304a', tcol: '#f6e7c1' });
    K.deco(m, 'flag', 9, 4, { text: '黄', color: '#8a5a1e', tcol: '#f6e7c1' });
    m.reserve(0, 29, 3, 3); m.reserve(7, 3, 8, 7); m.reserve(28, 1, 12, 10);
    for (const [x, y] of [[2, 2], [18, 2], [20, 10], [24, 4], [2, 16], [38, 16], [40, 26], [24, 30], [6, 22]]) K.mountain(m, x, y, 1);
    K.forest(m, { seed: 1925, thr: 0.6, kinds: ['pine', 'dark', 'pine'] });
    m.warp(0, 29, 1, 3, 'c19dingjun', 2, 30, 'right', () => false, '黄忠：不取定军山，誓不回营！');
    m.npc({ id: 'dj19inn', spec: 'innkeeper', x: 4, y: 28, dir: 'right', talk: campMenu('老将军，喝口热汤再上山。', '定军山军需') });
    m.npc({ id: 'fz19b', spec: 'fazheng', x: 11, y: 5, dir: 'down', marker: () => !G.flag('c19_flag'), talk: flagScene });
    m.npc({ id: 'xhy19', spec: 'xiahouyuan', x: 33, y: 9, dir: 'down', aggro: true, cond: () => G.flag('c19_flag') && !G.flag('c19_end'), marker: () => true, talk: duelScene });
    m.npc({ id: 'xhy19w', spec: 'xiahouyuan', x: 33, y: 7, dir: 'down', cond: () => !G.flag('c19_flag'), talk: K.talk([['xiahouyuan', '（对山上）黄忠老卒！有本事便下来厮杀！']]) });
    m.onEnter = async () => {
      if (G.flag('c19_dj')) return; G.setFlag('c19_dj');
      await G.lines([
        ['fazheng', '老将军，定军山之西，巍然有一座高山，四下皆是险道。此山上足可下视定军山之虚实——将军若取得此山，定军山只在掌中矣。'],
        ['huangzhong', '好！先上对山！'],
      ]);
      await G.notice('登上西边的对山，与法正会合。');
    };
    return m;
  };

  async function flagScene() {
    if (G.flag('c19_flag')) { await say('fazheng', '红旗已举——老将军，下山！'); return; }
    await G.lines([
      ['fazheng', '老将军，可守在半山。我在山顶看着：夏侯渊兵至，吾举白旗为号，将军只按兵勿动；待他倦怠无备，吾却举起红旗，将军便下山击之——以逸待劳，必当取胜。'],
    ]);
    await G.narrate('夏侯渊引兵围住对山，大骂搦战。');
    const asks = ['曹军刚到，气势正盛，鼓声震天。', '日已过午，曹军骂了一个时辰，有些人坐在地上了。', '曹军锐气堕尽，多半下马坐地歇息，有的已经卸甲。'];
    let early = false;
    for (let i = 0; i < asks.length; i++) {
      await G.narrate(asks[i]);
      const k = await G.choose(['举红旗——冲锋！', '举白旗——按兵不动'], { w: 360, x: G.W / 2 - 180 });
      if (k === 0) { early = i < 2; break; }
      if (i === asks.length - 1) { await G.narrate('法正心想：再不动手，夏侯渊就要收兵了！'); }
    }
    G.setFlag('c19_flag');
    if (early) {
      G.setFlag('c19_early');
      await G.narrate('红旗举得早了。曹军锐气未消，一拥而上，与黄忠军在山腰混战一场。');
      const r = await G.battle(['caobing7', 'caoqi7', 'caoshe7'], { bg: 'shu', intro: '曹军锐气正盛！' });
      if (r !== 'win') { G.state.flags.c19_flag = false; G.state.flags.c19_early = false; return; }
    } else {
      await G.narrate('法正把红旗一招。鼓角齐鸣，喊声大震，黄忠一马当先，驰下山来，犹如天崩地塌之势！');
    }
    G.setParty(['huangzhong']);
    await G.notice('黄忠单骑，直取夏侯渊！');
  }

  async function duelScene() {
    await G.lines([
      ['xiahouyuan', '老贼！'],
      ['huangzhong', '（拍马舞刀）夏侯渊，纳命来！'],
    ]);
    // 举旗时机正确：敌军疲惫，夏侯渊措手不及
    const r = await G.battle([G.flag('c19_early') ? 'xiahouyuan' : 'xiahouyuan_t'], { bg: 'shu', boss: true, party: ['huangzhong'], intro: G.flag('c19_early') ? '夏侯渊！' : '夏侯渊措手不及！' });
    if (r !== 'win') return;
    G.setFlag('c19_end');
    G.audio.sfx('crit'); G.shake(10, 0.6);
    await G.narrate('宝刀起处，夏侯渊连头带肩，砍为两段！');
    await G.narrate('后人有诗赞黄忠曰：苍头临大敌，皓首逞神威。力趁雕弓发，风迎雪刃挥。雄声如虎吼，骏马似龙飞。献馘功勋重，开疆展帝畿。');
    G.setParty(ARMY);
    G.restoreAll();
    await G.lines([
      ['liubei', '（亲自迎接）汉升真乃老当益壮！'],
      ['huangzhong', '主公，夏侯渊一死，曹军必倾巢而来。老夫这把骨头，还能再砍几颗脑袋！'],
      ['zhugeliang', '夏侯渊死了……曹操必亲自来报仇。汉中之战，这才开始。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[19].endLines);
  }

  G.CHAPTERS[19] = {
    title: '定军山',
    prologue: [
      '建安二十二年，刘备起兵争夺汉中。',
      '曹操留夏侯渊、张郃镇守，自回邺城。',
      '刘备以法正为谋主，亲率大军北上。',
      '诸葛亮坐镇后方，足食足兵。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.catchUp(ARMY);
      G.setParty(ARMY);
      G.restoreAll();
      const w = G.world;
      w.load('c19world', 30, 38, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhugeliang', '张郃屯兵宕渠，与翼德在瓦口关相持；夏侯渊屯定军山。先破张郃，后取定军。'],
        ['zhangfei', '军师！张郃那厮躲在山上不出来，俺……俺只好天天喝酒了！'],
      ]);
      await G.notice('东去瓦口关。\n营地可以休整、补给和记录进度。');
    },
    endLines: [
      '夏侯渊战死，曹操闻讯放声大哭，',
      '亲率四十万大军，自长安出斜谷，来争汉中。',
      '黄忠夜劫北山粮草，深陷重围；',
      '赵云单骑来救——',
    ],
  };
})();
