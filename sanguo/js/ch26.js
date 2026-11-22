/* ============================================================
 * 烽烟录 · 第二十六章　七擒孟获（第六部完）
 * 秃龙洞（哑泉、孟节赠药、杨锋献孟获·五擒）→ 银坑洞（祝融夫人、木鹿大王、诈降·六擒）
 * → 盘蛇谷（藤甲兵、兀突骨、火烧藤甲·七擒孟获）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const NZ = { gh: 112, gs: 40, gl: 24 };
  const SHOP = ['tianxiang', 'huixin', 'xianlu', 'yuquan', 'xuming', 'qingzhou', 'nanzhong', 'longwen', 'wuxing'];
  const NAN = ['zhugeliang', 'zhaoyun', 'weiyan', 'guanxing', 'zhangbao2', 'machao'];
  const GROUPS = [{ e: ['manbing', 'manbing'], w: 3 }, { e: ['manbing', 'mangong'], w: 3 }, { e: ['manwu', 'manwu'], w: 1 }, { e: ['mangong', 'manwu', 'manbing'], w: 1 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };
  const campMenu = (line, title) => async () => {
    const k = await G.choose(['休整', '补给军资', '不用了']);
    if (k === 0) await restAndSave('innkeeper', line, '军需官'); else if (k === 1) await G.shop(SHOP, title);
  };

  /* ---------------- 秃龙洞 · 银坑洞 ---------------- */
  B.c26yinkeng = () => {
    const m = new G.GameMap('c26yinkeng', '银 坑 山', 56, 46, TL.GRASS);
    Object.assign(m, { seed: 2601, music: 'field', ambient: 'leaves', leafColor: 'rgba(120,180,80,0.8)', pal: NZ, battleBg: 'shu', flowers: 0.1, tint: 'rgba(60,90,40,0.1)' });
    K.tallGrass(m, 2603, 0.5);
    m.road([[28.5, 0], [28.5, 10], [22, 16], [28.5, 22], [28.5, 34], [28.5, 46]], 0.75, TL.PATH);
    m.road([[22, 16], [8, 14], [5.5, 10]], 0.6, TL.PATH);                                  // 万安溪
    for (const [x, y] of [[23, 6], [33, 10], [24, 12], [33, 16]]) m.rect(x, y, 3, 2, TL.WATER);   // 哑泉、灭泉、黑泉、柔泉
    m.rect(3, 4, 6, 4, TL.WATER);                                                          // 万安溪安乐泉
    m.prop('house', 9, 6, 5, 4, { roof: '#4a5a3a', lantern: false });
    m.rect(22, 24, 14, 8, TL.SOIL);                                                        // 秃龙洞
    K.tent(m, 23, 24, { w: 3, h: 3 }); K.tent(m, 32, 24, { w: 3, h: 3 });
    K.deco(m, 'flag', 22, 31, { text: '朵', color: '#6a3a1a', tcol: '#f6e7c1' });
    m.rect(20, 38, 18, 6, TL.SOIL);                                                        // 银坑洞
    K.tent(m, 21, 38, { big: true, w: 5, h: 4, sign: '孟' }); K.tent(m, 33, 39, { w: 3, h: 3 });
    for (const [x, y] of [[26, 43], [31, 43]]) K.deco(m, 'flag', x, y, { text: '孟', color: '#6a3a1a', tcol: '#f6e7c1' });
    m.reserve(26, 0, 5, 4); m.reserve(4, 9, 4, 3); m.reserve(27, 44, 3, 2);
    m.npc({ id: 'camp26', spec: 'innkeeper', x: 30, y: 2, dir: 'down', talk: campMenu('丞相，前面的泉水千万喝不得。', '南征军需') });
    for (const [x, y, name, txt] of [[24, 6, '哑泉', '其水颇甜，人若饮之，则不能言，不过旬日必死。'], [34, 10, '灭泉', '此泉之水，与汤无异，人若浴之，则皮肉皆烂，见骨必死。'], [25, 12, '黑泉', '其水微清，人若溅之在身，则手足皆黑而死。'], [34, 16, '柔泉', '其水如冰，人若饮之，咽喉无暖气，身躯软弱如绵而死。']]) {
      K.deco(m, 'sign', x - 1, y + 2, { text: name });
      m.event({ type: 'inspect', x: x - 1, y, w: 4, h: 2, run: () => G.narrate(`「${name}」：${txt}${G.flag('c26_cure') ? '\n（含着薤叶芸香，不怕瘴气，但这水还是别碰为好。）' : ''}`) });
    }
    m.npc({ id: 'mj26', spec: 'huangchengyan', x: 6, y: 11, dir: 'right', marker: () => !G.flag('c26_cure'), talk: mengjieScene });
    // 没拿到解药之前，瘴气挡住南下的路：踏入即被逼退
    m.event({ type: 'step', x: 26, y: 20, w: 6, h: 1, run: async () => {
      if (G.flag('c26_cure')) return;
      await G.narrate('瘴气弥漫，将士们头晕目眩，寸步难行。\n（西边的万安溪，据说住着一位隐者）');
      const w = G.world; w.party.forEach((u, i) => w.place(i, 28, 18, 'up')); G.state.x = 28; G.state.y = 18;
    } });
    m.npc({ id: 'ds26', spec: 'mulu', x: 28, y: 23, dir: 'up', aggro: true, cond: () => G.flag('c26_cure') && !G.flag('c26_m5'), marker: () => true, talk: meng5 });
    m.npc({ id: 'zr26', spec: 'zhurong', x: 28, y: 35, dir: 'up', aggro: true, cond: () => G.flag('c26_m5') && !G.flag('c26_zr'), marker: () => true, talk: zhurongScene });
    m.npc({ id: 'ml26', spec: 'mulu', x: 28, y: 37, dir: 'up', aggro: true, cond: () => G.flag('c26_zr') && !G.flag('c26_m6'), marker: () => true, talk: meng6 });
    m.npc({ id: 'camp26b', spec: 'innkeeper', x: 31, y: 33, dir: 'left', cond: () => G.flag('c26_m5'), talk: campMenu('丞相，银坑洞就在前面了。', '南征军需') });
    m.warp(27, 45, 3, 1, 'c26panshe', 17, 33, 'up', () => G.flag('c26_m6'), '孟获还在银坑洞中。');
    for (const [x, y] of [[4, 20], [12, 26], [42, 4], [48, 12], [6, 36], [44, 24], [46, 36], [14, 40]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2611, thr: 0.58, kinds: ['bamboo', 'tree', 'bamboo', 'bush', 'dark'] });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.08, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function mengjieScene() {
    if (G.flag('c26_cure')) { await say('huangchengyan', '安乐泉的水，丞相的将士们尽管取用。', { name: '孟节' }); return; }
    await G.narrate('万安溪边，有一座草庵。庵前修竹茂盛，一位老者扶杖而出——');
    await G.lines([
      ['huangchengyan', '老夫孟节，乃孟获之兄也。父母生我兄弟三人：长即老夫，次孟获，又次孟优。二弟强恶，不归王化，老夫屡谏不从，故更名改姓，隐居于此。', { name: '孟节' }],
      ['zhugeliang', '（叹曰）方信盗跖、下惠之事，今亦有之。'],
      ['huangchengyan', '庵前有一泉，名"安乐泉"，饮之即解毒。又有一草，名"薤叶芸香"，人口含一叶，则瘴气不染。丞相速取去用。', { name: '孟节' }],
    ]);
    G.setFlag('c26_cure');
    G.restoreAll(); G.audio.sfx('heal');
    await G.notice('得到薤叶芸香！\n瘴气不再侵扰，可以南下秃龙洞了。');
  }

  async function meng5() {
    if (G.flag('c26_m5')) return;
    await G.lines([
      ['mulu', '（朵思大王大惊）诸葛亮怎么过得了毒泉？……莫非是神兵？', { name: '朵思大王' }],
      ['menghuo', '怕什么！吾兄弟二人，与汝拼了！'],
    ]);
    const r = await G.battle(['manbing', 'manwu', 'mangong', 'manbing'], { bg: 'shu', intro: '秃龙洞 · 朵思大王的蛮兵！' });
    if (r !== 'win') return;
    await G.narrate('当夜，银冶洞二十一洞主杨锋，引三万兵来"助战"。酒至半酣，杨锋之子起舞，忽然齐上，把孟获、朵思一并擒住——');
    await G.lines([['manbing', '吾兄弟子侄，皆感诸葛丞相活命之恩，无可以报——今孟获反叛，就此绑献丞相！', { name: '杨锋' }]]);
    G.setFlag('c26_m5');
    await G.captureMeng(5, '此非汝之能，乃吾洞中之人自相残害，以致如此。要杀便杀，只是不服！');
    await G.notice('孟获回到了老家银坑洞。\n南下银坑洞。');
  }

  async function zhurongScene() {
    if (G.flag('c26_zr')) return;
    await G.lines([
      ['zhurong', '我乃祝融氏之后，善使飞刀，百发百中！汝这男子汉，都不中用——待我替丈夫出阵！'],
      ['zhangbao2', '一个婆娘也敢来？'],
      ['zhurong', '（背插五口飞刀，手挺丈八长标）看刀！'],
    ]);
    const r = await G.battle(['zhurong', 'manbing', 'manbing'], { bg: 'shu', boss: true, intro: '祝融夫人！' });
    if (r !== 'win') return;
    G.setFlag('c26_zr');
    await G.narrate('孔明用祝融夫人换回被她擒去的张嶷、马忠。孟获又请来八纳洞主木鹿大王——此人能驱虎豹豺狼、毒蛇恶蝎。');
    await G.notice('木鹿大王驱兽而来！');
  }

  async function meng6() {
    if (G.flag('c26_m6')) return;
    await G.lines([
      ['mulu', '（骑白象，手摇蒂钟，口中念咒）呜——！'],
      ['zhugeliang', '吾已备下木兽：口内吐火，鼻中出烟，身上摇动铜铃，张牙舞爪——便请大王的猛兽见识见识。'],
    ]);
    const r = await G.battle(['mulu', 'manbing', 'manwu'], { bg: 'shu', boss: true, intro: '八纳洞主 木鹿大王！' });
    if (r !== 'win') return;
    await G.narrate('木鹿大王死于乱军之中。孟获无计可施，假意出洞投降，暗令带来洞主等人身藏利刃——');
    await G.lines([['zhugeliang', '（喝令左右）与我擒下！——你们身上的刀，吾早看见了。']]);
    G.setFlag('c26_m6');
    await G.captureMeng(6, '此番乃我等自来送死，非汝之能也。吾心未服！若擒得我七次，方才倾心归服，誓不再反。');
    await G.lines([['zhugeliang', '巢穴已破，吾何虑哉！']]);
    await G.notice('孟获逃往乌戈国，请来了国主兀突骨和三万藤甲兵。\n南下盘蛇谷。');
  }

  /* ---------------- 盘蛇谷 ---------------- */
  B.c26panshe = () => {
    const m = new G.GameMap('c26panshe', '盘 蛇 谷', 36, 36, TL.GRASS);
    Object.assign(m, { seed: 2621, music: 'boss', ambient: 'leaves', leafColor: 'rgba(110,140,60,0.8)', pal: { gh: 80, gs: 28, gl: 22 }, battleBg: 'gorge', flowers: 0 });
    m.road([[17.5, 36], [17.5, 28], [14, 22], [20, 14], [17.5, 4]], 0.85, TL.PATH);
    m.rect(12, 10, 12, 8, TL.SOIL);                                                       // 谷中
    for (const [x, y] of [[12, 11], [22, 11], [12, 16], [22, 16]]) K.deco(m, 'cart', x, y);
    for (const [x, y] of [[13, 13], [21, 13]]) K.deco(m, 'crates', x, y);
    for (const [x, y] of [[1, 28], [27, 28], [1, 18], [28, 18], [1, 6], [27, 6]]) K.mountain(m, x, y, 1);
    m.reserve(16, 30, 3, 6); m.reserve(13, 2, 9, 4);
    K.forest(m, { seed: 2625, thr: 0.5, kinds: ['dark', 'pine', 'dark', 'bamboo'], avoid: 1 });
    m.warp(16, 35, 3, 1, 'c26panshe', 17, 33, 'up', () => false, '魏延：丞相吩咐，诱敌入谷——只许败，不许胜！');
    m.npc({ id: 'ps26inn', spec: 'innkeeper', x: 19, y: 32, dir: 'left', talk: campMenu('丞相，车里都装着什么？……火药？', '南征军需') });
    K.guard(m, { id: 'tj26', spec: 'tengjia', x: 15, y: 24, dir: 'down', flag: 'c26_tj', group: ['tengjia', 'tengjia', 'tengjia'], intro: '乌戈国藤甲兵！', bg: 'gorge',
      lines: [['tengjia', '吾等藤甲，以油浸之，晒干又浸，凡十余遍——渡江不沉，经水不湿，刀箭皆不能入！', { name: '藤甲兵' }]],
      after: async () => { await G.notice('藤甲兵刀枪难伤，火攻速破！\n刀枪只能伤其两成，火攻伤害加倍。前面还有更多藤甲兵，策略不够就回谷口找军需官。'); } });
    m.npc({ id: 'wtg26', spec: 'wutugu', x: 17, y: 12, dir: 'down', aggro: true, cond: () => G.flag('c26_tj') && !G.flag('c26_wtg'), marker: () => true, talk: wutuguScene });
    m.npc({ id: 'mh26', spec: 'menghuo', x: 17, y: 5, dir: 'down', aggro: true, cond: () => G.flag('c26_wtg') && !G.flag('c26_end'), marker: () => true, talk: finalScene });
    m.onEnter = async () => {
      if (G.flag('c26_ps')) return; G.setFlag('c26_ps');
      await G.narrate('孔明令魏延连败十五阵，连弃七个营寨，把兀突骨的藤甲兵一步步引入盘蛇谷。');
      await G.lines([
        ['zhugeliang', '（看谷中地势，叹曰）……此谷两山皆是光峭石壁，并无树木，下面都是大路——此乃天赐吾成功于此也。'],
        ['zhugeliang', '吾不得已而为之——大损阴德矣。'],
      ]);
      // 入谷就说清楚：火攻要多少策略、哪里能补
      const sk = G.SKILLS, sp = G.state.sp, mx = G.maxSP();
      await G.notice(`谷中的藤甲兵刀枪难伤，火攻速破。\n火计 ${sk.huoji.cost}、烈火 ${sk.liehuo.cost}、借东风 ${sk.dongfeng.cost} 策略值；现有策略 ${sp} / ${mx}。\n谷口的军需官可以休整、补给——策略不够就先在这里补足。`);
    };
    return m;
  };

  async function wutuguScene() {
    if (G.flag('c26_wtg')) return;
    await G.lines([
      ['wutugu', '（身长丈二，不食五谷，以生蛇恶兽为饭）蜀兵一败再败，追！一个不留！'],
    ]);
    const r = await G.battle(['wutugu', 'tengjia', 'tengjia'], { bg: 'gorge', boss: true, intro: '乌戈国主 兀突骨！' });
    if (r !== 'win') return;
    G.setFlag('c26_wtg');
    await G.narrate('兀突骨引兵追入谷中，只见数十辆黑油柜车，塞住了谷口——');
    G.audio.sfx('fire'); G.shake(10, 1.2);
    await G.narrate('山上乱丢火把，火把到处，地中药线皆着，就地飞起铁炮——满谷中火光乱舞，但逢藤甲，无有不着。');
    await G.narrate('将兀突骨并三万藤甲军，烧得互相拥抱，死于盘蛇谷中。');
    await G.lines([['zhugeliang', '（垂泪而叹）吾虽有功于社稷，必损寿矣！']]);
    await G.notice('盘蛇谷北口，孟获还在等兀突骨的捷报。');
  }

  async function finalScene() {
    if (G.flag('c26_end')) return;
    await G.lines([
      ['menghuo', '兀突骨……三万藤甲兵，竟都烧死了？！'],
      ['menghuo', '诸葛亮！我孟获今日与你同归于尽！'],
    ]);
    const r = await G.battle(['menghuo3', 'manbing', 'mangong', 'manwu'], { bg: 'gorge', boss: true, intro: '南蛮王 孟获 · 最后一战！' });
    if (r !== 'win') return;
    G.setFlag('c26_end');
    await G.captureMeng(7, '……');
    await G.narrate('孔明令人去其缚，赐酒压惊，又放他回去——孟获却垂泪不走。');
    await G.lines([
      ['menghuo', '七纵七擒，自古未尝有也。吾虽化外之人，颇知礼义，直如此无羞耻乎？'],
    ]);
    await G.narrate('孟获同兄弟妻子宗党人等，皆匍匐跪于帐下，肉袒谢罪——');
    await G.lines([
      ['menghuo', '丞相天威，南人不复反矣！'],
      ['zhugeliang', '公今服乎？'],
      ['menghuo', '某子子孙孙，皆感覆载生成之恩，安得不服！'],
    ]);
    G.audio.sfx('levelup');
    await G.narrate('孔明请孟获上帐，设宴庆贺，就令永为洞主。所夺之地，尽皆退还。孟获宗党及诸蛮兵，无不感戴，皆欣然跳跃而去。');
    await G.narrate('孔明班师。行至泸水，阴云布合，狂风骤起，不能渡——原来是战死的冤魂作祟。孔明以面为人头，名曰"馒头"，亲自临水设祭，祭文读罢，大放悲声，云收雾散，三军方渡。');
    G.addItem('wuxing');
    await G.notice('南中平定！\n获得 五行连环铠（诸葛丞相亲自督造）');
    await G.chapterEnd(G.CHAPTERS[26].endLines);
  }

  G.CHAPTERS[26] = {
    title: '七擒孟获',
    prologue: [
      '孟获四次被擒，四次被放。',
      '这一次，他逃到了秃龙洞。',
      '洞主朵思大王说：洞前四眼毒泉，鸟雀也飞不过去。',
      '"诸葛亮便有通天之能，也到不了这里。"',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.setParty(NAN);
      G.restoreAll();
      const w = G.world;
      w.load('c26yinkeng', 28, 3, 'down');
      await G.fadeIn(1.2);
      await G.lines([
        ['weiyan', '丞相，前面的泉水，军士喝了就说不出话来！'],
        ['zhugeliang', '……此必是毒泉。且慢进兵，打听四周可有高人。'],
      ]);
      await G.notice('瘴气挡住了南下的路。\n去西边的万安溪看看。');
    },
    endLines: [
      '孔明平定南中，班师回到成都。',
      '后主刘禅亲出城三十里迎接。',
      '从此，蜀汉再无后顾之忧。',
      '建兴五年春，孔明上表后主——',
      '"臣本布衣，躬耕于南阳，苟全性命于乱世，不求闻达于诸侯……"',
      '这就是《出师表》。北伐中原的大军，即将出发。',
      '（第六部　完）',
    ],
  };
})();
