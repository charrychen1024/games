/* 即时战斗 · 界面与操控（攻城、守城、野战、水战共用）：布阵 → 即时交战（可暂停、倍速、随时改令）→ 收尾。
 * 规则在 core/siege.ts、core/field.ts；画面在 siegeView.ts、fieldView.ts。
 * 指挥台：底栏左边是我军各营卡片，右边是全军号令与速度；选中一营时，战场下方浮出这一营的号令牌。 */
import type { GameState } from '../core/types';
import type { BattleState } from '../core/battle';
import { createSiege, stepSiege, aiCommands, command, drum, defDecision, toBattleResult, runSiege, legal, segName, persuade, persuadeOdds, SEGMENTS, GATE_SEG, type SUnit, type SOrder } from '../core/siege';
import { createField, stepField, aiField, commandF, drumF, legalF, toFieldResult, runField, KIND_NAME, DUSK, type FUnit, type FOrder } from '../core/field';
import { SiegeView } from './siegeView';
import { FieldView } from './fieldView';
import { lookOf } from './battle';
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
interface Tile { key: string; label: string; icon: string; tip: string; order?: AnyOrder; pick?: 'seg' | 'target' | 'ground'; t?: string }

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
    while (!sim.over && sim.t < 3600) { if (sim.t >= next) { ai(foe); ai(side); next = sim.t + 2; } step(0.2); }
    if (!sim.over && ssim) defDecision(ssim, 'abandon');
  };
  let phase: 'deploy' | 'fight' | 'end' = 'deploy';
  let paused = true, speed = 1, autoMe = false, manual = false;
  let pending: Tile | null = null;
  let raf = 0, last = performance.now(), acc = 0, aiNext = 0, lastEv = 0, sfxNext = 0;
  const colorOf = (f: string) => s.factions[f]?.color ?? '#777';
  const myUnits = () => units().filter(u => u.side === side && u.troops >= 1 && (u.state !== 'gone' || phase === 'end'));
  const selUnit = () => units().find(u => u.id === view.selected && u.side === side && u.state !== 'gone');

  /* ---------- 头部：两军主将、军心条、战况 ---------- */
  const hud = h('div', { class: 'shud' });
  const toast = h('div', { class: 'stoast' });
  const banner = h('div', { class: 'sbanner hidden' });
  const tray = h('div', { class: 'otray hidden' });
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

  /* ---------- 一营可下的令 ---------- */
  function tilesFor(u: AnyUnit): Tile[] {
    const out: Tile[] = [];
    const add = (t: Tile) => { const probe = t.order ?? (t.pick === 'seg' ? ({ t: t.t, seg: GATE_SEG } as SOrder) : t.pick === 'target' ? ({ t: t.t, target: units().find(x => x.side === foe)?.id ?? '' } as FOrder) : ({ t: 'move', x: 500, y: 500 } as AnyOrder)); if (isLegal(u, probe)) out.push(t); };
    if (ssim) {
      if (side === 'att') {
        add({ key: 'assault', label: '登城', icon: 'storm', tip: '点一段城墙：架云梯攀登；有缺口则由缺口入城', pick: 'seg', t: 'assault' });
        add({ key: 'ram', label: '撞门', icon: 'navy', tip: '推冲车撞城门（城头箭铳专打撞门者）', order: { t: 'ram' } });
        add({ key: 'bombard', label: '炮击', icon: 'bombard', tip: '点一段城墙：轰塌它', pick: 'seg', t: 'bombard' });
        add({ key: 'cover', label: '压制', icon: 'volley', tip: '点一段城墙：火器压制城头守军，掩护登城', pick: 'seg', t: 'cover' });
        add({ key: 'enter', label: '入城', icon: 'capture', tip: '由城门或缺口杀入城中', order: { t: 'enter' } });
        add({ key: 'hold', label: '待命', icon: 'hold', tip: '退到箭铳射程之外待命', order: { t: 'hold', x: u.x, y: Math.max(u.y, 560) } });
        add({ key: 'retreat', label: '撤退', icon: 'withdraw', tip: '此营撤出战场', order: { t: 'retreat' } });
      } else {
        add({ key: 'man', label: '守段', icon: 'hold', tip: '点一段城墙：去守它', pick: 'seg', t: 'man' });
        add({ key: 'repair', label: '修城', icon: 'repair', tip: '点一段城墙：边守边修（火力减半）', pick: 'seg', t: 'repair' });
        add({ key: 'sortie', label: '出击', icon: 'sortie', tip: '开门出击城门外之敌（城门须完好）', order: { t: 'sortie' } });
        add({ key: 'reserve', label: '预备', icon: 'city', tip: '回城内待命，敌入城时巷战', order: { t: 'reserve' } });
      }
    } else {
      const ranged = u.kind === 'gun' || u.kind === 'art';
      if (ranged) add({ key: 'fire', label: u.kind === 'art' ? '炮击' : '射击', icon: u.kind === 'art' ? 'bombard' : 'volley', tip: '点一营敌军：推进到射程之内向它开火', pick: 'target', t: 'fire' });
      add({ key: 'attack', label: u.kind === 'cav' ? '冲锋' : u.kind === 'fire' ? '纵火' : naval ? '接舷' : '进击', icon: u.kind === 'cav' ? 'charge' : u.kind === 'fire' ? 'fire' : 'attack', tip: u.kind === 'cav' ? '点一营敌军：纵马冲阵（有冲势时杀伤加倍，绕到背后更狠）' : u.kind === 'fire' ? '点一营敌船：火船撞上去点燃，顺风大成' : '点一营敌军：压上去厮杀', pick: 'target', t: 'attack' });
      add({ key: 'move', label: '移阵', icon: 'move', tip: '点战场一处：移到那里（可绕到敌营侧后）', pick: 'ground', t: 'move' });
      add({ key: 'hold', label: '坚守', icon: 'hold', tip: '原地结阵：火器原地射击，敌来则迎战', order: { t: 'hold' } });
      add({ key: 'retreat', label: '撤退', icon: 'withdraw', tip: '此营撤出战场', order: { t: 'retreat' } });
    }
    return out;
  }
  function useTile(u: AnyUnit, t: Tile) {
    click();
    if (t.pick) { pending = pending?.key === t.key ? null : t; if (fview) fview.aiming = !!pending; renderTray(); return; }
    issue(u, t.order!);
  }

  /* ---------- 号令牌（选中一营时浮在战场下方） ---------- */
  function renderTray() {
    clear(tray);
    const u = selUnit();
    hint.classList.toggle('hidden', !!u || phase === 'end');
    if (!u) {
      tray.classList.add('hidden');
      hint.textContent = phase === 'deploy' ? (siege && side === 'def' ? '' : '点选我军一营，再点战场把它挪到想要的位置') : siege ? '点选我军一营，再点城墙下令 · Tab 换营 · 空格暂停' : '点选我军一营，再点敌营进击、点地面移阵 · Tab 换营 · 空格暂停';
      hint.classList.toggle('hidden', !hint.textContent || phase === 'end');
      return;
    }
    tray.classList.remove('hidden');
    const kn = kindLabel(u);
    tray.append(h('div', { class: 'ot-head' }, ic(KIND_ICON[u.kind] ?? 'inf'), h('b', null, u.name), kn ? h('i', null, kn) : null,
      h('span', { class: 'ot-chip' }, ic('troops'), wan(u.troops)), h('span', { class: 'ot-chip' }, ic('morale'), String(Math.round(u.morale))), h('span', { class: 'ot-chip' }, ic('supply'), String(Math.round(u.stamina))),
      h('em', null, `${orderText(u.order)} · ${STATE_TEXT[u.state] ?? ''}`),
      h('button', { class: 'ot-x', onclick: () => { view.selected = null; pending = null; renderTray(); renderUi(); } }, '✕')));
    if (phase === 'deploy') { tray.append(h('div', { class: 'ot-tip' }, ic('locate'), '点战场上本阵之内的空地，把此营挪过去')); return; }
    const keys = 'QWERTYU';
    const row = h('div', { class: 'ot-tiles' });
    tilesFor(u).forEach((t, i) => row.append(h('button', { class: 'otile' + (pending?.key === t.key ? ' on' : ''), 'data-order': t.key, 'data-tip': t.tip, title: t.tip, onclick: () => useTile(u, t) }, ic(t.icon), h('b', null, t.label), h('kbd', null, keys[i]))));
    tray.append(row);
    if (pending?.pick === 'seg' && ssim) {
      tray.append(h('div', { class: 'segpick' }, h('small', null, '点城墙一段，或选：'), ...Array.from({ length: SEGMENTS }, (_, i) => h('button', { class: 'sp' + (ssim.segs[i].hp <= 0 ? ' broken' : ''), 'data-seg': i, onclick: () => { click(); issue(u, { t: pending!.t, seg: i } as SOrder); } }, segName(i), h('em', null, ssim.segs[i].hp <= 0 ? '缺口' : String(Math.round(ssim.segs[i].hp)))))));
    } else if (pending?.pick === 'target') tray.append(h('div', { class: 'ot-tip aim' }, ic('target'), `点一营敌军：${pending.label}`));
    else if (pending?.pick === 'ground') tray.append(h('div', { class: 'ot-tip' }, ic('locate'), '点战场一处：移阵到那里'));
  }

  /* ---------- 底栏：各营卡片 + 全军号令 ---------- */
  function renderUi() {
    clear(ui);
    ui.className = 'rt-ui';
    if (phase === 'deploy' && siege && side === 'def') {
      // 守城大计：坚守、开城投降、弃城突围
      const ratio = Math.round(ssim!.att.start / Math.max(1, ssim!.def.start) * 10) / 10;
      const C = (id: string, icon: string, title: string, desc: string, fn: () => void, primary = false) => h('button', { class: 'dchoice' + (primary ? ' primary' : ''), id, onclick: () => { click(); fn(); } }, ic(icon), h('b', null, title), h('small', null, desc));
      ui.append(h('div', { class: 'dchoices' },
        h('div', { class: 'dc-head' }, h('b', null, '守城大计'), h('small', null, `敌众 ${wan(ssim!.att.start)}，我守 ${wan(ssim!.def.start)}（约 ${ratio} 比 1），城防 ${Math.round(ssim!.segs[0].hp)}`)),
        C('def-hold', 'wall', '坚守城池', '据城而战：分守各段，可修城、出击、调预备；战中仍可改弃城或投降', () => { start(); }, true),
        C('def-abandon', 'withdraw', '弃城突围', '城归敌手但不遭屠戮；守军八成、府库半数退往最近的本方之城', () => { defDecision(ssim!, 'abandon'); manual = true; ending(); }),
        C('def-surrender', 'persuade', '开城投降', '免于兵燹；城与守军、主官一并归敌', () => { defDecision(ssim!, 'surrender'); manual = true; ending(); }),
        C('battle-auto', 'auto', '交部将坚守', '由部将按常法守城，你只看战况', () => { autoMe = true; start(); })));
      renderTray();
      return;
    }
    const cards = h('div', { class: 'ucards' });
    for (const u of myUnits()) {
      const pct = Math.max(0, u.troops / u.start);
      cards.append(h('button', { class: 'ucard' + (u.id === view.selected ? ' on' : '') + (u.state === 'rout' ? ' rout' : ''), 'data-unit': u.id, onclick: () => selectUnit(u.id) },
        h('div', { class: 'uc-h' }, h('span', { class: 'uc-ic k-' + u.kind }, ic(KIND_ICON[u.kind] ?? 'inf')), h('b', null, u.name), h('em', null, wan(u.troops))),
        h('div', { class: 'uc-bars' }, h('i', { class: 'tr', style: { width: pct * 100 + '%' } }), h('i', { class: 'mo', style: { width: Math.max(0, u.morale) + '%' } })),
        h('small', { class: 'uc-st s-' + u.state }, `${orderText(u.order)} · ${STATE_TEXT[u.state] ?? ''}`)));
    }
    const all = h('div', { class: 'uall' });
    const A = (id: string, label: string, icon: string, fn: () => void, on = false, tip = '', cls = '') => h('button', { class: 'atile' + (on ? ' on' : '') + (cls ? ' ' + cls : ''), id, 'data-tip': tip, title: tip, onclick: () => { click(); fn(); } }, ic(icon), h('b', null, label));
    if (phase === 'deploy') {
      all.append(h('div', { class: 'atiles' },
        h('button', { class: 'drum', id: 'siege-go', onclick: () => start() }, ic('attack'), h('b', null, '开战')),
        A('battle-auto', '部将代打', 'auto', () => { autoMe = true; start(); }, false, '由部将按常法指挥我军，你只看战况')));
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
            A('def-abandon2', '弃城', 'withdraw', () => { manual = true; defDecision(ssim!, 'abandon'); }, false, '弃城突围：守军退走（交战中的营伍折损一成五），城归敌手', 'warn'),
            A('def-surrender2', '投降', 'persuade', () => { manual = true; defDecision(ssim!, 'surrender'); }, false, '开城投降：城与守军一并归敌', 'warn')] : [
            A('battle-retreat', '鸣金', 'withdraw', () => { manual = true; if (ssim) command(ssim, { unit: 'all', side, order: { t: 'retreat' } }); else commandF(fsim!, { unit: 'all', side, order: { t: 'retreat' } }); say('鸣金收兵，各营撤回。'); renderUi(); }, false, siege ? '全军撤出，结果为“未克”，围城照旧' : '全军撤出战场，保全兵力', 'warn')])));
    } else {
      all.append(h('div', { class: 'atiles' }, h('button', { class: 'drum', id: 'battle-done', onclick: () => done() }, ic('ok'), h('b', null, resultWord().win ? '凯旋' : '收兵'))));
    }
    ui.append(h('div', { class: 'su-body' }, cards, all));
    renderTray();
  }
  function selectUnit(id: string | null) {
    click();
    view.selected = view.selected === id ? null : id;
    pending = null; if (fview) fview.aiming = false;
    renderUi();
  }
  function issue(u: AnyUnit, o: AnyOrder) {
    if (!isLegal(u, o)) return;
    manual = true;
    cmd(u.id, o);
    pending = null; if (fview) fview.aiming = false;
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

  /* ---------- 点战场 ---------- */
  view.cv.addEventListener('pointermove', e => {
    const r = view.cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (sview) { const p = sview.pick(sx, sy); sview.hoverSeg = pending?.pick === 'seg' && p.seg !== undefined ? p.seg : null; }
    if (fview) { const p = fview.pick(sx, sy); const u = p.unit ? units().find(x => x.id === p.unit) : undefined; fview.hoverUnit = u && (u.side === side || pending?.pick === 'target' || selUnit()) ? u.id : null; view.cv.style.cursor = u && u.side === foe && selUnit() ? 'crosshair' : u ? 'pointer' : 'default'; }
  });
  view.cv.addEventListener('pointerdown', e => {
    const r = view.cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const sel = selUnit();
    if (sview) {
      const p = sview.pick(sx, sy);
      if (pending?.pick === 'seg' && sel && p.seg !== undefined) { click(); issue(sel, { t: pending.t, seg: p.seg } as SOrder); return; }
      if (p.unit) { const u = units().find(x => x.id === p.unit)!; if (u.side === side) { click(); view.selected = u.id; pending = null; renderUi(); return; } }
      if (phase === 'deploy' && sel && side === 'att') {
        const [x, y] = view.unproject(sx, sy);
        sel.x = Math.max(120, Math.min(880, x)); sel.y = Math.max(600, Math.min(830, y)); (sel as SUnit).order = { t: 'hold', x: sel.x, y: sel.y };
        click(); renderUi(); return;
      }
      if (phase === 'fight' && sel && side === 'att' && p.seg === undefined) {
        const [x, y] = view.unproject(sx, sy);
        if (y > 150) issue(sel, { t: 'move', x: Math.max(60, Math.min(940, x)), y: Math.min(950, y) });
      }
      return;
    }
    const fv = fview!;
    const p = fv.pick(sx, sy);
    const u = p.unit ? units().find(x => x.id === p.unit) : undefined;
    if (u && u.side === side && !(pending?.pick === 'ground')) { view.selected = u.id; pending = null; fv.aiming = false; click(); renderUi(); return; }
    if (!sel) return;
    if (phase === 'deploy') {
      if (p.ground) {
        const [x, y] = p.ground;
        sel.x = Math.max(80, Math.min(920, x)); sel.y = side === 'att' ? Math.max(600, Math.min(920, y)) : Math.max(80, Math.min(400, y));
        (sel as FUnit).order = { t: 'hold' };
        click(); renderUi();
      }
      return;
    }
    if (u && u.side === foe) {
      // 点敌营：火器、炮射之，其余进击（或按所选号令）
      const ranged = sel.kind === 'gun' || sel.kind === 'art';
      const t = pending?.pick === 'target' ? pending.t : ranged ? 'fire' : 'attack';
      issue(sel, { t, target: u.id } as FOrder);
      return;
    }
    if (p.ground && (pending?.pick === 'ground' || !pending)) {
      const [x, y] = p.ground;
      issue(sel, { t: 'move', x: Math.max(30, Math.min(970, x)), y: Math.max(30, Math.min(970, y)) });
    }
  });
  const keys = 'qwertyu';
  const onKey = (e: KeyboardEvent) => {
    if (phase === 'end') return;
    if (e.key === 'Tab') {
      e.preventDefault();
      const list = myUnits(); if (!list.length) return;
      const i = list.findIndex(u => u.id === view.selected);
      view.selected = list[(i + 1) % list.length].id; pending = null; renderUi(); return;
    }
    if (e.key === 'Escape') { if (pending) { pending = null; renderTray(); } else { view.selected = null; renderUi(); } return; }
    const k = keys.indexOf(e.key.toLowerCase());
    if (k >= 0 && phase === 'fight') { const u = selUnit(); if (u) { const t = tilesFor(u)[k]; if (t) useTile(u, t); } return; }
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
    if (now - uiTick > 250) { uiTick = now; updateHud(); if (phase === 'fight') refreshCards(); }
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
    pending = null; view.selected = null;
    const r = resultWord();
    gong(r.win);
    bark('me', r.win ? 'win' : 'lose');
    const card = h('div', { class: 'sresult ' + r.tone }, h('b', null, r.big), h('p', null, r.text),
      h('small', null, `历时 ${Math.floor(sim.t / 60)} 分 ${Math.round(sim.t % 60)} 秒 · 我军伤亡 ${wan(lost(side))} · 敌军伤亡 ${wan(lost(foe))}`));
    stage.append(card);
    gsap.fromTo(card, { opacity: 0, scale: 1.4 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.5)' });
    renderUi();
  }
  const lost = (sd: 'att' | 'def') => Math.round(sim[sd].start - units().filter(u => u.side === sd).reduce((n, u) => n + Math.max(0, u.troops), 0));

  let resolveFn!: (v: { result: BattleState; manual: boolean }) => void;
  const finished = new Promise<{ result: BattleState; manual: boolean }>(r => (resolveFn = r));
  function done() {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', onResize);
    resolveFn(finish(ssim ? toBattleResult(b0, ssim) : toFieldResult(b0, fsim!), manual));
  }
  renderUi(); updateHud();
  raf = requestAnimationFrame(frame);
  return finished;

  function finish(result: BattleState, man: boolean) {
    setScene('map');
    root.classList.add('hidden'); root.classList.remove('siege2');
    clear(ui); clear(stage);
    return { result, manual: man };
  }
}
