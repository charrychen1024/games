/* ============================================================
 * 烽烟录 · 第十一章　东风（第三部开篇，诸葛亮在江东）
 * 柴桑（舌战群儒、智激孙权）→ 三江口（智激周瑜、草船借箭、苦肉计）→ 南屏山（七星坛借东风）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const JN = { gh: 100, gs: 34, gl: 30 };   // 江南：偏青的绿
  const WUFLAG = { color: '#a8322a', tcol: '#f6e7c1' };
  const SOLO = ['zhugeliang'];
  const WU_SHOP = ['dahuan', 'shenghui', 'qiongjiang', 'tianzhong', 'xuming', 'jingliang', 'quanjun', 'longlin', 'jinsuo'];

  // 江上战船：甲板（FLOOR，可行走）+ 桅帆
  K.ship = (m, x, y, w, h, o = {}) => {
    m.rect(x, y, w, h, TL.FLOOR);
    m.prop('deck', x, y, w, h, { nofoot: true, sortBias: -100000, dir: o.dir || 'right', hull: o.hull, burnt: o.burnt, cond: o.cond });
    const mx = x + Math.floor(w / 2), my = y + Math.floor(h / 2) - 1;
    m.prop('mast', mx, my, 1, 1, { foot: [mx, my, 1, 1], sail: o.sail, text: o.text, tcol: o.tcol, burning: o.burning, mh: o.mh, cond: o.cond });
  };

  /* ---------------- 柴桑 ---------------- */
  B.c11chaisang = () => {
    const m = new G.GameMap('c11chaisang', '柴 桑', 40, 32, TL.GRASS);
    Object.assign(m, { seed: 1101, music: 'town', pal: JN, ambient: 'petals', flowers: 0.06 });
    K.walls(m, 0, 0, 39, 31, [{ side: 's', x: 19, plaque: '柴桑' }, { side: 'n', x: 32, plaque: '江口' }]);
    m.road([[20, 31], [20, 9]], 1, TL.PATH);
    m.road([[2, 21.5], [37, 21.5]], 0.6, TL.PATH);
    m.road([[33, 2], [33, 21]], 0.6, TL.PATH);
    m.rect(14, 10, 13, 8, TL.FLOOR);
    m.road([[6, 9], [6, 21]], 0.6, TL.PATH); m.road([[7, 23], [7, 26]], 0.6, TL.PATH);
    m.prop('hall', 15, 3, 11, 6, { sign: '吴侯府', roof: '#5a2a24' });
    m.prop('house', 3, 4, 7, 5, { sign: '客栈', roof: '#4a3b36' });
    m.prop('house', 3, 23, 7, 5, { sign: '商号', roof: '#5a3a30' });
    m.prop('house', 26, 23, 7, 5, { roof: '#45403a', lantern: false });
    m.prop('pavilion', 26, 13, 4, 4, { plaque: '观 江 亭' });
    m.rect(9, 12, 3, 6, TL.WATER);
    K.deco(m, 'well', 30, 9); K.deco(m, 'board', 12, 20);
    for (const [x, y] of [[13, 9], [27, 9], [18, 19], [23, 19]]) K.deco(m, 'flag', x, y, Object.assign({ text: '孙' }, WUFLAG));
    m.warp(19, 31, 3, 1, 'c11chaisang', 20, 29, 'up', () => false, '曹操大军压境，此行关系天下，还是先办正事吧。');
    m.warp(32, 0, 3, 1, 'c11sanjiang', 4, 31, 'up', () => G.flag('c11_quan'), '鲁肃：先生，主公尚未决断，还请先去见过主公。');
    m.reserve(19, 28, 3, 3); m.reserve(32, 0, 3, 4);
    K.innerTrees(m, 1, 2, 38, 29, 1107, 0.5);
    m.npc({ id: 'inn11', spec: 'innkeeper', x: 6, y: 9, dir: 'down', talk: K.innTalk('innkeeper', 150) });
    m.npc({ id: 'shop11', spec: 'merchant', x: 7, y: 27, dir: 'down', talk: K.shopTalk('merchant', WU_SHOP, '江东商号', '江东富庶，客官尽管挑！') });
    m.npc({ id: 'ls11', spec: 'lusu', x: 21, y: 25, dir: 'down', marker: () => !G.flag('c11_ls'), talk: async () => {
      if (!G.flag('c11_ls')) {
        await G.lines([
          ['lusu', '先生见我主，切不可实言曹操兵多将广。'],
          ['zhugeliang', '不须子敬叮咛，亮自有对答之语。'],
          ['lusu', '府前那些人，都是江东的名士谋臣，主张降曹的居多。先生……小心了。'],
        ]);
        G.setFlag('c11_ls');
        await G.notice('前往吴侯府。\n府前聚着江东群儒——与张昭交谈，开始「舌战群儒」。');
        return;
      }
      await say('lusu', G.flag('c11_quan') ? '都督周公瑾在三江口水寨。出北门「江口」便是。' : '主公就在府中，先生请。');
    } });
    // 群儒
    const RU = [['zhangzhao', 20, 12, 'down'], ['wuru', 17, 12, 'down'], ['wuru', 23, 12, 'down'], ['wuru', 16, 14, 'right'], ['wuru', 24, 14, 'left']];
    RU.forEach(([s, x, y, d], i) => m.npc({ id: 'ru' + i, spec: s, x, y, dir: d, cond: () => !G.flag('c11_debate'), marker: i === 0 ? () => G.flag('c11_ls') : undefined,
      talk: async () => {
        if (i !== 0) { await say(s, G.pick(['孔明来了，且看他如何应对子布先生。', '卧龙？哼，怕是条卧虫罢。', '刘豫州新败，这时来江东，必是求救来的。']), { name: '江东名士' }); return; }
        if (!G.flag('c11_ls')) { await say('zhangzhao', '……'); return; }
        await debateScene();
      } }));
    m.npc({ id: 'hg11', spec: 'huanggai', x: 22, y: 13, dir: 'down', cond: () => G.flag('c11_debate') && !G.flag('c11_quan'), talk: K.talk([['huanggai', '主公在里面等着先生呢，快请进去吧！']]) });
    m.npc({ id: 'sq11', spec: 'sunquan', x: 20, y: 10, dir: 'down', cond: () => G.flag('c11_debate'), marker: () => !G.flag('c11_quan'), talk: async () => {
      if (G.flag('c11_quan')) { await say('sunquan', '破曹之事，全凭公瑾与先生了。'); return; }
      await quanScene();
    } });
    m.npc({ id: 'cs1', spec: 'woman', x: 12, y: 24, wander: 2, talk: K.talk([['woman', '听说曹操写信来，说要与主公"会猎于吴"……这不是要打过来吗？']]) });
    m.npc({ id: 'cs2', spec: 'oldman', x: 28, y: 20, wander: 2, talk: K.talk([['oldman', '先主孙伯符临终时说："内事不决问张昭，外事不决问周瑜。"']]) });
    m.npc({ id: 'cs3', spec: 'wubing', x: 30, y: 4, dir: 'down', talk: K.talk([['wubing', '北门出去，沿江便是三江口水寨。']]) });
    m.npc({ id: 'cs4', spec: 'child', x: 34, y: 26, wander: 2, talk: K.talk([['child', '周郎可好看了！他弹琴弹错一个音，都会回头看。']]) });
    return m;
  };

  async function debateScene() {
    await G.narrate('孔明整衣而入。张昭等二十余人，峨冠博带，整衣端坐。');
    await G.titleCard('舌战群儒', '选出最有力的应答');
    const wrong = await G.debate();
    await G.narrate('众人见孔明对答如流，尽皆失色。');
    G.setFlag('c11_debate');
    if (wrong === 0) {
      G.addItem('tianzhong'); G.addItem('tianzhong'); G.addItem('shenghui');
      await G.notice('对答无一差错，满座皆服！\n鲁肃赠送 天中酒×2、圣惠散×1。');
    }
    await G.lines([
      ['huanggai', '孔明乃当世奇才，君等以唇舌相难，非敬客之礼也。曹操大军临境，不思退敌之策，乃徒斗口耶！'],
      ['huanggai', '先生，请随我去见主公。'],
    ]);
  }

  async function quanScene() {
    await G.lines([
      ['sunquan', '久闻先生大名。曹操兵马，共有多少？'],
      ['zhugeliang', '马步水军，约有一百余万。'],
      ['sunquan', '……莫非是诈？'],
      ['zhugeliang', '非诈也。曹操就兖州已有青州军二十万，平了袁绍又得五六十万，中原新招三四十万，今又得荆州之军二三十万——以此计之，不下一百五十万。亮以百万言之，恐惊江东之士也。'],
      ['sunquan', '……依先生之见，战与不战？'],
      ['zhugeliang', '将军量力而处之。若能以吴越之众与中国抗衡，不如早与之绝；若其不能，何不按兵束甲，北面而事之？'],
      ['sunquan', '诚如君言，刘豫州何不降曹？'],
      ['zhugeliang', '田横，齐之壮士耳，犹守义不辱。况刘豫州王室之胄，英才盖世，众士仰慕。事之不济，此乃天也，又安能屈处人下乎！'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('孙权勃然变色，拂衣而起，退入后堂。少顷复出——');
    await G.lines([
      ['sunquan', '孤不能以全吴之地，受制于人！'],
      ['sunquan', '……先生既有破曹之策，孤当与刘豫州同心协力。只是此事，还须与公瑾商议。'],
    ]);
    G.setFlag('c11_quan');
    await G.notice('出北门「江口」，前往三江口水寨，拜会都督周瑜。');
  }

  /* ---------------- 三江口水寨 ---------------- */
  B.c11sanjiang = () => {
    const m = new G.GameMap('c11sanjiang', '三江口 · 东吴水寨', 46, 34, TL.GRASS);
    Object.assign(m, { seed: 1121, music: 'camp', pal: JN, ambient: 'clouds', flowers: 0.03, battleBg: 'river' });
    m.rect(28, 0, 18, 34, TL.WATER);
    for (let y = 0; y < 34; y++) { const e = 27 + Math.round(G.noise(y / 4, 2, 1121) * 2); for (let x = e; x < 28; x++) m.set(x, y, TL.WATER); }
    m.road([[3, 34], [4, 26], [12, 20], [26, 20.5]], 0.8, TL.PATH);
    m.road([[12, 20], [12, 10], [13, -1]], 0.7, TL.PATH);
    for (let x = 24; x < 32; x++) if (m.get(x, 20) === TL.WATER) m.set(x, 20, TL.BRIDGE);
    K.ship(m, 32, 17, 9, 7, { text: '吴', tcol: '#a8322a' });
    K.ship(m, 32, 5, 9, 7, { text: '周', tcol: '#a8322a' });
    K.ship(m, 32, 28, 9, 5, { sail: '#c8b890' });
    for (let y = 12; y < 17; y++) m.set(36, y, TL.BRIDGE);
    for (let y = 24; y < 28; y++) m.set(36, y, TL.BRIDGE);
    m.warp(2, 33, 3, 1, 'c11chaisang', 33, 3, 'down');
    m.warp(12, 0, 3, 1, 'c11nanping', 3, 34, 'right', () => G.flag('c11_ill'), '周瑜：先生且留在营中，破曹大计还须共商。');
    m.reserve(2, 30, 3, 4); m.reserve(12, 0, 3, 4);
    K.tent(m, 8, 3, { big: true, w: 7, h: 5, red: true, sign: '周' });
    for (const [x, y] of [[17, 6], [17, 12], [4, 12], [18, 25], [8, 26]]) K.tent(m, x, y, { red: true });
    K.stakeRing(m, 2, 1, 23, 29, [[11, 1, 3, 1], [11, 29, 3, 1], [23, 19, 1, 3], [2, 25, 1, 5]]);
    for (const [x, y] of [[6, 9], [16, 9], [22, 17]]) K.deco(m, 'flag', x, y, Object.assign({ text: '周' }, WUFLAG));
    K.deco(m, 'fire', 10, 15); K.deco(m, 'rack', 15, 16); K.deco(m, 'crates', 21, 22); K.deco(m, 'crates', 22, 22); K.deco(m, 'jar', 6, 17);
    K.forest(m, { seed: 1123, thr: 0.74, kinds: ['bamboo', 'tree', 'pine'] });
    m.npc({ id: 'zy11', spec: 'zhouyu', x: 11, y: 9, dir: 'down', marker: () => !G.flag('c11_zhou') || (G.flag('c11_kurou') && !G.flag('c11_ill')), talk: async () => {
      if (!G.flag('c11_zhou')) return zhouScene();
      if (!G.flag('c11_arrows')) { await say('zhouyu', '十日之内，十万枝箭——先生莫要忘了军令状。'); return; }
      if (!G.flag('c11_kurou')) { await say('zhouyu', '先生果然神机妙算……（此人不除，必为江东之患。）'); return; }
      if (!G.flag('c11_ill')) return illScene();
      await say('zhouyu', '先生……那东风，当真借得来么？');
    } });
    m.npc({ id: 'ls11b', spec: 'lusu', x: 25, y: 19, dir: 'right', cond: () => G.flag('c11_zhou'), marker: () => !G.flag('c11_arrows'), talk: async () => {
      if (G.flag('c11_arrows')) { await say('lusu', '先生真神人也！……只是公瑾心胸，唉。'); return; }
      await arrowsScene();
    } });
    m.npc({ id: 'hg11b', spec: 'huanggai', x: 15, y: 13, dir: 'down', cond: () => G.flag('c11_arrows'), marker: () => !G.flag('c11_kurou'), talk: async () => {
      if (G.flag('c11_kurou')) { await say('huanggai', '老夫这把骨头，挨了一百军棍……值！'); return; }
      await kurouScene();
    } });
    m.npc({ id: 'wb1', spec: 'wubing', x: 12, y: 22, dir: 'down', talk: K.talk([['wubing', '北边是南屏山。江上风大，这个时节，刮的都是西北风。']]) });
    m.npc({ id: 'wb2', spec: 'wubing', x: 30, y: 20, dir: 'left', talk: K.talk([['wubing', '对岸便是曹营，连营三百余里，灯火照江，如同白昼。']]) });
    m.npc({ id: 'wb3', spec: 'wubing', x: 36, y: 8, wander: 2, talk: K.talk([['wubing', '都督的座船。江东子弟，水上功夫天下第一！']]) });
    m.npc({ id: 'inn11b', spec: 'innkeeper', x: 5, y: 21, dir: 'down', talk: async () => {
      await say('innkeeper', '先生是客，营中歇息不收钱。', { name: '军需官' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      const s = await G.choose(['记录进度', '不用了']);
      if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 'shop11b', spec: 'merchant', x: 19, y: 22, dir: 'down', talk: K.shopTalk('merchant', WU_SHOP, '军需', '要些什么？', '军需官') });
    m.onEnter = async () => { if (G.flag('c11_sj')) return; G.setFlag('c11_sj'); await say('zhugeliang', '好一座水寨……周公瑾果然名不虚传。'); };
    return m;
  };

  async function zhouScene() {
    await G.lines([
      ['zhouyu', '先生远来。曹操以天子为名，其师不可拒；且其势大，未可轻敌。战则必败，降则易安……吾意已决，来日见主公，便当遣使纳降。'],
      ['lusu', '公瑾！你、你怎能如此！'],
      ['zhugeliang', '（微笑）亮有一计，可以退曹，不须牵羊担酒，纳土献印，亦不须亲自渡江。只须遣一介之使，扁舟送两个人到江上。'],
      ['zhouyu', '用哪两个人？'],
      ['zhugeliang', '亮居隆中时，闻曹操于漳河新造一台，名曰铜雀。曹操曾发誓曰："吾一愿扫平四海，以成帝业；一愿得江东二乔，置之铜雀台，以乐晚年，虽死无恨矣。"'],
      ['zhugeliang', '其子曹植作《铜雀台赋》，有云："揽二乔于东南兮，乐朝夕之与共。"——将军何不去寻乔公，以千金买此二女，送与曹操？'],
    ]);
    G.audio.sfx('gong'); G.shake(10, 0.6);
    await G.narrate('周瑜听罢，勃然大怒，离座指北而骂——');
    await G.lines([
      ['zhouyu', '老贼欺吾太甚！'],
      ['zhugeliang', '都督何故如此？昔单于屡侵疆界，汉天子许以公主和亲，今何惜民间二女乎？'],
      ['zhouyu', '公有所不知：大乔是孙伯符将军主妇，小乔乃瑜之妻也！'],
      ['zhugeliang', '（佯作惶恐）亮实不知，失口乱言，死罪！死罪！'],
      ['zhouyu', '吾与老贼誓不两立！望孔明助一臂之力，同破曹贼！'],
    ]);
    await G.narrate('数日后，周瑜请孔明议事。');
    await G.lines([
      ['zhouyu', '即日将与曹军交战，水路交兵，当以何兵器为先？'],
      ['zhugeliang', '大江之上，以弓箭为先。'],
      ['zhouyu', '先生之言，甚合愚意。但今军中正缺箭用，敢烦先生监造十万枝箭——十日之内，可完办否？'],
      ['zhugeliang', '操军即日将至，若候十日，必误大事。……只消三日，便可拜纳十万枝箭。'],
      ['zhouyu', '军中无戏言！'],
      ['zhugeliang', '怎敢戏都督？愿纳军令状。三日不办，甘当重罚。'],
    ]);
    G.setFlag('c11_zhou');
    await G.notice('立下军令状：三日之内，交十万枝箭。\n去水寨码头找鲁肃。');
  }

  async function arrowsScene() {
    await G.lines([
      ['lusu', '先生！三日如何造得十万枝箭？这是公瑾要害你啊！'],
      ['zhugeliang', '望子敬借我二十只船，每船要军士三十人，船上皆用青布为幔，各束草千余个，分布两边。——切不可让公瑾得知。'],
    ]);
    await G.fadeOut(1.0);
    await G.narrate('第三日四更时分，孔明密请鲁肃上船，将二十只船用长索相连，径望北岸进发。');
    await G.narrate('是夜大雾漫天，长江之中，雾气更甚，对面不相见。');
    await G.lines([
      ['lusu', '倘曹兵齐出，如之奈何？'],
      ['zhugeliang', '吾料曹操于重雾中必不敢出。吾等只顾酌酒取乐，待雾散便回。'],
    ]);
    await G.narrate('五更时候，船已近曹操水寨。孔明教把船只头西尾东，一带摆开，就船上擂鼓呐喊。');
    await G.fadeIn(0.6);
    G.audio.sfx('gong');
    let r = await G.battle(['caogong', 'caogong', 'caoshui'], { bg: 'fog', party: SOLO, intro: '重雾之中，曹军水寨弓弩手乱箭齐发！' });
    if (r !== 'win') return;
    await G.narrate('孔明又教把船吊回，头东尾西，逼近水寨受箭，一面擂鼓呐喊。');
    G.restoreAll();
    r = await G.battle(['caogong', 'caogong', 'caogong', 'caoshui'], { bg: 'fog', party: SOLO, intro: '曹操又拨旱寨弓弩手六千，到江边助射！' });
    if (r !== 'win') return;
    await G.narrate('待至日高雾散，孔明令收船急回。二十船两边束草上，排满箭枝。');
    await say('zhugeliang', '（令军士齐声高叫）谢丞相箭！');
    await G.narrate('比及曹军报知曹操时，这里船轻水急，已放回二十余里，追之不及。');
    await G.lines([
      ['lusu', '先生真神人也！何以知今日如此大雾？'],
      ['zhugeliang', '为将而不通天文，不识地利，不知奇门，不晓阴阳，不看阵图，不明兵势，是庸才也。亮于三日前已算定今日有大雾，因此敢任三日之限。'],
    ]);
    G.setFlag('c11_arrows'); G.restoreAll();
    G.state.gold += 1000; G.audio.sfx('levelup');
    await G.notice('草船借箭，得箭十万余枝！\n周瑜犒赏 1000 金。');
  }

  async function kurouScene() {
    await G.lines([
      ['huanggai', '先生。老夫受孙氏三世厚恩，今日愿献一计：诈降曹操，以火破之。'],
      ['zhugeliang', '……将军之计，与都督不谋而合。只是——须得一番苦肉。'],
      ['huanggai', '某甘受刑罚，虽肝脑涂地，亦无怨悔！'],
    ]);
    G.audio.sfx('hit'); G.shake(6, 0.4);
    await G.narrate('次日，周瑜鸣鼓大会诸将。黄盖当众顶撞，周瑜大怒，喝令斩首，众将苦苦求情，乃改为脊杖一百。打到五十，黄盖皮开肉绽，鲜血迸流，扶归本寨，昏绝几次。');
    await G.narrate('阚泽密献诈降书于曹操。又有凤雏庞统，往曹营献"连环计"，教曹操以铁环大钉，将战船首尾锁住——人马在船上如履平地。');
    await G.lines([
      ['lusu', '先生，今日公瑾打黄公覆，先生为何一言不劝？'],
      ['zhugeliang', '子敬欺我。公瑾今日毒打黄公覆，乃其计耳，如何要我劝他？——切勿对公瑾说亮知此事。'],
    ]);
    G.setFlag('c11_kurou');
    await G.notice('听说周都督忽然病倒了……\n去看看周瑜吧。');
  }

  async function illScene() {
    await G.narrate('周瑜卧于帐中，口吐鲜血，不省人事。');
    await G.lines([
      ['zhugeliang', '都督心中似觉烦积否？……亮有一方，便教都督气顺。'],
    ]);
    await G.narrate('孔明索纸笔，屏退左右，密书十六字：');
    await G.narrate('"欲破曹公，宜用火攻；万事俱备，只欠东风。"');
    await G.lines([
      ['zhouyu', '（大惊）……先生已知我病源！事在危急，望即赐教！'],
      ['zhugeliang', '亮虽不才，曾遇异人，传授奇门遁甲天书，可以呼风唤雨。都督若要东南风时，可于南屏山建一台，名曰七星坛——亮于台上作法，借三日三夜东南大风，助都督用兵。'],
      ['zhouyu', '休道三日三夜，只一夜大风，大事可成矣！'],
    ]);
    G.setFlag('c11_ill');
    await G.notice('出水寨北门，登南屏山七星坛。');
  }

  /* ---------------- 南屏山 · 七星坛 ---------------- */
  B.c11nanping = () => {
    const m = new G.GameMap('c11nanping', '南屏山 · 七星坛', 30, 40, TL.GRASS);
    Object.assign(m, { seed: 1141, music: 'field', pal: { gh: 96, gs: 28, gl: 26 }, ambient: 'leaves', leafColor: 'rgba(150,180,90,0.8)', flowers: 0.02, battleBg: 'river' });
    m.rect(0, 37, 30, 3, TL.WATER);
    for (let x = 0; x < 30; x++) if (G.hash(x, 36, 1141) < 0.5) m.set(x, 36, TL.WATER);
    const pts = [[-1, 34], [8, 34], [10, 27], [18, 24], [16, 16], [14.5, 11]];
    const clear = new Set();
    m.road(pts, 2.2, null, (x, y) => clear.add(x + ',' + y));
    for (let y = 1; y <= 11; y++) for (let x = 8; x <= 21; x++) clear.add(x + ',' + y);
    for (let y = 31; y <= 36; y++) for (let x = 0; x <= 29; x++) clear.add(x + ',' + y);
    m.road(pts, 0.6, TL.PATH);
    m.road([[8, 34], [24, 35]], 0.5, TL.PATH);
    m.rect(9, 2, 12, 10, TL.SOIL);
    m.prop('altar', 12, 3, 6, 6, { foot: [12, 3, 6, 6] });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!clear.has(x + ',' + y) && m.get(x, y) === TL.GRASS) m.tree(x, y, G.hash(x, y, 3) < 0.18 ? 'rock' : G.hash(x, y, 4) < 0.55 ? 'pine' : 'bamboo');
    K.ship(m, 21, 37, 7, 3, { dir: 'left', sail: '#d8cbb0', mh: 120 });
    m.warp(0, 33, 1, 3, 'c11sanjiang', 13, 2, 'down');
    m.event({ type: 'inspect', x: 12, y: 9, w: 6, h: 1, run: altarScene });
    for (const [x, y] of [[10, 10], [19, 10]]) m.npc({ id: 'ab' + x, spec: 'wubing', x, y, dir: 'down', talk: K.talk([['wubing', G.flag('c11_wind') ? '东、东南风……真的起了！' : '都督有令：守坛军士，不许擅离方位，不许交头接耳，不许失口乱言。']]) });
    m.npc({ id: 'dingfeng', spec: 'dingfeng', x: 16, y: 21, dir: 'up', aggro: true, cond: () => G.flag('c11_wind') && !G.flag('c11_dx'), talk: dxScene });
    m.npc({ id: 'xusheng', spec: 'xusheng', x: 18, y: 21, dir: 'up', aggro: true, cond: () => G.flag('c11_wind') && !G.flag('c11_dx'), talk: dxScene });
    m.npc({ id: 'zy11c', spec: 'zhaoyun', x: 20, y: 35, dir: 'left', cond: () => G.flag('c11_wind') && !G.flag('c11_dx') });
    m.onEnter = async () => { if (G.flag('c11_np')) return; G.setFlag('c11_np'); await say('zhugeliang', '七星坛已然筑成。上山吧——东风，就在今夜。'); };
    return m;
  };

  async function altarScene() {
    if (G.flag('c11_wind')) { await G.narrate('七星旗猎猎作响，齐齐指向西北。'); return; }
    await G.narrate('孔明沐浴斋戒，身披道衣，跣足散发，来到坛前。');
    await G.narrate('坛高九尺，作三层，用军士一百二十人，执旗守坛。下一层插二十八宿青、黑、白、红四色旗；二层六十四面黄旗，按六十四卦；上一层四人，各戴束发冠，穿皂罗袍，凤衣博带。');
    await say('zhugeliang', '诸位各守方位，不许擅离，不许失口乱言，不许失惊打怪。如违令者斩！');
    await G.fadeOut(1.2);
    await G.narrate('孔明缓步登坛，焚香于炉，注水于盂，仰天暗祝。一日上坛三次，下坛三次。');
    await G.narrate('却并不见有东南风。');
    await G.narrate('……');
    await G.narrate('是夜，看看三更时分——');
    G.setFlag('c11_wind');
    G.audio.sfx('gong'); G.shake(14, 1.6);
    await G.fadeIn(1.0);
    await G.narrate('忽听风声响，旗幡转动。周瑜出帐看时，旗脚竟飘西北——霎时间，东南风大起！');
    G.audio.sfx('levelup');
    await G.notice('诸葛亮 习得「借东风」！\n（设坛祭风，借来东风，火烧全体敌军。）');
    await G.lines([
      ['zhugeliang', '东风已借。……周公瑾见我能夺天地造化之法，必不相容。'],
      ['zhugeliang', '吾已令子龙驾小舟，在山下江边相候。是时候走了。'],
    ]);
    await G.notice('下山，前往江边与赵云会合。');
  }

  async function dxScene() {
    await G.lines([
      ['dingfeng', '诸葛亮休走！都督有请！'],
      ['xusheng', '先生何不回去，都督还有话说！'],
      ['zhugeliang', '上覆都督：好好用兵。诸葛亮暂回夏口，异日再容相见。'],
      ['dingfeng', '休听他的！拿下！'],
    ]);
    G.audio.sfx('gong');
    await G.narrate('江边一员大将，挺枪立于船头——');
    await G.lines([
      ['zhaoyun', '吾乃常山赵子龙！奉命特来接军师。你如何来追赶？'],
      ['zhaoyun', '本待一箭射死你来，显得两家失了和气——教你知我手段！'],
    ]);
    G.unstash(['zhaoyun']);
    G.state.party = ['zhugeliang', 'zhaoyun'];
    G.world.refreshParty();
    const r = await G.battle(['dingfeng', 'xusheng'], { bg: 'river', boss: true, party: ['zhugeliang', 'zhaoyun'], intro: '丁奉、徐盛 追杀孔明！' });
    if (r !== 'win') return;
    G.setFlag('c11_dx');
    await G.narrate('赵云拈弓搭箭，一箭射断徐盛船上篷索，那篷坠落下水，其船便横。赵云却教自己船上拽起满帆，乘顺风而去。');
    await G.lines([
      ['zhaoyun', '军师，主公在夏口日夜悬望！'],
      ['zhugeliang', '子龙来得正好。——东风已起，曹操百万之众，今夜便要灰飞烟灭了。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[11].endLines);
  }

  G.CHAPTERS[11] = {
    title: '东风',
    prologue: [
      '建安十三年冬。曹操得荆州水军，号称八十三万，顺江而下，',
      '致书东吴孙权："今治水军八十万众，方与将军会猎于吴。"',
      '江东震动，文臣多主降。',
      '鲁肃过江吊丧，与诸葛亮同舟东下。',
      '卧龙孤身入江东，舌战群儒，智激孙权——',
      '一场决定天下三分的大火，即将在长江上点燃。',
    ],
    start: async () => {
      G.stashParty(SOLO);
      G.restoreAll();
      const w = G.world;
      w.load('c11chaisang', 20, 28, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['lusu', '先生，这便是柴桑了。'],
        ['zhugeliang', '子敬，江东诸公若问起曹操兵马，亮自有道理。'],
      ]);
      await G.notice('第三部　赤壁\n本章诸葛亮孤身在江东。善用「火计」「烈火」「八阵」，在客栈与营中休整。');
    },
    endLines: [
      '东南风大起。黄盖率二十只火船，诈称来降，直冲曹营。',
      '曹军战船被铁环锁住，无法分开——',
      '火趁风威，风助火势，烧得满江通红，喊声震地。',
      '曹操百万之众，就在今夜。',
    ],
  };
})();
