/* 人物：特长、主官治城、招贤（地方人物）、俘虏处置、电脑补派主官。
 * 特长：名臣据史而定，其余按能力推出（同一人每次一样）。主官的政务、威望、统军与特长决定本城赋税田粮的增减，
 * 以及吏治、民心、城防逐月趋向何处；无主官之城不升不降。
 * 招贤：在本方城池花银延请地方人物（举人、乡绅、营将），文教高处多出能吏；本城无主官则暂署。
 * 俘虏：执者可劝降、释放或处斩。 */
import type { Character, City, GameState } from './types';
import { report, nodeName, factionName, charName, adjustAtt, bump, citiesOf, topOf } from './state';
import { rngFor, hashKeys, type Rng } from './rng';

export type TraitId = 'lianzheng' | 'licai' | 'tuntian' | 'fumin' | 'shanshou' | 'lianbing' | 'biancai' | 'xiaoyong' | 'tan' | 'kuli' | 'zhimou' | 'shuishi';
export interface Trait { name: string; icon: string; desc: string; tone: 'good' | 'bad' }
export const TRAITS: Record<TraitId, Trait> = {
  lianzheng: { name: '清廉', icon: 'order', desc: '主政之城吏治趋高（+10）', tone: 'good' },
  licai: { name: '理财', icon: 'silver', desc: '主政之城赋税 +12%', tone: 'good' },
  tuntian: { name: '屯田', icon: 'agri', desc: '主政之城田粮 +12%', tone: 'good' },
  fumin: { name: '抚民', icon: 'minxin', desc: '主政之城民心趋高（+12）', tone: 'good' },
  shanshou: { name: '善守', icon: 'wall', desc: '主政之城每月修城 +2；守城时士气 +8', tone: 'good' },
  lianbing: { name: '练兵', icon: 'recruit', desc: '主政之城每月可募兵数 +30%', tone: 'good' },
  biancai: { name: '辩才', icon: 'envoy', desc: '出使、劝降成功率 +8%', tone: 'good' },
  xiaoyong: { name: '骁勇', icon: 'charge', desc: '统兵作战时统军 +6', tone: 'good' },
  zhimou: { name: '智谋', icon: 'ambush', desc: '野战可用战法多一样', tone: 'good' },
  shuishi: { name: '水战', icon: 'navy', desc: '统领水师作战时统军 +8', tone: 'good' },
  tan: { name: '贪墨', icon: 'silver', desc: '主政之城赋税 −10%，吏治趋低（−10）', tone: 'bad' },
  kuli: { name: '严苛', icon: 'order', desc: '主政之城吏治趋高（+8）而民心趋低（−10）', tone: 'bad' },
};

/** 据史而定的特长 */
const KNOWN: Record<string, TraitId[]> = {
  shikefa: ['lianzheng', 'fumin'], mashiying: ['tan', 'zhimou'], ruandacheng: ['tan', 'zhimou'], qianqianyi: ['biancai'], zuomaodi: ['biancai', 'lianzheng'],
  zhangguowei: ['tuntian'], gaojie: ['xiaoyong', 'kuli'], huangdegong: ['xiaoyong'], zuoliangyu: ['lianbing'], liuzeqing: ['tan'],
  zhengzhilong: ['licai', 'shuishi'], zhenghongkui: ['shuishi'], zhengsen: ['shuishi', 'lianbing'], zhengcai: ['shuishi'], zhengtai: ['licai'], hongxu: ['shuishi'], shilang: ['shuishi', 'xiaoyong'], ganhui: ['xiaoyong'],
  duoergun: ['zhimou'], duoduo: ['xiaoyong'], ajige: ['xiaoyong'], wusangui: ['lianbing'], hongchengchou: ['zhimou', 'biancai'], fanwencheng: ['zhimou', 'licai'], aobai: ['xiaoyong'],
  lizicheng: ['fumin'], liuzongmin: ['kuli', 'xiaoyong'], niujinxing: ['zhimou'], songxiance: ['zhimou'], zhangxianzhong: ['kuli'], sunkewang: ['licai'], lidingguo: ['xiaoyong', 'zhimou'],
  yanyingyuan: ['shanshou'], chenzilong: ['lianbing'], huangdaozhou: ['lianzheng'], liuzongzhou: ['lianzheng'], qibiaojia: ['lianzheng', 'fumin'], qushisi: ['shanshou'], hetengjiao: ['lianbing'],
  duyinxi: ['biancai'], zhanghuangyan: ['shuishi'], zhangmingzhen: ['shuishi'], qinliangyu: ['lianbing', 'xiaoyong'], songyingxing: ['tuntian'], guyanwu: ['zhimou'], mutianbo: ['fumin'],
  zudashou: ['shanshou'], kongyoude: ['lianbing'], lichengdong: ['kuli'], yuanjixian: ['fumin'], houtongzeng: ['shanshou'], fengquan: ['tan'],
};

/** 人物的特长：显式所定 > 据史 > 按能力推出 */
export function traitsOf(c: Character): TraitId[] {
  if (c.traits) return c.traits as TraitId[];
  if (KNOWN[c.id]) return KNOWN[c.id];
  const out: TraitId[] = [];
  const h = hashKeys(c.id, 'trait');
  const { tong, zheng, mou, wai, wang } = c.ab;
  if (zheng >= 66) out.push(h % 2 ? 'licai' : 'tuntian');
  if (wang >= 72 && zheng >= 50) out.push('fumin');
  if (tong >= 66) out.push(mou >= 55 ? 'zhimou' : (h >> 3) % 3 === 0 ? 'shanshou' : 'xiaoyong');
  if (wai >= 68) out.push('biancai');
  if (c.att.loyalty >= 95 && zheng >= 55 && !out.includes('lianzheng')) out.push('lianzheng');
  if (!out.length && tong >= 55 && (h >> 5) % 3 === 0) out.push('lianbing');
  return out.slice(0, 2);
}
export const hasTrait = (c: Character | undefined, t: TraitId) => !!c && traitsOf(c).includes(t);

/** 本城在任的主官（须为本城实控者之人、在职） */
export function governorOf(s: GameState, c: City): Character | undefined {
  const g = c.governor ? s.chars[c.governor] : undefined;
  return g && g.status === 'active' && g.faction === c.controller ? g : undefined;
}

export interface GovEffects { silverMul: number; grainMul: number; orderTarget: number | null; minxinTarget: number | null; wallRepair: number; recruitMul: number }
/** 主官对本城的影响。无主官：赋税田粮按政务 40 计，吏治民心不升不降 */
export function govEffects(s: GameState, c: City): GovEffects {
  const g = governorOf(s, c);
  const zheng = g ? g.ab.zheng : 40;
  const base = 1 + (zheng - 50) / 250;
  if (!g) return { silverMul: base, grainMul: base, orderTarget: null, minxinTarget: null, wallRepair: 0, recruitMul: 1 };
  const t = traitsOf(g);
  const has = (x: TraitId) => t.includes(x);
  const silverMul = base * (has('licai') ? 1.12 : 1) * (has('tan') ? 0.9 : 1);
  const grainMul = base * (has('tuntian') ? 1.12 : 1);
  const orderTarget = Math.round(25 + g.ab.zheng * 0.55 + (has('lianzheng') ? 10 : 0) + (has('kuli') ? 8 : 0) - (has('tan') ? 10 : 0) + Math.round((c.edu - 50) / 5));
  const minxinTarget = Math.round(25 + g.ab.wang * 0.45 + g.ab.zheng * 0.1 + (has('fumin') ? 12 : 0) - (has('kuli') ? 10 : 0));
  const wallRepair = (g.ab.tong >= 60 ? 1 : 0) + (has('shanshou') ? 2 : 0);
  return { silverMul, grainMul, orderTarget, minxinTarget, wallRepair, recruitMul: has('lianbing') ? 1.3 : 1 };
}

/** 每月：有主官之城，吏治、民心向主官所能逐月靠拢一点；能将、善守者修城 */
export function governorDrift(s: GameState) {
  for (const c of Object.values(s.cities)) {
    const e = govEffects(s, c);
    if (e.orderTarget === null || e.minxinTarget === null) continue;
    const g = governorOf(s, c)!;
    const step = (cur: number, target: number) => cur < target ? 1 : cur > target + 5 ? -1 : 0;
    const dO = step(c.order, Math.min(95, e.orderTarget)), dM = s.sieges[c.id] ? 0 : step(c.minxin, Math.min(95, e.minxinTarget));
    if (dO) bump(s, c.id, 'order', dO, `主官${g.name}${dO > 0 ? '整饬吏治' : '吏治松弛'}`, { kind: 'policy', turn: s.turn, ref: 'gov' });
    if (dM) bump(s, c.id, 'minxin', dM, `主官${g.name}${dM > 0 ? '抚民有方' : '失于抚绥'}`, { kind: 'policy', turn: s.turn, ref: 'gov' });
    if (e.wallRepair && c.wall < 100 && !s.sieges[c.id]) bump(s, c.id, 'wall', Math.min(e.wallRepair, 100 - c.wall), `主官${g.name}修城`, { kind: 'policy', turn: s.turn, ref: 'gov' });
  }
}

/* ---------- 招贤：地方人物 ---------- */
export const SEEK_SILVER = 3000;
export const SEEK_COOLDOWN = 6;
const SURNAMES = '王李张刘陈杨黄赵吴周徐孙马朱胡郭何高林罗郑梁谢宋唐许韩冯邓曹彭曾萧田董袁潘蒋蔡余杜叶程苏魏吕丁任沈姚卢姜崔钟谭陆汪范金石廖贾夏韦方白邹孟熊秦邱江尹薛段雷侯龙陶黎贺顾毛郝龚邵万严武戴孔汤柳翁祝葛';
const GIVEN_A = '士文之廷启国应元允嘉维尔日天可承思宗德懋时光大一兆汝世鸣起道必成绍正';
const GIVEN_B = '章鼎祥谦恒璋烈纶彦禧翼达贞瑞宽潜衡昌泰泽卿麟忠诚节俊杰升荣';
const CIVIL_TITLES = ['举人', '生员', '乡绅', '致仕知县', '贡生', '幕友'];
const MIL_TITLES = ['营将', '千总', '把总', '武举', '乡勇首领'];

const GEN_NAMES = new WeakMap<GameState, Set<string>>();
/** 生成一位地方人物。edu 为乡里文教（高则多出能吏），名字不与在世者重复 */
export function genLocal(s: GameState, f: string, node: string, rng: Rng, edu: number, office?: string): Character {
  const used = GEN_NAMES.get(s) ?? new Set<string>(); GEN_NAMES.set(s, used);
  const taken = new Set([...Object.values(s.chars).map(c => c.name), ...used]);
  let name = '';
  for (let k = 0; k < 60 && (!name || taken.has(name)); k++) {
    const sur = SURNAMES[Math.floor(rng.next() * SURNAMES.length)];
    const one = rng.chance(0.25);
    name = sur + GIVEN_A[Math.floor(rng.next() * GIVEN_A.length)] + (one ? '' : GIVEN_B[Math.floor(rng.next() * GIVEN_B.length)]);
  }
  used.add(name);
  const martial = office ? false : rng.chance(0.4);
  const gift = rng.chance(0.06 + Math.max(0, edu - 50) / 400);   // 偶有出众者
  const lift = Math.round((edu - 50) / 5);
  const r = (lo: number, hi: number) => rng.int(lo, hi);
  const main = gift ? r(66, 82) : r(38, 62) + (martial ? Math.round(lift / 2) : lift);
  const ab = martial
    ? { tong: main, zheng: r(20, 45), mou: r(25, 55), wai: r(15, 40), wang: r(20, 40) }
    : { tong: r(15, 40), zheng: main, mou: r(30, 60), wai: r(30, 55), wang: r(25, 50) };
  const title = office ?? (martial ? MIL_TITLES[Math.floor(rng.next() * MIL_TITLES.length)] : CIVIL_TITLES[Math.floor(rng.next() * CIVIL_TITLES.length)]);
  const id = `gen${s.nextId++}`;
  const traits: TraitId[] = [];
  if (gift || rng.chance(0.3)) {
    const pool: TraitId[] = martial ? ['xiaoyong', 'shanshou', 'lianbing', 'zhimou'] : ['licai', 'tuntian', 'fumin', 'lianzheng', 'biancai'];
    traits.push(pool[Math.floor(rng.next() * pool.length)]);
  }
  if (rng.chance(0.08)) traits.push(martial ? 'kuli' : 'tan');
  const bio = office
    ? `${factionName(s, f)}所设${nodeName(node)}${office}，守土治民${gift ? '，颇有能名' : ''}。`
    : `${nodeName(node)}人，${title}${gift ? '，乡里称其才' : ''}。应${factionName(s, f)}之招出仕。`;
  return { id, name, faction: f, title, ab: { ...ab, tong: Math.min(90, ab.tong), zheng: Math.min(90, ab.zheng) }, att: { loyalty: r(65, 85), surrender: r(20, 45), hawk: r(-20, 50) },
    attLog: [], location: node, status: 'active', bio, traits, gen: true, female: false };
}

/** 招贤：本城花银延请一人；本城无主官则暂署主官 */
export function seekTalent(s: GameState, f: string, node: string, ref: string): Character {
  const c = s.cities[node];
  const rng = rngFor(s.seed, 'seek', s.turn, node, ref);
  bump(s, node, 'silver', -SEEK_SILVER, '招贤延请', { kind: 'order', turn: s.turn, ref });
  const ch = genLocal(s, f, node, rng, c.edu);
  s.chars[ch.id] = ch;
  s.flags['seek_' + node] = s.turn;
  const acting = !governorOf(s, c);
  if (acting) c.governor = ch.id;
  report(s, { cat: '人事', node, text: `${nodeName(node)}招贤：${ch.name}（${ch.title}）应招出仕${acting ? '，暂署本城主官' : ''}。${traitsOf(ch).length ? `长于${traitsOf(ch).map(t => TRAITS[t].name).join('、')}。` : ''}`, faction: f === s.player ? undefined : f });
  return ch;
}
export function seekError(s: GameState, f: string, node: string): string | null {
  const c = s.cities[node];
  if (!c || c.controller !== f) return '只能在自己的城招贤';
  const last = s.flags['seek_' + node];
  if (typeof last === 'number' && s.turn - last < SEEK_COOLDOWN) return `本城 ${SEEK_COOLDOWN - (s.turn - last)} 月后才能再招`;
  if (s.sieges[node]) return '城被围，无人应招';
  if (c.silver < SEEK_SILVER) return `府库银不足 ${SEEK_SILVER} 两`;
  return null;
}

/* ---------- 俘虏 ---------- */
/** 劝降俘虏的把握：降意、对旧主的忠诚、志节（主战而异朝者更难） */
export function prisonerChance(s: GameState, f: string, id: string): number { return prisonerOdds(s, f, id).p; }
/** 劝降俘虏的成算与其依据（供处置卡逐条写明） */
export function prisonerOdds(s: GameState, f: string, id: string): { p: number; factors: string[] } {
  const c = s.chars[id];
  if (!c) return { p: 0, factors: [] };
  const factors: string[] = ['底数 8%'];
  let p = 0.08 + c.att.surrender / 160 + (100 - c.att.loyalty) / 260;
  factors.push(`降意 ${Math.round(c.att.surrender)}（+${Math.round(c.att.surrender / 1.6)}%）`, `忠诚 ${Math.round(c.att.loyalty)}（+${Math.round((100 - c.att.loyalty) / 2.6)}%）`);
  const old = s.factions[c.faction], me = s.factions[f];
  if (old && me && old.polity !== me.polity && c.att.hawk > 50) { p -= 0.15; factors.push('主战且异朝，誓不相从 −15%'); }
  if (old && me && old.polity === me.polity) { p += 0.1; factors.push('同奉一朝 +10%'); }
  if (old?.leader === id) { p -= 0.2; factors.push('一方之主 −20%'); }
  const held = s.turn - (c.capturedAt ?? s.turn);
  if (held >= 6) factors.push(`在押 ${held} 月（每劝不成降意 +5）`);
  if (c.att.loyalty >= 95) { p = Math.min(p, 0.05); factors.push('忠贞不二，至多 5%'); }
  return { p: Math.max(0.02, Math.min(0.85, p)), factors };
}
/** 索赎之价：才高者价高；旧主治所府库须付得起 */
export const ransomOf = (c: GameState['chars'][string]) => Math.round((2000 + (c.ab.tong + c.ab.zheng + c.ab.mou + c.ab.wang) * 30) / 500) * 500;
export function ransomError(s: GameState, id: string): string | null {
  const c = s.chars[id];
  const home = c && s.factions[c.faction];
  if (!home || home.defunct) return '旧主已亡，无人来赎';
  const cap = s.cities[home.capital];
  if (!cap || cap.controller !== home.id || cap.silver < ransomOf(c)) return `${home.name}府库不足，赎不起`;
  return null;
}
export type PrisonerAct = 'recruit' | 'release' | 'execute' | 'ransom';
export function prisonerError(s: GameState, f: string, id: string): string | null {
  const c = s.chars[id];
  if (!c || c.status !== 'captured') return '此人不在押';
  if (c.captor !== f) return '此人不在我方手中';
  return null;
}
export function handlePrisoner(s: GameState, f: string, id: string, act: PrisonerAct, ref: string) {
  const c = s.chars[id];
  const old = c.faction;
  const mine = f === s.player || old === s.player;
  if (act === 'recruit') {
    const p = prisonerChance(s, f, id);
    const ok = rngFor(s.seed, 'prisoner', s.turn, id, ref).next() < p;
    if (ok) {
      c.faction = f; c.status = 'active'; delete c.captor;
      c.location = s.factions[f]?.capital ?? c.location;
      adjustAtt(s, id, 'loyalty', 55 - c.att.loyalty, `受${factionName(s, f)}劝降`);
      report(s, { cat: '人事', ok: true, node: c.location, text: `${c.name}受劝，归降${factionName(s, f)}，可以任用。（把握 ${Math.round(p * 100)}%）`, faction: mine ? undefined : f });
    } else {
      adjustAtt(s, id, 'surrender', 5, '久系思变');
      if (mine) report(s, { cat: '人事', ok: false, text: `劝降${c.name}，不从。（把握 ${Math.round(p * 100)}%；久系之后降意稍增）` });
    }
  } else if (act === 'ransom') {
    const err = ransomError(s, id);
    if (err) { if (mine) report(s, { cat: '人事', ok: false, text: `索赎${c.name}不成：${err}。仍在押。` }); return; }
    const price = ransomOf(c), home = s.factions[old], cap = s.factions[f]?.capital;
    bump(s, home.capital, 'silver', -price, `赎回${c.name}`, { kind: 'order', ref });
    if (cap && s.cities[cap]?.controller === f) bump(s, cap, 'silver', price, `${home.name}赎${c.name}`, { kind: 'order', ref });
    freeCaptive(s, c, old);
    report(s, { cat: '人事', ok: true, node: cap, text: `${home.name}出银 ${price} 两赎回${c.name}。`, faction: mine ? undefined : f });
  } else if (act === 'release') {
    freeCaptive(s, c, old);
    adjustAtt(s, id, 'hawk', -10, `${factionName(s, f)}以礼遣归`);
    for (const x of citiesOf(s, f)) if (x.minxin < 90) x.minxin += 1;
    report(s, { cat: '人事', node: c.location, text: `${factionName(s, f)}以礼遣归${c.name}，各城称其宽厚（民心 +1）。`, faction: mine ? undefined : f });
  } else {
    c.status = 'dead'; delete c.captor;
    for (const x of Object.values(s.chars)) if (x.status === 'active' && x.faction === old && x.id !== id) adjustAtt(s, x.id, 'hawk', 5, `${c.name}被杀，同仇`);
    for (const x of Object.values(s.chars)) if (x.status === 'active' && x.faction === f && x.att.hawk > 50) adjustAtt(s, x.id, 'loyalty', 1, `处斩${c.name}，以儆效尤`);
    report(s, { cat: '人事', text: `${factionName(s, f)}处斩${c.name}。${factionName(s, old)}上下同仇（主战 +5）。`, faction: mine ? undefined : f });
  }
}

/** 俘虏获释：原势力尚在则回其治所；原势力已亡则隐居乡里，半年后再出，另投他方 */
function freeCaptive(s: GameState, c: GameState['chars'][string], old: string) {
  const home = s.factions[old];
  delete c.captor;
  if (home && !home.defunct) { c.status = 'active'; c.location = s.cities[home.capital]?.controller === old ? home.capital : c.location; return; }
  c.status = 'offstage'; c.faction = ''; c.appear = s.turn + 6;
}

/** 电脑各家处置俘虏：每半年劝降一次，押满两年者遣归 */
export function aiPrisoners(s: GameState) {
  for (const c of Object.values(s.chars)) {
    if (c.status !== 'captured' || !c.captor || c.captor === s.player) continue;
    const f = c.captor;
    if (!s.factions[f] || s.factions[f].defunct) { freeCaptive(s, c, c.faction); continue; }
    const since = (c.capturedAt ?? s.turn);
    const held = s.turn - since;
    if (held > 0 && held % 6 === 0) handlePrisoner(s, f, c.id, 'recruit', 'ai' + s.turn);
    else if (held >= 24 && c.status === 'captured') handlePrisoner(s, f, c.id, 'release', 'ai' + s.turn);
  }
}

/** 电脑补派主官：闲人（不统兵、不任主官、非君主）派往空缺之城，大城先派、政务高者先用 */
export function aiAppoint(s: GameState, f: string) {
  const fac = s.factions[f];
  if (!fac) return;
  const busy = new Set<string>([...Object.values(s.armies).map(a => a.commander), ...Object.values(s.cities).filter(c => governorOf(s, c)).map(c => c.governor!), fac.leader]);
  const idle = Object.values(s.chars).filter(c => c.faction === f && c.status === 'active' && !busy.has(c.id) && !c.royal).sort((a, b) => b.ab.zheng - a.ab.zheng);
  const empty = citiesOf(s, f).filter(c => !governorOf(s, c)).sort((a, b) => b.pop - a.pop);
  for (const c of empty) {
    const g = idle.shift();
    if (!g) break;
    c.governor = g.id; g.location = c.id;
  }
  void topOf; void charName;
}

/** 电脑各家招贤：派完闲人仍有空缺、所在城府库有两倍招贤之资，每月在一至三座空城招贤（空缺越多招得越多） */
export function aiSeek(s: GameState, f: string) {
  const empty = citiesOf(s, f).filter(c => !governorOf(s, c) && !seekError(s, f, c.id) && c.silver >= SEEK_SILVER * 2).sort((a, b) => b.pop - a.pop);
  for (const c of empty.slice(0, empty.length > 12 ? 3 : empty.length > 6 ? 2 : 1)) seekTalent(s, f, c.id, 'ai');
}

/** 开局为“各省明官府”这类地方官署补齐守土之官：先派闲着的史实人物，余下府州由地方知府、知州、知县署理（按人口定官名） */
export function staffAdmin(s: GameState) {
  for (const fac of Object.values(s.factions)) {
    if (!fac.admin) continue;
    aiAppoint(s, fac.id);
    for (const c of citiesOf(s, fac.id)) {
      if (governorOf(s, c)) continue;
      const office = c.pop >= 50 ? '知府' : c.pop >= 25 ? '知州' : '知县';
      const ch = genLocal(s, fac.id, c.id, rngFor(s.seed, 'staff', c.id), c.edu, office);
      s.chars[ch.id] = ch;
      c.governor = ch.id;
    }
  }
}
