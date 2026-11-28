/* 按局势寻路：行军与运粮共用一套路网，但要看沿途是谁的地方。
 * 路网（geography.ts 的 shortestPath）只管地理；这里再按各家关系加上代价或断路：
 *  行军：敌城当道到城下即停（须先攻下），另有几乎一样近的路才绕开；中立之城可借道，能绕则绕；停战一方的城闭门不纳，不能经过。
 *  运粮：敌城、被围之城、停战一方的城、敌军驻扎之地都过不去；中立之城可借道，能绕则绕；走海路须本阵营有港口（有船）。
 *  运粮途中有损耗：按每段路的天数与种类（陆运最耗，河运最省）累计。 */
import { NODE, neighbors, routeBetween, shortestPath } from '../data/geography';
import type { GameState, NodeId, RouteKind } from './types';
import { friendly, hostile, stance, topOf, nodeName } from './state';

/** 每日途耗（运夫口粮、车船折耗）。陆运一月约耗一成六，河运、漕运约半成，海运约一成 */
export const LOSS_PER_DAY: Record<RouteKind, number> = { land: 0.006, river: 0.002, canal: 0.002, sea: 0.003 };
export const MAX_LOSS = 0.5;
/** 绕路代价（折成天数）：敌城当道须先攻下（不能把敌城留在粮道上），只有另有几乎一样近的路（多走三日以内）才绕开；
 *  中立之城多走十日以内就绕开，不然借道 */
export const AVOID_HOSTILE = 3, AVOID_NEUTRAL = 10, AVOID_NEUTRAL_SUPPLY = 10;

/** 小顶堆版 Dijkstra。cost(v) 返回经过 v 的附加代价，null 表示过不去（终点不问）；edge 决定某段路能否走及其天数 */
function search(from: NodeId, to: NodeId, edge: (u: NodeId, v: NodeId) => number | null, cost: (v: NodeId) => number | null): NodeId[] | null {
  if (from === to) return [];
  const dist = new Map<NodeId, number>([[from, 0]]);
  const prev = new Map<NodeId, NodeId>();
  const heap: [number, NodeId][] = [[0, from]];
  const push = (x: [number, NodeId]) => { heap.push(x); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = (): [number, NodeId] => { const top = heap[0], last = heap.pop()!; if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const done = new Set<NodeId>();
  while (heap.length) {
    const [d, u] = pop();
    if (done.has(u)) continue;
    if (u === to) break;
    done.add(u);
    for (const { to: v } of neighbors(u)) {
      if (done.has(v) || NODE[v]?.kind === 'outland') continue;
      const w = edge(u, v);
      if (w === null) continue;
      const extra = v === to ? 0 : cost(v);
      if (extra === null) continue;
      const nd = d + w + extra;
      if (nd < (dist.get(v) ?? Infinity)) { dist.set(v, nd); prev.set(v, u); push([nd, v]); }
    }
  }
  if (!prev.has(to)) return null;
  const path: NodeId[] = [];
  for (let c = to; c !== from; c = prev.get(c)!) path.unshift(c);
  return path;
}

const relOf = (s: GameState, f: string, node: NodeId): 'friend' | 'war' | 'truce' | 'neutral' | 'none' => {
  const c = s.cities[node];
  if (!c) return 'none';
  if (friendly(s, f, c.controller)) return 'friend';
  if (hostile(s, f, c.controller)) return 'war';
  return stance(s, f, c.controller) === 'truce' ? 'truce' : 'neutral';
};

/** 近海渡船：陆军在本方（或友方）港口征调民船，可渡四日以内的海路（2026-11-27 玩家：岛屿显示无法到达，统一不了） */
export const FERRY_DAYS = 4;
export function ferryOk(s: GameState, f: string, u: NodeId, v: NodeId): boolean {
  const r = routeBetween(u, v);
  return !!r && r.kind === 'sea' && r.days <= FERRY_DAYS && NODE[u]?.kind === 'port' && relOf(s, f, u) === 'friend';
}
/** 行军路线（不含起点）。canSea：水师三成以上可走海路，陆路按两倍半计（尽量不舍舟）。
 * 无水师者只能从本方港口征调民船渡近海（四日以内），按一倍半再加两日计（集船、登船）。过不去返回 null */
export function armyRoute(s: GameState, f: string, from: NodeId, to: NodeId, canSea: boolean): NodeId[] | null {
  return search(from, to,
    (u, v) => { const r = routeBetween(u, v)!; if (r.kind === 'sea' && !canSea) return ferryOk(s, f, u, v) ? r.days * 1.5 + 2 : null; return canSea && r.kind === 'land' ? r.days * 2.5 : r.days; },
    v => { const k = relOf(s, f, v); return k === 'truce' ? null : k === 'war' ? AVOID_HOSTILE : k === 'neutral' ? AVOID_NEUTRAL : 0; });
}

/** 行军路线上的说明：哪些敌城会挡路（到城下即停）、哪些中立之城须借道 */
export function routeNotes(s: GameState, f: string, path: NodeId[]): { stops: NodeId[]; via: NodeId[] } {
  const mid = path.slice(0, -1);
  return { stops: mid.filter(v => relOf(s, f, v) === 'war'), via: mid.filter(v => relOf(s, f, v) === 'neutral') };
}

/** 无路时说明缘故：单看地理有路而按局势过不去，多半是隔着停战一方 */
export function noRouteReason(s: GameState, f: string, from: NodeId, to: NodeId, canSea: boolean): string {
  const p = shortestPath(from, to, canSea);
  if (!p) {
    if (!canSea && shortestPath(from, to, true)) return '须渡海：近海（四日以内）可从本方港口征调民船渡过，须先占一处临海之港；远海须水师（临海临江之城出兵时选“水师”）';
    return '无路可达';
  }
  const t = p.slice(0, -1).find(v => relOf(s, f, v) === 'truce');
  return t ? `须经${nodeName(t)}，${s.factions[s.cities[t].controller]?.short ?? '对方'}停战中闭门不纳` : '无路可达';
}

export interface SupplyLeg { path: NodeId[]; days: number; keep: number; reason?: string; at?: NodeId }

/** 本阵营有无海船：有港口之城即可走海路运粮 */
function hasShips(s: GameState, f: string): boolean {
  const top = topOf(s, f);
  return Object.values(s.cities).some(c => NODE[c.id]?.kind === 'port' && topOf(s, c.controller) === top);
}

/** 运粮路线：天数、到达比例（扣途耗）；过不去时 reason 说明，at 为按地理最短路上第一处断点（地图上标红用） */
export function supplyRoute(s: GameState, f: string, from: NodeId, to: NodeId): SupplyLeg {
  const fail = (reason: string, at?: NodeId): SupplyLeg => ({ path: [], days: 0, keep: 0, reason, at });
  // 被围的是守方：运不进、运不出。围城一方的营寨在城外，只要后路未断，照常受粮
  if (s.sieges[to] && !friendly(s, f, s.sieges[to].attacker)) return fail(`${nodeName(to)}被围，粮道不通`, to);
  if (s.sieges[from] && !friendly(s, f, s.sieges[from].attacker)) return fail(`${nodeName(from)}被围，运不出城`, from);
  if (from === to) return { path: [], days: 0, keep: 1 };
  const foes = new Set(Object.values(s.armies).filter(a => a.progress === 0 && hostile(s, f, a.faction)).map(a => a.location));
  const ships = hasShips(s, f);
  const blockedAt = (v: NodeId): boolean => { const c = s.cities[v]; if (!c || s.sieges[v] || foes.has(v)) return true; const k = relOf(s, f, v); return k === 'war' || k === 'truce'; };
  const edge = (u: NodeId, v: NodeId) => { const r = routeBetween(u, v)!; return r.kind === 'sea' && !ships ? null : r.days; };
  const path = search(from, to, edge, v => blockedAt(v) ? null : relOf(s, f, v) === 'neutral' ? AVOID_NEUTRAL_SUPPLY : 0);
  if (!path) {
    const geo = shortestPath(from, to, ships) ?? shortestPath(from, to, false);
    const at = geo?.slice(0, -1).find(blockedAt);
    return fail(`去${nodeName(to)}的路被敌方隔断`, at);
  }
  let days = 0, keep = 1, c = from;
  for (const v of path) { const r = routeBetween(c, v)!; days += r.days; keep *= Math.pow(1 - LOSS_PER_DAY[r.kind], r.days); c = v; }
  return { path, days, keep: Math.max(1 - MAX_LOSS, keep) };
}
