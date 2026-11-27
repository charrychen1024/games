/* 2.5D 画面截图：地图（远看、近看）、攻城（攻、守）、野战。node tools/shot-25d.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const OUT = process.env.SHOT_OUT ?? 'test-results';
const server = await serve(8215);
const browser = await pw.chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8215/?sample');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.click('#btn-sample'); await page.waitForTimeout(800);
await page.evaluate(() => NM.closeModal?.());
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(Math.round(n / 2)); }; requestAnimationFrame(f); }));
console.log('map fps', fps);
await page.screenshot({ path: `${OUT}/25d-map-near.png` });
await page.evaluate(() => { NM.map.focus('wuchang', 0.9); });
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/25d-map-far.png` });
for (const [kind, side] of [['siege', 'att'], ['siege', 'def'], ['field', 'att']]) {
  await page.goto('http://127.0.0.1:8215/?sample'); await page.click('#btn-sample'); await page.waitForTimeout(600);
  page.evaluate(([k, s]) => NM_testBattle(k, s, k === 'field' ? 'hills' : undefined), [kind, side]).catch(() => {});
  await page.waitForTimeout(2500);
  if (await page.locator('#att-assault').isVisible().catch(() => false)) { await page.click('#att-assault'); }
  if (await page.locator('#form-go').isVisible().catch(() => false)) { await page.click('#form-go'); }
  await page.waitForTimeout(kind === 'siege' ? 9000 : 6000);
  await page.screenshot({ path: `${OUT}/25d-${kind}-${side}.png` });
  if (kind === 'siege') await page.screenshot({ path: `${OUT}/25d-${kind}-${side}-zoom.png`, clip: side === 'att' ? { x: 380, y: 150, width: 560, height: 230 } : { x: 380, y: 330, width: 560, height: 300 } });
}
await browser.close(); server.close();
