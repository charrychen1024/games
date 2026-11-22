/* ============================================================
 * 烽烟录 · 第二十九章　陈仓
 * 赵云病逝 → 陈仓（郝昭死守、云梯冲车地道皆不能破）→ 魏延斩王双 → 张苞坠涧
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const SHOP = ['huixin', 'jiuzhuan', 'yuquan', 'qianjin', 'xuming', 'nanzhong', 'muniu', 'wuxing', 'zhuge'];
  const ARMY = ['zhugeliang', 'weiyan', 'guanxing', 'zhangbao2', 'jiangwei', 'wangping'];
  const GROUPS = [{ e: ['weibing', 'weibing'], w: 3 }, { e: ['weibing', 'weinu'], w: 3 }, { e: ['weiqi', 'weinu'], w: 2 }];
  const restAndSave = async (who, line, name) => {
    await say(who, line, { name });
    await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
    const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
  };

  B.c29chencang = () => {
    const m = new G.GameMap('c29chencang', '陈 仓', 46, 40, TL.GRASS);
    Object.assign(m, { seed: 2901, music: 'camp', ambient: 'snow', pal: { gh: 205, gs: 12, gl: 72, path1: '#a8a090', path2: '#bab2a2' }, battleBg: 'snow', flowers: 0 });
    K.walls(m, 12, 0, 33, 9, [{ side: 's', x: 21, plaque: '陈仓' }]);
    m.road([[22.5, 40], [22.5, 10]], 0.9, TL.PATH);
    m.road([[22.5, 24], [36, 22], [40.5, 16]], 0.6, TL.PATH);
    m.rect(36, 10, 8, 6, TL.SOIL);
    K.tent(m, 37, 10, { w: 3, h: 3 }); K.deco(m, 'flag', 42, 14, { text: '王', color: '#24304a', tcol: '#f6e7c1' });
    K.tent(m, 16, 32, { big: true, w: 5, h: 4, red: true, sign: '汉' }); K.tent(m, 26, 33, { red: true });
    for (const [x, y] of [[14, 14], [30, 14]]) K.deco(m, 'cart', x, y);
    m.reserve(21, 28, 4, 12); m.reserve(35, 9, 10, 8);
    for (const [x, y] of [[2, 4], [2, 20], [6, 30], [38, 30], [40, 4]]) K.mountain(m, x, y);
    K.forest(m, { seed: 2905, thr: 0.64, kinds: ['snowy', 'pine', 'snowy'] });
    m.warp(21, 39, 4, 1, 'c29chencang', 22, 37, 'up', () => false, '魏延：陈仓未下，岂可空回？');
    m.warp(21, 9, 3, 1, 'c29chencang', 22, 12, 'down', () => false, '城门紧闭，城上郝昭冷冷地看着。');
    m.npc({ id: 'cc29inn', spec: 'innkeeper', x: 25, y: 36, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) await restAndSave('innkeeper', '丞相，天寒地冻，军中多备了些炭火。', '军需官'); else if (k === 1) await G.shop(SHOP, '北伐军需');
    } });
    m.npc({ id: 'hz29', spec: 'haozhao', x: 22, y: 11, dir: 'down', aggro: true, cond: () => !G.flag('c29_hz'), marker: () => true, talk: haozhaoScene });
    m.npc({ id: 'ws29', spec: 'wangshuang', x: 40, y: 17, dir: 'down', aggro: true, cond: () => G.flag('c29_hz') && !G.flag('c29_ws'), marker: () => true, talk: wangshuangScene });
    m.encounters = { rates: { [TL.GRASS]: 0.025, [TL.TALL]: 0.07, [TL.PATH]: 0.01 }, groups: GROUPS };
    return m;
  };

  async function haozhaoScene() {
    if (G.flag('c29_hz')) return;
    await G.lines([
      ['haozhao', '吾受魏国厚恩，惟有一死而已！诸葛亮，便来攻打，吾不惧也！'],
      ['zhugeliang', '量此一座孤城，何足道哉！'],
    ]);
    const r = await G.battle(['haozhao', 'weinu', 'weibing'], { bg: 'snow', boss: true, intro: '陈仓守将 郝昭！' });
    if (r !== 'win') return;
    G.setFlag('c29_hz');
    await G.narrate('孔明令军士造云梯百乘，郝昭令火箭射之，云梯尽着；又造冲车，郝昭运石凿眼，以葛绳穿定，飞打冲车，冲车皆折；又令掘地道，郝昭于城中掘重壕横截——');
    await G.narrate('昼夜相攻二十余日，无计可破。');
    await G.notice('魏将王双引兵来救陈仓。\n去东边的山坡迎敌。');
  }

  async function wangshuangScene() {
    if (G.flag('c29_ws')) return;
    await G.lines([
      ['wangshuang', '（使六十斤大刀，骑千里征驹，开两石铁胎弓，暗藏三个流星锤）谁敢与王双一战！'],
      ['weiyan', '（冷笑）丞相，让魏延去会会他！'],
    ]);
    G.setParty(['weiyan']);
    const r = await G.battle(['wangshuang'], { bg: 'snow', boss: true, party: ['weiyan'], intro: '魏将 王双！' });
    G.setParty(ARMY);
    if (r !== 'win') return;
    G.setFlag('c29_ws');
    await G.narrate('魏延佯退，王双追来；魏延回马一刀，斩王双于马下。');
    await G.narrate('陈仓终究攻不下，军中粮尽，孔明只得传令退兵。张苞追赶魏将郭淮，马失前蹄，连人带马跌入山涧——');
    await G.lines([
      ['guanxing', '（急救起张苞）兄弟！兄弟！'],
      ['zhangbao2', '……关兴哥……替我……多杀几个魏狗……'],
    ]);
    await G.narrate('张苞头部重伤，送回成都养病。不久，病亡。孔明闻之，放声大哭，口中吐血，昏绝于地。');
    G.leaveParty('zhangbao2'); G.world.refreshParty();
    await G.notice('张苞 病亡。\n（他的护甲放回了行囊）');
    await G.chapterEnd(G.CHAPTERS[29].endLines);
  }

  G.CHAPTERS[29] = {
    title: '陈仓',
    prologue: [
      '成都来报：老将赵云，病故于家。',
      '孔明跌足而哭："子龙身故，国家损一栋梁，吾去一臂也！"',
      '赵子龙，一身是胆。从磐河初见刘备，到凤鸣山力斩五将——',
      '征战一生，未尝一败。',
    ],
    start: async () => {
      if (G.ensureMembers) G.ensureMembers();
      G.leaveParty('zhaoyun');
      G.catchUp(ARMY);
      G.setParty(ARMY);
      G.restoreAll();
      const w = G.world;
      w.load('c29chencang', 22, 30, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhugeliang', '（遥望北方，良久）……子龙，亮会带着你的那一份，打到长安。'],
        ['jiangwei', '丞相，前面便是陈仓。守将郝昭，听说是个硬骨头。'],
      ]);
      await G.notice('赵云 病逝。\n（他的护甲放回了行囊）\n二出祁山：攻打陈仓。');
    },
    endLines: [
      '二出祁山，又无功而返。',
      '孔明三出，取武都、阴平二郡；',
      '四出祁山，大军开进陇西，正值麦熟时节。',
      '司马懿与郭淮，屯兵于上邽。',
    ],
  };
})();
