/* 时事：电脑按本局局势生成的事件（与史事并行）。
 * 史事出自史书；时事出自此刻的数据——哪座城民心低、哪支军欠饷、哪员敌将降意高、哪里逢灾、哪里丰收——
 * 让每一两个月都有事可议，而不是长时间只按“结束本月”。
 * 规则：本方连续两月无事，必出一件；否则每月约三成五出一件；同一类事半年内不在同一处重复。
 * 抉择的后果当场结算并写入月报；也有只报不问的（丰收、谍报）。另有天下各处的灾异，影响他方城池，只作线索。 */
import type { GameState, City, Character } from './types';
import { report, nodeName, factionName, charName, bump, topOf, hostile, citiesOf, troopsText, adjustAtt } from './state';
import { rngFor, type Rng } from './rng';
import { lunarOf } from './calendar';
import { neighbors } from '../data/geography';
import { genLocal } from './people';
import { capture } from './military';
import type { EventTone } from './events';

export interface IncidentChoice { label: string; desc: string; apply: (s: GameState) => string }
export interface Incident {
  kind: string;
  title: string;
  text: string;
  node?: string;
  tone: EventTone;
  cat: '内政' | '人事' | '急报' | '军报';
  /** 有抉择的，交玩家定夺；电脑一方不用 */
  choices?: IncidentChoice[];
  /** 只报不问的，当场生效 */
  apply?: (s: GameState) => string;
}

/** 两月无事必出一件 */
export const QUIET_MONTHS = 2;
/** 同一类事、同一处，半年内不重复 */
export const INCIDENT_COOLDOWN = 6;

const src = (k: string) => ({ kind: 'event' as const, ref: 'inc:' + k });
const cool = (s: GameState, key: string) => { const t = s.flags['inc_' + key]; return typeof t === 'number' && s.turn - t < INCIDENT_COOLDOWN; };
const mark = (s: GameState, key: string) => { s.flags['inc_' + key] = s.turn; };
const own = (s: GameState) => citiesOf(s, s.player).sort((a, b) => (a.id < b.id ? -1 : 1));
const cap = (s: GameState) => { const id = s.factions[s.player]?.capital; return id && s.cities[id]?.controller === s.player ? s.cities[id] : undefined; };
const wan = (n: number) => troopsText(Math.round(n));

/** 本月该不该出时事：连续两月本方无史事、线索、时事则必出；否则约三成五 */
export function incidentDue(s: GameState): boolean {
  const last = Number(s.flags.last_tale ?? -99);
  if (s.turn - last >= QUIET_MONTHS) return true;
  return s.turn - last >= 1 && rngFor(s.seed, 'inc-roll', s.turn).chance(0.35);
}

/** 记下本方本月有事（史事、线索、时事） */
export function markTale(s: GameState) { s.flags.last_tale = s.turn; }

/** 挑一件与玩家相干的时事（按局势加权；都不合适则返回 null） */
export function pickIncident(s: GameState): Incident | null {
  if (!s.factions[s.player] || s.factions[s.player].defunct) return null;
  const rng = rngFor(s.seed, 'incident', s.turn);
  const cands: { w: number; make: () => Incident | null }[] = [];
  const cities = own(s);
  const m = lunarOf(s.turn).month;

  // 一、灾异：夏涝、春夏旱、秋蝗、时疫
  if (cities.length) {
    const kind = m >= 5 && m <= 7 ? (rng.chance(0.5) ? 'flood' : 'drought') : m >= 8 && m <= 9 ? 'locust' : m <= 4 ? (rng.chance(0.6) ? 'drought' : 'plague') : 'plague';
    const pool = cities.filter(c => !cool(s, kind + c.id) && !cool(s, 'disaster'));
    if (pool.length) cands.push({ w: 3, make: () => disaster(s, rng, kind, weighted(rng, pool, c => c.pop)) });
  }
  // 二、人心涣散：民心低的城，乡民抗粮聚啸
  const restless = cities.filter(c => c.minxin < 30 && !cool(s, 'unrest' + c.id));
  if (restless.length) cands.push({ w: 4, make: () => unrestIncident(s, restless.sort((a, b) => a.minxin - b.minxin)[0]) });
  // 三、军中索饷：连欠两月以上
  const unpaid = Object.values(s.armies).filter(a => a.faction === s.player && (a.unpaid ?? 0) >= 2 && !cool(s, 'pay' + a.id));
  if (unpaid.length) cands.push({ w: 4, make: () => payIncident(s, unpaid.sort((a, b) => (b.arrears ?? 0) - (a.arrears ?? 0))[0].id) });
  // 四、敌将来投：邻境敌方、中立之将，降意高或忠诚低
  const border = new Set(cities.flatMap(c => neighbors(c.id).map(n => n.to)));
  const turncoats = Object.values(s.chars).filter(c => c.status === 'active' && s.factions[c.faction] && !s.factions[c.faction].defunct && topOf(s, c.faction) !== topOf(s, s.player)
    && s.factions[c.faction].leader !== c.id && border.has(c.location) && (c.att.surrender >= 55 || c.att.loyalty <= 35) && !c.royal && !cool(s, 'defect' + c.id)
    && !Object.values(s.armies).some(a => a.commander === c.id));
  if (turncoats.length) cands.push({ w: 3, make: () => defectIncident(s, turncoats.sort((a, b) => (b.att.surrender - b.att.loyalty) - (a.att.surrender - a.att.loyalty))[0]) });
  // 五、乡勇来投：民心尚可的城，乡里豪杰率众投效
  const loyal = cities.filter(c => c.minxin >= 50 && !cool(s, 'braves' + c.id));
  if (loyal.length && !cool(s, 'braves')) cands.push({ w: 2, make: () => bravesIncident(s, rng, rng.pick(loyal)) });
  // 六、丰收（秋）与商旅
  if ((m === 8 || m === 9) && cities.length && !cool(s, 'harvest')) cands.push({ w: 2, make: () => harvest(s, rng, weighted(rng, cities, c => c.agri)) });
  const ports = cities.filter(c => (c.trade ?? 0) > 0 && !cool(s, 'trade' + c.id));
  if (ports.length) cands.push({ w: 1, make: () => tradeBoom(s, rng, rng.pick(ports)) });
  // 七、谍报：邻境敌军集结
  const massing = Object.values(s.armies).filter(a => hostile(s, a.faction, s.player) && a.troops >= 15000 && border.has(a.location) && !cool(s, 'spy' + a.location));
  if (massing.length) cands.push({ w: 3, make: () => spyReport(s, rng, massing.sort((a, b) => b.troops - a.troops)[0].id) });
  // 八、将帅失和：本方两员统兵大将主战主和相去甚远
  const gens = Object.values(s.armies).filter(a => a.faction === s.player).map(a => s.chars[a.commander]).filter((c): c is Character => !!c && c.status === 'active');
  const hawk = gens.slice().sort((a, b) => b.att.hawk - a.att.hawk)[0], dove = gens.slice().sort((a, b) => a.att.hawk - b.att.hawk)[0];
  if (hawk && dove && hawk.id !== dove.id && hawk.att.hawk - dove.att.hawk >= 70 && !cool(s, 'feud')) cands.push({ w: 2, make: () => feud(s, hawk, dove) });

  // —— 更多正面之事 ——
  // 九、贤士献策：文教尚可之城，有士人上书，可延揽
  const lettered = cities.filter(c => c.edu >= 45 && !cool(s, 'sage' + c.id));
  if (lettered.length && !cool(s, 'sage')) cands.push({ w: 2, make: () => sageIncident(s, rng, weighted(rng, lettered, c => c.edu)) });
  // 十、富户捐输：商业繁盛之城
  const rich = cities.filter(c => c.commerce >= 50 && c.minxin >= 40 && !cool(s, 'donate' + c.id));
  if (rich.length && !cool(s, 'donate')) cands.push({ w: 2, make: () => donateIncident(s, rng, weighted(rng, rich, c => c.commerce * c.pop)) });
  // 十一、工匠献铳：本方有野战军
  const myArmies = Object.values(s.armies).filter(a => a.faction === s.player);
  if (myArmies.length && !cool(s, 'smith')) cands.push({ w: 1, make: () => smithIncident(s, rng, rng.pick(myArmies).id) });
  // 十二、屯田有成：农业偏低、民心不坏之城
  const fallow = cities.filter(c => c.agri < 50 && c.minxin >= 35 && !cool(s, 'tuntian' + c.id));
  if (fallow.length && !cool(s, 'tuntian')) cands.push({ w: 1, make: () => tuntianIncident(s, rng.pick(fallow)) });
  // 十三、敌军内讧：与本方交战之家，某军士气低
  const shaky = Object.values(s.armies).filter(a => hostile(s, a.faction, s.player) && a.morale < 55 && a.troops >= 5000 && !cool(s, 'rift' + a.faction));
  if (shaky.length) cands.push({ w: 2, make: () => riftIncident(s, shaky.sort((a, b) => a.morale - b.morale)[0].id) });
  // —— 更多负面之事 ——
  // 十四、盗匪：吏治低之城
  const lawless = cities.filter(c => c.order < 45 && !cool(s, 'bandit' + c.id));
  if (lawless.length) cands.push({ w: 3, make: () => banditIncident(s, rng, lawless.sort((a, b) => a.order - b.order)[0]) });
  // 十五、贪墨：主官有贪名、或吏治低而府库厚
  const greedy = cities.filter(c => { const g = c.governor ? s.chars[c.governor] : undefined; return !!g && g.faction === s.player && (g.traits?.includes('tan') || (c.order < 50 && c.silver > 50000)) && !cool(s, 'graft' + c.id); });
  if (greedy.length) cands.push({ w: 3, make: () => graftIncident(s, greedy[0]) });
  // 十六、火灾
  const towns = cities.filter(c => c.pop >= 20 && !cool(s, 'fire' + c.id));
  if (towns.length && !cool(s, 'fire')) cands.push({ w: 1, make: () => fireIncident(s, rng, weighted(rng, towns, c => c.pop)) });
  // 十七、军中疫病、逃兵：饥饿或士气低的本方军
  const sick = myArmies.filter(a => (a.hunger > 0 || a.morale < 40) && a.troops >= 3000 && !cool(s, 'camp' + a.id));
  if (sick.length) cands.push({ w: 3, make: () => campIncident(s, rng, sick.sort((a, b) => a.morale - b.morale)[0].id) });
  // 十八、流言离间：敌方散布本方主官有异志
  const govs = cities.filter(c => { const g = c.governor ? s.chars[c.governor] : undefined; return !!g && g.faction === s.player && border.has(c.id) && !cool(s, 'rumor' + g.id); });
  if (govs.length && Object.values(s.factions).some(f => !f.defunct && hostile(s, f.id, s.player))) cands.push({ w: 2, make: () => rumorIncident(s, rng.pick(govs)) });

  // 按权重抽，抽中的做不成就换下一个
  const order = cands.map(c => ({ c, k: rng.next() ** (1 / c.w) })).sort((a, b) => b.k - a.k).map(x => x.c);
  for (const c of order) { const inc = c.make(); if (inc) return inc; }
  return null;
}

function weighted<T>(rng: Rng, list: T[], w: (x: T) => number): T {
  const tot = list.reduce((n, x) => n + Math.max(0.01, w(x)), 0);
  let r = rng.next() * tot;
  for (const x of list) { r -= Math.max(0.01, w(x)); if (r <= 0) return x; }
  return list[list.length - 1];
}

/* ---------------- 各类时事 ---------------- */
const DIS: Record<string, { title: string; what: string; agri: number; pop: number; grain: number }> = {
  flood: { title: '水患', what: '霖雨连旬，河堤溃决，田庐漂没', agri: -6, pop: -0.015, grain: -0.12 },
  drought: { title: '旱灾', what: '入春不雨，赤地千里，禾苗尽槁', agri: -8, pop: -0.01, grain: -0.08 },
  locust: { title: '蝗灾', what: '飞蝗蔽天而下，所过禾稼一空', agri: -7, pop: -0.008, grain: -0.15 },
  plague: { title: '时疫', what: '疫气流行，十室九病，市井萧条', agri: -2, pop: -0.03, grain: 0 },
};
function disaster(s: GameState, rng: Rng, kind: string, c: City): Incident {
  const d = DIS[kind];
  const relief = Math.round(Math.max(3000, c.pop * 500) / 1000) * 1000;   // 开仓所需之粮
  const remit = Math.round(Math.max(3000, c.pop * 180) / 1000) * 1000;    // 蠲免所失之银
  const hit = (st: GameState) => {
    const k = src(kind + c.id);
    bump(st, c.id, 'agri', d.agri, d.title, k);
    if (d.pop) bump(st, c.id, 'pop', Math.round(c.pop * d.pop * 100) / 100, d.title, k);
    if (d.grain) bump(st, c.id, 'grain', -Math.round(c.grain * d.grain), `${d.title}，仓粮损耗`, k);
    mark(st, kind + c.id); mark(st, 'disaster');
  };
  void rng;
  return {
    kind, title: `${nodeName(c.id)}${d.title}`, node: c.id, tone: 'omen', cat: '内政',
    text: `${nodeName(c.id)}${d.what}。百姓扶老携幼，流离道路，乡老伏阙求赈。（农业 ${d.agri}${d.pop ? `、人口约 −${Math.round(-d.pop * 1000) / 10}%` : ''}${d.grain ? `、仓粮 −${Math.round(d.grain * 100)}%` : ''}）`,
    choices: [
      { label: '开仓赈济', desc: `动用本城仓粮约 ${wan(relief)} 石，民心 +6。`, apply: st => { hit(st); bump(st, c.id, 'grain', -relief, `${d.title}，开仓赈济`, src(kind + c.id)); bump(st, c.id, 'minxin', 6, '开仓赈济', src(kind + c.id)); return `开仓放粮 ${wan(relief)} 石，灾民稍安。`; } },
      { label: '蠲免钱粮', desc: `本城免征一季，少收银约 ${wan(remit)} 两，民心 +4。`, apply: st => { hit(st); bump(st, c.id, 'silver', -remit, `${d.title}，蠲免钱粮`, src(kind + c.id)); bump(st, c.id, 'minxin', 4, '蠲免钱粮', src(kind + c.id)); return `蠲免一季钱粮，百姓感恩。`; } },
      { label: '照常征收', desc: '府库不减；民心 −6、吏治 −2，流民或将聚啸。', apply: st => { hit(st); bump(st, c.id, 'minxin', -6, `${d.title}而照常征收`, src(kind + c.id)); bump(st, c.id, 'order', -2, `${d.title}而照常征收`, src(kind + c.id)); return '照常催科，怨声载道。'; } },
    ],
  };
}

function unrestIncident(s: GameState, c: City): Incident {
  const cost = Math.round(Math.max(4000, c.pop * 250) / 1000) * 1000;
  const k = src('unrest' + c.id);
  return {
    kind: 'unrest', title: `${nodeName(c.id)}人心涣散`, node: c.id, tone: 'omen', cat: '急报',
    text: `${nodeName(c.id)}民心只剩 ${Math.round(c.minxin)}。乡民抗粮不纳，聚众数千，扬言入城。士绅闭门观望，胥吏不敢下乡。（民心再跌破一成且无大军镇抚，恐生民变、豪强据城）`,
    choices: [
      { label: '减赋安民', desc: `本城少收银约 ${wan(cost)} 两；民心 +10。`, apply: st => { mark(st, 'unrest' + c.id); bump(st, c.id, 'silver', -cost, '减赋安民', k); bump(st, c.id, 'minxin', 10, '减赋安民', k); return '下令减赋，乡民渐散。'; } },
      { label: '遣兵弹压', desc: '驻军折损一成；吏治 +5、民心 −4。', apply: st => { mark(st, 'unrest' + c.id); bump(st, c.id, 'garrison', -Math.round(c.garrison * 0.1), '弹压乡民', k); bump(st, c.id, 'order', 5, '弹压乡民', k); bump(st, c.id, 'minxin', -4, '弹压乡民', k); return '官兵入乡弹压，为首者伏诛，余众暂散。'; } },
      { label: '延请士绅调停', desc: `花银约 ${wan(cost / 3)} 两；民心 +5、吏治 +2。`, apply: st => { mark(st, 'unrest' + c.id); bump(st, c.id, 'silver', -Math.round(cost / 3), '延请士绅调停', k); bump(st, c.id, 'minxin', 5, '士绅调停', k); bump(st, c.id, 'order', 2, '士绅调停', k); return '乡绅出面调停，许以缓征，事态稍息。'; } },
    ],
  };
}

function payIncident(s: GameState, armyId: string): Incident | null {
  const a = s.armies[armyId];
  if (!a) return null;
  const owe = Math.max(2000, a.arrears ?? 0);
  const tre = cap(s);
  const commander = charName(s, a.commander);
  return {
    kind: 'pay', title: `${a.name}索饷`, node: a.location, tone: 'war', cat: '急报',
    text: `${a.name}连欠饷 ${a.unpaid ?? 0} 月，积欠约 ${wan(owe)} 两。营中鼓噪，士卒围帐索饷，${commander}弹压不住，飞章告急。`,
    choices: [
      { label: '府库补发', desc: tre ? `从${nodeName(tre.id)}府库拨银 ${wan(Math.min(owe, tre.silver))} 两，欠饷清偿、士气回升。` : '治所已失，无库可拨。', apply: st => {
        mark(st, 'pay' + armyId); const t = cap(st), x = st.armies[armyId];
        if (!t || !x) return '无库可拨，营中怨气未消。';
        const pay = Math.min(owe, Math.floor(t.silver));
        if (pay < 1000) { x.morale = Math.max(5, x.morale - 3); return '府库空虚，拨不出银来，营中怨气更甚。'; }
        bump(st, t.id, 'silver', -pay, `补发${x.name}欠饷`, src('pay' + armyId));
        x.arrears = Math.max(0, (x.arrears ?? 0) - pay); if (!x.arrears) x.unpaid = 0;
        const full = pay >= owe; x.morale = Math.min(100, x.morale + (full ? 8 : 3));
        return full ? `拨银 ${wan(pay)} 两补足欠饷，军心复振。` : `府库只拨得 ${wan(pay)} 两，补了一部分，营中稍安。`; } },
      { label: '好言抚慰', desc: '许以来月补发；士气 −5，欠饷照旧。', apply: st => { mark(st, 'pay' + armyId); const x = st.armies[armyId]; if (x) x.morale = Math.max(5, x.morale - 5); return '暂以好言安抚，士卒将信将疑。'; } },
      { label: '斩首倡乱者', desc: '军纪一肃；士气 −10，主将威望略增。', apply: st => { mark(st, 'pay' + armyId); const x = st.armies[armyId]; if (x) { x.morale = Math.max(5, x.morale - 10); adjustAtt(st, x.commander, 'loyalty', 2, '奉命肃军'); } return '斩倡乱者数人传首营中，鼓噪方止。'; } },
    ],
  };
}

function defectIncident(s: GameState, ch: Character): Incident | null {
  const from = ch.faction;
  const city = s.cities[ch.location];
  const isGov = city?.governor === ch.id && city.controller === from && s.factions[from]?.capital !== city.id && city.garrison <= 8000;
  const gift = Math.round((3000 + ch.ab.wang * 80) / 1000) * 1000;
  const tre = cap(s);
  const k = src('defect' + ch.id);
  const accept = (st: GameState, withCity: boolean) => {
    mark(st, 'defect' + ch.id);
    const t = cap(st), c = st.chars[ch.id];
    if (!c || c.status !== 'active' || c.faction !== from) return `${ch.name}事泄未能成行。`;
    if (t) bump(st, t.id, 'silver', -Math.min(gift, t.silver), `厚礼迎${ch.name}`, k);
    if (withCity && st.cities[ch.location]?.controller === from) {
      // 献城：交给易主流程，守将随城归附
      const node = ch.location;
      capture(st, node, st.player, '献城', ch.id);
      return `${ch.name}举${nodeName(node)}来归。`;
    }
    if (st.cities[c.location]?.governor === c.id) delete st.cities[c.location].governor;
    c.faction = st.player; c.att.loyalty = 55; c.att.surrender = 20;
    const home = t ?? own(st)[0];
    if (home) c.location = home.id;
    return `${ch.name}弃${factionName(st, from)}来投，可以任用。`;
  };
  return {
    kind: 'defect', title: `${ch.name}密书来投`, node: ch.location, tone: 'turn', cat: '人事',
    text: `${factionName(s, from)}${ch.title}${ch.name}（统 ${ch.ab.tong}、政 ${ch.ab.zheng}）驻${nodeName(ch.location)}，${ch.att.loyalty <= 35 ? '素与主上不睦' : '久有归附之意'}，遣心腹密书请降${isGov ? `，愿举${nodeName(ch.location)}来归` : ''}。`,
    choices: [
      ...(isGov ? [{ label: `受其献城`, desc: `${nodeName(ch.location)}与守军随之归附；厚礼约 ${wan(gift)} 两。与${factionName(s, from)}结怨更深。`, apply: (st: GameState) => accept(st, true) }] : []),
      { label: '厚礼迎之', desc: `${tre ? `花银约 ${wan(gift)} 两，` : ''}${ch.name}只身来投，可以任用。`, apply: st => accept(st, false) },
      { label: '恐其有诈，婉拒', desc: '不受降，无所得失。', apply: st => { mark(st, 'defect' + ch.id); return `婉拒${ch.name}来书。`; } },
    ],
  };
}

function bravesIncident(s: GameState, rng: Rng, c: City): Incident {
  const n = rng.int(8, 16) * 100;
  return {
    kind: 'braves', title: `${nodeName(c.id)}乡勇来投`, node: c.id, tone: 'turn', cat: '人事',
    text: `${nodeName(c.id)}乡里豪杰率乡勇 ${n} 人诣城投效，愿听调遣。`,
    choices: [
      { label: '编入驻军，授其官职', desc: `驻军 +${n}，得一员可用之人。`, apply: st => {
        mark(st, 'braves' + c.id); mark(st, 'braves');
        bump(st, c.id, 'garrison', n, '乡勇来投', src('braves' + c.id));
        const ch = genLocal(st, st.player, c.id, rngFor(st.seed, 'braves', st.turn, c.id), st.cities[c.id].edu);
        ch.title = '乡勇首领'; ch.ab.tong = Math.max(ch.ab.tong, 45); ch.bio = `${nodeName(c.id)}人，率乡勇投效${factionName(st, st.player)}。`; st.chars[ch.id] = ch;
        return `乡勇 ${n} 人编入驻军，首领${ch.name}授职听用。`; } },
      { label: '赏银遣归', desc: '花银 2000 两，民心 +3。', apply: st => { mark(st, 'braves' + c.id); mark(st, 'braves'); bump(st, c.id, 'silver', -2000, '赏乡勇遣归', src('braves' + c.id)); bump(st, c.id, 'minxin', 3, '赏乡勇遣归', src('braves' + c.id)); return '厚赏遣归，乡里称颂。'; } },
    ],
  };
}

function harvest(s: GameState, rng: Rng, c: City): Incident {
  const g = Math.round(c.pop * rng.int(300, 600) / 1000) * 1000 || 3000;
  return {
    kind: 'harvest', title: `${nodeName(c.id)}秋稔`, node: c.id, tone: 'omen', cat: '内政',
    text: `${nodeName(c.id)}今岁风调雨顺，秋禾大熟，仓廪充盈。（仓粮 +${wan(g)} 石，民心 +3）`,
    apply: st => { mark(st, 'harvest'); bump(st, c.id, 'grain', g, '秋稔', src('harvest')); bump(st, c.id, 'minxin', 3, '秋稔', src('harvest')); return ''; },
  };
}

function tradeBoom(s: GameState, rng: Rng, c: City): Incident {
  const v = rng.int(4, 12) * 1000;
  return {
    kind: 'trade', title: `${nodeName(c.id)}商舶云集`, node: c.id, tone: 'omen', cat: '内政',
    text: `${nodeName(c.id)}番舶、海商云集，市舶抽分颇丰。（存银 +${wan(v)} 两）`,
    apply: st => { mark(st, 'trade' + c.id); bump(st, c.id, 'silver', v, '商舶抽分', src('trade' + c.id)); return ''; },
  };
}

function spyReport(s: GameState, rng: Rng, armyId: string): Incident | null {
  const a = s.armies[armyId];
  if (!a) return null;
  const near = neighbors(a.location).map(n => n.to).find(id => s.cities[id]?.controller === s.player);
  const rough = Math.round(a.troops * (0.8 + rng.next() * 0.4) / 5000) * 5000 || 5000;
  return {
    kind: 'spy', title: `谍报：${factionName(s, a.faction)}集兵${nodeName(a.location)}`, node: a.location, tone: 'war', cat: '军报',
    text: `探马回报：${factionName(s, a.faction)}${charName(s, a.commander)}屯兵${nodeName(a.location)}，约 ${wan(rough)} 人${near ? `，与本方${nodeName(near)}仅一程之隔` : ''}。宜早作防备。`,
    apply: st => { mark(st, 'spy' + a.location); return ''; },
  };
}

function feud(s: GameState, hawk: Character, dove: Character): Incident {
  return {
    kind: 'feud', title: '将帅失和', tone: 'court', cat: '人事',
    text: `${hawk.name}力主进兵，${dove.name}主张持重，二人在军议上当众争执，各不相下，诸将观望。`,
    choices: [
      { label: `从${hawk.name}之议`, desc: `${hawk.name}忠诚 +5，${dove.name}忠诚 −5。`, apply: st => { mark(st, 'feud'); adjustAtt(st, hawk.id, 'loyalty', 5, '其议见用'); adjustAtt(st, dove.id, 'loyalty', -5, '其议不用'); return `从${hawk.name}之议。`; } },
      { label: `从${dove.name}之议`, desc: `${dove.name}忠诚 +5，${hawk.name}忠诚 −5。`, apply: st => { mark(st, 'feud'); adjustAtt(st, dove.id, 'loyalty', 5, '其议见用'); adjustAtt(st, hawk.id, 'loyalty', -5, '其议不用'); return `从${dove.name}之议。`; } },
      { label: '两相调和', desc: '二人忠诚各 −2，不偏不倚。', apply: st => { mark(st, 'feud'); adjustAtt(st, hawk.id, 'loyalty', -2, '主上和稀泥'); adjustAtt(st, dove.id, 'loyalty', -2, '主上和稀泥'); return '温言调和，暂息争端。'; } },
    ],
  };
}

/* ---------------- 正面 ---------------- */
function sageIncident(s: GameState, rng: Rng, c: City): Incident {
  const cost = rng.int(3, 8) * 1000;
  return {
    kind: 'sage', title: `${nodeName(c.id)}贤士献策`, node: c.id, tone: 'court', cat: '人事',
    text: `${nodeName(c.id)}有士人诣阙上书，条陈屯田、练兵、理财诸策，言之有物。`,
    choices: [
      { label: '礼聘出仕', desc: `花银 ${wan(cost)} 两，得一员有才之人。`, apply: st => {
        mark(st, 'sage' + c.id); mark(st, 'sage'); bump(st, c.id, 'silver', -cost, '礼聘贤士', src('sage' + c.id));
        const ch = genLocal(st, st.player, c.id, rngFor(st.seed, 'sage', st.turn, c.id), Math.max(70, st.cities[c.id].edu));
        ch.ab.zheng = Math.max(ch.ab.zheng, 60); st.chars[ch.id] = ch;
        return `${ch.name}应聘出仕（政务 ${ch.ab.zheng}），可任主官。`; } },
      { label: '赐金褒奖，采其策', desc: '花银 1000 两；本城吏治 +3。', apply: st => { mark(st, 'sage' + c.id); mark(st, 'sage'); bump(st, c.id, 'silver', -1000, '褒奖献策', src('sage' + c.id)); bump(st, c.id, 'order', 3, '采纳献策', src('sage' + c.id)); return '采其良策，颁行本城。'; } },
    ],
  };
}
function donateIncident(s: GameState, rng: Rng, c: City): Incident {
  const v = Math.round(c.pop * rng.int(200, 450) / 1000) * 1000 || 5000;
  return {
    kind: 'donate', title: `${nodeName(c.id)}富户捐输`, node: c.id, tone: 'omen', cat: '内政',
    text: `${nodeName(c.id)}盐商、典户感念朝廷保境，愿捐银 ${wan(v)} 两助饷，只求旌表门闾、减免杂差。`,
    choices: [
      { label: '受其捐输，旌表门闾', desc: `存银 +${wan(v)} 两；吏治 −1（豪右得势）。`, apply: st => { mark(st, 'donate' + c.id); mark(st, 'donate'); bump(st, c.id, 'silver', v, '富户捐输', src('donate' + c.id)); bump(st, c.id, 'order', -1, '豪右得势', src('donate' + c.id)); return `收捐银 ${wan(v)} 两。`; } },
      { label: '只收半数，不予特权', desc: `存银 +${wan(v / 2)} 两；民心 +2。`, apply: st => { mark(st, 'donate' + c.id); mark(st, 'donate'); bump(st, c.id, 'silver', Math.round(v / 2), '富户捐输（半数）', src('donate' + c.id)); bump(st, c.id, 'minxin', 2, '不予豪右特权', src('donate' + c.id)); return `收捐银 ${wan(v / 2)} 两，余者婉谢。`; } },
    ],
  };
}
function smithIncident(s: GameState, rng: Rng, armyId: string): Incident | null {
  const a = s.armies[armyId];
  if (!a) return null;
  const cost = rng.int(4, 9) * 1000;
  return {
    kind: 'smith', title: '工匠献铳', node: a.location, tone: 'war', cat: '军报',
    text: `有匠人献新制鸟铳、佛郎机炮式样，射远而少炸膛，愿为${a.name}督造。`,
    choices: [
      { label: '拨银督造', desc: `花银 ${wan(cost)} 两；${a.name}火器 +4 成分、士气 +3。`, apply: st => {
        mark(st, 'smith'); const x = st.armies[armyId], t = cap(st);
        if (!x) return '军已不在，事遂寝。';
        if (t) bump(st, t.id, 'silver', -Math.min(cost, t.silver), '督造火器', src('smith'));
        const g = Math.min(0.04, x.mix.inf); x.mix = { ...x.mix, gun: x.mix.gun + g, inf: x.mix.inf - g }; x.morale = Math.min(100, x.morale + 3);
        return `${x.name}换装新铳。`; } },
      { label: '赏而遣之', desc: '花银 500 两，无所改易。', apply: st => { mark(st, 'smith'); const t = cap(st); if (t) bump(st, t.id, 'silver', -500, '赏匠人', src('smith')); return '厚赏匠人遣归。'; } },
    ],
  };
}
function tuntianIncident(s: GameState, c: City): Incident {
  return {
    kind: 'tuntian', title: `${nodeName(c.id)}屯田有成`, node: c.id, tone: 'omen', cat: '内政',
    text: `${nodeName(c.id)}招集流民垦荒，开渠引水，新田渐成。（农业 +5，民心 +2）`,
    apply: st => { mark(st, 'tuntian' + c.id); mark(st, 'tuntian'); bump(st, c.id, 'agri', 5, '屯田有成', src('tuntian')); bump(st, c.id, 'minxin', 2, '流民复业', src('tuntian')); return ''; },
  };
}
function riftIncident(s: GameState, armyId: string): Incident | null {
  const a = s.armies[armyId];
  if (!a) return null;
  return {
    kind: 'rift', title: `谍报：${factionName(s, a.faction)}军中内讧`, node: a.location, tone: 'war', cat: '军报',
    text: `探得${factionName(s, a.faction)}${a.name}驻${nodeName(a.location)}，将士争功、粮饷不继，营中互相攻讦。（彼军士气再降，正可乘之）`,
    apply: st => { mark(st, 'rift' + a.faction); const x = st.armies[armyId]; if (x) x.morale = Math.max(5, x.morale - 8); return ''; },
  };
}
/* ---------------- 负面 ---------------- */
function banditIncident(s: GameState, rng: Rng, c: City): Incident {
  const loss = Math.round(Math.max(3000, c.silver * 0.04) / 1000) * 1000;
  const n = rng.int(10, 30) * 100;
  const k = src('bandit' + c.id);
  return {
    kind: 'bandit', title: `${nodeName(c.id)}盗起`, node: c.id, tone: 'war', cat: '急报',
    text: `${nodeName(c.id)}吏治废弛，山泽之间盗贼蜂起，众约 ${wan(n)}，劫掠漕船、焚掠乡村。`,
    choices: [
      { label: '发兵进剿', desc: `驻军折损约 ${wan(n / 4)}；吏治 +4。`, apply: st => { mark(st, 'bandit' + c.id); bump(st, c.id, 'garrison', -Math.round(n / 4), '进剿盗贼', k); bump(st, c.id, 'order', 4, '剿平盗贼', k); return '官军进剿，渠魁授首。'; } },
      { label: '招安收编', desc: `驻军 +${wan(n / 2)}；吏治 −3（降卒难驯）。`, apply: st => { mark(st, 'bandit' + c.id); bump(st, c.id, 'garrison', Math.round(n / 2), '招安盗众', k); bump(st, c.id, 'order', -3, '降卒难驯', k); return '招安其众，编入营伍。'; } },
      { label: '闭城自守', desc: `城外受掠：存银 −${wan(loss)}、民心 −4。`, apply: st => { mark(st, 'bandit' + c.id); bump(st, c.id, 'silver', -loss, '盗贼劫掠', k); bump(st, c.id, 'minxin', -4, '盗贼劫掠', k); return '闭门不出，乡村遭掠。'; } },
    ],
  };
}
function graftIncident(s: GameState, c: City): Incident | null {
  const g = c.governor ? s.chars[c.governor] : undefined;
  if (!g) return null;
  const v = Math.round(Math.max(3000, c.silver * 0.06) / 1000) * 1000;
  const k = src('graft' + c.id);
  return {
    kind: 'graft', title: `${nodeName(c.id)}贪墨案发`, node: c.id, tone: 'court', cat: '人事',
    text: `御史劾奏${nodeName(c.id)}主官${g.name}侵吞钱粮约 ${wan(v)} 两，私派加征，民怨沸腾。`,
    choices: [
      { label: '罢官追赃', desc: `追回 ${wan(v)} 两，主官出缺；${g.name}忠诚 −15。`, apply: st => { mark(st, 'graft' + c.id); bump(st, c.id, 'silver', v, '追赃', k); if (st.cities[c.id].governor === g.id) delete st.cities[c.id].governor; adjustAtt(st, g.id, 'loyalty', -15, '罢官追赃'); bump(st, c.id, 'minxin', 3, '惩贪', k); return `${g.name}罢官，赃银入库。`; } },
      { label: '罚俸留任', desc: `${g.name}忠诚 −5；吏治 +2。`, apply: st => { mark(st, 'graft' + c.id); adjustAtt(st, g.id, 'loyalty', -5, '罚俸'); bump(st, c.id, 'order', 2, '罚俸示警', k); return `罚${g.name}俸一年，令其戴罪理事。`; } },
      { label: '置之不问', desc: `存银 −${wan(v)}、民心 −4、吏治 −2。`, apply: st => { mark(st, 'graft' + c.id); bump(st, c.id, 'silver', -v, '贪墨', k); bump(st, c.id, 'minxin', -4, '贪墨不问', k); bump(st, c.id, 'order', -2, '贪墨不问', k); return '留中不发，贪风益炽。'; } },
    ],
  };
}
function fireIncident(s: GameState, rng: Rng, c: City): Incident {
  const g = Math.round(c.grain * rng.int(5, 12) / 100);
  return {
    kind: 'fire', title: `${nodeName(c.id)}大火`, node: c.id, tone: 'omen', cat: '内政',
    text: `${nodeName(c.id)}夜半失火，延烧街市、仓廒，数日方熄。（仓粮 −${wan(g)} 石，人口、民心受损）`,
    apply: st => { mark(st, 'fire' + c.id); mark(st, 'fire'); const k = src('fire' + c.id); bump(st, c.id, 'grain', -g, '大火延烧仓廒', k); bump(st, c.id, 'pop', -Math.round(c.pop * 0.005 * 100) / 100, '大火', k); bump(st, c.id, 'minxin', -2, '大火', k); return ''; },
  };
}
function campIncident(s: GameState, rng: Rng, armyId: string): Incident | null {
  const a = s.armies[armyId];
  if (!a) return null;
  const plague = a.hunger > 0 || rng.chance(0.5);
  const n = Math.round(a.troops * (plague ? 0.06 : 0.04) / 100) * 100;
  return {
    kind: 'camp', title: `${a.name}${plague ? '营中疫病' : '逃兵日众'}`, node: a.location, tone: 'war', cat: '急报',
    text: plague ? `${a.name}驻${nodeName(a.location)}，饥疲之余疫气大作，营中卧病者日增。` : `${a.name}士气低落，夜有士卒结伙逃亡，哨官不能禁。`,
    choices: [
      { label: plague ? '延医施药' : '加饷留人', desc: `花银约 ${wan(n * 2)} 两；只折 ${wan(n / 3)} 人。`, apply: st => { mark(st, 'camp' + armyId); const x = st.armies[armyId], t = cap(st); if (!x) return ''; if (t) bump(st, t.id, 'silver', -Math.min(n * 2, t.silver), plague ? '营中施药' : '加饷留人', src('camp' + armyId)); x.troops = Math.max(300, x.troops - Math.round(n / 3)); return plague ? '延医施药，疫势渐止。' : '加饷安抚，逃亡稍止。'; } },
      { label: plague ? '隔营而居' : '严申军法', desc: `折 ${wan(n)} 人；士气 ${plague ? '−3' : '−6'}。`, apply: st => { mark(st, 'camp' + armyId); const x = st.armies[armyId]; if (!x) return ''; x.troops = Math.max(300, x.troops - n); x.morale = Math.max(5, x.morale - (plague ? 3 : 6)); return plague ? `病卒隔营，折损 ${wan(n)} 人。` : `斩逃卒以徇，仍折 ${wan(n)} 人。`; } },
    ],
  };
}
function rumorIncident(s: GameState, c: City): Incident | null {
  const g = c.governor ? s.chars[c.governor] : undefined;
  if (!g) return null;
  return {
    kind: 'rumor', title: '流言离间', node: c.id, tone: 'court', cat: '人事',
    text: `坊间传言${nodeName(c.id)}主官${g.name}暗通敌国、阴蓄异志，揭帖贴满城门。多半是敌方离间之计，然朝中已有人附和。`,
    choices: [
      { label: '下诏慰勉，以示不疑', desc: `${g.name}忠诚 +6。`, apply: st => { mark(st, 'rumor' + g.id); adjustAtt(st, g.id, 'loyalty', 6, '主上不疑'); return `${g.name}感激涕零。`; } },
      { label: '调离他任，以防万一', desc: `${g.name}卸去主官、忠诚 −6；本城吏治 −2。`, apply: st => { mark(st, 'rumor' + g.id); if (st.cities[c.id].governor === g.id) delete st.cities[c.id].governor; adjustAtt(st, g.id, 'loyalty', -6, '无端见疑'); bump(st, c.id, 'order', -2, '临阵易官', src('rumor' + g.id)); return `${g.name}调离，心颇怏怏。`; } },
    ],
  };
}

/** 天下灾异：他方之城逢灾，真实削减其农业、人口，只作线索（约三月一见） */
export function worldOmen(s: GameState) {
  const rng = rngFor(s.seed, 'omen', s.turn);
  if (!rng.chance(0.33)) return;
  const pool = Object.values(s.cities).filter(c => c.controller !== s.player && c.controller !== 'helan' && !cool(s, 'omen' + c.id)).sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!pool.length) return;
  const c = weighted(rng, pool, x => x.pop);
  const m = lunarOf(s.turn).month;
  const kind = m >= 5 && m <= 7 ? 'flood' : m >= 8 && m <= 9 ? 'locust' : rng.chance(0.5) ? 'drought' : 'plague';
  const d = DIS[kind];
  const k = src('omen' + c.id);
  bump(s, c.id, 'agri', d.agri, d.title, k);
  if (d.pop) bump(s, c.id, 'pop', Math.round(c.pop * d.pop * 100) / 100, d.title, k);
  bump(s, c.id, 'minxin', -4, d.title, k);
  mark(s, 'omen' + c.id);
  report(s, { cat: '线索', tone: 'omen', node: c.id, text: `【${nodeName(c.id)}${d.title}】${factionName(s, c.controller)}所辖${nodeName(c.id)}${d.what}。（彼处农业、民心受损）` });
}
