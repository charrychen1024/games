/* 城市三业（2026-11-27 玩家：农业、商业、文教、人口虽有数值，作用感知不到，没有动力去经营）。
 * 农业定田粮与户口生息，七十“沃野”军屯省粮；商业定赋税与市面，七十“商贾辐辏”募兵省银、出兵多火器；
 * 文教定吏治所趋、士绅守节与招贤，七十“文风鼎盛”士人来投。经营先易后难，幕僚按处境荐方针。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { runEconomy, upkeepOf, RECRUIT_SILVER } from '../src/core/economy';
import { applyOrder, validateOrder, persuadeChance } from '../src/core/orders';
import { govEffects } from '../src/core/people';
import { neighbors } from '../src/data/geography';
import { migration, devStep, popGrowthRate, advisePolicy, scholarsArrive, policyOutlook, devTip, MILESTONE } from '../src/core/develop';

const game = () => createGame('hongguang', 1);

describe('经营先易后难', () => {
  it('四十以下每月 +2.5，七十以下 +1.5，七十以上 +0.75', () => {
    expect(devStep(30)).toBe(2.5);
    expect(devStep(55)).toBe(1.5);
    expect(devStep(75)).toBe(0.75);
  });
  it('通商方针按此增长，跨过七十有内政报告', () => {
    const s = game(); const c = s.cities.nanjing;
    c.policy = 'commerce'; c.commerce = 69; c.silver = 1e6;
    runEconomy(s);
    expect(c.commerce).toBeCloseTo(70.5);
    expect(s.reports.some(r => /商贾辐辏/.test(r.text))).toBe(true);
  });
});

describe('农业', () => {
  it('农业越高户口生息越快；民心不足五成不生息', () => {
    const s = game(); const c = { ...s.cities.nanjing, minxin: 60 };
    expect(popGrowthRate({ ...c, agri: 80 })).toBeGreaterThan(popGrowthRate({ ...c, agri: 30 }) * 1.5);
    expect(popGrowthRate({ ...c, minxin: 45 })).toBe(0);
  });
  it('“沃野”军屯：驻军口粮省二成', () => {
    const s = game(); const c = s.cities.nanjing;
    const own = (agri: number) => upkeepOf(s, { ...c, agri }).grain - upkeepOf(s, { ...c, agri, garrison: 0 }).grain;
    expect(own(70)).toBeCloseTo(own(60) * 0.8, -1);
  });
});

describe('流民', () => {
  it('被围之城百姓流亡，邻近安定富庶之城吸纳', () => {
    const s = game();
    const a = s.cities.yangzhou, nb = neighbors('yangzhou').map(x => s.cities[x.to]).filter(Boolean);
    s.sieges.yangzhou = { attacker: 'qing' } as any;
    for (const d of nb) { d.minxin = 40; delete s.sieges[d.id]; }
    const rich = nb[0]; rich.minxin = 80; rich.agri = 80; rich.commerce = 80;
    const p0 = a.pop, r0 = rich.pop;
    migration(s);
    expect(a.pop).toBeLessThan(p0);
    expect(rich.pop).toBeGreaterThan(r0);
    expect(rich.pop - r0).toBeLessThan(p0 - a.pop);
  });
});

describe('商业', () => {
  it('“商贾辐辏”募兵每人省一两', () => {
    const s = game(); const c = s.cities.nanjing; c.commerce = 80;
    const v0 = c.silver;
    applyOrder(s, 'hongguang', { id: 'r', kind: 'recruit', node: 'nanjing', troops: 1000 });
    expect(v0 - c.silver).toBe(1000 * (RECRUIT_SILVER - 1));
  });
  it('“商贾辐辏”之城出兵火器多一成', () => {
    const mk = (com: number) => {
      const s = game(); const c = s.cities.nanjing; c.commerce = com;
      const ch = Object.values(s.chars).find(x => x.faction === 'hongguang' && x.status === 'active' && x.id !== s.factions.hongguang.leader && !Object.values(s.armies).some(a => a.commander === x.id))!;
      const o = { id: 'x', kind: 'raise' as const, node: 'nanjing', troops: 3000, char: ch.id, navy: false };
      expect(validateOrder(s, 'hongguang', o)).toBeNull();
      applyOrder(s, 'hongguang', o);
      return Object.values(s.armies).find(a => a.commander === ch.id)!.mix.gun;
    };
    expect(mk(80) - mk(50)).toBeCloseTo(0.1);
  });
});

describe('文教', () => {
  it('文教高则主官所趋吏治高', () => {
    const s = game(); const c = s.cities.nanjing;
    c.edu = 90; const hi = govEffects(s, c).orderTarget!;
    c.edu = 30; const lo = govEffects(s, c).orderTarget!;
    expect(hi - lo).toBe(12);
  });
  it('士绅守节：文教高的城难被劝降', () => {
    const s = game();
    const env = Object.values(s.chars).find(x => x.faction === 'qing' && x.status === 'active')!;
    s.cities.nanjing.edu = 90; const hi = persuadeChance(s, 'qing', env.id, 'nanjing');
    s.cities.nanjing.edu = 20; const lo = persuadeChance(s, 'qing', env.id, 'nanjing');
    expect(lo.p).toBeGreaterThan(hi.p);
    expect(hi.factors.join()).toMatch(/守节/);
  });
  it('“文风鼎盛”：一年内士人来投，有报告', () => {
    const s = game(); s.cities.nanjing.edu = 85;
    const n0 = Object.keys(s.chars).length;
    for (let i = 0; i < 24; i++) { s.turn++; scholarsArrive(s); }
    expect(Object.keys(s.chars).length).toBeGreaterThan(n0);
    expect(s.reports.some(r => /闻风来投/.test(r.text))).toBe(true);
  });
});

describe('引导', () => {
  it('幕僚建议：民心低先赈济；差几点到名城就补齐', () => {
    const s = game(); const c = s.cities.nanjing;
    expect(advisePolicy(s, { ...c, minxin: 20 }).policy).toBe('relief');
    expect(advisePolicy(s, { ...c, minxin: 60, wall: 90, agri: 64, commerce: 40 }).policy).toBe('agri');
  });
  it('方针卡写明一年之效与何时成名城；提示写明下一阶', () => {
    const s = game(); const c = { ...s.cities.nanjing, commerce: 50 };
    expect(policyOutlook(s, c, 'commerce')).toMatch(/赋税每月约 \+\d+ 两.*成“商贾辐辏”/);
    expect(devTip(s, c, 'commerce')).toMatch(new RegExp(`再升 ${MILESTONE - 50} 点`));
  });
});
