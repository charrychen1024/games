import { serve } from './serve.mjs';
import pw from './pw.mjs';
const server = await serve(8213);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto('http://127.0.0.1:8213/');
await page.evaluate(() => { try { localStorage.setItem('nanming:hint', '9'); } catch {} });
await page.reload(); await page.waitForTimeout(800);
await page.click('#btn-new'); await page.waitForTimeout(400);
await page.evaluate(() => { NM.selectNode('chuzhou'); NM.addOrder({ id: 'o0-1', kind: 'recruit', node: 'chuzhou', troops: 600 }); });
await page.click('#btn-next');
for (let i = 0; i < 50; i++) { if (await page.locator('[data-choice]').first().isVisible().catch(() => false)) await page.click('[data-choice="0"]'); if (await page.locator('#btn-next').isEnabled()) break; await page.waitForTimeout(150); }
await page.waitForTimeout(400);
await page.evaluate(() => NM.selectNode('chuzhou'));
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/06-small.png' });
console.log(errors);
await browser.close(); server.close();
