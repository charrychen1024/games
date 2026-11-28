/* 外交对策（2026-11-28 玩家：好像没法与别家结盟，借道也没有，外交太少）。
 * 遣使所求：结盟、停战、议和、借道、互市、离间；另有赠礼、绝盟、宣战。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { applyOrder, validateOrder, envoyScore, aimError, pactOn, pactKey, describeOrder } from '../src/core/orders';
import { armyRoute } from '../src/core/route';
import { monthlyIncome } from '../src/core/economy';
import { setStance, stance } from '../src/core/state';
import { resolveMissions } from '../src/core/orders';

const game = () => createGame('hongguang', 1);
const envoy = (s: ReturnType<typeof game>) => Object.values(s.chars).filter(c => c.faction === 'hongguang' && c.status === 'active' && c.id !== s.factions.hongguang.leader && !Object.values(s.armies).some(a => a.commander === c.id)).sort((a, b) => b.ab.wai - a.ab.wai)[0];

describe('所求是否可提', () => {
  it('交战时不能借道、互市；未战不能议和；盟友不必借道', () => {
    const s = game();
    setStance(s, 'hongguang', 'zheng', 'war');
    expect(aimError(s, 'hongguang', 'zheng', 'passage')).toMatch(/交战/);
    expect(aimError(s, 'hongguang', 'zheng', 'trade')).toMatch(/交战/);
    setStance(s, 'hongguang', 'zheng', 'neutral');
    expect(aimError(s, 'hongguang', 'zheng', 'peace')).toMatch(/未交战/);
    setStance(s, 'hongguang', 'zheng', 'alliance');
    expect(aimError(s, 'hongguang', 'zheng', 'passage')).toMatch(/盟友/);
  });
});

describe('借道', () => {
  it('借道之约：停战一方之城本闭门不纳，立约后可经其城行军', () => {
    const s = game();
    for (const c of Object.values(s.cities)) if (c.controller !== 'hongguang') c.controller = 'xi';
    setStance(s, 'hongguang', 'xi', 'truce', s.turn + 6);
    const far = Object.values(s.cities).find(c => c.controller === 'xi' && c.id === 'wuchang')!.id;
    s.cities.anqing.controller = 'xi'; s.cities.jiujiang.controller = 'xi';
    const before = armyRoute(s, 'hongguang', 'nanjing', far, false);
    s.flags[pactKey('pass', 'hongguang', 'xi')] = s.turn + 12;
    const after = armyRoute(s, 'hongguang', 'nanjing', far, false);
    expect(after).not.toBeNull();
    expect(before === null || after!.length <= before.length).toBe(true);
    expect(pactOn(s, 'pass', 'xi', 'hongguang')).toBe(true);
  });
});

describe('互市', () => {
  it('互市之约使赋税 +5%，交战即失效', () => {
    const s = game(); const c = s.cities.nanjing;
    const base = monthlyIncome(s, c).silver;
    s.flags[pactKey('trade', 'hongguang', 'zheng')] = s.turn + 12;
    setStance(s, 'hongguang', 'zheng', 'neutral');
    expect(monthlyIncome(s, c).silver).toBeGreaterThan(base * 1.04);
    setStance(s, 'hongguang', 'zheng', 'war');
    expect(monthlyIncome(s, c).silver).toBe(base);
  });
});

describe('赠礼与绝盟', () => {
  it('赠礼：治所出银，一年内遣使把握提高', () => {
    const s = game(); const e = envoy(s);
    const before = envoyScore(s, 'hongguang', { id: 'x', kind: 'envoy', char: e.id, target: 'zheng', aim: 'trade' }).score;
    const cap = s.cities[s.factions.hongguang.capital]; const v0 = cap.silver;
    const o = { id: 'g', kind: 'gift' as const, target: 'zheng', silver: 20000 };
    expect(validateOrder(s, 'hongguang', o)).toBeNull();
    applyOrder(s, 'hongguang', o);
    expect(cap.silver).toBe(v0 - 20000);
    expect(envoyScore(s, 'hongguang', { id: 'x', kind: 'envoy', char: e.id, target: 'zheng', aim: 'trade' }).score).toBeGreaterThan(before);
  });
  it('绝盟：复归中立，对方上下切齿', () => {
    const s = game(); setStance(s, 'hongguang', 'zheng', 'alliance');
    const o = { id: 'b', kind: 'breakAlly' as const, target: 'zheng' };
    expect(describeOrder(s, o)).toMatch(/绝盟/);
    applyOrder(s, 'hongguang', o);
    expect(stance(s, 'hongguang', 'zheng')).toBe('neutral');
  });
});

describe('离间', () => {
  it('离间得手：对方与其盟友盟约遂散', () => {
    let broke = false;
    for (let seed = 1; seed <= 30 && !broke; seed++) {
      const s = createGame('hongguang', seed); const e = envoy(s); e.ab.mou = 95;
      setStance(s, 'shun', 'xi', 'alliance');
      applyOrder(s, 'hongguang', { id: 'd' + seed, kind: 'envoy', char: e.id, target: 'shun', aim: 'discord' });
      for (const m of s.missions) m.arriveTurn = s.turn;
      resolveMissions(s);
      if (stance(s, 'shun', 'xi') !== 'alliance') broke = true;
    }
    expect(broke).toBe(true);
  });
});
