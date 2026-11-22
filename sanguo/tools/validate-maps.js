/* 烽烟录 · 地图连通性与引用校验：node tools/validate-maps.js */
const { serve } = require('./serve');
const pw = require('/opt/homebrew/lib/node_modules/agent-browser/node_modules/playwright-core');
(async () => {
  const server = await serve(8197);
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:8197/'); await page.waitForTimeout(500);
  const res = await page.evaluate(() => {
    const out = [];
    G.state = G.newState();
    // 所有地图入口：其它地图的 warp 指向它的目标点
    const ids = Object.keys(G.MAP_BUILDERS);
    const maps = {}; for (const id of ids) maps[id] = G.getMap(id);
    const entries = {}; for (const id of ids) for (const w of maps[id].warps) (entries[w.to] = entries[w.to] || []).push([w.tx, w.ty, id]);
    const starts = { taoyuan: [15, 9], c2camp: [15, 20], c3camp: [17, 22], c4camp: [14, 11], c5xiaopei: [16, 11], c5caoying: [15, 18], c6xudu: [13, 25], c7road1: [14, 60], c8gucheng: [16, 30], c9xinye: [17, 9], c10changban: [3, 20], c11chaisang: [20, 28], c12xiakou: [18, 12], c12huarong: [3, 42], c13world: [30, 37], c14nanxu: [22, 30], c15world: [26, 33], c16world: [50, 12], c16bajun: [17, 27], c16luofeng: [11, 34], c17jiameng: [17, 32], c18jiangling: [19, 18], c19world: [30, 38], c20hanshui: [20, 26], c20xiegu: [17, 37], c21fancheng: [22, 32], c21flood: [18, 29], c22retreat: [26, 4], c23yiling: [50, 37], c24lianying: [50, 15], c25nanzhong: [[30, 8], [30, 29]], c26yinkeng: [28, 3], c27qishan: [30, 37], c28jieting: [22, 33], c28xicheng: [17, 20], c29chencang: [22, 30], c30longxi: [50, 38], c31weinan: [28, 34], c32wuzhang: [22, 34], c33taoxi: [50, 38], c34jiange: [17, 33], c34mianzhu: [15, 26], exdream: [19, 28] };
    for (const id of ids) {
      const m = maps[id];
      for (const n of m.npcs) if (!G.SPECS[n.spec]) out.push(`${id}: NPC ${n.id} 缺少造型 ${n.spec}`);
      for (const w of m.warps) if (!maps[w.to]) out.push(`${id}: 传送目标 ${w.to} 不存在`);
      for (const w of m.warps) { const tm = maps[w.to]; if (tm && tm.solid(w.tx, w.ty)) out.push(`${id}→${w.to}: 落点 (${w.tx},${w.ty}) 是障碍`); }
      const src = (entries[id] || []).map(e => [e[0], e[1]]); if (starts[id]) { if (Array.isArray(starts[id][0])) src.push(...starts[id]); else src.push(starts[id]); }
      if (!src.length) { out.push(`${id}: 没有入口`); continue; }
      // BFS（NPC 视为可穿过，以检查布局本身）
      const seen = new Set(), q = [];
      for (const [x, y] of src) { if (m.solid(x, y)) out.push(`${id}: 入口 (${x},${y}) 是障碍`); seen.add(x + ',' + y); q.push([x, y]); }
      while (q.length) { const [x, y] = q.shift(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy, k = nx + ',' + ny; if (seen.has(k) || m.solid(nx, ny)) continue; seen.add(k); q.push([nx, ny]); } }
      const near = (x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen.has((x + dx) + ',' + (y + dy)));
      for (const w of m.warps) { let ok = false; for (let j = w.y; j < w.y + w.h; j++) for (let i = w.x; i < w.x + w.w; i++) if (seen.has(i + ',' + j)) ok = true; if (!ok) out.push(`${id}: 去 ${w.to} 的出口走不到`); }
      for (const n of m.npcs) if (n.talk && !near(n.x0, n.y0)) out.push(`${id}: NPC ${n.id} (${n.x0},${n.y0}) 走不到`);
      for (const e of m.events) if (e.type === 'inspect') { let ok = false; for (let j = e.y - 1; j <= e.y + e.h; j++) for (let i = e.x - 1; i <= e.x + e.w; i++) if (seen.has(i + ',' + j)) ok = true; if (!ok) out.push(`${id}: 调查点 (${e.x},${e.y}) 走不到`); }
    }
    return out;
  });
  console.log(res.length ? res.join('\n') : '全部地图校验通过');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close(); server.close();
  process.exit(res.length || errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
