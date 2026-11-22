/* 史事与线索引擎。
 * 史事：窗口期内条件相符则按史触发；到窗口末仍不符而有改写条件，则改写后触发；同一史事全局只触发一次。
 * 线索：到时一律提示，并对相关人物态度产生小幅、持续的影响。 */
import type { FactionId, GameState, NodeId } from './types';
import { report } from './state';

export interface EventChoice { label: string; desc: string; apply: (s: GameState) => string | void }
export interface EventDef {
  id: string;
  kind: 'shishi' | 'xiansuo';
  title: string;
  from: number;
  to: number;
  node?: NodeId;
  cond?: (s: GameState) => boolean;
  altered?: (s: GameState) => boolean;
  text: (s: GameState, v: 'history' | 'altered') => string;
  /** 史实对照 */
  history: string;
  source: string;
  effect?: (s: GameState, v: 'history' | 'altered') => void;
  /** 玩家为这些势力时给出选择 */
  chooser?: FactionId[];
  choices?: (s: GameState, v: 'history' | 'altered') => EventChoice[];
}

export interface PendingChoice { eventId: string; title: string; text: string; options: { label: string; desc: string }[] }

export function dueEvents(s: GameState, defs: EventDef[]): { def: EventDef; variant: 'history' | 'altered' }[] {
  const fired = new Set(s.events.map(e => e.id));
  const out: { def: EventDef; variant: 'history' | 'altered' }[] = [];
  for (const def of defs) {
    if (fired.has(def.id) || s.turn < def.from || s.turn > def.to) continue;
    if (def.kind === 'xiansuo') { if (s.turn === def.from || !def.cond || def.cond(s)) out.push({ def, variant: 'history' }); continue; }
    if (!def.cond || def.cond(s)) out.push({ def, variant: 'history' });
    else if (s.turn === def.to && def.altered && def.altered(s)) out.push({ def, variant: 'altered' });
  }
  // 线索先于史事
  return out.sort((a, b) => (a.def.kind === b.def.kind ? 0 : a.def.kind === 'xiansuo' ? -1 : 1));
}

/** 触发一条事件（不含选择部分） */
export function fireEvent(s: GameState, def: EventDef, variant: 'history' | 'altered') {
  s.events.push({ id: def.id, turn: s.turn, variant });
  def.effect?.(s, variant);
  report(s, {
    cat: def.kind === 'shishi' ? '史事' : '线索',
    urgent: false,
    node: def.node,
    text: `【${def.title}】${def.text(s, variant)}`,
    history: `${variant === 'altered' ? '本局与史实不同。' : ''}史实：${def.history}（${def.source}）`,
    src: { kind: 'event', ref: def.id },
  });
}

export function choiceFor(s: GameState, def: EventDef, variant: 'history' | 'altered'): { pending: PendingChoice; choices: EventChoice[] } | null {
  if (!def.choices || !def.chooser?.includes(s.player)) return null;
  const choices = def.choices(s, variant);
  if (!choices.length) return null;
  return { pending: { eventId: def.id, title: def.title, text: def.text(s, variant), options: choices.map(c => ({ label: c.label, desc: c.desc })) }, choices };
}

export function applyChoice(s: GameState, def: EventDef, choice: EventChoice) {
  const extra = choice.apply(s);
  report(s, { cat: def.kind === 'shishi' ? '史事' : '线索', node: def.node, text: `【${def.title}·决断】${choice.label}。${extra ?? ''}`, src: { kind: 'event', ref: def.id } });
}
