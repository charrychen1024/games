/* 战斗与动效截图：test-results/war-*.png */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const server = await serve(8222);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
const shot = async (n, w = 600) => { await page.waitForTimeout(w); await page.screenshot({ path: `test-results/war-${n}.png` }); };
await page.goto('http://127.0.0.1:8222/');
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('nanming:hint', '9'); });
await page.reload();
await page.waitForFunction(() => window.NM?.map?.reliefReady, null, { timeout: 20000 }).catch(() => {});
await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 5), false));
await page.waitForTimeout(500);
for (const k of ['field', 'naval']) {
  page.evaluate(x => NM_testBattle(x), k);
  await shot(k + '-deploy', 1800);
  await page.click('[data-form="arrow"]'); await page.click('#deploy-go'); await page.waitForTimeout(300);
  await page.click('#lead-1'); await page.click('#battle-go');
  await shot(k + '-round', 2600);
  await page.click('#battle-auto'); await shot(k + '-result', 1500);
  await page.click('#battle-done');
}
// 地图动效
await page.evaluate(() => { NM.map.focus('nanjing', 2.4); const m = NM.map; m.addFx({ kind: 'capture', node: 'yangzhou', color: '#3a5d8f', color2: '#b5342a', text: '清', dur: 4000 }); m.addFx({ kind: 'clash', node: 'chuzhou', dur: 4000 }); m.addFx({ kind: 'treaty', node: 'suzhou', color: '#b5342a', color2: '#2f7d78', text: '约', dur: 4000 }); });
await shot('mapfx', 1300);
await page.evaluate(() => { NM.selectNode('nanjing'); }); await page.click('#act-policy'); await page.waitForTimeout(900); await page.click('[data-card="agri"]'); await shot('policyfx', 1100);
console.log(errors);
await browser.close(); server.close();
