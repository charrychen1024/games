/* 撤离：弃一城而保全兵、银、粮、民，退往本方另一城（2026-11-27 玩家：敌人一直攻我、我一直撤退，最后能带走多少？
 * 保留几座要城的撤退战术合乎情理，应能做好）。
 * 未被围：守军九成五、府库全数、仓粮按挑夫所能（每兵三石，百姓随迁每万口再加一百石）随军而走，沿粮道在途若干月；
 *         百姓随迁则三成户口一同迁往，到后落籍（目的城民心 −3，安置不易）。
 * 被围：只能突围——守军七成、府库一半，粮与百姓都带不走。
 * 焦土：带不走的仓粮府库付之一炬、城防拆毁三成，敌得空城；本城民心 −20、户口 −5%。
 * 撤后城中无兵，仍归本方，敌至即入（弃城）。 */
import type { GameState } from './types';
import { bump, report, nodeName, troopsText } from './state';
import { supplyRoute } from './route';

export interface EvacPlan {
  error?: string;
  besieged: boolean;
  days: number; months: number; path: string[];
  troops: number; silver: number; grain: number; pop: number;
  /** 留给敌人的 */
  leftGrain: number; leftSilver: number;
  /** 焦土所毁 */
  burnt: { grain: number; silver: number; wall: number } | null;
}

export function evacPlan(s: GameState, f: string, node: string, to: string, opts: { people?: boolean; scorch?: boolean }): EvacPlan {
  const c = s.cities[node], d = s.cities[to];
  const blank: EvacPlan = { besieged: false, days: 0, months: 0, path: [], troops: 0, silver: 0, grain: 0, pop: 0, leftGrain: 0, leftSilver: 0, burnt: null };
  if (!c || c.controller !== f) return { ...blank, error: '只能撤离自己的城' };
  if (!d || d.controller !== f || to === node) return { ...blank, error: '须撤往本方另一座城' };
  const besieged = !!s.sieges[node];
  // 突围：本城之围不算阻断，看出城之后的路
  const view = besieged ? { ...s, sieges: Object.fromEntries(Object.entries(s.sieges).filter(([k]) => k !== node)) } : s;
  const leg = supplyRoute(view as GameState, f, node, to);
  if (leg.reason) return { ...blank, besieged, error: leg.reason };
  const troops = Math.round(c.garrison * (besieged ? 0.7 : 0.95));
  const silver = Math.round(Math.max(0, c.silver) * (besieged ? 0.5 : 1));
  const pop = !besieged && opts.people ? Math.round(c.pop * 0.3 * 100) / 100 : 0;
  const grain = besieged ? 0 : Math.round(Math.min(c.grain, c.garrison * 3 + pop * 100) / 100) * 100;
  const leftGrain = Math.max(0, Math.round(c.grain - grain)), leftSilver = Math.max(0, Math.round(c.silver - silver));
  const burnt = opts.scorch ? { grain: leftGrain, silver: leftSilver, wall: Math.round(c.wall * 0.3) } : null;
  return { besieged, days: leg.days, months: Math.max(1, Math.ceil(leg.days / 30)), path: leg.path, troops, silver, grain: Math.round(grain * leg.keep), pop,
    leftGrain: burnt ? 0 : leftGrain, leftSilver: burnt ? 0 : leftSilver, burnt };
}

export function applyEvacuate(s: GameState, f: string, o: { id: string; node: string; to: string; people?: boolean; scorch?: boolean }) {
  const p = evacPlan(s, f, o.node, o.to, o);
  const isPlayer = f === s.player;
  const src = { kind: 'order' as const, ref: o.id, turn: s.turn };
  if (p.error) { if (isPlayer) report(s, { cat: '内政', node: o.node, text: `撤离${nodeName(o.node)}未成：${p.error}。`, src }); return; }
  const c = s.cities[o.node];
  const g0 = c.garrison, grainOut = Math.min(c.grain, Math.round(Math.min(c.grain, c.garrison * 3 + p.pop * 100) / 100) * 100);
  bump(s, o.node, 'garrison', -g0, p.besieged ? '突围而出' : '撤离', src);
  if (p.silver) bump(s, o.node, 'silver', -p.silver, '撤离时运走', src);
  if (!p.besieged && grainOut) bump(s, o.node, 'grain', -grainOut, '撤离时运走', src);
  if (p.pop) bump(s, o.node, 'pop', -p.pop, '百姓随军迁徙', src);
  if (p.burnt) {
    if (c.grain > 0) bump(s, o.node, 'grain', -c.grain, '焦土：焚仓', src);
    if (c.silver > 0) bump(s, o.node, 'silver', -c.silver, '焦土：散库', src);
    bump(s, o.node, 'wall', -p.burnt.wall, '焦土：拆城', src);
    bump(s, o.node, 'minxin', -20, '焦土，百姓流离', src);
    bump(s, o.node, 'pop', -Math.round(c.pop * 0.05 * 100) / 100, '焦土，百姓流离', src);
  }
  if (p.besieged) delete s.sieges[o.node];
  // 主官随军而走
  if (c.governor && s.chars[c.governor]?.faction === f) { s.chars[c.governor].location = o.to; delete c.governor; }
  (s.convoys ??= []).push({ id: o.id, faction: f, from: o.node, to: o.to, grain: p.grain, silver: p.silver, troops: p.troops, pop: p.pop, sent: s.turn, arrive: s.turn + p.months - 1, days: p.days, path: p.path });
  if (isPlayer) {
    const what = [p.troops ? `兵 ${troopsText(p.troops)}` : '', p.silver ? `银 ${troopsText(p.silver)} 两` : '', p.grain ? `粮 ${troopsText(p.grain)} 石` : '', p.pop ? `百姓约 ${p.pop} 万口` : ''].filter(Boolean).join('、');
    const left = p.burnt ? '带不走的仓粮府库付之一炬，城防拆毁，留给敌人一座空城' : [p.leftGrain >= 1000 ? `仓粮 ${troopsText(p.leftGrain)} 石` : '', p.leftSilver >= 1000 ? `府库 ${troopsText(p.leftSilver)} 两` : ''].filter(Boolean).join('、') + (p.leftGrain >= 1000 || p.leftSilver >= 1000 ? '留在城中，敌至即得' : '城中所余无几');
    report(s, { cat: '急报', urgent: true, node: o.node, text: `${p.besieged ? '突围' : '撤离'}${nodeName(o.node)}：${what}退往${nodeName(o.to)}，路程 ${p.days} 日${p.months > 1 ? `，约 ${p.months} 个月后到` : '，本月到'}。${left}。${nodeName(o.node)}已成空城，敌至即入。`, src });
  }
}
