/* 截战斗画面：node tools/shot-battle.mjs <siege|field|naval> <输出.png> [deploy|fight]（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const [kind = 'siege', out = 'battle.png', phase = 'fight'] = process.argv.slice(2);
const server = await serve(8213);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8213/');
await page.waitForTimeout(800);
await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 3), false));
await page.waitForTimeout(800);
await page.evaluate(k => { window.__b = NM_testBattle(k); }, kind);
await page.waitForTimeout(1800);
if (phase === 'fight' && await page.locator('#deploy-go').isVisible().catch(() => false)) { for (let k = 0; k < 2; k++) await page.click('#battle-ui [data-alloc="3+"]').catch(() => {}); await page.click('#deploy-go'); await page.waitForTimeout(800); }
await page.waitForTimeout(1500);
await page.screenshot({ path: out });
await browser.close(); server.close();
