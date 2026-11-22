/* 战斗：操作面板（DOM）+ 战场（Phaser 3，见 battlePhaser.ts）。
 * 规则全在 core/battle.ts；这里只收集选择、驱动动画。 */
import type { GameState } from '../core/types';
import {
  resolveRound, aiChoice, legalOrders, legalStratagems, stratagemOdds, sideTroops, laneActive,
  ORDER_NAME, ORDER_HINT, STRATAGEM_NAME, STRATAGEM_HINT, LANE_NAMES, outcomeText,
  type BattleState, type Choice, type Stratagem,
} from '../core/battle';
import { h, $, clear, wan } from './dom';
import { iconSvg } from './icons';
import { beat, gong } from './audio';
import { POLITIES } from '../data/factions';
import type { SideLook } from './battleScene';

const ic = (name: string) => { const sp = h('span', { style: { display: 'contents' } }); sp.innerHTML = iconSvg(name); return sp; };
const ORDER_ICON: Record<string, string> = { attack: 'attack', hold: 'hold', flank: 'flank', volley: 'volley', charge: 'charge', withdraw: 'withdraw', storm: 'storm', bombard: 'bombard', sap: 'sap', blockade: 'blockade', sortie: 'sortie', repair: 'repair' };
const STRAT_ICON: Record<string, string> = { ambush: 'ambush', fire: 'fire', night: 'night', persuade: 'persuade' };
const meterEl = (v: number) => h('div', { class: 'meter' }, h('i', { style: { width: Math.max(0, Math.min(100, v)) + '%', background: v >= 50 ? 'var(--green)' : v >= 25 ? 'var(--amber)' : 'var(--red-2)' } }));

export function lookOf(s: GameState, faction: string): SideLook {
  const f = s.factions[faction];
  const pol = POLITIES[f?.polity ?? 'none'];
  const helmet: SideLook['helmet'] = pol.id === 'ming' ? 'ming' : pol.id === 'qing' ? 'qing' : pol.id === 'shun' ? 'shun' : pol.id === 'xi' ? 'xi' : 'plain';
  return { color: f?.color ?? '#777', helmet, flag: pol.flag, mark: pol.mark || f?.short || '' };
}

export async function playBattle(s: GameState, b0: BattleState, side: 'att' | 'def', fast = false): Promise<{ result: BattleState; manual: boolean }> {
  const root = $('#battle'), ui = $('#battle-ui'), stage = $('#battle-stage');
  root.classList.remove('hidden');
  clear(stage);
  const { BattleView } = await import('./battlePhaser');
  let view: InstanceType<typeof BattleView>;
  const colorOf = (f: string) => s.factions[f]?.color ?? '#777';
  return new Promise(resolve => {
    const foe: 'att' | 'def' = side === 'att' ? 'def' : 'att';
    let cur = b0;
    let manual = false;
    let busy = false;
    let choice: Choice = aiChoice(cur, side);
    choice.stratagem = undefined;

    function renderUI() {
      clear(ui);
      const me = cur[side], them = cur[foe];
      const left = h('div');
      const coin = (f: string, name: string) => h('div', { class: 'coin', style: { background: colorOf(f) } }, name.slice(0, 1));
      left.append(h('div', { class: 'bhead' },
        h('div', { class: 'side' }, coin(me.faction, me.commanderName), h('div', null, h('b', null, wan(sideTroops(me))), h('div', { style: { fontSize: '11.5px', color: 'var(--dim)' } }, `${me.commanderName} · 统${me.tong} 谋${me.mou}`))),
        h('span', { class: 'vsx' }, '对'),
        h('div', { class: 'side' }, coin(them.faction, them.commanderName), h('div', null, h('b', null, wan(sideTroops(them))), h('div', { style: { fontSize: '11.5px', color: 'var(--dim)' } }, them.commanderName))),
        h('div', { style: { flex: '1' } }),
        cur.kind === 'siege' ? h('div', { class: 'pill' }, ic('wall'), h('b', null, String(Math.round(cur.wall))), h('small', null, '城防')) : null,
        h('div', { class: 'pill' }, ic('hourglass'), h('b', null, `${Math.min(cur.round + 1, cur.maxRounds)}/${cur.maxRounds}`), h('small', null, '回合'))));
      const lanes = h('div', { class: 'lanes' });
      const legal = legalOrders(cur, side);
      const hint = h('span', { class: 'hintline' }, '');
      for (let i = 0; i < 3; i++) {
        const l = me.lanes[i];
        const box = h('div', { class: 'lane' }, h('h4', null, h('span', null, LANE_NAMES[cur.kind][i]), h('b', null, l.routed ? '溃' : l.withdrawn ? '退' : wan(l.troops))));
        box.append(meterEl(l.morale));
        const ords = h('div', { class: 'ords', style: { marginTop: '6px' } });
        for (const o of legal) {
          ords.append(h('button', { class: 'ord' + (choice.lanes[i] === o ? ' on' : ''), disabled: !laneActive(l) || cur.over || busy, 'data-lane': i, 'data-order': o, title: ORDER_HINT[o],
            onclick: () => { choice.lanes[i] = o; renderUI(); }, onmouseenter: () => { hint.textContent = `${ORDER_NAME[o]}：${ORDER_HINT[o]}`; } }, ic(ORDER_ICON[o]), ORDER_NAME[o]));
        }
        box.append(ords);
        lanes.append(box);
      }
      left.append(lanes);
      const strats = h('div', { class: 'strats' }, h('span', { class: 'lbl' }, ic('ambush'), `计策 ×${me.stratagems}`));
      strats.append(h('button', { class: 'strat' + (!choice.stratagem ? ' on' : ''), disabled: cur.over || busy, onclick: () => { choice.stratagem = undefined; renderUI(); } }, ic('close'), '不用'));
      for (const k of legalStratagems(cur, side)) {
        strats.append(h('button', { class: 'strat' + (choice.stratagem === k ? ' on' : ''), disabled: cur.over || busy, 'data-strat': k, title: STRATAGEM_HINT[k],
          onclick: () => { choice.stratagem = k as Stratagem; renderUI(); }, onmouseenter: () => { hint.textContent = `${STRATAGEM_NAME[k]}：${STRATAGEM_HINT[k]}`; } },
          ic(STRAT_ICON[k]), STRATAGEM_NAME[k], h('em', null, `${Math.round(stratagemOdds(cur, side, k) * 100)}%`)));
      }
      left.append(strats);
      const acts = h('div', { class: 'bacts' });
      if (!cur.over) {
        acts.append(
          h('button', { class: 'btn primary', id: 'battle-go', disabled: busy, onclick: () => go() }, ic('attack'), `下令 · 第 ${cur.round + 1} 回合`),
          h('button', { class: 'btn', id: 'battle-auto', disabled: busy, onclick: () => auto() }, ic('auto'), '部将代打'), hint);
      } else {
        acts.append(h('button', { class: 'btn primary', id: 'battle-done', onclick: () => done() }, ic('ok'), cur.winner === side ? '凯旋' : '收兵'));
      }
      left.append(acts);
      const logBox = h('div', { class: 'blog' });
      if (!cur.log.length) logBox.append(h('p', null, '三路各下一令，可加一条计策。'));
      for (const r of cur.log) {
        logBox.append(h('p', { class: 'r' }, `第 ${r.round} 回合`));
        for (const t of r.text) logBox.append(h('p', null, t));
      }
      if (cur.over) logBox.append(h('p', { class: 'r' }, outcomeText(cur)));
      ui.append(left, logBox);
      logBox.scrollTop = logBox.scrollHeight;
    }

    async function step(c: Choice, d: boolean) {
      const attC = side === 'att' ? c : aiChoice(cur, 'att');
      const defC = side === 'def' ? c : aiChoice(cur, 'def');
      const next = resolveRound(cur, attC, defC);
      busy = true;
      beat();
      renderUI();
      await view.playRound(cur, next, next.log[next.log.length - 1], d);
      cur = next;
      busy = false;
      renderUI();
      if (cur.over) { gong(cur.winner === side); void view.showResult(cur.winner === side, outcomeText(cur)); }
    }
    function go() {
      if (busy || cur.over) return;
      manual = true;
      const c = { lanes: [...choice.lanes], stratagem: choice.stratagem };
      choice.stratagem = undefined;
      void step(c, fast);
    }
    async function auto() {
      if (busy || cur.over) return;
      while (!cur.over) await step(aiChoice(cur, side), true);
    }
    function done() {
      view.destroy();
      root.classList.add('hidden');
      clear(ui);
      resolve({ result: cur, manual });
    }
    renderUI();
    // 面板排好之后再按舞台实际大小建场景
    requestAnimationFrame(() => requestAnimationFrame(() => {
      view = new BattleView(stage, b0, { att: lookOf(s, b0.att.faction), def: lookOf(s, b0.def.faction) });
    }));
  });
}
