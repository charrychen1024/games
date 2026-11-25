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
  /** 连续行进的时间（冲势）、接敌后冲锋余时 */
  run: number; charge: number;
}
export interface FEvent { t: number; kind: 'start' | 'clash' | 'charge' | 'flank' | 'fire' | 'rout' | 'rally' | 'shaky' | 'waver' | 'drum' | 'retreat' | 'dusk' | 'end'; side?: 'att' | 'def'; unit?: string; text: string }
export interface FCommand { unit: string | 'all'; side: 'att' | 'def'; order: FOrder }
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
}

/** 日暮：开战后这么多秒天黑收兵；提前提示 */
export const DUSK = 900, DUSK_WARN = 780;
export const CONTACT = 60;
/** 同侧两营之间至少隔这么远 */
const SPACING = 84;
const RANGE: Record<FKind, number> = { inf: 0, cav: 0, gun: 240, art: 520, fire: 0 };
const SPEED_FIELD: Record<FKind, number> = { inf: 38, cav: 76, gun: 34, art: 16, fire: 40 };
const SPEED_NAVAL: Record<FKind, number> = { inf: 30, cav: 56, gun: 30, art: 22, fire: 50 };
/** 高地（丘陵）：守方阵前一道岗 */
export const RIDGE = { x0: 230, x1: 770, y0: 150, y1: 262 };
/** 河（平原有河）：横贯战场，中间一处浅滩 */
export const RIVER = { y0: 470, y1: 530, ford0: 430, ford1: 570 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const active = (u: FUnit) => u.state !== 'rout' && u.state !== 'gone' && u.troops >= 1;
const alive = (u: FUnit) => u.state !== 'gone' && u.troops >= 1;
const foeOf = (s: 'att' | 'def') => (s === 'att' ? 'def' : 'att');
/** 各方的后方：攻方在纵 1000 一侧 */
const homeY = (s: 'att' | 'def') => (s === 'att' ? 1080 : -80);
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
  const mA = avgMorale(b.att), mD = avgMorale(b.def);
  const tot = (s: BattleSide) => s.lanes.reduce((n, l) => n + l.troops, 0) + (s.reserve ?? 0);
  const sim: FieldSim = {
    mode, terrain: b.terrain, t: 0, seed: b.seed, units,
    resolve: { att: mA, def: mD }, events: [],
    att: { name: b.att.name, commanderName: b.att.commanderName, tong: b.att.tong, mix: b.att.mix, start: tot(b.att), morale0: mA },
    def: { name: b.def.name, commanderName: b.def.commanderName, tong: b.def.tong, mix: b.def.mix, start: tot(b.def), morale0: mD },
    weather: b.weather, wind: b.weather === 'wind' ? (rng.next() < 0.5 ? 1 : -1) : 0,
    flags: {}, drum: { att: 0, def: 0, cdAtt: 0, cdDef: 0 },
  };
  ev(sim, 'start', mode === 'naval' ? `${b.att.name}水师与${b.def.name}水师会于${b.nodeName}江面。` : `${b.att.name}与${b.def.name}列阵于${b.nodeName}。`);
  return sim;
}
function avgMorale(s: BattleSide) { const t = s.lanes.reduce((n, l) => n + l.troops, 0); return t ? s.lanes.reduce((n, l) => n + l.morale * l.troops, 0) / t : 60; }

function compose(units: FUnit[], side: 'att' | 'def', s: BattleSide, mode: 'field' | 'naval', weather: string, rng: Rng) {
  const total = s.lanes.reduce((n, l) => n + l.troops, 0) + (s.reserve ?? 0);
  const morale = avgMorale(s);
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
    u.order = c.order;
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
  moveAll(sim, dt);
  fightAll(sim, dt, rng);
  moraleAll(sim, dt);
  settleF(sim);
  return sim;
}

const contacts = (sim: FieldSim, u: FUnit) => sim.units.filter(x => x.side !== u.side && alive(x) && dist(u, x) < CONTACT);
function speedOf(sim: FieldSim, u: FUnit, dy: number) {
  let sp = (sim.mode === 'naval' ? SPEED_NAVAL : SPEED_FIELD)[u.kind] * (0.6 + 0.4 * u.stamina / 100);
  if (inRiver(sim, u.x, u.y)) sp *= 0.35;
  if (sim.mode === 'naval' && sim.wind) sp *= 1 + 0.3 * Math.sign(dy) * sim.wind;   // 顺风快、逆风慢
  if (u.state === 'rout') sp *= 1.15;
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
      if (u.order.t === 'retreat') { if (goTo(sim, u, clamp(u.x, 120, 880), homeY(u.side), dt)) u.state = 'gone'; continue; }
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
        if (!tg || !alive(tg) || (tg.state === 'rout' && u.kind !== 'cav')) {
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
  return (0.5 + u.morale / 200) * (0.55 + 0.45 * u.stamina / 100) * (0.85 + sim[u.side].tong / 400) * drum;
}
function hurt(u: FUnit, dmg: number, shock = 1) {
  if (dmg <= 0 || u.troops < 1) return;
  const n = Math.min(u.troops, dmg);
  u.morale -= n / Math.max(1, u.troops) * 110 * shock;
  u.troops -= n; u.hit += n; u.engaged = true;
}
/** 一营之兵同时接敌者有限：人多也只能轮番上 */
const frontage = (n: number) => (n <= 3000 ? n : 3000 + (n - 3000) * 0.35);
function meleeMult(sim: FieldSim, a: FUnit, d: FUnit): number {
  if (sim.mode === 'naval') return ({ inf: 1, cav: 0.8, gun: 0.6, art: 0.4, fire: 0 } as Record<FKind, number>)[a.kind];
  const steady = d.state === 'idle' || (d.state === 'melee' && d.order.t === 'hold');
  switch (a.kind) {
    case 'inf': return d.kind === 'gun' ? 1.2 : d.kind === 'art' ? 1.4 : 1;
    case 'cav': return (d.kind === 'gun' ? 1.6 : d.kind === 'art' ? 1.8 : d.kind === 'inf' && steady ? 0.7 : 0.9) * (a.charge > 0 ? 2 : 1) * (d.state === 'rout' ? 1.8 : 1);
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
      if ((engagedBy.get(d.id)?.length ?? 0) >= 2) { m *= 1.3; shock *= 1.25; }
      if (fromRear(a, d) && d.state !== 'rout') {
        m *= 1.4; shock *= 1.4;
        const key = `rear${a.id}${d.id}`;
        if (!sim.flags[key]) { sim.flags[key] = 1; ev(sim, 'flank', `${sim[a.side].name}${a.name}抄到${sim[d.side].name}${d.name}背后！`, { side: a.side, unit: a.id }); }
      }
      if (onRidge(sim, d.x, d.y) && !onRidge(sim, a.x, a.y)) m *= 0.75;      // 仰攻高地
      if (inRiver(sim, a.x, a.y)) m *= 0.8;
      if (inRiver(sim, d.x, d.y)) m *= 1.25;
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
    const r = RANGE[a.kind] * (onRidge(sim, a.x, a.y) ? 1.15 : 1);
    const dd = dist(a, d);
    if (dd > r) continue;
    const fall = 1 - 0.4 * dd / r;
    let rate = a.kind === 'art' ? (sim.mode === 'naval' ? 0.0045 : 0.0038) : 0.0022;
    if (sim.mode === 'naval' && d.kind === 'cav') rate *= 0.6;          // 快船灵便，难中
    if (d.kind === 'cav' && d.state === 'move') rate *= 1.15;
    if (onRidge(sim, d.x, d.y)) rate *= 0.85;
    if (inRiver(sim, d.x, d.y)) rate *= 1.2;
    hurt(d, a.troops * rate * power(sim, a) * (a.kind === 'gun' ? rain : 0.8 + rain * 0.2) * fall * jit() * dt, a.kind === 'art' ? 1.3 : 1);
    a.engaged = true;
  }
  // 3. 火船：接敌即燃，顺风大成
  for (const f of all) {
    if (f.kind !== 'fire' || f.state === 'rout') continue;
    const hitList = all.filter(d => d.side !== f.side && d.state !== 'gone' && dist(f, d) < CONTACT);
    if (!hitList.length) continue;
    const downwind = sim.wind === 0 ? 0.9 : Math.sign(hitList[0].y - f.y) === sim.wind ? 1.6 : 0.5;
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
    if (u.morale < 12) { u.state = 'rout'; u.charge = 0; ev(sim, 'rout', `${sim[u.side].name}${u.name}溃散！`, { side: u.side, unit: u.id }); }
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
    if (r < 15) for (const u of list) if (u.morale < 30) u.state = 'rout';
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
    if (sim.resolve[sd] <= 0 || (!act.length && !sim.flags['retreat' + sd])) {
      for (const u of sim.units) if (u.side === sd && alive(u)) u.state = 'rout';
      endF(sim, foe, sd === 'def' ? 'rout' : 'collapse', `${sim[sd].name}全军溃败，${sim[foe].name}大胜。`);
      return;
    }
  }
  for (const sd of ['att', 'def'] as const) {
    const mine = sim.units.filter(u => u.side === sd && alive(u));
    if (sim.flags['retreat' + sd] && mine.every(u => u.order.t === 'retreat' || u.state === 'rout')) {
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
  const foes = sim.units.filter(u => u.side !== side && active(u));
  if (!mine.length || !foes.length) return cmds;
  const sa = strengthF(sim, side), sf = strengthF(sim, foeOf(side));
  if (!opts.eager && sim.t > 40 && ((sim.resolve[side] < 24 && sa < sf * 0.9) || sa < sf * 0.45)) {
    commandF(sim, { unit: 'all', side, order: { t: 'retreat' } });
    for (const u of mine) cmds.push({ unit: u.id, side, order: { t: 'retreat' } });
    return cmds;
  }
  // 守方：据阵而待，敌近则迎击；自觉势大则出击。攻方：压上
  // 守方占着高地或隔河，不轻易下来
  const terrainEdge = side === 'def' && sim.mode === 'field' && (sim.terrain === 'hills' || sim.terrain === 'river');
  const aggressive = opts.eager || (!opts.hold && (side === 'att' || sa > sf * (terrainEdge ? 2 : 1.4) || (!terrainEdge && sim.t > 240)));
  // 平地上守方见敌压近便迎上去，两军在战场中段接战；占地利者待敌来攻
  const meet = terrainEdge ? 70 : 420;
  const engaged = foes.filter(f => sim.units.some(m => m.side === side && alive(m) && dist(m, f) < CONTACT));
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
    if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; }
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
