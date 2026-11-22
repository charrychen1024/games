/* ============================================================
 * 烽烟录 · 第一章地图与剧情：桃园、涿县、涿郡原野、大兴山黄巾营
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS;
  const say = (...a) => G.say(...a);

  /* ======================= 桃园 ======================= */
  B.taoyuan = () => {
    const m = new G.GameMap('taoyuan', '桃 园', 30, 20, TL.GRASS);
    Object.assign(m, { seed: 11, music: 'title', ambient: 'petals', flowers: 0.12, tint: 'rgba(255,190,170,0.05)' });
    m.prop('pavilion', 12, 3, 7, 5, { foot: [13, 5, 5, 3] });
    m.prop('house', 21, 1, 7, 5, { sign: '张宅', roof: '#4a3b36' });
    m.road([[15, 8], [15, 19]], 1, TL.PATH);
    m.road([[13, 9], [17, 9]], 1, TL.PATH);
    m.road([[16, 11], [24, 11], [24, 6]], 0.7, TL.PATH);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (((x - 6) / 3.4) ** 2 + ((y - 13) / 2.3) ** 2 < 1) m.set(x, y, TL.WATER);
    m.reserve(14, 9, 3, 1);
    m.warp(14, 19, 3, 1, 'town', 19, 2, 'down');
    // 桃林
    for (let x = 0; x < m.w; x++) for (const y of [0, 1, 18, 19]) if (!(y >= 18 && x >= 12 && x <= 18)) m.tree(x, y, G.hash(x, y, 1) < 0.8 ? 'peach' : 'tree');
    for (let y = 2; y < 18; y++) for (const x of [0, 1, 28, 29]) m.tree(x, y, G.hash(x, y, 2) < 0.8 ? 'peach' : 'tree');
    for (let y = 2; y < 18; y++) for (let x = 2; x < 28; x++) {
      if (Math.abs(x - 15) < 3 && y > 7) continue;
      if (G.hash(x, y, 3) < 0.16) m.tree(x, y, 'peach');
    }
    for (const [x, y] of [[3, 11], [10, 12], [9, 15], [2, 15]]) m.tree(x, y, G.hash(x, y) < 0.5 ? 'rock' : 'bush');
    m.npc({ id: 'servant', spec: 'servant', x: 24, y: 7, dir: 'down', wander: 1,
      marker: () => !G.flag('servant_gift'),
      talk: async () => {
        if (!G.flag('servant_gift')) {
          await say('servant', '三爷吩咐过了：庄上的伤药，统统给几位爷带上！');
          G.addItem('shangyao', 3); G.setFlag('servant_gift'); G.audio.sfx('buy');
          await G.notice('得到 伤药 ×3');
          await say('servant', '涿县就在南边，出了桃园一直往南走便是。');
        } else await say('servant', '几位爷此去投军，千万保重啊！庄子有小的照看着。');
      } });
    m.npc({ id: 'farmer', spec: 'farmer', x: 9, y: 9, wander: 2,
      talk: async () => { await say('farmer', '张三爷庄上的桃花，年年开得最好。'); await say('farmer', '可惜啊，如今黄巾闹得凶，桃子熟了也不知还有没有人吃……'); } });
    m.event({ type: 'inspect', x: 13, y: 7, w: 5, h: 1, run: async () => {
      await G.narrate('香案上青烟袅袅。三炷清香，一壶浊酒，几枚鲜桃。');
      if (G.flag('oath')) await G.narrate('结义的誓言，仿佛还回荡在桃林之间。');
    } });
    return m;
  };

  /* ======================= 涿县 ======================= */
  B.town = () => {
    const m = new G.GameMap('town', '涿 县', 40, 30, TL.GRASS);
    Object.assign(m, { seed: 21, music: 'town', ambient: 'leaves', flowers: 0.04 });
    m.rect(0, 0, 40, 2, TL.WALL); m.rect(0, 28, 40, 2, TL.WALL); m.rect(0, 0, 1, 30, TL.WALL); m.rect(39, 0, 1, 30, TL.WALL);
    m.road([[19, 0], [19, 29]], 1, TL.PATH);
    m.road([[2, 14.5], [37, 14.5]], 0.6, TL.PATH);
    m.rect(14, 11, 11, 8, TL.FLOOR);
    m.road([[6, 8], [6, 14]], 0.6, TL.PATH);
    m.road([[32, 8], [32, 14]], 0.6, TL.PATH);
    m.road([[32, 25], [32, 26], [21, 26]], 0.6, TL.PATH);
    m.road([[5, 23], [5, 15]], 0.6, TL.PATH);
    m.road([[12, 25], [12, 15]], 0.6, TL.PATH);
    m.prop('gate', 17, 0, 5, 2, { nofoot: true, plaque: '北门', sortBias: 1 });
    m.prop('gate', 17, 28, 5, 2, { nofoot: true, plaque: '涿县', sortBias: 1 });
    m.prop('house', 3, 3, 7, 5, { sign: '客栈', roof: '#3d4654' });
    m.prop('house', 29, 3, 7, 5, { sign: '杂货', roof: '#45403a' });
    m.prop('house', 29, 20, 7, 5, { sign: '兵器', roof: '#3a3a3a', wall: '#cbbd9e' });
    m.prop('house', 3, 19, 5, 4, { roof: '#4a3b36', lantern: false });
    m.prop('house', 10, 21, 5, 4, { roof: '#3d4654', lantern: false });
    m.prop('house', 23, 3, 5, 4, { roof: '#4a3b36', lantern: false });
    m.prop('house', 11, 4, 5, 4, { roof: '#45403a', lantern: false });
    m.prop('well', 15, 12, 1, 1, { foot: [15, 12, 1, 1] });
    m.prop('board', 23, 12, 1, 1, { foot: [23, 12, 1, 1] });
    m.prop('jar', 36, 8, 1, 1, { foot: [36, 8, 1, 1] }); m.prop('jar', 28, 8, 1, 1, { foot: [28, 8, 1, 1] });
    m.prop('crates', 10, 8, 1, 1, { foot: [10, 8, 1, 1] });
    m.prop('rack', 36, 25, 1, 1, { foot: [36, 25, 1, 1] });
    m.prop('crates', 28, 25, 1, 1, { foot: [28, 25, 1, 1] });
    m.warp(18, 0, 3, 1, 'taoyuan', 15, 18, 'up');
    m.warp(18, 29, 3, 1, 'world', 11, 11, 'down');

    const quest = () => G.flag('quest');
    m.npc({ id: 'innkeeper', spec: 'innkeeper', x: 6, y: 8, dir: 'down', talk: inn });
    m.npc({ id: 'merchant', spec: 'merchant', x: 32, y: 8, dir: 'down', talk: async () => {
      await say('merchant', '客官要些什么？行军打仗，伤药浊酒可少不得。');
      await G.shop(['shangyao', 'jinchuang', 'zhuojiu', 'binliang'], '杂货');
      await say('merchant', '多谢惠顾，客官慢走！');
    } });
    m.npc({ id: 'smith', spec: 'smith', x: 32, y: 25, dir: 'down', talk: async () => {
      await say('smith', '上阵杀贼，身上没副好甲怎么行！看看俺打的甲胄。');
      await G.shop(['pijia', 'tiejia'], '兵器');
    } });
    m.npc({ id: 'jianyong', spec: 'jianyong', x: 21, y: 17, wander: 2, cond: () => !G.flag('jianyong'), marker: () => true, talk: async () => {
      await say('jianyong', '玄德！听说你和两位壮士在桃园结义，要投军讨贼？');
      await say('liubei', '宪和兄消息好灵通。黄巾作乱，百姓涂炭，我等岂能坐视。');
      await say('jianyong', '你我自幼相识，你的心思我还不知道？');
      await say('jianyong', '我简雍虽不善刀枪，却也读过几卷兵书，懂些火攻之法、医药之术。');
      await say('jianyong', '若不嫌弃，愿随玄德同去！');
      await say('zhangfei', '哈哈！好！多一个出主意的，俺老张就只管冲杀！');
      G.joinParty('jianyong'); G.setFlag('jianyong'); G.world.refreshParty(); G.audio.sfx('levelup');
      await G.notice('简雍 加入了队伍！\n简雍担任军师，可在战斗中施展「火计」「疗伤」等策略。');
    } });
    m.npc({ id: 'oldman', spec: 'oldman', x: 16, y: 17, wander: 1, talk: async () => {
      await say('oldman', '老朽活了六十年，从没见过这般世道。');
      await say('oldman', '后生，打仗要讲个"势"字。兵力足时，一刀下去千钧之力；兵力耗尽，空有一身武艺也使不出来。');
      await say('oldman', '所以呀，伤了就要及时疗养，莫要硬撑。');
    } });
    m.npc({ id: 'woman', spec: 'woman', x: 8, y: 15, wander: 2, talk: async () => {
      if (!G.flag('chengdead')) { await say('woman', '我家男人被黄巾掳了去……听说贼营就扎在城东南的大兴山。'); await say('woman', '壮士，若是见着他，求你们救他一命……'); }
      else await say('woman', '谢天谢地，他回来了！壮士的大恩大德，我们一辈子记着！');
    } });
    m.npc({ id: 'child', spec: 'child', x: 26, y: 15, wander: 3, talk: async () => {
      await say('child', '大耳朵哥哥！你的耳朵比我家的兔子还大！');
      await say('liubei', '……');
      await say('zhangfei', '哈哈哈哈！');
    } });
    m.npc({ id: 'farmer2', spec: 'farmer', x: 13, y: 26, wander: 2, talk: async () => {
      await say('farmer', '城外草深的地方，常有黄巾的散兵出没。');
      await say('farmer', '走大路的话，倒是安稳些。');
    } });
    // 南门：接令前守门兵与邹靖挡路
    m.npc({ id: 'guardA', spec: 'guard', x: 18, y: 28, dir: 'up', cond: () => !quest(), talk: async () => await say('guard', '城外黄巾猖獗，没有校尉将令，不得出城！') });
    m.npc({ id: 'guardB', spec: 'guard', x: 20, y: 28, dir: 'up', cond: () => !quest(), talk: async () => await say('guard', '要投军？校尉大人就在这里。') });
    m.npc({ id: 'zoujing', spec: 'zoujing', x: 19, y: 28, dir: 'up', cond: () => !quest(), marker: () => true, talk: zoujingTalk });
    m.npc({ id: 'guardA2', spec: 'guard', x: 17, y: 27, dir: 'right', cond: quest, talk: async () => await say('guard', '诸位壮士，一路保重！') });
    m.npc({ id: 'guardB2', spec: 'guard', x: 21, y: 27, dir: 'left', cond: quest, talk: async () => await say('guard', '大兴山在东南方，过了河再往东走。') });
    m.npc({ id: 'zoujing2', spec: 'zoujing', x: 23, y: 26, dir: 'left', cond: quest, talk: async () => {
      if (G.flag('chengdead')) await say('zoujing', '刘玄德！大兴山一战，你们兄弟名震涿郡！');
      else await say('zoujing', '程远志盘踞大兴山，麾下贼众甚多。量力而行，伤了便回城休整。');
    } });

    m.event({ type: 'step', x: 17, y: 3, w: 5, h: 2, once: 'town_enter', run: async () => {
      await say('zhangfei', '大哥你看！城里贴着招兵的榜文！');
      await say('guanyu', '听闻幽州太守刘焉命校尉邹靖招募义兵。邹校尉此刻应在南门。');
      await say('liubei', '好。先去南门拜见邹校尉。城中若有故人，也不妨一叙。');
    } });
    m.event({ type: 'inspect', x: 15, y: 12, w: 1, h: 1, run: async () => { await G.narrate('一口老井，井水清冽甘甜。'); } });
    m.event({ type: 'inspect', x: 23, y: 12, w: 1, h: 1, run: async () => {
      await G.narrate('【招军榜】\n黄巾作乱，劫掠州郡。凡有志之士，愿为国家讨贼者，速至南门邹校尉处报名。');
    } });
    // 树
    for (let x = 1; x < 39; x++) for (const y of [2, 27]) if (G.hash(x, y, 5) < 0.55) m.tree(x, y, G.hash(x, y, 6) < 0.3 ? 'dark' : 'tree');
    for (let y = 3; y < 27; y++) for (const x of [1, 38]) if (G.hash(x, y, 7) < 0.6) m.tree(x, y, G.hash(x, y, 8) < 0.3 ? 'dark' : 'tree');
    for (const [x, y] of [[9, 17], [16, 9], [26, 9], [26, 19], [36, 17], [2, 17], [15, 25], [24, 22], [36, 11]]) m.tree(x, y, 'tree');
    for (const [x, y] of [[8, 18], [17, 9], [27, 18], [35, 18], [16, 24], [37, 11]]) m.tree(x, y, 'bush');
    return m;
  };

  async function inn() {
    await say('innkeeper', '客官里边请！住一晚二十金，兵力、策略全数恢复。');
    const k = await G.choose(['住店（20 金）', '不必了']);
    if (k !== 0) { await say('innkeeper', '客官慢走，累了随时来！'); return; }
    if (G.state.gold < 20) { await say('innkeeper', '这……客官的盘缠似乎不太够啊。'); return; }
    G.state.gold -= 20;
    await G.fadeOut(0.7);
    G.restoreAll();
    G.audio.sfx('heal');
    await G.wait(1.0);
    await G.fadeIn(0.7);
    await say('innkeeper', '客官歇得可好？兵力、策略都恢复了。');
    const s = await G.choose(['记录进度', '不用了']);
    if (s === 0) await G.saveMenu();
  }

  async function zoujingTalk() {
    await say('zoujing', '你们是来投军的？报上名来。');
    await say('liubei', '在下涿郡刘备，字玄德，乃中山靖王之后。这两位是我的结义兄弟，关羽关云长、张飞张翼德。');
    await say('zoujing', '原来是汉室宗亲！失敬，失敬。');
    await say('zoujing', '如今黄巾贼将程远志，率众数万盘踞城东南的大兴山，四处烧杀劫掠。');
    await say('zoujing', '他手下有员副将，名叫邓茂，力大无穷，官军屡屡受挫。');
    await say('guanyu', '校尉放心。关某愿往，取贼将首级献于帐下。');
    await say('zhangfei', '区区毛贼，俺一矛一个！');
    await say('zoujing', '好！壮哉！这些伤药和军资，拿去整备行装。');
    G.addItem('shangyao', 3); G.state.gold += 100; G.audio.sfx('buy');
    await G.notice('得到 伤药 ×3、军资 100 金');
    if (!G.flag('jianyong')) await say('zoujing', '对了，城中有位叫简雍的读书人，颇通谋略，常在广场一带走动。若能邀他同行，必有助益。');
    await say('zoujing', '城里杂货铺和兵器铺都可置办物资，客栈可以歇息养伤。出了南门往东南，便是大兴山。');
    G.setFlag('quest');
  }

  /* ======================= 涿郡原野 ======================= */
  B.world = () => {
    const m = new G.GameMap('world', '涿 郡', 60, 44, TL.GRASS);
    Object.assign(m, { seed: 31, music: 'field', ambient: 'clouds', flowers: 0.05 });
    // 高草
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (G.fbm(x / 5, y / 5, 55) > 0.56) m.set(x, y, TL.TALL);
    // 河
    m.road([[26, -1], [27, 6], [24, 12], [26, 19], [30, 26], [28, 33], [30, 45]], 1.3, TL.WATER);
    // 大路（遇水成桥）
    const roadPts = [[11.5, 10], [11.5, 14], [18, 17], [22, 18], [31, 18], [37, 22], [40, 29], [43, 33.5], [45.5, 33.5]];
    m.road(roadPts, 0.75, null, (x, y) => { if (!m.inb(x, y)) return; m.set(x, y, m.get(x, y) === TL.WATER || m.get(x, y) === TL.BRIDGE ? TL.BRIDGE : TL.PATH); });
    m.prop('townicon', 10, 7, 4, 3, { label: '涿县', foot: [10, 7, 4, 3] });
    m.prop('campicon', 44, 30, 4, 3, { label: '大兴山', foot: [44, 30, 4, 3] });
    m.warp(11, 10, 2, 1, 'town', 19, 27, 'up');
    m.warp(45, 33, 2, 1, 'camp', 17, 30, 'up');
    m.reserve(11, 11, 2, 1); m.reserve(45, 34, 2, 1);
    m.prop('sign', 14, 15, 1, 1, { foot: [14, 15, 1, 1] });
    m.event({ type: 'inspect', x: 14, y: 15, w: 1, h: 1, run: async () => await G.narrate('路牌：东南 · 大兴山　　北 · 涿县') });
    m.npc({ id: 'peddler', spec: 'merchant', x: 22, y: 16, dir: 'down', talk: async () => {
      await say('merchant', '嘿，几位军爷！小人走南闯北贩些药材，路上用得着。', { name: '行商' });
      await G.shop(['shangyao', 'zhuojiu'], '行商');
    } });
    const roadNear = (x, y, r) => { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const t = m.get(x + i, y + j); if (t === TL.PATH || t === TL.BRIDGE || m.isReserved(x + i, y + j)) return true; } return false; };
    const mountain = (x, y) => {
      for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) { const t = m.get(x + i, y + j); if (!(t === TL.GRASS || t === TL.TALL) || m.isReserved(x + i, y + j) || m.propAt(x + i, y + j)) return false; }
      if (roadNear(x + 1, y + 1, 2)) return false;
      m.prop('mountain', x, y, 3, 2, { v: Math.floor(G.hash(x, y, 9) * 4), foot: [x, y, 3, 2] });
      return true;
    };
    for (let x = 0; x < 58; x += 3) mountain(x, 0);
    for (let y = 3; y < 42; y += 2) mountain(57, y);
    for (const [x, y] of [[33, 3], [37, 5], [41, 3], [45, 6], [49, 3], [52, 7], [36, 9], [43, 10], [48, 12], [53, 13], [40, 14], [50, 17], [54, 21], [47, 25], [50, 28], [51, 32], [49, 36], [40, 37], [44, 38], [36, 33], [53, 38], [32, 9], [3, 30], [6, 33], [2, 36]]) mountain(x, y);
    // 林
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const edge = x === 0 || y === m.h - 1 || x === 1 || y === m.h - 2;
      if ((edge && G.hash(x, y, 4) < 0.85) || G.fbm(x / 6, y / 6, 99) > 0.6) {
        if (roadNear(x, y, edge ? 0 : 2)) continue;
        m.tree(x, y, G.hash(x, y, 12) < 0.45 ? 'pine' : (G.hash(x, y, 13) < 0.3 ? 'dark' : 'tree'));
      } else if (G.hash(x, y, 14) < 0.015 && !roadNear(x, y, 1)) m.tree(x, y, G.hash(x, y, 15) < 0.5 ? 'rock' : 'bush');
    }
    m.encounters = {
      rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.085 },
      groups: [
        { e: ['ybing', 'ybing'], w: 3 }, { e: ['ybing', 'ybing', 'ybing'], w: 2 }, { e: ['ylishi'], w: 2 },
        { e: ['yshushi', 'ybing'], w: 2 }, { e: ['ylishi', 'ybing'], w: 1 }, { e: ['ybing', 'yshushi', 'ybing'], w: 1 },
      ],
    };
    m.event({ type: 'step', x: 0, y: 0, w: 60, h: 44, once: 'world_enter', run: async () => {
      await say('guanyu', '出城了。荒草深处多有黄巾散兵出没，大哥小心。');
      await say('liubei', '沿着大路往东南走，过了河便是大兴山。');
    } });
    return m;
  };

  /* ======================= 大兴山黄巾营 ======================= */
  B.camp = () => {
    const m = new G.GameMap('camp', '大兴山 · 黄巾营', 36, 32, TL.SOIL);
    Object.assign(m, { seed: 41, under: TL.SOIL, music: 'camp', ambient: 'embers', battleBg: 'camp', dusk: true });
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (G.fbm(x / 4, y / 4, 8) > 0.7) m.set(x, y, TL.GRASS);
    m.warp(16, 31, 4, 1, 'world', 45, 34, 'down');
    m.reserve(16, 30, 4, 1);
    // 寨栅
    for (let x = 1; x <= 34; x++) { m.tree(x, 1, 'stake'); if (x < 16 || x > 19) m.tree(x, 30, 'stake'); }
    for (let y = 2; y < 30; y++) { m.tree(1, y, 'stake'); m.tree(34, y, 'stake'); }
    m.reserve(18, 12);
    for (let x = 2; x <= 33; x++) if (x !== 18) m.tree(x, 12, 'stake');
    m.road([[17.5, 31], [17.5, 27], [12, 23], [12, 17], [18, 14], [18, 9]], 0.8, TL.PATH);
    for (let x = 0; x < 36; x++) for (const y of [0, 31]) if (y === 0 || x < 15 || x > 20) m.tree(x, y, G.hash(x, y) < 0.5 ? 'pine' : 'dark');
    for (let y = 1; y < 31; y++) for (const x of [0, 35]) m.tree(x, y, G.hash(x, y) < 0.5 ? 'pine' : 'dark');
    m.prop('bigtent', 15, 2, 7, 5, { foot: [15, 4, 7, 3] });
    const tent = (x, y) => {
      for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const t = m.get(x + i, y + j); if (t === TL.PATH || m.isReserved(x + i, y + j) || m.propAt(x + i, y + j) || m.objs.some(o => o.x === x + i && o.y === y + j)) return; }
      m.prop('tent', x, y, 3, 3, { foot: [x, y + 1, 3, 2] });
    };
    for (const [x, y] of [[4, 3], [9, 4], [25, 3], [29, 6], [4, 14], [7, 19], [24, 14], [29, 18], [4, 25], [23, 24], [28, 25], [8, 26], [26, 8], [11, 8]]) tent(x, y);
    const deco = (type, x, y, o = {}) => { if (m.get(x, y) === TL.PATH || m.propAt(x, y) || m.objs.some(q => q.x === x && q.y === y) || m.isReserved(x, y)) return; m.prop(type, x, y, 1, 1, Object.assign({ foot: [x, y, 1, 1] }, o)); };
    for (const [x, y] of [[14, 9], [23, 9], [15, 20], [21, 22], [6, 23], [27, 28], [30, 13], [6, 10]]) deco('fire', x, y, { light: 150 });
    for (const [x, y] of [[14, 3], [22, 3], [16, 13], [20, 13], [15, 28], [20, 28], [9, 13], [27, 13]]) deco('flag', x, y, { text: G.hash(x, y) < 0.5 ? '黄' : '天' });
    deco('crates', 7, 10); deco('rack', 28, 15); deco('jar', 10, 15); deco('jar', 26, 22); deco('crates', 30, 27); deco('rack', 5, 17);
    m.prop('cart', 21, 18, 2, 1, { foot: [21, 18, 2, 1] });
    m.event({ type: 'inspect', x: 21, y: 18, w: 2, h: 1, run: async () => {
      if (G.flag('grain')) { await G.narrate('粮车已经空了。'); return; }
      G.setFlag('grain'); G.restoreAll(); G.audio.sfx('heal');
      await G.notice('缴获黄巾军粮！全军饱餐一顿，兵力与策略尽数恢复。');
    } });

    // 守营敌兵
    const guard = (id, spec, x, y, dir, flag, group, lines, opt = {}) => m.npc({ id, spec, x, y, dir, aggro: true, fixedDir: opt.fixedDir, cond: () => !G.flag(flag), talk: async () => {
      for (const [who, text] of lines) await say(who, text);
      const r = await G.battle(group, { bg: opt.bg || 'camp', boss: opt.boss });
      if (r === 'win') { G.setFlag(flag); if (opt.after) await opt.after(); }
    } });
    const g1 = [['ybing', '什么人！胆敢擅闯黄天大营！'], ['zhangfei', '你张爷爷来也！']];
    guard('g1a', 'ybing', 16, 28, 'right', 'camp_g1', ['ybing', 'ybing', 'yshushi'], g1);
    guard('g1b', 'ybing', 19, 28, 'left', 'camp_g1', ['ybing', 'ybing', 'yshushi'], g1);
    guard('g2', 'ytoumu', 12, 20, 'down', 'camp_g2', ['ytoumu', 'ybing', 'ybing'], [['ytoumu', '弟兄们，有官军摸进来了！围住他们！'], ['guanyu', '鼠辈，让开！']]);
    guard('g3', 'yshushi', 20, 19, 'down', 'camp_g3', ['yshushi', 'ylishi', 'yshushi'], [['yshushi', '此乃大贤良师赐下的军粮，谁敢动！'], ['jianyong', '妖言惑众，看我一把火烧了你的符咒！']]);
    m.npc({ id: 'dengmao', spec: 'dengmao', x: 18, y: 12, dir: 'down', aggro: true, cond: () => !G.flag('dengdead'), talk: async () => {
      await say('dengmao', '哪里来的村夫，也敢犯我大营！可识得俺邓茂？');
      await say('zhangfei', '燕人张翼德在此！你这厮报上名来，不过是给俺的蛇矛添个亡魂！');
      await say('dengmao', '好狂的黑汉！看斧！');
      const r = await G.battle(['dengmao', 'ybing', 'ybing'], { bg: 'camp', boss: true, intro: '黄巾副将 邓茂 杀到！' });
      if (r === 'win') {
        G.setFlag('dengdead');
        await say('zhangfei', '哈哈哈！痛快！这厮的斧头，还没俺家杀猪刀快！');
        await say('liubei', '三弟神勇！贼首程远志就在后面的大帐，大家小心。');
        await say('guanyu', '前方便是中军大帐。大哥，不妨先整顿兵马再进。');
        G.addItem('shangyao', 2); G.audio.sfx('buy');
        const st = G.state, hp = st.party.map(id => `${G.HEROES[id].name} ${st.members[id].hp}/${G.stats(id).maxhp}`).join('　');
        await G.notice(`从邓茂营中缴获 伤药 ×2\n\n${hp}\n策略 ${st.sp}/${G.maxSP()}\n\n程远志比邓茂更难对付。兵力不足时，可在军务菜单里用伤药，或先出营回涿县客栈休整——已击退的守卫不会再出现。`);
      }
    } });
    m.npc({ id: 'cheng', spec: 'chengyuanzhi', x: 18, y: 8, dir: 'down', aggro: true, cond: () => !G.flag('chengdead'), talk: async () => {
      await say('chengyuanzhi', '邓茂竟然折在你们手里……好！好得很！');
      await say('chengyuanzhi', '苍天已死，黄天当立！今日便拿你们的血，祭我黄天大旗！');
      await say('liubei', '你等打着替天行道的旗号，却烧杀百姓、劫掠州县，天理难容！');
      await say('guanyu', '贼将，可识得关某手中这口青龙偃月刀？');
      const r = await G.battle(['chengyuanzhi', 'ytoumu', 'yshushi'], { bg: 'boss', boss: true, intro: '黄巾大将 程远志 杀到！' });
      if (r === 'win') { G.setFlag('chengdead'); await ending(); }
    } });
    m.event({ type: 'step', x: 15, y: 27, w: 6, h: 3, once: 'camp_enter', run: async () => {
      await say('zhangfei', '嚯！好大一座贼营！');
      if (G.flag('jianyong')) await say('jianyong', '营中帐篷连绵，粮草必多。若能缴了他们的军粮，倒可以补充补充。');
      await say('guanyu', '贼兵势众，不可轻敌。稳扎稳打，伤了便退回城中休整。');
    } });
    m.encounters = {
      rates: { [TL.SOIL]: 0.03, [TL.GRASS]: 0.03, [TL.PATH]: 0.012 },
      groups: [{ e: ['ybing', 'ybing', 'ybing'], w: 2 }, { e: ['ylishi', 'yshushi'], w: 2 }, { e: ['ytoumu', 'ybing'], w: 1 }, { e: ['yshushi', 'yshushi', 'ybing'], w: 1 }],
    };
    return m;
  };

  /* ======================= 开场与结局 ======================= */
  G.openingScript = async function () {
    const w = G.world;
    w.load('taoyuan', 15, 9, 'up');
    w.place(1, 14, 9, 'up'); w.place(2, 16, 9, 'up');
    w.banner = null;
    await G.fadeIn(1.4);
    await G.wait(0.5);
    w.party[2].dir = 'left';
    await say('zhangfei', '大哥！二哥！香案祭品都已备齐了。今日桃花开得正盛，正是结义的好日子！');
    w.party[1].dir = 'right';
    await say('guanyu', '黄巾作乱，百姓倒悬。我等虽是布衣，也当为天下出一份力。');
    w.party[0].dir = 'left';
    await say('liubei', '二位贤弟……我刘备虽是汉室宗亲，如今却只是个织席贩履之人。');
    w.party[0].dir = 'right';
    await say('liubei', '能得二位倾心相待，实乃刘备平生之幸。');
    await say('zhangfei', '大哥说的哪里话！来来来，焚香！');
    for (const u of w.party) u.dir = 'up';
    await G.wait(0.5);
    G.audio.sfx('gong');
    w.burstPetals(80);
    await G.narrate('三人焚香再拜，对天盟誓——');
    await say('liubei', '念刘备、关羽、张飞，虽然异姓，既结为兄弟，则同心协力，救困扶危；上报国家，下安黎庶。', { name: '三人' });
    await say('liubei', '不求同年同月同日生，只愿同年同月同日死。皇天后土，实鉴此心！', { name: '三人' });
    w.burstPetals(60);
    await G.titleCard('桃园结义', '中平元年 · 幽州涿郡');
    G.setFlag('oath');
    for (const u of w.party) u.dir = 'down';
    await say('zhangfei', '好！从今往后，咱们便是生死兄弟！大哥，咱们这就去涿县，投军杀贼！');
    await say('guanyu', '出了桃园往南，便是涿县城。张家庄客那里，备了些伤药。');
    await G.notice('方向键 / WASD 移动　　空格 / Enter 调查、对话\nEsc 打开军务菜单　　按住 Shift 奔跑　　M 静音');
  };

  async function ending() {
    const w = G.world;
    await say('chengyuanzhi', '黄天……黄天不会放过你们……');
    await G.narrate('程远志倒地，黄巾贼众见主将已死，纷纷丢盔弃甲，四散奔逃。');
    for (const u of w.party) u.dir = 'down';
    await say('zhangfei', '哈哈！大哥，二哥，咱们赢了！');
    await say('guanyu', '贼首已诛，余众溃散。大哥，此番也算不负桃园之誓。');
    if (G.flag('jianyong')) await say('jianyong', '营中被掳的百姓，我已命人放了。他们正哭着要给玄德磕头呢。');
    await say('liubei', '……这只是开始。张角兄弟仍据冀州，天下黄巾何止百万。');
    await say('liubei', '走吧，二弟、三弟。回涿县复命——然后，去更远的地方。');
    await G.chapterEnd(G.CHAPTERS[1].endLines);
  }
  G.CHAPTERS = G.CHAPTERS || {};
  G.CHAPTERS[1] = {
    title: '桃园起义',
    get prologue() { return G.PROLOGUE1; },
    start: () => G.openingScript(),
    endLines: [
      '大兴山一战，刘、关、张初露锋芒。',
      '涿郡百姓奔走相告：桃园三兄弟，义薄云天。',
      '然而黄巾之乱方兴未艾，张角三兄弟仍据冀州，',
      '青州告急，广宗未下，烽烟已遍九州。',
      '英雄的征程，才刚刚开始。',
    ],
  };
})();
