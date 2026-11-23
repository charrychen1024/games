/* 审查复核截图：1280×720 开局选南京（审查 09）、图例（审查 08）。写入 test-results/。 */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
import fs from 'node:fs';
fs.mkdirSync('test-results', { recursive: true });
const server = await serve(8214);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8214/');
await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('nanming:hint', '9'); } catch {} });
await page.reload();
await page.waitForFunction(() => window.NM?.map?.reliefReady, null, { timeout: 20000 }).catch(() => {});
await page.click('#btn-new'); await page.waitForTimeout(600);
await page.screenshot({ path: 'test-results/review-start.png' });
await page.evaluate(() => NM.selectNode('nanjing')); await page.waitForTimeout(500);
await page.screenshot({ path: 'test-results/review-nanjing.png' });
await page.click('#btn-legend'); await page.waitForTimeout(400);
await page.screenshot({ path: 'test-results/review-legend.png' });
await browser.close(); server.close();
