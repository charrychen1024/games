/* 电脑行为：规则 + 随时间变化的战略倾向。倾向只定大方向，用兵仍看局势。 */
import type { Army, ArmyOrder, GameState, Order } from './types';
import { armiesOf, armyPower, cityDefense, hostile, friendly, topOf, report, nodeName, adjustAtt, citiesOf } from './state';
import { shortestPath, pathDays, neighbors } from '../data/geography';
import { maxRecruit } from './orders';
import { defectFaction } from './military';
import { RECRUIT_SILVER } from './economy';
import { rngFor } from './rng';

/** 各家各军的目标序列（依次取第一个尚未到手的） */
function doctrineTargets(s: GameState, a: Army): string[] {
  const south = s.flags.qing_south !== undefined;
  switch (a.faction) {
    case 'qing':
      if (a.id === 'a_ajige' || a.id === 'a_wu') return ['taiyuan', 'tongguan', 'xian', 'xiangyang'];
      if (a.id === 'a_zhunta') return south ? ['jinan', 'daming', 'huaian'] : ['jinan', 'daming'];
      if (a.id !== 'a_ajige' && a.id !== 'a_wu' && a.id !== 'a_zhunta' && a.id !== 'a_duoduo') return south ? ['xuzhou', 'huaian', 'sizhou', 'yangzhou'] : ['jinan', 'daming', 'kaifeng'];
      if (a.id === 'a_duoduo') return south ? ['guide', 'xuzhou', 'sizhou', 'yangzhou', 'guazhou', 'zhenjiang', 'nanjing'] : (s.turn >= 3 ? ['daming', 'kaifeng', 'guide'] : []);
      return south ? ['xuzhou', 'huaian'] : [];
    case 'xi':
      return ['chongqing', 'chengdu'];
    case 'shun':
      if (a.id === 'a_li') return [];
      return [];
    case 'zuoliangyu':
      return s.flags.zuo_rebel !== undefined ? ['jiujiang', 'anqing', 'chizhou', 'nanjing'] : [];
    default:
      return [];
  }
}

function canTake(s: GameState, a: Army, node: string): boolean {
  const c = s.cities[node];
  if (!c) return false;
  if (!hostile(s, a.faction, c.controller)) return false;
  return true;
}

function sameTop(s: GameState, a: string, b: string) { return topOf(s, a) === topOf(s, b); }

export function aiOrders(s: GameState, f: string): Order[] {
  const orders: Order[] = [];
  const fac = s.factions[f];
  if (!fac || fac.defunct || f === s.player || f === 'local') return orders;
  const rng = rngFor(s.seed, 'ai', f, s.turn);
  let n = 0;
  const id = () => `ai-${f}-${s.turn}-${n++}`;

  for (const a of armiesOf(s, f).sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.progress > 0) continue; // 在路上，继续走
    // 已在围城：继续
    if (a.order.kind === 'siege' && s.sieges[a.order.target] && a.location === a.order.target) {
      const city = s.cities[a.order.target];
      const ratio = armyPower(a, s) / Math.max(1, cityDefense(city));
      const months = s.sieges[a.order.target].months;
      const assault = ratio > 1.2 || city.wall < 45 || (months >= 3 && ratio > 0.9);
      orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'siege', target: a.order.target, assault } });
      continue;
    }
    // 下属军镇：被玩家号令时不自作主张
    if (fac.overlord === s.player && a.order.kind !== 'hold' && a.path.length) continue;
    // 断粮：回粮台
    if (a.hunger > 0 && a.location !== a.supply) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: a.supply, attack: false } }); continue; }
    // 强敌压境：退守
    const threat = Object.values(s.armies).filter(x => hostile(s, x.faction, f) && (x.location === a.location || neighbors(a.location).some(nb => nb.to === x.location)));
    const threatPower = threat.reduce((sum, x) => sum + armyPower(x, s), 0);
    const here = s.cities[a.location];
    if (threatPower > armyPower(a, s) * 1.8 && !(here && sameTop(s, here.controller, f) && here.wall > 60)) {
      const safe = citiesOf(s, f).map(c => c.id).filter(cid => cid !== a.location)
        .map(cid => ({ cid, p: shortestPath(a.location, cid, false) })).filter(x => x.p).sort((x, y) => pathDays(a.location, x.p!) - pathDays(a.location, y.p!))[0];
      if (safe) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: safe.cid, attack: false } }); continue; }
    }
    // 行军途中、无强敌：继续走
    if (a.order.kind === 'move' && a.path.length) continue;
    // 战略倾向
    const targets = doctrineTargets(s, a).filter(t => canTake(s, a, t));
    if (targets.length) {
      const t = targets[0];
      const order: ArmyOrder = a.location === t ? { kind: 'siege', target: t, assault: armyPower(a, s) > cityDefense(s.cities[t]) * 1.6 } : { kind: 'move', target: t, attack: true };
      if (!(a.order.kind === order.kind && (a.order as any).target === t && a.path.length)) orders.push({ id: id(), kind: 'army', army: a.id, order });
      continue;
    }
    // 机会进攻：相邻弱敌
    if (!fac.overlord || fac.overlord !== s.player) {
      const opp = neighbors(a.location).map(nb => nb.to).filter(nid => canTake(s, a, nid))
        .map(nid => ({ nid, d: cityDefense(s.cities[nid]) })).sort((x, y) => x.d - y.d)[0];
      if (opp && armyPower(a, s) > opp.d * 2.2 && rng.chance(0.6)) {
        orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: opp.nid, attack: true } });
        continue;
      }
    }
    // 回驻地
    if (a.order.kind === 'hold' && here && !friendly(s, here.controller, f) && fac.capital && s.cities[fac.capital]?.controller === f) {
      orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: fac.capital, attack: false } });
    }
  }
  // 补兵：都城府库充裕时募兵
  const cap = s.cities[fac.capital];
  if (cap && cap.controller === f && !s.sieges[cap.id]) {
    const want = Math.min(maxRecruit(cap), Math.floor(cap.silver * 0.25 / RECRUIT_SILVER / 100) * 100);
    const soldiers = armiesOf(s, f).reduce((sum, a) => sum + a.troops, 0) + cap.garrison;
    const cityCount = citiesOf(s, f).length;
    if (want >= 1000 && soldiers < 25000 + cityCount * 6000) orders.push({ id: id(), kind: 'recruit', node: cap.id, troops: want });
  }
  return orders;
}

/** 电脑扩军：都城驻军充裕时编成新军，交给闲置将领 */
export function aiRaiseArmies(s: GameState) {
  for (const f of Object.values(s.factions)) {
    if (f.id === s.player || f.defunct || f.overlord || f.id === 'local' || f.id === 'mingprov') continue;
    const cap = s.cities[f.capital];
    if (!cap || cap.controller !== f.id || s.sieges[cap.id]) continue;
    const keep = 15000;
    if (cap.garrison < keep + 12000) continue;
    const busy = new Set([...Object.values(s.armies).map(a => a.commander), ...Object.values(s.cities).map(c => c.governor)]);
    const cmd = Object.values(s.chars).filter(c => c.faction === f.id && c.status === 'active' && !busy.has(c.id) && c.id !== f.leader && c.ab.tong >= 50).sort((x, y) => y.ab.tong - x.ab.tong)[0];
    if (!cmd) continue;
    const troops = cap.garrison - keep;
    const id = `a_${f.id}_${s.nextId++}`;
    s.armies[id] = { id, name: `${cmd.name}部`, faction: f.id, commander: cmd.id, troops, mix: f.id === 'qing' ? { inf: 0.45, cav: 0.4, gun: 0.15, navy: 0 } : { inf: 0.7, cav: 0.2, gun: 0.1, navy: 0 },
      morale: 65, location: cap.id, path: [], progress: 0, order: { kind: 'hold' }, supply: cap.id, hunger: 0 };
    cap.garrison = keep;
    cmd.location = cap.id;
    s.ledger.push({ turn: s.turn, node: cap.id, field: 'garrison', delta: -troops, text: `编成${cmd.name}部出征`, src: { kind: 'order', ref: id } });
  }
}

/** 新收城池补给：电脑把军队粮台改到最近的己方城 */
export function aiFixSupply(s: GameState) {
  for (const a of Object.values(s.armies)) {
    if (a.faction === s.player) continue;
    const sup = s.cities[a.supply];
    const ok = sup && sameTop(s, sup.controller, a.faction) && sup.grain > a.troops * 0.6;
    if (ok) continue;
    const best = Object.values(s.cities).filter(c => c.controller === a.faction && c.grain > a.troops * 0.6)
      .map(c => ({ c, p: shortestPath(a.location, c.id, true) })).filter(x => x.p)
      .sort((x, y) => (pathDays(a.location, x.p!) - x.c.grain / 20000) - (pathDays(a.location, y.p!) - y.c.grain / 20000))[0];
    if (best) a.supply = best.c.id;
  }
}

/** 电脑交涉：清军压境时，降意高的下属军镇可能整体归附清朝 */
export function aiDefections(s: GameState) {
  if (!hostile(s, 'qing', 'hongguang')) return;
  for (const f of Object.values(s.factions)) {
    if (!f.overlord || f.defunct || f.polity !== 'ming' || f.id === 'mingprov') continue;
    const leader = s.chars[f.leader];
    if (!leader || leader.status !== 'active') continue;
    const near = Object.values(s.armies).some(a => a.faction === 'qing' && citiesOf(s, f.id).some(c => c.id === a.location || shortestPath(a.location, c.id, false)?.length === 1));
    if (!near) continue;
    const p = Math.max(0, (leader.att.surrender - 60) / 100 + (50 - (f.loyalty ?? 50)) / 200);
    const roll = rngFor(s.seed, 'defect', s.turn, f.id).next();
    if (roll < p) {
      defectFaction(s, f.id, 'qing');
      adjustAtt(s, leader.id, 'loyalty', 70 - leader.att.loyalty, '归附清朝');
      report(s, { cat: '易主', urgent: true, node: f.capital,
        text: `${leader.name}率${f.name}正式归附清朝。其所据${citiesOf(s, f.id).map(c => nodeName(c.id)).join('、') || '营伍'}一体改奉清朝，实控者不变。（降意 ${leader.att.surrender}，服从度 ${f.loyalty}）`,
        src: { kind: 'diplomacy', ref: 'defect:' + f.id } });
    }
  }
}
