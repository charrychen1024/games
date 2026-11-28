/* 制作要求第六节“十二回合试玩”的验收条件，逐条写成自动测试。 */
import { describe, it, expect } from 'vitest';
import { createSiege, stepSiege, aiCommands, toBattleResult, persuade } from '../src/core/siege';
import { createState1644 } from '../src/data/scenario1644';
import { trialState, yangzhouSiegeState } from '../src/data/presets';
import { runMonthAuto, resolveMonth, type Interrupt, type Answer } from '../src/core/turn';
import { serialize, deserialize } from '../src/core/save';
import { autoResolve, type BattleState } from '../src/core/battle';
import { createField, stepField, aiField, toFieldResult } from '../src/core/field';
import { persuadeChance, envoyScore, obedience } from '../src/core/orders';
import { setStance, stance } from '../src/core/state';
import { turnOf } from '../src/core/calendar';
import type { GameState, Order } from '../src/core/types';

const months = (s: GameState, n: number, orders: Order[][] = []) => { for (let i = 0; i < n; i++) s = runMonthAuto(s, orders[i] ?? []); return s; };

describe('验收一：连续玩满十二个月', () => {
  it('弘光开局十二个月，试玩正常结束', () => {
    let s = trialState();
    let n = 0;
    while (!s.ended && n < 20) { s = runMonthAuto(s, []); n++; }
    expect(n).toBe(12);
    expect(s.ended?.kind).toBe('trial_end');
  });
});

describe('验收二：从月报解释一座城的钱粮变化', () => {
  it('每座城每月的钱粮净变化等于因果账逐项之和', () => {
    const s0 = createState1644();
    const s1 = runMonthAuto(s0, []);
    for (const id of Object.keys(s0.cities)) {
      for (const f of ['grain', 'silver'] as const) {
        const sum = s1.ledger.filter(e => e.turn === 0 && e.node === id && e.field === f).reduce((n, e) => n + e.delta, 0);
        expect(Math.round(s1.cities[id][f] - s0.cities[id][f]), `${id}.${f}`).toBe(Math.round(sum));
      }
    }
  });
  it('募兵过多 → 后来的缺粮急报指回当初那道募兵令', () => {
    let s = createState1644();
    const c = s.cities.chuzhou;
    c.grain = 4000; c.agri = 10; c.silver = 600 * 3 + 500; // 府库仅够募兵，无余银市籴
    const order: Order = { id: 'o-test-recruit', kind: 'recruit', node: 'chuzhou', troops: 600 };
    s = runMonthAuto(s, [order]);
    expect(s.cities.chuzhou.garrison).toBe(3600);
    let found = false;
    for (let i = 0; i < 6 && !found; i++) {
      const r = s.reports.find(r => r.node === 'chuzhou' && r.text.includes('缺粮'));
      if (r) { found = true; expect(r.src).toMatchObject({ kind: 'order', ref: 'o-test-recruit' }); expect(r.text).toContain('募兵'); break; }
      s = runMonthAuto(s, []);
    }
    expect(found).toBe(true);
  });
});

describe('验收三：野战失利后仍能守城', () => {
  it('援军在城下野战败退，城池仍归原主', () => {
    let s = createState1644();
    setStance(s, 'qing', 'hongguang', 'war');
    s.flags.qing_south = 0;
    // 城防满、守军足以撑过一月强攻（攻城战改为即时模拟后，五倍兵力一月破城城防 90 之城是可能的）
    s.cities.sizhou.garrison = 16000; s.cities.sizhou.wall = 100;
    // 弘光一支小军驻泗州城下，清大军来攻
    s.armies.a_shi.location = 'sizhou'; s.armies.a_shi.troops = 4000; s.armies.a_shi.supply = 'sizhou';
    s.armies.a_duoduo.location = 'xuzhou'; s.armies.a_duoduo.supply = 'beijing';
    s.events = [{ id: 'ss_dushi', turn: 0, variant: 'history' }];
    const order: Order = { id: 'q1', kind: 'army', army: 'a_duoduo', order: { kind: 'move', target: 'sizhou', attack: true } };
    // 用电脑命令推一个月：清军的命令由 AI 自己下（倾向会打泗州），这里直接预置
    s.armies.a_duoduo.order = order.order;
    s.armies.a_duoduo.path = ['sizhou'];
    const seen: string[] = [];
    s = runMonthAuto(s, [], it => { if (it.type === 'battle') seen.push(it.battle.kind); return undefined; });
    const field = s.battles.find(b => b.kind === 'field' && b.node === 'sizhou');
    expect(field, '应有一场泗州野战').toBeTruthy();
    expect(field!.winner).toBe('attacker');
    expect(s.cities.sizhou.controller).toBe('hongguang');
    expect(seen[0]).toBe('field');
    // 败军已离开城下
    expect(s.armies.a_shi?.location).not.toBe('sizhou');
  });
});

describe('验收四：献城后改属', () => {
  it('劝降成功：城池控制权转移，主官随之改投', () => {
    const base = createState1644();
    base.events = [{ id: 'ss_dushi', turn: 0, variant: 'history' }];
    // 徐州被清所据，守将降意极高，弘光遣左懋第劝降，并以重兵围城
    base.cities.xuzhou.controller = 'qing'; base.cities.xuzhou.governor = 'libenshen';
    base.chars.libenshen.faction = 'qing'; base.chars.libenshen.att.surrender = 100;
    setStance(base, 'qing', 'hongguang', 'war');
    base.armies.a_shi.location = 'xuzhou'; base.armies.a_shi.troops = 20000;
    base.sieges.xuzhou = { node: 'xuzhou', attacker: 'hongguang', armies: ['a_shi'], startTurn: 0, months: 1 };
    base.armies.a_shi.order = { kind: 'siege', target: 'xuzhou', assault: false };
    expect(persuadeChance(base, 'hongguang', 'zuomaodi', 'xuzhou').p).toBeGreaterThan(0.8);
    let ok = 0;
    for (let k = 0; k < 5; k++) {
      let s = structuredClone(base);
      s = runMonthAuto(s, [{ id: 'persuade-' + k, kind: 'persuade', char: 'zuomaodi', node: 'xuzhou' }]);
      expect(s.missions.filter(m => m.faction === s.player).length).toBe(1); // 跨月：本月出发（电脑各家也可能遣使劝降，不算在内）
      expect(s.cities.xuzhou.controller).toBe('qing');
      s = runMonthAuto(s, []);
      if (s.cities.xuzhou.controller !== 'hongguang') continue;
      ok++;
      expect(s.chars.libenshen.faction).toBe('hongguang');
      expect(s.reports.some(r => r.cat === '易主' && r.text.includes('献城'))).toBe(true);
    }
    expect(ok).toBeGreaterThanOrEqual(3);
  });
  it('攻城战中阵前劝降成功即献城', () => {
    let found = false;
    for (let seed = 1; seed < 40 && !found; seed++) {
      let s = yangzhouSiegeState(seed);
      s.chars.shikefa.att.surrender = 100;
      s.cities.yangzhou.minxin = 10;
      s.chars.haoge.ab.wai = 95;
      s = runMonthAuto(s, [], (it: Interrupt): Answer | undefined => {
        if (it.type !== 'battle' || it.battle.kind !== 'siege') return undefined;
        const b: BattleState = it.battle;
        // 开战即遣使劝降；不成则照常打
        const sim = createSiege(b);
        persuade(sim);
        let next = 0;
        while (!sim.over && sim.t < 3600) { if (sim.t >= next) { aiCommands(sim, 'att'); aiCommands(sim, 'def'); next = sim.t + 2; } stepSiege(sim, 0.2); }
        return { type: 'battle', result: toBattleResult(b, sim), manual: true };
      });
      if (s.battles.some(b => b.node === 'yangzhou' && b.summary.includes('开城出降'))) {
        found = true;
        expect(s.cities.yangzhou.controller).toBe('qing');
      }
    }
    expect(found).toBe(true);
  });
});

describe('验收五：结盟后双方仍保有控制权', () => {
  it('遣使结盟成功后，盟军进入对方城池不会占城，双方城池各归原主', () => {
    let s = createState1644();
    setStance(s, 'qing', 'hongguang', 'war');
    setStance(s, 'shun', 'hongguang', 'neutral');
    s.chars.lizicheng.att.hawk = -60;
    for (const f of Object.keys(s.factions)) s.flags['discord_' + f] = 9999;   // 本条只验控制权，不让别家离间来搅
    const sc = envoyScore(s, 'hongguang', { id: 'e', kind: 'envoy', char: 'zuomaodi', target: 'shun', aim: 'alliance' });
    expect(sc.score).toBeGreaterThanOrEqual(65);
    s = runMonthAuto(s, [{ id: 'e1', kind: 'envoy', char: 'zuomaodi', target: 'shun', aim: 'alliance' }]);
    // 使者按路途远近抵达（南京到西安约两月）
    for (let k = 0; k < 4 && s.missions.some(m => m.id === 'e1'); k++) s = runMonthAuto(s, []);
    s = runMonthAuto(s, []);
    expect(stance(s, 'hongguang', 'shun')).toBe('alliance');
    const shunCities = Object.values(s.cities).filter(c => c.controller === 'shun').map(c => c.id);
    // 顺军开进弘光的安庆
    s.armies.a_bai.location = 'anqing'; s.armies.a_bai.path = []; s.armies.a_bai.progress = 0;
    s = months(s, 3);
    expect(s.cities.anqing.controller).toBe('hongguang');
    expect(s.sieges.anqing).toBeUndefined();
    for (const id of shunCities) if (!s.reports.some(r => r.cat === '易主' && r.node === id)) expect(s.cities[id].controller, id).toBe('shun');
  });
});

describe('验收六：读档后进行中的围城可以继续', () => {
  it('扬州之围：存档 → 读档 → 继续推进，围城持续且结果与未存档一致', () => {
    const s = yangzhouSiegeState();
    expect(s.sieges.yangzhou).toBeTruthy();
    const loaded = deserialize(serialize(s, '扬州')).state;
    expect(loaded.sieges.yangzhou).toEqual(s.sieges.yangzhou);
    const a = runMonthAuto(loaded, []);
    const b = runMonthAuto(s, []);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    // 围城仍在（或已分出胜负）
    const continued = !!a.sieges.yangzhou && a.sieges.yangzhou.months === 2;
    const decided = a.cities.yangzhou.controller === 'qing' || a.battles.some(x => x.node === 'yangzhou');
    expect(continued || decided).toBe(true);
    expect(a.battles.some(x => x.node === 'yangzhou' && x.kind === 'siege')).toBe(true);
  });
  it('跨月行军存读档后照常抵达', () => {
    let s = createState1644();
    s = runMonthAuto(s, [{ id: 'm1', kind: 'army', army: 'a_shi', order: { kind: 'move', target: 'anqing', attack: false } }]);
    const loaded = deserialize(serialize(s, 'x')).state;
    expect(JSON.stringify(months(loaded, 2))).toBe(JSON.stringify(months(s, 2)));
  });
});

describe('验收七：手动战斗与自动结算在相同选择下结果一致', () => {
  it('把自动结算的选择逐回合手动下达，写回局势后完全一致', () => {
    const s = yangzhouSiegeState();
    let viaManual: GameState | null = null, viaAuto: GameState | null = null;
    viaAuto = runMonthAuto(s, [], it => it.type === 'battle' ? { type: 'battle', result: autoResolve(it.battle), manual: false } : undefined);
    viaManual = runMonthAuto(s, [], it => {
      if (it.type !== 'battle') return undefined;
      const b = it.battle;
      if (b.kind === 'siege') {
        // 攻城是即时模拟：逐步推进、每两秒照电脑之令下达，与快进结果一致
        const sim = createSiege(b); let next = 0;
        while (!sim.over && sim.t < 3600) { if (sim.t >= next) { aiCommands(sim, 'att'); aiCommands(sim, 'def'); next = sim.t + 2; } stepSiege(sim, 0.2); }
        return { type: 'battle', result: toBattleResult(b, sim), manual: false };
      }
      // 野战、水战同理
      const fs = createField(b); let nx = 0;
      while (!fs.over && fs.t < 1000) { if (fs.t >= nx) { aiField(fs, 'att'); aiField(fs, 'def'); nx = fs.t + 2; } stepField(fs, 0.2); }
      return { type: 'battle', result: toFieldResult(b, fs), manual: false };
    });
    expect(JSON.stringify(viaManual)).toBe(JSON.stringify(viaAuto));
  });
});

describe('验收八：史事与线索', () => {
  it('条件相符时只触发一次', () => {
    let s = createState1644();
    s = months(s, 6);
    expect(s.events.filter(e => e.id === 'ss_dushi').length).toBe(1);
    expect(s.reports.filter(r => r.text.startsWith('【史可法督师江北】')).length).toBe(1);
  });
  it('条件不符时不触发：扬州未被围也未失守，到四月不会出现“扬州之战”', () => {
    let s = createState1644();
    s.turn = turnOf(1645, 4);
    s = runMonthAuto(s, []);
    expect(s.events.some(e => e.id === 'ss_yangzhou')).toBe(false);
  });
  it('条件改写：扬州被围而未破，史事改写后触发', () => {
    const s = runMonthAuto(yangzhouSiegeState(), []);
    const e = s.events.find(e => e.id === 'ss_yangzhou');
    if (s.cities.yangzhou.controller === 'hongguang') expect(e?.variant).toBe('altered');
    else expect(e?.variant).toBe('history');
  });
  it('线索按时出现，并在人物态度上留下可查的记录', () => {
    let s = createState1644();
    s = months(s, 4);
    expect(s.events.some(e => e.id === 'xs_fushe')).toBe(true);
    const log = s.chars.qianqianyi.attLog.find(l => l.reason === '党争日烈');
    expect(log).toBeTruthy();
    expect(log!.turn).toBe(3);
  });
  it('史事影响人物决定：左良玉若被事先安抚则不起兵', () => {
    let s = createState1644();
    s.turn = turnOf(1645, 3);
    s.factions.zuoliangyu.loyalty = 80;
    s = runMonthAuto(s, []);
    expect(s.events.find(e => e.id === 'ss_zuo_east')?.variant).toBe('altered');
    expect(stance(s, 'zuoliangyu', 'hongguang')).not.toBe('war');
    let t = createState1644();
    t.turn = turnOf(1645, 3);
    t.factions.zuoliangyu.loyalty = 30;
    t = runMonthAuto(t, []);
    expect(t.events.find(e => e.id === 'ss_zuo_east')?.variant).toBe('history');
    expect(stance(t, 'zuoliangyu', 'hongguang')).toBe('war');
  });
});

describe('江北诸镇的服从', () => {
  it('服从高则照办，服从低则抗命，并列出原因', () => {
    const s = createState1644();
    const o = { id: 'c1', kind: 'command' as const, vassal: 'huangdegong', army: 'a_huang', order: { kind: 'move' as const, target: 'chuzhou', attack: false }, silver: 0 };
    s.factions.huangdegong.loyalty = 95; s.chars.huangdegong.att.loyalty = 95;
    expect(obedience(s, 'hongguang', o, false).result).toBe('comply');
    s.factions.huangdegong.loyalty = 10; s.chars.huangdegong.att.loyalty = 10;
    const r = obedience(s, 'hongguang', o, false);
    expect(r.result).toBe('refuse');
    expect(r.factors.join()).toContain('服从度');
  });
  it('犒银能提高服从', () => {
    const s = createState1644();
    const o = { id: 'c2', kind: 'command' as const, vassal: 'gaojie', army: 'a_gao', order: { kind: 'move' as const, target: 'xuzhou', attack: false }, silver: 0 };
    const a = obedience(s, 'hongguang', o, false).score;
    const b = obedience(s, 'hongguang', { ...o, silver: 20000 }, false).score;
    expect(b).toBeGreaterThan(a);
  });
  it('拖延的号令下月自动执行', () => {
    let s = createState1644();
    s.factions.gaojie.loyalty = 55; s.chars.gaojie.att.loyalty = 55;
    const o: Order = { id: 'c3', kind: 'command', vassal: 'gaojie', army: 'a_gao', order: { kind: 'move', target: 'chuzhou', attack: false }, silver: 0 };
    // 找一个结果为“拖延”的种子
    for (let seed = 1; seed < 60; seed++) {
      const t = { ...structuredClone(s), seed };
      const ob = obedience(t, 'hongguang', o as any);
      if (ob.result !== 'delay') continue;
      const t1 = runMonthAuto(t, [o]);
      expect(t1.delayed.length).toBe(1);
      const t2 = runMonthAuto(t1, []);
      expect(t2.delayed.length).toBe(0);
      expect(t2.reports.some(r => r.text.includes('号令高杰部'))).toBe(true);
      return;
    }
    throw new Error('没有找到拖延的种子');
  });
});

describe('玩家参与的战斗会暂停结算，交给界面', () => {
  it('扬州攻城战：玩家守城，生成器给出战局并接受手动结果', () => {
    const gen = resolveMonth(yangzhouSiegeState(), []);
    let r = gen.next();
    let battle: BattleState | null = null;
    while (!r.done) {
      const it = r.value;
      if (it.type === 'battle' && !battle && it.battle.node === 'yangzhou') { battle = it.battle; expect(it.side).toBe('def'); r = gen.next({ type: 'battle', result: autoResolve(it.battle), manual: true }); continue; }
      r = gen.next(undefined);
    }
    expect(battle?.kind).toBe('siege');
    expect(r.value.state.battles.find(b => b.node === 'yangzhou')?.manual).toBe(true);
  });
});
