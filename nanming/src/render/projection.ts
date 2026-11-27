/* 投影：经纬度 → 世界坐标（等距圆柱，按北纬 32° 校正东西向比例）。 */
export const BBOX = { x0: 85, y0: 12, x1: 137, y1: 50 };
export const PX_PER_DEG = 40;
const KX = Math.cos(32 * Math.PI / 180);

export const WORLD_W = (BBOX.x1 - BBOX.x0) * PX_PER_DEG * KX;
export const WORLD_H = (BBOX.y1 - BBOX.y0) * PX_PER_DEG;

export function project(lon: number, lat: number): [number, number] {
  return [(lon - BBOX.x0) * PX_PER_DEG * KX, (BBOX.y1 - lat) * PX_PER_DEG];
}
export function unproject(x: number, y: number): [number, number] {
  return [x / (PX_PER_DEG * KX) + BBOX.x0, BBOX.y1 - y / PX_PER_DEG];
}

export interface Camera { x: number; y: number; z: number }

/* 2.5D：地图平面向后倾——远处（画面上方）缩小、近处放大，纵向再略压扁。
 * 画面中央的横向比例恰为 cam.z；画面底边处平面像素与屏幕像素 1:1。
 * 先把平面画到一张“平面画布”，再逐行条带贴到屏幕（见 MapRenderer.render）。 */
export const TILT = { t: 0.32, q: 0.82 };
/** 平面坐标（以镜头为原点、按 Zf 放大）里，屏幕某一行对应的纵坐标 v */
export function flatV(h: number, sy: number): number {
  const { t, q } = TILT, D = h / q, s = (sy - h / 2) / q;
  return s * (1 + t / 2) / (1 + t * s / D);
}
/** 平面纵坐标 v 处的缩小倍数（>1 为缩小） */
export function flatW(h: number, v: number): number { const { t, q } = TILT; return 1 + t / 2 - t * v / (h / q); }
export const flatZ = (cam: Camera) => cam.z * (1 + TILT.t / 2);
/** 屏幕某一行的远近比例：中央为 1，上方 <1，下方 >1 */
export function depthAt(h: number, sy: number): number { return (1 + TILT.t / 2) / flatW(h, flatV(h, sy)); }

export function worldToScreen(cam: Camera, w: number, h: number, x: number, y: number): [number, number] {
  const Z = flatZ(cam), u = (x - cam.x) * Z, v = (y - cam.y) * Z;
  const k = flatW(h, v);
  if (k < 0.05) return [w / 2 + u * 20, h * 20];
  return [w / 2 + u / k, h / 2 + TILT.q * v / k];
}
export function screenToWorld(cam: Camera, w: number, h: number, sx: number, sy: number): [number, number] {
  const Z = flatZ(cam), v = flatV(h, sy), k = flatW(h, v);
  return [cam.x + (sx - w / 2) * k / Z, cam.y + v / Z];
}
