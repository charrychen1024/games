/* 野战、水战画面：纵深透视。镜头在我军阵后，敌阵在上方远处。
 * 野战画田野（丘陵画一道岗、有河画河与浅滩）；水战画江面、两岸、船队。画面只读模拟状态（core/field.ts）。 */
import { RIDGE, RIVER, CONTACT, type FieldSim, type FUnit } from '../core/field';
import { RtView, shade, type ViewOpts, type Camera } from './rtView';

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

  /* ---------- 背景（缓存） ---------- */
  background(): HTMLCanvasElement {
    const key = `${this.W}x${this.H}${this.o.me}${this.sim.weather}${this.sim.terrain}`;
    if (this.bg && this.bgKey === key) return this.bg;
    const c = document.createElement('canvas'); c.width = this.cv.width; c.height = this.cv.height;
    const g = c.getContext('2d')!; g.scale(this.dpr, this.dpr);
    const { W, H } = this, hz = this.hz;
    this.skyAndHills(g, this.sim.weather);
    if (this.naval) {
      // 江面：远淡近浓；两岸芦苇
      const wg = g.createLinearGradient(0, hz, 0, H);
      wg.addColorStop(0, '#9fb7b4'); wg.addColorStop(0.35, '#5f8a8e'); wg.addColorStop(1, '#2f5a63');
      g.fillStyle = wg; g.fillRect(0, hz + 8, W, H);
      for (const side of [-1, 1]) {
        const x0 = side < 0 ? -2000 : 1060, x1 = side < 0 ? -60 : 3000;
        this.quad(g, [[x0, 1300], [x1, 1300], [x1, -200], [x0, -200]], '#7d8a5a');
        const e = side < 0 ? -60 : 1060;
        this.quad(g, [[e - 30 * side, 1300], [e, 1300], [e, -200], [e - 30 * side, -200]], '#b9ad83');
        let seed = side > 0 ? 3 : 11; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
        for (let k = 0; k < 70; k++) {
          const y = -150 + rnd() * 1400, x = e - side * (20 + rnd() * 60), [sx, sy, s] = this.P(x, y);
          g.strokeStyle = 'rgba(70,85,45,0.7)'; g.lineWidth = Math.max(1, s * 2.5);
          for (let r = -2; r <= 2; r++) { g.beginPath(); g.moveTo(sx + r * s * 6, sy); g.lineTo(sx + r * s * 8, sy - s * 40); g.stroke(); }
        }
      }
    } else {
      const gr = g.createLinearGradient(0, hz, 0, H);
      gr.addColorStop(0, '#9aa07a'); gr.addColorStop(0.4, '#7f8a5a'); gr.addColorStop(1, '#5e6a3f');
      g.fillStyle = gr; g.fillRect(0, hz + 8, W, H);
      g.strokeStyle = 'rgba(60,70,40,0.16)'; g.lineWidth = 1;
      for (let x = -1500; x <= 2500; x += 120) { const [a1, b1] = this.P(x, 1250), [a2, b2] = this.P(x, -200); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
      for (let y = -200; y <= 1250; y += 80) { const [a1, b1] = this.P(-1500, y), [a2, b2] = this.P(2500, y); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
      if (this.sim.terrain === 'hills') {
        // 守方阵前一道岗：岗顶亮、两坡暗
        const { x0, x1, y0, y1 } = RIDGE;
        this.quad(g, [[x0 - 60, y1 + 30], [x1 + 60, y1 + 30], [x1, y0], [x0, y0]], 'rgba(120,112,70,0.55)');
        this.quad(g, [[x0, (y0 + y1) / 2 + 20], [x1, (y0 + y1) / 2 + 20], [x1 - 30, y0 + 10], [x0 + 30, y0 + 10]], 'rgba(170,160,105,0.5)');
        g.fillStyle = 'rgba(50,40,20,0.7)'; g.font = '700 13px "Noto Serif SC", serif'; g.textAlign = 'center';
        const [lx, ly] = this.P(500, (y0 + y1) / 2); g.fillText('高 地', lx, ly);
      }
      if (this.sim.terrain === 'river') {
        const { y0, y1, ford0, ford1 } = RIVER;
        this.quad(g, [[-2000, y1], [3000, y1], [3000, y0], [-2000, y0]], '#56808c');
        this.quad(g, [[ford0, y1], [ford1, y1], [ford1, y0], [ford0, y0]], 'rgba(200,180,130,0.75)');
        g.fillStyle = 'rgba(40,30,20,0.75)'; g.font = '700 12px "Noto Serif SC", serif'; g.textAlign = 'center';
        const [lx, ly] = this.P(500, (y0 + y1) / 2); g.fillText('浅滩', lx, ly + 4);
      }
      let seed = 7; const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let k = 0; k < 170; k++) {
        const x = -400 + rnd() * 1800, y = -100 + rnd() * 1300, [sx, sy, s] = this.P(x, y);
        g.fillStyle = rnd() < 0.5 ? 'rgba(70,90,45,0.45)' : 'rgba(120,110,80,0.35)';
        g.beginPath(); g.ellipse(sx, sy, 18 * s, 6 * s, 0, 0, Math.PI * 2); g.fill();
      }
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
    g.fillStyle = fire ? '#3a2a1a' : '#5a3b22';
    g.beginPath(); g.moveTo(-hw, -hh); g.lineTo(hw, -hh); g.lineTo(hw * 0.7, 0); g.lineTo(-hw * 0.7, 0); g.closePath(); g.fill();
    g.fillStyle = '#3a2614'; g.fillRect(-hw, -hh - 3, hw * 2, 3);
    if (kind === 'art') for (let k = -2; k <= 2; k++) { g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(k * hw * 0.32, -hh * 0.5, 2.2, 0, Math.PI * 2); g.fill(); }
    if (big) { g.fillStyle = shade('#8a5a32', -0.1); g.fillRect(-hw * 0.5, -hh - 14, hw, 11); g.fillStyle = '#2f2418'; g.fillRect(-hw * 0.55, -hh - 16, hw * 1.1, 3); }
    // 桅与帆
    const mh = big ? 58 : 44;
    g.strokeStyle = '#2a1d12'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -hh); g.lineTo(0, -hh - mh); g.stroke();
    g.fillStyle = fire ? '#6b5a48' : shade(look.color, 0.25);
    g.beginPath(); g.moveTo(-hw * 0.55, -hh - mh + 6); g.lineTo(hw * 0.55, -hh - mh + 6); g.lineTo(hw * 0.62, -hh - 8); g.lineTo(-hw * 0.62, -hh - 8); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(40,25,10,0.5)'; g.lineWidth = 1; for (let k = 1; k < 5; k++) { const y = -hh - mh + 6 + (mh - 14) * k / 5; g.beginPath(); g.moveTo(-hw * 0.6, y); g.lineTo(hw * 0.6, y); g.stroke(); }
    g.fillStyle = look.color; g.beginPath(); g.moveTo(0, -hh - mh); g.lineTo(12, -hh - mh + 4); g.lineTo(0, -hh - mh + 8); g.fill();
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
      const n = Math.max(3, Math.min(20, Math.round(Math.sqrt(u.troops) / 5)));
      const cols = Math.ceil(Math.sqrt(n * 2.2)), rows = Math.ceil(n / cols);
      const gapX = px * (u.kind === 'cav' ? 0.75 : u.kind === 'art' ? 1.5 : 0.5), gapY = px * 0.32;
      spread = cols * gapX * 0.62;
      const frame = moving ? Math.floor(this.now / 180 + u.x) % 2 : 0;
      for (let r = rows - 1; r >= 0; r--) for (let c = 0; c < cols; c++) {
        const k = r * cols + c; if (k >= n) continue;
        const jx = ((k * 37) % 7 - 3) * px * 0.04, jy = ((k * 53) % 5 - 2) * px * 0.03;
        const rr = facing === 'back' ? r : rows - 1 - r;
        // 接战时阵形前压、略散
        const lunge = u.state === 'melee' ? Math.sin(this.now / 160 + k) * px * 0.06 : 0;
        const x = cx + (c - (cols - 1) / 2) * gapX + jx + lunge, y = cy - (rows - 1 - rr) * gapY + jy;
        const bob = moving ? Math.abs(Math.sin(this.now / 120 + k)) * px * 0.05 : 0;
        const sp = this.sprite(u.side, u.kind, facing, frame);
        const hh = u.kind === 'cav' ? px * 1.25 : px;
        g.drawImage(sp, x - hh * 0.375, y - hh - bob, hh * 0.75, hh);
      }
      top = cy - rows * gapY - px * 1.25;
      // 旗
      const look = this.o.look[u.side];
      g.strokeStyle = '#2a1d12'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx + spread * 0.55, cy - px * 0.4); g.lineTo(cx + spread * 0.55, top); g.stroke();
      g.fillStyle = look.color; g.fillRect(cx + spread * 0.55, top, px * 0.6, px * 0.4);
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
    if (sim.t > 600) { const a = Math.min(0.32, (sim.t - 600) / 300 * 0.32); g.fillStyle = `rgba(40,20,40,${a})`; g.fillRect(0, 0, this.W, this.H); }
    this.drawIntent(g);
    const units = sim.units.filter(u => u.state !== 'gone').sort((a, b) => this.depth(b.y) - this.depth(a.y));
    for (const u of units) this.drawUnit(g, u);
    this.drawShots(g, now);
    this.drawFloats(g, now);
    if (sim.weather === 'rain') this.rain(g, now);
    this.vignette(g, sim.resolve[this.o.me], !!sim.over, now);
  }
  waves(g: CanvasRenderingContext2D, now: number) {
    g.strokeStyle = 'rgba(220,235,235,0.22)'; g.lineWidth = 1;
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
        this.shots.push({ x0: sx + (Math.random() - 0.5) * 40, y0: sy, x1: sx + (Math.random() - 0.5) * 60, y1: sy, t0: now, dur: 900, kind: 'dust' });
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
