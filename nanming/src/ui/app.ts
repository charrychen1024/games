/* 界面主控：地图、顶栏、城池详情、月报、命令、存读档、月度推进。 */
import type { GameState, Order, NodeId, ArmyOrder, Policy, ReportEntry, LedgerEntry, Character } from '../core/types';
import { MapRenderer, nodePt } from '../render/map';
import { h, $, clear, fmt, wan, signed } from './dom';
import { playBattle } from './battle';
import { chime, alarm, click, isMuted, setMuted } from './audio';
import { resolveMonth, unificationProgress, type Answer } from '../core/turn';
import { dateLabel, shortDate, lunarOf } from '../core/calendar';
import { POLITIES } from '../data/factions';
import { NODE, VICTORY_AREAS, shortestPath, pathDays, NODES } from '../data/geography';
import { friendly, hostile, topOf, stance, troopsText, roughTroops, nodeName, charName } from '../core/state';
import { POLICY_NAME, POLICY_HINT, monthlyIncome, upkeepOf, RECRUIT_SILVER } from '../core/economy';
import { describeOrder, validateOrder, maxRecruit, obedience, persuadeChance, envoyScore, armyOrderText, ORDER_LABEL } from '../core/orders';
import { browserKV, saveTo, loadFrom, serialize, deserialize, SLOTS, type Slot } from '../core/save';
import { trialState, yangzhouSiegeState } from '../data/presets';
import { canSea } from '../core/military';
import type { PendingChoice } from '../core/events';

const STANCE_NAME: Record<string, string> = { war: '交战', neutral: '未战', truce: '停战', alliance: '同盟', overlord: '上级', vassal: '下属', self: '本方' };
const FIELD_NAME: Record<string, string> = { grain: '仓粮', silver: '府库', pop: '人口', minxin: '民心', garrison: '驻军', wall: '城防', order: '吏治', agri: '农业', commerce: '商业', edu: '文教' };
const HINT_KEY = 'nanming:hint';

export class App {
  s: GameState | null = null;
  orders: Order[] = [];
  map: MapRenderer;
  kv = browserKV();
  seq = 0;
  resolving = false;
  reportTurn = -1;
  reportTab = '全部';
  autoBattle = false;
  hintStep = 0;
  targetCb: ((node: NodeId) => void) | null = null;
  drag: { x: number; y: number; moved: boolean } | null = null;

  constructor() {
    const canvas = $('#map') as HTMLCanvasElement;
    this.map = new MapRenderer(canvas);
    this.map.resize();
    window.addEventListener('resize', () => this.map.resize());
    this.bindMap(canvas);
    window.addEventListener('keydown', e => this.onKey(e));
    try { this.hintStep = Number(localStorage.getItem(HINT_KEY) ?? 0); } catch { this.hintStep = 0; }
    const loop = (t: number) => { this.map.render(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    this.showTitle();
    (window as any).NM = this; // 调试与自动化测试入口
    (window as any).NM_nodePt = nodePt;
  }

  /* ================= 开局 / 标题 ================= */
  showTitle() {
    const t = $('#title');
    t.classList.remove('gone');
    clear(t);
    const auto = loadFrom(this.kv, 'auto');
    const card = h('div', { class: 'title-card paper' },
      h('h1', null, '南', h('span', null, '明')),
      h('div', { class: 'sub' }, '甲申以后 · 一六四四—一六六二'),
      h('p', { class: 'prologue' }, '北京失守的消息传到南京。崇祯帝殉国，大顺军与清军先后入京。江南诸臣拥立福王朱由崧即位于南京，号令出于留都，兵权却在江北诸镇之手。'),
      h('div', { class: 'menu' },
        h('button', { class: 'primary', id: 'btn-new', onclick: () => this.start(trialState(Date.now() % 100000), true) }, '新开局：弘光朝廷', h('small', null, '十二回合试玩 · 自甲申五月至乙酉四月 · 其余四家由电脑行动')),
        h('button', { id: 'btn-sample', onclick: () => this.start(yangzhouSiegeState(), false, 'yangzhou') }, '地图样稿：乙酉四月 · 扬州被围', h('small', null, '同一局势下的全国总览与被围城池详情')),
        auto ? h('button', { id: 'btn-continue', onclick: () => this.start(auto.state, false) }, '继续游戏', h('small', null, `自动存档：${auto.label}`)) : null,
        h('button', { onclick: () => this.openSaves(true) }, '读取存档', h('small', null, '三个存档位，可导入存档文件')),
        h('button', { onclick: () => this.openAbout() }, '玩法说明', h('small', null, '一月一回合 · 城池经营 · 用兵 · 交涉')),
      ),
      h('div', { class: 'credit' }, '作者：一尾小石斑 · 地图底图据 Natural Earth（公有领域）· 画面与声音由代码生成'),
    );
    t.append(card);
  }

  start(state: GameState, fresh: boolean, focus?: string) {
    this.s = state;
    this.orders = [];
    this.seq = 0;
    this.reportTurn = state.turn - 1;
    $('#title').classList.add('gone');
    this.map.view.state = state;
    this.map.view.selected = null;
    this.map.view.selectedArmy = null;
    this.map.focus(focus ?? state.factions[state.player].capital, focus ? 2.2 : 1.6);
    this.renderAll();
    if (focus) this.selectNode(focus);
    if (fresh && this.hintStep < 4) { this.hintStep = 0; this.showHint(); }
    else if (state.reports.some(r => r.turn === state.turn - 1)) this.openReport();
    if (fresh) saveTo(this.kv, 'auto', state, this.saveLabel(state));
  }

  /* ================= 地图交互 ================= */
  bindMap(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', e => { this.drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener('pointermove', e => {
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
        const a = this.s!.armies[this.map.view.targeting.army];
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
    tip.className = 'paper';
    if (p.kind === 'node') {
      const c = s.cities[p.id], n = NODE[p.id];
      const known = this.known(p.id);
      tip.append(h('b', null, n.name), h('span', null, `  ${n.title ?? ''}`), h('br'),
        `实控：${s.factions[c.controller].name} · 奉${POLITIES[s.factions[c.controller].polity].name}`, h('br'),
        `驻军：${known ? troopsText(c.garrison) : roughTroops(c.garrison)} · 城防 ${Math.round(c.wall)}`);
      if (s.sieges[p.id]) tip.append(h('br'), h('b', { style: { color: '#a8261b' } }, `被${s.factions[s.sieges[p.id].attacker].name}围困（第 ${s.sieges[p.id].months} 月）`));
      if (this.map.view.targeting?.path) {
        const a = s.armies[this.map.view.targeting.army];
        tip.append(h('br'), `行程约 ${pathDays(a.location, this.map.view.targeting.path)} 日`);
      }
    } else {
      const a = s.armies[p.id];
      const mine = this.isMineOrVassal(a.faction);
      tip.append(h('b', null, a.name), h('br'), `${s.factions[a.faction].name} · 主将 ${charName(s, a.commander)}`, h('br'),
        `兵力 ${mine ? troopsText(a.troops) : roughTroops(a.troops)} · 士气 ${mine ? Math.round(a.morale) : '不详'}`, h('br'), armyOrderText(a.order));
    }
    tip.classList.remove('hidden');
    tip.style.left = Math.min(window.innerWidth - 290, x + 14) + 'px';
    tip.style.top = Math.min(window.innerHeight - 120, y + 14) + 'px';
  }
  hideTip() { $('#tooltip').classList.add('hidden'); }

  beginTarget(army: string, text: string, cb: (node: NodeId) => void) {
    this.map.view.targeting = { army, path: null };
    this.targetCb = cb;
    ($('#map') as HTMLCanvasElement).classList.add('targeting');
    this.toast(text + '（Esc 取消）');
  }
  endTarget() {
    this.map.view.targeting = null;
    this.targetCb = null;
    ($('#map') as HTMLCanvasElement).classList.remove('targeting');
  }

  /* ================= 工具 ================= */
  isMine(f: string) { return f === this.s!.player; }
  isMineOrVassal(f: string) { return f === this.s!.player || topOf(this.s!, f) === this.s!.player && this.s!.factions[f]?.overlord === this.s!.player; }
  /** 已知情报：己方、下属与盟友的城看得清，其余只有约数 */
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
    // 同一对象的同类命令只保留最新一道
    this.orders = this.orders.filter(x => !(x.kind === o.kind && sameTarget(x, o)));
    const err = validateOrder(s, s.player, o);
    if (err) { this.toast('不能下这道命令：' + err); return false; }
    this.orders.push(o);
    click();
    this.toast('已加入本月命令：' + describeOrder(s, o));
    this.renderOrders(); this.renderTop(); this.refreshPanel();
    if (this.hintStep === 1) { this.hintStep = 2; this.showHint(); }
    return true;
  }
  removeOrder(id: string) { this.orders = this.orders.filter(o => o.id !== id); this.renderOrders(); this.renderTop(); this.refreshPanel(); }

  toast(text: string) {
    const el = h('div', { class: 'paper' }, text);
    $('#toast').append(el);
    setTimeout(() => el.remove(), 3300);
  }

  /* ================= 渲染 ================= */
  renderAll() { this.renderTop(); this.renderOrders(); this.refreshPanel(); this.updatePlanned(); }

  renderTop() {
    const s = this.s!;
    const top = clear($('#topbar'));
    const me = s.factions[s.player];
    const pol = POLITIES[me.polity];
    const cap = s.cities[me.capital];
    const own = Object.values(s.cities).filter(c => c.controller === s.player);
    const troops = own.reduce((n, c) => n + c.garrison, 0) + Object.values(s.armies).filter(a => a.faction === s.player).reduce((n, a) => n + a.troops, 0);
    const limit = s.turnLimit;
    top.append(
      h('div', { class: 'seal', title: me.name }, pol.mark || me.short),
      h('div', { class: 'date' }, h('b', { id: 'date-label' }, dateLabel(pol, s.turn)), h('small', null, `${me.name} · ${shortDate(s.turn)}${s.scenario === 'trial' && limit ? ` · 试玩第 ${s.turn + 1}/${limit} 月` : s.scenario === 'yangzhou' ? ' · 地图样稿' : ''}`)),
      h('div', { class: 'res' },
        h('span', null, `${nodeName(me.capital)}府库 `, h('b', null, wan(cap.silver - this.pendingSpend(me.capital, 'silver'))), ' 两'),
        h('span', null, '仓粮 ', h('b', null, wan(cap.grain - this.pendingSpend(me.capital, 'grain'))), ' 石'),
        h('span', null, '直辖 ', h('b', null, String(own.length)), ' 城'),
        h('span', null, '兵 ', h('b', null, wan(troops))),
      ),
      h('div', { class: 'spacer' }),
      h('button', { class: 'tb-btn', id: 'btn-report', onclick: () => this.toggleReport() }, '月报'),
      h('button', { class: 'tb-btn', id: 'btn-factions', onclick: () => this.openFactions() }, '势力'),
      h('button', { class: 'tb-btn', id: 'btn-chars', onclick: () => this.openChars() }, '人物'),
      h('button', { class: 'tb-btn', id: 'btn-save', onclick: () => this.openSaves(false) }, '存档'),
      h('button', { class: 'tb-btn', title: '战斗由部将自动结算或亲自指挥', onclick: () => { this.autoBattle = !this.autoBattle; this.renderTop(); } }, this.autoBattle ? '战斗：自动' : '战斗：亲征'),
      h('button', { class: 'tb-btn', title: '声音', onclick: () => { setMuted(!isMuted()); this.renderTop(); } }, isMuted() ? '静音' : '有声'),
      h('button', { class: 'tb-btn', onclick: () => this.confirmTitle() }, '标题'),
      h('button', { class: 'next-btn', id: 'btn-next', disabled: this.resolving || !!s.ended, onclick: () => void this.endTurn() },
        s.ended ? '本局已结束' : this.resolving ? '各方行动中…' : `颁令 · 进入下月${this.orders.length ? `（${this.orders.length}）` : ''}`),
    );
  }

  renderOrders() {
    const box = clear($('#orders'));
    if (!this.s || !this.orders.length) return;
    box.append(h('div', { class: 'order-head' }, `本月命令 ${this.orders.length} 道 · 进入下月时一并执行`));
    for (const o of this.orders) {
      box.append(h('div', { class: 'order paper' }, h('span', { class: 'tag' }, ORDER_LABEL[o.kind]), describeOrder(this.s, o),
        h('button', { title: '撤销', onclick: () => this.removeOrder(o.id) }, '×')));
    }
  }

  updatePlanned() {
    const s = this.s!;
    const planned: { army: string; path: string[] }[] = [];
    for (const o of this.orders) {
      const ord = o.kind === 'army' ? o.order : o.kind === 'command' ? o.order : null;
      const id = o.kind === 'army' || o.kind === 'command' ? o.army : null;
      if (!ord || !id || ord.kind === 'hold') continue;
      const a = s.armies[id];
      const p = shortestPath(a.location, ord.target, canSea(a));
      if (p) planned.push({ army: id, path: p });
    }
    this.map.view.planned = planned;
  }

  /* ---------- 城池详情 ---------- */
  selectNode(id: string) {
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

  renderCity(id: string) {
    const s = this.s!;
    const c = s.cities[id], n = NODE[id];
    const panel = clear($('#panel'));
    panel.classList.remove('hidden');
    panel.className = 'paper';
    const ctrl = s.factions[c.controller];
    const pol = POLITIES[ctrl.polity];
    const known = this.known(id);
    const mine = c.controller === s.player;
    const vassal = !mine && ctrl.overlord === s.player;
    panel.append(h('button', { class: 'close', title: '关闭（Esc）', onclick: () => this.closePanel() }, '×'));
    panel.append(h('h2', { id: 'city-name' }, n.name, h('small', null, n.title ?? '')));
    const gov = c.governor ? s.chars[c.governor] : undefined;
    panel.append(h('dl', { class: 'allegiance' },
      h('dt', null, '实际控制'), h('dd', { id: 'city-controller' }, h('span', { class: 'chip', style: { background: ctrl.color } }, ctrl.name), vassal ? h('small', { style: { marginLeft: '6px', color: '#7d6b55' } }, `奉你号令 · 服从 ${ctrl.loyalty}`) : null),
      h('dt', null, '所奉政权'), h('dd', { id: 'city-polity' }, pol.mark ? `${pol.name}（旗书“${pol.mark}”）` : '无所奉'),
      h('dt', null, '主官'), h('dd', null, gov && gov.status === 'active' && gov.faction === c.controller ? h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); this.openChar(gov.id); } }, `${gov.name}（${gov.title}）`) : '空缺'),
      h('dt', null, '驻军'), h('dd', { id: 'city-garrison' }, known ? `${fmt(c.garrison)} 人` : `${roughTroops(c.garrison)}（情报）`),
      h('dt', null, '城防'), h('dd', null, `${Math.round(c.wall)} / 100`),
    ));
    if (c.uncertain) panel.append(h('div', { class: 'uncertain' }, '考据：' + c.uncertain));
    if (n.note) panel.append(h('div', { class: 'note' }, n.note));
    // 围城
    const sg = s.sieges[id];
    if (sg) {
      const att = sg.armies.map(a => s.armies[a]).filter(Boolean);
      const total = att.reduce((m, a) => m + a.troops, 0);
      panel.append(h('div', { class: 'siege-box', id: 'siege-box' },
        h('b', null, `被围 · 第 ${sg.months} 月`), h('br'),
        `城外：${s.factions[sg.attacker].name} ${att.map(a => `${charName(s, a.commander)}（${a.name}）`).join('、')}，${this.isMineOrVassal(sg.attacker) ? troopsText(total) : roughTroops(total)}。`, h('br'),
        `城内：守军 ${known ? fmt(c.garrison) : roughTroops(c.garrison)}，仓粮${known ? ` ${fmt(c.grain)} 石，约够 ${Math.max(0, Math.floor(c.grain / Math.max(1, upkeepOf(s, c).grain)))} 个月` : '不详'}。`,
        h('div', { class: 'note' }, mine ? '可派兵增援：选中一支军队，令其开赴此城，抵达后与围城之敌野战。' : '只有城破、献城或正式归附，城池才会易主。')));
    }
    // 城下军队
    const here = Object.values(s.armies).filter(a => a.location === id && a.progress === 0);
    if (here.length) {
      panel.append(h('h3', null, '城下军队', h('small', null, '点选可查看与下令')));
      for (const a of here) panel.append(this.armyRow(a.id));
    }
    // 钱粮
    if (known) {
      const last = s.turn - 1;
      const inc = monthlyIncome(s, c), up = upkeepOf(s, c);
      panel.append(h('h3', null, '钱粮', h('small', null, last >= 0 && s.ledger.some(e => e.turn === last && e.node === id) ? `上月（${shortDate(last)}）变化` : '本月预计')));
      panel.append(h('div', { class: 'stats' },
        h('div', null, '仓粮', h('b', { id: 'city-grain' }, `${fmt(c.grain - this.pendingSpend(id, 'grain'))} 石`)),
        h('div', null, '府库', h('b', { id: 'city-silver' }, `${fmt(c.silver - this.pendingSpend(id, 'silver'))} 两`)),
        h('div', null, '月入粮', h('b', null, fmt(inc.grain))), h('div', null, '月入银', h('b', null, fmt(inc.silver + inc.trade))),
        h('div', null, '月耗粮', h('b', null, fmt(up.grain))), h('div', null, '月耗银', h('b', null, fmt(up.silver))),
      ));
      panel.append(this.ledgerView(id, last));
    } else {
      panel.append(h('h3', null, '情报'), h('div', { class: 'note' }, `钱粮不详。人口约 ${Math.round(c.pop)} 万，民心${c.minxin > 60 ? '尚稳' : c.minxin > 40 ? '浮动' : '离散'}。`));
    }
    // 长期指标
    if (known) {
      const d = (f: LedgerEntry['field']) => { const v = s.ledger.filter(e => e.turn === s.turn - 1 && e.node === id && e.field === f).reduce((m, e) => m + e.delta, 0); return v ? h('span', { class: v > 0 ? 'delta-up' : 'delta-down' }, ' ' + signed(v)) : ''; };
      const det = h('details', null, h('summary', null, h('b', null, '长期指标'), h('small', { style: { color: '#7d6b55' } }, ' 人口 · 民心 · 吏治 · 农商 · 文教')));
      det.append(h('div', { class: 'stats', style: { marginTop: '6px' } },
        h('div', null, '人口', h('b', null, `${c.pop.toFixed(1)} 万`, d('pop'))), h('div', null, '民心', h('b', null, String(Math.round(c.minxin)), d('minxin'))),
        h('div', null, '吏治', h('b', null, String(Math.round(c.order)), d('order'))), h('div', null, '农业', h('b', null, String(Math.round(c.agri)), d('agri'))),
        h('div', null, '商业', h('b', null, String(Math.round(c.commerce)), d('commerce'))), h('div', null, '文教', h('b', null, String(Math.round(c.edu)), d('edu'))),
      ));
      det.append(h('div', { class: 'note' }, '人口影响赋税与兵源；战乱和征发损伤民心；文教影响长期人才；粮饷约束驻军与远征。'));
      panel.append(det);
    }
    // 命令
    if (mine) {
      panel.append(h('h3', null, '本城事务', h('small', null, `方针：${POLICY_NAME[c.policy]}`)));
      const sel = h('select', { id: 'policy-select', onchange: (e: Event) => {
        const v = (e.target as HTMLSelectElement).value as Policy;
        this.addOrder({ id: this.newOrderId(), kind: 'policy', node: id, policy: v });
      } }) as HTMLSelectElement;
      const pend = this.orders.find(o => o.kind === 'policy' && o.node === id) as Extract<Order, { kind: 'policy' }> | undefined;
      for (const p of Object.keys(POLICY_NAME) as Policy[]) sel.append(h('option', { value: p, selected: (pend?.policy ?? c.policy) === p }, `${POLICY_NAME[p]} — ${POLICY_HINT[p]}`));
      panel.append(h('div', { class: 'row', style: { display: 'flex', gap: '6px', alignItems: 'center' } }, h('span', null, '方针'), sel));
      panel.append(h('div', { class: 'actions' },
        h('button', { class: 'act', id: 'act-recruit', onclick: () => this.formRecruit(id) }, '募兵'),
        h('button', { class: 'act', id: 'act-transfer', onclick: () => this.formTransfer(id) }, '调拨钱粮'),
        h('button', { class: 'act', onclick: () => this.formAppoint(id) }, '任命主官'),
      ));
    } else if (!friendly(s, s.player, c.controller)) {
      panel.append(h('h3', null, '交涉'));
      panel.append(h('div', { class: 'actions' }, h('button', { class: 'act', id: 'act-persuade', onclick: () => this.formPersuade(id) }, '遣使劝降')));
    } else if (vassal) {
      panel.append(h('h3', null, '下属'));
      panel.append(h('div', { class: 'actions' },
        h('button', { class: 'act', onclick: () => this.formReward(c.controller) }, `犒赏${ctrl.short}部`),
        h('button', { class: 'act', onclick: () => this.formTransfer(s.factions[s.player].capital, id) }, '拨给钱粮')));
    }
  }

  ledgerView(id: string, turn: number): HTMLElement {
    const s = this.s!;
    const box = h('div', { class: 'ledger', id: 'ledger' });
    const entries = s.ledger.filter(e => e.turn === turn && e.node === id);
    if (!entries.length) { box.append(h('div', { class: 'note' }, '上月尚无记录。进入下月后，这里会逐项列出钱粮变化的来由。')); return box; }
    for (const f of ['grain', 'silver', 'garrison', 'minxin', 'wall', 'pop'] as const) {
      const list = entries.filter(e => e.field === f);
      if (!list.length) continue;
      const net = list.reduce((m, e) => m + e.delta, 0);
      const det = h('details', { open: f === 'grain' || f === 'silver' ? true : undefined },
        h('summary', null, h('span', null, `${FIELD_NAME[f]}变化`), h('b', { class: net >= 0 ? 'delta-up' : 'delta-down' }, signed(net))));
      const ul = h('ul');
      // 同名项合并
      const merged = new Map<string, { delta: number; e: LedgerEntry }>();
      for (const e of list) { const k = e.text + '|' + (e.src.ref ?? ''); const m = merged.get(k); if (m) m.delta += e.delta; else merged.set(k, { delta: e.delta, e }); }
      for (const { delta, e } of [...merged.values()].sort((a, b) => a.delta - b.delta)) {
        const isOrder = e.src.kind === 'order';
        ul.append(h('li', { class: isOrder ? 'order' : '' }, h('span', null, `${e.text}${isOrder ? `（${shortDate(e.src.turn ?? e.turn)}你的命令）` : e.src.kind === 'event' ? '（史事）' : ''}`), h('b', null, signed(delta))));
      }
      det.append(ul);
      box.append(det);
    }
    // 追溯：近几个月影响本城的命令
    const orders = s.ledger.filter(e => e.node === id && e.src.kind === 'order' && e.turn < turn && e.turn >= turn - 6);
    if (orders.length) {
      const seen = new Set<string>();
      const ul = h('ul');
      for (const e of orders.reverse()) { const k = e.src.ref + e.text; if (seen.has(k)) continue; seen.add(k); ul.append(h('li', { class: 'order' }, h('span', null, `${shortDate(e.turn)}：${e.text}`), h('b', null, `${FIELD_NAME[e.field]} ${signed(e.delta)}`))); }
      box.append(h('details', null, h('summary', null, h('span', null, '此前影响本城的命令'), h('b', null, String(seen.size))), ul));
    }
    return box;
  }

  armyRow(id: string): HTMLElement {
    const s = this.s!;
    const a = s.armies[id];
    const f = s.factions[a.faction];
    const mine = this.isMineOrVassal(a.faction) || a.faction === s.player;
    return h('div', { class: 'army-row', 'data-army': id, onclick: () => this.selectArmy(id) },
      h('span', { class: 'chip', style: { background: f.color } }, f.short),
      h('div', { class: 'meta' }, h('b', null, a.name), ` · ${charName(s, a.commander)}`, h('small', null, `${mine ? troopsText(a.troops) : roughTroops(a.troops)} 人 · ${armyOrderText(a.order)}`)));
  }

  /* ---------- 军队详情 ---------- */
  renderArmy(id: string) {
    const s = this.s!;
    const a = s.armies[id];
    if (!a) { this.closePanel(); return; }
    const f = s.factions[a.faction];
    const cmd = s.chars[a.commander];
    const panel = clear($('#panel'));
    panel.className = 'paper';
    panel.classList.remove('hidden');
    const mine = a.faction === s.player;
    const vassal = f.overlord === s.player;
    const visible = mine || vassal || friendly(s, s.player, a.faction);
    panel.append(h('button', { class: 'close', onclick: () => this.closePanel() }, '×'));
    panel.append(h('h2', { id: 'army-name' }, a.name, h('small', null, f.name)));
    panel.append(h('dl', { class: 'allegiance' },
      h('dt', null, '主将'), h('dd', null, cmd ? h('a', { href: '#', onclick: (e: Event) => { e.preventDefault(); this.openChar(cmd.id); } }, `${cmd.name}（统 ${cmd.ab.tong} · 谋 ${cmd.ab.mou}）`) : '无'),
      h('dt', null, '兵力'), h('dd', null, visible ? `${fmt(a.troops)} 人` : roughTroops(a.troops)),
      h('dt', null, '士气'), h('dd', null, visible ? `${Math.round(a.morale)}${a.hunger ? '（断粮）' : ''}` : '不详'),
      h('dt', null, '兵种'), h('dd', null, visible ? `步 ${pct(a.mix.inf)} · 骑 ${pct(a.mix.cav)} · 火器 ${pct(a.mix.gun)} · 水师 ${pct(a.mix.navy)}` : '不详'),
      h('dt', null, '所在'), h('dd', null, a.progress > 0 && a.path.length ? `${nodeName(a.location)}—${nodeName(a.path[0])}途中` : nodeName(a.location)),
      h('dt', null, '粮台'), h('dd', null, visible ? nodeName(a.supply) : '不详'),
      h('dt', null, '动向'), h('dd', null, armyOrderText(a.order) + (a.path.length ? `（约 ${pathDays(a.location, a.path) - a.progress} 日）` : '')),
    ));
    const pend = this.orders.find(o => (o.kind === 'army' || o.kind === 'command') && o.army === id);
    if (pend) panel.append(h('div', { class: 'estimate' }, '本月已下令：' + describeOrder(s, pend)));
    if (mine) {
      panel.append(h('h3', null, '军令'));
      const acts = h('div', { class: 'actions' },
        h('button', { class: 'act', id: 'act-move', onclick: () => this.beginTarget(id, `点选${a.name}要开赴的城池`, n => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'move', target: n, attack: false } })) }, '行军'),
        h('button', { class: 'act', id: 'act-attack', onclick: () => this.beginTarget(id, `点选${a.name}要进攻的城池`, n => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'move', target: n, attack: true } })) }, '进攻'),
        h('button', { class: 'act', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'hold' } }) }, '驻扎'),
      );
      const here = s.cities[a.location];
      if (a.progress === 0 && here && hostile(s, s.player, here.controller)) {
        acts.append(h('button', { class: 'act primary', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: true } }) }, '攻城'),
          h('button', { class: 'act', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: false } }) }, '围困'));
      }
      if (a.progress === 0 && here && here.controller === s.player) {
        acts.append(h('button', { class: 'act', onclick: () => this.formReinforce(id) }, '与城中互拨兵员'));
      }
      panel.append(acts);
    } else if (vassal) {
      panel.append(h('h3', null, '号令下属', h('small', null, `服从 ${f.loyalty}`)));
      panel.append(h('div', { class: 'note' }, `${f.name}奉朝廷号令，但听不听、听几分，要看服从、利益、粮饷与督师。`));
      panel.append(h('div', { class: 'actions' },
        h('button', { class: 'act', id: 'act-command-move', onclick: () => this.beginTarget(id, `点选要${f.short}部开赴的城池`, n => this.formCommand(id, { kind: 'move', target: n, attack: false })) }, '令其开赴'),
        h('button', { class: 'act', onclick: () => this.beginTarget(id, `点选要${f.short}部进攻的城池`, n => this.formCommand(id, { kind: 'move', target: n, attack: true })) }, '令其进攻'),
        h('button', { class: 'act', onclick: () => this.formCommand(id, { kind: 'hold' }) }, '令其驻守'),
        h('button', { class: 'act', onclick: () => this.formReward(a.faction) }, '犒赏'),
      ));
    }
  }

  /* ================= 表单 ================= */
  modal(title: string, body: (HTMLElement | string)[], buttons: { label: string; primary?: boolean; id?: string; onclick: () => void | boolean }[]) {
    const m = clear($('#modal'));
    m.classList.remove('hidden');
    const dlg = h('div', { class: 'dialog paper', role: 'dialog' }, h('h2', null, title), h('div', { class: 'body' }, ...body));
    const foot = h('div', { class: 'footer' });
    for (const b of buttons) foot.append(h('button', { class: 'act' + (b.primary ? ' primary' : ''), id: b.id, onclick: () => { if (b.onclick() !== false) this.closeModal(); } }, b.label));
    if (buttons.length) dlg.append(foot);
    m.append(dlg);
    m.onclick = e => { if (e.target === m && buttons.length) this.closeModal(); };
    return dlg;
  }
  closeModal() { $('#modal').classList.add('hidden'); clear($('#modal')); }

  formRecruit(node: string) {
    const s = this.s!, c = s.cities[node];
    const max = Math.min(maxRecruit(c), Math.floor((c.silver - this.pendingSpend(node, 'silver')) / RECRUIT_SILVER / 100) * 100);
    if (max < 100) { this.toast(`${nodeName(node)}本月无法募兵（人口、民心或府库不足）`); return; }
    const input = h('input', { type: 'range', min: 100, max, step: 100, value: Math.min(max, 1000), id: 'recruit-n' }) as HTMLInputElement;
    const info = h('div', { class: 'estimate' });
    const upd = () => { const n = +input.value; info.textContent = `募兵 ${n} 人：花银 ${fmt(n * RECRUIT_SILVER)} 两，人口 −${(n / 10000).toFixed(2)} 万，民心 −${(n / 1500).toFixed(1)}。此后每月多耗口粮 ${fmt(n * 0.25)} 石、饷银 ${fmt(n * 0.6)} 两。`; };
    input.oninput = upd; upd();
    this.modal(`${nodeName(node)} · 募兵`, [h('div', { class: 'row' }, h('label', null, '人数'), input), info, h('div', { class: 'note' }, `本城本月最多可募 ${maxRecruit(c)} 人。`)],
      [{ label: '取消', onclick: () => {} }, { label: '募兵', primary: true, id: 'recruit-ok', onclick: () => { this.addOrder({ id: this.newOrderId(), kind: 'recruit', node, troops: +input.value }); } }]);
  }

  formTransfer(from: string, to?: string) {
    const s = this.s!;
    const targets = Object.values(s.cities).filter(c => c.id !== from && friendly(s, s.player, c.controller)).sort((a, b) => (NODE[a.id].area + a.id).localeCompare(NODE[b.id].area + b.id));
    const fromSel = h('select', { id: 'tr-from' }, ...Object.values(s.cities).filter(c => c.controller === s.player).map(c => h('option', { value: c.id, selected: c.id === from }, `${nodeName(c.id)}（粮 ${wan(c.grain)}，银 ${wan(c.silver)}）`))) as HTMLSelectElement;
    const toSel = h('select', { id: 'tr-to' }, ...targets.map(c => h('option', { value: c.id, selected: c.id === to }, `${nodeName(c.id)} · ${s.factions[c.controller].short}`))) as HTMLSelectElement;
    const grain = h('input', { type: 'number', min: 0, step: 1000, value: 10000, id: 'tr-grain', style: { width: '110px' } }) as HTMLInputElement;
    const silver = h('input', { type: 'number', min: 0, step: 1000, value: 0, id: 'tr-silver', style: { width: '110px' } }) as HTMLInputElement;
    this.modal('调拨钱粮', [
      h('div', { class: 'row' }, h('label', null, '自'), fromSel), h('div', { class: 'row' }, h('label', null, '往'), toSel),
      h('div', { class: 'row' }, h('label', null, '粮（石）'), grain), h('div', { class: 'row' }, h('label', null, '银（两）'), silver),
      h('div', { class: 'note' }, '拨给下属军镇的钱粮能提高其服从；调往前线城池可供守城与军队支粮。'),
    ], [{ label: '取消', onclick: () => {} }, { label: '调拨', primary: true, id: 'tr-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'transfer', from: fromSel.value, to: toSel.value, grain: Math.max(0, +grain.value || 0), silver: Math.max(0, +silver.value || 0) }) }]);
  }

  freeChars(): Character[] {
    const s = this.s!;
    const busy = new Set([...Object.values(s.armies).map(a => a.commander), ...s.missions.map(m => (m.order as any).char)]);
    for (const o of this.orders) if ('char' in o) busy.add((o as any).char);
    return Object.values(s.chars).filter(c => c.faction === s.player && c.status === 'active' && !busy.has(c.id) && c.id !== s.factions[s.player].leader);
  }

  formAppoint(node: string) {
    const s = this.s!;
    const list = this.freeChars();
    const sel = h('select', { id: 'ap-char' }, ...list.map(c => h('option', { value: c.id }, `${c.name}（政 ${c.ab.zheng} · 统 ${c.ab.tong}）· 现在${nodeName(c.location)}`))) as HTMLSelectElement;
    this.modal(`${nodeName(node)} · 任命主官`, [h('div', { class: 'row' }, h('label', null, '人选'), sel), h('div', { class: 'note' }, '主官政务越高，赋税与田粮越多；守城时统军最高者为守将。现任主官会让位。')],
      [{ label: '取消', onclick: () => {} }, { label: '任命', primary: true, onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'appoint', node, char: sel.value }) }]);
    void s;
  }

  formPersuade(node: string) {
    const s = this.s!;
    const list = this.freeChars().sort((a, b) => b.ab.wai - a.ab.wai);
    if (!list.length) { this.toast('没有可以出使的人'); return; }
    const sel = h('select', { id: 'ps-char' }, ...list.map(c => h('option', { value: c.id }, `${c.name}（外交 ${c.ab.wai}）`))) as HTMLSelectElement;
    const est = h('div', { class: 'estimate', id: 'ps-est' });
    const upd = () => { const r = persuadeChance(s, s.player, sel.value, node); est.textContent = `估计成功率 ${Math.round(r.p * 100)}%：${r.factors.join('，')}。失败时使者可能被扣留。`; };
    sel.onchange = upd; upd();
    this.modal(`遣使劝降 · ${nodeName(node)}`, [h('div', { class: 'row' }, h('label', null, '使者'), sel), est, h('div', { class: 'note' }, '使者本月出发，下月抵达后才有结果。劝降成功即“献城”，城池改属，守将随之改投。')],
      [{ label: '取消', onclick: () => {} }, { label: '派遣', primary: true, id: 'ps-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'persuade', char: sel.value, node }) }]);
  }

  formEnvoy(target: string) {
    const s = this.s!;
    const list = this.freeChars().sort((a, b) => b.ab.wai - a.ab.wai);
    if (!list.length) { this.toast('没有可以出使的人'); return; }
    const sel = h('select', { id: 'ev-char' }, ...list.map(c => h('option', { value: c.id }, `${c.name}（外交 ${c.ab.wai}）`))) as HTMLSelectElement;
    const st = stance(s, s.player, target);
    const aimSel = h('select', { id: 'ev-aim' }, h('option', { value: 'alliance' }, '结盟（各守其城，互不相犯）'), st === 'war' ? h('option', { value: 'truce' }, '停战六个月') : null, st === 'war' ? h('option', { value: 'peace' }, '议和') : null) as HTMLSelectElement;
    const est = h('div', { class: 'estimate' });
    const upd = () => { const r = envoyScore(s, s.player, { id: 'x', kind: 'envoy', char: sel.value, target, aim: aimSel.value as any }); est.textContent = `评估 ${r.score}（需 55，临事另有 ±10 变数）：${r.factors.join('，')}`; };
    sel.onchange = upd; aimSel.onchange = upd; upd();
    this.modal(`遣使 · ${s.factions[target].name}`, [h('div', { class: 'row' }, h('label', null, '使者'), sel), h('div', { class: 'row' }, h('label', null, '所议'), aimSel), est, h('div', { class: 'note' }, '使者本月出发，下月抵达后有结果。盟约与停战都保留双方各自的控制权。')],
      [{ label: '取消', onclick: () => {} }, { label: '派遣', primary: true, id: 'ev-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'envoy', char: sel.value, target, aim: aimSel.value as any }) }]);
  }

  formCommand(army: string, order: ArmyOrder) {
    const s = this.s!;
    const a = s.armies[army], f = s.factions[a.faction];
    const silver = h('input', { type: 'range', min: 0, max: Math.min(60000, s.cities[s.factions[s.player].capital].silver), step: 2000, value: 0, id: 'cmd-silver' }) as HTMLInputElement;
    const est = h('div', { class: 'estimate', id: 'cmd-est' });
    const upd = () => {
      const r = obedience(s, s.player, { id: 'x', kind: 'command', vassal: a.faction, army, order, silver: +silver.value }, false);
      est.innerHTML = '';
      est.append(`犒银 ${fmt(+silver.value)} 两。估计服从 ${r.score}（临事另有 ±10）：${r.factors.join('，')}。`, h('br'),
        '≥65 照办；50—64 拖延一月；35—49 打折扣（只派半数）；<35 抗命。');
    };
    silver.oninput = upd; upd();
    this.modal(`号令${f.name}`, [h('div', null, `${a.name}：${armyOrderText(order)}`), h('div', { class: 'row' }, h('label', null, '犒银'), silver), est],
      [{ label: '取消', onclick: () => {} }, { label: '传令', primary: true, id: 'cmd-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'command', vassal: a.faction, army, order, silver: +silver.value }) }]);
  }

  formReward(vassal: string) {
    const s = this.s!;
    const cap = s.cities[s.factions[s.player].capital];
    const input = h('input', { type: 'range', min: 5000, max: Math.max(5000, Math.min(80000, cap.silver)), step: 5000, value: 20000 }) as HTMLInputElement;
    const info = h('div', { class: 'estimate' });
    const upd = () => { info.textContent = `出银 ${fmt(+input.value)} 两，${s.factions[vassal].name}服从约 +${Math.min(15, Math.round(+input.value / 2500))}。`; };
    input.oninput = upd; upd();
    this.modal(`犒赏${s.factions[vassal].name}`, [h('div', null, `当前服从 ${s.factions[vassal].loyalty}`), h('div', { class: 'row' }, h('label', null, '银两'), input), info],
      [{ label: '取消', onclick: () => {} }, { label: '犒赏', primary: true, onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'reward', vassal, silver: +input.value }) }]);
  }

  formReinforce(army: string) {
    const s = this.s!;
    const a = s.armies[army], c = s.cities[a.location];
    const input = h('input', { type: 'range', min: -(c.garrison - 500), max: a.troops - 500, step: 500, value: 0 }) as HTMLInputElement;
    const info = h('div', { class: 'estimate' });
    const upd = () => { const n = +input.value; info.textContent = n >= 0 ? `${a.name}拨 ${fmt(n)} 人入城驻守` : `从城中驻军抽 ${fmt(-n)} 人补入${a.name}`; };
    input.oninput = upd; upd();
    this.modal(`${a.name}与${nodeName(a.location)}互拨兵员`, [h('div', { class: 'row' }, h('label', null, '数目'), input), info],
      [{ label: '取消', onclick: () => {} }, { label: '确定', primary: true, onclick: () => { if (+input.value) this.addOrder({ id: this.newOrderId(), kind: 'reinforce', node: a.location, army, troops: +input.value }); } }]);
  }

  /* ================= 势力 / 人物 ================= */
  openFactions() {
    const s = this.s!;
    const tbl = h('table', { class: 'list', id: 'faction-table' }, h('tr', null, h('th', null, '势力'), h('th', null, '所奉'), h('th', null, '关系'), h('th', null, '城'), h('th', null, '兵力'), h('th', null, '')));
    for (const f of Object.values(s.factions)) {
      if (f.id === 'local' || f.defunct) continue;
      const cities = Object.values(s.cities).filter(c => c.controller === f.id).length;
      const troops = Object.values(s.armies).filter(a => a.faction === f.id).reduce((n, a) => n + a.troops, 0);
      const st = stance(s, s.player, f.id);
      const btn = f.id === s.player ? '' : f.overlord === s.player ? h('button', { class: 'act', onclick: () => { this.closeModal(); this.formReward(f.id); } }, `犒赏（服从 ${f.loyalty}）`)
        : h('button', { class: 'act', 'data-envoy': f.id, onclick: () => { this.closeModal(); this.formEnvoy(f.id); } }, '遣使');
      tbl.append(h('tr', null, h('td', null, h('span', { class: 'chip', style: { background: f.color } }, f.name)), h('td', null, POLITIES[f.polity].name),
        h('td', null, STANCE_NAME[st] ?? st), h('td', null, String(cities)), h('td', null, friendly(s, s.player, f.id) ? troopsText(troops) : roughTroops(troops)), h('td', null, btn)));
    }
    const u = unificationProgress(s);
    this.modal('天下诸家', [tbl,
      h('h3', null, '统一进度'),
      h('div', null, `计入统一的主要地区：${VICTORY_AREAS.join('、')}。共 ${u.total} 处城池与大区，你方阵营现有 ${u.held} 处。`),
      h('div', { class: 'note' }, `统一要求上述地区全部归于你方（含奉你号令者），且独立争天下的对手均已退出。正式归附计入；盟约与停战保留各自控制权。尚存对手：${u.rivals.join('、') || '无'}。`),
    ], [{ label: '关闭', onclick: () => {} }]);
  }

  openChars(group: 'mine' | 'vassal' | 'others' = 'mine') {
    const s = this.s!;
    const tabs = h('div', { class: 'tabs' }, ...([['mine', '本方'], ['vassal', '下属诸镇'], ['others', '他方要人']] as const).map(([k, n]) => h('button', { class: 'tab' + (k === group ? ' on' : ''), onclick: () => { this.closeModal(); this.openChars(k); } }, n)));
    const list = Object.values(s.chars).filter(c => group === 'mine' ? c.faction === s.player : group === 'vassal' ? s.factions[c.faction]?.overlord === s.player : c.faction !== s.player && s.factions[c.faction]?.overlord !== s.player && s.factions[c.faction]?.leader === c.id);
    const tbl = h('table', { class: 'list' }, h('tr', null, h('th', null, '人物'), h('th', null, '所在'), h('th', null, '统政谋外威'), h('th', null, '忠·降·战'), h('th', null, '状态')));
    for (const c of list) {
      const own = group !== 'others';
      tbl.append(h('tr', { style: { cursor: 'pointer' }, onclick: () => { this.closeModal(); this.openChar(c.id); } },
        h('td', null, h('b', null, c.name), h('br'), h('small', null, c.title)), h('td', null, nodeName(c.location)),
        h('td', null, `${c.ab.tong} ${c.ab.zheng} ${c.ab.mou} ${c.ab.wai} ${c.ab.wang}`),
        h('td', null, own ? `${Math.round(c.att.loyalty)} · ${Math.round(c.att.surrender)} · ${Math.round(c.att.hawk)}` : '不详'),
        h('td', null, c.status === 'active' ? '在任' : c.status === 'captured' ? '被执' : '已故')));
    }
    this.modal('人物', [tabs, tbl, h('div', { class: 'note' }, '忠：对本势力的忠诚；降：降意，高者易被劝降、易献城；战：主战（正）或主和（负）。史事与线索会改变这些态度，点人物可看变化记录。')], [{ label: '关闭', onclick: () => {} }]);
  }

  openChar(id: string) {
    const s = this.s!;
    const c = s.chars[id];
    const own = c.faction === s.player || s.factions[c.faction]?.overlord === s.player;
    const body: (HTMLElement | string)[] = [
      h('div', null, `${s.factions[c.faction]?.name ?? ''} · ${c.title} · 现在${nodeName(c.location)}${c.status !== 'active' ? (c.status === 'captured' ? ' · 被执' : ' · 已故') : ''}`),
      h('div', { class: 'stats', style: { marginTop: '8px' } },
        h('div', null, '统军', h('b', null, String(c.ab.tong))), h('div', null, '政务', h('b', null, String(c.ab.zheng))), h('div', null, '谋略', h('b', null, String(c.ab.mou))),
        h('div', null, '外交', h('b', null, String(c.ab.wai))), h('div', null, '威望', h('b', null, String(c.ab.wang))),
        h('div', null, '忠诚', h('b', null, own ? String(Math.round(c.att.loyalty)) : '不详')), h('div', null, '降意', h('b', null, own ? String(Math.round(c.att.surrender)) : '不详')), h('div', null, '主战', h('b', null, own ? String(Math.round(c.att.hawk)) : '不详'))),
      h('p', null, c.bio),
    ];
    if (own) {
      const ul = h('ul', { class: 'ledger', id: 'att-log' });
      for (const l of [...c.attLog].reverse()) ul.append(h('li', null, h('span', null, `${shortDate(l.turn)} · ${l.reason}`), h('b', { class: l.delta >= 0 ? 'delta-up' : 'delta-down' }, `${{ loyalty: '忠诚', surrender: '降意', hawk: '主战' }[l.field]} ${signed(l.delta)}`)));
      body.push(h('h3', null, '态度变化记录'), c.attLog.length ? ul : h('div', { class: 'note' }, '尚无记录。'));
    }
    this.modal(c.name, body, [{ label: '关闭', onclick: () => {} }]);
  }

  /* ================= 月报 ================= */
  toggleReport() { if ($('#report').classList.contains('hidden')) this.openReport(); else $('#report').classList.add('hidden'); }
  openReport(turn?: number) {
    const s = this.s!;
    if (turn !== undefined) this.reportTurn = turn;
    const t = Math.max(...[this.reportTurn, -1]);
    const box = clear($('#report'));
    box.className = 'paper';
    const minTurn = Math.min(...s.reports.map(r => r.turn), s.turn - 1);
    const all = s.reports.filter(r => r.turn === t && (!r.faction || r.faction === s.player));
    const urgent = all.filter(r => r.urgent).length;
    box.append(h('header', null,
      h('h2', null, h('span', null, t >= 0 ? `月报 · ${shortDate(t)}` : '月报'),
        h('span', null,
          h('button', { class: 'tab', disabled: t <= minTurn, onclick: () => this.openReport(t - 1) }, '◀'),
          h('button', { class: 'tab', disabled: t >= s.turn - 1, onclick: () => this.openReport(t + 1) }, '▶'),
          h('button', { class: 'tab', onclick: () => box.classList.add('hidden') }, '收起'))),
      h('div', { class: 'note' }, all.length ? `共 ${all.length} 条${urgent ? `，其中紧急 ${urgent} 条` : ''}。点“定位”可回到出事的城。` : '这一月尚无记录。'),
      h('div', { class: 'tabs' }, ...['全部', '急报', '军报', '易主', '内政', '交涉', '史事', '线索', '人事'].map(k => h('button', { class: 'tab' + (this.reportTab === k ? ' on' : ''), onclick: () => { this.reportTab = k; this.openReport(); } }, k))),
    ));
    const list = h('div', { class: 'entries', id: 'report-entries' });
    const shown = all.filter(r => this.reportTab === '全部' || r.cat === this.reportTab || (this.reportTab === '急报' && r.urgent))
      .sort((a, b) => Number(!!b.urgent) - Number(!!a.urgent));
    for (const r of shown) list.append(this.reportEntry(r));
    if (t < 0) list.append(h('div', { class: 'entry' }, '开局：北京失守的消息传到南京。进入下月后，这里会列出各地的变化。'));
    box.append(list);
  }

  reportEntry(r: ReportEntry): HTMLElement {
    const el = h('div', { class: 'entry' + (r.urgent ? ' urgent' : '') }, h('span', { class: `cat cat-${r.cat}` }, r.urgent && r.cat !== '急报' ? r.cat + '·急' : r.cat), r.text);
    const links = h('div', { class: 'links' });
    if (r.node) links.append(h('button', { class: 'locate', onclick: () => { this.map.focus(r.node!, Math.max(this.map.cam.z, 2)); this.selectNode(r.node!); } }, `定位${nodeName(r.node)}`));
    if (r.src?.kind === 'order' && r.src.ref) {
      const ref = r.src.ref;
      links.append(h('button', { onclick: () => {
        const e = this.s!.ledger.find(l => l.src.ref === ref);
        this.toast(e ? `源自 ${shortDate(e.src.turn ?? e.turn)} 你的命令：${nodeName(e.node)}${e.text}` : '源自你此前的命令');
        if (e) { this.map.focus(e.node); this.selectNode(e.node); }
      } }, '为什么'));
    }
    if (r.history) {
      const hist = h('div', { class: 'history hidden' }, r.history);
      links.append(h('button', { onclick: () => hist.classList.toggle('hidden') }, '史实对照'));
      el.append(links, hist);
    } else if (links.childNodes.length) el.append(links);
    return el;
  }

  /* ================= 月度推进 ================= */
  async endTurn() {
    if (!this.s || this.resolving || this.s.ended) return;
    this.resolving = true;
    this.closePanel();
    this.endTarget();
    this.renderTop();
    const before = this.s;
    const gen = resolveMonth(before, this.orders);
    let r = gen.next();
    try {
      while (!r.done) {
        const it = r.value;
        let ans: Answer;
        if (it.type === 'battle') {
          this.toast(`${it.battle.nodeName}${it.battle.kind === 'siege' ? '攻城战' : '野战'}：${it.battle.att.name}对${it.battle.def.name}`);
          const res = await playBattle(before, it.battle, it.side, this.autoBattle);
          ans = { type: 'battle', result: res.result, manual: res.manual };
        } else {
          const idx = await this.choose(it.choice);
          ans = { type: 'choice', index: idx };
        }
        r = gen.next(ans);
      }
    } catch (e) {
      console.error(e);
      this.toast('结算出错：' + (e as Error).message);
      this.resolving = false;
      this.renderTop();
      return;
    }
    this.s = r.value.state;
    this.orders = [];
    this.map.view.state = this.s;
    this.resolving = false;
    saveTo(this.kv, 'auto', this.s, this.saveLabel(this.s));
    this.reportTurn = this.s.turn - (this.s.ended ? 0 : 1);
    this.renderAll();
    const urgent = this.s.reports.some(x => x.turn === this.reportTurn && x.urgent && (!x.faction || x.faction === this.s!.player));
    if (urgent) alarm(); else chime();
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
      c.options.forEach((o, i) => opts.append(h('button', { class: 'opt', 'data-choice': i, onclick: () => { this.closeModal(); resolve(i); } }, h('b', null, o.label), h('small', null, o.desc))));
      m.append(h('div', { class: 'dialog paper', role: 'dialog' }, h('h2', null, `史事 · ${c.title}`), h('div', { class: 'body' }, c.text), h('div', { class: 'note' }, '此事须由朝廷决断：'), opts));
    });
  }

  showEnd() {
    const s = this.s!;
    const u = unificationProgress(s);
    const lost = Object.keys(s.flags).filter(k => k.startsWith('lost_')).map(k => k.slice(5)).filter(id => s.cities[id] && !friendly(s, s.player, s.cities[id].controller));
    const myBattles = s.battles.filter(b => this.isMineOrVassal(b.attacker) || this.isMineOrVassal(b.defender) || b.attacker === s.player || b.defender === s.player);
    this.modal(s.ended!.kind === 'trial_end' ? '试玩结束' : s.ended!.kind === 'unified' ? '天下一统' : s.ended!.kind === 'fallen' ? '覆亡' : '天下未定', [
      h('p', null, s.ended!.text),
      h('ul', null,
        h('li', null, `你方阵营现有 ${u.held} / ${u.total} 处主要城池与大区。`),
        h('li', null, `扬州：${s.cities.yangzhou.controller === s.player ? '仍在你手中' : `已属${s.factions[s.cities.yangzhou.controller].name}`}${s.sieges.yangzhou ? '（仍在被围）' : ''}；南京：${s.cities.nanjing.controller === s.player ? '无恙' : '已失'}。`),
        h('li', null, `历经史事与线索 ${s.events.length} 条，参与战斗 ${myBattles.length} 场${lost.length ? `，失地：${lost.map(nodeName).join('、')}` : ''}。`)),
      h('div', { class: 'note' }, '可以继续推进，超出试玩范围的月份规则照常运行，但史事只编到乙酉四月。'),
    ], [
      { label: '回到标题', onclick: () => this.showTitle() },
      { label: '继续推进', primary: true, onclick: () => { delete s.ended; s.turnLimit = undefined; if (s.turn < 0) return; s.turn++; this.renderAll(); } },
    ]);
  }

  /* ================= 存读档 ================= */
  saveLabel(s: GameState) { return `${s.factions[s.player].name} · ${dateLabel(POLITIES[s.factions[s.player].polity], s.turn)}`; }
  openSaves(fromTitle: boolean) {
    const rows: HTMLElement[] = [];
    for (const slot of SLOTS) {
      const f = loadFrom(this.kv, slot);
      const name = slot === 'auto' ? '自动存档（每月结算后）' : `存档 ${slot}`;
      rows.push(h('div', { class: 'slot' }, h('div', { class: 'meta' }, h('b', null, name), h('small', null, f ? `${f.label} · ${new Date(f.savedAt).toLocaleString('zh-CN')}` : '空')),
        !fromTitle && slot !== 'auto' && this.s ? h('button', { class: 'act', 'data-save': slot, onclick: () => this.saveSlot(slot as Slot) }, '存入') : null,
        f ? h('button', { class: 'act', 'data-load': slot, onclick: () => { this.closeModal(); this.start(f.state, false); this.toast('已读取：' + f.label); } }, '读取') : null));
    }
    const file = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onchange: async (e: Event) => {
      const fl = (e.target as HTMLInputElement).files?.[0]; if (!fl) return;
      try { const f = deserialize(await fl.text()); this.closeModal(); this.start(f.state, false); this.toast('已导入存档：' + f.label); } catch (err) { this.toast('导入失败：' + (err as Error).message); }
    } }) as HTMLInputElement;
    this.modal('存档', [h('div', { class: 'note' }, '只在月与月之间存档：行军、围城、交涉等跨月行动会原样保存，读档后继续。'), ...rows, file], [
      ...(this.s && !fromTitle ? [{ label: '导出存档文件', onclick: () => { this.exportSave(); return false; } }] : []),
      { label: '导入存档文件', onclick: () => { file.click(); return false; } },
      { label: '关闭', onclick: () => {} },
    ]);
  }
  saveSlot(slot: Slot) {
    if (this.resolving) return;
    if (this.orders.length) this.toast('注意：本月尚未颁令的命令不会存入（只在月与月之间存档）');
    saveTo(this.kv, slot, this.s!, this.saveLabel(this.s!));
    this.toast(`已存入存档 ${slot}`);
    this.closeModal();
    this.openSaves(false);
  }
  exportSave() {
    const blob = new Blob([serialize(this.s!, this.saveLabel(this.s!))], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `南明存档-${shortDate(this.s!.turn)}.json` }) as HTMLAnchorElement;
    document.body.append(a); a.click(); a.remove();
  }
  confirmTitle() {
    this.modal('回到标题', [h('div', null, '当前进度已在每月结算后自动存档。本月未颁令的命令不会保存。')], [{ label: '取消', onclick: () => {} }, { label: '回到标题', primary: true, onclick: () => this.showTitle() }]);
  }

  openAbout() {
    this.modal('玩法说明', [
      h('p', null, '一月一回合。看上月月报 → 查看城池 → 任命、调拨钱粮、募兵、用兵、交涉 → 点“颁令 · 进入下月”。各方同时行动，按“交涉 → 行军 → 野战 → 围城 → 内政钱粮 → 史事线索”的顺序结算，再生成月报。'),
      h('p', null, '地图：拖动平移，滚轮缩放。势力色表示实际控制者，城旁小旗表示所奉政权（明三角牙旗、清镶边旗、大顺燕尾旗、大西方旗）。城外带刺圈表示围城。'),
      h('p', null, '城池：只有陷城、献城、正式归附才会易主；野战失利只会让城池失去屏障。钱粮的每一笔变化都有来由，城池详情里可逐项查看。'),
      h('p', null, '江北诸镇奉朝廷号令而自有兵权：号令能否落实，看服从、利益、粮饷与督师。'),
      h('p', null, '史事：本局走向与历史相符时触发；不符时或不发生，或改写后发生。线索按时出现，会影响人物态度。'),
      h('p', null, '战斗：野战分三路，攻城分三段，每回合下令，可用计策。也可交给部将自动打完——规则相同。'),
      h('p', { class: 'note' }, '作者：一尾小石斑。地图底图来自 Natural Earth（公有领域）；字体：思源宋体（Noto Serif SC）、马善政楷书（Ma Shan Zheng），均为 SIL OFL 开源字体。'),
    ], [{ label: '知道了', onclick: () => {} }]);
  }

  /* ================= 新手提示 ================= */
  showHint() {
    const el = $('#hint');
    if (!this.s) return;
    const steps = [
      { node: this.s.factions[this.s.player].capital, text: '这是南京，你的都城。先点一下它，看看谁控制、驻军多少、钱粮几何。' },
      { node: null, text: '右侧是城池详情。试着下一道命令：例如把方针改为“劝农”，或点“募兵”。也可以点地图上的军旗，给军队下令。' },
      { node: null, text: '命令列在屏幕下方。点右上角“颁令 · 进入下月”，各方行动后会生成月报。' },
      { node: null, text: '月报列出上月的变化。点“定位”回到出事的城；城池详情里“钱粮变化”逐项写明来由，红字是你的命令造成的。' },
    ];
    if (this.hintStep >= steps.length) { el.classList.add('hidden'); return; }
    const st = steps[this.hintStep];
    clear(el);
    el.className = 'paper';
    el.append(h('div', null, `提示 ${this.hintStep + 1}/4：${st.text}`), h('button', { class: 'act', onclick: () => { this.hintStep = 9; try { localStorage.setItem(HINT_KEY, '9'); } catch { /* ignore */ } el.classList.add('hidden'); } }, '不再提示'));
    if (st.node) {
      const n = NODE[st.node];
      void n;
      el.style.left = '50%'; el.style.top = '70px'; el.style.transform = 'translateX(-50%)';
    } else if (this.hintStep === 3) { el.style.left = '450px'; el.style.top = '80px'; el.style.transform = ''; }
    else { el.style.left = '50%'; el.style.top = '70px'; el.style.transform = 'translateX(-50%)'; }
    if (this.hintStep === 3) setTimeout(() => { if (this.hintStep === 3) { this.hintStep = 4; try { localStorage.setItem(HINT_KEY, '4'); } catch { /* ignore */ } } }, 100);
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
void lunarOf; void NODES;
