/* 地形高程：从 AWS Terrain Tiles（Terrarium 编码，公开数据，源自 SRTM / ETOPO1 / GEBCO 等）
 * 下载 z6 瓦片，按游戏投影（经纬度线性）重采样到 BBOX 范围，每度 32 格，
 * 以单通道 8 位压扩编码（解码见 src/render/relief.ts）写入 src/assets/relief.png。
 * 只需在更换地图范围时重跑：node tools/build-relief.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const BBOX = { x0: 85, y0: 12, x1: 137, y1: 50 };
const PER_DEG = 32;
const Z = 6;
const N = 2 ** Z;
const CACHE = path.resolve('node_modules/.cache/terrarium');
fs.mkdirSync(CACHE, { recursive: true });

const tx = lon => (lon + 180) / 360 * N;
const ty = lat => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * N; };

async function tile(x, y) {
  const f = path.join(CACHE, `${Z}-${x}-${y}.png`);
  if (!fs.existsSync(f)) {
    const res = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${x}/${y}.png`);
    if (!res.ok) throw new Error(`tile ${x},${y}: ${res.status}`);
    fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  }
  return PNG.sync.read(fs.readFileSync(f));
}

const x0 = Math.floor(tx(BBOX.x0)), x1 = Math.floor(tx(BBOX.x1));
const y0 = Math.floor(ty(BBOX.y1)), y1 = Math.floor(ty(BBOX.y0));
const tiles = {};
for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles[`${x},${y}`] = await tile(x, y);
console.log(`tiles ${(x1 - x0 + 1) * (y1 - y0 + 1)}`);

function elevAt(px, py) { // 全局像素坐标（z6，256/瓦片）
  const X = Math.floor(px / 256), Y = Math.floor(py / 256);
  const t = tiles[`${X},${Y}`];
  if (!t) return 0;
  const i = ((Math.floor(py) - Y * 256) * 256 + (Math.floor(px) - X * 256)) * 4;
  return t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
}
function bilinear(px, py) {
  const fx = Math.floor(px - 0.5), fy = Math.floor(py - 0.5), u = px - 0.5 - fx, v = py - 0.5 - fy;
  return elevAt(fx, fy) * (1 - u) * (1 - v) + elevAt(fx + 1, fy) * u * (1 - v) + elevAt(fx, fy + 1) * (1 - u) * v + elevAt(fx + 1, fy + 1) * u * v;
}

const W = (BBOX.x1 - BBOX.x0) * PER_DEG, H = (BBOX.y1 - BBOX.y0) * PER_DEG;
// 单通道 8 位，平方根压扩：陆地 56–255（低处细、高处粗），海 0–55
const buf = Buffer.alloc(W * H);
for (let j = 0; j < H; j++) {
  const lat = BBOX.y1 - (j + 0.5) / PER_DEG;
  const py = ty(lat) * 256;
  for (let i = 0; i < W; i++) {
    const lon = BBOX.x0 + (i + 0.5) / PER_DEG;
    const e = bilinear(tx(lon) * 256, py);
    buf[j * W + i] = e > 0 ? 56 + Math.round(Math.sqrt(Math.min(e, 7000) / 7000) * 199) : Math.round(55 - Math.sqrt(Math.min(-e, 6000) / 6000) * 55);
  }
}
fs.mkdirSync('src/assets', { recursive: true });
const out = new PNG({ width: W, height: H, colorType: 0, inputColorType: 0 });
out.data = buf;
fs.writeFileSync('src/assets/relief.png', PNG.sync.write(out, { colorType: 0, inputColorType: 0, deflateLevel: 9 }));
console.log(`relief ${W}x${H}`, (fs.statSync('src/assets/relief.png').size / 1024).toFixed(0) + 'KB');
