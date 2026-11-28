/* 命令：校验、执行、留痕。玩家与电脑用同一套命令。 */
import { supplyRoute, armyRoute, noRouteReason } from './route';
import type { ArmyOrder, City, GameState, Order } from './types';
import { bump, report, nodeName, factionName, charName, troopsText, friendly, topOf, hostile, adjustLoyalty, adjustAtt, setStance, treasuryOf } from './state';
import { setArmyOrder, capture } from './military';
import { RECRUIT_SILVER, DISBAND_SILVER, GRAIN_PER_SOLDIER, SILVER_PER_SOLDIER, POLICY_NAME, supplyBlock, supplyChoiceError, marketCap, tradeQuote, loanAmount, LOAN_COOLDOWN } from './economy';
import { rngFor } from './rng';
import { seekTalent, seekError, prisonerError, handlePrisoner, SEEK_SILVER, govEffects, hasTrait } from './people';
import { shortestPath, neighbors, NODE, pathDays } from '../data/geography';

export const ORDER_LABEL: Record<Order['kind'], string> = {
  trade: '粜籴', loan: '劝饷', policy: '方针', appoint: '任命', transfer: '调拨', recruit: '募兵', army: '军令', supply: '粮台', reinforce: '增兵', disband: '裁兵',
  envoy: '遣使', persuade: '劝降', command: '号令下属', reward: '犒赏', independence: '自立', war: '宣战', raise: '出兵',
  seek: '招贤', prisoner: '俘虏',
};

/** 命令的一句话描述 */
export function describeOrder(s: GameState, o: Order): string {
  switch (o.kind) {
    case 'policy': return `${nodeName(o.node)}改行“${POLICY_NAME[o.policy]}”方针`;
    case 'appoint': return `任命${charName(s, o.char)}主政${nodeName(o.node)}`;
    case 'seek': return `在${nodeName(o.node)}招贤（${SEEK_SILVER / 1000}千两）`;
    case 'prisoner': return `${o.act === 'recruit' ? '劝降' : o.act === 'release' ? '释放' : '处斩'}俘虏${charName(s, o.char)}`;
    case 'transfer': return `自${nodeName(o.from)}调${o.grain ? `粮 ${o.grain} 石` : ''}${o.grain && o.silver ? '、' : ''}${o.silver ? `银 ${o.silver} 两` : ''}往${nodeName(o.to)}`;
    case 'recruit': return `${nodeName(o.node)}募兵 ${o.troops} 人`;
    case 'disband': return o.army ? `${s.armies[o.army]?.name ?? '军队'}裁撤 ${o.troops} 人${o.troops >= (s.armies[o.army]?.troops ?? Infinity) ? '（全军遣散）' : ''}` : `${nodeName(o.node)}裁撤驻军 ${o.troops} 人`;
    case 'trade': return o.grain >= 0 ? `${nodeName(o.node)}籴粮 ${o.grain} 石` : `${nodeName(o.node)}粜粮 ${-o.grain} 石`;
    case 'loan': return `${nodeName(o.node)}劝捐助饷`;
    case 'army': return `${s.armies[o.army]?.name ?? o.army}${armyOrderText(o.order)}`;
    case 'supply': return `${s.armies[o.army]?.name ?? o.army}改以${nodeName(o.node)}为粮台`;
    case 'reinforce': return o.troops >= 0 ? `${s.armies[o.army]?.name}拨 ${o.troops} 人入${nodeName(o.node)}驻守` : `${nodeName(o.node)}抽驻军 ${-o.troops} 人补入${s.armies[o.army]?.name}`;
    case 'envoy': return `遣${charName(s, o.char)}赴${factionName(s, o.target)}${o.aim === 'alliance' ? '议结盟' : o.aim === 'truce' ? '议停战' : '议和'}`;
    case 'persuade': return `遣${charName(s, o.char)}赴${nodeName(o.node)}劝降`;
    case 'command': return `号令${factionName(s, o.vassal)}：${s.armies[o.army]?.name ?? ''}${armyOrderText(o.order)}${o.silver ? `（犒银 ${o.silver} 两）` : ''}`;
    case 'reward': return `犒赏${factionName(s, o.vassal)}银 ${o.silver} 两`;
    case 'war': return `向${factionName(s, o.target)}宣战`;
    case 'raise': return `${nodeName(o.node)}出兵 ${o.troops} 人，${charName(s, o.char)}统${o.navy ? '水师' : '领'}`;
    case 'independence': return `脱离${factionName(s, s.factions[s.player]?.overlord ?? '')}，自立门户`;
  }
}

export function armyOrderText(o: ArmyOrder): string {
  if (o.kind === 'hold') return '原地驻扎';
  if (o.kind === 'move') return `${o.attack ? '进攻' : '开赴'}${nodeName(o.target)}`;
  return `${o.assault ? '攻打' : '围困'}${nodeName(o.target)}`;
}

/** 校验：返回错误说明，合法返回 null */
/* ---------- 每月政令次数 ----------
 * 军令（调动已有军队、改换粮台）不占次数；定方针、任命、募兵、调拨、出兵、遣使、劝降、号令藩镇、赏赐、宣战等每道占一次。
 * 次数随两样东西变：中枢的理政之才（君主与治所宰辅中政务、威望最高者），以及所辖城池多寡（城多则设官分治、可多发政令）。
 * 方针一经定下逐月照行，不必每月重下；主官在任的城自会按方针治理。 */
export const orderCost = (o: Order): number => (o.kind === 'army' || o.kind === 'supply' ? 0 : 1);
export function orderBudget(s: GameState, f: string): { total: number; factors: string[] } {
  const fac = s.factions[f];
  const capital = fac?.capital;
  const court = Object.values(s.chars).filter(c => c.status === 'active' && c.faction === f && (c.id === fac?.leader || c.location === capital));
  const best = court.sort((a, b) => (b.ab.zheng + b.ab.wang) - (a.ab.zheng + a.ab.wang))[0];
  const talent = best ? Math.max(0, Math.min(3, Math.round((best.ab.zheng + best.ab.wang - 60) / 40))) : 0;
  const cities = Object.values(s.cities).filter(c => c.controller === f).length;
  const scale = Math.min(3, Math.floor(cities / 6));
  const total = Math.max(3, Math.min(9, 3 + talent + scale));
  const factors = [`底数 3`, best ? `${best.name}理政（政务 ${best.ab.zheng}、威望 ${best.ab.wang}）+${talent}` : '中枢无人 +0', `辖 ${cities} 城 +${scale}`];
  return { total, factors };
}
export const ordersUsed = (orders: Order[]) => orders.reduce((n, o) => n + orderCost(o), 0);

export function validateOrder(s: GameState, f: string, o: Order): string | null {
  const own = (node: string) => s.cities[node]?.controller === f;
  switch (o.kind) {
    case 'policy': return own(o.node) ? null : '只能给自己的城定方针';
    case 'seek': return seekError(s, f, o.node);
    case 'prisoner': return prisonerError(s, f, o.char);
    case 'appoint': {
      const c = s.chars[o.char];
      if (!own(o.node)) return '只能任命自己城池的主官';
      if (!c || c.faction !== f || c.status !== 'active') return '此人不可任用';
      if (Object.values(s.armies).some(a => a.commander === o.char)) return '此人正在统兵';
      return null;
    }
    case 'transfer': {
      if (!own(o.from)) return '只能从自己的城调出';
      const to = s.cities[o.to];
      if (!to || !friendly(s, f, to.controller)) return '只能调往己方或友方城池';
      if (o.grain < 0 || o.silver < 0 || (!o.grain && !o.silver)) return '数目不对';
      if (o.grain > s.cities[o.from].grain || o.silver > s.cities[o.from].silver) return '库存不足';
      return supplyBlock(s, f, o.from, o.to);
    }
    case 'trade': {
      const c = s.cities[o.node];
      if (!own(o.node)) return '只能在自己的城粜籴';
      if (s.sieges[o.node]) return '城被围，市面断绝';
      if (!o.grain) return '数量为零';
      const used = c.tradeTurn === s.turn ? c.tradeN ?? 0 : 0;
      if (Math.abs(o.grain) + used > marketCap(s, c)) return `市面有限，本月至多再粜籴 ${Math.max(0, marketCap(s, c) - used)} 石`;
      const q = tradeQuote(s, c, o.grain);
      if (o.grain > 0 && q.silver > c.silver) return '府库银两不足';
      if (o.grain < 0 && -o.grain > c.grain) return '仓粮不足';
      return null;
    }
    case 'loan': {
      if (!own(o.node)) return '只能在自己的城劝捐';
      const last = Number(s.flags['loan_' + o.node] ?? -99);
      if (s.turn - last < LOAN_COOLDOWN) return `此城绅商新近捐过，${LOAN_COOLDOWN - (s.turn - last)} 个月后再劝`;
      if (s.sieges[o.node]) return '城被围，绅商闭户';
      return null;
    }
    case 'recruit': {
      const c = s.cities[o.node];
      if (!own(o.node)) return '只能在自己的城募兵';
      if (s.sieges[o.node]) return '城被围，募不到兵';
      const left = recruitLeft(s, o.node);
      if (o.troops <= 0 || o.troops > left) return `本城本月最多再募 ${left} 人`;
      if (c.silver < o.troops * RECRUIT_SILVER) return '府库不足';
      return null;
    }
    case 'army': {
      const a = s.armies[o.army];
      if (!a || a.faction !== f) return '不是你的军队';
      if (o.order.kind !== 'hold') { const st = a.progress > 0 && a.path.length ? a.path[0] : a.location; if (armyRoute(s, a.faction, st, o.order.target, a.mix.navy >= 0.3) === null) return noRouteReason(s, a.faction, st, o.order.target, a.mix.navy >= 0.3); }
      return null;
    }
    case 'supply': {
      const a = s.armies[o.army];
      if (!a || a.faction !== f) return '不是你的军队';
      return supplyChoiceError(s, a, o.node);
    }
    case 'reinforce': {
      const a = s.armies[o.army];
      if (!a || a.faction !== f) return '不是你的军队';
      if (a.location !== o.node || a.progress > 0 || !own(o.node)) return '军队须在己方城中';
      if (o.troops > 0 && o.troops > a.troops - 500) return '军队至少留 500 人';
      if (o.troops < 0 && -o.troops > s.cities[o.node].garrison - 500) return '城中至少留 500 人';
      return null;
    }
    case 'disband': {
      if (!own(o.node)) return '只能裁自己城中的兵';
      if (s.sieges[o.node]) return '城被围，不能裁兵';
      if (!(o.troops > 0)) return '人数不对';
      if (o.army) {
        const a = s.armies[o.army];
        if (!a || a.faction !== f) return '不是你的军队';
        if (a.location !== o.node || a.progress > 0) return '军队须驻在本方城中才能遣散';
        if (o.troops > a.troops) return `此军只有 ${a.troops} 人`;
        if (o.troops < a.troops && a.troops - o.troops < 500) return '军队至少留 500 人（或全军遣散）';
        return null;
      }
      if (o.troops > s.cities[o.node].garrison - 500) return '城中至少留 500 人';
      return null;
    }
    case 'envoy': case 'persuade': {
      const c = s.chars[o.char];
      if (!c || c.faction !== f || c.status !== 'active') return '此人不可出使';
      if (Object.values(s.armies).some(a => a.commander === o.char)) return '此人正在统兵';
      if (s.missions.some(m => (m.order as any).char === o.char)) return '此人已在出使途中';
      if (o.kind === 'envoy' && (!s.factions[o.target] || o.target === f)) return '对象不对';
      if (o.kind === 'persuade') {
        const city = s.cities[o.node];
        if (!city || friendly(s, f, city.controller)) return '只能劝降敌方或中立城池';
        if (s.missions.some(m => m.faction === f && m.order.kind === 'persuade' && m.order.node === o.node)) return '已有使者赴此城劝降';
      }
      return null;
    }
    case 'command': {
      const v = s.factions[o.vassal];
      const a = s.armies[o.army];
      if (!v || v.overlord !== f) return '不是你的下属';
      if (!a || a.faction !== o.vassal) return '军队不属该部';
      const cap = s.cities[treasuryOf(s, f)];
      if (o.silver > (cap?.silver ?? 0)) return '府库不足';
      return null;
    }
    case 'raise': {
      const c = s.cities[o.node];
      if (!c || c.controller !== f) return '不是你的城';
      if (s.sieges[o.node]) return '城被围，出不了兵';
      const ch = s.chars[o.char];
      if (!ch || ch.faction !== f || ch.status !== 'active') return '此人不可统兵';
      if (Object.values(s.armies).some(a => a.commander === o.char)) return '此人已在统兵';
      if (s.missions.some(m => (m.order as any).char === o.char)) return '此人正在出使';
      if (o.troops < 1000) return '至少一千人';
      if (o.troops > c.garrison - 1000) return '城中至少留一千人';
      if (o.navy && NODE[o.node]?.kind !== 'port' && !neighbors(o.node).some(n => n.route.kind === 'river' || n.route.kind === 'sea')) return '此城不临江海，不能编练水师';
      return null;
    }
    case 'war': {
      const t = s.factions[o.target];
      if (!t || t.defunct) return '无此势力';
      if (topOf(s, o.target) === topOf(s, f)) return '同属一方，不能宣战';
      if (hostile(s, f, o.target)) return '已在交战';
      return null;
    }
    case 'independence': return s.factions[f]?.overlord ? null : '本方并不奉谁号令';
    case 'reward': {
      const v = s.factions[o.vassal];
      if (!v || v.overlord !== f) return '不是你的下属';
      const cap = s.cities[treasuryOf(s, f)];
      if (o.silver <= 0 || o.silver > (cap?.silver ?? 0)) return '府库不足';
      return null;
    }
  }
}

/** 使者路程：走驿路兼程（无陆路可通才搭海船），按军行日程的六成计，每三十日一个月，最少一个月 */
export function envoyMonths(s: GameState, char: string, dest?: string): number {
  const from = s.chars[char]?.location;
  if (!from || !dest || from === dest) return 1;
  const p = shortestPath(from, dest, false) ?? shortestPath(from, dest, true);
  if (!p) return 1;
  return Math.max(1, Math.ceil(pathDays(from, p) * 0.6 / 30));
}

/** 按已排命令试算：在本月局面的副本上，照月结第一阶段的顺序（先执行上月拖延的号令，宣战在先，政令次数之内）
 *  依次执行已排的命令，得到命令执行后的局面。原局面不动。城池面板、预估、报价、下令校验都以此为准。 */
export function projectOrders(s: GameState, orders: Order[]): GameState {
  const t = structuredClone(s);
  const delayed = t.delayed; t.delayed = [];
  for (const o of delayed) applyOrder(t, t.player, o.kind === 'command' ? { ...o, silver: 0 } : o);
  const budget = orderBudget(t, t.player).total;
  let used = 0;
  for (const o of [...orders].sort((a, b) => Number(b.kind === 'war') - Number(a.kind === 'war'))) {
    if (used + orderCost(o) > budget) continue;
    used += orderCost(o);
    applyOrder(t, t.player, o);
  }
  return t;
}
/** 在已排命令之后再下这一道，是否行得通（按试算后的局面校验） */
export function validateQueued(s: GameState, queued: Order[], o: Order): string | null {
  return validateOrder(projectOrders(s, queued), s.player, o);
}

/** 本月还能募多少（按月初人口与民心定上限，同月多道命令累计） */
export function recruitLeft(s: GameState, node: string): number {
  const c = s.cities[node];
  const used = c.recruitTurn === s.turn ? c.recruitN ?? 0 : 0;
  return Math.max(0, maxRecruit(c, s) - used);
}

/**
 * 粮道：钱粮沿道路运送，被围之城送不进也运不出；途中必须经过非敌方城池。
 * 返回阻断原因，畅通返回 null。
 */
export { supplyBlock } from './economy';

/** 每月募兵上限：按人口与民心；主官长于练兵者多三成 */
export const maxRecruit = (c: City, s?: GameState) => Math.max(0, Math.round(c.pop * 10000 * 0.004 * (0.5 + c.minxin / 100) * (s ? govEffects(s, c).recruitMul : 1) / 100) * 100);

/** 执行一道命令（已在月初校验）。交涉类只建立任务，下月抵达。 */
export function applyOrder(s: GameState, f: string, o: Order) {
  const err = validateOrder(s, f, o);
  const isPlayer = f === s.player;
  if (err) {
    if (isPlayer) report(s, { cat: '内政', text: `命令未能执行：${describeOrder(s, o)}（${err}）。` });
    return;
  }
  const src = { kind: 'order' as const, ref: o.id, turn: s.turn };
  switch (o.kind) {
    case 'seek': seekTalent(s, f, o.node, o.id); break;
    case 'prisoner': handlePrisoner(s, f, o.char, o.act, o.id); break;
    case 'policy':
      s.cities[o.node].policy = o.policy;
      if (isPlayer) report(s, { cat: '内政', node: o.node, text: `${describeOrder(s, o)}。`, src });
      break;
    case 'appoint': {
      const c = s.cities[o.node];
      const prev = c.governor;
      // 一人只任一城：调任即卸旧职
      const old = Object.values(s.cities).find(x => x.id !== o.node && x.governor === o.char);
      if (old) delete old.governor;
      c.governor = o.char;
      s.chars[o.char].location = o.node;
      if (isPlayer) report(s, { cat: '人事', node: o.node, text: `${describeOrder(s, o)}${old ? `，卸去${nodeName(old.id)}主官` : ''}${prev && prev !== o.char ? `，接替${charName(s, prev)}` : ''}。`, src });
      break;
    }
    case 'transfer': {
      const txt = describeOrder(s, o);
      // 沿实际可走的粮道运送：粮按路程折耗（银不耗）；三十日内当月送到，路远的在途若干月
      const leg = supplyRoute(s, f, o.from, o.to);
      if (leg.reason) { if (isPlayer) report(s, { cat: '内政', node: o.from, text: `${txt}未能起运：${leg.reason}。`, src }); break; }
      const grain = Math.min(o.grain, s.cities[o.from].grain), silver = Math.min(o.silver, s.cities[o.from].silver);
      const arrive = Math.round(grain * leg.keep), lost = grain - arrive;
      const months = Math.max(1, Math.ceil(leg.days / 30));
      const loss = lost ? `，途耗 ${lost} 石` : '';
      if (grain) bump(s, o.from, 'grain', -grain, `调粮往${nodeName(o.to)}${months > 1 ? `（在途约 ${months} 月）` : ''}`, src);
      if (silver) bump(s, o.from, 'silver', -silver, `调银往${nodeName(o.to)}`, src);
      if (months > 1) {
        (s.convoys ??= []).push({ id: o.id, faction: f, from: o.from, to: o.to, grain: arrive, silver, sent: s.turn, arrive: s.turn + months - 1, days: leg.days, path: leg.path });
        if (isPlayer) report(s, { cat: '内政', node: o.from, text: `${txt}，路程 ${leg.days} 日，约 ${months} 个月后运到${loss}。`, src });
        break;
      }
      if (arrive) bump(s, o.to, 'grain', arrive, `自${nodeName(o.from)}调来粮${loss ? `（${loss.slice(1)}）` : ''}`, src);
      if (silver) bump(s, o.to, 'silver', silver, `自${nodeName(o.from)}调来银`, src);
      const to = s.cities[o.to];
      if (to.controller !== f && s.factions[to.controller]?.overlord === f) adjustLoyalty(s, to.controller, Math.min(8, Math.round((o.grain / 4 + o.silver) / 4000)), '朝廷拨给钱粮');
      if (isPlayer) report(s, { cat: '内政', node: o.to, text: `${txt}${leg.days ? `，路程 ${leg.days} 日` : ''}${loss}。`, src });
      break;
    }
    case 'trade': {
      const c = s.cities[o.node];
      const q = tradeQuote(s, c, o.grain);
      if (o.grain > 0) { bump(s, o.node, 'silver', -q.silver, `籴粮 ${o.grain} 石（每石 ${q.unit.toFixed(2)} 两）`, src); bump(s, o.node, 'grain', o.grain, '市籴', src); }
      else { bump(s, o.node, 'grain', o.grain, `粜粮 ${-o.grain} 石（每石 ${q.unit.toFixed(2)} 两）`, src); bump(s, o.node, 'silver', q.silver, '市粜', src); }
      c.tradeN = (c.tradeTurn === s.turn ? c.tradeN ?? 0 : 0) + Math.abs(o.grain); c.tradeTurn = s.turn;
      if (isPlayer) report(s, { cat: '内政', node: o.node, text: `${describeOrder(s, o)}，${o.grain > 0 ? '花银' : '得银'} ${q.silver} 两（市价每石 ${q.price.toFixed(2)} 两）。`, src });
      break;
    }
    case 'loan': {
      const c = s.cities[o.node];
      const amt = loanAmount(s, c);
      bump(s, o.node, 'silver', amt, '劝捐助饷', src);
      bump(s, o.node, 'minxin', -5, '劝捐助饷，绅商怨望', src);
      bump(s, o.node, 'order', -2, '劝捐助饷', src);
      s.flags['loan_' + o.node] = s.turn;
      if (isPlayer) report(s, { cat: '内政', node: o.node, text: `${nodeName(o.node)}劝捐助饷，得银 ${amt} 两；民心 −5、吏治 −2。`, src });
      break;
    }
    case 'recruit': {
      const c = s.cities[o.node];
      bump(s, o.node, 'silver', -o.troops * RECRUIT_SILVER, `募兵 ${o.troops} 人`, src);
      if (c.recruitTurn !== s.turn) { c.recruitTurn = s.turn; c.recruitN = 0; }
      c.recruitN = (c.recruitN ?? 0) + o.troops;
      bump(s, o.node, 'garrison', o.troops, `募兵 ${o.troops} 人`, src);
      bump(s, o.node, 'pop', -o.troops / 10000, `募兵 ${o.troops} 人`, src);
      bump(s, o.node, 'minxin', -Math.round(o.troops / 1500 * 10) / 10, `募兵 ${o.troops} 人`, src);
      if (isPlayer) report(s, { cat: '内政', node: o.node, text: `${describeOrder(s, o)}。每月多耗口粮 ${Math.round(o.troops * GRAIN_PER_SOLDIER)} 石、饷银 ${Math.round(o.troops * SILVER_PER_SOLDIER)} 两。`, src });
      break;
    }
    case 'army': {
      const a = s.armies[o.army];
      setArmyOrder(s, a, o.order);
      if (isPlayer) report(s, { cat: '军报', node: a.location, text: `${describeOrder(s, o)}。`, src });
      break;
    }
    case 'supply': {
      const a = s.armies[o.army];
      a.supply = o.node;
      if (isPlayer) report(s, { cat: '军报', node: o.node, text: `${describeOrder(s, o)}。`, src });
      break;
    }
    case 'reinforce': {
      const a = s.armies[o.army];
      a.troops -= o.troops;
      bump(s, o.node, 'garrison', o.troops, o.troops > 0 ? `${a.name}拨兵入城` : `抽兵补入${a.name}`, src);
      if (isPlayer) report(s, { cat: '军报', node: o.node, text: `${describeOrder(s, o)}。`, src });
      break;
    }
    case 'disband': {
      const c = s.cities[o.node];
      const a = o.army ? s.armies[o.army] : undefined;
      const n = o.troops;
      // 遣散银：每人半两；军队连同所欠之饷，按人分摊
      const owed = a ? Math.round((a.arrears ?? 0) * n / Math.max(1, a.troops)) : 0;
      const due = Math.round(n * DISBAND_SILVER) + owed;
      const paid = Math.max(0, Math.min(due, Math.floor(c.silver)));
      const short = due ? 1 - paid / due : 0;
      if (paid) bump(s, o.node, 'silver', -paid, `裁兵 ${n} 人遣散银${owed ? '（含结清欠饷）' : ''}`, src);
      if (a) {
        if (a.arrears) a.arrears = Math.max(0, a.arrears - owed);
        if (n >= a.troops) delete s.armies[a.id];
        else a.troops -= n;
      } else bump(s, o.node, 'garrison', -n, `裁撤驻军 ${n} 人`, src);
      // 给足遣散银者归农（人口回升、民心稍安）；给不足的那部分散兵无资归乡，流为盗匪
      const home = n * (1 - short);
      bump(s, o.node, 'pop', Math.round(home / 10000 * 100) / 100, '散兵归农', src);
      if (home >= 1000) bump(s, o.node, 'minxin', Math.round(home / 5000 * 10) / 10, '裁兵省饷，百姓少累', src);
      const lost = n * short;
      if (lost >= 300) {
        bump(s, o.node, 'minxin', -Math.round(lost / 1500 * 10) / 10, '散兵为盗', src);
        bump(s, o.node, 'order', -Math.max(1, Math.round(lost / 3000)), '散兵为盗', src);
      }
      if (isPlayer) report(s, { cat: lost >= 300 ? '急报' : '军报', urgent: lost >= 300, node: o.node, src,
        text: `${describeOrder(s, o)}，${paid ? `发遣散银 ${paid} 两` : '府库无银可发'}${lost >= 300 ? `；约 ${Math.round(lost / 100) * 100} 人无资归乡，啸聚为盗（民心、吏治下降）` : '，散兵各自归农'}。每月省口粮约 ${Math.round(n * GRAIN_PER_SOLDIER)} 石、饷银约 ${Math.round(n * (a ? 0.9 : SILVER_PER_SOLDIER))} 两。` });
      break;
    }
    case 'envoy': case 'persuade': {
      const months = envoyMonths(s, o.char, o.kind === 'persuade' ? o.node : s.factions[o.target]?.capital);
      s.missions.push({ id: o.id, order: o, faction: f, issuedTurn: s.turn, arriveTurn: s.turn + months });
      if (isPlayer) report(s, { cat: '交涉', node: o.kind === 'persuade' ? o.node : s.factions[o.target]?.capital, text: `${describeOrder(s, o)}，${months <= 1 ? '下月' : `路远，约 ${months} 个月后`}可有回音。`, src });
      break;
    }
    case 'command':
      commandVassal(s, f, o, src);
      break;
    case 'raise': {
      const c = s.cities[o.node], ch = s.chars[o.char];
      const pol = s.factions[f].polity;
      const mix = o.navy ? { inf: 0.4, cav: 0, gun: 0.2, navy: 0.4 } : pol === 'qing' ? { inf: 0.45, cav: 0.4, gun: 0.15, navy: 0 } : pol === 'shun' || pol === 'xi' ? { inf: 0.6, cav: 0.3, gun: 0.1, navy: 0 } : { inf: 0.65, cav: 0.15, gun: 0.2, navy: 0 };
      const aid = `a_${f}_${s.nextId++}`;
      s.armies[aid] = { id: aid, name: `${ch.name}${o.navy ? '水师' : '部'}`, faction: f, commander: ch.id, troops: o.troops, mix, morale: Math.round(45 + c.minxin * 0.25), location: o.node, path: [], progress: 0, order: { kind: 'hold' }, supply: o.node, hunger: 0 };
      ch.location = o.node;
      // 领兵即离任：原任何城主官都卸去，该城不再得其治理
      const posts = Object.values(s.cities).filter(x => x.governor === ch.id);
      for (const x of posts) delete x.governor;
      bump(s, o.node, 'garrison', -o.troops, `编成${ch.name}${o.navy ? '水师' : '部'}出征`, src);
      report(s, { cat: '军报', node: o.node, text: `${nodeName(o.node)}抽驻军 ${troopsText(o.troops)} 人编成${ch.name}${o.navy ? '水师' : '部'}，听候调遣。${posts.length ? `${ch.name}卸去${posts.map(x => nodeName(x.id)).join('、')}主官。` : ''}`, src });
      break;
    }
    case 'war': {
      const tgt = topOf(s, o.target);
      setStance(s, f, tgt, 'war');
      if (tgt !== o.target) setStance(s, f, o.target, 'war');
      for (const c of Object.values(s.chars)) if (c.faction === f && c.status === 'active') adjustAtt(s, c.id, 'hawk', c.att.hawk > 0 ? 3 : -3, `向${factionName(s, tgt)}宣战`);
      report(s, { cat: '交涉', urgent: true, node: s.factions[tgt]?.capital, text: `${factionName(s, f)}向${factionName(s, tgt)}宣战，两家交兵。`, src });
      break;
    }
    case 'independence': {
      const fac = s.factions[f], lord = fac.overlord!;
      delete fac.overlord; delete fac.loyalty;
      setStance(s, f, lord, 'neutral');
      for (const c of Object.values(s.chars)) if (c.faction === f && c.att.loyalty > 70) adjustAtt(s, c.id, 'loyalty', -8, `${fac.name}自立，有违名分`);
      report(s, { cat: '交涉', urgent: true, text: `${fac.name}脱离${factionName(s, lord)}，自立门户。双方暂不交兵。`, src });
      break;
    }
    case 'reward': {
      const cap = treasuryOf(s, f);
      bump(s, cap, 'silver', -o.silver, `犒赏${factionName(s, o.vassal)}`, src);
      const gain = Math.min(15, Math.round(o.silver / 2500));
      const before = s.factions[o.vassal].loyalty ?? 0;
      adjustLoyalty(s, o.vassal, gain, `受${factionName(s, f)}犒赏银 ${o.silver} 两`);
      const after = s.factions[o.vassal].loyalty ?? 0;
      if (isPlayer) report(s, { cat: '交涉', text: `${describeOrder(s, o)}，${charName(s, s.factions[o.vassal].leader)}感念，服从 ${before} → ${after}${after - before < gain ? `（已到顶，实增 ${after - before}）` : ''}。`, src });
      break;
    }
  }
}

/* ---------- 下属服从 ---------- */
export interface Obedience { result: 'comply' | 'delay' | 'half' | 'refuse'; score: number; factors: string[] }

export function obedience(s: GameState, f: string, o: Extract<Order, { kind: 'command' }>, roll = true): Obedience {
  const v = s.factions[o.vassal];
  const a = s.armies[o.army];
  const leader = s.chars[v.leader];
  const factors: string[] = [];
  let score = 0;
  const base = (v.loyalty ?? 50) * 0.6 + (leader?.att.loyalty ?? 50) * 0.4;
  score += base; factors.push(`服从度 ${Math.round(base)}`);
  if (o.silver > 0) { const g = Math.min(25, o.silver / 1000); score += g; factors.push(`犒银 +${Math.round(g)}`); }
  // 督师在侧
  const shi = Object.values(s.chars).find(c => c.faction === f && c.status === 'active' && c.ab.wang >= 80 && c.id !== s.factions[f].leader && (c.location === a.location || shortestPath(c.location, a.location, false)?.length === 1));
  if (shi) { score += 10; factors.push(`${shi.name}在侧督促 +10`); }
  if (o.order.kind !== 'hold') {
    const target = o.order.target;
    const tc = s.cities[target];
    const foes = Object.values(s.armies).filter(x => hostile(s, x.faction, f) && (x.location === target || shortestPath(x.location, target, false)?.length === 1));
    const foePower = foes.reduce((n, x) => n + x.troops, 0) + (tc && hostile(s, f, tc.controller) ? tc.garrison * 1.5 : 0);
    if (foePower > a.troops * 1.2) { score -= 20; factors.push('敌势强于本部，恐遭折损 −20'); }
    else if (foePower > a.troops * 0.6) { score -= 8; factors.push('须与敌接战 −8'); }
    const leaveHome = a.location === v.capital && target !== v.capital;
    if (leaveHome) { score -= 10; factors.push(`须离开驻地${nodeName(v.capital)} −10`); }
    if (tc && tc.controller !== o.vassal && tc.commerce >= 80 && !hostile(s, f, tc.controller)) { score += 5; factors.push(`${nodeName(target)}富庶，乐于前往 +5`); }
    if (leader && (o.order.kind === 'siege' || (o.order.kind === 'move' && o.order.attack))) {
      const h = Math.round(leader.att.hawk / 10); score += h; if (h) factors.push(`${leader.name}${h > 0 ? '好战' : '畏战'} ${h > 0 ? '+' : ''}${h}`);
    }
  }
  if (roll) { const r = rngFor(s.seed, 'obey', s.turn, o.id).int(-10, 10); score += r; factors.push(`临事变数 ${r >= 0 ? '+' : ''}${r}`); }
  const result = score >= 65 ? 'comply' : score >= 50 ? 'delay' : score >= 35 ? 'half' : 'refuse';
  return { result, score: Math.round(score), factors };
}

const RESULT_TEXT = { comply: '照办', delay: '拖延', half: '打折扣', refuse: '抗命' };

function commandVassal(s: GameState, f: string, o: Extract<Order, { kind: 'command' }>, src: { kind: 'order'; ref: string; turn: number }) {
  const v = s.factions[o.vassal];
  const a = s.armies[o.army];
  if (o.silver > 0) {
    bump(s, treasuryOf(s, f), 'silver', -o.silver, `犒${v.name}以促其奉命`, src);
    adjustLoyalty(s, o.vassal, Math.min(5, Math.round(o.silver / 4000)), '奉命受犒');
  }
  const ob = obedience(s, f, o);
  const leader = charName(s, v.leader);
  let text = `号令${v.name}（${leader}）：${a.name}${armyOrderText(o.order)}。结果：${RESULT_TEXT[ob.result]}。`;
  switch (ob.result) {
    case 'comply':
      setArmyOrder(s, a, o.order);
      if (f === s.player) s.flags['commanded_' + a.id] = o.order.kind === 'hold' ? -1 : s.turn;
      break;
    case 'delay':
      s.delayed.push({ ...o, silver: 0, id: o.id + 'd' });
      text += '推说粮草未齐，下月再动。';
      break;
    case 'half': {
      const part = Math.round(a.troops / 2);
      const deputy = Object.values(s.chars).find(c => c.faction === o.vassal && c.status === 'active' && c.id !== a.commander && c.id !== v.leader && !s.missions.some(m => (m.order as { char?: string }).char === c.id) && !Object.values(s.armies).some(x => x.commander === c.id));
      if (deputy && part >= 1000) {
        const id = a.id + '_' + s.nextId++;
        s.armies[id] = { ...structuredClone(a), id, name: a.name + '分兵', troops: part, commander: deputy.id, path: [], progress: 0, arrears: 0, unpaid: 0 };
        a.troops -= part;
        setArmyOrder(s, s.armies[id], o.order);
        if (f === s.player) s.flags['commanded_' + id] = s.turn;
        text += `只遣${deputy.name}率半数 ${troopsText(part)} 人前往，主力仍留原地。`;
      } else {
        a.morale = Math.max(5, a.morale - 10);
        setArmyOrder(s, a, o.order);
        if (f === s.player) s.flags['commanded_' + a.id] = s.turn;
        text += '勉强出兵，军无斗志。';
      }
      break;
    }
    case 'refuse':
      adjustLoyalty(s, o.vassal, -3, '抗命');
      text += '推辞不奉。';
      break;
  }
  text += `（${ob.factors.join('，')}；合计 ${ob.score}）`;
  if (f === s.player) report(s, { cat: '交涉', node: a.location, ok: ob.result === 'comply' || ob.result === 'half', text, src });
  // 被反复催逼会伤及关系
  if (ob.result !== 'comply' && leader) adjustAtt(s, v.leader, 'loyalty', -1, '朝廷催逼');
}

/* ---------- 跨月交涉 ---------- */
/** 对方开出的条件：差一点议成时，对方要一笔银子 */
export interface Counter { faction: string; target: string; aim: 'alliance' | 'truce' | 'peace'; silver: number; char: string; text: string }
export function resolveMissions(s: GameState): Counter[] {
  const due = s.missions.filter(m => m.arriveTurn <= s.turn);
  s.missions = s.missions.filter(m => m.arriveTurn > s.turn);
  const counters: Counter[] = [];
  for (const m of due) {
    const o = m.order;
    // 回报之前复核使者：途中身故、被执、改投他方，或本方已亡，此行作罢
    const env = 'char' in o ? s.chars[(o as { char: string }).char] : undefined;
    if (env && (env.status !== 'active' || env.faction !== m.faction || s.factions[m.faction]?.defunct)) {
      const why = env.status === 'dead' ? '已殁于途' : env.status === 'captured' ? '途中被执' : env.faction !== m.faction ? '已改投他方' : '本方已亡';
      if (m.faction === s.player) report(s, { cat: '交涉', ok: false, node: o.kind === 'persuade' ? o.node : s.factions[(o as { target: string }).target]?.capital, text: `${env.name}${why}，${o.kind === 'persuade' ? '劝降' : '出使'}之事作罢。`, src: { kind: 'diplomacy', ref: m.order.id, turn: s.turn } });
      continue;
    }
    if (o.kind === 'envoy') { const c = resolveEnvoy(s, m.faction, o); if (c) counters.push(c); }
    else if (o.kind === 'persuade') resolvePersuade(s, m.faction, o);
  }
  return counters;
}
/** 玩家答复对方的条件：付银则议成 */
export function answerCounter(s: GameState, c: Counter, pay: boolean): string {
  const cap = s.cities[treasuryOf(s, c.faction)];
  const aimText = c.aim === 'alliance' ? '结盟' : c.aim === 'truce' ? '停战' : '议和';
  let text: string, ok = false;
  if (pay && cap && cap.silver >= c.silver) {
    bump(s, cap.id, 'silver', -c.silver, `${aimText}${factionName(s, c.target)}所索之银`, { kind: 'diplomacy', ref: 'counter:' + c.target });
    bump(s, treasuryOf(s, c.target), 'silver', c.silver, `${factionName(s, c.faction)}${aimText}所付之银`, { kind: 'diplomacy', ref: 'counter:' + c.target });
    if (c.aim === 'alliance') setStanceExplicit(s, c.faction, c.target, 'alliance');
    else setStanceExplicit(s, c.faction, c.target, c.aim === 'truce' ? 'truce' : 'neutral', c.aim === 'truce' ? s.turn + 6 : undefined);
    adjustAtt(s, c.char, 'loyalty', 2, `出使${factionName(s, c.target)}，${aimText}成功`);
    ok = true; text = `付银 ${c.silver} 两，与${factionName(s, c.target)}${aimText}议成。`;
  } else text = pay ? '府库不足，付不出所索之银，和议作罢。' : `不允${factionName(s, c.target)}所索，${aimText}之议作罢。`;
  report(s, { cat: '交涉', ok, node: s.factions[c.target]?.capital, origin: s.factions[c.faction]?.capital, text, src: { kind: 'diplomacy', ref: 'counter:' + c.target } });
  return text;
}

export function envoyScore(s: GameState, f: string, o: Extract<Order, { kind: 'envoy' }>): { score: number; factors: string[] } {
  const t = s.factions[o.target];
  const env = s.chars[o.char];
  const leader = s.chars[t.leader];
  const factors: string[] = [];
  let score = 30;
  factors.push('底数 30');
  const w = Math.round((env.ab.wai - 50) / 2); score += w; factors.push(`${env.name}外交 ${w >= 0 ? '+' : '−'}${Math.abs(w)}`);
  if (hasTrait(env, 'biancai')) { score += 6; factors.push(`${env.name}有辩才 +6`); }
  const common = Object.values(s.factions).filter(x => !x.defunct && x.id !== f && x.id !== o.target && hostile(s, f, x.id) && hostile(s, o.target, x.id) && x.id !== 'local');
  if (common.length) { score += 25; factors.push(`同仇${common.map(c => c.short).join('、')} +25`); }
  const st = s.relations[[f, o.target].sort().join('|')]?.stance ?? 'neutral';
  if (st === 'war' && o.aim === 'alliance') { score -= 30; factors.push('两家正在交战 −30'); }
  if (st === 'war' && o.aim !== 'alliance') {
    // 战事不利者愿意停战
    const mine = Object.values(s.armies).filter(a => a.faction === f).reduce((n, a) => n + a.troops, 0);
    const theirs = Object.values(s.armies).filter(a => a.faction === o.target).reduce((n, a) => n + a.troops, 0);
    if (theirs < mine) { score += 15; factors.push('对方兵力不及 +15'); } else { score -= 10; factors.push('对方兵强 −10'); }
  }
  if (leader) { const h = -Math.round(leader.att.hawk / 8); score += h; if (h) factors.push(`${leader.name}${h > 0 ? '主和' : '主战'} ${h >= 0 ? '+' : '−'}${Math.abs(h)}`); }
  if (s.factions[o.target].polity === s.factions[f].polity) { score += 10; factors.push('同奉一朝 +10'); }
  return { score, factors };
}

function resolveEnvoy(s: GameState, f: string, o: Extract<Order, { kind: 'envoy' }>): Counter | null {
  const t = s.factions[o.target];
  if (!t || t.defunct) return null;
  const { score, factors } = envoyScore(s, f, o);
  const rng = rngFor(s.seed, 'envoy', s.turn, o.id);
  const r = rng.int(-10, 10);
  const total = score + r;
  const ok = total >= 55;
  const aimText0 = o.aim === 'alliance' ? '结盟' : o.aim === 'truce' ? '停战' : '议和';
  // 差一点议成：对方开条件，要一笔银子（玩家一方由玩家定夺，电脑一方作罢）
  if (!ok && (total >= 45 || s.flags.counter_force) && f === s.player) {
    const silver = Math.round(Math.max(10000, (55 - total) * 4000 + 10000) / 1000) * 1000;
    const text = `${charName(s, o.char)}至${t.name}议${aimText0}，${charName(s, t.leader)}未置可否，开出条件：须银 ${silver} 两。（${factors.join('，')}，临事 ${r >= 0 ? '+' : ''}${r}；合计 ${total}，需 55）`;
    return { faction: f, target: o.target, aim: o.aim, silver, char: o.char, text };
  }
  // 交战之中谈崩：使者可能被扣
  if (!ok && total < 35 && hostile(s, f, o.target) && rng.chance(0.3)) {
    const env = s.chars[o.char];
    if (env && env.status === 'active') { env.status = 'captured'; env.captor = o.target; env.capturedAt = s.turn; env.location = t.capital; }
    if (f === s.player || o.target === s.player) report(s, { cat: '交涉', ok: false, urgent: f === s.player, node: t.capital, origin: s.factions[f]?.capital, text: `${charName(s, o.char)}出使${t.name}议${aimText0}，${charName(s, t.leader)}怒而扣留来使。（合计 ${total}，需 55）`, src: { kind: 'diplomacy', ref: o.id, turn: s.turn } });
    return null;
  }
  const aimText = o.aim === 'alliance' ? '结盟' : o.aim === 'truce' ? '停战' : '议和';
  const src = { kind: 'diplomacy' as const, ref: o.id, turn: s.turn };
  if (ok) {
    if (o.aim === 'alliance') setStanceExplicit(s, f, o.target, 'alliance');
    else setStanceExplicit(s, f, o.target, o.aim === 'truce' ? 'truce' : 'neutral', o.aim === 'truce' ? s.turn + 6 : undefined);
    adjustAtt(s, o.char, 'loyalty', 2, `出使${t.name}，${aimText}成功`);
  }
  const text = `${charName(s, o.char)}出使${t.name}，${aimText}${ok ? '议成' : '未成'}。${ok && o.aim === 'alliance' ? '两家结为盟好，各守其城，互不相犯。' : ''}（${factors.join('，')}，临事 ${r >= 0 ? '+' : ''}${r}；合计 ${total}，需 55）`;
  if (f === s.player || o.target === s.player) report(s, { cat: '交涉', node: t.capital, ok, origin: s.factions[f]?.capital, text, src });
  return null;
}

function setStanceExplicit(s: GameState, a: string, b: string, st: 'alliance' | 'truce' | 'neutral', until?: number) {
  s.relations[[a, b].sort().join('|')] = until === undefined ? { stance: st } : { stance: st, until };
}

/** 劝降不成后，同一城这么多个月内再劝成算减半 */
export const PERSUADE_COOLDOWN = 6;
export function persuadeChance(s: GameState, f: string, charId: string, node: string): { p: number; factors: string[] } {
  const city = s.cities[node];
  const env = s.chars[charId];
  const gov = city.governor ? s.chars[city.governor] : undefined;
  const factors: string[] = [];
  let p = 0.05; factors.push('底数 5%');
  const sur = gov && gov.status === 'active' ? gov.att.surrender : 40 + (100 - city.minxin) / 4;
  // 敌将心意不可精知：只说个大概
  p += sur / 250; factors.push(`${gov ? gov.name : '守将'}降意${sur >= 60 ? '颇高' : sur >= 35 ? '平常' : '甚低'}`);
  p += (env.ab.wai - 50) / 300; factors.push(`${env.name}外交（${env.ab.wai >= 50 ? '+' : ''}${Math.round((env.ab.wai - 50) / 3)}%）`);
  if (hasTrait(env, 'biancai')) { p += 0.08; factors.push(`${env.name}有辩才 +8%`); }
  const sg = s.sieges[node];
  if (sg && topOf(s, sg.attacker) === topOf(s, f)) { p += 0.25; factors.push('城已被我军围困 +25%'); }
  const near = Object.values(s.armies).filter(a => topOf(s, a.faction) === topOf(s, f) && (a.location === node || shortestPath(a.location, node, false)?.length === 1)).reduce((n, a) => n + a.troops, 0);
  // 威慑随兵力之比渐增（至多 +25%）
  if (near > city.garrison) { const r = Math.round(near / Math.max(1, city.garrison) * 10) / 10, b = Math.min(0.25, (r - 1) * 0.05); p += b; factors.push(`我军压境（兵力 ${r} 比 1）+${Math.round(b * 100)}%`); }
  if (city.minxin < 40) { p += 0.08; factors.push('城中人心离散 +8%'); }
  const ctrl = s.factions[city.controller];
  if (ctrl && ctrl.polity === s.factions[f].polity) { p += 0.1; factors.push('同奉一朝 +10%'); }
  if (ctrl && ctrl.capital === node) { p *= 0.6; factors.push('治所重地 ×0.6'); }
  const failed = s.flags['persuade_fail_' + node + '_' + topOf(s, f)];
  if (typeof failed === 'number' && s.turn - failed < PERSUADE_COOLDOWN) { p *= 0.5; factors.push('前番劝降不成，守将戒备 ×0.5'); }
  // 兵临城下才有分量：城外无我军（不在城下、也不在邻城）且未围城，空言难动
  if (!near && !(sg && topOf(s, sg.attacker) === topOf(s, f))) { p = Math.min(0.15, p * 0.5); factors.push('城外无我军，空言难动（减半，至多 15%）'); }
  p = Math.max(0.02, Math.min(0.9, p));
  return { p, factors };
}

function resolvePersuade(s: GameState, f: string, o: Extract<Order, { kind: 'persuade' }>) {
  const city = s.cities[o.node];
  if (!city || friendly(s, f, city.controller)) return;
  const { p, factors } = persuadeChance(s, f, o.char, o.node);
  const rng = rngFor(s.seed, 'persuade', s.turn, o.id);
  const ok = rng.next() < p;
  const env = s.chars[o.char];
  const src = { kind: 'diplomacy' as const, ref: o.id, turn: s.turn };
  const old = city.controller;
  if (ok) {
    report(s, { cat: '交涉', node: o.node, ok: true, origin: s.factions[f]?.capital, text: `${env.name}入${nodeName(o.node)}劝降，守将应允。（成功率 ${Math.round(p * 100)}%：${factors.join('，')}）`, src });
    capture(s, o.node, f, '献城');
    bump(s, o.node, 'minxin', -5, '新附之城，人心未定', src);
  } else {
    s.flags['persuade_fail_' + o.node + '_' + topOf(s, f)] = s.turn;
    const detained = rng.chance(0.2);
    if (detained) { env.status = 'captured'; env.captor = old; env.capturedAt = s.turn; env.location = s.factions[old]?.capital ?? o.node; }
    if (f === s.player || old === s.player) report(s, { cat: '交涉', node: o.node, ok: false, origin: s.factions[f]?.capital, text: `${env.name}赴${nodeName(o.node)}劝降，${detained ? '被扣留' : '无功而返'}。（成功率 ${Math.round(p * 100)}%：${factors.join('，')}）`, src });
  }
}
