/* 电脑的主动性（2026-11-27 玩家用张献忠玩了几个小时：我城空虚，对方城里人多也不出来打；结盟、突围都没有，像是我在单向输出）。
 * 被围之城守军强就开门出击；各城驻军有余就会集出征，打邻近空虚之城；邻家见玩家边城空虚会翻脸来攻；
 * 也会遣使暗中劝降玩家人心不稳之城；同受玩家威胁的几家会暂息干戈。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { aiSorties, aiMusters, aiOrders, aiOpportunism, aiIntrigue } from '../src/core/ai';
import { moveArmies } from '../src/core/military';
import { stance, setStance, citiesOf } from '../src/core/state';
import type { GameState } from '../src/core/types';

const xiGame = () => {
  const s = createGame('xi', 1);
  return s;
};
const armiesOf = (s: GameState, f: string) => Object.values(s.armies).filter(a => a.faction === f);

describe('守城出击', () => {
  it('围城之军弱于城中守军：守将开门出城，与围城之军野战', () => {
    const s = xiGame();
    const a = s.armies.a_zhang;
    a.troops = 12000; a.location = 'chongqing';
    s.cities.chongqing.garrison = 30000;
    s.sieges.chongqing = { node: 'chongqing', attacker: 'xi', armies: [a.id], startTurn: s.turn, months: 1 };
    const before = armiesOf(s, 'mingprov').length;
    aiSorties(s);
    const out = armiesOf(s, 'mingprov').filter(x => x.location === 'chongqing');
    expect(out.length).toBe(before + 1);
    expect(out[0].troops).toBeGreaterThan(10000);
    expect(s.cities.chongqing.garrison).toBeLessThan(30000);
    expect(s.reports.some(r => r.urgent && /出城/.test(r.text))).toBe(true);
    expect(moveArmies(s).some(c => c.node === 'chongqing')).toBe(true);
  });
  it('围城之军远强于守军：不出城送死', () => {
    const s = xiGame();
    const a = s.armies.a_zhang;
    a.troops = 60000; a.location = 'chongqing';
    s.cities.chongqing.garrison = 8000;
    s.sieges.chongqing = { node: 'chongqing', attacker: 'xi', armies: [a.id], startTurn: s.turn, months: 1 };
    const before = armiesOf(s, 'mingprov').length;
    aiSorties(s);
    expect(armiesOf(s, 'mingprov').length).toBe(before);
  });
});

describe('会集各城兵马出征', () => {
  const weakKuizhou = () => {
    const s = xiGame();
    s.armies.a_zhang.location = 'qujing'; s.armies.a_zhang.troops = 20000;       // 主力远在云南
    s.cities.kuizhou.garrison = 1200;
    s.cities.chongqing.garrison = 14000; s.cities.shunqing.garrison = 9000;
    return s;
  };
  it('邻城空虚：明军会集重庆一带的驻军，来攻夔州，并有急报', () => {
    const s = weakKuizhou();
    let army;
    for (let k = 0; k < 6 && !army; k++) { aiMusters(s); army = armiesOf(s, 'mingprov').find(a => a.order.kind === 'move' && a.order.target === 'kuizhou'); s.turn++; }
    expect(army).toBeTruthy();
    expect(army!.troops).toBeGreaterThan(3000);
    expect(s.reports.some(r => r.urgent && /夔州/.test(r.text) && /会集|出兵|来攻/.test(r.text))).toBe(true);
  });
  it('邻城守备充足：不去碰', () => {
    const s = weakKuizhou();
    s.cities.kuizhou.garrison = 20000;
    for (let k = 0; k < 6; k++) { aiMusters(s); s.turn++; }
    expect(armiesOf(s, 'mingprov').some(a => a.order.kind === 'move' && a.order.target === 'kuizhou')).toBe(false);
  });
  it('出征之后，本城仍留守兵', () => {
    const s = weakKuizhou();
    for (let k = 0; k < 6; k++) { aiMusters(s); s.turn++; }
    for (const c of citiesOf(s, 'mingprov')) expect(c.garrison).toBeGreaterThanOrEqual(1000);
  });
});

describe('乘虚而入', () => {
  it('野战军就在邻近、玩家边城空虚：不看平日用兵偏重，也会来攻', () => {
    const s = xiGame();
    s.armies.a_zhang.location = 'chengdu';
    s.cities.kuizhou.garrison = 800;
    setStance(s, 'shun', 'xi', 'war');
    const sh = Object.values(s.armies).find(a => a.faction === 'shun')!;
    sh.location = 'jingzhou'; sh.troops = 15000; sh.order = { kind: 'hold' }; sh.path = [];
    for (const a of Object.values(s.armies)) if (a.faction === 'shun' && a.id !== sh.id) a.location = 'xian';
    const orders = aiOrders(s, 'shun');
    expect(orders.some(o => o.kind === 'army' && o.army === sh.id && o.order.kind === 'move' && o.order.target === 'kuizhou')).toBe(true);
  });
  it('邻家主战、见玩家边城空虚而己方兵多：翻脸宣战', () => {
    const s = xiGame();
    s.armies.a_zhang.location = 'chengdu';
    s.cities.kuizhou.garrison = 800;
    expect(stance(s, 'shun', 'xi')).toBe('neutral');
    s.chars[s.factions.shun.leader].att.hawk = 80;
    s.cities.jingzhou.garrison = 20000;
    let ok = false;
    for (let k = 0; k < 12 && !ok; k++) { aiOpportunism(s); ok = stance(s, 'shun', 'xi') === 'war'; s.turn++; }
    expect(ok).toBe(true);
    expect(s.reports.some(r => r.urgent && /大顺|顺/.test(r.text) && /宣战|翻脸|交兵/.test(r.text))).toBe(true);
  });
  it('停战期内不翻脸', () => {
    const s = xiGame();
    s.armies.a_zhang.location = 'chengdu';
    s.cities.kuizhou.garrison = 800;
    s.chars[s.factions.shun.leader].att.hawk = 80;
    s.cities.jingzhou.garrison = 20000;
    setStance(s, 'shun', 'xi', 'truce', s.turn + 24);
    for (let k = 0; k < 12; k++) { aiOpportunism(s); s.turn++; }
    expect(stance(s, 'shun', 'xi')).toBe('truce');
  });
});

describe('暗中劝降', () => {
  it('玩家之城守将降意高、敌军压境：邻家遣使潜往劝降', () => {
    const s = xiGame();
    s.armies.a_zhang.location = 'chengdu';
    const gov = Object.values(s.chars).find(c => c.faction === 'xi' && c.status === 'active' && c.id !== s.factions.xi.leader)!;
    s.cities.kuizhou.governor = gov.id; gov.location = 'kuizhou';
    gov.att.surrender = 85; s.cities.kuizhou.minxin = 30;
    const m = Object.values(s.armies).find(a => a.faction === 'mingprov') ?? null;
    s.cities.chongqing.garrison = 20000;
    if (!m) {
      const cmd = Object.values(s.chars).find(c => c.faction === 'mingprov' && c.status === 'active')!;
      s.armies.a_m = { id: 'a_m', name: '明军', faction: 'mingprov', commander: cmd.id, troops: 15000, mix: { inf: 0.7, cav: 0.2, gun: 0.1, navy: 0 }, morale: 70, location: 'chongqing', path: [], progress: 0, order: { kind: 'hold' }, supply: 'chongqing', hunger: 0 };
    }
    let sent = false;
    for (let k = 0; k < 8 && !sent; k++) { aiIntrigue(s); sent = s.missions.some(x => x.faction !== 'xi' && x.order.kind === 'persuade' && x.order.node === 'kuizhou'); s.turn++; }
    expect(sent).toBe(true);
  });
});

describe('共御玩家', () => {
  it('两家交战而都受玩家之逼：暂息干戈，停战一年', async () => {
    const { aiDiplomacyTalks } = await import('../src/core/diplomacy');
    const s = createGame('xi', 1);
    // 玩家坐大：兵多，与弘光、大顺皆为敌，并逼近两家
    s.armies.a_zhang.troops = 400000;
    setStance(s, 'xi', 'shun', 'war'); setStance(s, 'xi', 'hongguang', 'war');
    expect(stance(s, 'hongguang', 'shun')).toBe('war');
    s.flags.dip_force = true;
    for (let k = 0; k < 6 && stance(s, 'hongguang', 'shun') === 'war'; k++) { aiDiplomacyTalks(s); s.turn += 9; }
    expect(stance(s, 'hongguang', 'shun')).toBe('truce');
    expect(s.reports.some(r => /共御/.test(r.text))).toBe(true);
  });
});
