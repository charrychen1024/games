/* 军情图层：五种关系的色块须彼此分得开（2026-11-26 玩家指出本方与停战同色） */
import { describe, it, expect } from 'vitest';
import { TONE_COLOR } from '../src/render/lens';

const rgb = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
describe('军情图层配色', () => {
  it('任意两种关系的颜色相差足够大', () => {
    const tones = Object.entries(TONE_COLOR);
    for (let i = 0; i < tones.length; i++) for (let j = i + 1; j < tones.length; j++) {
      const [a, b] = [rgb(tones[i][1]), rgb(tones[j][1])];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      expect(d, `${tones[i][0]} 与 ${tones[j][0]}`).toBeGreaterThan(90);
    }
  });
});
