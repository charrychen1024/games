/* 围城卡上的兵力之比与威慑效果（样稿扬州被围）。node tools/shot-awe.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const OUT = process.env.SHOT_OUT ?? 'test-results';
const server = await serve(8241);
const b = await pw.chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8241/?sample');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.click('#btn-sample'); await page.waitForTimeout(900);
console.log((await page.locator('#siege-box').innerText()).replace(/\s+/g, ' '));
await page.locator('#siege-box').screenshot({ path: `${OUT}/awe-box.png` });
await b.close(); server.close();
