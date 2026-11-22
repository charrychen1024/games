/* 烽烟录 · 第六至十章主线自动测试 + Boss 平衡统计：node tools/chapters-test.js [--balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8201);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8201/'); await page.waitForTimeout(600);
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
  const tp = (id, x, y) => ev(([id, x, y]) => { const n = G.world.npcById(id); G.world.teleportNpc(n, x, y); n.wander = 0; }, [id, x, y]);
  console.log('── 第六章 ──');
  await ev(() => { G.state = G.newState(); G.joinParty('jianyong'); G.joinParty('zhaoyun'); G.state.chapter = 6; });
  await setLv(30);
  check('开场', (await startCh(6)) === 'ok' && (await ev(() => G.state.map)) === 'c6xudu');
  await talk(33, 24, 'up'); check('衣带诏', await flag('c6_edict'));
  await talk(20, 10, 'up'); check('煮酒论英雄', await flag('c6_wine'));
  await goto('c6world', 35, 17, 'right'); await wait(200);
  await arrive(36, 17, 'right'); check('截击袁术', await flag('c6_yuanshu'));
  await goto('c6xuzhou', 20, 12, 'up'); await wait(200);
  await talk(22, 28, 'up'); check('陈登报信', await flag('c6_chen'));
  await arrive(20, 10, 'up'); check('斩车胄', await flag('c6_chezhou'));
  await goto('c6caoying', 18, 10, 'up'); await wait(200);
  await arrive(18, 9, 'up');
  check('许褚 & 兄弟失散 → 章末', (await endToNext()) === 'ChapterEndScene');
  console.log('── 第七章 ──');
  await setLv(32);
  check('开场（关羽单人）', (await drive()) === 'ok' && (await ev(() => G.state.party.join() === 'guanyu')));
  await arrive(14, 46, 'up'); check('东岭关 孔秀', await flag('c7_kong'));
  await arrive(14, 14, 'up'); check('洛阳 韩福', await flag('c7_han'));
  await goto('c7road2', 14, 56, 'up'); await wait(1200); await drive();
  await talk(11, 51, 'left'); check('普净示警', await flag('c7_monk'));
  await arrive(14, 51, 'up'); check('镇国寺 卞喜', await flag('c7_bian'));
  await talk(17, 34, 'right'); check('胡班报信', await flag('c7_hu'));
  await arrive(14, 32, 'up'); check('荥阳 王植', await flag('c7_wang'));
  await arrive(14, 9, 'up');
  check('黄河渡口 秦琪 → 章末', (await endToNext()) === 'ChapterEndScene');
  console.log('── 第八章 ──');
  await setLv(32);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map)) === 'c8gucheng');
  await arrive(16, 6, 'up'); check('斩蔡阳 & 张飞归队', await flag('c8_cai') && (await ev(() => G.state.party.includes('zhangfei'))));
  await talk(19, 8, 'up'); check('古城重逢', await flag('c8_reunion') && (await ev(() => G.state.party[0] === 'liubei')));
  await goto('c8wolong', 15, 10, 'up'); await wait(200);
  await arrive(15, 7, 'up');
  check('卧牛山 赵云归队 → 章末', (await ev(() => G.state.party.includes('zhaoyun'))) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第九章 ──');
  await setLv(34);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map)) === 'c9xinye');
  await tp('xushu', 14, 18); await talk(14, 19, 'up'); check('徐庶来投', await flag('c9_xushu'));
  await goto('c9world', 16, 15, 'right'); await wait(200);
  await arrive(17, 15, 'right'); check('破八门金锁阵 & 走马荐诸葛', await flag('c9_caoren') && await flag('c9_jian'));
  for (let v = 1; v <= 3; v++) { await goto('c9longzhong', 15, 12, 'up'); await wait(1300); await drive(); await talk(15, 10, 'up'); }
  check('三顾茅庐 · 诸葛亮加入', await flag('c9_kongming') && (await ev(() => G.state.party.includes('zhugeliang') && G.state.party.length === 6)));
  await goto('c9bowang', 15, 9, 'up'); await wait(200);
  await arrive(15, 7, 'up');
  check('博望坡 → 章末', (await endToNext()) === 'ChapterEndScene');
  console.log('── 第十章 ──');
  await setLv(36);
  check('开场（赵云单人）', (await drive()) === 'ok' && (await ev(() => G.state.party.join() === 'zhaoyun')));
  await talk(9, 23, 'up'); check('简雍指路', await flag('c10_jy'));
  await arrive(24, 14, 'up'); check('夺青釭剑', await flag('c10_sword') && (await ev(() => G.state.members.zhaoyun.wbonus === 40)));
  await talk(29, 8, 'up'); check('糜夫人托孤', await flag('c10_adou'));
  await arrive(43, 20, 'right'); check('冲破张郃', await flag('c10_zh'));
  await talk(56, 20, 'right');
  check('长坂桥断喝 → 第二部完', (await ev(() => G.state.party.length === 6)) && (await endToNext()) === 'ChapterEndScene');
  check('第二部结束后进入第十一章', await ev(() => G.state.chapter === 11));
  }
  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（预计等级）──');
    const trials = [['chezhou', ['chezhou', 'caobing2', 'caobing2'], 25], ['xuchu', ['xuchu', 'caoqi2', 'caoshe2'], 26],
      ['kongxiu', ['kongxiu', 'guanbing'], 27, ['guanyu']], ['bianxi', ['bianxi', 'guanbing'], 27, ['guanyu']], ['qinqi', ['qinqi', 'guanbing', 'guanshe'], 28, ['guanyu']],
      ['caiyang', ['caiyang'], 28, ['guanyu']], ['peiyuanshao', ['peiyuanshao', 'shanzei2', 'shanzei'], 28], ['caoren', ['caoren', 'caoqi3', 'caobing3'], 29],
      ['xiahoudun2', ['xiahoudun2', 'caoqi3', 'caoshe3'], 30], ['xiahouen', ['xiahouen', 'zhuibing'], 31, ['zhaoyun']], ['zhanghe', ['zhanghe'], 31, ['zhaoyun']]].filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t[0]));
    for (const [name, group, lv, party] of trials) {
      for (const smart of [false, true]) {
        let wins = 0; const N = 2;
        for (let k = 0; k < N; k++) {
          await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.joinParty('jianyong'); G.joinParty('zhaoyun'); G.joinParty('zhugeliang'); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c4world', 30, 26, 'up'); G.world.banner = null; G.fadeA = 0; });
          await setLv(lv);
          await ev(([p]) => { if (p) G.state.party = p.slice(); for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'longlin'; if (p && p[0] === 'zhaoyun' && false) {} G.restoreAll(); G.state.items.dahuan = 4; }, [party]);
          await ev(sm => { G.autoAI = sm ? smartAI : null; }, smart);
          await ev(([g, p]) => { G.run(() => G.battle(g, { boss: true, party: p || undefined })); }, [group, party]);
          await wait(500);
          if ((await drive(5000, 0)) === 'ok') wins++;
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
