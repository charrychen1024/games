/* 本月得失：一月结算前后对照，本方得了什么、失了什么——钱粮兵民的总数增减与主要来由、城池得失、人物进出、战事胜负。
 * 供结算之后的“本月得失”动画卡用。钱粮来由按因果账归类；本方城池之间的起运、调拨不算得失。 */
import type { GameState, CauseSrc } from './types';
import { nodeName, topOf } from './state';

export interface Why { label: string; kind: string; v: number }
export interface Delta { before: number; after: number; up: Why[]; down: Why[] }
/** 人物进出：来投、殁、被执、离去，以及本方新俘获之人 */
export interface PersonMove { id: string; tag: '来投' | '殁' | '被执' | '离去' | '俘获'; good: boolean }
export interface MonthSummary {
  silver: Delta; grain: Delta; troops: Delta; pop: Delta;
  citiesGained: string[]; citiesLost: string[];
  peopleIn: string[]; peopleOut: string[]; prisoners: string[];
  people: PersonMove[]; cities: { id: string; gained: boolean }[];
  battlesWon: number; battlesLost: number;
}

const KIND_LABEL: Record<CauseSrc['kind'], string> = { income: '赋税田粮', upkeep: '粮饷开支', order: '政令', policy: '方针', event: '事件', battle: '战事', siege: '围城', remit: '起运', disaster: '灾异', diplomacy: '交涉' };

export function monthSummary(before: GameState, after: GameState, f = after.player): MonthSummary {
  const me = topOf(after, f);
  const own = (s: GameState) => Object.values(s.cities).filter(c => c.controller === f);
  const sum = (s: GameState, k: 'silver' | 'grain' | 'pop') => own(s).reduce((n, c) => n + c[k], 0);
  const troops = (s: GameState) => own(s).reduce((n, c) => n + c.garrison, 0) + Object.values(s.armies).filter(a => a.faction === f).reduce((n, a) => n + a.troops, 0);
  // 本月因果账（本方之城），按来由归类；起运是本方内部挪移，不算得失
  const t = before.turn;
  const mine = new Set(own(after).map(c => c.id).concat(own(before).map(c => c.id)));
  const why = (field: 'silver' | 'grain'): Pick<Delta, 'up' | 'down'> => {
    const g = new Map<string, number>(), kinds = new Map<string, string>();
    for (const e of after.ledger) {
      if (e.turn !== t || e.field !== field || !mine.has(e.node) || e.src.kind === 'remit') continue;
      if (/调来|调粮往|调银往|运到|起运/.test(e.text)) continue;
      const label = e.src.kind === 'upkeep' && /市籴|市粜/.test(e.text) ? '市面粜籴' : e.src.kind === 'upkeep' && /霉变/.test(e.text) ? '陈粮霉变' : KIND_LABEL[e.src.kind];
      g.set(label, (g.get(label) ?? 0) + e.delta);
      kinds.set(label, label === '市面粜籴' ? 'market' : label === '陈粮霉变' ? 'spoil' : e.src.kind);
    }
    const all = [...g.entries()].map(([label, v]) => ({ label, kind: kinds.get(label) ?? '', v: Math.round(v) })).filter(x => Math.abs(x.v) >= 1);
    return { up: all.filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 3), down: all.filter(x => x.v < 0).sort((a, b) => a.v - b.v).slice(0, 3) };
  };
  const d = (b: number, a: number, w?: Pick<Delta, 'up' | 'down'>): Delta => ({ before: Math.round(b), after: Math.round(a), up: w?.up ?? [], down: w?.down ?? [] });
  const was = new Set(own(before).map(c => c.id)), now = new Set(own(after).map(c => c.id));
  const citiesGained = [...now].filter(id => !was.has(id)).map(nodeName);
  const citiesLost = [...was].filter(id => !now.has(id)).map(nodeName);
  const peopleIn: string[] = [], peopleOut: string[] = [], prisoners: string[] = [], people: PersonMove[] = [];
  for (const c of Object.values(after.chars)) {
    const b = before.chars[c.id];
    const isMine = c.faction === f && c.status === 'active';
    const wasMine = !!b && b.faction === f && b.status === 'active';
    if (isMine && !wasMine) { peopleIn.push(c.name); people.push({ id: c.id, tag: '来投', good: true }); }
    if (wasMine && !isMine) { const tag = c.status === 'dead' ? '殁' : c.status === 'captured' ? '被执' : '离去'; peopleOut.push(`${c.name}（${tag}）`); people.push({ id: c.id, tag, good: false }); }
    if (c.status === 'captured' && c.captor === f && (!b || b.status !== 'captured')) { prisoners.push(c.name); people.push({ id: c.id, tag: '俘获', good: true }); }
  }
  let battlesWon = 0, battlesLost = 0;
  for (const r of after.battles) {
    if (r.turn !== t) continue;
    const side = topOf(after, r.attacker) === me ? 'attacker' : topOf(after, r.defender) === me ? 'defender' : null;
    if (!side) continue;
    if (r.winner === side) battlesWon++; else battlesLost++;
  }
  return {
    silver: d(sum(before, 'silver'), sum(after, 'silver'), why('silver')),
    grain: d(sum(before, 'grain'), sum(after, 'grain'), why('grain')),
    troops: d(troops(before), troops(after)),
    pop: d(sum(before, 'pop'), sum(after, 'pop')),
    citiesGained, citiesLost, peopleIn, peopleOut, prisoners, battlesWon, battlesLost, people,
    cities: [...[...now].filter(id => !was.has(id)).map(id => ({ id, gained: true })), ...[...was].filter(id => !now.has(id)).map(id => ({ id, gained: false }))],
  };
}
