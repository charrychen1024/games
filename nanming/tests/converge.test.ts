/* 多路合攻与半路受阻：同月围攻同一城的各军合成一战；进攻途中被敌城挡住，先攻挡路之城，拿下后接着去原定目标。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { resolveMonth, runMonthAuto } from '../src/core/turn';
import { autoResolve } from '../src/core/battle';
import type { GameState, Order } from '../src/core/types';

function month(s: GameState, orders: Order[]) {
  const gen = resolveMonth(s, orders);
  const battles: { node: string; armies: string[] }[] = [];
  let r = gen.next();
  while (!r.done) { const it = r.value; if (it.type === 'battle') { battles.push({ node: it.battle.node, armies: it.battle.att.armies }); r = gen.next({ type: 'battle', result: autoResolve(it.battle), manual: false }); } else r = gen.next({ type: 'choice', index: 0 }); }
  return { s: r.value.state, battles };
}

describe('多路合攻', () => {
  it('两军同到一城、都下攻城令：合成一场攻城战', () => {
    const s = createGame('qing', 1);
    for (const id of ['a_duoduo', 'a_ajige']) { const a = s.armies[id]; a.location = 'linqing'; a.path = []; a.progress = 0; }
    const { battles } = month(s, ['a_duoduo', 'a_ajige'].map((id, i) => ({ id: 'o' + i, kind: 'army' as const, army: id, order: { kind: 'siege' as const, target: 'linqing', assault: true } })));
    const b = battles.find(x => x.node === 'linqing')!;
    expect(b).toBeTruthy();
    expect(b.armies.sort()).toEqual(['a_ajige', 'a_duoduo']);
  });
});

describe('进攻途中被敌城挡住', () => {
  it('先攻挡路的临清，记住原定目标大名；拿下临清后接着开往大名', () => {
    let s = createGame('qing', 1);
    const { s: s1, battles } = month(s, ['a_duoduo', 'a_ajige'].map((id, i) => ({ id: 'o' + i, kind: 'army' as const, army: id, order: { kind: 'move' as const, target: 'daming', attack: true } })));
    expect(battles.some(b => b.node === 'linqing')).toBe(true);
    const a = s1.armies.a_duoduo;
    if (s1.cities.linqing.controller === 'qing') {
      // 已拿下临清：军令应已改回开往大名
      expect(a.order.kind === 'move' ? a.order.target : a.order.kind === 'siege' ? a.order.target : '').toBe('daming');
    } else {
      expect(a.order).toMatchObject({ kind: 'siege', target: 'linqing', then: 'daming' });
    }
    expect(s1.reports.some(r => r.text.includes('临清') && r.text.includes('大名') && /阻|挡/.test(r.text))).toBe(true);
    s = s1;
    for (let i = 0; i < 4 && s.cities.daming.controller !== 'qing'; i++) s = runMonthAuto(s, []);
    expect(['qing'].includes(s.cities.daming.controller) || s.armies.a_duoduo?.location === 'daming' || s.sieges.daming).toBeTruthy();
  });
});

describe('弃城无处可退', () => {
  it('最后一城弃守：守军就地溃散，不留给敌方', async () => {
    const { capture, retreatCity } = await import('../src/core/military');
    const s = createGame('xi', 1);
    expect(retreatCity(s, 'kuizhou')).toBeUndefined();
    const g = s.cities.kuizhou.garrison;
    expect(g).toBeGreaterThan(0);
    capture(s, 'kuizhou', 'mingprov', '弃城');
    expect(s.cities.kuizhou.controller).toBe('mingprov');
    expect(s.cities.kuizhou.garrison).toBeLessThan(g);
    expect(s.reports.some(r => /无城可退/.test(r.text))).toBe(true);
  });
});

describe('军情按当事与否分级', () => {
  it('与本方无关的易主：只报易帜，不报对方缴获细账', async () => {
    const { capture } = await import('../src/core/military');
    const s = createGame('xi', 1);
    const node = Object.values(s.cities).find(c => c.controller === 'shun' && c.silver > 1000)!.id;
    capture(s, node, 'qing', '陷城');
    const r = s.reports.filter(x => x.cat === '易主' && x.node === node).pop()!;
    expect(r.text).not.toMatch(/存银|存粮|降卒/);
    expect(r.spoils?.silver ?? 0).toBe(0);
    const t = createGame('qing', 1);
    capture(t, node, 'qing', '陷城');
    const r2 = t.reports.filter(x => x.cat === '易主' && x.node === node).pop()!;
    expect(r2.text).toMatch(/存银|存粮/);
  });
});
