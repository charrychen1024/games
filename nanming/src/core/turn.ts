/* 月度结算：交涉 → 行军 → 野战 → 围城与攻城 → 内政与钱粮 → 史事与线索 → 月报。
 * 以生成器实现：遇到玩家参与的战斗或史事抉择时暂停（yield），由界面或测试给出答复后继续。
 * 输入的局势不被修改；结算在副本上进行。 */
import type { GameState, Order } from './types';
import type { BattleState } from './battle';
import { autoResolve } from './battle';
import { applyOrder, resolveMissions, orderBudget, orderCost, answerCounter } from './orders';
import { proposalsFor, applyOffer, aiDiplomacyTalks } from './diplomacy';
import { moveArmies, buildFieldBattle, buildSiegeBattle, applyBattle, updateSieges, blockadeEffects } from './military';
import { runEconomy } from './economy';
import { aiOrders, aiFixSupply, aiPayArmies, aiDefections, aiRaiseArmies, aiAttrition, aiDiplomacy } from './ai';
import { dueEvents, fireEvent, choiceFor, applyChoice, type EventDef, type PendingChoice } from './events';
import { EVENTS } from '../data/events';
import { pruneLedger, topOf, report, citiesOf, armiesOf } from './state';
import { TOTAL_TURNS, dateLabel } from './calendar';
import { VICTORY_AREAS, NODE } from '../data/geography';
import { runTalent } from './talent';
import { pendingSuccessions, successionOptions, applySuccession, autoSuccession, courtOf, transferCourt, polityOf } from './regime';

export type Interrupt =
  | { type: 'battle'; battle: BattleState; side: 'att' | 'def' }
  | { type: 'choice'; choice: PendingChoice };
export type Answer =
  | { type: 'battle'; result: BattleState; manual: boolean }
  | { type: 'choice'; index: number };

export interface MonthResult { state: GameState }

export function playerSideOf(s: GameState, b: BattleState): 'att' | 'def' | null {
  // 本方的战斗，以及下属军镇奉玩家号令出征（号令后三个月内）的战斗，都由玩家指挥
  // 授权按交战当下的隶属复核：易帜、独立、分裂之后，旧号令作废
  const led = (id: string) => {
    const t = s.flags['commanded_' + id], a = s.armies[id];
    return typeof t === 'number' && t >= 0 && s.turn - t <= 3 && !!a && s.factions[a.faction]?.overlord === s.player;
  };
  const direct = (side: BattleState['att']) => side.faction === s.player || side.armies.some(id => s.armies[id]?.faction === s.player);
  const vassal = (side: BattleState['att']) => side.armies.some(led);
  // 直属军队一方优先：倒戈部队来袭时，玩家指挥的是自己的守军
  if (direct(b.att)) return 'att';
  if (direct(b.def)) return 'def';
  if (vassal(b.att) && !vassal(b.def)) return 'att';
  if (vassal(b.def) && !vassal(b.att)) return 'def';
  return null;
}

export function* resolveMonth(input: GameState, playerOrders: Order[], events: EventDef[] = EVENTS): Generator<Interrupt, MonthResult, Answer | undefined> {
  const s: GameState = structuredClone(input);
  if (s.ended) return { state: s };

  // 停战到期
  for (const [k, r] of Object.entries(s.relations)) if (r.stance === 'truce' && r.until !== undefined && r.until <= s.turn) {
    s.relations[k] = { stance: 'war' };
    const [a, b] = k.split('|');
    if (s.factions[a] && s.factions[b] && !s.factions[a].defunct && !s.factions[b].defunct) {
      const mine = a === s.player || b === s.player;
      report(s, { cat: '交涉', urgent: mine, node: s.factions[mine ? (a === s.player ? b : a) : b]?.capital, text: `${mine ? '' : '【动向】'}${s.factions[a].name}与${s.factions[b].name}停战期满，复为交战。` });
    }
  }

  // 一、命令生效（拖延的下属号令先执行）
  const delayed = s.delayed; s.delayed = [];
  for (const o of delayed) applyOrder(s, s.player, o.kind === 'command' ? { ...o, silver: 0 } : o);
  // 宣战先于其他命令生效，本月的进攻才算数
  // 政令有数：超出本月次数的政令不行（界面已拦，这里再守一道）
  const budget = orderBudget(s, s.player).total;
  let used = 0;
  for (const o of [...playerOrders].sort((a, b) => Number(b.kind === 'war') - Number(a.kind === 'war'))) {
    if (used + orderCost(o) > budget) { report(s, { cat: '内政', text: `本月政令已满（${budget} 道），“${o.kind}”一道未能施行。` }); continue; }
    used += orderCost(o);
    applyOrder(s, s.player, o);
  }
  aiDiplomacy(s);
  aiRaiseArmies(s);
  aiAttrition(s);
  aiFixSupply(s);
  aiPayArmies(s);
  for (const f of Object.keys(s.factions).sort()) if (f !== s.player) for (const o of aiOrders(s, f)) applyOrder(s, f, o);

  // 二、交涉：使者回报（对方开条件由玩家定夺）→ 各家来使（求和、议盟、招抚）→ 各家之间的外交动向
  for (const c of resolveMissions(s)) {
    const cap = s.cities[s.factions[c.faction]?.capital];
    const short = !cap || cap.silver < c.silver;
    const ans = yield { type: 'choice', choice: { eventId: 'counter', tone: 'court', title: `${s.factions[c.target]?.name ?? ''}开出条件`, text: c.text,
      options: [{ label: `付银 ${c.silver} 两，议成`, desc: '从治所府库支付。', disabled: short ? `府库不足（现有 ${Math.round(cap?.silver ?? 0)} 两）` : undefined }, { label: '不允，作罢', desc: '和议不成，使者回来。' }] } };
    const idx = ans?.type === 'choice' ? ans.index : 1;
    answerCounter(s, c, idx === 0 && !short);
  }
  for (const o of proposalsFor(s)) {
    s.flags['dip_' + o.from] = s.turn;
    const ans = yield { type: 'choice', choice: { eventId: 'diplomacy', tone: o.kind === 'summon' ? 'edict' : 'court', title: o.title, text: o.text, options: o.options } };
    let idx = ans?.type === 'choice' ? Math.max(0, Math.min(o.options.length - 1, ans.index)) : o.options.length - 1;
    if (o.options[idx].disabled) idx = o.options.length - 1 - (o.options[o.options.length - 1].disabled ? 1 : 0);
    applyOffer(s, o, idx);
  }
  aiDiplomacyTalks(s);
  aiDefections(s);

  // 三、行军
  const contacts = moveArmies(s);

  // 四、野战
  for (const c of contacts) {
    const b = buildFieldBattle(s, c);
    if (!b) continue;
    const side = playerSideOf(s, b);
    let result: BattleState, manual = false;
    if (side) {
      const ans = yield { type: 'battle', battle: b, side };
      if (ans?.type === 'battle') { result = ans.result; manual = ans.manual; } else result = autoResolve(b);
    } else result = autoResolve(b);
    applyBattle(s, result, manual);
  }

  // 五、围城与攻城
  const assaults = updateSieges(s);
  for (const node of assaults) {
    const b = buildSiegeBattle(s, node);
    if (!b) continue;
    const side = playerSideOf(s, b);
    let result: BattleState, manual = false;
    if (side) {
      const ans = yield { type: 'battle', battle: b, side };
      if (ans?.type === 'battle') { result = ans.result; manual = ans.manual; } else result = autoResolve(b);
    } else result = autoResolve(b);
    applyBattle(s, result, manual);
  }
  for (const node of Object.keys(s.sieges)) if (!assaults.includes(node)) blockadeEffects(s, node);

  // 六、内政与钱粮
  runEconomy(s);

  // 七、史事与线索
  for (const { def, variant } of dueEvents(s, events)) {
    fireEvent(s, def, variant);
    if (variant === 'player') continue;
    const ch = choiceFor(s, def, variant);
    if (ch) {
      const ans = yield { type: 'choice', choice: ch.pending };
      const idx = ans?.type === 'choice' ? Math.max(0, Math.min(ch.choices.length - 1, ans.index)) : 0;
      applyChoice(s, def, ch.choices[idx]);
    } else if (def.choices && !def.chooser?.includes(s.player)) {
      // 电脑一方按第一项处置
      const list = def.choices(s, variant);
      if (list[0] && def.chooser?.length) list[0].apply(s);
    }
  }

  // 人才出仕
  runTalent(s);

  // 继统：君主被俘或身故的势力议定监国、另立、迎回或权臣主事
  for (const f of pendingSuccessions(s)) {
    const opts = successionOptions(s, f);
    if (!opts.length) {
      delete s.flags['need_succession_' + f];
      // 无人可推、无处可投：各城自守，本方星散
      if (s.chars[s.factions[f].leader]?.status !== 'active') {
        for (const c of Object.values(s.cities)) if (c.controller === f) c.controller = 'local';
        for (const a of Object.values(s.armies)) if (a.faction === f) delete s.armies[a.id];
        report(s, { cat: '急报', urgent: true, text: `${s.factions[f].name}无人主事，诸城各自守土，部众星散。` });
      }
      continue;
    }
    if (f === s.player) {
      const why = String(s.flags['need_succession_' + f]);
      const throne = f === courtOf(s) && opts.some(o => o.kind === 'enthrone' || o.kind === 'regent' || o.kind === 'ransom');
      const ans = yield { type: 'choice', choice: { eventId: 'succession', tone: 'court', title: throne ? '议立新君' : '议定主事',
        text: throne ? `${why}。国不可一日无主，群臣议定继统之事。` : `${why}。${s.factions[f].name}不可一日无主，众议由谁主事。`, options: opts.map(o => ({ label: o.label, desc: o.desc, disabled: o.disabled })) } };
      let idx = ans?.type === 'choice' ? Math.max(0, Math.min(opts.length - 1, ans.index)) : 0;
      if (opts[idx].disabled) idx = Math.max(0, opts.findIndex(o => !o.disabled));
      applySuccession(s, f, opts[idx]);
    } else autoSuccession(s, f);
  }

  // 八、结算与收尾
  for (const f of Object.values(s.factions)) {
    if (f.defunct || f.id === 'local' || f.id === 'helan') continue;
    if (!citiesOf(s, f.id).length && !armiesOf(s, f.id).length) {
      f.defunct = true;
      report(s, { cat: '急报', urgent: f.id === s.player, text: `${f.name}已无城池军队，退出天下之争。` });
      // 下属随之失主：改为自立
      for (const v of Object.values(s.factions)) if (v.overlord === f.id) { delete v.overlord; delete v.loyalty; }
    }
  }
  // 明室正统转移
  if (s.flags.ming_court && !courtOf(s)) transferCourt(s);
  checkEnd(s);
  pruneLedger(s);
  if (!s.ended) s.turn++;
  return { state: s };
}

/** 统一：计入胜利的地区全部归于同一政权（玩家及奉其号令者），且其他可选势力均已退出 */
export function unificationProgress(s: GameState, f = s.player): { held: number; total: number; rivals: string[] } {
  const nodes = Object.values(s.cities).filter(c => VICTORY_AREAS.includes(NODE[c.id].area));
  const held = nodes.filter(c => topOf(s, c.controller) === topOf(s, f)).length;
  // 盟约、停战保留各自控制权：盟友若仍奉另一政权，照样是独立对手；只有正式归附（同奉一主）或退出才不算
  const rivals = Object.values(s.factions).filter(x => x.playable && !x.defunct && topOf(s, x.id) !== topOf(s, f)).map(x => x.name);
  return { held, total: nodes.length, rivals };
}

/** 统一时谁是主导者：本方即天下之主（lead）；奉他人号令而直辖计胜之地最多（patron）；否则随同（follow） */
export function unifierRole(s: GameState, f = s.player): { role: 'lead' | 'patron' | 'follow'; mine: number; best: number; leader: string } {
  const top = topOf(s, f);
  const bloc = Object.values(s.factions).filter(x => !x.defunct && topOf(s, x.id) === top).map(x => x.id);
  const count = (id: string) => Object.values(s.cities).filter(c => c.controller === id && VICTORY_AREAS.includes(NODE[c.id].area)).length;
  const mine = count(f);
  let best = 0, leader = top;
  for (const id of bloc) if (id !== f) { const n = count(id); if (n > best) { best = n; leader = id; } }
  if (top === f) return { role: 'lead', mine, best, leader: f };
  return { role: mine > best ? 'patron' : 'follow', mine, best, leader: mine > best ? f : leader };
}

function checkEnd(s: GameState) {
  const p = s.factions[s.player];
  if (p.defunct) {
    const host = s.flags['joined_' + p.id];
    s.ended = { kind: 'fallen', text: host ? `${p.name}群龙无首，部众投靠${s.factions[String(host)]?.name ?? ''}，本局到此为止。` : `${p.name}覆亡。` };
    return;
  }
  const u = unificationProgress(s);
  if (u.held === u.total && u.rivals.length === 0) {
    const r = unifierRole(s);
    const top = s.factions[topOf(s, s.player)];
    const text = r.role === 'lead' ? `${p.name}统一天下。`
      : r.role === 'patron' ? `${p.name}奉${top.name}，扶明室而定天下：直辖 ${r.mine} 处计胜之地，诸家之冠，号令实出${p.short}。`
      : `天下归于${top.name}，${p.name}随同，直辖 ${r.mine} 处计胜之地（主导者${s.factions[r.leader]?.name ?? top.name}，${r.best} 处）。`;
    s.ended = { kind: 'unified', role: r.role, text };
    return;
  }
  if (s.turnLimit !== undefined && s.turn + 1 >= s.turnLimit) {
    s.ended = { kind: 'trial_end', text: `试玩结束：${dateLabel(polityOf(s, p.polity), s.turn)}。` };
    return;
  }
  if (s.turn + 1 >= TOTAL_TURNS) s.ended = { kind: 'undecided', text: '剧本期满，天下未定。' };
}

/** 无界面推进一个月：战斗全部自动、抉择取第一项（或按 picker） */
export function runMonthAuto(s: GameState, orders: Order[], picker?: (i: Interrupt) => Answer | undefined, events?: EventDef[]): GameState {
  const gen = resolveMonth(s, orders, events);
  let r = gen.next();
  while (!r.done) {
    const it = r.value;
    let ans = picker?.(it);
    if (!ans) ans = it.type === 'battle' ? { type: 'battle', result: autoResolve(it.battle), manual: false } : { type: 'choice', index: 0 };
    r = gen.next(ans);
  }
  return r.value.state;
}
