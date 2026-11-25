/* 攻城战画面：纵深透视（Canvas 2D 自绘）。
 * 攻城时镜头在攻方阵后，望向城门；守城时镜头在城头身后，望向城外。城后的房屋不画。
 * 画面只读模拟状态（core/siege.ts），不改它。共用部分在 rtView.ts。 */
import { SEGMENTS, GATE_SEG, WALL_Y, segX, segName, type SiegeSim, type SUnit } from '../core/siege';
import { RtView, type ViewOpts, type Camera } from './rtView';
export type { ViewOpts } from './rtView';

const WALL_H = 78;   // 城墙高（世界单位）

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

  /* ---------- 背景（缓存） ---------- */
  background(): HTMLCanvasElement {
    const key = `${this.W}x${this.H}${this.o.me}${this.sim.weather}`;
    if (this.bg && this.bgKey === key) return this.bg;
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const { W, H } = this, hz = this.hz;
    this.skyAndHills(g, this.sim.weather);
    // 大地：近浓远淡，田垄随透视收拢
    const gr = g.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, '#9aa07a'); gr.addColorStop(0.4, '#7f8a5a'); gr.addColorStop(1, '#5e6a3f');
    g.fillStyle = gr; g.fillRect(0, hz + 8, W, H);
    g.strokeStyle = 'rgba(60,70,40,0.18)'; g.lineWidth = 1;
    for (let x = -1500; x <= 2500; x += 120) { const [a1, b1] = this.P(x, 1000), [a2, b2] = this.P(x, 140); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
    for (let y = 150; y <= 1000; y += 70) { const [a1, b1] = this.P(-1500, y), [a2, b2] = this.P(2500, y); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
    // 通往城门的大道
    g.fillStyle = 'rgba(170,150,105,0.45)';
    const road = [this.P(440, 1050), this.P(560, 1050), this.P(530, 130), this.P(470, 130)];
    g.beginPath(); road.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
    // 护城河
    const m1 = this.P(-1500, 132), m2 = this.P(2500, 132), m3 = this.P(2500, 116), m4 = this.P(-1500, 116);
    g.fillStyle = '#56808c'; g.beginPath(); g.moveTo(m1[0], m1[1]); g.lineTo(m2[0], m2[1]); g.lineTo(m3[0], m3[1]); g.lineTo(m4[0], m4[1]); g.closePath(); g.fill();
    g.fillStyle = 'rgba(220,240,240,0.18)'; g.fillRect(0, Math.min(m1[1], m3[1]), W, 2);
    // 草丛与石头
    let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let k = 0; k < 160; k++) {
      const x = -400 + rnd() * 1800, y = 160 + rnd() * 900, [sx, sy, s] = this.P(x, y);
      g.fillStyle = rnd() < 0.5 ? 'rgba(70,90,45,0.45)' : 'rgba(120,110,80,0.35)';
      g.beginPath(); g.ellipse(sx, sy, 6 * s * 3, 2 * s * 3, 0, 0, Math.PI * 2); g.fill();
    }
    this.bg = c; this.bgKey = key;
    return c;
  }

  /* ---------- 城墙（攻城视角：正面；守城视角：从墙头俯看墙内侧与垛口） ---------- */
  drawWall(g: CanvasRenderingContext2D) {
    const sim = this.sim;
    const segW = 1000 / SEGMENTS;
    for (let s = 0; s < SEGMENTS; s++) {
      const seg = sim.segs[s];
      const x0 = s * segW, x1 = x0 + segW;
      const [ax, ay, as] = this.P(x0, WALL_Y), [bx] = this.P(x1, WALL_Y);
      const h = WALL_H * as * this.H / 260;
      const L = Math.min(ax, bx), R = Math.max(ax, bx);
      const f = seg.hp / seg.max;
      // 墙面：青砖，逐块深浅
      const fg = g.createLinearGradient(0, ay - h, 0, ay);
      fg.addColorStop(0, '#9b998f'); fg.addColorStop(1, '#6d6b63');
      g.fillStyle = fg; g.fillRect(L, ay - h, R - L, h);
      if (this.o.me === 'att') {
        g.strokeStyle = 'rgba(45,42,38,0.28)'; g.lineWidth = 0.7;
        const rows = 9;
        for (let r = 1; r < rows; r++) { const y = ay - h + h * r / rows; g.beginPath(); g.moveTo(L, y); g.lineTo(R, y); g.stroke();
          for (let c = 0; c < 14; c++) { const x = L + (R - L) * (c + (r % 2) * 0.5) / 14; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + h / rows); g.stroke(); } }
        // 条石基座
        g.fillStyle = '#8d8574'; g.fillRect(L, ay - h * 0.14, R - L, h * 0.14);
        g.strokeStyle = 'rgba(40,34,26,0.45)'; g.beginPath(); g.moveTo(L, ay - h * 0.14); g.lineTo(R, ay - h * 0.14); g.stroke();
      }
      // 破损：裂缝随城防下降而增多；城防归零则塌出缺口
      if (f < 0.85) {
        g.strokeStyle = 'rgba(25,20,16,0.8)'; g.lineWidth = 1.6;
        let sd = s * 97 + 13; const rr = () => { sd = (sd * 9301 + 49297) % 233280; return sd / 233280; };
        for (let k = 0; k < (1 - f) * 16; k++) { const x = L + rr() * (R - L), y = ay - h * (0.2 + rr() * 0.7); g.beginPath(); g.moveTo(x, y); g.lineTo(x - 5 + rr() * 10, y + h * 0.15); g.lineTo(x - 3 + rr() * 6, y + h * 0.3); g.stroke(); }
      }
      if (seg.hp <= 0) {
        const mx = (L + R) / 2, gw = (R - L) * 0.42;
        g.fillStyle = '#3a3029'; g.beginPath(); g.moveTo(mx - gw, ay - h); g.lineTo(mx - gw * 0.45, ay - h * 0.15); g.lineTo(mx + gw * 0.45, ay - h * 0.15); g.lineTo(mx + gw, ay - h); g.closePath(); g.fill();
        for (let k = 0; k < 18; k++) { g.fillStyle = k % 2 ? '#8f877a' : '#6f685c'; g.beginPath(); g.ellipse(mx - gw + (k / 18) * gw * 2, ay - h * 0.08 + Math.sin(k) * 3, 5 * as * 3, 3 * as * 3, 0, 0, Math.PI * 2); g.fill(); }
      }
      // 垛口（有厚度）
      const m = Math.max(3, h * 0.17);
      for (let x = L; x < R - m * 0.6; x += m * 1.7) {
        if (seg.hp <= 0 && Math.abs(x - (L + R) / 2) < (R - L) * 0.42) continue;
        g.fillStyle = '#8f8b80'; g.fillRect(x, ay - h - m, m, m);
        g.fillStyle = '#b8b2a4'; g.fillRect(x, ay - h - m - m * 0.25, m, m * 0.25);
        g.fillStyle = 'rgba(20,16,12,0.6)'; g.fillRect(x + m * 0.4, ay - h - m * 0.6, m * 0.18, m * 0.35);
      }
      // 城门：砖券门洞、包铁门；被撞开则门扇倒伏
      if (s === GATE_SEG) {
        const gx = (L + R) / 2, gw = (R - L) * 0.16, gh = h * 0.62;
        g.fillStyle = '#5f5b53'; g.beginPath(); g.moveTo(gx - gw - 4, ay); g.lineTo(gx - gw - 4, ay - gh); g.arc(gx, ay - gh, gw + 4, Math.PI, 0); g.lineTo(gx + gw + 4, ay); g.closePath(); g.fill();
        const broken = sim.gate.hp <= 0, gf = sim.gate.hp / sim.gate.max;
        g.fillStyle = broken ? '#140d08' : '#5a3a20';
        g.beginPath(); g.moveTo(gx - gw, ay); g.lineTo(gx - gw, ay - gh); g.arc(gx, ay - gh, gw, Math.PI, 0); g.lineTo(gx + gw, ay); g.closePath(); g.fill();
        if (!broken) {
          g.strokeStyle = 'rgba(25,15,8,0.7)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(gx, ay); g.lineTo(gx, ay - gh - gw * 0.9); g.stroke();
          g.fillStyle = '#c9a457'; for (let r = 0; r < 5; r++) for (let c = -2; c <= 2; c++) if (c) { g.beginPath(); g.arc(gx + c * gw * 0.38, ay - gh * 0.15 - r * gh * 0.2, Math.max(0.8, as * 3), 0, Math.PI * 2); g.fill(); }
          if (gf < 0.6) { g.strokeStyle = 'rgba(250,230,190,0.5)'; g.lineWidth = 1; for (let k = 0; k < (1 - gf) * 8; k++) { g.beginPath(); g.moveTo(gx - gw * 0.6 + k * 4, ay - gh * 0.8); g.lineTo(gx - gw * 0.4 + k * 3, ay - gh * 0.3); g.stroke(); } }
        } else {
          g.fillStyle = '#4a2e18'; g.beginPath(); g.moveTo(gx - gw, ay); g.lineTo(gx - gw * 2.2, ay + 4); g.lineTo(gx - gw * 2.1, ay - 3); g.lineTo(gx - gw, ay - gh * 0.3); g.fill();
        }
        // 城楼
        // 城楼：守城时在镜头近处，画小些，免得挡住来敌
        if (this.o.me === 'att') this.drawTower(g, gx, ay - h - m, (R - L) * 0.42, h);
        else { g.globalAlpha = 0.85; this.drawTower(g, gx, ay - h - m, (R - L) * 0.22, h * 0.45); g.globalAlpha = 1; }
      }
      // 选段高亮
      if (this.hoverSeg === s) { g.strokeStyle = 'rgba(255,214,120,0.95)'; g.lineWidth = 3; g.strokeRect(L + 2, ay - h - m - 2, R - L - 4, h + m + 4); }
      // 段名与城防条
      const barW = (R - L) * 0.6, bx0 = (L + R) / 2 - barW / 2, by0 = ay - h - m - (s === GATE_SEG && this.o.me === 'att' ? h * 1.25 : 12);
      g.fillStyle = 'rgba(15,10,6,0.75)'; g.fillRect(bx0 - 1, by0 - 1, barW + 2, 6);
      g.fillStyle = f > 0.6 ? '#9fd18f' : f > 0.3 ? '#e8a447' : '#e0503f'; g.fillRect(bx0, by0, barW * Math.max(0, f), 4);
      if (s === GATE_SEG) { const gf = Math.max(0, sim.gate.hp / sim.gate.max); g.fillStyle = 'rgba(15,10,6,0.75)'; g.fillRect(bx0 - 1, by0 + 6, barW + 2, 5); g.fillStyle = '#c9a457'; g.fillRect(bx0, by0 + 7, barW * gf, 3); }
    }
  }
  drawTower(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
    const look = this.o.look.def;
    g.fillStyle = '#8a3a2a'; g.fillRect(x - w * 0.42, y - h * 0.55, w * 0.84, h * 0.55);
    for (let k = 0; k < 5; k++) { g.fillStyle = '#5a2418'; g.fillRect(x - w * 0.4 + k * w * 0.2, y - h * 0.55, w * 0.04, h * 0.55); }
    g.fillStyle = '#3b3f42';
    g.beginPath(); g.moveTo(x - w * 0.62, y - h * 0.5); g.quadraticCurveTo(x - w * 0.5, y - h * 0.62, x - w * 0.4, y - h * 0.82); g.lineTo(x + w * 0.4, y - h * 0.82); g.quadraticCurveTo(x + w * 0.5, y - h * 0.62, x + w * 0.62, y - h * 0.5); g.closePath(); g.fill();
    g.fillRect(x - w * 0.3, y - h * 1.15, w * 0.6, h * 0.35);
    g.beginPath(); g.moveTo(x - w * 0.46, y - h * 1.08); g.quadraticCurveTo(x, y - h * 1.3, x + w * 0.46, y - h * 1.08); g.lineTo(x + w * 0.3, y - h * 1.2); g.lineTo(x - w * 0.3, y - h * 1.2); g.closePath(); g.fill();
    // 旗
    const fy = y - h * 1.2, wv = Math.sin(this.now / 300) * 2;
    g.strokeStyle = '#2a1d12'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, fy); g.lineTo(x, fy - h * 0.7); g.stroke();
    g.fillStyle = this.sim.over?.winner === 'att' && this.sim.over.outcome !== 'retreat' ? this.o.look.att.color : look.color;
    g.beginPath(); g.moveTo(x, fy - h * 0.7); g.lineTo(x + h * 0.5, fy - h * 0.66 + wv); g.lineTo(x + h * 0.5, fy - h * 0.4 + wv); g.lineTo(x, fy - h * 0.44); g.closePath(); g.fill();
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
    const n = Math.max(3, Math.min(onWall ? 9 : 30, Math.round(Math.sqrt(u.troops) / (onWall ? 7 : 4))));
    const px = this.H * s * 0.11 * (onWall ? 1.7 : this.o.me === 'att' && w.y < 240 ? 1.3 : 1);   // 一个小兵的高度（像素）；城头守军画大些，免得远看只剩刻痕
    const moving = u.state === 'move' || u.state === 'rout';
    const frame = moving ? Math.floor(this.now / 180 + u.x) % 2 : 0;
    const cols = onWall ? n : Math.ceil(Math.sqrt(n * 2.2));
    const rows = Math.ceil(n / cols);
    const gapX = px * (u.kind === 'cav' ? 0.75 : u.kind === 'art' ? 1.5 : 0.5), gapY = px * 0.32;
    const sel = this.selected === u.id;
    if (sel) { g.strokeStyle = 'rgba(255,214,120,0.95)'; g.lineWidth = 2.5; g.beginPath(); g.ellipse(cx, cy + 2, cols * gapX * 0.62 + 6, rows * gapY * 0.7 + 6, 0, 0, Math.PI * 2); g.stroke(); }
    if (u.state === 'rout') g.globalAlpha = 0.75;
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
          g.save(); g.beginPath(); g.rect(x - px, y - px * 2, px * 2, px * 1.45); g.clip();
          g.drawImage(sp, x - px * 0.375, y - px - bob, px * 0.75, px); g.restore();
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
        g.strokeStyle = '#7a5530'; g.lineWidth = Math.max(1.5, ws * 6);
        g.beginPath(); g.moveTo(lx - h * 0.15, wy); g.lineTo(lx, wy - h * 1.05); g.moveTo(lx + h * 0.1, wy); g.lineTo(lx + h * 0.22, wy - h * 1.05); g.stroke();
        const q = (this.now / 1600 + k * 0.3) % 1, sp = this.sprite('att', 'inf', this.o.me === 'att' ? 'back' : 'front', Math.floor(this.now / 150) % 2);
        g.drawImage(sp, lx - px * 0.3, wy - h * q - px * 0.8, px * 0.6, px * 0.8);
      }
    }
    // 撞门：冲车
    if (u.state === 'ram') {
      const [gx, gy, gs] = this.P(segX(GATE_SEG), WALL_Y + 14), w = gs * this.H * 0.5;
      const push = Math.sin(this.now / 220) * w * 0.06;
      g.fillStyle = '#5a3b22'; g.fillRect(gx - w * 0.3, gy - w * 0.22 + push * 0.2, w * 0.6, w * 0.16);
      g.fillStyle = '#3a2614'; g.beginPath(); g.moveTo(gx - w * 0.36, gy - w * 0.2); g.lineTo(gx, gy - w * 0.42); g.lineTo(gx + w * 0.36, gy - w * 0.2); g.closePath(); g.fill();
      g.fillStyle = '#2a1d12'; g.fillRect(gx - w * 0.06, gy - w * 0.3 - push, w * 0.12, w * 0.3);
    }
    // 旗与头顶读数：兵数（滚动）、士气条
    // 守城视角里城头守军近在眼前：读数贴着头顶，不飘到城外敌阵里去
    const top = onWall && u.side === this.o.me ? cy - px * 0.95 : cy - rows * gapY - px * 1.25;
    const look = this.o.look[u.side];
    if (!(onWall && u.side === this.o.me && this.o.me === 'def')) {   // 守城视角里近处城头不插大旗，免得遮挡来敌
      g.strokeStyle = '#2a1d12'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + cols * gapX * 0.35, cy - px * 0.4); g.lineTo(cx + cols * gapX * 0.35, top); g.stroke();
      g.fillStyle = look.color; g.fillRect(cx + cols * gapX * 0.35, top, px * 0.6, px * 0.4);
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
    for (const p of placed) if (!far(p) && p.w.z === 0) this.drawUnit(g, p.u);
    this.drawShots(g, now);
    this.drawFloats(g, now);
    if (sim.weather === 'rain') this.rain(g, now);
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

