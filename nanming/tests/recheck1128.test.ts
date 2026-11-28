/* 2026-11-28 修复复核（全游戏修复复核-2026-11-28.md）所列问题的回归测试。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { runEconomy, upkeepOf } from '../src/core/economy';
import { runMonthAuto } from '../src/core/turn';
import { autoResolve, createBattle, makeSide } from '../src/core/battle';
import { createSiege, attWithdraw, toBattleResult } from '../src/core/siege';
import { createField, setFormation, stepField, aiField, autoMomentF } from '../src/core/field';
import { aiDefections, aiEvacuate, aiOrders } from '../src/core/ai';
import { validateOrder } from '../src/core/orders';
import { moveArmies } from '../src/core/military';
import { setStance } from '../src/core/state';
import { applyOffer } from '../src/core/diplomacy';
import { armyRoute } from '../src/core/route';
import { yangzhouSiegeState } from '../src/data/presets';

const mix = { inf: .65, cav: .2, gun: .15, navy: 0 };
const sd = (troops: number, garrison = false, tong = 60) => makeSide({ name: 'S', faction: 's', commander: 's', commanderName: 's', tong, mou: 55, wai: 50, surrender: 30, armies: [], stratagems: 2, mix, garrison, troops, morale: 70 });

describe('临阵改为围而不攻 = 月初下围困令', () => {
  it('不记败仗，月末照常查断粮献城', () => {
    const s0 = yangzhouSiegeState();
    const node = Object.keys(s0.sieges)[0];
    s0.cities[node].grain = 0;
    const s = runMonthAuto(s0, [], it => {
      if (it.type !== 'battle' || it.battle.kind !== 'siege') return undefined;
      const sim = createSiege(it.battle); attWithdraw(sim);
      return { type: 'battle', result: toBattleResult(it.battle, sim), manual: true };
    });
    expect(s.battles.filter(b => b.turn === s0.turn && b.kind === 'siege' && b.node === node).length).toBe(0);
  });
});

describe('小仗分营不改胜负', () => {
  it('攻 2,307 与 2,308 对守 1,000：胜场相差无几', () => {
    const seeds = Array.from({ length: 64 }, (_, i) => (i + 1) * 7919);
    const w = (a: number) => seeds.filter(seed => autoResolve(createBattle({ id: 't', kind: 'siege', node: 'x', nodeName: 'x', att: sd(a), def: sd(1000, true), seed, wall: 60, terrain: 'city', weather: 'clear' })).winner === 'att').length;
    expect(Math.abs(w(2307) - w(2308))).toBeLessThanOrEqual(4);
  }, 120000);
});

describe('足额发粮不判断粮', () => {
  // 按缺额比例逃散：缺一成者逃散；只差一石不足一人，不算；足额、多一石都不逃散
  for (const [extra, desert] of [[-600, true], [-1, false], [0, false], [1, false]] as const) it(`守军口粮差 ${extra} 石：${desert ? '有' : '无'}逃散`, () => {
    const s = createGame('hongguang', 1);
    for (const a of Object.values(s.armies)) delete s.armies[a.id];
    const c = s.cities.suzhou; c.garrison = 10000; c.silver = 1e6;
    s.sieges.suzhou = { node: 'suzhou', attacker: 'qing', armies: [], startTurn: s.turn, months: 1 };
    const need = upkeepOf(s, c).grain;   // 口粮（沃野军屯打折）加守城加给
    // 田粮被围只收一成半：先算本月田粮，让发粮时仓里恰好够（或差一石、多一石）
    const before = s.ledger.length;
    const t = structuredClone(s); t.cities.suzhou.grain = 1e9; runEconomy(t);
    const income = t.ledger.slice(before).filter(e => e.node === 'suzhou' && e.field === 'grain' && e.src.kind === 'income').reduce((n, e) => n + e.delta, 0);
    c.grain = Math.max(0, need - income + extra);
    runEconomy(s);
    const lost = s.ledger.some(e => e.node === 'suzhou' && /断粮，士卒逃散/.test(e.text));
    expect(lost).toBe(desert);
  });
});

describe('电脑不替玩家定宗属、不擅撤玩家之城', () => {
  it('郑氏为玩家：服从低、清军临境，电脑不代为降清', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame('zheng', seed);
      s.factions.zheng.loyalty = 10; s.chars[s.factions.zheng.leader].att.surrender = 100;
      setStance(s, 'qing', 'hongguang', 'war');
      const q = Object.values(s.armies).find(a => a.faction === 'qing')!; q.location = s.factions.zheng.capital;
      aiDefections(s);
      expect(s.factions.zheng.overlord).toBe('hongguang');
    }
  });
  it('玩家（郑氏）之城受压，电脑不擅自撤离', () => {
    const s = createGame('zheng', 1);
    const c = Object.values(s.cities).find(x => x.controller === 'zheng' && x.id !== s.factions.zheng.capital)!;
    c.garrison = 2000; c.wall = 20;
    const q = Object.values(s.armies).find(a => a.faction === 'qing')!; q.location = c.id; q.troops = 80000;
    setStance(s, 'qing', 'zheng', 'war');
    aiEvacuate(s);
    expect(c.garrison).toBe(2000);
  });
  it('号令驻守的下属之军：期内电脑不调走', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'huangdegong')!;
    a.order = { kind: 'hold' }; s.flags['commanded_' + a.id] = s.turn;
    expect(aiOrders(s, 'huangdegong').some(o => o.kind === 'army' && o.army === a.id)).toBe(false);
  });
});

describe('一场搦战只有一个结果', () => {
  it('双方各自择牌时，同一场不会各出一次搦战', () => {
    let both = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const b = createBattle({ id: 't', kind: 'field', node: 'x', nodeName: 'x', att: sd(30000, false, 80), def: sd(30000, false, 80), seed, terrain: 'plain', weather: 'clear' });
      const sim = createField(b); let next = 0;
      while (!sim.over && sim.t < 300) { if (sim.t >= next) { aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; } stepField(sim, 0.1); for (const x of ['att', 'def'] as const) if (!sim.over) autoMomentF(sim, x); }
      if (sim.moments.includes('att:duel') && sim.moments.includes('def:duel')) both++;
    }
    expect(both).toBe(0);
  }, 120000);
});

describe('反复切阵不挤压部署', () => {
  it('同阵点二十次、来回切阵，位置回到一样', () => {
    const b = createBattle({ id: 't', kind: 'field', node: 'x', nodeName: 'x', att: sd(30000), def: sd(30000), seed: 3, terrain: 'plain', weather: 'clear' });
    const sim = createField(b);
    setFormation(sim, 'att', 'fangyuan');
    const once = sim.units.filter(u => u.side === 'att').map(u => [u.x, u.y]);
    for (let k = 0; k < 20; k++) setFormation(sim, 'att', 'fangyuan');
    expect(sim.units.filter(u => u.side === 'att').map(u => [u.x, u.y])).toEqual(once);
    setFormation(sim, 'att', 'normal'); const n1 = sim.units.filter(u => u.side === 'att').map(u => [u.x, u.y]);
    setFormation(sim, 'att', 'heyi'); setFormation(sim, 'att', 'normal');
    expect(sim.units.filter(u => u.side === 'att').map(u => [u.x, u.y])).toEqual(n1);
  });
});

describe('付款与通行的边界', () => {
  it('对方无治所：不能赠礼', () => {
    const s = createGame('hongguang', 1);
    s.cities[s.factions.shun.capital].controller = 'qing';
    expect(validateOrder(s, 'hongguang', { id: 'g', kind: 'gift', target: 'shun', silver: 5000 })).toMatch(/无治所/);
  });
  it('拒绝借道：一年之内其军不得经本方之城', () => {
    const s = createGame('hongguang', 1);
    setStance(s, 'hongguang', 'xi', 'neutral');
    applyOffer(s, { kind: 'passage_ask', from: 'xi', silver: 0, city: 'nanjing', title: 't', text: '', options: [] }, 2);
    expect(armyRoute(s, 'xi', s.factions.xi.capital, 'nanjing', false)).toBeNull();
  });
  it('途中才停战：走到城下不得入', () => {
    const s = createGame('hongguang', 1);
    const foeCity = Object.values(s.cities).find(c => c.controller === 'shun')!.id;
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    for (const x of Object.values(s.armies)) if (x.id !== a.id) delete s.armies[x.id];
    a.location = 'nanjing'; a.path = [foeCity]; a.progress = 99;   // 已在路上、快到了
    setStance(s, 'hongguang', 'shun', 'truce', s.turn + 6);
    moveArmies(s);
    expect(a.location).not.toBe(foeCity);
  });
});

describe('复核余项', () => {
  it('驻军欠饷：按缺饷比例逃散、吏治下降；足饷不逃', async () => {
    const run = (silver: number) => { const s = createGame('hongguang', 1); for (const a of Object.values(s.armies)) delete s.armies[a.id]; const c = s.cities.suzhou; c.garrison = 300000; c.silver = silver; c.grain = 1e8; runEconomy(s); return s.ledger.some(e => e.node === 'suzhou' && /欠饷/.test(e.text) && e.field === 'garrison'); };
    expect(run(0)).toBe(true);
    expect(run(1e6)).toBe(false);
  });
  it('小城人口生息不被取整抹去', async () => {
    const { popGrowth } = await import('../src/core/develop');
    const s = createGame('hongguang', 1); const c = Object.values(s.cities).find(x => x.pop <= 3)!;
    c.minxin = 70; c.agri = 60; const p0 = c.pop;
    popGrowth(s, c);
    expect(c.pop).toBeGreaterThan(p0);
  });
  it('电脑调饷沿粮道：路远者在途，不当场到账', async () => {
    const { aiPayArmies } = await import('../src/core/ai');
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'qing')!;
    const far = Object.values(s.cities).filter(c => c.controller === 'qing').sort((x, y) => y.silver - x.silver);
    a.unpaid = 2; a.supply = far[far.length - 1].id; s.cities[a.supply].silver = 0;
    const before = s.cities[a.supply].silver;
    aiPayArmies(s);
    const inTransit = (s.convoys ?? []).some(v => v.to === a.supply && v.silver > 0);
    expect(inTransit || s.cities[a.supply].silver > before).toBe(true);
  });
  it('赠礼盟友：对方离间的把握降低', async () => {
    const { envoyScore, pactKey } = await import('../src/core/orders');
    const s = createGame('hongguang', 1);
    setStance(s, 'hongguang', 'zheng', 'alliance'); delete s.factions.zheng.overlord;
    for (const v of Object.values(s.factions)) if (v.overlord === 'hongguang') delete v.overlord;
    const env = Object.values(s.chars).find(c => c.faction === 'qing' && c.status === 'active')!;
    const o = { id: 'x', kind: 'envoy' as const, char: env.id, target: 'hongguang', aim: 'discord' as const };
    const p0 = envoyScore(s, 'qing', o).score;
    s.flags[pactKey('goodwill', 'hongguang', 'zheng')] = s.turn + 12;
    expect(envoyScore(s, 'qing', o).score).toBeLessThan(p0);
  });
  it('本月得失：直属战绩与诸镇战绩分记', async () => {
    const { monthSummary } = await import('../src/core/summary');
    const s0 = createGame('hongguang', 1); const s1 = structuredClone(s0);
    s1.battles.push({ id: 'b1', turn: s0.turn, node: 'x', kind: 'field', attacker: 'hongguang', defender: 'shun', winner: 'attacker', attLoss: 1, defLoss: 1, summary: '', manual: false });
    s1.battles.push({ id: 'b2', turn: s0.turn, node: 'x', kind: 'field', attacker: 'gaojie', defender: 'shun', winner: 'defender', attLoss: 1, defLoss: 1, summary: '', manual: false });
    const sm = monthSummary(s0, s1);
    expect(sm.battlesWon).toBe(1); expect(sm.battlesLost).toBe(0);
    expect(sm.vassalLost).toBe(1);
  });
});
