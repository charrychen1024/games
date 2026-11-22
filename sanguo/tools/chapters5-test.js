/* 烽烟录 · 第十八至二十二章主线自动测试 + Boss 平衡统计：node tools/chapters-test.js [--balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8205);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8205/'); await page.waitForTimeout(600);
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
  const setLv = lv => ev(lv => { for (const id of Object.keys(G.state.members)) { const m = G.state.members[id]; m.lvl = lv; m.exp = G.expTo(lv); } for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'shujin'; G.restoreAll(); G.state.items.jinchuang = 6; G.state.items.xuming = 3; G.state.items.dahuan = 4; G.autoAI = smartAI; }, lv);
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
  console.log('── 第十七章 → 第十八章 ──');
  await ev(() => { G.state = G.newState(); for (const id of ['zhaoyun', 'zhugeliang', 'huangzhong', 'machao']) G.joinParty(id); G.state.party = ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao']; G.state.stash = ['guanyu', 'jianyong', 'weiyan']; G.state.chapter = 17; G.state.flags.c11_wind = true; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c17chengdu', 19, 20, 'up'); G.fadeA = 0; });
  await ev(() => G.chapterEnd(G.CHAPTERS[17].endLines)); await wait(1500);
  check('第十七章结束后进入第十八章', (await endToNext()) === 'ChapterEndScene' && (await ev(() => G.state.chapter === 18)));
  console.log('── 第十八章 ──');
  await setLv(45);
  check('开场（关羽单人）', (await drive()) === 'ok' && (await ev(() => G.state.party.join() === 'guanyu' && G.state.map === 'c18jiangling')));
  await talk(19, 15, 'up'); check('诸葛瑾索荆州', await flag('c18_jin'));
  await talk(19, 23, 'up'); check('鲁肃请宴', await flag('c18_invite'));
  await goto('c18lukou', 13, 30, 'up'); await drive();
  { const d = await talk(15, 7, 'up'); check('单刀赴会 · 刀斧手', await flag('c18_feast'), d + ' ' + (await ev(() => JSON.stringify({ m: G.state.map, x: G.world.lead.x, y: G.world.lead.y, dir: G.world.lead.dir, lk: G.state.flags.c18_lk, p: G.state.party, sc: G.scenes.map(s => s.constructor.name), solid: G.world.m.solid(15, 7) })))); }
  await arrive(13, 25, 'up');
  check('甘宁拦江 → 章末', (await flag('c18_end')) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第十九章 ──');
  await setLv(47);
  check('开场（汉中六将）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c19world' && G.state.party.join() === 'liubei,zhugeliang,zhangfei,zhaoyun,huangzhong,machao')));
  await ev(() => { G.world.m.encounters = null; });
  check('未取天荡山不能去定军山', await ev(() => { const w = G.world.m.warps.find(w => w.to === 'c19dingjun'); return !w.cond(); }));
  await arrive(52, 24, 'right'); check('瓦口关 · 张飞诈醉破张郃', await flag('c19_wakou'));
  await arrive(23, 3, 'up'); check('天荡山烧粮', await flag('c19_td'));
  await goto('c19dingjun', 2, 30, 'right'); await drive();
  await talk(11, 6, 'up'); check('法正举旗 → 黄忠单骑', (await flag('c19_flag')) && (await ev(() => G.state.party.join() === 'huangzhong')));
  await arrive(33, 10, 'up');
  check('黄忠斩夏侯渊 → 章末', (await flag('c19_end')) && (await ev(() => G.state.party.length === 6)) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十章 ──');
  await setLv(48);
  check('开场（赵云单人）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c20hanshui' && G.state.party.join() === 'zhaoyun')));
  await arrive(20, 5, 'up'); check('单骑救黄忠', await flag('c20_rescue'));
  await arrive(20, 20, 'down'); check('空营计 → 斜谷全军', (await flag('c20_kong')) && (await ev(() => G.state.map === 'c20xiegu' && G.state.party.includes('weiyan'))));
  await arrive(16, 22, 'up'); check('许褚', await flag('c20_xu'));
  await talk(17, 7, 'up');
  check('鸡肋 · 魏延射曹操 · 汉中王 → 章末', (await flag('c20_cc')) && (await ev(() => (G.state.items.longwen || 0) >= 2)) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十一章 ──');
  await setLv(50);
  check('开场（关羽、关平、周仓）', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c21fancheng' && G.state.party.join() === 'guanyu,guanping,zhoucang')));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(22, 15, 'up'); check('庞德抬榇 · 关公中箭', (await flag('c21_pd1')) && (await ev(() => G.state.party.length === 3)));
  await talk(38, 11, 'up'); check('观罾口川 · 水淹七军', (await flag('c21_flood')) && (await ev(() => G.state.map === 'c21flood' && G.skillsOf('guanyu').includes('weizhen'))));
  await arrive(18, 19, 'up'); check('擒于禁', await flag('c21_yu'));
  await talk(4, 18, 'left'); check('周仓水中擒庞德', (await flag('c21_pd')) && (await ev(() => G.state.party.length === 3)));
  await arrive(19, 5, 'up');
  check('曹仁 · 刮骨疗毒 → 章末', (await flag('c21_end')) && (await endToNext()) === 'ChapterEndScene');
  console.log('── 第二十二章 ──');
  await setLv(51);
  check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map === 'c22retreat' && G.state.party.length === 3)));
  await ev(() => { G.world.m.encounters = null; });
  await arrive(26, 8, 'down'); check('徐晃', await flag('c22_xu'));
  await arrive(44, 36, 'down'); check('荆州失陷 · 军心离散', await flag('c22_lv'));
  await goto('c22maicheng', 15, 33, 'up'); await drive();
  await talk(15, 28, 'up'); check('诸葛瑾劝降', await flag('c22_jin'));
  await talk(17, 31, 'right'); check('周仓留守 · 夜出北门', (await flag('c22_out')) && (await ev(() => G.state.party.join() === 'guanyu,guanping' && !G.state.members.zhoucang.armor)));
  await arrive(15, 8, 'up');
  check('临沮 · 关公归天', (await flag('c22_end')) && (await ev(() => !G.state.party.includes('guanyu') && !(G.state.stash || []).includes('guanyu') && G.state.party.length === 6 && G.state.sp === G.state.sp)));
  check('第五部完 → 章末', (await endToNext()) === 'ChapterEndScene');
  check('第五部完后进入第二十三章', await ev(() => G.state.chapter === 23 && G.scenes[0].constructor.name !== 'TitleScene'));
  }
  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（预计等级）──');
    const HZ = ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'machao'], JZ = ['guanyu', 'guanping', 'zhoucang'];
    const trials = [
      ['ch18刀斧手', ['wubing3', 'wugong3'], 45, ['guanyu']],
      ['ganning', ['ganning'], 45, ['guanyu']],
      ['zhanghe3', ['zhanghe3', 'caobing7', 'caoqi7'], 46, HZ],
      ['天荡山', ['caobing7', 'caoshe7', 'caobing7', 'caoqi7'], 46, HZ],
      ['xiahouyuan_t', ['xiahouyuan_t'], 47, ['huangzhong']],
      ['xiahouyuan', ['xiahouyuan'], 47, ['huangzhong']],
      ['ch20救黄忠', ['caoqi7', 'caobing7'], 47, ['zhaoyun']],
      ['xuhuang2', ['xuhuang2'], 48, ['zhaoyun']],
      ['xuchu4', ['xuchu4', 'caoqi7', 'caobing7'], 48, ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'weiyan']],
      ['caocao', ['caocao', 'caoshe7', 'caobing7', 'caoqi7'], 48, ['liubei', 'zhugeliang', 'zhangfei', 'zhaoyun', 'huangzhong', 'weiyan']],
      ['pangde', ['pangde'], 49, ['guanyu']],
      ['yujin2', ['yujin2', 'caobing8', 'caoshe8'], 49, JZ],
      ['pangde2', ['pangde2'], 49, ['zhoucang']],
      ['caoren2', ['caoren2', 'caobing8', 'caoshe8', 'caobing8'], 50, JZ],
      ['xuhuang3', ['xuhuang3', 'caobing8', 'caoshe8'], 50, JZ],
      ['ch22吴军', ['wubing4', 'wugong4', 'wubing4'], 50, JZ],
      ['panzhang', ['panzhang', 'wubing4', 'wugong4'], 51, ['guanyu', 'guanping']],
    ].filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t[0]));
    for (const [name, group, lv, party] of trials) {
      for (const smart of [false, true]) {
        let wins = 0; const N = +(process.env.N || 2);
        for (let k = 0; k < N; k++) {
          await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.joinParty('zhaoyun'); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c4world', 30, 26, 'up'); G.world.banner = null; G.fadeA = 0; G.state.flags.c11_wind = true; G.state.flags.c21_flood = true; });
          await setLv(lv);
          await ev(([p]) => { G.state.party = p.slice(); for (const id of Object.keys(G.state.members)) G.state.members[id].armor = 'shujin'; G.state.members.zhaoyun.wbonus = 40; G.restoreAll(); G.state.items.dahuan = 4; G.state.items.shenghui = 2; G.state.items.xuelian = 2; }, [party]);
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
