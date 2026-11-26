/* 地图图层：同一张舆图换三种看法，各自突出最要紧的信息。
 * 势力（默认）：各家疆域与城池；军情：敌我关系着色、前线、各城驻军；钱粮：本方各城粮银能撑几月、各军粮台。 */
import type { GameState } from '../core/types';
import { stance, topOf } from '../core/state';
import { cityForecast } from '../core/economy';

export type LensId = 'faction' | 'war' | 'econ';
export const LENSES: { id: LensId; name: string; icon: string; tip: string }[] = [
  { id: 'faction', name: '势力', icon: 'factions', tip: '各家疆域、城池与军队（L 键切换图层）' },
  { id: 'war', name: '军情', icon: 'war', tip: '按与我方的关系着色：交战为红、同阵营为蓝、停战为黄；红色锯线为前线；各城标出驻军' },
  { id: 'econ', name: '钱粮', icon: 'grain', tip: '本方各城的粮、银按本月收支还能撑几个月：绿为一年以上、黄为半年以上、橙为三月以上、红为不足三月；“盈”为本月有结余；金线连到各军粮台' },
];

export type Tone = 'self' | 'ally' | 'war' | 'truce' | 'neutral';
export const TONE_COLOR: Record<Tone, string> = { self: '#e2b04a', ally: '#3f7fbf', war: '#d0372a', truce: '#c9a33c', neutral: '#7d7466' };
export const TONE_NAME: Record<Tone, string> = { self: '本方', ally: '同阵营', war: '交战', truce: '停战', neutral: '中立' };

/** 某势力与玩家的关系：本方（玩家能下令的城）、同阵营（宗主、下属、同奉一主、盟友）、交战、停战、中立 */
export function relationTone(s: GameState, f: string): Tone {
  const p = s.player;
  if (f === p) return 'self';
  const st = stance(s, p, f);
  if (st === 'alliance' || st === 'overlord' || st === 'vassal' || st === 'self') return 'ally';
  if (topOf(s, p) === topOf(s, f)) return 'ally';
  if (st === 'war') return 'war';
  if (st === 'truce') return 'truce';
  return 'neutral';
}

/** 两城之间是否是前线：一边是本方或同阵营，另一边与我交战 */
export function frontEdge(s: GameState, a: string, b: string): boolean {
  const ca = s.cities[a]?.controller, cb = s.cities[b]?.controller;
  if (!ca || !cb || ca === cb) return false;
  const ta = relationTone(s, ca), tb = relationTone(s, cb);
  const ours = (t: Tone) => t === 'self' || t === 'ally';
  return (ours(ta) && tb === 'war') || (ours(tb) && ta === 'war');
}

export interface Stores { grainNet: number; silverNet: number; grainMonths: number; silverMonths: number; worst: number }
/** 本城粮、银按本月收支还能撑几个月（有结余为无穷） */
export function cityStores(s: GameState, id: string): Stores {
  const c = s.cities[id];
  const fc = cityForecast(s, c);
  const months = (stock: number, net: number) => net >= 0 ? Infinity : Math.max(0, stock) / -net;
  const grainMonths = months(c.grain, fc.grain.net), silverMonths = months(c.silver, fc.silver.net);
  return { grainNet: fc.grain.net, silverNet: fc.silver.net, grainMonths, silverMonths, worst: Math.min(grainMonths, silverMonths) };
}

export type StoreTier = 'ample' | 'ok' | 'low' | 'crit';
export const TIER_COLOR: Record<StoreTier, string> = { ample: '#4f9a3c', ok: '#c9b03a', low: '#e07a2c', crit: '#d0372a' };
export const TIER_NAME: Record<StoreTier, string> = { ample: '一年以上', ok: '半年以上', low: '三月以上', crit: '不足三月' };
export function storeTier(months: number): StoreTier {
  return months >= 12 ? 'ample' : months >= 6 ? 'ok' : months >= 3 ? 'low' : 'crit';
}
/** 月数的短写：有结余写“盈”，一年以上写“年+” */
export function monthsText(m: number): string {
  return m === Infinity ? '盈' : m >= 12 ? '年+' : m < 1 ? '<1月' : `${Math.floor(m)}月`;
}
