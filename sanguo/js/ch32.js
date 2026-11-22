/* ============================================================
 * 烽烟录 · 第三十二章　五丈原
 * 五丈原（孔明病重、七星灯禳星、魏兵夜袭、魏延踏灭主灯、秋风五丈原、死诸葛走生仲达）→ 南谷口（魏延反，马岱斩之）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SHOP = ['jiuzhuan', 'shenyao', 'qianjin', 'lingzhi', 'xuming', 'muniu', 'hanjia', 'zhuge', 'zhaolie'];
  const ARMY = ['zhugeliang', 'weiyan', 'jiangwei', 'wangping', 'madai', 'liaohua'];
  const AFTER = ['jiangwei', 'wangping', 'madai', 'liaohua'];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  B.c32wuzhang = () => {
    const m = new G.GameMap('c32wuzhang', '五 丈 原', 44, 40, TL.GRASS);
    Object.assign(m, { seed: 3201, music: 'title', ambient: 'leaves', leafColor: 'rgba(200,170,110,0.7)', pal: { gh: 60, gs: 18, gl: 24 }, battleBg: 'jiameng', flowers: 0, dusk: true });
    K.tallGrass(m, 3203, 0.6);
    m.road([[22.5, 40], [22.5, 22], [22.5, 12]], 0.9, TL.PATH);
    m.road([[22.5, 30], [8, 30], [3.5, 36]], 0.6, TL.PATH);                               // → 南谷口
    m.rect(15, 6, 15, 9, TL.FLOOR);                                                     // 中军帐前
    K.tent(m, 18, 1, { big: true, w: 8, h: 5, red: true, sign: '丞相' });
    m.prop('lamps', 18, 7, 9, 6, { nofoot: true, sortBias: -40000, outFlag: 'c32_out' });
    for (const [x, y] of [[14, 6], [31, 6], [14, 15], [31, 15]]) K.deco(m, 'flag', x, y, { text: '汉', color: '#2a3a5a', tcol: '#f6e7c1' });
    for (const [x, y] of [[16, 16], [29, 16], [10, 28], [34, 28], [20, 34], [26, 34]]) K.deco(m, 'fire', x, y, { light: 150 });
    K.tent(m, 6, 20, { red: true }); K.tent(m, 34, 20, { red: true });
    m.reserve(14, 0, 17, 17); m.reserve(2, 34, 4, 4); m.reserve(21, 36, 3, 4);
    for (const [x, y] of [[2, 2], [36, 2], [2, 10], [38, 34], [12, 36]]) K.mountain(m, x, y);
    K.forest(m, { seed: 3205, thr: 0.68, kinds: ['pine', 'dark'] });
    m.warp(21, 39, 3, 1, 'c32wuzhang', 22, 37, 'up', () => false, '丞相病重，诸将都守在营中。');
    m.npc({ id: 'wz32inn', spec: 'innkeeper', x: 25, y: 37, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '……丞相今日，又是一口饭也没吃。', '军需官'); else if (k === 1) await G.shop(SHOP, '五丈原军需');
    } });
    m.npc({ id: 'km32', spec: 'zhugeliang', x: 22, y: 10, dir: 'down', cond: () => !G.flag('c32_dead'), marker: () => !G.flag('c32_star') || G.flag('c32_raid'), talk: kongmingTalk });
    m.npc({ id: 'wy32', spec: 'weiyan', x: 4, y: 36, dir: 'up', aggro: true, cond: () => G.flag('c32_dead') && !G.flag('c32_end'), marker: () => true, talk: weiyanScene });
    return m;
  };

  async function kongmingTalk() {
    if (!G.flag('c32_star')) {
      await G.narrate('是夜，孔明扶病出帐，仰观天文，十分惊慌；入帐谓姜维曰——');
      await G.lines([
        ['zhugeliang', '吾命在旦夕矣！吾见三台星中，客星倍明，主星幽隐，相辅列曜，其光昏暗：天象如此，吾命可知！'],
        ['jiangwei', '天象虽则如此，丞相何不用祈禳之法挽回之？'],
        ['zhugeliang', '吾素谙祈禳之法，但未知天意若何。汝可引甲士四十九人，各执皂旗，穿皂衣，环绕帐外；我自于帐中祈禳北斗。若七日内主灯不灭，吾寿可增一纪；如灯灭，吾必死矣。闲杂人等，休教放入。'],
      ]);
      G.setFlag('c32_star');
      G.setParty(AFTER.concat(['weiyan']));
      await G.narrate('孔明于帐中设香花祭物，地上分布七盏大灯，外布四十九盏小灯，内安本命灯一盏。');
      await G.narrate('一连六夜，主灯明亮。孔明心中甚喜——');
      G.audio.sfx('gong');
      await G.lines([['messenger', '报——！魏兵趁夜劫营！', { name: '巡哨' }]]);
      const r = await G.battle(['weibing2', 'weiqi2', 'weinu2', 'weibing2'], { bg: 'jiameng', intro: '护住中军帐！' });
      if (r !== 'win') return;
      G.setFlag('c32_raid');
      await G.notice('魏兵已退。\n快回中军帐看看丞相！');
      return;
    }
    if (!G.flag('c32_raid')) return;
    await G.narrate('第七夜。孔明正在帐中披发仗剑，踏罡步斗，压镇将星——忽听得寨外呐喊。');
    await G.lines([['weiyan', '（飞步入帐）丞相！魏兵至矣！']]);
    G.audio.sfx('down'); G.shake(6, 0.5);
    G.setFlag('c32_out');
    await G.narrate('魏延脚步急，竟将主灯扑灭。');
    await G.lines([
      ['zhugeliang', '（弃剑而叹）死生有命，不可得而禳也！'],
      ['jiangwei', '（忿怒，拔剑欲杀魏延）'],
      ['zhugeliang', '此吾命当绝，非文长之过也。'],
    ]);
    await G.fadeOut(1.2);
    await G.narrate('孔明唤姜维至榻前——');
    await G.lines([
      ['zhugeliang', '吾本欲竭忠尽力，恢复中原，重兴汉室；奈天意如此，吾旦夕将死。吾平生所学，已著书二十四篇，计十万四千一百一十二字：内有八务、七戒、六恐、五惧之法。吾遍观诸将，无人可授，独汝可传我书。切勿轻忽！'],
      ['jiangwei', '（哭拜而受）……'],
      ['zhugeliang', '魏延此人，久后必反。待其反时，汝与临阵，方拆此锦囊。（取锦囊付马岱）'],
      ['zhugeliang', '吾死之后，不可发丧。可作一大龛，将吾尸坐于龛中；以米七粒，放吾口内；脚下用明灯一盏。军中安静如常，切勿举哀——则将星不坠，吾阴魂更自起镇之。司马懿见将星不坠，必然惊疑。'],
    ]);
    G.setFlag('c32_book');
    await G.narrate('是夜，孔明令左右扶上小车，出寨遍观各营。自觉秋风吹面，彻骨生寒——');
    await G.lines([['zhugeliang', '（长叹）再不能临阵讨贼矣！悠悠苍天，曷此其极！']]);
    G.audio.play('title');
    await G.narrate('建兴十二年秋八月二十三日，诸葛武侯，薨于五丈原军中。寿五十四岁。');
    await G.narrate('杜工部有诗叹曰：长星昨夜坠前营，讣报先生此日倾。虎帐不闻施号令，麟台惟显著勋名。空余门下三千客，辜负胸中十万兵。好看绿阴清昼里，于今无复雅歌声！');
    G.setFlag('c32_dead');
    G.setParty(AFTER.concat(['weiyan']));
    G.leaveParty('zhugeliang');
    await G.fadeIn(1.2);
    await G.notice('诸葛亮 薨于五丈原。\n（他的护甲放回了行囊）\n姜维习得「丞相遗策」。');
    await G.narrate('蜀军依计退兵。司马懿闻孔明已死，引兵来追——忽然山后一声炮响，蜀兵回旗返鼓，树影中飘出中军大旗，上书"汉丞相武乡侯诸葛亮"。');
    await G.narrate('数十员上将，拥出一辆四轮车来：车上端坐孔明，纶巾羽扇，鹤氅皂绦。');
    await G.lines([['simayi', '（大惊）孔明尚在！吾轻入重地，堕其计矣！——（急勒回马便走）']]);
    await G.narrate('司马懿奔走了五十余里，以手摸头曰："我有头否？"——后人方知，那车上所坐的，是孔明的木像。');
    await G.narrate('百姓为之谚曰："死诸葛能走生仲达。"司马懿闻之，叹曰："吾能料其生，不能料其死也！"');
    G.leaveParty('weiyan');
    G.setParty(AFTER);
    await G.notice('魏延不肯退兵，烧绝栈道，引兵屯于南谷口！\n去西南的南谷口。');
  }

  async function weiyanScene() {
    if (G.flag('c32_end')) return;
    await G.lines([
      ['weiyan', '丞相虽亡，吾今现在。吾乃大将，安肯为杨仪一长史所制乎？'],
      ['jiangwei', '魏延！丞相尸骨未寒，汝便要造反么！'],
      ['weiyan', '少啰嗦！谁敢挡我？'],
    ]);
    const r = await G.battle(['weiyan2', 'weibing2', 'weibing2'], { bg: 'shu', boss: true, intro: '反将 魏延！' });
    if (r !== 'win') return;
    G.setFlag('c32_end');
    await G.narrate('魏延军士尽散。杨仪拆开孔明锦囊，看罢——');
    await G.lines([
      ['jiangwei', '（遵锦囊所言，立马阵前）魏延！汝若敢在马上连叫三声"谁敢杀我"，便是真大丈夫，吾就献汉中城池与汝。'],
      ['weiyan', '（大笑）杨仪匹夫听着！若孔明在日，吾尚惧他三分；他今已亡，天下谁敢敌我？休道连叫三声，便叫三万声，亦有何难！'],
      ['weiyan', '谁敢杀我？——'],
    ]);
    G.audio.sfx('crit'); G.shake(8, 0.4);
    await G.lines([['madai', '（脑后厉声）吾敢杀汝！']]);
    await G.narrate('一声未毕，马岱手起刀落，斩魏延于马下。众皆骇然——原来孔明临终之时，早授马岱密计。');
    await G.chapterEnd(G.CHAPTERS[32].endLines);
  }

  G.CHAPTERS[32] = {
    title: '五丈原',
    prologue: [
      '孔明在五丈原，食少事烦，病势日重。',
      '这一夜，秋风萧瑟，渭水呜咽。',
      '姜维守在帐外，帐中灯火，彻夜未熄。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.setParty(ARMY);
      G.restoreAll();
      const w = G.world;
      w.load('c32wuzhang', 22, 34, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['jiangwei', '丞相……今夜气色更差了。'],
        ['wangping', '伯约，丞相叫你进帐。'],
      ]);
      await G.notice('去中军帐见丞相。');
    },
    endLines: [
      '孔明灵柩回到成都，后主亲出城二十里迎接，放声大哭。',
      '遵孔明遗命，葬于定军山，不用墙垣砖石，亦不用一切祭物。',
      '后主下诏，谥为"忠武侯"，于沔阳立庙，四时享祭。',
      '孔明临终前，把兵书传给了姜维。',
      '此后三十年，姜维九伐中原——',
      '他要替丞相，走完那条没走完的路。',
    ],
  };
})();
