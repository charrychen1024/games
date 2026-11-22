/* 历法：内部用回合序号，界面显示所奉政权的年号与农历月，括号注公元年。
 * 回合 0 = 甲申年五月（1644）。闰月单独算一回合。 */
import type { Polity } from './types';

/** 1644—1662 年的闰月（农历年 → 闰几月）。1645 年闰六月可确证，其余按历表推算，待考据核对。 */
export const LEAP_MONTHS: Record<number, number> = { 1645: 6, 1648: 3, 1650: 11, 1653: 7, 1656: 5, 1659: 3, 1661: 7 };
export const START = { year: 1644, month: 5 };
export const END = { year: 1662, month: 12 };

export interface LunarMonth { year: number; month: number; leap: boolean }

const MONTHS: LunarMonth[] = (() => {
  const out: LunarMonth[] = [];
  for (let y = START.year; y <= END.year; y++) {
    for (let m = 1; m <= 12; m++) {
      if (y === START.year && m < START.month) continue;
      out.push({ year: y, month: m, leap: false });
      if (LEAP_MONTHS[y] === m) out.push({ year: y, month: m, leap: true });
    }
  }
  return out;
})();

export const TOTAL_TURNS = MONTHS.length;

export function lunarOf(turn: number): LunarMonth {
  if (turn < 0 || turn >= MONTHS.length) throw new RangeError('turn out of range: ' + turn);
  return MONTHS[turn];
}

export function turnOf(year: number, month: number, leap = false): number {
  const i = MONTHS.findIndex(m => m.year === year && m.month === month && m.leap === leap);
  if (i < 0) throw new RangeError(`no such month ${year}-${month}${leap ? '闰' : ''}`);
  return i;
}

const STEMS = '甲乙丙丁戊己庚辛壬癸';
const BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
export function ganzhi(year: number): string {
  const n = year - 4;
  return STEMS[((n % 10) + 10) % 10] + BRANCHES[((n % 12) + 12) % 12];
}

const DIGITS = '〇一二三四五六七八九';
export function cnNum(n: number): string {
  if (n <= 10) return n === 10 ? '十' : DIGITS[n];
  if (n < 20) return '十' + DIGITS[n - 10];
  const t = Math.floor(n / 10), u = n % 10;
  return DIGITS[t] + '十' + (u ? DIGITS[u] : '');
}

export function monthName(m: LunarMonth): string {
  const base = m.month === 1 ? '正' : cnNum(m.month);
  return (m.leap ? '闰' : '') + base + '月';
}

/** 某政权在某回合使用的年号纪年，如“崇祯十七年”；无可用年号时用干支。 */
export function eraYear(polity: Polity | undefined, turn: number): string {
  const lm = lunarOf(turn);
  if (polity) {
    const eras = polity.eras.filter(e => e.fromTurn <= turn && lm.year >= e.firstYear);
    const era = eras[eras.length - 1];
    if (era) {
      const n = lm.year - era.firstYear + 1;
      return era.name + (n === 1 ? '元' : cnNum(n)) + '年';
    }
  }
  return ganzhi(lm.year) + '年';
}

/** 完整日期：“崇祯十七年五月（1644）” */
export function dateLabel(polity: Polity | undefined, turn: number): string {
  const lm = lunarOf(turn);
  return `${eraYear(polity, turn)}${monthName(lm)}（${lm.year}）`;
}

/** 不带年号的短日期：“甲申五月” */
export function shortDate(turn: number): string {
  const lm = lunarOf(turn);
  return ganzhi(lm.year) + monthName(lm);
}
