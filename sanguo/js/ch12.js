/* ============================================================
 * 烽烟录 · 第十二章　赤壁
 * 夏口（孔明调兵遣将）→ 赤壁（火烧连环船，于禁）→ 乌林·葫芦口·华容道（徐晃、许褚、关羽义释曹操）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const NAVY = [{ e: ['caoshui2', 'caoshui2'], w: 3 }, { e: ['caoshui2', 'caogong2'], w: 3 }, { e: ['caogong2', 'caogong2', 'caoshui2'], w: 1 }];
  const ROUT = [{ e: ['caobing5', 'caobing5'], w: 3 }, { e: ['caoqi5', 'caobing5'], w: 2 }, { e: ['caobing5', 'caobing5', 'caogong2'], w: 1 }];
  const ALL = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'jianyong', 'zhugeliang'];

  const restTalk = async () => {
    await G.say('innkeeper', '将军，粮草军资都在这里，歇口气再走吧。', { name: '军需官' });
    const k = await G.choose(['休整', '买些军资', '不用了']);
    if (k === 0) { await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5); const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu(); }
    else if (k === 1) await G.shop(['dahuan', 'shenghui', 'qiongjiang', 'tianzhong', 'xuming', 'jingliang', 'quanjun'], '军需');
  };

  /* ---------------- 夏口 ---------------- */
  B.c12xiakou = () => {
    const m = new G.GameMap('c12xiakou', '夏 口', 36, 28, TL.GRASS);
    Object.assign(m, { seed: 1201, music: 'camp', pal: { gh: 92, gs: 34, gl: 28 }, ambient: 'leaves', flowers: 0.04 });
    m.rect(0, 22, 36, 6, TL.WATER);
    for (let x = 0; x < 36; x++) if (G.hash(x, 21, 1201) < 0.45) m.set(x, 21, TL.WATER);
    m.road([[18, 21], [18, 9]], 0.8, TL.PATH);
    m.road([[3, 14.5], [34, 14.5]], 0.6, TL.PATH);
    for (let y = 20; y < 24; y++) m.set(18, y, TL.BRIDGE);
    K.ship(m, 15, 24, 7, 4, { sail: '#d8cbb0', text: '刘', tcol: '#8a1e1e' });
    K.tent(m, 15, 3, { big: true, w: 7, h: 5, red: true, sign: '刘' });
    for (const [x, y] of [[5, 5], [26, 5], [5, 16], [27, 16]]) K.tent(m, x, y, {});
    K.stakeRing(m, 1, 1, 34, 19, [[17, 19, 3, 1], [34, 13, 1, 3]]);
    for (const [x, y] of [[13, 9], [23, 9]]) K.deco(m, 'flag', x, y, { text: '刘', color: '#8a1e1e', tcol: '#f6e7c1' });
    K.deco(m, 'fire', 18, 11); K.deco(m, 'rack', 10, 12); K.deco(m, 'crates', 28, 12);
    m.warp(35, 13, 1, 3, 'c12chibi', 2, 15, 'right', () => G.flag('c12_orders'), '先听军师调遣。');
    m.reserve(32, 13, 4, 3);
    K.forest(m, { seed: 1203, thr: 0.78, kinds: ['tree', 'bamboo'] });
    m.npc({ id: 'kmx', spec: 'zhugeliang', x: 18, y: 9, dir: 'down', marker: () => !G.flag('c12_orders'), talk: async () => {
      if (G.flag('c12_orders')) { await say('zhugeliang', '东门出营，乘船直取赤壁。主公，诸位将军，此战定天下三分！'); return; }
      await ordersScene();
    } });
    m.npc({ id: 'inn12', spec: 'innkeeper', x: 8, y: 10, dir: 'down', talk: async () => {
      await say('innkeeper', '将军们辛苦，营中歇息片刻吧。', { name: '军需官' });
      await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
      const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
    } });
    m.npc({ id: 'shop12', spec: 'merchant', x: 28, y: 10, dir: 'down', talk: K.shopTalk('merchant', ['dahuan', 'shenghui', 'qiongjiang', 'tianzhong', 'xuming', 'jingliang', 'quanjun', 'jinsuo'], '军需', '江夏刘公子送来不少军资！', '军需官') });
    m.npc({ id: 'lq', spec: 'liubiao', x: 24, y: 15, dir: 'left', talk: K.talk([['liubiao', '叔父，琦愿率江夏之兵，随叔父同破曹贼！', { name: '刘琦' }]]) });
    return m;
  };

  async function ordersScene() {
    await G.lines([
      ['zhugeliang', '主公！亮已借得东风。今夜周郎便要放火——我军当在曹操败退之路上，处处设伏。'],
      ['zhugeliang', '子龙：你带三千军马，渡江径取乌林小路，拣树木芦苇密处埋伏。今夜四更以后，曹操必然从那条路奔走。'],
      ['zhaoyun', '得令！'],
      ['zhugeliang', '翼德：你领三千兵渡江，截断彝陵这条路，去葫芦谷口埋伏。曹操不敢走南彝陵，必望北彝陵去。来日雨过，必然来埋锅造饭。只看烟起，便就山边放起火来。'],
      ['zhangfei', '好！俺老张等这一天，等得手都痒了！'],
    ]);
    await G.narrate('孔明分拨已毕，却对关羽不理不睬。关羽忍耐不住——');
    await G.lines([
      ['guanyu', '关某自随兄长征战，许多年来，未尝落后。今日逢大敌，军师却不委用，此是何意？'],
      ['zhugeliang', '云长勿怪。某本欲烦足下把一个最紧要的隘口，怎奈有些违碍，不敢教去。'],
      ['guanyu', '有何违碍？'],
      ['zhugeliang', '昔日曹操待足下甚厚，足下当有以报之。今日曹操兵败，必走华容道——若令足下去时，必然放他过去。'],
      ['guanyu', '军师好心多！当日曹操果是重待某，某已斩颜良、诛文丑，解白马之围，报过他了。今日撞见，岂肯放过！'],
      ['zhugeliang', '倘若放了时，却如何？'],
      ['guanyu', '愿依军法！'],
    ]);
    await G.narrate('关羽立下军令状。孔明教他于华容小路高山之处，堆积柴草，放起一把火烟，引曹操来。');
    await G.lines([
      ['liubei', '军师，吾弟义气深重，若曹操果然投华容道去时，只恐端的放了。'],
      ['zhugeliang', '亮夜观乾象，操贼未合身亡。留这人情，教云长做了，亦是美事。'],
      ['zhugeliang', '主公与亮，且随周郎水军，先往赤壁助战——看那百万之众，化作飞灰。'],
    ]);
    G.setFlag('c12_orders');
    await G.notice('出东门登船，直取赤壁！\n（本章全军出战）');
  }

  /* ---------------- 赤壁 · 火烧连环船 ---------------- */
  B.c12chibi = () => {
    const m = new G.GameMap('c12chibi', '赤 壁', 60, 30, TL.WATER);
    Object.assign(m, { seed: 1221, music: 'boss', ambient: 'embers', dusk: true, battleBg: 'chibi', flowers: 0, pal: { gh: 30, gs: 30, gl: 22 } });
    m.rect(0, 12, 4, 7, TL.GRASS);   // 我方登船处（江心小洲）
    m.warp(0, 13, 1, 5, 'c12xiakou', 33, 14, 'left');
    // 连环船：从西到东，铁索相连
    const fleet = [[5, 12, 7, 6], [14, 6, 8, 6], [14, 18, 8, 6], [24, 12, 8, 6], [34, 5, 8, 6], [34, 19, 8, 6], [44, 11, 13, 8]];
    fleet.forEach(([x, y, w, h], i) => {
      const flag = i === 0 ? null : i === fleet.length - 1 ? '曹' : (i % 2 ? '曹' : null);
      K.ship(m, x, y, w, h, { dir: 'left', hull: i === 0 ? '#5a3a22' : '#3a3030', burnt: i > 0, sail: i === 0 ? '#c8b890' : '#5a5048', text: flag, tcol: '#24304a', burning: i > 0, mh: i === fleet.length - 1 ? 190 : 150 });
    });
    for (const p of m.props) if (p.type === 'mast' && p.burning) p.light = 190;
    const plank = (x0, y0, x1, y1) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) if (m.get(x, y0) === TL.WATER) m.set(x, y0, TL.BRIDGE); for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) if (m.get(x1, y) === TL.WATER) m.set(x1, y, TL.BRIDGE); };
    for (let x = 4; x < 5; x++) for (let y = 14; y < 17; y++) m.set(x, y, TL.BRIDGE);
    plank(12, 14, 17, 12); plank(12, 15, 17, 18);
    plank(22, 9, 27, 12); plank(22, 21, 27, 17);
    plank(32, 14, 37, 10); plank(32, 15, 37, 19);
    plank(42, 8, 48, 11); plank(42, 21, 48, 18);
    m.reserve(1, 13, 3, 5);
    m.npc({ id: 'sup12', spec: 'innkeeper', x: 1, y: 12, dir: 'down', talk: restTalk });
    K.deco(m, 'crates', 25, 13); K.deco(m, 'crates', 30, 16); K.deco(m, 'jar', 16, 7); K.deco(m, 'jar', 38, 23); K.deco(m, 'rack', 46, 12);
    K.guard(m, { id: 'n1', spec: 'caoshui', x: 17, y: 12, flag: 'c12_n1', group: ['caoshui2', 'caoshui2', 'caogong2'], lines: [['caoshui', '火、火船！是黄盖的诈降船！', { name: '曹军' }]] });
    K.guard(m, { id: 'n2', spec: 'caoshui', x: 27, y: 15, flag: 'c12_n2', group: ['caogong2', 'caogong2', 'caoshui2'], lines: [['caoshui', '铁索解不开！船分不开啊！', { name: '曹军' }]] });
    K.guard(m, { id: 'n3', spec: 'caoshui', x: 37, y: 8, flag: 'c12_n3', group: ['caoshui2', 'caoshui2', 'caoshui2'] });
    K.guard(m, { id: 'n4', spec: 'caoshui', x: 37, y: 21, flag: 'c12_n4', group: ['caogong2', 'caoshui2', 'caoshui2'] });
    m.npc({ id: 'yujin', spec: 'yujin', x: 49, y: 15, dir: 'left', aggro: true, cond: () => !G.flag('c12_yu'), talk: async () => {
      await G.lines([
        ['yujin', '水军都督于禁在此！丞相正在换船，谁敢上前！'],
        ['zhangfei', '换船？满江都是火，往哪里换！'],
        ['zhugeliang', '于禁，你看看四周。百万之众，灰飞烟灭——此乃天意！'],
      ]);
      const r = await G.battle(['yujin', 'caogong2', 'caoshui2'], { bg: 'chibi', boss: true, intro: '曹军水军都督 于禁 死守旗舰！' });
      if (r !== 'win') return;
      G.setFlag('c12_yu');
      await G.narrate('于禁大败，跳上小舟而走。曹操旗舰火光冲天，张辽驾小船，扶曹操下得船时，那只大船已自着了。');
      await G.narrate('江面上火逐风飞，一派通红，漫天彻地。');
      await G.lines([
        ['liubei', '……百万之众，竟一夜之间……'],
        ['zhugeliang', '曹操已从乌林登岸逃走。主公，我们去收网吧——子龙、翼德、云长，都在等他。'],
      ]);
      await say('guanyu', '大哥，军师，关某这便往华容道去了。');
      await G.fadeOut(0.8);
      G.stashParty(ALL.filter(id => id !== 'guanyu'));
      G.world.load('c12huarong', 3, 42, 'up');
      await G.fadeIn(0.8);
    } });
    m.npc({ id: 'hg12', spec: 'huanggai', x: 8, y: 14, dir: 'right', talk: K.talk([['huanggai', '哈哈哈！老夫这一百军棍，换曹贼百万大军——值！值！'], ['huanggai', '诸位将军，曹贼的旗舰就在最东头，快去！']]) });
    m.encounters = { rates: { [TL.FLOOR]: 0.02, [TL.BRIDGE]: 0.015 }, groups: NAVY };
    m.onEnter = async () => {
      if (G.flag('c12_cb')) return; G.setFlag('c12_cb');
      G.audio.sfx('fire'); G.shake(8, 0.8);
      await G.narrate('二更时分，东南风大起。黄盖二十只火船，借风直冲曹营——');
      await G.narrate('曹军战船被铁环锁住，无处逃避。隔江炮响，四下火船齐到，三江面上，火逐风飞。');
      await G.lines([
        ['zhaoyun', '好大的火……'],
        ['zhugeliang', '诸位，曹军旗舰就在东面。沿着铁索连环，杀过去！'],
      ]);
    };
    return m;
  };

  /* ---------------- 乌林 · 葫芦口 · 华容道 ---------------- */
  B.c12huarong = () => {
    const m = new G.GameMap('c12huarong', '乌林 · 华容道', 34, 46, TL.GRASS);
    Object.assign(m, { seed: 1241, music: 'field', ambient: 'leaves', leafColor: 'rgba(120,110,70,0.8)', battleBg: 'rain', flowers: 0.01, tint: 'rgba(30,30,60,0.22)', pal: { gh: 80, gs: 22, gl: 24 } });
    const pts = [[3, 46], [4, 38], [12, 34], [22, 30], [26, 22], [16, 16], [10, 10], [16, 4], [16, -1]];
    const clear = new Set();
    m.road(pts, 2.6, null, (x, y) => clear.add(x + ',' + y));
    m.road(pts, 0.8, TL.SOIL);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (!clear.has(x + ',' + y)) m.tree(x, y, G.hash(x, y, 3) < 0.16 ? 'rock' : G.hash(x, y, 4) < 0.6 ? 'dark' : 'pine');
    K.tallGrass(m, 1243, 0.5);
    K.deco(m, 'fire', 24, 24);   // 葫芦口：埋锅造饭
    m.reserve(2, 43, 3, 3);
    m.npc({ id: 'sup12b', spec: 'innkeeper', x: 5, y: 42, dir: 'left', talk: restTalk });
    K.guard(m, { id: 'h1', spec: 'caobing', x: 7, y: 36, flag: 'c12_h1', group: ['caobing5', 'caobing5', 'caoqi5'], lines: [['caobing', '快、快保护丞相！', { name: '曹军残兵' }]] });
    m.npc({ id: 'xuhuang', spec: 'xuhuang', x: 13, y: 33, dir: 'left', aggro: true, cond: () => !G.flag('c12_xu'), talk: async () => {
      await G.narrate('曹操行至乌林之西，见树木丛杂，山川险峻，乃于马上仰面大笑——');
      await say('caocao', '吾不笑别人，单笑周瑜无谋、诸葛亮少智。若是吾用兵之时，预先在这里伏下一军，如之奈何？');
      G.audio.sfx('gong');
      await G.lines([
        ['zhaoyun', '我赵子龙奉军师将令，在此等候多时了！'],
        ['xuhuang', '徐公明在此！丞相快走，这里交给我！'],
      ]);
      const r = await G.battle(['xuhuang', 'caoqi5', 'caobing5'], { bg: 'rain', boss: true, intro: '乌林伏兵！徐晃 拼死断后！' });
      if (r !== 'win') return;
      G.setFlag('c12_xu');
      await G.narrate('徐晃大败，曹操冒烟突火而去。天色微明，大雨倾盆，曹军衣甲皆湿。');
    } });
    K.guard(m, { id: 'h2', spec: 'caoqi', x: 21, y: 29, flag: 'c12_h2', group: ['caoqi5', 'caoqi5', 'caobing5'] });
    m.npc({ id: 'xuchu12', spec: 'xuchu', x: 25, y: 22, dir: 'down', aggro: true, cond: () => G.flag('c12_xu') && !G.flag('c12_xc'), talk: async () => {
      await G.narrate('行到葫芦口，曹军埋锅造饭，割马肉烧吃。曹操坐于疏林之下，又仰面大笑——');
      await say('caocao', '若是诸葛亮、周瑜在此处伏下一彪人马，以逸待劳，我等纵然脱得性命，也不免重伤矣。');
      G.audio.sfx('gong'); G.shake(10, 0.8);
      await G.lines([
        ['zhangfei', '燕人张翼德在此！曹贼哪里走！'],
        ['xuchu', '张飞！许褚在此，休伤丞相！'],
      ]);
      const r = await G.battle(['xuchu3', 'caoqi5', 'caoqi5'], { bg: 'rain', boss: true, intro: '葫芦口！许褚 骑无鞍马来战！' });
      if (r !== 'win') return;
      G.setFlag('c12_xc');
      await G.narrate('许褚大败而走。曹操丢盔弃甲，众将各带伤，只剩下三百余骑。');
    } });
    K.guard(m, { id: 'h3', spec: 'caobing', x: 14, y: 15, flag: 'c12_h3', cond: () => G.flag('c12_xc'), group: ['caobing5', 'caobing5', 'caobing5'] });
    m.npc({ id: 'gy12', spec: 'guanyu', x: 16, y: 5, dir: 'down', cond: () => G.flag('c12_xc'), marker: () => !G.flag('c12_hr') });
    m.npc({ id: 'cc12', spec: 'caocao', x: 16, y: 7, dir: 'up', aggro: true, cond: () => G.flag('c12_xc') && !G.flag('c12_hr'), talk: huarongScene });
    for (const [x, y] of [[15, 8], [17, 8]]) m.npc({ id: 'ccs' + x, spec: 'caobing', x, y, dir: 'up', cond: () => G.flag('c12_xc') && !G.flag('c12_hr') });
    m.npc({ id: 'zl12', spec: 'zhangliao', x: 16, y: 9, dir: 'up', cond: () => G.flag('c12_xc') && !G.flag('c12_hr') });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.06, [TL.SOIL]: 0.012 }, groups: ROUT };
    m.onEnter = async () => {
      if (G.flag('c12_hr_in')) return; G.setFlag('c12_hr_in');
      await G.lines([
        ['zhugeliang', '这里便是乌林。曹操必从此路往北逃窜，经葫芦口，取华容道回江陵。'],
        ['liubei', '跟上去！'],
      ]);
    };
    return m;
  };

  async function huarongScene() {
    await G.narrate('曹操行至华容道，人皆饥倒，马尽困乏。焦头烂额者扶策而行，中箭着枪者勉强而走。');
    await say('caocao', '（又于马上扬鞭大笑）人皆言周瑜、诸葛亮足智多谋，以吾观之，到底是无能之辈。若使此处伏一旅之师，吾等皆束手受缚矣。');
    G.audio.sfx('gong');
    await G.narrate('言未毕，一声炮响，两边五百校刀手摆开——为首大将关云长，提青龙刀，跨赤兔马，截住去路。');
    await G.lines([
      ['caocao', '……既到此处，只得决一死战。'],
      ['zhangliao', '人纵然不怯，马力已乏，安能复战？'],
      ['caocao', '（纵马向前，欠身）将军别来无恙！'],
      ['guanyu', '关某奉军师将令，等候丞相多时。'],
      ['caocao', '曹操兵败势危，到此无路，望将军以昔日之情为重。'],
      ['guanyu', '昔日关某虽蒙丞相厚恩，然已斩颜良、诛文丑，解白马之危，以奉报矣。今日之事，岂敢以私废公？'],
      ['caocao', '五关斩将之时，还能记否？大丈夫以信义为重。将军深明《春秋》，岂不知庾公之斯追子濯孺子之事乎？'],
    ]);
    await G.narrate('关羽是个义重如山之人，想起当日曹操许多恩义，与后来五关斩将之事，如何不动心？又见曹军惶惶，皆欲垂泪……');
    const k = await G.choose(['……把马头勒回', '军令如山，拿下曹操'], { x: G.W / 2 - 150, w: 300 });
    if (k === 1) {
      await say('guanyu', '曹操！今日——');
      await G.narrate('关羽举刀，正要喝令左右动手，却见曹军中张辽、许褚等皆下马，哭拜于地。关公愈加不忍。');
    }
    await say('guanyu', '（长叹一声）……四散摆开。');
    await G.narrate('曹操见云长回马，便和众将一齐冲将过去。云长回身时，曹操已与众将过去了。');
    await G.narrate('云长大喝一声，众军皆下马，哭拜于地。云长愈加不忍。正犹豫间，张辽纵马而至。云长见了，又动故旧之情，长叹一声，并皆放去。');
    G.setFlag('c12_hr');
    await G.fadeOut(1.0);
    G.unstash(['guanyu']);
    G.state.party = ALL.filter(id => G.state.party.includes(id));
    G.world.refreshParty();
    await G.narrate('后人有诗曰：曹瞒兵败走华容，正与关公狭路逢。只为当初恩义重，放开金锁走蛟龙。');
    await G.narrate('——夏口营中。');
    await G.fadeIn(0.8);
    await G.lines([
      ['zhugeliang', '且喜将军立此盖世之功，与普天下除大害。——云长为何不乐？'],
      ['guanyu', '关某特来请死。'],
      ['zhugeliang', '莫非曹操不曾投华容道上来？'],
      ['guanyu', '是从那里来。关某无能，因此被他走脱。'],
      ['zhugeliang', '此是云长想曹操昔日之恩，故意放了。但既有军令状在此，不得不按军法——左右，推出斩了！'],
      ['liubei', '昔吾三人结义时，誓同生死。今云长虽犯法，不忍违却前盟。望权记过，容将功赎罪！'],
      ['zhugeliang', '……既主公求情，权且记下。'],
    ]);
    await G.chapterEnd(G.CHAPTERS[12].endLines);
  }

  G.CHAPTERS[12] = {
    title: '赤壁',
    prologue: [
      '东南风起，七星坛上旗幡西北飘。',
      '诸葛亮乘赵云小舟，回到夏口刘备营中。',
      '是夜，周瑜与程普、黄盖、甘宁、吕蒙诸将，分拨已定。',
      '长江之上，曹营灯火连绵三百里，',
      '谁也不知道，这将是它最后一夜。',
    ],
    start: async () => {
      G.unstash(ALL);
      G.state.party = ALL.filter(id => G.state.party.includes(id));
      G.restoreAll();
      const w = G.world;
      w.load('c12xiakou', 18, 12, 'up');
      await G.fadeIn(1.2);
      await G.lines([
        ['liubei', '军师！你可回来了！'],
        ['zhugeliang', '主公，且休问别事。亮前者所约军马、战船，皆已办否？'],
        ['liubei', '收拾久矣，只候军师调用。'],
      ]);
    },
    endLines: [
      '赤壁一把火，烧尽曹操八十三万大军。',
      '曹操败回北方，从此不敢轻言南下。',
      '周瑜乘胜进攻南郡，与曹仁血战经年。',
      '诸葛亮却趁乱取了南郡、荆州、襄阳，',
      '又对刘备说："荆州南面，尚有武陵、长沙、桂阳、零陵四郡——可以取之，以为根本。"',
    ],
  };
})();
