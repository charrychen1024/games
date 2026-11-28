/* 剧本最后一年（2026-11-28 审查：末十一月城池展望越过历法末端，展开粮银明细、进入募兵都会中断）。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { yearOutlook, cityForecast } from '../src/core/economy';
import { runMonthAuto } from '../src/core/turn';
import { TOTAL_TURNS } from '../src/core/calendar';
import { transitOf, etaText } from '../src/core/transit';

describe('最后一年', () => {
  for (const left of [12, 11, 2, 1]) it(`倒数第 ${left} 月：各城展望、预估、募兵与月结都不报错`, () => {
    const s = createGame('hongguang', 1);
    s.turn = TOTAL_TURNS - left;
    for (const c of Object.values(s.cities).filter(x => x.controller === 'hongguang')) {
      const o = yearOutlook(s, c);
      expect(o.months).toBeLessThanOrEqual(left);
      expect(() => cityForecast(s, c)).not.toThrow();
    }
    s.convoys = [{ id: 'cv', faction: 'hongguang', from: 'nanjing', to: 'wuchang', grain: 1, silver: 0, sent: s.turn, arrive: s.turn + 5, days: 150, path: [] }];
    expect(() => transitOf(s).map(t => etaText(s, t.eta))).not.toThrow();
    expect(() => runMonthAuto(s, [{ id: 'r', kind: 'recruit', node: 'nanjing', troops: 1000 }])).not.toThrow();
  }, 60000);
});
