/* 试玩反馈（2026-11-26）：野战“还没开始就宣布胜利，敌人上来就逃，双方伤亡为零”。
 * 原因：军心极低的营开局即判溃散、一方全溃当场收场；电脑又反复派饿兵去撞坚城。 */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, type BattleState } from '../src/core/battle';
import { createField, stepField, aiField, PURSUIT } from '../src/core/field';
import { createGame } from '../src/data/scenario1644';
import { aiOrders } from '../src/core/ai';

const side = (name: string, troops: number, morale: number) => makeSide({ faction: name, name, commander: '', commanderName: name + '将', tong: 60, mou: 50, wai: 50, surrender: 20,
  mix: { inf: 0.65, cav: 0.2, gun: 0.15, navy: 0 }, stratagems: 1, armies: [], garrison: false, troops, morale });
const run = (b: BattleState) => {
  const sim = createField(b); let next = 0;
  while (!sim.over && sim.t < 1200) { if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; } stepField(sim, 0.1); }
  return sim;
};
const loss = (sim: ReturnType<typeof run>, sd: 'att' | 'def') => sim[sd].start - sim.units.filter(u => u.side === sd).reduce((n, u) => n + Math.max(0, u.troops), 0);

describe('野战不会未战先决', () => {
  it('军心将溃的残军来攻：未见敌不自溃，交手后溃败、被追杀，双方都有折损', () => {
    for (const seed of [1, 2, 3]) {
      const sim = run(createBattle({ id: 'p', kind: 'field', node: 'x', nodeName: '某地', terrain: 'plain', weather: 'clear', att: side('攻', 10000, 11), def: side('守', 60000, 65), seed }));
      expect(sim.over!.winner).toBe('def');
      expect(sim.over!.t).toBeGreaterThan(20);
      expect(loss(sim, 'att')).toBeGreaterThan(10000 * 0.05);
      expect(loss(sim, 'def')).toBeGreaterThan(0);
    }
  });
  it('一方全溃后有追击：不当场收场，追击时限内结束', () => {
    const sim = createField(createBattle({ id: 'p', kind: 'field', node: 'x', nodeName: '某地', terrain: 'plain', weather: 'clear', att: side('攻', 40000, 70), def: side('守', 8000, 40), seed: 5 }));
    let next = 0, routAt = -1;
    while (!sim.over && sim.t < 1200) {
      if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; }
      stepField(sim, 0.1);
      if (routAt < 0 && sim.flags.pursuitdef !== undefined) routAt = sim.t;
    }
    expect(routAt).toBeGreaterThan(0);
    expect(sim.over!.t).toBeGreaterThan(routAt);
    expect(sim.over!.t - routAt).toBeLessThanOrEqual(PURSUIT + 0.2);
    expect(sim.events.some(e => /追杀/.test(e.text))).toBe(true);
  });
});

describe('电脑不派军心将溃之军进攻', () => {
  it('军心低于三十：回本方城休整，不出征、不围城', () => {
    const s = createGame('hongguang', 3);
    for (const a of Object.values(s.armies).filter(x => x.faction === 'qing')) a.morale = 20;
    const orders = aiOrders(s, 'qing').filter(o => o.kind === 'army') as Extract<ReturnType<typeof aiOrders>[number], { kind: 'army' }>[];
    for (const o of orders) {
      if (o.order.kind === 'move') expect(o.order.attack).toBe(false);
      expect(o.order.kind).not.toBe('siege');
    }
  });
});
