/* 人物与府库的一致性：死人不得为首领、统帅、主官；改换势力者卸去旧职；失去治所的势力不得动用敌城府库；
 * 欠饷、分兵、城防、俘虏等结算不得凭空多出或重复。（2026-11-26 独立审查） */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { tidyPeople } from '../src/core/military';
import { treasuryOf } from '../src/core/state';
import { validateOrder, persuadeChance } from '../src/core/orders';
import { payArrears } from '../src/core/economy';
import { handlePrisoner } from '../src/core/people';
import { runMonthAuto } from '../src/core/turn';

describe('人物一致性', () => {
  it('统帅死于史事：军队交给同势力在世之人', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    const dead = a.commander;
    s.chars[dead].status = 'dead';
    tidyPeople(s);
    if (s.armies[a.id]) {
      expect(s.armies[a.id].commander).not.toBe(dead);
      expect(s.chars[s.armies[a.id].commander].status).toBe('active');
    }
  });
  it('首领死去：另推一人主事，不留死人为首领', () => {
    const s = createGame('qing', 1);
    const f = 'liuliangzuo';
    s.chars[s.factions[f].leader].status = 'dead';
    tidyPeople(s);
    const l = s.chars[s.factions[f].leader];
    expect(s.factions[f].defunct || l?.status === 'active' || !!s.flags['need_succession_' + f]).toBe(true);
  });
  it('主官改投他方：卸去原城主官', () => {
    const s = createGame('hongguang', 1);
    const c = Object.values(s.cities).find(x => x.controller === 'hongguang' && x.governor)!;
    s.chars[c.governor!].faction = 'mingprov';
    tidyPeople(s);
    expect(c.governor).toBeUndefined();
  });
});

describe('府库', () => {
  it('治所已失：不能从敌城府库犒赏下属', () => {
    const s = createGame('hongguang', 1);
    const cap = s.factions.hongguang.capital;
    expect(treasuryOf(s, 'hongguang')).toBe(cap);
    s.cities[cap].controller = 'qing';
    expect(treasuryOf(s, 'hongguang')).toBe('');
    expect(validateOrder(s, 'hongguang', { id: 'r', kind: 'reward', vassal: 'gaojie', silver: 10000 } as any)).toBeTruthy();
  });
  it('君主被俘、只剩府库不足的议赎：电脑一方不会让俘虏一直当首领', () => {
    let s = createGame('hongguang', 1);
    const f = 'liuliangzuo';
    const fac = s.factions[f];
    delete fac.overlord; delete fac.loyalty;
    for (const k of Object.keys(s.relations)) if (k.split('|').includes(f) && s.relations[k].stance === 'alliance') s.relations[k].stance = 'neutral';
    const leader = fac.leader;
    for (const c of Object.values(s.chars)) if (c.faction === f && c.id !== leader && c.status !== 'dead') c.status = 'dead';
    for (const c of Object.values(s.chars)) if (c.status === 'offstage' && s.cities[c.location]?.controller === f) c.status = 'dead';
    s.chars[leader].status = 'captured'; s.chars[leader].captor = 'qing'; s.chars[leader].capturedAt = s.turn;
    s.cities[fac.capital].silver = 1000;
    s.flags['need_succession_' + f] = '首领被俘'; s.flags['old_ruler_' + f] = leader;
    s = runMonthAuto(s, []);
    const after = s.factions[f];
    expect(after.defunct || after.leader !== leader || !Object.values(s.cities).some(c => c.controller === f)).toBe(true);
  });
});

describe('结算不重复', () => {
  it('久欠之兵索到的饷银不再记作积欠', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang' && s.cities[x.location]?.controller === 'hongguang')!;
    const city = s.cities[a.location];
    city.silver = 1_000_000;
    a.unpaid = 3; a.arrears = 0;
    payArrears(s, a, 5000);
    expect(a.unpaid).toBe(4);
    expect(a.arrears).toBe(0);
  });
  it('俘主遣归时原势力已亡：不做游魂，隐居待出', () => {
    const s = createGame('hongguang', 1);
    const c = Object.values(s.chars).find(x => x.faction === 'gaojie' && x.status === 'active' && x.id !== s.factions.gaojie.leader)!;
    c.status = 'captured'; c.captor = 'qing'; c.capturedAt = s.turn;
    s.factions.gaojie.defunct = true;
    handlePrisoner(s, 'qing', c.id, 'release', 't');
    expect(c.status).toBe('offstage');
  });
});

describe('劝降有前提、有代价（劝降不再是不用兵的最优解）', () => {
  const setup = () => {
    const s = createGame('hongguang', 1);
    const env = Object.values(s.chars).find(c => c.faction === 'hongguang' && c.status === 'active' && c.ab.wai >= 60 && !Object.values(s.armies).some(a => a.commander === c.id) && s.factions.hongguang.leader !== c.id)!;
    const node = 'xian';
    for (const a of Object.values(s.armies)) if (a.location === node || a.faction === 'hongguang') a.location = s.factions.hongguang.capital;
    return { s, env, node };
  };
  it('城外无我军：空言劝降，成算至多一成五', () => {
    const { s, env, node } = setup();
    s.cities[node].minxin = 10;
    env.traits = ['biancai'];
    const r = persuadeChance(s, 'hongguang', env.id, node);
    expect(r.p).toBeLessThanOrEqual(0.15);
    expect(r.factors.join('')).toContain('城外无我军');
  });
  it('大军压境时成算远高于空言', () => {
    const { s, env, node } = setup();
    const p0 = persuadeChance(s, 'hongguang', env.id, node).p;
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    a.location = node; a.troops = s.cities[node].garrison * 3 + 1000;
    expect(persuadeChance(s, 'hongguang', env.id, node).p).toBeGreaterThan(p0 * 1.5);
  });
  it('劝降不成，半年内再劝成算减半', () => {
    const { s, env, node } = setup();
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    a.location = node; a.troops = s.cities[node].garrison * 3 + 1000;
    const p0 = persuadeChance(s, 'hongguang', env.id, node).p;
    s.flags['persuade_fail_' + node + '_hongguang'] = s.turn;
    expect(persuadeChance(s, 'hongguang', env.id, node).p).toBeCloseTo(p0 / 2, 5);
    s.turn += 7;
    expect(persuadeChance(s, 'hongguang', env.id, node).p).toBeCloseTo(p0, 5);
  });
});

describe('民心有后果', () => {
  it('民心归零：赋税只收得五成，加派也不再多收', async () => {
    const { monthlyIncome } = await import('../src/core/economy');
    const s = createGame('hongguang', 1);
    const c = s.cities.suzhou;
    c.policy = 'balanced'; c.minxin = 60;
    const full = monthlyIncome(s, c).silver;
    c.minxin = 0;
    expect(monthlyIncome(s, c).silver).toBeLessThanOrEqual(Math.round(full * 0.5) + 1);
    c.policy = 'levy';
    expect(monthlyIncome(s, c).silver).toBeLessThanOrEqual(Math.round(full * 0.5) + 1);
  });
  it('民心久在一成以下、又无大军镇抚：终有民变，豪强据城', async () => {
    const { unrest } = await import('../src/core/military');
    const s = createGame('hongguang', 1);
    const c = Object.values(s.cities).find(x => x.controller === 'hongguang' && x.id !== s.factions.hongguang.capital && !Object.values(s.armies).some(a => a.location === x.id))!;
    for (let k = 0; k < 60 && c.controller === 'hongguang'; k++) { c.minxin = 3; unrest(s); s.turn++; }
    expect(c.controller).toBe('local');
  });
});
