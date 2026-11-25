/* 内政与钱粮。每座城自己收支，所有变动记入因果账。
 * 收入：赋税（人口 × 商业 × 吏治）、田粮（人口 × 农业 × 民心，秋收加成）、海贸。
 * 支出：驻军粮饷、以本城为粮台的军队粮饷、方针开销、起运上缴。 */
import type { City, GameState, LedgerEntry, Policy } from './types';
import { bump, report, nodeName, topOf, troopsText, charName, hostile, friendly } from './state';
import { neighbors, NODE } from '../data/geography';
import { lunarOf } from './calendar';
import { shortDate } from './calendar';

export const POLICY_NAME: Record<Policy, string> = {
  balanced: '均衡', agri: '劝农', commerce: '通商', fortify: '整军修城', relief: '赈济', edu: '兴学', levy: '加派',
};
export const POLICY_HINT: Record<Policy, string> = {
  balanced: '不偏不倚，按常例征收。',
  agri: '每月花些银两，农业缓慢上升，田粮随之增加。',
  commerce: '每月花些银两，商业缓慢上升，赋税随之增加。',
  fortify: '每月花较多银两，城防上升。',
  relief: '开仓放粮，民心上升，消耗仓粮。',
  edu: '每月花些银两，文教缓慢上升，长期影响人才。',
  levy: '赋税加征五成，民心与吏治每月下降。',
};

export const GRAIN_PER_SOLDIER = 0.25; // 石/月
export const SILVER_PER_SOLDIER = 0.6; // 两/月（驻军）
export const SILVER_PER_FIELD_SOLDIER = 0.9; // 两/月（出征）
/** 就地筹粮的比重：八旗有圈地与掳掠，流动作战的大顺、大西军就粮于地方；其余各家多赖粮台 */
export function forageShare(s: GameState, faction: string): number {
  const pol = s.factions[faction]?.polity;
  const top = topOf(s, faction);
  if (top === 'qing' || pol === 'qing') return 0.6;
  if (pol === 'shun' || pol === 'xi' || faction === 'shun' || faction === 'xi') return 0.75;
  return 0.2;
}
export const RECRUIT_SILVER = 3; // 两/人
export const REMIT_RATE = 0.3; // 直辖城起运上缴比例

function governorZheng(s: GameState, c: City): number {
  const g = c.governor ? s.chars[c.governor] : undefined;
  return g && g.status === 'active' && g.faction === c.controller ? g.ab.zheng : 40;
}

export function monthlyIncome(s: GameState, c: City): { silver: number; grain: number; trade: number } {
  const lm = lunarOf(s.turn);
  const harvest = lm.month >= 7 && lm.month <= 9 ? 1.7 : lm.month >= 5 && lm.month <= 6 ? 0.9 : 0.75;
  const gov = 1 + (governorZheng(s, c) - 50) / 250;
  const sieged = !!s.sieges[c.id];
  let silver = c.pop * (c.commerce / 100) * (0.5 + c.order / 100) * 160 * gov;
  if (c.policy === 'levy') silver *= 1.5;
  let grain = c.pop * (c.agri / 100) * (0.55 + c.minxin / 220) * 260 * harvest * gov;
  const trade = c.trade ? c.trade * 2600 * (c.commerce / 100) : 0;
  if (sieged) { silver *= 0.1; grain *= 0.15; }
  return { silver: Math.round(silver), grain: Math.round(grain), trade: Math.round(sieged ? 0 : trade) };
}

export function upkeepOf(s: GameState, c: City): { grain: number; silver: number } {
  let grain = c.garrison * GRAIN_PER_SOLDIER, silver = c.garrison * SILVER_PER_SOLDIER;
  for (const a of Object.values(s.armies)) if (a.supply === c.id) { const k = 1 - forageShare(s, a.faction); grain += a.troops * GRAIN_PER_SOLDIER * k; silver += a.troops * SILVER_PER_FIELD_SOLDIER * k; }
  if (s.sieges[c.id]) grain += c.garrison * GRAIN_PER_SOLDIER * 0.5;
  return { grain: Math.round(grain), silver: Math.round(silver) };
}

/* ---------------- 粮价、粜籴、劝捐 ----------------
 * 粮价按城浮动：地区（江南、湖广鱼米之乡粮贱，北方、边地粮贵）、季节（秋收贱，青黄不接贵）、
 * 战事（被围飞涨，敌军压境上扬）、本城存粮（仓满则贱，仓空则贵）。单位：两/石。 */
const AREA_PRICE: Record<string, number> = { 南直隶: 0.9, 浙江: 0.95, 湖广: 0.85, 江西: 0.9, 四川: 0.95, 福建: 1.1, 广东: 1.05, 广西: 1.1, 云贵: 1.2, 河南: 1.25, 北直隶: 1.3, 山东: 1.25, 山西: 1.35, 陕西: 1.4, 辽东: 1.4, 台湾: 1.1 };
export function grainPrice(s: GameState, c: City): number {
  const m = lunarOf(s.turn).month;
  const season = m >= 8 && m <= 10 ? 0.8 : m >= 11 || m === 1 ? 0.95 : m >= 2 && m <= 3 ? 1.15 : 1.3;   // 四至七月青黄不接
  const area = AREA_PRICE[NODE[c.id]?.area ?? ''] ?? 1.1;
  const need = upkeepOf(s, c).grain * 3 + c.pop * 120;
  const stock = Math.max(0.75, Math.min(1.45, 1.35 - 0.35 * (c.grain / Math.max(1, need))));
  let war = 1;
  if (s.sieges[c.id]) war = 2.2;
  else if (Object.values(s.armies).some(a => hostile(s, a.faction, c.controller) && (a.location === c.id || neighbors(c.id).some(n => n.to === a.location)))) war = 1.25;
  return Math.round(Math.max(0.4, Math.min(4, area * season * stock * war)) * 100) / 100;
}
/** 市面一月所容的粮食买卖量（石）：人口、商业、海贸 */
export function marketCap(s: GameState, c: City): number {
  void s;
  return Math.round((c.pop * 450 * (0.4 + c.commerce / 100) + (c.trade ?? 0) * 6000) / 100) * 100;
}
/** 粜籴报价：grain 为正是籴（买进），为负是粜（卖出）；量越大越不利（每用满一成市面，价差多 1.5%） */
export function tradeQuote(s: GameState, c: City, grain: number): { unit: number; silver: number; price: number } {
  const price = grainPrice(s, c);
  const cap = Math.max(1, marketCap(s, c));
  const used = c.tradeTurn === s.turn ? c.tradeN ?? 0 : 0;
  const share = (Math.abs(grain) + used) / cap;
  const unit = grain >= 0 ? price * (1.05 + 0.15 * share) : price * (0.85 - 0.15 * share);
  return { unit: Math.round(unit * 1000) / 1000, silver: Math.round(Math.abs(grain) * unit), price };
}
/** 劝捐助饷：向本城绅商劝捐一笔（人口、商业越大越多），民心、吏治受损，同城六月一次 */
export function loanAmount(s: GameState, c: City): number {
  void s;
  return Math.round(c.pop * 130 * (0.5 + c.commerce / 100) * (0.6 + c.minxin / 125) / 100) * 100;
}
export const LOAN_COOLDOWN = 6;

/** 一个月的内政与钱粮结算 */
export function runEconomy(s: GameState) {
  const cities = Object.values(s.cities).sort((a, b) => a.id.localeCompare(b.id));
  // 1. 收入与方针
  for (const c of cities) {
    const inc = monthlyIncome(s, c);
    bump(s, c.id, 'silver', inc.silver, s.sieges[c.id] ? '被围，赋税几近断绝' : c.policy === 'levy' ? '赋税（加派五成）' : '赋税', { kind: 'income' });
    bump(s, c.id, 'grain', inc.grain, s.sieges[c.id] ? '被围，田粮难入城' : '田粮', { kind: 'income' });
    if (inc.trade) bump(s, c.id, 'silver', inc.trade, '海贸', { kind: 'income' });
    applyPolicy(s, c);
  }
  // 2. 驻军与军队粮饷
  for (const c of cities) {
    bump(s, c.id, 'grain', -Math.round(c.garrison * GRAIN_PER_SOLDIER), `驻军 ${troopsText(c.garrison)} 人口粮`, { kind: 'upkeep', ref: 'garrison' });
    bump(s, c.id, 'silver', -Math.round(c.garrison * SILVER_PER_SOLDIER), `驻军 ${troopsText(c.garrison)} 人月饷`, { kind: 'upkeep', ref: 'garrison' });
    if (s.sieges[c.id]) bump(s, c.id, 'grain', -Math.round(c.garrison * GRAIN_PER_SOLDIER * 0.5), '守城加给', { kind: 'siege', ref: c.id });
  }
  for (const a of Object.values(s.armies).sort((x, y) => x.id.localeCompare(y.id))) {
    const mine = (id: string) => { const c = s.cities[id]; return !!c && (c.controller === a.faction || topOf(s, c.controller) === topOf(s, a.faction)); };
    // 就地筹粮：一部分口粮饷银取于所过地方，所在城民心随之下降
    const fs = forageShare(s, a.faction);
    const where = s.cities[a.location];
    if (fs > 0 && where) bump(s, where.id, 'minxin', -Math.min(3, Math.round(a.troops * fs / 15000 * 10) / 10), `${a.name}就粮于地方`, { kind: 'upkeep', ref: a.id });
    const needG = Math.round(a.troops * GRAIN_PER_SOLDIER * (1 - fs)), needS = Math.round(a.troops * SILVER_PER_FIELD_SOLDIER * (1 - fs));
    let got = 0;
    const sup = s.cities[a.supply];
    const cut = sup && a.location !== a.supply ? supplyBlock(s, a.faction, a.supply, a.location) : null;
    if (sup && mine(a.supply) && !cut) {
      got = Math.min(sup.grain, needG);
      bump(s, sup.id, 'grain', -got, `${a.name} ${troopsText(a.troops)} 人支粮${got < needG ? '（不足）' : ''}`, { kind: 'upkeep', ref: a.id });
      bump(s, sup.id, 'silver', -Math.min(sup.silver, needS), `${a.name}关饷`, { kind: 'upkeep', ref: a.id });
      if (sup.silver <= 0) a.morale = Math.max(0, a.morale - 1);
    }
    // 粮台不足：就地征粮（所在城为己方或同阵营时），扰民
    const here = s.cities[a.location];
    if (got < needG && here && here.id !== a.supply && mine(here.id) && here.grain > 0) {
      const take = Math.min(here.grain, needG - got);
      got += take;
      bump(s, here.id, 'grain', -take, `${a.name}就地征粮`, { kind: 'upkeep', ref: a.id });
      bump(s, here.id, 'minxin', -2, `${a.name}就地征粮`, { kind: 'upkeep', ref: a.id });
    }
    if (got < needG * 0.6) {
      a.hunger++;
      a.morale = Math.max(0, a.morale - 10);
      const lost = Math.round(a.troops * 0.05);
      a.troops -= lost;
      if (a.faction === s.player || topOf(s, a.faction) === s.player) report(s, { cat: '急报', urgent: a.faction === s.player, node: a.location,
        text: `${a.name}断粮${cut ? `：${cut}` : sup && mine(a.supply) ? `：粮台${nodeName(a.supply)}仓粮不足` : '：粮台已失'}，军心浮动，逃散 ${lost} 人。`, src: { kind: 'upkeep', ref: a.id } });
      continue;
    }
    a.hunger = 0;
    const cap = 60 + Math.round((s.chars[a.commander]?.ab.wang ?? 40) / 5);
    if (a.morale < cap) a.morale = Math.min(cap, a.morale + 6);
  }
  // 2b. 市籴：仓粮不足两月用度而府库有余银的城，按每石一两二钱买粮
  for (const c of cities) {
    const up = upkeepOf(s, c);
    if (s.sieges[c.id] || up.grain <= 0 || c.grain >= up.grain * 2) continue;
    const want = Math.round(up.grain * 2 - c.grain);
    const afford = Math.floor(Math.max(0, c.silver - up.silver * 2) / (grainPrice(s, c) * 1.1));
    const buy = Math.min(want, afford, Math.round(c.pop * 600 + (c.trade ?? 0) * 4000));
    if (buy >= 500) {
      const unit = grainPrice(s, c) * 1.1;
      if (unit * buy > c.silver) continue;
      bump(s, c.id, 'silver', -Math.round(buy * unit), `市籴粮 ${buy} 石（每石 ${unit.toFixed(2)} 两）`, { kind: 'upkeep', ref: 'market' });
      bump(s, c.id, 'grain', buy, '市籴', { kind: 'upkeep', ref: 'market' });
    }
  }
  // 2c. 市粜（电脑一方）：银不够发饷而仓粮宽裕，卖出余粮换银
  for (const c of cities) {
    if (s.sieges[c.id] || topOf(s, c.controller) === topOf(s, s.player)) continue;
    const up = upkeepOf(s, c);
    if (c.silver >= up.silver * 2 || c.grain <= up.grain * 5) continue;
    const sell = Math.min(Math.round((c.grain - up.grain * 5) / 100) * 100, marketCap(s, c));
    if (sell < 500) continue;
    const unit = grainPrice(s, c) * 0.85;
    bump(s, c.id, 'grain', -sell, `市粜余粮 ${sell} 石（每石 ${unit.toFixed(2)} 两）`, { kind: 'upkeep', ref: 'market' });
    bump(s, c.id, 'silver', Math.round(sell * unit), '市粜', { kind: 'upkeep', ref: 'market' });
  }
  // 3. 起运上缴
  for (const c of cities) {
    const f = s.factions[c.controller];
    if (!f) continue;
    const cap = s.cities[f.capital];
    const income = s.ledger.filter(e => e.turn === s.turn && e.node === c.id && e.field === 'silver' && e.src.kind === 'income').reduce((n, e) => n + e.delta, 0);
    if (c.id !== f.capital && cap && cap.controller === f.id && income > 0 && !supplyBlock(s, f.id, c.id, f.capital)) {
      const amt = Math.min(c.silver, Math.round(income * REMIT_RATE));
      if (amt > 0) {
        bump(s, c.id, 'silver', -amt, `起运${nodeName(f.capital)}`, { kind: 'remit' });
        bump(s, f.capital, 'silver', amt, `${nodeName(c.id)}起运`, { kind: 'remit' });
      }
    }
    // 各省明官府解饷南京
    if (f.overlord && f.id === 'mingprov' && income > 0) {
      const lord = s.factions[f.overlord];
      const lcap = lord && s.cities[lord.capital];
      if (lcap && lcap.controller === lord.id && !supplyBlock(s, f.id, c.id, lord.capital)) {
        const amt = Math.min(c.silver, Math.round(income * 0.08));
        if (amt > 0) {
          bump(s, c.id, 'silver', -amt, `解饷${nodeName(lord.capital)}`, { kind: 'remit' });
          bump(s, lord.capital, 'silver', amt, `${nodeName(c.id)}解饷`, { kind: 'remit' });
        }
      }
    }
  }
  // 4. 民心、人口、缺粮、城防自修
  for (const c of cities) {
    if (!s.sieges[c.id] && c.wall < 60) bump(s, c.id, 'wall', 1, '民夫修城', { kind: 'income' });
    if (s.sieges[c.id]) bump(s, c.id, 'minxin', -3, '城被围困', { kind: 'siege', ref: c.id });
    else if (c.minxin < 55 && c.policy !== 'levy') bump(s, c.id, 'minxin', 0.5, '休养', { kind: 'income' });
    if (c.grain <= 0 && c.garrison > 0) {
      const lost = Math.round(c.garrison * 0.1);
      bump(s, c.id, 'garrison', -lost, '断粮，士卒逃散', { kind: 'upkeep', ref: 'garrison' });
      bump(s, c.id, 'minxin', -6, '城中断粮', { kind: 'upkeep', ref: 'garrison' });
    }
    if (c.minxin >= 50 && !s.sieges[c.id]) bump(s, c.id, 'pop', Math.round(c.pop * 0.001 * 100) / 100, '生息', { kind: 'income' });
    checkShortage(s, c);
  }
}

function applyPolicy(s: GameState, c: City) {
  const src = { kind: 'policy' as const, ref: c.policy };
  const p = c.pop;
  switch (c.policy) {
    case 'agri': if (c.silver > p * 20) { bump(s, c.id, 'silver', -Math.round(p * 20), '劝农开销', src); bump(s, c.id, 'agri', 1, '劝农', src); } break;
    case 'commerce': if (c.silver > p * 15) { bump(s, c.id, 'silver', -Math.round(p * 15), '通商开销', src); bump(s, c.id, 'commerce', 1, '通商', src); } break;
    case 'fortify': if (c.silver > p * 40 + 2000) { bump(s, c.id, 'silver', -Math.round(p * 40 + 2000), '修城开销', src); bump(s, c.id, 'wall', 3, '整军修城', src); } break;
    case 'relief': if (c.grain > p * 150) { bump(s, c.id, 'grain', -Math.round(p * 150), '开仓赈济', src); bump(s, c.id, 'minxin', 3, '赈济', src); } break;
    case 'edu': if (c.silver > p * 25) { bump(s, c.id, 'silver', -Math.round(p * 25), '兴学开销', src); bump(s, c.id, 'edu', 0.6, '兴学', src); } break;
    case 'levy': bump(s, c.id, 'minxin', -3, '加派', src); bump(s, c.id, 'order', -1, '加派', src); break;
    default: break;
  }
}

/** 本城本月净变化 */
export function netChange(s: GameState, node: string, field: LedgerEntry['field'], turn = s.turn): number {
  return s.ledger.filter(e => e.turn === turn && e.node === node && e.field === field).reduce((n, e) => n + e.delta, 0);
}

/** 粮食告急：仓粮不足两个月用度，且本月净减少 → 发报告，并找出最大的人为原因 */
function checkShortage(s: GameState, c: City) {
  const up = upkeepOf(s, c);
  if (up.grain <= 0) return;
  const net = netChange(s, c.id, 'grain');
  if (c.grain >= up.grain * 2 || net >= 0) return;
  const cause = shortageCause(s, c.id);
  const months = up.grain > 0 ? Math.max(0, c.grain / up.grain) : 99;
  const visible = c.controller === s.player || (topOf(s, c.controller) === s.player && months < 1);
  if (!visible) return;
  report(s, {
    cat: '急报', urgent: months < 1, node: c.id,
    text: `${nodeName(c.id)}缺粮：仓粮 ${Math.round(c.grain)} 石，仅够 ${months < 1 ? '不足一' : Math.floor(months)} 个月用度。${cause.text}`,
    src: cause.src,
  });
}

/** 追溯缺粮的人为原因：近六个月内影响本城粮食的命令（募兵、调出、军队改由本城支粮），否则取本月最大支出项 */
export function shortageCause(s: GameState, node: string): { text: string; src: LedgerEntry['src'] } {
  const recent = s.ledger.filter(e => e.node === node && e.turn >= s.turn - 6 && e.src.kind === 'order' && (e.field === 'grain' || e.field === 'garrison'));
  // 募兵：驻军增加 → 口粮增加
  const recruit = recent.filter(e => e.field === 'garrison' && e.delta > 0).sort((a, b) => b.delta - a.delta)[0];
  const outflow = recent.filter(e => e.field === 'grain' && e.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  const monthly = s.ledger.filter(e => e.node === node && e.turn === s.turn && e.field === 'grain' && e.delta < 0).sort((a, b) => a.delta - b.delta)[0];
  if (outflow && (!recruit || -outflow.delta > recruit.delta * GRAIN_PER_SOLDIER * 3)) {
    return { text: `主要原因：${shortDate(outflow.turn)}${outflow.text}（${-outflow.delta} 石）。`, src: outflow.src };
  }
  if (recruit) {
    return { text: `主要原因：${shortDate(recruit.turn)}${recruit.text}，每月多耗口粮 ${Math.round(recruit.delta * GRAIN_PER_SOLDIER)} 石。`, src: recruit.src };
  }
  if (monthly) return { text: `本月最大支出：${monthly.text}（${-monthly.delta} 石）。`, src: monthly.src };
  return { text: '', src: { kind: 'upkeep' } };
}

/** 城市“为什么”：本月某项的全部来源 */
export function explain(s: GameState, node: string, field: LedgerEntry['field'], turn: number): LedgerEntry[] {
  return s.ledger.filter(e => e.node === node && e.field === field && e.turn === turn);
}

export function governorText(s: GameState, c: City): string { return charName(s, c.governor); }

/** 粮道：手动调拨、粮台支给、起运解饷共用。被围之城运不进也运不出，敌城阻隔。返回不通的原因，通则 null。 */
export function supplyBlock(s: GameState, f: string, from: string, to: string): string | null {
  // 被围的是守方：运不进、运不出。围城一方的营寨在城外，只要后路未断，照常受粮
  if (s.sieges[to] && !friendly(s, f, s.sieges[to].attacker)) return `${nodeName(to)}被围，粮道不通`;
  if (s.sieges[from] && !friendly(s, f, s.sieges[from].attacker)) return `${nodeName(from)}被围，运不出城`;
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    const u = queue.shift()!;
    for (const { to: v } of neighbors(u)) {
      if (seen.has(v)) continue;
      if (v === to) return null;
      seen.add(v);
      const c = s.cities[v];
      if (!c || s.sieges[v] || hostile(s, f, c.controller)) continue;
      queue.push(v);
    }
  }
  return `去${nodeName(to)}的路被敌方隔断`;
}

/** 势力仓廪：所辖各城府库、仓粮之和（左上角显示用） */
export function storeOf(s: GameState, f: string): { silver: number; grain: number; cities: number } {
  let silver = 0, grain = 0, cities = 0;
  for (const c of Object.values(s.cities)) if (c.controller === f) { silver += c.silver; grain += c.grain; cities++; }
  return { silver, grain, cities };
}
