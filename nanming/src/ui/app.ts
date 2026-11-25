/* 界面主控：游戏式 HUD。图标 + 大数字 + 短标签，细节点开才看。 */
import type { GameState, Order, NodeId, ArmyOrder, Policy, ReportEntry, LedgerEntry, Character, ReportCat } from '../core/types';
import { MapRenderer, nodePt, armyPt } from '../render/map';
import { h, $, clear, fmt, wan, signed } from './dom';
import { iconSvg } from './icons';
import { gameSelect, stepper, closeSelects, type SelOpt } from './widgets';
import gsap from 'gsap';
import { playBattle } from './battle';
import type { BattleState } from '../core/battle';
import { newsSfx, eventSfx, resultSfx, marchSfx, chime, alarm, click, isMuted, setMuted, setScene, setIntensity, audioState, getVolumes, setVolume, paper, scroll, stampSfx, orderSfx, endTurnSfx, monthSfx, captureSfx, distantBattle, choiceSfx, successSfx, denySfx, introSfx, hoverPluck } from './audio';
import { dangerOf, eraOf } from './musicTheory';
import { portrait } from './portrait';
import { cardHand, cardArt, type GameCard, type Chip } from './cards';
import { resolveMonth, unificationProgress, type Answer } from '../core/turn';
import { dateLabel, eraYear, monthName, lunarOf, shortDate, TOTAL_TURNS, ganzhi as ganzhiOf } from '../core/calendar';
import { POLITIES } from '../data/factions';
import { isReduced, setReducedMotion, reducedSystem } from './motion';
import { planNews, groupNews, type NewsPlan, type NewsGroup } from './newsFx';
import { NODE, VICTORY_AREAS, shortestPath, pathDays, marchPlan, neighbors, routeBetween } from '../data/geography';
import { friendly, hostile, stance, troopsText, roughTroops, nodeName, charName, citiesOf, topOf } from '../core/state';
import { POLICY_NAME, POLICY_HINT, monthlyIncome, upkeepOf, RECRUIT_SILVER, storeOf, grainPrice, marketCap, tradeQuote, loanAmount } from '../core/economy';
import { orderBudget, orderCost, ordersUsed, describeOrder, validateOrder, maxRecruit, recruitLeft, supplyBlock, obedience, persuadeChance, envoyScore, armyOrderText } from '../core/orders';
import { browserKV, saveTo, loadFrom, serialize, deserialize, SLOTS, type Slot } from '../core/save';
import { yangzhouSiegeState } from '../data/presets';
import { createGame } from '../data/scenario1644';
import { polityOf } from '../core/regime';
import { canSea } from '../core/military';
import type { PendingChoice } from '../core/events';

/** 从玩家一方看对方：stance(玩家, 对方) 为 overlord 表示玩家是对方的上级，对方即“下属” */
const STANCE_NAME: Record<string, string> = { war: '交战', neutral: '未战', truce: '停战', alliance: '同盟', overlord: '下属', vassal: '上级', self: '本方' };
const VOL_NAME = { music: '配乐', amb: '环境', sfx: '音效' } as const;
/** 沿海势力：治所是港口，或多数城池是港口（郑氏） */
function isCoastal(s: GameState): boolean {
  const f = s.factions[s.player];
  if (!f) return false;
  if (NODE[f.capital]?.kind === 'port') return true;
  const own = Object.values(s.cities).filter(c => c.controller === s.player);
  return own.length > 0 && own.filter(c => NODE[c.id]?.kind === 'port').length * 2 >= own.length;
}
/** 成败印下的一句话 */
function verdictLine(r?: ReportEntry): string {
  if (!r) return '';
  const t = r.text;
  if (t.includes('劝降')) return r.ok ? '守将应允' : t.includes('扣留') ? '使者被扣' : '无功而返';
  if (t.includes('出使')) return r.ok ? '议成' : '未成';
  if (t.includes('号令')) return t.includes('只遣') ? '半数奉令' : t.includes('下月') ? '推说下月' : r.ok ? '奉令出兵' : '推辞不奉';
  return r.ok ? '成' : '未成';
}
const FIELD_NAME: Record<string, string> = { grain: '仓粮', silver: '府库', pop: '人口', minxin: '民心', garrison: '驻军', wall: '城防', order: '吏治', agri: '农业', commerce: '商业', edu: '文教' };
const FIELD_ICON: Record<string, string> = { grain: 'grain', silver: 'silver', pop: 'pop', minxin: 'minxin', garrison: 'troops', wall: 'wall', order: 'order', agri: 'agri', commerce: 'commerce', edu: 'edu' };
const CAT_ICON: Record<ReportCat, string> = { 急报: 'urgent', 军报: 'war', 易主: 'capture', 交涉: 'envoy', 内政: 'admin', 人事: 'person', 史事: 'event', 线索: 'clue' };
const POLICY_ICON: Record<Policy, string> = { balanced: 'order', agri: 'agri', commerce: 'commerce', fortify: 'wall', relief: 'minxin', edu: 'edu', levy: 'reward' };
const ORDER_ICON: Record<Order['kind'], string> = { trade: 'grain', loan: 'silver', policy: 'policy', appoint: 'appoint', transfer: 'transfer', recruit: 'recruit', army: 'army', supply: 'grain', reinforce: 'reinforce', envoy: 'envoy', persuade: 'persuade', command: 'urgent', reward: 'reward', independence: 'crown', war: 'war', raise: 'army' };
const HINT_KEY = 'nanming:hint';

/** 选势力卡片：难度、一句处境、目标 */
const PICK: { id: string; name: string; stars: number; z: number; line: string; situation: string; goal: string }[] = [
  { id: 'hongguang', name: '弘光朝廷', stars: 4, z: 1.5, line: '坐拥江南财赋，号令却出不了南京。', situation: '福王在南京即位。江北四镇各拥重兵，朝中党争不息。', goal: '驾驭四镇，守住长江，再图恢复' },
  { id: 'qing', name: '大清', stars: 2, z: 1.2, line: '铁骑新入关，天下尚未归心。', situation: '清军入北京。大顺西撤，江南另立新君。', goal: '先逐大顺，再定江南，一统天下' },
  { id: 'shun', name: '大顺', stars: 5, z: 1.3, line: '山海关新败，退守关中。', situation: '李自成弃北京西走。清军与吴三桂紧追不舍。', goal: '择地站稳，收拾人心，再争天下' },
  { id: 'xi', name: '张献忠部', stars: 3, z: 1.3, line: '溯江入蜀，天府之国就在眼前。', situation: '西营兵临夔州。四川明军单薄，成都可图。', goal: '取成都，建大西，进而争雄' },
  { id: 'zheng', name: '福建郑氏', stars: 3, z: 1.5, line: '海上船队与贸易都在手里。', situation: '郑芝龙受明封爵，海舶无郑氏令旗不得往来。', goal: '以海养兵，奉明还是自立，由你决定' },
];

/** 内联图标元素 */
export const ic = (name: string, cls = 'ic') => { const s = h('span', { style: { display: 'contents' } }); s.innerHTML = iconSvg(name, cls); return s; };
/** 人物像 */
export function face(s: GameState, id: string | undefined, size = 40, cls = 'face'): HTMLElement {
  const c = id ? s.chars[id] : undefined;
  if (!c) return h('div', { class: cls + ' empty', style: { width: size + 'px', height: size + 'px' } });
  const f = s.factions[c.faction];
  return h('img', { class: cls, src: portrait(c, f?.color ?? '#6a5a48', f?.polity ?? 'none'), alt: c.name, draggable: 'false', style: { width: size + 'px', height: Math.round(size * (cls === 'face' ? 1 : 1.25)) + 'px' } });
}
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
    try { this.hintStep = Number(localStorage.getItem(HINT_KEY) ?? 0) >= 4 ? 9 : 0; } catch { this.hintStep = 0; }
    const loop = (t: number) => { this.map.render(t); this.placeRing(); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    this.bindTips();
    document.addEventListener('contextmenu', e => { if (!(e.target as HTMLElement).closest('input, textarea')) e.preventDefault(); });
    document.addEventListener('pointerdown', e => { if (!$('#menu').classList.contains('hidden') && !(e.target as HTMLElement).closest('#menu, #btn-menu')) this.toggleMenu(false); });
    this.showTitle();
    (window as any).NM = this; // 调试与自动化测试入口
    (window as any).NM_nodePt = nodePt;
    (window as any).NM_presets = { createGame, yangzhouSiegeState, name: nodeName };
    (window as any).NM_audio = audioState;
    // 自动化测试：直接打一场指定的仗
    (window as any).NM_testBattle = async (kind: 'field' | 'siege' | 'naval', side: 'att' | 'def' = 'def', terrain?: 'plain' | 'hills' | 'river', weather?: 'clear' | 'rain' | 'wind' | 'fog') => {
      const { createBattle, makeSide } = await import('../core/battle');
      const s = this.s!;
      const sd = (f: string, cmd: string, t: number, navy: number) => makeSide({ faction: f, name: s.factions[f].name, commander: cmd, commanderName: s.chars[cmd]?.name ?? '守将', tong: 60, mou: 55, wai: 50, surrender: 20,
        mix: navy ? { inf: 0.4, cav: 0, gun: 0.2, navy: 0.4 } : { inf: 0.6, cav: 0.25, gun: 0.15, navy: 0 }, stratagems: 2, armies: [], garrison: kind === 'siege', troops: t, morale: 70 });
      const b = createBattle({ id: 'test', kind, node: 'zhenjiang', nodeName: '镇江', terrain: kind === 'naval' ? 'water' : kind === 'siege' ? 'city' : terrain ?? 'plain', weather: weather ?? 'wind',
        att: sd('qing', 'duoduo', 30000, kind === 'naval' ? 1 : 0), def: sd(s.player, s.factions[s.player].leader, 26000, kind === 'naval' ? 1 : 0), wall: 70, seed: 11 });
      return playBattle(s, b, side, false);
    };
  }

  /* ================= 标题 ================= */
  titleTimer = 0;
  showTitle() {
    const t = $('#title');
    t.classList.remove('gone');
    clear(t);
    $('#pick')?.remove(); $('#intro')?.remove();
    this.s = null;
    this.endTarget();
    this.map.view.state = createGame('hongguang', 1);
    this.map.view.selected = null; this.map.view.highlight = null; this.map.view.beacon = null;
    this.map.focus('wuchang', 1.1);
    for (const id of ['#panel', '#report', '#hint', '#legend', '#menu', '#armybar', '#ring']) $(id)?.classList.add('hidden');
    clear($('#orders'));
    clear($('#topbar')).className = '';
    setScene('title');
    // 背景地图缓缓巡游
    const tour = ['nanjing', 'yangzhou', 'beijing', 'xian', 'chengdu', 'wuchang', 'fuzhou', 'guangzhou', 'kunming'];
    let ti = 0;
    clearInterval(this.titleTimer);
    this.map.flyTo(tour[0], 1.5);
    this.titleTimer = window.setInterval(() => { if (this.s) { clearInterval(this.titleTimer); return; } ti = (ti + 1) % tour.length; this.map.flyTo(tour[ti], 1.3 + (ti % 3) * 0.25); }, 4200);
    const auto = loadFrom(this.kv, 'auto');
    const embers = h('div', { class: 'embers' });
    for (let k = 0; k < 28; k++) embers.append(h('i', { style: { left: (Math.random() * 100) + '%', animationDelay: (Math.random() * 8) + 's', animationDuration: (6 + Math.random() * 6) + 's', transform: `scale(${0.5 + Math.random()})` } }));
    const round = (id: string, icon: string, tip: string, onclick: () => void) => h('button', { class: 'tbtn', id, 'data-tip': tip, 'aria-label': tip, onclick: () => { click(); onclick(); } }, ic(icon));
    t.append(embers, h('div', { class: 'title-in' },
      h('div', { class: 'logo' }, h('div', { class: 't' }, h('span', { class: 'ch' }, '南'), h('span', { class: 'ch red' }, '明')), h('div', { class: 'seal' }, '甲申以后'), h('div', { class: 'years' }, '一六四四 — 一六六二')),
      h('div', { class: 'title-actions' },
        h('button', { class: 'big-start', id: 'btn-new', onclick: () => { click(); this.showPick(); } }, h('span', { class: 'glow' }), h('b', null, '开 始')),
        auto ? h('button', { class: 'cont', id: 'btn-continue', onclick: () => { click(); this.start(auto.state, false); } }, ic('play'), h('div', null, h('b', null, '继续'), h('small', null, auto.label))) : null,
        h('div', { class: 'title-icons' },
          round('btn-load', 'load', '读档', () => this.openSaves(true)),
          round('btn-about', 'help', '玩法', () => this.openAbout()),
          round('btn-sound-t', isMuted() ? 'mute' : 'sound', '声音', () => { setMuted(!isMuted()); this.showTitle(); }))),
      h('div', { class: 'credit' }, '一尾小石斑 作 · ', h('button', { class: 'linkish', id: 'btn-sample', onclick: () => this.start(yangzhouSiegeState(), false, 'yangzhou') }, '地图样稿：扬州被围')),
    ));
    const tl = gsap.timeline({ defaults: { clearProps: 'transform,filter' } });
    tl.from('#title .ch', { opacity: 0, y: 40, scale: 1.4, filter: 'blur(12px)', duration: 0.9, stagger: 0.25, ease: 'power3.out' })
      .from('#title .seal', { opacity: 0, scale: 2.4, rotate: -25, duration: 0.45, ease: 'back.out(2.5)' }, '-=0.2')
      .from('#title .years', { opacity: 0, y: 10, duration: 0.5 }, '-=0.1')
      .from('#title .big-start', { opacity: 0, scale: 0.6, duration: 0.6, ease: 'back.out(1.8)' }, '-=0.2')
      .from('#title .cont, #title .tbtn, #title .credit', { opacity: 0, y: 14, duration: 0.35, stagger: 0.06 }, '-=0.3');
  }

  /* ================= 择一方 ================= */
  showPick() {
    const st = createGame('hongguang', 1);
    this.map.view.state = st;
    clearInterval(this.titleTimer);
    setScene('pick');
    gsap.to('#title .title-in', { opacity: 0, y: -20, duration: 0.3 });
    let chosen = '';
    const goLabel = h('span', { class: 'lbl' }, '开 局');
    const go = h('button', { class: 'pick-go', id: 'pick-go', disabled: true, onclick: () => { if (chosen) begin(chosen); } }, ic('next'), goLabel) as HTMLButtonElement;
    const begin = (id: string) => { click(); el.remove(); $('#title').classList.add('gone'); this.start(createGame(id, Date.now() % 100000), true); };
    const cards = h('div', { class: 'pick-cards' });
    for (const info of PICK) {
      const f = st.factions[info.id];
      const pol = POLITIES[f.polity];
      const leader = st.chars[f.leader];
      const n = citiesOf(st, info.id).length;
      const troops = citiesOf(st, info.id).reduce((m, c) => m + c.garrison, 0) + Object.values(st.armies).filter(a => a.faction === info.id).reduce((m, a) => m + a.troops, 0);
      const card = h('button', { class: 'pcard', id: 'pick-' + info.id, style: { '--fc': f.color } as any,
        onclick: () => { click(); chosen = info.id; cards.querySelectorAll('.pcard').forEach(c => c.classList.toggle('on', c === card)); go.disabled = false; goLabel.textContent = `以${f.short}开局`; },
        ondblclick: () => begin(info.id),
        onmouseenter: () => { hoverPluck(PICK.indexOf(info)); this.map.view.highlight = info.id; this.map.flyTo(f.capital, info.z); } },
      h('div', { class: 'pseal' }, h('i', null, pol.mark || f.short)),
      h('div', { class: 'pname' }, info.name),
      h('div', { class: 'plead' }, `${leader?.name ?? ''} · ${nodeName(f.capital)}`),
      h('div', { class: 'pstars', 'aria-label': `难度 ${info.stars}` }, ...Array.from({ length: 5 }, (_, i) => h('i', { class: i < info.stars ? 'on' : '' }))),
      h('div', { class: 'pline' }, info.line),
      h('div', { class: 'pstat' }, h('span', null, ic('city'), `${n} 城`), h('span', null, ic('troops'), wan(troops))));
      cards.append(card);
    }
    const el = h('div', { id: 'pick' },
      h('div', { class: 'pick-h' }, h('h1', null, '择 一 方'), h('small', null, '甲申年五月 · 北京失守的消息传到南京')),
      cards,
      h('div', { class: 'pick-f' }, h('button', { class: 'pick-back', onclick: () => { el.remove(); this.map.view.highlight = null; this.showTitle(); } }, ic('exit'), '返回'), go));
    $('#app').append(el);
    gsap.from('#pick .pick-h', { opacity: 0, y: -20, duration: 0.4 });
    gsap.from('#pick .pcard', { opacity: 0, y: 60, rotateX: -35, duration: 0.55, stagger: 0.08, ease: 'back.out(1.5)', delay: 0.1, clearProps: 'transform,opacity' });
    gsap.from('#pick .pick-f', { opacity: 0, y: 20, duration: 0.4, delay: 0.5 });
  }

  /** 开局过场：年月、势力印、一句处境 */
  playIntro(): Promise<void> {
    return new Promise(resolve => {
      const s = this.s!;
      const me = s.factions[s.player];
      const pol = polityOf(s, me.polity);
      const info = PICK.find(p => p.id === s.player);
      const el = h('div', { id: 'intro' },
        h('div', { class: 'bar top' }), h('div', { class: 'bar bot' }),
        h('div', { class: 'intro-in' },
          h('div', { class: 'i-date' }, `${eraYear(pol, s.turn)}${monthName(lunarOf(s.turn))}`),
          h('div', { class: 'i-seal', style: { background: me.color } }, pol.mark || me.short),
          h('div', { class: 'i-name' }, me.name),
          h('div', { class: 'i-line' }, info?.situation ?? ''),
          h('div', { class: 'i-goal' }, ic('goal'), info?.goal ?? '统一天下'),
          h('div', { class: 'i-skip' }, '点击继续')));
      let done = false;
      const end = () => { if (done) return; done = true; gsap.to(el, { opacity: 0, duration: 0.5, onComplete: () => { el.remove(); resolve(); } }); this.map.flyTo(me.capital, 2.1); };
      el.onclick = end;
      $('#app').append(el);
      introSfx();
      this.map.focus(me.capital, 0.9);
      gsap.from('#intro .bar.top', { yPercent: -100, duration: 0.6, ease: 'power3.out' });
      gsap.from('#intro .bar.bot', { yPercent: 100, duration: 0.6, ease: 'power3.out' });
      gsap.from('#intro .i-date', { opacity: 0, letterSpacing: '1em', scale: 1.4, duration: 1.1, ease: 'power3.out', delay: 0.2 });
      gsap.from('#intro .i-seal', { opacity: 0, scale: 3, rotate: -30, duration: 0.5, ease: 'back.out(2)', delay: 0.9 });
      gsap.from('#intro .i-name, #intro .i-line, #intro .i-goal', { opacity: 0, y: 16, duration: 0.5, stagger: 0.25, delay: 1.2 });
      gsap.from('#intro .i-skip', { opacity: 0, duration: 0.6, delay: 2.2 });
      setTimeout(end, 5200);
    });
  }

  start(state: GameState, fresh: boolean, focus?: string) {
    this.s = state;
    this.orders = [];
    this.seq = 0;
    this.reportTurn = state.turn - 1;
    this.lastPills = {};
    clearInterval(this.titleTimer);
    $('#pick')?.remove();
    this.map.view.highlight = null;
    gsap.to('#title', { opacity: 0, duration: 0.35, onComplete: () => { $('#title').classList.add('gone'); ($('#title') as HTMLElement).style.opacity = ''; } });
    this.map.view.state = state;
    this.map.view.selected = null;
    this.map.view.selectedArmy = null;
    this.map.view.beacon = null;
    this.musicForState();
    this.map.focus(focus ?? state.factions[state.player].capital, focus ? 2.4 : 2.0);
    this.renderAll();
    if (focus) this.selectNode(focus);
    if (fresh) {
      this.hintStep = this.hintStep >= 9 ? 9 : 0;
      void this.playIntro().then(() => { if (this.s === state) this.showHint(); });
    } else if (state.reports.some(r => r.turn === state.turn - (state.ended ? 0 : 1))) { this.reportTurn = state.turn - (state.ended ? 0 : 1); this.openReport(); }
    if (fresh) this.autoSave();
    // 读到已结束的局势：重新打开结局面板，按结局允许的操作继续
    if (state.ended) this.showEnd();
  }

  /** 地图配乐：按玩家所奉政权换调式与主奏，按局势紧张度加层 */
  musicForState() {
    const s = this.s;
    if (!s) return;
    if (s.ended) { setScene(s.ended.kind === 'unified' ? 'victory' : s.ended.kind === 'fallen' ? 'lament' : 'map', s.factions[s.player].polity, s.seed); return; }
    setScene('map', s.factions[s.player].polity, s.seed, isCoastal(s), eraOf(lunarOf(s.turn).year));
    setIntensity(dangerOf(s));
  }

  /* ================= 地图交互 ================= */
  bindMap(canvas: HTMLCanvasElement) {
    canvas.addEventListener('pointerdown', e => { if (e.button !== 0) return; this.drag = { x: e.clientX, y: e.clientY, moved: false }; canvas.setPointerCapture(e.pointerId); });
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
      if (e.button !== 0) return;
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
    // 右键：选中军队时，右键点城即出征
    canvas.addEventListener('contextmenu', e => {
      e.preventDefault();
      if (!this.s || this.resolving) return;
      const id = this.map.view.selectedArmy;
      const a = id ? this.s.armies[id] : null;
      if (!a || !this.isMineOrVassal(a.faction)) return;
      const r = canvas.getBoundingClientRect();
      const p = this.map.pick(e.clientX - r.left, e.clientY - r.top);
      const node = p?.kind === 'node' ? p.id : p?.kind === 'army' ? this.s.armies[p.id]?.location : null;
      if (node) { this.endTarget(); this.issueMarch(a.id, node); }
    });
    canvas.addEventListener('pointerleave', () => { this.hideTip(); this.map.view.hover = null; });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const r = canvas.getBoundingClientRect();
      this.map.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
  }

  /** 提示气泡：统一用游戏样式，不用浏览器自带的 title 小黄条 */
  bindTips() {
    const tip = h('div', { id: 'gtip', class: 'hidden' });
    document.body.append(tip);
    let cur: HTMLElement | null = null;
    document.addEventListener('pointerover', e => {
      const el = (e.target as HTMLElement).closest?.('[data-tip], [title]') as HTMLElement | null;
      if (el && el.hasAttribute('title')) { el.dataset.tip = el.getAttribute('title')!; el.removeAttribute('title'); }
      if (!el || !el.dataset.tip || el.id === 'map') { tip.classList.add('hidden'); cur = null; return; }
      if (el === cur) return;
      cur = el;
      tip.textContent = el.dataset.tip;
      tip.classList.remove('hidden');
      const r = el.getBoundingClientRect(), w = tip.offsetWidth, hh = tip.offsetHeight;
      let x = r.left + r.width / 2 - w / 2, y = r.bottom + 8;
      if (y + hh > window.innerHeight - 6) y = r.top - hh - 8;
      x = Math.max(6, Math.min(window.innerWidth - w - 6, x));
      tip.style.left = x + 'px'; tip.style.top = y + 'px';
    });
    document.addEventListener('pointerdown', () => { tip.classList.add('hidden'); cur = null; });
  }

  onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const modalOpen = !$('#modal').classList.contains('hidden');
    if (e.key === 'Tab') {
      // 焦点困在最上层的窗口里，不落到背后的地图与城池面板
      const layer = modalOpen ? $('#modal') : !$('#menu').classList.contains('hidden') ? $('#menu') : null;
      if (layer) {
        const f = [...layer.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex]:not([tabindex="-1"]), input')].filter(x => x.offsetParent !== null);
        if (f.length) {
          const i = f.indexOf(document.activeElement as HTMLElement);
          const j = i < 0 ? 0 : (i + (e.shiftKey ? -1 : 1) + f.length) % f.length;
          e.preventDefault(); f[j].focus();
        } else e.preventDefault();
        return;
      }
    }
    if (e.key === 'Escape') {
      if (!$('#menu').classList.contains('hidden')) this.toggleMenu(false);
      else if (this.targetCb) this.endTarget();
      else if (modalOpen) { if (!this.forcedModal) this.closeModal(); }
      else this.closePanel();
      return;
    }
    if (this.forcedModal && /^[1-9]$/.test(e.key)) { ($(`#modal .opt[data-choice="${+e.key - 1}"]`) as HTMLElement | null)?.click(); return; }
    if (!this.s || this.resolving || !$('#modal').classList.contains('hidden')) return;
    if (e.key === 'r' || e.key === 'R') this.toggleReport();
    const sel = this.map.view.selectedArmy;
    if (sel && (e.key === 'm' || e.key === 'M')) $('#ring-march')?.click();
    if (sel && (e.key === 'h' || e.key === 'H')) $('#ring-hold')?.click();
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
      if (this.map.view.targeting) {
        const mi = this.marchInfo(this.map.view.targeting.army, p.id);
        tip.className = 'hud march';
        clear(tip).append(h('div', { class: 'tt-h' }, h('span', { style: { width: '12px', height: '12px', borderRadius: '50%', background: f.color, display: 'inline-block', border: '1.5px solid #fff' } }), n.name, h('small', null, `${f.short}${mi.rel === 'war' ? ' · 敌' : mi.rel === 'friend' ? ' · 友' : ' · 未交战'}`)));
        if (!mi.path) tip.append(h('div', { class: 'mc-warn' }, ic('close'), '无路可达'));
        else {
          tip.append(h('div', { class: 'mc-days' }, h('b', null, String(mi.days)), ' 日', h('span', null, mi.days > 30 ? `约 ${Math.ceil(mi.days / 30)} 个月` : '本月可到')));
          if (mi.days > 30 && mi.reach) tip.append(h('div', { class: 'tt-r' }, ic('calendar'), h('b', null, `本月行至${nodeName(mi.reach)}`)));
          if (mi.blocked.length) tip.append(h('div', { class: 'mc-warn' }, ic('siege'), `途经敌城：${mi.blocked.map(nodeName).join('、')}，须先攻下`));
          if (mi.land) tip.append(h('div', { class: 'mc-warn' }, ic('navy'), `须在${nodeName(mi.land)}舍舟登岸，水师改为步卒`));
          if (mi.rel === 'neutral') tip.append(h('div', { class: 'mc-warn' }, ic('war'), `与${s.factions[c.controller].short}未交战，进攻须宣战`));
          tip.append(h('div', { class: 'mc-act' }, mi.rel === 'war' ? '左键：进攻' : mi.rel === 'friend' ? '左键：开赴' : '左键：宣战或开赴'));
        }
      }
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

  /** 行军估算：天数、本月走到哪、途经敌城、与目标的关系 */
  marchInfo(armyId: string, node: string): { path: string[] | null; days: number; reach: string | null; blocked: string[]; rel: 'war' | 'friend' | 'neutral'; land?: string | null } {
    const s = this.s!, a = s.armies[armyId];
    const start = a.progress > 0 && a.path.length ? a.path[0] : a.location;
    const p0 = shortestPath(start, node, canSea(a));
    const path = p0 ? (a.progress > 0 && a.path.length ? [a.path[0], ...p0] : p0) : null;
    const ctrl = s.cities[node].controller;
    const rel = hostile(s, a.faction, ctrl) ? 'war' : friendly(s, a.faction, ctrl) ? 'friend' : 'neutral';
    if (!path) return { path, days: 0, reach: null, blocked: [], rel };
    const plan = marchPlan(a.location, path, a.progress);
    const reach = [...plan].reverse().find(x => x.day <= 30)?.node ?? null;
    const blocked = path.slice(0, -1).filter(id => hostile(s, a.faction, s.cities[id]?.controller ?? '') && s.cities[id].garrison > 0);
    // 水师途经陆路：要舍舟登岸
    let land: string | null = null;
    if (a.mix.navy > 0) { let c = a.location; for (const p of path) { if (routeBetween(c, p)?.kind === 'land') { land = c; break; } c = p; } }
    return { path, days: plan.length ? plan[plan.length - 1].day : 0, reach, blocked, rel, land };
  }
  /** 出征：敌城即进攻，友城即开赴，未交战则问是否宣战 */
  issueMarch(armyId: string, node: string, force?: 'move' | 'attack') {
    const s = this.s!, a = s.armies[armyId];
    if (!a) return;
    const vassal = a.faction !== s.player;
    const mi = this.marchInfo(armyId, node);
    if (!mi.path) { this.toast('无路可达', 'close'); return; }
    if (node === a.location && mi.rel !== 'war') { this.addOrder({ id: this.newOrderId(), kind: 'army', army: armyId, order: { kind: 'hold' } }); return; }
    const send = (attack: boolean) => {
      const order = node === a.location && attack ? { kind: 'siege' as const, target: node, assault: true } : { kind: 'move' as const, target: node, attack };
      if (vassal) this.formCommand(armyId, order); else this.addOrder({ id: this.newOrderId(), kind: 'army', army: armyId, order });
    };
    if (mi.rel === 'war') { send(force !== 'move'); return; }
    if (mi.rel === 'friend' || force === 'move') { send(false); return; }
    const tgt = s.cities[node].controller, top = s.factions[tgt]?.overlord && !s.factions[s.factions[tgt].overlord!]?.defunct ? s.factions[tgt].overlord! : tgt;
    const tf = s.factions[top];
    this.modal('war', `向${tf.short}宣战？`, `${nodeName(node)}属${s.factions[tgt].name}，两家尚未交兵`, [
      h('div', { class: 'war-ask' }, h('div', { class: 'wa-seal', style: { background: s.factions[s.player].color } }, polityOf(s, s.factions[s.player].polity).mark || s.factions[s.player].short), h('i', null, ic('war')), h('div', { class: 'wa-seal', style: { background: tf.color } }, polityOf(s, tf.polity).mark || tf.short)),
      h('div', { class: 'note', style: { textAlign: 'center' } }, `宣战后${tf.name}全境与你为敌，军队行至${nodeName(node)}即攻城。行程 ${mi.days} 日${mi.days > 30 ? `（约 ${Math.ceil(mi.days / 30)} 个月）` : ''}。`),
    ], [
      this.cancelBtn(),
      { label: '只开赴，不进攻', icon: 'move', onclick: () => { send(false); } },
      { label: '宣战并进攻', icon: 'war', primary: true, id: 'war-ok', onclick: () => { this.addOrder({ id: this.newOrderId(), kind: 'war', target: top }); send(true); } },
    ]);
  }

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
      if (o.kind === 'trade' && o.node === node) { const q = tradeQuote(this.s!, this.s!.cities[node], o.grain); if (field === 'silver') n += o.grain > 0 ? q.silver : -q.silver; else n += -o.grain; }
      if (o.kind === 'loan' && o.node === node && field === 'silver') n -= loanAmount(this.s!, this.s!.cities[node]);
      if (o.kind === 'transfer' && o.from === node) n += field === 'grain' ? o.grain : o.silver;
      if ((o.kind === 'reward' || o.kind === 'command') && this.s!.factions[this.s!.player].capital === node && field === 'silver') n += o.silver;
    }
    return n;
  }
  newOrderId() { return `o${this.s!.turn}-${++this.seq}`; }
  addOrder(o: Order) {
    const s = this.s!;
    const rest = this.orders.filter(x => !(x.kind === o.kind && sameTarget(x, o)));
    const err = validateOrder(s, s.player, o);
    if (err) { this.toast(err, 'close'); return false; }
    const bud = orderBudget(s, s.player);
    if (ordersUsed(rest) + orderCost(o) > bud.total) {
      this.toast(`本月政令已满（${bud.total} 道）。可撤下一道再下；调动军队不占政令。`, 'close');
      gsap.fromTo('#pill-orders', { scale: 1.3 }, { scale: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
      return false;
    }
    this.orders = rest;
    this.orders.push(o);
    click();
    this.toast(describeOrder(s, o), ORDER_ICON[o.kind]);
    this.renderOrders(); this.renderTop(); this.refreshPanel(); this.renderArmyBar();
    if (this.hintStep <= 1) this.advanceHint(2);
    this.orderFx(o);
    return true;
  }
  /** 下令的反馈：在地图上落印、粮车出发、目标处涟漪；命令条从上方落入 */
  orderFx(o: Order) {
    const s = this.s!;
    const m = this.map;
    const fac = s.factions[s.player];
    const stamp = (node: string | undefined, text: string, color = '#c8352a') => { if (node && s.cities[node]) m.addFx({ kind: 'stamp', node, text, color, dur: 1200 }); };
    stampSfx(); orderSfx(o.kind);
    switch (o.kind) {
      case 'policy': m.addFx({ kind: 'card', node: o.node, img: cardArt(POLICY_ICON[o.policy], '#8c6a35', 0), text: POLICY_NAME[o.policy], dur: 2000 }); stamp(o.node, '政'); break;
      case 'recruit': m.addFx({ kind: 'march', node: o.node, color: fac.color, dur: 1800 }); m.addFx({ kind: 'float', node: o.node, text: `+${o.troops} 兵`, color: '#bfe6b7', dur: 1500, delay: 500 }); break;
      case 'appoint': { const c = s.chars[o.char]; m.addFx({ kind: 'card', node: o.node, img: portrait(c, fac.color, fac.polity), text: c.name, dur: 2000 }); stamp(o.node, '任'); break; }
      case 'transfer': { const p = shortestPath(o.from, o.to, false); if (p) m.addFx({ kind: 'convoy', node: o.from, path: [o.from, ...p], text: o.grain ? 'grain' : 'silver', dur: 1600 }); stamp(o.from, '调'); break; }
      case 'army': case 'command': {
        const a = s.armies[o.army];
        stamp(a?.location, o.kind === 'command' ? '令' : '军');
        if (o.order.kind !== 'hold') m.addFx({ kind: 'ripple', node: o.order.target, color: o.order.kind === 'move' && !o.order.attack ? '#f0cf86' : '#e0503f', dur: 1400, delay: 250 });
        break;
      }
      case 'reinforce': stamp(o.node, '兵'); break;
      case 'envoy': m.addFx({ kind: 'treaty', node: s.factions[o.target]?.capital, color: fac.color, color2: s.factions[o.target]?.color, text: '使', dur: 2200 }); break;
      case 'persuade': stamp(o.node, '降', '#2f6f8f'); break;
      case 'reward': stamp(s.factions[o.vassal]?.capital, '赏', '#b0702a'); break;
      case 'independence': stamp(fac.capital, '立'); break;
      case 'war': stamp(s.factions[o.target]?.capital, '战', '#8f2015'); break;
      case 'raise': stamp(o.node, '兵'); m.addFx({ kind: 'float', node: o.node, text: `出兵 ${o.troops}`, color: '#f0cf86', dur: 1500, delay: 200 }); break;
    }
    const chip = $('#orders').lastElementChild as HTMLElement | null;
    if (chip) gsap.from(chip, { y: -60, scale: 1.4, opacity: 0, duration: 0.45, ease: 'back.out(1.8)' });
    const btn = $('#btn-next');
    if (btn) gsap.fromTo(btn, { scale: 1.08 }, { scale: 1, duration: 0.35, ease: 'power2.out' });
  }
  removeOrder(id: string) { this.orders = this.orders.filter(o => o.id !== id); this.renderOrders(); this.renderTop(); this.refreshPanel(); this.renderArmyBar(); }
  toast(text: string, icon = 'info') {
    if (icon === 'close') denySfx();
    const el = h('div', { class: 'hud' }, ic(icon), text);
    $('#toast').append(el);
    gsap.from(el, { y: -16, opacity: 0, scale: 0.9, duration: 0.3, ease: 'back.out(2)' });
    setTimeout(() => el.remove(), 3300);
  }

  /* ================= 顶栏 ================= */
  renderAll() { this.renderTop(); this.renderOrders(); this.refreshPanel(); this.updatePlanned(); this.renderArmyBar(); }

  /** 月末结算期间按住顶栏旧数 */
  holdPills = false;
  renderTop() {
    const s = this.s!;
    const top = clear($('#topbar'));
    top.className = 'hud';
    const me = s.factions[s.player];
    const pol = polityOf(s, me.polity);
    const cap = s.cities[me.capital];
    const own = Object.values(s.cities).filter(c => c.controller === s.player);
    const troops = own.reduce((n, c) => n + c.garrison, 0) + Object.values(s.armies).filter(a => a.faction === s.player).reduce((n, a) => n + a.troops, 0);
    const lm = lunarOf(s.turn);
    const pips = h('div', { class: 'pips' });
    if (s.scenario === 'trial' && s.turnLimit) for (let i = 0; i < s.turnLimit; i++) pips.append(h('i', { class: i < s.turn ? 'on' : i === s.turn ? 'now' : '' }));
    // 完整剧本不显示进度条：不一上来就告诉玩家最多能玩多久，只显示当下的年月
    const unread = s.reports.filter(r => r.turn === s.turn - 1 && r.urgent && (!r.faction || r.faction === s.player)).length;
    const ib = (id: string, icon: string, tip: string, onclick: () => void, extra?: { on?: boolean; badge?: number }) =>
      h('button', { class: 'ibtn' + (extra?.on ? ' on' : ''), id, 'data-tip': tip, 'aria-label': tip, onclick: () => { click(); onclick(); } }, ic(icon), extra?.badge ? h('span', { class: 'badge' }, String(extra.badge)) : null);
    const pill = (icon: string, val: string, label: string, tip: string, raw?: number) => {
      const fmt = (v: number) => (icon === 'city' ? String(Math.round(v)) : wan(v));
      const key = 'pill:' + icon;
      const prev = this.lastPills[key];
      // 月末结算时先按住旧数，等翻月与号令回报演完再滚到新数（见 endTurn）
      if (this.holdPills && prev !== undefined) return h('div', { class: 'pill', 'data-tip': tip }, ic(icon), h('b', null, fmt(prev)), h('small', null, label));
      const b = h('b', null, val);
      const el = h('div', { class: 'pill', 'data-tip': tip }, ic(icon), b, h('small', null, label));
      if (raw !== undefined && prev !== undefined && Math.round(prev) !== Math.round(raw)) {
        const o = { v: prev }, up = raw > prev;
        gsap.to(o, { v: raw, duration: isReduced() ? 0.01 : 1.2, ease: 'power2.out', onUpdate: () => { b.textContent = fmt(o.v); }, onComplete: () => { b.textContent = val; } });
        gsap.fromTo(b, { color: up ? '#9fe08f' : '#ff9a8a', scale: 1.3 }, { color: '#f3e6c8', scale: 1, duration: 1.4 });
        const d = raw - prev;
        const tag = h('span', { class: 'pill-d ' + (up ? 'up' : 'down') }, (up ? '+' : '−') + fmt(Math.abs(d)));
        el.append(tag);
        gsap.fromTo(tag, { y: 6, opacity: 0 }, { y: -14, opacity: 1, duration: 0.4, ease: 'back.out(2)' });
        gsap.to(tag, { opacity: 0, y: -24, delay: isReduced() ? 1 : 2.4, duration: 0.6, onComplete: () => tag.remove() });
      }
      if (raw !== undefined) this.lastPills[key] = raw;
      return el;
    };
    const u = unificationProgress(s);
    const store = storeOf(s, s.player);
    const spendAll = (f: 'grain' | 'silver') => own.reduce((n, c) => n + this.pendingSpend(c.id, f), 0);
    top.append(
      h('div', { class: 'emblem', 'data-tip': me.name, style: { background: `radial-gradient(circle at 35% 30%, ${shade(me.color, 0.25)}, ${shade(me.color, -0.45)})` } }, pol.mark || me.short),
      h('div', { class: 'datebox' },
        h('div', null, h('div', { class: 'era', id: 'date-label', title: dateLabel(pol, s.turn) }, `${eraYear(pol, s.turn)}${monthName(lm)}`), h('div', { class: 'yr' }, `${me.short} · 公元 ${lm.year}`), pips)),
      h('div', { class: 'res' },
        pill('silver', wan(store.silver - spendAll('silver')), '两', `${me.short}府库：所辖 ${store.cities} 城存银之和（各城钱粮分存，调拨须走粮道）· ${nodeName(me.capital)}存 ${wan(cap?.silver ?? 0)}`, store.silver - spendAll('silver')),
        pill('grain', wan(store.grain - spendAll('grain')), '石', `${me.short}仓粮：所辖 ${store.cities} 城存粮之和 · ${nodeName(me.capital)}存 ${wan(cap?.grain ?? 0)}`, store.grain - spendAll('grain')),
        pill('city', String(own.length), '城', `直辖城池 · 统一进度 ${u.held}/${u.total}`, own.length),
        (() => { const b = orderBudget(s, s.player), used = ordersUsed(this.orders); const el = h('div', { class: 'pill orders-pill' + (used >= b.total ? ' full' : ''), id: 'pill-orders', 'data-tip': `本月政令 ${used} / ${b.total} 道（${b.factors.join('，')}）。调动军队不占政令；方针定下后逐月照行，不必每月重下。` }, ic('policy'), h('b', null, `${b.total - used}`), h('small', null, `/${b.total} 令`)); return el; })(),
        pill('troops', wan(troops), '兵', '直辖兵力', troops),
      ),
      h('div', { class: 'spacer' }),
      ib('btn-report', 'report', '军情（R）', () => this.toggleReport(), { badge: unread }),
      ib('btn-factions', 'factions', '天下', () => this.openFactions()),
      ib('btn-chars', 'chars', '人物', () => this.openChars()),
      ib('btn-menu', 'menu', '菜单', () => this.toggleMenu(), { on: !$('#menu').classList.contains('hidden') }),
      h('button', { class: 'endturn' + (this.orders.length && !this.resolving ? ' ready' : '') + (this.hintStep === 2 ? ' beckon' : ''), id: 'btn-next', disabled: this.resolving || !!s.ended, onclick: () => void this.endTurn() },
        ic(this.resolving ? 'hourglass' : 'next'), h('span', null, s.ended ? '本局结束' : this.resolving ? '行动中' : '结束本月'),
        this.orders.length ? h('span', { class: 'badge' }, String(this.orders.length)) : null),
    );
  }

  /** 菜单：存档、图例、战斗方式、声音、玩法、回到标题 */
  toggleMenu(force?: boolean) {
    const el = $('#menu');
    let show = force ?? el.classList.contains('hidden');
    if (show && this.forcedModal) show = false;   // 史事决断未答时，不许另开菜单把它盖掉
    el.classList.toggle('hidden', !show);
    if (show) {
      const row = (id: string, icon: string, label: string, sub: string, onclick: () => void) => h('button', { class: 'mrow', id, onclick: () => { click(); onclick(); } }, ic(icon), h('div', null, h('b', null, label), h('small', null, sub)));
      clear(el).append(
        row('btn-save', 'save', '存档 · 读档', '三个栏位，可导出文件', () => { this.toggleMenu(false); this.openSaves(false); }),
        row('btn-legend', 'map', '图例', '色块、旗记、线路的意思', () => { this.toggleMenu(false); this.toggleLegend(); }),
        row('btn-battle', this.autoBattle ? 'auto' : 'battle', this.autoBattle ? '战斗：部将自动' : '战斗：亲自指挥', '点此切换', () => { this.autoBattle = !this.autoBattle; this.toggleMenu(true); }),
        row('btn-sound', isMuted() ? 'mute' : 'sound', isMuted() ? '声音：关' : '声音：开', '点此切换', () => { setMuted(!isMuted()); this.toggleMenu(true); }),
        ...(['music', 'amb', 'sfx'] as const).map(k => h('div', { class: 'mvol' }, h('span', null, VOL_NAME[k]),
          h('input', { type: 'range', id: 'vol-' + k, min: 0, max: 100, value: Math.round(getVolumes()[k] * 100), 'aria-label': VOL_NAME[k] + '音量',
            oninput: (e: Event) => setVolume(k, +(e.target as HTMLInputElement).value / 100), onchange: () => { if (k === 'sfx') click(); } }))),
        row('btn-motion', isReduced() ? 'hourglass' : 'play', isReduced() ? '演出：简化' : '演出：完整', reducedSystem ? '系统已设“减少动态效果”' : '简化：不震屏、不飞镜、翻月从速', () => { setReducedMotion(!isReduced()); this.toggleMenu(true); }),
        row('btn-help', 'help', '玩法', '一分钟上手', () => { this.toggleMenu(false); this.openAbout(); }),
        row('btn-title', 'exit', '回到标题', '进度每月自动存档', () => { this.toggleMenu(false); this.confirmTitle(); }),
      );
      gsap.fromTo(el, { opacity: 0, y: -8, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' });
      gsap.from('#menu .mrow', { opacity: 0, x: 12, duration: 0.2, stagger: 0.03 });
    }
    if (this.s) this.renderTop();
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
    if (this.hintStep === 0 && id === this.s!.factions[this.s!.player].capital) this.advanceHint(1);
  }
  selectArmy(id: string) {
    this.map.view.selectedArmy = id;
    this.map.view.selected = this.s!.armies[id]?.location ?? null;
    this.renderArmy(id);
    this.showRing(id);
    this.renderArmyBar();
  }
  closePanel() { $('#panel').classList.add('hidden'); this.map.view.selected = null; this.map.view.selectedArmy = null; this.hideRing(); this.renderArmyBar(); }

  /* ================= 军队栏与军令环 ================= */
  renderArmyBar() {
    const bar = $('#armybar');
    if (!this.s) { bar.classList.add('hidden'); return; }
    const s = this.s;
    clear(bar).classList.remove('hidden');
    const mine = Object.values(s.armies).filter(a => a.faction === s.player);
    const vas = Object.values(s.armies).filter(a => s.factions[a.faction]?.overlord === s.player);
    const chip = (a: typeof mine[number]) => {
      const pend = this.orders.find(o => (o.kind === 'army' || o.kind === 'command') && o.army === a.id);
      const st = pend ? '已下令' : a.path.length ? `行军 · 余 ${Math.max(1, pathDays(a.location, a.path) - a.progress)} 日` : a.order.kind === 'siege' ? (a.order.assault ? '攻城' : '围城') : '驻扎';
      return h('button', { class: 'achip' + (this.map.view.selectedArmy === a.id ? ' on' : '') + (pend ? ' pend' : '') + (a.faction !== s.player ? ' vas' : ''), 'data-army': a.id, 'data-tip': `${a.name} · ${nodeName(a.location)}`,
        onclick: () => { click(); this.selectArmy(a.id); this.map.flyTo(a.location, Math.max(this.map.cam.z, 2)); } },
      face(s, a.commander, 34), h('div', { class: 'ac-t' }, h('b', null, a.name.replace(/部$/, '')), h('small', null, st)), h('span', { class: 'ac-n' }, wan(a.troops)));
    };
    bar.append(h('div', { class: 'ab-h' }, ic('army'), `我军 ${mine.length}`));
    for (const a of mine) bar.append(chip(a));
    if (vas.length) { bar.append(h('div', { class: 'ab-h' }, ic('urgent'), `诸镇 ${vas.length}`)); for (const a of vas) bar.append(chip(a)); }
    if (!mine.length && !vas.length) bar.append(h('div', { class: 'ab-none' }, '尚无野战军：点一座城，用“出兵”从驻军编成新军'));
  }
  showRing(id: string) {
    const s = this.s!, a = s.armies[id];
    const ring = $('#ring');
    if (!a || !this.isMineOrVassal(a.faction) || this.resolving) { this.hideRing(); return; }
    const vassal = a.faction !== s.player;
    const here = s.cities[a.location];
    const B = (bid: string, icon: string, label: string, key: string, fn: () => void) => h('button', { class: 'rbtn', id: bid, 'data-tip': `${label}${key ? `（${key}）` : ''}`, onclick: (e: Event) => { e.stopPropagation(); click(); fn(); } }, ic(icon), h('span', null, label));
    const btns: HTMLElement[] = [
      B('ring-march', 'move', vassal ? '开赴' : '出征', 'M', () => this.beginTarget(id, `点选${a.name}要去的城（敌城即进攻）`, n => this.issueMarch(id, n))),
      B('ring-hold', 'hold', '驻扎', 'H', () => vassal ? this.formCommand(id, { kind: 'hold' }) : this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'hold' } })),
    ];
    if (!vassal && a.progress === 0 && here && hostile(s, s.player, here.controller)) {
      btns.push(B('ring-storm', 'storm', '攻城', '', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: true } })));
      btns.push(B('ring-block', 'blockade', '围困', '', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: false } })));
    } else if (!vassal && a.progress === 0 && here?.controller === s.player) btns.push(B('ring-reinforce', 'reinforce', '拨兵', '', () => this.formReinforce(id)));
    if (vassal) btns.push(B('ring-reward', 'reward', '犒赏', '', () => this.formReward(a.faction)));
    clear(ring).append(...btns);
    const n = btns.length, R = 58;
    btns.forEach((b, i) => { const ang = -Math.PI / 2 + (i - (n - 1) / 2) * 0.85; b.style.left = Math.cos(ang) * R + 'px'; b.style.top = Math.sin(ang) * R + 'px'; });
    ring.classList.remove('hidden');
    ring.dataset.army = id;
    this.placeRing();
    gsap.fromTo('#ring .rbtn', { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, stagger: 0.04, ease: 'back.out(2)' });
  }
  hideRing() { const r = $('#ring'); r.classList.add('hidden'); delete r.dataset.army; }
  placeRing() {
    const ring = $('#ring');
    const id = ring.dataset.army;
    if (!id || ring.classList.contains('hidden')) return;
    if (this.map.view.targeting || !this.s?.armies[id]) { ring.style.opacity = '0'; ring.style.pointerEvents = 'none'; return; }
    ring.style.opacity = ''; ring.style.pointerEvents = '';
    const st = this.map.stacks.find(x => x.armies.includes(id));
    if (!st) return;
    ring.style.transform = `translate(${st.sx}px, ${st.sy}px)`;
  }
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
      if (wasHidden) { paper(); gsap.fromTo('#panel', { x: 50, opacity: 0 }, { x: 0, opacity: 1, duration: 0.35, ease: 'power3.out' }); }
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

  /** 面板数字上次显示的值：再显示时从旧值滚到新值，看得出变化的过程 */
  lastNums: Record<string, number> = {};
  tile(icon: string, k: string, v: string, opts: { id?: string; d?: number; meter?: number; unit?: string; raw?: number; key?: string; fmt?: (n: number) => string } = {}): HTMLElement {
    const num = h('span', { class: 'num' }, v);
    const mt = opts.meter !== undefined ? meter(opts.meter, mcol(opts.meter)) : null;
    if (opts.raw !== undefined && opts.key) {
      const prev = this.lastNums[opts.key], raw = opts.raw, fmt = opts.fmt ?? wan;
      this.lastNums[opts.key] = raw;
      if (prev !== undefined && Math.abs(prev - raw) >= 0.5) {
        const o = { v: prev };
        num.textContent = fmt(prev);
        gsap.to(o, { v: raw, duration: isReduced() ? 0.01 : 1.1, ease: 'power2.out', onUpdate: () => { num.textContent = fmt(o.v); }, onComplete: () => { num.textContent = v; } });
        gsap.fromTo(num, { color: raw > prev ? '#9fe08f' : '#ff9a8a' }, { color: '', duration: 1.6, ease: 'power1.in', clearProps: 'color' });
        if (mt && opts.meter !== undefined) { const bar = mt.querySelector('i') as HTMLElement | null; if (bar) gsap.fromTo(bar, { width: Math.max(0, Math.min(100, prev)) + '%' }, { width: Math.max(0, Math.min(100, opts.meter)) + '%', duration: isReduced() ? 0.01 : 1.1, ease: 'power2.out' }); }
      }
    }
    return h('div', { class: 'tile' },
      h('div', { class: 'k' }, ic(icon), k),
      h('div', { class: 'v', id: opts.id }, num, opts.unit ? h('small', null, ' ' + opts.unit) : null),
      mt,
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
    // 主官／守将：有主官画主官；无主官画驻军主将；都没有则是不具名的地方官或守将（不编造人名）
    {
      const govOk = gov && gov.status === 'active' && gov.faction === c.controller ? gov : undefined;
      const army = Object.values(s.armies).filter(a => a.location === id && a.faction === c.controller && a.progress === 0).sort((x, y) => y.troops - x.troops)[0];
      const cmdr = !govOk && army ? s.chars[army.commander] : undefined;
      const person = govOk ?? (cmdr && cmdr.status === 'active' ? cmdr : undefined);
      const mil = n.kind === 'pass' || n.kind === 'ferry';
      const anonTitle = ctrl.id === 'local' ? (mil ? '土豪守将' : '地方士绅') : mil ? '守将' : n.kind === 'port' ? '守备' : NODE[id]?.major ? '知府' : '知县';
      const who = person ?? ({ id: 'anon:' + id, name: '佚名', faction: c.controller, title: anonTitle, ab: { tong: mil ? 60 : 35, zheng: mil ? 30 : 55, mou: 40, wai: 40, wang: 40 }, att: { loyalty: 50, surrender: 50, hawk: 0 }, attLog: [], location: id, status: 'active', bio: '' } as Character);
      const role = govOk ? '主官' : person ? '驻军主将' : '地方' + (mil ? '守将' : '主官');
      banner.append(h('div', { class: 'gov-card' + (person ? ' named' : ''), id: 'city-gov', onclick: person ? () => this.openChar(person.id) : undefined, 'data-tip': person ? '点看人物档案' : '此城未委任主官；可在“任命”里派人' },
        h('img', { src: portrait(who, ctrl.color, ctrl.polity), alt: who.name }),
        h('div', null, h('small', null, role), h('b', null, person ? who.name : `${anonTitle}（佚名）`), h('span', null, person ? who.title : '未委任'))));
    }
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
        this.tile('troops', '驻军', known ? wan(c.garrison) : roughTroops(c.garrison), { id: 'city-garrison', d: known ? delta('garrison') : 0, ...(known ? { raw: c.garrison, key: id + ':garrison' } : {}) }),
        this.tile('wall', '城防', String(Math.round(c.wall)), { meter: c.wall, raw: c.wall, key: id + ':wall', fmt: n => String(Math.round(n)) }),
        this.tile('minxin', '民心', known ? String(Math.round(c.minxin)) : c.minxin > 60 ? '稳' : c.minxin > 40 ? '浮动' : '离散', { meter: known ? c.minxin : undefined, ...(known ? { raw: c.minxin, key: id + ':minxin', fmt: (n: number) => String(Math.round(n)) } : {}) }),
        this.tile('grain', '仓粮', known ? wan(c.grain - this.pendingSpend(id, 'grain')) : '不详', { id: 'city-grain', d: known ? delta('grain') : 0, ...(known ? { raw: c.grain - this.pendingSpend(id, 'grain'), key: id + ':grain' } : {}) }),
        this.tile('silver', '府库', known ? wan(c.silver - this.pendingSpend(id, 'silver')) : '不详', { id: 'city-silver', d: known ? delta('silver') : 0, ...(known ? { raw: c.silver - this.pendingSpend(id, 'silver'), key: id + ':silver' } : {}) }),
        this.tile('pop', '人口', `${Math.round(c.pop)}`, { unit: '万', raw: c.pop, key: id + ':pop', fmt: n => String(Math.round(n)) }),
      ));
      if (known) {
        const inc = monthlyIncome(s, c), up = upkeepOf(s, c);
        sec.append(h('div', { class: 'rows', style: { marginTop: '6px' } },
          h('div', { class: 'row' }, ic('grain'), h('span', { class: 't' }, '每月粮 进 / 出'), h('b', { class: inc.grain >= up.grain ? 'up' : 'down' }, `${wan(inc.grain)} / ${wan(up.grain)}`)),
          h('div', { class: 'row' }, ic('silver'), h('span', { class: 't' }, '每月银 进 / 出'), h('b', { class: inc.silver + inc.trade >= up.silver ? 'up' : 'down' }, `${wan(inc.silver + inc.trade)} / ${wan(up.silver)}`)),
          h('div', { class: 'row', id: 'city-price', 'data-tip': '粮价随地区、季节、战事与本城存粮浮动；粮贱时籴、粮贵时粜' }, ic('commerce'), h('span', { class: 't' }, '市价 · 市面'), h('b', null, `每石 ${grainPrice(s, c).toFixed(2)} 两 · 月容 ${wan(marketCap(s, c))} 石`))));
      }
      // 行动
      const acts = h('div', { class: 'acts' });
      const has = (k: Order['kind']) => this.orders.some(o => o.kind === k && ((o as any).node === id || (o as any).from === id));
      const A = (aid: string, icon: string, label: string, onclick: () => void, done = false, primary = false) => h('button', { class: 'act' + (done ? ' done' : '') + (primary ? ' primary' : ''), id: aid, onclick }, ic(icon), label);
      if (mine) {
        acts.append(A('act-policy', 'policy', '方针', () => this.formPolicy(id), has('policy')),
          A('act-recruit', 'recruit', '募兵', () => this.formRecruit(id), has('recruit')),
          A('act-trade', 'grain', '粜籴', () => this.formTrade(id), has('trade')),
          A('act-loan', 'silver', '劝饷', () => this.formLoan(id), has('loan')),
          A('act-raise', 'army', '出兵', () => this.formRaise(id), this.orders.some(o => o.kind === 'raise' && o.node === id), c.garrison >= 3000),
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
      face(s, a.commander, 36, 'face round'),
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
      face(s, cmd.id, 52, 'face round'),
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
      a.hunger ? h('div', { class: 'row mine' }, ic('grain'), h('span', { class: 't' }, '断粮'), h('b', { class: 'down' }, `${a.hunger} 月`)) : null,
      visible && a.unpaid ? h('div', { class: 'row mine', id: 'army-arrears' }, ic('silver'), h('span', { class: 't' }, `欠饷 ${a.unpaid} 月 · 积欠 ${wan(a.arrears ?? 0)} 两${a.unpaid >= 4 ? ' · 士卒逃散' : ''}`), h('b', { class: 'down' }, `士气上限 −${Math.min(24, a.unpaid * 3)}`)) : null));
    for (const pend of this.orders.filter(o => (o.kind === 'army' || o.kind === 'command' || o.kind === 'supply') && o.army === id))
      sec.append(h('div', { class: 'row mine', style: { marginTop: '6px' } }, ic(pend.kind === 'supply' ? 'grain' : 'appoint'), h('span', { class: 't' }, describeOrder(s, pend)), h('b', null, '已下令')));
    const A = (aid: string, icon: string, label: string, onclick: () => void, primary = false) => h('button', { class: 'act' + (primary ? ' primary' : ''), id: aid, onclick }, ic(icon), label);
    if (mine) {
      sec.append(h('div', { class: 'sec-title' }, ic('war'), '军令'));
      const acts = h('div', { class: 'acts' },
        A('act-move', 'move', '行军', () => this.beginTarget(id, `点选${a.name}要去的城`, n => this.issueMarch(id, n, 'move'))),
        A('act-attack', 'attack', '进攻', () => this.beginTarget(id, `点选${a.name}要攻的城`, n => this.issueMarch(id, n, 'attack'))),
        A('act-hold', 'hold', '驻扎', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'hold' } })),
      );
      const here = s.cities[a.location];
      if (a.progress === 0 && here && hostile(s, s.player, here.controller)) {
        acts.append(A('act-assault', 'storm', '攻城', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: true } }), true),
          A('act-blockade', 'blockade', '围困', () => this.addOrder({ id: this.newOrderId(), kind: 'army', army: id, order: { kind: 'siege', target: a.location, assault: false } })));
      } else if (a.progress === 0 && here && here.controller === s.player) acts.append(A('act-reinforce', 'reinforce', '拨兵', () => this.formReinforce(id)));
      acts.append(A('act-supply', 'grain', '粮台', () => this.beginTarget(id, `点选${a.name}改由哪座城支粮（须己方或同阵营、粮道可通）`, n => { this.addOrder({ id: this.newOrderId(), kind: 'supply', army: id, node: n }); })));
      sec.append(acts);
    } else if (vassal) {
      sec.append(h('div', { class: 'sec-title' }, ic('urgent'), `号令 · 服从 ${f.loyalty}`));
      sec.append(meter(f.loyalty ?? 50, mcol(f.loyalty ?? 50)));
      sec.append(h('div', { class: 'acts', style: { marginTop: '8px' } },
        A('act-command-move', 'move', '开赴', () => this.beginTarget(id, `点选要${f.short}部去的城`, n => this.issueMarch(id, n, 'move'))),
        A('act-command-attack', 'attack', '进攻', () => this.beginTarget(id, `点选要${f.short}部攻的城`, n => this.issueMarch(id, n, 'attack'))),
        A('act-command-hold', 'hold', '驻守', () => this.formCommand(id, { kind: 'hold' })),
        A('act-reward', 'reward', '犒赏', () => this.formReward(a.faction)),
      ));
    }
  }

  /* ================= 弹窗 ================= */
  modal(icon: string, title: string, sub: string, body: (HTMLElement | string | null)[], buttons: { label: string; icon?: string; primary?: boolean; id?: string; onclick: () => void | boolean }[], size?: 'wide') {
    if ($('#modal').classList.contains('hidden')) this.modalOpener = document.activeElement as HTMLElement | null;
    this.forcedModal = false;
    const m = clear($('#modal'));
    m.classList.remove('hidden');
    const dlg = h('div', { class: 'dialog hud' + (size ? ' ' + size : ''), role: 'dialog' },
      h('div', { class: 'dh' }, h('div', { class: 'emb' }, ic(icon)), h('div', null, h('h2', null, title), sub ? h('small', null, sub) : null)),
      h('div', { class: 'db' }, ...body));
    if (buttons.length) {
      const foot = h('div', { class: 'df' });
      for (const b of buttons) foot.append(h('button', { class: 'btn' + (b.primary ? ' primary' : ''), id: b.id, onclick: () => { if (b.onclick() !== false) this.closeModal(); } }, b.icon ? ic(b.icon) : null, b.label));
      dlg.append(foot);
    }
    m.append(dlg);
    m.onclick = e => { if (e.target === m && buttons.length) this.closeModal(); };
    scroll();
    gsap.fromTo(dlg, { scale: 0.88, opacity: 0, y: 12 }, { scale: 1, opacity: 1, y: 0, duration: 0.3, ease: 'back.out(1.7)' });
    gsap.from(dlg.querySelectorAll('.opt, .gopt, .lrow, .slot, .tile'), { opacity: 0, y: 10, duration: 0.25, stagger: 0.03, delay: 0.1 });
    requestAnimationFrame(() => { if (!dlg.contains(document.activeElement)) dlg.querySelector<HTMLElement>('button:not([disabled])')?.focus({ preventScroll: true }); });
    return dlg;
  }
  modalOpener: HTMLElement | null = null;
  forcedModal = false;
  closeModal() {
    closeSelects(); this.forcedModal = false;
    $('#modal').classList.add('hidden'); clear($('#modal'));
    const o = this.modalOpener; this.modalOpener = null;
    if (o && o.isConnected && !o.closest('#modal')) o.focus({ preventScroll: true });
  }
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
    const p = c.pop;
    const COL: Record<Policy, string> = { balanced: '#8c6a35', agri: '#5f8a3a', commerce: '#b0702a', fortify: '#6d6f75', relief: '#b5342a', edu: '#3f6f8f', levy: '#7d1a12' };
    const CH: Record<Policy, Chip[]> = {
      balanced: [{ icon: 'order', text: '按常例征收' }],
      agri: [{ icon: 'silver', text: `−${wan(p * 20)}/月`, tone: 'bad' }, { icon: 'agri', text: '农业 +1/月', tone: 'good' }],
      commerce: [{ icon: 'silver', text: `−${wan(p * 15)}/月`, tone: 'bad' }, { icon: 'commerce', text: '商业 +1/月', tone: 'good' }],
      fortify: [{ icon: 'silver', text: `−${wan(p * 40 + 2000)}/月`, tone: 'bad' }, { icon: 'wall', text: '城防 +3/月', tone: 'good' }],
      relief: [{ icon: 'grain', text: `−${wan(p * 150)}/月`, tone: 'bad' }, { icon: 'minxin', text: '民心 +3/月', tone: 'good' }],
      edu: [{ icon: 'silver', text: `−${wan(p * 25)}/月`, tone: 'bad' }, { icon: 'edu', text: '文教 +0.6/月', tone: 'good' }],
      levy: [{ icon: 'silver', text: '赋税 +50%', tone: 'good' }, { icon: 'minxin', text: '民心 −3/月', tone: 'bad' }, { icon: 'order', text: '吏治 −1/月', tone: 'bad' }],
    };
    const cards: GameCard[] = (Object.keys(POLICY_NAME) as Policy[]).map((k, i) => ({ id: k, title: POLICY_NAME[k], art: cardArt(POLICY_ICON[k], COL[k], i), chips: CH[k], note: POLICY_HINT[k], on: k === cur, color: COL[k] }));
    this.modal('policy', '方针', `${nodeName(node)} · 选一张，此后每月持续执行`, [cardHand(cards, k => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'policy', node, policy: k as Policy }); }, { stampText: '令' })], [this.cancelBtn()], 'wide');
  }


  /** 出兵：从城中驻军抽人编成野战军，选一员将领统领 */
  formRaise(node: string, char?: string) {
    const s = this.s!, c = s.cities[node];
    if (c.garrison < 2000) { this.toast(`${nodeName(node)}驻军不足两千，出不了兵`, 'close'); return; }
    const list = this.freeChars().filter(x => !x.royal).sort((a, b) => b.ab.tong - a.ab.tong);
    if (!list.length) { this.toast('无将可用：所有将领都在统兵或出使', 'close'); return; }
    const fc = s.factions[s.player].color, pol = s.factions[s.player].polity;
    if (!char) {
      const cards: GameCard[] = list.map(x => ({ id: x.id, title: x.name, sub: x.title, art: portrait(x, fc, pol), portrait: true, badge: `统 ${x.ab.tong}`,
        chips: [{ icon: 'event', text: `谋 ${x.ab.mou}` }, { icon: 'morale', text: `忠 ${Math.round(x.att.loyalty)}`, tone: x.att.loyalty >= 60 ? 'good' : 'bad' }], note: `现在${nodeName(x.location)}` }));
      this.modal('army', '出兵 · 选将', `${nodeName(node)} · 驻军 ${wan(c.garrison)} · 统军越高，打仗越强`, [cardHand(cards, id => { this.closeModal(); setTimeout(() => this.formRaise(node, id), 0); }, { stampText: '将' })], [this.cancelBtn()], 'wide');
      return;
    }
    const ch = s.chars[char];
    const port = NODE[node].kind === 'port' || neighbors(node).some(n => n.route.kind === 'river' || n.route.kind === 'sea');
    let navy = false;
    const max = Math.floor((c.garrison - 1000) / 500) * 500;
    const n = stepper('raise-n', Math.min(max, Math.max(1000, Math.round(c.garrison / 2 / 500) * 500)), { step: 500, min: 1000, max, unit: '人', presets: [2000, 5000, 10000] });
    const kind = h('div', { class: 'grid-opts', style: { gridTemplateColumns: 'repeat(2, 1fr)' } });
    const paintKind = () => { clear(kind); for (const [k, icon, label, sub] of [[false, 'army', '陆军', '步骑火器'], [true, 'navy', '水师', port ? '战船，可走江海' : '此城不临江海']] as const) kind.append(h('button', { class: 'gopt' + (navy === k ? ' on' : ''), disabled: k && !port, 'data-navy': String(k), onclick: () => { navy = k; paintKind(); } }, ic(icon), h('b', null, label), h('small', null, sub))); };
    paintKind();
    this.modal('army', `出兵 · ${ch.name}统领`, `${nodeName(node)} · 驻军 ${wan(c.garrison)}，城中至少留一千`, [
      h('div', { class: 'raise-top' }, face(s, ch.id, 72, 'face round'), h('div', null, h('b', null, ch.name), h('small', null, `${ch.title} · 统 ${ch.ab.tong} 谋 ${ch.ab.mou}`))),
      h('div', { class: 'field' }, h('label', null, ic('troops'), '兵数'), n), kind,
    ], [this.cancelBtn(), { label: '出兵', icon: 'army', primary: true, id: 'raise-ok', onclick: () => this.addOrder({ id: this.newOrderId(), kind: 'raise', node, char, troops: n.value, navy }) ? undefined : false }]);
  }

  /** 粜籴：在本城市面买粮或卖粮 */
  formTrade(node: string) {
    const s = this.s!, c = s.cities[node];
    if (s.sieges[node]) { this.toast(`${nodeName(node)}被围，市面断绝`, 'close'); return; }
    const cap = marketCap(s, c), used = c.tradeTurn === s.turn ? c.tradeN ?? 0 : 0, room = Math.max(0, cap - used);
    if (room < 100) { this.toast(`${nodeName(node)}本月市面已尽`, 'close'); return; }
    const silver = Math.max(0, c.silver - this.pendingSpend(node, 'silver')), grain = Math.max(0, c.grain - this.pendingSpend(node, 'grain'));
    const price = grainPrice(s, c);
    const maxBuy = Math.min(room, Math.floor(silver / (price * 1.25) / 100) * 100), maxSell = Math.min(room, Math.floor(grain / 100) * 100);
    let mode: 'buy' | 'sell' = maxBuy >= 100 ? 'buy' : 'sell';
    const input = h('input', { type: 'range', min: 100, step: 100, id: 'trade-n' }) as HTMLInputElement;
    const big = h('div', { class: 'big-num' }), costs = h('div', { class: 'costs' });
    const tabs = h('div', { class: 'tabs2' });
    const setMode = (m: 'buy' | 'sell') => {
      mode = m; const mx = m === 'buy' ? maxBuy : maxSell;
      input.max = String(Math.max(100, mx)); input.value = String(Math.min(mx, Math.max(100, Math.round(mx / 2 / 100) * 100))); input.disabled = mx < 100;
      clear(tabs).append(
        h('button', { class: 'tab2' + (m === 'buy' ? ' on' : ''), id: 'trade-buy', disabled: maxBuy < 100, onclick: () => setMode('buy') }, ic('grain'), '籴粮（花银买粮）'),
        h('button', { class: 'tab2' + (m === 'sell' ? ' on' : ''), id: 'trade-sell', disabled: maxSell < 100, onclick: () => setMode('sell') }, ic('silver'), '粜粮（卖粮得银）'));
      upd();
    };
    const upd = () => {
      const n = +input.value, q = tradeQuote(s, c, mode === 'buy' ? n : -n);
      big.textContent = `${mode === 'buy' ? '籴' : '粜'} ${fmt(n)} 石`;
      clear(costs).append(
        h('span', { class: 'cost ' + (mode === 'buy' ? 'bad' : 'good') }, ic('silver'), `${mode === 'buy' ? '−' : '+'}${fmt(q.silver)}`),
        h('span', { class: 'cost ' + (mode === 'buy' ? 'good' : 'bad') }, ic('grain'), `${mode === 'buy' ? '+' : '−'}${fmt(n)}`),
        h('span', { class: 'cost' }, ic('commerce'), `每石 ${q.unit.toFixed(2)} 两（市价 ${q.price.toFixed(2)}）`));
    };
    input.oninput = upd;
    this.modal('trade', '粜籴', `${nodeName(node)} · 市价每石 ${price.toFixed(2)} 两 · 本月市面尚容 ${fmt(room)} 石 · 量大则价不利`, [tabs, big, h('div', { class: 'field' }, input), costs],
      [this.cancelBtn(), { label: '成交', icon: 'ok', primary: true, id: 'trade-ok', onclick: () => { const n = +input.value; this.addOrder({ id: this.newOrderId(), kind: 'trade', node, grain: mode === 'buy' ? n : -n }); } }]);
    setMode(mode);
  }
  /** 劝捐助饷：立得一笔银，民心吏治受损，同城半年一次 */
  formLoan(node: string) {
    const s = this.s!, c = s.cities[node];
    const err = validateOrder(s, s.player, { id: 'x', kind: 'loan', node });
    if (err) { this.toast(err, 'close'); return; }
    const amt = loanAmount(s, c);
    this.modal('loan', '劝捐助饷', `${nodeName(node)} · 向城中绅商劝捐军饷`, [
      h('div', { class: 'big-num' }, `+${fmt(amt)} 两`),
      h('div', { class: 'costs' }, h('span', { class: 'cost good' }, ic('silver'), `+${fmt(amt)}`), h('span', { class: 'cost bad' }, ic('minxin'), '民心 −5'), h('span', { class: 'cost bad' }, ic('order'), '吏治 −2'), h('span', { class: 'cost' }, ic('hourglass'), '此城六个月内不能再劝')),
      h('div', { class: 'note' }, '府库告罄时的应急之法：人口越多、商业越盛、民心越稳，捐得越多。'),
    ], [this.cancelBtn(), { label: '劝捐', icon: 'ok', primary: true, id: 'loan-ok', onclick: () => { this.addOrder({ id: this.newOrderId(), kind: 'loan', node }); } }]);
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
    const own = Object.values(s.cities).filter(c => c.controller === s.player);
    const targetsOf = (f: string) => Object.values(s.cities).filter(c => c.id !== f && friendly(s, s.player, c.controller))
      .map(c => ({ c, p: shortestPath(f, c.id, false) }))
      .sort((a, b) => (a.p ? pathDays(f, a.p) : 999) - (b.p ? pathDays(f, b.p) : 999));
    const avail = (id: string, k: 'grain' | 'silver') => Math.max(0, s.cities[id][k] - this.pendingSpend(id, k));
    const toOpts = (f: string): SelOpt[] => targetsOf(f).map(({ c, p }) => ({ value: c.id, label: nodeName(c.id), color: s.factions[c.controller].color,
      sub: s.factions[c.controller].short + (p ? ` · ${pathDays(f, p)} 日` : ''), tag: s.sieges[c.id] ? '被围' : undefined }));
    const status = h('div', { class: 'route-status', id: 'tr-status' });
    const grain = stepper('tr-grain', 10000, { step: 1000, max: avail(from, 'grain'), unit: '石', presets: [0, 5000, 10000, 50000] });
    const silver = stepper('tr-silver', 0, { step: 1000, max: avail(from, 'silver'), unit: '两', presets: [0, 5000, 10000, 50000] });
    const toSel = gameSelect('tr-to', toOpts(from), to ?? '', () => updStatus());
    const fromSel = gameSelect('tr-from', own.map(c => ({ value: c.id, label: nodeName(c.id), sub: `粮 ${wan(c.grain)} · 银 ${wan(c.silver)}`, color: s.factions[c.controller].color })), from, v => {
      toSel.setOptions(toOpts(v)); grain.setMax(avail(v, 'grain')); silver.setMax(avail(v, 'silver')); updStatus();
    });
    const updStatus = () => {
      const why = supplyBlock(s, s.player, fromSel.value, toSel.value);
      clear(status).append(ic(why ? 'close' : 'ok'), why ?? '粮道畅通，本月送达');
      status.className = 'route-status ' + (why ? 'bad' : 'good');
    };
    updStatus();
    this.modal('transfer', '调拨钱粮', '沿驿路运送 · 被围之城送不进', [
      h('div', { class: 'tr-route' }, fromSel, h('div', { class: 'tr-arrow' }, ic('transfer')), toSel), status,
      h('div', { class: 'tr-amt' }, h('div', null, h('label', null, ic('grain'), '粮'), grain), h('div', null, h('label', null, ic('silver'), '银'), silver)),
    ], [this.cancelBtn(), { label: '调拨', icon: 'ok', primary: true, id: 'tr-ok', onclick: () => {
      if (!grain.value && !silver.value) { this.toast('粮、银至少调一样', 'close'); return false; }
      return this.addOrder({ id: this.newOrderId(), kind: 'transfer', from: fromSel.value, to: toSel.value, grain: grain.value, silver: silver.value }) ? undefined : false;
    } }]);
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
    const fc = s.factions[s.player].color, pol = s.factions[s.player].polity;
    const cards: GameCard[] = list.map(c => { const p = postOf(c.id); return { id: c.id, title: c.name, sub: c.title, art: portrait(c, fc, pol), portrait: true, badge: `政 ${c.ab.zheng}`,
      chips: [{ icon: 'admin', text: `收入 ${c.ab.zheng >= 60 ? '+' : ''}${Math.round((c.ab.zheng - 50) / 2)}%`, tone: c.ab.zheng >= 50 ? 'good' : 'bad' }, { icon: 'morale', text: `忠 ${Math.round(c.att.loyalty)}`, tone: c.att.loyalty >= 60 ? 'good' : 'bad' }],
      note: p ? `调离${nodeName(p)}` : `现在${nodeName(c.location)}` }; });
    this.modal('appoint', '任命主官', `${nodeName(node)} · 政务越高收入越多`, [cardHand(cards, id => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'appoint', node, char: id }); }, { stampText: '任' })], [this.cancelBtn()], 'wide');
  }


  formPersuade(node: string) {
    const s = this.s!;
    const list = this.freeChars().sort((a, b) => b.ab.wai - a.ab.wai);
    if (!list.length) { this.toast('无人可出使', 'close'); return; }
    const fc = s.factions[s.player].color, pol = s.factions[s.player].polity;
    const cards: GameCard[] = list.map(c => { const r = persuadeChance(s, s.player, c.id, node); return { id: c.id, title: c.name, sub: c.title, art: portrait(c, fc, pol), portrait: true, badge: `${Math.round(r.p * 100)}%`,
      chips: [{ icon: 'envoy', text: `外交 ${c.ab.wai}`, tone: c.ab.wai >= 60 ? 'good' : 'plain' }, { icon: 'morale', text: `威望 ${c.ab.wang}` }], note: r.factors.slice(0, 2).join(' · ') }; });
    this.modal('persuade', '遣使劝降', `${nodeName(node)} · 右上角是成功率，下月见分晓`, [cardHand(cards, id => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'persuade', char: id, node }); }, { stampText: '使' })], [this.cancelBtn()], 'wide');
  }


  formEnvoy(target: string, aim0?: 'alliance' | 'truce' | 'peace') {
    const s = this.s!;
    const list = this.freeChars().sort((a, b) => b.ab.wai - a.ab.wai);
    if (!list.length) { this.toast('无人可出使', 'close'); return; }
    const st = stance(s, s.player, target);
    const tf = s.factions[target];
    if (!aim0) {
      const aims: GameCard[] = [{ id: 'alliance', title: '结盟', art: cardArt('envoy', '#3f7a4a', 1), chips: [{ icon: 'city', text: '各守其城' }, { icon: 'factions', text: '互不相攻', tone: 'good' }], note: '盟友之城不算你的，统一时另计。' }];
      if (st === 'war') aims.push({ id: 'truce', title: '停战', art: cardArt('hourglass', '#8c6a35', 2), chips: [{ icon: 'hourglass', text: '六个月' }], note: '期满复归交战。' },
        { id: 'peace', title: '议和', art: cardArt('ok', '#3f6f8f', 3), chips: [{ icon: 'war', text: '罢兵', tone: 'good' }], note: '两家不再交兵。' });
      this.modal('envoy', `遣使 · ${tf.short}`, `关系：${STANCE_NAME[st] ?? st} · 先定所求`, [cardHand(aims, k => { this.closeModal(); this.formEnvoy(target, k as 'alliance' | 'truce' | 'peace'); }, { stampText: '议' })], [this.cancelBtn()], 'wide');
      return;
    }
    const fc = s.factions[s.player].color, pol = s.factions[s.player].polity;
    const cards: GameCard[] = list.map(c => { const r = envoyScore(s, s.player, { id: 'x', kind: 'envoy', char: c.id, target, aim: aim0 }); return { id: c.id, title: c.name, sub: c.title, art: portrait(c, fc, pol), portrait: true,
      badge: `把握 ${Math.round(r.score)}`, chips: [{ icon: 'envoy', text: `外交 ${c.ab.wai}`, tone: c.ab.wai >= 60 ? 'good' : 'plain' }, { icon: r.score >= 55 ? 'ok' : 'close', text: r.score >= 55 ? '可望' : '难成', tone: r.score >= 55 ? 'good' : 'bad' }], note: r.factors.slice(0, 2).join(' · ') }; });
    this.modal('envoy', `遣使 · ${tf.short} · ${{ alliance: '结盟', truce: '停战', peace: '议和' }[aim0]}`, '选使者 · 把握需 55 以上', [cardHand(cards, id => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'envoy', char: id, target, aim: aim0 }); }, { stampText: '使' })], [{ label: '换一种所求', icon: 'envoy', onclick: () => { setTimeout(() => this.formEnvoy(target), 0); } }, this.cancelBtn()], 'wide');
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
      const troops = Object.values(s.armies).filter(a => a.faction === f.id).reduce((n, a) => n + a.troops, 0) + Object.values(s.cities).filter(c => c.controller === f.id).reduce((n, c) => n + c.garrison, 0);
      const st = stance(s, s.player, f.id);
      const btn = f.id === s.player ? null : f.overlord === s.player ? h('button', { class: 'mini', onclick: () => { this.closeModal(); this.formReward(f.id); } }, ic('reward'), `服从 ${f.loyalty}`)
        : h('button', { class: 'mini', 'data-envoy': f.id, onclick: () => { this.closeModal(); this.formEnvoy(f.id); } }, ic('envoy'), '遣使');
      list.append(h('div', { class: 'lrow' },
        h('div', { class: 'coin', style: { background: f.color } }, POLITIES[f.polity].mark || f.short),
        h('div', { class: 'nm' }, h('b', null, f.name), h('small', null, `奉${POLITIES[f.polity].name} · ${cities} 城 · ${friendly(s, s.player, f.id) ? wan(troops) : roughTroops(troops)} 兵`)),
        h('span', { class: 'stance st-' + st }, STANCE_NAME[st] ?? st), btn));
    }
    const me = s.factions[s.player];
    if (me.overlord && !s.factions[me.overlord]?.defunct) {
      const pend = this.orders.some(o => o.kind === 'independence');
      list.prepend(h('div', { class: 'lrow mine-lord' }, h('div', { class: 'coin', style: { background: s.factions[me.overlord].color } }, ic('crown')),
        h('div', { class: 'nm' }, h('b', null, `奉${s.factions[me.overlord].name}号令`), h('small', null, `服从 ${me.loyalty ?? '—'} · 自立后不再受其节制，但部下忠诚者不悦`)),
        h('button', { class: 'mini', id: 'act-independence', disabled: pend, onclick: () => { this.closeModal(); this.addOrder({ id: this.newOrderId(), kind: 'independence' }); } }, ic('crown'), pend ? '已下令' : '自立')));
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
    const list = Object.values(s.chars).filter(c => c.status !== 'offstage' && (group === 'mine' ? c.faction === s.player : group === 'vassal' ? s.factions[c.faction]?.overlord === s.player : c.faction !== s.player && s.factions[c.faction]?.overlord !== s.player && s.factions[c.faction] && !s.factions[c.faction].defunct && (s.factions[c.faction].leader === c.id || c.ab.wang >= 60)))
      .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || Number(s.factions[b.faction]?.leader === b.id) - Number(s.factions[a.faction]?.leader === a.id) || Math.max(b.ab.tong, b.ab.zheng) - Math.max(a.ab.tong, a.ab.zheng));
    const grid = h('div', { class: 'roster' });
    for (const c of list) {
      const f = s.factions[c.faction];
      const best = ([['统', c.ab.tong], ['政', c.ab.zheng], ['谋', c.ab.mou], ['外', c.ab.wai]] as const).slice().sort((x, y) => y[1] - x[1])[0];
      const post = Object.values(s.cities).find(x => x.governor === c.id)?.id;
      const leads = Object.values(s.armies).find(a => a.commander === c.id);
      grid.append(h('button', { class: 'rcard' + (c.status !== 'active' ? ' gone' : ''), 'data-char': c.id, style: { '--cc': f?.color ?? '#6a5a48' } as any, onclick: () => { click(); this.openChar(c.id); } },
        face(s, c.id, 96, 'rface'),
        f?.leader === c.id ? h('span', { class: 'r-lead' }, ic('crown')) : null,
        c.status !== 'active' ? h('span', { class: 'r-st' }, c.status === 'captured' ? '被执' : '已故') : null,
        h('b', null, c.name), h('small', null, leads ? `统 ${leads.name}` : post ? `守${nodeName(post)}` : c.title),
        h('div', { class: 'r-stat' }, h('span', null, `${best[0]} ${best[1]}`), group !== 'others' ? h('span', { class: c.att.loyalty >= 60 ? 'up' : 'down' }, `忠 ${Math.round(c.att.loyalty)}`) : null)));
    }
    this.modal('chars', '人物', `${list.length} 人 · 点人物看档案`, [tabs, list.length ? grid : h('div', { class: 'note' }, '无')], [{ label: '关闭', icon: 'close', onclick: () => {} }], 'wide');
    gsap.from('#modal .rcard', { opacity: 0, y: 20, scale: 0.9, duration: 0.3, stagger: 0.02, ease: 'back.out(1.6)' });
  }

  openChar(id: string) {
    const s = this.s!;
    const c = s.chars[id];
    const f = s.factions[c.faction];
    const own = c.faction === s.player || f?.overlord === s.player;
    const pol = f ? polityOf(s, f.polity) : null;
    const post = Object.values(s.cities).find(x => x.governor === c.id)?.id;
    const leads = Object.values(s.armies).find(a => a.commander === c.id);
    const bar = (label: string, v: number, good: boolean, icon: string) => h('div', { class: 'p-bar' }, ic(icon), h('span', null, label), h('div', { class: 'meter' }, h('i', { style: { width: Math.max(0, Math.min(100, v)) + '%', background: good ? 'var(--green)' : 'var(--red-2)' } })), h('b', null, String(Math.round(v))));
    const card = h('div', { class: 'profile', style: { '--cc': f?.color ?? '#6a5a48' } as any },
      h('div', { class: 'p-left' },
        face(s, c.id, 210, 'pface'),
        h('div', { class: 'p-seal', style: { background: f?.color ?? '#555' } }, pol?.mark || f?.short || '?'),
        c.status !== 'active' ? h('div', { class: 'p-ribbon' }, c.status === 'captured' ? '被 执' : '已 故') : null,
        h('div', { class: 'p-name' }, c.name), h('div', { class: 'p-title' }, c.title)),
      h('div', { class: 'p-right' },
        h('div', { class: 'tags', style: { marginTop: '0' } },
          h('span', { class: 'tag' }, ic('factions'), f?.name ?? '无所属'),
          h('span', { class: 'tag', style: { cursor: 'pointer' }, onclick: () => { this.closeModal(); this.map.flyTo(c.location, Math.max(this.map.cam.z, 2.2)); this.selectNode(c.location); } }, ic('locate'), nodeName(c.location)),
          f?.leader === c.id ? h('span', { class: 'tag' }, ic('crown'), '主君') : null,
          post ? h('span', { class: 'tag' }, ic('appoint'), `主官 · ${nodeName(post)}`) : null,
          leads ? h('span', { class: 'tag' }, ic('army'), `统 ${leads.name}`) : null),
        h('div', { class: 'p-bio' }, '“', c.bio, '”'),
        h('div', { class: 'p-mid' }, radar(c.ab), h('div', { class: 'p-abil' }, ...([['统军', c.ab.tong, 'army'], ['政务', c.ab.zheng, 'admin'], ['谋略', c.ab.mou, 'event'], ['外交', c.ab.wai, 'envoy'], ['威望', c.ab.wang, 'crown']] as const)
          .map(([k, v, icon]) => h('div', { class: 'pa' }, ic(icon), h('span', null, k), h('b', { class: v >= 70 ? 'hi' : v < 40 ? 'lo' : '' }, String(v)))))),
        own ? h('div', { class: 'p-bars' }, bar('忠诚', c.att.loyalty, c.att.loyalty >= 50, 'morale'), bar('降意', c.att.surrender, c.att.surrender < 40, 'prisoner'), bar('主战', (c.att.hawk + 100) / 2, true, 'war')) : h('div', { class: 'note' }, '敌方人物的心思不得而知。'),
      ));
    const body: HTMLElement[] = [card];
    if (own && c.attLog.length) {
      const rows = h('div', { class: 'p-log', id: 'att-log' });
      for (const l of [...c.attLog].reverse().slice(0, 12)) rows.append(h('div', { class: 'pl' }, h('em', null, shortDate(l.turn)), h('span', null, l.reason),
        h('b', { class: (l.field === 'surrender' ? -l.delta : l.delta) >= 0 ? 'up' : 'down' }, `${{ loyalty: '忠', surrender: '降', hawk: '战' }[l.field]} ${signed(l.delta)}`)));
      body.push(h('div', { class: 'sec-title' }, ic('history'), '心迹'), rows);
    }
    const dlg = this.modal('person', c.name, `${f?.name ?? ''} · ${c.title}`, body, [{ label: '人物', icon: 'chars', onclick: () => { setTimeout(() => this.openChars(c.faction === s.player ? 'mine' : f?.overlord === s.player ? 'vassal' : 'others'), 0); } }, { label: '关闭', icon: 'close', onclick: () => {} }], 'wide');
    dlg.classList.add('pdlg');
    gsap.fromTo(card, { rotateY: -70, opacity: 0 }, { rotateY: 0, opacity: 1, duration: 0.55, ease: 'back.out(1.3)' });
    gsap.from(dlg.querySelector('.p-seal'), { scale: 3, rotate: -40, opacity: 0, duration: 0.45, delay: 0.35, ease: 'back.out(2)' });
    gsap.from(dlg.querySelectorAll('.p-bar .meter i, .pa'), { scaleX: 0, opacity: 0, transformOrigin: 'left', duration: 0.4, stagger: 0.04, delay: 0.3 });
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

  /** 军情卡的小图：提到的人物用其像，易主用新主颜色作画，其余用类别图标 */
  reportThumb(r: ReportEntry, cat: ReportCat): HTMLElement {
    const s = this.s!;
    const who = (cat === '人事' || cat === '史事' || cat === '交涉') ? Object.values(s.chars).filter(x => x.status !== 'offstage' && r.text.includes(x.name)).sort((a, b) => r.text.indexOf(a.name) - r.text.indexOf(b.name))[0] : undefined;
    if (who) return h('img', { class: 'rthumb pt', src: portrait(who, s.factions[who.faction]?.color ?? '#6a5a48', s.factions[who.faction]?.polity ?? 'none'), alt: '' });
    if (cat === '易主' && r.node && s.cities[r.node]) return h('img', { class: 'rthumb', src: cardArt('capture', s.factions[s.cities[r.node].controller]?.color ?? '#b5342a', 1), alt: '' });
    return h('div', { class: `cic c-${cat}` }, ic(CAT_ICON[cat] ?? 'info'));
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
      this.reportThumb(r, cat),
      h('div', { class: 'body' }, h('div', { class: 'hl' }, hl), h('div', { class: 'meta' }, r.cat, more ? h('span', { style: { marginLeft: 'auto', color: 'var(--gold-dim)' } }, '▾') : null), more ? moreEl : null, hist, btns.childNodes.length ? btns : null));
  }

  /** 每月开头的要闻：最多四条 */
  /** 本月战报：镜头逐一飞到出事之地，插画卡片讲一句话，自动翻页；可上一条、下一条、全部跳过 */
  /** 战报播放偏好：all 择要播放；major 只播与我方相关的要紧事（易主、急报） */
  newsMode: 'all' | 'major' = (() => { try { return localStorage.getItem('nanming:news') === 'major' ? 'major' : 'all'; } catch { return 'all'; } })();
  /** 返回 true 表示玩家要看全部军情 */
  showSplash(): Promise<boolean> {
    return new Promise(resolve => {
      const s = this.s!;
      const t = this.reportTurn;
      const all = s.reports.filter(r => r.turn === t && (!r.faction || r.faction === s.player));
      const me = topOf(s, s.player);
      const mineNode = (n?: string) => !!n && !!s.cities[n] && topOf(s, s.cities[n].controller) === me;
      const rank = (r: ReportEntry) => (r.cat === '易主' && (mineNode(r.node) || r.urgent) ? 0 : r.urgent ? 1 : r.cat === '易主' ? 2 : r.cat === '史事' ? 3 : r.cat === '军报' && mineNode(r.node) ? 4 : r.cat === '人事' ? 5 : r.cat === '军报' ? 6 : r.cat === '交涉' ? 6 : r.cat === '线索' ? 7 : 8);
      const groups = this.splashGroups();
      const top = groups.map(g => g.lead);
      void rank;
      if (!top.length) { resolve(false); return; }
      const home = { ...this.map.cam };
      const COL: Record<string, string> = { 急报: '#b5342a', 军报: '#7d1a12', 史事: '#8c6a35', 线索: '#3f6f8f', 内政: '#5f8a3a', 交涉: '#2f6f8f', 人事: '#6a4a8a', 易主: '#b5342a' };
      let i = -1, timer = 0, paused = false;
      const bar = h('i');
      const art = h('img', { class: 'nw-art', alt: '', draggable: 'false' }) as HTMLImageElement;
      const cat = h('span', { class: 'nw-cat' }), count = h('span', { class: 'nw-count' });
      const hl = h('div', { class: 'nw-hl' }), more = h('div', { class: 'nw-more' }), seals = h('div', { class: 'nw-seals' });
      const card = h('div', { class: 'nw-card hud', onclick: () => next(), onmouseenter: () => { paused = true; }, onmouseleave: () => { paused = false; } }, art, h('div', { class: 'nw-body' }, h('div', { class: 'nw-top' }, cat, count), hl, more, seals), h('div', { class: 'nw-prog' }, bar));
      const el = h('div', { id: 'news' },
        h('div', { class: 'nw-head' }, h('b', null, s.ended ? '本局终' : `${shortDate(t)} · 战报`), h('small', null, `共 ${all.length} 条，择要 ${top.length} 条`)),
        card,
        h('div', { class: 'nw-ctl' },
          h('button', { class: 'nw-b', id: 'news-prev', 'aria-label': '上一条', onclick: (e: Event) => { e.stopPropagation(); show(Math.max(0, i - 1)); } }, '‹'),
          h('button', { class: 'nw-b', id: 'news-next', 'aria-label': '下一条', onclick: (e: Event) => { e.stopPropagation(); next(); } }, '›'),
          h('button', { class: 'nw-b nw-mode' + (this.newsMode === 'major' ? ' on' : ''), id: 'news-mode', 'data-tip': '以后只播与我方相关的要紧事（城池易主、急报）；其余可在军情里看', onclick: (e: Event) => {
            e.stopPropagation();
            this.newsMode = this.newsMode === 'major' ? 'all' : 'major';
            try { localStorage.setItem('nanming:news', this.newsMode); } catch { /* 偏好只在本次有效 */ }
            (e.currentTarget as HTMLElement).classList.toggle('on', this.newsMode === 'major');
            this.toast(this.newsMode === 'major' ? '以后只播要紧战报' : '以后照常择要播放', 'report');
          } }, ic('urgent'), '只播要紧'),
          h('button', { class: 'nw-skip', id: 'news-skip', onclick: (e: Event) => { e.stopPropagation(); done(true); } }, ic('report'), '看全部军情')));
      const onKey = (e: KeyboardEvent) => {
        // 焦点在战报里的按钮上：回车、空格交给按钮自己
        const tgt = e.target as HTMLElement | null;
        if ((e.key === ' ' || e.key === 'Enter') && tgt?.tagName === 'BUTTON' && el.contains(tgt)) return;
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); next(); } else if (e.key === 'ArrowLeft') show(Math.max(0, i - 1)); else if (e.key === 'Escape') done();
      };
      /** 每张卡排下的声音与动效定时：换卡或离开时撤销，不让上一条的声音落到下一条上 */
      let pend: number[] = [];
      const later = (fn: () => void, ms: number) => { pend.push(window.setTimeout(fn, isReduced() ? 0 : ms)); };
      const cancelPend = () => { pend.forEach(clearTimeout); pend = []; };
      window.addEventListener('keydown', onKey, true);
      let ended = false;
      const done = (all = false) => {
        if (ended) return; ended = true;
        clearInterval(timer); cancelPend(); window.removeEventListener('keydown', onKey, true);
        gsap.to(el, { opacity: 0, y: 30, duration: 0.3, onComplete: () => { el.remove(); resolve(all); } });
        this.map.target = { x: home.x, y: home.y, z: home.z };
      };
      const next = () => { if (i >= top.length - 1) done(); else show(i + 1); };
      const show = (k: number) => {
        i = k;
        cancelPend();
        const r = top[k];
        const sp = splitReport(r);
        const c: ReportCat = r.urgent && r.cat !== '史事' && r.cat !== '线索' && r.cat !== '易主' && r.cat !== '军报' ? '急报' : r.cat;
        const node = r.node && s.cities[r.node] ? r.node : undefined;
        const ctrl = node ? s.factions[s.cities[node].controller] : undefined;
        // 插画：提到的人物用其像，否则按类别作画
        const who = Object.values(s.chars).filter(x => x.status !== 'offstage' && r.text.includes(x.name)).sort((a, b) => r.text.indexOf(a.name) - r.text.indexOf(b.name))[0];
        art.src = who && (c === '人事' || c === '史事' || c === '交涉') ? portrait(who, s.factions[who.faction]?.color ?? '#6a5a48', s.factions[who.faction]?.polity ?? 'none')
          : cardArt(CAT_ICON[c] ?? 'info', c === '易主' && ctrl ? ctrl.color : COL[c] ?? '#8c6a35', k);
        art.classList.toggle('pt', !!who && (c === '人事' || c === '史事' || c === '交涉'));
        clear(cat).append(ic(CAT_ICON[c] ?? 'info'), c);
        cat.style.background = c === '易主' && ctrl ? ctrl.color : COL[c] ?? '#8c6a35';
        count.textContent = `${k + 1} / ${top.length}`;
        hl.textContent = sp.hl;
        more.textContent = (sp.more.split('。')[0] ?? '').slice(0, 70) + (sp.more ? '。' : '');
        // 同城同月的其余军报：一行附注（攻城战的伤亡、相应的史事），不再各自成卡
        const rest = groups[k].rest;
        if (rest.length) more.append(h('div', { class: 'nw-also' }, ...rest.slice(0, 3).map(x => h('span', { class: 'nw-also-i' }, ic(CAT_ICON[x.cat] ?? 'info'), x.cat === '史事' || x.cat === '线索' ? (x.text.match(/【([^】]+)】/)?.[1] ?? x.text.slice(0, 16)) : splitReport(x).hl.slice(0, 26)))));
        clear(seals);
        const fs = Object.values(s.factions).filter(f => !f.defunct && f.id !== 'local' && (f.name.length >= 2 ? r.text.includes(f.name) || (f.short.length >= 2 && r.text.includes(f.short)) : ['军', '廷', '朝', '兵'].some(k => r.text.includes(f.name + k)))).slice(0, 3);
        for (const f of fs) seals.append(h('span', { class: 'nw-seal', style: { background: f.color } }, polityOf(s, f.polity).mark || f.short));
        if (node) seals.append(h('span', { class: 'nw-loc' }, ic('locate'), nodeName(node)));
        const spl = r.spoils;
        if (spl && (spl.silver >= 1000 || spl.grain >= 1000 || spl.troops >= 100 || spl.captives.length)) {
          more.append(h('div', { class: 'nw-spoils' }, h('b', null, '所获'),
            spl.silver >= 1000 ? h('span', null, ic('silver'), wan(spl.silver)) : null, spl.grain >= 1000 ? h('span', null, ic('grain'), wan(spl.grain)) : null,
            spl.troops >= 100 ? h('span', null, ic('troops'), wan(spl.troops)) : null, ...spl.captives.map(n => h('span', null, ic('prisoner'), n))));
        }
        card.classList.toggle('urgent', !!r.urgent);
        if (isReduced()) gsap.fromTo(card, { opacity: 0 }, { opacity: 1, duration: 0.15 });
        else {
          gsap.fromTo(card, { x: 60, opacity: 0, rotateY: -25 }, { x: 0, opacity: 1, rotateY: 0, duration: 0.45, ease: 'back.out(1.5)' });
          gsap.fromTo(art, { scale: 1.25 }, { scale: 1, duration: 3.2, ease: 'none' });
        }
        // 镜头、地图动效与声音：按这条军报的事件原因与我方关系（见 newsFx.ts）
        const plan = planNews(s, r);
        card.dataset.visual = plan.visual; card.dataset.sound = plan.sound; card.dataset.persp = plan.persp;
        if (node) {
          if (isReduced()) this.map.focus(node, Math.max(2.1, Math.min(2.8, this.map.cam.z))); else this.map.flyTo(node, Math.max(2.1, Math.min(2.8, this.map.cam.z)));
          this.newsFx(plan, node, ctrl?.color, r.from ? s.factions[r.from]?.color : undefined, (ctrl && polityOf(s, ctrl.polity).mark) || ctrl?.short || '易', r);
        }
        later(() => newsSfx(plan.sound), node ? 350 : 60);
        let left = 3400;
        clearInterval(timer);
        bar.style.width = '0%';
        timer = window.setInterval(() => { if (paused) return; left -= 50; bar.style.width = (100 - left / 34) + '%'; if (left <= 0) next(); }, 50);
      };
      $('#app').append(el);
      gsap.from('#news .nw-head', { opacity: 0, y: -20, duration: 0.35 });
      show(0);
    });
  }

  /** 本月战报要播哪几张卡：先按城合并，再按轻重挑前六张（“只播要紧”只留易主与急报） */
  splashGroups(): NewsGroup[] {
    const s = this.s!;
    const t = this.reportTurn;
    const all = s.reports.filter(r => r.turn === t && (!r.faction || r.faction === s.player));
    const me = topOf(s, s.player);
    const mineNode = (n?: string) => !!n && !!s.cities[n] && topOf(s, s.cities[n].controller) === me;
    // “由你作主”的史实提示只进军情面板，不占战报
    const rank = (r: ReportEntry) => (r.cat === '易主' && (mineNode(r.node) || r.urgent) ? 0 : r.urgent ? 1 : r.cat === '易主' ? 2 : r.ok !== undefined ? 2 : r.cat === '史事' ? 3 : r.cat === '军报' && mineNode(r.node) ? 4 : r.cat === '人事' ? 5 : r.cat === '军报' ? 6 : r.cat === '交涉' ? 6 : r.cat === '线索' && !r.text.includes('由你作主') ? 7 : 9);
    const cap = this.newsMode === 'major' ? 1 : 7;
    const seen = new Set<string>();
    return groupNews(all.filter(r => rank(r) <= 8))
      .sort((a, b) => rank(a.lead) - rank(b.lead))
      .filter(g => { const k = splitReport(g.lead).hl; if (seen.has(k)) return false; seen.add(k); return rank(g.lead) <= cap; })
      .slice(0, 6);
  }

  /** 军报在地图上的动效：陷城有火烟与“破”印；献城、归附、反正只换旗落印；交战才有刀光；围城、解围、退兵、行军各有其形 */
  newsFx(plan: NewsPlan, node: string, color = '#c8352a', color2 = '#7a6a58', mark = '易', r?: ReportEntry) {
    const m = this.map;
    switch (plan.visual) {
      case 'verdict': {
        // 使者持节而往，到了再落成败之印
        const path = r?.origin && r.origin !== node ? shortestPath(r.origin, node, true) ?? shortestPath(r.origin, node, false) : null;
        const ride = path && path.length ? Math.min(1600, 500 + path.length * 160) : 0;
        if (ride && !isReduced()) m.addFx({ kind: 'envoy', node: r!.origin, path: [r!.origin!, ...path!], color: this.s!.factions[this.s!.player].color, dur: ride });
        m.addFx({ kind: 'verdict', node, ok: !!r?.ok, stamp: plan.stamp, color: this.s!.factions[this.s!.player].color, text: verdictLine(r), dur: 2200, delay: isReduced() ? 0 : ride });
        break;
      }
      case 'breach': m.addFx({ kind: 'capture', node, color, color2, text: mark, dur: 2600, delay: 350 }); this.spoilFx(node, r, plan, 1700); break;
      case 'handover': m.addFx({ kind: 'capture', node, color, color2, text: mark, quiet: true, stamp: plan.stamp, dur: 2400, delay: 300 }); this.spoilFx(node, r, plan, 1500); break;
      case 'clash': m.addFx({ kind: 'clash', node, dur: 1700, delay: 300 }); break;
      case 'siege': m.addFx({ kind: 'ripple', node, color: '#e0503f', dur: 1600, delay: 250 }); m.addFx({ kind: 'stamp', node, text: '围', color: '#a0301f', dur: 1500, delay: 450 }); break;
      case 'lift': m.addFx({ kind: 'ripple', node, color: '#9fd18f', dur: 1600, delay: 250 }); m.addFx({ kind: 'stamp', node, text: '解', color: '#3f7a4a', dur: 1500, delay: 450 }); break;
      case 'camp': m.addFx({ kind: 'camp', node, color: plan.act === 'retreat' ? '#8a7a68' : '#f0cf86', text: plan.act === 'retreat' ? '退' : '营', dur: 1800, delay: 300 }); break;
      case 'event': m.addFx({ kind: 'stamp', node, text: plan.stamp ?? '史', color: plan.sound === 'ev:lament' || plan.sound === 'ev:death' ? '#3a3330' : plan.stamp === '线' ? '#3f6f8f' : '#8c6a35', dur: 1500, delay: 300 }); break;
      default: m.addFx({ kind: 'ripple', node, color: plan.sound === 'urgent' ? '#e0503f' : '#f0cf86', dur: 1400, delay: 300 });
    }
  }

  /** 号令回报：本月派出的使者上路；本月有结果的号令落成败之印；方针、募兵、任命、调拨的实际增减飘在城上 */
  async resultFx(before: GameState, after: GameState, issued: Order[] = []): Promise<void> {
    const m = this.map, t = before.turn, me = after.player;
    const col = after.factions[me].color;
    let span = 0, first: string | undefined;
    const fast = isReduced();
    // 1. 新派的使者：从出发地沿路去往目标（路远则本月只走到半路）
    for (const ms of after.missions.filter(x => x.issuedTurn === t && x.faction === me)) {
      const o = ms.order;
      const target = o.kind === 'persuade' ? o.node : o.kind === 'envoy' ? after.factions[o.target]?.capital : undefined;
      const from = after.chars[(o as { char?: string }).char ?? '']?.location ?? after.factions[me].capital;
      if (!target || !from || target === from) continue;
      const p = shortestPath(from, target, true) ?? shortestPath(from, target, false);
      if (!p?.length) continue;
      const months = Math.max(1, ms.arriveTurn - ms.issuedTurn);
      const part = [from, ...p].slice(0, Math.max(2, Math.ceil((p.length + 1) / months)));
      if (!fast) m.addFx({ kind: 'envoy', node: from, path: part, color: col, dur: 1700 });
      m.addFx({ kind: 'float', node: part[part.length - 1], text: months > 1 ? `使者在途 · 约 ${months} 月到` : '使者已至', color: '#f0cf86', dur: 1900, delay: fast ? 0 : 1500 });
      first ??= from; span = Math.max(span, 2200);
    }
    // 2. 结果：使者成败、藩镇奉令（同一结果在战报里还会再讲一遍）
    let k = 0;
    const told = new Set(this.splashGroups().map(g => g.lead.node).filter(Boolean) as string[]);
    for (const r of after.reports.filter(x => x.turn === t && x.ok !== undefined && x.node && !told.has(x.node) && (!x.faction || x.faction === me))) {
      const plan = planNews(after, r);
      const delay = fast ? 0 : 300 + k++ * 500;
      m.addFx({ kind: 'verdict', node: r.node, ok: !!r.ok, stamp: plan.stamp, color: col, text: verdictLine(r), dur: 2200, delay });
      setTimeout(() => resultSfx(!!r.ok), delay);
      first ??= r.node; span = Math.max(span, delay + 2200);
    }
    // 3. 方针、募兵、任命、调拨：账上的实际增减，按城按项飘字
    const SHOW: Record<string, string> = { agri: '农业', commerce: '商业', edu: '文教', order: '吏治', minxin: '民心', garrison: '驻军', grain: '粮', silver: '银', wall: '城防' };
    const sum = new Map<string, number>();
    for (const e of after.ledger) {
      // 本月下的号令所致；方针只在本月新定方针的城显示，免得每月满屏飘字
      if (e.turn !== t || !SHOW[e.field] || !(e.src.kind === 'order' || (e.src.kind === 'policy' && issued.some(o => o.kind === 'policy' && o.node === e.node)))) continue;
      if (topOf(after, after.cities[e.node]?.controller ?? '') !== topOf(after, me)) continue;
      const key = e.node + '|' + e.field;
      sum.set(key, (sum.get(key) ?? 0) + e.delta);
    }
    const perNode = new Map<string, number>();
    for (const [key, d] of sum) {
      if (Math.abs(d) < (key.endsWith('grain') || key.endsWith('silver') || key.endsWith('garrison') ? 100 : 0.5)) continue;
      const [node, field] = key.split('|');
      const n = perNode.get(node) ?? 0; perNode.set(node, n + 1);
      if (n >= 3) continue;
      const big = field === 'grain' || field === 'silver' || field === 'garrison';
      const delay = fast ? 0 : 400 + n * 380;
      m.addFx({ kind: 'float', node, text: `${SHOW[field]} ${d > 0 ? '+' : '−'}${big ? wan(Math.abs(d)) : Math.round(Math.abs(d) * 10) / 10}`, color: d > 0 ? '#bfe6b7' : '#ffb3a6', dur: 2000, delay, dy: -n * 16 });
      first ??= node; span = Math.max(span, delay + 1800);
    }
    if (!span) return;
    if (first && !fast) m.flyTo(first, Math.max(1.4, Math.min(2.2, m.cam.z)));
    if (span) marchSfx(false);
    await new Promise(res => setTimeout(res, fast ? 600 : Math.min(3400, span)));
  }

  /** 各军本月走过的路：从上次画到的位置出发，沿驿路逐站走到本月所在（开战前已开到战场的，从战场接着走） */
  marchPaths(before: GameState, after: GameState, approached: Set<string>): Record<string, [number, number][]> {
    const out: Record<string, [number, number][]> = {};
    for (const a of Object.values(after.armies)) {
      const b = before.armies[a.id];
      if (!b) continue;
      const start = this.map.shown[a.id] ?? armyPt(b), end = armyPt(a);
      if (Math.hypot(start[0] - end[0], start[1] - end[1]) < 1) continue;
      const pts: [number, number][] = [start];
      if (!approached.has(a.id)) {
        const i = b.path.indexOf(a.location);
        const via = i >= 0 ? b.path.slice(0, i + 1) : [];
        for (const n of via) pts.push(nodePt(n));
      }
      pts.push(end);
      out[a.id] = pts;
    }
    return out;
  }

  /** 开战之前：镜头飞到战地，参战各军沿路开到阵前，交锋火光一闪，再进战斗画面 */
  async approach(before: GameState, b: BattleState, approached: Set<string>) {
    const ids = [...b.att.armies, ...b.def.armies].filter(id => before.armies[id]);
    const paths: Record<string, [number, number][]> = {};
    let hops = 0;
    for (const id of ids) {
      const a = before.armies[id];
      const start = this.map.shown[id] ?? armyPt(a), end = nodePt(b.node);
      if (Math.hypot(start[0] - end[0], start[1] - end[1]) < 1) continue;
      const i = a.path.indexOf(b.node);
      const via = i >= 0 ? a.path.slice(0, i + 1).map(nodePt) : [end];
      paths[id] = [start, ...via];
      hops = Math.max(hops, via.length);
      approached.add(id);
    }
    const fast = isReduced();
    if (fast) this.map.focus(b.node, Math.max(1.8, this.map.cam.z)); else this.map.flyTo(b.node, Math.max(1.8, Math.min(2.6, this.map.cam.z)));
    const dur = Object.keys(paths).length ? (fast ? 400 : Math.min(2200, 900 + hops * 300)) : 0;
    if (dur) {
      // 已经在画面上的位置都保持住：前一场仗开到阵前的军队不会弹回原处
      const keep = this.map.view.anim?.paths ?? {};
      const held: Record<string, [number, number][]> = {};
      for (const [id, p] of Object.entries(keep)) if (!paths[id]) held[id] = [p[p.length - 1], p[p.length - 1]];
      this.map.view.anim = { from: {}, paths: { ...held, ...paths }, t0: this.map.lastTime, dur, hold: true };
      marchSfx(b.att.mix.cav >= 0.35);
      await new Promise(res => setTimeout(res, dur + (fast ? 0 : 450)));
    } else await new Promise(res => setTimeout(res, fast ? 100 : 650));
    this.map.addFx({ kind: 'battle', node: b.node, dur: 900 });
    distantBattle();
    await new Promise(res => setTimeout(res, fast ? 150 : 650));
  }

  /** 得城所获飘在城上：银、粮、降卒、俘将（只给得城一方看） */
  spoilFx(node: string, r: ReportEntry | undefined, plan: NewsPlan, delay: number) {
    const sp = r?.spoils;
    if (!sp || plan.persp !== 'gain') return;
    const items = [sp.silver >= 1000 ? `+${wan(sp.silver)} 两` : '', sp.grain >= 1000 ? `+${wan(sp.grain)} 石` : '', sp.troops >= 100 ? `+${wan(sp.troops)} ${plan.act === 'breach' ? '降卒' : '兵'}` : '', ...sp.captives.map(n => `俘 ${n}`)].filter(Boolean);
    items.forEach((text, i) => this.map.addFx({ kind: 'float', node, text, color: text.startsWith('俘') ? '#ffd27a' : text.includes('石') ? '#e8d48a' : '#bfe6b7', dur: 2000, delay: isReduced() ? 0 : delay + i * 260, dy: -i * 17 }));
  }

  /* ================= 月度推进 ================= */
  /** 翻月：旧月翻过，新月落下 */
  monthFlip(before: GameState, after: GameState): Promise<void> {
    return new Promise(resolve => {
      const pol = polityOf(after, after.factions[after.player].polity);
      const lmA = lunarOf(before.turn), lmB = lunarOf(Math.min(after.turn, TOTAL_TURNS - 1));
      const yearChanged = lmA.year !== lmB.year;
      const face = (cls: string, lm: ReturnType<typeof lunarOf>, turn: number) => h('div', { class: 'flip-face ' + cls },
        h('small', null, `${eraYear(polityOf(after, after.factions[after.player].polity), turn)}`), h('b', null, monthName(lm)), h('em', null, `公元 ${lm.year}`));
      const el = h('div', { id: 'flip' }, h('div', { class: 'flip-card' }, face('old', lmA, before.turn), face('new', lmB, Math.min(after.turn, TOTAL_TURNS - 1))),
        yearChanged ? h('div', { class: 'flip-year' }, `${ganzhiOf(lmB.year)}年 · ${eraYear(pol, Math.min(after.turn, TOTAL_TURNS - 1))}`) : null);
      $('#app').append(el);
      monthSfx(yearChanged);
      const tl = gsap.timeline({ onComplete: () => { el.remove(); resolve(); } });
      tl.from(el, { opacity: 0, duration: 0.2 })
        .fromTo('#flip .old', { rotateX: 0 }, { rotateX: -90, duration: 0.45, ease: 'power2.in' })
        .fromTo('#flip .new', { rotateX: 90 }, { rotateX: 0, duration: 0.5, ease: 'back.out(1.6)' })
        .from('#flip .flip-year', { opacity: 0, scale: 1.5, duration: 0.4 }, '-=0.2')
        .to(el, { opacity: 0, y: -20, duration: 0.35, delay: yearChanged ? 0.8 : 0.45 });
    });
  }

  /** 月末地图动效：易主冲击波、交战火光、新围城、本方钱粮飘字 */
  monthFx(before: GameState, after: GameState) {
    const m = this.map;
    const t = before.turn;
    let k = 0;
    const told = new Set(this.splashGroups().map(g => g.lead.node).filter(Boolean) as string[]);
    for (const r of after.reports.filter(x => x.turn === t && x.cat === '易主' && x.node)) {
      const c = after.cities[r.node!];
      const f = after.factions[c?.controller ?? ''];
      if (!c || before.cities[r.node!]?.controller === c.controller || told.has(r.node!)) continue;
      const plan = planNews(after, r);
      m.addFx({ kind: 'capture', node: r.node, color: f?.color ?? '#c8352a', color2: before.factions[before.cities[r.node!]?.controller ?? '']?.color, text: polityOf(after, f?.polity ?? 'none').mark || f?.short || '易', quiet: plan.visual === 'handover', stamp: plan.stamp, dur: 2600, delay: 500 + (k++ % 8) * 260 });
    }
    after.battles.filter(b => b.turn === t && !told.has(b.node)).slice(-12).forEach((b, i) => m.addFx({ kind: 'clash', node: b.node, dur: 1700, delay: 200 + i * 160 }));
    for (const r of after.reports.filter(x => x.turn === t && x.cat === '交涉' && /结盟|停战|议和|和好/.test(x.text) && !/未成|拒/.test(x.text))) {
      const fs = Object.values(after.factions).filter(f => r.text.includes(f.name)).slice(0, 2);
      const node = fs[1]?.capital ?? fs[0]?.capital;
      if (node) m.addFx({ kind: 'treaty', node, color: fs[0]?.color, color2: fs[1]?.color, text: '约', dur: 2600, delay: 700 });
    }
    if (after.battles.some(b => b.turn === t)) setTimeout(distantBattle, 300);
    const me = after.player;
    const lost = Object.keys(after.cities).some(id => before.cities[id]?.controller === me && after.cities[id].controller !== me);
    const won = Object.keys(after.cities).some(id => before.cities[id]?.controller !== me && after.cities[id].controller === me);
    if (lost || won) setTimeout(() => captureSfx(!lost), 650);
    this.musicForState();
    for (const node of Object.keys(after.sieges)) if (!before.sieges[node]) m.addFx({ kind: 'ripple', node, color: '#e0503f', dur: 1600, delay: 900 });
    const cap = after.factions[after.player].capital;
    const b0 = before.cities[cap], a0 = after.cities[cap];
    if (b0 && a0) {
      const ds = a0.silver - b0.silver, dg = a0.grain - b0.grain;
      if (Math.abs(ds) >= 100) m.addFx({ kind: 'float', node: cap, text: `${ds > 0 ? '+' : '−'}${wan(Math.abs(ds))} 两`, color: ds > 0 ? '#bfe6b7' : '#ffb3a6', dur: 1900, delay: 1200 });
      if (Math.abs(dg) >= 100) m.addFx({ kind: 'float', node: cap, text: `${dg > 0 ? '+' : '−'}${wan(Math.abs(dg))} 石`, color: dg > 0 ? '#e8d48a' : '#ffb3a6', dur: 1900, delay: 1500, dy: 18 });
    }
  }

  async endTurn() {
    if (!this.s || this.resolving || this.s.ended) return;
    this.resolving = true;
    endTurnSfx();
    this.hideRing();
    gsap.fromTo('#btn-next', { scale: 0.9 }, { scale: 1, duration: 0.4, ease: 'back.out(3)' });
    this.toggleMenu(false);
    this.closePanel();
    this.endTarget();
    $('#hint').classList.add('hidden');
    this.renderTop();
    const before = this.s;
    const gen = resolveMonth(before, this.orders);
    const approached = new Set<string>();
    let r = gen.next();
    try {
      while (!r.done) {
        const it = r.value;
        let ans: Answer;
        if (it.type === 'battle') {
          await this.approach(before, it.battle, approached);
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
    const from: Record<string, [number, number]> = {};
    for (const a of Object.values(before.armies)) from[a.id] = this.map.shown[a.id] ?? armyPt(a);
    const marchPaths = this.marchPaths(before, r.value.state, approached);
    this.s = r.value.state;
    const issued = this.orders;
    this.orders = [];
    this.map.view.state = this.s;
    const hops = Math.max(0, ...Object.values(marchPaths).map(p => p.length));
    this.map.view.anim = { from, paths: marchPaths, t0: this.map.lastTime, dur: isReduced() ? 500 : Math.min(3200, 1500 + hops * 260) };
    if (Object.keys(marchPaths).some(id => this.s!.armies[id] && topOf(this.s!, this.s!.armies[id].faction) === topOf(this.s!, this.s!.player))) marchSfx(Object.values(this.s.armies).some(a => a.faction === this.s!.player && a.mix.cav >= 0.35));
    this.autoSave();
    this.reportTurn = this.s.turn - (this.s.ended ? 0 : 1);
    this.holdPills = true;
    this.renderAll();
    const urgent = this.s.reports.some(x => x.turn === this.reportTurn && x.urgent && (!x.faction || x.faction === this.s!.player));
    if (urgent) alarm(); else chime();
    this.monthFx(before, this.s);
    await this.monthFlip(before, this.s);
    await this.resultFx(before, this.s, issued);
    // 顶栏关键数字：此刻才从上月滚到本月，并飘出增减
    this.holdPills = false;
    this.renderTop();
    if (!isReduced()) await new Promise(res => setTimeout(res, 900));
    await new Promise(res => setTimeout(res, isReduced() ? 150 : 500));
    const wantAll = await this.showSplash();
    this.resolving = false;
    this.renderTop();
    $('#report').classList.add('hidden');
    if (wantAll && !this.s.ended) this.toggleReport();
    gsap.fromTo('#btn-report', { scale: 1.4 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    if (this.hintStep === 2) this.advanceHint(3);
    if (this.s.ended) this.showEnd();
  }

  choose(c: PendingChoice): Promise<number> {
    return new Promise(resolve => {
      this.modalOpener = null;
      const m = clear($('#modal'));
      m.classList.remove('hidden');
      m.onclick = null;
      this.forcedModal = true;   // 史事决断必须作答：Esc、点背景都不关
      const opts = h('div', { class: 'opts' });
      c.options.forEach((o, i) => opts.append(h('button', { class: 'opt' + (o.disabled ? ' off' : ''), 'data-choice': i, disabled: o.disabled ? true : undefined, onclick: () => { if (o.disabled) return; this.closeModal(); resolve(i); } },
        h('span', { class: 'num' }, String(i + 1)), h('div', null, h('b', null, o.label), h('small', null, o.desc), o.disabled ? h('small', { class: 'opt-why' }, ic('close'), o.disabled) : null))));
      if (c.tone) eventSfx(c.tone); else choiceSfx();
      m.append(h('div', { class: 'dialog hud', role: 'dialog' },
        h('div', { class: 'dh' }, h('div', { class: 'emb' }, ic('event')), h('div', null, h('h2', null, c.title), h('small', null, `史事 · ${this.s?.factions[this.s.player]?.name ?? ''}决断`))),
        h('div', { class: 'db' }, h('div', { class: 'lead' }, c.text), opts)));
      gsap.fromTo('#modal .dialog', { scale: 0.85, opacity: 0, rotateX: 20 }, { scale: 1, opacity: 1, rotateX: 0, duration: 0.45, ease: 'back.out(1.6)' });
      gsap.from('#modal .opt', { opacity: 0, x: -30, duration: 0.35, stagger: 0.1, delay: 0.2, ease: 'power3.out' });
      requestAnimationFrame(() => ($('#modal .opt') as HTMLElement | null)?.focus({ preventScroll: true }));
    });
  }

  showEnd() {
    const s = this.s!;
    this.musicForState();
    const u = unificationProgress(s);
    const myBattles = s.battles.filter(b => this.isMineOrVassal(b.attacker) || this.isMineOrVassal(b.defender));
    const kind = s.ended!.kind;
    const me = s.factions[s.player];
    const own = citiesOf(s, s.player).length;
    const troops = citiesOf(s, s.player).reduce((n, c) => n + c.garrison, 0) + Object.values(s.armies).filter(a => a.faction === s.player).reduce((n, a) => n + a.troops, 0);
    const years = Math.floor((Math.min(s.turn, TOTAL_TURNS - 1)) / 12 * 10) / 10;
    const dlg = this.modal(kind === 'unified' ? 'emperor' : kind === 'fallen' ? 'ruins' : 'hourglass', kind === 'trial_end' ? '试玩结束' : kind === 'unified' ? (s.ended!.role === 'patron' ? '扶明定鼎' : s.ended!.role === 'follow' ? '随主一统' : '天下一统') : kind === 'fallen' ? (s.flags['joined_' + s.player] ? '部众投靠' : '覆亡') : '天下未定', s.ended!.text, [
      h('div', { class: 'end-seal', style: { background: me.color } }, polityOf(s, me.polity).mark || me.short),
      h('div', { class: 'tiles' },
        this.tile('city', '城池', `${own}`, { unit: `/ ${Object.keys(s.cities).length}` }),
        this.tile('goal', '统一进度', `${u.held}/${u.total}`),
        this.tile('hourglass', '历时', `${years}`, { unit: '年' }),
        this.tile('battle', '参与战斗', String(myBattles.length)),
        this.tile('event', '史事线索', String(s.events.length)),
        this.tile('troops', '直辖兵', wan(troops))),
      h('div', { class: 'note' }, kind === 'trial_end' ? '可继续推进。' : kind === 'fallen' ? '本局已覆亡，可读取更早的存档重来，或换一方再战。' : kind === 'unified' ? '天下归一。可回看军情，或换一方再战。' : '剧本期满。可回看军情，或换一方再战。'),
    ], [
      { label: '回到标题', icon: 'exit', onclick: () => this.showTitle() },
      ...(kind !== 'trial_end' ? [] : [{ label: '继续推进', icon: 'next', primary: true, id: 'end-continue', onclick: () => {
        if (this.s !== s || !s.ended) return; // 只能前进一次
        delete s.ended; s.turnLimit = undefined; s.scenario = 'full'; s.turn++;
        this.autoSave();
        this.renderAll();
      } }]),
    ]);
    gsap.from(dlg.querySelector('.end-seal'), { scale: 3, rotate: -30, opacity: 0, duration: 0.6, ease: 'back.out(2)', delay: 0.2 });
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
    if (this.kv.volatile) this.volatileWarn();
    else this.toast(`已存入存档 ${slot}`, 'save');
    this.closeModal();
    this.openSaves(false);
  }
  autoSave() {
    if (!this.s) return;
    if (!saveTo(this.kv, 'auto', this.s, this.saveLabel(this.s))) this.saveFailed('自动存档');
    else if (this.kv.volatile && !this.warnedVolatile) this.volatileWarn();
  }
  warnedVolatile = false;
  /** 浏览器不许本地存储（隐私模式等）：存档只在这次打开期间有效 */
  volatileWarn() {
    this.warnedVolatile = true;
    const el = h('div', { class: 'hud warn', id: 'save-fail', style: { pointerEvents: 'auto' } }, ic('info'),
      '此浏览器不允许本地存储，存档只在本次打开期间有效，刷新或关闭即失。要留档请导出为文件。',
      h('button', { class: 'mini', id: 'save-fail-export', onclick: () => { this.exportSave(); el.remove(); } }, ic('transfer'), '导出为文件'),
      h('button', { class: 'mini', onclick: () => el.remove() }, '知道了'));
    $('#save-fail')?.remove();
    $('#toast').append(el);
    gsap.from(el, { y: -16, opacity: 0, duration: 0.3 });
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

  /* ================= 开局三步（目标追踪） ================= */
  showHint() {
    const el = $('#hint');
    if (!this.s || this.hintStep >= 3) { el.classList.add('hidden'); this.map.view.beacon = null; return; }
    const cap = this.s.factions[this.s.player].capital;
    const steps: [string, string][] = [['city', `点你的都城：${nodeName(cap)}`], ['policy', '下一道命令'], ['next', '结束本月']];
    clear(el);
    el.className = 'hud';
    el.append(h('div', { class: 'q-h' }, ic('goal'), h('b', null, '开局三步'), h('button', { class: 'q-x', 'aria-label': '不再提示', 'data-tip': '不再提示', onclick: () => { this.hintStep = 9; try { localStorage.setItem(HINT_KEY, '9'); } catch { /* ignore */ } this.showHint(); this.renderTop(); } }, ic('close'))));
    steps.forEach(([icon, text], i) => el.append(h('div', { class: 'q-step' + (i < this.hintStep ? ' done' : i === this.hintStep ? ' now' : '') }, h('i', { class: 'q-box' }, i < this.hintStep ? ic('ok') : String(i + 1)), ic(icon), h('span', null, text))));
    el.classList.remove('hidden');
    this.map.view.beacon = this.hintStep === 0 ? cap : null;
    gsap.from('#hint .q-step.now', { x: -10, opacity: 0.3, duration: 0.4 });
  }
  /** 完成一步：打勾、下一步 */
  advanceHint(to: number) {
    if (this.hintStep >= to || this.hintStep >= 9) return;
    this.hintStep = to;
    successSfx();
    if (to >= 3) {
      try { localStorage.setItem(HINT_KEY, '9'); } catch { /* ignore */ }
      const el = $('#hint');
      this.map.view.beacon = null;
      clear(el).append(h('div', { class: 'q-done' }, ic('winner'), h('b', null, '上手了'), h('small', null, '接下来，天下由你')));
      gsap.fromTo(el, { scale: 1.15 }, { scale: 1, duration: 0.4, ease: 'back.out(2)' });
      setTimeout(() => gsap.to(el, { opacity: 0, duration: 0.5, onComplete: () => { el.classList.add('hidden'); el.style.opacity = ''; } }), 2600);
      this.hintStep = 9;
      return;
    }
    this.showHint();
    this.renderTop();
  }
}

function sameTarget(a: Order, b: Order): boolean {
  switch (a.kind) {
    case 'policy': return (b as any).node === a.node;
    case 'army': return (b as any).army === a.army;
    case 'supply': return (b as any).army === a.army;
    case 'command': return (b as any).army === a.army;
    case 'appoint': return (b as any).node === a.node;
    case 'persuade': return (b as any).node === a.node;   // 同城只派一路使者，后派者替换前派
    case 'trade': case 'loan': return (b as any).node === a.node;   // 同城一月一笔
    default: return false;
  }
}
const pct = (v: number) => Math.round(v * 100) + '%';
function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}

/** 五维能力的雷达图 */
function radar(ab: { tong: number; zheng: number; mou: number; wai: number; wang: number }): HTMLCanvasElement {
  const S = 170, cv = document.createElement('canvas'); cv.width = S * 2; cv.height = S * 2; cv.className = 'p-radar';
  const g = cv.getContext('2d')!; g.scale(2, 2);
  const cx = S / 2, cy = S / 2 + 6, R = 58;
  const keys = ['tong', 'zheng', 'mou', 'wai', 'wang'] as const, names = ['统', '政', '谋', '外', '望'];
  const pt = (i: number, r: number) => [cx + Math.cos(-Math.PI / 2 + i * Math.PI * 2 / 5) * r, cy + Math.sin(-Math.PI / 2 + i * Math.PI * 2 / 5) * r];
  g.strokeStyle = 'rgba(217,173,91,0.3)'; g.lineWidth = 1;
  for (const k of [0.25, 0.5, 0.75, 1]) { g.beginPath(); for (let i = 0; i <= 5; i++) { const [x, y] = pt(i % 5, R * k); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); }
  for (let i = 0; i < 5; i++) { const [x, y] = pt(i, R); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); }
  g.beginPath(); keys.forEach((k, i) => { const [x, y] = pt(i, R * ab[k] / 100); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath();
  g.fillStyle = 'rgba(224,80,63,0.45)'; g.fill(); g.strokeStyle = '#f0cf86'; g.lineWidth = 2; g.stroke();
  keys.forEach((k, i) => { const [x, y] = pt(i, R * ab[k] / 100); g.fillStyle = '#fff3d9'; g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill(); });
  g.fillStyle = '#e8d9b4'; g.font = '700 13px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  names.forEach((n, i) => { const [x, y] = pt(i, R + 15); g.fillText(n, x, y); });
  return cv;
}
