/* 地图图层：势力（默认）、敌我、钱粮。只测分类逻辑，绘制在 map.ts。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { relationTone, frontEdge, cityStores, storeTier, LENSES } from '../src/render/lens';
import { setStance, citiesOf } from '../src/core/state';

describe('图层定义', () => {
  it('三种图层：势力、敌我、钱粮', () => {
    expect(LENSES.map(l => l.id)).toEqual(['faction', 'war', 'econ']);
    expect(LENSES.map(l => l.name)).toEqual(['势力', '敌我', '钱粮']);
  });
});

describe('敌我图层：按与我方的关系着色', () => {
  it('本方、同阵营、交战、停战、中立各有其色调', () => {
    const s = createGame('hongguang', 2);
    expect(relationTone(s, 'hongguang')).toBe('self');
    // 郑氏奉弘光：同阵营
    expect(relationTone(s, 'zheng')).toBe('ally');
    setStance(s, 'hongguang', 'qing', 'war');
    expect(relationTone(s, 'qing')).toBe('war');
    setStance(s, 'hongguang', 'shun', 'truce', s.turn + 6);
    expect(relationTone(s, 'shun')).toBe('truce');
    setStance(s, 'hongguang', 'xi', 'neutral');
    expect(relationTone(s, 'xi')).toBe('neutral');
  });
  it('玩家是下属时：自己的城为本方，宗主与同奉一主者为同阵营', () => {
    const s = createGame('zheng', 2);
    expect(relationTone(s, 'zheng')).toBe('self');
    expect(relationTone(s, 'hongguang')).toBe('ally');
  });
  it('前线：我方阵营与交战之敌相邻的边界；与中立之间不算', () => {
    const s = createGame('hongguang', 2);
    setStance(s, 'hongguang', 'qing', 'war');
    const mine = 'xuzhou';
    s.cities[mine].controller = 'hongguang';
    s.cities.jinan.controller = 'qing';
    expect(frontEdge(s, mine, 'jinan')).toBe(true);
    setStance(s, 'hongguang', 'qing', 'neutral');
    expect(frontEdge(s, mine, 'jinan')).toBe(false);
    // 同一方的两城不算前线
    expect(frontEdge(s, 'nanjing', 'yangzhou')).toBe(false);
  });
});

describe('钱粮图层：存粮、存银能撑几个月', () => {
  it('入不敷出的城按存量除以每月亏空算月数；有结余为无忧', () => {
    const s = createGame('hongguang', 2);
    for (const c of citiesOf(s, 'hongguang')) {
      const st = cityStores(s, c.id);
      expect(st.grainMonths).toBeGreaterThanOrEqual(0);
      expect(st.silverMonths).toBeGreaterThanOrEqual(0);
      if (st.grainNet >= 0) expect(st.grainMonths).toBe(Infinity);
      else expect(st.grainMonths).toBeCloseTo(c.grain / -st.grainNet, 5);
    }
  });
  it('驻军猛增则月数下降、色阶变差', () => {
    const s = createGame('hongguang', 2);
    const c = s.cities.nanjing;
    const before = cityStores(s, 'nanjing');
    c.garrison += 200000; c.silver = 20000; c.grain = 20000;
    const after = cityStores(s, 'nanjing');
    expect(after.worst).toBeLessThan(before.worst);
    expect(storeTier(after.worst)).toBe('crit');
  });
  it('色阶：一年以上无忧，半年以上尚可，三月以上吃紧，不足三月告急', () => {
    expect(storeTier(Infinity)).toBe('ample');
    expect(storeTier(12)).toBe('ample');
    expect(storeTier(8)).toBe('ok');
    expect(storeTier(4)).toBe('low');
    expect(storeTier(1)).toBe('crit');
  });
});
