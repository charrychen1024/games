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
if (phase !== 'deploy') {
  if (await page.locator('#def-hold').isVisible().catch(() => false)) await page.click('#def-hold');
  else await page.click('#siege-go').catch(() => {});
  await page.waitForTimeout(300);
  if (phase === 'select') { await page.locator('#battle-ui .ucard').first().click(); await page.waitForTimeout(200); await page.locator('.otile').first().click().catch(() => {}); }
  else { if (await page.locator('#all-assault').isVisible().catch(() => false)) await page.click('#all-assault'); else await page.click('#all-hold').catch(() => {}); await page.click('#siege-x2').catch(() => {}); }
}
await page.waitForTimeout(Number(wait));
if (phase === 'end') { await page.evaluate(() => window.NM_siegeSkip?.()); await page.waitForTimeout(1500); }
await page.screenshot({ path: out });
if (errors.length) console.log('ERRORS', errors.join('\n'));
await browser.close(); server.close();
