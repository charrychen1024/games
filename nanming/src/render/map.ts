/* 地图绘制：明末舆图的设色与山水笔意，全部由代码生成。
 * 底图（纸、海波、山形、长城）预先绘入离屏画布；势力色、河流、城池、军队每帧矢量绘制。
 * 远看以河流、疆域、城名为主；放大后才出现城防、港口、驻军与路线。 */
import { Delaunay } from 'd3-delaunay';
import type { GameState, Army } from '../core/types';
import { NODES, NODE, ROUTES, RIVERS, CANALS, LAKES, MOUNTAINS, GREAT_WALL } from '../data/geography';
import { POLITIES } from '../data/factions';
import { project, WORLD_W, WORLD_H, worldToScreen, screenToWorld, type Camera } from './projection';
import { makeRng } from '../core/rng';
import { routeBetween } from '../data/geography';
import land from '../data/geo-land.json';

export const INK = '#2a2118';
export const PAPER = '#ecdfc0';
const SEA = '#c4cfbd';
const WATER = '#6f9aa0';
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
  seaPattern: CanvasPattern | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    for (const ring of (land as any).rings as Pt[][]) {
      ring.forEach(([lon, lat], i) => { const [x, y] = P(lon, lat); i ? this.landPath.lineTo(x, y) : this.landPath.moveTo(x, y); });
      this.landPath.closePath();
    }
    this.buildCells();
    this.base = this.buildBase();
    const tile = document.createElement('canvas'); tile.width = 24; tile.height = 18;
    const tg = tile.getContext('2d')!;
    tg.fillStyle = SEA; tg.fillRect(0, 0, 24, 18);
    tg.strokeStyle = 'rgba(70,100,96,0.32)'; tg.lineWidth = 0.7;
    for (const [x, y] of [[2, 6], [14, 6], [8, 15], [20, 15], [-4, 15]]) { tg.beginPath(); tg.arc(x, y, 5, Math.PI * 1.05, Math.PI * 1.95); tg.stroke(); }
    this.seaPattern = this.ctx.createPattern(tile, 'repeat');
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

  /* ---------- 底图 ---------- */
  buildBase(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(WORLD_W * BASE_SCALE);
    c.height = Math.round(WORLD_H * BASE_SCALE);
    const g = c.getContext('2d')!;
    g.scale(BASE_SCALE, BASE_SCALE);
    const rng = makeRng(1644);
    // 海
    g.fillStyle = SEA;
    g.fillRect(0, 0, WORLD_W, WORLD_H);
    // 海波纹：一行行鱼鳞状弧线
    g.save();
    g.strokeStyle = 'rgba(70,100,96,0.32)';
    g.lineWidth = 0.7;
    for (let y = 6; y < WORLD_H; y += 9) {
      const off = (Math.floor(y / 9) % 2) * 6;
      for (let x = -10 + off; x < WORLD_W; x += 12) {
        g.beginPath();
        g.arc(x, y, 5, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
      }
    }
    g.restore();
    // 陆地
    g.save();
    g.fillStyle = PAPER;
    g.shadowColor = 'rgba(60,70,60,0.35)';
    g.shadowBlur = 6;
    g.fill(this.landPath);
    g.restore();
    g.save();
    g.clip(this.landPath);
    // 纸纹：斑点与纤维
    for (let i = 0; i < 26000; i++) {
      const x = rng.next() * WORLD_W, y = rng.next() * WORLD_H;
      g.fillStyle = rng.chance(0.5) ? 'rgba(120,90,50,0.06)' : 'rgba(255,250,235,0.10)';
      g.fillRect(x, y, 1 + rng.next() * 1.5, 1 + rng.next() * 1.5);
    }
    g.strokeStyle = 'rgba(130,100,60,0.05)';
    for (let i = 0; i < 1400; i++) {
      const x = rng.next() * WORLD_W, y = rng.next() * WORLD_H, a = rng.next() * Math.PI;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); g.stroke();
    }
    // 湖泊
    for (const l of LAKES) {
      const [x, y] = P(l.lon, l.lat);
      g.save();
      g.translate(x, y); g.rotate(l.rot);
      g.beginPath(); g.ellipse(0, 0, l.rx * 34, l.ry * 40, 0, 0, Math.PI * 2);
      g.fillStyle = '#b9cbbf'; g.fill();
      g.strokeStyle = 'rgba(60,95,100,0.55)'; g.lineWidth = 1; g.stroke();
      g.strokeStyle = 'rgba(60,95,100,0.25)';
      for (let k = -2; k <= 2; k++) { g.beginPath(); g.ellipse(0, k * l.ry * 9, l.rx * 22, 1.5, 0, 0, Math.PI); g.stroke(); }
      g.restore();
    }
    // 山形：青绿山头沿山脉排布
    for (const m of MOUNTAINS) {
      const pts = m.pts.map(([lo, la]) => P(lo, la));
      const step = 11 * m.size;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
        const len = Math.hypot(bx - ax, by - ay);
        for (let t = 0; t < len; t += step * (0.8 + rng.next() * 0.4)) {
          const f = t / len;
          const x = ax + (bx - ax) * f + (rng.next() - 0.5) * 8, y = ay + (by - ay) * f + (rng.next() - 0.5) * 8;
          drawPeak(g, x, y, (7 + rng.next() * 5) * m.size, rng.next());
          if (rng.chance(0.45)) drawPeak(g, x + (rng.next() - 0.5) * 12, y + 5 + rng.next() * 4, (4 + rng.next() * 3) * m.size, rng.next());
        }
      }
    }
    // 长城
    const wall = GREAT_WALL.map(([lo, la]) => P(lo, la));
    g.strokeStyle = '#6b4c34'; g.lineWidth = 2.2; g.lineJoin = 'round';
    g.beginPath(); wall.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.lineWidth = 1.3;
    for (let i = 0; i < wall.length - 1; i++) {
      const [ax, ay] = wall[i], [bx, by] = wall[i + 1];
      const len = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / len, ny = (bx - ax) / len;
      for (let t = 3; t < len; t += 5) {
        const x = ax + (bx - ax) * t / len, y = ay + (by - ay) * t / len;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + nx * 2.4, y + ny * 2.4); g.stroke();
      }
    }
    g.restore();
    // 海名
    g.fillStyle = 'rgba(50,80,78,0.45)';
    g.font = '600 15px "Noto Serif SC", "Songti SC", serif';
    vertText(g, '东海', ...P(124.2, 29.5), 18);
    vertText(g, '南海', ...P(114.5, 19.8), 18);
    vertText(g, '黄海', ...P(123.2, 35.2), 18);
    return c;
  }

  /* ---------- 每帧绘制 ---------- */
  render(time: number) {
    const { ctx: g, cam } = this;
    const s = this.view.state;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.save();
    g.translate(this.w / 2, this.h / 2);
    g.scale(cam.z, cam.z);
    g.translate(-cam.x, -cam.y);
    g.fillStyle = this.seaPattern ?? SEA;
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
      this.drawArmies(g, s, time);
    }
    g.restore();
    if (s) this.drawLabels(g, s);
  }

  drawTerritory(g: CanvasRenderingContext2D, s: GameState) {
    g.save();
    g.clip(this.landPath);
    g.globalAlpha = 0.34;
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
    // 疆界：不同实控者之间
    for (const e of this.edges) {
      const ca = s.cities[e.a]?.controller, cb = s.cities[e.b]?.controller;
      const outA = NODE[e.a].kind === 'outland', outB = NODE[e.b].kind === 'outland';
      if (ca === cb && !outA && !outB) continue;
      if (outA && outB) continue;
      const major = !outA && !outB && topOfSafe(s, ca!) !== topOfSafe(s, cb!);
      g.beginPath(); e.pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.strokeStyle = major ? 'rgba(60,30,20,0.75)' : 'rgba(60,30,20,0.35)';
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
    g.strokeStyle = 'rgba(40,60,58,0.7)'; g.lineWidth = 1.1 / Math.sqrt(z);
    g.stroke(this.landPath);
    // 河流：浅色宽带 + 深色细芯
    for (const r of RIVERS) {
      const pts = r.pts.map(([lo, la]) => P(lo, la));
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.strokeStyle = 'rgba(160,190,190,0.9)'; g.lineWidth = r.width * 1.5;
      smoothPath(g, pts); g.stroke();
      g.strokeStyle = WATER; g.lineWidth = r.width * 0.55;
      smoothPath(g, pts); g.stroke();
    }
    g.setLineDash([4, 3]);
    g.strokeStyle = 'rgba(80,120,130,0.8)'; g.lineWidth = 1.2;
    for (const c of CANALS) { smoothPath(g, c.pts.map(([lo, la]) => P(lo, la))); g.stroke(); }
    g.setLineDash([]);
  }

  drawRoutes(g: CanvasRenderingContext2D, s: GameState, time: number) {
    const z = this.cam.z;
    const sel = this.view.selected;
    if (z >= 1.9 || sel) {
      for (const r of ROUTES) {
        if (z < 1.9 && r.a !== sel && r.b !== sel) continue;
        const [ax, ay] = nodePt(r.a), [bx, by] = nodePt(r.b);
        g.strokeStyle = r.kind === 'land' ? 'rgba(110,70,40,0.45)' : r.kind === 'sea' ? 'rgba(40,80,110,0.45)' : 'rgba(40,90,110,0.4)';
        g.lineWidth = 0.9;
        g.setLineDash(r.kind === 'land' ? [1.5, 2.5] : [5, 3]);
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
        if (z >= 2.6) {
          g.setLineDash([]);
          g.fillStyle = 'rgba(70,50,30,0.7)'; g.font = '6px "Noto Serif SC", serif'; g.textAlign = 'center';
          g.fillText(`${r.days}日`, (ax + bx) / 2, (ay + by) / 2 - 1.5);
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
      const r = 15;
      g.save();
      g.translate(x, y);
      g.rotate(time / 4000);
      g.strokeStyle = s.factions[sg.attacker]?.color ?? '#333';
      g.lineWidth = 2;
      for (let k = 0; k < 12; k++) {
        const a = k * Math.PI / 6;
        g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5)); g.stroke();
      }
      g.setLineDash([2, 2]);
      g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
      g.restore();
    }
  }

  drawNodes(g: CanvasRenderingContext2D, s: GameState, time: number) {
    const z = this.cam.z;
    for (const n of NODES) {
      if (n.kind === 'outland') continue;
      const c = s.cities[n.id];
      if (!c) continue;
      if (z < 1.0 && !n.major && !n.detail) continue;
      const [x, y] = nodePt(n.id);
      const col = s.factions[c.controller]?.color ?? '#999';
      const sz = n.kind === 'region' ? 6.5 : n.major ? 5.6 : n.kind === 'city' ? 4.4 : 3.8;
      const isSel = this.view.selected === n.id, isHover = this.view.hover === n.id;
      if (isSel) {
        const pulse = 3 + Math.sin(time / 260) * 1.5;
        g.strokeStyle = 'rgba(181,52,42,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.arc(x, y, sz + 7 + pulse, 0, Math.PI * 2); g.stroke();
      }
      g.lineWidth = isHover ? 1.8 : 1.1;
      g.strokeStyle = INK;
      g.fillStyle = col;
      switch (n.kind) {
        case 'pass':
          // 关：门楼
          g.beginPath(); g.rect(x - sz, y - sz * 0.6, sz * 2, sz * 1.3); g.fill(); g.stroke();
          g.beginPath(); g.moveTo(x - sz * 1.3, y - sz * 0.6); g.lineTo(x, y - sz * 1.4); g.lineTo(x + sz * 1.3, y - sz * 0.6); g.closePath(); g.fill(); g.stroke();
          break;
        case 'ferry': case 'port':
          g.beginPath(); g.arc(x, y, sz, 0, Math.PI * 2); g.fill(); g.stroke();
          if (z >= 1.4) { g.strokeStyle = '#f5ecd7'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(x, y - sz * 0.6); g.lineTo(x, y + sz * 0.6); g.moveTo(x - sz * 0.5, y + sz * 0.2); g.quadraticCurveTo(x, y + sz * 0.9, x + sz * 0.5, y + sz * 0.2); g.stroke(); }
          break;
        case 'region':
          g.beginPath(); g.rect(x - sz, y - sz, sz * 2, sz * 2); g.fill(); g.stroke();
          g.beginPath(); g.rect(x - sz + 2, y - sz + 2, sz * 2 - 4, sz * 2 - 4); g.strokeStyle = 'rgba(245,236,215,0.8)'; g.lineWidth = 0.8; g.stroke();
          break;
        default:
          // 府城：双框方印
          g.beginPath(); g.rect(x - sz, y - sz, sz * 2, sz * 2); g.fill(); g.stroke();
          if (z >= 1.3) { g.beginPath(); g.rect(x - sz * 0.45, y - sz * 0.45, sz * 0.9, sz * 0.9); g.strokeStyle = 'rgba(245,236,215,0.85)'; g.lineWidth = 0.8; g.stroke(); }
      }
      // 所奉政权的旗记
      if (z >= 1.3 || n.major) {
        const pol = POLITIES[s.factions[c.controller]?.polity ?? 'none'];
        if (pol && pol.mark) drawFlag(g, x + sz * 0.6, y - sz, pol.flag, '#f3e9d2', pol.mark, 0.62, INK);
      }
      // 城防（放大后）
      if (z >= 2.2 && (n.kind === 'city' || n.kind === 'region')) {
        g.strokeStyle = 'rgba(42,33,24,0.6)'; g.lineWidth = 1.4;
        g.beginPath(); g.arc(x, y, sz + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * c.wall / 100); g.stroke();
      }
    }
  }

  drawArmies(g: CanvasRenderingContext2D, s: GameState, _time: number) {
    this.armyHits = [];
    const byNode: Record<string, Army[]> = {};
    for (const a of Object.values(s.armies)) { if (!visibleArmy(s, a)) continue; const k = a.progress > 0 ? a.id : a.location; (byNode[k] ??= []).push(a); }
    const z = this.cam.z;
    const scale = Math.max(0.75, Math.min(1.4, 1.25 / Math.sqrt(z)));
    for (const [, list] of Object.entries(byNode)) {
      list.sort((a, b) => a.id.localeCompare(b.id));
      list.forEach((a, i) => {
        const [bx, by] = armyPt(a);
        const ang = -Math.PI / 2 - 0.9 + i * 0.75;
        const off = a.progress > 0 ? 0 : 13;
        const x = bx + Math.cos(ang) * off * (1 + i * 0.15), y = by + Math.sin(ang) * off * 0.8 - 2;
        const f = s.factions[a.faction];
        const pol = POLITIES[f?.polity ?? 'none'];
        const cmd = s.chars[a.commander];
        const mark = (cmd?.name ?? f?.short ?? '?').slice(0, 1);
        const sel = this.view.selectedArmy === a.id;
        g.save();
        g.translate(x, y); g.scale(scale, scale);
        if (sel) { g.fillStyle = 'rgba(255,240,200,0.8)'; g.beginPath(); g.arc(0, -6, 13, 0, Math.PI * 2); g.fill(); }
        // 旗杆
        g.strokeStyle = INK; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -16); g.stroke();
        drawFlag(g, 0, -16, pol?.flag ?? 'rect', f?.color ?? '#888', mark, 1.15, INK);
        // 兵力条
        const w = Math.min(18, 4 + a.troops / 5000);
        g.fillStyle = 'rgba(42,33,24,0.85)'; g.fillRect(-w / 2, 7, w, 2.6);
        g.fillStyle = a.morale > 50 ? '#e8d9a8' : a.morale > 25 ? '#d99a4e' : '#c0392b';
        g.fillRect(-w / 2, 7, w * Math.min(1, a.morale / 100), 2.6);
        g.restore();
        this.armyHits.push({ id: a.id, x, y: y - 8 * scale, r: 12 * scale });
      });
    }
  }

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
        g.fillStyle = 'rgba(50,30,20,0.42)';
        g.textAlign = 'center';
        g.fillText(fac.name, sx, sy + 22);
      }
    }
    // 河名
    if (z >= 0.9) {
      g.font = `italic 500 ${Math.round(11 + z * 1.5)}px "Noto Serif SC", serif`;
      g.fillStyle = 'rgba(40,85,95,0.85)'; g.textAlign = 'center';
      for (const r of RIVERS) if (r.label) { const [sx, sy] = worldToScreen(this.cam, this.w, this.h, ...P(r.label[0], r.label[1])); g.fillText(r.name, sx, sy); }
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
      const gap = 8 * Math.min(2, z) * 0.7 + 4;
      const cands: [number, number][] = [[sx + gap, sy + 1], [sx - gap - tw, sy + 1], [sx - tw / 2, sy - gap - size / 2], [sx - tw / 2, sy + gap + size / 2]];
      let tx = cands[0][0], ty = cands[0][1], ok = false;
      for (const [cx, cy] of cands) {
        const rect: [number, number, number, number] = [cx - 2, cy - size / 2 - 1, tw + 4, th + 2];
        if (prio(n.id) <= 1 || !placed.some(r => r[0] < rect[0] + rect[2] && rect[0] < r[0] + r[2] && r[1] < rect[1] + rect[3] && rect[1] < r[1] + r[3])) { tx = cx; ty = cy; placed.push(rect); ok = true; break; }
      }
      if (!ok) continue;
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(240,230,205,0.9)'; g.lineJoin = 'round';
      g.strokeText(label, tx, ty);
      g.fillStyle = INK; g.fillText(label, tx, ty);
      // 放大后：驻军
      if (z >= 2.6) {
        const c = s.cities[n.id];
        const own = c.controller === s.player || topOfSafe(s, c.controller) === s.player;
        const txt = own ? `驻 ${fmtTroops(c.garrison)}` : `驻 ${roughT(c.garrison)}`;
        g.font = `500 ${size - 3}px "Noto Serif SC", serif`;
        g.fillStyle = 'rgba(60,40,25,0.85)';
        g.strokeText(txt, tx, ty + size);
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
    const [wx, wy] = screenToWorld(this.cam, this.w, this.h, sx, sy);
    const z = Math.max(this.minZoom(), Math.min(4, this.cam.z * factor));
    this.cam.z = z;
    const [nx, ny] = screenToWorld(this.cam, this.w, this.h, sx, sy);
    this.cam.x += wx - nx; this.cam.y += wy - ny;
    this.clamp();
  }
  pan(dx: number, dy: number) { this.cam.x -= dx / this.cam.z; this.cam.y -= dy / this.cam.z; this.clamp(); }
  minZoom() { return Math.max(this.w / WORLD_W, this.h / WORLD_H, 0.5); }
  clamp() {
    this.cam.z = Math.max(this.minZoom(), this.cam.z);
    const hw = this.w / 2 / this.cam.z, hh = this.h / 2 / this.cam.z;
    this.cam.x = Math.max(hw, Math.min(WORLD_W - hw, this.cam.x));
    this.cam.y = Math.max(hh, Math.min(WORLD_H - hh, this.cam.y));
  }
  focus(id: string, z?: number) {
    const [x, y] = nodePt(id);
    this.cam.x = x; this.cam.y = y;
    if (z) this.cam.z = z;
    this.clamp();
  }
}

/* ---------- 工具 ---------- */
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

function drawPeak(g: CanvasRenderingContext2D, x: number, y: number, s: number, v: number) {
  const grd = g.createLinearGradient(x, y - s, x, y + s * 0.3);
  grd.addColorStop(0, v > 0.5 ? '#5f8577' : '#6c8f73');
  grd.addColorStop(1, 'rgba(160,170,130,0.35)');
  g.fillStyle = grd;
  g.beginPath();
  g.moveTo(x - s * 1.1, y + s * 0.3);
  g.quadraticCurveTo(x - s * 0.6, y - s * 0.2, x - s * 0.35, y - s * 0.55);
  g.quadraticCurveTo(x - s * 0.1, y - s * 1.05, x + s * 0.05, y - s * 0.95);
  g.quadraticCurveTo(x + s * 0.35, y - s * 0.75, x + s * 0.5, y - s * 0.35);
  g.quadraticCurveTo(x + s * 0.8, y - s * 0.05, x + s * 1.1, y + s * 0.3);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(40,40,30,0.75)'; g.lineWidth = 0.7; g.stroke();
  // 皴笔
  g.strokeStyle = 'rgba(40,50,40,0.35)'; g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(x - s * 0.1, y - s * 0.8); g.quadraticCurveTo(x - s * 0.25, y - s * 0.3, x - s * 0.15, y + s * 0.2); g.stroke();
  g.beginPath(); g.moveTo(x + s * 0.3, y - s * 0.6); g.quadraticCurveTo(x + s * 0.25, y - s * 0.2, x + s * 0.4, y + s * 0.2); g.stroke();
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
