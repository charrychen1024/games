/* 即时战斗画面的共用底层：纵深透视、小兵贴图、飘字、弹道、军心泛红。
 * 攻城（siegeView.ts）与野战、水战（fieldView.ts）都从这里派生。画面只读模拟状态，不改它。 */
import { ink, tint, paper, mountains, mkRnd, puff, splatter, agedEdges, grass, rock, bush } from './ink';
/** 一方的样貌：旗色、头盔式样、旗号 */
export interface SideLook { color: string; helmet: 'ming' | 'qing' | 'shun' | 'xi' | 'plain'; flag: string; mark: string }
/** 颜色加深（k<0）或提亮（k>0） */
export function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c + (k < 0 ? c * k : (255 - c) * k))));
  return '#' + [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(f).map(v => v.toString(16).padStart(2, '0')).join('');
}

export interface ViewOpts { me: 'att' | 'def'; look: { att: SideLook; def: SideLook }; }
export interface Float { x: number; y: number; text: string; t0: number; color: string; big?: boolean }
export interface Shot { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; kind: 'ball' | 'arrow' | 'smoke' | 'flash' | 'fire' | 'dust' | 'ink'; seed?: number }
/** 画面需要的一营的最少信息 */
export interface VUnit { id: string; side: 'att' | 'def'; kind: string; name: string; troops: number; start: number; morale: number; x: number; y: number; state: string; hit: number; engaged: boolean }
export interface Camera { near: number; far: number; k: number; kx: number; ky: number }

export abstract class RtView {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  o: ViewOpts;
  selected: string | null = null;
  /** 框选、编组带上的其余诸营 */
  group: string[] = [];
  /** 框选中的矩形（屏幕坐标） */
  box: [number, number, number, number] | null = null;
  floats: Float[] = [];
  shots: Shot[] = [];
  shake = 0;
  now = 0;
  sprites = new Map<string, HTMLCanvasElement>();
  bg: HTMLCanvasElement | null = null; bgKey = '';
  hitAcc = new Map<string, number>();
  lastFloat = 0;
  reduced = false;
  /** 屏幕横向留边：近处的营不会被挤出画面 */
  edge = 40;
  /** 守方镜头是否左右翻转（野战翻转，好让敌我各自的“左翼”都在自己左手边；攻城不翻，城墙各段名与画面一致） */
  flipDef = true;
  /** 本帧已画的头顶读数（防重叠） */
  labelRects: [number, number, number, number][] = [];

  constructor(parent: HTMLElement, o: ViewOpts) {
    this.o = o;
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
  abstract cam(): Camera;
  get hz() { return this.H * 0.13; }
  /** 离镜头的距离（世界单位）：我方一侧近 */
  depth(y: number) { const c = this.cam(); return this.o.me === 'att' ? c.near - y : y + c.far; }
  scale(y: number) { const c = this.cam(); return c.k * 1300 / this.depth(y); }
  P(x: number, y: number, z = 0): [number, number, number] {
    const c = this.cam(), s = this.scale(y);
    const sx = this.W / 2 + (x - 500) * this.W * c.kx * s / 1000 * 2.1 * (this.o.me === 'att' || !this.flipDef ? 1 : -1);
    const sy = this.hz + this.H * s * c.ky - z * s * this.H / 260;
    return [sx, sy, s];
  }
  /** 画营时用：横向夹在画面之内（近处的营偏到边上也看得见） */
  /** 框选矩形 */
  drawBox(g: CanvasRenderingContext2D) {
    if (!this.box) return;
    const [x0, y0, x1, y1] = this.box;
    g.save(); g.fillStyle = 'rgba(255,214,120,0.08)'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = 'rgba(255,214,120,0.85)'; g.lineWidth = 1.5; g.setLineDash([6, 4]); g.strokeRect(x0, y0, x1 - x0, y1 - y0); g.restore();
  }
  /** 地势高低（2.5D）：子类按地形给出某处地面的高度，人马站在坡上随之抬高 */
  lift(_x: number, _y: number): number { return 0; }
  PU(x: number, y: number, z = 0): [number, number, number] {
    const p = this.P(x, y, z + this.lift(x, y));
    p[0] = Math.max(this.edge, Math.min(this.W - this.edge, p[0]));
    return p;
  }
  unproject(sx: number, sy: number): [number, number] {
    let lo = -300, hi = 1300;
    for (let k = 0; k < 32; k++) { const m = (lo + hi) / 2; const [, py] = this.P(500, m); if ((py < sy) === (this.o.me === 'att')) lo = m; else hi = m; }
    const y = (lo + hi) / 2;
    const c = this.cam(), s = this.scale(y);
    const x = 500 + (sx - this.W / 2) / (this.W * c.kx * s / 1000 * 2.1) * (this.o.me === 'att' || !this.flipDef ? 1 : -1);
    return [x, y];
  }

  /* ---------- 小兵贴图（预渲染）：墨线勾勒、号衣淡彩 ---------- */
  sprite(side: 'att' | 'def', kind: string, facing: 'back' | 'front', frame: number): HTMLCanvasElement {
    const key = `${side}${kind}${facing}${frame}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const look = this.o.look[side];
    c = document.createElement('canvas'); c.width = 96; c.height = 128;
    const g = c.getContext('2d')!;
    g.scale(2, 2); g.translate(24, 60);
    const col = tint(look.color, 0.22), dark = shade(col, -0.35), skin = '#ead7b4', line = ink(0.92, 0.95);
    const helmet = look.helmet === 'qing' ? ink(0.9) : look.helmet === 'ming' ? ink(0.6) : look.helmet === 'shun' ? '#6b5638' : look.helmet === 'xi' ? '#5a4632' : ink(0.7);
    const step = frame ? 2 : -2;
    g.lineCap = 'round'; g.lineJoin = 'round';
    const outline = (w = 1.1) => { g.strokeStyle = line; g.lineWidth = w; g.stroke(); };
    const head = (x: number, y: number, r: number) => {
      g.fillStyle = facing === 'front' ? skin : shade(skin, -0.25); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); outline(0.9);
      g.fillStyle = helmet; g.beginPath(); g.arc(x, y - r * 0.35, r * 1.08, Math.PI, Math.PI * 2); g.closePath(); g.fill();
      if (look.helmet === 'ming') { g.strokeStyle = '#b8352a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, y - r * 1.4); g.lineTo(x, y - r * 2.4); g.stroke(); }
      if (look.helmet === 'qing') { g.strokeStyle = '#b89448'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - r * 1.4); g.lineTo(x, y - r * 2.7); g.stroke(); }
    };
    const spear = (x0: number, y0: number, x1: number, y1: number) => {
      g.strokeStyle = ink(0.85, 0.9); g.lineWidth = 1.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      g.fillStyle = ink(0.95); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x1 - 1.6, y1 + 5); g.lineTo(x1 + 1.6, y1 + 5); g.closePath(); g.fill();
      g.strokeStyle = '#b8352a'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x1 - 1.5, y1 + 6.5); g.lineTo(x1 + 1.5, y1 + 6.5); g.stroke();
    };
    if (kind === 'cav') {
      // 马：墨笔一气，腿四笔，鬃尾飞白
      g.fillStyle = facing === 'front' ? '#6a5038' : '#5a4430';
      g.beginPath(); g.ellipse(0, -15, 8.5, 13.5, 0, 0, Math.PI * 2); g.fill(); outline(1.2);
      g.strokeStyle = line; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(-4, -5); g.lineTo(-4 - step * 0.6, 0); g.moveTo(4, -5); g.lineTo(4 + step * 0.6, 0); g.stroke();
      if (facing === 'front') { g.fillStyle = '#6a5038'; g.beginPath(); g.ellipse(0, -28, 3.8, 7, 0, 0, Math.PI * 2); g.fill(); outline(1); }
      else { g.strokeStyle = ink(0.9, 0.7); g.lineWidth = 1.4; g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(-3 + step, 2, -1 + step, 5); g.stroke(); }
      g.fillStyle = col; g.beginPath(); g.moveTo(-6, -24); g.lineTo(-5, -37); g.lineTo(5, -37); g.lineTo(6, -24); g.closePath(); g.fill(); outline();
      head(0, -40.5, 4.2);
      spear(7, -22, 11, -60);
    } else if (kind === 'art') {
      g.fillStyle = '#5a4430'; g.fillRect(-14, -10, 28, 4.5); g.strokeStyle = line; g.lineWidth = 1; g.strokeRect(-14, -10, 28, 4.5);
      g.fillStyle = ink(0.95); g.beginPath(); g.ellipse(0, facing === 'back' ? -14 : -12, 6, facing === 'back' ? 10 : 6, 0, 0, Math.PI * 2); g.fill();
      for (const wx of [-12, 12]) { g.fillStyle = '#6a5038'; g.beginPath(); g.ellipse(wx, -8, 3, 7, 0, 0, Math.PI * 2); g.fill(); outline(1); }
      for (const dx of [-19, 19]) { g.fillStyle = col; g.beginPath(); g.moveTo(dx - 4, -14); g.lineTo(dx - 3.5, -26); g.lineTo(dx + 3.5, -26); g.lineTo(dx + 4, -14); g.closePath(); g.fill(); outline(); head(dx, -29.5, 3.4); }
    } else {
      g.strokeStyle = line; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(-3, -14); g.lineTo(-3 - step * 0.6, 0); g.moveTo(3, -14); g.lineTo(3 + step * 0.6, 0); g.stroke();
      // 号衣：下摆略宽，腰间一道墨
      g.fillStyle = col; g.beginPath(); g.moveTo(-7.5, -13); g.lineTo(-6, -30); g.lineTo(6, -30); g.lineTo(7.5, -13); g.closePath(); g.fill(); outline();
      g.strokeStyle = dark; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-6.6, -20); g.lineTo(6.6, -20); g.stroke();
      if (facing === 'front') { g.fillStyle = 'rgba(255,248,230,0.75)'; g.beginPath(); g.arc(0, -24.5, 2.6, 0, Math.PI * 2); g.fill(); }
      head(0, -34, 4.4);
      if (kind === 'gun') { g.strokeStyle = ink(0.95); g.lineWidth = 2; g.beginPath(); g.moveTo(5, -22); g.lineTo(10, -46); g.stroke(); g.fillStyle = '#7a5530'; g.fillRect(4, -25, 3, 6); }
      else spear(7, -16, 9.5, -58);
      if (kind === 'inf' && facing === 'front') { g.fillStyle = shade(col, -0.15); g.beginPath(); g.ellipse(-6.5, -22, 3.8, 6, 0, 0, Math.PI * 2); g.fill(); outline(0.9); }
    }
    this.sprites.set(key, c);
    return c;
  }

  /** 大旗：墨杆、火焰牙边、旗心写本方字号；wave 为飘动相位 */
  banner(g: CanvasRenderingContext2D, x: number, y: number, h: number, side: 'att' | 'def', wave = 0) {
    const look = this.o.look[side];
    const col = tint(look.color, 0.15), fw = h * 0.42, fh = h * 0.5, top = y - h;
    g.save(); g.lineCap = 'round';
    g.strokeStyle = ink(0.92); g.lineWidth = Math.max(1.2, h * 0.025);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, top - h * 0.06); g.stroke();
    g.fillStyle = ink(0.95); g.beginPath(); g.moveTo(x, top - h * 0.12); g.lineTo(x - h * 0.025, top - h * 0.04); g.lineTo(x + h * 0.025, top - h * 0.04); g.closePath(); g.fill();
    const w = (t: number) => Math.sin(wave + t * 3.2) * fh * 0.06 * t;
    g.fillStyle = col;
    g.beginPath(); g.moveTo(x, top);
    for (let t = 0; t <= 1; t += 0.1) g.lineTo(x + fw * t, top + w(t));
    for (let k = 0; k <= 6; k++) { const yy = top + fh * k / 6; g.lineTo(x + fw + w(1) + (k % 2 ? fh * 0.07 : 0), yy + w(1)); }
    for (let t = 1; t >= 0; t -= 0.1) g.lineTo(x + fw * t, top + fh + w(t));
    g.closePath(); g.fill();
    g.strokeStyle = ink(0.9, 0.85); g.lineWidth = Math.max(0.7, h * 0.012); g.stroke();
    if (look.mark && h > 26) {
      const cx = x + fw * 0.5 + w(0.5), cy = top + fh * 0.5 + w(0.5), rr = Math.min(fw, fh) * 0.34;
      g.fillStyle = 'rgba(245,236,214,0.92)'; g.beginPath(); g.arc(cx, cy, rr, 0, Math.PI * 2); g.fill();
      g.fillStyle = ink(0.95); g.font = `900 ${Math.round(rr * 1.45)}px "Ma Shan Zheng","Noto Serif SC",serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(look.mark.slice(0, 1), cx, cy + rr * 0.06);
    }
    g.restore();
  }

  /** 一营脚下的墨影与尘：让一片人马“坐”在地上、看得出成阵 */
  footprint(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, moving: boolean, seed: number) {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
    gr.addColorStop(0, ink(0.6, 0.22)); gr.addColorStop(0.7, ink(0.5, 0.1)); gr.addColorStop(1, ink(0.4, 0));
    g.save(); g.translate(cx, cy); g.scale(1, ry / rx); g.translate(-cx, -cy);
    g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, rx, 0, Math.PI * 2); g.fill(); g.restore();
    if (moving && !this.reduced) puff(g, cx, cy - ry * 0.2, rx * 0.6, '150,130,95', 0.16, seed + Math.floor(this.now / 300));
  }

  /** 一营头顶的读数：名、兵数、士气条；溃散时标红 */
  label(g: CanvasRenderingContext2D, u: VUnit, cx: number, top: number, px: number, note?: string) {
    const label = u.state === 'rout' ? `${u.name} 溃` : `${u.name} ${fmtN(u.troops)}${note ? ' · ' + note : ''}`;
    g.font = `700 ${Math.max(10.5, Math.min(14, px * 0.32))}px "Noto Serif SC", serif`;
    const tw = g.measureText(label).width + 12;
    let ly = Math.max(14, top - 14);
    // 与已画的读数重叠就往上挪（最多挪四次），免得几营挤在一处时字压字
    for (let k = 0; k < 4; k++) {
      const hit = this.labelRects.find(([x, y, w]) => Math.abs(x - cx) < (w + tw) / 2 && Math.abs(y - ly) < 18);
      if (!hit) break;
      ly = hit[1] - 19;
    }
    this.labelRects.push([cx, ly, tw, 18]);
    const mine = u.side === this.o.me;
    g.fillStyle = mine ? 'rgba(20,12,6,0.86)' : 'rgba(70,14,8,0.86)';
    g.fillRect(cx - tw / 2, ly - 9, tw, 16);
    // 我军左侧金边、敌军红边，一眼分清
    g.fillStyle = mine ? '#e8c26a' : '#e0503f'; g.fillRect(cx - tw / 2, ly - 9, 3, 16);
    g.fillStyle = u.state === 'rout' ? '#ff9a8a' : '#f3e6c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, cx + 1, ly - 1);
    const mw = tw - 8, mf = Math.max(0, u.morale) / 100;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(cx - mw / 2, ly + 8, mw, 3);
    g.fillStyle = mf > 0.5 ? '#9fd18f' : mf > 0.28 ? '#e8a447' : '#e0503f'; g.fillRect(cx - mw / 2, ly + 8, mw * mf, 3);
  }

  /** 伤亡飘字：攒一阵再飘，免得满屏数字 */
  harvestHits(now: number, units: VUnit[], zOf: (u: VUnit) => number = () => 0) {
    for (const u of units) if (u.hit > 0) this.hitAcc.set(u.id, (this.hitAcc.get(u.id) ?? 0) + u.hit);
    if (now - this.lastFloat > 650) {
      this.lastFloat = now;
      for (const [id, n] of this.hitAcc) {
        if (n < 3) continue;     // 零星伤亡不飘字，免得满屏数字
        const u = units.find(x => x.id === id); if (!u) continue;
        const [x, y, s] = this.PU(u.x, u.y, zOf(u));
        this.floats.push({ x: x + (Math.random() - 0.5) * 30, y: y - this.H * s * 0.2, text: '−' + Math.round(n), t0: now, color: u.side === this.o.me ? '#ffb3a6' : '#fff1cf' });
      }
      this.hitAcc.clear();
    }
  }
  drawShots(g: CanvasRenderingContext2D, now: number) {
    this.shots = this.shots.filter(s => now - s.t0 < s.dur);
    for (const s of this.shots) {
      const p = (now - s.t0) / s.dur;
      if (s.kind === 'smoke') { puff(g, s.x0 + p * 12, s.y0 - p * (s.y0 - s.y1), 6 + p * 20, '120,116,108', 0.42 * (1 - p), s.seed ?? 3); continue; }
      if (s.kind === 'dust') { puff(g, s.x0 + (s.x1 - s.x0) * p, s.y0 - p * 14, 10 + p * 26, '125,105,75', 0.34 * (1 - p), s.seed ?? 5); continue; }
      if (s.kind === 'ink') { splatter(g, s.x0, s.y0, 10 + p * 18, 0.7 * (1 - p), s.seed ?? 7); continue; }
      if (s.kind === 'flash') { g.fillStyle = `rgba(255,240,200,${0.9 * (1 - p)})`; g.beginPath(); g.arc(s.x0, s.y0, 3 + p * 8, 0, Math.PI * 2); g.fill(); continue; }
      if (s.kind === 'fire') {
        for (let k = 0; k < 5; k++) { const a = (1 - p) * 0.8; g.fillStyle = k % 2 ? `rgba(255,140,40,${a})` : `rgba(255,220,90,${a})`; g.beginPath(); g.ellipse(s.x0 + (k - 2) * 9, s.y0 - p * 40 - k * 6, 10 + p * 16, 16 + p * 24, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = `rgba(60,50,45,${0.5 * (1 - p)})`; g.beginPath(); g.ellipse(s.x0, s.y0 - 60 - p * 80, 30 + p * 40, 18 + p * 20, 0, 0, Math.PI * 2); g.fill();
        continue;
      }
      const x = s.x0 + (s.x1 - s.x0) * p, y = s.y0 + (s.y1 - s.y0) * p - Math.sin(p * Math.PI) * (s.kind === 'ball' ? 60 : 30);
      if (s.kind === 'ball') {
        g.fillStyle = ink(1); g.beginPath(); g.arc(x, y, 3, 0, Math.PI * 2); g.fill();
        if (p > 0.92) { puff(g, s.x1, s.y1, 16, '90,80,70', 0.5, (s.seed ?? 1) + 9); g.fillStyle = 'rgba(230,120,50,0.75)'; g.beginPath(); g.arc(s.x1, s.y1, 6, 0, Math.PI * 2); g.fill(); this.shake = Math.max(this.shake, 3); }
        if (p < 0.12) { g.fillStyle = 'rgba(255,220,150,0.9)'; g.beginPath(); g.arc(s.x0, s.y0, 7, 0, Math.PI * 2); g.fill(); }
      } else { g.strokeStyle = 'rgba(40,30,20,0.85)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y); g.lineTo(x - (s.x1 - s.x0) * 0.04, y - 6); g.stroke(); }
    }
  }
  drawFloats(g: CanvasRenderingContext2D, now: number) {
    this.floats = this.floats.filter(f => now - f.t0 < 1300);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const f of this.floats) {
      const p = (now - f.t0) / 1300;
      g.font = `900 ${f.big ? 22 : 15}px "Noto Serif SC", serif`;
      g.globalAlpha = p > 0.7 ? (1 - p) / 0.3 : 1;
      g.lineWidth = 3.5; g.strokeStyle = 'rgba(20,8,4,0.85)'; g.strokeText(f.text, f.x, f.y - p * 30);
      g.fillStyle = f.color; g.fillText(f.text, f.x, f.y - p * 30);
    }
    g.globalAlpha = 1;
  }
  /** 我军军心将溃：画面边缘泛红 */
  vignette(g: CanvasRenderingContext2D, resolve: number, over: boolean, now: number) {
    if (resolve >= 30 || over) return;
    const a = (30 - resolve) / 30 * (0.35 + 0.15 * Math.sin(now / 250));
    const vg = g.createRadialGradient(this.W / 2, this.H / 2, this.H * 0.35, this.W / 2, this.H / 2, this.H * 0.8);
    vg.addColorStop(0, 'rgba(160,20,10,0)'); vg.addColorStop(1, `rgba(160,20,10,${a})`);
    g.fillStyle = vg; g.fillRect(0, 0, this.W, this.H);
  }
  rain(g: CanvasRenderingContext2D, now: number) {
    g.strokeStyle = ink(0.6, 0.22); g.lineWidth = 0.9;
    for (let k = 0; k < 110; k++) { const x = (k * 97 + now * 0.5) % this.W, y = (k * 53 + now * 0.9) % this.H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 12); g.stroke(); }
  }
  /** 天空、远山（背景缓存里用）：绢纸天色、淡日、层层水墨远山没入云雾 */
  skyAndHills(g: CanvasRenderingContext2D, weather: string, dusk = 0, seed = 7) {
    const { W, H } = this, hz = this.hz;
    const rain = weather === 'rain', fog = weather === 'fog';
    paper(g, W, H, rain ? '#d9d2bf' : fog ? '#e6e0cf' : '#e9ddc1');
    const sky = g.createLinearGradient(0, 0, 0, hz + 30);
    sky.addColorStop(0, rain ? 'rgba(80,80,78,0.35)' : dusk ? 'rgba(150,90,70,0.18)' : 'rgba(150,150,140,0.10)'); sky.addColorStop(1, 'rgba(240,230,205,0)');
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 30);
    if (!rain && !fog) {
      // 一轮淡日（日暮偏朱）
      g.fillStyle = dusk ? 'rgba(196,80,50,0.55)' : 'rgba(205,110,80,0.28)';
      g.beginPath(); g.arc(W * 0.78, hz * 0.42, Math.max(10, hz * 0.2), 0, Math.PI * 2); g.fill();
    }
    const r = mkRnd(seed);
    mountains(g, W, hz + 10, Math.max(30, hz * 0.85), r, { layers: 3, dark: rain ? 0.7 : fog ? 0.3 : 0.55, mist: fog ? '236,232,220' : '233,221,193' });
    if (fog) { const mg = g.createLinearGradient(0, hz - 20, 0, hz + H * 0.3); mg.addColorStop(0, 'rgba(236,232,220,0.2)'); mg.addColorStop(0.5, 'rgba(236,232,220,0.75)'); mg.addColorStop(1, 'rgba(236,232,220,0)'); g.fillStyle = mg; g.fillRect(0, hz - 20, W, H * 0.3 + 20); }
  }
  /** 大地底色：淡赭绿晕染，近浓远淡，斑驳几块 */
  groundWash(g: CanvasRenderingContext2D, seed = 11, tone = '138,138,82') {
    const { W, H } = this, hz = this.hz;
    const gr = g.createLinearGradient(0, hz, 0, H);
    gr.addColorStop(0, `rgba(${tone},0.16)`); gr.addColorStop(1, `rgba(${tone},0.5)`);
    g.fillStyle = gr; g.fillRect(0, hz + 6, W, H);
    const r = mkRnd(seed);
    for (let k = 0; k < 14; k++) {
      const y = hz + 20 + r() * (H - hz), x = r() * W, s = (y - hz) / (H - hz);
      const rx = 60 + s * 220 * (0.5 + r()), ry = rx * 0.18;
      const gg = g.createRadialGradient(x, y, 0, x, y, rx);
      gg.addColorStop(0, `rgba(${r() < 0.5 ? '120,125,70' : '160,135,90'},${0.08 + r() * 0.1})`); gg.addColorStop(1, 'rgba(120,120,70,0)');
      g.save(); g.translate(x, y); g.scale(1, ry / rx); g.translate(-x, -y); g.fillStyle = gg; g.beginPath(); g.arc(x, y, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  /** 草地斑驳：软边的草色、赭色、枯黄晕染，随透视压扁（不画直边田块，免得像铺地石板） */
  fields(g: CanvasRenderingContext2D, r: () => number, x0: number, x1: number, y0: number, y1: number, skip?: (x: number, y: number) => boolean) {
    const tones = ['118,135,70', '150,140,85', '105,125,62', '170,150,98', '132,128,72', '95,112,58'];
    for (let k = 0; k < 120; k++) {
      const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0);
      if (skip?.(x, y)) continue;
      const [sx, sy, sc] = this.P(x, y);
      if (sy < this.hz) continue;
      const rx = (60 + r() * 160) * sc * 3, ry = rx * (0.16 + r() * 0.1);
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, rx);
      const c = tones[Math.floor(r() * tones.length)], a = 0.1 + r() * 0.16;
      gr.addColorStop(0, `rgba(${c},${a})`); gr.addColorStop(0.6, `rgba(${c},${a * 0.6})`); gr.addColorStop(1, `rgba(${c},0)`);
      g.save(); g.translate(sx, sy); g.scale(1, ry / rx); g.translate(-sx, -sy);
      g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, rx, 0, Math.PI * 2); g.fill(); g.restore();
    }
  }
  /** 地平线上一线疏林与雾带（远景与战场之间的过渡） */
  horizonWoods(g: CanvasRenderingContext2D, r: () => number) {
    const { W } = this, hz = this.hz;
    for (let x = -10; x < W + 10; x += 4 + r() * 10) {
      const y = hz + 10 + r() * 6, h = 4 + r() * 9;
      g.fillStyle = ink(0.6 + r() * 0.3, 0.25 + r() * 0.3);
      g.beginPath(); g.ellipse(x, y - h * 0.5, 2 + r() * 4, h * 0.5, 0, 0, Math.PI * 2); g.fill();
      if (r() < 0.25) { g.strokeStyle = ink(0.8, 0.35); g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h * 1.3); g.stroke(); }
    }
    const mg = g.createLinearGradient(0, hz + 4, 0, hz + 40);
    mg.addColorStop(0, 'rgba(236,226,200,0)'); mg.addColorStop(0.5, 'rgba(236,226,200,0.6)'); mg.addColorStop(1, 'rgba(236,226,200,0)');
    g.fillStyle = mg; g.fillRect(0, hz + 4, W, 36);
  }
  /** 地面的质感：缓坡起伏、点草苔点、踩出的土路、散石灌丛；avoid 返回 true 的世界坐标处不画（大道、河、城墙） */
  terrainTexture(g: CanvasRenderingContext2D, r: () => number, o: { y0: number; y1: number; avoid?: (x: number, y: number) => boolean; paths?: number } ) {
    const { W, H } = this, hz = this.hz;
    const avoid = o.avoid ?? (() => false);
    // 1. 缓坡：一道道低岗，岗顶受光、岗脚积墨，岗脊断续一笔
    const swells = 7;
    for (let k = 0; k < swells; k++) {
      const y = o.y0 + (o.y1 - o.y0) * (k + 0.3 + r() * 0.4) / swells;
      const x0 = -900 + r() * 600, x1 = x0 + 900 + r() * 1400, hgt = 6 + r() * 10, depth = 50 + r() * 60;
      const crest: [number, number][] = [], base: [number, number][] = [];
      for (let x = x0; x <= x1; x += 25) {
        const t = (x - x0) / (x1 - x0), bump = Math.sin(t * Math.PI) * (0.8 + 0.2 * Math.sin(t * 7 + k));
        const [cx, cy] = this.P(x, y, hgt * bump), [bx, by] = this.P(x, y + (this.o.me === 'att' ? depth : -depth), 0);
        crest.push([cx, cy]); base.push([bx, by]);
      }
      const top = Math.min(...crest.map(p => p[1])), bot = Math.max(...base.map(p => p[1]));
      if (bot < hz) continue;
      const gr = g.createLinearGradient(0, top, 0, bot);
      gr.addColorStop(0, 'rgba(250,240,210,0.22)'); gr.addColorStop(0.45, 'rgba(160,150,100,0.10)'); gr.addColorStop(1, 'rgba(90,85,55,0.18)');
      g.fillStyle = gr; g.beginPath(); crest.forEach(([x, yy], i) => (i ? g.lineTo(x, yy) : g.moveTo(x, yy))); for (let i = base.length - 1; i >= 0; i--) g.lineTo(base[i][0], base[i][1]); g.closePath(); g.fill();
      g.strokeStyle = ink(0.7, 0.16 + r() * 0.1); g.lineWidth = 1.1; g.lineCap = 'round';
      g.beginPath(); crest.forEach(([x, yy], i) => { if (i % 7 === 6 && r() < 0.5) { g.stroke(); g.beginPath(); g.moveTo(x, yy); } else if (i) g.lineTo(x, yy); else g.moveTo(x, yy); }); g.stroke();
    }
    // 2. 土路：几道踩出的小路，弯弯曲曲伸向远处
    for (let k = 0; k < (o.paths ?? 2); k++) {
      let x = -100 + r() * 1200; const wob = 80 + r() * 160, ph = r() * 6;
      const left: [number, number][] = [], right: [number, number][] = [];
      for (let y = o.y1; y >= o.y0; y -= 30) {
        const xx = x + Math.sin(y / 260 + ph) * wob;
        if (avoid(xx, y)) break;
        left.push(this.P(xx - 9, y).slice(0, 2) as [number, number]); right.push(this.P(xx + 9, y).slice(0, 2) as [number, number]);
      }
      if (left.length < 3) continue;
      g.fillStyle = 'rgba(176,150,105,0.32)'; g.beginPath(); left.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); for (let i = right.length - 1; i >= 0; i--) g.lineTo(right[i][0], right[i][1]); g.closePath(); g.fill();
      g.strokeStyle = ink(0.6, 0.18); g.lineWidth = 0.8;
      for (const side of [left, right]) { g.beginPath(); side.forEach(([px, py], i) => { if (i % 5 === 4) { g.stroke(); g.beginPath(); g.moveTo(px, py); } else if (i) g.lineTo(px, py); else g.moveTo(px, py); }); g.stroke(); }
      x += 0;
    }
    // 3. 点草苔点：近大而疏、远小而密
    for (let k = 0; k < 5200; k++) {
      const t = Math.pow(r(), 0.65), y = o.y0 + (o.y1 - o.y0) * (this.o.me === 'att' ? t : 1 - t), x = -600 + r() * 2200;
      if (avoid(x, y)) continue;
      const [sx, sy, sc] = this.P(x, y);
      if (sx < -10 || sx > W + 10 || sy < hz || sy > H + 10) continue;
      const kind = r();
      if (kind < 0.55) { g.strokeStyle = ink(0.6 + r() * 0.3, 0.14 + r() * 0.16); g.lineWidth = Math.max(0.5, sc * 1.6); const l = (3 + r() * 6) * sc * 2.4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + (r() - 0.5) * l * 0.6, sy - l); g.stroke(); }
      else if (kind < 0.85) { g.fillStyle = ink(0.7 + r() * 0.25, 0.12 + r() * 0.18); g.beginPath(); g.ellipse(sx, sy, (1 + r() * 1.5) * sc * 2, (0.6 + r()) * sc * 2, 0, 0, Math.PI * 2); g.fill(); }
      else { g.fillStyle = `rgba(${100 + Math.floor(r() * 40)},${115 + Math.floor(r() * 30)},${60 + Math.floor(r() * 25)},${0.14 + r() * 0.16})`; g.beginPath(); g.ellipse(sx, sy, (4 + r() * 8) * sc * 2, (1.5 + r() * 2) * sc * 2, 0, 0, Math.PI * 2); g.fill(); }
    }
    // 4. 草丛、散石、灌丛
    for (let k = 0; k < 70; k++) {
      const x = -500 + r() * 2000, y = o.y0 + r() * (o.y1 - o.y0);
      if (avoid(x, y)) continue;
      const [sx, sy, sc] = this.P(x, y);
      if (sx < -40 || sx > W + 40 || sy < hz + 4) continue;
      const q = r();
      if (q < 0.5) grass(g, sx, sy, sc * 2.6, r, 0.4 + r() * 0.25);
      else if (q < 0.78) rock(g, sx, sy, sc * 2.2, r, 0.85);
      else bush(g, sx, sy, sc * 2.6, r, 0.8);
    }
  }
  /** 画面可见的底边：下方指挥栏叠在画布上，近景要画在它之上 */
  visibleBottom(): number {
    const ui = document.getElementById('battle-ui')?.getBoundingClientRect(), c = this.cv.getBoundingClientRect();
    return ui && ui.height && ui.top > c.top ? Math.min(this.H, ui.top - c.top + 6) : this.H;
  }
  /** 近景压角：画面下方两角一丛长草、一两块大石、灌木，给出最近的一层（不挡中路） */
  foreground(g: CanvasRenderingContext2D, r: () => number, bottom: number) {
    const { W } = this;
    for (const side of [-1, 1]) {
      const bx = side < 0 ? 0 : W;
      for (let k = 0; k < 3; k++) rock(g, bx - side * (30 + r() * 140), bottom - r() * 20, 2.4 + r() * 1.4, r, 0.92);
      for (let k = 0; k < 3; k++) bush(g, bx - side * (60 + r() * 160), bottom - 6 - r() * 26, 2.2 + r() * 1.2, r, 0.85);
      for (let k = 0; k < 14; k++) grass(g, bx - side * (r() * 230), bottom - r() * 34, 2.4 + r() * 2, r, 0.5 + r() * 0.3);
    }
  }
  /** 画框四周做旧（最后一层） */
  frameAge(g: CanvasRenderingContext2D) { agedEdges(g, this.W, this.H, 0.28); }
  /** 一块四边形地面（世界坐标） */
  quad(g: CanvasRenderingContext2D, pts: [number, number][], fill: string | CanvasGradient) {
    g.fillStyle = fill; g.beginPath();
    pts.forEach(([x, y], i) => { const [sx, sy] = this.P(x, y); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
    g.closePath(); g.fill();
  }
}

export const fmtN = (n: number) => n >= 10000 ? (Math.round(n / 1000) / 10) + '万' : String(Math.round(n));
