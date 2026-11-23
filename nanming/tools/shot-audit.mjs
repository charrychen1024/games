/* 逐屏检查：各弹窗、面板、战斗画面。写入 test-results/audit-*.png */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
import fs from 'node:fs';
fs.mkdirSync('test-results', { recursive: true });
const server = await serve(8216);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const shot = async n => { await page.waitForTimeout(500); await page.screenshot({ path: `test-results/audit-${n}.png` }); };
await page.goto('http://127.0.0.1:8216/');
await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('nanming:hint', '9'); } catch {} });
await page.reload();
await page.waitForFunction(() => window.NM?.map?.reliefReady, null, { timeout: 20000 }).catch(() => {});
await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 5), false));
await page.waitForTimeout(600);
await page.evaluate(() => NM.selectNode('nanjing')); await page.click('#act-recruit'); await shot('recruit');
await page.evaluate(() => NM.closeModal()); await page.click('#act-policy'); await shot('policy');
await page.evaluate(() => NM.closeModal()); await page.click('#act-appoint'); await shot('appoint');
await page.evaluate(() => NM.closeModal()); await page.evaluate(() => NM.selectArmy('a_shi')); await shot('army');
await page.click('#btn-factions'); await shot('factions');
await page.evaluate(() => NM.closeModal()); await page.click('#btn-chars'); await shot('chars');
await page.evaluate(() => NM.closeModal()); await page.click('#btn-menu'); await page.click('#btn-save'); await shot('saves');
await page.evaluate(() => NM.closeModal()); await page.evaluate(() => NM.selectNode('xuzhou')); await shot('enemy-city');
await page.evaluate(() => { NM.closePanel(); NM.map.focus('nanjing', 1); }); await shot('zoom1');
await page.evaluate(() => NM.map.focus('beijing', 1.6)); await shot('north');
await page.evaluate(() => NM.map.focus('kunming', 1.6)); await shot('southwest');
await page.evaluate(() => NM.map.focus('guangzhou', 1.8)); await shot('south');
// 一月结算：抉择、要闻、军情
await page.evaluate(() => NM.map.focus('nanjing', 2));
await page.click('#btn-next');
for (let i = 0; i < 80; i++) {
  if (await page.locator('[data-choice]').first().isVisible().catch(() => false)) { await shot('choice'); await page.click('[data-choice="0"]'); }
  if (await page.locator('#news-skip').isVisible().catch(() => false)) { await shot('splash'); await page.click('#news-skip'); }
  if (!(await page.evaluate(() => NM.resolving))) break;
  await page.waitForTimeout(150);
}
await shot('report');
// 战斗画面：样稿局面
await page.evaluate(() => NM.start(NM_presets.yangzhouSiegeState(), false, 'yangzhou'));
await page.waitForTimeout(500);
await page.click('#btn-next');
for (let i = 0; i < 80; i++) {
  if (await page.locator('#battle-go').isVisible().catch(() => false)) { await page.waitForTimeout(1500); await shot('battle'); await page.click('#battle-auto').catch(() => {}); }
  if (await page.locator('#battle-done').isVisible().catch(() => false)) { await shot('battle-done'); await page.click('#battle-done'); }
  if (await page.locator('[data-choice]').first().isVisible().catch(() => false)) await page.click('[data-choice="0"]');
  if (await page.locator('#news-skip').isVisible().catch(() => false)) await page.click('#news-skip');
  if (!(await page.evaluate(() => NM.resolving))) break;
  await page.waitForTimeout(200);
}
console.log(errors);
await browser.close(); server.close();
