/* 军事：行军（逐日推进）、遭遇、野战与攻城的战局构造、战后处置、易主。
 * 规则：野战失利只让城市失去屏障，只有陷城、献城、正式归附才改变控制权。 */
import { isRuler } from './regime';
import type { Army, ArmyOrder, GameState, NodeId } from './types';
import { NODE, routeBetween, shortestPath, neighbors } from '../data/geography';
import { armiesAt, friendly, hostile, report, nodeName, factionName, charName, troopsText, bump, newId, topOf, adjustAtt } from './state';
import { createBattle, makeSide, sideTroops, type BattleSide, type BattleState, type Weather, type Terrain, outcomeText, lossesOf } from './battle';
import { hasTrait } from './people';
import { rngFor } from './rng';
import { lunarOf } from './calendar';

export const canSea = (a: Army) => a.mix.navy >= 0.3;

export function setArmyOrder(s: GameState, a: Army, order: ArmyOrder): boolean {
  if (order.kind === 'hold') { a.order = order; if (a.progress === 0) a.path = []; else a.path = a.path.slice(0, 1); return true; }
  const start = a.progress > 0 && a.path.length ? a.path[0] : a.location;
  const p = shortestPath(start, order.target, canSea(a));
  if (p === null) return false;
  a.path = a.progress > 0 && a.path.length ? [a.path[0], ...p] : p;
  if (a.progress > 0 && a.path.length === 0) a.path = [start];
  a.order = order;
  return true;
}

export interface Contact { node: NodeId; arrivals: Record<string, number> }

/** 逐日推进本月行军。返回遭遇地点（敌对军队同处一地）。 */
export function moveArmies(s: GameState): Contact[] {
  const contacts = new Map<NodeId, Contact>();
  const arrivedDay: Record<string, number> = {};
  const stopped = new Set<string>();
  const armies = Object.values(s.armies).sort((x, y) => x.id.localeCompare(y.id));
  for (let day = 1; day <= 30; day++) {
    for (const a of armies) {
      if (!s.armies[a.id] || stopped.has(a.id) || a.path.length === 0) continue;
      const next = a.path[0];
      const r = routeBetween(a.location, next);
      if (!r) { a.path = []; a.progress = 0; continue; }
      // 已无船可乘：不能沿先前算好的海路走，就地改走陆路（与在此重新下令同一路线）
      if (a.progress === 0 && r.kind === 'sea' && !canSea(a)) {
        const tgt = a.order.kind !== 'hold' ? a.order.target : a.path[a.path.length - 1];
        const p = shortestPath(a.location, tgt, false);
        a.path = p ?? [];
        continue;
      }
      a.progress++;
      // 船走不了陆路：水师踏上陆路即舍舟登岸，船只留在岸边，水手改作步卒
      if (a.progress === 1 && r.kind === 'land' && a.mix.navy > 0) {
        const nv = a.mix.navy;
        a.mix = { ...a.mix, inf: a.mix.inf + nv, navy: 0 };
        if (a.name.endsWith('水师')) a.name = a.name.slice(0, -2) + '部';
        a.morale = Math.max(10, a.morale - 4);
        if (topOf(s, a.faction) === s.player) report(s, { cat: '军报', act: 'march', from: a.faction, node: a.location, text: `${a.name}行至${nodeName(a.location)}舍舟登岸，船只留泊，水师改为步卒。`, src: { kind: 'order', ref: a.id } });
        // 余程按步卒重算：此后不再走海路
        if (a.order.kind !== 'hold') { const rest = shortestPath(next, a.order.target, false); a.path = rest ? [next, ...rest] : [next]; }
      }
      if (a.progress < r.days) continue;
      a.location = next; a.path.shift(); a.progress = 0;
      arrivedDay[a.id] = day;
      const cmd = s.chars[a.commander]; if (cmd && cmd.status === 'active') cmd.location = next;
      const foes = armiesAt(s, next).filter(o => o.id !== a.id && hostile(s, a.faction, o.faction));
      if (foes.length) {
        a.path = [];
        stopped.add(a.id); foes.forEach(f => { stopped.add(f.id); f.path = []; f.progress = 0; });
        const c = contacts.get(next) ?? { node: next, arrivals: {} };
        c.arrivals[a.id] = day;
        contacts.set(next, c);
        continue;
      }
      const city = s.cities[next];
      if (city && hostile(s, a.faction, city.controller) && (city.garrison > 0 || next !== (a.order.kind !== 'hold' ? a.order.target : ''))) {
        // 敌城挡路：必须停下（攻城或绕行由下月命令决定）
        a.path = [];
        stopped.add(a.id);
      }
    }
  }
  for (const a of armies) {
    if (!s.armies[a.id]) continue;
    if (a.order.kind === 'move' && a.path.length === 0 && a.progress === 0) {
      const city = s.cities[a.location];
      if (a.order.attack && city && hostile(s, a.faction, city.controller)) {
        // 被途中敌城挡住：先攻此城，记住原定目标，拿下后接着去
        const then = a.order.target !== a.location ? a.order.target : undefined;
        // 玩家之军照令强攻；电脑之军量力：城下本方兵力不到守城之力（驻军连同城中之军，计城防）的一倍半，先围不攻
        const ours = topOf(s, a.faction) === s.player;
        const mine = armies.filter(x => s.armies[x.id] && x.location === a.location && x.faction === a.faction && x.progress === 0).reduce((n, x) => n + x.troops, 0);
        const inside = Object.values(s.armies).filter(x => x.location === a.location && x.progress === 0 && topOf(s, x.faction) === topOf(s, city.controller)).reduce((n, x) => n + x.troops, 0);
        const assault = ours || mine > (city.garrison + inside) * (1 + city.wall / 60) * 1.5 || city.wall < 30;
        a.order = then ? { kind: 'siege', target: a.location, assault, then } : { kind: 'siege', target: a.location, assault };
        if (then && topOf(s, a.faction) === s.player) report(s, { cat: '军报', act: 'march', from: a.faction, node: a.location, text: `${a.name}开往${nodeName(then)}，为${nodeName(a.location)}所阻，先攻${nodeName(a.location)}；拿下后接着开往${nodeName(then)}。`, src: { kind: 'order', ref: a.id } });
      }
      else if (a.location === a.order.target) a.order = { kind: 'hold' };
    }
  }
  // 同处一地的敌对军队（都未移动）也要交战
  const byNode = new Map<string, Army[]>();
  for (const a of Object.values(s.armies)) if (a.progress === 0) (byNode.get(a.location) ?? byNode.set(a.location, []).get(a.location)!).push(a);
  for (const [node, list] of byNode) {
    if (contacts.has(node)) continue;
    if (list.some((a, i) => list.some((b, j) => j > i && hostile(s, a.faction, b.faction)))) contacts.set(node, { node, arrivals: {} });
  }
  for (const c of contacts.values()) for (const a of armiesAt(s, c.node)) if (c.arrivals[a.id] === undefined) c.arrivals[a.id] = arrivedDay[a.id] ?? 0;
  return [...contacts.values()];
}

export function weatherFor(s: GameState, node: string): Weather {
  const m = lunarOf(s.turn).month;
  const rng = rngFor(s.seed, 'weather', s.turn, node);
  const rainy = m >= 4 && m <= 7 ? 0.35 : 0.15;
  const r = rng.next();
  if (r < rainy) return 'rain';
  if (r < rainy + 0.15) return 'wind';
  if (r < rainy + 0.25) return 'fog';
  return 'clear';
}
export function terrainOf(node: string): Terrain {
  const k = NODE[node]?.kind;
  if (k === 'pass') return 'hills';
  if (k === 'ferry' || k === 'port') return 'river';
  return 'plain';
}

function combineSide(s: GameState, armies: Army[], opts: { garrison?: { node: string; troops: number }; foeFaction: string }): BattleSide {
  const lead = [...armies].sort((x, y) => (s.chars[y.commander]?.ab.tong ?? 0) - (s.chars[x.commander]?.ab.tong ?? 0))[0];
  let troops = armies.reduce((n, a) => n + a.troops, 0);
  const mix = { inf: 0, cav: 0, gun: 0, navy: 0 };
  let morale = 0;
  for (const a of armies) { for (const k of ['inf', 'cav', 'gun', 'navy'] as const) mix[k] += a.mix[k] * a.troops; morale += a.morale * a.troops; }
  let faction = lead?.faction ?? '';
  let commander = lead?.commander ?? '';
  if (opts.garrison) {
    const c = s.cities[opts.garrison.node];
    faction = c.controller;
    const gov = c.governor && s.chars[c.governor]?.status === 'active' && s.chars[c.governor].faction === c.controller ? c.governor : '';
    if (!commander || (gov && (s.chars[gov].ab.tong > (s.chars[commander]?.ab.tong ?? 0)))) commander = gov || commander;
    const g = opts.garrison.troops;
    troops += g;
    mix.inf += g * 0.75; mix.gun += g * 0.25;
    morale += g * (40 + c.minxin * 0.4);
  }
  for (const k of ['inf', 'cav', 'gun', 'navy'] as const) mix[k] = troops ? mix[k] / troops : 0;
  const ch = s.chars[commander];
  // 特长：骁勇统军 +6；水战（水师过半）统军 +8；智谋多一道计策；善守者守城士气 +8
  const tong = (ch?.ab.tong ?? 40) + (hasTrait(ch, 'xiaoyong') ? 6 : 0) + (hasTrait(ch, 'shuishi') && mix.navy >= 0.5 ? 8 : 0);
  const avgMorale = troops ? Math.round(morale / troops) : 50;
  return makeSide({
    faction, name: factionName(s, faction), commander, commanderName: ch?.name ?? '守将',
    tong: Math.min(99, tong), mou: ch?.ab.mou ?? 35, wai: ch?.ab.wai ?? 35,
    surrender: ch?.att.surrender ?? 40,
    mix, stratagems: 1 + Math.floor((ch?.ab.mou ?? 30) / 40) + (hasTrait(ch, 'zhimou') ? 1 : 0), armies: armies.map(a => a.id), garrison: !!opts.garrison,
    troops, morale: opts.garrison && hasTrait(ch, 'shanshou') ? Math.min(100, avgMorale + 8) : avgMorale,
  });
}

/** 野战：同处一地的敌对军队 */
export function buildFieldBattle(s: GameState, c: Contact): BattleState | null {
  const here = armiesAt(s, c.node);
  if (here.length < 2) return null;
  // 攻方：敌对双方中最后抵达的一方。同处的中立军队不参与配对，免得因它取消应有的野战
  const engaged = here.filter(a => here.some(o => hostile(s, a.faction, o.faction)));
  if (engaged.length < 2) return null;
  const last = [...engaged].sort((x, y) => (c.arrivals[y.id] ?? 0) - (c.arrivals[x.id] ?? 0) || x.id.localeCompare(y.id))[0];
  const defArmies = engaged.filter(a => hostile(s, a.faction, last.faction));
  const attArmies = engaged.filter(a => friendly(s, a.faction, last.faction) && defArmies.some(d => hostile(s, a.faction, d.faction)));
  if (!defArmies.length) return null;
  const att = combineSide(s, attArmies, { foeFaction: defArmies[0].faction });
  const def = combineSide(s, defArmies, { foeFaction: last.faction });
  // 港口、渡口，或江边相遇而两军多为水师：水战
  const n = NODE[c.node];
  const watery = n.kind === 'port' || n.kind === 'ferry' || neighbors(c.node).some(x => x.route.kind === 'river' || x.route.kind === 'sea');
  const naval = watery && att.mix.navy >= 0.25 && def.mix.navy >= 0.2;
  return createBattle({ id: newId(s, 'bt'), kind: naval ? 'naval' : 'field', node: c.node, nodeName: nodeName(c.node), terrain: naval ? 'water' : terrainOf(c.node), weather: weatherFor(s, c.node),
    att, def, seed: rngFor(s.seed, 'battle', s.turn, c.node).int(1, 2 ** 30) });
}

/** 攻城战 */
export function buildSiegeBattle(s: GameState, node: string): BattleState | null {
  const city = s.cities[node];
  const siege = s.sieges[node];
  if (!city || !siege) return null;
  const attArmies = siege.armies.map(id => s.armies[id]).filter(a => a && a.location === node && a.progress === 0);
  if (!attArmies.length || city.garrison <= 0) return null;
  const att = combineSide(s, attArmies, { foeFaction: city.controller });
  const def = combineSide(s, [], { garrison: { node, troops: city.garrison }, foeFaction: siege.attacker });
  // 每一方的 surrender 是本方主将的降意：攻方劝降成功率看守将降意，城中人心离散时更高
  def.surrender = Math.min(100, (s.chars[def.commander]?.att.surrender ?? 45) + Math.max(0, 50 - city.minxin) / 2);
  return createBattle({ id: newId(s, 'bt'), kind: 'siege', node, nodeName: nodeName(node), terrain: 'city', weather: weatherFor(s, node),
    att, def, wall: city.wall, segs: siege.segs, gate: siege.gate, seed: rngFor(s.seed, 'siege', s.turn, node).int(1, 2 ** 30) });
}

/** 把战斗结果写回局势 */
export function applyBattle(s: GameState, b: BattleState, manual: boolean) {
  const attLoss = lossesOf(b, 'att'), defLoss = lossesOf(b, 'def');
  const attArmies = b.att.armies.map(id => s.armies[id]).filter(Boolean);
  const defArmies = b.def.armies.map(id => s.armies[id]).filter(Boolean);
  const endMorale = (side: BattleSide) => { const t = sideTroops(side); return t ? side.lanes.reduce((n, l) => n + l.morale * l.troops, 0) / t : 0; };
  distribute(attArmies, attLoss, endMorale(b.att));
  let garrisonLoss = 0;
  if (b.kind === 'siege') {
    const city = s.cities[b.node];
    const armyTroops = defArmies.reduce((n, a) => n + a.troops, 0);
    garrisonLoss = Math.round(defLoss * (city.garrison / Math.max(1, city.garrison + armyTroops)));
    distribute(defArmies, defLoss - garrisonLoss, endMorale(b.def));
    const src = { kind: 'battle' as const, ref: b.id };
    bump(s, b.node, 'garrison', -garrisonLoss, `${factionName(s, b.att.faction)}攻城，守军伤亡`, src);
    bump(s, b.node, 'wall', Math.min(0, Math.round(b.wall - city.wall)), '攻城战损毁', src);
    // 围城未解：这一战打出的缺口、撞坏的城门留到下月
    const sg = s.sieges[b.node];
    if (sg && b.segs) { sg.segs = b.segs.slice(); sg.gate = b.gate; }
  } else distribute(defArmies, defLoss, endMorale(b.def));

  const winnerSide = b.winner === 'att' ? b.att : b.def;
  const loserSide = b.winner === 'att' ? b.def : b.att;
  const summary = outcomeText(b);
  s.battles.push({ id: b.id, turn: s.turn, node: b.node, kind: b.kind, attacker: b.att.faction, defender: b.def.faction, winner: b.winner === 'att' ? 'attacker' : 'defender',
    attLoss, defLoss, summary, manual });
  const involved = [b.att.faction, b.def.faction].some(f => topOf(s, f) === s.player || friendly(s, f, s.player));
  const direct = [b.att.faction, b.def.faction].includes(s.player) || b.att.armies.concat(b.def.armies).some(id => s.armies[id]?.faction === s.player);
  report(s, { cat: '军报', act: 'battle', from: b.att.faction, to: b.def.faction, urgent: direct, node: b.node, faction: involved ? undefined : b.att.faction,
    text: `${nodeName(b.node)}${b.kind === 'field' ? '野战' : b.kind === 'naval' ? '水战' : '攻城战'}：${b.att.commanderName}（${b.att.name}）对${b.def.commanderName}（${b.def.name}）。${summary}攻方折损 ${troopsText(attLoss)}，守方折损 ${troopsText(defLoss)}。`,
    src: { kind: 'battle', ref: b.id } });

  if (b.kind !== 'siege') {
    // 败方后撤
    const losers = (b.winner === 'att' ? defArmies : attArmies).filter(a => s.armies[a.id]);
    if (b.outcome === 'rout' || b.outcome === 'repulsed' || b.outcome === 'collapse' || b.outcome === 'retreat') for (const a of losers) retreat(s, a, b.outcome === 'rout' || b.outcome === 'collapse');
    maybeCapture(s, b, loserSide);
  } else {
    if (b.winner === 'att' && (b.outcome === 'breach' || b.outcome === 'surrender' || b.outcome === 'abandon')) {
      capture(s, b.node, b.att.faction, b.outcome === 'surrender' ? '献城' : b.outcome === 'abandon' ? '弃城' : '陷城', b.att.commander);
    } else if (b.winner === 'def') {
      // 攻城不克：玩家之军改为围而不攻，不再每月自动强攻、白白折兵；要再攻须重新下令
      const mine = attArmies.filter(a => s.armies[a.id] && topOf(s, a.faction) === s.player && a.order.kind === 'siege' && a.order.assault);
      for (const a of mine) a.order = { ...a.order, assault: false } as typeof a.order;
      if (mine.length) report(s, { cat: '军报', urgent: true, node: b.node, act: 'siege', from: b.att.faction, to: b.def.faction,
        text: `${nodeName(b.node)}攻城不克（攻方折损 ${troopsText(attLoss)}，守方折损 ${troopsText(defLoss)}）。各军改为围困，断其粮道；城防、城门的损坏留到下月。要再攻，请重新下令攻城。`, src: { kind: 'battle', ref: b.id } });
    }
  }
  void winnerSide;
}

function distribute(armies: Army[], loss: number, morale: number) {
  const total = armies.reduce((n, a) => n + a.troops, 0);
  if (!total) return;
  let left = loss;
  armies.forEach((a, i) => {
    const l = i === armies.length - 1 ? left : Math.round(loss * a.troops / total);
    a.troops = Math.max(0, a.troops - l);
    left -= l;
    a.morale = Math.round(Math.max(5, Math.min(100, morale)));
  });
}

export function retreat(s: GameState, a: Army, routed: boolean) {
  const opts = neighbors(a.location)
    .filter(n => n.route.kind !== 'sea' || canSea(a))
    .filter(n => { const c = s.cities[n.to]; return c && friendly(s, a.faction, c.controller) && !armiesAt(s, n.to).some(o => hostile(s, o.faction, a.faction)); })
    .sort((x, y) => x.route.days - y.route.days);
  if (opts.length) {
    const from = a.location;
    a.location = opts[0].to; a.path = []; a.progress = 0; a.order = { kind: 'hold' };
    a.morale = Math.max(5, a.morale - (routed ? 12 : 5));
    report(s, { cat: '军报', act: 'retreat', from: a.faction, node: a.location, text: `${a.name}自${nodeName(from)}退往${nodeName(a.location)}。`, faction: a.faction });
  } else {
    // 无路可退：残部溃散
    const lost = Math.round(a.troops * 0.5);
    a.troops -= lost;
    a.morale = Math.max(5, a.morale - 20);
    a.path = []; a.order = { kind: 'hold' };
    report(s, { cat: '军报', act: 'retreat', from: a.faction, node: a.location, text: `${a.name}退路断绝，溃散 ${troopsText(lost)}。`, faction: a.faction });
  }
  if (a.troops < 300) disband(s, a);
}

function maybeCapture(s: GameState, b: BattleState, loser: BattleSide) {
  if (b.outcome !== 'rout' && b.outcome !== 'collapse') return;
  const rng = rngFor(b.seed, 'capture');
  const ch = s.chars[loser.commander];
  const isLeader = !!ch && s.factions[ch.faction]?.leader === ch.id;
  if (!rng.chance(isLeader ? 0.04 : 0.12)) return;
  if (!ch || ch.status !== 'active') return;
  const winnerFaction = (b.winner === 'att' ? b.att : b.def).faction;
  captureChar(s, ch.id, winnerFaction, `${nodeName(b.node)}兵败被俘`);
}

export function captureChar(s: GameState, id: string, by: string, how: string) {
  const ch = s.chars[id];
  if (!ch || ch.status !== 'active') return;
  ch.status = 'captured';
  ch.captor = by; ch.capturedAt = s.turn;
  ch.location = s.factions[by]?.capital ?? ch.location;
  const ours = topOf(s, ch.faction) === s.player;
  const isLeader = s.factions[ch.faction]?.leader === id;
  report(s, { cat: '人事', urgent: ours, text: `${ch.name}${how}，为${factionName(s, by)}所执。`, faction: ours || isLeader ? undefined : ch.faction });
  // 军权交接
  for (const a of Object.values(s.armies)) if (a.commander === id) handover(s, a);
  for (const c of Object.values(s.cities)) if (c.governor === id) delete c.governor;
  const f = s.factions[ch.faction];
  if (f && f.leader === id) succession(s, f.id, `${ch.name}被俘`);
}

/** 主将被俘或阵亡后，由同势力在附近、统军最高者接掌 */
export function handover(s: GameState, a: Army) {
  const busy = new Set(Object.values(s.armies).filter(x => x.id !== a.id).map(x => x.commander));
  const cands = Object.values(s.chars).filter(c => c.faction === a.faction && c.status === 'active' && !busy.has(c.id) && s.factions[a.faction]?.leader !== c.id);
  const near = cands.filter(c => c.location === a.location);
  const pick = (near.length ? near : cands).sort((x, y) => y.ab.tong - x.ab.tong)[0];
  const old = charName(s, a.commander);
  if (pick) {
    a.commander = pick.id;
    pick.location = a.location;
    a.morale = Math.max(5, a.morale - 8);
    report(s, { cat: '人事', node: a.location, text: `军权交接：${old}不能视事，${a.name}由${pick.name}接掌，军心稍乱。`, faction: a.faction });
    if (topOf(s, a.faction) === s.player) s.reports[s.reports.length - 1].faction = undefined;
  } else {
    report(s, { cat: '人事', node: a.location, text: `${old}不能视事，${a.name}无人统领，并入附近城池驻军。` });
    disband(s, a);
  }
}

export function succession(s: GameState, faction: string, why: string) {
  const f = s.factions[faction];
  const old = f.leader;
  const cands = Object.values(s.chars).filter(c => c.faction === faction && c.status === 'active' && !c.royal).sort((x, y) => y.ab.wang - x.ab.wang);
  const royals = Object.values(s.chars).some(c => c.faction === faction && c.status === 'active' && c.royal);
  const holdings = Object.values(s.cities).some(c => c.controller === faction) || Object.values(s.armies).some(a => a.faction === faction);
  if (!cands.length && !royals) {
    // 本部已无人：无城无军即退场；有城有兵则留待月末议定（请上级委派、征辟、议赎、投靠）
    if (!holdings) { f.defunct = true; return; }
    s.flags['need_succession_' + faction] = why; s.flags['old_ruler_' + faction] = old;
    report(s, { cat: '人事', urgent: faction === s.player, text: `${why}，${f.name}本部无人主事，诸城诸营暂各自守，待议续局。` });
    return;
  }
  // 君主出事，或玩家一方失其主事人：先由重臣暂摄，月末议定（监国、另立、迎回、择人主事）
  const ask = isRuler(s, faction) || faction === s.player;
  if (ask) { s.flags['need_succession_' + faction] = why; s.flags['old_ruler_' + faction] = old; }
  const next = cands[0] ?? Object.values(s.chars).find(c => c.faction === faction && c.status === 'active');
  if (!next) { f.defunct = true; return; }
  f.leader = next.id;
  report(s, { cat: '人事', urgent: faction === s.player, text: `${why}，${f.name}${ask ? '暂由' + next.name + '摄事，待议' + (isRuler(s, faction) ? '继统' : '主事之人') : '由' + next.name + '主事'}。` });
}
/** 民变：民心跌破一成连续三月，每月一成五的机会，饥民啸聚、地方豪强据城自守。治所、被围之城、本方驻有野战军之城不变。 */
export function unrest(s: GameState) {
  if (!s.factions.local) return;
  for (const c of Object.values(s.cities).sort((x, y) => x.id < y.id ? -1 : 1)) {
    const f = c.controller, k = 'unrest_' + c.id;
    if (f === 'local' || f === 'helan' || c.minxin >= 10) { delete s.flags[k]; continue; }
    const n = (Number(s.flags[k]) || 0) + 1;
    s.flags[k] = n;
    if (n < 3 || s.sieges[c.id] || s.factions[f]?.capital === c.id || Object.values(s.armies).some(a => a.location === c.id && a.faction === f)) continue;
    if (!rngFor(s.seed, 'unrest', s.turn, c.id).chance(0.15)) continue;
    report(s, { cat: '急报', urgent: topOf(s, f) === s.player, node: c.id, text: `${nodeName(c.id)}民心尽失，饥民啸聚，地方豪强据城自守，不复听${factionName(s, f)}号令。` });
    capture(s, c.id, 'local', '归附');
    c.minxin = Math.max(c.minxin, 30);
    delete s.flags[k];
  }
}

/** 人物一致性：死去、被俘或改投他方之人卸去主官、交出兵权；首领身故则议继。史事、分裂、委派之后都要过一遍。 */
export function tidyPeople(s: GameState) {
  for (const c of Object.values(s.cities)) {
    const g = c.governor ? s.chars[c.governor] : undefined;
    if (c.governor && (!g || g.status !== 'active' || g.faction !== c.controller)) delete c.governor;
  }
  for (const a of Object.values(s.armies).sort((x, y) => x.id < y.id ? -1 : 1)) {
    if (!s.armies[a.id]) continue;
    const c = s.chars[a.commander];
    if (!c || c.status !== 'active' || c.faction !== a.faction) handover(s, a);
  }
  for (const f of Object.values(s.factions).sort((x, y) => x.id < y.id ? -1 : 1)) {
    if (f.defunct || f.id === 'local' || f.id === 'helan' || s.flags['need_succession_' + f.id]) continue;
    const l = s.chars[f.leader];
    if (l && l.status === 'dead') succession(s, f.id, `${l.name}身故`);
  }
}

export function disband(s: GameState, a: Army) {
  const near = [a.location, ...neighbors(a.location).map(n => n.to)].find(id => s.cities[id] && friendly(s, a.faction, s.cities[id].controller));
  if (near && a.troops > 0) bump(s, near, 'garrison', a.troops, `${a.name}残部并入`, { kind: 'battle', ref: a.id });
  delete s.armies[a.id];
  for (const sg of Object.values(s.sieges)) sg.armies = sg.armies.filter(id => id !== a.id);
}

/** 弃城时守军可退往的本方之城（陆路最近者），无则为 undefined */
export function retreatCity(s: GameState, node: string): string | undefined {
  const own = s.cities[node]?.controller;
  return Object.values(s.cities).filter(x => x.id !== node && x.controller === own).map(x => ({ x, p: shortestPath(node, x.id, false) })).filter(o => o.p).sort((a, b) => a.p!.length - b.p!.length)[0]?.x.id;
}

/** 易主：陷城 / 献城 / 归附 */
export function capture(s: GameState, node: string, newCtrl: string, how: '陷城' | '献城' | '归附' | '弃城', by?: string) {
  const c = s.cities[node];
  const old = c.controller;
  if (old === newCtrl) return;
  // 弃城：守军带走八成兵马与半数府库，退往最近的本方之城；主官随军而走
  let fled = '';
  if (how === '弃城') {
    const dest = Object.values(s.cities).filter(x => x.id !== node && x.controller === old).map(x => ({ x, p: shortestPath(node, x.id, false) })).filter(o => o.p).sort((a, b) => a.p!.length - b.p!.length)[0]?.x;
    if (dest) {
      const src0 = { kind: 'battle' as const, ref: `弃城:${node}` };
      const g = Math.round(c.garrison * 0.8), sv = Math.round(c.silver * 0.5);
      bump(s, dest.id, 'garrison', g, `${nodeName(node)}守军弃城来投`, src0);
      bump(s, dest.id, 'silver', sv, `${nodeName(node)}弃城时运出`, src0);
      bump(s, node, 'garrison', -c.garrison, '弃城而走', src0);
      bump(s, node, 'silver', -sv, '弃城时运走', src0);
      if (c.governor && s.chars[c.governor]?.faction === old) { s.chars[c.governor].location = dest.id; delete c.governor; }
      fled = `守军 ${troopsText(g)} 携银 ${troopsText(sv)} 两退往${nodeName(dest.id)}`;
    } else {
      // 无城可退：守军就地溃散，府库来不及运走
      const src0 = { kind: 'battle' as const, ref: `弃城:${node}` };
      fled = `无城可退，守军 ${troopsText(c.garrison)} 就地溃散，府库尽归敌手`;
      bump(s, node, 'garrison', -c.garrison, '弃城而无处可退，守军溃散', src0);
    }
  }
  const src = { kind: 'battle' as const, ref: `${how}:${node}` };
  const gov = c.governor ? s.chars[c.governor] : undefined;
  c.controller = newCtrl;
  delete s.sieges[node];
  const spoils = { silver: Math.round(c.silver), grain: Math.round(c.grain), troops: 0, captives: [] as string[] };
  if (how === '陷城') {
    const g0 = c.garrison;
    bump(s, node, 'garrison', -c.garrison, '城破，守军覆没', src);
    bump(s, node, 'minxin', -15, '城破遭兵燹', src);
    bump(s, node, 'wall', -10, '城破', src);
    // 攻方留兵驻守
    const occupiers = armiesAt(s, node).filter(a => a.faction === newCtrl || friendly(s, a.faction, newCtrl)).sort((x, y) => y.troops - x.troops);
    if (occupiers[0]) {
      const keep = Math.max(1000, Math.min(4000, Math.round(occupiers[0].troops * 0.1)));
      const k = Math.min(keep, occupiers[0].troops - 500);
      if (k > 0) { occupiers[0].troops -= k; bump(s, node, 'garrison', k, `${occupiers[0].name}分兵驻守`, src); }
      if (occupiers[0].faction !== newCtrl) c.controller = occupiers[0].faction;
      // 战果：残卒约两成投降、收编入军；得胜之师士气上扬
      const surrender = Math.round(g0 * 0.2);
      if (surrender >= 100) { occupiers[0].troops += surrender; spoils.troops = surrender; }
      for (const a of occupiers) a.morale = Math.min(100, a.morale + 8);
    }
    // 记下城中被执者，史事据此叙述（被俘者随即押往敌方治所）
    const caught = Object.values(s.chars).filter(ch => ch.status === 'active' && ch.faction === old && (ch.id === gov?.id || ch.location === node)).map(ch => ch.id);
    s.flags['lost_caught_' + node] = caught.join(',');
    if (gov && gov.faction === old) { captureChar(s, gov.id, newCtrl, `守${nodeName(node)}，城破`); spoils.captives.push(gov.name); }
  } else {
    spoils.troops = how === '弃城' ? 0 : Math.round(c.garrison);
    if (how === '弃城') {
      const occ = armiesAt(s, node).filter(a => a.faction === newCtrl).sort((x, y) => y.troops - x.troops)[0];
      if (occ) { const k = Math.min(3000, Math.max(0, occ.troops - 500), Math.round(occ.troops * 0.1)); occ.troops -= k; bump(s, node, 'garrison', k, `${occ.name}分兵驻守`, src); }
    }
    bump(s, node, 'minxin', -5, how === '献城' ? '易帜' : how === '弃城' ? '守军弃城' : '归附', src);
    if (gov && gov.faction === old && how === '献城') {
      const of0 = s.factions[old];
      const head = !!of0 && of0.leader === gov.id && old !== 'local' && !of0.admin;
      // 一镇之主献城，全镇随否要看诸将：不从者另推主事，镇主只带走本城与亲领之兵
      const odds = head ? followOdds(s, old, newCtrl) : 0;
      const follow = head && rngFor(s.seed, 'follow', s.turn, old).next() < odds;
      if (head && !follow) report(s, { cat: '人事', urgent: topOf(s, old) === s.player || topOf(s, newCtrl) === s.player, node, text: `${gov.name}欲率${of0!.name}归附${factionName(s, newCtrl)}，诸将不从（随者约 ${Math.round(odds * 100)}%）。${gov.name}只以${nodeName(node)}及亲兵改投。` });
      if (head && follow) {
        // 一镇之主献城：全镇正式归附，城仍由本镇实控，改奉新主
        c.controller = old;
        defectFaction(s, old, newCtrl);
        adjustAtt(s, gov.id, 'loyalty', 60 - gov.att.loyalty, `率${of0.name}归附${factionName(s, newCtrl)}`);
      } else {
        gov.faction = newCtrl;
        for (const a of Object.values(s.armies)) if (a.commander === gov.id) a.faction = newCtrl;
        adjustAtt(s, gov.id, 'loyalty', 60 - gov.att.loyalty, `献${nodeName(node)}，改投${factionName(s, newCtrl)}`);
        // 地方官府的首领只带走本城与亲领之兵；其余各城另推主事，各自守土
        if (of0 && of0.leader === gov.id) succession(s, old, `${gov.name}献${nodeName(node)}改投${factionName(s, newCtrl)}`);
      }
    }
  }
  // 城中其他人物
  const commanders = new Set(Object.values(s.armies).map(a => a.commander));
  for (const ch of Object.values(s.chars)) {
    if (ch.location !== node || ch.status !== 'active' || ch.faction !== old || commanders.has(ch.id)) continue;
    if (how === '陷城') captureChar(s, ch.id, newCtrl, `在${nodeName(node)}城破时`);
    else {
      const to = Object.values(s.cities).find(x => x.controller === old)?.id;
      if (to) ch.location = to;
    }
  }
  // 原守城军队若仍在城中，按败军处理
  for (const a of armiesAt(s, node)) if (hostile(s, a.faction, newCtrl)) retreat(s, a, true);
  // 围攻此城的各军：途中受阻的接着开往原定目标
  for (const a of Object.values(s.armies)) if (a.order.kind === 'siege' && a.order.target === node && !hostile(s, a.faction, s.cities[node].controller)) siegeDone(s, a);
  s.flags['lost_' + node] = s.turn;
  s.flags['lost_how_' + node] = how;
  if (c.controller === old) {
    report(s, { cat: '易主', act: 'join', from: old, to: newCtrl, urgent: true, node, text: `${nodeName(node)}守将${gov?.name ?? ''}率${factionName(s, old)}开城，正式归附${factionName(s, newCtrl)}。城仍由${factionName(s, old)}实控，改奉${s.factions[old].polity === 'qing' ? '清' : factionName(s, topOf(s, newCtrl))}。`, src });
    s.flags['lost_' + node] = s.turn;
    return;
  }
  const byName = by ? charName(s, by) : factionName(s, newCtrl);
  // 缴获细账只让当事双方（及其阵营、盟友）知道；旁人只知易帜
  const me = topOf(s, s.player);
  const party = topOf(s, old) === me || topOf(s, newCtrl) === me || friendly(s, s.player, old) || friendly(s, s.player, newCtrl);
  if (!party) { spoils.silver = 0; spoils.grain = 0; spoils.troops = 0; }
  const verb = how === '陷城' ? `攻破${nodeName(node)}` : how === '献城' ? `受${nodeName(node)}献城` : how === '弃城' ? `入${nodeName(node)}` : `受${nodeName(node)}归附`;
  const got = [spoils.silver >= 1000 ? `存银 ${troopsText(spoils.silver)} 两` : '', spoils.grain >= 1000 ? `存粮 ${troopsText(spoils.grain)} 石` : '', spoils.troops >= 100 ? (how === '陷城' ? `收降卒 ${troopsText(spoils.troops)}` : `守军 ${troopsText(spoils.troops)} 随城归附`) : '', spoils.captives.length ? `俘${spoils.captives.join('、')}` : '', how === '陷城' ? '得胜之师士气 +8' : ''].filter(Boolean);
  report(s, { cat: '易主', act: how === '陷城' ? 'breach' : how === '献城' ? 'yield' : how === '弃城' ? 'abandon' : 'join', from: old, to: newCtrl, spoils, urgent: topOf(s, old) === s.player || topOf(s, newCtrl) === s.player, node,
    text: `${nodeName(node)}易主（${how}）：${byName}${verb}。此城原属${factionName(s, old)}，${how === '陷城' ? '守军覆没，百姓遭兵燹' : how === '献城' ? `${gov ? gov.name + '率' : ''}守军易帜` : how === '弃城' ? `${fled || '守军弃城而走'}，城中免于兵燹` : '一体改奉'}。现由${factionName(s, c.controller)}控制。${got.length ? `所获：${got.join('，')}。` : ''}`,
    src });
  // 都城失守
  const of = s.factions[old];
  if (of && of.capital === node) {
    const rest = Object.values(s.cities).filter(x => x.controller === old).sort((x, y) => y.pop - x.pop);
    if (rest.length) {
      of.capital = rest[0].id;
      if (old !== 'local') report(s, { cat: '急报', urgent: old === s.player, text: `${of.name}失其治所${nodeName(node)}，移驻${nodeName(rest[0].id)}。` });
    }
  }
}

/** 一镇之主改投时诸将随从的比重：忠于本镇而无降意者、志在抗清者不从。按统军、领兵、守城加权。 */
export function followOdds(s: GameState, f: string, to: string): number {
  const fac = s.factions[f];
  if (!fac) return 0;
  const toQing = s.factions[topOf(s, to)]?.polity === 'qing' && fac.polity !== 'qing';
  const leading = new Set(Object.values(s.armies).filter(a => a.faction === f).map(a => a.commander));
  const govs = new Set(Object.values(s.cities).filter(c => c.controller === f).map(c => c.governor));
  let yes = 0, no = 0;
  for (const c of Object.values(s.chars)) {
    if (c.faction !== f || c.status !== 'active' || c.id === fac.leader) continue;
    const w = c.ab.tong + (leading.has(c.id) ? 30 : 0) + (govs.has(c.id) ? 20 : 0);
    const dissent = (c.att.loyalty >= 70 && c.att.surrender < 40) || (toQing && c.att.hawk > 50);
    if (dissent) no += w; else yes += w;
  }
  return yes + no === 0 ? 1 : yes / (yes + no);
}

/** 围攻之城已不再是敌城（攻下、献城、归附）：途中受阻的接着开往原定目标，否则驻扎 */
export function siegeDone(s: GameState, a: Army) {
  if (a.order.kind !== 'siege') return;
  const then = a.order.then;
  if (then && s.cities[then] && hostile(s, a.faction, s.cities[then].controller) && setArmyOrder(s, a, { kind: 'move', target: then, attack: true })) {
    if (topOf(s, a.faction) === s.player) report(s, { cat: '军报', act: 'march', from: a.faction, node: a.location, text: `${a.name}已过${nodeName(a.location)}，接着开往${nodeName(then)}。`, src: { kind: 'order', ref: a.id } });
  } else a.order = { kind: 'hold' };
}

/** 整个势力正式归附另一方：改奉其政权，实控不变 */
export function defectFaction(s: GameState, f: string, to: string) {
  const fac = s.factions[f];
  const lord = topOf(s, to);
  fac.overlord = lord;
  fac.polity = s.factions[lord].polity;
  fac.loyalty = 60;
  // 原主的号令随之作废
  for (const a of Object.values(s.armies)) if (a.faction === f) delete s.flags['commanded_' + a.id];
  for (const k of Object.keys(s.relations)) if (k.split('|').includes(f)) delete s.relations[k];
  for (const sg of Object.values(s.sieges)) if (sg.attacker === f || s.cities[sg.node].controller === f) {
    if (!hostile(s, sg.attacker, s.cities[sg.node].controller)) delete s.sieges[sg.node];
  }
  for (const a of Object.values(s.armies)) if (a.faction === f && a.order.kind === 'siege' && !hostile(s, f, s.cities[a.order.target]?.controller ?? f)) a.order = { kind: 'hold' };
}

/** 围城阶段的准备：建立/维持/解除围城，空城直接占领。返回需要打攻城战的城。 */
export function updateSieges(s: GameState): string[] {
  const assaults: string[] = [];
  // 所围之城已归友方或第三方停战：解围待命；若是途中受阻之城，接着开往原定目标
  for (const a of Object.values(s.armies)) if (a.order.kind === 'siege') { const c = s.cities[a.order.target]; if (!c || !hostile(s, a.faction, c.controller)) siegeDone(s, a); }
  for (const node of Object.keys(s.cities).sort()) {
    const city = s.cities[node];
    const here = armiesAt(s, node).filter(a => hostile(s, a.faction, city.controller) && a.order.kind === 'siege' && a.order.target === node);
    const existing = s.sieges[node];
    if (!here.length) {
      if (existing) {
        delete s.sieges[node];
        const inv = friendly(s, city.controller, s.player) || friendly(s, existing.attacker, s.player);
        report(s, { cat: '军报', act: 'lift', from: existing.attacker, to: city.controller, node, urgent: topOf(s, city.controller) === s.player, faction: inv ? undefined : existing.attacker, text: `${nodeName(node)}之围已解（历 ${existing.months} 月）。` });
      }
      continue;
    }
    if (city.garrison <= 0) { capture(s, node, here[0].faction, '陷城', here[0].commander); continue; }
    if (!existing) {
      s.sieges[node] = { node, attacker: here[0].faction, armies: here.map(a => a.id), startTurn: s.turn, months: 0 };
      s.flags['sieged_' + node] = s.turn;
      const inv = friendly(s, city.controller, s.player) || friendly(s, here[0].faction, s.player);
      const mineDirect = city.controller === s.player || here[0].faction === s.player;
      report(s, { cat: '军报', act: 'siege', from: here[0].faction, to: city.controller, node, urgent: mineDirect, faction: inv ? undefined : here[0].faction,
        text: `${factionName(s, here[0].faction)}${charName(s, here[0].commander)}兵临${nodeName(node)}城下，开始围城。守军 ${troopsText(city.garrison)}，城防 ${Math.round(city.wall)}。` });
    } else {
      existing.armies = here.map(a => a.id);
      // 守军逐月修补：城门修回三成，塌段补起一些（修不到原有城防之上）
      if (existing.gate !== undefined) existing.gate = Math.min(1, existing.gate + 0.3);
      if (existing.segs) existing.segs = existing.segs.map(h => Math.min(city.wall, h + 4));
    }
    s.sieges[node].months++;
    if (here.some(a => a.order.kind === 'siege' && a.order.assault)) assaults.push(node);
  }
  return assaults;
}

/** 围而不攻：粮尽则守军逃散，守将可能献城 */
export function blockadeEffects(s: GameState, node: string) {
  const city = s.cities[node];
  const sg = s.sieges[node];
  if (!city || !sg) return;
  if (city.grain <= 0) {
    const rng = rngFor(s.seed, 'blockade', s.turn, node);
    const gov = city.governor ? s.chars[city.governor] : undefined;
    const p = 0.15 + (gov ? gov.att.surrender / 200 : 0.25) + (100 - city.minxin) / 400;
    if (rng.chance(p)) capture(s, node, sg.attacker, '献城', gov?.id);
  }
}
