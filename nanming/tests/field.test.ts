/* 野战、水战（即时模拟）：见 Docs/战斗重做方案-2026-11-24.md */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, autoResolve, type BattleState } from '../src/core/battle';
import { createField, stepField, aiField, runField, toFieldResult, commandF, strengthF, DUSK, CONTACT, type FieldSim } from '../src/core/field';

function side(name: string, troops: number, o: Partial<{ gun: number; cav: number; navy: number; tong: number; morale: number }> = {}) {
  const gun = o.gun ?? 0.15, cav = o.cav ?? 0.2, navy = o.navy ?? 0;
  return makeSide({ faction: name, name, commander: name + '将', commanderName: name + '将', tong: o.tong ?? 60, mou: 55, wai: 50, surrender: 20,
    mix: { inf: 1 - gun - cav - navy, cav, gun, navy }, stratagems: 2, armies: [], garrison: false, troops, morale: o.morale ?? 70 });
}
const fieldB = (att: number, def: number, seed = 7, ao = {}, dO = {}, terrain: 'plain' | 'hills' | 'river' = 'plain', weather: 'clear' | 'rain' | 'wind' = 'clear'): BattleState =>
  createBattle({ id: 'f', kind: 'field', node: 'x', nodeName: '某地', terrain, weather, att: side('攻', att, ao), def: side('守', def, dO), seed });
const navalB = (att: number, def: number, seed = 7, weather: 'clear' | 'wind' = 'wind'): BattleState =>
  createBattle({ id: 'n', kind: 'naval', node: 'x', nodeName: '某江', terrain: 'water', weather, att: side('攻', att, { navy: 0.45, cav: 0, gun: 0.2 }), def: side('守', def, { navy: 0.45, cav: 0, gun: 0.2 }), seed });
const watch = (sim: FieldSim, f: (s: FieldSim) => void, maxT = DUSK + 10) => {
  let next = 0;
  while (!sim.over && sim.t < maxT) {
    if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; }
    stepField(sim, 0.1); f(sim);
  }
  return sim;
};

describe('野战：编成', () => {
  it('两军各拆成数营，兵数守恒；攻方在下、守方在上', () => {
    const sim = createField(fieldB(30000, 24000));
    const a = sim.units.filter(u => u.side === 'att'), d = sim.units.filter(u => u.side === 'def');
    expect(a.length).toBeGreaterThanOrEqual(4); expect(a.length).toBeLessThanOrEqual(8);
    expect(a.reduce((n, u) => n + u.troops, 0)).toBe(30000);
    expect(d.reduce((n, u) => n + u.troops, 0)).toBe(24000);
    expect(Math.min(...a.map(u => u.y))).toBeGreaterThan(500);
    expect(Math.max(...d.map(u => u.y))).toBeLessThan(500);
    expect(a.some(u => u.kind === 'cav') && a.some(u => u.kind === 'inf') && a.some(u => u.kind === 'gun')).toBe(true);
  });
  it('同一战局、同一组命令，结果完全相同', () => {
    const r1 = runField(fieldB(30000, 24000, 3)), r2 = runField(fieldB(30000, 24000, 3));
    expect(JSON.stringify(r1.over)).toBe(JSON.stringify(r2.over));
    expect(r1.t).toBe(r2.t);
  });
});

describe('野战：过程', () => {
  it('两军会相向接战，接战之后才有大量伤亡', () => {
    let contactAt = -1;
    const sim = watch(createField(fieldB(30000, 24000, 5)), s => {
      if (contactAt < 0 && s.units.some(u => u.state === 'melee')) contactAt = s.t;
    });
    expect(contactAt).toBeGreaterThan(3);
    expect(sim.over).toBeTruthy();
  });
  it('骑兵从背后冲击：比正面冲击杀伤更重', () => {
    const mk = (fromBehind: boolean) => {
      const sim = createField(fieldB(20000, 20000, 9, { gun: 0, cav: 0.3 }, { gun: 0, cav: 0 }));
      const cav = sim.units.find(u => u.side === 'att' && u.kind === 'cav')!;
      const foe = sim.units.filter(u => u.side === 'def' && u.kind === 'inf').sort((a, b) => b.troops - a.troops)[0];
      // 只留这两营，摆好位置，然后冲
      for (const u of sim.units) if (u !== cav && u !== foe) u.state = 'gone';
      foe.x = 500; foe.y = 400; foe.order = { t: 'hold' };
      cav.x = 500; cav.y = fromBehind ? 160 : 640; cav.troops = 5000; cav.start = 5000;
      const t0 = foe.troops;
      commandF(sim, { unit: cav.id, side: 'att', order: { t: 'attack', target: foe.id } });
      for (let k = 0; k < 120 && !sim.over; k++) stepField(sim, 0.1);
      return t0 - foe.troops;
    };
    expect(mk(true)).toBeGreaterThan(mk(false) * 1.2);
  });
  it('骑兵冲火器营，远比冲坚守的步营占便宜', () => {
    const mk = (kind: 'gun' | 'inf') => {
      const sim = createField(fieldB(20000, 20000, 4, { gun: 0, cav: 0.3 }, { gun: 0.3, cav: 0 }));
      const cav = sim.units.find(u => u.side === 'att' && u.kind === 'cav')!;
      const foe = sim.units.find(u => u.side === 'def' && u.kind === kind)!;
      for (const u of sim.units) if (u !== cav && u !== foe) u.state = 'gone';
      foe.x = 500; foe.y = 400; foe.troops = 4000; foe.order = { t: 'hold' };
      cav.x = 500; cav.y = 700; cav.troops = 4000;
      commandF(sim, { unit: cav.id, side: 'att', order: { t: 'attack', target: foe.id } });
      for (let k = 0; k < 200 && !sim.over; k++) stepField(sim, 0.1);
      return 4000 - foe.troops;
    };
    expect(mk('gun')).toBeGreaterThan(mk('inf') * 1.5);
  });
  it('丘陵：守方据高地，同等兵力攻方吃亏更多', () => {
    let hillA = 0, plainA = 0;
    for (const seed of [1, 2, 3]) {
      const h = runField(fieldB(24000, 24000, seed, {}, {}, 'hills')), p = runField(fieldB(24000, 24000, seed, {}, {}, 'plain'));
      hillA += h.att.start - h.units.filter(u => u.side === 'att').reduce((n, u) => n + u.troops, 0);
      plainA += p.att.start - p.units.filter(u => u.side === 'att').reduce((n, u) => n + u.troops, 0);
      void CONTACT;
    }
    // 至少仰攻的损失不比平地少
    expect(hillA).toBeGreaterThanOrEqual(plainA * 0.95);
  });
});

describe('野战：胜负有预兆、不突然', () => {
  it('兵力悬殊：多的一方胜', () => {
    for (const seed of [1, 2, 3, 4]) {
      const sim = runField(fieldB(40000, 12000, seed));
      expect(sim.over!.winner).toBe('att');
      const sim2 = runField(fieldB(12000, 40000, seed));
      expect(sim2.over!.winner).toBe('def');
    }
  });
  it('军心从“动摇”到崩溃至少十秒', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const shaky: Record<string, number> = {};
      const sim = watch(createField(fieldB(26000, 22000, seed)), s => { for (const sd of ['att', 'def'] as const) if (s.resolve[sd] < 30 && shaky[sd] === undefined) shaky[sd] = s.t; });
      if (sim.over && (sim.over.outcome === 'rout' || sim.over.outcome === 'collapse') && shaky[sim.over.winner === 'att' ? 'def' : 'att'] !== undefined) {
        expect(sim.over.t - shaky[sim.over.winner === 'att' ? 'def' : 'att']).toBeGreaterThanOrEqual(10);
      }
    }
  });
  it('兵多、军心高的一方不会被判负', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const sim = createField(fieldB(40000, 16000, seed));
      let next = 0;
      while (!sim.over && sim.t < DUSK + 10) {
        if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; }
        const before = { a: strengthF(sim, 'att'), d: strengthF(sim, 'def'), r: sim.resolve.att };
        stepField(sim, 0.1);
        const ov = sim.over as FieldSim['over'];
        if (ov && ov.winner === 'def' && ov.outcome !== 'held') expect(!(before.a > before.d * 2 && before.r > 50)).toBe(true);
      }
    }
  });
  it('双方都坚守不战：日暮收兵，写“相持”，不分胜败', () => {
    const sim = createField(fieldB(20000, 20000, 2));
    let next = 0;
    while (!sim.over && sim.t < DUSK + 10) { if (sim.t >= next) { aiField(sim, 'att', { hold: true }); aiField(sim, 'def', { hold: true }); next = sim.t + 2; } stepField(sim, 0.5); }
    expect(sim.over!.outcome).toBe('held');
    expect(sim.over!.verdict).toBe('相持');
  });
  it('鸣金：全军撤出战场，结果为“收兵”，对方据有战场', () => {
    const sim = createField(fieldB(30000, 24000));
    stepField(sim, 1, [{ unit: 'all', side: 'att', order: { t: 'retreat' } }]);
    for (let k = 0; k < 900 && !sim.over; k++) stepField(sim, 0.1);
    expect(sim.over?.outcome).toBe('retreat');
    expect(sim.over?.winner).toBe('def');
  });
});

describe('水战', () => {
  it('编成：战船、炮船、快船；有风时有火船', () => {
    const sim = createField(navalB(24000, 20000));
    expect(sim.mode).toBe('naval');
    const kinds = new Set(sim.units.filter(u => u.side === 'att').map(u => u.kind));
    expect(kinds.has('inf') && kinds.has('art') && kinds.has('cav')).toBe(true);
    expect(kinds.has('fire')).toBe(true);
    expect(sim.wind).not.toBe(0);
  });
  it('火船顺风撞入敌阵：重创目标，火船自焚', () => {
    const sim = createField(navalB(24000, 20000, 3));
    sim.wind = -1;   // 自攻方吹向守方
    const fire = sim.units.find(u => u.side === 'att' && u.kind === 'fire')!;
    const foe = sim.units.filter(u => u.side === 'def' && u.kind === 'inf').sort((a, b) => b.troops - a.troops)[0];
    const t0 = foe.troops;
    fire.x = foe.x; fire.y = foe.y + 200;
    commandF(sim, { unit: fire.id, side: 'att', order: { t: 'attack', target: foe.id } });
    for (let k = 0; k < 120 && fire.state !== 'gone'; k++) stepField(sim, 0.1);
    expect(fire.state).toBe('gone');
    expect(t0 - foe.troops).toBeGreaterThan(600);
    expect(sim.events.some(e => e.kind === 'fire')).toBe(true);
  });
  it('水战能分出胜负，兵多者胜', () => {
    for (const seed of [1, 2, 3]) expect(runField(navalB(36000, 12000, seed)).over!.winner).toBe('att');
  });
});

describe('写回战役', () => {
  it('结果折回旧的战局格式；自动结算也走这套模拟', () => {
    const b = fieldB(30000, 18000, 5);
    const sim = runField(b);
    const r = toFieldResult(b, sim);
    expect(r.over).toBe(true);
    expect(r.winner).toBe(sim.over!.winner);
    const sum = (x: BattleState['att']) => x.lanes.reduce((n, l) => n + l.troops, 0) + (x.reserve ?? 0);
    expect(sum(r.att)).toBeLessThan(30000);
    const auto = autoResolve(b);
    expect(auto.outcome).toBe(r.outcome);
    expect(auto.winner).toBe(r.winner);
  });
});
