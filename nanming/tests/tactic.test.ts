/* 战法与降卒（2026-11-27 玩家：继续做战法和收编降卒）。
 * 战法相克：强攻胜临阵应变，撞上坚守营垒则大败，也易中诱敌；夜袭可破营垒之坚（但营垒有备，成算大减）。
 * 降卒：收编则兵多而士气低；释归则民心升、各城更肯归附。 */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, autoResolve } from '../src/core/battle';
import { nightChance } from '../src/core/field';
import { takeCaptives } from '../src/core/military';
import { persuadeChance, applyOrder } from '../src/core/orders';
import { createGame } from '../src/data/scenario1644';

type T = undefined | 'rush' | 'lure' | 'night';
const side = (n: string, tactic: T, camp = false) => ({ ...makeSide({ faction: n, name: n, commander: n, commanderName: n, tong: 60, mou: 55, wai: 50, surrender: 20, mix: { inf: 0.5, cav: 0.3, gun: 0.2, navy: 0 }, stratagems: 2, armies: [], garrison: false, troops: 20000, morale: 70 }), tactic, camp });
const wins = (ta: T, td: T, camp = false, N = 20) => { let w = 0; for (let seed = 1; seed <= N; seed++) if (autoResolve(createBattle({ id: 'b', kind: 'field', node: 'x', nodeName: 'x', terrain: 'plain', weather: 'clear', att: side('A', ta), def: side('D', td, camp), seed })).winner === 'att') w++; return w; };

describe('战法相克', () => {
  it('强攻胜于临阵应变，撞上坚守营垒则大败，遇诱敌优势大减', () => {
    const base = wins(undefined, undefined, false, 30), rush = wins('rush', undefined, false, 30);
    expect(rush).toBeGreaterThan(base);
    expect(wins('rush', undefined, true, 30)).toBeLessThan(base / 2);
    expect(wins('rush', 'lure', false, 30)).toBeLessThan(rush);
  });
  it('夜袭：攻营胜算高于硬攻；营垒有备、雨天成算降低', () => {
    expect(wins('night', undefined, true)).toBeGreaterThan(wins(undefined, undefined, true));
    const b = (camp: boolean, weather: 'clear' | 'rain') => ({ att: side('A', 'night'), def: side('D', undefined, camp), weather });
    expect(nightChance(b(true, 'clear'))).toBeLessThan(nightChance(b(false, 'clear')));
    expect(nightChance(b(false, 'rain'))).toBeLessThan(nightChance(b(false, 'clear')));
  });
});

describe('降卒', () => {
  it('收编：兵增而士气降', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    a.captives = 'absorb'; a.troops = 10000; a.morale = 70;
    takeCaptives(s, [a], 8000, true, a.location);
    expect(a.troops).toBe(12000);
    expect(a.morale).toBeLessThan(70);
  });
  it('释归：民心升，一年之内劝降更易', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    const foe = Object.values(s.cities).find(c => c.controller === 'shun')!;
    const env = Object.values(s.chars).find(c => c.faction === 'hongguang' && c.status === 'active')!;
    const p0 = persuadeChance(s, 'hongguang', env.id, foe.id).p;
    a.captives = 'release';
    const t0 = a.troops, m0 = s.cities[a.location].minxin;
    takeCaptives(s, [a], 8000, true, a.location);
    expect(a.troops).toBe(t0);
    expect(s.cities[a.location].minxin).toBeGreaterThan(m0);
    const p1 = persuadeChance(s, 'hongguang', env.id, foe.id);
    expect(p1.factors.join()).toMatch(/仁义/);
    expect(p1.p).toBeGreaterThanOrEqual(p0);
  });
  it('常例：野战不收', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    const t0 = a.troops;
    takeCaptives(s, [a], 8000, true, a.location);
    expect(a.troops).toBe(t0);
  });
  it('军略命令可定战法、降卒', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    applyOrder(s, 'hongguang', { id: 'c', kind: 'conduct', army: a.id, tactic: 'night', captives: 'absorb' });
    expect(a.tactic).toBe('night'); expect(a.captives).toBe('absorb');
  });
});
