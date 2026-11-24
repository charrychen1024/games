/* 《视听与动画专项审查》（2026-11-24）与同日补充意见的回归测试：军报按事件原因与当时双方演出、史事按类配声、势力仓廪。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { capture } from '../src/core/military';
import { planNews, actOf } from '../src/ui/newsFx';
import { toneOfTitle, fireEvent } from '../src/core/events';
import { EVENTS } from '../src/data/events';
import { storeOf } from '../src/core/economy';
import { citiesOf } from '../src/core/state';
import type { GameState } from '../src/core/types';

const last = (s: GameState) => s.reports[s.reports.length - 1];

describe('军报讲清发生了什么、与谁有关', () => {
  it('同一城陷城、献城分别记为 breach 与 yield，演出不同', () => {
    const a = createGame('hongguang', 3);
    capture(a, 'zhenjiang', 'qing', '陷城');
    const ra = last(a);
    expect(ra.act).toBe('breach');
    expect(planNews(a, ra).visual).toBe('breach');
    const b = createGame('hongguang', 3);
    capture(b, 'zhenjiang', 'qing', '献城');
    const rb = last(b);
    expect(rb.act).toBe('yield');
    expect(planNews(b, rb).visual).toBe('handover');
    expect(planNews(b, rb).stamp).toBe('献');
  });

  it('得城方、失城方、旁观方听到不同的声音', () => {
    const s = createGame('hongguang', 3);
    const from = s.cities.zhenjiang.controller;
    capture(s, 'zhenjiang', 'qing', '陷城');
    const r = last(s);
    expect(r.from).toBe(from);
    expect(planNews(s, r, 'hongguang').sound).toBe('breachLoss');
    expect(planNews(s, r, 'qing').sound).toBe('breachGain');
    expect(planNews(s, r, 'xi').sound).toBe('breachFar');
  });

  it('旁观清军攻破大顺之城，不播自己失城的锣号', () => {
    const s = createGame('hongguang', 3);
    const shunCity = citiesOf(s, 'shun')[0].id;
    capture(s, shunCity, 'qing', '陷城');
    const p = planNews(s, last(s));
    expect(p.persp).toBe('far');
    expect(p.sound).not.toBe('breachLoss');
  });

  it('退兵、行军这类军报不演成交锋', () => {
    const s = createGame('hongguang', 3);
    const p = planNews(s, { turn: 0, cat: '军报', node: 'nanjing', act: 'march', from: 'hongguang', text: '督师标营原地驻扎。' });
    expect(p.visual).toBe('camp');
    expect(p.sound).toBe('march');
    expect(planNews(s, { turn: 0, cat: '军报', node: 'nanjing', text: '某部自扬州退往南京。' }).visual).toBe('camp');
  });

  it('旧存档里没有 act 的军报从文字认出原因', () => {
    expect(actOf({ turn: 0, cat: '易主', text: '泗州易主（陷城）：清军攻破泗州。' })).toBe('breach');
    expect(actOf({ turn: 0, cat: '易主', text: '刘良佐率部正式归附清朝。' })).toBe('join');
    expect(actOf({ turn: 0, cat: '军报', text: '扬州攻城战：多铎对史可法。' })).toBe('battle');
  });
});

describe('史事按类配声', () => {
  it('不同类型的史事基调不同', () => {
    expect(toneOfTitle('嘉定之屠')).toBe('lament');
    expect(toneOfTitle('扬州之战')).toBe('lament');
    expect(toneOfTitle('多尔衮卒')).toBe('death');
    expect(toneOfTitle('顺治崩，康熙即位')).toBe('death');
    expect(toneOfTitle('剃发令再颁')).toBe('edict');
    expect(toneOfTitle('李成栋广东反正')).toBe('turn');
    expect(toneOfTitle('永历即位肇庆')).toBe('court');
    expect(toneOfTitle('张献忠破成都')).toBe('war');
  });

  it('全部史事至少分出五种基调，且每条触发的军报都带基调和配声', () => {
    const tones = new Set(EVENTS.map(e => e.tone ?? toneOfTitle(e.title)));
    expect(tones.size).toBeGreaterThanOrEqual(5);
    const s = createGame('hongguang', 3);
    for (const def of EVENTS.slice(0, 12)) {
      const n = s.reports.length;
      try { fireEvent(s, def, 'history'); } catch { continue; }
      const r = s.reports.slice(n).find(x => x.cat === '史事' || x.cat === '线索');
      if (!r) continue;
      expect(r.tone).toBeTruthy();
      expect(planNews(s, r).sound.startsWith('ev:')).toBe(true);
    }
  });

  it('各类军报都有配声，不会无声', () => {
    const s = createGame('hongguang', 3);
    for (const cat of ['急报', '军报', '内政', '交涉', '人事', '史事', '线索', '易主'] as const) {
      expect(planNews(s, { turn: 0, cat, node: 'nanjing', text: '某事。' }).sound).toBeTruthy();
    }
  });
});

describe('势力仓廪', () => {
  it('左上角仓廪是本势力所有城池的总数，不是某一城', () => {
    const s = createGame('hongguang', 3);
    const own = citiesOf(s, 'hongguang');
    expect(own.length).toBeGreaterThan(1);
    const st = storeOf(s, 'hongguang');
    expect(st.grain).toBe(own.reduce((n, c) => n + c.grain, 0));
    expect(st.silver).toBe(own.reduce((n, c) => n + c.silver, 0));
    expect(st.cities).toBe(own.length);
  });
});

import { dueEvents, choiceFor } from '../src/core/events';
import { runMonthAuto } from '../src/core/turn';
import { hostile } from '../src/core/state';

describe('史事不替玩家势力做决定', () => {
  const byId = (id: string) => EVENTS.find(e => e.id === id)!;
  it('玩家为大西、未取成都：不播"张献忠破成都"，也不编"攻成都未克"', () => {
    const s = createGame('xi', 3);
    s.turn = byId('ss_chengdu').to;
    const due = dueEvents(s, [byId('ss_chengdu')]);
    expect(due[0]?.variant).toBe('player');
    fireEvent(s, byId('ss_chengdu'), 'player');
    const r = last(s);
    expect(r.text).not.toMatch(/破成都。|攻成都未克/);
    expect(r.text).toContain('由你作主');
  });
  it('电脑操控大西时照史实运行', () => {
    const s = createGame('hongguang', 3);
    s.cities.chengdu.controller = 'xi';
    s.turn = byId('ss_chengdu').from;
    expect(dueEvents(s, [byId('ss_chengdu')])[0]?.variant).toBe('history');
  });
  it('大西建国、清廷南下、迁界、马阮掌权交给相应玩家抉择', () => {
    const cases: [string, string][] = [['ss_daxi', 'xi'], ['ss_qing_south', 'qing'], ['xs_qianjie', 'qing'], ['ss_mashiying', 'hongguang'], ['ss_zheng_feng', 'hongguang']];
    for (const [id, f] of cases) {
      const s = createGame(f, 3);
      expect(choiceFor(s, byId(id), 'history'), id).not.toBeNull();
    }
  });
  it('玩家为清：清廷南下不自动宣战，须玩家选定', () => {
    const s = createGame('qing', 3);
    const def = byId('ss_qing_south');
    fireEvent(s, def, 'history');
    expect(hostile(s, 'qing', 'hongguang')).toBe(false);
  });
  it('玩家为清：李定国桂林大捷、衡州斩尼堪不凭空判胜负', () => {
    const s = createGame('qing', 3);
    s.turn = byId('ss_guilin_victory').to;
    expect(dueEvents(s, [byId('ss_guilin_victory')])[0]?.variant ?? 'player').toBe('player');
  });
  it('整局自动推进不出错（大西种子 3 二十个月）', () => {
    let s = createGame('xi', 3);
    for (let i = 0; i < 20; i++) s = runMonthAuto(s, []);
    expect(s.reports.some(r => r.text.includes('张献忠破成都') && !r.text.includes('由你作主') && s.flags.lost_how_chengdu === undefined)).toBe(false);
  });
});
