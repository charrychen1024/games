/* 野战、水战 · 即时模拟（与攻城同一套思路，见 Docs/战斗重做方案-2026-11-24.md）
 * 战场：横 0—1000、纵 0—1000。攻方在下（纵 1000 一侧是攻方的后方），守方在上（纵 0 一侧是守方的后方）。
 * 双方各拆成若干营（水战是船队）。每营：兵数、士气、体力、位置、所奉之令、当前情状。
 * 营与营之间有正面、侧翼、背后之分：被两营夹击、被抄到背后，杀伤更重、士气掉得更快。
 * 不分回合：以一方军心崩溃、一方鸣金退走、或日暮收兵结束。日暮按战果写小胜、相持、小挫，不会兵多而判负。
 * 纯逻辑：同一战局、同一组命令，结果完全相同（随机数只来自种子）。 */
import type { BattleState, BattleSide } from './battle';
import { makeRng, type Rng } from './rng';

export type FKind = 'inf' | 'cav' | 'gun' | 'art' | 'fire';
export type FState = 'idle' | 'move' | 'melee' | 'shoot' | 'rout' | 'gone';
export type FOrder =
  | { t: 'hold'; x?: number; y?: number }
  | { t: 'move'; x: number; y: number }
  | { t: 'attack'; target: string }      // 进击某营（骑兵带冲势时为冲锋）
  | { t: 'fire'; target?: string }       // 火器、炮：射某营（不给则射最近之敌）
  | { t: 'retreat' };                    // 撤出战场
export interface FUnit {
  id: string; side: 'att' | 'def'; kind: FKind; name: string;
  troops: number; start: number; morale: number; stamina: number;
  x: number; y: number; order: FOrder; state: FState;
  /** 正在接战或射击的对象（画面连线、飘字用） */
  target?: string;
  hit: number; engaged: boolean;
  /** 临阵状态：开战时每营抽一次（0.86–1.14），乘在战力上；加上全军的“将运”，同样兵力的仗不再开战即定 */
  luck?: number;
  /** 临阵镇定：主将统军高则受创时士气掉得慢（乘在士气损失上） */
  poise?: number;
  /** 营垒：所受伤损之比 */
  guard?: number;
  /** 连续行进的时间（冲势）、接敌后冲锋余时 */
  run: number; charge: number;
  /** 伏兵：藏于林中（或用“伏兵”计）不为敌所见，初次接敌加倍杀伤；lurk 为在林中静候的时长 */
  hidden?: boolean; lurk?: number;
  /** 排队的后续命令（按住 Shift 下令）：当前之令完成即接着做 */
  queue?: FOrder[];
}
export interface FEvent { t: number; kind: 'start' | 'clash' | 'charge' | 'flank' | 'fire' | 'rout' | 'rally' | 'shaky' | 'waver' | 'drum' | 'retreat' | 'dusk' | 'end' | 'skill' | 'twist' | 'ambush'; side?: 'att' | 'def'; unit?: string; text: string }
export interface FCommand { unit: string | 'all'; side: 'att' | 'def'; order: FOrder; queue?: boolean }
export type FOutcome = 'rout' | 'collapse' | 'retreat' | 'held';
export interface FieldSim {
  mode: 'field' | 'naval';
  terrain: string;
  t: number; seed: number;
  units: FUnit[];
  resolve: { att: number; def: number };
  events: FEvent[];
  over?: { t: number; winner: 'att' | 'def'; outcome: FOutcome; verdict?: '小胜' | '相持' | '小挫' };
  att: Pick<BattleSide, 'name' | 'commanderName' | 'tong' | 'mix'> & { start: number; morale0: number };
  def: Pick<BattleSide, 'name' | 'commanderName' | 'tong' | 'mix'> & { start: number; morale0: number };
  weather: string;
  /** 风向：+1 自守方吹向攻方（纵向增大），−1 反之，0 无风 */
  wind: number;
  flags: Record<string, number>;
  drum: { att: number; def: number; cdAtt: number; cdDef: number };
  /** 阵形（开战前所择；电脑按编成、兵势自择） */
  formation: { att: Formation; def: Formation };
  /** 战场地物：树林（可伏兵、避箭）、村落（据守少伤） */
  features: Feature[];
  /** 各方可用的战法与已用者（每样一战一次） */
  skills: { att: SkillId[]; def: SkillId[] };
  used: { att: SkillId[]; def: SkillId[] };
  /** 增益余时（秒）：volley 齐射、laststand 死战、confused 中疑兵、brace 收缩固守；wounded 主将负伤（不消） */
  buff: { att: Record<string, number>; def: Record<string, number> };
  /** 预定的战场变故（风向、援军将至、主将负伤、营中哗变） */
  twists: { t: number; kind: TwistKind; side: 'att' | 'def'; done?: boolean }[];
  /** 已出过的战机（每样一战一次） */
  moments: string[];
}
export type Formation = 'normal' | 'fengshi' | 'heyi' | 'fangyuan' | 'yanxing';
export interface Feature { kind: 'woods' | 'village'; x: number; y: number; r: number }
export type SkillId = 'fire' | 'feint' | 'volley' | 'laststand' | 'ambush' | 'raid';
export type TwistKind = 'windshift' | 'relief' | 'wound' | 'mutiny';

/** 日暮：开战后这么多秒天黑收兵；提前提示 */
export const DUSK = 900, DUSK_WARN = 780;
export const CONTACT = 60;
/** 同侧两营之间至少隔这么远 */
const SPACING = 84;
const RANGE: Record<FKind, number> = { inf: 0, cav: 0, gun: 240, art: 520, fire: 0 };
const SPEED_FIELD: Record<FKind, number> = { inf: 38, cav: 76, gun: 34, art: 16, fire: 40 };
const SPEED_NAVAL: Record<FKind, number> = { inf: 30, cav: 56, gun: 30, art: 22, fire: 50 };
/** 高地（丘陵）：守方阵地连同阵前一道缓坡 */
export const RIDGE = { x0: 210, x1: 790, y0: 150, y1: 330 };
/** 河（平原有河）：横贯战场，中间一处浅滩 */
export const RIVER = { y0: 470, y1: 530, ford0: 430, ford1: 570 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
/** 主将之能。统军：营伍战力（统四十约九成二、统六十整、统八十五一成一）与临阵镇定（受创时士气掉得慢）；
 *  谋略：战法之烈（谋三十五约九成五、谋八十五约一倍半），并能识破敌计 */
export const tongPower = (tong: number) => 0.76 + tong / 250;
export const tongPoise = (tong: number) => clamp(1.2 - tong / 300, 0.85, 1.1);
export const wit = (mou: number) => 0.6 + mou / 100;
const mouOf = (sim: FieldSim, side: 'att' | 'def') => (sim[side] as { mou?: number }).mou ?? 50;
const active = (u: FUnit) => u.state !== 'rout' && u.state !== 'gone' && u.troops >= 1;
const alive = (u: FUnit) => u.state !== 'gone' && u.troops >= 1;
const foeOf = (s: 'att' | 'def') => (s === 'att' ? 'def' : 'att');
/** 各方的后方：攻方在纵 1000 一侧 */
const homeY = (s: 'att' | 'def') => (s === 'att' ? 1080 : -80);
/** 追击：一方全军溃败后，胜方追杀溃兵的时限（秒）；溃兵逃出战场或时限到即收兵 */
export const PURSUIT = 40;
/** 敌军逼近（接战、中箭、或最近的敌营在两百步内）：士气再低，未见敌也不会自溃 */
const pressed = (sim: FieldSim, u: FUnit) => u.engaged || u.hit > 0 || sim.units.some(x => x.side !== u.side && active(x) && dist(u, x) < 220);
const dist = (a: FUnit, b: FUnit) => Math.hypot(a.x - b.x, a.y - b.y);
export const onRidge = (sim: FieldSim, x: number, y: number) => sim.mode === 'field' && sim.terrain === 'hills' && x > RIDGE.x0 && x < RIDGE.x1 && y > RIDGE.y0 && y < RIDGE.y1;
export const inRiver = (sim: FieldSim, x: number, y: number) => sim.mode === 'field' && sim.terrain === 'river' && y > RIVER.y0 && y < RIVER.y1 && (x < RIVER.ford0 || x > RIVER.ford1);

export const KIND_NAME: Record<'field' | 'naval', Record<FKind, string>> = {
  field: { inf: '步营', cav: '骑营', gun: '火器营', art: '炮营', fire: '火船' },
  naval: { inf: '战船', cav: '快船', gun: '火器船', art: '炮船', fire: '火船' },
};

/* ---------------- 编成 ---------------- */
export function createField(b: BattleState): FieldSim {
  const rng = makeRng(b.seed ^ 0x5f17);
  const mode: 'field' | 'naval' = b.kind === 'naval' ? 'naval' : 'field';
  const units: FUnit[] = [];
  for (const side of ['att', 'def'] as const) compose(units, side, b[side], mode, b.weather, rng);
  // 地物与变故另用一路随机数，不扰动编成
  const fr = makeRng(b.seed ^ 0x77a1);
  const features: Feature[] = [];
  if (mode === 'field') {
    const nW = 1 + (fr.next() < 0.6 ? 1 : 0);
    for (let k = 0; k < nW; k++) {
      const left = (k === 0) === (fr.next() < 0.5);
      let y = 330 + fr.next() * 340;
      if (b.terrain === 'river' && y > RIVER.y0 - 80 && y < RIVER.y1 + 80) y = y < 500 ? RIVER.y0 - 90 : RIVER.y1 + 90;
      features.push({ kind: 'woods', x: left ? 110 + fr.next() * 140 : 750 + fr.next() * 140, y, r: 62 + fr.next() * 26 });
    }
    if (fr.next() < 0.65) {
      let y = 400 + fr.next() * 200;
      if (b.terrain === 'river') y = fr.next() < 0.5 ? RIVER.y0 - 80 : RIVER.y1 + 80;
      features.push({ kind: 'village', x: 360 + fr.next() * 280, y, r: 52 });
    }
  }
  const twists: FieldSim['twists'] = [];
  const kinds: TwistKind[] = ['windshift', 'relief', 'wound', 'mutiny'];
  const nT = 1 + (fr.next() < 0.35 ? 1 : 0);
  // 主将负伤、营中哗变多落在统军差的一方，援军将至多落在统军好的一方（斥候、调度得法）
  const pAtt = clamp(0.5 + (b.def.tong - b.att.tong) / 120, 0.15, 0.85);
  for (let k = 0; k < nT; k++) { const t = Math.round(110 + fr.next() * 520), kind = kinds[Math.floor(fr.next() * kinds.length)], r = fr.next(); twists.push({ t, kind, side: kind === 'wound' || kind === 'mutiny' ? (r < pAtt ? 'att' : 'def') : kind === 'relief' ? (r < 1 - pAtt ? 'att' : 'def') : r < 0.5 ? 'att' : 'def' }); }
  twists.sort((a, b2) => a.t - b2.t);
  // 临阵状态：全军将运 ±9%，各营再 ±8%（种子定，读档重打不变）
  for (const side of ['att', 'def'] as const) { const fortune = 0.8 + rng.next() * 0.4; for (const u of units) if (u.side === side) { u.luck = fortune * (0.92 + rng.next() * 0.16); u.poise = tongPoise(b[side].tong) * (b[side].camp ? 0.9 : 1); u.guard = b[side].camp ? 0.8 : 1; } }
  // 临阵尚有余勇：军心再低，开战时全军军心不低于 25（各营士气在 compose 里不低于 22），免得未见敌便全线崩溃
  const mA = Math.max(25, avgMorale(b.att)), mD = Math.max(25, avgMorale(b.def));
  const tot = (s: BattleSide) => s.lanes.reduce((n, l) => n + l.troops, 0) + (s.reserve ?? 0);
  const sim: FieldSim = {
    mode, terrain: b.terrain, t: 0, seed: b.seed, units,
    resolve: { att: mA, def: mD }, events: [],
    att: { name: b.att.name, commanderName: b.att.commanderName, tong: b.att.tong, mix: b.att.mix, start: tot(b.att), morale0: mA },
    def: { name: b.def.name, commanderName: b.def.commanderName, tong: b.def.tong, mix: b.def.mix, start: tot(b.def), morale0: mD },
    weather: b.weather, wind: b.weather === 'wind' ? (rng.next() < 0.5 ? 1 : -1) : 0,
    flags: {}, drum: { att: 0, def: 0, cdAtt: 0, cdDef: 0 },
    formation: { att: 'normal', def: 'normal' }, features, skills: { att: [], def: [] }, used: { att: [], def: [] },
    buff: { att: {}, def: {} }, twists, moments: [],
  };
  (sim.att as { mou?: number }).mou = b.att.mou; (sim.def as { mou?: number }).mou = b.def.mou;
  for (const sd of ['att', 'def'] as const) { sim.skills[sd] = skillsFor(sim, sd); setFormation(sim, sd, aiFormation(sim, sd)); }
  ev(sim, 'start', mode === 'naval' ? `${b.att.name}水师与${b.def.name}水师会于${b.nodeName}江面。` : `${b.att.name}与${b.def.name}列阵于${b.nodeName}。`);
  stratagemOpening(sim, b, fr);
  return sim;
}
function avgMorale(s: BattleSide) { const t = s.lanes.reduce((n, l) => n + l.troops, 0); return t ? s.lanes.reduce((n, l) => n + l.morale * l.troops, 0) / t : 60; }

function compose(units: FUnit[], side: 'att' | 'def', s: BattleSide, mode: 'field' | 'naval', weather: string, rng: Rng) {
  const total = s.lanes.reduce((n, l) => n + l.troops, 0) + (s.reserve ?? 0);
  const morale = Math.max(22, avgMorale(s));
  const mix = s.mix;
  const parts: { kind: FKind; name: string; share: number; pos: [number, number] }[] = [];
  if (mode === 'field') {
    if (mix.gun >= 0.12) parts.push({ kind: 'art', name: '炮营', share: mix.gun * 0.4, pos: [500, 840] }, { kind: 'gun', name: '火器营', share: mix.gun * 0.6, pos: [500, 700] });
    else if (mix.gun > 0.03) parts.push({ kind: 'gun', name: '弓铳营', share: mix.gun, pos: [500, 700] });
    if (mix.cav > 0.22) parts.push({ kind: 'cav', name: '左骑', share: mix.cav / 2, pos: [170, 790] }, { kind: 'cav', name: '右骑', share: mix.cav / 2, pos: [830, 790] });
    else if (mix.cav > 0.05) parts.push({ kind: 'cav', name: '骑营', share: mix.cav, pos: [rng.next() < 0.5 ? 180 : 820, 790] });
    const inf = 1 - parts.reduce((n, p) => n + p.share, 0);
    const n = total * inf > 26000 ? 3 : total * inf > 10000 ? 2 : 1;
    const slots: [string, [number, number]][] = n === 3 ? [['中军', [500, 770]], ['左翼', [320, 775]], ['右翼', [680, 775]]] : n === 2 ? [['左翼', [400, 770]], ['右翼', [600, 770]]] : [['中军', [500, 770]]];
    for (const [name, pos] of slots) parts.push({ kind: 'inf', name, share: inf / n, pos });
  } else {
    const fire = weather === 'wind' && mix.navy > 0.2 ? 0.04 : 0;
    if (mix.gun > 0.05) parts.push({ kind: 'art', name: '炮船', share: mix.gun, pos: [500, 860] });
    if (fire) parts.push({ kind: 'fire', name: '火船', share: fire, pos: [260, 720] });
    const fast = Math.max(mix.cav, mix.navy * 0.25);
    parts.push({ kind: 'cav', name: '快船', share: fast, pos: [800, 760] });
    const main = 1 - parts.reduce((n, p) => n + p.share, 0);
    const n = total * main > 20000 ? 3 : total * main > 8000 ? 2 : 1;
    const slots: [string, [number, number]][] = n === 3 ? [['中军', [500, 760]], ['左哨', [330, 780]], ['右哨', [670, 780]]] : n === 2 ? [['左哨', [420, 770]], ['右哨', [600, 770]]] : [['中军', [500, 770]]];
    for (const [name, pos] of slots) parts.push({ kind: 'inf', name, share: main / n, pos });
  }
  let left = total;
  parts.forEach((p, i) => {
    const n = i === parts.length - 1 ? left : Math.max(0, Math.round(total * p.share));
    left -= n;
    if (n < 1) return;
    // 守方阵在上：纵向翻转；横向也翻转，好让“左翼”在守方镜头里仍在左
    const [x, y] = side === 'att' ? p.pos : [1000 - p.pos[0], 1000 - p.pos[1]];
    units.push({ id: `${side}${units.length}`, side, kind: p.kind, name: p.name, troops: n, start: n, morale, stamina: 100, x, y, order: { t: 'hold' }, state: 'idle', hit: 0, engaged: false, run: 0, charge: 0 });
  });
}
function ev(sim: FieldSim, kind: FEvent['kind'], text: string, extra: Partial<FEvent> = {}) { sim.events.push({ t: Math.round(sim.t * 10) / 10, kind, text, ...extra }); }

/* ---------------- 下令 ---------------- */
export function legalF(u: FUnit, o: FOrder): boolean {
  if (o.t === 'fire') return u.kind === 'gun' || u.kind === 'art';
  return true;
}
export function commandF(sim: FieldSim, c: FCommand) {
  const list = sim.units.filter(u => u.side === c.side && active(u) && (c.unit === 'all' || u.id === c.unit));
  for (const u of list) {
    if (!legalF(u, c.order)) continue;
    if (c.order.t === 'attack') { const tg = sim.units.find(x => x.id === (c.order as { target: string }).target); if (!tg || tg.side === u.side) continue; }
    // 排队：当前在动、在打，就记下来，完成后接着做；否则立即执行
    if (c.queue && (u.state === 'move' || u.state === 'melee' || u.state === 'shoot')) { (u.queue ??= []).push(c.order); continue; }
    u.order = c.order; u.queue = [];
  }
  if (c.order.t === 'retreat' && c.unit === 'all' && !sim.flags['retreat' + c.side]) { sim.flags['retreat' + c.side] = 1; ev(sim, 'retreat', `${sim[c.side].commanderName}鸣金收兵。`, { side: c.side }); }
}
export function drumF(sim: FieldSim, side: 'att' | 'def'): boolean {
  const cd = side === 'att' ? 'cdAtt' : 'cdDef';
  if (sim.drum[cd] > 0 || sim.over) return false;
  sim.drum[side] = 12; sim.drum[cd] = 60;
  for (const u of sim.units) if (u.side === side && active(u)) u.morale = Math.min(100, u.morale + 8);
  ev(sim, 'drum', `${sim[side].commanderName}擂鼓，${sim[side].name}士气大振。`, { side });
  return true;
}

/* ---------------- 推进一步 ---------------- */
/** 演算的一拍（秒）。不论界面倍速还是快进，都按这一拍逐拍推进，同样的命令得到同样的战果 */
export const TICK = 0.1;
export function stepField(sim: FieldSim, dt: number, cmds: FCommand[] = []) {
  if (sim.over) return sim;
  for (const c of cmds) commandF(sim, c);
  const n = Math.max(1, Math.round(dt / TICK));
  for (let i = 0; i < n && !sim.over; i++) tickField(sim, TICK);
  return sim;
}
function tickField(sim: FieldSim, dt: number) {
  const rng = makeRng(sim.seed * 37 + Math.round(sim.t * 10));
  sim.t = Math.round((sim.t + dt) * 1000) / 1000;
  for (const u of sim.units) { u.hit = 0; u.engaged = false; }
  for (const k of ['att', 'def'] as const) sim.drum[k] = Math.max(0, sim.drum[k] - dt);
  sim.drum.cdAtt = Math.max(0, sim.drum.cdAtt - dt); sim.drum.cdDef = Math.max(0, sim.drum.cdDef - dt);
  for (const sd of ['att', 'def'] as const) for (const k of Object.keys(sim.buff[sd])) if (k !== 'wounded') { sim.buff[sd][k] -= dt; if (sim.buff[sd][k] <= 0) delete sim.buff[sd][k]; }
  for (const tw of sim.twists) if (!tw.done && sim.t >= tw.t) { tw.done = true; twist(sim, tw.kind, tw.side); }
  moveAll(sim, dt);
  advanceQueues(sim);
  lurkAll(sim, dt);
  fightAll(sim, dt, rng);
  moraleAll(sim, dt);
  settleF(sim);
  return sim;
}

const contacts = (sim: FieldSim, u: FUnit) => sim.units.filter(x => x.side !== u.side && alive(x) && dist(u, x) < CONTACT);
function speedOf(sim: FieldSim, u: FUnit, dy: number) {
  let sp = (sim.mode === 'naval' ? SPEED_NAVAL : SPEED_FIELD)[u.kind] * (0.6 + 0.4 * u.stamina / 100);
  if (inRiver(sim, u.x, u.y)) sp *= 0.35;
  if (sim.mode === 'naval' && sim.wind) sp *= 1 + 0.12 * Math.sign(dy) * sim.wind;   // 顺风快、逆风慢
  if (u.state === 'rout') sp *= 1.15;
  sp *= fm(sim, u.side).speed;
  if (inFeature(sim, u, 'woods')) sp *= u.kind === 'cav' ? 0.7 : 0.85;
  return sp;
}
function goTo(sim: FieldSim, u: FUnit, x: number, y: number, dt: number, stopAt = 0): boolean {
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
  if (d <= stopAt + 0.5) return true;
  const sp = speedOf(sim, u, dy) * dt;
  if (d - stopAt <= sp) { u.x += dx / d * (d - stopAt); u.y += dy / d * (d - stopAt); return true; }
  u.x += dx / d * sp; u.y += dy / d * sp;
  u.stamina = Math.max(0, u.stamina - (u.kind === 'cav' ? 0.2 : 0.12) * dt);
  return false;
}
const nearestFoe = (sim: FieldSim, u: FUnit, pred: (x: FUnit) => boolean = active) =>
  sim.units.filter(x => x.side !== u.side && pred(x)).sort((a, b) => dist(u, a) - dist(u, b))[0];

function moveAll(sim: FieldSim, dt: number) {
  for (const u of sim.units) {
    if (u.state === 'gone') continue;
    if (u.troops < 1) { u.state = 'gone'; continue; }
    const wasMoving = u.state === 'move';
    if (u.state === 'rout') {
      // 溃兵奔回本阵之后；士气回升、军心尚在则收拢再战；奉令撤退者离场
      const ry = u.side === 'att' ? 880 : 120;
      // 全军已溃（追击中）：溃兵只顾逃出战场
      if (u.order.t === 'retreat' || sim.flags['pursuit' + u.side] !== undefined) { if (goTo(sim, u, clamp(u.x, 120, 880), homeY(u.side), dt)) u.state = 'gone'; continue; }
      goTo(sim, u, clamp(u.x, 150, 850), ry, dt);
      if (!contacts(sim, u).length) u.morale = Math.min(100, u.morale + 0.7 * dt);
      const behind = u.side === 'att' ? u.y > ry - 20 : u.y < ry + 20;
      if (behind && u.morale > 40 && sim.resolve[u.side] > 20) { u.state = 'idle'; u.order = { t: 'hold' }; ev(sim, 'rally', `${sim[u.side].name}${u.name}收拢溃卒，重整再战。`, { side: u.side, unit: u.id }); }
      continue;
    }
    const foes = contacts(sim, u).filter(active);
    const o = u.order;
    u.target = undefined;
    if (o.t === 'retreat') {
      // 撤退：接敌者边打边退，较慢
      const ok = goTo(sim, u, clamp(u.x, 120, 880), homeY(u.side), dt * (foes.length ? 0.5 : 1));
      u.state = 'move';
      if (ok) u.state = 'gone';
      continue;
    }
    if (foes.length && u.kind !== 'fire') {
      // 已接战：钉在原地厮杀（进击之令仍追着原目标）
      u.state = 'melee';
      const t = o.t === 'attack' ? foes.find(f => f.id === o.target) ?? foes[0] : foes[0];
      u.target = t.id;
      if (wasMoving && u.kind === 'cav' && u.run > 2 && o.t === 'attack') { u.charge = 4; ev(sim, 'charge', `${sim[u.side].name}${u.name}${sim.mode === 'naval' ? '鼓棹疾进，撞入敌船队' : '纵马冲阵'}！`, { side: u.side, unit: u.id }); }
      u.run = 0;
      continue;
    }
    switch (o.t) {
      case 'hold': {
        const tx = o.x ?? u.x, ty = o.y ?? u.y;
        u.state = goTo(sim, u, tx, ty, dt) ? 'idle' : 'move';
        if (u.state === 'idle' && (u.kind === 'gun' || u.kind === 'art')) { const f = nearestFoe(sim, u); if (f && dist(u, f) < RANGE[u.kind]) { u.state = 'shoot'; u.target = f.id; } }
        break;
      }
      case 'move': u.state = goTo(sim, u, o.x, o.y, dt) ? 'idle' : 'move'; break;
      case 'attack': {
        let tg = sim.units.find(x => x.id === o.target);
        if (!tg || !alive(tg) || (tg.state === 'rout' && u.kind !== 'cav' && sim.flags['pursuit' + tg.side] === undefined)) {
          // 目标已溃或已灭：就近再找一营（骑兵追溃兵）
          tg = nearestFoe(sim, u, x => active(x) || (u.kind === 'cav' && x.state === 'rout' && dist(u, x) < 260));
          if (!tg) { u.order = { t: 'hold' }; u.state = 'idle'; break; }
          u.order = { t: 'attack', target: tg.id };
        }
        u.target = tg.id;
        u.state = goTo(sim, u, tg.x, tg.y, dt, CONTACT * 0.8) ? 'melee' : 'move';
        break;
      }
      case 'fire': {
        // 指定目标：推进到射程内再打；不指定：原地射击射程内最近之敌
        let tg = o.target ? sim.units.find(x => x.id === o.target) : undefined;
        if (o.target && (!tg || !active(tg))) { u.order = { t: 'fire' }; tg = undefined; }
        const r = RANGE[u.kind] * (onRidge(sim, u.x, u.y) ? 1.15 : 1);
        if (!tg) { const f = nearestFoe(sim, u); if (f && dist(u, f) < r) tg = f; }
        if (!tg) { u.state = 'idle'; break; }
        u.target = tg.id;
        u.state = goTo(sim, u, tg.x, tg.y, dt, r * 0.9) ? 'shoot' : (dist(u, tg) < r ? 'shoot' : 'move');
        break;
      }
    }
    u.run = u.state === 'move' ? u.run + dt : 0;
    if (u.state === 'idle' || u.state === 'shoot') u.stamina = Math.min(100, u.stamina + 0.35 * dt);
  }
  // 同侧之营不叠在一起：挤开（接战中的营挪得少）。几营围攻一营时自然分到它的两侧、背后
  const list = sim.units.filter(u => alive(u) && u.state !== 'rout');
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j];
    if (a.side !== b.side) continue;
    const d = dist(a, b);
    if (d < SPACING && d > 0.01) {
      const p = (SPACING - d) * 0.2, nx = (a.x - b.x) / d, ny = (a.y - b.y) / d;
      const wa = a.state === 'melee' ? 0.3 : 1, wb = b.state === 'melee' ? 0.3 : 1;
      a.x += nx * p * wa; a.y += ny * p * wa; b.x -= nx * p * wb; b.y -= ny * p * wb;
    } else if (d <= 0.01) { a.x -= 3; b.x += 3; }
  }
  for (const u of sim.units) { u.x = clamp(u.x, 20, 980); if (u.state !== 'gone' && u.order.t !== 'retreat' && u.state !== 'rout') u.y = clamp(u.y, 20, 980); }
}

/* ---------------- 交战 ---------------- */
function power(sim: FieldSim, u: FUnit) {
  const drum = sim.drum[u.side] > 0 ? 1.12 : 1;
  const b = sim.buff[u.side];
  return (0.5 + u.morale / 200) * (0.55 + 0.45 * u.stamina / 100) * tongPower(sim[u.side].tong) * drum * (u.luck ?? 1) * (b.laststand ? 1.12 : 1) * (b.wounded ? 0.95 : 1);
}
function hurt(u: FUnit, dmg: number, shock = 1) {
  if (dmg <= 0 || u.troops < 1) return;
  const n = Math.min(u.troops, dmg * (u.guard ?? 1));
  u.morale -= n / Math.max(1, u.troops) * 110 * shock * (u.poise ?? 1) / (u.luck ?? 1);
  u.troops -= n; u.hit += n; u.engaged = true;
}
/** 一营之兵同时接敌者有限：人多也只能轮番上 */
const frontage = (n: number) => (n <= 3000 ? n : 3000 + (n - 3000) * 0.35);
function meleeMult(sim: FieldSim, a: FUnit, d: FUnit): number {
  if (sim.mode === 'naval') return ({ inf: 1, cav: 0.8, gun: 0.6, art: 0.4, fire: 0 } as Record<FKind, number>)[a.kind];
  const steady = d.state === 'idle' || (d.state === 'melee' && d.order.t === 'hold');
  switch (a.kind) {
    case 'inf': return d.kind === 'gun' ? 1.1 : d.kind === 'art' ? 1.4 : 1;
    case 'cav': return (d.kind === 'gun' ? 1.4 : d.kind === 'art' ? 1.8 : d.kind === 'inf' && steady ? 0.7 : 0.9) * (a.charge > 0 ? 2 : 1) * (d.state === 'rout' ? 1.8 : 1);
    case 'gun': return 0.55;
    case 'art': return 0.25;
    default: return 0;
  }
}
/** 背后：攻击者站在目标的后方一侧 */
const fromRear = (a: FUnit, d: FUnit) => (d.side === 'def' ? a.y < d.y - 22 : a.y > d.y + 22);

function fightAll(sim: FieldSim, dt: number, rng: Rng) {
  const jit = () => 0.9 + rng.next() * 0.2;
  const rain = sim.weather === 'rain' ? 0.55 : 1;
  const all = sim.units.filter(alive);
  // 1. 肉搏
  const engagedBy = new Map<string, FUnit[]>();
  for (const a of all) {
    if (a.state === 'rout' || a.kind === 'fire') continue;
    for (const d of all) if (d.side !== a.side && dist(a, d) < CONTACT) { const l = engagedBy.get(d.id) ?? []; l.push(a); engagedBy.set(d.id, l); }
  }
  for (const a of all) {
    if (a.state === 'rout' || a.kind === 'fire') continue;
    const foes = all.filter(d => d.side !== a.side && dist(a, d) < CONTACT);
    if (!foes.length) continue;
    const tot = foes.reduce((n, d) => n + d.troops, 0);
    for (const d of foes) {
      const share = d.troops / tot;
      let m = meleeMult(sim, a, d);
      let shock = 1;
      if ((engagedBy.get(d.id)?.length ?? 0) >= 2) { m *= 1.3 * fm(sim, a.side).flank; shock *= 1.25; }
      if (fromRear(a, d) && d.state !== 'rout') {
        m *= 1.4 * fm(sim, a.side).flank; shock *= 1.4;
        const key = `rear${a.id}${d.id}`;
        if (!sim.flags[key]) { sim.flags[key] = 1; ev(sim, 'flank', `${sim[a.side].name}${a.name}抄到${sim[d.side].name}${d.name}背后！`, { side: a.side, unit: a.id }); }
      }
      // 结阵坚守的营：正面来敌一概少伤一成半（被抄背则无此利）
      else if (d.order.t === 'hold' && d.state !== 'rout' && d.state !== 'move') m *= 0.85;
      // 阵形、战法、地物
      m *= fm(sim, a.side).atk * fm(sim, d.side).taken * takenMul(sim, d.side);
      if (inFeature(sim, d, 'village')) m *= 0.85;
      if (a.hidden) {
        const pw = wit(mouOf(sim, a.side));
        m *= 1.5 * pw; shock *= 1.6 * pw; a.hidden = false; a.lurk = 0;
        ev(sim, 'ambush', `${sim[a.side].name}${a.name}伏兵杀出，${sim[d.side].name}${d.name}大乱！`, { side: a.side, unit: a.id });
        d.morale -= 12;
      }
      if (onRidge(sim, d.x, d.y) && !onRidge(sim, a.x, a.y)) m *= 0.55;      // 仰攻高地
      if (inRiver(sim, a.x, a.y)) m *= 0.7;
      if (inRiver(sim, d.x, d.y)) m *= 1.3;
      hurt(d, frontage(a.troops) * power(sim, a) * 0.0036 * m * share * jit() * dt, shock);
    }
    a.engaged = true;
    a.charge = Math.max(0, a.charge - dt);
  }
  // 2. 射击：火器、炮，接战中不能射
  for (const a of all) {
    if (a.state !== 'shoot' || !a.target) continue;
    const d = sim.units.find(x => x.id === a.target);
    if (!d || !alive(d)) continue;
    if (d.hidden) continue;   // 伏兵不见，射不着
    const r = RANGE[a.kind] * (onRidge(sim, a.x, a.y) ? 1.15 : 1) * (sim.weather === 'fog' ? 0.65 : 1) * fm(sim, a.side).range;   // 大雾：看不远，射程短
    const dd = dist(a, d);
    if (dd > r) continue;
    const fall = 1 - 0.4 * dd / r;
    let rate = a.kind === 'art' ? (sim.mode === 'naval' ? 0.0045 : 0.0038) : 0.0022;
    if (sim.mode === 'naval' && d.kind === 'cav') rate *= 0.6;          // 快船灵便，难中
    if (d.kind === 'cav' && d.state === 'move') rate *= 1.15;
    if (onRidge(sim, d.x, d.y)) rate *= 0.85;
    if (inRiver(sim, d.x, d.y)) rate *= 1.2;
    if (inFeature(sim, d, 'woods')) rate *= 0.6; else if (inFeature(sim, d, 'village')) rate *= 0.8;
    rate *= (sim.buff[a.side].volley ? 2 : 1) * (sim.formation[a.side] === 'yanxing' ? 1.15 : 1) * takenMul(sim, d.side);
    hurt(d, a.troops * rate * power(sim, a) * (a.kind === 'gun' ? rain : 0.8 + rain * 0.2) * fall * jit() * dt, a.kind === 'art' ? 1.3 : 1);
    a.engaged = true;
  }
  // 溃兵被追：沿途逃散、被俘，敌近时每秒折去千分之三，有骑兵追则千分之六
  for (const u of all) {
    if (u.state !== 'rout') continue;
    const near = sim.units.filter(x => x.side !== u.side && active(x) && dist(u, x) < 220);
    if (!near.length) continue;
    const cav = near.some(x => x.kind === 'cav');
    const n = u.troops * (cav ? 0.022 : 0.008) * dt;
    u.troops -= n; u.hit += n;
  }
  // 3. 火船：接敌即燃，顺风大成
  for (const f of all) {
    if (f.kind !== 'fire' || f.state === 'rout') continue;
    const hitList = all.filter(d => d.side !== f.side && d.state !== 'gone' && dist(f, d) < CONTACT);
    if (!hitList.length) continue;
    const downwind = sim.wind === 0 ? 0.9 : Math.sign(hitList[0].y - f.y) === sim.wind ? 1.35 : 0.7;
    for (const d of all.filter(x => x.side !== f.side && alive(x) && dist(f, x) < CONTACT + 50)) {
      const near = dist(f, d) < CONTACT;
      hurt(d, (500 + d.troops * 0.16) * downwind * (near ? 1 : 0.45) * jit(), 1.6);
      d.morale -= (near ? 12 : 5) * downwind;
    }
    ev(sim, 'fire', `${sim[f.side].name}火船撞入敌阵，烈焰腾空！${downwind > 1 ? '' : downwind < 1 ? '（逆风，火势不旺）' : ''}`, { side: f.side, unit: f.id });
    f.troops = 0; f.state = 'gone';
  }
}

/* ---------------- 士气与军心 ---------------- */
export function strengthF(sim: FieldSim, side: 'att' | 'def') {
  return sim.units.filter(u => u.side === side && active(u)).reduce((n, u) => n + u.troops * (0.4 + u.morale / 100), 0);
}
function moraleAll(sim: FieldSim, dt: number) {
  for (const u of sim.units) {
    u.morale = clamp(u.morale, 0, 100);
    if (!active(u)) continue;
    const cap = sim[u.side].morale0 + 10;
    if (!u.engaged) u.morale = Math.min(cap, u.morale + 0.5 * dt);
    u.morale = clamp(u.morale, 0, 100);
    if (u.morale < 12 && pressed(sim, u)) { u.state = 'rout'; u.charge = 0; ev(sim, 'rout', `${sim[u.side].name}${u.name}溃散！`, { side: u.side, unit: u.id }); }
  }
  for (const sd of ['att', 'def'] as const) {
    const list = sim.units.filter(u => u.side === sd && active(u));
    const tot = list.reduce((n, u) => n + u.troops, 0);
    const wm = tot ? list.reduce((n, u) => n + u.morale * u.troops, 0) / tot : 0;
    const share = tot / Math.max(1, sim[sd].start);
    const routing = sim.units.filter(u => u.side === sd && u.state === 'rout').reduce((n, u) => n + u.troops, 0) / Math.max(1, sim[sd].start);
    let target = wm * (0.35 + 0.65 * Math.sqrt(share)) - routing * 30;
    if (!tot) target = 0;
    const r0 = sim.resolve[sd];
    // 下跌有速度上限：从“动摇”到崩溃至少十几秒
    sim.resolve[sd] = clamp(r0 + clamp(target - r0, -2 * dt, 1 * dt), 0, 100);
    const r = sim.resolve[sd];
    if (r < 30 && !sim.flags['shaky' + sd]) { sim.flags['shaky' + sd] = 1; ev(sim, 'shaky', `${sim[sd].name}军心动摇！`, { side: sd }); }
    if (r < 15 && !sim.flags['waver' + sd]) { sim.flags['waver' + sd] = 1; ev(sim, 'waver', `${sim[sd].name}将溃——士气低落的营伍开始后退！`, { side: sd }); }
    if (r < 15) for (const u of list) if (u.morale < 30 && pressed(sim, u)) u.state = 'rout';
    if (r >= 35) delete sim.flags['waver' + sd];
  }
}

/* ---------------- 胜负 ---------------- */
function endF(sim: FieldSim, winner: 'att' | 'def', outcome: FOutcome, text: string, verdict?: '小胜' | '相持' | '小挫') {
  sim.over = { t: sim.t, winner, outcome, ...(verdict ? { verdict } : {}) };
  ev(sim, 'end', text, { side: winner });
}
function settleF(sim: FieldSim) {
  for (const sd of ['att', 'def'] as const) {
    const foe = foeOf(sd);
    const act = sim.units.filter(u => u.side === sd && active(u));
    const pk = 'pursuit' + sd;
    // 军心归零：已与敌交手（或开战一分钟后仍在场）才全线崩溃
    const broke = sim.resolve[sd] <= 0 && (sim.t > 60 || sim.units.some(u => u.side === sd && alive(u) && pressed(sim, u)));
    if (sim.flags[pk] === undefined && (broke || (!act.length && !sim.flags['retreat' + sd]))) {
      // 全军溃败：不当场收场，胜方追杀一阵，溃兵逃出战场或追击时限到才定局
      for (const u of sim.units) if (u.side === sd && alive(u)) { u.state = 'rout'; u.charge = 0; }
      sim.flags[pk] = sim.t;
      ev(sim, 'rout', `${sim[sd].name}全军溃退，${sim[foe].name}乘势追杀！`, { side: foe });
    }
    if (sim.flags[pk] !== undefined) {
      const left = sim.units.filter(u => u.side === sd && alive(u));
      if (!left.length || sim.t - sim.flags[pk] >= PURSUIT) {
        for (const u of left) u.state = 'gone';
        endF(sim, foe, sd === 'def' ? 'rout' : 'collapse', `${sim[sd].name}全军溃败，${sim[foe].name}大胜。`);
        return;
      }
    }
  }
  for (const sd of ['att', 'def'] as const) {
    const mine = sim.units.filter(u => u.side === sd && alive(u));
    if (sim.flags['pursuit' + sd] === undefined && sim.flags['retreat' + sd] && mine.every(u => u.order.t === 'retreat' || u.state === 'rout')) {
      const off = mine.every(u => (sd === 'att' ? u.y > 960 : u.y < 40));
      if (!mine.length || off) { for (const u of mine) u.state = 'gone'; endF(sim, foeOf(sd), 'retreat', `${sim[sd].name}收兵退走，${sim[foeOf(sd)].name}据有战场。`); return; }
    }
  }
  if (sim.t >= DUSK_WARN && !sim.flags.duskWarn) { sim.flags.duskWarn = 1; ev(sim, 'dusk', '天色向晚，再过一阵便要收兵。'); }
  if (sim.t >= DUSK) {
    // 日暮：按两军折损比例写战果；差不多就是相持，守方守住阵地
    const lossA = 1 - sim.units.filter(u => u.side === 'att').reduce((n, u) => n + Math.max(0, u.troops), 0) / Math.max(1, sim.att.start);
    const lossD = 1 - sim.units.filter(u => u.side === 'def').reduce((n, u) => n + Math.max(0, u.troops), 0) / Math.max(1, sim.def.start);
    const edge = (lossD - lossA) + (sim.resolve.att - sim.resolve.def) / 200;
    if (edge > 0.08) endF(sim, 'att', 'held', `日暮收兵：${sim.att.name}小胜。`, '小胜');
    else if (edge < -0.08) endF(sim, 'def', 'held', `日暮收兵：${sim.def.name}小胜。`, '小胜');
    else endF(sim, 'def', 'held', `日暮收兵，两军相持。`, '相持');
  }
}

/* ---------------- 电脑指挥 ---------------- */
export function aiField(sim: FieldSim, side: 'att' | 'def', opts: { eager?: boolean; hold?: boolean } = {}): FCommand[] {
  const cmds: FCommand[] = [];
  const set = (u: FUnit, o: FOrder) => { if (JSON.stringify(u.order) !== JSON.stringify(o)) { cmds.push({ unit: u.id, side, order: o }); commandF(sim, { unit: u.id, side, order: o }); } };
  const mine = sim.units.filter(u => u.side === side && active(u));
  const foes = sim.units.filter(u => u.side !== side && active(u) && !u.hidden);   // 伏兵不见
  if (!mine.length || (!foes.length && sim.flags['pursuit' + foeOf(side)] === undefined)) return cmds;
  // 中了疑兵：逡巡不前，不下新令（已在厮杀的照打）
  if (sim.buff[side].confused && !opts.eager) { for (const u of mine) if (u.state === 'move' && u.order.t === 'attack') set(u, { t: 'hold' }); return cmds; }
  const sa = strengthF(sim, side), sf = strengthF(sim, foeOf(side));
  // 追击：敌已全溃，各营追杀溃兵（步卒追近处的，骑兵追远的）
  if (sim.flags['pursuit' + foeOf(side)] !== undefined) {
    const routers = sim.units.filter(u => u.side !== side && alive(u));
    for (const u of mine) {
      if (u.kind === 'art' || u.kind === 'gun' || u.kind === 'fire') continue;
      const t = routers.slice().sort((a, b) => dist(u, a) - dist(u, b))[0];
      if (t && (u.kind === 'cav' || dist(u, t) < 300)) set(u, { t: 'attack', target: t.id });
    }
    return cmds;
  }
  // 撤退：两军照面（或已交手）之后才会自觉不敌而退，不会未见敌就走
  const met = sim.units.some(m => m.side === side && alive(m) && (m.engaged || m.hit > 0 || foes.some(f => dist(m, f) < 320)));
  if (!opts.eager && sim.t > 40 && met && ((sim.resolve[side] < 24 && sa < sf * 0.9) || sa < sf * 0.45)) {
    commandF(sim, { unit: 'all', side, order: { t: 'retreat' } });
    for (const u of mine) cmds.push({ unit: u.id, side, order: { t: 'retreat' } });
    return cmds;
  }
  // 守方：据阵而待，敌近则迎击；自觉势大、或久候四分钟敌不来，则出击。攻方：压上
  // 地利（高地、河）不靠原地死守：守方照常迎击，接战之处多在岗坡、河岸，仰攻、涉水者吃亏
  const aggressive = opts.eager || (!opts.hold && (side === 'att' || sa > sf * 1.4 || sim.t > 240));
  const meet = 420;
  const engaged = foes.filter(f => sim.units.some(m => m.side === side && alive(m) && dist(m, f) < CONTACT));
  // 擂鼓：两军接战、或军心见低时擂一通（冷却好了就擂），电脑与部将代打都会
  if (engaged.length && (sim.resolve[side] < 60 || engaged.length >= 2)) drumF(sim, side);
  // 战法：电脑与部将代打也会用
  if (!opts.hold) aiSkills(sim, side, engaged.length > 0);
  const nearOf = (u: FUnit, pool: FUnit[]) => pool.slice().sort((a, b) => Math.abs(a.x - u.x) * 1.4 + Math.abs(a.y - u.y) - (Math.abs(b.x - u.x) * 1.4 + Math.abs(b.y - u.y)))[0];
  for (const u of mine) {
    if (u.order.t === 'retreat') continue;
    if (u.kind === 'gun' || u.kind === 'art') {
      // 火器、炮：攻则推进到射程内，射最近之敌；守则原地射击
      const f = foes.slice().sort((a, b) => dist(u, a) - dist(u, b))[0];
      const inRange = f && dist(u, f) < RANGE[u.kind];
      const cur = u.order.t === 'fire' && u.order.target ? sim.units.find(x => x.id === (u.order as { target?: string }).target) : undefined;
      if (aggressive && !inRange && f) { if (!cur || !active(cur)) set(u, { t: 'fire', target: f.id }); }
      else if (u.order.t !== 'fire' || inRange) set(u, { t: 'fire' });
      continue;
    }
    const cur = u.order.t === 'attack' ? sim.units.find(x => x.id === (u.order as { target: string }).target) : undefined;
    if (cur && active(cur) && u.state === 'melee') continue;      // 正在厮杀，不换目标
    if (u.kind === 'fire') {
      const big = foes.filter(f => dist(u, f) < 520).sort((a, b) => b.troops - a.troops)[0];
      if (big && (sim.wind === 0 || Math.sign(big.y - u.y) === sim.wind || aggressive)) set(u, { t: 'attack', target: big.id });
      continue;
    }
    if (u.kind === 'cav') {
      // 骑兵：先找敌火器、炮；再找正与我步卒厮杀之敌，绕其侧背
      const soft = foes.filter(f => f.kind === 'gun' || f.kind === 'art').sort((a, b) => dist(u, a) - dist(u, b))[0];
      const pinned = engaged.filter(f => f.kind !== 'cav').sort((a, b) => dist(u, a) - dist(u, b))[0];
      if (soft && (aggressive || dist(u, soft) < 320)) set(u, { t: 'attack', target: soft.id });
      else if (pinned) set(u, { t: 'attack', target: pinned.id });
      else if (aggressive && sim.t > 25) { const f = nearOf(u, foes); if (f) set(u, { t: 'attack', target: f.id }); }
      continue;
    }
    // 步卒：攻则压向当面之敌；守则待敌来近（一百八十步内）再迎击
    const f = nearOf(u, foes);
    if (!f) continue;
    if (aggressive || dist(u, f) < meet) set(u, { t: 'attack', target: f.id });
    else set(u, { t: 'hold', x: u.x, y: u.y });
  }
  return cmds;
}

/* ---------------- 无画面快进 ---------------- */
export function runField(b: BattleState, opts: { maxT?: number; dt?: number } = {}): FieldSim {
  const sim = createField(b);
  // 与实时界面同一节奏：逐拍推进，每两秒双方各下一次令（opts.dt 只是旧接口，不影响结果）
  const maxT = opts.maxT ?? DUSK + 10;
  void opts.dt;
  let next = 0;
  while (!sim.over && sim.t < maxT) {
    if (sim.t >= next) { aiField(sim, 'att', { hold: !!b.att.camp }); aiField(sim, 'def', { hold: !!b.def.camp }); next = sim.t + 2; }
    stepField(sim, TICK);
  }
  return sim;
}

/** 结果折回旧的战局格式，供战役层写回伤亡与胜负 */
export function toFieldResult(b: BattleState, sim: FieldSim): BattleState {
  const r: BattleState = structuredClone(b);
  const fold = (sd: 'att' | 'def', side: BattleSide) => {
    const us = sim.units.filter(u => u.side === sd);
    const surv = Math.round(us.reduce((n, u) => n + Math.max(0, u.troops), 0));
    const mor = surv ? us.reduce((n, u) => n + u.morale * Math.max(0, u.troops), 0) / surv : 0;
    const tot0 = side.lanes.reduce((n, l) => n + l.troops, 0) + (side.reserve ?? 0) || 1;
    let left = surv;
    side.lanes.forEach((l, i) => { const n = i === 2 ? Math.max(0, left) : Math.round(surv * (l.troops / tot0)); left -= n; l.troops = Math.max(0, n); l.morale = Math.round(mor); l.routed = false; l.withdrawn = false; });
    side.reserve = 0;
    const sum = side.lanes.reduce((n, l) => n + l.troops, 0);
    if (sum !== surv) side.lanes[1].troops += surv - sum;
  };
  fold('att', r.att); fold('def', r.def);
  r.over = true;
  r.winner = sim.over?.winner ?? 'def';
  r.outcome = sim.over?.outcome ?? 'held';
  if (sim.over?.verdict) r.verdict = sim.over.verdict;
  r.round = Math.max(1, Math.round(sim.t / 30));
  return r;
}

/* ================= 阵形、地物、战法、变故、战机、排队命令 ================= */
export const FORMATIONS: Record<Formation, { name: string; desc: string; atk: number; taken: number; flank: number; speed: number; range: number }> = {
  normal: { name: '常阵', desc: '各营按常法列阵，不偏不倚', atk: 1, taken: 1, flank: 1, speed: 1, range: 1 },
  fengshi: { name: '锋矢阵', desc: '中军突前，一点破阵：近战杀伤 +12%，受伤 +6%', atk: 1.12, taken: 1.06, flank: 1, speed: 1.05, range: 1 },
  heyi: { name: '鹤翼阵', desc: '两翼张开包抄：夹击、抄背再加两成，正面杀伤 −5%', atk: 0.95, taken: 1, flank: 1.2, speed: 1, range: 1 },
  fangyuan: { name: '方圆阵', desc: '结阵自固：受伤 −12%，行动 −15%', atk: 1, taken: 0.88, flank: 1, speed: 0.85, range: 1 },
  yanxing: { name: '雁行阵', desc: '火器列前，层层轮射：射程 +20%、射击 +15%；被近身受伤 +8%', atk: 1, taken: 1.08, flank: 1, speed: 1, range: 1.2 },
};
const fm = (sim: FieldSim, side: 'att' | 'def') => FORMATIONS[sim.formation?.[side] ?? 'normal'];
const takenMul = (sim: FieldSim, side: 'att' | 'def') => (sim.buff[side].laststand ? 0.9 : 1) * (sim.buff[side].brace ? 0.85 : 1);
export const inFeature = (sim: FieldSim, u: { x: number; y: number }, kind: Feature['kind']) => sim.features.some(f => f.kind === kind && Math.hypot(u.x - f.x, u.y - f.y) < f.r);
const fwd = (side: 'att' | 'def') => (side === 'att' ? -1 : 1);

/** 定阵形：只在开战之前（t=0）；各营按阵形挪到起手位置 */
export function setFormation(sim: FieldSim, side: 'att' | 'def', f: Formation): boolean {
  if (sim.t > 0 || sim.mode === 'naval' && f !== 'normal' && f !== 'fangyuan' && f !== 'fengshi') return false;
  const prev = sim.formation[side];
  // 先退回常阵位置，再按新阵挪
  const shift = (form: Formation, sign: number) => {
    for (const u of sim.units.filter(x => x.side === side)) {
      let dx = 0, dy = 0;
      if (form === 'fengshi' && u.kind === 'inf') dy = (Math.abs(u.x - 500) < 60 ? 70 : 20) * fwd(side);
      if (form === 'heyi' && u.kind === 'cav') { dx = (u.x < 500 ? -70 : 70); dy = 60 * fwd(side); }
      if (form === 'fangyuan') dx = (500 - u.x) * 0.3;
      if (form === 'yanxing') { if (u.kind === 'gun') dy = 140 * fwd(side); else if (u.kind === 'art') dy = 100 * fwd(side); else if (u.kind === 'inf') dy = -30 * fwd(side); }
      u.x = clamp(u.x + dx * sign, 40, 960); u.y = clamp(u.y + dy * sign, 40, 960);
    }
  };
  shift(prev, -1);
  sim.formation[side] = f;
  shift(f, 1);
  return true;
}
/** 电脑择阵：火器多用雁行，骑多用鹤翼，势弱用方圆，势强用锋矢 */
export function aiFormation(sim: FieldSim, side: 'att' | 'def'): Formation {
  if (sim.mode === 'naval') return 'normal';
  const mix = sim[side].mix, ratio = sim[side].start / Math.max(1, sim[foeOf(side)].start);
  if (mix.gun >= 0.25) return 'yanxing';
  if (mix.cav >= 0.3) return 'heyi';
  if (ratio < 0.8) return 'fangyuan';
  if (ratio > 1.25) return 'fengshi';
  return 'normal';
}

export const SKILLS: Record<SkillId, { name: string; desc: string; icon: string }> = {
  fire: { name: '火攻', desc: '纵火焚敌阵：最近的敌军大营及其左近折损、士气大挫（有风更烈）', icon: 'fire' },
  feint: { name: '疑兵', desc: '虚张旗鼓：敌军士气 −5，二十秒内不敢轻进', icon: 'flank' },
  volley: { name: '齐射', desc: '火器、炮十二秒内轮番齐放，射击杀伤加倍', icon: 'volley' },
  laststand: { name: '死战', desc: '主将亲冒矢石：全军士气 +15，二十五秒内杀伤 +12%、受伤 −10%，事后疲惫', icon: 'morale' },
  ambush: { name: '伏兵', desc: '最精的骑营潜行不见，初次接敌加倍杀伤、敌营大乱', icon: 'ambush' },
  raid: { name: '夜袭', desc: '日暮之后可用：衔枚夜袭，敌军心 −8、士气 −8', icon: 'night' },
};
/** 各方可用的战法（看主将谋略、统军，编成与天时），至多三样 */
export function skillsFor(sim: FieldSim, side: 'att' | 'def'): SkillId[] {
  const sd = sim[side], mou = (sd as { mou?: number }).mou ?? 50, out: SkillId[] = [];
  if (sim.weather === 'wind' || mou >= 65) if (sim.weather !== 'rain') out.push('fire');
  if (sd.mix.gun >= 0.08) out.push('volley');
  if (sim.mode === 'field' && sd.mix.cav >= 0.12 && mou >= 50) out.push('ambush');
  if (mou >= 55) out.push('feint');
  if (sd.tong >= 55 || out.length < 2) out.push('laststand');
  if (out.length < 3 || mou >= 70) out.push('raid');
  // 谋略出众者多一样战法
  return out.slice(0, mou >= 75 ? 4 : 3);
}
/** 识破：用计一方谋略不及对方，对方可能看穿（谋差三十约三成，至多五成五；对方谋略平平则几乎不会） */
export function seeThroughChance(sim: FieldSim, side: 'att' | 'def'): number {
  return clamp((mouOf(sim, foeOf(side)) - mouOf(sim, side)) / 100 + 0.02, 0, 0.55);
}
/** 此刻能否用某战法：不能则返回原因 */
export function skillBlock(sim: FieldSim, side: 'att' | 'def', id: SkillId): string | null {
  if (sim.over) return '战已毕';
  if (!sim.skills[side].includes(id)) return '主将不擅此计';
  if (sim.used[side].includes(id)) return '一战只能用一次';
  const mine = sim.units.filter(u => u.side === side && active(u)), foes = sim.units.filter(u => u.side !== side && active(u));
  if (id === 'fire' && !foes.some(f => mine.some(m => dist(m, f) < 450))) return '敌在远处，火攻不及';
  if (id === 'volley' && !mine.some(u => u.kind === 'gun' || u.kind === 'art')) return '已无火器营';
  if (id === 'ambush' && !mine.some(u => u.kind === 'cav' && !u.engaged)) return '无可伏之骑';
  if (id === 'raid' && sim.t < 600) return '日暮之后方可夜袭';
  return null;
}
export function useSkill(sim: FieldSim, side: 'att' | 'def', id: SkillId): boolean {
  if (skillBlock(sim, side, id)) return false;
  sim.used[side].push(id);
  const foe = foeOf(side), nm = sim[side].commanderName;
  const mine = sim.units.filter(u => u.side === side && active(u)), foes = sim.units.filter(u => u.side === foe && active(u));
  const pow = wit(mouOf(sim, side));
  // 计谋之类可被识破（齐射、死战是硬功夫，无所谓识破）
  if (id === 'fire' || id === 'feint' || id === 'ambush' || id === 'raid') {
    const r = makeRng(sim.seed * 131 + Math.round(sim.t * 10) + id.length).next();
    if (r < seeThroughChance(sim, side)) {
      for (const u of mine) u.morale = Math.max(0, u.morale - 3);
      for (const u of foes) u.morale = Math.min(100, u.morale + 3);
      ev(sim, 'skill', `${sim[foe].commanderName}识破${nm}的${SKILLS[id].name}之计，${sim[side].name}无功，反折锐气。`, { side: foe });
      return true;
    }
  }
  switch (id) {
    case 'fire': {
      const tg = foes.filter(f => mine.some(m => dist(m, f) < 450)).sort((a, b) => b.troops - a.troops)[0];
      const k = (sim.weather === 'wind' ? 1.35 : 1) * pow;
      for (const d of foes) if (dist(d, tg) < 120) { hurt(d, d.troops * 0.05 * k * (d === tg ? 1 : 0.6), 1.5); d.morale -= 10 * k; }
      ev(sim, 'fire', `${nm}纵火焚敌，${sim[foe].name}${tg.name}一带烈焰腾空！`, { side, unit: tg.id });
      break;
    }
    case 'feint':
      for (const d of foes) d.morale = Math.max(0, d.morale - 5 * pow);
      sim.buff[foe].confused = 20;
      ev(sim, 'skill', `${nm}多张旗帜、虚设疑兵，${sim[foe].name}疑有大军，逡巡不前。`, { side });
      break;
    case 'volley': sim.buff[side].volley = 12; ev(sim, 'skill', `${nm}令火器营分番齐射，铳炮连珠！`, { side }); break;
    case 'laststand':
      for (const u of mine) { u.morale = Math.min(100, u.morale + 15); u.stamina = Math.max(0, u.stamina - 15); }
      sim.resolve[side] = Math.min(100, sim.resolve[side] + 8);
      sim.buff[side].laststand = 25;
      ev(sim, 'skill', `${nm}拔剑立于阵前，誓与将士同死，全军死战！`, { side });
      break;
    case 'ambush': {
      const c = mine.filter(u => u.kind === 'cav' && !u.engaged).sort((a, b) => b.troops - a.troops)[0];
      c.hidden = true;
      ev(sim, 'skill', `${nm}令${c.name}偃旗息鼓，潜伏侧翼待机。`, { side, unit: c.id });
      break;
    }
    case 'raid':
      sim.resolve[foe] = Math.max(0, sim.resolve[foe] - 8 * pow);
      for (const d of foes) d.morale = Math.max(0, d.morale - 8 * pow);
      ev(sim, 'skill', `${nm}乘夜衔枚劫营，${sim[foe].name}营中惊扰！`, { side });
      break;
  }
  return true;
}
/** 电脑（与部将代打）用战法 */
function aiSkills(sim: FieldSim, side: 'att' | 'def', engaged: boolean) {
  const can = (id: SkillId) => !skillBlock(sim, side, id);
  if (can('laststand') && engaged && sim.resolve[side] < 40) { useSkill(sim, side, 'laststand'); return; }
  if (can('volley') && sim.units.some(u => u.side === side && u.state === 'shoot')) { useSkill(sim, side, 'volley'); return; }
  if (can('fire') && engaged) { useSkill(sim, side, 'fire'); return; }
  if (can('feint') && sim.t > 30 && !engaged && sim.units.some(f => f.side !== side && active(f) && sim.units.some(m => m.side === side && dist(m, f) < 420))) { useSkill(sim, side, 'feint'); return; }
  if (can('ambush') && sim.t > 20 && !engaged) { useSkill(sim, side, 'ambush'); return; }
  if (can('raid')) useSkill(sim, side, 'raid');
}

/** 战场变故 */
function twist(sim: FieldSim, kind: TwistKind, side: 'att' | 'def') {
  const nm = sim[side].name;
  switch (kind) {
    case 'windshift': {
      const was = sim.weather;
      sim.weather = was === 'clear' || was === 'fog' ? 'wind' : was === 'wind' ? 'rain' : 'clear';
      if (sim.weather === 'wind' && !sim.wind) sim.wind = side === 'att' ? -1 : 1;
      if (sim.weather !== 'wind' && sim.mode !== 'naval') sim.wind = 0;
      ev(sim, 'twist', sim.weather === 'wind' ? '狂风骤起，旌旗猎猎——火攻之机！' : sim.weather === 'rain' ? '骤雨倾盆，火绳尽湿，铳炮难施。' : '雨霁云开，铳炮复振。');
      for (const sd of ['att', 'def'] as const) if (sim.weather === 'wind' && !sim.skills[sd].includes('fire') && sim.skills[sd].length < 4) sim.skills[sd].push('fire');
      break;
    }
    case 'relief':
      for (const u of sim.units) if (u.side === side && active(u)) u.morale = Math.min(100, u.morale + 10);
      sim.resolve[side] = Math.min(100, sim.resolve[side] + 8);
      ev(sim, 'twist', `探马飞报：${nm}后队援兵将至，全军振奋！`, { side });
      break;
    case 'wound':
      sim.buff[side].wounded = 1;
      sim.resolve[side] = Math.max(0, sim.resolve[side] - 10);
      ev(sim, 'twist', `${sim[side].commanderName}中流矢负伤，${nm}军心浮动！`, { side });
      break;
    case 'mutiny': {
      const u = sim.units.filter(x => x.side === side && active(x)).sort((a, b) => a.morale - b.morale)[0];
      if (!u) break;
      if (u.morale < 45 && pressed(sim, u)) { u.state = 'rout'; ev(sim, 'twist', `${nm}${u.name}哗变，阵脚大乱！`, { side, unit: u.id }); }
      else { u.morale = Math.max(0, u.morale - 15); ev(sim, 'twist', `${nm}${u.name}军中鼓噪，士气骤降。`, { side, unit: u.id }); }
      break;
    }
  }
}

/** 开战前的奇谋：谋略远胜对方（差二十以上）的一方，有机会诱敌入伏（守方）或出奇掩袭（攻方）——
 *  一营精兵潜至敌阵侧后、不为敌见，敌军未战先惊。谋差四十约三成半，至多五成；兵少者用计更急（多一成）。
 *  这是以少胜多的主要手段：对方主将谋略相当时几乎不会发生。 */
export function openingChance(b: Pick<BattleState, 'att' | 'def' | 'kind'>, side: 'att' | 'def'): number {
  if (b.kind === 'naval') return 0;
  const foe = side === 'att' ? 'def' : 'att';
  const gap = (b[side].mou ?? 50) - (b[foe].mou ?? 50);
  if (gap < 20) return 0;
  const fewer = b[side].lanes.reduce((n, l) => n + l.troops, 0) < b[foe].lanes.reduce((n, l) => n + l.troops, 0) ? 0.1 : 0;
  return clamp((gap - 20) / 60 + 0.05 + fewer, 0, 0.5);
}
function stratagemOpening(sim: FieldSim, b: BattleState, rng: Rng) {
  for (const side of ['att', 'def'] as const) {
    const roll = rng.next();
    if (roll >= openingChance(b, side)) continue;
    const foe = foeOf(side);
    // 伏兵：骑营优先，没有骑兵就用一支步营
    const pick = sim.units.filter(u => u.side === side && (u.kind === 'cav' || u.kind === 'inf')).sort((x, y) => (y.kind === 'cav' ? 1 : 0) - (x.kind === 'cav' ? 1 : 0) || y.troops - x.troops)[0];
    if (!pick) continue;
    const foes = sim.units.filter(u => u.side === foe);
    const fy = foes.reduce((n, u) => n + u.y, 0) / Math.max(1, foes.length);
    // 伏在敌阵侧后：横向贴边，纵向在敌阵稍后
    pick.x = pick.x < 500 ? 70 : 930;
    pick.y = clamp(fy + (foe === 'att' ? 90 : -90), 40, 960);
    pick.hidden = true;
    for (const u of foes) u.morale = Math.max(0, u.morale - 8);
    sim.resolve[foe] = Math.max(0, sim.resolve[foe] - 6);
    sim.flags['opening' + side] = 1;
    ev(sim, 'ambush', side === 'def'
      ? `${b.def.commanderName}佯退诱敌，${b.att.name}追入伏地——${pick.name}已潜伏在侧后！`
      : `${b.att.commanderName}出奇兵，${pick.name}间道潜至${b.def.name}阵后！`, { side, unit: pick.id });
    break;
  }
}

/** 排队命令：当前之令完成即接下一道 */
function advanceQueues(sim: FieldSim) {
  for (const u of sim.units) {
    if (!u.queue?.length || !active(u)) continue;
    const o = u.order;
    const tg = 'target' in o && o.target ? sim.units.find(x => x.id === o.target) : undefined;
    const done = o.t === 'hold' ? u.state === 'idle' || u.state === 'shoot'
      : o.t === 'move' ? Math.hypot(u.x - o.x, u.y - o.y) < 14
      : (o.t === 'attack' || o.t === 'fire') ? !tg || !active(tg) : false;
    if (done) u.order = u.queue.shift()!;
  }
}
/** 伏兵：在林中原地静候六秒即隐；一动或接敌即现（“伏兵”计所隐者，接敌前一直隐） */
function lurkAll(sim: FieldSim, dt: number) {
  for (const u of sim.units) {
    if (!active(u) || sim.mode !== 'field') continue;
    const still = u.state === 'idle' && !u.engaged && inFeature(sim, u, 'woods');
    if (still) { u.lurk = (u.lurk ?? 0) + dt; if (u.lurk >= 6 && !u.hidden) u.hidden = true; }
    else if (u.lurk) { u.lurk = 0; if (u.state !== 'move' || !u.hidden) u.hidden = u.hidden && u.state === 'move' ? true : false; }
  }
}

/* ---------------- 战机：关键时刻停下来请主帅定夺（部将代打时也会） ---------------- */
export interface Moment { id: string; title: string; text: string; options: { label: string; desc: string; apply: (sim: FieldSim) => void }[] }
export function momentF(sim: FieldSim, side: 'att' | 'def'): Moment | null {
  if (sim.over || sim.t < 5) return null;
  const foe = foeOf(side), once = (id: string) => !sim.moments.includes(id);
  const mine = sim.units.filter(u => u.side === side && active(u)), foes = sim.units.filter(u => u.side === foe && active(u));
  const fire = (id: string, m: Omit<Moment, 'id'>): Moment => { sim.moments.push(id); return { id, ...m }; };
  // 敌骑抄我侧后（逼近我火器、炮营，或已到我阵后）
  const midY = mine.length ? mine.reduce((n, u) => n + u.y, 0) / mine.length : 500;
  const raider = foes.find(f => f.kind === 'cav' && !f.hidden && (mine.some(m => (m.kind === 'gun' || m.kind === 'art') && dist(m, f) < 230) || (side === 'att' ? f.y > midY + 60 : f.y < midY - 60)));
  if (raider && once('flank')) {
    const guard = mine.filter(u => (u.kind === 'inf' || u.kind === 'cav') && u.state !== 'melee').sort((a, b) => dist(a, raider) - dist(b, raider))[0];
    return fire('flank', { title: '敌骑抄我侧后', text: `${sim[foe].name}${raider.name}绕出侧翼，直扑我军${mine.some(m => m.kind === 'gun' || m.kind === 'art') ? '火器、炮营' : '阵后'}！`, options: [
      { label: guard ? `遣${guard.name}迎击` : '分兵迎击', desc: '就近一营回身截住来骑', apply: s => { if (guard) commandF(s, { unit: guard.id, side, order: { t: 'attack', target: raider.id } }); } },
      { label: '火器转射来骑', desc: '火器、炮营掉转铳口射之', apply: s => { for (const u of s.units) if (u.side === side && active(u) && (u.kind === 'gun' || u.kind === 'art')) commandF(s, { unit: u.id, side, order: { t: 'fire', target: raider.id } }); } },
      { label: '不予理会，专攻正面', desc: '冒侧后受冲之险，正面不减攻势', apply: () => {} },
    ] });
  }
  if (sim.resolve[side] < 38 && once('waver')) return fire('waver', { title: '我军动摇', text: `${sim[side].name}折损渐重，军心只剩 ${Math.round(sim.resolve[side])}，前排已有退缩之意。`, options: [
    { label: '主将亲临，死战不退', desc: '士气 +12、军心 +10；兵疲', apply: s => { for (const u of s.units) if (u.side === side && active(u)) { u.morale = Math.min(100, u.morale + 12); u.stamina = Math.max(0, u.stamina - 10); } s.resolve[side] = Math.min(100, s.resolve[side] + 10); ev(s, 'skill', `${s[side].commanderName}亲临前阵，将士复振！`, { side }); } },
    { label: '收缩固守', desc: '全军原地结阵，二十秒内受伤 −15%', apply: s => { s.buff[side].brace = 20; for (const u of s.units) if (u.side === side && active(u) && u.state !== 'melee') commandF(s, { unit: u.id, side, order: { t: 'hold' } }); } },
    { label: '鸣金收兵', desc: '全军撤出战场，保全余众', apply: s => commandF(s, { unit: 'all', side, order: { t: 'retreat' } }) },
  ] });
  if (sim.resolve[foe] < 35 && sim.resolve[side] > 45 && once('chance')) return fire('chance', { title: '敌阵松动', text: `${sim[foe].name}军心只剩 ${Math.round(sim.resolve[foe])}，阵脚已乱——乘胜之机！`, options: [
    { label: '全军压上', desc: '各营一齐进击，并擂鼓助威', apply: s => { aiField(s, side, { eager: true }); drumF(s, side); } },
    { label: '骑兵直捣其最弱一营', desc: '各骑营冲其士气最低之营', apply: s => { const w = s.units.filter(u => u.side === foe && active(u)).sort((a, b) => a.morale - b.morale)[0]; if (w) for (const u of s.units) if (u.side === side && active(u) && u.kind === 'cav') commandF(s, { unit: u.id, side, order: { t: 'attack', target: w.id } }); } },
    { label: '稳扎稳打', desc: '不改部署，免得追击中阵形散乱', apply: () => {} },
  ] });
  if (sim.t >= DUSK_WARN && !sim.over && once('dusk')) return fire('dusk', { title: '日暮将至', text: '天色向晚，再过一阵便要收兵。是乘夜再战，还是收兵待旦？', options: [
    { label: '挑灯夜战', desc: '敌士气 −6；我军疲惫（体力 −15）', apply: s => { for (const u of s.units) if (active(u)) { if (u.side === foe) u.morale = Math.max(0, u.morale - 6); else u.stamina = Math.max(0, u.stamina - 15); } } },
    { label: '鸣金收兵', desc: '全军撤出战场', apply: s => commandF(s, { unit: 'all', side, order: { t: 'retreat' } }) },
    { label: '各守营垒，待天明', desc: '不改部署，日暮按战果论', apply: () => {} },
  ] });
  return null;
}
