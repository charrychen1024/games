/* 月末战报里的史事卡配会动的小画。node tools/shot-news-event.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const OUT = process.env.SHOT_OUT ?? 'test-results';
const server = await serve(8238);
const b = await pw.chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8238/');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.evaluate(() => NM.start(NM_presets.createGame('zheng', 3), false));
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
await page.evaluate(() => { const s = NM.s; s.reports.push({ turn: s.turn, cat: '史事', node: 'zhenjiang', text: '【郑成功北伐南京】郑成功、张煌言率舟师入长江，克瓜洲、镇江，进围南京。' }); NM.reportTurn = s.turn; NM.showSplash(); });
await page.waitForTimeout(900);
const st = await page.evaluate(async () => {
  const c = document.querySelector('#news canvas'); if (!c) return 'none';
  const g = c.getContext('2d'); const a = g.getImageData(0, 0, c.width, c.height).data;
  await new Promise(r => setTimeout(r, 500));
  const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < a.length; i += 16) if (a[i] !== d[i]) n++;
  return n > 0 ? 'moving' : 'still';
});
console.log('史事战报卡小画：', st, '|', await page.locator('#news .nw-hl').innerText());
await page.screenshot({ path: `${OUT}/news-event.png` });
await b.close(); server.close();
