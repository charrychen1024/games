/* 烽烟录 · 第二十三至二十六章主线自动测试 + Boss 平衡统计：node tools/chapters-test.js [--balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8206);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8206/'); await page.waitForTimeout(600);
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
  const setLv = lv => ev(lv => { for (const id of Object.keys(G.state.members)) { const m = G.state.members[id]; m.lvl = lv; m.exp = G.expTo(lv); } for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'longwen'; G.restoreAll(); G.state.items.jinchuang = 6; G.state.items.xuming = 3; G.state.items.dahuan = 4; G.autoAI = smartAI; }, lv);
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



  // 泸水：自动选"等到半夜再渡"
  await ev(() => { setInterval(() => { const t = G.ui.stack[G.ui.stack.length - 1]; if (t && t.items && t.items[1] && t.items[1].label === '等到半夜再渡') t.idx = 1; }, 15); });
  if (!process.argv.includes('--only-balance')) {
  console.log('── 第二十二章 → 第二十三章 ──');
  await ev(() => { G.state = G.newState(); for (const id of ['zhaoyun', 'zhugeliang', 'huangzhong', 'machao']) G.joinParty(id); G.state.party = ['liubei', 'zhangfei', 'zhaoyun', 'zhugeliang', 'huangzhong', 'machao']; G.state.stash = ['jianyong', 'weiyan']; G.state.chapter = 22; G.state.flags.c11_wind = true; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c17chengdu', 19, 20, 'up'); G.fadeA = 0; });
  await ev(() => G.chapterEnd(G.CHAPTERS[22].endLines)); await wait(1500);
  check('第二十二章结束后进入第二十三章', (await endToNext()) === 'ChapterEndScene' && (await ev(() => G.state.chapter === 23)));
  console.log('── 第二十三章 ──');
  await setLv(52);
  check('开场（张飞遇害，关兴张苞从征）', (await drive()) === 'ok' && (await ev(() => G.state.party.join() === 'liubei,huangzhong,guanxing,zhangbao2' && !G.state.party.includes('zhangfei') && !(G.state.stash || []).includes('zhangfei'))));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(38, 20, 'left'); check('吴军前哨', await flag('c23_out'));
  await arrive(23, 37, 'up'); check('关公显圣 · 关兴斩潘璋', (await flag('c23_pz')) && (await ev(() => G.state.party.length === 4)));
  await goto('c23xiaoting', 37, 15, 'left'); await drive();
  await arrive(21, 15, 'left');
  check('猇亭 · 黄忠殒命 → 章末', (await flag('c23_end')) && (await ev(() => !G.state.party.includes('huangzhong'))) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十四章 ──');
  await setLv(53);
  check('开场（火烧连营）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c24lianying' && G.state.party.join() === 'liubei,guanxing,zhangbao2')));
  await arrive(39, 14, 'left'); check('吴军火攻兵', await flag('c24_a'));
  await arrive(23, 15, 'left'); check('赵云救驾 · 朱然', (await flag('c24_zr')) && (await ev(() => G.state.party.includes('zhaoyun'))));
  await arrive(10, 15, 'left'); check('陆逊 · 八阵图', await flag('c24_lu'));
  await goto('c24baidi', 17, 26, 'up'); await drive();
  await talk(16, 11, 'up');
  check('白帝托孤 → 章末', (await flag('c24_end')) && (await ev(() => !G.state.party.includes('liubei') && !(G.state.stash || []).includes('liubei'))) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十五章 ──');
  await setLv(54);
  check('开场（诸葛亮南征）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c25nanzhong' && G.state.party.join() === 'zhugeliang,zhaoyun,weiyan,guanxing,zhangbao2,machao')));
  await ev(() => { G.world.m.encounters = null; });
  await talk(29, 7, 'left'); check('吕凯献图', await flag('c25_lk'));
  await arrive(30, 14, 'up'); check('一擒孟获', await flag('c25_m1'));
  await arrive(31, 17, 'down'); check('泸水渡口蛮兵', await flag('c25_fg'));
  await arrive(30, 19, 'down'); check('夜渡泸水', (await flag('c25_ferry')) && (await ev(() => G.world.lead.y > 25)));
  await ev(() => { G.world.m.encounters = null; });
  await talk(29, 29, 'up'); check('董荼那绑孟获 · 二擒', await flag('c25_m2'));
  await talk(48, 39, 'right'); check('孟优诈降 · 三擒', await flag('c25_m3'));
  await arrive(10, 41, 'left');
  check('西洱河陷坑 · 四擒 → 章末', (await flag('c25_m4')) && (await ev(() => G.state.flags.c25_cap === 4)) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十六章 ──');
  await setLv(55);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c26yinkeng')));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(28, 20, 'down'); check('没有解药被瘴气逼退', await ev(() => G.world.lead.y === 18 && !G.state.flags.c26_cure));
  await talk(7, 11, 'left'); check('孟节赠薤叶芸香', await flag('c26_cure'));
  await arrive(28, 22, 'down'); check('杨锋献孟获 · 五擒', await flag('c26_m5'));
  await arrive(28, 34, 'down'); check('祝融夫人', await flag('c26_zr'));
  await arrive(28, 36, 'down'); check('木鹿大王 · 六擒', await flag('c26_m6'));
  await goto('c26panshe', 17, 33, 'up'); await drive();
  await arrive(15, 25, 'up'); check('藤甲兵（只能用火）', await flag('c26_tj'));
  await arrive(17, 13, 'up'); check('兀突骨 · 火烧盘蛇谷', await flag('c26_wtg'));
  await arrive(17, 6, 'up');
  check('七擒孟获 · 南中平定 → 章末', (await flag('c26_end')) && (await ev(() => G.state.flags.c25_cap === 7 && (G.state.items.wuxing || 0) >= 1)) && (await endToNext()) === 'ChapterEndScene');
  check('第六部完后进入第二十七章', await ev(() => G.state.chapter === 27 && G.scenes[0].constructor.name !== 'TitleScene'));
  }
  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（预计等级）──');
    const YL = ['liubei', 'huangzhong', 'guanxing', 'zhangbao2'], NAN = ['zhugeliang', 'zhaoyun', 'weiyan', 'guanxing', 'zhangbao2', 'machao'];
    const trials = [
      ['ch23前哨', ['wubing5', 'wugong5', 'wubing5'], 52, YL],
      ['panzhang2', ['panzhang2'], 52, ['guanxing']],
      ['mazhong', ['mazhong', 'wubing5', 'wugong5'], 52, YL],
      ['ch24火攻', ['wubing6', 'wubing6', 'wugong5'], 53, ['liubei', 'guanxing', 'zhangbao2']],
      ['zhuran', ['zhuran', 'wubing6', 'wugong5'], 53, ['liubei', 'zhaoyun', 'guanxing', 'zhangbao2']],
      ['luxun', ['luxun', 'wubing6', 'wubing6', 'wugong5'], 53, ['liubei', 'zhaoyun', 'guanxing', 'zhangbao2']],
      ['menghuo1', ['menghuo1', 'manbing', 'mangong'], 54, NAN],
      ['menghuo2', ['menghuo2', 'manbing', 'manwu', 'manbing'], 54, NAN],
      ['zhurong', ['zhurong', 'manbing', 'manbing'], 55, NAN],
      ['mulu', ['mulu', 'manbing', 'manwu'], 55, NAN],
      ['tengjia', ['tengjia', 'tengjia', 'tengjia'], 55, NAN],
      ['wutugu', ['wutugu', 'tengjia', 'tengjia'], 55, NAN],
      ['menghuo3', ['menghuo3', 'manbing', 'mangong', 'manwu'], 56, NAN],
    ].filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t[0]));
    for (const [name, group, lv, party] of trials) {
      for (const smart of [false, true]) {
        let wins = 0; const N = +(process.env.N || 2);
        for (let k = 0; k < N; k++) {
          await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.joinParty('zhaoyun'); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c4world', 30, 26, 'up'); G.world.banner = null; G.fadeA = 0; G.state.flags.c11_wind = true; });
          await setLv(lv);
          await ev(([p]) => { G.state.party = p.slice(); for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'longwen'; G.state.members.zhaoyun.wbonus = 40; G.restoreAll(); G.state.items.dahuan = 4; G.state.items.shenghui = 2; G.state.items.xuelian = 2; }, [party]);
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
