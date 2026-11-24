/* 《完整剧本质量复盘》（2026-11-24）所列问题的回归测试。编号对应复盘文档。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { runMonthAuto, unificationProgress, playerSideOf } from '../src/core/turn';
import { defectFaction } from '../src/core/military';
import { saveTo, loadFrom, SLOTS, type KV } from '../src/core/save';
import type { GameState } from '../src/core/types';
import { EVENTS } from '../src/data/events';
import { dueEvents, fireEvent, applyChoice, choiceFor } from '../src/core/events';
import { turnOf } from '../src/core/calendar';
import { capture } from '../src/core/military';
import { validateOrder, applyOrder } from '../src/core/orders';
import { citiesOf } from '../src/core/state';

/** 模拟浏览器本地存储：按字符计的总配额（Chromium 约五百万个 UTF-16 字符） */
function quotaKV(limit = 5_000_000): KV {
  const m = new Map<string, string>();
  const used = () => [...m].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get: k => m.get(k) ?? null,
    set: (k, v) => { const old = m.get(k)?.length ?? 0; if (used() - old + v.length + k.length > limit) return false; m.set(k, v); return true; },
    remove: k => void m.delete(k), keys: () => [...m.keys()],
  };
}

describe('02 长局四个存档槽可同时保存', () => {
  it('清方种子 7 第 24、72 月：自动档与三个手动档共存，读回可续玩', () => {
    let s: GameState = createGame('qing', 7);
    for (const T of [24, 72]) {
      while (s.turn < T) s = runMonthAuto(s, []);
      const kv = quotaKV();
      for (const slot of SLOTS) expect(saveTo(kv, slot, s, '第' + T + '月 ' + slot)).toBe(true);
      for (const slot of SLOTS) {
        const f = loadFrom(kv, slot)!;
        expect(f.label).toBe('第' + T + '月 ' + slot);
        expect(f.state.turn).toBe(s.turn);
        expect(Object.keys(f.state.cities).length).toBe(Object.keys(s.cities).length);
        // 本月钱粮来由与近六个月的命令记录仍在
        expect(f.state.ledger.filter(e => e.turn === s.turn - 1).length).toBe(s.ledger.filter(e => e.turn === s.turn - 1).length);
        expect(f.state.reports.length).toBe(s.reports.length);
      }
      const next = runMonthAuto(loadFrom(kv, '2')!.state, []);
      expect(next.turn).toBe(s.turn + 1);
    }
  }, 60000);
});

describe('03 劝降一城只转移当地，军镇之主才可携部归附', () => {
  it('何腾蛟献长沙：只长沙与其本人改投，各省明官府其余城池不动，另推主事', () => {
    const s = createGame('qing', 0);
    const before = citiesOf(s, 'mingprov').length;
    capture(s, 'changsha', 'qing', '献城');
    expect(s.cities.changsha.controller).toBe('qing');
    expect(s.chars.hetengjiao.faction).toBe('qing');
    expect(citiesOf(s, 'mingprov').length).toBe(before - 1);
    expect(s.factions.mingprov.overlord).toBe('hongguang');
    expect(s.factions.mingprov.leader).not.toBe('hetengjiao');
    expect(s.factions.mingprov.capital).not.toBe('changsha');
  });
  it('黄得功献庐州：一镇之主携全镇归附', () => {
    const s = createGame('qing', 0);
    capture(s, 'luzhou', 'qing', '献城');
    expect(s.factions.huangdegong.overlord).toBe('qing');
  });
  it('同月向同一城只能派一路劝降使者', () => {
    const s = createGame('qing', 0);
    const envoys = Object.values(s.chars).filter(c => c.faction === 'qing' && c.status === 'active' && !Object.values(s.armies).some(a => a.commander === c.id));
    const o1 = { id: 'p1', kind: 'persuade' as const, char: envoys[0].id, node: 'changsha' };
    expect(validateOrder(s, 'qing', o1)).toBeNull();
    applyOrder(s, 'qing', o1);
    expect(validateOrder(s, 'qing', { id: 'p2', kind: 'persuade', char: envoys[1].id, node: 'changsha' })).toMatch(/已有使者/);
  });
});

describe('04 盟约、停战保留独立；正式归附、灭亡才计入统一', () => {
  const endgame = () => {
    const s = createGame('hongguang', 0);
    for (const c of Object.values(s.cities)) c.controller = 'hongguang';
    s.cities.shengjing && (s.cities.shengjing.controller = 'qing');
    for (const f of Object.values(s.factions)) if (!['hongguang', 'qing'].includes(f.id)) f.defunct = true;
    for (const a of Object.values(s.armies)) delete s.armies[a.id];
    return s;
  };
  it('与清结盟：清仍是对手，不宣布统一', () => {
    const s = endgame();
    s.relations['hongguang|qing'] = { stance: 'alliance' };
    expect(unificationProgress(s).rivals).toContain(s.factions.qing.name);
    expect(runMonthAuto(s, []).ended?.kind).not.toBe('unified');
  });
  it('与清停战：同样不算统一', () => {
    const s = endgame();
    s.relations['hongguang|qing'] = { stance: 'truce', until: 99 };
    expect(unificationProgress(s).rivals.length).toBe(1);
  });
  it('清正式归附：计入统一', () => {
    const s = endgame();
    s.factions.qing.overlord = 'hongguang';
    expect(unificationProgress(s).rivals.length).toBe(0);
  });
});

describe('06 军镇易帜后，原主号令作废', () => {
  it('黄得功部受弘光号令后降清，再攻弘光直辖军：玩家指挥守方', () => {
    const s = createGame('hongguang', 0);
    const hd = Object.values(s.armies).find(a => a.faction === 'huangdegong')!;
    const mine = Object.values(s.armies).find(a => a.faction === 'hongguang')!;
    s.flags['commanded_' + hd.id] = s.turn;
    defectFaction(s, 'huangdegong', 'qing');
    s.flags['commanded_' + hd.id] = s.turn;   // 即使旧标记残留，也须按当下隶属复核
    const b = { att: { faction: 'huangdegong', armies: [hd.id] }, def: { faction: 'hongguang', armies: [mine.id] } } as any;
    expect(playerSideOf(s, b)).toBe('def');
  });
});

const def = (id: string) => EVENTS.find(e => e.id === id)!;
describe('05 史事不覆盖本局事实', () => {
  it('剃发令：严令与暂缓的民心后果不同', () => {
    const base = createGame('qing', 1);
    base.cities.nanjing.controller = 'qing';
    base.turn = turnOf(1645, 6);
    const run = (k: number) => {
      const s = structuredClone(base);
      const d = def('ss_tifa');
      fireEvent(s, d, 'history');
      applyChoice(s, d, choiceFor(s, d, 'history')!.choices[k]);
      return s.cities.nanjing.minxin;
    };
    const strict = run(0), lenient = run(1);
    expect(lenient).toBeGreaterThan(strict + 4);
  });
  it('嘉定之屠：松江仍属明、未颁严令，只作史实提示，不扣民心', () => {
    const s = createGame('qing', 1);
    s.turn = turnOf(1645, 8);
    const d = dueEvents(s, EVENTS).find(x => x.def.id === 'xs_jiading');
    expect(d?.variant).toBe('altered');
    const before = s.cities.songjiang.minxin;
    fireEvent(s, d!.def, d!.variant);
    expect(s.cities.songjiang.minxin).toBe(before);
    expect(s.reports[s.reports.length - 1].text).toContain('本局未发生');
  });
  it('郑氏分裂：清已据厦门时，郑成功不白得厦门与守军', () => {
    const s = createGame('zheng', 1);
    s.cities.xiamen.controller = 'qing'; s.cities.xiamen.garrison = 45000;
    s.turn = turnOf(1646, 10);
    const d = def('ss_zhilong');
    applyChoice(s, d, choiceFor(s, d, 'history')!.choices[0]);
    expect(s.cities.xiamen.controller).toBe('qing');
  });
  it('郑芝龙降清须清军入闽，单靠到了年末不触发', () => {
    const s = createGame('zheng', 1);
    s.turn = turnOf(1646, 12);
    expect(dueEvents(s, EVENTS).some(x => x.def.id === 'ss_zhilong')).toBe(false);
  });
  it('顺治身后：玄烨继位为清主，不由早已去世的济尔哈朗主事', () => {
    const s = createGame('hongguang', 1);
    s.turn = turnOf(1655, 5);
    fireEvent(s, def('ss_jierhalang_end'), 'history');
    expect(s.chars.jierhalang.status).toBe('dead');
    s.factions.qing.leader = 'fulin';
    s.turn = turnOf(1661, 1);
    fireEvent(s, def('ss_shunzhi_end'), 'history');
    expect(s.factions.qing.leader).toBe('xuanye');
    expect(s.chars.xuanye.status).toBe('active');
  });
});
