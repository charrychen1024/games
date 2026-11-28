/* 地图绘制：明末舆图的设色与山水笔意，全部由代码生成。
 * 底图（纸、海波、山形、长城）预先绘入离屏画布；势力色、河流、城池、军队每帧矢量绘制。
 * 远看以河流、疆域、城名为主；放大后才出现城防、港口、驻军与路线。 */
import { Delaunay } from 'd3-delaunay';
import type { GameState, Army } from '../core/types';
import { NODES, NODE, ROUTES, RIVERS, CANALS, LAKES, GREAT_WALL } from '../data/geography';
import type { Route } from '../core/types';
import { loadRelief, paintRelief, grainTile, snapRiver, type Relief } from './relief';
import reliefUrl from '../assets/relief.png?url';
import { POLITIES } from '../data/factions';
import { project, WORLD_W, WORLD_H, worldToScreen, screenToWorld, flatV, flatW, flatZ, depthAt, type Camera } from './projection';
import { makeRng } from '../core/rng';
import { spreadApart, fanSlots, nearestHit, calloutOffsets } from './declutter';
import { friendly } from '../core/state';
import { routeBetween, neighbors, shortestPath } from '../data/geography';
import { supplyRoute } from '../core/route';
import land from '../data/geo-land.json';
import { ICONS } from '../ui/icons';
import { emblem, flagAnchor, drawWavingFlag, type EmblemType } from './emblems';
import { relationTone, frontEdge, cityStores, storeTier, monthsText, TONE_COLOR, TIER_COLOR, type LensId, type Stores } from './lens';

const ICON_CACHE: Record<string, Path2D> = {};
/** game-icons 的 SVG 路径 → Canvas Path2D（512×512 坐标） */
export function iconPath(name: string): Path2D {
  if (!ICON_CACHE[name]) {
    const body = ICONS[name] ?? '';
    const p = new Path2D();
    for (const m of body.matchAll(/ d="([^"]+)"/g)) p.addPath(new Path2D(m[1]));
    ICON_CACHE[name] = p;
  }
  return ICON_CACHE[name];
}
export function drawIcon(g: CanvasRenderingContext2D, name: string, cx: number, cy: number, size: number, color: string) {
  g.save();
  g.translate(cx - size / 2, cy - size / 2);
  g.scale(size / 512, size / 512);
  g.fillStyle = color;
  g.fill(iconPath(name));
  g.restore();
}
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

export const INK = '#2a2118';
export const PAPER = '#ecdfc0';
const SEA = '#244f6a';
const WATER = '#3f7f9e';
const BASE_SCALE = 2;

export interface MapView {
  state: GameState | null;
  selected: string | null;
  selectedArmy: string | null;
  hover: string | null;
  /** 目标选择模式：高亮可去之处 */
  targeting: { army: string; path: string[] | null } | null;
  /** 本月待发的行军命令（用于画预定路线） */
  planned: { army: string; path: string[] }[];
  /** 月末回放：军队从上月位置走到本月位置 */
  anim?: { from: Record<string, Pt>; t0: number; dur: number; paths?: Record<string, Pt[]>; hold?: boolean } | null;
  /** 选势力时高亮其疆域 */
  highlight?: string | null;
  /** 引导：在某城上画脉动光圈 */
  beacon?: string | null;
  /** 图层：势力（默认）、军情、钱粮 */
  lens?: LensId;
}
type Rect = [number, number, number, number];
interface SubPart { t: string; col: string }
/** ax, ay：城郭挪到旁边空处时，城的真实位置（画一根牵引线连回去） */
interface NodeSlot { id: string; sx: number; sy: number; w: number; tier: 'full' | 'small' | 'dot'; label: Rect | null; fsize: number; big: boolean; sub: SubPart[] | null; ax?: number; ay?: number }
interface ArmyStack { armies: string[]; sx: number; sy: number; ax: number; ay: number; moving: boolean; march?: [number, number] }
export interface Fx { kind: 'capture' | 'battle' | 'stamp' | 'float' | 'ripple' | 'convoy' | 'clash' | 'treaty' | 'card' | 'march' | 'camp' | 'envoy' | 'verdict'; node?: string; quiet?: boolean; stamp?: string; ok?: boolean; from?: string; path?: string[]; text?: string; color?: string; color2?: string; img?: string; dy?: number; t0: number; dur: number }
const fxImg = new Map<string, HTMLImageElement>();
function imgOf(url: string): HTMLImageElement { let im = fxImg.get(url); if (!im) { im = new Image(); im.src = url; fxImg.set(url, im); } return im; }
const MAX_Z = 6;
/** 城郭标志的屏幕宽度（像素） */
const EMBLEM_PX: Record<EmblemType, number> = { capital: 50, region: 42, major: 42, city: 34, port: 34, ferry: 28, pass: 32 };
const easeInOut = (t: number) => t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
/** 朱印：方章里一个字 */
function stamp(g: CanvasRenderingContext2D, ch: string, color: string, k: number) {
  g.save(); g.scale(k, k);
  roundRect(g, -11, -11, 22, 22, 3);
  g.fillStyle = color; g.fill();
  g.strokeStyle = 'rgba(255,240,210,0.9)'; g.lineWidth = 1.2; g.stroke();
  g.fillStyle = '#fff6e2'; g.font = '700 14px "Ma Shan Zheng", "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, 0, 1);
  g.restore();
}

type Pt = [number, number];
const P = (lon: number, lat: number): Pt => project(lon, lat);

export class MapRenderer {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cam: Camera = { x: 0, y: 0, z: 1 };
  base: HTMLCanvasElement;
  landPath = new Path2D();
  cells: Record<string, Pt[]> = {};
  edges: { a: string; b: string; pts: Pt[] }[] = [];
  view: MapView = { state: null, selected: null, selectedArmy: null, hover: null, targeting: null, planned: [] };
  armyHits: { id: string; x: number; y: number; r: number; stack: string[] }[] = [];
  dpr = 1;
  w = 0;
  h = 0;
  relief: Relief | null = null;
  flats: HTMLCanvasElement[] | null = null;
  /** 世界坐标 → 屏幕坐标（含 2.5D 倾斜） */
  toScreen(x: number, y: number): [number, number] { return worldToScreen(this.cam, this.w, this.h, x, y); }
  reliefReady = false;
  /** 入谷后的河道（世界坐标） */
  riverPaths: { width: number; pts: Pt[] }[] = [];
  lakePaths: Path2D[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    for (const ring of (land as any).rings as Pt[][]) {
      ring.forEach(([lon, lat], i) => { const [x, y] = P(lon, lat); i ? this.landPath.lineTo(x, y) : this.landPath.moveTo(x, y); });
      this.landPath.closePath();
    }
    this.buildCells();
    this.buildWater(null);
    this.base = this.buildBase(null);
    loadRelief(reliefUrl).then(r => {
      this.relief = r;
      this.buildWater(r);
      this.base = this.buildBase(r);
      this.reliefReady = true;
    }).catch(err => console.warn('relief', err));
    const [nx, ny] = P(118.2, 31.6);
    this.cam = { x: nx, y: ny, z: 1.6 };
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = r.width; this.h = r.height;
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
  }

  /* ---------- 预计算：势力分区（Voronoi） ---------- */
  buildCells() {
    const pts = NODES.map(n => P(n.lon, n.lat));
    // 外围补点，让边缘的格子不至于无限大
    const pad: Pt[] = [];
    for (let i = 0; i <= 10; i++) { pad.push([WORLD_W * i / 10, -60], [WORLD_W * i / 10, WORLD_H + 60]); pad.push([-60, WORLD_H * i / 10], [WORLD_W + 60, WORLD_H * i / 10]); }
    const all = [...pts, ...pad];
    const d = Delaunay.from(all);
    const vor = d.voronoi([-80, -80, WORLD_W + 80, WORLD_H + 80]);
    NODES.forEach((n, i) => { const poly = vor.cellPolygon(i); if (poly) this.cells[n.id] = poly.map(p => [p[0], p[1]] as Pt); });
    const key = (p: Pt) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    const seen = new Set<string>();
    NODES.forEach((n, i) => {
      for (const j of d.neighbors(i)) {
        if (j >= NODES.length) continue;
        const m = NODES[j];
        const k = n.id < m.id ? n.id + '|' + m.id : m.id + '|' + n.id;
        if (seen.has(k)) continue;
        seen.add(k);
        const ca = this.cells[n.id], cb = this.cells[m.id];
        if (!ca || !cb) continue;
        const setB = new Set(cb.map(key));
        const shared = ca.filter(p => setB.has(key(p)));
        const uniq: Pt[] = [];
        for (const p of shared) if (!uniq.some(q => key(q) === key(p))) uniq.push(p);
        if (uniq.length >= 2) this.edges.push({ a: n.id, b: m.id, pts: wobble(uniq[0], uniq[1], k) });
      }
    });
  }

  /* ---------- 水系：河道入谷、湖岸 ---------- */
  buildWater(r: Relief | null) {
    this.riverPaths = RIVERS.map(rv => ({ width: rv.width, pts: snapRiver(r, rv.pts).map(([lo, la]) => P(lo, la)) }));
    const rng = makeRng(31);
    this.lakePaths = LAKES.map(l => {
      const [x, y] = P(l.lon, l.lat);
      const p = new Path2D();
      const n = 40, ph = [rng.next() * 6, rng.next() * 6, rng.next() * 6];
      for (let k = 0; k <= n; k++) {
        const t = k / n * Math.PI * 2;
        const rr = 1 + 0.16 * Math.sin(t * 3 + ph[0]) + 0.09 * Math.sin(t * 5 + ph[1]) + 0.05 * Math.sin(t * 9 + ph[2]);
        const ex = Math.cos(t) * l.rx * 34 * rr, ey = Math.sin(t) * l.ry * 40 * rr;
        const px = x + ex * Math.cos(l.rot) - ey * Math.sin(l.rot), py = y + ex * Math.sin(l.rot) + ey * Math.cos(l.rot);
        k ? p.lineTo(px, py) : p.moveTo(px, py);
      }
      p.closePath();
      return p;
    });
  }

  /* ---------- 底图：真实地形晕渲 + 道路 + 长城 ---------- */
  buildBase(r: Relief | null): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(WORLD_W * BASE_SCALE);
    c.height = Math.round(WORLD_H * BASE_SCALE);
    const g = c.getContext('2d')!;
    g.scale(BASE_SCALE, BASE_SCALE);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    const img = r ? paintRelief(r) : null;
    // 海
    if (img) g.drawImage(img.sea, 0, 0, WORLD_W, WORLD_H);
    else { g.fillStyle = '#3f7f97'; g.fillRect(0, 0, WORLD_W, WORLD_H); }
    // 近岸浪花：海岸外一圈浅色
    g.save();
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(200,230,226,0.22)'; g.lineWidth = 5; g.stroke(this.landPath);
    g.strokeStyle = 'rgba(225,242,238,0.35)'; g.lineWidth = 2; g.stroke(this.landPath);
    g.restore();
    // 陆地
    g.save();
    g.shadowColor = 'rgba(10,30,40,0.5)'; g.shadowBlur = 4;
    g.fillStyle = '#7d9460'; g.fill(this.landPath);
    g.restore();
    g.save();
    g.clip(this.landPath);
    if (img) g.drawImage(img.land, 0, 0, WORLD_W, WORLD_H);
    // 细纹理
    const pat = g.createPattern(grainTile(), 'repeat');
    if (pat) { g.save(); g.scale(1 / BASE_SCALE, 1 / BASE_SCALE); g.fillStyle = pat; g.fillRect(0, 0, WORLD_W * BASE_SCALE, WORLD_H * BASE_SCALE); g.restore(); }
    // 驿路：土路，浅黄路面 + 深色路肩，随势微曲
    g.lineCap = 'round'; g.lineJoin = 'round';
    const roads = ROUTES.filter(rt => rt.kind === 'land');
    for (const [w, col] of [[2.1, 'rgba(58,40,24,0.38)'], [1.0, 'rgba(232,212,164,0.78)']] as const) {
      g.strokeStyle = col; g.lineWidth = w;
      for (const rt of roads) { const q = routeCurve(rt); g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[2], q[3], q[4], q[5]); g.stroke(); }
    }
    // 长城：石墙 + 敌楼
    const wall = smoothPts(GREAT_WALL.map(([lo, la]) => P(lo, la)));
    g.beginPath(); wall.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = 'rgba(40,30,22,0.7)'; g.lineWidth = 3; g.stroke();
    g.strokeStyle = '#b9ab92'; g.lineWidth = 1.5; g.stroke();
    let acc = 0;
    for (let i = 1; i < wall.length; i++) {
      acc += Math.hypot(wall[i][0] - wall[i - 1][0], wall[i][1] - wall[i - 1][1]);
      if (acc > 9) {
        acc = 0;
        const [x, y] = wall[i];
        g.fillStyle = 'rgba(40,30,22,0.8)'; g.fillRect(x - 1.8, y - 1.8, 3.6, 3.6);
        g.fillStyle = '#d6c9ae'; g.fillRect(x - 1.1, y - 1.3, 2.2, 2.2);
      }
    }
    g.restore();
    // 海路：浅色虚线航道
    g.save();
    g.setLineDash([3, 4]); g.lineCap = 'round';
    g.strokeStyle = 'rgba(220,238,240,0.4)'; g.lineWidth = 0.9;
    for (const rt of ROUTES.filter(rt => rt.kind === 'sea')) { const q = routeCurve(rt); g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[2], q[3], q[4], q[5]); g.stroke(); }
    g.restore();
    // 海名
    g.fillStyle = 'rgba(214,234,240,0.55)';
    g.font = '600 15px "Noto Serif SC", "Songti SC", serif';
    vertText(g, '东海', ...P(124.2, 29.5), 18);
    vertText(g, '南海', ...P(114.5, 19.8), 18);
    vertText(g, '黄海', ...P(123.2, 35.2), 18);
    return c;
  }

  /* ---------- 每帧绘制 ---------- */
  lastTime = 0;
  target: { x: number; y: number; z: number } | null = null;
  render(time: number) {
    this.lastTime = time;
    if (this.target) {
      const t = this.target;
      this.cam.x += (t.x - this.cam.x) * 0.16; this.cam.y += (t.y - this.cam.y) * 0.16; this.cam.z += (t.z - this.cam.z) * 0.16;
      if (Math.abs(t.x - this.cam.x) < 0.5 && Math.abs(t.y - this.cam.y) < 0.5 && Math.abs(t.z - this.cam.z) < 0.005) this.target = null;
      this.clamp();
    }
    const { ctx: g, cam } = this;
    const s = this.view.state;
    // 2.5D：平面先画到两张平面画布（远处一张分辨率低些；每张都在浏览器 GPU 加速的面积上限之内），
    // 再逐行条带贴上屏幕（远小近大）
    const vTop = flatV(this.h, 0), vBot = flatV(this.h, this.h), vMid = flatV(this.h, this.h * 0.45);
    const Z = flatZ(cam);
    const tiles = [{ v0: vTop, v1: vMid, wMax: flatW(this.h, vTop), fd: this.dpr / flatW(this.h, vMid) }, { v0: vMid, v1: vBot, wMax: flatW(this.h, vMid), fd: this.dpr }];
    this.flats ??= [document.createElement('canvas'), document.createElement('canvas')];
    const made = tiles.map((t, i) => {
      const TW = Math.ceil(this.w * t.wMax) + 4, TH = Math.ceil(t.v1 - t.v0) + 4;
      const c = this.flats![i];
      const pw = Math.round(TW * t.fd), ph = Math.round(TH * t.fd);
      if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
      const f = c.getContext('2d')!;
      f.setTransform(t.fd, 0, 0, t.fd, 0, 0);
      f.fillStyle = SEA; f.fillRect(0, 0, TW, TH);
      f.save();
      f.translate(TW / 2, 2 - t.v0);
      f.scale(Z, Z);
      f.translate(-cam.x, -cam.y);
      f.imageSmoothingQuality = 'high';
      f.drawImage(this.base, 0, 0, WORLD_W, WORLD_H);
      // 东缘是海：舆图边上淡入海色，远看倾斜时画面上角不露出直边
      const eg = f.createLinearGradient(WORLD_W - 90, 0, WORLD_W, 0); eg.addColorStop(0, 'rgba(0,0,0,0)'); eg.addColorStop(1, SEA);
      f.fillStyle = eg; f.fillRect(WORLD_W - 90, 0, 90, WORLD_H);
      if (s) this.drawTerritory(f, s);
      this.drawWater(f);
      if (s) this.drawRoutes(f, s, time);
      if (s && this.lens === 'econ') this.drawSupply(f, s, time);
      else if (s && this.view.selectedArmy) {
        // 选中本方（或下属）军队：画出它的粮道，断在哪里一目了然
        const a = s.armies[this.view.selectedArmy];
        if (a && topOfSafe(s, a.faction) === s.player && a.supply && s.cities[a.supply] && !(a.location === a.supply && !a.progress)) this.supplyLine(f, s, a, time);
      }
      this.drawCloudShadows(f, time);
      f.restore();
      return { ...t, c, TW };
    });
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'low';
    const Hd = this.canvas.height, Wd = this.canvas.width, band = 2;
    for (let y0 = 0; y0 < Hd; y0 += band) {
      const y1 = Math.min(Hd, y0 + band);
      const v0 = flatV(this.h, y0 / this.dpr), v1 = flatV(this.h, y1 / this.dpr);
      const t = (v0 + v1) / 2 < vMid ? made[0] : made[1];
      const sw = this.w * flatW(this.h, (v0 + v1) / 2) * t.fd;
      g.drawImage(t.c, (t.TW * t.fd - sw) / 2, (v0 - t.v0 + 2) * t.fd, sw, (v1 - v0) * t.fd, 0, y0, Wd, y1 - y0);
    }
    // 远处薄雾：越往上越淡入天色
    const haze = g.createLinearGradient(0, 0, 0, Hd * 0.32);
    haze.addColorStop(0, 'rgba(226,218,196,0.42)'); haze.addColorStop(0.5, 'rgba(226,218,196,0.14)'); haze.addColorStop(1, 'rgba(226,218,196,0)');
    g.fillStyle = haze; g.fillRect(0, 0, Wd, Hd * 0.32);
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    if (s) this.drawScreen(g, s, time);
  }

  drawTerritory(g: CanvasRenderingContext2D, s: GameState) {
    g.save();
    g.clip(this.landPath);
    const hl = this.view.highlight;
    for (const n of NODES) {
      const c = s.cities[n.id];
      const poly = this.cells[n.id];
      if (!c || !poly) continue;
      const [fill, al] = hl ? [s.factions[c.controller]?.color ?? '#999', (c.controller === hl || s.factions[c.controller]?.overlord === hl) ? 0.5 + 0.08 * Math.sin(this.lastTime / 300) : 0.07] : this.tint(s, n.id);
      g.globalAlpha = al;
      g.fillStyle = fill;
      g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    }
    g.globalAlpha = 1;
    // 外域：淡墨斜线
    g.strokeStyle = 'rgba(80,60,40,0.10)'; g.lineWidth = 1;
    for (const n of NODES.filter(n => n.kind === 'outland')) {
      const poly = this.cells[n.id]; if (!poly) continue;
      g.save();
      g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
      for (let k = -WORLD_H; k < WORLD_W; k += 9) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + WORLD_H, WORLD_H); g.stroke(); }
      g.restore();
    }
    // 疆界内侧色带：各自颜色向内晕开
    const bw = 7 / Math.sqrt(this.cam.z) + 2;
    for (const e of this.edges) {
      const ca = s.cities[e.a]?.controller, cb = s.cities[e.b]?.controller;
      if (ca === cb || NODE[e.a].kind === 'outland' || NODE[e.b].kind === 'outland') continue;
      for (const [id, f] of [[e.a, ca], [e.b, cb]] as const) {
        const poly = this.cells[id]; if (!poly) continue;
        const band = this.bandColor(s, id, f!);
        if (!band) continue;
        g.save();
        g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
        g.strokeStyle = band; g.globalAlpha = 0.5; g.lineWidth = bw;
        g.beginPath(); e.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        g.restore();
      }
    }
    // 疆界：不同实控者之间
    for (const e of this.edges) {
      const ca = s.cities[e.a]?.controller, cb = s.cities[e.b]?.controller;
      const outA = NODE[e.a].kind === 'outland', outB = NODE[e.b].kind === 'outland';
      if (ca === cb && !outA && !outB) continue;
      if (outA && outB) continue;
      const major = !outA && !outB && topOfSafe(s, ca!) !== topOfSafe(s, cb!);
      g.beginPath(); e.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = major ? 'rgba(28,16,10,0.85)' : 'rgba(28,16,10,0.45)';
      g.lineWidth = major ? 1.6 / Math.sqrt(this.cam.z) + 0.5 : 0.8;
      g.setLineDash(major ? [] : [3, 3]);
      g.stroke();
    }
    g.setLineDash([]);
    if (this.lens === 'war') this.drawFront(g, s);
    g.restore();
  }

  get lens(): LensId { return this.view.lens ?? 'faction'; }
  /** 钱粮图层每城的粮银月数：半秒内同一局面只算一次 */
  storesMemo: { s: GameState | null; t: number; m: Map<string, Stores> } = { s: null, t: -1e9, m: new Map() };
  /** 钱粮图层的取数：界面给出“排令之后”的预计局势（与城池账页、确认窗同一份），没有则用月初实况 */
  econSource: (() => GameState | null) | null = null;
  stores(s0: GameState, id: string): Stores {
    const s = this.econSource?.() ?? s0;
    const mm = this.storesMemo;
    if (mm.s !== s || this.lastTime - mm.t > 500) { mm.s = s; mm.t = this.lastTime; mm.m = new Map(); }
    let v = mm.m.get(id);
    if (!v) { v = cityStores(s, id); mm.m.set(id, v); }
    return v;
  }
  /** 本图层下某城疆域的底色与浓淡 */
  tint(s: GameState, id: string): [string, number] {
    const c = s.cities[id];
    if (this.lens === 'war') {
      const tone = relationTone(s, c.controller);
      return [TONE_COLOR[tone], tone === 'war' ? 0.4 : tone === 'self' ? 0.32 : tone === 'ally' ? 0.28 : tone === 'truce' ? 0.3 : 0.1];
    }
    if (this.lens === 'econ') {
      if (c.controller !== s.player) return ['#2a2118', 0.22];
      return [TIER_COLOR[storeTier(this.stores(s, id).worst)], 0.48];
    }
    return [s.factions[c.controller]?.color ?? '#999', 0.2];
  }
  /** 疆界内侧色带的颜色（钱粮图层只画本方） */
  bandColor(s: GameState, id: string, f: string): string | null {
    if (this.lens === 'war') return TONE_COLOR[relationTone(s, f)];
    if (this.lens === 'econ') return f === s.player ? TIER_COLOR[storeTier(this.stores(s, id).worst)] : null;
    return s.factions[f]?.color ?? '#999';
  }
  /** 敌我图层：我方阵营与交战之敌之间的前线，红色锯线并缓缓明灭 */
  drawFront(g: CanvasRenderingContext2D, s: GameState) {
    const z = this.cam.z, pulse = 0.65 + 0.35 * Math.sin(this.lastTime / 380);
    for (const e of this.edges) {
      if (!frontEdge(s, e.a, e.b)) continue;
      g.beginPath(); e.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = `rgba(208,55,42,${0.35 * pulse})`; g.lineWidth = 9 / Math.sqrt(z); g.stroke();
      g.strokeStyle = `rgba(255,120,90,${0.95 * pulse})`; g.lineWidth = 2.4 / Math.sqrt(z);
      g.setLineDash([7 / Math.sqrt(z), 4 / Math.sqrt(z)]); g.lineDashOffset = -this.lastTime / 60 / Math.sqrt(z); g.stroke();
      g.setLineDash([]); g.lineDashOffset = 0;
    }
  }
  /** 一支军队的粮道：沿实际运粮路线从粮台画到军中（金色流动虚线）；粮道断了，按地理最短路画到断点并标红叉 */
  supplyLine(g: CanvasRenderingContext2D, s: GameState, a: Army, time: number) {
    const z = this.cam.z;
    const leg = supplyRoute(s, a.faction, a.supply, a.location);
    const tail: Pt[] = a.progress > 0 && a.path.length ? [armyPt(a)] : [];
    let pts: Pt[], broken: Pt | null = null;
    if (!leg.reason) pts = [...roadPts(a.supply, leg.path), ...tail];
    else {
      const geo = shortestPath(a.supply, a.location, true) ?? shortestPath(a.supply, a.location, false) ?? [];
      const k = leg.at ? geo.indexOf(leg.at) : -1;
      pts = roadPts(a.supply, k >= 0 ? geo.slice(0, k + 1) : geo);
      broken = leg.at ? nodePt(leg.at) : pts[pts.length - 1];
    }
    if (pts.length < 2) return;
    g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.strokeStyle = 'rgba(30,20,10,0.55)'; g.lineWidth = 4 / z; g.stroke();
    g.strokeStyle = broken ? 'rgba(220,90,70,0.9)' : '#f0cf86'; g.lineWidth = 2 / z; g.setLineDash([6 / z, 5 / z]); g.lineDashOffset = -time / 40 / z; g.stroke();
    g.setLineDash([]); g.lineDashOffset = 0;
    if (broken) {
      const [bx, by] = broken, r = 7 / z;
      g.strokeStyle = '#e0503c'; g.lineWidth = 3 / z;
      g.beginPath(); g.moveTo(bx - r, by - r); g.lineTo(bx + r, by + r); g.moveTo(bx + r, by - r); g.lineTo(bx - r, by + r); g.stroke();
    }
  }
  /** 钱粮图层：本方各军到粮台的金色虚线（流动方向从粮台往军中） */
  drawSupply(g: CanvasRenderingContext2D, s: GameState, time: number) {
    const z = this.cam.z;
    for (const a of Object.values(s.armies)) {
      if (a.faction !== s.player || !a.supply || !s.cities[a.supply]) continue;
      const [dx, dy] = nodePt(a.supply);
      if (a.location === a.supply && !a.progress) continue;
      this.supplyLine(g, s, a, time);
      g.beginPath(); g.arc(dx, dy, 5 / z, 0, Math.PI * 2); g.fillStyle = '#f0cf86'; g.fill();
    }
  }
  /** 城名下的副行：敌我图层标各城驻军，钱粮图层标本方粮银月数，近看时标驻军 */
  subLine(s: GameState, id: string): SubPart[] | null {
    const c = s.cities[id], own = topOfSafe(s, c.controller) === s.player;
    const garrison = (col: string): SubPart[] => [{ t: `驻 ${own || c.controller === s.player ? fmtTroops(c.garrison) : roughT(c.garrison)}`, col }];
    if (this.lens === 'econ') {
      if (c.controller !== s.player) return null;
      const st = this.stores(s, id);
      return [{ t: `粮 ${monthsText(st.grainMonths)}`, col: TIER_COLOR[storeTier(st.grainMonths)] }, { t: `银 ${monthsText(st.silverMonths)}`, col: TIER_COLOR[storeTier(st.silverMonths)] }];
    }
    if (this.lens === 'war') {
      const tone = relationTone(s, c.controller);
      return garrison(tone === 'war' ? '#ff9a85' : tone === 'self' ? '#f6d98c' : tone === 'ally' ? '#a9c8ec' : '#d8ccb0');
    }
    return this.cam.z >= 2.6 ? garrison('#e8d9b4') : null;
  }

  drawWater(g: CanvasRenderingContext2D) {
    const z = this.cam.z;
    // 海岸
    g.strokeStyle = 'rgba(16,36,42,0.55)'; g.lineWidth = 0.8 / Math.sqrt(z);
    g.stroke(this.landPath);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // 湖
    for (const p of this.lakePaths) {
      g.fillStyle = '#4d8ea6'; g.fill(p);
      g.strokeStyle = 'rgba(190,220,214,0.55)'; g.lineWidth = 1.6; g.stroke(p);
      g.strokeStyle = 'rgba(20,45,50,0.6)'; g.lineWidth = 0.6; g.stroke(p);
    }
    // 河：上游细、下游粗，分段描
    const SEG = 5;
    for (const rv of this.riverPaths) {
      const n = rv.pts.length;
      for (let k = 0; k < SEG; k++) {
        const i0 = Math.floor(k * (n - 1) / SEG), i1 = Math.floor((k + 1) * (n - 1) / SEG);
        const w = rv.width * (0.35 + 0.65 * (k + 0.7) / SEG);
        g.beginPath();
        for (let i = i0; i <= i1; i++) { const [x, y] = rv.pts[i]; i === i0 ? g.moveTo(x, y) : g.lineTo(x, y); }
        g.strokeStyle = 'rgba(30,60,60,0.35)'; g.lineWidth = w * 0.95 + 0.9; g.stroke();
        g.strokeStyle = WATER; g.lineWidth = w * 0.95; g.stroke();
      }
      if (rv.width >= 1.6) {
        g.beginPath(); rv.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.setLineDash([5, 26]); g.lineDashOffset = -this.lastTime / 45;
        g.strokeStyle = 'rgba(210,238,245,0.5)'; g.lineWidth = rv.width * 0.3;
        g.stroke();
        g.setLineDash([]);
      }
    }
    g.setLineDash([3, 2]);
    g.strokeStyle = 'rgba(63,127,158,0.9)'; g.lineWidth = 1.1;
    for (const c of CANALS) { smoothPath(g, c.pts.map(([lo, la]) => P(lo, la))); g.stroke(); }
    g.setLineDash([]);
  }

  routeLabels: [number, number, string][] = [];
  monthMarks: [number, number, number][] = [];
  etaMarks: [number, number, number][] = [];
  drawRoutes(g: CanvasRenderingContext2D, s: GameState, time: number) {
    const z = this.cam.z;
    this.routeLabels = []; this.monthMarks = []; this.etaMarks = [];
    const sel = this.view.selected;
    if (z >= 1.9 || sel) {
      for (const r of ROUTES) {
        if (z < 1.9 && r.a !== sel && r.b !== sel) continue;
        const q = routeCurve(r);
        const hi = r.a === sel || r.b === sel;
        if (hi || r.kind !== 'land') {
          g.strokeStyle = r.kind === 'land' ? 'rgba(255,226,150,0.85)' : 'rgba(170,225,240,0.7)';
          g.lineWidth = (hi ? 2.6 : 1.3) / z;
          g.setLineDash(r.kind === 'land' ? [] : [6 / z, 5 / z]);
          g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[2], q[3], q[4], q[5]); g.stroke();
        }
        if (hi) {
          const mx = 0.25 * q[0] + 0.5 * q[2] + 0.25 * q[4], my = 0.25 * q[1] + 0.5 * q[3] + 0.25 * q[5];
          this.routeLabels.push([mx, my, `${r.days}日`]);
        }
      }
      g.setLineDash([]);
    }
    // 行军路线
    const dash = -(time / 60) % 12;
    const drawPath = (a: Army, path: string[], planned: boolean) => {
      if (!path.length) return;
      const mine = topOfSafe(s, a.faction) === s.player;
      const col = planned ? 'rgba(181,52,42,0.95)' : mine ? 'rgba(181,52,42,0.75)' : 'rgba(30,25,20,0.6)';
      const zz = this.cam.z;
      // 每一段沿驿路弧线画（与路网同一条曲线），第一段从军队所在处截起；每段的天数用来找“每月走到哪里”
      const segs: { q: number[]; days: number }[] = [];
      let prev = a.location;
      path.forEach((p, i) => {
        const r = routeBetween(prev, p);
        const full = legCurve(prev, p) ?? [...nodePt(prev), ...nodePt(prev), ...nodePt(p)];
        const t0 = i === 0 && a.progress > 0 ? legFrac(a) : 0;
        segs.push({ q: t0 ? subQuad(full, t0, 1) : full, days: Math.max(0, (r?.days ?? 1) - (i === 0 ? a.progress : 0)) });
        prev = p;
      });
      const locate = (d: number): [number, number] | null => {
        let acc = 0;
        for (let i = 0; i < segs.length; i++) { if (acc + segs[i].days >= d) return [i, Math.max(0, Math.min(1, (d - acc) / Math.max(1, segs[i].days)))]; acc += segs[i].days; }
        return null;
      };
      const at = (d: number): Pt | null => { const l = locate(d); return l ? quadAt(segs[l[0]].q, l[1]) : null; };
      const curve = (q: number[], first: boolean) => { if (first) g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[2], q[3], q[4], q[5]); };
      const total = segs.reduce((m, x) => m + x.days, 0);
      g.strokeStyle = col;
      g.lineWidth = (planned ? 3.4 : 2.4) / zz;
      if (mine || planned) {
        // 本月可达：实线；以后：虚线
        const cut = total > 30 ? locate(30) : null;
        g.beginPath();
        segs.forEach((sg, i) => { if (cut && i > cut[0]) return; curve(cut && i === cut[0] ? subQuad(sg.q, 0, cut[1]) : sg.q, i === 0); });
        g.stroke();
        if (cut) {
          g.setLineDash([9 / zz, 6 / zz]); g.lineDashOffset = dash / zz;
          g.beginPath();
          segs.forEach((sg, i) => { if (i < cut[0]) return; curve(i === cut[0] ? subQuad(sg.q, cut[1], 1) : sg.q, i === cut[0]); });
          g.stroke(); g.setLineDash([]);
        }
        for (let m = 1; m * 30 < total; m++) { const p = at(m * 30); if (p) this.monthMarks.push([p[0], p[1], m]); }
        const end = segs[segs.length - 1].q;
        this.etaMarks.push([end[4], end[5], total]);
      } else {
        g.setLineDash([9 / zz, 6 / zz]); g.lineDashOffset = dash / zz;
        g.beginPath(); segs.forEach((sg, i) => curve(sg.q, i === 0)); g.stroke();
        g.setLineDash([]);
      }
      const q = segs[segs.length - 1].q;
      arrowHead(g, q[2], q[3], q[4], q[5], col, 13 / zz);
    };
    for (const a of Object.values(s.armies)) if (a.path.length && (visibleArmy(s, a))) drawPath(a, a.path, false);
    for (const p of this.view.planned) { const a = s.armies[p.army]; if (a) drawPath(a, p.path, true); }
    if (this.view.targeting?.path) { const a = s.armies[this.view.targeting.army]; if (a) drawPath(a, this.view.targeting.path, true); }
  }

  /* ================= 屏幕层：城池、军队、名字按“有空位才画全”的原则摆放 =================
   * 城池标志与城名用固定的屏幕大小，不随缩放一起变大；放大后城与城自然拉开。
   * 每帧按重要性依次摆放：放得下就画完整城郭与城名，放不下退成小城郭，再放不下只画一个势力色圆点。
   * 同城的军队合成一面军旗，旗上注明支数。 */
  /** 云影：缓缓掠过 */
  drawCloudShadows(g: CanvasRenderingContext2D, time: number) {
    for (let k = 0; k < 5; k++) {
      const x = ((time / 90 + k * 520) % (WORLD_W + 600)) - 300, y = 180 + k * 290 + Math.sin(time / 20000 + k) * 40;
      const gr = g.createRadialGradient(x, y, 20, x, y, 220);
      gr.addColorStop(0, 'rgba(20,30,40,0.10)'); gr.addColorStop(1, 'rgba(20,30,40,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 260, 130, 0, 0, Math.PI * 2); g.fill();
    }
  }
  /** 选中城池或军队时的“相关之处”：本城、相邻各城、军队所在与去向。其余淡化。 */
  focusSet(s: GameState): Set<string> | null {
    const sel = this.view.selected, sa = this.view.selectedArmy ? s.armies[this.view.selectedArmy] : null;
    if (!sel && !sa) return null;
    const out = new Set<string>();
    const add = (id: string) => { out.add(id); for (const n of neighbors(id)) out.add(n.to); };
    if (sel) add(sel);
    if (sa) { add(sa.location); for (const p of sa.path) out.add(p); }
    if (this.view.targeting?.path) for (const p of this.view.targeting.path) out.add(p);
    return out;
  }
  knownArmy(s: GameState, a: Army) { const t = topOfSafe(s, a.faction); return t === s.player || a.faction === s.player; }

  layout: Map<string, NodeSlot> = new Map();
  stacks: ArmyStack[] = [];
  /** 各城上一帧相对原处的挪位（以城郭宽为单位），下一帧先试它，免得布局来回跳 */
  slotOffset = new Map<string, { x: number; y: number }>();
  /** 每支军队上一帧画在何处（世界坐标）：下一段动画从这里接着走 */
  shown: Record<string, Pt> = {};

  nodePriority(s: GameState, id: string, focus: Set<string> | null): number {
    const n = NODE[id], c = s.cities[id];
    // 悬停只高亮、不改摆放（否则城郭挪开、指针落空、又挪回来，来回跳动）；选中的城先摆
    if (this.view.selected === id) return 0;
    if (this.view.targeting?.path?.includes(id)) return 1;
    const cap = c && s.factions[c.controller]?.capital === id && c.controller !== 'local';
    let p = cap ? 2 : s.sieges[id] ? 2.5 : n.major ? 3 : n.kind === 'city' ? 5 : n.kind === 'region' ? 4.5 : n.kind === 'port' ? 6 : 7;
    if (focus?.has(id)) p -= 1.5;
    if (c && topOfSafe(s, c.controller) === s.player && p > 3) p -= 0.5;
    return p - Math.min(0.4, (c?.pop ?? 0) / 400);
  }

  computeLayout(s: GameState) {
    const z = this.cam.z;
    const focus = this.focusSet(s);
    const zk = Math.max(0.78, Math.min(1.25, 0.8 + (z - 1) * 0.16));
    const placed: Rect[] = [];
    const hit = (r: Rect) => placed.some(q => q[0] < r[0] + r[2] && r[0] < q[0] + q[2] && q[1] < r[1] + r[3] && r[1] < q[1] + q[3]);
    const out = new Map<string, NodeSlot>();
    const ids = NODES.filter(n => n.kind !== 'outland' && s.cities[n.id]).map(n => n.id);
    const prio = new Map(ids.map(id => [id, this.nodePriority(s, id, focus)]));
    ids.sort((a, b) => prio.get(a)! - prio.get(b)!);
    // 都城、要城先摆；再让军旗占位（固定在城的右上方）；其余城池在空处摆放
    this.buildStacks(s);
    const g = this.ctx;
    let stacksPlaced = false;
    for (const id of ids) {
      if (!stacksPlaced && prio.get(id)! > 3) { stacksPlaced = true; for (const st of this.stacks) placed.push([st.sx - 13, st.sy - 26, 26, 42]); }
      const [wx, wy] = nodePt(id);
      const [sx, sy] = worldToScreen(this.cam, this.w, this.h, wx, wy);
      if (sx < -80 || sy < -80 || sx > this.w + 80 || sy > this.h + 120) continue;
      const n = NODE[id], type = emblemTypeOf(s, id);
      const pr = prio.get(id)!;
      const must = pr <= 1;
      const big = n.major || type === 'capital';
      const fsize = big ? 14 : 12.5;
      g.font = `${big ? 700 : 500} ${fsize}px "Noto Serif SC", serif`;
      const sub = this.subLine(s, id);
      const nameW = g.measureText(n.name).width + 14;
      let lw = nameW;
      if (sub) { g.font = '600 10.5px "Noto Serif SC", serif'; lw = Math.max(lw, sub.reduce((m, p) => m + g.measureText(p.t).width + 10, 4)); }
      const lh = fsize + 7 + (sub ? 15 : 0);
      let slot: NodeSlot | null = null;
      // 原处摆不下：本方之城、被围、选中、都城，或放大到两倍以上时，挪到旁边空处摆出城郭，牵线回原处（不再缩成被盖住的小点）
      const c0 = s.cities[id];
      const movable = must || (!!c0 && topOfSafe(s, c0.controller) === s.player) || !!s.sieges[id] || type === 'capital' || z >= 2;
      tiers: for (const tier of ['full', 'small'] as const) {
        const w = EMBLEM_PX[type] * zk * (tier === 'small' ? 0.62 : 1) * Math.max(0.72, Math.min(1.25, depthAt(this.h, sy)));
        // 先试上一帧的位置（平移缩放时不无故换位），再试原处与旁边各处
        const prev = this.slotOffset.get(id);
        const home = { x: 0, y: 0 };
        const anchors = [...(prev && movable ? [{ x: prev.x * w, y: prev.y * w }] : []), home, ...(movable ? calloutOffsets(w) : []), ...(must ? [home] : [])];
        for (const o of anchors) {
          const ex = sx + o.x, ey = sy + o.y;
          if (o.x || o.y) { if (ex < 20 || ex > this.w - 20 || ey < 60 || ey > this.h - 20) continue; }
          const em: Rect = [ex - w * 0.42, ey - w * 0.85, w * 0.84, w * 0.95];
          // 城名：先放在城下，放不下试右、左
          const cands: Rect[] = [[ex - lw / 2, ey + w * 0.12, lw, lh], [ex + w * 0.42 + 2, ey - w * 0.4 - lh / 2, lw, lh], [ex - w * 0.42 - 2 - lw, ey - w * 0.4 - lh / 2, lw, lh]];
          // 选中之城：旁边各处都摆不下时才压在原处
          const last = o === anchors[anchors.length - 1];
          if (hit(em) && !(must && last)) continue;
          const lab = cands.find(r => !hit(r)) ?? (must || pr <= 2.5 ? cands[0] : null);
          if (!lab && (tier === 'full' || o.x || o.y) && !(must && last)) continue;
          placed.push(em);
          if (lab) placed.push(lab);
          slot = { id, sx: ex, sy: ey, w, tier, label: lab, fsize, big, sub, ...(o.x || o.y ? { ax: sx, ay: sy } : {}) };
          this.slotOffset.set(id, { x: o.x / w, y: o.y / w });
          break tiers;
        }
      }
      if (!slot) {
        const dot: Rect = [sx - 5, sy - 5, 10, 10];
        // 小点也尽量带名字（放大时）
        const lab: Rect = [sx - nameW / 2, sy + 6, nameW, fsize + 7];
        const showName = z >= 2.2 && !hit(lab);
        placed.push(dot);
        if (showName) placed.push(lab);
        slot = { id, sx, sy, w: 9, tier: 'dot', label: showName ? lab : null, fsize: 11.5, big: false, sub: null };
      }
      out.set(id, slot);
    }
    this.layout = out;
  }

  buildStacks(s: GameState) {
    const groups = new Map<string, Army[]>();
    for (const a of Object.values(s.armies)) {
      const key = a.progress > 0 && a.path.length ? 'm:' + a.id : 'n:' + a.location;
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(a);
    }
    const out: ArmyStack[] = [];
    const anim = this.view.anim;
    const raw = anim ? Math.max(0, Math.min(1, (this.lastTime - anim.t0) / anim.dur)) : 1;
    const k = anim ? easeInOut(raw) : 1;
    if (anim && raw >= 1 && !anim.hold) this.view.anim = null;
    for (const [key, list] of groups) {
      // 同城：本方在前，兵多在前
      list.sort((a, b) => Number(topOfSafe(s, b.faction) === s.player) - Number(topOfSafe(s, a.faction) === s.player) || b.troops - a.troops || a.id.localeCompare(b.id));
      // 同城而敌对的军队分成两面旗
      const sides: Army[][] = [];
      for (const a of list) { const side = sides.find(x => topOfSafe(s, x[0].faction) === topOfSafe(s, a.faction)); if (side) side.push(a); else sides.push([a]); }
      sides.forEach((arm, i) => {
        let [wx, wy] = armyPt(arm[0]);
        let march: [number, number] | undefined;
        const poly = anim?.paths?.[arm[0].id];
        if (anim && poly && poly.length > 1) {
          // 沿驿路逐站而行（不是直线滑过去）
          const [p, d] = along(poly, k);
          [wx, wy] = p;
          if (raw < 1) march = d;
        } else if (anim && k < 1) { const f = anim.from[arm[0].id]; if (f) { if (Math.hypot(wx - f[0], wy - f[1]) > 2) march = [wx - f[0], wy - f[1]]; wx = f[0] + (wx - f[0]) * k; wy = f[1] + (wy - f[1]) * k; } }
        for (const a of arm) this.shown[a.id] = [wx, wy];
        const [sx, sy] = worldToScreen(this.cam, this.w, this.h, wx, wy);
        const moving = key.startsWith('m:') || !!march || !!(poly && anim?.hold);
        const ox = moving ? 0 : 20 + i * 26, oy = moving ? -4 : -24;
        out.push({ armies: arm.map(a => a.id), sx: sx + ox, sy: sy + oy, ax: sx, ay: sy, moving, march });
      });
    }
    // 靠得太近的军旗互相让开（各留一根牵引线回到原处），免得后面的被挡住点不着
    const sp = spreadApart(out.map(o => ({ x: o.sx, y: o.sy })), 26);
    out.forEach((o, i) => { o.sx = sp[i].x; o.sy = sp[i].y; });
    this.stacks = out;
  }
  /** 悬停在同处多军的旗上：展开成一行，各军分开可点；指针移出展开区才收起 */
  expand: string | null = null;
  hoverAt(sx: number, sy: number) {
    const cur = this.stacks.find(st => st.armies[0] === this.expand);
    if (cur) {
      const f = fanSlots(cur.armies.length, cur.sx, cur.sy);
      if (sx > f[0].x - 18 && sx < f[f.length - 1].x + 18 && sy > f[0].y - 20 && sy < cur.sy + 16) return;
    }
    const hit = this.stacks.find(st => st.armies.length > 1 && Math.hypot(sx - st.sx, sy - st.sy) < 15);
    this.expand = hit ? hit.armies[0] : null;
  }

  drawScreen(g: CanvasRenderingContext2D, s: GameState, time: number) {
    this.computeLayout(s);
    const focus = this.focusSet(s);
    const z = this.cam.z;
    const slots = [...this.layout.values()].sort((a, b) => a.sy - b.sy);
    // 被围之城：红光与刺圈（在城下）
    for (const sg of Object.values(s.sieges)) {
      const sl = this.layout.get(sg.node); if (!sl) continue;
      const r = Math.max(16, sl.w * 0.55), pulse = 0.5 + 0.5 * Math.sin(time / 300);
      g.save(); g.translate(sl.sx, sl.sy - sl.w * 0.25);
      const grd = g.createRadialGradient(0, 0, r * 0.3, 0, 0, r + 12);
      grd.addColorStop(0, 'rgba(224,80,63,0)'); grd.addColorStop(0.7, `rgba(224,80,63,${0.2 + pulse * 0.25})`); grd.addColorStop(1, 'rgba(224,80,63,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r + 12, 0, Math.PI * 2); g.fill();
      g.rotate(time / 5000);
      g.strokeStyle = s.factions[sg.attacker]?.color ?? '#333'; g.lineWidth = 2.4;
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.6); g.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6) * 0.6); g.stroke(); }
      g.restore();
    }
    // 城池
    for (const sl of slots) {
      const c = s.cities[sl.id], n = NODE[sl.id];
      const f = s.factions[c.controller];
      const col = f?.color ?? '#999';
      const mine = topOfSafe(s, c.controller) === s.player;
      const isSel = this.view.selected === sl.id, isHover = this.view.hover === sl.id;
      const dim = (!!focus && !focus.has(sl.id) && !isHover) || (this.lens === 'econ' && c.controller !== s.player && !isSel && !isHover);
      g.save();
      if (dim) g.globalAlpha = 0.45;
      if (sl.tier === 'dot') {
        g.beginPath(); g.arc(sl.sx, sl.sy, 4.5, 0, Math.PI * 2);
        g.fillStyle = col; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = mine ? '#f0cf86' : 'rgba(255,245,220,0.85)'; g.stroke();
        if (isSel || isHover) { g.strokeStyle = 'rgba(255,214,120,0.95)'; g.lineWidth = 2; g.beginPath(); g.arc(sl.sx, sl.sy, 8 + (isSel ? Math.sin(time / 260) * 1.5 : 0), 0, Math.PI * 2); g.stroke(); }
      } else {
        const w = sl.w, type = emblemTypeOf(s, sl.id);
        // 挪到旁边的城郭：一根牵引线连回真实位置，原处一枚小圆点
        if (sl.ax !== undefined && sl.ay !== undefined) {
          g.strokeStyle = 'rgba(20,14,8,0.7)'; g.lineWidth = 1.2; g.setLineDash([3, 2]);
          g.beginPath(); g.moveTo(sl.ax, sl.ay); g.lineTo(sl.sx, sl.sy); g.stroke(); g.setLineDash([]);
          g.beginPath(); g.arc(sl.ax, sl.ay, 3.5, 0, Math.PI * 2); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = mine ? '#f0cf86' : 'rgba(255,245,220,0.85)'; g.stroke();
        }
        // 投影：日在左上，影落右下（显出城郭的高）
        const sh = g.createRadialGradient(sl.sx + w * 0.22, sl.sy + w * 0.02, 0, sl.sx + w * 0.22, sl.sy + w * 0.02, w * 0.62);
        sh.addColorStop(0, 'rgba(10,6,2,0.38)'); sh.addColorStop(1, 'rgba(10,6,2,0)');
        g.save(); g.translate(sl.sx + w * 0.22, sl.sy + w * 0.02); g.scale(1, 0.3); g.translate(-(sl.sx + w * 0.22), -(sl.sy + w * 0.02));
        g.fillStyle = sh; g.beginPath(); g.arc(sl.sx + w * 0.22, sl.sy + w * 0.02, w * 0.62, 0, Math.PI * 2); g.fill(); g.restore();
        // 落地色盘
        g.beginPath(); g.ellipse(sl.sx, sl.sy, w * 0.5, w * 0.16, 0, 0, Math.PI * 2);
        g.fillStyle = col; g.globalAlpha *= 0.9; g.fill(); g.globalAlpha = dim ? 0.45 : 1;
        g.lineWidth = mine ? 1.8 : 1; g.strokeStyle = mine ? '#f0cf86' : 'rgba(30,20,10,0.75)'; g.stroke();
        if (isSel || isHover) {
          const pulse = isSel ? 2 + Math.sin(time / 260) * 2 : 0;
          g.strokeStyle = isSel ? 'rgba(255,214,120,0.95)' : 'rgba(255,240,200,0.7)'; g.lineWidth = 2;
          g.beginPath(); g.ellipse(sl.sx, sl.sy, w * 0.6 + pulse, w * 0.21 + pulse * 0.4, 0, 0, Math.PI * 2); g.stroke();
        }
        const top = sl.sy - w * 0.92;
        g.drawImage(emblem(type), sl.sx - w / 2, top, w, w);
        if (sl.tier === 'full' && (z >= 1.3 || n.major || type === 'capital')) {
          const pol = POLITIES[f?.polity ?? 'none'];
          const [ax, ay] = flagAnchor(type);
          drawWavingFlag(g, sl.sx - w / 2 + ax * w / 100, top + ay * w / 100, col, pol?.mark ?? '', time / 1000 + sl.sx * 0.01, pol?.flag ?? 'rect', w / 52);
        }
        if (c.uncertain && sl.tier === 'full') {
          const bx = sl.sx + w * 0.4, by = top + w * 0.5;
          g.beginPath(); g.arc(bx, by, 5.5, 0, Math.PI * 2);
          g.fillStyle = '#efe2c6'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = '#5a3a1a'; g.stroke();
          g.fillStyle = '#5a3a1a'; g.font = '700 8px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', bx, by + 0.5);
        }
        if (z >= 2.4 && sl.tier === 'full' && type !== 'ferry') {
          const r = w * 0.55;
          g.strokeStyle = 'rgba(0,0,0,0.45)'; g.lineWidth = 2.4;
          g.beginPath(); g.ellipse(sl.sx, sl.sy, r, r * 0.32, 0, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = c.wall > 60 ? '#9fd18f' : c.wall > 30 ? '#e8a447' : '#e0503f';
          g.beginPath(); g.ellipse(sl.sx, sl.sy, r, r * 0.32, 0, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * c.wall / 100); g.stroke();
        }
      }
      g.restore();
    }
    // 烽烟与“围”字章
    for (const sg of Object.values(s.sieges)) {
      const sl = this.layout.get(sg.node); if (!sl) continue;
      const x = sl.sx, y = sl.sy - sl.w * 0.5;
      for (let k = 0; k < 7; k++) {
        const p = ((time / 2600 + k / 7) % 1);
        g.fillStyle = `rgba(60,55,50,${0.45 * (1 - p)})`;
        g.beginPath(); g.arc(x - 4 + Math.sin(k * 2.1 + p * 3) * 4 + p * 10, y - 6 - p * 34, 3 + p * 7, 0, Math.PI * 2); g.fill();
      }
      const fl = 0.6 + 0.4 * Math.sin(time / 90);
      const gr = g.createRadialGradient(x - 3, y, 0, x - 3, y, 9);
      gr.addColorStop(0, `rgba(255,200,90,${0.9 * fl})`); gr.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x - 3, y, 9, 0, Math.PI * 2); g.fill();
      g.save(); g.translate(sl.sx - Math.max(14, sl.w * 0.5), sl.sy - Math.max(18, sl.w * 0.8)); g.rotate(-0.12);
      roundRect(g, -9, -9, 18, 18, 3); g.fillStyle = '#c8352a'; g.fill(); g.strokeStyle = '#f0cf86'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#fff3d9'; g.font = '700 12px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('围', 0, 0.5);
      g.restore();
    }
    if (this.view.beacon) {
      const sl = this.layout.get(this.view.beacon);
      if (sl) for (let k = 0; k < 3; k++) {
        const p = ((time / 1400) + k / 3) % 1;
        g.strokeStyle = `rgba(255,214,120,${0.9 * (1 - p)})`; g.lineWidth = 3 * (1 - p) + 1;
        g.beginPath(); g.ellipse(sl.sx, sl.sy - sl.w * 0.2, 14 + p * 46, (14 + p * 46) * 0.55, 0, 0, Math.PI * 2); g.stroke();
      }
    }
    this.drawStacks(g, s, focus);
    this.drawNames(g, s, focus);
    this.drawFx(g, s, time);
  }

  drawStacks(g: CanvasRenderingContext2D, s: GameState, focus: Set<string> | null) {
    this.armyHits = [];
    // 选中的、展开的画在最上层
    const top = (st: ArmyStack) => (st.armies[0] === this.expand ? 2 : 0) + (st.armies.includes(this.view.selectedArmy ?? '') ? 1 : 0);
    const order = [...this.stacks].sort((a, b) => top(a) - top(b));
    for (const st of order) {
      const a = s.armies[st.armies[0]];
      const f = s.factions[a.faction];
      const pol = POLITIES[f?.polity ?? 'none'];
      const mark = (s.chars[a.commander]?.name ?? f?.short ?? '?').slice(0, 1);
      const sel = st.armies.includes(this.view.selectedArmy ?? '');
      const mine = topOfSafe(s, a.faction) === s.player;
      const total = st.armies.reduce((n, id) => n + s.armies[id].troops, 0);
      g.save();
      if (focus && !sel && !focus.has(a.location) && !a.path.some(p => focus.has(p))) g.globalAlpha = 0.4;
      if (this.lens === 'econ' && !sel && a.faction !== s.player) g.globalAlpha = 0.3;
      // 牵引线：旗到城
      if (!st.moving || Math.hypot(st.sx - st.ax, st.sy - st.ay) > 8) { g.strokeStyle = 'rgba(20,14,8,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(st.ax, st.ay - 4); g.lineTo(st.sx - 4, st.sy + 6); g.stroke(); }
      if (st.march) this.drawColumn(g, st, f?.color ?? '#888', s.armies[st.armies[0]]);
      g.translate(st.sx, st.sy);
      if (st.moving) g.translate(0, Math.sin(this.lastTime / 180 + st.sx) * 1.2);
      const dk = Math.max(0.78, Math.min(1.2, depthAt(this.h, st.sy)));
      g.scale(dk, dk);
      // 落地之影
      g.fillStyle = 'rgba(10,6,2,0.3)'; g.beginPath(); g.ellipse(5, 13, 12, 3.6, 0, 0, Math.PI * 2); g.fill();
      if (sel) { g.fillStyle = 'rgba(255,214,120,0.5)'; g.beginPath(); g.arc(0, 0, 16, 0, Math.PI * 2); g.fill(); }
      // 叠放的后几面
      for (let k = Math.min(2, st.armies.length - 1); k >= 1; k--) {
        g.beginPath(); g.arc(k * 3, -k * 3, 11, 0, Math.PI * 2);
        g.fillStyle = s.factions[s.armies[st.armies[k]].faction]?.color ?? '#888'; g.fill();
        g.lineWidth = 1.5; g.strokeStyle = 'rgba(232,217,180,0.8)'; g.stroke();
      }
      g.strokeStyle = '#1b130c'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(7, -4); g.lineTo(7, -20); g.stroke();
      drawFlag(g, 7, -20, pol?.flag ?? 'rect', '#f3e9d2', pol?.mark ?? '', 0.7, '#1b130c');
      g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
      g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2);
      g.fillStyle = f?.color ?? '#888'; g.fill();
      g.shadowColor = 'transparent';
      g.lineWidth = 2; g.strokeStyle = mine ? '#f0cf86' : '#e8d9b4'; g.stroke();
      g.fillStyle = '#fff8e6'; g.font = '700 12.5px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(mark, 0, 0.5);
      const t = (this.knownArmy(s, a) ? fmtTroops(total) : roughT(total)) + (st.armies.length > 1 ? ` ·${st.armies.length}` : '');
      g.font = '700 9px "Noto Serif SC", serif';
      const tw = g.measureText(t).width + 8;
      roundRect(g, -tw / 2, 12, tw, 11, 3);
      g.fillStyle = 'rgba(15,10,6,0.88)'; g.fill();
      g.fillStyle = a.morale > 50 ? '#f0cf86' : a.morale > 25 ? '#e8a447' : '#ff8f7f';
      g.fillText(t, 0, 18);
      g.restore();
      // 命中区用屏幕坐标：旗盘一枚；展开时每支军队各一枚
      this.armyHits.push({ id: st.armies[0], x: st.sx, y: st.sy, r: 14, stack: st.armies });
      if (st.armies[0] === this.expand && st.armies.length > 1) this.drawFan(g, s, st);
    }
  }

  /** 同处多军展开：一行小旗盘，各写主将姓、兵数，各自可点 */
  drawFan(g: CanvasRenderingContext2D, s: GameState, st: ArmyStack) {
    const slots = fanSlots(st.armies.length, st.sx, st.sy);
    g.save();
    roundRect(g, slots[0].x - 17, slots[0].y - 16, slots[slots.length - 1].x - slots[0].x + 34, 44, 10);
    g.fillStyle = 'rgba(15,10,6,0.82)'; g.fill(); g.strokeStyle = 'rgba(217,173,91,0.6)'; g.lineWidth = 1; g.stroke();
    st.armies.forEach((id, k) => {
      const a = s.armies[id], f = s.factions[a.faction], { x, y } = slots[k];
      const sel = this.view.selectedArmy === id;
      if (sel) { g.fillStyle = 'rgba(255,214,120,0.55)'; g.beginPath(); g.arc(x, y, 14, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fillStyle = f?.color ?? '#888'; g.fill();
      g.lineWidth = 1.6; g.strokeStyle = topOfSafe(s, a.faction) === s.player ? '#f0cf86' : '#e8d9b4'; g.stroke();
      g.fillStyle = '#fff8e6'; g.font = '700 12px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText((s.chars[a.commander]?.name ?? f?.short ?? '?').slice(0, 1), x, y + 0.5);
      g.font = '700 9px "Noto Serif SC", serif'; g.fillStyle = '#f0cf86';
      g.fillText(this.knownArmy(s, a) ? fmtTroops(a.troops) : roughT(a.troops), x, y + 19);
      this.armyHits.push({ id, x, y, r: 13, stack: st.armies });
    });
    g.restore();
  }

  /** 行军纵队：旗后一队兵卒（骑兵多则画马），踏起尘土 */
  drawColumn(g: CanvasRenderingContext2D, st: ArmyStack, color: string, a: Army) {
    const len = Math.hypot(st.march![0], st.march![1]) || 1;
    const ux = st.march![0] / len, uy = st.march![1] / len;
    const n = Math.max(4, Math.min(9, Math.round(Math.sqrt(a.troops) / 22)));
    const cav = a.mix.cav >= 0.35, t = this.lastTime;
    g.save();
    // 水师：画船影与尾波，不画步卒扬尘（2026-11-28 复核）
    if (a.mix.navy >= 0.3) {
      const m = Math.max(2, Math.min(5, Math.round(n / 2)));
      for (let k = m; k >= 1; k--) {
        const back = 10 + k * 11;
        const x = st.ax - ux * back + (k % 2 ? -uy : uy) * 4, y = st.ay - uy * back + (k % 2 ? ux : -ux) * 4;
        const bob = Math.sin(t / 260 + k) * 0.8;
        // 尾波：船后两道渐散的白线
        const wp = ((t / 900) + k * 0.23) % 1;
        g.strokeStyle = `rgba(235,240,245,${0.5 * (1 - wp)})`; g.lineWidth = 1;
        for (const side of [-1, 1]) { g.beginPath(); g.moveTo(x - ux * 5, y - uy * 5); g.lineTo(x - ux * (9 + wp * 10) + side * -uy * (2 + wp * 5), y - uy * (9 + wp * 10) + side * ux * (2 + wp * 5)); g.stroke(); }
        // 船身与帆
        g.save(); g.translate(x, y + bob); g.rotate(Math.atan2(uy, ux));
        g.fillStyle = '#4a3220'; g.beginPath(); g.moveTo(-7, -2); g.lineTo(6, -2); g.lineTo(8, 0); g.lineTo(6, 2); g.lineTo(-7, 2); g.closePath(); g.fill();
        g.restore();
        g.fillStyle = color; g.beginPath(); g.moveTo(x, y - 2 + bob); g.lineTo(x, y - 11 + bob); g.lineTo(x + 5, y - 4 + bob); g.closePath(); g.fill();
      }
      g.restore();
      return;
    }
    for (let k = n; k >= 1; k--) {
      const back = 9 + k * (cav ? 8 : 6);
      const x = st.ax - ux * back + (k % 2 ? -uy : uy) * 3, y = st.ay - uy * back - 2 + (k % 2 ? ux : -ux) * 3;
      // 尘
      const dp = ((t / 600) + k * 0.17) % 1;
      g.fillStyle = `rgba(190,165,120,${0.28 * (1 - dp)})`;
      g.beginPath(); g.arc(x - ux * (4 + dp * 10), y + 3 - dp * 6, 2.5 + dp * 5, 0, Math.PI * 2); g.fill();
      const bob = Math.abs(Math.sin(t / (cav ? 70 : 110) + k)) * 1.6;
      if (cav && k % 2 === 0) {
        g.fillStyle = '#5a3b22'; g.beginPath(); g.ellipse(x, y - 2 - bob, 4.5, 2.4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = color; g.fillRect(x - 1.5, y - 8 - bob, 3, 4);
      } else {
        g.fillStyle = color; g.fillRect(x - 1.6, y - 7 - bob, 3.2, 5);
        g.fillStyle = '#e8c49a'; g.beginPath(); g.arc(x, y - 8.5 - bob, 1.6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = 'rgba(40,28,16,0.9)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x + 2, y - 2 - bob); g.lineTo(x + 2, y - 13 - bob); g.stroke();
      }
    }
    g.restore();
  }

  drawNames(g: CanvasRenderingContext2D, s: GameState, _focus: Set<string> | null) {
    const z = this.cam.z;
    g.save();
    g.textBaseline = 'middle';
    // 远看：势力大字
    if (z < 1.35) {
      const groups: Record<string, Pt[]> = {};
      for (const c of Object.values(s.cities)) { if (c.controller === 'local') continue; (groups[c.controller] ??= []).push(nodePt(c.id)); }
      for (const [f, pts] of Object.entries(groups)) {
        const fac = s.factions[f];
        if (!fac || pts.length < 3) continue;
        const cx = pts.reduce((n, p) => n + p[0], 0) / pts.length, cy = pts.reduce((n, p) => n + p[1], 0) / pts.length;
        const [sx, sy] = worldToScreen(this.cam, this.w, this.h, cx, cy);
        g.font = `600 ${Math.round(16 + Math.min(16, pts.length * 0.6))}px "Ma Shan Zheng", "Noto Serif SC", serif`;
        g.textAlign = 'center';
        g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = 'rgba(20,12,6,0.55)';
        g.strokeText(fac.name, sx, sy + 26);
        g.fillStyle = 'rgba(255,240,210,0.72)';
        g.fillText(fac.name, sx, sy + 26);
      }
    }
    if (z >= 0.9) {
      g.font = `italic 500 ${Math.round(11 + Math.min(4, z * 1.2))}px "Noto Serif SC", serif`;
      g.textAlign = 'center'; g.lineWidth = 3; g.lineJoin = 'round';
      for (const r of RIVERS) if (r.label) {
        const [sx, sy] = worldToScreen(this.cam, this.w, this.h, ...P(r.label[0], r.label[1]));
        g.strokeStyle = 'rgba(14,34,44,0.6)'; g.strokeText(r.name, sx, sy);
        g.fillStyle = '#cfe9f2'; g.fillText(r.name, sx, sy);
      }
    }
    // 行军：每月走到哪里（圆章写“一月”“二月”），终点写总日程
    g.textAlign = 'center';
    for (const [wx, wy, m] of this.monthMarks) {
      const [sx, sy] = worldToScreen(this.cam, this.w, this.h, wx, wy);
      g.beginPath(); g.arc(sx, sy, 10, 0, Math.PI * 2); g.fillStyle = '#7d1a12'; g.fill(); g.strokeStyle = '#f0cf86'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#fff3d9'; g.font = '700 10px "Noto Serif SC", serif'; g.fillText(`${m}月`, sx, sy + 0.5);
    }
    for (const [wx, wy, d] of this.etaMarks) {
      const [sx, sy] = worldToScreen(this.cam, this.w, this.h, wx, wy);
      const t = `${d} 日${d > 30 ? ` · 约 ${Math.ceil(d / 30)} 月` : ''}`;
      g.font = '700 11px "Noto Serif SC", serif';
      const tw = g.measureText(t).width + 12;
      g.fillStyle = 'rgba(125,26,18,0.92)'; roundRect(g, sx - tw / 2, sy - 34, tw, 17, 8); g.fill();
      g.strokeStyle = '#f0cf86'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#fff3d9'; g.fillText(t, sx, sy - 25);
    }
    // 选中城的路程（几日）
    g.font = '700 11px "Noto Serif SC", serif'; g.textAlign = 'center';
    for (const [wx, wy, t] of this.routeLabels) {
      const [sx, sy] = worldToScreen(this.cam, this.w, this.h, wx, wy);
      const tw = g.measureText(t).width + 10;
      g.fillStyle = 'rgba(70,48,20,0.92)'; roundRect(g, sx - tw / 2, sy - 8, tw, 16, 8); g.fill();
      g.strokeStyle = 'rgba(240,207,134,0.8)'; g.lineWidth = 1; g.stroke();
      g.fillStyle = '#fbe9bf'; g.fillText(t, sx, sy + 0.5);
    }
    g.textAlign = 'left';
    for (const sl of this.layout.values()) {
      if (!sl.label) continue;
      const n = NODE[sl.id], c = s.cities[sl.id];
      const [lx, ly, lw, lh] = sl.label;
      const dim = (!!_focus && !_focus.has(sl.id) && this.view.hover !== sl.id) || (this.lens === 'econ' && c.controller !== s.player && this.view.hover !== sl.id);
      g.globalAlpha = dim ? 0.55 : 1;
      g.font = `${sl.big ? 700 : 500} ${sl.fsize}px "Noto Serif SC", serif`;
      g.fillStyle = sl.big ? 'rgba(20,13,8,0.88)' : 'rgba(20,13,8,0.74)';
      const lh0 = sl.sub ? lh - 15 : lh;
      const nw = g.measureText(n.name).width + 14;
      roundRect(g, lx, ly, sl.sub ? nw : lw, lh0, 4); g.fill();
      if (sl.big) { g.strokeStyle = 'rgba(217,173,91,0.75)'; g.lineWidth = 1; g.stroke(); }
      g.fillStyle = s.factions[c.controller]?.color ?? '#888';
      roundRect(g, lx, ly, 4, lh0, 2); g.fill();
      g.fillStyle = sl.big ? '#f6e3b4' : '#efe2c6';
      g.fillText(n.name, lx + 8, ly + lh0 / 2 + 0.5);
      if (sl.sub) {
        g.font = '600 10.5px "Noto Serif SC", serif';
        let x = lx + 4;
        for (const p of sl.sub) {
          const tw = g.measureText(p.t).width + 8;
          g.fillStyle = 'rgba(20,13,8,0.8)'; roundRect(g, x, ly + lh0 + 1, tw, 14, 3); g.fill();
          g.fillStyle = p.col; g.fillText(p.t, x + 4, ly + lh0 + 8.5);
          x += tw + 2;
        }
      }
    }
    g.globalAlpha = 1;
    g.restore();
  }

  /* ---------- 动效：易主、交战、号令落印、数字飘字 ---------- */
  fx: Fx[] = [];
  addFx(f: Omit<Fx, 't0'> & { delay?: number }) { this.fx.push({ ...f, t0: this.lastTime + (f.delay ?? 0) }); }
  drawFx(g: CanvasRenderingContext2D, _s: GameState, time: number) {
    this.fx = this.fx.filter(f => time - f.t0 < f.dur);
    for (const f of this.fx) {
      const p = (time - f.t0) / f.dur;
      if (p < 0) continue;
      const sl = f.node ? this.layout.get(f.node) : null;
      const [wx, wy] = f.node ? nodePt(f.node) : [0, 0];
      const [sx, sy] = sl ? [sl.sx, sl.sy - sl.w * 0.4] : worldToScreen(this.cam, this.w, this.h, wx, wy);
      if (f.kind === 'envoy' && f.path && f.path.length > 1) {
        // 使者：一骑持节沿路而去，身后扬起尘土
        const pts = roadPts(f.path[0], f.path.slice(1)).map(([wx, wy]) => worldToScreen(this.cam, this.w, this.h, wx, wy) as Pt);
        const [[x, y], [ddx]] = along(pts, p);
        const dir = ddx >= 0 ? 1 : -1;
        g.save();
        g.globalAlpha = p > 0.9 ? (1 - p) / 0.1 : 1;
        g.strokeStyle = 'rgba(240,207,134,0.45)'; g.lineWidth = 1.5; g.setLineDash([2, 5]);
        g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); g.setLineDash([]);
        for (let k = 0; k < 4; k++) { const d = k * 6; g.fillStyle = `rgba(190,160,110,${0.35 - k * 0.07})`; g.beginPath(); g.arc(x - dir * (8 + d), y + 2, 3 + k, 0, Math.PI * 2); g.fill(); }
        const bob = Math.sin(time / 70) * 1.5;
        g.translate(x, y - 6 + bob); g.scale(dir, 1);
        g.fillStyle = '#5a3b22'; g.beginPath(); g.ellipse(0, 2, 8, 4, 0, 0, Math.PI * 2); g.fill();
        g.fillRect(6, -4, 3, 6); g.fillRect(-6, 4, 2, 5); g.fillRect(4, 4, 2, 5);
        g.fillStyle = f.color ?? '#b5342a'; g.fillRect(-2, -8, 5, 7);
        g.fillStyle = '#e8c49a'; g.beginPath(); g.arc(0.5, -10, 2.4, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3, -6); g.lineTo(-3, -22); g.stroke();
        g.fillStyle = '#f0cf86'; g.fillRect(-3, -22, 1.6, 6); g.fillRect(-4.5, -16, 4.5, 1.2);
        g.restore();
        continue;
      }
      if (f.kind === 'convoy' && f.path && f.path.length > 1) {
        // 粮车沿驿路而行
        const pts = roadPts(f.path[0], f.path.slice(1)).map(([wx, wy]) => worldToScreen(this.cam, this.w, this.h, wx, wy) as Pt);
        const [[x, y]] = along(pts, p);
        g.save();
        g.globalAlpha = p > 0.85 ? (1 - p) / 0.15 : 1;
        g.strokeStyle = 'rgba(240,207,134,0.6)'; g.lineWidth = 2; g.setLineDash([4, 4]);
        g.beginPath(); pts.forEach(([px, py], i) => i ? g.lineTo(px, py) : g.moveTo(px, py)); g.stroke(); g.setLineDash([]);
        g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fillStyle = '#3a2a18'; g.fill(); g.strokeStyle = '#f0cf86'; g.lineWidth = 1.5; g.stroke();
        drawIcon(g, f.text ?? 'grain', x, y, 13, '#f0cf86');
        g.restore();
        continue;
      }
      g.save();
      g.translate(sx, sy);
      switch (f.kind) {
        case 'capture': {
          // 城破：火舌、烟柱、旧旗倒下、新旗升起、两圈冲击波。献城、归附、反正（quiet）只换旗落印，不起兵火
          if (!f.quiet) for (const k of [0, 0.22]) {
            const q = Math.max(0, Math.min(1, (p - k) / 0.6));
            if (q <= 0 || q >= 1) continue;
            g.strokeStyle = f.color ?? '#fff'; g.globalAlpha = 1 - q; g.lineWidth = 5 * (1 - q) + 1;
            g.beginPath(); g.ellipse(0, 10, 14 + q * 80, (14 + q * 80) * 0.42, 0, 0, Math.PI * 2); g.stroke();
          }
          g.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
          // 烟柱
          if (!f.quiet) for (let k = 0; k < 8; k++) {
            const q = (p * 1.4 + k / 8) % 1;
            g.fillStyle = `rgba(50,44,40,${0.5 * (1 - q)})`;
            g.beginPath(); g.arc(Math.sin(k * 1.7 + q * 3) * 6 + q * 12, -10 - q * 60, 5 + q * 12, 0, Math.PI * 2); g.fill();
          }
          if (f.quiet) {
            // 交印：一圈金色的光晕缓缓扩开
            const q = Math.min(1, p / 0.5);
            g.strokeStyle = `rgba(240,207,134,${0.8 * (1 - q)})`; g.lineWidth = 2;
            g.beginPath(); g.ellipse(0, 10, 12 + q * 46, (12 + q * 46) * 0.42, 0, 0, Math.PI * 2); g.stroke();
          }
          // 火舌
          if (!f.quiet) for (let k = 0; k < 6; k++) {
            const fl = 0.6 + 0.4 * Math.sin(time / 70 + k * 2);
            const x = (k - 2.5) * 6, h0 = (10 + (k % 3) * 5) * fl * (p < 0.6 ? 1 : (1 - p) / 0.4);
            const gr = g.createLinearGradient(x, 6, x, 6 - h0);
            gr.addColorStop(0, 'rgba(255,90,20,0.95)'); gr.addColorStop(0.6, 'rgba(255,190,60,0.85)'); gr.addColorStop(1, 'rgba(255,240,180,0)');
            g.fillStyle = gr; g.beginPath(); g.moveTo(x - 4, 6); g.quadraticCurveTo(x - 3, 6 - h0 * 0.6, x, 6 - h0); g.quadraticCurveTo(x + 3, 6 - h0 * 0.6, x + 4, 6); g.fill();
          }
          // 旗：旧旗倒下，新旗升起
          const q1 = Math.min(1, p / 0.35), q2 = Math.max(0, Math.min(1, (p - 0.35) / 0.3));
          g.save(); g.translate(-8, 6); g.rotate(-q1 * 1.4);
          g.strokeStyle = '#2a1d12'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -34); g.stroke();
          g.fillStyle = f.color2 ?? '#777'; g.globalAlpha *= 1 - q2 * 0.8; g.fillRect(0, -34, 16, 11);
          g.restore();
          if (q2 > 0) {
            g.save(); g.translate(8, 6);
            g.strokeStyle = '#2a1d12'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -40 * q2); g.stroke();
            const wv = Math.sin(time / 120) * 2;
            g.fillStyle = f.color ?? '#c8352a'; g.beginPath(); g.moveTo(0, -40 * q2); g.lineTo(20, -40 * q2 + 2 + wv); g.lineTo(20, -40 * q2 + 14 + wv); g.lineTo(0, -40 * q2 + 12); g.closePath(); g.fill();
            g.strokeStyle = '#f0cf86'; g.lineWidth = 1; g.stroke();
            g.fillStyle = '#fff6e2'; g.font = '700 9px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.text ?? '', 10, -40 * q2 + 7 + wv / 2);
            g.restore();
          }
          if (p > 0.55) { const q = Math.min(1, (p - 0.55) / 0.15); g.translate(0, -58); stamp(g, f.stamp ?? '破', f.quiet ? (f.color ?? '#8c6a35') : '#8f2015', 1 + (1 - q) * 1.4); }
          break;
        }
        case 'camp': {
          // 安营：一顶帐篷落地，炊烟升起，营旗插定（驻扎、行军、退兵——不是交战）
          const q = Math.min(1, p / 0.25);
          g.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
          g.translate(18, 4 - (1 - q) * 14);
          g.fillStyle = '#d9c9a3'; g.strokeStyle = '#3a2a18'; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(-11, 8); g.lineTo(0, -8); g.lineTo(11, 8); g.closePath(); g.fill(); g.stroke();
          g.fillStyle = '#3a2a18'; g.beginPath(); g.moveTo(-2, 8); g.lineTo(0, 1); g.lineTo(2, 8); g.fill();
          g.strokeStyle = '#2a1d12'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(14, 8); g.lineTo(14, -16); g.stroke();
          const wv = Math.sin(time / 140) * 1.5;
          g.fillStyle = f.color ?? '#f0cf86'; g.beginPath(); g.moveTo(14, -16); g.lineTo(26, -14 + wv); g.lineTo(26, -6 + wv); g.lineTo(14, -8); g.closePath(); g.fill();
          g.fillStyle = '#2a1d12'; g.font = '700 7px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(f.text ?? '营', 20, -10.5 + wv / 2);
          for (let k = 0; k < 4; k++) { const sp = (p * 1.6 + k / 4) % 1; g.fillStyle = `rgba(200,195,185,${0.45 * (1 - sp)})`; g.beginPath(); g.arc(-14 + Math.sin(k + sp * 3) * 3, -2 - sp * 26, 2 + sp * 5, 0, Math.PI * 2); g.fill(); }
          break;
        }
        case 'verdict': {
          // 号令结果：成（朱印）或不成（墨印），印下一行字
          const q = Math.min(1, p / 0.16);
          g.globalAlpha = p > 0.78 ? (1 - p) / 0.22 : 1;
          g.translate(0, -30);
          g.rotate(-0.12);
          stamp(g, f.stamp ?? (f.ok ? '成' : '败'), f.ok ? (f.color ?? '#b5342a') : '#4a4440', 2.4 - q * 1.3);
          g.rotate(0.12);
          if (f.text && q >= 1) {
            g.font = '900 12.5px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
            g.lineWidth = 3.5; g.strokeStyle = 'rgba(12,8,4,0.85)'; g.lineJoin = 'round'; g.strokeText(f.text, 0, 30);
            g.fillStyle = f.ok ? '#ffe2a0' : '#d8cbbb'; g.fillText(f.text, 0, 30);
          }
          break;
        }
        case 'clash': {
          // 两刃相交，火星四溅，尘土翻滚
          const q = Math.min(1, p / 0.3);
          g.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1;
          for (let k = 0; k < 6; k++) { const a = k * 1.05 + p * 2; g.fillStyle = `rgba(170,140,100,${0.35 * (1 - p)})`; g.beginPath(); g.arc(Math.cos(a) * (10 + p * 26), 8 + Math.sin(a) * 6, 8 + p * 10, 0, Math.PI * 2); g.fill(); }
          for (const sd of [-1, 1]) {
            g.save(); g.rotate(sd * (0.9 - q * 0.9 + 0.55)); g.translate(0, -2);
            g.strokeStyle = '#e8e8e0'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, 18); g.lineTo(0, -22); g.stroke();
            g.strokeStyle = '#6b4a2a'; g.lineWidth = 4; g.beginPath(); g.moveTo(-6, 14); g.lineTo(6, 14); g.moveTo(0, 14); g.lineTo(0, 24); g.stroke();
            g.restore();
          }
          if (q >= 1) for (let k = 0; k < 12; k++) {
            const a = k * Math.PI / 6 + p * 3, r1 = 6 + (p - 0.3) * 60;
            g.strokeStyle = `rgba(255,${200 - k * 6},90,${1 - p})`; g.lineWidth = 2;
            g.beginPath(); g.moveTo(Math.cos(a) * r1, Math.sin(a) * r1 - 4); g.lineTo(Math.cos(a) * (r1 + 8), Math.sin(a) * (r1 + 8) - 4); g.stroke();
          }
          break;
        }
        case 'treaty': {
          // 盟书展开，两方各落一印
          const q = Math.min(1, p / 0.3);
          g.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
          const w = 70 * q;
          g.fillStyle = '#efe2c2'; g.fillRect(-w / 2, -40, w, 34);
          g.strokeStyle = '#8c6a35'; g.lineWidth = 1.5; g.strokeRect(-w / 2, -40, w, 34);
          g.fillStyle = '#5a3a1a'; g.fillRect(-w / 2 - 4, -43, 5, 40); g.fillRect(w / 2 - 1, -43, 5, 40);
          if (q >= 1) {
            g.strokeStyle = 'rgba(40,30,20,0.6)'; g.lineWidth = 1; for (let k = 0; k < 4; k++) { g.beginPath(); g.moveTo(-26 + k * 8, -34); g.lineTo(-26 + k * 8, -14); g.stroke(); }
            const s1 = Math.min(1, Math.max(0, (p - 0.35) / 0.12)), s2 = Math.min(1, Math.max(0, (p - 0.5) / 0.12));
            if (s1 > 0) { g.save(); g.translate(12, -24); stamp(g, '盟', f.color ?? '#c8352a', 0.55 + (1 - s1) * 1.2); g.restore(); }
            if (s2 > 0) { g.save(); g.translate(26, -20); stamp(g, f.text ?? '约', f.color2 ?? '#2f6f8f', 0.55 + (1 - s2) * 1.2); g.restore(); }
          }
          break;
        }
        case 'card': {
          // 政令卡：翻转落下，再升起淡去
          const im = f.img ? imgOf(f.img) : null;
          const q = Math.min(1, p / 0.25);
          g.globalAlpha = p > 0.75 ? (1 - p) / 0.25 : 1;
          g.translate(0, -44 - Math.max(0, p - 0.5) * 30);
          g.scale(Math.abs(Math.cos((1 - q) * Math.PI)) * 0.95 + 0.05, 1);
          g.fillStyle = '#2a1d12'; g.fillRect(-26, -34, 52, 68);
          g.strokeStyle = '#f0cf86'; g.lineWidth = 2; g.strokeRect(-26, -34, 52, 68);
          if (im?.complete && q > 0.5) g.drawImage(im, -23, -31, 46, 44);
          g.fillStyle = '#f0cf86'; g.font = '700 11px "Ma Shan Zheng", "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          if (q > 0.5) g.fillText(f.text ?? '', 0, 24);
          break;
        }
        case 'march': {
          // 新募之兵列队入城
          g.globalAlpha = p > 0.8 ? (1 - p) / 0.2 : 1;
          for (let k = 0; k < 5; k++) {
            const q = Math.max(0, Math.min(1, p * 1.6 - k * 0.12));
            const x = -60 + q * 56 + k * 2, y = 14 - Math.sin(q * Math.PI) * 6 + (k % 2) * 3;
            const bob = Math.sin(time / 90 + k) * 1.2;
            g.fillStyle = f.color ?? '#c8352a'; g.fillRect(x - 2.5, y - 9 + bob, 5, 8);
            g.fillStyle = '#e8c49a'; g.beginPath(); g.arc(x, y - 11 + bob, 2.4, 0, Math.PI * 2); g.fill();
            g.strokeStyle = '#3a2a1a'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 3, y - 2 + bob); g.lineTo(x + 3, y - 18 + bob); g.stroke();
          }
          break;
        }
        case 'battle': {
          const q = Math.min(1, p / 0.25);
          g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
          const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40);
          gr.addColorStop(0, `rgba(255,220,140,${0.8 * (1 - p)})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
          g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
          g.rotate((1 - q) * 0.8);
          g.scale(0.6 + q * 0.6, 0.6 + q * 0.6);
          drawIcon(g, 'battle', 0, 0, 34, '#fff1d0');
          for (let k = 0; k < 8; k++) {
            const a = k * Math.PI / 4 + p;
            g.strokeStyle = `rgba(255,210,120,${1 - p})`; g.lineWidth = 2;
            g.beginPath(); g.moveTo(Math.cos(a) * (20 + p * 20), Math.sin(a) * (20 + p * 20)); g.lineTo(Math.cos(a) * (28 + p * 34), Math.sin(a) * (28 + p * 34)); g.stroke();
          }
          break;
        }
        case 'stamp': {
          const q = Math.min(1, p / 0.18);
          g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
          g.rotate(-0.15);
          stamp(g, f.text ?? '令', f.color ?? '#c8352a', 2.6 - q * 1.6);
          if (q >= 1) { g.strokeStyle = `rgba(200,53,42,${0.6 * (1 - p)})`; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 18 + (p - 0.18) * 60, 0, Math.PI * 2); g.stroke(); }
          break;
        }
        case 'float': {
          g.globalAlpha = p < 0.15 ? p / 0.15 : p > 0.7 ? (1 - p) / 0.3 : 1;
          g.font = '900 14px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          const y = -18 - p * 34 + (f.dy ?? 0);
          g.lineWidth = 3.5; g.strokeStyle = 'rgba(12,8,4,0.85)'; g.lineJoin = 'round'; g.strokeText(f.text ?? '', 0, y);
          g.fillStyle = f.color ?? '#f0cf86'; g.fillText(f.text ?? '', 0, y);
          break;
        }
        case 'ripple': {
          g.strokeStyle = f.color ?? '#f0cf86'; g.globalAlpha = 1 - p; g.lineWidth = 2.5;
          g.beginPath(); g.ellipse(0, 8, 10 + p * 40, (10 + p * 40) * 0.45, 0, 0, Math.PI * 2); g.stroke();
          break;
        }
      }
      g.restore();
    }
  }

  /* ---------- 交互 ---------- */
  pick(sx: number, sy: number): { kind: 'army' | 'node'; id: string } | null {
    // 军旗：取离指针最近的一枚（展开的小旗盘各指一支军队）
    const h = nearestHit(this.armyHits, sx, sy);
    if (h) {
      if (h.id !== h.stack[0] || h.stack.length === 1) return { kind: 'army', id: h.id };
      // 叠放的旗盘本身：再点一次换下一支
      const cur = this.view.selectedArmy;
      if (cur && h.stack.includes(cur)) return { kind: 'army', id: h.stack[(h.stack.indexOf(cur) + 1) % h.stack.length] };
      return { kind: 'army', id: h.stack[0] };
    }
    // 先看画出来的城郭（上层优先），再找最近的小点
    // 挪到旁边的城郭：点它原处那枚小圆点也算点中
    for (const sl of this.layout.values()) if (sl.ax !== undefined && sl.ay !== undefined && Math.hypot(sx - sl.ax, sy - sl.ay) < 10) return { kind: 'node', id: sl.id };
    // 城郭互相压着时，取城心离指针最近的一座
    const inside = [...this.layout.values()].filter(sl => sl.tier !== 'dot' && sx > sl.sx - sl.w * 0.42 && sx < sl.sx + sl.w * 0.42 && sy > sl.sy - sl.w * 0.85 && sy < sl.sy + sl.w * 0.2);
    if (inside.length) { inside.sort((a, b) => Math.hypot(sx - a.sx, sy - (a.sy - a.w * 0.35)) - Math.hypot(sx - b.sx, sy - (b.sy - b.w * 0.35))); return { kind: 'node', id: inside[0].id }; }
    for (const sl of this.layout.values()) if (sl.label && sx > sl.label[0] && sx < sl.label[0] + sl.label[2] && sy > sl.label[1] && sy < sl.label[1] + sl.label[3]) return { kind: 'node', id: sl.id };
    let best: string | null = null, bd = Infinity;
    for (const sl of this.layout.values()) { const d = Math.hypot(sx - sl.sx, sy - sl.sy); if (d < bd) { bd = d; best = sl.id; } }
    return best && bd < 14 ? { kind: 'node', id: best } : null;
  }

  zoomAt(sx: number, sy: number, factor: number) {
    this.target = null;
    const [wx, wy] = screenToWorld(this.cam, this.w, this.h, sx, sy);
    const z = Math.max(this.minZoom(), Math.min(MAX_Z, this.cam.z * factor));
    this.cam.z = z;
    const [nx, ny] = screenToWorld(this.cam, this.w, this.h, sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny;
    this.clamp();
  }
  pan(dx: number, dy: number) { this.target = null; this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clamp(); }
  minZoom() { const k = flatZ({ x: 0, y: 0, z: 1 }); return Math.max(this.w / WORLD_W, (flatV(this.h, this.h) - flatV(this.h, 0)) / k / WORLD_H, 0.5); }
  clamp() {
    this.cam.z = Math.max(this.minZoom(), this.cam.z);
    const Z = flatZ(this.cam);
    const hw = this.w / 2 / Z * flatW(this.h, flatV(this.h, 0)), up = -flatV(this.h, 0) / Z, down = flatV(this.h, this.h) / Z;
    this.cam.x = Math.max(Math.min(hw, WORLD_W / 2), Math.min(WORLD_W - Math.min(hw, WORLD_W / 2), this.cam.x));
    this.cam.y = Math.max(up, Math.min(WORLD_H - down, this.cam.y));
  }
  /** 平滑飞到某城 */
  flyTo(id: string, z?: number) {
    const [x, y] = nodePt(id);
    this.target = { x, y, z: Math.max(this.minZoom(), Math.min(MAX_Z, z ?? this.cam.z)) };
  }
  focus(id: string, z?: number) {
    this.target = null;
    const [x, y] = nodePt(id);
    this.cam.x = x; this.cam.y = y;
    if (z) this.cam.z = z;
    this.clamp();
  }
}

/* ---------- 工具 ---------- */
export function emblemTypeOf(s: GameState, id: string): EmblemType {
  const n = NODE[id];
  const c = s.cities[id];
  if (c && s.factions[c.controller]?.capital === id && c.controller !== 'local' && (n.kind === 'city' || n.kind === 'region' || n.kind === 'port')) return 'capital';
  if (n.kind === 'region') return 'region';
  if (n.kind === 'port') return 'port';
  if (n.kind === 'ferry') return 'ferry';
  if (n.kind === 'pass') return 'pass';
  return n.major ? 'major' : 'city';
}
export function nodePt(id: string): Pt { const n = NODE[id]; return P(n.lon, n.lat); }
export function armyPt(a: Army): Pt {
  if (a.progress > 0 && a.path.length) {
    const q = legCurve(a.location, a.path[0]);
    const f = legFrac(a);
    if (q) return quadAt(q, f);
    const [ax, ay] = nodePt(a.location), [bx, by] = nodePt(a.path[0]);
    return [ax + (bx - ax) * f, ay + (by - ay) * f];
  }
  return nodePt(a.location);
}
function topOfSafe(s: GameState, f: string): string {
  let cur = f;
  for (let i = 0; i < 5; i++) { const o = s.factions[cur]?.overlord; if (!o) return cur; cur = o; }
  return cur;
}
/** 预定路线只画己方与友方的：敌军去向不得而知 */
function visibleArmy(s: GameState, a: Army) { return friendly(s, s.player, a.faction); }
const fmtTroops = (n: number) => n >= 10000 ? (Math.round(n / 1000) / 10) + '万' : String(Math.round(n));
const roughT = (n: number) => n < 1000 ? '数百' : n < 5000 ? '数千' : n < 10000 ? '近万' : '约' + Math.round(n / 10000) + '万';

function wobble(a: Pt, b: Pt, seedKey: string): Pt[] {
  let h = 0; for (let i = 0; i < seedKey.length; i++) h = (h * 31 + seedKey.charCodeAt(i)) >>> 0;
  const rng = makeRng(h);
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(2, Math.round(len / 9));
  const nx = -(b[1] - a[1]) / len, ny = (b[0] - a[0]) / len;
  const out: Pt[] = [a];
  for (let i = 1; i < n; i++) {
    const t = i / n, j = (rng.next() - 0.5) * Math.min(6, len * 0.12);
    out.push([a[0] + (b[0] - a[0]) * t + nx * j, a[1] + (b[1] - a[1]) * t + ny * j]);
  }
  out.push(b);
  return out;
}

function smoothPath(g: CanvasRenderingContext2D, pts: Pt[]) {
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
    g.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
  }
  const l = pts[pts.length - 1];
  g.lineTo(l[0], l[1]);
}

/** 驿路弧线：两端为城，控制点按路名种子侧偏，看起来不是尺子画的 */
const curveCache = new Map<Route, number[]>();
function routeCurve(r: Route): number[] {
  let q = curveCache.get(r);
  if (!q) {
    const [ax, ay] = nodePt(r.a), [bx, by] = nodePt(r.b);
    const rng = makeRng(r.a.length * 131 + r.b.length * 7 + r.a.charCodeAt(0) * 17 + r.b.charCodeAt(r.b.length - 1));
    const len = Math.hypot(bx - ax, by - ay), off = (rng.next() - 0.5) * 0.22 * len;
    q = [ax, ay, (ax + bx) / 2 - (by - ay) / len * off, (ay + by) / 2 + (bx - ax) / len * off, bx, by];
    curveCache.set(r, q);
  }
  return q;
}
/** 从 from 走到 to 的那段驿路弧线（按行进方向排好端点） */
export function legCurve(from: string, to: string): number[] | null {
  const r = routeBetween(from, to);
  if (!r) return null;
  const q = routeCurve(r);
  return r.a === from ? q : [q[4], q[5], q[2], q[3], q[0], q[1]];
}
export function quadAt(q: number[], t: number): Pt {
  const u = 1 - t;
  return [u * u * q[0] + 2 * u * t * q[2] + t * t * q[4], u * u * q[1] + 2 * u * t * q[3] + t * t * q[5]];
}
/** 截取弧线 t0..t1 一段，仍是二次曲线 */
export function subQuad(q: number[], t0: number, t1: number): number[] {
  const p0 = quadAt(q, t0), p2 = quadAt(q, t1);
  const d = (t: number): Pt => [2 * (1 - t) * (q[2] - q[0]) + 2 * t * (q[4] - q[2]), 2 * (1 - t) * (q[3] - q[1]) + 2 * t * (q[5] - q[3])];
  const d0 = d(t0), h = (t1 - t0) / 2;
  return [p0[0], p0[1], p0[0] + d0[0] * h, p0[1] + d0[1] * h, p2[0], p2[1]];
}
/** 行军中所在：沿弧线走过的比例（画面上最多走到九成五，免得像已入城） */
export function legFrac(a: { location: string; progress: number; path: string[] }): number {
  const r = a.progress > 0 && a.path.length ? routeBetween(a.location, a.path[0]) : undefined;
  return r ? Math.min(0.95, a.progress / r.days) : 0;
}
/** 沿驿路的取样点：from 出发（t0 起），逐站走过 nodes。动画与粮车沿此而行 */
export function roadPts(from: string, nodes: string[], t0 = 0, per = 10): Pt[] {
  const out: Pt[] = [];
  let c = from;
  nodes.forEach((n, i) => {
    const q = legCurve(c, n);
    const a = i === 0 ? t0 : 0;
    if (!q) { if (!out.length) out.push(nodePt(c)); out.push(nodePt(n)); c = n; return; }
    for (let k = out.length ? 1 : 0; k <= per; k++) out.push(quadAt(q, a + (1 - a) * k / per));
    c = n;
  });
  return out.length ? out : [nodePt(from)];
}
function smoothPts(pts: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let k = 0; k < 8; k++) {
      const t = k / 8, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

export function drawFlag(g: CanvasRenderingContext2D, x: number, y: number, shape: string, fill: string, mark: string, s: number, ink: string) {
  const w = 12 * s, h = 9 * s;
  g.save();
  g.translate(x, y);
  g.beginPath();
  switch (shape) {
    case 'tri': g.moveTo(0, 0); g.lineTo(w * 1.15, h * 0.5); g.lineTo(0, h); break;
    case 'swallow': g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w * 0.7, h * 0.5); g.lineTo(w, h); g.lineTo(0, h); break;
    case 'banner': g.rect(0, 0, w * 0.85, h * 1.25); break;
    default: g.rect(0, 0, w, h);
  }
  g.closePath();
  g.fillStyle = fill; g.fill();
  g.strokeStyle = ink; g.lineWidth = 0.8 * s; g.stroke();
  if (shape === 'banner') { g.strokeStyle = '#c9a340'; g.lineWidth = 1.2 * s; g.strokeRect(1.2 * s, 1.2 * s, w * 0.85 - 2.4 * s, h * 1.25 - 2.4 * s); }
  if (mark) {
    g.fillStyle = fill === '#f3e9d2' ? '#a8261b' : '#fbf4e2';
    g.font = `700 ${Math.round(7.5 * s)}px "Noto Serif SC", serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const cx = shape === 'tri' ? w * 0.38 : shape === 'banner' ? w * 0.42 : w * 0.45;
    g.fillText(mark, cx, (shape === 'banner' ? h * 0.62 : h * 0.52));
  }
  g.restore();
}

function arrowHead(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string, k = 7) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x2, y2);
  g.lineTo(x2 - Math.cos(a - 0.4) * k, y2 - Math.sin(a - 0.4) * k);
  g.lineTo(x2 - Math.cos(a + 0.4) * k, y2 - Math.sin(a + 0.4) * k);
  g.closePath(); g.fill();
}

function vertText(g: CanvasRenderingContext2D, t: string, x: number, y: number, step: number) {
  g.textAlign = 'center';
  [...t].forEach((ch, i) => g.fillText(ch, x, y + i * step));
}

/** 沿折线按长度取点；返回位置与前进方向 */
export function along(poly: Pt[], k: number): [Pt, [number, number]] {
  const seg: number[] = [];
  let total = 0;
  for (let i = 1; i < poly.length; i++) { const d = Math.hypot(poly[i][0] - poly[i - 1][0], poly[i][1] - poly[i - 1][1]); seg.push(d); total += d; }
  if (total <= 0) return [poly[poly.length - 1], [1, 0]];
  let left = Math.max(0, Math.min(1, k)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (left <= seg[i] || i === seg.length - 1) {
      const q = seg[i] ? Math.min(1, left / seg[i]) : 1, a = poly[i], b = poly[i + 1];
      return [[a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q], [b[0] - a[0] || 0.001, b[1] - a[1]]];
    }
    left -= seg[i];
  }
  return [poly[poly.length - 1], [1, 0]];
}
