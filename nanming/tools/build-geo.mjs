/* 从 Natural Earth（经 world-atlas 打包，公有领域）提取地图范围内的陆地轮廓，
 * 裁剪、抽稀后写入 src/data/geo-land.json。只需在更换范围时重跑：node tools/build-geo.mjs */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
const require = createRequire(import.meta.url);
const topo = require('world-atlas/land-50m.json');
const BBOX = { x0: 85, y0: 12, x1: 137, y1: 50 };

function clipEdge(ring, inside, intersect) {
  const out = [];
  for (let i = 0; i < ring.length; i++) {
    const cur = ring[i], prev = ring[(i + ring.length - 1) % ring.length];
    const ci = inside(cur), pi = inside(prev);
    if (ci) { if (!pi) out.push(intersect(prev, cur)); out.push(cur); }
    else if (pi) out.push(intersect(prev, cur));
  }
  return out;
}
function clip(ring) {
  const lerpX = (x) => (a, b) => { const t = (x - a[0]) / (b[0] - a[0]); return [x, a[1] + t * (b[1] - a[1])]; };
  const lerpY = (y) => (a, b) => { const t = (y - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), y]; };
  let r = ring;
  r = clipEdge(r, p => p[0] >= BBOX.x0, lerpX(BBOX.x0)); if (!r.length) return r;
  r = clipEdge(r, p => p[0] <= BBOX.x1, lerpX(BBOX.x1)); if (!r.length) return r;
  r = clipEdge(r, p => p[1] >= BBOX.y0, lerpY(BBOX.y0)); if (!r.length) return r;
  r = clipEdge(r, p => p[1] <= BBOX.y1, lerpY(BBOX.y1));
  return r;
}
function simplify(ring, tol) {
  const out = [ring[0]];
  for (const p of ring) { const q = out[out.length - 1]; if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= tol) out.push(p); }
  return out;
}
const geo = feature(topo, topo.objects.land);
const rings = [];
for (const f of geo.features) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const r = simplify(clip(poly[0]), 0.06);
    if (r.length < 4) continue;
    let area = 0; for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; area += a[0] * b[1] - b[0] * a[1]; }
    if (Math.abs(area) < 0.08) continue;
    rings.push(r.map(p => [+p[0].toFixed(2), +p[1].toFixed(2)]));
  }
}
fs.writeFileSync(new URL('../src/data/geo-land.json', import.meta.url), JSON.stringify({ bbox: BBOX, source: 'Natural Earth 1:50m land (public domain) via world-atlas', rings }));
console.log('rings', rings.length, 'points', rings.reduce((s, r) => s + r.length, 0));
