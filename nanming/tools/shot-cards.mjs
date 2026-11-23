/* 卡牌、人物档案、战报截图：test-results/card-*.png */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const server = await serve(8219);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const shot = async (n, w = 700) => { await page.waitForTimeout(w); await page.screenshot({ path: `test-results/card-${n}.png` }); };
await page.goto('http://127.0.0.1:8219/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('nanming:hint', '9'); });
await page.reload();
await page.waitForFunction(() => window.NM?.map?.reliefReady, null, { timeout: 20000 }).catch(() => {});
await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 5), false));
await page.waitForTimeout(500);
await page.evaluate(() => NM.selectNode('nanjing')); await page.click('#act-policy'); await shot('policy', 900);
await page.hover('[data-card="fortify"]'); await shot('policy-hover', 400);
await page.evaluate(() => NM.closeModal()); await page.click('#act-appoint'); await shot('appoint', 900);
await page.evaluate(() => NM.closeModal()); await page.click('#btn-chars'); await shot('roster', 900);
await page.locator('#modal .rcard').nth(1).click(); await shot('profile', 900);
await page.evaluate(() => NM.closeModal());
await page.evaluate(() => NM.start(NM_presets.createGame('qing', 5), false)); await page.waitForTimeout(400);
await page.click('#btn-chars'); await shot('roster-qing', 900);
await page.evaluate(() => NM.closeModal());
await page.click('#btn-next');
for (let i = 0; i < 80; i++) {
  if (await page.locator('[data-choice]').first().isVisible().catch(() => false)) await page.click('[data-choice="0"]');
  if (await page.locator('#battle-auto').isVisible().catch(() => false)) await page.click('#battle-auto').catch(() => {});
  if (await page.locator('#battle-done').isVisible().catch(() => false)) await page.click('#battle-done').catch(() => {});
  if (await page.locator('#news .nw-card').isVisible().catch(() => false)) break;
  await page.waitForTimeout(150);
}
await shot('news1', 1200);
await page.click('#news-next'); await shot('news2', 1400);
console.log(errors);
await browser.close(); server.close();
