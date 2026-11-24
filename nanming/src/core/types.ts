/* 南明 · 规则核心的数据类型。局势（GameState）必须是可 JSON 序列化的纯数据。 */

export type NodeId = string;
export type FactionId = string;
export type PolityId = string;
export type CharId = string;
export type ArmyId = string;

/* ---------- 静态地理 ---------- */
export type NodeKind = 'city' | 'pass' | 'ferry' | 'port' | 'region' | 'outland';
export interface MapNode {
  id: NodeId;
  name: string;
  kind: NodeKind;
  lon: number;
  lat: number;
  /** 细做节点（true）或粗粒度大区（false） */
  detail: boolean;
  /** 所属区域，用于胜利条件与月报分组 */
  area: string;
  /** 远看时也显示名字 */
  major?: boolean;
  /** 府治等级说明，如“应天府”“直隶州” */
  title?: string;
  note?: string;
}
export type RouteKind = 'land' | 'river' | 'canal' | 'sea';
export interface Route {
  a: NodeId;
  b: NodeId;
  kind: RouteKind;
  /** 通行天数（步骑） */
  days: number;
}

/* ---------- 政权 / 势力 / 人物 ---------- */
export interface Era { name: string; /** 元年所在公历年 */ firstYear: number; /** 自此回合起显示 */ fromTurn: number }
export interface Polity {
  id: PolityId;
  name: string;
  /** 旗上的字 */
  mark: string;
  /** 旗形：tri 三角牙旗 / rect 方旗 / swallow 燕尾旗 / banner 镶边长旗 */
  flag: 'tri' | 'rect' | 'swallow' | 'banner';
  eras: Era[];
}

export type Stance = 'war' | 'neutral' | 'truce' | 'alliance' | 'overlord' | 'vassal';
export interface Faction {
  id: FactionId;
  name: string;
  short: string;
  color: string;
  polity: PolityId;
  leader: CharId;
  capital: NodeId;
  /** 奉谁号令（下属军镇） */
  overlord?: FactionId;
  /** 下属对上级的服从度 0-100 */
  loyalty?: number;
  playable: boolean;
  /** 退出天下之争 */
  defunct?: boolean;
  /** 多省地方官府的合称：首领只能处分自己所守之城，不能把整个集团带走 */
  admin?: boolean;
  /** 电脑战略倾向说明（随时间变化，见 ai.ts） */
  doctrine: string;
}

export interface Abilities { tong: number; zheng: number; mou: number; wai: number; wang: number }
export interface AttitudeLog { turn: number; field: keyof Attitudes; delta: number; reason: string; src?: string }
export interface Attitudes {
  /** 对本势力（或上级）的忠诚 0-100 */
  loyalty: number;
  /** 降意 0-100，高则易被劝降、易献城 */
  surrender: number;
  /** 主战 -100（主和）~ 100（主战） */
  hawk: number;
}
/** offstage：尚未登场（到 appear 回合或由事件、征辟引出） */
export type CharStatus = 'active' | 'captured' | 'dead' | 'offstage';
export interface Character {
  id: CharId;
  name: string;
  faction: FactionId;
  title: string;
  ab: Abilities;
  att: Attitudes;
  attLog: AttitudeLog[];
  location: NodeId;
  status: CharStatus;
  bio: string;
  /** 登场回合（offstage 人物） */
  appear?: number;
  /** 女子：画像不画须、换发式 */
  female?: boolean;
  /** 宗室：可被拥立；era 为即位后所用年号 */
  royal?: { era: string; claim: number };
}

/* ---------- 城池 ---------- */
export type Policy = 'balanced' | 'agri' | 'commerce' | 'fortify' | 'relief' | 'edu' | 'levy';
export interface City {
  id: NodeId;
  controller: FactionId;
  governor?: CharId;
  /** 人口（万口） */
  pop: number;
  /** 民心 0-100 */
  minxin: number;
  /** 吏治 0-100 */
  order: number;
  agri: number;
  commerce: number;
  edu: number;
  /** 城防 0-100 */
  wall: number;
  /** 驻军（人） */
  garrison: number;
  /** 仓粮（石） */
  grain: number;
  /** 府库（两） */
  silver: number;
  policy: Policy;
  /** 港口城市的海贸收入系数 */
  trade?: number;
  /** 考据不确定标注 */
  uncertain?: string;
  /** 本月已募兵数（recruitTurn 为所记月份，跨月自动作废） */
  recruitTurn?: number;
  recruitN?: number;
}

/* ---------- 军队与围城 ---------- */
export interface TroopMix { inf: number; cav: number; gun: number; navy: number }
export type ArmyOrder =
  | { kind: 'hold' }
  | { kind: 'move'; target: NodeId; attack: boolean }
  | { kind: 'siege'; target: NodeId; assault: boolean };
export interface Army {
  id: ArmyId;
  name: string;
  faction: FactionId;
  commander: CharId;
  troops: number;
  mix: TroopMix;
  morale: number;
  location: NodeId;
  /** 正在走的路线（下一站在前） */
  path: NodeId[];
  /** 当前路段已走天数 */
  progress: number;
  order: ArmyOrder;
  /** 粮台：从哪座城支取粮饷 */
  supply: NodeId;
  /** 缺粮月数 */
  hunger: number;
}
export interface Siege {
  node: NodeId;
  attacker: FactionId;
  armies: ArmyId[];
  startTurn: number;
  months: number;
}

/* ---------- 命令 ---------- */
export type Order =
  | { id: string; kind: 'policy'; node: NodeId; policy: Policy }
  | { id: string; kind: 'appoint'; node: NodeId; char: CharId }
  | { id: string; kind: 'transfer'; from: NodeId; to: NodeId; grain: number; silver: number }
  | { id: string; kind: 'recruit'; node: NodeId; troops: number }
  | { id: string; kind: 'army'; army: ArmyId; order: ArmyOrder }
  | { id: string; kind: 'reinforce'; node: NodeId; army: ArmyId; troops: number }
  | { id: string; kind: 'envoy'; char: CharId; target: FactionId; aim: 'alliance' | 'truce' | 'peace' }
  | { id: string; kind: 'persuade'; char: CharId; node: NodeId }
  | { id: string; kind: 'command'; vassal: FactionId; army: ArmyId; order: ArmyOrder; silver: number }
  | { id: string; kind: 'reward'; vassal: FactionId; silver: number }
  | { id: string; kind: 'independence' }
  | { id: string; kind: 'war'; target: FactionId }
  | { id: string; kind: 'raise'; node: NodeId; char: CharId; troops: number; navy: boolean };

/** 跨月进行中的交涉 */
export interface Mission {
  id: string;
  order: Order;
  faction: FactionId;
  issuedTurn: number;
  arriveTurn: number;
}

/* ---------- 因果账 ---------- */
export type LedgerField = 'grain' | 'silver' | 'pop' | 'minxin' | 'garrison' | 'wall' | 'order' | 'agri' | 'commerce' | 'edu';
export interface CauseSrc { kind: 'order' | 'policy' | 'event' | 'battle' | 'siege' | 'upkeep' | 'income' | 'remit' | 'disaster' | 'diplomacy'; ref?: string; turn?: number }
export interface LedgerEntry {
  turn: number;
  node: NodeId;
  field: LedgerField;
  delta: number;
  text: string;
  src: CauseSrc;
}

/* ---------- 月报 ---------- */
export type ReportCat = '急报' | '军报' | '内政' | '交涉' | '人事' | '史事' | '线索' | '易主';
export interface ReportEntry {
  turn: number;
  cat: ReportCat;
  text: string;
  node?: NodeId;
  urgent?: boolean;
  /** 关联的因果账来源，用于“为什么” */
  src?: CauseSrc;
  /** 史实对照 */
  history?: string;
  /** 只给某个势力看（情报），缺省为玩家可见 */
  faction?: FactionId;
  /** 这条军报讲的是哪一类事：陷城、献城、归附、反正、交战、围城、解围、退兵、行军。演出与配声据此区分 */
  act?: ReportAct;
  /** 失去一方（易主）或攻方（交战、围城） */
  from?: FactionId;
  /** 得到一方（易主）或守方（交战、围城） */
  to?: FactionId;
  /** 号令（遣使、劝降、号令藩镇）的成败 */
  ok?: boolean;
  /** 使者从哪里出发（演出用） */
  origin?: NodeId;
  /** 史事与线索的声音基调 */
  tone?: 'lament' | 'death' | 'edict' | 'turn' | 'war' | 'court' | 'omen';
}
export type ReportAct = 'breach' | 'yield' | 'join' | 'revolt' | 'battle' | 'siege' | 'lift' | 'retreat' | 'march';

/* ---------- 史事与线索的运行记录 ---------- */
/** player：此事关乎玩家所选势力的作为，本局由玩家作主，只作史实提示、不按史实代行 */
export interface EventRecord { id: string; turn: number; variant: 'history' | 'altered' | 'player' }

export interface BattleRecord {
  id: string;
  turn: number;
  node: NodeId;
  kind: 'field' | 'siege' | 'naval';
  attacker: FactionId;
  defender: FactionId;
  winner: 'attacker' | 'defender';
  attLoss: number;
  defLoss: number;
  summary: string;
  manual: boolean;
}

/* ---------- 局势 ---------- */
export interface GameState {
  version: number;
  scenario: string;
  turn: number;
  seed: number;
  player: FactionId;
  factions: Record<FactionId, Faction>;
  relations: Record<string, { stance: Stance; until?: number }>;
  chars: Record<CharId, Character>;
  cities: Record<NodeId, City>;
  armies: Record<ArmyId, Army>;
  sieges: Record<NodeId, Siege>;
  missions: Mission[];
  /** 上个月提交、尚未执行完的下属号令（拖延） */
  delayed: Order[];
  ledger: LedgerEntry[];
  reports: ReportEntry[];
  events: EventRecord[];
  battles: BattleRecord[];
  /** 史事变量（如“扬州是否失守”之类的旗标） */
  flags: Record<string, number | string | boolean>;
  nextId: number;
  /** 结局 */
  ended?: { kind: 'unified' | 'undecided' | 'fallen' | 'trial_end'; text: string };
  /** 试玩模式：限定月数 */
  turnLimit?: number;
  /** 本局的年号更替（覆盖政权的预设年号） */
  eras?: Record<PolityId, Era[]>;
}
