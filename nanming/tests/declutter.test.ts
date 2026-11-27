/* 地图上靠得很近的军旗与城池：互相让开、悬停展开、点选取最近者（2026-11-26 玩家反馈） */
import { describe, it, expect } from 'vitest';
import { spreadApart, fanSlots, nearestHit } from '../src/render/declutter';

describe('军旗互相让开', () => {
  it('重叠的旗推开到不小于最小间距，且离原位不远', () => {
    const pts = [{ x: 100, y: 100 }, { x: 104, y: 101 }, { x: 98, y: 96 }, { x: 300, y: 300 }];
    const out = spreadApart(pts, 26);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y)).toBeGreaterThanOrEqual(25.5);
    expect(out[3]).toEqual({ x: 300, y: 300 });                       // 远处的不动
    for (let i = 0; i < 3; i++) expect(Math.hypot(out[i].x - pts[i].x, out[i].y - pts[i].y)).toBeLessThan(40);
  });
  it('完全重合的也分得开（结果确定，不靠随机）', () => {
    const a = spreadApart([{ x: 50, y: 50 }, { x: 50, y: 50 }], 26), b = spreadApart([{ x: 50, y: 50 }, { x: 50, y: 50 }], 26);
    expect(Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y)).toBeGreaterThanOrEqual(25.5);
    expect(a).toEqual(b);
  });
});

describe('同处多军悬停展开', () => {
  it('n 支军队排成一行，彼此不重叠，居中于原旗之上', () => {
    const s = fanSlots(4, 200, 200);
    expect(s).toHaveLength(4);
    for (let i = 1; i < 4; i++) expect(s[i].x - s[i - 1].x).toBeGreaterThanOrEqual(26);
    expect((s[0].x + s[3].x) / 2).toBeCloseTo(200);
    expect(s.every(p => p.y < 200)).toBe(true);
  });
});

describe('点选取最近者', () => {
  it('两枚重叠的圆，点哪边就选哪个', () => {
    const hits = [{ id: 'a', x: 100, y: 100, r: 14 }, { id: 'b', x: 112, y: 100, r: 14 }];
    expect(nearestHit(hits, 97, 100)?.id).toBe('a');
    expect(nearestHit(hits, 115, 100)?.id).toBe('b');
    expect(nearestHit(hits, 200, 100)).toBeNull();
  });
});

import { calloutOffsets } from '../src/render/declutter';
describe('挤不下的城池挪到旁边空处', () => {
  it('候选位置由近及远、八方都有，不含原位', () => {
    const o = calloutOffsets(40);
    expect(o.length).toBeGreaterThanOrEqual(16);
    expect(o.every(p => Math.hypot(p.x, p.y) > 30)).toBe(true);
    for (let i = 1; i < o.length; i++) expect(Math.hypot(o[i].x, o[i].y / 0.8)).toBeGreaterThanOrEqual(Math.hypot(o[i - 1].x, o[i - 1].y / 0.8) - 0.01);
    expect(new Set(o.map(p => `${Math.sign(Math.round(p.x))},${Math.sign(Math.round(p.y))}`)).size).toBe(8);
  });
});
