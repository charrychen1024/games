/* 盟约只是一时之计、一方覆亡是天下大事（2026-11-27 玩家：与清结盟后显示共存即胜不对；电脑要会结盟、攻击、解约；势力灭亡要有重大事件）。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { aiBreakAlliances } from '../src/core/diplomacy';
import { setStance, stance } from '../src/core/state';
import { runMonthAuto } from '../src/core/turn';

describe('背盟', () => {
  it('电脑兵力远胜盟友且相邻：结盟半年后会背盟宣战，玩家为盟友时有急报', () => {
    let broke = false;
    for (let seed = 1; seed <= 40 && !broke; seed++) {
      const s = createGame('xi', seed);
      setStance(s, 'xi', 'hongguang', 'alliance');
      s.chars[s.factions.hongguang.leader].att.hawk = 60;   // 主战之主才会背盟
      s.flags['ally_hongguang_xi'] = s.turn - 12;
      for (let t = 0; t < 12 && !broke; t++) {
        aiBreakAlliances(s);
        if (stance(s, 'xi', 'hongguang') === 'war') broke = true;
        s.turn++;
      }
      if (broke) expect(s.reports.some(r => /背弃盟约/.test(r.text) && r.urgent)).toBe(true);
    }
    expect(broke).toBe(true);
  });
  it('主和之主不背盟', () => {
    const s = createGame('xi', 1);
    setStance(s, 'xi', 'hongguang', 'alliance'); s.flags['ally_hongguang_xi'] = s.turn - 24;
    for (let t = 0; t < 24; t++) { aiBreakAlliances(s); s.turn++; }
    expect(stance(s, 'xi', 'hongguang')).toBe('alliance');
  });
  it('刚结盟不背盟', () => {
    const s = createGame('xi', 1);
    setStance(s, 'xi', 'hongguang', 'alliance');
    aiBreakAlliances(s);
    expect(stance(s, 'xi', 'hongguang')).toBe('alliance');
  });
});

describe('一方覆亡', () => {
  it('城池军队尽失：急报写明亡于何处，所有人都看得到', () => {
    const s0 = createGame('hongguang', 1);
    for (const c of Object.values(s0.cities)) if (c.controller === 'xi') c.controller = 'hongguang';
    for (const a of Object.values(s0.armies)) if (a.faction === 'xi') delete s0.armies[a.id];
    const s = runMonthAuto(s0, []);
    expect(s.factions.xi.defunct).toBe(true);
    const r = s.reports.find(x => x.act === 'fall' && x.from === 'xi');
    expect(r).toBeTruthy();
    expect(r!.urgent).toBe(true);
    expect(r!.text).toMatch(/亡/);
  });
});
