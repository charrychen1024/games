/* 南明 · 端到端测试：node tools/e2e.mjs（先 npm run build）
 * 用真实鼠标操作走一遍试玩：点城、下令、号令下属、推进十二个月、处理战斗与史事抉择、存读档、样稿局面的手动守城。 */
import { serve } from './serve.mjs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
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
  let battles = 0, choices = 0, manualDone = false;
  while (Date.now() - t0 < 60000) {
    if (await visible('[data-choice]')) { await page.click('[data-choice="0"]', { timeout: 1000 }).catch(() => {}); choices++; await wait(150); continue; }
    if (await visible('#battle-done')) { await page.click('#battle-done', { timeout: 1000 }).catch(() => {}); battles++; await wait(200); continue; }
    if (await visible('#battle-go')) {
      if (manualBattle && !manualDone) {
        // 亲自指挥一回合：三路都下令
        const orders = await page.locator('#battle-ui .ord[data-lane="0"]').count();
        if (orders) { await page.locator('#battle-ui .ord[data-lane="0"]').nth(1).click(); await page.locator('#battle-ui .ord[data-lane="2"]').nth(0).click(); }
        await page.click('#battle-go'); manualDone = true; await wait(1800); continue;
      }
      await page.click('#battle-auto', { timeout: 600 }).catch(() => {});
      await wait(400); continue;
    }
    if (await visible('#splash-go')) { await page.click('#splash-go', { timeout: 1000 }).catch(() => {}); await wait(150); continue; }
    const enabled = await page.locator('#btn-next').isEnabled().catch(() => false);
    const label = await text('#btn-next');
    if (enabled || label.includes('本局')) break;
    await wait(150);
  }
  await wait(200);
  return { before, after: await text('#date-label'), battles, choices };
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await wait(1000);
  console.log('标题与开局');
  check('标题页出现', await visible('#btn-new'));
  await page.click('#btn-new');
  await wait(600);
  check('进入地图，顶栏显示崇祯十七年五月', (await text('#date-label')).includes('崇祯十七年五月'), await text('#date-label'));
  check('新手提示出现', await visible('#hint'));
  // 直接用页面里暴露的投影：点南京
  const nj = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('nanjing'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await page.mouse.click(nj[0], nj[1]);
  await wait(300);
  check('点南京打开城池详情', (await text('#city-name')).includes('南京'), await text('#city-name'));
  check('详情写明实控者与所奉政权', (await text('#city-controller')).includes('弘光朝廷') && (await text('#city-polity')).includes('明'));

  console.log('下达命令');
  await page.click('#act-policy');
  await page.click('[data-policy="agri"]');
  await wait(200);
  check('改方针加入本月命令', (await text('#orders')).includes('劝农'));
  await page.click('#act-recruit');
  await page.click('#recruit-ok');
  await wait(200);
  check('募兵加入本月命令', (await text('#orders')).includes('募兵'));
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

  console.log('推进十二个月');
  const m1 = await nextMonth();
  check('第一个月结算后日期前进', m1.after !== m1.before, `${m1.before} → ${m1.after}`);
  check('第一个月有史事抉择（高杰争扬州）', m1.choices >= 1);
  check('月报自动展开且有内容', await visible('#report-entries .entry'));
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
  for (let i = 0; i < 11; i++) {
    const label = await text('#btn-next');
    if (label.includes('本局')) break;
    const r = await nextMonth();
    months++; totalBattles += r.battles;
  }
  check('连续推进满十二个月', months === 12, `months=${months}`);
  check('试玩结束弹窗出现', (await text('#modal')).includes('试玩结束'), (await text('#modal')).slice(0, 80));
  console.log(`  （本局玩家参与的战斗 ${totalBattles} 场）`);
  const endDate = await page.getAttribute('#date-label', 'title');
  check('最后一月为乙酉四月', endDate.includes('四月') && endDate.includes('1645'), endDate);

  console.log('存档与读档');
  await page.click('#end-continue');
  await wait(200);
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

  console.log('地图样稿：扬州被围');
  await page.click('#btn-title');
  await page.click('#title-ok');
  await wait(300);
  await page.click('#btn-sample');
  await wait(500);
  check('样稿直接打开扬州详情', (await text('#city-name')).includes('扬州'));
  check('详情说明谁在城外围城', (await text('#siege-box')).includes('多铎'), await text('#siege-box'));
  check('详情说明实控者', (await text('#city-controller')).includes('弘光朝廷'));
  await page.screenshot({ path: 'screenshots/02-siege.png' });
  const sm = await nextMonth(true);
  check('扬州攻城战进入战斗画面并完成', sm.battles >= 1, JSON.stringify(sm));
  const rep = await text('#report-entries');
  check('月报记录扬州攻城战', rep.includes('扬州攻城战'), rep.slice(0, 200));
  await page.evaluate(() => NM.selectNode('yangzhou'));
  await wait(200);
  const yz = await page.evaluate(() => ({ ctrl: NM.s.cities.yangzhou.controller, siege: !!NM.s.sieges.yangzhou, manual: NM.s.battles.map(b => b.manual), nodes: NM.s.battles.map(b => b.node) }));
  check('手动指挥的战斗被记为亲征', yz.manual.includes(true), JSON.stringify(yz));
  check('扬州要么仍被围，要么已易主（有结果）', yz.siege || yz.ctrl !== 'hongguang', JSON.stringify(yz));
} catch (e) {
  fail++;
  console.log('  ✗ 测试异常：' + e.message);
  await page.screenshot({ path: 'screenshots/e2e-fail.png' }).catch(() => {});
}
check('全程没有页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n通过 ${pass}，失败 ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
