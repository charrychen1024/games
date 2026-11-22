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
      const s = siege(40000, 10000, 70, seed);
      expect(playWith(s, cur => [aiChoice(cur, 'att'), aiChoice(cur, 'def')])).toEqual(autoResolve(s));
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
