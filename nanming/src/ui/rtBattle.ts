/* 即时战斗 · 界面与操控（攻城、守城、野战、水战共用）：一开场就交战（可暂停、倍速、随时改令）→ 打完自动收场。
 * 规则在 core/siege.ts、core/field.ts；画面在 siegeView.ts、fieldView.ts。
 * 只有一种下令法：在战场上点我军一营选中，再点目标——点敌营即进击（火器、炮营即开火），点地面即移阵，
 * 点城墙按兵种定（步营登城、撞门，炮营轰墙，火器压制；守军守段、再点本段修城）。底栏只放看板（各营兵数士气）与全军号令。 */
import type { GameState } from '../core/types';
import type { BattleState } from '../core/battle';
import { createSiege, stepSiege, aiCommands, command, drum, defDecision, toBattleResult, runSiege, legal, segName, persuade, persuadeOdds, SEGMENTS, GATE_SEG, WALL_Y, type SUnit, type SOrder } from '../core/siege';
import { createField, stepField, aiField, commandF, drumF, legalF, toFieldResult, runField, KIND_NAME, DUSK, type FUnit, type FOrder } from '../core/field';
import { SiegeView } from './siegeView';
import { FieldView } from './fieldView';
import { lookOf } from './battle';
import { retreatCity } from '../core/military';
import { nodeName as nodeNameOf } from '../core/state';
import { portrait } from './portrait';
import { h, $, clear, wan } from './dom';
import { iconSvg } from './icons';
import { setScene, setIntensity, click, gong, battleSfx } from './audio';
import { barkLine } from './barks';
import { isReduced } from './motion';
import gsap from 'gsap';

const ic = (name: string) => { const sp = h('span', { style: { display: 'contents' } }); sp.innerHTML = iconSvg(name); return sp; };
const KIND_ICON: Record<string, string> = { inf: 'inf', cav: 'cav', gun: 'gun', art: 'bombard', fire: 'fire' };
type AnyUnit = SUnit | FUnit;
type AnyOrder = SOrder | FOrder;

const SIEGE_ORDER_TEXT = (o: SOrder): string => {
  switch (o.t) {
    case 'hold': return '待命'; case 'move': return '移阵'; case 'assault': return `登${segName(o.seg)}`; case 'ram': return '撞城门';
    case 'bombard': return `炮击${segName(o.seg)}`; case 'cover': return `压制${segName(o.seg)}`; case 'enter': return '入城'; case 'retreat': return '撤退';
    case 'man': return `守${segName(o.seg)}`; case 'reserve': return '城内预备'; case 'repair': return `修${segName(o.seg)}`; case 'sortie': return '出城突击';
  }
};
const STATE_TEXT: Record<string, string> = { idle: '列阵', move: '行进', bombard: '炮击中', shoot: '射击中', climb: '攀城中', ram: '撞门中', wall: '在城头', inside: '城中', sortie: '出击中', rout: '溃散', gone: '离场', melee: '接战' };

export async function playRealtime(s: GameState, b0: BattleState, side: 'att' | 'def', fast = false): Promise<{ result: BattleState; manual: boolean }> {
  const siege = b0.kind === 'siege', naval = b0.kind === 'naval';
  const root = $('#battle'), ui = $('#battle-ui'), stage = $('#battle-stage');
  root.classList.remove('hidden');
  root.classList.add('siege2');
  clear(stage); clear(ui);
  const foe: 'att' | 'def' = side === 'att' ? 'def' : 'att';
  setScene(siege ? 'siege' : naval ? 'naval' : 'battle'); setIntensity(0.15);

  if (fast) return finish(siege ? toBattleResult(b0, runSiege(b0)) : toFieldResult(b0, runField(b0)), false);

  const look = { att: lookOf(s, b0.att.faction), def: lookOf(s, b0.def.faction) };
  const ssim = siege ? createSiege(b0) : null;
  const fsim = siege ? null : createField(b0);
  const sim = (ssim ?? fsim)!;
  const sview = ssim ? new SiegeView(stage, ssim, { me: side, look }) : null;
  const fview = fsim ? new FieldView(stage, fsim, { me: side, look }) : null;
  const view = (sview ?? fview)!;
  view.reduced = isReduced();
  (window as unknown as { NM_siege?: unknown }).NM_siege = { sim, view };
  const units = () => sim.units as AnyUnit[];
  const step = (dt: number) => { if (ssim) stepSiege(ssim, dt); else stepField(fsim!, dt); };
  const ai = (sd: 'att' | 'def', opts: { eager?: boolean; hold?: boolean } = {}) => { if (ssim) aiCommands(ssim, sd, opts); else aiField(fsim!, sd, opts); };
  const cmd = (unit: string, o: AnyOrder) => { if (ssim) command(ssim, { unit, side, order: o as SOrder }); else commandF(fsim!, { unit, side, order: o as FOrder }); };
  const isLegal = (u: AnyUnit, o: AnyOrder) => ssim ? legal(u as SUnit, o as SOrder) : legalF(u as FUnit, o as FOrder);
  const orderText = (o: AnyOrder): string => {
    if (ssim) return SIEGE_ORDER_TEXT(o as SOrder);
    const f = o as FOrder, tn = (id?: string) => { const t = sim.units.find(u => u.id === id); return t ? t.name : ''; };
    switch (f.t) { case 'hold': return '坚守'; case 'move': return '移阵'; case 'attack': return `进击${tn(f.target)}`; case 'fire': return f.target ? `射${tn(f.target)}` : '射击'; case 'retreat': return '撤退'; }
  };
  const kindLabel = (u: AnyUnit) => siege ? '' : KIND_NAME[naval ? 'naval' : 'field'][u.kind as keyof typeof KIND_NAME.field];

  /** 测试与“直接看结果”：由部将把余下的仗快进打完 */
  (window as unknown as { NM_siegeSkip?: () => void }).NM_siegeSkip = () => {
    if (phase === 'deploy') start();
    let next = 0;
    while (!sim.over && sim.t < 3600) { if (sim.t >= next) { ai(foe); ai(side); next = sim.t + 2; } step(0.1); }
    if (!sim.over && ssim) defDecision(ssim, 'abandon');
  };
  let phase: 'deploy' | 'fight' | 'end' = 'deploy';
  let paused = true, speed = 1, autoMe = false, manual = false;
  let raf = 0, last = performance.now(), acc = 0, aiNext = 0, lastEv = 0, sfxNext = 0;
  const colorOf = (f: string) => s.factions[f]?.color ?? '#777';
  const myUnits = () => units().filter(u => u.side === side && u.troops >= 1 && (u.state !== 'gone' || phase === 'end'));
  const selUnit = () => units().find(u => u.id === view.selected && u.side === side && u.state !== 'gone');

  /* ---------- 头部：两军主将、军心条、战况 ---------- */
  const hud = h('div', { class: 'shud' });
  const toast = h('div', { class: 'stoast' });
  const banner = h('div', { class: 'sbanner hidden' });
  const tray = h('div', { class: 'selchip hidden' });
  const hint = h('div', { class: 'rt-hint' });
  stage.append(hud, toast, banner, tray, hint);
  const face = (id: string, sz: number) => { const c = s.chars[id]; const f = c ? s.factions[c.faction] : undefined; return c ? h('img', { class: 'bface', src: portrait(c, f?.color ?? '#6a5a48', f?.polity ?? 'none'), style: { width: sz + 'px', height: sz + 'px' } }) : h('div', { class: 'bface coin', style: { width: sz + 'px', height: sz + 'px', background: '#555' } }, '守'); };
  const resolveBar = (sd: 'att' | 'def') => h('div', { class: 'sres' + (sd === side ? ' mine' : '') }, h('i', { 'data-res': sd }), h('span', { 'data-resv': sd }));
  const kindName = siege ? (side === 'att' ? '攻城' : '守城') : naval ? '水战' : '野战';
  const terrainTag = siege ? '' : naval ? '' : b0.terrain === 'hills' ? '丘陵 · 守方据高地' : b0.terrain === 'river' ? '隔河 · 中有浅滩' : '平原';
  hud.append(
    h('div', { class: 'sh-side mine', style: { '--fc': colorOf(b0[side].faction) } as any }, face(b0[side].commander, 58), h('div', null, h('span', { class: 'bm-tag' }, '我军'), h('b', null, b0[side].commanderName), h('small', null, b0[side].name), h('div', { class: 'sh-troops', 'data-troops': side }), resolveBar(side))),
    h('div', { class: 'sh-mid' }, h('div', { class: 'bh-kind', id: 'battle-where' }, `${b0.nodeName} · ${kindName}`),
      h('div', { class: 'bh-who' }, `${b0.att.name}${siege ? '攻' : '击'}${b0.def.name} · `, h('em', null, b0[side].faction === s.player ? '你亲自指挥' : `${b0[side].name}奉你号令出战`)),
      h('div', { class: 'sh-info' }, h('span', { 'data-clock': '1' }), h('span', { 'data-i1': '1' }), h('span', { 'data-i2': '1' })),
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
      const tr = units().filter(u => u.side === sd).reduce((n, u) => n + Math.max(0, u.troops), 0);   // 撤出战场的也还活着
      (hud.querySelector(`[data-troops="${sd}"]`) as HTMLElement).textContent = wan(tr);
    }
    const mm = Math.floor(sim.t / 60), ss = Math.floor(sim.t % 60);
    (hud.querySelector('[data-clock]') as HTMLElement).textContent = `${paused ? '⏸ ' : speed > 1 ? '⏩ ' : ''}${mm}:${String(ss).padStart(2, '0')}`;
    const i1 = hud.querySelector('[data-i1]') as HTMLElement, i2 = hud.querySelector('[data-i2]') as HTMLElement;
    if (ssim) {
      const avg = Math.round(ssim.segs.reduce((n, g) => n + Math.max(0, g.hp), 0) / SEGMENTS);
      i1.textContent = `城防 ${avg}${ssim.segs.some(g => g.hp <= 0) ? ' · 有缺口' : ''}`;
      i2.textContent = ssim.gate.hp <= 0 ? '城门已破' : `城门 ${Math.round(ssim.gate.hp / ssim.gate.max * 100)}%`;
      const cap = hud.querySelector('.scap') as HTMLElement;
      cap.classList.toggle('hidden', ssim.capture <= 0);
      (hud.querySelector('[data-cap]') as HTMLElement).style.width = ssim.capture + '%';
    } else {
      const f = fsim!;
      const left = Math.max(0, DUSK - f.t);
      i1.textContent = left > 120 ? `☀ 距日暮 ${Math.ceil(left / 60)} 刻` : `🌇 日暮将至 ${Math.ceil(left)} 息`;
      i2.textContent = naval ? (f.wind === 0 ? '无风' : (f.wind > 0) === (side === 'att') ? '逆风（风自敌阵来）' : '顺风（风向敌阵）') : terrainTag;
    }
    setIntensity(Math.min(1, 0.2 + (1 - sim.resolve[side] / 100) * 0.6 + (ssim ? ssim.capture / 200 : 0)));
  }

  /* ---------- 选中一营：战场下方一枚小牌，写明此营现况和“点哪里做什么” ---------- */
  function clickGuide(u: AnyUnit): string {
    if (ssim) {
      if (side === 'def') return '点城墙一段：调去守它 · 点本营所守之段：边守边修 · 点城外敌营：开门出击 · 点城内：回城预备';
      if (u.kind === 'art') return '点城墙一段：炮击 · 点地面：移阵';
      if (u.kind === 'gun') return '点城墙一段：火器压制城头 · 点地面：移阵';
      if (u.kind === 'cav') return '点城门或缺口：杀入城中 · 点地面：移阵';
      return '点城门：撞门 · 点城墙：登城 · 点缺口：入城 · 点地面：移阵';
    }
    const ranged = u.kind === 'gun' || u.kind === 'art';
    return `点敌营：${ranged ? (u.kind === 'art' ? '炮击' : '射击') : u.kind === 'cav' ? '冲锋' : u.kind === 'fire' ? '纵火' : naval ? '接舷' : '进击'} · 点地面：移阵 · 再点本营：原地坚守`;
  }
  function renderTray() {
    clear(tray);
    const u = selUnit();
    if (!u || phase === 'end') {
      tray.classList.add('hidden');
      hint.textContent = phase === 'deploy' || phase === 'end' ? '' : '点我军一营选中，再点目标下令 · 右键或 Esc 取消 · 空格暂停';
      hint.classList.toggle('hidden', !hint.textContent);
      return;
    }
    hint.classList.add('hidden');
    tray.classList.remove('hidden');
    const kn = kindLabel(u);
    tray.append(h('div', { class: 'ot-head' }, ic(KIND_ICON[u.kind] ?? 'inf'), h('b', null, u.name), kn ? h('i', null, kn) : null,
      h('span', { class: 'ot-chip' }, ic('troops'), wan(u.troops)), h('span', { class: 'ot-chip' }, ic('morale'), String(Math.round(u.morale))), h('span', { class: 'ot-chip' }, ic('supply'), String(Math.round(u.stamina))),
      h('em', null, `${orderText(u.order)} · ${STATE_TEXT[u.state] ?? ''}`)),
      h('div', { class: 'ot-tip' }, ic('pointing'), clickGuide(u)));
  }

  /* ---------- 底栏：各营卡片 + 全军号令 ---------- */
  function renderUi() {
    clear(ui);
    ui.className = 'rt-ui';
    if (phase === 'deploy' && siege && side === 'def') {
      // 守城大计：坚守、开城投降、弃城突围
      const ratio = Math.round(ssim!.att.start / Math.max(1, ssim!.def.start) * 10) / 10;
      const fallback = retreatCity(s, b0.node);
      const C = (id: string, icon: string, title: string, desc: string, fn: () => void, primary = false) => h('button', { class: 'dchoice' + (primary ? ' primary' : ''), id, onclick: () => { click(); fn(); } }, ic(icon), h('b', null, title), h('small', null, desc));
      ui.append(h('div', { class: 'dchoices' },
        h('div', { class: 'dc-head' }, h('b', null, '守城大计'), h('small', null, `敌众 ${wan(ssim!.att.start)}，我守 ${wan(ssim!.def.start)}（约 ${ratio} 比 1），城防 ${Math.round(ssim!.segs[0].hp)}`)),
        C('def-hold', 'wall', '坚守城池', '据城而战：分守各段，可修城、出击、调预备；战中仍可改弃城或投降', () => { start(); }, true),
        C('def-abandon', 'withdraw', '弃城突围', fallback ? `城归敌手但不遭屠戮；守军约八成、府库半数退往${nodeNameOf(fallback)}` : '无城可退：城归敌手，守军就地溃散，府库尽失', () => { defDecision(ssim!, 'abandon'); manual = true; ending(); }),
        C('def-surrender', 'persuade', '开城投降', '免于兵燹；城与守军、主官一并归敌', () => { defDecision(ssim!, 'surrender'); manual = true; ending(); }),
        C('battle-auto', 'auto', '交部将坚守', '由部将按常法守城，你只看战况', () => { autoMe = true; start(); })));
      renderTray();
      return;
    }
    const cards = h('div', { class: 'ucards' });
    for (const u of myUnits()) {
      const pct = Math.max(0, u.troops / u.start);
      cards.append(h('div', { class: 'ucard' + (u.id === view.selected ? ' on' : '') + (u.state === 'rout' ? ' rout' : ''), 'data-unit': u.id },
        h('div', { class: 'uc-h' }, h('span', { class: 'uc-ic k-' + u.kind }, ic(KIND_ICON[u.kind] ?? 'inf')), h('b', null, u.name), h('em', null, wan(u.troops))),
        h('div', { class: 'uc-bars' }, h('i', { class: 'tr', style: { width: pct * 100 + '%' } }), h('i', { class: 'mo', style: { width: Math.max(0, u.morale) + '%' } })),
        h('small', { class: 'uc-st s-' + u.state }, `${orderText(u.order)} · ${STATE_TEXT[u.state] ?? ''}`)));
    }
    const all = h('div', { class: 'uall' });
    const A = (id: string, label: string, icon: string, fn: () => void, on = false, tip = '', cls = '') => h('button', { class: 'atile' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), id, 'data-tip': tip, title: tip, onclick: () => { click(); fn(); } }, ic(icon), h('b', null, label));
    if (phase === 'deploy') {
      // 只有守城大计在开战前（见上）
    } else if (phase === 'fight') {
      const S = (id: string, label: string, on: boolean, fn: () => void, tip: string) => h('button', { class: 'spd' + (on ? ' on' : ''), id, title: tip, onclick: () => { click(); fn(); } }, label);
      const cd = sim.drum[side === 'att' ? 'cdAtt' : 'cdDef'];
      const allOrder = siege
        ? (side === 'att' ? A('all-assault', '全军进攻', 'storm', () => allCmd('attack'), false, '炮营轰最弱一段，火器压制，步营登城、撞门，骑营待缺口') : A('all-hold', '全军死守', 'hold', () => allCmd('hold'), false, '各段守军就位，预备补最危一段'))
        : A('all-assault', '全军进击', 'attack', () => allCmd('attack'), false, '步营压向当面之敌，骑兵寻敌火器与侧背，火器推进射击');
      all.append(
        h('div', { class: 'speed' },
          S('siege-pause', paused ? '▶' : '⏸', paused, () => { paused = !paused; renderUi(); }, '暂停 / 继续（空格）'),
          S('siege-x1', '1×', !paused && speed === 1, () => { speed = 1; paused = false; renderUi(); }, '一倍速（1）'),
          S('siege-x2', '2×', !paused && speed === 2, () => { speed = 2; paused = false; renderUi(); }, '两倍速（2）'),
          S('siege-x4', '4×', !paused && speed === 4, () => { speed = 4; paused = false; renderUi(); }, '四倍速（4）')),
        h('div', { class: 'atiles' },
          allOrder,
          ...(!siege ? [A('all-hold', '全军固守', 'hold', () => allCmd('hold'), false, '各营原地结阵，火器原地射击')] : []),
          ...(siege && side === 'att' ? [A('siege-persuade', ssim!.flags.persuaded ? '已劝' : '劝降', 'persuade', () => {
            if (ssim!.flags.persuaded) return;
            manual = true;
            const ok = persuade(ssim!);
            if (ok) battleSfx.persuade(); else { battleSfx.rout(); bark('foe', 'ahead'); }
            renderUi();
          }, false, ssim!.flags.persuaded ? '一战只能劝一次' : `遣使入城说降守将（约 ${Math.round(persuadeOdds(ssim!) * 100)}% 能成；不成则守军益坚）。城门已破、守军动摇时更易成`, ssim!.flags.persuaded ? 'cool' : '')] : []),
          A('siege-drum', cd > 0 ? `擂鼓 ${Math.ceil(cd)}` : '擂鼓', 'battle', () => { if (ssim ? drum(ssim, side) : drumF(fsim!, side)) { battleSfx.ambush(); bark('me', 'lead'); } renderUi(); }, false, '全军士气上扬一阵；六十秒一次', cd > 0 ? 'cool' : ''),
          A('siege-auto', autoMe ? '收回指挥' : '部将代打', 'auto', () => { autoMe = !autoMe; if (autoMe) { speed = 4; paused = false; } renderUi(); }, autoMe, '由部将按常法指挥我军（四倍速推进，可随时收回）'),
          ...(siege && side === 'def' ? [
            A('def-abandon2', '弃城', 'withdraw', () => { manual = true; defDecision(ssim!, 'abandon'); }, false, retreatCity(s, b0.node) ? `弃城突围：守军退往${nodeNameOf(retreatCity(s, b0.node)!)}（交战中的营伍折损一成五），城归敌手` : '无城可退：弃城则守军就地溃散，城归敌手', 'warn'),
            A('def-surrender2', '投降', 'persuade', () => { manual = true; defDecision(ssim!, 'surrender'); }, false, '开城投降：城与守军一并归敌', 'warn')] : [
            A('battle-retreat', '鸣金', 'withdraw', () => { manual = true; if (ssim) command(ssim, { unit: 'all', side, order: { t: 'retreat' } }); else commandF(fsim!, { unit: 'all', side, order: { t: 'retreat' } }); say('鸣金收兵，各营撤回。'); renderUi(); }, false, siege ? '全军撤出，结果为“未克”，围城照旧' : '全军撤出战场，保全兵力', 'warn')])));
    }
    ui.append(h('div', { class: 'su-body' }, cards, all));
    renderTray();
  }
  function selectUnit(id: string | null) {
    click();
    view.selected = id;
    if (fview) fview.aiming = false;
    renderUi();
  }
  function issue(u: AnyUnit, o: AnyOrder) {
    if (!isLegal(u, o)) return;
    manual = true;
    cmd(u.id, o);
    say(`${u.name}：${orderText(o)}`);
    if (!siege && (o as FOrder).t === 'attack' && u.kind === 'cav') battleSfx.advance(true);
    renderUi();
  }
  function allCmd(kind: 'attack' | 'hold') {
    manual = true;
    if (siege) ai(side, { eager: true });    // 攻则立即轰、压、登、撞，守则各段就位、预备补最危一段
    else if (kind === 'attack') ai(side, { eager: true });
    else for (const u of myUnits()) if (u.state !== 'rout') cmd(u.id, { t: 'hold' } as FOrder);
    say(kind === 'attack' ? (siege ? '全军进攻！' : '全军进击！') : siege ? '全军死守！' : '全军固守！');
    if (kind === 'attack') { battleSfx.advance(false); battleSfx.shout(); }
    renderUi();
  }

  /* ---------- 点战场：唯一的下令法 ---------- */
  /** 攻城一方点了城墙某段：按兵种定做什么 */
  function segOrder(u: SUnit, seg: number): SOrder | null {
    const open = ssim!.segs[seg].hp <= 0 || (seg === GATE_SEG && ssim!.gate.hp <= 0);
    if (side === 'def') return u.state === 'wall' && u.seg === seg ? ((u.order as SOrder).t === 'repair' ? { t: 'man', seg } : { t: 'repair', seg }) : { t: 'man', seg };
    if (u.kind === 'art') return { t: 'bombard', seg };
    if (u.kind === 'gun') return { t: 'cover', seg };
    if (open) return { t: 'enter' };
    if (u.kind === 'cav') return null;
    return seg === GATE_SEG ? { t: 'ram' } : { t: 'assault', seg };
  }
  view.cv.addEventListener('pointermove', e => {
    const r = view.cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const sel = selUnit();
    if (sview) {
      const p = sview.pick(sx, sy);
      const pu = p.unit ? units().find(x => x.id === p.unit) as SUnit : undefined;
      const seg = p.seg ?? (pu && pu.side !== side || (pu && sel && pu.id !== sel.id && side === 'def') ? pu?.seg : undefined);
      sview.hoverSeg = sel && seg !== undefined ? seg : null;
      view.cv.style.cursor = sel && seg !== undefined ? 'crosshair' : pu && pu.side === side ? 'pointer' : 'default';
    }
    if (fview) { const p = fview.pick(sx, sy); const u = p.unit ? units().find(x => x.id === p.unit) : undefined; fview.hoverUnit = u && (u.side === side || sel) ? u.id : null; view.cv.style.cursor = u && u.side === foe && sel ? 'crosshair' : u ? 'pointer' : sel ? 'cell' : 'default'; }
  });
  view.cv.addEventListener('contextmenu', e => { e.preventDefault(); if (view.selected) selectUnit(null); });
  view.cv.addEventListener('pointerdown', e => {
    if (e.button === 2) return;
    if (phase === 'end') { done(); return; }
    if (phase !== 'fight') return;
    const r = view.cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const sel = selUnit();
    if (sview) {
      const p = sview.pick(sx, sy);
      const pu = p.unit ? units().find(x => x.id === p.unit) as SUnit : undefined;
      // 没选中：点我军一营就选中
      if (!sel) { if (pu && pu.side === side) selectUnit(pu.id); return; }
      if (pu && pu.id === sel.id) {
        if (side === 'def' && (sel as SUnit).state === 'wall' && (sel as SUnit).seg !== undefined) { click(); issue(sel, segOrder(sel as SUnit, (sel as SUnit).seg!)!); }
        else { click(); issue(sel, side === 'att' ? { t: 'hold', x: sel.x, y: Math.max(sel.y, 560) } : { t: 'reserve' }); }
        return;
      }
      // 点到的是另一营：守方点城头某营即调去增援那一段，其余情况改选那一营
      if (pu && pu.side === side && !(side === 'def' && pu.state === 'wall' && pu.seg !== undefined)) { selectUnit(pu.id); return; }
      const seg = p.seg ?? pu?.seg;
      if (seg !== undefined && (pu === undefined || pu.side !== side || side === 'def')) {
        const o = segOrder(sel as SUnit, seg);
        if (!o || !isLegal(sel, o)) { say(side === 'att' && sel.kind === 'cav' ? '骑营须待城门或城墙打开缺口' : '此营做不了这件事'); return; }
        click(); issue(sel, o); return;
      }
      const [x, y] = view.unproject(sx, sy);
      if (side === 'def') {
        if (pu && pu.side === foe && isLegal(sel, { t: 'sortie' })) { click(); issue(sel, { t: 'sortie' }); return; }
        if (y < WALL_Y) { click(); issue(sel, { t: 'reserve' }); return; }
        selectUnit(null); return;
      }
      if (y > 150) { click(); issue(sel, { t: 'move', x: Math.max(60, Math.min(940, x)), y: Math.min(950, y) }); }
      return;
    }
    const fv = fview!;
    const p = fv.pick(sx, sy);
    const u = p.unit ? units().find(x => x.id === p.unit) : undefined;
    if (!sel) { if (u && u.side === side) selectUnit(u.id); return; }
    if (u && u.id === sel.id) { click(); issue(sel, { t: 'hold' }); return; }
    if (u && u.side === side) { selectUnit(u.id); return; }
    if (u && u.side === foe) {
      // 点敌营：火器、炮射之，其余进击
      const ranged = sel.kind === 'gun' || sel.kind === 'art';
      click(); issue(sel, { t: ranged ? 'fire' : 'attack', target: u.id } as FOrder);
      return;
    }
    if (p.ground) {
      const [x, y] = p.ground;
      click(); issue(sel, { t: 'move', x: Math.max(30, Math.min(970, x)), y: Math.max(30, Math.min(970, y)) });
    }
  });
  const onKey = (e: KeyboardEvent) => {
    if (phase === 'end') { if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); done(); } return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const list = myUnits(); if (!list.length) return;
      const i = list.findIndex(u => u.id === view.selected);
      view.selected = list[(i + 1) % list.length].id; renderUi(); return;
    }
    if (e.key === 'Escape') { view.selected = null; renderUi(); return; }
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
    say(siege ? (side === 'att' ? '开战！' : '敌军来攻，各段守军就位！') : naval ? '起锚，迎敌！' : '擂鼓进兵！');
    battleSfx.advance(false);
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
        if (sim.t >= aiNext) { ai(foe); if (autoMe) ai(side); aiNext = sim.t + 2; }
        step(0.1);
        view.harvest(now);
      }
      for (; lastEv < sim.events.length; lastEv++) onEvent(sim.events[lastEv]);
      if (now > sfxNext) { sfxNext = now + 1100; ambientSfx(); }
      if (sim.over && phase === 'fight') ending();
    }
    view.render(now);
    if (now - uiTick > 250) { uiTick = now; updateHud(); if (phase === 'fight') { refreshCards(); refreshTiles(); } }
  }
  /** 战场的声音：有人厮杀就有兵刃声，有人放铳放炮就有铳炮声 */
  function ambientSfx() {
    const st = (x: string) => units().some(u => u.state === x && u.troops >= 1);
    if (st('melee') || st('climb') || st('inside') || st('sortie')) battleSfx.clash(3);
    if (st('ram')) battleSfx.impact();
    const guns = units().some(u => (u.state === 'shoot') && u.kind === 'gun') || (ssim && units().some(u => u.side === 'def' && u.state === 'wall' && u.engaged));
    if (guns) (ssim && !ssim.def.mix.gun ? battleSfx.arrows : battleSfx.muskets)();
    if (units().some(u => u.kind === 'art' && (u.state === 'shoot' || u.state === 'bombard'))) (naval ? battleSfx.broadside : battleSfx.cannon)();
  }
  /** 随模拟时钟刷新要花机会的按钮：擂鼓冷却、劝降几率 */
  function refreshTiles() {
    const drumEl = ui.querySelector('#siege-drum') as HTMLElement | null;
    if (drumEl) { const cd = sim.drum[side === 'att' ? 'cdAtt' : 'cdDef']; (drumEl.querySelector('b') as HTMLElement).textContent = cd > 0 ? `擂鼓 ${Math.ceil(cd)}` : '擂鼓'; drumEl.classList.toggle('cool', cd > 0); }
    const pers = ui.querySelector('#siege-persuade') as HTMLElement | null;
    if (pers && ssim && !ssim.flags.persuaded) { const tip = `遣使入城说降守将（约 ${Math.round(persuadeOdds(ssim) * 100)}% 能成；不成则守军益坚）。城门已破、守军动摇时更易成`; pers.title = tip; pers.dataset.tip = tip; }
  }
  function refreshCards() {
    for (const el of ui.querySelectorAll<HTMLElement>('.ucard')) {
      const u = units().find(x => x.id === el.dataset.unit); if (!u) continue;
      (el.querySelector('em') as HTMLElement).textContent = wan(u.troops);
      (el.querySelector('.tr') as HTMLElement).style.width = Math.max(0, u.troops / u.start) * 100 + '%';
      (el.querySelector('.mo') as HTMLElement).style.width = Math.max(0, u.morale) + '%';
      const st = el.querySelector('small') as HTMLElement;
      st.textContent = u.kind === 'fire' && u.state === 'gone' ? '火船已焚' : `${orderText(u.order)} · ${STATE_TEXT[u.state] ?? ''}`; st.className = 'uc-st s-' + u.state;
      el.classList.toggle('rout', u.state === 'rout');
      el.classList.toggle('gone', u.state === 'gone');
    }
    const u = selUnit();
    const head = tray.querySelector('.ot-head em'); if (u && head) head.textContent = `${orderText(u.order)} · ${STATE_TEXT[u.state] ?? ''}`;
    const chips = tray.querySelectorAll('.ot-chip'); if (u && chips.length === 3) { chips[0].lastChild!.textContent = wan(u.troops); chips[1].lastChild!.textContent = String(Math.round(u.morale)); chips[2].lastChild!.textContent = String(Math.round(u.stamina)); }
    if (view.selected && !u) { view.selected = null; renderUi(); }
  }
  function onEvent(e: { kind: string; side?: 'att' | 'def'; text: string; unit?: string }) {
    if (e.kind === 'start') return;
    const mine = e.side === side;
    const good = ['gate', 'breach', 'scale', 'enter'].includes(e.kind) ? side === 'att' : ['shaky', 'waver', 'rout', 'supply'].includes(e.kind) ? !mine : e.kind === 'dusk' ? true : mine;
    say(e.text, e.kind === 'dusk' ? 'info' : good ? 'good' : 'bad');
    if (e.kind === 'gate' || e.kind === 'breach') { battleSfx.breach(); view.shake = 10; bark(side === 'att' ? 'me' : 'foe', 'breach'); }
    if (e.kind === 'scale' || e.kind === 'flank') battleSfx.shout();
    if (e.kind === 'enter') battleSfx.clash(8);
    if (e.kind === 'charge') { battleSfx.advance(true); const u = units().find(x => x.id === e.unit); if (u && fview) fview.burst(u as FUnit, 'dust'); }
    if (e.kind === 'fire') { battleSfx.fire(); const u = units().find(x => x.id === e.unit) as FUnit | undefined; const t = u?.target ? units().find(x => x.id === u.target) as FUnit : undefined; if (fview && (t || u)) fview.burst((t ?? u)!, 'fire'); }
    if (e.kind === 'rout') battleSfx.rout();
    if (e.kind === 'shaky' || e.kind === 'waver') { showBanner(e.text, mine ? 'bad' : 'good'); bark(mine ? 'me' : 'foe', mine ? 'behind' : 'ahead'); }
  }
  function showBanner(text: string, kind: 'good' | 'bad') {
    banner.textContent = text; banner.className = 'sbanner ' + kind;
    gsap.fromTo(banner, { opacity: 0, scale: 1.2 }, { opacity: 1, scale: 1, duration: 0.35 });
    gsap.to(banner, { opacity: 0, delay: 2.6, duration: 0.5, onComplete: () => banner.classList.add('hidden') });
  }
  function resultWord(): { win: boolean; big: string; text: string; tone: 'win' | 'lose' | 'even' } {
    const o = sim.over!;
    const meWin = o.winner === side;
    if (ssim) {
      const table: Record<string, [string, string, string, string]> = {
        breach: ['破城', `${b0.att.name}夺下${b0.nodeName}。`, '城破', `${b0.nodeName}失守。`],
        surrender: ['城降', `${b0.nodeName}守军开城出降。`, '城降', `${b0.nodeName}守军崩溃，开城出降。`],
        collapse: ['城降', `${b0.nodeName}守军崩溃。`, '城降', `${b0.nodeName}守军崩溃。`],
        retreat: ['未克', `收兵回营，城未克；围城照旧，城防降至 ${Math.round(ssim.segs.reduce((n, g) => n + Math.max(0, g.hp), 0) / SEGMENTS)}${ssim.gate.hp <= 0 ? '，城门已破' : ''}。`, '守住', `${b0.att.name}收兵退去，${b0.nodeName}守住了。`],
        repulsed: ['受挫', `攻城受挫，${b0.att.name}溃退。`, '击退', `击退${b0.att.name}。`],
        abandon: ['入城', `${b0.def.name}弃城而走，${b0.nodeName}到手。`, '弃城', `弃${b0.nodeName}而走，残部退往邻城。`],
      };
      const row = table[o.outcome];
      const r = side === 'att' ? { big: row[0], text: row[1] } : { big: row[2], text: row[3] };
      return { win: meWin, ...r, tone: meWin ? 'win' : o.outcome === 'retreat' ? 'even' : 'lose' };
    }
    const f = fsim!.over!;
    const enemy = b0[foe].name;
    if (f.outcome === 'held') {
      if (f.verdict === '相持') return { win: false, big: '相持', text: `日暮收兵，两军相持。`, tone: 'even' };
      return meWin ? { win: true, big: '小胜', text: `日暮收兵，${enemy}折损更多。`, tone: 'win' } : { win: false, big: '小挫', text: `日暮收兵，我军折损较多。`, tone: 'even' };
    }
    if (f.outcome === 'retreat') return meWin ? { win: true, big: '敌退', text: `${enemy}鸣金退走，战场归我。`, tone: 'win' } : { win: false, big: '收兵', text: `我军收兵退走，保全了兵力。`, tone: 'even' };
    return meWin ? { win: true, big: '大胜', text: `${enemy}全军溃败。`, tone: 'win' } : { win: false, big: '溃败', text: `我军溃败。`, tone: 'lose' };
  }
  function ending() {
    phase = 'end';
    gsap.killTweensOf(banner); banner.classList.add('hidden');
    paused = false;
    view.selected = null;
    const r = resultWord();
    gong(r.win);
    bark('me', r.win ? 'win' : 'lose');
    const card = h('div', { class: 'sresult ' + r.tone }, h('b', null, r.big), h('p', null, r.text),
      h('small', null, `历时 ${Math.floor(sim.t / 60)} 分 ${Math.round(sim.t % 60)} 秒 · 我军伤亡 ${wan(lost(side))} · 敌军伤亡 ${wan(lost(foe))}`),
      h('i', { class: 'sr-timer' }), h('em', { class: 'sr-auto' }, '片刻后自回地图 · 点一下即走'));
    stage.append(card);
    gsap.fromTo(card, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' });
    renderUi();
    // 不必点确认：战果亮出数秒后自行收场回地图（点一下或按回车可提早）
    card.addEventListener('click', () => done());
    gsap.to(card.querySelector('.sr-timer'), { scaleX: 0, duration: AUTO_EXIT / 1000, ease: 'none' });
    exitTimer = window.setTimeout(() => done(), AUTO_EXIT);
  }
  const AUTO_EXIT = 3600;
  let exitTimer = 0, closed = false;
  const lost = (sd: 'att' | 'def') => Math.round(sim[sd].start - units().filter(u => u.side === sd).reduce((n, u) => n + Math.max(0, u.troops), 0));

  let resolveFn!: (v: { result: BattleState; manual: boolean }) => void;
  const finished = new Promise<{ result: BattleState; manual: boolean }>(r => (resolveFn = r));
  function done() {
    if (closed) return;
    closed = true;
    clearTimeout(exitTimer);
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    resolveFn(finish(ssim ? toBattleResult(b0, ssim) : toFieldResult(b0, fsim!), manual));
  }
  renderUi(); updateHud();
  raf = requestAnimationFrame(frame);
  // 不另布阵：各营按常法列阵，一开场就交战（守城先定大计）
  if (!(siege && side === 'def')) start();
  return finished;

  function finish(result: BattleState, man: boolean) {
    setScene('map');
    root.classList.add('hidden'); root.classList.remove('siege2');
    clear(ui); clear(stage);
    return { result, manual: man };
  }
}
