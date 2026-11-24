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

    const myLeft = side === 'att';   // 攻方总在左、守方在右
    let openLane: number | null = null;  // 正在改令的一路
    const history: { round: number; lines: string[] }[] = [];
    let showLog = false;
    const morale = (x: typeof cur.att) => Math.round(x.lanes.reduce((n, l) => n + (laneActive(l) ? l.morale * l.troops : 0), 0) / Math.max(1, sideTroops(x)));

    /** 战场上的对垒头（叠在画面上）：我军大像在我方一侧，敌军在另一侧，中间是回合与拔河条 */
    function hud(): HTMLElement {
      const me = cur[side], them = cur[foe];
      const tm = sideTroops(me), tt = sideTroops(them);
      const ratio = tm / Math.max(1, tm + tt);
      const medal = (x: typeof me, mine: boolean) => {
        const m = morale(x);
        return h('div', { class: 'bm ' + (mine ? 'mine' : 'foe'), style: { '--fc': colorOf(x.faction) } as any },
          h('div', { class: 'bm-ring', style: { '--m': m + '%' } as any }, faceOf(x.commander, mine ? 66 : 54)),
          h('div', { class: 'bm-txt' },
            h('span', { class: 'bm-tag' }, mine ? '我军' : '敌军'),
            h('b', null, x.commanderName, x.wounded ? h('em', null, '负伤') : null),
            h('small', null, `${x.name} · 统${x.tong} 谋${x.mou}`),
            h('div', { class: 'bm-num' }, h('b', { 'data-n': sideTroops(x) }, wan(sideTroops(x))), h('span', null, '士气 ', h('i', null, String(m))))));
      };
      const pips = h('div', { class: 'bh-pips' });
      for (let r = 0; r < cur.maxRounds; r++) pips.append(h('i', { class: r < cur.round ? 'done' : r === cur.round && !cur.over ? 'now' : '' }));
      const L = myLeft ? medal(me, true) : medal(them, false), R = myLeft ? medal(them, false) : medal(me, true);
      const barL = myLeft ? ratio : 1 - ratio;
      return h('div', { class: 'bhud' + (myLeft ? ' me-left' : ' me-right') },
        L,
        h('div', { class: 'bh-mid' },
          h('div', { class: 'bh-kind', id: 'battle-where' }, where),
          h('div', { class: 'bh-who' }, who, ' · ', h('em', null, auth)),
          h('div', { class: 'bh-tug' }, h('i', { style: { width: (barL * 100) + '%', background: colorOf(cur[myLeft ? side : foe].faction) } }), h('span', { style: { background: colorOf(cur[myLeft ? foe : side].faction) } }), h('b', { style: { left: (barL * 100) + '%' } })),
          h('div', { class: 'bh-info' }, pips,
            h('span', null, ic(WEATHER_ICON[cur.weather]), WEATHER_NAME[cur.weather]),
            cur.kind === 'siege' ? h('span', null, ic('wall'), `城防 ${Math.round(cur.wall)}`) : h('span', null, ic('map'), TERRAIN_NAME[cur.terrain]))),
        R);
    }
    /** 战场两侧的“我军／敌军”大字标记：静音也一眼认得出哪边是自己 */
    function sideTags(): HTMLElement {
      const tag = (mine: boolean, left: boolean) => h('div', { class: 'btag ' + (left ? 'l' : 'r') + (mine ? ' mine' : ''), style: { '--fc': colorOf(cur[mine ? side : foe].faction) } as any },
        h('b', null, mine ? '我' : '敌'), h('span', null, cur[mine ? side : foe].name));
      return h('div', { class: 'btags' }, tag(myLeft, true), tag(!myLeft, false));
    }
    function paintStage() {
      stage.querySelector('.bhud')?.remove(); stage.querySelector('.btags')?.remove();
      stage.append(hud(), sideTags());
    }

    function renderDeploy() {
      clear(ui);
      ui.className = 'deploy';
      paintStage();
      const forms: Formation[] = ['arrow', 'wings', 'square', 'goose'];
      const FORM_ICON: Record<Formation, string> = { arrow: 'charge', wings: 'flank', square: 'hold', goose: 'volley' };
      const sc = scout(cur, side);
      const foeForm = aiFormation(cur, foe);
      const cards = h('div', { class: 'fcards' });
      for (const f of forms) {
        cards.append(h('button', { class: 'fcard' + (form === f ? ' on' : ''), 'data-form': f, onclick: () => { click(); form = f; renderDeploy(); view?.preview?.(deploy(cur, side, f)); } },
          h('div', { class: 'fc-art' }, h('img', { src: cardArt(FORM_ICON[f], colorOf(cur[side].faction), forms.indexOf(f)), alt: '' }), h('div', { class: 'fc-dots' }, ...formDots(f))),
          h('b', null, FORM_NAME[f]), h('small', null, FORM_HINT[f])));
      }
      ui.append(
        h('div', { class: 'dep-body' },
          h('div', { class: 'dep-l' }, h('div', { class: 'cb-title' }, ic('flank'), '布阵'), cards),
          h('div', { class: 'dep-r' },
            h('div', { class: 'scoutbox' }, ic('locate'), h('div', null, h('b', null, '探马来报'), h('small', null, `敌将似欲布${FORM_NAME[foeForm]}；${LANE_NAMES[cur.kind].map((n, i) => `${n}${ORDER_NAME[sc.orders[i]]}`).join('、')}（可信约 ${Math.round(sc.sure * 100)}%）`))),
            h('div', { class: 'bacts' },
              h('button', { class: 'drum', id: 'deploy-go', onclick: () => { click(); cur = deploy(cur, side, form); phase = 'fight'; choice = aiChoice(cur, side); choice.stratagem = undefined; manual = true; render(); view?.preview?.(cur); } }, ic('attack'), h('b', null, '列阵开战')),
              h('button', { class: 'btn', id: 'battle-auto', onclick: () => { void auto(); } }, ic('auto'), '部将代打')))));
      gsap.from('#battle-ui .fcard', { y: 40, opacity: 0, duration: 0.35, stagger: 0.06, ease: 'back.out(1.6)', clearProps: 'transform,opacity' });
    }

    function renderFight() {
      clear(ui);
      ui.className = 'fight';
      paintStage();
      const me = cur[side], them = cur[foe];
      const legal = legalOrders(cur, side);
      const sc = scout(cur, side);
      const lanes = h('div', { class: 'lanes2' });
      for (let i = 0; i < 3; i++) {
        const l = me.lanes[i], t = them.lanes[i];
        const st = !laneActive(l) ? (l.routed ? '已溃' : l.withdrawn ? '已退' : '无兵') : '';
        const intel = laneActive(t) ? sc.orders[i] : null;
        const cho = choice.lanes[i];
        const k0 = intel ? counterOf(cur, side, cho, intel) : 1;
        const share = laneActive(l) || laneActive(t) ? l.troops / Math.max(1, l.troops + (laneActive(t) ? t.troops : 0)) : 0.5;
        // 主次：本路所下的令最大；兵力对比是一根拔河条；探报是一枚小签；其余命令收在“改令”里
        const ords = h('div', { class: 'ords2' + (openLane === i ? ' open' : '') });
        for (const o of legal) {
          const k = intel ? counterOf(cur, side, o, intel) : 1;
          const tag = k >= 1.25 ? h('em', { class: 'good' }, '克') : k <= 0.8 ? h('em', { class: 'bad' }, '被克') : null;
          ords.append(h('button', { class: 'ord2' + (cho === o ? ' on' : ''), disabled: !!st || cur.over || busy, 'data-lane': i, 'data-order': o, 'data-tip': `${ORDER_NAME[o]}：${ORDER_HINT[o]}`,
            onclick: (e: Event) => { e.stopPropagation(); click(); choice.lanes[i] = o; openLane = null; renderFight(); } }, ic(ORDER_ICON[o] ?? 'attack'), h('span', null, ORDER_NAME[o]), tag));
        }
        const box = h('div', { class: 'lane2' + (st ? ' off' : '') + (choice.lead === i ? ' led' : '') + (openLane === i ? ' picking' : ''), 'data-lane-box': i },
          h('div', { class: 'l2-h' }, h('b', { class: 'l2-seal' }, LANE_NAMES[cur.kind][i]),
            intel ? h('span', { class: 'l2-intel', 'data-tip': `探马：敌此路欲${ORDER_NAME[intel]}（可信约 ${Math.round(sc.sure * 100)}%）` }, ic(ORDER_ICON[intel] ?? 'locate'), `敌欲${ORDER_NAME[intel]}`) : h('span', { class: 'l2-intel dim' }, '此路无敌'),
            !me.led && !cur.over && laneActive(l) ? h('button', { class: 'leadb' + (choice.lead === i ? ' on' : ''), id: 'lead-' + i, disabled: busy, 'aria-label': '主将亲冲此路', 'data-tip': '主将亲冲：本路杀伤大增、全军士气上扬；主将有负伤之险。每战一次。', onclick: () => { click(); choice.lead = choice.lead === i ? undefined : i; renderFight(); } }, ic('crown')) : null),
          h('div', { class: 'l2-tug' }, h('b', null, st || wan(l.troops)), h('div', { class: 'tug' }, h('i', { style: { width: (share * 100) + '%', background: colorOf(me.faction) } }), h('span', { style: { background: colorOf(them.faction) } })), h('b', { class: 'foe' }, laneActive(t) ? wan(t.troops) : (t.routed ? '已溃' : '—'))),
          h('button', { class: 'l2-order' + (k0 >= 1.25 ? ' good' : k0 <= 0.8 ? ' bad' : ''), disabled: !!st || cur.over || busy, 'data-pick': i, onclick: () => { click(); openLane = openLane === i ? null : i; renderFight(); } },
            ic(ORDER_ICON[cho] ?? 'attack'), h('div', null, h('b', null, st ? '—' : ORDER_NAME[cho]), h('small', null, st ? '' : k0 >= 1.25 ? '克制敌令' : k0 <= 0.8 ? '为敌所克' : '点此改令')), h('i', { class: 'caret' }, '▴')),
          ords);
        lanes.append(box);
      }
      // 计策（圆形令牌）与擂鼓
      const strats = h('div', { class: 'scards' });
      for (const k of legalStratagems(cur, side)) {
        strats.append(h('button', { class: 'scard2' + (choice.stratagem === k ? ' on' : ''), disabled: cur.over || busy, 'data-strat': k, 'data-tip': `${STRATAGEM_NAME[k]}：${STRATAGEM_HINT[k]}`,
          onclick: () => { click(); choice.stratagem = choice.stratagem === k ? undefined : k as Stratagem; renderFight(); } }, ic(STRAT_ICON[k]), h('b', null, STRATAGEM_NAME[k]), h('em', null, `${Math.round(stratagemOdds(cur, side, k) * 100)}%`)));
      }
      const cmd = h('div', { class: 'cmdcol' },
        h('div', { class: 'cb-title' }, ic('ambush'), `计策 · 余 ${me.stratagems}`, h('button', { class: 'logbtn', id: 'battle-log', onclick: () => { click(); showLog = !showLog; renderFight(); } }, ic('report'), '战况')),
        legalStratagems(cur, side).length ? strats : h('div', { class: 'note' }, '计策已用尽'));
      const acts = h('div', { class: 'bacts' });
      if (!cur.over) acts.append(
        h('button', { class: 'drum', id: 'battle-go', disabled: busy, onclick: () => go() }, ic('attack'), h('b', null, '擂鼓进兵'), h('small', null, `第 ${cur.round + 1} 合`)),
        h('button', { class: 'btn', id: 'battle-auto', disabled: busy, onclick: () => { void auto(); } }, ic('auto'), '部将代打'));
      else acts.append(h('button', { class: 'drum', id: 'battle-done', onclick: () => done() }, ic('ok'), h('b', null, cur.winner === side ? '凯旋' : '收兵')));
      ui.append(h('div', { class: 'fight-body' }, lanes, cmd, acts));
      if (showLog) ui.append(h('div', { class: 'blog2' }, ...(history.length ? history.slice().reverse().map(x => h('div', { class: 'bl-r' }, h('b', null, `第${x.round}合`), ...x.lines.map(s2 => h('p', null, s2)))) : [h('p', null, '尚未交锋。')])));
      if (openLane !== null) gsap.from(`#battle-ui .lane2[data-lane-box="${openLane}"] .ord2`, { y: 14, opacity: 0, duration: 0.18, stagger: 0.03, ease: 'back.out(2)', clearProps: 'transform,opacity' });
    }
    function render() { if (phase === 'deploy') renderDeploy(); else renderFight(); }

    /** 每合战果：画面上方一条横幅（第几合、谁占上风），三路各一枚战果签；整段文字收在“战况”里 */
    function ticker(lines: string[], before?: BattleState) {
      stage.querySelector('.bticker')?.remove();
      const prev = before ?? cur;
      const myLoss = sideTroops(prev[side]) - sideTroops(cur[side]), foeLoss = sideTroops(prev[foe]) - sideTroops(cur[foe]);
      const edge = foeLoss > myLoss * 1.15 ? '我军占优' : myLoss > foeLoss * 1.15 ? '敌军占优' : '相持不下';
      const chips = [0, 1, 2].map(i => {
        const a = prev[side].lanes[i].troops - cur[side].lanes[i].troops, d = prev[foe].lanes[i].troops - cur[foe].lanes[i].troops;
        if (!a && !d) return null;
        return h('div', { class: 'bt-chip' + (d > a ? ' up' : a > d ? ' down' : '') }, h('b', null, LANE_NAMES[cur.kind][i]), h('span', { class: 'me' }, `我 −${wan(a)}`), h('span', { class: 'foe' }, `敌 −${wan(d)}`));
      }).filter(Boolean) as HTMLElement[];
      const wallTxt = cur.kind === 'siege' && Math.round(prev.wall) !== Math.round(cur.wall) ? h('div', { class: 'bt-chip wall' }, ic('wall'), `城防 ${Math.round(prev.wall)} → ${Math.round(cur.wall)}`) : null;
      const box = h('div', { class: 'bticker ' + (edge === '我军占优' ? 'up' : edge === '敌军占优' ? 'down' : '') },
        h('div', { class: 'bt-head' }, h('b', null, `第${cur.round}合`), h('span', null, edge)),
        h('div', { class: 'bt-chips' }, ...chips, wallTxt));
      history.push({ round: cur.round, lines });
      stage.append(box);
      gsap.from(box, { y: -18, opacity: 0, duration: 0.35, ease: 'back.out(1.6)' });
      gsap.from(box.querySelectorAll('.bt-chip'), { scale: 0.6, opacity: 0, duration: 0.3, stagger: 0.08, delay: 0.15, ease: 'back.out(2)' });
      gsap.to(box, { opacity: 0, delay: 4.6, duration: 0.6, onComplete: () => box.remove() });
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
      const prev = cur;
      cur = next;
      ticker(next.log[next.log.length - 1].text, prev);
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
      const start = cur;
      while (!cur.over) {
        const next = resolveRound(cur, aiChoice(cur, 'att'), aiChoice(cur, 'def'));
        lines.push(...next.log[next.log.length - 1].text);
        cur = next;
      }
      await view.ready;
      view.preview(cur, true);
      ticker([...lines, outcomeText(cur)], start);
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
