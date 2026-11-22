/* 战斗：野战分左翼、中军、右翼三路；攻城战分左城、城门、右城三段。
 * 每回合双方给每一路下令，主将可施放有次数限制的计策。
 * resolveRound 是纯函数：同一战局 + 同一组选择 → 同一结果。自动结算只是由电脑代为选择。 */
import { rngFor, type Rng } from './rng';
import type { TroopMix } from './types';

export type FieldOrder = 'attack' | 'hold' | 'flank' | 'volley' | 'charge' | 'withdraw';
export type SiegeAttOrder = 'storm' | 'bombard' | 'sap' | 'blockade';
export type SiegeDefOrder = 'hold' | 'sortie' | 'volley' | 'repair';
export type LaneOrder = FieldOrder | SiegeAttOrder | SiegeDefOrder;
export type Stratagem = 'ambush' | 'fire' | 'night' | 'persuade';

export const ORDER_NAME: Record<LaneOrder, string> = {
  attack: '进攻', hold: '坚守', flank: '迂回', volley: '齐射', charge: '突击', withdraw: '后撤',
  storm: '登城', bombard: '炮击', sap: '掘地', blockade: '围而不攻', sortie: '出城突击', repair: '修城',
};
export const ORDER_HINT: Record<LaneOrder, string> = {
  attack: '正面压上。克后撤之敌，遇坚守则吃亏。',
  hold: '结阵固守，少受损伤；怕被迂回。',
  flank: '分兵绕击，专破坚守之阵；遇突击骑兵易溃。',
  volley: '火器齐射，克正面进攻；雨天减半，怕骑兵突击。',
  charge: '骑兵冲阵，专克火器；撞上坚阵则折损。',
  withdraw: '这一路退出战斗，少受损伤，但会被追击。',
  storm: '架梯登城，伤亡大；城防越低越易破。',
  bombard: '以火炮轰击城墙，需有火器。',
  sap: '挖掘地道毁墙，伤亡小，怕守军出城突击。',
  blockade: '本月不攻，只围困耗其粮草。',
  sortie: '开门出击，专破掘地与炮击；遇登城之敌则吃亏。',
  repair: '抢修城墙，回复城防。',
};
export const STRATAGEM_NAME: Record<Stratagem, string> = { ambush: '伏兵', fire: '火攻', night: '夜袭', persuade: '阵前劝降' };
export const STRATAGEM_HINT: Record<Stratagem, string> = {
  ambush: '预设伏兵，成则敌军三路士气大挫、伤亡加重。看谋略高下。',
  fire: '纵火焚营，有风时更易成。看谋略。',
  night: '趁夜劫营，成则敌军惊乱。看谋略高下。',
  persuade: '遣人说降敌将，看外交与敌将降意。守城时说成则献城。',
};
export const FIELD_ORDERS: FieldOrder[] = ['attack', 'hold', 'flank', 'volley', 'charge', 'withdraw'];
export const SIEGE_ATT_ORDERS: SiegeAttOrder[] = ['storm', 'bombard', 'sap', 'blockade'];
export const SIEGE_DEF_ORDERS: SiegeDefOrder[] = ['hold', 'sortie', 'volley', 'repair'];
export const LANE_NAMES = { field: ['左翼', '中军', '右翼'], siege: ['左城', '城门', '右城'] };

export interface Lane { troops: number; morale: number; routed: boolean; withdrawn: boolean }
export interface BattleSide {
  faction: string;
  name: string;
  commander: string;
  commanderName: string;
  tong: number;
  mou: number;
  wai: number;
  /** 敌将对己方的降意参考（劝降用） */
  surrender: number;
  mix: TroopMix;
  lanes: Lane[];
  stratagems: number;
  armies: string[];
  /** 守城一方是否含城中驻军 */
  garrison: boolean;
  startTroops: number;
}
export type Terrain = 'plain' | 'river' | 'hills' | 'city';
export type Weather = 'clear' | 'rain' | 'wind' | 'fog';
export interface Choice { lanes: LaneOrder[]; stratagem?: Stratagem }

export interface LaneEvent {
  lane: number;
  att: LaneOrder;
  def: LaneOrder;
  attLoss: number;
  defLoss: number;
  attRouted: boolean;
  defRouted: boolean;
}
export interface RoundLog {
  round: number;
  lanes: LaneEvent[];
  stratagems: { side: 'att' | 'def'; kind: Stratagem; ok: boolean; text: string }[];
  wallBefore: number;
  wallAfter: number;
  text: string[];
}
export interface BattleState {
  id: string;
  kind: 'field' | 'siege';
  node: string;
  nodeName: string;
  terrain: Terrain;
  weather: Weather;
  round: number;
  maxRounds: number;
  att: BattleSide;
  def: BattleSide;
  wall: number;
  seed: number;
  log: RoundLog[];
  over: boolean;
  winner?: 'att' | 'def';
  /** 城破 / 献城 / 围而不攻 */
  outcome?: 'breach' | 'surrender' | 'repulsed' | 'blockade' | 'rout' | 'held' | 'stalemate';
  /** 守将被说降（献城） */
  surrendered?: boolean;
}

/* 克制表：M[我][敌] = 我方对敌造成的伤害倍数 */
const M: Record<string, Record<string, number>> = {
  attack: { attack: 1.0, hold: 0.75, flank: 1.2, volley: 0.9, charge: 0.95, withdraw: 1.35 },
  hold: { attack: 0.85, hold: 0.4, flank: 0.6, volley: 0.6, charge: 1.15, withdraw: 0.3 },
  flank: { attack: 0.85, hold: 1.45, flank: 0.9, volley: 1.1, charge: 0.6, withdraw: 1.0 },
  volley: { attack: 1.35, hold: 0.8, flank: 1.2, volley: 0.8, charge: 0.6, withdraw: 0.9 },
  charge: { attack: 1.1, hold: 0.6, flank: 1.4, volley: 1.6, charge: 1.0, withdraw: 1.4 },
  withdraw: { attack: 0.2, hold: 0.1, flank: 0.2, volley: 0.15, charge: 0.25, withdraw: 0 },
  // 攻城
  storm: { hold: 1.0, sortie: 1.2, volley: 0.8, repair: 1.3 },
  bombard: { hold: 0.35, sortie: 0.6, volley: 0.4, repair: 0.45 },
  sap: { hold: 0.2, sortie: 0.35, volley: 0.2, repair: 0.25 },
  blockade: { hold: 0, sortie: 0.5, volley: 0, repair: 0 },
  // 守城（对攻城方）
  'd:hold': { storm: 1.0, bombard: 0.3, sap: 0.3, blockade: 0 },
  'd:sortie': { storm: 0.8, bombard: 1.5, sap: 1.6, blockade: 1.1 },
  'd:volley': { storm: 1.45, bombard: 0.45, sap: 0.5, blockade: 0 },
  'd:repair': { storm: 0.5, bombard: 0.15, sap: 0.2, blockade: 0 },
};
/** 受伤倍数（被打时的防护）：坚守与城墙之后少受伤 */
const TAKEN: Record<string, number> = { hold: 0.7, withdraw: 0.55, attack: 1.0, flank: 1.1, volley: 1.05, charge: 1.0,
  storm: 1.2, bombard: 0.7, sap: 0.6, blockade: 0.4, sortie: 1.1 };

function mixFactor(order: LaneOrder, mix: TroopMix): number {
  switch (order) {
    case 'charge': return 0.35 + mix.cav * 2.0;
    case 'volley': return 0.6 + mix.gun * 2.5;
    case 'bombard': return 0.2 + mix.gun * 3.5;
    case 'flank': return 0.7 + mix.cav * 0.8;
    case 'attack': case 'storm': return 0.8 + mix.inf * 0.4;
    default: return 1;
  }
}

export const sideTroops = (s: BattleSide) => s.lanes.reduce((n, l) => n + l.troops, 0);
export const laneActive = (l: Lane) => !l.routed && !l.withdrawn && l.troops > 0;
const sideActive = (s: BattleSide) => s.lanes.some(laneActive);

export function makeSide(p: Omit<BattleSide, 'lanes' | 'startTroops'> & { troops: number; morale: number }): BattleSide {
  const t = p.troops;
  const split = [0.3, 0.4, 0.3].map(f => Math.round(t * f));
  const { troops: _t, morale, ...rest } = p;
  return { ...rest, lanes: split.map(n => ({ troops: n, morale, routed: false, withdrawn: false })), startTroops: t };
}

export function createBattle(p: { id: string; kind: 'field' | 'siege'; node: string; nodeName: string; terrain: Terrain; weather: Weather; att: BattleSide; def: BattleSide; wall?: number; seed: number }): BattleState {
  return { ...p, round: 0, maxRounds: p.kind === 'field' ? 5 : 4, wall: p.wall ?? 0, log: [], over: false };
}

export function legalOrders(b: BattleState, side: 'att' | 'def'): LaneOrder[] {
  if (b.kind === 'field') return FIELD_ORDERS;
  if (side === 'att') return b.att.mix.gun < 0.05 ? SIEGE_ATT_ORDERS.filter(o => o !== 'bombard') : SIEGE_ATT_ORDERS;
  return SIEGE_DEF_ORDERS;
}

export function legalStratagems(b: BattleState, side: 'att' | 'def'): Stratagem[] {
  const s = b[side];
  if (s.stratagems <= 0) return [];
  const list: Stratagem[] = ['night', 'persuade'];
  if (b.kind === 'field') list.unshift('ambush');
  if (b.kind === 'field' || side === 'def') list.splice(1, 0, 'fire');
  return list;
}

function clampChance(p: number) { return Math.max(0.05, Math.min(0.9, p)); }

function stratagemChance(b: BattleState, side: 'att' | 'def', k: Stratagem): number {
  const me = b[side], foe = b[side === 'att' ? 'def' : 'att'];
  switch (k) {
    case 'ambush': return clampChance(0.35 + (me.mou - foe.mou) / 100 + (b.terrain === 'hills' ? 0.15 : 0) + (b.weather === 'fog' ? 0.1 : 0));
    case 'fire': return clampChance(0.25 + me.mou / 220 + (b.weather === 'wind' ? 0.25 : 0) - (b.weather === 'rain' ? 0.3 : 0));
    case 'night': return clampChance(0.3 + (me.mou - foe.mou) / 120 + (b.weather === 'fog' ? 0.1 : 0));
    case 'persuade': return clampChance(foe.surrender / 100 * 0.7 + (me.wai - 50) / 250 - 0.05);
  }
}
export function stratagemOdds(b: BattleState, side: 'att' | 'def', k: Stratagem): number { return stratagemChance(b, side, k); }

/** 结算一个回合，返回新战局（不修改入参） */
export function resolveRound(b0: BattleState, attC: Choice, defC: Choice): BattleState {
  if (b0.over) return b0;
  const b: BattleState = structuredClone(b0);
  b.round++;
  const rng = rngFor(b.seed, 'round', b.round);
  const log: RoundLog = { round: b.round, lanes: [], stratagems: [], wallBefore: b.wall, wallAfter: b.wall, text: [] };
  const mods = { att: { dmg: 1, morale: 0 }, def: { dmg: 1, morale: 0 } };

  // 计策
  for (const side of ['att', 'def'] as const) {
    const c = side === 'att' ? attC : defC;
    const me = b[side];
    if (!c.stratagem || me.stratagems <= 0 || !legalStratagems(b, side).includes(c.stratagem)) continue;
    me.stratagems--;
    const ok = rng.next() < stratagemChance(b, side, c.stratagem);
    const foeKey = side === 'att' ? 'def' : 'att';
    const foe = b[foeKey];
    let text = '';
    if (ok) {
      switch (c.stratagem) {
        case 'ambush': mods[side].dmg *= 1.35; mods[foeKey].morale -= 12; text = `${me.commanderName}设伏得手，${foe.name}阵脚大乱。`; break;
        case 'fire': for (const l of foe.lanes) if (laneActive(l)) l.troops = Math.round(l.troops * 0.92); mods[foeKey].morale -= 8;
          if (b.kind === 'siege' && side === 'def') text = `守军纵火焚毁攻具，${foe.name}折损甚多。`;
          else text = `${me.commanderName}纵火焚营，${foe.name}折损甚多。`; break;
        case 'night': mods[foeKey].morale -= 15; mods[side].dmg *= 1.15; text = `${me.commanderName}夜袭敌营，${foe.name}惊扰一夜。`; break;
        case 'persuade': {
          if (b.kind === 'siege' && side === 'att') { b.surrendered = true; text = `守将为${me.commanderName}所说，开城纳降。`; }
          else {
            let best = -1; foe.lanes.forEach((l, i) => { if (laneActive(l) && (best < 0 || l.troops > foe.lanes[best].troops)) best = i; });
            if (best >= 0) { foe.lanes[best].routed = true; foe.lanes[best].troops = Math.round(foe.lanes[best].troops * 0.5); }
            text = `${foe.name}一部为${me.commanderName}所说，阵前倒戈散去。`;
          }
          break;
        }
      }
    } else {
      text = `${me.commanderName}欲行${STRATAGEM_NAME[c.stratagem]}，为敌所觉，未能得手。`;
      mods[side].morale -= 3;
    }
    log.stratagems.push({ side, kind: c.stratagem, ok, text });
    log.text.push(text);
  }

  if (b.surrendered) {
    b.over = true; b.winner = 'att'; b.outcome = 'surrender';
    log.wallAfter = b.wall;
    b.log.push(log);
    return b;
  }

  const wf = b.kind === 'siege' ? 1 - b.wall / 160 : 1;
  for (let i = 0; i < 3; i++) {
    const la = b.att.lanes[i], ld = b.def.lanes[i];
    const ao = (attC.lanes[i] ?? 'hold') as LaneOrder, dOrd = (defC.lanes[i] ?? 'hold') as LaneOrder;
    const ev: LaneEvent = { lane: i, att: ao, def: dOrd, attLoss: 0, defLoss: 0, attRouted: false, defRouted: false };
    const aOn = laneActive(la), dOn = laneActive(ld);
    if (b.kind === 'siege') {
      // 攻城：城墙变化
      if (aOn && ao === 'bombard') b.wall -= Math.min(14, la.troops * mixFactor('bombard', b.att.mix) / 1800) * rng.jitter(0.3);
      if (aOn && ao === 'sap') b.wall -= 4 * rng.jitter(0.4) * (dOrd === 'sortie' && dOn ? 0.3 : 1);
      if (dOn && dOrd === 'repair') b.wall += 4;
    }
    if (aOn && dOn) {
      const pa = power(b, 'att', la, ao, dOrd, rng) * mods.att.dmg;
      const pd = power(b, 'def', ld, dOrd, ao, rng) * mods.def.dmg;
      let lossD = pa * (TAKEN[b.kind === 'siege' ? (dOrd === 'sortie' ? 'sortie' : 'hold') : dOrd] ?? 1);
      let lossA = pd * (TAKEN[ao] ?? 1);
      if (b.kind === 'siege') {
        if (dOrd !== 'sortie') lossD *= wf; // 城墙庇护
        if (ao === 'storm') lossA *= 1 + b.wall / 140; // 登城越坚越难
      }
      ev.defLoss = Math.min(ld.troops, Math.round(lossD));
      ev.attLoss = Math.min(la.troops, Math.round(lossA));
      la.troops -= ev.attLoss;
      ld.troops -= ev.defLoss;
      la.morale += -(ev.attLoss / Math.max(1, la.troops + ev.attLoss)) * 130 + mods.att.morale;
      ld.morale += -(ev.defLoss / Math.max(1, ld.troops + ev.defLoss)) * 130 + mods.def.morale;
      if (b.kind === 'field' && dOrd === 'flank' && ao === 'hold') la.morale -= 4;
      if (b.kind === 'field' && ao === 'flank' && dOrd === 'hold') ld.morale -= 4;
    } else if (aOn && !dOn) {
      if (b.kind === 'siege' && ao === 'storm') b.wall -= 6; // 无人守的城段，登城直入
      la.morale += 2;
    } else if (dOn && !aOn) {
      ld.morale += 2;
    }
    if (aOn && ao === 'withdraw') la.withdrawn = true;
    if (dOn && dOrd === 'withdraw') ld.withdrawn = true;
    if (aOn && ao === 'blockade') la.withdrawn = true;
    for (const [l, key] of [[la, 'attRouted'], [ld, 'defRouted']] as const) {
      l.morale = Math.max(0, Math.min(100, l.morale));
      if (!l.routed && !l.withdrawn && l.troops > 0 && (l.morale < 18 || l.troops < 150)) { l.routed = true; ev[key] = true; }
    }
    log.lanes.push(ev);
  }
  b.wall = Math.max(0, Math.min(100, b.wall));
  log.wallAfter = Math.round(b.wall);
  b.wall = Math.round(b.wall * 10) / 10;
  log.text.push(...describe(b, log));
  b.log.push(log);
  settle(b, attC);
  return b;
}

function power(b: BattleState, side: 'att' | 'def', lane: Lane, my: LaneOrder, their: LaneOrder, rng: Rng): number {
  const s = b[side];
  const key = b.kind === 'siege' && side === 'def' ? 'd:' + my : my;
  let m = M[key]?.[their] ?? 0.8;
  if (my === 'volley' && b.weather === 'rain') m *= 0.5;
  if (b.kind === 'field' && side === 'def' && my === 'hold' && b.terrain === 'hills') m *= 1.2;
  if (b.kind === 'field' && side === 'att' && b.terrain === 'river') m *= 0.9;
  const morale = 0.45 + lane.morale / 180;
  const cmd = 0.8 + s.tong / 250;
  return lane.troops * 0.07 * m * mixFactor(my, s.mix) * morale * cmd * rng.jitter(0.2);
}

function settle(b: BattleState, attC: Choice) {
  const attOn = sideActive(b.att), defOn = sideActive(b.def);
  if (b.kind === 'siege') {
    const breach = b.wall <= 0 || (b.wall < 35 && !defOn);
    if (breach && attOn) { b.over = true; b.winner = 'att'; b.outcome = 'breach'; return; }
    if (!attOn) { b.over = true; b.winner = 'def'; b.outcome = attC.lanes.every(o => o === 'blockade') ? 'blockade' : 'repulsed'; return; }
    if (!defOn && b.wall >= 35) {
      // 守军溃散但城墙尚坚：残兵收拢，下回合再战
      for (const l of b.def.lanes) if (l.troops > 150) { l.routed = false; l.morale = 25; }
      if (!sideActive(b.def)) { b.over = true; b.winner = 'att'; b.outcome = 'breach'; return; }
    }
    if (b.round >= b.maxRounds) { b.over = true; b.winner = 'def'; b.outcome = 'held'; }
    return;
  }
  if (!attOn && !defOn) { b.over = true; b.winner = 'def'; b.outcome = 'stalemate'; return; }
  if (!defOn) { b.over = true; b.winner = 'att'; b.outcome = 'rout'; return; }
  if (!attOn) { b.over = true; b.winner = 'def'; b.outcome = 'repulsed'; return; }
  if (b.round >= b.maxRounds) {
    const st = (s: BattleSide) => s.lanes.reduce((n, l) => n + (laneActive(l) ? l.troops * (0.4 + l.morale / 100) : 0), 0);
    const a = st(b.att), d = st(b.def);
    b.over = true;
    if (a > d * 1.15) { b.winner = 'att'; b.outcome = 'rout'; } else { b.winner = 'def'; b.outcome = 'held'; }
  }
}

function describe(b: BattleState, log: RoundLog): string[] {
  const names = LANE_NAMES[b.kind];
  const out: string[] = [];
  for (const e of log.lanes) {
    if (!e.attLoss && !e.defLoss && !e.attRouted && !e.defRouted) continue;
    let t = `${names[e.lane]}：${b.att.name}${ORDER_NAME[e.att]}，${b.def.name}${ORDER_NAME[e.def]}。`;
    t += `攻方折损 ${e.attLoss}，守方折损 ${e.defLoss}。`;
    if (e.attRouted) t += `${b.att.name}此路溃退。`;
    if (e.defRouted) t += `${b.def.name}此路溃退。`;
    out.push(t);
  }
  if (b.kind === 'siege' && log.wallAfter !== Math.round(log.wallBefore)) out.push(`城防 ${Math.round(log.wallBefore)} → ${log.wallAfter}。`);
  return out;
}

/* ---------- 电脑选择 ---------- */
export function aiChoice(b: BattleState, side: 'att' | 'def'): Choice {
  const rng = rngFor(b.seed, 'ai', side, b.round);
  const me = b[side], foe = b[side === 'att' ? 'def' : 'att'];
  const ratio = sideTroops(me) / Math.max(1, sideTroops(foe));
  const lanes: LaneOrder[] = [];
  for (let i = 0; i < 3; i++) {
    const l = me.lanes[i];
    if (!laneActive(l)) { lanes.push(b.kind === 'field' ? 'hold' : side === 'att' ? 'storm' : 'hold'); continue; }
    let o: LaneOrder;
    if (b.kind === 'field') {
      if (l.morale < 30 && ratio < 0.8) o = 'withdraw';
      else {
        const pool: LaneOrder[] = side === 'def' ? ['hold', 'hold', 'volley', 'attack', 'flank'] : ['attack', 'attack', 'flank', 'charge', 'volley'];
        if (me.mix.cav > 0.3) pool.push('charge', 'flank');
        if (me.mix.gun > 0.15) pool.push('volley');
        if (ratio < 0.7) pool.push('hold', 'hold');
        o = rng.pick(pool);
      }
    } else if (side === 'att') {
      if (ratio < 1.2 && b.wall > 60) o = rng.chance(0.6) ? 'blockade' : (me.mix.gun > 0.1 ? 'bombard' : 'sap');
      else if (b.wall > 50) o = rng.pick(me.mix.gun > 0.1 ? ['bombard', 'bombard', 'sap', 'storm'] : ['sap', 'sap', 'storm']);
      else o = rng.pick(['storm', 'storm', 'bombard']);
    } else {
      o = b.wall < 50 ? rng.pick(['repair', 'hold', 'volley']) : rng.pick(['hold', 'volley', 'volley', 'sortie']);
    }
    lanes.push(o);
  }
  let stratagem: Stratagem | undefined;
  const legal = legalStratagems(b, side);
  if (legal.length && rng.chance(0.35)) {
    const best = legal.map(k => ({ k, p: stratagemChance(b, side, k) })).sort((x, y) => y.p - x.p)[0];
    if (best.p > 0.35) stratagem = best.k;
  }
  return { lanes, stratagem };
}

export function autoResolve(b: BattleState): BattleState {
  let cur = b;
  for (let guard = 0; !cur.over && guard < 20; guard++) cur = resolveRound(cur, aiChoice(cur, 'att'), aiChoice(cur, 'def'));
  return cur;
}

export function lossesOf(b: BattleState, side: 'att' | 'def'): number {
  return b[side].startTroops - sideTroops(b[side]);
}

export function outcomeText(b: BattleState): string {
  const w = b.winner === 'att' ? b.att : b.def;
  switch (b.outcome) {
    case 'surrender': return `${b.nodeName}守将开城出降，${b.att.name}兵不血刃入城。`;
    case 'breach': return `${b.att.name}破${b.nodeName}城。`;
    case 'blockade': return `${b.att.name}本月未攻，只围困${b.nodeName}。`;
    case 'repulsed': return `${b.def.name}击退${b.att.name}。`;
    case 'held': return b.kind === 'siege' ? `${b.nodeName}守住了。` : `两军相持，${b.def.name}守住阵地。`;
    case 'rout': return `${w.name}大胜，${(b.winner === 'att' ? b.def : b.att).name}溃走。`;
    default: return `两军各自收兵。`;
  }
}
