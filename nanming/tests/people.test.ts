/* 人物：特长、主官对城池的影响、招贤（地方人物）、俘虏的处置、电脑补派主官。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { traitsOf, govEffects, governorDrift, genLocal, SEEK_SILVER, SEEK_COOLDOWN, prisonerChance, aiAppoint, TRAITS } from '../src/core/people';
import { monthlyIncome } from '../src/core/economy';
import { validateOrder, applyOrder } from '../src/core/orders';
import { captureChar } from '../src/core/military';
import { makeRng } from '../src/core/rng';
import { citiesOf } from '../src/core/state';

const idleOf = (s: ReturnType<typeof createGame>, f: string) => Object.values(s.chars).find(c => c.faction === f && c.status === 'active' && !Object.values(s.cities).some(x => x.governor === c.id) && !Object.values(s.armies).some(a => a.commander === c.id) && s.factions[f].leader !== c.id)!;

describe('特长', () => {
  it('名臣有据史而定的特长，其余按能力推出，同一人每次相同', () => {
    const s = createGame('hongguang', 1);
    expect(traitsOf(s.chars.shikefa)).toContain('lianzheng');
    expect(traitsOf(s.chars.mashiying)).toContain('tan');
    const all = Object.values(s.chars);
    const withT = all.filter(c => traitsOf(c).length > 0);
    expect(withT.length).toBeGreaterThan(all.length * 0.4);
    for (const c of all) expect(traitsOf(c)).toEqual(traitsOf(c));
    for (const c of all) for (const t of traitsOf(c)) expect(TRAITS[t]).toBeTruthy();
  });
  it('主官的特长改变本城赋税、田粮', () => {
    const s = createGame('hongguang', 1);
    const c = s.cities.suzhou;
    const g = idleOf(s, 'hongguang');
    c.governor = g.id; g.location = c.id;
    g.traits = [];
    const base = monthlyIncome(s, c);
    g.traits = ['licai'];
    expect(monthlyIncome(s, c).silver).toBeGreaterThan(base.silver * 1.08);
    g.traits = ['tuntian'];
    expect(monthlyIncome(s, c).grain).toBeGreaterThan(base.grain * 1.08);
    g.traits = ['tan'];
    expect(monthlyIncome(s, c).silver).toBeLessThan(base.silver);
  });
});

describe('主官治城：吏治、民心、城防逐月趋向主官所能', () => {
  it('能吏使吏治上升；无主官之城不变', () => {
    const s = createGame('hongguang', 1);
    const a = s.cities.suzhou, b = s.cities.changzhou;
    const g = idleOf(s, 'hongguang'); g.ab.zheng = 85; g.traits = [];
    a.governor = g.id; a.order = 40; b.governor = undefined; b.order = 40;
    governorDrift(s);
    expect(a.order).toBe(41);
    expect(b.order).toBe(40);
    expect(govEffects(s, a).orderTarget).toBeGreaterThan(60);
  });
  it('威望高、抚民者使民心上升；善守者修城', () => {
    const s = createGame('hongguang', 1);
    const c = s.cities.suzhou;
    const g = idleOf(s, 'hongguang'); g.ab.wang = 85; g.traits = ['fumin', 'shanshou'];
    c.governor = g.id; c.minxin = 40; c.wall = 30;
    governorDrift(s);
    expect(c.minxin).toBeGreaterThan(40);
    expect(c.wall).toBeGreaterThan(30);
  });
});

describe('招贤：招来地方人物', () => {
  it('地方人物有名有姓、有出身，文教高处多出能吏', () => {
    const s = createGame('hongguang', 1);
    const r = makeRng(5);
    const lo = Array.from({ length: 60 }, () => genLocal(s, 'hongguang', 'suzhou', r, 30));
    const hi = Array.from({ length: 60 }, () => genLocal(s, 'hongguang', 'suzhou', r, 90));
    const avg = (l: typeof lo) => l.reduce((n, c) => n + Math.max(c.ab.zheng, c.ab.tong), 0) / l.length;
    expect(avg(hi)).toBeGreaterThan(avg(lo) + 4);
    for (const c of [...lo, ...hi]) { expect(c.name.length).toBeGreaterThanOrEqual(2); expect(c.gen).toBe(true); expect(c.bio).toMatch(/苏州/); }
    expect(new Set([...lo, ...hi].map(c => c.name)).size).toBe(120);
  });
  it('下令招贤：花银、出一人，本城无主官则暂署；半年内同城不能再招', () => {
    const s = createGame('hongguang', 1);
    const c = s.cities.changzhou; c.governor = undefined; c.silver = 50000;
    const n0 = Object.keys(s.chars).length;
    const o = { id: 'k1', kind: 'seek' as const, node: 'changzhou' };
    expect(validateOrder(s, 'hongguang', o)).toBeNull();
    applyOrder(s, 'hongguang', o);
    expect(Object.keys(s.chars).length).toBe(n0 + 1);
    const got = Object.values(s.chars).find(x => x.gen)!;
    expect(got.faction).toBe('hongguang');
    expect(got.status).toBe('active');
    expect(c.governor).toBe(got.id);
    expect(c.silver).toBe(50000 - SEEK_SILVER);
    expect(validateOrder(s, 'hongguang', { id: 'k2', kind: 'seek', node: 'changzhou' })).toMatch(/月/);
    s.turn += SEEK_COOLDOWN;
    expect(validateOrder(s, 'hongguang', { id: 'k3', kind: 'seek', node: 'changzhou' })).toBeNull();
    c.silver = 100;
    expect(validateOrder(s, 'hongguang', { id: 'k4', kind: 'seek', node: 'changzhou' })).toMatch(/银/);
  });
});

describe('俘虏', () => {
  it('被俘者记下为谁所执；只有执者能处置', () => {
    const s = createGame('hongguang', 1);
    const foe = Object.values(s.chars).find(c => c.faction === 'shun' && c.status === 'active' && s.factions.shun.leader !== c.id)!;
    captureChar(s, foe.id, 'hongguang', '兵败');
    expect(foe.captor).toBe('hongguang');
    expect(validateOrder(s, 'hongguang', { id: 'p', kind: 'prisoner', char: foe.id, act: 'execute' })).toBeNull();
    expect(validateOrder(s, 'qing', { id: 'p', kind: 'prisoner', char: foe.id, act: 'execute' })).toBeTruthy();
  });
  it('劝降成败看忠诚、降意与志节；成则改投、可任用', () => {
    let ok = 0, fail = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame('hongguang', seed);
      const foe = Object.values(s.chars).find(c => c.faction === 'shun' && c.status === 'active' && s.factions.shun.leader !== c.id)!;
      captureChar(s, foe.id, 'hongguang', '兵败');
      foe.att.loyalty = 50; foe.att.surrender = 50;
      const p = prisonerChance(s, 'hongguang', foe.id);
      expect(p).toBeGreaterThan(0.1); expect(p).toBeLessThan(0.9);
      applyOrder(s, 'hongguang', { id: 'p' + seed, kind: 'prisoner', char: foe.id, act: 'recruit' });
      if (foe.faction === 'hongguang') { ok++; expect(foe.status).toBe('active'); expect(foe.captor).toBeUndefined(); }
      else { fail++; expect(foe.status).toBe('captured'); }
    }
    expect(ok).toBeGreaterThan(0); expect(fail).toBeGreaterThan(0);
  });
  it('忠贞之士极难劝降', () => {
    const s = createGame('qing', 1);
    captureChar(s, 'shikefa', 'qing', '城破');
    expect(prisonerChance(s, 'qing', 'shikefa')).toBeLessThan(0.08);
  });
  it('释放回归本方，处斩则身死', () => {
    const s = createGame('hongguang', 1);
    const [a, b] = Object.values(s.chars).filter(c => c.faction === 'shun' && c.status === 'active' && s.factions.shun.leader !== c.id);
    captureChar(s, a.id, 'hongguang', '兵败'); captureChar(s, b.id, 'hongguang', '兵败');
    applyOrder(s, 'hongguang', { id: 'r', kind: 'prisoner', char: a.id, act: 'release' });
    expect(a.status).toBe('active'); expect(a.faction).toBe('shun'); expect(a.location).toBe(s.factions.shun.capital);
    applyOrder(s, 'hongguang', { id: 'x', kind: 'prisoner', char: b.id, act: 'execute' });
    expect(b.status).toBe('dead');
  });
});

describe('电脑补派主官', () => {
  it('有闲人则派往空缺的城，先派大城', () => {
    const s = createGame('hongguang', 1);
    const empty0 = citiesOf(s, 'qing').filter(c => !c.governor).length;
    aiAppoint(s, 'qing');
    const empty1 = citiesOf(s, 'qing').filter(c => !c.governor).length;
    expect(empty1).toBeLessThan(empty0);
    for (const c of citiesOf(s, 'qing')) if (c.governor) expect(s.chars[c.governor].faction).toBe('qing');
  });
});

describe('特长落到募兵、出使与战斗', () => {
  it('练兵之主官使本城募兵上限多三成；辩才之使者劝降把握更高', async () => {
    const { maxRecruit, persuadeChance } = await import('../src/core/orders');
    const s = createGame('hongguang', 1);
    const c = s.cities.suzhou; const g = idleOf(s, 'hongguang');
    c.governor = g.id; g.traits = [];
    const base = maxRecruit(c, s);
    g.traits = ['lianbing'];
    expect(maxRecruit(c, s)).toBeGreaterThanOrEqual(Math.floor(base * 1.25 / 100) * 100);
    const env = idleOf(s, 'hongguang');
    env.traits = [];
    const p0 = persuadeChance(s, 'hongguang', env.id, 'xian').p;
    env.traits = ['biancai'];
    expect(persuadeChance(s, 'hongguang', env.id, 'xian').p).toBeCloseTo(Math.min(0.9, p0 + 0.08), 5);
  });
});

describe('电脑招贤', () => {
  it('闲人派完仍有空缺，府库宽裕则招贤补缺', async () => {
    const { aiSeek } = await import('../src/core/people');
    const s = createGame('hongguang', 1);
    aiAppoint(s, 'mingprov');
    const e0 = citiesOf(s, 'mingprov').filter(c => !c.governor).length;
    for (const c of citiesOf(s, 'mingprov')) c.silver = 50000;
    aiSeek(s, 'mingprov');
    expect(citiesOf(s, 'mingprov').filter(c => !c.governor).length).toBe(e0 - 2);
  });
});
