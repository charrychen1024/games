/* 各家结束本月后镜头是否回到本方一带：先把镜头移到远处，结束本月，量镜头中心到本方治所的距离（屏幕像素）。 */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const PORT = Number(process.env.PORT ?? 8217);
const server = await serve(PORT);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.waitForTimeout(800);
const far = { hongguang: 'chengdu', qing: 'guangzhou', shun: 'fuzhou', xi: 'beijing', zheng: 'chengdu' };
let bad = 0;
for (const f of Object.keys(far)) {
  await page.evaluate(f => { NM.autoBattle = true; NM.start(NM_presets.createGame(f, 3), false); }, f);
  await page.waitForTimeout(600);
  await page.evaluate(id => NM.map.focus(id, 2), far[f]);
  await page.waitForTimeout(300);
  await page.click('#btn-next');
  for (let i = 0; i < 400; i++) {
    if (await page.locator('[data-choice="0"]').first().isVisible().catch(() => false)) { await page.click('[data-choice="0"]').catch(() => {}); await page.waitForTimeout(150); continue; }
    if (await page.locator('#def-hold').isVisible().catch(() => false)) await page.click('#battle-auto').catch(() => {});
    if (await page.locator('#battle .shud').isVisible().catch(() => false)) await page.evaluate(() => window.NM_siegeSkip?.());
    if (await page.locator('#news-skip').isVisible().catch(() => false)) { await page.click('#news-skip').catch(() => {}); await page.waitForTimeout(300); continue; }
    if (!(await page.evaluate(() => NM.resolving))) break;
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => { const m = NM.map, id = NM.homeNode(); const p = window.NM_nodePt(id); return { home: id, d: Math.round(Math.hypot((p[0] - m.cam.x) * m.cam.z, (p[1] - m.cam.y) * m.cam.z)), lim: Math.round(Math.min(m.w, m.h) * 0.3) }; });
  const ok = r.d <= r.lim;
  if (!ok) bad++;
  console.log(`${ok ? 'ok ' : 'BAD'} ${f}: 镜头离${r.home} ${r.d}px（限 ${r.lim}）`);
}
console.log(errors.length ? 'ERR ' + errors.join(' | ') : 'no page errors');
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
