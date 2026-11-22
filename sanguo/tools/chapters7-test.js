/* 烽烟录 · 第二十七至三十章主线自动测试 + Boss 平衡统计：node tools/chapters-test.js [--balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8207);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8207/'); await page.waitForTimeout(600);
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
  const setLv = lv => ev(lv => { for (const id of Object.keys(G.state.members)) { const m = G.state.members[id]; m.lvl = lv; m.exp = G.expTo(lv); } for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'wuxing'; G.restoreAll(); G.state.items.jinchuang = 6; G.state.items.xuming = 3; G.state.items.dahuan = 4; G.autoAI = smartAI; }, lv);
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
  console.log('── 第二十六章 → 第二十七章 ──');
  await ev(() => { G.state = G.newState(); for (const id of ['zhaoyun', 'zhugeliang', 'weiyan', 'guanxing', 'zhangbao2', 'machao']) G.joinParty(id); G.state.party = ['zhugeliang', 'zhaoyun', 'weiyan', 'guanxing', 'zhangbao2', 'machao']; G.state.stash = ['wangping']; G.state.chapter = 26; G.state.flags.c11_wind = true; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c17chengdu', 19, 20, 'up'); G.fadeA = 0; });
  await ev(() => G.chapterEnd(G.CHAPTERS[26].endLines)); await wait(1500);
  check('第二十六章结束后进入第二十七章', (await endToNext()) === 'ChapterEndScene' && (await ev(() => G.state.chapter === 27)));
  console.log('── 第二十七章 ──');
  await setLv(57);
  check('开场（马超病故）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c27qishan' && G.state.party.join() === 'zhugeliang,zhaoyun,weiyan,guanxing,zhangbao2' && !(G.state.stash || []).includes('machao'))));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(47, 36, 'right'); check('夏侯楙 · 南安', await flag('c27_na'));
  await arrive(52, 13, 'up'); check('赵云单挑韩德父子', (await flag('c27_hd')) && (await ev(() => G.state.party.length === 5)));
  await arrive(12, 9, 'up');
  check('天水 · 收姜维 → 章末', (await flag('c27_jw')) && (await ev(() => G.state.party.includes('jiangwei'))) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十八章 ──');
  await setLv(58);
  check('开场（王平守街亭）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c28jieting' && G.state.party.join() === 'wangping,guanxing,zhangbao2')));
  await talk(34, 8, 'up'); check('王平谏马谡', await flag('c28_ms'));
  await arrive(22, 13, 'up'); check('失街亭 → 西城（孔明一人）', (await flag('c28_lost')) && (await ev(() => G.state.map === 'c28xicheng' && G.state.party.join() === 'zhugeliang')));
  await arrive(16, 10, 'up');
  check('空城计 · 挥泪斩马谡 → 章末', (await flag('c28_kong')) && (await ev(() => G.state.party.length === 6 && G.state.party.includes('wangping') && (G.state.items.qianjin || 0) >= 2)) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十九章 ──');
  await setLv(60);
  check('开场（赵云病逝）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c29chencang' && !G.state.party.includes('zhaoyun') && !(G.state.stash || []).includes('zhaoyun'))));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(22, 12, 'up'); check('陈仓 · 郝昭', await flag('c29_hz'));
  await arrive(40, 18, 'up');
  check('魏延斩王双 · 张苞坠涧 → 章末', (await flag('c29_ws')) && (await ev(() => !G.state.party.includes('zhangbao2'))) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第三十章 ──');
  await setLv(62);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c30longxi' && G.state.party.length === 5)));
  await ev(() => { G.world.m.encounters = null; });
  await talk(38, 33, 'up'); check('陇上割麦', await flag('c30_mai'));
  await arrive(30, 19, 'up'); check('郭淮', await flag('c30_gh'));
  await arrive(8, 16, 'left'); check('卤城夜战 · 司马懿', await flag('c30_lc'));
  await arrive(4, 37, 'down');
  check('木门道射张郃 · 关兴病逝 → 章末', (await flag('c30_end')) && (await ev(() => !G.state.party.includes('guanxing'))) && (await endToNext()) === 'ChapterEndScene');
  check('第七部完后进入第三十一章', await ev(() => G.state.chapter === 31 && G.scenes[0].constructor.name !== 'TitleScene'));
  }
  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（预计等级）──');
    const A27 = ['zhugeliang', 'zhaoyun', 'weiyan', 'guanxing', 'zhangbao2'], A29 = ['zhugeliang', 'weiyan', 'guanxing', 'zhangbao2', 'jiangwei', 'wangping'], A30 = ['zhugeliang', 'weiyan', 'guanxing', 'jiangwei', 'wangping'];
    const trials = [
      ['ch27魏军', ['weibing', 'weiqi', 'weinu'], 57, A27],
      ['hande', ['hande'], 57, ['zhaoyun']],
      ['jiangwei', ['jiangwei', 'weibing', 'weiqi'], 57, A27],
      ['zhanghe4', ['zhanghe4', 'weiqi', 'weibing'], 58, ['wangping', 'guanxing', 'zhangbao2']],
      ['simayi1', ['simayi1', 'weibing'], 58, ['zhugeliang']],
      ['haozhao', ['haozhao', 'weinu', 'weibing'], 60, A29],
      ['wangshuang', ['wangshuang'], 60, ['weiyan']],
      ['guohuai', ['guohuai', 'weiqi', 'weinu'], 62, A30],
      ['simayi2', ['simayi2', 'weiqi', 'weibing', 'weinu'], 62, A30],
      ['zhanghe5', ['zhanghe5', 'weiqi', 'weiqi'], 62, A30],
    ].filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t[0]));
    for (const [name, group, lv, party] of trials) {
      for (const smart of [false, true]) {
        let wins = 0; const N = +(process.env.N || 2);
        for (let k = 0; k < N; k++) {
          await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.joinParty('zhaoyun'); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c4world', 30, 26, 'up'); G.world.banner = null; G.fadeA = 0; G.state.flags.c11_wind = true; });
          await setLv(lv);
          await ev(([p]) => { G.state.party = p.slice(); for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'wuxing'; G.state.members.zhaoyun.wbonus = 40; G.restoreAll(); G.state.items.dahuan = 4; G.state.items.shenghui = 2; G.state.items.xuelian = 2; }, [party]);
          await ev(sm => { G.autoAI = sm ? smartAI : null; }, smart);
          await ev(([g, p]) => { G.run(() => G.battle(g, { boss: true, party: p })); }, [group, party]);
          await wait(500);
          if ((await drive(7000, 0)) === 'ok') wins++;
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
