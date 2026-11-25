/* 战斗入口：攻城、守城、野战、水战都是可暂停的即时战斗（界面见 rtBattle.ts，规则见 core/siege.ts、core/field.ts）。 */
import type { GameState } from '../core/types';
import type { BattleState } from '../core/battle';
import { POLITIES } from '../data/factions';
import type { SideLook } from './rtView';

export function lookOf(s: GameState, faction: string): SideLook {
  const f = s.factions[faction];
  const pol = POLITIES[f?.polity ?? 'none'];
  const helmet: SideLook['helmet'] = pol.id === 'ming' ? 'ming' : pol.id === 'qing' ? 'qing' : pol.id === 'shun' ? 'shun' : pol.id === 'xi' ? 'xi' : 'plain';
  return { color: f?.color ?? '#777', helmet, flag: pol.flag, mark: pol.mark || f?.short || '' };
}

export async function playBattle(s: GameState, b0: BattleState, side: 'att' | 'def', fast = false): Promise<{ result: BattleState; manual: boolean }> {
  const { playRealtime } = await import('./rtBattle');
  return playRealtime(s, b0, side, fast);
}
