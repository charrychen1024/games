import { describe, it, expect } from 'vitest';
import { NODES, NODE, ROUTES, shortestPath, VICTORY_AREAS } from '../src/data/geography';
import { createState1644 } from '../src/data/scenario1644';
import { POLITIES } from '../src/data/factions';

const s = createState1644();
const playable = NODES.filter(n => n.kind !== 'outland');

describe('开局数据完整', () => {
  it('节点 id 唯一，路线两端存在且不重复', () => {
    expect(new Set(NODES.map(n => n.id)).size).toBe(NODES.length);
    const seen = new Set<string>();
    for (const r of ROUTES) {
      expect(NODE[r.a], r.a).toBeTruthy();
      expect(NODE[r.b], r.b).toBeTruthy();
      expect(r.days).toBeGreaterThan(0);
      const k = [r.a, r.b].sort().join('|') + r.kind;
      expect(seen.has(k), k).toBe(false);
      seen.add(k);
    }
  });
  it('细做节点三四十个以上，且全图连通（不走海路也能互达）', () => {
    expect(playable.filter(n => n.detail).length).toBeGreaterThanOrEqual(35);
    for (const n of playable) expect(shortestPath('nanjing', n.id, false), n.id).not.toBeNull();
  });
  it('每个可争夺节点都有城池记录，控制者是已知势力', () => {
    for (const n of playable) {
      const c = s.cities[n.id];
      expect(c, n.id).toBeTruthy();
      expect(s.factions[c.controller], n.id).toBeTruthy();
      if (c.governor) expect(s.chars[c.governor], c.governor).toBeTruthy();
      expect(VICTORY_AREAS.includes(n.area) || n.area === '辽东', n.id).toBe(true);
    }
  });
  it('人物、军队、势力的引用都存在', () => {
    for (const c of Object.values(s.chars)) {
      expect(s.factions[c.faction], c.id).toBeTruthy();
      expect(NODE[c.location], c.id).toBeTruthy();
    }
    for (const a of Object.values(s.armies)) {
      expect(s.chars[a.commander], a.id).toBeTruthy();
      expect(s.chars[a.commander].faction, a.id).toBe(a.faction);
      expect(s.cities[a.location], a.id).toBeTruthy();
      expect(s.cities[a.supply], a.id).toBeTruthy();
      const m = a.mix; expect(m.inf + m.cav + m.gun + m.navy).toBeCloseTo(1, 5);
    }
    for (const f of Object.values(s.factions)) {
      expect(POLITIES[f.polity], f.id).toBeTruthy();
      if (f.leader) expect(s.chars[f.leader]?.faction, f.id).toBe(f.id);
      if (f.overlord) expect(s.factions[f.overlord], f.id).toBeTruthy();
    }
  });
  it('五家可选势力都在图上', () => {
    for (const id of ['hongguang', 'qing', 'shun', 'xi', 'zheng']) {
      expect(s.factions[id].playable).toBe(true);
      expect(Object.values(s.cities).some(c => c.controller === id), id).toBe(true);
    }
  });
});
