/* 月度结算：交涉 → 行军 → 野战 → 围城与攻城 → 内政与钱粮 → 史事与线索 → 月报。
 * 以生成器实现：遇到玩家参与的战斗或史事抉择时暂停（yield），由界面或测试给出答复后继续。
 * 输入的局势不被修改；结算在副本上进行。 */
import type { GameState, Order } from './types';
import type { BattleState } from './battle';
import { autoResolve } from './battle';
import { applyOrder, resolveMissions } from './orders';
import { moveArmies, buildFieldBattle, buildSiegeBattle, applyBattle, updateSieges, blockadeEffects } from './military';
import { runEconomy } from './economy';
import { aiOrders, aiFixSupply, aiDefections, aiRaiseArmies } from './ai';
import { dueEvents, fireEvent, choiceFor, applyChoice, type EventDef, type PendingChoice } from './events';
import { EVENTS } from '../data/events';
import { pruneLedger, topOf, report, friendly, citiesOf, armiesOf } from './state';
import { TOTAL_TURNS, dateLabel } from './calendar';
import { VICTORY_AREAS, NODE } from '../data/geography';
import { POLITIES } from '../data/factions';

export type Interrupt =
  | { type: 'battle'; battle: BattleState; side: 'att' | 'def' }
  | { type: 'choice'; choice: PendingChoice };
export type Answer =
  | { type: 'battle'; result: BattleState; manual: boolean }
  | { type: 'choice'; index: number };

export interface MonthResult { state: GameState }

export function playerSideOf(s: GameState, b: BattleState): 'att' | 'def' | null {
  const mine = (side: BattleState['att']) => side.faction === s.player || side.armies.some(id => s.armies[id]?.faction === s.player);
  if (mine(b.att)) return 'att';
  if (mine(b.def)) return 'def';
  return null;
}

export function* resolveMonth(input: GameState, playerOrders: Order[], events: EventDef[] = EVENTS): Generator<Interrupt, MonthResult, Answer | undefined> {
  const s: GameState = structuredClone(input);
  if (s.ended) return { state: s };

  // 停战到期
  for (const [k, r] of Object.entries(s.relations)) if (r.stance === 'truce' && r.until !== undefined && r.until <= s.turn) { s.relations[k] = { stance: 'war' }; }

  // 一、命令生效（拖延的下属号令先执行）
  const delayed = s.delayed; s.delayed = [];
  for (const o of delayed) applyOrder(s, s.player, o.kind === 'command' ? { ...o, silver: 0 } : o);
  for (const o of playerOrders) applyOrder(s, s.player, o);
  aiRaiseArmies(s);
  aiFixSupply(s);
  for (const f of Object.keys(s.factions).sort()) if (f !== s.player) for (const o of aiOrders(s, f)) applyOrder(s, f, o);

  // 二、交涉
  resolveMissions(s);
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

  // 八、结算与收尾
  for (const f of Object.values(s.factions)) {
    if (f.defunct || f.id === 'local') continue;
    if (!citiesOf(s, f.id).length && !armiesOf(s, f.id).length) {
      f.defunct = true;
      report(s, { cat: '急报', urgent: f.id === s.player, text: `${f.name}已无城池军队，退出天下之争。` });
    }
  }
  checkEnd(s);
  pruneLedger(s);
  if (!s.ended) s.turn++;
  return { state: s };
}

/** 统一：计入胜利的地区全部归于同一政权（玩家及奉其号令者），且其他可选势力均已退出 */
export function unificationProgress(s: GameState, f = s.player): { held: number; total: number; rivals: string[] } {
  const nodes = Object.values(s.cities).filter(c => VICTORY_AREAS.includes(NODE[c.id].area));
  const held = nodes.filter(c => topOf(s, c.controller) === topOf(s, f)).length;
  const rivals = Object.values(s.factions).filter(x => x.playable && !x.defunct && topOf(s, x.id) !== topOf(s, f) && !friendly(s, x.id, f)).map(x => x.name);
  return { held, total: nodes.length, rivals };
}

function checkEnd(s: GameState) {
  const p = s.factions[s.player];
  if (p.defunct) { s.ended = { kind: 'fallen', text: `${p.name}覆亡。` }; return; }
  const u = unificationProgress(s);
  if (u.held === u.total && u.rivals.length === 0) { s.ended = { kind: 'unified', text: `${p.name}统一天下。` }; return; }
  if (s.turnLimit !== undefined && s.turn + 1 >= s.turnLimit) {
    s.ended = { kind: 'trial_end', text: `试玩结束：${dateLabel(POLITIES[p.polity], s.turn)}。` };
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
