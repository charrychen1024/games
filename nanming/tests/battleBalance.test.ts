/* 战斗平衡回归（2026-11-26 独立审查）：胜负不再开战即定、地利向着守方、代打不输给零成本套路、小城不比大城难打。 */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, type BattleState } from '../src/core/battle';
import { createField, stepField, aiField, runField, drumF, DUSK, type FieldSim } from '../src/core/field';
import { runSiege, createSiege, persuade } from '../src/core/siege';

function side(name: string, troops: number, garrison = false) {
  return makeSide({ faction: name, name, commander: name + '将', commanderName: name + '将', tong: 60, mou: 55, wai: 50, surrender: 30,
    mix: { inf: 0.65, cav: 0.2, gun: 0.15, navy: 0 }, stratagems: 2, armies: [], garrison, troops, morale: 70 });
}
const fieldB = (att: number, def: number, seed: number, terrain: 'plain' | 'hills' | 'river' = 'plain'): BattleState =>
  createBattle({ id: 'f', kind: 'field', node: 'x', nodeName: '某地', terrain, weather: 'clear', att: side('攻', att), def: side('守', def), seed });
const siegeB = (att: number, def: number, wall: number, seed: number): BattleState =>
  createBattle({ id: 's', kind: 'siege', node: 'x', nodeName: '某城', terrain: 'city', weather: 'clear', att: side('攻', att), def: side('守', def, true), wall, seed });
const SEEDS = Array.from({ length: 16 }, (_, i) => (i + 1) * 7919);
const attWins = (f: (seed: number) => BattleState) => SEEDS.filter(s => runField(f(s)).over?.winner === 'att').length;

describe('野战：胜负有悬念', () => {
  it('多两成兵力：多半能胜，但不是场场必胜', () => {
    const many = Array.from({ length: 48 }, (_, i) => (i + 1) * 7919);
    const w = many.filter(s => runField(fieldB(36000, 30000, s)).over?.winner === 'att').length;
    expect(w).toBeGreaterThanOrEqual(many.length * 0.6);
    expect(w).toBeLessThan(many.length);
  }, 60000);
  it('少一成半兵力：多半要输，但偶有以少胜多', () => {
    const w = attWins(s => fieldB(25500, 30000, s));
    expect(w).toBeLessThanOrEqual(SEEDS.length * 0.4);
  });
  it('地利向着守方：丘陵、隔河，攻方胜得不比平原多', () => {
    for (const ratio of [1, 1.2]) {
      const plain = attWins(s => fieldB(30000 * ratio, 30000, s));
      expect(attWins(s => fieldB(30000 * ratio, 30000, s, 'hills'))).toBeLessThanOrEqual(plain);
      expect(attWins(s => fieldB(30000 * ratio, 30000, s, 'river'))).toBeLessThanOrEqual(plain);
    }
  }, 60000);
});

describe('代打与亲征', () => {
  it('电脑与部将代打接战后也会擂鼓', () => {
    const sim = createField(fieldB(30000, 30000, 7));
    let drummed = false, next = 0;
    while (!sim.over && sim.t < DUSK) {
      if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; }
      stepField(sim, 0.1);
      if (sim.events.some(e => e.kind === 'drum')) { drummed = true; break; }
    }
    expect(drummed).toBe(true);
  });
  it('只多一招“冷却好了就擂鼓”，胜场比代打多不过三成', () => {
    const run = (b: BattleState, cheese: boolean) => {
      const sim: FieldSim = createField(b);
      let next = 0;
      while (!sim.over && sim.t < DUSK + 10) {
        if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; }
        if (cheese) drumF(sim, 'att');
        stepField(sim, 0.1);
      }
      return sim.over?.winner === 'att';
    };
    const auto = SEEDS.filter(s => run(fieldB(30000, 30000, s), false)).length;
    const drum = SEEDS.filter(s => run(fieldB(30000, 30000, s), true)).length;
    expect(drum - auto).toBeLessThanOrEqual(SEEDS.length * 0.3);
  }, 60000);
});

describe('攻城', () => {
  it('同是三比一，小城不比大城难打', () => {
    const took = (d: number) => [1, 2, 3, 4].filter(s => runSiege(siegeB(d * 3, d, 60, s * 7919)).over?.winner === 'att').length;
    expect(took(1000)).toBeGreaterThanOrEqual(took(30000));
    expect(took(1000)).toBeGreaterThanOrEqual(3);
  });
  it('打不下就及早收兵：电脑攻方一场折损不过六成', () => {
    for (const s of [1, 2, 3]) {
      const sim = runSiege(siegeB(15000, 10000, 70, s * 7919));
      const left = sim.units.filter(u => u.side === 'att').reduce((n, u) => n + Math.max(0, u.troops), 0);
      if (sim.over?.winner === 'def') expect(1 - left / sim.att.start).toBeLessThan(0.6);
    }
  });
  it('劝降的骰子与劝的时刻有关：读档换个时候再劝，结果可能不同', () => {
    const outcomes = new Set<boolean | null>();
    for (const t of [5, 30, 60, 120, 200, 300, 420, 500]) {
      const sim = createSiege(siegeB(60000, 10000, 60, 3));
      sim.t = t; sim.resolve.def = 10;
      outcomes.add(persuade(sim));
    }
    expect(outcomes.size).toBe(2);
  });
});
