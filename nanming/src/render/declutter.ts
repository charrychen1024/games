/* 地图元素防重叠：军旗互相让开、同处多军悬停展开、点选取最近者。纯函数，便于测试。 */
export interface Pt2 { x: number; y: number }

/** 把彼此近于 min 的点推开（迭代松弛）；完全重合时按序号定方向，结果确定 */
export function spreadApart(pts: Pt2[], min: number, iters = 12): Pt2[] {
  const out = pts.map(p => ({ x: p.x, y: p.y }));
  for (let it = 0; it < iters; it++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
      const dx = out[j].x - out[i].x, dy = out[j].y - out[i].y, d = Math.hypot(dx, dy);
      if (d >= min - 0.01) continue;
      // 完全重合：按序号取一个方向（确定，不随机）
      const ang = (j * 2.399) % (Math.PI * 2);
      const ux = d < 0.01 ? Math.cos(ang) : dx / d, uy = d < 0.01 ? Math.sin(ang) : dy / d;
      const push = (min - d) / 2 + 0.05;
      out[i].x -= ux * push; out[i].y -= uy * push; out[j].x += ux * push; out[j].y += uy * push;
      moved = true;
    }
    if (!moved) break;
  }
  return out;
}

/** 同处 n 支军队展开成一行：居中于 (cx, cy) 正上方，间距 gap */
export function fanSlots(n: number, cx: number, cy: number, gap = 28, up = 34): Pt2[] {
  return Array.from({ length: n }, (_, k) => ({ x: cx + (k - (n - 1) / 2) * gap, y: cy - up }));
}

/** 落在半径内的命中区里取离指针最近（按半径归一）的一个 */
export function nearestHit<T extends { x: number; y: number; r: number }>(hits: T[], x: number, y: number): T | null {
  let best: T | null = null, bd = Infinity;
  for (const h of hits) { const d = Math.hypot(x - h.x, y - h.y) / h.r; if (d < 1 && d < bd) { bd = d; best = h; } }
  return best;
}
