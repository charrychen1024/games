/* ============================================================
 * 烽烟录 · 第二十七章　出师（第七部开篇）
 * 祁山道（出师表、夏侯楙、凤鸣山·赵云单挑韩德父子、天水·收姜维）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const QS = { gh: 92, gs: 26, gl: 26 };
  const SHOP = ['huixin', 'jiuzhuan', 'yuquan', 'qianjin', 'xuming', 'nanzhong', 'muniu', 'wuxing', 'zhuge'];
  const ARMY = ['zhugeliang', 'zhaoyun', 'weiyan', 'guanxing', 'zhangbao2'];
  const GROUPS = [{ e: ['weibing', 'weibing'], w: 3 }, { e: ['weibing', 'weinu'], w: 3 }, { e: ['weiqi', 'weiqi'], w: 2 }, { e: ['weinu', 'weinu', 'weibing'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };
  const campMenu = (line, title) => async () => {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) await restAndSave('innkeeper', line, '军需官'); else if (k === 1) await G.shop(SHOP, title);
  };

  /* ---------------- 祁山道 ---------------- */
  B.c27qishan = () => {
    const m = new G.GameMap('c27qishan', '祁 山', 60, 46, TL.GRASS);
    Object.assign(m, { seed: 2701, music: 'field', ambient: 'clouds', pal: QS, battleBg: 'shu', flowers: 0.03 });
    K.tallGrass(m, 2703, 0.55);
    m.road([[0, 26], [16, 24], [30, 27], [44, 25], [60, 27]], 1.2, TL.WATER);            // 渭水支流
    m.road([[30.5, 44], [30.5, 30], [30, 20], [44, 14], [52.5, 10]], 0.75, TL.PATH);     // 汉中 → 凤鸣山
    m.road([[30, 20], [22, 12], [12.5, 6]], 0.75, TL.PATH);                             // → 天水
    m.road([[30.5, 34], [44, 36], [50, 36]], 0.6, TL.PATH);                             // → 南安
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.WATER && Math.abs(x - 30.3) < 1.6) m.set(x, y, TL.BRIDGE);
    m.prop('townicon', 10, 2, 5, 4, { label: '天水', foot: [10, 2, 5, 4] });
    m.prop('townicon', 50, 33, 4, 3, { label: '南安', foot: [50, 33, 4, 3] });
    m.reserve(26, 38, 8, 7); m.reserve(51, 9, 3, 3); m.reserve(11, 6, 3, 2); m.reserve(48, 35, 2, 3);
    K.tent(m, 26, 39, { big: true, w: 5, h: 4, red: true, sign: '汉' }); K.tent(m, 33, 40, { red: true });
    K.deco(m, 'flag', 29, 43, { text: '诸', color: '#2a3a5a', tcol: '#f6e7c1' });
    m.npc({ id: 'camp27', spec: 'innkeeper', x: 33, y: 43, dir: 'left', talk: campMenu('丞相，军粮由木牛运来，尽可放心。', '北伐军需') });
    K.guard(m, { id: 'xhm27', spec: 'xiahoumao', x: 48, y: 36, dir: 'left', flag: 'c27_na', group: ['weibing', 'weiqi', 'weinu'], intro: '驸马都尉 夏侯楙的兵马！', bg: 'shu',
      lines: [['xiahoumao', '吾乃魏国驸马夏侯楙！诸葛亮，今日便叫你知道我夏侯家的厉害！']],
      after: async () => { await G.narrate('夏侯楙不习兵事，一战即溃，逃入南安城中。孔明用计，连取南安、安定。'); } });
    m.npc({ id: 'hd27', spec: 'hande', x: 52, y: 12, dir: 'down', aggro: true, cond: () => !G.flag('c27_hd'), marker: () => true, talk: handeScene });
    m.npc({ id: 'jw27', spec: 'jiangwei', x: 12, y: 8, dir: 'down', aggro: true, cond: () => G.flag('c27_na') && G.flag('c27_hd') && !G.flag('c27_jw'), marker: () => true, talk: jiangweiScene });
    m.event({ type: 'step', x: 11, y: 6, w: 3, h: 2, run: async () => { if (!(G.flag('c27_na') && G.flag('c27_hd'))) await G.narrate('天水城紧闭城门。（先取南安、破凤鸣山之敌）'); } });
    K.deco(m, 'sign', 29, 32, { text: '祁山' });
    m.event({ type: 'inspect', x: 29, y: 32, w: 1, h: 1, run: () => G.narrate('路牌：东北 · 凤鸣山　西北 · 天水　东 · 南安') });
    for (const [x, y] of [[4, 4], [20, 4], [40, 4], [4, 34], [14, 40], [44, 42], [54, 20], [18, 16], [40, 18]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2711, thr: 0.6, kinds: ['pine', 'pine', 'dark', 'tree'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function handeScene() {
    if (G.flag('c27_hd')) return;
    await G.lines([
      ['hande', '吾乃西凉大将韩德！这四个，是吾的儿子韩瑛、韩瑶、韩琼、韩琪——赵云老匹夫，今日叫你知道我父子的厉害！'],
      ['zhaoyun', '（须发皆白，横枪立马）……老夫今年七十，当年长坂坡七进七出，可曾怕过谁来！'],
    ]);
    G.setParty(['zhaoyun']);
    const r = await G.battle(['hande'], { bg: 'shu', boss: true, party: ['zhaoyun'], intro: '凤鸣山 · 韩德父子五人！' });
    G.setParty(ARMY.concat(G.state.party.includes('jiangwei') ? ['jiangwei'] : []));
    if (r !== 'win') return;
    G.setFlag('c27_hd');
    await G.narrate('赵云一枪刺韩瑛于马下，韩瑶、韩琼、韩琪三面夹攻，赵云于中央独战三将——韩琪落马，韩琼中箭，韩瑶被生擒；韩德见四子皆亡，肝胆皆裂，被赵云一枪刺死。');
    await G.lines([
      ['zhugeliang', '（喜曰）子龙年已七旬，英勇如昔！'],
      ['zhaoyun', '……老了，老了。若是当年，这五个人，一个回合也不用。'],
    ]);
    await G.notice('凤鸣山大捷！');
  }

  async function jiangweiScene() {
    if (G.flag('c27_jw')) return;
    await G.lines([
      ['zhaoyun', '（大惊）此人枪法，竟不在老夫之下！'],
      ['jiangwei', '天水姜伯约在此！诸葛亮，你中了我的计了！'],
      ['zhugeliang', '（叹曰）……谁知这天水郡中，竟有此等人物。'],
    ]);
    const r = await G.battle(['jiangwei', 'weibing', 'weiqi'], { bg: 'shu', boss: true, intro: '天水 · 麒麟儿 姜维！' });
    if (r !== 'win') return;
    G.setFlag('c27_jw');
    await G.narrate('孔明用计，令魏人疑姜维已降蜀，天水、上邽两城都不肯开门。姜维进退无路，只得望长安而走——');
    await G.narrate('行不数里，前面一辆小车，孔明纶巾羽扇，端坐车上。');
    await G.lines([
      ['zhugeliang', '伯约此时何尚不降？'],
      ['jiangwei', '（寻思良久，前有孔明，后有张苞，又无去路，只得下马投降）……'],
      ['zhugeliang', '（慌忙下车而迎，执姜维手曰）吾自出茅庐以来，遍求贤者，欲传授平生之学，恨未得其人。今遇伯约，吾愿足矣！'],
      ['jiangwei', '（大喜拜谢）维愿以死报丞相知遇之恩！'],
    ]);
    G.joinParty('jiangwei'); G.world.refreshParty(); G.restoreAll();
    G.audio.sfx('levelup');
    await G.notice('姜维 加入！');
    await G.chapterEnd(G.CHAPTERS[27].endLines);
  }

  G.CHAPTERS[27] = {
    title: '出师',
    prologue: [
      '建兴五年，孔明上《出师表》：',
      '"先帝创业未半，而中道崩殂。今天下三分，益州疲弊，此诚危急存亡之秋也……"',
      '"臣受命以来，夙夜忧叹，恐托付不效，以伤先帝之明。"',
      '"今当远离，临表涕零，不知所言。"',
      '大军出汉中，兵向祁山。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.leaveParty('machao');
      G.catchUp(ARMY);
      G.setParty(ARMY);
      G.restoreAll();
      const w = G.world;
      w.load('c27qishan', 30, 37, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhugeliang', '马孟起病故于汉中，临终上表，以其弟马岱相托……五虎上将，只剩子龙一人了。'],
        ['zhaoyun', '（出班大叫）丞相！吾虽年迈，尚有廉颇之勇、马援之雄。愿为先锋！'],
        ['zhugeliang', '……子龙既坚意要去，便与邓芝同为先锋。'],
      ]);
      await G.notice('马超 病故。\n第七部：北伐中原。\n东南去南安，东北去凤鸣山。');
    },
    endLines: [
      '孔明得姜维，连取天水、南安、安定三郡，关中震动。',
      '魏主曹叡大惊，启用被罢官的司马懿。',
      '司马懿星夜赶路，八日之内，奔袭千二百里，擒斩了谋反的孟达。',
      '孔明闻之，跌足长叹："司马懿出，吾大事去矣！"',
      '司马懿与张郃，引二十万大军，直扑蜀军咽喉要地——街亭。',
    ],
  };
})();
