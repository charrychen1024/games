/* 城市三业：农业、商业、文教各有其用，玩家能看见、也值得经营。
 * 一、连续之效：
 *   农业——田粮多寡；户口生息快慢（民心五成以上才生息，农业越高越快）。
 *   商业——赋税多寡；市面能容多少粮；
 *   文教——招贤所得之才；主官整饬吏治能到多高（文教每高五点，吏治所趋 +1）；
 *          士绅守节：文教高的城难被劝降，低的城易被劝降。
 * 二、七十为名城之阶（各给一项显著之利，让不同的城走不同的路）：
 *   农业七十“沃野”——军屯：驻军口粮省二成；
 *   商业七十“商贾辐辏”——募兵每人省一两，本城出兵火器多一成；
 *   文教七十“文风鼎盛”——士人闻风来投（每半年约一半机会，来者多能吏）。
 * 三、经营先易后难：四十以下每月 +2.5，七十以下 +1.5，七十以上 +0.75（战乱残破之城整顿见效快）。
 * 四、幕僚建议：按本城处境荐一项方针，玩家可不从。 */
import type { City, GameState, Policy } from './types';
import { bump, report, nodeName, hostile, citiesOf } from './state';
import { neighbors } from '../data/geography';
import { genLocal, governorOf, govEffects } from './people';
import { rngFor } from './rng';

export type DevKey = 'agri' | 'commerce' | 'edu';
export const DEV_NAME: Record<DevKey, string> = { agri: '农业', commerce: '商业', edu: '文教' };
export const MILESTONE = 70;
export const MILESTONE_NAME: Record<DevKey, string> = { agri: '沃野', commerce: '商贾辐辏', edu: '文风鼎盛' };
export const MILESTONE_DESC: Record<DevKey, string> = {
  agri: '军屯：驻军口粮省二成',
  commerce: '募兵每人省一两，本城出兵火器多一成',
  edu: '士人闻风来投（各城之中文教最高者，每半年约一半机会）',
};
export const reached = (c: City, k: DevKey) => c[k] >= MILESTONE;

/** 方针每月所增：先易后难 */
export const devStep = (v: number) => v < 40 ? 2.5 : v < MILESTONE ? 1.5 : 0.75;

/** 户口月增率：民心五成以上才生息；农业、商业越高越快（农商各 50 约年增 2.3%，各 90 约年增 3.7%） */
export const popGrowthRate = (c: City) => c.minxin >= 50 ? 0.0004 + c.agri / 100 * 0.002 + c.commerce / 100 * 0.001 : 0;
/** 军屯：沃野之城驻军口粮之比 */
export const garrisonGrainMul = (c: City) => reached(c, 'agri') ? 0.8 : 1;
/** 募兵每人所费（两） */
export const recruitSilverOf = (c: City, base: number) => base - (reached(c, 'commerce') ? 1 : 0);
/** 本城出兵多出的火器比例 */
export const gunBonusOf = (c: City) => reached(c, 'commerce') ? 0.1 : 0;
/** 文教对主官所趋吏治的加减 */
export const eduOrderPull = (c: City) => Math.round((c.edu - 50) / 5);
/** 士绅守节：劝降成算的加减（文教高则减，低则增；±10%） */
export const eduSteadfast = (c: City) => Math.max(-0.1, Math.min(0.1, (50 - c.edu) / 250));

/** 某一业对本城的现效与下一阶，供面板提示 */
export function devTip(s: GameState, c: City, k: DevKey): string {
  const v = Math.round(c[k]);
  const ge = govEffects(s, c);
  const lines: string[] = [];
  if (k === 'agri') {
    const g = Math.round(c.pop * 0.01 * (0.55 + c.minxin / 220) * 260 * ge.grainMul);
    lines.push(`田粮：每点约 ${g} 石/月（秋收更多）`);
    const r = popGrowthRate(c);
    lines.push(r > 0 ? `户口：年增约 ${(r * 1200).toFixed(1)}%` : '户口：民心不足五成，不生息');
  } else if (k === 'commerce') {
    const sv = Math.round(c.pop * 0.01 * (0.5 + c.order / 100) * 160 * ge.silverMul);
    lines.push(`赋税：每点约 ${sv} 两/月${c.trade ? '，另增海贸' : ''}`);
    lines.push('户口：商旅聚集，生息更快');
    lines.push('市面：越盛能籴粜越多');
    if (c.pop < 15) lines.push(`本城只有 ${Math.round(c.pop)} 万口，商业再高赋税也有限，先劝农、安民以增户口`);
  } else {
    lines.push(`吏治：主官所趋 ${eduOrderPull(c) >= 0 ? '+' : ''}${eduOrderPull(c)}`);
    const st = eduSteadfast(c);
    lines.push(st < 0 ? `士绅守节：敌来劝降 −${Math.round(-st * 100)}%` : st > 0 ? `士风浮薄：敌来劝降 +${Math.round(st * 100)}%` : '士风：平常');
    lines.push('招贤：文教越高，来者越能');
  }
  const head = `${DEV_NAME[k]} ${v}`;
  const ms = reached(c, k) ? `【${MILESTONE_NAME[k]}】${MILESTONE_DESC[k]}` : `再升 ${MILESTONE - v} 点成“${MILESTONE_NAME[k]}”：${MILESTONE_DESC[k]}`;
  return [head, ...lines, ms, `方针每月 +${devStep(c[k])}`].join(' · ');
}

/** 方针一年之效（按每月所增推算）：供方针卡写明回报 */
export function policyOutlook(s: GameState, c: City, p: Policy): string | null {
  const ge = govEffects(s, c);
  const key: DevKey | null = p === 'agri' ? 'agri' : p === 'commerce' ? 'commerce' : p === 'edu' ? 'edu' : null;
  if (!key) return null;
  let v = c[key], hit = 0;
  for (let m = 1; m <= 12; m++) { const was = v; v = Math.min(100, v + devStep(v)); if (!hit && was < MILESTONE && v >= MILESTONE) hit = m; }
  const d = v - c[key];
  const tail = reached(c, key) ? '' : hit ? `，第 ${hit} 月成“${MILESTONE_NAME[key]}”` : `，成“${MILESTONE_NAME[key]}”尚需一年以上`;
  if (key === 'agri') return `一年后农业 ${Math.round(v)}，田粮每月约 +${Math.round(c.pop * d / 100 * (0.55 + c.minxin / 220) * 260 * ge.grainMul)} 石${tail}`;
  if (key === 'commerce') return `一年后商业 ${Math.round(v)}，赋税每月约 +${Math.round(c.pop * d / 100 * (0.5 + c.order / 100) * 160 * ge.silverMul + (c.trade ? c.trade * 26 * d : 0))} 两${tail}`;
  return `一年后文教 ${Math.round(v)}，吏治所趋 +${Math.round((v - 50) / 5) - eduOrderPull(c)}${tail}`;
}

const frontier = (s: GameState, c: City) => neighbors(c.id).some(n => { const o = s.cities[n.to]; return o && hostile(s, c.controller, o.controller); })
  || Object.values(s.armies).some(a => hostile(s, c.controller, a.faction) && (a.location === c.id || neighbors(c.id).some(n => n.to === a.location)));

/** 幕僚建议：按本城处境荐一项方针 */
export function advisePolicy(s: GameState, c: City): { policy: Policy; why: string } {
  if (c.minxin < 35) return { policy: 'relief', why: `民心只剩 ${Math.round(c.minxin)}，赋税收不上来、户口不生息，宜先赈济` };
  if (frontier(s, c) && c.wall < 60) return { policy: 'fortify', why: `敌境相接而城防只有 ${Math.round(c.wall)}，宜整军修城` };
  const near = (k: DevKey) => c[k] < MILESTONE && c[k] >= MILESTONE - 12;
  if (near('agri')) return { policy: 'agri', why: `农业距“沃野”只差 ${Math.ceil(MILESTONE - c.agri)} 点，成后驻军口粮省二成` };
  if (near('commerce')) return { policy: 'commerce', why: `商业距“商贾辐辏”只差 ${Math.ceil(MILESTONE - c.commerce)} 点，成后募兵省银、出兵多火器` };
  if (c.pop < 15 && c.agri < MILESTONE) return { policy: 'agri', why: `本城只有 ${Math.round(c.pop)} 万口，赋税田粮都按人口计；先劝农，户口生息快、田粮也多` };
  if (c.trade && c.commerce < MILESTONE) return { policy: 'commerce', why: '港口之城，商业兼增海贸，通商最划算' };
  if (frontier(s, c) && c.agri < MILESTONE) return { policy: 'agri', why: '边城驻军多，劝农既增田粮，成“沃野”后军屯省粮' };
  if (near('edu')) return { policy: 'edu', why: `文教距“文风鼎盛”只差 ${Math.ceil(MILESTONE - c.edu)} 点，成后士人来投` };
  const low = (['commerce', 'agri'] as DevKey[]).sort((a, b) => c[a] - c[b])[0];
  if (c[low] < MILESTONE) return { policy: low, why: `${DEV_NAME[low]}只有 ${Math.round(c[low])}，起点低则见效快（每月 +${devStep(c[low])}）` };
  if (c.edu < MILESTONE) return { policy: 'edu', why: '农商俱盛，可以兴学，养士储才' };
  return { policy: 'balanced', why: '三业俱盛，按常例征收即可' };
}

/** 方针升了一业之后：跨过七十则报捷 */
export function noteMilestone(s: GameState, c: City, k: DevKey, before: number) {
  if (before < MILESTONE && c[k] >= MILESTONE && c.controller === s.player)
    report(s, { cat: '内政', node: c.id, text: `${nodeName(c.id)}${DEV_NAME[k]}至七十，号称“${MILESTONE_NAME[k]}”：${MILESTONE_DESC[k]}。`, src: { kind: 'policy', ref: k } });
}

/** 每月：文风鼎盛之城士人来投。每家每半年至多一人（文教最高之城居先），每月约六分之一机会 */
export function scholarsArrive(s: GameState) {
  for (const f of Object.values(s.factions)) {
    if (f.defunct) continue;
    const k = 'scholar_' + f.id, last = s.flags[k];
    if (typeof last === 'number' && s.turn - last < 6) continue;
    const c = citiesOf(s, f.id).filter(x => reached(x, 'edu') && !s.sieges[x.id]).sort((a, b) => b.edu - a.edu)[0];
    if (!c) continue;
    const rng = rngFor(s.seed, 'scholar', s.turn, f.id);
    if (!rng.chance(1 / 6)) continue;
    s.flags[k] = s.turn;
    const ch = genLocal(s, f.id, c.id, rng, Math.max(c.edu, 75));
    s.chars[ch.id] = ch;
    const acting = !governorOf(s, c);
    if (acting) c.governor = ch.id;
    if (f.id === s.player) report(s, { cat: '人事', node: c.id, text: `${nodeName(c.id)}文风鼎盛，${ch.title}${ch.name}闻风来投（${ch.ab.zheng >= ch.ab.tong ? `政务 ${ch.ab.zheng}` : `统军 ${ch.ab.tong}`}）${acting ? '，暂署本城主官' : '，可任命到缺官之城'}。`, src: { kind: 'policy', ref: 'edu' } });
  }
}

/** 户口生息（取代旧的一律千分之一） */
export function popGrowth(s: GameState, c: City) {
  const r = popGrowthRate(c);
  if (r > 0 && !s.sieges[c.id]) bump(s, c.id, 'pop', Math.round(c.pop * r * 10000) / 10000, `生息（农业 ${Math.round(c.agri)}）`, { kind: 'income' });
}

/** 流民：被围或民心不足三成之城，百姓逃亡；邻近民心五成五以上、未被围之城按农商吸纳七成，余者流散。
 * 人口是赋税、田粮、募兵的根本：安民、劝农、通商之城会把四邻的流民吸过来。 */
export function migration(s: GameState) {
  const moves: { from: City; n: number; why: string }[] = [];
  for (const c of Object.values(s.cities)) {
    if (c.pop <= 2) continue;
    const rate = s.sieges[c.id] ? 0.006 : c.minxin < 30 ? 0.004 : 0;
    if (rate) moves.push({ from: c, n: Math.round(c.pop * rate * 100) / 100, why: s.sieges[c.id] ? '城被围，百姓流亡' : '民心离散，百姓流亡' });
  }
  for (const { from, n, why } of moves) {
    if (n < 0.01) continue;
    bump(s, from.id, 'pop', -n, why, { kind: 'income' });
    const dests = neighbors(from.id).map(x => s.cities[x.to]).filter(d => d && d.minxin >= 55 && !s.sieges[d.id]);
    const w = (d: City) => (d.agri + d.commerce) / 100 * (d.minxin - 50) / 50;
    const W = dests.reduce((m, d) => m + w(d), 0);
    if (W <= 0) continue;
    for (const d of dests) {
      const got = Math.round(n * 0.7 * w(d) / W * 100) / 100;
      if (got > 0) bump(s, d.id, 'pop', got, `流民来归（自${nodeName(from.id)}）`, { kind: 'income' });
    }
  }
}

/** 人口与赋税之所由来：供面板提示 */
export function popTip(s: GameState, c: City): string {
  const ge = govEffects(s, c);
  const mx = c.minxin >= 40 ? 1 : 0.5 + c.minxin / 80;
  const tax = Math.round(c.pop * (c.commerce / 100) * (0.5 + c.order / 100) * 160 * ge.silverMul * mx);
  const r = popGrowthRate(c);
  return [`人口 ${Math.round(c.pop * 10) / 10} 万口：赋税、田粮、募兵名额都按人口计`,
    `赋税 ≈ 人口 ${Math.round(c.pop)} × 商业 ${Math.round(c.commerce)}% × 吏治 ×${(0.5 + c.order / 100).toFixed(2)} × 主官 ×${ge.silverMul.toFixed(2)}${mx < 1 ? ` × 民心 ×${mx.toFixed(2)}` : ''} × 160 ≈ ${tax} 两/月`,
    r > 0 ? `户口年增约 ${(r * 1200).toFixed(1)}%（农业、商业越高越快）` : '民心不足五成，户口不生息',
    '民心五成五以上之城，还会吸纳四邻被围、民心离散之城的流民'].join(' · ');
}
