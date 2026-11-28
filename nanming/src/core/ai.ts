/* 电脑行为：规则 + 随时间变化的战略倾向。倾向只定大方向，用兵仍看局势。 */
import type { Army, ArmyOrder, GameState, Order } from './types';
import { armiesOf, armyPower, cityDefense, hostile, friendly, topOf, report, nodeName, adjustAtt, citiesOf, stance, setStance } from './state';
import { shortestPath, pathDays, neighbors, distancesFrom, NODE } from '../data/geography';
import { canSea } from './military';
import { maxRecruit } from './orders';
import { defectFaction, disband } from './military';
import { RECRUIT_SILVER, SILVER_PER_SOLDIER, supplyChoiceError, supplyBlock, GRAIN_PER_SOLDIER, SILVER_PER_FIELD_SOLDIER } from './economy';
import { rngFor } from './rng';
import { genLocal } from './people';
import { applyOrder, validateOrder, persuadeChance } from './orders';

/** 各家各军的目标序列（开局几年的史实倾向；依次取第一个尚未到手的） */
function doctrineTargets(s: GameState, a: Army): string[] {
  const south = s.flags.qing_south !== undefined;
  switch (a.faction) {
    case 'qing':
      if (a.id === 'a_ajige' || a.id === 'a_wu') return s.turn < 30 ? ['taiyuan', 'pingyang', 'tongguan', 'xian', 'xiangyang', 'wuchang'] : [];
      if (a.id === 'a_zhunta') return south ? ['jinan', 'yanzhou', 'huaian'] : ['hejian', 'jinan', 'dongchang', 'yanzhou', 'daming'];
      if (a.id === 'a_duoduo') return south ? ['guide', 'xuzhou', 'sizhou', 'yangzhou', 'guazhou', 'zhenjiang', 'nanjing', 'suzhou', 'hangzhou'] : (s.turn >= 3 ? ['daming', 'zhangde', 'weihui', 'kaifeng', 'guide'] : []);
      return [];
    case 'xi':
      return s.turn < 30 ? ['chongqing', 'shunqing', 'chengdu', 'baoning', 'luzhousc', 'xuzhousc'] : [];
    case 'zuoliangyu':
      return s.flags.zuo_rebel !== undefined ? ['jiujiang', 'anqing', 'chizhou', 'nanjing'] : [];
    default:
      return [];
  }
}

/** 各家用兵的偏重：地区 → 权重（0 表示不去）。随时间与局势变化。 */
function areaWeight(s: GameState, f: string, area: string): number {
  const fac = s.factions[f];
  const south = s.flags.qing_south !== undefined;
  if (f === 'qing') {
    if (!south && ['南直隶', '浙江', '江西', '湖广', '福建', '广东', '广西', '云贵', '四川'].includes(area)) return 0;
    return ['北直隶', '山东', '山西', '河南', '陕西', '南直隶'].includes(area) ? 1.3 : 1;
  }
  if (f === 'xi') return area === '四川' ? 2 : s.turn > 30 && ['云贵', '湖广', '广西'].includes(area) ? 1 : 0.15;
  if (f === 'shun') return ['陕西', '山西', '河南'].includes(area) ? 1.2 : ['湖广'].includes(area) ? (s.turn > 10 ? 1.4 : 0.4) : 0.2;
  if (f === 'zheng' || fac?.id.startsWith('zheng')) return ['福建'].includes(area) ? 1.5 : ['浙江', '广东', '台湾'].includes(area) ? 0.8 : area === '南直隶' && s.turn > 150 ? 0.8 : 0.1;
  if (f === 'helan' || f === 'local') return 0;
  if (fac?.polity === 'ming') return 1;
  return 1;
}

/** 守城之力：城中驻军连同屯在城里的本方野战军，一并凭城而守（城防加成同样算上） */
function holdStrength(s: GameState, node: string): number {
  const c = s.cities[node];
  const inside = Object.values(s.armies).filter(x => x.location === node && x.progress === 0 && sameTop(s, x.faction, c.controller)).reduce((m, x) => m + x.troops, 0);
  return (c.garrison + inside) * (1 + c.wall / 60);
}

function canTake(s: GameState, a: Army, node: string): boolean {
  const c = s.cities[node];
  if (!c) return false;
  if (!hostile(s, a.faction, c.controller)) return false;
  // 城下屯着远强于己的敌军：不去送死（史实路线也要量力）
  const foe = Object.values(s.armies).filter(x => x.location === node && hostile(s, a.faction, x.faction)).reduce((n, x) => n + armyPower(x, s), 0);
  const mine = Object.values(s.armies).filter(x => x.faction === a.faction && (x.location === a.location || x.location === node)).reduce((n, x) => n + armyPower(x, s), 0);
  if (foe > mine * 1.5) return false;
  // 强攻要三倍上下的兵力才破得了城（见攻城模拟）：连围带攻也不及守城之力的七成，就别去
  if (mine < holdStrength(s, node) * 0.7) return false;
  return true;
}

function sameTop(s: GameState, a: string, b: string) { return topOf(s, a) === topOf(s, b); }

/** 城的价值：人口、都城、要地 */
function cityValue(s: GameState, node: string): number {
  const c = s.cities[node], n = NODE[node];
  const capital = Object.values(s.factions).some(f => f.capital === node && !f.defunct && f.id !== 'local');
  return 1 + c.pop / 40 + (capital ? 2.5 : 0) + (n.major ? 1 : 0) + (n.kind === 'pass' ? 0.6 : 0);
}

/** 本方受威胁的城：相邻有敌军，且敌强于守 */
function threatened(s: GameState, f: string): { node: string; need: number; foe: number; at: string }[] {
  const out: { node: string; need: number; foe: number; at: string }[] = [];
  for (const c of citiesOf(s, f)) {
    let foe = 0, at = '', top = 0;
    for (const a of Object.values(s.armies)) {
      if (!hostile(s, a.faction, f) || a.troops < 1500) continue;
      if (a.location === c.id || neighbors(c.id).some(nb => nb.to === a.location) || a.path[0] === c.id) { const p = armyPower(a, s); foe += p; if (p > top && a.progress === 0) { top = p; at = a.location; } }
    }
    const def = cityDefense(c);
    if (foe > def * 0.9 || s.sieges[c.id]) out.push({ node: c.id, need: foe - def, foe, at });
  }
  return out.sort((x, y) => y.need - x.need);
}

export function aiOrders(s: GameState, f: string): Order[] {
  const orders: Order[] = [];
  const fac = s.factions[f];
  if (!fac || fac.defunct || f === s.player || f === 'local' || f === 'helan') return orders;
  const rng = rngFor(s.seed, 'ai', f, s.turn);
  let n = 0;
  const id = () => `ai-${f}-${s.turn}-${n++}`;
  const underPlayer = fac.overlord === s.player;
  const danger = threatened(s, f);
  const claimed = new Set<string>();
  const capNode = fac.capital;
  const idle: { a: Army; power: number; dist: Record<string, number>; here: GameState['cities'][string] | undefined }[] = [];

  for (const a of armiesOf(s, f).sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.progress > 0) continue; // 在路上，继续走
    if (a.sortie) continue;       // 出城之兵：只与围城之军一战，战罢回城
    const power = armyPower(a, s);
    const sea = canSea(a);
    // 已在围城：继续
    if (a.order.kind === 'siege' && s.sieges[a.order.target] && a.location === a.order.target) {
      const city = s.cities[a.order.target];
      const ratio = power / Math.max(1, holdStrength(s, city.id));
      const months = s.sieges[a.order.target].months;
      // 兵少粮尽：解围回城休整
      const besiegers = s.sieges[a.order.target].armies.map(x => s.armies[x]).filter(Boolean).reduce((m, x) => m + armyPower(x, s), 0);
      if (besiegers < holdStrength(s, city.id) * 0.45 || (a.hunger >= 2 && ratio < 1) || a.morale < 25) {
        const { dist } = distancesFrom(a.location, canSea(a));
        const back = citiesOf(s, f).map(c => c.id).filter(c => dist[c] !== undefined).sort((x, y) => dist[x] - dist[y])[0];
        if (back) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: back, attack: false } }); continue; }
      }
      // 强攻：兵力约为守城之力的一倍半（墙六十时约三比一）、或城墙已残、或久围之后守军已疲；否则只围不攻，等其断粮
      const sg = s.sieges[a.order.target];
      const ratioAll = besiegers / Math.max(1, holdStrength(s, city.id));
      const assault = ratioAll > 1.5 || city.wall < 30 || (months >= 4 && ratioAll > 1.1) || (!!sg.gate && sg.gate <= 0.3 && ratioAll > 1);
      orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'siege', target: a.order.target, assault } });
      continue;
    }
    // 下属军镇：被玩家号令时不自作主张
    if (underPlayer && a.order.kind !== 'hold' && a.path.length) continue;
    // 断粮：回粮台
    if (a.hunger > 0 && a.location !== a.supply) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: a.supply, attack: false } }); continue; }
    // 军心将溃：不再进攻、不再围城，回最近的本方城休整（已在本方城则就地休整）
    if (a.morale < 30) {
      const here0 = s.cities[a.location];
      if (here0 && sameTop(s, here0.controller, f)) { if (a.order.kind !== 'hold') orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'hold' } }); continue; }
      const { dist } = distancesFrom(a.location, sea);
      const rest = citiesOf(s, f).map(c => c.id).filter(cid => dist[cid] !== undefined).sort((x, y) => dist[x] - dist[y])[0];
      if (rest) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: rest, attack: false } }); continue; }
    }
    // 强敌压境：退守
    const threat = Object.values(s.armies).filter(x => hostile(s, x.faction, f) && (x.location === a.location || neighbors(a.location).some(nb => nb.to === x.location)));
    const threatPower = threat.reduce((sum, x) => sum + armyPower(x, s), 0);
    const here = s.cities[a.location];
    if (threatPower > power * 1.8 && !(here && sameTop(s, here.controller, f) && here.wall > 60)) {
      const { dist } = distancesFrom(a.location, sea);
      const safe = citiesOf(s, f).map(c => c.id).filter(cid => cid !== a.location && dist[cid] !== undefined).sort((x, y) => dist[x] - dist[y])[0];
      if (safe) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: safe, attack: false } }); continue; }
    }
    // 行军途中、无强敌：继续走
    if (a.order.kind === 'move' && a.path.length) continue;
    if (underPlayer) continue;
    const { dist } = distancesFrom(a.location, sea);
    // 救援：本方受威胁的城（近者优先）；敌弱则就地出击
    const help = danger.find(d => !claimed.has(d.node) && dist[d.node] !== undefined && dist[d.node] <= 20 && (d.node === capNode || dist[d.node] <= 12));
    if (help && help.at && help.at !== a.location && power > help.foe * 1.5 && dist[help.at] !== undefined && dist[help.at] <= 12) {
      claimed.add(help.node);
      orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: help.at, attack: true } });
      continue;
    }
    if (help && help.node !== a.location && power > help.need * 0.6) {
      claimed.add(help.node);
      orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: help.node, attack: false } });
      continue;
    }
    if (help && help.node === a.location && power < help.foe * 1.5) { claimed.add(help.node); continue; }
    // 乘虚：近处（十五日内）有空虚的敌城（守城之力不及我四成、城下无敌军），先取之，不论平日用兵偏重（清军南下之前不越界）
    if (a.troops >= 3000 && !(here && s.sieges[here.id])) {
      const soft = Object.keys(dist).filter(t => dist[t] > 0 && dist[t] <= 15 && !claimed.has(t)).map(t => s.cities[t])
        .filter(c => c && hostile(s, f, c.controller) && c.controller !== 'helan' && (areaWeight(s, f, NODE[c.id].area) > 0 || topOf(s, c.controller) === topOf(s, s.player))
          && holdStrength(s, c.id) < power * 0.4 && !Object.values(s.armies).some(x => x.location === c.id && hostile(s, f, x.faction) && x.troops >= 1000))
        .sort((x, y) => cityValue(s, y.id) / (dist[y.id] + 5) - cityValue(s, x.id) / (dist[x.id] + 5))[0];
      if (soft) {
        claimed.add(soft.id);
        if (!(a.order.kind === 'move' && a.order.target === soft.id && a.path.length)) orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: soft.id, attack: true } });
        continue;
      }
    }
    // 补员：在本方城中抽驻军补足；兵少则先回大城休整
    if (here && here.controller === f && a.troops < 24000 && here.garrison > 6000 && !s.sieges[here.id]) {
      const take = Math.min(here.garrison - 4000, 30000 - a.troops);
      if (take >= 1000) { orders.push({ id: id(), kind: 'reinforce', node: here.id, army: a.id, troops: -take }); continue; }
    }
    if (a.troops < 6000) {
      const depot = citiesOf(s, f).filter(c => c.garrison > 12000 && dist[c.id] !== undefined && c.id !== a.location).sort((x, y) => dist[x.id] - dist[y.id])[0];
      if (depot) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: depot.id, attack: false } }); continue; }
    }
    // 战略倾向（史实开局）
    const targets = doctrineTargets(s, a).filter(t => canTake(s, a, t));
    if (targets.length) {
      const t = targets[0];
      const order: ArmyOrder = a.location === t ? { kind: 'siege', target: t, assault: power > holdStrength(s, t) * 1.5 } : { kind: 'move', target: t, attack: true };
      if (!(a.order.kind === order.kind && (a.order as any).target === t && a.path.length)) orders.push({ id: id(), kind: 'army', army: a.id, order });
      continue;
    }
    idle.push({ a, power, dist, here });
  }

  // 会兵进取：挑一座敌城，就近调集足够的军队合攻；兵力不足的城暂不碰
  const reach = fac.overlord ? 12 : f === 'qing' ? 45 : 30;
  for (let round = 0; round < 3 && idle.length; round++) {
    let best: { node: string; score: number; def: number } | null = null;
    const seen = new Set<string>();
    for (const it of idle) for (const [node, d] of Object.entries(it.dist)) {
      if (d > reach || seen.has(node) || claimed.has(node)) continue;
      seen.add(node);
      const c = s.cities[node];
      if (!c || !hostile(s, f, c.controller)) continue;
      const w = areaWeight(s, f, NODE[node].area);
      if (w <= 0) continue;
      const def = holdStrength(s, node);
      const avail = idle.filter(x => x.dist[node] !== undefined && x.dist[node] <= reach).reduce((m, x) => m + x.power, 0);
      if (avail < def * 1.3) continue;
      const near = Math.min(...idle.filter(x => x.dist[node] !== undefined).map(x => x.dist[node]));
      const score = cityValue(s, node) * w / (near + 6) * (1 + Math.min(1, (avail - def) / Math.max(1, avail)));
      if (!best || score > best.score) best = { node, score, def };
    }
    if (!best || !rng.chance(fac.overlord ? 0.4 : 0.9)) break;
    claimed.add(best.node);
    const group = idle.filter(x => x.dist[best!.node] !== undefined && x.dist[best!.node] <= reach).sort((x, y) => x.dist[best!.node] - y.dist[best!.node]);
    let sum = 0;
    for (const it of group) {
      if (sum >= best.def * 1.6) break;
      sum += it.power;
      idle.splice(idle.indexOf(it), 1);
      orders.push({ id: id(), kind: 'army', army: it.a.id, order: best.node === it.a.location ? { kind: 'siege', target: best.node, assault: sum > best.def * 1.5 } : { kind: 'move', target: best.node, attack: true } });
    }
  }
  // 余者：在敌境则回驻地
  for (const it of idle) {
    if (it.a.order.kind === 'hold' && it.here && !friendly(s, it.here.controller, f) && capNode && s.cities[capNode]?.controller === f) {
      orders.push({ id: id(), kind: 'army', army: it.a.id, order: { kind: 'move', target: capNode, attack: false } });
    }
  }
  // 裁兵：府库连一个月的驻军饷银都发不出、又非边城（邻城无敌城、两站内无敌军），裁去多余驻军（留足守兵的两倍）
  for (const c of citiesOf(s, f)) {
    if (s.sieges[c.id] || danger.some(d => d.node === c.id)) continue;
    if (c.silver >= c.garrison * SILVER_PER_SOLDIER) continue;
    const nb = neighbors(c.id).map(n => n.to);
    const nb2 = new Set([...nb, ...nb.flatMap(n => neighbors(n).map(x => x.to))]);
    if (nb.some(n => s.cities[n] && hostile(s, f, s.cities[n].controller)) || Object.values(s.armies).some(a => hostile(s, f, a.faction) && nb2.has(a.location))) continue;
    const extra = Math.floor((c.garrison - keepOf(s, f, c.id) * 2) / 500) * 500;
    if (extra >= 1000 && extra <= c.garrison - 500) orders.push({ id: id(), kind: 'disband', node: c.id, troops: extra });
  }
  // 募兵：都城、受威胁之城，以及钱粮宽裕而驻军单薄的城
  const soldiers = armiesOf(s, f).reduce((sum, a) => sum + a.troops, 0) + citiesOf(s, f).reduce((m, c) => m + c.garrison, 0);
  const cityCount = citiesOf(s, f).length;
  const capWant = 30000 + cityCount * 6000;
  const urgent = new Set<string>([capNode, ...danger.map(d => d.node)]);
  for (const c of citiesOf(s, f)) {
    if (s.sieges[c.id]) continue;
    const thin = c.garrison < 2500 + c.pop * 120;
    if (!urgent.has(c.id) && !thin) continue;
    if (soldiers > capWant && !danger.some(d => d.node === c.id)) continue;
    const grainOk = Math.floor((c.grain / 8) / GRAIN_PER_SOLDIER / 100) * 100;
    const want = Math.min(maxRecruit(c, s), Math.floor(c.silver * 0.3 / RECRUIT_SILVER / 100) * 100, grainOk);
    if (want >= 500) orders.push({ id: id(), kind: 'recruit', node: c.id, troops: want });
  }
  return orders;
}

/** 大顺新败之余，部众逐月离散（至乙酉春）；清军收编降卒（史实：绿营多出明朝降兵）。
 *  收编不是白来的（2026-11-27 玩家问：军队随年限自己扩充，合理吗）：只在近一年新取之地（两站之内有一年半内归清之城）才有降卒可收，
 *  每人给编练银（募兵之半）、由粮台支出，粮台无银便收不成；欠饷、缺粮之军不收；每军至多五万；玩家一方不在此列（玩家要募兵）。 */
export function aiAttrition(s: GameState) {
  if (s.turn <= 10) for (const a of Object.values(s.armies)) if (a.faction === 'shun' && a.faction !== s.player) a.troops = Math.round(a.troops * 0.97);
  const fresh = (id: string) => { const c = s.cities[id]; return !!c && topOf(s, c.controller) === 'qing' && c.takenTurn !== undefined && s.turn - c.takenTurn <= 18; };
  for (const a of Object.values(s.armies).sort((x, y) => x.id.localeCompare(y.id))) {
    if (topOf(s, a.faction) !== 'qing' || a.faction === s.player || topOf(s, a.faction) === s.player || a.hunger > 0 || (a.unpaid ?? 0) > 1 || a.troops >= 50000) continue;
    if (!fresh(a.location) && !neighbors(a.location).some(nb => fresh(nb.to) || neighbors(nb.to).some(x => fresh(x.to)))) continue;
    const sup = s.cities[a.supply];
    const add = Math.min(50000 - a.troops, Math.round(a.troops * 0.03 + 200));
    const cost = Math.round(add * RECRUIT_SILVER / 2);
    if (!sup || add <= 0 || sup.silver < cost) continue;
    sup.silver -= cost;
    s.ledger.push({ turn: s.turn, node: sup.id, field: 'silver', delta: -cost, text: `${a.name}收编降卒 ${add} 人`, src: { kind: 'order', ref: 'absorb:' + a.id } });
    a.troops += add;
  }
}

/** 电脑扩军：都城驻军充裕时编成新军，交给闲置将领；敌在海岛而无水师时，把港口里的一支军队改练水师 */
export function aiRaiseArmies(s: GameState) {
  // 残兵不足三百，就地遣散
  for (const a of Object.values(s.armies)) if (a.troops < 300 && a.faction !== s.player) disband(s, a);
  for (const f of Object.values(s.factions)) {
    if (f.id === s.player || f.defunct || f.overlord === s.player || ['local', 'helan'].includes(f.id)) continue;
    if (armiesOf(s, f.id).some(a => a.mix.navy >= 0.3)) continue;
    const island = Object.values(s.cities).some(c => hostile(s, f.id, c.controller) && ['zhoushan', 'dayuan', 'qiongzhou'].includes(c.id));
    if (!island) continue;
    const a = armiesOf(s, f.id).find(x => x.progress === 0 && NODE[x.location]?.kind === 'port' && s.cities[x.location]?.controller === f.id && x.troops >= 8000);
    if (a) { a.mix = { inf: 0.4, cav: 0, gun: 0.2, navy: 0.4 }; a.name = a.name.replace(/部$|军$/, '') + '水师'; report(s, { cat: '军报', node: a.location, text: `${f.name}在${nodeName(a.location)}改练水师，以图海上。`, faction: f.id === s.player ? undefined : f.id }); }
  }
  for (const f of Object.values(s.factions)) {
    if (f.id === s.player || f.defunct || f.overlord === s.player || f.id === 'local' || f.id === 'helan') continue;
    const keep = 15000;
    // 驻军最多的城（通常是都城）编成新军
    const mainland = citiesOf(s, f.id).filter(c => !s.sieges[c.id]).sort((a, b) => b.garrison - a.garrison);
    const needFleet = !armiesOf(s, f.id).some(a => a.mix.navy >= 0.3) && Object.values(s.cities).some(c => hostile(s, f.id, c.controller) && ['zhoushan', 'dayuan', 'qiongzhou', 'xiamen'].includes(c.id));
    const cap = (needFleet ? mainland.find(c => NODE[c.id].kind === 'port' && c.garrison >= 27000) : undefined) ?? mainland[0];
    if (!cap || cap.garrison < keep + 12000) continue;
    const leading = new Set(Object.values(s.armies).map(a => a.commander));
    const govs = new Set(Object.values(s.cities).map(c => c.governor));
    const pool = Object.values(s.chars).filter(c => c.faction === f.id && c.status === 'active' && !leading.has(c.id) && c.id !== f.leader && !c.royal && c.ab.tong >= 45 && !s.missions.some(m => (m.order as any).char === c.id));
    const cmd = pool.filter(c => !govs.has(c.id)).sort((x, y) => y.ab.tong - x.ab.tong)[0] ?? pool.sort((x, y) => y.ab.tong - x.ab.tong)[0];
    if (cmd) for (const c of Object.values(s.cities)) if (c.governor === cmd.id) delete c.governor;
    if (!cmd) continue;
    const troops = Math.min(40000, cap.garrison - keep);
    const id = `a_${f.id}_${s.nextId++}`;
    // 敌城只能渡海而至（海岛）时，在港口编练水师
    const { dist: land } = distancesFrom(cap.id, false);
    const islandFoe = Object.values(s.cities).some(c => hostile(s, f.id, c.controller) && land[c.id] === undefined);
    const navy = islandFoe && NODE[cap.id].kind === 'port' && !armiesOf(s, f.id).some(a => a.mix.navy >= 0.3);
    s.armies[id] = { id, name: `${cmd.name}${navy ? '水师' : '部'}`, faction: f.id, commander: cmd.id, troops,
      mix: navy ? { inf: 0.4, cav: 0, gun: 0.2, navy: 0.4 } : f.id === 'qing' ? { inf: 0.45, cav: 0.4, gun: 0.15, navy: 0 } : { inf: 0.7, cav: 0.2, gun: 0.1, navy: 0 },
      morale: 65, location: cap.id, path: [], progress: 0, order: { kind: 'hold' }, supply: cap.id, hunger: 0 };
    cap.garrison -= troops;
    cmd.location = cap.id;
    s.ledger.push({ turn: s.turn, node: cap.id, field: 'garrison', delta: -troops, text: `编成${cmd.name}部出征`, src: { kind: 'order', ref: id } });
  }
}

/** 新收城池补给：电脑把军队粮台改到最近的己方城 */
export function aiFixSupply(s: GameState) {
  for (const a of Object.values(s.armies)) {
    if (a.faction === s.player) continue;
    const sup = s.cities[a.supply];
    // 粮够、且不久欠饷（或粮台银两尚足）则不动；久欠饷而粮台无银，也照玩家同一规矩另择粮台
    const broke = (a.unpaid ?? 0) >= 2 && (sup?.silver ?? 0) < a.troops;
    const ok = sup && sameTop(s, sup.controller, a.faction) && sup.grain > a.troops * 0.6 && !broke;
    if (ok) continue;
    const lord = s.factions[a.faction]?.overlord;
    const ownCities = Object.values(s.cities).filter(c => c.controller === a.faction && c.grain > a.troops * 0.6);
    // 无城可依的下属军镇，就近向上级的城池索粮
    const pool = ownCities.length || !lord ? ownCities : Object.values(s.cities).filter(c => c.controller === lord && c.grain > a.troops * 1.2);
    // 与玩家同一换台条件：未被敌围、粮道可通；久欠饷者先找有银的城
    const usable = pool.filter(c => !supplyChoiceError(s, a, c.id));
    const rich = broke ? usable.filter(c => c.silver >= a.troops * 2) : [];
    const best = (rich.length ? rich : usable)
      .map(c => ({ c, p: shortestPath(a.location, c.id, true) })).filter(x => x.p)
      .sort((x, y) => (pathDays(a.location, x.p!) - x.c.grain / 20000 - x.c.silver / 10000) - (pathDays(a.location, y.p!) - y.c.grain / 20000 - y.c.silver / 10000))[0];
    if (best && !ownCities.length && lord === s.player && best.c.id !== a.supply) {
      report(s, { cat: '急报', urgent: true, node: best.c.id, text: `${a.name}已无城可依，改向${nodeName(best.c.id)}支粮，每月约 ${Math.round(a.troops * GRAIN_PER_SOLDIER)} 石。可另拨钱粮，或令其移驻。`, src: { kind: 'upkeep', ref: a.id } });
    }
    if (best) a.supply = best.c.id;
  }
}

/** 电脑补饷：军队久欠饷而本方别城有余银，照调拨的规矩（粮道可通、不出被围之城）运银到粮台 */
export function aiPayArmies(s: GameState) {
  for (const a of Object.values(s.armies).sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.faction === s.player || (a.unpaid ?? 0) < 1) continue;
    const sup = s.cities[a.supply];
    if (!sup || sup.controller !== a.faction) continue;
    const need = Math.round(a.troops * SILVER_PER_FIELD_SOLDIER * 3) + (a.arrears ?? 0);
    if (sup.silver >= need) continue;
    const donor = Object.values(s.cities).filter(c => c.controller === a.faction && c.id !== sup.id && !s.sieges[c.id] && c.silver > need + c.garrison * 2 && !supplyBlock(s, a.faction, c.id, sup.id))
      .sort((x, y) => y.silver - x.silver)[0];
    if (!donor) continue;
    const amt = Math.round(need - Math.max(0, sup.silver));
    donor.silver -= amt; sup.silver += amt;
    s.ledger.push({ turn: s.turn, node: donor.id, field: 'silver', delta: -amt, text: `调银往${nodeName(sup.id)}发${a.name}饷`, src: { kind: 'order', ref: 'aipay:' + a.id } });
    s.ledger.push({ turn: s.turn, node: sup.id, field: 'silver', delta: amt, text: `自${nodeName(donor.id)}调来饷银`, src: { kind: 'order', ref: 'aipay:' + a.id } });
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
      report(s, { cat: '易主', act: 'join', from: f.id, to: 'qing', urgent: true, node: f.capital,
        text: `${leader.name}率${f.name}正式归附清朝。其所据${citiesOf(s, f.id).map(c => nodeName(c.id)).join('、') || '营伍'}一体改奉清朝，实控者不变。（降意 ${leader.att.surrender}，服从度 ${f.loyalty}）`,
        src: { kind: 'diplomacy', ref: 'defect:' + f.id } });
    }
  }
}

/** 电脑宣战：清廷决意南下之后，与之接壤而未交战的势力一并视为敌国 */
export function aiDiplomacy(s: GameState) {
  if (s.flags.qing_south === undefined || s.player === 'qing') return;
  for (const f of Object.values(s.factions)) {
    if (f.defunct || f.id === 'qing' || f.id === 'helan' || topOf(s, f.id) === 'qing' || stance(s, 'qing', f.id) !== 'neutral') continue;
    const touching = citiesOf(s, f.id).some(c => neighbors(c.id).some(nb => topOf(s, s.cities[nb.to]?.controller ?? '') === 'qing'));
    if (!touching || f.overlord) continue;
    setStance(s, 'qing', f.id, 'war');
    report(s, { cat: '军报', urgent: f.id === s.player, text: `清廷视${f.name}为敌，两家交兵。`, node: f.capital });
  }
}


/* ================= 主动出手（2026-11-27）：守城出击、会集出征、乘虚翻脸、暗中劝降 ================= */

/** 不由电脑自主行事的势力：玩家、玩家的下属、地方豪强、荷兰 */
const passive = (s: GameState, f: string) => !s.factions[f] || s.factions[f].defunct || f === s.player || s.factions[f].overlord === s.player || f === 'local' || f === 'helan';

/** 统兵之人：本方闲着的武将（统军四十以上、不在出使）优先；没有就由本城主官领兵；再没有就从本地拔一位营将 */
function pickLeader(s: GameState, f: string, node: string, allowGovernor: boolean): string {
  const leading = new Set(Object.values(s.armies).map(a => a.commander));
  const govs = new Set(Object.values(s.cities).map(c => c.governor));
  const busy = (id: string) => leading.has(id) || s.missions.some(m => (m.order as { char?: string }).char === id);
  const free = Object.values(s.chars).filter(c => c.faction === f && c.status === 'active' && !c.royal && c.id !== s.factions[f].leader && !busy(c.id) && !govs.has(c.id) && c.ab.tong >= 40)
    .sort((x, y) => (x.location === node ? 0 : 1) - (y.location === node ? 0 : 1) || y.ab.tong - x.ab.tong)[0];
  if (free) return free.id;
  const gov = s.cities[node]?.governor;
  if (allowGovernor && gov && s.chars[gov]?.status === 'active' && !busy(gov)) return gov;
  const rng = rngFor(s.seed, 'leader', s.turn, node);
  const ch = genLocal(s, f, node, rng, s.cities[node]?.edu ?? 50);
  ch.title = '守备'; ch.ab.tong = Math.max(ch.ab.tong, 42 + Math.floor(rng.next() * 16)); ch.bio = `${nodeName(node)}营将，以守土有功擢守备，统兵出战。`;
  s.chars[ch.id] = ch;
  return ch.id;
}
function newArmy(s: GameState, f: string, node: string, cmd: string, troops: number, name: string): Army {
  const id = `a_${f}_${s.nextId++}`;
  const mix = f === 'qing' ? { inf: 0.45, cav: 0.4, gun: 0.15, navy: 0 } : { inf: 0.7, cav: 0.18, gun: 0.12, navy: 0 };
  const a: Army = { id, name, faction: f, commander: cmd, troops, mix, morale: 62, location: node, path: [], progress: 0, order: { kind: 'hold' }, supply: node, hunger: 0 };
  s.armies[id] = a;
  if (s.chars[cmd]) s.chars[cmd].location = node;
  return a;
}
/** 本城至少要留的守兵：人口越多留得越多；邻近有敌军则再按敌势加留 */
function keepOf(s: GameState, f: string, node: string): number {
  const c = s.cities[node];
  const foe = Object.values(s.armies).filter(a => hostile(s, a.faction, f) && (a.location === node || neighbors(node).some(nb => nb.to === a.location))).reduce((n, a) => n + armyPower(a, s), 0);
  return Math.max(1500 + c.pop * 50, Math.min(c.garrison, foe / (1 + c.wall / 60)));
}

/** 守城出击：被围之城的守军（减去留守）比围城之军强，守将开门出城，与围城之军野战（下一步行军时两军相遇即战）。
 *  出城之兵记作“出城”，战罢回城（aiRegarrison） */
export function aiSorties(s: GameState) {
  for (const [node, sg] of Object.entries(s.sieges).sort(([a], [b]) => a.localeCompare(b))) {
    const c = s.cities[node];
    if (!c || passive(s, c.controller)) continue;
    const f = c.controller;
    if (Object.values(s.armies).some(a => a.location === node && a.faction === f && a.progress === 0)) continue;   // 城中有野战军，自会与围城之军交战
    const besiegers = sg.armies.map(id => s.armies[id]).filter(a => a && a.location === node && a.progress === 0 && hostile(s, a.faction, f));
    if (!besiegers.length) continue;
    const bp = besiegers.reduce((n, a) => n + armyPower(a, s), 0);
    const spare = c.garrison - Math.max(1000, Math.round(c.garrison * 0.2));
    const gov = c.governor ? s.chars[c.governor] : undefined;
    const tong = gov?.ab.tong ?? 45;
    // 出城之兵（士气按民心折算）须与围城之军相当；守将越能战越敢出（统七十者九成即出，统四十者须一倍二）
    const mine = spare * (0.5 + Math.min(80, c.minxin + 10) / 200) * (0.8 + tong / 250);
    const need = bp * (1.35 - tong / 200);
    if (spare < 2000 || mine < need) continue;
    // 优势越大越肯出城（相当时约四成，强出一半以上几乎必出）
    if (!rngFor(s.seed, 'sortie', s.turn, node).chance(Math.min(0.95, 0.4 + (mine / need - 1)))) continue;
    const cmd = pickLeader(s, f, node, true);
    const a = newArmy(s, f, node, cmd, spare, `${nodeName(node)}出城兵`);
    a.morale = Math.round(Math.max(45, Math.min(80, c.minxin + 15)));
    a.sortie = true;
    c.garrison -= spare;
    s.ledger.push({ turn: s.turn, node, field: 'garrison', delta: -spare, text: `守军出城迎战`, src: { kind: 'order', ref: a.id } });
    const vsPlayer = besiegers.some(b => topOf(s, b.faction) === topOf(s, s.player));
    report(s, { cat: vsPlayer ? '急报' : '军报', urgent: vsPlayer, node, act: 'march', from: f,
      text: `${nodeName(node)}守将${charName0(s, cmd)}开门出城，率 ${Math.round(spare / 100) * 100} 人冲击${besiegers.map(b => b.name).join('、')}的围城营垒！`,
      faction: vsPlayer ? undefined : f, src: { kind: 'order', ref: a.id } });
  }
}
const charName0 = (s: GameState, id: string) => s.chars[id]?.name ?? '守将';

/** 出城之兵战罢回城：围已解、或已在本方城中而近处无敌，就并回驻军 */
export function aiRegarrison(s: GameState) {
  for (const a of Object.values(s.armies)) {
    if (!a.sortie || a.faction === s.player || a.progress > 0) continue;
    const c = s.cities[a.location];
    if (!c || !friendly(s, c.controller, a.faction)) continue;
    const foe = Object.values(s.armies).some(x => hostile(s, x.faction, a.faction) && x.location === a.location);
    if (foe) continue;
    c.garrison += a.troops;
    s.ledger.push({ turn: s.turn, node: c.id, field: 'garrison', delta: a.troops, text: `出城之兵回城`, src: { kind: 'order', ref: a.id } });
    delete s.armies[a.id];
  }
}

/** 会集出征：各城驻军有余，邻近（陆路十五日内）有空虚的敌城，就从附近几城抽兵，会于一城，择将出征。
 *  “各省明官府”这类只有驻军、没有野战军的势力，靠这个才会反攻（史实：曾英复重庆、杨展败西军于江口）。每家每月至多一次。 */
export function aiMusters(s: GameState) {
  for (const f of Object.keys(s.factions).sort()) {
    if (passive(s, f)) continue;
    const mine = citiesOf(s, f);
    if (!mine.length) continue;
    const field = armiesOf(s, f).filter(a => !a.sortie).length;
    if (field >= Math.max(2, Math.ceil(mine.length / 6))) continue;
    if (!cooledFlag(s, 'muster_' + f, 2)) continue;
    const spareOf = (id: string) => s.sieges[id] ? 0 : Math.max(0, s.cities[id].garrison - keepOf(s, f, id));
    let best: { at: string; target: string; need: number; donors: { id: string; n: number }[]; score: number } | null = null;
    for (const c of mine) {
      if (spareOf(c.id) < 1500) continue;
      const { dist } = distancesFrom(c.id, false);
      // 附近可抽兵之城（十日内）
      const pool = mine.filter(x => dist[x.id] !== undefined && dist[x.id] <= 10).map(x => ({ id: x.id, n: spareOf(x.id) })).filter(x => x.n >= 800).sort((x, y) => (x.id === c.id ? -1 : y.id === c.id ? 1 : dist[x.id] - dist[y.id]));
      const avail = pool.reduce((n, x) => n + x.n, 0);
      for (const { to: t } of neighbors(c.id)) {
        const tc = s.cities[t];
        if (!tc || !hostile(s, f, tc.controller) || tc.controller === 'helan' || dist[t] === undefined || dist[t] > 15) continue;
        if (areaWeight(s, f, NODE[t].area) <= 0 && !(topOf(s, tc.controller) === topOf(s, s.player))) continue;
        const foeArmy = Object.values(s.armies).filter(x => x.location === t && hostile(s, f, x.faction)).reduce((n, x) => n + armyPower(x, s), 0);
        const need = Math.round(holdStrength(s, t) * 1.6 + foeArmy * 1.3 + 1500);
        if (avail < need) continue;
        const score = cityValue(s, t) / (dist[t] + 5) * (avail / need);
        if (!best || score > best.score) {
          let left = need; const donors: { id: string; n: number }[] = [];
          for (const x of pool) { if (left <= 0) break; const n = Math.min(x.n, left); donors.push({ id: x.id, n }); left -= n; }
          best = { at: c.id, target: t, need, donors, score };
        }
      }
    }
    if (!best) continue;
    const hawk = s.chars[s.factions[f].leader]?.att.hawk ?? 30;
    if (!rngFor(s.seed, 'muster', s.turn, f).chance(Math.min(0.85, 0.45 + hawk / 150))) continue;
    s.flags['muster_' + f] = s.turn;
    const total = best.donors.reduce((n, d) => n + d.n, 0);
    for (const d of best.donors) {
      s.cities[d.id].garrison -= d.n;
      s.ledger.push({ turn: s.turn, node: d.id, field: 'garrison', delta: -d.n, text: d.id === best.at ? `会集出征` : `抽兵会于${nodeName(best.at)}`, src: { kind: 'order', ref: 'muster:' + f } });
    }
    const cmd = pickLeader(s, f, best.at, false);
    const a = newArmy(s, f, best.at, cmd, total, `${charName0(s, cmd)}部`);
    a.order = { kind: 'move', target: best.target, attack: true };
    const path = shortestPath(best.at, best.target, false);
    if (path) a.path = path;
    const tgt = s.cities[best.target];
    const vsPlayer = topOf(s, tgt.controller) === topOf(s, s.player);
    const from = best.donors.map(d => nodeName(d.id)).join('、');
    report(s, { cat: vsPlayer ? '急报' : '军报', urgent: vsPlayer, node: best.target, origin: best.at, act: 'march', from: f,
      text: `${s.factions[f].name}会集${from}兵马 ${Math.round(total / 100) * 100} 人，由${charName0(s, cmd)}统领，出${nodeName(best.at)}来攻${nodeName(best.target)}！${vsPlayer ? `（${nodeName(best.target)}现有守军 ${tgt.garrison}）` : ''}`,
      faction: vsPlayer ? undefined : f, src: { kind: 'order', ref: a.id } });
  }
}
const cooledFlag = (s: GameState, key: string, months: number) => s.turn - Number(s.flags[key] ?? -999) >= months;

/** 乘虚翻脸：与玩家相安（中立）的邻家，主将好战，见玩家边城空虚而己方近处兵多（三倍以上），便宣战来攻。
 *  停战、结盟、通好期内不翻脸；每家一年至多一回；先有急报，好让玩家补防 */
export function aiOpportunism(s: GameState) {
  const P = s.player;
  if (!s.factions[P] || s.factions[P].defunct) return;
  const pTop = topOf(s, P);
  for (const f of Object.keys(s.factions).sort()) {
    if (passive(s, f) || topOf(s, f) === pTop || s.factions[f].overlord) continue;
    if (stance(s, f, P) !== 'neutral' || s.relations[[f, P].sort().join('|')]?.until !== undefined) continue;
    if (!cooledFlag(s, 'opp_' + f, 12)) continue;
    const hawk = s.chars[s.factions[f].leader]?.att.hawk ?? 0;
    if (hawk < 35) continue;
    // 玩家边城：与此家之城或军队相邻
    let weakest: { node: string; ratio: number } | null = null;
    for (const c of Object.values(s.cities)) {
      if (topOf(s, c.controller) !== pTop) continue;
      const nb = neighbors(c.id).map(n => n.to);
      const force = Object.values(s.armies).filter(a => a.faction === f && a.progress === 0 && (nb.includes(a.location) || a.location === c.id)).reduce((n, a) => n + armyPower(a, s), 0)
        + nb.filter(n => s.cities[n]?.controller === f).reduce((m, n) => m + s.cities[n].garrison * 0.5, 0);
      if (!force) continue;
      const ratio = force / Math.max(500, holdStrength(s, c.id));
      if (!weakest || ratio > weakest.ratio) weakest = { node: c.id, ratio };
    }
    if (!weakest || weakest.ratio < 3) continue;
    if (!rngFor(s.seed, 'opp', s.turn, f).chance(Math.min(0.6, (hawk - 25) / 100))) continue;
    s.flags['opp_' + f] = s.turn;
    setStance(s, f, P, 'war');
    report(s, { cat: '急报', urgent: true, node: weakest.node, origin: s.factions[f].capital,
      text: `${s.factions[f].name}见${nodeName(weakest.node)}守备空虚，背盟翻脸，宣战来攻！${nodeName(weakest.node)}守军仅 ${s.cities[weakest.node].garrison}，宜速增援。`,
      src: { kind: 'diplomacy', ref: 'opp:' + f } });
  }
}

/** 暗中劝降：敌军压境、而守将降意高或城中人心离散的玩家之城，邻家遣能言之士潜往劝降（与玩家劝降同一套成算，跨月回报）。
 *  谍报有时能探知，给玩家换将、增兵、安民的余地 */
export function aiIntrigue(s: GameState) {
  const P = s.player, pTop = topOf(s, P);
  if (!s.factions[P] || s.factions[P].defunct) return;
  // 一个阵营（宗主连同下属）三个月至多一回，同一座城半年内只遣一回
  const blocs = [...new Set(Object.keys(s.factions).filter(f => !passive(s, f)).map(f => topOf(s, f)))].filter(b => b !== pTop).sort();
  for (const bloc of blocs) {
    if (!cooledFlag(s, 'intrigue_' + bloc, 3)) continue;
    const members = Object.keys(s.factions).filter(f => !passive(s, f) && topOf(s, f) === bloc);
    let best: { f: string; env: string; node: string; p: number } | null = null;
    for (const c of Object.values(s.cities)) {
      if (topOf(s, c.controller) !== pTop || !hostile(s, bloc, c.controller) || !cooledFlag(s, 'intr_at_' + c.id, 6)) continue;
      if (s.missions.some(m => m.order.kind === 'persuade' && m.order.node === c.id)) continue;
      // 只对近处之城下手：本阵营的城或军队就在邻近
      const nb = [c.id, ...neighbors(c.id).map(n => n.to)];
      const f = members.find(m => nb.some(n => s.cities[n]?.controller === m) || Object.values(s.armies).some(a => a.faction === m && nb.includes(a.location)));
      if (!f) continue;
      const env = Object.values(s.chars).filter(ch => ch.faction === f && ch.status === 'active' && ch.ab.wai >= 50 && ch.id !== s.factions[f].leader && !Object.values(s.armies).some(a => a.commander === ch.id) && !s.missions.some(m => (m.order as { char?: string }).char === ch.id))
        .sort((x, y) => y.ab.wai - x.ab.wai)[0];
      if (!env) continue;
      const { p } = persuadeChance(s, f, env.id, c.id);
      if (p >= 0.3 && (!best || p > best.p)) best = { f, env: env.id, node: c.id, p };
    }
    if (!best) continue;
    const o = { id: `ai-intr-${best.f}-${s.turn}`, kind: 'persuade' as const, char: best.env, node: best.node };
    if (validateOrder(s, best.f, o)) continue;
    s.flags['intrigue_' + bloc] = s.turn; s.flags['intr_at_' + best.node] = s.turn;
    applyOrder(s, best.f, o);
    if (rngFor(s.seed, 'intel', s.turn, best.f).chance(0.6)) report(s, { cat: '急报', urgent: true, node: best.node, origin: s.factions[best.f].capital,
      text: `【谍报】探得${s.factions[best.f].name}遣${s.chars[best.env].name}潜赴${nodeName(best.node)}，欲劝守将献城。可换守将、增兵或安抚民心以防。`, src: { kind: 'diplomacy', ref: o.id } });
  }
}

/** 电脑的军略：驰援被围之城则急行；大顺、大西之军围攻敌城时纵兵抄掠（流动作战，就粮于敌）；
 * 驻扎而邻近有敌军者坚守营垒。玩家之军不动。 */
export function aiConduct(s: GameState) {
  for (const a of Object.values(s.armies)) {
    if (topOf(s, a.faction) === s.player || a.sortie) continue;
    const o = a.order;
    const tgt = o.kind !== 'hold' ? s.cities[o.target] : undefined;
    const rescue = o.kind === 'move' && !!tgt && !!s.sieges[tgt.id] && topOf(s, tgt.controller) === topOf(s, a.faction);
    if (rescue && a.morale >= 45) a.pace = 'forced'; else delete a.pace;
    const pol = s.factions[a.faction]?.polity;
    const here = s.cities[a.location];
    if ((pol === 'shun' || pol === 'xi') && o.kind === 'siege' && here && hostile(s, a.faction, here.controller)) a.forage = 'plunder'; else delete a.forage;
    const threat = o.kind === 'hold' && a.path.length === 0 && Object.values(s.armies).some(b => hostile(s, a.faction, b.faction) && b.troops >= a.troops * 0.6 && (b.location === a.location || neighbors(a.location).some(n => n.to === b.location)));
    if (threat) a.camp = true; else delete a.camp;
  }
}
