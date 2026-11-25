/* 议和与交涉：各家主动来使（求和、结盟、招抚），玩家遣使的讨价还价与扣使，电脑各家之间的外交动向。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { resolveMonth } from '../src/core/turn';
import { autoResolve } from '../src/core/battle';
import { proposalsFor, strengthOf, applyOffer, aiDiplomacyTalks } from '../src/core/diplomacy';
import { setStance, stance, citiesOf } from '../src/core/state';
import type { GameState, Order } from '../src/core/types';

/** 推进一月，记下所有抉择；pick 按标题和选项决定选哪一项 */
function month(s: GameState, orders: Order[] = [], pick: (title: string, labels: string[]) => number = () => 0) {
  const gen = resolveMonth(s, orders);
  const seen: { title: string; labels: string[]; text: string }[] = [];
  let r = gen.next();
  while (!r.done) {
    const it = r.value;
    if (it.type === 'battle') r = gen.next({ type: 'battle', result: autoResolve(it.battle), manual: false });
    else { const labels = it.choice.options.map(o => o.label); seen.push({ title: it.choice.title, labels, text: it.choice.text }); r = gen.next({ type: 'choice', index: pick(it.choice.title, labels) }); }
  }
  return { s: r.value.state, seen };
}

/** 把某家的一支军队摆到某地（让两家相邻） */
function bring(s: GameState, f: string, node: string) {
  const a = Object.values(s.armies).find(x => x.faction === f)!;
  a.location = node; a.path = []; a.progress = 0;
}
/** 摆一个局面：玩家弘光与大顺交战，大顺远弱于弘光，且兵临安庆 */
function weakFoe() {
  const s = createGame('hongguang', 2);
  setStance(s, 'hongguang', 'shun', 'war');
  bring(s, 'shun', 'anqing');
  for (const a of Object.values(s.armies)) if (a.faction === 'shun') a.troops = 2000;
  for (const c of citiesOf(s, 'shun')) c.garrison = 1000;
  s.chars[s.factions.shun.leader].att.hawk = 0;
  return s;
}

describe('各家主动遣使', () => {
  it('战事不利的一方来求和：给出受银停战、要求割城、拒绝三条路', () => {
    const s = weakFoe();
    expect(strengthOf(s, 'shun')).toBeLessThan(strengthOf(s, 'hongguang') * 0.7);
    const offers = proposalsFor(s, true);
    const o = offers.find(x => x.kind === 'truce_ask' && x.from === 'shun');
    expect(o).toBeTruthy();
    expect(o!.options.length).toBe(3);
    expect(o!.text).toMatch(/大顺/);
  });
  it('准和：停战一年，收下赔款', () => {
    const s = weakFoe();
    const o = proposalsFor(s, true).find(x => x.kind === 'truce_ask' && x.from === 'shun')!;
    const cap = s.cities[s.factions.hongguang.capital].silver;
    applyOffer(s, o, 0);
    expect(stance(s, 'hongguang', 'shun')).toBe('truce');
    expect(s.relations['hongguang|shun'].until).toBe(s.turn + 12);
    if (o.silver) expect(s.cities[s.factions.hongguang.capital].silver).toBe(cap + o.silver);
  });
  it('索要割城：成败看对方虚实，成则得城并停战，不成则仍交战且对方更恨', () => {
    let ok = 0, fail = 0;
    for (let seed = 1; seed <= 12; seed++) {
      const s = weakFoe(); s.seed = seed;
      const o = proposalsFor(s, true).find(x => x.kind === 'truce_ask' && x.from === 'shun');
      if (!o || !o.city) continue;
      const msg = applyOffer(s, o, 1);
      if (s.cities[o.city].controller === 'hongguang') { ok++; expect(stance(s, 'hongguang', 'shun')).toBe('truce'); }
      else { fail++; expect(stance(s, 'hongguang', 'shun')).toBe('war'); expect(msg).toMatch(/拒|不允|斩/); }
    }
    expect(ok + fail).toBeGreaterThan(5);
    expect(ok).toBeGreaterThan(0);
    expect(fail).toBeGreaterThan(0);
  });
  it('强敌遣使招抚：可斩使明志、虚与委蛇、受抚；明室朝廷不能受抚', () => {
    const s = createGame('zheng', 2);
    setStance(s, 'zheng', 'qing', 'war'); delete s.factions.zheng.overlord;
    bring(s, 'qing', 'quanzhou');
    const o = proposalsFor(s, true).find(x => x.kind === 'summon' && x.from === 'qing');
    expect(o).toBeTruthy();
    expect(o!.options.map(x => x.label).join('|')).toMatch(/斩使|虚与委蛇|受抚/);
    applyOffer(s, o!, 2);
    expect(s.factions.zheng.overlord).toBe('qing');
    const h = createGame('hongguang', 2);
    setStance(h, 'hongguang', 'qing', 'war'); bring(h, 'qing', 'yangzhou');
    for (const c of citiesOf(h, 'hongguang')) c.garrison = 100;
    const oh = proposalsFor(h, true).find(x => x.kind === 'summon' && x.from === 'qing');
    if (oh) expect(oh.options.find(x => /受抚/.test(x.label))?.disabled).toBeTruthy();
  });
  it('有共同敌人的邻家来议结盟', () => {
    const s = createGame('hongguang', 2);
    setStance(s, 'hongguang', 'qing', 'war'); setStance(s, 'shun', 'qing', 'war'); setStance(s, 'hongguang', 'shun', 'neutral');
    bring(s, 'shun', 'anqing');
    for (const a of Object.values(s.armies)) if (a.faction === 'qing') a.troops = 300000;   // 清为天下最强
    const o = proposalsFor(s, true).find(x => x.kind === 'alliance_offer' && x.from === 'shun');
    expect(o).toBeTruthy();
    applyOffer(s, o!, 0);
    expect(stance(s, 'hongguang', 'shun')).toBe('alliance');
  });
  it('月结时来使以抉择弹出；同一家十二个月内不再来', () => {
    const s0 = weakFoe();
    s0.flags.dip_force = 1;   // 测试：本月必来
    const { s, seen } = month(s0, [], () => 2);
    expect(seen.some(x => /来使|求和/.test(x.title))).toBe(true);
    delete s.flags.dip_force;
    expect(proposalsFor(s, true).some(x => x.from === 'shun' && x.kind === 'truce_ask')).toBe(false);
  });
});

describe('玩家遣使：讨价还价与扣使', () => {
  it('对方开出条件：付银则议成，不付则未成', () => {
    let countered = 0;
    for (let seed = 1; seed <= 30 && !countered; seed++) {
      const s0 = createGame('hongguang', seed);
      setStance(s0, 'hongguang', 'shun', 'war');
      s0.flags.counter_force = 1;
      const env = Object.values(s0.chars).find(c => c.faction === 'hongguang' && c.status === 'active' && c.location === 'nanjing' && !Object.values(s0.armies).some(a => a.commander === c.id))!;
      let s = month(s0, [{ id: 'e1', kind: 'envoy', char: env.id, target: 'shun', aim: 'truce' }]).s;
      for (let k = 0; k < 4; k++) {
        const r = month(s, [], (t, labels) => (/条件/.test(t) ? 0 : 0));
        s = r.s;
        const c = r.seen.find(x => /条件/.test(x.title));
        if (c) { countered++; expect(c.labels[0]).toMatch(/银/); expect(stance(s, 'hongguang', 'shun')).toBe('truce'); break; }
      }
    }
    expect(countered).toBe(1);
  });
});

describe('天下的外交动向', () => {
  it('电脑各家之间也遣使议和、结盟，月报里写出成败', () => {
    const s = createGame('hongguang', 2);
    setStance(s, 'shun', 'xi', 'war'); bring(s, 'xi', 'xiangyang');
    for (const a of Object.values(s.armies)) if (a.faction === 'xi') a.troops = 1000;
    s.chars[s.factions.shun.leader].att.hawk = 0; s.chars[s.factions.xi.leader].att.hawk = 0;
    s.flags.dip_force = 1;
    aiDiplomacyTalks(s);
    expect(s.reports.some(r => r.cat === '交涉' && /遣使/.test(r.text) && (/大顺|顺/.test(r.text)))).toBe(true);
  });
});

describe('史事：海澄议和', () => {
  it('郑氏玩家得到抉择：借和议筹饷即与清停战一年、得银', async () => {
    const { LATE_EVENTS } = await import('../src/data/events-late');
    const { choiceFor, applyChoice } = await import('../src/core/events');
    const def = LATE_EVENTS.find(e => e.id === 'ss_haicheng')!;
    const s = createGame('zheng', 2);
    delete s.factions.zheng.overlord; setStance(s, 'zheng', 'qing', 'war');
    s.turn = def.from;
    expect(def.cond!(s)).toBe(true);
    const ch = choiceFor(s, def, 'history')!;
    expect(ch.pending.options.length).toBe(3);
    const cap = s.cities[s.factions.zheng.capital].silver;
    applyChoice(s, def, ch.choices[0]);
    expect(stance(s, 'zheng', 'qing')).toBe('truce');
    expect(s.cities[s.factions.zheng.capital].silver).toBe(cap + 80000);
    // 别家玩家：不弹抉择，郑氏按史行事
    const h = createGame('hongguang', 2); delete h.factions.zheng.overlord; setStance(h, 'zheng', 'qing', 'war'); h.turn = def.from;
    expect(choiceFor(h, def, 'history')).toBeNull();
  });
});

describe('平时的来使：索饷、通好', () => {
  it('强邻索饷：给银则停战一年；拒绝可能开战', () => {
    const s = createGame('zheng', 2);
    delete s.factions.zheng.overlord; setStance(s, 'zheng', 'qing', 'neutral'); bring(s, 'qing', 'quanzhou');
    s.chars[s.factions.qing.leader].att.hawk = 80;
    const o = proposalsFor(s, true).find(x => x.kind === 'tribute_demand' && x.from === 'qing')!;
    expect(o).toBeTruthy();
    const cap = s.cities[s.factions.zheng.capital].silver;
    applyOffer(s, o, 0);
    expect(s.cities[s.factions.zheng.capital].silver).toBe(cap - o.silver!);
    expect(stance(s, 'zheng', 'qing')).toBe('truce');
    let wars = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const t = createGame('zheng', seed); delete t.factions.zheng.overlord; setStance(t, 'zheng', 'qing', 'neutral'); bring(t, 'qing', 'quanzhou'); t.chars[t.factions.qing.leader].att.hawk = 80;
      const p = proposalsFor(t, true).find(x => x.kind === 'tribute_demand')!; applyOffer(t, p, 2); if (stance(t, 'zheng', 'qing') === 'war') wars++;
    }
    expect(wars).toBeGreaterThan(2); expect(wars).toBeLessThan(10);
  });
  it('邻家通好：两年互不相犯，两家各得互市之利', () => {
    const s = createGame('hongguang', 2);
    setStance(s, 'hongguang', 'shun', 'neutral'); bring(s, 'shun', 'anqing');
    s.chars[s.factions.shun.leader].att.hawk = 10;
    for (const a of Object.values(s.armies)) if (a.faction === 'shun') a.troops = 1000;
    const o = proposalsFor(s, true).find(x => x.kind === 'goodwill' && x.from === 'shun')!;
    expect(o).toBeTruthy();
    applyOffer(s, o, 0);
    expect(s.relations['hongguang|shun']).toMatchObject({ stance: 'truce', until: s.turn + 24 });
  });
});
