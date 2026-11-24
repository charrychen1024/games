/* 战斗：操作面板（DOM）+ 战场（Phaser 3，见 battlePhaser.ts）。
 * 规则全在 core/battle.ts；这里只收集选择、驱动动画。 */
import type { GameState } from '../core/types';
import {
  resolveRound, aiChoice, legalOrders, legalStratagems, stratagemOdds, sideTroops, laneActive,
  ORDER_NAME, ORDER_HINT, STRATAGEM_NAME, STRATAGEM_HINT, LANE_NAMES, outcomeText, FORM_NAME, FORM_HINT,
  deploy, aiFormation, scout, counterOf, type BattleState, type Choice, type Stratagem, type Formation,
} from '../core/battle';
import { portrait } from './portrait';
import { cardArt } from './cards';
import gsap from 'gsap';
import { h, $, clear, wan } from './dom';
import { iconSvg } from './icons';
import { beat, gong, setScene, setIntensity, click } from './audio';
import { POLITIES } from '../data/factions';
import type { SideLook } from './battleScene';

const ic = (name: string) => { const sp = h('span', { style: { display: 'contents' } }); sp.innerHTML = iconSvg(name); return sp; };
const ORDER_ICON: Record<string, string> = { attack: 'attack', hold: 'hold', flank: 'flank', volley: 'volley', charge: 'charge', withdraw: 'withdraw', storm: 'storm', bombard: 'bombard', sap: 'sap', blockade: 'blockade', sortie: 'sortie', repair: 'repair', cannonade: 'gun', ram: 'navy', board: 'inf', fireship: 'fire', evade: 'ferry' };
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
  const faceOf = (id: string, size: number) => { const c = s.chars[id]; const f = c ? s.factions[c.faction] : undefined; return c ? h('img', { class: 'bface', src: portrait(c, f?.color ?? '#6a5a48', f?.polity ?? 'none'), alt: c.name, style: { width: size + 'px', height: size + 'px' } }) : h('div', { class: 'bface coin', style: { width: size + 'px', height: size + 'px', background: '#555' } }, '守'); };
  return new Promise(resolve => {
    const foe: 'att' | 'def' = side === 'att' ? 'def' : 'att';
    let cur = b0;
    let manual = false;
    let busy = false;
    let phase: 'deploy' | 'fight' = b0.kind === 'siege' ? 'fight' : 'deploy';
    let form: Formation = aiFormation(cur, side);
    let choice: Choice = aiChoice(cur, side);
    choice.stratagem = undefined;
    const kindName = cur.kind === 'siege' ? (side === 'att' ? '攻城' : '守城') : cur.kind === 'naval' ? '水战' : '野战';
    // 战场定位：何地、谁攻谁、你凭什么指挥这一方
    const where = `${b0.nodeName} · ${kindName}`;
    const who = `${b0.att.name}${b0.kind === 'siege' ? '攻' : '击'}${b0.def.name}`;
    const auth = b0[side].faction === s.player ? '你亲自指挥' : `${b0[side].name}奉你号令出战`;

    /** 对垒头：双方主将像、兵力、士气、天候 */
    function head(): HTMLElement {
      const me = cur[side], them = cur[foe];
      const tot = (x: typeof me) => sideTroops(x);
      const mm = Math.round(me.lanes.reduce((n, l) => n + (laneActive(l) ? l.morale * l.troops : 0), 0) / Math.max(1, tot(me)));
      const tm = Math.round(them.lanes.reduce((n, l) => n + (laneActive(l) ? l.morale * l.troops : 0), 0) / Math.max(1, tot(them)));
      const ratio = tot(me) / Math.max(1, tot(me) + tot(them));
      return h('div', { class: 'bhead2' },
        h('div', { class: 'bh-side me', style: { '--fc': colorOf(me.faction) } as any }, faceOf(me.commander, 54), h('div', null, h('b', null, me.commanderName, me.wounded ? h('em', null, '负伤') : null), h('small', null, `${me.name} · 统${me.tong} 谋${me.mou}`)), h('div', { class: 'bh-num' }, h('b', null, wan(tot(me))), h('small', null, `士气 ${mm}`))),
        h('div', { class: 'bh-mid' }, h('div', { class: 'bh-kind', id: 'battle-where' }, where), h('div', { class: 'bh-who' }, who, ' · ', h('em', null, auth)), h('div', { class: 'bh-bar' }, h('i', { style: { width: (ratio * 100) + '%', background: colorOf(me.faction) } }), h('span', { style: { background: colorOf(them.faction) } })),
          h('div', { class: 'bh-info' }, h('span', null, ic('hourglass'), `${Math.min(cur.round + 1, cur.maxRounds)}/${cur.maxRounds}`), h('span', null, ic(WEATHER_ICON[cur.weather]), WEATHER_NAME[cur.weather]), cur.kind === 'siege' ? h('span', null, ic('wall'), `城防 ${Math.round(cur.wall)}`) : h('span', null, ic('map'), TERRAIN_NAME[cur.terrain]))),
        h('div', { class: 'bh-side them', style: { '--fc': colorOf(them.faction) } as any }, h('div', { class: 'bh-num' }, h('b', null, wan(tot(them))), h('small', null, `士气 ${tm}`)), h('div', null, h('b', null, them.commanderName, them.wounded ? h('em', null, '负伤') : null), h('small', null, `${them.name} · 统${them.tong} 谋${them.mou}`)), faceOf(them.commander, 54)));
    }

    function renderDeploy() {
      clear(ui);
      ui.className = 'deploy';
      const forms: Formation[] = ['arrow', 'wings', 'square', 'goose'];
      const FORM_ICON: Record<Formation, string> = { arrow: 'charge', wings: 'flank', square: 'hold', goose: 'volley' };
      const sc = scout(cur, side);
      const foeForm = aiFormation(cur, foe);
      const cards = h('div', { class: 'fcards' });
      for (const f of forms) {
        const split = [0.25, 0.5, 0.25];
        cards.append(h('button', { class: 'fcard' + (form === f ? ' on' : ''), 'data-form': f, onclick: () => { click(); form = f; renderDeploy(); view?.preview?.(deploy(cur, side, f)); } },
          h('div', { class: 'fc-art' }, h('img', { src: cardArt(FORM_ICON[f], colorOf(cur[side].faction), forms.indexOf(f)), alt: '' }), h('div', { class: 'fc-dots' }, ...formDots(f))),
          h('b', null, FORM_NAME[f]), h('small', null, FORM_HINT[f])));
        void split;
      }
      ui.append(head(),
        h('div', { class: 'dep-body' },
          h('div', { class: 'dep-l' }, h('div', { class: 'sec-title' }, ic('flank'), '布阵 · 选一阵型'), cards),
          h('div', { class: 'dep-r' },
            h('div', { class: 'scoutbox' }, ic('locate'), h('div', null, h('b', null, '探马来报'), h('small', null, `敌将似欲布${FORM_NAME[foeForm]}；${LANE_NAMES[cur.kind].map((n, i) => `${n}${ORDER_NAME[sc.orders[i]]}`).join('、')}（可信约 ${Math.round(sc.sure * 100)}%）`))),
            h('div', { class: 'bacts' },
              h('button', { class: 'btn primary big', id: 'deploy-go', onclick: () => { click(); cur = deploy(cur, side, form); phase = 'fight'; choice = aiChoice(cur, side); choice.stratagem = undefined; manual = true; render(); view?.preview?.(cur); } }, ic('attack'), '列阵开战'),
              h('button', { class: 'btn', id: 'battle-auto', onclick: () => { void auto(); } }, ic('auto'), '部将代打')))));
      gsap.from('#battle-ui .fcard', { y: 40, opacity: 0, duration: 0.35, stagger: 0.06, ease: 'back.out(1.6)', clearProps: 'transform,opacity' });
    }

    function renderFight() {
      clear(ui);
      ui.className = 'fight';
      const me = cur[side], them = cur[foe];
      const legal = legalOrders(cur, side);
      const sc = scout(cur, side);
      const lanes = h('div', { class: 'lanes2' });
      for (let i = 0; i < 3; i++) {
        const l = me.lanes[i], t = them.lanes[i];
        const st = !laneActive(l) ? (l.routed ? '已溃' : l.withdrawn ? '已退' : '无兵') : '';
        const intel = laneActive(t) ? sc.orders[i] : null;
        const box = h('div', { class: 'lane2' + (st ? ' off' : '') + (choice.lead === i ? ' led' : '') },
          h('div', { class: 'l2-h' }, h('b', null, LANE_NAMES[cur.kind][i]), choice.lead === i ? h('span', { class: 'l2-lead' }, ic('crown'), '主将在此') : null),
          h('div', { class: 'l2-vs' },
            h('div', { class: 'l2-me' }, h('b', null, st || wan(l.troops)), meterEl(l.morale)),
            h('span', null, '对'),
            h('div', { class: 'l2-them' }, h('b', null, laneActive(t) ? wan(t.troops) : (t.routed ? '已溃' : '—')), meterEl(t.morale))),
          intel ? h('div', { class: 'l2-intel' }, ic('locate'), `探报：敌欲${ORDER_NAME[intel]}`) : h('div', { class: 'l2-intel dim' }, '此路无敌'));
        const ords = h('div', { class: 'ords2' });
        for (const o of legal) {
          const k = intel ? counterOf(cur, side, o, intel) : 1;
          const tag = k >= 1.25 ? h('em', { class: 'good' }, '克') : k <= 0.8 ? h('em', { class: 'bad' }, '被克') : null;
          ords.append(h('button', { class: 'ord2' + (choice.lanes[i] === o ? ' on' : ''), disabled: !!st || cur.over || busy, 'data-lane': i, 'data-order': o, 'data-tip': `${ORDER_NAME[o]}：${ORDER_HINT[o]}`,
            onclick: () => { click(); choice.lanes[i] = o; renderFight(); } }, ic(ORDER_ICON[o] ?? 'attack'), h('span', null, ORDER_NAME[o]), tag));
        }
        box.append(ords);
        lanes.append(box);
      }
      // 计策与主将
      const cmd = h('div', { class: 'cmdcol' });
      cmd.append(h('div', { class: 'sec-title' }, ic('ambush'), `计策 ×${me.stratagems}`));
      const strats = h('div', { class: 'scards' });
      for (const k of legalStratagems(cur, side)) {
        strats.append(h('button', { class: 'scard2' + (choice.stratagem === k ? ' on' : ''), disabled: cur.over || busy, 'data-strat': k, 'data-tip': STRATAGEM_HINT[k],
          onclick: () => { click(); choice.stratagem = choice.stratagem === k ? undefined : k as Stratagem; renderFight(); } }, ic(STRAT_ICON[k]), h('b', null, STRATAGEM_NAME[k]), h('em', null, `${Math.round(stratagemOdds(cur, side, k) * 100)}%`)));
      }
      if (!legalStratagems(cur, side).length) strats.append(h('div', { class: 'note' }, '计策已用尽'));
      cmd.append(strats);
      if (!me.led && !cur.over) {
        cmd.append(h('div', { class: 'leadrow' }, h('span', null, ic('crown'), '主将亲冲'),
          ...[0, 1, 2].map(i => h('button', { class: 'leadb' + (choice.lead === i ? ' on' : ''), id: 'lead-' + i, disabled: !laneActive(me.lanes[i]) || busy, 'data-tip': '本路杀伤大增、全军士气上扬；主将有负伤之险。每战一次。', onclick: () => { click(); choice.lead = choice.lead === i ? undefined : i; renderFight(); } }, LANE_NAMES[cur.kind][i]))));
      }
      const acts = h('div', { class: 'bacts' });
      if (!cur.over) acts.append(
        h('button', { class: 'btn primary big', id: 'battle-go', disabled: busy, onclick: () => go() }, ic('attack'), `下令 · 第 ${cur.round + 1} 回合`),
        h('button', { class: 'btn', id: 'battle-auto', disabled: busy, onclick: () => { void auto(); } }, ic('auto'), '部将代打'));
      else acts.append(h('button', { class: 'btn primary big', id: 'battle-done', onclick: () => done() }, ic('ok'), cur.winner === side ? '凯旋' : '收兵'));
      cmd.append(acts);
      ui.append(head(), h('div', { class: 'fight-body' }, lanes, cmd));
    }
    function render() { if (phase === 'deploy') renderDeploy(); else renderFight(); }

    /** 战报浮字：每回合的要点浮现在战场上方 */
    function ticker(lines: string[]) {
      const box = h('div', { class: 'bticker' }, ...lines.slice(0, 4).map(t => h('p', null, t)));
      stage.append(box);
      gsap.from(box.children, { x: -30, opacity: 0, duration: 0.35, stagger: 0.12 });
      gsap.to(box, { opacity: 0, delay: 4.2, duration: 0.6, onComplete: () => box.remove() });
    }

    async function step(c: Choice, d: boolean) {
      const attC = side === 'att' ? c : aiChoice(cur, 'att');
      const defC = side === 'def' ? c : aiChoice(cur, 'def');
      if (side === 'att') attC.lead = c.lead; else defC.lead = c.lead;
      const next = resolveRound(cur, attC, defC);
      busy = true;
      beat();
      const mine = sideTroops(next[side]), start = sideTroops(b0[side]) || 1;
      setIntensity(Math.min(1, next.round / next.maxRounds * 0.7 + (1 - mine / start) * 0.6));
      render();
      await view.playRound(cur, next, next.log[next.log.length - 1], d);
      ticker(next.log[next.log.length - 1].text);
      cur = next;
      busy = false;
      choice = { lanes: [...choice.lanes], stratagem: undefined, lead: undefined };
      render();
      if (cur.over) { gong(cur.winner === side); void view.showResult(cur.winner === side, `${b0.nodeName}之战：${outcomeText(cur)}`); }
    }
    function go() {
      if (busy || cur.over) return;
      manual = true;
      const c = { lanes: [...choice.lanes], stratagem: choice.stratagem, lead: choice.lead };
      void step(c, fast);
    }
    /** 部将代打：余下回合当即算完，直接看结果 */
    async function auto() {
      if (busy || cur.over) return;
      busy = true;
      if (phase === 'deploy') phase = 'fight';
      const lines: string[] = [];
      while (!cur.over) {
        const next = resolveRound(cur, aiChoice(cur, 'att'), aiChoice(cur, 'def'));
        lines.push(...next.log[next.log.length - 1].text.slice(0, 1));
        cur = next;
      }
      await view.ready;
      view.preview(cur);
      ticker([...lines.slice(-3), outcomeText(cur)]);
      busy = false;
      render();
      gong(cur.winner === side);
      void view.showResult(cur.winner === side, `${b0.nodeName}之战：${outcomeText(cur)}`);
      if (fast) setTimeout(() => { if (!finished) done(); }, 1600);
    }
    let finished = false;
    function done() {
      if (finished) return;
      finished = true;
      setScene('map');
      view.destroy();
      root.classList.add('hidden');
      clear(ui);
      resolve({ result: cur, manual });
    }
    setScene(b0.kind === 'siege' ? 'siege' : b0.kind === 'naval' ? 'naval' : 'battle');
    setIntensity(0.1);
    render();
    // 面板排好之后再按舞台实际大小建场景
    requestAnimationFrame(() => requestAnimationFrame(() => {
      view = new BattleView(stage, b0, { att: lookOf(s, b0.att.faction), def: lookOf(s, b0.def.faction) });
      if (fast) setTimeout(() => void auto(), 900);
    }));
  });
}

const WEATHER_NAME: Record<string, string> = { clear: '晴', rain: '雨', wind: '大风', fog: '雾' };
const WEATHER_ICON: Record<string, string> = { clear: 'date', rain: 'navy', wind: 'flank', fog: 'night' };
const TERRAIN_NAME: Record<string, string> = { plain: '平原', river: '临江', hills: '山地', city: '城下', water: '江海' };
/** 阵型示意：三路兵力的点阵 */
function formDots(f: Formation): HTMLElement[] {
  const split: Record<Formation, number[]> = { arrow: [2, 5, 2], wings: [4, 2, 4], square: [3, 3, 3], goose: [3, 4, 3] };
  return split[f].map((n, i) => h('i', { class: 'fd', style: { height: (n * 6) + 'px', marginTop: f === 'arrow' && i === 1 ? '0' : f === 'wings' && i === 1 ? '10px' : '4px' } }));
}
