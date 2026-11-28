/* 在途事务：发出去、要过些时日才见分晓的事——运送钱粮、使者出使劝降、军队行军、拖延的下属号令。
 * 汇总成一张表，写明从哪到哪、何时发出、约何时到、走了几成、眼下有无变故（目的地被围或已失，到时将折回）。 */
import type { GameState } from './types';
import { nodeName, factionName, charName, friendly, topOf } from './state';
import { describeOrder } from './orders';
import { pathDays } from '../data/geography';
import { paceOf } from './military';
import { shortDate } from './calendar';

export interface TransitItem {
  kind: 'convoy' | 'mission' | 'march' | 'delayed';
  id: string;
  title: string;
  detail: string;
  /** 发出月份（行军无此项） */
  sent?: number;
  /** 约到月份 */
  eta: number;
  /** 已走几成 0—1（不详为 null） */
  progress: number | null;
  /** 变故 */
  warn?: string;
  node?: string;
}

export function transitOf(s: GameState, f = s.player): TransitItem[] {
  const out: TransitItem[] = [];
  for (const v of s.convoys ?? []) {
    if (topOf(s, v.faction) !== topOf(s, f)) continue;
    const total = v.arrive - v.sent + 1, done = s.turn - v.sent;
    const to = s.cities[v.to];
    const lost = !to || !friendly(s, v.faction, to.controller);
    const besieged = !!s.sieges[v.to] && !friendly(s, v.faction, s.sieges[v.to].attacker);
    const what = [v.troops ? `兵 ${v.troops} 人` : '', v.grain ? `粮 ${v.grain} 石` : '', v.silver ? `银 ${v.silver} 两` : '', v.pop ? `百姓 ${v.pop} 万口` : ''].filter(Boolean).join('、');
    out.push({ kind: 'convoy', id: v.id, title: `${nodeName(v.from)} → ${nodeName(v.to)}`, detail: `${what} · 路程 ${v.days} 日`, sent: v.sent, eta: v.arrive,
      progress: Math.max(0, Math.min(1, done / total)), node: v.to,
      warn: lost ? `${nodeName(v.to)}已失，到时折回${nodeName(v.from)}` : besieged ? `${nodeName(v.to)}被围，若到时未解围将折回` : undefined });
  }
  for (const m of s.missions) {
    if (m.faction !== f) continue;
    const o = m.order as { kind: string; char?: string; node?: string; target?: string };
    const total = Math.max(1, m.arriveTurn - m.issuedTurn), done = s.turn - m.issuedTurn;
    const env = o.char ? s.chars[o.char] : undefined;
    const gone = !env || env.status !== 'active';
    const dest = o.kind === 'persuade' ? o.node! : s.factions[o.target ?? '']?.capital;
    out.push({ kind: 'mission', id: m.id, title: describeOrder(s, m.order), detail: o.kind === 'persuade' ? `劝降${nodeName(o.node!)}守将` : `赴${factionName(s, o.target ?? '')}`, sent: m.issuedTurn, eta: m.arriveTurn,
      progress: Math.max(0, Math.min(1, done / total)), node: dest, warn: gone ? `${charName(s, o.char)}已不能成行，此事将作罢` : undefined });
  }
  for (const a of Object.values(s.armies)) {
    if (a.faction !== f || !a.path.length) continue;
    const left = Math.max(1, Math.ceil((pathDays(a.location, a.path) - a.progress) / paceOf(a)));
    const dest = a.path[a.path.length - 1];
    out.push({ kind: 'march', id: a.id, title: `${a.name} → ${nodeName(dest)}`, detail: `现在${nodeName(a.location)}${a.progress > 0 ? `往${nodeName(a.path[0])}途中` : ''} · 余 ${left} 日${a.pace === 'forced' ? ' · 急行' : a.pace === 'steady' ? ' · 稳进' : ''}`,
      eta: s.turn + Math.ceil(left / 30) - 1, progress: null, node: dest });
  }
  for (const o of s.delayed ?? []) out.push({ kind: 'delayed', id: o.id, title: describeOrder(s, o), detail: '下属拖延，下月方行', sent: s.turn - 1, eta: s.turn, progress: 0.5 });
  return out.sort((x, y) => x.eta - y.eta);
}

/** 约到的说法：本月结算时 / 某年某月 */
export const etaText = (s: GameState, eta: number) => eta <= s.turn ? '本月结算时到' : `约 ${shortDate(eta)} 到`;
