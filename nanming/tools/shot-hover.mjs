/* 悬停在挪位的城郭上：布局不得来回跳。node tools/shot-hover.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const server = await serve(8242);
const b = await pw.chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8242/');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.evaluate(() => NM.start(NM_presets.createGame('zheng', 3), false));
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await page.evaluate(() => { NM.closePanel?.(); NM.map.focus('quanzhou', 2); });
await page.waitForTimeout(500);
for (const id of ['quanzhou', 'xiamen']) {
  const p = await page.evaluate(id => { const m = NM.map, r = m.canvas.getBoundingClientRect(), sl = m.layout.get(id); return sl ? [r.left + sl.sx, r.top + sl.sy - sl.w * 0.4, !!sl.ax] : null; }, id);
  await page.mouse.move(p[0], p[1]);
  const seen = new Set();
  for (let k = 0; k < 20; k++) { await page.mouse.move(p[0] + (k % 2 ? 1 : -1), p[1]); await page.waitForTimeout(50); seen.add(await page.evaluate(() => ['quanzhou', 'anping', 'xiamen', 'zhangzhou'].map(i => { const sl = NM.map.layout.get(i); return sl ? `${Math.round(sl.sx)},${Math.round(sl.sy)}` : '-'; }).join('|'))); }
  if (process.env.STRICT && seen.size > 1) process.exitCode = 1;
  console.log(id, '挪位', p[2], '一秒内布局变化种数', seen.size, '悬停', await page.evaluate(() => NM.map.view.hover));
}
await b.close(); server.close();
