import { describe, it, expect } from 'vitest';
import { createState1644 } from '../src/data/scenario1644';
import { runMonthAuto, resolveMonth } from '../src/core/turn';
import { serialize, deserialize } from '../src/core/save';
import type { GameState } from '../src/core/types';

function play(n: number, s: GameState = createState1644()) {
  for (let i = 0; i < n; i++) s = runMonthAuto(s, []);
  return s;
}

describe('月度结算', () => {
  it('不修改输入局势', () => {
    const s = createState1644();
    const snap = JSON.stringify(s);
    runMonthAuto(s, []);
    expect(JSON.stringify(s)).toBe(snap);
  });
  it('同一局势与命令，结果完全一致（可复现）', () => {
    expect(JSON.stringify(play(6))).toBe(JSON.stringify(play(6)));
  });
  it('连续推进十二个月不出错，回合与月报正常', () => {
    let s = createState1644();
    s.turnLimit = 12;
    for (let i = 0; i < 12; i++) {
      const before = s.turn;
      s = runMonthAuto(s, []);
      if (!s.ended) expect(s.turn).toBe(before + 1);
      expect(s.reports.some(r => r.turn === before)).toBe(true);
      for (const c of Object.values(s.cities)) {
        for (const k of ['grain', 'silver', 'garrison', 'pop'] as const) expect(Number.isFinite(c[k]) && c[k] >= 0, `${c.id}.${k}=${c[k]}`).toBe(true);
      }
      for (const a of Object.values(s.armies)) expect(a.troops, a.id).toBeGreaterThanOrEqual(0);
    }
    expect(s.ended?.kind).toBe('trial_end');
    expect(s.turn).toBe(11);
  });
  it('存档后读档，继续推进与不存档结果一致', () => {
    const s = play(4);
    const loaded = deserialize(serialize(s, 't')).state;
    expect(JSON.stringify(play(3, loaded))).toBe(JSON.stringify(play(3, s)));
  });
  it('首年史事与线索按时出现，且每条只触发一次', () => {
    const s = play(12);
    const ids = s.events.map(e => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['xs_jiashen', 'ss_dushi', 'ss_mashiying', 'ss_letter', 'xs_sanan']) expect(ids, id).toContain(id);
    expect(ids.filter(i => i.startsWith('xs_')).length).toBeGreaterThanOrEqual(8);
    expect(ids.filter(i => i.startsWith('ss_')).length).toBeGreaterThanOrEqual(8);
  });
  it('遇到玩家的史事抉择时暂停', () => {
    const gen = resolveMonth(createState1644(), []);
    let r = gen.next();
    const kinds: string[] = [];
    while (!r.done) { kinds.push(r.value.type); r = gen.next(r.value.type === 'choice' ? { type: 'choice', index: 1 } : undefined); }
    expect(kinds).toContain('choice');
  });
});
