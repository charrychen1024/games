/* 裁兵（2026-11-27 玩家：饷不够时没有遣散兵士的办法，只能眼看粮饷见底）。
 * 驻军或军队都可裁撤：每人给遣散银半两（军队连同所欠之饷）；遣散得起，散兵归农，人口回升、民心稍安；
 * 府库不够给，散兵无资归乡，流为盗匪，民心、吏治受损。裁后口粮饷银即减。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { applyOrder, validateOrder, describeOrder } from '../src/core/orders';
import { upkeepOf, DISBAND_SILVER } from '../src/core/economy';
import { aiOrders } from '../src/core/ai';

const game = () => createGame('hongguang', 1);

describe('裁撤驻军', () => {
  it('府库给得起遣散银：驻军减、人口回升、民心不降，口粮饷银即减', () => {
    const s = game();
    const c = s.cities.nanjing;
    const g0 = c.garrison, v0 = c.silver, p0 = c.pop, m0 = c.minxin;
    const up0 = upkeepOf(s, c);
    const o = { id: 'd1', kind: 'disband' as const, node: 'nanjing', troops: 5000 };
    expect(validateOrder(s, 'hongguang', o)).toBeNull();
    expect(describeOrder(s, o)).toMatch(/裁/);
    applyOrder(s, 'hongguang', o);
    expect(c.garrison).toBe(g0 - 5000);
    expect(c.silver).toBe(v0 - 5000 * DISBAND_SILVER);
    expect(c.pop).toBeGreaterThan(p0);
    expect(c.minxin).toBeGreaterThanOrEqual(m0);
    const up1 = upkeepOf(s, c);
    expect(up1.grain).toBeLessThan(up0.grain);
    expect(up1.silver).toBeLessThan(up0.silver);
  });
  it('府库空虚：仍可裁，但散兵流为盗匪，民心、吏治下降，并有急报', () => {
    const s = game();
    const c = s.cities.nanjing;
    c.silver = 0;
    const m0 = c.minxin, o0 = c.order;
    applyOrder(s, 'hongguang', { id: 'd2', kind: 'disband', node: 'nanjing', troops: 6000 });
    expect(c.minxin).toBeLessThan(m0);
    expect(c.order).toBeLessThan(o0);
    expect(s.reports.some(r => /盗/.test(r.text))).toBe(true);
  });
  it('城中至少留五百；被围之城不能裁；只能裁自己的城', () => {
    const s = game();
    const c = s.cities.nanjing;
    expect(validateOrder(s, 'hongguang', { id: 'd', kind: 'disband', node: 'nanjing', troops: c.garrison })).toBeTruthy();
    s.sieges.nanjing = { node: 'nanjing', attacker: 'qing', armies: [], startTurn: 0, months: 1 };
    expect(validateOrder(s, 'hongguang', { id: 'd', kind: 'disband', node: 'nanjing', troops: 1000 })).toBeTruthy();
    const other = Object.values(s.cities).find(x => x.controller === 'qing')!;
    expect(validateOrder(s, 'hongguang', { id: 'd', kind: 'disband', node: other.id, troops: 1000 })).toBeTruthy();
  });
});

describe('裁撤军队', () => {
  it('在本方城中可裁一部分；欠饷按人分摊，一并结清', () => {
    const s = game();
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    const c = s.cities[a.location];
    c.controller = 'hongguang';
    a.arrears = 10000; c.silver = 100000;
    const t0 = a.troops, v0 = c.silver;
    applyOrder(s, 'hongguang', { id: 'd3', kind: 'disband', node: a.location, army: a.id, troops: Math.round(t0 / 2) });
    expect(a.troops).toBe(t0 - Math.round(t0 / 2));
    expect(a.arrears).toBeLessThan(10000);
    expect(v0 - c.silver).toBeGreaterThan(Math.round(t0 / 2) * DISBAND_SILVER);
  });
  it('全数裁撤：此军撤销，主将闲下来', () => {
    const s = game();
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    s.cities[a.location].controller = 'hongguang';
    applyOrder(s, 'hongguang', { id: 'd4', kind: 'disband', node: a.location, army: a.id, troops: a.troops });
    expect(s.armies[a.id]).toBeUndefined();
  });
  it('行军途中或不在本方城中不能裁', () => {
    const s = game();
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    a.progress = 3; a.path = ['x'];
    expect(validateOrder(s, 'hongguang', { id: 'd', kind: 'disband', node: a.location, army: a.id, troops: 1000 })).toBeTruthy();
  });
});

describe('电脑也会裁兵', () => {
  it('府库将尽、近处无敌：裁去多余驻军', () => {
    const s = game();
    const f = 'shun';
    const c = Object.values(s.cities).filter(x => x.controller === f).sort((a, b) => b.garrison - a.garrison)[0];
    c.garrison = 40000; c.silver = 2000; c.grain = 5000;
    for (const a of Object.values(s.armies)) if (a.faction !== f) a.location = 'guangzhou';
    const orders = aiOrders(s, f);
    expect(orders.some(o => o.kind === 'disband' && o.node === c.id)).toBe(true);
  });
});
