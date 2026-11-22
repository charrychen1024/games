/* 烽烟录 · 自动通关测试：node tools/playtest.js
 * 用真实按键驱动主线流程，检查剧情旗标、场景切换与战斗结算，并统计 Boss 战胜率。 */
const path = require('path');
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
const PORT = 8192;
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '  [' + detail + ']' : '')); } };

(async () => {
  const server = await serve(PORT);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForTimeout(800);
  const ev = (fn, a) => Promise.race([page.evaluate(fn, a), new Promise((_, rej) => setTimeout(() => rej(new Error('evaluate timeout: ' + fn.toString().slice(0, 80))), 15000))]);
  const wait = ms => page.waitForTimeout(ms);
  const press = async (k, n = 1, gap = 90) => { for (let i = 0; i < n; i++) { await page.keyboard.press(k); await wait(gap); } };
  const busy = () => ev(() => G.locked());
  // 一直按确认直到脚本结束
  const advance = async (max = 200) => { for (let i = 0; i < max; i++) { if (!(await busy())) { await wait(150); if (!(await busy())) return true; } await press('Enter', 1, 110); } return false; };
  const hold = async (k, ms) => { await page.keyboard.down(k); await wait(ms); await page.keyboard.up(k); };
  const place = (x, y, dir) => ev(([x, y, dir]) => { const w = G.world; w.party.forEach((u, i) => w.place(i, x, y, dir)); G.state.x = x; G.state.y = y; }, [x, y, dir]);
  const state = () => ev(() => ({ map: G.state && G.state.map, x: G.state && G.state.x, y: G.state && G.state.y, flags: G.state && G.state.flags, party: G.state && G.state.party, gold: G.state && G.state.gold, items: G.state && G.state.items, scenes: G.scenes.map(s => s.constructor.name) }));
  const inBattle = () => ev(() => G.scenes[G.scenes.length - 1] instanceof G.BattleScene);
  // 自动战斗：全部普通攻击（最笨的打法）
  const autoBattle = async (max = 900) => {
    for (let i = 0; i < max; i++) {
      const s = await ev(() => { const top = G.scenes[G.scenes.length - 1]; return { battle: top instanceof G.BattleScene, over: top.constructor.name === 'GameOverScene' }; });
      if (!s.battle || s.over) return s.over ? 'lose' : 'done';
      await press('Enter', 1, 70);
    }
    return 'timeout';
  };

  console.log('── 开场 ──');
  await press('Enter'); await wait(1200);
  await press('Escape'); await wait(2600);
  check('序章后进入桃园', (await state()).map === 'taoyuan');
  check('开场剧情可推进完毕', await advance(120));
  check('结义旗标', (await state()).flags.oath === true);

  console.log('── 桃园 → 涿县 ──');
  // 先找庄客拿药
  await place(24, 8, 'up'); await press('Enter'); await advance();
  check('庄客赠药', (await state()).items.shangyao === 6);
  await place(15, 16, 'down');
  await hold('ArrowDown', 1600); await wait(900);
  check('走出桃园到涿县', (await state()).map === 'town', JSON.stringify(await state()));
  await hold('ArrowDown', 500); await wait(300);
  check('入城剧情触发', await busy());
  await advance();
  check('入城旗标', (await state()).flags.town_enter === true);

  console.log('── 涿县 ──');
  await ev(() => { const n = G.world.npcById('jianyong'); n.u.x = n.u.px = n.u.fx = 21; n.u.y = n.u.py = n.u.fy = 17; n.wander = 0; });
  await place(21, 18, 'up'); await press('Enter'); await advance();
  let st = await state();
  check('简雍入队', st.flags.jianyong && st.party.length === 4, st.party.join(','));
  // 未接令前南门被挡
  await place(19, 26, 'down'); await hold('ArrowDown', 400); await wait(200);
  check('未接令不能出城', (await state()).map === 'town');
  await advance();
  await place(19, 27, 'down'); await press('Enter'); await advance();
  st = await state();
  check('邹靖接令', st.flags.quest === true);
  check('邹靖赏金', st.gold === 200, st.gold);
  // 杂货铺买一份伤药
  const before = st.items.shangyao;
  await place(32, 9, 'up'); await press('Enter'); await wait(400); await press('Enter', 3, 150);
  await wait(200); await press('Enter'); await wait(200); await press('Escape'); await advance();
  st = await state();
  const bought = st.items.shangyao - before;
  check('杂货铺购买（金钱与数量一致）', bought >= 1 && st.gold === 200 - 15 * bought, `${st.items.shangyao} ${st.gold}`);
  // 兵器铺买皮甲给关羽
  await place(32, 26, 'up'); await press('Enter'); await wait(300); await press('Enter', 2, 150);
  await press('Enter'); await wait(250); await press('ArrowDown'); await press('Enter'); await wait(300); await press('Enter'); await wait(200); await press('Escape'); await advance();
  check('兵器铺穿甲', await ev(() => G.state.members.guanyu.armor === 'pijia'));
  // 客栈
  await ev(() => { G.state.members.liubei.hp = 10; });
  await place(6, 9, 'up'); await press('Enter'); await wait(300); await press('Enter', 2, 200);
  await press('Enter'); await wait(3200); await press('Enter', 2, 200); await press('Enter'); await wait(300); await advance();
  check('客栈恢复兵力', await ev(() => G.state.members.liubei.hp === G.stats('liubei').maxhp));
  check('客栈存档', await ev(() => G.hasSave()));

  console.log('── 出城 ──');
  await place(19, 26, 'down'); await hold('ArrowDown', 1300); await wait(900);
  check('出南门到原野', (await state()).map === 'world', JSON.stringify(await state()));
  await press('ArrowDown'); await wait(500); await advance();
  check('原野首入剧情', (await state()).flags.world_enter === true);
  // 随机遇敌
  await ev(() => { G.run(() => G.world.randomBattle()); }); await wait(1500);
  check('进入战斗', await inBattle());
  const r1 = await autoBattle();
  await wait(1200);
  check('随机战斗结束返回原野', r1 === 'done' && (await state()).map === 'world', r1);
  // 走到桥上验证可通行
  await advance();
  await place(22, 18, 'right');
  await ev(() => { G.world.m.encounters.rates = {}; });
  await hold('ArrowRight', 2400); await wait(300);
  st = await state();
  check('可以过桥', st.x >= 28, `x=${st.x}`);
  // 进营
  await place(45, 34, 'up'); await press('ArrowUp'); await wait(1300);
  check('进入黄巾营', (await state()).map === 'camp');
  await ev(() => { G.MAPS.camp.encounters.rates = {}; });
  await press('ArrowUp'); await wait(500); await advance();
  check('入营剧情', (await state()).flags.camp_enter === true);
  await press('ArrowUp'); await wait(500);
  check('守营兵主动截击', await busy());
  for (let i = 0; i < 6 && !(await inBattle()); i++) await press('Enter', 1, 200);
  const r2 = await autoBattle(); await wait(1500);
  check('守营兵战胜', r2 === 'done' && (await state()).flags.camp_g1 === true, r2);
  // 粮车
  await ev(() => { G.state.members.zhangfei.hp = 5; });
  await place(21, 19, 'up');
  await ev(() => { G.state.flags.camp_g3 = true; });
  await press('Enter'); await advance();
  check('粮车补给', await ev(() => G.flag('grain') && G.state.members.zhangfei.hp === G.stats('zhangfei').maxhp));

  console.log('── Boss（真实等级下的平衡性）──');
  // 预计到达 Boss 时约 5~6 级
  const setLv = lv => ev(lv => { for (const id of G.state.party) { const m = G.state.members[id]; m.lvl = lv; m.exp = G.expTo(lv); } G.restoreAll(); G.state.items.shangyao = 6; }, lv);
  const bossTrial = async (enemies, lv, n) => {
    let wins = 0;
    for (let k = 0; k < n; k++) {
      await ev(() => { G.ui.clear(); G.scriptBusy = 0; while (G.scenes.length > 1) G.popScene(); if (!(G.scenes[0] instanceof G.WorldScene)) { G.setScene(G.world); } G.fadeA = 0; });
      await setLv(lv);
      await ev(e => { G.run(async () => { const r = await G.battle(e, { bg: 'camp', boss: true }); window.__lastResult = r; }); }, enemies);
      await wait(1200);
      const r = await autoBattle(1400);
      await wait(1000);
      if (r === 'done') wins++;
    }
    return wins;
  };
  const w5 = await bossTrial(['dengmao', 'ybing', 'ybing'], 4, 2);
  console.log(`  · 邓茂（Lv4，只会普攻）胜 ${w5}/2`);
  const w6 = await bossTrial(['chengyuanzhi', 'ytoumu', 'yshushi'], 6, 2);
  console.log(`  · 程远志（Lv6，只会普攻）胜 ${w6}/2`);

  console.log('── 结局 ──');
  await ev(() => { G.ui.clear(); G.scriptBusy = 0; while (G.scenes.length > 1) G.popScene(); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('camp', 18, 9, 'up'); G.state.flags.dengdead = true; G.fadeA = 0; for (const id of G.state.party) { G.state.members[id].lvl = 9; G.state.members[id].exp = G.expTo(9); } G.restoreAll(); });
  await wait(400);
  await ev(() => G.world.onArrive());
  await wait(300);
  for (let i = 0; i < 10 && !(await inBattle()); i++) await press('Enter', 1, 200);
  const r3 = await autoBattle(1400); await wait(1200);
  check('击败程远志', r3 === 'done', r3);
  for (let i = 0; i < 60; i++) { const n = await ev(() => G.scenes[0].constructor.name); if (n === 'ChapterEndScene') break; await press('Enter', 1, 150); }
  check('进入章末画面', await ev(() => G.scenes[0].constructor.name === 'ChapterEndScene'));
  await wait(15000); await press('Enter'); await wait(2500);
  check('章末后进入第二章', await ev(() => G.state.chapter === 2 && G.scenes[0].constructor.name === 'TextScroll'));
  check('标题可继续征程', await ev(() => G.hasSave()));

  console.log('── 战败流程 ──');
  await ev(() => { G.state = G.newState(); G.world = new G.WorldScene(); G.setScene(G.world); G.world.load('world', 20, 20, 'down'); G.fadeA = 0; for (const id of G.state.party) G.state.members[id].hp = 1; G.run(() => G.battle(['chengyuanzhi'], { boss: true })); });
  await wait(1500);
  const r4 = await autoBattle(600); await wait(2500);
  check('全军覆没进入战败画面', r4 === 'lose' || (await ev(() => G.scenes.some(s => s.constructor.name === 'GameOverScene'))), r4);

  console.log(errors.length ? '页面错误：\n' + errors.join('\n') : '页面无报错');
  console.log(`\n通过 ${pass}，失败 ${fail}`);
  await browser.close(); server.close();
  process.exit(fail || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
