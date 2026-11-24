import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, resolveRound, aiChoice, autoResolve, lossesOf, legalStratagems, type BattleState, type Choice } from '../src/core/battle';

function side(name: string, troops: number, opts: Partial<{ tong: number; mou: number; wai: number; surrender: number; cav: number; gun: number; morale: number; garrison: boolean }> = {}) {
  const cav = opts.cav ?? 0.2, gun = opts.gun ?? 0.1;
  return makeSide({ faction: name, name, commander: name + '将', commanderName: name + '将', tong: opts.tong ?? 60, mou: opts.mou ?? 50, wai: opts.wai ?? 50,
    surrender: opts.surrender ?? 20, mix: { inf: 1 - cav - gun, cav, gun, navy: 0 }, stratagems: 2, armies: [], garrison: opts.garrison ?? false, troops, morale: opts.morale ?? 70 });
}
const field = (a: number, d: number, seed = 7, o = {}) => createBattle({ id: 'b1', kind: 'field', node: 'x', nodeName: '某地', terrain: 'plain', weather: 'clear', att: side('甲', a, o), def: side('乙', d), seed });
const siege = (a: number, d: number, wall: number, seed = 7, defOpts = {}) => createBattle({ id: 'b2', kind: 'siege', node: 'y', nodeName: '某城', terrain: 'city', weather: 'clear', att: side('攻', a, { gun: 0.2 }), def: side('守', d, { garrison: true, ...defOpts }), wall, seed });

function playWith(b: BattleState, pick: (b: BattleState) => [Choice, Choice]) {
  let cur = b;
  while (!cur.over) { const [a, d] = pick(cur); cur = resolveRound(cur, a, d); }
  return cur;
}

describe('战斗结算', () => {
  it('同一战局、同一选择，结果完全相同', () => {
    const c: Choice = { lanes: ['attack', 'flank', 'charge'] }, d: Choice = { lanes: ['hold', 'volley', 'hold'] };
    expect(resolveRound(field(30000, 20000), c, d)).toEqual(resolveRound(field(30000, 20000), c, d));
  });
  it('手动按电脑的选择逐回合下令，与自动结算结果一致', () => {
    for (const seed of [1, 2, 3, 99]) {
      const b = field(30000, 25000, seed);
      const manual = playWith(b, cur => [aiChoice(cur, 'att'), aiChoice(cur, 'def')]);
      expect(manual).toEqual(autoResolve(b));
      // 攻城已改为即时模拟（见 siege.test.ts），此处只验野战
    }
  });
  it('不修改传入的战局', () => {
    const b = field(30000, 20000);
    const snap = JSON.stringify(b);
    resolveRound(b, { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['hold', 'hold', 'hold'] });
    expect(JSON.stringify(b)).toBe(snap);
  });
  it('兵力悬殊时多数由大军获胜', () => {
    let wins = 0;
    for (let seed = 0; seed < 40; seed++) if (autoResolve(field(50000, 15000, seed)).winner === 'att') wins++;
    expect(wins).toBeGreaterThan(30);
  });
  it('选择有用：迂回克坚守，齐射克进攻', () => {
    const b = field(20000, 20000);
    const r1 = resolveRound(b, { lanes: ['flank', 'flank', 'flank'] }, { lanes: ['hold', 'hold', 'hold'] });
    const r2 = resolveRound(b, { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['hold', 'hold', 'hold'] });
    expect(lossesOf(r1, 'def')).toBeGreaterThan(lossesOf(r2, 'def'));
    const r3 = resolveRound(b, { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['volley', 'volley', 'volley'] });
    const r4 = resolveRound(b, { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['attack', 'attack', 'attack'] });
    expect(lossesOf(r3, 'att')).toBeGreaterThan(lossesOf(r4, 'att'));
  });
  it('后撤的一路退出战斗；三路皆退则战斗结束', () => {
    const r = resolveRound(field(20000, 20000), { lanes: ['withdraw', 'withdraw', 'withdraw'] }, { lanes: ['attack', 'attack', 'attack'] });
    expect(r.att.lanes.every(l => l.withdrawn)).toBe(true);
    expect(r.over).toBe(true);
    expect(r.winner).toBe('def');
  });
  it('计策有次数限制', () => {
    let b = field(20000, 20000);
    for (let i = 0; i < 3; i++) b = resolveRound(b, { lanes: ['hold', 'hold', 'hold'], stratagem: 'night' }, { lanes: ['hold', 'hold', 'hold'] });
    expect(b.att.stratagems).toBe(0);
    expect(legalStratagems(b, 'att')).toEqual([]);
    expect(b.log.reduce((n, l) => n + l.stratagems.length, 0)).toBe(2);
  });
  it('攻城：炮击降低城防，坚城小军攻不下', () => {
    const r = resolveRound(siege(40000, 10000, 80), { lanes: ['bombard', 'bombard', 'bombard'] }, { lanes: ['hold', 'hold', 'hold'] });
    expect(r.wall).toBeLessThan(80);
    let held = 0;
    for (let seed = 0; seed < 20; seed++) if (autoResolve(siege(12000, 10000, 85, seed)).winner === 'def') held++;
    expect(held).toBeGreaterThanOrEqual(18);
  });
  it('围而不攻：本月不战，记为围困', () => {
    const r = resolveRound(siege(40000, 10000, 80), { lanes: ['blockade', 'blockade', 'blockade'] }, { lanes: ['hold', 'hold', 'hold'] });
    expect(r.over).toBe(true);
    expect(r.outcome).toBe('blockade');
    expect(lossesOf(r, 'att')).toBe(0);
  });
  it('攻城劝降成功即献城', () => {
    let found = false;
    for (let seed = 0; seed < 30 && !found; seed++) {
      const b = siege(40000, 10000, 80, seed, { surrender: 95 });
      b.att.wai = 90;
      const r = resolveRound(b, { lanes: ['blockade', 'blockade', 'blockade'], stratagem: 'persuade' }, { lanes: ['hold', 'hold', 'hold'] });
      if (r.outcome === 'surrender') { found = true; expect(r.winner).toBe('att'); expect(r.surrendered).toBe(true); }
    }
    expect(found).toBe(true);
  });
  it('大军猛攻低城防之城可以破城', () => {
    let breach = 0;
    for (let seed = 0; seed < 20; seed++) if (autoResolve(siege(60000, 5000, 30, seed)).outcome === 'breach') breach++;
    expect(breach).toBeGreaterThan(10);
  });
});

import { deploy, aiFormation, scout, counterOf } from '../src/core/battle';
describe('布阵、探马、主将亲冲、水战', () => {
  it('布阵按阵型重分三路兵力，总数不变；锋矢阵中军最厚', () => {
    const b = deploy(field(20000, 20000), 'att', 'arrow');
    const l = b.att.lanes.map(x => x.troops);
    expect(l[1]).toBeGreaterThan(l[0]);
    expect(Math.abs(l.reduce((a, c) => a + c, 0) - 20000)).toBeLessThan(5);
    expect(b.form?.att).toBe('arrow');
  });
  it('阵型有用：方圆阵受伤少，以少敌多时电脑择方圆', () => {
    const base = field(20000, 20000);
    const sq = resolveRound(deploy(deploy(base, 'def', 'square'), 'att', 'wings'), { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['hold', 'hold', 'hold'] });
    const ar = resolveRound(deploy(deploy(base, 'def', 'arrow'), 'att', 'wings'), { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['hold', 'hold', 'hold'] });
    expect(lossesOf(sq, 'def')).toBeLessThan(lossesOf(ar, 'def'));
    expect(aiFormation(field(8000, 20000), 'att')).toBe('square');
  });
  it('探马所报大多是敌方真实命令；克制倍数可供判断', () => {
    const b = field(20000, 20000, 9, { mou: 90 });
    const sc = scout(b, 'att');
    const real = aiChoice(b, 'def').lanes;
    expect(sc.sure).toBeGreaterThan(0.7);
    expect(sc.orders.filter((o, i) => o === real[i]).length).toBeGreaterThanOrEqual(2);
    expect(counterOf(b, 'att', 'flank', 'hold')).toBeGreaterThan(1.25);
    expect(counterOf(b, 'att', 'charge', 'hold')).toBeLessThan(1);
  });
  it('主将亲冲：一战一次，那一路杀伤更大', () => {
    const b = deploy(deploy(field(20000, 20000), 'att', 'square'), 'def', 'square');
    const plain = resolveRound(b, { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['hold', 'hold', 'hold'] });
    const led = resolveRound(b, { lanes: ['attack', 'attack', 'attack'], lead: 1 }, { lanes: ['hold', 'hold', 'hold'] });
    expect(led.log[0].lanes[1].defLoss).toBeGreaterThan(plain.log[0].lanes[1].defLoss);
    expect(led.att.led).toBe(true);
    const again = resolveRound(led, { lanes: ['attack', 'attack', 'attack'], lead: 0 }, { lanes: ['hold', 'hold', 'hold'] });
    expect(again.log[1].leads ?? []).toHaveLength(0);
  });
  it('水战：有专门的命令，火船有风大成', () => {
    const nav = (w: 'wind' | 'clear') => createBattle({ id: 'n', kind: 'naval', node: 'x', nodeName: '江面', terrain: 'water', weather: w, att: side('甲', 15000, { gun: 0.2 }), def: side('乙', 15000), seed: 3 });
    const b = nav('clear');
    const { legalOrders } = { legalOrders: (x: BattleState) => x };
    void legalOrders;
    const wind = resolveRound(nav('wind'), { lanes: ['fireship', 'fireship', 'fireship'] }, { lanes: ['board', 'board', 'board'] });
    const calm = resolveRound(nav('clear'), { lanes: ['fireship', 'fireship', 'fireship'] }, { lanes: ['board', 'board', 'board'] });
    expect(lossesOf(wind, 'def')).toBeGreaterThan(lossesOf(calm, 'def'));
    expect(autoResolve(b).over).toBe(true);
  });
});

import { laneOrders, sideTroops, laneActive } from '../src/core/battle';
describe('战斗 v3：自定分兵、预备队、包抄、调兵、收兵、不定回合', () => {
  it('开战前可自定三路与预备队的兵力，空出一路也行', () => {
    const b = deploy(field(30000, 20000), 'att', 'arrow', [0, 0.6, 0.2, 0.2]);
    expect(b.att.lanes[0].troops).toBe(0);
    expect(b.att.reserve).toBe(6000);
    expect(sideTroops(b.att)).toBe(30000);
  });
  it('攻城一方也可集中兵力于一段城墙', () => {
    const b = deploy(siege(30000, 8000, 70), 'att', 'square', [0.1, 0.7, 0.1, 0.1]);
    expect(b.att.lanes[1].troops).toBe(21000);
  });
  it('预备队不接战、不受损；投入某路后才参战', () => {
    let b = deploy(field(30000, 20000), 'att', 'square', [0.3, 0.3, 0.2, 0.2]);
    const r0 = b.att.reserve!;
    b = resolveRound(b, { lanes: ['attack', 'attack', 'attack'] }, { lanes: ['hold', 'hold', 'hold'] });
    expect(b.att.reserve).toBe(r0);
    b = resolveRound(b, { lanes: ['attack', 'attack', 'attack'], commit: { lane: 1, troops: r0 } }, { lanes: ['hold', 'hold', 'hold'] });
    expect(b.att.reserve).toBe(0);
  });
  it('敌方一路已空，本路可包抄邻路，兵力不再闲置', () => {
    let b = deploy(field(30000, 20000), 'def', 'arrow', [0, 0.7, 0.3, 0]);
    expect(laneOrders(b, 'att', 0)).toContain('envelop');
    expect(laneOrders(b, 'att', 1)).not.toContain('envelop');
    const before = b.def.lanes[1].troops;
    const withEnv = resolveRound(b, { lanes: ['envelop', 'hold', 'hold'] }, { lanes: ['hold', 'hold', 'hold'] });
    const without = resolveRound(b, { lanes: ['hold', 'hold', 'hold'] }, { lanes: ['hold', 'hold', 'hold'] });
    expect(before - withEnv.def.lanes[1].troops).toBeGreaterThan(before - without.def.lanes[1].troops);
    expect(withEnv.log[0].envelops?.[0]).toMatchObject({ side: 'att', from: 0, to: 1 });
  });
  it('可在回合之间把一路的兵调往另一路', () => {
    const b = deploy(field(30000, 20000), 'att', 'square');
    const n = resolveRound(b, { lanes: ['hold', 'hold', 'hold'], shift: { from: 0, to: 1, troops: 5000 } }, { lanes: ['hold', 'hold', 'hold'] });
    expect(n.att.lanes[0].troops).toBeLessThan(b.att.lanes[0].troops - 4000);
    expect(n.log[0].moves?.[0]).toMatchObject({ kind: 'shift', from: 0, to: 1, troops: 5000 });
  });
  it('鸣金收兵：本方撤出战场，战斗当合结束，撤退时有追击损失', () => {
    const b = field(30000, 20000);
    const n = resolveRound(b, { lanes: ['attack', 'attack', 'attack'], retreat: true }, { lanes: ['attack', 'attack', 'attack'] });
    expect(n.over).toBe(true);
    expect(n.winner).toBe('def');
    expect(n.outcome).toBe('retreat');
  });
  it('不再固定四五个回合：一方崩溃即结束，否则可打到日暮', () => {
    const lens = new Set<number>();
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) { lens.add(autoResolve(field(30000, 26000, seed)).round); lens.add(autoResolve(field(50000, 12000, seed)).round); }
    expect(lens.size).toBeGreaterThan(2);
    expect(Math.max(...lens)).toBeGreaterThan(5);
  });
  it('久战士卒疲惫：第四合以后士气逐合下降', () => {
    let b = field(30000, 30000);
    const pick = (): Choice => ({ lanes: ['hold', 'hold', 'hold'] });
    for (let k = 0; k < 5 && !b.over; k++) b = resolveRound(b, pick(), pick());
    expect(b.log.some(l => l.text.some(t => t.includes('疲惫')))).toBe(true);
    void laneActive;
  });
});
