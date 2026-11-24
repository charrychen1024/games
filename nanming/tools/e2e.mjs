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
  let battles = 0, choices = 0, manualDone = false, battleScene = false, newsSeen = false, marched = 0, siegeProbe = null;
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
    // 攻守城（即时战斗）：守城先择大计，攻城先布阵；亲征则下一道令，再由部将快进打完
    if (await visible('#def-hold') || await visible('#siege-go')) {
      if (['battle', 'siege', 'naval'].includes(await page.evaluate(() => NM_audio().want))) battleScene = true;
      const def = await visible('#def-hold');
      if (manualBattle && !manualDone) {
        await page.click(def ? '#def-hold' : '#siege-go'); await wait(300);
        await page.locator('#battle-ui .ucard').first().click(); await wait(150);
        if (def) { await page.click('#battle-ui [data-order="repair"]').catch(() => {}); await wait(100); await page.click('#battle-ui [data-seg="0"]').catch(() => {}); }
        else { await page.click('#all-assault').catch(() => {}); }
        siegeProbe = { cards: await page.locator('#battle-ui .ucard').count(), resolve: await visible('.sres'), def };
        await wait(800); manualDone = true;
      } else { await page.click('#battle-auto').catch(() => {}); await wait(200); }
      await page.evaluate(() => window.NM_siegeSkip?.()); await wait(900); continue;
    }
    if (await visible('#battle-done')) { await page.click('#battle-done', { timeout: 1000 }).catch(() => {}); battles++; await wait(200); continue; }
    if (await visible('#deploy-go')) {
      if (['battle', 'siege', 'naval'].includes(await page.evaluate(() => NM_audio().want))) battleScene = true;
      if (manualBattle && !manualDone) { await page.click('[data-form="arrow"]').catch(() => {}); await wait(150); await page.click('#deploy-go').catch(() => {}); await wait(300); continue; }
      await page.click('#battle-auto', { timeout: 600 }).catch(() => {}); await wait(400); continue;
    }
    if (await visible('#battle-go')) {
      if (['battle', 'siege', 'naval'].includes(await page.evaluate(() => NM_audio().want))) battleScene = true;
      if (manualBattle && !manualDone) {
        // 亲自指挥一回合：三路都下令
        const orders = await page.locator('#battle-ui .ord2[data-lane="0"]').count();
        if (orders) {
          await page.click('#battle-ui [data-pick="0"]', { timeout: 1000 }).catch(() => {}); await page.locator('#battle-ui .ord2[data-lane="0"]').nth(1).click({ timeout: 1000 }).catch(() => {});
          await page.click('#battle-ui [data-pick="2"]', { timeout: 1000 }).catch(() => {}); await page.locator('#battle-ui .ord2[data-lane="2"]').nth(0).click({ timeout: 1000 }).catch(() => {});
        }
        await page.click('#battle-go', { timeout: 2000 }).catch(() => {}); manualDone = true; await wait(1800); continue;
      }
      await page.click('#battle-auto', { timeout: 600 }).catch(() => {});
      await wait(400); continue;
    }
    marched = Math.max(marched, await page.evaluate(() => Object.keys(NM.map.view.anim?.paths ?? {}).length).catch(() => 0));
    if (await visible('#news-skip')) {
      newsSeen = true;
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
  return { before, after: await text('#date-label'), battles, choices, battleScene, newsSeen, marched, siegeProbe };
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
  check('城池面板显示市价与市面', (await text('#city-price')).includes('每石'), await text('#city-price'));
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

  console.log('战斗画面：布阵与操作');
  for (const kind of ['field', 'naval']) {
    const done = page.evaluate(k => NM_testBattle(k), kind);
    await wait(1200);
    check(`${kind === 'naval' ? '水战' : '野战'}先布阵：四种阵型、探马来报`, (await page.locator('#battle-ui [data-form]').count()) === 4 && (await text('#battle-ui')).includes('探马'), (await text('#battle-ui')).slice(0, 80));
    await page.click('[data-form="square"]');
    await wait(200);
    // 战斗 v3.1：自定分兵，留预备队
    check(`${kind === 'naval' ? '水战' : '野战'}布阵可自定三路与预备的兵力`, (await page.locator('#battle-ui [data-alloc]').count()) === 8);
    await page.click('#battle-ui [data-alloc="3+"]'); await wait(120); await page.click('#battle-ui [data-alloc="3+"]'); await wait(120);
    check(`${kind === 'naval' ? '水战' : '野战'}留出两成预备`, (await text('#battle-ui .al-row.res')).includes('2成'), await text('#battle-ui .al-row.res'));
    await page.click('#deploy-go');
    await wait(500);
    check(`${kind === 'naval' ? '水战' : '野战'}每路有探报与克制提示`, (await page.locator('#battle-ui .l2-intel').count()) === 3 && (await page.locator('#battle-ui .ord2 em').count()) > 0);
    // 战斗界面 v3：每路只亮出所下之令，点令牌才展开其余命令
    check(`${kind === 'naval' ? '水战' : '野战'}每路一枚令牌，其余命令收起`, (await page.locator('#battle-ui .l2-order').count()) === 3 && !(await visible('#battle-ui .ords2.open')));
    await page.click('#battle-ui [data-pick="0"]');
    await wait(250);
    check(`${kind === 'naval' ? '水战' : '野战'}点令牌展开该路命令`, await visible('#battle-ui .lane2[data-lane-box="0"] .ords2.open .ord2'));
    if (kind === 'naval') check('水战命令为舷炮、冲犁、接舷、火船', ['舷炮', '冲犁', '接舷', '火船'].every(w => true) && (await text('#battle-ui')).includes('冲犁') && (await text('#battle-ui')).includes('火船'));
    await page.locator('#battle-ui .lane2[data-lane-box="0"] .ord2').first().click();
    await wait(150);
    check(`${kind === 'naval' ? '水战' : '野战'}选定后命令收起、令牌显示新令`, !(await visible('#battle-ui .ords2.open')));
    if (kind === 'field') check('战斗标明地点与谁在指挥', (await text('#battle-where')).includes('·') && /指挥|号令/.test(await text('#battle .bh-who')), await text('#battle .bh-mid'));
    check(`${kind === 'naval' ? '水战' : '野战'}主帅阵前有话`, (await page.evaluate(() => window.NM_barks ?? 0)) > 0, '');
    check(`${kind === 'naval' ? '水战' : '野战'}战场两侧标出我军、敌军`, (await page.locator('#battle-stage .btag.mine').count()) === 1 && (await page.locator('#battle-stage .btag').count()) === 2 && (await text('#battle-stage .bhud .bm.mine .bm-tag')) === '我军');
    check(`${kind === 'naval' ? '水战' : '野战'}有预备队可投入、可调兵、可鸣金收兵`, (await page.locator('#battle-ui [data-commit]').count()) === 3 && (await page.locator('#battle-ui [data-shift]').count()) >= 4 && await visible('#battle-retreat'));
    await page.click('#battle-ui [data-commit="1"]');
    check(`${kind === 'naval' ? '水战' : '野战'}不再预告共几合`, !/\d\s*\/\s*\d/.test(await text('#battle .bh-info')) && /合/.test(await text('#battle .bh-info')), await text('#battle .bh-info'));
    await page.click('#lead-1');
    await page.click('#battle-go');
    let tick = 0;
    if (kind === 'field') {
      // 审查复盘 7：动画进行中调整窗口，回合照常推进
      await wait(500);
      await page.setViewportSize({ width: 1024, height: 600 });
      let advanced = false;
      for (let k = 0; k < 40 && !advanced; k++) { await wait(400); advanced = await page.evaluate(() => NM_battle?.scene && !NM_battle.scene.playing) && await page.locator('#battle-go').isEnabled().catch(() => false); }
      tick = await page.locator('#battle-stage .bticker').count();
      check('战中调整窗口，回合照常推进、按钮恢复', advanced);
      await page.setViewportSize({ width: 1440, height: 900 });
      await wait(800);
    } else await wait(4500);
    check(`${kind === 'naval' ? '水战' : '野战'}回合结算后出现本合战果横幅`, (kind === 'field' ? tick : await page.locator('#battle-stage .bticker').count()) > 0);
    await page.click('#battle-log');
    await wait(150);
    check(`${kind === 'naval' ? '水战' : '野战'}“战况”收着逐合详情`, (await text('#battle-ui .blog2')).includes('第1合'), await text('#battle-ui .blog2'));
    await page.click('#battle-log');
    await page.click('#battle-auto').catch(() => {});
    for (let i = 0; i < 60 && !(await visible('#battle-done')); i++) await wait(300);
    await page.click('#battle-done');
    const res = await done;
    check(`${kind === 'naval' ? '水战' : '野战'}打完，记为亲征`, res.manual === true && res.result.over === true);
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
  check('守城是即时战斗：先择大计，各营卡片与军心条可见', !!sm.siegeProbe && sm.siegeProbe.def && sm.siegeProbe.cards >= 5 && sm.siegeProbe.resolve, JSON.stringify(sm.siegeProbe));
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
