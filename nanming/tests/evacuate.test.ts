/* 撤离（2026-11-27 玩家：别人一直攻我、我一直撤退，最后能带走多少？保留几座要城的撤退战术应能做好）。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { applyOrder, validateOrder, describeOrder } from '../src/core/orders';
import { evacPlan } from '../src/core/evacuate';
import { arriveConvoys } from '../src/core/economy';
import { transitOf } from '../src/core/transit';
import { neighbors } from '../src/data/geography';
import type { GameState } from '../src/core/types';

const game = () => createGame('hongguang', 1);
/** 南京邻近的一座本方城 */
const nearOwn = (s: GameState, node: string) => neighbors(node).map(n => n.to).find(id => s.cities[id]?.controller === s.player)!;

describe('撤离', () => {
  it('未被围：兵九成五、银全数、粮按挑夫所能退往别城，城成空城；到后入城', () => {
    const s = game(); const from = 'yangzhou', to = nearOwn(s, from);
    const c = s.cities[from]; c.garrison = 20000; c.silver = 50000; c.grain = 300000;
    const p = evacPlan(s, s.player, from, to, {});
    expect(p.error).toBeUndefined();
    expect(p.troops).toBe(19000);
    expect(p.silver).toBe(50000);
    expect(p.grain).toBeLessThanOrEqual(60000);
    expect(p.leftGrain).toBeGreaterThan(200000);
    const o = { id: 'ev', kind: 'evacuate' as const, node: from, to };
    expect(validateOrder(s, s.player, o)).toBeNull();
    expect(describeOrder(s, o)).toMatch(/撤离/);
    const g0 = s.cities[to].garrison;
    applyOrder(s, s.player, o);
    expect(c.garrison).toBe(0);
    expect(c.controller).toBe(s.player);
    for (let i = 0; i < 4 && s.convoys!.some(v => v.id === 'ev'); i++) { arriveConvoys(s); s.turn++; }
    expect(s.cities[to].garrison).toBe(g0 + 19000);
  });
  it('百姓随迁：户口迁往目的城；焦土：带不走的尽毁、城防拆毁', () => {
    const s = game(); const from = 'yangzhou', to = nearOwn(s, from);
    const c = s.cities[from]; c.grain = 500000; c.silver = 40000;
    const pop0 = c.pop, wall0 = c.wall;
    applyOrder(s, s.player, { id: 'ev', kind: 'evacuate', node: from, to, people: true, scorch: true });
    expect(c.pop).toBeLessThan(pop0 * 0.7);
    expect(c.grain).toBe(0); expect(c.silver).toBe(0);
    expect(c.wall).toBeLessThan(wall0);
    expect(transitOf(s).find(t => t.id === 'ev')!.detail).toMatch(/百姓/);
  });
  it('被围：只能突围，兵七成、银一半，粮与百姓带不走，围解', () => {
    const s = game(); const from = 'yangzhou', to = nearOwn(s, from);
    const c = s.cities[from]; c.garrison = 10000; c.silver = 20000;
    s.sieges[from] = { node: from, attacker: 'qing', armies: [], startTurn: s.turn, months: 1 };
    const p = evacPlan(s, s.player, from, to, { people: true });
    expect(p.besieged).toBe(true);
    expect(p.troops).toBe(7000); expect(p.silver).toBe(10000); expect(p.grain).toBe(0); expect(p.pop).toBe(0);
    applyOrder(s, s.player, { id: 'ev', kind: 'evacuate', node: from, to });
    expect(s.sieges[from]).toBeUndefined();
  });
  it('目的城先失：兵民钱粮就近转投本方别城，散失三成', () => {
    const s = game(); const from = 'yangzhou', to = nearOwn(s, from);
    s.cities[from].garrison = 10000;
    applyOrder(s, s.player, { id: 'ev', kind: 'evacuate', node: from, to });
    s.cities[to].controller = 'qing'; s.cities[from].controller = 'qing';
    const v = s.convoys!.find(x => x.id === 'ev')!; v.arrive = s.turn;
    const before = Object.values(s.cities).filter(x => x.controller === s.player).reduce((n, x) => n + x.garrison, 0);
    arriveConvoys(s);
    const after = Object.values(s.cities).filter(x => x.controller === s.player).reduce((n, x) => n + x.garrison, 0);
    expect(after - before).toBe(Math.round(9500 * 0.7));
  });
});

describe('电脑弃守', () => {
  it('非要城、敌势两倍半以上、无援：撤往要城，流寇焚仓', async () => {
    const { aiEvacuate, keyCity } = await import('../src/core/ai');
    const s = createGame('hongguang', 1);
    const shunCities = Object.values(s.cities).filter(c => c.controller === 'shun');
    const c = shunCities.find(x => !keyCity(s, x.id) && neighbors(x.id).some(n => s.cities[n.to]?.controller === 'shun'))!;
    c.garrison = 3000; c.wall = 30; c.grain = 100000;
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    for (const x of Object.values(s.armies)) if (x.id !== a.id) delete s.armies[x.id];   // 只留这一支，免得别处先撤
    s.relations[['hongguang', 'shun'].sort().join('|')] = { stance: 'war' };
    a.location = c.id; a.troops = 40000; a.progress = 0; a.path = [];
    aiEvacuate(s);
    expect(c.garrison).toBe(0);
    expect(c.grain).toBe(0);   // 大顺焦土
    expect(s.convoys!.some(v => v.from === c.id)).toBe(true);
    expect(s.reports.some(r => /难守/.test(r.text))).toBe(true);
  });
  it('要城（治所）死守不撤', async () => {
    const { aiEvacuate } = await import('../src/core/ai');
    const s = createGame('hongguang', 1);
    const cap = s.cities[s.factions.shun.capital]; cap.garrison = 3000; cap.wall = 30;
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    a.location = cap.id; a.troops = 60000; a.progress = 0;
    aiEvacuate(s);
    expect(cap.garrison).toBe(3000);
  });
});
