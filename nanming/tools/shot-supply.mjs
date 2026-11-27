/* 粮台规则的界面：军队面板写谁家供饷；选粮台时悬停城池写支粮之数与谁家出钱，或为何不行。node tools/shot-supply.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const OUT = process.env.SHOT_OUT ?? 'test-results';
const server = await serve(8239);
const b = await pw.chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8239/');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.evaluate(() => NM.start(NM_presets.createGame('zheng', 3), false));
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await page.evaluate(() => { NM.selectArmy('a_zhk'); NM.map.focus('zhenjiang', 1.6); });
await page.waitForTimeout(600);
console.log('粮台栏：', (await page.locator('#panel').innerText()).match(/粮台[\s\S]{0,20}/)?.[0].replace(/\s+/g, ' '));
await page.screenshot({ path: `${OUT}/supply-1-panel.png` });
await page.click('#act-supply'); await page.waitForTimeout(300);
const xy = id => page.evaluate(id => { const m = NM.map, r = m.canvas.getBoundingClientRect(); const p = m.toScreen(...NM_nodePt(id)); return [r.left + p[0], r.top + p[1] - 8]; }, id);
for (const id of ['nanjing', 'zhenjiang']) {
  const [x, y] = await xy(id); await page.mouse.move(x, y); await page.waitForTimeout(350);
  console.log(id, '→', (await page.locator('#tooltip').innerText().catch(() => '')).replace(/\s+/g, ' '));
  await page.screenshot({ path: `${OUT}/supply-2-${id}.png` });
}
await page.evaluate(() => NM.map.focus('anping', 1.6)); await page.waitForTimeout(400);
{ const [x, y] = await xy('anping'); await page.mouse.move(x, y); await page.waitForTimeout(350);
  console.log('anping →', (await page.locator('#tooltip').innerText().catch(() => '')).replace(/\s+/g, ' '));
  await page.screenshot({ path: `${OUT}/supply-3-anping.png` }); }
await b.close(); server.close();
