/* 战场插画：侧视透视。远山、天空、草地、江河、树林、城墙城楼全部由代码绘制；
 * 士兵是有头盔、甲胄、兵器的小人，骑兵骑马，按兵力与兵种排成阵列，行进、冲锋、放铳、溃散都有动作。 */
import type { BattleState, LaneOrder, RoundLog } from '../core/battle';
import { makeRng, type Rng } from '../core/rng';

type Lane = BattleState['att']['lanes'][0];
export interface SceneFrame {
  b: BattleState;          // 当前显示的战局（动画起点）
  next: BattleState | null; // 动画终点
  t: number;               // 动画进度 0..1
  log: RoundLog | null;
  now: number;
}
export interface SideLook { color: string; helmet: 'ming' | 'qing' | 'shun' | 'xi' | 'plain'; flag: string; mark: string }

const SKIN = '#e2b98f';
const IRON = '#3d3a38';

export class BattleScene {
  W = 0; H = 0;
  bg: HTMLCanvasElement | null = null;
  bgKey = '';
  constructor(public look: { att: SideLook; def: SideLook }) {}

  horizon() { return this.H * 0.3; }
  laneY(i: number) { const hz = this.horizon(); return hz + (this.H - hz) * [0.3, 0.57, 0.86][i]; }
  laneS(i: number) { return [0.78, 1.05, 1.35][i] * Math.max(0.8, Math.min(1.6, this.H / 520)); }
  wallX(y: number) { // 城墙左缘随深度变化
    const hz = this.horizon();
    const f = (y - hz) / (this.H - hz);
    return this.W * (0.9 - f * 0.2);
  }

  /* ---------- 静态背景（缓存） ---------- */
  background(b: BattleState): HTMLCanvasElement {
    const key = `${this.W}x${this.H}|${b.terrain}|${b.weather}|${b.kind}|${b.id}`;
    if (this.bg && this.bgKey === key) return this.bg;
    const c = document.createElement('canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = Math.round(this.W * dpr); c.height = Math.round(this.H * dpr);
    const g = c.getContext('2d')!;
    g.scale(dpr, dpr);
    const { W, H } = this;
    const hz = this.horizon();
    const rng = makeRng(b.seed);
    const night = false;
    // 天空
    const sky = g.createLinearGradient(0, 0, 0, hz);
    if (b.weather === 'rain') { sky.addColorStop(0, '#5d6670'); sky.addColorStop(1, '#a3a9a8'); }
    else if (b.weather === 'fog') { sky.addColorStop(0, '#b9bcb4'); sky.addColorStop(1, '#dad8cc'); }
    else { sky.addColorStop(0, night ? '#1a2238' : '#6f9fc9'); sky.addColorStop(0.7, '#cfe0e3'); sky.addColorStop(1, '#efe4c6'); }
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 2);
    if (b.weather === 'clear' || b.weather === 'wind') {
      const sun = g.createRadialGradient(W * 0.78, hz * 0.3, 2, W * 0.78, hz * 0.3, 70);
      sun.addColorStop(0, 'rgba(255,248,220,1)'); sun.addColorStop(0.25, 'rgba(255,240,200,0.8)'); sun.addColorStop(1, 'rgba(255,240,200,0)');
      g.fillStyle = sun; g.fillRect(0, 0, W, hz);
    }
    // 云
    for (let i = 0; i < 9; i++) {
      const cx = rng.next() * W, cy = rng.next() * hz * 0.6, r = 30 + rng.next() * 50;
      g.fillStyle = b.weather === 'rain' ? 'rgba(80,86,92,0.55)' : 'rgba(255,255,255,0.55)';
      for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cx + (k - 3) * r * 0.45, cy + Math.sin(k) * 6, r * (0.5 + rng.next() * 0.4), r * 0.28, 0, 0, Math.PI * 2); g.fill(); }
    }
    // 远山：三层水墨
    const ranges = [
      { y: hz * 0.62, amp: hz * 0.32, col: 'rgba(120,140,150,0.45)' },
      { y: hz * 0.82, amp: hz * 0.26, col: 'rgba(85,108,112,0.62)' },
      { y: hz * 0.98, amp: hz * 0.18, col: 'rgba(62,84,78,0.85)' },
    ];
    for (const r of ranges) {
      g.fillStyle = r.col;
      g.beginPath(); g.moveTo(0, hz + 4);
      let y = r.y;
      for (let x = 0; x <= W; x += 14) {
        const peak = Math.sin(x / 90 + rng.next() * 0.5) * 0.5 + Math.sin(x / 37) * 0.25 + rng.next() * 0.25;
        y = r.y - Math.max(0, peak) * r.amp;
        g.lineTo(x, y);
      }
      g.lineTo(W, hz + 4); g.closePath(); g.fill();
      // 山脚雾
      const mist = g.createLinearGradient(0, r.y - r.amp * 0.3, 0, r.y + 6);
      mist.addColorStop(0, 'rgba(240,236,220,0)'); mist.addColorStop(1, 'rgba(240,236,220,0.55)');
      g.fillStyle = mist; g.fillRect(0, r.y - r.amp * 0.3, W, r.amp * 0.3 + 8);
    }
    // 地面
    const ground = g.createLinearGradient(0, hz, 0, H);
    if (b.kind === 'siege') { ground.addColorStop(0, '#8d9468'); ground.addColorStop(1, '#6f6a45'); }
    else if (b.terrain === 'hills') { ground.addColorStop(0, '#7f8f5a'); ground.addColorStop(1, '#5d6b3c'); }
    else { ground.addColorStop(0, '#93a565'); ground.addColorStop(1, '#5f7a3a'); }
    g.fillStyle = ground; g.fillRect(0, hz, W, H - hz);
    // 远树林带
    for (let x = -10; x < W + 10; x += 9 + rng.next() * 8) {
      const ty = hz + 2 + rng.next() * 6, th = 10 + rng.next() * 12;
      g.fillStyle = rng.chance(0.5) ? '#4d6a3e' : '#3f5a35';
      g.beginPath(); g.ellipse(x, ty - th * 0.4, th * 0.35, th * 0.6, 0, 0, Math.PI * 2); g.fill();
    }
    // 丘陵
    if (b.terrain === 'hills' || b.kind === 'siege') {
      for (let i = 0; i < 4; i++) {
        const cx = rng.next() * W, cy = hz + (H - hz) * (0.08 + rng.next() * 0.15), rw = 160 + rng.next() * 200;
        const gr = g.createLinearGradient(0, cy - 50, 0, cy + 10);
        gr.addColorStop(0, '#7f925a'); gr.addColorStop(1, '#6b7c48');
        g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rw, 46, 0, Math.PI, 0); g.fill();
      }
    }
    // 江：横贯中景，近宽远窄
    if (b.terrain === 'river') {
      const y0 = hz + (H - hz) * 0.12, y1 = hz + (H - hz) * 0.2;
      g.fillStyle = '#6c97a8';
      g.beginPath(); g.moveTo(0, y0); g.bezierCurveTo(W * 0.3, y0 - 8, W * 0.6, y0 + 10, W, y0 - 4); g.lineTo(W, y1 + 8); g.bezierCurveTo(W * 0.6, y1 + 16, W * 0.3, y1 - 4, 0, y1); g.closePath(); g.fill();
      g.fillStyle = 'rgba(230,240,240,0.35)';
      g.beginPath(); g.moveTo(0, y0); g.bezierCurveTo(W * 0.3, y0 - 8, W * 0.6, y0 + 10, W, y0 - 4); g.lineTo(W, y0); g.bezierCurveTo(W * 0.6, y0 + 13, W * 0.3, y0 - 5, 0, y0 + 3); g.closePath(); g.fill();
      // 芦苇
      for (let i = 0; i < 80; i++) { const x = rng.next() * W, y = y1 + rng.next() * 14; g.strokeStyle = '#6f7a3c'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 2, y - 8, x + 4, y - 14); g.stroke(); }
    }
    // 湖（平原上点缀）
    if (b.terrain === 'plain' && rng.chance(0.6)) {
      const cx = W * (0.15 + rng.next() * 0.7), cy = hz + (H - hz) * 0.1;
      g.fillStyle = '#7aa0ae'; g.beginPath(); g.ellipse(cx, cy, 120, 14, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(cx - 20, cy - 3, 60, 3, 0, 0, Math.PI * 2); g.fill();
    }
    // 道路
    g.strokeStyle = 'rgba(150,125,85,0.55)'; g.lineWidth = 1;
    g.fillStyle = 'rgba(160,135,90,0.35)';
    g.beginPath(); g.moveTo(W * 0.45, hz + 6); g.bezierCurveTo(W * 0.4, H * 0.6, W * 0.62, H * 0.8, W * 0.5, H); g.lineTo(W * 0.7, H); g.bezierCurveTo(W * 0.78, H * 0.8, W * 0.52, H * 0.6, W * 0.47, hz + 6); g.closePath(); g.fill();
    // 草丛、野花、石块（近大远小）
    for (let i = 0; i < 1400; i++) {
      const f = rng.next() ** 0.8;
      const y = hz + 8 + f * (H - hz - 8), x = rng.next() * W, s = 0.4 + f * 1.4;
      const r = rng.next();
      if (r < 0.82) {
        g.strokeStyle = rng.chance(0.5) ? 'rgba(60,85,35,0.55)' : 'rgba(120,145,70,0.55)'; g.lineWidth = 0.8 * s;
        for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + k * 2 * s, y - 4 * s, x + k * 3.5 * s, y - 7 * s); g.stroke(); }
      } else if (r < 0.92) {
        g.fillStyle = rng.pick(['#e8d36a', '#f2f0e8', '#d98f8f', '#c9a8e0']); g.beginPath(); g.arc(x, y - 2 * s, 1.3 * s, 0, Math.PI * 2); g.fill();
      } else {
        g.fillStyle = 'rgba(110,105,90,0.8)'; g.beginPath(); g.ellipse(x, y, 4 * s, 2.4 * s, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(200,195,175,0.5)'; g.beginPath(); g.ellipse(x - s, y - s, 2 * s, 1 * s, 0, 0, Math.PI * 2); g.fill();
      }
    }
    // 近景树
    if (b.kind === 'field') for (const tx of [W * 0.03, W * 0.97]) drawTree(g, tx, H * 0.98, 1.6, rng);
    else drawTree(g, W * 0.03, H * 0.98, 1.6, rng);
    for (let i = 0; i < 6; i++) drawTree(g, rng.next() * W, hz + (H - hz) * (0.05 + rng.next() * 0.08), 0.45, rng);
    this.bg = c; this.bgKey = key;
    return c;
  }

  /* ---------- 每帧 ---------- */
  draw(g: CanvasRenderingContext2D, F: SceneFrame) {
    const { W, H } = this;
    const b = F.b;
    g.drawImage(this.background(b), 0, 0, W, H);
    const now = F.now;
    // 流水
    if (b.terrain === 'river') {
      const y0 = this.horizon() + (this.H - this.horizon()) * 0.15;
      g.strokeStyle = 'rgba(235,245,245,0.45)'; g.lineWidth = 1;
      for (let i = 0; i < 26; i++) { const x = ((i * 97 + now / 30) % (W + 60)) - 30, y = y0 + (i % 5) * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 14, y); g.stroke(); }
    }
    // 倒下的士卒（累计伤亡）
    this.drawFallen(g, b);
    if (b.kind === 'siege') this.drawWall(g, F);
    // 三路，自远而近
    for (let i = 0; i < 3; i++) {
      this.drawFormation(g, F, 'att', i);
      this.drawFormation(g, F, 'def', i);
      this.drawLaneFx(g, F, i);
    }
    if (b.kind === 'siege') this.drawWallTop(g, F);
    this.drawWeather(g, b, now);
  }

  /* ---------- 城墙 ---------- */
  wallH(y: number) { return 34 + (y - this.horizon()) * 0.42; }
  drawWall(g: CanvasRenderingContext2D, F: SceneFrame) {
    const b = F.next && F.t > 0.5 ? F.next : F.b;
    const hz = this.horizon();
    const yTop = hz + 4, yBot = this.H + 20;
    const wh = (y: number) => this.wallH(y);
    const xl = (y: number) => this.wallX(y);
    const thick = (y: number) => 10 + (y - hz) * 0.12;
    const rng = makeRng(b.seed + 21);
    // 城内：瓦房、树（在墙后）
    const inner = (y: number) => xl(y) + thick(y);
    g.save();
    g.beginPath(); g.moveTo(inner(yTop), yTop - wh(yTop)); g.lineTo(this.W + 10, yTop - wh(yTop) - 20); g.lineTo(this.W + 10, yBot); g.lineTo(inner(yBot), yBot - wh(yBot)); g.closePath();
    g.fillStyle = '#7b7a62'; g.fill();
    g.clip();
    for (let k = 0; k < 70; k++) {
      const f = k / 70 + rng.next() * 0.02;
      const y = yTop + f * (yBot - yTop), base = y - wh(y);
      const x = inner(y) + 14 + rng.next() * (this.W - inner(y));
      const s = 0.5 + f * 1.5;
      if (rng.chance(0.18)) { // 树
        g.fillStyle = rng.chance(0.5) ? '#3f5f34' : '#4c6f3d';
        g.beginPath(); g.ellipse(x, base - 10 * s, 9 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
        continue;
      }
      // 房：白墙、黛瓦
      const w = (18 + rng.next() * 16) * s, h = 9 * s;
      g.fillStyle = '#e4dccb'; g.fillRect(x - w / 2, base - h, w, h);
      g.fillStyle = '#5c4632'; g.fillRect(x - 2 * s, base - h * 0.7, 4 * s, h * 0.7);
      g.fillStyle = '#3b3f42';
      g.beginPath(); g.moveTo(x - w / 2 - 4 * s, base - h + 1); g.quadraticCurveTo(x - w / 2, base - h - 1 * s, x - w / 2 + 3 * s, base - h - 6 * s);
      g.lineTo(x + w / 2 - 3 * s, base - h - 6 * s); g.quadraticCurveTo(x + w / 2, base - h - 1 * s, x + w / 2 + 4 * s, base - h + 1); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(200,200,190,0.25)'; g.lineWidth = 0.6;
      for (let r = 0; r < w; r += 3 * s) { g.beginPath(); g.moveTo(x - w / 2 + r, base - h - 5 * s); g.lineTo(x - w / 2 + r - 1, base - h); g.stroke(); }
    }
    // 远处一座塔
    const px = this.W * 0.95, py = yTop - wh(yTop) + 30;
    for (let k = 0; k < 6; k++) { const w = 22 - k * 3, yy = py - k * 12; g.fillStyle = '#d9cfb8'; g.fillRect(px - w / 2 + 3, yy - 9, w - 6, 9); g.fillStyle = '#3b3f42'; g.fillRect(px - w / 2, yy - 11, w, 3); }
    g.restore();
    // 护城河
    const moat = (y: number) => xl(y) - 8 - (y - hz) * 0.12;
    g.fillStyle = '#5e8794';
    g.beginPath(); g.moveTo(moat(yTop) - 10, yTop); g.lineTo(xl(yTop) - 2, yTop); g.lineTo(xl(yBot) - 4, yBot); g.lineTo(moat(yBot) - 50, yBot); g.closePath(); g.fill();
    g.fillStyle = 'rgba(220,240,240,0.18)';
    g.beginPath(); g.moveTo(moat(yTop) - 10, yTop); g.lineTo(moat(yTop) - 4, yTop); g.lineTo(moat(yBot) - 38, yBot); g.lineTo(moat(yBot) - 50, yBot); g.closePath(); g.fill();
    // 马道（墙顶）
    g.beginPath(); g.moveTo(xl(yTop), yTop - wh(yTop)); g.lineTo(inner(yTop), yTop - wh(yTop)); g.lineTo(inner(yBot), yBot - wh(yBot)); g.lineTo(xl(yBot), yBot - wh(yBot)); g.closePath();
    g.fillStyle = '#8c8577'; g.fill();
    // 墙面
    g.beginPath(); g.moveTo(xl(yTop), yTop - wh(yTop)); g.lineTo(xl(yBot), yBot - wh(yBot)); g.lineTo(xl(yBot), yBot); g.lineTo(xl(yTop), yTop); g.closePath();
    const fg = g.createLinearGradient(0, yBot - wh(yBot), 0, yBot);
    fg.addColorStop(0, '#b1a893'); fg.addColorStop(0.8, '#968d79'); fg.addColorStop(1, '#7b7363');
    g.fillStyle = fg; g.fill();
    g.save(); g.clip();
    // 砖缝：随透视的横缝 + 错缝竖缝
    const rows = 22;
    for (let r = 0; r <= rows; r++) {
      const f = r / rows;
      g.strokeStyle = r > rows - 3 ? 'rgba(50,45,38,0.45)' : 'rgba(70,64,54,0.3)'; g.lineWidth = r > rows - 3 ? 1.2 : 0.7;
      g.beginPath(); g.moveTo(xl(yTop), yTop - wh(yTop) * (1 - f)); g.lineTo(xl(yBot), yBot - wh(yBot) * (1 - f)); g.stroke();
      for (let c = 0; c < 46; c++) {
        const t2 = (c + (r % 2) * 0.5) / 46, y = yTop + t2 * (yBot - yTop), x = xl(y);
        const y1 = y - wh(y) * (1 - f), y2 = y - wh(y) * (1 - (r + 1) / rows);
        g.beginPath(); g.moveTo(x, y1); g.lineTo(x, y2); g.stroke();
      }
    }
    // 苔痕与水渍
    for (let k = 0; k < 40; k++) { const t2 = rng.next(), y = yTop + t2 * (yBot - yTop), x = xl(y); g.fillStyle = `rgba(70,90,50,${0.08 + rng.next() * 0.12})`; g.beginPath(); g.ellipse(x, y - wh(y) * rng.next() * 0.3, 6 + rng.next() * 12, 3 + rng.next() * 6, 0, 0, Math.PI * 2); g.fill(); }
    // 破损
    const dmg = 1 - b.wall / 100;
    g.strokeStyle = 'rgba(30,26,22,0.85)'; g.lineWidth = 1.8;
    for (let k = 0; k < dmg * 30; k++) {
      const t2 = rng.next(), y = yTop + t2 * (yBot - yTop), x = xl(y), yy = y - wh(y) * (0.2 + rng.next() * 0.75);
      const dir = (yBot - yTop) / (xl(yBot) - xl(yTop));
      g.beginPath(); g.moveTo(x, yy); g.lineTo(x - 6 - rng.next() * 10, yy + 6 + rng.next() * 14); g.lineTo(x - 2 - rng.next() * 14, yy + 16 + rng.next() * 18); g.stroke();
      void dir;
    }
    if (dmg > 0.4) for (let k = 0; k < 3; k++) { // 坍口
      const y = this.laneY(k), x = xl(y), top = y - wh(y);
      g.fillStyle = 'rgba(40,34,28,0.85)';
      g.beginPath(); g.moveTo(x - 12, top); g.lineTo(x + 2, top + wh(y) * 0.35 * dmg); g.lineTo(x - 22, top + wh(y) * 0.3 * dmg); g.closePath(); g.fill();
    }
    g.restore();
    // 墙脚碎石
    if (dmg > 0.25) for (let k = 0; k < 3; k++) {
      const y = this.laneY(k), x = xl(y);
      for (let r = 0; r < 14 * dmg; r++) { g.fillStyle = rng.chance(0.5) ? '#8f877a' : '#6f685c'; g.beginPath(); g.ellipse(x - 6 - rng.next() * 34, y - rng.next() * 6, 2 + rng.next() * 5, 1.5 + rng.next() * 3, 0, 0, Math.PI * 2); g.fill(); }
    }
    // 城门（中路）
    const gy = this.laneY(1), gx = xl(gy), gh = wh(gy) * 0.55;
    const slope = (xl(yBot) - xl(yTop)) / (yBot - yTop);
    const gw = 26 * this.laneS(1);
    g.fillStyle = '#20150d';
    g.beginPath();
    g.moveTo(gx - slope * -gw * 0.5, gy - 2 - gw * 0.5); g.lineTo(gx, gy - 2 + gw * 0.5);
    g.lineTo(gx, gy - gh); g.quadraticCurveTo(gx - slope * -gw * 0.25, gy - gh - 18, gx - slope * -gw * 0.5, gy - gh - gw * 0.5); g.closePath(); g.fill();
    g.strokeStyle = '#6d5a3f'; g.lineWidth = 2; g.stroke();
  }

  /** 垛口、城楼、城头守军 */
  drawWallTop(g: CanvasRenderingContext2D, F: SceneFrame, withDefenders = true) {
    const b = F.b;
    const hz = this.horizon();
    const wh = (y: number) => this.wallH(y);
    const xl = (y: number) => this.wallX(y);
    // 垛口：沿外缘
    for (let s = 0; s <= 1.0001; s += 0.022) {
      const y = hz + 4 + s * (this.H + 16 - hz), x = xl(y), top = y - wh(y), m = 4 + s * 9;
      g.fillStyle = '#a49b87'; g.fillRect(x - 1, top - m, m * 0.85, m);
      g.fillStyle = 'rgba(40,36,30,0.4)'; g.fillRect(x - 1, top - m, 1.4, m);
      g.fillStyle = 'rgba(255,255,240,0.15)'; g.fillRect(x - 1, top - m, m * 0.85, 1.2);
    }
    for (let i = 0; i < 3 && withDefenders; i++) {
      const l = b.def.lanes[i];
      const y = this.laneY(i), x = xl(y), top = y - wh(y), s = this.laneS(i) * 0.85;
      const n = l.routed ? 1 : Math.max(2, Math.min(9, Math.round(Math.sqrt(l.troops) / 9)));
      for (let k = 0; k < n; k++) drawSoldier(g, x + 8 * s + k * 9 * s, top - 2, s, 'inf', this.look.def, -1, F.now / 300 + k, false, 'idle', true);
    }
    // 城楼
    const gy = this.laneY(1), gx = xl(gy), top = gy - wh(gy), s = this.laneS(1) * 1.15;
    drawGateTower(g, gx + 30 * s, top - 4, s, this.look.def);
    // 角楼（远端）
    const fy = this.laneY(0) - 30, fx = xl(fy);
    drawGateTower(g, fx + 18, fy - wh(fy) - 2, this.laneS(0) * 0.7, this.look.def);
  }

  arrows(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number, seed: number) {
    const rng = makeRng(seed * 31 + 7);
    g.strokeStyle = 'rgba(40,30,20,0.85)'; g.lineWidth = 1.2;
    for (let k = 0; k < 8; k++) {
      const p = Math.min(1, Math.max(0, (t - 0.15) / 0.6 - rng.next() * 0.2));
      if (p <= 0 || p >= 1) continue;
      const x = x0 + (x1 - x0) * p + (rng.next() - 0.5) * 40, y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 60 + (rng.next() - 0.5) * 20;
      const a = Math.atan2((y1 - y0) - Math.cos(p * Math.PI) * 60 * Math.PI, x1 - x0);
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - Math.cos(a) * 10, y - Math.sin(a) * 10); g.stroke();
    }
  }

  /* ---------- 阵列 ---------- */
  laneFront(F: SceneFrame, side: 'att' | 'def', i: number): { x: number; alpha: number; moving: boolean; shake: number; flee: number } {
    const { W } = this;
    const b = F.b;
    const dir = side === 'att' ? 1 : -1;
    const siege = b.kind === 'siege';
    const y = this.laneY(i);
    const base = side === 'att' ? W * (siege ? 0.42 : 0.38) : (siege ? this.wallX(y) - 50 * this.laneS(i) : W * 0.62);
    const order = F.log ? (side === 'att' ? F.log.lanes[i]?.att : F.log.lanes[i]?.def) : undefined;
    const t = F.next ? F.t : 0;
    const adv = t < 0.35 ? t / 0.35 : t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3;
    const reach: Partial<Record<LaneOrder, number>> = { attack: 0.11, charge: 0.13, flank: 0.09, storm: 0.3, sap: 0.25, sortie: 0.12, withdraw: -0.06, blockade: -0.04 };
    let dx = dir * W * (reach[order as LaneOrder] ?? 0) * adv;
    if (siege && side === 'att' && order === 'storm') dx = (this.wallX(y) - 30 * this.laneS(i) - base) * adv;
    if (siege && side === 'def' && order !== 'sortie') dx = 0;
    const from = b[side].lanes[i], to = F.next ? F.next[side].lanes[i] : from;
    const flee = to.routed && !from.routed ? Math.max(0, (t - 0.55) / 0.45) : 0;
    const shake = t > 0.35 && t < 0.7 && order && !['withdraw', 'blockade', 'hold', 'repair'].includes(order) ? Math.sin(t * 80) * 2 : 0;
    return { x: base + dx - dir * flee * W * 0.35, alpha: from.routed ? 0 : (from.withdrawn && to.withdrawn ? 0.35 : 1 - flee * 0.9), moving: adv > 0.02 && adv < 0.98 && !!order && order !== 'hold', shake, flee };
  }

  drawFormation(g: CanvasRenderingContext2D, F: SceneFrame, side: 'att' | 'def', i: number) {
    const b = F.b;
    if (b.kind === 'siege' && side === 'def') {
      const order = F.log?.lanes[i]?.def;
      if (order !== 'sortie') return; // 守军在城头，出城突击时才下城
    }
    const st = this.laneFront(F, side, i);
    if (st.alpha <= 0.01) return;
    const from: Lane = b[side].lanes[i];
    const to: Lane = F.next ? F.next[side].lanes[i] : from;
    const t = F.next ? Math.min(1, Math.max(0, (F.t - 0.35) / 0.35)) : 0;
    const troops = from.troops + (to.troops - from.troops) * t;
    const s = this.laneS(i);
    const y0 = this.laneY(i);
    const dir = side === 'att' ? 1 : -1;
    const look = this.look[side];
    const mix = b[side].mix;
    const n = Math.max(4, Math.min(30, Math.round(Math.sqrt(troops) / 4.2)));
    const rows = n > 18 ? 3 : n > 8 ? 2 : 1;
    const rng = makeRng(i * 101 + (side === 'att' ? 1 : 2));
    // 兵种分配：骑兵在后翼，火器在前排
    const kinds: ('inf' | 'cav' | 'gun')[] = [];
    const nc = Math.round(mix.cav * n), ng = Math.round(mix.gun * n);
    for (let k = 0; k < n; k++) kinds.push(k < ng ? 'gun' : k >= n - nc ? 'cav' : 'inf');
    const order = F.log ? (side === 'att' ? F.log.lanes[i]?.att : F.log.lanes[i]?.def) : undefined;
    const firing = (order === 'volley' || order === 'bombard') && F.t > 0.15 && F.t < 0.65;
    const charging = order === 'charge' && st.moving;
    g.save();
    g.globalAlpha = st.alpha;
    const figs: { x: number; y: number; k: 'inf' | 'cav' | 'gun'; ph: number }[] = [];
    for (let k = 0; k < n; k++) {
      const c = Math.floor(k / rows), r = k % rows;
      const kind = kinds[k];
      const spacing = (kind === 'cav' ? 24 : 15) * s;
      const x = st.x - dir * (c * spacing + (r % 2) * 7 * s) + (rng.next() - 0.5) * 4 * s + st.shake;
      const y = y0 + (r - (rows - 1) / 2) * 10 * s + (rng.next() - 0.5) * 3 * s;
      figs.push({ x, y, k: kind, ph: rng.next() * 6 });
    }
    figs.sort((a, b2) => a.y - b2.y);
    for (const f of figs) {
      const pose = st.flee > 0 ? 'flee' : firing && f.k === 'gun' ? 'fire' : st.moving ? (charging ? 'charge' : 'walk') : 'idle';
      if (f.k === 'cav') drawCavalry(g, f.x, f.y, s, look, st.flee > 0 ? -dir : dir, F.now / (charging ? 90 : 160) + f.ph, pose !== 'idle');
      else drawSoldier(g, f.x, f.y, s, f.k, look, st.flee > 0 ? -dir : dir, F.now / 160 + f.ph, pose === 'walk' || pose === 'charge' || pose === 'flee', pose);
    }
    // 大旗
    const lead = figs.length ? figs.reduce((a, b2) => (dir > 0 ? (b2.x > a.x ? b2 : a) : (b2.x < a.x ? b2 : a))) : null;
    if (lead) drawStandard(g, lead.x - dir * 18 * s, lead.y - 2, s, look, i === 1 ? b[side].commanderName.slice(0, 1) : look.mark, F.now, b.weather === 'wind');
    // 火炮（炮击）
    if (order === 'bombard') {
      const cx = st.x + dir * 22 * s, cy = y0 + 6 * s;
      drawCannon(g, cx, cy, s, dir);
      if (firing) { puff(g, cx + dir * 22 * s, cy - 6 * s, s * 2.2, F.t); this.cannonball(g, cx, cy - 6 * s, this.wallX(y0), y0 - 60 * s, F.t); }
    }
    // 云梯（登城）
    if (order === 'storm' && b.kind === 'siege' && F.t > 0.3) {
      const wx = this.wallX(y0), top = y0 - (40 + (y0 - this.horizon()) * 0.55);
      g.strokeStyle = '#7a5530'; g.lineWidth = 2.2 * s;
      for (const off of [-14, 6]) {
        const bx = wx - 26 * s + off * s, by = y0 + off * 0.3 * s;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(wx + 2, top + 4); g.stroke();
        g.beginPath(); g.moveTo(bx + 6 * s, by); g.lineTo(wx + 6, top + 6); g.stroke();
        g.lineWidth = 1.2 * s;
        for (let r = 1; r < 8; r++) { const p = r / 8; g.beginPath(); g.moveTo(bx + (wx + 2 - bx) * p, by + (top + 4 - by) * p); g.lineTo(bx + 6 * s + (wx + 6 - bx - 6 * s) * p, by + (top + 6 - by) * p); g.stroke(); }
        g.lineWidth = 2.2 * s;
        // 攀爬者
        const p = Math.min(0.9, (F.t - 0.3) / 0.6);
        drawSoldier(g, bx + (wx - bx) * p + 2, by + (top - by) * p, s * 0.85, 'inf', look, 1, F.now / 120, true, 'walk');
      }
    }
    // 掘地：土堆
    if (order === 'sap' && b.kind === 'siege') {
      const wx = this.wallX(y0);
      g.fillStyle = '#7a5f3a'; g.beginPath(); g.ellipse(wx - 40 * s, y0 + 4 * s, 22 * s, 7 * s, 0, Math.PI, 0); g.fill();
    }
    g.restore();
  }

  cannonball(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number) {
    const p = Math.min(1, Math.max(0, (t - 0.2) / 0.35));
    if (p <= 0) return;
    if (p < 1) {
      const x = x0 + (x1 - x0) * p, y = y0 + (y1 - y0) * p - Math.sin(p * Math.PI) * 40;
      g.fillStyle = '#1b1a18'; g.beginPath(); g.arc(x, y, 3.2, 0, Math.PI * 2); g.fill();
    } else if (t < 0.8) {
      const q = (t - 0.55) / 0.25;
      const rng = makeRng(Math.round(x1));
      for (let k = 0; k < 10; k++) { const a = rng.next() * Math.PI * 2, d = q * (10 + rng.next() * 25); g.fillStyle = `rgba(120,112,100,${1 - q})`; g.fillRect(x1 + Math.cos(a) * d, y1 + Math.sin(a) * d, 3, 3); }
      puff(g, x1, y1, 2, 0.4 + q * 0.4);
    }
  }

  drawLaneFx(g: CanvasRenderingContext2D, F: SceneFrame, i: number) {
    if (!F.log || !F.next) return;
    const ev = F.log.lanes[i];
    if (!ev) return;
    const y = this.laneY(i), s = this.laneS(i);
    // 交锋尘土
    if (F.t > 0.3 && F.t < 0.75 && (ev.attLoss || ev.defLoss)) {
      const a = this.laneFront(F, 'att', i).x, d = this.laneFront(F, 'def', i).x;
      const mx = (a + d) / 2;
      if (Math.abs(a - d) < this.W * 0.2) for (let k = 0; k < 5; k++) puff(g, mx + (k - 2) * 12 * s, y - 4 * s, s * 1.3, (F.t - 0.3) / 0.45 + k * 0.05, 'rgba(170,150,110,');
    }
    // 伤亡数字
    if (F.t > 0.4) {
      const a = (F.t - 0.4) / 0.6;
      g.save(); g.globalAlpha = Math.max(0, 1 - a);
      g.font = `900 ${Math.round(16 * s + 4)}px "Noto Serif SC", serif`; g.textAlign = 'center';
      g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.6)';
      const ax = this.laneFront(F, 'att', i).x, dx = F.b.kind === 'siege' ? this.wallX(y) + 20 : this.laneFront(F, 'def', i).x;
      if (ev.attLoss) { g.strokeText('-' + ev.attLoss, ax - 30 * s, y - 50 * s - a * 30); g.fillStyle = '#ffd2c4'; g.fillText('-' + ev.attLoss, ax - 30 * s, y - 50 * s - a * 30); }
      if (ev.defLoss) { g.strokeText('-' + ev.defLoss, dx + 30 * s, y - 60 * s - a * 30); g.fillStyle = '#ffd2c4'; g.fillText('-' + ev.defLoss, dx + 30 * s, y - 60 * s - a * 30); }
      g.restore();
    }
  }

  drawFallen(g: CanvasRenderingContext2D, b: BattleState) {
    const total = b.att.startTroops - b.att.lanes.reduce((n, l) => n + l.troops, 0) + b.def.startTroops - b.def.lanes.reduce((n, l) => n + l.troops, 0);
    const n = Math.min(60, Math.round(total / 400));
    const rng = makeRng(b.seed + 11);
    for (let k = 0; k < n; k++) {
      const i = rng.int(0, 2), y = this.laneY(i) + (rng.next() - 0.5) * 16, s = this.laneS(i);
      const x = b.kind === 'siege' ? this.wallX(y) - 20 - rng.next() * this.W * 0.3 : this.W * (0.38 + rng.next() * 0.24);
      const col = rng.chance(0.5) ? this.look.att.color : this.look.def.color;
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(x, y + 2 * s, 9 * s, 2.5 * s, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = shade(col, -0.3); g.fillRect(x - 7 * s, y - 2.5 * s, 11 * s, 4 * s);
      g.fillStyle = SKIN; g.beginPath(); g.arc(x + 6 * s, y - 1 * s, 2.3 * s, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 1 * s; g.beginPath(); g.moveTo(x - 10 * s, y + 2 * s); g.lineTo(x + 12 * s, y - 4 * s); g.stroke();
    }
  }

  drawWeather(g: CanvasRenderingContext2D, b: BattleState, now: number) {
    const { W, H } = this;
    if (b.weather === 'rain') {
      g.strokeStyle = 'rgba(210,220,230,0.35)'; g.lineWidth = 1;
      const rng = makeRng(5);
      for (let k = 0; k < 220; k++) { const x = (rng.next() * W + now / 4) % W, y = (rng.next() * H + now / 1.6) % H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 14); g.stroke(); }
      g.fillStyle = 'rgba(40,50,60,0.12)'; g.fillRect(0, 0, W, H);
    }
    if (b.weather === 'fog') {
      for (let k = 0; k < 4; k++) {
        const y = this.horizon() + k * (H - this.horizon()) / 4, x = ((now / 40 + k * 300) % (W + 600)) - 300;
        const gr = g.createRadialGradient(x, y, 10, x, y, 320);
        gr.addColorStop(0, 'rgba(235,235,225,0.45)'); gr.addColorStop(1, 'rgba(235,235,225,0)');
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
    }
    // 暗角
    const v = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, W * 0.75);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,10,0,0.42)');
    g.fillStyle = v; g.fillRect(0, 0, W, H);
  }
}

/* ================= 人物与器物 ================= */
export function drawSoldier(g: CanvasRenderingContext2D, x: number, y: number, s: number, kind: 'inf' | 'gun' | 'cav', look: SideLook, dir: number, ph: number, moving: boolean, pose: string, halfBody = false) {
  const col = look.color, dark = shade(col, -0.35);
  const step = moving ? Math.sin(ph * 2) : 0;
  const bob = moving ? Math.abs(Math.sin(ph * 2)) * 1.2 * s : Math.sin(ph) * 0.3 * s;
  g.save();
  g.translate(x, y - bob);
  g.scale(dir * s, s);
  if (!halfBody) {
    // 影子
    g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, bob / s + 0.5, 7, 2, 0, 0, Math.PI * 2); g.fill();
    // 腿
    g.strokeStyle = '#2b2520'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-1, -11); g.lineTo(-1 - step * 3.5, 0); g.stroke();
    g.beginPath(); g.moveTo(1.5, -11); g.lineTo(1.5 + step * 3.5, 0); g.stroke();
    g.fillStyle = '#1e1a16'; g.fillRect(-2.5 - step * 3.5, -1, 3.5, 1.6); g.fillRect(0.5 + step * 3.5, -1, 3.5, 1.6);
  }
  // 身：罩甲（势力色）+ 甲片
  g.fillStyle = col;
  g.beginPath(); g.moveTo(-4.5, -22); g.lineTo(4.5, -22); g.lineTo(5.5, -10); g.lineTo(-5.5, -10); g.closePath(); g.fill();
  g.strokeStyle = dark; g.lineWidth = 0.6;
  for (let r = -20; r < -11; r += 2.4) { g.beginPath(); g.moveTo(-5, r); g.lineTo(5, r); g.stroke(); }
  g.fillStyle = '#2a2420'; g.fillRect(-5.2, -12.5, 10.4, 1.6); // 腰带
  // 头
  g.fillStyle = SKIN; g.beginPath(); g.arc(0.5, -25.5, 3.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2a1e16'; g.fillRect(2, -26.3, 1.1, 1); // 眼
  // 盔
  switch (look.helmet) {
    case 'ming':
      g.fillStyle = IRON; g.beginPath(); g.arc(0.3, -26.4, 3.8, Math.PI, 0); g.fill();
      g.fillRect(-3.8, -26.6, 7.8, 1.3);
      g.strokeStyle = '#555'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0.3, -30); g.lineTo(0.3, -32.5); g.stroke();
      g.fillStyle = '#c2271d'; g.beginPath(); g.ellipse(0.3, -33, 1.6, 1.2, 0, 0, Math.PI * 2); g.fill();
      break;
    case 'qing':
      g.fillStyle = '#45403a'; g.beginPath(); g.arc(0.3, -26.4, 3.8, Math.PI, 0); g.fill();
      g.fillStyle = '#c9a13f'; g.fillRect(-0.2, -34, 1.1, 4);
      g.fillStyle = '#8f1d16'; g.beginPath(); g.moveTo(0.3, -38); g.quadraticCurveTo(-2.5, -35, 0.3, -33.5); g.fill();
      g.fillStyle = '#3a342e'; g.fillRect(-4.2, -26.2, 8.6, 1.2);
      break;
    case 'shun':
      g.fillStyle = '#7b2a1e'; g.beginPath(); g.ellipse(0.3, -27.3, 4.1, 2.8, 0, Math.PI, 0); g.fill();
      g.fillRect(-4, -27.3, 8.4, 1.6);
      g.beginPath(); g.moveTo(-3.8, -27); g.quadraticCurveTo(-7, -25, -6.5, -22); g.lineTo(-5.4, -23); g.quadraticCurveTo(-6, -25.5, -3.2, -26); g.fill();
      break;
    case 'xi':
      g.fillStyle = '#b8902c'; g.beginPath(); g.ellipse(0.3, -27.6, 4.2, 3, 0, Math.PI, 0); g.fill(); g.fillRect(-4, -27.6, 8.4, 1.6);
      break;
    default:
      g.fillStyle = '#4a3f33'; g.beginPath(); g.moveTo(-5.5, -27); g.lineTo(6, -27); g.lineTo(0.3, -31.5); g.closePath(); g.fill();
  }
  // 兵器
  if (kind === 'gun') {
    const aim = pose === 'fire' || pose === 'aim';
    g.save();
    g.translate(3, -18);
    g.rotate(aim ? -0.05 : -0.9);
    g.fillStyle = '#5a3b22'; g.fillRect(-4, -1, 8, 2.4);
    g.fillStyle = '#2b2622'; g.fillRect(3, -0.6, 13, 1.4);
    g.restore();
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(-1, -20); g.lineTo(4, -17.5); g.stroke();
    if (pose === 'fire') puff(g, 19, -19, 0.9, (ph % 1));
  } else {
    // 长枪：攻击时放平
    const level = pose === 'charge' || pose === 'walk' ? -0.25 : pose === 'flee' ? -2.2 : -1.25;
    g.save();
    g.translate(2, -17);
    g.rotate(level);
    g.strokeStyle = '#6b4a2a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-8, 0); g.lineTo(22, 0); g.stroke();
    g.fillStyle = '#c9c9c4'; g.beginPath(); g.moveTo(22, -1.4); g.lineTo(27, 0); g.lineTo(22, 1.4); g.closePath(); g.fill();
    g.fillStyle = '#c2271d'; g.beginPath(); g.arc(21, 1.2, 1.3, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.moveTo(-1, -20); g.lineTo(3, -16.5); g.stroke();
    g.fillStyle = SKIN; g.beginPath(); g.arc(3, -16.5, 1.2, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function drawCavalry(g: CanvasRenderingContext2D, x: number, y: number, s: number, look: SideLook, dir: number, ph: number, moving: boolean) {
  const gal = moving ? Math.sin(ph * 2) : 0;
  const bob = moving ? Math.abs(Math.sin(ph * 2)) * 2 * s : 0;
  g.save();
  g.translate(x, y - bob);
  g.scale(dir * s, s);
  g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(0, bob / s + 0.5, 15, 2.6, 0, 0, Math.PI * 2); g.fill();
  const horse = look.helmet === 'qing' ? '#4a3a2c' : look.helmet === 'shun' ? '#7a5a3a' : '#5c4030';
  // 马腿
  g.strokeStyle = shade(horse, -0.3); g.lineWidth = 2.2; g.lineCap = 'round';
  const legs: [number, number][] = [[-9, gal], [-6, -gal], [7, -gal], [10, gal]];
  for (const [lx, p] of legs) { g.beginPath(); g.moveTo(lx, -11); g.lineTo(lx + p * 5, -5); g.lineTo(lx + p * 3, 0); g.stroke(); }
  // 马身
  g.fillStyle = horse; g.beginPath(); g.ellipse(0, -14, 13, 5.6, 0, 0, Math.PI * 2); g.fill();
  // 马颈与头
  g.beginPath(); g.moveTo(8, -17); g.quadraticCurveTo(13, -25, 15, -27); g.lineTo(20, -24); g.lineTo(19, -21.5); g.lineTo(14, -21); g.lineTo(11, -12); g.closePath(); g.fill();
  g.fillStyle = '#1e1712'; g.beginPath(); g.moveTo(9, -18); g.quadraticCurveTo(11, -25, 14, -28); g.lineTo(13, -24); g.closePath(); g.fill(); // 鬃
  g.strokeStyle = '#1e1712'; g.lineWidth = 2; g.beginPath(); g.moveTo(-13, -15); g.quadraticCurveTo(-18, -12 + gal * 2, -17, -6); g.stroke(); // 尾
  // 鞍鞯
  g.fillStyle = look.color; g.fillRect(-6, -19, 10, 7);
  g.fillStyle = shade(look.color, -0.3); g.fillRect(-6, -13, 10, 1.4);
  g.restore();
  // 骑手
  drawSoldier(g, x - dir * 1 * s, y - bob - 13 * s, s * 0.95, 'inf', look, dir, ph, false, moving ? 'charge' : 'idle', true);
}

export function drawStandard(g: CanvasRenderingContext2D, x: number, y: number, s: number, look: SideLook, mark: string, now: number, windy: boolean) {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.strokeStyle = '#3a2716'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -62); g.stroke();
  g.fillStyle = '#c9a13f'; g.beginPath(); g.moveTo(-2, -62); g.lineTo(0, -68); g.lineTo(2, -62); g.closePath(); g.fill();
  const w = 26, h = 20, ph = now / (windy ? 120 : 260);
  g.beginPath();
  g.moveTo(0, -60);
  for (let k = 0; k <= 8; k++) { const xx = (k / 8) * w; g.lineTo(xx, -60 + Math.sin(ph + k * 0.7) * 1.6 * (k / 8)); }
  if (look.flag === 'swallow') { g.lineTo(w * 0.72, -60 + h / 2); }
  for (let k = 8; k >= 0; k--) { const xx = (k / 8) * w; g.lineTo(xx, -60 + h + Math.sin(ph + k * 0.7) * 1.6 * (k / 8)); }
  g.closePath();
  g.fillStyle = look.color; g.fill();
  g.strokeStyle = look.helmet === 'qing' ? '#c9a13f' : '#2a1e14'; g.lineWidth = look.helmet === 'qing' ? 2 : 1; g.stroke();
  g.fillStyle = '#fff4dc'; g.font = '900 12px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(mark, w * 0.45, -60 + h / 2 + Math.sin(ph + 3) * 0.8);
  g.restore();
}

function drawCannon(g: CanvasRenderingContext2D, x: number, y: number, s: number, dir: number) {
  g.save(); g.translate(x, y); g.scale(dir * s, s);
  g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 1, 16, 3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#4a3420'; g.fillRect(-12, -6, 18, 4);
  g.fillStyle = '#3b3a37'; g.save(); g.translate(-2, -9); g.rotate(-0.18); g.fillRect(-10, -3, 26, 6); g.fillStyle = '#5a5853'; g.fillRect(-10, -3, 26, 1.5); g.restore();
  g.fillStyle = '#5a3b22'; for (const wx of [-8, 4]) { g.beginPath(); g.arc(wx, -2, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2b1d12'; g.beginPath(); g.arc(wx, -2, 1.2, 0, Math.PI * 2); g.fill(); g.fillStyle = '#5a3b22'; }
  g.restore();
}

function drawGateTower(g: CanvasRenderingContext2D, x: number, y: number, s: number, look: SideLook) {
  g.save(); g.translate(x, y); g.scale(s, s);
  // 台基与柱
  g.fillStyle = '#7f7a6e'; g.fillRect(-30, -6, 60, 6);
  g.fillStyle = '#8b2a1e'; for (const px of [-24, -10, 4, 18]) g.fillRect(px, -26, 3, 20);
  g.fillStyle = '#5a1f16'; g.fillRect(-26, -26, 50, 3);
  // 下檐
  roof(g, 0, -26, 64, 12);
  g.fillStyle = '#8b2a1e'; for (const px of [-16, -2, 12]) g.fillRect(px, -50, 3, 13);
  roof(g, 0, -50, 48, 12);
  // 旗
  g.strokeStyle = '#3a2716'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(26, -32); g.lineTo(26, -70); g.stroke();
  g.fillStyle = look.color; g.beginPath(); g.moveTo(26, -70); g.lineTo(40, -66); g.lineTo(26, -60); g.closePath(); g.fill();
  g.restore();
}
function roof(g: CanvasRenderingContext2D, cx: number, y: number, w: number, h: number) {
  g.fillStyle = '#2f3437';
  g.beginPath();
  g.moveTo(cx - w / 2 - 6, y - 2); g.quadraticCurveTo(cx - w / 2, y, cx - w / 2 + 6, y - 3);
  g.lineTo(cx - w / 4, y - h); g.lineTo(cx + w / 4, y - h);
  g.lineTo(cx + w / 2 - 6, y - 3); g.quadraticCurveTo(cx + w / 2, y, cx + w / 2 + 6, y - 2);
  g.lineTo(cx + w / 2 - 4, y + 1); g.lineTo(cx - w / 2 + 4, y + 1); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(200,200,190,0.25)'; g.lineWidth = 0.6;
  for (let k = -w / 2 + 6; k < w / 2 - 6; k += 3) { g.beginPath(); g.moveTo(cx + k * 0.55, y - h + 1); g.lineTo(cx + k, y - 1); g.stroke(); }
  g.fillStyle = '#1e2224'; g.fillRect(cx - w / 4 - 1, y - h - 1.5, w / 2 + 2, 2);
}

function drawTree(g: CanvasRenderingContext2D, x: number, y: number, s: number, rng: Rng) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, 0, 22, 5, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#4a3624'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-4, -24, 2, -46); g.stroke();
  g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -24); g.lineTo(-14, -36); g.moveTo(1, -34); g.lineTo(14, -44); g.stroke();
  const greens = ['#3f5f34', '#4c6f3d', '#5c7f45', '#36522d'];
  for (let k = 0; k < 9; k++) {
    g.fillStyle = greens[k % 4];
    g.beginPath(); g.ellipse((rng.next() - 0.5) * 34, -50 - rng.next() * 22, 12 + rng.next() * 7, 9 + rng.next() * 5, 0, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function puff(g: CanvasRenderingContext2D, x: number, y: number, s: number, t: number, base = 'rgba(235,235,228,') {
  const a = Math.max(0, Math.min(1, t));
  for (let k = 0; k < 4; k++) {
    g.fillStyle = base + (0.55 * (1 - a)) + ')';
    g.beginPath(); g.arc(x + k * 3 * s + a * 8 * s, y - k * 1.5 * s - a * 6 * s, (3 + k + a * 6) * s, 0, Math.PI * 2); g.fill();
  }
}

export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}
