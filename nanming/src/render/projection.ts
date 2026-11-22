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

export function worldToScreen(cam: Camera, w: number, h: number, x: number, y: number): [number, number] {
  return [(x - cam.x) * cam.z + w / 2, (y - cam.y) * cam.z + h / 2];
}
export function screenToWorld(cam: Camera, w: number, h: number, sx: number, sy: number): [number, number] {
  return [(sx - w / 2) / cam.z + cam.x, (sy - h / 2) / cam.z + cam.y];
}
