/* 战斗：野战分左翼、中军、右翼三路；攻城战分左城、城门、右城三段。
 * 每回合双方给每一路下令，主将可施放有次数限制的计策。
 * resolveRound 是纯函数：同一战局 + 同一组选择 → 同一结果。自动结算只是由电脑代为选择。 */
import { rngFor, type Rng } from './rng';
import type { TroopMix } from './types';
import { runSiege, toBattleResult } from './siege';

export type FieldOrder = 'attack' | 'hold' | 'flank' | 'volley' | 'charge' | 'withdraw';
export type SiegeAttOrder = 'storm' | 'bombard' | 'sap' | 'blockade';
export type SiegeDefOrder = 'hold' | 'sortie' | 'volley' | 'repair';
export type NavalOrder = 'cannonade' | 'ram' | 'board' | 'fireship' | 'evade' | 'withdraw';
/** 包抄：本路当面之敌已空，转击邻路之敌的侧背 */
export type LaneOrder = FieldOrder | SiegeAttOrder | SiegeDefOrder | NavalOrder | 'envelop';
export type BattleKind = 'field' | 'siege' | 'naval';
/** 阵型：开战前择定，决定三路兵力分配与各自长短 */
export type Formation = 'arrow' | 'wings' | 'square' | 'goose';
export const FORM_NAME: Record<Formation, string> = { arrow: '锋矢阵', wings: '鹤翼阵', square: '方圆阵', goose: '雁行阵' };
export const FORM_HINT: Record<Formation, string> = {
  arrow: '中军加厚，正面冲击力强；两翼单薄易被迂回。',
  wings: '两翼张开，包抄迂回占便宜；中军较薄。',
  square: '四面结阵，各路受伤都少，但杀伤也弱。宜以少敌多。',
  goose: '前后错列，齐射炮击更猛；被骑兵冲撞时吃亏。',
};
const FORM_SPLIT: Record<Formation, number[]> = { arrow: [0.25, 0.5, 0.25], wings: [0.38, 0.24, 0.38], square: [0.33, 0.34, 0.33], goose: [0.3, 0.4, 0.3] };
export type Stratagem = 'ambush' | 'fire' | 'night' | 'persuade';

export const ORDER_NAME: Record<LaneOrder, string> = {
  attack: '进攻', hold: '坚守', flank: '迂回', volley: '齐射', charge: '突击', withdraw: '后撤',
  storm: '登城', bombard: '炮击', sap: '掘地', blockade: '围而不攻', sortie: '出城突击', repair: '修城',
  cannonade: '舷炮', ram: '冲犁', board: '接舷', fireship: '火船', evade: '游击', envelop: '包抄',
};
export const ORDER_HINT: Record<LaneOrder, string> = {
  envelop: '本路当面之敌已空，转击邻路之敌侧背：杀伤加重、敌军心动摇。',
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
  cannonade: '远距舷炮轰击，克接舷之敌；需有火器。',
  ram: '大船顺流冲犁，撞碎小船；怕游击闪避。',
  board: '靠帮接舷，步卒跳帮肉搏；怕舷炮。',
  fireship: '放火船顺风而下，有风时大成；无风难中。',
  evade: '轻舟游击，避实击虚，克冲犁；杀伤小。',
};
export const NAVAL_ORDERS: NavalOrder[] = ['cannonade', 'ram', 'board', 'fireship', 'evade', 'withdraw'];
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
export const LANE_NAMES: Record<BattleKind, string[]> = { field: ['左翼', '中军', '右翼'], siege: ['左城', '城门', '右城'], naval: ['左哨', '中军', '右哨'] };

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
  /** 预备队：不接战、不受损，可随时投入任一路 */
  reserve?: number;
  /** 主将已亲冲；负伤 */
  led?: boolean;
  wounded?: boolean;
}
export type Terrain = 'plain' | 'river' | 'hills' | 'city' | 'water';
export type Weather = 'clear' | 'rain' | 'wind' | 'fog';
/** lead：主将亲冲哪一路（每战一次）；commit：投入预备队；shift：从一路调兵到另一路；retreat：鸣金收兵 */
export interface Choice { lanes: LaneOrder[]; stratagem?: Stratagem; lead?: number; commit?: { lane: number; troops: number }; shift?: { from: number; to: number; troops: number }; retreat?: boolean }

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
  /** 主将亲冲 */
  leads?: { side: 'att' | 'def'; lane: number; wounded: boolean }[];
  /** 天候转变 */
  weather?: Weather;
  /** 包抄：某方从 from 路转击 to 路 */
  envelops?: { side: 'att' | 'def'; from: number; to: number; dmg: number }[];
  /** 投入预备队、调兵 */
  moves?: { side: 'att' | 'def'; kind: 'commit' | 'shift'; from?: number; to: number; troops: number }[];
  /** 鸣金收兵的一方 */
  retreat?: 'att' | 'def';
  wallBefore: number;
  wallAfter: number;
  text: string[];
}
export interface BattleState {
  id: string;
  kind: BattleKind;
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
  outcome?: 'breach' | 'surrender' | 'repulsed' | 'blockade' | 'rout' | 'held' | 'stalemate' | 'retreat' | 'collapse' | 'abandon';
  /** 守将被说降（献城） */
  surrendered?: boolean;
  /** 双方阵型 */
  form?: { att?: Formation; def?: Formation };
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
  // 水战
  cannonade: { cannonade: 0.9, ram: 1.1, board: 1.5, fireship: 1.3, evade: 0.6, withdraw: 0.9 },
  ram: { cannonade: 1.2, ram: 1.0, board: 1.25, fireship: 0.9, evade: 0.5, withdraw: 1.2 },
  board: { cannonade: 0.75, ram: 1.0, board: 1.0, fireship: 1.2, evade: 0.8, withdraw: 1.3 },
  fireship: { cannonade: 1.0, ram: 1.4, board: 1.3, fireship: 0.6, evade: 0.7, withdraw: 0.8 },
  evade: { cannonade: 0.8, ram: 1.35, board: 0.9, fireship: 1.1, evade: 0.5, withdraw: 0.7 },
};
/** 受伤倍数（被打时的防护）：坚守与城墙之后少受伤 */
const TAKEN: Record<string, number> = { hold: 0.7, withdraw: 0.55, attack: 1.0, flank: 1.1, volley: 1.05, charge: 1.0,
  storm: 1.2, bombard: 0.7, sap: 0.6, blockade: 0.4, sortie: 1.1, cannonade: 0.9, ram: 1.1, board: 1.15, fireship: 0.9, evade: 0.6 };

function mixFactor(order: LaneOrder, mix: TroopMix): number {
  switch (order) {
    case 'charge': return 0.35 + mix.cav * 2.0;
    case 'volley': return 0.6 + mix.gun * 2.5;
    case 'bombard': return 0.2 + mix.gun * 3.5;
    case 'flank': return 0.7 + mix.cav * 0.8;
    case 'attack': case 'storm': return 0.8 + mix.inf * 0.4;
    case 'cannonade': return 0.4 + mix.gun * 2.5;
    case 'ram': return 0.5 + mix.navy * 1.2;
    case 'board': return 0.7 + mix.inf * 0.6;
    case 'evade': return 0.5 + mix.navy * 0.5;
    default: return 1;
  }
}

export const sideTroops = (s: BattleSide) => s.lanes.reduce((n, l) => n + l.troops, 0) + (s.reserve ?? 0);
export const laneActive = (l: Lane) => !l.routed && !l.withdrawn && l.troops > 0;
const sideActive = (s: BattleSide) => s.lanes.some(laneActive);

export function makeSide(p: Omit<BattleSide, 'lanes' | 'startTroops'> & { troops: number; morale: number }): BattleSide {
  const t = p.troops;
  const split = [0.3, 0.4, 0.3].map(f => Math.round(t * f));
  const { troops: _t, morale, ...rest } = p;
  return { ...rest, lanes: split.map(n => ({ troops: n, morale, routed: false, withdrawn: false })), startTroops: t };
}

export function createBattle(p: { id: string; kind: BattleKind; node: string; nodeName: string; terrain: Terrain; weather: Weather; att: BattleSide; def: BattleSide; wall?: number; seed: number }): BattleState {
  // 回合数不定：一方崩溃、溃散、收兵即止；maxRounds 只是“日暮”——再打不下去，两军各自收兵
  return { ...p, round: 0, maxRounds: p.kind === 'siege' ? 6 : 8, wall: p.wall ?? 0, log: [], over: false };
}

/** 布阵：开战前（第 0 回合）择阵型；可另给 [左, 中, 右, 预备] 四份比例自定分兵（空出一路也行）。
 * 攻城一方只分兵、不择阵（城下无从列阵）；守城一方沿城分守，不在此调。 */
export function deploy(b0: BattleState, side: 'att' | 'def', f: Formation, split?: number[]): BattleState {
  if (b0.round > 0 || (b0.kind === 'siege' && (side === 'def' || !split))) return b0;
  const b = structuredClone(b0);
  if (b.kind !== 'siege') b.form = { ...(b.form ?? {}), [side]: f };
  const t = sideTroops(b[side]);
  const sp = split ? normSplit(split) : [...FORM_SPLIT[f], 0];
  const parts = sp.map(x => Math.round(t * x));
  parts[3] = t - parts[0] - parts[1] - parts[2];
  b[side].lanes.forEach((l, i) => { l.troops = parts[i]; l.routed = false; l.withdrawn = false; });
  b[side].reserve = Math.max(0, parts[3]);
  return b;
}
function normSplit(s: number[]): number[] {
  const v = [0, 1, 2, 3].map(i => Math.max(0, s[i] ?? 0));
  const sum = v.reduce((a, x) => a + x, 0) || 1;
  return v.map(x => x / sum);
}
export const FORM_DEFAULT_SPLIT = (f: Formation) => [...FORM_SPLIT[f], 0];
/** 某一路此刻可下的令：当面之敌已空、别路尚有敌时，可包抄 */
export function laneOrders(b: BattleState, side: 'att' | 'def', i: number): LaneOrder[] {
  const base = legalOrders(b, side);
  const foe = b[side === 'att' ? 'def' : 'att'];
  // 攻城时城墙各段相连，空出的一段由“登城”直入（城防骤降），不另设包抄
  if (b.kind === 'siege') return base;
  if (!laneActive(foe.lanes[i]) && foe.lanes.some(laneActive) && laneActive(b[side].lanes[i])) return ['envelop', ...base];
  return base;
}
/** 电脑择阵：骑多锋矢，火器多雁行，兵少方圆，否则鹤翼 */
export function aiFormation(b: BattleState, side: 'att' | 'def'): Formation {
  const me = b[side], foe = b[side === 'att' ? 'def' : 'att'];
  const ratio = sideTroops(me) / Math.max(1, sideTroops(foe));
  if (ratio < 0.7) return 'square';
  if (me.mix.gun > 0.22) return 'goose';
  if (me.mix.cav > 0.3 || b.kind === 'naval') return 'arrow';
  return 'wings';
}
const FORM_DMG: Record<Formation, (lane: number, order: LaneOrder) => number> = {
  arrow: l => (l === 1 ? 1.3 : 1),
  wings: (l, o) => (l !== 1 && (o === 'flank' || o === 'charge' || o === 'ram') ? 1.25 : l === 1 ? 0.92 : 1),
  square: () => 0.9,
  goose: (_l, o) => (o === 'volley' || o === 'cannonade' ? 1.3 : 1),
};
const FORM_TAKEN: Record<Formation, (lane: number, foeOrder: LaneOrder) => number> = {
  arrow: l => (l !== 1 ? 1.15 : 1),
  wings: l => (l === 1 ? 1.15 : 1),
  square: () => 0.8,
  goose: (_l, o) => (o === 'charge' || o === 'ram' ? 1.2 : 1),
};

/** 探马：预判敌方三路的去向。谋略高则准；返回每路所报命令与可信度 */
export function scout(b: BattleState, side: 'att' | 'def'): { orders: LaneOrder[]; sure: number } {
  const foe = side === 'att' ? 'def' : 'att';
  const real = aiChoice(b, foe).lanes;
  const sure = Math.max(0.35, Math.min(0.9, 0.55 + (b[side].mou - b[foe].mou) / 120));
  const rng = rngFor(b.seed, 'scout', side, b.round);
  const legal = legalOrders(b, foe);
  return { orders: real.map(o => (rng.next() < sure ? o : rng.pick(legal.filter(x => x !== o)) ?? o)), sure };
}
/** 我方命令对敌方命令的克制倍数（供界面标“克”“被克”） */
export function counterOf(b: BattleState, side: 'att' | 'def', mine: LaneOrder, theirs: LaneOrder): number {
  const key = b.kind === 'siege' && side === 'def' ? 'd:' + mine : mine;
  const k2 = b.kind === 'siege' && side === 'att' ? 'd:' + theirs : theirs;
  const a = M[key]?.[theirs] ?? 0.8, d = M[k2]?.[mine] ?? 0.8;
  return a / Math.max(0.05, d);
}

export function legalOrders(b: BattleState, side: 'att' | 'def'): LaneOrder[] {
  if (b.kind === 'field') return FIELD_ORDERS;
  if (b.kind === 'naval') return b[side].mix.gun < 0.05 ? NAVAL_ORDERS.filter(o => o !== 'cannonade') : NAVAL_ORDERS;
  if (side === 'att') return b.att.mix.gun < 0.05 ? SIEGE_ATT_ORDERS.filter(o => o !== 'bombard') : SIEGE_ATT_ORDERS;
  return SIEGE_DEF_ORDERS;
}

export function legalStratagems(b: BattleState, side: 'att' | 'def'): Stratagem[] {
  const s = b[side];
  if (s.stratagems <= 0) return [];
  const list: Stratagem[] = ['night', 'persuade'];
  if (b.kind === 'field') list.unshift('ambush');
  if (b.kind !== 'siege' || side === 'def') list.splice(1, 0, 'fire');
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
  let b: BattleState = structuredClone(b0);
  // 未布阵的一方由部将按常法布阵
  if (b.round === 0 && b.kind !== 'siege') for (const sd of ['att', 'def'] as const) if (!b.form?.[sd]) b = deploy(b, sd, aiFormation(b, sd));
  b.round++;
  const rng = rngFor(b.seed, 'round', b.round);
  const log: RoundLog = { round: b.round, lanes: [], stratagems: [], wallBefore: b.wall, wallAfter: b.wall, text: [] };
  const mods = { att: { dmg: 1, morale: 0 }, def: { dmg: 1, morale: 0 } };
  const laneDmg = { att: [1, 1, 1], def: [1, 1, 1] };
  // 天候转变
  if (b.round >= 2) {
    const wr = rngFor(b.seed, 'weather', b.round);
    if (wr.chance(0.14)) {
      const nw = wr.pick((['clear', 'rain', 'wind', 'fog'] as Weather[]).filter(w => w !== b.weather));
      b.weather = nw; log.weather = nw;
      log.text.push({ clear: '云开日出，视野大开。', rain: '天降大雨，火器难以施放。', wind: '狂风大作，旌旗猎猎，宜于纵火。', fog: '大雾弥漫，两军难辨。' }[nw]);
    }
  }
  // 投入预备队、调兵（先于交锋）
  for (const side of ['att', 'def'] as const) {
    const c = side === 'att' ? attC : defC;
    const me = b[side];
    if (c.commit && (me.reserve ?? 0) > 0 && me.lanes[c.commit.lane]) {
      const n = Math.max(0, Math.min(me.reserve ?? 0, Math.round(c.commit.troops)));
      const l = me.lanes[c.commit.lane];
      if (n > 0) {
        const m0 = laneActive(l) ? l.morale : 0;
        l.morale = Math.round((m0 * (laneActive(l) ? l.troops : 0) + Math.max(60, m0) * n) / Math.max(1, (laneActive(l) ? l.troops : 0) + n));
        if (!laneActive(l)) { l.troops = 0; l.routed = false; l.withdrawn = false; }
        l.troops += n; me.reserve = (me.reserve ?? 0) - n;
        (log.moves ??= []).push({ side, kind: 'commit', to: c.commit.lane, troops: n });
        log.text.push(`${me.name}投入预备队 ${n} 人增援${LANE_NAMES[b.kind][c.commit.lane]}。`);
      }
    }
    if (c.shift && c.shift.from !== c.shift.to && me.lanes[c.shift.from] && me.lanes[c.shift.to] && laneActive(me.lanes[c.shift.from])) {
      const a = me.lanes[c.shift.from], d = me.lanes[c.shift.to];
      const n = Math.max(0, Math.min(a.troops - (a.troops > c.shift.troops ? 0 : 0), Math.round(c.shift.troops)));
      if (n > 0) {
        a.troops -= n;
        if (a.troops < 150) a.withdrawn = true;
        if (!laneActive(d)) { d.troops = 0; d.routed = false; d.withdrawn = false; d.morale = a.morale; }
        d.morale = Math.round((d.morale * d.troops + a.morale * n) / Math.max(1, d.troops + n));
        d.troops += n;
        (log.moves ??= []).push({ side, kind: 'shift', from: c.shift.from, to: c.shift.to, troops: n });
        log.text.push(`${me.name}自${LANE_NAMES[b.kind][c.shift.from]}调 ${n} 人往${LANE_NAMES[b.kind][c.shift.to]}。`);
      }
    }
  }
  // 鸣金收兵：本合即撤出战场，敌军追击有所斩获（骑兵多则追得狠）
  for (const side of ['att', 'def'] as const) {
    const c = side === 'att' ? attC : defC;
    if (!c.retreat || (b.kind === 'siege' && side === 'def')) continue;
    const me = b[side], foe = b[side === 'att' ? 'def' : 'att'];
    const k = 0.05 + foe.mix.cav * 0.12;
    let lost = 0;
    for (const l of me.lanes) if (laneActive(l)) { const n = Math.round(l.troops * k); l.troops -= n; lost += n; l.withdrawn = true; }
    log.retreat = side;
    log.text.push(`${me.commanderName}鸣金收兵，${me.name}撤出战场；${foe.name}追击，斩获 ${lost} 人。`);
    b.over = true; b.winner = side === 'att' ? 'def' : 'att'; b.outcome = 'retreat';
    log.wallAfter = Math.round(b.wall);
    b.log.push(log);
    return b;
  }
  // 久战疲惫：第四合起，各路士气逐合下降
  if (b.round >= 4) {
    const tire = 3 * (b.round - 3);
    // 守城一方据墙轮番换防，不计疲惫；攻城一方顿兵坚城之下，越久越乏
    for (const sd of (b.kind === 'siege' ? ['att'] : ['att', 'def']) as ('att' | 'def')[]) for (const l of b[sd].lanes) if (laneActive(l)) l.morale = Math.max(0, l.morale - tire);
    log.text.push(b.kind === 'siege' ? `顿兵坚城之下，攻城士卒疲惫（士气 −${tire}）。` : `鏖战日久，两军士卒疲惫（士气 −${tire}）。`);
  }
  // 主将亲冲：一路大振，全军士气上扬；有负伤之险
  for (const side of ['att', 'def'] as const) {
    const c = side === 'att' ? attC : defC;
    const me = b[side];
    if (c.lead === undefined || me.led || !laneActive(me.lanes[c.lead] ?? { troops: 0, morale: 0, routed: true, withdrawn: true })) continue;
    me.led = true;
    laneDmg[side][c.lead] *= 1.45;
    for (const l of me.lanes) if (laneActive(l)) l.morale = Math.min(100, l.morale + 8);
    const foe = b[side === 'att' ? 'def' : 'att'];
    const hurt = rngFor(b.seed, 'lead', side, b.round).next() < 0.12 + Math.max(0, (foe.tong - me.tong) / 300);
    if (hurt) { me.wounded = true; mods[side].morale -= 18; }
    (log.leads ??= []).push({ side, lane: c.lead, wounded: hurt });
    log.text.push(`${me.commanderName}亲率${LANE_NAMES[b.kind][c.lead]}冲阵，全军奋勇。${hurt ? `${me.commanderName}中箭负伤，军心动摇。` : ''}`);
  }

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
      if (aOn && ao === 'bombard') b.wall -= Math.min(9, la.troops * mixFactor('bombard', b.att.mix) / 2800) * rng.jitter(0.3); // 回合不再定死为四，单合炮击之效相应放缓，坚城仍须数月
      if (aOn && ao === 'sap') b.wall -= 4 * rng.jitter(0.4) * (dOrd === 'sortie' && dOn ? 0.3 : 1);
      if (dOn && dOrd === 'repair') b.wall += 5;
    }
    if (aOn && dOn) {
      const fa = b.form?.att, fd = b.form?.def;
      const pa = power(b, 'att', la, ao, dOrd, rng) * mods.att.dmg * laneDmg.att[i] * (fa ? FORM_DMG[fa](i, ao) : 1);
      const pd = power(b, 'def', ld, dOrd, ao, rng) * mods.def.dmg * laneDmg.def[i] * (fd ? FORM_DMG[fd](i, dOrd) : 1);
      let lossD = pa * (TAKEN[b.kind === 'siege' ? (dOrd === 'sortie' ? 'sortie' : 'hold') : dOrd] ?? 1) * (fd ? FORM_TAKEN[fd](i, ao) : 1);
      let lossA = pd * (TAKEN[ao] ?? 1) * (fa ? FORM_TAKEN[fa](i, dOrd) : 1);
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
  // 包抄：当面无敌的一路转击邻近之敌，杀伤加重、敌军心动摇；自身只受零星反击
  for (const side of ['att', 'def'] as const) {
    const c = side === 'att' ? attC : defC;
    const me = b[side], foeKey = side === 'att' ? 'def' : 'att', foe = b[foeKey];
    for (let i = 0; i < 3; i++) {
      if (c.lanes[i] !== 'envelop' || !laneActive(me.lanes[i]) || laneActive(foe.lanes[i])) continue;
      const targets = [0, 1, 2].filter(j => j !== i && laneActive(foe.lanes[j])).sort((x, y) => Math.abs(x - i) - Math.abs(y - i));
      const j = targets[0];
      if (j === undefined) continue;
      const fo = ((foeKey === 'att' ? attC : defC).lanes[j] ?? 'hold') as LaneOrder;
      const dmg = Math.min(foe.lanes[j].troops, Math.round(power(b, side, me.lanes[i], 'flank', fo, rng) * 1.3 * mods[side].dmg * (b.kind === 'siege' ? 1 - b.wall / 160 : 1)));
      const back = Math.min(me.lanes[i].troops, Math.round(dmg * 0.25));
      foe.lanes[j].troops -= dmg; me.lanes[i].troops -= back;
      foe.lanes[j].morale = Math.max(0, foe.lanes[j].morale - 8 - (dmg / Math.max(1, foe.lanes[j].troops + dmg)) * 100);
      const ev = log.lanes[j];
      if (side === 'att') { ev.defLoss += dmg; log.lanes[i].attLoss += back; } else { ev.attLoss += dmg; log.lanes[i].defLoss += back; }
      (log.envelops ??= []).push({ side, from: i, to: j, dmg });
      log.text.push(`${me.name}${LANE_NAMES[b.kind][i]}包抄${LANE_NAMES[b.kind][j]}之敌侧背，斩获 ${dmg} 人。`);
      const fl = foe.lanes[j];
      if (!fl.routed && (fl.morale < 18 || fl.troops < 150)) { fl.routed = true; if (side === 'att') ev.defRouted = true; else ev.attRouted = true; }
    }
  }
  // 军心崩溃：全军加权士气过低，各路一齐溃散
  for (const sd of ['att', 'def'] as const) {
    const me = b[sd];
    const act = me.lanes.filter(laneActive);
    const tot = act.reduce((n, l) => n + l.troops, 0);
    if (!tot) continue;
    const avg = act.reduce((n, l) => n + l.morale * l.troops, 0) / tot;
    if (avg < 24 && !(b.kind === 'siege' && sd === 'def' && b.wall >= 25)) {
      for (const l of act) l.routed = true;
      log.text.push(`${me.name}军心崩溃，全线溃散。`);
      (b as BattleState & { collapsed?: string }).collapsed = sd;
    }
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
  if ((my === 'volley' || my === 'cannonade') && b.weather === 'rain') m *= 0.5;
  if (my === 'fireship') m *= b.weather === 'wind' ? 1.6 : b.weather === 'rain' ? 0.4 : 0.85;
  if (b.kind === 'field' && side === 'def' && my === 'hold' && b.terrain === 'hills') m *= 1.2;
  if (b.kind === 'field' && side === 'att' && b.terrain === 'river') m *= 0.9;
  const morale = 0.45 + lane.morale / 180;
  const cmd = 0.8 + s.tong / 250;
  return lane.troops * 0.07 * m * mixFactor(my, s.mix) * morale * cmd * rng.jitter(0.2);
}

function settle(b: BattleState, attC: Choice) {
  // 各路皆溃而预备队尚在：预备队自动顶上中路，战斗未完
  for (const sd of ['att', 'def'] as const) {
    const me = b[sd];
    if (!sideActive(me) && (me.reserve ?? 0) >= 300 && !(b as BattleState & { collapsed?: string }).collapsed) {
      const l = me.lanes[1]; l.troops = me.reserve!; l.routed = false; l.withdrawn = false; l.morale = 55; me.reserve = 0;
      b.log[b.log.length - 1]?.text.push(`${me.name}预备队顶上中路。`);
    }
  }
  const collapsed = (b as BattleState & { collapsed?: string }).collapsed;
  delete (b as BattleState & { collapsed?: string }).collapsed;
  const attOn = sideActive(b.att), defOn = sideActive(b.def);
  if (collapsed && b.kind !== 'siege') { b.over = true; b.winner = collapsed === 'att' ? 'def' : 'att'; b.outcome = 'collapse'; return; }
  if (b.kind === 'siege') {
    const breach = b.wall <= 0 || (b.wall < 25 && !defOn);
    if (breach && attOn) { b.over = true; b.winner = 'att'; b.outcome = 'breach'; return; }
    if (!attOn) { b.over = true; b.winner = 'def'; b.outcome = attC.lanes.every(o => o === 'blockade') ? 'blockade' : 'repulsed'; return; }
    if (!defOn && b.wall >= 25) {
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
    if (laneOrders(b, side, i).includes('envelop')) { lanes.push('envelop'); continue; }
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
    } else if (b.kind === 'naval') {
      if (l.morale < 30 && ratio < 0.8) o = 'withdraw';
      else {
        const pool: LaneOrder[] = ['ram', 'board', 'evade'];
        if (me.mix.gun > 0.1) pool.push('cannonade', 'cannonade');
        if (b.weather === 'wind') pool.push('fireship', 'fireship');
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
  // 预备队：最吃紧的一路投入
  let commit: Choice['commit'];
  if ((me.reserve ?? 0) > 0 && b.round >= 1) {
    let w = -1; me.lanes.forEach((l, i) => { if (laneActive(l) && (w < 0 || l.morale < me.lanes[w].morale)) w = i; });
    if (w >= 0) commit = { lane: w, troops: me.reserve! };
  }
  // 大势已去：兵不及敌三成而士气低落，收兵保全
  const avgM = me.lanes.filter(laneActive).reduce((n, l) => n + l.morale * l.troops, 0) / Math.max(1, me.lanes.filter(laneActive).reduce((n, l) => n + l.troops, 0));
  const retreat = b.kind !== 'siege' && ratio < 0.35 && avgM < 40 ? true : b.kind === 'siege' && side === 'att' && ratio < 0.6 && b.round >= 3 ? true : undefined;
  return { lanes, stratagem, ...(commit ? { commit } : {}), ...(retreat ? { retreat } : {}) };
}

export function autoResolve(b: BattleState): BattleState {
  // 攻城：即时模拟快进（与玩家亲征同一套）
  if (b.kind === 'siege') return toBattleResult(b, runSiege(b));
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
    case 'held': return b.kind === 'siege' ? `${b.nodeName}守住了。` : b.kind === 'naval' ? `两军水师相持，${b.def.name}守住江面。` : `两军相持，${b.def.name}守住阵地。`;
    case 'rout': return `${w.name}大胜，${(b.winner === 'att' ? b.def : b.att).name}溃走。`;
    case 'collapse': return `${(b.winner === 'att' ? b.def : b.att).name}军心崩溃，${w.name}大胜。`;
    case 'retreat': return b.kind === 'siege' ? `${b.att.name}收兵回营，${b.nodeName}未克。` : `${(b.winner === 'att' ? b.def : b.att).name}鸣金收兵，${w.name}守住战场。`;
    case 'abandon': return `${b.def.name}弃${b.nodeName}而走，${b.att.name}入城。`;
    default: return `两军各自收兵。`;
  }
}
