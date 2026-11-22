/* ============================================================
 * 烽烟录 · 第十章　长坂坡（赵云单骑救主，第二部完）
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  Object.assign(G.ENEMIES, {
    zhuibing: { name: '曹军追兵', hp: 760, str: 136, int: 30, spd: 74, def: 92, exp: 380, gold: 120, spec: 'caobing' },
    zhuiqi: { name: '虎豹骑', hp: 860, str: 142, int: 30, spd: 92, def: 96, exp: 420, gold: 130, skills: ['chongfeng'], skillRate: 0.3, spec: 'caoqi' },
  });
  G.ENEMIES.xiahouen.hp = 4200;
  Object.assign(G.ENEMIES.zhanghe, { hp: 6000, str: 134, fleeAt: 0.4 });
  const GROUPS = [{ e: ['zhuibing'], w: 3 }, { e: ['zhuiqi'], w: 2 }, { e: ['zhuibing', 'zhuibing'], w: 2 }, { e: ['zhuibing', 'zhuiqi'], w: 1 }];

  B.c10changban = () => {
    const m = new G.GameMap('c10changban', '当阳 · 长坂坡', 60, 40, TL.GRASS);
    Object.assign(m, { seed: 1001, music: 'boss', ambient: 'leaves', leafColor: 'rgba(200,170,90,0.8)', pal: { gh: 60, gs: 32, gl: 30 }, battleBg: 'autumn', flowers: 0.02 });
    K.tallGrass(m, 1003, 0.52);
    m.road([[56, -1], [55, 10], [56, 20], [55, 30], [56, 41]], 1.4, TL.WATER);
    m.road([[0, 20.5], [14, 20.5], [24, 14], [34, 18], [44, 20], [52, 20]], 0.75, TL.PATH);
    for (let x = 52; x < 60; x++) { if (m.get(x, 20) === TL.WATER) m.set(x, 20, TL.BRIDGE); else m.set(x, 20, TL.PATH); }
    m.road([[24, 14], [27, 8]], 0.6, TL.PATH);
    m.prop('well', 28, 6, 1, 1, { foot: [28, 6, 1, 1] });
    m.prop('house', 30, 3, 5, 4, { roof: '#4a3b36', lantern: false, wall: '#b8aa88' });
    for (const [x, y] of [[10, 16], [20, 24], [38, 24], [45, 14], [33, 12]]) K.deco(m, 'cart', x, y, { w: 2 });
    for (const [x, y] of [[16, 25], [40, 12], [48, 26]]) K.deco(m, 'flag', x, y, { text: '曹', color: '#2f4a7a', tcol: '#f6e7c1' });
    for (let x = 0; x < 54; x += 3) { K.mountain(m, x, 0); K.mountain(m, x, 38); }
    m.reserve(57, 17, 3, 7);
    K.forest(m, { seed: 1011, thr: 0.66, kinds: ['gold', 'tree', 'dark'] });
    // 逃难百姓
    const folk = [['farmer', 6, 18], ['woman', 12, 23], ['oldman', 18, 17], ['child', 22, 22], ['farmer', 30, 21], ['woman', 36, 15], ['oldman', 42, 23]];
    folk.forEach(([s, x, y], i) => m.npc({ id: 'folk' + i, spec: s, x, y, wander: 2, talk: K.talk([[s, G.pick(['刘皇叔不肯丢下我们……可曹兵追上来了！', '我的孩子……谁看见我的孩子了？', '快跑啊，虎豹骑来了！', '听说赵将军回头去找小主人了，真是忠臣啊。'])]]) }));
    m.npc({ id: 'jy10', spec: 'jianyong', x: 9, y: 22, dir: 'up', cond: () => !G.flag('c10_jy'), marker: () => true, talk: async () => {
      await G.lines([
        ['jianyong', '子龙……我中了一枪，不碍事……'],
        ['jianyong', '两位夫人和小主人，都在乱军里走散了。有人看见糜夫人抱着阿斗，往北边那片土墙去了……'],
        ['zhaoyun', '宪和先生保重！子龙便是寻遍长坂，也要找回小主人！'],
      ]);
      G.setFlag('c10_jy');
    } });
    m.npc({ id: 'mi', spec: 'madame', x: 29, y: 7, dir: 'down', cond: () => !G.flag('c10_adou'), marker: () => true, talk: async () => {
      await G.lines([
        ['madame', '……赵将军？', { name: '糜夫人' }],
        ['zhaoyun', '夫人！子龙之罪也！请夫人上马，子龙步行死战，保夫人透出重围！'],
        ['madame', '妾身负重伤，死何足惜。此子全赖将军保护，皇叔半世飘零，只有这点骨血。', { name: '糜夫人' }],
        ['madame', '将军若带上我，便多一个累赘……将军，保重！', { name: '糜夫人' }],
      ]);
      G.audio.sfx('down');
      await G.narrate('糜夫人将阿斗放在地上，翻身投入枯井而死。');
      await G.narrate('赵云恐曹军盗尸，推倒土墙，掩盖枯井。解开勒甲绦，放下掩心镜，将阿斗抱护在怀，绰枪上马。');
      await say('zhaoyun', '小主人，子龙带你回去。');
      G.setFlag('c10_adou');
      await G.notice('救出阿斗！\n往东杀出重围，回到长坂桥。');
    } });
    K.guard(m, { id: 'xhe', spec: 'xiahouen', x: 24, y: 13, flag: 'c10_sword', group: ['xiahouen', 'zhuibing'], party: ['zhaoyun'], bg: 'autumn', boss: true, intro: '曹操背剑之将 夏侯恩！',
      lines: [['xiahouen', '哪里来的白袍小将，也敢在丞相的大军里横冲直撞！'], ['zhaoyun', '常山赵子龙在此！']],
      after: async () => {
        G.state.members.zhaoyun.wbonus = 40;
        await G.narrate('赵云一枪刺夏侯恩落马，夺得一口宝剑，剑把上用金嵌"青釭"二字——此乃曹操宝剑，砍铁如泥，锋利无比。');
        G.audio.sfx('levelup');
        await G.notice('夺得 青釭剑！\n赵云攻击大幅提升。');
      } });
    m.npc({ id: 'zhanghe', spec: 'zhanghe', x: 44, y: 20, dir: 'left', aggro: true, cond: () => G.flag('c10_adou') && !G.flag('c10_zh'), talk: async () => {
      await G.lines([['zhanghe', '河间张郃在此！放下怀中婴孩，饶你不死！'], ['zhaoyun', '要小主人，先问我手中的枪！']]);
      const r = await G.battle(['zhanghe'], { bg: 'autumn', boss: true, party: ['zhaoyun'], intro: '张郃 拦截！' });
      if (r !== 'win') return;
      G.setFlag('c10_zh');
      await G.narrate('赵云纵马一跃，跳出土坑，杀透重围。曹操在景山顶上望见，急问左右："此人何人？"');
      await G.narrate('曹洪答曰："常山赵子龙也。"曹操叹道："真虎将也！吾当生致之。"——遂传令：不许放冷箭，只要捉活的。');
    } });
    m.npc({ id: 'zf10', spec: 'zhangfei', x: 57, y: 20, dir: 'left', marker: () => G.flag('c10_zh'), talk: async () => {
      if (!G.flag('c10_adou')) { await say('zhangfei', '子龙！你怎么一个人回来了？小主人呢？！'); return; }
      if (!G.flag('c10_zh')) { await say('zhangfei', '子龙快走！后面追兵俺来挡！'); return; }
      await bridgeScene();
    } });
    m.encounters = { rates: { [TL.GRASS]: 0.03, [TL.TALL]: 0.07, [TL.PATH]: 0.012 }, groups: GROUPS };
    return m;
  };

  async function bridgeScene() {
    await G.lines([
      ['zhaoyun', '翼德援我！'],
      ['zhangfei', '子龙速行，追兵我自当之！'],
    ]);
    await G.narrate('张飞令二十余骑砍下树枝，拴在马尾，在树林内往来驰骋，冲起尘土，以为疑兵。自己横矛立马于桥上。');
    G.audio.sfx('gong'); G.shake(12, 1.0);
    await say('zhangfei', '燕人张翼德在此！谁敢与我决一死战？！');
    G.shake(12, 1.0);
    await say('zhangfei', '燕人张翼德在此！谁敢与我决一死战？！');
    G.shake(16, 1.2);
    await say('zhangfei', '战又不战，退又不退，却是何故！');
    await G.narrate('喊声未绝，曹操身边夏侯杰惊得肝胆碎裂，倒撞于马下。曹操回马便走，众军一齐望西奔走，人如潮涌，马似山崩，自相践踏。');
    await G.fadeOut(1.0);
    G.unstash(['liubei', 'guanyu', 'zhangfei', 'jianyong', 'zhugeliang']);
    G.state.party = ['liubei', 'guanyu', 'zhangfei', 'zhaoyun', 'jianyong', 'zhugeliang'].filter(id => G.state.party.includes(id));
    G.world.refreshParty();
    await G.fadeIn(1.0);
    await G.lines([
      ['zhaoyun', '赵云之罪，万死犹轻！糜夫人身带重伤，不肯上马，投井而死，云只得推土墙掩之。怀抱公子，身突重围——'],
      ['zhaoyun', '……适来公子尚在怀中啼哭，此一会不见动静，多是不能保也。'],
    ]);
    await G.narrate('赵云解视，原来阿斗正睡着未醒。赵云双手递给刘备。');
    await G.narrate('刘备接过，掷之于地：');
    await say('liubei', '为汝这孺子，几损我一员大将！');
    await G.narrate('赵云忙向地下抱起阿斗，泣拜曰：');
    await say('zhaoyun', '云虽肝脑涂地，不能报也！');
    await G.chapterEnd(G.CHAPTERS[10].endLines);
  }

  G.CHAPTERS[10] = {
    title: '长坂坡',
    prologue: [
      '建安十三年，曹操亲率五十万大军南下。刘琮举荆州而降。',
      '刘备弃新野、走樊城，荆襄百姓扶老携幼，十余万人追随不舍。',
      '刘备不忍抛弃百姓，日行十余里。',
      '至当阳长坂，曹军精骑追至，刘备大败，妻小失散。',
      '赵云杀出重围，回头一看——主公的家眷，不见了。',
    ],
    start: async () => {
      G.stashParty(['zhaoyun']);
      G.restoreAll();
      const w = G.world;
      w.load('c10changban', 3, 20, 'right');
      await G.fadeIn(1.2);
      await G.lines([
        ['zhaoyun', '……主公将甘、糜二夫人与小主人阿斗托付于我，今日军中失散，有何面目去见主公！'],
        ['zhaoyun', '不如去决一死战，好歹要寻主母与小主人下落！'],
      ]);
      await G.notice('本章只有赵云一人出战。\n「突阵」「七进七出」可连续出枪；找到糜夫人与阿斗，杀回长坂桥。');
    },
    endLines: [
      '赵云单骑救主，七进七出，斩曹营名将五十余员，威震长坂。',
      '张飞据水断桥，一声断喝，喝退曹操百万之众。',
      '刘备退至夏口，与刘琦合兵。',
      '诸葛亮对刘备说："事急矣，请奉命求救于孙将军。"',
      '一叶扁舟，载着卧龙，向江东驶去。',
      '赤壁的东风，即将吹起……',
      '（第二部　完）',
    ],
  };
})();
