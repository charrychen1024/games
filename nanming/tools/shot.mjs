/* 截图：node tools/shot.mjs —— 生成 screenshots/ 下的几张图（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const W = Number(process.env.W ?? 1440), H = Number(process.env.H ?? 900);
const server = await serve(8211);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const shot = async (name) => { await page.waitForTimeout(350); await page.screenshot({ path: `screenshots/${name}.png` }); };
await page.goto('http://127.0.0.1:8211/?sample');
await page.evaluate(() => { try { localStorage.clear(); localStorage.setItem('nanming:hint', '9'); } catch {} });
await page.reload();
await page.waitForFunction(() => window.NM?.map?.reliefReady, null, { timeout: 20000 }).catch(() => console.log('relief not ready'));
await page.waitForTimeout(2500);
await shot('00-title');
await page.click('#btn-new'); await page.waitForTimeout(500);
await page.evaluate(() => NM.selectNode('nanjing'));
await shot('03-start');
await page.evaluate(() => { NM.closePanel(); NM.map.focus('wuchang', 0.8); });
await shot('01-overview');
// 推进一个月，看要闻与军情
await page.evaluate(() => { NM.addOrder({ id: 'o0-9', kind: 'recruit', node: 'nanjing', troops: 2000 }); });
await page.click('#btn-next');
for (let i = 0; i < 80; i++) {
  if (await page.locator('[data-choice]').first().isVisible().catch(() => false)) { await shot('07-choice'); await page.click('[data-choice="0"]'); }
  if (await page.locator('#news-skip').isVisible().catch(() => false)) break;
  await page.waitForTimeout(150);
}
await shot('08-splash');
await page.click('#news-skip');
await page.evaluate(() => { NM.selectNode('nanjing'); NM.cityTab = 'ledger'; NM.renderCity('nanjing'); });
await shot('06-report');
await page.evaluate(() => NM.selectArmy('a_huang'));
await shot('09-army');
await page.evaluate(() => NM.formCommand('a_huang', { kind: 'move', target: 'chuzhou', attack: false }));
await shot('10-command');
await page.evaluate(() => NM.closeModal());
// 样稿
await page.evaluate(() => NM.showTitle());
await page.click('#btn-sample'); await page.waitForTimeout(600);
await page.evaluate(() => document.querySelector('#report').classList.add('hidden'));
await shot('02-siege');
await page.click('#btn-next');
await page.waitForSelector('#battle-go', { timeout: 20000 });
await page.waitForTimeout(400);
await page.click('#battle-go');
await page.waitForTimeout(700);
await shot('04-battle-anim');
await page.waitForTimeout(1300);
await shot('05-battle');
console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
await browser.close(); server.close();
