/* 粮台规则（2026-11-27 玩家指出郑氏可把军饷甩给弘光任意一城）：
 * 改粮台只能改到本方之城；友方之城只在军队驻扎其地时就地支应；无城可依的下属军镇仍可向上级之城索粮。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { supplyChoiceError, runEconomy, fixForeignSupply } from '../src/core/economy';
import { validateOrder } from '../src/core/orders';

describe('粮台只能甩给自己', () => {
  it('郑氏不能把镇江水师的粮台改到弘光的南京', () => {
    const s = createGame('zheng', 3);
    const a = s.armies.a_zhk;
    expect(supplyChoiceError(s, a, 'nanjing')).toMatch(/驻扎/);
    expect(validateOrder(s, 'zheng', { id: 'o1', kind: 'supply', army: a.id, node: 'nanjing' })).toMatch(/驻扎/);
  });
  it('驻在友方之城时可由该城就地支应（开局镇江水师由镇江供饷照旧）', () => {
    const s = createGame('zheng', 3);
    expect(supplyChoiceError(s, s.armies.a_zhk, 'zhenjiang')).toBeNull();
    runEconomy(s);
    expect(s.ledger.some(e => e.node === 'zhenjiang' && e.text.includes('镇江水师关饷'))).toBe(true);
  });
  it('离开友方之城后，粮台自动改回本方之城，并告知玩家', () => {
    const s = createGame('zheng', 3);
    const a = s.armies.a_zhk;
    a.location = 'suzhou';                      // 移驻他处（弘光之城）
    fixForeignSupply(s);
    expect(s.cities[a.supply].controller).toBe('zheng');
    expect(s.reports.some(r => r.text.includes('镇江水师') && r.text.includes('粮台'))).toBe(true);
  });
  it('电脑同一规矩：弘光的军队也不能挂到郑氏城上吃饷', () => {
    const s = createGame('zheng', 3);
    const hg = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    expect(supplyChoiceError(s, hg, 'anping')).not.toBeNull();
  });
});
