/* 烽烟录 · 存档系统测试：多存档位、自动存档、读档、战败重新挑战 */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
let pass = 0, fail = 0;
const check = (n, ok, d) => { if (ok) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (d ? '  [' + d + ']' : '')); } };
(async () => {
  const server = await serve(8202);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8202/'); await page.waitForTimeout(600);
  const ev = (fn, a) => page.evaluate(fn, a);
  const wait = ms => page.waitForTimeout(ms);
  const key = async (k, n = 1) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(90); } };
  const scenes = () => ev(() => G.scenes.map(s => s.constructor.name).join('>'));
  await ev(() => { localStorage.clear(); G.speed = 3; });
  // 旧版存档迁移
  await page.reload(); await wait(500);
  await ev(() => { const st = G.newState(); st.chapter = 4; st.gold = 777; localStorage.setItem('fengyan_save_v1', JSON.stringify(st)); });
  await page.reload(); await wait(600);
  check('旧版存档迁移到自动存档位', await ev(() => { const d = G.readSlot(0); return d && d.state.gold === 777 && d.meta.chapter === 4; }));
  check('标题副标题显示存档章节', await ev(() => G.scenes[0].sub.includes('第四章')));
  await ev(() => { localStorage.clear(); G.speed = 3; });

  console.log('── 自动存档 ──');
  await ev(() => { G.state = G.newState(); G.state.chapter = 5; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c5xiaopei', 20, 20, 'down'); G.world.banner = null; G.fadeA = 0; });
  await wait(1500);
  check('进入地图后空闲时自动存档', await ev(() => { const d = G.readSlot(0); return d && d.state.map === 'c5xiaopei' && d.meta.place.length > 0; }));
  await ev(() => { G.setFlag('test_flag'); });
  await wait(300);
  check('剧情推进（设旗标）后自动存档', await ev(() => G.readSlot(0).state.flags.test_flag === true));

  console.log('── 军务菜单存档 ──');
  await key('Escape'); await wait(200);
  check('打开军务菜单', await ev(() => G.ui.modal()));
  await key('ArrowDown', 3); await key('Enter'); await wait(200);   // 记录进度
  await key('ArrowDown', 1); await key('Enter'); await wait(400);   // 存档二
  await key('Enter'); await wait(300);                              // 关闭提示
  check('写入存档二', await ev(() => { const d = G.readSlot(2); return d && d.state.map === 'c5xiaopei' && d.meta.chapter === 5; }));
  await key('Escape', 3); await wait(300);
  // 改变状态后再存一次到存档二：需要确认覆盖
  await ev(() => { G.state.gold = 4321; });
  await key('Escape'); await wait(200);
  await key('ArrowDown', 3); await key('Enter'); await wait(200);
  await key('ArrowDown', 1); await key('Enter'); await wait(300);
  await key('Enter'); await wait(300); // 确认覆盖
  await key('Enter'); await wait(300);
  check('覆盖存档二（需确认）', await ev(() => G.readSlot(2).state.gold === 4321));
  await key('Escape', 3); await wait(300);

  console.log('── 读档 ──');
  await ev(() => { G.state.gold = 1; G.world.load('c5world', 10, 10, 'down'); });
  await wait(300);
  await key('Escape'); await wait(200);
  await key('ArrowDown', 4); await key('Enter'); await wait(300); // 读取进度
  // 选中存档二：自动存档为第 0 项，存档一为空（跳过），存档二
  await ev(() => { const m = G.ui.stack ? null : null; });
  const idx = await ev(() => { const top = G.ui.top ? G.ui.top() : null; return top ? top.idx : -1; });
  await key('ArrowDown', 2); await key('Enter'); await wait(250);
  await key('Enter'); await wait(1800);
  check('从军务菜单读取存档二', await ev(() => G.state.gold === 4321 && G.state.map === 'c5xiaopei'), await ev(() => G.state.gold + ' ' + G.state.map));
  check('读档后可以操作（未锁死）', await ev(() => !G.locked()));

  console.log('── 战败 · 重新挑战 ──');
  await ev(() => { G.state.items.dabu = 5; G.state.gold = 999; for (const id of G.state.party) G.state.members[id].hp = 1; G.speed = 4; G.run(async () => { const r = await G.battle(['lubu2'], { boss: true }); window.__res = r; }); });
  let over = false;
  for (let i = 0; i < 400 && !over; i++) { over = await ev(() => G.scenes.some(s => s.constructor.name === 'GameOverScene')); if (!over) await key('Enter'); }
  check('战败画面出现', over, await scenes() + ' busy=' + await ev(() => G.scriptBusy) + ' ' + await ev(() => JSON.stringify(G.state.party.map(p => G.state.members[p].hp))));
  await wait(2600);
  check('战败画面有“重新挑战”', await ev(() => G.scenes[G.scenes.length - 1].opts().map(o => o[1]).join() === 'retry,load,title'));
  await ev(() => { G.state.gold = 0; });
  await key('Enter'); await wait(1500);
  check('重新挑战回到战斗', await ev(() => G.scenes[G.scenes.length - 1] instanceof G.BattleScene), await scenes());
  check('状态恢复到战前', await ev(() => G.state.gold === 999 && G.state.items.dabu === 5));
  // 这次让队伍满血并强化，打赢
  await ev(() => { const b = G.scenes[G.scenes.length - 1]; for (const e of b.enemies) { e.hp = 1; e.spd = 1; } for (const p of b.party) p.hp = p.maxhp; });
  for (let i = 0; i < 200; i++) { const s = await ev(() => G.scenes[G.scenes.length - 1] instanceof G.BattleScene); if (!s) break; await key('Enter'); }
  await wait(1000);
  check('重新挑战获胜后剧情继续', await ev(() => window.__res === 'win'), await ev(() => String(window.__res)));
  check('战后场景正常', (await scenes()) === 'WorldScene');

  console.log('── 战败 · 读取进度 ──');
  await ev(() => { window.__res = null; for (const id of G.state.party) G.state.members[id].hp = 1; G.run(async () => { window.__res = await G.battle(['lubu2'], { boss: true }); }); });
  over = false;
  for (let i = 0; i < 400 && !over; i++) { over = await ev(() => G.scenes.some(s => s.constructor.name === 'GameOverScene')); if (!over) await key('Enter'); }
  await wait(2600);
  await key('ArrowDown'); await key('Enter'); await wait(300);  // 读取进度
  await key('ArrowDown', 2); await key('Enter'); await wait(2000); // 存档二
  check('战败后读档进入地图', (await scenes()) === 'WorldScene' && (await ev(() => G.state.map === 'c5xiaopei')), await scenes());
  check('读档后未锁死', await ev(() => !G.locked()), await ev(() => G.scriptBusy));

  console.log('── 标题读档 ──');
  await ev(() => { G.toTitle(); });
  await wait(400);
  check('标题有“读取进度”', await ev(() => G.scenes[0].items().map(i => i.label).includes('读取进度')));
  await ev(() => { G.scenes[0].idx = 2; });
  await key('Enter'); await wait(300);
  await key('ArrowDown', 2); await key('Enter'); await wait(2000);
  check('标题读取存档二', (await scenes()) === 'WorldScene' && (await ev(() => G.state.map === 'c5xiaopei' && !G.locked())));

  console.log('── 审查回归：自动存档不被一键覆盖 ──');
  await ev(() => { localStorage.clear(); G.state = G.newState(); G.state.chapter = 34; G.writeSlot(0); G.toTitle(); });
  await wait(400);
  check('有进度时标题默认选中“继续征程”', await ev(() => G.scenes[0].items()[G.scenes[0].idx].key === 'cont'));
  await ev(() => { G.scenes[0].idx = 0; });
  await key('Enter'); await wait(400);
  check('选“新的征程”先弹出覆盖确认（默认“取消”）', await ev(() => G.ui.stack.length > 0 && G.ui.stack[G.ui.stack.length - 1].title === '会覆盖自动存档' && G.ui.stack[G.ui.stack.length - 1].idx === 1));
  await key('Enter'); await wait(400);
  check('取消后仍在标题、自动存档仍是第 34 章', (await scenes()) === 'TitleScene' && (await ev(() => G.readSlot(0).meta.chapter === 34)));
  await ev(() => { G.scenes[0].busy = false; G.scenes[0].idx = 0; });
  await key('Enter'); await wait(300); await key('ArrowUp'); await key('Enter'); await wait(1500);
  check('确认后才开始新游戏', await ev(() => G.state.chapter === 1 && G.readSlot(0).meta.chapter === 1));

  console.log('── 审查回归：存档失败如实报告 ──');
  const fail1 = await ev(() => {
    localStorage.clear(); G.state = G.newState(); G.state.gold = 100; const ok1 = G.writeSlot(2);
    const orig = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); };
    G.state.gold = 200; const ok2 = G.writeSlot(2);
    Storage.prototype.setItem = orig;
    return { ok1, ok2, memGold: G.readSlot(2).state.gold, diskGold: JSON.parse(localStorage.getItem('fengyan_slot_2')).state.gold };
  });
  check('写入成功返回 true，被拒绝返回 false', fail1.ok1 === true && fail1.ok2 === false, JSON.stringify(fail1));
  check('失败后本次会话读到的是新值（200），磁盘上仍是旧值', fail1.memGold === 200 && fail1.diskGold === 100, JSON.stringify(fail1));
  const fail2 = await ev(() => { G.state.gold = 300; const ok = G.writeSlot(2); return { ok, disk: JSON.parse(localStorage.getItem('fengyan_slot_2')).state.gold, read: G.readSlot(2).state.gold }; });
  check('恢复写入后再存，磁盘与读取都是新值', fail2.ok && fail2.disk === 300 && fail2.read === 300, JSON.stringify(fail2));
  await ev(() => { G.ui.clear(); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c17chengdu', 19, 20, 'up'); G.world.banner = null; G.fadeA = 0;
    window._origSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); };
    G.run(() => G.saveMenu()); });
  await wait(400); await key('Enter'); await wait(500);
  const msg = await ev(() => { const t = G.ui.stack[G.ui.stack.length - 1]; Storage.prototype.setItem = window._origSet; return t && t.lines ? t.lines.join('') : ''; });
  check('军务菜单存档失败时提示“刷新后会丢失”，不再显示“进度已记录”', /刷新/.test(msg) && !/已记录/.test(msg), msg);
  await ev(() => G.ui.clear());

  console.log('── 复审回归：道具与护甲 ──');
  await ev(() => { G.ui.clear(); G.state = G.newState(); G.restoreAll(); G.state.items = { binliang: 1, tiejia: 1 }; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c17chengdu', 19, 20, 'up'); G.world.banner = null; G.fadeA = 0; });
  await ev(() => { G.run(async () => { window._r1 = await G.useItemField('binliang'); }); }); await wait(300); await key('Enter'); await wait(300);
  check('全员满兵时兵粮不消耗', await ev(() => window._r1 === false && G.state.items.binliang === 1));
  await ev(() => { G.state.members.guanyu.hp = 10; G.run(async () => { window._r2 = await G.useItemField('binliang'); }); }); await wait(300); await key('Enter'); await wait(300);
  check('有人受伤时兵粮消耗一份并恢复', await ev(() => window._r2 === true && G.state.items.binliang === 0 && G.state.members.guanyu.hp > 10));
  await ev(() => { G.state.members.liubei.armor = 'pijia'; G.run(async () => { window._r3 = await G.useItemField('tiejia'); }); }); await wait(400);
  await key('Enter'); await wait(400); await key('Enter'); await wait(300);   // 选刘备 → 关闭提示
  check('行囊里的铁甲可交给部将穿戴，换下的皮甲回到行囊', await ev(() => window._r3 === true && G.state.members.liubei.armor === 'tiejia' && !G.state.items.tiejia && G.state.items.pijia === 1), await ev(() => JSON.stringify({ r: window._r3, a: G.state.members.liubei.armor, it: G.state.items })));

  console.log('── 复审回归：通关后继续 ──');
  await ev(() => { G.ui.clear(); localStorage.clear(); G.state = G.newState(); G.state.chapter = 34; G.state.flags.c34_end = true; G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('c17chengdu', 19, 20, 'up'); G.fadeA = 0; G.chapterEnd(G.CHAPTERS[34].endLines); });
  await wait(3000);
  check('终章结算后存档标记为已通关', await ev(() => G.readSlot(0).meta.cleared === 34 && !G.readSlot(0).state.map));
  await ev(() => { G.toTitle(); }); await wait(400);
  await ev(() => G.continueGame()); await wait(2500);
  check('「继续征程」播放结局回顾，而不是进入空地图', await ev(() => G.scenes[0].constructor.name === 'ChapterEndScene' && G.scenes[0].n === 34));
  await ev(() => { localStorage.clear(); const st = G.newState(); st.chapter = 34; st.map = 'c34mianzhu'; st.flags.c34_end = true; localStorage.setItem('fengyan_slot_0', JSON.stringify({ meta: { chapter: 34, time: 1 }, state: st })); G.toTitle(); }); await wait(300);
  await ev(() => G.continueGame(0)); await wait(2500);
  check('旧版通关存档（无标记）继续时也播放结局回顾', await ev(() => G.scenes[0].constructor.name === 'ChapterEndScene' && G.scenes[0].n === 34), await ev(() => JSON.stringify({ sc: G.scenes.map(s => s.constructor.name), n: G.scenes[0].n, ch: G.state.chapter, map: G.state.map, busy: G.scriptBusy, ui: G.ui.stack.length })));
  await ev(() => { G.toTitle(); });

  console.log('── 审查回归：首领战撤退 ──');
  const retreat = await ev(async () => {
    G.autoAI = null; G.state = G.newState(); G.restoreAll();
    G.run(() => G.battle(['dengmao'], { boss: true })); await new Promise(r => setTimeout(r, 2500));
    const m = G.ui.stack[G.ui.stack.length - 1]; const it = m && m.items ? m.items[4] : null;
    return it ? { label: it.label, disabled: !!it.disabled } : null;
  });
  check('首领战“撤退”不可选，并写明“无法撤退”', retreat && retreat.disabled && retreat.label === '无法撤退', JSON.stringify(retreat));

  console.log(errors.length ? '页面错误：\n' + [...new Set(errors)].join('\n') : '页面无报错');
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  await browser.close(); server.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
