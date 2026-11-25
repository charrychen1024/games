/* 即时战斗画面的共用底层：纵深透视、小兵贴图、飘字、弹道、军心泛红。
 * 攻城（siegeView.ts）与野战、水战（fieldView.ts）都从这里派生。画面只读模拟状态，不改它。 */
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
export interface Shot { x0: number; y0: number; x1: number; y1: number; t0: number; dur: number; kind: 'ball' | 'arrow' | 'smoke' | 'flash' | 'fire' | 'dust' }
/** 画面需要的一营的最少信息 */
export interface VUnit { id: string; side: 'att' | 'def'; kind: string; name: string; troops: number; start: number; morale: number; x: number; y: number; state: string; hit: number; engaged: boolean }
export interface Camera { near: number; far: number; k: number; kx: number; ky: number }

export abstract class RtView {
  cv: HTMLCanvasElement; g: CanvasRenderingContext2D;
  W = 0; H = 0; dpr = 1;
  o: ViewOpts;
  selected: string | null = null;
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
  PU(x: number, y: number, z = 0): [number, number, number] {
    const p = this.P(x, y, z);
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
      g.fillStyle = '#5a3b22'; g.beginPath(); g.ellipse(0, -14, 9, 14, 0, 0, Math.PI * 2); g.fill();
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
      if (s.kind === 'smoke') { g.fillStyle = `rgba(235,235,228,${0.6 * (1 - p)})`; g.beginPath(); g.arc(s.x0 + p * 10, s.y0 - p * (s.y0 - s.y1), 4 + p * 14, 0, Math.PI * 2); g.fill(); continue; }
      if (s.kind === 'dust') { g.fillStyle = `rgba(170,150,110,${0.45 * (1 - p)})`; g.beginPath(); g.ellipse(s.x0 + (s.x1 - s.x0) * p, s.y0 - p * 14, 8 + p * 22, 5 + p * 10, 0, 0, Math.PI * 2); g.fill(); continue; }
      if (s.kind === 'flash') { g.fillStyle = `rgba(255,240,200,${0.9 * (1 - p)})`; g.beginPath(); g.arc(s.x0, s.y0, 3 + p * 8, 0, Math.PI * 2); g.fill(); continue; }
      if (s.kind === 'fire') {
        for (let k = 0; k < 5; k++) { const a = (1 - p) * 0.8; g.fillStyle = k % 2 ? `rgba(255,140,40,${a})` : `rgba(255,220,90,${a})`; g.beginPath(); g.ellipse(s.x0 + (k - 2) * 9, s.y0 - p * 40 - k * 6, 10 + p * 16, 16 + p * 24, 0, 0, Math.PI * 2); g.fill(); }
        g.fillStyle = `rgba(60,50,45,${0.5 * (1 - p)})`; g.beginPath(); g.ellipse(s.x0, s.y0 - 60 - p * 80, 30 + p * 40, 18 + p * 20, 0, 0, Math.PI * 2); g.fill();
        continue;
      }
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
    g.strokeStyle = 'rgba(210,220,230,0.35)'; g.lineWidth = 1;
    for (let k = 0; k < 90; k++) { const x = (k * 97 + now * 0.5) % this.W, y = (k * 53 + now * 0.9) % this.H; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 4, y + 12); g.stroke(); }
  }
  /** 天空、远山（背景缓存里用） */
  skyAndHills(g: CanvasRenderingContext2D, weather: string, dusk = 0) {
    const { W } = this, hz = this.hz;
    const rain = weather === 'rain', fog = weather === 'fog';
    const sky = g.createLinearGradient(0, 0, 0, hz + 30);
    sky.addColorStop(0, rain ? '#5d6670' : fog ? '#b9bcb4' : dusk ? '#5b6f96' : '#6f9fc9'); sky.addColorStop(1, rain ? '#a3a9a8' : fog ? '#dad8cc' : dusk ? '#e9b98a' : '#e9e0c4');
    g.fillStyle = sky; g.fillRect(0, 0, W, hz + 40);
    for (let k = 0; k < 3; k++) {
      g.fillStyle = ['rgba(110,130,140,0.55)', 'rgba(90,110,105,0.6)', 'rgba(80,95,80,0.75)'][k];
      g.beginPath(); g.moveTo(0, hz + 10);
      for (let x = 0; x <= W; x += 30) g.lineTo(x, hz + 6 - k * 3 - Math.abs(Math.sin(x / (90 + k * 40) + k)) * (22 - k * 5));
      g.lineTo(W, hz + 12); g.lineTo(0, hz + 12); g.fill();
    }
  }
  /** 一块四边形地面（世界坐标） */
  quad(g: CanvasRenderingContext2D, pts: [number, number][], fill: string | CanvasGradient) {
    g.fillStyle = fill; g.beginPath();
    pts.forEach(([x, y], i) => { const [sx, sy] = this.P(x, y); if (i) g.lineTo(sx, sy); else g.moveTo(sx, sy); });
    g.closePath(); g.fill();
  }
}

export const fmtN = (n: number) => n >= 10000 ? (Math.round(n / 1000) / 10) + '万' : String(Math.round(n));
