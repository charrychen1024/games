/* 围城威慑与分兵（2026-11-27）：城外兵力越压倒，守军越动摇；各军可分攻、围；界面看得见兵力之比。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { siegeAwe, updateSieges, buildSiegeBattle } from '../src/core/military';
import { persuadeChance } from '../src/core/orders';
import type { GameState } from '../src/core/types';
import { setStance } from '../src/core/state';

/** 清军若干支围扬州：守军 n，城外每支 per 人 */
function setup(garrison: number, armies: { troops: number; assault: boolean }[]): GameState {
  const s = createGame('qing', 7);
  setStance(s, 'qing', 'hongguang', 'war');
  const c = s.cities.yangzhou;
  c.garrison = garrison;
  const base = Object.values(s.armies).find(a => a.faction === 'qing')!;
  armies.forEach((o, i) => {
    const id = 'a_t' + i;
    s.armies[id] = { ...JSON.parse(JSON.stringify(base)), id, name: '测试' + i + '营', troops: o.troops, location: 'yangzhou', path: [], progress: 0, order: { kind: 'siege', target: 'yangzhou', assault: o.assault } };
  });
  for (const a of Object.values(s.armies)) if (a.location === 'yangzhou' && !a.id.startsWith('a_t')) a.location = 'xuzhou';
  return s;
}

describe('威慑随兵力之比渐增', () => {
  it('兵力比越大，各项威慑越重；不足一倍时没有', () => {
    const s1 = setup(10000, [{ troops: 8000, assault: false }]);
    const s5 = setup(10000, [{ troops: 50000, assault: false }]);
    updateSieges(s1); updateSieges(s5);
    const a1 = siegeAwe(s1, 'yangzhou'), a5 = siegeAwe(s5, 'yangzhou');
    expect(a1.ratio).toBeCloseTo(0.8, 1);
    expect(a1.minxin + a1.desert + a1.persuade + a1.morale + a1.early).toBe(0);
    expect(a5.ratio).toBeGreaterThanOrEqual(5); expect(a5.ratio).toBeLessThan(6);   // 本月已有守军逃散，比值略升
    expect(a5.minxin).toBeGreaterThan(0); expect(a5.desert).toBeGreaterThan(0); expect(a5.persuade).toBeGreaterThan(0.1); expect(a5.morale).toBeGreaterThan(8); expect(a5.early).toBeGreaterThan(0);
  });
  it('重兵围城：守军逐月逃散、民心浮动，并写进军情', () => {
    const s = setup(10000, [{ troops: 60000, assault: false }]);
    const m0 = s.cities.yangzhou.minxin;
    updateSieges(s);
    expect(s.cities.yangzhou.garrison).toBeLessThan(10000);
    expect(s.cities.yangzhou.minxin).toBeLessThan(m0);
    expect(s.reports.some(r => r.node === 'yangzhou' && /逃散|夜缒/.test(r.text))).toBe(true);
  });
  it('劝降加成按兵力之比，不再是一道门槛', () => {
    const lo = persuadeChance(setup(10000, [{ troops: 25000, assault: false }]), 'qing', 'hongchengchou', 'yangzhou');
    const hi = persuadeChance(setup(10000, [{ troops: 80000, assault: false }]), 'qing', 'hongchengchou', 'yangzhou');
    expect(hi.p).toBeGreaterThan(lo.p);
    expect(hi.factors.some(f => /兵力.*比/.test(f))).toBe(true);
  });
  it('兵力悬殊时守将可能未战先降或弃城（多个种子里总有发生）', () => {
    let fell = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = setup(4000, [{ troops: 60000, assault: false }]);
      s.seed = seed;
      for (let m = 0; m < 4 && s.cities.yangzhou.controller !== 'qing'; m++) { s.turn++; updateSieges(s); }
      if (s.cities.yangzhou.controller === 'qing') fell++;
    }
    expect(fell).toBeGreaterThan(0);
    expect(fell).toBeLessThan(30);
  });
});

describe('分兵：攻者攻、围者围', () => {
  it('攻城战只带下令攻城的军队，围困之军留在城外', () => {
    const s = setup(10000, [{ troops: 20000, assault: true }, { troops: 30000, assault: false }]);
    updateSieges(s);
    const b = buildSiegeBattle(s, 'yangzhou')!;
    expect(b.att.armies).toEqual(['a_t0']);
  });
  it('开战时守军士气随兵力之比降低（围城之军也算威慑）', () => {
    const lone = setup(10000, [{ troops: 20000, assault: true }]);
    const backed = setup(10000, [{ troops: 20000, assault: true }, { troops: 40000, assault: false }]);
    updateSieges(lone); updateSieges(backed);
    lone.cities.yangzhou.garrison = backed.cities.yangzhou.garrison = 10000;
    expect(buildSiegeBattle(backed, 'yangzhou')!.def.lanes[0].morale).toBeLessThan(buildSiegeBattle(lone, 'yangzhou')!.def.lanes[0].morale);
  });
});
