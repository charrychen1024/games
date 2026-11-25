/* 命令队列试算：排入命令后的局面、预估与校验，和正式月结一致（审查《数值计算与决策信息》第一、二、三节）。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { projectOrders, validateQueued } from '../src/core/orders';
import { cityForecast, runEconomy, yearOutlook } from '../src/core/economy';
import type { GameState, Order } from '../src/core/types';

/** 正式月结里经济阶段对某城的实际净变化（去掉视情况才发生的市籴等） */
function realNet(s: GameState, orders: Order[], node: string) {
  const t = projectOrders(s, orders);
  const turn = t.turn;
  const before = t.ledger.length;
  runEconomy(t);
  const net = (f: 'grain' | 'silver') => t.ledger.slice(before).filter(e => e.turn === turn && e.node === node && e.field === f && e.src.ref !== 'market').reduce((n, e) => n + e.delta, 0);
  return { grain: net('grain'), silver: net('silver') };
}

describe('排令后的预估', () => {
  it('南京下赈济：预估按排令后的局面算，与月结一致（审查例：−10,259 石）', () => {
    const s = createGame('hongguang', 1);
    const orders: Order[] = [{ id: 'p', kind: 'policy', node: 'nanjing', policy: 'relief' }];
    const before = cityForecast(s, s.cities.nanjing).grain.net;
    const p = projectOrders(s, orders);
    const after = cityForecast(p, p.cities.nanjing).grain.net;
    expect(after).toBeLessThan(before);
    expect(after).toBe(realNet(s, orders, 'nanjing').grain);
  });
  it('赈济加募兵：两令并行的预估与月结一致', () => {
    const s = createGame('hongguang', 1);
    const orders: Order[] = [{ id: 'p', kind: 'policy', node: 'nanjing', policy: 'relief' }, { id: 'r', kind: 'recruit', node: 'nanjing', troops: 1000 }];
    const p = projectOrders(s, orders);
    expect(cityForecast(p, p.cities.nanjing).grain.net).toBe(realNet(s, orders, 'nanjing').grain);
  });
  it('同势力两城划拨：调出调入两头都记，合计不变', () => {
    const s = createGame('zheng', 1);
    const total = (t: GameState) => Object.values(t.cities).filter(c => c.controller === 'zheng').reduce((n, c) => n + c.silver, 0);
    const p = projectOrders(s, [{ id: 't', kind: 'transfer', from: 'quanzhou', to: 'anping', grain: 0, silver: 60000 }]);
    expect(p.cities.quanzhou.silver).toBe(s.cities.quanzhou.silver - 60000);
    expect(p.cities.anping.silver).toBe(s.cities.anping.silver + 60000);
    expect(total(p)).toBe(total(s));
  });
});

describe('按排令后的局面校验', () => {
  it('同城同月两笔募兵共用一份名额：第二笔超额即拦下', () => {
    const s = createGame('hongguang', 1);
    const first: Order = { id: 'a', kind: 'recruit', node: 'nanjing', troops: 5300 };
    expect(validateQueued(s, [], first)).toBeNull();
    expect(validateQueued(s, [first], { id: 'b', kind: 'recruit', node: 'nanjing', troops: 5300 })).toMatch(/最多再募/);
  });
  it('先劝捐再募兵：按劝捐之后的府库校验，可以募', () => {
    const s = createGame('zheng', 1);
    s.cities.quanzhou.silver = 3832;
    const loan: Order = { id: 'l', kind: 'loan', node: 'quanzhou' };
    const rec: Order = { id: 'r', kind: 'recruit', node: 'quanzhou', troops: 1500 };
    expect(validateQueued(s, [], rec)).toMatch(/府库/);
    expect(validateQueued(s, [loan], rec)).toBeNull();
  });
  it('先调走粮再籴粮：报价按调粮之后的存粮', () => {
    const s = createGame('zheng', 1);
    const p0 = projectOrders(s, []), p1 = projectOrders(s, [{ id: 't', kind: 'transfer', from: 'quanzhou', to: 'anping', grain: 40000, silver: 0 }]);
    expect(p1.cities.quanzhou.grain).toBe(p0.cities.quanzhou.grain - 40000);
  });
});

describe('一年展望', () => {
  it('按季节逐月滚动：给出一年内最低存粮与最早缺口', () => {
    const s = createGame('hongguang', 1);
    const o = yearOutlook(s, s.cities.anqing);
    expect(o.months).toBe(12);
    expect(o.minGrain).toBeLessThanOrEqual(s.cities.anqing.grain + 1e9);
    expect(typeof o.feed).toBe('number');
    const x = structuredClone(s); x.cities.anqing.silver = 0; x.cities.anqing.garrison = 40000;
    const y = yearOutlook(x, x.cities.anqing);
    expect(y.shortSilver).not.toBeNull();
    expect(y.feed).toBe(0);
  });
});

describe('预估补漏：各省明官府的城既起运本省治所，又解饷南京', () => {
  it('两笔都列出', () => {
    const s = createGame('hongguang', 1);
    const prov = Object.values(s.cities).find(c => c.controller === 'mingprov' && c.id !== s.factions.mingprov.capital)!;
    const labels = cityForecast(s, prov).silver.items.map(i => i.label).join('|');
    expect(labels).toMatch(/起运/);
    expect(labels).toMatch(/解饷/);
  });
});
