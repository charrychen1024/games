/* 俘虏处置（2026-11-27 玩家：俘虏页按钮点了只变色、没反应；逻辑要不要优化）。
 * 处置卡写明劝降成算与依据；新增索赎：旧主出银赎人；处置月末施行。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { prisonerOdds, ransomOf, ransomError, handlePrisoner } from '../src/core/people';
import { validateOrder, describeOrder } from '../src/core/orders';
import type { GameState } from '../src/core/types';

function captive(s: GameState) {
  const c = Object.values(s.chars).find(x => x.faction === 'shun' && x.status === 'active' && s.factions.shun.leader !== x.id)!;
  c.status = 'captured'; c.captor = 'hongguang'; c.capturedAt = s.turn;
  return c;
}

describe('俘虏', () => {
  it('劝降成算逐条写明依据', () => {
    const s = createGame('hongguang', 1); const c = captive(s);
    const o = prisonerOdds(s, 'hongguang', c.id);
    expect(o.p).toBeGreaterThan(0);
    expect(o.factors.join()).toMatch(/降意.*忠诚/);
  });
  it('索赎：旧主出银，银入本方治所，其人放回', () => {
    const s = createGame('hongguang', 1); const c = captive(s);
    const shunCap = s.cities[s.factions.shun.capital]; shunCap.silver = 1e6;
    const my = s.cities[s.factions.hongguang.capital]; const v0 = my.silver;
    const order = { id: 'p', kind: 'prisoner' as const, char: c.id, act: 'ransom' as const };
    expect(validateOrder(s, 'hongguang', order)).toBeNull();
    expect(describeOrder(s, order)).toMatch(/索赎/);
    handlePrisoner(s, 'hongguang', c.id, 'ransom', 'p');
    expect(my.silver).toBe(v0 + ransomOf(c));
    expect(c.status).toBe('active');
    expect(c.faction).toBe('shun');
  });
  it('旧主府库不足则不能索赎', () => {
    const s = createGame('hongguang', 1); const c = captive(s);
    s.cities[s.factions.shun.capital].silver = 0;
    expect(ransomError(s, c.id)).toMatch(/赎不起/);
    expect(validateOrder(s, 'hongguang', { id: 'p', kind: 'prisoner', char: c.id, act: 'ransom' })).toMatch(/赎不起/);
  });
});
