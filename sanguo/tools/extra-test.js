/* 烽烟录 · 番外「桃园一梦」自动测试 + Boss 平衡统计：node tools/extra-test.js [--balance | --only-balance] */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8219);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8219/'); await page.waitForTimeout(600);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = ms => page.waitForTimeout(ms);
  const key = async (k, ms = 120) => { await page.keyboard.press(k); await wait(ms); };
  await ev(() => { G.speed = 4; try { localStorage.clear(); } catch (e) {}
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
        const it = ['shenyao', 'dabu', 'jinchuang'].find(k => (G.state.items[k] || 0) - cmds.filter(c => c.item === k).length > 0);
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
  const flag = k => ev(k => !!G.state.flags[k], k);
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
  const heal = () => ev(() => G.restoreAll());
  const talk = async (x, y, dir) => { await heal(); await place(x, y, dir); await wait(80); await page.keyboard.press('Enter'); await wait(150); return drive(); };
  const arrive = async (x, y, dir) => { await heal(); await place(x, y, dir); await ev(() => { G.world.cooldown = 0; }); await wait(80); await ev(() => G.world.onArrive()); await wait(150); return drive(); };
  const titleKeys = () => ev(() => G.scenes[0].items ? G.scenes[0].items().map(i => i.key) : []);

  if (!process.argv.includes('--only-balance')) {
    console.log('── 解锁 ──');
    await ev(() => G.toTitle()); await wait(300);
    check('未通关时标题没有「番外」', !(await titleKeys()).includes('ex'));
    check('未通关时章节选择没有「番外」', await ev(async () => { const p = G.chapterSelect(); await new Promise(r => setTimeout(r, 50)); const m = G.ui.stack ? G.ui.stack[G.ui.stack.length - 1] : null; const has = m && m.items ? m.items.some(i => i.label.startsWith('番外')) : null; G.ui.clear(); return has === false || has === null; }));
    await ev(() => { G.state = G.newState(); G.state.chapter = 34; G.setScene(new G.ChapterEndScene(34, G.CHAPTERS[34].endLines)); }); await wait(300);
    check('看完「全剧终」后解锁', await ev(() => G.exUnlocked()));
    await ev(() => G.toTitle()); await wait(300);
    check('标题出现「番外 · 桃园一梦」', (await titleKeys()).includes('ex'));

    console.log('── 番外开场 ──');
    await ev(() => { G.autoAI = smartAI; G.startExtra(); }); await wait(900);
    await key('Escape', 1500);
    check('开场', (await drive()) === 'ok' && (await ev(() => G.state.map === 'exdream' && G.state.chapter === 99 && G.state.party.length === 6)));
    check('全员 Lv72、穿昭烈铠', await ev(() => Object.keys(G.HEROES).every(id => G.state.members[id] && G.state.members[id].lvl === 72 && G.state.members[id].armor === 'zhaolie')));
    check('全员都在队伍或候补', await ev(() => Object.keys(G.HEROES).every(id => G.state.party.includes(id) || (G.state.stash || []).includes(id))));
    await ev(() => { G.autoAI = smartAI; });
    await talk(21, 27, 'right'); check('说书人', await flag('ex_intro'));

    console.log('── 点将台 ──');
    await heal(); await place(17, 20, 'left'); await wait(80);
    await key('Enter', 300); await key('Enter', 400);           // 对话 → 点将菜单
    await key('ArrowDown'); await key('Enter');                  // 关羽 下阵
    for (let i = 0; i < 6; i++) await key('ArrowDown', 60);      // 下移到第 8 个
    await key('Enter');                                          // 选一位候补上阵
    await key('Escape', 300);
    await drive();
    check('点将：换人后仍是 6 人，关羽下阵', await ev(() => G.state.party.length === 6 && !G.state.party.includes('guanyu') && G.state.stash.includes('guanyu')));
    await ev(() => { const s = G.state; const all = Object.keys(G.HEROES).filter(id => s.members[id]); s.party = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'pangtong']; s.stash = all.filter(id => !s.party.includes(id)); G.restoreAll(); G.world.refreshParty(); });

    console.log('── 擂台 ──');
    for (let i = 0; i < 5; i++) {
      await talk(31, 16, 'up');
      check(`擂台第 ${i + 1} 阵`, await ev(() => G.state.flags.ex_round || 0) === i + 1);
    }
    check('擂台全胜', await flag('ex_arena'));

    console.log('── 如果 ──');
    await talk(31, 24, 'right'); check('如果 · 荆州', await flag('ex_w1'));
    await talk(14, 11, 'left'); check('如果 · 五丈原', await flag('ex_w2'));

    console.log('── 旧物 ──');
    const relics = [[4, 4], [36, 3], [3, 20], [26, 28], [36, 18]];
    for (const [x, y] of relics) {
      const spot = await ev(([x, y]) => { const m = G.world.m; for (const [dx, dy, d] of [[1, 0, 'left'], [-1, 0, 'right'], [0, 1, 'up'], [0, -1, 'down']]) if (!m.solid(x + dx, y + dy)) return [x + dx, y + dy, d]; return null; }, [x, y]);
      if (spot) await talk(...spot);
    }
    check('五件旧物都已拾得', await ev(() => [1, 2, 3, 4, 5].every(i => G.state.flags['exr' + i])));

    console.log('── 天命 ──');
    await arrive(19, 9, 'up');
    check('天命出现并击败', await flag('ex_end'));
    for (let i = 0; i < 120; i++) { if ((await ev(() => G.scenes[0].constructor.name)) === 'ChapterEndScene') break; await key('Enter', 80); }
    check('片尾字幕 → 章末「番外 桃园一梦 完」', await ev(() => G.scenes[0].constructor.name === 'ChapterEndScene' && G.scenes[0].n === 99));
    await wait(4500); await key('Enter', 2600);
    check('回到标题', await ev(() => G.scenes[0].constructor.name === 'TitleScene'));
    check('章节选择可直接进入番外', await ev(() => typeof G.startFrom === 'function' && G.CHAPTERS[99] && G.chLabel(99) === '番外'));
  }

  if (process.argv.includes('--balance') || process.argv.includes('--only-balance')) {
    console.log('── Boss 平衡（Lv72，昭烈铠）──');
    const P1 = ['liubei', 'guanyu', 'zhangfei', 'zhugeliang', 'zhaoyun', 'pangtong'];
    const P2 = ['jiangwei', 'machao', 'huangzhong', 'weiyan', 'jianyong', 'sunshangxiang'];
    const trials = [
      ['张宝', ['mz_zhangbao', 'mz_huangjin', 'mz_huangjin'], P1], ['吕布', ['mz_lubu'], P1], ['周瑜', ['mz_zhouyu', 'mz_huangjin'], P1],
      ['曹操', ['mz_caocao', 'mz_huangjin', 'mz_huangjin'], P1], ['司马懿', ['mz_simayi', 'mz_huangjin', 'mz_huangjin'], P1],
      ['天命', ['tianming', 'moying', 'moying'], P1], ['天命(另一队)', ['tianming', 'moying', 'moying'], P2],
    ].filter(t => !process.env.ONLY || process.env.ONLY.split(',').includes(t[0]));
    for (const [name, group, party] of trials) {
      for (const smart of [false, true]) {
        let wins = 0; const N = +(process.env.N || 2);
        for (let k = 0; k < N; k++) {
          await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.state = G.newState(); G.ensureMembers(); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('exdream', 19, 28, 'up'); G.world.banner = null; G.fadeA = 0; Object.assign(G.state.flags, { c11_wind: true, c21_flood: true, c32_book: true }); });
          await ev(([p]) => { for (const id of Object.keys(G.state.members)) { const m = G.state.members[id]; m.lvl = 72; m.exp = G.expTo(72); m.armor = 'zhaolie'; } G.state.party = p.slice(); G.state.items = { shenyao: 8, lingzhi: 4, hanjia: 2, xuming: 5 }; G.restoreAll(); }, [party]);
          await ev(sm => { G.autoAI = sm ? smartAI : null; }, smart);
          await ev(([g, p]) => { G.run(() => G.battle(g, { boss: true, party: p })); }, [group, party]);
          await wait(500);
          if ((await drive(8000, 0)) === 'ok') wins++;
        }
        console.log(`  · ${name}（${party.length}人）${smart ? '会用策略' : '只会普攻'} 胜 ${wins}/${N}`);
      }
    }
  }
  console.log(errors.length ? '页面错误：\n' + [...new Set(errors)].join('\n') : '页面无报错');
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  await browser.close(); server.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
