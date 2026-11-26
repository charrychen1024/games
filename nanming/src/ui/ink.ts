/* 水墨战场的共用画法：绢纸底、层层远山（皴擦与云雾）、松柳枯树、村舍、苔点、墨团烟尘。
 * 只管“怎么画”，不管画在哪里：战场画面（rtView 派生的各画面）给出屏幕坐标与比例。全部按种子画，同一场仗每次相同。 */

export type Rnd = () => number;
export function mkRnd(seed: number): Rnd {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/** 墨色：k 为浓淡（0 极淡 ~ 1 焦墨） */
export const ink = (k: number, a = 1) => `rgba(${Math.round(58 - k * 34)},${Math.round(52 - k * 30)},${Math.round(46 - k * 26)},${a})`;
/** 绢纸底色 */
export const PAPER = '#e8dcc0';

let fiber: HTMLCanvasElement | null = null;
/** 纸纹：细纤维与斑点，平铺用 */
function fiberTile(): HTMLCanvasElement {
  if (fiber) return fiber;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const r = mkRnd(1644);
  for (let k = 0; k < 900; k++) {
    g.fillStyle = r() < 0.5 ? `rgba(120,96,60,${0.04 + r() * 0.05})` : `rgba(255,250,235,${0.05 + r() * 0.06})`;
    g.fillRect(r() * 256, r() * 256, 1 + r() * 1.5, 1 + r() * 1.5);
  }
  g.lineWidth = 0.6;
  for (let k = 0; k < 140; k++) {
    const x = r() * 256, y = r() * 256, a = r() * Math.PI, l = 6 + r() * 22;
    g.strokeStyle = `rgba(110,88,55,${0.05 + r() * 0.06})`;
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + (r() - 0.5) * 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  fiber = c;
  return c;
}

/** 整幅绢纸：底色、纸纹、四周做旧 */
export function paper(g: CanvasRenderingContext2D, W: number, H: number, tone = PAPER) {
  g.fillStyle = tone; g.fillRect(0, 0, W, H);
  const pat = g.createPattern(fiberTile(), 'repeat');
  if (pat) { g.fillStyle = pat; g.fillRect(0, 0, W, H); }
}
export function agedEdges(g: CanvasRenderingContext2D, W: number, H: number, a = 0.32) {
  const vg = g.createRadialGradient(W / 2, H * 0.55, Math.min(W, H) * 0.35, W / 2, H * 0.55, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(90,64,30,0)'); vg.addColorStop(1, `rgba(90,64,30,${a})`);
  g.fillStyle = vg; g.fillRect(0, 0, W, H);
}

/** 一团淡墨晕染（不规则的软边斑块） */
export function wash(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, color: string, alpha: number, r: Rnd) {
  for (let k = 0; k < 4; k++) {
    const ox = (r() - 0.5) * rx * 0.6, oy = (r() - 0.5) * ry * 0.5, sx = rx * (0.55 + r() * 0.5), sy = ry * (0.55 + r() * 0.5);
    const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, Math.max(sx, sy));
    gr.addColorStop(0, color.replace('A', String(alpha))); gr.addColorStop(1, color.replace('A', '0'));
    g.save(); g.translate(x + ox, y + oy); g.scale(1, sy / Math.max(sx, sy)); g.translate(-(x + ox), -(y + oy));
    g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, Math.max(sx, sy), 0, Math.PI * 2); g.fill(); g.restore();
  }
}

/** 一道山脊轮廓：起伏的峰峦，返回采样点 */
function ridge(W: number, base: number, amp: number, r: Rnd, step = 14): [number, number][] {
  const pts: [number, number][] = [];
  const peaks = 3 + Math.floor(r() * 4);
  const ph = Array.from({ length: peaks }, () => ({ x: r() * W, w: W * (0.08 + r() * 0.16), h: amp * (0.45 + r() * 0.55) }));
  for (let x = -20; x <= W + 20; x += step) {
    let y = 0;
    for (const p of ph) { const d = (x - p.x) / p.w; y = Math.max(y, p.h * Math.exp(-d * d) * (1 + 0.12 * Math.sin(x / 9 + p.x))); }
    y += amp * 0.12 * (Math.sin(x / 37 + base) + 1);
    pts.push([x, base - y]);
  }
  return pts;
}

/** 层层远山：远淡近浓，山脚没入云雾；近层加皴擦笔触与苔点 */
export function mountains(g: CanvasRenderingContext2D, W: number, base: number, amp: number, r: Rnd, o: { layers?: number; dark?: number; mist?: string } = {}) {
  const layers = o.layers ?? 3, dark = o.dark ?? 0.55;
  for (let L = 0; L < layers; L++) {
    const t = (L + 1) / layers;                    // 0 远 → 1 近
    const k = dark * (0.25 + t * 0.75);
    const pts = ridge(W, base + L * amp * 0.08, amp * (1.1 - t * 0.45), r);
    const top = Math.min(...pts.map(p => p[1]));
    const gr = g.createLinearGradient(0, top, 0, base + amp * 0.2);
    gr.addColorStop(0, ink(k, 0.55 + t * 0.3)); gr.addColorStop(0.55, ink(k * 0.7, 0.28 + t * 0.2)); gr.addColorStop(1, ink(k * 0.5, 0));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(pts[0][0], base + amp * 0.3);
    for (const [x, y] of pts) g.lineTo(x, y);
    g.lineTo(W + 20, base + amp * 0.3); g.closePath(); g.fill();
    // 山脊一笔焦墨，断续
    g.strokeStyle = ink(Math.min(1, k + 0.25), 0.35 + t * 0.35); g.lineWidth = 0.8 + t * 1.2; g.lineCap = 'round';
    g.beginPath();
    pts.forEach(([x, y], i) => { if (i % 9 === 8) { g.stroke(); g.beginPath(); g.moveTo(x, y); } else if (i) g.lineTo(x, y); else g.moveTo(x, y); });
    g.stroke();
    // 皴擦：顺坡短笔
    if (t > 0.5) {
      g.lineWidth = 0.7;
      for (let n = 0; n < W / 9; n++) {
        const i = Math.floor(r() * pts.length), [x, y] = pts[i];
        const d = (base - y) * (0.15 + r() * 0.6);
        g.strokeStyle = ink(k + 0.1, 0.12 + r() * 0.14);
        g.beginPath(); g.moveTo(x, y + d * 0.1); g.lineTo(x + (r() - 0.5) * 6, y + d); g.stroke();
      }
      // 苔点
      for (let n = 0; n < W / 26; n++) {
        const i = Math.floor(r() * pts.length), [x, y] = pts[i];
        g.fillStyle = ink(0.9, 0.35 + r() * 0.3);
        g.beginPath(); g.ellipse(x + (r() - 0.5) * 4, y + 1 + r() * 3, 1 + r() * 1.4, 0.8 + r(), 0, 0, Math.PI * 2); g.fill();
      }
    }
    // 山脚云雾
    const mg = g.createLinearGradient(0, base - amp * 0.15, 0, base + amp * 0.25);
    const mist = o.mist ?? '232,220,192';
    mg.addColorStop(0, `rgba(${mist},0)`); mg.addColorStop(0.6, `rgba(${mist},${0.55 + t * 0.2})`); mg.addColorStop(1, `rgba(${mist},0)`);
    g.fillStyle = mg; g.fillRect(0, base - amp * 0.15 + L * amp * 0.08, W, amp * 0.4);
  }
}

/** 一株树：pine 松（横出针叶团）、willow 柳（垂丝）、bare 枯树（鹿角枝）、grove 杂树（墨点叶） */
export function tree(g: CanvasRenderingContext2D, x: number, y: number, s: number, kind: 'pine' | 'willow' | 'bare' | 'grove', r: Rnd, a = 1) {
  const h = 60 * s;
  g.save(); g.globalAlpha *= a; g.lineCap = 'round'; g.lineJoin = 'round';
  // 干：两笔，下粗上细，微曲
  const lean = (r() - 0.5) * h * 0.25;
  g.strokeStyle = ink(0.85, 0.9); g.lineWidth = Math.max(1, 4.5 * s);
  g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.2, y - h * 0.5, x + lean, y - h); g.stroke();
  g.lineWidth = Math.max(0.6, 1.6 * s); g.strokeStyle = ink(0.5, 0.5);
  g.beginPath(); g.moveTo(x + 2 * s, y); g.quadraticCurveTo(x + lean * 0.2 + 2 * s, y - h * 0.5, x + lean + 1 * s, y - h * 0.95); g.stroke();
  const at = (t: number): [number, number] => [x + lean * t * t, y - h * t];
  if (kind === 'pine') {
    for (let k = 0; k < 5; k++) {
      const t = 0.45 + k * 0.13, [bx, by] = at(t), dir = k % 2 ? 1 : -1, len = h * (0.42 - k * 0.05);
      g.strokeStyle = ink(0.8, 0.85); g.lineWidth = Math.max(0.6, 1.8 * s);
      g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + dir * len, by - len * 0.12); g.stroke();
      // 针叶团：扁平墨块
      g.fillStyle = ink(0.75 + r() * 0.2, 0.75);
      g.beginPath(); g.ellipse(bx + dir * len * 0.65, by - len * 0.22, len * 0.55, len * 0.17, -dir * 0.06, 0, Math.PI * 2); g.fill();
      g.strokeStyle = ink(0.95, 0.5); g.lineWidth = Math.max(0.4, 0.7 * s);
      for (let n = 0; n < 6; n++) { const nx = bx + dir * len * (0.25 + n * 0.12); g.beginPath(); g.moveTo(nx - 3 * s, by - len * 0.3); g.lineTo(nx, by - len * 0.12); g.lineTo(nx + 3 * s, by - len * 0.3); g.stroke(); }
    }
  } else if (kind === 'willow') {
    const [tx, ty] = at(1);
    g.strokeStyle = ink(0.55, 0.55); g.lineWidth = Math.max(0.4, 0.8 * s);
    for (let n = 0; n < 16; n++) {
      const ox = (n / 15 - 0.5) * h * 0.9, l = h * (0.45 + r() * 0.4);
      g.beginPath(); g.moveTo(tx, ty); g.quadraticCurveTo(tx + ox, ty - h * 0.1, tx + ox * 1.1 + (r() - 0.5) * 4 * s, ty + l); g.stroke();
    }
  } else if (kind === 'bare') {
    const branch = (bx: number, by: number, ang: number, len: number, d: number) => {
      if (d > 3 || len < 3) return;
      const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len;
      g.lineWidth = Math.max(0.5, (3.2 - d) * s); g.strokeStyle = ink(0.85, 0.85);
      g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
      branch(ex, ey, ang - 0.5 - r() * 0.3, len * 0.66, d + 1); branch(ex, ey, ang + 0.4 + r() * 0.3, len * 0.6, d + 1);
    };
    const [tx, ty] = at(0.8);
    branch(tx, ty, -Math.PI / 2 - 0.4, h * 0.3, 0); branch(tx, ty, -Math.PI / 2 + 0.5, h * 0.28, 0);
  } else {
    const [tx, ty] = at(0.85);
    for (let n = 0; n < 26; n++) {
      const a2 = r() * Math.PI * 2, d = r() * h * 0.38;
      g.fillStyle = ink(0.6 + r() * 0.35, 0.55 + r() * 0.35);
      g.beginPath(); g.ellipse(tx + Math.cos(a2) * d, ty + Math.sin(a2) * d * 0.7, (2.5 + r() * 3) * s, (1.6 + r() * 2) * s, r() * 3, 0, Math.PI * 2); g.fill();
    }
  }
  g.restore();
}

/** 村舍：土墙、两坡瓦顶、檐角微翘 */
export function hut(g: CanvasRenderingContext2D, x: number, y: number, s: number, r: Rnd, a = 1) {
  const w = 34 * s * (0.8 + r() * 0.5), h = 16 * s;
  g.save(); g.globalAlpha *= a;
  g.fillStyle = 'rgba(214,198,160,0.95)'; g.fillRect(x - w / 2, y - h, w, h);
  g.strokeStyle = ink(0.8, 0.8); g.lineWidth = Math.max(0.6, 1.1 * s); g.strokeRect(x - w / 2, y - h, w, h);
  g.fillStyle = ink(0.75, 0.88);
  g.beginPath(); g.moveTo(x - w * 0.62, y - h + 1 * s); g.quadraticCurveTo(x - w * 0.5, y - h - 3 * s, x - w * 0.38, y - h - 12 * s); g.lineTo(x + w * 0.38, y - h - 12 * s); g.quadraticCurveTo(x + w * 0.5, y - h - 3 * s, x + w * 0.62, y - h + 1 * s); g.closePath(); g.fill();
  g.fillStyle = ink(0.95, 0.9); g.fillRect(x - w * 0.08, y - h * 0.7, w * 0.16, h * 0.7);
  g.restore();
}

/** 一簇草：三五笔，长短不一 */
export function grass(g: CanvasRenderingContext2D, x: number, y: number, s: number, r: Rnd, a = 0.5) {
  g.strokeStyle = ink(0.7, a); g.lineWidth = Math.max(0.5, 1.1 * s); g.lineCap = 'round';
  const n = 3 + Math.floor(r() * 3);
  for (let k = 0; k < n; k++) {
    const ox = (k - n / 2) * 2.4 * s, l = (6 + r() * 9) * s, bend = (r() - 0.5) * 7 * s;
    g.beginPath(); g.moveTo(x + ox, y); g.quadraticCurveTo(x + ox + bend * 0.3, y - l * 0.6, x + ox + bend, y - l); g.stroke();
  }
}

/** 远处的一道土岗：淡墨晕染，岗脊一笔、坡上皴擦 */
export function mound(g: CanvasRenderingContext2D, pts: [number, number][], r: Rnd, a = 1) {
  if (pts.length < 3) return;
  const top = Math.min(...pts.map(p => p[1])), bot = Math.max(...pts.map(p => p[1]));
  const gr = g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, ink(0.45, 0.42 * a)); gr.addColorStop(1, ink(0.3, 0.05 * a));
  g.fillStyle = gr; g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill();
  g.strokeStyle = ink(0.8, 0.5 * a); g.lineWidth = 1.4; g.lineCap = 'round';
  g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length / 2; i++) g.lineTo(pts[i][0], pts[i][1]);
  g.stroke();
  g.lineWidth = 0.7;
  for (let n = 0; n < 60; n++) {
    const i = Math.floor(r() * (pts.length / 2)), [x, y] = pts[i];
    g.strokeStyle = ink(0.6, (0.1 + r() * 0.15) * a);
    g.beginPath(); g.moveTo(x, y + 2); g.lineTo(x + (r() - 0.5) * 8, y + 6 + r() * (bot - top) * 0.5); g.stroke();
  }
}

/** 墨团：烟、尘、硝烟（软边多团叠） */
export function puff(g: CanvasRenderingContext2D, x: number, y: number, rad: number, rgb: string, a: number, seed: number) {
  const r = mkRnd(seed);
  for (let k = 0; k < 4; k++) {
    const ox = (r() - 0.5) * rad * 0.9, oy = (r() - 0.5) * rad * 0.5, rr = rad * (0.5 + r() * 0.5);
    const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rr);
    gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.6, `rgba(${rgb},${a * 0.5})`); gr.addColorStop(1, `rgba(${rgb},0)`);
    g.fillStyle = gr; g.beginPath(); g.arc(x + ox, y + oy, rr, 0, Math.PI * 2); g.fill();
  }
}

/** 溅墨：交锋处飞溅的墨点 */
export function splatter(g: CanvasRenderingContext2D, x: number, y: number, rad: number, a: number, seed: number) {
  const r = mkRnd(seed);
  g.fillStyle = ink(0.95, a);
  for (let k = 0; k < 14; k++) {
    const an = r() * Math.PI * 2, d = rad * Math.pow(r(), 0.7), s = (1 - d / rad) * rad * 0.12 + 0.8;
    g.beginPath(); g.ellipse(x + Math.cos(an) * d, y + Math.sin(an) * d * 0.55, s, s * 0.8, an, 0, Math.PI * 2); g.fill();
  }
}

/** 把旗色调成水墨设色：降饱和、略压暗，免得像塑料 */
export function tint(hex: string, k = 0.25): string {
  const n = parseInt(hex.slice(1), 16);
  const rgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
  return '#' + rgb.map(c => Math.round((c * (1 - k) + avg * k) * (1 - k * 0.25))).map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

/** 一道檐：墨瓦，两端起翘 */
export function eave(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k = 0.85) {
  g.fillStyle = ink(k, 0.92);
  g.beginPath();
  g.moveTo(x - w * 0.5, y - h * 0.15);
  g.quadraticCurveTo(x - w * 0.36, y + h * 0.05, x - w * 0.28, y - h * 0.55);
  g.lineTo(x - w * 0.18, y - h); g.lineTo(x + w * 0.18, y - h); g.lineTo(x + w * 0.28, y - h * 0.55);
  g.quadraticCurveTo(x + w * 0.36, y + h * 0.05, x + w * 0.5, y - h * 0.15);
  g.lineTo(x + w * 0.3, y); g.lineTo(x - w * 0.3, y); g.closePath(); g.fill();
  g.strokeStyle = ink(0.4, 0.35); g.lineWidth = Math.max(0.5, h * 0.05);
  for (let t = -0.22; t <= 0.22; t += 0.055) { g.beginPath(); g.moveTo(x + w * t, y - h * 0.9); g.lineTo(x + w * t * 1.25, y - h * 0.1); g.stroke(); }
}

/** 塔：层层出檐 */
export function pagoda(g: CanvasRenderingContext2D, x: number, y: number, s: number, a = 1) {
  g.save(); g.globalAlpha *= a;
  const floors = 7; let yy = y, w = 30 * s;
  for (let f = 0; f < floors; f++) {
    const bh = 9 * s * (1 - f * 0.05);
    g.fillStyle = 'rgba(205,190,150,0.95)'; g.fillRect(x - w * 0.28, yy - bh, w * 0.56, bh);
    g.strokeStyle = ink(0.8, 0.7); g.lineWidth = Math.max(0.5, 0.8 * s); g.strokeRect(x - w * 0.28, yy - bh, w * 0.56, bh);
    g.fillStyle = ink(0.9, 0.85); g.fillRect(x - w * 0.05, yy - bh * 0.75, w * 0.1, bh * 0.5);
    yy -= bh;
    eave(g, x, yy, w, 5 * s);
    yy -= 4 * s; w *= 0.88;
  }
  g.strokeStyle = ink(0.9); g.lineWidth = Math.max(0.8, 1.4 * s); g.beginPath(); g.moveTo(x, yy); g.lineTo(x, yy - 14 * s); g.stroke();
  g.restore();
}

/** 营帐：白帐墨勾，帐顶一面小旗 */
export function tent(g: CanvasRenderingContext2D, x: number, y: number, s: number, flag: string, wave = 0) {
  const w = 26 * s, h = 18 * s;
  g.fillStyle = 'rgba(238,230,210,0.95)';
  g.beginPath(); g.moveTo(x - w / 2, y); g.quadraticCurveTo(x - w * 0.2, y - h * 0.5, x, y - h); g.quadraticCurveTo(x + w * 0.2, y - h * 0.5, x + w / 2, y); g.closePath(); g.fill();
  g.strokeStyle = ink(0.85, 0.85); g.lineWidth = Math.max(0.6, 1.1 * s); g.stroke();
  g.fillStyle = ink(0.9, 0.85); g.beginPath(); g.moveTo(x - w * 0.08, y); g.lineTo(x, y - h * 0.45); g.lineTo(x + w * 0.08, y); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(x, y - h); g.lineTo(x, y - h - 10 * s); g.stroke();
  g.fillStyle = flag; g.beginPath(); g.moveTo(x, y - h - 10 * s); g.lineTo(x + 8 * s, y - h - 8 * s + Math.sin(wave) * s); g.lineTo(x, y - h - 5 * s); g.closePath(); g.fill();
}
