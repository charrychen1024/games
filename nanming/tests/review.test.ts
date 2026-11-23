/* 《十二回合试玩独立审查》（2026-11-23）所列问题的回归测试。编号对应审查文档。 */
import { describe, it, expect } from 'vitest';
import { createState1644 } from '../src/data/scenario1644';
import { yangzhouSiegeState } from '../src/data/presets';
import { EVENTS } from '../src/data/events';
import { dueEvents, fireEvent } from '../src/core/events';
import { capture } from '../src/core/military';
import { validateOrder, applyOrder, recruitLeft } from '../src/core/orders';
import { saveTo, loadFrom, memoryKV, type KV } from '../src/core/save';
import { runMonthAuto } from '../src/core/turn';
import { monthlyIncome } from '../src/core/economy';
import type { GameState } from '../src/core/types';

const yzEvent = EVENTS.find(e => e.id === 'ss_yangzhou')!;
const due = (s: GameState, id: string) => dueEvents(s, EVENTS).find(d => d.def.id === id);
const lastText = (s: GameState) => s.reports[s.reports.length - 1].text;
function clearYangzhouSiege(s: GameState) {
  delete s.sieges.yangzhou;
  for (const a of Object.values(s.armies)) if (a.location === 'yangzhou' && a.faction === 'qing') { a.location = 'sizhou'; a.order = { kind: 'hold' }; }
}

describe('01 扬州之战按本局实际易主方式叙述', () => {
  it('强攻陷城：史实分支，史可法守城被执', () => {
    const s = yangzhouSiegeState();
    capture(s, 'yangzhou', 'qing', '陷城', 'duoduo');
    const d = due(s, 'ss_yangzhou')!;
    expect(d.variant).toBe('history');
    const mx = s.cities.suzhou.minxin;
    fireEvent(s, d.def, d.variant);
    expect(lastText(s)).toContain('城破');
    expect(lastText(s)).toContain('史可法');
    expect(s.cities.suzhou.minxin).toBeLessThan(mx);
  });
  it('强攻陷城但史可法不在城中：不写他被执', () => {
    const s = yangzhouSiegeState();
    s.cities.yangzhou.governor = undefined;
    s.chars.shikefa.location = 'nanjing';
    capture(s, 'yangzhou', 'qing', '陷城', 'duoduo');
    const d = due(s, 'ss_yangzhou')!;
    fireEvent(s, d.def, d.variant);
    expect(lastText(s)).not.toContain('被执');
    expect(s.chars.shikefa.status).toBe('active');
  });
  it('谈判献城：不触发城破与屠城，月报写开城', () => {
    const s = yangzhouSiegeState();
    capture(s, 'yangzhou', 'qing', '献城', 'duoduo');
    expect(s.cities.yangzhou.controller).toBe('qing');
    const d = due(s, 'ss_yangzhou')!;
    expect(d.variant).toBe('altered');
    const mx = s.cities.suzhou.minxin;
    fireEvent(s, d.def, d.variant);
    expect(lastText(s)).toContain('开城');
    expect(lastText(s)).not.toContain('屠');
    expect(lastText(s)).not.toContain('城破');
    expect(s.cities.suzhou.minxin).toBe(mx);
  });
  it('继续围困：改写为死守', () => {
    const s = yangzhouSiegeState();
    const d = due(s, 'ss_yangzhou')!;
    expect(d.variant).toBe('altered');
    fireEvent(s, d.def, d.variant);
    expect(lastText(s)).toContain('固守');
  });
  it('成功解围：改写为解围', () => {
    const s = yangzhouSiegeState();
    clearYangzhouSiege(s);
    const d = due(s, 'ss_yangzhou')!;
    expect(d.variant).toBe('altered');
    fireEvent(s, d.def, d.variant);
    expect(lastText(s)).toContain('解');
    expect(lastText(s)).not.toContain('城破');
  });
  it('清军从未围扬州：不发生“扬州之战”', () => {
    const s = createState1644();
    s.turn = yzEvent.to;
    expect(due(s, 'ss_yangzhou')).toBeUndefined();
  });
});

describe('02 存档写入失败要如实反馈', () => {
  const failing = (inner: KV): KV => ({ ...inner, set: () => false });
  it('写入失败返回 false，旧档保留', () => {
    const kv = memoryKV();
    const s = createState1644();
    expect(saveTo(kv, '1', s, '旧档')).toBe(true);
    const bad = failing(kv);
    const s2 = runMonthAuto(s, []);
    expect(saveTo(bad, '1', s2, '新档')).toBe(false);
    expect(loadFrom(kv, '1')!.label).toBe('旧档');
  });
});

describe('04 同城同月募兵累计不超过上限', () => {
  it('分批募兵合计受上限约束，跨月重置', () => {
    let s = createState1644();
    const c = s.cities.nanjing;
    c.silver = 1e7;
    const cap = recruitLeft(s, 'nanjing');
    const half = Math.floor(cap / 200) * 100 + 100;
    applyOrder(s, 'hongguang', { id: 'r1', kind: 'recruit', node: 'nanjing', troops: half });
    applyOrder(s, 'hongguang', { id: 'r2', kind: 'recruit', node: 'nanjing', troops: half });
    const g0 = c.garrison;
    applyOrder(s, 'hongguang', { id: 'r3', kind: 'recruit', node: 'nanjing', troops: half });
    expect(c.garrison).toBe(g0);
    expect(validateOrder(s, 'hongguang', { id: 'r4', kind: 'recruit', node: 'nanjing', troops: half })).toMatch(/最多/);
    s = runMonthAuto(s, []);
    expect(recruitLeft(s, 'nanjing')).toBeGreaterThan(half);
  });
});

describe('05 一人只任一城主官', () => {
  it('调任后卸去旧职，收入不再重复套用', () => {
    const s = createState1644();
    applyOrder(s, 'hongguang', { id: 'a1', kind: 'appoint', node: 'nanjing', char: 'mashiying' });
    expect(s.cities.nanjing.governor).toBe('mashiying');
    applyOrder(s, 'hongguang', { id: 'a2', kind: 'appoint', node: 'yangzhou', char: 'mashiying' });
    expect(s.cities.yangzhou.governor).toBe('mashiying');
    expect(s.cities.nanjing.governor).toBeUndefined();
    expect(s.chars.mashiying.location).toBe('yangzhou');
    const govs = Object.values(s.cities).filter(c => c.governor === 'mashiying');
    expect(govs.length).toBe(1);
    expect(monthlyIncome(s, s.cities.nanjing).silver).toBeGreaterThan(0);
  });
});

describe('06 被围之城，城外钱粮送不进去', () => {
  it('被围时调拨被拒，解围后可送达', () => {
    const s = yangzhouSiegeState();
    const o = { id: 't1', kind: 'transfer' as const, from: 'nanjing', to: 'yangzhou', grain: 10000, silver: 0 };
    expect(validateOrder(s, 'hongguang', o)).toMatch(/被围/);
    const g = s.cities.yangzhou.grain;
    applyOrder(s, 'hongguang', o);
    expect(s.cities.yangzhou.grain).toBe(g);
    clearYangzhouSiege(s);
    expect(validateOrder(s, 'hongguang', o)).toBeNull();
    applyOrder(s, 'hongguang', o);
    expect(s.cities.yangzhou.grain).toBe(g + 10000);
  });
  it('被围之城也调不出去', () => {
    const s = yangzhouSiegeState();
    expect(validateOrder(s, 'hongguang', { id: 't2', kind: 'transfer', from: 'yangzhou', to: 'nanjing', grain: 1000, silver: 0 })).toMatch(/被围/);
  });
});

describe('07 史事与人物、部队位置一致', () => {
  it('高、黄两部相距甚远时不发生土桥之役', () => {
    const s = createState1644();
    s.turn = 4;
    s.armies.a_gao.location = 'beijing';
    s.armies.a_huang.location = 'chengdu';
    expect(due(s, 'ss_tuqiao')).toBeUndefined();
  });
  it('两部同在江北时可以发生', () => {
    const s = createState1644();
    s.turn = 4;
    s.armies.a_gao.location = 'yangzhou';
    s.armies.a_huang.location = 'yizhen';
    expect(due(s, 'ss_tuqiao')).toBeDefined();
  });
  it('扬州样稿：左良玉已死，左梦庚继统，军报与势力、军队一致', () => {
    const s = yangzhouSiegeState();
    expect(s.chars.zuoliangyu.status).toBe('dead');
    expect(s.factions.zuoliangyu.leader).toBe('zuomenggeng');
    expect(s.armies.a_zuo.commander).toBe('zuomenggeng');
    expect(s.reports.some(r => r.text.includes('左梦庚继统'))).toBe(true);
  });
});
