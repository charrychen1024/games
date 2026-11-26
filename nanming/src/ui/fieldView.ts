/* 野战、水战画面：纵深透视。镜头在我军阵后，敌阵在上方远处。
 * 野战画田野（丘陵画一道岗、有河画河与浅滩）；水战画江面、两岸、船队。画面只读模拟状态（core/field.ts）。 */
import { RIDGE, RIVER, CONTACT, type FieldSim, type FUnit } from '../core/field';
import { RtView, shade, type ViewOpts, type Camera } from './rtView';
import { ink, tint, mkRnd, tree, hut, grass, mound } from './ink';

export class FieldView extends RtView {
  sim: FieldSim;
  /** 鼠标悬停的敌营（下令时高亮） */
  hoverUnit: string | null = null;
  /** 正在等玩家点目标 */
  aiming = false;

  constructor(parent: HTMLElement, sim: FieldSim, o: ViewOpts) {
    super(parent, o);
    this.sim = sim;
  }
  // 镜头稍稍拉远：我军最近的一排也在号令牌之上
  cam(): Camera { return this.o.me === 'att' ? { near: 1520, far: 0, k: 0.29, kx: 1.1, ky: 1 } : { near: 0, far: 520, k: 0.29, kx: 1.1, ky: 1 }; }
  get naval() { return this.sim.mode === 'naval'; }

  /* ---------- 背景（缓存）：水墨长卷 ---------- */
  background(): HTMLCanvasElement {
    const key = `${this.W}x${this.H}${this.o.me}${this.sim.weather}${this.sim.terrain}`;
    if (this.bg && this.bgKey === key) return this.bg;
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const { W, H } = this, hz = this.hz;
    const seed = this.sim.seed ?? 7;
    this.skyAndHills(g, this.sim.weather, 0, seed);
    const r = mkRnd(seed * 31 + 5);
    /** 世界坐标处的景物比例（一个小兵约 0.11·H·s 高） */
    const at = (x: number, y: number) => this.P(x, y);
    if (this.naval) {
      // 江面：淡花青晕染，远处没入水雾；两岸芦苇
      const wg = g.createLinearGradient(0, hz, 0, H);
      wg.addColorStop(0, 'rgba(120,140,140,0.18)'); wg.addColorStop(0.4, 'rgba(90,118,122,0.32)'); wg.addColorStop(1, 'rgba(60,90,98,0.45)');
      g.fillStyle = wg; g.fillRect(0, hz + 8, W, H);
      // 水纹：长短不一的淡墨弧笔，近疏而大、远密而细
      for (let k = 0; k < 260; k++) {
        const y = -150 + Math.pow(r(), 0.8) * 1450, x = -400 + r() * 1800, [sx, sy, sc] = at(x, y);
        const l = (14 + r() * 30) * sc * 3;
        g.strokeStyle = ink(0.55, 0.12 + r() * 0.14); g.lineWidth = Math.max(0.5, sc * 2.2);
        g.beginPath(); g.moveTo(sx - l, sy); g.quadraticCurveTo(sx - l * 0.3, sy - l * 0.12, sx, sy); g.quadraticCurveTo(sx + l * 0.3, sy + l * 0.1, sx + l, sy - l * 0.04); g.stroke();
      }
      for (const side of [-1, 1]) {
        const e = side < 0 ? -60 : 1060;
        const bank: [number, number][] = [];
        for (let y = 1300; y >= -200; y -= 50) bank.push(at(e + side * (r() * 30), y).slice(0, 2) as [number, number]);
        bank.push([side < 0 ? 0 : W, hz + 8]); bank.push([side < 0 ? 0 : W, H]);
        g.fillStyle = 'rgba(150,140,95,0.35)'; g.beginPath(); bank.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        g.strokeStyle = ink(0.8, 0.55); g.lineWidth = 1.3; g.beginPath(); bank.slice(0, -2).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
        for (let k = 0; k < 90; k++) {
          const y = -150 + r() * 1450, x = e - side * (10 + r() * 70), [sx, sy, s] = at(x, y);
          grass(g, sx, sy, s * 2.2, r, 0.55);
        }
        for (let k = 0; k < 7; k++) { const y = -100 + r() * 1300, [sx, sy, s] = at(e + side * (60 + r() * 200), y); tree(g, sx, sy, s * 4.5, r() < 0.5 ? 'willow' : 'grove', r, 0.85); }
      }
    } else {
      this.groundWash(g, seed);
      this.fields(g, r, -1500, 2500, -220, 1300);
      this.horizonWoods(g, r);
      const river = this.sim.terrain === 'river';
      this.terrainTexture(g, r, { y0: -200, y1: 1300, paths: river ? 1 : 2, avoid: (_x, y) => river && y > RIVER.y0 - 12 && y < RIVER.y1 + 12 });
      if (this.sim.terrain === 'hills') {
        // 守方阵前一道岗：淡墨晕染，岗脊焦墨一笔，坡上皴擦、岗上松
        const { x0, x1, y0, y1 } = RIDGE;
        const crestY = (y0 + y1) / 2;
        const top: [number, number][] = [], bot: [number, number][] = [];
        for (let x = x0 - 120; x <= x1 + 120; x += 30) {
          const t = (x - (x0 - 120)) / (x1 - x0 + 240), bump = Math.sin(t * Math.PI) * (0.75 + 0.25 * Math.sin(t * 9 + seed));
          top.push(this.P(x, crestY, 70 * bump).slice(0, 2) as [number, number]);
          bot.push(this.P(x, this.o.me === 'att' ? y1 + 40 : y0 - 40).slice(0, 2) as [number, number]);
        }
        mound(g, [...top, ...bot.reverse()], r, 1);
        for (let k = 0; k < 9; k++) { const x = x0 + r() * (x1 - x0), t = (x - x0 + 120) / (x1 - x0 + 240); const [sx, sy, s] = this.P(x, crestY, 70 * Math.sin(t * Math.PI) * 0.8); tree(g, sx, sy, s * 4, 'pine', r, 0.8); }
        g.fillStyle = ink(0.8, 0.55); g.font = '700 13px "Noto Serif SC", serif'; g.textAlign = 'center';
        const [lx, ly] = this.P(500, crestY, 30); g.fillText('高 地', lx, ly);
      }
      if (this.sim.terrain === 'river') {
        const { y0, y1, ford0, ford1 } = RIVER;
        const band = (ya: number, yb: number, xa = -2000, xb = 3000) => [at(xa, ya), at(xb, ya), at(xb, yb), at(xa, yb)].map(p => [p[0], p[1]] as [number, number]);
        const q = band(y1, y0);
        g.fillStyle = 'rgba(88,118,126,0.42)'; g.beginPath(); q.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        g.strokeStyle = ink(0.8, 0.5); g.lineWidth = 1.2;
        for (const yy of [y0, y1]) { g.beginPath(); for (let x = -600; x <= 1600; x += 40) { const [sx, sy] = at(x, yy + Math.sin(x / 60) * 4); if (x === -600) g.moveTo(sx, sy); else g.lineTo(sx, sy); } g.stroke(); }
        g.strokeStyle = 'rgba(235,240,235,0.4)'; g.lineWidth = 0.8;
        for (let k = 0; k < 50; k++) { const x = -300 + r() * 1600, y = y0 + 6 + r() * (y1 - y0 - 12), [sx, sy, s] = at(x, y); g.beginPath(); g.moveTo(sx - 12 * s * 3, sy); g.quadraticCurveTo(sx, sy - 2 * s * 3, sx + 12 * s * 3, sy); g.stroke(); }
        const f = band(y1, y0, ford0, ford1);
        g.fillStyle = 'rgba(205,185,135,0.6)'; g.beginPath(); f.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
        for (let k = 0; k < 40; k++) { const x = (r() < 0.5 ? -400 + r() * 700 : 700 + r() * 700), y = (r() < 0.5 ? y0 - 4 : y1 + 4), [sx, sy, s] = at(x, y); grass(g, sx, sy, s * 2.4, r, 0.5); }
        g.fillStyle = ink(0.85, 0.6); g.font = '700 12px "Noto Serif SC", serif'; g.textAlign = 'center';
        const [lx, ly] = at(500, (y0 + y1) / 2); g.fillText('浅 滩', lx, ly + 4);
      }
      // 草：疏疏几笔，近大远小
      for (let k = 0; k < 150; k++) { const x = -400 + r() * 1800, y = -100 + r() * 1300, [sx, sy, s] = at(x, y); grass(g, sx, sy, s * 2, r, 0.28 + r() * 0.2); }
      // 两翼：杂树、松、村舍，远处一线疏林
      const props: { x: number; y: number; k: 'pine' | 'willow' | 'bare' | 'grove' | 'hut' }[] = [];
      for (let k = 0; k < 16; k++) { const side = k % 2 ? 1 : -1; props.push({ x: side < 0 ? -60 - r() * 300 : 1060 + r() * 300, y: -150 + r() * 1350, k: (['pine', 'grove', 'bare', 'willow', 'grove'] as const)[Math.floor(r() * 5)] }); }
      const vill = r() < 0.5 ? -1 : 1, vy = 200 + r() * 600;
      for (let k = 0; k < 4; k++) props.push({ x: vill < 0 ? -120 - r() * 180 : 1120 + r() * 180, y: vy + (r() - 0.5) * 160, k: 'hut' });
      for (let k = 0; k < 14; k++) props.push({ x: -200 + r() * 1400, y: this.o.me === 'att' ? -180 - r() * 40 : 1260 + r() * 40, k: r() < 0.6 ? 'grove' : 'pine' });
      props.sort((a, b) => this.depth(b.y) - this.depth(a.y));
      for (const p of props) {
        const [sx, sy, s] = at(p.x, p.y);
        if (sx < -80 || sx > W + 80) continue;
        if (p.k === 'hut') hut(g, sx, sy, s * 3.2, r, 0.9); else tree(g, sx, sy, s * 4.5, p.k, r, 0.85);
      }
      this.foreground(g, r, this.visibleBottom());
    }
    this.bg = c; this.bgKey = key;
    return c;
  }

  /* ---------- 船（预渲染） ---------- */
  ship(side: 'att' | 'def', kind: string, facing: 'back' | 'front'): HTMLCanvasElement {
    const key = `ship${side}${kind}${facing}`;
    let c = this.sprites.get(key);
    if (c) return c;
    const look = this.o.look[side];
    c = document.createElement('canvas'); c.width = 80; c.height = 90;
    const g = c.getContext('2d')!;
    g.translate(40, 82);
    const big = kind === 'inf' || kind === 'art', fire = kind === 'fire';
    const hw = big ? 30 : 20, hh = big ? 16 : 11;
    // 船身：三分之四侧面，船头指向敌阵
    g.fillStyle = fire ? '#4a3a2a' : '#6a4c30';
    g.beginPath(); g.moveTo(-hw, -hh); g.lineTo(hw, -hh); g.lineTo(hw * 0.7, 0); g.lineTo(-hw * 0.7, 0); g.closePath(); g.fill();
    g.strokeStyle = ink(0.95, 0.9); g.lineWidth = 1.4; g.stroke();
    g.fillStyle = '#3a2614'; g.fillRect(-hw, -hh - 3, hw * 2, 3);
    if (kind === 'art') for (let k = -2; k <= 2; k++) { g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(k * hw * 0.32, -hh * 0.5, 2.2, 0, Math.PI * 2); g.fill(); }
    if (big) { g.fillStyle = shade('#8a5a32', -0.1); g.fillRect(-hw * 0.5, -hh - 14, hw, 11); g.fillStyle = '#2f2418'; g.fillRect(-hw * 0.55, -hh - 16, hw * 1.1, 3); }
    // 桅与帆
    const mh = big ? 58 : 44;
    g.strokeStyle = '#2a1d12'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -hh); g.lineTo(0, -hh - mh); g.stroke();
    g.fillStyle = fire ? '#8a7a64' : 'rgba(232,220,190,0.95)';
    g.beginPath(); g.moveTo(-hw * 0.55, -hh - mh + 6); g.lineTo(hw * 0.55, -hh - mh + 6); g.lineTo(hw * 0.62, -hh - 8); g.lineTo(-hw * 0.62, -hh - 8); g.closePath(); g.fill();
    g.strokeStyle = ink(0.8, 0.55); g.lineWidth = 1; g.stroke(); for (let k = 1; k < 5; k++) { const y = -hh - mh + 6 + (mh - 14) * k / 5; g.beginPath(); g.moveTo(-hw * 0.6, y); g.lineTo(hw * 0.6, y); g.stroke(); }
    g.fillStyle = tint(look.color, 0.15); g.beginPath(); g.moveTo(0, -hh - mh); g.lineTo(14, -hh - mh + 5); g.lineTo(0, -hh - mh + 10); g.fill();
    g.fillStyle = tint(look.color, 0.3); g.globalAlpha = 0.35; g.fillRect(-hw * 0.5, -hh - mh + 10, hw, mh * 0.5); g.globalAlpha = 1;
    if (fire) { g.fillStyle = '#a0522d'; for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(k * 8, -hh - 4, 5, 4, 0, 0, Math.PI * 2); g.fill(); } }
    if (facing === 'front') { g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-hw, -hh, hw * 2, hh); }
    this.sprites.set(key, c);
    return c;
  }

  /* ---------- 一营 ---------- */
  drawUnit(g: CanvasRenderingContext2D, u: FUnit) {
    if (u.state === 'gone' || u.troops < 1) return;
    const [cx, cy, s] = this.PU(u.x, u.y);
    const mine = u.side === this.o.me;
    const facing: 'back' | 'front' = mine ? 'back' : 'front';
    const px = this.H * s * 0.11;
    const moving = u.state === 'move' || u.state === 'rout';
    const sel = this.selected === u.id, hov = this.hoverUnit === u.id;
    if (u.state === 'rout') g.globalAlpha = 0.72;
    let top: number, spread: number;
    if (this.naval) {
      const n = Math.max(1, Math.min(7, Math.round(Math.sqrt(u.troops) / 18)));
      const sw = px * (u.kind === 'inf' || u.kind === 'art' ? 1.9 : 1.4);
      spread = n * sw * 0.55;
      const bob = (k: number) => Math.sin(this.now / 500 + k * 1.7 + u.x) * px * 0.06;
      const sp = this.ship(u.side, u.kind, facing);
      for (let k = 0; k < n; k++) {
        const row = k % 2, col = k - (n - 1) / 2;
        const x = cx + col * sw * 0.55, y = cy - row * px * 0.25 + bob(k);
        // 船尾的水痕
        if (moving) { g.strokeStyle = 'rgba(230,240,240,0.35)'; g.lineWidth = Math.max(1, px * 0.05); g.beginPath(); g.moveTo(x - sw * 0.3, y + 2); g.lineTo(x - sw * 0.5, y + px * 0.2); g.moveTo(x + sw * 0.3, y + 2); g.lineTo(x + sw * 0.5, y + px * 0.2); g.stroke(); }
        g.drawImage(sp, x - sw * 0.5, y - sw * 1.1, sw, sw * 1.125);
      }
      top = cy - px * 2.1;
    } else {
      // 人多则阵大：九千人约三十余兵，三千余人约二十，千人十余；溃散则阵形散开
      const n = Math.max(4, Math.min(44, Math.round(Math.sqrt(u.troops) / 2.6)));
      const cols = Math.ceil(Math.sqrt(n * (u.kind === 'cav' ? 2.8 : 2.4))), rows = Math.ceil(n / cols);
      const gapX = px * (u.kind === 'cav' ? 0.62 : u.kind === 'art' ? 1.4 : 0.42), gapY = px * 0.27;
      spread = cols * gapX * 0.55;
      const rout = u.state === 'rout';
      this.footprint(g, cx, cy - rows * gapY * 0.35, spread + px * 0.5, rows * gapY * 0.6 + px * 0.25, moving, u.x | 0);
      const frame = moving ? Math.floor(this.now / 180 + u.x) % 2 : 0;
      for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < cols; c++) {
        const k = r * cols + c; if (k >= n) continue;
        const sc = rout ? 2.2 : 1;
        const jx = ((k * 37) % 7 - 3) * px * 0.05 * sc, jy = ((k * 53) % 5 - 2) * px * 0.04 * sc;
        const rr = facing === 'back' ? r : rows - 1 - r;
        // 接战时阵形前压、略散
        const lunge = u.state === 'melee' ? Math.sin(this.now / 160 + k) * px * 0.07 : 0;
        const x = cx + (c - (cols - 1) / 2) * gapX * (rout ? 1.5 : 1) + jx + lunge, y = cy - (rows - 1 - rr) * gapY + jy;
        const bob = moving ? Math.abs(Math.sin(this.now / 120 + k)) * px * 0.05 : 0;
        const sp = this.sprite(u.side, u.kind, facing, frame);
        const hh = u.kind === 'cav' ? px * 1.25 : px;
        g.drawImage(sp, x - hh * 0.375, y - hh - bob, hh * 0.75, hh);
      }
      top = cy - rows * gapY - px * 1.25;
      // 大旗：立在阵后（溃散则倒）
      if (!rout) this.banner(g, cx + spread * 0.62, cy - rows * gapY * 0.6, px * 1.6, u.side, this.now / 300 + u.x);
      top = Math.min(top, cy - rows * gapY * 0.6 - px * 1.7);
    }
    g.globalAlpha = 1;
    if (sel || hov) {
      g.strokeStyle = sel ? 'rgba(255,214,120,0.95)' : mine ? 'rgba(255,240,200,0.7)' : 'rgba(255,110,90,0.95)'; g.lineWidth = 2.5;
      g.beginPath(); g.ellipse(cx, cy + 2, spread + 8, px * 0.45 + 6, 0, 0, Math.PI * 2); g.stroke();
    }
    const notes: Record<string, string> = { melee: '接战', shoot: this.naval ? '炮击' : '射击' };
    this.label(g, u, cx, top, px, u.state === 'melee' || u.state === 'shoot' ? notes[u.state] : u.kind === 'fire' ? '火船' : undefined);
  }

  /** 所选我营的去向：进击目标标红圈，移阵画落点 */
  drawIntent(g: CanvasRenderingContext2D) {
    const u = this.sim.units.find(x => x.id === this.selected);
    if (!u || u.state === 'gone') return;
    const [ux, uy] = this.PU(u.x, u.y);
    const o = u.order;
    let tx: number | undefined, ty: number | undefined, foe = false;
    if (o.t === 'attack' || (o.t === 'fire' && o.target)) {
      const t = this.sim.units.find(x => x.id === (o as { target?: string }).target);
      if (t && t.state !== 'gone') { [tx, ty] = this.PU(t.x, t.y); foe = true; }
    } else if (o.t === 'move' || (o.t === 'hold' && o.x !== undefined)) { [tx, ty] = this.PU(o.x!, o.y!); }
    if (tx === undefined || ty === undefined) return;
    g.save();
    g.setLineDash([8, 6]); g.lineDashOffset = -this.now / 40;
    g.strokeStyle = foe ? 'rgba(255,110,90,0.85)' : 'rgba(255,230,160,0.8)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(ux, uy); g.lineTo(tx, ty); g.stroke();
    g.setLineDash([]);
    g.beginPath(); g.ellipse(tx, ty, 16, 7, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  render(now: number) {
    this.now = now; this.labelRects = [];
    const g = this.g, sim = this.sim;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const sh = this.shake > 0 && !this.reduced ? (Math.random() - 0.5) * this.shake : 0;
    g.translate(sh, sh * 0.6);
    this.shake = Math.max(0, this.shake - 0.6);
    g.drawImage(this.background(), 0, 0, this.W, this.H);
    if (this.naval) this.waves(g, now);
    // 日暮：天色渐暗
    if (sim.t > 600) { const a = Math.min(0.3, (sim.t - 600) / 300 * 0.3); g.fillStyle = `rgba(60,40,30,${a})`; g.fillRect(0, 0, this.W, this.H); }
    this.drawIntent(g);
    const units = sim.units.filter(u => u.state !== 'gone').sort((a, b) => this.depth(b.y) - this.depth(a.y));
    for (const u of units) this.drawUnit(g, u);
    this.drawShots(g, now);
    this.drawFloats(g, now);
    if (sim.weather === 'rain') this.rain(g, now);
    this.frameAge(g);
    this.vignette(g, sim.resolve[this.o.me], !!sim.over, now);
  }
  waves(g: CanvasRenderingContext2D, now: number) {
    g.strokeStyle = ink(0.6, 0.28); g.lineWidth = 1;
    const drift = this.sim.wind * now / 90;
    for (let k = 0; k < 60; k++) {
      const wx = (k * 173) % 1000, wy = ((k * 97 + drift) % 1300 + 1300) % 1300 - 150;
      const [sx, sy, s] = this.P(wx, wy);
      g.beginPath(); g.moveTo(sx - 14 * s * 3, sy); g.quadraticCurveTo(sx, sy - 4 * s * 3, sx + 14 * s * 3, sy); g.stroke();
    }
  }

  /** 从模拟里取伤亡、开火、接战，变成飘字、弹道、烟尘 */
  harvest(now: number) {
    const sim = this.sim;
    this.harvestHits(now, sim.units);
    for (const u of sim.units) {
      if (u.state === 'gone') continue;
      const tgt = u.target ? sim.units.find(x => x.id === u.target) : undefined;
      if (u.state === 'shoot' && tgt) {
        const [x0, y0] = this.PU(u.x, u.y, 6), [x1, y1] = this.PU(tgt.x, tgt.y, 6);
        if (u.kind === 'art' && Math.random() < 0.05) { this.shots.push({ x0, y0, x1, y1, t0: now, dur: 800, kind: 'ball' }); this.shots.push({ x0, y0: y0 - 4, x1: x0, y1: y0 - 40, t0: now, dur: 1000, kind: 'smoke' }); }
        if (u.kind === 'gun' && Math.random() < 0.12) {
          this.shots.push({ x0: x0 + (Math.random() - 0.5) * 30, y0, x1: x0, y1: y0 - 30, t0: now, dur: 900, kind: 'smoke' });
          this.shots.push({ x0: x0 + (Math.random() - 0.5) * 30, y0: y0 - 6, x1: x0, y1: y0, t0: now, dur: 160, kind: 'flash' });
        }
      }
      if (u.state === 'melee' && Math.random() < 0.08 && tgt) {
        const mx = (u.x + tgt.x) / 2, my = (u.y + tgt.y) / 2, [sx, sy] = this.PU(mx, my);
        this.shots.push({ x0: sx + (Math.random() - 0.5) * 40, y0: sy, x1: sx + (Math.random() - 0.5) * 60, y1: sy, t0: now, dur: 900, kind: 'dust', seed: (Math.random() * 1e6) | 0 });
        if (Math.random() < 0.35) this.shots.push({ x0: sx + (Math.random() - 0.5) * 50, y0: sy - 10, x1: sx, y1: sy, t0: now, dur: 700, kind: 'ink', seed: (Math.random() * 1e6) | 0 });
      }
      if (u.state === 'move' && u.kind === 'cav' && !this.naval && Math.random() < 0.1) { const [sx, sy] = this.PU(u.x, u.y); this.shots.push({ x0: sx, y0: sy, x1: sx, y1: sy, t0: now, dur: 700, kind: 'dust' }); }
    }
  }
  /** 火船起火、冲锋等：在某营处放一团特效 */
  burst(u: FUnit, kind: 'fire' | 'dust') {
    const [x, y] = this.PU(u.x, u.y);
    this.shots.push({ x0: x, y0: y, x1: x, y1: y, t0: this.now, dur: kind === 'fire' ? 2200 : 900, kind });
    if (kind === 'fire') this.shake = Math.max(this.shake, 8);
  }

  /** 点选：一营（含敌营），或地面一点 */
  /** 某营在画布上的点选位置（测试与截图用，与 pick 同一算法） */
  unitScreen(id: string): [number, number] | null {
    const u = this.sim.units.find(x => x.id === id); if (!u) return null;
    const [x, y, s] = this.PU(u.x, u.y); return [x, y - this.H * s * 0.1];
  }
  pick(sx: number, sy: number): { unit?: string; ground?: [number, number] } {
    let best: string | undefined, bd = 1e9;
    for (const u of this.sim.units) {
      if (u.state === 'gone' || u.troops < 1) continue;
      const [x, y, s] = this.PU(u.x, u.y);
      const r = Math.max(28, this.H * s * 0.38);
      const d = Math.hypot(sx - x, (sy - (y - this.H * s * 0.1)) * 1.3);
      if (d < r && d < bd) { bd = d; best = u.id; }
    }
    if (best) return { unit: best };
    return { ground: this.unproject(sx, sy) };
  }
}
export { CONTACT };
