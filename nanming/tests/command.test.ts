/* 主将之能左右胜负（2026-11-27 玩家：只要兵多，全自动就能打赢，主将属性看不出作用）。
 * 统军：营伍战力与临阵镇定（受创时士气掉得慢）；谋略：战法更多更烈，能识破敌计。名将以少胜多不再是空话，庸将兵多也未必稳赢。 */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, autoResolve, type BattleState } from '../src/core/battle';
import { createField, useSkill, skillsFor } from '../src/core/field';

const side = (name: string, troops: number, tong: number, mou: number, garrison = false) => makeSide({ faction: name, name, commander: name, commanderName: name + '将', tong, mou, wai: 50, surrender: 30,
  mix: { inf: 0.65, cav: 0.2, gun: 0.15, navy: 0 }, stratagems: 2, armies: [], garrison, troops, morale: 70 });
const SEEDS = Array.from({ length: 16 }, (_, i) => (i + 1) * 7919);
const field = (at: number, ta: number, ma: number, dt: number, td: number, md: number, seed: number): BattleState =>
  createBattle({ id: 'f', kind: 'field', node: 'x', nodeName: '某地', terrain: 'plain', weather: 'clear', att: side('攻', at, ta, ma), def: side('守', dt, td, md), seed });
const wins = (f: (seed: number) => BattleState) => SEEDS.filter(s => autoResolve(f(s)).winner === 'att').length;

describe('野战：主将之能', () => {
  it('名将以七成半之兵对庸将，胜算可观', () => {
    expect(wins(s => field(22500, 85, 85, 30000, 40, 35, s))).toBeGreaterThanOrEqual(SEEDS.length * 0.3);
  }, 60000);
  it('庸将以一倍半之兵对名将，并非稳操胜券', () => {
    expect(wins(s => field(45000, 40, 35, 30000, 85, 85, s))).toBeLessThan(SEEDS.length);
    expect(wins(s => field(36000, 40, 35, 30000, 85, 85, s))).toBeLessThanOrEqual(SEEDS.length * 0.4);
  }, 60000);
  it('同样兵力，名将胜得比庸将多得多', () => {
    const smart = wins(s => field(30000, 85, 85, 30000, 50, 50, s));
    const dull = wins(s => field(30000, 35, 35, 30000, 50, 50, s));
    expect(smart - dull).toBeGreaterThanOrEqual(SEEDS.length * 0.4);
  }, 60000);
  it('谋略高者战法更多', () => {
    const sim = createField(field(30000, 60, 85, 30000, 60, 40, 1));
    expect(skillsFor(sim, 'att').length).toBeGreaterThan(skillsFor(sim, 'def').length);
  });
  it('谋略远胜者能识破敌计：火攻、疑兵有时落空', () => {
    let seen = 0;
    for (const seed of SEEDS) {
      const sim = createField(field(30000, 60, 30, 30000, 60, 90, seed));
      sim.skills.att = ['feint'];
      sim.t = 40;
      useSkill(sim, 'att', 'feint');
      if (sim.events.some(e => /识破/.test(e.text))) { seen++; expect(sim.buff.def.confused).toBeUndefined(); }
    }
    expect(seen).toBeGreaterThan(0);
    expect(seen).toBeLessThan(SEEDS.length);
  });
});

describe('攻城：主将之能', () => {
  const siege = (at: number, ta: number, ma: number, td: number, md: number, seed: number): BattleState =>
    createBattle({ id: 's', kind: 'siege', node: 'x', nodeName: '某城', terrain: 'city', weather: 'clear', att: side('攻', at, ta, ma), def: side('守', 10000, td, md, true), wall: 60, seed });
  it('名将守城，三倍之兵也常攻不下；名将攻城，两倍半之兵多能破城', () => {
    const hard = wins(s => siege(30000, 40, 35, 85, 85, s));
    const easy = wins(s => siege(30000, 60, 55, 60, 55, s));
    expect(hard).toBeLessThan(easy);
    expect(wins(s => siege(25000, 85, 85, 40, 35, s))).toBeGreaterThan(wins(s => siege(25000, 60, 55, 60, 55, s)));
  }, 120000);
  it('同样兵力，临界之处胜负有悬念（不再一刀切）', () => {
    const w = wins(s => siege(25000, 60, 55, 60, 55, s));
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(SEEDS.length);
  }, 60000);
  it('有胆略的守将见敌撞门，会开门突击', async () => {
    const { runSiege } = await import('../src/core/siege');
    const n = SEEDS.filter(s => runSiege(siege(30000, 60, 55, 70, 70, s)).events.some(e => e.kind === 'sortie')).length;
    expect(n).toBeGreaterThan(0);
  }, 60000);
});
