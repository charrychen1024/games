/* 行军与运粮路线：沿驿路弧线画行军线、粮道（断处标红叉）、调拨窗口写路程与途耗。node tools/shot-route.mjs（先 npm run build） */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
const OUT = process.env.OUT ?? 'test-results';
const server = await serve(8245);
const b = await pw.chromium.launch({ channel: 'chrome' });
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', e => console.log('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8245/');
await page.evaluate(() => localStorage.setItem('nanming:hint', '9'));
await page.evaluate(() => { const s = NM_presets.createGame('hongguang', 3); s.cities.huaian.controller = 'local'; NM.start(s, false); });
await page.waitForTimeout(600);
await page.keyboard.press('Escape');
// 一、行军线：南京一军开往徐州（淮安已失，绕道滁州、凤阳），沿路弧线画
const army = await page.evaluate(() => Object.values(NM.s.armies).find(a => a.faction === NM.s.player && a.location === 'nanjing').id);
await page.evaluate(id => { NM.addOrder({ id: NM.newOrderId(), kind: 'army', army: id, order: { kind: 'move', target: 'xuzhou', attack: false } }); NM.closePanel?.(); NM.map.focus('chuzhou', 1.6); }, army);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/route-1-march.png` });
console.log('march path', await page.evaluate(() => JSON.stringify(NM.map.view.planned)));
// 二、粮道：军队在杭州，粮台南京——沿运河画金色粮道
await page.evaluate(id => { NM.orders = []; NM.renderAll(); const a = NM.s.armies[id]; a.location = 'hangzhou'; a.supply = 'nanjing'; NM.renderArmy(id); NM.map.view.selectedArmy = id; NM.map.focus('jiaxing', 3); }, army);
await page.waitForTimeout(900);
await page.screenshot({ path: `${OUT}/route-2-supply.png` });
console.log('supply tile', await page.evaluate(() => document.querySelector('#army-supplyline')?.textContent));
// 三、粮道被截：敌军驻在杭州四周
await page.evaluate(id => { const s = NM.s; const tmpl = s.armies[id]; for (const n of ['shaoxing', 'huizhou', 'ningguo', 'quzhou', 'huzhou', 'jiaxing', 'jinhua']) s.armies['e_' + n] = { ...structuredClone(tmpl), id: 'e_' + n, faction: 'shun', location: n, path: [], progress: 0, supply: 'xian' }; NM.renderAll(); NM.renderArmy(id); NM.map.view.selectedArmy = id; }, army);
await page.waitForTimeout(900);
await page.waitForTimeout(600);
await page.screenshot({ path: `${OUT}/route-3-cut.png` });
console.log('supply tile cut', await page.evaluate(() => document.querySelector('#army-supplyline')?.textContent));
// 四、调拨窗口：南京调粮往远处友城
await page.evaluate(() => { for (const k of Object.keys(NM.s.armies)) if (k.startsWith('e_')) delete NM.s.armies[k]; NM.closePanel?.(); NM.formTransfer('nanjing', 'guangzhou'); });
await page.waitForTimeout(700);
await page.screenshot({ path: `${OUT}/route-4-transfer.png` });
console.log('transfer status', await page.evaluate(() => document.querySelector('#tr-status')?.textContent));
await b.close(); server.close?.(); process.exit(0);
