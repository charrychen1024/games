/* 钱粮：粮价随地随时而变、粜籴互换、劝捐助饷（见 Docs/钱粮设计-2026-11-24.md） */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { grainPrice, marketCap, tradeQuote, loanAmount } from '../src/core/economy';
import { validateOrder, applyOrder } from '../src/core/orders';
import { runMonthAuto } from '../src/core/turn';

describe('粮价', () => {
  it('秋收粮贱，青黄不接粮贵', () => {
    const s = createGame('hongguang', 3);
    const c = s.cities.suzhou;
    s.turn = 3;   // 甲申九月前后
    const autumn = grainPrice(s, c);
    s.turn = 9;   // 乙酉三四月
    const spring = grainPrice(s, c);
    expect(spring).toBeGreaterThan(autumn);
  });
  it('北方粮贵于江南；被围之城粮价飞涨', () => {
    const s = createGame('hongguang', 3);
    expect(grainPrice(s, s.cities.jinan)).toBeGreaterThan(grainPrice(s, s.cities.suzhou));
    const p0 = grainPrice(s, s.cities.yangzhou);
    s.sieges.yangzhou = { node: 'yangzhou', attacker: 'qing', armies: [], startTurn: 0, months: 1 };
    expect(grainPrice(s, s.cities.yangzhou)).toBeGreaterThan(p0 * 1.6);
  });
  it('粮价在合理范围（每石四钱到四两）', () => {
    const s = createGame('qing', 3);
    for (const c of Object.values(s.cities)) { const p = grainPrice(s, c); expect(p).toBeGreaterThanOrEqual(0.4); expect(p).toBeLessThanOrEqual(4); }
  });
});

describe('粜籴：粮银互换', () => {
  it('籴（买粮）花银得粮，粜（卖粮）出粮得银；量越大价越不利', () => {
    const s = createGame('hongguang', 3);
    const c = s.cities.suzhou;
    const small = tradeQuote(s, c, 1000), big = tradeQuote(s, c, marketCap(s, c));
    expect(big.unit).toBeGreaterThan(small.unit);
    const sell = tradeQuote(s, c, -1000);
    expect(sell.unit).toBeLessThan(small.unit);
    const g0 = c.grain, v0 = c.silver;
    applyOrder(s, 'hongguang', { id: 't1', kind: 'trade', node: 'suzhou', grain: 5000 });
    expect(s.cities.suzhou.grain).toBe(g0 + 5000);
    expect(s.cities.suzhou.silver).toBeLessThan(v0);
    const g1 = s.cities.suzhou.grain, v1 = s.cities.suzhou.silver;
    applyOrder(s, 'hongguang', { id: 't2', kind: 'trade', node: 'suzhou', grain: -3000 });
    expect(s.cities.suzhou.grain).toBe(g1 - 3000);
    expect(s.cities.suzhou.silver).toBeGreaterThan(v1);
  });
  it('市面有限：一月之内买卖总量不超过市面所容；被围之城不能粜籴；银不够买不了', () => {
    const s = createGame('hongguang', 3);
    const cap = marketCap(s, s.cities.suzhou);
    expect(validateOrder(s, 'hongguang', { id: 'x', kind: 'trade', node: 'suzhou', grain: cap + 1000 })).toBeTruthy();
    s.sieges.suzhou = { node: 'suzhou', attacker: 'qing', armies: [], startTurn: 0, months: 1 };
    expect(validateOrder(s, 'hongguang', { id: 'x', kind: 'trade', node: 'suzhou', grain: 1000 })).toBeTruthy();
    delete s.sieges.suzhou;
    s.cities.suzhou.silver = 10;
    expect(validateOrder(s, 'hongguang', { id: 'x', kind: 'trade', node: 'suzhou', grain: 5000 })).toBeTruthy();
    expect(validateOrder(s, 'hongguang', { id: 'x', kind: 'trade', node: 'suzhou', grain: -2000 })).toBeNull();
  });
});

describe('劝捐助饷：钱用完了还有来源', () => {
  it('立得一笔银，民心吏治下降，同城半年内不能再劝', () => {
    const s = createGame('hongguang', 3);
    const c = s.cities.suzhou;
    const amt = loanAmount(s, c);
    expect(amt).toBeGreaterThan(5000);
    const v0 = c.silver, m0 = c.minxin;
    applyOrder(s, 'hongguang', { id: 'l1', kind: 'loan', node: 'suzhou' });
    expect(s.cities.suzhou.silver).toBe(v0 + amt);
    expect(s.cities.suzhou.minxin).toBeLessThan(m0);
    expect(validateOrder(s, 'hongguang', { id: 'l2', kind: 'loan', node: 'suzhou' })).toBeTruthy();
  });
  it('整局推进不出错', () => {
    let s = createGame('hongguang', 3);
    for (let i = 0; i < 6; i++) s = runMonthAuto(s, i === 0 ? [{ id: 'tt', kind: 'trade', node: 'suzhou', grain: -2000 }, { id: 'll', kind: 'loan', node: 'hangzhou' }] : []);
    expect(s.turn).toBe(6);
  });
});
