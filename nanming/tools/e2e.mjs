/* 南明 · 端到端测试：node tools/e2e.mjs（先 npm run build）
 * 用真实鼠标操作走一遍试玩：点城、下令、号令下属、推进十二个月、处理战斗与史事抉择、存读档、样稿局面的手动守城。 */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
import fs from 'node:fs';
// 运行截图写入独立结果目录（不进仓库）
const OUT = process.env.E2E_OUT ?? 'test-results';
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8212;
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '  [' + detail + ']' : '')); } };

const server = await serve(PORT);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
const wait = ms => page.waitForTimeout(ms);
const visible = sel => page.locator(sel).first().isVisible().catch(() => false);
const text = sel => page.locator(sel).first().innerText().catch(() => '');
const armyXY = id => page.evaluate(id => { const m = NM.map; const h = m.armyHits.find(x => x.id === id); if (!h) return null; return [(h.x - m.cam.x) * m.cam.z + m.w / 2, (h.y - m.cam.y) * m.cam.z + m.h / 2]; }, id);

/** 推进一个月：遇到史事抉择选第一项，遇到战斗交给部将自动打完 */
async function nextMonth(manualBattle = false) {
  const before = await text('#date-label');
  await page.click('#btn-next');
  const t0 = Date.now();
  let battles = 0, choices = 0, manualDone = false, battleScene = false, newsSeen = false;
  while (Date.now() - t0 < 60000) {
    if (await visible('[data-choice]')) { await page.click('[data-choice="0"]', { timeout: 1000 }).catch(() => {}); choices++; await wait(150); continue; }
    if (await visible('#battle-done')) { await page.click('#battle-done', { timeout: 1000 }).catch(() => {}); battles++; await wait(200); continue; }
    if (await visible('#battle-go')) {
      if ((await page.evaluate(() => NM_audio().want)) === 'battle') battleScene = true;
      if (manualBattle && !manualDone) {
        // 亲自指挥一回合：三路都下令
        const orders = await page.locator('#battle-ui .ord[data-lane="0"]').count();
        if (orders) { await page.locator('#battle-ui .ord[data-lane="0"]').nth(1).click(); await page.locator('#battle-ui .ord[data-lane="2"]').nth(0).click(); }
        await page.click('#battle-go'); manualDone = true; await wait(1800); continue;
      }
      await page.click('#battle-auto', { timeout: 600 }).catch(() => {});
      await wait(400); continue;
    }
    if (await visible('#news-skip')) { newsSeen = true; await page.click('#news-skip', { timeout: 1000 }).catch(() => {}); await wait(350); continue; }
    // 结算、翻月动画、要闻都过去之后才算这个月结束
    if (!(await page.evaluate(() => NM.resolving))) break;
    await wait(150);
  }
  await wait(200);
  return { before, after: await text('#date-label'), battles, choices, battleScene, newsSeen };
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await wait(1000);
  console.log('标题与开局');
  check('标题页出现，只有一个“开始”大按钮', await visible('#btn-new'));
  check('标题页没有原生下拉框与数字框', (await page.locator('select, input[type=number]').count()) === 0);
  await page.click('#btn-new');
  await wait(700);
  check('择一方：五家可选', (await page.locator('#pick .pcard').count()) === 5);
  check('未选势力前不能开局', await page.locator('#pick-go').isDisabled());
  await page.click('#pick-hongguang');
  check('选中后可开局', await page.locator('#pick-go').isEnabled());
  await page.click('#pick-go');
  await wait(900);
  check('开局过场出现', await visible('#intro'));
  await page.screenshot({ path: `${OUT}/01-intro.png` });
  await page.click('#intro');
  await wait(800);
  check('进入地图，顶栏显示崇祯十七年五月', (await text('#date-label')).includes('崇祯十七年五月'), await text('#date-label'));
  check('开局三步出现', (await text('#hint')).includes('开局三步'));
  await wait(1500);
  const au = await page.evaluate(() => NM_audio());
  check('声音已启动，地图配乐在排', au.running && au.scene === 'map' && au.scheduled > 0, JSON.stringify(au));
  // 直接用页面里暴露的投影：点南京
  const nj = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('nanjing'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await page.mouse.click(nj[0], nj[1]);
  await wait(300);
  check('点南京打开城池详情', (await text('#city-name')).includes('南京'), await text('#city-name'));
  check('详情写明实控者与所奉政权', (await text('#city-controller')).includes('弘光朝廷') && (await text('#city-polity')).includes('明'));

  console.log('下达命令');
  await page.click('#act-policy');
  check('方针以卡牌呈现（七张，带插画）', (await page.locator('#modal .gcard').count()) === 7 && (await page.locator('#modal .gcard img').count()) === 7);
  await page.click('[data-card="agri"]');
  await wait(800);
  check('改方针加入本月命令', (await text('#orders')).includes('劝农'));
  check('下令后开局三步进到第三步', (await page.locator('#hint .q-step.done').count()) >= 2, await text('#hint'));
  await page.click('#act-recruit');
  await page.click('#recruit-ok');
  await wait(200);
  check('募兵加入本月命令', (await text('#orders')).includes('募兵'));
  // 调拨：游戏化下拉框，不用浏览器原生控件
  await page.click('#act-transfer');
  await wait(300);
  check('调拨弹窗没有原生下拉框与数字框', (await page.locator('#modal select, #modal input[type=number]').count()) === 0);
  await page.click('#tr-to .gsel-btn');
  await wait(200);
  check('下拉浮层展开且有选项', (await page.locator('.gsel-list .gsel-opt').count()) > 3);
  await page.locator('.gsel-list .gsel-opt[data-value="zhenjiang"]').click();
  await wait(150);
  check('选中镇江', (await text('#tr-to')).includes('镇江'));
  await page.click('#tr-ok');
  await wait(200);
  check('调拨加入本月命令', (await text('#orders')).includes('镇江'), await text('#orders'));
  // 选中督师标营并下行军令
  await wait(300);
  const sxy = await armyXY('a_shi');
  check('地图上能找到督师标营的军旗', !!sxy);
  if (sxy) {
    await page.mouse.click(sxy[0], sxy[1]);
    await wait(250);
    check('点军旗打开军队详情', (await text('#army-name')).includes('督师标营'));
    await page.click('#act-move');
    const t = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('taiping'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
    await page.mouse.move(t[0], t[1]);
    await wait(100);
    await page.mouse.click(t[0], t[1]);
    await wait(250);
    check('点选目标后加入行军令', (await text('#orders')).includes('开赴太平'), await text('#orders'));
  }
  // 号令黄得功
  await page.evaluate(() => NM.selectArmy('a_huang'));
  await wait(200);
  check('下属军镇显示号令按钮', await visible('#act-command-move'));
  await page.click('#act-command-move');
  const cz = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('hezhou'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await page.mouse.click(cz[0], cz[1]);
  await wait(250);
  check('号令弹窗显示服从估计与原因', (await text('#cmd-est')).includes('服从度'));
  await page.click('#cmd-ok');
  await wait(200);
  check('号令加入本月命令', (await text('#orders')).includes('号令黄得功部'));

  console.log('推进月份');
  const m1 = await nextMonth();
  check('第一个月结算后日期前进', m1.after !== m1.before, `${m1.before} → ${m1.after}`);
  check('第一个月有史事抉择（高杰争扬州）', m1.choices >= 1);
  check('本月战报逐条播放过', m1.newsSeen, JSON.stringify(m1));
  await page.click('#btn-report');
  await wait(300);
  check('军情面板有内容', await visible('#report-entries .entry'));
  const reportText = await text('#report-entries');
  check('军情包含号令下属的结果', reportText.includes('号令黄得功部 →'), reportText.slice(0, 200));
  check('月报包含史事', reportText.includes('史可法督师江北'));
  await page.locator('#report-entries .locate').first().click();
  await wait(250);
  check('点“定位”打开对应城池', await visible('#city-name'));
  await page.evaluate(() => NM.selectNode('nanjing'));
  await wait(150);
  await page.click('#tab-ledger');
  await wait(150);
  check('城池详情逐项列出钱粮变化并标出你的命令', (await text('#ledger')).includes('你的命令'), (await text('#ledger')).slice(0, 160));
  let months = 1, totalBattles = m1.battles;
  for (let i = 0; i < 5; i++) {
    const r = await nextMonth();
    months++; totalBattles += r.battles;
  }
  check('连续推进六个月', months === 6 && (await page.evaluate(() => NM.s.turn)) === 6, `months=${months}`);
  console.log(`  （本局玩家参与的战斗 ${totalBattles} 场）`);

  console.log('存档与读档');
  await wait(200);
  await page.click('#btn-menu');
  await page.click('#btn-save');
  await page.click('[data-save="1"]');
  await wait(200);
  const saved = await text('#date-label');
  await page.reload();
  await wait(800);
  check('刷新后标题页有“继续游戏”', await visible('#btn-continue'));
  await page.click('#btn-load');
  await page.click('[data-load="1"]');
  await wait(500);
  check('读档后日期一致', (await text('#date-label')) === saved, `${saved} vs ${await text('#date-label')}`);

  console.log('存档写入失败（审查 02）');
  const old1 = await page.evaluate(() => localStorage.getItem('nanming:slot:1'));
  await page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await page.click('#btn-menu');
  await page.click('#btn-save');
  await page.click('[data-save="1"]');
  await wait(300);
  check('写入失败时提示未保存', (await text('#save-fail')).includes('未能保存'), await text('#toast'));
  check('失败提示给出导出入口', await visible('#save-fail-export'));
  check('没有误报“已存入”', !(await text('#toast')).includes('已存入'));
  const now1 = await page.evaluate(() => localStorage.getItem('nanming:slot:1'));
  check('写入失败时旧档原样保留', now1 === old1);
  await page.click('[data-save="2"]');
  await wait(200);
  check('空槽写入失败也不出现存档', !(await page.evaluate(() => localStorage.getItem('nanming:slot:2'))));
  await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.querySelector('#save-fail')?.remove(); NM.closeModal(); });

  console.log('图例（审查 08）');
  await page.click('#btn-menu');
  await page.click('#btn-legend');
  await wait(200);
  check('图例说明色块只是控制范围示意', (await text('#legend')).includes('控制范围示意'));
  await page.locator('#legend .x').click();

  console.log('出征：军令环、行程、宣战（两级之内）');
  await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 4), false));
  await wait(600);
  check('左下角军队栏列出我军', (await page.locator('#armybar .achip').count()) >= 1);
  await page.click('#armybar .achip[data-army="a_shi"]');
  await wait(500);
  check('点军队即出现军令环', await visible('#ring-march'));
  await page.click('#ring-march');
  await page.evaluate(() => NM.map.focus('xuzhou', 1.3));
  await wait(300);
  const bd = await page.evaluate(() => { const m = NM.map; const p = NM_nodePt('baoding'); return [(p[0] - m.cam.x) * m.cam.z + m.w / 2, (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await page.mouse.move(bd[0], bd[1]);
  await wait(300);
  check('瞄准时显示行程日数与月数', /\d+\s*日/.test(await text('#tooltip')) && (await text('#tooltip')).includes('个月'), await text('#tooltip'));
  check('路线上标出每月行至何处', await page.evaluate(() => NM.map.monthMarks.length > 0));
  await page.mouse.click(bd[0], bd[1]);
  await wait(500);
  check('目标属未交战势力时询问宣战', await visible('#war-ok'));
  await page.click('#war-ok');
  await wait(300);
  check('宣战与进攻一并下令', (await page.evaluate(() => NM.orders.map(o => o.kind).join(','))) === 'war,army');
  // 右键直接出征
  await page.click('#armybar .achip[data-army="a_shi"]');
  await wait(300);
  const yzp = await page.evaluate(() => { const m = NM.map; NM.map.focus('nanjing', 2); const p = NM_nodePt('yangzhou'); return [(p[0] - m.cam.x) * m.cam.z + m.w / 2, (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await wait(200);
  const under = await page.evaluate(([x, y]) => { const p = NM.map.pick(x, y); return p?.kind === 'node' ? NM_presets.name(p.id) : ''; }, yzp);
  await page.mouse.click(yzp[0], yzp[1], { button: 'right' });
  await wait(300);
  check('右键点城即开赴（友城不问宣战）', !!under && (await text('#orders')).includes('开赴' + under), `${under} | ${await text('#orders')}`);

  console.log('人物档案');
  await page.click('#btn-chars');
  await wait(500);
  check('人物以带画像的卡片呈现', (await page.locator('#modal .rcard img').count()) >= 5);
  await page.locator('#modal .rcard').first().click();
  await wait(700);
  check('人物档案有画像、能力图与态度', (await page.locator('#modal .pface').count()) === 1 && (await page.locator('#modal .p-radar').count()) === 1);
  await page.evaluate(() => NM.closeModal());

  console.log('自立（郑氏）');
  await page.evaluate(() => NM.start(NM_presets.createGame('zheng', 3), false));
  await wait(500);
  await page.click('#btn-factions');
  await wait(300);
  check('郑氏在“天下”里可下令自立', await visible('#act-independence'));
  await page.click('#act-independence');
  await wait(200);
  check('自立加入本月命令', (await text('#orders')).includes('自立'), await text('#orders'));
  await nextMonth();
  check('结算后郑氏不再奉弘光号令', await page.evaluate(() => !NM.s.factions.zheng.overlord));

  console.log('地图样稿：扬州被围');
  await page.click('#btn-menu');
  await page.click('#btn-title');
  await page.click('#title-ok');
  await wait(300);
  await page.click('#btn-sample');
  await wait(500);
  check('样稿直接打开扬州详情', (await text('#city-name')).includes('扬州'));
  check('详情说明谁在城外围城', (await text('#siege-box')).includes('多铎'), await text('#siege-box'));
  check('详情说明实控者', (await text('#city-controller')).includes('弘光朝廷'));
  await page.screenshot({ path: `${OUT}/02-siege.png` });
  const sm = await nextMonth(true);
  check('扬州攻城战进入战斗画面并完成', sm.battles >= 1, JSON.stringify(sm));
  check('战斗时切换战斗配乐', sm.battleScene === true, JSON.stringify(sm));
  await page.click('#btn-report');
  await wait(300);
  const rep = await text('#report-entries');
  check('月报记录扬州攻城战', rep.includes('扬州攻城战'), rep.slice(0, 200));
  await page.evaluate(() => NM.selectNode('yangzhou'));
  await wait(200);
  const yz = await page.evaluate(() => ({ ctrl: NM.s.cities.yangzhou.controller, siege: !!NM.s.sieges.yangzhou, manual: NM.s.battles.map(b => b.manual), nodes: NM.s.battles.map(b => b.node) }));
  check('手动指挥的战斗被记为亲征', yz.manual.includes(true), JSON.stringify(yz));
  check('扬州要么仍被围，要么已易主（有结果）', yz.siege || yz.ctrl !== 'hongguang', JSON.stringify(yz));

  console.log('结局恢复（审查 03）');
  await nextMonth();
  check('样稿两月后试玩结束弹窗出现', (await text('#modal')).includes('试玩结束'), (await text('#modal')).slice(0, 80));
  const endTurn = await page.evaluate(() => NM.s.turn);
  await page.reload();
  await wait(900);
  check('结局时刷新，标题页有“继续”', await visible('#btn-continue'));
  await page.click('#btn-continue');
  await wait(600);
  check('继续后重新打开试玩结局', (await text('#modal')).includes('试玩结束'), (await text('#modal')).slice(0, 60));
  check('结局面板可“继续推进”', await visible('#end-continue'));
  await page.click('#end-continue');
  await wait(300);
  const after = await page.evaluate(() => ({ turn: NM.s.turn, ended: !!NM.s.ended }));
  check('继续推进进入下一个月', after.turn === endTurn + 1 && !after.ended, JSON.stringify(after));
  check('结束本月按钮可用', await page.locator('#btn-next').isEnabled());
  await page.reload();
  await wait(900);
  await page.click('#btn-continue');
  await wait(600);
  const again = await page.evaluate(() => NM.s.turn);
  check('再次刷新不重复前进、也不再弹结局', again === endTurn + 1 && !(await text('#modal')).includes('试玩结束'), `turn=${again}`);
} catch (e) {
  fail++;
  console.log('  ✗ 测试异常：' + e.message);
  await page.screenshot({ path: `${OUT}/e2e-fail.png` }).catch(() => {});
}
check('全程没有页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n通过 ${pass}，失败 ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
