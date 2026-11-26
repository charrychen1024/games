/* 攻城战画面：纵深透视（Canvas 2D 自绘）。
 * 攻城时镜头在攻方阵后，望向城门；守城时镜头在城头身后，望向城外。城后的房屋不画。
 * 画面只读模拟状态（core/siege.ts），不改它。共用部分在 rtView.ts。 */
import { SEGMENTS, GATE_SEG, WALL_Y, segX, segName, type SiegeSim, type SUnit } from '../core/siege';
import { RtView, type ViewOpts, type Camera } from './rtView';
import { ink, tint, mkRnd, tree, hut, grass, eave, pagoda, tent, puff } from './ink';
export type { ViewOpts } from './rtView';

const WALL_H = 78;   // 城墙高（世界单位）
const WALK = 20;     // 墙顶马道宽（世界单位，向城内）
const BASTION = 14;  // 马面凸出城墙之外的进深

export class SiegeView extends RtView {
  sim: SiegeSim;
  hoverSeg: number | null = null;

  constructor(parent: HTMLElement, sim: SiegeSim, o: ViewOpts) {
    super(parent, o);
    this.sim = sim;
    this.flipDef = false;
  }
  cam(): Camera { return this.o.me === 'att' ? { near: 1340, far: 0, k: 0.25, kx: 1.2, ky: 1 } : { near: 0, far: 400, k: 0.2, kx: 1.05, ky: 1.05 }; }

  /** 一营画在哪里：攻方入城、登城之后，画在缺口、城头上，不再被城墙挡住；巷战时城中守军也现出来 */
  where(u: SUnit): { x: number; y: number; z: number; note?: string } | null {
    const sim = this.sim;
    const attIn = sim.units.filter(a => a.side === 'att' && a.troops >= 1 && a.state === 'inside');
    if (u.side === 'def' && u.state === 'wall') return { x: u.x, y: WALL_Y, z: WALL_H };
    if (u.side === 'att' && u.state === 'wall') return { x: segX(u.seg ?? GATE_SEG), y: WALL_Y, z: WALL_H, note: '登城' };
    if (this.o.me === 'att') {
      if (u.side === 'att' && u.state === 'inside') { const k = attIn.indexOf(u); return { x: segX(u.seg ?? GATE_SEG) + (k % 2 ? 38 : -38) * Math.ceil(k / 2), y: WALL_Y + 8, z: 0, note: '入城巷战' }; }
      const insideDef = u.side === 'def' && (u.state === 'inside' || (u.state === 'move' && u.y < WALL_Y));
      if (insideDef) {
        if (!attIn.length) return null;          // 平时看不见城里
        return { x: segX(attIn[0].seg ?? GATE_SEG) + 70, y: WALL_Y + 4, z: 0, note: '巷战' };
      }
    }
    return { x: u.x, y: u.y, z: 0 };
  }

  /* ---------- 背景（缓存）：水墨长卷 ---------- */
  background(): HTMLCanvasElement {
    const key = `${this.W}x${this.H}${this.o.me}${this.sim.weather}`;
    if (this.bg && this.bgKey === key) return this.bg;
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const { W } = this;
    const seed = this.sim.seed ?? 7;
    this.skyAndHills(g, this.sim.weather, 0, seed);
    const r = mkRnd(seed * 17 + 3);
    const att = this.o.me === 'att';
    this.groundWash(g, seed);
    // 城外田畴（避开大道与护城河）
    this.fields(g, r, -1500, 2500, 150, 1150, (x) => Math.abs(x - 500) < 90);
    if (att) this.cityBeyond(g, r); else this.horizonWoods(g, r);
    if (!att) this.cityStreets(g, r);
    // 通往城门的大道：淡赭，墨笔勾两边
    const road = [this.P(430, 1150), this.P(570, 1150), this.P(535, 134), this.P(465, 134)];
    g.fillStyle = 'rgba(180,155,110,0.42)'; g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.strokeStyle = ink(0.7, 0.3); g.lineWidth = 1;
    g.beginPath(); g.moveTo(road[0][0], road[0][1]); g.lineTo(road[3][0], road[3][1]); g.moveTo(road[1][0], road[1][1]); g.lineTo(road[2][0], road[2][1]); g.stroke();
    // 护城河：花青晕染，岸一笔焦墨，水面几道波
    const m = [this.P(-1500, 134), this.P(2500, 134), this.P(2500, 114), this.P(-1500, 114)];
    g.fillStyle = 'rgba(80,110,120,0.55)'; g.beginPath(); m.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.strokeStyle = ink(0.85, 0.6); g.lineWidth = 1.3;
    for (const yy of [114, 134]) { const [a1, b1] = this.P(-1500, yy), [a2, b2] = this.P(2500, yy); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
    g.strokeStyle = 'rgba(235,240,235,0.45)'; g.lineWidth = 0.8;
    for (let k = 0; k < 40; k++) { const [sx, sy, sc] = this.P(-200 + r() * 1400, 118 + r() * 12); g.beginPath(); g.moveTo(sx - 10 * sc * 3, sy); g.quadraticCurveTo(sx, sy - 2 * sc * 3, sx + 10 * sc * 3, sy); g.stroke(); }
    // 吊桥（城门前）
    const br = [this.P(470, 136), this.P(530, 136), this.P(530, 112), this.P(470, 112)];
    g.fillStyle = 'rgba(120,90,55,0.85)'; g.beginPath(); br.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.strokeStyle = ink(0.9, 0.7); g.lineWidth = 1; g.stroke();
    // 城外草木、村舍；守城时远处是敌营
    for (let k = 0; k < 120; k++) { const x = -400 + r() * 1800, y = 150 + r() * 1000; if (Math.abs(x - 500) < 80) continue; const [sx, sy, sc] = this.P(x, y); grass(g, sx, sy, sc * 2, r, 0.25 + r() * 0.2); }
    const props: { x: number; y: number; k: 'pine' | 'willow' | 'bare' | 'grove' | 'hut' | 'tent' }[] = [];
    for (let k = 0; k < 12; k++) props.push({ x: k % 2 ? 1080 + r() * 260 : -80 - r() * 260, y: 180 + r() * 900, k: (['willow', 'grove', 'bare', 'pine'] as const)[Math.floor(r() * 4)] });
    for (let k = 0; k < 3; k++) props.push({ x: (r() < 0.5 ? -160 : 1160) + (r() - 0.5) * 120, y: 400 + r() * 400, k: 'hut' });
    for (let k = 0; k < 10; k++) props.push({ x: k % 2 ? 1050 + r() * 120 : -50 - r() * 120, y: 150 + r() * 60, k: 'willow' });
    if (!att) for (let k = 0; k < 22; k++) props.push({ x: -150 + (k % 11) * 130 + r() * 40, y: 1000 + Math.floor(k / 11) * 70 + r() * 30, k: 'tent' });
    props.sort((a, b) => this.depth(b.y) - this.depth(a.y));
    const foe = tint(this.o.look.att.color, 0.15);
    for (const p of props) {
      const [sx, sy, sc] = this.P(p.x, p.y);
      if (sx < -80 || sx > W + 80) continue;
      if (p.k === 'hut') hut(g, sx, sy, sc * 3.2, r, 0.9);
      else if (p.k === 'tent') tent(g, sx, sy, sc * 3.4, foe, p.x);
      else tree(g, sx, sy, sc * 4.5, p.k, r, 0.85);
    }
    this.bg = c; this.bgKey = key;
    return c;
  }
  /** 攻城视角：墙后露出城中屋脊、鼓楼与一座塔（被城墙挡住下半） */
  cityBeyond(g: CanvasRenderingContext2D, r: () => number) {
    const roofs: [number, number, number][] = [];
    for (let k = 0; k < 70; k++) roofs.push([-150 + r() * 1300, 10 + r() * 80, 0.9 + r() * 0.8]);
    roofs.sort((a, b) => this.depth(b[1]) - this.depth(a[1]));
    const px = r() < 0.5 ? 260 + r() * 120 : 620 + r() * 120;
    const pg = this.P(px, 20, WALL_H * 0.6);
    pagoda(g, pg[0], pg[1], pg[2] * 4.2, 0.9);
    for (const [x, y, k] of roofs) {
      const [sx, sy, sc] = this.P(x, y, WALL_H * (1.02 + (90 - y) / 90 * 0.12));
      const w = 46 * sc * 3 * k;
      g.fillStyle = 'rgba(214,200,165,0.95)'; g.fillRect(sx - w * 0.3, sy - 2, w * 0.6, 14 * sc * 3);
      g.strokeStyle = ink(0.8, 0.5); g.lineWidth = 0.7; g.strokeRect(sx - w * 0.3, sy - 2, w * 0.6, 14 * sc * 3);
      eave(g, sx, sy, w, 10 * sc * 3 * k, 0.6 + r() * 0.25);
    }
    for (let k = 0; k < 8; k++) { const [sx, sy, sc] = this.P(-100 + r() * 1200, 20 + r() * 60, WALL_H * 0.5); tree(g, sx, sy, sc * 3.6, 'grove', r, 0.7); }
  }
  /** 守城视角：城内近处是石板街与两侧屋檐 */
  cityStreets(g: CanvasRenderingContext2D, r: () => number) {
    const y1 = WALL_Y - WALK - 18;
    const q = [this.P(-1500, -400), this.P(2500, -400), this.P(2500, y1), this.P(-1500, y1)];
    g.fillStyle = 'rgba(170,160,135,0.35)'; g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    g.strokeStyle = ink(0.6, 0.12); g.lineWidth = 0.8;
    for (let y = -300; y < y1; y += 14) { const [a1, b1] = this.P(-1500, y), [a2, b2] = this.P(2500, y); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
    for (let x = -600; x <= 1600; x += 40) { const [a1, b1] = this.P(x, -300), [a2, b2] = this.P(x, y1); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
    // 两侧民居（只在画面边上，免得挡住城下预备队）
    for (const xx of [-30, 1030]) for (let k = 0; k < 2; k++) { const [sx, sy, sc] = this.P(xx + (xx < 500 ? -k * 90 : k * 90), 30 - k * 30); hut(g, sx, sy, sc * 3.4, r, 0.95); }
  }

  /* ---------- 城墙：攻城看外侧（马面、垛口、城门楼），守城看内侧（马道坡、墙顶） ---------- */
  /** 世界坐标多边形 */
  polyW(g: CanvasRenderingContext2D, pts: [number, number, number][], fill: string | CanvasGradient, stroke?: string, lw = 1) {
    g.beginPath(); pts.forEach(([x, y, z], i) => { const [sx, sy] = this.P(x, y, z); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); }); g.closePath();
    g.fillStyle = fill; g.fill();
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
  }
  /** 一面墙（竖直，y 固定）上的青砖：淡墨横缝、错缝竖线 */
  bricks(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, z0: number, z1: number, rows: number, a: number) {
    g.strokeStyle = ink(0.6, a); g.lineWidth = 0.6;
    for (let k = 1; k < rows; k++) {
      const z = z0 + (z1 - z0) * k / rows;
      const [ax, ay] = this.P(x0, y, z), [bx, by] = this.P(x1, y, z);
      g.beginPath(); g.moveTo(ax, ay); g.lineTo(bx, by); g.stroke();
      const n = Math.max(4, Math.round(Math.abs(bx - ax) / 22));
      for (let c = 0; c < n; c++) {
        const x = x0 + (x1 - x0) * (c + (k % 2) * 0.5) / n;
        const [px, py] = this.P(x, y, z), [, qy] = this.P(x, y, z - (z1 - z0) / rows);
        g.beginPath(); g.moveTo(px, py); g.lineTo(px, qy); g.stroke();
      }
    }
  }
  /** 垛口：沿 y 一线，一凸一凹；back 为从城内看（只见背面） */
  merlons(g: CanvasRenderingContext2D, x0: number, x1: number, y: number, back: boolean, skip?: (x: number) => boolean) {
    const mw = 9, gap = 7, mh = 10;
    for (let x = x0 + 2; x < x1 - mw * 0.5; x += mw + gap) {
      if (skip?.(x + mw / 2)) continue;
      const face: [number, number, number][] = [[x, y, WALL_H], [x + mw, y, WALL_H], [x + mw, y, WALL_H + mh], [x, y, WALL_H + mh]];
      const topQ: [number, number, number][] = [[x, y, WALL_H + mh], [x + mw, y, WALL_H + mh], [x + mw, y - 4, WALL_H + mh], [x, y - 4, WALL_H + mh]];
      this.polyW(g, topQ, 'rgba(200,192,170,0.95)');
      this.polyW(g, face, back ? 'rgba(128,122,108,0.95)' : 'rgba(160,152,134,0.97)', ink(0.85, 0.7), 0.8);
      if (!back) { const [hx, hy, hs] = this.P(x + mw / 2, y, WALL_H + mh * 0.45); g.fillStyle = ink(0.95, 0.75); g.fillRect(hx - hs * 2.4, hy - hs * 3, hs * 4.8, hs * 6); }
    }
  }
  drawWall(g: CanvasRenderingContext2D) {
    const sim = this.sim, att = this.o.me === 'att';
    const segW = 1000 / SEGMENTS;
    const Y = WALL_Y, Yi = WALL_Y - WALK;   // 外缘、内缘
    for (let s = 0; s < SEGMENTS; s++) {
      const seg = sim.segs[s];
      const x0 = s * segW, x1 = x0 + segW;
      const f = seg.hp / seg.max;
      const breach = seg.hp <= 0;
      const mid = (x0 + x1) / 2, bw = segW * 0.42;
      const inBreach = (x: number) => breach && Math.abs(x - mid) < bw;
      const faceY = att ? Y : Yi;
      const face = g.createLinearGradient(0, this.P(mid, faceY, WALL_H)[1], 0, this.P(mid, faceY, 0)[1]);
      face.addColorStop(0, att ? '#a7a08d' : '#b4ad99'); face.addColorStop(1, att ? '#7f7867' : '#8d8674');
      if (!att) this.merlons(g, x0, x1, Y, true, inBreach);
      // 墙顶马道
      this.polyW(g, [[x0, Y, WALL_H], [x1, Y, WALL_H], [x1, Yi, WALL_H], [x0, Yi, WALL_H]], 'rgba(196,186,160,0.97)', ink(0.8, 0.5), 0.8);
      if (att) {
        // 内侧女墙（矮墙）
        this.polyW(g, [[x0, Yi, WALL_H], [x1, Yi, WALL_H], [x1, Yi, WALL_H + 4], [x0, Yi, WALL_H + 4]], 'rgba(150,142,124,0.9)');
      }
      // 墙面
      this.polyW(g, [[x0, faceY, 0], [x1, faceY, 0], [x1, faceY, WALL_H], [x0, faceY, WALL_H]], face, ink(0.85, 0.6), 1);
      this.bricks(g, x0, x1, faceY, WALL_H * 0.14, WALL_H, 10, att ? 0.2 : 0.14);
      // 条石基座与墙根苔点
      this.polyW(g, [[x0, faceY, 0], [x1, faceY, 0], [x1, faceY, WALL_H * 0.14], [x0, faceY, WALL_H * 0.14]], att ? 'rgba(140,128,104,0.95)' : 'rgba(150,140,118,0.95)', ink(0.8, 0.5), 0.8);
      let sd = s * 97 + 13; const rr = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
      for (let k = 0; k < 18; k++) { const [mx, my, ms] = this.P(x0 + rr() * segW, faceY, rr() * WALL_H * 0.25); g.fillStyle = ink(0.8, 0.25 + rr() * 0.25); g.beginPath(); g.ellipse(mx, my, ms * 4, ms * 2.5, 0, 0, Math.PI * 2); g.fill(); }
      // 破损：焦墨裂缝；归零则塌出缺口、碎砖堆
      if (f < 0.85) {
        g.strokeStyle = ink(1, 0.85); g.lineWidth = 1.5;
        for (let k = 0; k < (1 - f) * 16; k++) {
          const x = x0 + rr() * segW, z = WALL_H * (0.25 + rr() * 0.7);
          const p1 = this.P(x, faceY, z), p2 = this.P(x - 6 + rr() * 12, faceY, z - WALL_H * 0.15), p3 = this.P(x - 4 + rr() * 8, faceY, z - WALL_H * 0.3);
          g.beginPath(); g.moveTo(p1[0], p1[1]); g.lineTo(p2[0], p2[1]); g.lineTo(p3[0], p3[1]); g.stroke();
        }
      }
      if (breach) {
        this.polyW(g, [[mid - bw, faceY, WALL_H + 1], [mid - bw * 0.45, faceY, WALL_H * 0.15], [mid + bw * 0.45, faceY, WALL_H * 0.15], [mid + bw, faceY, WALL_H + 1]], ink(0.9, 0.92));
        for (let k = 0; k < 22; k++) { const [px, py, ps] = this.P(mid - bw + (k / 22) * bw * 2, faceY + (att ? 6 : -6), WALL_H * 0.08 * Math.sin(k)); g.fillStyle = k % 2 ? '#9a9180' : '#77705f'; g.beginPath(); g.ellipse(px, py, 5 * ps * 3, 3 * ps * 3, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink(0.8, 0.6); g.lineWidth = 0.6; g.stroke(); }
      }
      if (att) this.merlons(g, x0, x1, Y, false, inBreach);
      // 守城视角：城门两侧各一道登城马道坡
      if (!att && (s === GATE_SEG - 1 || s === GATE_SEG + 1)) {
        const dir = s < GATE_SEG ? 1 : -1, xa = s < GATE_SEG ? x0 + 30 : x1 - 30, xb = xa + dir * 120;
        const ramp: [number, number, number][] = [[xa, Yi, 0], [xb, Yi, WALL_H], [xb, Yi - 16, WALL_H], [xa, Yi - 16, 0]];
        this.polyW(g, [[xa, Yi - 16, 0], [xb, Yi - 16, WALL_H], [xb, Yi - 16, 0]], 'rgba(128,120,102,0.97)', ink(0.85, 0.75), 1.2);
        this.polyW(g, ramp, 'rgba(160,150,126,0.97)', ink(0.85, 0.75), 1.2);
        g.strokeStyle = ink(0.7, 0.3); g.lineWidth = 0.7;
        for (let t = 0.1; t < 1; t += 0.1) { const xx = xa + (xb - xa) * t, zz = WALL_H * t; const [a1, b1] = this.P(xx, Yi, zz), [a2, b2] = this.P(xx, Yi - 16, zz); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
      }
      // 城门：砖券门洞、包铁门；被撞开则门扇倒伏
      if (s === GATE_SEG) this.drawGate(g, mid, faceY, att);
      // 选段高亮
      if (this.hoverSeg === s) this.polyW(g, [[x0 + 2, faceY, 0], [x1 - 2, faceY, 0], [x1 - 2, faceY, WALL_H + 12], [x0 + 2, faceY, WALL_H + 12]], 'rgba(255,214,120,0.12)', 'rgba(200,120,40,0.95)', 3);
    }
    // 马面与敌楼（攻城视角，墙段交界处凸出）
    if (att) for (let k = 1; k < SEGMENTS; k++) this.drawBastion(g, k * segW);
    // 城门楼
    const gx = segX(GATE_SEG);
    const [tx, ty, ts] = this.P(gx, att ? Y - WALK * 0.5 : Y - WALK * 0.5, WALL_H);
    const tw = segW * 0.62 * ts * this.W * 1.1 / 500;
    if (att) this.drawTower(g, tx, ty, tw, tw * 0.62);
    else { g.globalAlpha = 0.9; this.drawTower(g, tx, ty, tw * 0.55, tw * 0.3); g.globalAlpha = 1; }
    // 段名与城防条
    for (let s = 0; s < SEGMENTS; s++) {
      const seg = sim.segs[s], f = seg.hp / seg.max;
      const x0 = s * segW, x1 = x0 + segW;
      const [L] = this.P(x0, Y, WALL_H), [R] = this.P(x1, Y, WALL_H);
      const barW = Math.abs(R - L) * 0.6, cx = (L + R) / 2, bx0 = cx - barW / 2;
      const [, by] = this.P((x0 + x1) / 2, Y, WALL_H + 12);
      const by0 = by - (s === GATE_SEG && att ? tw * 0.75 : 14);
      g.fillStyle = 'rgba(20,14,8,0.75)'; g.fillRect(bx0 - 1, by0 - 1, barW + 2, 6);
      g.fillStyle = f > 0.6 ? '#7fb26c' : f > 0.3 ? '#d99a3c' : '#c8422f'; g.fillRect(bx0, by0, barW * Math.max(0, f), 4);
      if (s === GATE_SEG) { const gf = Math.max(0, sim.gate.hp / sim.gate.max); g.fillStyle = 'rgba(20,14,8,0.75)'; g.fillRect(bx0 - 1, by0 + 6, barW + 2, 5); g.fillStyle = '#b8954a'; g.fillRect(bx0, by0 + 7, barW * gf, 3); }
    }
  }
  drawGate(g: CanvasRenderingContext2D, gx: number, y: number, att: boolean) {
    const sim = this.sim;
    const gw = 26, gh = WALL_H * 0.55;
    const arch = (w: number, h: number): [number, number, number][] => {
      const pts: [number, number, number][] = [[gx - w, y, 0]];
      for (let t = 0; t <= 1.0001; t += 0.1) { const a = Math.PI * (1 - t); pts.push([gx + Math.cos(a) * w, y, h + Math.sin(a) * w * 0.9]); }
      pts.push([gx + w, y, 0]);
      return pts;
    };
    this.polyW(g, arch(gw + 4, gh), 'rgba(120,112,96,0.97)', ink(0.9, 0.8), 1.2);
    const broken = sim.gate.hp <= 0, gf = sim.gate.hp / sim.gate.max;
    this.polyW(g, arch(gw, gh), broken ? ink(1, 0.95) : att ? '#6b4a2c' : '#4e3622', ink(0.95, 0.9), 1);
    if (!broken) {
      const [a1, b1] = this.P(gx, y, 0), [, b2] = this.P(gx, y, gh + gw * 0.9);
      g.strokeStyle = ink(1, 0.8); g.lineWidth = 1.2; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a1, b2); g.stroke();
      if (att) { g.fillStyle = '#c9a457'; for (let r = 0; r < 5; r++) for (let c = -2; c <= 2; c++) if (c) { const [nx, ny, ns] = this.P(gx + c * gw * 0.38, y, gh * 0.12 + r * gh * 0.2); g.beginPath(); g.arc(nx, ny, Math.max(0.8, ns * 3), 0, Math.PI * 2); g.fill(); } }
      if (gf < 0.6) { g.strokeStyle = 'rgba(250,230,190,0.55)'; g.lineWidth = 1; for (let k = 0; k < (1 - gf) * 8; k++) { const [p1x, p1y] = this.P(gx - gw * 0.6 + k * 4, y, gh * 0.8), [p2x, p2y] = this.P(gx - gw * 0.4 + k * 3, y, gh * 0.3); g.beginPath(); g.moveTo(p1x, p1y); g.lineTo(p2x, p2y); g.stroke(); } }
    } else {
      this.polyW(g, [[gx - gw, y, 0], [gx - gw * 2.2, y + (att ? 10 : -10), 0], [gx - gw * 2.1, y + (att ? 6 : -6), 3], [gx - gw, y, gh * 0.3]], '#4a2e18', ink(0.9, 0.8), 1);
    }
  }
  /** 马面：凸出墙外的墩台，台上一座小敌楼 */
  drawBastion(g: CanvasRenderingContext2D, x: number) {
    const hw = 22, Y = WALL_Y, Yo = WALL_Y + BASTION, H = WALL_H + 2;
    const side = x < 500 ? x + hw : x - hw;     // 朝画面中央的一侧看得见
    this.polyW(g, [[side, Y, 0], [side, Yo, 0], [side, Yo, H], [side, Y, H]], '#857e6c', ink(0.85, 0.6), 0.9);
    this.polyW(g, [[x - hw, Yo, H], [x + hw, Yo, H], [x + hw, Y, H], [x - hw, Y, H]], 'rgba(196,186,160,0.97)', ink(0.8, 0.5), 0.8);
    const fg = g.createLinearGradient(0, this.P(x, Yo, H)[1], 0, this.P(x, Yo, 0)[1]);
    fg.addColorStop(0, '#aaa390'); fg.addColorStop(1, '#827b6a');
    this.polyW(g, [[x - hw, Yo, 0], [x + hw, Yo, 0], [x + hw, Yo, H], [x - hw, Yo, H]], fg, ink(0.85, 0.65), 1);
    this.bricks(g, x - hw, x + hw, Yo, H * 0.14, H, 10, 0.18);
    this.polyW(g, [[x - hw, Yo, 0], [x + hw, Yo, 0], [x + hw, Yo, H * 0.14], [x - hw, Yo, H * 0.14]], 'rgba(140,128,104,0.95)', ink(0.8, 0.5), 0.8);
    this.merlons(g, x - hw, x + hw, Yo, false);
    // 敌楼：小屋一间、墨瓦单檐
    const [bx, by, bs] = this.P(x, (Y + Yo) / 2, H + 8);
    const w = hw * 1.5 * bs * this.W * 1.1 / 500;
    g.fillStyle = 'rgba(205,190,150,0.97)'; g.fillRect(bx - w * 0.32, by - w * 0.28, w * 0.64, w * 0.28);
    g.strokeStyle = ink(0.85, 0.8); g.lineWidth = 0.9; g.strokeRect(bx - w * 0.32, by - w * 0.28, w * 0.64, w * 0.28);
    g.fillStyle = ink(0.95, 0.8); for (let k = -1; k <= 1; k++) g.fillRect(bx + k * w * 0.18 - w * 0.04, by - w * 0.2, w * 0.08, w * 0.1);
    eave(g, bx, by - w * 0.26, w * 0.95, w * 0.22, 0.85);
  }
  /** 城门楼：台基、两层楼阁、重檐歇山，脊上一面旗 */
  drawTower(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const look = this.o.look.def;
    const col = (k: number) => `rgba(${150 - k * 30},${70 - k * 15},${52 - k * 10},0.95)`;
    // 一层
    const h1 = h * 0.42, w1 = w * 0.78;
    g.fillStyle = 'rgba(214,198,160,0.97)'; g.fillRect(x - w1 / 2, y - h1, w1, h1);
    for (let k = 0; k <= 6; k++) { g.fillStyle = col(1); g.fillRect(x - w1 / 2 + k * w1 / 6 - w * 0.012, y - h1, w * 0.024, h1); }
    g.strokeStyle = ink(0.85, 0.8); g.lineWidth = 1; g.strokeRect(x - w1 / 2, y - h1, w1, h1);
    g.fillStyle = ink(0.9, 0.55); for (let k = 0; k < 6; k++) g.fillRect(x - w1 / 2 + k * w1 / 6 + w1 * 0.035, y - h1 * 0.78, w1 / 6 - w1 * 0.07, h1 * 0.38);
    // 下檐
    eave(g, x, y - h1 + h * 0.02, w * 1.12, h * 0.2, 0.88);
    // 平座栏杆与二层
    const y2 = y - h1 - h * 0.12, h2 = h * 0.3, w2 = w * 0.6;
    g.strokeStyle = ink(0.85, 0.7); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - w2 * 0.6, y2); g.lineTo(x + w2 * 0.6, y2); g.stroke();
    for (let k = 0; k <= 10; k++) { const xx = x - w2 * 0.6 + k * w2 * 0.12; g.beginPath(); g.moveTo(xx, y2); g.lineTo(xx, y2 - h * 0.04); g.stroke(); }
    g.fillStyle = 'rgba(214,198,160,0.97)'; g.fillRect(x - w2 / 2, y2 - h2, w2, h2);
    for (let k = 0; k <= 4; k++) { g.fillStyle = col(1); g.fillRect(x - w2 / 2 + k * w2 / 4 - w * 0.01, y2 - h2, w * 0.02, h2); }
    g.strokeStyle = ink(0.85, 0.8); g.lineWidth = 1; g.strokeRect(x - w2 / 2, y2 - h2, w2, h2);
    // 上檐（歇山）
    eave(g, x, y2 - h2 + h * 0.02, w * 0.9, h * 0.32, 0.92);
    // 正脊、鸱吻
    const ry = y2 - h2 - h * 0.3;
    g.strokeStyle = ink(1); g.lineWidth = Math.max(1.5, h * 0.03); g.beginPath(); g.moveTo(x - w * 0.17, ry); g.lineTo(x + w * 0.17, ry); g.stroke();
    for (const d of [-1, 1]) { g.fillStyle = ink(1); g.beginPath(); g.moveTo(x + d * w * 0.17, ry + 1); g.quadraticCurveTo(x + d * w * 0.2, ry - h * 0.08, x + d * w * 0.15, ry - h * 0.1); g.lineTo(x + d * w * 0.15, ry); g.closePath(); g.fill(); }
    // 旗
    const fy = ry, wv = Math.sin(this.now / 300) * 2, ph = h * 0.55;
    g.strokeStyle = ink(0.95); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy - ph); g.stroke();
    g.fillStyle = tint(this.sim.over?.winner === 'att' && this.sim.over.outcome !== 'retreat' ? this.o.look.att.color : look.color, 0.15);
    g.beginPath(); g.moveTo(x, fy - ph); g.lineTo(x + ph * 0.6, fy - ph * 0.95 + wv); g.lineTo(x + ph * 0.6, fy - ph * 0.6 + wv); g.lineTo(x, fy - ph * 0.64); g.closePath(); g.fill();
    g.strokeStyle = ink(0.9, 0.8); g.lineWidth = 0.8; g.stroke();
  }
  /** 城防受损的墙段冒烟（墨团缓缓上升） */
  smoke(g: CanvasRenderingContext2D) {
    if (this.reduced) return;
    const segW = 1000 / SEGMENTS;
    for (let s = 0; s < SEGMENTS; s++) {
      const seg = this.sim.segs[s], f = seg.hp / seg.max;
      if (f > 0.55) continue;
      const n = f <= 0 ? 4 : f < 0.3 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        const ph = ((this.now / 2600) + k / n + s * 0.13) % 1;
        const [x, y, sc] = this.P(s * segW + segW * (0.3 + 0.4 * ((k * 37 + s * 11) % 10) / 10), WALL_Y, WALL_H + 10 + ph * 120);
        puff(g, x + ph * 18, y, (8 + ph * 34) * sc * 3, f <= 0 ? '70,62,55' : '105,98,90', 0.42 * (1 - ph), s * 31 + k * 7 + Math.floor(this.now / 2600 + k / n + s * 0.13));
      }
    }
  }

  /* ---------- 一营：方阵、旗、头顶数字 ---------- */
  drawUnit(g: CanvasRenderingContext2D, u: SUnit) {
    if (u.state === 'gone' || u.troops < 1) return;
    const sim = this.sim;
    const w = this.where(u);
    if (!w) return;
    const onWall = w.z > 0;
    const [cx, cy, s] = this.PU(w.x, w.y, w.z);
    const facing: 'back' | 'front' = (u.side === this.o.me) ? 'back' : 'front';
    const n = Math.max(3, Math.min(onWall ? 11 : 40, Math.round(Math.sqrt(u.troops) / (onWall ? 6 : 2.8))));
    const px = this.H * s * 0.11 * (onWall ? 1.7 : this.o.me === 'att' && w.y < 240 ? 1.3 : 1);   // 一个小兵的高度（像素）；城头守军画大些，免得远看只剩刻痕
    const moving = u.state === 'move' || u.state === 'rout';
    const frame = moving ? Math.floor(this.now / 180 + u.x) % 2 : 0;
    const cols = onWall ? n : Math.ceil(Math.sqrt(n * 2.2));
    const rows = Math.ceil(n / cols);
    const gapX = px * (u.kind === 'cav' ? 0.75 : u.kind === 'art' ? 1.5 : 0.5), gapY = px * 0.32;
    const sel = this.selected === u.id;
    if (sel) { g.strokeStyle = 'rgba(255,214,120,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy + 2, cols * gapX * 0.62 + 6, rows * gapY * 0.7 + 6, 0, 0, Math.PI * 2); g.stroke(); }
    if (u.state === 'rout') g.globalAlpha = 0.75;
    if (!onWall) this.footprint(g, cx, cy - rows * gapY * 0.35, cols * gapX * 0.6 + px * 0.5, rows * gapY * 0.6 + px * 0.25, moving, u.x | 0);
    // 由远及近画，免得前排被后排盖住
    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const k = r * cols + c; if (k >= n) continue;
        const jx = ((k * 37) % 7 - 3) * px * 0.04, jy = ((k * 53) % 5 - 2) * px * 0.03;
        const rr = facing === 'back' ? r : rows - 1 - r;
        const x = cx + (c - (cols - 1) / 2) * gapX + jx, y = cy - (rows - 1 - rr) * gapY * (onWall ? 0 : 1) + jy;
        const bob = moving ? Math.abs(Math.sin(this.now / 120 + k)) * px * 0.05 : 0;
        if (onWall) {
          // 城头守军：只露半身于垛口之后
          const sp = this.sprite(u.side, u.kind === 'gun' ? 'gun' : 'inf', u.side === this.o.me ? 'back' : 'front', 0);
          if (this.o.me === 'att') { g.save(); g.beginPath(); g.rect(x - px, y - px * 2, px * 2, px * 1.45); g.clip(); }
          g.drawImage(sp, x - px * 0.375, y - px - bob, px * 0.75, px);
          if (this.o.me === 'att') g.restore();
        } else {
          const sp = this.sprite(u.side, u.kind, facing, frame);
          const hh = u.kind === 'cav' ? px * 1.25 : px;
          g.drawImage(sp, x - hh * 0.375, y - hh - bob, hh * 0.75, hh);
        }
      }
    }
    g.globalAlpha = 1;
    // 攀城：云梯与攀爬的小人
    if (u.state === 'climb' && u.seg !== undefined) {
      const [wx, wy, ws] = this.P(segX(u.seg), WALL_Y), h = WALL_H * ws * this.H / 260;
      for (let k = -1; k <= 1; k++) {
        const lx = wx + k * h * 0.9;
        g.strokeStyle = ink(0.85, 0.95); g.lineWidth = Math.max(1.5, ws * 6);
        g.beginPath(); g.moveTo(lx - h * 0.15, wy); g.lineTo(lx, wy - h * 1.05); g.moveTo(lx + h * 0.1, wy); g.lineTo(lx + h * 0.22, wy - h * 1.05); g.stroke();
        g.lineWidth = Math.max(1, ws * 3); for (let t = 0.1; t < 1; t += 0.12) { g.beginPath(); g.moveTo(lx - h * 0.15 + h * 0.15 * t, wy - h * 1.05 * t); g.lineTo(lx + h * 0.1 + h * 0.12 * t, wy - h * 1.05 * t); g.stroke(); }
        const q = (this.now / 1600 + k * 0.3) % 1, sp = this.sprite('att', 'inf', this.o.me === 'att' ? 'back' : 'front', Math.floor(this.now / 150) % 2);
        g.drawImage(sp, lx - px * 0.3, wy - h * q - px * 0.8, px * 0.6, px * 0.8);
      }
    }
    // 撞门：冲车
    if (u.state === 'ram') {
      const [gx, gy, gs] = this.P(segX(GATE_SEG), WALL_Y + 14), w = gs * this.H * 0.5;
      const push = Math.sin(this.now / 220) * w * 0.06;
      // 冲车：四轮木架、人字顶蒙牛皮，悬木撞锤
      g.fillStyle = '#7a5a38'; g.fillRect(gx - w * 0.3, gy - w * 0.22, w * 0.6, w * 0.16); g.strokeStyle = ink(0.95); g.lineWidth = 1.2; g.strokeRect(gx - w * 0.3, gy - w * 0.22, w * 0.6, w * 0.16);
      for (const d of [-0.22, 0.22]) { g.fillStyle = ink(0.9); g.beginPath(); g.arc(gx + d * w, gy - w * 0.05, w * 0.06, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = 'rgba(150,120,80,0.97)'; g.beginPath(); g.moveTo(gx - w * 0.38, gy - w * 0.2); g.lineTo(gx, gy - w * 0.46); g.lineTo(gx + w * 0.38, gy - w * 0.2); g.closePath(); g.fill(); g.stroke();
      g.strokeStyle = ink(0.8, 0.5); g.lineWidth = 0.8; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(gx + k * w * 0.07, gy - w * 0.44 + Math.abs(k) * w * 0.05); g.lineTo(gx + k * w * 0.15, gy - w * 0.21); g.stroke(); }
      g.fillStyle = ink(0.95); g.fillRect(gx - w * 0.05, gy - w * 0.32 - push, w * 0.1, w * 0.3);
    }
    // 旗与头顶读数：兵数（滚动）、士气条
    // 守城视角里城头守军近在眼前：读数贴着头顶，不飘到城外敌阵里去
    const top = onWall && u.side === this.o.me ? cy - px * 0.95 : cy - rows * gapY - px * 1.25;
    if (!(onWall && u.side === this.o.me && this.o.me === 'def')) {   // 守城视角里近处城头不插大旗，免得遮挡来敌
      if (u.state !== 'rout') this.banner(g, cx + cols * gapX * 0.38, cy - (onWall ? 0 : rows * gapY * 0.5), px * (onWall ? 1.1 : 1.5), u.side, this.now / 300 + u.x);
    }
    this.label(g, u, cx, top, px, w.note ?? (u.side === 'def' && u.name === '城内预备' && u.state === 'wall' && u.seg !== undefined ? '援' + segName(u.seg) : undefined));
    void sim;
  }

  /* ---------- 一帧 ---------- */
  render(now: number) {
    this.now = now; this.labelRects = [];
    const g = this.g, sim = this.sim;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake > 0 && !this.reduced ? (Math.random() - 0.5) * this.shake : 0;
    g.translate(sh, sh * 0.6);
    this.shake = Math.max(0, this.shake - 0.6);
    g.drawImage(this.background(), 0, 0, this.W, this.H);
    // 墙外远处（守城视角里的攻方，攻城视角里看不见的城内）→ 城墙 → 城头 → 墙前近处
    const placed = sim.units.filter(u => u.state !== 'gone').map(u => ({ u, w: this.where(u) })).filter(p => p.w) as { u: SUnit; w: NonNullable<ReturnType<SiegeView['where']>> }[];
    placed.sort((a, b) => this.depth(b.w.y) - this.depth(a.w.y));
    const far = (p: typeof placed[number]) => p.w.z === 0 && (this.o.me === 'att' ? p.w.y < WALL_Y - 1 : p.w.y > WALL_Y + 1);
    for (const p of placed) if (far(p)) this.drawUnit(g, p.u);
    this.drawWall(g);
    for (const p of placed) if (p.w.z > 0) this.drawUnit(g, p.u);
    this.smoke(g);
    for (const p of placed) if (!far(p) && p.w.z === 0) this.drawUnit(g, p.u);
    this.drawShots(g, now);
    this.drawFloats(g, now);
    if (sim.weather === 'rain') this.rain(g, now);
    this.frameAge(g);
    this.vignette(g, sim.resolve[this.o.me], !!sim.over, now);
  }

  /** 从模拟里取这一步的伤亡、开火，变成飘字与弹道 */
  harvest(now: number) {
    const sim = this.sim;
    this.harvestHits(now, sim.units, u => (this.where(u as SUnit)?.z ?? 0));
    // 开火示意：炮弹、箭雨、铳烟
    for (const u of sim.units) {
      if (u.state === 'bombard' && u.seg !== undefined && Math.random() < 0.05) {
        const [x0, y0] = this.PU(u.x, u.y, 4), [x1, y1] = this.P(segX(u.seg) + (Math.random() - 0.5) * 120, WALL_Y, WALL_H * 0.6);
        this.shots.push({ x0, y0, x1, y1, t0: now, dur: 700, kind: 'ball' });
      }
      if (u.state === 'shoot' && Math.random() < 0.08) { const [x, y, s] = this.PU(u.x, u.y, 8); this.shots.push({ x0: x, y0: y, x1: x, y1: y - this.H * s * 0.2, t0: now, dur: 900, kind: 'smoke' }); }
      if (u.side === 'def' && u.state === 'wall' && u.engaged && Math.random() < 0.08) {
        const tgt = sim.units.find(a => a.side === 'att' && a.state !== 'gone' && a.state !== 'inside' && Math.abs(a.x - u.x) < 260 && a.y < 520);
        if (tgt) { const [x0, y0] = this.PU(u.x, WALL_Y, WALL_H), [x1, y1] = this.PU(tgt.x, tgt.y, 6); this.shots.push({ x0, y0, x1, y1, t0: now, dur: 600, kind: 'arrow' }); }
      }
      if (u.state === 'inside' && u.side === 'att' && Math.random() < 0.06) { const w = this.where(u); if (w) { const [x, y] = this.PU(w.x, w.y); this.shots.push({ x0: x, y0: y, x1: x + 20, y1: y, t0: now, dur: 800, kind: 'dust' }); } }
    }
  }

  /** 点选：一营或城墙一段 */
  /** 某营在画布上的点选位置（测试与截图用，与 pick 同一算法） */
  unitScreen(id: string): [number, number] | null {
    const u = this.sim.units.find(x => x.id === id); if (!u) return null;
    const w = this.where(u); if (!w) return null;
    const [x, y, s] = this.PU(w.x, w.y, w.z); return [x, y - this.H * s * 0.1];
  }
  /** 某段城墙在画布上的点选位置 */
  segScreen(seg: number): [number, number] {
    const [, wy, ws] = this.P(500, WALL_Y);
    const h = WALL_H * ws * this.H / 260;
    const [x] = this.P((seg + 0.5) * 1000 / SEGMENTS, WALL_Y);
    return [x, wy - h * 0.5];
  }
  pick(sx: number, sy: number): { unit?: string; seg?: number } {
    let best: string | undefined, bd = 1e9;
    for (const u of this.sim.units) {
      if (u.state === 'gone' || u.troops < 1) continue;
      const w = this.where(u); if (!w) continue;
      const [x, y, s] = this.PU(w.x, w.y, w.z);
      const r = Math.max(26, this.H * s * 0.35);
      const d = Math.hypot(sx - x, (sy - (y - this.H * s * 0.1)) * 1.3);
      if (d < r && d < bd) { bd = d; best = u.id; }
    }
    if (best) return { unit: best };
    const [, wy, ws] = this.P(500, WALL_Y);
    const h = WALL_H * ws * this.H / 260;
    if (sy > wy - h * 1.6 && sy < wy + 8) {
      const [x] = this.unproject(sx, wy - 1);
      const s = Math.max(0, Math.min(SEGMENTS - 1, Math.floor(x / (1000 / SEGMENTS))));
      return { seg: s };
    }
    return {};
  }
}

