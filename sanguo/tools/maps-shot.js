/* 烽烟录 · 全地图构建与截图：node tools/maps-shot.js [地图id...] */
const path = require('path');
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
const SHOTS = path.join(__dirname, '..', 'screenshots');
const MAPS = [
  ['c11chaisang', 20, 16], ['c11sanjiang', 22, 18], ['c11sanjiang', 36, 15], ['c11nanping', 15, 12], ['c11nanping', 12, 33], ['c12xiakou', 18, 14], ['c12chibi', 10, 15], ['c12chibi', 46, 15], ['c12huarong', 12, 32], ['c12huarong', 16, 10], ['c13world', 30, 30], ['c13world', 12, 23], ['c13changsha', 17, 18],
  ['c14nanxu', 20, 15], ['c14nanxu', 33, 26], ['c14road', 12, 15], ['c14road', 42, 10], ['c15world', 26, 30], ['c15leiyang', 16, 12], ['c15fucheng', 17, 13], ['c15jiang', 40, 12], ['c16world', 44, 16], ['c16world', 14, 22], ['c16luofeng', 12, 10], ['c16bajun', 17, 20], ['c17jiameng', 17, 12], ['c17jiameng', 17, 24], ['c17chengdu', 19, 20],
  ['c18jiangling', 19, 14], ['c18lukou', 14, 10], ['c19world', 30, 34], ['c19dingjun', 12, 10], ['c19dingjun', 32, 12], ['c20hanshui', 20, 8], ['c20hanshui', 20, 23], ['c20xiegu', 17, 12], ['c21fancheng', 22, 16], ['c21flood', 18, 22], ['c22retreat', 26, 12], ['c22maicheng', 15, 28], ['c22maicheng', 15, 10],
  ['c23yiling', 40, 20], ['c23yiling', 23, 36], ['c23xiaoting', 22, 15], ['c24lianying', 30, 15], ['c24baidi', 17, 13], ['c25nanzhong', 30, 16], ['c25nanzhong', 30, 30], ['c26yinkeng', 26, 12], ['c26yinkeng', 28, 36], ['c26panshe', 17, 16],
  ['c27qishan', 30, 30], ['c28jieting', 26, 14], ['c28xicheng', 16, 12], ['c29chencang', 22, 14], ['c30longxi', 36, 30], ['c31weinan', 28, 30], ['c32wuzhang', 22, 13], ['c33taoxi', 26, 22], ['c34jiange', 17, 18], ['c34mianzhu', 15, 14],
  ['c2camp', 15, 12], ['c2world', 20, 18], ['c2village', 16, 12], ['c2valley', 15, 20], ['c2valley', 15, 9],
  ['c3camp', 17, 12], ['c3world', 28, 27], ['c3pass', 15, 30], ['c3pass', 15, 9],
  ['c4camp', 14, 12], ['c4world', 30, 26], ['c4beihai', 15, 10], ['c4xuzhou', 20, 13], ['c4caoying', 18, 12],
  ['c5xiaopei', 16, 12], ['c5world', 30, 22], ['c5caoying', 15, 12], ['c5xiapi', 15, 40], ['c5xiapi', 20, 26], ['c5xiapi', 15, 7],
  ['c6xudu', 13, 24], ['c6world', 36, 18], ['c6caoying', 18, 12], ['c7road1', 14, 46], ['c7road1', 14, 31], ['c7road2', 14, 50], ['c7road2', 14, 10],
  ['c8gucheng', 16, 8], ['c8wolong', 15, 9], ['c9xinye', 17, 12], ['c9world', 30, 20], ['c9longzhong', 15, 12], ['c9bowang', 15, 9], ['c10changban', 28, 10], ['c10changban', 52, 20],
];
(async () => {
  const server = await serve(8196);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('http://127.0.0.1:8196/'); await page.waitForTimeout(600);
  const only = process.argv.slice(2);
  for (const [id, x, y] of MAPS) {
    if (only.length && !only.includes(id)) continue;
    const info = await page.evaluate(([id, x, y]) => {
      G.ui.clear(); G.scriptBusy = 0;
      G.state = G.newState(); G.joinParty('jianyong'); G.joinParty('zhaoyun');
      G.world = new G.WorldScene(); G.setScene(G.world); G.fadeA = 0;
      const t0 = performance.now(); G.world.load(id, x, y, 'up'); const dt = performance.now() - t0;
      G.world.banner = null; G.ui.clear(); G.scriptBusy = 0;
      const m = G.world.m;
      return { ms: Math.round(dt), solid: m.solid(x, y), npcs: m.npcs.length, warps: m.warps.length };
    }, [id, x, y]);
    await page.waitForTimeout(400);
    await page.evaluate(() => { G.ui.clear(); G.scriptBusy = 0; });
    await page.waitForTimeout(150);
    const name = `ch-${id}-${x}-${y}`;
    await page.screenshot({ path: path.join(SHOTS, name + '.png') });
    console.log(name, JSON.stringify(info));
  }
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no errors');
  await browser.close(); server.close();
})();
