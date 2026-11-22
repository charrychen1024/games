/* 烽烟录 · 第十一至十三章主线自动测试 + Boss 平衡统计：node tools/chapters-test.js [--balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8203);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8203/'); await page.waitForTimeout(600);
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


  // 舌战群儒：自动选对答案（第一题先故意答错一次，检验重答流程）
  await ev(() => { let wrongOnce = true; setInterval(() => { const t = G.ui.stack[G.ui.stack.length - 1]; if (t && t.items && t.items[0] && /^甲、/.test(t.items[0].label)) { const d = G.DEBATE.find(d => t.items[0].label.includes(d.opts[0])); if (d) { if (wrongOnce && d === G.DEBATE[0]) { t.idx = 1; if (!t._w) { t._w = 1; setTimeout(() => { wrongOnce = false; }, 50); } } else t.idx = d.ok; } } }, 15); });
  if (!process.argv.includes('--only-balance')) {
  console.log('── 第十章 → 第十一章 ──');
  await ev(() => { G.state = G.newState(); G.joinParty('jianyong'); G.joinParty('zhaoyun'); G.joinParty('zhugeliang'); G.state.chapter = 10; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c10changban', 3, 20, 'right'); G.fadeA = 0; });
  await ev(() => G.chapterEnd(G.CHAPTERS[10].endLines)); await wait(1500);
  check('第十章结束后进入第十一章', (await endToNext()) === 'ChapterEndScene' && (await ev(() => G.state.chapter === 11)));
  console.log('── 第十一章 ──');
  await setLv(33);
  check('开场（诸葛亮单人）', (await drive()) === 'ok' && (await ev(() => G.state.party.join() === 'zhugeliang' && G.state.map === 'c11chaisang')));
  check('未见孙权不能出北门', await ev(() => { const w = G.getMap('c11chaisang').warps.find(w => w.to === 'c11sanjiang'); return !w.cond(); }));
  await talk(21, 26, 'up'); check('鲁肃指点', await flag('c11_ls'));
  await talk(20, 13, 'up'); check('舌战群儒', await flag('c11_debate'));
  check('答错一次后无奖励（天中酒）', await ev(() => !(G.state.items.tianzhong > 0)));
  await talk(20, 11, 'up'); check('智激孙权', await flag('c11_quan'));
  await goto('c11sanjiang', 4, 31, 'up'); await drive();
  await talk(11, 10, 'up'); check('智激周瑜 · 军令状', await flag('c11_zhou'));
  await talk(24, 19, 'right'); check('草船借箭', await flag('c11_arrows'));
  await talk(15, 14, 'up'); check('苦肉计', await flag('c11_kurou'));
  await talk(11, 10, 'up'); check('只欠东风', await flag('c11_ill'));
  await goto('c11nanping', 3, 34, 'right'); await drive();
  await talk(14, 10, 'up'); check('七星坛借东风', await flag('c11_wind') && (await ev(() => G.skillsOf('zhugeliang').includes('dongfeng'))));
  await arrive(16, 22, 'up');
  check('丁奉徐盛 · 赵云接应 → 章末', (await flag('c11_dx')) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第十二章 ──');
  await setLv(34);
  check('开场（全军归队）', (await drive()) === 'ok' && (await ev(() => G.state.party.length === 6 && G.state.map === 'c12xiakou')));
  await talk(18, 10, 'up'); check('孔明调兵遣将', await flag('c12_orders'));
  await goto('c12chibi', 2, 15, 'right'); await drive();
  await ev(() => { G.world.m.encounters = null; });
  await arrive(17, 13, 'up'); check('连环船 第一阵', await flag('c12_n1'));
  await arrive(26, 15, 'right'); check('连环船 第二阵', await flag('c12_n2'));
  await arrive(48, 15, 'right');
  check('于禁 · 进入华容道', (await flag('c12_yu')) && (await ev(() => G.state.map === 'c12huarong' && !G.state.party.includes('guanyu'))));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(12, 33, 'right'); check('乌林 徐晃', await flag('c12_xu'));
  await arrive(25, 23, 'up'); check('葫芦口 许褚', await flag('c12_xc'));
  await arrive(16, 8, 'up');
  check('华容道 → 章末', (await flag('c12_hr')) && (await ev(() => G.state.party.includes('guanyu'))) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第十三章 ──');
  await setLv(36);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c13world')));
  await ev(() => { G.world.m.encounters = null; });
  check('未取桂阳不能进长沙', await ev(() => { const w = G.world.m.warps.find(w => w.to === 'c13changsha'); return !w.cond(); }));
  await talk(29, 38, 'left'); check('营地休整菜单', (await drive()) === 'ok');
  await arrive(11, 21, 'up'); check('零陵 邢道荣', await flag('c13_ll'));
  await arrive(48, 23, 'up'); check('桂阳 赵云单挑陈应', (await flag('c13_gy')) && (await ev(() => G.state.party.length === 6)));
  await goto('c13changsha', 17, 30, 'up'); await drive();
  check('长沙：关羽单人', await ev(() => G.state.party.join() === 'guanyu'));
  await arrive(17, 17, 'up'); check('关羽战黄忠', await flag('c13_duel'));
  await talk(17, 15, 'up');
  check('黄忠归降、简雍留守', (await flag('c13_end')) && (await ev(() => G.state.party.includes('huangzhong') && !G.state.party.includes('jianyong') && G.state.party.length === 6)));
  check('第三部完 → 章末', (await endToNext()) === 'ChapterEndScene');
  check('第三部完后进入第十四章', await ev(() => G.state.chapter === 14 && G.scenes[0].constructor.name !== 'TitleScene'));
  }
  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（预计等级）──');
    const trials = [
      ['ch11杂兵', ['caogong', 'caogong', 'caogong', 'caoshui'], 32, ['zhugeliang']],
      ['dingfeng+xusheng', ['dingfeng', 'xusheng'], 32, ['zhugeliang', 'zhaoyun']],
      ['yujin', ['yujin', 'caogong2', 'caoshui2'], 33],
      ['xuhuang', ['xuhuang', 'caoqi5', 'caobing5'], 33, ['liubei', 'zhangfei', 'zhaoyun', 'jianyong', 'zhugeliang']],
      ['xuchu3', ['xuchu3', 'caoqi5', 'caoqi5'], 34, ['liubei', 'zhangfei', 'zhaoyun', 'jianyong', 'zhugeliang']],
      ['xingdaorong', ['xingdaorong', 'jingbing', 'jinggong'], 34],
      ['chenying', ['chenying'], 35, ['zhaoyun']],
      ['huangzhong', ['huangzhong'], 35, ['guanyu']],
    ].filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t[0]));
    for (const [name, group, lv, party] of trials) {
      for (const smart of [false, true]) {
        let wins = 0; const N = 2;
        for (let k = 0; k < N; k++) {
          await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.joinParty('jianyong'); G.joinParty('zhaoyun'); G.joinParty('zhugeliang'); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c4world', 30, 26, 'up'); G.world.banner = null; G.fadeA = 0; });
          await setLv(lv);
          await ev(([p]) => { if (p) G.state.party = p.slice(); for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'longlin'; G.state.members.zhaoyun.wbonus = 40; G.restoreAll(); G.state.items.dahuan = 4; }, [party]);
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
