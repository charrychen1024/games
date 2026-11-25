/* 城池每月钱粮预估与募兵：预估逐项列出，与实际月结相符；可养人数；被围不能募兵。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { cityForecast, feedable, runEconomy, GRAIN_PER_SOLDIER, SILVER_PER_SOLDIER } from '../src/core/economy';
import { validateOrder, applyOrder } from '../src/core/orders';
import type { GameState } from '../src/core/types';

/** 实际月结后某城的净变化（去掉自动市籴这类视情况才发生的项） */
function actual(s: GameState, node: string) {
  const t = structuredClone(s);
  runEconomy(t);
  const net = (f: 'grain' | 'silver') => t.ledger.filter(e => e.turn === t.turn && e.node === node && e.field === f && e.src.ref !== 'market').reduce((n, e) => n + e.delta, 0);
  return { grain: net('grain'), silver: net('silver') };
}

describe('城池每月钱粮预估', () => {
  for (const [player, node] of [['hongguang', 'nanjing'], ['hongguang', 'suzhou'], ['zheng', 'anping'], ['xi', 'kuizhou'], ['qing', 'beijing']] as const) {
    it(`${player} · ${node}：逐项预估的净值与实际月结一致`, () => {
      const s = createGame(player, 1);
      const c = s.cities[node];
      c.grain = 5e6; c.silver = 5e6;   // 钱粮充足：各项都照常发生
      const f = cityForecast(s, c);
      const a = actual(s, node);
      expect(f.grain.net).toBe(a.grain);
      expect(Math.abs(f.silver.net - a.silver)).toBeLessThanOrEqual(Math.max(50, Math.abs(a.silver) * 0.02));
      expect(f.grain.items.length).toBeGreaterThan(1);
      expect(f.silver.items.every(i => i.label && Number.isFinite(i.v))).toBe(true);
    });
  }
  it('预估列出驻军、起运、以本城为粮台的军队', () => {
    const s = createGame('hongguang', 1);
    const f = cityForecast(s, s.cities.suzhou);
    const labels = f.silver.items.map(i => i.label).join('|');
    expect(labels).toMatch(/驻军/);
    expect(labels).toMatch(/起运/);
    const n = cityForecast(s, s.cities.nanjing);
    expect(n.silver.items.some(i => /起运|解饷/.test(i.label) && i.v > 0)).toBe(true);
  });
  it('可养人数：按本城每月结余，粮银取其紧者', () => {
    const s = createGame('hongguang', 1);
    const c = s.cities.nanjing;
    const f = cityForecast(s, c);
    const n = feedable(s, c);
    expect(n).toBe(Math.max(0, Math.floor(Math.min(f.grain.net / GRAIN_PER_SOLDIER, f.silver.net / SILVER_PER_SOLDIER) / 100) * 100));
  });
});

describe('募兵', () => {
  it('被围之城不能募兵', () => {
    const s = createGame('hongguang', 1);
    s.sieges.suzhou = { node: 'suzhou', attacker: 'qing', armies: [], startTurn: 0, months: 1 };
    expect(validateOrder(s, 'hongguang', { id: 'r', kind: 'recruit', node: 'suzhou', troops: 500 })).toMatch(/围/);
  });
  it('募兵军报的每月口粮按实际 0.25 石一人', () => {
    const s = createGame('hongguang', 1);
    applyOrder(s, 'hongguang', { id: 'r', kind: 'recruit', node: 'nanjing', troops: 1000 });
    const r = s.reports[s.reports.length - 1].text;
    expect(r).toContain(`口粮 ${1000 * GRAIN_PER_SOLDIER} 石`);
    expect(r).toContain(`饷银 ${1000 * SILVER_PER_SOLDIER} 两`);
  });
});
