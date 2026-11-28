/* 2026-11-28 全游戏独立审查·发布前优先修正的回归测试。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { runEconomy } from '../src/core/economy';
import { validateOrder } from '../src/core/orders';
import { capture, moveArmies } from '../src/core/military';
import { armyRoute } from '../src/core/route';
import { setStance } from '../src/core/state';
import { aiConduct, aiOrders } from '../src/core/ai';
import { autoResolve, createBattle, makeSide } from '../src/core/battle';

describe('一、分营门槛不再改胜负', () => {
  it('攻城 13,846 与 13,847 对 5,500：胜场相差不过几场', () => {
    const seeds = Array.from({ length: 48 }, (_, i) => (i + 1) * 7919);
    const mix = { inf: .65, cav: .2, gun: .15, navy: 0 };
    const sd = (troops: number, garrison = false) => makeSide({ name: 'S', faction: 's', commander: 's', commanderName: 's', tong: 60, mou: 55, wai: 50, surrender: 30, armies: [], stratagems: 2, mix, garrison, troops, morale: 70 });
    const w = (a: number) => seeds.filter(seed => autoResolve(createBattle({ id: 't', kind: 'siege', node: 'x', nodeName: 'x', att: sd(a), def: sd(5500, true), seed, wall: 60, terrain: 'city', weather: 'clear' })).winner === 'att').length;
    expect(Math.abs(w(13847) - w(13846))).toBeLessThanOrEqual(6);
  }, 120000);
});

describe('二、电脑不越过玩家的指挥', () => {
  it('玩家为郑氏（奉弘光）：所定军略不被电脑改回', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    a.pace = 'forced'; a.camp = true; a.tactic = 'lure';
    aiConduct(s);
    expect(a.pace).toBe('forced'); expect(a.camp).toBe(true); expect(a.tactic).toBe('lure');
  });
  it('奉玩家号令的下属之军：电脑当月不改其令', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'huangdegong')!;
    a.order = { kind: 'siege', target: a.location, assault: false };
    s.flags['commanded_' + a.id] = s.turn;
    expect(aiOrders(s, 'huangdegong').some(o => o.kind === 'army' && o.army === a.id)).toBe(false);
  });
});

describe('三、城归出战一方', () => {
  it('郑氏破城，同城驻扎的高杰不得城', () => {
    const s = createGame('hongguang', 1);
    const z = Object.values(s.armies).find(x => x.faction === 'zheng')!, g = Object.values(s.armies).find(x => x.faction === 'gaojie')!;
    const node = 'dengzhou'; s.cities[node].controller = 'qing';
    z.location = node; g.location = node; g.troops = 40000; z.troops = 20000;
    capture(s, node, 'zheng', '陷城', z.commander);
    expect(s.cities[node].controller).toBe('zheng');
  });
});

describe('五、付款与通行', () => {
  it('治所已失：不能赠礼', () => {
    const s = createGame('hongguang', 1);
    s.cities[s.factions.shun.capital].controller = 'qing';
    expect(validateOrder(s, 'shun', { id: 'g', kind: 'gift', target: 'hongguang', silver: 5000 })).toMatch(/治所已失/);
  });
  it('停战一方之城：不能以之为行军终点，途中遇之止步', () => {
    const s = createGame('hongguang', 1);
    const foeCity = Object.values(s.cities).find(c => c.controller === 'shun')!.id;
    setStance(s, 'hongguang', 'shun', 'truce', s.turn + 6);
    expect(armyRoute(s, 'hongguang', 'nanjing', foeCity, false)).toBeNull();
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    for (const x of Object.values(s.armies)) if (x.id !== a.id) delete s.armies[x.id];
    a.location = 'nanjing'; a.path = [foeCity]; a.progress = 0;
    moveArmies(s);
    expect(a.location).not.toBe(foeCity);
  });
});

describe('七、当地之粮与市面额度', () => {
  it('空城抄掠：四乡无粮、城无存粮，军队断粮', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    const foe = Object.values(s.cities).find(c => c.controller === 'shun')!;
    foe.pop = 0; foe.grain = 0; foe.silver = 0;
    a.location = foe.id; a.forage = 'plunder'; a.troops = 8000; a.hunger = 0;
    runEconomy(s);
    expect(a.hunger).toBe(1);
    expect(a.troops).toBeLessThan(8000);
  });
  it('手动卖满市面后，自动粜不再另得一份额度', () => {
    const s = createGame('hongguang', 1);
    const c = s.cities.suzhou;
    c.grain = 5e6; c.silver = 0;
    s.cities.suzhou.tradeTurn = s.turn; s.cities.suzhou.tradeN = 1e9;   // 本月市面已用尽
    const g0 = c.grain;
    runEconomy(s);
    expect(s.ledger.some(e => e.node === 'suzhou' && /市粜余粮/.test(e.text))).toBe(false);
    expect(c.grain).toBeLessThanOrEqual(g0);
  });
});

describe('预估写明自动粜籴', () => {
  it('府库将尽、仓粮有余：预估另列月末自动粜粮，与月结所粜一致', async () => {
    const { cityForecast, upkeepOf } = await import('../src/core/economy');
    const s = createGame('hongguang', 1);
    const c = s.cities.suzhou;
    c.garrison = 60000;   // 饷多于税，府库月月见底
    const up = upkeepOf(s, c);
    c.silver = 0; c.grain = up.grain * 30;
    const f = cityForecast(s, c);
    expect(f.auto && f.auto.grain).toBeLessThan(0);
    runEconomy(s);
    const sold = -s.ledger.filter(e => e.node === 'suzhou' && e.field === 'grain' && /市粜余粮/.test(e.text)).reduce((n, e) => n + e.delta, 0);
    expect(sold).toBeGreaterThan(0);
    expect(Math.abs(sold + f.auto!.grain)).toBeLessThanOrEqual(Math.max(500, sold * 0.15));
  });
});
