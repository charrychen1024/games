/* 新攻城战（即时模拟）：见 Docs/战斗重做方案-2026-11-24.md */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, type BattleState } from '../src/core/battle';
import { createSiege, stepSiege, aiCommands, runSiege, toBattleResult, armyStrength, SEGMENTS, GATE_SEG, type SiegeSim } from '../src/core/siege';

function side(name: string, troops: number, o: Partial<{ gun: number; cav: number; tong: number; morale: number; surrender: number }> = {}) {
  const gun = o.gun ?? 0.15, cav = o.cav ?? 0.15;
  return makeSide({ faction: name, name, commander: name + '将', commanderName: name + '将', tong: o.tong ?? 60, mou: 55, wai: 50, surrender: o.surrender ?? 20,
    mix: { inf: 1 - gun - cav, cav, gun, navy: 0 }, stratagems: 2, armies: [], garrison: name === '守', troops, morale: o.morale ?? 70 });
}
const siegeB = (att: number, def: number, wall: number, seed = 7, ao = {}, dO = {}): BattleState =>
  createBattle({ id: 's', kind: 'siege', node: 'x', nodeName: '某城', terrain: 'city', weather: 'clear', att: side('攻', att, ao), def: side('守', def, dO), wall, seed });

const run = (b: BattleState, maxT = 3600) => runSiege(b, { maxT });
const watch = (b: BattleState, f: (s: SiegeSim) => void, maxT = 3600) => {
  const sim = createSiege(b);
  let next = 0;
  while (!sim.over && sim.t < maxT) {
    if (sim.t >= next) { for (const sd of ['att', 'def'] as const) aiCommands(sim, sd); next = sim.t + 2; }
    stepSiege(sim, 0.1);
    f(sim);
  }
  return sim;
};

describe('新攻城战：编成与战场', () => {
  it('攻方拆成数营，守方分守各段城墙并留预备；城墙分段、中段有城门', () => {
    const sim = createSiege(siegeB(30000, 9000, 70));
    const att = sim.units.filter(u => u.side === 'att'), def = sim.units.filter(u => u.side === 'def');
    expect(att.length).toBeGreaterThanOrEqual(4);
    expect(att.length).toBeLessThanOrEqual(8);
    expect(att.reduce((n, u) => n + u.troops, 0)).toBe(30000);
    expect(def.reduce((n, u) => n + u.troops, 0)).toBe(9000);
    expect(sim.segs.length).toBe(SEGMENTS);
    expect(GATE_SEG).toBe(Math.floor(SEGMENTS / 2));
    expect(new Set(def.filter(u => u.seg !== undefined).map(u => u.seg)).size).toBe(SEGMENTS);
    expect(sim.segs.every(s => s.hp === 70)).toBe(true);
  });
  it('同一战局、同一组命令，结果完全相同', () => {
    expect(JSON.stringify(run(siegeB(30000, 9000, 70, 3)).over)).toBe(JSON.stringify(run(siegeB(30000, 9000, 70, 3)).over));
    expect(run(siegeB(30000, 9000, 70, 3)).t).toBe(run(siegeB(30000, 9000, 70, 3)).t);
  });
});

describe('新攻城战：过程看得见', () => {
  it('炮击使城墙分段掉城防；破门或破墙之后才有入城、巷战', () => {
    let firstInside = -1, breachAt = -1;
    const sim = watch(siegeB(45000, 6000, 50, 5, { gun: 0.3 }), s => {
      if (breachAt < 0 && (s.gate.hp <= 0 || s.segs.some(g => g.hp <= 0) || s.units.some(u => u.side === 'att' && u.state === 'wall'))) breachAt = s.t;
      if (firstInside < 0 && s.units.some(u => u.side === 'att' && u.state === 'inside')) firstInside = s.t;
    });
    expect(sim.over?.outcome).toBe('breach');
    expect(breachAt).toBeGreaterThanOrEqual(0);
    expect(firstInside).toBeGreaterThanOrEqual(breachAt);
    expect(sim.over!.t - firstInside).toBeGreaterThan(5);   // 巷战有个过程，不是一入城就算破
  });
  it('坚城厚守，攻方兵少：打不下，系统会让攻方鸣金，结果是“未克”而不是攻方溃败于顷刻', () => {
    const sim = run(siegeB(16000, 12000, 95, 2));
    expect(sim.over).toBeTruthy();
    expect(sim.over!.winner).toBe('def');
    expect(['retreat', 'repulsed']).toContain(sim.over!.outcome);
  });
  it('事件里记下破门、登城、入城等节点，供画面与军报使用', () => {
    const sim = run(siegeB(45000, 6000, 40, 9, { gun: 0.3 }));
    const kinds = new Set(sim.events.map(e => e.kind));
    expect(kinds.has('start')).toBe(true);
    expect([...kinds].some(k => k === 'gate' || k === 'breach' || k === 'scale')).toBe(true);
    expect(kinds.has('end')).toBe(true);
  });
});

describe('新攻城战：胜负有预兆、不突然', () => {
  it('军心从“动摇”（30）到崩溃（0）至少经过十秒', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      let shaky: Record<string, number> = {};
      const sim = watch(siegeB(20000, 15000, 80, seed), s => { for (const sd of ['att', 'def'] as const) if (s.resolve[sd] < 30 && shaky[sd] === undefined) shaky[sd] = s.t; });
      if (sim.over && (sim.over.outcome === 'repulsed' || sim.over.outcome === 'collapse')) {
        const loser = sim.over.winner === 'att' ? 'def' : 'att';
        expect(sim.over.t - shaky[loser]).toBeGreaterThanOrEqual(10);
      }
    }
  });
  it('兵多、未受挫、军心高的一方不会被判负', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = createSiege(siegeB(40000, 8000, 60, seed));
      let next = 0;
      while (!sim.over && sim.t < 3600) {
        if (sim.t >= next) { aiCommands(sim, 'att'); aiCommands(sim, 'def'); next = sim.t + 2; }
        const before = { a: armyStrength(sim, 'att'), d: armyStrength(sim, 'def'), r: sim.resolve.att };
        stepSiege(sim, 0.1);
        const ov = sim.over as SiegeSim["over"];
        if (ov && ov.winner === "def") {
          expect(!(before.a > before.d * 2 && before.r > 50)).toBe(true);
        }
      }
    }
  });
  it('没有回合或时间上限：只以城破、献城、击退、鸣金结束', () => {
    for (const seed of [1, 2, 3, 4]) {
      const sim = run(siegeB(30000, 9000, 70, seed));
      expect(['breach', 'surrender', 'repulsed', 'retreat', 'collapse']).toContain(sim.over!.outcome);
    }
  });
});

describe('新攻城战：玩家下令', () => {
  it('全军一令“鸣金”：攻方撤出，结果“未克”', () => {
    const sim = createSiege(siegeB(30000, 9000, 70));
    stepSiege(sim, 1, [{ unit: 'all', side: 'att', order: { t: 'retreat' } }]);
    for (let k = 0; k < 600 && !sim.over; k++) stepSiege(sim, 0.1);
    expect(sim.over?.outcome).toBe('retreat');
    expect(sim.over?.winner).toBe('def');
  });
  it('按营下令：令一营去撞城门，城门耐久会降', () => {
    const sim = createSiege(siegeB(30000, 9000, 70));
    const inf = sim.units.find(u => u.side === 'att' && u.kind === 'inf')!;
    const g0 = sim.gate.hp;
    stepSiege(sim, 0.1, [{ unit: inf.id, side: 'att', order: { t: 'ram' } }]);
    for (let k = 0; k < 900 && !sim.over; k++) stepSiege(sim, 0.1);
    expect(sim.gate.hp).toBeLessThan(g0);
  });
});

describe('新攻城战：写回战役', () => {
  it('结果折回旧的战局格式：伤亡、城防、胜负', () => {
    const b = siegeB(45000, 6000, 50, 5, { gun: 0.3 });
    const sim = run(b);
    const r = toBattleResult(b, sim);
    expect(r.over).toBe(true);
    expect(r.winner).toBe(sim.over!.winner);
    expect(r.outcome).toBe(sim.over!.outcome);
    expect(r.wall).toBeLessThan(50);
    const sum = (x: BattleState['att']) => x.lanes.reduce((n, l) => n + l.troops, 0) + (x.reserve ?? 0);
    expect(sum(r.att)).toBeLessThan(45000);
    expect(sum(r.def)).toBeLessThan(6000);
  });
});
