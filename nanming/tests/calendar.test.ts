import { describe, it, expect } from 'vitest';
import { lunarOf, turnOf, ganzhi, cnNum, dateLabel, shortDate, TOTAL_TURNS, monthName } from '../src/core/calendar';
import type { Polity } from '../src/core/types';

const ming: Polity = { id: 'ming', name: '明', mark: '明', flag: 'tri', eras: [
  { name: '崇祯', firstYear: 1628, fromTurn: 0 },
  { name: '弘光', firstYear: 1645, fromTurn: turnOf(1645, 1) },
] };
const qing: Polity = { id: 'qing', name: '清', mark: '清', flag: 'banner', eras: [{ name: '顺治', firstYear: 1644, fromTurn: 0 }] };

describe('历法', () => {
  it('回合 0 是甲申年五月', () => {
    expect(lunarOf(0)).toEqual({ year: 1644, month: 5, leap: false });
    expect(shortDate(0)).toBe('甲申五月');
  });
  it('干支与数字', () => {
    expect(ganzhi(1644)).toBe('甲申');
    expect(ganzhi(1645)).toBe('乙酉');
    expect(ganzhi(1662)).toBe('壬寅');
    expect(cnNum(17)).toBe('十七');
    expect(cnNum(10)).toBe('十');
    expect(cnNum(21)).toBe('二十一');
  });
  it('十二回合试玩止于乙酉年四月', () => {
    expect(lunarOf(11)).toEqual({ year: 1645, month: 4, leap: false });
  });
  it('1645 年闰六月是单独一回合', () => {
    const t = turnOf(1645, 6, true);
    expect(t).toBe(turnOf(1645, 6) + 1);
    expect(monthName(lunarOf(t))).toBe('闰六月');
  });
  it('按政权显示年号', () => {
    expect(dateLabel(ming, 0)).toBe('崇祯十七年五月（1644）');
    expect(dateLabel(qing, 0)).toBe('顺治元年五月（1644）');
    expect(dateLabel(ming, turnOf(1645, 1))).toBe('弘光元年正月（1645）');
    expect(dateLabel(undefined, 0)).toBe('甲申年五月（1644）');
  });
  it('全期约 220 回合，止于壬寅十二月', () => {
    expect(TOTAL_TURNS).toBeGreaterThan(210);
    expect(TOTAL_TURNS).toBeLessThan(235);
    expect(lunarOf(TOTAL_TURNS - 1)).toMatchObject({ year: 1662, month: 12 });
  });
});
