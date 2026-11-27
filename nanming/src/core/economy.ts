/* 内政与钱粮。每座城自己收支，所有变动记入因果账。
 * 收入：赋税（人口 × 商业 × 吏治）、田粮（人口 × 农业 × 民心，秋收加成）、海贸。
 * 支出：驻军粮饷、以本城为粮台的军队粮饷、方针开销、起运上缴。 */
import type { City, GameState, LedgerEntry, Policy } from './types';
import { bump, report, nodeName, topOf, troopsText, charName, hostile, friendly } from './state';
import { neighbors, NODE } from '../data/geography';
import { lunarOf } from './calendar';
import { shortDate } from './calendar';
import { govEffects } from './people';

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

/* 兵的月费按明季“本色（米）+ 折色（银）”：口粮连马料、家口每人每月四斗，饷银驻军四钱五分、出征七钱。
 * 合银约八钱（驻军）至一两一钱（出征），与旧值相当；只是粮、银的比例与收入（田粮、赋税约各半）相称，
 * 免得粮食年年堆积而银两入不敷出。 */
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
/** 赈济：每万口每月放粮一百石（大城约当一月田粮的六七成），民心 +3 */
export const reliefGrain = (pop: number) => Math.round(pop * 100);
/** 仓储损耗：超出本城六个月用度的存粮，每月霉变鼠耗百分之一（陈粮不耐久存） */
export const SPOIL_RATE = 0.01;
export const spoilage = (s: GameState, c: City) => Math.round(Math.max(0, c.grain - upkeepOf(s, c).grain * 6 - c.pop * 300) * SPOIL_RATE);
export const REMIT_RATE = 0.3; // 直辖城起运上缴比例
/** 起运：本月赋税海贸的三成解往治所（出征各军多由治所支饷，钱要集中到治所才用得上） */
export const remitAmount = (_c: { garrison: number }, income: number) => Math.round(income * REMIT_RATE);


/** 田粮的季节系数：秋收（七至九月）1.7，五六月 0.9，其余 0.75；全年平均约为 1 */
export function harvestFactor(turn: number): number {
  const lm = lunarOf(turn);
  return lm.month >= 7 && lm.month <= 9 ? 1.7 : lm.month >= 5 && lm.month <= 6 ? 0.9 : 0.75;
}
export function monthlyIncome(s: GameState, c: City): { silver: number; grain: number; trade: number } {
  const harvest = harvestFactor(s.turn);
  const ge = govEffects(s, c);
  const sieged = !!s.sieges[c.id];
  let silver = c.pop * (c.commerce / 100) * (0.5 + c.order / 100) * 160 * ge.silverMul;
  // 民心四成以下，赋税渐收不上来（至零时只得五成）；加派之利随民心而尽，民心三成以下越加越少
  silver *= c.minxin >= 40 ? 1 : 0.5 + c.minxin / 80;
  if (c.policy === 'levy') silver *= 1 + 0.5 * Math.min(1, c.minxin / 30);
  let grain = c.pop * (c.agri / 100) * (0.55 + c.minxin / 220) * 260 * harvest * ge.grainMul;
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

/* ---------------- 每月钱粮预估 ----------------
 * 按月结的同一套算法逐项估本城本月的收支：收入（赋税、田粮、海贸、各城起运）、支出（驻军、守城加给、
 * 以本城为粮台的各军、补发旧欠、方针开销、起运治所）。视情况才发生的自动市籴、市粜不计。 */
export interface ForecastItem { label: string; v: number; kind: 'income' | 'garrison' | 'army' | 'policy' | 'remit' | 'siege' }
export interface CityForecast { grain: { items: ForecastItem[]; net: number }; silver: { items: ForecastItem[]; net: number } }
const POLICY_COST: Partial<Record<Policy, (p: number) => { silver?: number; grain?: number }>> = {
  agri: p => ({ silver: Math.round(p * 20) }), commerce: p => ({ silver: Math.round(p * 15) }), fortify: p => ({ silver: Math.round(p * 40 + 2000) }),
  relief: p => ({ grain: reliefGrain(p) }), edu: p => ({ silver: Math.round(p * 25) }),
};
/** 本城本月起运或解饷出去多少银（按本月赋税海贸收入） */
function remitOut(s: GameState, c: City, silverIncome: number): { to: string; amt: number; label: string } | null {
  const f = s.factions[c.controller];
  if (!f || silverIncome <= 0) return null;
  const cap = s.cities[f.capital];
  const amt = remitAmount(c, silverIncome);
  if (amt > 0 && c.id !== f.capital && cap && cap.controller === f.id && !supplyBlock(s, f.id, c.id, f.capital)) return { to: f.capital, amt, label: `起运${nodeName(f.capital)}（收入三成）` };
  return null;
}
function provRemit(s: GameState, c: City, silverIncome: number): { to: string; amt: number; label: string } | null {
  const f = s.factions[c.controller];
  if (!f || !f.overlord || f.id !== 'mingprov' || silverIncome <= 0) return null;
  const lord = s.factions[f.overlord]; const lcap = lord && s.cities[lord.capital];
  if (lcap && lcap.controller === lord.id && !supplyBlock(s, f.id, c.id, lord.capital)) return { to: lord.capital, amt: Math.round(silverIncome * 0.08), label: `解饷${nodeName(lord.capital)}（收入八分）` };
  return null;
}
export function cityForecast(s: GameState, c: City): CityForecast {
  const G: ForecastItem[] = [], S: ForecastItem[] = [];
  const inc = monthlyIncome(s, c);
  const sieged = !!s.sieges[c.id];
  if (inc.silver) S.push({ label: sieged ? '赋税（被围，几近断绝）' : c.policy === 'levy' ? '赋税（加派五成）' : '赋税', v: inc.silver, kind: 'income' });
  if (inc.grain) G.push({ label: sieged ? '田粮（被围，难入城）' : '田粮', v: inc.grain, kind: 'income' });
  if (inc.trade) S.push({ label: '海贸', v: inc.trade, kind: 'income' });
  const pc = POLICY_COST[c.policy]?.(c.pop);
  if (pc?.silver) S.push({ label: `方针“${POLICY_NAME[c.policy]}”开销`, v: -pc.silver, kind: 'policy' });
  if (pc?.grain) G.push({ label: `方针“${POLICY_NAME[c.policy]}”放粮`, v: -pc.grain, kind: 'policy' });
  if (c.garrison) {
    G.push({ label: `驻军 ${troopsText(c.garrison)} 人口粮`, v: -Math.round(c.garrison * GRAIN_PER_SOLDIER), kind: 'garrison' });
    S.push({ label: `驻军 ${troopsText(c.garrison)} 人月饷`, v: -Math.round(c.garrison * SILVER_PER_SOLDIER), kind: 'garrison' });
    if (sieged) G.push({ label: '守城加给', v: -Math.round(c.garrison * GRAIN_PER_SOLDIER * 0.5), kind: 'siege' });
  }
  for (const a of Object.values(s.armies).sort((x, y) => x.id.localeCompare(y.id))) {
    if (a.supply !== c.id) continue;
    const mine = c.controller === a.faction || topOf(s, c.controller) === topOf(s, a.faction);
    if (!mine || (a.location !== c.id && supplyBlock(s, a.faction, c.id, a.location))) continue;
    const fs = forageShare(s, a.faction);
    const g = Math.round(a.troops * GRAIN_PER_SOLDIER * (1 - fs)), sv = Math.round(a.troops * SILVER_PER_FIELD_SOLDIER * (1 - fs));
    const note = fs >= 0.5 ? `（${Math.round(fs * 100)}% 就粮于地方）` : '';
    if (g) G.push({ label: `${a.name} ${troopsText(a.troops)} 人支粮${note}`, v: -g, kind: 'army' });
    if (sv) S.push({ label: `${a.name}关饷${note}`, v: -sv, kind: 'army' });
    if (a.arrears) S.push({ label: `补发${a.name}旧欠（府库一半为限）`, v: -Math.min(a.arrears, Math.floor(Math.max(0, c.silver) * 0.5)), kind: 'army' });
  }
  const silverIncome = inc.silver + inc.trade;
  // 起运本势力治所、各省官府另解饷宗主治所，两笔都要列
  for (const out of [remitOut(s, c, silverIncome), provRemit(s, c, silverIncome)]) if (out) S.push({ label: out.label, v: -out.amt, kind: 'remit' });
  // 治所：各城起运、各省解饷进来
  let inRemit = 0;
  for (const o of Object.values(s.cities)) {
    if (o.id === c.id) continue;
    const oi = monthlyIncome(s, o); const si = oi.silver + oi.trade;
    const r = remitOut(s, o, si); if (r && r.to === c.id) inRemit += r.amt;
    const pr = provRemit(s, o, si); if (pr && pr.to === c.id) inRemit += pr.amt;
  }
  if (inRemit) S.push({ label: '各城起运、解饷', v: inRemit, kind: 'remit' });
  // 霉变按本月收支之后的存粮算
  const sp = spoilage(s, { ...c, grain: Math.max(0, c.grain + G.reduce((n, i) => n + i.v, 0)) });
  if (sp) G.push({ label: '陈粮霉变鼠耗（超出六月用度之存粮百分之一）', v: -sp, kind: 'policy' });
  const sum = (l: ForecastItem[]) => l.reduce((n, i) => n + i.v, 0);
  return { grain: { items: G, net: sum(G) }, silver: { items: S, net: sum(S) } };
}
/** 一年展望：按当前城权、驻军、方针不变，逐月滚动（田粮随季节变），看一年内粮、银最低到多少、哪个月起见底，
 *  以及再养多少驻军能保一年内粮银都不断（feed）。围城、战事、命令之外的变故都不计。 */
/** feed：动用现存粮银、一年之内不断还能多养几人；sustain：按全年平均结余可长期多养几人（不动存量） */
export interface Outlook { months: number; minGrain: number; minSilver: number; shortGrain: number | null; shortSilver: number | null; feed: number; sustain: number; netGrain: number; netSilver: number }
export function yearOutlook(s: GameState, c: City, months = 12): Outlook {
  let grain = c.grain, silver = c.silver;
  let minGrain = grain, minSilver = silver, shortGrain: number | null = null, shortSilver: number | null = null;
  let feedG = Infinity, feedS = Infinity, cumG = 0, cumS = 0;
  // 以本城为粮台的各军旧欠：补发了就销账，不在以后各月重复扣
  let armies = s.armies;
  for (let k = 1; k <= months; k++) {
    const t: GameState = { ...s, turn: s.turn + k - 1, armies, cities: { ...s.cities, [c.id]: { ...c, grain, silver } } };
    const f = cityForecast(t, t.cities[c.id]);
    const owing = Object.values(armies).filter(a => a.supply === c.id && a.arrears);
    if (owing.length) {
      armies = { ...armies };
      for (const a of owing) armies[a.id] = { ...a, arrears: Math.max(0, a.arrears! - Math.min(a.arrears!, Math.floor(Math.max(0, silver) * 0.5))) };
    }
    cumG += f.grain.net; cumS += f.silver.net;
    grain = Math.max(0, grain + f.grain.net); silver = Math.max(0, silver + f.silver.net);
    minGrain = Math.min(minGrain, grain); minSilver = Math.min(minSilver, silver);
    if (shortGrain === null && c.grain + cumG < 0) shortGrain = k;
    if (shortSilver === null && c.silver + cumS < 0) shortSilver = k;
    // 多养 n 人，第 k 月累计多耗 n×每人月费×k，存量不得为负
    feedG = Math.min(feedG, (c.grain + cumG) / (GRAIN_PER_SOLDIER * k));
    feedS = Math.min(feedS, (c.silver + cumS) / (SILVER_PER_SOLDIER * k));
  }
  const feed = Math.max(0, Math.floor(Math.min(feedG, feedS) / 100) * 100);
  const sustain = Math.max(0, Math.floor(Math.min(cumG / months / GRAIN_PER_SOLDIER, cumS / months / SILVER_PER_SOLDIER) / 100) * 100);
  return { months, minGrain, minSilver, shortGrain, shortSilver, feed, sustain, netGrain: Math.round(cumG / months), netSilver: Math.round(cumS / months) };
}
/** 本城能长期多养多少驻军：按全年平均结余，粮、银取其紧者（不动存量，按百人取整） */
export function feedable(s: GameState, c: City): number {
  return yearOutlook(s, c).sustain;
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

/* ---------- 欠饷 ----------
 * 本月饷银发不足一成以上，记入积欠、连续欠饷月数加一。欠一两月只压低士气上限（每月 −3）；
 * 连欠满四月起就所驻本方城池索饷（民心 −3、吏治 −1）；索不到而本方本可发饷（有可设为粮台的城存银够三个月，却不改粮台、不调银），每月逃散 1%，逐月加重，至多 4%，按所欠比例折算。粮台有余银即补发旧欠，补清则军心回升。 */
export const arrearsPenalty = (a: { unpaid?: number }) => Math.min(24, (a.unpaid ?? 0) * 3);
export function payArrears(s: GameState, a: import('./types').Army, owed: number, from?: string) {
  const need = Math.round(a.troops * SILVER_PER_FIELD_SOLDIER * (1 - forageShare(s, a.faction)));
  const ours = a.faction === s.player || topOf(s, a.faction) === s.player;
  if (owed > need * 0.1) {
    a.unpaid = (a.unpaid ?? 0) + 1;
    let left = owed;
    if (a.unpaid >= 4) {
      // 久欠之兵就所驻本方城池索饷：取城中银两，民心、吏治受损
      const here = s.cities[a.location];
      if (here && (here.controller === a.faction || topOf(s, here.controller) === topOf(s, a.faction)) && here.silver > 0) {
        const take = Math.round(Math.min(here.silver, owed));
        left -= take;
        bump(s, here.id, 'silver', -take, `${a.name}久欠饷，纵兵索饷`, { kind: 'upkeep', ref: a.id });
        bump(s, here.id, 'minxin', -3, `${a.name}纵兵索饷`, { kind: 'upkeep', ref: a.id });
        bump(s, here.id, 'order', -1, `${a.name}纵兵索饷`, { kind: 'upkeep', ref: a.id });
        if (ours && a.unpaid === 4) report(s, { cat: '急报', urgent: a.faction === s.player, node: here.id, text: `${a.name}连欠饷 ${a.unpaid} 月，就${nodeName(here.id)}索饷 ${take} 两，地方骚然（民心 −3、吏治 −1）。`, src: { kind: 'upkeep', ref: a.id } });
      }
      // 索不到的部分：本方府库有银而不发（挪饷）则士卒逃散，欠得越久越多，按所欠比例折算；
      // 举镇皆穷者只压士气、扰地方，不另逃散
      a.arrears = Math.round((a.arrears ?? 0) + left);
      const neglect = payableSilver(s, a) >= need * 3;
      const lost = !neglect ? 0 : Math.round(a.troops * Math.min(0.04, 0.01 * (a.unpaid - 3)) * Math.min(1, left / Math.max(1, need)));
      if (lost > 0) {
        a.troops -= lost;
        a.morale = Math.max(0, a.morale - 2);
        if (ours) report(s, { cat: '急报', urgent: a.faction === s.player, node: a.location, text: `${a.name}连欠饷 ${a.unpaid} 月、积欠 ${troopsText(a.arrears)} 两，士卒怨望，逃散 ${lost} 人。`, src: { kind: 'upkeep', ref: a.id } });
      }
    } else a.arrears = Math.round((a.arrears ?? 0) + left);
    return;
  }
  if (!a.arrears || !from) return;
  const sup = s.cities[from];
  const back = Math.min(a.arrears, Math.floor(Math.max(0, sup.silver) * 0.5));
  if (back <= 0) return;
  bump(s, from, 'silver', -back, `补发${a.name}旧欠饷银`, { kind: 'upkeep', ref: a.id });
  a.arrears -= back;
  if (a.arrears <= 0) {
    const months = a.unpaid ?? 0;
    a.arrears = 0; a.unpaid = 0;
    const lift = Math.min(10, 3 + months);
    a.morale = Math.min(100, a.morale + lift);
    if (ours) report(s, { cat: '内政', node: a.location, text: `${a.name}旧欠饷银补发清楚（${back} 两），军心回升（士气 +${lift}）。`, src: { kind: 'upkeep', ref: a.id } });
  }
}

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
    let got = 0, paid = 0;
    const sup = s.cities[a.supply];
    const cut = sup && a.location !== a.supply ? supplyBlock(s, a.faction, a.supply, a.location) : null;
    if (sup && mine(a.supply) && !cut) {
      got = Math.min(sup.grain, needG);
      bump(s, sup.id, 'grain', -got, `${a.name} ${troopsText(a.troops)} 人支粮${got < needG ? '（不足）' : ''}`, { kind: 'upkeep', ref: a.id });
      paid = Math.max(0, Math.min(sup.silver, needS));
      if (paid) bump(s, sup.id, 'silver', -paid, `${a.name}关饷${paid < needS ? '（不足）' : ''}`, { kind: 'upkeep', ref: a.id });
    }
    payArrears(s, a, needS - paid, sup && mine(a.supply) && !cut ? sup.id : undefined);
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
    const cap = 60 + Math.round((s.chars[a.commander]?.ab.wang ?? 40) / 5) - arrearsPenalty(a);
    if (a.morale < cap) a.morale = Math.min(cap, a.morale + 6);
    else if (a.morale > cap) a.morale = Math.max(cap, a.morale - 4);
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
  // 2c. 市粜：银不够两月饷而仓粮有余，卖出多余的粮换银（与 2b 市籴对称）。
  // 玩家的城：只在田粮常年自给有余时卖，留足六个月口粮（缺粮之城卖了只会日后挨饿）；
  // 电脑一方沿旧例留五个月；玩家的下属沿旧例不自动粜。
  for (const c of cities) {
    if (s.sieges[c.id]) continue;
    const mine = c.controller === s.player;
    if (!mine && topOf(s, c.controller) === topOf(s, s.player)) continue;
    const up = upkeepOf(s, c);
    const yearly = monthlyIncome(s, c).grain / harvestFactor(s.turn);   // 全年平均每月田粮
    if (mine && yearly < up.grain) continue;
    const keep = up.grain * (mine ? 6 : 5);
    if (c.silver >= up.silver * 2 || c.grain <= keep) continue;
    const sell = Math.min(Math.round((c.grain - keep) / 100) * 100, marketCap(s, c));
    if (sell < 500) continue;
    const unit = grainPrice(s, c) * 0.85;
    bump(s, c.id, 'grain', -sell, `市粜余粮 ${sell} 石（每石 ${unit.toFixed(2)} 两）`, { kind: 'upkeep', ref: 'market' });
    bump(s, c.id, 'silver', Math.round(sell * unit), '市粜', { kind: 'upkeep', ref: 'market' });
  }
  // 2d. 仓储损耗：陈粮霉变
  for (const c of cities) { const k = spoilage(s, c); if (k > 0) bump(s, c.id, 'grain', -k, '陈粮霉变鼠耗', { kind: 'upkeep', ref: 'spoil' }); }
  // 3. 起运上缴
  for (const c of cities) {
    const f = s.factions[c.controller];
    if (!f) continue;
    const cap = s.cities[f.capital];
    const income = s.ledger.filter(e => e.turn === s.turn && e.node === c.id && e.field === 'silver' && e.src.kind === 'income').reduce((n, e) => n + e.delta, 0);
    if (c.id !== f.capital && cap && cap.controller === f.id && income > 0 && !supplyBlock(s, f.id, c.id, f.capital)) {
      const amt = Math.min(c.silver, remitAmount(c, income));
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
    case 'relief': if (c.grain > reliefGrain(p)) { bump(s, c.id, 'grain', -reliefGrain(p), '开仓赈济', src); bump(s, c.id, 'minxin', 3, '赈济', src); } break;
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
    text: `${nodeName(c.id)}缺粮：仓粮 ${Math.round(c.grain)} 石，${months < 1 ? '不足一月之用' : `仅够 ${Math.floor(months)} 个月之用`}。${cause.text}`,
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

/** 粮台可否改设于某城：己方或同阵营之城、未被敌围、粮道可通到军队所在。玩家与电脑同一条件 */
export function supplyChoiceError(s: GameState, a: { faction: string; location: string }, node: string): string | null {
  const c = s.cities[node];
  if (!c) return '不是城池';
  if (c.controller !== a.faction && topOf(s, c.controller) !== topOf(s, a.faction)) return '只能以己方或同阵营友方之城为粮台';
  const sg = s.sieges[node];
  if (sg && !friendly(s, a.faction, sg.attacker)) return `${nodeName(node)}被围，支不出粮`;
  return node === a.location ? null : supplyBlock(s, a.faction, node, a.location);
}

/** 本可用来发这支军队饷的银：本方各城中可设为它粮台的城（未被围、粮道通到军中）的存银之和。
 *  被围、路断之城的银救不了急，不算“有银不发”；有这样的城而不改粮台、不调银，才算挪饷 */
export function payableSilver(s: GameState, a: { faction: string; location: string }): number {
  let n = 0;
  for (const c of Object.values(s.cities)) if (c.controller === a.faction && !supplyChoiceError(s, a, c.id)) n += c.silver;
  return n;
}

/** 势力仓廪：所辖各城府库、仓粮之和（左上角显示用） */
export function storeOf(s: GameState, f: string): { silver: number; grain: number; cities: number } {
  let silver = 0, grain = 0, cities = 0;
  for (const c of Object.values(s.cities)) if (c.controller === f) { silver += c.silver; grain += c.grain; cities++; }
  return { silver, grain, cities };
}
