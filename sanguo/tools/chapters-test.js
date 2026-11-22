/* 烽烟录 · 第二至五章主线自动测试 + Boss 平衡统计：node tools/chapters-test.js [--balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8198);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8198/'); await page.waitForTimeout(600);
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
  const setLv = lv => ev(lv => { for (const id of Object.keys(G.state.members)) { const m = G.state.members[id]; m.lvl = lv; m.exp = G.expTo(lv); } G.restoreAll(); G.state.items.jinchuang = 6; G.state.items.xuming = 3; }, lv);
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
  console.log('── 第二章 ──');
  await ev(() => { G.state = G.newState(); G.joinParty('jianyong'); });
  await setLv(13);
  check('开场', (await startCh(2)) === 'ok' && (await ev(() => G.state.map)) === 'c2camp');
  await talk(15, 9, 'up'); check('卢植交代任务', await flag('c2_quest'));
  await goto('c2valley', 15, 9, 'up'); await wait(1200); await drive();
  await arrive(15, 8, 'up'); check('无秽血时被妖风吹退', !(await flag('c2_baodead')) && (await ev(() => G.world.lead.y)) === 21);
  await goto('c2village', 16, 12, 'up'); await wait(200);
  await talk(22, 20, 'up'); check('村老指点', await flag('c2_elder'));
  await arrive(29, 12, 'right'); check('赶走强盗', await flag('c2_bandit'));
  await talk(5, 20, 'up'); check('得到秽血', await flag('c2_blood'));
  await goto('c2valley', 15, 9, 'up'); await wait(300);
  let maxEnemies = 0;
  const poll = setInterval(async () => { try { const n = await ev(() => { const b = G.scenes[G.scenes.length - 1]; return b.enemies ? b.enemies.length : 0; }); maxEnemies = Math.max(maxEnemies, n); } catch (e) { /* ignore */ } }, 300);
  const rb = await arrive(15, 8, 'up'); clearInterval(poll);
  check('击败张宝', rb === 'ok' && await flag('c2_baodead'), rb);
  console.log('    · 张宝战中最多敌军数（含纸人）', maxEnemies);
  await goto('c2world', 15, 16, 'up'); await wait(200);
  await arrive(15, 16, 'up');
  check('囚车、张梁、董卓剧情', await flag('c2_cage'));
  check('第二章结束进入章末画面', (await endToNext()) === 'ChapterEndScene');

  console.log('── 第三章 ──');
  await setLv(16);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map)) === 'c3camp', await ev(() => G.state.map));
  await talk(17, 9, 'up'); check('温酒斩华雄', await flag('c3_huaxiong'));
  await goto('c3pass', 15, 9, 'up'); await wait(1200); await drive();
  await arrive(15, 7, 'up'); check('三英战吕布（吕布败走）', await flag('c3_lubu'));
  check('第三章结束', (await endToNext()) === 'ChapterEndScene');

  console.log('── 第四章 ──');
  await setLv(21);
  check('开场 & 赵云加入', (await drive()) === 'ok' && (await ev(() => G.state.party.includes('zhaoyun') && G.state.party.length === 5)));
  await goto('c4beihai', 15, 7, 'up'); await wait(200);
  await arrive(15, 6, 'up'); check('北海解围（管亥）', await flag('c4_guanhai'));
  await goto('c4xuzhou', 20, 12, 'up'); await wait(200);
  await talk(20, 10, 'up'); check('陶谦求援', await flag('c4_tao'));
  await goto('c4caoying', 18, 11, 'up'); await wait(200);
  await arrive(18, 9, 'up'); check('击退夏侯惇', await flag('c4_cao'));
  await goto('c4xuzhou', 20, 12, 'up'); await wait(200);
  await talk(20, 10, 'up');
  check('三让徐州 → 第四章结束', (await endToNext()) === 'ChapterEndScene');

  console.log('── 第五章 ──');
  await setLv(26);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map)) === 'c5xiaopei');
  await talk(16, 20, 'up'); check('纪灵来犯', await flag('c5_jlgo'));
  await goto('c5world', 12, 20, 'up'); await wait(200);
  await arrive(12, 19, 'up'); check('纪灵 & 辕门射戟 → 曹营', await flag('c5_flee') && (await ev(() => G.state.map)) === 'c5caoying');
  await talk(15, 9, 'up'); check('水淹下邳之计', await flag('c5_flood'));
  await goto('c5xiapi', 15, 44, 'up'); await wait(1200); await drive();
  await arrive(8, 39, 'up'); check('高顺', await flag('c5_gao'));
  await arrive(11, 28, 'right'); check('张辽', await flag('c5_liao'));
  await arrive(24, 21, 'up'); check('陈宫', await flag('c5_gong'));
  await arrive(15, 5, 'up'); check('白门楼 吕布', await flag('c5_lubu'));
  check('第五章（第一部）结束', (await endToNext()) === 'ChapterEndScene');
  check('第一部结束后进入第六章', await ev(() => G.state.chapter === 6));

  }
  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（预计等级，只会普攻）──');
    const trials = [['zhangbao', ['zhangbao', 'hjyao', 'hjyao'], 9, null, 'c2_blood'], ['zhangliang', ['zhangliang', 'hjjing', 'hjmeng'], 10], ['huaxiong', ['huaxiong'], 11, ['guanyu']],
      ['lubu', ['lubu'], 13, ['liubei', 'guanyu', 'zhangfei']], ['guanhai', ['guanhai', 'hjyu2', 'hjyu'], 16], ['xiahoudun', ['xiahoudun', 'caoqi', 'caoshe'], 17],
      ['gaoshun', ['gaoshun', 'xianzhen'], 20], ['lubu2', ['lubu2'], 22]];
    for (const [name, group, lv, party, fl] of trials) {
      for (const smart of [false, true]) {
      let wins = 0; const N = 2;
      for (let k = 0; k < N; k++) {
        await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.joinParty('jianyong'); G.joinParty('zhaoyun'); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c4world', 30, 26, 'up'); G.world.banner = null; G.fadeA = 0; });
        await setLv(lv); if (fl) await ev(f => G.setFlag(f), fl);
        await ev(sm => { G.autoAI = sm ? smartAI : null; }, smart);
        await ev(([g, p]) => { G.run(() => G.battle(g, { boss: true, party: p || undefined })); }, [group, party]);
        await wait(500);
        const r = await drive(4000, 0);
        if (r === 'ok') wins++;
      }
      console.log(`  · ${name}（Lv${lv}${party ? '，' + party.length + '人' : ''}）${smart ? '会用策略' : '只会普攻'} 胜 ${wins}/${N}`);
      }
    }
  }
  console.log(errors.length ? '页面错误：\n' + [...new Set(errors)].join('\n') : '页面无报错');
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  await browser.close(); server.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
