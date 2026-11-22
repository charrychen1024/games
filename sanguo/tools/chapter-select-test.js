/* 烽烟录 · 章节选择测试：从每一章直接开始，检查开场能正常走完：node tools/chapter-select-test.js */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8209);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8209/'); await page.waitForTimeout(600);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = ms => page.waitForTimeout(ms);
  await ev(() => { G.speed = 4; });
  const drive = async (max = 600) => {
    let idle = 0;
    for (let i = 0; i < max; i++) {
      const s = await ev(() => ({ busy: G.locked(), battle: G.scenes[G.scenes.length - 1] instanceof G.BattleScene }));
      if (!s.busy && !s.battle) { if (++idle > 3) return 'ok'; await wait(60); continue; }
      idle = 0; await page.keyboard.press('Enter'); await wait(45);
    }
    return 'timeout';
  };
  // 各章开场时（开场脚本跑完后）必须具备的状态，对照自然通关
  const EXPECT = {
    12: { wbonus: { zhaoyun: 40 }, skills: [['zhugeliang', 'dongfeng']] },
    15: { roster: ['sunshangxiang'] },
    16: { roster: ['pangtong'] },
    22: { party: ['guanyu', 'guanping', 'zhoucang'], skills: [['guanyu', 'weizhen']] },
    24: { wbonus: { zhaoyun: 40, guanxing: 20 } },
    33: { skills: [['jiangwei', 'qixing']] },
    34: { skills: [['jiangwei', 'qixing']] },
  };
  // 标题画面上真的有「章节选择」
  check('标题菜单有「章节选择」', await ev(() => G.scenes[0].items().some(i => i.label === '章节选择')));
  // 章节随主线推进解锁：新玩家只能选第一章
  const peek = () => ev(async () => {
    G.ui.clear(); const p = G.chapterSelect(); await new Promise(r => setTimeout(r, 30));
    const m = G.ui.stack[G.ui.stack.length - 1]; const r = { title: m.title, open: m.items.filter(i => !i.disabled).length, locked: m.items.filter(i => i.disabled).length, idx: m.idx, label: m.items[m.idx].label };
    G.ui.clear(); return r;
  });
  await ev(() => { localStorage.clear(); G._reached = 0; });
  let sel = await peek();
  check('新玩家：只开放第一章，其余锁定', sel.open === 1 && sel.locked === 33 && /已解锁 1 \/ 34/.test(sel.title), JSON.stringify(sel));
  await ev(() => { G.state = G.newState(); G.state.chapter = 5; G.writeSlot(1); });
  sel = await peek();
  check('旧存档玩到第五章：开放一至五章，光标停在第五章', sel.open === 5 && sel.label.startsWith('第五章'), JSON.stringify(sel));
  await ev(() => { localStorage.clear(); G._reached = 0; G.state = G.newState(); G.startChapter(7); });
  await wait(400);
  sel = await peek();
  check('开始第七章后记住进度：开放一至七章', sel.open === 7 && (await ev(() => localStorage.getItem('fengyan_ch_reached'))) === '7', JSON.stringify(sel));
  await ev(() => { G.markReached(34); });
  sel = await peek();
  check('通关后全部开放', sel.open === 34 && sel.locked === 0, JSON.stringify(sel));
  const ns = await ev(() => Object.keys(G.CHAPTERS).map(Number).sort((a, b) => a - b).filter(n => n > 1));
  for (const n of ns) {
    const before = errors.length;
    await ev(n => { G.ui.clear(); G.scriptBusy = 0; G.startFrom(n); }, n);
    await wait(900); await page.keyboard.press('Escape'); await wait(1500);
    const d = await drive();
    const st = await ev(() => ({ ch: G.state.chapter, map: G.state.map, party: G.state.party.slice(), lvl: G.state.party.length ? G.state.members[G.state.party[0]].lvl : 0, top: G.scenes[0].constructor.name }));
    check(`第${n}章 开场`, d === 'ok' && st.ch === n && !!st.map && st.party.length > 0 && st.top === 'WorldScene' && errors.length === before, `${d} ${JSON.stringify(st)} ${errors.slice(before).join(' | ')}`);
    // 跳章与自然通关应一致：剧情要用到的部将在队、永久武器加成、剧情习得的策略
    const want = EXPECT[n];
    if (want) {
      const got = await ev(w => {
        const s = G.state, roster = s.party.concat(s.stash || []), bad = [];
        for (const id of w.party || []) if (!s.party.includes(id)) bad.push('不在队:' + id);
        for (const id of w.roster || []) if (!roster.includes(id)) bad.push('缺部将:' + id);
        for (const [id, v] of Object.entries(w.wbonus || {})) if ((s.members[id].wbonus || 0) !== v) bad.push(`${id}.wbonus=${s.members[id].wbonus || 0}`);
        for (const [id, k] of w.skills || []) if (!G.skillsOf(id).includes(k)) bad.push(`${id}缺策略:${k}`);
        for (const id of w.party || []) if (!s.members[id].armor) bad.push('无护甲:' + id);
        return bad;
      }, want);
      check(`第${n}章 跳章状态与剧情一致`, got.length === 0, got.join(' '));
    }
  }
  console.log(errors.length ? '页面错误：\n' + [...new Set(errors)].join('\n') : '页面无报错');
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  await browser.close(); server.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
