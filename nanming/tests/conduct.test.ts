/* 军略（2026-11-27 玩家：策略要多样，不止城市治理，也要体现在战斗、行军、供给、补充上）。
 * 行军：稳进慢而养士气，急行快而掉队疲惫；粮秣：就粮省粮台而扰民、行慢，抄掠敌城粮饷全取于敌、掳银，
 * 而敌城残破、纵掠之名使各城更不肯降；营垒：驻扎不动时据营而守，伤损减、部将不轻出。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { moveArmies, paceOf } from '../src/core/military';
import { applyOrder, validateOrder, persuadeChance, orderCost } from '../src/core/orders';
import { runEconomy, upkeepOf, armyForage } from '../src/core/economy';
import { createBattle, makeSide, autoResolve, lossesOf } from '../src/core/battle';
import { pathDays } from '../src/data/geography';
import type { GameState, Army } from '../src/core/types';

const game = () => createGame('hongguang', 1);
const anArmy = (s: GameState) => Object.values(s.armies).find(a => a.faction === 'hongguang')!;
function far(s: GameState, a: Army) {
  // 让军队从南京出发去一处远城
  for (const c of Object.values(s.cities)) c.controller = 'hongguang';   // 一路皆本方之城，不为敌城所阻
  a.location = 'nanjing'; a.path = []; a.progress = 0;
  applyOrder(s, 'hongguang', { id: 'm', kind: 'army', army: a.id, order: { kind: 'move', target: 'chengdu', attack: false } });
}

describe('军略命令', () => {
  it('不占政令次数，可复归常例', () => {
    const s = game(); const a = anArmy(s);
    const o = { id: 'c', kind: 'conduct' as const, army: a.id, pace: 'forced' as const };
    expect(orderCost(o)).toBe(0);
    expect(validateOrder(s, 'hongguang', o)).toBeNull();
    applyOrder(s, 'hongguang', o);
    expect(a.pace).toBe('forced');
    applyOrder(s, 'hongguang', { id: 'c2', kind: 'conduct', army: a.id, pace: null });
    expect(a.pace).toBeUndefined();
  });
});

describe('行军', () => {
  it('急行一月走得远，但掉队、士气降；稳进走得近，士气升', () => {
    const run = (pace?: 'steady' | 'forced') => {
      const s = game(); const a = anArmy(s);
      for (const o of Object.values(s.armies)) if (o.id !== a.id) delete s.armies[o.id];
      a.pace = pace; a.morale = 60; a.troops = 10000; far(s, a);
      const d0 = pathDays(a.location, a.path) - a.progress;
      moveArmies(s);
      return { gone: d0 - (a.path.length ? pathDays(a.location, a.path) - a.progress : 0), troops: a.troops, morale: a.morale };
    };
    const n = run(), f = run('forced'), st = run('steady');
    expect(f.gone).toBeGreaterThan(n.gone);
    expect(st.gone).toBeLessThan(n.gone);
    expect(f.troops).toBeLessThan(10000);
    expect(f.morale).toBeLessThan(60);
    expect(st.morale).toBeGreaterThan(60);
    expect(paceOf({ pace: 'forced', forage: 'forage' } as Army)).toBeCloseTo(1.275);
  });
});

describe('粮秣', () => {
  it('就粮：取于地方之比升高，粮台所支减少', () => {
    const s = game(); const a = anArmy(s);
    const sup = s.cities[a.supply];
    const g0 = upkeepOf(s, sup).grain;
    a.forage = 'forage';
    expect(armyForage(s, a)).toBeGreaterThan(0.5);
    expect(upkeepOf(s, sup).grain).toBeLessThan(g0);
  });
  it('抄掠敌城：粮饷全取于敌、掳银，敌城户口民心大坏，纵掠之名使劝降更难', () => {
    const s = game(); const a = anArmy(s);
    const foe = Object.values(s.cities).find(c => c.controller === 'shun')!;
    const env = Object.values(s.chars).find(c => c.faction === 'hongguang' && c.status === 'active')!;
    const p0 = persuadeChance(s, 'hongguang', env.id, foe.id).p;
    a.location = foe.id; a.forage = 'plunder';
    expect(armyForage(s, a)).toBe(1);
    const pop0 = foe.pop, mx0 = foe.minxin, sup0 = s.cities[a.supply].silver;
    runEconomy(s);
    expect(foe.pop).toBeLessThan(pop0);
    expect(foe.minxin).toBeLessThan(mx0 - 5);
    expect(s.reports.some(r => /抄掠/.test(r.text))).toBe(true);
    expect(s.cities[a.supply].silver).toBeGreaterThan(sup0 - 1e9);
    a.location = 'nanjing';
    expect(persuadeChance(s, 'hongguang', env.id, foe.id).factors.join()).toMatch(/纵掠/);
    expect(persuadeChance(s, 'hongguang', env.id, foe.id).p).toBeLessThanOrEqual(p0);
  });
});

describe('营垒', () => {
  it('坚守营垒之军受攻：胜算大增，攻方伤亡远重', () => {
    const side = (n: string, t: number, camp = false) => ({ ...makeSide({ faction: n, name: n, commander: n, commanderName: n, tong: 60, mou: 50, wai: 50, surrender: 20, mix: { inf: 0.7, cav: 0.2, gun: 0.1, navy: 0 }, stratagems: 2, armies: [], garrison: false, troops: t, morale: 70 }), camp });
    const tally = (c: boolean) => { let wins = 0, att = 0, def = 0;
      for (let seed = 1; seed <= 16; seed++) {
        const r = autoResolve(createBattle({ id: 'b', kind: 'field', node: 'x', nodeName: '某地', terrain: 'plain', weather: 'clear', att: side('甲', 25000), def: side('乙', 20000, c), seed }));
        if (r.winner === 'def') wins++; att += lossesOf(r, 'att'); def += lossesOf(r, 'def');
      }
      return { wins, ratio: att / def }; };
    const o = tally(false), c = tally(true);
    expect(c.wins).toBeGreaterThan(o.wins);
    expect(c.ratio).toBeGreaterThan(o.ratio * 1.3);
  }, 60000);
});
