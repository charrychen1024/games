/* 行军与运粮路线（2026-11-27 玩家指出：路线不管沿途是谁的城、运粮千里当月送到且无损耗、中立之地随便穿行）。
 * 行军：能绕开敌城就绕开，绕不开的到城下即停；中立之城借道；停战一方的城闭门不纳。
 * 运粮：敌城、被围之城、停战之城、敌军驻扎之地都过不去；途中按路的种类与天数折耗；路远一月送不到的在途若干月。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { shortestPath, pathDays, neighbors, routeBetween } from '../src/data/geography';
import { armyRoute, routeNotes, noRouteReason, supplyRoute, LOSS_PER_DAY } from '../src/core/route';
import { supplyBlock, runEconomy, upkeepOf } from '../src/core/economy';
import { applyOrder, validateOrder } from '../src/core/orders';
import { setArmyOrder, moveArmies } from '../src/core/military';
import { arriveConvoys } from '../src/core/economy';
import { setStance } from '../src/core/state';
import type { Army } from '../src/core/types';

const mkArmy = (s: ReturnType<typeof createGame>, id: string, faction: string, location: string, troops = 5000): Army => {
  const tmpl = Object.values(s.armies)[0];
  const a: Army = { ...structuredClone(tmpl), id, faction, location, troops, path: [], progress: 0, order: { kind: 'hold' }, supply: location, commander: tmpl.commander, mix: { inf: 1, cav: 0, gun: 0, navy: 0 } };
  s.armies[id] = a;
  return a;
};

describe('行军路线看沿途局势', () => {
  it('能绕开敌城就绕开：淮安落入敌手，南京往徐州改走滁州、凤阳', () => {
    const s = createGame('hongguang', 1);
    s.cities.huaian.controller = 'local';
    expect(shortestPath('nanjing', 'xuzhou', false)).toContain('huaian');
    const p = armyRoute(s, 'hongguang', 'nanjing', 'xuzhou', false)!;
    expect(p).not.toContain('huaian');
    expect(p[p.length - 1]).toBe('xuzhou');
  });
  it('绕不开的敌城仍可经过，路线说明标出到此即停', () => {
    const s = createGame('hongguang', 1);
    for (const v of ['huaian', 'fengyang', 'sizhou', 'shouzhou', 'guide']) s.cities[v].controller = 'local';
    const p = armyRoute(s, 'hongguang', 'nanjing', 'xuzhou', false)!;
    expect(p).not.toBeNull();
    expect(routeNotes(s, 'hongguang', p).stops.length).toBeGreaterThan(0);
  });
  it('停战一方的城闭门不纳：四面都是停战之城时无路可走，并说明缘故', () => {
    const s = createGame('hongguang', 1);
    setStance(s, 'hongguang', 'qing', 'truce', s.turn + 12);
    const target = 'xuzhou';
    for (const { to } of neighbors(target)) if (s.cities[to]) s.cities[to].controller = 'qing';
    s.cities[target].controller = 'local';
    expect(armyRoute(s, 'hongguang', 'nanjing', target, false)).toBeNull();
    expect(noRouteReason(s, 'hongguang', 'nanjing', target, false)).toMatch(/停战/);
    const a = mkArmy(s, 'a_t', 'hongguang', 'nanjing');
    expect(validateOrder(s, 'hongguang', { id: 'o', kind: 'army', army: a.id, order: { kind: 'move', target, attack: true } })).toMatch(/停战/);
  });
  it('中立之城能绕则绕，绕不开时借道并写进路线说明', () => {
    const s = createGame('hongguang', 1);
    s.cities.huaian.controller = 'qing';          // 弘光与清初为中立
    const p = armyRoute(s, 'hongguang', 'nanjing', 'xuzhou', false)!;
    expect(p).not.toContain('huaian');
    for (const v of ['fengyang', 'sizhou', 'shouzhou', 'guide']) s.cities[v].controller = 'qing';
    const q = armyRoute(s, 'hongguang', 'nanjing', 'xuzhou', false)!;
    expect(routeNotes(s, 'hongguang', q).via.length).toBeGreaterThan(0);
  });
  it('下令行军即按此路线走', () => {
    const s = createGame('hongguang', 1);
    s.cities.huaian.controller = 'local';
    const a = mkArmy(s, 'a_m', 'hongguang', 'nanjing');
    setArmyOrder(s, a, { kind: 'move', target: 'xuzhou', attack: false });
    expect(a.path).not.toContain('huaian');
  });
  it('敌对两军在同一条路上相向而行，路上相遇交战，不会互相穿过', () => {
    const s = createGame('hongguang', 1);
    const r = routeBetween('nanjing', 'taiping')!;
    expect(r).toBeTruthy();
    const a = mkArmy(s, 'a_x', 'hongguang', 'nanjing');
    const b = mkArmy(s, 'a_y', 'shun', 'taiping');
    for (const k of Object.keys(s.armies)) if (k !== a.id && k !== b.id) delete s.armies[k];
    a.path = ['taiping', 'wuhu']; a.order = { kind: 'move', target: 'wuhu', attack: false };
    b.path = ['nanjing', 'zhenjiang']; b.order = { kind: 'move', target: 'zhenjiang', attack: false };
    const contacts = moveArmies(s);
    expect(contacts.length).toBe(1);
    expect(a.location).toBe(b.location);
    expect(a.progress).toBe(0); expect(b.progress).toBe(0);
  });
});

describe('运粮路线与途耗', () => {
  it('敌军驻扎之地截断粮道：南京往杭州绕开常州', () => {
    const s = createGame('hongguang', 1);
    expect(supplyRoute(s, 'hongguang', 'nanjing', 'hangzhou').path).toContain('changzhou');
    mkArmy(s, 'a_e', 'shun', 'changzhou');
    const leg = supplyRoute(s, 'hongguang', 'nanjing', 'hangzhou');
    expect(leg.path).not.toContain('changzhou');
  });
  it('四面被敌军截断时运不过去，并给出断点', () => {
    const s = createGame('hongguang', 1);
    for (const { to } of neighbors('hangzhou')) mkArmy(s, 'a_e' + to, 'shun', to);
    const leg = supplyRoute(s, 'hongguang', 'nanjing', 'hangzhou');
    expect(leg.reason).toMatch(/隔断/);
    expect(leg.at).toBeTruthy();
    expect(supplyBlock(s, 'hongguang', 'nanjing', 'hangzhou')).toMatch(/隔断/);
  });
  it('停战一方的城运粮也过不去', () => {
    const s = createGame('hongguang', 1);
    setStance(s, 'hongguang', 'qing', 'truce', s.turn + 12);
    for (const { to } of neighbors('xuzhou')) if (s.cities[to]) s.cities[to].controller = 'qing';
    s.cities.xuzhou.controller = 'hongguang';
    expect(supplyRoute(s, 'hongguang', 'nanjing', 'xuzhou').reason).toBeTruthy();
  });
  it('途耗按路的种类与天数：陆运最耗，到达比例与路线天数相符', () => {
    expect(LOSS_PER_DAY.land).toBeGreaterThan(LOSS_PER_DAY.river);
    const s = createGame('hongguang', 1);
    const leg = supplyRoute(s, 'hongguang', 'nanjing', 'wuchang');
    expect(leg.days).toBe(pathDays('nanjing', leg.path));
    expect(leg.keep).toBeLessThan(1);
    expect(leg.keep).toBeGreaterThan(0.9);       // 长江水运二十日，耗不到一成
  });
});

describe('调拨钱粮', () => {
  it('近处当月送到，粮扣途耗，银不耗', () => {
    const s = createGame('hongguang', 1);
    const g0 = s.cities.hangzhou.grain, v0 = s.cities.hangzhou.silver;
    const leg = supplyRoute(s, 'hongguang', 'nanjing', 'hangzhou');
    expect(leg.days).toBeLessThanOrEqual(30);
    applyOrder(s, 'hongguang', { id: 't1', kind: 'transfer', from: 'nanjing', to: 'hangzhou', grain: 10000, silver: 5000 });
    expect(s.cities.hangzhou.grain - g0).toBe(Math.round(10000 * leg.keep));
    expect(s.cities.hangzhou.grain - g0).toBeLessThan(10000);
    expect(s.cities.hangzhou.silver - v0).toBe(5000);
  });
  it('路远一月送不到的在途，若干月后送达', () => {
    const s = createGame('hongguang', 1);
    // 找一座路程三十日以上的本方或友方之城
    const far = Object.values(s.cities).find(c => c.controller === 'mingprov' && (() => { const l = supplyRoute(s, 'hongguang', 'nanjing', c.id); return !l.reason && l.days > 30; })())!;
    expect(far).toBeTruthy();
    const leg = supplyRoute(s, 'hongguang', 'nanjing', far.id);
    const g0 = far.grain;
    applyOrder(s, 'hongguang', { id: 't2', kind: 'transfer', from: 'nanjing', to: far.id, grain: 10000, silver: 0 });
    expect(far.grain).toBe(g0);
    expect(s.convoys?.length).toBe(1);
    const months = Math.ceil(leg.days / 30);
    for (let k = 1; k < months; k++) { s.turn++; arriveConvoys(s); }
    expect(far.grain - g0).toBe(Math.round(10000 * leg.keep));
    expect(s.convoys?.length).toBe(0);
  });
  it('在途期间目的地失守：钱粮折回原城', () => {
    const s = createGame('hongguang', 1);
    const far = Object.values(s.cities).find(c => c.controller === 'mingprov' && (() => { const l = supplyRoute(s, 'hongguang', 'nanjing', c.id); return !l.reason && l.days > 30; })())!;
    const n0 = s.cities.nanjing.grain;
    applyOrder(s, 'hongguang', { id: 't3', kind: 'transfer', from: 'nanjing', to: far.id, grain: 10000, silver: 0 });
    far.controller = 'local';
    s.turn += 3; arriveConvoys(s);
    expect(s.cities.nanjing.grain).toBeGreaterThan(n0 - 10000);
    expect(s.convoys?.length).toBe(0);
  });
});

describe('军队离粮台远，转运多耗粮', () => {
  it('同一支军队，粮台千里之外比就在本城多支粮', () => {
    const run = (far: boolean) => {
      const s = createGame('hongguang', 1);
      const a = mkArmy(s, 'a_s', 'hongguang', far ? 'hangzhou' : 'nanjing', 20000);
      for (const k of Object.keys(s.armies)) if (k !== a.id) delete s.armies[k];
      a.supply = 'nanjing';
      const before = s.cities.nanjing.grain;
      const up = upkeepOf(s, s.cities.nanjing).grain;
      runEconomy(s);
      return { spent: s.ledger.filter(e => e.node === 'nanjing' && e.field === 'grain' && e.src.ref === 'a_s').reduce((m, e) => m - e.delta, 0), up, before };
    };
    const near = run(false), far = run(true);
    expect(far.spent).toBeGreaterThan(near.spent);
    expect(far.up).toBeGreaterThan(near.up);       // 城池面板的预估月耗也算上转运
  });
});
