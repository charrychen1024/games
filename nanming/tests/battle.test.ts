/* 战役层与即时战斗的接口：自动结算、战报措辞、跨月城防、阵前劝降、围城粮道 */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, autoResolve, lossesOf, outcomeText, sideTroops } from '../src/core/battle';
import { createSiege, stepSiege, aiCommands, toBattleResult, persuade, persuadeOdds, runSiege, GATE_SEG, SEGMENTS, autoMomentS } from '../src/core/siege';
import { supplyBlock } from '../src/core/economy';
import { yangzhouSiegeState } from '../src/data/presets';

function side(name: string, troops: number, opts: Partial<{ wai: number; surrender: number; cav: number; gun: number; morale: number; garrison: boolean }> = {}) {
  const cav = opts.cav ?? 0.2, gun = opts.gun ?? 0.1;
  return makeSide({ faction: name, name, commander: name + '将', commanderName: name + '将', tong: 60, mou: 50, wai: opts.wai ?? 50,
    surrender: opts.surrender ?? 20, mix: { inf: 1 - cav - gun, cav, gun, navy: 0 }, stratagems: 2, armies: [], garrison: opts.garrison ?? false, troops, morale: opts.morale ?? 70 });
}
const field = (a: number, d: number, seed = 7) => createBattle({ id: 'b1', kind: 'field', node: 'x', nodeName: '某地', terrain: 'plain', weather: 'clear', att: side('甲', a), def: side('乙', d), seed });
const siege = (a: number, d: number, wall: number, seed = 7, o: { segs?: number[]; gate?: number; att?: object; def?: object } = {}) =>
  createBattle({ id: 'b2', kind: 'siege', node: 'y', nodeName: '某城', terrain: 'city', weather: 'clear', att: side('攻', a, { gun: 0.2, ...o.att }), def: side('守', d, { garrison: true, ...o.def }), wall, segs: o.segs, gate: o.gate, seed });

describe('自动结算', () => {
  it('野战、水战、攻城都由即时模拟快进得出；同一战局结果相同，不改传入的战局', () => {
    for (const b of [field(30000, 20000), siege(40000, 8000, 60), createBattle({ id: 'n', kind: 'naval', node: 'z', nodeName: '某江', terrain: 'water', weather: 'wind', att: side('甲', 20000), def: side('乙', 18000), seed: 3 })]) {
      const snap = JSON.stringify(b);
      const r1 = autoResolve(b), r2 = autoResolve(b);
      expect(JSON.stringify(b)).toBe(snap);
      expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
      expect(r1.over).toBe(true);
      expect(['att', 'def']).toContain(r1.winner);
    }
  });
  it('伤亡守恒：写回的兵数 + 折损 = 开战兵数', () => {
    const b = field(30000, 25000, 4), r = autoResolve(b);
    expect(sideTroops(r.att) + lossesOf(r, 'att')).toBe(30000);
    expect(sideTroops(r.def) + lossesOf(r, 'def')).toBe(25000);
    expect(lossesOf(r, 'att')).toBeGreaterThan(0);
  });
  it('战报措辞：野战日暮写“相持”或“小胜”，攻城收兵写“未克”', () => {
    const r = autoResolve(field(30000, 20000));
    expect(outcomeText(r).length).toBeGreaterThan(4);
    expect(outcomeText({ ...r, outcome: 'held', winner: 'def', verdict: '相持' })).toContain('相持');
    expect(outcomeText({ ...r, outcome: 'held', winner: 'att', verdict: '小胜' })).toContain('小胜');
    expect(outcomeText({ ...siege(1, 1, 50), outcome: 'retreat', winner: 'def' })).toContain('未克');
  });
});

describe('攻城的损坏留到下一战', () => {
  it('打坏的城门、城墙写进结果；下一战从残破处打起', () => {
    const b = siege(30000, 9000, 70, 2);
    const sim = createSiege(b);
    sim.gate.hp = sim.gate.max * 0.1; sim.segs[0].hp = 0;
    const r = toBattleResult(b, sim);
    expect(r.gate).toBeCloseTo(0.1, 1);
    expect(r.segs![0]).toBe(0);
    const next = createSiege(siege(30000, 9000, 70, 3, { segs: r.segs, gate: r.gate }));
    expect(next.gate.hp).toBeLessThan(next.gate.max * 0.2);
    expect(next.segs[0].hp).toBe(0);
    expect(next.segs[GATE_SEG].hp).toBe(70);
    expect(next.segs.length).toBe(SEGMENTS);
  });
  it('战役层：围城未解，城门损坏记在围城上，守军逐月修补', async () => {
    const { buildSiegeBattle, applyBattle, updateSieges } = await import('../src/core/military');
    const s = yangzhouSiegeState(1);
    const b = buildSiegeBattle(s, 'yangzhou')!;
    const sim = createSiege(b);
    sim.gate.hp = 0;
    for (const u of sim.units) if (u.side === 'att') u.order = { t: 'retreat' };
    sim.over = { t: 10, winner: 'def', outcome: 'retreat' };
    applyBattle(s, toBattleResult(b, sim), true);
    expect(s.sieges.yangzhou.gate).toBe(0);
    updateSieges(s);
    expect(s.sieges.yangzhou.gate).toBeCloseTo(0.3, 2);
    const b2 = buildSiegeBattle(s, 'yangzhou')!;
    expect(b2.gate).toBeCloseTo(0.3, 2);
  });
});

describe('阵前劝降', () => {
  it('一战一次；外交高、守将降意大、守军动摇时更易成', () => {
    const easy = createSiege(siege(40000, 6000, 50, 1, { att: { wai: 95 }, def: { surrender: 90 } }));
    const hard = createSiege(siege(20000, 15000, 90, 1, { att: { wai: 30 }, def: { surrender: 5 } }));
    expect(persuadeOdds(easy)).toBeGreaterThan(persuadeOdds(hard) + 0.3);
    const r = persuade(hard);
    expect(persuade(hard)).toBeNull();     // 第二次不能再劝
    if (r) expect(hard.over?.outcome).toBe('surrender');
  });
  it('劝成即献城，结果记为“出降”', () => {
    let ok = 0;
    for (let seed = 1; seed < 30; seed++) {
      const sim = createSiege(siege(40000, 6000, 50, seed, { att: { wai: 95 }, def: { surrender: 95 } }));
      if (persuade(sim)) { ok++; expect(sim.over?.outcome).toBe('surrender'); expect(sim.over?.winner).toBe('att'); }
    }
    expect(ok).toBeGreaterThan(5);
  });
});

describe('围城粮道', () => {
  it('被围的守城一方运不进粮；围城一方的营寨只要后路未断，照常受粮', () => {
    const s = yangzhouSiegeState(1);
    const sg = s.sieges.yangzhou;
    const defender = s.cities.yangzhou.controller;
    expect(supplyBlock(s, defender, 'nanjing', 'yangzhou')).toContain('被围');
    // 围城一方：从后方任一本方城池运往扬州城外
    const own = Object.values(s.cities).filter(c => c.controller === sg.attacker).map(c => c.id);
    const anyOk = own.some(id => supplyBlock(s, sg.attacker, id, 'yangzhou') === null);
    expect(anyOk).toBe(true);
  });
});

describe('部将代打攻城', () => {
  it('集中攻门：兵力悬殊时一战可破，且不会顿兵到粮尽', () => {
    for (const seed of [1, 2, 3]) {
      const sim = runSiege(siege(45000, 9000, 60, seed));
      expect(sim.over!.outcome).toBe('breach');
      expect(sim.t).toBeLessThan(600);
    }
  });
  it('一步一步推进与快进结果相同', () => {
    const b = siege(30000, 9000, 70, 5);
    const sim = createSiege(b); let next = 0;
    // 每拍之后双方部将自择战机（与快进同一规矩）
    while (!sim.over && sim.t < 3600) { if (sim.t >= next) { aiCommands(sim, 'att'); aiCommands(sim, 'def'); next = sim.t + 2; } stepSiege(sim, 0.1); for (const sd of ['att', 'def'] as const) if (!sim.over) autoMomentS(sim, sd); }
    expect(JSON.stringify(toBattleResult(b, sim))).toBe(JSON.stringify(autoResolve(b)));
  });
});
