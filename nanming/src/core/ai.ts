/* 电脑行为：规则 + 随时间变化的战略倾向。倾向只定大方向，用兵仍看局势。 */
import type { Army, ArmyOrder, GameState, Order } from './types';
import { armiesOf, armyPower, cityDefense, hostile, friendly, topOf, report, nodeName, adjustAtt, citiesOf, stance, setStance } from './state';
import { shortestPath, pathDays, neighbors, distancesFrom, NODE } from '../data/geography';
import { canSea } from './military';
import { maxRecruit } from './orders';
import { defectFaction, disband } from './military';
import { RECRUIT_SILVER } from './economy';
import { rngFor } from './rng';

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

function canTake(s: GameState, a: Army, node: string): boolean {
  const c = s.cities[node];
  if (!c) return false;
  if (!hostile(s, a.faction, c.controller)) return false;
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
    const power = armyPower(a, s);
    const sea = canSea(a);
    // 已在围城：继续
    if (a.order.kind === 'siege' && s.sieges[a.order.target] && a.location === a.order.target) {
      const city = s.cities[a.order.target];
      const ratio = power / Math.max(1, cityDefense(city));
      const months = s.sieges[a.order.target].months;
      // 兵少粮尽：解围回城休整
      const besiegers = s.sieges[a.order.target].armies.map(x => s.armies[x]).filter(Boolean).reduce((m, x) => m + armyPower(x, s), 0);
      if (besiegers < cityDefense(city) * 0.45 || (a.hunger >= 2 && ratio < 1)) {
        const { dist } = distancesFrom(a.location, canSea(a));
        const back = citiesOf(s, f).map(c => c.id).filter(c => dist[c] !== undefined).sort((x, y) => dist[x] - dist[y])[0];
        if (back) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: back, attack: false } }); continue; }
      }
      const assault = ratio > 1.2 || city.wall < 45 || (months >= 3 && ratio > 0.9);
      orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'siege', target: a.order.target, assault } });
      continue;
    }
    // 下属军镇：被玩家号令时不自作主张
    if (underPlayer && a.order.kind !== 'hold' && a.path.length) continue;
    // 断粮：回粮台
    if (a.hunger > 0 && a.location !== a.supply) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: a.supply, attack: false } }); continue; }
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
    // 补员：在本方城中抽驻军补足；兵少则先回大城休整
    if (here && here.controller === f && a.troops < 24000 && here.garrison > 6000 && !s.sieges[here.id]) {
      const take = Math.min(here.garrison - 4000, 30000 - a.troops);
      if (take >= 1000) { orders.push({ id: id(), kind: 'reinforce', node: here.id, army: a.id, troops: -take }); continue; }
    }
    if (a.troops < 6000) {
      const depot = citiesOf(s, f).filter(c => c.garrison > 12000 && dist[c.id] !== undefined && c.id !== a.location).sort((x, y) => dist[x.id] - dist[y.id])[0];
      if (depot) { orders.push({ id: id(), kind: 'army', army: a.id, order: { kind: 'move', target: depot.id, attack: false } }); continue; }
    }
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
    // 战略倾向（史实开局）
    const targets = doctrineTargets(s, a).filter(t => canTake(s, a, t));
    if (targets.length) {
      const t = targets[0];
      const order: ArmyOrder = a.location === t ? { kind: 'siege', target: t, assault: power > cityDefense(s.cities[t]) * 1.6 } : { kind: 'move', target: t, attack: true };
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
      const def = cityDefense(c) + Object.values(s.armies).filter(x => x.location === node && x.progress === 0 && sameTop(s, x.faction, c.controller)).reduce((m, x) => m + armyPower(x, s), 0);
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
      orders.push({ id: id(), kind: 'army', army: it.a.id, order: best.node === it.a.location ? { kind: 'siege', target: best.node, assault: sum > best.def * 1.3 } : { kind: 'move', target: best.node, attack: true } });
    }
  }
  // 余者：在敌境则回驻地
  for (const it of idle) {
    if (it.a.order.kind === 'hold' && it.here && !friendly(s, it.here.controller, f) && capNode && s.cities[capNode]?.controller === f) {
      orders.push({ id: id(), kind: 'army', army: it.a.id, order: { kind: 'move', target: capNode, attack: false } });
    }
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
    const grainOk = Math.floor((c.grain / 8) / 0.25 / 100) * 100;
    const want = Math.min(maxRecruit(c), Math.floor(c.silver * 0.3 / RECRUIT_SILVER / 100) * 100, grainOk);
    if (want >= 500) orders.push({ id: id(), kind: 'recruit', node: c.id, troops: want });
  }
  return orders;
}

/** 大顺新败之余，部众逐月离散（至乙酉春）；清军沿途收编降卒，在本方地面的野战军逐月补充 */
export function aiAttrition(s: GameState) {
  if (s.turn <= 10) for (const a of Object.values(s.armies)) if (a.faction === 'shun' && a.faction !== s.player) a.troops = Math.round(a.troops * 0.97);
  for (const a of Object.values(s.armies)) {
    if (topOf(s, a.faction) !== 'qing' || a.hunger > 0 || a.troops >= 50000) continue;
    const here = s.cities[a.location];
    const onOwn = here ? topOf(s, here.controller) === 'qing' : false;
    const near = onOwn || neighbors(a.location).some(nb => topOf(s, s.cities[nb.to]?.controller ?? '') === 'qing');
    if (near) a.troops = Math.min(50000, Math.round(a.troops * 1.03 + 200));
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
    if (cmd) for (const c of Object.values(s.cities)) if (c.governor === cmd.id) c.governor = undefined;
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
    const ok = sup && sameTop(s, sup.controller, a.faction) && sup.grain > a.troops * 0.6;
    if (ok) continue;
    const lord = s.factions[a.faction]?.overlord;
    const ownCities = Object.values(s.cities).filter(c => c.controller === a.faction && c.grain > a.troops * 0.6);
    // 无城可依的下属军镇，就近向上级的城池索粮
    const pool = ownCities.length || !lord ? ownCities : Object.values(s.cities).filter(c => c.controller === lord && c.grain > a.troops * 1.2);
    const best = pool
      .map(c => ({ c, p: shortestPath(a.location, c.id, true) })).filter(x => x.p)
      .sort((x, y) => (pathDays(a.location, x.p!) - x.c.grain / 20000) - (pathDays(a.location, y.p!) - y.c.grain / 20000))[0];
    if (best && !ownCities.length && lord === s.player && best.c.id !== a.supply) {
      report(s, { cat: '急报', urgent: true, node: best.c.id, text: `${a.name}已无城可依，改向${nodeName(best.c.id)}支粮，每月约 ${Math.round(a.troops * 0.25)} 石。可另拨钱粮，或令其移驻。`, src: { kind: 'upkeep', ref: a.id } });
    }
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
