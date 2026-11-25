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
  // 北方与西南
  N('beijing', '北京', 'city', 116.4, 39.9, '北直隶', true, { major: true, title: '顺天府 · 京师' }),
  N('tianjin', '天津', 'port', 117.2, 39.13, '北直隶', true, { title: '天津卫' }),
  N('daming', '大名', 'city', 115.15, 36.28, '北直隶', true, { title: '大名府' }),
  N('jinan', '济南', 'city', 117.0, 36.67, '山东', true, { major: true, title: '济南府 · 山东布政司' }),
  N('taiyuan', '太原', 'city', 112.55, 37.87, '山西', true, { major: true, title: '太原府 · 山西布政司' }),
  N('xian', '西安', 'city', 108.94, 34.26, '陕西', true, { major: true, title: '西安府 · 大顺西京' }),
  N('tongguan', '潼关', 'pass', 110.25, 34.55, '陕西', true, { title: '关隘', note: '关中东大门。' }),
  N('hanzhong', '汉中', 'city', 107.03, 33.07, '陕西', true, { title: '汉中府' }),
  N('lanzhou', '兰州', 'city', 103.83, 36.06, '陕西', true, { title: '临洮府兰州' }),
  N('luoyang', '洛阳', 'city', 112.45, 34.62, '河南', true, { title: '河南府' }),
  N('nanyang', '南阳', 'city', 112.53, 33.0, '河南', true, { title: '南阳府' }),
  N('chengdu', '成都', 'city', 104.07, 30.67, '四川', true, { major: true, title: '成都府 · 四川布政司' }),
  N('chongqing', '重庆', 'city', 106.55, 29.56, '四川', true, { major: true, title: '重庆府' }),
  N('kuizhou', '夔州', 'city', 109.47, 31.02, '四川', true, { title: '夔州府 · 三峡' }),
  N('changsha', '长沙', 'city', 112.94, 28.23, '湖广', true, { major: true, title: '长沙府' }),
  N('ganzhou', '赣州', 'city', 114.93, 25.83, '江西', true, { title: '赣州府' }),
  N('guangzhou', '广州', 'port', 113.26, 23.13, '广东', true, { major: true, title: '广州府 · 广东布政司' }),
  N('guilin', '桂林', 'city', 110.29, 25.27, '广西', true, { major: true, title: '桂林府 · 广西布政司' }),
  N('guiyang', '贵阳', 'city', 106.71, 26.58, '云贵', true, { major: true, title: '贵阳府 · 贵州布政司' }),
  N('kunming', '昆明', 'city', 102.71, 25.04, '云贵', true, { major: true, title: '云南府 · 云南布政司' }),
  N('shanhai', '山海关', 'pass', 119.75, 40.0, '北直隶', true, { title: '关隘' }),
  N('shengjing', '盛京', 'city', 123.43, 41.8, '辽东', true, { major: true, title: '辽东 · 清故都' }),
  // 北直隶
  N('baoding', '保定', 'city', 115.47, 38.87, '北直隶', true, { title: '保定府' }),
  N('zhending', '真定', 'city', 114.57, 38.15, '北直隶', true, { title: '真定府' }),
  N('hejian', '河间', 'city', 116.1, 38.44, '北直隶', true, { title: '河间府' }),
  N('shunde', '顺德', 'city', 114.5, 37.07, '北直隶', true, { title: '顺德府' }),
  N('yongping', '永平', 'city', 118.9, 39.95, '北直隶', true, { title: '永平府' }),
  N('xuanfu', '宣府', 'pass', 115.03, 40.6, '北直隶', true, { title: '宣府镇 · 九边' }),
  // 山东
  N('dengzhou', '登州', 'port', 120.75, 37.8, '山东', true, { title: '登州府 · 海港' }),
  N('laizhou', '莱州', 'city', 119.94, 37.18, '山东', true, { title: '莱州府' }),
  N('qingzhou', '青州', 'city', 118.47, 36.68, '山东', true, { title: '青州府' }),
  N('yanzhou', '兖州', 'city', 116.8, 35.55, '山东', true, { title: '兖州府 · 济宁运河' }),
  N('dongchang', '东昌', 'city', 115.98, 36.45, '山东', true, { title: '东昌府' }),
  N('linqing', '临清', 'port', 115.7, 36.84, '山东', true, { title: '临清州 · 运河码头' }),
  // 山西
  N('datong', '大同', 'pass', 113.3, 40.08, '山西', true, { title: '大同镇 · 九边' }),
  N('pingyang', '平阳', 'city', 111.5, 36.08, '山西', true, { title: '平阳府' }),
  N('luan', '潞安', 'city', 113.1, 36.2, '山西', true, { title: '潞安府' }),
  // 陕西
  N('yanan', '延安', 'city', 109.49, 36.6, '陕西', true, { title: '延安府' }),
  N('yulin', '榆林', 'pass', 109.73, 38.28, '陕西', true, { title: '延绥镇 · 九边' }),
  N('ningxia', '宁夏', 'pass', 106.27, 38.47, '陕西', true, { title: '宁夏镇 · 九边' }),
  N('fengxiang', '凤翔', 'city', 107.39, 34.52, '陕西', true, { title: '凤翔府' }),
  N('pingliang', '平凉', 'city', 106.67, 35.54, '陕西', true, { title: '平凉府' }),
  N('gongchang', '巩昌', 'city', 104.63, 35.0, '陕西', true, { title: '巩昌府' }),
  // 河南
  N('zhangde', '彰德', 'city', 114.35, 36.1, '河南', true, { title: '彰德府' }),
  N('weihui', '卫辉', 'city', 114.07, 35.4, '河南', true, { title: '卫辉府' }),
  N('huaiqing', '怀庆', 'city', 112.93, 35.09, '河南', true, { title: '怀庆府' }),
  N('runing', '汝宁', 'city', 114.36, 32.99, '河南', true, { title: '汝宁府' }),
  // 湖广
  N('yunyang', '郧阳', 'city', 110.8, 32.65, '湖广', true, { title: '郧阳府 · 汉水上游' }),
  N('dean', '德安', 'city', 113.69, 31.26, '湖广', true, { title: '德安府' }),
  N('huangzhou', '黄州', 'city', 114.87, 30.45, '湖广', true, { title: '黄州府' }),
  N('changde', '常德', 'city', 111.69, 29.03, '湖广', true, { title: '常德府' }),
  N('chenzhou', '辰州', 'city', 110.4, 28.45, '湖广', true, { title: '辰州府 · 湘黔通道' }),
  N('hengzhou', '衡州', 'city', 112.6, 26.9, '湖广', true, { title: '衡州府' }),
  N('baoqing', '宝庆', 'city', 111.47, 27.24, '湖广', true, { title: '宝庆府' }),
  N('yongzhou', '永州', 'city', 111.61, 26.42, '湖广', true, { title: '永州府' }),
  N('chen', '郴州', 'city', 113.03, 25.8, '湖广', true, { title: '郴州 · 骑田岭' }),
  // 江西
  N('raozhou', '饶州', 'city', 116.68, 29.0, '江西', true, { title: '饶州府' }),
  N('guangxin', '广信', 'city', 117.94, 28.45, '江西', true, { title: '广信府' }),
  N('fuzhoujx', '抚州', 'city', 116.35, 27.95, '江西', true, { title: '抚州府' }),
  N('jian', '吉安', 'city', 114.99, 27.11, '江西', true, { title: '吉安府' }),
  N('yuanzhou', '袁州', 'city', 114.38, 27.8, '江西', true, { title: '袁州府' }),
  N('nanan', '南安', 'pass', 114.35, 25.39, '江西', true, { title: '南安府 · 梅岭' }),
  // 浙江
  N('huzhou', '湖州', 'city', 120.09, 30.87, '浙江', true, { title: '湖州府' }),
  N('jiaxing', '嘉兴', 'city', 120.75, 30.75, '浙江', true, { title: '嘉兴府' }),
  N('jinhua', '金华', 'city', 119.65, 29.08, '浙江', true, { title: '金华府' }),
  N('taizhou', '台州', 'port', 121.13, 28.85, '浙江', true, { title: '台州府 · 海港' }),
  N('chuzhouzj', '处州', 'city', 119.92, 28.45, '浙江', true, { title: '处州府' }),
  N('zhoushan', '舟山', 'port', 122.1, 30.0, '浙江', true, { title: '舟山 · 海岛' }),
  // 南直隶
  N('jiangyin', '江阴', 'city', 120.27, 31.9, '南直隶', true, { title: '江阴县 · 江防' }),
  // 福建
  N('tingzhou', '汀州', 'city', 116.36, 25.82, '福建', true, { title: '汀州府' }),
  N('shaowu', '邵武', 'city', 117.48, 27.34, '福建', true, { title: '邵武府 · 杉关' }),
  N('xinghua', '兴化', 'city', 119.0, 25.43, '福建', true, { title: '兴化府' }),
  // 广东
  N('shaozhou', '韶州', 'city', 113.6, 24.8, '广东', true, { title: '韶州府' }),
  N('zhaoqing', '肇庆', 'city', 112.47, 23.05, '广东', true, { major: true, title: '肇庆府 · 两广总督驻地' }),
  N('huizhougd', '惠州', 'city', 114.4, 23.08, '广东', true, { title: '惠州府' }),
  N('chaozhou', '潮州', 'port', 116.63, 23.66, '广东', true, { title: '潮州府 · 海港' }),
  N('gaozhou', '高州', 'city', 110.92, 21.65, '广东', true, { title: '高州府' }),
  N('leizhou', '雷州', 'port', 110.08, 20.9, '广东', true, { title: '雷州府' }),
  N('qiongzhou', '琼州', 'port', 110.35, 20.02, '广东', true, { title: '琼州府 · 海南' }),
  // 广西
  N('wuzhou', '梧州', 'city', 111.3, 23.48, '广西', true, { title: '梧州府 · 西江' }),
  N('pingle', '平乐', 'city', 110.64, 24.63, '广西', true, { title: '平乐府' }),
  N('liuzhou', '柳州', 'city', 109.41, 24.33, '广西', true, { title: '柳州府' }),
  N('nanning', '南宁', 'city', 108.37, 22.82, '广西', true, { title: '南宁府' }),
  // 四川
  N('baoning', '保宁', 'city', 105.97, 31.58, '四川', true, { title: '保宁府 · 阆中' }),
  N('shunqing', '顺庆', 'city', 106.08, 30.8, '四川', true, { title: '顺庆府' }),
  N('xuzhousc', '叙州', 'city', 104.63, 28.77, '四川', true, { title: '叙州府' }),
  N('luzhousc', '泸州', 'city', 105.44, 28.88, '四川', true, { title: '泸州' }),
  N('zunyi', '遵义', 'city', 106.93, 27.7, '四川', true, { title: '遵义府' }),
  N('yazhou', '雅州', 'city', 103.0, 29.98, '四川', true, { title: '雅州' }),
  // 云贵
  N('zhenyuan', '镇远', 'city', 108.42, 27.05, '云贵', true, { title: '镇远府' }),
  N('anshun', '安顺', 'city', 105.93, 26.25, '云贵', true, { title: '安顺府' }),
  N('qujing', '曲靖', 'city', 103.8, 25.5, '云贵', true, { title: '曲靖府' }),
  N('chuxiong', '楚雄', 'city', 101.55, 25.03, '云贵', true, { title: '楚雄府' }),
  N('dali', '大理', 'city', 100.16, 25.7, '云贵', true, { title: '大理府' }),
  N('yongchang', '永昌', 'city', 99.17, 25.12, '云贵', true, { title: '永昌府 · 滇西' }),
  N('linan', '临安', 'city', 102.8, 23.62, '云贵', true, { title: '临安府' }),
  // 海外
  N('dayuan', '大员', 'port', 120.2, 23.0, '台湾', true, { title: '台湾 · 热兰遮城', note: '时为荷兰东印度公司所据。' }),
  // 图外之地：只用于划分画面，不参与争夺
  N('menggu', '漠南蒙古', 'outland', 112, 43.2, '外', false),
  N('penghu', '东番', 'outland', 121.6, 24.2, '外', false),
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
];

export const NODE: Record<string, MapNode> = Object.fromEntries(NODES.map(n => [n.id, n]));

/** 计入统一的主要地区 */
export const VICTORY_AREAS = ['北直隶', '山东', '山西', '河南', '陕西', '南直隶', '浙江', '江西', '湖广', '四川', '福建', '广东', '广西', '云贵'];

/** 每日行程（公里）：大军携辎重，陆路日行约三十六里 */
const SPEED: Record<RouteKind, number> = { land: 18, river: 32, canal: 28, sea: 70 };
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
  ['jiujiang', 'anqing', 'river'], ['anqing', 'chizhou', 'river'], ['chizhou', 'wuhu', 'river'],
  ['wuhu', 'taiping', 'river'], ['taiping', 'nanjing', 'river'], ['nanjing', 'yizhen', 'river'], ['yizhen', 'guazhou', 'river'],
  ['guazhou', 'zhenjiang', 'river', 3], ['nanjing', 'zhenjiang', 'river'],
  // 渡江
  ['hezhou', 'taiping', 'river', 2], ['chuzhou', 'nanjing', 'land'], ['yizhen', 'zhenjiang', 'river'],
  // 运河
  ['guazhou', 'yangzhou', 'canal', 2], ['yangzhou', 'huaian', 'canal'], ['huaian', 'xuzhou', 'canal', 1.2], ['tianjin', 'beijing', 'canal'], ['zhenjiang', 'changzhou', 'canal'], ['changzhou', 'suzhou', 'canal'],
  ['hangzhou', 'shaoxing', 'canal'], ['shaoxing', 'ningbo', 'canal'],
  // 淮河
  ['huaian', 'sizhou', 'river'], ['sizhou', 'fengyang', 'river'], ['fengyang', 'shouzhou', 'river'],
  // 江北陆路
  ['yangzhou', 'yizhen', 'land'], ['yangzhou', 'sizhou', 'land', 1.2], ['yizhen', 'chuzhou', 'land'], ['chuzhou', 'fengyang', 'land'],
  ['chuzhou', 'sizhou', 'land'], ['chuzhou', 'hezhou', 'land'], ['hezhou', 'luzhou', 'land'], ['luzhou', 'shouzhou', 'land'],
  ['luzhou', 'anqing', 'land', 1.2], ['luzhou', 'fengyang', 'land'], ['xuzhou', 'guide', 'land'], ['xuzhou', 'sizhou', 'land', 1.2],
  ['xuzhou', 'fengyang', 'land', 1.2], ['guide', 'suizhou', 'land'], ['suizhou', 'kaifeng', 'land'], ['guide', 'shouzhou', 'land', 1.3],
  ['kaifeng', 'luoyang', 'land'], ['kaifeng', 'daming', 'land'], ['kaifeng', 'nanyang', 'land', 1.2], ['nanyang', 'xiangyang', 'land'],
  ['luoyang', 'nanyang', 'land', 1.2], ['luoyang', 'tongguan', 'land'], ['tongguan', 'xian', 'land'], ['xian', 'hanzhong', 'land', 1.6],
  ['hanzhong', 'chengdu', 'land', 1.6], ['taiyuan', 'daming', 'land', 1.2], ['taiyuan', 'beijing', 'land', 1.3],
  ['beijing', 'daming', 'land'], ['shanhai', 'shengjing', 'land', 1.2],
  ['jinan', 'daming', 'land'], ['jinan', 'xuzhou', 'land'], ['daming', 'guide', 'land', 1.2],
  // 湖广、西南
  ['xiangyang', 'wuchang', 'river', 1.2], ['xiangyang', 'jingzhou', 'land'], ['chengdu', 'chongqing', 'river', 1.2], ['hanzhong', 'kuizhou', 'land', 1.8],
  ['changsha', 'yuezhou', 'river'], ['nanchang', 'jiujiang', 'river'], ['nanchang', 'jianning', 'land', 1.5], 
  // 江南、浙闽
  ['chizhou', 'huizhou', 'land', 1.3], ['huizhou', 'ningguo', 'land'], ['huizhou', 'hangzhou', 'river', 1.2], ['huizhou', 'quzhou', 'land', 1.2],
  ['ningguo', 'wuhu', 'land'], ['ningguo', 'hangzhou', 'land', 1.2], ['ningguo', 'nanjing', 'land', 1.1], ['taiping', 'ningguo', 'land'],
  ['changzhou', 'nanjing', 'land'], ['suzhou', 'songjiang', 'river'], ['hangzhou', 'quzhou', 'river', 1.2], ['quzhou', 'xianxia', 'land', 1.3],
  ['xianxia', 'jianning', 'land', 1.4], ['jianning', 'yanping', 'river'], ['yanping', 'fuzhou', 'river'], ['quanzhou', 'anping', 'land'], ['anping', 'xiamen', 'land'], ['xiamen', 'zhangzhou', 'land'], ['quanzhou', 'zhangzhou', 'land'],
  ['wenzhou', 'fuzhou', 'land', 1.4], 
  // 海路
  ['wenzhou', 'fuzhou', 'sea'], ['fuzhou', 'quanzhou', 'sea'],
  ['quanzhou', 'xiamen', 'sea'], ['anping', 'quanzhou', 'sea'], ['tianjin', 'songjiang', 'sea', 1.2],
  ['huaian', 'songjiang', 'sea', 1.3],
  // ---- 全国 ----
  // 北直隶
  ['tianjin', 'linqing', 'canal', 1.3], ['linqing', 'dongchang', 'canal'], ['dongchang', 'yanzhou', 'canal'], ['yanzhou', 'xuzhou', 'canal'],
  ['jinan', 'tianjin', 'land', 1.2], ['jinan', 'linqing', 'land'], ['jinan', 'dongchang', 'land'], ['jinan', 'yanzhou', 'land'],
  ['beijing', 'baoding', 'land'], ['baoding', 'zhending', 'land'], ['baoding', 'hejian', 'land'], ['hejian', 'tianjin', 'land'], ['hejian', 'linqing', 'land', 1.2],
  ['zhending', 'shunde', 'land'], ['zhending', 'taiyuan', 'land', 1.4], ['shunde', 'daming', 'land'], ['shunde', 'zhangde', 'land'],
  ['beijing', 'yongping', 'land'], ['yongping', 'shanhai', 'land'], ['beijing', 'xuanfu', 'land', 1.2], ['xuanfu', 'datong', 'land'],
  // 山东
  ['dengzhou', 'laizhou', 'land'], ['laizhou', 'qingzhou', 'land'], ['qingzhou', 'jinan', 'land'], ['qingzhou', 'yanzhou', 'land', 1.2],
  ['dongchang', 'daming', 'land'], ['linqing', 'daming', 'land'],
  ['dengzhou', 'tianjin', 'sea', 1.2], ['dengzhou', 'huaian', 'sea', 1.3],
  // 山西
  ['datong', 'taiyuan', 'land', 1.1], ['taiyuan', 'pingyang', 'land'], ['pingyang', 'tongguan', 'land', 1.2], ['taiyuan', 'luan', 'land'], ['pingyang', 'luan', 'land'],
  ['luan', 'zhangde', 'land', 1.2], ['luan', 'huaiqing', 'land', 1.2],
  // 陕西
  ['xian', 'yanan', 'land', 1.2], ['yanan', 'yulin', 'land'], ['yulin', 'ningxia', 'land', 1.3], ['ningxia', 'lanzhou', 'land', 1.3], ['ningxia', 'pingliang', 'land', 1.3],
  ['xian', 'fengxiang', 'land'], ['fengxiang', 'pingliang', 'land'], ['fengxiang', 'gongchang', 'land', 1.2], ['gongchang', 'lanzhou', 'land'], ['fengxiang', 'hanzhong', 'land', 1.6],
  ['yanan', 'taiyuan', 'land', 1.5],
  // 河南
  ['zhangde', 'weihui', 'land'], ['zhangde', 'daming', 'land'], ['weihui', 'huaiqing', 'land'], ['weihui', 'kaifeng', 'land'], ['huaiqing', 'luoyang', 'land'],
  ['runing', 'kaifeng', 'land', 1.2], ['runing', 'nanyang', 'land'], ['runing', 'shouzhou', 'land', 1.2], ['runing', 'dean', 'land', 1.3],
  // 湖广
  ['yunyang', 'xiangyang', 'river'], ['yunyang', 'hanzhong', 'river', 1.3], ['dean', 'wuchang', 'land'], ['dean', 'xiangyang', 'land'],
  ['wuchang', 'huangzhou', 'river'], ['huangzhou', 'jiujiang', 'river'], ['changde', 'yuezhou', 'river'], ['changde', 'jingzhou', 'land'],
  ['changde', 'chenzhou', 'river', 1.2], ['chenzhou', 'baoqing', 'land', 1.3], ['changsha', 'hengzhou', 'river'], ['hengzhou', 'yongzhou', 'river'],
  ['hengzhou', 'baoqing', 'land'], ['hengzhou', 'chen', 'land'], ['yongzhou', 'guilin', 'land', 1.2], ['baoqing', 'changsha', 'land', 1.2],
  // 江西
  ['raozhou', 'nanchang', 'river'], ['raozhou', 'jiujiang', 'river'], ['raozhou', 'huizhou', 'land', 1.2], ['raozhou', 'guangxin', 'land'],
  ['guangxin', 'quzhou', 'land'], ['guangxin', 'fuzhoujx', 'land'], ['fuzhoujx', 'nanchang', 'land'], ['fuzhoujx', 'jian', 'land'], ['fuzhoujx', 'shaowu', 'land', 1.3],
  ['jian', 'nanchang', 'river'], ['jian', 'ganzhou', 'river', 1.2], ['jian', 'yuanzhou', 'land'], ['yuanzhou', 'nanchang', 'land'], ['yuanzhou', 'changsha', 'land', 1.2],
  ['ganzhou', 'nanan', 'river'], ['ganzhou', 'tingzhou', 'land', 1.4],
  // 浙江
  ['huzhou', 'hangzhou', 'canal'], ['huzhou', 'changzhou', 'land', 1.2], ['huzhou', 'ningguo', 'land', 1.3], ['suzhou', 'jiaxing', 'canal'], ['jiaxing', 'hangzhou', 'canal'],
  ['songjiang', 'jiaxing', 'land'], ['hangzhou', 'jinhua', 'river', 1.2], ['jinhua', 'quzhou', 'river'], ['jinhua', 'chuzhouzj', 'land'], ['chuzhouzj', 'wenzhou', 'river', 1.2],
  ['chuzhouzj', 'quzhou', 'land', 1.2], ['jinhua', 'taizhou', 'land', 1.3], ['taizhou', 'ningbo', 'land', 1.2], ['taizhou', 'wenzhou', 'land', 1.2],
  ['songjiang', 'zhoushan', 'sea'], ['zhoushan', 'ningbo', 'sea'], ['zhoushan', 'taizhou', 'sea'], ['taizhou', 'wenzhou', 'sea'],
  // 南直隶江防
  ['zhenjiang', 'jiangyin', 'river'], ['jiangyin', 'songjiang', 'river', 1.2], ['jiangyin', 'changzhou', 'land'], ['jiangyin', 'suzhou', 'land'],
  // 福建
  ['tingzhou', 'zhangzhou', 'land', 1.3], ['tingzhou', 'yanping', 'land', 1.3], ['shaowu', 'jianning', 'land'], ['shaowu', 'yanping', 'river'],
  ['fuzhou', 'xinghua', 'land'], ['xinghua', 'quanzhou', 'land'],
  // 广东
  ['nanan', 'shaozhou', 'land', 1.2], ['chen', 'shaozhou', 'land', 1.3], ['shaozhou', 'guangzhou', 'river'], ['guangzhou', 'zhaoqing', 'river'], ['guangzhou', 'huizhougd', 'land'],
  ['huizhougd', 'chaozhou', 'land', 1.2], ['chaozhou', 'zhangzhou', 'land'], ['zhaoqing', 'gaozhou', 'land', 1.2], ['gaozhou', 'leizhou', 'land'],
  ['xiamen', 'chaozhou', 'sea'], ['chaozhou', 'guangzhou', 'sea', 1.2], ['leizhou', 'qiongzhou', 'sea'], ['qiongzhou', 'guangzhou', 'sea', 1.3],
  // 广西
  ['zhaoqing', 'wuzhou', 'river'], ['wuzhou', 'pingle', 'river'], ['pingle', 'guilin', 'river'], ['wuzhou', 'nanning', 'river', 1.2],
  ['guilin', 'liuzhou', 'land', 1.2], ['liuzhou', 'nanning', 'land', 1.2], ['liuzhou', 'guiyang', 'land', 1.5], ['nanning', 'linan', 'land', 1.6],
  // 四川
  ['hanzhong', 'baoning', 'land', 1.4], ['baoning', 'chengdu', 'land', 1.3], ['baoning', 'shunqing', 'river'], ['shunqing', 'chongqing', 'river'],
  ['chengdu', 'xuzhousc', 'river', 1.2], ['xuzhousc', 'luzhousc', 'river'], ['luzhousc', 'chongqing', 'river'], ['chengdu', 'yazhou', 'land'],
  ['chongqing', 'zunyi', 'land', 1.3], ['zunyi', 'guiyang', 'land', 1.2], ['luzhousc', 'zunyi', 'land', 1.3], ['kuizhou', 'shunqing', 'land', 1.5],
  // 云贵
  ['guiyang', 'zhenyuan', 'land', 1.2], ['zhenyuan', 'chenzhou', 'land', 1.3], ['guiyang', 'anshun', 'land'], ['anshun', 'qujing', 'land', 1.3],
  ['qujing', 'kunming', 'land'], ['kunming', 'chuxiong', 'land'], ['chuxiong', 'dali', 'land'], ['dali', 'yongchang', 'land', 1.3], ['kunming', 'linan', 'land'],
  ['xuzhousc', 'qujing', 'land', 1.8],
  // 台湾
  ['xiamen', 'dayuan', 'sea'], ['anping', 'dayuan', 'sea'],
];

export const ROUTES: Route[] = RAW.map(([a, b, kind, f = 1]) => {
  const d = distanceKm(NODE[a], NODE[b]) * f;
  return { a, b, kind, days: Math.max(2, Math.round(d / SPEED[kind])) };
});

const ADJ = new Map<string, { to: string; route: Route }[]>();
for (const r of ROUTES) {
  (ADJ.get(r.a) ?? ADJ.set(r.a, []).get(r.a)!).push({ to: r.b, route: r });
  (ADJ.get(r.b) ?? ADJ.set(r.b, []).get(r.b)!).push({ to: r.a, route: r });
}
const ROUTE_BY = new Map<string, Route>();
for (const r of ROUTES) { ROUTE_BY.set(r.a + '|' + r.b, r); ROUTE_BY.set(r.b + '|' + r.a, r); }

export function neighbors(id: string): { to: string; route: Route }[] { return ADJ.get(id) ?? []; }

export function routeBetween(a: string, b: string): Route | undefined { return ROUTE_BY.get(a + '|' + b); }

/** 自某地出发到各处的最短天数与前驱（路网固定，结果缓存）。能走海路的船队把陆路计重，免得无谓舍舟 */
const DIJ = new Map<string, { dist: Record<string, number>; prev: Record<string, string> }>();
export function distancesFrom(from: string, canSea: boolean): { dist: Record<string, number>; prev: Record<string, string> } {
  const key = from + (canSea ? '+s' : '');
  const hit = DIJ.get(key);
  if (hit) return hit;
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const done = new Set<string>();
  // 节点不多（约一百五十），线性挑最小即可
  while (true) {
    let u: string | null = null, best = Infinity;
    for (const id in dist) if (!done.has(id) && dist[id] < best) { best = dist[id]; u = id; }
    if (u === null) break;
    done.add(u);
    for (const { to: v, route } of neighbors(u)) {
      if (route.kind === 'sea' && !canSea) continue;
      if (NODE[v]?.kind === 'outland') continue;
      // 船队尽量走水路：陆路须舍舟登岸，按两倍半计
      const nd = best + (canSea && route.kind === 'land' ? route.days * 2.5 : route.days);
      if (dist[v] === undefined || nd < dist[v]) { dist[v] = nd; prev[v] = u; }
    }
  }
  const out = { dist, prev };
  DIJ.set(key, out);
  return out;
}

/** 最短路径（按天数）。canSea=false 时不走海路。返回不含起点的节点序列。 */
export function shortestPath(from: string, to: string, canSea: boolean): string[] | null {
  if (from === to) return [];
  const { dist, prev } = distancesFrom(from, canSea);
  if (dist[to] === undefined) return null;
  const path: string[] = [];
  for (let c = to; c !== from; c = prev[c]) path.unshift(c);
  return path;
}

/** 行军日程：每一站的累计天数，以及每月（三十日）走到哪里 */
export function marchPlan(from: string, path: string[], progress = 0): { node: string; day: number; month: number }[] {
  const out: { node: string; day: number; month: number }[] = [];
  let d = -progress, c = from;
  for (const p of path) { const r = routeBetween(c, p); if (!r) break; d += r.days; out.push({ node: p, day: d, month: Math.max(1, Math.ceil(d / 30)) }); c = p; }
  return out;
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
