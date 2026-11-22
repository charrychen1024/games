/* 烽烟录 · 开发用截图与冒烟测试：node tools/shot.js */
const path = require('path');
const fs = require('fs');
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
const SHOTS = path.join(__dirname, '..', 'screenshots');
const PORT = 8191;

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serve(PORT);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  await page.goto(`http://127.0.0.1:${PORT}/`);
  await page.waitForTimeout(1500);
  const shot = async name => { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); console.log('shot', name); };
  const ev = (fn, arg) => page.evaluate(fn, arg);
  const only = process.argv[2];

  await shot('01-title');

  // 直接进入各地图
  const goto = async (map, x, y, dir, setup) => {
    await ev(([map, x, y, dir, setup]) => {
      G.ui.clear(); G.scriptBusy = 0;
      if (!G.state) G.state = G.newState();
      if (setup) (new Function(setup))();
      G.world = G.world || new G.WorldScene();
      G.setScene(G.world); G.fadeA = 0;
      G.world.load(map, x, y, dir);
    }, [map, x, y, dir, setup || null]);
    await page.waitForTimeout(700);
  };
  await goto('taoyuan', 15, 10, 'up', "G.state=G.newState(); G.setFlag('oath');");
  await shot('02-taoyuan');
  await goto('town', 19, 14, 'down', "G.joinParty('jianyong');");
  await shot('03-town');
  await goto('town', 19, 24, 'down');
  await shot('03b-town-south');
  await goto('world', 12, 13, 'down');
  await shot('04-world');
  await goto('world', 26, 18, 'right');
  await shot('04b-world-bridge');
  await goto('camp', 17, 25, 'up');
  await shot('05-camp');
  await goto('camp', 18, 14, 'up');
  await shot('05b-camp-boss');

  // 对话
  await ev(() => { G.run(() => G.say('guanyu', '贼将，可识得关某手中这口青龙偃月刀？此番定要取你首级，献于邹校尉帐下！')); });
  await page.waitForTimeout(1600);
  await shot('06-dialog');
  await page.keyboard.press('Enter'); await page.waitForTimeout(300);

  // 战斗
  await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.run(() => G.battle(['ybing', 'ylishi', 'yshushi'], { bg: 'field' })); });
  await page.waitForTimeout(2600);
  await shot('07-battle-field');
  await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  await shot('07b-battle-target');
  // 依次下令：全部攻击
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(200); }
  await page.waitForTimeout(1200);
  await shot('07c-battle-action');
  await page.waitForTimeout(4000);
  await shot('07d-battle-later');

  await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.popScene && G.scenes.length > 1 && G.popScene(); G.run(() => G.battle(['chengyuanzhi', 'ytoumu', 'yshushi'], { bg: 'boss', boss: true })); });
  await page.waitForTimeout(2600);
  await shot('08-battle-boss');
  // 简雍放火
  await ev(() => { });
  await ev(() => { G.ui.clear(); G.scriptBusy = 0; while (G.scenes.length > 1) G.popScene(); G.state.sp = 60; G.run(() => G.battle(['ybing', 'ybing', 'ybing'], { bg: 'camp' })); });
  await page.waitForTimeout(2600);
  // 刘备：攻击；关羽：攻击；张飞：攻击；简雍：策略-烈火
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(150); await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
  await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
  await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  await shot('09-skill-menu');
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(150);
    const b = await ev(() => { const s = G.scenes[G.scenes.length - 1]; return s.banner ? s.banner.text : null; });
    if (b) { await page.waitForTimeout(350); await shot('09b-fire'); break; }
  }
  await page.waitForTimeout(5000);
  await shot('10-after');
  // 状态界面
  await ev(() => { G.ui.clear(); G.scriptBusy = 0; while (G.scenes.length > 1) G.popScene(); G.audio.play(null); G.showStatus(); });
  await page.waitForTimeout(500);
  await shot('11-status');
  await ev(() => { G.ui.clear(); G.run(() => G.pauseMenu()); });
  await page.waitForTimeout(500);
  await shot('12-pause');
  await ev(() => { G.ui.clear(); G.scriptBusy = 0; G.setScene(new G.EndingScene()); });
  await page.waitForTimeout(12500);
  await shot('13-ending');

  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close(); server.close();
})().catch(e => { console.error(e); process.exit(1); });
