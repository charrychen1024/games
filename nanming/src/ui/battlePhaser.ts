/* 战斗场景（Phaser 3 · WebGL）：
 * - 士兵、骑兵、城头守军、尸身、大旗、城墙城楼：开局时用拟物绘制函数画成贴图
 * - 粒子：硝烟、尘土、火星、碎石、火焰、雨
 * - 补间：前进、冲锋、交锋、倒地、溃逃、云梯攀登、炮弹
 * - 镜头：震屏、炮火闪光；后期：暗角、泛光 */
import { battleSfx } from './audio';
import Phaser from 'phaser';
import type { BattleState, RoundLog, LaneOrder } from '../core/battle';
import { BattleScene, drawSoldier, drawCavalry, drawStandard, drawShip, shade, type SideLook } from './battleScene';

const TEX = 2; // 贴图超采样倍数
type Kind = 'inf' | 'gun' | 'cav' | 'ship';
interface Unit { spr: Phaser.GameObjects.Sprite; kind: Kind; bx: number; by: number }
interface Group { c: Phaser.GameObjects.Container; units: Unit[]; flag: Phaser.GameObjects.Image | null; baseX: number }

const REACH: Partial<Record<LaneOrder, number>> = { attack: 0.11, charge: 0.14, flank: 0.09, storm: 0.3, sap: 0.24, sortie: 0.12, withdraw: -0.06, blockade: -0.03, ram: 0.16, board: 0.13, fireship: 0.05, evade: 0.04 };

export class BattleView {
  game: Phaser.Game;
  scene!: WarScene;
  ready: Promise<void>;
  constructor(parent: HTMLElement, b: BattleState, look: { att: SideLook; def: SideLook }) {
    let resolveReady!: () => void;
    this.ready = new Promise(r => (resolveReady = r));
    const self = this;
    class Boot extends WarScene { create() { super.create(); self.scene = this; resolveReady(); } }
    (window as any).NM_battle = this;
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      backgroundColor: '#1a140f',
      scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
      render: { antialias: true, pixelArt: false },
      banner: false,
      audio: { noAudio: true },
      scene: [new Boot(b, look)],
    });
  }
  async playRound(from: BattleState, to: BattleState, log: RoundLog, fast: boolean) { await this.ready; await this.scene.playRound(from, to, log, fast ? 0.4 : 1); }
  async showResult(win: boolean, text: string) { await this.ready; this.scene.showResult(win, text); }
  /** 布阵预览：按新的三路兵力重排阵列 */
  preview(b: BattleState) { if (!this.scene) return; this.scene.b = b; for (let i = 0; i < 3; i++) for (const sd of ['att', 'def'] as const) this.scene.buildGroup(sd, i, b); }
  destroy() { this.game.destroy(true); }
}

class WarScene extends Phaser.Scene {
  geo!: BattleScene;
  b: BattleState;
  look: { att: SideLook; def: SideLook };
  groups: Record<string, Group> = {};
  defenders: Phaser.GameObjects.Sprite[][] = [[], [], []];
  wallTex: Phaser.Textures.CanvasTexture | null = null;
  smoke!: Phaser.GameObjects.Particles.ParticleEmitter;
  dust!: Phaser.GameObjects.Particles.ParticleEmitter;
  sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  debris!: Phaser.GameObjects.Particles.ParticleEmitter;
  flames!: Phaser.GameObjects.Particles.ParticleEmitter;
  W = 0; H = 0;

  constructor(b: BattleState, look: { att: SideLook; def: SideLook }) {
    super({ key: 'war' });
    this.b = b; this.look = look;
  }

  create() {
    // 场景可能因舞台尺寸变化而重启：清掉上一轮的引用
    this.wallTex = null; this.groups = {}; this.defenders = [[], [], []];
    this.W = this.scale.width; this.H = this.scale.height;
    this.geo = new BattleScene(this.look);
    this.geo.W = this.W; this.geo.H = this.H;
    this.makeTextures();
    // 背景
    const bg = this.geo.background(this.b);
    if (this.textures.exists('bg')) this.textures.remove('bg');
    this.textures.addCanvas('bg', bg);
    this.add.image(0, 0, 'bg').setOrigin(0).setDisplaySize(this.W, this.H).setDepth(-1000);
    this.clouds();
    if (this.b.terrain === 'river') this.ripples();
    // 粒子
    this.smoke = this.add.particles(0, 0, 'puff', { speed: { min: 8, max: 30 }, angle: { min: 200, max: 340 }, scale: { start: 0.5, end: 1.8 }, alpha: { start: 0.65, end: 0 }, lifespan: 1400, emitting: false, tint: 0xeeeeea }).setDepth(5000);
    this.dust = this.add.particles(0, 0, 'puff', { speed: { min: 20, max: 70 }, angle: { min: 180, max: 360 }, scale: { start: 0.4, end: 1.4 }, alpha: { start: 0.55, end: 0 }, lifespan: 900, emitting: false, tint: 0xb59a6a }).setDepth(4000);
    this.sparks = this.add.particles(0, 0, 'spark', { speed: { min: 60, max: 180 }, scale: { start: 0.6, end: 0 }, lifespan: 380, emitting: false, blendMode: 'ADD', tint: [0xffd27a, 0xffffff, 0xff9a3a] }).setDepth(5200);
    this.debris = this.add.particles(0, 0, 'chip', { speed: { min: 40, max: 160 }, angle: { min: 200, max: 340 }, gravityY: 420, rotate: { min: 0, max: 360 }, scale: { start: 1, end: 0.6 }, lifespan: 900, emitting: false }).setDepth(5100);
    this.flames = this.add.particles(0, 0, 'puff', { speed: { min: 10, max: 50 }, angle: { min: 250, max: 290 }, scale: { start: 0.7, end: 0.1 }, alpha: { start: 0.9, end: 0 }, lifespan: 700, emitting: false, blendMode: 'ADD', tint: [0xff7a1a, 0xffc040, 0xff3a10] }).setDepth(5300);
    if (this.b.weather === 'rain') this.add.particles(0, 0, 'rain', { x: { min: -100, max: this.W + 100 }, y: -20, speedY: { min: 520, max: 680 }, speedX: -90, lifespan: 1600, quantity: 6, frequency: 16, alpha: 0.45 }).setDepth(9000);
    if (this.b.weather === 'fog') for (let k = 0; k < 3; k++) {
      const f = this.add.image(Math.random() * this.W, this.geo.horizon() + k * 120, 'fog').setAlpha(0.35).setDepth(8000 + k).setScale(3, 1.2);
      this.tweens.add({ targets: f, x: f.x + 260, duration: 16000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    // 城墙
    if (this.b.kind === 'siege') this.drawWall(this.b);
    // 阵列
    for (let i = 0; i < 3; i++) for (const side of ['att', 'def'] as const) this.buildGroup(side, i, this.b);
    if (this.b.kind === 'siege') this.buildDefenders(this.b);
    // 后期
    const cam = this.cameras.main;
    if (this.renderer.type === Phaser.WEBGL) {
      cam.postFX.addVignette(0.5, 0.55, 0.92, 0.35);
      cam.postFX.addBloom(0xffffff, 1, 1, 0.8, 0.6, 2);
    }
    cam.fadeIn(500, 20, 12, 6);
    this.scale.off('resize');
    this.scale.on('resize', () => this.scene.restart());
  }

  /* ---------- 贴图 ---------- */
  canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, ox: number, oy: number) {
    if (this.textures.exists(key)) this.textures.remove(key);
    const t = this.textures.createCanvas(key, w * TEX, h * TEX)!;
    const g = t.getContext();
    g.save(); g.scale(TEX, TEX); g.translate(ox, oy); draw(g); g.restore();
    t.refresh();
    return { key, ox: ox / w, oy: oy / h };
  }
  origins: Record<string, [number, number]> = {};
  makeTextures() {
    // 通用粒子
    const soft = (key: string, r: number, color: string) => this.canvasTex(key, r * 2, r * 2, g => {
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    }, r, r);
    soft('puff', 16, 'rgba(255,255,255,0.9)');
    soft('spark', 4, 'rgba(255,255,255,1)');
    this.canvasTex('chip', 3, 2.4, g => { g.fillStyle = '#9a9488'; g.fillRect(-1.5, -1.2, 3, 2.4); g.fillStyle = '#6f6b62'; g.fillRect(-1.5, 0.3, 3, 0.9); }, 1.5, 1.2);
    this.canvasTex('rain', 2, 16, g => { g.strokeStyle = 'rgba(220,230,240,0.9)'; g.lineWidth = 1; g.beginPath(); g.moveTo(1, 0); g.lineTo(0, 16); g.stroke(); }, 0, 0);
    this.canvasTex('fog', 200, 60, g => { const gr = g.createRadialGradient(100, 30, 5, 100, 30, 100); gr.addColorStop(0, 'rgba(240,240,232,0.9)'); gr.addColorStop(1, 'rgba(240,240,232,0)'); g.fillStyle = gr; g.fillRect(0, 0, 200, 60); }, 0, 0);
    this.canvasTex('cloud', 160, 50, g => { g.fillStyle = this.b.weather === 'rain' ? 'rgba(90,96,102,0.7)' : 'rgba(255,255,255,0.75)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(30 + k * 20, 28 + Math.sin(k * 1.7) * 6, 26, 14, 0, 0, Math.PI * 2); g.fill(); } }, 0, 0);
    this.canvasTex('arrow', 18, 4, g => { g.strokeStyle = '#3a2a1a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, 2); g.lineTo(14, 2); g.stroke(); g.fillStyle = '#cfcfc8'; g.beginPath(); g.moveTo(14, 0.5); g.lineTo(18, 2); g.lineTo(14, 3.5); g.fill(); g.fillStyle = '#e8e2d0'; g.fillRect(0, 1, 3, 2); }, 0, 0);
    this.canvasTex('ball', 8, 8, g => { const gr = g.createRadialGradient(-1, -1, 0, 0, 0, 4); gr.addColorStop(0, '#666'); gr.addColorStop(1, '#111'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 4, 0, Math.PI * 2); g.fill(); }, 4, 4);
    this.canvasTex('ripple', 24, 3, g => { g.fillStyle = 'rgba(240,250,250,0.7)'; g.fillRect(0, 1, 24, 1.2); }, 0, 0);
    // 兵卒（两方）
    for (const side of ['att', 'def'] as const) {
      const lk = this.look[side];
      const reg = (key: string, w: number, h: number, ox: number, oy: number, draw: (g: CanvasRenderingContext2D) => void) => { const r = this.canvasTex(key, w, h, draw, ox, oy); this.origins[key] = [r.ox, r.oy]; };
      for (let k = 0; k < 4; k++) {
        const ph = k * Math.PI / 4 + 0.01;
        reg(`${side}-inf-walk-${k}`, 66, 48, 22, 44, g => drawSoldier(g, 0, 0, 1, 'inf', lk, 1, ph, true, 'walk'));
        reg(`${side}-inf-flee-${k}`, 66, 48, 22, 44, g => drawSoldier(g, 0, 0, 1, 'inf', lk, 1, ph, true, 'flee'));
        reg(`${side}-gun-walk-${k}`, 66, 48, 22, 44, g => drawSoldier(g, 0, 0, 1, 'gun', lk, 1, ph, true, 'walk'));
        reg(`${side}-cav-gal-${k}`, 92, 66, 40, 62, g => drawCavalry(g, 0, 0, 1, lk, 1, ph, true));
      }
      reg(`${side}-ship`, 90, 70, 45, 60, g => drawShip(g, lk, false));
      reg(`${side}-ship-big`, 110, 84, 55, 72, g => drawShip(g, lk, true));
      reg(`${side}-inf-idle`, 66, 48, 22, 44, g => drawSoldier(g, 0, 0, 1, 'inf', lk, 1, 0.5, false, 'idle'));
      reg(`${side}-gun-idle`, 66, 48, 22, 44, g => drawSoldier(g, 0, 0, 1, 'gun', lk, 1, 0.5, false, 'idle'));
      reg(`${side}-gun-aim`, 66, 48, 22, 44, g => drawSoldier(g, 0, 0, 1, 'gun', lk, 1, 0.5, false, 'aim'));
      reg(`${side}-cav-idle`, 92, 66, 40, 62, g => drawCavalry(g, 0, 0, 1, lk, 1, 0, false));
      reg(`${side}-half`, 40, 40, 14, 38, g => drawSoldier(g, 0, 18, 1, 'gun', lk, -1, 0.5, false, 'aim', true));
      reg(`${side}-fallen`, 34, 12, 17, 8, g => {
        g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(0, 2, 15, 3, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = shade(lk.color, -0.25); g.fillRect(-10, -3, 15, 5);
        g.fillStyle = '#e2b98f'; g.beginPath(); g.arc(8, -1, 3, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#6b4a2a'; g.lineWidth = 1; g.beginPath(); g.moveTo(-15, 3); g.lineTo(15, -4); g.stroke();
      });
      const mk = (i: number) => (i === 1 ? this.b[side].commanderName.slice(0, 1) : lk.mark);
      for (let i = 0; i < 3; i++) reg(`${side}-flag-${i}`, 44, 74, 4, 70, g => drawStandard(g, 0, 0, 1, lk, mk(i), 0, false));
      for (const a of ['inf-walk', 'inf-flee', 'gun-walk', 'cav-gal']) {
        const key = `${side}-${a}`;
        if (this.anims.exists(key)) this.anims.remove(key);
        this.anims.create({ key, frames: [0, 1, 2, 3].map(k => ({ key: `${key}-${k}` })), frameRate: a === 'cav-gal' ? 12 : 8, repeat: -1 });
      }
    }
    this.canvasTex('cannon', 40, 20, g => {
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(20, 18, 16, 3, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4a3420'; g.fillRect(8, 10, 18, 4);
      g.save(); g.translate(18, 8); g.rotate(-0.18); g.fillStyle = '#3b3a37'; g.fillRect(-10, -3, 28, 6); g.fillStyle = '#5a5853'; g.fillRect(-10, -3, 28, 1.5); g.restore();
      for (const wx of [12, 24]) { g.fillStyle = '#5a3b22'; g.beginPath(); g.arc(wx, 14, 4, 0, Math.PI * 2); g.fill(); g.fillStyle = '#2b1d12'; g.beginPath(); g.arc(wx, 14, 1.2, 0, Math.PI * 2); g.fill(); }
    }, 0, 0);
    this.origins.cannon = [0.5, 0.9];
  }

  sprite(x: number, y: number, key: string, scale: number, flip: boolean) {
    const s = this.add.sprite(x, y, key);
    const o = this.origins[key] ?? [0.5, 1];
    s.setOrigin(flip ? 1 - o[0] : o[0], o[1]).setScale(scale / TEX).setFlipX(flip);
    return s;
  }

  clouds() {
    for (let k = 0; k < 5; k++) {
      const c = this.add.image(Math.random() * this.W, 20 + Math.random() * this.geo.horizon() * 0.5, 'cloud').setAlpha(0.8).setDepth(-900).setScale(0.6 + Math.random() * 0.8);
      this.tweens.add({ targets: c, x: c.x + 120 + Math.random() * 120, duration: 30000 + Math.random() * 20000, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
  }
  ripples() {
    const y0 = this.geo.horizon() + (this.H - this.geo.horizon()) * 0.13;
    for (let k = 0; k < 24; k++) {
      const r = this.add.image(Math.random() * this.W, y0 + Math.random() * 18, 'ripple').setDepth(-900).setAlpha(0);
      this.tweens.add({ targets: r, alpha: 0.7, x: r.x + 30, duration: 1600 + Math.random() * 1600, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
  }

  /* ---------- 城墙 ---------- */
  drawWall(b: BattleState) {
    if (!this.wallTex) {
      if (this.textures.exists('wall')) this.textures.remove('wall');
      this.wallTex = this.textures.createCanvas('wall', this.W, this.H)!;
      this.add.image(0, 0, 'wall').setOrigin(0).setDepth(-500);
      if (this.textures.exists('walltop')) this.textures.remove('walltop');
      const top = this.textures.createCanvas('walltop', this.W, this.H)!;
      this.add.image(0, 0, 'walltop').setOrigin(0).setDepth(3500);
      (this as any).wallTop = top;
    }
    const g = this.wallTex.getContext();
    g.clearRect(0, 0, this.W, this.H);
    const F = { b, next: null, t: 0, log: null, now: 0 };
    this.geo.drawWall(g, F);
    this.wallTex.refresh();
    const top: Phaser.Textures.CanvasTexture = (this as any).wallTop;
    const tg = top.getContext();
    tg.clearRect(0, 0, this.W, this.H);
    this.geo.drawWallTop(tg, F, false);
    top.refresh();
  }
  wallTopY(i: number) { const y = this.geo.laneY(i); return y - this.geo.wallH(y); }
  buildDefenders(b: BattleState) {
    for (const row of this.defenders) row.forEach(s => s.destroy());
    this.defenders = [[], [], []];
    for (let i = 0; i < 3; i++) {
      const l = b.def.lanes[i];
      if (l.routed) continue;
      const y = this.geo.laneY(i), x = this.geo.wallX(y), s = this.geo.laneS(i) * 0.85;
      const n = Math.max(2, Math.min(9, Math.round(Math.sqrt(l.troops) / 9)));
      for (let k = 0; k < n; k++) {
        const spr = this.sprite(x + 9 * s + k * 9 * s, this.wallTopY(i) - 1, 'def-half', s, true).setDepth(3400 + i);
        this.tweens.add({ targets: spr, y: spr.y - 1, duration: 600 + k * 70, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.defenders[i].push(spr);
      }
    }
  }

  /* ---------- 阵列 ---------- */
  baseX(side: 'att' | 'def', i: number) {
    const siege = this.b.kind === 'siege';
    if (side === 'att') return this.W * (siege ? 0.42 : 0.38);
    return siege ? this.geo.wallX(this.geo.laneY(i)) - 50 * this.geo.laneS(i) : this.W * 0.62;
  }
  buildGroup(side: 'att' | 'def', i: number, b: BattleState) {
    const key = side + i;
    this.groups[key]?.c.destroy();
    const lane = b[side].lanes[i];
    const s = this.geo.laneS(i);
    const y0 = this.geo.laneY(i);
    const dir = side === 'att' ? 1 : -1;
    const bx = this.baseX(side, i);
    const c = this.add.container(bx, y0).setDepth(1000 + i * 1000 + (side === 'att' ? 0 : 1));
    const g: Group = { c, units: [], flag: null, baseX: bx };
    this.groups[key] = g;
    if (lane.routed || lane.troops <= 0 || (b.kind === 'siege' && side === 'def')) { c.setVisible(!(b.kind === 'siege' && side === 'def') && false); return; }
    if (lane.withdrawn) c.setAlpha(0.4);
    if (b.kind === 'naval') {
      // 船队：三五条战船，随浪起伏
      const ns = Math.max(2, Math.min(6, Math.round(lane.troops / 2500)));
      for (let k = 0; k < ns; k++) {
        const x = -dir * (k % 3) * 46 * s - (k >= 3 ? dir * 22 * s : 0), y = (k >= 3 ? 12 : -4 + (k % 2) * 8) * s;
        const spr = this.sprite(x, y, `${side}-ship${k === 0 ? '-big' : ''}`, s * 0.9, dir < 0);
        c.add(spr);
        g.units.push({ spr, kind: 'ship', bx: x, by: y });
        this.tweens.add({ targets: spr, y: y - 2.5 * s, angle: dir * 2, duration: 900 + k * 130, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      }
      return;
    }
    const n = Math.max(5, Math.min(36, Math.round(Math.sqrt(lane.troops) / 3.6)));
    const rows = n > 24 ? 4 : n > 14 ? 3 : n > 6 ? 2 : 1;
    const mix = b[side].mix;
    const nc = Math.round(mix.cav * n), ng = Math.round(mix.gun * n);
    const list: { x: number; y: number; k: Kind }[] = [];
    let seed = i * 37 + (side === 'att' ? 3 : 5);
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let k = 0; k < n; k++) {
      const kind: Kind = k < ng ? 'gun' : k >= n - nc ? 'cav' : 'inf';
      const col = Math.floor(k / rows), r = k % rows;
      const sp = (kind === 'cav' ? 25 : 15) * s;
      list.push({ x: -dir * (col * sp + (r % 2) * 7 * s) + (rnd() - 0.5) * 4 * s, y: (r - (rows - 1) / 2) * 10 * s + (rnd() - 0.5) * 3 * s, k: kind });
    }
    list.sort((a, b2) => a.y - b2.y);
    for (const u of list) {
      const key2 = `${side}-${u.k === 'cav' ? 'cav-idle' : u.k + '-idle'}`;
      const spr = this.sprite(u.x, u.y, key2, s, dir < 0);
      c.add(spr);
      g.units.push({ spr, kind: u.k, bx: u.x, by: u.y });
      // 呼吸
      this.tweens.add({ targets: spr, y: u.y - 0.8 * s, duration: 700 + rnd() * 500, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: rnd() * 600 });
    }
    // 大旗：放在阵前偏后
    const front = list.reduce((a, b2) => (dir > 0 ? (b2.x > a.x ? b2 : a) : (b2.x < a.x ? b2 : a)), list[0]);
    const flag = this.sprite(front.x - dir * 16 * s, front.y - 2, `${side}-flag-${i}`, s, false);
    c.add(flag);
    g.flag = flag;
    this.tweens.add({ targets: flag, scaleX: flag.scaleX * 0.92, duration: this.b.weather === 'wind' ? 260 : 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  setPose(side: 'att' | 'def', i: number, pose: 'idle' | 'walk' | 'aim' | 'flee') {
    const g = this.groups[side + i];
    if (!g) return;
    for (const u of g.units) {
      if (u.kind === 'ship') continue;
      if (u.kind === 'cav') { if (pose === 'idle') u.spr.stop().setTexture(`${side}-cav-idle`); else u.spr.play(`${side}-cav-gal`, true); }
      else if (u.kind === 'gun' && pose === 'aim') u.spr.stop().setTexture(`${side}-gun-aim`);
      else if (pose === 'idle') u.spr.stop().setTexture(`${side}-${u.kind}-idle`);
      else if (pose === 'flee') u.spr.play(`${side}-inf-flee`, true);
      else u.spr.play(`${side}-${u.kind}-walk`, true);
      if (pose === 'flee') u.spr.setFlipX(side === 'att');
    }
  }

  wait(ms: number) { return new Promise<void>(r => this.time.delayedCall(ms, r)); }
  tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise(r => this.tweens.add({ ...cfg, onComplete: () => r() }));
  }

  /* ---------- 一回合 ---------- */
  async playRound(from: BattleState, to: BattleState, log: RoundLog, d: number) {
    const cam = this.cameras.main;
    // 1. 计策
    for (const st of log.stratagems) {
      const label = `${st.side === 'att' ? from.att.commanderName : from.def.commanderName} · ${{ ambush: '伏兵', fire: '火攻', night: '夜袭', persuade: '劝降' }[st.kind]}${st.ok ? '得手' : '未成'}`;
      const box = this.add.rectangle(this.W / 2, this.H * 0.16, 360, 54, 0x140c06, 0.82).setStrokeStyle(2, st.ok ? 0xe0b25b : 0x6f6252).setDepth(9500).setScale(0.6).setAlpha(0);
      const txt = this.add.text(this.W / 2, this.H * 0.16, label, { fontFamily: '"Ma Shan Zheng","Noto Serif SC",serif', fontSize: '30px', color: st.ok ? '#ffe2a0' : '#cfc2ae' }).setOrigin(0.5).setDepth(9501).setAlpha(0);
      this.tweens.add({ targets: [box, txt], alpha: 1, scale: 1, duration: 260 * d, ease: 'Back.out' });
      const foe = st.side === 'att' ? 'def' : 'att';
      if (st.ok) battleSfx[st.kind]();
      if (st.ok && st.kind === 'fire') for (let i = 0; i < 3; i++) { const g = this.groups[foe + i]; const x = g ? g.c.x : this.baseX(foe, i); this.flames.explode(40, x - (foe === 'att' ? 40 : -40), this.geo.laneY(i) - 10); }
      if (st.ok && st.kind === 'night') { const ov = this.add.rectangle(0, 0, this.W, this.H, 0x0a1030, 0).setOrigin(0).setDepth(8500); this.tweens.add({ targets: ov, fillAlpha: 0.55, duration: 300 * d, yoyo: true, hold: 500 * d, onComplete: () => ov.destroy() }); }
      if (st.ok && (st.kind === 'ambush' || st.kind === 'persuade')) cam.shake(250 * d, 0.004);
      await this.wait(700 * d);
      this.tweens.add({ targets: [box, txt], alpha: 0, duration: 200 * d, onComplete: () => { box.destroy(); txt.destroy(); } });
    }
    // 2. 前进 / 射击
    const advances: Promise<void>[] = [];
    for (let i = 0; i < 3; i++) {
      const ev = log.lanes[i];
      if (!ev) continue;
      for (const side of ['att', 'def'] as const) {
        const order = side === 'att' ? ev.att : ev.def;
        const g = this.groups[side + i];
        if (!g || !g.c.visible || !g.units.length) continue;
        const dir = side === 'att' ? 1 : -1;
        let dx = dir * this.W * (REACH[order] ?? 0);
        if (this.b.kind === 'siege' && side === 'att' && order === 'storm') dx = this.geo.wallX(this.geo.laneY(i)) - 34 * this.geo.laneS(i) - g.baseX;
        if (order === 'volley' || order === 'cannonade') { this.setPose(side, i, 'aim'); this.volley(side, i, d); if (order === 'cannonade') this.cameras.main.shake(160 * d, 0.004); }
        if (order === 'fireship' && i === 1) { battleSfx.fire(); }
        if (order === 'fireship') { const foeG = this.groups[(side === 'att' ? 'def' : 'att') + i]; if (foeG) this.time.delayedCall(500 * d, () => this.flames.explode(30, foeG.c.x, foeG.c.y - 20)); }
        else if (order === 'bombard') { this.bombard(i, d); }
        else if (Math.abs(dx) > 1) { if (i === 1) { battleSfx.advance(order === 'charge' || g.units.some(u => u.kind === 'cav')); if (order === 'charge' || order === 'storm') battleSfx.shout(); } this.setPose(side, i, 'walk'); advances.push(this.tween({ targets: g.c, x: g.baseX + dx, duration: (order === 'charge' ? 420 : 600) * d, ease: order === 'charge' ? 'Quad.in' : 'Sine.inOut' })); }
        if (order === 'storm' && this.b.kind === 'siege') { this.ladders(i, d); if (i === 1) battleSfx.ladders(); }
      }
      if (this.b.kind === 'siege' && (ev.def === 'volley' || ev.def === 'hold')) this.wallArrows(i, d);
      if (this.b.kind === 'siege' && ev.def === 'sortie') this.sortie(i, d);
    }
    await Promise.all(advances);
    if (!advances.length) await this.wait(500 * d);
    // 3. 交锋：尘土、火星、伤亡、数字
    let heavy = 0;
    for (let i = 0; i < 3; i++) {
      const ev = log.lanes[i];
      if (!ev) continue;
      const y = this.geo.laneY(i), s = this.geo.laneS(i);
      const ga = this.groups['att' + i], gd = this.groups['def' + i];
      const ax = ga ? ga.c.x : this.baseX('att', i);
      const dxp = this.b.kind === 'siege' ? this.geo.wallX(y) : (gd ? gd.c.x : this.baseX('def', i));
      if ((ev.attLoss || ev.defLoss) && Math.abs(dxp - ax) < this.W * 0.22) {
        const mx = (ax + dxp) / 2;
        this.dust.explode(Math.round(10 + s * 12), mx, y - 6 * s);
        this.sparks.explode(14, mx, y - 18 * s);
      }
      heavy += ev.attLoss + ev.defLoss;
      this.casualties('att', i, from, to);
      if (this.b.kind !== 'siege') this.casualties('def', i, from, to);
      else this.wallCasualties(i, from, to);
      this.floatNumber(ax - 30 * s, y - 56 * s, ev.attLoss);
      this.floatNumber(dxp + 30 * s, y - 66 * s, ev.defLoss);
    }
    if (heavy > 0) { cam.shake(320 * d, Math.min(0.012, 0.002 + heavy / 400000)); battleSfx.clash(Math.min(12, 4 + Math.round(heavy / 800))); }
    // 城防变化
    if (this.b.kind === 'siege' && log.wallAfter < log.wallBefore) {
      battleSfx.rubble();
      for (let i = 0; i < 3; i++) this.debris.explode(16, this.geo.wallX(this.geo.laneY(i)) + 6, this.wallTopY(i) + 20);
      this.drawWall(to);
    }
    await this.wait(450 * d);
    // 4. 溃逃与收队
    const backs: Promise<void>[] = [];
    for (let i = 0; i < 3; i++) for (const side of ['att', 'def'] as const) {
      const g = this.groups[side + i];
      if (!g || !g.units.length) continue;
      const fromL = from[side].lanes[i], toL = to[side].lanes[i];
      if (toL.routed && !fromL.routed) {
        battleSfx.rout();
        this.setPose(side, i, 'flee');
        backs.push(this.tween({ targets: g.c, x: g.c.x - (side === 'att' ? 1 : -1) * this.W * 0.45, alpha: 0, duration: 900 * d, ease: 'Quad.in' }));
      } else {
        backs.push(this.tween({ targets: g.c, x: g.baseX, duration: 450 * d, ease: 'Sine.inOut' }).then(() => this.setPose(side, i, 'idle')));
      }
    }
    await Promise.all(backs);
    // 5. 依新战局重排
    this.b = to;
    for (let i = 0; i < 3; i++) for (const side of ['att', 'def'] as const) this.buildGroup(side, i, to);
    if (to.kind === 'siege') {
      this.buildDefenders(to);
      if (to.outcome === 'breach') { battleSfx.breach(); cam.shake(700, 0.016); for (let i = 0; i < 3; i++) this.dust.explode(40, this.geo.wallX(this.geo.laneY(i)), this.geo.laneY(i) - 30); }
    }
  }

  volley(side: 'att' | 'def', i: number, d: number) {
    const g = this.groups[side + i];
    if (!g) return;
    const dir = side === 'att' ? 1 : -1;
    const s = this.geo.laneS(i);
    const guns = g.units.filter(u => u.kind === 'gun' || u.kind === 'ship');
    const shooters = guns.length ? guns : g.units.slice(0, 4);
    this.time.delayedCall(180 * d, () => {
      if (guns.length) battleSfx.muskets(); else battleSfx.arrows();
      for (const u of shooters) {
        const x = g.c.x + u.bx + dir * 20 * s, y = g.c.y + u.by - 19 * s;
        this.smoke.explode(3, x, y);
        this.sparks.explode(4, x, y);
        // 弹道
        const tx = this.b.kind === 'siege' && side === 'att' ? this.geo.wallX(this.geo.laneY(i)) : (this.groups[(side === 'att' ? 'def' : 'att') + i]?.c.x ?? x + dir * 200);
        const line = this.add.line(0, 0, x, y, x + dir * 30, y, 0xfff0c0, 0.9).setOrigin(0).setDepth(5200).setLineWidth(1.2);
        this.tweens.add({ targets: line, x: tx - x, alpha: 0, duration: 260 * d, onComplete: () => line.destroy() });
      }
      this.cameras.main.shake(120 * d, 0.002);
    });
  }

  bombard(i: number, d: number) {
    const y0 = this.geo.laneY(i), s = this.geo.laneS(i);
    const g = this.groups['att' + i];
    const cx = (g ? g.c.x : this.baseX('att', i)) + 26 * s;
    const can = this.sprite(cx, y0 + 8 * s, 'cannon', s * 1.2, false).setDepth(2000 + i * 1000);
    this.time.delayedCall(250 * d, () => {
      battleSfx.cannon();
      this.smoke.explode(8, cx + 20 * s, y0 - 2 * s);
      this.sparks.explode(10, cx + 20 * s, y0 - 2 * s);
      this.cameras.main.flash(120, 255, 220, 160);
      this.cameras.main.shake(200 * d, 0.006);
      const ball = this.add.image(cx + 20 * s, y0 - 2 * s, 'ball').setDepth(6000).setScale(s);
      const tx = this.b.kind === 'siege' ? this.geo.wallX(y0) + 4 : (this.groups['def' + i]?.c.x ?? cx + 300), ty = this.b.kind === 'siege' ? this.wallTopY(i) + 25 * s : y0 - 10;
      const sx = ball.x, sy = ball.y;
      this.tweens.addCounter({ from: 0, to: 1, duration: 420 * d, onUpdate: tw => { const p = tw.getValue() ?? 0; ball.setPosition(sx + (tx - sx) * p, sy + (ty - sy) * p - Math.sin(p * Math.PI) * 50 * s); },
        onComplete: () => { battleSfx.impact(); ball.destroy(); this.debris.explode(20, tx, ty); this.dust.explode(8, tx, ty); this.cameras.main.shake(180, 0.006); } });
    });
    this.time.delayedCall(1400 * d, () => this.tweens.add({ targets: can, alpha: 0, duration: 300, onComplete: () => can.destroy() }));
  }

  ladders(i: number, d: number) {
    const y0 = this.geo.laneY(i), s = this.geo.laneS(i), wx = this.geo.wallX(y0), top = this.wallTopY(i);
    const gfx = this.add.graphics().setDepth(1500 + i * 1000);
    for (const off of [-14, 8]) {
      const bx = wx - 28 * s + off * s, by = y0 + off * 0.3 * s;
      gfx.lineStyle(2.4 * s, 0x7a5530, 1);
      gfx.lineBetween(bx, by, wx + 2, top + 4); gfx.lineBetween(bx + 6 * s, by, wx + 7, top + 6);
      gfx.lineStyle(1.2 * s, 0x7a5530, 1);
      for (let r = 1; r < 8; r++) { const p = r / 8; gfx.lineBetween(bx + (wx + 2 - bx) * p, by + (top + 4 - by) * p, bx + 6 * s + (wx + 7 - bx - 6 * s) * p, by + (top + 6 - by) * p); }
      const climber = this.sprite(bx + 3 * s, by, 'att-inf-walk-0', s * 0.9, false).setDepth(1600 + i * 1000);
      climber.play('att-inf-walk');
      this.tweens.add({ targets: climber, x: wx - 2, y: top + 2, duration: 900 * d, delay: 300 * d, onComplete: () => this.tweens.add({ targets: climber, alpha: 0, duration: 300, onComplete: () => climber.destroy() }) });
    }
    this.time.delayedCall(1900 * d, () => this.tweens.add({ targets: gfx, alpha: 0, duration: 300, onComplete: () => gfx.destroy() }));
  }

  wallArrows(i: number, d: number) {
    const y = this.geo.laneY(i), top = this.wallTopY(i), wx = this.geo.wallX(y);
    const g = this.groups['att' + i];
    const tx = g ? g.c.x : this.baseX('att', i);
    for (let k = 0; k < 9; k++) {
      const a = this.add.image(wx + 10, top - 6, 'arrow').setDepth(6000).setFlipX(true);
      const ex = tx - Math.random() * 60, ey = y - Math.random() * 14;
      const sx = a.x, sy = a.y;
      this.tweens.addCounter({ from: 0, to: 1, delay: k * 50 * d + 120 * d, duration: 520 * d, onUpdate: tw => {
        const p = tw.getValue() ?? 0; const x = sx + (ex - sx) * p, yy = sy + (ey - sy) * p - Math.sin(p * Math.PI) * 70;
        const p2 = Math.min(1, p + 0.02), x2 = sx + (ex - sx) * p2, y2 = sy + (ey - sy) * p2 - Math.sin(p2 * Math.PI) * 70;
        a.setPosition(x, yy).setRotation(Math.atan2(y2 - yy, x2 - x) + Math.PI);
      }, onComplete: () => this.tweens.add({ targets: a, alpha: 0, duration: 500, onComplete: () => a.destroy() }) });
    }
  }

  sortie(i: number, d: number) {
    const y = this.geo.laneY(1), s = this.geo.laneS(1), gx = this.geo.wallX(y);
    for (let k = 0; k < 6; k++) {
      const spr = this.sprite(gx, y - 2 + k * 2, 'def-inf-walk-0', s, true).setDepth(2600);
      spr.play('def-inf-walk');
      this.tweens.add({ targets: spr, x: gx - this.W * 0.12 - k * 10 * s, duration: 600 * d, delay: k * 60 * d, yoyo: true, hold: 300 * d, onComplete: () => spr.destroy() });
    }
    void i;
  }

  casualties(side: 'att' | 'def', i: number, from: BattleState, to: BattleState) {
    const g = this.groups[side + i];
    if (!g || !g.units.length) return;
    const lost = from[side].lanes[i].troops - to[side].lanes[i].troops;
    if (lost <= 0) return;
    const k = Math.min(g.units.length - 1, Math.max(1, Math.round(g.units.length * lost / Math.max(1, from[side].lanes[i].troops))));
    const dir = side === 'att' ? 1 : -1;
    // 倒下的总是前排
    const front = [...g.units].sort((a, b) => dir * (b.bx - a.bx)).slice(0, k);
    for (const u of front) {
      const wx = g.c.x + u.bx, wy = g.c.y + u.by;
      this.tweens.add({ targets: u.spr, angle: -dir * 80, alpha: 0, duration: 380, ease: 'Quad.in', onComplete: () => u.spr.setVisible(false) });
      const body = this.sprite(wx, wy + 2, `${side}-fallen`, this.geo.laneS(i), dir < 0).setDepth(900 + i * 1000).setAlpha(0);
      this.tweens.add({ targets: body, alpha: 1, duration: 300, delay: 250 });
    }
  }
  wallCasualties(i: number, from: BattleState, to: BattleState) {
    const lost = from.def.lanes[i].troops - to.def.lanes[i].troops;
    const row = this.defenders[i];
    if (lost <= 0 || !row.length) return;
    const k = Math.min(row.length, Math.max(1, Math.round(row.length * lost / Math.max(1, from.def.lanes[i].troops) * 1.5)));
    for (const spr of row.slice(0, k)) this.tweens.add({ targets: spr, y: spr.y + 8, alpha: 0, duration: 400 });
  }

  floatNumber(x: number, y: number, n: number) {
    if (!n) return;
    const t = this.add.text(x, y, '-' + n.toLocaleString('zh-CN'), { fontFamily: '"Noto Serif SC",serif', fontSize: '22px', fontStyle: '900', color: '#ffd2c4', stroke: '#2a0c06', strokeThickness: 4 }).setOrigin(0.5).setDepth(9400);
    this.tweens.add({ targets: t, y: y - 46, alpha: 0, duration: 1300, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  showResult(win: boolean, text: string) {
    const bg = this.add.rectangle(this.W / 2, this.H * 0.45, this.W, 150, 0x120a05, 0.72).setDepth(9800).setAlpha(0);
    const big = this.add.text(this.W / 2, this.H * 0.41, win ? '胜' : '败', { fontFamily: '"Ma Shan Zheng","Noto Serif SC",serif', fontSize: '96px', color: win ? '#f6d27a' : '#d4bca2', stroke: '#2a1206', strokeThickness: 6 }).setOrigin(0.5).setDepth(9801).setScale(2.4).setAlpha(0);
    const sub = this.add.text(this.W / 2, this.H * 0.52, text, { fontFamily: '"Noto Serif SC",serif', fontSize: '20px', color: '#f3e6c8' }).setOrigin(0.5).setDepth(9801).setAlpha(0);
    this.tweens.add({ targets: bg, alpha: 1, duration: 300 });
    this.tweens.add({ targets: big, alpha: 1, scale: 1, duration: 520, ease: 'Back.out' });
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 300 });
    if (win) { this.sparks.explode(80, this.W / 2, this.H * 0.41); this.cameras.main.flash(300, 255, 230, 160); }
    else this.cameras.main.shake(300, 0.005);
  }
}
