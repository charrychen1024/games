/* 烽烟录 · 第十四至十七章主线自动测试 + Boss 平衡统计：node tools/chapters-test.js [--balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8204);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8204/'); await page.waitForTimeout(600);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = ms => page.waitForTimeout(ms);
  await ev(() => { G.speed = 4;
    window.smartAI = (u, b, cmds) => {
      const pend = cmds.filter(c => c.type === 'skill').reduce((t, c) => t + G.SKILLS[c.skill].cost, 0), sp = G.state.sp - pend;
      const allies = b.party.filter(p => p.alive), foes = b.enemies.filter(e => e.alive);
      const boss = foes.find(e => e.boss) || foes[0];
      const sks = G.skillsOf(u.id).map(k => [k, G.SKILLS[k]]);
      const low = allies.filter(p => p.hp / p.maxhp < 0.45).sort((a, b2) => a.hp / a.maxhp - b2.hp / b2.maxhp);
      const healing = cmds.filter(c => (c.type === 'skill' && G.SKILLS[c.skill].type === 'heal') || c.type === 'item').length;
      if (low.length > healing) {
        const all = sks.find(([k, s]) => s.type === 'heal' && s.target === 'allies' && s.cost <= sp);
        if (all && low.length >= 2) return { type: 'skill', u, skill: all[0], t: allies };
        const one = sks.find(([k, s]) => s.type === 'heal' && s.target === 'ally' && s.cost <= sp);
        if (one) return { type: 'skill', u, skill: one[0], t: low[0] };
        const it = ['dabu', 'jinchuang', 'shangyao'].find(k => (G.state.items[k] || 0) - cmds.filter(c => c.item === k).length > 0);
        if (it && low[0].hp / low[0].maxhp < 0.3) return { type: 'item', u, item: it, t: low[0] };
      }
      const dead = b.party.filter(p => !p.alive);
      if (dead.length && (G.state.items.xuming || 0) - cmds.filter(c => c.item === 'xuming').length > 0) return { type: 'item', u, item: 'xuming', t: dead[0] };
      if (foes.length >= 2) { const aoe = sks.filter(([k, s]) => s.target === 'enemies' && s.type !== 'heal' && s.cost <= sp - 10).pop(); if (aoe) return { type: 'skill', u, skill: aoe[0], t: foes }; }
      const buff = sks.find(([k, s]) => s.type === 'buff' && s.cost <= sp - 15);
      if (buff && !b.party.some(p => p.buff > 0) && !cmds.some(c => c.skill === 'jili')) return { type: 'skill', u, skill: buff[0], t: allies };
      const big = sks.filter(([k, s]) => (s.target === 'enemy') && s.type !== 'heal' && s.cost <= sp - 12).pop();
      if (big) return { type: 'skill', u, skill: big[0], t: boss };
      return { type: 'attack', u, t: boss };
    };
  });
  const top = () => ev(() => G.scenes[G.scenes.length - 1].constructor.name);
  const flag = k => ev(k => !!G.state.flags[k], k);
  // 一直按确认，直到既没有脚本、也不在战斗中
  const drive = async (max = 3000, retries = 2) => {
    let idle = 0;
    for (let i = 0; i < max; i++) {
      const s = await ev(() => ({ busy: G.locked(), battle: G.scenes[G.scenes.length - 1] instanceof G.BattleScene, top: (G.scenes.find(s => s.constructor.name === 'GameOverScene') || G.scenes[0]).constructor.name }));
      if (s.top === 'GameOverScene') {
        // 剧情测试：像玩家一样「重新挑战」（最多 retries 次，并打印出来）；平衡统计传 0，不重试
        const canRetry = await ev(() => { const g = G.scenes.find(s => s.constructor.name === 'GameOverScene'); return !!(g && g.retry); });
        if (!canRetry || retries <= 0) return 'lose';
        retries--; console.log('    （战败，重新挑战）');
        for (let k = 0; k < 80 && !(await ev(() => { const g = G.scenes.find(s => s.constructor.name === 'GameOverScene'); return !g || g.t > 2.2; })); k++) await wait(60);
        await ev(() => { const g = G.scenes.find(s => s.constructor.name === 'GameOverScene'); if (g) g.idx = 0; });
        await page.keyboard.press('Enter'); await wait(800); idle = 0; continue;
      }
      if (!s.busy && !s.battle) { if (++idle > 3) return 'ok'; await wait(60); continue; }
      idle = 0;
      await page.keyboard.press('Enter'); await wait(45);
    }
    return 'timeout';
  };
  const place = (x, y, dir) => ev(([x, y, dir]) => { const w = G.world; w.party.forEach((u, i) => w.place(i, x, y, dir)); G.state.x = x; G.state.y = y; }, [x, y, dir]);
  const goto = (map, x, y, dir) => ev(([map, x, y, dir]) => { G.world.load(map, x, y, dir); G.world.banner = null; }, [map, x, y, dir]);
  const heal = () => ev(() => G.restoreAll());
  const talk = async (x, y, dir) => { await heal(); await place(x, y, dir); await wait(80); await page.keyboard.press('Enter'); await wait(150); return drive(); };
  const arrive = async (x, y, dir) => { await heal(); await place(x, y, dir); await ev(() => { G.world.cooldown = 0; }); await wait(80); await ev(() => G.world.onArrive()); await wait(150); return drive(); };
  const setLv = lv => ev(lv => { for (const id of Object.keys(G.state.members)) { const m = G.state.members[id]; m.lvl = lv; m.exp = G.expTo(lv); } for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'longlin'; G.restoreAll(); G.state.items.jinchuang = 6; G.state.items.xuming = 3; G.state.items.dahuan = 4; G.autoAI = smartAI; }, lv);
  const startCh = async n => {
    await ev(n => G.startChapter(n), n); await wait(900);
    await page.keyboard.press('Escape'); await wait(1500);
    return drive();
  };
  const endToNext = async () => {
    for (let i = 0; i < 80; i++) { if ((await ev(() => G.scenes[0].constructor.name)) === 'ChapterEndScene') break; await page.keyboard.press('Enter'); await wait(60); }
    const n = await ev(() => G.scenes[0].constructor.name);
    await wait(4000); await page.keyboard.press('Enter'); await wait(800);
    if (await ev(() => !!G.CHAPTERS[G.state.chapter] && G.scenes[0].constructor.name !== 'TitleScene')) { await wait(800); await page.keyboard.press('Escape'); await wait(1500); }
    return n;
  };



  if (!process.argv.includes('--only-balance')) {
  console.log('── 第十三章 → 第十四章 ──');
  await ev(() => { G.state = G.newState(); for (const id of ['zhaoyun', 'zhugeliang', 'huangzhong']) G.joinParty(id); G.state.stash = ['jianyong']; G.state.chapter = 13; G.state.flags.c11_wind = true; G.state.flags.c13_cs = true; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c13changsha', 17, 20, 'up'); G.fadeA = 0; });
  await ev(() => G.chapterEnd(G.CHAPTERS[13].endLines)); await wait(1500);
  check('第十三章结束后进入第十四章', (await endToNext()) === 'ChapterEndScene' && (await ev(() => G.state.chapter === 14)));
  console.log('── 第十四章 ──');
  await setLv(37);
  { const d = await drive(); const st = await ev(() => JSON.stringify({ p: G.state.party, m: G.state.map, ui: G.ui.stack.length, b: G.scriptBusy, sc: G.scenes.map(s => s.constructor.name) })); check('开场（刘备、赵云二人）', d === 'ok' && (await ev(() => G.state.party.join() === 'liubei,zhaoyun' && G.state.map === 'c14nanxu')), d + ' ' + st); }
  check('未拆锦囊二不能出城', await ev(() => { const w = G.world.m.warps.find(w => w.to === 'c14road'); return !w.cond(); }));
  await talk(35, 30, 'up'); check('锦囊一 · 乔国老', await flag('c14_qiao'), await ev(() => JSON.stringify({ x: G.world.lead.x, y: G.world.lead.y, b: G.scriptBusy, ui: G.ui.stack.length })));
  await talk(18, 11, 'up'); check('甘露寺 · 国太相婿、贾华伏兵', await flag('c14_guotai'));
  await talk(20, 14, 'up'); check('试剑石 · 洞房 · 孙夫人加入', (await flag('c14_stone')) && (await flag('c14_wed')) && (await ev(() => G.state.party.includes('sunshangxiang'))));
  await goto('c14road', 2, 15, 'right'); await drive();
  await ev(() => { G.world.m.encounters = null; });
  await arrive(14, 14, 'right'); check('锦囊三 · 夫人喝退徐盛丁奉', await flag('c14_df'));
  await arrive(30, 14, 'right'); check('东吴追兵', await flag('c14_zhui'));
  await talk(46, 9, 'left');
  check('刘郎浦 · 周瑜 → 章末', (await flag('c14_end')) && (await endToNext()) === 'ChapterEndScene');
  if (process.env.STOP14) { console.log(errors.join('\n')); process.exit(0); }
  console.log('── 第十五章 ──');
  await setLv(39);
  check('开场（孙夫人留荆州）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c15world' && G.state.party.length === 6 && !G.state.party.includes('sunshangxiang'))));
  await ev(() => { G.world.m.encounters = null; });
  await goto('c15leiyang', 16, 25, 'up'); await drive();
  check('耒阳：张飞单人', await ev(() => G.state.party.join() === 'zhangfei'));
  await arrive(16, 24, 'up'); check('耒阳山贼', await flag('c15_bandit'));
  await talk(16, 10, 'up'); check('庞统半日断百日公事 · 加入', (await flag('c15_pt')) && (await ev(() => G.state.party.includes('pangtong'))));
  await goto('c15world', 44, 33, 'up'); await drive();
  check('庞统入幕、关羽镇守江陵', (await flag('c15_ptback')) && (await ev(() => G.state.party.length === 6 && !G.state.party.includes('guanyu') && G.state.party.includes('pangtong'))));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(54, 6, 'right'); check('张松献图 · 魏延加入', (await flag('c15_west')) && (await ev(() => G.state.party.join() === 'liubei,pangtong,huangzhong,weiyan')));
  await goto('c15fucheng', 17, 28, 'up'); await drive();
  await talk(17, 10, 'up'); check('涪城会 → 截江（赵云单人）', (await flag('c15_feast')) && (await ev(() => G.state.map === 'c15jiang' && G.state.party.join() === 'zhaoyun')));
  await talk(44, 5, 'up');
  check('截江夺阿斗 · 孙夫人归吴 → 章末', (await flag('c15_end')) && (await ev(() => !G.state.party.includes('sunshangxiang') && !(G.state.stash || []).includes('sunshangxiang'))) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第十六章 ──');
  await setLv(41);
  check('开场（入川四人）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c16world' && G.state.party.join() === 'liubei,pangtong,huangzhong,weiyan')));
  await ev(() => { G.world.m.encounters = null; });
  check('未破冷苞不能走小路', await ev(() => { const w = G.world.m.warps.find(w => w.to === 'c16luofeng'); return !w.cond(); }));
  await arrive(42, 17, 'down'); check('涪关 · 杨怀高沛', await flag('c16_fu'));
  await arrive(17, 22, 'left'); check('雒城 · 冷苞', (await flag('c16_leng')) && (await ev(() => G.state.party.join() === 'pangtong,weiyan,huangzhong')));
  await goto('c16luofeng', 11, 34, 'up'); await drive();
  await arrive(12, 10, 'up');
  check('落凤坡 · 庞统殒命 → 巴郡（张飞单人）', (await flag('c16_pt')) && (await ev(() => !G.state.party.includes('pangtong') && !G.state.members.pangtong.armor && G.state.map === 'c16bajun' && G.state.party.join() === 'zhangfei')));
  await talk(19, 27, 'right'); check('张飞假传军令', await flag('c16_ruse'));
  { const d = await arrive(2, 8, 'up'); check('义释严颜 → 全军会合', (await flag('c16_yan')) && (await ev(() => G.state.map === 'c16world' && G.state.party.length === 6)), d + ' ' + (await ev(() => JSON.stringify({ m: G.state.map, p: G.state.party, x: G.world.lead.x, y: G.world.lead.y, f: G.state.flags.c16_yan, ruse: G.state.flags.c16_ruse, sc: G.scenes.map(s => s.constructor.name) })))); }
  await ev(() => { G.world.m.encounters = null; });
  await arrive(8, 21, 'left');
  check('金雁桥 · 张任 → 章末', (await flag('c16_end')) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第十七章 ──');
  await setLv(43);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c17jiameng' && G.state.party.length === 6)));
  await arrive(17, 12, 'up'); check('魏延战马岱 → 张飞单人', (await flag('c17_dai')) && (await ev(() => G.state.party.join() === 'zhangfei')));
  await talk(17, 7, 'up'); check('日战马超 · 入夜', (await flag('c17_duel1')) && (await ev(() => G.world.m.dusk === true)));
  await talk(17, 7, 'up'); check('挑灯夜战', (await flag('c17_duel2')) && (await ev(() => G.state.party.length === 6)));
  await talk(20, 24, 'up'); check('李恢说马超 · 马超加入', (await flag('c17_ma')) && (await ev(() => G.state.party.includes('machao') && !G.state.party.includes('weiyan') && G.world.m.dusk === false)));
  await goto('c17chengdu', 17, 28, 'up'); await drive();
  await arrive(19, 19, 'up'); check('成都守军', await flag('c17_gate'));
  await talk(19, 18, 'up');
  check('刘璋出降 · 第四部完 → 章末', (await flag('c17_end')) && (await ev(() => G.state.party.join() === 'liubei,zhugeliang,zhangfei,zhaoyun,huangzhong,machao')) && (await endToNext()) === 'ChapterEndScene');
  check('第四部完后进入第十八章', await ev(() => G.state.chapter === 18 && G.scenes[0].constructor.name !== 'TitleScene'));
  }
  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（预计等级）──');
    const trials = [
      ['jiahua', ['jiahua', 'wubing2', 'wubing2'], 37, ['liubei', 'zhaoyun']],
      ['ch14杂兵', ['wubing2', 'wugong', 'wubing2'], 37, ['liubei', 'zhaoyun', 'sunshangxiang']],
      ['zhouyu', ['zhouyu', 'wubing2', 'wugong', 'wubing2'], 38, ['liubei', 'zhaoyun', 'sunshangxiang', 'zhugeliang', 'guanyu', 'huangzhong']],
      ['shanzei3', ['shanzei3', 'shanzei3'], 38, ['zhangfei']],
      ['ch15曹军', ['caoqi6', 'caobing6', 'caoqi6'], 39, ['liubei', 'zhangfei', 'zhaoyun', 'zhugeliang', 'pangtong', 'huangzhong']],
      ['zhoushan', ['zhoushan'], 40, ['zhaoyun']],
      ['yang+gao', ['yanghuai', 'gaopei'], 40, ['liubei', 'pangtong', 'huangzhong', 'weiyan']],
      ['lengbao', ['lengbao', 'shubing2', 'shugong2'], 41, ['liubei', 'pangtong', 'huangzhong', 'weiyan']],
      ['zhangren', ['zhangren', 'shubing2', 'shugong2'], 41, ['pangtong', 'weiyan', 'huangzhong']],
      ['yanyan', ['yanyan'], 42, ['zhangfei']],
      ['zhangren2', ['zhangren2', 'shubing2', 'shugong2', 'shubing2'], 42, ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'weiyan']],
      ['madai', ['madai', 'xiliang', 'xiliang2'], 43, ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'weiyan']],
      ['machao', ['machao'], 43, ['zhangfei']],
      ['machao2', ['machao2'], 43, ['zhangfei']],
      ['ch17守军', ['shubing3', 'shubing3', 'shugong2', 'shubing3'], 44, ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao']],
    ].filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t[0]));
    for (const [name, group, lv, party] of trials) {
      for (const smart of [false, true]) {
        let wins = 0; const N = +(process.env.N || 2);
        for (let k = 0; k < N; k++) {
          await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.joinParty('zhaoyun'); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c4world', 30, 26, 'up'); G.world.banner = null; G.fadeA = 0; G.state.flags.c11_wind = true; });
          await setLv(lv);
          await ev(([p]) => { G.state.party = p.slice(); for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'jinsuo'; G.state.members.zhaoyun.wbonus = 40; G.restoreAll(); G.state.items.dahuan = 4; G.state.items.shenghui = 2; }, [party]);
          await ev(sm => { G.autoAI = sm ? smartAI : null; }, smart);
          await ev(([g, p]) => { G.run(() => G.battle(g, { boss: true, party: p })); }, [group, party]);
          await wait(500);
          if ((await drive(6000, 0)) === 'ok') wins++;
        }
        console.log(`  · ${name}（Lv${lv}，${party.length}人）${smart ? '会用策略' : '只会普攻'} 胜 ${wins}/${N}`);
      }
    }
  }
  console.log(errors.length ? '页面错误：\n' + [...new Set(errors)].join('\n') : '页面无报错');
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  await browser.close(); server.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
