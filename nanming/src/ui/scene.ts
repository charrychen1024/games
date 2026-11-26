/* 小场景动画：弹窗顶部、史事抉择、战报插画里的一幅会动的水墨小画。
 * 议和是两人对坐、展卷、钤印；城破是云梯攀城、炮击、城门崩开、易帜；交兵是两阵对冲、扬尘溅墨……
 * 全部 Canvas 自绘，与战斗画面同一套水墨画法（ink.ts）。元素离开页面即自行停止；减少动态效果时只画最要紧的一帧。 */
import { ink, tint, paper, mountains, mkRnd, puff, splatter, eave, tree, agedEdges, type Rnd } from './ink';
import { isReduced } from './motion';

export type SceneKind = 'parley' | 'siege' | 'surrender' | 'battle' | 'war' | 'court' | 'throne' | 'death' | 'disaster' | 'march' | 'econ' | 'appoint' | 'recruit' | 'prison' | 'study';
export type Hat = 'ming' | 'qing' | 'shun' | 'plain' | 'crown';
export interface Party { color: string; mark?: string; hat?: Hat }
/** mode：loop 一直动（默认）；still 只画最要紧的一帧；hover 平时静止、鼠标移上（或 play()）才动 */
/** hero：人物档案用，前景中央画一位骑马的主帅（a 方） */
export interface SceneOpts { a?: Party; b?: Party; seed?: number; ok?: boolean; mode?: 'loop' | 'still' | 'hover'; hero?: boolean }

/** 每种场景一个循环的长度（秒）与“最要紧的一刻”（减少动态时只画这一帧） */
const LOOP: Record<SceneKind, [number, number]> = {
  parley: [7, 5.4], siege: [7.5, 4.6], surrender: [6.5, 4.5], battle: [6, 3.2], war: [3.2, 0.5], court: [6, 3.5], throne: [6, 3],
  death: [6, 2], disaster: [6, 2], march: [6, 3], econ: [5, 2.5], appoint: [6, 3.6], recruit: [6, 3], prison: [5, 2], study: [6, 3],
};

export function scene(kind: SceneKind, o: SceneOpts = {}): { el: HTMLElement; stop(): void; play(): void; pause(): void } {
  const el = document.createElement('div');
  el.className = 'scene';
  el.dataset.scene = kind;
  const cv = document.createElement('canvas');
  el.append(cv);
  const g = cv.getContext('2d')!;
  const a: Required<Party> = { color: o.a?.color ?? '#b5342a', mark: o.a?.mark ?? '', hat: o.a?.hat ?? 'ming' };
  const b: Required<Party> = { color: o.b?.color ?? '#3a5d8f', mark: o.b?.mark ?? '', hat: o.b?.hat ?? 'qing' };
  const seed = o.seed ?? 7;
  let W = 0, H = 0, dpr = 1, bg: HTMLCanvasElement | null = null, raf = 0, t0 = 0, stopped = false;
  let ro: ResizeObserver | null = null;
  const reduced = isReduced();
  const [loop, climax] = LOOP[kind];
  /** 此刻是否在动 */
  let live = !reduced && (o.mode ?? 'loop') === 'loop';

  const size = () => {
    // 用布局尺寸（不受入场缩放动画影响）
    const w = el.clientWidth, hh = el.clientHeight;
    if (!w) return false;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = w; H = hh || 150;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    bg = null;
    return true;
  };
  const frame = (now: number) => {
    if (stopped) return;
    if (!el.isConnected) { if (t0) { stop(); return; } raf = requestAnimationFrame(frame); return; }
    if (!W && !size()) { raf = requestAnimationFrame(frame); return; }
    if (!t0) t0 = now;
    const t = !live ? climax : ((now - t0) / 1000) % loop;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!bg) bg = backdrop(kind, W, H, dpr, seed, a, b);
    g.drawImage(bg, 0, 0, W, H);
    // 很宽的窗口：人物布景只占中间一块舞台（宽不过高的 4.2 倍），纸底远山照样铺满
    const Wd = Math.min(W, H * 4.2), off = (W - Wd) / 2;
    g.save(); g.translate(off, 0);
    draw(kind, g, Wd, H, t, (now - t0) / 1000, a, b, seed, o.ok !== false);
    if (o.hero) rider(g, Wd * 0.5, H * 0.97, H / 150 * 1.25, a, (now - t0) / 1000, kind === 'march');
    g.restore();
    agedEdges(g, W, H, 0.22);
    if (live) raf = requestAnimationFrame(frame);
  };
  const stop = () => { stopped = true; cancelAnimationFrame(raf); ro?.disconnect(); };
  const play = () => { if (reduced || live || stopped) return; live = true; t0 = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
  const pause = () => { if (!live || (o.mode ?? 'loop') === 'loop') return; live = false; cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); };
  if (o.mode === 'hover') { el.addEventListener('pointerenter', play); el.addEventListener('pointerleave', pause); }
  raf = requestAnimationFrame(frame);
  // 窗口或容器尺寸变了：重量、重画背景
  ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { if (W && (el.clientWidth !== W || el.clientHeight !== H)) { size(); if (!live) raf = requestAnimationFrame(frame); } }) : null;
  ro?.observe(el);
  return { el, stop, play, pause };
}

/* ================= 共用小件 ================= */
const skin = '#ead7b4';
/** 一个人：立、跪、坐、拜；arm 0~1 抬手；facing 1 朝右、-1 朝左 */
function person(g: CanvasRenderingContext2D, x: number, y: number, s: number, p: { color: string; hat: Hat; pose?: 'stand' | 'kneel' | 'sit' | 'bow'; facing?: 1 | -1; arm?: number; bob?: number }) {
  const f = p.facing ?? 1, pose = p.pose ?? 'stand', arm = p.arm ?? 0;
  const col = tint(p.color, 0.2);
  g.save(); g.translate(x, y + (p.bob ?? 0)); g.scale(f * s, s);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const line = ink(0.92, 0.95);
  const bodyH = pose === 'stand' ? 34 : pose === 'bow' ? 22 : 22;
  const lean = pose === 'bow' ? 0.55 : pose === 'kneel' ? 0.12 : 0;
  // 袍
  g.fillStyle = col;
  g.beginPath();
  if (pose === 'stand') { g.moveTo(-9, 0); g.lineTo(-6, -bodyH); g.lineTo(6, -bodyH); g.lineTo(10, 0); }
  else { g.moveTo(-14, 0); g.quadraticCurveTo(-12, -8, -6 + lean * 10, -bodyH); g.lineTo(6 + lean * 14, -bodyH + lean * 6); g.quadraticCurveTo(12, -8, 12, 0); }
  g.closePath(); g.fill(); g.strokeStyle = line; g.lineWidth = 1.3 / s * 1.2; g.stroke();
  // 腰带
  g.strokeStyle = ink(0.7, 0.8); g.lineWidth = 1.6; g.beginPath(); g.moveTo(-7 + lean * 6, -bodyH * 0.5); g.lineTo(7 + lean * 8, -bodyH * 0.5 + lean * 3); g.stroke();
  // 头
  const hx = 0 + lean * 16, hy = -bodyH - 6 + lean * 8;
  g.fillStyle = skin; g.beginPath(); g.arc(hx, hy, 6, 0, Math.PI * 2); g.fill(); g.strokeStyle = line; g.lineWidth = 1.1; g.stroke();
  // 冠帽
  g.fillStyle = ink(0.95);
  if (p.hat === 'ming') { g.fillRect(hx - 6, hy - 11, 12, 6); g.beginPath(); g.ellipse(hx, hy - 11, 4.5, 3, 0, Math.PI, 0); g.fill(); g.fillRect(hx - 12, hy - 8, 24, 1.8); }
  else if (p.hat === 'qing') { g.beginPath(); g.ellipse(hx, hy - 5, 8, 3.5, 0, Math.PI, 0); g.fill(); g.fillStyle = '#b8352a'; g.beginPath(); g.ellipse(hx, hy - 8, 4, 2.5, 0, Math.PI, 0); g.fill(); g.fillStyle = ink(0.95); g.beginPath(); g.arc(hx, hy - 10.5, 1.6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink(0.9); g.lineWidth = 1.8; g.beginPath(); g.moveTo(hx - 5, hy + 1); g.quadraticCurveTo(hx - 9, hy + 10, hx - 7, hy + 18); g.stroke(); }
  else if (p.hat === 'shun') { g.beginPath(); g.moveTo(hx - 8, hy - 4); g.lineTo(hx, hy - 13); g.lineTo(hx + 8, hy - 4); g.closePath(); g.fill(); }
  else if (p.hat === 'crown') { g.fillRect(hx - 7, hy - 11, 14, 5); g.fillStyle = '#c9a33c'; g.fillRect(hx - 10, hy - 13, 20, 2.4); g.strokeStyle = '#c9a33c'; g.lineWidth = 0.8; for (let k = -3; k <= 3; k++) { g.beginPath(); g.moveTo(hx + k * 3, hy - 11); g.lineTo(hx + k * 3, hy - 5); g.stroke(); } }
  else { g.beginPath(); g.ellipse(hx, hy - 4, 6, 4, 0, Math.PI, 0); g.fill(); }
  // 胡须
  if (p.hat !== 'plain') { g.strokeStyle = ink(0.8, 0.8); g.lineWidth = 0.8; g.beginPath(); g.moveTo(hx + 4, hy + 3); g.lineTo(hx + 5, hy + 9); g.stroke(); }
  // 臂：自肩抬起
  const sx = 2 + lean * 12, sy = -bodyH + 6 + lean * 5;
  const ang = -0.3 - arm * 1.3;
  const ex = sx + Math.cos(ang) * 14, ey = sy - Math.sin(-ang) * 14 * (arm > 0 ? 1 : -0.6);
  g.strokeStyle = col; g.lineWidth = 6; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
  g.strokeStyle = line; g.lineWidth = 1; g.beginPath(); g.moveTo(sx, sy - 3); g.lineTo(ex, ey - 3); g.moveTo(sx, sy + 3); g.lineTo(ex, ey + 3); g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(ex + 1.5, ey, 2.4, 0, Math.PI * 2); g.fill();
  g.restore();
}
/** 骑马的主帅：马、人、身后一面大旗；walking 时马蹄交替、身形起伏 */
function rider(g: CanvasRenderingContext2D, x: number, y: number, s: number, p: Required<Party>, T: number, walking: boolean) {
  const bob = walking ? Math.abs(Math.sin(T * 4)) * -2 * s : Math.sin(T * 1.2) * -0.8 * s;
  flag(g, x - 26 * s, y - 2 * s, 70 * s, p, T * 3, -1);
  g.save(); g.translate(x, y + bob); g.lineCap = 'round';
  const leg = (lx: number, ph: number) => { const sw = walking ? Math.sin(T * 8 + ph) * 5 * s : 0; g.strokeStyle = ink(0.9); g.lineWidth = 3 * s; g.beginPath(); g.moveTo(lx, -14 * s); g.lineTo(lx + sw, 0); g.stroke(); };
  leg(-14 * s, 0); leg(-8 * s, Math.PI); leg(10 * s, Math.PI); leg(16 * s, 0);
  g.fillStyle = '#6a5038'; g.beginPath(); g.ellipse(0, -20 * s, 20 * s, 8 * s, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink(0.92); g.lineWidth = 1.2; g.stroke();
  g.beginPath(); g.moveTo(16 * s, -24 * s); g.quadraticCurveTo(24 * s, -34 * s, 28 * s, -36 * s); g.lineTo(31 * s, -30 * s); g.quadraticCurveTo(25 * s, -26 * s, 20 * s, -16 * s); g.closePath(); g.fill(); g.stroke();
  g.strokeStyle = ink(0.95, 0.8); g.lineWidth = 2 * s; g.beginPath(); g.moveTo(-20 * s, -22 * s); g.quadraticCurveTo(-28 * s, -16 * s, -26 * s, -6 * s); g.stroke();
  g.fillStyle = tint(p.color, 0.3); g.fillRect(-9 * s, -29 * s, 18 * s, 5 * s);
  g.restore();
  person(g, x - 2 * s, y + bob - 24 * s, s * 0.9, { color: p.color, hat: p.hat, pose: 'sit', facing: 1, arm: 0.3 + (walking ? 0 : Math.abs(Math.sin(T)) * 0.3) });
}
/** 小兵（远景群像用）：墨线小人，旗色号衣，持矛 */
function soldier(g: CanvasRenderingContext2D, x: number, y: number, s: number, color: string, facing: 1 | -1, step: number) {
  g.save(); g.translate(x, y); g.scale(facing * s, s); g.lineCap = 'round';
  g.strokeStyle = ink(0.9); g.lineWidth = 1.6;
  g.beginPath(); g.moveTo(-1.5, -8); g.lineTo(-2.5 - step, 0); g.moveTo(1.5, -8); g.lineTo(2.5 + step, 0); g.stroke();
  g.fillStyle = tint(color, 0.2); g.beginPath(); g.moveTo(-4, -7); g.lineTo(-3, -17); g.lineTo(3, -17); g.lineTo(4, -7); g.closePath(); g.fill();
  g.lineWidth = 0.8; g.stroke();
  g.fillStyle = skin; g.beginPath(); g.arc(0, -20, 2.6, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = ink(0.85); g.beginPath(); g.arc(0, -21, 2.8, Math.PI, 0); g.fill();
  g.strokeStyle = ink(0.85); g.lineWidth = 1; g.beginPath(); g.moveTo(4, -10); g.lineTo(7, -32); g.stroke();
  g.restore();
}
/** 旗：杆、旗面（牙边）、字号 */
function flag(g: CanvasRenderingContext2D, x: number, y: number, h: number, p: Party, wave: number, dir: 1 | -1 = 1) {
  g.save(); g.lineCap = 'round';
  g.strokeStyle = ink(0.92); g.lineWidth = Math.max(1.2, h * 0.03); g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - h); g.stroke();
  const fw = h * 0.42 * dir, fh = h * 0.46, top = y - h;
  const w = (t: number) => Math.sin(wave + t * 3) * fh * 0.07 * t;
  g.fillStyle = tint(p.color, 0.15);
  g.beginPath(); g.moveTo(x, top);
  for (let t = 0; t <= 1; t += 0.1) g.lineTo(x + fw * t, top + w(t));
  for (let k = 0; k <= 5; k++) g.lineTo(x + fw + w(1) + (k % 2 ? fh * 0.08 * dir : 0), top + fh * k / 5 + w(1));
  for (let t = 1; t >= 0; t -= 0.1) g.lineTo(x + fw * t, top + fh + w(t));
  g.closePath(); g.fill(); g.strokeStyle = ink(0.9, 0.8); g.lineWidth = 0.8; g.stroke();
  if (p.mark && h > 24) { g.fillStyle = 'rgba(245,236,214,0.92)'; const cx = x + fw * 0.5, cy = top + fh * 0.5 + w(0.5), r = Math.abs(fw) * 0.3; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink(0.95); g.font = `900 ${Math.round(r * 1.5)}px "Ma Shan Zheng","Noto Serif SC",serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.mark.slice(0, 1), cx, cy + 1); }
  g.restore();
}
/** 朱印：一方红印，钤下时由大变小 */
function seal(g: CanvasRenderingContext2D, x: number, y: number, r: number, k: number, text = '印') {
  if (k <= 0) return;
  const sc = k < 1 ? 1 + (1 - k) * 1.6 : 1;
  g.save(); g.translate(x, y); g.scale(sc, sc); g.globalAlpha = Math.min(1, k * 1.4);
  g.fillStyle = 'rgba(178,40,30,0.88)'; g.fillRect(-r, -r, r * 2, r * 2);
  g.strokeStyle = 'rgba(250,235,215,0.9)'; g.lineWidth = r * 0.12; g.strokeRect(-r * 0.78, -r * 0.78, r * 1.56, r * 1.56);
  g.fillStyle = 'rgba(250,235,215,0.95)'; g.font = `900 ${Math.round(r * 1.2)}px "Ma Shan Zheng","Noto Serif SC",serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 0, r * 0.06);
  g.restore();
}
/** 卷轴：自中向两边展开，k 0~1 */
function scroll(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number, lines = 5) {
  const ww = w * Math.max(0.06, k);
  g.fillStyle = 'rgba(246,238,216,0.98)'; g.fillRect(x - ww / 2, y - h / 2, ww, h);
  g.strokeStyle = ink(0.8, 0.6); g.lineWidth = 0.8; g.strokeRect(x - ww / 2, y - h / 2, ww, h);
  g.strokeStyle = ink(0.75, 0.55); g.lineWidth = 1;
  for (let k2 = 0; k2 < lines; k2++) { const lx = x - ww / 2 + ww * (k2 + 0.7) / (lines + 0.4); if (lx > x + ww / 2 - 3) break; g.beginPath(); g.moveTo(lx, y - h * 0.36); g.lineTo(lx, y + h * 0.3 - (k2 % 2) * h * 0.15); g.stroke(); }
  g.fillStyle = '#7a4a24'; for (const d of [-1, 1]) { g.fillRect(x + d * ww / 2 - 2.5, y - h / 2 - 3, 5, h + 6); }
}
const ease = (k: number) => k <= 0 ? 0 : k >= 1 ? 1 : k * k * (3 - 2 * k);
const seg = (t: number, a0: number, a1: number) => ease((t - a0) / (a1 - a0));

/* ================= 背景（缓存） ================= */
function backdrop(kind: SceneKind, W0: number, H: number, dpr: number, seed: number, a: Party, b: Party): HTMLCanvasElement {
  let W = W0;
  const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
  const g = c.getContext('2d')!; g.scale(dpr, dpr);
  const r = mkRnd(seed * 13 + kind.length);
  const dim = kind === 'death' || kind === 'disaster';
  paper(g, W, H, dim ? '#ddd4c0' : '#ebdfc4');
  const indoor = kind === 'parley' || kind === 'court' || kind === 'throne' || kind === 'appoint' || kind === 'econ' || kind === 'prison' || kind === 'study';
  if (!indoor) {
    mountains(g, W, H * 0.5, H * 0.32, r, { layers: 3, dark: dim ? 0.65 : 0.5 });
    const gr = g.createLinearGradient(0, H * 0.5, 0, H);
    gr.addColorStop(0, 'rgba(140,138,82,0.12)'); gr.addColorStop(1, 'rgba(120,118,70,0.32)');
    g.fillStyle = gr; g.fillRect(0, H * 0.5, W, H * 0.5);
  } else {
    // 室内：满幅地面与墙裙
    g.fillStyle = 'rgba(190,170,120,0.45)'; g.fillRect(0, H * 0.78, W, H * 0.22);
    g.strokeStyle = ink(0.6, 0.25); for (let x = 0; x < W; x += 14) { g.beginPath(); g.moveTo(x, H * 0.78); g.lineTo(x - 10, H); g.stroke(); }
    g.fillStyle = ink(0.85, 0.9); g.fillRect(0, 0, W, 8);
  }
  // 布景只占中间一块舞台
  const Wfull = W; W = Math.min(W, H * 4.2); g.translate((Wfull - W) / 2, 0);
  if (kind === 'parley' || kind === 'appoint') {
    // 亭中：两根朱柱、屏风山水、地上席
    g.fillStyle = 'rgba(206,190,150,0.5)'; g.fillRect(W * 0.18, H * 0.12, W * 0.64, H * 0.58);
    g.save(); g.beginPath(); g.rect(W * 0.2, H * 0.15, W * 0.6, H * 0.52); g.clip(); mountains(g, W, H * 0.6, H * 0.3, r, { layers: 2, dark: 0.45 }); g.restore();
    g.strokeStyle = ink(0.85, 0.8); g.lineWidth = 2; g.strokeRect(W * 0.2, H * 0.15, W * 0.6, H * 0.52);
    for (const x of [W * 0.07, W * 0.93]) { g.fillStyle = 'rgba(150,60,45,0.9)'; g.fillRect(x - 6, 0, 12, H); g.strokeStyle = ink(0.9, 0.7); g.lineWidth = 1; g.strokeRect(x - 6, 0, 12, H); }
  }
  if (kind === 'court' || kind === 'throne') {
    // 殿：台基、朱柱、重檐
    const cx = W / 2, top = H * 0.16;
    g.fillStyle = 'rgba(210,196,160,0.95)'; g.fillRect(cx - W * 0.3, H * 0.58, W * 0.6, H * 0.1);
    g.strokeStyle = ink(0.8, 0.7); g.lineWidth = 1; g.strokeRect(cx - W * 0.3, H * 0.58, W * 0.6, H * 0.1);
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(200,186,150,0.9)'; g.fillRect(cx - W * 0.08 - k * 6, H * 0.68 + k * 6, W * 0.16 + k * 12, 6); }
    g.fillStyle = 'rgba(214,200,165,0.97)'; g.fillRect(cx - W * 0.25, top + H * 0.16, W * 0.5, H * 0.26);
    for (let k = 0; k <= 8; k++) { g.fillStyle = 'rgba(150,60,45,0.9)'; g.fillRect(cx - W * 0.25 + k * W * 0.0625 - 2.5, top + H * 0.16, 5, H * 0.26); }
    eave(g, cx, top + H * 0.17, W * 0.62, H * 0.12, 0.9);
    eave(g, cx, top + H * 0.04, W * 0.42, H * 0.1, 0.92);
    if (kind === 'throne') { g.fillStyle = 'rgba(200,160,50,0.35)'; g.fillRect(cx - 22, top + H * 0.2, 44, H * 0.22); }
  }
  if (kind === 'econ') {
    // 仓廪：三间粮仓
    for (let k = -1; k <= 1; k++) {
      const x = W / 2 + k * W * 0.24, y = H * 0.66, w = W * 0.18;
      g.fillStyle = 'rgba(214,198,160,0.97)'; g.fillRect(x - w / 2, y - H * 0.28, w, H * 0.28);
      g.strokeStyle = ink(0.8, 0.8); g.lineWidth = 1; g.strokeRect(x - w / 2, y - H * 0.28, w, H * 0.28);
      g.fillStyle = ink(0.9, 0.85); g.fillRect(x - w * 0.12, y - H * 0.18, w * 0.24, H * 0.18);
      eave(g, x, y - H * 0.27, w * 1.3, H * 0.12, 0.85);
    }
  }
  if (kind === 'siege' || kind === 'surrender') {
    // 城：墙、垛口、城门楼
    const wy = H * 0.7, wh = H * 0.26, x0 = W * 0.18, x1 = W * 0.98, S = H / 150;
    const fg = g.createLinearGradient(0, wy - wh, 0, wy);
    fg.addColorStop(0, '#a7a08d'); fg.addColorStop(1, '#7f7867');
    g.fillStyle = fg; g.fillRect(x0, wy - wh, x1 - x0, wh);
    g.strokeStyle = ink(0.6, 0.18); g.lineWidth = 0.6;
    for (let k = 1; k < 7; k++) { const y = wy - wh + wh * k / 7; g.beginPath(); g.moveTo(x0, y); g.lineTo(x1, y); g.stroke(); }
    g.strokeStyle = ink(0.9, 0.8); g.lineWidth = 1.2; g.strokeRect(x0, wy - wh, x1 - x0, wh);
    for (let x = x0 + 2; x < x1 - 6; x += 13) { g.fillStyle = '#a19a86'; g.fillRect(x, wy - wh - 7, 8, 7); g.strokeStyle = ink(0.85, 0.7); g.lineWidth = 0.7; g.strokeRect(x, wy - wh - 7, 8, 7); }
    const gx = W * 0.6;
    g.fillStyle = 'rgba(214,198,160,0.97)'; g.fillRect(gx - 28 * S, wy - wh - 24 * S, 56 * S, 18 * S); g.strokeStyle = ink(0.85, 0.8); g.strokeRect(gx - 28 * S, wy - wh - 24 * S, 56 * S, 18 * S);
    for (let k = 0; k <= 4; k++) { g.fillStyle = 'rgba(150,60,45,0.9)'; g.fillRect(gx - 28 * S + k * 14 * S - 1.5, wy - wh - 24 * S, 3, 18 * S); }
    eave(g, gx, wy - wh - 22 * S, 84 * S, 13 * S, 0.9);
    eave(g, gx, wy - wh - 34 * S, 58 * S, 10 * S, 0.92);
    g.fillStyle = 'rgba(80,110,120,0.5)'; g.fillRect(0, wy + 2, W, 7);
  }
  if (kind === 'study') {
    // 书斋：窗棂、书架
    g.fillStyle = 'rgba(206,190,150,0.5)'; g.fillRect(W * 0.08, H * 0.12, W * 0.3, H * 0.5);
    g.strokeStyle = ink(0.8, 0.6); g.lineWidth = 1;
    for (let k = 0; k <= 6; k++) { g.beginPath(); g.moveTo(W * 0.08 + k * W * 0.05, H * 0.12); g.lineTo(W * 0.08 + k * W * 0.05, H * 0.62); g.stroke(); }
    for (let k = 0; k <= 5; k++) { g.beginPath(); g.moveTo(W * 0.08, H * 0.12 + k * H * 0.1); g.lineTo(W * 0.38, H * 0.12 + k * H * 0.1); g.stroke(); }
    g.fillStyle = 'rgba(120,80,45,0.85)'; g.fillRect(W * 0.7, H * 0.1, W * 0.22, H * 0.66);
    for (let k = 0; k < 4; k++) { g.fillStyle = 'rgba(60,40,25,0.9)'; g.fillRect(W * 0.7, H * 0.1 + k * H * 0.165, W * 0.22, 3); for (let j = 0; j < 7; j++) { g.fillStyle = ['#b8a27a', '#8c6a35', '#6f7a5a', '#a0553a'][(j + k) % 4]; g.fillRect(W * 0.71 + j * W * 0.028, H * 0.1 + k * H * 0.165 + 4, W * 0.022, H * 0.13); } }
  }
  if (kind === 'prison') {
    // 牢：石墙、草席
    g.fillStyle = 'rgba(120,112,96,0.55)'; g.fillRect(0, 0, W, H * 0.78);
    g.strokeStyle = ink(0.7, 0.25); g.lineWidth = 0.8;
    for (let y = 0; y < H * 0.78; y += 14) for (let x = (y / 14) % 2 * 16; x < W; x += 32) g.strokeRect(x, y, 32, 14);
    g.fillStyle = 'rgba(255,240,200,0.25)'; g.fillRect(W * 0.62, H * 0.12, W * 0.08, H * 0.16);
    g.strokeStyle = ink(0.9); g.lineWidth = 2; for (let k = 1; k < 4; k++) { g.beginPath(); g.moveTo(W * 0.62 + k * W * 0.02, H * 0.12); g.lineTo(W * 0.62 + k * W * 0.02, H * 0.28); g.stroke(); }
  }
  if (kind === 'disaster') {
    g.strokeStyle = ink(0.8, 0.35); g.lineWidth = 0.9;
    for (let k = 0; k < 30; k++) { let x = r() * W, y = H * 0.62 + r() * H * 0.35; g.beginPath(); g.moveTo(x, y); for (let j = 0; j < 4; j++) { x += (r() - 0.5) * 30; y += (r() - 0.3) * 8; g.lineTo(x, y); } g.stroke(); }
    tree(g, W * 0.82, H * 0.82, 1.1, 'bare', r, 0.9);
    tree(g, W * 0.12, H * 0.8, 0.8, 'bare', r, 0.8);
  }
  if (kind === 'march' || kind === 'battle' || kind === 'war' || kind === 'recruit') {
    for (let k = 0; k < 5; k++) tree(g, r() * W, H * (0.52 + r() * 0.06), 0.4 + r() * 0.3, r() < 0.5 ? 'grove' : 'pine', r, 0.6);
  }
  void a; void b;
  return c;
}

/* ================= 每帧 ================= */
function draw(kind: SceneKind, g: CanvasRenderingContext2D, W: number, H: number, t: number, T: number, a: Required<Party>, b: Required<Party>, seed: number, ok: boolean) {
  const S = H / 150;   // 以 150 高为基准的比例
  const r: Rnd = mkRnd(seed + Math.floor(T * 4));
  switch (kind) {
    case 'parley': {
      // 两人对坐：左方先言、右方答；中间展卷、钤印（不成则掷卷）
      const ty = H * 0.8;
      flag(g, W * 0.15, H * 0.72, H * 0.55, a, T * 2, 1);
      flag(g, W * 0.85, H * 0.72, H * 0.55, b, T * 2 + 1, -1);
      g.fillStyle = '#6a4a2c'; g.fillRect(W * 0.38, ty - 16 * S, W * 0.24, 6 * S); g.fillRect(W * 0.4, ty - 10 * S, 4 * S, 10 * S); g.fillRect(W * 0.6 - 4 * S, ty - 10 * S, 4 * S, 10 * S);
      const speakA = t < 2.2 ? Math.abs(Math.sin(t * 5)) : 0, speakB = t > 2.2 && t < 4.2 ? Math.abs(Math.sin(t * 5)) : 0;
      person(g, W * 0.3, ty, 1.25 * S, { color: a.color, hat: a.hat, pose: 'sit', facing: 1, arm: 0.35 + speakA * 0.5, bob: -speakA * 1.5 });
      person(g, W * 0.7, ty, 1.25 * S, { color: b.color, hat: b.hat, pose: 'sit', facing: -1, arm: 0.35 + speakB * 0.5, bob: -speakB * 1.5 });
      // 话语：墨点
      const dots = (x: number, on: number) => { if (on <= 0) return; g.fillStyle = ink(0.8, 0.7); for (let k = 0; k < 3; k++) if ((T * 3 + k) % 3 < 2) { g.beginPath(); g.arc(x + k * 7 * S, H * 0.3, 2.2 * S, 0, Math.PI * 2); g.fill(); } };
      dots(W * 0.36, speakA); dots(W * 0.58, speakB);
      // 茶烟
      for (let k = 0; k < 2; k++) { const ph = (T * 0.4 + k * 0.5) % 1; puff(g, W * (0.46 + k * 0.08), ty - 20 * S - ph * 30 * S, (3 + ph * 7) * S, '180,170,150', 0.35 * (1 - ph), k + 3); }
      const sk = seg(t, 4.2, 5.0);
      if (sk > 0) {
        if (ok) { scroll(g, W / 2, ty - 26 * S, W * 0.2, 22 * S, sk); seal(g, W / 2 + W * 0.05, ty - 26 * S, 7 * S, seg(t, 5.1, 5.4), '盟'); }
        else { g.save(); g.translate(W / 2, ty - 26 * S); g.rotate(sk * 0.6); scroll(g, 0, 0, W * 0.16, 18 * S, 1 - sk * 0.3); g.restore(); if (t > 5.1) splatter(g, W / 2, ty - 20 * S, 22 * S, 0.5, 5); }
      }
      break;
    }
    case 'siege': case 'surrender': {
      const wy = H * 0.7, wh = H * 0.26, gx = W * 0.6;
      const fall = kind === 'siege' ? seg(t, 3.8, 4.4) : seg(t, 2.6, 3.6);
      // 城门：被撞开（陷城）或缓缓打开（献城）
      const gw = 20 * S, gh = wh * 0.65;
      g.fillStyle = ink(0.95, 0.95); g.beginPath(); g.moveTo(gx - gw, wy); g.lineTo(gx - gw, wy - gh); g.arc(gx, wy - gh, gw, Math.PI, 0); g.lineTo(gx + gw, wy); g.closePath(); g.fill();
      const open = fall;
      g.fillStyle = '#6b4a2c';
      g.fillRect(gx - gw, wy - gh, gw * (1 - open * 0.85), gh); g.fillRect(gx + gw - gw * (1 - open * 0.85), wy - gh, gw * (1 - open * 0.85), gh);
      // 城头旗：守方 → 攻方
      const owner = fall >= 1 ? a : b;
      flag(g, gx, wy - wh - 42 * S, 24 * S, owner, T * 3, 1);
      if (kind === 'siege') {
        // 守军在垛口
        for (let k = 0; k < 6; k++) if (fall < 1 || k % 3 === 0) soldier(g, W * 0.24 + k * W * 0.12, wy - wh, 0.7 * S, b.color, -1, 0);
        // 云梯与攀城者
        for (let k = 0; k < 2; k++) {
          const lx = W * (0.3 + k * 0.42);
          g.strokeStyle = ink(0.85); g.lineWidth = 1.6 * S;
          g.beginPath(); g.moveTo(lx - 10 * S, wy + 6); g.lineTo(lx, wy - wh); g.moveTo(lx - 2 * S, wy + 6); g.lineTo(lx + 8 * S, wy - wh); g.stroke();
          for (let j = 0; j < 7; j++) { const yy = wy + 6 - (wh + 6) * j / 7; g.lineWidth = 1; g.beginPath(); g.moveTo(lx - 10 * S + 10 * S * j / 7, yy); g.lineTo(lx - 2 * S + 10 * S * j / 7, yy); g.stroke(); }
          const q = ((T * 0.35 + k * 0.5) % 1);
          soldier(g, lx - 6 * S + 8 * S * q, wy + 4 - (wh + 2) * q, 0.75 * S, a.color, 1, Math.sin(T * 10) * 1.5);
        }
        // 炮：火光、弹道、落点
        const ph = (T % 1.6) / 1.6, cx0 = W * 0.04, cy0 = H * 0.9;
        g.fillStyle = ink(0.95); g.beginPath(); g.ellipse(cx0 + 10 * S, cy0 - 4 * S, 12 * S, 4 * S, -0.3, 0, Math.PI * 2); g.fill();
        if (ph < 0.12) puff(g, cx0 + 22 * S, cy0 - 10 * S, 10 * S, '230,140,60', 0.8, 2);
        if (ph < 0.7) { const p = ph / 0.7, x = cx0 + 22 * S + (W * 0.42 - cx0) * p, y = cy0 - 10 * S + (wy - wh * 0.5 - cy0) * p - Math.sin(p * Math.PI) * H * 0.3; g.fillStyle = ink(1); g.beginPath(); g.arc(x, y, 2.5 * S, 0, Math.PI * 2); g.fill(); }
        else puff(g, W * 0.42, wy - wh * 0.5, (10 + (ph - 0.7) * 40) * S, '110,100,90', 0.6 * (1 - (ph - 0.7) / 0.3), 4);
      } else {
        // 献城：守军列于门外下拜
        for (let k = 0; k < 5; k++) person(g, gx - 60 * S + k * 30 * S, H * 0.92, 0.7 * S, { color: b.color, hat: b.hat === 'crown' ? 'plain' : b.hat, pose: t > 3.6 ? 'bow' : 'stand', facing: -1 });
      }
      // 攻方大队：由左而来，城门开后涌入
      const n = 10;
      for (let k = 0; k < n; k++) {
        const base = W * 0.08 + k * W * 0.045, adv = kind === 'siege' ? Math.min(1, t / 3.8) * W * 0.06 + fall * W * 0.18 : Math.min(1, t / 4) * W * 0.12;
        const x = base + adv, y = H * 0.93 - (k % 2) * 6 * S;
        soldier(g, Math.min(x, gx - 4 * S + (x - gx) * 0.2 * fall), y, 0.85 * S, a.color, 1, Math.sin(T * 9 + k) * 1.5);
      }
      flag(g, W * 0.08 + Math.min(1, t / 4) * W * 0.1, H * 0.93, 36 * S, a, T * 3, 1);
      if (kind === 'siege' && fall > 0 && fall < 1) { puff(g, gx, wy - gh * 0.5, 30 * S * fall, '120,105,80', 0.7, 9); splatter(g, gx, wy - gh * 0.4, 30 * S, 0.6, 3); }
      if (kind === 'siege' && fall >= 1) for (let k = 0; k < 3; k++) { const ph = (T * 0.3 + k / 3) % 1; puff(g, W * (0.3 + k * 0.25), wy - wh - 10 * S - ph * 50 * S, (8 + ph * 18) * S, '80,72,64', 0.5 * (1 - ph), k + 11); }
      break;
    }
    case 'battle': {
      const meet = seg(t, 0, 2.6);
      const clash = t > 2.6;
      for (const side of [-1, 1] as const) {
        const p = side < 0 ? a : b;
        const front = W / 2 + side * (W * 0.42 - meet * W * 0.36);
        for (let k = 0; k < 16; k++) {
          const row = k % 3, col = Math.floor(k / 3);
          const x = front + side * (col * 18 * S + row * 7 * S) + (clash ? Math.sin(T * 12 + k) * 2 * S : 0);
          soldier(g, x, H * 0.97 - row * 10 * S, 1.3 * S, p.color, side < 0 ? 1 : -1, Math.sin(T * 9 + k) * (clash ? 0.5 : 1.5));
        }
        flag(g, front + side * 96 * S, H * 0.92, 56 * S, p, T * 3 + side, side < 0 ? 1 : -1);
      }
      if (clash) { const ph = ((t - 2.6) % 0.9) / 0.9; puff(g, W / 2, H * 0.85, (18 + ph * 26) * S, '130,110,80', 0.5 * (1 - ph), Math.floor(T * 2)); if (ph < 0.3) splatter(g, W / 2 + (r() - 0.5) * 30 * S, H * 0.78, 26 * S, 0.6, Math.floor(T * 3)); }
      break;
    }
    case 'war': {
      // 擂鼓：鼓手两臂交替，冲击波一圈圈
      const cx = W / 2, cy = H * 0.66, R = 30 * S;
      flag(g, W * 0.22, H * 0.92, H * 0.7, a, T * 3, 1);
      flag(g, W * 0.78, H * 0.92, H * 0.7, a, T * 3 + 2, -1);
      for (let k = 0; k < 3; k++) { const ph = ((T * 1.2) + k / 3) % 1; g.strokeStyle = `rgba(178,40,30,${0.5 * (1 - ph)})`; g.lineWidth = 3 * S * (1 - ph); g.beginPath(); g.ellipse(cx, cy, R + ph * W * 0.3, (R + ph * W * 0.3) * 0.35, 0, 0, Math.PI * 2); g.stroke(); }
      g.fillStyle = '#7a4a24'; g.fillRect(cx - R * 0.9, cy, 4 * S, H * 0.3); g.fillRect(cx + R * 0.9 - 4 * S, cy, 4 * S, H * 0.3);
      g.fillStyle = '#9a3a24'; g.beginPath(); g.ellipse(cx, cy, R * 1.05, R * 0.75, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink(0.9); g.lineWidth = 1.5; g.stroke();
      g.fillStyle = 'rgba(240,226,196,0.95)'; g.beginPath(); g.ellipse(cx, cy, R * 0.8, R * 0.55, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      const beat = Math.abs(Math.sin(T * Math.PI * 2.2));
      person(g, cx - R * 1.7, H * 0.98, 1.2 * S, { color: a.color, hat: 'plain', facing: 1, arm: 0.4 + beat * 0.6 });
      person(g, cx + R * 1.7, H * 0.98, 1.2 * S, { color: a.color, hat: 'plain', facing: -1, arm: 0.4 + (1 - beat) * 0.6 });
      if (beat > 0.95) splatter(g, cx, cy, R * 0.8, 0.4, Math.floor(T * 5));
      break;
    }
    case 'court': case 'throne': {
      const cx = W / 2;
      if (kind === 'throne') {
        g.save(); g.translate(cx, H * 0.3); g.rotate(T * 0.15);
        for (let k = 0; k < 12; k++) { g.rotate(Math.PI / 6); g.fillStyle = 'rgba(220,170,60,0.12)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.5, -10 * S); g.lineTo(W * 0.5, 10 * S); g.closePath(); g.fill(); }
        g.restore();
        person(g, cx, H * 0.55, 1.1 * S, { color: '#c9a33c', hat: 'crown', pose: 'sit', facing: 1 });
      }
      // 群臣两列，叩拜起伏
      for (let k = 0; k < 6; k++) for (const side of [-1, 1] as const) {
        const ph = Math.sin(T * 1.6 + k * 0.5);
        person(g, cx + side * (W * 0.12 + k * W * 0.055), H * 0.95, 0.75 * S, { color: k % 2 ? '#8a3a2a' : '#3f5f7a', hat: 'ming', pose: ph > 0.2 ? 'bow' : 'kneel', facing: side < 0 ? 1 : -1 });
      }
      if (kind === 'court') scroll(g, cx, H * 0.28 + seg(t, 0.5, 2) * H * 0.05, W * 0.3, 26 * S, seg(t, 1.5, 3));
      break;
    }
    case 'death': {
      // 一炷烛火、白幡飘、落花
      const cx = W / 2;
      for (const x of [W * 0.25, W * 0.75]) {
        g.strokeStyle = ink(0.9); g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, H); g.lineTo(x, H * 0.1); g.stroke();
        g.fillStyle = 'rgba(248,244,232,0.95)';
        g.beginPath(); g.moveTo(x, H * 0.12);
        for (let k = 0; k <= 10; k++) g.lineTo(x + 18 * S + Math.sin(T * 2 + k * 0.6) * 4 * S, H * 0.12 + k * H * 0.06);
        g.lineTo(x, H * 0.72); g.closePath(); g.fill(); g.strokeStyle = ink(0.7, 0.6); g.lineWidth = 0.8; g.stroke();
      }
      g.fillStyle = '#e8e0d0'; g.fillRect(cx - 5 * S, H * 0.55, 10 * S, H * 0.3); g.strokeStyle = ink(0.8); g.strokeRect(cx - 5 * S, H * 0.55, 10 * S, H * 0.3);
      const fl = 1 + Math.sin(T * 13) * 0.12 + Math.sin(T * 7) * 0.08;
      const gl = g.createRadialGradient(cx, H * 0.5, 0, cx, H * 0.5, 40 * S); gl.addColorStop(0, 'rgba(255,200,110,0.4)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.fillRect(cx - 40 * S, H * 0.5 - 40 * S, 80 * S, 80 * S);
      g.fillStyle = 'rgba(240,150,50,0.95)'; g.beginPath(); g.ellipse(cx, H * 0.5, 3.5 * S, 9 * S * fl, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,240,190,0.95)'; g.beginPath(); g.ellipse(cx, H * 0.52, 1.6 * S, 4 * S * fl, 0, 0, Math.PI * 2); g.fill();
      for (let k = 0; k < 14; k++) { const ph = (T * 0.12 + k / 14) % 1; const x = ((k * 97) % 100) / 100 * W + Math.sin(T + k) * 12; g.fillStyle = 'rgba(250,248,240,0.85)'; g.beginPath(); g.ellipse(x, ph * H, 2.4 * S, 1.4 * S, T + k, 0, Math.PI * 2); g.fill(); }
      break;
    }
    case 'disaster': {
      // 枯地、流民蹒跚、乌鸦
      for (let k = 0; k < 5; k++) { const x = ((T * 10 * S + k * W * 0.18) % (W * 1.1)) - W * 0.05; person(g, x, H * 0.92 - (k % 2) * 6 * S, 0.8 * S, { color: '#8a8070', hat: 'plain', pose: 'bow', facing: 1, bob: Math.abs(Math.sin(T * 3 + k)) * -1.5 }); }
      for (let k = 0; k < 4; k++) { const x = (W * 0.2 + k * 60 * S + T * 25 * S) % W, y = H * 0.2 + Math.sin(T * 2 + k) * 8 * S; g.strokeStyle = ink(0.95); g.lineWidth = 1.6 * S; const f = Math.sin(T * 8 + k) * 4 * S; g.beginPath(); g.moveTo(x - 7 * S, y - f); g.quadraticCurveTo(x - 2 * S, y - 2 * S, x, y); g.quadraticCurveTo(x + 2 * S, y - 2 * S, x + 7 * S, y - f); g.stroke(); }
      const ph = (T * 0.25) % 1; puff(g, W * ph, H * 0.85, 26 * S, '160,140,100', 0.25, 6);
      break;
    }
    case 'march': {
      for (let k = 0; k < 16; k++) { const x = ((T * 22 * S + k * 26 * S) % (W + 60 * S)) - 30 * S; soldier(g, x, H * 0.93 - (k % 2) * 7 * S, 0.95 * S, a.color, 1, Math.sin(T * 9 + k) * 2); if (k % 6 === 0) flag(g, x - 6 * S, H * 0.93 - (k % 2) * 7 * S, 40 * S, a, T * 3 + k, 1); }
      for (let k = 0; k < 3; k++) { const ph = (T * 0.5 + k / 3) % 1; puff(g, W * ph, H * 0.95, 14 * S, '150,130,95', 0.22, k + 20); }
      break;
    }
    case 'econ': {
      // 粮袋堆起、银锭落下闪光
      for (let k = 0; k < 7; k++) { const x = W * 0.2 + k * W * 0.09, h0 = H * 0.92; g.fillStyle = 'rgba(214,190,140,0.98)'; g.beginPath(); g.ellipse(x, h0 - 8 * S, 12 * S, 9 * S, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink(0.8, 0.8); g.lineWidth = 1; g.stroke(); }
      for (let k = 0; k < 5; k++) { const ph = (T * 0.6 + k / 5) % 1; const x = W * (0.25 + k * 0.12), y = H * 0.2 + ph * H * 0.6; g.fillStyle = '#d8d8d0'; g.beginPath(); g.ellipse(x, y, 7 * S, 3.5 * S, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = ink(0.8); g.lineWidth = 1; g.stroke(); if (ph > 0.9) { g.strokeStyle = 'rgba(255,240,180,0.9)'; for (let j = 0; j < 4; j++) { const an = j * Math.PI / 2; g.beginPath(); g.moveTo(x + Math.cos(an) * 6 * S, y + Math.sin(an) * 6 * S); g.lineTo(x + Math.cos(an) * 12 * S, y + Math.sin(an) * 12 * S); g.stroke(); } } }
      person(g, W * 0.12, H * 0.98, 1.1 * S, { color: '#5a6a4a', hat: 'ming', facing: 1, arm: 0.3 + Math.abs(Math.sin(T * 2)) * 0.4 });
      break;
    }
    case 'appoint': {
      // 授印：主官立于左，受命者跪右，官印递出、钤下
      const ty = H * 0.82;
      person(g, W * 0.38, ty, 1.25 * S, { color: a.color, hat: a.hat, facing: 1, arm: 0.2 + seg(t, 0.6, 1.8) * 0.6 });
      person(g, W * 0.62, ty, 1.25 * S, { color: b.color, hat: 'ming', pose: t > 2 ? 'bow' : 'kneel', facing: -1, arm: seg(t, 1.6, 2.4) * 0.6 });
      const k = seg(t, 1.2, 2.6), x = W * 0.42 + k * W * 0.1, y = H * 0.4 + Math.sin(k * Math.PI) * -H * 0.06;
      g.fillStyle = '#c9a33c'; g.fillRect(x - 7 * S, y - 7 * S, 14 * S, 12 * S); g.strokeStyle = ink(0.85); g.lineWidth = 1; g.strokeRect(x - 7 * S, y - 7 * S, 14 * S, 12 * S);
      seal(g, W * 0.5, H * 0.24, 9 * S, seg(t, 3.2, 3.6), '敕');
      break;
    }
    case 'prison': {
      // 囚：人物坐于草席，镣铐；狱卒踱步；栅栏在前
      person(g, W * 0.45, H * 0.9, 1.3 * S, { color: a.color, hat: a.hat, pose: 'sit', facing: 1, bob: Math.sin(T * 0.8) * 1.2 });
      g.strokeStyle = ink(0.6, 0.8); g.lineWidth = 1.2 * S; g.setLineDash([3 * S, 2 * S]); g.beginPath(); g.moveTo(W * 0.47, H * 0.78); g.quadraticCurveTo(W * 0.52, H * 0.9, W * 0.6, H * 0.86); g.stroke(); g.setLineDash([]);
      const gx = W * 0.15 + (Math.sin(T * 0.6) * 0.5 + 0.5) * W * 0.2;
      person(g, gx, H * 0.95, 1.05 * S, { color: b.color, hat: b.hat, facing: Math.cos(T * 0.6) > 0 ? 1 : -1, bob: Math.abs(Math.sin(T * 4)) * -1.2 });
      g.strokeStyle = ink(0.95, 0.9); g.lineWidth = 4 * S;
      for (let k = 0; k < 9; k++) { const x = W * 0.3 + k * W * 0.07; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
      g.lineWidth = 5 * S; g.beginPath(); g.moveTo(W * 0.28, H * 0.12); g.lineTo(W * 0.9, H * 0.12); g.moveTo(W * 0.28, H * 0.9); g.lineTo(W * 0.9, H * 0.9); g.stroke();
      break;
    }
    case 'study': {
      // 书斋：灯下伏案，提笔写字，纸上墨迹渐多，烛光摇曳
      const dx = W * 0.5, dy = H * 0.8;
      g.fillStyle = '#6a4a2c'; g.fillRect(dx - W * 0.12, dy - 18 * S, W * 0.24, 6 * S); g.fillRect(dx - W * 0.1, dy - 12 * S, 4 * S, 12 * S); g.fillRect(dx + W * 0.1 - 4 * S, dy - 12 * S, 4 * S, 12 * S);
      const wk = (T % 6) / 6;
      g.fillStyle = 'rgba(246,238,216,0.98)'; g.fillRect(dx - W * 0.04, dy - 22 * S, W * 0.12, 5 * S);
      g.strokeStyle = ink(0.9, 0.85); g.lineWidth = 1;
      for (let k = 0; k < Math.floor(wk * 8); k++) { const x = dx + W * 0.07 - k * W * 0.012; g.beginPath(); g.moveTo(x, dy - 21.5 * S); g.lineTo(x, dy - 18 * S); g.stroke(); }
      const pen = Math.sin(T * 6) * 0.15;
      person(g, dx - W * 0.1, dy, 1.25 * S, { color: a.color, hat: a.hat, pose: 'sit', facing: 1, arm: 0.25 + pen, bob: Math.sin(T * 0.9) * 0.8 });
      const cx = dx + W * 0.1, fl = 1 + Math.sin(T * 11) * 0.12;
      g.fillStyle = '#e8e0d0'; g.fillRect(cx - 2 * S, dy - 30 * S, 4 * S, 12 * S);
      const gl = g.createRadialGradient(cx, dy - 34 * S, 0, cx, dy - 34 * S, 34 * S); gl.addColorStop(0, 'rgba(255,200,110,0.35)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.fillRect(cx - 34 * S, dy - 68 * S, 68 * S, 68 * S);
      g.fillStyle = 'rgba(240,150,50,0.95)'; g.beginPath(); g.ellipse(cx, dy - 34 * S, 2.2 * S, 5 * S * fl, 0, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'recruit': {
      // 应募者排队上前，旗下点名
      flag(g, W * 0.82, H * 0.93, 50 * S, a, T * 3, -1);
      g.fillStyle = '#6a4a2c'; g.fillRect(W * 0.66, H * 0.8, W * 0.12, 5 * S);
      person(g, W * 0.74, H * 0.95, 1.1 * S, { color: a.color, hat: a.hat, pose: 'sit', facing: -1, arm: 0.3 + Math.abs(Math.sin(T * 2)) * 0.3 });
      for (let k = 0; k < 8; k++) { const x = ((T * 16 * S + k * 36 * S) % (W * 0.62)); person(g, x, H * 0.95, 0.85 * S, { color: '#9a8c70', hat: 'plain', facing: 1, bob: Math.abs(Math.sin(T * 6 + k)) * -1.5 }); }
      break;
    }
  }
}
