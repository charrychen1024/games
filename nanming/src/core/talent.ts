/* 教育与人才：日后成名的人物到期出仕。
 * 乡里文教不振（低于 40）则推迟；志在抗清者（主战 > 60）不仕清，改投就近的奉明势力，无处可投则隐居不出。
 * 文教高的城池每年给主官带来少许政务历练。 */
import type { GameState } from './types';
import { report, nodeName, citiesOf, adjustAtt } from './state';
import { distanceKm, NODE } from '../data/geography';
import { lunarOf } from './calendar';

export function runTalent(s: GameState) {
  for (const c of Object.values(s.chars)) {
    if (c.status !== 'offstage' || c.appear === undefined || c.appear > s.turn) continue;
    const home = s.cities[c.location];
    if (!home) continue;
    if (home.edu < 40) continue; // 文教凋零，人才不出
    let f = c.faction && s.factions[c.faction] && !s.factions[c.faction].defunct ? c.faction : home.controller;
    let fac = s.factions[f];
    const top = fac?.overlord && !s.factions[fac.overlord]?.defunct ? fac.overlord : f;
    if (!c.faction && (fac?.polity === 'qing' && c.att.hawk > 60 || ['local', 'helan'].includes(f))) {
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
    const near = citiesOf(s, f).sort((a, b) => distanceKm(NODE[a.id], NODE[c.location]) - distanceKm(NODE[b.id], NODE[c.location]))[0];
    if (near) c.location = near.id;
    report(s, { cat: '人事', urgent: false, node: c.location, text: `${c.name}出仕${fac.name}。${c.bio}`, faction: f === s.player || fac.overlord === s.player ? undefined : f });
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
