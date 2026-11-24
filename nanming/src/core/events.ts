/* 史事与线索引擎。
 * 史事：窗口期内条件相符则按史触发；到窗口末仍不符而有改写条件，则改写后触发；同一史事全局只触发一次。
 * 线索：到时一律提示，并对相关人物态度产生小幅、持续的影响。 */
import type { FactionId, GameState, NodeId } from './types';
import { report, topOf } from './state';

export interface EventChoice { label: string; desc: string; apply: (s: GameState) => string | void }
/** 史事的声音基调：同为史事，丧乱、驾崩、诏令、反正、兵事、朝局、征兆各有其声 */
export type EventTone = 'lament' | 'death' | 'edict' | 'turn' | 'war' | 'court' | 'omen';
export interface EventDef {
  id: string;
  kind: 'shishi' | 'xiansuo';
  title: string;
  /** 缺省按标题判断 */
  tone?: EventTone;
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
  /** 此事是哪些势力的作为（攻城、宣战、迁都、建号、打赢一仗……）。
   * 玩家所选势力（或其宗主）在其中、又没有给玩家抉择时，史事不替玩家代行：到窗口末只作史实提示。 */
  involves?: FactionId[] | ((s: GameState) => FactionId[]);
}

export interface PendingChoice { eventId: string; tone?: EventTone; title: string; text: string; options: { label: string; desc: string; disabled?: string }[] }

/** 按标题判断史事基调。顺序有讲究：先认屠城蒙难，再认死丧，再认诏令、易帜、朝局、兵事。 */
export function toneOfTitle(title: string): EventTone {
  if (/屠|八十一日|扬州之战|蒙难|甲申之变/.test(title)) return 'lament';
  if (/卒|殒命|死于|殉|崩/.test(title)) return 'death';
  if (/令|致书/.test(title)) return 'edict';
  if (/反正|降清|联明|之变|清君侧|开城|归附/.test(title)) return 'turn';
  if (/即位|监国|建国|掌权|受封|亲政|三案|采选|复社|出关|入缅/.test(title)) return 'court';
  if (/破|之战|之役|大捷|斩|北伐|东征|入滇|南下|渡淮|失|争|督师|余部|十三家|逐|退守|扰民/.test(title)) return 'war';
  return 'omen';
}
export const toneOf = (def: Pick<EventDef, 'title' | 'tone'>): EventTone => def.tone ?? toneOfTitle(def.title);

/** 此事是否关乎玩家势力的作为、且没有给玩家抉择 */
export function playerLed(s: GameState, def: EventDef, me = topOf(s, s.player)): boolean {
  if (!def.involves || def.chooser?.includes(s.player)) return false;
  const fs = typeof def.involves === 'function' ? def.involves(s) : def.involves;
  return fs.some(f => f === s.player || (!!s.factions[f] && topOf(s, f) === me));
}

export type Variant = 'history' | 'altered' | 'player';
export function dueEvents(s: GameState, defs: EventDef[]): { def: EventDef; variant: Variant }[] {
  const fired = new Set(s.events.map(e => e.id));
  const out: { def: EventDef; variant: Variant }[] = [];
  const me = s.factions[s.player] ? topOf(s, s.player) : s.player;
  for (const def of defs) {
    if (fired.has(def.id) || s.turn < def.from || s.turn > def.to) continue;
    if (playerLed(s, def, me)) { if (s.turn === def.to) out.push({ def, variant: 'player' }); continue; }
    if (def.kind === 'xiansuo') {
      // 线索：条件相符才作为本局之事发生并生效；窗口结束仍不符，只作史实提示，不改本局
      if (!def.cond || def.cond(s)) out.push({ def, variant: 'history' });
      else if (s.turn === def.to) out.push({ def, variant: 'altered' });
      continue;
    }
    if (!def.cond || def.cond(s)) out.push({ def, variant: 'history' });
    else if (s.turn === def.to && def.altered && def.altered(s)) out.push({ def, variant: 'altered' });
  }
  // 线索先于史事
  return out.sort((a, b) => (a.def.kind === b.def.kind ? 0 : a.def.kind === 'xiansuo' ? -1 : 1));
}

/** 触发一条事件（不含选择部分） */
export function fireEvent(s: GameState, def: EventDef, variant: Variant) {
  s.events.push({ id: def.id, turn: s.turn, variant });
  if (variant === 'player') {
    const f = s.factions[s.player];
    report(s, { cat: '线索', tone: 'omen', urgent: false, node: def.node, text: `【${def.title}】史书所载之事，关乎${f?.short ?? '你'}的作为。本局由你作主，不按史实代行。`, history: `史实：${def.history}（${def.source}）`, src: { kind: 'event', ref: def.id } });
    return;
  }
  if (def.kind === 'xiansuo' && variant === 'altered') {
    report(s, { cat: '线索', tone: 'omen', urgent: false, node: def.node, text: `【${def.title}】本局未发生。`, history: `史实：${def.history}（${def.source}）`, src: { kind: 'event', ref: def.id } });
    return;
  }
  def.effect?.(s, variant);
  report(s, {
    cat: def.kind === 'shishi' ? '史事' : '线索',
    tone: toneOf(def),
    urgent: false,
    node: def.node,
    text: `【${def.title}】${def.text(s, variant)}`,
    history: `${variant === 'altered' ? '本局与史实不同。' : ''}史实：${def.history}（${def.source}）`,
    src: { kind: 'event', ref: def.id },
  });
}

export function choiceFor(s: GameState, def: EventDef, variant: Variant): { pending: PendingChoice; choices: EventChoice[] } | null {
  if (variant === 'player' || !def.choices || !def.chooser?.includes(s.player)) return null;
  const choices = def.choices(s, variant);
  if (!choices.length) return null;
  return { pending: { eventId: def.id, tone: toneOf(def), title: def.title, text: def.text(s, variant), options: choices.map(c => ({ label: c.label, desc: c.desc })) }, choices };
}

export function applyChoice(s: GameState, def: EventDef, choice: EventChoice) {
  const extra = choice.apply(s);
  report(s, { cat: def.kind === 'shishi' ? '史事' : '线索', tone: toneOf(def), node: def.node, text: `【${def.title}·决断】${choice.label}。${extra ?? ''}`, src: { kind: 'event', ref: def.id } });
}
