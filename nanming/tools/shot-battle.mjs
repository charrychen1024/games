/* 截战斗画面：node tools/shot-battle.mjs <siege|field|naval> <输出.png> [deploy|fight]（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const [kind = 'siege', out = 'battle.png', phase = 'fight', side = 'def', wait = '1500'] = process.argv.slice(2);
const server = await serve(8213);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8213/');
await page.waitForTimeout(800);
await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 3), false));
await page.waitForTimeout(800);
await page.evaluate(([k, sd]) => { window.__b = NM_testBattle(k, sd); }, [kind, side]);
await page.waitForTimeout(1800);
if (phase === 'fight' && await page.locator('#def-hold').isVisible().catch(() => false)) { await page.click('#def-hold'); await page.waitForTimeout(300); await page.click('#all-hold').catch(() => {}); await page.click('#siege-x2').catch(() => {}); }
if (phase === 'fight' && await page.locator('#siege-go').isVisible().catch(() => false)) { await page.click('#siege-go'); await page.waitForTimeout(300); await page.click('#all-assault').catch(() => {}); await page.click('#def-hold').catch(() => {}); await page.waitForTimeout(200); await page.click('#all-hold').catch(() => {}); await page.click('#siege-x2').catch(() => {}); }
if (phase === 'fight' && await page.locator('#deploy-go').isVisible().catch(() => false)) { for (let k = 0; k < 2; k++) await page.click('#battle-ui [data-alloc="3+"]').catch(() => {}); await page.click('#deploy-go'); await page.waitForTimeout(800); }
await page.waitForTimeout(Number(wait));
await page.screenshot({ path: out });
await browser.close(); server.close();
