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
  /** 特长（缺省按史或按能力推出，见 people.ts） */
  traits?: string[];
  /** 被俘时：为谁所执、何月被俘 */
  captor?: FactionId;
  capturedAt?: number;
  /** 招贤所得的地方人物 */
  gen?: boolean;
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
  /** 最近一次易主的月份（新附之地有降卒可收编） */
  takenTurn?: number;
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
  /** 本月已粜籴之量（石），tradeTurn 为所记月份 */
  tradeTurn?: number;
  tradeN?: number;
  /** 本月已募兵数（recruitTurn 为所记月份，跨月自动作废） */
  recruitTurn?: number;
  recruitN?: number;
}

/* ---------- 军队与围城 ---------- */
export interface TroopMix { inf: number; cav: number; gun: number; navy: number }
export type ArmyOrder =
  | { kind: 'hold' }
  | { kind: 'move'; target: NodeId; attack: boolean }
  /** then：进攻途中被此城挡住，拿下后接着开往的原定目标 */
  | { kind: 'siege'; target: NodeId; assault: boolean; then?: NodeId };
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
  /** 积欠饷银（两）与连续欠饷月数：短期挪用无大碍，久欠则军心低落、士卒逃散，补发可挽回 */
  arrears?: number;
  unpaid?: number;
  /** 守城出击之兵：战罢回城并入驻军 */
  sortie?: boolean;
  /** 军略：行军（稳进/急行，缺省常行）、粮秣（就粮/抄掠，缺省粮台）、坚守营垒 */
  pace?: 'steady' | 'forced';
  forage?: 'forage' | 'plunder';
  camp?: boolean;
  /** 战法：强攻、诱敌、夜袭（缺省临阵应变） */
  tactic?: 'rush' | 'lure' | 'night';
  /** 降卒：收编入伍、释归乡里（缺省按常例：破城收两成） */
  captives?: 'absorb' | 'release';
}
export interface Siege {
  node: NodeId;
  attacker: FactionId;
  armies: ArmyId[];
  startTurn: number;
  months: number;
  /** 上一次攻城留下的损坏：各段城墙城防、城门完好程度（0—1）。守军逐月修补。 */
  segs?: number[];
  gate?: number;
}

/* ---------- 命令 ---------- */
export type Order =
  | { id: string; kind: 'policy'; node: NodeId; policy: Policy }
  | { id: string; kind: 'appoint'; node: NodeId; char: CharId }
  | { id: string; kind: 'transfer'; from: NodeId; to: NodeId; grain: number; silver: number }
  | { id: string; kind: 'recruit'; node: NodeId; troops: number }
  /** 粜籴：grain 为正是买粮，为负是卖粮 */
  | { id: string; kind: 'trade'; node: NodeId; grain: number }
  /** 劝捐助饷 */
  | { id: string; kind: 'loan'; node: NodeId }
  | { id: string; kind: 'army'; army: ArmyId; order: ArmyOrder }
  /** 撤离：弃城而走，兵、银、粮（及百姓）退往本方另一城；焦土则带不走的尽毁 */
  | { id: string; kind: 'evacuate'; node: NodeId; to: NodeId; people?: boolean; scorch?: boolean }
  /** 改换粮台 */
  | { id: string; kind: 'supply'; army: ArmyId; node: NodeId }
  /** 军略：行军、粮秣、营垒（null 表示复归常例） */
  | { id: string; kind: 'conduct'; army: ArmyId; pace?: 'steady' | 'forced' | null; forage?: 'forage' | 'plunder' | null; camp?: boolean; tactic?: 'rush' | 'lure' | 'night' | null; captives?: 'absorb' | 'release' | null }
  | { id: string; kind: 'reinforce'; node: NodeId; army: ArmyId; troops: number }
  /** 裁兵：裁撤本城驻军（army 缺省）或在本城的某军若干人 */
  | { id: string; kind: 'disband'; node: NodeId; army?: ArmyId; troops: number }
  | { id: string; kind: 'envoy'; char: CharId; target: FactionId; aim: 'alliance' | 'truce' | 'peace' }
  | { id: string; kind: 'persuade'; char: CharId; node: NodeId }
  | { id: string; kind: 'command'; vassal: FactionId; army: ArmyId; order: ArmyOrder; silver: number }
  | { id: string; kind: 'reward'; vassal: FactionId; silver: number }
  | { id: string; kind: 'independence' }
  | { id: string; kind: 'war'; target: FactionId }
  | { id: string; kind: 'raise'; node: NodeId; char: CharId; troops: number; navy: boolean }
  /** 招贤：在本城延请地方人物 */
  | { id: string; kind: 'seek'; node: NodeId }
  /** 处置俘虏：劝降、释放、处斩 */
  | { id: string; kind: 'prisoner'; char: CharId; act: 'recruit' | 'release' | 'execute' | 'ransom' };

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
  /** 得城所获：城中存银存粮、收编的降卒、俘获的人物 */
  spoils?: { silver: number; grain: number; troops: number; captives: string[] };
  /** 号令（遣使、劝降、号令藩镇）的成败 */
  ok?: boolean;
  /** 使者从哪里出发（演出用） */
  origin?: NodeId;
  /** 史事与线索的声音基调 */
  tone?: 'lament' | 'death' | 'edict' | 'turn' | 'war' | 'court' | 'omen';
}
export type ReportAct = 'fall' | 'abandon' | 'breach' | 'yield' | 'join' | 'revolt' | 'battle' | 'siege' | 'lift' | 'retreat' | 'march';

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

/* ---------- 在途钱粮 ---------- */
export interface Convoy { id: string; faction: FactionId; from: NodeId; to: NodeId; grain: number; silver: number; troops?: number; pop?: number; sent: number; arrive: number; days: number; path: NodeId[] }

/* ---------- 局势 ---------- */
export interface GameState {
  version: number;
  scenario: string;
  turn: number;
  seed: number;
  player: FactionId;
  factions: Record<FactionId, Faction>;
  /** after：停战期满后回到的关系（缺省为交战；与中立之家互市通好，期满仍回中立） */
  relations: Record<string, { stance: Stance; until?: number; after?: Stance }>;
  chars: Record<CharId, Character>;
  cities: Record<NodeId, City>;
  armies: Record<ArmyId, Army>;
  sieges: Record<NodeId, Siege>;
  missions: Mission[];
  /** 上个月提交、尚未执行完的下属号令（拖延） */
  delayed: Order[];
  /** 在途钱粮：路远一月送不到的调拨，arrive 那月送达（粮已扣途耗）。旧档无此项 */
  convoys?: Convoy[];
  ledger: LedgerEntry[];
  reports: ReportEntry[];
  events: EventRecord[];
  battles: BattleRecord[];
  /** 史事变量（如“扬州是否失守”之类的旗标） */
  flags: Record<string, number | string | boolean>;
  nextId: number;
  /** 结局 */
  ended?: { kind: 'unified' | 'undecided' | 'fallen' | 'trial_end' | 'subject'; text: string;
    /** 统一时玩家的身份：lead 本方为天下之主；patron 奉明而主导统一（扶立之功）；follow 随所奉朝廷统一 */
    role?: 'lead' | 'patron' | 'follow' };
  /** 试玩模式：限定月数 */
  turnLimit?: number;
  /** 本局的年号更替（覆盖政权的预设年号） */
  eras?: Record<PolityId, Era[]>;
}
