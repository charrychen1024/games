/* 战斗：战役层与即时战斗之间的接口。
 * 进来一场战斗（双方兵力、兵种、主将、地形、天候、城防），出去伤亡、城防、胜负。
 * 攻城、守城的即时模拟在 siege.ts；野战、水战在 field.ts。两者手动与自动用同一套规则，autoResolve 只是由部将代为指挥、快进打完。 */
import type { TroopMix } from './types';
import { runSiege, toBattleResult } from './siege';
import { runField, toFieldResult } from './field';

export type BattleKind = 'field' | 'siege' | 'naval';
/** 兵力暂存：沿用“三份”的格式，只作战役层写回伤亡与士气之用 */
export interface Lane { troops: number; morale: number; routed: boolean; withdrawn: boolean }
export interface BattleSide {
  faction: string;
  name: string;
  commander: string;
  commanderName: string;
  tong: number;
  mou: number;
  wai: number;
  /** 本方主将的降意（攻方劝降守将时看这个） */
  surrender: number;
  mix: TroopMix;
  lanes: Lane[];
  stratagems: number;
  armies: string[];
  /** 守城一方是否含城中驻军 */
  garrison: boolean;
  startTroops: number;
  reserve?: number;
}
export type Terrain = 'plain' | 'river' | 'hills' | 'city' | 'water';
export type Weather = 'clear' | 'rain' | 'wind' | 'fog';
export type Outcome = 'breach' | 'surrender' | 'repulsed' | 'blockade' | 'rout' | 'held' | 'stalemate' | 'retreat' | 'collapse' | 'abandon';

export interface BattleState {
  id: string;
  kind: BattleKind;
  node: string;
  nodeName: string;
  terrain: Terrain;
  weather: Weather;
  /** 战斗历时（以三十息为一“合”计，只作记录） */
  round: number;
  att: BattleSide;
  def: BattleSide;
  wall: number;
  seed: number;
  over: boolean;
  winner?: 'att' | 'def';
  outcome?: Outcome;
  /** 守将被说降（献城） */
  surrendered?: boolean;
  /** 攻城：上一战留下的各段城防与城门完好程度（0—1），本战从这里打起 */
  segs?: number[];
  gate?: number;
  /** 野战日暮收兵时的战果 */
  verdict?: '小胜' | '相持' | '小挫';
}

export const sideTroops = (s: BattleSide) => s.lanes.reduce((n, l) => n + l.troops, 0) + (s.reserve ?? 0);

export function makeSide(p: Omit<BattleSide, 'lanes' | 'startTroops'> & { troops: number; morale: number }): BattleSide {
  const t = p.troops;
  const split = [0.3, 0.4, 0.3].map(f => Math.round(t * f));
  split[1] += t - split.reduce((a, x) => a + x, 0);
  const { troops: _t, morale, ...rest } = p;
  return { ...rest, lanes: split.map(n => ({ troops: n, morale, routed: false, withdrawn: false })), startTroops: t };
}

export function createBattle(p: { id: string; kind: BattleKind; node: string; nodeName: string; terrain: Terrain; weather: Weather; att: BattleSide; def: BattleSide; wall?: number; segs?: number[]; gate?: number; seed: number }): BattleState {
  return { ...p, round: 0, wall: p.wall ?? 0, over: false };
}

/** 由部将代为指挥，快进打完（与玩家亲征同一套模拟） */
export function autoResolve(b: BattleState): BattleState {
  if (b.kind === 'siege') return toBattleResult(b, runSiege(b));
  return toFieldResult(b, runField(b));
}

export function lossesOf(b: BattleState, side: 'att' | 'def'): number {
  return b[side].startTroops - sideTroops(b[side]);
}

export function outcomeText(b: BattleState): string {
  const w = b.winner === 'att' ? b.att : b.def, l = b.winner === 'att' ? b.def : b.att;
  switch (b.outcome) {
    case 'surrender': return `${b.nodeName}守将开城出降，${b.att.name}入城。`;
    case 'breach': return `${b.att.name}破${b.nodeName}城。`;
    case 'blockade': return `${b.att.name}本月未攻，只围困${b.nodeName}。`;
    case 'repulsed': return `${b.def.name}击退${b.att.name}。`;
    case 'held':
      if (b.kind === 'siege') return `${b.nodeName}守住了。`;
      if (b.verdict === '小胜') return `日暮收兵，${w.name}小胜。`;
      return b.kind === 'naval' ? `日暮收兵，两军水师相持，${b.def.name}守住江面。` : `日暮收兵，两军相持，${b.def.name}守住阵地。`;
    case 'rout': return `${w.name}大胜，${l.name}溃走。`;
    case 'collapse': return `${l.name}军心崩溃，${w.name}大胜。`;
    case 'retreat': return b.kind === 'siege' ? `${b.att.name}收兵回营，${b.nodeName}未克。` : `${l.name}鸣金收兵，${w.name}据有战场。`;
    case 'abandon': return `${b.def.name}弃${b.nodeName}而走，${b.att.name}入城。`;
    default: return `两军各自收兵。`;
  }
}
