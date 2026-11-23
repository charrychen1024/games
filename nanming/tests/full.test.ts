/* 完整剧本：五家可选、继统与正统转移、势力分裂、人才出仕、全期史事、统一结算。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { resolveMonth, runMonthAuto, unificationProgress } from '../src/core/turn';
import { captureChar } from '../src/core/military';
import { courtOf, polityOf, successionOptions, applySuccession } from '../src/core/regime';
import { runTalent } from '../src/core/talent';
import { dateLabel, turnOf, TOTAL_TURNS } from '../src/core/calendar';
import { EVENTS } from '../src/data/events';
import { dueEvents, fireEvent } from '../src/core/events';
import { citiesOf } from '../src/core/state';
import { VICTORY_AREAS, NODE, shortestPath, marchPlan } from '../src/data/geography';
import type { GameState } from '../src/core/types';

const PLAYABLE = ['hongguang', 'qing', 'shun', 'xi', 'zheng'];
const due = (s: GameState, id: string) => dueEvents(s, EVENTS).find(d => d.def.id === id);

/** 推进一月，收集所有中断（战斗自动、抉择按 pick） */
function month(s: GameState, pick: (title: string, labels: string[]) => number = () => 0) {
  const gen = resolveMonth(s, []);
  const seen: string[] = [];
  let r = gen.next();
  while (!r.done) {
    const it = r.value;
    if (it.type === 'choice') { seen.push(it.choice.title); r = gen.next({ type: 'choice', index: pick(it.choice.title, it.choice.options.map(o => o.label)) }); }
    else r = gen.next(undefined);
  }
  return { s: r.value.state, seen };
}

describe('五家均可选', () => {
  it('五家都能开局，玩家即该势力，剧本到壬寅年末', () => {
    for (const f of PLAYABLE) {
      const s = createGame(f, 7);
      expect(s.player).toBe(f);
      expect(s.scenario).toBe('full');
      expect(s.turnLimit).toBeUndefined();
      expect(citiesOf(s, f).length).toBeGreaterThan(0);
    }
    expect(() => createGame('local')).toThrow();
    expect(TOTAL_TURNS).toBeGreaterThan(220);
  });
  it('统一进度按计入统一的地区计算，地区清单可查', () => {
    const s = createGame('qing');
    const u = unificationProgress(s);
    expect(u.total).toBe(Object.values(s.cities).filter(c => VICTORY_AREAS.includes(NODE[c.id].area)).length);
    expect(u.rivals.length).toBeGreaterThan(0);
  });
  it('一家独占计入统一的全部城池且对手尽退，即统一天下', () => {
    let s = createGame('qing');
    for (const c of Object.values(s.cities)) c.controller = 'qing';
    for (const f of Object.values(s.factions)) if (f.id !== 'qing') f.defunct = true;
    for (const a of Object.values(s.armies)) if (a.faction !== 'qing') delete s.armies[a.id];
    s = runMonthAuto(s, []);
    expect(s.ended?.kind).toBe('unified');
  });
});

describe('继统：君主被俘后玩家议定监国、另立、迎回或权臣主事', () => {
  it('弘光帝被执，玩家得到继统抉择，另立宗室则改元', () => {
    const s0 = createGame('hongguang');
    captureChar(s0, 'zhuyousong', 'qing', '出奔芜湖');
    expect(s0.flags.need_succession_hongguang).toBeTruthy();
    const opts = successionOptions(s0, 'hongguang');
    const kinds = opts.map(o => o.kind);
    expect(kinds).toContain('enthrone');
    expect(kinds).toContain('regent');
    expect(kinds).toContain('ransom');
    expect(kinds).toContain('minister');
    // 走一遍月结算：出现“议立新君”，选第一项（拥立）
    const { s, seen } = month(s0, t => 0);
    expect(seen).toContain('议立新君');
    const lead = s.chars[s.factions.hongguang.leader];
    expect(lead.royal).toBeTruthy();
    expect(dateLabel(polityOf(s, 'ming'), s.turn)).toContain(lead.royal!.era.replace(/^监国/, '监国'));
  });
  it('权臣主事：不改元，下属服从下降', () => {
    const s = createGame('hongguang');
    captureChar(s, 'zhuyousong', 'qing', '出奔');
    const before = s.factions.huangdegong.loyalty!;
    const opt = successionOptions(s, 'hongguang').find(o => o.kind === 'minister')!;
    applySuccession(s, 'hongguang', opt);
    expect(s.factions.huangdegong.loyalty!).toBeLessThan(before);
    expect(s.chars[s.factions.hongguang.leader].royal).toBeUndefined();
  });
  it('电脑一方自动拥立，不打断玩家', () => {
    const s0 = createGame('qing');
    captureChar(s0, 'zhuyousong', 'qing', '出奔');
    const { s, seen } = month(s0);
    expect(seen).not.toContain('议立新君');
    expect(s.chars[s.factions.hongguang.leader].royal).toBeTruthy();
  });
});

describe('明室正统转移', () => {
  it('弘光朝廷覆亡，奉明而城最多的势力继承正统并拥立宗室', () => {
    let s = createGame('qing');
    for (const c of citiesOf(s, 'hongguang')) c.controller = 'qing';
    for (const a of Object.values(s.armies)) if (a.faction === 'hongguang') delete s.armies[a.id];
    s = runMonthAuto(s, []);
    expect(s.factions.hongguang.defunct).toBe(true);
    const court = courtOf(s)!;
    expect(court).toBeTruthy();
    expect(court).not.toBe('hongguang');
    expect(s.factions[court].overlord).toBeUndefined();
    expect(s.chars[s.factions[court].leader].royal).toBeTruthy();
    expect(s.factions[court].name).toMatch(/朝廷/);
  });
});

describe('势力分裂：玩家选择延续哪一支', () => {
  function zhilongState(): GameState {
    const s = createGame('zheng');
    s.turn = turnOf(1646, 11);
    s.cities.fuzhou.controller = 'qing';
    return s;
  }
  it('随郑成功起兵：玩家改领郑成功部，据中左所，有船队；郑芝龙一支改奉清', () => {
    const { s, seen } = month(zhilongState(), (t, labels) => t === '郑芝龙降清' ? labels.findIndex(l => l.includes('郑成功')) : 0);
    expect(seen).toContain('郑芝龙降清');
    expect(s.player).toBe('zhengcg');
    expect(s.cities.xiamen.controller).toBe('zhengcg');
    expect(Object.values(s.armies).some(a => a.faction === 'zhengcg' && a.mix.navy >= 0.3)).toBe(true);
    expect(s.factions.zheng.overlord).toBe('qing');
    expect(s.chars.zhengzhilong.status).toBe('captured');
  });
  it('随郑芝龙归清：玩家仍领郑氏，改奉清；郑成功另成一家', () => {
    const { s } = month(zhilongState(), (t, labels) => t === '郑芝龙降清' ? labels.findIndex(l => l.includes('郑芝龙归清')) : 0);
    expect(s.player).toBe('zheng');
    expect(s.factions.zheng.overlord).toBe('qing');
    expect(s.factions.zhengcg).toBeTruthy();
  });
});

describe('教育与人才', () => {
  it('到期出仕；志在抗清者不仕清，改投就近奉明之势力', () => {
    const s = createGame('hongguang');
    s.turn = turnOf(1645, 6);
    s.cities.suzhou.controller = 'qing';
    runTalent(s);
    const gu = s.chars.guyanwu;
    expect(gu.status).toBe('active');
    expect(s.factions[gu.faction].polity).toBe('ming');
    // 主和的吴伟业则仕清
    expect(s.chars.wuweiye.faction).toBe('qing');
  });
  it('乡里文教凋零则人才不出', () => {
    const s = createGame('hongguang');
    s.turn = turnOf(1645, 6);
    s.cities.shaoxing.edu = 20;
    runTalent(s);
    expect(s.chars.huangzongxi.status).toBe('offstage');
  });
});

describe('全期史事按局势触发', () => {
  it('李成栋只有在降清且清据广州时才反正', () => {
    const s = createGame('qing');
    s.turn = turnOf(1648, 4);
    expect(due(s, 'ss_lichengdong')).toBeUndefined();
    s.cities.guangzhou.controller = 'qing';
    s.chars.lichengdong.faction = 'qing';
    const d = due(s, 'ss_lichengdong')!;
    expect(d).toBeTruthy();
    fireEvent(s, d.def, d.variant);
    expect(s.cities.guangzhou.controller).toBe(courtOf(s));
    expect(s.chars.lichengdong.faction).toBe(courtOf(s));
  });
  it('剃发令：清为玩家时可选择缓行', () => {
    const s0 = createGame('qing');
    s0.turn = turnOf(1645, 6);
    s0.cities.nanjing.controller = 'qing';
    s0.events = EVENTS.filter(e => e.from < s0.turn).map(e => ({ id: e.id, turn: 0, variant: 'history' as const }));
    const { s, seen } = month(s0, (t, labels) => t === '剃发令再颁' ? labels.indexOf('暂缓推行') : 0);
    expect(seen).toContain('剃发令再颁');
    expect(s.flags.tifa_strict).toBe(0);
  });
  it('全期史事线索四十条以上，日期都在剧本之内', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(40);
    for (const e of EVENTS) { expect(e.from).toBeLessThanOrEqual(e.to); expect(e.to).toBeLessThan(TOTAL_TURNS); }
    expect(new Set(EVENTS.map(e => e.id)).size).toBe(EVENTS.length);
  });
});

describe('军事补充', () => {
  it('同处一地的敌对军队即使都未移动也会交战', () => {
    let s = createGame('hongguang');
    s.armies.a_li.location = 'xiangyang'; s.armies.a_li.path = []; s.armies.a_li.progress = 0; s.armies.a_li.order = { kind: 'hold' };
    s.armies.a_zuo.location = 'xiangyang'; s.armies.a_zuo.order = { kind: 'hold' };
    const n = s.battles.length;
    s = runMonthAuto(s, []);
    expect(s.battles.slice(n).some(b => b.node === 'xiangyang' && b.kind === 'field')).toBe(true);
  });
});

describe('整局推进（自动）', () => {
  for (const f of ['hongguang', 'zheng']) {
    it(`${f}：从甲申五月推进到终局不出错`, () => {
      let s = createGame(f, 11);
      let n = 0;
      while (!s.ended && n++ < 240) s = runMonthAuto(s, []);
      expect(s.ended).toBeTruthy();
      expect(['unified', 'undecided', 'fallen']).toContain(s.ended!.kind);
      expect(s.events.length).toBeGreaterThan(20);
    }, 120000);
  }
});

describe('出征：宣战、行程与战斗', () => {
  it('史事不改玩家已下的军令（督师江北不把标营调回扬州）', () => {
    const s0 = createGame('hongguang', 1);
    const gen = resolveMonth(s0, [{ id: 'o', kind: 'army', army: 'a_shi', order: { kind: 'move', target: 'yanzhou', attack: true } }]);
    let r = gen.next();
    while (!r.done) r = gen.next(r.value.type === 'choice' ? { type: 'choice', index: 0 } : undefined);
    const a = r.value.state.armies.a_shi;
    expect(a.order.kind === 'siege' || (a.order.kind === 'move' && a.order.target === 'yanzhou')).toBe(true);
  });
  it('未交战的势力：宣战后进攻，抵达当月即有攻城战', () => {
    let s = createGame('hongguang', 1);
    s.armies.a_shi.location = 'xuzhou'; s.armies.a_shi.troops = 30000;
    s.cities.yanzhou.controller = 'qing';
    expect(s.relations['hongguang|qing'].stance).toBe('neutral');
    let battles = 0;
    let orders: any[] = [{ id: 'w', kind: 'war', target: 'qing' }, { id: 'a', kind: 'army', army: 'a_shi', order: { kind: 'move', target: 'yanzhou', attack: true } }];
    for (let m = 0; m < 2 && !battles; m++) {
      const gen = resolveMonth(s, orders); orders = [];
      let r = gen.next();
      while (!r.done) { if (r.value.type === 'battle') battles++; r = gen.next(r.value.type === 'choice' ? { type: 'choice', index: 0 } : undefined); }
      s = r.value.state;
    }
    expect(s.relations['hongguang|qing'].stance).toBe('war');
    expect(battles).toBeGreaterThan(0);
  });
  it('行军有日程：南京到北京（走运河）四十日以上，跨两个月', () => {
    const p = shortestPath('nanjing', 'beijing', false)!;
    const plan = marchPlan('nanjing', p);
    expect(plan[plan.length - 1].day).toBeGreaterThan(40);
    expect(plan.some(x => x.month >= 2)).toBe(true);
  });
});
