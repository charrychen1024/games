/* 教育与人才：日后成名的人物到期出仕。
 * 乡里文教不振（低于 40）则推迟；文教高于 50，每高三点提早一月出仕（至多一年），出仕时多些政务历练；志在抗清者（主战 > 60）不仕清，改投就近的奉明势力，无处可投则隐居不出。
 * 文教高的城池每年给主官带来少许政务历练。 */
import type { GameState } from './types';
import { report, nodeName, citiesOf, adjustAtt } from './state';
import { distanceKm, NODE } from '../data/geography';
import { lunarOf } from './calendar';

/** 兴学之报：乡里文教每高出 50 三点，人才提早一月出仕，至多十二月 */
export const eduLead = (edu: number) => Math.max(0, Math.min(12, Math.floor((edu - 50) / 3)));
/** 出仕时的政务历练：文教每高出 50 十点加一，至多加三 */
export const eduBonus = (edu: number) => Math.max(0, Math.min(3, Math.floor((edu - 50) / 10)));

/** 储君：不作为人才出仕（由史事立嗣时登场） */
const HEIRS = new Set(['xuanye']);
/** 宗嗣：到期必出，不受乡里文教所限 */
const SCIONS = new Set(['zhengjing']);
/** 遗民：不仕清、不仕顺（与主战值无关），只投奉明之势力，无处可投则隐居 */
export const YIMIN = new Set(['fushan', 'sunqifeng', 'songyingxing', 'fangyizhi', 'weixi', 'quedajun', 'liyong']);

export function runTalent(s: GameState) {
  for (const c of Object.values(s.chars)) {
    if (c.status !== 'offstage' || c.appear === undefined || HEIRS.has(c.id)) continue;
    const home = s.cities[c.location];
    if (!home) continue;
    const lead = eduLead(home.edu);
    if (c.appear - lead > s.turn) continue;
    if (home.edu < 40 && !SCIONS.has(c.id)) continue; // 文教凋零，人才不出（宗嗣除外）
    let f = c.faction && s.factions[c.faction] && !s.factions[c.faction].defunct ? c.faction : home.controller;
    let fac = s.factions[f];
    const top = fac?.overlord && !s.factions[fac.overlord]?.defunct ? fac.overlord : f;
    if (!c.faction && (fac?.polity === 'qing' && (c.att.hawk > 60 || YIMIN.has(c.id)) || (YIMIN.has(c.id) && fac?.polity !== 'ming') || ['local', 'helan'].includes(f))) {
      // 不仕清：投就近奉明之势力
      const alt = Object.values(s.cities).filter(x => s.factions[x.controller]?.polity === 'ming' && !s.factions[x.controller].defunct)
        .sort((a, b) => distanceKm(NODE[a.id], NODE[c.location]) - distanceKm(NODE[b.id], NODE[c.location]))[0];
      if (!alt || distanceKm(NODE[alt.id], NODE[c.location]) > 900) continue;
      f = alt.controller; fac = s.factions[f];
    } else if (!c.faction) f = top;
    fac = s.factions[f];
    if (!fac || fac.defunct) continue;
    c.status = 'active';
    c.faction = f;
    const bonus = eduBonus(home.edu);
    if (bonus) c.ab.zheng = Math.min(95, c.ab.zheng + bonus);
    const early = Math.max(0, c.appear - s.turn);
    const near = citiesOf(s, f).sort((a, b) => distanceKm(NODE[a.id], NODE[c.location]) - distanceKm(NODE[b.id], NODE[c.location]))[0];
    if (near) c.location = near.id;
    report(s, { cat: '人事', urgent: false, node: c.location, text: `${c.name}出仕${fac.name}。${early ? `${nodeName(home.id)}文教兴盛，较常例早 ${early} 月。` : ''}${bonus ? `乡学有成，政务 +${bonus}。` : ''}${c.bio}`, faction: f === s.player || fac.overlord === s.player ? undefined : f });
  }
  // 正月：文教高的城池历练主官
  if (lunarOf(s.turn).month === 1 && !lunarOf(s.turn).leap) {
    for (const city of Object.values(s.cities)) {
      if (city.edu < 75 || !city.governor) continue;
      const g = s.chars[city.governor];
      if (!g || g.status !== 'active' || g.ab.zheng >= 85) continue;
      g.ab.zheng += 1;
      adjustAtt(s, g.id, 'loyalty', 1, `在${nodeName(city.id)}兴学`);
    }
  }
}
