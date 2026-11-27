/* 城池密集处（郑氏闽南四城）：各缩放下城池画成城郭、小城郭还是小点。node tools/shot-dense.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const OUT = process.env.SHOT_OUT ?? 'test-results';
const server = await serve(8240);
const b = await pw.chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8240/');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.evaluate(() => NM.start(NM_presets.createGame('zheng', 3), false));
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
for (const z of [1.2, 2, 3, 6]) {
  await page.evaluate(z => { NM.closePanel?.(); NM.map.focus('quanzhou', z); }, z);
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => ['quanzhou', 'anping', 'xiamen', 'zhangzhou', 'fuzhou', 'chaozhou', 'xinghua'].map(id => { const sl = NM.map.layout.get(id); return `${NM_presets.name(id)}:${sl ? sl.tier + (sl.label ? '+名' : '') : '—'}`; }).join(' '));
  console.log('z', z, r);
  await page.screenshot({ path: `${OUT}/dense-z${z}.png` });
}
await b.close(); server.close();
