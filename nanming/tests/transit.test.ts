/* 在途（2026-11-27 玩家：远距离调拨超过两个月能否送达？看不到进度；远程之事缺一个查看完成与否、状态、进度的地方）。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { applyOrder } from '../src/core/orders';
import { arriveConvoys } from '../src/core/economy';
import { supplyRoute } from '../src/core/route';
import { transitOf, etaText } from '../src/core/transit';
import type { GameState } from '../src/core/types';

/** 找一对本方城池，粮道在三十日以上（在途多月） */
function farPair(s: GameState): [string, string, number] {
  for (const c of Object.values(s.cities)) c.controller = s.player;   // 一统之局，好找远路
  const near = ['nanjing', 'chengdu', 'guangzhou', 'xian', 'kunming', 'beijing'];
  const mine = near.filter(n => s.cities[n]);
  let best: [string, string, number] = ['', '', 0];
  for (const a of mine) for (const b of mine) { if (a === b) continue; const r = supplyRoute(s, s.player, a, b); if (!r.reason && r.days > best[2]) best = [a, b, r.days]; }
  return best;
}

describe('远距离调拨', () => {
  it('在途数月：每月列在在途表上、进度递增，到期送达并有报告', () => {
    const s = createGame('hongguang', 1);
    const [from, to, days] = farPair(s);
    expect(days).toBeGreaterThan(30);
    const months = Math.ceil(days / 30);
    const g0 = s.cities[to].grain;
    s.cities[from].grain = 1e6;
    applyOrder(s, s.player, { id: 'tx', kind: 'transfer', from, to, grain: 20000, silver: 5000 });
    let last = -1;
    for (let m = 0; m < months; m++) {
      const it = transitOf(s).find(t => t.id === 'tx');
      if (m < months - 1 || s.convoys!.length) {
        expect(it).toBeTruthy();
        expect(it!.progress!).toBeGreaterThan(last); last = it!.progress!;
        expect(it!.title).toContain('→');
      }
      arriveConvoys(s);
      s.turn++;
    }
    expect(s.convoys!.find(v => v.id === 'tx')).toBeUndefined();
    expect(s.cities[to].grain).toBeGreaterThan(g0);
    expect(s.reports.some(r => /运到/.test(r.text))).toBe(true);
  });
  it('目的地被围：在途表上先示警', () => {
    const s = createGame('hongguang', 1);
    const [from, to] = farPair(s);
    applyOrder(s, s.player, { id: 'tx', kind: 'transfer', from, to, grain: 1000, silver: 0 });
    s.sieges[to] = { node: to, attacker: 'qing', armies: [], startTurn: s.turn, months: 1 };
    expect(transitOf(s).find(t => t.id === 'tx')!.warn).toMatch(/被围/);
  });
  it('使者与行军也列入，写明约到之期', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'hongguang')!;
    applyOrder(s, s.player, { id: 'mv', kind: 'army', army: a.id, order: { kind: 'move', target: 'wuchang', attack: false } });
    const it = transitOf(s).find(t => t.kind === 'march');
    expect(it).toBeTruthy();
    expect(etaText(s, it!.eta)).toMatch(/到/);
  });
});
