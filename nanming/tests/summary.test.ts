/* 本月得失（2026-11-27 玩家：结算后要有动画展示本次收获了什么、失去了什么，包括人物、钱粮）。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { runMonthAuto } from '../src/core/turn';
import { monthSummary } from '../src/core/summary';

describe('本月得失', () => {
  it('钱粮兵民前后对照，列主要来由；城池、人物得失', () => {
    const s0 = createGame('hongguang', 1);
    const s1 = runMonthAuto(s0, []);
    const sm = monthSummary(s0, s1);
    expect(sm.silver.before).toBeGreaterThan(0);
    expect(sm.silver.up.concat(sm.silver.down).length).toBeGreaterThan(0);
    expect(sm.grain.up.some(x => x.label === '赋税田粮')).toBe(true);
    expect(sm.silver.down.some(x => x.label === '粮饷开支')).toBe(true);
  });
  it('丢城与得城、人物离去都记下', () => {
    const s0 = createGame('hongguang', 1);
    const s1 = structuredClone(s0);
    s1.cities.yangzhou.controller = 'qing';
    const lost = Object.values(s1.chars).find(c => c.faction === 'hongguang' && c.status === 'active' && c.id !== s1.factions.hongguang.leader)!;
    lost.status = 'dead';
    const sm = monthSummary(s0, s1);
    expect(sm.citiesLost).toContain('扬州');
    expect(sm.peopleOut.join()).toMatch(/殁/);
  });
});
