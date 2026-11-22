/* 命令：校验、执行、留痕。玩家与电脑用同一套命令。 */
import type { ArmyOrder, GameState, Order } from './types';
import { bump, report, nodeName, factionName, charName, troopsText, friendly, topOf, hostile, adjustLoyalty, adjustAtt } from './state';
import { setArmyOrder, capture } from './military';
import { RECRUIT_SILVER, POLICY_NAME } from './economy';
import { rngFor } from './rng';
import { shortestPath } from '../data/geography';

export const ORDER_LABEL: Record<Order['kind'], string> = {
  policy: '方针', appoint: '任命', transfer: '调拨', recruit: '募兵', army: '军令', reinforce: '增兵',
  envoy: '遣使', persuade: '劝降', command: '号令下属', reward: '犒赏',
};

/** 命令的一句话描述 */
export function describeOrder(s: GameState, o: Order): string {
  switch (o.kind) {
    case 'policy': return `${nodeName(o.node)}改行“${POLICY_NAME[o.policy]}”方针`;
    case 'appoint': return `任命${charName(s, o.char)}主政${nodeName(o.node)}`;
    case 'transfer': return `自${nodeName(o.from)}调${o.grain ? `粮 ${o.grain} 石` : ''}${o.grain && o.silver ? '、' : ''}${o.silver ? `银 ${o.silver} 两` : ''}往${nodeName(o.to)}`;
    case 'recruit': return `${nodeName(o.node)}募兵 ${o.troops} 人`;
    case 'army': return `${s.armies[o.army]?.name ?? o.army}${armyOrderText(o.order)}`;
    case 'reinforce': return o.troops >= 0 ? `${s.armies[o.army]?.name}拨 ${o.troops} 人入${nodeName(o.node)}驻守` : `${nodeName(o.node)}抽驻军 ${-o.troops} 人补入${s.armies[o.army]?.name}`;
    case 'envoy': return `遣${charName(s, o.char)}赴${factionName(s, o.target)}${o.aim === 'alliance' ? '议结盟' : o.aim === 'truce' ? '议停战' : '议和'}`;
    case 'persuade': return `遣${charName(s, o.char)}赴${nodeName(o.node)}劝降`;
    case 'command': return `号令${factionName(s, o.vassal)}：${s.armies[o.army]?.name ?? ''}${armyOrderText(o.order)}${o.silver ? `（犒银 ${o.silver} 两）` : ''}`;
    case 'reward': return `犒赏${factionName(s, o.vassal)}银 ${o.silver} 两`;
  }
}

export function armyOrderText(o: ArmyOrder): string {
  if (o.kind === 'hold') return '原地驻扎';
  if (o.kind === 'move') return `${o.attack ? '进攻' : '开赴'}${nodeName(o.target)}`;
  return `${o.assault ? '攻打' : '围困'}${nodeName(o.target)}`;
}

/** 校验：返回错误说明，合法返回 null */
export function validateOrder(s: GameState, f: string, o: Order): string | null {
  const own = (node: string) => s.cities[node]?.controller === f;
  switch (o.kind) {
    case 'policy': return own(o.node) ? null : '只能给自己的城定方针';
    case 'appoint': {
      const c = s.chars[o.char];
      if (!own(o.node)) return '只能任命自己城池的主官';
      if (!c || c.faction !== f || c.status !== 'active') return '此人不可任用';
      if (Object.values(s.armies).some(a => a.commander === o.char)) return '此人正在统兵';
      return null;
    }
    case 'transfer': {
      if (!own(o.from)) return '只能从自己的城调出';
      const to = s.cities[o.to];
      if (!to || !friendly(s, f, to.controller)) return '只能调往己方或友方城池';
      if (o.grain < 0 || o.silver < 0 || (!o.grain && !o.silver)) return '数目不对';
      if (o.grain > s.cities[o.from].grain || o.silver > s.cities[o.from].silver) return '库存不足';
      return null;
    }
    case 'recruit': {
      const c = s.cities[o.node];
      if (!own(o.node)) return '只能在自己的城募兵';
      if (o.troops <= 0 || o.troops > maxRecruit(c)) return `本城本月最多募 ${maxRecruit(c)} 人`;
      if (c.silver < o.troops * RECRUIT_SILVER) return '府库不足';
      return null;
    }
    case 'army': {
      const a = s.armies[o.army];
      if (!a || a.faction !== f) return '不是你的军队';
      if (o.order.kind !== 'hold' && shortestPath(a.location, o.order.target, a.mix.navy >= 0.3) === null) return '无路可达';
      return null;
    }
    case 'reinforce': {
      const a = s.armies[o.army];
      if (!a || a.faction !== f) return '不是你的军队';
      if (a.location !== o.node || a.progress > 0 || !own(o.node)) return '军队须在己方城中';
      if (o.troops > 0 && o.troops > a.troops - 500) return '军队至少留 500 人';
      if (o.troops < 0 && -o.troops > s.cities[o.node].garrison - 500) return '城中至少留 500 人';
      return null;
    }
    case 'envoy': case 'persuade': {
      const c = s.chars[o.char];
      if (!c || c.faction !== f || c.status !== 'active') return '此人不可出使';
      if (Object.values(s.armies).some(a => a.commander === o.char)) return '此人正在统兵';
      if (s.missions.some(m => (m.order as any).char === o.char)) return '此人已在出使途中';
      if (o.kind === 'envoy' && (!s.factions[o.target] || o.target === f)) return '对象不对';
      if (o.kind === 'persuade') {
        const city = s.cities[o.node];
        if (!city || friendly(s, f, city.controller)) return '只能劝降敌方或中立城池';
      }
      return null;
    }
    case 'command': {
      const v = s.factions[o.vassal];
      const a = s.armies[o.army];
      if (!v || v.overlord !== f) return '不是你的下属';
      if (!a || a.faction !== o.vassal) return '军队不属该部';
      const cap = s.cities[s.factions[f].capital];
      if (o.silver > (cap?.silver ?? 0)) return '府库不足';
      return null;
    }
    case 'reward': {
      const v = s.factions[o.vassal];
      if (!v || v.overlord !== f) return '不是你的下属';
      const cap = s.cities[s.factions[f].capital];
      if (o.silver <= 0 || o.silver > (cap?.silver ?? 0)) return '府库不足';
      return null;
    }
  }
}

export const maxRecruit = (c: { pop: number; minxin: number }) => Math.max(0, Math.round(c.pop * 10000 * 0.004 * (0.5 + c.minxin / 100) / 100) * 100);

/** 执行一道命令（已在月初校验）。交涉类只建立任务，下月抵达。 */
export function applyOrder(s: GameState, f: string, o: Order) {
  const err = validateOrder(s, f, o);
  const isPlayer = f === s.player;
  if (err) {
    if (isPlayer) report(s, { cat: '内政', text: `命令未能执行：${describeOrder(s, o)}（${err}）。` });
    return;
  }
  const src = { kind: 'order' as const, ref: o.id, turn: s.turn };
  switch (o.kind) {
    case 'policy':
      s.cities[o.node].policy = o.policy;
      if (isPlayer) report(s, { cat: '内政', node: o.node, text: `${describeOrder(s, o)}。`, src });
      break;
    case 'appoint': {
      const c = s.cities[o.node];
      const prev = c.governor;
      c.governor = o.char;
      s.chars[o.char].location = o.node;
      if (isPlayer) report(s, { cat: '人事', node: o.node, text: `${describeOrder(s, o)}${prev && prev !== o.char ? `，接替${charName(s, prev)}` : ''}。`, src });
      break;
    }
    case 'transfer': {
      const txt = describeOrder(s, o);
      if (o.grain) { bump(s, o.from, 'grain', -o.grain, `调粮往${nodeName(o.to)}`, src); bump(s, o.to, 'grain', o.grain, `自${nodeName(o.from)}调来粮`, src); }
      if (o.silver) { bump(s, o.from, 'silver', -o.silver, `调银往${nodeName(o.to)}`, src); bump(s, o.to, 'silver', o.silver, `自${nodeName(o.from)}调来银`, src); }
      const to = s.cities[o.to];
      if (to.controller !== f && s.factions[to.controller]?.overlord === f) adjustLoyalty(s, to.controller, Math.min(8, Math.round((o.grain / 4 + o.silver) / 4000)), '朝廷拨给钱粮');
      if (isPlayer) report(s, { cat: '内政', node: o.to, text: `${txt}。`, src });
      break;
    }
    case 'recruit': {
      const c = s.cities[o.node];
      bump(s, o.node, 'silver', -o.troops * RECRUIT_SILVER, `募兵 ${o.troops} 人`, src);
      bump(s, o.node, 'garrison', o.troops, `募兵 ${o.troops} 人`, src);
      bump(s, o.node, 'pop', -o.troops / 10000, `募兵 ${o.troops} 人`, src);
      bump(s, o.node, 'minxin', -Math.round(o.troops / 1500 * 10) / 10, `募兵 ${o.troops} 人`, src);
      void c;
      if (isPlayer) report(s, { cat: '内政', node: o.node, text: `${describeOrder(s, o)}。每月多耗口粮 ${Math.round(o.troops * 0.3)} 石、饷银 ${Math.round(o.troops * 0.6)} 两。`, src });
      break;
    }
    case 'army': {
      const a = s.armies[o.army];
      setArmyOrder(s, a, o.order);
      if (isPlayer) report(s, { cat: '军报', node: a.location, text: `${describeOrder(s, o)}。`, src });
      break;
    }
    case 'reinforce': {
      const a = s.armies[o.army];
      a.troops -= o.troops;
      bump(s, o.node, 'garrison', o.troops, o.troops > 0 ? `${a.name}拨兵入城` : `抽兵补入${a.name}`, src);
      if (isPlayer) report(s, { cat: '军报', node: o.node, text: `${describeOrder(s, o)}。`, src });
      break;
    }
    case 'envoy': case 'persuade':
      s.missions.push({ id: o.id, order: o, faction: f, issuedTurn: s.turn, arriveTurn: s.turn + 1 });
      if (isPlayer) report(s, { cat: '交涉', node: o.kind === 'persuade' ? o.node : s.factions[o.target]?.capital, text: `${describeOrder(s, o)}，下月可有回音。`, src });
      break;
    case 'command':
      commandVassal(s, f, o, src);
      break;
    case 'reward': {
      const cap = s.factions[f].capital;
      bump(s, cap, 'silver', -o.silver, `犒赏${factionName(s, o.vassal)}`, src);
      const gain = Math.min(15, Math.round(o.silver / 2500));
      adjustLoyalty(s, o.vassal, gain, `受${factionName(s, f)}犒赏银 ${o.silver} 两`);
      if (isPlayer) report(s, { cat: '交涉', text: `${describeOrder(s, o)}，${charName(s, s.factions[o.vassal].leader)}感念，服从 +${gain}。`, src });
      break;
    }
  }
}

/* ---------- 下属服从 ---------- */
export interface Obedience { result: 'comply' | 'delay' | 'half' | 'refuse'; score: number; factors: string[] }

export function obedience(s: GameState, f: string, o: Extract<Order, { kind: 'command' }>, roll = true): Obedience {
  const v = s.factions[o.vassal];
  const a = s.armies[o.army];
  const leader = s.chars[v.leader];
  const factors: string[] = [];
  let score = 0;
  const base = (v.loyalty ?? 50) * 0.6 + (leader?.att.loyalty ?? 50) * 0.4;
  score += base; factors.push(`服从度 ${Math.round(base)}`);
  if (o.silver > 0) { const g = Math.min(25, o.silver / 1000); score += g; factors.push(`犒银 +${Math.round(g)}`); }
  // 督师在侧
  const shi = Object.values(s.chars).find(c => c.faction === f && c.status === 'active' && c.ab.wang >= 80 && c.id !== s.factions[f].leader && (c.location === a.location || shortestPath(c.location, a.location, false)?.length === 1));
  if (shi) { score += 10; factors.push(`${shi.name}在侧督促 +10`); }
  if (o.order.kind !== 'hold') {
    const target = o.order.target;
    const tc = s.cities[target];
    const foes = Object.values(s.armies).filter(x => hostile(s, x.faction, f) && (x.location === target || shortestPath(x.location, target, false)?.length === 1));
    const foePower = foes.reduce((n, x) => n + x.troops, 0) + (tc && hostile(s, f, tc.controller) ? tc.garrison * 1.5 : 0);
    if (foePower > a.troops * 1.2) { score -= 20; factors.push('敌势强于本部，恐遭折损 −20'); }
    else if (foePower > a.troops * 0.6) { score -= 8; factors.push('须与敌接战 −8'); }
    const leaveHome = a.location === v.capital && target !== v.capital;
    if (leaveHome) { score -= 10; factors.push(`须离开驻地${nodeName(v.capital)} −10`); }
    if (tc && tc.controller !== o.vassal && tc.commerce >= 80 && !hostile(s, f, tc.controller)) { score += 5; factors.push(`${nodeName(target)}富庶，乐于前往 +5`); }
    if (leader && (o.order.kind === 'siege' || (o.order.kind === 'move' && o.order.attack))) {
      const h = Math.round(leader.att.hawk / 10); score += h; if (h) factors.push(`${leader.name}${h > 0 ? '好战' : '畏战'} ${h > 0 ? '+' : ''}${h}`);
    }
  }
  if (roll) { const r = rngFor(s.seed, 'obey', s.turn, o.id).int(-10, 10); score += r; factors.push(`临事变数 ${r >= 0 ? '+' : ''}${r}`); }
  const result = score >= 65 ? 'comply' : score >= 50 ? 'delay' : score >= 35 ? 'half' : 'refuse';
  return { result, score: Math.round(score), factors };
}

const RESULT_TEXT = { comply: '照办', delay: '拖延', half: '打折扣', refuse: '抗命' };

function commandVassal(s: GameState, f: string, o: Extract<Order, { kind: 'command' }>, src: { kind: 'order'; ref: string; turn: number }) {
  const v = s.factions[o.vassal];
  const a = s.armies[o.army];
  if (o.silver > 0) {
    bump(s, s.factions[f].capital, 'silver', -o.silver, `犒${v.name}以促其奉命`, src);
    adjustLoyalty(s, o.vassal, Math.min(5, Math.round(o.silver / 4000)), '奉命受犒');
  }
  const ob = obedience(s, f, o);
  const leader = charName(s, v.leader);
  let text = `号令${v.name}（${leader}）：${a.name}${armyOrderText(o.order)}。结果：${RESULT_TEXT[ob.result]}。`;
  switch (ob.result) {
    case 'comply':
      setArmyOrder(s, a, o.order);
      break;
    case 'delay':
      s.delayed.push({ ...o, silver: 0, id: o.id + 'd' });
      text += '推说粮草未齐，下月再动。';
      break;
    case 'half': {
      const part = Math.round(a.troops / 2);
      const deputy = Object.values(s.chars).find(c => c.faction === o.vassal && c.status === 'active' && c.id !== a.commander && !Object.values(s.armies).some(x => x.commander === c.id));
      if (deputy && part >= 1000) {
        const id = a.id + '_' + s.nextId++;
        s.armies[id] = { ...structuredClone(a), id, name: a.name + '分兵', troops: part, commander: deputy.id, path: [], progress: 0 };
        a.troops -= part;
        setArmyOrder(s, s.armies[id], o.order);
        text += `只遣${deputy.name}率半数 ${troopsText(part)} 人前往，主力仍留原地。`;
      } else {
        a.morale = Math.max(5, a.morale - 10);
        setArmyOrder(s, a, o.order);
        text += '勉强出兵，军无斗志。';
      }
      break;
    }
    case 'refuse':
      adjustLoyalty(s, o.vassal, -3, '抗命');
      text += '推辞不奉。';
      break;
  }
  text += `（${ob.factors.join('，')}；合计 ${ob.score}）`;
  if (f === s.player) report(s, { cat: '交涉', node: a.location, text, src });
  // 被反复催逼会伤及关系
  if (ob.result !== 'comply' && leader) adjustAtt(s, v.leader, 'loyalty', -1, '朝廷催逼');
}

/* ---------- 跨月交涉 ---------- */
export function resolveMissions(s: GameState) {
  const due = s.missions.filter(m => m.arriveTurn <= s.turn);
  s.missions = s.missions.filter(m => m.arriveTurn > s.turn);
  for (const m of due) {
    const o = m.order;
    if (o.kind === 'envoy') resolveEnvoy(s, m.faction, o);
    else if (o.kind === 'persuade') resolvePersuade(s, m.faction, o);
  }
}

export function envoyScore(s: GameState, f: string, o: Extract<Order, { kind: 'envoy' }>): { score: number; factors: string[] } {
  const t = s.factions[o.target];
  const env = s.chars[o.char];
  const leader = s.chars[t.leader];
  const factors: string[] = [];
  let score = 30;
  factors.push('底数 30');
  const w = Math.round((env.ab.wai - 50) / 2); score += w; factors.push(`${env.name}外交 ${w >= 0 ? '+' : ''}${w}`);
  const common = Object.values(s.factions).filter(x => !x.defunct && x.id !== f && x.id !== o.target && hostile(s, f, x.id) && hostile(s, o.target, x.id) && x.id !== 'local');
  if (common.length) { score += 25; factors.push(`同仇${common.map(c => c.short).join('、')} +25`); }
  const st = s.relations[[f, o.target].sort().join('|')]?.stance ?? 'neutral';
  if (st === 'war' && o.aim === 'alliance') { score -= 30; factors.push('两家正在交战 −30'); }
  if (st === 'war' && o.aim !== 'alliance') {
    // 战事不利者愿意停战
    const mine = Object.values(s.armies).filter(a => a.faction === f).reduce((n, a) => n + a.troops, 0);
    const theirs = Object.values(s.armies).filter(a => a.faction === o.target).reduce((n, a) => n + a.troops, 0);
    if (theirs < mine) { score += 15; factors.push('对方兵力不及 +15'); } else { score -= 10; factors.push('对方兵强 −10'); }
  }
  if (leader) { const h = -Math.round(leader.att.hawk / 8); score += h; if (h) factors.push(`${leader.name}${h > 0 ? '主和' : '主战'} ${h >= 0 ? '+' : ''}${h}`); }
  if (s.factions[o.target].polity === s.factions[f].polity) { score += 10; factors.push('同奉一朝 +10'); }
  return { score, factors };
}

function resolveEnvoy(s: GameState, f: string, o: Extract<Order, { kind: 'envoy' }>) {
  const t = s.factions[o.target];
  if (!t || t.defunct) return;
  const { score, factors } = envoyScore(s, f, o);
  const r = rngFor(s.seed, 'envoy', s.turn, o.id).int(-10, 10);
  const total = score + r;
  const ok = total >= 55;
  const aimText = o.aim === 'alliance' ? '结盟' : o.aim === 'truce' ? '停战' : '议和';
  const src = { kind: 'diplomacy' as const, ref: o.id, turn: s.turn };
  if (ok) {
    if (o.aim === 'alliance') setStanceExplicit(s, f, o.target, 'alliance');
    else setStanceExplicit(s, f, o.target, o.aim === 'truce' ? 'truce' : 'neutral', o.aim === 'truce' ? s.turn + 6 : undefined);
    adjustAtt(s, o.char, 'loyalty', 2, `出使${t.name}，${aimText}成功`);
  }
  const text = `${charName(s, o.char)}出使${t.name}，${aimText}${ok ? '议成' : '未成'}。${ok && o.aim === 'alliance' ? '两家结为盟好，各守其城，互不相犯。' : ''}（${factors.join('，')}，临事 ${r >= 0 ? '+' : ''}${r}；合计 ${total}，需 55）`;
  if (f === s.player || o.target === s.player) report(s, { cat: '交涉', node: t.capital, text, src });
}

function setStanceExplicit(s: GameState, a: string, b: string, st: 'alliance' | 'truce' | 'neutral', until?: number) {
  s.relations[[a, b].sort().join('|')] = until === undefined ? { stance: st } : { stance: st, until };
}

export function persuadeChance(s: GameState, f: string, charId: string, node: string): { p: number; factors: string[] } {
  const city = s.cities[node];
  const env = s.chars[charId];
  const gov = city.governor ? s.chars[city.governor] : undefined;
  const factors: string[] = [];
  let p = 0.05; factors.push('底数 5%');
  const sur = gov && gov.status === 'active' ? gov.att.surrender : 40 + (100 - city.minxin) / 4;
  p += sur / 250; factors.push(`${gov ? gov.name : '守将'}降意 ${Math.round(sur)}（+${Math.round(sur / 2.5)}%）`);
  p += (env.ab.wai - 50) / 300; factors.push(`${env.name}外交（${env.ab.wai >= 50 ? '+' : ''}${Math.round((env.ab.wai - 50) / 3)}%）`);
  const sg = s.sieges[node];
  if (sg && topOf(s, sg.attacker) === topOf(s, f)) { p += 0.25; factors.push('城已被我军围困 +25%'); }
  const near = Object.values(s.armies).filter(a => topOf(s, a.faction) === topOf(s, f) && (a.location === node || shortestPath(a.location, node, false)?.length === 1)).reduce((n, a) => n + a.troops, 0);
  if (near > city.garrison * 2) { p += 0.1; factors.push('我军压境 +10%'); }
  if (city.minxin < 40) { p += 0.08; factors.push('城中人心离散 +8%'); }
  const ctrl = s.factions[city.controller];
  if (ctrl && ctrl.polity === s.factions[f].polity) { p += 0.1; factors.push('同奉一朝 +10%'); }
  p = Math.max(0.02, Math.min(0.9, p));
  return { p, factors };
}

function resolvePersuade(s: GameState, f: string, o: Extract<Order, { kind: 'persuade' }>) {
  const city = s.cities[o.node];
  if (!city || friendly(s, f, city.controller)) return;
  const { p, factors } = persuadeChance(s, f, o.char, o.node);
  const rng = rngFor(s.seed, 'persuade', s.turn, o.id);
  const ok = rng.next() < p;
  const env = s.chars[o.char];
  const src = { kind: 'diplomacy' as const, ref: o.id, turn: s.turn };
  const old = city.controller;
  if (ok) {
    report(s, { cat: '交涉', node: o.node, text: `${env.name}入${nodeName(o.node)}劝降，守将应允。（成功率 ${Math.round(p * 100)}%：${factors.join('，')}）`, src });
    capture(s, o.node, f, '献城');
  } else {
    const detained = rng.chance(0.2);
    if (detained) { env.status = 'captured'; env.location = s.factions[old]?.capital ?? o.node; }
    if (f === s.player || old === s.player) report(s, { cat: '交涉', node: o.node, text: `${env.name}赴${nodeName(o.node)}劝降，${detained ? '被扣留' : '无功而返'}。（成功率 ${Math.round(p * 100)}%：${factors.join('，')}）`, src });
  }
}
