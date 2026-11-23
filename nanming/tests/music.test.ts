/* 配乐乐理：五声调式、乐句收束、紧张度。 */
import { describe, it, expect } from 'vitest';
import { scale, phrase, melody, beatsOf, dangerOf, paletteOf } from '../src/ui/musicTheory';
import { makeRng } from '../src/core/rng';
import { createGame } from '../src/data/scenario1644';
import { yangzhouSiegeState } from '../src/data/presets';

describe('五声调式', () => {
  it('音阶只含宫商角徵羽五音，调式主音位置正确', () => {
    const sc = scale(50, 'yu', 48, 84);
    const pcs = new Set(sc.notes.map(m => ((m - 50) % 12 + 12) % 12));
    expect([...pcs].sort((a, b) => a - b)).toEqual([0, 2, 4, 7, 9]);
    for (const i of sc.tonics) expect(((sc.notes[i] - 50) % 12 + 12) % 12).toBe(9); // 羽 = 宫上大六度
  });
  it('乐句不越出音阶，总长恰为小节数×4，句末落主音', () => {
    for (let seed = 0; seed < 30; seed++) {
      const sc = scale(55, 'zhi', 60, 80);
      const p = phrase(makeRng(seed), sc, 4);
      expect(beatsOf(p)).toBeCloseTo(16, 5);
      for (const n of p) if (n.midi !== null) expect(sc.notes).toContain(n.midi);
      const last = p[p.length - 1];
      expect(sc.tonics.map(i => sc.notes[i])).toContain(last.midi);
    }
  });
  it('一段旋律四句，第二、四句是第一句的变奏（大半相同），便于记住', () => {
    const sc = scale(50, 'gong', 52, 70);
    const m = melody(7, sc, 4);
    expect(m.length).toBe(4);
    const same = m[0].filter((n, i) => m[1][i]?.midi === n.midi).length;
    expect(same / m[0].length).toBeGreaterThan(0.6);
    expect(melody(7, sc, 4)).toEqual(m); // 同一种子同一旋律
  });
  it('各家配乐的调式与主奏不同', () => {
    const set = new Set(['ming', 'qing', 'shun', 'xi'].map(p => JSON.stringify(paletteOf(p))));
    expect(set.size).toBe(4);
  });
});

describe('局势紧张度', () => {
  it('太平开局低，扬州被围时高', () => {
    const calm = dangerOf(createGame('zheng'));
    const siege = dangerOf(yangzhouSiegeState());
    expect(calm).toBeLessThan(0.35);
    expect(siege).toBeGreaterThan(calm + 0.2);
    expect(siege).toBeLessThanOrEqual(1);
  });
});
