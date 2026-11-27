/* 地图拥挤处：军旗让开、同处多军悬停展开、点选最近者。node tools/shot-crowd.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const OUT = process.env.SHOT_OUT ?? 'test-results';
const server = await serve(8235);
const b = await pw.chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:8235/');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 1), false));
await page.waitForTimeout(500);
await page.keyboard.press('Escape');
// 镜头拉远到江北，诸镇军旗挤在一起
await page.evaluate(() => NM.map.focus('yangzhou', 1.1));
await page.waitForTimeout(600);
const info = await page.evaluate(() => {
  const m = NM.map, r = m.canvas.getBoundingClientRect();
  const multi = m.stacks.find(st => st.armies.length > 1 && st.sx > 420 && st.sx < 1000);
  let minD = 1e9; for (let i = 0; i < m.stacks.length; i++) for (let j = i + 1; j < m.stacks.length; j++) minD = Math.min(minD, Math.hypot(m.stacks[i].sx - m.stacks[j].sx, m.stacks[i].sy - m.stacks[j].sy));
  return { n: m.stacks.length, minD: Math.round(minD), multi: multi ? { x: r.left + multi.sx, y: r.top + multi.sy, armies: multi.armies } : null };
});
console.log('stacks', info.n, 'min gap px', info.minD, 'multi', info.multi?.armies);
await page.screenshot({ path: `${OUT}/crowd-1.png` });
if (info.multi) {
  await page.mouse.move(info.multi.x, info.multi.y); await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/crowd-2-fan.png` });
  const slot = await page.evaluate(id => { const m = NM.map, r = m.canvas.getBoundingClientRect(); const h = m.armyHits.find(x => x.id === id && x.r === 13); return h ? [r.left + h.x, r.top + h.y] : null; }, info.multi.armies[1]);
  await page.mouse.move(slot[0], slot[1]); await page.waitForTimeout(200);
  await page.mouse.click(slot[0], slot[1]); await page.waitForTimeout(400);
  console.log('picked', await page.evaluate(() => NM.map.view.selectedArmy), 'want', info.multi.armies[1]);
  await page.screenshot({ path: `${OUT}/crowd-3-pick.png` });
}
await b.close(); server.close();
