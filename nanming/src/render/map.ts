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
import { project, WORLD_W, WORLD_H, worldToScreen, screenToWorld, type Camera } from './projection';
import { makeRng } from '../core/rng';
import { routeBetween } from '../data/geography';
import land from '../data/geo-land.json';
import { ICONS } from '../ui/icons';
import { emblem, flagAnchor, drawWavingFlag, type EmblemType } from './emblems';

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
  armyHits: { id: string; x: number; y: number; r: number }[] = [];
  dpr = 1;
  w = 0;
  h = 0;
  relief: Relief | null = null;
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
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.save();
    g.translate(this.w / 2, this.h / 2);
    g.scale(cam.z, cam.z);
    g.translate(-cam.x, -cam.y);
    g.fillStyle = SEA;
    g.fillRect(cam.x - this.w / cam.z, cam.y - this.h / cam.z, this.w * 2 / cam.z, this.h * 2 / cam.z);
    g.restore();
    g.save();
    g.translate(this.w / 2, this.h / 2);
    g.scale(cam.z, cam.z);
    g.translate(-cam.x, -cam.y);
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.base, 0, 0, WORLD_W, WORLD_H);
    if (s) this.drawTerritory(g, s);
    this.drawWater(g);
    if (s) {
      this.drawRoutes(g, s, time);
      this.drawSieges(g, s, time);
      this.drawNodes(g, s, time);
      this.drawSiegeSmoke(g, s, time);
      this.drawArmies(g, s, time);
      this.drawSiegeSeals(g, s);
    }
    this.drawCloudShadows(g, time);
    g.restore();
    if (s) this.drawLabels(g, s);
  }

  drawTerritory(g: CanvasRenderingContext2D, s: GameState) {
    g.save();
    g.clip(this.landPath);
    g.globalAlpha = 0.2;
    for (const n of NODES) {
      const c = s.cities[n.id];
      const poly = this.cells[n.id];
      if (!c || !poly) continue;
      g.fillStyle = s.factions[c.controller]?.color ?? '#999';
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
        g.save();
        g.beginPath(); poly.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.clip();
        g.strokeStyle = s.factions[f!]?.color ?? '#999'; g.globalAlpha = 0.5; g.lineWidth = bw;
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
    g.restore();
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

  drawRoutes(g: CanvasRenderingContext2D, s: GameState, time: number) {
    const z = this.cam.z;
    const sel = this.view.selected;
    if (z >= 1.9 || sel) {
      for (const r of ROUTES) {
        if (z < 1.9 && r.a !== sel && r.b !== sel) continue;
        const q = routeCurve(r);
        const hi = r.a === sel || r.b === sel;
        if (hi || r.kind !== 'land') {
          g.strokeStyle = r.kind === 'land' ? 'rgba(255,226,150,0.85)' : 'rgba(170,225,240,0.7)';
          g.lineWidth = hi ? 1.4 : 0.9;
          g.setLineDash(r.kind === 'land' ? [] : [4, 3]);
          g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[2], q[3], q[4], q[5]); g.stroke();
        }
        if (z >= 2.6) {
          g.setLineDash([]);
          const mx = 0.25 * q[0] + 0.5 * q[2] + 0.25 * q[4], my = 0.25 * q[1] + 0.5 * q[3] + 0.25 * q[5];
          g.font = '600 6px "Noto Serif SC", serif'; g.textAlign = 'center';
          g.lineWidth = 2; g.strokeStyle = 'rgba(20,14,8,0.75)'; g.strokeText(`${r.days}日`, mx, my - 1.5);
          g.fillStyle = '#f3e4bf'; g.fillText(`${r.days}日`, mx, my - 1.5);
        }
      }
      g.setLineDash([]);
    }
    // 行军路线
    const dash = -(time / 60) % 12;
    const drawPath = (a: Army, path: string[], planned: boolean) => {
      const pts: Pt[] = [armyPt(a), ...path.map(nodePt)];
      if (pts.length < 2) return;
      const mine = a.faction === s.player;
      g.strokeStyle = planned ? 'rgba(181,52,42,0.95)' : mine ? 'rgba(181,52,42,0.75)' : 'rgba(30,25,20,0.6)';
      g.lineWidth = planned ? 2.2 : 1.6;
      g.setLineDash([6, 4]); g.lineDashOffset = dash;
      g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
      g.setLineDash([]);
      const [x1, y1] = pts[pts.length - 2], [x2, y2] = pts[pts.length - 1];
      arrowHead(g, x1, y1, x2, y2, g.strokeStyle as string);
    };
    for (const a of Object.values(s.armies)) if (a.path.length && (visibleArmy(s, a))) drawPath(a, a.path, false);
    for (const p of this.view.planned) { const a = s.armies[p.army]; if (a) drawPath(a, p.path, true); }
    if (this.view.targeting?.path) { const a = s.armies[this.view.targeting.army]; if (a) drawPath(a, this.view.targeting.path, true); }
  }

  drawSieges(g: CanvasRenderingContext2D, s: GameState, time: number) {
    for (const sg of Object.values(s.sieges)) {
      const [x, y] = nodePt(sg.node);
      const r = 22;
      const pulse = 0.5 + 0.5 * Math.sin(time / 300);
      g.save();
      g.translate(x, y);
      // 红光
      const grd = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r + 10);
      grd.addColorStop(0, 'rgba(224,80,63,0)'); grd.addColorStop(0.7, `rgba(224,80,63,${0.18 + pulse * 0.2})`); grd.addColorStop(1, 'rgba(224,80,63,0)');
      g.fillStyle = grd; g.beginPath(); g.arc(0, 0, r + 10, 0, Math.PI * 2); g.fill();
      // 刺圈
      g.rotate(time / 5000);
      g.strokeStyle = s.factions[sg.attacker]?.color ?? '#333';
      g.lineWidth = 2.6;
      for (let k = 0; k < 16; k++) {
        const a = k * Math.PI / 8;
        g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + 6), Math.sin(a) * (r + 6)); g.stroke();
      }
      g.strokeStyle = '#e0503f'; g.lineWidth = 1.6; g.setLineDash([3, 3]);
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }
  /** 被围之城：烽烟与火光（画在城郭之上） */
  drawSiegeSmoke(g: CanvasRenderingContext2D, s: GameState, time: number) {
    for (const sg of Object.values(s.sieges)) {
      const [x, y] = nodePt(sg.node);
      for (let k = 0; k < 7; k++) {
        const p = ((time / 2600 + k / 7) % 1);
        const px = x - 4 + Math.sin(k * 2.1 + p * 3) * 4 + p * 10, py = y - 14 - p * 34;
        g.fillStyle = `rgba(60,55,50,${0.45 * (1 - p)})`;
        g.beginPath(); g.arc(px, py, 3 + p * 7, 0, Math.PI * 2); g.fill();
      }
      const fl = 0.6 + 0.4 * Math.sin(time / 90);
      const gr = g.createRadialGradient(x - 3, y - 9, 0, x - 3, y - 9, 8);
      gr.addColorStop(0, `rgba(255,200,90,${0.9 * fl})`); gr.addColorStop(1, 'rgba(255,90,20,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x - 3, y - 9, 8, 0, Math.PI * 2); g.fill();
    }
  }
  /** 云影：缓缓掠过 */
  drawCloudShadows(g: CanvasRenderingContext2D, time: number) {
    for (let k = 0; k < 5; k++) {
      const x = ((time / 90 + k * 520) % (WORLD_W + 600)) - 300, y = 180 + k * 290 + Math.sin(time / 20000 + k) * 40;
      const gr = g.createRadialGradient(x, y, 20, x, y, 220);
      gr.addColorStop(0, 'rgba(20,30,40,0.10)'); gr.addColorStop(1, 'rgba(20,30,40,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 260, 130, 0, 0, Math.PI * 2); g.fill();
    }
  }
  drawSiegeSeals(g: CanvasRenderingContext2D, s: GameState) {
    for (const sg of Object.values(s.sieges)) {
      const [x, y] = nodePt(sg.node);
      const sx = x - 22, sy = y - 24;
      g.save();
      g.translate(sx, sy); g.rotate(-0.12);
      roundRect(g, -8, -8, 16, 16, 3);
      g.fillStyle = '#c8352a'; g.fill();
      g.strokeStyle = '#f0cf86'; g.lineWidth = 1.2; g.stroke();
      g.fillStyle = '#fff3d9'; g.font = '700 11px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('围', 0, 0.5);
      g.restore();
    }
  }

  drawNodes(g: CanvasRenderingContext2D, s: GameState, time: number) {
    const z = this.cam.z;
    const k = Math.max(0.7, Math.min(1.3, 1.25 / Math.sqrt(z)));
    const order = NODES.filter(n => n.kind !== 'outland').sort((a, b) => a.lat === b.lat ? 0 : b.lat - a.lat); // 自北而南，近者压远者
    for (const n of order) {
      const c = s.cities[n.id];
      if (!c) continue;
      const type = emblemTypeOf(s, n.id);
      if (z < 1.0 && !n.major && type !== 'region' && type !== 'capital') continue;
      const [x, y] = nodePt(n.id);
      const f = s.factions[c.controller];
      const col = f?.color ?? '#999';
      const w = EMBLEM_W[type] * k * (z < 1 ? 0.8 : 1);
      const isSel = this.view.selected === n.id, isHover = this.view.hover === n.id;
      const mine = topOfSafe(s, c.controller) === s.player;
      // 落地光环：实控者颜色
      g.save();
      g.beginPath(); g.ellipse(x, y + 1, w * 0.52, w * 0.17, 0, 0, Math.PI * 2);
      g.fillStyle = col; g.globalAlpha = 0.85; g.fill();
      g.globalAlpha = 1; g.lineWidth = (mine ? 1.6 : 1) * k; g.strokeStyle = mine ? '#f0cf86' : 'rgba(30,20,10,0.7)'; g.stroke();
      g.restore();
      if (isSel || isHover) {
        const pulse = isSel ? 2 + Math.sin(time / 260) * 2 : 0;
        g.strokeStyle = isSel ? 'rgba(255,214,120,0.95)' : 'rgba(255,240,200,0.7)'; g.lineWidth = 2;
        g.beginPath(); g.ellipse(x, y + 1, w * 0.62 + pulse, w * 0.22 + pulse * 0.4, 0, 0, Math.PI * 2); g.stroke();
      }
      // 城郭插画
      const top = y - w * 0.92;
      g.drawImage(emblem(type), x - w / 2, top, w, w);
      // 旗：实控者颜色，旗书所奉政权
      if (z >= 0.9 || n.major) {
        const pol = POLITIES[f?.polity ?? 'none'];
        const [ax, ay] = flagAnchor(type);
        drawWavingFlag(g, x - w / 2 + ax * w / 100, top + ay * w / 100, col, pol?.mark ?? '', time / 1000 + x * 0.01, pol?.flag ?? 'rect', w / 44);
      }
      // 城防环（放大后）
      if (z >= 2.4 && (type !== 'ferry')) {
        const r = w * 0.56;
        g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 2.2;
        g.beginPath(); g.ellipse(x, y + 1, r, r * 0.33, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = c.wall > 60 ? '#9fd18f' : c.wall > 30 ? '#e8a447' : '#e0503f';
        g.beginPath(); g.ellipse(x, y + 1, r, r * 0.33, 0, Math.PI / 2, Math.PI / 2 + Math.PI * 2 * c.wall / 100); g.stroke();
      }
    }
  }

  drawArmies(g: CanvasRenderingContext2D, s: GameState, _time: number) {
    this.armyHits = [];
    const byNode: Record<string, Army[]> = {};
    for (const a of Object.values(s.armies)) { if (!visibleArmy(s, a)) continue; const key = a.progress > 0 ? a.id : a.location; (byNode[key] ??= []).push(a); }
    const z = this.cam.z;
    const scale = Math.max(0.7, Math.min(1.3, 1.2 / Math.sqrt(z)));
    for (const list of Object.values(byNode)) {
      list.sort((a, b) => a.id.localeCompare(b.id));
      list.forEach((a, i) => {
        const [bx, by] = armyPt(a);
        const ang = -Math.PI / 2 - 0.85 + i * 0.85;
        const off = a.progress > 0 ? 0 : (s.sieges[a.location] ? 40 : 32) * scale;
        const x = bx + Math.cos(ang) * off * (1 + i * 0.12), y = by + Math.sin(ang) * off * 0.85 - 2;
        const f = s.factions[a.faction];
        const pol = POLITIES[f?.polity ?? 'none'];
        const cmd = s.chars[a.commander];
        const mark = (cmd?.name ?? f?.short ?? '?').slice(0, 1);
        const sel = this.view.selectedArmy === a.id;
        const mine = topOfSafe(s, a.faction) === s.player;
        g.save();
        g.translate(x, y); g.scale(scale, scale);
        if (sel) { g.fillStyle = 'rgba(255,214,120,0.55)'; g.beginPath(); g.arc(0, 0, 15, 0, Math.PI * 2); g.fill(); }
        // 旗杆与小旗（所奉政权）
        g.strokeStyle = '#1b130c'; g.lineWidth = 1.3;
        g.beginPath(); g.moveTo(7, -4); g.lineTo(7, -20); g.stroke();
        drawFlag(g, 7, -20, pol?.flag ?? 'rect', '#f3e9d2', pol?.mark ?? '', 0.7, '#1b130c');
        // 圆章：主将姓氏
        g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 5; g.shadowOffsetY = 2;
        g.beginPath(); g.arc(0, 0, 10.5, 0, Math.PI * 2);
        g.fillStyle = f?.color ?? '#888'; g.fill();
        g.shadowColor = 'transparent';
        g.lineWidth = 2; g.strokeStyle = mine ? '#f0cf86' : '#e8d9b4'; g.stroke();
        g.fillStyle = '#fff8e6'; g.font = '700 12px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(mark, 0, 0.5);
        // 兵力牌
        const t = this.knownArmy(s, a) ? fmtTroops(a.troops) : roughT(a.troops);
        g.font = '700 8.5px "Noto Serif SC", serif';
        const tw = g.measureText(t).width + 6;
        roundRect(g, -tw / 2, 11, tw, 10, 3);
        g.fillStyle = 'rgba(15,10,6,0.85)'; g.fill();
        g.fillStyle = a.morale > 50 ? '#f0cf86' : a.morale > 25 ? '#e8a447' : '#ff8f7f';
        g.fillText(t, 0, 16.5);
        g.restore();
        this.armyHits.push({ id: a.id, x, y, r: 13 * scale });
      });
    }
  }
  knownArmy(s: GameState, a: Army) { const t = topOfSafe(s, a.faction); return t === s.player || a.faction === s.player; }

  drawLabels(g: CanvasRenderingContext2D, s: GameState) {
    const z = this.cam.z;
    g.save();
    g.textBaseline = 'middle';
    // 远看：势力大字
    if (z < 1.35) {
      const groups: Record<string, Pt[]> = {};
      for (const c of Object.values(s.cities)) { if (c.controller === 'local') continue; (groups[c.controller] ??= []).push(nodePt(c.id)); }
      for (const [f, pts] of Object.entries(groups)) {
        const fac = s.factions[f];
        if (!fac || pts.length < 2) continue;
        const cx = pts.reduce((n, p) => n + p[0], 0) / pts.length, cy = pts.reduce((n, p) => n + p[1], 0) / pts.length;
        const [sx, sy] = worldToScreen(this.cam, this.w, this.h, cx, cy);
        g.font = `600 ${Math.round(15 + Math.min(14, pts.length))}px "Ma Shan Zheng", "Noto Serif SC", serif`;
        g.textAlign = 'center';
        g.lineWidth = 3; g.lineJoin = 'round'; g.strokeStyle = 'rgba(20,12,6,0.55)';
        g.strokeText(fac.name, sx, sy + 22);
        g.fillStyle = 'rgba(255,240,210,0.78)';
        g.fillText(fac.name, sx, sy + 22);
      }
    }
    // 河名
    if (z >= 0.9) {
      g.font = `italic 500 ${Math.round(11 + z * 1.5)}px "Noto Serif SC", serif`;
      g.textAlign = 'center'; g.lineWidth = 3; g.lineJoin = 'round';
      for (const r of RIVERS) if (r.label) {
        const [sx, sy] = worldToScreen(this.cam, this.w, this.h, ...P(r.label[0], r.label[1]));
        g.strokeStyle = 'rgba(14,34,44,0.6)'; g.strokeText(r.name, sx, sy);
        g.fillStyle = '#cfe9f2'; g.fillText(r.name, sx, sy);
      }
    }
    // 城名（按重要性排序，避免重叠）
    const placed: [number, number, number, number][] = [];
    const prio = (id: string) => (this.view.selected === id ? 0 : this.view.hover === id ? 1 : NODE[id].major ? 2 : NODE[id].detail ? 3 : 4);
    const order = NODES.filter(n => n.kind !== 'outland').sort((a, b) => prio(a.id) - prio(b.id));
    for (const n of order) {
      const show = n.major || (z >= 1.25 && n.detail) || z >= 1.9 || this.view.selected === n.id || this.view.hover === n.id;
      if (!show) continue;
      const [x, y] = nodePt(n.id);
      const [sx, sy] = worldToScreen(this.cam, this.w, this.h, x, y);
      if (sx < -40 || sy < -20 || sx > this.w + 40 || sy > this.h + 20) continue;
      const big = n.major;
      const size = Math.round((big ? 14 : 12) + Math.min(4, (z - 1) * 2));
      g.font = `${big ? 700 : 500} ${size}px "Noto Serif SC", "Songti SC", serif`;
      g.textAlign = 'left';
      const label = n.name;
      const tw = label.length * size, th = size + (z >= 2.6 ? size : 0);
      const gap = 13;
      const kk = Math.max(0.7, Math.min(1.3, 1.25 / Math.sqrt(z)));
      const below = sy + EMBLEM_W[emblemTypeOf(s, n.id)] * kk * 0.2 * z + size * 0.75;
      const cands: [number, number][] = [[sx - tw / 2, below], [sx + gap + 6, sy - 4], [sx - gap - 6 - tw, sy - 4], [sx - tw / 2, sy - 34 * Math.min(2, z) * 0.6]];
      let tx = cands[0][0], ty = cands[0][1], ok = false;
      for (const [cx, cy] of cands) {
        const rect: [number, number, number, number] = [cx - 2, cy - size / 2 - 1, tw + 4, th + 2];
        if (prio(n.id) <= 1 || !placed.some(r => r[0] < rect[0] + rect[2] && rect[0] < r[0] + r[2] && r[1] < rect[1] + rect[3] && rect[1] < r[1] + r[3])) { tx = cx; ty = cy; placed.push(rect); ok = true; break; }
      }
      if (!ok) continue;
      const pw = g.measureText(label).width + 12;
      g.fillStyle = big ? 'rgba(20,13,8,0.86)' : 'rgba(20,13,8,0.72)';
      roundRect(g, tx - 7, ty - size / 2 - 3, pw, size + 6, 4); g.fill();
      if (big) { g.strokeStyle = 'rgba(217,173,91,0.75)'; g.lineWidth = 1; g.stroke(); }
      g.fillStyle = s.factions[s.cities[n.id].controller]?.color ?? '#888';
      roundRect(g, tx - 7, ty - size / 2 - 3, 4, size + 6, 2); g.fill();
      g.fillStyle = big ? '#f6e3b4' : '#efe2c6'; g.fillText(label, tx, ty + 0.5);
      // 放大后：驻军
      if (z >= 2.6) {
        const c = s.cities[n.id];
        const own = c.controller === s.player || topOfSafe(s, c.controller) === s.player;
        const txt = own ? `驻 ${fmtTroops(c.garrison)}` : `驻 ${roughT(c.garrison)}`;
        g.font = `500 ${size - 3}px "Noto Serif SC", serif`;
        g.fillStyle = 'rgba(20,13,8,0.6)';
        roundRect(g, tx - 4, ty + size - (size - 3) / 2 - 1, g.measureText(txt).width + 8, size - 1, 3); g.fill();
        g.fillStyle = '#e8d9b4';
        g.fillText(txt, tx, ty + size);
      }
    }
    g.restore();
  }

  /* ---------- 交互 ---------- */
  pick(sx: number, sy: number): { kind: 'army' | 'node'; id: string } | null {
    const [wx, wy] = screenToWorld(this.cam, this.w, this.h, sx, sy);
    for (const h of [...this.armyHits].reverse()) if (Math.hypot(wx - h.x, wy - h.y) < h.r) return { kind: 'army', id: h.id };
    let best: string | null = null, bd = Infinity;
    for (const n of NODES) {
      if (n.kind === 'outland') continue;
      const [x, y] = nodePt(n.id);
      const d = Math.hypot(wx - x, wy - y) * this.cam.z;
      if (d < bd) { bd = d; best = n.id; }
    }
    return best && bd < 18 ? { kind: 'node', id: best } : null;
  }

  zoomAt(sx: number, sy: number, factor: number) {
    this.target = null;
    const [wx, wy] = screenToWorld(this.cam, this.w, this.h, sx, sy);
    const z = Math.max(this.minZoom(), Math.min(4, this.cam.z * factor));
    this.cam.z = z;
    const [nx, ny] = screenToWorld(this.cam, this.w, this.h, sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny;
    this.clamp();
  }
  pan(dx: number, dy: number) { this.target = null; this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clamp(); }
  minZoom() { return Math.max(this.w / WORLD_W, this.h / WORLD_H, 0.5); }
  clamp() {
    this.cam.z = Math.max(this.minZoom(), this.cam.z);
    const hw = this.w / 2 / this.cam.z, hh = this.h / 2 / this.cam.z;
    this.cam.x = Math.max(hw, Math.min(WORLD_W - hw, this.cam.x));
    this.cam.y = Math.max(hh, Math.min(WORLD_H - hh, this.cam.y));
  }
  /** 平滑飞到某城 */
  flyTo(id: string, z?: number) {
    const [x, y] = nodePt(id);
    this.target = { x, y, z: Math.max(this.minZoom(), Math.min(4, z ?? this.cam.z)) };
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
const EMBLEM_W: Record<EmblemType, number> = { capital: 50, region: 42, major: 40, city: 32, port: 34, ferry: 28, pass: 34 };
export function nodePt(id: string): Pt { const n = NODE[id]; return P(n.lon, n.lat); }
export function armyPt(a: Army): Pt {
  if (a.progress > 0 && a.path.length) {
    const r = routeBetween(a.location, a.path[0]);
    const f = r ? Math.min(0.95, a.progress / r.days) : 0;
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
function visibleArmy(_s: GameState, _a: Army) { return true; }
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

function arrowHead(g: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  const a = Math.atan2(y2 - y1, x2 - x1);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x2, y2);
  g.lineTo(x2 - Math.cos(a - 0.4) * 7, y2 - Math.sin(a - 0.4) * 7);
  g.lineTo(x2 - Math.cos(a + 0.4) * 7, y2 - Math.sin(a + 0.4) * 7);
  g.closePath(); g.fill();
}

function vertText(g: CanvasRenderingContext2D, t: string, x: number, y: number, step: number) {
  g.textAlign = 'center';
  [...t].forEach((ch, i) => g.fillText(ch, x, y + i * step));
}
