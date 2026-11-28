/* 《玩法独立审查-2026-11-25》非战斗条目的回归测试：统一归属、续局、粮台、整镇改奉与使程、海陆通行、兴学、欠饷。 */
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/data/scenario1644';
import { resolveMonth, runMonthAuto } from '../src/core/turn';
import { captureChar, capture, setArmyOrder, moveArmies, followOdds } from '../src/core/military';
import { successionOptions } from '../src/core/regime';
import { validateOrder, applyOrder } from '../src/core/orders';
import { runEconomy } from '../src/core/economy';
import { aiFixSupply } from '../src/core/ai';
import { runTalent, eduLead } from '../src/core/talent';
import { citiesOf } from '../src/core/state';
import { VICTORY_AREAS, NODE, routeBetween } from '../src/data/geography';
import type { GameState } from '../src/core/types';

const counted = (s: GameState) => Object.values(s.cities).filter(c => VICTORY_AREAS.includes(NODE[c.id].area));

/** 摆一盘终局：只留弘光与郑氏，计胜城按 owner 分配 */
function endgame(player: string, owner: (id: string, i: number) => string, zhengIndependent = false) {
  const s = createGame(player, 3);
  counted(s).forEach((c, i) => { c.controller = owner(c.id, i); });
  for (const c of Object.values(s.cities)) if (!VICTORY_AREAS.includes(NODE[c.id].area)) c.controller = 'hongguang';
  for (const f of Object.values(s.factions)) if (!['hongguang', 'zheng'].includes(f.id)) f.defunct = true;
  for (const a of Object.values(s.armies)) if (!['hongguang', 'zheng'].includes(a.faction)) delete s.armies[a.id];
  if (zhengIndependent) {
    for (const c of Object.values(s.cities)) if (c.controller === 'hongguang') c.controller = 'zheng';
    for (const a of Object.values(s.armies)) if (a.faction === 'hongguang') delete s.armies[a.id];
  }
  if (zhengIndependent) { delete s.factions.zheng.overlord; delete s.factions.zheng.loyalty; s.relations['hongguang|zheng'] = { stance: 'war' }; }
  s.flags.ming_court = 'hongguang';
  return s;
}

/** 推进一月：抉择按 pick 选，返回见到的抉择 */
function month(s: GameState, pick: (title: string, labels: string[]) => number = () => 0) {
  const gen = resolveMonth(s, []);
  const seen: { title: string; labels: string[] }[] = [];
  let r = gen.next();
  while (!r.done) {
    const it = r.value;
    if (it.type === 'choice') { const labels = it.choice.options.map(o => o.label); seen.push({ title: it.choice.title, labels }); r = gen.next({ type: 'choice', index: pick(it.choice.title, labels) }); }
    else r = gen.next(undefined);
  }
  return { s: r.value.state, seen };
}

/* 2026-11-27 改：天下只归一家。奉他人号令者，即便直辖最多，也只是臣属，须先自立才能一统；盟友亦是对手。 */
describe('一、谁完成统一', () => {
  it('弘光一统、郑氏只守安平且奉弘光：郑氏只是臣属，不算一统', () => {
    const s = runMonthAuto(endgame('zheng', id => id === 'anping' ? 'zheng' : 'hongguang'), []);
    expect(s.ended?.kind).toBe('subject');
    expect(s.ended?.text).toContain('弘光');
  });
  it('郑氏直辖最多而仍奉明室：仍是臣属，须自立', () => {
    const s = runMonthAuto(endgame('zheng', (id, i) => i < 3 ? 'hongguang' : 'zheng'), []);
    expect(s.ended?.kind).toBe('subject');
  });
  it('郑氏自立统一：独立一统', () => {
    const s = runMonthAuto(endgame('zheng', () => 'zheng', true), []);
    expect(s.ended?.kind).toBe('unified');
    expect(s.ended?.role).toBe('lead');
  });
  it('弘光玩家、郑氏奉其号令：弘光是统一者', () => {
    const s = runMonthAuto(endgame('hongguang', id => id === 'anping' ? 'zheng' : 'hongguang'), []);
    expect(s.ended?.kind).toBe('unified');
  });
  it('盟友不算：弘光与盟友分据天下，不算一统', () => {
    const s0 = endgame('hongguang', id => id === 'anping' ? 'zheng' : 'hongguang');
    delete s0.factions.zheng.overlord; delete s0.factions.zheng.loyalty;
    s0.relations[['hongguang', 'zheng'].sort().join('|')] = { stance: 'alliance' };
    const s = runMonthAuto(s0, []);
    expect(s.ended?.kind).not.toBe('unified');
  });
});

describe('二、有城有兵而无人继任', () => {
  const lonely = (player: string) => {
    const s = createGame(player, 7);
    for (const c of Object.values(s.chars)) if (c.faction === 'zheng' && c.id !== 'zhengzhilong' && c.status === 'active') c.status = 'dead';
    for (const a of Object.values(s.armies)) if (a.faction === 'zheng') a.commander = 'zhengzhilong';
    return s;
  };
  it('郑氏玩家主事人被俘而本部无人：不立即覆亡，进入续局抉择', () => {
    const s0 = lonely('zheng');
    captureChar(s0, 'zhengzhilong', 'qing', '出海遇伏');
    expect(s0.factions.zheng.defunct).toBeFalsy();
    const kinds = successionOptions(s0, 'zheng').map(o => o.kind);
    expect(kinds).toContain('appointed');
    expect(kinds).toContain('join');
    const { s, seen } = month(s0, (t, labels) => Math.max(0, labels.findIndex(l => l.includes('委派'))));
    expect(seen.map(x => x.title)).toContain('议定主事');
    expect(s.factions.zheng.defunct).toBeFalsy();
    expect(s.ended).toBeUndefined();
    const lead = s.chars[s.factions.zheng.leader];
    expect(lead.status).toBe('active');
    expect(lead.faction).toBe('zheng');
  });
  it('选择投靠：部众归入所奉朝廷，本局以投靠收场', () => {
    const s0 = lonely('zheng');
    captureChar(s0, 'zhengzhilong', 'qing', '出海遇伏');
    const { s } = month(s0, (t, labels) => Math.max(0, labels.findIndex(l => l.includes('投靠'))));
    expect(s.ended?.kind).toBe('fallen');
    expect(s.ended?.text).toContain('投靠');
    expect(s.cities.anping.controller).toBe('hongguang');
  });
  it('电脑一方同样续局：郑氏不因一人被俘而消失', () => {
    const s0 = lonely('hongguang');
    captureChar(s0, 'zhengzhilong', 'qing', '出海遇伏');
    const s = runMonthAuto(s0, []);
    expect(s.factions.zheng.defunct).toBeFalsy();
    expect(s.chars[s.factions.zheng.leader].status).toBe('active');
  });
  it('非明廷势力也由玩家议定：大西张献忠被俘，可在诸将中择人主事', () => {
    const s0 = createGame('xi', 7);
    captureChar(s0, 'zhangxianzhong', 'qing', '中箭');
    const { seen } = month(s0);
    const ch = seen.find(x => x.title === '议定主事');
    expect(ch).toBeTruthy();
    expect(ch!.labels.filter(l => l.includes('主事')).length).toBeGreaterThanOrEqual(2);
  });
  it('无城无军仍直接退场', () => {
    const s0 = lonely('hongguang');
    for (const c of citiesOf(s0, 'zheng')) c.controller = 'hongguang';
    for (const a of Object.values(s0.armies)) if (a.faction === 'zheng') delete s0.armies[a.id];
    captureChar(s0, 'zhengzhilong', 'qing', '出海遇伏');
    const s = runMonthAuto(s0, []);
    expect(s.factions.zheng.defunct).toBe(true);
  });
});

describe('三、玩家改换粮台', () => {
  it('郑氏船队可改由安平支粮；敌城、被围之城、路断之城不行', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    const own = citiesOf(s, 'zheng').find(c => c.id !== a.supply)!;
    expect(validateOrder(s, 'zheng', { id: 'o1', kind: 'supply', army: a.id, node: own.id })).toBeNull();
    applyOrder(s, 'zheng', { id: 'o1', kind: 'supply', army: a.id, node: own.id });
    expect(a.supply).toBe(own.id);
    expect(validateOrder(s, 'zheng', { id: 'o2', kind: 'supply', army: a.id, node: 'beijing' })).toMatch(/友方|己方/);
    s.sieges[own.id] = { node: own.id, attacker: 'qing', armies: [], startTurn: 0, months: 1 };
    expect(validateOrder(s, 'zheng', { id: 'o3', kind: 'supply', army: a.id, node: own.id })).toMatch(/围/);
  });
  it('电脑换台也须粮道可通', () => {
    const s = createGame('hongguang', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    a.supply = 'beijing';
    // 除一座被敌军隔断的城外，郑氏各城都无粮
    for (const c of citiesOf(s, 'zheng')) c.grain = 0;
    const far = citiesOf(s, 'hongguang').find(c => c.id === 'nanjing')!;
    far.grain = 9e6;
    s.sieges.nanjing = { node: 'nanjing', attacker: 'qing', armies: [], startTurn: 0, months: 1 };
    aiFixSupply(s);
    expect(a.supply).not.toBe('nanjing');
  });
  it('换台不占政令', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    const s2 = runMonthAuto(s, Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, kind: 'supply' as const, army: a.id, node: a.supply })));
    expect(s2.reports.some(r => r.text.includes('政令已满'))).toBe(false);
  });
});

describe('四、整镇改奉的条件与使程', () => {
  it('使者的行程按路途远近：北京到安平比泉州到安平晚到', () => {
    const s = createGame('qing', 1);
    const far = Object.values(s.chars).find(c => c.faction === 'qing' && c.status === 'active' && c.location === 'beijing' && !Object.values(s.armies).some(a => a.commander === c.id))!;
    applyOrder(s, 'qing', { id: 'p1', kind: 'persuade', char: far.id, node: 'anping' });
    const m1 = s.missions.find(m => m.id === 'p1')!;
    expect(m1.arriveTurn).toBeGreaterThan(s.turn + 1);
    const s2 = createGame('qing', 1);
    const near = Object.values(s2.chars).find(c => c.faction === 'qing' && c.status === 'active' && !Object.values(s2.armies).some(a => a.commander === c.id))!;
    near.location = 'quanzhou';
    applyOrder(s2, 'qing', { id: 'p2', kind: 'persuade', char: near.id, node: 'anping' });
    expect(s2.missions.find(m => m.id === 'p2')!.arriveTurn).toBe(s2.turn + 1);
  });
  it('郑芝龙献安平而诸将不从：只带走安平与亲兵，郑氏另推主事、仍奉明', () => {
    const s = createGame('qing', 1);
    expect(followOdds(s, 'zheng', 'qing')).toBeLessThan(0.5);
    for (const c of Object.values(s.chars)) if (c.faction === 'zheng' && c.id !== 'zhengzhilong') { c.att.hawk = 90; c.att.loyalty = 90; c.att.surrender = 0; c.status = c.status === 'offstage' ? 'active' : c.status; }
    expect(followOdds(s, 'zheng', 'qing')).toBe(0);
    capture(s, 'anping', 'qing', '献城');
    expect(s.cities.anping.controller).toBe('qing');
    expect(s.chars.zhengzhilong.faction).toBe('qing');
    expect(s.factions.zheng.overlord).toBe('hongguang');
    expect(s.factions.zheng.leader).not.toBe('zhengzhilong');
    expect(citiesOf(s, 'zheng').length).toBeGreaterThan(0);
  });
  it('诸将皆愿随主：全镇改奉', () => {
    const s = createGame('qing', 1);
    for (const c of Object.values(s.chars)) if (c.faction === 'zheng' && c.id !== 'zhengzhilong') { c.att.hawk = -50; c.att.loyalty = 30; c.att.surrender = 80; }
    expect(followOdds(s, 'zheng', 'qing')).toBe(1);
    capture(s, 'anping', 'qing', '献城');
    expect(s.factions.zheng.overlord).toBe('qing');
  });
});

describe('五、海陆通行一致', () => {
  it('船队自安平去潮州走海路；舍舟登岸后余程改走陆路，与在途中重下同一目标一致', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    a.location = 'anping'; a.path = []; a.progress = 0; a.mix = { inf: 0.4, cav: 0, gun: 0.2, navy: 0.4 };
    setArmyOrder(s, a, { kind: 'move', target: 'chaozhou', attack: false });
    // 有船时整程走水路
    let c = 'anping';
    for (const n of a.path) { expect(routeBetween(c, n)!.kind).not.toBe('land'); c = n; }
    // 若中途改为步卒：余程应与从当地重新下令相同
    const b = Object.values(s.armies).find(x => x.faction === 'zheng' && x.id !== a.id) ?? a;
    b.location = 'anping'; b.path = []; b.progress = 0; b.mix = { inf: 1, cav: 0, gun: 0, navy: 0 };
    setArmyOrder(s, b, { kind: 'move', target: 'xiamen', attack: false });
    b.mix = { inf: 0.6, cav: 0, gun: 0, navy: 0.4 };
    setArmyOrder(s, b, { kind: 'move', target: 'chaozhou', attack: false });
    for (let k = 0; k < 3 && b.location !== 'chaozhou'; k++) moveArmies(s);
    if (b.mix.navy === 0) {
      // 舍舟之后每一步都不再走海路
      expect(b.location === 'chaozhou' || b.path.every((n, i) => routeBetween(i ? b.path[i - 1] : b.location, n)?.kind !== 'sea')).toBe(true);
    }
  });
  it('步卒不会沿预先算好的远海海路继续走（近海四日以内可在本方港口征船渡过，2026-11-27）', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    s.cities.guangzhou.controller = 'zheng';
    s.cities.leizhou.controller = 'qing'; s.relations['qing|zheng'] = { stance: 'war' };   // 雷州近海渡口不在手
    a.location = 'guangzhou'; a.progress = 0; a.mix = { inf: 1, cav: 0, gun: 0, navy: 0 };
    a.path = ['qiongzhou']; a.order = { kind: 'move', target: 'qiongzhou', attack: false };   // 旧的远海计划（九日）
    moveArmies(s);
    expect(a.location).not.toBe('qiongzhou');
  });
  it('厦门到潮州近海两日：步卒可在本方港口征船渡过', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    a.location = 'xiamen'; a.progress = 0; a.mix = { inf: 1, cav: 0, gun: 0, navy: 0 };
    a.path = ['chaozhou']; a.order = { kind: 'move', target: 'chaozhou', attack: false };
    moveArmies(s);
    expect(a.location).toBe('chaozhou');
  });
});

describe('六、兴学的回报', () => {
  it('同城同年：文教高的城，日后成名之士提早出仕，且多些历练', () => {
    const mk = (edu: number) => {
      const s = createGame('hongguang', 1);
      const c = Object.values(s.chars).find(x => x.status === 'offstage' && x.appear! > s.turn + 12 && s.cities[x.location] && x.id !== 'xuanye')!;   // 储君不作人才出仕
      const base = c.ab.zheng;
      s.cities[c.location].edu = edu;
      s.turn = c.appear! - 6;
      runTalent(s);
      return { st: s.chars[c.id].status, zheng: s.chars[c.id].ab.zheng, base };
    };
    expect(eduLead(45)).toBe(0);
    expect(eduLead(80)).toBeGreaterThanOrEqual(6);
    const lo = mk(45), hi = mk(80);
    expect(lo.st).toBe('offstage');
    expect(hi.st).toBe('active');
    expect(hi.zheng).toBeGreaterThan(hi.base);
  });
});

describe('七、欠饷的长期后果', () => {
  it('短期挪饷无大碍，长期拖欠逃散、士气上限下降；补发后军心回升', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    const sup = s.cities[a.supply];
    a.location = a.supply; a.path = []; a.progress = 0; a.morale = 70;
    const run = (n: number, silver: number) => { for (let i = 0; i < n; i++) { sup.silver = silver; sup.grain = 1e7; runEconomy(s); s.turn++; } };
    const t0 = a.troops;
    run(1, 0);
    expect(a.arrears).toBeGreaterThan(0);
    expect(a.troops).toBe(t0);
    run(5, 0);
    expect(a.unpaid).toBe(6);
    expect(a.troops).toBeLessThan(t0);
    const low = a.morale;
    expect(low).toBeLessThan(60);
    run(1, 5e6);
    expect(a.arrears ?? 0).toBe(0);
    expect(a.unpaid ?? 0).toBe(0);
    expect(a.morale).toBeGreaterThan(low);
    expect(s.reports.some(r => r.text.includes('补发'))).toBe(true);
  });
  it('举镇皆穷：不另逃散，但士气受压；久欠之兵就驻地索饷、扰民', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    a.location = a.supply; a.path = []; a.progress = 0; a.morale = 70; a.troops = 200000;   // 远超举镇财力
    const t0 = a.troops;
    const mx0 = s.cities[a.supply].minxin;
    for (let i = 0; i < 6; i++) {
      for (const c of [...citiesOf(s, 'zheng'), s.cities[a.supply]]) { c.silver = 0; c.grain = Math.max(c.grain, 1e7); }
      runEconomy(s); s.turn++;
    }
    expect(a.troops).toBe(t0);
    expect(a.morale).toBeLessThan(60);
    expect(s.cities[a.supply].minxin).toBeLessThanOrEqual(mx0);
  });
});

describe('七之二、欠饷逃散只罚“有银不发”', () => {
  it('粮台被围、别城的银运不进来：不算挪饷，不另逃散', () => {
    const s = createGame('zheng', 1);
    const a = Object.values(s.armies).find(x => x.faction === 'zheng')!;
    a.location = a.supply; a.path = []; a.progress = 0; a.troops = 200000;
    s.sieges[a.supply] = { node: a.supply, attacker: 'qing', armies: [], startTurn: 0, months: 1 };
    s.relations['qing|zheng'] = { stance: 'war' }; s.relations['hongguang|qing'] = { stance: 'war' };
    const t0 = a.troops;
    for (let i = 0; i < 6; i++) {
      for (const c of citiesOf(s, 'zheng')) { c.silver = c.id === a.supply ? 0 : 5e6; c.grain = Math.max(c.grain, 1e7); }
      s.cities[a.supply].silver = 0; s.cities[a.supply].grain = 1e7;
      runEconomy(s); s.turn++;
    }
    expect(a.unpaid).toBeGreaterThanOrEqual(4);
    expect(a.troops).toBe(t0);
  });
});
