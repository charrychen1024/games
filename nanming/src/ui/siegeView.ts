/* 攻城战画面：纵深透视（Canvas 2D 自绘）。
 * 攻城时镜头在攻方阵后，望向城门；守城时镜头在城头身后，望向城外。城后的房屋不画。
 * 画面只读模拟状态（core/siege.ts），不改它。 */
import { SEGMENTS, GATE_SEG, WALL_Y, segX, type SiegeSim, type SUnit } from '../core/siege';
import type { SideLook } from './battleScene';
import { shade } from './battleScene';

export interface ViewOpts { me: 'att' | 'def'; look: { att: SideLook; def: SideLook }; }
interface Float { x: number; y: number; text: string; t0: number; color: string }
interface Shot { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; kind: 'ball' | 'arrow' | 'smoke' }

const WALL_H = 78;   // 城墙高（世界单位）

export class SiegeView {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  sim: SiegeSim; o: ViewOpts;
  selected: string | null = null;
  hoverSeg: number | null = null;
  floats: Float[] = [];
  shots: Shot[] = [];
  shake = 0;
  now = 0;
  sprites = new Map<string, HTMLCanvasElement>();
  bg: HTMLCanvasElement | null = null; bgKey = '';
  hitAcc = new Map<string, number>();
  lastFloat = 0;
  reduced = false;

  constructor(parent: HTMLElement, sim: SiegeSim, o: ViewOpts) {
    this.sim = sim; this.o = o;
    this.cv = document.createElement('canvas');
    this.cv.className = 'siege-cv';
    parent.append(this.cv);
    this.g = this.cv.getContext('2d')!;
    this.resize();
  }
  resize() {
    const r = this.cv.parentElement!.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = Math.max(320, r.width); this.H = Math.max(240, r.height);
    this.cv.width = Math.round(this.W * this.dpr); this.cv.height = Math.round(this.H * this.dpr);
    this.cv.style.width = this.W + 'px'; this.cv.style.height = this.H + 'px';
    this.bg = null;
  }

  /* ---------- 透视 ---------- */
  get hz() { return this.H * 0.13; }
  /** 离镜头的距离：攻城时阵后为近、城墙为远；守城时反之 */
  depth(y: number) { return this.o.me === 'att' ? 1420 - y : y + 330; }
  scale(y: number) { const k = this.H * (this.o.me === 'att' ? 0.25 : 0.2) * 1300; return k / this.depth(y) / this.H; }
  P(x: number, y: number, z = 0): [number, number, number] {
    const s = this.scale(y);
    const kx = this.W * (this.o.me === 'att' ? 1.2 : 1.05);
    const sx = this.W / 2 + (x - 500) * kx * s / 1000 * (this.o.me === 'att' ? 1 : -1) * 2.1;
    const sy = this.hz + this.H * s * (this.o.me === 'att' ? 1 : 1.05) - z * s * this.H / 260;
    return [sx, sy, s];
  }
  /** 屏幕坐标反算到地面（点选用） */
  unproject(sx: number, sy: number): [number, number] {
    let lo = -300, hi = 1100;
    for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; const [, py] = this.P(500, m); if ((py < sy) === (this.o.me === 'att')) lo = m; else hi = m; }
    const y = (lo + hi) / 2;
    const s = this.scale(y), kx = this.W * (this.o.me === 'att' ? 1.2 : 1.05);
    const x = 500 + (sx - this.W / 2) / (kx * s / 1000 * 2.1) * (this.o.me === 'att' ? 1 : -1);
    return [x, y];
  }

  /* ---------- 小兵贴图（预渲染） ---------- */
  sprite(side: 'att' | 'def', kind: string, facing: 'back' | 'front', frame: number): HTMLCanvasElement {
    const key = `${side}${kind}${facing}${frame}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const look = this.o.look[side];
    c = document.createElement('canvas'); c.width = 48; c.height = 64;
    const g = c.getContext('2d')!;
    g.translate(24, 60);
    const col = look.color, dark = shade(col, -0.4), skin = '#e2b98f';
    const helmet = look.helmet === 'qing' ? '#3a3d44' : look.helmet === 'ming' ? '#8a8d93' : look.helmet === 'shun' ? '#6b5638' : look.helmet === 'xi' ? '#5a4632' : '#555';
    const step = frame ? 2 : -2;
    g.lineCap = 'round';
    if (kind === 'cav') {
      g.fillStyle = '#5a3b22'; g.beginPath(); g.ellipse(0, -14, 9, 14, 0, 0, Math.PI * 2); g.fill();          // 马（前后看是窄长）
      g.strokeStyle = '#3a2614'; g.lineWidth = 3; g.beginPath(); g.moveTo(-4, -4); g.lineTo(-4 - step * 0.5, 0); g.moveTo(4, -4); g.lineTo(4 + step * 0.5, 0); g.stroke();
      if (facing === 'front') { g.fillStyle = '#5a3b22'; g.beginPath(); g.ellipse(0, -26, 4, 7, 0, 0, Math.PI * 2); g.fill(); }
      g.fillStyle = col; g.fillRect(-6, -36, 12, 13);
      g.fillStyle = facing === 'front' ? skin : dark; g.beginPath(); g.arc(0, -40, 4.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = helmet; g.beginPath(); g.arc(0, -42, 4.8, Math.PI, Math.PI * 2); g.fill();
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, -24); g.lineTo(11, -58); g.stroke();
      g.fillStyle = '#d8d8d0'; g.beginPath(); g.moveTo(11, -58); g.lineTo(9.5, -52); g.lineTo(12.5, -52); g.fill();
    } else if (kind === 'art') {
      g.fillStyle = '#4a3420'; g.fillRect(-14, -10, 28, 5);
      g.fillStyle = '#2f2e2b'; g.beginPath(); g.ellipse(0, facing === 'back' ? -14 : -12, 6, facing === 'back' ? 10 : 6, 0, 0, Math.PI * 2); g.fill();
      for (const wx of [-12, 12]) { g.fillStyle = '#5a3b22'; g.beginPath(); g.ellipse(wx, -8, 3, 7, 0, 0, Math.PI * 2); g.fill(); }
      for (const dx of [-18, 18]) { g.fillStyle = col; g.fillRect(dx - 4, -26, 8, 12); g.fillStyle = facing === 'front' ? skin : dark; g.beginPath(); g.arc(dx, -29, 3.5, 0, Math.PI * 2); g.fill(); g.fillStyle = helmet; g.beginPath(); g.arc(dx, -31, 3.8, Math.PI, Math.PI * 2); g.fill(); }
    } else {
      // 步卒、火器手：腿、身、头盔、兵器
      g.strokeStyle = dark; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(-3, -14); g.lineTo(-3 - step * 0.6, 0); g.moveTo(3, -14); g.lineTo(3 + step * 0.6, 0); g.stroke();
      g.fillStyle = col; g.beginPath(); g.moveTo(-7, -14); g.lineTo(-6, -30); g.lineTo(6, -30); g.lineTo(7, -14); g.closePath(); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(-7, -20, 14, 2.5);
      g.fillStyle = facing === 'front' ? skin : shade(skin, -0.35); g.beginPath(); g.arc(0, -34, 4.6, 0, Math.PI * 2); g.fill();
      g.fillStyle = helmet; g.beginPath(); g.arc(0, -36, 5, Math.PI, Math.PI * 2); g.fill();
      if (look.helmet === 'ming') { g.strokeStyle = '#c8352a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(0, -41); g.lineTo(0, -46); g.stroke(); }
      if (look.helmet === 'qing') { g.strokeStyle = '#d6b05a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -41); g.lineTo(0, -48); g.stroke(); }
      if (kind === 'gun') { g.strokeStyle = '#3a2a1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(5, -24); g.lineTo(9, -46); g.stroke(); }
      else { g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(7, -18); g.lineTo(9, -56); g.stroke(); g.fillStyle = '#d8d8d0'; g.beginPath(); g.moveTo(9, -56); g.lineTo(7.5, -50); g.lineTo(10.5, -50); g.fill(); }
      if (kind === 'inf' && facing === 'front') { g.fillStyle = shade(col, -0.2); g.beginPath(); g.ellipse(-6, -22, 4, 6, 0, 0, Math.PI * 2); g.fill(); }
    }
    this.sprites.set(key, c);
    return c;
  }

  /* ---------- 背景（缓存） ---------- */
  background(): HTMLCanvasElement {
    const key = `${this.W}x${this.H}${this.o.me}${this.sim.weather}`;
    if (this.bg && this.bgKey === key) return this.bg;
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const { W, H } = this, hz = this.hz;
    const rain = this.sim.weather === 'rain', fog = this.sim.weather === 'fog';
    const sky = g.createLinearGradient(0, 0, 0, hz + 30);
    sky.addColorStop(0, rain ? '#5d6670' : fog ? '#b9bcb4' : '#6f9fc9'); sky.addColorStop(1, rain ? '#a3a9a8' : fog ? '#dad8cc' : '#e9e0c4');
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 40);
    // 远山
    for (let k = 0; k < 3; k++) {
      g.fillStyle = ['rgba(110,130,140,0.55)', 'rgba(90,110,105,0.6)', 'rgba(80,95,80,0.75)'][k];
      g.beginPath(); g.moveTo(0, hz + 10);
      for (let x = 0; x <= W; x += 30) g.lineTo(x, hz + 6 - k * 3 - Math.abs(Math.sin(x / (90 + k * 40) + k)) * (22 - k * 5));
      g.lineTo(W, hz + 12); g.lineTo(0, hz + 12); g.fill();
    }
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
      const barW = (R - L) * 0.6, bx0 = (L + R) / 2 - barW / 2, by0 = ay - h - m - (s === GATE_SEG ? h * 1.25 : 12);
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
    const onWall = u.side === 'def' && u.state === 'wall';
    const insideDef = u.side === 'def' && (u.state === 'inside' || u.state === 'move' && u.y < WALL_Y);
    if (insideDef && this.o.me === 'att') return;       // 攻方看不见城里
    const [cx, cy, s] = this.P(u.x, u.y, onWall ? WALL_H : 0);
    const facing: 'back' | 'front' = (u.side === this.o.me) ? 'back' : 'front';
    const n = Math.max(3, Math.min(onWall ? 9 : 30, Math.round(Math.sqrt(u.troops) / (onWall ? 7 : 4))));
    const px = this.H * s * 0.11 * (onWall ? 1.7 : 1);   // 一个小兵的高度（像素）；城头守军画大些，免得远看只剩刻痕
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
          const sp = this.sprite(u.side, u.kind === 'gun' ? 'gun' : 'inf', this.o.me === 'def' ? 'back' : 'front', 0);
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
    const top = cy - rows * gapY - px * 1.25;
    const look = this.o.look[u.side];
    if (!(onWall && this.o.me === 'def')) {   // 守城视角里近处城头不插大旗，免得遮挡来敌
      g.strokeStyle = '#2a1d12'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + cols * gapX * 0.35, cy - px * 0.4); g.lineTo(cx + cols * gapX * 0.35, top); g.stroke();
      g.fillStyle = look.color; g.fillRect(cx + cols * gapX * 0.35, top, px * 0.6, px * 0.4);
    }
    const label = `${u.name} ${fmt(u.troops)}`;
    g.font = `700 ${Math.max(10, Math.min(14, px * 0.32))}px "Noto Serif SC", serif`;
    const tw = g.measureText(label).width + 10;
    const ly = top - 16;
    g.fillStyle = u.side === this.o.me ? 'rgba(20,12,6,0.85)' : 'rgba(60,12,8,0.85)';
    g.fillRect(cx - tw / 2, ly - 9, tw, 15);
    g.fillStyle = u.state === 'rout' ? '#ff9a8a' : '#f3e6c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(u.state === 'rout' ? `${u.name} 溃` : label, cx, ly - 1.5);
    const mw = tw - 8, mf = u.morale / 100;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(cx - mw / 2, ly + 7, mw, 3);
    g.fillStyle = mf > 0.5 ? '#9fd18f' : mf > 0.28 ? '#e8a447' : '#e0503f'; g.fillRect(cx - mw / 2, ly + 7, mw * mf, 3);
    void sim;
  }

  /* ---------- 一帧 ---------- */
  render(now: number) {
    this.now = now;
    const g = this.g, sim = this.sim;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake > 0 && !this.reduced ? (Math.random() - 0.5) * this.shake : 0;
    g.translate(sh, sh * 0.6);
    this.shake = Math.max(0, this.shake - 0.6);
    g.drawImage(this.background(), 0, 0, this.W, this.H);
    // 先画墙后（守城视角：城内与城外远处的攻方）或墙前（攻城视角）
    const units = sim.units.filter(u => u.state !== 'gone').sort((a, b) => this.depth(b.y) - this.depth(a.y));
    const farOfWall = (u: SUnit) => this.o.me === 'att' ? u.y < WALL_Y - 1 : u.y > WALL_Y + 1;
    for (const u of units) if (farOfWall(u) && !(u.side === 'def' && u.state === 'wall')) this.drawUnit(g, u);
    this.drawWall(g);
    for (const u of units) if (u.side === 'def' && u.state === 'wall') this.drawUnit(g, u);
    for (const u of units) if (!farOfWall(u) && !(u.side === 'def' && u.state === 'wall')) this.drawUnit(g, u);
    this.drawShots(g, now);
    this.drawFloats(g, now);
    if (sim.weather === 'rain') { g.strokeStyle = 'rgba(210,220,230,0.35)'; g.lineWidth = 1; for (let k = 0; k < 90; k++) { const x = (k * 97 + now * 0.5) % this.W, y = (k * 53 + now * 0.9) % this.H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 12); g.stroke(); } }
    // 军心将溃：边缘泛红
    const r = sim.resolve[this.o.me];
    if (r < 30 && !sim.over) {
      const a = (30 - r) / 30 * (0.35 + 0.15 * Math.sin(now / 250));
      const vg = g.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.35, this.W / 2, this.H / 2, this.H * 0.8);
      vg.addColorStop(0, 'rgba(160,20,10,0)'); vg.addColorStop(1, `rgba(160,20,10,${a})`);
      g.fillStyle = vg; g.fillRect(0, 0, this.W, this.H);
    }
  }

  /** 从模拟里取这一步的伤亡、开火，变成飘字与弹道 */
  harvest(now: number) {
    const sim = this.sim;
    for (const u of sim.units) {
      if (u.hit > 0) this.hitAcc.set(u.id, (this.hitAcc.get(u.id) ?? 0) + u.hit);
    }
    if (now - this.lastFloat > 650) {
      this.lastFloat = now;
      for (const [id, n] of this.hitAcc) {
        if (n < 1) continue;
        const u = sim.units.find(x => x.id === id); if (!u) continue;
        const [x, y, s] = this.P(u.x, u.y, u.side === 'def' && u.state === 'wall' ? WALL_H : 0);
        this.floats.push({ x: x + (Math.random() - 0.5) * 30, y: y - this.H * s * 0.2, text: '−' + Math.round(n), t0: now, color: u.side === this.o.me ? '#ffb3a6' : '#fff1cf' });
      }
      this.hitAcc.clear();
    }
    // 开火示意：炮弹、箭雨、铳烟
    for (const u of sim.units) {
      if (u.state === 'bombard' && u.seg !== undefined && Math.random() < 0.05) {
        const [x0, y0] = this.P(u.x, u.y, 4), [x1, y1] = this.P(segX(u.seg) + (Math.random() - 0.5) * 120, WALL_Y, WALL_H * 0.6);
        this.shots.push({ x0, y0, x1, y1, t0: now, dur: 700, kind: 'ball' });
      }
      if (u.state === 'shoot' && Math.random() < 0.08) { const [x, y, s] = this.P(u.x, u.y, 8); this.shots.push({ x0: x, y0: y, x1: x, y1: y - this.H * s * 0.2, t0: now, dur: 900, kind: 'smoke' }); }
      if (u.side === 'def' && u.state === 'wall' && u.engaged && Math.random() < 0.08) {
        const tgt = sim.units.find(a => a.side === 'att' && a.state !== 'gone' && a.state !== 'inside' && Math.abs(a.x - u.x) < 260 && a.y < 520);
        if (tgt) { const [x0, y0] = this.P(u.x, WALL_Y, WALL_H), [x1, y1] = this.P(tgt.x, tgt.y, 6); this.shots.push({ x0, y0, x1, y1, t0: now, dur: 600, kind: 'arrow' }); }
      }
    }
  }
  drawShots(g: CanvasRenderingContext2D, now: number) {
    this.shots = this.shots.filter(s => now - s.t0 < s.dur);
    for (const s of this.shots) {
      const p = (now - s.t0) / s.dur;
      if (s.kind === 'smoke') { g.fillStyle = `rgba(235,235,228,${0.6 * (1 - p)})`; g.beginPath(); g.arc(s.x0 + p * 10, s.y0 - p * (s.y0 - s.y1), 4 + p * 14, 0, Math.PI * 2); g.fill(); continue; }
      const x = s.x0 + (s.x1 - s.x0) * p, y = s.y0 + (s.y1 - s.y0) * p - Math.sin(p * Math.PI) * (s.kind === 'ball' ? 60 : 30);
      if (s.kind === 'ball') {
        g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
        if (p > 0.92) { g.fillStyle = 'rgba(255,200,120,0.8)'; g.beginPath(); g.arc(s.x1, s.y1, 10, 0, Math.PI * 2); g.fill(); this.shake = Math.max(this.shake, 3); }
        if (p < 0.12) { g.fillStyle = 'rgba(255,220,150,0.9)'; g.beginPath(); g.arc(s.x0, s.y0, 7, 0, Math.PI * 2); g.fill(); }
      } else { g.strokeStyle = 'rgba(40,30,20,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (s.x1 - s.x0) * 0.04, y - 6); g.stroke(); }
    }
  }
  drawFloats(g: CanvasRenderingContext2D, now: number) {
    this.floats = this.floats.filter(f => now - f.t0 < 1300);
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = '900 15px "Noto Serif SC", serif';
    for (const f of this.floats) {
      const p = (now - f.t0) / 1300;
      g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(20,8,4,0.85)'; g.strokeText(f.text, f.x, f.y - p * 30);
      g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - p * 30);
    }
    g.globalAlpha = 1;
  }

  /** 点选：一营或城墙一段 */
  pick(sx: number, sy: number): { unit?: string; seg?: number } {
    let best: string | undefined, bd = 1e9;
    for (const u of this.sim.units) {
      if (u.state === 'gone' || u.troops < 1) continue;
      if (u.side === 'def' && u.state === 'inside' && this.o.me === 'att') continue;
      const [x, y, s] = this.P(u.x, u.y, u.side === 'def' && u.state === 'wall' ? WALL_H : 0);
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
const fmt = (n: number) => n >= 10000 ? (Math.round(n / 1000) / 10) + '万' : String(Math.round(n));
