/* 南明 · 端到端测试：node tools/e2e.mjs（先 npm run build）
 * 用真实鼠标操作走一遍试玩：点城、下令、号令下属、推进十二个月、处理战斗与史事抉择、存读档、样稿局面的手动守城。 */
import { serve } from './serve.mjs';
import pw from './pw.mjs';
import fs from 'node:fs';
// 运行截图写入独立结果目录（不进仓库）
const OUT = process.env.E2E_OUT ?? 'test-results';
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8212;
let pass = 0, fail = 0;
const check = (name, ok, detail) => { if (ok) { pass++; console.log('  ✓ ' + name); } else { fail++; console.log('  ✗ ' + name + (detail ? '  [' + detail + ']' : '')); } };

const server = await serve(PORT);
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('fonts.g')) errors.push(m.text()); });
const wait = ms => page.waitForTimeout(ms);
const visible = sel => page.locator(sel).first().isVisible().catch(() => false);
const text = sel => page.locator(sel).first().innerText().catch(() => '');
const armyXY = id => page.evaluate(id => { const m = NM.map; const h = m.armyHits.find(x => x.id === id); if (!h) return null; return [(h.x - m.cam.x) * m.cam.z + m.w / 2, (h.y - m.cam.y) * m.cam.z + m.h / 2]; }, id);

/** 推进一个月：遇到史事抉择选第一项，遇到战斗交给部将自动打完 */
async function nextMonth(manualBattle = false, probe = null) {
  const before = await text('#date-label');
  await page.click('#btn-next');
  const t0 = Date.now();
  let battles = 0, choices = 0, manualDone = false, battleScene = false, newsSeen = false, newsArtMotion = '', marched = 0, siegeProbe = null;
  while (Date.now() - t0 < 150000) {
    if (await visible('[data-choice]')) {
      if (probe && !probe.done) {
        // 审查复盘 1：强制决断按 Esc、Tab、点背景都不能离开
        probe.done = true;
        await wait(600);
        await page.keyboard.press('Escape'); await wait(200);
        probe.esc = await visible('[data-choice]');
        for (let k = 0; k < 6; k++) await page.keyboard.press('Tab');
        probe.focusIn = await page.evaluate(() => !!document.activeElement?.closest('#modal'));
        await page.mouse.click(8, 450); await wait(200);
        probe.bg = await visible('[data-choice]');
      }
      await page.click('[data-choice="0"]', { timeout: 1000 }).catch(() => {}); choices++; await wait(150); continue;
    }
    // 即时战斗（攻城、守城、野战、水战）：一开场即交战，守城先择大计；亲征则在战场上选一营下一道令，再由部将快进打完；打完自行收场
    if (await visible('#battle .shud') && !(await page.evaluate(() => !!window.NM_siege?.sim?.over))) {
      if (['battle', 'siege', 'naval'].includes(await page.evaluate(() => NM_audio().want))) battleScene = true;
      const def = await visible('#def-hold');
      if (manualBattle && !manualDone) {
        if (def) { await page.click('#def-hold'); await wait(300); }
        const me = await page.evaluate(() => { const v = NM_siege.view; const u = NM_siege.sim.units.find(x => x.side === v.o.me && x.state !== 'gone' && x.troops >= 1); const q = v.unitScreen(u.id); const r = v.cv.getBoundingClientRect(); return { id: u.id, x: r.left + q[0], y: r.top + q[1] }; });
        await page.mouse.click(me.x, me.y); await wait(150);
        const picked = await page.evaluate(() => NM_siege.view.selected);
        if (def) {
          // 再点本营所守之段：边守边修
          await page.mouse.click(me.x, me.y); await wait(150);
        } else {
          const seg = await page.evaluate(() => { const v = NM_siege.view; const q = v.segScreen?.(2) ?? null; const r = v.cv.getBoundingClientRect(); return q ? [r.left + q[0], r.top + q[1]] : null; });
          if (seg) { await page.mouse.click(seg[0], seg[1]); await wait(150); }
        }
        const ord = await page.evaluate(id => NM_siege.sim.units.find(u => u.id === id)?.order, me.id);
        siegeProbe = { cards: await page.locator('#battle-ui .ucard').count(), resolve: await visible('.sres'), def, picked: picked === me.id, order: ord?.t, tray: await page.locator('.otray, .otile').count() };
        await wait(800); manualDone = true;
      } else if (def) { await page.click('#battle-auto').catch(() => {}); await wait(200); }
      await page.evaluate(() => window.NM_siegeSkip?.()); await wait(300); continue;
    }
    if (await visible('.sresult')) { battles++; await page.waitForFunction(() => document.querySelector('#battle')?.classList.contains('hidden'), null, { timeout: 8000 }).catch(() => {}); continue; }
    marched = Math.max(marched, await page.evaluate(() => Object.keys(NM.map.view.anim?.paths ?? {}).length).catch(() => 0));
    if (await visible('#news-skip')) {
      newsSeen = true;
      if (!newsArtMotion) newsArtMotion = await page.evaluate(() => document.querySelector('#news .na')?.dataset.motion ?? '');
      if (probe && !probe.enter) {
        // 视听审查 4：焦点在“看全部军情”上按回车，执行的是这个按钮，不是翻到下一条
        probe.enter = true;
        probe.cardSound = await page.evaluate(() => document.querySelector('#news .nw-card')?.dataset.sound ?? '');
        await page.focus('#news-skip'); await page.keyboard.press('Enter'); await wait(450); continue;
      }
      await page.click('#news-skip', { timeout: 1000 }).catch(() => {}); await wait(450); continue;
    }
    // 结算、翻月动画、要闻都过去之后才算这个月结束
    if (!(await page.evaluate(() => NM.resolving))) break;
    await wait(150);
  }
  await wait(200);
  return { before, after: await text('#date-label'), battles, choices, battleScene, newsSeen, newsArtMotion, marched, siegeProbe };
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await wait(1000);
  console.log('标题与开局');
  check('标题页出现，只有一个“开始”大按钮', await visible('#btn-new'));
  check('标题页没有原生下拉框与数字框', (await page.locator('select, input[type=number]').count()) === 0);
  await page.click('#btn-new');
  await wait(700);
  check('择一方：五家可选', (await page.locator('#pick .pcard').count()) === 5);
  check('未选势力前不能开局', await page.locator('#pick-go').isDisabled());
  await page.click('#pick-hongguang');
  check('选中后可开局', await page.locator('#pick-go').isEnabled());
  await page.click('#pick-go');
  await wait(900);
  check('开局过场出现', await visible('#intro'));
  await page.screenshot({ path: `${OUT}/01-intro.png` });
  await page.click('#intro');
  await wait(800);
  check('进入地图，顶栏显示崇祯十七年五月', (await text('#date-label')).includes('崇祯十七年五月'), await text('#date-label'));
  check('开局三步出现', (await text('#hint')).includes('开局三步'));
  await wait(1500);
  const au = await page.evaluate(() => NM_audio());
  check('声音已启动，地图配乐在排', au.running && au.scene === 'map' && au.scheduled > 0, JSON.stringify(au));
  // 直接用页面里暴露的投影：点南京
  const nj = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('nanjing'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await page.mouse.click(nj[0], nj[1]);
  await wait(300);
  check('点南京打开城池详情', (await text('#city-name')).includes('南京'), await text('#city-name'));
  check('详情写明实控者与所奉政权', (await text('#city-controller')).includes('弘光朝廷') && (await text('#city-polity')).includes('明'));

  console.log('下达命令');
  await page.click('#act-policy');
  check('方针以卡牌呈现（七张，带插画）', (await page.locator('#modal .gcard').count()) === 7 && (await page.locator('#modal .gcard img').count()) === 7);
  await page.click('[data-card="agri"]');
  await wait(800);
  check('改方针加入本月命令', (await text('#orders')).includes('劝农'));
  check('下令后开局三步进到第三步', (await page.locator('#hint .q-step.done').count()) >= 2, await text('#hint'));
  await page.click('#act-recruit');
  await page.click('#recruit-ok');
  await wait(200);
  check('募兵加入本月命令', (await text('#orders')).includes('募兵'));
  // 调拨：游戏化下拉框，不用浏览器原生控件
  await page.click('#act-transfer');
  await wait(300);
  check('调拨弹窗没有原生下拉框与数字框', (await page.locator('#modal select, #modal input[type=number]').count()) === 0);
  await page.click('#tr-to .gsel-btn');
  await wait(200);
  check('下拉浮层展开且有选项', (await page.locator('.gsel-list .gsel-opt').count()) > 3);
  await page.locator('.gsel-list .gsel-opt[data-value="zhenjiang"]').click();
  await wait(150);
  check('选中镇江', (await text('#tr-to')).includes('镇江'));
  await page.click('#tr-ok');
  await wait(200);
  check('调拨加入本月命令', (await text('#orders')).includes('镇江'), await text('#orders'));
  // 选中督师标营并下行军令
  await wait(300);
  const sxy = await armyXY('a_shi');
  check('地图上能找到督师标营的军旗', !!sxy);
  if (sxy) {
    await page.mouse.click(sxy[0], sxy[1]);
    await wait(250);
    check('点军旗打开军队详情', (await text('#army-name')).includes('督师标营'));
    await page.click('#act-move');
    const t = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('taiping'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
    await page.mouse.move(t[0], t[1]);
    await wait(100);
    await page.mouse.click(t[0], t[1]);
    await wait(250);
    check('点选目标后加入行军令', (await text('#orders')).includes('开赴太平'), await text('#orders'));
    // 改换粮台：点“粮台”再点镇江
    await page.evaluate(() => NM.selectArmy('a_shi'));
    await wait(200);
    check('己方军队有“粮台”按钮', await visible('#act-supply'));
    await page.click('#act-supply');
    const zj = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('zhenjiang'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
    await page.mouse.move(zj[0], zj[1]);
    await wait(100);
    await page.mouse.click(zj[0], zj[1]);
    await wait(250);
    check('改换粮台加入本月命令（不占政令）', (await text('#orders')).includes('镇江为粮台'), await text('#orders'));
  }
  // 号令黄得功
  await page.evaluate(() => NM.selectArmy('a_huang'));
  await wait(200);
  check('下属军镇显示号令按钮', await visible('#act-command-move'));
  await page.click('#act-command-move');
  const cz = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('hezhou'); return [r.left + (p[0] - m.cam.x) * m.cam.z + m.w / 2, r.top + (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await page.mouse.click(cz[0], cz[1]);
  await wait(250);
  check('号令弹窗显示服从估计与原因', (await text('#cmd-est')).includes('服从度'));
  await page.click('#cmd-ok');
  await wait(200);
  check('号令加入本月命令', (await text('#orders')).includes('号令黄得功部'));

  console.log('推进月份');
  const probe = {};
  const m1 = await nextMonth(false, probe);
  check('第一个月结算后日期前进', m1.after !== m1.before, `${m1.before} → ${m1.after}`);
  check('第一个月有史事抉择（高杰争扬州）', m1.choices >= 1);
  check('强制决断：按 Esc 不关闭', probe.esc === true, JSON.stringify(probe));
  check('强制决断：Tab 焦点留在弹窗内', probe.focusIn === true, JSON.stringify(probe));
  check('强制决断：点背景不关闭', probe.bg === true, JSON.stringify(probe));
  check('本月战报逐条播放过', m1.newsSeen, JSON.stringify(m1));
  check('战报插画按类别带动作', /^(alarm|clash|stamp|drift|hammer|portrait|radiance|search)$/.test(m1.newsArtMotion), m1.newsArtMotion);
  // 地图图层：右下角切换，L 键轮换
  await page.click('[data-lens="war"]'); await wait(200);
  const lw = await page.evaluate(() => NM.map.view.lens);
  await page.keyboard.press('l'); await wait(200);
  const le = await page.evaluate(() => NM.map.view.lens);
  const legend = await page.locator('#lens .lens-lg .lg-i').count();
  await page.keyboard.press('l'); await wait(200);
  // 招贤：城池政令台有“招贤”，下令后本月多出一位地方人物
  {
    const n0 = await page.evaluate(() => Object.keys(NM.s.chars).length);
    await page.evaluate(() => { const c = Object.values(NM.s.cities).find(x => x.controller === NM.s.player && x.silver >= 4000 && !NM.s.sieges[x.id]); NM.selectNode(c.id); });
    await wait(400);
    const hasSeek = await visible('#act-seek');
    if (hasSeek) { await page.click('#act-seek'); await wait(300); await page.click('#seek-ok').catch(() => {}); await wait(200); }
    const queued = await page.evaluate(() => NM.orders.some(o => o.kind === 'seek'));
    check('城池政令台可以招贤，下令后排入本月命令', hasSeek && queued, `${hasSeek} ${queued} ${n0}`);
    await page.evaluate(() => NM.closePanel());
  }
  // 图层在顶栏，打开城池面板后按钮仍可点、图例不压右侧面板
  await page.evaluate(() => NM.selectNode(NM.s.factions[NM.s.player].capital)); await wait(400);
  await page.click('[data-lens="war"]', { timeout: 3000 }).catch(() => {}); await wait(250);
  const lensProbe = await page.evaluate(() => { const lg = document.querySelector('#lens .lens-lg')?.getBoundingClientRect(), pn = document.querySelector('#panel')?.getBoundingClientRect(); return { lens: NM.map.view.lens, overlap: !!(lg && pn && pn.width && lg.right > pn.left && lg.bottom > pn.top) }; });
  check('图层按钮在顶栏：开着城池面板也点得到，图例不压面板', lensProbe.lens === 'war' && !lensProbe.overlap, JSON.stringify(lensProbe));
  await page.click('[data-lens="faction"]').catch(() => {}); await page.keyboard.press('Escape'); await wait(200);
  check('地图图层：点军情、按 L 换到钱粮并附图例、再按回到势力', lw === 'war' && le === 'econ' && legend >= 4 && (await page.evaluate(() => NM.map.view.lens)) === 'faction', `${lw} ${le} ${legend}`);
  check('每条战报都有配声', !!probe.cardSound, JSON.stringify(probe));
  check('月末军队沿路行进有动画', m1.marched > 0, JSON.stringify(m1));
  await wait(300);
  check('焦点在“看全部军情”上按回车，军情面板随即打开', await visible('#report-entries'));
  if (!(await visible('#report-entries'))) await page.click('#btn-report');
  await wait(300);
  check('军情面板有内容', await visible('#report-entries .entry'));
  const reportText = await text('#report-entries');
  check('军情包含号令下属的结果', reportText.includes('号令黄得功部 →'), reportText.slice(0, 200));
  check('月报包含史事', reportText.includes('史可法督师江北'));
  await page.locator('#report-entries .locate').first().click();
  await wait(250);
  check('点“定位”打开对应城池', await visible('#city-name'));
  check('城池面板有主官或守将头像', await visible('#city-gov img'), await text('#city-gov'));
  check('顶栏显示本月政令余数', /\d+\s*\/\d+ 令/.test(await text('#pill-orders')), await text('#pill-orders'));
  // 钱粮：粜籴、劝饷
  await page.evaluate(() => NM.selectNode('nanjing'));
  await wait(300);
  check('城池面板显示粮价，市面写在提示里', (await text('#city-price')).includes('两/石') && /市面/.test(await page.getAttribute('#city-price', 'data-tip')), await text('#city-price'));
  await page.click('#act-trade'); await wait(400);
  check('粜籴弹窗可买可卖', await visible('#trade-buy') && await visible('#trade-sell'));
  await page.click('#trade-sell').catch(() => {}); await wait(150);
  await page.click('#trade-ok'); await wait(250);
  check('粜粮加入本月命令', (await text('#orders')).includes('粜粮'), await text('#orders'));
  await page.evaluate(() => NM.selectNode('nanjing')); await wait(200);
  await page.click('#act-loan'); await wait(300);
  check('劝捐助饷弹窗写明得银与代价', (await text('#modal')).includes('民心'), (await text('#modal')).slice(0, 80));
  await page.evaluate(() => NM.closeModal());
  check('左上角不显示剧本进度条', (await page.locator('#topbar .yearbar').count()) === 0);
  const eras = await page.evaluate(() => { const s = NM.s; const t0 = s.turn; const out = []; for (const y of [1644, 1647, 1652, 1658]) { s.turn = (y - 1644) * 12 + 2; NM.musicForState(); out.push(NM_audio().era); } s.turn = t0; NM.musicForState(); return out; });
  check('地图配乐随年代自动换曲（四段）', JSON.stringify(eras) === '[0,1,2,3]', JSON.stringify(eras));
  await page.evaluate(() => NM.selectNode('nanjing'));
  await wait(150);
  await page.click('#tab-ledger');
  await wait(150);
  check('城池详情逐项列出钱粮变化并标出你的命令', (await text('#ledger')).includes('你的命令'), (await text('#ledger')).slice(0, 160));
  let months = 1, totalBattles = m1.battles;
  for (let i = 0; i < 5; i++) {
    const r = await nextMonth();
    months++; totalBattles += r.battles;
  }
  check('连续推进六个月', months === 6 && (await page.evaluate(() => NM.s.turn)) === 6, `months=${months}`);
  console.log(`  （本局玩家参与的战斗 ${totalBattles} 场）`);

  console.log('存档与读档');
  await wait(200);
  await page.click('#btn-menu');
  await page.click('#btn-save');
  await page.click('[data-save="1"]');
  await wait(200);
  const saved = await text('#date-label');
  await page.reload();
  await wait(800);
  check('刷新后标题页有“继续游戏”', await visible('#btn-continue'));
  await page.click('#btn-load');
  await page.click('[data-load="1"]');
  await wait(500);
  check('读档后日期一致', (await text('#date-label')) === saved, `${saved} vs ${await text('#date-label')}`);
  check('存档压缩存放', (await page.evaluate(() => localStorage.getItem('nanming:slot:1') ?? '')).startsWith('LZ1:'));

  console.log('声音与演出（视听审查 2、4）');
  await page.click('#btn-menu');
  check('菜单有配乐、环境、音效三条滑杆', (await page.locator('#menu input[type=range]').count()) === 3 && await visible('#vol-amb'));
  for (const k of ['music', 'amb', 'sfx']) await page.locator('#vol-' + k).fill('0');
  await wait(900);
  const lv = await page.evaluate(() => NM_audio().levels);
  check('三条滑杆拉到零，对应总线连同混响归零', !lv || (lv.music < 0.01 && lv.amb < 0.01 && lv.sfx < 0.01), JSON.stringify(lv));
  for (const [k, v] of [['music', '55'], ['amb', '50'], ['sfx', '80']]) await page.locator('#vol-' + k).fill(v);
  check('菜单可切换简化演出', await visible('#btn-motion'));
  await page.click('#btn-motion');
  check('切换后页面标记为简化演出', await page.evaluate(() => document.documentElement.classList.contains('reduced')));
  await page.click('#btn-motion');
  await page.click('#btn-menu');
  const store = await page.evaluate(() => { const s = NM.s; const own = Object.values(s.cities).filter(c => c.controller === s.player); return { grain: own.reduce((n, c) => n + c.grain, 0), n: own.length, tip: document.querySelectorAll('#topbar .pill')[1]?.dataset.tip ?? '' }; });
  check('左上角仓粮是本势力各城之和', store.tip.includes(`所辖 ${store.n} 城`), store.tip);

  console.log('存档写入失败（审查 02）');
  const old1 = await page.evaluate(() => localStorage.getItem('nanming:slot:1'));
  await page.evaluate(() => { window.__setItem = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await page.click('#btn-menu');
  await page.click('#btn-save');
  await page.click('[data-save="1"]');
  await wait(300);
  check('写入失败时提示未保存', (await text('#save-fail')).includes('未能保存'), await text('#toast'));
  check('失败提示给出导出入口', await visible('#save-fail-export'));
  check('没有误报“已存入”', !(await text('#toast')).includes('已存入'));
  const now1 = await page.evaluate(() => localStorage.getItem('nanming:slot:1'));
  check('写入失败时旧档原样保留', now1 === old1);
  await page.click('[data-save="2"]');
  await wait(200);
  check('空槽写入失败也不出现存档', !(await page.evaluate(() => localStorage.getItem('nanming:slot:2'))));
  await page.evaluate(() => { Storage.prototype.setItem = window.__setItem; });
  await page.keyboard.press('Escape');
  await page.evaluate(() => { document.querySelector('#save-fail')?.remove(); NM.closeModal(); });

  console.log('图例（审查 08）');
  await page.click('#btn-menu');
  await page.click('#btn-legend');
  await wait(200);
  check('图例说明色块只是控制范围示意', (await text('#legend')).includes('控制范围示意'));
  await page.locator('#legend .x').click();

  console.log('出征：军令环、行程、宣战（两级之内）');
  await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 4), false));
  await wait(600);
  check('左下角军队栏列出我军', (await page.locator('#armybar .achip').count()) >= 1);
  await page.click('#armybar .achip[data-army="a_shi"]');
  await wait(500);
  check('点军队即出现军令环', await visible('#ring-march'));
  await page.click('#ring-march');
  await page.evaluate(() => NM.map.focus('xuzhou', 1.3));
  await wait(300);
  const bd = await page.evaluate(() => { const m = NM.map; const p = NM_nodePt('baoding'); return [(p[0] - m.cam.x) * m.cam.z + m.w / 2, (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await page.mouse.move(bd[0], bd[1]);
  await wait(300);
  check('瞄准时显示行程日数与月数', /\d+\s*日/.test(await text('#tooltip')) && (await text('#tooltip')).includes('个月'), await text('#tooltip'));
  check('路线上标出每月行至何处', await page.evaluate(() => NM.map.monthMarks.length > 0));
  await page.mouse.click(bd[0], bd[1]);
  await wait(500);
  check('目标属未交战势力时询问宣战', await visible('#war-ok'));
  await page.click('#war-ok');
  await wait(300);
  check('宣战与进攻一并下令', (await page.evaluate(() => NM.orders.map(o => o.kind).join(','))) === 'war,army');
  // 右键直接出征
  await page.click('#armybar .achip[data-army="a_shi"]');
  await wait(300);
  const yzp = await page.evaluate(() => { const m = NM.map; NM.map.focus('nanjing', 2); const p = NM_nodePt('yangzhou'); return [(p[0] - m.cam.x) * m.cam.z + m.w / 2, (p[1] - m.cam.y) * m.cam.z + m.h / 2]; });
  await wait(200);
  const under = await page.evaluate(([x, y]) => { const p = NM.map.pick(x, y); return p?.kind === 'node' ? NM_presets.name(p.id) : ''; }, yzp);
  await page.mouse.click(yzp[0], yzp[1], { button: 'right' });
  await wait(300);
  check('右键点城即开赴（友城不问宣战）', !!under && (await text('#orders')).includes('开赴' + under), `${under} | ${await text('#orders')}`);

  console.log('出兵（任一城）');
  await page.evaluate(() => { NM.selectNode('hangzhou'); });
  await wait(300);
  check('城池有“出兵”', await visible('#act-raise'));
  await page.click('#act-raise');
  await wait(700);
  check('出兵先选将（画像卡）', (await page.locator('#modal .gcard').count()) >= 1);
  await page.locator('#modal .gcard').first().click();
  await wait(900);
  check('再定兵数与兵种', await visible('#raise-ok'));
  await page.click('#raise-ok');
  await wait(300);
  check('出兵加入本月命令', (await text('#orders')).includes('出兵'), await text('#orders'));

  console.log('城下合兵：两军同在一座敌城下，政令台一键合兵攻城');
  {
    const saved = await page.evaluate(() => NM_presets && JSON.stringify(NM.s));
    await page.evaluate(() => { NM.start(NM_presets.createGame('qing', 1), false); for (const id of ['a_duoduo', 'a_ajige']) { const a = NM.s.armies[id]; a.location = 'linqing'; a.path = []; a.progress = 0; } NM.map.focus('linqing', 2.2); NM.selectNode('linqing'); });
    await wait(700);
    check('敌城下有我军：政令台出现“合兵攻城”与“合兵围困”', await visible('#act-storm') && (await text('#act-storm')).includes('合兵') && await visible('#act-blockade'), await text('#cmddock'));
    await page.click('#act-storm'); await wait(300);
    const ords = await page.evaluate(() => NM.orders.filter(o => o.kind === 'army' && o.order.kind === 'siege' && o.order.target === 'linqing').map(o => o.army).sort());
    check('一键给城下两军都下攻城令（同月同城合成一战）', JSON.stringify(ords) === JSON.stringify(['a_ajige', 'a_duoduo']), JSON.stringify(ords));
    await page.evaluate(s => { NM.orders = []; NM.start(JSON.parse(s), false); }, saved);
    await wait(500);
  }

  console.log('战斗画面：一开场即交战，只在战场上下令');
  const unitXY = id => page.evaluate(id => { const v = NM_siege.view; const q = v.unitScreen(id); const r = v.cv.getBoundingClientRect(); return [r.left + q[0], r.top + q[1]]; }, id);
  for (const kind of ['field', 'naval']) {
    const K = kind === 'naval' ? '水战' : '野战';
    const done = page.evaluate(k => NM_testBattle(k, 'att'), kind);
    await wait(1400);
    check(`${K}不另布阵：一开场就在交战，没有“开战”按钮`, (await page.evaluate(() => NM_siege.sim.t)) > 0 && !(await visible('#siege-go')), String(await page.evaluate(() => NM_siege.sim.t)));
    check(`${K}底栏各营看板只看不点（不是按钮）`, (await page.locator('#battle-ui .ucard').count()) >= 4 && (await page.locator('#battle-ui button.ucard').count()) === 0);
    if (kind === 'field') check('战斗标明地点与谁在指挥', (await text('#battle-where')).includes('·') && /指挥|号令/.test(await text('#battle .bh-who')), await text('#battle .sh-mid'));
    check(`${K}头部标出我军、敌军与两军军心`, (await text('#battle .sh-side.mine .bm-tag')) === '我军' && (await page.locator('#battle .sres').count()) === 2);
    check(`${K}写明距日暮多久${kind === 'naval' ? '、风向' : '、地形'}`, /日暮/.test(await text('#battle .sh-info')) && (kind === 'naval' ? /风/.test(await text('#battle .sh-info')) : /平原|丘陵|隔河/.test(await text('#battle .sh-info'))), await text('#battle .sh-info'));
    check(`${K}主帅阵前有话`, (await page.evaluate(() => window.NM_barks ?? 0)) > 0, '');
    check(`${K}有倍速、全军进击、固守、擂鼓、代打、鸣金`, await visible('#siege-x2') && await visible('#all-assault') && await visible('#all-hold') && await visible('#siege-drum') && await visible('#siege-auto') && await visible('#battle-retreat'));
    await page.click('#siege-pause'); await wait(150);
    // 点我军一营：选中，下方小牌写明“点哪里做什么”，没有号令按钮
    const mine = await page.evaluate(() => NM_siege.sim.units.find(u => u.side === 'att' && u.state !== 'gone' && u.kind !== 'gun' && u.kind !== 'art').id);
    let xy = await unitXY(mine);
    await page.mouse.click(xy[0], xy[1]); await wait(200);
    check(`${K}点战场上的我军一营即选中`, (await page.evaluate(() => NM_siege.view.selected)) === mine, String(await page.evaluate(() => NM_siege.view.selected)));
    check(`${K}选中后只有一枚说明小牌，没有号令牌菜单`, await visible('.selchip') && /点敌营/.test(await text('.selchip')) && (await page.locator('.otile, .otray').count()) === 0, await text('.selchip'));
    // 点地面：移阵
    const box = await page.locator('#battle-stage canvas').boundingBox();
    // 找一处没有人的空地
    const gp = await page.evaluate(() => { const v = NM_siege.view; const r = v.cv.getBoundingClientRect(); for (let fy = 0.55; fy < 0.85; fy += 0.05) for (let fx = 0.15; fx < 0.9; fx += 0.05) { const p = v.pick(r.width * fx, r.height * fy); if (p.ground) return [r.left + r.width * fx, r.top + r.height * fy]; } return null; });
    await page.mouse.click(gp[0], gp[1]); await wait(150);
    let ord = await page.evaluate(id => NM_siege.sim.units.find(x => x.id === id).order, mine);
    check(`${K}再点地面即移阵`, ord.t === 'move', JSON.stringify(ord));
    // 点敌营：进击
    const foe = await page.evaluate(() => NM_siege.sim.units.find(u => u.side !== 'att' && u.state !== 'gone').id);
    xy = await unitXY(foe);
    await page.mouse.click(xy[0], xy[1]); await wait(200);
    ord = await page.evaluate(id => NM_siege.sim.units.find(x => x.id === id).order, mine);
    check(`${K}再点敌营即对它进击（一步，不必先选动作）`, (ord.t === 'attack' || ord.t === 'fire') && ord.target === foe, JSON.stringify(ord));
    // 再点本营：原地坚守；右键取消选择
    xy = await unitXY(mine);
    await page.mouse.click(xy[0], xy[1]); await wait(150);
    ord = await page.evaluate(id => NM_siege.sim.units.find(x => x.id === id).order, mine);
    check(`${K}再点本营即原地坚守`, ord.t === 'hold', JSON.stringify(ord));
    await page.mouse.click(box.x + 40, box.y + 200, { button: 'right' }); await wait(150);
    check(`${K}右键取消选择`, (await page.evaluate(() => NM_siege.view.selected)) === null);
    await page.click('#siege-x4'); await wait(2000);
    const moved = await page.evaluate(() => NM_siege.sim.t);
    check(`${K}不分回合，时间连续推进`, moved > 3, String(moved));
    if (kind === 'field') {
      await page.setViewportSize({ width: 1024, height: 600 }); await wait(600);
      const t1 = await page.evaluate(() => NM_siege.sim.t); await wait(800);
      check('战中调整窗口，战斗照常推进', (await page.evaluate(() => NM_siege.sim.t)) > t1);
      await page.setViewportSize({ width: 1440, height: 900 }); await wait(400);
    }
    await page.evaluate(() => window.NM_siegeSkip?.()); await wait(900);
    check(`${K}打完出结果大字，没有确认按钮`, await visible('.sresult') && !(await visible('#battle-done')), await text('.sresult'));
    const t0 = Date.now();
    const res = await done;
    check(`${K}结果亮出数秒后自行收场`, Date.now() - t0 < 6000 && await page.evaluate(() => document.querySelector('#battle').classList.contains('hidden')), String(Date.now() - t0));
    check(`${K}打完，记为亲征`, res.manual === true && res.result.over === true);
  }

  console.log('人物档案');
  await page.click('#btn-chars');
  await wait(500);
  check('人物以带画像的卡片呈现', (await page.locator('#modal .rcard img').count()) >= 5);
  await page.locator('#modal .rcard').first().click();
  await wait(700);
  check('人物档案有画像、能力图与态度', (await page.locator('#modal .pface').count()) === 1 && (await page.locator('#modal .p-radar').count()) === 1);
  await page.evaluate(() => NM.closeModal());

  console.log('自立（郑氏）');
  await page.evaluate(() => NM.start(NM_presets.createGame('zheng', 3), false));
  await wait(500);
  await page.click('#btn-factions');
  await wait(300);
  check('郑氏在“天下”里可下令自立', await visible('#act-independence'));
  await page.click('#act-independence');
  await wait(200);
  check('自立加入本月命令', (await text('#orders')).includes('自立'), await text('#orders'));
  await nextMonth();
  check('结算后郑氏不再奉弘光号令', await page.evaluate(() => !NM.s.factions.zheng.overlord));

  console.log('地图样稿：扬州被围');
  await page.click('#btn-menu');
  await page.click('#btn-title');
  await page.click('#title-ok');
  await wait(300);
  await page.click('#btn-sample');
  await wait(500);
  check('样稿直接打开扬州详情', (await text('#city-name')).includes('扬州'));
  check('详情说明谁在城外围城', (await text('#siege-box')).includes('多铎'), await text('#siege-box'));
  check('详情说明实控者', (await text('#city-controller')).includes('弘光朝廷'));
  await page.screenshot({ path: `${OUT}/02-siege.png` });
  const sm = await nextMonth(true);
  check('扬州攻城战进入战斗画面并完成', sm.battles >= 1, JSON.stringify(sm));
  check('守城是即时战斗：先择大计，各营看板与军心条可见', !!sm.siegeProbe && sm.siegeProbe.def && sm.siegeProbe.cards >= 5 && sm.siegeProbe.resolve, JSON.stringify(sm.siegeProbe));
  check('守城只在战场上下令：点城头一营选中，再点本段即修城；没有号令牌菜单', !!sm.siegeProbe?.picked && sm.siegeProbe?.order === 'repair' && sm.siegeProbe?.tray === 0, JSON.stringify(sm.siegeProbe));
  check('战斗打完不用点确认，自行回到地图', await page.evaluate(() => document.querySelector('#battle').classList.contains('hidden')));
  check('战斗时切换战斗配乐', sm.battleScene === true, JSON.stringify(sm));
  await page.click('#btn-report');
  await wait(300);
  const rep = await text('#report-entries');
  check('月报记录扬州攻城战', rep.includes('扬州攻城战'), rep.slice(0, 200));
  await page.evaluate(() => NM.selectNode('yangzhou'));
  await wait(200);
  const yz = await page.evaluate(() => ({ ctrl: NM.s.cities.yangzhou.controller, siege: !!NM.s.sieges.yangzhou, manual: NM.s.battles.map(b => b.manual), nodes: NM.s.battles.map(b => b.node) }));
  check('手动指挥的战斗被记为亲征', yz.manual.includes(true), JSON.stringify(yz));
  check('扬州要么仍被围，要么已易主（有结果）', yz.siege || yz.ctrl !== 'hongguang', JSON.stringify(yz));

  console.log('结局恢复（审查 03）');
  await nextMonth();
  check('样稿两月后试玩结束弹窗出现', (await text('#modal')).includes('试玩结束'), (await text('#modal')).slice(0, 80));
  const endTurn = await page.evaluate(() => NM.s.turn);
  await page.reload();
  await wait(900);
  check('结局时刷新，标题页有“继续”', await visible('#btn-continue'));
  await page.click('#btn-continue');
  await wait(600);
  check('继续后重新打开试玩结局', (await text('#modal')).includes('试玩结束'), (await text('#modal')).slice(0, 60));
  check('结局面板可“继续推进”', await visible('#end-continue'));
  await page.click('#end-continue');
  await wait(300);
  const after = await page.evaluate(() => ({ turn: NM.s.turn, ended: !!NM.s.ended }));
  check('继续推进进入下一个月', after.turn === endTurn + 1 && !after.ended, JSON.stringify(after));
  check('结束本月按钮可用', await page.locator('#btn-next').isEnabled());
  await page.reload();
  await wait(900);
  await page.click('#btn-continue');
  await wait(600);
  const again = await page.evaluate(() => NM.s.turn);
  check('再次刷新不重复前进、也不再弹结局', again === endTurn + 1 && !(await text('#modal')).includes('试玩结束'), `turn=${again}`);
} catch (e) {
  fail++;
  console.log('  ✗ 测试异常：' + e.message);
  await page.screenshot({ path: `${OUT}/e2e-fail.png` }).catch(() => {});
}
check('全程没有页面错误', errors.length === 0, errors.slice(0, 3).join(' | '));
console.log(`\n通过 ${pass}，失败 ${fail}`);
await browser.close();
server.close();
process.exit(fail ? 1 : 0);
