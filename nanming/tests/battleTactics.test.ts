/* 战斗可玩性：阵形、地物、战法、战场变故、战机、排队命令（2026-11-26） */
import { describe, it, expect } from 'vitest';
import { createBattle, makeSide, type BattleState } from '../src/core/battle';
import { createField, stepField, aiField, commandF, setFormation, useSkill, skillBlock, momentF, inFeature, FORMATIONS, type FieldSim } from '../src/core/field';
import { createSiege, momentS } from '../src/core/siege';

function side(name: string, troops: number, o: Partial<{ mou: number; tong: number; cav: number; gun: number }> = {}, garrison = false) {
  const cav = o.cav ?? 0.2, gun = o.gun ?? 0.15;
  return makeSide({ faction: name, name, commander: name + '将', commanderName: name + '将', tong: o.tong ?? 60, mou: o.mou ?? 70, wai: 50, surrender: 30,
    mix: { inf: 1 - cav - gun, cav, gun, navy: 0 }, stratagems: 2, armies: [], garrison, troops, morale: 70 });
}
const fieldB = (seed = 7, weather: 'clear' | 'wind' = 'clear', ao = {}, dO = {}): BattleState =>
  createBattle({ id: 'f', kind: 'field', node: 'x', nodeName: '某地', terrain: 'plain', weather, att: side('攻', 30000, ao), def: side('守', 30000, dO), seed });
const run = (sim: FieldSim, secs: number, both = true) => { let next = 0; const end = sim.t + secs; while (!sim.over && sim.t < end) { if (sim.t >= next) { if (both) aiField(sim, 'att'); aiField(sim, 'def'); next = sim.t + 2; } stepField(sim, 0.1); } };

describe('阵形', () => {
  it('开战前可换阵形，各营随之挪位；开战后不能再换', () => {
    const sim = createField(fieldB());
    const gun = sim.units.find(u => u.side === 'att' && u.kind === 'gun')!;
    setFormation(sim, 'att', 'normal');
    const y0 = gun.y;
    expect(setFormation(sim, 'att', 'yanxing')).toBe(true);
    expect(gun.y).toBeLessThan(y0);           // 火器列前（攻方向上）
    setFormation(sim, 'att', 'normal');
    expect(Math.abs(gun.y - y0)).toBeLessThan(1);
    stepField(sim, 0.1);
    expect(setFormation(sim, 'att', 'fengshi')).toBe(false);
    expect(Object.keys(FORMATIONS)).toHaveLength(5);
  });
});

describe('战法', () => {
  it('谋略高、有火器骑兵的主将有三样战法；每样一战一次', () => {
    const sim = createField(fieldB(7, 'wind'));
    expect(sim.skills.att.length).toBe(3);
    const id = sim.skills.att.find(k => k !== 'fire' && k !== 'raid')!;
    expect(useSkill(sim, 'att', id)).toBe(true);
    expect(skillBlock(sim, 'att', id)).toBe('一战只能用一次');
  });
  it('疑兵：敌军二十秒内不敢轻进', () => {
    const sim = createField(fieldB(3, 'clear', {}, {}));
    sim.skills.att = ['feint'];
    useSkill(sim, 'att', 'feint');
    expect(sim.buff.def.confused).toBe(20);
    aiField(sim, 'def', { eager: false });
    run(sim, 5, false);
    expect(sim.units.filter(u => u.side === 'def').every(u => u.order.t !== 'attack' || u.state !== 'move')).toBe(true);
  });
  it('伏兵：潜行之骑不为敌所见，初次接敌加倍杀伤并报“伏兵杀出”', () => {
    const sim = createField(fieldB(5));
    sim.skills.att = ['ambush'];
    expect(useSkill(sim, 'att', 'ambush')).toBe(true);
    const cav = sim.units.find(u => u.side === 'att' && u.hidden)!;
    expect(cav).toBeTruthy();
    const foe = sim.units.find(u => u.side === 'def' && u.kind === 'inf')!;
    commandF(sim, { unit: cav.id, side: 'att', order: { t: 'attack', target: foe.id } });
    for (let k = 0; k < 400 && !sim.events.some(e => e.kind === 'ambush'); k++) stepField(sim, 0.1);
    expect(sim.events.some(e => e.kind === 'ambush')).toBe(true);
    expect(cav.hidden).toBe(false);
  });
});

describe('地物与变故', () => {
  it('野战多有林、村；林中之营射不着要少伤', () => {
    let withWoods = 0;
    for (let s = 1; s <= 10; s++) if (createField(fieldB(s)).features.some(f => f.kind === 'woods')) withWoods++;
    expect(withWoods).toBe(10);
    const sim = createField(fieldB(2));
    const w = sim.features.find(f => f.kind === 'woods')!;
    expect(inFeature(sim, { x: w.x, y: w.y }, 'woods')).toBe(true);
  });
  it('每战预定一两件变故，到时发生并报', () => {
    const sim = createField(fieldB(9));
    expect(sim.twists.length).toBeGreaterThanOrEqual(1);
    run(sim, 700);
    expect(sim.over || sim.events.some(e => e.kind === 'twist')).toBeTruthy();
  });
});

describe('战机', () => {
  it('我军动摇时出一次战机，选项可改局面；同一战机只出一次', () => {
    const sim = createField(fieldB(4));
    stepField(sim, 6);
    sim.resolve.att = 30;
    const m = momentF(sim, 'att');
    expect(m?.id).toBe('waver');
    const before = sim.resolve.att;
    const o = m!.options[0];
    expect(o.odds).toBeGreaterThan(0); expect(o.odds).toBeLessThan(1);   // 主将亲临有成有败
    const r = o.apply(sim)!;
    if (r.ok) expect(sim.resolve.att).toBeGreaterThan(before); else expect(sim.buff.att.wounded).toBe(1);
    expect(r.text.length).toBeGreaterThan(0);
    sim.resolve.att = 30;
    expect(momentF(sim, 'att')?.id).not.toBe('waver');
  });
  it('战机按情形而生、各场不同：丘陵有争高地，雨天火器营有湿火药，强将会阵前搦战', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) for (const [terrain, weather] of [['hills', 'clear'], ['plain', 'rain'], ['plain', 'clear']] as const) {
      const b = { ...fieldB(seed), terrain, weather };
      b.def = { ...b.def, tong: 80 };
      const sim = createField(b as any);
      for (let k = 0; k < 60; k++) { run(sim, 5); const m = momentF(sim, 'att'); if (m) seen.add(m.id); if (sim.over) break; }
    }
    expect(seen.has('height')).toBe(true);
    expect(seen.has('duel')).toBe(true);
    expect(seen.has('rain')).toBe(true);
    expect(seen.size).toBeGreaterThanOrEqual(5);
  }, 60000);
  it('成败有别：同一对策，成算高者多半得手', () => {
    let okHi = 0, okLo = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (const tong of [90, 20]) {
        const sim = createField(fieldB(seed)); stepField(sim, 6);
        sim.att.tong = tong; sim.resolve.att = 30;
        const m = momentF(sim, 'att')!;
        const r = m.options[0].apply(sim)!;
        if (r.ok) { if (tong === 90) okHi++; else okLo++; }
      }
    }
    expect(okHi).toBeGreaterThan(okLo + 5);
  }, 60000);
  it('攻城：城门一破，攻方得“全军突入”之机', () => {
    const b = createBattle({ id: 's', kind: 'siege', node: 'x', nodeName: '某城', terrain: 'city', weather: 'clear', att: side('攻', 30000), def: side('守', 8000, {}, true), wall: 60, seed: 3 });
    const sim = createSiege(b);
    sim.t = 10; sim.gate.hp = 0;
    const m = momentS(sim, 'att');
    expect(m?.options[0].label).toBe('全军突入');
    m!.options[0].apply(sim);
    expect(sim.units.filter(u => u.side === 'att' && u.kind === 'inf').every(u => u.order.t === 'enter')).toBe(true);
  });
});

describe('排队命令', () => {
  it('按住 Shift 下的令排在后面，前一令完成即接着做', () => {
    const sim = createField(fieldB(6));
    const u = sim.units.find(x => x.side === 'att' && x.kind === 'inf')!;
    commandF(sim, { unit: u.id, side: 'att', order: { t: 'move', x: u.x, y: u.y - 100 } });
    stepField(sim, 0.5);
    commandF(sim, { unit: u.id, side: 'att', order: { t: 'move', x: u.x + 150, y: u.y - 100 }, queue: true });
    expect(u.queue?.length).toBe(1);
    for (let k = 0; k < 200 && u.queue?.length; k++) stepField(sim, 0.1);
    expect(u.queue?.length ?? 0).toBe(0);
    expect(u.order.t).toBe('move');
  });
});

describe('先登夺门', () => {
  const siegeB = () => createBattle({ id: 's', kind: 'siege', node: 'x', nodeName: '某城', terrain: 'city', weather: 'clear', att: side('攻', 30000, { cav: 0.3 }), def: side('守', 3000, {}, true), wall: 80, seed: 5 });
  it('步营登城入城后，自内夺下城门；城下待命的骑营随即由城门涌入', async () => {
    const { stepSiege, command, legal, segX } = await import('../src/core/siege');
    const sim = createSiege(siegeB());
    const inf = sim.units.find(u => u.side === 'att' && u.kind === 'inf')!;
    const cav = sim.units.find(u => u.side === 'att' && u.kind === 'cav')!;
    // 左次段无人把守：步营一到就登城
    for (const d of sim.units) if (d.side === 'def' && d.seg === 1) { d.seg = 3; d.x = segX(3); d.order = { t: 'man', seg: 3 }; }
    expect(legal(cav, { t: 'assault', seg: 1 })).toBe(false);          // 骑兵爬不了云梯
    command(sim, { unit: inf.id, side: 'att', order: { t: 'assault', seg: 1 } });
    command(sim, { unit: cav.id, side: 'att', order: { t: 'enter' } });  // 骑营待命
    for (let k = 0; k < 3000 && !sim.over && cav.state !== 'inside'; k++) stepSiege(sim, 0.1);
    expect(sim.gate.hp).toBe(0);
    expect(sim.events.some(e => e.kind === 'gate' && e.text.includes('夺'))).toBe(true);
    expect(sim.events.some(e => e.kind === 'enter' && e.unit === cav.id && e.text.includes('城门'))).toBe(true);
  });
});
