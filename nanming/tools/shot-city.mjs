/* 城池面板截图：己方大城、敌城、被围之城。用法：node tools/shot-city.mjs 输出前缀 */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const out = process.argv[2] ?? 'test-results/city';
const PORT = Number(process.env.PORT ?? 8216);
const server = await serve(PORT);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = []; page.on('pageerror', e => errors.push(e.message));
await page.goto(`http://127.0.0.1:${PORT}/`);
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload();
await page.waitForFunction(() => window.NM?.map?.reliefReady, null, { timeout: 20000 }).catch(() => {});
await page.click('#btn-new'); await page.waitForTimeout(900);
await page.click('#pick-hongguang'); await page.click('#pick-go'); await page.waitForTimeout(2400);
await page.click('#intro').catch(() => {}); await page.waitForTimeout(900);
for (const [id, tag] of [['nanjing', 'own'], ['xian', 'foe'], ['luzhou', 'vassal']]) {
  await page.evaluate(id => { NM.map.focus(id, 2); NM.selectNode(id); }, id); await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}-${tag}.png` });
}
// 逐项预估与募兵窗口
await page.evaluate(() => { NM.map.focus('nanjing', 2); NM.selectNode('nanjing'); }); await page.waitForTimeout(700);
await page.click('#city-silver'); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}-forecast.png` });
await page.click('#act-recruit'); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}-recruit.png` });
await page.$eval('#recruit-n', el => { el.value = el.max; el.dispatchEvent(new Event('input')); }); await page.waitForTimeout(200);
await page.screenshot({ path: `${out}-recruit-max.png` });
await page.evaluate(() => NM.closeModal());
await page.evaluate(() => { NM.map.focus('anqing', 2); NM.selectNode('anqing'); }); await page.waitForTimeout(700);
await page.click('#city-grain'); await page.waitForTimeout(300);
await page.click('#act-recruit'); await page.waitForTimeout(500);
await page.screenshot({ path: `${out}-recruit-poor.png` });
// 郑氏看镇江（属弘光朝廷）
await page.evaluate(() => NM.closeModal());
await page.evaluate(() => { NM.start(NM_presets.createGame('zheng', 1), false); NM.map.focus('zhenjiang', 2.2); NM.selectNode('zhenjiang'); }); await page.waitForTimeout(900);
await page.screenshot({ path: `${out}-zheng-zhenjiang.png` });
console.log(errors.length ? 'ERR ' + errors.join(' | ') : 'ok');
await browser.close(); server.close();
