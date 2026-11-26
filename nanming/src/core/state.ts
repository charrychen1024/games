/* 局势读写工具：关系判定、因果账、月报、人物态度。所有修改都经过这里留痕。 */
import type { Army, CauseSrc, City, FactionId, GameState, LedgerField, ReportEntry, Stance, Attitudes } from './types';
import { NODE } from '../data/geography';

export const relKey = (a: string, b: string) => (a < b ? a + '|' + b : b + '|' + a);

/** 顶层势力（沿“奉谁号令”上溯） */
export function topOf(s: GameState, f: FactionId): FactionId {
  let cur = f;
  for (let i = 0; i < 5; i++) {
    const o = s.factions[cur]?.overlord;
    if (!o) return cur;
    cur = o;
  }
  return cur;
}

export function stance(s: GameState, a: FactionId, b: FactionId): Stance | 'self' {
  if (a === b) return 'self';
  const explicit = s.relations[relKey(a, b)];
  if (explicit) return explicit.stance;
  const fa = s.factions[a], fb = s.factions[b];
  if (fa?.overlord === b) return 'vassal';
  if (fb?.overlord === a) return 'overlord';
  const ta = topOf(s, a), tb = topOf(s, b);
  if (ta === tb) return 'alliance';
  if (ta !== a || tb !== b) return stance(s, ta, tb);
  return 'neutral';
}

export const hostile = (s: GameState, a: FactionId, b: FactionId) => stance(s, a, b) === 'war';
/** 同一阵营：自己、上下级、同奉一主、盟友 */
export function friendly(s: GameState, a: FactionId, b: FactionId): boolean {
  const st = stance(s, a, b);
  return st === 'self' || st === 'alliance' || st === 'overlord' || st === 'vassal';
}

export function setStance(s: GameState, a: FactionId, b: FactionId, st: Stance, until?: number) {
  s.relations[relKey(a, b)] = until === undefined ? { stance: st } : { stance: st, until };
}

export function newId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

const INDEX_FIELDS: LedgerField[] = ['minxin', 'wall', 'order', 'agri', 'commerce', 'edu'];

/** 改动城池数值并记入因果账。返回实际变动量。 */
export function bump(s: GameState, node: string, field: LedgerField, delta: number, text: string, src: CauseSrc): number {
  const c = s.cities[node];
  if (!c || !delta) return 0;
  const before = c[field] as number;
  let after = before + delta;
  if (INDEX_FIELDS.includes(field)) after = Math.max(0, Math.min(100, after));
  else after = Math.max(0, after);
  if (field === 'pop') after = Math.round(after * 100) / 100;
  else if (INDEX_FIELDS.includes(field)) after = Math.round(after * 10) / 10;
  else after = Math.round(after);
  const real = Math.round((after - before) * 100) / 100;
  (c as any)[field] = after;
  if (real !== 0) s.ledger.push({ turn: s.turn, node, field, delta: real, text, src: { ...src, turn: src.turn ?? s.turn } });
  return real;
}

export function report(s: GameState, e: Omit<ReportEntry, 'turn'>) {
  s.reports.push({ turn: s.turn, ...e });
}

export function adjustAtt(s: GameState, charId: string, field: keyof Attitudes, delta: number, reason: string, src?: string) {
  const c = s.chars[charId];
  if (!c || !delta) return;
  const lo = field === 'hawk' ? -100 : 0;
  const before = c.att[field];
  c.att[field] = Math.max(lo, Math.min(100, before + delta));
  const real = c.att[field] - before;
  if (real) c.attLog.push({ turn: s.turn, field, delta: real, reason, src });
}

export function adjustLoyalty(s: GameState, faction: string, delta: number, reason: string) {
  const f = s.factions[faction];
  if (!f || f.loyalty === undefined) return;
  f.loyalty = Math.max(0, Math.min(100, f.loyalty + delta));
  if (f.leader) adjustAtt(s, f.leader, 'loyalty', delta, reason);
}

export const citiesOf = (s: GameState, f: FactionId): City[] => Object.values(s.cities).filter(c => c.controller === f);
/** “某方某将”：势力名已含将名（张献忠部 · 张献忠）只写一次；单字势力名（清）补“军”字 */
export function sideAndCommander(s: GameState, f: FactionId, char: string): string {
  const fn = factionName(s, f), cn = charName(s, char);
  if (!cn || fn.includes(cn)) return fn;
  return `${fn}${fn.length === 1 ? '军' : ''}${cn}`;
}
/** 本方府库所在：治所仍在本方手里才算，治所已失则为空（不得动用敌城府库） */
export const treasuryOf = (s: GameState, f: FactionId): string => { const id = s.factions[f]?.capital; return id && s.cities[id]?.controller === f ? id : ''; };
export const armiesOf = (s: GameState, f: FactionId): Army[] => Object.values(s.armies).filter(a => a.faction === f);
export const armiesAt = (s: GameState, node: string): Army[] => Object.values(s.armies).filter(a => a.location === node && a.progress === 0);

export function nodeName(id: string): string { return NODE[id]?.name ?? id; }
export function charName(s: GameState, id: string | undefined): string { return id ? s.chars[id]?.name ?? id : '无'; }
export function factionName(s: GameState, id: string): string { return s.factions[id]?.name ?? id; }

/** 以“约 X 万”的口吻写兵数 */
export function troopsText(n: number): string {
  if (n >= 10000) return (Math.round(n / 1000) / 10).toString().replace(/\.0$/, '') + ' 万';
  if (n >= 1000) return Math.round(n / 100) * 100 + '';
  return String(Math.round(n));
}

/** 敌情只给近似值 */
export function roughTroops(n: number): string {
  if (n < 1000) return '数百';
  if (n < 5000) return '数千';
  const w = n / 10000;
  if (w < 1) return '近万';
  return '约 ' + (w < 3 ? (Math.round(w * 2) / 2) : Math.round(w)) + ' 万';
}

export function pruneLedger(s: GameState, keep = 24) {
  const min = s.turn - keep;
  if (s.ledger.length && s.ledger[0].turn < min) s.ledger = s.ledger.filter(e => e.turn >= min);
  if (s.reports.length && s.reports[0].turn < min) s.reports = s.reports.filter(e => e.turn >= min);
  for (const c of Object.values(s.chars)) if (c.attLog.length > 40) c.attLog = c.attLog.slice(-40);
}

/** 军队战力（粗估），用于电脑判断 */
export function armyPower(a: Army, s: GameState): number {
  const c = s.chars[a.commander];
  return a.troops * (0.5 + a.morale / 200) * (0.8 + (c?.ab.tong ?? 40) / 250);
}

/** 某势力在节点上的守城力量（驻军 × 城防） */
export function cityDefense(c: City): number {
  return c.garrison * (1 + c.wall / 60);
}
