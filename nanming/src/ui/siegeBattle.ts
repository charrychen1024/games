/* 攻城战 · 界面与操控：布阵 → 即时交战（可暂停、倍速、随时改令）→ 收尾。
 * 规则在 core/siege.ts；画面在 siegeView.ts。 */
import type { GameState } from '../core/types';
import type { BattleState } from '../core/battle';
import { createSiege, stepSiege, aiCommands, command, drum, defDecision, toBattleResult, runSiege, legal, segName, SEGMENTS, GATE_SEG, type SiegeSim, type SUnit, type SOrder } from '../core/siege';
import { SiegeView } from './siegeView';
import { lookOf } from './battle';
import { portrait } from './portrait';
import { h, $, clear, wan } from './dom';
import { iconSvg } from './icons';
import { setScene, setIntensity, click, gong, battleSfx } from './audio';
import { barkLine } from './barks';
import { isReduced } from './motion';
import gsap from 'gsap';

const ic = (name: string) => { const sp = h('span', { style: { display: 'contents' } }); sp.innerHTML = iconSvg(name); return sp; };
const KIND_ICON: Record<string, string> = { inf: 'inf', cav: 'cav', gun: 'gun', art: 'bombard' };
const ORDER_TEXT = (o: SOrder): string => {
  switch (o.t) {
    case 'hold': return '待命'; case 'move': return '移阵'; case 'assault': return `登${segName(o.seg)}`; case 'ram': return '撞城门';
    case 'bombard': return `炮击${segName(o.seg)}`; case 'cover': return `压制${segName(o.seg)}`; case 'enter': return '入城'; case 'retreat': return '撤退';
    case 'man': return `守${segName(o.seg)}`; case 'reserve': return '城内预备'; case 'repair': return `修${segName(o.seg)}`; case 'sortie': return '出城突击';
  }
};
const STATE_TEXT: Record<string, string> = { idle: '列阵', move: '行进', bombard: '炮击中', shoot: '射击中', climb: '攀城中', ram: '撞门中', wall: '在城头', inside: '城中', sortie: '出击中', rout: '溃散', gone: '离场' };

export async function playSiege(s: GameState, b0: BattleState, side: 'att' | 'def', fast = false): Promise<{ result: BattleState; manual: boolean }> {
  const root = $('#battle'), ui = $('#battle-ui'), stage = $('#battle-stage');
  root.classList.remove('hidden');
  root.classList.add('siege2');
  clear(stage); clear(ui);
  const foe: 'att' | 'def' = side === 'att' ? 'def' : 'att';
  setScene('siege'); setIntensity(0.15);

  // 部将代打（设置里选了“部将自动”）：快进算完，只看结果
  if (fast) {
    const sim = runSiege(b0);
    return finish(sim, false, true);
  }

  const sim = createSiege(b0);
  const look = { att: lookOf(s, b0.att.faction), def: lookOf(s, b0.def.faction) };
  const view = new SiegeView(stage, sim, { me: side, look });
  view.reduced = isReduced();
  (window as unknown as { NM_siege?: unknown }).NM_siege = { sim, view };
  /** 测试与“直接看结果”：由部将把余下的仗快进打完 */
  (window as unknown as { NM_siegeSkip?: () => void }).NM_siegeSkip = () => {
    if (phase === 'deploy') start();
    let next = 0;
    while (!sim.over && sim.t < 3600) { if (sim.t >= next) { aiCommands(sim, foe); aiCommands(sim, side); next = sim.t + 2; } stepSiege(sim, 0.2); }
    if (!sim.over) defDecision(sim, 'abandon');
  };
  let phase: 'deploy' | 'fight' | 'end' = 'deploy';
  let paused = true, speed = 1, autoMe = false, manual = false;
  let pending: SOrder['t'] | null = null;       // 等待点城墙的令（登城、炮击、压制、守、修）
  let raf = 0, last = performance.now(), acc = 0, aiNext = 0, lastEv = 0;
  const colorOf = (f: string) => s.factions[f]?.color ?? '#777';
  const myUnits = () => sim.units.filter(u => u.side === side && u.state !== 'gone' && u.troops >= 1);

  /* ---------- 头部：两军主将、军心条、夺城进度 ---------- */
  const hud = h('div', { class: 'shud' });
  const toast = h('div', { class: 'stoast' });
  const banner = h('div', { class: 'sbanner hidden' });
  stage.append(hud, toast, banner);
  const face = (id: string, sz: number) => { const c = s.chars[id]; const f = c ? s.factions[c.faction] : undefined; return c ? h('img', { class: 'bface', src: portrait(c, f?.color ?? '#6a5a48', f?.polity ?? 'none'), style: { width: sz + 'px', height: sz + 'px' } }) : h('div', { class: 'bface coin', style: { width: sz + 'px', height: sz + 'px', background: '#555' } }, '守'); };
  const resolveBar = (sd: 'att' | 'def') => h('div', { class: 'sres' + (sd === side ? ' mine' : '') }, h('i', { 'data-res': sd }), h('span', { 'data-resv': sd }));
  hud.append(
    h('div', { class: 'sh-side mine', style: { '--fc': colorOf(b0[side].faction) } as any }, face(b0[side].commander, 58), h('div', null, h('span', { class: 'bm-tag' }, '我军'), h('b', null, b0[side].commanderName), h('small', null, b0[side].name), h('div', { class: 'sh-troops', 'data-troops': side }), resolveBar(side))),
    h('div', { class: 'sh-mid' }, h('div', { class: 'bh-kind', id: 'battle-where' }, `${b0.nodeName} · ${side === 'att' ? '攻城' : '守城'}`),
      h('div', { class: 'bh-who' }, `${b0.att.name}攻${b0.def.name} · `, h('em', null, b0[side].faction === s.player ? '你亲自指挥' : `${b0[side].name}奉你号令出战`)),
      h('div', { class: 'sh-info' }, h('span', { 'data-clock': '1' }), h('span', { 'data-wall': '1' }), h('span', { 'data-gate': '1' })),
      h('div', { class: 'scap hidden' }, h('b', null, '夺城'), h('div', null, h('i', { 'data-cap': '1' })))),
    h('div', { class: 'sh-side foe', style: { '--fc': colorOf(b0[foe].faction) } as any }, h('div', null, h('span', { class: 'bm-tag' }, '敌军'), h('b', null, b0[foe].commanderName), h('small', null, b0[foe].name), h('div', { class: 'sh-troops', 'data-troops': foe }), resolveBar(foe)), face(b0[foe].commander, 46)));

  function say(text: string, kind: 'info' | 'good' | 'bad' = 'info') {
    const el = h('div', { class: 'st-line ' + kind }, text);
    toast.append(el);
    while (toast.children.length > 4) toast.firstElementChild?.remove();
    gsap.fromTo(el, { x: -20, opacity: 0 }, { x: 0, opacity: 1, duration: 0.3 });
    gsap.to(el, { opacity: 0, delay: 5, duration: 0.6, onComplete: () => el.remove() });
  }
  function bark(who: 'me' | 'foe', when: Parameters<typeof barkLine>[1]) {
    const sd = who === 'me' ? side : foe;
    const el = h('div', { class: 'bbark ' + (who === 'me' ? 'l mine' : 'r') }, h('b', null, b0[sd].commanderName), h('span', null, barkLine(s.chars[b0[sd].commander], when, Math.round(sim.t))));
    stage.querySelector('.bbark.' + (who === 'me' ? 'l' : 'r'))?.remove();
    stage.append(el);
    (window as unknown as { NM_barks?: number }).NM_barks = ((window as unknown as { NM_barks?: number }).NM_barks ?? 0) + 1;
    gsap.fromTo(el, { scale: 0.6, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'back.out(2)' });
    gsap.to(el, { opacity: 0, delay: 3, duration: 0.4, onComplete: () => el.remove() });
  }

  function updateHud() {
    for (const sd of ['att', 'def'] as const) {
      const r = Math.round(sim.resolve[sd]);
      const bar = hud.querySelector(`[data-res="${sd}"]`) as HTMLElement, val = hud.querySelector(`[data-resv="${sd}"]`) as HTMLElement;
      bar.style.width = r + '%'; bar.className = r < 15 ? 'crit' : r < 30 ? 'warn' : '';
      val.textContent = `军心 ${r}${r < 15 ? ' · 将溃' : r < 30 ? ' · 动摇' : ''}`;
      const tr = sim.units.filter(u => u.side === sd && u.state !== 'gone').reduce((n, u) => n + u.troops, 0);
      (hud.querySelector(`[data-troops="${sd}"]`) as HTMLElement).textContent = wan(tr);
    }
    const mm = Math.floor(sim.t / 60), ss = Math.floor(sim.t % 60);
    (hud.querySelector('[data-clock]') as HTMLElement).textContent = `${paused ? '⏸ ' : speed > 1 ? '⏩ ' : ''}${mm}:${String(ss).padStart(2, '0')}`;
    const avg = Math.round(sim.segs.reduce((n, g) => n + Math.max(0, g.hp), 0) / SEGMENTS);
    (hud.querySelector('[data-wall]') as HTMLElement).textContent = `城防 ${avg}${sim.segs.some(g => g.hp <= 0) ? ' · 有缺口' : ''}`;
    (hud.querySelector('[data-gate]') as HTMLElement).textContent = sim.gate.hp <= 0 ? '城门已破' : `城门 ${Math.round(sim.gate.hp / sim.gate.max * 100)}%`;
    const cap = hud.querySelector('.scap') as HTMLElement;
    cap.classList.toggle('hidden', sim.capture <= 0);
    (hud.querySelector('[data-cap]') as HTMLElement).style.width = sim.capture + '%';
    setIntensity(Math.min(1, 0.2 + (1 - sim.resolve[side] / 100) * 0.6 + sim.capture / 200));
  }

  /* ---------- 指挥台 ---------- */
  function renderUi() {
    clear(ui);
    ui.className = 'siege-ui';
    const sel = sim.units.find(u => u.id === view.selected && u.side === side);
    const cards = h('div', { class: 'ucards' });
    for (const u of myUnits()) {
      const pct = Math.max(0, u.troops / u.start);
      cards.append(h('button', { class: 'ucard' + (u.id === view.selected ? ' on' : '') + (u.state === 'rout' ? ' rout' : ''), 'data-unit': u.id, onclick: () => { click(); view.selected = view.selected === u.id ? null : u.id; pending = null; renderUi(); } },
        h('div', { class: 'uc-h' }, ic(KIND_ICON[u.kind]), h('b', null, u.name), h('em', null, wan(u.troops))),
        h('div', { class: 'uc-bars' }, h('i', { class: 'tr', style: { width: pct * 100 + '%' } }), h('i', { class: 'mo', style: { width: u.morale + '%' } })),
        h('small', null, `${ORDER_TEXT(u.order)} · ${STATE_TEXT[u.state] ?? ''}`)));
    }
    // 当前所选一营可下的令
    const orders = h('div', { class: 'uorders' });
    if (phase === 'deploy') orders.append(h('div', { class: 'hint' }, ic('locate'), sel ? '点战场上的空地，把此营挪过去（只能在本阵之内）' : '点一营，再点战场把它挪到想要的位置；布好后“开战”'));
    else if (sel) {
      const O = (label: string, icon: string, o: SOrder | SOrder['t'], tip: string) => {
        const needSeg = typeof o === 'string';
        const probe: SOrder = needSeg ? ({ t: o, seg: GATE_SEG } as SOrder) : o;
        if (!legal(sel, probe)) return null;
        return h('button', { class: 'uo' + (pending === (needSeg ? o : '') ? ' on' : ''), 'data-order': needSeg ? o : (o as SOrder).t, 'data-tip': tip, onclick: () => {
          click();
          if (needSeg) { pending = pending === o ? null : o as SOrder['t']; renderUi(); }
          else { issue(sel, o as SOrder); }
        } }, ic(icon), label);
      };
      const list = side === 'att' ? [
        O('登城', 'storm', 'assault', '点一段城墙：架云梯攀登；有缺口则由缺口入城'),
        O('撞门', 'navy', { t: 'ram' }, '推冲车撞城门（城头箭铳专打撞门者）'),
        O('炮击', 'bombard', 'bombard', '点一段城墙：轰塌它'),
        O('压制', 'volley', 'cover', '点一段城墙：火器压制城头守军，掩护登城'),
        O('入城', 'capture', { t: 'enter' }, '由城门或缺口杀入城中'),
        O('待命', 'hold', { t: 'hold', x: sel.x, y: Math.max(sel.y, 560) }, '退到箭铳射程之外待命'),
        O('撤退', 'withdraw', { t: 'retreat' }, '此营撤出战场'),
      ] : [
        O('守此段', 'hold', 'man', '点一段城墙：去守它'),
        O('修城', 'repair', 'repair', '点一段城墙：边守边修（火力减半）'),
        O('出城突击', 'sortie', { t: 'sortie' }, '开门出击城门外之敌（城门须完好）'),
        O('回城预备', 'city', { t: 'reserve' }, '回城内待命，敌入城时巷战'),
      ];
      orders.append(h('div', { class: 'uo-title' }, h('b', null, sel.name), h('small', null, `兵 ${wan(sel.troops)} · 士气 ${Math.round(sel.morale)} · 体力 ${Math.round(sel.stamina)}`)), ...list.filter(Boolean) as HTMLElement[]);
      if (pending) orders.append(h('div', { class: 'segpick' }, h('small', null, '选城墙一段：'), ...Array.from({ length: SEGMENTS }, (_, i) => h('button', { class: 'sp' + (sim.segs[i].hp <= 0 ? ' broken' : ''), 'data-seg': i, onclick: () => { click(); issue(sel, { t: pending!, seg: i } as SOrder); } }, segName(i), h('em', null, sim.segs[i].hp <= 0 ? '缺口' : String(Math.round(sim.segs[i].hp)))))));
    } else orders.append(h('div', { class: 'hint' }, ic('pointing'), '点选一营下令；或用右侧“全军”号令。空格暂停。'));
    // 全军与技能
    const all = h('div', { class: 'uall' });
    if (phase === 'deploy' && side === 'def') {
      // 守城大计：坚守、开城投降、弃城突围
      const ratio = Math.round(sim.att.start / Math.max(1, sim.def.start) * 10) / 10;
      const C = (id: string, icon: string, title: string, desc: string, fn: () => void, primary = false) => h('button', { class: 'dchoice' + (primary ? ' primary' : ''), id, onclick: () => { click(); fn(); } }, ic(icon), h('b', null, title), h('small', null, desc));
      ui.append(h('div', { class: 'dchoices' },
        h('div', { class: 'dc-head' }, h('b', null, '守城大计'), h('small', null, `敌众 ${wan(sim.att.start)}，我守 ${wan(sim.def.start)}（约 ${ratio} 比 1），城防 ${Math.round(sim.segs[0].hp)}`)),
        C('def-hold', 'wall', '坚守城池', '据城而战：分守各段，可修城、出击、调预备；战中仍可改弃城或投降', () => { renderUi(); start(); }, true),
        C('def-abandon', 'withdraw', '弃城突围', '城归敌手但不遭屠戮；守军八成、府库半数退往最近的本方之城', () => { defDecision(sim, 'abandon'); manual = true; ending(); }),
        C('def-surrender', 'persuade', '开城投降', '免于兵燹；城与守军、主官一并归敌', () => { defDecision(sim, 'surrender'); manual = true; ending(); }),
        C('battle-auto', 'auto', '交部将坚守', '由部将按常法守城，你只看战况', () => { autoMe = true; start(); })));
      return;
    }
    if (phase === 'deploy') {
      all.append(h('button', { class: 'drum', id: 'siege-go', onclick: () => start() }, ic('attack'), h('b', null, '开战')),
        h('button', { class: 'btn', id: 'battle-auto', onclick: () => { autoMe = true; start(); } }, ic('auto'), '部将代打'));
    } else if (phase === 'fight') {
      const A = (id: string, label: string, icon: string, fn: () => void, on = false, tip = '') => h('button', { class: 'ua' + (on ? ' on' : ''), id, 'data-tip': tip, onclick: () => { click(); fn(); } }, ic(icon), label);
      all.append(
        h('div', { class: 'speed' },
          A('siege-pause', paused ? '继续' : '暂停', paused ? 'play' : 'hourglass', () => { paused = !paused; renderUi(); }, paused, '空格'),
          A('siege-x1', '一倍', 'next', () => { speed = 1; paused = false; renderUi(); }, !paused && speed === 1),
          A('siege-x2', '两倍', 'next', () => { speed = 2; paused = false; renderUi(); }, !paused && speed === 2),
          A('siege-x4', '四倍', 'next', () => { speed = 4; paused = false; renderUi(); }, !paused && speed === 4)),
        side === 'att' ? A('all-assault', '全军进攻', 'storm', () => allOrder('assault'), false, '炮营轰最弱一段，火器压制，步营登城、撞门，骑营待缺口') : A('all-hold', '全军死守', 'hold', () => allOrder('hold'), false, '各段守军就位，预备补最危一段'),
        A('siege-drum', sim.drum[side === 'att' ? 'cdAtt' : 'cdDef'] > 0 ? `擂鼓 ${Math.ceil(sim.drum[side === 'att' ? 'cdAtt' : 'cdDef'])}` : '擂鼓', 'battle', () => { if (drum(sim, side)) { battleSfx.ambush(); bark('me', 'lead'); } renderUi(); }, false, '全军士气上扬一阵；六十秒一次'),
        A('siege-auto', autoMe ? '收回指挥' : '部将代打', 'auto', () => { autoMe = !autoMe; if (autoMe) { speed = 4; paused = false; } renderUi(); }, autoMe, '由部将按常法指挥我军（四倍速推进，可随时收回）'),
        ...(side === 'def' ? [
          A('def-abandon2', '弃城突围', 'withdraw', () => { manual = true; defDecision(sim, 'abandon'); }, false, '守军退走（交战中的营伍折损一成五），城归敌手'),
          A('def-surrender2', '开城投降', 'persuade', () => { manual = true; defDecision(sim, 'surrender'); }, false, '城与守军一并归敌')] : []),
        ...(side === 'att' ? [A('battle-retreat', '鸣金收兵', 'withdraw', () => { manual = true; command(sim, { unit: 'all', side, order: { t: 'retreat' } }); say('鸣金收兵，各营撤回。'); renderUi(); }, false, '全军撤出，结果为“未克”，围城照旧')] : []));
    } else {
      all.append(h('button', { class: 'drum', id: 'battle-done', onclick: () => done() }, ic('ok'), h('b', null, resultWord().win ? '凯旋' : '收兵')));
    }
    ui.append(h('div', { class: 'su-body' }, cards, orders, all));
  }
  function issue(u: SUnit, o: SOrder) {
    if (!legal(u, o)) return;
    manual = true;
    command(sim, { unit: u.id, side, order: o });
    pending = null;
    say(`${u.name}：${ORDER_TEXT(o)}`);
    renderUi();
  }
  function allOrder(kind: 'assault' | 'hold') {
    manual = true;
    aiCommands(sim, side, { eager: true });   // 全军一令：攻则立即轰、压、登、撞，守则各段就位、预备补最危一段
    say(kind === 'assault' ? '全军进攻！' : '全军死守！');
    renderUi();
  }

  /* ---------- 点战场 ---------- */
  view.cv.addEventListener('pointermove', e => { const r = view.cv.getBoundingClientRect(); const p = view.pick(e.clientX - r.left, e.clientY - r.top); view.hoverSeg = pending && p.seg !== undefined ? p.seg : null; });
  view.cv.addEventListener('pointerdown', e => {
    const r = view.cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const p = view.pick(sx, sy);
    const sel = sim.units.find(u => u.id === view.selected && u.side === side);
    if (pending && sel && p.seg !== undefined) { click(); issue(sel, { t: pending, seg: p.seg } as SOrder); return; }
    if (p.unit) { const u = sim.units.find(x => x.id === p.unit)!; if (u.side === side) { click(); view.selected = u.id; pending = null; renderUi(); return; } }
    if (phase === 'deploy' && sel && side === 'att') {
      const [x, y] = view.unproject(sx, sy);
      sel.x = Math.max(120, Math.min(880, x)); sel.y = Math.max(600, Math.min(880, y)); sel.order = { t: 'hold', x: sel.x, y: sel.y };
      click(); renderUi(); return;
    }
    if (phase === 'fight' && sel && side === 'att' && p.seg === undefined) {
      const [x, y] = view.unproject(sx, sy);
      if (y > 150) issue(sel, { t: 'move', x: Math.max(60, Math.min(940, x)), y: Math.min(950, y) });
    }
  });
  const onKey = (e: KeyboardEvent) => {
    if (phase !== 'fight') return;
    if (e.key === ' ') { e.preventDefault(); paused = !paused; renderUi(); }
    else if (e.key === '1') { speed = 1; paused = false; renderUi(); }
    else if (e.key === '2') { speed = 2; paused = false; renderUi(); }
    else if (e.key === '4') { speed = 4; paused = false; renderUi(); }
  };
  window.addEventListener('keydown', onKey);
  const onResize = () => view.resize();
  window.addEventListener('resize', onResize);

  /* ---------- 推进 ---------- */
  function start() {
    phase = 'fight'; paused = false; manual = manual || !autoMe;
    if (autoMe) speed = 4;
    view.selected = null;
    say(side === 'att' ? '开战！' : '敌军来攻，各段守军就位！');
    bark('me', side === 'att' ? 'open' : 'openDef');
    setTimeout(() => bark('foe', side === 'att' ? 'openDef' : 'open'), 1800);
    renderUi();
  }
  let uiTick = 0;
  function frame(now: number) {
    raf = requestAnimationFrame(frame);
    const dtReal = Math.min(0.1, (now - last) / 1000); last = now;
    if (phase === 'fight' && !paused) {
      acc += dtReal * speed;
      while (acc >= 0.1 && !sim.over) {
        acc -= 0.1;
        if (sim.t >= aiNext) { aiCommands(sim, foe); if (autoMe) aiCommands(sim, side); aiNext = sim.t + 2; }
        stepSiege(sim, 0.1);
        view.harvest(now);
      }
      // 事件 → 提示、声音、主帅之言
      for (; lastEv < sim.events.length; lastEv++) onEvent(sim.events[lastEv]);
      if (sim.over && phase === 'fight') ending();
    }
    view.render(now);
    if (now - uiTick > 250) { uiTick = now; updateHud(); if (phase === 'fight') refreshCards(); }
  }
  function refreshCards() {
    for (const el of ui.querySelectorAll<HTMLElement>('.ucard')) {
      const u = sim.units.find(x => x.id === el.dataset.unit); if (!u) continue;
      (el.querySelector('em') as HTMLElement).textContent = wan(u.troops);
      (el.querySelector('.tr') as HTMLElement).style.width = Math.max(0, u.troops / u.start) * 100 + '%';
      (el.querySelector('.mo') as HTMLElement).style.width = u.morale + '%';
      (el.querySelector('small') as HTMLElement).textContent = `${ORDER_TEXT(u.order)} · ${STATE_TEXT[u.state] ?? ''}`;
      el.classList.toggle('rout', u.state === 'rout');
      el.classList.toggle('gone', u.state === 'gone');
    }
  }
  function onEvent(e: SiegeSim['events'][number]) {
    if (e.kind === 'start') return;
    const mine = e.side === side;
    const good = e.kind === 'gate' || e.kind === 'breach' || e.kind === 'scale' || e.kind === 'enter' ? side === 'att' : e.kind === 'shaky' || e.kind === 'waver' || e.kind === 'rout' || e.kind === 'supply' ? !mine : mine;
    say(e.text, good ? 'good' : 'bad');
    if (e.kind === 'gate' || e.kind === 'breach') { battleSfx.breach(); view.shake = 10; bark(side === 'att' ? 'me' : 'foe', 'breach'); }
    if (e.kind === 'scale') { battleSfx.shout(); }
    if (e.kind === 'enter') battleSfx.clash(8);
    if (e.kind === 'rout') battleSfx.rout();
    if (e.kind === 'shaky' || e.kind === 'waver') { showBanner(e.text, mine ? 'bad' : 'good'); bark(mine ? 'me' : 'foe', mine ? 'behind' : 'ahead'); }
  }
  function showBanner(text: string, kind: 'good' | 'bad') {
    banner.textContent = text; banner.className = 'sbanner ' + kind;
    gsap.fromTo(banner, { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1, duration: 0.35 });
    gsap.to(banner, { opacity: 0, delay: 2.6, duration: 0.5, onComplete: () => banner.classList.add('hidden') });
  }
  function resultWord(): { win: boolean; big: string; text: string } {
    const o = sim.over!;
    const meWin = o.winner === side;
    const table: Record<string, [string, string, string, string]> = {
      // [攻方看：大字, 说明, 守方看：大字, 说明]
      breach: ['破城', `${b0.att.name}夺下${b0.nodeName}。`, '城破', `${b0.nodeName}失守。`],
      surrender: ['城降', `${b0.nodeName}守军开城出降。`, '城降', `${b0.nodeName}守军崩溃，开城出降。`],
      collapse: ['城降', `${b0.nodeName}守军崩溃。`, '城降', `${b0.nodeName}守军崩溃。`],
      retreat: ['未克', `收兵回营，城未克；围城照旧，城防降至 ${Math.round(sim.segs.reduce((n, g) => n + Math.max(0, g.hp), 0) / SEGMENTS)}。`, '守住', `${b0.att.name}收兵退去，${b0.nodeName}守住了。`],
      repulsed: ['受挫', `攻城受挫，${b0.att.name}溃退。`, '击退', `击退${b0.att.name}。`],
      abandon: ['入城', `${b0.def.name}弃城而走，${b0.nodeName}到手。`, '弃城', `弃${b0.nodeName}而走，残部退往邻城。`],
    };
    const row = table[o.outcome];
    return side === 'att' ? { win: meWin, big: row[0], text: row[1] } : { win: meWin, big: row[2], text: row[3] };
  }
  function ending() {
    phase = 'end';
    paused = false;
    const r = resultWord();
    gong(r.win);
    bark('me', r.win ? 'win' : 'lose');
    const card = h('div', { class: 'sresult ' + (r.win ? 'win' : sim.over!.outcome === 'retreat' ? 'even' : 'lose') }, h('b', null, r.big), h('p', null, r.text),
      h('small', null, `历时 ${Math.floor(sim.t / 60)} 分 ${Math.round(sim.t % 60)} 秒 · 我军伤亡 ${wan(lost(side))} · 敌军伤亡 ${wan(lost(foe))}`));
    stage.append(card);
    gsap.fromTo(card, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' });
    renderUi();
  }
  const lost = (sd: 'att' | 'def') => Math.round(sim[sd].start - sim.units.filter(u => u.side === sd).reduce((n, u) => n + u.troops, 0));

  let resolveFn!: (v: { result: BattleState; manual: boolean }) => void;
  const finished = new Promise<{ result: BattleState; manual: boolean }>(r => (resolveFn = r));
  function done() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    resolveFn(finish(sim, manual, false));
  }
  renderUi(); updateHud();
  raf = requestAnimationFrame(frame);
  return finished;

  function finish(sm: SiegeSim, man: boolean, quick: boolean) {
    const result = toBattleResult(b0, sm);
    if (quick) { /* 快进：不演 */ }
    setScene('map');
    root.classList.add('hidden'); root.classList.remove('siege2');
    clear(ui); clear(stage);
    return { result, manual: man };
  }
}
