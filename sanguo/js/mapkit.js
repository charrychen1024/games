/* ============================================================
 * 烽烟录 · 地图工具箱：城墙、营寨、山林、守军、客栈与商铺等通用构件
 * ============================================================ */
'use strict';
(function () {
  const TL = G.TL;
  const K = (G.kit = {});

  K.roadNear = (m, x, y, r) => {
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const t = m.get(x + i, y + j);
      if (t === TL.PATH || t === TL.BRIDGE || t === TL.FLOOR || m.isReserved(x + i, y + j)) return true;
    }
    return false;
  };
  K.mountain = (m, x, y, near = 2) => {
    for (let j = 0; j < 2; j++) for (let i = 0; i < 3; i++) {
      const t = m.get(x + i, y + j);
      if (!(t === TL.GRASS || t === TL.TALL || t === TL.SOIL) || m.isReserved(x + i, y + j) || m.propAt(x + i, y + j) || m.objs.some(o => o.x === x + i && o.y === y + j)) return false;
    }
    if (K.roadNear(m, x + 1, y + 1, near)) return false;
    m.prop('mountain', x, y, 3, 2, { v: Math.floor(G.hash(x, y, 9) * 4), foot: [x, y, 3, 2] });
    return true;
  };
  // 山林：边缘密林 + 噪声成片
  K.forest = (m, o = {}) => {
    const seed = o.seed || 99, thr = o.thr ?? 0.6, kinds = o.kinds || ['pine', 'tree', 'dark'], avoid = o.avoid ?? 2;
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
      const edge = o.edge !== false && (x <= 1 || y <= 1 || x >= m.w - 2 || y >= m.h - 2);
      if ((edge && G.hash(x, y, seed) < 0.85) || G.fbm(x / 6, y / 6, seed) > thr) {
        if (K.roadNear(m, x, y, edge ? 0 : avoid)) continue;
        m.tree(x, y, kinds[Math.floor(G.hash(x, y, seed + 3) * kinds.length)]);
      } else if (o.sprinkle !== false && G.hash(x, y, seed + 5) < 0.015 && !K.roadNear(m, x, y, 1)) m.tree(x, y, G.hash(x, y, seed + 6) < 0.5 ? 'rock' : 'bush');
    }
  };
  K.tallGrass = (m, seed = 55, thr = 0.56) => {
    for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) if (m.get(x, y) === TL.GRASS && G.fbm(x / 5, y / 5, seed) > thr) m.set(x, y, TL.TALL);
  };
  // 城墙：上下两层墙、左右单列；gates: [{side:'n'|'s', x, plaque}]，门洞 3 格宽
  K.walls = (m, x0, y0, x1, y1, gates = []) => {
    m.rect(x0, y0, x1 - x0 + 1, 2, TL.WALL); m.rect(x0, y1 - 1, x1 - x0 + 1, 2, TL.WALL);
    m.rect(x0, y0, 1, y1 - y0 + 1, TL.WALL); m.rect(x1, y0, 1, y1 - y0 + 1, TL.WALL);
    for (const g of gates) {
      const gy = g.side === 'n' ? y0 : y1 - 1;
      m.rect(g.x, gy, 3, 2, TL.PATH);
      m.prop('gate', g.x - 1, gy, 5, 2, { nofoot: true, plaque: g.plaque || '', sortBias: 1 });
    }
  };
  K.stakeRing = (m, x0, y0, x1, y1, gaps = []) => {
    const gap = (x, y) => gaps.some(([gx, gy, gw, gh]) => x >= gx && x < gx + gw && y >= gy && y < gy + gh);
    for (let x = x0; x <= x1; x++) { if (!gap(x, y0)) m.tree(x, y0, 'stake'); if (!gap(x, y1)) m.tree(x, y1, 'stake'); }
    for (let y = y0 + 1; y < y1; y++) { if (!gap(x0, y)) m.tree(x0, y, 'stake'); if (!gap(x1, y)) m.tree(x1, y, 'stake'); }
  };
  K.tent = (m, x, y, o = {}) => {
    const w = o.w || 3, h = o.h || 3;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const t = m.get(x + i, y + j); if (t === TL.PATH || t === TL.WATER || t === TL.WALL || m.isReserved(x + i, y + j) || m.propAt(x + i, y + j) || m.objs.some(q => q.x === x + i && q.y === y + j)) return null; }
    return m.prop(o.big ? 'bigtent' : 'tent', x, y, w, h, Object.assign({ foot: [x, y + (o.big ? 2 : 1), w, h - (o.big ? 2 : 1)] }, o));
  };
  K.deco = (m, type, x, y, o = {}) => {
    if (m.get(x, y) === TL.PATH || m.get(x, y) === TL.WATER || m.propAt(x, y) || m.objs.some(q => q.x === x && q.y === y) || m.isReserved(x, y)) return null;
    return m.prop(type, x, y, o.w || 1, o.h || 1, Object.assign({ foot: [x, y, o.w || 1, o.h || 1] }, o));
  };
  K.treesAt = (m, list, kind = 'tree') => { for (const [x, y] of list) m.tree(x, y, kind); };

  // 对话 / 剧情
  K.talk = lines => async () => { await G.lines(lines); };
  K.innTalk = (who, price) => async () => {
    await G.say(who, `客官里边请！住一晚 ${price} 金，兵力、策略全数恢复。`, { name: '店家' });
    const k = await G.choose([`住店（${price} 金）`, '不必了']);
    if (k !== 0) return;
    if (G.state.gold < price) { await G.say(who, '这……客官的盘缠似乎不太够啊。', { name: '店家' }); return; }
    G.state.gold -= price;
    await G.fadeOut(0.7); G.restoreAll(); G.audio.sfx('heal'); await G.wait(1.0); await G.fadeIn(0.7);
    await G.say(who, '客官歇得可好？', { name: '店家' });
    const s = await G.choose(['记录进度', '不用了']);
    if (s === 0) await G.saveMenu();
  };
  K.shopTalk = (who, list, title, greet, name) => async () => {
    await G.say(who, greet || '客官要些什么？', { name: name || title });
    await G.shop(list, title);
  };
  // 主动截击的敌兵：靠近一格即开战，胜后旗标置位而消失
  K.guard = (m, o) => m.npc({
    id: o.id, spec: o.spec, x: o.x, y: o.y, dir: o.dir || 'down', aggro: o.aggro !== false, fixedDir: o.fixedDir,
    cond: () => !G.flag(o.flag) && (!o.cond || o.cond()), marker: o.marker,
    talk: async () => {
      if (o.before) await o.before();
      if (o.lines) await G.lines(o.lines);
      const r = await G.battle(o.group, { bg: o.bg || m.battleBg, boss: o.boss, intro: o.intro, party: o.party });
      if (r === 'win') { G.setFlag(o.flag); if (o.after) await o.after(); }
    },
  });
  // 城镇里常见的一圈树
  K.innerTrees = (m, x0, y0, x1, y1, seed = 5, p = 0.55) => {
    for (let x = x0; x <= x1; x++) for (const y of [y0, y1]) if (G.hash(x, y, seed) < p) m.tree(x, y, G.hash(x, y, seed + 1) < 0.3 ? 'dark' : 'tree');
    for (let y = y0 + 1; y < y1; y++) for (const x of [x0, x1]) if (G.hash(x, y, seed + 2) < p) m.tree(x, y, G.hash(x, y, seed + 3) < 0.3 ? 'dark' : 'tree');
  };
})();
