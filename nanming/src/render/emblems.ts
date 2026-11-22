/* 地图城池标志：每类城池一幅小插画（斜俯视），预先绘入缓存画布；旗帜逐帧绘制以便飘动。
 * 坐标约定：100×100 的设计框，底部中点 (50, 92) 为落地点。 */

export type EmblemType = 'capital' | 'major' | 'city' | 'region' | 'port' | 'ferry' | 'pass';
const SCALE = 3;
const cache: Partial<Record<EmblemType, HTMLCanvasElement>> = {};

export function emblem(type: EmblemType): HTMLCanvasElement {
  if (cache[type]) return cache[type]!;
  const c = document.createElement('canvas');
  c.width = 100 * SCALE; c.height = 100 * SCALE;
  const g = c.getContext('2d')!;
  g.scale(SCALE, SCALE);
  switch (type) {
    case 'capital': walledCity(g, { w: 78, d: 30, wallH: 9, hall: 'palace', towers: true, double: true }); break;
    case 'region': walledCity(g, { w: 72, d: 28, wallH: 8, hall: 'hall', towers: true, double: false, fields: true }); break;
    case 'major': walledCity(g, { w: 66, d: 26, wallH: 8, hall: 'hall', towers: true, double: false }); break;
    case 'city': walledCity(g, { w: 54, d: 22, wallH: 7, hall: 'none', towers: false, double: false }); break;
    case 'port': port(g); break;
    case 'ferry': ferry(g); break;
    case 'pass': pass(g); break;
  }
  cache[type] = c;
  return c;
}

/** 旗杆顶点（设计框坐标），用于逐帧画旗 */
export function flagAnchor(type: EmblemType): [number, number] {
  switch (type) {
    case 'capital': return [50, 18];
    case 'region': case 'major': return [50, 24];
    case 'city': return [50, 34];
    case 'port': return [36, 36];
    case 'ferry': return [60, 40];
    case 'pass': return [50, 30];
  }
}

/* ---------- 部件 ---------- */
const STONE_TOP = '#ece0c2', STONE_FRONT = '#c2b190', STONE_SIDE = '#9c8a6a', STONE_DARK = '#5f5039';
const ROOF = '#3a3f44', ROOF_HI = '#5a6168', WALL_W = '#efe8d8', PILLAR = '#a3311f';

function shadow(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
  const gr = g.createRadialGradient(cx, cy, 2, cx, cy, rx);
  gr.addColorStop(0, 'rgba(0,0,0,0.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

function roof(g: CanvasRenderingContext2D, cx: number, y: number, w: number, h: number, curl = 3, color = ROOF) {
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx - w / 2 - curl, y - 1); g.quadraticCurveTo(cx - w / 2, y, cx - w / 2 + curl, y - 2);
  g.lineTo(cx - w * 0.28, y - h); g.lineTo(cx + w * 0.28, y - h);
  g.lineTo(cx + w / 2 - curl, y - 2); g.quadraticCurveTo(cx + w / 2, y, cx + w / 2 + curl, y - 1);
  g.lineTo(cx + w / 2 - 2, y + 1); g.lineTo(cx - w / 2 + 2, y + 1); g.closePath(); g.fill();
  g.strokeStyle = ROOF_HI; g.lineWidth = 0.5;
  for (let k = -w / 2 + 3; k < w / 2 - 2; k += 2.2) { g.beginPath(); g.moveTo(cx + k * 0.56, y - h + 0.6); g.lineTo(cx + k, y - 0.4); g.stroke(); }
  g.fillStyle = '#23272a'; g.fillRect(cx - w * 0.29, y - h - 1, w * 0.58, 1.4);
}

function house(g: CanvasRenderingContext2D, cx: number, y: number, w: number) {
  g.fillStyle = WALL_W; g.fillRect(cx - w / 2, y - w * 0.32, w, w * 0.32);
  g.fillStyle = '#6a5038'; g.fillRect(cx - 1, y - w * 0.22, 2, w * 0.22);
  roof(g, cx, y - w * 0.3, w + 2, w * 0.28, 1.4);
}

function gateTower(g: CanvasRenderingContext2D, cx: number, y: number, s: number, tiers = 2) {
  g.fillStyle = STONE_FRONT; g.fillRect(cx - 9 * s, y - 4 * s, 18 * s, 4 * s);
  g.fillStyle = '#2a1d12'; g.beginPath(); g.moveTo(cx - 3 * s, y); g.lineTo(cx - 3 * s, y - 3 * s); g.quadraticCurveTo(cx, y - 5.5 * s, cx + 3 * s, y - 3 * s); g.lineTo(cx + 3 * s, y); g.fill();
  g.fillStyle = PILLAR;
  for (const px of [-7, -2.5, 2, 6]) g.fillRect(cx + px * s, y - 10 * s, 1.3 * s, 6 * s);
  g.fillStyle = '#e7dcc4'; g.fillRect(cx - 7 * s, y - 9 * s, 14 * s, 1 * s);
  roof(g, cx, y - 10 * s, 22 * s, 4.5 * s, 2.5 * s);
  if (tiers > 1) {
    g.fillStyle = PILLAR; for (const px of [-4.5, 0, 4]) g.fillRect(cx + px * s, y - 18 * s, 1.1 * s, 4 * s);
    roof(g, cx, y - 18 * s, 16 * s, 4 * s, 2 * s);
  }
}

function cornerTower(g: CanvasRenderingContext2D, cx: number, y: number, s: number) {
  g.fillStyle = STONE_FRONT; g.fillRect(cx - 4 * s, y - 5 * s, 8 * s, 5 * s);
  g.fillStyle = STONE_DARK; g.fillRect(cx - 4 * s, y - 5 * s, 1 * s, 5 * s);
  g.fillStyle = WALL_W; g.fillRect(cx - 3 * s, y - 9 * s, 6 * s, 4 * s);
  roof(g, cx, y - 9 * s, 10 * s, 3.5 * s, 1.6 * s);
}

interface CityOpt { w: number; d: number; wallH: number; hall: 'palace' | 'hall' | 'none'; towers: boolean; double: boolean; fields?: boolean }
function walledCity(g: CanvasRenderingContext2D, o: CityOpt) {
  const cx = 50, by = 88;
  const fx0 = cx - o.w / 2, fx1 = cx + o.w / 2; // 前墙
  const bx0 = cx - o.w / 2 + 7, bx1 = cx + o.w / 2 - 7; // 后墙（透视收窄）
  const fy = by - o.wallH, byy = fy - o.d; // 前墙顶、后墙顶
  shadow(g, cx, by + 1, o.w * 0.62, 9);
  if (o.fields) {
    g.fillStyle = 'rgba(150,175,95,0.75)';
    for (const [x, y, w] of [[8, 84, 18], [74, 82, 20], [16, 74, 12], [80, 72, 12]] as const) { g.beginPath(); g.ellipse(x + w / 2, y, w / 2, 4, 0, 0, Math.PI * 2); g.fill(); }
  }
  if (o.double) {
    // 外郭：低矮土墙
    g.fillStyle = '#b8a888';
    g.beginPath(); g.moveTo(fx0 - 8, by + 3); g.lineTo(fx1 + 8, by + 3); g.lineTo(bx1 + 6, byy - 4); g.lineTo(bx0 - 6, byy - 4); g.closePath(); g.fill();
    g.fillStyle = '#9b8c6e'; g.fillRect(fx0 - 8, by + 1, o.w + 16, 3);
  }
  // 城内地面
  g.fillStyle = '#d8c99f';
  g.beginPath(); g.moveTo(fx0, fy); g.lineTo(fx1, fy); g.lineTo(bx1, byy); g.lineTo(bx0, byy); g.closePath(); g.fill();
  // 后墙与侧墙（顶面）
  g.fillStyle = STONE_TOP;
  g.beginPath(); g.moveTo(bx0 - 2, byy - 2); g.lineTo(bx1 + 2, byy - 2); g.lineTo(bx1 + 2, byy + 2); g.lineTo(bx0 - 2, byy + 2); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(fx0, fy); g.lineTo(bx0, byy); g.lineTo(bx0 + 3, byy); g.lineTo(fx0 + 4, fy); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(fx1, fy); g.lineTo(bx1, byy); g.lineTo(bx1 - 3, byy); g.lineTo(fx1 - 4, fy); g.closePath(); g.fill();
  g.fillStyle = STONE_SIDE;
  g.beginPath(); g.moveTo(fx0, fy); g.lineTo(bx0 - 2, byy); g.lineTo(bx0 - 2, byy + 4); g.lineTo(fx0, by); g.closePath(); g.fill();
  // 城内屋舍（自后而前）
  const rows = Math.max(2, Math.round(o.d / 9));
  for (let r = 0; r < rows; r++) {
    const t = (r + 0.5) / rows, y = byy + 2 + t * (o.d - 2);
    const x0 = bx0 + (fx0 - bx0) * t + 6, x1 = bx1 + (fx1 - bx1) * t - 6;
    const n = Math.max(2, Math.floor((x1 - x0) / 9));
    for (let k = 0; k < n; k++) {
      const x = x0 + (k + 0.5) * (x1 - x0) / n;
      if (o.hall !== 'none' && r === Math.floor(rows / 2) && Math.abs(x - cx) < 10) continue;
      house(g, x + ((r + k) % 2) * 1.5, y + 4, 6 + ((r * 3 + k) % 3));
    }
    if (o.hall !== 'none' && r === Math.floor(rows / 2)) {
      const s = o.hall === 'palace' ? 1.25 : 1;
      g.fillStyle = '#b8ae94'; g.fillRect(cx - 10 * s, y + 3, 20 * s, 3 * s);
      g.fillStyle = PILLAR; for (const px of [-7, -3, 1, 5]) g.fillRect(cx + px * s, y - 3 * s, 1.3 * s, 6 * s);
      const tile = o.hall === 'palace' ? '#d4a02c' : '#2f5f56';
      roof(g, cx, y - 3 * s, 24 * s, 5 * s, 3 * s, tile);
      if (o.hall === 'palace') { g.fillStyle = PILLAR; for (const px of [-4, 0, 3.5]) g.fillRect(cx + px * s, y - 10 * s, 1.1 * s, 4 * s); roof(g, cx, y - 10 * s, 17 * s, 4 * s, 2.2 * s, tile); }
    }
  }
  // 前墙：正面
  const fg = g.createLinearGradient(0, fy, 0, by);
  fg.addColorStop(0, STONE_FRONT); fg.addColorStop(1, '#8a806b');
  g.fillStyle = fg; g.fillRect(fx0, fy, o.w, o.wallH);
  g.strokeStyle = 'rgba(60,52,40,0.35)'; g.lineWidth = 0.4;
  for (let yy = fy + 2; yy < by; yy += 2) { g.beginPath(); g.moveTo(fx0, yy); g.lineTo(fx1, yy); g.stroke(); }
  for (let yy = fy, r = 0; yy < by; yy += 2, r++) for (let xx = fx0 + (r % 2) * 2; xx < fx1; xx += 4) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, yy + 2); g.stroke(); }
  g.fillStyle = STONE_TOP; g.fillRect(fx0, fy - 1.5, o.w, 1.8);
  // 垛口
  g.fillStyle = STONE_FRONT;
  for (let xx = fx0; xx < fx1 - 1; xx += 3.2) g.fillRect(xx, fy - 3.5, 1.9, 2.2);
  g.strokeStyle = STONE_DARK; g.lineWidth = 0.8; g.strokeRect(fx0, fy - 1.5, o.w, o.wallH + 1.5);
  if (o.towers) { cornerTower(g, fx0 + 1, fy + 1, 1); cornerTower(g, fx1 - 1, fy + 1, 1); }
  gateTower(g, cx, by, o.hall === 'palace' ? 1.2 : o.w > 60 ? 1 : 0.85, o.w > 60 ? 2 : 1);
}

function water(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
  const gr = g.createLinearGradient(0, y - ry, 0, y + ry);
  gr.addColorStop(0, '#7fb0bf'); gr.addColorStop(1, '#4f8596');
  g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(235,248,250,0.6)'; g.lineWidth = 0.7;
  for (let k = 0; k < 5; k++) { g.beginPath(); g.moveTo(x - rx * 0.6 + k * 8, y - ry * 0.3 + (k % 2) * 4); g.lineTo(x - rx * 0.6 + k * 8 + 5, y - ry * 0.3 + (k % 2) * 4); g.stroke(); }
}

function junk(g: CanvasRenderingContext2D, x: number, y: number, s: number) {
  g.fillStyle = '#5a3b22';
  g.beginPath(); g.moveTo(x - 10 * s, y - 3 * s); g.lineTo(x + 11 * s, y - 4 * s); g.lineTo(x + 8 * s, y + 1 * s); g.lineTo(x - 8 * s, y + 1 * s); g.closePath(); g.fill();
  g.fillStyle = '#7a5530'; g.fillRect(x - 9 * s, y - 4 * s, 19 * s, 1.2 * s);
  g.strokeStyle = '#3a2716'; g.lineWidth = 0.8 * s; g.beginPath(); g.moveTo(x, y - 3 * s); g.lineTo(x, y - 20 * s); g.stroke();
  g.fillStyle = '#c79a5a';
  g.beginPath(); g.moveTo(x + 0.5 * s, y - 19 * s); g.lineTo(x + 9 * s, y - 17 * s); g.lineTo(x + 8 * s, y - 6 * s); g.lineTo(x + 0.5 * s, y - 6 * s); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(90,60,30,0.6)'; g.lineWidth = 0.5 * s;
  for (let k = 1; k < 5; k++) { g.beginPath(); g.moveTo(x + 0.5 * s, y - 6 * s - k * 2.6 * s); g.lineTo(x + 8.5 * s, y - 6 * s - k * 2.6 * s + 0.4 * s); g.stroke(); }
}

function port(g: CanvasRenderingContext2D) {
  shadow(g, 50, 89, 40, 8);
  water(g, 66, 84, 30, 9);
  // 栈桥
  g.fillStyle = '#7a5530'; g.fillRect(50, 79, 26, 3);
  g.fillStyle = '#5a3b22'; for (let k = 0; k < 5; k++) g.fillRect(52 + k * 5, 81, 1.2, 4);
  junk(g, 78, 82, 1);
  // 小城
  g.save(); g.translate(-14, 2); g.scale(0.82, 0.82); g.translate(10, 18);
  walledCity(g, { w: 48, d: 18, wallH: 6, hall: 'none', towers: false, double: false });
  g.restore();
}

function ferry(g: CanvasRenderingContext2D) {
  shadow(g, 50, 89, 36, 7);
  water(g, 50, 82, 38, 10);
  g.fillStyle = '#7a5530'; g.fillRect(22, 74, 22, 3);
  g.fillStyle = '#5a3b22'; for (let k = 0; k < 4; k++) g.fillRect(24 + k * 6, 76, 1.2, 5);
  // 渡亭
  g.fillStyle = PILLAR; g.fillRect(24, 64, 1.4, 10); g.fillRect(34, 64, 1.4, 10);
  roof(g, 29.7, 64, 18, 5, 2.5);
  junk(g, 62, 84, 0.85);
}

function pass(g: CanvasRenderingContext2D) {
  shadow(g, 50, 89, 42, 8);
  const peak = (x: number, w: number, h: number, c1: string, c2: string) => {
    const gr = g.createLinearGradient(0, 88 - h, 0, 88);
    gr.addColorStop(0, c1); gr.addColorStop(1, c2);
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x - w / 2, 88); g.quadraticCurveTo(x - w * 0.15, 88 - h * 0.7, x, 88 - h); g.quadraticCurveTo(x + w * 0.2, 88 - h * 0.6, x + w / 2, 88); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(30,40,30,0.5)'; g.lineWidth = 0.8; g.stroke();
    g.strokeStyle = 'rgba(30,40,30,0.3)'; g.beginPath(); g.moveTo(x, 88 - h); g.quadraticCurveTo(x - 4, 88 - h * 0.5, x - 2, 88); g.stroke();
  };
  peak(20, 38, 46, '#6b8a74', '#8fa07a');
  peak(80, 40, 52, '#5f8070', '#8b9c76');
  // 关墙
  g.fillStyle = STONE_FRONT; g.fillRect(28, 76, 44, 12);
  g.strokeStyle = 'rgba(60,52,40,0.35)'; g.lineWidth = 0.4;
  for (let yy = 78; yy < 88; yy += 2) { g.beginPath(); g.moveTo(28, yy); g.lineTo(72, yy); g.stroke(); }
  g.fillStyle = STONE_TOP; g.fillRect(28, 74.5, 44, 1.8);
  g.fillStyle = STONE_FRONT; for (let xx = 28; xx < 71; xx += 3.2) g.fillRect(xx, 72.5, 1.9, 2.2);
  gateTower(g, 50, 88, 1.05, 2);
}

/** 逐帧绘制飘动的旗帜（在已平移、缩放到设计框的上下文里） */
export function drawWavingFlag(g: CanvasRenderingContext2D, px: number, py: number, color: string, mark: string, t: number, shape: string, s = 1) {
  g.save();
  g.translate(px, py);
  g.scale(s, s);
  g.strokeStyle = '#2a1d12'; g.lineWidth = 1.4;
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -22); g.stroke();
  g.fillStyle = '#d6b05a'; g.beginPath(); g.arc(0, -22.5, 1.3, 0, Math.PI * 2); g.fill();
  const w = 17, h = 11;
  const wave = (k: number) => Math.sin(t * 4 + k * 1.3) * 1.5 * (k / 6);
  g.beginPath();
  g.moveTo(0, -21);
  for (let k = 0; k <= 6; k++) g.lineTo((k / 6) * w, -21 + wave(k));
  if (shape === 'swallow') g.lineTo(w * 0.7, -21 + h / 2 + wave(4));
  else if (shape === 'tri') { g.lineTo(0, -21 + h); g.closePath(); }
  if (shape !== 'tri') { for (let k = 6; k >= 0; k--) g.lineTo((k / 6) * w, -21 + h + wave(k)); g.closePath(); }
  g.fillStyle = color; g.fill();
  g.strokeStyle = shape === 'banner' ? '#d6b05a' : 'rgba(30,20,10,0.8)'; g.lineWidth = shape === 'banner' ? 1.4 : 0.8; g.stroke();
  if (mark) {
    g.fillStyle = '#fff6e0'; g.font = '900 8px "Noto Serif SC", serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(mark, (shape === 'tri' ? 0.36 : 0.45) * w, -21 + h / 2 + wave(3));
  }
  g.restore();
}
