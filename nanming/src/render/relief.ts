/* 地形：读入真实高程（tools/build-relief.mjs 生成），在浏览器里用代码着色。
 * - 陆地：按海拔与干湿（经纬度估算）分层设色，西北光源晕渲，雪线以上积雪。
 * - 海洋：按水深由浅青到深蓝，大陆架与深海分明。
 * - 河流：沿河道两侧搜寻最低处，让河线落进真实的河谷。 */
import { BBOX } from './projection';

export interface Relief {
  w: number;
  h: number;
  /** 每度格数 */
  per: number;
  /** 海拔（米，海为负） */
  e: Float32Array;
}

export function decode(v: number): number {
  return v >= 56 ? ((v - 56) / 199) ** 2 * 7000 : -(((55 - v) / 55) ** 2) * 6000;
}

export async function loadRelief(url: string): Promise<Relief> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  const c = document.createElement('canvas');
  c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext('2d', { willReadFrequently: true })!;
  g.drawImage(bmp, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height).data;
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) lut[i] = decode(i);
  const e = new Float32Array(c.width * c.height);
  for (let i = 0; i < e.length; i++) e[i] = lut[px[i * 4]];
  return { w: c.width, h: c.height, per: c.width / (BBOX.x1 - BBOX.x0), e };
}

/** 双线性取海拔 */
export function elevAt(r: Relief, lon: number, lat: number): number {
  const x = (lon - BBOX.x0) * r.per - 0.5, y = (BBOX.y1 - lat) * r.per - 0.5;
  const x0 = Math.max(0, Math.min(r.w - 2, Math.floor(x))), y0 = Math.max(0, Math.min(r.h - 2, Math.floor(y)));
  const u = Math.max(0, Math.min(1, x - x0)), v = Math.max(0, Math.min(1, y - y0));
  const i = y0 * r.w + x0;
  return r.e[i] * (1 - u) * (1 - v) + r.e[i + 1] * u * (1 - v) + r.e[i + r.w] * (1 - u) * v + r.e[i + r.w + 1] * u * v;
}

/* ---------- 设色 ---------- */
type Stop = [number, number, number, number];
const HUMID: Stop[] = [
  [0, 112, 142, 84], [120, 100, 136, 76], [500, 82, 118, 64], [1100, 78, 106, 62], [1900, 110, 110, 80],
  [2900, 138, 126, 100], [4100, 150, 141, 124], [5300, 176, 170, 160], [6100, 244, 244, 240],
];
const ARID: Stop[] = [
  [0, 200, 184, 140], [300, 204, 182, 132], [1000, 194, 168, 120], [1600, 180, 154, 110], [2500, 164, 142, 106],
  [3500, 154, 134, 106], [4500, 160, 142, 114], [5400, 178, 166, 148], [6200, 244, 244, 240],
];
const SEA: Stop[] = [
  [0, 112, 168, 166], [25, 92, 154, 160], [70, 74, 138, 156], [160, 60, 122, 150], [600, 46, 96, 134],
  [1800, 36, 78, 116], [4000, 28, 62, 98], [6000, 24, 54, 88],
];
function ramp(stops: Stop[], v: number, out: number[]) {
  if (v <= stops[0][0]) { out[0] = stops[0][1]; out[1] = stops[0][2]; out[2] = stops[0][3]; return; }
  for (let i = 1; i < stops.length; i++) {
    if (v <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i], t = (v - a[0]) / (b[0] - a[0]);
      out[0] = a[1] + (b[1] - a[1]) * t; out[1] = a[2] + (b[2] - a[2]) * t; out[2] = a[3] + (b[3] - a[3]) * t;
      return;
    }
  }
  const l = stops[stops.length - 1]; out[0] = l[1]; out[1] = l[2]; out[2] = l[3];
}
const ss = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** 干燥度 0（湿润）–1（干旱）：秦岭淮河以北渐干，东北、朝鲜、日本湿润，西北高原干 */
export function aridity(lon: number, lat: number): number {
  let a1 = ss(32, 40.5, lat) * (1 - 0.85 * ss(119, 124.5, lon));
  a1 = Math.min(1, a1 + ss(41, 44, lat) * (1 - ss(118, 122, lon)) * 0.3);
  const a2 = ss(108, 98, lon) * ss(30, 37, lat);
  const a3 = ss(103, 95, lon) * ss(27, 31, lat) * 0.75;
  return Math.max(a1, a2, a3);
}

function hash(i: number, j: number) {
  let h = (i * 374761393 + j * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** 把高程画成两张同尺寸图：陆地版、海洋版（由海岸线裁切拼合）。 */
export function paintRelief(r: Relief): { land: HTMLCanvasElement; sea: HTMLCanvasElement } {
  const { w, h, e, per } = r;
  const land = document.createElement('canvas'), sea = document.createElement('canvas');
  land.width = sea.width = w; land.height = sea.height = h;
  const lg = land.getContext('2d')!, sg = sea.getContext('2d')!;
  const li = lg.createImageData(w, h), si = sg.createImageData(w, h);
  const L = li.data, S = si.data;
  // 光源：西北，高 40°
  const lx = -0.62, ly = -0.62, lz = 0.48;
  const flat = lz;
  const cy = 110574 / per;
  const cH = [0, 0, 0], cA = [0, 0, 0], cS = [0, 0, 0];
  for (let j = 0; j < h; j++) {
    const lat = BBOX.y1 - (j + 0.5) / per;
    const cx = 111320 * Math.cos(lat * Math.PI / 180) / per;
    const jn = Math.max(0, j - 1) * w, js = Math.min(h - 1, j + 1) * w, jr = j * w;
    for (let i = 0; i < w; i++) {
      const lon = BBOX.x0 + (i + 0.5) / per;
      const iw = Math.max(0, i - 1), ie = Math.min(w - 1, i + 1);
      const k = jr + i, o = k * 4;
      const ev = e[k];
      // —— 陆地 ——
      {
        const el = Math.max(ev, 1);
        const dzdx = (Math.max(e[jr + ie], 0) - Math.max(e[jr + iw], 0)) / (2 * cx) * 5;
        const dzdy = (Math.max(e[js + i], 0) - Math.max(e[jn + i], 0)) / (2 * cy) * 5;
        const nl = Math.hypot(dzdx, dzdy, 1);
        let sh = (-dzdx * lx - dzdy * ly + lz) / nl / flat; // 1 = 平地
        sh = 0.42 + 0.58 * Math.max(0.1, Math.min(1.7, sh));
        const slope = 1 - 1 / nl;
        const a = aridity(lon, lat);
        ramp(HUMID, el, cH); ramp(ARID, el, cA);
        let rr = cH[0] + (cA[0] - cH[0]) * a, gg = cH[1] + (cA[1] - cH[1]) * a, bb = cH[2] + (cA[2] - cH[2]) * a;
        // 陡坡偏岩色
        const rock = Math.min(0.5, slope * 1.6) * ss(300, 1500, el);
        rr += (128 - rr) * rock; gg += (118 - gg) * rock; bb += (104 - bb) * rock;
        // 雪：北坡积得更低
        const snowLine = 5900 - (lat - 28) * 45 - Math.max(0, dzdy) * 250;
        const snow = ss(snowLine - 250, snowLine + 250, el);
        rr += (246 - rr) * snow; gg += (247 - gg) * snow; bb += (250 - bb) * snow;
        // 晕渲：亮面偏暖，暗面偏冷
        const n = 0.975 + hash(i, j) * 0.05;
        const lit = sh * n;
        const cool = Math.max(0, 1 - sh) * 14;
        L[o] = Math.min(255, rr * lit - cool);
        L[o + 1] = Math.min(255, gg * lit - cool * 0.5);
        L[o + 2] = Math.min(255, bb * lit + cool * 0.6);
        L[o + 3] = 255;
      }
      // —— 海 ——
      {
        const d = Math.max(0, -ev);
        ramp(SEA, d, cS);
        const dzdx = (Math.min(e[jr + ie], 0) - Math.min(e[jr + iw], 0)) / (2 * cx) * 2.5;
        const dzdy = (Math.min(e[js + i], 0) - Math.min(e[jn + i], 0)) / (2 * cy) * 2.5;
        const nl = Math.hypot(dzdx, dzdy, 1);
        const sh = Math.max(0.6, Math.min(1.25, (-dzdx * lx - dzdy * ly + lz) / nl / flat));
        const n = 0.985 + hash(j, i) * 0.03;
        S[o] = cS[0] * sh * n; S[o + 1] = cS[1] * sh * n; S[o + 2] = cS[2] * sh * n; S[o + 3] = 255;
      }
    }
  }
  lg.putImageData(li, 0, 0);
  sg.putImageData(si, 0, 0);
  return { land, sea };
}

/** 细颗粒纹理（叠在晕渲上，免得放大后发糊） */
export function grainTile(size = 160): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!;
  const im = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = hash(i % size, (i / size) | 0);
    const dark = v < 0.5;
    im.data[i * 4] = dark ? 30 : 255; im.data[i * 4 + 1] = dark ? 34 : 250; im.data[i * 4 + 2] = dark ? 20 : 235;
    im.data[i * 4 + 3] = Math.abs(v - 0.5) * 2 * 26;
  }
  g.putImageData(im, 0, 0);
  return c;
}

/**
 * 河道入谷：先按 step（度）加密折线，再在每点的法线方向上找最低处，
 * 偏移量做平滑并限制幅度。返回经纬度点列（上游 → 下游）。
 */
export function snapRiver(r: Relief | null, pts: [number, number][], step = 0.035, reach = 0.11): [number, number][] {
  const dense: [number, number][] = [];
  // Catmull-Rom 加密
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const n = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      dense.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  dense.push(pts[pts.length - 1]);
  if (!r) return dense;
  const offs = new Float32Array(dense.length);
  const N = 8;
  for (let i = 1; i < dense.length - 1; i++) {
    const [ax, ay] = dense[i - 1], [bx, by] = dense[i + 1];
    const tl = Math.hypot(bx - ax, by - ay) || 1;
    const nx = -(by - ay) / tl, ny = (bx - ax) / tl;
    const [x, y] = dense[i];
    const e0 = elevAt(r, x, y);
    let best = 0, bestCost = Infinity;
    for (let k = -N; k <= N; k++) {
      const o = (k / N) * reach;
      const ev = elevAt(r, x + nx * o, y + ny * o);
      // 平原上海拔差小，距离罚分让河不乱跳
      const cost = ev - e0 + Math.abs(o) / reach * (6 + Math.max(0, e0) * 0.02);
      if (cost < bestCost) { bestCost = cost; best = o; }
    }
    offs[i] = best;
  }
  // 平滑偏移
  const sm = new Float32Array(offs.length);
  const W = 4;
  for (let i = 0; i < offs.length; i++) {
    let s = 0, c = 0;
    for (let k = -W; k <= W; k++) { const j = i + k; if (j >= 0 && j < offs.length) { const wt = W + 1 - Math.abs(k); s += offs[j] * wt; c += wt; } }
    sm[i] = s / c;
  }
  sm[0] = 0; sm[sm.length - 1] = 0;
  const out: [number, number][] = [];
  for (let i = 0; i < dense.length; i++) {
    const [ax, ay] = dense[Math.max(0, i - 1)], [bx, by] = dense[Math.min(dense.length - 1, i + 1)];
    const tl = Math.hypot(bx - ax, by - ay) || 1;
    // 末端（入海、入江处）逐渐收回原位，免得错开汇流点
    const fade = Math.min(1, i / 6, (dense.length - 1 - i) / 6);
    out.push([dense[i][0] - (by - ay) / tl * sm[i] * fade, dense[i][1] + (bx - ax) / tl * sm[i] * fade]);
  }
  return out;
}
