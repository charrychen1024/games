/* 地图 2.5D 倾斜投影（2026-11-26） */
import { describe, it, expect } from 'vitest';
import { worldToScreen, screenToWorld, depthAt, flatV, flatW } from '../src/render/projection';

const cam = { x: 1000, y: 800, z: 1.8 }, W = 1440, H = 900;

describe('地图倾斜投影', () => {
  it('屏幕与世界互逆', () => {
    for (const [sx, sy] of [[0, 0], [720, 450], [1440, 900], [300, 120], [1200, 700]]) {
      const [x, y] = screenToWorld(cam, W, H, sx, sy);
      const [bx, by] = worldToScreen(cam, W, H, x, y);
      expect(bx).toBeCloseTo(sx, 6); expect(by).toBeCloseTo(sy, 6);
    }
  });
  it('镜头中心落在画面中央，中央横向比例即 cam.z', () => {
    expect(worldToScreen(cam, W, H, cam.x, cam.y)).toEqual([W / 2, H / 2]);
    const [a] = worldToScreen(cam, W, H, cam.x + 10, cam.y);
    expect(a - W / 2).toBeCloseTo(10 * cam.z, 6);
  });
  it('远小近大：画面上方比例小于中央，下方大于中央；底边平面与屏幕 1:1', () => {
    expect(depthAt(H, 0)).toBeLessThan(0.9);
    expect(depthAt(H, H / 2)).toBeCloseTo(1, 6);
    expect(depthAt(H, H)).toBeGreaterThan(1.1);
    expect(flatW(H, flatV(H, H))).toBeCloseTo(1, 6);
  });
  it('同一段世界距离，画面上方看起来更短', () => {
    const top = screenToWorld(cam, W, H, W / 2, 60), bot = screenToWorld(cam, W, H, W / 2, H - 60);
    const lenAt = (p: [number, number]) => worldToScreen(cam, W, H, p[0] + 20, p[1])[0] - worldToScreen(cam, W, H, p[0], p[1])[0];
    expect(lenAt(top)).toBeLessThan(lenAt(bot) * 0.8);
  });
});
