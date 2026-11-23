/* 体验截图：标题页、新局引导、东南地图、下拉框。写入 test-results/ux-*.png。 */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
import fs from 'node:fs';
fs.mkdirSync('test-results', { recursive: true });
const server = await serve(8215);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:8215/');
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload();
await page.waitForFunction(() => window.NM?.map?.reliefReady, null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(1200);
await page.screenshot({ path: 'test-results/ux-1-title.png' });
await page.click('#btn-new'); await page.waitForTimeout(1300);
await page.hover('#pick-qing'); await page.waitForTimeout(900);
await page.click('#pick-qing'); await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/ux-2-pick.png' });
await page.click('#pick-hongguang'); await page.click('#pick-go'); await page.waitForTimeout(2600);
await page.screenshot({ path: 'test-results/ux-2b-intro.png' });
await page.click('#intro'); await page.waitForTimeout(1200);
await page.screenshot({ path: 'test-results/ux-2-start.png' });
const shots = process.argv.slice(2);
for (const z of [1.2, 2, 3.2]) {
  await page.evaluate(z => { NM.map.focus('nanjing', z); }, z);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `test-results/ux-3-se-${z}.png` });
}
await page.evaluate(() => NM.selectNode('nanjing')); await page.waitForTimeout(600);
await page.screenshot({ path: 'test-results/ux-4-nanjing.png' });
await page.click('#act-transfer'); await page.waitForTimeout(400);
await page.click('#tr-to .gsel-btn'); await page.waitForTimeout(400);
await page.screenshot({ path: 'test-results/ux-5-transfer.png' });
await page.keyboard.press('Escape'); await page.evaluate(() => NM.closeModal());
await page.click('#act-recruit'); await page.waitForTimeout(300); await page.click('#recruit-ok'); await page.waitForTimeout(250);
await page.screenshot({ path: 'test-results/ux-6-order.png' });
await page.click('#btn-next'); await page.waitForTimeout(400);
for (let i = 0; i < 40; i++) { if (await page.locator('[data-choice]').first().isVisible().catch(() => false)) { await page.click('[data-choice="0"]'); await page.waitForTimeout(100); } if (await page.locator('#flip').isVisible().catch(() => false)) break; await page.waitForTimeout(100); }
await page.waitForTimeout(450);
await page.screenshot({ path: 'test-results/ux-7-flip.png' });
await page.waitForTimeout(900);
await page.screenshot({ path: 'test-results/ux-8-fx.png' });
await page.click('#btn-menu'); await page.waitForTimeout(300);
await page.screenshot({ path: 'test-results/ux-9-menu.png' });
console.log(errors);
await browser.close(); server.close();
