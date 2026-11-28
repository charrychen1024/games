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
const armyXY = id => page.evaluate(id => { const m = NM.map; const h = m.armyHits.find(x => x.id === id) ?? m.armyHits.find(x => x.stack.includes(id)); if (!h) return null; return [h.x, h.y]; }, id);

/** 推进一个月：遇到史事抉择选第一项，遇到战斗交给部将自动打完 */
async function nextMonth(manualBattle = false, probe = null) {
  const before = await text('#date-label');
  await page.click('#btn-next');
  const t0 = Date.now();
  let fall = '', summary = null, battles = 0, choices = 0, manualDone = false, battleScene = false, newsSeen = false, newsArtMotion = '', marched = 0, siegeProbe = null;
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
      if (probe && probe.scene === undefined) probe.scene = await page.evaluate(() => { const c = document.querySelector('#modal .dialog > .scene canvas'); return !!c && c.width > 200; });
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
    if (await visible('#fall')) {
      if (!fall) fall = await text('#fall');
      await page.click('#fall', { timeout: 1000 }).catch(() => {}); await wait(500); continue;
    }
    if (await visible('#summary-ok')) {
      if (!summary) summary = { tiles: await page.locator('#month-summary .res .gcard').count(), text: await text('#modal'), tips: await page.evaluate(() => [...document.querySelectorAll('#month-summary .gc-chip')].map(e => e.dataset.tip).join(',')) };
      await page.click('#summary-ok', { timeout: 1000 }).catch(() => {}); await wait(200); continue;
    }
    // 结算、翻月动画、要闻都过去之后才算这个月结束
    if (!(await page.evaluate(() => NM.resolving))) break;
    await wait(150);
  }
  await wait(200);
  return { fall, summary, before, after: await text('#date-label'), battles, choices, battleScene, newsSeen, newsArtMotion, marched, siegeProbe };
}

try {
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.reload();
  await wait(1000);
  console.log('标题与开局');
  check('玩家打开的标题页没有样稿入口，只署名', !(await visible('#btn-sample')) && (await text('#title .credit')).trim() === '一尾小石斑 作', await text('#title .credit'));
  await page.goto(`http://127.0.0.1:${PORT}/?sample`);
  await wait(1000);
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
  const nj = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('nanjing'); return (q => [r.left + q[0], r.top + q[1]])(m.toScreen(p[0], p[1])); });
  await page.mouse.click(nj[0], nj[1]);
  await wait(300);
  check('点南京打开城池详情', (await text('#city-name')).includes('南京'), await text('#city-name'));
  check('详情写明实控者与所奉政权', (await text('#city-controller')).includes('弘光朝廷') && (await text('#city-polity')).includes('明'));

  check('农商文刻度带提示：写明现效与下一阶', /田粮/.test(await page.getAttribute('#city-dev-agri', 'data-tip') ?? '') && /商贾辐辏/.test(await page.getAttribute('#city-dev-commerce', 'data-tip') ?? ''));
  check('人口提示写明赋税的算法', /赋税 ≈ 人口/.test(await page.getAttribute('#city-pop', 'data-tip') ?? ''));
  console.log('下达命令');
  await page.click('#act-policy');
  check('方针弹窗有幕僚建议，卡上写一年之效', (await text('#policy-advice')).includes('幕僚建议') && (await text('[data-card="commerce"]')).includes('一年后'));
  check('方针以卡牌呈现（七张，带插画）', (await page.locator('#modal .gcard').count()) === 7 && (await page.locator('#modal .gcard img').count()) === 7);
  await page.click('[data-card="agri"]');
  await wait(800);
  check('改方针加入本月命令', (await text('#orders')).includes('劝农'));
  check('下令后开局三步进到第三步', (await page.locator('#hint .q-step.done').count()) >= 2, await text('#hint'));
  await page.click('#act-recruit');
  await page.click('#recruit-ok');
  await wait(200);
  check('募兵加入本月命令', (await text('#orders')).includes('募兵'));
  // 撤销连带：先劝捐、再靠劝捐之银募兵，撤去劝捐时连带列出募兵
  {
    const dep = await page.evaluate(() => { const s = NM.s; const c = s.cities.suzhou; const keep = NM.orders.slice(); const silver = c.silver;
      c.silver = 500; NM.orders = [{ id: 'xl', kind: 'loan', node: 'suzhou' }, { id: 'xr', kind: 'recruit', node: 'suzhou', troops: 300 }]; NM.renderOrders();
      return { keep, silver }; });
    await page.evaluate(() => NM.removeOrder('xl'));
    await wait(250);
    check('撤去一道时，靠它才成立的命令列出并一并撤销', (await text('#undo-deps')).includes('一并撤销') && (await text('#modal')).includes('募兵'));
    await page.click('#undo-ok');
    await wait(200);
    check('确认后两道一起撤去', (await page.evaluate(() => NM.orders.filter(o => o.id === 'xl' || o.id === 'xr').length)) === 0);
    await page.evaluate(d => { NM.s.cities.suzhou.silver = d.silver; NM.orders = d.keep; NM.renderOrders(); NM.renderTop(); }, dep);
  }
  // 撤离：退往何城、带走留下各几何
  await page.evaluate(() => NM.formEvacuate('yangzhou'));
  await wait(300);
  check('撤离弹窗写明退往何城、带走与留下', await visible('#evac-dests') && (await text('#evac-take')).includes('兵') && (await text('#evac-left')).length > 0);
  await page.click('#evac-scorch');
  await wait(300);
  check('选焦土后写明焚毁', (await text('#evac-left')).includes('焚毁'));
  await page.keyboard.press('Escape');
  await wait(150);
  // 敌城：取此城可得
  await page.evaluate(() => { const s = NM.s; const foe = Object.values(s.cities).find(c => c.controller === 'shun'); NM.selectNode(foe.id); });
  await wait(250);
  check('敌城面板写明取此城可得（户口、赋税、田粮）', (await text('#city-prize')).includes('户口') && (await text('#city-prize')).includes('赋税'));
  await page.evaluate(() => NM.selectNode('nanjing'));
  await wait(150);
  // 在途：远程调拨、出使、行军列表
  await page.evaluate(() => { const s = NM.s; (s.convoys ??= []).push({ id: 'cv1', faction: s.player, from: 'nanjing', to: 'wuchang', grain: 9000, silver: 0, sent: s.turn, arrive: s.turn + 2, days: 70, path: [] }); NM.renderTop(); });
  await page.click('#btn-transit');
  await wait(250);
  check('在途表列出远程调拨，写明约到之期与进度', (await text('#transit-list')).includes('南京 → 武昌') && (await text('#transit-list')).includes('到') && (await page.locator('#transit-list .transit-bar').count()) >= 1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const s = NM.s; s.convoys = s.convoys.filter(v => v.id !== 'cv1'); NM.renderTop(); });
  await wait(150);
  // 裁兵：弹窗写明遣散银与每月所省（只看不下，免占政令）
  await page.click('#act-disband');
  await wait(200);
  check('裁兵弹窗写明遣散银与每月省粮省饷', /遣散银/.test(await text('#modal')) && /每月省粮/.test(await text('#modal')) && /每月省饷/.test(await text('#modal')), await text('#modal'));
  await page.locator('#modal button', { hasText: '取消' }).click();
  await wait(200);
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
  check('调拨写明路程、何时运到与途耗', /路程 \d+ 日，本月送到/.test(await text('#tr-status')) && /途耗/.test(await text('#tr-status')), await text('#tr-status'));
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
    check('驻在粮台的军队不写粮道一行', !(await visible('#army-supplyline')));
    check('军队面板主将头像在右上角', await page.evaluate(() => { const g = document.querySelector('#panel .banner #army-cmd img'); const b = document.querySelector('#panel .banner'); if (!g || !b) return false; const r = g.getBoundingClientRect(), q = b.getBoundingClientRect(); return r.left > q.left + q.width / 2 && r.top < q.top + 40; }), await text('#army-cmd'));
    await page.click('#act-move');
    const t = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('taiping'); return (q => [r.left + q[0], r.top + q[1]])(m.toScreen(p[0], p[1])); });
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
    const zj = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('zhenjiang'); return (q => [r.left + q[0], r.top + q[1]])(m.toScreen(p[0], p[1])); });
    await page.mouse.move(zj[0], zj[1]);
    await wait(100);
    await page.mouse.click(zj[0], zj[1]);
    await wait(250);
    check('改换粮台加入本月命令（不占政令）', (await text('#orders')).includes('镇江为粮台'), await text('#orders'));
  }
  // 军略：行军快慢、粮秣、营垒，不占政令
  await page.evaluate(() => NM.selectArmy('a_shi'));
  await wait(200);
  check('本方军队面板有军略（行军、粮秣、营垒）', await visible('#army-conduct') && await visible('#conduct-pace-forced') && await visible('#conduct-forage-plunder') && await visible('#conduct-camp-true'));
  check('军略有战法与降卒', await visible('#conduct-tactic-night') && await visible('#conduct-captives-absorb'));
  const used0 = await page.evaluate(() => NM.orders.length);
  await page.click('#conduct-pace-forced');
  await wait(200);
  check('选急行加入本月命令', (await text('#orders')).includes('急行'));
  await page.click('#conduct-pace-null');
  await wait(200);
  check('改回常行即撤去该令', (await page.evaluate(() => NM.orders.length)) === used0);
  // 俘虏：点“处置”弹出四种处置卡（后果、成算、依据），选定后卡上显示已定、月末见分晓
  {
    const pid = await page.evaluate(() => { const s = NM.s; const c = Object.values(s.chars).find(x => x.faction === 'shun' && x.status === 'active' && s.factions.shun.leader !== x.id); c.status = 'captured'; c.captor = s.player; c.capturedAt = s.turn; NM.openChars('prisoners'); return c.id; });
    await wait(300);
    await page.click('#pr-open-' + pid);
    await wait(300);
    check('俘虏处置弹出四张卡，写明成算与依据', (await page.locator('#modal .gcard').count()) === 4 && (await text('#modal')).includes('成算') && (await text('#modal')).includes('降意'));
    await page.click('[data-card="recruit"]');
    await wait(400);
    check('选定劝降后，俘虏卡显示已定、月末见分晓', (await text('#pr-q-' + pid)).includes('月末见分晓'));
    await page.evaluate(pid => { NM.orders = NM.orders.filter(o => o.kind !== 'prisoner'); const c = NM.s.chars[pid]; c.status = 'active'; delete c.captor; NM.closeModal(); NM.renderOrders(); NM.renderTop(); }, pid);
    await wait(150);
  }
  // 号令黄得功
  await page.evaluate(() => NM.selectArmy('a_huang'));
  await wait(200);
  check('下属军镇显示号令按钮', await visible('#act-command-move'));
  await page.click('#act-command-move');
  const cz = await page.evaluate(() => { const m = NM.map; const r = m.canvas.getBoundingClientRect(); const p = window.NM_nodePt('hezhou'); return (q => [r.left + q[0], r.top + q[1]])(m.toScreen(p[0], p[1])); });
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
  check('结算之后弹出“本月得失”游戏卡：钱粮兵民四张，来由为小图示（悬停见名）', m1.summary && m1.summary.tiles === 4 && /府库/.test(m1.summary.text) && /赋税田粮|粮饷/.test(m1.summary.tips), JSON.stringify(m1.summary)?.slice(0, 200));
  check('第一个月有史事抉择（高杰争扬州）', m1.choices >= 1);
  check('强制决断：按 Esc 不关闭', probe.esc === true, JSON.stringify(probe));
  check('强制决断：Tab 焦点留在弹窗内', probe.focusIn === true, JSON.stringify(probe));
  check('强制决断：点背景不关闭', probe.bg === true, JSON.stringify(probe));
  check('本月战报逐条播放过', m1.newsSeen, JSON.stringify(m1));
  check('史事抉择顶部有会动的小场景', probe.scene === true, JSON.stringify(probe));
  await page.evaluate(() => NM.formEnvoy('shun')); await wait(400);
  const envScene = await page.evaluate(() => document.querySelector('#modal .dialog > .scene')?.getAttribute('data-scene'));
  await page.keyboard.press('Escape'); await wait(200);
  check('遣使弹窗顶部是两人对坐议事', envScene === 'parley', String(envScene));
  check('战报插画按类别带动作', /^(alarm|clash|stamp|drift|hammer|portrait|radiance|search|scene-[a-z]+)$/.test(m1.newsArtMotion), m1.newsArtMotion);
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
  check('军情面板顶部有本月头条小画', await page.evaluate(() => { const c = document.querySelector('#report .rhead canvas'); return !!c && c.width > 200; }));
  await page.locator('#report-entries .entry .hl').first().click(); await wait(400);
  check('展开一条军情，详情上方配会动的小画', await visible('#report-entries .rmore-scene canvas'));
  await page.locator('#report-entries .entry .hl').first().click(); await wait(200);
  const reportText = await text('#report-entries');
  check('军情包含号令下属的结果', reportText.includes('号令黄得功部 →'), reportText.slice(0, 200));
  check('月报包含史事', reportText.includes('史可法督师江北'));
  await page.locator('#report-entries .locate').first().click();
  await wait(250);
  check('点“定位”打开对应城池', await visible('#city-name'));
  check('城池面板有主官或守将头像', await visible('#city-gov img'), await text('#city-gov'));
  await page.evaluate(() => NM.openChar('shikefa')); await wait(500);
  const pScene = await page.evaluate(() => document.querySelector('#modal .pdlg > .scene')?.getAttribute('data-scene'));
  check('人物档案顶部小画写此人此刻所为（史可法统兵：行军）', pScene === 'march', String(pScene));
  await page.keyboard.press('Escape'); await wait(200);
  check('顶栏显示本月政令余数', /\d+\s*\/\d+ 令/.test(await text('#pill-orders')), await text('#pill-orders'));
  // 试玩反馈：政令用尽时提示被弹窗盖住 → 政令台要占政令的按钮标“令尽”，点了不开选择窗，警示在最上层
  {
    const saved = await page.evaluate(() => JSON.stringify(NM.orders));
    await page.evaluate(() => { const s = NM.s; const cities = Object.values(s.cities).filter(c => c.controller === s.player); const bud = NM_budget(); NM.orders = []; for (let i = 0; i < bud; i++) NM.orders.push({ id: 'b' + i, kind: 'policy', node: cities[i % cities.length].id, policy: 'agri' }); NM.selectNode('suzhou'); NM.renderAll(); });
    await wait(300);
    const spentBtn = await page.evaluate(() => { const b = [...document.querySelectorAll('#cmddock .dk-btn')].find(x => x.classList.contains('spent')); return b?.id ?? ''; });
    if (spentBtn) await page.click('#' + spentBtn);
    await wait(300);
    const modalOpen = await visible('#modal .dialog');
    const z = await page.evaluate(() => { const t = document.querySelector('#toast div.alert'); return t ? +getComputedStyle(document.getElementById('toast')).zIndex : 0; });
    check('政令用尽：按钮标令尽、点了不开选择窗、警示压在弹窗之上', !!spentBtn && !modalOpen && z > 70, `${spentBtn} ${modalOpen} z=${z}`);
    await page.evaluate(s => { NM.orders = JSON.parse(s); NM.renderAll(); }, saved);
  }
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
  const bd = await page.evaluate(() => { const m = NM.map; const p = NM_nodePt('baoding'); return m.toScreen(p[0], p[1]); });
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
  const yzp = await page.evaluate(() => { const m = NM.map; NM.map.focus('nanjing', 2); const p = NM_nodePt('yangzhou'); return m.toScreen(p[0], p[1]); });
  await wait(200);
  const under = await page.evaluate(([x, y]) => { const p = NM.map.pick(x, y); return p?.kind === 'node' ? NM_presets.name(p.id) : ''; }, yzp);
  await page.mouse.click(yzp[0], yzp[1], { button: 'right' });
  await wait(300);
  check('右键点城即开赴（友城不问宣战）', !!under && (await text('#orders')).includes('开赴' + under), `${under} | ${await text('#orders')}`);
  // 试玩反馈：选目标时如何取消；能否点野外的敌军
  await page.evaluate(() => { NM.orders = []; NM.renderAll(); });
  await page.click('#armybar .achip[data-army="a_shi"]'); await wait(300);
  await page.click('#ring-march'); await wait(250);
  const barOn = await visible('#targetbar');
  await page.click('#target-cancel'); await wait(200);
  const cancelBtn = !(await visible('#targetbar')) && (await page.evaluate(() => !NM.map.view.targeting));
  await page.click('#armybar .achip[data-army="a_shi"]'); await wait(300);
  await page.click('#ring-march'); await wait(250);
  await page.click('#ring-march'); await wait(200);
  const toggleOff = await page.evaluate(() => !NM.map.view.targeting);
  await page.click('#armybar .achip[data-army="a_shi"]'); await wait(300);
  await page.click('#ring-march'); await wait(250);
  const empty = await page.evaluate(() => { const m = NM.map; for (let y = 200; y < m.h - 200; y += 23) for (let x = 300; x < m.w - 420; x += 29) if (!m.pick(x, y) && document.elementFromPoint(x, y)?.id === 'map') return [x, y]; return null; });
  if (empty) { await page.mouse.click(empty[0], empty[1]); await wait(250); }
  const emptyOff = await page.evaluate(() => !NM.map.view.targeting);
  check('选目标可取消：取消钮、再点出征、点空地', barOn && cancelBtn && toggleOff && emptyOff, JSON.stringify({ barOn, cancelBtn, toggleOff, emptyOff }));
  await page.click('#armybar .achip[data-army="a_shi"]'); await wait(300);
  await page.click('#ring-march'); await wait(250);
  await page.evaluate(() => NM.map.focus('xiangyang', 2.2)); await wait(400);
  const foeXY = await armyXY('a_bai');
  if (foeXY) { await page.mouse.click(foeXY[0], foeXY[1]); await wait(400); }
  const icp = await page.evaluate(() => NM.orders.filter(o => o.kind === 'army' && o.army === 'a_shi').map(o => o.order.target + ':' + o.order.kind).join(','));
  check('选目标时点野外敌军即开赴其所在截击', !!foeXY && icp.includes('xiangyang:move'), `${JSON.stringify(foeXY)} ${icp}`);
  await page.keyboard.press('Escape');

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

  // 试玩反馈：攻城时点劝降，敌将说的是鼓舞士气的话 → 应是我方喊话、守将拒降或开城
  {
    const pd = page.evaluate(() => NM_testBattle('siege', 'att'));
    // 攻城方开战前先定方略：写明兵力比、城防与建议
    await page.waitForSelector('#att-assault', { timeout: 8000 }).catch(() => {});
    const plan = await text('#battle .dc-head');
    check('攻城方开战前有“攻城方略”：兵力比、城防与建议，可强攻、交部将或围而不攻', plan.includes('攻城方略') && /比 1/.test(plan) && await visible('#att-blockade') && await visible('#battle-auto'), plan);
    await page.click('#att-assault').catch(() => {});
    await page.waitForSelector('#siege-persuade', { timeout: 8000 }).catch(() => {});
    await wait(2600);
    await page.click('#siege-persuade').catch(() => {});
    await wait(1400);
    const me = await text('#battle .bbark.l span'), foe = await text('#battle .bbark.r span');
    check('劝降：我方喊话，守将答以拒降或开城', /降|开城|孤城|玉石/.test(me) && /降|城|使|拿命|屈|开/.test(foe) && !/再加一鼓|再进一步|不堪一击/.test(foe), `${me} | ${foe}`);
    const who0 = await text('#battle-who');
    await page.click('#siege-auto').catch(() => {});
    await wait(150);
    const who1 = await text('#battle-who');
    check('顶部“谁在指挥”随部将代打而变', !/部将/.test(who0) && /部将/.test(who1), `${who0} → ${who1}`);
    await pd.catch(() => {});
    await wait(400);
  }
  console.log('战斗画面：一开场即交战，只在战场上下令');
  const unitXY = id => page.evaluate(id => { const v = NM_siege.view; const q = v.unitScreen(id); const r = v.cv.getBoundingClientRect(); return [r.left + q[0], r.top + q[1]]; }, id);
  for (const kind of ['field', 'naval']) {
    const K = kind === 'naval' ? '水战' : '野战';
    const done = page.evaluate(k => NM_testBattle(k, 'att'), kind);
    await page.waitForSelector('#form-go', { timeout: 8000 }).catch(() => {});
    const forms = await page.locator('#battle-ui [id^="form-"]').count();
    check(`${K}开战前临阵布阵：可择阵形（看得到敌阵、战法、地物），再擂鼓开战`, forms >= (kind === 'naval' ? 4 : 6) && /临阵布阵/.test(await text('#battle .dc-head')), String(forms));
    if (kind === 'field') { await page.click('#form-fangyuan').catch(() => {}); await wait(150); check('换阵形即生效', await page.evaluate(() => NM_siege.sim.formation[NM_siege.view.o.me]) === 'fangyuan'); }
    await page.click('#form-go').catch(() => {});
    await wait(1400);
    check(`${K}擂鼓之后即交战`, (await page.evaluate(() => NM_siege.sim.t)) > 0, String(await page.evaluate(() => NM_siege.sim.t)));
    if (kind === 'field') {
      check('底栏有战法按钮（一战一次）', (await page.locator('#battle-ui [id^="skill-"]').count()) >= 1);
      await page.evaluate(() => { NM_siege.sim.resolve[NM_siege.view.o.me] = 30; });
      await page.waitForSelector('.bmoment', { timeout: 4000 }).catch(() => {});
      check('关键时刻弹出战机，停下请你定夺', await visible('.bmoment') && (await page.locator('.bm-opt').count()) >= 2);
      await page.click('.bm-opt').catch(() => {}); await wait(200);
      check('择定战机后继续', !(await visible('.bmoment')));
    }
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
    check(`${K}战果配小场景`, await visible('.sresult .sr-scene canvas'));
    const t0 = Date.now();
    const res = await done;
    check(`${K}结果亮出数秒后自行收场`, Date.now() - t0 < 6000 && await page.evaluate(() => document.querySelector('#battle').classList.contains('hidden')), String(Date.now() - t0));
    check(`${K}打完，记为亲征`, res.manual === true && res.result.over === true);
  }

  console.log('战报里的史事卡');
  await page.evaluate(() => NM.start(NM_presets.createGame('zheng', 3), false));
  await wait(500);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { const s = NM.s; s.reports.push({ turn: s.turn, cat: '史事', node: 'zhenjiang', text: '【郑成功北伐南京】郑成功率舟师入长江，进围南京。' }); NM.reportTurn = s.turn; NM.showSplash(); });
  await wait(900);
  check('战报里的史事卡配会动的小画（不只是人物头像）', await page.evaluate(async () => {
    const c = document.querySelector('#news canvas'); if (!c) return false;
    const g = c.getContext('2d'); const a = g.getImageData(0, 0, c.width, c.height).data;
    await new Promise(r => setTimeout(r, 500));
    const d = g.getImageData(0, 0, c.width, c.height).data; for (let i = 0; i < a.length; i += 16) if (a[i] !== d[i]) return true; return false;
  }));
  await page.click('#news-skip').catch(() => {}); await wait(500);
  await page.evaluate(() => NM.closePanel?.());
  // “只播要紧”打开时，史事照播
  await page.evaluate(() => { const s = NM.s; NM.newsMode = 'major'; s.reports.push({ turn: s.turn, cat: '史事', node: 'nanjing', text: '【多尔衮致书史可法】摄政王多尔衮致书史可法，劝其归降。' }); NM.reportTurn = s.turn; NM.showSplash(); });
  await wait(800);
  check('“只播要紧”打开时，史事仍在屏幕下方播报', await visible('#news') && await page.evaluate(() => NM.splashGroups().some(g => g.lead.text.includes('多尔衮致书史可法'))));
  await page.click('#news-skip').catch(() => {}); await wait(500);
  await page.evaluate(() => { NM.newsMode = 'all'; NM.closePanel?.(); });
  if (await visible('#report:not(.hidden)')) await page.keyboard.press('Escape');

  console.log('粮台规则');
  await page.evaluate(() => { NM.start(NM_presets.createGame('zheng', 3), false); });
  await wait(500);
  await page.keyboard.press('Escape');
  await page.evaluate(() => NM.selectArmy('a_zhk'));
  await wait(400);
  check('军队面板写明粮台由哪家供饷（镇江水师：弘光供饷）', /镇江\s*弘光供饷/.test(await text('#panel')), (await text('#panel')).slice(0, 80));
  check('郑氏不能把镇江水师的粮台改到弘光的南京', await page.evaluate(() => { NM.orders = NM.orders ?? []; return NM.addOrder({ id: 'sx', kind: 'supply', army: 'a_zhk', node: 'nanjing' }) === false; }));
  await page.evaluate(() => { NM.closePanel?.(); NM.map.focus('quanzhou', 2); });
  await wait(500);
  const dense = await page.evaluate(() => ['quanzhou', 'anping', 'xiamen', 'zhangzhou'].map(id => NM.map.layout.get(id)?.tier ?? 'none'));
  check('闽南四城挤在一起：放大两倍时都画出城郭与城名，不缩成被盖住的小点', dense.every(t => t === 'full' || t === 'small'), dense.join(','));
  {
    const at = await page.evaluate(() => { const m = NM.map, r = m.canvas.getBoundingClientRect(), sl = m.layout.get('quanzhou'); return [r.left + sl.sx, r.top + sl.sy - sl.w * 0.4]; });
    const shapes = async () => { const seen = new Set(); for (let k = 0; k < 14; k++) { await page.mouse.move(at[0] + (k % 2 ? 1 : -1), at[1]); await wait(50); seen.add(await page.evaluate(() => ['quanzhou', 'anping', 'xiamen', 'zhangzhou'].map(i => { const sl = NM.map.layout.get(i); return sl ? Math.round(sl.sx) + ',' + Math.round(sl.sy) : '-'; }).join('|'))); } return seen.size; };
    check('鼠标停在挪位的城郭上轻晃：城郭不来回跳动', await shapes() === 1);
    await page.mouse.click(at[0], at[1]); await wait(400);
    check('点选挪位的城后，城郭仍不跳动', await shapes() === 1 && await page.evaluate(() => NM.map.view.selected) === 'quanzhou');
    await page.evaluate(() => NM.closePanel?.());
  }
  await page.evaluate(() => NM.closePanel?.());

  console.log('拥挤处点选');
  await page.evaluate(() => NM.start(NM_presets.createGame('hongguang', 1), false));
  await wait(500);
  await page.keyboard.press('Escape');
  await page.evaluate(() => NM.map.focus('yangzhou', 1.1));
  await wait(500);
  const crowd = await page.evaluate(() => {
    const m = NM.map, r = m.canvas.getBoundingClientRect();
    let minD = 1e9; for (let i = 0; i < m.stacks.length; i++) for (let j = i + 1; j < m.stacks.length; j++) minD = Math.min(minD, Math.hypot(m.stacks[i].sx - m.stacks[j].sx, m.stacks[i].sy - m.stacks[j].sy));
    const st = m.stacks.find(x => x.armies.length > 1 && x.sx > 300 && x.sx < 1100 && x.sy > 120);
    return { minD, st: st ? { x: r.left + st.sx, y: r.top + st.sy, armies: st.armies } : null };
  });
  check('靠得近的军旗互相让开，不再叠在一起', crowd.minD >= 25, String(crowd.minD));
  if (crowd.st) {
    await page.mouse.move(crowd.st.x, crowd.st.y); await wait(250);
    const slot = await page.evaluate(id => { const m = NM.map, r = m.canvas.getBoundingClientRect(); const h = m.armyHits.find(x => x.id === id && x.r === 13); return h ? [r.left + h.x, r.top + h.y] : null; }, crowd.st.armies[1]);
    check('悬停同处多军的旗：展开成一行，各军各有点选处', !!slot);
    if (slot) { await page.mouse.move(slot[0], slot[1]); await wait(150); await page.mouse.click(slot[0], slot[1]); await wait(300); }
    check('点展开后的第二支军队，选中的正是它', await page.evaluate(() => NM.map.view.selectedArmy) === crowd.st.armies[1]);
  } else check('拥挤处有同处多军可测', false);
  await page.evaluate(() => NM.closePanel?.());

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
  // 一方覆亡：让大西本月失尽城池军队，结算时应有全屏覆亡演出
  await page.evaluate(() => { const s = NM.s; for (const c of Object.values(s.cities)) if (c.controller === 'xi') c.controller = 'mingprov'; for (const a of Object.values(s.armies)) if (a.faction === 'xi') delete s.armies[a.id]; });
  const mz = await nextMonth();
  check('结算后郑氏不再奉弘光号令', await page.evaluate(() => !NM.s.factions.zheng.overlord));
  check('一方覆亡有全屏演出：“西亡”与亡国之由', /西亡/.test(mz.fall) && /亡/.test(mz.fall), mz.fall.slice(0, 80));
  check('天下诸家写明盟友亦是对手、天下只归一家', await page.evaluate(() => NM.unityLine().includes('只归一家') || NM.unityLine().includes('自立')));

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
  check('围城卡写出兵力之比与威慑效果', /兵力约 \d+ 比 1/.test(await text('#siege-awe')) && /劝降 \+\d+%/.test(await text('#siege-awe')), await text('#siege-awe'));
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
  check('结局时刷新，标题页有“继续样稿”（样稿另存，不覆盖正篇续档）', await visible('#btn-continue-sample'));
  await page.click('#btn-continue-sample');
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
