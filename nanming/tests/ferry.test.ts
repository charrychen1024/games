/* 渡海（2026-11-27 玩家：岛屿好像显示无法到达，没法统一、没法攻击了吗？）
 * 舟山、琼州只通海路且计入统一。陆军可从本方港口征调民船渡四日以内的近海；远海或无港须水师；无路时写明缘故。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { armyRoute, noRouteReason, ferryOk } from '../src/core/route';
import { moveArmies } from '../src/core/military';
import { applyOrder, validateOrder } from '../src/core/orders';

describe('渡海', () => {
  it('陆军在本方港口征调民船渡往舟山，士气稍挫', () => {
    const s = createGame('hongguang', 1);
    s.cities.ningbo.controller = 'hongguang'; s.cities.zhoushan.controller = 'qing';
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    for (const x of Object.values(s.armies)) if (x.id !== a.id) delete s.armies[x.id];
    a.location = 'ningbo'; a.mix = { inf: 0.8, cav: 0.1, gun: 0.1, navy: 0 }; a.morale = 60; a.path = []; a.progress = 0;
    expect(ferryOk(s, 'hongguang', 'ningbo', 'zhoushan')).toBe(true);
    expect(armyRoute(s, 'hongguang', 'ningbo', 'zhoushan', false)).toEqual(['zhoushan']);
    const o = { id: 'm', kind: 'army' as const, army: a.id, order: { kind: 'move' as const, target: 'zhoushan', attack: true } };
    expect(validateOrder(s, 'hongguang', o)).toBeNull();
    applyOrder(s, 'hongguang', o);
    moveArmies(s);
    expect(a.location).toBe('zhoushan');
    expect(a.morale).toBeLessThan(60);
    expect(s.reports.some(r => /征调民船/.test(r.text))).toBe(true);
  });
  it('无本方港口：说明须渡海、先占港口或编水师', () => {
    const s = createGame('hongguang', 1);
    for (const id of ['ningbo', 'songjiang', 'taizhou']) s.cities[id].controller = 'qing';
    const why = noRouteReason(s, 'hongguang', 'hangzhou', 'zhoushan', false);
    expect(why).toMatch(/渡海/);
    expect(why).toMatch(/水师/);
  });
  it('远海（广州至琼州九日）陆军不能渡，雷州近海可渡', () => {
    const s = createGame('hongguang', 1);
    s.cities.guangzhou.controller = 'hongguang'; s.cities.leizhou.controller = 'hongguang';
    expect(ferryOk(s, 'hongguang', 'guangzhou', 'qiongzhou')).toBe(false);
    expect(ferryOk(s, 'hongguang', 'leizhou', 'qiongzhou')).toBe(true);
  });
});
