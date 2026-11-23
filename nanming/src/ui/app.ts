/* 界面主控：游戏式 HUD。图标 + 大数字 + 短标签，细节点开才看。 */
import type { GameState, Order, NodeId, ArmyOrder, Policy, ReportEntry, LedgerEntry, Character, ReportCat } from '../core/types';
import { MapRenderer, nodePt } from '../render/map';
import { h, $, clear, fmt, wan, signed } from './dom';
import { iconSvg } from './icons';
import gsap from 'gsap';
import { playBattle } from './battle';
import { chime, alarm, click, isMuted, setMuted } from './audio';
import { resolveMonth, unificationProgress, type Answer } from '../core/turn';
import { dateLabel, eraYear, monthName, lunarOf, shortDate } from '../core/calendar';
import { POLITIES } from '../data/factions';
import { NODE, VICTORY_AREAS, shortestPath, pathDays } from '../data/geography';
import { friendly, hostile, stance, troopsText, roughTroops, nodeName, charName } from '../core/state';
import { POLICY_NAME, POLICY_HINT, monthlyIncome, upkeepOf, RECRUIT_SILVER } from '../core/economy';
import { describeOrder, validateOrder, maxRecruit, recruitLeft, supplyBlock, obedience, persuadeChance, envoyScore, armyOrderText } from '../core/orders';
import { browserKV, saveTo, loadFrom, serialize, deserialize, SLOTS, type Slot } from '../core/save';
import { trialState, yangzhouSiegeState } from '../data/presets';
import { canSea } from '../core/military';
import type { PendingChoice } from '../core/events';

const STANCE_NAME: Record<string, string> = { war: '交战', neutral: '未战', truce: '停战', alliance: '同盟', overlord: '上级', vassal: '下属', self: '本方' };
const FIELD_NAME: Record<string, string> = { grain: '仓粮', silver: '府库', pop: '人口', minxin: '民心', garrison: '驻军', wall: '城防', order: '吏治', agri: '农业', commerce: '商业', edu: '文教' };
const FIELD_ICON: Record<string, string> = { grain: 'grain', silver: 'silver', pop: 'pop', minxin: 'minxin', garrison: 'troops', wall: 'wall', order: 'order', agri: 'agri', commerce: 'commerce', edu: 'edu' };
const CAT_ICON: Record<ReportCat, string> = { 急报: 'urgent', 军报: 'war', 易主: 'capture', 交涉: 'envoy', 内政: 'admin', 人事: 'person', 史事: 'event', 线索: 'clue' };
const POLICY_ICON: Record<Policy, string> = { balanced: 'order', agri: 'agri', commerce: 'commerce', fortify: 'wall', relief: 'minxin', edu: 'edu', levy: 'reward' };
const ORDER_ICON: Record<Order['kind'], string> = { policy: 'policy', appoint: 'appoint', transfer: 'transfer', recruit: 'recruit', army: 'army', reinforce: 'reinforce', envoy: 'envoy', persuade: 'persuade', command: 'urgent', reward: 'reward' };
const HINT_KEY = 'nanming:hint';

/** 内联图标元素 */
export const ic = (name: string, cls = 'ic') => { const s = h('span', { style: { display: 'contents' } }); s.innerHTML = iconSvg(name, cls); return s; };
const meter = (v: number, color: string) => h('div', { class: 'meter' }, h('i', { style: { width: Math.max(0, Math.min(100, v)) + '%', background: color } }));
const mcol = (v: number) => (v >= 60 ? 'var(--green)' : v >= 35 ? 'var(--amber)' : 'var(--red-2)');

/** 把一条月报拆成“标题 + 细节” */
export function splitReport(r: ReportEntry): { hl: string; more: string } {
  const t = r.text;
  let m = t.match(/^【(.+?)】(.*)$/);
  if (m) return { hl: m[1], more: m[2] };
  m = t.match(/^(.+?(?:野战|攻城战))：.+?。(.+?。)(.*)$/);
  if (m) return { hl: `${m[1]} · ${m[2].replace(/。$/, '')}`, more: t.slice(m[1].length + 1) };
  m = t.match(/^(.+?易主（.+?）)：.*?(现由.+?控制)。/);
  if (m) return { hl: `${m[1]} → ${m[2].replace('现由', '').replace('控制', '')}`, more: t.slice(m[1].length + 1) };
  m = t.match(/^(号令.+?)：.*?结果：(.+?)。/);
  if (m) return { hl: `${m[1].replace(/（.+?）/, '')} → ${m[2]}`, more: t.slice(m[1].length + 1) };
  const i = t.indexOf('。');
  if (i > 0 && i < t.length - 1) return { hl: t.slice(0, i), more: t.slice(i + 1) };
  return { hl: t.replace(/。$/, ''), more: '' };
}

export class App {
  s: GameState | null = null;
  orders: Order[] = [];
  map: MapRenderer;
  kv = browserKV();
  seq = 0;
  resolving = false;
  reportTurn = -1;
  reportTab = '全部';
  cityTab: 'main' | 'ledger' | 'army' = 'main';
  autoBattle = false;
  lastPills: Record<string, number> = {};
  hintStep = 0;
  targetCb: ((node: NodeId) => void) | null = null;
  drag: { x: number; y: number; moved: boolean } | null = null;

  constructor() {
    const canvas = $('#map') as HTMLCanvasElement;
    this.map = new MapRenderer(canvas);
    this.map.resize();
    window.addEventListener('resize', () => { this.map.resize(); this.map.clamp(); });
    this.bindMap(canvas);
    window.addEventListener('keydown', e => this.onKey(e));
    try { this.hintStep = Number(localStorage.getItem(HINT_KEY) ?? 0); } catch { this.hintStep = 0; }
    const loop = (t: number) => { this.map.render(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    this.showTitle();
    (window as any).NM = this; // 调试与自动化测试入口
    (window as any).NM_nodePt = nodePt;
  }

  /* ================= 标题 ================= */
  titleTimer = 0;
  showTitle() {
    const t = $('#title');
    t.classList.remove('gone');
    clear(t);
    this.s = null;
    this.map.view.state = trialState(1);
    this.map.view.selected = null;
    this.map.focus('wuchang', 1.1);
    for (const id of ['#panel', '#report', '#hint', '#legend']) $(id).classList.add('hidden');
    clear($('#orders'));
    // 背景地图缓缓巡游
    const tour = ['nanjing', 'yangzhou', 'beijing', 'xian', 'chengdu', 'wuchang', 'fuzhou'];
    let ti = 0;
    clearInterval(this.titleTimer);
    this.map.flyTo(tour[0], 1.5);
    this.titleTimer = window.setInterval(() => { if (this.s) { clearInterval(this.titleTimer); return; } ti = (ti + 1) % tour.length; this.map.flyTo(tour[ti], 1.3 + (ti % 3) * 0.25); }, 4200);
    const auto = loadFrom(this.kv, 'auto');
    const mb = (id: string, icon: string, title: string, sub: string, onclick: () => void, primary = false) =>
      h('button', { class: 'mbtn' + (primary ? ' primary' : ''), id, onclick }, ic(icon), h('div', null, h('b', null, title), h('small', null, sub)));
    const embers = h('div', { class: 'embers' });
    for (let k = 0; k < 28; k++) embers.append(h('i', { style: { left: (Math.random() * 100) + '%', animationDelay: (Math.random() * 8) + 's', animationDuration: (6 + Math.random() * 6) + 's', transform: `scale(${0.5 + Math.random()})` } }));
    t.append(embers, h('div', { class: 'title-in' },
      h('div', { class: 'logo' }, h('div', { class: 't' }, h('span', { class: 'ch' }, '南'), h('span', { class: 'ch red' }, '明')), h('div', { class: 'seal' }, '甲申以后'), h('div', { class: 'years' }, '一六四四 — 一六六二'),
        h('div', { class: 'tagline' }, '北京失守的消息传到南京')),
      h('div', { class: 'menu hud' },
        mb('btn-new', 'newgame', '新开局 · 弘光朝廷', '十二回合试玩', () => this.start(trialState(Date.now() % 100000), true), true),
        mb('btn-sample', 'siege', '地图样稿 · 扬州被围', '乙酉四月', () => this.start(yangzhouSiegeState(), false, 'yangzhou')),
        auto ? mb('btn-continue', 'play', '继续游戏', auto.label, () => this.start(auto.state, false)) : null,
        mb('btn-load', 'load', '读取存档', '三个存档位 · 可导入', () => this.openSaves(true)),
        mb('btn-about', 'help', '玩法说明', '一分钟上手', () => this.openAbout()),
        h('div', { class: 'credit' }, '一尾小石斑 作 · 战斗引擎 Phaser · 图标 game-icons.net · 底图 Natural Earth · 地形 AWS Terrain Tiles'),
      )));
    const tl = gsap.timeline({ defaults: { clearProps: 'transform,filter' } });
    tl.from('#title .ch', { opacity: 0, y: 40, scale: 1.4, filter: 'blur(12px)', duration: 0.9, stagger: 0.25, ease: 'power3.out' })
      .from('#title .seal', { opacity: 0, scale: 2.4, rotate: -25, duration: 0.45, ease: 'back.out(2.5)' }, '-=0.2')
      .from('#title .years, #title .tagline', { opacity: 0, y: 10, duration: 0.5, stagger: 0.12 }, '-=0.1')
      .from('#title .menu', { opacity: 0, x: 60, duration: 0.5, ease: 'power3.out' }, 0.5)
      .from('#title .mbtn', { opacity: 0, x: 40, duration: 0.4, stagger: 0.08, ease: 'power3.out' }, 0.7);
  }

  start(state: GameState, fresh: boolean, focus?: string) {
    this.s = state;
    this.orders = [];
    this.seq = 0;
    this.reportTurn = state.turn - 1;
    clearInterval(this.titleTimer);
    gsap.to('#title', { opacity: 0, duration: 0.35, onComplete: () => { $('#title').classList.add('gone'); ($('#title') as HTMLElement).style.opacity = ''; } });
    this.map.view.state = state;
    this.map.view.selected = null;
    this.map.view.selectedArmy = null;
    this.map.focus(focus ?? state.factions[state.player].capital, focus ? 2.4 : 2.0);
    this.renderAll();
    if (focus) this.selectNode(focus);
    if (fresh && this.hintStep < 4) { this.hintStep = 0; this.showHint(); }
    else if (state.reports.some(r => r.turn === state.turn - (state.ended ? 0 : 1))) { this.reportTurn = state.turn - (state.ended ? 0 : 1); this.openReport(); }
    if (fresh) this.autoSave();
    // 读到已结束的局势：重新打开结局面板，按结局允许的操作继续
    if (state.ended) this.showEnd();
  }

  /* ================= 地图交互 ================= */
  bindMap(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
      if (!this.s) return;
      const r = canvas.getBoundingClientRect();
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        if (this.drag.moved || Math.hypot(dx, dy) > 4) {
          this.drag.moved = true; canvas.classList.add('dragging');
          this.map.pan(dx, dy); this.drag.x = e.clientX; this.drag.y = e.clientY;
          this.hideTip();
          return;
        }
      }
      const p = this.map.pick(e.clientX - r.left, e.clientY - r.top);
      this.map.view.hover = p?.kind === 'node' ? p.id : null;
      if (this.map.view.targeting && p?.kind === 'node') {
        const a = this.s.armies[this.map.view.targeting.army];
        const start = a.progress > 0 && a.path.length ? a.path[0] : a.location;
        const path = shortestPath(start, p.id, canSea(a));
        this.map.view.targeting.path = path ? (a.progress > 0 && a.path.length ? [a.path[0], ...path] : path) : null;
      }
      this.showTip(p, e.clientX, e.clientY);
    });
    canvas.addEventListener('pointerup', e => {
      canvas.classList.remove('dragging');
      const d = this.drag; this.drag = null;
      if (d && d.moved) return;
      if (!this.s) return;
      const r = canvas.getBoundingClientRect();
      const p = this.map.pick(e.clientX - r.left, e.clientY - r.top);
      if (this.targetCb) { if (p?.kind === 'node') { const cb = this.targetCb; this.endTarget(); cb(p.id); } return; }
      if (!p) { this.closePanel(); return; }
      if (p.kind === 'node') this.selectNode(p.id); else this.selectArmy(p.id);
    });
    canvas.addEventListener('pointerleave', () => { this.hideTip(); this.map.view.hover = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      this.map.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }

  onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    if (e.key === 'Escape') {
      if (this.targetCb) this.endTarget();
      else if (!$('#modal').classList.contains('hidden')) this.closeModal();
      else this.closePanel();
    }
    if (!this.s || this.resolving || !$('#modal').classList.contains('hidden')) return;
    if (e.key === 'r' || e.key === 'R') this.toggleReport();
    if (e.key === '+' || e.key === '=') this.map.zoomAt(this.map.w / 2, this.map.h / 2, 1.25);
    if (e.key === '-') this.map.zoomAt(this.map.w / 2, this.map.h / 2, 0.8);
  }

  showTip(p: { kind: 'node' | 'army'; id: string } | null, x: number, y: number) {
    const tip = $('#tooltip');
    if (!p || !this.s) { this.hideTip(); return; }
    const s = this.s;
    clear(tip);
    tip.className = 'hud';
    const row = (icon: string, val: string) => h('div', { class: 'tt-r' }, ic(icon), h('b', null, val));
    if (p.kind === 'node') {
      const c = s.cities[p.id], n = NODE[p.id];
      const f = s.factions[c.controller];
      const known = this.known(p.id);
      tip.append(h('div', { class: 'tt-h' }, h('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: f.color, display: 'inline-block', border: '1.5px solid #fff' } }), n.name),
        row('factions', `${f.short} · 奉${POLITIES[f.polity].name}`),
        row('troops', known ? troopsText(c.garrison) : roughTroops(c.garrison)),
        row('wall', `城防 ${Math.round(c.wall)}`));
      if (s.sieges[p.id]) tip.append(row('siege', `被围 · 第 ${s.sieges[p.id].months} 月`));
      if (this.map.view.targeting?.path) { const a = s.armies[this.map.view.targeting.army]; tip.append(row('hourglass', `行程 ${pathDays(a.location, this.map.view.targeting.path)} 日`)); }
    } else {
      const a = s.armies[p.id];
      const mine = this.isMineOrVassal(a.faction);
      tip.append(h('div', { class: 'tt-h' }, a.name), row('person', charName(s, a.commander)), row('troops', mine ? troopsText(a.troops) : roughTroops(a.troops)), row('move', armyOrderText(a.order)));
    }
    tip.classList.remove('hidden');
    tip.style.left = Math.min(window.innerWidth - 270, x + 16) + 'px';
    tip.style.top = Math.min(window.innerHeight - 140, y + 16) + 'px';
  }
  hideTip() { $('#tooltip').classList.add('hidden'); }

  beginTarget(army: string, text: string, cb: (node: NodeId) => void) {
    this.map.view.targeting = { army, path: null };
    this.targetCb = cb;
    ($('#map') as HTMLCanvasElement).classList.add('targeting');
    this.toast(text + '（Esc 取消）', 'target');
  }
  endTarget() {
    this.map.view.targeting = null;
    this.targetCb = null;
    ($('#map') as HTMLCanvasElement).classList.remove('targeting');
  }

  /* ================= 工具 ================= */
  isMineOrVassal(f: string) { return f === this.s!.player || this.s!.factions[f]?.overlord === this.s!.player; }
  known(node: string) { const c = this.s!.cities[node]; return friendly(this.s!, this.s!.player, c.controller); }
  pendingSpend(node: string, field: 'grain' | 'silver'): number {
    let n = 0;
    for (const o of this.orders) {
      if (o.kind === 'recruit' && o.node === node && field === 'silver') n += o.troops * RECRUIT_SILVER;
      if (o.kind === 'transfer' && o.from === node) n += field === 'grain' ? o.grain : o.silver;
      if ((o.kind === 'reward' || o.kind === 'command') && this.s!.factions[this.s!.player].capital === node && field === 'silver') n += o.silver;
    }
    return n;
  }
  newOrderId() { return `o${this.s!.turn}-${++this.seq}`; }
  addOrder(o: Order) {
    const s = this.s!;
    this.orders = this.orders.filter(x => !(x.kind === o.kind && sameTarget(x, o)));
    const err = validateOrder(s, s.player, o);
    if (err) { this.toast(err, 'close'); return false; }
    this.orders.push(o);
    click();
    this.toast(describeOrder(s, o), ORDER_ICON[o.kind]);
    this.renderOrders(); this.renderTop(); this.refreshPanel();
    if (this.hintStep === 1) { this.hintStep = 2; this.showHint(); }
    return true;
  }
  removeOrder(id: string) { this.orders = this.orders.filter(o => o.id !== id); this.renderOrders(); this.renderTop(); this.refreshPanel(); }
  toast(text: string, icon = 'info') {
    const el = h('div', { class: 'hud' }, ic(icon), text);
    $('#toast').append(el);
    gsap.from(el, { y: -16, opacity: 0, scale: 0.9, duration: 0.3, ease: 'back.out(2)' });
    setTimeout(() => el.remove(), 3300);
  }

  /* ================= 顶栏 ================= */
  renderAll() { this.renderTop(); this.renderOrders(); this.refreshPanel(); this.updatePlanned(); }

  renderTop() {
    const s = this.s!;
    const top = clear($('#topbar'));
    top.className = 'hud';
    const me = s.factions[s.player];
    const pol = POLITIES[me.polity];
    const cap = s.cities[me.capital];
    const own = Object.values(s.cities).filter(c => c.controller === s.player);
    const troops = own.reduce((n, c) => n + c.garrison, 0) + Object.values(s.armies).filter(a => a.faction === s.player).reduce((n, a) => n + a.troops, 0);
    const lm = lunarOf(s.turn);
    const pips = h('div', { class: 'pips' });
    if (s.scenario === 'trial' && s.turnLimit) for (let i = 0; i < s.turnLimit; i++) pips.append(h('i', { class: i < s.turn ? 'on' : i === s.turn ? 'now' : '' }));
    const unread = s.reports.filter(r => r.turn === s.turn - 1 && r.urgent && (!r.faction || r.faction === s.player)).length;
    const ib = (id: string, icon: string, tip: string, onclick: () => void, extra?: { on?: boolean; badge?: number }) =>
      h('button', { class: 'ibtn' + (extra?.on ? ' on' : ''), id, 'data-tip': tip, 'aria-label': tip, onclick }, ic(icon), extra?.badge ? h('span', { class: 'badge' }, String(extra.badge)) : null);
    const pill = (icon: string, val: string, label: string, tip: string, raw?: number) => {
      const b = h('b', null, val);
      const key = 'pill:' + icon;
      const prev = this.lastPills[key];
      if (raw !== undefined && prev !== undefined && prev !== raw) {
        const o = { v: prev };
        gsap.to(o, { v: raw, duration: 0.9, ease: 'power2.out', onUpdate: () => { b.textContent = icon === 'city' ? String(Math.round(o.v)) : wan(o.v); } });
        gsap.fromTo(b, { color: raw > prev ? '#9fe08f' : '#ff9a8a' }, { color: '#f3e6c8', duration: 1.2 });
      }
      if (raw !== undefined) this.lastPills[key] = raw;
      return h('div', { class: 'pill', 'data-tip': tip }, ic(icon), b, h('small', null, label));
    };
    top.append(
      h('div', { class: 'emblem', title: me.name }, pol.mark || me.short),
      h('div', { class: 'datebox' },
        h('div', null, h('div', { class: 'era', id: 'date-label', title: dateLabel(pol, s.turn) }, `${eraYear(pol, s.turn)}${monthName(lm)}`), h('div', { class: 'yr' }, `${me.short} · 公元 ${lm.year}`), pips)),
      h('div', { class: 'res' },
        pill('silver', wan(cap.silver - this.pendingSpend(me.capital, 'silver')), '两', `${nodeName(me.capital)}府库（银）`, cap.silver - this.pendingSpend(me.capital, 'silver')),
        pill('grain', wan(cap.grain - this.pendingSpend(me.capital, 'grain')), '石', `${nodeName(me.capital)}仓粮`, cap.grain - this.pendingSpend(me.capital, 'grain')),
        pill('city', String(own.length), '城', '直辖城池', own.length),
        pill('troops', wan(troops), '兵', '直辖兵力', troops),
      ),
      h('div', { class: 'spacer' }),
      ib('btn-report', 'report', '军情（R）', () => this.toggleReport(), { badge: unread }),
      ib('btn-factions', 'factions', '天下诸家', () => this.openFactions()),
      ib('btn-chars', 'chars', '人物', () => this.openChars()),
      ib('btn-legend', 'map', '图例', () => this.toggleLegend(), { on: !$('#legend').classList.contains('hidden') }),
      ib('btn-save', 'save', '存档', () => this.openSaves(false)),
      ib('btn-battle', this.autoBattle ? 'auto' : 'battle', this.autoBattle ? '战斗：部将自动' : '战斗：亲自指挥', () => { this.autoBattle = !this.autoBattle; this.renderTop(); }, { on: !this.autoBattle }),
      ib('btn-sound', isMuted() ? 'mute' : 'sound', isMuted() ? '已静音' : '声音', () => { setMuted(!isMuted()); this.renderTop(); }),
      ib('btn-title', 'exit', '回到标题', () => this.confirmTitle()),
      h('button', { class: 'endturn' + (this.orders.length && !this.resolving ? ' ready' : ''), id: 'btn-next', disabled: this.resolving || !!s.ended, onclick: () => void this.endTurn() },
        ic(this.resolving ? 'hourglass' : 'next'), h('span', null, s.ended ? '本局结束' : this.resolving ? '行动中' : '结束本月'),
        this.orders.length ? h('span', { class: 'badge' }, String(this.orders.length)) : null),
    );
  }

  renderOrders() {
    const box = clear($('#orders'));
    if (!this.s || !this.orders.length) return;
    box.append(h('span', { class: 'ord-label' }, `本月命令 ${this.orders.length}`));
    for (const o of this.orders) {
      box.append(h('div', { class: 'order hud', title: describeOrder(this.s, o) }, ic(ORDER_ICON[o.kind]), h('span', null, describeOrder(this.s, o)),
        h('button', { title: '撤销', onclick: () => this.removeOrder(o.id) }, ic('close'))));
    }
  }

  updatePlanned() {
    const s = this.s!;
    const planned: { army: string; path: string[] }[] = [];
    for (const o of this.orders) {
      const ord = o.kind === 'army' || o.kind === 'command' ? o.order : null;
      const id = o.kind === 'army' || o.kind === 'command' ? o.army : null;
      if (!ord || !id || ord.kind === 'hold') continue;
      const a = s.armies[id];
      const p = shortestPath(a.location, ord.target, canSea(a));
      if (p) planned.push({ army: id, path: p });
    }
    this.map.view.planned = planned;
  }

  /* ================= 城池卡 ================= */
  selectNode(id: string) {
    if (this.map.view.selected !== id) this.cityTab = 'main';
    this.map.view.selected = id;
    this.map.view.selectedArmy = null;
    this.renderCity(id);
    if (this.hintStep === 0 && id === this.s!.factions[this.s!.player].capital) { this.hintStep = 1; this.showHint(); }
  }
  selectArmy(id: string) {
    this.map.view.selectedArmy = id;
    this.map.view.selected = this.s!.armies[id]?.location ?? null;
    this.renderArmy(id);
  }
  closePanel() { $('#panel').classList.add('hidden'); this.map.view.selected = null; this.map.view.selectedArmy = null; }
  refreshPanel() {
    this.updatePlanned();
    if ($('#panel').classList.contains('hidden')) return;
    if (this.map.view.selectedArmy && this.s!.armies[this.map.view.selectedArmy]) this.renderArmy(this.map.view.selectedArmy);
    else if (this.map.view.selected) this.renderCity(this.map.view.selected);
  }

  panelShell(color: string, title: string, sub: string, bigIcon: string, titleId: string): HTMLElement {
    const panel = clear($('#panel'));
    const wasHidden = panel.classList.contains('hidden');
    requestAnimationFrame(() => {
      if (wasHidden) gsap.fromTo('#panel', { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' });
      gsap.from('#panel .banner h2', { opacity: 0, x: -14, duration: 0.3, ease: 'power2.out' });
      gsap.from('#panel .tile, #panel .act, #panel .unit, #panel .row', { opacity: 0, y: 8, duration: 0.25, stagger: 0.012, ease: 'power2.out' });
    });
    panel.className = 'hud';
    panel.append(h('div', { class: 'banner', style: { background: `linear-gradient(135deg, ${color}, ${shade(color, -0.5)})` } },
      ic(bigIcon, 'ic bigicon'),
      h('button', { class: 'close', title: '关闭（Esc）', onclick: () => this.closePanel() }, ic('close')),
      h('h2', { id: titleId }, title), h('div', { class: 'sub' }, sub)));
    return panel;
  }

  tile(icon: string, k: string, v: string, opts: { id?: string; d?: number; meter?: number; unit?: string } = {}): HTMLElement {
    return h('div', { class: 'tile' },
      h('div', { class: 'k' }, ic(icon), k),
      h('div', { class: 'v', id: opts.id }, v, opts.unit ? h('small', null, ' ' + opts.unit) : null),
      opts.meter !== undefined ? meter(opts.meter, mcol(opts.meter)) : null,
      opts.d ? h('div', { class: 'd ' + (opts.d > 0 ? 'up' : 'down') }, (opts.d > 0 ? '▲ ' : '▼ ') + signed(Math.abs(opts.d))) : null);
  }

  renderCity(id: string) {
    const s = this.s!;
    const c = s.cities[id], n = NODE[id];
    const ctrl = s.factions[c.controller];
    const pol = POLITIES[ctrl.polity];
    const known = this.known(id);
    const mine = c.controller === s.player;
    const vassal = !mine && ctrl.overlord === s.player;
    const panel = this.panelShell(ctrl.color, n.name, n.title ?? '', n.kind === 'port' ? 'port' : n.kind === 'pass' ? 'pass' : n.kind === 'ferry' ? 'ferry' : 'city', 'city-name');
    const banner = panel.querySelector('.banner')!;
    const gov = c.governor ? s.chars[c.governor] : undefined;
    banner.append(h('div', { class: 'tags' },
      h('span', { class: 'tag', id: 'city-controller', title: '实际控制者' }, ic('city'), ctrl.name),
      h('span', { class: 'tag', id: 'city-polity', title: '所奉政权' }, ic('factions'), pol.mark ? `奉${pol.name}` : '无所奉'),
      gov && gov.status === 'active' && gov.faction === c.controller ? h('span', { class: 'tag', style: { cursor: 'pointer' }, title: '主官', onclick: () => this.openChar(gov.id) }, ic('person'), gov.name) : null,
      vassal ? h('span', { class: 'tag', title: '下属对朝廷的服从' }, ic('morale'), `服从 ${ctrl.loyalty}`) : null));
    panel.classList.remove('hidden');
    // 围城
    const sg = s.sieges[id];
    if (sg) {
      const att = sg.armies.map(a => s.armies[a]).filter(Boolean);
      const total = att.reduce((m, a) => m + a.troops, 0);
      const months = Math.max(0, Math.floor(c.grain / Math.max(1, upkeepOf(s, c).grain)));
      panel.append(h('div', { class: 'alert', id: 'siege-box' },
        h('div', { class: 'head' }, ic('siege'), `被围 · 第 ${sg.months} 月`),
        h('div', { class: 'vs' },
          h('div', { class: 'side' }, h('b', null, this.isMineOrVassal(sg.attacker) ? wan(total) : roughTroops(total)), h('small', null, `城外 ${s.factions[sg.attacker].short} · ${att.map(a => charName(s, a.commander)).join('、')}`)),
          h('div', { class: 'x' }, '围'),
          h('div', { class: 'side' }, h('b', null, known ? wan(c.garrison) : roughTroops(c.garrison)), h('small', null, known ? `城内守军 · 粮够 ${months} 月` : '城内守军'))),
      ));
    }
    const here = Object.values(s.armies).filter(a => a.location === id && a.progress === 0);
    if (known) {
      const tabs = h('div', { class: 'tabs' });
      const tb = (k: 'main' | 'ledger' | 'army', icon: string, label: string) => h('button', { class: 'tab' + (this.cityTab === k ? ' on' : ''), id: 'tab-' + k, onclick: () => { this.cityTab = k; this.renderCity(id); } }, ic(icon), label);
      tabs.append(tb('main', 'city', '概况'), tb('ledger', 'why', '钱粮来由'), tb('army', 'army', `军队 ${here.length}`));
      panel.append(tabs);
    } else this.cityTab = 'main';
    const last = s.turn - 1;
    const delta = (f: LedgerEntry['field']) => s.ledger.filter(e => e.turn === last && e.node === id && e.field === f).reduce((m, e) => m + e.delta, 0);
    const sec = h('div', { class: 'sec' });
    panel.append(sec);
    if (this.cityTab === 'main') {
      sec.append(h('div', { class: 'sec-title' }, ic('troops'), '城情'));
      sec.append(h('div', { class: 'tiles' },
        this.tile('troops', '驻军', known ? wan(c.garrison) : roughTroops(c.garrison), { id: 'city-garrison', d: known ? delta('garrison') : 0 }),
        this.tile('wall', '城防', String(Math.round(c.wall)), { meter: c.wall }),
        this.tile('minxin', '民心', known ? String(Math.round(c.minxin)) : c.minxin > 60 ? '稳' : c.minxin > 40 ? '浮动' : '离散', { meter: known ? c.minxin : undefined }),
        this.tile('grain', '仓粮', known ? wan(c.grain - this.pendingSpend(id, 'grain')) : '不详', { id: 'city-grain', d: known ? delta('grain') : 0 }),
        this.tile('silver', '府库', known ? wan(c.silver - this.pendingSpend(id, 'silver')) : '不详', { id: 'city-silver', d: known ? delta('silver') : 0 }),
        this.tile('pop', '人口', `${Math.round(c.pop)}`, { unit: '万' }),
      ));
      if (known) {
        const inc = monthlyIncome(s, c), up = upkeepOf(s, c);
        sec.append(h('div', { class: 'rows', style: { marginTop: '6px' } },
          h('div', { class: 'row' }, ic('grain'), h('span', { class: 't' }, '每月粮 进 / 出'), h('b', { class: inc.grain >= up.grain ? 'up' : 'down' }, `${wan(inc.grain)} / ${wan(up.grain)}`)),
          h('div', { class: 'row' }, ic('silver'), h('span', { class: 't' }, '每月银 进 / 出'), h('b', { class: inc.silver + inc.trade >= up.silver ? 'up' : 'down' }, `${wan(inc.silver + inc.trade)} / ${wan(up.silver)}`))));
      }
      // 行动
      const acts = h('div', { class: 'acts' });
      const has = (k: Order['kind']) => this.orders.some(o => o.kind === k && ((o as any).node === id || (o as any).from === id));
      const A = (aid: string, icon: string, label: string, onclick: () => void, done = false, primary = false) => h('button', { class: 'act' + (done ? ' done' : '') + (primary ? ' primary' : ''), id: aid, onclick }, ic(icon), label);
      if (mine) {
        acts.append(A('act-policy', 'policy', '方针', () => this.formPolicy(id), has('policy')),
          A('act-recruit', 'recruit', '募兵', () => this.formRecruit(id), has('recruit')),
          A('act-transfer', 'transfer', '调拨', () => this.formTransfer(id), has('transfer')),
          A('act-appoint', 'appoint', '任命', () => this.formAppoint(id), has('appoint')));
      } else if (vassal) {
        acts.append(A('act-reward', 'reward', '犒赏', () => this.formReward(c.controller)), A('act-supply', 'transfer', '拨粮', () => this.formTransfer(s.factions[s.player].capital, id)));
      } else if (!friendly(s, s.player, c.controller)) {
        acts.append(A('act-persuade', 'persuade', '劝降', () => this.formPersuade(id), s.missions.some(m => (m.order as any).node === id) || this.orders.some(o => o.kind === 'persuade' && o.node === id), true));
      }
      if (acts.childNodes.length) { sec.append(h('div', { class: 'sec-title' }, ic('policy'), mine ? '政令' : vassal ? '下属' : '交涉')); sec.append(acts); }
      if (known) {
        sec.append(h('div', { class: 'sec-title' }, ic('agri'), '长期'));
        sec.append(h('div', { class: 'tiles' },
          this.tile('order', '吏治', String(Math.round(c.order)), { meter: c.order }),
          this.tile('agri', '农业', String(Math.round(c.agri)), { meter: c.agri }),
          this.tile('commerce', '商业', String(Math.round(c.commerce)), { meter: c.commerce }),
          this.tile('edu', '文教', String(Math.round(c.edu)), { meter: c.edu }),
          this.tile('policy', '方针', POLICY_NAME[((this.orders.find(o => o.kind === 'policy' && o.node === id) as any)?.policy ?? c.policy) as Policy]),
          c.trade ? this.tile('port', '海贸', `×${c.trade}`) : this.tile('city', '类型', n.detail ? '细作' : '大区'),
        ));
      }
      if (here.length) {
        sec.append(h('div', { class: 'sec-title' }, ic('army'), `城下军队 ${here.length}`));
        for (const a of here.slice(0, 4)) sec.append(this.unitRow(a.id));
      }
      if (c.uncertain) sec.append(h('div', { class: 'note' }, '考据 · ', c.uncertain));
    } else if (this.cityTab === 'ledger') {
      sec.append(this.ledgerView(id, last));
    } else {
      sec.append(h('div', { class: 'sec-title' }, ic('army'), '城下军队'));
      if (!here.length) sec.append(h('div', { class: 'note' }, '无'));
      for (const a of here) sec.append(this.unitRow(a.id));
    }
  }

  ledgerView(id: string, turn: number): HTMLElement {
    const s = this.s!;
    const box = h('div', { class: 'rows', id: 'ledger', style: { marginTop: '10px' } });
    const entries = s.ledger.filter(e => e.turn === turn && e.node === id);
    if (!entries.length) { box.append(h('div', { class: 'note' }, '结束本月后，这里逐项列出每一笔变化。')); return box; }
    box.append(h('div', { class: 'note' }, `${shortDate(turn)} · 红框 = 你的命令`));
    for (const f of ['grain', 'silver', 'garrison', 'minxin', 'wall', 'pop'] as const) {
      const list = entries.filter(e => e.field === f);
      if (!list.length) continue;
      const net = list.reduce((m, e) => m + e.delta, 0);
      box.append(h('div', { class: 'row head' }, ic(FIELD_ICON[f]), h('span', { class: 't' }, FIELD_NAME[f]), h('b', { class: net >= 0 ? 'up' : 'down' }, signed(net))));
      const merged = new Map<string, { delta: number; e: LedgerEntry; n: number }>();
      for (const e of list) {
        // 各城起运、解饷合并为一行
        const grouped = e.src.kind === 'remit' && e.delta > 0;
        const k = grouped ? 'remit-in' : e.text + '|' + (e.src.ref ?? '');
        const m = merged.get(k);
        if (m) { m.delta += e.delta; m.n++; } else merged.set(k, { delta: e.delta, e: grouped ? { ...e, text: '各城起运、解饷' } : e, n: 1 });
      }
      for (const { delta, e, n } of [...merged.values()].sort((a, b) => a.delta - b.delta)) {
        const isOrder = e.src.kind === 'order';
        if (n > 1) e.text = `${e.text}（${n} 城）`;
        box.append(h('div', { class: 'row' + (isOrder ? ' mine' : ''), title: e.text }, ic(isOrder ? 'appoint' : e.src.kind === 'event' ? 'event' : e.src.kind === 'battle' || e.src.kind === 'siege' ? 'war' : delta >= 0 ? 'agri' : 'troops'),
          h('span', { class: 't' }, isOrder ? `${e.text} · 你的命令` : e.text), h('b', { class: delta >= 0 ? 'up' : 'down' }, signed(delta))));
      }
    }
    const orders = s.ledger.filter(e => e.node === id && e.src.kind === 'order' && e.turn < turn && e.turn >= turn - 6);
    if (orders.length) {
      box.append(h('div', { class: 'row head' }, ic('hourglass'), h('span', { class: 't' }, '此前的命令'), h('b', null, '')));
      const seen = new Set<string>();
      for (const e of orders.reverse()) { const k = e.src.ref + e.text; if (seen.has(k)) continue; seen.add(k); box.append(h('div', { class: 'row mine' }, ic('appoint'), h('span', { class: 't' }, `${shortDate(e.turn)} ${e.text} · 你的命令`), h('b', null, `${FIELD_NAME[e.field]} ${signed(e.delta)}`))); }
    }
    return box;
  }

  unitRow(id: string): HTMLElement {
    const s = this.s!;
    const a = s.armies[id];
    const f = s.factions[a.faction];
    const mine = this.isMineOrVassal(a.faction);
    return h('div', { class: 'unit', 'data-army': id, onclick: () => this.selectArmy(id) },
      h('div', { class: 'coin', style: { background: f.color } }, charName(s, a.commander).slice(0, 1)),
      h('div', { class: 'nm' }, h('b', null, a.name), h('small', null, `${f.short} · ${armyOrderText(a.order)}`)),
      h('span', { class: 'chipnum' }, mine ? wan(a.troops) : roughTroops(a.troops)));
  }

  /* ================= 军队卡 ================= */
  renderArmy(id: string) {
    const s = this.s!;
    const a = s.armies[id];
    if (!a) { this.closePanel(); return; }
    const f = s.factions[a.faction];
    const cmd = s.chars[a.commander];
    const mine = a.faction === s.player;
    const vassal = f.overlord === s.player;
    const visible = mine || vassal || friendly(s, s.player, a.faction);
    const panel = this.panelShell(f.color, a.name, f.name, 'army', 'army-name');
    panel.classList.remove('hidden');
    const sec = h('div', { class: 'sec' });
    panel.append(sec);
    if (cmd) sec.append(h('div', { class: 'unit', style: { marginTop: '12px' }, onclick: () => this.openChar(cmd.id) },
      h('div', { class: 'portrait', style: { background: f.color, width: '48px', height: '48px', fontSize: '26px' } }, cmd.name.slice(0, 1)),
      h('div', { class: 'nm' }, h('b', null, cmd.name), h('small', null, cmd.title)),
      h('span', { class: 'chipnum' }, `统 ${cmd.ab.tong} · 谋 ${cmd.ab.mou}`)));
    sec.append(h('div', { class: 'tiles', style: { marginTop: '8px' } },
      this.tile('troops', '兵力', visible ? wan(a.troops) : roughTroops(a.troops)),
      this.tile('morale', '士气', visible ? String(Math.round(a.morale)) : '不详', { meter: visible ? a.morale : undefined }),
      this.tile('supply', '粮台', visible ? nodeName(a.supply) : '不详'),
    ));
    if (visible) sec.append(h('div', { class: 'tiles', style: { marginTop: '6px', gridTemplateColumns: 'repeat(4,1fr)' } },
      this.tile('inf', '步', pct(a.mix.inf)), this.tile('cav', '骑', pct(a.mix.cav)), this.tile('gun', '火器', pct(a.mix.gun)), this.tile('navy', '水师', pct(a.mix.navy))));
    sec.append(h('div', { class: 'rows', style: { marginTop: '6px' } },
      h('div', { class: 'row' }, ic('target'), h('span', { class: 't' }, a.progress > 0 && a.path.length ? `${nodeName(a.location)} → ${nodeName(a.path[0])}` : nodeName(a.location)), h('b', null, '所在')),
      h('div', { class: 'row' }, ic('move'), h('span', { class: 't' }, armyOrderText(a.order)), h('b', null, a.path.length ? `${pathDays(a.location, a.path) - a.progress} 日` : '')),
      a.hunger ? h('div', { class: 'row mine' }, ic('grain'), h('span', { class: 't' }, '断粮'), h('b', { class: 'down' }, `${a.hunger} 月`)) : null));
    const pend = this.orders.find(o => (o.kind === 'army' || o.kind === 'command') && o.army === id);
    if (pend) sec.append(h('div', { class: 'row mine', style: { marginTop: '6px' } }, ic('appoint'), h('span', { class: 't' }, describeOrder(s, pend)), h('b', null, '已下令')));
    const A = (aid: string, icon: string, label: string, onclick: () => void, primary = false) => h('button', { class: 'act' + (primary ? ' primary' : ''), id: aid, onclick }, ic(icon), label);
    if (mine) {
      sec.append(h('div', { class: 'sec-title' }, ic('war'), '军令'));
      const acts = h('div', { class: 'acts' },
        A('act-move', 'move', '行军', () => this.beginTarget(id, `点选${a.name}要去的城`, n => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'move', target: n, attack: false } }))),
        A('act-attack', 'attack', '进攻', () => this.beginTarget(id, `点选${a.name}要攻的城`, n => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'move', target: n, attack: true } }))),
        A('act-hold', 'hold', '驻扎', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'hold' } })),
      );
      const here = s.cities[a.location];
      if (a.progress === 0 && here && hostile(s, s.player, here.controller)) {
        acts.append(A('act-assault', 'storm', '攻城', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: true } }), true),
          A('act-blockade', 'blockade', '围困', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: false } })));
      } else if (a.progress === 0 && here && here.controller === s.player) acts.append(A('act-reinforce', 'reinforce', '拨兵', () => this.formReinforce(id)));
      sec.append(acts);
    } else if (vassal) {
      sec.append(h('div', { class: 'sec-title' }, ic('urgent'), `号令 · 服从 ${f.loyalty}`));
      sec.append(meter(f.loyalty ?? 50, mcol(f.loyalty ?? 50)));
      sec.append(h('div', { class: 'acts', style: { marginTop: '8px' } },
        A('act-command-move', 'move', '开赴', () => this.beginTarget(id, `点选要${f.short}部去的城`, n => this.formCommand(id, { kind: 'move', target: n, attack: false }))),
        A('act-command-attack', 'attack', '进攻', () => this.beginTarget(id, `点选要${f.short}部攻的城`, n => this.formCommand(id, { kind: 'move', target: n, attack: true }))),
        A('act-command-hold', 'hold', '驻守', () => this.formCommand(id, { kind: 'hold' })),
        A('act-reward', 'reward', '犒赏', () => this.formReward(a.faction)),
      ));
    }
  }

  /* ================= 弹窗 ================= */
  modal(icon: string, title: string, sub: string, body: (HTMLElement | string | null)[], buttons: { label: string; icon?: string; primary?: boolean; id?: string; onclick: () => void | boolean }[]) {
    const m = clear($('#modal'));
    m.classList.remove('hidden');
    const dlg = h('div', { class: 'dialog hud', role: 'dialog' },
      h('div', { class: 'dh' }, h('div', { class: 'emb' }, ic(icon)), h('div', null, h('h2', null, title), sub ? h('small', null, sub) : null)),
      h('div', { class: 'db' }, ...body));
    if (buttons.length) {
      const foot = h('div', { class: 'df' });
      for (const b of buttons) foot.append(h('button', { class: 'btn' + (b.primary ? ' primary' : ''), id: b.id, onclick: () => { if (b.onclick() !== false) this.closeModal(); } }, b.icon ? ic(b.icon) : null, b.label));
      dlg.append(foot);
    }
    m.append(dlg);
    m.onclick = e => { if (e.target === m && buttons.length) this.closeModal(); };
    gsap.fromTo(dlg, { scale: 0.88, opacity: 0, y: 12 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.7)' });
    gsap.from(dlg.querySelectorAll('.opt, .gopt, .lrow, .slot, .tile'), { opacity: 0, y: 10, duration: 0.25, stagger: 0.03, delay: 0.1 });
    return dlg;
  }
  closeModal() { $('#modal').classList.add('hidden'); clear($('#modal')); }
  cancelBtn() { return { label: '取消', icon: 'close', onclick: () => {} }; }

  gauge(score: number, factors: string[], label: string, marks = ['抗命', '打折扣', '拖延', '照办']): HTMLElement {
    const v = Math.max(0, Math.min(100, score));
    return h('div', { class: 'gauge' },
      h('div', { class: 'gh' }, h('span', null, label), h('b', null, String(Math.round(score)))),
      h('div', { class: 'bar' }, h('i', { style: { left: v + '%' } })),
      h('div', { class: 'marks' }, ...marks.map(m => h('span', null, m))),
      h('div', { class: 'factors' }, ...factors.map(f => h('span', { class: 'factor ' + (/\+\d/.test(f) ? 'pos' : /[−-]\d/.test(f) ? 'neg' : '') }, f))));
  }

  formPolicy(node: string) {
    const s = this.s!, c = s.cities[node];
    const cur = (this.orders.find(o => o.kind === 'policy' && o.node === node) as any)?.policy ?? c.policy;
    const grid = h('div', { class: 'grid-opts' });
    for (const p of Object.keys(POLICY_NAME) as Policy[]) {
      grid.append(h('button', { class: 'gopt' + (p === cur ? ' on' : ''), 'data-policy': p, onclick: () => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'policy', node, policy: p }); } },
        ic(POLICY_ICON[p]), h('b', null, POLICY_NAME[p]), h('small', null, POLICY_HINT[p])));
    }
    this.modal('policy', '方针', `${nodeName(node)} · 持续执行`, [grid], [this.cancelBtn()]);
  }

  formRecruit(node: string) {
    const s = this.s!, c = s.cities[node];
    const left = recruitLeft(s, node);
    const max = Math.min(left, Math.floor((c.silver - this.pendingSpend(node, 'silver')) / RECRUIT_SILVER / 100) * 100);
    if (max < 100) { this.toast(left < 100 ? `${nodeName(node)}本月名额已满` : `${nodeName(node)}府库不足，募不到兵`, 'close'); return; }
    const input = h('input', { type: 'range', min: 100, max, step: 100, value: Math.min(max, 1000), id: 'recruit-n' }) as HTMLInputElement;
    const big = h('div', { class: 'big-num' });
    const costs = h('div', { class: 'costs' });
    const upd = () => {
      const n = +input.value;
      big.textContent = `${fmt(n)} 人`;
      clear(costs).append(
        h('span', { class: 'cost bad' }, ic('silver'), `−${fmt(n * RECRUIT_SILVER)}`),
        h('span', { class: 'cost bad' }, ic('pop'), `−${(n / 10000).toFixed(2)} 万`),
        h('span', { class: 'cost bad' }, ic('minxin'), `−${(n / 1500).toFixed(1)}`),
        h('span', { class: 'cost bad' }, ic('grain'), `每月 −${fmt(n * 0.25)}`),
        h('span', { class: 'cost good' }, ic('troops'), `驻军 +${fmt(n)}`));
    };
    input.oninput = upd; upd();
    this.modal('recruit', '募兵', `${nodeName(node)} · 本月剩余 ${fmt(left)} / 上限 ${fmt(maxRecruit(c))}`, [big, h('div', { class: 'field' }, input), costs],
      [this.cancelBtn(), { label: '募兵', icon: 'ok', primary: true, id: 'recruit-ok', onclick: () => { this.addOrder({ id: this.newOrderId(), kind: 'recruit', node, troops: +input.value }); } }]);
  }

  formTransfer(from: string, to?: string) {
    const s = this.s!;
    const targets = Object.values(s.cities).filter(c => c.id !== from && friendly(s, s.player, c.controller)).sort((a, b) => (NODE[a.id].area + a.id).localeCompare(NODE[b.id].area + b.id));
    const fromSel = h('select', { id: 'tr-from' }, ...Object.values(s.cities).filter(c => c.controller === s.player).map(c => h('option', { value: c.id, selected: c.id === from }, `${nodeName(c.id)}  粮${wan(c.grain)} 银${wan(c.silver)}`))) as HTMLSelectElement;
    const toSel = h('select', { id: 'tr-to' }, ...targets.map(c => h('option', { value: c.id, selected: c.id === to }, `${nodeName(c.id)} · ${s.factions[c.controller].short}`))) as HTMLSelectElement;
    const grain = h('input', { type: 'number', min: 0, step: 1000, value: 10000, id: 'tr-grain', style: { width: '130px' } }) as HTMLInputElement;
    const silver = h('input', { type: 'number', min: 0, step: 1000, value: 0, id: 'tr-silver', style: { width: '130px' } }) as HTMLInputElement;
    const status = h('div', { class: 'route-status', id: 'tr-status' });
    const updStatus = () => {
      const why = supplyBlock(s, s.player, fromSel.value, toSel.value);
      clear(status).append(ic(why ? 'close' : 'ok'), why ?? '粮道畅通，本月送达');
      status.className = 'route-status ' + (why ? 'bad' : 'good');
    };
    fromSel.onchange = updStatus; toSel.onchange = updStatus; updStatus();
    this.modal('transfer', '调拨钱粮', '沿驿路运送 · 被围之城送不进', [status,
      h('div', { class: 'field' }, h('label', null, ic('city'), '自'), fromSel), h('div', { class: 'field' }, h('label', null, ic('target'), '往'), toSel),
      h('div', { class: 'field' }, h('label', null, ic('grain'), '粮'), grain, h('span', { class: 'note' }, '石')), h('div', { class: 'field' }, h('label', null, ic('silver'), '银'), silver, h('span', { class: 'note' }, '两')),
      h('div', { class: 'note' }, '拨给下属能提高服从。'),
    ], [this.cancelBtn(), { label: '调拨', icon: 'ok', primary: true, id: 'tr-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'transfer', from: fromSel.value, to: toSel.value, grain: Math.max(0, +grain.value || 0), silver: Math.max(0, +silver.value || 0) }) }]);
  }

  freeChars(): Character[] {
    const s = this.s!;
    const busy = new Set([...Object.values(s.armies).map(a => a.commander), ...s.missions.map(m => (m.order as any).char)]);
    for (const o of this.orders) if ('char' in o) busy.add((o as any).char);
    return Object.values(s.chars).filter(c => c.faction === s.player && c.status === 'active' && !busy.has(c.id) && c.id !== s.factions[s.player].leader);
  }

  charPicker(list: Character[], key: 'zheng' | 'wai', onPick: (id: string) => void, extra?: (c: Character) => string): HTMLElement {
    const box = h('div', { class: 'list' });
    for (const c of list) box.append(h('button', { class: 'opt', 'data-char': c.id, onclick: () => onPick(c.id) },
      h('div', { class: 'coin', style: { background: '#7d1a12' } }, c.name.slice(0, 1)),
      h('div', { style: { flex: '1' } }, h('b', null, c.name), h('small', null, `${c.title} · 在${nodeName(c.location)}`)),
      h('span', { class: 'chipnum' }, extra ? extra(c) : `${key === 'zheng' ? '政' : '外'} ${c.ab[key]}`)));
    return box;
  }

  formAppoint(node: string) {
    const s = this.s!;
    const list = this.freeChars().filter(c => s.cities[node].governor !== c.id).sort((a, b) => b.ab.zheng - a.ab.zheng);
    if (!list.length) { this.toast('无人可用', 'close'); return; }
    const postOf = (id: string) => Object.values(s.cities).find(c => c.governor === id)?.id;
    this.modal('appoint', '任命主官', `${nodeName(node)} · 政务越高收入越多 · 现任他城主官者调任`, [this.charPicker(list, 'zheng', id => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'appoint', node, char: id }); }, c => { const p = postOf(c.id); return `政 ${c.ab.zheng}${p ? ` · 调离${nodeName(p)}` : ''}`; })], [this.cancelBtn()]);
  }

  formPersuade(node: string) {
    const s = this.s!;
    const list = this.freeChars().sort((a, b) => b.ab.wai - a.ab.wai);
    if (!list.length) { this.toast('无人可出使', 'close'); return; }
    const best = persuadeChance(s, s.player, list[0].id, node);
    this.modal('persuade', '遣使劝降', `${nodeName(node)} · 下月见分晓`, [
      this.gauge(best.p * 100, best.factors, `最佳人选成功率 %`, ['', '', '', '']),
      h('div', { class: 'sec-title' }, ic('person'), '选使者（右为成功率）'),
      this.charPicker(list, 'wai', id => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'persuade', char: id, node }); }, c => `${Math.round(persuadeChance(s, s.player, c.id, node).p * 100)}%`),
    ], [this.cancelBtn()]);
  }

  formEnvoy(target: string) {
    const s = this.s!;
    const list = this.freeChars().sort((a, b) => b.ab.wai - a.ab.wai);
    if (!list.length) { this.toast('无人可出使', 'close'); return; }
    const st = stance(s, s.player, target);
    let aim: 'alliance' | 'truce' | 'peace' = 'alliance';
    let who = list[0].id;
    const aims = h('div', { class: 'grid-opts' });
    const gaugeBox = h('div');
    const upd = () => {
      clear(aims);
      const opts: [typeof aim, string, string, string][] = [['alliance', 'envoy', '结盟', '各守其城'], ...(st === 'war' ? [['truce', 'hourglass', '停战', '六个月'], ['peace', 'ok', '议和', '罢兵']] as [typeof aim, string, string, string][] : [])];
      for (const [k, icon, label, sub] of opts) aims.append(h('button', { class: 'gopt' + (aim === k ? ' on' : ''), 'data-aim': k, onclick: () => { aim = k; upd(); } }, ic(icon), h('b', null, label), h('small', null, sub)));
      const r = envoyScore(s, s.player, { id: 'x', kind: 'envoy', char: who, target, aim });
      clear(gaugeBox).append(this.gauge(r.score, r.factors, '把握（需 55）', ['难', '', '可望', '稳']));
    };
    const pick = this.charPicker(list, 'wai', id => { who = id; pick.querySelectorAll('.opt').forEach(el => { (el as HTMLElement).style.borderColor = (el as HTMLElement).dataset.char === id ? 'var(--red-2)' : ''; }); upd(); });
    upd();
    this.modal('envoy', `遣使 · ${s.factions[target].short}`, `关系：${STANCE_NAME[st] ?? st}`, [aims, gaugeBox, h('div', { class: 'sec-title' }, ic('person'), '使者'), pick],
      [this.cancelBtn(), { label: '派遣', icon: 'ok', primary: true, id: 'ev-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'envoy', char: who, target, aim }) }]);
  }

  formCommand(army: string, order: ArmyOrder) {
    const s = this.s!;
    const a = s.armies[army], f = s.factions[a.faction];
    const silver = h('input', { type: 'range', min: 0, max: Math.min(60000, s.cities[s.factions[s.player].capital].silver), step: 2000, value: 0, id: 'cmd-silver' }) as HTMLInputElement;
    const big = h('div', { class: 'big-num', style: { fontSize: '22px' } });
    const est = h('div', { id: 'cmd-est' });
    const upd = () => {
      const r = obedience(s, s.player, { id: 'x', kind: 'command', vassal: a.faction, army, order, silver: +silver.value }, false);
      big.textContent = `犒银 ${fmt(+silver.value)} 两`;
      clear(est).append(this.gauge(r.score, r.factors, '服从（临事 ±10）'));
    };
    silver.oninput = upd; upd();
    this.modal('urgent', `号令${f.short}部`, `${a.name} · ${armyOrderText(order)}`, [est, big, h('div', { class: 'field' }, h('label', null, ic('silver'), '犒银'), silver)],
      [this.cancelBtn(), { label: '传令', icon: 'ok', primary: true, id: 'cmd-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'command', vassal: a.faction, army, order, silver: +silver.value }) }]);
  }

  formReward(vassal: string) {
    const s = this.s!;
    const cap = s.cities[s.factions[s.player].capital];
    const input = h('input', { type: 'range', min: 5000, max: Math.max(5000, Math.min(80000, cap.silver)), step: 5000, value: 20000 }) as HTMLInputElement;
    const big = h('div', { class: 'big-num' });
    const upd = () => { clear(big).append(`${fmt(+input.value)} 两 `, h('span', { class: 'up', style: { fontSize: '18px' } }, `服从 +${Math.min(15, Math.round(+input.value / 2500))}`)); };
    input.oninput = upd; upd();
    this.modal('reward', `犒赏${s.factions[vassal].short}部`, `当前服从 ${s.factions[vassal].loyalty}`, [big, h('div', { class: 'field' }, input)],
      [this.cancelBtn(), { label: '犒赏', icon: 'ok', primary: true, id: 'reward-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'reward', vassal, silver: +input.value }) }]);
  }

  formReinforce(army: string) {
    const s = this.s!;
    const a = s.armies[army], c = s.cities[a.location];
    const input = h('input', { type: 'range', min: -(c.garrison - 500), max: a.troops - 500, step: 500, value: 0 }) as HTMLInputElement;
    const big = h('div', { class: 'big-num', style: { fontSize: '22px' } });
    const upd = () => { const n = +input.value; big.textContent = n >= 0 ? `军 → 城  ${fmt(n)}` : `城 → 军  ${fmt(-n)}`; };
    input.oninput = upd; upd();
    this.modal('reinforce', '互拨兵员', `${a.name} ⇄ ${nodeName(a.location)}`, [big, h('div', { class: 'field' }, input)],
      [this.cancelBtn(), { label: '确定', icon: 'ok', primary: true, onclick: () => { if (+input.value) this.addOrder({ id: this.newOrderId(), kind: 'reinforce', node: a.location, army, troops: +input.value }); } }]);
  }

  /* ================= 势力 / 人物 ================= */
  openFactions() {
    const s = this.s!;
    const list = h('div', { class: 'list', id: 'faction-table' });
    for (const f of Object.values(s.factions)) {
      if (f.id === 'local' || f.defunct) continue;
      const cities = Object.values(s.cities).filter(c => c.controller === f.id).length;
      const troops = Object.values(s.armies).filter(a => a.faction === f.id).reduce((n, a) => n + a.troops, 0);
      const st = stance(s, s.player, f.id);
      const btn = f.id === s.player ? null : f.overlord === s.player ? h('button', { class: 'mini', onclick: () => { this.closeModal(); this.formReward(f.id); } }, ic('reward'), `服从 ${f.loyalty}`)
        : h('button', { class: 'mini', 'data-envoy': f.id, onclick: () => { this.closeModal(); this.formEnvoy(f.id); } }, ic('envoy'), '遣使');
      list.append(h('div', { class: 'lrow' },
        h('div', { class: 'coin', style: { background: f.color } }, POLITIES[f.polity].mark || f.short),
        h('div', { class: 'nm' }, h('b', null, f.name), h('small', null, `奉${POLITIES[f.polity].name} · ${cities} 城 · ${friendly(s, s.player, f.id) ? wan(troops) : roughTroops(troops)} 兵`)),
        h('span', { class: 'stance st-' + st }, STANCE_NAME[st] ?? st), btn));
    }
    const u = unificationProgress(s);
    this.modal('factions', '天下诸家', `统一进度 ${u.held} / ${u.total}`, [
      h('div', { class: 'progress' }, h('i', { style: { width: (u.held / u.total * 100) + '%' } })),
      h('div', { class: 'note' }, `计入统一：${VICTORY_AREAS.join(' · ')}`),
      h('div', { class: 'note' }, `尚存对手：${u.rivals.join('、') || '无'}`),
      h('div', { class: 'sec-title' }, ic('factions'), '诸家'), list,
    ], [{ label: '关闭', icon: 'close', onclick: () => {} }]);
  }

  openChars(group: 'mine' | 'vassal' | 'others' = 'mine') {
    const s = this.s!;
    const tabs = h('div', { class: 'tabs', style: { margin: '0 0 10px' } }, ...([['mine', 'chars', '本方'], ['vassal', 'urgent', '诸镇'], ['others', 'factions', '他方']] as const)
      .map(([k, icon, n]) => h('button', { class: 'tab' + (k === group ? ' on' : ''), onclick: () => { this.closeModal(); this.openChars(k); } }, ic(icon), n)));
    const list = Object.values(s.chars).filter(c => group === 'mine' ? c.faction === s.player : group === 'vassal' ? s.factions[c.faction]?.overlord === s.player : c.faction !== s.player && s.factions[c.faction]?.overlord !== s.player && s.factions[c.faction]?.leader === c.id);
    const box = h('div', { class: 'list' });
    for (const c of list) {
      const own = group !== 'others';
      const f = s.factions[c.faction];
      box.append(h('button', { class: 'opt', onclick: () => { this.closeModal(); this.openChar(c.id); } },
        h('div', { class: 'coin', style: { background: f?.color ?? '#555' } }, c.name.slice(0, 1)),
        h('div', { style: { flex: '1' } }, h('b', null, c.name, c.status !== 'active' ? (c.status === 'captured' ? ' · 被执' : ' · 已故') : ''), h('small', null, `${c.title} · ${nodeName(c.location)}`)),
        own ? h('span', { class: 'chipnum', title: '忠诚 / 降意' }, `忠${Math.round(c.att.loyalty)} 降${Math.round(c.att.surrender)}`) : h('span', { class: 'chipnum' }, `统${c.ab.tong}`)));
    }
    this.modal('chars', '人物', '点人物看能力与态度变化', [tabs, box], [{ label: '关闭', icon: 'close', onclick: () => {} }]);
  }

  openChar(id: string) {
    const s = this.s!;
    const c = s.chars[id];
    const f = s.factions[c.faction];
    const own = c.faction === s.player || f?.overlord === s.player;
    const body: HTMLElement[] = [
      h('div', { style: { display: 'flex', gap: '14px', alignItems: 'center' } }, h('div', { class: 'portrait', style: { background: f?.color ?? '#555' } }, c.name.slice(0, 1)),
        h('div', null, h('div', { class: 'tags', style: { marginTop: '0' } }, h('span', { class: 'tag' }, ic('factions'), f?.short ?? ''), h('span', { class: 'tag' }, ic('target'), nodeName(c.location)),
          c.status !== 'active' ? h('span', { class: 'tag' }, ic(c.status === 'captured' ? 'prisoner' : 'dead'), c.status === 'captured' ? '被执' : '已故') : null),
          h('div', { class: 'note' }, c.bio))),
      h('div', { class: 'abil' }, ...([['统军', c.ab.tong], ['政务', c.ab.zheng], ['谋略', c.ab.mou], ['外交', c.ab.wai], ['威望', c.ab.wang]] as const).map(([k, v]) => h('div', null, h('b', null, String(v)), h('small', null, k)))),
    ];
    if (own) {
      body.push(h('div', { class: 'tiles', style: { marginTop: '8px' } },
        this.tile('morale', '忠诚', String(Math.round(c.att.loyalty)), { meter: c.att.loyalty }),
        this.tile('prisoner', '降意', String(Math.round(c.att.surrender)), { meter: 100 - c.att.surrender }),
        this.tile('war', '主战', String(Math.round(c.att.hawk)))));
      const rows = h('div', { class: 'rows', id: 'att-log' });
      for (const l of [...c.attLog].reverse()) rows.append(h('div', { class: 'row' }, ic(l.field === 'loyalty' ? 'morale' : l.field === 'surrender' ? 'prisoner' : 'war'),
        h('span', { class: 't' }, `${shortDate(l.turn)} · ${l.reason}`), h('b', { class: (l.field === 'surrender' ? -l.delta : l.delta) >= 0 ? 'up' : 'down' }, `${{ loyalty: '忠', surrender: '降', hawk: '战' }[l.field]} ${signed(l.delta)}`)));
      body.push(h('div', { class: 'sec-title' }, ic('history'), '态度变化'), c.attLog.length ? rows : h('div', { class: 'note' }, '尚无'));
    }
    this.modal('person', c.name, c.title, body, [{ label: '关闭', icon: 'close', onclick: () => {} }]);
  }

  /* ================= 军情 ================= */
  toggleReport() { if ($('#report').classList.contains('hidden')) this.openReport(); else $('#report').classList.add('hidden'); }
  openReport(turn?: number) {
    const s = this.s!;
    if (turn !== undefined) this.reportTurn = turn;
    const t = this.reportTurn;
    const box = clear($('#report'));
    box.className = 'hud';
    const minTurn = Math.min(...s.reports.map(r => r.turn), s.turn - 1);
    const all = s.reports.filter(r => r.turn === t && (!r.faction || r.faction === s.player));
    const cats: [string, string][] = [['全部', 'report'], ['急报', 'urgent'], ['军报', 'war'], ['易主', 'capture'], ['内政', 'admin'], ['交涉', 'envoy'], ['史事', 'event'], ['线索', 'clue'], ['人事', 'person']];
    const count = (k: string) => k === '全部' ? all.length : k === '急报' ? all.filter(r => r.urgent || r.cat === '急报').length : all.filter(r => r.cat === k).length;
    if (this.reportTab !== '全部' && !count(this.reportTab)) this.reportTab = '全部';
    box.append(h('div', { class: 'top' },
      h('h2', null, ic('report'), t >= 0 ? `军情 · ${shortDate(t)}` : '军情',
        h('span', { class: 'nav' },
          h('button', { disabled: t <= minTurn, title: '上月', onclick: () => this.openReport(t - 1) }, '◀'),
          h('button', { disabled: t >= s.turn - 1, title: '下月', onclick: () => this.openReport(t + 1) }, '▶'),
          h('button', { title: '收起', onclick: () => box.classList.add('hidden') }, '✕'))),
      h('div', { class: 'summary' }, ...cats.filter(([k]) => k === '全部' || count(k)).map(([k, icon]) =>
        h('button', { class: 'filt' + (this.reportTab === k ? ' on' : ''), onclick: () => { this.reportTab = k; this.openReport(); } }, ic(icon), k, h('b', null, String(count(k))))))));
    const list = h('div', { class: 'entries', id: 'report-entries' });
    const shown = all.filter(r => this.reportTab === '全部' || r.cat === this.reportTab || (this.reportTab === '急报' && r.urgent))
      .sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
    for (const r of shown) list.append(this.reportCard(r));
    if (t < 0) list.append(h('div', { class: 'card' }, h('div', { class: 'cic c-史事' }, ic('event')), h('div', { class: 'body' }, h('div', { class: 'hl' }, '北京失守的消息传到南京'), h('div', { class: 'meta' }, '结束本月后，这里列出各地变化'))));
    box.append(list);
    gsap.from('#report .card', { opacity: 0, x: -24, duration: 0.3, stagger: 0.035, ease: 'power2.out' });
    gsap.from('#report .cic', { scale: 0.3, duration: 0.4, stagger: 0.035, ease: 'back.out(2)' });
  }

  reportCard(r: ReportEntry): HTMLElement {
    const { hl, more } = splitReport(r);
    const cat: ReportCat = r.urgent && r.cat !== '史事' && r.cat !== '线索' && r.cat !== '易主' && r.cat !== '军报' ? '急报' : r.cat;
    const moreEl = h('div', { class: 'more hidden' }, more);
    const btns = h('div', { class: 'btns' });
    if (r.node) btns.append(h('button', { class: 'mini locate', onclick: (e: Event) => { e.stopPropagation(); this.map.flyTo(r.node!, Math.max(this.map.cam.z, 2.2)); this.selectNode(r.node!); } }, ic('locate'), nodeName(r.node)));
    if (r.src?.kind === 'order' && r.src.ref) {
      const ref = r.src.ref;
      btns.append(h('button', { class: 'mini why', onclick: (e: Event) => {
        e.stopPropagation();
        const e2 = this.s!.ledger.find(l => l.src.ref === ref);
        if (e2) { this.map.flyTo(e2.node, Math.max(this.map.cam.z, 2.2)); this.map.view.selected = e2.node; this.cityTab = 'ledger'; this.renderCity(e2.node); this.toast(`源自 ${shortDate(e2.src.turn ?? e2.turn)} 你的命令：${nodeName(e2.node)}${e2.text}`, 'why'); }
      } }, ic('why'), '为什么'));
    }
    let hist: HTMLElement | null = null;
    if (r.history) {
      hist = h('div', { class: 'hist hidden' }, r.history);
      btns.append(h('button', { class: 'mini', onclick: (e: Event) => { e.stopPropagation(); hist!.classList.toggle('hidden'); } }, ic('history'), '史实'));
    }
    return h('div', { class: 'card entry' + (r.urgent ? ' urgent' : ''), onclick: () => moreEl.classList.toggle('hidden') },
      h('div', { class: `cic c-${cat}` }, ic(CAT_ICON[cat] ?? 'info')),
      h('div', { class: 'body' }, h('div', { class: 'hl' }, hl), h('div', { class: 'meta' }, r.cat, more ? h('span', { style: { marginLeft: 'auto', color: 'var(--gold-dim)' } }, '▾') : null), more ? moreEl : null, hist, btns.childNodes.length ? btns : null));
  }

  /** 每月开头的要闻：最多四条 */
  showSplash(): Promise<void> {
    return new Promise(resolve => {
      const s = this.s!;
      const t = this.reportTurn;
      const all = s.reports.filter(r => r.turn === t && (!r.faction || r.faction === s.player));
      const rank = (r: ReportEntry) => (r.urgent ? 0 : r.cat === '易主' ? 1 : r.cat === '史事' ? 2 : r.cat === '军报' ? 3 : 4);
      const top = [...all].sort((a, b) => rank(a) - rank(b)).slice(0, 4);
      const el = h('div', { id: 'splash' });
      const pol = POLITIES[s.factions[s.player].polity];
      const done = () => { el.remove(); resolve(); };
      const cards = h('div', { class: 'splash-cards' });
      top.forEach((r, i) => {
        const { hl } = splitReport(r);
        const cat: ReportCat = r.urgent && r.cat !== '史事' && r.cat !== '易主' && r.cat !== '军报' ? '急报' : r.cat;
        cards.append(h('div', { class: 'scard hud' + (r.urgent ? ' urgent' : ''), style: { animationDelay: (0.15 + i * 0.12) + 's' } },
          h('div', { class: `cic c-${cat}` }, ic(CAT_ICON[cat] ?? 'info')), h('div', null, h('div', { style: { color: 'var(--dim)', fontSize: '11.5px' } }, r.cat), h('b', null, hl))));
      });
      el.append(h('div', { class: 'splash-in' },
        h('div', { class: 'm' }, s.ended ? '本局终' : `${eraYear(pol, s.turn)}${monthName(lunarOf(s.turn))}`),
        h('div', { class: 'y' }, `上月要闻 · 共 ${all.length} 条`), cards,
        h('button', { class: 'btn primary splash-go', id: 'splash-go', onclick: done }, ic('report'), '查看军情')));
      el.onclick = e => { if (e.target === el) done(); };
      $('#app').append(el);
      gsap.from(el, { opacity: 0, duration: 0.3 });
      gsap.from('#splash .m', { opacity: 0, scale: 1.6, letterSpacing: '0.6em', duration: 0.7, ease: 'power3.out' });
      gsap.from('#splash .scard', { opacity: 0, y: 40, rotateY: -60, duration: 0.55, stagger: 0.14, delay: 0.25, ease: 'back.out(1.4)' });
      gsap.from('#splash .splash-go', { opacity: 0, y: 14, duration: 0.4, delay: 0.7 });
    });
  }

  /* ================= 月度推进 ================= */
  async endTurn() {
    if (!this.s || this.resolving || this.s.ended) return;
    this.resolving = true;
    this.closePanel();
    this.endTarget();
    $('#hint').classList.add('hidden');
    this.renderTop();
    const before = this.s;
    const gen = resolveMonth(before, this.orders);
    let r = gen.next();
    try {
      while (!r.done) {
        const it = r.value;
        let ans: Answer;
        if (it.type === 'battle') {
          const res = await playBattle(before, it.battle, it.side, this.autoBattle);
          ans = { type: 'battle', result: res.result, manual: res.manual };
        } else ans = { type: 'choice', index: await this.choose(it.choice) };
        r = gen.next(ans);
      }
    } catch (e) {
      console.error(e);
      this.toast('结算出错：' + (e as Error).message, 'close');
      this.resolving = false;
      this.renderTop();
      return;
    }
    this.s = r.value.state;
    this.orders = [];
    this.map.view.state = this.s;
    this.resolving = false;
    this.autoSave();
    this.reportTurn = this.s.turn - (this.s.ended ? 0 : 1);
    this.renderAll();
    const urgent = this.s.reports.some(x => x.turn === this.reportTurn && x.urgent && (!x.faction || x.faction === this.s!.player));
    if (urgent) alarm(); else chime();
    await this.showSplash();
    this.openReport();
    if (this.hintStep === 2) { this.hintStep = 3; this.showHint(); }
    if (this.s.ended) this.showEnd();
  }

  choose(c: PendingChoice): Promise<number> {
    return new Promise(resolve => {
      const m = clear($('#modal'));
      m.classList.remove('hidden');
      m.onclick = null;
      const opts = h('div', { class: 'opts' });
      c.options.forEach((o, i) => opts.append(h('button', { class: 'opt', 'data-choice': i, onclick: () => { this.closeModal(); resolve(i); } }, h('span', { class: 'num' }, String(i + 1)), h('div', null, h('b', null, o.label), h('small', null, o.desc)))));
      m.append(h('div', { class: 'dialog hud', role: 'dialog' },
        h('div', { class: 'dh' }, h('div', { class: 'emb' }, ic('event')), h('div', null, h('h2', null, c.title), h('small', null, '史事 · 朝廷决断'))),
        h('div', { class: 'db' }, h('div', { class: 'lead' }, c.text), opts)));
      gsap.fromTo('#modal .dialog', { scale: 0.85, opacity: 0, rotateX: 20 }, { scale: 1, opacity: 1, rotateX: 0, duration: 0.45, ease: 'back.out(1.6)' });
      gsap.from('#modal .opt', { opacity: 0, x: -30, duration: 0.35, stagger: 0.1, delay: 0.2, ease: 'power3.out' });
    });
  }

  showEnd() {
    const s = this.s!;
    const u = unificationProgress(s);
    const myBattles = s.battles.filter(b => this.isMineOrVassal(b.attacker) || this.isMineOrVassal(b.defender));
    const kind = s.ended!.kind;
    const troops = Object.values(s.cities).filter(c => c.controller === s.player).reduce((n, c) => n + c.garrison, 0) + Object.values(s.armies).filter(a => a.faction === s.player).reduce((n, a) => n + a.troops, 0);
    this.modal(kind === 'unified' ? 'crown' : kind === 'fallen' ? 'dead' : 'hourglass', kind === 'trial_end' ? '试玩结束' : kind === 'unified' ? '天下一统' : kind === 'fallen' ? '覆亡' : '天下未定', s.ended!.text, [
      h('div', { class: 'tiles' },
        this.tile('city', '主要城池', `${u.held}/${u.total}`),
        this.tile('battle', '参与战斗', String(myBattles.length)),
        this.tile('event', '史事线索', String(s.events.length)),
        this.tile('siege', '扬州', s.cities.yangzhou.controller === s.player ? (s.sieges.yangzhou ? '被围' : '在手') : '已失'),
        this.tile('city', '南京', s.cities.nanjing.controller === s.player ? '无恙' : '已失'),
        this.tile('troops', '直辖兵', wan(troops))),
      h('div', { class: 'note' }, kind === 'trial_end' ? '可继续推进；史事只编到乙酉四月。' : kind === 'fallen' ? '本局已覆亡，可读取更早的存档重来。' : '本局已终，可回看军情或读取存档。'),
    ], [
      { label: '回到标题', icon: 'exit', onclick: () => this.showTitle() },
      ...(kind !== 'trial_end' ? [] : [{ label: '继续推进', icon: 'next', primary: true, id: 'end-continue', onclick: () => {
        if (this.s !== s || !s.ended) return; // 只能前进一次
        delete s.ended; s.turnLimit = undefined; s.turn++;
        this.autoSave();
        this.renderAll();
      } }]),
    ]);
  }

  /* ================= 图例 ================= */
  toggleLegend(force?: boolean) {
    const el = $('#legend');
    const show = force ?? el.classList.contains('hidden');
    el.classList.toggle('hidden', !show);
    if (show) {
      const sw = (cls: string) => h('i', { class: 'sw ' + cls });
      const row = (sample: HTMLElement, b: string, t: string) => h('div', { class: 'lg-row' }, sample, h('div', null, h('b', null, b), h('small', null, t)));
      clear(el).append(
        h('div', { class: 'lg-h' }, ic('map'), h('b', null, '图例'), h('button', { class: 'x', 'aria-label': '关闭', onclick: () => this.toggleLegend(false) }, ic('close'))),
        row(sw('emb'), '城池', '底座颜色 = 实际控制者；旗上字 = 所奉政权'),
        row(sw('tint'), '控制范围示意', '按离城远近自动划分，不是考据过的府县辖境'),
        row(sw('solid'), '实线', '不同政权之间'),
        row(sw('dash'), '虚线', '同一政权下，不同军镇或官府之间'),
        row(sw('q'), '归属待考', '开局归属尚无定论，点城可看考据说明'),
        row(sw('siege'), '被围', '城外有敌军围困，钱粮送不进也运不出'),
        row(sw('road'), '驿路', '陆路行军与运粮'),
        row(sw('sea'), '海路', '有水师方可通行'),
        h('div', { class: 'note' }, '海岸、山川、河道依据真实地理数据；疆界只是示意。'),
      );
      gsap.from(el, { opacity: 0, y: -10, duration: 0.25 });
    }
    if (this.s) this.renderTop();
  }

  /* ================= 存读档 ================= */
  saveLabel(s: GameState) { return `${s.factions[s.player].short} · ${dateLabel(POLITIES[s.factions[s.player].polity], s.turn)}`; }
  openSaves(fromTitle: boolean) {
    const rows: HTMLElement[] = [];
    for (const slot of SLOTS) {
      const f = loadFrom(this.kv, slot);
      rows.push(h('div', { class: 'slot' }, ic(slot === 'auto' ? 'auto' : 'save'), h('div', { class: 'nm' }, h('b', null, slot === 'auto' ? '自动存档' : `存档 ${slot}`), h('small', null, f ? `${f.label} · ${new Date(f.savedAt).toLocaleString('zh-CN')}` : '空')),
        !fromTitle && slot !== 'auto' && this.s ? h('button', { class: 'mini', 'data-save': slot, onclick: () => this.saveSlot(slot as Slot) }, ic('save'), '存入') : null,
        f ? h('button', { class: 'mini', 'data-load': slot, onclick: () => { this.closeModal(); this.start(f.state, false); this.toast('已读取：' + f.label, 'load'); } }, ic('load'), '读取') : null));
    }
    const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async (e: Event) => {
      const fl = (e.target as HTMLInputElement).files?.[0]; if (!fl) return;
      try { const f = deserialize(await fl.text()); this.closeModal(); this.start(f.state, false); this.toast('已导入：' + f.label, 'load'); } catch (err) { this.toast('导入失败：' + (err as Error).message, 'close'); }
    } }) as HTMLInputElement;
    this.modal('save', '存档', '月与月之间存档 · 跨月行动照常保存', [...rows, file], [
      ...(this.s && !fromTitle ? [{ label: '导出', icon: 'transfer', onclick: () => { this.exportSave(); return false; } }] : []),
      { label: '导入', icon: 'load', onclick: () => { file.click(); return false; } },
      { label: '关闭', icon: 'close', onclick: () => {} },
    ]);
  }
  saveSlot(slot: Slot) {
    if (this.resolving) return;
    if (this.orders.length) this.toast('本月未结束的命令不会存入', 'info');
    if (!saveTo(this.kv, slot, this.s!, this.saveLabel(this.s!))) { this.saveFailed(`存档 ${slot}`); return; }
    this.toast(`已存入存档 ${slot}`, 'save');
    this.closeModal();
    this.openSaves(false);
  }
  autoSave() {
    if (!this.s) return;
    if (!saveTo(this.kv, 'auto', this.s, this.saveLabel(this.s))) this.saveFailed('自动存档');
  }
  /** 写入失败：旧档保留，提示本次未保存，给出导出文件的入口 */
  saveFailed(what: string) {
    const el = h('div', { class: 'hud warn', id: 'save-fail', style: { pointerEvents: 'auto' } }, ic('close'),
      `${what}未能保存（浏览器存储已满或被禁用），原有存档未改动。`,
      h('button', { class: 'mini', id: 'save-fail-export', onclick: () => { this.exportSave(); el.remove(); } }, ic('transfer'), '导出为文件'),
      h('button', { class: 'mini', onclick: () => el.remove() }, '知道了'));
    $('#save-fail')?.remove();
    $('#toast').append(el);
    gsap.from(el, { y: -16, opacity: 0, duration: 0.3 });
  }
  exportSave() {
    const blob = new Blob([serialize(this.s!, this.saveLabel(this.s!))], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `南明存档-${shortDate(this.s!.turn)}.json` }) as HTMLAnchorElement;
    document.body.append(a); a.click(); a.remove();
  }
  confirmTitle() {
    this.modal('exit', '回到标题', '进度每月自动存档', [], [this.cancelBtn(), { label: '回到标题', icon: 'exit', primary: true, id: 'title-ok', onclick: () => this.showTitle() }]);
  }

  openAbout() {
    const step = (icon: string, title: string, text: string) => h('div', { class: 'lrow' }, h('div', { class: 'coin', style: { background: '#7d1a12' } }, ic(icon)), h('div', { class: 'nm' }, h('b', null, title), h('small', null, text)));
    this.modal('help', '玩法', '一月一回合', [h('div', { class: 'list' },
      step('city', '点城池', '看实控、所奉、驻军、钱粮'),
      step('policy', '下命令', '方针 · 募兵 · 调拨 · 任命 · 劝降'),
      step('army', '点军旗', '行军、进攻、攻城；下属要“号令”'),
      step('next', '结束本月', '各方同时行动，生成军情'),
      step('war', '战斗', '三路下令，可用计策，也可交给部将'),
      step('why', '钱粮来由', '每笔变化都有出处，红框是你的命令'),
      step('event', '史事 · 线索', '合乎史实时触发，影响人物态度'),
    ), h('div', { class: 'note' }, '一尾小石斑 作。图标 game-icons.net（CC BY 3.0）；底图 Natural Earth（公有领域）；地形高程 AWS Terrain Tiles（SRTM、ETOPO1、GEBCO 等公开数据）；字体 Noto Serif SC、Ma Shan Zheng（OFL）。')],
    [{ label: '开始', icon: 'ok', primary: true, onclick: () => {} }]);
  }

  /* ================= 新手提示 ================= */
  showHint() {
    const el = $('#hint');
    if (!this.s) return;
    const steps = [
      ['city', '点一下南京', '你的都城：看谁控制、驻军多少。'],
      ['policy', '下一道命令', '右侧点“方针”或“募兵”；也可点军旗调兵。'],
      ['next', '结束本月', '点右上角红色按钮，各方行动。'],
      ['report', '读军情', '点地名回到出事的城；“钱粮来由”看每笔账。'],
    ];
    if (this.hintStep >= steps.length) { el.classList.add('hidden'); return; }
    const [icon, title, text] = steps[this.hintStep];
    clear(el);
    el.className = 'hud';
    el.append(ic(icon), h('div', null, h('div', { class: 'step' }, `新手 ${this.hintStep + 1}/4`), h('p', null, title), h('div', { class: 'note', style: { marginTop: '-4px', marginBottom: '8px' } }, text),
      h('button', { onclick: () => { this.hintStep = 9; try { localStorage.setItem(HINT_KEY, '9'); } catch { /* ignore */ } el.classList.add('hidden'); } }, '不再提示')));
    el.style.left = '50%'; el.style.top = '86px'; el.style.transform = 'translateX(-50%)';
    if (this.hintStep === 3) try { localStorage.setItem(HINT_KEY, '4'); } catch { /* ignore */ }
    el.classList.remove('hidden');
  }
}

function sameTarget(a: Order, b: Order): boolean {
  switch (a.kind) {
    case 'policy': return (b as any).node === a.node;
    case 'army': return (b as any).army === a.army;
    case 'command': return (b as any).army === a.army;
    case 'appoint': return (b as any).node === a.node;
    default: return false;
  }
}
const pct = (v: number) => Math.round(v * 100) + '%';
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
