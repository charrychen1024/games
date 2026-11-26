/* 攻城战 · 即时模拟（见 Docs/战斗重做方案-2026-11-24.md）
 * 战场：横 0—1000、纵 0—1000。城墙在纵 100 处，分 SEGMENTS 段，中段有城门；城内在纵 100 以内；攻方自纵 600—850 列阵。
 * 双方各有若干“营”。每营：兵数、士气、体力、位置、所奉之令、当前情状。
 * 每营头顶的数字与细条、城墙各段的城防、城门耐久、两军军心，画面都直接取自这里。
 * 不分回合、不设时间上限：以城破、献城、击退、鸣金结束。军心有“动摇—将溃—崩溃”的过程，下跌有速度上限。
 * 纯逻辑：同一战局、同一组命令，结果完全相同（随机数只来自种子）。 */
import type { BattleState, BattleSide } from './battle';
import { makeRng, type Rng } from './rng';

export const SEGMENTS = 5;
export const GATE_SEG = Math.floor(SEGMENTS / 2);
export const WALL_Y = 100, FOOT_Y = 128, INSIDE_Y = 50, COVER_Y = 290, ARTY_Y = 440, HOLD_Y = 520;
export const segX = (i: number) => (i + 0.5) * (1000 / SEGMENTS);
/** 城头箭铳能及之处 */
const WALL_RANGE_Y = 380, WALL_RANGE_X = 260;   // 弓铳射程之内；炮营列于其外

export type UKind = 'inf' | 'cav' | 'gun' | 'art';
export type UState = 'idle' | 'move' | 'bombard' | 'shoot' | 'climb' | 'ram' | 'wall' | 'inside' | 'sortie' | 'rout' | 'gone';
export type SOrder =
  | { t: 'hold'; x?: number; y?: number }
  | { t: 'move'; x: number; y: number }
  | { t: 'assault'; seg: number }   // 攻：架云梯登某段（有缺口则由缺口入城）
  | { t: 'ram' }                    // 攻：撞城门
  | { t: 'bombard'; seg: number }   // 攻：炮击某段
  | { t: 'cover'; seg: number }     // 攻：火器压制某段城头
  | { t: 'enter' }                  // 攻：由最近的缺口或城门入城
  | { t: 'retreat' }                // 攻：撤出战场
  | { t: 'man'; seg: number }       // 守：守某段
  | { t: 'reserve' }                // 守：回城内作预备
  | { t: 'repair'; seg: number }    // 守：修某段
  | { t: 'sortie' };                // 守：开门出击
export interface SUnit {
  id: string; side: 'att' | 'def'; kind: UKind; name: string;
  troops: number; start: number; morale: number; stamina: number;
  x: number; y: number; order: SOrder; state: UState; seg?: number;
  /** 这一步受了多少伤（画面飘字用） */
  hit: number;
  /** 正在交战（不回士气） */
  engaged: boolean;
  /** 出击计时 */
  timer?: number;
}
export interface SEvent { t: number; kind: 'start' | 'gate' | 'breach' | 'scale' | 'enter' | 'rout' | 'shaky' | 'waver' | 'supply' | 'drum' | 'retreat' | 'end'; side?: 'att' | 'def'; seg?: number; unit?: string; text: string }
export interface SCommand { unit: string | 'all'; side: 'att' | 'def'; order: SOrder }
export interface SiegeSim {
  t: number; seed: number;
  units: SUnit[];
  segs: { hp: number; max: number; taken: boolean }[];
  gate: { hp: number; max: number };
  resolve: { att: number; def: number };
  /** 夺城进度 0—100：入城之兵压过城内守军时上涨 */
  capture: number;
  events: SEvent[];
  over?: { t: number; winner: 'att' | 'def'; outcome: 'breach' | 'surrender' | 'repulsed' | 'retreat' | 'collapse' | 'abandon' };
  att: Pick<BattleSide, 'name' | 'commanderName' | 'tong' | 'mix' | 'wai' | 'surrender'> & { start: number; morale0: number };
  def: Pick<BattleSide, 'name' | 'commanderName' | 'tong' | 'mix' | 'wai' | 'surrender'> & { start: number; morale0: number };
  weather: string;
  flags: Record<string, number>;
  /** 鼓舞（擂鼓）剩余时间与冷却 */
  drum: { att: number; def: number; cdAtt: number; cdDef: number };
}

const SPEED: Record<UKind, number> = { inf: 38, cav: 70, gun: 36, art: 18 };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const active = (u: SUnit) => u.state !== 'rout' && u.state !== 'gone' && u.troops >= 1;

/* ---------------- 编成 ---------------- */
export function createSiege(b: BattleState): SiegeSim {
  const rng = makeRng(b.seed);
  const totA = b.att.lanes.reduce((n, l) => n + l.troops, 0) + (b.att.reserve ?? 0);
  const totD = b.def.lanes.reduce((n, l) => n + l.troops, 0) + (b.def.reserve ?? 0);
  const mA = avgMorale(b.att), mD = avgMorale(b.def);
  const units: SUnit[] = [];
  const mk = (side: 'att' | 'def', kind: UKind, name: string, troops: number, x: number, y: number, order: SOrder, state: UState, seg?: number, morale = side === 'att' ? mA : mD): SUnit =>
    ({ id: `${side}${units.length}`, side, kind, name, troops, start: troops, morale, stamina: 100, x, y, order, state, seg, hit: 0, engaged: false });
  // 攻方：炮营（火器多才有）、火器营、骑营、步营二至三
  const mix = b.att.mix;
  const parts: { kind: UKind; name: string; share: number }[] = [];
  if (mix.gun >= 0.12) parts.push({ kind: 'art', name: '炮营', share: mix.gun * 0.45 }, { kind: 'gun', name: '火器营', share: mix.gun * 0.55 });
  else if (mix.gun > 0.03) parts.push({ kind: 'gun', name: '弓铳营', share: mix.gun });
  if (mix.cav > 0.05) parts.push({ kind: 'cav', name: '骑营', share: mix.cav });
  const infShare = 1 - parts.reduce((n, p) => n + p.share, 0);
  const nInf = totA * infShare > 24000 ? 3 : totA * infShare > 9000 ? 2 : 1;
  const infNames = ['前营', '左营', '右营'];
  for (let k = 0; k < nInf; k++) parts.push({ kind: 'inf', name: infNames[k], share: infShare / nInf });
  let left = totA;
  parts.forEach((p, i) => {
    const n = i === parts.length - 1 ? left : Math.max(0, Math.round(totA * p.share));
    left -= n;
    if (n <= 0) return;
    const pos = p.kind === 'art' ? [620, 790] : p.kind === 'gun' ? [380, 740] : p.kind === 'cav' ? [rng.next() < 0.5 ? 250 : 750, 800] : [[500, 650], [320, 680], [680, 680]][infNames.indexOf(p.name)];
    units.push(mk('att', p.kind, p.name, n, pos[0], pos[1], { t: 'hold' }, 'idle'));
  });
  // 守方：七成五分守各段（城门一段加厚），其余在城内作预备
  const w = Array.from({ length: SEGMENTS }, (_, i) => (i === GATE_SEG ? 1.5 : 1));
  const ws = w.reduce((a, x) => a + x, 0);
  const onWall = Math.round(totD * 0.75);
  let dl = totD;
  for (let i = 0; i < SEGMENTS; i++) {
    const n = Math.round(onWall * w[i] / ws);
    dl -= n;
    units.push(mk('def', b.def.mix.gun > 0.1 ? 'gun' : 'inf', `${['左', '左次', '城门', '右次', '右'][i] ?? i}段守军`, n, segX(i), WALL_Y, { t: 'man', seg: i }, 'wall', i));
  }
  units.push(mk('def', 'inf', '城内预备', dl, 500, INSIDE_Y, { t: 'reserve' }, 'inside'));
  const wall = clamp(b.wall, 5, 100);
  const sim: SiegeSim = {
    t: 0, seed: b.seed, units,
    segs: Array.from({ length: SEGMENTS }, () => ({ hp: wall, max: Math.max(wall, 60), taken: false })),
    gate: { hp: (40 + wall * 0.6) * clamp(b.gate ?? 1, 0, 1), max: 40 + wall * 0.6 },
    resolve: { att: mA, def: mD }, capture: 0, events: [],
    att: { name: b.att.name, commanderName: b.att.commanderName, tong: b.att.tong, mix: b.att.mix, wai: b.att.wai, surrender: b.att.surrender, start: totA, morale0: mA },
    def: { name: b.def.name, commanderName: b.def.commanderName, tong: b.def.tong, mix: b.def.mix, wai: b.def.wai, surrender: b.def.surrender, start: totD, morale0: mD },
    weather: b.weather, flags: { work: clamp(Math.sqrt(10000 / Math.max(1, totD)), 0.8, 3) }, drum: { att: 0, def: 0, cdAtt: 0, cdDef: 0 },
  };
  // 上一战（同一场围城）留下的缺口与残墙
  sim.segs.forEach((s, i) => { s.hp = b.segs && b.segs.length === SEGMENTS ? clamp(b.segs[i], 0, s.max) : wall; });
  ev(sim, 'start', `${b.att.name}兵临${b.nodeName}城下。`);
  return sim;
}
function avgMorale(s: BattleSide) { const t = s.lanes.reduce((n, l) => n + l.troops, 0); return t ? s.lanes.reduce((n, l) => n + l.morale * l.troops, 0) / t : 60; }
function ev(sim: SiegeSim, kind: SEvent['kind'], text: string, extra: Partial<SEvent> = {}) { sim.events.push({ t: Math.round(sim.t * 10) / 10, kind, text, ...extra }); }

/* ---------------- 下令 ---------------- */
export function command(sim: SiegeSim, c: SCommand) {
  const list = c.unit === 'all' ? sim.units.filter(u => u.side === c.side && active(u)) : sim.units.filter(u => u.id === c.unit && u.side === c.side && active(u));
  for (const u of list) {
    if (c.unit === 'all' && c.order.t !== 'retreat' && !legal(u, c.order)) continue;
    if (!legal(u, c.order)) continue;
    u.order = c.order;
    if (c.order.t === 'retreat') u.state = 'move';
    if (u.side === 'att' && (u.state === 'climb' || u.state === 'ram' || u.state === 'shoot' || u.state === 'bombard') && c.order.t !== 'retreat') u.state = 'move';
  }
  if (c.order.t === 'retreat' && c.side === 'att' && c.unit === 'all' && !sim.flags.retreatEv) { sim.flags.retreatEv = 1; ev(sim, 'retreat', `${sim.att.commanderName}鸣金收兵。`, { side: 'att' }); }
}
export function legal(u: SUnit, o: SOrder): boolean {
  if (u.side === 'att') {
    if (['man', 'reserve', 'repair', 'sortie'].includes(o.t)) return false;
    if (o.t === 'bombard') return u.kind === 'art';
    if (o.t === 'cover') return u.kind === 'gun' || u.kind === 'art';
    if (o.t === 'ram' || o.t === 'assault') return u.kind === 'inf' || u.kind === 'cav' && o.t === 'assault';
    return true;
  }
  if (['assault', 'ram', 'bombard', 'cover', 'enter', 'retreat', 'move'].includes(o.t)) return false;
  if (u.state === 'inside' || u.state === 'wall' || u.state === 'sortie' || u.state === 'move' || u.state === 'idle') return true;
  return false;
}
/** 守方大计：开城投降，或弃城突围（守军退走，交战中的营伍折损一成五） */
export function defDecision(sim: SiegeSim, d: 'surrender' | 'abandon') {
  if (sim.over) return;
  if (d === 'surrender') { end(sim, 'att', 'surrender', `${sim.def.commanderName}开城出降。`); return; }
  for (const u of sim.units) if (u.side === 'def' && u.troops >= 1 && u.state !== 'gone') { if (u.engaged || u.state === 'sortie') u.troops *= 0.85; u.state = 'gone'; }
  end(sim, 'att', 'abandon', `${sim.def.commanderName}弃城突围，率残部退走。`);
}
/** 阵前劝降：攻方遣人入城说降守将，一战一次。看攻方外交、守将降意、守军军心与兵势。成则开城出降。 */
export function persuadeOdds(sim: SiegeSim): number {
  const ratio = armyStrength(sim, 'att') / Math.max(1, armyStrength(sim, 'def'));
  return clamp(0.04 + (sim.att.wai - 50) / 250 + (sim.def.surrender - 40) / 160 + (50 - sim.resolve.def) / 150 + Math.min(0.15, (ratio - 1) * 0.04) + (sim.gate.hp <= 0 || sim.segs.some(s => s.hp <= 0) ? 0.12 : 0), 0.02, 0.85);
}
export function persuade(sim: SiegeSim): boolean | null {
  if (sim.over || sim.flags.persuaded) return null;
  sim.flags.persuaded = 1;
  const p = persuadeOdds(sim);
  const ok = makeRng(sim.seed * 13 + 7 + Math.floor(sim.t * 10)).next() < p;   // 何时劝也算在骰里：读档重打不会骰值不变
  if (ok) end(sim, 'att', 'surrender', `${sim.att.name}遣使入城说降，${sim.def.commanderName}开城出降。`);
  else ev(sim, 'drum', `${sim.att.name}遣使入城劝降，${sim.def.commanderName}斩使示众，守军益坚。`, { side: 'def' });
  if (!ok) for (const u of sim.units) if (u.side === 'def' && active(u)) u.morale = Math.min(100, u.morale + 4);
  return ok;
}
/** 擂鼓：全军士气上扬一阵，六十秒一次 */
export function drum(sim: SiegeSim, side: 'att' | 'def'): boolean {
  const cd = side === 'att' ? 'cdAtt' : 'cdDef';
  if (sim.drum[cd] > 0 || sim.over) return false;
  sim.drum[side] = 12; sim.drum[cd] = 60;
  for (const u of sim.units) if (u.side === side && active(u)) u.morale = Math.min(100, u.morale + 8);
  ev(sim, 'drum', `${sim[side].commanderName}擂鼓，${sim[side].name}士气大振。`, { side });
  return true;
}

/* ---------------- 推进一步 ---------------- */
/** 演算的一拍（秒）：与野战相同，按固定一拍逐拍推进，结果与显示速度无关 */
export const TICK = 0.1;
export function stepSiege(sim: SiegeSim, dt: number, cmds: SCommand[] = []) {
  if (sim.over) return sim;
  for (const c of cmds) command(sim, c);
  const n = Math.max(1, Math.round(dt / TICK));
  for (let i = 0; i < n && !sim.over; i++) tickSiege(sim, TICK);
  return sim;
}
function tickSiege(sim: SiegeSim, dt: number) {
  const rng = makeRng(sim.seed * 31 + Math.round(sim.t * 10));
  sim.t = Math.round((sim.t + dt) * 1000) / 1000;
  for (const u of sim.units) { u.hit = 0; u.engaged = false; }
  for (const k of ['att', 'def'] as const) { sim.drum[k] = Math.max(0, sim.drum[k] - dt); }
  sim.drum.cdAtt = Math.max(0, sim.drum.cdAtt - dt); sim.drum.cdDef = Math.max(0, sim.drum.cdDef - dt);
  move(sim, dt);
  fight(sim, dt, rng);
  morale(sim, dt);
  settle(sim, dt);
  return sim;
}

const opening = (sim: SiegeSim, s: number) => sim.segs[s].hp <= 0 || (s === GATE_SEG && sim.gate.hp <= 0);
function openings(sim: SiegeSim) { return Array.from({ length: SEGMENTS }, (_, i) => i).filter(i => opening(sim, i)); }
const defOnSeg = (sim: SiegeSim, s: number) => sim.units.filter(u => u.side === 'def' && active(u) && u.state === 'wall' && u.seg === s);

function goTo(u: SUnit, x: number, y: number, dt: number): boolean {
  const dx = x - u.x, dy = y - u.y, d = Math.hypot(dx, dy);
  const sp = SPEED[u.kind] * (0.6 + 0.4 * u.stamina / 100) * dt;
  if (d <= sp) { u.x = x; u.y = y; return true; }
  u.x += dx / d * sp; u.y += dy / d * sp;
  u.stamina = Math.max(0, u.stamina - 0.12 * dt);
  return false;
}

function move(sim: SiegeSim, dt: number) {
  for (const u of sim.units) {
    if (u.state === 'gone' || u.troops < 1) { if (u.state !== 'gone') u.state = 'gone'; continue; }
    if (u.state === 'rout') {
      if (u.side === 'att') {
        // 溃兵退到射程之外收拢；军心尚在、士气回升则重整再战（鸣金者才离场）
        if (u.order.t === 'retreat') { if (goTo(u, u.x, 1080, dt)) u.state = 'gone'; }
        else { goTo(u, u.x, 760, dt); u.morale = Math.min(100, u.morale + 0.6 * dt); if (u.morale > 40 && sim.resolve.att > 20 && u.y > 700) { u.state = 'idle'; u.order = { t: 'hold', x: u.x, y: u.y }; ev(sim, 'rout', `${sim.att.name}${u.name}收拢溃卒，重整再战。`, { side: 'att', unit: u.id }); } }
      }
      else {
        goTo(u, 500, 20, dt);
        if (u.morale > 38 && sim.resolve.def > 18) { u.state = 'inside'; u.order = { t: 'reserve' }; u.seg = undefined; }
      }
      continue;
    }
    const o = u.order;
    if (u.side === 'att') {
      if (u.state === 'inside') { goTo(u, clamp(u.x, 200, 800), INSIDE_Y, dt); continue; }
      if (u.state === 'wall') { u.timer = (u.timer ?? 0) + dt; if (u.timer > 3) { u.state = 'inside'; u.timer = 0; ev(sim, 'enter', `${sim.att.name}${u.name}自城头杀入城中。`, { side: 'att', unit: u.id, seg: u.seg }); } continue; }
      switch (o.t) {
        case 'retreat': u.state = 'move'; if (goTo(u, u.x, 1080, dt)) u.state = 'gone'; break;
        case 'hold': case 'move': { const tx = o.t === 'move' ? o.x : o.x ?? u.x, ty = o.t === 'move' ? o.y : o.y ?? u.y; u.state = goTo(u, tx, Math.max(ty, FOOT_Y + 40), dt) ? 'idle' : 'move'; break; }
        case 'bombard': u.seg = o.seg; u.state = goTo(u, segX(o.seg), ARTY_Y, dt) ? 'bombard' : 'move'; break;
        case 'cover': u.seg = o.seg; u.state = goTo(u, segX(o.seg) + (u.kind === 'art' ? 0 : 30), u.kind === 'art' ? ARTY_Y : COVER_Y, dt) ? 'shoot' : 'move'; break;
        case 'ram': {
          u.seg = GATE_SEG;
          if (sim.gate.hp <= 0) { u.order = { t: 'enter' }; break; }
          u.state = goTo(u, segX(GATE_SEG), FOOT_Y, dt) ? 'ram' : 'move';
          break;
        }
        case 'enter': {
          const op = openings(sim);
          if (!op.length) { u.state = goTo(u, u.x, COVER_Y + 60, dt) ? 'idle' : 'move'; break; }
          const s = op.sort((a, b2) => Math.abs(segX(a) - u.x) - Math.abs(segX(b2) - u.x))[0];
          u.seg = s;
          if (goTo(u, segX(s), FOOT_Y, dt)) { u.state = 'inside'; u.y = WALL_Y - 10; ev(sim, 'enter', `${sim.att.name}${u.name}由${s === GATE_SEG && sim.gate.hp <= 0 ? '城门' : '缺口'}涌入城中。`, { side: 'att', unit: u.id, seg: s }); }
          else u.state = 'move';
          break;
        }
        case 'assault': {
          u.seg = o.seg;
          if (opening(sim, o.seg)) { u.order = { t: 'enter' }; break; }
          if (!goTo(u, segX(o.seg) + (Number(u.id.slice(3)) % 3 - 1) * 30, FOOT_Y, dt)) { u.state = 'move'; break; }
          if (!defOnSeg(sim, o.seg).length) {
            u.state = 'wall'; u.timer = 0; u.y = WALL_Y;
            if (!sim.segs[o.seg].taken) { sim.segs[o.seg].taken = true; ev(sim, 'scale', `${sim.att.name}${u.name}登上${segName(o.seg)}城头！`, { side: 'att', seg: o.seg, unit: u.id }); }
          } else u.state = 'climb';
          break;
        }
        default: break;
      }
    } else {
      // 守方
      if (u.state === 'sortie' || o.t === 'sortie') {
        if (sim.gate.hp <= 0 || u.morale < 40 || (u.timer ?? 0) > 25) { u.order = { t: 'reserve' }; u.state = 'move'; u.timer = 0; }
        else { u.timer = (u.timer ?? 0) + dt; u.state = goTo(u, segX(GATE_SEG), 200, dt) ? 'sortie' : 'move'; continue; }
      }
      if (o.t === 'man' || o.t === 'repair') { u.seg = o.seg; u.state = goTo(u, segX(o.seg), WALL_Y, dt) ? 'wall' : 'move'; }
      else if (o.t === 'reserve') { u.seg = undefined; u.state = goTo(u, 500, INSIDE_Y, dt) ? 'inside' : 'move'; }
    }
    if (u.state === 'idle' || u.state === 'inside' || u.state === 'wall' || u.state === 'bombard' || u.state === 'shoot') u.stamina = Math.min(100, u.stamina + 0.35 * dt);
  }
}
export const segName = (s: number) => (s === GATE_SEG ? '城门' : s < GATE_SEG ? (s === 0 ? '左城' : '左次段') : (s === SEGMENTS - 1 ? '右城' : '右次段'));

/* ---------------- 交战 ---------------- */
function power(sim: SiegeSim, u: SUnit) {
  const side = sim[u.side];
  const drum = sim.drum[u.side] > 0 ? 1.12 : 1;
  return (0.5 + u.morale / 200) * (0.55 + 0.45 * u.stamina / 100) * (0.85 + side.tong / 400) * drum;
}
function hurt(u: SUnit, dmg: number) {
  if (dmg <= 0 || u.troops < 1) return;
  const n = Math.min(u.troops, dmg);
  u.morale -= n / Math.max(1, u.troops) * 115;
  u.troops -= n;
  u.hit += n;
  u.engaged = true;
}
/** 把伤害按兵数分给一组营 */
function spread(list: SUnit[], dmg: number) {
  const tot = list.reduce((n, u) => n + u.troops, 0);
  if (!tot) return;
  for (const u of list) hurt(u, dmg * u.troops / tot);
}

function fight(sim: SiegeSim, dt: number, rng: Rng) {
  const att = sim.units.filter(u => u.side === 'att' && active(u));
  const def = sim.units.filter(u => u.side === 'def' && active(u));
  const rain = sim.weather === 'rain' ? 0.55 : 1;
  const jit = () => 0.9 + rng.next() * 0.2;
  // 1. 城头箭铳：射城下之敌，攀城、撞门者首当其冲
  for (const d of def) {
    if (d.state !== 'wall' || d.seg === undefined) continue;
    const sx = segX(d.seg);
    const targets = att.filter(a => a.state !== 'inside' && a.state !== 'wall' && a.y < WALL_RANGE_Y && Math.abs(a.x - sx) < WALL_RANGE_X);
    if (!targets.length) continue;
    const near = targets.sort((a, b) => a.y - b.y)[0];
    const fire = d.troops * 0.0055 * (1 + sim.def.mix.gun * 1.2 * rain) * power(sim, d) * (d.order.t === 'repair' ? 0.5 : 1) * jit();
    const bonus = near.state === 'ram' ? 2 : near.state === 'climb' ? 1.5 : 1;
    hurt(near, fire * bonus * dt);
    d.engaged = true;
  }
  // 2. 炮击：毁城墙，兼伤城头
  for (const a of att) {
    if (a.state !== 'bombard' || a.seg === undefined) continue;
    const s = sim.segs[a.seg];
    if (s.hp > 0) {
      s.hp = Math.max(0, s.hp - Math.min(a.troops, 4000) * 0.000055 * (sim.flags.work ?? 1) * rain * jit() * dt * (0.8 + sim.att.tong / 300));
      if (s.hp <= 0) { ev(sim, 'breach', `${segName(a.seg)}城墙被轰塌，现出缺口！`, { side: 'att', seg: a.seg }); }
    }
    spread(defOnSeg(sim, a.seg), Math.min(a.troops, 4000) * 0.0004 * dt);   // 一段城前炮位有数，炮多也只能轮番放
  }
  // 3. 火器压制城头
  for (const a of att) {
    if (a.state !== 'shoot' || a.seg === undefined) continue;
    const s = sim.segs[a.seg];
    const cover = 0.25 + 0.75 * (1 - s.hp / s.max);
    spread(defOnSeg(sim, a.seg), a.troops * 0.003 * cover * rain * power(sim, a) * jit() * dt);
    a.engaged = true;
  }
  // 4. 撞门
  for (const a of att) {
    if (a.state !== 'ram') continue;
    if (sim.gate.hp > 0) {
      sim.gate.hp = Math.max(0, sim.gate.hp - Math.min(a.troops, 3000) * 0.00022 * (sim.flags.work ?? 1) * power(sim, a) * jit() * dt);
      if (sim.gate.hp <= 0) ev(sim, 'gate', `城门被撞开！`, { side: 'att', seg: GATE_SEG });
    }
    a.engaged = true;
  }
  // 5. 攀城：城下攀梯者与城头守军相搏，城越完好攀者越吃亏
  for (let s = 0; s < SEGMENTS; s++) {
    const climbers = att.filter(a => a.state === 'climb' && a.seg === s);
    if (!climbers.length) continue;
    const guards = defOnSeg(sim, s);
    if (!guards.length) continue;
    const seg = sim.segs[s], f = seg.hp / seg.max;
    // 云梯有数：一段城墙同时攀得上去交手的人有限（城越完好越少），城下人多也只能轮番上
    const front = 1800 + 2600 * (1 - f);
    const raw = climbers.reduce((n, a) => n + a.troops, 0), pw = climbers.reduce((n, a) => n + a.troops * power(sim, a), 0) / Math.max(1, raw);
    const ap = Math.min(raw, front) * pw, dp = guards.reduce((n, d) => n + d.troops * power(sim, d), 0);
    spread(guards, ap * 0.0055 * (0.35 + 0.65 * (1 - f)) * jit() * dt);
    spread(climbers, dp * 0.015 * (0.35 + 0.65 * f) * jit() * dt);
  }
  // 6. 巷战：入城之兵与城中守军（含城头）相搏，守军熟悉街巷
  const inside = att.filter(a => a.state === 'inside' || a.state === 'wall');
  if (inside.length) {
    const defenders = def.filter(d => d.state === 'inside' || d.state === 'wall' || d.state === 'move');
    if (defenders.length) {
      // 街巷之中骑兵施展不开
      const ap = inside.reduce((n, a) => n + a.troops * power(sim, a) * (a.kind === 'cav' ? 0.55 : 1), 0), dp = defenders.reduce((n, d) => n + d.troops * power(sim, d), 0);
      spread(defenders, ap * 0.0055 * jit() * dt);
      spread(inside, dp * 0.0055 * 1.2 * jit() * dt);
    }
  }
  // 6.5 修城：守军边守边补
  for (const d of def) if (d.order.t === 'repair' && d.state === 'wall') { const s = sim.segs[d.order.seg]; if (s.hp > 0) s.hp = Math.min(s.max, s.hp + d.troops * 0.00025 * dt); }
  // 7. 出城突击：城门外之敌
  for (const d of def) {
    if (d.state !== 'sortie') continue;
    const foes = att.filter(a => Math.hypot(a.x - d.x, a.y - d.y) < 110 && a.state !== 'inside');
    if (!foes.length) continue;
    const ap = foes.reduce((n, a) => n + a.troops * power(sim, a), 0);
    spread(foes, d.troops * power(sim, d) * 0.007 * jit() * dt * (foes.some(f => f.kind === 'art') ? 1.4 : 1));
    hurt(d, ap * 0.006 * jit() * dt);
  }
}

/* ---------------- 士气与军心 ---------------- */
export function armyStrength(sim: SiegeSim, side: 'att' | 'def') {
  return sim.units.filter(u => u.side === side && active(u)).reduce((n, u) => n + u.troops * (0.4 + u.morale / 100), 0);
}
function morale(sim: SiegeSim, dt: number) {
  const supply = sim.t > 480;   // 顿兵城下过久：粮秣不继
  if (supply && !sim.flags.supplyEv) { sim.flags.supplyEv = 1; ev(sim, 'supply', `${sim.att.name}顿兵城下日久，粮秣渐乏，士卒疲惫。`, { side: 'att' }); }
  for (const u of sim.units) {
    if (!active(u)) continue;
    const cap = u.side === 'att' ? sim.att.morale0 + 10 : sim.def.morale0 + 10;
    // 顿兵日久：攻方歇着也不再回士气
    if (!u.engaged && !(supply && u.side === 'att')) u.morale = Math.min(cap, u.morale + 0.5 * dt);
    if (supply && u.side === 'att') { u.morale -= 0.06 * dt; u.stamina = Math.max(0, u.stamina - 0.05 * dt); }
    u.morale = clamp(u.morale, 0, 100);
    if (u.morale < 12 && u.state !== 'rout') { u.state = 'rout'; ev(sim, 'rout', `${sim[u.side].name}${u.name}溃散。`, { side: u.side, unit: u.id }); }
  }
  for (const sd of ['att', 'def'] as const) {
    const list = sim.units.filter(u => u.side === sd && active(u));
    const tot = list.reduce((n, u) => n + u.troops, 0);
    const wm = tot ? list.reduce((n, u) => n + u.morale * u.troops, 0) / tot : 0;
    const share = tot / Math.max(1, sim[sd].start);
    let target = wm * (0.35 + 0.65 * Math.sqrt(share));
    if (sd === 'def') {
      if (sim.gate.hp <= 0) target -= 10;
      target -= sim.segs.filter(s => s.hp <= 0 || s.taken).length * 5;
      const inA = sim.units.filter(u => u.side === 'att' && active(u) && (u.state === 'inside' || u.state === 'wall')).reduce((n, u) => n + u.troops, 0);
      target -= Math.min(25, inA / Math.max(1, tot) * 20);
    }
    if (!tot) target = 0;
    const r0 = sim.resolve[sd];
    // 下跌有速度上限：从“动摇”到崩溃至少十几秒，看得见、救得及
    sim.resolve[sd] = clamp(r0 + clamp(target - r0, -2 * dt, 1 * dt), 0, 100);
    const r = sim.resolve[sd];
    if (r < 30 && !sim.flags['shaky' + sd]) { sim.flags['shaky' + sd] = 1; ev(sim, 'shaky', `${sim[sd].name}军心动摇！`, { side: sd }); }
    if (r < 15 && !sim.flags['waver' + sd]) {
      sim.flags['waver' + sd] = 1;
      ev(sim, 'waver', `${sim[sd].name}将溃——士气低落的营伍开始后退！`, { side: sd });
    }
    if (r < 15) for (const u of list) if (u.morale < 32 && u.state !== 'inside') { u.state = 'rout'; }
    if (r >= 35) { delete sim.flags['waver' + sd]; }
  }
}

/* ---------------- 胜负 ---------------- */
/** 城小则门小墙薄：撞门、炮击的功效按守军规模折算（flags.work），免得小城反比大城难打 */
/** 一场攻城至多打这么久（秒），到点收兵 */
export const SIEGE_DUSK = 1200;
function end(sim: SiegeSim, winner: 'att' | 'def', outcome: NonNullable<SiegeSim['over']>['outcome'], text: string) {
  sim.over = { t: sim.t, winner, outcome };
  ev(sim, 'end', text, { side: winner });
}
function settle(sim: SiegeSim, dt: number) {
  const attAct = sim.units.filter(u => u.side === 'att' && active(u));
  const defAct = sim.units.filter(u => u.side === 'def' && active(u));
  const attIn = attAct.filter(u => u.state === 'inside' || u.state === 'wall').reduce((n, u) => n + u.troops, 0);
  const defAll = defAct.reduce((n, u) => n + u.troops, 0);
  // 夺城：入城之兵压过城中守军，进度上涨；守军尽没则很快夺城
  if (attIn > 0) {
    const ratio = attIn / (attIn + defAll);
    sim.capture = clamp(sim.capture + (defAll < 1 ? 25 : 12 * (ratio - 0.45)) * dt, 0, 100);
  } else sim.capture = Math.max(0, sim.capture - 5 * dt);
  if (sim.capture >= 100) { end(sim, 'att', 'breach', `${sim.att.name}夺下全城！`); return; }
  if (sim.resolve.def <= 0 || !defAct.length) {
    if (attIn > 0) end(sim, 'att', 'breach', `守军崩溃，${sim.att.name}夺城。`);
    else end(sim, 'att', 'surrender', `守军崩溃，开城出降。`);
    return;
  }
  if (sim.resolve.att <= 0) { end(sim, 'def', 'repulsed', `${sim.att.name}军心崩溃，溃退而去。`); return; }
  if (!attAct.length) {
    const retreated = sim.units.some(u => u.side === 'att' && u.order.t === 'retreat');
    end(sim, 'def', retreated ? 'retreat' : 'repulsed', retreated ? `${sim.att.name}收兵回营，城未克。` : `${sim.att.name}溃退。`);
    return;
  }
  // 攻了二十分钟仍未破城：天晚收兵（围城未解，下月再战）
  if (sim.t >= SIEGE_DUSK) { for (const u of attAct) u.state = 'gone'; end(sim, 'def', 'retreat', `天色已晚，${sim.att.name}收兵回营，城未克。`); return; }
  // 全军已在撤：余者离场即止
  if (attAct.every(u => u.order.t === 'retreat') && attAct.every(u => u.y > 900)) {
    for (const u of attAct) u.state = 'gone';
    end(sim, 'def', 'retreat', `${sim.att.name}收兵回营，城未克。`);
  }
}

/* ---------------- 电脑指挥 ---------------- */
/** 及早止损：已折两成以上，城门尚坚（三成血以上）、城墙无缺口，再攻只是白填人命 */
function stalled(sim: SiegeSim) {
  const left = sim.units.filter(u => u.side === 'att' && u.state !== 'gone').reduce((n, u) => n + Math.max(0, u.troops), 0);
  return sim.t > 90 && left < sim.att.start * 0.78 && sim.gate.hp > sim.gate.max * 0.3 && !openings(sim).length;
}
export function aiCommands(sim: SiegeSim, side: 'att' | 'def', opts: { eager?: boolean } = {}): SCommand[] {
  const cmds: SCommand[] = [];
  const set = (u: SUnit, o: SOrder) => { if (JSON.stringify(u.order) !== JSON.stringify(o)) { cmds.push({ unit: u.id, side, order: o }); command(sim, { unit: u.id, side, order: o }); } };
  const mine = sim.units.filter(u => u.side === side && active(u));
  if (side === 'att') {
    const sa = armyStrength(sim, 'att'), sd = armyStrength(sim, 'def');
    // 大势已去，或顿兵过久而仍无缺口：鸣金。兵力不及守军七成者也要先试攻一阵（四十五秒）再收兵，不会一照面就走
    if (!opts.eager && ((sim.resolve.att < 26 && sa < sd * 2.2) || (sim.t > 600 && !openings(sim).length && sim.resolve.att < 45) || (sim.t > 900 && !openings(sim).length) || (sim.t > 45 && sa < sd * 0.7 && sim.gate.hp > 0 && !openings(sim).length) || stalled(sim))) {
      for (const u of mine) set(u, { t: 'retreat' });
      if (!sim.flags.retreatEv) { sim.flags.retreatEv = 1; ev(sim, 'retreat', `${sim.att.commanderName}见势不可为，鸣金收兵。`, { side: 'att' }); }
      return cmds;
    }
    // 集中一处：默认攻城门（冲车撞门、火器压门段、炮轰门段），其余步营在射程外待命，门破或墙塌即一齐入城。
    // 某段城墙已明显比门段残破，则改攻那一段（架梯登城）。
    const op = openings(sim);
    const gateHp = sim.segs[GATE_SEG].hp;
    const weak = sim.segs.map((g, i) => ({ i, hp: g.hp })).filter(x => x.hp > 0 && x.i !== GATE_SEG).sort((a, b) => a.hp - b.hp)[0];
    const focus = op.length ? op[0] : weak && weak.hp <= Math.min(35, gateHp - 20) ? weak.i : GATE_SEG;
    const infs = mine.filter(u => u.kind === 'inf' && u.state !== 'inside' && u.state !== 'wall').sort((a, b) => b.troops - a.troops);
    // 攻击段城墙已残破：其余步营也架梯登城（城越完好，登城越吃亏）
    const pressing = sim.segs[focus].hp <= 20;
    for (const u of mine) {
      if (u.state === 'inside' || u.state === 'wall') continue;
      if (u.kind === 'art') set(u, { t: 'bombard', seg: focus });
      else if (u.kind === 'gun') set(u, { t: 'cover', seg: focus });
      else if (u.kind === 'cav') set(u, op.length ? { t: 'enter' } : { t: 'hold', x: u.x, y: 640 });
    }
    // 主攻之营一经派定就不换（否则兵数此消彼长，几营来回换班，谁也到不了城下）
    // 主攻两营同上（城头箭铳只能先顾一处，分摊了火力）；主攻之营一经派定就不换，士气已挫才换生力军
    const fresh = infs.filter(u => u.morale > 45).sort((a, b) => b.troops - a.troops);
    const assigned = (u: SUnit) => u.order.t === 'ram' || (u.order.t === 'assault' && u.order.seg === focus);
    const leads = infs.filter(u => assigned(u) && u.morale > 45 && u.troops > (fresh[0]?.troops ?? 0) * 0.35);
    // 生力军一齐上：门前、梯下人多，城头箭铳分摊开，伤亡反倒少
    for (const u of fresh) if (!leads.includes(u)) leads.push(u);
    if (infs.some(u => u.state === 'ram' || u.state === 'climb')) drum(sim, 'att');
    infs.forEach(u => {
      if (op.length) set(u, { t: 'enter' });
      else if (leads.includes(u)) set(u, focus === GATE_SEG && sim.gate.hp > 0 ? { t: 'ram' } : { t: 'assault', seg: focus });
      else if (pressing) set(u, { t: 'assault', seg: focus });
      else set(u, { t: 'hold', x: u.x, y: HOLD_Y });
    });
  } else {
    const att = sim.units.filter(u => u.side === 'att' && active(u));
    // 受威胁的城段：有人攀城、撞门、将要来攻，或正挨炮、城防已低
    const threat = Array.from({ length: SEGMENTS }, (_, s) => att.filter(a => (a.state === 'climb' || a.state === 'ram' || (a.order.t === 'assault' && a.order.seg === s)) && a.seg === s).reduce((n, a) => n + a.troops, 0)
      + att.filter(a => a.state === 'bombard' && a.seg === s).reduce((n, a) => n + a.troops * 0.5, 0) + (1 - sim.segs[s].hp / sim.segs[s].max) * 3000);
    const reserve = mine.filter(u => (u.order.t === 'reserve' || u.state === 'inside') && u.state !== 'move');
    const attIn = att.filter(a => a.state === 'inside' || a.state === 'wall');
    const worst = threat.indexOf(Math.max(...threat));
    // 各段缺口 = 来敌所需 − 现有守军；城段空虚而敌在近处，最急
    const guard = (s: number) => mine.filter(u => (u.order.t === 'man' || u.order.t === 'repair') && u.order.seg === s).reduce((n, u) => n + u.troops, 0);
    const near = (s: number) => att.filter(a => Math.abs(a.x - segX(s)) < 260 && a.y < 420 && a.state !== 'inside').reduce((n, a) => n + a.troops, 0);
    const need = Array.from({ length: SEGMENTS }, (_, s) => Math.max(800, threat[s] * 0.22 + near(s) * 0.12) - guard(s));
    const neediest = need.indexOf(Math.max(...need));
    if (attIn.length) { for (const r of reserve) set(r, { t: 'reserve' }); }
    else if (need[neediest] > 0) {
      if (reserve.length) set(reserve.sort((x, y) => y.troops - x.troops)[0], { t: 'man', seg: neediest });
      else {
        // 预备用尽：从最富余的一段分一营过去
        const surplus = Array.from({ length: SEGMENTS }, (_, s) => -need[s]);
        const rich = surplus.indexOf(Math.max(...surplus));
        const donor = mine.filter(u => u.state === 'wall' && u.seg === rich && u.order.t !== 'repair').sort((x, y) => y.troops - x.troops)[0];
        if (donor && rich !== neediest && surplus[rich] > 300 && (mine.filter(u => u.seg === rich && u.state === 'wall').length > 1 || near(rich) === 0)) set(donor, { t: 'man', seg: neediest });
      }
    }
    void worst;
    // 守方：敌已攀城、撞门或入城而军心见低，擂鼓激励
    if (sim.resolve.def < 55 && att.some(a => a.state === 'climb' || a.state === 'ram' || a.state === 'inside')) drum(sim, 'def');
    for (const u of mine) {
      if (u.order.t !== 'man' && u.order.t !== 'repair') continue;
      const s = u.order.seg, seg = sim.segs[s];
      const near = att.some(a => Math.abs(a.x - segX(s)) < 220 && a.y < 360);
      if (seg.hp < seg.max * 0.8 && seg.hp > 0 && !near) set(u, { t: 'repair', seg: s });
      else if (u.order.t === 'repair' && (near || seg.hp >= seg.max * 0.95)) set(u, { t: 'man', seg: s });
    }
  }
  return cmds;
}

/* ---------------- 无画面快进 ---------------- */
export function runSiege(b: BattleState, opts: { maxT?: number; dt?: number } = {}): SiegeSim {
  const sim = createSiege(b);
  // 与实时界面同一节奏：逐拍推进，每两秒双方各下一次令（opts.dt 只是旧接口，不影响结果）
  const maxT = opts.maxT ?? 3600;
  void opts.dt;
  let next = 0;
  while (!sim.over && sim.t < maxT) {
    if (sim.t >= next) { aiCommands(sim, 'att'); aiCommands(sim, 'def'); next = sim.t + 2; }
    stepSiege(sim, TICK);
  }
  // 安全阀（正常不会到）：攻方粮尽自退
  if (!sim.over) { for (const u of sim.units) if (u.side === 'att' && active(u)) u.state = 'gone'; end(sim, 'def', 'retreat', `${sim.att.name}粮尽，收兵回营，城未克。`); }
  return sim;
}

/** 结果折回旧的战局格式，供战役层写回伤亡、城防、得失 */
export function toBattleResult(b: BattleState, sim: SiegeSim): BattleState {
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
  const avg = sim.segs.reduce((n, s) => n + Math.max(0, s.hp), 0) / SEGMENTS;
  r.wall = Math.round(Math.max(0, Math.min(100, avg - (sim.gate.hp <= 0 ? 5 : 0))) * 10) / 10;
  r.over = true;
  r.winner = sim.over?.winner ?? 'def';
  r.outcome = sim.over?.outcome === 'collapse' ? 'surrender' : sim.over?.outcome ?? 'held';
  if (r.outcome === 'surrender') r.surrendered = true;
  r.round = Math.max(1, Math.round(sim.t / 30));
  // 各段城防、城门完好程度留给下一战（同一场围城）
  r.segs = sim.segs.map(s => Math.round(Math.max(0, s.hp) * 10) / 10);
  r.gate = Math.round(Math.max(0, sim.gate.hp) / sim.gate.max * 100) / 100;
  return r;
}
