/* 人物与府库的一致性：死人不得为首领、统帅、主官；改换势力者卸去旧职；失去治所的势力不得动用敌城府库；
 * 欠饷、分兵、城防、俘虏等结算不得凭空多出或重复。（2026-11-26 独立审查） */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { tidyPeople } from '../src/core/military';
import { treasuryOf } from '../src/core/state';
import { validateOrder } from '../src/core/orders';
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
