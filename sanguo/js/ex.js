/* ============================================================
 * 烽烟录 · 番外　桃园一梦
 * 通关「全剧终」后解锁。白帝城中，刘备昏昏睡去，梦回桃园——
 * 全员重聚（点将台自选六人出阵）→ 擂台重逢五位宿敌 → 两段「如果」→ 五件旧物 → 天命
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL, B = G.MAP_BUILDERS, K = G.kit, say = (...a) => G.say(...a);
  const EX = 99, LV = 72, UNLOCK_KEY = 'fengyan_ex_unlocked';
  const SHOP = ['shenyao', 'lingzhi', 'hanjia', 'jiuzhuan', 'xuming', 'qianjin'];
  const START_PARTY = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'pangtong'];

  /* ---------------- 解锁（存在浏览器里，与存档无关） ---------------- */
  G.exUnlocked = () => { try { return localStorage.getItem(UNLOCK_KEY) === '1'; } catch (e) { return false; } };
  G.exUnlock = () => { try { localStorage.setItem(UNLOCK_KEY, '1'); } catch (e) { /* 隐私模式：本次会话内仍可从章节选择进入 */ } G._exUnlocked = true; };
  G.EX_CHAPTER = EX;
  G.chLabel = n => (n === EX ? '番外' : `第${G.CN[n] || n}章`);

  /* ---------------- 数据：天命、墨影、梦中宿敌 ---------------- */
  Object.assign(G.SPECS, {
    tianming: { skin: '#d8d4cc', hair: '#0a0a0a', robe: '#141414', robe2: '#4a4a4a', trim: '#8a8a8a', pants: '#0a0a0a', hat: 'crown', hatColor: '#0a0a0a', beard: 'long', beardColor: '#2a2a2a', cape: '#000000', weapon: 'sword', size: 1.4, banner: '#1b1714', flag: '命', noBlush: true },
    moying: { skin: '#9a9690', hair: '#0a0a0a', robe: '#2a2a2a', robe2: '#5a5a5a', trim: '#7a7a7a', pants: '#121212', hat: 'helmet', hatColor: '#1a1a1a', plume: '#3a3a3a', armor: '#3a3a3a', weapon: 'spear', banner: '#2a2a2a', flag: '墨', noBlush: true },
    shuoshu: { skin: '#e8c4a0', hair: '#d8d4cc', robe: '#6a4a2a', robe2: '#e8dcc0', trim: '#c9a24a', pants: '#3a2a1a', hat: 'scholar', hatColor: '#2a2018', beard: 'long', beardColor: '#e6e2da', weapon: 'fan', banner: '#6a4a2a' },
  });
  Object.assign(G.NAMES, { tianming: '天命', moying: '墨影', shuoshu: '说书人' });
  G.SKILLS.tianming = { name: '天命难违', type: 'fire', target: 'enemies', pow: 1.9 };
  G.SKILLS.mobi = { name: '泼墨', type: 'phys', target: 'enemies', pow: 1.0 };
  const E = o => o;
  Object.assign(G.ENEMIES, {
    mz_huangjin: E({ name: '梦中黄巾', hp: 4600, str: 250, int: 60, spd: 92, def: 160, exp: 1200, gold: 400, skills: ['yaohuo'], skillRate: 0.3, spec: 'yshushi' }),
    mz_zhangbao: E({ name: '张宝', hp: 38000, str: 248, int: 100, spd: 94, def: 158, exp: 12000, gold: 5000, skills: ['huangtian', 'yaohuo', 'nuhou'], skillRate: 0.45, boss: true, spec: 'zhangbao' }),
    mz_lubu: E({ name: '吕布', hp: 30000, str: 268, int: 50, spd: 108, def: 164, exp: 14000, gold: 6000, skills: ['wushuang2', 'hengsao', 'nuhou'], skillRate: 0.45, boss: true, spec: 'lubu' }),
    mz_zhouyu: E({ name: '周瑜', hp: 44000, str: 246, int: 120, spd: 100, def: 160, exp: 14000, gold: 6000, skills: ['huozhen', 'jiantu', 'nuhou'], skillRate: 0.5, boss: true, spec: 'zhouyu' }),
    mz_caocao: E({ name: '曹操', hp: 50000, str: 252, int: 110, spd: 98, def: 164, exp: 16000, gold: 7000, skills: ['huozhen', 'luanjian', 'nuhou'], skillRate: 0.45, boss: true, spec: 'caocao' }),
    mz_simayi: E({ name: '司马懿', hp: 56000, str: 248, int: 124, spd: 102, def: 166, exp: 18000, gold: 8000, skills: ['zhongda', 'luanjian', 'nuhou'], skillRate: 0.5, boss: true, spec: 'simayi' }),
    moying: E({ name: '墨影', hp: 5200, str: 256, int: 80, spd: 100, def: 166, exp: 1500, gold: 500, skills: ['mobi'], skillRate: 0.3, ink: true }),
    tianming: E({ name: '天命', hp: 110000, str: 262, int: 130, spd: 104, def: 170, exp: 30000, gold: 0, skills: ['tianming', 'zhongda', 'wushuang2', 'nuhou'], skillRate: 0.5, boss: true, ink: true }),
  });

  /* ---------------- 战斗背景：梦中桃源 ---------------- */
  G.art.BG.dream = { peaks: true, sky: ['#3a2a4a', '#b87a9a', '#f4d0c8'], sun: [700, 110, 26, '#fff4ec', 'rgba(255,230,230,0.6)'], cloud: 'rgba(255,236,240,0.5)', rock: ['#9a7a8e', '#7a5a70', '#4a3448'], mist: 'rgba(255,220,230,0.6)', ground: ['#8a6a6a', '#3a2832'], tree: '#d86a8a' };
  G.art.BG.inkvoid = { peaks: true, sky: ['#cfc6b4', '#e2dac8', '#efe8d8'], sun: [480, 110, 34, '#1a1816', 'rgba(20,18,16,0.35)'], cloud: 'rgba(40,36,32,0.22)', rock: ['#a49c8c', '#5e5850', '#24221e'], mist: 'rgba(240,234,220,0.75)', ground: ['#b8b0a0', '#6a6458'], tree: '#1a1816' };

  /* ---------------- 旧物（地图道具，拾起后消失） ---------------- */
  const RELICS = [
    { id: 'exr1', x: 4, y: 4, name: '青龙偃月刀', who: 'guanyu', line: '……八十二斤。还是这个分量。' },
    { id: 'exr2', x: 36, y: 3, name: '丈八蛇矛', who: 'zhangfei', line: '嘿！俺的老伙计！当阳桥上就是你陪俺吼的！' },
    { id: 'exr3', x: 3, y: 20, name: '白羽扇', who: 'zhugeliang', line: '（轻摇）……隆中的风，原来是这个味道。' },
    { id: 'exr4', x: 26, y: 28, name: '青釭剑', who: 'zhaoyun', line: '长坂坡上，七进七出。主公，阿斗如今可好？' },
    { id: 'exr5', x: 36, y: 18, name: '雌雄双股剑', who: 'liubei', line: '涿县铁匠铺打的那一对……那年，我们都还年轻。' },
  ];
  const relicCount = () => RELICS.filter(r => G.flag(r.id)).length;
  const T = G.T;
  const baseDraw = G.art.drawProp;
  G.art.drawProp = function (c, p, t) {
    if (p.type !== 'relic') return baseDraw(c, p, t);
    const x = p.x * T + T / 2, y = p.y * T + T / 2, tt = G.time || 0, bob = Math.sin(tt * 3 + p.x) * 3;
    const g = c.createRadialGradient(x, y - 6 + bob, 0, x, y - 6 + bob, 26);
    g.addColorStop(0, 'rgba(255,240,200,0.9)'); g.addColorStop(0.35, 'rgba(255,200,150,0.45)'); g.addColorStop(1, 'rgba(255,180,160,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y - 6 + bob, 26, 0, G.TAU); c.fill();
    for (let i = 0; i < 4; i++) { const a = tt * 2 + i * Math.PI / 2; c.fillStyle = 'rgba(255,250,235,0.85)'; c.fillRect(x + Math.cos(a) * 12 - 1, y - 6 + bob + Math.sin(a) * 6 - 1, 2.5, 2.5); }
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.ellipse(x, y + 10, 9, 3, 0, 0, G.TAU); c.fill();
  };

  /* ---------------- 地图：梦中桃园 ---------------- */
  B.exdream = () => {
    const m = new G.GameMap('exdream', '桃 园 · 梦', 40, 32, TL.GRASS);
    Object.assign(m, { seed: 9901, music: 'title', ambient: 'petals', flowers: 0.14, tint: 'rgba(255,170,190,0.10)', battleBg: 'dream' });
    m.prop('pavilion', 16, 2, 7, 5, { foot: [17, 4, 5, 3] });
    m.road([[19.5, 31], [19.5, 7]], 1, TL.PATH);
    m.road([[5, 16.5], [34, 16.5]], 0.7, TL.PATH);
    m.road([[31.5, 16], [31.5, 13]], 0.6, TL.PATH);
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (((x - 9) / 4.2) ** 2 + ((y - 25) / 2.6) ** 2 < 1) m.set(x, y, TL.WATER);
    m.rect(34, 21, 4, 8, TL.WATER);
    // 五丈原的七星灯（梦里搬来了桃园）
    m.prop('lamps', 3, 8, 9, 6, { nofoot: true, sortBias: -40000 });
    // 擂台
    K.stakeRing(m, 27, 6, 35, 13, [[30, 13, 3, 1]]);
    for (const [x, y] of [[26, 6], [36, 6]]) K.deco(m, 'flag', x, y, { text: '擂', color: '#8a1e1e', tcol: '#f6e7c1' });
    for (const r of RELICS) { m.reserve(r.x, r.y); m.prop('relic', r.x, r.y, 1, 1, { foot: [r.x, r.y, 1, 1], cond: () => !G.flag(r.id) }); }
    m.reserve(17, 7, 5, 2); m.reserve(18, 26, 4, 5); m.reserve(28, 7, 7, 6);
    // 桃林
    for (let x = 0; x < m.w; x++) for (const y of [0, 1, 30, 31]) if (!(y >= 30 && x >= 18 && x <= 21)) m.tree(x, y, G.hash(x, y, 1) < 0.85 ? 'peach' : 'tree');
    for (let y = 2; y < 30; y++) for (const x of [0, 1, 38, 39]) m.tree(x, y, G.hash(x, y, 2) < 0.85 ? 'peach' : 'tree');
    for (let y = 2; y < 30; y++) for (let x = 2; x < 38; x++) if (G.hash(x, y, 3) < 0.13) m.tree(x, y, 'peach');
    m.warp(18, 31, 4, 1, 'exdream', 19, 29, 'up', () => false, '桃林之外，白雾茫茫。梦，还没有做完。');

    m.npc({ id: 'ex_shuoshu', spec: 'shuoshu', x: 22, y: 27, dir: 'left', marker: () => !G.flag('ex_intro'), talk: storyteller });
    m.npc({ id: 'ex_jy', spec: 'jianyong', x: 16, y: 20, dir: 'right', marker: () => !G.flag('ex_picked'), talk: pickParty });
    m.npc({ id: 'ex_inn', spec: 'servant', x: 23, y: 20, dir: 'left', talk: async () => {
      const k = await G.choose(['休整', '补给军资', '不用了']);
      if (k === 0) {
        await say('servant', '三爷庄上的酒，管够！', { name: '庄客' });
        await G.fadeOut(0.5); G.restoreAll(); G.audio.sfx('heal'); await G.wait(0.6); await G.fadeIn(0.5);
        const s = await G.choose(['记录进度', '不用了']); if (s === 0) await G.saveMenu();
      } else if (k === 1) await G.shop(SHOP, '梦中集市');
    } });
    // 擂台：主持 + 当前一轮的宿敌站在台上
    m.npc({ id: 'ex_host', spec: 'oldman', x: 31, y: 15, dir: 'down', marker: () => round() < ROUNDS.length, talk: arena });
    ROUNDS.forEach((r, i) => m.npc({ id: 'ex_r' + i, spec: r.spec, x: 31, y: 9, dir: 'down', cond: () => round() === i, marker: () => true, talk: arena }));
    // 如果·荆州：吕蒙白衣渡江
    m.npc({ id: 'ex_lm', spec: 'lvmeng', x: 32, y: 24, dir: 'right', cond: () => !G.flag('ex_w1'), marker: () => true, talk: whatIfJingzhou });
    // 如果·五丈原：孔明守灯
    m.npc({ id: 'ex_zgl', spec: 'zhugeliang', x: 13, y: 11, dir: 'left', marker: () => !G.flag('ex_w2'), talk: whatIfWuzhang });
    // 天命：擂台打完后出现在结义亭前
    m.npc({ id: 'ex_tm', spec: 'tianming', x: 19, y: 8, dir: 'down', aggro: true, cond: () => round() >= ROUNDS.length && !G.flag('ex_end'), marker: () => true, talk: finale });
    for (const r of RELICS) m.event({ type: 'inspect', x: r.x, y: r.y, w: 1, h: 1, cond: () => !G.flag(r.id), run: () => pickRelic(r) });
    return m;
  };

  /* ---------------- 说书人 ---------------- */
  async function storyteller() {
    if (!G.flag('ex_intro')) {
      await G.lines([
        ['shuoshu', '（醒木一拍）列位看官！今日这一回，书上可没有——'],
        ['shuoshu', '桃园里搭了个擂台，当年的老对头们，都在台下候着呢。'],
        ['shuoshu', '东边擂台，西边七星灯，东南渡口还有一位白衣客。林子里么，散落着五件旧物，捡着了，还给它们的主人。'],
        ['shuoshu', '上阵之前，记得找简雍点将——梦里人多，一回只能上六个。'],
      ]);
      G.setFlag('ex_intro');
      return;
    }
    const n = relicCount();
    await say('shuoshu', round() < ROUNDS.length ? `擂台已过 ${round()} 阵，还剩 ${ROUNDS.length - round()} 阵。旧物寻得 ${n} / 5。` : `擂台打完了。结义亭那边……好像有什么东西醒了。旧物寻得 ${n} / 5。`);
  }

  /* ---------------- 点将台 ---------------- */
  const allHeroes = () => Object.keys(G.HEROES).filter(id => G.state.members[id]);
  async function pickParty() {
    if (!G.flag('ex_picked')) { await say('jianyong', '主公，梦里人多，帐下站不下。点哪六位上阵，您说了算。'); G.setFlag('ex_picked'); }
    const s = G.state, all = allHeroes();
    let sel = s.party.slice(), idx = 0;
    for (;;) {
      const items = all.map(id => ({ label: G.HEROES[id].name, right: sel.includes(id) ? '出阵' : '' })).concat([{ label: '—— 点将完毕 ——' }]);
      const k = await G.menu({ title: `点将（${sel.length} / 6）`, w: 560, center: true, y: 14, rows: 7, rowH: 34, items, idx,
        desc: i => (i < all.length ? `${G.HEROES[all[i]].title}　·　${G.HEROES[all[i]].bio}` : '确认出阵名单。') });
      if (k < 0 || k === all.length) break;
      idx = k;
      const id = all[k];
      if (sel.includes(id)) { if (sel.length > 1) sel = sel.filter(x => x !== id); }
      else if (sel.length < 6) sel.push(id);
      else G.audio.sfx('cancel');
    }
    s.party = sel; s.stash = all.filter(id => !sel.includes(id));
    G.restoreAll(); G.world.refreshParty();
    await say('jianyong', `${sel.map(id => G.HEROES[id].name).join('、')}——出阵！`);
  }

  /* ---------------- 擂台：五位宿敌 ---------------- */
  const ROUNDS = [
    { spec: 'zhangbao', foes: ['mz_zhangbao', 'mz_huangjin', 'mz_huangjin'], intro: '第一阵 · 张宝',
      pre: [['zhangbao', '黄天当立！……咦，这是何处？我不是早死在曲阳了么？'], ['zhangfei', '管你死没死，再吃俺一矛！']],
      post: [['zhangbao', '……原来是梦。也好，梦里的黄天，总算立过一回。']] },
    { spec: 'lubu', foes: ['mz_lubu'], intro: '第二阵 · 吕布',
      pre: [['lubu', '这回没有赤兔，咱们再比一场！'], ['zhangfei', '三姓家奴！今天俺一个人就够了！'], ['guanyu', '三弟，说好了，一起上。'], ['lubu', '……你们刘家人，还是喜欢三个打一个。']],
      post: [['lubu', '痛快！虎牢关那一回，我其实也没输。'], ['zhangfei', '行行行，算你没输。']] },
    { spec: 'zhouyu', foes: ['mz_zhouyu', 'mz_huangjin'], intro: '第三阵 · 周瑜',
      pre: [['zhouyu', '诸葛亮！既生瑜，何生——'], ['zhugeliang', '（摇扇）公瑾，梦里就别说这一句了。'], ['zhouyu', '……也罢。那便以琴为号，战个痛快！']],
      post: [['zhouyu', '曲有误，周郎顾。……这一曲，你们弹对了。']] },
    { spec: 'caocao', foes: ['mz_caocao', 'mz_huangjin', 'mz_huangjin'], intro: '第四阵 · 曹操',
      pre: [['caocao', '玄德，可还记得青梅煮酒？今天下英雄，惟使君与操耳！'], ['liubei', '孟德兄，这一回，我不必再假装掉筷子了。']],
      post: [['caocao', '哈哈哈哈！好！宁教我负天下人——算了，梦里不说这个。来，喝酒！']] },
    { spec: 'simayi', foes: ['mz_simayi', 'mz_huangjin', 'mz_huangjin'], intro: '第五阵 · 司马懿',
      pre: [['simayi', '孔明，这一回，你那座空城，我可要进去看看了。'], ['zhugeliang', '仲达请。城里只有两个扫地的老兵，和一张琴。'], ['simayi', '……（迟疑良久）罢了，还是打一场实在的。']],
      post: [['simayi', '老夫赢了天下，却总觉得……没赢过你。'], ['zhugeliang', '仲达，天下是你的。这一场，是我们的。']] },
  ];
  const round = () => G.state.flags.ex_round || 0;
  async function arena() {
    const i = round();
    if (i >= ROUNDS.length) { await say('oldman', '擂台散了。诸位英雄，去结义亭看看吧。', { name: '擂主' }); return; }
    const r = ROUNDS[i];
    await say('oldman', `${r.intro}！诸位准备好了么？`, { name: '擂主' });
    if ((await G.choose(['上擂台', '再等等'])) !== 0) return;
    await G.lines(r.pre);
    const res = await G.battle(r.foes, { bg: 'dream', boss: true, intro: r.intro });
    if (res !== 'win') return;
    await G.lines(r.post);
    G.state.flags.ex_round = i + 1;
    G.restoreAll();
    if (i + 1 < ROUNDS.length) await G.notice(`擂台 ${i + 1} / ${ROUNDS.length}　胜！\n（兵力、策略已恢复）`);
    else {
      G.setFlag('ex_arena');
      await G.narrate('五阵打完，台下的老对头们一个个散成了桃花瓣。');
      await G.narrate('忽然，天色暗了下来。桃园深处，墨色翻涌——');
      await G.notice('去北边的结义亭。');
    }
  }

  /* ---------------- 如果·荆州 ---------------- */
  async function whatIfJingzhou() {
    await G.lines([
      ['lvmeng', '（白衣扮作商人）白衣渡江，此计万无一失……'],
      ['guanyu', '（抚髯）吕子明。'],
      ['lvmeng', '！！关、关将军？您不是在樊城……'],
      ['guanyu', '江边烽火台，某加派了三倍人手。台上的弟兄，早认得你这张脸了。'],
      ['lvmeng', '……那我这船货……'],
      ['zhangfei', '哈哈哈！留下当酒钱吧！'],
    ]);
    await G.narrate('如果——荆州无恙。关公仍坐镇江陵，夜读《春秋》；麦城，只是地图上一座不起眼的小城。');
    G.setFlag('ex_w1'); G.addItem('hanjia', 2); G.audio.sfx('buy');
    await G.notice('如果 · 荆州\n得到 汉家犒军 ×2');
  }

  /* ---------------- 如果·五丈原 ---------------- */
  async function whatIfWuzhang() {
    if (G.flag('ex_w2')) { await say('zhugeliang', '主灯长明。……亮，还有许多事要做。'); return; }
    await G.lines([
      ['zhugeliang', '七星灯已点到第六夜。主灯不灭，亮便可再续一纪。'],
      ['weiyan', '（远处，一路狂奔）丞相！丞相！魏兵来——'],
      ['jiangwei', '（一把拉住）文长将军，报军情请走侧门。'],
      ['weiyan', '……侧门？'],
      ['jiangwei', '我连夜开的。'],
    ]);
    await G.narrate('如果——第七夜，主灯长明。');
    await G.lines([
      ['zhugeliang', '（愣了半晌，失笑）……伯约。'],
      ['zhugeliang', '那便，先把北伐的账，好好算一算。'],
    ]);
    G.setFlag('ex_w2'); G.addItem('lingzhi', 3); G.audio.sfx('buy');
    await G.notice('如果 · 五丈原\n得到 灵芝露 ×3');
  }

  /* ---------------- 旧物 ---------------- */
  async function pickRelic(r) {
    if (G.flag(r.id)) return;
    G.setFlag(r.id); G.audio.sfx('buy');
    await G.notice(`拾得旧物 · ${r.name}（${relicCount()} / 5）`);
    await say(r.who, r.line);
    if (relicCount() === 5) await G.narrate('五件旧物，都物归原主了。');
  }

  /* ---------------- 天命 ---------------- */
  async function finale() {
    if (G.flag('ex_end')) return;
    await G.lines([
      ['tianming', '吾乃天命。汉祚已尽，三分归晋——此乃定数。'],
      ['liubei', '定数？'],
      ['liubei', '我们兄弟这一辈子，从桃园到白帝城，从来没信过什么定数。'],
      ['guanyu', '大哥，这一回，某不走麦城。'],
      ['zhangfei', '俺也不喝醉了！'],
      ['zhugeliang', '亮也不必再借东风。这一阵——诸位，放手去打！'],
    ]);
    const r = await G.battle(['tianming', 'moying', 'moying'], { bg: 'inkvoid', boss: true, intro: '天 命' });
    if (r !== 'win') return;
    G.setFlag('ex_end');
    await say('tianming', '……汝等，果然不信命。');
    await G.narrate('墨色一点点褪去，化作漫天桃花。');
    await G.fadeOut(1.2);
    G.world.load('exdream', 19, 9, 'up'); G.world.banner = null;
    await G.fadeIn(1.2);
    await G.lines([
      ['zhangfei', '大哥，二哥，满上！这一碗，敬咱们走过的路！'],
      ['guanyu', '这一碗，敬那些没能走到最后的人。'],
      ['liubei', '……这一碗，敬天下。'],
    ]);
    await G.narrate('桃花落进酒碗里。三人相视而笑。');
    await G.fadeOut(1.6);
    await G.narrate('——白帝城，永安宫。烛火将尽。');
    await say('liubei', '……二弟，三弟。原来，你们一直都在。');
    const lines = ['《烽烟录 · 三国》', '', '作　者', '一尾小石斑', '', '剧本、关卡、人物、美术、音乐', '全部由代码一笔一笔写成', '', '献给每一个小时候', '守在电视机前打三国的你'];
    if (relicCount() === 5) lines.push('', '五件旧物，都物归原主了。');
    lines.push('', '谢谢游玩。');
    await new Promise(res => { G.setScene(new G.TextScroll(lines, res)); G.audio.play('ending'); G.fadeIn(1.0); });
    await G.chapterEnd(G.CHAPTERS[EX].endLines);
  }

  /* ---------------- 墨色天命：战斗中在身周翻涌的墨团 ---------------- */
  window.addEventListener('load', () => {
    const P = G.BattleScene && G.BattleScene.prototype; if (!P) return;
    const base = P.drawUnit;
    P.drawUnit = function (c, u) {
      if (u.def0 && u.def0.ink && u.alpha > 0.01) {
        const x = u.x + u.ox, y = u.y + u.oy, t = this.t, big = u.boss ? 1.6 : 1;
        c.save(); c.globalAlpha = u.alpha * 0.55;
        for (let i = 0; i < 9; i++) {
          const a = t * (0.6 + i * 0.07) + i * 0.7, r = (28 + (i % 3) * 14) * big;
          const bx = x + Math.cos(a) * r, by = y - 60 * big + Math.sin(a * 1.3) * r * 0.7;
          const g = c.createRadialGradient(bx, by, 0, bx, by, (14 + (i % 4) * 5) * big);
          g.addColorStop(0, 'rgba(10,10,10,0.85)'); g.addColorStop(1, 'rgba(10,10,10,0)');
          c.fillStyle = g; c.beginPath(); c.arc(bx, by, (14 + (i % 4) * 5) * big, 0, G.TAU); c.fill();
        }
        c.restore();
      }
      return base.call(this, c, u);
    };
  });

  /* ---------------- 章节定义 ---------------- */
  G.startExtra = () => {
    const s = G.state = G.newState();
    if (G.ensureMembers) G.ensureMembers();
    for (const id of Object.keys(s.members)) { const m = s.members[id]; m.lvl = LV; m.exp = G.expTo(LV); m.armor = 'zhaolie'; }
    const all = Object.keys(G.HEROES).filter(id => s.members[id]);
    s.party = START_PARTY.filter(id => all.includes(id)); s.stash = all.filter(id => !s.party.includes(id));
    s.gold = 60000; s.items = { shenyao: 8, lingzhi: 4, hanjia: 2, xuming: 5 };
    Object.assign(s.flags, { c11_wind: true, c21_flood: true, c32_book: true, chsel: EX });
    s.chapter = EX;
    G.restoreAll();
    G.startChapter(EX);
  };
  G.CHAPTERS[EX] = {
    title: '桃园一梦',
    prologue: [
      '章武三年，白帝城，永安宫。',
      '先主病笃，昏昏睡去。',
      '梦里，桃花开得正好。',
      '那些走散了的人——都回来了。',
      '还有许多，他从未见过的后来人。',
    ],
    start: async () => {
      G.world.load('exdream', 19, 28, 'up');
      await G.fadeIn(1.4);
      await G.lines([
        ['liubei', '……这是，桃园？'],
        ['zhangfei', '大哥！你可算醒了！酒都温了三回了！'],
        ['guanyu', '大哥，二弟、三弟都在。军师、子龙……大家都在。'],
        ['zhugeliang', '主公，此处似梦非梦。既然来了，不妨——再打一场痛快的。'],
      ]);
      await G.notice('番外 · 桃园一梦\n全员重聚：找简雍点将，任选六人出阵。\n东边擂台，五位老对手正在等候。');
    },
    endLines: [
      '先主醒来时，窗外天已微明。',
      '他想起梦里那片桃林——',
      '花开得正好，兄弟们都在。',
      '',
      '这一回，谁也没有走散。',
    ],
  };
})();
