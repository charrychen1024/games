/* 截战斗画面（先 npm run build）：
 * node tools/shot-battle.mjs <siege|field|naval> <输出.png> [deploy|fight|end|select] [att|def] [等待毫秒] [plain|hills|river] [clear|rain|wind|fog] */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const [kind = 'siege', out = 'battle.png', phase = 'fight', side = 'def', wait = '1500', terrain = 'plain', weather = 'wind'] = process.argv.slice(2);
const PORT = Number(process.env.PORT ?? 8213);
const server = await serve(PORT);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForTimeout(800);
await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 3), false));
await page.waitForTimeout(800);
await page.evaluate(([k, sd, t, w]) => { window.__b = NM_testBattle(k, sd, t, w); }, [kind, side, terrain, weather]);
await page.waitForTimeout(1500);
// 一开场即交战；守城先定大计（deploy 即截守城大计或开场一刻）
if (phase !== 'deploy') {
  if (await page.locator('#def-hold').isVisible().catch(() => false)) await page.click('#def-hold');
  await page.waitForTimeout(300);
  if (phase === 'select') {
    // 在战场上点我军一营选中
    const p = await page.evaluate(() => { const v = NM_siege.view; const u = NM_siege.sim.units.find(x => x.side === v.o.me && x.state !== 'gone' && x.troops >= 1); const q = v.unitScreen(u.id); const r = v.cv.getBoundingClientRect(); return [r.left + q[0], r.top + q[1]]; });
    await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200);
  }
  else { if (await page.locator('#all-assault').isVisible().catch(() => false)) await page.click('#all-assault'); else await page.click('#all-hold').catch(() => {}); await page.click('#siege-x2').catch(() => {}); }
}
await page.waitForTimeout(Number(wait));
if (phase === 'end') { await page.evaluate(() => window.NM_siegeSkip?.()); await page.waitForTimeout(1200); }
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS', errors.join('\n'));
await browser.close(); server.close();
