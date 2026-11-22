/* 地理：节点、路线、河流、山脉。坐标为经纬度（治所近似位置）。
 * 细做：南直隶、长江沿线、浙江、福建沿海；其余为粗粒度大区。
 * 1644 年黄河夺淮南流，经开封、徐州，在淮安清口与淮河相会入海。 */
import type { MapNode, Route, RouteKind } from '../core/types';

const N = (id: string, name: string, kind: MapNode['kind'], lon: number, lat: number, area: string, detail: boolean, extra: Partial<MapNode> = {}): MapNode =>
  ({ id, name, kind, lon, lat, area, detail, ...extra });

export const NODES: MapNode[] = [
  // 南直隶
  N('nanjing', '南京', 'city', 118.78, 32.06, '南直隶', true, { major: true, title: '应天府 · 留都' }),
  N('zhenjiang', '镇江', 'city', 119.45, 32.2, '南直隶', true, { title: '镇江府', major: true }),
  N('guazhou', '瓜洲', 'ferry', 119.4, 32.27, '南直隶', true, { title: '渡口', note: '扼运河入江之口，与镇江隔江相望。' }),
  N('yangzhou', '扬州', 'city', 119.42, 32.39, '南直隶', true, { major: true, title: '扬州府' }),
  N('yizhen', '仪真', 'port', 119.18, 32.27, '南直隶', true, { title: '仪真县 · 江港' }),
  N('huaian', '淮安', 'city', 119.14, 33.5, '南直隶', true, { major: true, title: '淮安府' }),
  N('xuzhou', '徐州', 'city', 117.18, 34.26, '南直隶', true, { major: true, title: '徐州直隶州' }),
  N('sizhou', '泗州', 'city', 118.52, 33.1, '南直隶', true, { title: '泗州直隶州' }),
  N('fengyang', '凤阳', 'city', 117.56, 32.87, '南直隶', true, { title: '凤阳府 · 中都' }),
  N('shouzhou', '寿州', 'city', 116.78, 32.57, '南直隶', true, { title: '寿州' }),
  N('luzhou', '庐州', 'city', 117.27, 31.86, '南直隶', true, { title: '庐州府' }),
  N('chuzhou', '滁州', 'city', 118.31, 32.3, '南直隶', true, { title: '滁州直隶州' }),
  N('hezhou', '和州', 'city', 118.35, 31.72, '南直隶', true, { title: '和州直隶州' }),
  N('taiping', '太平', 'city', 118.5, 31.56, '南直隶', true, { title: '太平府' }),
  N('wuhu', '芜湖', 'port', 118.37, 31.34, '南直隶', true, { title: '江港' }),
  N('anqing', '安庆', 'city', 117.05, 30.52, '南直隶', true, { major: true, title: '安庆府' }),
  N('chizhou', '池州', 'city', 117.49, 30.66, '南直隶', true, { title: '池州府' }),
  N('ningguo', '宁国', 'city', 118.75, 30.95, '南直隶', true, { title: '宁国府' }),
  N('huizhou', '徽州', 'city', 118.43, 29.87, '南直隶', true, { title: '徽州府' }),
  N('changzhou', '常州', 'city', 119.95, 31.78, '南直隶', true, { title: '常州府' }),
  N('suzhou', '苏州', 'city', 120.62, 31.3, '南直隶', true, { major: true, title: '苏州府' }),
  N('songjiang', '松江', 'city', 121.23, 31.0, '南直隶', true, { title: '松江府' }),
  // 浙江
  N('hangzhou', '杭州', 'city', 120.16, 30.27, '浙江', true, { major: true, title: '杭州府' }),
  N('shaoxing', '绍兴', 'city', 120.58, 30.0, '浙江', true, { title: '绍兴府' }),
  N('ningbo', '宁波', 'port', 121.55, 29.87, '浙江', true, { title: '宁波府 · 海港' }),
  N('quzhou', '衢州', 'city', 118.87, 28.97, '浙江', true, { title: '衢州府' }),
  N('wenzhou', '温州', 'port', 120.65, 28.0, '浙江', true, { title: '温州府 · 海港' }),
  N('xianxia', '仙霞关', 'pass', 118.68, 28.3, '浙江', true, { title: '关隘', note: '浙闽之间的咽喉。' }),
  // 江西、湖广沿江
  N('jiujiang', '九江', 'city', 115.99, 29.71, '江西', true, { major: true, title: '九江府' }),
  N('nanchang', '南昌', 'city', 115.89, 28.68, '江西', true, { title: '南昌府' }),
  N('wuchang', '武昌', 'city', 114.3, 30.55, '湖广', true, { major: true, title: '武昌府' }),
  N('yuezhou', '岳州', 'city', 113.1, 29.37, '湖广', true, { title: '岳州府' }),
  N('jingzhou', '荆州', 'city', 112.24, 30.33, '湖广', true, { title: '荆州府' }),
  N('xiangyang', '襄阳', 'city', 112.14, 32.04, '湖广', true, { major: true, title: '襄阳府' }),
  // 福建
  N('fuzhou', '福州', 'city', 119.3, 26.08, '福建', true, { major: true, title: '福州府' }),
  N('jianning', '建宁', 'city', 118.32, 27.03, '福建', true, { title: '建宁府' }),
  N('yanping', '延平', 'city', 118.18, 26.64, '福建', true, { title: '延平府' }),
  N('quanzhou', '泉州', 'port', 118.59, 24.91, '福建', true, { title: '泉州府 · 海港' }),
  N('anping', '安平', 'port', 118.4, 24.7, '福建', true, { title: '安平镇 · 郑氏根基' }),
  N('xiamen', '中左所', 'port', 118.08, 24.47, '福建', true, { title: '厦门 · 海港' }),
  N('zhangzhou', '漳州', 'city', 117.65, 24.51, '福建', true, { title: '漳州府' }),
  // 河南、江北
  N('guide', '归德', 'city', 115.65, 34.44, '河南', true, { title: '归德府' }),
  N('suizhou', '睢州', 'city', 115.07, 34.45, '河南', true, { title: '睢州' }),
  N('kaifeng', '开封', 'city', 114.35, 34.79, '河南', true, { major: true, title: '开封府', note: '崇祯十五年黄河决口，城毁大半。' }),
  // 粗粒度大区
  N('beijing', '北京', 'city', 116.4, 39.9, '北直隶', false, { major: true, title: '顺天府' }),
  N('tianjin', '天津', 'port', 117.2, 39.13, '北直隶', false, { title: '天津卫' }),
  N('daming', '大名', 'region', 115.15, 36.28, '北直隶', false, { title: '北直隶南部' }),
  N('jinan', '济南', 'region', 117.0, 36.67, '山东', false, { major: true, title: '山东' }),
  N('taiyuan', '太原', 'region', 112.55, 37.87, '山西', false, { major: true, title: '山西' }),
  N('xian', '西安', 'region', 108.94, 34.26, '陕西', false, { major: true, title: '陕西 · 大顺西京' }),
  N('tongguan', '潼关', 'pass', 110.25, 34.55, '陕西', false, { title: '关隘', note: '关中东大门。' }),
  N('hanzhong', '汉中', 'region', 107.03, 33.07, '陕西', false, { title: '汉中' }),
  N('lanzhou', '兰州', 'region', 103.83, 36.06, '陕西', false, { title: '陕西西部' }),
  N('luoyang', '洛阳', 'region', 112.45, 34.62, '河南', false, { title: '河南府' }),
  N('nanyang', '南阳', 'region', 112.53, 33.0, '河南', false, { title: '南阳' }),
  N('chengdu', '成都', 'region', 104.07, 30.67, '四川', false, { major: true, title: '四川' }),
  N('chongqing', '重庆', 'region', 106.55, 29.56, '四川', false, { title: '川东' }),
  N('kuizhou', '夔州', 'region', 109.47, 31.02, '四川', false, { title: '夔州 · 三峡' }),
  N('changsha', '长沙', 'region', 112.94, 28.23, '湖广', false, { major: true, title: '湖南' }),
  N('ganzhou', '赣州', 'region', 114.93, 25.83, '江西', false, { title: '赣南' }),
  N('guangzhou', '广州', 'region', 113.26, 23.13, '广东', false, { major: true, title: '广东' }),
  N('guilin', '桂林', 'region', 110.29, 25.27, '广西', false, { major: true, title: '广西' }),
  N('guiyang', '贵阳', 'region', 106.71, 26.58, '云贵', false, { title: '贵州' }),
  N('kunming', '昆明', 'region', 102.71, 25.04, '云贵', false, { major: true, title: '云南' }),
  N('shanhai', '山海关', 'pass', 119.75, 40.0, '北直隶', false, { title: '关隘' }),
  N('shengjing', '盛京', 'region', 123.43, 41.8, '辽东', false, { major: true, title: '辽东 · 清故都' }),
  // 图外之地：只用于划分画面，不参与争夺
  N('menggu', '漠南蒙古', 'outland', 112, 43.2, '外', false),
  N('xifan', '西番', 'outland', 97.5, 33, '外', false),
  N('chaoxian', '朝鲜', 'outland', 126.9, 37.6, '外', false),
  N('annan', '安南', 'outland', 105.8, 21.2, '外', false),
  N('mianbei', '缅北', 'outland', 97.8, 24.5, '外', false),
  N('xiyu', '西域', 'outland', 96, 40.5, '外', false),
  N('mobei', '漠北蒙古', 'outland', 106, 47.5, '外', false),
  N('riben', '日本', 'outland', 133.5, 34.5, '外', false),
  N('lvsong', '吕宋', 'outland', 121, 15.5, '外', false),
  N('tianzhu', '天竺', 'outland', 87.5, 24, '外', false),
  N('miandian', '缅甸', 'outland', 96.5, 21, '外', false),
  N('nuergan', '奴儿干', 'outland', 131, 47, '外', false),
  N('taiwan', '台湾', 'outland', 120.95, 23.7, '外', false, { note: '时为荷兰东印度公司所据。' }),
];

export const NODE: Record<string, MapNode> = Object.fromEntries(NODES.map(n => [n.id, n]));

/** 计入统一的主要地区 */
export const VICTORY_AREAS = ['北直隶', '山东', '山西', '河南', '陕西', '南直隶', '浙江', '江西', '湖广', '四川', '福建', '广东', '广西', '云贵'];

const SPEED: Record<RouteKind, number> = { land: 28, river: 45, canal: 40, sea: 90 };
export function distanceKm(a: MapNode, b: MapNode): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// [a, b, kind, 绕行系数]
const RAW: [string, string, RouteKind, number?][] = [
  // 长江（自上而下）
  ['chongqing', 'kuizhou', 'river', 1.4], ['kuizhou', 'jingzhou', 'river', 1.5], ['jingzhou', 'yuezhou', 'river'], ['yuezhou', 'wuchang', 'river'],
  ['wuchang', 'jiujiang', 'river'], ['jiujiang', 'anqing', 'river'], ['anqing', 'chizhou', 'river'], ['chizhou', 'wuhu', 'river'],
  ['wuhu', 'taiping', 'river'], ['taiping', 'nanjing', 'river'], ['nanjing', 'yizhen', 'river'], ['yizhen', 'guazhou', 'river'],
  ['guazhou', 'zhenjiang', 'river', 3], ['zhenjiang', 'songjiang', 'river', 1.3], ['nanjing', 'zhenjiang', 'river'],
  // 渡江
  ['hezhou', 'taiping', 'river', 2], ['chuzhou', 'nanjing', 'land'], ['yizhen', 'zhenjiang', 'river'],
  // 运河
  ['guazhou', 'yangzhou', 'canal', 2], ['yangzhou', 'huaian', 'canal'], ['huaian', 'xuzhou', 'canal', 1.2], ['xuzhou', 'jinan', 'canal', 1.3],
  ['jinan', 'tianjin', 'canal', 1.2], ['tianjin', 'beijing', 'canal'], ['zhenjiang', 'changzhou', 'canal'], ['changzhou', 'suzhou', 'canal'],
  ['suzhou', 'hangzhou', 'canal', 1.2], ['hangzhou', 'shaoxing', 'canal'], ['shaoxing', 'ningbo', 'canal'],
  // 淮河
  ['huaian', 'sizhou', 'river'], ['sizhou', 'fengyang', 'river'], ['fengyang', 'shouzhou', 'river'],
  // 江北陆路
  ['yangzhou', 'yizhen', 'land'], ['yangzhou', 'sizhou', 'land', 1.2], ['yizhen', 'chuzhou', 'land'], ['chuzhou', 'fengyang', 'land'],
  ['chuzhou', 'sizhou', 'land'], ['chuzhou', 'hezhou', 'land'], ['hezhou', 'luzhou', 'land'], ['luzhou', 'shouzhou', 'land'],
  ['luzhou', 'anqing', 'land', 1.2], ['luzhou', 'fengyang', 'land'], ['xuzhou', 'guide', 'land'], ['xuzhou', 'sizhou', 'land', 1.2],
  ['xuzhou', 'fengyang', 'land', 1.2], ['guide', 'suizhou', 'land'], ['suizhou', 'kaifeng', 'land'], ['guide', 'shouzhou', 'land', 1.3],
  ['kaifeng', 'luoyang', 'land'], ['kaifeng', 'daming', 'land'], ['kaifeng', 'nanyang', 'land', 1.2], ['nanyang', 'xiangyang', 'land'],
  ['luoyang', 'nanyang', 'land', 1.2], ['luoyang', 'tongguan', 'land'], ['tongguan', 'xian', 'land'], ['xian', 'hanzhong', 'land', 1.6],
  ['hanzhong', 'chengdu', 'land', 1.6], ['xian', 'lanzhou', 'land', 1.2], ['taiyuan', 'daming', 'land', 1.2], ['taiyuan', 'beijing', 'land', 1.3],
  ['taiyuan', 'tongguan', 'land', 1.2], ['beijing', 'daming', 'land'], ['beijing', 'shanhai', 'land'], ['shanhai', 'shengjing', 'land', 1.2],
  ['jinan', 'daming', 'land'], ['jinan', 'xuzhou', 'land'], ['daming', 'guide', 'land', 1.2],
  // 湖广、西南
  ['xiangyang', 'wuchang', 'river', 1.2], ['xiangyang', 'jingzhou', 'land'], ['chengdu', 'chongqing', 'river', 1.2], ['hanzhong', 'kuizhou', 'land', 1.8],
  ['chongqing', 'guiyang', 'land', 1.4], ['guiyang', 'kunming', 'land', 1.4], ['guiyang', 'guilin', 'land', 1.4], ['guilin', 'guangzhou', 'river', 1.2],
  ['guilin', 'changsha', 'river', 1.3], ['changsha', 'yuezhou', 'river'], ['changsha', 'ganzhou', 'land', 1.4], ['ganzhou', 'nanchang', 'river', 1.2],
  ['ganzhou', 'guangzhou', 'land', 1.3], ['nanchang', 'jiujiang', 'river'], ['nanchang', 'jianning', 'land', 1.5], ['changsha', 'nanchang', 'land', 1.3],
  // 江南、浙闽
  ['chizhou', 'huizhou', 'land', 1.3], ['huizhou', 'ningguo', 'land'], ['huizhou', 'hangzhou', 'river', 1.2], ['huizhou', 'quzhou', 'land', 1.2],
  ['ningguo', 'wuhu', 'land'], ['ningguo', 'hangzhou', 'land', 1.2], ['ningguo', 'nanjing', 'land', 1.1], ['taiping', 'ningguo', 'land'],
  ['changzhou', 'nanjing', 'land'], ['suzhou', 'songjiang', 'river'], ['hangzhou', 'quzhou', 'river', 1.2], ['quzhou', 'xianxia', 'land', 1.3],
  ['xianxia', 'jianning', 'land', 1.4], ['jianning', 'yanping', 'river'], ['yanping', 'fuzhou', 'river'], ['fuzhou', 'quanzhou', 'land', 1.2],
  ['quanzhou', 'anping', 'land'], ['anping', 'xiamen', 'land'], ['xiamen', 'zhangzhou', 'land'], ['quanzhou', 'zhangzhou', 'land'],
  ['zhangzhou', 'guangzhou', 'land', 1.3], ['ningbo', 'wenzhou', 'land', 1.3], ['wenzhou', 'fuzhou', 'land', 1.4], ['quzhou', 'nanchang', 'land', 1.3],
  // 海路
  ['songjiang', 'ningbo', 'sea'], ['ningbo', 'wenzhou', 'sea'], ['wenzhou', 'fuzhou', 'sea'], ['fuzhou', 'quanzhou', 'sea'],
  ['quanzhou', 'xiamen', 'sea'], ['anping', 'quanzhou', 'sea'], ['xiamen', 'guangzhou', 'sea', 1.2], ['tianjin', 'songjiang', 'sea', 1.2],
  ['huaian', 'songjiang', 'sea', 1.3],
];

export const ROUTES: Route[] = RAW.map(([a, b, kind, f = 1]) => {
  const d = distanceKm(NODE[a], NODE[b]) * f;
  return { a, b, kind, days: Math.max(2, Math.round(d / SPEED[kind])) };
});

export function neighbors(id: string): { to: string; route: Route }[] {
  const out: { to: string; route: Route }[] = [];
  for (const r of ROUTES) {
    if (r.a === id) out.push({ to: r.b, route: r });
    else if (r.b === id) out.push({ to: r.a, route: r });
  }
  return out;
}

export function routeBetween(a: string, b: string): Route | undefined {
  return ROUTES.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
}

/** 最短路径（按天数）。canSea=false 时不走海路。返回不含起点的节点序列。 */
export function shortestPath(from: string, to: string, canSea: boolean): string[] | null {
  if (from === to) return [];
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const done = new Set<string>();
  const ids = NODES.filter(n => n.kind !== 'outland').map(n => n.id);
  while (true) {
    let u: string | null = null, best = Infinity;
    for (const id of ids) if (!done.has(id) && dist[id] !== undefined && dist[id] < best) { best = dist[id]; u = id; }
    if (u === null) return null;
    if (u === to) break;
    done.add(u);
    for (const { to: v, route } of neighbors(u)) {
      if (route.kind === 'sea' && !canSea) continue;
      const nd = best + route.days;
      if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; prev[v] = u; }
    }
  }
  const path: string[] = [];
  for (let c = to; c !== from; c = prev[c]) path.unshift(c);
  return path;
}

export function pathDays(from: string, path: string[]): number {
  let d = 0, c = from;
  for (const p of path) { d += routeBetween(c, p)!.days; c = p; }
  return d;
}

/* ---------- 画面用地物（不参与规则） ---------- */
type Line = [number, number][];
export const RIVERS: { name: string; width: number; pts: Line; label?: [number, number] }[] = [
  { name: '长江', width: 3.2, label: [117.6, 30.95], pts: [[99.5, 27.5], [100.2, 26.6], [101.5, 26.2], [102.6, 26.3], [103.6, 27.6], [104.6, 28.8], [105.4, 28.9], [106.55, 29.56], [107.8, 30], [108.4, 30.8], [109.47, 31.02], [110.4, 30.9], [111.3, 30.7], [112.24, 30.33], [112.9, 29.8], [113.1, 29.45], [113.6, 29.8], [114.3, 30.55], [114.9, 30.4], [115.99, 29.75], [116.6, 29.9], [117.05, 30.5], [117.5, 30.7], [118.0, 31.0], [118.37, 31.34], [118.5, 31.6], [118.75, 32.05], [119.15, 32.22], [119.43, 32.23], [119.9, 32.0], [120.3, 31.95], [120.9, 31.8], [121.6, 31.4], [121.95, 31.2]] },
  { name: '黄河', width: 2.6, label: [115.6, 34.75], pts: [[100.5, 36], [103.83, 36.06], [105.5, 37.5], [106.5, 39.3], [108, 40.6], [110, 40.7], [111.1, 40.2], [110.6, 38.8], [110.4, 37.3], [110.4, 35.5], [110.3, 34.6], [111.2, 34.8], [112.4, 34.85], [113.6, 34.9], [114.4, 34.9], [115.2, 34.6], [116.2, 34.45], [117.18, 34.3], [118.0, 34.0], [118.6, 33.75], [119.14, 33.6], [119.6, 33.9], [120.25, 34.3]] },
  { name: '淮河', width: 1.8, label: [116.2, 32.35], pts: [[113.5, 32.4], [114.5, 32.3], [115.6, 32.5], [116.78, 32.6], [117.56, 32.95], [118.5, 33.1], [118.9, 33.3], [119.14, 33.55]] },
  { name: '汉水', width: 1.6, label: [111.3, 32.75], pts: [[106.8, 33.1], [108.5, 32.7], [110.8, 32.6], [112.14, 32.05], [112.5, 31.2], [113.2, 30.6], [114.25, 30.58]] },
  { name: '湘江', width: 1.4, pts: [[111.0, 25.9], [111.6, 26.4], [112.6, 26.9], [112.94, 28.2], [112.9, 28.9], [113.0, 29.3]] },
  { name: '赣江', width: 1.4, pts: [[114.93, 25.85], [115.0, 26.8], [115.4, 27.7], [115.89, 28.68], [116.1, 29.2], [116.2, 29.7]] },
  { name: '西江', width: 1.8, label: [110.2, 23.25], pts: [[106.6, 23.9], [108.3, 23.4], [109.5, 23.4], [110.4, 23.5], [111.3, 23.5], [112.4, 23.1], [113.26, 23.0], [113.6, 22.5]] },
  { name: '漓江', width: 1.1, pts: [[110.29, 25.27], [110.5, 24.4], [111.3, 23.5]] },
  { name: '闽江', width: 1.3, pts: [[117.6, 27.5], [118.32, 27.03], [118.18, 26.64], [118.8, 26.2], [119.3, 26.05], [119.65, 26.1]] },
  { name: '钱塘江', width: 1.3, pts: [[118.87, 28.97], [119.4, 29.4], [119.9, 29.9], [120.2, 30.2], [120.9, 30.4]] },
  { name: '新安江', width: 1.0, pts: [[118.43, 29.87], [119.1, 29.6], [119.6, 29.6], [119.9, 29.9]] },
  { name: '渭河', width: 1.3, pts: [[104.9, 34.6], [107.1, 34.35], [108.94, 34.3], [110.3, 34.6]] },
  { name: '汾河', width: 1.1, pts: [[112.0, 38.6], [112.55, 37.87], [111.6, 36.5], [110.6, 35.6]] },
  { name: '岷江', width: 1.3, pts: [[103.6, 31.6], [103.7, 31.0], [104.0, 30.4], [103.8, 29.6], [104.6, 28.8]] },
  { name: '嘉陵江', width: 1.3, pts: [[106.3, 32.6], [106.1, 31.8], [106.5, 30.7], [106.55, 29.6]] },
];
export const CANALS: { name: string; pts: Line }[] = [
  { name: '运河', pts: [[116.4, 39.9], [117.2, 39.13], [116.6, 38.0], [116.3, 37.0], [116.4, 36.5], [116.6, 35.4], [117.18, 34.3]] },
  { name: '运河', pts: [[119.14, 33.5], [119.3, 33.0], [119.42, 32.39], [119.4, 32.25]] },
  { name: '江南运河', pts: [[119.45, 32.2], [119.95, 31.78], [120.62, 31.3], [120.7, 30.8], [120.16, 30.27]] },
];
export const LAKES: { name: string; lon: number; lat: number; rx: number; ry: number; rot: number }[] = [
  { name: '太湖', lon: 120.2, lat: 31.2, rx: 0.36, ry: 0.3, rot: 0.3 },
  { name: '鄱阳湖', lon: 116.3, lat: 29.15, rx: 0.22, ry: 0.55, rot: 0.25 },
  { name: '洞庭湖', lon: 112.75, lat: 29.15, rx: 0.42, ry: 0.28, rot: -0.2 },
  { name: '洪泽湖', lon: 118.62, lat: 33.3, rx: 0.2, ry: 0.15, rot: 0 },
  { name: '巢湖', lon: 117.55, lat: 31.58, rx: 0.2, ry: 0.11, rot: 0.2 },
  { name: '高邮湖', lon: 119.35, lat: 32.85, rx: 0.1, ry: 0.22, rot: 0 },
];
export const MOUNTAINS: { name: string; pts: Line; size: number }[] = [
  { name: '秦岭', size: 1.2, pts: [[104, 34], [106, 33.8], [108, 33.9], [110, 34.0], [111.5, 33.8]] },
  { name: '大巴山', size: 1.0, pts: [[106, 32.3], [108, 32.0], [110, 31.8]] },
  { name: '大别山', size: 0.9, pts: [[113.8, 31.6], [115.0, 31.3], [116.3, 31.1]] },
  { name: '武夷山', size: 1.0, pts: [[116.4, 25.8], [117.2, 26.8], [117.9, 27.6], [118.6, 28.1]] },
  { name: '南岭', size: 1.0, pts: [[109.8, 25.6], [111.5, 25.3], [113.2, 25.1], [115.2, 24.8]] },
  { name: '太行山', size: 1.1, pts: [[113.3, 35.3], [113.7, 36.5], [114.1, 37.8], [114.8, 39.3]] },
  { name: '燕山', size: 0.9, pts: [[115.4, 40.6], [117.3, 40.5], [119.2, 40.3]] },
  { name: '吕梁山', size: 0.9, pts: [[110.9, 36.1], [111.3, 37.4], [111.8, 38.6]] },
  { name: '巫山', size: 0.9, pts: [[109.3, 31.4], [110.6, 31.3]] },
  { name: '天目山', size: 0.8, pts: [[117.7, 30.0], [118.6, 30.25], [119.5, 30.45]] },
  { name: '武陵山', size: 0.9, pts: [[108.6, 28.8], [109.8, 28.0], [110.8, 27.0]] },
  { name: '大凉山', size: 1.0, pts: [[101.3, 28.6], [102.6, 27.5], [103.2, 28.6]] },
  { name: '祁连山', size: 1.2, pts: [[97.6, 39.4], [99.8, 38.4], [102.4, 37.3]] },
  { name: '泰山', size: 0.8, pts: [[116.9, 36.2], [117.6, 36.0]] },
  { name: '仙霞岭', size: 0.8, pts: [[118.3, 28.15], [119.3, 28.35]] },
  { name: '戴云山', size: 0.8, pts: [[117.7, 25.4], [118.6, 25.9]] },
  { name: '罗霄山', size: 0.8, pts: [[113.9, 26.1], [114.0, 27.4], [114.3, 28.6]] },
  { name: '横断山', size: 1.2, pts: [[98.6, 30.5], [99.2, 28.2], [99.6, 26.0]] },
  { name: '六盘山', size: 0.8, pts: [[106.1, 36.5], [106.3, 35.3]] },
  { name: '伏牛山', size: 0.8, pts: [[110.8, 33.7], [112.2, 33.6], [113.1, 33.4]] },
];
export const GREAT_WALL: Line = [[98.2, 39.8], [100.5, 38.9], [102.6, 37.9], [104, 37.3], [106.5, 37.6], [107.8, 37.8], [109.5, 38.4], [110.6, 39.5], [111.5, 40.2], [113.2, 40.4], [114.9, 40.8], [116.3, 40.4], [117.8, 40.3], [119.75, 40.0]];
