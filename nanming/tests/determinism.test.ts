/* 战斗演算与显示速度无关：同一战局按 0.1 秒、0.2 秒、0.5 秒推进，结果完全相同。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { createBattle, makeSide } from '../src/core/battle';
import { runField } from '../src/core/field';
import { runSiege } from '../src/core/siege';
import type { BattleState } from '../src/core/battle';

function fieldBattle(seed: number): BattleState {
  const s = createGame('hongguang', 1);
  const side = (f: string, troops: number) => makeSide({ faction: f, name: s.factions[f].name, commander: s.factions[f].leader, commanderName: 'x', tong: 60, mou: 50, wai: 50, surrender: 30, mix: { inf: 0.6, cav: 0.25, gun: 0.15, navy: 0 }, stratagems: 0, armies: [], garrison: false, troops, morale: 65 });
  return createBattle({ id: 'b', kind: 'field', node: 'yangzhou', nodeName: '扬州', terrain: 'plain', weather: 'clear', att: side('qing', 27000), def: side('hongguang', 26000), seed });
}

describe('战斗步长不改变结果', () => {
  for (let seed = 1; seed <= 4; seed++) it(`野战种子 ${seed}：0.1 / 0.2 / 0.5 秒推进同胜同伤`, () => {
    const r = [0.1, 0.2, 0.5].map(dt => { const sim = runField(fieldBattle(seed), { dt }); return { w: sim.over?.winner, o: sim.over?.outcome, t: sim.t, a: Math.round(sim.units.filter(u => u.side === 'att').reduce((n, u) => n + u.troops, 0)) }; });
    expect(r[1]).toEqual(r[0]);
    expect(r[2]).toEqual(r[0]);
  });
  it('攻城：0.1 / 0.2 秒推进同一结果', () => {
    const b = { ...fieldBattle(3), kind: 'siege' as const, terrain: 'city' as const, wall: 70 };
    b.def.garrison = true;
    const r = [0.1, 0.2].map(dt => { const sim = runSiege(b, { dt }); return { w: sim.over?.winner, o: sim.over?.outcome, t: sim.t }; });
    expect(r[1]).toEqual(r[0]);
  });
});
